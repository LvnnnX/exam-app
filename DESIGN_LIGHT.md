---
name: The Design System
colors:
  surface: '#fff9e7'
  surface-dim: '#dfdac7'
  surface-bright: '#fff9e7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f9f4e0'
  surface-container: '#f4eeda'
  surface-container-high: '#eee8d5'
  surface-container-highest: '#e8e2cf'
  on-surface: '#1e1c10'
  on-surface-variant: '#404846'
  inverse-surface: '#333124'
  inverse-on-surface: '#f7f1dd'
  outline: '#707976'
  outline-variant: '#c0c8c5'
  surface-tint: '#39665d'
  primary: '#39665d'
  on-primary: '#ffffff'
  primary-container: '#bff0e4'
  on-primary-container: '#416f65'
  inverse-primary: '#a0d0c5'
  secondary: '#3c627c'
  on-secondary: '#ffffff'
  secondary-container: '#b8dffd'
  on-secondary-container: '#3d637d'
  tertiary: '#70585b'
  on-tertiary: '#ffffff'
  tertiary-container: '#fedee1'
  on-tertiary-container: '#796063'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bcece1'
  primary-fixed-dim: '#a0d0c5'
  on-primary-fixed: '#00201b'
  on-primary-fixed-variant: '#1f4e46'
  secondary-fixed: '#c8e6ff'
  secondary-fixed-dim: '#a5cbe9'
  on-secondary-fixed: '#001e2e'
  on-secondary-fixed-variant: '#234b63'
  tertiary-fixed: '#fbdbde'
  tertiary-fixed-dim: '#debfc2'
  on-tertiary-fixed: '#281719'
  on-tertiary-fixed-variant: '#574144'
  background: '#fff9e7'
  on-background: '#1e1c10'
  surface-variant: '#e8e2cf'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 41px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-md-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 25px
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 20px
  stack-gap: 12px
  grid-gutter: 16px
---

## Brand & Style
This design system is built upon the philosophy of "Airy Efficiency," translating the intuitive and aesthetic hallmarks of modern iOS interfaces into a professional restaurant environment. It moves away from the heavy, dark-themed industrial POS standards toward a workspace that feels fresh, optimistic, and weightless. 

The design style is a hybrid of **Minimalism** and **Glassmorphism**. It prioritizes clarity through generous whitespace and a pastel-driven palette, utilizing subtle translucency to maintain context without visual clutter. The target audience is modern hospitality staff who value a tool that feels as sophisticated and responsive as their personal devices. The goal is to evoke a sense of calm during high-pressure service periods.

## Colors
The palette is rooted in bright, high-value pastels that provide a soft yet distinct categorization system for menu items and UI states.

- **Soft Mint (Primary):** Used for positive actions, "ready" states, and primary navigation active indicators.
- **Sky Blue (Secondary):** Assigned to information-heavy elements, modifiers, and secondary interactions.
- **Pale Rose (Tertiary):** Utilized for delicate alerts, voids, or "needs attention" states.
- **Creamy Yellow (Neutral):** Acts as a subtle highlight for secondary containers or note fields.

The background is a crisp, off-white (#FBFBFD) to ensure the pastel elements "pop" while maintaining a light, airy atmosphere. Text uses a deep charcoal rather than pure black to reduce eye strain and maintain the soft aesthetic.

## Typography
The system exclusively uses **Inter** to achieve a systematic, neutral, and highly legible interface. The typographic hierarchy follows iOS-inspired conventions:

- **Display & Headlines:** Use tight letter-spacing and bold weights to anchor the layout, especially for table numbers and total amounts.
- **Body:** Set at a comfortable 17px for primary list items (the "iOS standard") to ensure readability at arm's length on a tablet stand.
- **Label Caps:** Used for metadata, such as timestamps or category headers, providing a clear structural break from content.

On mobile devices, headlines scale down to ensure that critical order information remains visible without excessive wrapping.

## Layout & Spacing
The layout follows a **Fixed Grid** model optimized for iPad and tablet displays, centering content in a structured 12-column system while allowing for safe-area margins.

- **Desktop/Tablet:** Uses a multi-pane layout. A fixed 320px left-hand "Current Order" sidebar is paired with a fluid central menu grid.
- **Mobile:** Elements reflow into a single-column stack. The "Current Order" becomes a bottom-sheet component accessible via a swipe-up gesture.
- **Spacing Rhythm:** Based on an 8px scale. Large containers use 20px internal padding to reinforce the airy feel, while interactive elements like menu cards are separated by 16px gutters.

## Elevation & Depth
This design system avoids heavy shadows, instead using **Tonal Layers** and **Backdrop Blurs** to create a sense of hierarchy.

- **Level 0 (Background):** Solid off-white.
- **Level 1 (Cards/Containers):** Pure white with a 1px soft border (#000000 5% opacity). No shadow.
- **Level 2 (Active/Floating):** Use of a very soft, diffused ambient shadow (10% opacity of the primary color) to indicate "lifted" items during drag-and-drop.
- **Glassmorphism:** Navigation bars and modal overlays utilize a `blur(20px)` backdrop with 80% opacity, allowing colors from the menu below to bleed through, mimicking the iOS Control Center.

## Shapes
The shape language is defined by extreme roundedness. Following the `rounded-3xl` directive, all primary UI elements (buttons, menu cards, input fields) use a 1.5rem (24px) corner radius. 

- **Small Components:** Elements like checkboxes and radio buttons maintain a high degree of roundedness but scale down proportionally to avoid looking like perfect circles.
- **Containers:** Large modal windows and main panels use a 32px radius to create a soft, non-intimidating frame for the interface.
- **Active States:** Selection indicators (pill-shaped) should always use fully rounded corners (999px) for a "capsule" look.

## Components
- **Buttons:** Large, tactile surfaces. Primary buttons use the Soft Mint color with high-contrast text. Secondary buttons use a subtle Creamy Yellow or simple white with a border.
- **Menu Cards:** Feature a top-aligned image with a 24px corner radius. The price is anchored in a Sky Blue "pill" label in the top-right corner.
- **Segmented Controls:** Used for switching between categories (e.g., "Starters," "Mains," "Drinks"). These are housed in a recessed container with a sliding white pill to indicate the active state.
- **Input Fields:** Search and quantity inputs are pill-shaped with a soft Sky Blue background at 10% opacity, utilizing a centered "placeholder" style common in iOS search bars.
- **Checkboxes & Radio Buttons:** Styled as large circular "taps," which fill with the Primary color when selected, featuring a white checkmark.
- **Lists:** Order lists use "inset group" styling—white items with rounded corners sitting on the slightly darker background, separated by hair-line dividers that don't reach the edge of the container.