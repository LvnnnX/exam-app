# 08. Business Rules

## BR-001: Student Start Requirements

A student cannot start a self-paced exam without:

- A non-empty name.
- At least one MAPEL.
- At least one BAB.
- At least one Sub-bab.
- A selected time limit.
- A question count (Exam mode only).

The Start button stays disabled until every required field is set.

## BR-002: Hidden Question Exclusion

Questions with `is_hidden = true` shall not be selected by:

- Live quiz creation.
- Self-paced exam question fetching.
- Survival mode.

Hidden questions remain visible in the admin Questions tab so they can be edited or restored.

## BR-003: Student Category Visibility

Student-facing category lookups shall exclude any tier marked `hidden` or `admin_only`.

This applies to MAPEL, BAB, and Sub-bab independently. Hiding a parent does not auto-hide children, but child rows are still filtered out because their parent is missing from the student-facing list.

## BR-004: Admin Category Visibility

Admin tools shall show every category regardless of `hidden` or `admin_only` flags.

Each row in `SettingsMapelTree` exposes its current visibility state via three pill buttons (Hidden / Admin only / Visible).

## BR-005: Quiz Code Format

Live quiz codes shall be 6 numeric digits, generated server-side and unique among `waiting` and `active` sessions.

Codes for finished sessions may be reused after a 24-hour cool-down to keep the namespace clean.

## BR-006: Quiz Ranking

Live leaderboard ranking shall use:

1. Score descending.
2. Total time ascending.
3. `joined_at` ascending (tiebreaker).

In standard mode, players who have not yet finished are sorted as if their score were `0` and their total time were `+∞`, but the score chip renders as `?` to hide partial info.

## BR-007: Quiz Status Lifecycle

A live quiz session moves through the following states:

```text
waiting → active → finished
            ↕
          paused
```

Transitions:

- `waiting` → `active`: manual `set_quiz_active` or pg_cron auto-start at `expires_at`.
- `active` → `paused`: manual `set_quiz_paused`.
- `paused` → `active`: manual `set_quiz_resumed`.
- `active` → `finished`: manual `set_quiz_finished` or all players finished.

Once finished, a session is read-only.

## BR-008: Pause Duration

When a paused session resumes, the server shall shift `expires_at` forward by the elapsed pause duration so the total active time matches the original time limit.

Per-question time used so far is preserved.

## BR-009: All-Category Selection

Admin quiz creation shall support "Pilih semua" (Select all) shortcuts for MAPEL, BAB, and Sub-bab.

The server resolves "all" at create time by snapshotting the current category list. Subsequent category changes do not retroactively affect the session.

## BR-010: Correct Answers

`correct_answer` and `short_answer` shall be available to:

- Admin question CRUD (via authenticated server actions).
- Server-side scoring inside RPC bodies.

They shall not appear in any payload that reaches a student client. Public views and student-facing RPCs strip these columns.

## BR-011: Survival Mode Constraints

Survival mode shall:

- Force `examMode = 'strict'`.
- Hide the question count picker (questions are unbounded).
- Start the player with three lives.
- End the session when lives reach zero or the timer expires.

Survival sessions cannot run in standard mode or with a fixed question count.

## BR-012: Topic Deletion Constraints

A category (MAPEL/BAB/Sub-bab) may be deleted only if:

- The actor has the `topic:delete` permission.
- No question would be left with zero values in that tier after the deletion (no orphan questions).

If any question would be orphaned, the system shall reject the delete and surface `DeleteTopicErrorModal` listing the affected question IDs.

## BR-013: Question Edit Permissions

Editing or deleting a question requires either:

- `question:update:any` / `question:delete:any` (any author), or
- `question:update:own` / `question:delete:own` and `created_by = current admin id`.

Owners always inherit the `:own` permissions. Super admins have `:any` for both.

## BR-014: Mid-Game Join

A player joining a session that is already `active` shall:

- Be inserted into `players` with `current_index = session.current_global_index`.
- Skip questions that have already passed.
- Score only on questions answered from the join point onward.

The leaderboard shows them with their (lower) max possible score so ranks remain comparable.

## BR-015: Auto-Submit on Timer

When the exam or quiz timer hits zero:

- Self-paced exam: auto-submit the current answer, finalize the session, route to score.
- Live quiz: finish the player via `finish_player_quiz_rpc`, route to leaderboard.
- Survival: finalize the session and route to score.

No manual confirmation is required at timeout.

## BR-016: Anti-Cheat Auto-Finish

If the runtime detects repeated tab-visibility loss above the configured threshold, the system shall auto-finish the session and surface a warning modal explaining the violation.

The threshold is defined in `useQuizSecurityGuard` and applies to live quiz and self-paced exam runtimes alike.

## BR-017: Mount + Jersey Validation

A custom horse skin shall:

- Encode as `custom:<mount>:<jersey>:<pants>:<saddle>[:<saddle_dark>]` (4 or 5 parts).
- Use a known mount id.
- Use 6-character hex codes for every color slot.

Invalid skins are rejected by `set_player_horse_skin` and the player keeps the previous skin.

## BR-018: Admin Signup Approval

A new admin signup request shall:

- Land in `admin_signup_requests` with `status = pending`.
- Be reviewed by a super admin in the Admins tab.
- On approval, create the `admin_profile` row and provision the Supabase user.
- On rejection, mark the row `status = rejected` with a reason.

Rejected requests do not auto-purge; super admins may revisit decisions.

## BR-019: Result Score Pass Threshold

The Results tab shall compute pass rate using a 70% score threshold.

Sessions at exactly 70% count as a pass. The threshold lives in `lib/quiz.ts` and is shared with admin analytics.
