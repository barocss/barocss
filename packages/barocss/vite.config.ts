import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';
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
      },
      afterBuild: () => {
        // vite-plugin-dts rolls the theme entry into dist/default.d.ts.
        // Copy it to the public subpath used by package.json.
        copyFileSync('dist/default.d.ts', 'dist/theme/default.d.ts');
        // CommonJS consumers (type: module package) need .d.cts declarations.
        copyFileSync('dist/index.d.ts', 'dist/index.d.cts');
        copyFileSync('dist/default.d.ts', 'dist/theme/default.d.cts');
      }
    })
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'theme/default': resolve(__dirname, 'src/theme/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'cjs' ? 'cjs' : 'js'}`
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
        exports: 'named',
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
