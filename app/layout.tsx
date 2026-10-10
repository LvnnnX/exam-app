import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import SiteHeader from "@/app/components/SiteHeader";
import { Providers } from "@/app/providers";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "education",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  ...(googleVerification ? { verification: { google: googleVerification } } : {}),
};

// Tells search engines the site's name and language, which helps the
// result show "Smandapura Shuffled Exam" instead of the bare domain.
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  inLanguage: "id-ID",
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c") }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-fg font-sans">
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
