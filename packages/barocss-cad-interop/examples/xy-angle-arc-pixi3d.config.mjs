import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
const root = process.cwd(), directory = resolve(root, 'packages/barocss-cad-interop/examples/xy-angle-arc-pixi3d-data');
const keys = ['noncardinal_positive_single_span', 'noncardinal_clockwise_single_span', 'positive_multispan_native_c0', 'negative_multispan_native_c0', 'arbitrary_start_full_turn_copied_seam', 'clockwise_full_turn_copied_seam', 'exact_authored_cardinal_quarter', 'authored_minus_zero_cardinal_start', 'center_radius_angle_changed_request_rebuild', 'same_request_deterministic_rebuild'];
const names = new Set(keys.flatMap(key => ['actual-curve-source.source0.css', 'authored-request.json', 'owned-result.json', 'independent-rational-angle-witness.json'].map(suffix => key + '.' + suffix)));
const requests = [], bundle = process.env.LOADER1200_COMPILED_BUNDLE;
export default defineConfig({ root, server: { host: '127.0.0.1', port: 5282, strictPort: true, fs: { allow: [root] } }, optimizeDeps: { entries: ['packages/barocss-cad-interop/examples/xy-angle-arc-pixi3d.html'], include: ['pixi.js', 'pixi3d/pixi7'], noDiscovery: true }, plugins: [{
  name: 'unchanged-xy-angle-arc-files', configureServer(server) { server.middlewares.use((request, response, next) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/loader1200-request-log.json') { response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(requests)); return; }
    if (bundle && path === '/loader1200-published.mjs') { response.setHeader('Content-Type', 'text/javascript'); response.setHeader('Cache-Control', 'no-store'); response.end(readFileSync(bundle)); return; }
    if (path === '/packages/barocss-cad-interop/examples/xy-angle-arc-pixi3d.html') { let html = readFileSync(resolve(root, 'packages/barocss-cad-interop/examples/xy-angle-arc-pixi3d.html'), 'utf8'); if (bundle) html = html.replace('<html lang="en">', '<html lang="en" data-loader1200-mode="compiled">').replace('./xy-angle-arc-pixi3d.mjs', '/loader1200-published.mjs'); response.setHeader('Content-Type', 'text/html'); response.setHeader('Cache-Control', 'no-store'); response.end(html); return; }
    if (path.startsWith('/packages/barocss-cad-interop/examples/xy-angle-arc-pixi3d-data/')) { const file = basename(path); if (!names.has(file)) { response.statusCode = 404; response.end(); return; } const bytes = readFileSync(resolve(directory, file)); requests.push({ sequence: requests.length + 1, file, bytes: bytes.length, status: 200 }); response.setHeader('Content-Type', file.endsWith('.css') ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8'); response.setHeader('Content-Length', bytes.length); response.setHeader('Cache-Control', 'no-store'); response.end(bytes); return; }
    next();
  }); }
}] });
