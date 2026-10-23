import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/types/database.types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

/** '0' = user unticked "Ingat saya": auth cookies become browser-session cookies. */
export const REMEMBER_COOKIE = 'admin_remember';

export function sessionCookieOptions(options: CookieOptions, remember: boolean): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const base: CookieOptions = isProd ? { ...options, secure: true } : options;
  if (remember) return base;
  const { maxAge: _maxAge, expires: _expires, ...rest } = base;
  return rest;
}

export async function createServerSupabaseClient() {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieStore = await cookies();
  return createServerClient<Database>(url, anonKey, {
    cookieOptions: isProd ? { secure: true } : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        const remember = cookieStore.get(REMEMBER_COOKIE)?.value !== '0';
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, sessionCookieOptions(options, remember))
          );
        } catch {
          // Called from a Server Component; writes are ignored
        }
      },
    },
  });
}

export function createAdminSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diset');
  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });
}
