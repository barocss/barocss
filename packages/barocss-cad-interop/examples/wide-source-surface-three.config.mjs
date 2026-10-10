import { readFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataPrefix = '/packages/barocss-cad-interop/examples/wide-source-surface-three-data/';
const names = [
  'actual_degree5_u_v_native_coordinates.complete-original.source0.css',
  'actual_degree5_u_v_native_coordinates.complete-candidate.source0.css',
  'actual_degree5_u_v_native_coordinates.authored-request.json',
  'actual_degree5_u_v_native_coordinates.owned-result.json',
  'actual_16_by_16_256_poles_1024_fields.complete-original.source0.css',
  'actual_16_by_16_256_poles_1024_fields.complete-candidate.source0.css',
  'actual_16_by_16_256_poles_1024_fields.authored-request.json',
  'actual_16_by_16_256_poles_1024_fields.owned-result.json',
];

/** Literal data middleware and source/emitted host configuration. */
export function createWideSourceSurfaceThreeConfig({
  compiledBundle = process.env.LOADER1340_COMPILED_BUNDLE,
  port = 5340,
} = {}) {
  const ledger = [];
  const root = resolve(here, '../../..');
  const files = new Map(names.map(name => [dataPrefix + name, resolve(here, 'wide-source-surface-three-data', name)]));
  return {
    root,
    configFile: false,
    resolve: {
      alias: compiledBundle ? [] : [
        { find: '@barocss/cad-interop/native', replacement: resolve(here, '../src/native.ts') },
        { find: '@barocss/cad-interop/three', replacement: resolve(here, '../src/three.ts') },
        { find: '@barocss/cad', replacement: resolve(root, 'packages/barocss-cad/src/index.ts') },
      ],
    },
    optimizeDeps: { noDiscovery: true, include: ['three'] },
    server: { host: '127.0.0.1', port, strictPort: true },
    plugins: [{
      name: 'wide-source-surface-three-literal-host',
      transformIndexHtml(html) {
        return compiledBundle
          ? html.replace('./wide-source-surface-three.mjs', '/loader1340-compiled-browser.mjs')
          : html;
      },
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const url = new URL(request.url ?? '/', 'http://127.0.0.1');
          if (url.pathname === '/loader1340-request-log.json') {
            const body = Buffer.from(JSON.stringify({ requests: ledger }));
            response.writeHead(200, { 'Content-Type': 'application/json;charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
            response.end(body);
            return;
          }
          if (url.pathname === '/loader1340-compiled-browser.mjs' && compiledBundle) {
            const body = readFileSync(resolve(compiledBundle));
            response.writeHead(200, { 'Content-Type': 'text/javascript;charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
            response.end(body);
            return;
          }
          if (url.pathname.startsWith(dataPrefix)) {
            const path = files.get(url.pathname);
            const row = { index: ledger.length + 1, method: request.method, path: url.pathname, query: url.search, status: path ? 200 : 404, bytes: 0, end: false, close: false, events: [] };
            ledger.push(row);
            response.on('finish', () => { row.end = true; row.events.push({ type: 'finish', bytes: row.bytes }); });
            response.on('close', () => { row.close = true; row.events.push({ type: 'close', ended: response.writableFinished }); });
            if (!path || !['GET', 'HEAD'].includes(request.method)) {
              row.status = path ? 405 : 404;
              response.writeHead(row.status, { 'Content-Length': 0, 'Cache-Control': 'no-store' });
              response.end();
              return;
            }
            const body = readFileSync(path);
            row.file = basename(path);
            row.contentLength = body.length;
            row.contentType = path.endsWith('.css') ? 'text/plain;charset=utf-8' : 'application/json;charset=utf-8';
            response.writeHead(200, { 'Content-Type': row.contentType, 'Content-Length': body.length, 'Cache-Control': 'no-store' });
            if (request.method === 'HEAD') response.end();
            else { row.bytes = body.length; row.events.push({ type: 'write', bytes: body.length }); response.end(body); }
            return;
          }
          if (compiledBundle && /^\/packages\/barocss-(cad|cad-interop)\/src\//.test(url.pathname)) {
            response.writeHead(403, { 'Content-Length': 0 });
            response.end();
            return;
          }
          next();
        });
      },
    }],
  };
}

export default createWideSourceSurfaceThreeConfig();
