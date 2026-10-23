import type { Metadata } from 'next';
import UjianApp from '@/src/features/ujian/components/UjianApp';
import { publicPage } from '@/src/lib/site';

const title = 'Latihan Soal OSN Mandiri: Mode Exam & Survival';
export const metadata: Metadata = {
  title,
  ...publicPage(
    '/ujian',
    title,
    'Latihan soal OSN mandiri: pilih mapel, bab, dan sub-bab, lalu kerjakan soal acak dalam mode Exam atau Survival. '
      + 'Hasil dan pembahasan langsung setelah selesai.',
  ),
};

export default function UjianPage() {
  return <UjianApp />;
}
