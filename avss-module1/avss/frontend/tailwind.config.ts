import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Display: headings, sidebar brand
        display: ["'Bricolage Grotesque'", "sans-serif"],
        // Body
        sans: ["'Instrument Sans'", "system-ui", "sans-serif"],
      },
      colors: {
        // ── AVSS custom palette (matches the demo HTML) ─────────────────
        slate: {
          100: "#f2ead7",
          200: "#e6dcc3",
          300: "#d3c8ad",
          400: "#a39e8c",
          500: "#7c7f76",
          600: "#46524e",
          700: "#2d3835",
          800: "#171e1c",
          900: "#0f1413",
          950: "#090c0b",
        },
        emerald: {
          300: "#7fd6c9",
          400: "#3fbfae",
          500: "#1fa593",
          600: "#13826f",
        },
        orange: {
          300: "#eadcb4",
          400: "#dccb96",
          500: "#cdb97a",
          600: "#b89f5c",
        },
        // keep existing token names working
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "2px",
        md: "2px",
        lg: "2px",
        xl: "2px",
        "2xl": "2px",
        full: "9999px",
      },
      boxShadow: {
        tag: "5px 5px 0 #13826f",
      },
    },
  },
  plugins: [],
};

export default config;
