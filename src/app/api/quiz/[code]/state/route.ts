import { NextRequest, NextResponse } from 'next/server';
import { getQuizStreamState } from '@/src/features/kuis/server';
import { getCurrentAdmin } from '@/src/features/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code) {
    return NextResponse.json({ success: false, error: 'Kode kuis wajib diisi' }, { status: 400 });
  }

  try {
    const admin = await getCurrentAdmin();
    const state = await getQuizStreamState(code, admin?.status === 'active' ? 'admin' : 'public');
    if (!state) {
      return NextResponse.json({ success: false, error: 'Kuis tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, state });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
