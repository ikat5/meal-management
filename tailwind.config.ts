import type { Config } from "tailwindcss";

/**
 * MEAL MANAGEMENT DESIGN TOKENS
 * ──────────────────────
 * A quiet, ledger-like SaaS palette: cool near-white canvas, white
 * surfaces, hairline borders, near-black ink — and ONE accent, a deep
 * viridian green ("money ledger" green), used only for primary actions
 * and highlights. Everything financial is set in a monospaced face with
 * tabular figures, like a bank statement.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F8FA", //   app background
        line: "#E6E8EC", //     hairline borders
        ink: {
          DEFAULT: "#181B20", // primary text
          secondary: "#5B616B",
          faint: "#9AA1AB",
        },
        brand: {
          50: "#EDF5F2",
          100: "#D7EAE3",
          600: "#0E6B57", //    primary actions
          700: "#0B5646", //    hover
          800: "#094437",
        },
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(24, 27, 32, 0.04)",
        modal:
          "0 10px 15px -3px rgba(24, 27, 32, 0.08), 0 4px 6px -4px rgba(24, 27, 32, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
