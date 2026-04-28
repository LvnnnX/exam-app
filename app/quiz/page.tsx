"use client";

import React, { useState } from 'react';
import { fetchQuizByCode } from '@/lib/quiz';
import { useRouter } from 'next/navigation';

export default function JoinQuizPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [rejection, setRejection] = useState<{ title: string; message: string } | null>(null);
  const router = useRouter();

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setRejection(null);
    
    const quiz = await fetchQuizByCode(code.trim());
    if (quiz) {
      if (quiz.status === 'finished') {
        setRejection({ title: 'Kuis Selesai', message: 'Kuis dengan kode ini telah berakhir dan tidak dapat diikuti lagi.' });
      } else if (quiz.status === 'active') {
        setRejection({ title: 'Kuis Sedang Berjalan', message: 'Kuis telah dimulai. Anda tidak dapat bergabung ke kuis yang sedang berlangsung.' });
      } else {
        router.push(`/quiz/${quiz.quiz_code}`);
      }
    } else {
      setRejection({ title: 'Kode Tidak Valid', message: 'Kode kuis yang Anda masukkan tidak terdaftar di sistem kami.' });
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border text-center">
        <h1 className="text-3xl font-black text-indigo-700 uppercase tracking-widest mb-2">Live Quiz</h1>
        <p className="text-gray-500 font-medium mb-8">Masukkan kode untuk bergabung</p>
        
        <input 
          type="text" 
          placeholder="KODE KUIS (e.g. 123456)" 
          value={code} 
          onChange={e => setCode(e.target.value)}
          className="w-full text-center text-2xl font-mono font-bold py-4 rounded-xl border-2 border-gray-200 focus:border-indigo-600 focus:outline-none mb-6 uppercase"
          maxLength={6}
        />
        
        <button 
          onClick={handleJoin} 
          disabled={loading || !code.trim()}
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {loading ? 'MENYAMBUNGKAN...' : 'BERGABUNG'}
        </button>
        
        <div className="mt-6">
          <button onClick={() => router.push('/')} className="text-gray-400 font-bold hover:text-gray-600 transition-colors">
            Kembali ke Ujian Mandiri
          </button>
        </div>
      </div>

      {/* Rejection Modal */}
      {rejection && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-[#FFF5F5] rounded-[40px] shadow-[0_20px_60px_rgba(255,0,0,0.08)] max-w-sm w-full overflow-hidden border-2 border-[#FED7D7] animate-in zoom-in duration-500">
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-white rounded-full shadow-inner flex items-center justify-center mx-auto mb-8 border border-[#FED7D7]">
                <svg className="w-10 h-10 text-[#F56565]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-[#742A2A] mb-4 tracking-tight leading-none uppercase">{rejection.title}</h2>
              <p className="text-[#9B2C2C]/70 font-bold text-sm leading-relaxed px-4">{rejection.message}</p>
            </div>
            <div className="p-8 pt-0">
              <button 
                onClick={() => setRejection(null)}
                className="w-full py-4 bg-white border-2 border-[#FED7D7] text-[#E53E3E] rounded-[24px] font-black uppercase tracking-widest hover:bg-[#FFF5F5] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
              >
                Coba Kode Lain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
