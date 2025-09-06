import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'BaroCSSBrowser',
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'umd']
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
      exclude: ['**/*.test.ts', '**/*.spec.ts']
    })
  ]
})
