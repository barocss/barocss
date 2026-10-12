import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  build: {
    lib: { entry: { index: 'src/index.ts', 'react/index': 'src/react/index.tsx' }, formats: ['es'], fileName: (_format, name) => name + '.js' },
    rollupOptions: { external: id => !id.startsWith('.') && !id.startsWith('/') },
    target: 'es2022', emptyOutDir: true, minify: false,
  },
});
