# 02. Overall Description

## Product Perspective

The app is a browser-based exam and quiz platform.

It uses:

- Next.js UI.
- React client controllers.
- Supabase database.
- Supabase Auth.
- Supabase RPC functions.
- Server actions for protected operations.

The public app lets students start exams or join live quizzes. The admin app lets admins manage questions, categories, visibility, results, and live quiz sessions.

## Product Functions

The app shall provide:

- Student exam setup with mode, navigation, time, and topic configuration.
- Self-paced exam execution with strict and standard navigation.
- Survival mode with three lives and per-answer feedback popup.
- Live quiz joining by 6-digit numeric code.
- Live quiz waiting room with scheduled-start countdown and bouncing-dot loading indicator.
- Live quiz answering with JIT question fetch and scrambled payloads.
- Mount + jersey customization (`EditHorseModal`) with hex color input and custom skin encoding.
- Real-time leaderboard with horse-race animation modal.
- Per-question answer persistence and resumable session restoration.
- Score calculation with tone-aware accent (green ≥70%, neutral 50–70%, red <50%).
- Result recap with correct / wrong / skipped chips per question.
- Admin authentication with Supabase Auth.
- Question CRUD with TipTap rich text, KaTeX, tables, code blocks, and image upload.
- Topic taxonomy management with usage-aware delete validation.
- Category visibility settings (visible / admin only / hidden) per Mapel/Bab/Sub-bab.
- Batch question visibility control with multi-select.
- Exam result history with pagination and filters.
- Live session monitoring and per-player tracking modal.
- Quiz session creation, scheduling, start, pause, resume, end, and delete controls.
- Server-driven auto-start for scheduled quizzes via `pg_cron`.
- Leaderboards with stable rows, rank-change animations, and confetti on finish.
- Horse-race leaderboard visuals with mount + jersey synchronized to player choice.
- Analytics across exam and quiz attempts (hardest topics, hardest questions, score trend, student weakness).
- Remedial-quiz builder that generates a new live-quiz session from selected weak students.
- Role-based access control with super admin, admin signup approval, and per-permission toggles.
- Toast notifications for admin Save Settings outcome.

## User Classes

### Student

A student can:

- Enter name.
- Select exam mode.
- Select MAPEL, BAB, and Sub-bab.
- Select time limit.
- Select question count.
- Start an exam.
- Answer questions.
- Submit or surrender.
- View score.
- View recap.
- Join live quiz by code.
- Select horse skin.
- View leaderboard.

### Admin

An admin can:

- Log in via Supabase Auth (email + password) at `/admin`.
- Sign up via `/admin/signup` (creates a `pending` request reviewed by super admin).
- Reset password via `/admin/forgot-password` and `/admin/reset-password`.
- Log out.
- Manage questions: add, edit, delete, hide/show.
- Filter, search (free text + exact ID), and sort questions.
- Batch hide/show selected questions with confirmation modal.
- Edit rich text content with TipTap (KaTeX, tables, code blocks, images).
- Manage MAPEL/BAB/Sub-bab visibility (visible / admin only / hidden).
- Save visibility settings and receive toast feedback.
- Delete topics when allowed and when no orphan questions exist.
- View result history with pagination and filters.
- View live sessions and a tracking modal per player.
- View result detail modals for completed attempts.
- Create live quiz sessions with topic, count, duration, mode, and join-code config.
- Schedule a live quiz to auto-start at a future timestamp.
- Start, pause, resume, finish, or delete quiz sessions.
- View live tracking with realtime updates.
- View analytics: hardest topics, hardest questions, score trend, student weakness.
- Build a remedial quiz from selected weak students.
- (Super admin only) Approve / reject admin signup requests, edit per-admin permissions, and delete admin profiles.

## Operating Environment

The app runs in modern browsers.

Backend services run through Supabase.

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `EXAM_SECRET_KEY`

## Design Constraints

The system shall:

- Use Supabase as the primary database.
- Use Supabase RPC for sensitive exam/quiz logic.
- Keep admin-only operations behind Supabase Auth.
- Keep server-only secrets outside client code.
- Avoid exposing correct answers to the browser.
- Use public views for safe student reads.
- Use server actions for protected writes.

## Assumptions

- Students do not need accounts.
- Admin access is limited to configured admin email.
- Supabase RLS and RPC functions enforce data access rules.
- Question data exists in the database before exams can start.
- Browser local state may restore interrupted exam sessions.
