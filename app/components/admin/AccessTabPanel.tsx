"use client";

import React, { useEffect, useState } from 'react';
import { ADMIN_PERMISSIONS, type AdminPermissionMap, type AdminProfile, type AdminRole } from '@/lib/admin-permissions';
import getAdminAccessToken from '@/app/hooks/getAdminAccessToken';
import {
  approveAdminSignupRequestAction,
  deleteAdminProfileAction,
  listAdminProfilesAction,
  listAdminSignupRequestsAction,
  rejectAdminSignupRequestAction,
  upsertAdminProfileAction,
  type AdminSignupRequest,
} from '@/app/actions/admin/access';

type Draft = {
  userId: string;
  email: string;
  username: string;
  role: AdminRole;
  permissions: Partial<AdminPermissionMap>;
};

function profileToDraft(admin: AdminProfile): Draft {
  return {
    userId: admin.userId,
    email: admin.email,
    username: admin.username,
    role: admin.role,
    permissions: admin.permissions,
  };
}

function shortPermissionLabel(permission: string) {
  return permission.replace(':', '\n');
}

type AccessTabPanelProps = {
  theme?: 'light' | 'dark';
};

export default function AccessTabPanel({ theme = 'dark' }: AccessTabPanelProps) {
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [requests, setRequests] = useState<AdminSignupRequest[]>([]);
  const [rowDrafts, setRowDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const token = await getAdminAccessToken();
      const [adminRows, requestRows] = await Promise.all([
        listAdminProfilesAction(token),
        listAdminSignupRequestsAction(token),
      ]);
      const editableAdmins = adminRows.filter((admin) => admin.role !== 'super_admin');
      setAdmins(editableAdmins);
      setRequests(requestRows);
      setRowDrafts(Object.fromEntries(editableAdmins.map((admin) => [admin.userId, profileToDraft(admin)])));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to load admin access.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = window.setTimeout(() => void loadAdmins(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const toggleRowPermission = (userId: string, permission: keyof AdminPermissionMap) => {
    setRowDrafts((current) => {
      const row = current[userId];
      if (!row) return current;
      return {
        ...current,
        [userId]: {
          ...row,
          permissions: {
            ...row.permissions,
            [permission]: !row.permissions[permission],
          },
        },
      };
    });
  };

  const saveAdminDraft = async (draft: Draft, savingId: string) => {
    setSavingUserId(savingId);
    try {
      const token = await getAdminAccessToken();
      await upsertAdminProfileAction(token, draft);
      await loadAdmins();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to save admin access.');
    } finally {
      setSavingUserId(null);
    }
  };

  const deleteAdmin = async (admin: AdminProfile) => {
    if (!window.confirm(`Remove admin access for ${admin.email}?`)) return;
    setSavingUserId(admin.userId);
    try {
      const token = await getAdminAccessToken();
      await deleteAdminProfileAction(token, admin.userId);
      await loadAdmins();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to remove admin access.');
    } finally {
      setSavingUserId(null);
    }
  };

  const approveRequest = async (request: AdminSignupRequest) => {
    setSavingUserId(request.userId);
    try {
      const token = await getAdminAccessToken();
      await approveAdminSignupRequestAction(token, request.id, request.requestedRole);
      await loadAdmins();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to approve signup request.');
    } finally {
      setSavingUserId(null);
    }
  };

  const rejectRequest = async (request: AdminSignupRequest) => {
    const reason = window.prompt(`Reject request from ${request.email}?`, '') || undefined;
    setSavingUserId(request.userId);
    try {
      const token = await getAdminAccessToken();
      await rejectAdminSignupRequestAction(token, request.id, reason);
      await loadAdmins();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to reject signup request.');
    } finally {
      setSavingUserId(null);
    }
  };

  const pendingRequests = requests.filter((request) => request.status === 'pending');

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className={`shrink-0 rounded-3xl px-5 py-4 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
        <h2 className={`text-[20px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Access control</h2>
        <p className={`mt-0.5 text-[12px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Manage roles and permissions per admin.</p>
      </div>

      <div className={`shrink-0 overflow-hidden rounded-3xl ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`}>
        <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${theme === 'dark' ? 'border-white/[0.04]' : 'border-black/[0.04]'}`}>
          <div>
            <h3 className={`text-[15px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Signup requests</h3>
            <p className={`mt-0.5 text-[11px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Approve or reject pending admins.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>{pendingRequests.length} pending</span>
        </div>
        <div className="space-y-2 px-5 py-4">
          {pendingRequests.map((request) => (
            <div key={request.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
              <div className="min-w-0">
                <p className={`truncate text-[14px] font-medium tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>{request.email}</p>
                <p className={`mt-0.5 text-[12px] ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>@{request.username} · {request.requestedRole}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => approveRequest(request)} disabled={savingUserId === request.userId} className={`h-8 rounded-full px-4 text-[12px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-white text-gray-900 hover:bg-white/90' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>Approve</button>
                <button type="button" onClick={() => rejectRequest(request)} disabled={savingUserId === request.userId} className={`h-8 rounded-full px-4 text-[12px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}>Reject</button>
              </div>
            </div>
          ))}
          {pendingRequests.length === 0 && <p className={`px-1 text-[12px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>No pending signup requests.</p>}
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-hidden rounded-3xl ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`}>
        <div className={`flex flex-wrap items-start justify-between gap-2 border-b px-5 py-4 ${theme === 'dark' ? 'border-white/[0.04]' : 'border-black/[0.04]'}`}>
          <div className="min-w-[220px] flex-1">
            <h3 className={`text-[15px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Permission matrix</h3>
            <p className={`mt-0.5 text-[11px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Adjust granular permissions per admin without changing role.</p>
          </div>
          <button type="button" onClick={loadAdmins} disabled={loading} className={`h-9 rounded-full px-4 text-[12px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}>Refresh</button>
        </div>

        <div className="h-[calc(100%-72px)] overflow-auto">
          <table className="min-w-max border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr>
                <th className={`sticky left-0 top-0 z-20 min-w-[260px] px-5 py-3 text-[11px] font-medium ${theme === 'dark' ? 'bg-dark-800 text-dark-text-tertiary' : 'bg-white text-gray-500'}`}>Admin</th>
                {ADMIN_PERMISSIONS.map((permission) => (
                  <th key={permission} className={`sticky top-0 z-10 min-w-[92px] whitespace-pre-line px-2 py-3 text-center text-[11px] font-medium ${theme === 'dark' ? 'bg-dark-800 text-dark-text-tertiary' : 'bg-white text-gray-500'}`}>
                    {shortPermissionLabel(permission)}
                  </th>
                ))}
                <th className={`sticky right-0 top-0 z-20 min-w-[140px] px-5 py-3 text-[11px] font-medium ${theme === 'dark' ? 'bg-dark-800 text-dark-text-tertiary' : 'bg-white text-gray-500'}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => {
                const row = rowDrafts[admin.userId] || profileToDraft(admin);
                return (
                  <tr key={admin.userId} className="group">
                    <td className={`sticky left-0 z-10 px-5 py-3 ${theme === 'dark' ? 'bg-dark-800 group-hover:bg-white/[0.03]' : 'bg-white group-hover:bg-black/[0.02]'}`}>
                      <p className={`max-w-[240px] truncate text-[13px] font-medium tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>{admin.email}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className={`truncate text-[11px] ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500'}`}>@{admin.username}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${theme === 'dark' ? 'bg-white/5 text-dark-text-tertiary' : 'bg-black/5 text-gray-600'}`}>{admin.role}</span>
                      </div>
                    </td>
                    {ADMIN_PERMISSIONS.map((permission) => (
                      <td key={permission} className={`px-2 py-3 text-center ${theme === 'dark' ? 'group-hover:bg-white/[0.03]' : 'group-hover:bg-black/[0.02]'}`}>
                        <input
                          type="checkbox"
                          aria-label={`${permission} for ${admin.email}`}
                          checked={Boolean(row.permissions[permission])}
                          onChange={() => toggleRowPermission(admin.userId, permission)}
                          className={`h-4 w-4 cursor-pointer ${theme === 'dark' ? 'accent-white' : 'accent-gray-900'}`}
                        />
                      </td>
                    ))}
                    <td className={`sticky right-0 z-10 px-5 py-3 ${theme === 'dark' ? 'bg-dark-800 group-hover:bg-white/[0.03]' : 'bg-white group-hover:bg-black/[0.02]'}`}>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => saveAdminDraft(row, admin.userId)} disabled={savingUserId === admin.userId} className={`h-8 rounded-full px-4 text-[12px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-white text-gray-900 hover:bg-white/90' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>Save</button>
                        <button type="button" onClick={() => deleteAdmin(admin)} disabled={savingUserId === admin.userId} className={`h-8 rounded-full px-4 text-[12px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10 hover:text-accent-red' : 'bg-black/5 text-gray-700 hover:bg-black/10 hover:text-red-600'}`}>Remove</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && admins.length === 0 && <p className={`px-5 py-4 text-[12px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>No admin profiles found.</p>}
        </div>
      </div>
    </div>
  );
}
