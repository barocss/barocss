import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const args = process.argv.slice(2);
assert.ok(args.length === 2 && args[0] === '--port', 'Usage: node host-replacement-server.mjs --port 5195');
const port = Number(args[1]);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535, 'An explicit local port is required');
const files = {
  A: { file: 'five_quarter_x_copies.barocad', bytes: 819, sha256: 'f40feb68dab3f96e30922c82ab4e872d585154fad33f559bb561bdc223a5b8e2' },
  B: { file: 'spacing_edit_same_roles.barocad', bytes: 822, sha256: 'e7937871215c3ee5724fef1e8f9b5707d62151389fe22a167d418d0bcb1c2f0d' },
};
const sources = Object.fromEntries(Object.entries(files).map(([key, value]) => {
  const bytes = readFileSync(resolve(here, 'linear-geometry-pattern-babylon-data', value.file));
  assert.equal(bytes.length, value.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), value.sha256);
  return [key, bytes];
}));
const events = [], gates = new Map();
let requestNumber = 0;
const record = (type, data = {}) => events.push({ sequence: events.length + 1, type, ...data });
const server = createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const sendJSON = (value, status = 200) => response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(value));
  if (url.pathname === '/__loader991/health') { sendJSON({ ready: true, port }); return; }
  if (url.pathname === '/__loader991/events') { sendJSON(events); return; }
  if (url.pathname === '/__loader991/release') {
    const gate = url.searchParams.get('gate');
    const held = gates.get(gate);
    record('release', { gate, requestId: held?.requestId ?? null, active: !!held });
    if (held) { gates.delete(gate); held.finish(); }
    sendJSON({ released: !!held, gate }); return;
  }
  if (!url.pathname.startsWith('/__loader991/source/')) { vite.middlewares(request, response); return; }
  const key = url.pathname.split('/').at(-1);
  const requestId = ++requestNumber, gate = url.searchParams.get('gate');
  record('request', { requestId, artifact: key, gate });
  if (key === 'http503') { record('status', { requestId, status: 503 }); response.writeHead(503).end('Explicit loader991 HTTP failure'); return; }
  const bytes = key === 'invalid' ? Buffer.from('@model broken { version:0; length-unit:mm; @curve #bad { degree:99; } }') : sources[key];
  if (!bytes) { response.writeHead(404).end(); return; }
  if (gate && gates.has(gate)) { response.writeHead(409).end('Gate already held'); return; }
  if (gate && !/^[A-Za-z0-9_-]{1,64}$/.test(gate)) { response.writeHead(400).end('Invalid gate'); return; }
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': bytes.length, 'cache-control': 'no-store' });
  let ended = false;
  const finish = () => {
    if (response.destroyed) return;
    if (gate) { response.write(bytes.subarray(128)); record('chunk', { requestId, bytes: bytes.length - 128, totalBytes: bytes.length }); }
    ended = true; response.end(); record('end', { requestId, totalBytes: bytes.length });
  };
  response.on('close', () => {
    record(ended ? 'close' : 'premature-close', { requestId, gate });
    if (gates.get(gate)?.requestId === requestId) gates.delete(gate);
  });
  if (gate) {
    gates.set(gate, { requestId, finish });
    response.write(bytes.subarray(0, 128)); response.flushHeaders();
    record('chunk', { requestId, bytes: Math.min(128, bytes.length), totalBytes: Math.min(128, bytes.length) });
  } else { response.write(bytes); record('chunk', { requestId, bytes: bytes.length, totalBytes: bytes.length }); finish(); }
});
const vite = await createViteServer({ configFile: false, root, logLevel: 'warn', appType: 'mpa',
  server: { middlewareMode: true, hmr: { server }, watch: { ignored: ['**/node_modules/**'] } },
  optimizeDeps: { entries: [resolve(here, 'host-replacement-three.html')], include: ['three'] } });
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ ready: true, port, root, html: '/packages/barocss-cad-interop/examples/host-replacement-three.html' })));
async function stop() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await vite.close(); }
process.once('SIGTERM', () => { stop().then(() => process.exit(0)); });
process.once('SIGINT', () => { stop().then(() => process.exit(0)); });
