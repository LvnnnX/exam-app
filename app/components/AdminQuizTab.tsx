"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { createQuizSession, updateQuizStatus, fetchQuizPlayers, fetchQuizHistory, fetchActiveSessions, fetchPlayerAnswers, type KuisLog, type Player, type KuisStatus, type KuisResult } from '@/lib/quiz';
import { type CategoryInfo, fetchQuestionsByIds, type RawQuestion } from '@/lib/questions';
import RichContent from '@/app/components/RichContent';

export default function AdminQuizTab({ categories }: { categories: CategoryInfo[] }) {
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
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
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
    const session = await createQuizSession(selectedCategory, questionCount, durationMinutes);
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
        <div className="max-w-2xl mx-auto">
          {/* Header Card */}
          <div style={{background: 'linear-gradient(135deg, #2d2235 0%, #1e293b 50%, #1a2332 100%)'}} className="rounded-[20px] sm:rounded-[24px] p-5 sm:p-8 mb-4 sm:mb-6 border border-white/5 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div style={{background: 'linear-gradient(135deg, #7c5295, #5c6bc0)'}} className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md">
                <span className="text-2xl">🎯</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-100">Buat Kuis Baru</h3>
                <p className="text-sm text-gray-400">Konfigurasikan sesi kuis untuk peserta</p>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div style={{background: '#1e1e2e'}} className="rounded-[20px] sm:rounded-[24px] shadow-lg border border-white/5 overflow-hidden">
            {/* Category */}
            <div className="p-4 sm:p-6 pb-4 sm:pb-5">
              <div className="flex items-center gap-2 mb-3">
                <div style={{background: '#2a2a4a'}} className="w-7 h-7 rounded-lg flex items-center justify-center">
                  <span className="text-sm">📚</span>
                </div>
                <label className="text-sm font-semibold text-gray-300">Kategori Soal</label>
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{background: '#252538', borderColor: '#3d3d5c', color: '#c4b5fd'}}
                className="w-full border-2 rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400/50 transition-all appearance-none cursor-pointer"
              >
                <option value="All Categories">Semua Kategori</option>
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div style={{background: 'linear-gradient(to right, transparent, #3d3d5c, transparent)'}} className="h-px mx-6" />

            {/* Question Count */}
            <div className="p-4 sm:p-6 pb-4 sm:pb-5">
              <div className="flex items-center gap-2 mb-3">
                <div style={{background: '#2d2235'}} className="w-7 h-7 rounded-lg flex items-center justify-center">
                  <span className="text-sm">✏️</span>
                </div>
                <label className="text-sm font-semibold text-gray-300">Jumlah Soal</label>
              </div>
              <div className="flex gap-3">
                {[5, 10, 20].map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    style={questionCount === n
                      ? {background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', borderColor: 'transparent'}
                      : {background: '#252538', borderColor: '#4c3d6e', color: '#c4b5fd'}
                    }
                    className="flex-1 py-3 rounded-2xl text-sm font-bold border-2 transition-all duration-200 hover:shadow-md hover:shadow-purple-500/10"
                  >
                    {n} Soal
                  </button>
                ))}
              </div>
            </div>

            <div style={{background: 'linear-gradient(to right, transparent, #4c3d6e, transparent)'}} className="h-px mx-6" />

            {/* Duration */}
            <div className="p-4 sm:p-6 pb-4 sm:pb-5">
              <div className="flex items-center gap-2 mb-3">
                <div style={{background: '#1a2332'}} className="w-7 h-7 rounded-lg flex items-center justify-center">
                  <span className="text-sm">⏱️</span>
                </div>
                <label className="text-sm font-semibold text-gray-300">Durasi Waktu</label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[30, 60, 90, 120].map(m => (
                  <button
                    key={m}
                    onClick={() => setDurationMinutes(m)}
                    style={durationMinutes === m
                      ? {background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: 'white', borderColor: 'transparent'}
                      : {background: '#1a2332', borderColor: '#2a4a4a', color: '#5eead4'}
                    }
                    className="py-3 rounded-2xl text-sm font-bold border-2 transition-all duration-200 hover:shadow-md hover:shadow-teal-500/10"
                  >
                    {m} Min
                  </button>
                ))}
              </div>
            </div>

            <div style={{background: 'linear-gradient(to right, transparent, #2a4a4a, transparent)'}} className="h-px mx-6" />

            {/* Submit */}
            <div className="p-4 sm:p-6">
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{background: creating ? '#374151' : 'linear-gradient(135deg, #e879a0, #c0507a)'}}
                className="w-full py-4 rounded-2xl text-white font-bold text-base tracking-wide transition-all duration-300 hover:shadow-lg hover:shadow-pink-500/20 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100"
              >
                {creating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Membuat Kuis...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>🚀</span> Buat Sesi Kuis
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
              <p className="mt-2 text-sm text-gray-600 font-medium capitalize">Category: {activeSession.category?.replace(/_/g, ' ')} <span className="mx-2">•</span> {activeSession.question_count} Questions</p>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-700 font-mono">{s.quiz_code}</td>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{h.quiz_code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{h.category?.replace(/_/g, ' ')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{h.player_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-nike-black">{h.winner}</td>
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
                    {viewingPlayer.name} • {activeSession?.category}
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
