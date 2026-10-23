-- Migration: 20261022040000_phase6_auth.sql
-- Fase 6: Auth Admin, Super Admin, Approval Workflow, RBAC, and rate limiting.

BEGIN;

-- 1. Table: public.admin_login_attempts
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id bigserial PRIMARY KEY,
  identifier text NOT NULL,
  ip_hash text NOT NULL DEFAULT 'unknown',
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_lookup
  ON public.admin_login_attempts(lower(identifier), attempted_at);

ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_login_attempts ON public.admin_login_attempts;
CREATE POLICY super_admin_login_attempts ON public.admin_login_attempts
  FOR SELECT TO authenticated
  USING (public.check_is_super_admin());

-- 1b. Audit log for admin management actions (approve, reject, role, status)
CREATE TABLE IF NOT EXISTS public.admin_audit (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('approve', 'reject', 'role', 'status')),
  target_admin_id uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admin_read_audit ON public.admin_audit;
CREATE POLICY super_admin_read_audit ON public.admin_audit
  FOR SELECT TO authenticated
  USING (public.check_is_super_admin());

-- 1c. DB-level guard: never leave zero active super admins (covers RPC and direct REST writes)
CREATE OR REPLACE FUNCTION public.trg_keep_one_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.role = 'super_admin' AND OLD.status = 'active'
     AND (TG_OP = 'DELETE' OR NEW.role <> 'super_admin' OR NEW.status <> 'active') THEN
    PERFORM pg_advisory_xact_lock(hashtext('admins_last_super_admin'));
    IF NOT EXISTS (
      SELECT 1 FROM public.admins
      WHERE id <> OLD.id AND role = 'super_admin' AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Minimal harus ada satu super admin aktif';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS keep_one_super_admin ON public.admins;
CREATE TRIGGER keep_one_super_admin
  BEFORE UPDATE OR DELETE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.trg_keep_one_super_admin();

-- 1d. Audit every role/status change, whether via RPC or direct REST write.
CREATE OR REPLACE FUNCTION public.trg_audit_admin_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_audit (actor_user_id, action, target_admin_id, detail)
    VALUES (
      auth.uid(),
      CASE
        WHEN OLD.status = 'pending' AND NEW.status = 'active' THEN 'approve'
        WHEN OLD.status = 'pending' AND NEW.status = 'rejected' THEN 'reject'
        ELSE 'status'
      END,
      NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'reason', NEW.rejection_reason)
    );
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.admin_audit (actor_user_id, action, target_admin_id, detail)
    VALUES (auth.uid(), 'role', NEW.id, jsonb_build_object('from', OLD.role, 'to', NEW.role));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_admin_change ON public.admins;
CREATE TRIGGER audit_admin_change
  AFTER UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_admin_change();

-- 2. Login rate limiting RPCs
CREATE OR REPLACE FUNCTION public.check_admin_login_allowed(p_identifier text, p_ip_hash text DEFAULT 'unknown')
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fails integer;
BEGIN
  IF p_identifier IS NULL OR trim(p_identifier) = '' THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO v_fails
  FROM public.admin_login_attempts
  WHERE attempted_at > now() - interval '15 minutes'
    AND succeeded = false
    AND (
      lower(identifier) = lower(trim(p_identifier))
      OR (p_ip_hash IS NOT NULL AND p_ip_hash <> 'unknown' AND ip_hash = p_ip_hash)
    );

  RETURN v_fails < 5;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_admin_login_attempt(p_identifier text, p_ip_hash text, p_success boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_login_attempts (identifier, ip_hash, succeeded)
  VALUES (
    lower(trim(coalesce(p_identifier, ''))),
    coalesce(nullif(trim(p_ip_hash), ''), 'unknown'),
    coalesce(p_success, false)
  );

  IF p_success THEN
    DELETE FROM public.admin_login_attempts
    WHERE lower(identifier) = lower(trim(coalesce(p_identifier, '')))
      AND succeeded = false
      AND attempted_at > now() - interval '15 minutes';
  END IF;
END;
$$;

-- 3. Approval Workflow RPCs
CREATE OR REPLACE FUNCTION public.rpc_approve_admin_request(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_is_super boolean;
  v_admin record;
BEGIN
  v_caller_is_super := public.check_is_super_admin();
  IF NOT v_caller_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Akses ditolak: Hanya super admin yang diizinkan menyetujui admin');
  END IF;

  SELECT * INTO v_admin FROM public.admins WHERE id = p_admin_id FOR UPDATE;
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permohonan admin tidak ditemukan');
  END IF;

  UPDATE public.admins
  SET status = 'active',
      role = coalesce(role, 'admin'),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = NULL,
      updated_at = now()
  WHERE id = p_admin_id;

  RETURN jsonb_build_object(
    'success', true,
    'admin_id', p_admin_id,
    'status', 'active',
    'role', coalesce(v_admin.role, 'admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_reject_admin_request(p_admin_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_is_super boolean;
  v_admin record;
BEGIN
  v_caller_is_super := public.check_is_super_admin();
  IF NOT v_caller_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Akses ditolak: Hanya super admin yang diizinkan menolak admin');
  END IF;

  SELECT * INTO v_admin FROM public.admins WHERE id = p_admin_id FOR UPDATE;
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permohonan admin tidak ditemukan');
  END IF;

  UPDATE public.admins
  SET status = 'rejected',
      rejection_reason = nullif(trim(p_reason), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_admin_id;

  RETURN jsonb_build_object(
    'success', true,
    'admin_id', p_admin_id,
    'status', 'rejected',
    'rejection_reason', p_reason
  );
END;
$$;

-- 4. Role & Status Management RPCs (with self-protection)
CREATE OR REPLACE FUNCTION public.rpc_update_admin_role(p_admin_id uuid, p_new_role text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_is_super boolean;
  v_admin record;
  v_super_count integer;
BEGIN
  v_caller_is_super := public.check_is_super_admin();
  IF NOT v_caller_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Akses ditolak: Hanya super admin yang diizinkan mengubah role');
  END IF;

  IF p_new_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Role tidak valid: harus admin atau super_admin');
  END IF;

  SELECT * INTO v_admin FROM public.admins WHERE id = p_admin_id FOR UPDATE;
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin tidak ditemukan');
  END IF;

  -- Proteksi Diri: cegah menurunkan role akun sendiri jika satu-satunya super admin aktif
  IF v_admin.user_id = auth.uid() AND p_new_role <> 'super_admin' THEN
    SELECT count(*) INTO v_super_count
    FROM public.admins
    WHERE role = 'super_admin' AND status = 'active';

    IF v_super_count <= 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Tidak dapat menurunkan role akun sendiri karena kamu adalah satu-satunya super admin aktif'
      );
    END IF;
  END IF;

  UPDATE public.admins
  SET role = p_new_role,
      updated_at = now()
  WHERE id = p_admin_id;

  RETURN jsonb_build_object(
    'success', true,
    'admin_id', p_admin_id,
    'role', p_new_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_toggle_admin_status(p_admin_id uuid, p_new_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_is_super boolean;
  v_admin record;
  v_super_count integer;
BEGIN
  v_caller_is_super := public.check_is_super_admin();
  IF NOT v_caller_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Akses ditolak: Hanya super admin yang diizinkan mengubah status admin');
  END IF;

  IF p_new_status NOT IN ('active', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status tidak valid: harus active atau rejected');
  END IF;

  SELECT * INTO v_admin FROM public.admins WHERE id = p_admin_id FOR UPDATE;
  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin tidak ditemukan');
  END IF;

  -- Proteksi Diri: cegah menonaktifkan akun sendiri jika satu-satunya super admin aktif
  IF v_admin.user_id = auth.uid() AND p_new_status <> 'active' THEN
    SELECT count(*) INTO v_super_count
    FROM public.admins
    WHERE role = 'super_admin' AND status = 'active';

    IF v_super_count <= 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Tidak dapat menonaktifkan akun sendiri karena kamu adalah satu-satunya super admin aktif'
      );
    END IF;
  END IF;

  UPDATE public.admins
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_admin_id;

  RETURN jsonb_build_object(
    'success', true,
    'admin_id', p_admin_id,
    'status', p_new_status
  );
END;
$$;

-- 5. List all admins for super admin view
CREATE OR REPLACE FUNCTION public.rpc_list_admins()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_is_super boolean;
  v_rows jsonb;
BEGIN
  v_caller_is_super := public.check_is_super_admin();
  IF NOT v_caller_is_super THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'user_id', a.user_id,
      'email', coalesce(u.email, ''),
      'username', a.username,
      'role', a.role,
      'status', a.status,
      'rejection_reason', a.rejection_reason,
      'reviewed_at', a.reviewed_at,
      'created_at', a.created_at,
      'updated_at', a.updated_at
    ) ORDER BY
      CASE WHEN a.status = 'pending' THEN 0 ELSE 1 END,
      a.created_at DESC
  ), '[]'::jsonb) INTO v_rows
  FROM public.admins a
  LEFT JOIN auth.users u ON u.id = a.user_id;

  RETURN v_rows;
END;
$$;

-- 6. Grants. Rate-limit RPCs are server-only (service_role): anon could otherwise
-- record a fake success and wipe the failure window, or lock out any email.
REVOKE ALL ON FUNCTION public.check_admin_login_allowed(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_admin_login_attempt(text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_admin_login_allowed(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_admin_login_attempt(text, text, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_approve_admin_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_reject_admin_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_update_admin_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_toggle_admin_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_list_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_approve_admin_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reject_admin_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_update_admin_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_toggle_admin_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_list_admins() TO authenticated;

REVOKE ALL ON FUNCTION public.trg_audit_admin_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_keep_one_super_admin() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.admin_login_attempts FROM anon, authenticated;
REVOKE ALL ON public.admin_audit FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit FROM authenticated;
GRANT SELECT ON public.admin_audit TO authenticated;

COMMIT;
