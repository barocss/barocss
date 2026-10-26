import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const directory = dirname(fileURLToPath(import.meta.url)), root = resolve(directory, '../..');
const manifests = new Map();
for (const name of await readdir(resolve(root, 'packages'))) {
  try {
    const directory = resolve(root, 'packages', name);
    const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
    if (manifest.name?.startsWith('@barocss/')) manifests.set(manifest.name, { directory, manifest });
  } catch (error) { if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error; }
}
// Reuse installed tools, but resolve every own public package to this clone's source.
const sourceResolver = { name: 'viewer-review-local-source', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, ({ path }) => {
    const parts = path.split('/'), name = parts.slice(0, 2).join('/');
    const item = manifests.get(name), subpath = parts.length === 2 ? '.' : './' + parts.slice(2).join('/');
    const entry = item?.manifest.exports?.[subpath];
    const target = typeof entry === 'string' ? entry : entry?.import;
    if (!target?.startsWith('./src/')) throw new Error('Missing own public source entry: ' + path);
    return { path: resolve(item.directory, target) };
  });
} };
const bundle = await build({ absWorkingDir: root, entryPoints: [resolve(directory, 'app.js')],
  bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', target: 'es2022', plugins: [sourceResolver] });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = await Promise.all(Object.keys(bundle.metafile.inputs).map(async input => {
  const path = resolve(root, input), bytes = await readFile(path);
  return { path: relative(root, path), bytes: bytes.length, sha256: sha(bytes) };
}));
if (inputs.some(input => /packages\/[^/]+\/dist\//.test(input.path))) throw new Error('Unexpected own compiled input');
const audit = { mode: 'source-default', bundleSHA256: sha(bundle.outputFiles[0].contents), inputs };
const files = new Map([
  ['/', ['text/html', await readFile(resolve(directory, 'index.html'))]],
  ['/bundle.js', ['text/javascript', bundle.outputFiles[0].contents]],
  ['/document.json', ['application/json', await readFile(resolve(root, 'packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json'))]],
  ['/input-audit.json', ['application/json', JSON.stringify(audit, null, 2)]],
]);
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  if (path === '/favicon.ico') { response.writeHead(204).end(); return; }
  const file = files.get(path);
  if (!file) { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': file[0], 'cache-control': 'no-store' }).end(file[1]);
});
server.listen(Number(process.env.VIEWER_REVIEW_PORT || 53026), '127.0.0.1', () => {
  console.log(JSON.stringify({ url: 'http://127.0.0.1:' + server.address().port, bundleSHA256: audit.bundleSHA256, inputs: inputs.length }));
});
