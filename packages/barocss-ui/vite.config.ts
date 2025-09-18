import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'BaroCSSUI',
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    }
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
      include: ['src/**/*']
    })
  ]
});
