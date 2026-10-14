import type { Config } from "tailwindcss";

// Tokens come from DESIGN.md (prose palette) and are backed by CSS variables so dark mode
// can swap them under [data-theme="dark"] (Phase 6).
const v = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: v("canvas"), surface: v("surface"), line: v("line"), stone: v("stone"),
        "stone-deep": v("stone-deep"), primary: v("primary"), "primary-hover": v("primary-hover"),
        espresso: v("espresso"), "on-primary": v("on-primary"), accent: v("accent"), muted: v("muted"),
        success: v("success"), warning: v("warning"), danger: v("danger"),
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"] },
      borderRadius: { card: "1rem", input: "0.75rem", pill: "9999px" },
      boxShadow: {
        l1: "0 2px 8px -2px rgba(62,47,39,.04), 0 1px 2px 0 rgba(62,47,39,.02)",
        l2: "0 10px 20px -4px rgba(62,47,39,.06), 0 4px 6px -2px rgba(62,47,39,.03)",
        l3: "0 20px 32px -8px rgba(62,47,39,.12), 0 1px 3px 0 rgba(62,47,39,.05)",
      },
      fontSize: {
        "headline-xl": ["40px", { lineHeight: "48px", letterSpacing: "-0.025em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "headline-md": ["22px", { lineHeight: "28px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "headline-sm": ["18px", { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["16px", "26px"], "body-md": ["14px", "22px"], "body-sm": ["13px", "18px"],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "600" }],
        "label-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "600" }],
      },
    },
  },
} satisfies Config;
