# Smandapura Exam App — Design System

## Overview

The Smandapura Exam App's visual language is grounded in iOS-style minimalism: tight typography, soft elevation, generous spacing, and chrome that quiets down so content can breathe. Every screen reads like a native iOS surface — flat pill components on neutral tracks, sentence-case copy in Inter (with SF Pro Display as the closest substitute), gentle spring animations on every interactive surface, and glass-blur modal backdrops that defocus the underlying state without hiding it.

The system runs on three relentless devices: rounded geometry (everything is `rounded-2xl` or `rounded-3xl` — no sharp corners anywhere), tone-aware accent colors that map score ranges to green/blue/orange/red, and the `+N` chip pattern that compresses long topic lists into a single chip plus a subtle counter. Across the student exam runtime, the live quiz race view, the admin dashboard, and the modal layer, the same chrome appears at the same proportions — only the content changes.

**Key Characteristics:**

- iOS-style soft shadows (`shadow-ios-sm` through `shadow-ios-xl`) replace boxy borders. Cards float gently rather than sit hard.
- Spring animations (`transition-spring-fast`, `transition-spring`) on every pill, modal, and dropdown — never linear ease.
- Glass-blur modal backdrops (`backdrop-blur-xl` over `bg-black/40`) defocus the underlying state without hiding it.
- Sentence-case copy throughout. "Confirm identity.", not "CONFIRM IDENTITY". Periods at the end of card headlines.
- The `+N` chip pattern for topic lists: show the first chip, then a `+N` chip for the rest. Used in setup, runtime, score, and recap views.
- Tone-aware accent colors: scores ≥ 80% tint green, 60–79% blue, 40–59% orange, < 40% red. Mode chips use neutral for Exam and red for Survival.
- Full dark theme parity. Every component supports a `theme` prop and the admin sidebar exposes a header pill toggle.

## Colors

### Brand Neutrals

- **Nike Black** (`bg-nike-black` — `#111111`): Used for primary CTAs, the `Tampilkan` row toggle, the active filter chip, mount strokes, and runtime text. The system's "voice."
- **Pure White** (`bg-white` — `#ffffff`): Page background in light theme, on-image text on dark photos, modal content surface.
- **Off-white track** (`bg-black/5` — `rgba(0, 0, 0, 0.05)`): The most-used non-white surface. Carries every input track, segmented control background, dropdown trigger, and ghost pill.
- **Hairline divider** (`border-black/10` — `rgba(0, 0, 0, 0.1)`): 1px separators between modal sections, table rows, and stat cards.

### Dark Theme Palette

Used when `body.admin-dark-theme` is active or when `theme="dark"` is passed to a themed component.

- **dark-900** (`#0a0a0a`): App shell background.
- **dark-800** (`#111111`): Card surface in dark theme.
- **dark-700** (`#1a1a1a`): Elevated surface (modal, dropdown panel).
- **dark-600** (`#262626`): Hover/active fill on dark surfaces.
- **dark-text** (`#f5f5f5`): Primary text on dark.
- **dark-text-muted** (`#a3a3a3`): Secondary text and metadata on dark.

### Accent (Score / Mode / Stat Cards)

Used sparingly. Always tone-tinted at the same opacity (`/10` or `/15` for fills, `/100` for text).

- **accent-blue** (`#0a84ff`): Primary stat tint, info chips, neutral score band (60–79%).
- **accent-green** (`#34c759`): Pass tint, correct-answer pill, top score band (≥ 80%).
- **accent-red** (`#ff3b30`): Survival mode chip, wrong-answer pill, danger CTAs (`Menyerah`, `Hapus`), low score band (< 40%).
- **accent-purple** (`#af52de`): Settings tab accent, doubt-flag fill alternate, secondary stat tint.
- **accent-orange** (`#ff9500`): Mid-band score tint (40–59%), `Ragu-ragu` pill fill.
- **accent-yellow** (`#ffcc00`): Daftar-soal modal "ragu" tile fill.

### Semantic

- **Success** (`accent-green`): Save confirmation chip, pass tint, correct answer halo.
- **Warning** (`accent-orange`): `Ragu-ragu` pill, mid-band score, low-time timer pill (≥ 60s remaining).
- **Danger** (`accent-red`): Surrender modal, wrong answer halo, low-time timer pill (< 60s).
- **Info** (`accent-blue`): Default stat card tint and mode chip.

## Typography

### Font Family

- **Inter** (primary UI typeface) — variable weight 400/500/600/700. Loaded via `next/font` in `app/layout.tsx`. Used for all UI chrome, body copy, and headlines.
- **SF Pro Display** (target reference) — Apple's display typeface. Inter approximates it closely on Windows where SF Pro is not available.
- **JetBrains Mono** — used inside TipTap code blocks (`pre`, `code`).
- **KaTeX font stack** — loaded by KaTeX for inline and block math.

### Hierarchy

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| display | 56px | 700 | 1.05 | Score view headline (sentence case + period) |
| heading-xl | 32px | 600 | 1.15 | Modal headlines (`Confirm identity.`) |
| heading-lg | 24px | 600 | 1.2 | Tab panel titles, card section headers |
| heading-md | 18px | 600 | 1.3 | Card titles, modal section labels |
| heading-sm | 16px | 600 | 1.4 | Pill button label, multi-select trigger |
| body-md | 14px | 500 | 1.5 | Body copy in cards, dropdown options |
| body-strong | 14px | 600 | 1.5 | Selected option label, active nav row |
| caption | 12px | 500 | 1.4 | Metadata, eyebrow text (`Step 2 of 2`), chip count |
| eyebrow | 11px | 600 | 1.3 | Tracked uppercase label above headlines (rare; only on score view) |
| code | 13px | 500 | 1.5 | Code blocks via JetBrains Mono |

### Principles

The system runs on a tight typographic ladder. The biggest jump is reserved for the score view (`display` 56px). Everything else lives between 12px and 32px. Sentence case is mandatory. Periods at the end of card headlines reinforce the iOS feel ("Confirm identity.", "Pilih kuda kamu."). Tracked uppercase appears only as the eyebrow on the score view (`Step 2 of 2`, `Hasil ujian`).

## Layout

### Spacing Scale

Tailwind's default 4px base unit, with iOS-style generosity. The system favors larger gaps than typical web UI.

- `gap-2` (8px): Inside chip rows, between option pills.
- `gap-3` (12px): Card content rhythm.
- `gap-4` (16px): Form field rhythm.
- `gap-6` (24px): Section rhythm inside cards.
- `gap-8` (32px): Section rhythm between cards.
- `p-4` (16px): Compact card padding (mobile).
- `p-6` (24px): Default card padding.
- `p-8` (32px): Modal content padding.
- `space-y-6` (24px): Default vertical rhythm.
- `space-y-8` (32px): Generous vertical rhythm.

### Grid & Container

- **Max width:** `max-w-screen-xl` (1280px) for the admin dashboard, `max-w-2xl` (672px) for the student exam setup, `max-w-md` (448px) for join code modal.
- **Sidebar:** 240px fixed width on desktop, collapsing to a hamburger drawer at narrow widths.
- **Tab content area:** fills the remaining viewport with `p-8` outer padding.
- **Modal:** centered with `max-w-2xl` to `max-w-4xl` depending on content density.

### Whitespace Philosophy

Whitespace is a feature, not filler. Cards breathe at `p-6` to `p-8` internal padding. Modal sections separate with `space-y-8`. The student runtime card uses `p-8` to match iOS card generosity. Don't pack content. The system trades horizontal density for vertical rhythm.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | No shadow, no border | Inputs, segmented control tracks, ghost pills |
| 1 — `shadow-ios-sm` | `0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)` | Default card surface, dropdown panel |
| 2 — `shadow-ios-md` | `0 4px 16px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)` | Active filter pill, primary CTA |
| 3 — `shadow-ios-lg` | `0 8px 32px rgba(0,0,0,0.16), 0 4px 8px rgba(0,0,0,0.12)` | Modal content, tracking modal |
| 4 — `shadow-ios-xl` | `0 16px 48px rgba(0,0,0,0.20), 0 8px 16px rgba(0,0,0,0.16)` | Confirmation modals, surrender modal |

In dark theme the shadow alpha doubles to keep elevation legible against the near-black surface.

## Shape Vocabulary

| Token | Value | Use |
|---|---|---|
| `rounded-full` | 9999px | Pill buttons, chips, score circle, mount avatar, swatch dot |
| `rounded-3xl` | 24px | Modal containers, primary cards |
| `rounded-2xl` | 16px | Inputs, dropdown trigger, secondary cards, tab panel content |
| `rounded-xl` | 12px | Small cards inside modals, daftar-soal tiles |
| `rounded-lg` | 8px | Code block edges only |

There are **no sharp corners** anywhere in the system. If a component needs a square corner, the design is wrong.

## Animation

### Timing Functions

- **`transition-spring-fast`** (250ms, `cubic-bezier(0.34, 1.56, 0.64, 1)`): Default for hover, focus, and small state flips. Has a tiny overshoot for iOS feel.
- **`transition-spring`** (400ms, same curve): Modal enter/exit, dropdown panel slide, larger movements.
- **`transition-colors`** (150ms ease): Theme toggle, chip tone changes — anything that's just a color flip with no movement.
- **`transition-opacity`** (200ms ease): Fades for the daftar-soal modal backdrop, toast enter/exit.

### Motion Principles

- **Spring, not linear.** Linear easing reads as "web". The overshoot curve reads as "native iOS".
- **One animation at a time per element.** Don't combine `scale` + `translate` + `rotate` on the same trigger.
- **Subtle, not flashy.** A 1.02 scale on hover is enough. 1.1 is too much.
- **Stagger lists when possible.** The score view's score circle scales in first, then the topic chips, then the action pills.

## Components

### Buttons

**`pill-primary`** — universal CTA
- Container: `bg-nike-black` (or `bg-white` on dark theme), text white, `rounded-full`, `h-12`, `px-8`, `text-sm`, `font-semibold`.
- Shadow: `shadow-ios-sm` default, `shadow-ios-md` on hover, `transition-spring-fast`.
- Used on: `Start exam`, `Mulai`, `Gabung`, `Save`, `Selesai`.

**`pill-secondary`** — soft alternative
- Container: `bg-black/5` (or `bg-white/10` on dark theme), text inherits, `rounded-full`, `h-12`, `px-8`.
- No shadow. `transition-spring-fast` on hover (subtle 1.01 scale).
- Used on: `Edit`, `Batal`, `Tutup`.

**`pill-ghost`** — minimal action
- Container: transparent, text inherits with `opacity-70`, `rounded-full`, `h-10`, `px-6`.
- Hover: `bg-black/5` fill.
- Used on: header utility actions (`Refresh`, `Theme toggle`).

**`pill-danger`** — destructive action
- Container: `bg-accent-red`, text white, `rounded-full`, `h-12`, `px-8`.
- Used on: `Ya, menyerah`, `Hapus permanen`. Always paired with a `pill-secondary` `Batal` partner.

**`pill-icon`** — circular icon button
- Container: `bg-black/5`, `rounded-full`, `h-10 w-10`, icon `h-4 w-4`.
- Used on: chevron paddles, copy code, dropdown chevron, sidebar toggle.

### Inputs

**`text-input`**
- Container: `bg-black/5`, `rounded-2xl`, `h-12`, `px-5`, `text-sm font-medium`.
- Focus: `bg-white` (or `bg-dark-700` on dark), `ring-2 ring-nike-black/20`, `transition-spring-fast`.
- Used on: name input, search input, signup form.

**`dropdown-trigger`**
- Same shape as `text-input`. Right-aligned chevron icon. Click opens a panel.
- Selected value renders left-aligned in `font-semibold`.

**`multi-select`**
- Same trigger shape. Selected values compress with the `+N` chip pattern: first chip is fully labeled, the rest collapse to a single `+N` chip.

**`segmented-control`**
- Container: `bg-black/5`, `rounded-full`, `p-1`. Each tab is a flex-1 cell.
- Active cell: `bg-white shadow-ios-sm`, `transition-spring-fast`. The white pill slides between tabs (CSS transform on a pseudo element).
- Used on: mode picker (Exam / Survival), navigation picker (Strict / Standard), Results toggle (History / Live).

### Cards & Containers

**`card`** — default surface
- Container: `bg-white` (or `bg-dark-800` on dark theme), `rounded-3xl`, `p-6` to `p-8`, `shadow-ios-md`.
- Hover: `shadow-ios-lg` with `transition-spring-fast`. No translate.

**`card-flat`** — embedded card inside a card
- Container: `bg-black/5` (or `bg-dark-700` on dark), `rounded-2xl`, `p-4` to `p-6`, no shadow.
- Used inside modals to group related content.

**`stat-card`** — admin Results tab summary card
- Container: `bg-white`, `rounded-3xl`, `p-6`, `shadow-ios-md`.
- Top: tinted icon circle (`bg-accent-{color}/10`, icon in `text-accent-{color}`).
- Headline: large number `text-3xl font-semibold`.
- Subtitle: `text-xs text-black/50`.
- Each card uses one accent (blue/green/purple/orange).

**`+N-chip-row`** — topic display pattern
- Layout: horizontal flex with `gap-2`.
- First chip: full label (e.g., `Matematika`), `bg-black/5` fill, `rounded-full`, `px-3 py-1`, `text-xs font-medium`.
- Overflow chip: `+N` where N is `total - 1`, same shape but slightly tighter (`px-2.5`).
- Used in: setup confirmation, runtime header, score view, history rows, admin live tracking modal.

### Modals

**`modal-backdrop`**
- Container: `fixed inset-0 z-40 bg-black/40 backdrop-blur-xl`.
- Click closes the modal (unless dismissable=false).
- `transition-opacity` 200ms ease.

**`modal-shell`**
- Container: `bg-white` (or `bg-dark-800`), `rounded-3xl`, `shadow-ios-xl`, `max-w-2xl` to `max-w-4xl`.
- Padding: `p-8` for content, `px-8 py-6` for header.
- Close button: top-right `pill-icon` with `×` glyph.
- Enter: `transition-spring` 400ms with `scale(0.96) → 1` and `opacity(0 → 1)`.

**`confirmation-modal`**
- Smaller variant (`max-w-md`).
- Centered headline (`heading-lg`).
- Centered description (`body-md text-black/60`).
- Two equal-width pills at the bottom: secondary (left) + primary or danger (right).

### Navigation

**`admin-sidebar`** (`AdminTabSwitcher`)
- Container: 240px fixed width, `bg-white` (or `bg-dark-900` on dark), full height.
- Brand row: app logo + name at top, `p-6`.
- Tab buttons: `rounded-2xl`, `px-5 py-4`, `transition-spring-fast`.
- Active tab: `bg-black/5` (or `bg-white/5` on dark), `shadow-ios-sm`, icon in accent color.
- Hover: `bg-black/3` fill.
- Bottom row: theme toggle pill, account chip.

**`tab-segmented`** (Results tab History/Live toggle, similar pattern)
- Same as `segmented-control` but full-width inside the tab content.

### Status Indicators

**`mode-chip`**
- `Exam`: `bg-black/5 text-black`.
- `Survival`: `bg-accent-red/10 text-accent-red`.
- Shape: `rounded-full px-3 py-1 text-xs font-semibold`.

**`status-chip`** (live quiz session status)
- `waiting`: `bg-accent-orange/10 text-accent-orange`.
- `active`: `bg-accent-green/10 text-accent-green`.
- `paused`: `bg-accent-blue/10 text-accent-blue`.
- `finished`: `bg-black/5 text-black/60`.

**`save-chip`** (runtime header)
- Idle (saved): `bg-accent-green/10 text-accent-green` with `Tersimpan` label and a tiny dot.
- Pending: `bg-accent-orange/10 text-accent-orange` with `Menyimpan...` label.
- Failed: `bg-accent-red/10 text-accent-red` with `Gagal disimpan` label.

**`timer-pill`**
- Default: `bg-black/5`, label `MM:SS` in `font-mono font-semibold`.
- Low time (< 60s): `bg-accent-red/10 text-accent-red` with a subtle pulse animation.

### Runtime-Specific

**`question-card`**
- Container: `bg-white`, `rounded-3xl`, `p-8`, `shadow-ios-md`.
- Header: `Soal No. X` left-aligned, optional score + lives strip right-aligned (survival).
- Divider: 1px `border-black/10` hairline.
- Body: sanitized HTML with `prose` styles.
- Options: 5 stacked option pills (A–E) with `bg-white border-2 border-black/10`, `rounded-2xl`, `p-4`.
- Selected option: `border-nike-black bg-black/5`, animated A–E label fills with `bg-nike-black text-white`.

**`daftar-soal-modal`**
- Modal shell with a grid of question tiles.
- Grid: `grid-cols-6` mobile, `grid-cols-8` desktop, `gap-2`.
- Tiles: `aspect-square rounded-xl`, label = question number.
- States:
  - Answered: `bg-nike-black text-white`.
  - Doubt: `bg-accent-yellow text-nike-black`.
  - Empty: `bg-black/5 text-black/40`.
- Current tile: `ring-2 ring-nike-black ring-offset-2`.
- Legend dots row at top: black, yellow, neutral with labels.

**`feedback-popup`** (survival per-answer)
- Centered overlay over the question card.
- Halo: large blurred circle in green (correct) or red (wrong).
- Ping: secondary ring expanding outward, `animate-ping`.
- Chip: `+1 skor` (green) or `−1 nyawa` (red) inside a pill.
- Auto-dismisses after ~800ms.

### Score & Recap

**`score-circle`**
- Large centered circle, `w-48 h-48`, `rounded-full`.
- Background: `bg-accent-{tone}/10`.
- Inner number: `text-6xl font-bold text-accent-{tone}`.
- Label below: `text-sm font-medium text-black/60`.
- Tone derived from score percentage:
  - ≥ 80% → green.
  - 60–79% → blue.
  - 40–59% → orange.
  - < 40% → red.

**`recap-row`**
- Container: `card-flat`, `rounded-2xl`, `p-4`.
- Layout: question index pill (left), question body (center), tone-tinted answer chip (right).
- Tone:
  - Correct: `bg-accent-green/10 text-accent-green`.
  - Wrong: `bg-accent-red/10 text-accent-red`.
  - Skipped: `bg-black/5 text-black/60`.
- Standard mode: optional `Ragu-ragu` chip in `accent-yellow` next to the answer.

### Mount & Jersey Picker

**`mount-preset-row`**
- Horizontal scroll row of 12 preset mount swatches (horse + 11 animals).
- Each swatch: `w-24 h-24 rounded-3xl`, mount SVG centered with the preset color palette applied.
- Active preset: `ring-2 ring-nike-black ring-offset-4`.

**`mount-custom-card`**
- Card with mount preview at top (large SVG), color picker grid below.
- Color picker: 4 or 5 swatch rows (jersey, pants, saddle, saddle dark, depending on mount type).
- Each swatch: `w-8 h-8 rounded-full` with native color picker on tap.
- Save button at bottom: `pill-primary` `Simpan kuda`.

### Race View

**`race-track`**
- Container: full-bleed `bg-gradient-to-b from-sky-50 to-emerald-50` (light) or `from-dark-900 to-dark-800` (dark).
- Stable rows ordered by `joined_at` so positions don't shuffle as ranks change.
- Each row: rank badge (left), mount SVG (center, animates left → right with score), name + score chip (right).
- Crown icon animates above the top 3 rows when ranks change.
- Confetti fires when a player crosses the finish line (`canvas-confetti`).

## Theming

### Light Theme (default)

- Page background: `bg-white`.
- Card surface: `bg-white`.
- Embedded card: `bg-black/5`.
- Text: `text-black`.
- Muted text: `text-black/60`.
- Border: `border-black/10`.
- Shadows: standard alpha (0.06–0.20).

### Dark Theme

Activated by `body.admin-dark-theme` or by passing `theme="dark"` to a themed component. Persists per admin via cookie.

- Page background: `bg-dark-900`.
- Card surface: `bg-dark-800`.
- Embedded card: `bg-dark-700`.
- Text: `text-dark-text`.
- Muted text: `text-dark-text-muted`.
- Border: `border-white/10`.
- Shadows: doubled alpha (0.30–0.40).

The dark theme keeps the same accent colors (green, blue, red, purple, orange) at the same opacities so the mode chips, status chips, and score tones read identically across themes.

## Do's and Don'ts

### Do

- Use sentence case throughout. End card headlines with a period (`Confirm identity.`).
- Reach for `rounded-2xl` and `rounded-3xl` by default. Use `rounded-full` for pills and chips.
- Apply `shadow-ios-md` to cards and `shadow-ios-xl` to modals. Don't reinvent shadow scales.
- Use `transition-spring-fast` on every interactive surface. Linear easing reads as web, not iOS.
- Compress topic lists with the `+N` chip pattern. The first chip is fully labeled; the rest become a single counter.
- Tone-tint score views by percentage band (green ≥ 80, blue 60–79, orange 40–59, red < 40).
- Pair a `pill-secondary` `Batal` with a `pill-primary` or `pill-danger` confirm in every confirmation modal.
- Match modal padding to content density: `p-8` for confirmation modals, `p-6` for tracking modals with dense content.
- Test light and dark theme parity for every new component.

### Don't

- Don't use `rounded-md` or `rounded-lg` for buttons or cards. Pill or 2xl/3xl — that's it.
- Don't introduce drop-shadow alternatives outside the `shadow-ios-*` scale.
- Don't pack content. The system trades horizontal density for vertical rhythm.
- Don't use accent colors as primary chrome. They live on chips, score tones, and stat icons only.
- Don't underline anything except inline links inside `RichContent`. No underlined buttons or headings.
- Don't introduce a third button shape. Pill or icon-circular — that's the entire vocabulary.
- Don't promise anti-cheat guarantees in copy. The runtime is best-effort.
- Don't hardcode hex values. Use the Tailwind tokens (`text-accent-green`, `bg-black/5`).
- Don't ship a feature without dark theme support.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| desktop-lg | 1280px+ | Default admin dashboard layout — sidebar visible, full stat card row |
| desktop | 1024–1279px | Sidebar visible, slightly tighter outer padding |
| tablet | 768–1023px | Sidebar collapses to a hamburger drawer, tab content full-width |
| mobile-lg | 600–767px | Single-column stat cards, modal `max-w-full` with `mx-4` |
| mobile | 320–599px | Single-column student runtime, daftar-soal grid drops to 6 cols |

### Touch Targets

All interactive elements meet 44×44px minimum. Pill buttons sit at `h-12` (48px) with `px-8` padding. Icon-circular buttons sit at `h-10` (40px) with internal hit-area padding extending to ~48px. Daftar-soal tiles are `aspect-square` with grid gaps that yield ~44px tile size at mobile width.

### Collapsing Strategy

- **Admin sidebar:** desktop fixed → tablet hamburger drawer → mobile bottom-sheet drawer.
- **Stat card row:** 4-up desktop → 2-up tablet → 1-up mobile.
- **Question option pills:** always full-width stack regardless of breakpoint.
- **Modal width:** `max-w-2xl` desktop → `max-w-full mx-4` mobile.
- **Daftar-soal grid:** 8 cols desktop → 6 cols mobile.
- **Mount preset row:** horizontal scroll on all breakpoints, snapping to swatch boundaries.

## Iteration Guide

1. **Start from existing components.** Almost every UI need can be expressed as a combination of `pill-*`, `card`, `modal-shell`, `segmented-control`, `+N-chip-row`, and the score/recap primitives. Add a new token only when you've ruled out reuse.
2. **Match the tone.** Open the closest existing screen, copy its density and rhythm, then adapt. Don't invent a new card shape on the fly.
3. **Mind the dark theme.** Every new color decision needs a dark-theme counterpart. The accent palette is theme-agnostic; the surface palette is not.
4. **Lint before merging.** Run `npm run lint` and `npm run build`. Visual regressions don't show up in either — pair with a manual browser pass.
5. **Document new tokens.** If you add a new utility (e.g., `shadow-ios-2xl`), add it to this file's table so the next contributor doesn't reinvent it.
6. **Reserve display typography.** The 56px display tier belongs to the score view. Don't use it for tab titles or modal headlines.
7. **Preserve sentence case.** `Start exam` is right. `Start Exam` is wrong. `START EXAM` is very wrong.

## Known Gaps

- **Animation specs are loose.** The spring curve and timing values are documented, but per-component choreography (e.g., score view stagger order) lives in component code.
- **Accessibility audit.** The system uses Inter at 14px+ for body, which is legible on most displays, but a formal WCAG AA audit has not been run.
- **Print styles.** No print stylesheet exists for the score or recap views. Adding one is in `docs/srs/14-future-recommendations.md`.
- **Reduced-motion fallback.** Spring animations honor `prefers-reduced-motion: reduce` only where the component uses `transition-spring-*`. Manual `animate-*` classes (`animate-ping`, `animate-pulse`) do not.
- **High-contrast theme.** Not yet implemented. Tracked in future recommendations.
