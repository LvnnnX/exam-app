import React from 'react';

// Heading of the exam setup screen. It is also shown while a saved session
// is restored, so the HTML the server sends already says what the page is.
export default function ExamIntro({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-6 md:mb-8">
      <p className="mb-2 text-[13px] font-medium text-fg-muted">Smandapura Shuffled Exam</p>
      <h1 className="mb-2 text-[36px] font-bold leading-[1.05] tracking-[-0.02em] text-fg sm:text-[44px]">
        Latihan soal OSK dan OSN 2026.
      </h1>
      <p className="text-[15px] text-fg-muted">
        Pilih mode, mapel, dan bab, lalu mulai kapan pun kamu siap. Soal diacak di setiap sesi.
      </p>
      {children}
    </div>
  );
}
