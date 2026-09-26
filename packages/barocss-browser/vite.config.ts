import { defineConfig } from 'vite'
import { copyFileSync } from 'fs'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'BaroCSSBrowser',
      fileName: (format) => (format === 'cjs' ? 'index.cjs' : `index.${format}.js`),
      formats: ['es', 'umd', 'cjs']
    },
    rollupOptions: {
      external: [
        '@barocss/kit',
      ],
      output: {
        globals: {
          '@barocss/kit': 'BaroCSSKit',
        }
      }
    }
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      // CommonJS consumers (type: module package) need .d.cts declarations.
      afterBuild: () => copyFileSync('dist/index.d.ts', 'dist/index.d.cts'),
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    })
  ]
})
