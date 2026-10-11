import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const compiled = process.env.VIEWER_UNIFORM_COMPILED === '1';
const manifests = new Map();
for (const name of await readdir(resolve(root, 'packages'))) {
  try {
    const packageDirectory = resolve(root, 'packages', name);
    const manifest = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8'));
    if (manifest.name?.startsWith('@barocss/')) manifests.set(manifest.name, { manifest, packageDirectory });
  } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
}
// Test-only checkpoint. Development uses ordinary public-name source resolution.
const publishResolver = { name: 'viewer-uniform-compiled-checkpoint', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, ({ path }) => {
    const parts = path.split('/'), name = parts.slice(0, 2).join('/');
    const item = manifests.get(name);
    if (!item) throw new Error('Unknown own package ' + path);
    const subpath = parts.length === 2 ? '.' : './' + parts.slice(2).join('/');
    const entry = item.manifest.publishConfig?.exports?.[subpath];
    const target = typeof entry === 'string' ? entry : entry?.import;
    if (typeof target !== 'string' || !target.startsWith('./dist/'))
      throw new Error('Missing publishConfig compiled import map for ' + path);
    return { path: resolve(item.packageDirectory, target) };
  });
} };
const bundle = await build({ absWorkingDir: root, entryPoints: [resolve(directory, 'app.js')],
  bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser', target: 'es2022',
  plugins: compiled ? [publishResolver] : [] });
const inputs = Object.keys(bundle.metafile.inputs).map(path => relative(root, resolve(root, path)));
const ownSource = inputs.filter(path => /^packages\/[^/]+\/src\//.test(path));
const ownDist = inputs.filter(path => /^packages\/[^/]+\/dist\//.test(path));
if (compiled ? ownSource.length !== 0 || ownDist.length === 0 : ownDist.length !== 0 || ownSource.length === 0)
  throw new Error('Own source/dist checkpoint contamination: ' + JSON.stringify({ ownSource, ownDist }));
const audit = { mode: compiled ? 'compiled-checkpoint' : 'source-default', inputs,
  ownSourceCount: ownSource.length, ownDistCount: ownDist.length,
  ownSource, ownDist, compiledResolver: compiled ? 'publishConfig.exports.import for every own public entry' : null };
// Original #979 authored native source. Loader/CAD supplies genuine native authority.
const nativeSource = '@model cloth_native_control { version:0; length-unit:mm; '
  + '@surface #original_panel { type:nurbs; degree-u:1; degree-v:1; '
  + 'knots-u:[-0,-0,5,5]; knots-v:[10,10,20,20]; '
  + 'control-points:[[[-700,300,-700],[-700,300,700]],[[700,300,-700],[700,300,700]]]; '
  + 'weights:[[1,1],[1,1]]; } }';
const fixtureSources = ['primary_quintic', 'endpoint_jet_edit', 'signed_zero'].map(name =>
  [name, resolve(directory, 'fixtures', name + '.source0.css')]);
const sectionFiles = [
  { name: 'polynomial.actual-world.source0.css', url: '/fixtures/polynomial.actual-world.source0.css', type: 'text/plain',
    sha256: 'e81ab0a741e21c7e67fef91474fbc8af6e00bbdad55601d3637c943b58bfc0aa' },
  { name: 'polynomial.authored-request.json', url: '/section-request.json', type: 'application/json',
    sha256: 'e03e88358163c3b9dbf10644af97fd61cd3fbbb5f97be17b4dbfdbb44356332c' },
  { name: 'polynomial.surface-uv.dimensionless-sidecar.json', url: '/section-surface-uv.json', type: 'application/json',
    sha256: 'd303318d3f1d8597afc61891e7bfc72c92af4f28e3deb892c47d2dd1ad37d676' },
  { name: 'polynomial.plane-uv.dimensionless-sidecar.json', url: '/section-plane-uv.json', type: 'application/json',
    sha256: 'cb271feaa6557dc8136e7753f1e4e9770662a6486ac6a0ad5f637dd6e98b22fc' },
];
const sectionManifest = [], sectionRoutes = [];
for (const file of sectionFiles) {
  const sourcePath = resolve(directory, 'fixtures', file.name), body = await readFile(sourcePath);
  if (createHash('sha256').update(body).digest('hex') !== file.sha256)
    throw new Error('Immutable degree4 section fixture hash differs: ' + file.name);
  sectionManifest.push({ ...file, sourcePath, bytes: body.length });
  sectionRoutes.push([file.url, { body, type: file.type }]);
}
fixtureSources.push(['degree4_section', resolve(directory, 'fixtures', 'polynomial.actual-world.source0.css'),
  '/fixtures/polynomial.actual-world.source0.css']);
const fixtureManifest = [], fixtureFiles = [];
for (const [name, sourcePath, sourceURL] of fixtureSources) {
  try {
    const body = await readFile(sourcePath);
    const url = sourceURL ?? '/fixture/' + name;
    fixtureManifest.push({ name, sourcePath, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), url,
      ...(name === 'degree4_section' ? { sectionFiles: sectionManifest } : {}) });
    fixtureFiles.push([url, { body, type: 'text/plain' }]);
  } catch (error) { throw error; }
}
const files = new Map([
  ...fixtureFiles,
  ...sectionRoutes,
  ['/fixture-manifest.json', { body: JSON.stringify(fixtureManifest, null, 2), type: 'application/json' }],
  ['/', { body: await readFile(resolve(directory, 'index.html')), type: 'text/html' }],
  ...await Promise.all([0, 1].map(async revision => ['/assembly-revision' + revision + '.json', { body: await readFile(resolve(root, 'examples/gpu-scene/fixtures/assembly-revision' + revision + '.json')), type: 'application/json' }])),
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/original-panel.barocad', { body: nativeSource, type: 'text/plain' }],
  ['/shell-graph.json', { body: await readFile(resolve(root,
    'packages/barocss-cad-interop/examples/boolean-extrusion-fanout-three-data/three_shared_region_leaves.authored-graph.json')), type: 'application/json' }],
  ['/input-audit.json', { body: JSON.stringify(audit, null, 2), type: 'application/json' }],
]);
const heldNative = new Set();
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://127.0.0.1').pathname;
    if (request.method === 'GET' && path === '/slow-native.barocad') {
      heldNative.add(response);
      response.once('close', () => heldNative.delete(response));
      return;
    }
    if (request.method === 'POST' && path === '/release-slow') {
      const released = heldNative.size;
      for (const held of heldNative) held.writeHead(200, { 'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store' }).end(nativeSource);
      heldNative.clear();
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ released }));
      return;
    }
    if (request.method === 'POST' && path === '/result') {
      let text = '';
      for await (const chunk of request) {
        text += chunk;
        if (text.length > 4 * 1024 * 1024) { response.writeHead(413).end(); return; }
      }
      const result = JSON.parse(text);
      if (process.env.VIEWER_UNIFORM_EVIDENCE) {
        await mkdir(dirname(process.env.VIEWER_UNIFORM_EVIDENCE), { recursive: true });
        await writeFile(process.env.VIEWER_UNIFORM_EVIDENCE, JSON.stringify(result, null, 2) + '\n');
      }
      console.log(JSON.stringify({ result: result.ok, error: result.error ?? null }));
      response.writeHead(200).end('Recorded'); return;
    }
    const file = files.get(path);
    if (!file) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': file.type + '; charset=utf-8',
      'cache-control': 'no-store' }).end(file.body);
  } catch (error) { console.error(error); response.writeHead(500).end('Request failed'); }
});
server.listen(Number(process.env.VIEWER_UNIFORM_PORT || 53056), '127.0.0.1', () => {
  console.log(JSON.stringify({ mode: audit.mode, ownSourceCount: audit.ownSourceCount, ownDistCount: audit.ownDistCount, audit: '/input-audit.json' }));
  console.log('Viewer uniform Curve ' + audit.mode + ': http://127.0.0.1:' + server.address().port + '/');
});
