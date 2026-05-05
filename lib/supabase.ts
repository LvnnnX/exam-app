import { createClient } from '@supabase/supabase-js';

// Helper to clean the URL (remove trailing slashes or extra paths)
const cleanUrl = (url: string) => {
  if (!url) return url;
  return url.replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
};

const supabaseUrl = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL as string);
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)?.trim();
const examSecretKey = (process.env.NEXT_PUBLIC_EXAM_SECRET_KEY as string)?.trim();

const isPlaceholder = !supabaseUrl || !supabaseAnonKey;

if (isPlaceholder) {
  console.error("❌ SUPABASE CONFIGURATION MISSING! ❌\n" +
                "You must add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file.\n" +
                "Falling back to placeholder URL which will cause 'Failed to fetch' errors in the browser.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-misconfigured.supabase.co', 
  supabaseAnonKey || 'placeholder',
  {
    global: {
      headers: {
        'x-exam-secret': examSecretKey || 'default-secret-key-123'
      }
    }
  }
);
