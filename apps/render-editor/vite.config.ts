import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [tailwindcss()],
  server: { host: '127.0.0.1', port: 52047, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: {
    input: { source: fileURLToPath(new URL('./index.html', import.meta.url)), mixed: fileURLToPath(new URL('./mixed.html', import.meta.url)), material: fileURLToPath(new URL('./material.html', import.meta.url)) },
  } },
});
