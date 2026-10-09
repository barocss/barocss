import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { build } from 'esbuild';

const fixtureRoot = new URL('../../examples/gpu-scene/fixtures/', import.meta.url);
const expected = [
  [4187, '6f35abeed85c7743e69fd2ec98f099cb325f14a55b2a9bddffb90afbe6a8652f'],
  [4184, '25ba0fd9448b426c19120cf0fe5474d50a204592d0e27b145145c41e0c0af58f'],
];
const documents = await Promise.all([1, 2].map(async (revision, index) => {
  const bytes = await readFile(new URL(`area-revision${revision}.cad-document.json`, fixtureRoot));
  if (bytes.length !== expected[index][0] ||
    createHash('sha256').update(bytes).digest('hex') !== expected[index][1]) {
    throw new Error(`Canonical CAD Surface-area revision ${revision} changed`);
  }
  return bytes;
}));
const bundle = await build({ entryPoints: [new URL('app.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const files = new Map([
  ['/', { body: await readFile(new URL('index.html', import.meta.url)), type: 'text/html' }],
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/document/1', { body: documents[0], type: 'application/json' }],
  ['/document/2', { body: documents[1], type: 'application/json' }],
]);
let finish;
const done = new Promise(resolve => { finish = resolve; });
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  if (request.method === 'POST' && path === '/result') {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 1048576) { response.writeHead(413).end(); return; }
    }
    const result = JSON.parse(body);
    if (process.env.VIEWER_SURFACE_AREA_EVIDENCE) {
      await mkdir(dirname(process.env.VIEWER_SURFACE_AREA_EVIDENCE), { recursive: true });
      await writeFile(process.env.VIEWER_SURFACE_AREA_EVIDENCE, JSON.stringify(result, null, 2) + '\n');
    }
    finish(result);
    response.writeHead(200).end('Recorded');
    return;
  }
  const file = files.get(path);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': `${file.type}; charset=utf-8`, 'cache-control': 'no-store' }).end(file.body);
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(Number(process.env.VIEWER_SURFACE_AREA_PORT || 53002), '127.0.0.1', resolve);
});
console.log(`Viewer Surface area: http://127.0.0.1:${server.address().port}/`);
try {
  const result = await done;
  if (!result.ok) throw new Error(result.error);
  console.log('Actual Viewer native Surface area flow passed.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
