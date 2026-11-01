import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

// Source provider identity must match this startup build's current numerical graph.
execFileSync(process.execPath, [fileURLToPath(new URL('../../packages/barocss-physics/src/generate-provider.mjs', import.meta.url))],
  { cwd: fileURLToPath(new URL('../..', import.meta.url)), encoding: 'utf8' });

const bundle = await build({
  entryPoints: [new URL('app.js', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
});
const files = new Map([
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/', { body: await readFile(new URL('index.html', import.meta.url)), type: 'text/html' }],
  ['/two-surfaces.barocad', { body: await readFile(new URL('two-surfaces.barocad', import.meta.url)), type: 'text/plain' }],
]);
const server = createServer((request, response) => {
  const file = files.get(request.url);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, {
    'content-type': `${file.type}; charset=utf-8`,
    'cache-control': 'no-store',
  }).end(file.body);
});
server.listen(Number(process.env.PHYSICS_CAD_PORT || 52885), '127.0.0.1', () => {
  console.log(`Physics CAD proxy demo: http://127.0.0.1:${server.address().port}/`);
});
