import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  cacheDir: '.vite',
  build: { rollupOptions: { input: { vista: "index.html", recruitment: "convocatoria/index.html" } } },
})