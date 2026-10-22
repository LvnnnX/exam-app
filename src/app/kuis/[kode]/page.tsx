import React from 'react';
import QuizRoomClient from './QuizRoomClient';

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
