# 06. User Workflows

This document maps the end-to-end paths each role takes through the app. Each workflow lists the screens, server calls, and side effects involved. Refer to the FR sections for detailed acceptance criteria.

## Self-Paced Exam Workflow (Standard or Strict)

```text
Landing screen (/)
  → Enter Step 1 (setup)
    → enter name (raw casing, ≥ 1 char)
    → select Exam mode
    → select Strict or Standard
    → select MAPEL (multi)
    → select BAB (multi, gated by MAPEL)
    → select Sub-bab (multi, gated by BAB)
    → select time limit
    → select question count
  → Enter Step 2 (ConfirmIdentityStep)
    → review name, mode, navigation, topic (+N), count, time
    → tap Start exam
  → start_exam_session RPC (returns session_id + secret)
  → persist session_id + secret to encrypted localStorage
  → runtime view
    → header: name, mode chip, topic chips, timer pill, daftar-soal pill (standard), saved/pending chip
    → loop: get_exam_question → render → save_exam_answer → next
    → standard mode: Back, Ragu-ragu, Next/Finish
    → strict mode: Next, Skip
  → submit_exam_session (manual Finish or timer expiry)
  → score view
    → score card with tone-aware tint
    → topic chips, mode chips, save status chip
    → Lihat recap or Ulangi
  → recap view
    → per-question breakdown with green/red/neutral tone
  → Ulangi
    → returns to setup with previous selections preserved
```

Edge: surrender from runtime opens the surrender confirmation modal (FR-EXAM-018) and routes directly to the score view.

## Survival Workflow

```text
Landing screen (/)
  → Step 1 (setup) with Survival picked
    → name, MAPEL, BAB, Sub-bab, time limit
    → question count picker hidden
  → Step 2 (ConfirmIdentityStep) showing lives indicator
  → start_exam_session RPC with survival = true
  → runtime view (strict layout, lives strip in header)
    → answer question
    → per-answer feedback popup (halo + ping + +1 / −1 chip)
    → wrong answer decrements lives
    → continues until all lives are spent or timer hits zero
  → submit_exam_session (auto on death/timeout, or surrender)
  → score view in survival flavor
    → correct count, lives left, time used
    → tone-aware tint
```

## Live Quiz Student Workflow

```text
Landing screen (/)
  → tap "Gabung dengan kode"
  → enter 6-digit code
  → join_player_to_quiz RPC
    → name (24 char cap, raw casing)
    → preview topic (+N pattern), mode, count, time
  → branch on session.status
    → waiting → waiting room (countdown card, bouncing dots, mount picker)
    → active → join mid-game, jump to current_index
    → finished → leaderboard view
  → mount picker (waiting only)
    → preset or custom: mount + jersey/pants/saddle hex picks
    → set_player_horse_skin RPC
  → quiz starts (set_quiz_active or auto-start)
  → runtime
    → get_live_quiz_question → unscramble → render
    → submit_live_quiz_answer_v2 (scrambled)
    → strict: sequential, no Back. Standard: full nav + daftar-soal
    → anti-cheat: wake lock, tab visibility guard, selection block
  → finish_player_quiz_rpc (manual or auto)
  → leaderboard view
    → ranked rows with mounts, your row highlighted
    → standard mode: in-progress players show ?
  → race view
    → horse racing animation across the track
    → confetti on finish line
```

## Admin Question Workflow

```text
/admin
  → AdminLoginView
    → email + password
    → admin_login RPC
  → Questions tab (default)
    → filters: MAPEL, BAB, Sub-bab, type, visibility
    → search: free text or exact ID
    → sort: ID asc/desc
    → pagination strip
  → row actions: hide, edit, delete (gated by permissions)
  → Add question
    → QuestionModalShell opens
    → rich text editor (TipTap + DOMPurify + KaTeX + lowlight)
    → assign MAPEL/BAB/Sub-bab (multi-select with inline create)
    → multiple choice: A–E + correct answer
    → short answer: expected text
    → save_question RPC (created_by = current admin)
  → Batch visibility
    → select rows
    → BatchVisibilityConfirmModal
    → confirm → batch hide/show
```

## Admin Live Quiz Workflow

```text
/admin
  → Quiz tab
  → list of sessions (active + history)
  → Create session
    → categories (multi)
    → question count (preset)
    → time per question + total time
    → strict / standard mode
    → optional auto-start time
    → create_quiz_session RPC
  → share 6-digit code (copy pill)
  → manual control
    → set_quiz_active / set_quiz_paused / set_quiz_resumed / set_quiz_finished
  → details modal
    → live player roster
    → score / progress / lives strip
    → tracking modal per player (realtime channel)
  → finish
    → leaderboard archive
    → remedial quiz builder (FR-LQ-015)
```

## Admin Result Workflow

```text
/admin
  → Results tab
  → toggle: History or Live
  → filters: MAPEL, BAB, Sub-bab, mode
  → stats row: attempts, avg score, pass rate, avg duration
  → table with pagination
  → row → ResultDetailsModal (per-question breakdown)
  → Live mode
    → realtime + polling fallback
    → row → TrackingModal (live progress, history, current answer)
```

## Admin Settings Workflow

```text
/admin
  → Settings tab
  → SettingsMapelTree
    → expand Mapel → Bab → Sub-bab
    → adjust visibility per row (Hidden / Admin only / Visible)
  → Save
    → saveVisibilitySettingsAction
    → success toast: "Settings saved..."
  → Delete topic
    → cascade check
    → DeleteTopicErrorModal on conflict (chip list of orphans)
```

## Super Admin Approval Workflow

```text
/admin/signup (public)
  → fill signup request form
  → submit_admin_signup_request RPC
  → request lands in admin_signup_requests with status = pending
  → super admin opens Admins tab
    → review request
    → approve_admin_signup_request RPC (or reject)
    → on approve: admin_profile row created, Supabase user provisioned
  → applicant receives invite email and signs in
```
