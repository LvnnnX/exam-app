// Shared enter/exit motion for modals (DESIGN.md, Motion). Spread these onto a
// `motion.div` inside `<AnimatePresence>`: the scrim fades, the sheet fades and
// rises 4px. 220ms on the calm curve, no scale bounce. MotionConfig in
// app/providers.tsx drops the movement for reduced-motion visitors.
const CALM_EASE = [0.2, 0.8, 0.2, 1] as const;

export const scrimMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.22, ease: CALM_EASE },
};

export const sheetMotion = {
  initial: { opacity: 0, y: 4, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 4, scale: 0.985 },
  transition: { duration: 0.22, ease: CALM_EASE },
};
