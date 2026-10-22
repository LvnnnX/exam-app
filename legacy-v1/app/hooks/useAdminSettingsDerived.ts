"use client";

import { useMemo } from 'react';
import { type RawQuestion } from '@/lib/questions';
import { normalizeCategorySlug } from '@/lib/categories';

type UseAdminSettingsDerivedArgs = {
  adminQuestions: RawQuestion[];
};

export default function useAdminSettingsDerived({
  adminQuestions,
}: UseAdminSettingsDerivedArgs) {
  const mapelBabSubBabMap = useMemo(() => {
    const map = new Map<string, Map<string, Set<string>>>();

    adminQuestions.forEach(q => {
      const qMapels = q.mapels || [];
      const qBabs = q.babs || [];
      const qSubBabs = q.sub_babs || [];

      qMapels.forEach(mapel => {
        const mapelSlug = normalizeCategorySlug(mapel);
        if (!mapelSlug) return;
        if (!map.has(mapelSlug)) map.set(mapelSlug, new Map());
        const babMap = map.get(mapelSlug)!;

        qBabs.forEach(bab => {
          const babSlug = normalizeCategorySlug(bab);
          if (!babSlug) return;
          if (!babMap.has(babSlug)) babMap.set(babSlug, new Set());
          qSubBabs.forEach(subBab => {
            const subBabSlug = normalizeCategorySlug(subBab);
            if (subBabSlug) babMap.get(babSlug)!.add(subBabSlug);
          });
        });
      });
    });

    return map;
  }, [adminQuestions]);

  return {
    mapelBabSubBabMap,
  };
}
