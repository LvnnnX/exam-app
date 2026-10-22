// Local stand-in for the Supabase API gateway (Kong + GoTrue + Storage), dev only.
// ponytail: implements only the endpoints supabase-js uses in this app
// (password login, refresh, getUser, logout, raw-body upload, public read).
// Swap for `supabase start` once Docker is installed; the app code does not change.
import http from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import pg from 'pg';
import { GATEWAY_PORT, PG, POSTGREST_PORT, STORAGE_DIR, requireLocalEnv } from './env.mjs';
import { signJwt, verifyJwt } from './jwt.mjs';

const env = requireLocalEnv();
const SECRET = env.LOCAL_JWT_SECRET;
const pool = new pg.Pool({ ...PG, max: 4 });
const ACCESS_TTL = 3600;
const refreshTokens = new Map(); // ponytail: in-memory, a gateway restart logs everyone out

export const BUCKET_RULES = {
  'exam-images': {
    maxBytes: 2 * 1024 * 1024,
    mime: {
      'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
      'image/gif': (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')),
      'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
    },
  },
};

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, {
    'content-type': isBuf ? 'application/octet-stream' : 'application/json',
    ...headers,
  });
  res.end(isBuf ? body : body === undefined ? '' : JSON.stringify(body));
}

function authError(res, status, code, msg) {
  send(res, status, { code: status, error_code: code, msg });
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

function bearerClaims(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? verifyJwt(h.slice(7), SECRET) : null;
}

function toUser(row) {
  return {
    id: row.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: row.email,
    email_confirmed_at: row.email_confirmed_at,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: row.raw_user_meta_data || {},
    identities: [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_anonymous: false,
  };
}

function issueSession(row) {
  const now = Math.floor(Date.now() / 1000);
  const sessionId = randomUUID();
  const access = signJwt(
    { sub: row.id, role: 'authenticated', aud: 'authenticated', email: row.email, iat: now, exp: now + ACCESS_TTL, session_id: sessionId, aal: 'aal1', is_anonymous: false },
    SECRET,
  );
  const refresh = randomBytes(24).toString('base64url');
  refreshTokens.set(refresh, { userId: row.id, exp: now + 7 * 24 * 3600 });
  return { access_token: access, token_type: 'bearer', expires_in: ACCESS_TTL, expires_at: now + ACCESS_TTL, refresh_token: refresh, user: toUser(row) };
}

const USER_COLS = 'id, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at';

async function handleAuth(req, res, url) {
  const path = url.pathname.replace('/auth/v1', '');
  if (path === '/token' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req, 64 * 1024)).toString() || '{}');
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const { rows } = await pool.query(
        `SELECT ${USER_COLS} FROM auth.users WHERE lower(email) = lower($1) AND deleted_at IS NULL
           AND encrypted_password IS NOT NULL AND encrypted_password = public.crypt($2, encrypted_password)`,
        [String(body.email || ''), String(body.password || '')],
      );
      if (!rows[0]) return authError(res, 400, 'invalid_credentials', 'Invalid login credentials');
      return send(res, 200, issueSession(rows[0]));
    }
    if (grant === 'refresh_token') {
      const entry = refreshTokens.get(String(body.refresh_token || ''));
      refreshTokens.delete(String(body.refresh_token || ''));
      if (!entry || entry.exp < Date.now() / 1000) return authError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
      const { rows } = await pool.query(`SELECT ${USER_COLS} FROM auth.users WHERE id = $1`, [entry.userId]);
      if (!rows[0]) return authError(res, 400, 'user_not_found', 'User not found');
      return send(res, 200, issueSession(rows[0]));
    }
    return authError(res, 400, 'unsupported_grant_type', 'Unsupported grant type');
  }
  if (path === '/user' && req.method === 'GET') {
    const claims = bearerClaims(req);
    if (!claims?.sub) return authError(res, 401, 'bad_jwt', 'invalid JWT');
    const { rows } = await pool.query(`SELECT ${USER_COLS} FROM auth.users WHERE id = $1`, [claims.sub]);
    if (!rows[0]) return authError(res, 403, 'user_not_found', 'User not found');
    return send(res, 200, toUser(rows[0]));
  }
  if (path === '/logout' && req.method === 'POST') return send(res, 204);
  return authError(res, 404, 'not_found', 'Endpoint not supported by local gateway');
}

const SAFE_PATH = /^[A-Za-z0-9_\-./]+$/;

function objectFile(bucket, key) {
  if (!BUCKET_RULES[bucket] || !SAFE_PATH.test(key) || key.split('/').some((s) => s === '..' || s === '' || s === '.')) return null;
  const base = resolve(STORAGE_DIR, bucket);
  const file = resolve(base, key);
  return file.startsWith(base + (process.platform === 'win32' ? '\\' : '/')) ? file : null;
}

async function handleStorage(req, res, url) {
  const parts = url.pathname.replace('/storage/v1/object/', '').split('/');
  if (req.method === 'GET' && parts[0] === 'public') {
    const file = objectFile(parts[1], parts.slice(2).join('/'));
    if (!file || !existsSync(file)) return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    const { rows } = await pool.query(
      `SELECT metadata->>'mimetype' AS mime FROM storage.objects WHERE bucket_id = $1 AND name = $2`,
      [parts[1], parts.slice(2).join('/')],
    );
    res.writeHead(200, {
      'content-type': rows[0]?.mime || 'application/octet-stream',
      'content-length': statSync(file).size,
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=3600',
      'content-security-policy': "default-src 'none'",
    });
    return createReadStream(file).pipe(res);
  }
  if (req.method === 'POST') {
    const bucket = parts[0];
    const key = parts.slice(1).join('/');
    const rules = BUCKET_RULES[bucket];
    const file = objectFile(bucket, key);
    if (!rules || !file) return send(res, 400, { statusCode: '400', error: 'invalid_key', message: 'Invalid bucket or object key' });
    const claims = bearerClaims(req);
    if (!claims?.sub || claims.role !== 'authenticated') return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
    const admin = await pool.query(`SELECT 1 FROM public.admins WHERE user_id = $1 AND status = 'active'`, [claims.sub]);
    if (!admin.rowCount) return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!rules.mime[mime]) return send(res, 415, { statusCode: '415', error: 'invalid_mime_type', message: `mime type ${mime} is not supported` });
    let body;
    try {
      body = await readBody(req, rules.maxBytes);
    } catch (e) {
      return send(res, e.status || 400, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' });
    }
    if (!rules.mime[mime](body)) return send(res, 415, { statusCode: '415', error: 'invalid_mime_type', message: 'File content does not match its mime type' });
    if (existsSync(file)) return send(res, 409, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body, { flag: 'wx' });
    const id = randomUUID();
    await pool.query(
      `INSERT INTO storage.objects (id, bucket_id, name, owner, owner_id, metadata) VALUES ($1, $2, $3, $4, $4::text, $5)`,
      [id, bucket, key, claims.sub, { mimetype: mime, size: body.length }],
    );
    return send(res, 200, { Key: `${bucket}/${key}`, Id: id });
  }
  return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Endpoint not supported by local gateway' });
}

function proxyRest(req, res, url) {
  const headers = { ...req.headers, host: `127.0.0.1:${POSTGREST_PORT}` };
  if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
  const upstream = http.request(
    { host: '127.0.0.1', port: POSTGREST_PORT, method: req.method, path: url.pathname.replace('/rest/v1', '') + url.search, headers },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', () => send(res, 502, { message: 'PostgREST tidak jalan di port ' + POSTGREST_PORT }));
  req.pipe(upstream);
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('access-control-allow-headers', 'authorization, apikey, content-type, prefer, range, x-client-info, x-upsert, accept-profile, content-profile, x-supabase-api-version');
    res.setHeader('access-control-allow-methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    res.setHeader('access-control-expose-headers', 'content-range, content-profile');
  }
}

export function startGateway() {
  mkdirSync(join(STORAGE_DIR, 'exam-images'), { recursive: true });
  const server = http.createServer(async (req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') return send(res, 204);
    const url = new URL(req.url || '/', `http://127.0.0.1:${GATEWAY_PORT}`);
    try {
      if (url.pathname.startsWith('/rest/v1')) return proxyRest(req, res, url);
      if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url);
      if (url.pathname.startsWith('/storage/v1/object/')) return await handleStorage(req, res, url);
      return send(res, 404, { message: 'not found' });
    } catch (e) {
      console.error('[gateway]', e.message);
      if (!res.headersSent) send(res, 500, { message: 'gateway error' });
    }
  });
  server.listen(GATEWAY_PORT, '127.0.0.1', () => console.log(`[gateway] http://127.0.0.1:${GATEWAY_PORT}`));
  return server;
}
