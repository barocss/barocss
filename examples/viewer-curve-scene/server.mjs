import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [new URL('app.js', import.meta.url).pathname], bundle: true,
  write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const files = new Map([
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/', { body: await readFile(new URL('index.html', import.meta.url)), type: 'text/html' }],
  ...await Promise.all(['mixed', 'curves-only'].map(async name =>
    [`/${name}.barocad`, { body: await readFile(new URL(`${name}.barocad`, import.meta.url)), type: 'text/plain' }])),
]);
const server = createServer((request, response) => {
  const file = files.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': `${file.type}; charset=utf-8`, 'cache-control': 'no-store' }).end(file.body);
});
server.listen(Number(process.env.VIEWER_CURVE_PORT || 52922), '127.0.0.1', () => {
  console.log(`Viewer Curve scene: http://127.0.0.1:${server.address().port}/`);
});
