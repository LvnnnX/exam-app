import React from 'react';
import type { Metadata } from 'next';
import QuizRoomClient from './QuizRoomClient';

// A quiz room lives for one session: keep it out of search results.
export const metadata: Metadata = {
  title: 'Kuis Live',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function QuizPage({
  params,
}: {
  params: Promise<{ kode: string }>;
}) {
  const { kode } = await params;

  return (
    <div className="w-full min-h-[80vh] flex flex-col justify-center py-6 px-4">
      <QuizRoomClient code={kode} />
    </div>
  );
}
