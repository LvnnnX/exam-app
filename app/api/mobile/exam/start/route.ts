import { NextResponse } from 'next/server';
import { startExamSessionAction } from '@/app/actions/exam';
import { normalizeCategorySlug, isSafeCategorySlug } from '@/lib/categories';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { genericError, readJsonBody, rejectNonJson } from '@/lib/api-security';

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
    const contentTypeError = rejectNonJson(request);
    if (contentTypeError) return contentTypeError;

    if (!rateLimit(`exam:start:${getClientIp(request)}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // SECURITY: Parse bounded JSON only. Reject malformed or oversized bodies before validation.
    const body = await readJsonBody<Record<string, unknown>>(request);
    if (!body) return genericError('Invalid exam session payload', 400);
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
      !Number.isInteger(count) ||
      !ALLOWED_COUNTS.has(count as number) ||
      !Number.isInteger(timeLimitMinutes) ||
      !ALLOWED_TIME_LIMITS.has(timeLimitMinutes as number)
    ) {
      return NextResponse.json({ error: 'Invalid exam session payload' }, { status: 400 });
    }

    const data = await startExamSessionAction(
      name.trim(),
      safeMapels,
      safeBabs,
      safeSubBabs,
      mode as 'standard' | 'survival',
      count as number,
      timeLimitMinutes as number,
      typeof userAgent === 'string' ? userAgent.slice(0, 200) : 'expo-native'
    );

    return NextResponse.json(data);
  } catch {
    console.warn('mobile.exam.start.failed', { timestamp: new Date().toISOString() });
    return genericError('Failed to start exam session');
  }
}
