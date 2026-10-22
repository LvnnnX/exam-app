export const ADMIN_ROLES = ['super_admin', 'admin', 'teacher'] as const;

export type AdminRole = typeof ADMIN_ROLES[number];

export const ADMIN_PERMISSIONS = [
  'access:manage',
  'question:create',
  'question:update:any',
  'question:update:own',
  'question:delete:any',
  'question:delete:own',
  'topic:delete',
  'settings:update',
  'quiz:manage:any',
  'quiz:manage:own',
  'results:read:any',
  'results:read:own',
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];
export type AdminPermissionMap = Record<AdminPermission, boolean>;

export type AdminProfile = {
  userId: string;
  email: string;
  username: string;
  role: AdminRole;
  permissions: AdminPermissionMap;
};

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: [...ADMIN_PERMISSIONS],
  admin: [
    'question:create',
    'question:update:any',
    'question:delete:own',
    'quiz:manage:any',
    'results:read:any',
  ],
  teacher: [
    'question:create',
    'question:update:own',
    'question:delete:own',
    'quiz:manage:own',
    'results:read:own',
  ],
};

const PERMISSION_SET = new Set<string>(ADMIN_PERMISSIONS);
const ROLE_SET = new Set<string>(ADMIN_ROLES);

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && ROLE_SET.has(value);
}

export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === 'string' && PERMISSION_SET.has(value);
}

export function emptyPermissions(): AdminPermissionMap {
  return Object.fromEntries(ADMIN_PERMISSIONS.map((permission) => [permission, false])) as AdminPermissionMap;
}

export function permissionsFromList(list: AdminPermission[]): AdminPermissionMap {
  const permissions = emptyPermissions();
  for (const permission of list) permissions[permission] = true;
  return permissions;
}

export function normalizePermissionOverrides(value: unknown): Partial<AdminPermissionMap> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => isAdminPermission(key))
      .map(([key, enabled]) => [key, Boolean(enabled)])
  ) as Partial<AdminPermissionMap>;
}

export function getEffectivePermissions(role: AdminRole, overrides: unknown): AdminPermissionMap {
  return {
    ...permissionsFromList(ROLE_PERMISSIONS[role]),
    ...normalizePermissionOverrides(overrides),
  };
}

export function hasPermission(admin: Pick<AdminProfile, 'role' | 'permissions'>, permission: AdminPermission): boolean {
  return admin.role === 'super_admin' || Boolean(admin.permissions[permission]);
}

export function canDeleteQuestion(admin: Pick<AdminProfile, 'role' | 'permissions' | 'userId'>, createdBy: string | null | undefined): boolean {
  if (hasPermission(admin, 'question:delete:any')) return true;
  return Boolean(createdBy && createdBy === admin.userId && hasPermission(admin, 'question:delete:own'));
}
