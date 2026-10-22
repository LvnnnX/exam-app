import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/src/features/auth/server';
import AdminResults from '@/src/features/ujian/components/AdminResults';

export const dynamic = 'force-dynamic';

export default async function AdminHasilPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== 'active') {
    redirect('/admin/login');
  }

  return <AdminResults />;
}
