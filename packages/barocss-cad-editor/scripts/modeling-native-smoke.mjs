// Explicit bounded native-to-CPU campaign. Run source then cold as separate processes.
// node --no-opt --max-old-space-size=2048 scripts/modeling-native-smoke.mjs source|cold EVIDENCE_DIR
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), mode = process.argv[2], output = resolve(process.argv[3] ?? '/tmp/cad-modeling-native');
assert.ok(['source', 'cold'].includes(mode)); mkdirSync(output, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const signedJSON = value => JSON.stringify(value, (_key, v) => Object.is(v, -0) ? '__negative_zero__' : v).replaceAll('"__negative_zero__"', '-0');
if (mode === 'source') {
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
  const bundle = await require('esbuild').build({ stdin: { contents: `export * from '${resolve(root, 'packages/barocss-cad-editor/src/modeling-engine.ts')}'; export * from '${resolve(root, 'packages/barocss-cad-editor/src/prism-feature-scene.ts')}';`, resolveDir: root },
    bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
    alias: { '@barocss/cad': resolve(root, 'packages/barocss-cad/src/index.ts'), '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts') } });
  assert.ok(Object.keys(bundle.metafile.inputs).every(path => !path.includes('/dist/')));
  writeFileSync(resolve(output, 'engine.mjs'), bundle.outputFiles[0].text);
  writeFileSync(resolve(output, 'source-provenance.json'), JSON.stringify({ bundleSHA256: sha(bundle.outputFiles[0].text),
    inputs: Object.keys(bundle.metafile.inputs).filter(path => path !== '<stdin>').map(path => ({ path, sha256: sha(readFileSync(resolve(root, path))) })) }, null, 2));
}
const provenance = JSON.parse(readFileSync(resolve(output, 'source-provenance.json'), 'utf8'));
assert.equal(sha(readFileSync(resolve(output, 'engine.mjs'))), provenance.bundleSHA256);
const { createModelingEngine, preparePrismFeatureScene, pickPrismFeatureScene } = await import(pathToFileURL(resolve(output, 'engine.mjs')));
const run = createModelingEngine(), observed = []; let id = 0;
const volume = (r, name) => r.summary.outputs.find(o => o.name === name).volumeMM3;
function accept(reply, part, other) {
  observed.push(reply); writeFileSync(resolve(output, `${mode}-observed.json`), signedJSON(observed));
  assert.equal(reply.ok, true, reply.message);
  assert.deepEqual(volume(reply, 'part'), { numerator: String(part), denominator: '1' });
  assert.deepEqual(volume(reply, 'other'), { numerator: String(other), denominator: '1' });
  assert.deepEqual(reply.summary.outputs.map(o => o.name).sort(), ['other', 'part']);
  assert.equal(reply.display.components.length, 2);
  const scene = preparePrismFeatureScene(reply.display, 'result'); assert.equal(scene.scene.geometries.length, 2);
  const found = new Set();
  for (let y = 2; y < 192 && found.size < 2; y += 4) for (let x = 2; x < 192 && found.size < 2; x += 4) {
    const hit = pickPrismFeatureScene(scene, 192, 192, x, y); if (!hit) continue;
    found.add(hit.role); assert.equal(hit.solidId, reply.summary.outputs.find(o => o.name === hit.role).solidId);
    assert.equal(hit.revision, reply.summary.revision); assert.equal(hit.lineage.kind, 'model-output');
  }
  assert.deepEqual([...found].sort(), ['other', 'part']); return reply;
}
try {
  let first, second;
  if (mode === 'source') {
    first = accept(run({ id: ++id, kind: 'example' }), 3064, 2048);
    second = accept(run({ id: ++id, kind: 'apply', expectedRevision: first.summary.revision, parameters: { height: 6, rearX: 20 } }), 2488, 1536);
    writeFileSync(resolve(output, 'edited.cad.json'), second.text);
  } else {
    first = accept(run({ id: ++id, kind: 'open', text: readFileSync(resolve(output, 'edited.cad.json'), 'utf8') }), 2488, 1536);
    assert.equal(first.text, readFileSync(resolve(output, 'edited.cad.json'), 'utf8'));
    second = accept(run({ id: ++id, kind: 'apply', expectedRevision: first.summary.revision, parameters: { setback: 2 } }), 2464, 1536);
    writeFileSync(resolve(output, 'reedited.cad.json'), second.text);
  }
  const result = { ok: true, mode, nativeModelEvaluations: 2, nativeMeshEvaluations: 4, namedOutputs: ['part', 'other'],
    volumes: observed.map(r => Object.fromEntries(r.summary.outputs.map(o => [o.name, o.volumeMM3]))),
    bundleSHA256: provenance.bundleSHA256, authoredSHA256: sha(second.text),
    evidence: 'real public modeling API -> worker adapter -> native tessellation -> CPU scene/raycast; no browser/GPU pixels or OS file dialog' };
  writeFileSync(resolve(output, `${mode}-result.json`), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} catch (cause) { writeFileSync(resolve(output, `${mode}-first-failure.txt`), cause.stack ?? String(cause)); throw cause; }
