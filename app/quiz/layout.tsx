import type { Metadata } from 'next';

// A quiz page only lives for one session, so it should never show up in search.
export const metadata: Metadata = {
  title: 'Kuis live',
  robots: { index: false, follow: false },
};

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
