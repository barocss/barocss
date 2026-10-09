import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: [new URL('app.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
});
const jointBundle = await build({
  entryPoints: [new URL('joint-demo.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
});
const motorBundle = await build({
  entryPoints: [new URL('motor-demo.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
});
const dynamicHingeBundle = await build({
  entryPoints: [new URL('dynamic-hinge-demo.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
});
const files = new Map([
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/joint-demo.js', { body: jointBundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/joint-demo.html', { body: await readFile(new URL('joint-demo.html', import.meta.url)), type: 'text/html' }],
  ['/motor-demo.js', { body: motorBundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/motor-demo.html', { body: await readFile(new URL('motor-demo.html', import.meta.url)), type: 'text/html' }],
  ['/dynamic-hinge-demo.js', { body: dynamicHingeBundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/dynamic-hinge-demo.html', { body: await readFile(new URL('dynamic-hinge-demo.html', import.meta.url)), type: 'text/html' }],
  ['/', { body: await readFile(new URL('index.html', import.meta.url)), type: 'text/html' }],
  ['/two-surfaces.barocad', { body: await readFile(new URL('two-surfaces.barocad', import.meta.url)), type: 'text/plain' }],
]);
const server = createServer((request, response) => {
  const file = files.get(new URL(request.url, 'http://127.0.0.1').pathname);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, {
    'content-type': `${file.type}; charset=utf-8`,
    'cache-control': 'no-store',
  }).end(file.body);
});
server.listen(Number(process.env.PHYSICS_VIEWER_PORT || 52884), '127.0.0.1', () => {
  console.log(`Physics Viewer demo: http://127.0.0.1:${server.address().port}/`);
});
