import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { REMEMBER_COOKIE, sessionCookieOptions } from '@/src/lib/supabase-server';

const PUBLIC_ADMIN = new Set(['/admin/login', '/admin/register']);

// AU-01: every /admin/* page except login/register needs an ACTIVE admin session.
// Pages and server actions re-check (requireActiveAdmin / requireSuperAdmin); this is the first gate.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ADMIN.has(pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });
  const isProd = process.env.NODE_ENV === 'production';
  const remember = request.cookies.get(REMEMBER_COOKIE)?.value !== '0';
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
    {
      cookieOptions: isProd ? { secure: true } : undefined,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, sessionCookieOptions(options, remember)),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { data: admin } = user
    ? await supabase.from('admins').select('status').eq('user_id', user.id).maybeSingle()
    : { data: null };

  if (admin?.status !== 'active') {
    const login = new URL('/admin/login', request.url);
    if (pathname !== '/admin') login.searchParams.set('redirect', pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
