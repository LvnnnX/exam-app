# 🎓 Kuis Tanya Jawab - Nike Inspired Exam Platform

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-blue?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

Platform ujian online modern dengan estetika desain **Nike-Inspired** yang clean dan atletis. Aplikasi ini dibangun menggunakan performa tinggi Next.js dan Supabase sebagai backend real-time untuk manajemen soal dan hasil ujian.

---

## 🚀 Fitur Utama

### 👤 Fitur Pengguna (Peserta)
*   **Registrasi Instan**: Sistem pendaftaran nama yang cepat sebelum memulai ujian.
*   **Kustomisasi Ujian**: Pilih jumlah soal (5, 10, 20) dan kategori yang diinginkan.
*   **Kategori Dinamis**: Daftar kategori ditarik langsung dari database secara real-time.
*   **Pengacakan Cerdas**: Implementasi algoritma *Fisher-Yates Shuffle* untuk mengacak soal dan opsi jawaban secara dinamis.
*   **Sesi Lokal (Persistence)**: Fitur auto-save sesi ujian di LocalStorage, memungkinkan peserta melanjutkan ujian jika halaman tidak sengaja tertutup.
*   **Laporan Skor Terperinci**: Tampilan skor akhir otomatis beserta persentase kelulusan.

### 🔐 Fitur Admin (Dashboard)
*   **Autentikasi PIN**: Sistem login aman menggunakan 6-digit PIN khusus.
*   **Dashboard Hasil Berhalaman**: Manajemen hasil ujian dengan fitur paginasi (20 item per halaman) untuk performa optimal.
*   **Inspeksi Sesi Mendalam**: Fitur "View Details" untuk melihat breakdown pengerjaan user (apa yang mereka jawab vs jawaban yang benar).
*   **Manajemen Soal (CRUD)**:
    *   **Rich Text Editor (TipTap)**: Editor teks canggih untuk membuat soal dengan pemformatan tebal, miring, daftar, dan blok kode.
    *   **Integrasi Gambar**: Upload gambar langsung ke Supabase Storage dan masukkan ke dalam soal.
    *   **Category Creator**: Tambahkan kategori baru langsung saat membuat soal tanpa repot.

---

## 🛠️ Tech Stack

*   **Frontend**: Next.js 15 (App Router), React, Tailwind CSS 4.
*   **Backend & DB**: Supabase (PostgreSQL, Auth, Storage).
*   **Rich Text**: TipTap Content Editor.
*   **Utility**: DOMPurify (Sanitization), Highlight.js (Syntax Highlighting).

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

---

## 🤝 Kontribusi

Kontribusi selalu terbuka! Jika Anda ingin meningkatkan fitur atau melaporkan bug, silakan buat *Issue* atau *Pull Request*.

Created by [LvnnnX](https://github.com/LvnnnX)
