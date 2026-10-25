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
        display: ["'Sora'", "system-ui", "sans-serif"],
        sans:    ["'Inter'", "system-ui", "sans-serif"],
      },
      colors: {
        bg:      "var(--color-bg)",
        panel:   "var(--color-panel)",
        "panel-2": "var(--color-panel-2)",
        edge:    "var(--color-edge)",
        accent:  "var(--color-accent)",
        violet:  "var(--color-violet)",
        cyan:    "var(--color-cyan)",
        ok:      "var(--color-ok)",
        warn:    "var(--color-warn)",
        danger:  "var(--color-danger)",
        mute:    "var(--color-mute)",
      },
      borderRadius: {
        DEFAULT: "10px",
        xl:      "14px",
        "2xl":   "18px",
        full:    "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
