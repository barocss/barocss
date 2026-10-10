import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Use Node22');
const argument = process.argv.indexOf('--output');
assert.ok(argument >= 0 && process.argv[argument + 1], '--output EVIDENCE_DIR required');
const output = resolve(process.argv[argument + 1]), root = process.cwd();
const examples = resolve(root, 'packages/barocss-cad-interop/examples');
await mkdir(output, { recursive: true });
for (const name of ['cad', 'cad-interop']) {
  let exists = false;
  try { await access(resolve(root, `packages/barocss-${name}/dist`)); exists = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.equal(exists, false, 'Run source checkpoint before own library builds');
}

const consumer = String.raw`

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Scene, Mesh, SphereGeometry, MeshBasicMaterial, DoubleSide } from 'three';
import { compileCadModel, validateAxisBoxSolidBoolean, classifyAxisBoxSolidBooleanPoints,
  validateAxisBoxSolidBooleanPointClassification } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { CASE_KEYS, PINS, loadCase, proveCase, createNativeOptions, assertNative, assertBuffer }
  from './examples/axis-box-boolean-three-fixture.mjs';
import { createBooleanThreeHost } from './examples/axis-box-boolean-three-checkpoint.mjs';

const output = process.env.LOADER1114_EVIDENCE;
const data = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/axis-box-boolean-three-data');
const texts = new Map(), pins = [];
for (const pin of PINS) {
  const bytes = readFileSync(resolve(data, pin.file));
  assert.equal(bytes.length, pin.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256);
  texts.set(pin.file, bytes.toString('utf8')); pins.push({ ...pin });
}
assert.equal(pins.length, 175); assert.equal(pins.reduce((sum, pin) => sum + pin.bytes, 0), 5256300);
assert.equal(pins.filter(pin => pin.file.endsWith('.css')).length, 155);
assert.deepEqual(CASE_KEYS, ['union', 'cavity', 'through', 'sever', 'empty']);
const assets = new Map();
for (const key of CASE_KEYS) assets.set(key, await loadCase(key, file => texts.get(file)));
const panelCounts = [42, 60, 32, 12, 0], queryCounts = [8, 3, 4, 4, 4];
const originalQueries = [];
for (const [index, key] of CASE_KEYS.entries()) {
  const asset = assets.get(key), proof = proveCase(asset);
  assert.equal(proof.boolean.panels.length, panelCounts[index]);
  assert.equal(proof.classification.classifications.length, queryCounts[index]);
  assertNative(asset.request.boolean, asset.owned.boolean, 'Coherent request/owned whole Boolean');
  assertNative(asset.boolean, asset.owned.boolean, 'Separate saved full Boolean matches');
  validateAxisBoxSolidBoolean(asset.boolean);
  const actual = classifyAxisBoxSolidBooleanPoints(asset.request.boolean, asset.request.queries, asset.request.options);
  assertNative(actual, asset.owned, 'Public native original whole classifier output');
  validateAxisBoxSolidBooleanPointClassification(actual);
  for (const [position, source] of asset.operandSources.entries()) {
    const cold = compileCadModel(source, { sourceVersion: 0 });
    assert.equal(cold.ok, true); assert.equal(cold.model.version, 0); assert.equal(cold.model.objects.length, 7);
    assertNative(cold.model, asset.boolean.originalModels[position], 'Whole original operand including unshown geometry');
  }
  originalQueries.push({ key, queryCount: actual.classifications.length,
    queries: actual.queries, classifications: actual.classifications, report: actual.report });
}
assert.equal(originalQueries.reduce((sum, row) => sum + row.queryCount, 0), 23);
const scene = new Scene(), markerGeometry = new SphereGeometry(.00018, 8, 6),
  markerMaterial = new MeshBasicMaterial({ color: 0x00ff00 }), marker = new Mesh(markerGeometry, markerMaterial);
marker.position.set(.007, -.0005, .001); scene.add(marker);
const caller = { geometry: 0, material: 0 };
markerGeometry.addEventListener('dispose', () => caller.geometry++);
markerMaterial.addEventListener('dispose', () => caller.material++);
let callbacks = 0;
const host = createBooleanThreeHost({ scene, onChange(record) {
  callbacks++;
  assert.equal(host.accepted, record);
  for (const old of host.records) if (old !== record) {
    for (const result of old.results) assert.equal(result.group.parent, null, 'Prior result detached before callback');
    for (const resource of old.resources) {
      assert.equal(resource.geometryDisposals, 1); assert.equal(resource.materialDisposals, 1);
    }
  }
} });
const admitted = [];
function inspect(asset, state) {
  const record = host.accepted, parent = asset.boolean;
  assert.ok(record); assert.equal(record.assetKey, asset.key); assert.equal(record.state, state);
  assertNative(record.proof.boolean, parent, 'Complete owned Boolean retained');
  assertNative(record.proof.classification, asset.owned, 'Original whole query result retained');
  assert.equal(record.proof.operandModels.length, 2);
  assertNative(record.proof.operandModels, parent.originalModels, 'Both whole original operands retained');
  assert.equal(record.results.length, parent.panels.length); assert.equal(record.resources.length, parent.panels.length);
  assert.equal(record.proof.panelModels.length, parent.panels.length);
  assert.deepEqual(caller, { geometry: 0, material: 0 });
  const observed = { key: asset.key, state, wholeBooleanSHA256: createHash('sha256').update(JSON.stringify(record.proof.boolean)).digest('hex'),
    wholeClassificationSHA256: createHash('sha256').update(JSON.stringify(record.proof.classification)).digest('hex'),
    readout: structuredClone(record.readout), controls: structuredClone(record.proof.controls), panels: [] };
  if (!parent.panels.length) {
    assert.equal(record.root, null); assert.deepEqual(scene.children, [marker]);
    assert.ok(record.proof.classification.classifications.every(query => query.status === 'outside'));
    assert.equal(parent.report.quality.nativePanelFaceSubsetSolidFalse, true);
  } else {
    assert.equal(record.root.parent, scene); assert.deepEqual(scene.children, [marker, record.root]);
    assert.equal(record.root.children.length, parent.bodies.length);
    assert.equal(parent.report.quality.nativePanelFaceSubsetSolidFalse, true);
  }
  for (const [index, panel] of parent.panels.entries()) {
    const source = asset.panelSources.get(panel.id), result = record.results[index], resource = record.resources[index];
    assert.equal(result.source, source.source);
    const cold = compileCadModel(result.source, { sourceVersion: 0 });
    assert.equal(cold.ok, true); assert.equal(cold.model.version, 0); assert.equal(cold.model.objects.length, 5);
    assertNative(cold.model, panel.bundle.geometry, 'Cold full native panel Model');
    assertNative(result.model, cold.model, 'Actual public Three original Model');
    assertNative(record.proof.panelModels[index].model, cold.model, 'Saved proof full Model');
    assert.equal(result.surfaces.length, 1); assert.equal(result.curves.length, 0);
    const curves = result.model.objects.filter(object => object.kind === 'curve');
    assert.equal(curves.length, 4); assertNative(result.unrenderedCurveIds, curves.map(curve => curve.id), 'All original Curves retained unrendered');
    assert.equal(result.group.children.length, 1);
    const mesh = result.group.children[0], shell = parent.shells.find(item => item.panelIds.includes(panel.id));
    assert.ok(mesh instanceof Mesh); assert.equal(mesh, resource.object);
    assert.equal(result.group.parent.name, shell.id); assert.equal(result.group.parent.parent.name, shell.bodyId);
    assert.equal(mesh.parent, result.group); assert.equal(mesh.material.side, DoubleSide); assert.equal(mesh.material.isMeshNormalMaterial, true);
    for (const object of [mesh, result.group, result.group.parent, result.group.parent.parent, record.root]) {
      assertNative(object.position.toArray(), [0, 0, 0], 'Original display position');
      assertNative(object.quaternion.toArray(), [0, 0, 0, 1], 'Original display rotation');
      assertNative(object.scale.toArray(), [1, 1, 1], 'One units conversion only');
    }
    const neutral = parseBaroCadSource(result.source, createNativeOptions()).surfaces[0];
    assert.equal(mesh.name, neutral.surfaceId); assert.equal(mesh.geometry, resource.geometry); assert.equal(mesh.material, resource.material);
    assertBuffer(mesh.geometry.getAttribute('position').array, neutral.mesh.positions, 'Neutral/Three XYZ');
    assertBuffer(mesh.geometry.getAttribute('normal').array, neutral.mesh.normals, 'Neutral/Three normals');
    assertBuffer(mesh.geometry.getAttribute('_CAD_UV').array, neutral.mesh.parameters, 'Native UV retained separately');
    assertBuffer(mesh.geometry.getIndex().array, neutral.mesh.indices, 'Native panel derived indices');
    assert.equal(mesh.geometry.getAttribute('position').count, 4); assert.equal(mesh.geometry.getIndex().count, 6);
    assert.equal(resource.geometryDisposals, 0); assert.equal(resource.materialDisposals, 0);
    observed.panels.push({ panelId: panel.id, sourceId: panel.sourceId, shellId: shell.id, bodyId: shell.bodyId,
      source: result.source, model: structuredClone(result.model), positions: [...resource.positions],
      normals: [...resource.normals], parameters: [...resource.parameters], indices: [...resource.indices] });
  }
  admitted.push(observed); return observed;
}
host.load(assets.get('union')); inspect(assets.get('union'), 'original');
const accepted = host.accepted, beforeReadout = structuredClone(accepted.readout), beforeProof = structuredClone(accepted.proof);
const refused = host.runRefusals(assets.get('union'));
assert.equal(refused.refusals.length, 13); assert.equal(refused.getterCalls, 0); assert.equal(host.accepted, accepted);
assertNative(host.accepted.readout, beforeReadout, 'Readout retained');
assertNative(host.accepted.proof, beforeProof, 'Complete accepted native proof retained');
assert.equal(host.records.length, 1); assert.equal(host.allResources.length, 44);
assert.equal(host.counts.partialPairs, 2); assert.equal(host.counts.acceptedPairs, 42);
for (const resource of host.allResources.slice(42)) {
  assert.equal(resource.geometryDisposals, 1); assert.equal(resource.materialDisposals, 1);
}
host.load(assets.get('cavity')); const firstCavity = inspect(assets.get('cavity'), 'original');
assert.equal(firstCavity.controls.length, 1);
host.load(assets.get('through')); inspect(assets.get('through'), 'original');
host.load(assets.get('sever')); inspect(assets.get('sever'), 'original');
host.load(assets.get('empty')); inspect(assets.get('empty'), 'original');
host.coldReopen(assets.get('cavity')); const reopened = inspect(assets.get('cavity'), 'cold-reopen');
for (const field of ['wholeBooleanSHA256', 'wholeClassificationSHA256', 'readout', 'controls', 'panels'])
  assertNative(firstCavity[field], reopened[field], 'Complete cold cavity equality: ' + field);
assert.equal(host.records.length, 6); assert.equal(host.counts.collections, 6); assert.equal(host.counts.acceptedPairs, 206);
assert.equal(host.allResources.length, 208); assert.equal(host.counts.pairs, 208); assert.equal(host.peakLivePairs, 102);
assert.equal(new Set(host.allResources.map(row => row.geometry)).size, 208);
assert.equal(new Set(host.allResources.map(row => row.material)).size, 208);
host.dispose(); host.dispose();
assert.equal(host.accepted, null); assert.deepEqual(scene.children, [marker]); assert.deepEqual(caller, { geometry: 0, material: 0 });
assert.equal(callbacks, 7, 'Six real acceptances and one cleanup callback');
for (const resource of host.allResources) {
  assert.equal(resource.geometryDisposals, 1); assert.equal(resource.materialDisposals, 1);
  assertBuffer(resource.geometry.getAttribute('position').array, resource.positions, 'Actual CPU positions readable after disposal');
  assertBuffer(resource.geometry.getAttribute('normal').array, resource.normals, 'Actual CPU normals retained');
  assertBuffer(resource.geometry.getAttribute('_CAD_UV').array, resource.parameters, 'Actual CPU UV retained');
  assertBuffer(resource.geometry.getIndex().array, resource.indices, 'Actual CPU indices retained');
}
for (const record of host.records) {
  validateAxisBoxSolidBoolean(record.proof.boolean);
  validateAxisBoxSolidBooleanPointClassification(record.proof.classification);
  for (const result of record.results) {
    assert.equal(result.group.parent, null); assert.equal(result.model.objects.length, 5);
  }
}
const summary = { result: 'complete-axis-box-boolean-three-cpu-ok', pins, originalQueries, actualRefusals: refused.refusals,
  getterCalls: refused.getterCalls, counts: host.counts, admitted, caller, events: host.events,
  scope: 'Actual public source/file/complete Boolean and point authority/cold original Models7 and panels5/neutral/Three CPU/lifetime; HTTP/WebGL2 pixels remain separate' };
writeFileSync(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ result: summary.result, pins: 175, originalQueries: 23,
  refusals: summary.actualRefusals.length, counts: host.counts, caller }));
`;

const source = await build({ stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'),
  sourcefile: 'complete-axis-box-boolean-consumer.mjs' }, absWorkingDir: root, bundle: true, platform: 'node',
  format: 'esm', target: 'es2022', write: false, metafile: true });
const browser = await build({ entryPoints: [resolve(examples, 'axis-box-boolean-three.mjs')],
  absWorkingDir: root, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', write: false, metafile: true });
const config = await build({ entryPoints: [resolve(examples, 'axis-box-boolean-three.config.mjs')],
  absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', target: 'es2022',
  packages: 'external', write: false, metafile: true });
function graph(bundle) {
  const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(root, path));
  const own = inputs.filter(path => path.startsWith(resolve(root, 'packages') + '/'));
  assert.ok(!own.some(path => path.includes('/dist/')));
  const cad = own.filter(path => path.startsWith(resolve(root, 'packages/barocss-cad/src') + '/'));
  const interop = own.filter(path => path.startsWith(resolve(root, 'packages/barocss-cad-interop/src') + '/'));
  assert.ok(cad.length > 0 && interop.length > 0);
  assert.ok(!inputs.some(path => /node_modules\/(?:@babylonjs|pixi3d|pixi\.js)\//.test(path)));
  return { ownSource: cad.length + interop.length, cad: cad.length, interop: interop.length,
    ownDist: 0, foreignEngines: 0, sourceInputs: [...cad, ...interop].map(path => relative(root, path)) };
}
const sourceGraph = { node: process.version, source: graph(source), browser: graph(browser),
  affectedExampleBuilds: ['actual-source-node-consumer', 'actual-source-browser-entry', 'actual-vite-config'],
  aliases: false, customConditions: false, prebuild: false };
for (const [name, value] of [['source-graph', sourceGraph], ['source-metafile', source.metafile],
  ['browser-metafile', browser.metafile], ['config-metafile', config.metafile]])
  await writeFile(resolve(output, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const execution = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: source.outputFiles[0].text,
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LOADER1114_EVIDENCE: output } });
await writeFile(resolve(output, 'consumer.stdout'), execution.stdout ?? '');
await writeFile(resolve(output, 'consumer.stderr'), execution.stderr ?? '');
await writeFile(resolve(output, 'consumer.exit'), String(execution.status) + '\n');
process.stdout.write(JSON.stringify(sourceGraph) + '\n');
process.stdout.write(execution.stdout ?? ''); process.stderr.write(execution.stderr ?? '');
if (execution.error) throw execution.error;
assert.equal(execution.status, 0, 'Actual source/Three CPU checkpoint failed');
