# 🎓 Smandapura Exam App

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-blue?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

Platform ujian online modern dengan estetika desain **Nike-Inspired** yang clean dan atletis. Dibangun dengan Next.js 15 dan Supabase sebagai backend real-time untuk manajemen soal, sesi ujian, dan hasil ujian yang aman.

---

## 🚀 Fitur Utama

### 👤 Fitur Pengguna (Peserta)
*   **Registrasi Instan**: Sistem pendaftaran nama cepat sebelum memulai ujian.
*   **Kustomisasi Ujian**: Pilih mode permainan (Exam atau Survival), kategori soal, dan jumlah soal.
*   **Survival Mode**: Mode tantangan ekstrim dengan sistem 3-Nyawa (Lives). Jawaban salah langsung mengurangi nyawa — habis, game over.
*   **Global Timer (Server-Side)**:
    *   Pilihan batas waktu: 30, 60, 90, 120 menit, atau **No Time**.
    *   Timer dihitung dari server (`expires_at`), tidak bisa dimanipulasi client.
    *   Ujian otomatis berakhir dan auto-submit saat waktu habis.
    *   Timer tersembunyi saat memilih **No Time**.
*   **Zero-Trust Security (ANTI-HACK)**:
    *   **JIT Question Fetching**: Soal diambil dari server **satu per satu** (Just-In-Time). Tidak ada soal masa depan di browser.
    *   **Encrypted Storage**: Data lokal di-enkripsi (**AES-256**) dan diverifikasi (**HMAC-SHA256**).
    *   **Obfuscated Keys**: Nama storage key di-hash (SHA256).
    *   **Server-Side Authority**: Kalkulasi skor, nyawa, dan validasi jawaban dilakukan di database (Supabase RPC).
    *   **Row Level Security (RLS)**: Tabel `questions` dilindungi RLS. Client hanya bisa mengakses view `public_questions` yang menyembunyikan `correct_answer`.
*   **Session Persistence**: Sinkronisasi status otomatis dari database setelah *page reload*. Score, lives, current question, dan mode permainan tetap utuh.
*   **Auto-Cleanup**: Pembersihan otomatis sesi ujian kadaluarsa (>2 hari).
*   **Laporan Skor Terperinci**: Hasil pengerjaan instan tanpa kebocoran kunci jawaban.
*   **Layout Stability**: `scrollbar-gutter: stable` mencegah layout shift saat scrollbar muncul/hilang.

### 🎮 Fitur Live Quiz (Kuis Real-Time)
*   **Lobby System**: Admin membuat sesi kuis dengan kode 8-character. Peserta bergabung via kode.
*   **Waiting Room**: Peserta menunggu di ruang tunggu sampai admin memulai kuis.
*   **Per-User Randomization**: Urutan soal dan opsi jawaban diacak unik per peserta (server-side via `array_agg(ORDER BY random())`).
*   **JIT Question Delivery**: Soal dikirim satu per satu melalui RPC. Tidak ada bulk fetching.
*   **Server-Side Scoring**: Jawaban divalidasi di server menggunakan regex-based key matching (`strip_html` + normalisasi). Client tidak bisa memanipulasi skor.
*   **Pause/Resume**: Admin dapat menjeda dan melanjutkan kuis. Timer peserta disesuaikan otomatis.
*   **Auto-Finish**: Kuis otomatis berakhir saat waktu habis. Peserta langsung diarahkan ke leaderboard.
*   **Live Leaderboard**: Papan skor real-time dengan sinkronisasi Supabase Realtime.
*   **Session Recovery**: Peserta yang kehilangan koneksi dapat kembali ke sesi yang sama.
*   **Anti-Cheat**: Semua operasi melalui `SECURITY DEFINER` RPC. Kolom `question_ids` dan `correct_answer` tidak bisa diakses oleh anonymous users.

### 🔐 Fitur Admin (Dashboard)
*   **Autentikasi Admin**: Login menggunakan Supabase Auth untuk akses dashboard.
*   **Dashboard Hasil Berhalaman**: Manajemen hasil ujian dengan paginasi (20 item per halaman).
*   **Manajemen Hasil & Mode**: Filter interaktif untuk memisahkan hasil mode *Exam* dan *Survival*.
*   **Analitik Waktu Pengerjaan**: Kolom Start Time, End Time, dan Durasi setiap peserta.
*   **Track Live Progress**: Modal real-time untuk memantau progress peserta aktif — pertanyaan yang sedang dijawab, histori jawaban, dan indikator jawaban benar/salah.
*   **History Page**: Halaman riwayat ujian yang telah selesai dengan tombol **View Details** untuk inspeksi jawaban per soal.
*   **Smart Search**: Search bar dinamis untuk memfilter soal berdasarkan kategori atau potongan teks.
*   **Manajemen Soal (CRUD)**:
    *   **Rich Text Editor (TipTap) & LaTeX**: Editor teks canggih (KaTeX, bold, italic, list, table, code block).
    *   **Integrasi Gambar**: Upload gambar langsung ke Supabase Storage.
    *   **Category Creator**: Tambahkan kategori baru langsung saat membuat soal.
    *   **Category Dropdown**: Pemilihan kategori menggunakan dropdown dengan opsi **NONE** sebagai default.
*   **Admin Quiz Panel**:
    *   **Create Session**: Pilih kategori, jumlah soal, dan durasi untuk membuat sesi kuis baru.
    *   **Manage Sessions**: Start, Pause, Resume, dan End kuis secara real-time.
    *   **Player Monitoring**: Lihat skor, waktu, dan jawaban setiap peserta secara live.
    *   **Auto-Expire**: Sesi kuis yang melewati batas waktu otomatis di-finish dan dipindahkan ke History.
    *   **History & Pagination**: Riwayat kuis dengan paginasi (10 item per halaman) dan horizontal scrolling.

---

## 🛠️ Tech Stack

*   **Frontend**: Next.js 15 (App Router), React, Tailwind CSS 4.
*   **Backend & DB**: Supabase (PostgreSQL, RPC Functions, RLS, Storage, Realtime).
*   **Security**: CryptoJS (AES-256, HMAC-SHA256, SHA256 Hashing), Row Level Security, Column-Level REVOKE.
*   **Rich Text**: TipTap Content Editor, KaTeX.
*   **Utility**: DOMPurify, Highlight.js.

---

## 🔒 Arsitektur Keamanan

```text
┌─────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                   │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ AES-256     │  │ HMAC-SHA256  │  │ SHA256 Key     │ │
│  │ Encryption  │  │ Integrity    │  │ Obfuscation    │ │
│  └─────────────┘  └──────────────┘  └────────────────┘ │
│                                                         │
│  public_questions view ← (no correct_answer exposed)    │
│  KUIS_SAFE_COLUMNS  ← (no question_ids exposed)        │
└────────────────────────┬────────────────────────────────┘
                         │ RPC Calls Only
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE (Server)                     │
│                                                         │
│  ┌── Exam Mode ───────┐  ┌── Quiz Mode ──────────────┐ │
│  │ start_exam_session  │  │ join_live_quiz            │ │
│  │ get_session_state   │  │ get_live_quiz_question    │ │
│  │ get_session_question│  │ submit_live_quiz_answer_v2│ │
│  │ save_session_answer │  │                           │ │
│  │ submit_session_exam │  │ strip_html (regex util)   │ │
│  │ cleanup_stale       │  │                           │ │
│  └─────────────────────┘  └───────────────────────────┘ │
│                                                         │
│  RLS Policies: questions → admin only                   │
│  Column REVOKE: question_ids, correct_answer → anon     │
│  SECURITY DEFINER: all RPC functions                    │
│  Timer: expires_at enforced server-side                 │
│  Auth: auth.uid() ownership check on all quiz RPCs      │
└─────────────────────────────────────────────────────────┘
```

---

## 📂 Struktur Proyek

```text
exam-app/
├── app/
│   ├── admin/             # Dashboard Admin & Manajemen Hasil
│   ├── quiz/              # Live Quiz Module
│   │   ├── page.tsx       # Halaman Join Quiz (input kode)
│   │   └── [code]/
│   │       └── page.tsx   # Halaman Sesi Kuis (waiting room, gameplay, leaderboard)
│   ├── components/        # Komponen UI
│   │   ├── AdminQuizTab.tsx     # Panel admin untuk manajemen kuis
│   │   ├── QuestionDisplay.tsx  # Renderer soal dengan scrollbar-stable
│   │   ├── RichContent.tsx      # HTML/LaTeX/Code renderer
│   │   └── RichTextEditorField.tsx # TipTap editor wrapper
│   ├── globals.css        # Design system & scrollbar-gutter
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Logika Utama & Interface Ujian (Anti-Hack)
├── lib/
│   ├── security.ts        # Layer Enkripsi & Integrity Check
│   ├── questions.ts       # RPC Wrappers & JIT Fetching (Exam Mode)
│   ├── quiz.ts            # RPC Wrappers & Logic (Live Quiz Mode)
│   ├── rich-text.ts       # Sanitasi HTML & utilitas teks
│   └── supabase.ts        # Konfigurasi Supabase Client
├── scripts/
│   └── seed-questions.ts  # Script untuk seeding data awal
├── supabase/
│   ├── schema.sql         # Skema Database Exam, RPC, RLS & Auto-Cleanup
│   └── quiz_schema.sql    # Skema Database Quiz (kuis_logs, player, kuis_results)
└── README.md              # Dokumentasi proyek
```

---

## 📦 Instalasi Lokal

1.  **Clone Repositori**
    ```bash
    git clone https://github.com/LvnnnX/exam-app.git
    cd exam-app
    ```

2.  **Instal Dependensi**
    ```bash
    npm install
    ```

3.  **Konfigurasi Environment Variable**
    Buat file `.env` di root direktori:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
    ```

    Jika masih ada data browser lama dari versi sebelumnya, `NEXT_PUBLIC_EXAM_SECRET_KEY` bisa diset sementara untuk migrasi localStorage lama.

4.  **Siapkan Database**
    Jalankan skrip SQL berikut di Supabase SQL Editor (urutan penting):
    1.  `/supabase/schema.sql` — Skema utama (exam mode, RLS, RPC).
    2.  `/supabase/quiz_schema.sql` — Skema kuis (tabel & RLS dasar).
    3.  RPC Functions kuis (dari artifact SQL patches):
        *   `join_live_quiz` — Join & per-user shuffle.
        *   `get_live_quiz_question` — JIT delivery dengan option shuffle.
        *   `submit_live_quiz_answer_v2` — Server-side scoring via key mapping.
        *   `strip_html` — Regex utility untuk normalisasi teks jawaban.

    Pastikan:
    *   Aktifkan **Anonymous Sign-In** di Authentication > Providers.
    *   Jalankan `CREATE OR REPLACE VIEW public_questions` untuk view publik.
    *   Pastikan RLS aktif pada semua tabel.

5.  **Jalankan Aplikasi**
    ```bash
    npm run dev
    ```
    Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## 🌐 Deployment ke Vercel

1.  Push proyek ke GitHub.
2.  Masuk ke [Vercel Dashboard](https://vercel.com/) dan impor proyek.
3.  Di bagian **Environment Variables**, masukkan:
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4.  Klik **Deploy**.

---

## ⚙️ Variabel Lingkungan

| Variable | Deskripsi |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL API Project Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Anon Key dari Project Supabase. |
| `NEXT_PUBLIC_EXAM_SECRET_KEY` | Opsional. Dipakai hanya untuk migrasi data localStorage lama. |

---

## 🗄️ Supabase RPC Functions

### Exam Mode

| Function | Deskripsi |
| :--- | :--- |
| `start_exam_session` | Membuat sesi ujian baru dengan timer server-side. |
| `get_session_state` | Mengambil state sesi aktif (index, jawaban, lives, mode). |
| `get_session_question` | Mengambil 1 soal berdasarkan index (JIT). |
| `save_session_answer` | Menyimpan jawaban & validasi (Survival: cek benar/salah). |
| `submit_session_exam` | Menyelesaikan ujian & menghitung skor final. |
| `cleanup_stale_sessions` | Membersihkan sesi kadaluarsa (>2 hari). |

### Live Quiz Mode

| Function | Deskripsi |
| :--- | :--- |
| `join_live_quiz` | Mendaftarkan peserta & generate urutan soal acak unik per user. |
| `get_live_quiz_question` | Mengambil 1 soal dengan opsi teracak (JIT delivery). |
| `submit_live_quiz_answer_v2` | Validasi jawaban server-side via key-based matching & regex. |
| `strip_html` | Utility regex untuk menghapus tag HTML dari teks jawaban. |

---

## 🤝 Kontribusi

Kontribusi selalu terbuka! Silakan buat *Issue* atau *Pull Request*.

Created by [LvnnnX](https://github.com/LvnnnX)
