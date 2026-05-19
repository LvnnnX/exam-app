"use server";

import { type VisibilitySettings } from '@/lib/questions';
import { requirePermission } from '@/lib/admin-server';
import { isSafeCategorySlug, normalizeCategorySlug } from '@/lib/categories';

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normalizeCategorySlug(String(item)))
    .filter((item) => isSafeCategorySlug(item))
    .slice(0, 500);
}

export async function saveVisibilitySettingsAction(accessToken: string, settings: VisibilitySettings) {
  const { supabase } = await requirePermission(accessToken, 'settings:update');
  const payload: VisibilitySettings = {
    hidden_mapels: normalizeList(settings.hidden_mapels),
    admin_only_mapels: normalizeList(settings.admin_only_mapels),
    hidden_babs: normalizeList(settings.hidden_babs),
    admin_only_babs: normalizeList(settings.admin_only_babs),
    hidden_sub_babs: normalizeList(settings.hidden_sub_babs),
    admin_only_sub_babs: normalizeList(settings.admin_only_sub_babs),
  };

  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, ...payload }, { onConflict: 'id' });

  if (error) throw new Error(error.message);
}
