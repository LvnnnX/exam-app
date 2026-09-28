# Student Exam Setup Requirements

## FR-EXAM-001: Select Exam Mode

The system shall let the student select:

- Exam (default).
- Survival.

Selecting Survival shall force `examMode = 'strict'` and hide the question-count picker.

The mode picker is rendered as a 2-tab segmented control with `bg-black/5` track and a white sliding pill for the active option.

## FR-EXAM-002: Select Navigation Mode

For Exam mode (not Survival), the system shall let the student select:

- Strict.
- Standard.

Strict mode uses sequential navigation with no Back button. Standard mode allows free navigation, doubt flags, and a daftar-soal modal.

A helper line under the segmented control summarises the active mode.

## FR-EXAM-003: Enter Student Name

The system shall require a non-empty student name before starting.

The student name shall be limited to 16 characters. The homepage input enforces the cap with `maxLength={16}` and slices on change so paste cannot exceed it. The exam-start server action (`startExamSessionAction`) trims and slices to 16 as a server-side guard, and the mobile API route rejects payloads with a name longer than 16 characters.

The input persists raw casing the user types and renders as a flat pill (`bg-black/5`).

## FR-EXAM-004: Select Categories

The system shall require:

- MAPEL (multi-select).
- BAB (multi-select).
- Sub-bab (multi-select).

The system shall:

- Disable BAB until at least one MAPEL is selected.
- Disable Sub-bab until at least one BAB is selected.
- Filter BAB options to those that exist for the selected MAPEL list.
- Filter Sub-bab options to those that exist for the selected BAB list.

## FR-EXAM-005: Apply Visibility Settings

The system shall hide categories marked `hidden` or `admin_only` from students.

Hidden values shall not appear in the dropdown. Admin-only values shall be excluded from student-facing fetches.

## FR-EXAM-006: Select Time Limit

The system shall let students select a global time limit via a dropdown.

The available options come from `TIME_LIMIT_OPTIONS` in `app/hooks/examControllerConstants.ts`.

The dropdown renders as a flat pill `bg-black/5` with a chevron icon, matching the rest of the form.

## FR-EXAM-007: Select Question Count

The system shall let students select a question count via a dropdown.

Supported counts come from `QUESTION_COUNTS` in `lib/questions.ts`. The current set is:

- 5
- 10
- 20
- 25
- 30
- 40
- 50
- 100

The Time limit and Question count dropdowns shall render in a single 2-column row when Exam mode is active. Survival mode shows only the Time limit dropdown, full-width.

## FR-EXAM-008: Confirm Identity

The system shall show a confirmation step (`ConfirmIdentityStep`) before starting.

The confirmation card shall show:

- Eyebrow `Step 2 of 2`.
- Headline `Confirm identity.` (sentence-case).
- Candidate name.
- Mode (`Survival` red or `Exam` neutral).
- Navigation (only when Exam).
- Topic — three rows MAPEL / BAB / SUB with the `+N` chip pattern.
- Question count (`All` for Survival).
- Time limit.
- Lives indicator (Survival only).

Two equal-width pill buttons handle navigation: `Edit` (returns to setup) and `Start exam` (proceeds to runtime).

