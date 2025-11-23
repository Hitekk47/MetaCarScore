import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'sans-serif'],
      },
      colors: {
        brand: {
          dark: '#0f172a',
          primary: '#2563eb',
        },
        score: {
          good: '#00ce7a',
          mixed: '#ffbd3f',
          bad: '#ff6874',
        }
      }
    },
  },
  plugins: [],
};
export default config;