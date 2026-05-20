import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SiteHeader from "@/app/components/SiteHeader";
import { Providers } from "@/app/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Smandapura Shuffled Exam",
  description: "Website Kuis untuk OSK-2026 Smandapura",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        {/*
          Preconnect to Supabase so the TLS + DNS handshake for realtime and
          REST traffic completes before the first query. Saves ~150-300ms on
          the first interactive request when network RTT is non-trivial.
        */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
          <>
            <link
              rel="preconnect"
              href={process.env.NEXT_PUBLIC_SUPABASE_URL}
              crossOrigin="anonymous"
            />
            <link
              rel="dns-prefetch"
              href={process.env.NEXT_PUBLIC_SUPABASE_URL}
            />
          </>
        ) : null}
      </head>
      <body className="min-h-full flex flex-col bg-nike-white text-nike-black font-sans">
        <Providers>
          <SiteHeader />

          {/* Main Content Area */}
          <main className="flex-1 w-full max-w-[1440px] mx-auto flex flex-col">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
