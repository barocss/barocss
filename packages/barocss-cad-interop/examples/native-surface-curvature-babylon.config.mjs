import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const files = ['rational_cylinder_r2.original.source0.css', 'rational_sphere_r2_away_pole.original.source0.css'];
const originals = new Map(files.map(file => [
  `/packages/barocss-cad-interop/examples/native-surface-curvature-babylon-data/${file}`,
  new URL(`./native-surface-curvature-babylon-data/${file}`, import.meta.url),
]));
export default defineConfig({
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  optimizeDeps: { entries: ['packages/barocss-cad-interop/examples/native-surface-curvature-babylon.html'], include: ['@babylonjs/core'] },
  plugins: [{ name: 'original-surface-http-bytes', configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const original = originals.get(new URL(request.url, 'http://localhost').pathname);
      if (!original || !['GET', 'HEAD'].includes(request.method)) { next(); return; }
      const bytes = readFileSync(original);
      response.statusCode = 200; response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.setHeader('Content-Length', bytes.length); response.setHeader('Cache-Control', 'no-store');
      response.end(request.method === 'HEAD' ? undefined : bytes);
    });
  } }],
});
