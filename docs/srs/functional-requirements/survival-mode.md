# Survival Mode Requirements

## FR-SURV-001: Start Survival Mode

The system shall allow survival mode from the exam setup screen.

Selecting Survival shall force `examMode = 'strict'` and hide the question-count picker.

## FR-SURV-002: Force Strict Flow

Survival mode shall use strict sequential navigation. The system shall not show the doubt flag, the daftar-soal modal, or the back button.

## FR-SURV-003: Track Lives

The system shall track lives during survival mode.

The default value shall be 3.

A wrong answer shall decrement lives by one. The session shall end when lives reach 0.

## FR-SURV-004: Show Survival Status

The system shall show:

- Score (compact number, top-left of the question card).
- Remaining lives (heart icons; lost lives render as grayscale with reduced opacity).
- Student name and topic chip (`+N` pattern) in the question header.

Score and lives appear in a single row at the top-left of the question card, separated by a hairline divider.

## FR-SURV-005: Per-Answer Feedback Popup

The system shall display a centered glassmorphism feedback modal after each survival answer.

The modal shall show:

- A tinted halo behind the card matching the verdict color.
- A circular icon (check for correct, cross for wrong) inside a tinted ring with an animated ping.
- A bold verdict label ("Benar" or "Salah").
- A motivational subtitle.
- An XP-style chip ("+1 score" on correct, "−1 nyawa" on wrong).

The modal shall auto-dismiss after the brief feedback window.

## FR-SURV-006: Surrender Flow

The system shall expose a `Surrender` action during survival mode.

Triggering it shall open `SurrenderConfirmModal` with:

- A red-tinted halo and flag icon.
- The headline "Menyerah sekarang?".
- A subtitle explaining that the score will be saved.
- An `Skor saat ini disimpan` chip.
- Two pill buttons: `Ya, menyerah` (red) and `Lanjut bertahan` (neutral).

Confirming shall end the session and call the result-save flow.

## FR-SURV-007: End Survival

The system shall end survival when:

- Lives reach 0 (game over).
- The student surrenders.
- The time limit expires.
- All available questions are answered.

## FR-SURV-008: Score Page

The score page shall display:

- The eyebrow `SURVIVAL SELESAI`.
- The hero number = final score (no `/total` next to the hero).
- The label `Skor akhir` and a subtitle `{total} soal terjawab`.
- A topic card with the `+N` pattern.
- A save-status chip (Menyimpan / Tersimpan / Gagal menyimpan).
- The CTA `Lihat ringkasan` to advance to the recap.

