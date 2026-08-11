// AI-ASSISTED: Cursor
// PROMPT: Configure Vite with Tailwind plugin and API proxy to FastAPI backend
// ACCEPTED-BY: madavasaran

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/query': 'http://localhost:8000',
      '/chat': 'http://localhost:8000',
      '/ingest': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
