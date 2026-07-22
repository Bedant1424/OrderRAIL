export const typography = {
  fontFamily: {
    display: ["Outfit", "Inter", "sans-serif"],
    body: ["Inter", "system-ui", "sans-serif"],
    mono: ["JetBrains Mono", "monospace"],
  },
  scale: {
    hero: "font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground drop-shadow-sm",
    display: "font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground",
    pageTitle: "font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground",
    sectionTitle: "font-display text-base font-bold tracking-tight text-foreground/90",
    cardTitle: "font-display text-sm font-semibold tracking-normal text-foreground",
    body: "font-sans text-xs sm:text-sm font-normal leading-relaxed text-foreground/90",
    caption: "font-sans text-[11px] font-medium text-muted-foreground/80",
    label: "font-sans text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground",
    numeric: "font-mono text-xs sm:text-sm font-extrabold tracking-tight font-feature-tabular",
    revenue: "font-mono text-2xl sm:text-3xl font-extrabold text-brand tracking-tight",
  },
} as const;
