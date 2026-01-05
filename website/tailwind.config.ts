import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dune-inspired color palette
        sand: {
          50: '#fefcf9',
          100: '#fdf8f0',
          200: '#faecd9',
          300: '#f5dbb8',
          400: '#e8be7d',
          500: '#d4994a',
          600: '#b87a2d',
          700: '#945f22',
          800: '#6b4518',
          900: '#4a3012',
        },
        spice: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        desert: {
          50: '#faf5f0',
          100: '#f3e8db',
          200: '#e6cfb5',
          300: '#d6b088',
          400: '#c48f5c',
          500: '#b17540',
          600: '#9c5f33',
          700: '#7d4a2b',
          800: '#663d28',
          900: '#543424',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
