# 13. Risks and Constraints

## Client Trust Risk

Students use browsers. Anything sent to the client can be inspected, including network payloads, localStorage, and JavaScript variables.

**Mitigation:**

- Never expose `correct_answer` or `short_answer` to the browser.
- Score every answer server-side inside `SECURITY DEFINER` RPCs.
- Strip sensitive columns from public views.
- Encrypt session secrets in localStorage (`lib/security.ts`).

**Residual:** A determined student can still read scrambled payloads, scrape questions, and re-take. The system limits damage but does not prevent leaks of question text.

## Payload Scrambling Limit

`lib/crypto.ts` performs XOR + base64 obfuscation, not encryption. The shared key sits in the bundle.

**Mitigation:**

- Treat scrambling as a casual inspection deterrent, not a security boundary.
- Keep authoritative correctness checks server-side.
- Rotate the key on suspected compromise.

## Supabase Dependency

The app cannot function without Supabase. Outages, throttling, or pricing changes affect every feature.

**Mitigation:**

- Show loading states and clear error messages on RPC failures.
- Surface "coba lagi" pills on transient errors.
- Keep RPC bodies idempotent so retries are safe.

**Residual:** Long Supabase outages take the entire app down.

## Realtime Reliability

Live quiz tracking relies on Supabase Realtime channels. Channel failures or duplicate-callback bugs degrade the admin tracking experience.

**Mitigation:**

- Use a unique channel name `player_answers_<id>_<ts>_<random>` per subscription.
- Run a polling fallback every N seconds in admin Live mode.
- Re-fetch on modal open.

## Category Consistency

Questions reference MAPEL/BAB/Sub-bab as slugs. Inconsistent or stale slugs orphan questions or hide them from students.

**Mitigation:**

- Use the SettingsMapelTree as the canonical category source.
- Reject topic deletes that would orphan questions.
- Provide an "Add new" affordance in question modal multi-selects.

## Auto-Start Drift

`pg_cron` ticks once per minute. Auto-start fires up to one minute late.

**Mitigation:**

- Document the tolerance to admins.
- Display a countdown so students know the start is imminent.

## Encryption Key Rotation

Rotating `EXAM_SECRET_KEY` invalidates all encrypted localStorage entries (active exams, joined live quiz players).

**Mitigation:**

- Rotate during low-traffic windows.
- Communicate planned rotations to operators.

## Browser API Availability

Wake Lock and Page Visibility behave differently across browsers and OS versions.

**Mitigation:**

- Treat anti-cheat as best-effort.
- Fall back to soft warnings when APIs are unavailable.

## Anti-Cheat Limits

The current anti-cheat (Wake Lock + tab visibility + selection block) does not stop:

- Phone cameras photographing the screen.
- Second-monitor setups.
- Voice assistants.
- Pre-printed cheat sheets.

**Mitigation:** Position the system as supportive proctoring, not enforced proctoring. Schools that need stronger guarantees should pair with human proctoring.

## Image Storage Cost

TipTap image uploads land in Supabase Storage. Heavy use grows storage cost and hits bandwidth limits.

**Mitigation:**

- Cap upload size in the editor.
- Reject non-image MIME types.
- Periodically prune orphaned images (manual operator task).

## Performance at Scale

The app has been tested with hundreds of concurrent live quiz players. Multi-thousand player events have not been load-tested.

**Mitigation:** Stage load tests before large events. Scale Supabase plan accordingly.

## Single Region

Supabase project runs in a single region. Latency outside that region degrades the runtime.

**Mitigation:** Pick a region close to the school's primary geography. Consider read replicas if usage expands.
