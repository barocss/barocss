import { defineConfig } from 'vite'
import { readFileSync, writeFileSync } from 'fs'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'BaroCSSServer',
      fileName: (format) => format === 'cjs' ? 'index.cjs' : 'index.es.js',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: ['@barocss/kit', 'jsdom'],
      output: {
        globals: {
          '@barocss/kit': 'BaroCSSKit',
          jsdom: 'jsdom'
        }
      }
    }
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      // CommonJS consumers (type: module package) need .d.cts declarations.
      afterBuild: () => {
        // Relative specifiers need extensions under moduleResolution node16.
        const index = readFileSync('dist/index.d.ts', 'utf8')
        const ssrSpecifier = /from (['"])\.\/ssr\1/g
        if (!ssrSpecifier.test(index)) {
          throw new Error("dist/index.d.ts: expected a re-export from './ssr' to rewrite")
        }
        writeFileSync('dist/index.d.ts', index.replace(ssrSpecifier, 'from $1./ssr.js$1'))
        writeFileSync('dist/index.d.cts', index.replace(ssrSpecifier, 'from $1./ssr.cjs$1'))
        writeFileSync('dist/ssr.d.cts', readFileSync('dist/ssr.d.ts', 'utf8'))
      },
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    })
  ]
})
