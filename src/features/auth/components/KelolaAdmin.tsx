'use client';

import React, { useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck, Users } from 'lucide-react';
import Modal from '@/src/features/ujian/components/Modal';
import type { AdminListItem, AdminRole, AdminStatus } from '../types';
import { approveAdminAction, rejectAdminAction, toggleAdminStatusAction, updateAdminRoleAction } from '../actions';
import PendingList from './PendingList';
import AdminTable from './AdminTable';

type Feedback = { type: 'success' | 'error'; message: string } | null;

export default function KelolaAdmin({ initialAdmins, currentAdminId }: { initialAdmins: AdminListItem[]; currentAdminId: string }) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState<AdminListItem | null>(null);
  const [reason, setReason] = useState('');

  const pending = admins.filter((a) => a.status === 'pending');
  const others = admins.filter((a) => a.status !== 'pending');
  const activeSupers = admins.filter((a) => a.role === 'super_admin' && a.status === 'active').length;

  function run(
    call: () => Promise<{ success: boolean; error?: string }>,
    patch: Partial<AdminListItem>,
    id: string,
    okMessage: string,
  ) {
    setFeedback(null);
    startTransition(async () => {
      const res = await call();
      if (res.success) {
        setAdmins((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
        setFeedback({ type: 'success', message: okMessage });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Aksi gagal' });
      }
    });
  }

  const approve = (a: AdminListItem) =>
    run(() => approveAdminAction(a.id), { status: 'active' }, a.id, `${a.username} berhasil disetujui.`);

  const confirmReject = () => {
    if (!rejecting) return;
    const a = rejecting;
    setRejecting(null);
    run(
      () => rejectAdminAction(a.id, reason),
      { status: 'rejected', rejection_reason: reason || null },
      a.id,
      `Permohonan ${a.username} ditolak.`,
    );
  };

  const toggleRole = (a: AdminListItem) => {
    const role: AdminRole = a.role === 'super_admin' ? 'admin' : 'super_admin';
    run(() => updateAdminRoleAction(a.id, role), { role }, a.id, `Role ${a.username} sekarang ${role}.`);
  };

  const toggleStatus = (a: AdminListItem) => {
    const status: AdminStatus = a.status === 'active' ? 'rejected' : 'active';
    run(
      () => toggleAdminStatusAction(a.id, status),
      { status },
      a.id,
      `${a.username} ${status === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.`,
    );
  };

  const tabClass = (on: boolean) =>
    `flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold ${on ? 'clay-primary' : 'text-fg-muted hover:text-fg'}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="glass flex flex-col items-start justify-between gap-4 rounded-3xl border border-line p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-center gap-3.5">
          <div className="clay-primary rounded-2xl p-3">
            <Users size={24} aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold text-fg sm:text-xl">Kelola Admin</h1>
            <p className="text-sm text-fg-muted">Persetujuan akun baru, role, dan status admin</p>
          </div>
        </div>
        <div role="tablist" className="well flex items-center gap-1 rounded-2xl border border-line p-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pending'}
            aria-controls="panel-pending"
            id="tab-pending"
            data-testid="tab-pending"
            onClick={() => setTab('pending')}
            className={tabClass(tab === 'pending')}
          >
            <Clock size={14} aria-hidden /> Permohonan ({pending.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            aria-controls="panel-all"
            id="tab-all"
            data-testid="tab-all"
            onClick={() => setTab('all')}
            className={tabClass(tab === 'all')}
          >
            <ShieldCheck size={14} aria-hidden /> Semua admin ({others.length})
          </button>
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          data-testid="admin-feedback-alert"
          className={`flex items-center gap-2.5 rounded-2xl border p-4 text-sm font-medium ${
            feedback.type === 'success' ? 'border-primary/30 bg-primary/10 text-fg' : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={18} className="shrink-0 text-primary" aria-hidden />
          ) : (
            <AlertTriangle size={18} className="shrink-0" aria-hidden />
          )}
          {feedback.message}
        </div>
      )}

      <div id="panel-pending" role="tabpanel" aria-labelledby="tab-pending" hidden={tab !== 'pending'}>
        {tab === 'pending' && (
          <PendingList items={pending} busy={busy} onApprove={approve} onReject={(a) => { setReason(''); setRejecting(a); }} />
        )}
      </div>
      <div id="panel-all" role="tabpanel" aria-labelledby="tab-all" hidden={tab !== 'all'}>
        {tab === 'all' && (
          <AdminTable
            items={others}
            busy={busy}
            currentAdminId={currentAdminId}
            activeSupers={activeSupers}
            onToggleRole={toggleRole}
            onToggleStatus={toggleStatus}
          />
        )}
      </div>

      {rejecting && (
        <Modal
          title={`Tolak ${rejecting.username}?`}
          onClose={() => setRejecting(null)}
          testId="reject-modal"
          footer={
            <>
              <button type="button" onClick={() => setRejecting(null)} className="well well-hover min-h-11 rounded-2xl border border-line px-4 text-sm font-semibold text-fg">
                Batal
              </button>
              <button type="button" disabled={busy} onClick={confirmReject} data-testid="reject-confirm" className="clay-danger min-h-11 rounded-2xl px-4 text-sm font-bold disabled:opacity-50">
                Tolak permohonan
              </button>
            </>
          }
        >
          <label htmlFor="reject-reason" className="mb-1.5 block text-sm font-semibold text-fg-muted">
            Alasan (opsional, tercatat di log audit)
          </label>
          <textarea
            id="reject-reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="well w-full resize-none rounded-2xl border border-line p-3 text-sm text-fg focus:border-primary focus:outline-none"
          />
        </Modal>
      )}
    </div>
  );
}
