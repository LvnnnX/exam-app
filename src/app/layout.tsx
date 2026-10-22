import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Smandapura Exam App v2',
  description: 'Sistem Ujian dan Kuis Teracak SMAN 2 Amlapura',
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
