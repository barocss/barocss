import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/runtime/browser-runtime.ts'),
      name: 'BaroCSS',
      fileName: 'barocss',
      formats: ['umd', 'es']
    },
    rollupOptions: {
      external: [],
      output: {
        // 모든 의존성을 단일 파일에 번들링
        inlineDynamicImports: true
      }
    },
    sourcemap: true,
    minify: true,
    target: 'es2020',
    outDir: 'dist/cdn'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
