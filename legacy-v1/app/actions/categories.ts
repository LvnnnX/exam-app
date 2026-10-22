"use server";

import { 
  fetchMapels, 
  fetchbabs, 
  fetchSubBabsForMultiple 
} from '@/lib/questions';

/**
 * Server Actions to fetch categories.
 * By running these on the server, the browser never sees the raw database response
 * and never downloads the hidden categories list.
 */

export async function getSafeMapels() {
  return await fetchMapels();
}

export async function getSafeBabs(mapel?: string) {
  return await fetchbabs(mapel);
}

export async function getSafeSubBabsForMultiple(babs: string[]) {
  return await fetchSubBabsForMultiple(babs);
}
