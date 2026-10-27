import type { Config } from "tailwindcss";

/**
 * IronBeat design tokens.
 *
 * Warm neutral canvas (#F5F2EC) + charcoal surfaces (#1C1C1E) + amber accent
 * (#C67D3B). Tuned for high contrast on phone screens under gym lighting.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#F5F2EC",
          50: "#FCFAF6",
          100: "#F5F2EC",
          200: "#EFECE6",
          300: "#E7E2D8",
          400: "#DBD4C6",
        },
        ink: {
          DEFAULT: "#1C1C1E",
          soft: "#2D2B29",
          raised: "#35322E",
          line: "#3E3A35",
          muted: "#6E675D",
        },
        amber: {
          DEFAULT: "#C67D3B",
          soft: "#D4A373",
          deep: "#A9622A",
          glow: "#E9CDA6",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        lift: "0 24px 48px -32px rgba(28, 28, 30, 0.55), 0 2px 10px -6px rgba(28, 28, 30, 0.25)",
        player: "0 -12px 40px -20px rgba(28, 28, 30, 0.55)",
        chip: "0 6px 16px -10px rgba(28, 28, 30, 0.5)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "sheet-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "eq-1": {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        "eq-2": {
          "0%, 100%": { transform: "scaleY(0.7)" },
          "50%": { transform: "scaleY(0.3)" },
        },
        "eq-3": {
          "0%, 100%": { transform: "scaleY(0.45)" },
          "50%": { transform: "scaleY(0.9)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "sheet-up": "sheet-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both",
        "eq-1": "eq-1 0.9s ease-in-out infinite",
        "eq-2": "eq-2 0.7s ease-in-out infinite",
        "eq-3": "eq-3 1.1s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
