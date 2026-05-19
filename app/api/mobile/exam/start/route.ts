import { NextResponse } from 'next/server';
import { startExamSessionAction } from '@/app/actions/exam';
import { normalizeCategorySlug, isSafeCategorySlug } from '@/lib/categories';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

const ALLOWED_MODES = new Set(['standard', 'survival']);
const ALLOWED_COUNTS = new Set([5, 10, 20, 25, 30, 40, 50, 100]);
const ALLOWED_TIME_LIMITS = new Set([0, 1, 30, 60, 90, 120, 150, 180]);

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const normalized = value.map((item) => normalizeCategorySlug(String(item)));
  if (normalized.length === 0 || normalized.some((item) => !isSafeCategorySlug(item))) return null;

  return normalized;
}

export async function POST(request: Request) {
  try {
    if (!rateLimit(`exam:start:${getClientIp(request)}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { name, mapels, babs, subBabs, mode, count, timeLimitMinutes, userAgent } = body;
    const safeMapels = normalizeStringArray(mapels);
    const safeBabs = normalizeStringArray(babs);
    const safeSubBabs = normalizeStringArray(subBabs);

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.trim().length > 80 ||
      !safeMapels ||
      !safeBabs ||
      !safeSubBabs ||
      typeof mode !== 'string' ||
      !ALLOWED_MODES.has(mode) ||
      !ALLOWED_COUNTS.has(count) ||
      !ALLOWED_TIME_LIMITS.has(timeLimitMinutes)
    ) {
      return NextResponse.json({ error: 'Invalid exam session payload' }, { status: 400 });
    }

    const data = await startExamSessionAction(
      name.trim(),
      safeMapels,
      safeBabs,
      safeSubBabs,
      mode,
      count,
      timeLimitMinutes,
      typeof userAgent === 'string' ? userAgent.slice(0, 200) : 'expo-native'
    );

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start exam session';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
