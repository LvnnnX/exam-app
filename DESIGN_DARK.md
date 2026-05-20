---
name: Nocturnal Pastel
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c0c9c4'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8a938e'
  outline-variant: '#404945'
  surface-tint: '#9bd2bf'
  primary: '#f3fff9'
  on-primary: '#00382c'
  primary-container: '#b4ebd8'
  on-primary-container: '#386c5d'
  inverse-primary: '#346859'
  secondary: '#e6bad2'
  on-secondary: '#442739'
  secondary-container: '#5f3f53'
  on-secondary-container: '#d7adc4'
  tertiary: '#f9fcff'
  on-tertiary: '#003547'
  tertiary-container: '#b6e6ff'
  on-tertiary-container: '#326980'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b7eedb'
  primary-fixed-dim: '#9bd2bf'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#194f42'
  secondary-fixed: '#ffd8ec'
  secondary-fixed-dim: '#e6bad2'
  on-secondary-fixed: '#2d1224'
  on-secondary-fixed-variant: '#5d3d50'
  tertiary-fixed: '#bfe9ff'
  tertiary-fixed-dim: '#99cee8'
  on-tertiary-fixed: '#001f2a'
  on-tertiary-fixed-variant: '#0d4d63'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
---

## Brand & Style
This design system is defined by a sophisticated intersection of high-end mobile utility and soft, expressive color. It leverages a "Dark Mode First" philosophy, using deep obsidian surfaces to make desaturated pastel accents feel luminous rather than loud.

The style is **Minimalist with Glassmorphism influences**, drawing heavily from modern iOS aesthetics. It prioritizes depth through translucency, generous negative space, and organic, oversized geometry. The target experience is one of effortless premium quality—feeling both professionally engineered and approachable.

## Colors
The palette is built on a foundation of "True Black" and "Deep Grey" to ensure infinite contrast and power efficiency on OLED displays. 

**Accents:**
- **Soft Mint (#B4EBD8):** Used for primary actions and success states.
- **Pale Rose (#F2C6DE):** Used for secondary highlights and soft notifications.
- **Sky Blue (#A9DEF9):** Reserved for information and links.
- **Creamy Yellow (#FCF6BD):** Used for warnings or "warm" interface elements.
- **Lavender (#E4C1F9):** Used for creative features or premium upsells.

**Logic:** Surfaces should never use pure white text; instead, use 90% white for primary content and 60% white for secondary content to reduce eye strain against the dark background.

## Typography
The design system utilizes **Inter** exclusively to achieve a systematic, neutral, and highly legible interface. 

- **Casing:** Use sentence-case for all headlines, buttons, and labels to maintain a friendly, conversational tone. Avoid all-caps.
- **Weighting:** Headlines use SemiBold (600) or Bold (700) to create a clear hierarchy against the dark background.
- **Tracking:** Tighten tracking slightly on larger display sizes (-0.02em) and loosen slightly on small labels (+0.01em to +0.02em) to ensure legibility.

## Layout & Spacing
The layout follows a **fluid-to-fixed hybrid model**. 

- **Grid:** Use a 12-column grid for desktop (max-width 1200px) and a 4-column grid for mobile.
- **Rhythm:** An 8px base unit governs all spatial relationships. 
- **Containers:** Content is grouped in cards with generous internal padding (24px or 32px) to emphasize the "object-based" nature of the UI.
- **Mobile Margins:** Use a 20px safe area on mobile devices to align with iOS native standards.

## Elevation & Depth
Depth is achieved through **translucency and tonal layering** rather than traditional heavy shadows.

- **Stacking:** The base background is `#0A0A0A`. Interactive cards sit at `#111111` or `#1C1C1E`.
- **Glassmorphism:** Overlays (modals, navigation bars, and floating players) must use a background blur effect (20px to 30px) with a semi-transparent fill (`rgba(28, 28, 30, 0.7)`).
- **Outlines:** Use a 1px "inner stroke" on cards and buttons with a very low opacity white (10-15%) to define edges against the dark background.
- **Shadows:** Use extremely soft, large-radius shadows (`blur: 40px`, `y: 20px`, `opacity: 40%`) using the background color, creating a subtle "lift" effect without visible muddying.

## Shapes
The shape language is hyper-rounded and organic.

- **Cards & Containers:** Use `rounded-3xl` (24px) for primary content cards.
- **Buttons & Chips:** Always use `rounded-full` (pill-shaped) to maximize the friendly, tactile feel.
- **Inputs:** Use `rounded-2xl` (16px) for form fields to distinguish them slightly from primary action buttons.
- **Icons:** Icons should feature rounded caps and corners, matching the soft geometry of the containers.

## Components
Consistent component behavior is critical for the premium native feel of this design system.

- **Pill Buttons:** Primary buttons use a solid pastel background with dark text (#0A0A0A). Secondary buttons use a subtle grey fill with pastel-colored text.
- **Segmented Controls:** These should mimic the iOS style—a dark track with a sliding pill-shaped indicator that has a subtle 1px border and a slight lift.
- **Glass Cards:** Use for dashboard widgets. Must include the background blur and the 1px subtle white top-border for a "light-catching" edge effect.
- **Input Fields:** Borderless with a subtle `#1C1C1E` background. Upon focus, the background remains, but a 2px pastel border is added.
- **Chips:** Small, pill-shaped tags used for filtering. When active, they should glow slightly by using a 10% opacity version of the pastel accent as their background.
- **Progress Bars:** Use thick, 8px rounded tracks. The unfilled portion is dark grey, while the filled portion uses a pastel gradient or solid pastel accent.