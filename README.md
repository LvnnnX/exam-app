# Smandapura Exam App

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-blue?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

Web platform for school exams and live quizzes. Built on Next.js 16 (App Router) and Supabase. Server-authoritative scoring, encrypted client state, sanitized rich text, and an iOS-style minimalist UI.

For full requirements see [`docs/srs/`](./docs/srs/README.md). For visual language see [`DESIGN.md`](./DESIGN.md).

---

## What It Does

### Students

- Self-paced exam mode with strict or standard navigation, configurable categories (MAPEL → BAB → Sub-bab), time limits, and question counts (5, 10, 20, 25, 30, 40, 50, 100).
- Survival mode with three lives, instant per-answer feedback (halo + ping ring + +1 / −1 chip), and tone-aware score views.
- Live quiz join via 6-digit code, mount + jersey customization (11 animal mounts + horse), real-time leaderboard, and a horse-racing finale with confetti at the finish line.
- Encrypted session state in localStorage so refreshing mid-exam restores the page exactly where you left off.

### Admins

- Question CRUD with TipTap (KaTeX, tables, code blocks, images), DOMPurify sanitization, and DOMPurify-aware rich text rendering.
- Free-text and exact-ID search, batch visibility, per-tier filters, sort by ID.
- Live quiz creation with auto-start scheduling, manual control (start / pause / resume / finish), per-player tracking via Supabase Realtime, and a remedial quiz builder.
- Result history with stats cards (attempts, avg score, pass rate, avg duration), filters, pagination, and a per-question detail modal.
- Settings tree for category visibility (Hidden / Admin only / Visible) with orphan-safe topic deletes.
- Light + dark theme parity throughout.

### Super Admins

- Admin signup approval queue at `/admin/signup`.
- Permission management.
- Admin removal.

---

## Design Language

The current UI follows an iOS-style minimalist aesthetic:

- Sentence-case copy throughout ("Confirm identity.", not "CONFIRM IDENTITY").
- `+N` chip pattern for topic lists — show the first chip, then a `+N` chip for the rest.
- Soft shadows (`shadow-ios-sm/md/lg/xl`) and spring animations (`transition-spring-fast`).
- Glass-blur modal backdrops.
- Flat pill components on a `bg-black/5` track.
- Full dark theme parity, toggled per admin via a header pill.

See [`DESIGN.md`](./DESIGN.md) for tokens and component recipes.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ Next.js 16 (App Router, Turbopack)                          │
│  ├─ /                  student exam setup + runtime         │
│  ├─ /quiz/[code]       live quiz join + runtime + race      │
│  ├─ /admin             admin dashboard (tabs)               │
│  ├─ /admin/signup      super-admin-gated signup request     │
│  └─ /admin/forgot-...  password recovery                    │
└─────────────────────────────────────────────────────────────┘
              │ server actions (token-gated)
              │ RPC over PostgREST (SECURITY DEFINER)
              ▼
┌─────────────────────────────────────────────────────────────┐
│ Supabase                                                    │
│  ├─ Postgres (RLS on every table)                           │
│  ├─ public_players, public_kuis_logs, public_categories     │
│  ├─ RPC: start_exam_session, get_exam_question,             │
│  │       save_exam_answer, submit_exam_session,             │
│  │       join_player_to_quiz, get_live_quiz_question,       │
│  │       submit_live_quiz_answer_v2, finish_player_quiz_rpc │
│  ├─ Realtime channels (live tracking, leaderboard, status)  │
│  ├─ Storage bucket: question-images                         │
│  ├─ pg_cron: scheduled auto-start                           │
│  └─ Auth: email/password + anonymous                        │
└─────────────────────────────────────────────────────────────┘
```

Sensitive operations (scoring, state transitions, question fetch) run inside `SECURITY DEFINER` RPCs. The browser never sees `correct_answer`, `short_answer`, or `question_ids`.

---

## Security Model

| Layer | Protection |
|---|---|
| Client storage | AES-256 encryption + HMAC-SHA256 signing via `lib/security.ts` |
| Live payloads | Scrambled (XOR + base64) via `lib/crypto.ts` — deterrent only, server still authoritative |
| RLS | Every table has Row Level Security. Students hit public views only. |
| RPC | Sensitive logic runs in `SECURITY DEFINER` functions. Server checks token + permission on every call. |
| Rich text | DOMPurify sanitizes on save and on render. Allowlist preserves KaTeX, tables, code, `<img>`. |
| Anti-cheat | Wake Lock + Page Visibility + selection block + auto-finish on repeated tab loss |

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript.
- **Styling:** Tailwind CSS 4 with custom iOS utilities (`shadow-ios-*`, `transition-spring-*`, glass blur).
- **Backend:** Supabase (Postgres, RPC, RLS, Storage, Realtime, Auth, pg_cron).
- **Editor:** TipTap with extensions for KaTeX, lowlight, tables, images.
- **Sanitization:** DOMPurify on every HTML round-trip.
- **Crypto:** CryptoJS (AES-256, HMAC-SHA256) for client storage; XOR + base64 obfuscation for live payloads.
- **Tests:** Playwright (smoke tests).

---

## Installation

### Prerequisites

- Node.js 20+
- A Supabase project with the schema applied (see `supabase/migrations/`)

### Environment

Create `.env.local` with the following:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # server-only
EXAM_SECRET_KEY=<32+ random bytes>             # server-only
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` and `EXAM_SECRET_KEY` are server-only. They never reach the browser bundle.

### Database

Apply migrations from `supabase/migrations/` in order. Then set:

```sql
ALTER DATABASE postgres SET "app.settings.exam_secret" TO '<your-EXAM_SECRET_KEY>';
```

This makes the secret available inside RPC bodies via `current_setting('app.settings.exam_secret', true)`.

### Run

```sh
npm install
npm run dev          # http://localhost:3000
npm run build        # production build with Turbopack
npm run start        # serve production build
npm run lint         # ESLint
npm run test         # Playwright smoke tests (requires running dev server)
```

---

## Project Structure

```text
exam-app/
├─ app/
│  ├─ page.tsx                    student exam setup + runtime
│  ├─ quiz/[code]/                live quiz join + runtime + leaderboard
│  ├─ admin/                      admin dashboard, signup, recovery
│  ├─ api/                        route handlers
│  ├─ actions/                    server actions (admin/, exam.ts)
│  ├─ components/
│  │  ├─ admin/                   tab panels, modals, settings tree
│  │  ├─ exam/                    runtime, setup, recap, score
│  │  ├─ AdminTabSwitcher.tsx     iOS-style sidebar
│  │  ├─ AdminHeader.tsx          account chip + theme toggle
│  │  ├─ MultiSelectDropdown.tsx  multi-select with inline create
│  │  ├─ RichContent.tsx          DOMPurify-aware HTML renderer
│  │  └─ Toast.tsx
│  └─ hooks/                      page-level controllers + helpers
├─ lib/
│  ├─ security.ts                 AES-256 + HMAC-SHA256
│  ├─ crypto.ts                   live payload obfuscation
│  ├─ quiz.ts                     leaderboard math, pass threshold
│  ├─ questions.ts                question count presets
│  ├─ categories.ts               slug helpers
│  └─ supabase.ts                 client config
├─ supabase/
│  └─ migrations/                 SQL schema, RLS, RPCs, pg_cron
├─ public/                        mount SVGs and static assets
├─ docs/
│  └─ srs/                        software requirements specification
├─ tests/                         Playwright specs
├─ DESIGN.md                      visual language tokens + recipes
├─ CLAUDE.md                      AI agent guide
└─ README.md
```

---

## Documentation

- [`docs/srs/`](./docs/srs/README.md) — full software requirements specification.
- [`DESIGN.md`](./DESIGN.md) — design tokens, color system, component recipes.
- [`CLAUDE.md`](./CLAUDE.md) — guide for AI assistants working on this repo.

---

## Contributing

1. Branch from `main`.
2. Make focused changes (one feature or fix per branch).
3. Run `npm run lint` and `npm run build`.
4. Open a PR with a clear summary and test plan.

For larger work, open an issue first to align on the approach.

---

Created by [LvnnnX](https://github.com/LvnnnX)
