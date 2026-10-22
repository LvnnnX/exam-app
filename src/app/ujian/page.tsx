import type { Metadata } from 'next';
import UjianApp from '@/src/features/ujian/components/UjianApp';

export const metadata: Metadata = {
  title: 'Ujian Mandiri • ExamApp v2',
  description: 'Latihan soal mandiri mode Exam dan Survival untuk siswa',
};

export default function UjianPage() {
  return <UjianApp />;
}
