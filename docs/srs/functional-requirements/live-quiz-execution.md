# Live Quiz Execution Requirements

## FR-QUIZ-008: Fetch Live Question JIT

The system shall fetch each live quiz question just in time via `get_live_quiz_question(p_player_id, p_index, p_secret)`.

The server shall reject:

- An invalid index (out of range).
- A non-active quiz.
- A missing or invalid secret.

## FR-QUIZ-009: Scramble Question Payload

The server shall scramble the question payload before sending it to the browser.

Scrambling reduces casual inspection. It is not encryption. The authoritative correctness check still runs server-side.

## FR-QUIZ-010: Unscramble Client Payload

The client shall unscramble the payload via `lib/crypto.ts` before display.

If unscrambling fails, the client shall surface a load error and let the user retry.

## FR-QUIZ-011: Submit Secure Answer

The client shall scramble the answer before submitting via `submit_live_quiz_answer_v2`.

The server shall:

- Validate the secret.
- Verify the question ID matches the player's assigned `question_ids[index]`.
- In strict mode, enforce sequential `current_index`.
- In standard mode, UPSERT into `kuis_results` and recompute the score (subtract old, add new).
- Increment `total_time` and bump `current_index` as appropriate.
- Return `{ success, is_correct }`.

## FR-QUIZ-012: Track Time Taken

The system shall record `time_taken` (seconds) for each submitted answer.

In standard mode, total time is recomputed at finish via `finish_player_quiz_rpc` to keep clock-skew-free duration.

## FR-QUIZ-013: Return Correctness

The system shall return whether the answer is correct.

For multiple choice, the server compares against `correct_answer`. For short answer, the server compares (case-insensitive, HTML-stripped, trimmed) against `short_answer`.

## FR-QUIZ-014: Finish Player Quiz

The system shall mark a player finished via `finish_player_quiz_rpc(p_player_id)`.

After RPC completes, the client shall re-fetch `public_players` to mirror the server-authoritative `score` into React state. This guarantees the leaderboard "Skor kamu" matches the player's ranked row.

The client shall keep `quiz_player_<code>` in encrypted local storage so a refresh on the leaderboard still recognises the user.

The client shall remove `quiz_index_<code>`, `quiz_answers_<code>`, and `quiz_doubts_<code>`.

## FR-QUIZ-015: Leaderboard

The system shall rank players by:

1. Score descending.
2. Total time ascending.
3. Joined-at ascending (tie breaker).

In standard mode, players who have not yet finished display a hidden score (rendered as `?` and `0` for ranking).

## FR-QUIZ-016: Horse Skin

The system shall let players set a horse skin via `set_player_horse_skin(p_player_id, p_horse_skin)` while the session is `waiting`.

The RPC shall accept either a preset id or a `custom:` string (4 or 5 parts) and validate every hex color and the mount id.

## FR-QUIZ-017: Horse Racing View

The system shall display leaderboard progress through a horse racing modal.

Requirements:

- Rows are ordered by `joined_at` so they remain stable as ranks change.
- Rank badges and crowns animate when a player's rank changes.
- The horse gallops forward when its score increases.
- Confetti fires when a player crosses the finish line.
- Each row uses the player's mount + jersey colors. Mount images come from `/public` SVGs and are recolored at render time. The horse mount uses placeholder hexes `#37b5e1`, `#0468a6`, `#444`, `#ff8e00`. The animal mounts use placeholder hexes `#ff8e00` (jersey), `#c8c8c8` (pants), `#37b5e1` (saddle), `#0468a6` (saddle dark).

## FR-QUIZ-018: Active Quiz Layout

The active quiz runtime shall use the same layout for strict and standard modes:

- Header row: player name, mode chip (`Survival` or `Exam`), topic chips with `+N`, timer pill, daftar-soal pill (standard only), saved/pending chip.
- Question card: top-left header `Soal No. X` with optional score + lives strip on the right (survival), divider hairline, then the question body and option list (`bg-white` flat pills with circular A–E label).
- Action bar: equal-width pill buttons. Strict shows `Next question` + `Skip`. Standard shows `Back` + `Ragu-ragu` + `Next/Finish`.

## FR-QUIZ-019: Daftar Soal Modal

In standard mode, the system shall expose a `Daftar soal` button in the header.

Clicking shall open a modal grid with:

- Legend dots: black (terjawab), yellow (ragu), neutral (kosong).
- A grid (6 cols mobile, 8 cols desktop) where each tile shows the question number.
- The current tile shall have a `ring-2 ring-nike-black ring-offset-2`.
- Tiles use the corresponding state color (filled black, yellow, neutral pill).

## FR-QUIZ-020: Submit Confirm

In standard mode, the `Finish` button shall open a confirmation modal asking "Selesai kuis?".

Confirming runs `finishStandardQuiz` (FR-QUIZ-014). Cancelling closes the modal.

## FR-QUIZ-021: Anti-cheat Hooks

The active quiz runtime shall:

- Lock the screen via Wake Lock API where supported.
- Block text selection inside question content.
- On repeated tab-visibility loss, auto-submit the current answer and finish the player. The threshold lives in `useQuizSecurityGuard`.
- Show a warning modal explaining the violation.

