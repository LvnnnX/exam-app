import React from 'react';
import { forbidden, redirect } from 'next/navigation';
import { getCurrentAdmin, listAllAdmins } from '@/src/features/auth/server';
import KelolaAdmin from '@/src/features/auth/components/KelolaAdmin';

export const dynamic = 'force-dynamic';

export default async function KelolaAdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== 'active') redirect('/admin/login');

  if (admin.role !== 'super_admin') forbidden();

  return <KelolaAdmin initialAdmins={await listAllAdmins()} currentAdminId={admin.id} />;
}
