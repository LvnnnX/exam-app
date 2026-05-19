# 15. Summary

The Smandapura Exam App is a web-based exam and quiz platform built on Next.js 16 (App Router) and Supabase. It serves three roles: students, admins, and super admins.

## What the System Does

**For students:**

- Self-paced exam mode with strict or standard navigation, configurable categories, time limits, and question counts.
- Survival mode with three lives, instant per-answer feedback, and tone-aware score views.
- Live quiz join via 6-digit code, mount + jersey customization, real-time leaderboard, and a horse-racing animation finale.

**For admins:**

- Question CRUD with rich text (TipTap + KaTeX + tables + code), batch visibility, free-text and exact-ID search, and per-tier category assignment.
- Live quiz creation with auto-start scheduling, manual control (pause/resume/finish), per-player tracking, and remedial quiz building.
- Result history with stats, filters, pagination, and live tracking modal driven by Supabase Realtime.
- Settings tree for category visibility (Hidden / Admin only / Visible) with orphan-safe deletes.

**For super admins:**

- Admin signup approval queue.
- Permission management.
- Admin removal.

## Design Pillars

- **Server-authoritative scoring.** Every exam and quiz answer is scored inside `SECURITY DEFINER` RPCs. Correct answers never reach the browser.
- **Encrypted state.** Session secrets and player ids in localStorage go through `lib/security.ts` (AES-256 + HMAC-SHA256).
- **Sanitized rich text.** All HTML passes through DOMPurify on save and render.
- **iOS-style minimalist UI.** Sentence-case copy, `+N` chip pattern for topic lists, soft shadows, spring animations, glass-blur modals, dark-theme parity throughout.
- **Anonymous student auth.** Live quiz players use Supabase anonymous sessions so RLS still applies without forcing accounts.

## What This SRS Covers

Sections 01–15 in this folder define the requirements. The detailed FRs sit in `functional-requirements/`. Acceptance criteria sit in `acceptance-criteria/`. The test matrix in section 16 maps each FR to a smoke test.

## What This SRS Does Not Cover

See section 12 for the explicit out-of-scope list. Section 14 documents future recommendations the team may pick up over time.

## How to Read This Document

- Start with section 02 (Overall Description) for context.
- Skim section 03 (Architecture) to understand the moving parts.
- Read the functional-requirements files for what each feature must do.
- Cross-check section 07 (Non-Functional Requirements) and section 08 (Business Rules) when making design decisions.
- Use the test matrix in section 16 before each release.

## Core Promise

Students get a reliable exam flow with anti-cheat best-effort. Admins get safe operational control. Sensitive scoring logic stays server-side.
