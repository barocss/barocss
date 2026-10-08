import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { build } from 'esbuild';

const panel = (name, left, right) => `@model ${name} { version:0; length-unit:mm; `
  + '@surface #shared_panel { type:nurbs; degree-u:1; degree-v:1; '
  + 'knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; '
  + `control-points:[[[${left},0,0],[${left},700,0]],`
  + `[[${right},0,0],[${right},700,0]]]; weights:[[1,1],[1,1]]; } }`;
const leftSource = panel('left_model', -700, -100);
const rightSource = panel('right_model', 100, 700);
const bundle = await build({ entryPoints: [new URL('app.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const files = new Map([
  ['/', { body: await readFile(new URL('index.html', import.meta.url)), type: 'text/html' }],
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/left.barocad', { body: leftSource, type: 'text/plain' }],
  ['/right.barocad', { body: rightSource, type: 'text/plain' }],
]);
let finish;
const done = new Promise(resolve => { finish = resolve; });
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (request.method === 'POST' && url.pathname === '/result') {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 1048576) { response.writeHead(413).end(); return; }
    }
    const result = JSON.parse(body);
    if (process.env.VIEWER_MULTI_MATERIAL_EVIDENCE) {
      await mkdir(dirname(process.env.VIEWER_MULTI_MATERIAL_EVIDENCE), { recursive: true });
      await writeFile(process.env.VIEWER_MULTI_MATERIAL_EVIDENCE, JSON.stringify(result, null, 2) + '\n');
    }
    finish(result);
    response.writeHead(200).end('Recorded');
    return;
  }
  const file = files.get(url.pathname);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': `${file.type}; charset=utf-8`,
    'cache-control': 'no-store' }).end(file.body);
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(Number(process.env.VIEWER_MULTI_MATERIAL_PORT || 52980), '127.0.0.1', resolve);
});
console.log(`Viewer multi-Surface materials: http://127.0.0.1:${server.address().port}/`);
try {
  const result = await done;
  if (!result.ok) throw new Error(result.error);
  console.log('Actual Viewer multi-material flow passed.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
