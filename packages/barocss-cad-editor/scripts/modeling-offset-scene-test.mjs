// Structural replay of the retained real top-pocket packets. No CAD builders,
// native validator, new sample, browser, GPU submission or physical file action.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1724-offset-scene');
mkdirSync(output, { recursive: true });
assert.ok(process.env.CAD_MODEL_OFFSET_TRANSFER); assert.match(process.env.CAD_MODEL_OFFSET_TRANSFER_SHA256 ?? '', /^[a-f0-9]{64}$/);
const bytes = readFileSync(resolve(process.env.CAD_MODEL_OFFSET_TRANSFER));
const sha256 = value => createHash('sha256').update(value).digest('hex');
assert.equal(sha256(bytes), process.env.CAD_MODEL_OFFSET_TRANSFER_SHA256);
const baseline = JSON.parse(bytes), native = baseline.bodies.part.native;
assert.equal(native.report.operation, 'difference'); assert.equal(native.report.volumeMM3, 5632); assert.equal(native.panels.length, 46);
assert.equal(native.b.shell.origin[2], 4); assert.equal(baseline.preview.length, 46);
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const gpu = resolve(output, 'gpu-entry.ts');
writeFileSync(gpu, ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview'].map(n => `export * from ${JSON.stringify(resolve(root, 'packages/barocss-gpu/src/' + n + '.ts'))};`).join('\n'));
const entry = `export * from '${resolve(root, 'packages/barocss-cad-editor/src/modeling-union.ts')}';export * from '${resolve(root, 'packages/barocss-cad-editor/src/modeling-scene.ts')}';export {raycastEngineScene} from '${gpu}';`;
const built = await require('esbuild').build({ stdin: { contents: entry, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
  alias: { '@barocss/gpu': gpu }, plugins: [{ name: 'no-runtime-cad-import', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, () => { throw new Error('This replay must not import a runtime CAD provider'); });
  } }] });
writeFileSync(resolve(output, 'scene.mjs'), built.outputFiles[0].text);
writeFileSync(resolve(output, 'scene.meta.json'), JSON.stringify(built.metafile, null, 2));
const api = await import(pathToFileURL(resolve(output, 'scene.mjs')));
let packetReplays = 0;
const context = { documentId: 'offset_model', bodyId: native.bodies[0].id, documentRevision: '0', kernelResultRevision: '0', topologyRevision: '0', taskToken: 'offset_replay' };
const component = api.projectModelingUnion(native, 'part', context, (surface, options) => {
  const i = packetReplays++, retained = baseline.preview[i], panel = native.panels[i];
  assert.ok(retained && panel); assert.equal(retained.panelId, panel.id); assert.equal(retained.sourceId, panel.sourceId);
  assert.equal(retained.surfaceId, surface.id); assert.deepEqual(surface, panel.bundle.geometry.objects[0]);
  assert.deepEqual(options, retained.options); assert.deepEqual(options, { countU: 2, countV: 2, revision: 0 });
  return structuredClone(retained.result);
}, 'difference');
assert.equal(packetReplays, 46);
api.validateModelingUnion(component);
// The retained canonical JSON is the actual failing regression. Reconstruct only
// the three native report-record key orders for a second, value-identical control.
const runtimeOrder = structuredClone(component);
const nativeRecordOrders = {
  quality: ['restrictedCellModelEmbeddingCertified', 'restrictedBoundaryManifoldCertified', 'regularizedMaterialCertified', 'arbitraryCurvedSolidCertified', 'globalBinary64EvaluationErrorCertified', 'manufacturingToleranceCertified', 'nativePanelFaceSubsetSolidFalse', 'weldingPerformed', 'ownership'],
  numericPolicy: ['material', 'generatedZero', 'identity', 'source', 'lineageUV', 'volume', 'euler', 'pointComparisonMM', 'relativeDerivativeComparison'],
  incidence: ['allBoundaryTilesAccounted', 'internalFacesCancelled', 'everyEdgeTwoOppositeUses', 'orientedVertexLinksSingleCycles', 'cornerCount', 'edgeUseCount', 'panelEdgeEquation'],
};
for (const [name, keys] of Object.entries(nativeRecordOrders)) {
  const original = runtimeOrder.qualification[name];
  assert.deepEqual(Object.keys(original).sort(), [...keys].sort());
  runtimeOrder.qualification[name] = Object.fromEntries(keys.map(k => [k, original[k]]));
  assert.deepEqual(runtimeOrder.qualification[name], component.qualification[name]);
}
api.validateModelingUnion(runtimeOrder);
const reversedRecords = value => Array.isArray(value) ? value.map(reversedRecords)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reversedRecords(v)])) : value;
api.validateModelingUnion(reversedRecords(component));
let accessorReads = 0;
for (const name of Object.keys(nativeRecordOrders)) {
  const extra = structuredClone(component); extra.qualification[name].unknown = true;
  assert.throws(() => api.validateModelingUnion(extra), undefined, name + ' extra');
  const missing = structuredClone(component); delete missing.qualification[name][nativeRecordOrders[name][0]];
  assert.throws(() => api.validateModelingUnion(missing), undefined, name + ' missing');
  const symbol = structuredClone(component); symbol.qualification[name][Symbol('unknown')] = true;
  assert.throws(() => api.validateModelingUnion(symbol), undefined, name + ' symbol');
  const getter = structuredClone(component), key = nativeRecordOrders[name][0];
  Object.defineProperty(getter.qualification[name], key, { enumerable: true, get() { accessorReads++; return component.qualification[name][key]; } });
  assert.throws(() => api.validateModelingUnion(getter), undefined, name + ' accessor');
}
assert.equal(accessorReads, 0);
const packet = { profile: 'model-body-faces', documentId: context.documentId, revision: 0, taskToken: context.taskToken,
  components: [component], outcomes: [{ role: 'part', solidId: component.solidId, family: 'orthogonal-cell', status: 'solid' }] };
const packetBytes = Buffer.byteLength(JSON.stringify(packet)); assert.ok(packetBytes <= 2 * 1024 * 1024);
const scene = api.prepareModelingScene(packet, 1, 'part'), geometry = scene.scene.geometries[0];
assert.equal(geometry.positions.length, 184 * 3); assert.equal(geometry.indices.length, 92 * 3);
for (const [i, retained] of baseline.preview.entries()) {
  assert.deepEqual(component.mesh.chunks[i].positionsMM, retained.result.packet.positions);
  assert.deepEqual(component.mesh.chunks[i].parametersUV, retained.result.packet.parameters);
  for (let j = 0; j < 4; j++) {
    const p = retained.result.packet.positions.slice(j * 3, j * 3 + 3);
    assert.deepEqual(geometry.positions.slice((i * 4 + j) * 3, (i * 4 + j + 1) * 3), [p[0], p[2], -p[1]]);
  }
}
const ray = (x, y, z, dx, dy, dz) => ({ format: 'barocss-gpu-engine-ray', version: 0, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin: [x, y, z], direction: [dx, dy, dz], near: 0, far: 200 });
const top = api.raycastEngineScene(scene.scene, ray(16, 100, -12, 0, -1, 0));
assert.ok(top); assert.equal(top.point[1], 4); assert.deepEqual(top.normal, [0, 1, 0]);
const below = api.raycastEngineScene(scene.scene, ray(16, -10, -12, 0, 1, 0));
assert.ok(below); assert.equal(below.point[1], 0); assert.deepEqual(below.normal, [0, -1, 0]);
const mutations = [
  ['reordered mesh array', c => { c.mesh.chunks[0].indices.reverse(); }],
  ['altered quality value', c => { c.qualification.quality.weldingPerformed = true; }],
  ['origin-only Z', c => { c.lineage.operands[1].origin[2]++; }],
  ['support-only Z', c => { c.lineage.operands[1].faces[0].surface.controlPoints[0][0][2]++; }],
  ['grid-only Z', c => { c.lineage.grid.z[1]++; }],
  ['old-origin laundering', c => { c.lineage.operands[1].origin[2] = 0; }],
  ['UV correspondence', c => { c.lineage.panels[0].lineage[0].uvCorners[0][0].numerator = '1'; }],
  ['mesh-only Z', c => { c.mesh.chunks[0].positionsMM[2]++; }],
  ['occupancy-only', c => { c.lineage.cells[0].insideB = !c.lineage.cells[0].insideB; }],
  ['shell volume', c => { c.lineage.shells[0].signedVolumeMM3++; }],
];
for (const [name, mutate] of mutations) {
  const changed = structuredClone(packet); mutate(changed.components[0]);
  assert.throws(() => api.prepareModelingScene(changed, 1, 'part'), undefined, name);
}
assert.equal(packetReplays, 46); assert.equal(native.b.shell.origin[2], 4);
const result = { status: 'passed', transferSHA256: sha256(bytes), transferBytes: bytes.length, packetBytes, packetReplays,
  panelCount: 46, vertices: 184, triangles: 92, mutations: mutations.map(([name]) => name), nativeCalls: 0,
  recordOrderControls: { canonical: true, nativeSchemaOrder: true, recursivelyReversed: true, extraMissingSymbolAccessorRefusals: 12, accessorReads },
  scope: 'retained actual part packets, pure structural receiving correspondence and CPU raycast; part-only projection, no full editor/controller or physical GPU claim',
  adaptation: 'fresh request context; separately labeled native-schema key-order control copies values only; baseline stays canonical;  genuine retained packet XYZ/UV/normals/order/options, one existing receiving rotation',
  bundleSHA256: sha256(built.outputFiles[0].text) };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
