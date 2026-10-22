"use client";

import { useMemo } from 'react';
import type { BabInfo, SubBabInfo } from '@/lib/questions';

type UseExamDerivedValuesArgs = {
  mapels: string[];
  babs: string[];
  subBabs: string[];
  availableMapels: BabInfo[];
  availableBabs: BabInfo[];
  availableSubBabs: SubBabInfo[];
  startTime: number | null;
  endTime: number | null;
  current: number;
  recapData: unknown[];
};

export default function useExamDerivedValues({
  mapels,
  babs,
  subBabs,
  availableMapels,
  availableBabs,
  availableSubBabs,
  startTime,
  endTime,
  current,
  recapData,
}: UseExamDerivedValuesArgs) {
  return useMemo(() => {
    const mapelsLabel = mapels.length > 0
      ? mapels.map((m) => availableMapels.find((am) => am.value === m)?.label || m).join(', ')
      : 'None';

    const babsLabel = babs.length > 0
      ? babs.map((b) => availableBabs.find((ab) => ab.value === b)?.label || b).join(', ')
      : 'None';

    const subBabsLabel = subBabs.length > 0
      ? subBabs.map((sb) => availableSubBabs.find((a) => a.value === sb)?.label || sb).join(', ')
      : 'None';

    const durationSeconds = startTime && endTime ? Math.floor((endTime - startTime) / 1000) : 0;
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    const seconds = durationSeconds % 60;

    let formattedDuration = '';
    if (hours > 0) formattedDuration += `${hours} Hours, `;
    if (minutes > 0 || hours > 0) formattedDuration += `${minutes} Minutes, `;
    formattedDuration += `${seconds} Seconds`;

    const answeredCount = recapData.filter((_, idx) => idx <= current).length;

    return {
      mapelsLabel,
      babsLabel,
      subBabsLabel,
      formattedDuration,
      answeredCount,
    };
  }, [
    mapels,
    babs,
    subBabs,
    availableMapels,
    availableBabs,
    availableSubBabs,
    startTime,
    endTime,
    current,
    recapData,
  ]);
}
