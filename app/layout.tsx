import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EXAM.",
  description: "Athletic-inspired exam platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-nike-white text-nike-black font-sans">
        {/* Sticky Minimal Navigation */}
        <header className="sticky top-0 z-50 bg-nike-white border-b border-nike-grey-200">
          <div className="max-w-[1440px] mx-auto px-4 md:px-12 h-[60px] flex items-center justify-center">
            <div className="font-display text-2xl font-bold tracking-tighter uppercase">
              EXAM.
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
