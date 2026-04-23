# 🎓 Smandapura Exam App

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-blue?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

Platform ujian online modern dengan estetika desain **Nike-Inspired** yang clean dan atletis. Aplikasi ini dibangun menggunakan performa tinggi Next.js dan Supabase sebagai backend real-time untuk manajemen soal dan hasil ujian.

---

## 🚀 Fitur Utama

### 👤 Fitur Pengguna (Peserta)
*   **Registrasi Instan**: Sistem pendaftaran nama yang cepat sebelum memulai ujian.
*   **Kustomisasi Ujian**: Pilih mode permainan (Exam atau Survival), jumlah soal, dan kategori yang diinginkan.
*   **Survival Mode (BARU)**: Mode tantangan ekstrim dengan sistem 3-Nyawa (Lives).
*   **Zero-Trust Security (ANTI-HACK)**:
    *   **JIT Question Fetching**: Soal diambil dari server **satu per satu** (Just-In-Time). Tidak ada soal masa depan di browser.
    *   **Encrypted Storage**: Data lokal di-enkripsi (**AES-256**) dan diverifikasi (**HMAC-SHA256**).
    *   **Obfuscated Keys**: Nama storage key di-hash (SHA256).
    *   **Server-Side Authority**: Kalkulasi skor dan nyawa dilakukan di database (Supabase RPC).
*   **Session Persistence**: Sinkronisasi status otomatis dari database setelah *page reload*.
*   **Auto-Cleanup**: Pembersihan otomatis sesi ujian kadaluarsa (>2 hari).
*   **Laporan Skor Terperinci**: Hasil pengerjaan instan tanpa kebocoran kunci jawaban.

### 🔐 Fitur Admin (Dashboard)
*   **Autentikasi PIN**: Sistem login aman menggunakan 6-digit PIN khusus.
*   **Dashboard Hasil Berhalaman**: Manajemen hasil ujian dengan fitur paginasi (20 item per halaman) untuk performa optimal.
*   **Manajemen Hasil & Mode**: Lihat performa peserta dengan filter interaktif untuk memisahkan hasil pengerjaan mode *Exam* dan mode *Survival*.
*   **Analitik Waktu Pengerjaan**: Kolom tambahan di *Results Dashboard* untuk melacak Start Time, End Time, dan Durasi setiap peserta.
*   **Inspeksi Sesi Mendalam**: Fitur "View Details" untuk melihat breakdown pengerjaan user secara persis (teks jawaban pengguna vs jawaban yang benar).
*   **Smart Search (Pencarian Pintar)**: *Search bar* dinamis untuk memfilter dan mencari soal berdasarkan kategori atau potongan teks secara instan.
*   **Manajemen Soal (CRUD)**:
    *   **Rich Text Editor (TipTap) & LaTeX**: Editor teks canggih yang mendukung format matematika kompleks (KaTeX), tebal, miring, daftar, tabel, dan blok kode.
    *   **Integrasi Gambar**: Upload gambar langsung ke Supabase Storage dan masukkan ke dalam soal.
    *   **Category Creator**: Tambahkan kategori baru langsung saat membuat soal tanpa repot.

---

## 🛠️ Tech Stack

*   **Frontend**: Next.js 15 (App Router), React, Tailwind CSS 4.
*   **Backend & DB**: Supabase (PostgreSQL, RPC Functions, Storage).
*   **Security**: CryptoJS (AES-256, HMAC-SHA256, SHA256 Hashing).
*   **Rich Text**: TipTap Content Editor, KaTeX.
*   **Utility**: DOMPurify, Highlight.js.

---

## 📂 Struktur Proyek

```text
exam-app/
├── app/
│   ├── admin/             # Dashboard Admin & Manajemen Hasil
│   ├── components/        # Komponen UI (RichContent, QuestionDisplay)
│   └── page.tsx           # Logika Utama & Interface Ujian (Anti-Hack)
├── lib/
│   ├── security.ts        # Layer Enkripsi & Integrity Check
│   ├── questions.ts       # RPC Wrappers & JIT Fetching
│   ├── rich-text.ts       # Sanitasi HTML & utilitas teks
│   └── supabase.ts        # Konfigurasi Supabase Client
├── scripts/
│   └── seed-questions.ts  # Script untuk seeding data awal
├── supabase/
│   └── schema.sql         # Skema Database, RPC & Auto-Cleanup
└── README.md              # Dokumentasi proyek
```

---

## 📦 Instalasi Lokal

Ikuti langkah-langkah berikut untuk menjalankan proyek di mesin lokal Anda:

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
    Buat file `.env` di root direktori dan masukkan kredensial Supabase Anda:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
    ```

4.  **Siapkan Database**
    Jalankan perintah SQL yang ada di `/supabase/schema.sql` pada SQL Editor di dashboard Supabase Anda. Jangan lupa aktifkan **Anonymous Sign-In** di bagian Authentication > Providers.

5.  **Jalankan Aplikasi**
    ```bash
    npm run dev
    ```
    Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

---

## 🌐 Deployment ke Vercel

1.  Push proyek Anda ke GitHub.
2.  Masuk ke [Vercel Dashboard](https://vercel.com/) dan impor proyek Anda.
3.  Di bagian **Environment Variables**, masukkan:
    *   `NEXT_PUBLIC_SUPABASE_URL`
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4.  Klik **Deploy**. Vercel akan otomatis melakukan build dan memberikan URL publik untuk aplikasi Anda.

---

## ⚙️ Variabel Lingkungan

| Variable | Deskripsi |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL API Project Supabase Anda. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Anon Key dari Project Supabase Anda. |
| `NEXT_PUBLIC_EXAM_SECRET_KEY` | Kunci rahasia untuk enkripsi LocalStorage (AES/HMAC). |

---

## 🤝 Kontribusi

Kontribusi selalu terbuka! Jika Anda ingin meningkatkan fitur atau melaporkan bug, silakan buat *Issue* atau *Pull Request*.

Created by [LvnnnX](https://github.com/LvnnnX)
