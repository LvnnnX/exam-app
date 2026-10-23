"use client";

import { useCallback, useState } from 'react';
import {
  type BabInfo,
  type SubBabInfo,
  fetchAllMapelsAdmin,
  fetchAllBabsAdmin,
  fetchAllSubBabsAdmin,
} from '@/lib/questions';

export default function useAdminCategories() {
  const [allMapels, setAllMapels] = useState<BabInfo[]>([]);
  const [allbabs, setAllbabs] = useState<BabInfo[]>([]);
  const [allSubBabsAdmin, setAllSubBabsAdmin] = useState<SubBabInfo[]>([]);

  const loadAllMapelsAdmin = useCallback(async () => {
    try {
      const hbs = await fetchAllMapelsAdmin();
      setAllMapels(hbs);
    } catch (err) {
      console.error('Failed to load Admin Mapels list:', err);
    }
  }, []);

  const loadAllBabsAdmin = useCallback(async () => {
    try {
      const hbs = await fetchAllBabsAdmin();
      setAllbabs(hbs);
    } catch (err) {
      console.error('Failed to load Admin BABs list:', err);
    }
  }, []);

  const loadAllSubBabsAdmin = useCallback(async () => {
    try {
      const sbs = await fetchAllSubBabsAdmin();
      setAllSubBabsAdmin(sbs);
    } catch (err) {
      console.error('Failed to load admin sub_bab list:', err);
    }
  }, []);

  return {
    allMapels,
    allbabs,
    allSubBabsAdmin,
    setAllMapels,
    setAllbabs,
    setAllSubBabsAdmin,
    loadAllMapelsAdmin,
    loadAllBabsAdmin,
    loadAllSubBabsAdmin,
  };
}
