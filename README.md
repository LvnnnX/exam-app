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
*   **Zero-Trust Security (ANTI-HACK)**:
    *   **JIT Question Fetching**: Soal diambil dari server **satu per satu** (Just-In-Time). Tidak ada soal masa depan di browser.
    *   **Encrypted Storage**: Data lokal di-enkripsi (**AES-256**) dan diverifikasi (**HMAC-SHA256**).
    *   **Server-Side Authority**: Kalkulasi skor, nyawa, dan validasi jawaban dilakukan di database (Supabase RPC).
    *   **Anti-Cheat Hardware**: Deteksi perpindahan tab, penguncian layar (Wake Lock), dan pemblokiran seleksi teks/pintasan keyboard.
*   **Session Persistence**: Sinkronisasi status otomatis dari database setelah *page reload*. Score, lives, current question, dan mode permainan tetap utuh.
*   **Layout Stability**: Dynamic font resizing untuk soal panjang & centering gambar otomatis agar visual tetap proporsional.

### 🎮 Fitur Live Quiz (Kuis Real-Time)
*   **Lobby System**: Admin membuat sesi kuis dengan kode unik.
*   **Waiting Room**: UI interaktif yang menampilkan topik kuis (MAPEL - BAB - SUBBAB) dan status admin.
*   **Scheduled Quiz**: Dukungan penjadwalan kuis dengan **Dark-Themed Countdown Timer**.
*   **Per-User Randomization**: Urutan soal dan opsi jawaban diacak unik per peserta.
*   **Server-Side Flow Validation**: Validasi urutan soal dan kepemilikan sesi di server untuk mencegah bypass jawaban.
*   **Live Leaderboard**: Papan skor real-time dengan sinkronisasi Supabase Realtime.

### 🔐 Fitur Admin (Dashboard)
*   **Admin Quiz Management**:
    *   **Topic Standardization**: Format topik otomatis `(MAPEL) - (BAB) - (SUBBAB)` di seluruh dashboard & history.
    *   **Live Monitoring**: Pantau progress, skor, dan jawaban peserta secara real-time.
    *   **Session Control**: Start, Pause, Resume, dan End kuis secara instan.
*   **Manajemen Soal (CRUD)**:
    *   **Rich Text Editor (TipTap) & LaTeX**: Dukungan KaTeX, tabel, blok kode, dan formatting list yang sudah diperbaiki.
    *   **Integrasi Gambar**: Upload gambar langsung ke Supabase Storage.
*   **History & Analytics**: Laporan riwayat kuis dengan paginasi dan filter kategori.

---

## 🛠️ Tech Stack

*   **Frontend**: Next.js 15 (App Router), React, Tailwind CSS 4.
*   **Backend & DB**: Supabase (PostgreSQL, RPC Functions, RLS, Storage, Realtime).
*   **Security**: CryptoJS (AES-256, HMAC-SHA256), Row Level Security, Custom Secret Header (`x-exam-secret`).
*   **Rich Text**: TipTap Content Editor, KaTeX, DOMPurify.

---

## 🔒 Arsitektur Keamanan (Zero-Trust)

Sistem ini menerapkan lapisan keamanan berlapis untuk memastikan integritas ujian:

1.  **Custom Secret Authorization**: Semua request ke database wajib menyertakan `x-exam-secret` di header. Request dengan `anon` key tanpa secret akan ditolak otomatis oleh database.
2.  **Server-Side State Tracking**: Progress ujian dilacak di server. User tidak bisa menjawab soal di luar urutan yang ditentukan atau mengirim jawaban untuk soal yang tidak ditugaskan kepada mereka.
3.  **Encrypted Local Data**: Semua data sensitif di `localStorage` dienkripsi menggunakan AES-256 dengan key yang diderivasi dari secret aplikasi.
4.  **Database Hardening**:
    *   **RLS Lockdown**: Tabel utama tertutup dari akses publik.
    *   **Sanitized Views**: Data filter diambil melalui view khusus yang menyembunyikan kolom sensitif.
    *   **Security Definer RPC**: Semua logika krusial (grading, state transition) berjalan di dalam fungsi database yang aman.

---

## 📂 Struktur Proyek (Penting)

```text
exam-app/
├── app/
│   ├── admin/             # Dashboard Admin
│   ├── quiz/              # Live Quiz Module
│   │   └── [code]/        # Waiting room & Gameplay kuis
│   ├── components/        # UI Components (RichContent, QuestionDisplay)
│   └── page.tsx           # Logika Utama Exam/Survival Mode
├── lib/
│   ├── security.ts        # Layer Enkripsi
│   ├── quiz.ts            # Logic Live Quiz
│   └── supabase.ts        # Client Config dengan Secret Header
└── supabase/
    └── migrations/        # SQL Hardening & Final Schema
```

---

## 📦 Instalasi & Konfigurasi

1.  **Environment Variables**:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
    NEXT_PUBLIC_EXAM_SECRET_KEY=your_secret_key
    ```
2.  **Database Setup**:
    *   Jalankan `supabase/migrations/20260505_final_hardened_schema.sql` di SQL Editor Supabase.
    *   Set database secret: `ALTER DATABASE postgres SET "app.settings.exam_secret" TO 'your_secret_key';`

---

Created by [LvnnnX](https://github.com/LvnnnX)
