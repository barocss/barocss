import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Resolve the package's declared public exports. No source or dist aliases.
export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  optimizeDeps: {
    entries: ['packages/barocss-cad-interop/examples/sdk-quickstart-three.html'],
    include: ['three'],
  },
});
