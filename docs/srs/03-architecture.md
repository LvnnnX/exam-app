# 03. System Architecture

## High-Level Architecture

```text
Student Browser
  ↓
Next.js React UI
  ↓
Client hooks/controllers
  ↓
Server Actions / Supabase Client
  ↓
Supabase RPC + Tables + Views
```

```text
Admin Browser
  ↓
Admin React UI
  ↓
Supabase Auth token
  ↓
Server Actions
  ↓
Admin validation
  ↓
Supabase tables
```

## Frontend Components

Main student page:

- `/`
- Exam setup (mode, navigation, name, topic, time, count).
- Confirm identity step.
- Exam execution (strict and standard).
- Survival runtime with feedback popup.
- Score view and result recap.
- Live quiz join modal (`JoinQuizModal`).

Quiz route:

- `/quiz/[code]`
- Join screen (with topic preview using `+N` chip pattern).
- Waiting room with bouncing-dot loader and scheduled-start countdown card.
- Active quiz runtime (strict or standard, mirroring the homepage exam UI).
- Pause overlay (glassmorphism card while admin pauses).
- Leaderboard view (compact rank list + Race view modal).
- `EditHorseModal` (mount + jersey customization).

Admin page:

- `/admin` — login, dashboard with tab switcher.
- `/admin/signup` — admin signup request form.
- `/admin/forgot-password` and `/admin/reset-password` — password recovery.
- Tabs (rendered conditionally by permission):
  - Questions
  - Results
  - Analytics
  - Quiz
  - Settings (requires `settings:update` or `topic:delete`)
  - Access (requires `access:manage`)

## Backend Components

Backend logic uses:

- Supabase tables (`questions`, `kuis_logs`, `player`, `kuis_results`, `admin_profiles`, `admin_signup_requests`, etc.).
- Supabase public views (`public_kuis_logs`, `public_players`, `public_categories`).
- `SECURITY DEFINER` Supabase RPC functions.
- Next.js server actions in `app/actions/exam.ts` and `app/actions/admin/*.ts`.
- `pg_cron` for scheduled-quiz auto-start.

Important backend functions include:

- `start_exam_session` — create a self-paced exam session.
- `get_session_state` — restore self-paced exam state.
- `get_session_question` — fetch one self-paced exam question by index.
- `save_session_answer` — record an answer for a self-paced exam.
- `submit_session_exam` — finalize a self-paced exam and return score + recap.
- `join_live_quiz(p_quiz_code, p_name)` — join a live quiz lobby.
- `pick_available_horse_skin(p_kuis_id)` — assign a default mount on join.
- `get_live_quiz_question(p_player_id, p_index, p_secret)` — fetch a live-quiz question JIT.
- `submit_live_quiz_answer_v2(...)` — submit an answer (UPSERT for standard mode, INSERT for strict).
- `finish_player_quiz_rpc(p_player_id)` — mark a player finished and compute total time.
- `set_player_horse_skin(p_player_id, p_horse_skin)` — set mount + jersey, accepts presets and custom 4- or 5-part `custom:` strings.
- `auto_start_scheduled_quizzes()` — scheduled-quiz lifecycle worker (run via `pg_cron` every minute).
- `validate_exam_secret(p_secret)` — guard rail used by every protected RPC.

## Security Boundary

Client-side code may read public-safe data.

Sensitive operations require:

- Server action.
- Admin token.
- Secret header.
- RPC validation.

Correct answers and hidden question fields must not be exposed to students.
