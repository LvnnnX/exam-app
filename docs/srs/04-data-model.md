# 04. Data Model

## `questions`

Stores question bank.

| Field | Purpose |
|---|---|
| `id` | Question ID. |
| `question_text` | Rich text question body. |
| `option_a` to `option_e` | Multiple choice options. |
| `correct_answer` | Correct option. Admin/server only. |
| `question_type` | `multiple_choice` or `short_answer`. |
| `short_answer` | Correct short answer. Admin/server only. |
| `is_hidden` | Visibility flag. |
| `mapels` | Subject tags. |
| `babs` | Chapter tags. |
| `sub_babs` | Topic tags. |

## `public_categories`

Provides category data for MAPEL, BAB, and Sub-bab selection.

| Field | Purpose |
|---|---|
| `mapels` | Subject values. |
| `babs` | Chapter values. |
| `sub_babs` | Topic values. |

## `app_settings`

Stores visibility settings.

| Field | Purpose |
|---|---|
| `hidden_mapels` | Hidden subjects. |
| `admin_only_mapels` | Subjects visible only to admin. |
| `hidden_babs` | Hidden chapters. |
| `admin_only_babs` | Chapters visible only to admin. |
| `hidden_sub_babs` | Hidden topics. |
| `admin_only_sub_babs` | Topics visible only to admin. |

## `kuis_logs`

Stores live quiz sessions.

| Field | Purpose |
|---|---|
| `id` | Quiz session ID. |
| `quiz_code` | Numeric join code. |
| `mapel` | Selected subject. |
| `bab` | Selected chapter. |
| `sub_bab` | Selected topic set. |
| `question_count` | Total questions. |
| `duration_minutes` | Quiz duration. |
| `status` | `waiting`, `active`, `paused`, `finished`. |
| `question_ids` | Selected question IDs. Admin/server only. |
| `quiz_mode` | `strict` or `standard`. |
| `allow_join_mid_game` | Mid-game join control. |
| `scheduled_at` | Optional scheduled start. |
| `started_at` | Start timestamp. |
| `paused_at` | Pause timestamp. |
| `expires_at` | End timestamp. |
| `finished_at` | Finish timestamp. |

## `player`

Stores live quiz participants.

| Field | Purpose |
|---|---|
| `id` | Player ID (UUID). |
| `kuis_id` | Quiz session ID. |
| `name` | Student name (max 24 characters; raw casing preserved). |
| `score` | Score (incremented server-side on each correct answer). |
| `total_time` | Total answer time. Computed in standard mode at finish; accumulated per submit in strict mode. |
| `current_index` | Current question index, used as flow lock in strict mode. |
| `joined_at` | Join timestamp. |
| `finished_at` | Finish timestamp; populated by `finish_player_quiz_rpc`. |
| `question_ids` | Player-specific shuffled question ID list. Admin/server only. |
| `horse_skin` | Mount + jersey choice. Either a preset id (e.g. `ember`) or `custom:<jersey>:<pants>:<saddle>:<mount>`. |

## `kuis_results`

Stores live quiz answers.

| Field | Purpose |
|---|---|
| `id` | Answer row ID. |
| `player_id` | Player ID. |
| `question_id` | Question ID. |
| `user_answer` | Submitted answer. |
| `is_correct` | Correctness. |
| `time_taken` | Time used. |
| `answered_at` | Answer timestamp. |

## Exam Session Data

Self-paced exams are handled through RPC-backed session data.

The session stores:

- Student name.
- Selected categories.
- Mode.
- Question count.
- Time limit.
- Expiry time.
- Current index.
- User answers.
- Lives.
- Finish status.
- Score.
- Recap.
