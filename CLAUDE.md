# CLAUDE.md

Guide for AI assistants working on the Smandapura Exam App. Read this before making changes.

This is a companion to [`README.md`](./README.md), [`SECURITY.md`](./SECURITY.md), and [`docs/srs/`](./docs/srs/README.md). `SECURITY.md` is mandatory for all code generation and review. When the SRS and the code disagree, the code is authoritative — flag the drift and ask before "fixing" the SRS.

---

## What This Project Is

A web exam and live quiz platform for an Indonesian school. Three roles: students, admins, super admins. Built on Next.js 16 (App Router) and Supabase. Most sensitive logic runs in `SECURITY DEFINER` Postgres functions, not in the Next.js app.

If you only have time to remember three things:

1. **Never** expose `correct_answer`, `short_answer`, or `question_ids` to the browser.
2. **Always** sanitize HTML with DOMPurify before save and before render.
3. **Never** write to localStorage in plain JSON for session-related state — use `lib/security.ts` (AES-256 + HMAC-SHA256).

---

## Repository Layout

```text
app/
  page.tsx                    student exam setup + runtime
  quiz/[code]/                live quiz join, runtime, leaderboard, race view
  admin/                      admin dashboard, signup, recovery
  api/                        route handlers (sparingly used)
  actions/                    server actions (admin/, exam.ts)
  components/
    admin/                    tab panels, modals, settings tree
    exam/                     student runtime, setup, recap, score
    AdminTabSwitcher.tsx      iOS-style sidebar
    MultiSelectDropdown.tsx   multi-select with inline create
    RichContent.tsx           DOMPurify-aware HTML renderer
    Toast.tsx
  hooks/                      page-level controllers + helpers

lib/
  security.ts                 AES-256 + HMAC-SHA256 for client storage
  crypto.ts                   live payload XOR/base64 obfuscation
  quiz.ts                     leaderboard math, pass threshold (70%)
  questions.ts                question count presets
  categories.ts               slug helpers
  supabase.ts                 client config

supabase/
  migrations/                 schema, RLS, RPCs, pg_cron jobs

public/                       mount SVGs (animal mounts + horse) and static assets
docs/srs/                     software requirements specification
tests/                        Playwright specs
DESIGN.md                     visual language tokens + recipes
README.md
```

---

## How to Run

```sh
npm install
npm run dev          # http://localhost:3000 (Turbopack)
npm run build        # production build
npm run lint         # ESLint
npm run test         # Playwright (needs running dev server)
```

After significant changes, run `npm run lint` and `npm run build` before declaring done. UI changes need a manual browser pass — type checking does not catch visual regressions.

---

## Working Style for AI Agents

### Default to Reading Before Writing

This codebase has a lot of conventions baked in (iOS aesthetic, sentence-case copy, `+N` chip pattern, encrypted localStorage, server-authoritative scoring). Read related files before adding new code so you match the existing style.

For exploratory or broad searches, use the `Agent` tool with `subagent_type=Explore`. Don't run more than 3 search queries directly — delegate.

### Surgical Edits Only

Don't refactor surrounding code unprompted. A bug fix does not need a tidy-up. A new feature does not need to introduce abstractions for hypothetical future requirements.

### Match the Existing Tone

UI copy is in Bahasa Indonesia mixed with English where the English term is more natural (`Skor`, `Nyawa`, `Daftar soal`, `Ragu-ragu`, `Menyerah`, `Confirm identity`, `Start exam`, `Edit`). Use sentence case, not Title Case. Use periods at the end of sentences in cards.

### Never Write Comments Unless the Why Is Non-Obvious

Don't add comments that restate what well-named code already says. Don't reference issues, PRs, or "added for X" in code comments — those belong in the commit message.

---

## Security Guardrails

### Server-Authoritative Scoring

Every exam and quiz answer is scored inside Supabase RPCs (`SECURITY DEFINER`). The browser only learns whether its answer was correct, never the key.

If you find yourself adding a correctness check on the client, stop and use the RPC instead.

### RLS on Every Table

Every table has Row Level Security enabled. Students hit public views (`public_players`, `public_kuis_logs`, `public_categories`) which strip sensitive columns. Admin reads/writes go through RPCs.

If you add a new table, add an RLS policy in the same migration. If you add a new column that students should never see, exclude it from public views.

### Encrypted Client State

Anything written to localStorage that gates state (session ids, secrets, player ids, current index, answers, doubts) goes through `lib/security.ts`. Plain `localStorage.setItem` is a smell — search for it before adding more.

### DOMPurify Everywhere

All rich text passes through DOMPurify on save and on render. The allowlist preserves KaTeX, tables, code blocks, and `<img>` tags. Don't bypass it.

### Anti-Cheat Best-Effort

The runtime uses Wake Lock + Page Visibility + selection blocking. Treat anti-cheat as best-effort. Don't promise a guarantee in user-facing copy.

---

## Common Patterns

### Adding a New Server Action

1. Create the file under `app/actions/` (or `app/actions/admin/` for admin-only).
2. Import `"use server"` at the top.
3. Verify the caller via `requireAdmin()` (admin) or session validation (student).
4. Validate inputs at the boundary (Zod or hand-rolled).
5. Call the appropriate Supabase RPC. Don't write SQL directly in the action.
6. Return a typed result, not a raw database response.

### Adding a New RPC

1. Add a SQL migration in `supabase/migrations/` with a date prefix.
2. Make it `SECURITY DEFINER` if it bypasses RLS.
3. Validate every argument inside the function (no implicit trust).
4. Read `current_setting('app.settings.exam_secret', true)` for secret-gated RPCs.
5. Update the RPC list in `docs/srs/03-architecture.md`.

### Adding a New UI Component

1. Match the iOS aesthetic — see `DESIGN.md` for tokens.
2. Use sentence-case copy in Bahasa Indonesia (or English where natural).
3. Default to flat pills on `bg-black/5` tracks.
4. Use `rounded-2xl` / `rounded-3xl` and `shadow-ios-*`.
5. Add `transition-spring-fast` on interactive elements.
6. Support both light and dark theme via the existing theme prop.

### Adding a New Admin Tab

1. Create the panel under `app/components/admin/`.
2. Register it in `AdminTabSwitcher.tsx` with a permission requirement.
3. Use `useAdminPageController` to wire up state.
4. Match the existing tab pattern: header strip, filters, content area, modals.

### Adding a New Migration

1. File name: `<YYYYMMDD>_<short-description>.sql`.
2. Write idempotent SQL where possible (`IF NOT EXISTS`).
3. Apply RLS policies in the same migration as the table.
4. Test locally with `supabase db reset` before pushing.

---

## What to Avoid

- **Plain `localStorage.setItem` for session-related state.** Use `lib/security.ts`.
- **Client-side correctness checks.** Use the RPC.
- **Unsanitized HTML render.** Use `RichContent` or DOMPurify directly.
- **Title Case copy.** Use sentence case.
- **Em dashes for prose breaks.** Use periods or commas.
- **`!important` in CSS.** Find a better way.
- **New global state stores.** Use existing hooks or component state.
- **Adding dependencies for trivial helpers.** Inline the helper.
- **Logging PII to console.** Especially student names and answers.
- **`git add -A` or `git add .`.** Stage specific files. The repo has untracked work-in-progress.

---

## Common Tasks

### Run a Single Playwright Test

```sh
npm run test -- tests/example.spec.ts
```

### Reset the Database Locally

```sh
supabase db reset
```

This re-applies all migrations and seed data.

### Inspect Encrypted localStorage

In browser DevTools, the values look like base64 blobs. Use `lib/security.ts`'s `decrypt` from a Node REPL with the same `EXAM_SECRET_KEY` to read them.

### Find a Component by Behavior

Use `Agent` (Explore) for "where does X happen" questions. Use `Grep` directly for known symbols.

---

## When You're Unsure

- **About requirements?** Read `docs/srs/`.
- **About design tokens?** Read `DESIGN.md`.
- **About a specific RPC?** Read its SQL in `supabase/migrations/`.
- **About a UI flow?** Run `npm run dev` and click through it.
- **About the user's intent?** Ask before guessing. Cost of asking is low. Cost of wrong direction is high.

---

## House Rules

- Don't add features the user did not ask for.
- Don't add error handling for impossible cases.
- Don't add comments that restate the code.
- Don't write planning, decision, or analysis docs unless asked.
- Don't push, force-push, or amend without explicit permission.
- Do read related code first.
- Do match existing conventions.
- Do verify with `npm run lint` and `npm run build` before declaring done.
- Do flag risky actions before executing them.
