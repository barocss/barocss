import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { build } from 'esbuild';

const documentBytes = await readFile(new URL('../../packages/barocss-cad-interop/examples/curve-arc-length-data/revision1.cad-document.json', import.meta.url));
const documentSha256 = createHash('sha256').update(documentBytes).digest('hex');
if (documentBytes.length !== 3027 ||
  documentSha256 !== '6422e2aeeb8560af86b41e8a60c70cddec01f42ef43c3ac93789c6407a186f84') {
  throw new Error('Canonical CAD document fixture changed');
}
const bundle = await build({ entryPoints: [new URL('app.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const files = new Map([
  ['/', { body: await readFile(new URL('index.html', import.meta.url)), type: 'text/html' }],
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/document', { body: documentBytes, type: 'application/json' }],
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
    if (process.env.VIEWER_CURVE_LENGTH_EVIDENCE) {
      await mkdir(dirname(process.env.VIEWER_CURVE_LENGTH_EVIDENCE), { recursive: true });
      await writeFile(process.env.VIEWER_CURVE_LENGTH_EVIDENCE, JSON.stringify(result, null, 2) + '\n');
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
  server.listen(Number(process.env.VIEWER_CURVE_LENGTH_PORT || 52998), '127.0.0.1', resolve);
});
console.log(`Viewer Curve length: http://127.0.0.1:${server.address().port}/`);
try {
  const result = await done;
  if (!result.ok) throw new Error(result.error);
  console.log('Actual Viewer native Curve length flow passed.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
