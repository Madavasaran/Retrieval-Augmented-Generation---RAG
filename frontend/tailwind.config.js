// AI-ASSISTED: Cursor
// PROMPT: Tailwind theme config for red dark ChatGPT-style UI
// ACCEPTED-BY: madavasaran

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'chat-bg': '#0d0d0d',
        'sidebar-bg': '#171717',
        accent: '#dc2626',
        'accent-hover': '#b91c1c',
        'assistant-bg': '#1a1a1a',
        'assistant-border': '#3f1212',
        'text-primary': '#f5f5f5',
        'text-muted': '#a3a3a3',
        'input-bg': '#212121',
        'hover-bg': '#262626',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['15px', { lineHeight: '1.6' }],
      },
      boxShadow: {
        panel: '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
