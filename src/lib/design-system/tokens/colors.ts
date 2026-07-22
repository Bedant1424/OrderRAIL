export const colors = {
  primary: {
    DEFAULT: "hsl(var(--brand))",
    foreground: "hsl(var(--brand-foreground))",
    hover: "hsl(var(--brand) / 0.9)",
    active: "hsl(var(--brand) / 0.8)",
  },
  neutral: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
  },
  surface: {
    DEFAULT: "hsl(var(--card))",
    elevated: "hsl(var(--card) / 0.95)",
    muted: "hsl(var(--muted))",
    overlay: "hsl(var(--background) / 0.6)",
  },
  background: {
    DEFAULT: "hsl(var(--background))",
    subtle: "hsl(var(--muted) / 0.3)",
  },
  border: {
    DEFAULT: "hsl(var(--border))",
    subtle: "hsl(var(--border) / 0.4)",
    focus: "hsl(var(--brand))",
  },
  status: {
    success: {
      DEFAULT: "#10B981",
      subtle: "rgba(16, 185, 129, 0.15)",
      foreground: "#047857",
    },
    warning: {
      DEFAULT: "#F59E0B",
      subtle: "rgba(245, 158, 11, 0.15)",
      foreground: "#B45309",
    },
    danger: {
      DEFAULT: "#EF4444",
      subtle: "rgba(239, 68, 68, 0.15)",
      foreground: "#B91C1C",
    },
    info: {
      DEFAULT: "#3B82F6",
      subtle: "rgba(59, 130, 246, 0.15)",
      foreground: "#1D4ED8",
    },
  },
} as const;
