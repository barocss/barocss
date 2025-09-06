import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      // Generate .d.ts files for all entry points
      entryRoot: 'src',
      // Include all TypeScript files
      include: ['src/**/*.ts'],
      // Exclude test files
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'tests/**/*'],
      // Output directory
      outDir: 'dist',
      // Generate declaration files for each entry point
      rollupTypes: true,
      // Copy declaration files to match the entry structure
      copyDtsFiles: true,
      // Insert types into the bundle
      insertTypesEntry: true,
      // Skip type checking for faster builds
      // skipDiagnostics: true,
      // Generate source maps for declarations
      compilerOptions: {
        sourceMap: true,
        declaration: true,
        declarationMap: true
      }
    })
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'theme/default': resolve(__dirname, 'src/theme/index.ts'),
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
        exports: 'named',
        entryFileNames: '[name].js',
        chunkFileNames: 'core.js',
        assetFileNames: '[name].[ext]',
        // 각 엔트리포인트를 독립적으로 만들기
        manualChunks: undefined
      }
    },
    sourcemap: true,
    minify: false,
    target: 'es2020',
    outDir: 'dist'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
}); 