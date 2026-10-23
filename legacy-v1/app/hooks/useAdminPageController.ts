"use client";

import { formatCategorySelectionLabel } from '@/lib/categories';
import { stripHtml } from '@/lib/rich-text';
import useAdminResultsController from '@/app/hooks/useAdminResultsController';
import useAdminAnalytics from '@/app/hooks/useAdminAnalytics';
import getAdminAccessToken from '@/app/hooks/getAdminAccessToken';
import useAdminQuestionDerived from '@/app/hooks/useAdminQuestionDerived';
import useAdminQuestions from '@/app/hooks/useAdminQuestions';
import useAdminSettings from '@/app/hooks/useAdminSettings';
import useAdminSettingsDerived from '@/app/hooks/useAdminSettingsDerived';
import useAdminAuth from '@/app/hooks/useAdminAuth';
import useAdminTabState from '@/app/hooks/useAdminTabState';
import useAdminCategories from '@/app/hooks/useAdminCategories';
import runAdminBootstrap from '@/app/hooks/runAdminBootstrap';
import useLiveSessionsPolling from '@/app/hooks/useLiveSessionsPolling';

const AUTH_VERSION = '4';

export default function useAdminPageController() {
  const results = useAdminResultsController();
  const analytics = useAdminAnalytics();

  const categories = useAdminCategories();

  const questions = useAdminQuestions({
    getAdminAccessToken,
    loadAllBabsAdmin: categories.loadAllBabsAdmin,
    loadAllSubBabsAdmin: categories.loadAllSubBabsAdmin,
    allMapels: categories.allMapels,
    setAllMapels: categories.setAllMapels,
    allbabs: categories.allbabs,
    setAllbabs: categories.setAllbabs,
    allSubBabsAdmin: categories.allSubBabsAdmin,
    setAllSubBabsAdmin: categories.setAllSubBabsAdmin,
  });

  const settings = useAdminSettings({
    getAdminAccessToken,
    fetchAdminQuestions: questions.fetchAdminQuestions,
    loadAllMapelsAdmin: categories.loadAllMapelsAdmin,
    loadAllBabsAdmin: categories.loadAllBabsAdmin,
    loadAllSubBabsAdmin: categories.loadAllSubBabsAdmin,
  });

  const auth = useAdminAuth({
    authVersion: AUTH_VERSION,
    onAuthenticated: async () => {
      await runAdminBootstrap({
        fetchAdminQuestions: questions.fetchAdminQuestions,
        loadAllMapelsAdmin: categories.loadAllMapelsAdmin,
        loadAllBabsAdmin: categories.loadAllBabsAdmin,
        loadAllSubBabsAdmin: categories.loadAllSubBabsAdmin,
        loadVisibilitySettings: settings.loadVisibilitySettings,
      });
    },
  });

  const tabs = useAdminTabState({
    isAuthenticated: auth.isAuthenticated,
    fetchResults: results.fetchResults,
    fetchAnalytics: () => analytics.fetchAnalytics(results.activeResMapel, results.activeResbab, results.activeResSubBab, results.activeModeFilter),
    fetchAdminQuestions: questions.fetchAdminQuestions,
    loadAllMapelsAdmin: categories.loadAllMapelsAdmin,
    loadAllBabsAdmin: categories.loadAllBabsAdmin,
    loadAllSubBabsAdmin: categories.loadAllSubBabsAdmin,
    loadVisibilitySettings: settings.loadVisibilitySettings,
  });

  useLiveSessionsPolling({
    isAuthenticated: auth.isAuthenticated,
    isLiveMode: results.isLiveMode,
    fetchLiveSessions: results.fetchLiveSessions,
  });

  const questionDerived = useAdminQuestionDerived({
    allMapels: categories.allMapels,
    allbabs: categories.allbabs,
    allSubBabsAdmin: categories.allSubBabsAdmin,
    hiddenMapels: settings.visibilitySettings.hidden_mapels,
    hiddenBabs: settings.visibilitySettings.hidden_babs,
    hiddenSubBabs: settings.visibilitySettings.hidden_sub_babs,
    adminQuestions: questions.adminQuestions,
    activeMapelFilter: questions.activeMapelFilter,
    activebabFilter: questions.activebabFilter,
    activeSubBabFilter: questions.activeSubBabFilter,
    activeResMapel: results.activeResMapel,
    activeResbab: results.activeResbab,
    questionTypeFilter: questions.questionTypeFilter,
    visibilityFilter: questions.visibilityFilter,
    searchQuery: questions.searchQuery,
    sortOrder: questions.sortOrder,
  });

  const settingsDerived = useAdminSettingsDerived({
    adminQuestions: questions.adminQuestions,
  });

  const shared = {
    formatCategorySelectionLabel,
    stripHtml,
  };

  return {
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
  };
}
