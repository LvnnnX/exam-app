# Admin Question Management Requirements

## FR-QM-001: View Questions

The admin shall view question records in a paginated list with row actions for hide/show/edit/delete.

## FR-QM-002: Filter Questions

The admin shall filter by:

- MAPEL (multi-select).
- BAB (multi-select; cascades from MAPEL).
- Sub-bab (multi-select; cascades from BAB).
- Question type (`multiple_choice` / `short_answer`).
- Visibility (visible / hidden / all).

## FR-QM-003: Search Questions

The admin shall search questions by free-text query (matches against `question_text`) and by exact ID.

The exact-ID search shall match `id = N`.

## FR-QM-004: Sort Questions

The admin shall sort questions ascending or descending by ID.

## FR-QM-005: Add Question

The admin shall add a question via the question modal.

Required fields:

- Question text (rich HTML, sanitized via DOMPurify).
- MAPEL (at least one).
- BAB (at least one).
- Question type.

Multiple-choice questions require options A–E and a `correct_answer` selection. Short-answer questions require a `short_answer` text.

The `created_by` column shall be set to the authenticated admin's user ID.

## FR-QM-006: Edit Question

The admin shall edit existing questions if `question:update:any` is granted, or only their own questions if only `question:update:own` is granted.

## FR-QM-007: Delete Question

The admin shall delete questions after confirmation.

The same permission split applies as FR-QM-006 (`question:delete:any` vs `question:delete:own`).

## FR-QM-008: Toggle Question Visibility

The admin shall hide or show individual questions via the row toggle.

## FR-QM-009: Batch Visibility

The admin shall select multiple questions and batch hide/show them via `BatchVisibilityConfirmModal`.

## FR-QM-010: Rich Text Editing

The admin shall edit rich text question and option content with the TipTap editor.

Supported features include:

- Bold, italic, underline, strikethrough.
- Ordered and unordered lists.
- Headings.
- KaTeX inline and block math.
- Tables (header, row, cell).
- Code blocks with syntax highlight (lowlight).
- Images uploaded to Supabase Storage and inlined as `<img>` tags.

## FR-QM-011: Multiple Choice Support

The system shall support multiple-choice questions with five options (A–E) and a single correct answer.

## FR-QM-012: Short Answer Support

The system shall support short-answer questions.

The expected answer is stored in `short_answer`. The student input shall be compared case-insensitive, HTML-stripped, and whitespace-stripped (every whitespace character removed, not just leading/trailing). Authors can space comma-separated lists or formulas freely without breaking grading.

## FR-QM-013: Category Assignment

The admin shall assign questions to:

- MAPEL (one or many).
- BAB (one or many).
- Sub-bab (one or many).

## FR-QM-014: Add Category During Question Editing

The admin shall create new MAPEL, BAB, or Sub-bab values from inside the question modal when the multi-select dropdown allows it.

## FR-QM-015: Sanitization

The system shall sanitize all incoming HTML with DOMPurify before saving and before render.

The sanitizer shall preserve KaTeX, table, code-block, and image tags.

## FR-QM-016: Image Upload

Image upload shall:

- Push the file to a Supabase Storage bucket via the editor.
- Insert the public URL into the editor as an `<img>`.
- Reject files larger than the configured limit and types outside the allow list.

