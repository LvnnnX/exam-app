import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-admin-inter',
  display: 'swap',
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${inter.variable} font-[var(--font-admin-inter)]`}>{children}</div>;
}
