import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
const root = process.cwd(), directory = resolve(root, 'packages/barocss-cad-interop/examples/multispan-section-three-data');
const names = new Set(['warped_four', 'nonuniform_u'].flatMap(key => ['full-original-request.json', 'owned-result.json', 'actual-world.source0.css', 'surface-uv.dimensionless-only.json', 'plane-uv.dimensionless-only.json'].map(suffix => key + '.' + suffix)));
for (const name of ['warped_source', 'plane_source', 'shifted_source', 'shift_plane_source']) names.add(name + '.original.source0.css');
const requests = [], bundle = process.env.LOADER1213_COMPILED_BUNDLE;
export default defineConfig({ root, server: { host: '127.0.0.1', port: 5293, strictPort: true, fs: { allow: [root] } },
  optimizeDeps: { entries: ['packages/barocss-cad-interop/examples/multispan-section-three.html'], include: ['three'], noDiscovery: true }, plugins: [{
    name: 'original-multispan-section-files', configureServer(server) { server.middlewares.use((request, response, next) => {
      const path = new URL(request.url, 'http://localhost').pathname;
      if (path === '/loader1213-request-log.json') { response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(requests)); return; }
      if (bundle && path === '/loader1213-published.mjs') { response.setHeader('Content-Type', 'text/javascript'); response.setHeader('Cache-Control', 'no-store'); response.end(readFileSync(bundle)); return; }
      if (path === '/packages/barocss-cad-interop/examples/multispan-section-three.html') {
        let html = readFileSync(resolve(root, 'packages/barocss-cad-interop/examples/multispan-section-three.html'), 'utf8');
        if (bundle) html = html.replace('<html lang="en">', '<html lang="en" data-loader1213-mode="compiled">').replace('./multispan-section-three.mjs', '/loader1213-published.mjs');
        response.setHeader('Content-Type', 'text/html'); response.setHeader('Cache-Control', 'no-store'); response.end(html); return;
      }
      if (path.startsWith('/packages/barocss-cad-interop/examples/multispan-section-three-data/')) {
        const file = basename(path); if (!names.has(file)) { response.statusCode = 404; response.end(); return; }
        const bytes = readFileSync(resolve(directory, file)); requests.push({ sequence: requests.length + 1, file, bytes: bytes.length, status: 200 });
        response.setHeader('Content-Type', file.endsWith('.css') ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8');
        response.setHeader('Content-Length', bytes.length); response.setHeader('Cache-Control', 'no-store'); response.end(bytes); return;
      }
      next();
    }); }
  }] });
