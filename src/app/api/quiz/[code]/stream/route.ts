import { NextRequest } from 'next/server';
import { getQuizStreamState } from '@/src/features/kuis/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code) {
    return new Response('Kode kuis wajib diisi', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendUpdate = async () => {
        if (isClosed) return;
        try {
          const state = await getQuizStreamState(code);
          if (!state) {
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ message: 'Kuis tidak ditemukan' })}\n\n`)
            );
            return;
          }

          controller.enqueue(
            encoder.encode(`event: state\ndata: ${JSON.stringify(state)}\n\n`)
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`)
          );
        }
      };

      // Initial immediate send
      await sendUpdate();

      // Periodic push every 1.5s
      const timer = setInterval(sendUpdate, 1500);

      request.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
