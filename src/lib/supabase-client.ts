import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/src/types/database.types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

export function createClient() {
  return createBrowserClient<Database>(url, anonKey);
}

// Singleton for client components
export const supabase = createClient();
