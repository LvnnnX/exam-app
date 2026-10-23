import os

files = [
    'supabase/migrations/20261022000000_remake_v2_phase1.sql',
    'supabase/migrations/20261022010000_phase3_quiz.sql',
    'supabase/migrations/20261022020000_phase4_race.sql',
    'supabase/migrations/20261022030000_phase5_ujian.sql',
    'supabase/migrations/20261022040000_phase6_auth.sql',
    'supabase/migrations/20261022041000_ujian_results_null_topics.sql',
    'supabase/migrations/20261022042000_phase6_security_hardening.sql',
    'supabase/migrations/20261023000000_phase7_hardening.sql',
]

preamble = """-- Smandapura Exam App v2 Migration Bundle
BEGIN;

-- 0. Extensions aliases in public
CREATE OR REPLACE FUNCTION public.gen_random_bytes(integer) 
RETURNS bytea LANGUAGE sql PARALLEL SAFE COST 1 AS $$ 
  SELECT extensions.gen_random_bytes($1); 
$$;

CREATE OR REPLACE FUNCTION public.digest(text, text) 
RETURNS bytea LANGUAGE sql PARALLEL SAFE COST 1 AS $$ 
  SELECT extensions.digest($1, $2); 
$$;

-- Disable legacy cron jobs via cron.alter_job
SELECT cron.alter_job(job_id := jobid, active := false)
FROM cron.job
WHERE jobname IN (
  'auto_start_scheduled_quizzes',
  'purge_rate_limit_buckets',
  'refresh_daily_analytics',
  'activate-scheduled-exams',
  'close-expired-scheduled-exams'
);
"""

compat = """
-- Backward-compatible is_admin helper pointing to v2 admins
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE admins.user_id = coalesce(p_user_id, auth.uid())
      AND admins.status = 'active'
  );
$$;
"""

def build_payload(mode='dryrun'):
    out_path = f'docs/deploy/{mode}_payload.sql' if mode == 'dryrun' else 'docs/deploy/production_deploy_payload.sql'
    with open(out_path, 'w', encoding='utf-8') as out:
        out.write(preamble)
        for f in files:
            with open(f, 'r', encoding='utf-8') as fp:
                content = fp.read()
            lines = [l for l in content.splitlines() if l.strip() not in ('BEGIN;', 'COMMIT;')]
            out.write(f'\n-- >>> START: {f}\n' + '\n'.join(lines) + f'\n-- <<< END: {f}\n')
        out.write(compat)
        if mode == 'dryrun':
            with open('docs/deploy/verify_queries.sql', 'r', encoding='utf-8') as vf:
                out.write('\n-- Verification queries\n' + vf.read())
            out.write('\nROLLBACK;\n')
        else:
            out.write('\nCOMMIT;\n')
    print(f'Generated: {out_path}')

if __name__ == '__main__':
    build_payload('dryrun')
    build_payload('production')
