# Daftar Migrasi Database Fase 8: Remake Exam App v2

Dokumen ini memetakan seluruh file SQL di folder `supabase/migrations/` dan file bootstrap lokal. Tujuannya adalah memastikan eksekusi migrasi ke production Supabase (PostgreSQL 17.6) berjalan teratur, aman, tanpa duplikasi, dan bebas dari asumsi lingkungan lokal yang berisiko merusak sistem production.

---

## 1. Ringkasan Klasifikasi Migrasi

| Kategori | Jumlah File | Tindakan ke Production |
| --- | :---: | --- |
| Migrasi v1 Lama (2026-06) | 24 file | **JANGAN DIJALANKAN ULANG** (Sudah ada di production). |
| Bootstrap Stubs Lokal | 1 file | **DILARANG KE PRODUCTION** (Khusus Docker / Postgres lokal vanilla). |
| Migrasi v2 Remake (2026-10) | 8 file | **WAJIB DIJALANKAN KE PRODUCTION** (Sesuai urutan dependensi). |

---

## 2. Tabel Detail Seluruh Migrasi

### 2.1 Migrasi v1 Lama (Juni 2026) - Sudah Ada di Production

Seluruh migrasi ini telah diterapkan pada skema production v1 sebelum backup 2026-10-22 diambil. Keberadaannya telah diverifikasi dari objek tabel, kolom, view, dan fungsi pada file backup `E:/Backups/exam-app/prod-2026-10-22/prod-public-private.full.sql`. 

Menjalankan ulang file-file ini ke production berisiko menimbulkan error duplicate column, duplicate index, atau menimpa objek yang pada Fase 1 v2 akan dipindahkan ke skema `legacy`.

| Nama File | Isi Ringkas | Ke Prod? | Status & Alasan / Risiko |
| --- | --- | :---: | --- |
| `20260613_short_answer_whitespace_insensitive.sql` | Penilaian isian singkat toleran spasi | **TIDAK** | Sudah ada di prod. Menimpa fungsi lama yang akan digantikan RPC v2. |
| `20260615_scheduled_exam_nav_mode_percentages.sql` | Kolom `nav_mode` dan persentase sub-bab pada `scheduled_exams` | **TIDAK** | Sudah ada di prod. Kolom sudah ada di `public.scheduled_exams`. |
| `20260615_scheduled_exam_window_time_limit.sql` | Penjadwalan ujian, RLS attempts, fungsi publish/seal | **TIDAK** | Sudah ada di prod. Tabel dan RLS sudah ada di prod. |
| `20260616_category_distinct_rpc_and_indexes.sql` | Index GIN babs/mapels dan RPC distinct kategori | **TIDAK** | Sudah ada di prod. Index GIN sudah aktif di prod. |
| `20260616_finalize_scheduled_exam.sql` | Tambah kolom `recap jsonb` pada `scheduled_exam_attempts` | **TIDAK** | Sudah ada di prod. Kolom `recap` sudah terbukti ada di dump. |
| `20260616_fix_start_exam_session_overload_ambiguity.sql` | Drop fungsi overload `start_exam_session` | **TIDAK** | Sudah ada di prod. Fungsi duplikat sudah dibersihkan di prod. |
| `20260616_fix_sweeper_overload.sql` | Update fungsi sweeper `submit_session_exam` | **TIDAK** | Sudah ada di prod. |
| `20260616_performance_compatibility.sql` | Optimasi RPC finalize scheduled exam | **TIDAK** | Sudah ada di prod. |
| `20260616_refactor_scheduled_exam_storage.sql` | Kolom `question_ids` dan `user_answers` pada attempts | **TIDAK** | Sudah ada di prod. |
| `20260616_refactor_scheduled_exam_storage_v2.sql` | Kolom `saving` pada attempts | **TIDAK** | Sudah ada di prod. |
| `20260616_scheduled_exam_enforce_status_rpc.sql` | Validasi status pada start scheduled exam | **TIDAK** | Sudah ada di prod. |
| `20260616_scheduled_exam_fix_question_pool.sql` | Fix pool soal ujian terjadwal | **TIDAK** | Sudah ada di prod. |
| `20260616_scheduled_exam_question_pool.sql` | Snapshot `question_ids` pada `scheduled_exams` | **TIDAK** | Sudah ada di prod. |
| `20260616_scheduled_exam_status_active_scheduled_expired.sql` | Status baru ujian terjadwal dan fungsi sweeper | **TIDAK** | Sudah ada di prod. |
| `20260616_scheduled_exam_status_rename.sql` | Rename status ujian | **TIDAK** | Sudah ada di prod. |
| `20260616_submit_seals_scheduled_attempt.sql` | Seal attempt otomatis saat submit | **TIDAK** | Sudah ada di prod. |
| `20260616_submit_session_exam_add_recap.sql` | Penulisan recap JSONB saat submit | **TIDAK** | Sudah ada di prod. |
| `20260616_update_rpcs_for_question_ids.sql` | Update save/submit untuk question_ids array | **TIDAK** | Sudah ada di prod. |
| `20260616_update_scheduled_exam_rpcs.sql` | Update start scheduled exam | **TIDAK** | Sudah ada di prod. |
| `20260617_add_missing_recap_column.sql` | Ensure recap column exists | **TIDAK** | Sudah ada di prod. |
| `20260617_cron_recap_criticals_fix.sql` | Perbaikan sweeper cron untuk recap | **TIDAK** | Sudah ada di prod. Job cron 6 dan 8 sudah memakainya di prod. |
| `20260617_get_server_now_helper.sql` | Helper `public.get_server_now()` | **TIDAK** | Sudah ada di prod. |
| `20260617_revert_view_security_invoker.sql` | Revert view invoker ke definer | **TIDAK** | Sudah ada di prod. View lama ini akan di-drop pada Fase 1 v2. |

Cara verifikasi kepastian bahwa migrasi 202606* sudah ada di production:
Jalankan query read-only berikut di psql production:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'scheduled_exams' 
  AND column_name IN ('nav_mode', 'question_ids', 'sub_bab_percentages');
```
Jika ketiga kolom muncul (3 baris), dipastikan skema lama sudah lengkap dan migrasi 202606* tidak boleh dijalankan ulang.

---

### 2.2 Skrip Khusus Lokal (TIDAK BOLEH KE PROD)

| Nama File | Isi Ringkas | Ke Prod? | Risiko Fatal Jika Dijalankan ke Prod |
| --- | --- | :---: | --- |
| `supabase/00_bootstrap_local_stubs.sql` | Stub roles (`anon`, `authenticated`, `service_role`, `authenticator`, `supabase_admin`), stub schemas (`auth`, `storage`, `cron`), stub tables (`auth.users`, `storage.buckets`, `cron.job`), stub auth functions (`auth.uid()`, dll). | **DILARANG KERAS** | Merusak internal platform Supabase hosted. Supabase hosted mengelola role, skema auth, dan storage secara native pada infrastruktur managed. Script ini akan gagal karena permission denied pada role superuser atau membuat duplikasi skema sistem yang merusak otentikasi Supabase. |

---

### 2.3 Daftar Migrasi v2 Remake (WAJIB DIJALANKAN KE PROD SECARA URUT)

Tujuh file migrasi berikut harus dijalankan secara berurutan dalam satu transaksi atomik.

| No | Nama File | Isi Ringkas | Ke Prod? | Alasan & Risiko Teknis yang Ditandai |
| :-: | --- | --- | :---: | --- |
| 1 | `20261022000000_remake_v2_phase1.sql` | 1. Helper `normalize_slug`, `strip_html`.<br>2. Pindahkan 15 objek lama ke skema `legacy`.<br>3. Drop 5 view lama di public.<br>4. Buat skema v2: `admins`, `subjects`, `chapters`, `topics`, `questions`, `question_topics`, `quizzes`, `quiz_questions`, `players`, `answers`, `exam_sessions`, `exam_answers`.<br>5. Migrasi data lama ke struktur baru (719 soal ID dipertahankan, hirarki kategori, 61 player, 1.716 jawaban kuis, sesi ujian).<br>6. RLS v2 dan RPC siswa dasar. | **YA (Urutan 1)** | **Fondasi utama v2.**<br>Risiko:<br>- File memiliki statement `BEGIN;` dan `COMMIT;`. Jika digabung dalam wrapper script dry-run, perhatikan transaksi bersarang.<br>- Memindahkan `daily_analytics` (materialized view) ke `legacy`. Pastikan cron job lama yang me-refresh `public.daily_analytics` segera dimatikan.<br>- Sequence `questions_id_seq` harus di-set valuenya ke nilai max ID yang termigrasi agar penambahan soal baru tidak duplikat ID. |
| 2 | `20261022010000_phase3_quiz.sql` | 1. Helper generator kode kuis 6 digit (`fn_generate_quiz_code`).<br>2. RPC `rpc_create_quiz` untuk admin.<br>3. RPC `rpc_admin_update_quiz_status` (siklus hidup kuis KL-04).<br>4. Update `rpc_join_live_quiz` dengan penugasan otomatis 12 hewan tunggangan (RV-04, KL-11). | **YA (Urutan 2)** | **Kuis Live v2.**<br>Risiko:<br>- Menggantikan implementasi `rpc_join_live_quiz` dari phase 1 dengan logika 12 preset mount baru. |
| 3 | `20261022020000_phase4_race.sql` | 1. Update `rpc_set_player_skin` untuk menerima format `preset:mount`.<br>2. Hapus policy `public_select_players` pada `public.players` untuk mencegah bocornya skor siswa di mode standard via PostgREST langsung.<br>3. Revoke hak eksekusi RPC admin kuis dari anon/authenticated dan grant eksklusif ke `service_role`. | **YA (Urutan 3)** | **Race View & Hardening Skor.**<br>Risiko:<br>- Membatasi akses langsung client ke tabel `players`. Seluruh sinkronisasi kuis live beralih melalui server service_role (`/api/quiz/[code]/state` dan `stream`). |
| 4 | `20261022030000_phase5_ujian.sql` | 1. Tambah kolom `end_reason` dan `violation_count` pada `public.exam_sessions`.<br>2. RPC Ujian Mandiri lengkap (`rpc_ujian_start`, `rpc_ujian_state`, `rpc_ujian_question`, `rpc_ujian_save`, `rpc_ujian_violation`, `rpc_ujian_finish`, `rpc_ujian_recap`).<br>3. Admin reporting RPC (`rpc_admin_ujian_results`, `rpc_admin_ujian_detail`).<br>4. Helper verifikasi rahasia kriptografi (`fn_verify_exam_session`).<br>5. Revoke RPC ujian lama dan lock RPC ujian v2 ke `service_role`. | **YA (Urutan 4)** | **Ujian Mandiri & Survival v2.**<br>Risiko Asumsi Lokal:<br>- Menggunakan `public.gen_random_bytes(32)` dan `public.digest(...)`. Pada Supabase hosted, ekstensi `pgcrypto` berada di skema `extensions`, bukan `public`. Saat fungsi berjalan dengan `SET search_path TO 'public'`, pemanggilan `public.digest` bisa gagal jika tidak ada fungsi alias atau search_path tidak memuat `extensions`. *(Lihat Catatan Kritis Lingkungan di bawah)*. |
| 5 | `20261022040000_phase6_auth.sql` | 1. Buat tabel `public.admin_login_attempts` dan `public.admin_audit`.<br>2. Trigger proteksi super admin (`trg_keep_one_super_admin`) dan audit perubahan status admin (`trg_audit_admin_change`).<br>3. RPC pembatasan percobaan login (`check_admin_login_allowed`, `record_admin_login_attempt`).<br>4. RPC persetujuan admin (`rpc_approve_admin_request`, dll).<br>5. Grant dan revoke akses ke `service_role` dan `authenticated`. | **YA (Urutan 5)** | **Autentikasi Admin & RBAC.**<br>Risiko:<br>- Tabel `public.admin_login_attempts` dibuat ulang di public (versi lama sudah ada di `legacy`). |
| 6 | `20261022041000_ujian_results_null_topics.sql` | Perbaikan `rpc_admin_ujian_results` dan `rpc_admin_ujian_detail` agar tahan terhadap sesi dengan metadata `topic_ids` bernilai `null` (mencegah error unnest scalar JSON). | **YA (Urutan 6)** | **Hotfix Pelaporan Admin.**<br>Risiko: Rendah. Menimpa definisi RPC reporting dari migrasi urutan 4 dengan versi yang aman. |
| 7 | `20261022042000_phase6_security_hardening.sql` | 1. Hardening pembatasan login per identifier email (AU-04), melepaskan dependensi IP agar tidak mengunci NAT sekolah.<br>2. Constraint format username admin regex `^[a-z0-9_.]{3,32}$`.<br>3. Drop policy `user_create_signup` (registrasi diarahkan lewat server service_role).<br>4. Drop fungsi yatim v1 yang merujuk tabel lama yang sudah dipindah (`resolve_admin_login_email`, `log_admin_action`, `get_player_question_ids_admin`). | **YA (Urutan 7)** | **Hardening Keamanan Akhir.**<br>Risiko: Sangat aman. Membersihkan celah registrasi langsung via REST dan menghapus fungsi v1 yang usang. |
| 8 | `20261023000000_phase7_hardening.sql` | 1. Konfigurasi bucket `exam-images` (2 MB, allowed MIME types: png, jpeg, webp, gif tanpa svg).<br>2. Hapus policy storage lama ("Public Read Access", `exam_images_staff_*`).<br>3. Buat policy storage baru berbasis `public.check_is_active_admin()` dan pembatasan `bucket_id = 'exam-images'`. | **YA (Urutan 8)** | **Hardening Storage Bucket (BS-07).**<br>Risiko Asumsi Lingkungan:<br>- Menghapus policy "Public Read Access" global dan menggantikannya dengan policy read khusus bucket `exam-images`. Di prod, hanya ada 1 bucket (`exam-images`), sehingga aman.<br>- Statement dijalankan pada skema `storage` yang dimiliki oleh role `supabase_storage_admin`. Eksekusi via psql menggunakan user `postgres` memiliki hak yang cukup untuk membuat policy. |

---

## 3. Analisis Asumsi Lingkungan Lokal vs Supabase Production

Saat meninjau migrasi di atas, ditemukan beberapa perbedaan arsitektur antara stack lokal (`00_bootstrap_local_stubs.sql` pada Postgres vanilla 17) dengan Supabase Hosted Production (PostgreSQL 17.6 managed):

1. **Lokasi Ekstensi `pgcrypto`:**
   - Pada database lokal, ekstensi dipasang di skema `public`.
   - Pada Supabase hosted production, ekstensi `pgcrypto` dipasang di skema `extensions`.
   - **Tindakan Pencegahan:** Sebelum migrasi urutan 4 dijalankan ke production, pastikan fungsi `digest` dan `gen_random_bytes` dapat diakses dari search_path fungsi, atau sediakan wrapper di `public` yang merujuk ke `extensions.digest` dan `extensions.gen_random_bytes`.
2. **Top-level `BEGIN;` dan `COMMIT;` di File Migrasi:**
   - Lima dari tujuh file migrasi v2 memiliki blok `BEGIN;` dan `COMMIT;` di dalamnya.
   - Jika dijalankan dengan perintah `psql \i` di dalam sesi transaksi manual (misal saat dry-run), perintah `COMMIT;` internal akan mengakhiri transaksi lebih awal, sehingga perintah `ROLLBACK;` di akhir script tidak akan membatalkan perubahan yang sudah ter-commit.
   - **Tindakan Pencegahan:** Dalam prosedur dry-run, seluruh isi migrasi harus dieksekusi sebagai satu naskah transaksi tunggal tanpa internal `COMMIT` per file.
3. **Role dan Permissions:**
   - Role `service_role`, `authenticated`, dan `anon` sudah ada secara native di Supabase hosted.
   - Statement `GRANT ... TO service_role` dan `REVOKE ... FROM PUBLIC, anon, authenticated` aman dan wajib dijalankan di production untuk mengunci endpoint API.
4. **Kebijakan Storage Bucket `exam-images`:**
   - Kebijakan upload storage lama di production menggunakan fungsi `public.is_admin()`.
   - Fungsi `public.is_admin()` lama merujuk ke tabel `public.admin_profiles` yang dipindahkan ke `legacy`.
   - Diperlukan penyesuaian fungsi `public.is_admin()` agar memeriksa tabel baru `public.admins` (`WHERE status = 'active'`) agar admin v2 tetap dapat mengunggah gambar soal ke bucket.
5. **Job `pg_cron` Eksisting:**
   - Ada 6 cron job lama di production. Job-job yang merujuk ke `kuis_logs`, `player`, `rate_limit_buckets`, `daily_analytics`, `scheduled_exams`, dan `scheduled_exam_attempts` akan langsung error begitu tabel dipindahkan ke `legacy`.
   - Job-job lama ini wajib dimatikan sebelum migrasi dimulai.
