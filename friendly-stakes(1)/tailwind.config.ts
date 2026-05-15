import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "rgb(30 30 40)",
          light: "rgb(40 40 55)",
          lighter: "rgb(55 55 70)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
