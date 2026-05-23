import { Geist } from 'next/font/google';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-admin-geist',
  display: 'swap',
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${geist.variable} font-[var(--font-admin-geist)]`}>{children}</div>;
}
