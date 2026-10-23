# Runbook Migrasi Database dan Deployment Fase 8 (Production)

Dokumen ini adalah panduan operasional langkah demi langkah untuk mengeksekusi migrasi database Supabase dan deployment aplikasi Next.js v2 (Remake) ke production. 

PENTING: Seluruh langkah di dokumen ini adalah prosedur yang hanya dieksekusi saat Fase 8 dimulai dengan izin eksplisit dari Dani. Dilarang menjalankan perintah apa pun ke production selama fase persiapan atau dokumen.

---

## 1. Prasyarat dan Kriteria Go / No-Go

Sebelum menyentuh production, seluruh syarat berikut wajib terpenuhi. Jika ada satu syarat yang tidak lolos, status migrasi adalah **NO-GO** (tunda eksekusi).

### 1.1 Checklist Prasyarat
1. **Fase 7 Lolos Penuh:**
   - Semua tes E2E Playwright (`npm run test:e2e`), unit test, dan tes RLS lokal lolos tanpa kegagalan (0 error, 0 fail).
   - Audit keamanan dan aksesibilitas Fase 7a selesai tanpa temuan berbobot kritis atau tinggi.
   - Build produksi Next.js lokal bersih (`npm run build`, lint 0 warning, typecheck clean).
2. **Keputusan Dani Terjawab:**
   - Semua butir keputusan terbuka pada Bagian 12 runbook ini telah diputuskan oleh Dani.
3. **Pemilihan Jam Sepi (Maintenance Window):**
   - Waktu eksekusi dipilih di luar jam sekolah dan bimbingan belajar (disarankan pukul 23:00 sampai 03:00 WITA / UTC+8).
   - Pengajar telah diinformasikan bahwa sistem akan offline sementara selama 30 sampai 60 menit.

### 1.2 Pengecekan Sesi Aktif di Production (SQL Go / No-Go)
Jalankan query read-only berikut menggunakan psql ke database production:

```sql
-- Cek 1: Pastikan tidak ada kuis live yang sedang berjalan atau dijeda di skema lama
SELECT count(*) AS active_quizzes
FROM public.kuis_logs
WHERE status IN ('active', 'paused');

-- Cek 2: Pastikan tidak ada sesi ujian mandiri yang sedang berlangsung
SELECT count(*) AS active_exam_sessions
FROM public.exam_logs
WHERE is_finished = false
  AND expires_at > now();
```

**Aturan Keputusan:**
- **GO:** Kedua hasil di atas menghasilkan angka `0`.
- **NO-GO:** Jika `active_quizzes > 0` atau `active_exam_sessions > 0`, migrasi dilarang dimulai. Tunggu sampai kuis selesai atau sesi ujian expired, lalu jalankan query ulang.

---

## 2. Backup Ulang Sesaat Sebelum Migrasi (Point-in-Time)

Meskipun backup Fase 0 telah tersedia di `E:/Backups/exam-app/prod-2026-10-22/`, backup ulang wajib diambil tepat sebelum eksekusi untuk menangkap delta data terbaru (kuis baru, jawaban baru, atau akun admin baru).

### 2.1 Perintah Backup
Gunakan binary PostgreSQL 17 client (`C:/Users/Windows/tools/pgsql17/bin/pg_dump.exe`). Simpan ke direktori baru bertanggal, contoh: `E:/Backups/exam-app/prod-<YYYY-MM-DD-HHmm>/`.

```bash
# Set direktori target dan koneksi
export BIN="C:/Users/Windows/tools/pgsql17/bin"
export OUT="E:/Backups/exam-app/prod-pre-migration-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$OUT/csv" "$OUT/logs"

# Menggunakan connection string prod dari environment aman
# Mode read-only memastikan tidak ada penulisan data selama backup
export PGOPTIONS='-c default_transaction_read_only=on'
export PGCONNECT_TIMEOUT=30

# 1. Dump custom format (terkompresi, mencakup struktur + data public dan private)
"$BIN/pg_dump" -d "$PROD_DB_URL" -n public -n private -Fc -Z 6 -f "$OUT/prod-public-private.full.dump" 2> "$OUT/logs/dump_custom.err"

# 2. Dump plain text (SQL terbaca untuk referensi darurat)
"$BIN/pg_dump" -d "$PROD_DB_URL" -n public -n private -Fp -f "$OUT/prod-public-private.full.sql" 2> "$OUT/logs/dump_plain_full.err"

# 3. Dump portable plain text (tanpa owner dan tanpa privileges)
"$BIN/pg_dump" -d "$PROD_DB_URL" -n public -n private -Fp --no-owner --no-privileges -f "$OUT/prod-public-private.noowner.sql" 2> "$OUT/logs/dump_plain_portable.err"

# 4. Dump data cron job, metadata storage, dan data autentikasi
"$BIN/pg_dump" -d "$PROD_DB_URL" --data-only -t cron.job -Fp --no-owner --no-privileges -f "$OUT/prod-cron-job.data.sql" 2> "$OUT/logs/dump_cron.err"
"$BIN/pg_dump" -d "$PROD_DB_URL" --data-only -t storage.buckets -t storage.objects -Fp --no-owner --no-privileges -f "$OUT/prod-storage-metadata.data.sql" 2> "$OUT/logs/dump_storage.err"
"$BIN/pg_dump" -d "$PROD_DB_URL" --data-only -n auth -Fc -f "$OUT/prod-auth.data.dump" 2> "$OUT/logs/dump_auth.err"

# 5. Export CSV seluruh tabel public dan private
"$BIN/psql" -d "$PROD_DB_URL" -XAt -v ON_ERROR_STOP=1 -c "SELECT n.nspname||'.'||c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','m') ORDER BY 1" > "$OUT/tables.txt"

while read -r t; do
  "$BIN/psql" -d "$PROD_DB_URL" -X -v ON_ERROR_STOP=1 -c "COPY (SELECT * FROM $t) TO STDOUT WITH (FORMAT csv, HEADER)" > "$OUT/csv/$t.csv" 2>> "$OUT/logs/csv.err"
done < "$OUT/tables.txt"

# 6. Sinkronisasi aset storage exam-images (bila ada gambar baru sejak 2026-10-22)
# Download delta objek storage menggunakan REST API Supabase / storage script ke $OUT/storage-exam-images
```

### 2.2 Verifikasi Checksum dan Test Restore Lokal
1. Buat checksum SHA256 untuk semua file hasil dump:
   ```bash
   cd "$OUT" && sha256sum * csv/* > SHA256SUMS.txt
   sha256sum -c SHA256SUMS.txt
   ```
2. Pastikan file error di `$OUT/logs/*.err` berukuran 0 byte.
3. Lakukan uji coba restore dump baru ke database PostgreSQL lokal sementara:
   ```bash
   # Buat database lokal temporer
   "$BIN/psql" -h 127.0.0.1 -p 54329 -U postgres -d postgres -c "DROP DATABASE IF EXISTS test_pre_restore; CREATE DATABASE test_pre_restore;"
   
   # Restore schema stubs lalu restore noowner.sql
   "$BIN/psql" -h 127.0.0.1 -p 54329 -U postgres -d test_pre_restore -v ON_ERROR_STOP=1 -f "supabase/00_bootstrap_local_stubs.sql"
   "$BIN/psql" -h 127.0.0.1 -p 54329 -U postgres -d test_pre_restore -v ON_ERROR_STOP=1 -f "$OUT/prod-public-private.noowner.sql"
   ```
   Jika restore lokal sukses tanpa error sintaks, backup dinyatakan teruji dan valid.

---

## 3. Pemasangan Halaman Maintenance (Vercel)

Sebelum DDL production dijalankan, akses publik ke aplikasi lama harus dialihkan ke halaman maintenance agar siswa atau guru tidak menemui error tak terduga.

### 3.1 Opsi A: Redirect via Edge Routing / Middleware Vercel (Rekomendasi Cepat)
Pada deployment v1 aktif di dashboard Vercel, pasang routing redirect atau aktifkan halaman statis.

Cara termudah tanpa build ulang adalah menambahkan rule rewrite di `vercel.json` deployment v1:
```json
{
  "rewrites": [
    {
      "source": "/((?!maintenance).*)",
      "destination": "/maintenance.html"
    }
  ]
}
```

### 3.2 Opsi B: Deploy Proyek Statis Minimal ke Domain Production
1. Siapkan folder kecil berisi file `index.html` statis bertema Smandapura dengan judul "Pemberitahuan Pemeliharaan Sistem":
   - Teks: "Aplikasi Ujian dan Kuis Smandapura sedang dalam peningkatan sistem (Fase 8). Akses akan dibuka kembali dalam waktu singkat. Terima kasih atas kesabarannya."
   - Status kode HTTP: 503 Service Unavailable.
2. Deploy halaman tersebut ke Vercel via CLI: `vercel deploy --prod`.
3. Domain `osn-smandapura.my.id` sementara melayani halaman pemeliharaan ini.

### 3.3 Cara Mematikan Halaman Maintenance
Setelah migrasi database selesai dan deployment v2 siap, arahkan domain production Vercel (`osn-smandapura.my.id`) langsung ke deployment v2 (Remake). Begitu dialihkan, halaman maintenance otomatis tertutup.

---

## 4. Urutan Migrasi dan Penanganan Risiko Lingkungan

Rincian lengkap dan perbandingan setiap file telah diuraikan pada dokumen pendamping: [`docs/deploy/fase8-migrations.md`](fase8-migrations.md).

### 4.1 File yang Dilarang Dijalankan ke Production
1. `supabase/00_bootstrap_local_stubs.sql`: Khusus Postgres vanilla lokal. Dilarang ke prod karena mengacaukan manajemen role dan sistem Supabase hosted.
2. Seluruh file `supabase/migrations/202606*.sql` (24 file): Sudah diterapkan di database production v1.

### 4.2 File yang Dijalankan ke Production (Urutan Wajib)
1. `20261022000000_remake_v2_phase1.sql` (Pemindahan skema legacy, pembuatan tabel v2, migrasi data lama, RLS dasar).
2. `20261022010000_phase3_quiz.sql` (RPC kuis live dan generator kode).
3. `20261022020000_phase4_race.sql` (Fix mount skin dan penghapusan policy public score leak).
4. `20261022030000_phase5_ujian.sql` (RPC Ujian Mandiri, Survival, dan pelaporan admin).
5. `20261022040000_phase6_auth.sql` (Tabel audit/login attempts, persetujuan admin, trigger keamanan).
6. `20261022041000_ujian_results_null_topics.sql` (Perbaikan penanganan topic_ids bernilai null).
7. `20261022042000_phase6_security_hardening.sql` (Hardening rate-limit email-only, constraint username, pembersihan fungsi v1).
8. `20261023000000_phase7_hardening.sql` (Hardening bucket exam-images: limit 2 MB, MIME whitelist, storage RLS terikat ke active admin).

### 4.3 Tindakan Pra-Migrasi: Penanganan Ekstensi dan Cron Job
Sebelum migrasi di atas dijalankan:
1. **Atasi Lokasi `pgcrypto`:**
   Di Supabase prod, `pgcrypto` berada di skema `extensions`. Agar fungsi `rpc_ujian_start` pada migrasi urutan 4 tidak gagal saat memanggil `public.digest`, jalankan SQL persiapan ini terlebih dahulu di production:
   ```sql
   -- Wrapper alias di public agar fungsi dengan search_path 'public' tetap menemukan fungsi pgcrypto
   CREATE OR REPLACE FUNCTION public.gen_random_bytes(integer) 
   RETURNS bytea LANGUAGE sql PARALLEL SAFE COST 1 AS $$ 
     SELECT extensions.gen_random_bytes($1); 
   $$;

   CREATE OR REPLACE FUNCTION public.digest(text, text) 
   RETURNS bytea LANGUAGE sql PARALLEL SAFE COST 1 AS $$ 
     SELECT extensions.digest($1, $2); 
   $$;
   ```
2. **Matikan Cron Job Lama:**
   Job pg_cron lama akan error jika tabelnya dipindahkan ke legacy. Nonaktifkan sementara:
   ```sql
   UPDATE cron.job SET active = false WHERE jobname IN (
     'auto_start_scheduled_quizzes',
     'purge_rate_limit_buckets',
     'refresh_daily_analytics',
     'activate-scheduled-exams',
     'close-expired-scheduled-exams'
   );
   ```

---

## 5. Prosedur Dry Run (Satu Transaksi dengan ROLLBACK)

Dry run dilakukan langsung pada database production di dalam satu transaksi terisolasi yang diakhiri dengan `ROLLBACK`. Hal ini menguji validitas DDL, kecocokan data, dan tes keamanan tanpa mengubah data asli secara permanen.

### 5.1 Catatan Penting Mengenai File Migrasi
Karena file migrasi individual memiliki perintah `BEGIN;` dan `COMMIT;`, jika file di-`\i` langsung dari psql, perintah `COMMIT;` di akhir file akan melakukan commit permanen.
Oleh karena itu, untuk dry run, buatlah file naskah gabungan bersih tanpa perintah `BEGIN;` dan `COMMIT;` per file, atau gunakan runner yang membungkus seluruh DDL dalam satu blok transaksi:

```bash
# Siapkan naskah dry-run bersih di scratch lokal
python -c "
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
out = open('docs/deploy/dryrun_payload.sql', 'w', encoding='utf-8')
out.write('-- Auto-generated single transaction dry run bundle\nBEGIN;\n')
for f in files:
    content = open(f, encoding='utf-8').read()
    # Hapus top-level BEGIN dan COMMIT mandiri
    lines = []
    for line in content.splitlines():
        trimmed = line.strip()
        if trimmed in ('BEGIN;', 'COMMIT;', 'BEGIN', 'COMMIT'):
            continue
        lines.append(line)
    out.write(f'\n-- >>> START: {f}\n' + '\n'.join(lines) + f'\n-- <<< END: {f}\n')

# Sisipkan query verifikasi dan ROLLBACK di akhir
verification_sql = open('docs/deploy/verify_queries.sql', encoding='utf-8').read()
out.write('\n' + verification_sql + '\nROLLBACK;\n')
out.close()
"
```

### 5.2 Naskah Query Verifikasi Data (verify_queries.sql)
Query ini dijalankan sebelum `ROLLBACK` untuk membandingkan jumlah baris dan spot-check integritas data:

```sql
-- 1. Verifikasi Jumlah Baris Tabel Utama v2 vs Target Inventory 2026-10-22
SELECT 
  'questions' AS entitas, 
  (SELECT count(*) FROM public.questions) AS baris_v2, 
  719 AS target_inventory,
  (SELECT count(*) FROM public.questions WHERE visibility = 'hidden') AS hidden_v2,
  188 AS target_hidden;

SELECT 
  'answers (kuis_results)' AS entitas,
  (SELECT count(*) FROM public.answers) AS baris_v2,
  1716 AS target_inventory;

SELECT 
  'players' AS entitas,
  (SELECT count(*) FROM public.players) AS baris_v2,
  61 AS target_inventory;

SELECT 
  'quizzes (kuis_logs)' AS entitas,
  (SELECT count(*) FROM public.quizzes) AS baris_v2,
  23 AS target_inventory;

SELECT 
  'exam_sessions' AS entitas,
  (SELECT count(*) FROM public.exam_sessions) AS baris_v2,
  (39 + 172) AS target_kombinasi_logs_dan_results;

SELECT 
  'admins' AS entitas,
  (SELECT count(*) FROM public.admins) AS baris_v2,
  (3 + 2) AS target_kombinasi_profiles_dan_requests;

-- 2. Verifikasi Keberadaan Tabel Legacy
SELECT table_name, (xpath('/row/cnt/text()', xml_count))[1]::text::int AS row_count
FROM (
  SELECT table_name, query_to_xml(format('select count(*) as cnt from legacy.%I', table_name), false, true, '') as xml_count
  FROM information_schema.tables
  WHERE table_schema = 'legacy'
) sub
ORDER BY table_name;

-- 3. Spot Check 20 Soal Acak: teks, kunci, dan status hidden harus sama persis
WITH sample_soal AS (
  SELECT id FROM legacy.questions ORDER BY hashint4(id) LIMIT 20
)
SELECT 
  l.id,
  (l.question_text = v.body_html) AS teks_cocok,
  (CASE 
     WHEN l.question_type = 'short_answer' THEN trim(l.short_answer) = v.answer_key
     ELSE l.correct_answer::text = v.answer_key 
   END) AS kunci_cocok,
  (CASE WHEN l.is_hidden THEN 'hidden' ELSE 'shown' END = v.visibility) AS visibilitas_cocok
FROM sample_soal s
JOIN legacy.questions l ON l.id = s.id
JOIN public.questions v ON v.id = s.id;

-- 4. Tes RLS Singkat Versi Aman Production (Simulasi Anon)
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role": "anon"}';

-- Anon dilarang membaca tabel questions secara langsung (harus return 0 atau ditolak RLS)
SELECT count(*) AS anon_direct_questions_visible FROM public.questions;
-- Anon hanya boleh membaca kategori yang shown
SELECT count(*) AS anon_hidden_topics_visible FROM public.topics WHERE visibility = 'hidden';

RESET ROLE;
```

### 5.3 Eksekusi Dry Run
Jalankan file dry run ke database production:
```bash
"$BIN/psql" -d "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f docs/deploy/dryrun_payload.sql > "$OUT/logs/dryrun.log" 2>&1
```

Periksa `$OUT/logs/dryrun.log`. Pastikan:
- Tidak ada error sintaks.
- Seluruh angka pada tabel hitungan cocok dengan target inventory.
- Ke-20 soal pada spot check menghasilkan `teks_cocok = true`, `kunci_cocok = true`, `visibilitas_cocok = true`.
- Nilai `anon_direct_questions_visible = 0` dan `anon_hidden_topics_visible = 0`.
- Di baris paling akhir tercetak `ROLLBACK`.

---

## 6. Eksekusi Asli Migrasi Production (Dengan COMMIT)

Setelah dry run diverifikasi sukses 100%, migrasi asli siap dieksekusi secara permanen.

### 6.1 Persiapan Naskah Eksekusi
Siapkan naskah migrasi final dengan struktur yang sama seperti dry-run, tetapi bagian akhirnya diakhiri dengan `COMMIT;`:

```bash
python -c "
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
out = open('docs/deploy/production_deploy_payload.sql', 'w', encoding='utf-8')
out.write('-- Smandapura Exam App v2 Final Migration\nBEGIN;\n')
for f in files:
    content = open(f, encoding='utf-8').read()
    lines = [line for line in content.splitlines() if line.strip() not in ('BEGIN;', 'COMMIT;', 'BEGIN', 'COMMIT')]
    out.write(f'\n-- >>> START: {f}\n' + '\n'.join(lines) + f'\n-- <<< END: {f}\n')

out.write('\nCOMMIT;\n')
out.close()
"
```

### 6.2 Eksekusi Single-Transaction
Jalankan naskah ke database production:
```bash
"$BIN/psql" -d "$PROD_DB_URL" --single-transaction -v ON_ERROR_STOP=1 -f docs/deploy/production_deploy_payload.sql > "$OUT/logs/production_migration.log" 2>&1
```

### 6.3 Verifikasi Pasca-Migrasi
Jalankan kembali query verifikasi (`docs/deploy/verify_queries.sql` tanpa blok transaksi) untuk mengonfirmasi bahwa seluruh tabel v2 dan skema `legacy` telah terisi di production secara permanen.

---

## 7. Rencana dan Prosedur Rollback

Jika terjadi kendala saat eksekusi, prosedur rollback dibagi menjadi dua skenario:

### 7.1 Skenario A: Kegagalan Sebelum COMMIT
Jika terjadi kegagalan (sintaks error, timeout, atau violation) saat eksekusi payload transaksi tunggal, PostgreSQL secara otomatis membatalkan seluruh operasi (`automatic rollback`). Database kembali bersih ke kondisi persis sebelum script dijalankan. Tidak ada aksi database yang diperlukan.

### 7.2 Skenario B: Masalah Ditemukan Setelah COMMIT
Jika migrasi database sudah di-commit namun ditemukan masalah kritis pasca-deploy (misalnya bug fatal yang tidak tertangkap):

1. **Restore Skema Public dan Private dari Dump Langkah 2:**
   Jalankan restore dari file backup point-in-time yang diambil sesaat sebelum migrasi:
   ```bash
   # Masuk ke psql production untuk membersihkan skema yang terkontaminasi
   "$BIN/psql" -d "$PROD_DB_URL" -v ON_ERROR_STOP=1 -c "
     DROP SCHEMA IF EXISTS public CASCADE; 
     DROP SCHEMA IF EXISTS legacy CASCADE; 
     CREATE SCHEMA public; 
     GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
   "

   # Restore objek schema public dan private dari backup
   "$BIN/pg_restore" -d "$PROD_DB_URL" --clean --if-exists -Fc "$OUT/prod-public-private.full.dump"
   ```
2. **Kembalikan Status Cron Job:**
   Aktifkan kembali job `cron.job` versi lama:
   ```sql
   UPDATE cron.job SET active = true WHERE jobname IN (
     'auto_start_scheduled_quizzes',
     'purge_rate_limit_buckets',
     'refresh_daily_analytics',
     'activate-scheduled-exams',
     'close-expired-scheduled-exams'
   );
   ```
3. **Rollback Vercel Deployment:**
   - Di dashboard Vercel (atau via CLI `vercel rollback`), pilih deployment v1 sebelumnya dan lakukan **Instant Promote**.
   - Trafik publik instan kembali ke versi v1 yang kompatibel dengan database yang di-restore.
4. **Dampak Data:**
   Sesi atau jawaban baru yang dibuat selama rentang waktu singkat antara COMMIT dan Rollback akan hilang. Oleh karena itu, putusan rollback harus diambil secepat mungkin pada fase smoke test.

---

## 8. Variabel Lingkungan Vercel v2

Daftar nama variabel lingkungan yang harus dikonfigurasi di dashboard Vercel untuk proyek Exam App v2:

| Nama Variabel | Scope | Tipe Akses | Keterangan |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | Public (Browser & Server) | URL API Supabase production (`https://tzjecohkqygpkhvulzwz.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Public (Browser & Server) | Public anon token Supabase production. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | **Server-Only (Secret)** | Kunci rahasia service role untuk server action dan API route. JANGAN centang browser/client exposure. |
| `NODE_ENV` | Otomatis diatur Vercel | System | Otomatis bernilai `production`. |

### Variabel Lingkungan Versi Lama yang Wajib DIHAPUS dari Vercel:
1. `EXAM_SECRET_KEY`: **HAPUS.** Digunakan pada v1 untuk salt enkripsi simetris global dan header RPC. Pada v2, rahasia sesi di-generate per sesi via kriptografi dan di-hash SHA-256 di database (`exam_sessions.secret_hash`).
2. `ADMIN_EMAIL`: **HAPUS.** Digunakan pada v1 untuk akun statis tunggal. Pada v2, manajemen admin dinamis melalui tabel `admins` dan Supabase Auth.
3. `DATABASE_URL`: **HAPUS jika ada.** Aplikasi Next.js v2 berkomunikasi sepenuhnya melalui API Supabase (`@supabase/ssr` dan `@supabase/supabase-js`), tidak memerlukan direct connection pooler di Vercel.

*Catatan Keamanan:* Pastikan `SUPABASE_SERVICE_ROLE_KEY` dirotasi atau diverifikasi ulang kecocokannya dengan dashboard Supabase production sebelum deployment live.

---

## 9. Penanganan Sinkronisasi Kuis: SSE Lokal vs Supabase Realtime

Pada PRD poin KL-06 dinyatakan: *"Jawaban per pemain diperbarui realtime lewat Supabase Realtime."* Namun dalam implementasi v2 yang telah lolos uji E2E (Fase 3 & Fase 4), mekanisme sinkronisasi dibangun menggunakan Server-Sent Events (SSE) dan fallback Polling.

### 9.1 Arsitektur Saat Ini (SSE + Polling di Server Route)
- **Implementasi:** Endpoint `/api/quiz/[code]/stream` (SSE via `ReadableStream` interval 1,5 detik) dan fallback polling ke `/api/quiz/[code]/state` setiap 2 detik jika stream terputus.
- **Keunggulan:**
  - Masking skor untuk penonton publik (mode standard) dijamin aman di level server (`getQuizStreamState`).
  - Mengabaikan keterbatasan RLS langsung pada tabel `players` yang sebelumnya dicabut demi alasan keamanan.
  - Telah teruji tangguh pada simulasi E2E 1 admin + 5 siswa.
- **Keterbatasan di Vercel:**
  - Vercel Serverless Function memiliki batas durasi eksekusi maksimum (`maxDuration`: Hobby 60 detik, Pro hingga 300 detik). Koneksi SSE akan tertutup setiap interval tersebut, menyebabkan client melakukan rekoneksi berulang atau beralih ke polling.
  - Untuk 40 pemain konkuren, 40 koneksi serverless yang aktif bersamaan menghasilkan beban function invocations di Vercel.

### 9.2 Arsitektur Supabase Realtime Murni
- **Kebutuhan Perubahan:**
  1. Menambahkan tabel ke publication:
     ```sql
     ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes, public.players;
     ```
  2. Masalah RLS Realtime: Pada Fase 4, policy `public_select_players` dihapus agar skor siswa di mode standard tidak bocor via PostgREST. Supabase Realtime mematuhi RLS. Jika anon tidak memiliki hak SELECT pada tabel `players`, Realtime tidak akan mengirimkan event perubahan ke siswa. Mengembalikan policy SELECT anon berisiko membocorkan skor mentah sebelum kuis selesai.
  3. Mengubah kode `useQuizLive.ts` dari `EventSource` menjadi `supabase.channel()`.

### 9.3 Rekomendasi Teknis dan Keputusan Dani
- **Rekomendasi:** Pertahankan arsitektur **SSE + Polling** untuk peluncuran Fase 8. Hook `useQuizLive` sudah memiliki mekanisme penanganan putus koneksi yang mulus (otomatis polling jika SSE terputus dan otomatis reconnect). Beban 40 pemain selama durasi kuis 15 sampai 30 menit masih berada dalam batas wajar serverless Vercel.
- **KEPUTUSAN DANI:** Dani memutuskan apakah tetap menggunakan SSE+Polling teruji atau melakukan refactoring ke Supabase Realtime broadcast channel sebelum migrasi production.

---

## 10. Konfigurasi Dashboard Supabase Production yang Dicek dan Diset

Lakukan pengecekan konfigurasi berikut di dashboard Supabase (`https://supabase.com/dashboard/project/tzjecohkqygpkhvulzwz`):

1. **Autentikasi (Authentication -> Providers -> Email & Settings):**
   - **Anonymous Sign-ins:** Wajib diaktifkan (**ON**). Siswa masuk ke kuis live dan ujian mandiri melalui autentikasi anonim (`auth.signInAnonymously()`).
   - **Enable Email Confirmations:** Pastikan pengaturan sesuai alur (jika admin baru harus konfirmasi email sebelum direview super admin, set ON).
   - **Rate Limiting:** Pastikan rate limiting autentikasi bawaan Supabase aktif untuk memitigasi serangan brute-force.
   - **Site URL & Redirect URLs:**
     - Site URL: `https://osn-smandapura.my.id`
     - Additional Redirect URLs: `https://osn-smandapura.my.id/**`
2. **Storage Bucket `exam-images` (Storage -> Buckets -> exam-images):**
   - **Public Bucket:** Wajib **Public** (`true`) agar gambar soal dapat dimuat langsung di browser siswa.
   - **File Size Limit:** Atur maksimal **2 MB** (2.097.152 bytes) sesuai PRD BS-07.
   - **Allowed MIME Types:** Batasi hanya `image/png`, `image/jpeg`, `image/webp`, `image/gif`. **Dilarang memasukkan `image/svg+xml`** untuk mencegah stored XSS via SVG upload.
   - **Perbarui Policy Storage:** Jalankan SQL agar upload gambar admin diizinkan menggunakan status admin v2:
     ```sql
     CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid()) 
     RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
       SELECT EXISTS (
         SELECT 1 FROM public.admins WHERE user_id = p_user_id AND status = 'active'
       );
     $$;
     ```
3. **Pengaturan Cron Job Baru (`pg_cron`):**
   Jadwalkan cron job pengganti untuk operasional v2:
   ```sql
   -- KL-05: Auto start kuis live terjadwal yang sudah waktunya (tidak menghapus kuis kosong, hanya tandai cancelled)
   SELECT cron.schedule(
     'auto_start_scheduled_quizzes_v2',
     '* * * * *',
     $$
     UPDATE public.quizzes
     SET status = CASE 
           WHEN (SELECT count(*) FROM public.players WHERE quiz_id = quizzes.id) > 0 THEN 'active'
           ELSE 'cancelled'
         END,
         started_at = CASE 
           WHEN (SELECT count(*) FROM public.players WHERE quiz_id = quizzes.id) > 0 THEN now() 
           ELSE started_at 
         END,
         expires_at = CASE 
           WHEN (SELECT count(*) FROM public.players WHERE quiz_id = quizzes.id) > 0 
           THEN now() + ((coalesce(config->>'duration_minutes', '15'))::integer * interval '1 minute')
           ELSE expires_at 
         END
     WHERE status = 'waiting'
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= now();
     $$
   );

   -- Pembersihan log percobaan login admin yang berusia lebih dari 7 hari
   SELECT cron.schedule(
     'purge_admin_login_attempts_v2',
     '15 2 * * *',
     $$DELETE FROM public.admin_login_attempts WHERE attempted_at < now() - interval '7 days';$$
   );

   -- Sweeper sesi ujian mandiri yang expired
   SELECT cron.schedule(
     'sweep_expired_exam_sessions',
     '*/5 * * * *',
     $$UPDATE public.exam_sessions SET status = 'expired' WHERE status = 'active' AND expires_at < now();$$
   );
   ```

---

## 11. Deployment Aplikasi Next.js dan Smoke Test

### 11.1 Deployment ke Vercel
1. Pastikan branch `remake/v2` sudah bersih dan seluruh commit Fase 1 sampai 7 telah digabung.
2. Build command di Vercel: `next build` (atau `npm run build`).
3. Konfigurasi Root Directory: Proyek root.
4. Output Directory: `.next`.
5. Hubungkan domain `osn-smandapura.my.id`.
6. Header keamanan telah didefinisikan secara native pada `next.config.ts`:
   - `Content-Security-Policy` (CSP dengan perlindungan frame-ancestors none, object-src none, script-src aman).
   - `X-Frame-Options: DENY`.
   - `X-Content-Type-Options: nosniff`.
   - `Referrer-Policy: strict-origin-when-cross-origin`.
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), screen-wake-lock=(self)`.
   - `Strict-Transport-Security: max-age=15552000`.

### 11.2 Checklist Smoke Test Pasca Deploy (Wajib Diuji Langsung)
Segera setelah deployment aktif di `https://osn-smandapura.my.id`:

- [ ] **Navigasi Halaman Utama:** Buka `https://osn-smandapura.my.id`. Pastikan form gabung kuis dan menu ujian mandiri muncul rapi tanpa error visual.
- [ ] **Login Admin:**
  - Buka `/admin/login`. Login menggunakan akun super admin production yang sudah dimigrasi.
  - Pastikan dashboard `/admin` terbuka dan tab navigasi berfungsi.
- [ ] **Simulasi Kuis Live (2 HP Siswa):**
  - Buat kuis live baru dari dashboard admin. Dapatkan kode kuis 6 digit.
  - Buka 2 browser/ponsel berbeda sebagai siswa, masukkan kode dan nama.
  - Pastikan ruang tunggu menampilkan hewan tunggangan yang berbeda.
  - Admin menekan Mulai. Pastikan soal muncul di kedua ponsel.
  - Jawab soal di kedua ponsel, periksa animasi balapan di layar Race View admin.
  - Selesaikan kuis, periksa keakuratan urutan di leaderboard.
- [ ] **Ujian Mandiri (Exam & Survival):**
  - Masuk ke menu Ujian Mandiri di browser siswa.
  - Jalankan 1 sesi Exam singkat (3 sampai 5 soal): jawab, tandai ragu-ragu, refresh browser (pastikan sesi pulih di soal yang sama), submit, dan periksa halaman skor.
  - Jalankan 1 sesi Survival: pastikan jawaban salah mengurangi nyawa (-1 nyawa) dan popup animasi muncul.
- [ ] **Inspeksi Keamanan Payload (DevTools Network):**
  - Periksa respons network saat mengambil soal (`rpc_get_quiz_question` atau `rpc_ujian_question`). Pastikan **TIDAK ADA** string `answer_key` maupun `explanation_html`.
  - Pastikan soal dengan status `hidden` tidak muncul di pilihan ujian mandiri siswa.
- [ ] **Verifikasi Gambar Soal:**
  - Buka soal lama yang memiliki gambar (contoh soal bergambar dari backup). Pastikan gambar ter-render sempurna dari CDN Supabase `exam-images`.
- [ ] **Verifikasi Header Keamanan via Curl:**
  ```bash
  curl -I https://osn-smandapura.my.id
  ```
  Pastikan header `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, dan `Content-Security-Policy` muncul di output response header.

### 11.3 Pemantauan 24 Jam Pasca-Deploy
1. Pantau tab Log di dashboard Vercel untuk mendeteksi lonjakan status HTTP 500 atau function timeout.
2. Pantau database metrics di dashboard Supabase (Database CPU, RAM, Connection Pool usage, and Replication Lag).
3. Pantau tabel `public.admin_login_attempts` untuk melihat apakah ada false positive lockout pada guru/admin.

---

## 12. Keputusan yang Dibutuhkan dari Dani Sebelum Eksekusi

Sebelum eksekusi Fase 8 dijadwalkan, DevBot dan tim membutuhkan konfirmasi tertulis dari Dani untuk poin-poin berikut:

1. **Jadwal Eksekusi Migrasi:**
   - Kepastian tanggal dan jam maintenance window yang disetujui (misal: Sabtu malam pukul 23:30 WITA).
2. **Kredensial Production di `.env.local`:**
   - Dani menginput string koneksi database direct/session pooler Supabase production dan `SUPABASE_SERVICE_ROLE_KEY` ke `.env.local` lokal secara mandiri tanpa membagikannya di chat.
3. **Keputusan Mekanisme Realtime Kuis:**
   - Konfirmasi persetujuan untuk mempertahankan arsitektur **SSE + Polling** yang sudah teruji di E2E, atau arahan bila ingin dirombak ke Supabase Realtime broadcast.
4. **Kebijakan Pendaftaran Admin Baru:**
   - Menentukan apakah pendaftaran admin baru (`/admin/register`) mewajibkan konfirmasi link email atau cukup persetujuan manual (approval) oleh Super Admin di halaman `/admin/kelola-admin`.
5. **Persetujuan Hapus Data Sesi Lama Tertentu:**
   - Mengonfirmasi bahwa tabel-tabel lama di skema `legacy` hanya berstatus read-only arsip dan siap dibersihkan (drop legacy) pada Fase 9 di masa mendatang jika sistem v2 telah stabil selama 30 hari.
