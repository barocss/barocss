import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist/cdn',
    lib: {
      entry: 'src/index.ts',
      name: 'BaroCSS',
      fileName: 'barocss',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
        // CDN에서 사용할 수 있도록 모든 의존성을 번들에 포함
        inlineDynamicImports: true
      }
    },
    // CDN용으로 최적화
    minify: 'terser',
    sourcemap: true
  }
})
