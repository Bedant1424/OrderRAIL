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
  small: "rounded-lg",   // 8px
  medium: "rounded-2xl", // 16px
  large: "rounded-3xl",  // 24px
} as const;

export const elevation = {
  surface: "shadow-none border border-border/40",
  elevated: "shadow-soft bg-card/95 backdrop-blur-md",
  floating: "shadow-float bg-card border border-border/60",
  overlay: "shadow-2xl bg-card border border-border/80",
} as const;

export const motion = {
  hover: "transition-all duration-150 ease-out hover:scale-[1.015]",
  pressed: "active:scale-[0.985]",
  drawer: "transition-transform duration-200 ease-out",
  modal: "transition-all duration-200 ease-out animate-in fade-in zoom-in-95",
  list: "transition-all duration-150 ease-in-out",
} as const;
