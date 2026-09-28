import { NextResponse } from 'next/server';

const MAX_JSON_BYTES = 16 * 1024;

export function rejectNonJson(request: Request): NextResponse | null {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
  }
  return null;
}

export async function readJsonBody<T = unknown>(request: Request): Promise<T | null> {
  const raw = await request.text();
  if (!raw || raw.length > MAX_JSON_BYTES) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function genericError(message: string, status = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
