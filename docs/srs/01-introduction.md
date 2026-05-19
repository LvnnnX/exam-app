# 01. Introduction

## Purpose

This document defines the software requirements for the Smandapura Exam App.

Use this document to guide development, testing, maintenance, and future feature work.

## Scope

The Smandapura Exam App supports:

- Self-paced exams.
- Survival exam mode.
- Live quiz sessions.
- Student participation.
- Admin question management.
- Admin result tracking.
- Admin live quiz control.
- Category visibility settings.
- Leaderboards and result history.

The system serves students and admins through separate user flows.

## Intended Readers

This document is for:

- Developers.
- Testers.
- Admin users.
- School stakeholders.
- Future maintainers.

## Definitions

| Term | Meaning |
|---|---|
| MAPEL | Subject. |
| BAB | Chapter. |
| Sub-bab | Topic/subchapter. |
| Student | Public user taking an exam or quiz. |
| Admin | Authenticated operator managing content and sessions. |
| Super admin | Admin with full permission set. Manages other admins. |
| Strict Mode | Sequential exam mode. User cannot freely navigate backward. |
| Standard Mode | Free navigation exam mode. User may revisit questions. |
| Survival Mode | Exam mode with limited lives. |
| Live Quiz | Admin-created quiz joined by code. |
| Session | A student exam attempt or quiz participation record. |
| Joki | Jockey colors (jersey, pants, saddle) on a player's mount in live-quiz race view. |
| Mount | Animated character a jockey rides — `horse` (default) or one of 11 animal SVGs. |
| Custom skin | Encoded skin string of the form `custom:<jersey>:<pants>:<saddle>:<mount>`. |
| RPC | Remote procedure call exposed by Postgres via Supabase, used for server-authoritative writes. |
| RLS | Row Level Security policies on Postgres tables. |
| `pg_cron` | Postgres extension that schedules jobs. The app uses it to auto-start scheduled quizzes. |

