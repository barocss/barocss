import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [new URL('app.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const fixtureRoot = new URL('../../packages/barocss-cad-interop/examples/', import.meta.url);
const files = new Map([
  ['/', { body: await readFile(new URL('index.html', import.meta.url)), type: 'text/html' }],
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ...await Promise.all(['a', 'b'].map(async suffix => [
    `/model-${suffix}.barocad`,
    { body: await readFile(new URL(`model-set-gpu-v2-${suffix}.barocad`, fixtureRoot)), type: 'text/plain' },
  ])),
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
    if (process.env.VIEWER_MIXED_MATERIAL_EVIDENCE) {
      await mkdir(dirname(process.env.VIEWER_MIXED_MATERIAL_EVIDENCE), { recursive: true });
      await writeFile(process.env.VIEWER_MIXED_MATERIAL_EVIDENCE, JSON.stringify(result, null, 2) + '\n');
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
  server.listen(Number(process.env.VIEWER_MIXED_MATERIAL_PORT || 52985), '127.0.0.1', resolve);
});
console.log(`Viewer mixed materials: http://127.0.0.1:${server.address().port}/`);
try {
  const result = await done;
  if (!result.ok) throw new Error(result.error);
  console.log('Actual Viewer mixed Surface/Curve material flow passed.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
