-- Migration: 20261022042000_phase6_security_hardening.sql
-- Fase 6: Harden rate limit (per-email per PRD AU-04, no shared-NAT lockouts),
-- drop redundant public-insert policy on admins (service_role handles register),
-- drop orphaned legacy functions referencing dropped tables, and validate username at DB level.

BEGIN;

-- 1. AU-04 rate limit: scoped strictly per identifier (email).
-- Previous IP-or clause locked out entire schools behind shared NAT and was spoofable via XFF.
-- p_ip_hash kept as an audit-only parameter for backward compatibility.
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
    AND lower(identifier) = lower(trim(p_identifier));

  RETURN v_fails < 5;
END;
$$;

-- 2. DB-level constraint: valid usernames only.
ALTER TABLE public.admins
  DROP CONSTRAINT IF EXISTS chk_admins_username_format;
ALTER TABLE public.admins
  ADD CONSTRAINT chk_admins_username_format
  CHECK (username ~ '^[a-z0-9_.]{3,32}$');

-- 3. Drop user_create_signup policy. Registration is executed via service_role in
-- registerAdminAction (actions.ts:99); direct REST inserts by authenticated users are forbidden.
DROP POLICY IF EXISTS user_create_signup ON public.admins;

-- 4. Drop orphaned legacy v1 functions that reference dropped tables (admin_profiles, player, admin_audit_log).
DROP FUNCTION IF EXISTS public.resolve_admin_login_email(text);
DROP FUNCTION IF EXISTS public.log_admin_action(text, jsonb);
DROP FUNCTION IF EXISTS public.get_player_question_ids_admin(text, text);

COMMIT;
