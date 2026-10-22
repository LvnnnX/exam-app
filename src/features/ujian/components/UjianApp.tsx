'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { getUjianStateAction } from '../actions';
import { scorePercent } from '../logic';
import type { FinishResult, TopicLabels, UjianState } from '../types';
import { clearToken, loadLastSetup, loadToken, type LastSetup, type SessionToken } from '../client-storage';
import ConfirmStep from './ConfirmStep';
import ExamRuntime from './ExamRuntime';
import RecapList from './RecapList';
import ResultView from './ResultView';
import SetupForm from './SetupForm';
import SurvivalRuntime from './SurvivalRuntime';
import { LoadingBlock } from './ui';

type Step = 'restoring' | 'setup' | 'confirm' | 'running' | 'result' | 'recap';

// false on the server and during hydration, true after: the initial step comes from localStorage,
// so render the neutral loading block until hydrated to keep SSR and client HTML identical.
const noopSubscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

export default function UjianApp() {
  const [token, setToken] = useState<SessionToken | null>(() => (typeof window === 'undefined' ? null : loadToken()));
  const [step, setStep] = useState<Step>(() => {
    if (typeof window === 'undefined') return 'restoring';
    return loadToken() ? 'restoring' : 'setup';
  });
  const [lastSetup, setLastSetup] = useState<LastSetup | null>(() => (typeof window === 'undefined' ? null : loadLastSetup()));
  const [draftSetup, setDraftSetup] = useState<{ setup: LastSetup; labels: TopicLabels } | null>(null);
  const [cachedState, setCachedState] = useState<UjianState | null>(null);
  const hydrated = useHydrated();

  // Restore session saat mount (UM-16)
  useEffect(() => {
    if (!token) return;

    let alive = true;
    void (async () => {
      const res = await getUjianStateAction(token.sessionId, token.secret);
      if (!alive) return;
      if (!res.success) {
        clearToken();
        setToken(null);
        setStep('setup');
        return;
      }
      setCachedState(res.data);
      if (res.data.status === 'active') {
        setStep('running');
      } else {
        setStep('result');
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  const handleFinishFromRuntime = async () => {
    if (!token) return;
    const res = await getUjianStateAction(token.sessionId, token.secret);
    if (res.success) setCachedState(res.data);
    setStep('result');
  };

  const handleStartFromConfirm = (t: SessionToken) => {
    setToken(t);
    setCachedState(null);
    setStep('running');
  };

  const handleRetry = () => {
    setToken(null);
    setCachedState(null);
    setDraftSetup(null);
    setLastSetup(loadLastSetup());
    setStep('setup');
  };

  // Buat payload summary untuk ResultView dari cachedState
  const resultSummary = cachedState
    ? {
        name: cachedState.name,
        mode: cachedState.mode,
        topics: cachedState.topics,
        status: cachedState.status,
        end_reason: cachedState.end_reason,
        score: cachedState.score ?? 0,
        total: cachedState.total,
        answered: cachedState.answers?.filter((a) => a.answered).length ?? cachedState.score ?? 0,
        percent: cachedState.total > 0 ? scorePercent(cachedState.score ?? 0, cachedState.total) : null,
      }
    : null;

  return (
    <div data-theme="light" className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
      <header className="glass flex items-center justify-between rounded-3xl p-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-fg">
          <span className="clay-primary inline-flex h-9 w-9 items-center justify-center rounded-xl text-white">
            <Sparkles size={16} />
          </span>
          <span>ExamApp v2</span>
        </Link>
        <span className="well rounded-full px-3 py-1 text-[12px] font-semibold text-fg-muted">
          Ujian mandiri
        </span>
      </header>

      {(!hydrated || step === 'restoring') && <LoadingBlock label="Memulihkan sesi..." />}

      {hydrated && (
      <>

      {step === 'setup' && (
        <div className="glass rounded-4xl p-6 sm:p-8">
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="text-[24px] font-bold text-fg">Ujian mandiri</h1>
            <p className="text-[14px] text-fg-muted">
              Pilih mode pengerjaan, tentukan materi yang ingin kamu uji, dan mulai berlatih.
            </p>
          </div>
          <SetupForm
            initial={lastSetup}
            onNext={(s, l) => {
              setDraftSetup({ setup: s, labels: l });
              setStep('confirm');
            }}
          />
        </div>
      )}

      {step === 'confirm' && draftSetup && (
        <div className="glass rounded-4xl p-6 sm:p-8">
          <ConfirmStep
            setup={draftSetup.setup}
            labels={draftSetup.labels}
            onEdit={() => setStep('setup')}
            onStarted={handleStartFromConfirm}
          />
        </div>
      )}

      {step === 'running' && token && (
        cachedState?.mode === 'survival' ? (
          <SurvivalRuntime
            sessionId={token.sessionId}
            secret={token.secret}
            initialState={cachedState}
            onFinished={handleFinishFromRuntime}
          />
        ) : (
          <ExamRuntime
            sessionId={token.sessionId}
            secret={token.secret}
            initialState={cachedState}
            onFinished={handleFinishFromRuntime}
          />
        )
      )}

      {step === 'result' && resultSummary && (
        <ResultView
          summary={resultSummary as FinishResult & { name: string; mode: typeof cachedState extends null ? never : NonNullable<typeof cachedState>['mode']; topics: TopicLabels }}
          lastSetup={lastSetup}
          onShowRecap={() => setStep('recap')}
          onRetry={handleRetry}
        />
      )}

      {step === 'recap' && token && (
        <RecapList
          sessionId={token.sessionId}
          secret={token.secret}
          onBack={() => setStep('result')}
        />
      )}
      </>
      )}
    </div>
  );
}
