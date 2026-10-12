// One bounded real public-engine consumer flow. No GPU or native OS file claims.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { Session } from 'node:inspector';
const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-editor-prism-native'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({ stdin: { contents: `export * from '${resolve(root, 'packages/barocss-cad-editor/src/prism-feature-engine.ts')}'; export * from '${resolve(root, 'packages/barocss-cad-editor/src/prism-feature-scene.ts')}';`, resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
  alias: { '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src/index.ts') } });
assert.ok(Object.keys(bundle.metafile.inputs).every(path => !path.includes('/dist/')));
writeFileSync(resolve(output, 'engine.mjs'), bundle.outputFiles[0].text);
writeFileSync(resolve(output, 'inputs.json'), JSON.stringify(bundle.metafile, null, 2));
const { createPrismFeatureEngine, preparePrismFeatureScene } = await import(pathToFileURL(resolve(output, 'engine.mjs')));
const profiler = new Session(); profiler.connect();
const post = method => new Promise((resolve, reject) => profiler.post(method, (error, value) => error ? reject(error) : resolve(value)));
await post('Profiler.enable');
await new Promise((resolve, reject) => profiler.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true }, error => error ? reject(error) : resolve()));
const engine = createPrismFeatureEngine(), fixture = readFileSync(resolve(root, 'apps/cad-editor/src/fixtures/affine-prism.authored.json'), 'utf8');
const success = reply => { assert.equal(reply.ok, true, reply.message); return reply; };
const volume = reply => Number(reply.summary.volumes.remaining.numerator) / Number(reply.summary.volumes.remaining.denominator);
const start = success(engine({ id: 1, kind: 'open', text: fixture })); assert.equal(volume(start), 5120);
const edited = success(engine({ id: 2, kind: 'apply', expectedRevision: 0, edits: [{ parameterId: 'upperX', valueMM: 24 }] }));
assert.equal(volume(edited), 3328); assert.equal(edited.summary.document.revision, 1);
assert.equal(edited.summary.selectedWalls[0].sourceRevision, 1);
assert.equal(JSON.parse(edited.text).format, 'barocss-xy-affine-prism-feature-document');
assert.ok(!edited.text.includes('certificate') && !edited.text.includes('volumeMM3'));
writeFileSync(resolve(output, 'authored.json'), edited.text);
const fresh = createPrismFeatureEngine(), reopened = success(fresh({ id: 3, kind: 'open', text: edited.text }));
assert.deepEqual(reopened.summary, edited.summary); assert.equal(reopened.text, edited.text);
const second = success(fresh({ id: 4, kind: 'apply', expectedRevision: 1, edits: [{ parameterId: 'upperX', valueMM: 16 }] }));
assert.equal(volume(second), 5120); assert.equal(second.summary.document.revision, 2);
// Strict codec rejection is pre-native and must retain the last accepted model.
const refused = fresh({ id: 5, kind: 'open', text: '{"version":0,"version":0}' }); assert.equal(refused.ok, false);
for (const reply of [start, edited, reopened, second]) {
  assert.equal(reply.display.documentId, reply.summary.document.id); assert.equal(reply.display.revision, reply.summary.document.revision);
  assert.deepEqual(reply.display.outcomes, reply.summary.components);
  const source = reply.display.components.find(c => c.role === 'source');
  const sketch = reply.summary.document.nodes[0];
  assert.equal(source.lineage.sourceId, sketch.sourceId); assert.equal(source.lineage.sketchId, sketch.document.id);
  assert.equal(source.lineage.sourceRevision, sketch.revision); assert.equal(source.lineage.segments.length + 2, source.mesh.faces.length);
  const scenes = ['source', 'result'].map(view => preparePrismFeatureScene(reply.display, view));
  assert.equal(scenes[0].scene.geometries.length, 1); assert.equal(scenes[1].scene.geometries.length, 2);
  for (const component of reply.display.components.filter(c => c.role !== 'source')) {
    assert.equal(component.report.solidId, reply.summary.components.find(c => c.role === component.role).solidId);
    assert.equal(component.lineage.faces.length, component.mesh.faces.length);
    for (const face of component.mesh.faces) assert.ok(component.lineage.faces.some(f => f.output.sourceId === face.sourceId && f.output.faceId === face.faceId));
  }
}
assert.deepEqual(reopened.display, edited.display);
writeFileSync(resolve(output, 'display-packets.json'), JSON.stringify([start.display, edited.display, second.display]));
const ownedPacket = preparePrismFeatureScene(start.display, 'result');
ownedPacket.packet.components[0].lineage.sourceId = 'mutation'; assert.notEqual(start.display.components[0].lineage.sourceId, 'mutation');
const coverage = await post('Profiler.takePreciseCoverage'); await post('Profiler.stopPreciseCoverage'); profiler.disconnect();
const names = ['tessellateConvexPlanarSolid', 'parseXYAffinePrismFeatureDocument', 'updateXYAffinePrismFeatureDocument', 'serializeXYAffinePrismFeatureDocument', 'compileCadModel', 'buildConvexPlanarFace', 'evaluateCurveD1', 'evaluateSurfaceD1'];
const counts = Object.fromEntries(names.map(name => [name, coverage.result.flatMap(script => script.functions.filter(f => f.functionName === name)).reduce((n, f) => n + f.ranges[0].count, 0)]));
assert.equal(counts.parseXYAffinePrismFeatureDocument, 3); assert.equal(counts.updateXYAffinePrismFeatureDocument, 2); assert.equal(counts.serializeXYAffinePrismFeatureDocument, 4);
// 2 opens × (parse+serialize), 2 edits × (prior+candidate+serialize): at most10 cold-equivalent phases.
assert.equal(counts.tessellateConvexPlanarSolid, 12);
assert.ok(counts.compileCadModel <= 10 * 158 + 12 * 12); assert.ok(counts.buildConvexPlanarFace <= 10 * 152 + 12 * 12);
assert.ok(counts.evaluateCurveD1 + counts.evaluateSurfaceD1 <= 10 * 6912 + 12 * 576);
const result = { ok: true, volumes: [volume(start), volume(edited), volume(second)], counts,
  sourceHash: createHash('sha256').update(bundle.outputFiles[0].text).digest('hex'), authoredHash: createHash('sha256').update(edited.text).digest('hex'),
  evidence: 'real public native engine/codec in worker runtime consumer; no GPU or OS file acceptance' };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
