"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { createQuizSession, updateQuizStatus, fetchQuizPlayers, fetchQuizHistory, fetchActiveSessions, fetchPlayerAnswers, type KuisLog, type Player, type KuisStatus, type KuisResult } from '@/lib/quiz';
import { fetchQuestionsByIds, fetchSubBabs, type RawQuestion, type SubBabInfo } from '@/lib/questions';
import { normalizeCategorySlug } from '@/lib/categories';
import RichContent from '@/app/components/RichContent';

export default function AdminQuizTab({ babs, subBabs, hiddenSubBabs }: { babs: string[], subBabs: {label: string, value: string}[], hiddenSubBabs: string[] }) {
  const [activeView, setActiveView] = useState<'create' | 'manage' | 'history'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_quiz_active_view');
      if (saved === 'create' || saved === 'manage' || saved === 'history') return saved as any;
    }
    return 'create';
  });

  useEffect(() => {
    localStorage.setItem('admin_quiz_active_view', activeView);
  }, [activeView]);
  
  // Create state
  const [selectedBab, setSelectedBab] = useState<string>('Semua BAB');
  const [selectedSubBab, setSelectedSubBab] = useState<string>('Semua Sub-bab');
  const [displaySubBabs, setDisplaySubBabs] = useState<SubBabInfo[]>(subBabs);
  const [loadingSubBabs, setLoadingSubBabs] = useState(false);

  // Sync subBabs prop to displaySubBabs initially or when subBabs prop changes
  useEffect(() => {
    if (selectedBab === 'Semua BAB') {
      setDisplaySubBabs(subBabs);
    }
  }, [subBabs, selectedBab]);

  // Dynamic sub-bab loading based on selectedBab
  useEffect(() => {
    const loadFiltered = async () => {
      if (selectedBab === 'Semua BAB') {
        setDisplaySubBabs(subBabs);
        return;
      }
      
      setLoadingSubBabs(true);
      try {
        const filtered = await fetchSubBabs(selectedBab);
        // Filter out hidden sub-babs
        const visible = filtered.filter(sb => !hiddenSubBabs.includes(normalizeCategorySlug(sb.value)));
        setDisplaySubBabs(visible);
      } finally {
        setLoadingSubBabs(false);
      }
    };
    
    void loadFiltered();
  }, [selectedBab, subBabs, hiddenSubBabs]);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [creating, setCreating] = useState(false);
  
  // Manage state
  const [activeSession, setActiveSession] = useState<KuisLog | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Player Details Modal state
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);
  const [playerAnswers, setPlayerAnswers] = useState<KuisResult[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<RawQuestion[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  
  const [activeSessions, setActiveSessions] = useState<KuisLog[]>([]);
  const [history, setHistory] = useState<KuisLog[]>([]);
  
  // Pagination state
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [playersPage, setPlayersPage] = useState(1);
  const itemsPerPage = 20;
  const historyPerPage = 10;

  useEffect(() => {
    setActivePage(1);
    setHistoryPage(1);
    setPlayersPage(1);
  }, [activeView, activeSession]);
  
  useEffect(() => {
    let channel: any = null;
    
    if (activeSession) {
      // Fetch initial players
      fetchQuizPlayers(activeSession.id).then(setPlayers);
      
      // Subscribe to players/logs only if not finished
      if (activeSession.status !== 'finished') {
        channel = supabase
          .channel('quiz_admin')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'player', filter: `kuis_id=eq.${activeSession.id}` },
            (payload) => {
              fetchQuizPlayers(activeSession.id).then(setPlayers);
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'kuis_logs', filter: `id=eq.${activeSession.id}` },
            (payload) => {
              setActiveSession(payload.new as KuisLog);
            }
          )
          .subscribe();
      }
    } else {
      // List View Logic
      if (activeView === 'history') {
        fetchQuizHistory().then(setHistory);
      } else if (activeView === 'manage') {
        fetchActiveSessions().then(setActiveSessions);
      }
    }
    
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeView, activeSession]);
  
  // Auto-finish timer
  useEffect(() => {
    if (activeSession && activeSession.status === 'active' && activeSession.started_at) {
      const expiresAt = new Date(activeSession.started_at).getTime() + (activeSession.duration_minutes * 60000);
      
      const interval = setInterval(() => {
        const diff = expiresAt - Date.now();
        if (diff <= 0) {
          clearInterval(interval);
          updateQuizStatus(activeSession.id, 'finished');
        }
      }, 5000); // Check every 5 seconds is enough
      
      return () => clearInterval(interval);
    }
  }, [activeSession]);
  
  useEffect(() => {
    if (activeSession) {
      fetchQuestionsByIds(activeSession.question_ids || []).then(setSessionQuestions);
    } else {
      setSessionQuestions([]);
    }
  }, [activeSession]);

  useEffect(() => {
    let channel: any = null;
    if (viewingPlayer) {
      setLoadingAnswers(true);
      fetchPlayerAnswers(viewingPlayer.id).then(ans => {
        setPlayerAnswers(ans);
        setLoadingAnswers(false);
      });

      // Subscribe to live answers if session is not finished
      if (activeSession?.status !== 'finished') {
        channel = supabase.channel(`player_answers_${viewingPlayer.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'kuis_results', filter: `player_id=eq.${viewingPlayer.id}` },
            () => {
              fetchPlayerAnswers(viewingPlayer.id).then(setPlayerAnswers);
            }
          )
          .subscribe();
      }
    } else {
      setPlayerAnswers([]);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [viewingPlayer, activeSession]);

  const handleCreate = async () => {
    setCreating(true);
    const session = await createQuizSession(selectedBab, selectedSubBab, questionCount, durationMinutes);
    if (session) {
      setActiveSession(session);
      setActiveView('manage');
    } else {
      alert("Failed to create session.");
    }
    setCreating(false);
  };

  const handleStatusChange = async (status: KuisStatus) => {
    if (!activeSession) return;
    const ok = await updateQuizStatus(activeSession.id, status);
    if (ok) {
      setActiveSession({ ...activeSession, status });
    } else {
      console.error("Failed to update status for session:", activeSession.id);
      alert("Gagal memperbarui status kuis. Pastikan tabel kuis_logs sudah memiliki kolom 'expires_at' dan 'paused_at' di Supabase.");
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-slate-700">Quiz Management</h2>
          <button
            onClick={() => {
              if (activeSession) {
                fetchQuizPlayers(activeSession.id).then(setPlayers);
              } else if (activeView === 'history') {
                fetchQuizHistory().then(setHistory);
              } else if (activeView === 'manage') {
                fetchActiveSessions().then(setActiveSessions);
              }
            }}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-white border-2 border-[#34C759]/20 text-[#34C759] rounded-xl font-semibold text-xs sm:text-sm hover:bg-[#34C759]/5 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setActiveSession(null);
                setActiveView('create');
              }}
              style={activeView === 'create' ? {background: '#4A90D9'} : {}}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all flex items-center gap-2 ${activeView === 'create'
                ? 'text-white border-transparent shadow-md shadow-blue-200'
                : 'bg-white border-slate-200 text-slate-500 hover:border-[#4A90D9] hover:text-[#4A90D9]'
                }`}
            >
              ✨ Create
            </button>
            <button
              onClick={() => { setActiveSession(null); setActiveView('manage'); }}
              style={activeView === 'manage' ? {background: '#34C759'} : {}}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all flex items-center gap-2 ${activeView === 'manage'
                ? 'text-white border-transparent shadow-md shadow-green-200'
                : 'bg-white border-slate-200 text-slate-500 hover:border-[#34C759] hover:text-[#34C759]'
                }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Active Sessions
            </button>
            <button
              onClick={() => {
                setActiveSession(null);
                setActiveView('history');
              }}
              style={activeView === 'history' ? {background: '#64748B'} : {}}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border-2 transition-all flex items-center gap-2 ${activeView === 'history'
                ? 'text-white border-transparent shadow-md shadow-slate-200'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-600'
                }`}
            >
              📜 History
            </button>
          </div>
        </div>
      </div>

      {activeView === 'create' && !activeSession && (
        <div className="max-w-2xl mx-auto py-8">
          {/* Header Card */}
          <div className="bg-white rounded-[32px] p-8 mb-6 border border-nike-grey-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-[24px] bg-[#F0F7FF] flex items-center justify-center shadow-inner mb-2">
                <span className="text-4xl animate-bounce">🎯</span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-nike-black uppercase tracking-tight">Buat Kuis Baru</h3>
                <p className="text-[14px] font-medium text-nike-grey-400 uppercase tracking-widest mt-1">Konfigurasikan sesi kuis Live</p>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-nike-grey-100 overflow-hidden">
            {/* BAB & Sub-bab */}
            <div className="p-8 pb-6 flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF5F5] flex items-center justify-center border border-[#FED7D7]">
                    <span className="text-xl">📚</span>
                  </div>
                  <label className="text-[14px] font-black text-nike-black uppercase tracking-widest">BAB</label>
                </div>
                <div className="relative">
                  <select
                    value={selectedBab}
                    onChange={(e) => {
                      setSelectedBab(e.target.value);
                      setSelectedSubBab('Semua Sub-bab');
                    }}
                    className="w-full bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[20px] px-6 h-[64px] text-[16px] font-bold text-nike-black focus:outline-none focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/10 transition-all appearance-none cursor-pointer uppercase"
                  >
                    <option value="Semua BAB">✨ Semua BAB</option>
                    {babs.length > 0 ? (
                      babs.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)
                    ) : (
                      <option disabled>Loading BAB...</option>
                    )}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-nike-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF5F5] flex items-center justify-center border border-[#FED7D7]">
                    <span className="text-xl">📖</span>
                  </div>
                  <label className="text-[14px] font-black text-nike-black uppercase tracking-widest">Sub-bab</label>
                </div>
                <div className="relative">
                  <select
                    value={selectedSubBab}
                    onChange={(e) => setSelectedSubBab(e.target.value)}
                    className="w-full bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[20px] px-6 h-[64px] text-[16px] font-bold text-nike-black focus:outline-none focus:border-[#4A90D9] focus:ring-4 focus:ring-[#4A90D9]/10 transition-all appearance-none cursor-pointer uppercase"
                  >
                    <option value="Semua Sub-bab">✨ Semua Sub-bab</option>
                    {loadingSubBabs ? (
                      <option disabled>Loading Sub-babs...</option>
                    ) : displaySubBabs.length > 0 ? (
                      displaySubBabs.map(c => <option key={c.value} value={c.value}>{c.label}</option>)
                    ) : (
                      <option disabled>No Sub-babs found</option>
                    )}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-nike-grey-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Question Count */}
            <div className="p-8 py-6 bg-[#FAFBFF]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#F0FFF4] flex items-center justify-center border border-[#C6F6D5]">
                  <span className="text-xl">✏️</span>
                </div>
                <label className="text-[14px] font-black text-nike-black uppercase tracking-widest">Jumlah Soal</label>
              </div>
              <div className="flex gap-3">
                {[5, 10, 20].map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={`flex-1 h-[60px] rounded-[20px] text-[16px] font-black transition-all border-2 ${
                      questionCount === n
                        ? 'bg-[#4A90D9] border-transparent text-white shadow-lg shadow-[#4A90D9]/20'
                        : 'bg-white border-[#E2E8F0] text-nike-grey-500 hover:border-[#4A90D9] hover:text-[#4A90D9]'
                    }`}
                  >
                    {n} SOAL
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="p-8 py-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#EBF8FF] flex items-center justify-center border border-[#BEE3F8]">
                  <span className="text-xl">⏱️</span>
                </div>
                <label className="text-[14px] font-black text-nike-black uppercase tracking-widest">Durasi Waktu</label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[30, 60, 90, 120].map(m => (
                  <button
                    key={m}
                    onClick={() => setDurationMinutes(m)}
                    className={`h-[60px] rounded-[20px] text-[16px] font-black transition-all border-2 ${
                      durationMinutes === m
                        ? 'bg-[#34C759] border-transparent text-white shadow-lg shadow-[#34C759]/20'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] text-nike-grey-500 hover:border-[#34C759] hover:text-[#34C759]'
                    }`}
                  >
                    {m} MIN
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="p-8 bg-[#F8FAFC]">
              <button
                onClick={handleCreate}
                disabled={creating || displaySubBabs.length === 0}
                className={`w-full h-[72px] rounded-[24px] text-white font-black text-[18px] tracking-widest transition-all shadow-xl active:scale-[0.98] disabled:opacity-80 ${
                  creating || displaySubBabs.length === 0 ? 'bg-slate-300' : 'bg-nike-black hover:bg-nike-grey-500 shadow-nike-black/10'
                }`}
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    CREATING...
                  </span>
                ) : displaySubBabs.length === 0 ? (
                  <span className="flex items-center justify-center gap-3">
                    <span>❌</span> TIDAK ADA SUB-BAB TERSEDIA
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-3">
                    <span>🚀</span> BUAT SESI KUIS
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSession ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveSession(null)} className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-600 transition-colors shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900">Session Details</h2>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Join Code</p>
              <h1 className="text-4xl md:text-5xl font-black text-indigo-700 tracking-widest font-mono">{activeSession.quiz_code}</h1>
              <p className="mt-2 text-sm text-gray-600 font-medium capitalize">Topik: {activeSession.bab?.replace(/_/g, ' ')}, {activeSession.sub_bab?.replace(/_/g, ' ')} <span className="mx-2">•</span> {activeSession.question_count} Questions</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                activeSession.status === 'active' ? 'bg-green-100 text-green-700' : 
                activeSession.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' : 
                activeSession.status === 'paused' ? 'bg-orange-100 text-orange-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {activeSession.status}
              </span>
              <div className="flex gap-2">
                {activeSession.status === 'waiting' && (
                  <button onClick={() => handleStatusChange('active')} className="bg-nike-green text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider hover:bg-green-600 transition-colors shadow-sm">Start Quiz</button>
                )}
                {(activeSession.status === 'active' || activeSession.status === 'paused') && (
                  <>
                    <button 
                      onClick={() => handleStatusChange(activeSession.status === 'active' ? 'paused' : 'active')} 
                      className={`${activeSession.status === 'active' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-nike-green hover:bg-green-600'} text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider transition-colors shadow-sm`}
                    >
                      {activeSession.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => handleStatusChange('finished')} className="bg-nike-red text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wider hover:bg-red-600 transition-colors shadow-sm">End Quiz</button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">Players ({players.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time (s)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {players.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Waiting for players to join...</td></tr>
                  ) : players.slice((playersPage - 1) * itemsPerPage, playersPage * itemsPerPage).map((p, i) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">{((playersPage - 1) * itemsPerPage) + i + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <span className="block max-w-[200px] truncate" title={p.name}>{p.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">{p.score} / {activeSession.question_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.total_time}s</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => setViewingPlayer(p)}
                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded"
                        >
                          View Answers
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {players.length > itemsPerPage && (
              <Pagination 
                totalItems={players.length} 
                itemsPerPage={itemsPerPage} 
                currentPage={playersPage} 
                onPageChange={setPlayersPage} 
              />
            )}
          </div>
        </div>
      ) : (
        <>
          {activeView === 'manage' && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Join Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires In</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No active sessions found.</td>
                    </tr>
                  ) : activeSessions.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage).map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-700 font-mono">
                        <span className="block max-w-[140px] truncate" title={s.quiz_code}>{s.quiz_code}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.status}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">{s.player_count || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.question_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.duration_minutes} min</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {s.expires_at ? (
                          <span className={`${s.status === 'active' || s.status === 'paused' ? 'text-indigo-600' : 'text-red-500'} font-bold`}>
                            {(() => {
                              const referenceTime = (s.status === 'paused' && s.paused_at) ? new Date(s.paused_at).getTime() : Date.now();
                              const diff = new Date(s.expires_at).getTime() - referenceTime;
                              if (diff <= 0) return 'Expired';
                              const hours = Math.floor(diff / (1000 * 60 * 60));
                              const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                              return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                            })()}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => setActiveSession(s)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded">View Detail</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {activeSessions.length > itemsPerPage && (
              <Pagination 
                totalItems={activeSessions.length} 
                itemsPerPage={itemsPerPage} 
                currentPage={activePage} 
                onPageChange={setActivePage} 
              />
            )}
          </div>
      )}

      {activeView === 'history' && (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Join Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topik</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Winner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Top Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No history found.</td>
                    </tr>
                  ) : history.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage).map(h => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        <span className="block max-w-[140px] truncate" title={h.quiz_code}>{h.quiz_code}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        <span
                          className="block max-w-[220px] truncate"
                          title={`${h.bab?.replace(/_/g, ' ')}, ${h.sub_bab?.replace(/_/g, ' ')}`}
                        >
                          {h.bab?.replace(/_/g, ' ')}, {h.sub_bab?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{h.player_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-nike-black">
                        <span className="block max-w-[180px] truncate" title={h.winner}>{h.winner}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-nike-green">{h.top_score} / {h.question_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(h.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-gray-100 text-gray-700">{h.status}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => setActiveSession(h)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {history.length > historyPerPage && (
              <Pagination 
                totalItems={history.length} 
                itemsPerPage={historyPerPage} 
                currentPage={historyPage} 
                onPageChange={setHistoryPage} 
              />
            )}
          </div>
      )}
    </>
  )}
      {/* Player Answers Modal */}
      {viewingPlayer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[10000]" onClick={() => setViewingPlayer(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xl">
                  {viewingPlayer.name[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Player Performance</h2>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                    {viewingPlayer.name} • {activeSession?.bab?.replace(/_/g, ' ')}, {activeSession?.sub_bab?.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewingPlayer(null)} className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all">×</button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <div className="grid grid-cols-3 gap-6 mb-10 pb-10 border-b border-gray-100">
                <div className="text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Score</p>
                  <p className="text-2xl font-black text-indigo-600">{viewingPlayer.score} / {activeSession?.question_count}</p>
                </div>
                <div className="text-center border-x border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Time Spent</p>
                  <p className="text-2xl font-black text-gray-900">{viewingPlayer.total_time}s</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Status</p>
                  <p className={`text-sm font-black uppercase ${viewingPlayer.finished_at ? 'text-green-600' : 'text-orange-500 animate-pulse'}`}>
                    {viewingPlayer.finished_at ? 'FINISHED' : 'PLAYING'}
                  </p>
                </div>
              </div>

              {loadingAnswers ? (
                <div className="text-center py-20 text-gray-400 font-bold uppercase text-xs tracking-widest animate-pulse">Loading answers...</div>
              ) : (
                <div className="space-y-8">
                  {(() => {
                    const answeredIds = playerAnswers.map(a => a.question_id);
                    const allIds = activeSession?.question_ids || [];
                    const orderedIds = [
                      ...answeredIds,
                      ...allIds.filter(id => !answeredIds.includes(id))
                    ];

                    return orderedIds.map((qId, idx) => {
                      const question = sessionQuestions.find(q => q.id === qId);
                      const answer = playerAnswers.find(a => a.question_id === qId);

                      if (!question) return null;

                      const correctOptionText = (question as any)[`option_${question.correct_answer.toLowerCase()}`];
                      
                      return (
                        <div key={qId} className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                          <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-white/50">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Question {idx + 1}</span>
                            {answer ? (
                              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${answer.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {answer.is_correct ? 'Correct' : 'Incorrect'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-black uppercase px-3 py-1 rounded-full bg-gray-100 text-gray-400">Not Answered Yet</span>
                            )}
                          </div>
                          <div className="p-6 space-y-4">
                            <RichContent html={question.question_text} className="text-[16px] font-bold text-gray-900 leading-tight" />

                            {answer && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className={`p-4 rounded-xl border-2 ${answer.is_correct ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30'}`}>
                                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2">User Answer</p>
                                  <RichContent html={answer.user_answer} className={`text-sm font-medium ${answer.is_correct ? 'text-green-800' : 'text-red-800'}`} />
                                  <p className="text-[9px] text-gray-400 mt-2">Time taken: {answer.time_taken}s</p>
                                </div>

                                {!answer.is_correct && (
                                  <div className="p-4 rounded-xl border-2 border-green-100 bg-green-50/20">
                                    <p className="text-[10px] font-black text-green-600 uppercase mb-2">Correct Answer ({question.correct_answer})</p>
                                    <RichContent html={correctOptionText} className="text-sm font-medium text-green-800" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 border-t flex justify-end">
              <button onClick={() => setViewingPlayer(null)} className="px-10 h-12 rounded-full bg-nike-black text-white font-black uppercase text-[10px] tracking-widest hover:bg-nike-grey-500 transition-all shadow-lg shadow-nike-black/20">Close Breakdown</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pagination({ totalItems, itemsPerPage, currentPage, onPageChange }: { totalItems: number, itemsPerPage: number, currentPage: number, onPageChange: (page: number) => void }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  return (
    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="sr-only">Previous</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => onPageChange(i + 1)}
                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                  currentPage === i + 1
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="sr-only">Next</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
