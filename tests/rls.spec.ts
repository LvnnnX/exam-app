import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * RLS smoke tests. We exercise the anon-key Supabase client to prove that:
 *   1. Sensitive columns on the `questions` table are not selectable.
 *   2. The public_* views never leak the same columns.
 *   3. The kuis_logs.question_ids column is not visible to anon callers.
 *
 * The tests intentionally bypass the browser. They hit Supabase REST directly
 * with the anon key the production client uses, so a regression in RLS will
 * surface immediately.
 */

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing env: ${name}. Set it before running RLS tests.`);
  }
  return value;
}

const SUPABASE_URL = (() => {
  try {
    return readEnv('NEXT_PUBLIC_SUPABASE_URL');
  } catch {
    return '';
  }
})();
const SUPABASE_ANON_KEY = (() => {
  try {
    return readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  } catch {
    return '';
  }
})();

const skipReason = (!SUPABASE_URL || !SUPABASE_ANON_KEY)
  ? 'Skipping RLS tests: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing.'
  : null;

test.describe('RLS hardening', () => {
  test.skip(!!skipReason, skipReason || '');

  const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_ANON_KEY || 'anon');

  test('anon cannot read correct_answer / short_answer from questions', async () => {
    const { data, error } = await supabase
      .from('questions')
      .select('id, correct_answer, short_answer')
      .limit(1);

    // We expect either an RLS error OR a row with the sensitive columns
    // stripped/null. We do NOT accept a row where correct_answer is a real
    // letter (A-E) or short_answer is a non-empty string.
    if (!error && data && data.length > 0) {
      const row = data[0] as { correct_answer?: unknown; short_answer?: unknown };
      expect(row.correct_answer ?? null).toBeNull();
      expect(
        typeof row.short_answer === 'string' && row.short_answer.length > 0
      ).toBeFalsy();
    } else {
      // RLS denied the read entirely. That is the strongest possible result.
      expect(error).toBeTruthy();
    }
  });

  test('public_categories view does not expose hidden flag', async () => {
    const { data, error } = await supabase
      .from('public_categories')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    if (data && data.length > 0) {
      const row = data[0] as Record<string, unknown>;
      expect(row).not.toHaveProperty('is_hidden');
      expect(row).not.toHaveProperty('correct_answer');
      expect(row).not.toHaveProperty('short_answer');
    }
  });

  test('public_kuis_logs view does not expose question_ids', async () => {
    const { data, error } = await supabase
      .from('public_kuis_logs')
      .select('*')
      .limit(1);

    expect(error).toBeNull();
    if (data && data.length > 0) {
      const row = data[0] as Record<string, unknown>;
      expect(row).not.toHaveProperty('question_ids');
    }
  });

  test('admin_profiles is not anon-readable', async () => {
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('user_id, role')
      .limit(1);

    // RLS should either error or return empty. Real rows = leak.
    if (!error) {
      expect(data ?? []).toHaveLength(0);
    } else {
      expect(error).toBeTruthy();
    }
  });

  test('admin_audit_log is not anon-readable', async () => {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('id')
      .limit(1);

    if (!error) {
      expect(data ?? []).toHaveLength(0);
    } else {
      expect(error).toBeTruthy();
    }
  });

  test('rate_limit_buckets is not anon-readable', async () => {
    const { data, error } = await supabase
      .from('rate_limit_buckets')
      .select('key')
      .limit(1);

    if (!error) {
      expect(data ?? []).toHaveLength(0);
    } else {
      expect(error).toBeTruthy();
    }
  });

  test('admin_login_attempts is not anon-readable', async () => {
    const { data, error } = await supabase
      .from('admin_login_attempts')
      .select('id')
      .limit(1);

    if (!error) {
      expect(data ?? []).toHaveLength(0);
    } else {
      expect(error).toBeTruthy();
    }
  });
});
