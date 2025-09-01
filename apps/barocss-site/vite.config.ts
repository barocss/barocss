import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    // Vite 7의 새로운 기능들
    hmr: {
      overlay: true,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Vite 7의 새로운 빌드 최적화
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Vite 7의 새로운 기능들
  experimental: {
    renderBuiltUrl: true,
  },
  optimizeDeps: {
    force: true,
  },
});
