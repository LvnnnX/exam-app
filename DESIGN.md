# Smandapura Exam App: Design System (Glass + Clay)

This file is the single source of truth for the visual layer. Every token named here exists in `app/globals.css`. If a class in a component disagrees with this file, the component is wrong.

## Design read and dials

> Reading this as: an exam and live-quiz tool for Indonesian high-school students (public side) and their teachers (admin side), in a calm glass-and-clay language, dial ENERGY 1 / RHYTHM 1 / MOTION 1. The race view is the one exception at MOTION 2, because motion is the content there.

- **ENERGY 1 (calm).** Students open this app to be tested. The interface should lower the pulse, not raise it.
- **RHYTHM 1 (uniform).** Admin and exam screens are tools that are used every day. Predictable layout is a feature. Uniformity is deliberate here.
- **MOTION 1.** Hover, press, and state changes only. No loops, no scroll reveals. Race view gets MOTION 2 (mount movement, rank change, finish confetti) because those movements carry information.

## Character in one sentence

Frosted glass panels float over a quiet mist canvas; everything a student can hold (their score, their rank, their mount, the button that moves them forward) is a soft clay object sitting on that glass.

## Glass vs clay: the hierarchy

This is the most important rule in the system. Glass is the main character. Clay is the accent.

| Treatment | Where | Why (purpose test, R-31) |
|---|---|---|
| **Glass** | Site header, admin sidebar, mobile drawer, single cards and panels, dropdown panels, popovers, help tooltips, toasts | These surfaces float above the canvas. Blur plus a lit top edge tells the eye "this is a layer on top", so depth is readable without heavy shadows. |
| **Glass sheet** (glass look, no blur) | Modal shells, repeated cards that sit directly on the canvas (student weakness cards, analytics scope cards), a control that sits directly on the canvas (the subject search) | Same fill, hairline and lit edge as glass, so it belongs to the family, but no `backdrop-filter`. Modals need it because blur would trap their nested fixed dialogs (rule 4). Repeated cards need it because blur on every card is rule 3. A lone control on the canvas needs a visible edge, which a `well` tint does not give it there. |
| **Clay** | Primary buttons, stat cards and big numbers, number tokens (question number, rank, lives), mount avatar pedestal, score circle | These are the things a person presses or owns. Soft inner highlight plus a low outer shadow reads as a physical object, which contrasts with the flat translucent glass it sits on. |
| **Well** (neither) | Inputs, segmented-control tracks, table rows, list rows, chips inside glass | Content inside a surface. A faint tint separates it from the glass without adding another blur layer. |

**Hard rules**

1. **One element, one treatment.** Never put `glass` and `clay-*` on the same element. A clay button can sit on a glass card; it is never itself glass.
2. **When unsure, use glass.** Clay is reserved for tangible objects. If you cannot say what a person would "hold", it is not clay.
3. **No blur on repeated items.** Table rows, list rows, option buttons and grid tiles never get `backdrop-filter`. They use `well` or a plain tint. Repeated cards that sit straight on the canvas use `glass-sheet`. Blur on every row or card is both slop and a performance problem.
4. **No blur on an element that contains a `position: fixed` child.** `backdrop-filter` creates a containing block, so a dialog rendered inside a blurred element is trapped inside it. That is why every modal shell is `glass-sheet` over a `glass-scrim`: the math and table dialogs inside the question editor open from inside the modal shell.
5. **Glass is never a control.** Buttons, inputs and selects are `well`, `clay-*` or a tint. The one exception is a control that sits directly on the canvas, which uses `glass-sheet` (no blur) so it has an edge.
6. **No glass stacked more than two deep.** Canvas, then a glass surface, then optionally a glass popover. A third blurred layer turns text to fog.

## Colors

The palette is two core families plus one accent. Danger is a functional status color used only for destructive actions and wrong answers.

| Role | Family | Why |
|---|---|---|
| Core 1, brand and primary action | **Pine** | A muted teal-green. Calm, academic, reads as "go / correct" without the loudness of a pure green. It is not the blue-purple default. |
| Core 2, neutral | **Ink** | A cool slate with a trace of green so it sits in the same temperature as Pine. All text, lines, and surfaces. |
| Accent (one deliberate accent) | **Amber** | The warm counterweight. Used only at key moments: the race leader, the doubt flag (`Ragu-ragu`), time running low, the "you" marker on the leaderboard. |
| Functional status | **Brick** | Destructive buttons (`Hapus`, `Menyerah`), wrong answers, errors. Never decorative. |

### Scales

| Step | Ink | Pine | Amber | Brick |
|---|---|---|---|---|
| 50 | `#f4f7f7` | `#eef6f3` | `#fdf6ec` | `#fcf1ef` |
| 100 | `#e8eeee` | `#d5ebe3` | `#f9e8cc` | `#f8ddd8` |
| 200 | `#d3dcdc` | `#aed7c9` | `#f2d09a` | `#f0bcb3` |
| 300 | `#aebbbc` | `#7fbca9` | `#e9b567` | `#e59384` |
| 400 | `#5f6f72` | `#529d88` | `#df9a3f` | `#d86b58` |
| 500 | `#4f5f63` | `#36806c` | `#c98129` | `#c4503c` |
| 600 | `#3f4c50` | `#2a6858` | `#a8661f` | `#a63f2e` |
| 700 | `#313c40` | `#235447` | `#86501c` | `#873327` |
| 800 | `#232d31` | `#1d443a` | `#6b411c` | `#6e2c24` |
| 900 | `#182023` | `#183831` | `#58371a` | `#5c2821` |
| 950 | `#0e1416` | `#0c201b` | `#321d0b` | `#32120e` |

Ink 400 is deliberately darker than a typical "400". It is the lightest step allowed for text and it passes AA (4.51:1) even on the bare canvas.

### Semantic tokens (switch with the theme)

Use these in new code. They resolve per theme, so a component that uses them needs no `theme === 'dark' ? ... : ...` branch.

| Token (Tailwind class) | CSS var | Light | Dark |
|---|---|---|---|
| `bg-canvas` | `--canvas` | `#e9efee` | `#0e1416` |
| `text-fg` | `--fg` | Ink 900 `#182023` | `#eef3f2` |
| `text-fg-muted` | `--fg-muted` | Ink 500 `#4f5f63` | `#b9c6c6` |
| `text-fg-subtle` | `--fg-subtle` | Ink 400 `#5f6f72` | `#8b9c9e` |
| `border-line` | `--line` | `rgba(24,32,35,.10)` | `rgba(255,255,255,.08)` |
| `border-line-strong` | `--line-strong` | `rgba(24,32,35,.18)` | `rgba(255,255,255,.16)` |
| `text-primary` / `bg-primary` | `--primary` | Pine 600 `#2a6858` | Pine 300 `#7fbca9` |
| `text-on-primary` | `--on-primary` | `#ffffff` | Ink 950 `#0e1416` |
| `text-danger` / `bg-danger` | `--danger` | Brick 600 `#a63f2e` | Brick 300 `#e59384` |
| `text-on-danger` | `--on-danger` | `#ffffff` | Ink 950 |
| `bg-highlight` | `--highlight` | Amber 400 `#df9a3f` | Amber 300 `#e9b567` |
| `text-on-highlight` | `--on-highlight` | Ink 900 | Ink 950 |
| `text-highlight-fg` | `--highlight-fg` | Amber 700 `#86501c` | Amber 300 `#e9b567` |
| `text-warn` / `bg-warn` | `--warn` | Amber 600 `#a8661f` | Amber 300 `#e9b567` |

Measured contrast (WCAG, antislop contrast checker):

| Pair | Ratio |
|---|---|
| Ink 900 on canvas (light) | 14.21:1 |
| Ink 500 on canvas-ish `#eef3f2` | 5.35:1 |
| Ink 400 on canvas `#e9efee` (worst case) | 4.51:1 |
| White on Pine 600 (primary button, light) | 6.52:1 |
| Ink 950 on Pine 300 (primary button, dark) | 8.55:1 |
| Pine 300 on dark card `#162023` | 7.64:1 |
| `#9fb0b1` (dark tertiary) on `#1b2629` | 6.87:1 |
| `#8b9c9e` (dark subtle) on `#1b2629` | 5.42:1 |
| Pine 600 on Pine 50 (chip) | 5.94:1 |
| Brick 600 on Brick 50 (chip) | 5.63:1 |
| White on Brick 600 (danger button) | 6.23:1 |
| Brick 300 on dark card | 6.99:1 |
| Amber 700 on Amber 50 / Amber 100 | 6.16:1 / 5.49:1 |
| Ink 900 on Amber 400 (doubt tile) | 6.96:1 |
| Amber 300 on dark card | 8.91:1 |

### Canvas

The canvas is not flat. It carries two very large, very soft light fields (Pine top-left, Amber bottom-right) on a mist base, fixed to the viewport (`body::before`).

- **Purpose:** glass needs something to diffuse. Over a flat color, glass is just a grey rectangle. The light fields are what make the blur visible as depth.
- **Dose:** light theme 28 to 30 percent alpha, dark theme 18 to 30 percent alpha. No animation, no noise, no grid.

### Score tones

The thresholds are the ones the code already used before the redesign; only the colors changed. There are two scales because they answer two different questions.

Student score (score circle, results header). Question: "did I pass?"

| Band | Tone |
|---|---|
| 70 percent and up | Pine (`text-primary`, ring `--primary`) |
| 50 to 69 percent | Ink (`text-fg`, ring `--fg-muted`) |
| Below 50 percent | Brick (`text-danger`, ring `--danger`) |
| Survival mode | Ink, always (the result is lives, not a grade) |

Teacher analytics (topic accuracy, student weakness). Question: "where do I intervene?" Amber marks the middle band because it is the band a teacher acts on.

| Band | Tone |
|---|---|
| Above 70 percent accuracy | Pine |
| Above 50 up to 70 percent | Amber 700 (`text-highlight-fg`) |
| 50 percent and below | Brick |

### Legacy aliases (do not use in new code)

The codebase predates this system. To keep every screen on-palette without rewriting 1,000+ class names, `app/globals.css` re-points the old names:

| Old class family | Now resolves to |
|---|---|
| `gray-*`, `slate-*`, `zinc-*`, `neutral-*`, `stone-*` | Ink |
| `blue-*`, `sky-*`, `cyan-*`, `indigo-*`, `green-*`, `emerald-*`, `teal-*`, `lime-*` | Pine |
| `violet-*`, `purple-*`, `fuchsia-*` | Ink |
| `orange-*`, `amber-*`, `yellow-*` | Amber |
| `red-*`, `rose-*`, `pink-*` | Brick |
| `black` | Ink 950 |
| `nike-black`, `nike-grey-*`, `nike-red`, `nike-green`, `nike-blue` | Ink 900, Ink steps, Brick 600, Pine 600, Pine 600 |
| `dark-*` surfaces and `dark-text-*` | Ink-tinted dark steps (see `@theme` block) |
| `accent-blue`, `accent-green`, `accent-teal` | `--primary` (switches with theme) |
| `accent-red` | `--danger` |
| `accent-orange` | `--warn` |
| `accent-purple` | `--fg-muted` |

This is a palette lock, not a license. It exists so an old class cannot leak an off-palette color. New code uses Ink, Pine, Amber, Brick, or the semantic tokens.

## Typography

- **Plus Jakarta Sans** (primary, variable 400 to 700), loaded through `next/font` in `app/layout.tsx` as `--font-jakarta`.
  - **Why:** it was drawn in Jakarta by Tokotype, so the product speaks with a typeface made where its users live. Its open apertures and tall x-height keep 13 to 15px text legible when it sits on a blurred surface, where thin, tight-set faces start to smear. It has real tabular figures, so timers and scores line up without switching to a monospace.
- **Code only:** `"Fira Code", "JetBrains Mono", ui-monospace` inside TipTap and `RichContent` code blocks. Monospace is never used as decoration.
- **KaTeX** keeps its own font stack for math.

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| display | 44px / 1.05 (mobile 36px) | 700 | Score view number, page hero title |
| title-1 | 32px / 1.1 | 700 | Page titles (`Take the exam.`, `Leaderboard.`) |
| title-2 | 22px / 1.2 | 650 | Panel and modal titles |
| title-3 | 17px / 1.3 | 600 | Card titles, question number |
| body | 14 to 15px / 1.5 | 500 | Body copy, options |
| small | 13px / 1.45 | 500 | Secondary copy, buttons |
| caption | 12px / 1.4 | 500 | Metadata, field labels |
| micro | 11px / 1.3 | 600 | Chip text, table headers |

Rules: sentence case everywhere (`Start exam`, not `Start Exam`). Card headlines may end with a period. No wide-tracked uppercase labels; a field label is 12px sentence case in `text-fg-muted`. Numbers use `tabular-nums`.

## Radius

| Class | Value | Use |
|---|---|---|
| `rounded-lg` | 8px | Chips, small tags, inner tiles, code blocks |
| `rounded-xl` | 12px | Buttons (clay), inputs, selects, segmented tracks, question-grid tiles |
| `rounded-2xl` | 16px | Rows inside glass, option buttons, inner cards, toasts |
| `rounded-3xl` | 24px | Glass cards and panels, stat cards |
| `rounded-4xl` | 28px | Modals, sidebar panel |
| `rounded-full` | 9999px | Only round things: avatars, status dots, score circle, switch knobs |

Buttons are not pills anymore. A 12px radius reads as a key you press; a pill reads as a tag. Radius grows with surface size, so the hierarchy is visible from the corners alone.

## Blur and backdrop-filter

| Utility | Background | Blur / saturate | Use |
|---|---|---|---|
| `glass` | light `rgba(255,255,255,.62)`, dark `rgba(24,34,37,.56)` | 18px / 150% | Cards, panels, sidebar, site header |
| `glass-strong` | light `rgba(250,252,252,.86)`, dark `rgba(22,31,34,.88)` | 28px / 150% | Dropdown panels, popovers, help tooltips, toasts, mobile drawer |
| `glass-sheet` | same as `glass-strong` | none | Modal shells, repeated cards on the canvas, a control on the canvas (see the hierarchy table) |
| `glass-scrim` | `rgba(14,20,22,.32)` light, `.55` dark | 6px | Full-screen backdrop behind a modal |

Edge: every glass surface has a 1px hairline (`--glass-border`) and a 1px inner top highlight (`--glass-highlight`), plus a single soft drop (`--glass-drop`). The highlight is what makes it read as glass rather than as a translucent box.

**Contrast guarantee on glass.** Text contrast is measured against the glass color composited over the canvas, not against the canvas alone. Because `glass` is at least 56 percent opaque and `glass-strong` at least 86 percent, the composited surface stays within a few percent of `#f6f9f9` (light) or `#161f22` (dark), and every text token above passes AA on it. When `backdrop-filter` is not supported, `@supports` swaps in the opaque `--glass-solid` color so contrast never depends on the blur.

**When blur is allowed:** only on surfaces listed in the table above with a blur value. Not on rows, tiles, buttons, chips, inputs, or modal shells. Behind a modal the blur comes from the scrim, so the page underneath still softens while the shell stays a plain sheet.

## Clay

Clay is two inner shadows and one or two outer shadows on an opaque fill.

```css
/* light, neutral clay (stat cards, tokens, pedestal) */
background: #f3f6f5;
box-shadow:
  inset 0 1.5px 0 rgba(255, 255, 255, .95),   /* lit top edge */
  inset 0 -3px 6px rgba(24, 32, 35, .07),     /* shaded underside */
  0 1px 2px rgba(24, 32, 35, .08),            /* contact shadow */
  0 8px 18px -10px rgba(24, 32, 35, .30);     /* soft drop */

/* dark, neutral clay */
background: #1f2b2f;
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, .07),
  inset 0 -3px 6px rgba(0, 0, 0, .35),
  0 1px 2px rgba(0, 0, 0, .40),
  0 10px 22px -12px rgba(0, 0, 0, .80);

/* pressed (both themes, clay buttons only) */
transform: translateY(1px);
box-shadow: inset 0 2px 4px rgba(24, 32, 35, .16), 0 1px 1px rgba(24, 32, 35, .06);
```

| Utility | Fill | Use |
|---|---|---|
| `clay` | neutral (above) | Stat cards, score circle, number tokens, mount pedestal, secondary buttons that need weight |
| `clay-primary` | `--primary` with white top highlight and a pine-tinted drop | The one primary action per view (`Begin session`, `Start exam`, `Next`, `Simpan`, `Gabung`) |
| `clay-danger` | `--danger` | Confirmed destructive action (`Ya, menyerah`, `Hapus`) |
| `clay-highlight` | `--highlight` | Amber token: race leader, doubt state |

Disabled clay loses its shadows and drops to a `well` tint with `text-fg-subtle`, so a disabled button visibly stops being an object.

## Well (inset content)

| Utility | Light | Dark | Use |
|---|---|---|---|
| `well` | `rgba(24,32,35,.045)` | `rgba(255,255,255,.05)` | Inputs, segmented tracks, rows, secondary buttons, chips |
| `well-hover` (applied on `:hover`) | `.07` | `.08` | Hover fill |

## Spacing

Tailwind's 4px base unit. The scale in use is 4, 8, 12, 16, 20, 24, 32, 40, 48.

| Space | Use |
|---|---|
| 8px (`gap-2`) | Inside chip rows, between a label and its control |
| 12px (`gap-3`) | Between rows in a list, between buttons in a footer |
| 16px (`p-4`, `gap-4`) | Card padding on mobile, form field rhythm |
| 20px (`p-5`) | Default card padding |
| 24px (`p-6`, `gap-6`) | Modal body padding, between cards |
| 32px (`gap-8`) | Between page sections |
| 40 to 64px (`pt-10` to `pt-16`) | Page top padding |

Page gutter is 16px on phones (`px-4`) and grows to 24 to 32px from `md`.

## Motion

| Token | Value | Use |
|---|---|---|
| `--ease-calm` | `cubic-bezier(.2, .8, .2, 1)` | Everything. No overshoot. |
| `--dur-fast` | 150ms | Hover, press, color flips |
| `--dur-base` | 220ms | Panel and modal enter, dropdown open |
| `--dur-slow` | 320ms | Score circle fill, race lane progress |

Utilities: `transition-calm` (color, background, border, shadow, transform, opacity at 150ms). `animate-in` gives a modal or panel a single 220ms fade plus a 4px rise. The legacy names `transition-spring` and `transition-spring-fast` now resolve to the calm curve.

framer-motion (used where CSS cannot do the job):
- **`MotionConfig`** in `app/providers.tsx` sets the default transition to 320ms on the calm curve and `reducedMotion="user"`, so every `motion.*` element drops transform and layout animation for visitors who ask for reduced motion. No component sets a spring.
- **Morphs (`layoutId`).** A button that opens its own screen grows into it: Join with code into JoinQuizModal, Ujian terjadwal into ScheduledExamEntry, Daftar soal into the question grid (exam and live quiz), Surrender into its confirm, Ubah into the avatar editor. The button and the dialog share one `layoutId`. Purpose: it answers "where did this come from", so the student does not lose their place. Only buttons that open a dedicated screen morph; ordinary confirms do not.
- **Modal enter and exit.** `app/components/ui/motion-presets.ts` exports `scrimMotion` (fade) and `sheetMotion` (fade plus a 4px rise, scale 0.985, 220ms). Spread them on `motion.div` inside `<AnimatePresence>` so a modal also animates out. A sheet that hosts `position: fixed` children (the question editor shell) uses `scrimMotion` on both layers, because a transform would become their containing block.

Principles:
- Motion answers "what just changed?" and nothing else.
- Press is a 1px sink, not a bounce.
- No infinite loops outside real live state. A pulsing dot is allowed only on a genuinely live indicator (live quiz running, timer under 60 seconds).
- **Reduced motion:** under `prefers-reduced-motion: reduce`, CSS animations and transitions collapse to near zero (global rule in `globals.css`), the race view skips its Web Animations API gallop and rank bounce, and confetti is disabled (`disableForReducedMotion`). Mount position changes still happen, instantly.

## Race view

The race is the gamified heart of the live quiz. The concept (lanes, mounts, finish line, crowns for top three, confetti on finish) stays. The decoration is what changed.

- **Lanes** are `well` strips inside a `glass-strong` modal. The progress fill is a flat Pine tint (`--primary` at 14 percent), not a per-skin rainbow gradient.
- **Finish line** is a 2px dashed Ink rule, not a checkerboard.
- **Mount** sits on a small clay pedestal disc (a shadow, not a box) so it reads as a game piece on a board. Mount size is fixed per breakpoint.
- **Name and score** sit in the lane as a normal-weight label (`text-fg-muted`, 13px, sentence case), not a 15px black uppercase watermark.
- **Rank** is a clay token with the number. Ranks 1 to 3 add a simple two-tone crown glyph (Amber for 1, Ink 300 for 2, Amber 700 for 3), no gems.
- **Leader** is the only amber element in the lane list.
- **No emoji** anywhere in the race UI.
- **Motion:** on score increase the mount glides forward along the lane (320ms), does a short 3-step gallop (±3px, 2 iterations), and leaves a single dust puff (`horse-dust`). Rank changes move the token by 3px with a 400ms ease. Confetti uses the palette (Pine, Amber, Ink 300) with 60 particles and is disabled for reduced motion.
- **Keyframes:** `horse-bounce` (idle breathing, 1.5px, only in the waiting room and avatar editor preview), `horse-gallop` (used by the race), `horse-dust` (one puff per score increase).

### Mount skins

Eight presets, each a calm jersey / pants / saddle trio drawn from the palette families (Pine, Ink, Amber, Brick and their neighbours). Custom colors remain free-form because students choose them.

## Components

### Buttons

| Recipe | Classes |
|---|---|
| Primary | `clay-primary h-11 md:h-12 px-6 rounded-xl text-[14px] font-semibold` |
| Secondary | `well well-hover h-11 px-5 rounded-xl text-[14px] font-medium text-fg` |
| Ghost | `h-11 md:h-10 px-4 rounded-xl text-fg-muted hover:well` |
| Danger (confirm) | `clay-danger h-11 px-6 rounded-xl text-[14px] font-semibold` |
| Icon | `well well-hover h-11 w-11 rounded-xl` (44px) |
| Row action | `h-11 md:h-10 px-4 rounded-xl bg-primary/12 text-primary hover:bg-primary/18 text-[13px] font-semibold` |
| Row action, destructive | `h-11 md:h-10 px-4 rounded-xl bg-danger/10 text-danger hover:bg-danger/15` |

`NeumorphButton` (`app/components/ui/neumorph-button.tsx`) is the motion-capable button used where a morph starts. It keeps its historical name and API but renders these recipes: `intent="primary"` is `clay-primary`, `secondary` is the Secondary well (and `clay` when `pressed`), `default` is neutral `clay`, `danger` is `clay-danger`, `danger-soft` is the destructive row-action tint (for a trigger whose confirm is the real destructive step). Sizes are `small` (`h-11 md:h-9`), `medium` (`h-11`), `large` (`h-12`), all sentence case, no hover zoom.

One `clay-primary` per view. An action that repeats on every row (`View`, `Save`, `Approve`, `Remove`) is never clay: ten clay buttons in a table would make ten "primary" actions. Rows use the tinted row-action recipe, and clay stays for the single action that moves the whole view forward. Every confirmation modal pairs a secondary `Batal` with a primary or danger confirm.

### Inputs

`well h-11 rounded-xl px-4 text-[14px] text-fg placeholder:text-fg-subtle`. Focus shows the global focus ring (2px Pine, 2px offset). Selects use the same recipe with a chevron.

Custom dropdowns (`exam/MultiSelectDropdown`, `exam/SingleSelectDropdown`, the admin topic pickers) share one shape: a `well` trigger with `aria-haspopup="listbox"`, `aria-expanded` and an `aria-label` that names the field and its value; a `glass-strong` panel; options at `min-h-11` with `role="option"` and `aria-selected`; Escape and an outside click close it. Multi-select uses a square check, single-select a round one. A "Pilih semua" row sits under the list header when the list can be bulk-selected.

### Segmented control

Track: `well rounded-xl p-1`. Segment: `h-11 rounded-lg` (admin screens may use `h-11 md:h-10` or `md:h-9`). Active segment: `clay` (the active choice becomes an object you picked up). Survival mode active segment uses `clay-danger`, because survival means limited lives. Segments carry `aria-pressed`.

### Cards and panels

A single card or panel: `glass rounded-3xl p-5 md:p-6`. Cards that repeat in a grid or list straight on the canvas: `glass-sheet rounded-3xl`. Inner groups use `well rounded-2xl p-4`. No hover lift on cards.

### Stat cards

`clay rounded-3xl p-5`. Number `text-[28px] font-bold tabular-nums text-fg`. Label `text-[12px] text-fg-muted`. Icon, if any, is 18px `text-fg-subtle`. No per-card color; the numbers are the focus. Only real data is shown; while loading the number is a skeleton bar, on error the card says what failed.

### Modals

Backdrop `glass-scrim`, shell `glass-sheet animate-in rounded-4xl`, header `px-6 pt-5 pb-4 border-b border-line`, body `p-6`, footer `px-6 py-4 border-t border-line`. The root carries `role="dialog"`, `aria-modal="true"` and `aria-labelledby` pointing at the title. Close button is an Icon button with `aria-label`. Escape closes every dismissable modal through a `window` keydown listener (a listener on the scrim would only fire once focus is inside it). When modals stack, one handler closes the topmost first. Deliberate exceptions:

- The anti-cheat tab warning swallows Escape in the capture phase; it must be acknowledged with its button.
- The quiz-paused overlay has no close at all; the host controls it.
- The question editor in add or edit mode ignores Escape and has no scrim close, so a draft is never lost to a stray key. Its math and table dialogs do close on Escape. The read-only question preview closes on Escape.

### Tables

Container `glass rounded-3xl overflow-hidden`. Header row `text-[11px] font-semibold text-fg-muted` sentence case, `border-b border-line`. Rows are plain with `border-b border-line` and `hover:well`. Row actions use the Row action recipe (tint, never clay).

### Help tooltips

A `?` well button (18px visual, 44px hit area through a `::before` inset) with `aria-describedby`. The tooltip is `glass-strong`, 208px wide, capped at `100vw - 24px`. While closed it is `display: none`, so it never widens the page. On open it measures itself and aligns start, center, or end so it stays inside the viewport on a 375px phone.

### Navigation

- **Site header (public):** `glass rounded-3xl h-14` floating bar, max width 1440px, product name in title-3 weight.
- **Admin sidebar (from `md`):** `glass rounded-4xl` floating panel, 12px from the viewport edge, 228px wide. Active tab is a `well` fill with `text-primary` icon. No uppercase section labels.
- **Admin top bar (below `md`):** `glass rounded-3xl h-14` floating bar with the menu button.
- **Mobile drawer:** `glass-strong` sheet from the right, 288px (max 88vw), `glass-scrim` behind it, Escape closes.

### Status chips

`rounded-lg px-2.5 h-6 text-[11px] font-semibold`:
- live / active: `bg-primary/12 text-primary` with a small dot (the dot marks real live state).
- waiting: `well text-fg-muted`.
- paused: `bg-warn/14 text-highlight-fg`.
- finished: `well text-fg-subtle`.
- error / wrong: `bg-danger/12 text-danger`.
- scheduled exam status: `active` (Aktif) is the live chip, `scheduled` (Terjadwal) the waiting chip, `expired` (Berakhir) the finished chip. Labels are shown in Indonesian, not the raw status key.

### Exam runtime

- Question surface: `glass rounded-3xl`. Question number is a clay token.
- Options: `well rounded-2xl` rows; selected option is `bg-primary text-on-primary` with the letter in a white token.
- Daftar soal tiles: `rounded-xl h-11`; answered `bg-primary text-on-primary`, doubt `bg-highlight text-on-highlight`, empty `well`. Current tile: 2px `--fg` ring with offset.
- Timer: `well` chip with `tabular-nums`; under 60 seconds it switches to `bg-danger/12 text-danger` and its dot pulses (real state).

### Empty, loading, error

Every data view has all three:
- **Loading:** a short line that says what is loading (`Memuat soal...`) plus a calm spinner (2px ring, `border-line-strong`, top segment `--primary`).
- **Empty:** says why it is empty and the one action that fills it.
- **Error:** says what failed and offers retry.

## Dark theme parity

- Admin dark theme is set by `body.admin-dark-theme` (managed by `useAdminTheme`). The hook reads the saved choice through `useSyncExternalStore` with a server snapshot of `dark`, so the first client render matches the server HTML (no hydration error) and every screen that uses the hook shares one value. Components that receive a `theme` prop outside the admin shell (for example the race view on the student side) set `data-theme="dark"` or `data-theme="light"` on their root so the semantic variables resolve correctly.
- Every utility in this file (`glass`, `glass-strong`, `glass-scrim`, `clay`, `clay-primary`, `clay-danger`, `clay-highlight`, `well`) reads CSS variables that are redefined for dark. There is no light-only treatment.
- The student exam flow ships light only, as before. The race view and every admin screen ship both.
- Before merging, check each changed screen in both themes: text tokens on glass, clay edges visible, focus ring visible.

## Accessibility

- Focus: a global `:focus-visible` rule draws a 2px `--focus` outline with 2px offset on every interactive element. It is unlayered in `globals.css`, so a stray `outline-none` utility cannot remove it.
- Tap targets: 44px minimum on touch widths. Buttons are `h-11` (44px) or `h-12`; icon buttons are 44 by 44; daftar-soal tiles are 44px tall. Dense admin controls (segments, row actions, small inputs) use `h-11 md:h-10` or `h-11 md:h-9`: 44px on a phone, tighter from 768px where a mouse is the likely pointer. A small visual control can reach 44px through an invisible `::before` hit area (the `?` help button does this).
- One documented exception: the `×` inside a selected chip in the quiz builder is 24 by 24px. That meets WCAG 2.2 target size (AA, 24px), and the same action is also available as a 44px option in the dropdown. Growing its hit area would swallow taps meant for the dropdown trigger around it.
- Every icon-only button has an `aria-label`. Dropdown triggers carry an `aria-label` that names the field and its value (`Mapel: Informatika`), because the placeholders alone repeat across fields.
- Escape behaviour is listed under Modals.

## Responsive

| Name | Width | Changes |
|---|---|---|
| base | 0 to 639px | Single column, 16px gutter, admin sidebar becomes the mobile drawer, tables scroll horizontally inside their glass container |
| `sm` | 640px | Two-column form rows |
| `md` | 768px | Admin sidebar appears as the floating glass panel, exam question splits into question and options columns |
| `lg` | 1024px | Stat card row goes four-up |
| `xl` | 1280px | Admin content max width |

No horizontal page scroll at any width. Anything wider than the viewport (tables, race lanes) scrolls inside its own container.

## Icons

`lucide-react` stays for the admin because it is already the house set and its glyphs are chosen for meaning (a list for `Daftar soal`, a shield for `Access`). Icons are 16 to 18px, `text-fg-subtle` unless active. No sparkle, star, magic or lightning glyphs. No emoji in UI text.

## Decision log (R-31)

| Decision | Reason |
|---|---|
| Glass on header, sidebar, cards, dropdowns | They float above the canvas; blur plus a lit edge communicates layer order without heavy shadows. User override of antislop R-10 for this project: glass is the identity. |
| `glass-sheet` (no blur) for modal shells and repeated cards | Keeps the glass look where blur would break things: nested fixed dialogs inside a modal, and dozens of blurred cards in a grid. The scrim behind a modal still blurs the page. |
| Row actions are tints, not clay | Clay means "the one action that moves this view forward". A table with ten clay `View` buttons has no primary action at all. |
| `h-11 md:h-10` for dense admin controls | 44px where fingers are likely, desktop density where a mouse is likely. |
| Clay on primary buttons, stat numbers, tokens, mount pedestal | These are touched or owned; physical softness makes them feel pressable and separates them from flat glass. |
| Well for rows and inputs | Content inside a surface needs separation, not another layer. |
| Pine as primary | Calm, reads as correct and forward, and is not the generic blue-purple. |
| Amber as the only accent | One warm note for leader, doubt and low time, so those moments are unmistakable. |
| Brick only for danger | A destructive action should look different from everything else, and nothing else. |
| Canvas light fields | Glass needs something to blur; without them glass reads as flat grey. |
| Plus Jakarta Sans | Made in Jakarta, legible on blur, tabular figures for timers. |
| 12px button radius | Buttons are keys, not tags; pills everywhere erased hierarchy. |
| Calm ease, no overshoot | The spring overshoot felt playful in a context where students are under test pressure. |
| No emoji, no gem crowns, no rainbow lane fills | They were decoration without information and made the race look generated. |
| Legacy class re-pointing | Keeps every old screen on-palette today while new code moves to semantic tokens. |
| Morph transitions kept, calmed | A button growing into its own screen tells the student where the screen came from. The spring was replaced by the calm curve, and reduced motion turns it off. |
| One typeface in the admin too | The admin briefly used Geist. A second family for the same product split its voice; Plus Jakarta Sans covers both surfaces. |
| Tutorial copy follows the real UI | A tutorial that names buttons the screen does not have is worse than none. Steps are written from the actual Quiz and Scheduled tabs. |
