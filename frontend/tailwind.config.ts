import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e4e4e7",
          light: "#fafafa",
          muted: "#a1a1aa",
          dark: "#71717a",
        },
      },
      boxShadow: {
        soft: "0 1px 3px rgba(0,0,0,0.4), 0 12px 32px -16px rgba(0,0,0,0.6)",
        glow: "0 10px 30px -10px rgba(255,255,255,0.08)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #fafafa 0%, #a1a1aa 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
