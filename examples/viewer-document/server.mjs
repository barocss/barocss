import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [new URL('app.js', import.meta.url).pathname], bundle: true,
  write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const fixtureRoot = new URL('../../packages/barocss-cad-interop/examples/', import.meta.url);
const documentFile = await readFile(new URL('document-gpu-v2.cad-document.json', fixtureRoot));
const files = new Map([
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/', { body: await readFile(new URL('index.html', import.meta.url)), type: 'text/html' }],
  ['/document.cad-document.json', { body: documentFile, type: 'application/json' }],
  ...await Promise.all(['a', 'b'].map(async suffix => [
    `/model-${suffix}.barocad`,
    { body: await readFile(new URL(`model-set-gpu-v2-${suffix}.barocad`, fixtureRoot)), type: 'text/plain' },
  ])),
]);
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  const file = files.get(path);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': `${file.type}; charset=utf-8`,
    'cache-control': 'no-store' }).end(file.body);
});
server.listen(Number(process.env.VIEWER_DOCUMENT_PORT || 52926), '127.0.0.1', () => {
  console.log(`Viewer document: http://127.0.0.1:${server.address().port}/`);
});
