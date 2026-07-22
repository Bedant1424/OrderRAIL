export const spacing = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
  12: "48px",
  16: "64px",
} as const;

export const radii = {
  small: "rounded-xl",    // 12px
  medium: "rounded-2xl",  // 16px
  large: "rounded-3xl",   // 24px
  full: "rounded-full",
} as const;

export const elevation = {
  surface: "shadow-none border border-white/5 bg-card/70 backdrop-blur-md",
  elevated: "shadow-soft bg-card/90 backdrop-blur-md border border-white/10",
  floating: "shadow-float bg-card border border-white/15 backdrop-blur-lg",
  overlay: "shadow-2xl bg-card/95 backdrop-blur-xl border border-white/20",
} as const;

export const motion = {
  hover: "transition-all duration-200 ease-out hover:scale-[1.015] hover:shadow-float",
  pressed: "active:scale-[0.985] active:brightness-95",
  drawer: "transition-transform duration-250 ease-out",
  modal: "transition-all duration-200 ease-out animate-in fade-in zoom-in-95",
  list: "transition-all duration-150 ease-in-out",
} as const;
