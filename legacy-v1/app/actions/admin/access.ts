"use server";

import { requireAdmin, requireAuthenticatedUser, requireSuperAdmin } from '@/lib/admin-server';
import {
  type AdminPermissionMap,
  type AdminProfile,
  type AdminRole,
  getEffectivePermissions,
  isAdminRole,
  normalizePermissionOverrides,
} from '@/lib/admin-permissions';
import { createHmac } from 'crypto';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

type AdminProfileRow = {
  user_id: string;
  email: string;
  username: string | null;
  role: string;
  permissions: unknown;
};

type UpsertAdminProfileInput = {
  userId: string;
  email: string;
  username: string;
  role: AdminRole;
  permissions?: Partial<AdminPermissionMap>;
};

export type AdminSignupRequest = {
  id: string;
  userId: string;
  email: string;
  username: string;
  requestedRole: Exclude<AdminRole, 'super_admin'>;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

type AdminSignupRequestRow = {
  id: string;
  user_id: string;
  email: string;
  username: string | null;
  requested_role: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type SignupRole = Exclude<AdminRole, 'super_admin'>;

function toProfile(row: AdminProfileRow): AdminProfile {
  if (!isAdminRole(row.role)) throw new Error('Invalid admin role');
  return {
    userId: row.user_id,
    email: row.email,
    username: row.username || row.email.split('@')[0] || 'admin',
    role: row.role,
    permissions: getEffectivePermissions(row.role, row.permissions),
  };
}

function assertUserId(value: string) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error('Invalid user id');
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');
  return email;
}

function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9_][a-z0-9_.-]{2,31}$/.test(username)) throw new Error('Invalid username');
  return username;
}

function assertSignupRole(value: AdminRole): asserts value is SignupRole {
  if (value !== 'teacher' && value !== 'admin') throw new Error('Invalid requested role');
}

function assertRequestId(value: string) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error('Invalid request id');
}

function toSignupRequest(row: AdminSignupRequestRow): AdminSignupRequest {
  if (row.requested_role !== 'teacher' && row.requested_role !== 'admin') throw new Error('Invalid requested role');
  if (row.status !== 'pending' && row.status !== 'approved' && row.status !== 'rejected') throw new Error('Invalid request status');
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    username: row.username || row.email.split('@')[0] || 'admin',
    requestedRole: row.requested_role,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  };
}

async function countSuperAdmins(supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase']) {
  const { count, error } = await supabase
    .from('admin_profiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'super_admin');
  if (error) throw new Error(error.message);
  return count || 0;
}

export async function resolveAdminLoginIdentifierAction(identifier: string): Promise<string> {
  const value = identifier.trim().toLowerCase();
  if (!value) throw new Error('Invalid credentials');
  if (value.includes('@')) return normalizeEmail(value);

  const username = normalizeUsername(value);
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error('Invalid credentials');
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.rpc('resolve_admin_login_email', { p_username: username });
  if (error || !data) throw new Error('Invalid credentials');
  return normalizeEmail(String(data));
}

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error('Configuration error');
  return createClient(url, anonKey);
}

async function getRequestIpHash(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim();
    const real = h.get('x-real-ip')?.trim();
    const ip = fwd || real || 'unknown';
    const secret = process.env.EXAM_SECRET_KEY?.trim() || 'no-salt';
    return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);
  } catch {
    return 'unknown';
  }
}

/**
 * Throttle check before attempting admin login. Returns silently when allowed,
 * throws "Too many failed attempts" when locked out.
 */
export async function precheckAdminLoginAction(identifier: string): Promise<void> {
  const value = identifier?.trim().toLowerCase();
  if (!value) throw new Error('Invalid credentials');

  const supabase = getAnonClient();
  const ipHash = await getRequestIpHash();
  const { data, error } = await supabase.rpc('check_admin_login_allowed', {
    p_identifier: value,
    p_ip_hash: ipHash,
  });
  if (error) throw new Error('Login check failed');
  if (data !== true) {
    throw new Error('Too many failed attempts. Try again in 15 minutes.');
  }
}

/**
 * Record the result of an admin login attempt. Called from the client after
 * supabase.auth.signInWithPassword resolves.
 */
export async function recordAdminLoginAttemptAction(
  identifier: string,
  success: boolean
): Promise<void> {
  const value = identifier?.trim().toLowerCase();
  if (!value) return;
  try {
    const supabase = getAnonClient();
    const ipHash = await getRequestIpHash();
    await supabase.rpc('record_admin_login_attempt', {
      p_identifier: value,
      p_ip_hash: ipHash,
      p_success: Boolean(success),
    });
  } catch {
    // Throttle is best-effort; don't break login on telemetry failure.
  }
}

export async function getCurrentAdminProfileAction(accessToken: string): Promise<AdminProfile> {
  const { admin } = await requireAdmin(accessToken);
  return admin;
}

export async function listAdminProfilesAction(accessToken: string): Promise<AdminProfile[]> {
  const { supabase } = await requireSuperAdmin(accessToken);
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('user_id, email, username, role, permissions')
    .order('email', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as AdminProfileRow[]).map(toProfile);
}

export async function upsertAdminProfileAction(accessToken: string, input: UpsertAdminProfileInput): Promise<void> {
  const { supabase, user } = await requireSuperAdmin(accessToken);
  assertUserId(input.userId);
  if (!isAdminRole(input.role)) throw new Error('Invalid admin role');
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  const permissions = normalizePermissionOverrides(input.permissions || {});

  if (input.userId === user.id && input.role !== 'super_admin' && await countSuperAdmins(supabase) <= 1) {
    throw new Error('Cannot remove the last super admin');
  }

  const { error } = await supabase.from('admin_profiles').upsert({
    user_id: input.userId,
    email,
    username,
    role: input.role,
    permissions,
  }, { onConflict: 'user_id' });

  if (error) throw new Error(error.message);
}

export async function deleteAdminProfileAction(accessToken: string, userId: string): Promise<void> {
  const { supabase, user } = await requireSuperAdmin(accessToken);
  assertUserId(userId);
  if (userId === user.id) throw new Error('Cannot delete your own admin profile');

  const { data: target, error: fetchError } = await supabase
    .from('admin_profiles')
    .select('role')
    .eq('user_id', userId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  if (target?.role === 'super_admin' && await countSuperAdmins(supabase) <= 1) {
    throw new Error('Cannot delete the last super admin');
  }

  const { error } = await supabase.from('admin_profiles').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function createAdminSignupRequestAction(accessToken: string, requestedRole: SignupRole, usernameInput: string): Promise<void> {
  assertSignupRole(requestedRole);
  const username = normalizeUsername(usernameInput);
  const { supabase, user } = await requireAuthenticatedUser(accessToken);

  const { data: existingProfile, error: profileError } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (existingProfile) throw new Error('Admin access already granted');

  const { data: existingUsername } = await supabase
    .from('admin_profiles')
    .select('user_id')
    .eq('username', username)
    .maybeSingle();
  if (existingUsername) throw new Error('Username already taken');

  const email = normalizeEmail(user.email || '');
  const { error } = await supabase.from('admin_signup_requests').insert({
    user_id: user.id,
    email,
    username,
    requested_role: requestedRole,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

export async function listAdminSignupRequestsAction(accessToken: string): Promise<AdminSignupRequest[]> {
  const { supabase } = await requireSuperAdmin(accessToken);
  const { data, error } = await supabase
    .from('admin_signup_requests')
    .select('id, user_id, email, username, requested_role, status, reviewed_by, reviewed_at, rejection_reason, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data as AdminSignupRequestRow[]).map(toSignupRequest);
}

export async function approveAdminSignupRequestAction(accessToken: string, requestId: string, role: SignupRole): Promise<void> {
  assertRequestId(requestId);
  assertSignupRole(role);
  const { supabase, user } = await requireSuperAdmin(accessToken);
  const { data: request, error: requestError } = await supabase
    .from('admin_signup_requests')
    .select('id, user_id, email, username, requested_role, status')
    .eq('id', requestId)
    .single();
  if (requestError) throw new Error(requestError.message);
  if (request.status !== 'pending') throw new Error('Request is not pending');

  const { error: profileError } = await supabase.from('admin_profiles').upsert({
    user_id: request.user_id,
    email: normalizeEmail(request.email),
    username: normalizeUsername(request.username),
    role,
    permissions: {},
  }, { onConflict: 'user_id' });
  if (profileError) throw new Error(profileError.message);

  const { error } = await supabase
    .from('admin_signup_requests')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', requestId);
  if (error) throw new Error(error.message);
}

export async function rejectAdminSignupRequestAction(accessToken: string, requestId: string, reason?: string): Promise<void> {
  assertRequestId(requestId);
  const { supabase, user } = await requireSuperAdmin(accessToken);
  const { error } = await supabase
    .from('admin_signup_requests')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: String(reason || '').slice(0, 500) || null,
    })
    .eq('id', requestId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
}
