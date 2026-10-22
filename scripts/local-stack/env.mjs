// Shared config for the local dev stack. Local only: every URL is asserted to be loopback.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..', '..');
export const ENV_PATH = resolve(ROOT, '.env.local');

export const PG = {
  host: '127.0.0.1',
  port: Number(process.env.LOCAL_PG_PORT || 54329),
  user: 'postgres',
  database: 'postgres',
};
export const PG_BIN = process.env.LOCAL_PG_BIN || 'C:/Users/Windows/tools/pgsql17/bin';
export const PG_DATA = process.env.LOCAL_PG_DATA || 'C:/Users/Windows/tools/pgdata-examapp';
export const POSTGREST_EXE = process.env.LOCAL_POSTGREST_EXE || 'C:/Users/Windows/tools/postgrest/postgrest.exe';
export const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || 'C:/Users/Windows/tools/examapp-storage';
export const GATEWAY_PORT = 54321;
export const POSTGREST_PORT = 54330;

export function loadEnvFile() {
  const env = {};
  if (!existsSync(ENV_PATH)) return env;
  for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

export function assertLocalUrl(url, label) {
  const host = new URL(url).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`${label} harus mengarah ke localhost, bukan ${host}. Stack lokal menolak jalan ke remote.`);
  }
}

export function requireLocalEnv() {
  const env = loadEnvFile();
  for (const k of ['LOCAL_JWT_SECRET', 'NEXT_PUBLIC_SUPABASE_URL']) {
    if (!env[k]) throw new Error(`${k} belum ada di .env.local. Jalankan: npm run stack:init`);
  }
  assertLocalUrl(env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  return env;
}
