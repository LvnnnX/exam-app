import { NextResponse } from 'next/server';
import { submitLiveQuizAnswerAction } from '@/app/actions/exam';
import { scramble } from '@/lib/crypto';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { genericError, readJsonBody, rejectNonJson } from '@/lib/api-security';

export async function POST(request: Request) {
  try {
    const contentTypeError = rejectNonJson(request);
    if (contentTypeError) return contentTypeError;

    if (!rateLimit(`live:answer:${getClientIp(request)}`, 120, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // SECURITY: Parse bounded JSON only. Reject malformed or oversized bodies before validation.
    const body = await readJsonBody<Record<string, unknown>>(request);
    if (!body) return genericError('Invalid live answer payload', 400);
    const { playerId, questionId, userAnswer, timeTaken, index } = body;
    const safeQuestionId = Number.isInteger(questionId) ? (questionId as number) : null;
    const safeIndex = Number.isInteger(index) ? (index as number) : null;

    if (
      typeof playerId !== 'string' ||
      !playerId ||
      playerId.length > 120 ||
      safeQuestionId === null ||
      safeQuestionId < 1 ||
      typeof userAnswer !== 'string' ||
      userAnswer.length > 2000 ||
      typeof timeTaken !== 'number' ||
      timeTaken < 0 ||
      timeTaken > 86_400 ||
      safeIndex === null ||
      safeIndex < 0 ||
      safeIndex > 200
    ) {
      return NextResponse.json({ error: 'Invalid live answer payload' }, { status: 400 });
    }

    const data = await submitLiveQuizAnswerAction(
      playerId,
      safeQuestionId,
      scramble(userAnswer),
      timeTaken,
      safeIndex
    );

    return NextResponse.json(data);
  } catch {
    console.warn('mobile.live.answer.failed', { timestamp: new Date().toISOString() });
    return genericError('Failed to submit live answer');
  }
}
