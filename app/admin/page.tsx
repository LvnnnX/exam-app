"use client";

import React, { useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AdminTabSwitcher from '@/app/components/AdminTabSwitcher';
import AdminLoginView from '@/app/components/AdminLoginView';
import AdminAuthLoadingView from '@/app/components/AdminAuthLoadingView';
import SettingsTabPanel from '@/app/components/admin/SettingsTabPanel';
import QuestionsTabPanel from '@/app/components/admin/QuestionsTabPanel';
import ResultsTabPanel from '@/app/components/admin/ResultsTabPanel';
import AdminPrimaryModals from '@/app/components/admin/AdminPrimaryModals';
import AdminUtilityModals from '@/app/components/admin/AdminUtilityModals';
import AdminQuizTabPanel from '@/app/components/admin/AdminQuizTabPanel';
import AccessTabPanel from '@/app/components/admin/AccessTabPanel';
import AnalyticsTabPanel from '@/app/components/admin/AnalyticsTabPanel';
import useAdminPageController from '@/app/hooks/useAdminPageController';
import getAdminAccessToken from '@/app/hooks/getAdminAccessToken';
import { createQuizSessionAction } from '@/app/actions/admin/quiz';
import { hasPermission } from '@/lib/admin-permissions';
import { getOptionText, getCorrectOptionText } from '@/app/hooks/adminOptionText';
import { useAdminTheme } from '@/app/hooks/useAdminTheme';
import { ToastContainer } from '@/app/components/Toast';


export default function AdminPage() {
  return (
    <Suspense fallback={<AdminAuthLoadingView theme="light" />}>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const {
    shared,
    auth,
    tabs,
    results,
    analytics,
    categories,
    questions,
    settings,
    questionDerived,
    settingsDerived,
  } = useAdminPageController();

  const { theme, toggleTheme } = useAdminTheme();

  const searchParams = useSearchParams();
  const router = useRouter();

  // Initialize from URL on mount only
  useEffect(() => {
    if (auth.isAuthenticated !== true) return;

    const urlTab = searchParams.get('tab');
    if (urlTab && ['questions', 'quiz', 'results', 'analytics', 'settings', 'access'].includes(urlTab)) {
      tabs.handleTabChange(urlTab as any);
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    if (auth.isAuthenticated !== true) return;

    const handlePopState = () => {
      const urlTab = new URL(window.location.href).searchParams.get('tab');
      if (urlTab && ['questions', 'quiz', 'results', 'analytics', 'settings', 'access'].includes(urlTab)) {
        tabs.handleTabChange(urlTab as any);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [auth.isAuthenticated, tabs]);

  // Wrapper for tab change that also updates URL
  const handleTabChangeWithUrl = useCallback((tab: string) => {
    tabs.handleTabChange(tab as any);

    // Update URL and remove code parameter (code is specific to Quiz tab sessions)
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('tab', tab);
    newUrl.searchParams.delete('code');
    window.history.replaceState({}, '', newUrl.toString());
  }, [tabs]);

  // Navigate to Quiz tab with code parameter
  const handleNavigateToQuizWithCode = useCallback((code: string) => {
    tabs.handleTabChange('quiz');

    // Update URL with both tab and code parameters
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('tab', 'quiz');
    newUrl.searchParams.set('code', code);
    window.history.replaceState({}, '', newUrl.toString());
  }, [tabs]);

  useEffect(() => {
    const isModalOpen = Boolean(questions.selectedQuestion || questions.isAdding || questions.isEditing);
    if (isModalOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [questions.selectedQuestion, questions.isAdding, questions.isEditing]);

  if (auth.isAuthenticated === null) {
    return <AdminAuthLoadingView theme={theme} />;
  }

  const adminProfile = auth.adminProfile;
  const canAccessManage = Boolean(adminProfile && hasPermission(adminProfile, 'access:manage'));
  const canCreateQuestion = Boolean(adminProfile && hasPermission(adminProfile, 'question:create'));
  const canUpdateAnyQuestion = Boolean(adminProfile && hasPermission(adminProfile, 'question:update:any'));
  const canUpdateOwnQuestion = Boolean(adminProfile && hasPermission(adminProfile, 'question:update:own'));
  const canDeleteAnyQuestion = Boolean(adminProfile && hasPermission(adminProfile, 'question:delete:any'));
  const canDeleteOwnQuestion = Boolean(adminProfile && hasPermission(adminProfile, 'question:delete:own'));
  const canDeleteTopic = Boolean(adminProfile && hasPermission(adminProfile, 'topic:delete'));
  const canSaveSettings = Boolean(adminProfile && hasPermission(adminProfile, 'settings:update'));
  const canEditQuestion = (question: { created_by?: string | null }) => {
    const ownsQuestion = Boolean(adminProfile?.userId && question.created_by === adminProfile.userId);
    return canUpdateAnyQuestion || (ownsQuestion && canUpdateOwnQuestion);
  };

  if (auth.isAuthenticated === false) {
    return (
      <AdminLoginView
        email={auth.email}
        password={auth.password}
        authError={auth.authError}
        authLoading={auth.authLoading}
        onEmailChange={auth.setEmail}
        onPasswordChange={auth.setPassword}
        onSubmit={auth.handleLogin}
      />
    );
  }

  return (
    <div data-admin-page className={`relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-full w-screen overflow-hidden md:flex ${theme === 'dark' ? 'bg-dark-900 text-dark-text-primary' : 'bg-white text-[#111111]'}`}>
      <AdminTabSwitcher
        activeTab={tabs.activeTab}
        onTabChange={handleTabChangeWithUrl}
        onLogout={auth.handleLogout}
        adminEmail={auth.adminEmail}
        adminRole={adminProfile?.role}
        canAccessManage={canAccessManage}
        canViewSettings={canSaveSettings || canDeleteTopic}
        theme={theme}
        onToggleTheme={toggleTheme}
        onAddQuestion={canCreateQuestion ? () => {
          handleTabChangeWithUrl('questions');
          questions.startAddNew();
        } : undefined}
        onCreateQuiz={() => {
          handleTabChangeWithUrl('quiz');
        }}
      />

      <main className="h-full min-w-0 flex-1 overflow-hidden px-2 pt-14 pb-3 md:ml-[228px] md:px-4 md:py-4 md:pt-4">
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden pr-1">
            {tabs.activeTab === 'questions' && (
              <div className="h-full min-h-0">
                <QuestionsTabPanel
                filteredQuestions={questionDerived.filteredQuestions}
                questionLoading={questions.questionLoading}
                mapelTabs={questionDerived.mapelTabs}
                babTabs={questionDerived.babTabs}
                subBabTabs={questionDerived.subBabTabs}
                activeMapelFilter={questions.activeMapelFilter}
                activebabFilter={questions.activebabFilter}
                activeSubBabFilter={questions.activeSubBabFilter}
                questionTypeFilter={questions.questionTypeFilter}
                visibilityFilter={questions.visibilityFilter}
                searchQuery={questions.searchQuery}
                sortOrder={questions.sortOrder}
                selectedQuestionIds={questions.selectedQuestionIds}
                batchProcessing={questions.batchProcessing}
                formatCategorySelectionLabel={shared.formatCategorySelectionLabel}
                paginationMeta={questions.paginationMeta}
                mapelCounts={questions.mapelCounts}
                fetchQuestionsPaginated={questions.fetchQuestionsPaginated}
                fetchMapelCounts={questions.fetchMapelCounts}
                theme={theme}
                onStartAddNew={questions.startAddNew}
                showToast={questions.showToast}
                canCreateQuestion={canCreateQuestion}
                canUpdateAnyQuestion={canUpdateAnyQuestion}
                canUpdateOwnQuestion={canUpdateOwnQuestion}
                canDeleteAnyQuestion={canDeleteAnyQuestion}
                canDeleteOwnQuestion={canDeleteOwnQuestion}
                currentAdminUserId={adminProfile?.userId}
                currentAdminUsername={adminProfile?.username}
                onRefreshQuestions={() => void questions.fetchAdminQuestions()}
                onMapelFilterChange={questions.handleMapelFilterChange}
                onBabFilterChange={questions.handleBabFilterChange}
                onSubBabFilterChange={(vals) => {
                  questions.setActiveSubBabFilter(vals);
                  void questions.fetchAdminQuestions();
                }}
                onQuestionTypeFilterChange={questions.setQuestionTypeFilter}
                onVisibilityFilterChange={questions.setVisibilityFilter}
                onSearchQueryChange={questions.setSearchQuery}
                onToggleSortOrder={() => questions.setSortOrder(questions.sortOrder === 'desc' ? 'asc' : 'desc')}
                onToggleSelectAll={(questionIds) => {
                  const selectedAccessibleCount = questions.selectedQuestionIds.filter((id) => questionIds.includes(id)).length;
                  if (selectedAccessibleCount === questionIds.length && questionIds.length > 0) {
                    questions.setSelectedQuestionIds(questions.selectedQuestionIds.filter((id) => !questionIds.includes(id)));
                  } else {
                    questions.setSelectedQuestionIds(Array.from(new Set([...questions.selectedQuestionIds, ...questionIds])));
                  }
                }}
                onToggleQuestionSelect={(questionId, checked) => {
                  if (checked) {
                    questions.setSelectedQuestionIds([...questions.selectedQuestionIds, questionId]);
                  } else {
                    questions.setSelectedQuestionIds(questions.selectedQuestionIds.filter(id => id !== questionId));
                  }
                }}
                onOpenBatchHideConfirm={() => {
                  const editableIds = questionDerived.filteredQuestions.filter(canEditQuestion).map((question) => question.id);
                  questions.setSelectedQuestionIds(questions.selectedQuestionIds.filter((id) => editableIds.includes(id)));
                  questions.setBatchVisibilityTarget(true);
                  questions.setBatchVisibilityModalOpen(true);
                }}
                onOpenBatchVisibleConfirm={() => {
                  const editableIds = questionDerived.filteredQuestions.filter(canEditQuestion).map((question) => question.id);
                  questions.setSelectedQuestionIds(questions.selectedQuestionIds.filter((id) => editableIds.includes(id)));
                  questions.setBatchVisibilityTarget(false);
                  questions.setBatchVisibilityModalOpen(true);
                }}
                onViewQuestion={questions.onViewQuestion}
                onEditQuestion={questions.startEdit}
                onDeleteQuestion={questions.setDeletingQuestion}
                onToggleQuestionVisibility={questions.onToggleQuestionVisibility}
              />
              </div>
            )}

            {tabs.activeTab === 'results' && (
              <div className="h-full min-h-0">
              <ResultsTabPanel
                isLiveMode={results.isLiveMode}
                loading={results.loading}
                liveLoading={results.liveLoading}
                resMapelTabs={questionDerived.mapelTabs}
                resBabTabs={questionDerived.resBabTabs}
                resSubBabTabs={questionDerived.resSubBabTabs}
                activeResMapel={results.activeResMapel}
                activeResbab={results.activeResbab}
                activeResSubBab={results.activeResSubBab}
                activeModeFilter={results.activeModeFilter}
                statsData={results.statsData}
                results={results.results}
                liveSessions={results.liveSessions}
                totalResults={results.totalResults}
                itemsPerPage={results.itemsPerPage}
                resultPage={results.resultPage}
                paginationMeta={results.paginationMeta}
                liveSessionPage={results.liveSessionPage}
                liveSessionItemsPerPage={results.liveSessionItemsPerPage}
                liveSessionPaginationMeta={results.liveSessionPaginationMeta}
                formatCategorySelectionLabel={shared.formatCategorySelectionLabel}
                theme={theme}
                onRefresh={() => { void (results.isLiveMode ? results.fetchLiveSessions() : results.fetchResults(1)); }}
                onEnableLiveMode={() => {
                  results.setIsLiveMode(true);
                  void results.fetchLiveSessions();
                }}
                onEnableHistoryMode={() => results.setIsLiveMode(false)}
                onResMapelChange={results.handleResMapelChange}
                onResbabChange={results.handleResbabChange}
                onResSubBabChange={results.handleResSubBabChange}
                onModeFilterChange={results.handleModeFilterChange}
                onTrackLiveProgress={results.handleFetchLiveDetail}
                onViewDetails={results.handleFetchResultDetail}
                onPageChange={(page) => {
                  void results.fetchResults(page);
                }}
                onItemsPerPageChange={results.handleItemsPerPageChange}
                onLiveSessionPageChange={results.handleLiveSessionPageChange}
                onLiveSessionItemsPerPageChange={results.handleLiveSessionItemsPerPageChange}
              />
              </div>
            )}

            {tabs.activeTab === 'analytics' && (
              <div className="h-full min-h-0">
                <AnalyticsTabPanel
                  analyticsData={analytics.analyticsData}
                  analyticsLoading={analytics.analyticsLoading}
                  analyticsError={analytics.analyticsError}
                  analyticsSource={analytics.analyticsSource}
                  dateRange={analytics.dateRange}
                  activeParticipantKey={analytics.activeParticipantKey}
                  activeQuizSessionKeys={analytics.activeQuizSessionKeys}
                  formatCategorySelectionLabel={shared.formatCategorySelectionLabel}
                  theme={theme}
                  onRefresh={() => void analytics.fetchAnalytics(results.activeResMapel, results.activeResbab, results.activeResSubBab, results.activeModeFilter)}
                  onSourceChange={(source) => analytics.changeAnalyticsSource(source, results.activeResMapel, results.activeResbab, results.activeResSubBab, results.activeModeFilter)}
                  onDateRangeChange={(range) => analytics.changeDateRange(range, results.activeResMapel, results.activeResbab, results.activeResSubBab, results.activeModeFilter)}
                  onParticipantChange={(participantKey) => analytics.changeParticipant(participantKey, results.activeResMapel, results.activeResbab, results.activeResSubBab, results.activeModeFilter)}
                  onQuizSessionsChange={(sessionKeys) => analytics.changeQuizSessions(sessionKeys, results.activeResMapel, results.activeResbab, results.activeResSubBab, results.activeModeFilter)}
                  onNavigateToQuiz={handleNavigateToQuizWithCode}
                  onCreateRemedialQuiz={async (questionIds) => {
                    const token = await getAdminAccessToken();
                    const session = await createQuizSessionAction(token, {
                      mapel: results.activeResMapel.length > 0 ? results.activeResMapel : 'Semua MAPEL',
                      bab: results.activeResbab.length > 0 ? results.activeResbab : 'Semua BAB',
                      subBabs: results.activeResSubBab,
                      questionCount: questionIds.length,
                      durationMinutes: 30,
                      quizMode: 'standard',
                      allowJoinMidGame: true,
                      selectedQuestionIds: questionIds,
                    });
                    if (!session) throw new Error('Failed to create remedial quiz.');
                    return { quiz_code: session.quiz_code, question_count: questionIds.length };
                  }}
                />
              </div>
            )}

            {tabs.activeTab === 'settings' && (canSaveSettings || canDeleteTopic) && (
              <div className="h-full overflow-y-auto pr-1">
              <SettingsTabPanel
                settingsLoading={settings.settingsLoading}
                allMapels={categories.allMapels}
                allBabs={categories.allbabs}
                allSubBabsAdmin={categories.allSubBabsAdmin}
                expandedBabs={settings.expandedBabs}
                visibilitySettings={settings.visibilitySettings}
                deletingTopic={settings.deletingTopic}
                mapelBabSubBabMap={settingsDerived.mapelBabSubBabMap}
                settingsDirty={settings.settingsDirty}
                settingsSaving={settings.settingsSaving}
                theme={theme}
                onToggleExpanded={settings.toggleExpandedBab}
                onVisibilityChange={settings.handleVisibilityChange}
                canDeleteTopic={canDeleteTopic}
                canSaveSettings={canSaveSettings}
                onDeleteTopic={settings.handleDeleteTopic}
                onSaveSettings={settings.handleSaveSettings}
              />
              </div>
            )}

            {tabs.activeTab === 'quiz' && (
              <div className="h-full min-h-0">
              <AdminQuizTabPanel
                allMapels={categories.allMapels}
                allBabs={categories.allbabs}
                allSubBabsAdmin={categories.allSubBabsAdmin}
                visibilitySettings={settings.visibilitySettings}
                theme={theme}
              />
              </div>
            )}

            {tabs.activeTab === 'access' && canAccessManage && (
              <div className="h-full min-h-0">
                <AccessTabPanel theme={theme} />
              </div>
            )}
          </div>

          <AdminUtilityModals
            deleteTopicError={settings.deleteTopicError}
            batchVisibilityModalOpen={questions.batchVisibilityModalOpen}
            batchVisibilityTarget={questions.batchVisibilityTarget}
            selectedQuestionCount={questions.selectedQuestionIds.length}
            batchProcessing={questions.batchProcessing}
            deletingQuestion={questions.deletingQuestion}
            deletingQuestionPreview={questions.deletingQuestion ? shared.stripHtml(questions.deletingQuestion.question_text).slice(0, 80) : ''}
            onCloseDeleteTopicError={settings.closeDeleteTopicError}
            onCancelBatchVisibility={() => questions.setBatchVisibilityModalOpen(false)}
            onConfirmBatchVisibility={() => void questions.handleBatchVisibilityToggle(questions.batchVisibilityTarget)}
            onCancelDeleteQuestion={() => questions.setDeletingQuestion(null)}
            onConfirmDeleteQuestion={questions.confirmDelete}
            theme={theme}
          />

          <AdminPrimaryModals
            selectedQuestion={questions.selectedQuestion}
            isAdding={questions.isAdding}
            isEditing={questions.isEditing}
            savingQuestion={questions.savingQuestion}
            formData={questions.formData}
            filteredMapelsForForm={questionDerived.filteredMapelsForForm}
            filteredBabsForForm={questionDerived.filteredBabsForForm}
            filteredSubBabsForForm={questionDerived.filteredSubBabsForForm}
            newMapelInput={questions.newMapelInput}
            newbabInput={questions.newbabInput}
            newSubBabInput={questions.newSubBabInput}
            addingCategory={questions.addingCategory}
            trackingSession={results.trackingSession}
            currentTrackedQuestion={results.currentTrackedQuestion}
            isTrackingModalOpen={results.isTrackingModalOpen}
            viewingResult={results.viewingResult}
            detailLoading={results.detailLoading}
            detailQuestions={results.detailQuestions}
            onCloseQuestionModal={questions.closeModal}
            onSaveQuestion={() => void questions.handleSave()}
            handleInputChange={questions.handleInputChange}
            setNewMapelInput={questions.setNewMapelInput}
            setNewbabInput={questions.setNewbabInput}
            setNewSubBabInput={questions.setNewSubBabInput}
            onAddNewMapel={() => void questions.handleAddNewMapel()}
            onAddNewbab={() => void questions.handleAddNewbab()}
            onAddNewSubBab={() => void questions.handleAddNewSubBab()}
            getOptionText={getOptionText}
            getCorrectOptionText={getCorrectOptionText}
            onCloseTrackingModal={() => results.setIsTrackingModalOpen(false)}
            onCloseResultDetailsModal={() => results.setViewingResult(null)}
            theme={theme}
          />

          <ToastContainer toasts={questions.toasts} onDismiss={questions.dismissToast} theme={theme} />
          <ToastContainer toasts={settings.toasts} onDismiss={settings.dismissToast} theme={theme} />
        </div>
      </main>
    </div>
  );
}

