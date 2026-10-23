# Audit Keamanan Fase 7: RLS, RPC, XSS, Upload, Header, Secret Scan, npm audit, Rate Limit

Tanggal audit: 23 Oktober 2026  
Auditor: Security Engineer (Tim DevBot)  
Target: Smandapura Exam App v2 (Remake), branch `remake/v2`  
Database: PostgreSQL 17 (port 54329 lokal), PostgREST 16.5 (port 54330), Gateway Supabase (port 54321)  
Frontend/App: Next.js 16.3.6 (port 3100)

---

## 1. Ringkasan Eksekutif

Audit komprehensif fase 7 mencakup 9 domain keamanan: Row Level Security (RLS), integritas fungsi RPC (`SECURITY DEFINER` dan `search_path`), negative testing otomatis (SQL dan HTTP REST), XSS dan sink sanitasi DOM, mekanisme upload gambar, header keamanan (CSP, HSTS, framing), secret scanning pada git history, dependency vulnerability audit, serta rate limiting.

### Distribusi Temuan per Severity

| Severity | Jumlah | Deskripsi Singkat |
|---|---|---|
| Critical | 1 | CVE RCE & DoS Next.js 16.3.6 (Image Optimization & Server Actions) |
| High | 2 | AU-03 Broken Access Control pada updateQuizStatus (lintas admin); Kerentanan DOMPurify <= 3.4.16 & source-map-js |
| Medium | 3 | Fungsi `SECURITY DEFINER` legacy tanpa `SET search_path` dan terekspos anon; Sink `dangerouslySetInnerHTML` tanpa `RichContent` di runtime kuis; Header keamanan belum aktif di build port 3100 |
| Low | 2 | Storage bucket production lama tidak memiliki restriksi MIME dan ukuran file bawaan; Hardcoded test credentials di suite E2E |
| Info | 1 | Ketiadaan rate limit aplikasi pada join kuis, mulai ujian, dan submit jawaban (risiko diterima/ditangani arsitektur) |

---

## 2. Inventaris RLS dan Hak Akses Tabel

Hasil inspeksi katalog `pg_class`, `pg_policies`, dan `information_schema.table_privileges`:

| Objek | RLS Enabled | FORCE RLS | anon | authenticated (siswa) | admin (biasa) | super_admin | service_role |
|---|---|---|---|---|---|---|---|
| `public.questions` | Ya | Tidak | 0 baris (Block) | 0 baris (Block) | Full CRUD (aktif) | Full CRUD | Bypass RLS |
| `public.admins` | Ya | Tidak | 0 baris (Block) | 0 baris (Block) | Read self (1 baris) | Full CRUD | Bypass RLS |
| `public.exam_sessions` | Ya | Tidak | 0 baris (Block) | Read own session | Read all | Read all | Bypass RLS |
| `public.exam_answers` | Ya | Tidak | 0 baris (Block) | Read own answers | Read all | Read all | Bypass RLS |
| `public.players` | Ya | Tidak | 0 baris (Block) | 0 baris (Block) | Full CRUD | Full CRUD | Bypass RLS |
| `public.answers` | Ya | Tidak | 0 baris (Block) | Read own answers | Read all | Read all | Bypass RLS |
| `public.quizzes` | Ya | Tidak | Read (active/waiting/finished) | Read (active/waiting/finished) | Read all, Write own | Full CRUD | Bypass RLS |
| `public.subjects` | Ya | Tidak | Read shown | Read shown | Full CRUD | Full CRUD | Bypass RLS |
| `public.chapters` | Ya | Tidak | Read shown (cascade) | Read shown (cascade) | Full CRUD | Full CRUD | Bypass RLS |
| `public.topics` | Ya | Tidak | Read shown (cascade) | Read shown (cascade) | Full CRUD | Full CRUD | Bypass RLS |
| `public.admin_audit` | Ya | Tidak | Ditolak (No grant) | 0 baris (RLS block) | 0 baris (RLS block) | Read all | Bypass RLS |
| `public.admin_login_attempts` | Ya | Tidak | Ditolak (No grant) | Ditolak (No grant) | Ditolak (No grant) | Ditolak (No grant) | Read/Write |
| `storage.objects` | Ya (di prod) | Tidak | Read public bucket | Read public bucket | CRUD exam-images | CRUD exam-images | Bypass RLS |
| `legacy.*` (14 tabel) | Ya | Tidak | Ditolak (Schema no USAGE) | Ditolak (Schema no USAGE) | Ditolak | Ditolak | Read/Write |

Catatan: Schema `legacy` telah diisolasi penuh. Role `anon` dan `authenticated` tidak memiliki izin `USAGE` pada schema `legacy`. PostgREST dikonfigurasi hanya mengekspos schema `public`.

---

## 3. Audit Fungsi RPC (SECURITY DEFINER & Search Path)

Total fungsi `SECURITY DEFINER` di schema `public`: 47 fungsi.
- 39 fungsi telah mengunci `search_path = public` atau `search_path = ""`.
- Seluruh RPC sensitif Fase 5 (`rpc_ujian_*`), Fase 6 (`check_admin_login_allowed`, `record_admin_login_attempt`), dan kuis admin (`rpc_create_quiz`, `rpc_admin_update_quiz_status`) telah di-`REVOKE` dari `PUBLIC`, `anon`, dan `authenticated`, serta hanya dapat dieksekusi oleh `service_role`.
- Ditemukan 8 fungsi warisan v1 (legacy) yang berstatus `SECURITY DEFINER`, dapat dieksekusi `anon`, namun tidak memiliki deklarasi `SET search_path` (SEC-F7-03). Fungsi-fungsi ini gagal dieksekusi (runtime error) karena tabel lama yang dirujuknya sudah dipindahkan ke schema `legacy`.

---

## 4. Hasil Pengujian Otomatis

### 4.1 SQL Negative Test Suite (`tests/rls_phase7.sql`)
- Runner: `node scripts/local-stack/run-sql.mjs tests/rls_phase7.sql`
- Total pengujian: 18 assert
- Status: **18 PASS, 0 FAIL** (Exit code: 0)
- Lingkup pengujian:
  1. Anon direct SELECT pada `questions`, `exam_sessions.secret_hash`, `exam_answers`, `players`, `answers`, `admins` menghasilkan 0 baris.
  2. Anon direct SELECT pada `admin_audit` dan `admin_login_attempts` menghasilkan error permission denied.
  3. Anon direct INSERT/UPDATE/DELETE diblokir.
  4. Siswa terotentikasi tidak dapat membaca atau mengubah sesi/jawaban milik siswa lain.
  5. Anon dan siswa diblokir dari RPC admin (`rpc_create_quiz`, `rpc_admin_update_quiz_status`, `rpc_approve_admin_request`, `rpc_list_admins`).
  6. Admin biasa tidak dapat mengubah role akunnya sendiri menjadi `super_admin`, tidak dapat menyetujui admin lain, dan tidak dapat mengubah kuis milik `super_admin`.

### 4.2 REST Negative Test Suite (`tests/e2e/security-rest.mjs`)
- Runner: `node tests/e2e/security-rest.mjs`
- Total pengujian: 17 assert HTTP REST via Gateway lokal (port 54321)
- Status: **17 PASS, 0 FAIL** (Exit code: 0)
- Lingkup pengujian:
  1. Header PostgREST anon key diuji pada endpoint tabel sensitif (status 200 dengan 0 baris atau status 401).
  2. JWT siswa anonim diuji untuk membaca data sesi lain (0 baris) dan memanggil RPC service_role (status 403).
  3. JWT admin biasa diuji untuk mengupdate record kuis super admin via REST (0 baris terpengaruh) dan approve admin (ditolak oleh guard fungsi).
  4. Direct write siswa ditolak (401/403).

### 4.3 XSS Test Suite (`tests/unit/xss_phase7.test.ts` & `tests/e2e/security-xss.mjs`)
- Runner Unit: `node --experimental-strip-types --test tests/unit/xss_phase7.test.ts`
  - Status: **12 PASS, 0 FAIL** (Exit code: 0)
- Runner E2E: `node tests/e2e/security-xss.mjs http://localhost:3100`
  - Status: **4 PASS, 0 FAIL** (Exit code: 0)
- Pengujian mencakup: `<script>`, `<img onerror>`, `<svg onload>`, `<a href="javascript:">`, `style="background:url(javascript:)"`, `style="position:fixed"`, `<iframe>`, data URI SVG/HTML, dan KaTeX `\href{javascript:}{...}`.
- Hasil: Tidak ada payload yang dieksekusi browser (`dialog` listener tidak pernah terpanggil). KaTeX me-render ekspresi `\href` tanpa atribut `<a>` (karena `trust` tidak diaktifkan).

---

## 5. Audit Upload Gambar

### Komponen Aplikasi
1. `src/features/bank-soal/editor/ImageUploader.ts`:
   - Nama file disimpan acak: `images/${crypto.randomUUID()}.${ext}`.
   - Ekstensi ditentukan secara ketat oleh `validateImage()` berdasarkan verifikasi MIME dan magic bytes, bukan dari nama file asli input pengguna.
2. `src/features/bank-soal/editor/image-validation.ts`:
   - Memeriksa batas ukuran file maksimal 2 MB (`MAX_IMAGE_BYTES`).
   - Memverifikasi magic bytes (PNG: `89 50 4E 47`, JPEG: `FF D8 FF`, GIF: `GIF87a`/`GIF89a`, WebP: `RIFF....WEBP`).
   - Menolak SVG (`image/svg+xml`), HTML, dan ekstensi berbahaya lainnya.
3. `scripts/local-stack/gateway.mjs`:
   - Stub gateway lokal mengimplementasikan validasi ukuran (413 Payload Too Large) dan verifikasi magic bytes (415 Unsupported Media Type).
   - Memverifikasi admin aktif sebelum menerima upload ke bucket `exam-images`.

### Konfigurasi Storage Production
- Berdasarkan backup `E:/Backups/exam-app/prod-2026-10-22/prod-storage-metadata.data.sql`:
  - Bucket `exam-images` di production sebelumnya memiliki `file_size_limit = NULL` dan `allowed_mime_types = NULL`.
  - Migrasi `supabase/migrations/20261023000000_phase7_hardening.sql` telah disiapkan oleh BE untuk mengupdate bucket ke `file_size_limit = 2097152` (2 MB) dan `allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']`, serta memperketat RLS `storage.objects` hanya untuk admin aktif.

---

## 6. Audit Header Keamanan dan CSP

Pengujian HTTP header pada port 3100 (`next start` production build saat ini):
- Path diuji: `/`, `/ujian`, `/admin/login`, `/kuis/123456`.
- Hasil curl: Header keamanan (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, `Strict-Transport-Security`) **belum muncul** pada build port 3100.
- Penyebab: Konfigurasi `headers()` di `next.config.ts` baru saja ditambahkan oleh BE di working tree dan belum di-build ke `.next`.
- Audit isi konfigurasi CSP di `next.config.ts`:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline'`
  - `style-src 'self' 'unsafe-inline'`
  - `img-src 'self' data: blob: <supabaseOrigin>`
  - `font-src 'self' data:`
  - `connect-src 'self' <supabaseOrigin> <supabaseWs>`
  - `object-src 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
  - `frame-ancestors 'none'`
  - Kebijakan ini kompatibel dengan KaTeX (inline styles & fonts), TipTap, Supabase Realtime WebSocket (`wss://`), dan Next.js App Router bootstrap.
  - Header pendukung: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), screen-wake-lock=(self)`.

---

## 7. Audit Secret Scan

- Pemeriksaan `git ls-files`: Tidak ada file `.env*` yang ter-track di git. File `.gitignore` memuat baris `.env*`.
- Pemindaian git history (`git log -p --all`):
  - Ditemukan string kata sandi dummy lokal pada file pengujian:
    - `tests/e2e/auth.mjs:25`: `password: 'password'` (koneksi PostgreSQL lokal portable)
    - `tests/e2e/auth.mjs:52`: `password: 'PasswordSuper123!'` (password akun uji E2E)
    - `tests/e2e/ujian.mjs:25`: `password: 'password'`
    - `tests/unit/*.test.ts`: `password: 'password'`
  - `README.md:136`: Dokumentasi contoh environment variable `NEXT_PUBLIC_EXAM_SECRET_KEY=your-secret-key-for-encryption` (placeholder dummy).
  - Tidak ditemukan kunci API pihak ketiga, token Resend (`re_`), private key RSA/EC, AWS key, maupun secret production Supabase yang bocor di history repositori.

---

## 8. Audit Ketergantungan (npm audit)

Perintah: `npm audit --omit=dev --json`

### Ringkasan Temuan
- Total kerentanan: 6 (1 Critical, 2 High, 2 Moderate, 1 Low).

| Paket | Severity | Advisory ID / CVE | Keterangan |
|---|---|---|---|
| `next` (16.3.6) | Critical | GHSA-2464-fhr4-w9xw | Unauthenticated Remote Code Execution in Image Optimization API when SVG files are used |
| `next` (16.3.6) | Critical | GHSA-673q-mjm6-r5xr | Unauthenticated Remote Code Execution in `use cache` functions returning typed arrays |
| `next` (16.3.6) | High | GHSA-cjq9-62q9-8jv4 | SSRF in Image Optimization API |
| `next` (16.3.6) | High | GHSA-p3m5-59mp-jv5r | Denial of Service in App Router using Server Actions |
| `dompurify` (3.4.0) | High | GHSA-mrv2-3pqr-j5jr | IN_PLACE hook removal leaves armed event handlers (affected <= 3.4.16) |
| `source-map-js` (1.2.1) | High | GHSA-68fv-2mgg-jv7q | Event-loop denial of service through indexed source-map section offsets |

### Analisis Jalur Perbaikan
1. `dompurify`: Tersedia versi patch `3.4.17` di npm registry. Update minor `3.4.0` -> `3.4.17` tidak memicu breaking change dan langsung menutup advisory High.
2. `source-map-js`: Tersedia versi `1.2.2` (sub-dependensi postcss). Dapat diselesaikan via `npm audit fix` atau overrides.
3. `next`: Advisory tercatat untuk versi `< 16.3.8` atau `<= 16.4.0`. Pada kanal rilis npm, Next.js v16 saat ini memiliki versi canary `16.5.0-canary.x`. Memperbarui Next.js core memerlukan pengujian regresi menyeluruh oleh tim sebelum deploy production.

---

## 9. Audit Rate Limiting

1. **Login Admin (AU-04)**:
   - Diimplementasikan di level database melalui `public.check_admin_login_allowed(p_identifier text, p_ip_hash text)` dan `public.record_admin_login_attempt(...)`.
   - Menggunakan tabel `public.admin_login_attempts`.
   - Hasil pengujian: Tepat setelah percobaan ke-5 gagal dalam kurun 15 menit untuk satu email, percobaan ke-6 langsung ditolak (`check_admin_login_allowed` mengembalikan `false`).
   - Cleanup: Disediakan fungsi `purge_admin_login_attempts()`.
2. **Join Kuis, Mulai Ujian, dan Submit Jawaban**:
   - Belum ada rate limiting khusus di level aplikasi/database untuk aksi siswa ini.
   - Evaluasi risiko:
     - Join kuis dilindungi kode kuis unik 6 digit (hanya kuis aktif/waiting) dan validasi unik nama per kuis (`UNIQUE(quiz_id, name)`).
     - Submit ujian mandiri dilindungi token enkripsi AES-256 + HMAC-SHA256 (`secret_hash` di database).
     - Submit kuis dilindungi validasi status kuis aktif, indeks soal berurutan (strict mode), dan pemetaan ID soal.
     - Risiko diterima: Beban aplikasi kuis kelas (40 siswa) berada di bawah kapasitas Postgres lokal/Cloud Run. Penambahan middleware in-memory rate limiting direkomendasikan untuk fase berikutnya jika terjadi spam join massal.

---

## 10. Daftar Temuan Keamanan Lengkap

### SEC-F7-01: Potensi Remote Code Execution dan SSRF pada Image Optimization Next.js
- **Severity**: Critical
- **Lokasi**: `package.json:dependencies.next` (versi 16.3.6)
- **Bukti**: `npm audit --omit=dev --json` melaporkan GHSA-2464-fhr4-w9xw (Critical) dan GHSA-cjq9-62q9-8jv4 (High) pada API image optimization bawaan Next.js.
- **Rekomendasi Fix**: 
  1. Pastikan fitur SVG image optimization tidak diizinkan atau pasang `dangerouslyAllowSVG: false` (default) di `next.config.ts`.
  2. Jadwalkan update dependensi `next` ke rilis stabil yang memuat patch kerentanan tersebut setelah fase 7b selesai.
- **Penanggung Jawab**: BE / DevOps

---

### SEC-F7-02: Broken Access Control pada Server Action updateQuizStatus (AU-03)
- **Severity**: High
- **Lokasi**: `src/features/kuis/server.ts:38` (`updateQuizStatus`) dan `supabase/migrations/20261022010000_phase3_quiz.sql:212` (`rpc_admin_update_quiz_status`)
- **Bukti**: 
  - `updateQuizStatusAction` di `src/features/kuis/actions.ts` memanggil `updateQuizStatus(quizId, action)`.
  - Di `server.ts`, fungsi memvalidasi `requireActiveAdmin()`, lalu memanggil RPC `rpc_admin_update_quiz_status` menggunakan `createAdminSupabaseClient()` (service_role).
  - Di database, `rpc_admin_update_quiz_status` hanya memeriksa `IF auth.uid() IS NOT NULL AND NOT public.check_is_active_admin()`. Karena dipanggil via service_role, `auth.uid()` bernilai NULL sehingga pemeriksaan kepemilikan kuis (`created_by = auth.uid()`) dilewati.
  - Akibatnya: Admin biasa dapat menjeda, melanjutkan, membatalkan, atau menyelesaikan kuis milik admin lain atau milik super admin jika mengetahui `quiz_id`. Ini melanggar klausul PRD AU-03 ("admin: bank soal dan kuis miliknya sendiri").
- **Rekomendasi Fix**:
  1. Pada `src/features/kuis/server.ts:updateQuizStatus`, periksa kepemilikan kuis sebelum memanggil RPC jika admin bukan `super_admin`:
     ```ts
     const admin = await requireActiveAdmin();
     if (admin.role !== 'super_admin') {
       const quiz = await getQuizById(quizId);
       if (quiz && quiz.created_by && quiz.created_by !== admin.userId) {
         throw new Error('Akses ditolak: Anda hanya dapat mengelola kuis milik sendiri');
       }
     }
     ```
  2. Atau teruskan parameter `p_actor_id` ke dalam RPC untuk divalidasi terhadap `created_by`.
- **Penanggung Jawab**: BE

---

### SEC-F7-03: Kerentanan Sanitasi DOMPurify (GHSA-mrv2-3pqr-j5jr)
- **Severity**: High
- **Lokasi**: `package.json:dependencies.dompurify` (versi 3.4.0)
- **Bukti**: `npm audit` mencatat advisory high GHSA-mrv2-3pqr-j5jr yang mempengaruhi versi `<= 3.4.16`.
- **Rekomendasi Fix**: Jalankan update dependensi ke `dompurify@^3.4.17`.
- **Penanggung Jawab**: BE / FE

---

### SEC-F7-04: Fungsi RPC Legacy Tanpa Search Path dan Terekspos ke Anonim
- **Severity**: Medium
- **Lokasi**: Schema `public` pada Postgres lokal (8 fungsi: `finish_player_quiz_rpc`, `get_live_quiz_question`, `get_server_time`, `get_session_question`, `get_session_state`, `join_live_quiz`, `set_player_horse_skin`, `submit_live_quiz_answer_v2`)
- **Bukti**: Query `pg_proc` menunjukkan fungsi-fungsi tersebut berstatus `SECURITY DEFINER` tanpa `SET search_path` dan memiliki izin `EXECUTE` untuk role `anon`.
- **Rekomendasi Fix**: Karena fungsi-fungsi ini merupakan sisa arsitektur v1 yang tabelnya sudah dipindahkan ke schema `legacy`, buat migrasi SQL untuk me-`REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated;` atau lakukan `DROP FUNCTION` pada fungsi-fungsi tersebut jika sudah tidak ada kode v2 yang menggunakannya.
- **Penanggung Jawab**: BE

---

### SEC-F7-05: Penggunaan dangerouslySetInnerHTML Tanpa Komponen RichContent
- **Severity**: Medium
- **Lokasi**: 
  - `src/features/kuis/components/StudentQuizRuntime.tsx:273` (`dangerouslySetInnerHTML={{ __html: currentQuestion.body_html }}`)
  - `src/features/kuis/components/PlayerAnswersModal.tsx:77` (`dangerouslySetInnerHTML={{ __html: ans.body_html }}`)
- **Bukti**: Grep source code menemukan bahwa di halaman kuis siswa dan modal jawaban admin, teks soal di-render langsung menggunakan `dangerouslySetInnerHTML` mentah, bukan komponen `<RichContent html={...} />`. Meskipun konten soal telah melewati sanitasi saat dibuat di bank soal, rendering client-side yang tidak menggunakan sanitizer rentan terhadap stale data atau bypass langsung ke DB.
- **Rekomendasi Fix**: Ganti elemen div tersebut dengan komponen `<RichContent html={...} />` yang secara otomatis menjalankan sanitasi DOMPurify pada sisi client.
- **Penanggung Jawab**: FE

---

### SEC-F7-06: Header Keamanan Belum Aktif di Port 3100
- **Severity**: Medium
- **Lokasi**: `next.config.ts` vs build aktif port 3100
- **Bukti**: Hasil `curl -sI http://localhost:3100/` tidak memuat header CSP, X-Frame-Options, dan Permissions-Policy.
- **Rekomendasi Fix**: Konfigurasi header sudah benar di `next.config.ts`. Diperlukan rebuild produksi (`npx next build`) sebelum rilis fase 7b agar header aktif di lingkungan live.
- **Penanggung Jawab**: DevOps / Lead (DevBot)

---

### SEC-F7-07: Konfigurasi Bucket Storage Production Belum Terbatas
- **Severity**: Low
- **Lokasi**: Production Supabase Storage (`storage.buckets` record `exam-images`)
- **Bukti**: Metadata dump production menunjukkan `file_size_limit` dan `allowed_mime_types` bernilai NULL.
- **Rekomendasi Fix**: Terapkan migrasi `supabase/migrations/20261023000000_phase7_hardening.sql` pada saat migrasi production untuk membatasi ukuran 2 MB dan tipe MIME PNG/JPEG/WebP/GIF.
- **Penanggung Jawab**: BE / DevOps

---

### SEC-F7-08: Kredensial Uji Hardcoded di File Test E2E
- **Severity**: Low
- **Lokasi**: `tests/e2e/auth.mjs:52`, `tests/e2e/security-rest.mjs:47`
- **Bukti**: Kata sandi akun pengujian terdefinisi sebagai literal string di dalam file script pengujian.
- **Rekomendasi Fix**: Pindahkan kredensial akun uji ke environment variable atau gunakan generator string acak dinamis (`crypto.randomBytes(16).toString('hex')`) per test run.
- **Penanggung Jawab**: BE / QA

---

### SEC-F7-09: Belum Ada Rate Limiting Aplikasi untuk Join Kuis dan Submit Jawaban
- **Severity**: Info
- **Lokasi**: `src/features/kuis/actions.ts` dan `src/features/ujian/actions.ts`
- **Bukti**: Siswa dapat mengirim permintaan join kuis atau submit jawaban secara berulang tanpa pembatasan frekuensi (rate limiting).
- **Rekomendasi Fix**: Tandai sebagai risiko diterima untuk rilis saat ini karena lingkungan penggunaan sekolah terbatas. Pertimbangkan penambahan rate limit berbasis Redis atau in-memory IP bucket pada Next.js middleware jika dibuka untuk publik terbuka.
- **Penanggung Jawab**: BE

---

## 11. Rencana Fix (Instruksi Konkret)

### Instruksi untuk Backend (BE)

1. **Fix SEC-F7-02 (AU-03 Broken Access Control pada updateQuizStatus)**:
   - Buka `src/features/kuis/server.ts`.
   - Di dalam fungsi `updateQuizStatus(quizId, action)`:
     ```ts
     export async function updateQuizStatus(quizId: string, action: 'start' | 'pause' | 'resume' | 'finish' | 'cancel') {
       const admin = await requireActiveAdmin();
       if (admin.role !== 'super_admin') {
         const quiz = await getQuizById(quizId);
         if (quiz && quiz.created_by && quiz.created_by !== admin.userId) {
           throw new Error('Akses ditolak: Anda hanya dapat mengelola status kuis milik sendiri');
         }
       }
       const supabase = createAdminSupabaseClient();
       // ... eksekusi rpc ...
     }
     ```
2. **Fix SEC-F7-04 (Pembersihan RPC Legacy)**:
   - Buat migrasi SQL baru (atau tambahkan di phase7 hardening) untuk me-revoke fungsi legacy:
     ```sql
     REVOKE EXECUTE ON FUNCTION public.finish_player_quiz_rpc(uuid) FROM PUBLIC, anon, authenticated;
     REVOKE EXECUTE ON FUNCTION public.get_live_quiz_question(text, integer, text) FROM PUBLIC, anon, authenticated;
     REVOKE EXECUTE ON FUNCTION public.get_server_time() FROM PUBLIC, anon, authenticated;
     REVOKE EXECUTE ON FUNCTION public.get_session_question(uuid, integer) FROM PUBLIC, anon, authenticated;
     REVOKE EXECUTE ON FUNCTION public.get_session_state(uuid) FROM PUBLIC, anon, authenticated;
     REVOKE EXECUTE ON FUNCTION public.join_live_quiz(text, text) FROM PUBLIC, anon, authenticated;
     REVOKE EXECUTE ON FUNCTION public.set_player_horse_skin(uuid, text) FROM PUBLIC, anon, authenticated;
     REVOKE EXECUTE ON FUNCTION public.submit_live_quiz_answer_v2(text, integer, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
     ```
3. **Fix SEC-F7-03 & Dependensi**:
   - Perbarui versi `dompurify` ke `^3.4.17` di `package.json`.

---

### Instruksi untuk Frontend (FE)

1. **Fix SEC-F7-05 (Gunakan RichContent di Runtime Kuis dan Modal Jawaban)**:
   - Buka `src/features/kuis/components/StudentQuizRuntime.tsx`.
   - Import `RichContent` dari `@/src/components/RichContent`.
   - Ganti baris 272-275:
     ```tsx
     <RichContent html={currentQuestion.body_html} className="text-sm sm:text-base leading-relaxed font-medium" />
     ```
   - Buka `src/features/kuis/components/PlayerAnswersModal.tsx`.
   - Ganti baris 76-78 dengan `<RichContent html={ans.body_html} className="text-xs line-clamp-2" />`.

---

### Instruksi untuk DevOps / Lead (DevBot)

1. Lakukan rebuild aplikasi Next.js (`npm run build`) sebelum fase 7b rilis agar header CSP dan security headers di `next.config.ts` aktif secara efektif.
2. Pastikan file migrasi `20261023000000_phase7_hardening.sql` disertakan pada batch transaksi migrasi production.

---

## 12. Berkas Pengujian yang Dihasilkan

1. `tests/rls_phase7.sql`: RLS & RPC Negative SQL Test Suite (18 skenario pengujian database).
2. `tests/e2e/security-rest.mjs`: HTTP REST Negative Verification Suite (17 skenario gateway PostgREST).
3. `tests/unit/xss_phase7.test.ts`: Unit test sanitasi HTML dan CSS style parser (12 skenario).
4. `tests/e2e/security-xss.mjs`: Playwright E2E browser XSS verification (dialog listener).
5. `docs/security/fase7-rls-audit.md`: Dokumen laporan audit ini.
