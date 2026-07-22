export const colors = {
  // Brand Hospitality Palette (Warm Espresso, Copper, Caramel)
  primary: {
    DEFAULT: "hsl(var(--brand))",               // Copper Accent #D97706 / HSL(28 75% 52%)
    foreground: "hsl(var(--brand-foreground))",
    hover: "hsl(var(--brand) / 0.9)",
    active: "hsl(var(--brand) / 0.8)",
    glow: "rgba(217, 119, 6, 0.25)",
  },
  // Warm Hospitality Layers
  hospitality: {
    espresso: "hsl(28 45% 8%)",      // Deep Roasted Obsidian Surface
    caramel: "hsl(28 75% 52%)",      // Warm Copper Accent
    cream: "hsl(35 30% 95%)",        // High-contrast Cream Typography
    forest: "hsl(155 60% 45%)",      // Operational Emerald Green
    copper: "hsl(20 80% 50%)",       // High-contrast Warm Focus
    slate: "hsl(25 15% 14%)",        // Layered Surface Base
    stone: "hsl(25 12% 20%)",        // Card & Modal Surface
    mist: "hsl(35 15% 88%)",         // Secondary Text & Muted Icons
  },
  neutral: {
    50: "#FAFAF9",
    100: "#F5F5F4",
    200: "#E7E5E4",
    300: "#D6D3D1",
    400: "#A8A29E",
    500: "#78716C",
    600: "#57534E",
    700: "#44403C",
    800: "#292524",
    900: "#1C1917",
  },
  surface: {
    DEFAULT: "hsl(var(--card))",
    elevated: "hsl(var(--card) / 0.95)",
    muted: "hsl(var(--muted))",
    overlay: "hsl(var(--background) / 0.65)",
    glass: "rgba(35, 30, 26, 0.75)",
  },
  background: {
    DEFAULT: "hsl(var(--background))",
    subtle: "hsl(var(--muted) / 0.3)",
    warm: "hsl(28 40% 6%)",
  },
  border: {
    DEFAULT: "hsl(var(--border))",
    subtle: "rgba(255, 255, 255, 0.08)",
    focus: "hsl(var(--brand))",
    highlight: "rgba(255, 255, 255, 0.12)",
  },
  status: {
    success: {
      DEFAULT: "#10B981",
      subtle: "rgba(16, 185, 129, 0.15)",
      foreground: "#34D399",
    },
    warning: {
      DEFAULT: "#F59E0B",
      subtle: "rgba(245, 158, 11, 0.15)",
      foreground: "#FBBF24",
    },
    danger: {
      DEFAULT: "#EF4444",
      subtle: "rgba(239, 68, 68, 0.15)",
      foreground: "#F87171",
    },
    info: {
      DEFAULT: "#3B82F6",
      subtle: "rgba(59, 130, 246, 0.15)",
      foreground: "#60A5FA",
    },
  },
} as const;
