/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
],
  theme: {
    extend: {
      colors: {
        'dashboard-bg': '#18181b',
        'surface-bg': '#27272a',
        'subtle-gray': 'rgba(255, 255, 255, 0.05)',
        'neon-red': '#ff003c',
        'neon-amber': '#ffb000',
        'neon-lime': '#39ff14',
        'neon-blue': '#00e5ff',
        'accent-primary': 'var(--accent-primary)',
        'accent-secondary': 'var(--accent-secondary)',
        'accent-tertiary': 'var(--accent-tertiary)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(to bottom right, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
      }
    },
  },
  plugins: [],
}
