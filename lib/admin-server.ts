import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
  type AdminPermission,
  type AdminProfile,
  type AdminRole,
  canDeleteQuestion,
  getEffectivePermissions,
  hasPermission,
  isAdminRole,
} from '@/lib/admin-permissions';

type AdminProfileRow = {
  user_id: string;
  email: string;
  username: string | null;
  role: string;
  permissions: unknown;
};

export type AdminContext = {
  supabase: SupabaseClient;
  user: User;
  admin: AdminProfile;
};

function getAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || '';
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error('Supabase configuration is required');
  }

  return { url, anonKey };
}

function createAuthedClient(accessToken: string): SupabaseClient {
  const { url, anonKey } = getSupabaseConfig();
  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function normalizeAdminProfile(row: AdminProfileRow): AdminProfile {
  if (!isAdminRole(row.role)) throw new Error('Forbidden');

  return {
    userId: row.user_id,
    email: row.email,
    username: row.username || row.email.split('@')[0] || 'admin',
    role: row.role,
    permissions: getEffectivePermissions(row.role, row.permissions),
  };
}

function bootstrapProfile(user: User): AdminProfile | null {
  const adminEmail = getAdminEmail();
  if (!adminEmail || user.email?.toLowerCase() !== adminEmail) return null;

  const role: AdminRole = 'super_admin';
  return {
    userId: user.id,
    email: user.email || adminEmail,
    username: (user.email || adminEmail).split('@')[0] || 'admin',
    role,
    permissions: getEffectivePermissions(role, {}),
  };
}

export async function requireAuthenticatedUser(accessToken: string): Promise<{ supabase: SupabaseClient; user: User }> {
  if (!accessToken) {
    throw new Error('Unauthorized');
  }

  const supabase = createAuthedClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) throw new Error('Unauthorized');

  return { supabase, user: data.user };
}

export async function requireAdmin(accessToken: string): Promise<AdminContext> {
  const { supabase, user } = await requireAuthenticatedUser(accessToken);

  const { data: profile, error: profileError } = await supabase
    .from('admin_profiles')
    .select('user_id, email, username, role, permissions')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError && profileError.code !== '42P01') throw new Error('Forbidden');

  const admin = profile
    ? normalizeAdminProfile(profile as AdminProfileRow)
    : bootstrapProfile(user);

  if (!admin) throw new Error('Forbidden');

  return { supabase, user, admin };
}

export async function requirePermission(accessToken: string, permission: AdminPermission): Promise<AdminContext> {
  const context = await requireAdmin(accessToken);
  if (!hasPermission(context.admin, permission)) throw new Error('Forbidden');
  return context;
}

export async function requireSuperAdmin(accessToken: string): Promise<AdminContext> {
  const context = await requireAdmin(accessToken);
  if (context.admin.role !== 'super_admin') throw new Error('Forbidden');
  return context;
}

export function assertQuestionDeleteAllowed(admin: AdminProfile, createdBy: string | null | undefined) {
  if (!canDeleteQuestion(admin, createdBy)) throw new Error('Forbidden');
}

export { hasPermission };
