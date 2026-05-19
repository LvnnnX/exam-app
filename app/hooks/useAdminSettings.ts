"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { type VisibilitySettings, fetchVisibilitySettings } from '@/lib/questions';
import { categorySlugToLabel, normalizeCategorySlug } from '@/lib/categories';
import { supabase } from '@/lib/supabase';
import { removeQuestionCategoryAction } from '@/app/actions/admin/questions';
import { saveVisibilitySettingsAction } from '@/app/actions/admin/settings';
import { type ToastMessage } from '@/app/components/Toast';

type UseAdminSettingsArgs = {
  getAdminAccessToken: () => Promise<string>;
  fetchAdminQuestions: () => Promise<void>;
  loadAllMapelsAdmin: () => Promise<void>;
  loadAllBabsAdmin: () => Promise<void>;
  loadAllSubBabsAdmin: () => Promise<void>;
};

const DEFAULT_VISIBILITY_SETTINGS: VisibilitySettings = {
  hidden_mapels: [],
  admin_only_mapels: [],
  hidden_babs: [],
  admin_only_babs: [],
  hidden_sub_babs: [],
  admin_only_sub_babs: [],
};

export default function useAdminSettings({
  getAdminAccessToken,
  fetchAdminQuestions,
  loadAllMapelsAdmin,
  loadAllBabsAdmin,
  loadAllSubBabsAdmin,
}: UseAdminSettingsArgs) {
  const [visibilitySettings, setVisibilitySettings] = useState<VisibilitySettings>(DEFAULT_VISIBILITY_SETTINGS);
  const [expandedBabs, setExpandedBabs] = useState<string[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [deleteTopicError, setDeleteTopicError] = useState<{ message: string; questionIds: number[] } | null>(null);
  const [deletingTopic, setDeletingTopic] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const loadVisibilitySettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const vs = await fetchVisibilitySettings();
      setVisibilitySettings(vs);
      setSettingsDirty(false);
    } catch (err) {
      console.error('Failed to load visibility settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await saveVisibilitySettingsAction(await getAdminAccessToken(), visibilitySettings);
      setSettingsDirty(false);
      showToast('Settings saved. Changes appear on next page load.', 'success');
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDeleteTopic = async (type: 'mapels' | 'babs' | 'sub_babs', slug: string) => {
    const normalizedSlug = normalizeCategorySlug(slug);
    const typeLabel = type === 'mapels' ? 'Mapel' : type === 'babs' ? 'Bab' : 'Sub-bab';

    if (!window.confirm(`Apakah Anda yakin ingin menghapus ${typeLabel} "${categorySlugToLabel(normalizedSlug) || normalizedSlug}" dari semua soal?`)) {
      return;
    }

    setDeletingTopic(true);
    try {
      const { data: questions, error } = await supabase
        .from('questions')
        .select('id, mapels, babs, sub_babs')
        .contains(type, [normalizedSlug]);

      if (error) throw error;
      if (!questions || questions.length === 0) {
        window.alert(`Tidak ada soal yang menggunakan ${typeLabel} "${categorySlugToLabel(normalizedSlug) || normalizedSlug}".`);
        setDeletingTopic(false);
        return;
      }

      const orphanedIds: number[] = [];
      for (const q of questions) {
        const arr = (q[type] as string[]) || [];
        if (arr.length <= 1) {
          orphanedIds.push(q.id);
        }
      }

      if (orphanedIds.length > 0) {
        setDeleteTopicError({
          message: `Tidak dapat menghapus ${typeLabel} "${categorySlugToLabel(normalizedSlug) || normalizedSlug}" karena ${orphanedIds.length} soal hanya memiliki ${typeLabel} ini. Hapus atau edit soal tersebut terlebih dahulu.`,
          questionIds: orphanedIds,
        });
        setDeletingTopic(false);
        return;
      }

      for (const q of questions) {
        const currentArr = (q[type] as string[]) || [];
        const updatedArr = currentArr.filter(s => normalizeCategorySlug(s) !== normalizedSlug);
        await removeQuestionCategoryAction(await getAdminAccessToken(), q.id, type, updatedArr);
      }

      await fetchAdminQuestions();
      await loadAllMapelsAdmin();
      await loadAllBabsAdmin();
      await loadAllSubBabsAdmin();

      window.alert(`${typeLabel} "${categorySlugToLabel(normalizedSlug) || normalizedSlug}" berhasil dihapus dari ${questions.length} soal.`);
    } catch (err) {
      console.error('Failed to delete topic:', err);
      window.alert('Gagal menghapus topik. Silakan coba lagi.');
    } finally {
      setDeletingTopic(false);
    }
  };

  const handleVisibilityChange = (type: 'mapels' | 'babs' | 'sub_babs', slug: string, state: 'visible' | 'admin_only' | 'hidden') => {
    setVisibilitySettings(prev => {
      const next = { ...prev };
      const normalized = normalizeCategorySlug(slug);

      if (type === 'mapels') {
        next.hidden_mapels = next.hidden_mapels.filter(s => s !== normalized);
        next.admin_only_mapels = next.admin_only_mapels.filter(s => s !== normalized);
        if (state === 'hidden') next.hidden_mapels.push(normalized);
        else if (state === 'admin_only') next.admin_only_mapels.push(normalized);
      } else if (type === 'babs') {
        next.hidden_babs = next.hidden_babs.filter(s => s !== normalized);
        next.admin_only_babs = next.admin_only_babs.filter(s => s !== normalized);
        if (state === 'hidden') next.hidden_babs.push(normalized);
        else if (state === 'admin_only') next.admin_only_babs.push(normalized);
      } else {
        next.hidden_sub_babs = next.hidden_sub_babs.filter(s => s !== normalized);
        next.admin_only_sub_babs = next.admin_only_sub_babs.filter(s => s !== normalized);
        if (state === 'hidden') next.hidden_sub_babs.push(normalized);
        else if (state === 'admin_only') next.admin_only_sub_babs.push(normalized);
      }

      setSettingsDirty(true);
      return next;
    });
  };

  const toggleExpandedBab = (slug: string) => {
    setExpandedBabs(prev => prev.includes(slug) ? prev.filter(b => b !== slug) : [...prev, slug]);
  };

  const closeDeleteTopicError = () => {
    setDeleteTopicError(null);
  };

  return {
    visibilitySettings,
    expandedBabs,
    settingsLoading,
    settingsSaving,
    settingsDirty,
    deleteTopicError,
    deletingTopic,
    toasts,
    setExpandedBabs: setExpandedBabs as Dispatch<SetStateAction<string[]>>,
    setDeleteTopicError,
    loadVisibilitySettings,
    handleSaveSettings,
    handleDeleteTopic,
    handleVisibilityChange,
    toggleExpandedBab,
    closeDeleteTopicError,
    dismissToast,
  };
}
