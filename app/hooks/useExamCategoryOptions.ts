"use client";

import { useEffect } from 'react';
import { getSafeBabs, getSafeSubBabsForMultiple } from '@/app/actions/categories';
import { type BabInfo, type SubBabInfo } from '@/lib/questions';

type UseExamCategoryOptionsArgs = {
  mapels: string[];
  babs: string[];
  setAvailableBabs: (value: BabInfo[]) => void;
  setBabs: (value: ((prev: string[]) => string[]) | string[]) => void;
  setAvailableSubBabs: (value: SubBabInfo[]) => void;
  setSubBabs: (value: ((prev: string[]) => string[]) | string[]) => void;
};

export default function useExamCategoryOptions({
  mapels,
  babs,
  setAvailableBabs,
  setBabs,
  setAvailableSubBabs,
  setSubBabs,
}: UseExamCategoryOptionsArgs) {
  useEffect(() => {
    const loadBabs = async () => {
      try {
        if (mapels.length === 0) {
          setAvailableBabs([]);
          setBabs([]);
          return;
        }

        const promises = mapels.map(m => getSafeBabs(m));
        const results = await Promise.all(promises);
        const merged = results.flat();
        const seen = new Set();
        const unique = merged.filter(b => {
          if (seen.has(b.value)) return false;
          seen.add(b.value);
          return true;
        });

        setAvailableBabs(unique);
        setBabs(prev => prev.filter(v => unique.some(u => u.value === v)));
      } catch (err) {
        console.error(err);
      }
    };
    void loadBabs();
  }, [mapels, setAvailableBabs, setBabs]);

  useEffect(() => {
    const loadSubBabs = async () => {
      try {
        if (babs.length === 0) {
          setAvailableSubBabs([]);
          setSubBabs([]);
          return;
        }
        const data = await getSafeSubBabsForMultiple(babs);
        setAvailableSubBabs(data);
        setSubBabs(prev => prev.filter(v => data.some((u: SubBabInfo) => u.value === v)));
      } catch (err) {
        console.error(err);
      }
    };
    void loadSubBabs();
  }, [babs, setAvailableSubBabs, setSubBabs]);
}
