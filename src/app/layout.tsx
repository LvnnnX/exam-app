import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { HOME_DESCRIPTION, HOME_TITLE, SITE_NAME, SITE_URL } from '@/src/lib/site';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: `%s · ${SITE_NAME}` },
  description: HOME_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { type: 'website', locale: 'id_ID', siteName: SITE_NAME },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false, email: false, address: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-canvas text-fg font-sans selection:bg-primary/20">
        <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col p-3 sm:p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
