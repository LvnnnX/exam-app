// Starts the local stack: Postgres (if stopped) + PostgREST + local gateway. Ctrl+C stops PostgREST + gateway.
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { PG, PG_BIN, PG_DATA, POSTGREST_EXE, POSTGREST_PORT, requireLocalEnv } from './env.mjs';
import { startGateway } from './gateway.mjs';

const env = requireLocalEnv();
const exe = (name) => join(PG_BIN, process.platform === 'win32' ? `${name}.exe` : name);

const ready = () => spawnSync(exe('pg_isready'), ['-h', PG.host, '-p', String(PG.port)]).status === 0;
if (!ready()) {
  console.log('[pg] starting', PG_DATA);
  spawnSync(exe('pg_ctl'), ['-D', PG_DATA, '-l', `${PG_DATA}.log`, 'start', '-w'], { stdio: 'inherit' });
  if (!ready()) throw new Error('Postgres lokal gagal start, cek ' + PG_DATA + '.log');
}
console.log(`[pg] ready on ${PG.host}:${PG.port}`);

const pathSep = process.platform === 'win32' ? ';' : ':';
const rest = spawn(POSTGREST_EXE, [], {
  env: {
    ...process.env,
    PATH: PG_BIN + pathSep + process.env.PATH, // PostgREST on Windows needs libpq.dll from the PG bin dir
    PGRST_DB_URI: `postgres://authenticator@${PG.host}:${PG.port}/${PG.database}`,
    PGRST_DB_SCHEMAS: 'public',
    PGRST_DB_ANON_ROLE: 'anon',
    PGRST_JWT_SECRET: env.LOCAL_JWT_SECRET,
    PGRST_SERVER_HOST: '127.0.0.1',
    PGRST_SERVER_PORT: String(POSTGREST_PORT),
    PGRST_DB_MAX_ROWS: '1000',
    PGRST_LOG_LEVEL: 'warn',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});
rest.on('exit', (code) => {
  console.error('[postgrest] exited with code', code);
  process.exit(1);
});
console.log(`[postgrest] http://127.0.0.1:${POSTGREST_PORT}`);

startGateway();

const stop = () => {
  rest.removeAllListeners('exit');
  rest.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
