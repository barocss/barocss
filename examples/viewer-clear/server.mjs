import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [new URL('app.js', import.meta.url).pathname], bundle: true,
  write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const modelRoot = new URL('../../packages/barocss-cad-interop/examples/', import.meta.url);
const mixed = await readFile(new URL('../viewer-curve-scene/mixed.barocad', import.meta.url));
const files = new Map([
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/', { body: await readFile(new URL('index.html', import.meta.url)), type: 'text/html' }],
  ['/mixed.barocad', { body: mixed, type: 'text/plain' }],
  ...await Promise.all(['a', 'b'].map(async suffix => [
    `/model-${suffix}.barocad`,
    { body: await readFile(new URL(`model-set-gpu-v2-${suffix}.barocad`, modelRoot)), type: 'text/plain' },
  ])),
]);
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  const file = path === '/slow.barocad' ? { body: mixed, type: 'text/plain' } : files.get(path);
  if (!file) { response.writeHead(404).end(); return; }
  const send = () => response.writeHead(200, { 'content-type': `${file.type}; charset=utf-8`,
    'cache-control': 'no-store' }).end(file.body);
  if (path === '/slow.barocad') setTimeout(send, 150);
  else send();
});
server.listen(Number(process.env.VIEWER_CLEAR_PORT || 52925), '127.0.0.1', () => {
  console.log(`Viewer clear: http://127.0.0.1:${server.address().port}/`);
});
