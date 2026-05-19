import { NextResponse } from 'next/server';
import { getLiveQuizQuestionAction } from '@/app/actions/exam';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    if (!rateLimit(`live:question:${getClientIp(request)}`, 120, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { playerId, index } = body;

    if (typeof playerId !== 'string' || !playerId || playerId.length > 120 || !Number.isInteger(index) || index < 0 || index > 200) {
      return NextResponse.json({ error: 'Invalid live question payload' }, { status: 400 });
    }

    const data = await getLiveQuizQuestionAction(playerId, index);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch live question';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
