import Link from 'next/link';
import { ArrowLeft, ShieldX } from 'lucide-react';

// Rendered by forbidden() under /admin; Next.js sends HTTP 403.
export default function AdminForbidden() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div
        data-testid="forbidden-card"
        role="alert"
        className="glass flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-danger/30 p-6 text-center sm:p-8"
      >
        <ShieldX size={36} className="text-danger" aria-hidden />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-danger">403</span>
          <h1 className="text-lg font-bold text-fg">Akses Ditolak</h1>
          <p className="text-sm text-fg-muted">Halaman ini khusus Super Admin.</p>
        </div>
        <Link href="/admin/soal" className="clay-primary flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-bold">
          <ArrowLeft size={15} aria-hidden /> Kembali ke Bank Soal
        </Link>
      </div>
    </div>
  );
}
