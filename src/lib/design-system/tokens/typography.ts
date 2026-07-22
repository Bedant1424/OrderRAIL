export const typography = {
  fontFamily: {
    display: ["Outfit", "Inter", "sans-serif"],
    body: ["Inter", "system-ui", "sans-serif"],
    mono: ["JetBrains Mono", "monospace"],
  },
  scale: {
    display: "font-display text-3xl sm:text-4xl font-extrabold tracking-tight",
    pageTitle: "font-display text-xl sm:text-2xl font-bold tracking-tight",
    sectionTitle: "font-display text-base font-bold tracking-tight",
    cardTitle: "font-display text-sm font-semibold tracking-normal",
    body: "font-sans text-xs sm:text-sm font-normal leading-normal",
    caption: "font-sans text-[11px] font-medium text-muted-foreground",
    label: "font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground",
    numeric: "font-mono text-xs sm:text-sm font-bold tracking-tight",
  },
} as const;
