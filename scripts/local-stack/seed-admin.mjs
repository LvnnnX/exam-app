// Seeds local-only admin accounts into the LOCAL database. Refuses any non-loopback host.
import pg from 'pg';
import { PG, requireLocalEnv } from './env.mjs';

const env = requireLocalEnv();
const email = env.LOCAL_ADMIN_EMAIL;
const password = env.LOCAL_ADMIN_PASSWORD;
if (!email || !password) throw new Error('LOCAL_ADMIN_EMAIL / LOCAL_ADMIN_PASSWORD belum ada di .env.local');

const ACCOUNTS = [
  { email, username: 'admin_lokal', role: 'super_admin', status: 'active' },
  { email: 'pending@local.test', username: 'pending_lokal', role: 'admin', status: 'pending' },
];

const client = new pg.Client(PG);
await client.connect();
try {
  await client.query('BEGIN');
  for (const a of ACCOUNTS) {
    const { rows } = await client.query(
      `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
         public.crypt($2, public.gen_salt('bf')), now(), '{"provider":"email"}', '{}', now(), now())
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [a.email, password],
    ).catch(() => ({ rows: [] }));
    let id = rows[0]?.id;
    if (!id) {
      const existing = await client.query('SELECT id FROM auth.users WHERE lower(email) = lower($1)', [a.email]);
      id = existing.rows[0]?.id;
    }
    // Keep one row per email even if the insert above raced an existing record.
    const dupes = await client.query('SELECT id FROM auth.users WHERE lower(email) = lower($1) ORDER BY created_at', [a.email]);
    id = dupes.rows[0].id;
    await client.query('UPDATE auth.users SET encrypted_password = public.crypt($2, public.gen_salt($3)) WHERE id = $1', [id, password, 'bf']);
    await client.query(
      `INSERT INTO public.admins (user_id, username, role, status) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, updated_at = now()`,
      [id, a.username, a.role, a.status],
    );
    console.log(`seeded ${a.email} (${a.role}, ${a.status})`);
  }
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
