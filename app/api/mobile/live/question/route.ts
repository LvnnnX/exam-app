import { NextResponse } from 'next/server';
import { getLiveQuizQuestionAction } from '@/app/actions/exam';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { genericError, readJsonBody, rejectNonJson } from '@/lib/api-security';

export async function POST(request: Request) {
  try {
    const contentTypeError = rejectNonJson(request);
    if (contentTypeError) return contentTypeError;

    if (!rateLimit(`live:question:${getClientIp(request)}`, 120, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // SECURITY: Parse bounded JSON only. Reject malformed or oversized bodies before validation.
    const body = await readJsonBody<Record<string, unknown>>(request);
    if (!body) return genericError('Invalid live question payload', 400);
    const { playerId, index } = body;
    const safeIndex = Number.isInteger(index) ? (index as number) : null;

    if (typeof playerId !== 'string' || !playerId || playerId.length > 120 || safeIndex === null || safeIndex < 0 || safeIndex > 200) {
      return NextResponse.json({ error: 'Invalid live question payload' }, { status: 400 });
    }

    const data = await getLiveQuizQuestionAction(playerId, safeIndex);
    return NextResponse.json(data);
  } catch {
    console.warn('mobile.live.question.failed', { timestamp: new Date().toISOString() });
    return genericError('Failed to fetch live question');
  }
}
