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
        writeFileSync('dist/index.d.ts', index.replace("from './ssr'", "from './ssr.js'"))
        writeFileSync('dist/index.d.cts', index.replace("from './ssr'", "from './ssr.cjs'"))
        writeFileSync('dist/ssr.d.cts', readFileSync('dist/ssr.d.ts', 'utf8'))
      },
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    })
  ]
})
