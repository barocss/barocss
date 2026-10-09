import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Optimize pinned peers for this browser host; resolve declared SDK exports unchanged.
export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  optimizeDeps: {
    entries: ['packages/barocss-cad-interop/examples/sdk-pixi3d-host.html'],
    include: ['pixi.js', 'pixi3d'],
  },
});
