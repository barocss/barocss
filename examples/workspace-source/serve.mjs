import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, relative } from 'node:path';
import { context } from 'esbuild';
import { here, root, families, inputProof, outputDirectory, writeEvidence } from './probe.mjs';

const output = outputDirectory();
const evidence = { work_id: 1010, mode: 'source', port: 52935, startedAt: new Date().toISOString(),
  builds: 0, requests: [], browserProofs: [], closed: false };
let writer = Promise.resolve();
function persist() {
  const snapshot = structuredClone(evidence);
  writer = writer.then(() => writeEvidence(output, 'host.json', snapshot));
  return writer;
}
const buildContext = await context({ absWorkingDir: root,
  entryPoints: [resolve(here, 'browser.mjs')], bundle: true, write: false,
  format: 'esm', platform: 'browser', target: 'es2022', metafile: true });
let cached;
let inputHashes = new Map();
let pending = Promise.resolve();
const configurationFiles = families.flatMap(family => ['package.json', 'tsconfig.json']
  .map(filename => resolve(family.directory, filename)));
async function fingerprint(paths) {
  return new Map(await Promise.all(paths.map(async path => {
    try { return [path, createHash('sha256').update(await readFile(path)).digest('hex')]; }
    catch (error) { if (error.code === 'ENOENT') return [path, null]; throw error; }
  })));
}
function bundle() {
  const task = pending.then(async () => {
    const started = performance.now();
    const checked = performance.now();
    const current = await fingerprint([...inputHashes.keys()]);
    const changed = [...current].filter(([path, digest]) => digest !== inputHashes.get(path))
      .map(([path]) => relative(root, path));
    const scanMs = performance.now() - checked;
    let transformMs = 0;
    const rebuilt = !cached || changed.length > 0;
    if (rebuilt) {
      const transformed = performance.now();
      const result = await buildContext.rebuild();
      transformMs = performance.now() - transformed;
      const inputs = inputProof(result.metafile, 'source');
      cached = result.outputFiles[0].contents;
      inputHashes = await fingerprint([...new Set([
        ...Object.keys(result.metafile.inputs).map(path => resolve(root, path)), ...configurationFiles])]);
      evidence.inputs = inputs;
      evidence.builds += 1;
    }
    const request = { sequence: evidence.requests.length + 1,
      kind: evidence.requests.length === 0 ? 'cold' : rebuilt ? 'edit' : 'unchanged',
      rebuilt, buildNumber: evidence.builds, changedInputs: changed, scanMs, transformMs,
      elapsedMs: performance.now() - started, bundleBytes: cached.length };
    evidence.requests.push(request);
    await persist();
    return { body: cached, request };
  });
  pending = task.catch(() => {});
  return task;
}
const html = await readFile(resolve(here, 'index.html'));
let closing = false;
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://127.0.0.1:52935').pathname;
    if (closing) { response.writeHead(503).end('Server is closing'); return; }
    if (path === '/bundle.js' && request.method === 'GET') {
      const result = await bundle();
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store', 'x-source-build': String(result.request.buildNumber),
        'x-source-rebuilt': String(result.request.rebuilt) }).end(result.body);
    } else if (path === '/' && request.method === 'GET') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html);
    } else if (path === '/evidence' && request.method === 'GET') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
        .end(JSON.stringify(evidence));
    } else if (path === '/browser-proof' && request.method === 'POST') {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 65536) { response.writeHead(413).end(); return; }
      }
      evidence.browserProofs.push({ timestamp: new Date().toISOString(), proof: JSON.parse(body) });
      await persist();
      response.writeHead(204).end();
    } else { response.writeHead(404).end('Not found'); }
  } catch (error) {
    evidence.firstFailure ??= error.stack || String(error);
    await persist();
    response.writeHead(500, { 'content-type': 'text/plain' }).end(String(error));
  }
});
async function close() {
  if (closing) return;
  closing = true;
  await new Promise(resolveClose => { server.close(resolveClose); server.closeIdleConnections(); });
  await pending;
  await buildContext.dispose();
  evidence.closed = true;
  evidence.contextDisposed = true;
  evidence.closedAt = new Date().toISOString();
  await persist();
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => close().catch(error => { console.error(error); process.exitCode = 1; }));
}
server.on('error', async error => {
  evidence.firstFailure ??= error.stack || String(error);
  await buildContext.dispose();
  await persist();
  process.exitCode = 1;
});
server.listen(52935, '127.0.0.1', () => {
  console.log('Source consumer: http://127.0.0.1:52935/');
});
