# Self-Paced Exam Execution Requirements

## FR-EXAM-009: Start Exam Session

The system shall create an exam session via the `start_exam_session` RPC.

The RPC payload shall include:

- `student_name` (raw casing as typed).
- `mapel_list`, `bab_list`, `sub_list` (slug arrays).
- `exam_mode` (`strict` | `standard`).
- `question_count` (omitted for survival).
- `time_limit_seconds`.
- `user_agent`.

The server shall return a `session_id` and the encrypted `session_secret`. The client persists both in `localStorage` keyed by session id, encrypted via `lib/security.ts`.

Survival mode shall pass `survival = true` and rely on the per-answer feedback loop instead of a fixed question count.

## FR-EXAM-010: Fetch Questions Just-In-Time

The system shall fetch the next question via `get_exam_question(p_session_id, p_index, p_secret)`.

The server shall:

- Validate the secret.
- Reject indices outside the assigned `question_ids` range.
- Reject completed sessions.
- Return a scrambled payload containing the question body, options A–E (multiple choice) or `short_answer` slot, and the question type.
- Strip the correct-answer key from the payload — only the server retains it.

The client shall unscramble via `lib/crypto.ts` before render. Failures shall surface a "Gagal memuat soal" error card with a Retry pill.

## FR-EXAM-011: Shuffle Options

The system shall shuffle multiple-choice options A–E before render.

The shuffle is deterministic per question per session (seeded by session id and question index) so navigating back to the same question in standard mode reproduces the same option order.

## FR-EXAM-012: Show Rich Text Content

The system shall render question and option content as sanitized HTML.

DOMPurify shall sanitize the payload before render. KaTeX, table, code-block, and `<img>` tags shall be preserved. Long-press, right-click, and text selection shall be blocked inside the question card.

## FR-EXAM-013: Save Answers

The system shall save each answer via `save_exam_answer(p_session_id, p_index, p_answer_scrambled, p_secret, p_user_agent)`.

The server shall:

- Validate the secret.
- Upsert the answer keyed by `(session_id, question_index)`.
- Record `time_taken` (seconds since the question was shown).
- Return `{ saved_at }` so the client can show a `Tersimpan` chip.

The client shall debounce save calls and queue retries on transient errors. The header shall show `Menyimpan...` while a save is in-flight and `Tersimpan` once acknowledged.

## FR-EXAM-014: Strict Navigation

In strict mode, the system shall:

- Present questions sequentially driven by the server `current_index`.
- Hide the Back button entirely.
- Hide the daftar-soal modal trigger.
- Show two action pills: `Next question` and `Skip`.
- Block jumping ahead past `current_index`.

`Skip` records an empty answer and advances. `Next question` records the selected answer and advances.

## FR-EXAM-015: Standard Navigation

In standard mode, the system shall:

- Allow Back, Next, and direct jumps via the daftar-soal modal.
- Allow `Ragu-ragu` (doubt) flags per question.
- Show three action pills: `Back`, `Ragu-ragu` (toggles), and `Next` / `Finish` (last question).
- Persist current index, answers, and doubt flags in encrypted local storage so a refresh restores state.

## FR-EXAM-016: Doubtful Flag

In standard mode, the student shall mark or unmark a question as doubtful via the `Ragu-ragu` pill.

The pill turns yellow when active. The daftar-soal modal shall render doubtful tiles with a yellow fill, answered tiles with a black fill, and unanswered tiles with a neutral pill.

## FR-EXAM-017: Submit Confirmation

In standard mode, tapping `Finish` on the last question shall open a centered confirmation modal asking "Selesai ujian?".

The modal shall list the count of unanswered and doubtful questions. Two pill buttons handle navigation: `Batal` and `Selesai`.

## FR-EXAM-018: Surrender Confirmation

The system shall show a centered modal when the student taps the `Menyerah` pill.

The modal copy shall warn that surrender ends the session immediately. Two pill buttons handle navigation: `Batal` (red ghost) and `Ya, menyerah` (red filled).

Survival mode reuses the same modal with copy adjusted for the lives-based context.

## FR-EXAM-019: Timer

The system shall show the remaining time as a pill in the runtime header.

The pill shall:

- Show `MM:SS` (or `HH:MM:SS` when ≥ 60 minutes).
- Tint red when less than 60 seconds remain.
- Stop counting once the session is finished.

When the timer reaches zero, the system shall auto-submit the current answer, finalize the session, and route to the score view.

## FR-EXAM-020: Restore Session

When the page loads with an existing session id in local storage, the system shall:

- Show a centered "Memulihkan sesi..." card with a soft pulsing dot.
- Re-fetch the session via RPC.
- Restore answers, doubts, and current index from the server payload.
- Resume on the same question the student was on.

If the server reports the session is finished, the client shall route directly to the score view.

## FR-EXAM-021: Submit Exam

The system shall submit via `submit_exam_session(p_session_id, p_secret)`.

The server shall:

- Score every answer (case-insensitive, HTML-stripped, whitespace-stripped match for short answer; option label match for multiple choice).
- Compute `correct_count`, `total`, `score_percent`, and `duration_seconds`.
- Persist the session row.
- Return the recap payload.

The client shall route to the score page and clear the in-progress local storage keys.

## FR-EXAM-022: Show Score

The score view shall show:

- Eyebrow `Hasil ujian`.
- Headline with the candidate name (sentence-case).
- A score card with `correct / total` and the percentage tinted by tone:
  - ≥ 80% → green.
  - 60–79% → blue.
  - 40–59% → orange.
  - < 40% → red.
- A row of topic chips with the `+N` pattern.
- The active mode and navigation chips.
- A `Save status` chip (`Tersimpan` or `Gagal disimpan`).

Two equal-width pill buttons handle navigation: `Lihat recap` and `Ulangi`.

## FR-EXAM-023: Show Result Recap

The recap view shall list every question with:

- Index number.
- Question body (sanitized HTML).
- The student's answer with a tint tone (green for correct, red for wrong, neutral for skipped).
- The correct answer.
- A small `Ragu-ragu` chip when the student flagged the question (standard mode only).

A back pill returns to the score view.

## FR-EXAM-024: Restart

The score and recap views shall expose a `Ulangi` pill that returns the student to the setup screen with previous selections preserved.

The previous session id is cleared from local storage at this point so a fresh session id is generated on the next start.
