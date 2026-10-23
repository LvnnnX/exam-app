import type { Metadata } from 'next';
import LoginForm from '@/src/features/auth/components/LoginForm';
import { safeAdminRedirect } from '@/src/features/auth/validation';

export const metadata: Metadata = { title: 'Login Admin' };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return <LoginForm redirectTo={safeAdminRedirect(redirect || '')} />;
}
