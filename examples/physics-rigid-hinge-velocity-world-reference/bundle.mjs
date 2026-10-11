import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const here = dirname(fileURLToPath(import.meta.url));
export const root = resolve(here, '../..');
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function verifyFreeze() {
  const bytes = await readFile(resolve(here, 'source-freeze.json'));
  const freeze = JSON.parse(bytes);
  assert.equal(freeze.node, process.version);
  for (const pin of freeze.sources) {
    const actual = await readFile(resolve(root, pin.path));
    assert.equal(actual.length, pin.bytes, 'source size drift: ' + pin.path);
    assert.equal(sha(actual), pin.sha256, 'source hash drift: ' + pin.path);
  }
  return {...freeze, sourceFreezeSha256: sha(bytes)};
}

export async function verifyEmitted() {
  const bytes = await readFile(resolve(here, 'emitted-ledger.json'));
  const ledger = JSON.parse(bytes);
  assert.equal(ledger.node, process.version);
  assert.equal(ledger.buildExitCode, 0);
  assert.equal(ledger.typesExitCode, 0);
  assert.ok(Array.isArray(ledger.emits) && ledger.emits.length > 0);
  for (const pin of ledger.emits) {
    const actual = await readFile(resolve(root, pin.path));
    assert.equal(actual.length, pin.bytes, 'emitted size drift: ' + pin.path);
    assert.equal(sha(actual), pin.sha256, 'emitted hash drift: ' + pin.path);
  }
  return {...ledger, emittedLedgerSha256: sha(bytes)};
}

export async function bundle(graph, outputDirectory) {
  await verifyFreeze();
  await verifyEmitted();
  assert.ok(['source', 'source-repeat', 'compiled-dependencies'].includes(graph));
  await mkdir(outputDirectory, {recursive: true});
  const emitted = {
    name: 'actual-physics-emitted-dependencies',
    setup(builder) {
      builder.onResolve({filter: /^\.\.\/\.\.\/packages\/barocss-physics\/src\//}, args => ({
        path: resolve(root, args.path.replace('../../packages/barocss-physics/src/',
          'packages/barocss-physics/dist/').replace(/\.ts$/, '.js')),
      }));
    },
  };
  const path = resolve(outputDirectory, graph + '.mjs');
  const result = await build({absWorkingDir: root, entryPoints: [resolve(here, 'harness-entry.mjs')],
    outfile: path, bundle: true, format: 'esm', platform: 'node', target: 'node22', metafile: true,
    plugins: graph === 'compiled-dependencies' ? [emitted] : []});
  const paths = Object.keys(result.metafile.inputs);
  const source = paths.filter(p => p.startsWith('packages/barocss-physics/src/'));
  const dist = paths.filter(p => p.startsWith('packages/barocss-physics/dist/'));
  assert.ok(graph === 'compiled-dependencies' ? source.length === 0 && dist.length > 0 : source.length > 0 && dist.length === 0);
  assert.ok(paths.includes('examples/physics-rigid-hinge-velocity-world-reference/candidate.ts'));
  assert.ok(paths.includes('examples/physics-rigid-hinge-velocity-reference/candidate.ts'));
  const inputs = await Promise.all(paths.map(async p => {
    const bytes = await readFile(resolve(root, p));
    return {path: p, bytes: bytes.length, sha256: sha(bytes)};
  }));
  const audit = {graph, originalSourceCount: source.length, originalDistCount: dist.length,
    privateWorldSource: true, adoptedProjectionSource: true, inputs, bundleSha256: sha(await readFile(path)),
    consumerHead: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim()};
  await writeFile(resolve(outputDirectory, graph + '-graph.json'), JSON.stringify({audit, metafile: result.metafile}, null, 2) + '\n');
  return {path, audit};
}
