"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

type AdminTab = 'questions' | 'results' | 'analytics' | 'settings' | 'quiz' | 'access';
const ADMIN_TABS: AdminTab[] = ['questions', 'results', 'analytics', 'settings', 'quiz', 'access'];

function isAdminTab(value: string): value is AdminTab {
  return ADMIN_TABS.includes(value as AdminTab);
}

type UseAdminTabStateArgs = {
  isAuthenticated: boolean | null;
  fetchResults: (page?: number, mapels?: string[], babs?: string[], subBabs?: string[], mode?: string) => Promise<void>;
  fetchAnalytics: () => Promise<void>;
  fetchAdminQuestions: () => Promise<void>;
  loadAllMapelsAdmin: () => Promise<void>;
  loadAllBabsAdmin: () => Promise<void>;
  loadAllSubBabsAdmin: () => Promise<void>;
  loadVisibilitySettings: () => Promise<void>;
};

export default function useAdminTabState({
  isAuthenticated,
  fetchResults,
  fetchAnalytics,
  fetchAdminQuestions,
  loadAllMapelsAdmin,
  loadAllBabsAdmin,
  loadAllSubBabsAdmin,
  loadVisibilitySettings,
}: UseAdminTabStateArgs) {
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_active_tab');
      if (saved && isAdminTab(saved)) return saved;
    }
    return 'questions';
  });

  const fetchRefs = useRef({
    fetchResults,
    fetchAnalytics,
    fetchAdminQuestions,
    loadAllMapelsAdmin,
    loadAllBabsAdmin,
    loadAllSubBabsAdmin,
    loadVisibilitySettings,
  });

  useEffect(() => {
    fetchRefs.current = {
      fetchResults,
      fetchAnalytics,
      fetchAdminQuestions,
      loadAllMapelsAdmin,
      loadAllBabsAdmin,
      loadAllSubBabsAdmin,
      loadVisibilitySettings,
    };
  }, [fetchResults, fetchAnalytics, fetchAdminQuestions, loadAllMapelsAdmin, loadAllBabsAdmin, loadAllSubBabsAdmin, loadVisibilitySettings]);

  const syncTabData = useCallback(async (tab: AdminTab) => {
    const fns = fetchRefs.current;

    if (tab === 'results') {
      await fns.fetchResults();
      await fns.loadVisibilitySettings();
      return;
    }

    if (tab === 'analytics') {
      await fns.fetchAnalytics();
      return;
    }

    if (tab === 'settings') {
      await fns.loadAllBabsAdmin();
      await fns.loadAllSubBabsAdmin();
      await fns.loadVisibilitySettings();
      return;
    }

    if (tab === 'quiz') {
      await fns.loadAllMapelsAdmin();
      await fns.loadAllBabsAdmin();
      await fns.loadAllSubBabsAdmin();
      await fns.loadVisibilitySettings();
      return;
    }

    await fns.fetchAdminQuestions();
  }, []);

  useEffect(() => {
    localStorage.setItem('admin_active_tab', activeTab);

    if (isAuthenticated !== true) {
      return;
    }

    void syncTabData(activeTab);
  }, [activeTab, isAuthenticated, syncTabData]);

  const handleTabChange = useCallback((tab: AdminTab) => {
    setActiveTab(tab);
  }, []);

  return {
    activeTab,
    handleTabChange,
  };
}
