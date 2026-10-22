import React from 'react';
import { CheckCircle2, Mail, UserCheck, UserX } from 'lucide-react';
import type { AdminListItem } from '../types';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function PendingList({
  items,
  busy,
  onApprove,
  onReject,
}: {
  items: AdminListItem[];
  busy: boolean;
  onApprove: (a: AdminListItem) => void;
  onReject: (a: AdminListItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div data-testid="empty-pending-state" className="glass flex flex-col items-center gap-3 rounded-3xl border border-line p-10 text-center">
        <CheckCircle2 size={32} className="text-primary" aria-hidden />
        <p className="text-base font-semibold text-fg">Tidak ada permohonan</p>
        <p className="max-w-sm text-sm text-fg-muted">Permohonan admin baru akan muncul di sini.</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((a) => (
        <li key={a.id} data-testid={`pending-card-${a.id}`} className="glass flex flex-col gap-4 rounded-3xl border border-line p-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-fg">{a.username}</span>
              <span className="rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-xs font-semibold text-warn">Pending</span>
            </div>
            <span className="flex items-center gap-1.5 text-sm text-fg-muted">
              <Mail size={13} aria-hidden /> {a.email}
            </span>
            <span className="text-xs text-fg-subtle">Diajukan {fmt(a.created_at)}</span>
          </div>
          <div className="flex items-center gap-2 border-t border-line pt-3">
            <button
              type="button"
              disabled={busy}
              data-testid={`approve-btn-${a.id}`}
              onClick={() => onApprove(a)}
              className="clay-primary flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 text-sm font-bold disabled:opacity-50"
            >
              <UserCheck size={15} aria-hidden /> Setujui
            </button>
            <button
              type="button"
              disabled={busy}
              data-testid={`reject-btn-${a.id}`}
              onClick={() => onReject(a)}
              className="well well-hover flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-line px-3 text-sm font-bold text-danger disabled:opacity-50"
            >
              <UserX size={15} aria-hidden /> Tolak
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
