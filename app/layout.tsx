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
