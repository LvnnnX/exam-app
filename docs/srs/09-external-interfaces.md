# 09. External Interfaces

## Student UI

Routes:

- `/` — landing screen with mode picker (Exam / Survival), setup, and Confirm Identity step.
- `/quiz/[code]` — live quiz join, waiting, runtime, leaderboard, and race views.

Components rendered to students:

- 2-tab segmented controls (`bg-black/5` track, white pill).
- Multi-select dropdowns (MAPEL / BAB / Sub-bab).
- Time limit and question count dropdowns.
- ConfirmIdentityStep card with `+N` topic chip pattern.
- Runtime header (timer pill, mode chip, topic chips, daftar-soal pill, saved/pending chip).
- Question card (sentence-case body, A–E option pills, short answer input).
- Daftar Soal modal (legend dots, color-coded grid).
- Submit / surrender confirmation modals.
- Per-answer feedback popup (survival).
- Score view with tone-aware tint, recap view, leaderboard view, race view.
- Mount picker (preset row + custom hex picker, animal mounts gallery).

## Admin UI

Routes:

- `/admin` — login + dashboard tabs.
- `/admin/signup` — public signup request form.
- `/admin/forgot-password`, `/admin/reset-password` — recovery flow.

Components rendered to admins:

- AdminLoginView, AdminAuthLoadingView.
- AdminTabSwitcher (sidebar with iOS-style nav, includes account chip and theme toggle).
- Tab panels: Questions, Quiz, Results, Settings, Analytics, Admins (super admin only).
- Modals: QuestionModalShell, TrackingModal, ResultDetailsModal, BatchVisibilityConfirmModal, DeleteTopicErrorModal, LeaderboardViewModal, EditHorseModal, SessionDetailsModal.
- Toast component for success/error feedback.

## Supabase Interface

The app shall connect to Supabase using:

- `NEXT_PUBLIC_SUPABASE_URL` — project URL exposed to the browser.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anonymous key for browser sessions.
- `SUPABASE_SERVICE_ROLE_KEY` — service role key, server-only.
- `EXAM_SECRET_KEY` — symmetric key for `lib/security.ts`, server-only.

Channels:

- Postgres reads via `@supabase/supabase-js`.
- Postgres writes via RPC (`SECURITY DEFINER`) and server actions only.
- Realtime channels for live quiz tracking, prefixed `player_answers_<id>_<ts>_<random>` to avoid duplicate-callback errors.
- Storage bucket `question-images` for TipTap image uploads.

## Environment Interface

The deployment shall provide:

- Supabase env vars listed above.
- `EXAM_SECRET_KEY` (32+ random bytes).
- `NEXT_PUBLIC_APP_URL` for OAuth redirects.

Missing required env vars shall fail the boot with a server-side error. The browser bundle never receives `SUPABASE_SERVICE_ROLE_KEY` or `EXAM_SECRET_KEY`.

## Browser APIs

The runtime depends on:

- `localStorage` (encrypted via `lib/security.ts`) for session, answers, doubts, and player ids.
- Wake Lock API where supported (anti-cheat).
- Page Visibility API (tab loss detection).
- `navigator.userAgent` for session telemetry.
- Clipboard API for copy-code pills.

## External Services

- Supabase Auth (email/password + anonymous).
- Supabase Storage (image uploads).
- pg_cron (scheduled auto-start of quizzes).
