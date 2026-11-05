import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: "#FF6A2F",
          light: "#FFEADB",
          lighter: "#FFF5EE",
          dark: "#D44F1A",
          deep: "#9C3A11",
        },
        ink: {
          DEFAULT: "#1A1A1A",
          2: "#333333",
          3: "#525252",
          4: "#8A8A8A",
          5: "#B8B8B8",
        },
        cream: {
          DEFAULT: "#FAFAF8",
          2: "#F5F5F2",
          3: "#EFEEE8",
        },
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        serif: ["var(--font-instrument-serif)", "serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.05em",
        "extra-tight": "-0.04em",
      },
      boxShadow: {
        glow: "0 20px 60px -15px rgba(255,106,47,0.35)",
        soft: "0 10px 32px -8px rgba(0,0,0,0.08)",
        card: "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -8px rgba(0,0,0,0.06)",
        bracket: "0 16px 48px rgba(255,106,47,0.25)",
      },
      keyframes: {
        pulseDot: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.85)" },
        },
        orbit: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "orbit-reverse": {
          from: { transform: "rotate(360deg)" },
          to: { transform: "rotate(0deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        marqueeSlide: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        brandScroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-33.333%)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        orbit: "orbit 60s linear infinite",
        "orbit-slow": "orbit 120s linear infinite",
        "orbit-reverse": "orbit-reverse 90s linear infinite",
        shimmer: "shimmer 3s linear infinite",
        fadeUp: "fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        marquee: "marqueeSlide 30s linear infinite",
        "brand-scroll": "brandScroll 25s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
