import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [new URL('app.js', import.meta.url).pathname], bundle: true,
  write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const files = new Map([
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/', { body: await readFile(new URL('index.html', import.meta.url)), type: 'text/html' }],
  ['/two-surfaces.barocad', { body: await readFile(new URL('two-surfaces.barocad', import.meta.url)), type: 'text/plain' }],
]);
const server = createServer((request, response) => {
  const file = files.get(request.url);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': `${file.type}; charset=utf-8`, 'cache-control': 'no-store' }).end(file.body);
});
server.listen(Number(process.env.VIEWER_MOTION_PORT || 52881), '127.0.0.1', () => {
  console.log(`Viewer Motion demo: http://127.0.0.1:${server.address().port}/`);
});
