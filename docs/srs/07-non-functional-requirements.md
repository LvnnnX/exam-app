# 07. Non-Functional Requirements

## Security

### NFR-SEC-001: Secret Protection

The system shall never expose `EXAM_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the browser.

These are loaded from environment variables and used only inside server actions, RPC bodies (via Supabase secret config), and `lib/security.ts` running on the server.

### NFR-SEC-002: Admin Authorization

Admin server actions shall verify the Supabase access token and the admin's email + role on every call.

The token is read from the encrypted `admin_session` cookie. Server actions reject the call when the token is missing, expired, or belongs to a non-admin user.

### NFR-SEC-003: Safe Public Reads

Student-facing quiz lookup shall use public views (`public_players`, `public_kuis_logs`, `public_categories`) that exclude `question_ids`, `correct_answer`, and `short_answer`.

RLS policies on the underlying tables block direct anonymous reads.

### NFR-SEC-004: Correct Answer Protection

The system shall not expose `correct_answer` or `short_answer` to student clients.

The server scores answers inside RPC bodies. The client only learns whether its answer was correct, never the key.

### NFR-SEC-005: RPC Enforcement

Sensitive exam and quiz operations shall run through Supabase RPC (`SECURITY DEFINER`) or Next.js server actions.

This includes: `start_exam_session`, `save_exam_answer`, `submit_exam_session`, `join_player_to_quiz`, `get_live_quiz_question`, `submit_live_quiz_answer_v2`, `finish_player_quiz_rpc`, all admin question CRUD, all live quiz CRUD.

### NFR-SEC-006: Input Validation

The system shall validate at the server boundary:

- Question IDs (positive integers, exists in DB).
- Question payloads (sanitized HTML via DOMPurify allowlist).
- Category field names (slugs match `^[a-z0-9-]+$`).
- Quiz codes (6 digits).
- Admin access tokens (Supabase JWT verification).
- Mount + jersey hex codes (`^#[0-9a-fA-F]{6}$`).

### NFR-SEC-007: RLS Compatibility

The system shall keep Supabase RLS enabled on every table.

Anonymous and authenticated students access public views only. Admin reads/writes go through RPC functions running with elevated privileges.

### NFR-SEC-008: Anonymous Student Isolation

Live quiz students shall sign in via Supabase anonymous auth so per-player ids exist for RLS scoping.

The anonymous user id pairs with the encrypted `quiz_player_<code>` localStorage key so a refresh restores the player without re-authenticating.

### NFR-SEC-009: Rich Text Safety

The system shall sanitize incoming rich text HTML with DOMPurify before save and render.

The allowlist preserves KaTeX, table, code-block, and `<img>` tags. Inline event handlers and `<script>` are stripped.

### NFR-SEC-010: Payload Obfuscation

Live quiz question payloads and answer payloads shall be scrambled via `lib/crypto.ts` during browser transfer.

Scrambling is XOR + base64, not encryption. Server-side answer validation remains required (FR-QUIZ-013).

### NFR-SEC-011: Anti-cheat Hooks

The active quiz runtime shall:

- Lock the screen via Wake Lock API where supported.
- Block right-click and text selection inside question content.
- On repeated tab-visibility loss, auto-submit and finish the player (threshold defined in `useQuizSecurityGuard`).

### NFR-SEC-012: Rate Limiting

Sensitive RPCs (login, signup request, answer submission) shall apply per-user or per-IP rate limits via the Supabase edge gateway.

## Performance

### NFR-PERF-001: JIT Question Loading

The system shall load questions just in time to reduce initial payload size.

### NFR-PERF-002: Efficient Filtering

The system shall filter categories and questions using database queries where practical.

### NFR-PERF-003: Pagination

Admin result history shall use pagination.

### NFR-PERF-004: Responsive UI

The UI shall remain responsive during loading, saving, and tracking states.

### NFR-PERF-005: Live Leaderboard Sorting

Leaderboards shall sort by score and total time efficiently.

### NFR-PERF-006: Minimal Sensitive Payloads

Student views shall receive only data required for current interaction.

## Reliability

### NFR-REL-001: Session Recovery

The system shall support restoring exam state after interruption.

### NFR-REL-002: Save Status

The system shall show save progress and save failure states.

### NFR-REL-003: Loading States

The system shall show loading states for:

- Auth check.
- Question preparation.
- Result details.
- Settings load.
- Live session load.

### NFR-REL-004: Error Feedback

The system shall show user-facing errors for failed operations where needed.

### NFR-REL-005: Time Expiry Handling

The system shall handle expired exam or quiz sessions consistently.

## Usability

### NFR-USE-001: Clear Mode Selection

The app shall clearly distinguish Exam, Survival, Strict, and Standard modes.

### NFR-USE-002: Guided Setup

The app shall disable start until required fields are complete.

### NFR-USE-003: Confirmation Before Final Actions

The app shall confirm:

- Exam submit.
- Surrender.
- Question deletion.
- Batch visibility changes.
- Topic deletion where applicable.

### NFR-USE-004: Mobile-Friendly Layout

The UI shall support desktop and mobile layouts.

### NFR-USE-005: Help Tooltips

The setup screen shall provide help text for key choices.

### NFR-USE-006: Admin Tabs

Admin functions shall be grouped into tabs.

## Maintainability

### NFR-MAIN-001: Modular Components

The UI shall use modular components for exam, admin, quiz, and modal features.

### NFR-MAIN-002: Hook-Based Controllers

Page logic shall use hooks/controllers to separate state and UI.

### NFR-MAIN-003: Typed Data Models

The app shall use TypeScript types for core records.

### NFR-MAIN-004: Server Action Boundaries

Protected mutation logic shall remain in server actions.

### NFR-MAIN-005: Configurable Environment

Supabase and exam secret configuration shall come from environment variables.

## Compatibility

### NFR-COMP-001: Browser Support

The app shall support current versions of major browsers.

### NFR-COMP-002: Supabase Compatibility

The app shall remain compatible with Supabase JS client and Supabase Auth.

### NFR-COMP-003: Next.js Compatibility

The app shall follow Next.js app-router conventions.
