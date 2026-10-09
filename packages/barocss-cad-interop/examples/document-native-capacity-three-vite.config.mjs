import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Normal public source exports and Vite's TypeScript transform; no package aliases.
export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  optimizeDeps: {
    entries: ['packages/barocss-cad-interop/examples/document-native-capacity-three.html'],
    include: ['three'],
  },
});
