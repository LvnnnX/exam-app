# 10. Data Flow

## Self-Paced Exam Data Flow

```text
Student setup input (mode, categories, time, count)
  → startExamSessionAction (server action)
    → start_exam_session RPC (SECURITY DEFINER)
      → SELECT eligible questions (visibility filters)
      → INSERT exam_sessions row with question_ids
      → return { session_id, secret, total }
  → encrypt + persist session_id, secret in localStorage

Per-question loop:
  → get_exam_question(session_id, index, secret)
    → validate secret
    → return scrambled question payload
  → client unscramble (lib/crypto.ts)
  → render question card
  → student selects answer
  → save_exam_answer(session_id, index, scrambled_answer, secret, ua)
    → upsert exam_answers row
    → return { saved_at }
  → header chip flips to "Tersimpan"

Submit:
  → submit_exam_session(session_id, secret)
    → score every answer
    → compute correct_count, score_percent, duration
    → mark session finished_at
    → return recap payload
  → clear in-progress localStorage keys
  → route to score view

Restart:
  → Ulangi pill clears session_id key
  → returns to setup with previous selections
```

## Survival Data Flow

```text
Setup → start_exam_session (survival = true)
  → server allocates question_ids on demand
Runtime loop:
  → get_exam_question
  → save_exam_answer
  → server returns is_correct
  → wrong answer: client decrements lives
  → if lives = 0: submit_exam_session (auto)
  → if timer = 0: submit_exam_session (auto)
```

## Live Quiz Data Flow

```text
Admin creates session:
  → createLiveQuizAction (server action)
    → generate unique 6-digit code
    → INSERT kuis_logs row (status = waiting)
    → snapshot question_ids based on category selection
    → optional: schedule pg_cron auto-start at expires_at

Student joins:
  → public_kuis_logs lookup by code (safe view)
  → student fills name + selects mount
  → join_player_to_quiz RPC
    → INSERT players row (anonymous auth user)
    → set horse_skin
    → return player_id + secret
  → encrypt + persist quiz_player_<code> in localStorage

Realtime subscription (waiting room):
  → channel "kuis_logs:<code>" subscribes to status updates
  → status flips to active → branch into runtime

Runtime loop:
  → get_live_quiz_question(player_id, index, secret)
    → validate secret + index range
    → return scrambled payload
  → client unscramble + render
  → submit_live_quiz_answer_v2(player_id, index, scrambled_answer, secret)
    → validate question_id matches assigned slot
    → strict mode: enforce sequential index
    → standard mode: upsert kuis_results, recompute score
    → return { success, is_correct }

Finish:
  → finish_player_quiz_rpc(player_id)
    → mark player finished_at
    → recompute total_time and score
  → re-fetch public_players for authoritative score
  → keep quiz_player_<code> for leaderboard refresh
  → remove quiz_index_<code>, quiz_answers_<code>, quiz_doubts_<code>

Leaderboard:
  → realtime channel on public_players (filter session_id = code)
  → re-rank on each insert/update event
  → race view animates rank deltas + horse positions
```

## Admin Question Data Flow

```text
Admin login (/admin):
  → admin_login server action
    → Supabase auth (email + password)
    → verify admin_profile row exists + active
    → set admin_session cookie (encrypted)
  → AdminPage renders tab panels

Question CRUD:
  → server action (e.g., saveQuestionAction)
    → requireAdmin (verify cookie + session token)
    → permission check (question:create / :update:any|:own / :delete:any|:own)
    → DOMPurify sanitize incoming HTML
    → INSERT/UPDATE/DELETE on questions table
    → revalidate path
  → tab refetches list

Image upload (TipTap):
  → editor calls server action with file blob
    → validate size + mime type
    → upload to Supabase Storage bucket question-images
    → return public URL
  → editor inserts <img src=url> into HTML
```

## Visibility Data Flow

```text
Admin edits visibility (Settings tab):
  → SettingsMapelTree mutates local state
  → Save button → saveVisibilitySettingsAction
    → upsert app_settings row keyed by 'category_visibility'
    → return success/error
  → toast feedback on result

Student category fetch:
  → public_categories view (RLS-safe)
    → applies hidden + admin_only filters
  → hooks (useExamCategoryOptions) cascade BAB and Sub-bab from selected MAPEL
```

## Result Data Flow

```text
Admin Results tab:
  → useAdminResults hook
    → Live: subscribe to public_players + poll every N seconds
    → History: paginated query on exam_sessions joined with categories
  → ResultDetailsModal
    → fetch full per-question breakdown via RPC
  → TrackingModal
    → subscribe to channel player_answers_<id>_<ts>_<random>
    → render current answer + history + progress
```

## Auto-Start Data Flow

```text
Admin schedules auto-start:
  → set expires_at on creation
  → pg_cron job tick (every minute)
    → SELECT kuis_logs WHERE status = 'waiting' AND expires_at <= now()
    → for each: call set_quiz_active_internal(id)
    → broadcast realtime status update
  → waiting players auto-route to runtime
```

## Admin Signup Approval Flow

```text
Applicant submits /admin/signup:
  → submit_admin_signup_request RPC
    → INSERT admin_signup_requests (status = pending)
  → super admin opens Admins tab
    → list pending requests
  → Approve:
    → approve_admin_signup_request RPC
      → INSERT admin_profile
      → invite Supabase user
      → mark request approved
  → Reject:
    → reject_admin_signup_request RPC with reason
    → mark request rejected
```
