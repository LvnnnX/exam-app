# 14. Future Recommendations

The following are not in the current SRS but are good candidates for follow-up work.

## Documentation

- Generate a formal DB schema doc from Supabase migrations and check it into `docs/db-schema.md`.
- Add a per-RPC reference doc with arguments, return shape, side effects, and permission requirements.
- Add a [test matrix per mode and feature area](16-test-matrix.md). Track manual smoke checks each release.
- Add an architecture decision record (ADR) folder for non-trivial design choices.

## Admin Tooling

- Per-admin audit log showing every CRUD action with diff and timestamp. Surface in a new "Audit" tab gated by super admin.
- Bulk question import (CSV or JSON) with dry-run preview before commit.
- Bulk question export with category filters, useful for backups and content review.
- A category-rename tool that updates affected question slugs atomically.

## Permissions

- Granular role hierarchy beyond `admin` and `super_admin` (e.g., content editor, proctor, analyst).
- Per-MAPEL ownership so different admins can curate different subjects without stepping on each other.
- Per-action explanation of permission denial so admins know whom to ask for access.

## Reliability

- Automated rate limits on quiz code joins and admin login attempts at the Supabase edge.
- Monitoring dashboard for RPC errors, slow queries, and Realtime channel health (Grafana or Supabase dashboard).
- Alerting on auto-start failures so a quiet `pg_cron` job doesn't silently miss a scheduled session.
- Healthchecks for image storage bucket usage.

## Student Experience

- Per-attempt history visible to the student via opt-in nickname + magic link (still no full account).
- Optional partial-credit scoring for short answers using fuzzy matching with a configurable threshold.
- Practice mode that reveals the correct answer after each question without persisting to results.
- Print-friendly recap view.

## Live Quiz Experience

- Spectator mode for non-playing observers (teachers, parents).
- Configurable race length and animation themes.
- Multi-mount unlocks tied to lifetime score milestones.
- Mid-game chat or quick reactions (low priority, anti-cheat tradeoffs).

## Anti-Cheat

- Optional camera-based proctoring (opt-in per session, with full disclosure).
- Detection of multiple players with the same network signature.
- Stricter focus enforcement using the Window Activation API.
- Watermarking question images with the player id to deter screenshots.

## Performance

- Edge caching of `public_categories` for shorter cold-start.
- Server-side pagination of admin Questions tab when the bank exceeds tens of thousands of rows.
- Realtime fan-out optimization for sessions with thousands of players (broadcast vs postgres_changes).

## Internationalization

- Translation infrastructure (i18next or next-intl) so the UI can ship in multiple languages.
- Per-question localization metadata.

## Accessibility

- Full keyboard nav contract for the admin dashboard.
- Screen reader audit and remediation pass.
- High-contrast theme switch on top of light/dark.
