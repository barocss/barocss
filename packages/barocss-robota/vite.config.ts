import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'BaroRobota',
      fileName: 'index',
      formats: ['es']
    },
    sourcemap: true,
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true
  },
  plugins: [dts({ insertTypesEntry: true })]
});


