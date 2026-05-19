import { createClient } from '@supabase/supabase-js';

// Helper to clean the URL (remove trailing slashes or extra paths)
const cleanUrl = (url: string) => {
  if (!url) return url;
  return url.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
};

const supabaseUrl = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL as string);
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)?.trim();
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
 * Server-only client that includes the secret key.
 * Never call this from the client-side.
 */
export const getSupabaseServer = () => {
  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          'x-exam-secret': getExamSecretKey()
        }
      }
    }
  );
};
