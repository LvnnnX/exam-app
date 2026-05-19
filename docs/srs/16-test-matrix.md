# 16. Test Matrix

Use this matrix when you add, change, or refactor features. Run the relevant checks before release.

## Test Scope Levels

| Level | When to Use | Required Coverage |
|---|---|---|
| Smoke | Small UI copy/style change. | App loads. Main route works. No console crash. |
| Targeted | Feature change in one area. | Changed feature + directly related flows. |
| Regression | Shared logic, auth, DB, RPC, quiz, exam, or admin change. | All core flows in this matrix. |
| Release | Before production deployment. | Full matrix. |

## Core Environment Matrix

| Area | Case | Expected Result |
|---|---|---|
| Browser | Desktop Chromium | UI works without layout break. |
| Browser | Mobile viewport | Main student/admin flows remain usable. |
| Config | Valid Supabase env | App connects normally. |
| Config | Missing env in local/dev | App reports configuration issue. |
| Network | Slow request | Loading state appears. No duplicate submit. |
| Network | Failed request | Error state appears. User can retry where supported. |

## Student Exam Setup

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-EXAM-001 | Required fields | Open app, leave name/category empty. | Begin button stays disabled. |
| TM-EXAM-002 | Exam strict setup | Enter name, choose Exam + Strict, select MAPEL/BAB/Sub-bab. | Confirmation screen shows correct values. |
| TM-EXAM-003 | Exam standard setup | Enter name, choose Exam + Standard, select categories. | Confirmation screen shows Standard mode. |
| TM-EXAM-004 | Survival setup | Choose Survival. | Navigation mode is strict/locked. |
| TM-EXAM-005 | Question count | Select each supported count. | Selected count persists to confirmation. |
| TM-EXAM-006 | Time limit | Select each time option. | Selected limit persists to confirmation. |
| TM-EXAM-007 | Category dependency | Select MAPEL, then BAB, then Sub-bab. | Child dropdowns update correctly. |
| TM-EXAM-008 | Hidden category | Hide/admin-only a category. | Student cannot select it. |

## Self-Paced Exam Execution

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-SELF-001 | Start strict exam | Complete setup, start strict exam. | First question loads. |
| TM-SELF-002 | Strict navigation | Answer current question, continue. | User advances sequentially. |
| TM-SELF-003 | Strict back restriction | Try to return freely. | Free backward navigation is unavailable. |
| TM-SELF-004 | Standard navigation | Start standard exam, jump between questions. | Navigation works. Answers persist. |
| TM-SELF-005 | Doubt flag | Mark/unmark a question doubtful. | Flag state persists in navigator. |
| TM-SELF-006 | Submit confirmation | Click submit. | Confirmation modal appears. |
| TM-SELF-007 | Submit cancel | Cancel submit modal. | Exam remains active. |
| TM-SELF-008 | Submit confirm | Confirm submit. | Score screen appears. |
| TM-SELF-009 | Surrender cancel | Click surrender then cancel. | Exam remains active. |
| TM-SELF-010 | Surrender confirm | Confirm surrender. | Session ends according to app rules. |
| TM-SELF-011 | Timer expiry | Use short duration or simulated expiry. | Session ends/submits on expiry. |
| TM-SELF-012 | Restore session | Refresh mid-exam. | Restore screen appears, then current session state returns. |
| TM-SELF-013 | Score view | Finish exam. | Score, total, categories, save status appear. |
| TM-SELF-014 | Recap view | Open breakdown. | Recap list displays attempted answers. |
| TM-SELF-015 | Restart | Click restart after result. | Setup flow resets. |

## Survival Mode

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-SURV-001 | Start survival | Complete survival setup. | Survival session starts. |
| TM-SURV-002 | Lives display | Answer questions. | Lives and score display in header. |
| TM-SURV-003 | Wrong answer | Submit wrong answer. | Lives update according to rules. |
| TM-SURV-004 | End condition | Reach zero lives or finish set. | Survival ends and result appears. |
| TM-SURV-005 | Navigation restriction | Try standard navigation behavior. | Free navigation is unavailable. |

## Live Quiz Student Flow

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-LQS-001 | Invalid code format | Enter letters/symbols in join code. | Code normalizes to digits only. |
| TM-LQS-002 | Short code | Enter fewer than 6 digits. | Join remains blocked or fails clearly. |
| TM-LQS-003 | Unknown code | Enter non-existing 6-digit code. | Error appears. |
| TM-LQS-004 | Waiting quiz join | Join waiting quiz. | Player registers and waiting flow appears. |
| TM-LQS-005 | Active quiz join allowed | Join active quiz with mid-game join enabled. | Player enters quiz. |
| TM-LQS-006 | Active quiz join blocked | Join active quiz with mid-game join disabled. | System rejects join. |
| TM-LQS-007 | Paused quiz | Join or continue paused quiz. | Paused state is respected. |
| TM-LQS-008 | Finished quiz | Try to join finished quiz. | System rejects or shows finished state. |
| TM-LQS-009 | Anonymous auth | Join without prior login. | Anonymous session is created as needed. |

## Live Quiz Execution

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-LQX-001 | Fetch question | Join active quiz. | Current question loads JIT. |
| TM-LQX-002 | Submit answer | Answer a question. | Answer saves and correctness returns. |
| TM-LQX-003 | Time taken | Submit answer after delay. | Result records time taken. |
| TM-LQX-004 | Multi-player ranking | Two players finish with different scores/times. | Leaderboard order is correct. |
| TM-LQX-005 | Tie score | Two players have same score, different time. | Faster player ranks higher. |
| TM-LQX-006 | Horse skin | Change horse skin. | Skin persists and displays. |
| TM-LQX-007 | Finish player | Complete all quiz questions. | Player is marked finished. |
| TM-LQX-008 | Safe public data | Inspect public quiz payload. | `question_ids` is absent. |
| TM-LQX-009 | Answer key safety | Inspect student question payload. | Correct answers are absent. |

## Admin Authentication

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-AUTH-001 | Unauthenticated admin | Open `/admin` signed out. | Login screen appears. |
| TM-AUTH-002 | Invalid login | Enter invalid credentials. | Error appears. |
| TM-AUTH-003 | Admin login | Enter admin credentials. | Admin dashboard appears. |
| TM-AUTH-004 | Logout | Click logout. | User returns to login state. |
| TM-AUTH-005 | Non-admin token | Call admin action as non-admin. | Request is rejected. |
| TM-AUTH-006 | Missing token | Call admin action without token. | Request is rejected. |

## Admin Question Management

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-QM-001 | List questions | Open Questions tab. | Table/list loads. |
| TM-QM-002 | Filter MAPEL | Apply MAPEL filter. | Results match filter. |
| TM-QM-003 | Filter BAB/Sub-bab | Apply nested filters. | Results match filters. |
| TM-QM-004 | Type filter | Filter multiple-choice/short-answer. | Results match type. |
| TM-QM-005 | Visibility filter | Filter hidden/visible. | Results match visibility. |
| TM-QM-006 | Search text | Search question content. | Matching questions appear. |
| TM-QM-007 | Search ID | Search by ID. | Matching ID appears. |
| TM-QM-008 | Sort | Toggle sort. | Order changes. |
| TM-QM-009 | Add multiple-choice | Create MC question with options. | Question saves. |
| TM-QM-010 | Add short-answer | Create short-answer question. | Question saves. |
| TM-QM-011 | Edit question | Modify saved question. | Changes persist. |
| TM-QM-012 | Delete cancel | Open delete modal, cancel. | Question remains. |
| TM-QM-013 | Delete confirm | Confirm delete. | Question is removed. |
| TM-QM-014 | Toggle visibility | Hide/show one question. | `is_hidden` updates. |
| TM-QM-015 | Batch visibility | Select multiple, hide/show. | All selected rows update. |
| TM-QM-016 | Rich text | Add formatted content. | Formatting renders in preview/display. |
| TM-QM-017 | Invalid payload | Save missing required fields. | Save is blocked or rejected. |

## Admin Settings

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-SET-001 | Load settings | Open Settings tab. | Category tree loads. |
| TM-SET-002 | Expand BAB | Expand/collapse BAB. | Child Sub-bab list toggles. |
| TM-SET-003 | Hide MAPEL | Mark MAPEL hidden, save. | Setting persists. |
| TM-SET-004 | Admin-only category | Mark category admin-only, save. | Student cannot see it. Admin can manage it. |
| TM-SET-005 | Dirty state | Change setting. | Save bar/state appears. |
| TM-SET-006 | Save settings | Save changes. | Save success; dirty state clears. |
| TM-SET-007 | Delete topic blocked | Delete topic with dependency. | Error modal appears. |
| TM-SET-008 | Delete topic allowed | Delete eligible topic. | Topic is removed. |

## Admin Results

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-RES-001 | Load history | Open Results tab. | History loads. |
| TM-RES-002 | Filter category | Filter by MAPEL/BAB/Sub-bab. | Results match filter. |
| TM-RES-003 | Filter mode | Filter by mode. | Results match mode. |
| TM-RES-004 | Pagination | Change result page. | Correct page loads. |
| TM-RES-005 | Stats cards | View stats. | Stats match loaded data. |
| TM-RES-006 | Detail modal | Open result details. | Detail content loads. |
| TM-RES-007 | Live sessions | Switch to live mode. | Active/waiting/paused sessions load. |
| TM-RES-008 | Live tracking | Track active session. | Current question, progress, and history show. |
| TM-RES-009 | Refresh | Click refresh. | Current mode data reloads. |

## Admin Quiz Management

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-LQA-001 | Create quiz | Select categories/count/duration and create. | Quiz is created with 6-digit code. |
| TM-LQA-002 | No questions | Create quiz with empty pool. | Creation fails clearly. |
| TM-LQA-003 | Hidden questions | Create quiz for hidden pool. | Hidden questions are excluded. |
| TM-LQA-004 | All MAPEL/BAB/Sub-bab | Create quiz using all category options. | Question pool builds correctly. |
| TM-LQA-005 | Weighted percentages | Create quiz with Sub-bab percentages. | Question distribution follows configured percentages where possible. |
| TM-LQA-006 | Schedule quiz | Set scheduled time. | `scheduled_at` saves while waiting. |
| TM-LQA-007 | Start quiz | Start waiting quiz. | Status active, `started_at` and `expires_at` set. |
| TM-LQA-008 | Pause quiz | Pause active quiz. | Status paused, `paused_at` set. |
| TM-LQA-009 | Resume quiz | Resume paused quiz. | Status active, timing shifts by pause duration. |
| TM-LQA-010 | Finish quiz | Finish active/paused quiz. | Status finished, `finished_at` set. |
| TM-LQA-011 | Delete quiz | Delete quiz session. | Quiz no longer appears. |

## Security Regression Matrix

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-SEC-001 | Correct answer exposure | Inspect student exam/live quiz payloads. | `correct_answer` and `short_answer` are absent. |
| TM-SEC-002 | Quiz question IDs exposure | Inspect public quiz lookup. | `question_ids` is absent. |
| TM-SEC-003 | Admin action without token | Call protected action without token. | Rejected. |
| TM-SEC-004 | Admin action with non-admin token | Call protected action with non-admin token. | Rejected. |
| TM-SEC-005 | Invalid question ID | Send invalid ID to admin action. | Rejected. |
| TM-SEC-006 | Invalid category field | Send invalid category field. | Rejected. |
| TM-SEC-007 | HTML content | Render rich text question. | Content renders without script execution. |
| TM-SEC-008 | Direct table access | Try student access to private fields. | RLS/views prevent exposure. |

## Performance Regression Matrix

| ID | Case | Steps | Expected Result |
|---|---|---|---|
| TM-PERF-001 | Exam start | Start exam with large question count. | Session starts within acceptable time. |
| TM-PERF-002 | JIT question load | Navigate through questions. | Each question loads without long blocking. |
| TM-PERF-003 | Admin question list | Load many questions. | UI remains responsive. |
| TM-PERF-004 | Results pagination | Navigate pages. | Page switch remains responsive. |
| TM-PERF-005 | Leaderboard update | Multiple players submit answers. | Ranking updates without UI freeze. |

## Release Checklist

Run this before production release:

- Student strict exam happy path.
- Student standard exam happy path.
- Survival mode happy path.
- Live quiz join and answer path.
- Admin login/logout.
- Admin question CRUD.
- Admin category visibility.
- Admin live quiz create/start/pause/resume/finish.
- Admin result history and live tracking.
- Security regression checks for answer/key exposure.
- Mobile viewport smoke test.
- Production env var check.
