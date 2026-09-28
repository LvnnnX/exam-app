import { createClient } from '@supabase/supabase-js';

// Helper to clean the URL (remove trailing slashes or extra paths)
const cleanUrl = (url: string) => {
  if (!url) return url;
  return url.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
};

const supabaseUrl = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL as string);
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)?.trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY as string)?.trim();
export function getExamSecretKey(): string {
  const secret = process.env.EXAM_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error('EXAM_SECRET_KEY is required for server Supabase actions');
  }
  return secret;
}

const isPlaceholder = !supabaseUrl || !supabaseAnonKey;

if (isPlaceholder) {
  console.error("❌ SUPABASE CONFIGURATION MISSING! ❌\n" +
    "You must add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file.");
}

// Public client for browser - NO SECRET HEADERS
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-misconfigured.supabase.co',
  supabaseAnonKey || 'placeholder'
);

/**
 * Server-only client that uses the SERVICE ROLE key.
 * Bypasses RLS — never call this from client-side code.
 */
export const getSupabaseServer = () => {
  if (!supabaseServiceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Add it to .env.local for server-side Supabase access.'
    );
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
};
