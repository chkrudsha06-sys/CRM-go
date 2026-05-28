import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#F1F5F9",
          surface: "#FFFFFF",
          "surface-2": "#F8FAFC",
          border: "#E2E8F0",
          "border-2": "#CBD5E1",
          text: "#0F172A",
          muted: "#64748B",
          subtle: "#94A3B8",
          navy: "#0B1629",
          "navy-2": "#1E3A8A",
          gold: "#C9A84C",
          "gold-light": "#E8C97A",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08)",
        dropdown: "0 8px 24px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
