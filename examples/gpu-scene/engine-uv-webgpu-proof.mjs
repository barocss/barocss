/** #1184 offline preparation only.
 * node examples/gpu-scene/engine-uv-webgpu-proof.mjs --output ABS_FRESH --build-only [--source-parent LOWERCASE40SHA]
 * This runner never serves, probes a port, opens a browser or accesses a GPU.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { createEngineUVProofFixture, serializeEngineUVProofOriginals } from './engine-uv-webgpu-proof-fixture.mjs';

assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Node22 is required');
assert.deepEqual(process.argv.slice(2, 3), ['--output']);
assert.ok(process.argv.length === 5 || process.argv.length === 7,
  'Use exactly --output ABS_FRESH --build-only, optionally followed by --source-parent LOWERCASE40SHA');
assert.equal(process.argv[4], '--build-only', 'Only offline build-only mode is supported');
assert.ok(isAbsolute(process.argv[3]), 'Output must be an absolute fresh directory');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = resolve(process.argv[3]);
const defaultParent = 'b803640306acf130aeb6274df8ae12d6cda6f8d8';
if (process.argv.length === 7) assert.equal(process.argv[5], '--source-parent');
const parent = process.argv.length === 7 ? process.argv[6] : defaultParent;
assert.match(parent, /^[0-9a-f]{40}$/, 'Source parent must be an exact lowercase40 hexadecimal commit');
const selectedCommit = execFileSync('git', ['rev-parse', '--verify', parent + '^{commit}'],
  { cwd: repo, encoding: 'utf8' }).trim();
assert.equal(selectedCommit, parent, 'Source parent must resolve locally to that exact commit');
execFileSync('git', ['merge-base', '--is-ancestor', parent, 'HEAD'], { cwd: repo });
const prefix = 'examples/gpu-scene/engine-uv-webgpu-proof';
const examples = [prefix + '-fixture.mjs', prefix + '-client.mjs', prefix + '.mjs', prefix + '.md'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const serialize = serializeEngineUVProofOriginals;
const fixture = createEngineUVProofFixture(0);
assert.equal(fixture.phase, 0);
assert.equal(fixture.authoredMaterials.length, 2);
assert.deepEqual(Object.keys(fixture).sort(), ['authoredMaterials', 'options', 'oracle', 'phase', 'scene', 'textureBindings']);
const repeated = createEngineUVProofFixture(0);
assert.equal(serialize(repeated), serialize(fixture), 'Pure original fixture must reproduce');
assert.notStrictEqual(repeated.scene, fixture.scene);
assert.notStrictEqual(repeated.textureBindings, fixture.textureBindings);
assert.notStrictEqual(repeated.authoredMaterials, fixture.authoredMaterials);

// Refuse existing output; every later write also refuses overwrite. A partial
// first failure is retained for Root rather than cleaned or silently repaired.
await mkdir(output, { recursive: false });
const gpuAlias = resolve(repo, 'packages/barocss-gpu/src/index.ts');
const cadAlias = resolve(repo, 'packages/barocss-cad/src/index.ts');
const bundled = await build({
  absWorkingDir: repo,
  entryPoints: [resolve(repo, prefix + '-client.mjs')],
  alias: { '@barocss/gpu': gpuAlias, '@barocss/cad': cadAlias },
  define: { __ENGINEUV_PROOF_SOURCE_PARENT__: JSON.stringify(parent) },
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022',
  outfile: resolve(output, 'client.mjs'), metafile: true, logLevel: 'silent',
});

const sourceInputs = [];
const repoReal = await realpath(repo);
for (const input of Object.keys(bundled.metafile.inputs).sort()) {
  const absolute = resolve(repo, input), bytes = await readFile(absolute);
  const marker = input.indexOf('packages/barocss-');
  const packagePath = marker < 0 ? null : input.slice(marker).replaceAll('\\', '/');
  assert.ok(!/(?:^|\/)node_modules\/(?:@barocss|barocss-)/.test(input), 'No shared package provider fallback: ' + input);
  if (packagePath !== null) {
    assert.ok(!/(?:^|\/)dist\//.test(packagePath), 'No emitted provider fallback: ' + input);
    assert.equal(relative(repo, absolute).replaceAll('\\', '/'), packagePath, 'Provider must resolve inside this checkout');
    const physical = await realpath(absolute);
    assert.ok(physical.startsWith(repoReal + sep), 'Provider cannot escape through a package source symlink');
    const pinned = execFileSync('git', ['show', parent + ':' + packagePath], { cwd: repo });
    assert.deepEqual(bytes, pinned, 'Unchanged actual package source bytes: ' + packagePath);
    sourceInputs.push({ path: packagePath, bytes: bytes.length, sha256: sha256(bytes) });
  } else {
    assert.ok(examples.includes(relative(repo, absolute).replaceAll('\\', '/')), 'Only selected examples and pinned package sources may be bundled: ' + input);
  }
}
assert.ok(sourceInputs.some(row => row.path === 'packages/barocss-gpu/src/index.ts'), 'Actual ordinary GPU root required');
assert.ok(sourceInputs.some(row => row.path === 'packages/barocss-cad/src/index.ts'), 'Actual selected local CAD root required');
const exampleInputs = [];
for (const path of examples) {
  const bytes = await readFile(resolve(repo, path));
  exampleInputs.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
}

const expectedFiles = ['index.html', 'client.mjs', 'manifest.json', 'oracle.json', 'original-scene.json',
  'original-texture-bindings.json', 'original-authored-materials.json', 'original.0.material.css', 'original.1.material.css'];
const html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BaroCSS Engine UV WebGPU proof</title></head><body><main id="proof-root"></main><script type="module" src="./client.mjs"></script></body></html>\n';
assert.ok(!/__INITIAL|__SOURCE|__MATERIAL/.test(html));
const write = (name, contents) => writeFile(resolve(output, name), contents, { flag: 'wx' });
await write('index.html', html);
const originalFiles = [
  ['original-scene.json', fixture.scene],
  ['original-texture-bindings.json', fixture.textureBindings],
  ['original-authored-materials.json', fixture.authoredMaterials],
  ['oracle.json', fixture.oracle],
];
for (const [name, original] of originalFiles) {
  const text = serialize(original) + '\n';
  await write(name, text);
  const reopened = await readFile(resolve(output, name), 'utf8');
  assert.equal(reopened, text);
  assert.equal(serialize(JSON.parse(reopened)), serialize(original), 'Full signed original reopened: ' + name);
}
for (let index = 0; index < fixture.authoredMaterials.length; index++) {
  const source = fixture.authoredMaterials[index].source;
  assert.equal(typeof source, 'string');
  await write('original.' + index + '.material.css', source);
  assert.equal(await readFile(resolve(output, 'original.' + index + '.material.css'), 'utf8'), source);
}
const files = [];
for (const name of expectedFiles.filter(name => name !== 'manifest.json')) {
  const bytes = await readFile(resolve(output, name));
  files.push({ path: name, bytes: bytes.length, sha256: sha256(bytes) });
}
const manifest = { parent, sourceInputs, exampleInputs, files, stage: 'PREPARED_ONLY', actualGPU: false };
await write('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
assert.deepEqual(JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8')), manifest);
assert.deepEqual((await readdir(output)).sort(), expectedFiles.sort(), 'Exact prepared asset whitelist');
for (const file of files) {
  const bytes = await readFile(resolve(output, file.path));
  assert.equal(bytes.length, file.bytes);
  assert.equal(sha256(bytes), file.sha256, 'Written asset hash retained: ' + file.path);
}
assert.equal(serialize(fixture), serialize(repeated), 'Preparation retains original fixture');
console.log(JSON.stringify({ parent, output, stage: manifest.stage, actualGPU: false,
  sourceInputs: sourceInputs.length, exampleInputs: exampleInputs.length, files: expectedFiles.length,
  manifestSHA256: sha256(await readFile(resolve(output, 'manifest.json'))) }));
