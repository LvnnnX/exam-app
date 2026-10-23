import React from 'react';
import { listActiveQuizzes, listQuizHistory } from '@/src/features/kuis/server';
import AdminKuisClient from './AdminKuisClient';

export const dynamic = 'force-dynamic';

export default async function AdminKuisPage() {
  const activeQuizzes = await listActiveQuizzes();
  const quizHistory = await listQuizHistory();

  return (
    <div className="w-full flex flex-col gap-6">
      <AdminKuisClient
        initialActiveQuizzes={activeQuizzes}
        initialHistory={quizHistory}
      />
    </div>
  );
}
