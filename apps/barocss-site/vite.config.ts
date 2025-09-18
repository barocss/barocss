import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5190
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        'ui-test': './ui-test.html'
      }
    }
  },
  resolve: {
    alias: {
      '@barocss/ui': '/Users/user/github/barocss/barocss/packages/barocss-ui/src',
      '@barocss/browser': '/Users/user/github/barocss/barocss/packages/barocss-browser/src'
    }
  }
})
