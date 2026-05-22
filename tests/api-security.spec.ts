import { test, expect } from '@playwright/test';
import { POST as startExam } from '../app/api/mobile/exam/start/route';

const endpoint = 'http://localhost/api/mobile/exam/start';

function jsonRequest(body: unknown, init?: RequestInit) {
  return new Request(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });
}

test.describe('mobile API security guardrails', () => {
  test('rejects non-JSON requests', async () => {
    const response = await startExam(new Request(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'not-json',
    }));

    expect(response.status).toBe(415);
  });

  test('rejects malformed JSON', async () => {
    const response = await startExam(jsonRequest('{bad-json'));

    expect(response.status).toBe(400);
  });

  test('rejects oversized JSON bodies', async () => {
    const response = await startExam(jsonRequest('x'.repeat(16 * 1024 + 1)));

    expect(response.status).toBe(400);
  });

  test('rejects invalid payloads before server actions run', async () => {
    const response = await startExam(jsonRequest({ name: '', mapels: [], babs: [], subBabs: [] }));

    expect(response.status).toBe(400);
  });
});
