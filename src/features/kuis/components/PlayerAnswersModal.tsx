'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getPlayerAnswersAction } from '../actions';
import MountAvatar from './MountAvatar';
import type { LivePlayerProgress, PlayerAnswerDetail } from '../types';

interface PlayerAnswersModalProps {
  player: LivePlayerProgress;
  onClose: () => void;
}

export default function PlayerAnswersModal({ player, onClose }: PlayerAnswersModalProps) {
  const [answers, setAnswers] = useState<PlayerAnswerDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPlayerAnswersAction(player.id)
      .then((res) => {
        if (active) setAnswers(res.success && res.answers ? res.answers : []);
      })
      .catch(() => {
        if (active) setAnswers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [player.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl glass-card border border-line p-6 shadow-xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-3">
            <MountAvatar skin={player.skin} size="md" />
            <div>
              <h4 className="font-bold text-fg text-base">{player.name}</h4>
              <p className="text-xs text-fg-subtle">
                Skor: <span className="text-primary font-bold">{player.score}</span> • Waktu: {player.total_time}s
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl well hover:bg-brick-50 text-fg-subtle hover:text-danger transition-colors border border-line"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="p-8 text-center text-xs text-fg-subtle animate-pulse">Memuat jawaban siswa...</p>
        ) : answers.length === 0 ? (
          <p className="p-8 text-center text-xs text-fg-subtle">Belum ada jawaban yang dikirim oleh siswa ini.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {answers.map((ans) => (
              <div
                key={ans.question_id}
                className={`p-3.5 rounded-2xl border flex flex-col gap-2 ${
                  ans.is_correct ? 'bg-success/5 border-success/30' : 'bg-danger/5 border-danger/30'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-fg">Soal #{ans.question_number}</span>
                  <span className={`font-bold ${ans.is_correct ? 'text-success' : 'text-danger'}`}>
                    {ans.is_correct ? '✓ Benar' : '✗ Salah'} ({ans.time_taken}s)
                  </span>
                </div>
                <div
                  className="text-xs text-fg prose prose-sm max-w-none line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: ans.body_html }}
                />
                <div className="flex items-center justify-between text-[11px] font-mono well p-2 rounded-xl border border-line">
                  <span>Jawaban Siswa: <b>{ans.user_answer || '(Kosong)'}</b></span>
                  <span>Kunci: <b>{ans.correct_answer || '-'}</b></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
