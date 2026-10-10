import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
const original = new URL('./section-uniform-curve-three-data/polynomial.actual-world.source0.css', import.meta.url);
export default defineConfig({ root: fileURLToPath(new URL('../../../', import.meta.url)), server: { port: 5239, strictPort: true },
  optimizeDeps: { include: ['three'] }, plugins: [{ name: 'original-section-source-bytes', configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/packages/barocss-cad-interop/examples/section-uniform-curve-three-data/polynomial.actual-world.source0.css') return next();
      const bytes = readFileSync(original); response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.setHeader('Content-Length', bytes.length); response.setHeader('Cache-Control', 'no-store'); response.end(bytes);
    });
  } }] });
