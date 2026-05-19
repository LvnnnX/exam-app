import { NextResponse } from 'next/server';
import { submitLiveQuizAnswerAction } from '@/app/actions/exam';
import { scramble } from '@/lib/crypto';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    if (!rateLimit(`live:answer:${getClientIp(request)}`, 120, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { playerId, questionId, userAnswer, timeTaken, index } = body;

    if (
      typeof playerId !== 'string' ||
      !playerId ||
      playerId.length > 120 ||
      !Number.isInteger(questionId) ||
      questionId < 1 ||
      typeof userAnswer !== 'string' ||
      userAnswer.length > 2000 ||
      typeof timeTaken !== 'number' ||
      timeTaken < 0 ||
      timeTaken > 86_400 ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 200
    ) {
      return NextResponse.json({ error: 'Invalid live answer payload' }, { status: 400 });
    }

    const data = await submitLiveQuizAnswerAction(
      playerId,
      questionId,
      scramble(userAnswer),
      timeTaken,
      index
    );

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit live answer';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
