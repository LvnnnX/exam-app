# Admin Settings Requirements

## FR-SET-001: View Category Tree

The admin shall view the MAPEL → BAB → Sub-bab hierarchy in a single tree view (`SettingsMapelTree`).

Each row exposes its current visibility state via three pill buttons (Hidden / Admin only / Visible).

## FR-SET-002: Expand/Collapse BAB

The admin shall expand or collapse Mapel and Bab sections to drill into Sub-bab rows.

The expansion state is local to the session and not persisted.

## FR-SET-003: Manage Visibility

The admin shall configure the following visibility flags per tier:

- Hidden MAPEL.
- Admin-only MAPEL.
- Hidden BAB.
- Admin-only BAB.
- Hidden Sub-bab.
- Admin-only Sub-bab.

Hidden categories disappear from student selection. Admin-only categories appear only in admin tools.

## FR-SET-004: Save Visibility

The admin shall save visibility settings via `saveVisibilitySettingsAction`, which upserts the row in the `app_settings` table.

On success, the system shall display a `success` toast: "Settings saved. Changes appear on next page load."

On failure, the system shall display an `error` toast with the underlying error message.

## FR-SET-005: Delete Topic

The admin shall delete topics from any tier, provided they have the `topic:delete` permission.

The system shall:

- Find every question that uses the slug.
- Reject deletion if any question would become orphaned (no remaining tier value).
- Otherwise remove the slug from each affected question.

## FR-SET-006: Show Delete Errors

When deletion fails, the system shall open `DeleteTopicErrorModal` showing:

- The headline "Tidak dapat menghapus".
- The reason copy.
- A list of affected question IDs as red-tinted pill chips.
- A `Tutup` action.

