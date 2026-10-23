import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/src/features/auth/server';
import { getCategoryTree } from '@/src/features/kategori/server';
import KategoriClient from './KategoriClient';

export default async function AdminKategoriPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== 'active') {
    redirect('/admin/login');
  }

  const tree = await getCategoryTree();

  return <KategoriClient initialTree={tree} />;
}
