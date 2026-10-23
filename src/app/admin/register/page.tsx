import type { Metadata } from 'next';
import RegisterForm from '@/src/features/auth/components/RegisterForm';

export const metadata: Metadata = { title: 'Daftar Admin' };

export default function AdminRegisterPage() {
  return <RegisterForm />;
}
