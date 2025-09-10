import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'BaroCSSServer',
      fileName: (format) => `index.${format}.js`,
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
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    })
  ]
})
