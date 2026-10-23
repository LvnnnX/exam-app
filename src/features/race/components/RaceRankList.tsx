import React from 'react';
import { rankedList, type RaceLane } from '../logic';

interface RaceRankListProps {
  lanes: RaceLane[];
  announcement: string;
}

export default function RaceRankList({ lanes, announcement }: RaceRankListProps) {
  const list = rankedList(lanes);
  return (
    <section aria-label="Peringkat teks">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <details className="well rounded-2xl">
        <summary className="flex h-11 cursor-pointer items-center rounded-2xl px-4 text-[14px] font-medium text-fg">
          Daftar peringkat
        </summary>
        <ol className="flex flex-col gap-1 px-4 pb-3 text-[13px] text-fg-muted">
          {list.map((l) => (
            <li key={l.id} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-right tabular-nums text-fg">{l.rank ?? '-'}</span>
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <span className="shrink-0 tabular-nums">
                Skor {l.score ?? '?'}, {l.answered}/{l.total} soal
              </span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
