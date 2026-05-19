# Admin Quiz Management Requirements

## FR-LQ-001: Create Quiz Session

The admin shall create a live quiz from the Quiz tab.

Required inputs include:

- MAPEL (one or many).
- BAB (one or many).
- Sub-bab (one or many).
- Question count.
- Duration (minutes).
- Quiz mode (`strict` or `standard`).
- Mid-game join setting (allow / disallow).

Optional input: Sub-bab percentage weights.

## FR-LQ-002: Generate Quiz Code

The system shall generate a 6-digit numeric quiz code.

The code shall be unique among non-finished sessions.

## FR-LQ-003: Select Quiz Questions

The system shall select non-hidden questions matching the chosen categories.

The system shall reject creation if fewer questions are available than requested. The error modal shall list the available count, the request count, and the selected categories.

## FR-LQ-004: Support Weighted Sub-bab Percentages

The admin shall optionally assign percentage weights per Sub-bab.

The total shall equal 100. The system shall warn the admin until totals match.

## FR-LQ-005: Support All Categories

The system shall support broad category selections (`Semua MAPEL`, `Semua BAB`, `Semua Sub-bab`).

## FR-LQ-006: Schedule Quiz

The admin shall set or clear a `scheduled_at` timestamp while quiz status is `waiting`.

A `pg_cron` job (`auto_start_scheduled_quizzes`) shall run every minute and:

- Set status to `active`, set `started_at = now()`, and set `expires_at = now() + duration_minutes` for any waiting quiz whose `scheduled_at` has passed and that has at least one player joined.
- Delete the quiz row when its `scheduled_at` has passed and no players joined.

## FR-LQ-007: Start Quiz

The admin shall manually start a quiz from the session controls.

The system shall set `status = 'active'`, `started_at = now()`, and `expires_at = now() + duration_minutes`.

## FR-LQ-008: Pause Quiz

The admin shall pause an active quiz.

The system shall set `paused_at = now()` and `status = 'paused'`.

While paused, students see a glass overlay with the message "Kuis dijeda — Menunggu admin melanjutkan."

## FR-LQ-009: Resume Quiz

The admin shall resume a paused quiz.

The system shall:

- Compute `pauseDuration = now() - paused_at`.
- Shift `started_at` and `expires_at` by `pauseDuration` so the effective playable time is preserved.
- Clear `paused_at` and set `status = 'active'`.

## FR-LQ-010: Finish Quiz

The admin shall finish a quiz from the session controls.

The system shall set `status = 'finished'` and `finished_at = now()`.

## FR-LQ-011: Delete Quiz

The admin shall delete a quiz session.

The system shall delete the `kuis_logs` row. Cascading rows in `player` and `kuis_results` shall be removed by foreign-key cascade.

## FR-LQ-012: Session Details Modal

The admin shall open a session details modal listing:

- Session config (topic, mode, duration, status).
- Player list with score, time, and status.
- Lifecycle controls (Start / Pause / Resume / End / Cancel).
- Per-player `View answers` action that opens the tracking modal.

The body scroll shall lock while the modal is open.

## FR-LQ-013: Tracking Modal Realtime

When the session is not `finished`, the tracking modal shall subscribe to a Supabase Realtime channel filtered on `kuis_results` inserts for the player.

Each subscription shall use a unique channel name (`player_answers_<id>_<ts>_<random>`) to avoid duplicate `postgres_changes` callback errors on rapid re-mount.

## FR-LQ-014: Periodic Refresh

The session details modal shall poll player and session data every five seconds while the session is not `finished`. Polling shall pause when the document is hidden.

## FR-LQ-015: Remedial Quiz Builder

From the Analytics tab, the admin shall select weak students and build a new quiz session populated with the questions those students answered incorrectly.

The builder shall accept:

- Quiz name.
- Duration.
- Question count.
- Selection mode (`wrong_only`, `wrong_similar`, `topic_based`).

Successful creation shall return the new quiz code and offer to navigate to the Quiz tab.

