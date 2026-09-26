import { defineConfig } from 'vite'
import tailwindPlugin from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindPlugin()],
  server: {
    port: 5173
  }
})
