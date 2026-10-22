import React from 'react';
import type { AdminListItem } from '../types';

export default function AdminTable({
  items,
  busy,
  currentAdminId,
  activeSupers,
  onToggleRole,
  onToggleStatus,
}: {
  items: AdminListItem[];
  busy: boolean;
  currentAdminId: string;
  activeSupers: number;
  onToggleRole: (a: AdminListItem) => void;
  onToggleStatus: (a: AdminListItem) => void;
}) {
  const btn = 'well well-hover min-h-11 rounded-xl border border-line px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="glass overflow-x-auto rounded-3xl border border-line">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-bold uppercase tracking-wider text-fg-muted">
            <th scope="col" className="p-3.5 pl-5">Nama dan email</th>
            <th scope="col" className="p-3.5">Role</th>
            <th scope="col" className="p-3.5">Status</th>
            <th scope="col" className="p-3.5">Bergabung</th>
            <th scope="col" className="p-3.5 pr-5 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((a) => {
            const isSelf = a.id === currentAdminId;
            // Mirrors the DB trigger: the last active super admin cannot be demoted or disabled.
            const lastSuper = a.role === 'super_admin' && a.status === 'active' && activeSupers <= 1;
            return (
              <tr key={a.id} data-testid={`admin-row-${a.id}`}>
                <td className="p-3.5 pl-5">
                  <div className="font-bold text-fg">
                    {a.username}
                    {isSelf && <span className="ml-1.5 text-xs font-normal text-primary">(kamu)</span>}
                  </div>
                  <div className="text-xs text-fg-subtle">{a.email}</div>
                </td>
                <td className="p-3.5">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${a.role === 'super_admin' ? 'border-highlight/40 bg-highlight/15 text-highlight-fg' : 'border-primary/30 bg-primary/10 text-primary'}`}>
                    {a.role}
                  </span>
                </td>
                <td className="p-3.5">
                  <span className={`text-xs font-semibold ${a.status === 'active' ? 'text-primary' : 'text-danger'}`}>
                    {a.status === 'active' ? 'Aktif' : 'Nonaktif'}
                  </span>
                  {a.status === 'rejected' && a.rejection_reason && (
                    <span className="block max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-fg-subtle" title={a.rejection_reason}>
                      Alasan: {a.rejection_reason}
                    </span>
                  )}
                </td>
                <td className="p-3.5 text-xs text-fg-subtle">
                  {new Date(a.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="p-3.5 pr-5">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy || lastSuper}
                      data-testid={`role-btn-${a.id}`}
                      title={lastSuper ? 'Satu-satunya super admin aktif' : undefined}
                      onClick={() => onToggleRole(a)}
                      className={`${btn} text-fg`}
                    >
                      {a.role === 'super_admin' ? 'Jadikan admin' : 'Jadikan super admin'}
                    </button>
                    <button
                      type="button"
                      disabled={busy || lastSuper}
                      data-testid={`status-btn-${a.id}`}
                      title={lastSuper ? 'Satu-satunya super admin aktif' : undefined}
                      onClick={() => onToggleStatus(a)}
                      className={`${btn} ${a.status === 'active' ? 'text-danger' : 'text-primary'}`}
                    >
                      {a.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
