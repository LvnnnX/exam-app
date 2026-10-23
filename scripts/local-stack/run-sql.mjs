// Runs a SQL file against the LOCAL database with psql (stops on first error).
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { PG, PG_BIN } from './env.mjs';

const file = process.argv[2];
if (!file) throw new Error('usage: node scripts/local-stack/run-sql.mjs <file.sql>');
const r = spawnSync(
  join(PG_BIN, process.platform === 'win32' ? 'psql.exe' : 'psql'),
  ['-h', PG.host, '-p', String(PG.port), '-U', PG.user, '-d', PG.database, '-v', 'ON_ERROR_STOP=1', '-f', resolve(file)],
  { stdio: 'inherit' },
);
process.exit(r.status ?? 1);
