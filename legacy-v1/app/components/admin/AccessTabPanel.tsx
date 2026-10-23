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

  const stickyCell = 'bg-[var(--glass-solid)]';

  return (
    <div data-theme={theme} className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="glass shrink-0 rounded-3xl px-5 py-4">
        <h2 className="text-[22px] font-bold tracking-tight text-fg">Access control</h2>
        <p className="mt-0.5 text-[13px] text-fg-muted">Manage roles and permissions per admin.</p>
      </div>

      <div className="glass shrink-0 overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="text-[16px] font-bold tracking-tight text-fg">Signup requests</h3>
            <p className="mt-0.5 text-[13px] text-fg-muted">Approve or reject pending admins.</p>
          </div>
          <span className="clay inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-bold tabular-nums">{pendingRequests.length} pending</span>
        </div>
        <div className="space-y-2 px-4 py-4 sm:px-5">
          {pendingRequests.map((request) => (
            <div key={request.id} className="well flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-fg">{request.email}</p>
                <p className="mt-0.5 text-[13px] text-fg-muted">@{request.username} · {request.requestedRole}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => approveRequest(request)} disabled={savingUserId === request.userId} className="h-11 rounded-xl bg-primary/12 px-4 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/18 disabled:opacity-50">Approve</button>
                <button type="button" onClick={() => rejectRequest(request)} disabled={savingUserId === request.userId} className="h-11 rounded-xl bg-danger/10 px-4 text-[13px] font-semibold text-danger transition-calm hover:bg-danger/15 disabled:opacity-50">Reject</button>
              </div>
            </div>
          ))}
          {pendingRequests.length === 0 && (
            <p className="px-1 text-[13px] text-fg-muted" role="status">
              {loading ? 'Loading requests…' : 'No pending signup requests.'}
            </p>
          )}
        </div>
      </div>

      <div className="glass min-h-0 flex-1 overflow-hidden rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-5 py-4">
          <div className="min-w-[220px] flex-1">
            <h3 className="text-[16px] font-bold tracking-tight text-fg">Permission matrix</h3>
            <p className="mt-0.5 text-[13px] text-fg-muted">Adjust granular permissions per admin without changing role.</p>
          </div>
          <button type="button" onClick={loadAdmins} disabled={loading} className="well well-hover flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-medium text-fg transition-calm disabled:opacity-50">
            {loading && <span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" />}
            Refresh
          </button>
        </div>

        <div className="results-table-scroll-light h-[calc(100%-80px)] overflow-auto">
          <table className="min-w-max border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr>
                <th className={`sticky left-0 top-0 z-20 min-w-[260px] border-b border-line px-5 py-3 text-[12px] font-semibold text-fg-muted ${stickyCell}`}>Admin</th>
                {ADMIN_PERMISSIONS.map((permission) => (
                  <th key={permission} className={`sticky top-0 z-10 min-w-[92px] whitespace-pre-line border-b border-line px-2 py-3 text-center text-[12px] font-semibold text-fg-muted ${stickyCell}`}>
                    {shortPermissionLabel(permission)}
                  </th>
                ))}
                <th className={`sticky right-0 top-0 z-20 min-w-[180px] border-b border-line px-5 py-3 text-[12px] font-semibold text-fg-muted ${stickyCell}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => {
                const row = rowDrafts[admin.userId] || profileToDraft(admin);
                return (
                  <tr key={admin.userId} className="group">
                    <td className={`sticky left-0 z-10 border-b border-line px-5 py-3 ${stickyCell}`}>
                      <p className="max-w-[240px] truncate text-[14px] font-semibold text-fg">{admin.email}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="truncate text-[12px] text-fg-muted">@{admin.username}</p>
                        <span className="well shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold text-fg-muted">{admin.role}</span>
                      </div>
                    </td>
                    {ADMIN_PERMISSIONS.map((permission) => (
                      <td key={permission} className="border-b border-line px-2 py-3 text-center transition-calm group-hover:bg-[var(--well-bg)]">
                        <input
                          type="checkbox"
                          aria-label={`${permission} for ${admin.email}`}
                          checked={Boolean(row.permissions[permission])}
                          onChange={() => toggleRowPermission(admin.userId, permission)}
                          className="h-5 w-5 cursor-pointer accent-[var(--primary)]"
                        />
                      </td>
                    ))}
                    <td className={`sticky right-0 z-10 border-b border-line px-5 py-2 ${stickyCell}`}>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => saveAdminDraft(row, admin.userId)} disabled={savingUserId === admin.userId} className="h-11 rounded-xl bg-primary/12 px-4 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/18 disabled:opacity-50 md:h-10">Save</button>
                        <button type="button" onClick={() => deleteAdmin(admin)} disabled={savingUserId === admin.userId} className="h-11 rounded-xl bg-danger/10 px-4 text-[13px] font-semibold text-danger transition-calm hover:bg-danger/15 disabled:opacity-50 md:h-10">Remove</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && admins.length === 0 && (
            <p className="flex items-center gap-2 px-5 py-4 text-[13px] text-fg-muted" role="status">
              <span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" />
              Loading admin profiles…
            </p>
          )}
          {!loading && admins.length === 0 && <p className="px-5 py-4 text-[13px] text-fg-muted">No admin profiles found.</p>}
        </div>
      </div>
    </div>
  );
}
