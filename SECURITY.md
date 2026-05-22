# SECURITY.md — OWASP Security Directive for AI Coding Assistants

> **Purpose:** Instruksi mandatory untuk AI assistant (Cursor, Copilot, Claude, Kiro, dll)
> agar menerapkan OWASP Top 10 security practices saat menulis/mereview kode web.
> Berlaku untuk Next.js, Vite, React, dan framework JS/TS modern lainnya.

---

## Scope

Dokumen ini berlaku untuk semua code generation dan code review dalam project ini.
AI assistant WAJIB mematuhi setiap section di bawah sebagai hard constraint —
bukan saran, tapi requirement.

---

## OWASP Top 10 (2021) — Implementation Rules

### A01: Broken Access Control

**Rules:**
- Setiap API route/endpoint WAJIB punya authorization check — tidak ada endpoint publik kecuali explicitly marked `@public`
- Implement principle of least privilege: default deny, explicit allow
- Server-side access control enforcement — JANGAN rely pada client-side hiding
- Rate limiting pada semua authenticated endpoints (minimum)
- CORS policy restrictive: whitelist origin, jangan `Access-Control-Allow-Origin: *` di production
- Disable directory listing pada static file serving
- JWT/session token: validate on every request, check expiry, check scope

**Pattern wajib:**
```typescript
// Middleware pattern — SETIAP protected route
export async function middleware(req: NextRequest) {
  const session = await verifySession(req);
  if (!session) return NextResponse.redirect('/login');
  if (!hasPermission(session.user, req.nextUrl.pathname)) {
    return new NextResponse(null, { status: 403 });
  }
}
```

**Dilarang:**
- ❌ Endpoint tanpa auth check
- ❌ Client-side only route protection tanpa server validation
- ❌ Hardcoded admin bypass
- ❌ IDOR (Insecure Direct Object Reference) — selalu validate ownership

---

### A02: Cryptographic Failures

**Rules:**
- HTTPS only — redirect semua HTTP ke HTTPS
- Password hashing: bcrypt (cost ≥12) atau argon2id — JANGAN MD5/SHA1/SHA256 plain
- Sensitive data at rest: encrypt dengan AES-256-GCM minimum
- Jangan store secrets di client-side (localStorage, cookies tanpa httpOnly)
- Environment variables untuk secrets — JANGAN hardcode di source
- TLS 1.2+ minimum untuk semua external connections
- Jangan log sensitive data (passwords, tokens, PII)

**Pattern wajib:**
```typescript
// Password hashing
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 12;
const hash = await bcrypt.hash(password, SALT_ROUNDS);

// Cookie security
res.setHeader('Set-Cookie', serialize('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
  maxAge: 60 * 60 * 24, // 24h
}));
```

**Dilarang:**
- ❌ Plaintext password storage
- ❌ Secrets di `.env` yang ter-commit (pastikan `.gitignore`)
- ❌ `crypto.createHash('md5')` untuk security purposes
- ❌ Sensitive data di URL query params

---

### A03: Injection

**Rules:**
- SQL: SELALU parameterized queries / prepared statements — JANGAN string concatenation
- NoSQL: validate dan sanitize semua query operators
- OS Command: JANGAN `exec()` / `spawn()` dengan user input tanpa sanitization
- LDAP, XPath, template injection: same principle — parameterize
- ORM usage preferred over raw queries
- Input validation SEBELUM query construction

**Pattern wajib:**
```typescript
// SQL — parameterized (Prisma/Drizzle/raw)
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// JANGAN PERNAH:
// const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`);

// Command execution — jika absolutely necessary
import { execFile } from 'child_process'; // execFile, BUKAN exec
execFile('/usr/bin/convert', [inputPath, outputPath]); // array args, no shell
```

**Dilarang:**
- ❌ String interpolation dalam SQL/NoSQL queries
- ❌ `eval()`, `new Function()` dengan user input
- ❌ `child_process.exec()` dengan user-controlled strings
- ❌ Template literals dalam database queries tanpa parameterization

---

### A04: Insecure Design

**Rules:**
- Threat modeling SEBELUM implementasi fitur baru yang handle sensitive data
- Business logic abuse scenarios harus di-consider (rate limit, anti-automation)
- Fail securely: error state default ke deny, bukan allow
- Separation of concerns: auth logic terpisah dari business logic
- Unit test untuk security-critical paths (auth, payment, data access)
- Limit resource consumption per user (file upload size, API calls, compute)

**Pattern wajib:**
```typescript
// Rate limiting per endpoint
import { Ratelimit } from '@upstash/ratelimit';
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 req/min
});

// File upload constraints
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
```

---

### A05: Security Misconfiguration

**Rules:**
- Remove default credentials dan unnecessary features
- Security headers WAJIB di setiap response (lihat checklist bawah)
- Error messages: generic ke user, detailed ke log — JANGAN expose stack trace
- Disable debug mode di production
- Keep dependencies updated — `npm audit` regular
- Remove unused dependencies
- Disable unnecessary HTTP methods

**Security Headers wajib:**
```typescript
// next.config.js atau middleware
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '0' }, // disabled, rely on CSP
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';"
  },
];
```

**Dilarang:**
- ❌ `NODE_ENV=development` di production
- ❌ Stack traces / error details exposed ke client
- ❌ Default API keys / admin passwords
- ❌ Unnecessary ports/services open

---

### A06: Vulnerable and Outdated Components

**Rules:**
- Pin dependency versions (exact, bukan `^` atau `~` untuk production)
- Run `npm audit` / `pnpm audit` sebelum setiap deploy
- Dependabot / Renovate aktif untuk automated updates
- Jangan pakai packages dengan known CVEs — cek sebelum install
- Prefer well-maintained packages (>1000 weekly downloads, recent commits)
- Lock file (`package-lock.json` / `pnpm-lock.yaml`) WAJIB committed

**Pattern wajib:**
```json
// package.json — pinned versions
{
  "dependencies": {
    "next": "14.2.3",
    "react": "18.3.1",
    "zod": "3.23.8"
  }
}
```

**Dilarang:**
- ❌ `"package": "*"` atau `"latest"`
- ❌ Ignore `npm audit` high/critical findings
- ❌ Packages dengan <100 weekly downloads tanpa review manual
- ❌ Forked/patched packages tanpa documented reason

---

### A07: Identification and Authentication Failures

**Rules:**
- Multi-factor authentication untuk admin/sensitive operations
- Password policy: minimum 8 chars, check against breached password lists
- Session management: rotate session ID after login, invalidate on logout
- Brute force protection: account lockout atau exponential backoff
- Jangan expose apakah username/email exists di error messages
- Secure session storage (server-side atau encrypted JWT)
- Implement proper logout (invalidate token server-side)

**Pattern wajib:**
```typescript
// Login response — jangan leak user existence
if (!user || !await bcrypt.compare(password, user.passwordHash)) {
  // SAME error message regardless of which failed
  return res.status(401).json({ error: 'Invalid credentials' });
}

// Session rotation after auth
await destroySession(oldSessionId);
const newSession = await createSession(user.id);
```

**Dilarang:**
- ❌ "User not found" vs "Wrong password" — different error messages
- ❌ Session tokens yang tidak expire
- ❌ Password reset tanpa rate limiting
- ❌ Remember-me tokens tanpa expiry dan rotation

---

### A08: Software and Data Integrity Failures

**Rules:**
- Verify integrity of dependencies (lock files, checksums)
- CI/CD pipeline: jangan allow unsigned/unverified code
- Subresource Integrity (SRI) untuk external CDN scripts
- Deserialization: validate dan sanitize — jangan blindly `JSON.parse` untrusted data
- Code review mandatory sebelum merge ke main
- Signed commits preferred untuk production branches

**Pattern wajib:**
```html
<!-- SRI for external scripts -->
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous"
></script>
```

```typescript
// Safe deserialization with schema validation
import { z } from 'zod';
const PayloadSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
});
const data = PayloadSchema.parse(JSON.parse(rawInput));
```

**Dilarang:**
- ❌ `eval(JSON.parse(...))` atau dynamic code execution dari external data
- ❌ CDN scripts tanpa SRI hash
- ❌ Auto-merge tanpa review
- ❌ Unvalidated deserialization of complex objects

---

### A09: Security Logging and Monitoring Failures

**Rules:**
- Log semua authentication events (login, logout, failed attempts)
- Log authorization failures (403s)
- Log input validation failures
- Structured logging format (JSON) untuk parseability
- JANGAN log sensitive data (passwords, tokens, full credit card numbers)
- Alerting untuk anomalous patterns (brute force, unusual access patterns)
- Log retention minimum 90 days

**Pattern wajib:**
```typescript
// Structured security logging
import { logger } from '@/lib/logger';

logger.warn('auth.failed', {
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  email: maskEmail(email), // mask PII
  reason: 'invalid_password',
  timestamp: new Date().toISOString(),
});

// JANGAN: logger.info(`Login failed for ${email} with password ${password}`)
```

**Dilarang:**
- ❌ `console.log` untuk security events di production
- ❌ Logging passwords, tokens, atau full PII
- ❌ No logging at all pada auth endpoints
- ❌ Logs tanpa timestamp atau request context

---

### A10: Server-Side Request Forgery (SSRF)

**Rules:**
- Validate dan whitelist semua URLs yang di-fetch server-side
- Block internal/private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Jangan allow user-controlled URLs untuk server-side fetch tanpa validation
- DNS rebinding protection: resolve DNS dan validate IP SEBELUM fetch
- Limit redirect following
- Timeout semua outbound requests

**Pattern wajib:**
```typescript
import { isPrivateIP } from '@/lib/network';

async function safeFetch(url: string) {
  const parsed = new URL(url);

  // Block private/internal IPs
  const resolved = await dns.resolve4(parsed.hostname);
  if (resolved.some(ip => isPrivateIP(ip))) {
    throw new Error('Request to internal network blocked');
  }

  // Whitelist allowed protocols
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('Invalid protocol');
  }

  return fetch(url, {
    redirect: 'manual', // don't auto-follow redirects
    signal: AbortSignal.timeout(10000), // 10s timeout
  });
}
```

**Dilarang:**
- ❌ `fetch(userInput)` tanpa validation
- ❌ Allow requests ke internal services dari user-controlled URLs
- ❌ Unlimited redirects pada server-side fetches
- ❌ No timeout pada outbound requests

---

## Additional Security Checklist

### Input Validation (semua user input)
- [ ] Validate type, length, range, format
- [ ] Use allowlist over denylist
- [ ] Validate on server-side (client-side validation = UX only)
- [ ] Use Zod/Yup/Joi untuk schema validation

### XSS Prevention
- [ ] React auto-escapes by default — JANGAN bypass dengan `dangerouslySetInnerHTML`
- [ ] Sanitize HTML jika harus render user content (DOMPurify)
- [ ] CSP header configured
- [ ] No inline scripts di production

### CSRF Protection
- [ ] SameSite cookie attribute = 'strict' atau 'lax'
- [ ] CSRF token untuk state-changing operations (jika pakai cookies)
- [ ] Verify Origin/Referer header untuk sensitive endpoints

### File Upload Security
- [ ] Validate file type (magic bytes, bukan hanya extension)
- [ ] Limit file size server-side
- [ ] Store uploads di luar webroot
- [ ] Generate random filenames — jangan pakai user-provided filename
- [ ] Scan for malware jika applicable

### API Security
- [ ] Authentication pada semua non-public endpoints
- [ ] Rate limiting per IP dan per user
- [ ] Request size limits
- [ ] Pagination pada list endpoints (jangan return unbounded data)
- [ ] Validate Content-Type header

---

## Enforcement

AI assistant yang bekerja di project ini WAJIB:

1. **Scan setiap code generation** terhadap rules di atas sebelum output
2. **Flag violations** jika menemukan existing code yang melanggar
3. **Refuse** menulis code yang explicitly violates rules ini (e.g., raw SQL concatenation)
4. **Suggest fixes** untuk existing vulnerabilities yang ditemukan
5. **Default ke secure pattern** — jika ada pilihan antara convenience dan security, pilih security
6. **Comment security-critical code** dengan `// SECURITY:` prefix untuk reviewability

---

## Quick Reference — Secure Defaults

| Concern | Secure Default |
|---------|---------------|
| SQL | Parameterized queries / ORM |
| Auth | Server-side session + httpOnly cookie |
| Password | bcrypt cost 12+ / argon2id |
| Input | Zod schema validation |
| Headers | Full security header set |
| CORS | Explicit origin whitelist |
| Secrets | Environment variables only |
| Deps | Pinned versions + audit |
| Errors | Generic to client, detailed to logs |
| Files | Random name + type validation + size limit |

---

## References

- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

*Last updated: 2026-05-22*
*Applicable to: Next.js, Vite, React, Node.js, TypeScript projects*
