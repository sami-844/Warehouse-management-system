/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  corePlugins: { preflight: false }, // Don't reset existing CSS
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0f172a', mid: '#1e293b', light: '#334155' },
        brand: { green: '#16a34a', 'green-dark': '#15803d', gold: '#d97706' },
      },
      fontFamily: {
        ui: ['Figtree', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
