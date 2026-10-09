import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// This host resolves declared package exports. It uses no source or dist aliases.
export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  optimizeDeps: {
    entries: ['packages/barocss-cad-interop/examples/sdk-babylon-host.html'],
    include: ['@babylonjs/core'],
  },
});
