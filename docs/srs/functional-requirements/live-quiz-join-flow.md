# Live Quiz Join Flow Requirements

## FR-QUIZ-001: Join by Code

The system shall let students join a live quiz by 6-digit numeric code.

The student may enter the code from:

- The "Join with code" CTA on `/`.
- A direct visit to `/quiz/[code]`.

## FR-QUIZ-002: Normalize Quiz Code

The system shall accept only numeric quiz code characters.

The system shall enforce a 6-digit length on submit.

## FR-QUIZ-003: Validate Quiz Code

The system shall fetch quiz metadata via `public_kuis_logs`.

The system shall not expose `question_ids` or correct-answer columns to students.

## FR-QUIZ-004: Anonymous Auth

The system shall create or attach an anonymous Supabase Auth session when required for quiz participation.

## FR-QUIZ-005: Register Player

The system shall register the student as a player through `join_live_quiz(p_quiz_code, p_name)` RPC.

The RPC shall:

- Validate the quiz code and status.
- Insert a `player` row with a player-specific shuffled `question_ids`.
- Pick a default mount via `pick_available_horse_skin(p_kuis_id)`.

## FR-QUIZ-006: Respect Quiz Status

The system shall enforce quiz status rules at both the join screen and at the runtime guard:

- `waiting` — show waiting room.
- `active` or `paused` — proceed to runtime (subject to `allow_join_mid_game`).
- `finished` — refuse new joins; redirect to leaderboard read-only.

## FR-QUIZ-007: Respect Mid-Game Join Setting

The system shall reject mid-game joins when `kuis_logs.allow_join_mid_game = false` and the session is `active` or `paused`.

The error shall be surfaced inline on the join screen.

## FR-QUIZ-008: Name Input Constraints

The student name shall be limited to 24 characters.

The system shall preserve the raw casing the student typed (no auto-uppercase).

The student shall not be able to submit an empty or whitespace-only name.

## FR-QUIZ-009: Topic Preview on Join

The join screen shall display the quiz topic in a card using the `+N` chip pattern:

- A `MAPEL` row, a `BAB` row, and a `SUB` row.
- Each row shows the first item; if there are more, a `+N` chip appears with a `title` attribute revealing the full list.

## FR-QUIZ-010: Waiting Room

After joining, the system shall display:

- A "Ruang tunggu" chip with a pulsing dot.
- The headline "Menunggu admin." and the subtitle "Kuis akan segera dimulai."
- A row of three bouncing dots as a loading indicator.
- An auto-start countdown card if `scheduled_at` is set, with a clock icon and the elapsed-time mono number.
- The player avatar card with an `Ubah` (edit) action and the player name.
- The topic card with `+N` pattern.

