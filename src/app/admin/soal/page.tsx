import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/src/features/auth/server';
import { listQuestions } from '@/src/features/bank-soal/server';
import { getCategoryTree } from '@/src/features/kategori/server';
import BankSoalClient from './BankSoalClient';

export default async function AdminSoalPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== 'active') {
    redirect('/admin/login');
  }

  const [initialData, categories] = await Promise.all([
    listQuestions({ page: 1, limit: 25 }),
    getCategoryTree(),
  ]);

  return (
    <BankSoalClient
      initialQuestions={initialData.rows}
      initialTotal={initialData.total}
      initialPage={initialData.page}
      initialLimit={initialData.limit}
      categories={categories}
    />
  );
}
