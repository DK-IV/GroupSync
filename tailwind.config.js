/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'dashboard-bg': 'var(--bg-base)',
        'surface-bg': 'var(--bg-surface)',
        'subtle-gray': 'var(--subtle-gray)',
        'text-main': 'var(--text-main)',
        'text-muted': 'var(--text-muted)',
        'neon-red': '#fb7185',
        'neon-amber': '#fbbf24',
        'neon-lime': '#86efac',
        'neon-blue': '#22d3ee',
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
