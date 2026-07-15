import type { Config } from "tailwindcss";

/**
 * Synapse Adaptive design tokens.
 * Palette: Navy #0B1F3A (trust, calm base) · Orange #F97316 (energy — reserved
 * for CTAs, active states, key insights, progress, Synapse highlights) · White.
 * Everything else leans on navy, white, and neutral slate grays.
 * Confidence colors intentionally avoid alarming red for health states.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f5f8fb",
          100: "#e9eff6",
          200: "#d0dcea",
          300: "#a9c0d8",
          400: "#7c9dbf",
          500: "#5a7fa6",
          600: "#45658b",
          700: "#395271",
          800: "#1d3450",
          900: "#0b1f3a",
          950: "#071527",
        },
        orange: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        error: "#ef4444",
        ink: "var(--ink)",
        muted: "var(--muted)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11,31,58,0.04), 0 8px 24px -12px rgba(11,31,58,0.18)",
        lift: "0 2px 4px rgba(11,31,58,0.06), 0 24px 48px -20px rgba(11,31,58,0.30)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.5s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
