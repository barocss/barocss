import { createServer as createHTTPServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer as createViteServer } from 'vite';

const INPUTS = Object.freeze({
  A: { file: 'five_quarter_x_copies.barocad', bytes: 819, sha256: 'f40feb68dab3f96e30922c82ab4e872d585154fad33f559bb561bdc223a5b8e2' },
  B: { file: 'spacing_edit_same_roles.barocad', bytes: 822, sha256: 'e7937871215c3ee5724fef1e8f9b5707d62151389fe22a167d418d0bcb1c2f0d' },
});
/** Real immutable-body server with explicit chunk hold/release, never timing-based. */
export async function createReplacementBabylonServer({ root = process.cwd(), port = 5312, host = '127.0.0.1', compiledBundle = process.env.LOADER1300_COMPILED_BUNDLE } = {}) {
  const examples = resolve(root, 'packages/barocss-cad-interop/examples'), directory = resolve(examples, 'host-replacement-babylon-data');
  const bodies = new Map(Object.entries(INPUTS).map(([key, pin]) => { const bytes = readFileSync(resolve(directory, pin.file)); if (bytes.length !== pin.bytes || createHash('sha256').update(bytes).digest('hex') !== pin.sha256) throw new Error('Original bytes/SHA differ: ' + pin.file); return [key, bytes]; }));
  const events = [], gates = new Map(), sockets = new Set(); let requestCounter = 0;
  const event = (type, fields = {}) => { const row = { sequence: events.length + 1, type, ...fields }; events.push(row); return row; };
  const aliases = [
    { find: /^@barocss\/cad$/, replacement: resolve(root, 'packages/barocss-cad/src/index.ts') },
    { find: /^@barocss\/cad-interop\/native$/, replacement: resolve(root, 'packages/barocss-cad-interop/src/native.ts') },
    { find: /^@barocss\/cad-interop\/babylon$/, replacement: resolve(root, 'packages/barocss-cad-interop/src/babylon.ts') },
  ];
  const vite = await createViteServer({ root, configFile: false, appType: 'custom', resolve: { alias: aliases }, server: { middlewareMode: true, hmr: false, fs: { allow: [root] } }, optimizeDeps: { entries: ['packages/barocss-cad-interop/examples/host-replacement-babylon.html'], noDiscovery: true, include: [], exclude: ['@babylonjs/core'] } });
  const server = createHTTPServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost'), path = url.pathname;
      if (path === '/__loader1300/ledger') {
        const closedGate = url.searchParams.get('closedGate');
        if (closedGate !== null) {
          const held = gates.get(closedGate);
          if (!held) { response.statusCode = 404; response.end(); return; }
          // Observe the real held response close. This barrier neither cancels
          // the response nor synthesizes or delays a close event with a timer.
          await held.closePromise;
        }
        response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(events)); return;
      }
      if (path.startsWith('/__loader1300/release/')) {
        if (request.method !== 'POST') { response.statusCode = 405; response.end(); return; }
        const gate = decodeURIComponent(path.slice('/__loader1300/release/'.length)), held = gates.get(gate);
        if (!held || held.released || held.closed) { response.statusCode = 409; response.end(JSON.stringify({ released: false, gate })); return; }
        held.released = true; event('release', { requestId: held.requestId, gate, artifact: held.artifact }); held.response.end(held.bytes.subarray(128));
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ released: true, requestId: held.requestId, gate })); return;
      }
      if (path.startsWith('/__loader1300/source/')) {
        const route = path.slice('/__loader1300/source/'.length), artifact = route === 'held-A' ? 'A' : route === 'cancel-B' ? 'B' : route;
        const requestId = ++requestCounter, gate = url.searchParams.get('gate'); event('request', { requestId, artifact, gate, path });
        if (!bodies.has(artifact)) { response.statusCode = 404; event('http404', { requestId, artifact }); response.end(); return; }
        const bytes = bodies.get(artifact);
        if ((route === 'held-A' || route === 'cancel-B') && !gate) { response.statusCode = 400; event('missing-gate', { requestId, artifact }); response.end(); return; }
        if (gate && gates.has(gate)) { response.statusCode = 409; event('duplicate-gate', { requestId, artifact, gate }); response.end(); return; }
        response.setHeader('Content-Type', 'text/plain; charset=utf-8'); response.setHeader('Content-Length', bytes.length); response.setHeader('Cache-Control', 'no-store');
        let resolveClose;
        const closePromise = new Promise(done => { resolveClose = done; });
        const held = { requestId, artifact, gate, response, bytes, released: false, closed: false, closePromise };
        response.on('finish', () => event('end', { requestId, artifact, gate, totalBytes: bytes.length }));
        response.on('close', () => { held.closed = true; event('close', { requestId, artifact, gate, ended: response.writableEnded }); resolveClose(); });
        if (gate) { gates.set(gate, held); response.write(bytes.subarray(0, 128)); event('chunk', { requestId, artifact, gate, bytes: 128, declaredTotalBytes: bytes.length }); }
        else response.end(bytes);
        return;
      }
      if (compiledBundle && path === '/loader1300-published.mjs') { response.setHeader('Content-Type', 'text/javascript'); response.setHeader('Cache-Control', 'no-store'); response.end(readFileSync(compiledBundle)); return; }
      if (path === '/packages/barocss-cad-interop/examples/host-replacement-babylon.html') {
        let html = readFileSync(resolve(examples, 'host-replacement-babylon.html'), 'utf8');
        if (compiledBundle) html = html.replace('<html lang="en">', '<html lang="en" data-loader1300-mode="compiled">').replace('./host-replacement-babylon.mjs', '/loader1300-published.mjs');
        else html = await vite.transformIndexHtml(path, html);
        response.setHeader('Content-Type', 'text/html'); response.setHeader('Cache-Control', 'no-store'); response.end(html); return;
      }
      vite.middlewares(request, response, () => { response.statusCode = 404; response.end(); });
    } catch (error) { event('server-error', { name: error.name, message: error.message }); response.statusCode = 500; response.end(error.message); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, host, done); });
  return { server, vite, events, address: server.address(), async close() { for (const socket of sockets) socket.destroy(); await new Promise(done => server.close(done)); await vite.close(); } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv, portIndex = args.indexOf('--port'), port = portIndex < 0 ? 5312 : Number(args[portIndex + 1]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RangeError('Valid local port required');
  const runtime = await createReplacementBabylonServer({ port }); console.log(JSON.stringify({ ready: true, host: '127.0.0.1', port: runtime.address.port, compiled: Boolean(process.env.LOADER1300_COMPILED_BUNDLE) }));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await runtime.close(); process.exit(0); });
}
