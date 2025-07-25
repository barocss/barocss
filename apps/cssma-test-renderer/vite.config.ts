import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3001,
    open: true
  },
  build: {
    outDir: 'dist',
    target: 'es2015'
  }
});