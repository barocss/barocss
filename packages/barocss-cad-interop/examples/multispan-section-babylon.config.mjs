import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
const root = process.cwd(), directory = resolve(root, 'packages/barocss-cad-interop/examples/multispan-section-babylon-data');
const names = new Set(['warped_four', 'nonuniform_u'].flatMap(key => ['full-original-request.json', 'owned-result.json', 'actual-world.source0.css', 'surface-uv.dimensionless-only.json', 'plane-uv.dimensionless-only.json'].map(suffix => key + '.' + suffix)));
for (const name of ['warped_source', 'plane_source', 'shifted_source', 'shift_plane_source']) names.add(name + '.original.source0.css');
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alias = [];
for (const name of ['barocss-cad', 'barocss-cad-interop']) {
  const directory = resolve(root, 'packages', name), manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  for (const [key, entry] of Object.entries(manifest.exports)) {
    const target = typeof entry === 'string' ? entry : entry.import;
    if (typeof target === 'string') alias.push({ find: new RegExp('^' + escape(manifest.name + (key === '.' ? '' : key.slice(1))) + '$'), replacement: resolve(directory, target) });
  }
}
const requests = [], bundle = process.env.LOADER1222_COMPILED_BUNDLE;
export default { root, resolve: { alias }, server: { host: '127.0.0.1', port: 5294, strictPort: true, fs: { allow: [root] } },
  optimizeDeps: { entries: ['packages/barocss-cad-interop/examples/multispan-section-babylon.html'], include: ['@babylonjs/core'], noDiscovery: true }, plugins: [{
    name: 'original-multispan-babylon-files', configureServer(server) { server.middlewares.use((request, response, next) => {
      const path = new URL(request.url, 'http://localhost').pathname;
      if (path === '/loader1222-request-log.json') { response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(requests)); return; }
      if (bundle && path === '/loader1222-published.mjs') { response.setHeader('Content-Type', 'text/javascript'); response.setHeader('Cache-Control', 'no-store'); response.end(readFileSync(bundle)); return; }
      if (path === '/packages/barocss-cad-interop/examples/multispan-section-babylon.html') {
        let html = readFileSync(resolve(root, 'packages/barocss-cad-interop/examples/multispan-section-babylon.html'), 'utf8');
        if (bundle) html = html.replace('<html lang="en">', '<html lang="en" data-loader1222-mode="compiled">').replace('./multispan-section-babylon.mjs', '/loader1222-published.mjs');
        response.setHeader('Content-Type', 'text/html'); response.setHeader('Cache-Control', 'no-store'); response.end(html); return;
      }
      if (path.startsWith('/packages/barocss-cad-interop/examples/multispan-section-babylon-data/')) {
        const file = basename(path); if (!names.has(file)) { response.statusCode = 404; response.end(); return; }
        const bytes = readFileSync(resolve(directory, file)); requests.push({ sequence: requests.length + 1, file, bytes: bytes.length, status: 200 });
        response.setHeader('Content-Type', file.endsWith('.css') ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8'); response.setHeader('Content-Length', bytes.length); response.setHeader('Cache-Control', 'no-store'); response.end(bytes); return;
      } next();
    }); }
  }] };
