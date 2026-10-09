import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const compiled = process.env.VIEWER_SHELL_COMPILED === '1';
const manifests = new Map();
for (const name of await readdir(resolve(root, 'packages'))) {
  try {
    const packageDirectory = resolve(root, 'packages', name);
    const manifest = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8'));
    if (manifest.name?.startsWith('@barocss/')) manifests.set(manifest.name, { manifest, packageDirectory });
  } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
}
// Test-only checkpoint. Development uses ordinary public-name source resolution.
const publishResolver = { name: 'viewer-shell-compiled-checkpoint', setup(builder) {
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
const controlDirectory = process.env.VIEWER_SHELL_CONTROL_DIR || '/Users/user/.barocss-ai/v3/evidence-903-cad/integration/demo-output';
const fourthFile = process.env.VIEWER_SHELL_FOURTH_FILE || '/Users/user/.barocss-ai/v3/evidence-927-cad/integration/demo-output/fourth_literal_extrusion_leaf.authored-graph.json';
const fixtureSources = [
  ['three', resolve(root, 'packages/barocss-cad-interop/examples/boolean-extrusion-fanout-three-data/three_shared_region_leaves.authored-graph.json')],
  ['edited', resolve(root, 'packages/barocss-cad-interop/examples/boolean-extrusion-fanout-three-data/shared_height_parameter_edit.authored-graph.json')],
  ['empty', resolve(root, 'packages/barocss-cad-interop/examples/boolean-extrusion-fanout-three-data/three_genuine_empty_leaves.authored-graph.json')],
  ['revision1', resolve(root, 'packages/barocss-cad-interop/examples/boolean-extrusion-feature-mesh-three-data/revision1_authentic.authored-graph.json')],
  ['revision3', resolve(root, 'packages/barocss-cad-interop/examples/boolean-extrusion-feature-mesh-three-data/revision3_replace_boolean.authored-graph.json')],
  ['hole', resolve(controlDirectory, 'containment_hole.authored-graph.json')],
  ['strip', resolve(controlDirectory, 'strip_two_components.authored-graph.json')],
  ['four', resolve(fourthFile)],
];
const fixtureManifest = [], fixtureFiles = [];
for (const [name, sourcePath] of fixtureSources) {
  try {
    const body = await readFile(sourcePath);
    fixtureManifest.push({ name, sourcePath, bytes: body.length, sha256: createHash('sha256').update(body).digest('hex'), url: '/fixture/' + name });
    fixtureFiles.push(['/fixture/' + name, { body, type: 'application/json' }]);
  } catch (error) {
    if (error.code !== 'ENOENT' || ['three', 'edited', 'empty', 'revision1', 'revision3'].includes(name)) throw error;
    console.log('Optional original authored control unavailable: ' + sourcePath);
  }
}
const files = new Map([
  ...fixtureFiles,
  ['/fixture-manifest.json', { body: JSON.stringify(fixtureManifest, null, 2), type: 'application/json' }],
  ['/', { body: await readFile(resolve(directory, 'index.html')), type: 'text/html' }],
  ...await Promise.all([0, 1].map(async revision => ['/assembly-revision' + revision + '.json', { body: await readFile(resolve(root, 'examples/gpu-scene/fixtures/assembly-revision' + revision + '.json')), type: 'application/json' }])),
  ['/bundle.js', { body: bundle.outputFiles[0].contents, type: 'text/javascript' }],
  ['/original-panel.barocad', { body: nativeSource, type: 'text/plain' }],
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
      if (process.env.VIEWER_SHELL_EVIDENCE) {
        await mkdir(dirname(process.env.VIEWER_SHELL_EVIDENCE), { recursive: true });
        await writeFile(process.env.VIEWER_SHELL_EVIDENCE, JSON.stringify(result, null, 2) + '\n');
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
server.listen(Number(process.env.VIEWER_SHELL_PORT || 52999), '127.0.0.1', () => {
  console.log(JSON.stringify({ mode: audit.mode, ownSourceCount: audit.ownSourceCount, ownDistCount: audit.ownDistCount, audit: '/input-audit.json' }));
  console.log('Viewer Shell ' + audit.mode + ': http://127.0.0.1:' + server.address().port + '/');
});
