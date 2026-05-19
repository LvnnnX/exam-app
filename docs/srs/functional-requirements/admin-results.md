# Admin Results Requirements

## FR-RES-001: View Result History

The admin shall view historical results in the Results tab.

History rows include candidate name, mode, topic chips, score, date, and duration.

## FR-RES-002: Paginate Results

The system shall paginate result history with a configurable rows-per-page selector and prev/next controls.

The pagination strip is rendered above the table on both desktop and mobile.

## FR-RES-003: Filter Results

The admin shall filter results by:

- MAPEL (multi-select).
- BAB (multi-select).
- Sub-bab (multi-select).
- Mode (`all`, `exam`, `survival`).
- Live vs History (toggle).

## FR-RES-004: View Result Stats

The system shall show summary stats above the table:

- Attempts count.
- Average score percentage.
- Pass rate percentage (score ≥ 70%).
- Average duration.

Each stat card uses a tinted accent (blue, green, purple, orange) for quick scan.

## FR-RES-005: View Result Details

The admin shall open a detailed result modal (`ResultDetailsModal`) showing the candidate, topic, time range, score, and per-question breakdown.

## FR-RES-006: View Live Sessions

The admin shall switch the Results tab to Live mode and see currently-active student sessions.

Live rows include answered count, lives, progress bar, and start time.

## FR-RES-007: Refresh Results

The admin shall manually refresh history or live sessions via the Refresh pill in the header.

A polling fallback runs at a low frequency for live sessions.

## FR-RES-008: Track Live Progress

The admin shall open a live tracking modal (`TrackingModal`) for any in-progress session.

The modal shall show:

- Current question with the answer choice the student has selected.
- Progress stats (answered, current index, lives, time left).
- Session history (every answer the student has submitted).

When the session is not finished, the modal shall subscribe to a Supabase Realtime channel to refresh on new answers.

