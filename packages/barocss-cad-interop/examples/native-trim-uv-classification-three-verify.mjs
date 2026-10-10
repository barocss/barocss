import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Use Node 22');
const argument = process.argv.indexOf('--output');
assert.ok(argument >= 0 && process.argv[argument + 1], '--output EVIDENCE_DIR required');
const output = resolve(process.argv[argument + 1]), root = process.cwd();
const examples = resolve(root, 'packages/barocss-cad-interop/examples');
await mkdir(output, { recursive: true });
for (const name of ['cad', 'cad-interop']) {
  let exists = false;
  try { await access(resolve(root, `packages/barocss-${name}/dist`)); exists = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.equal(exists, false, 'Run this source gate before own library builds');
}

const consumer = String.raw`
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Scene, Mesh, SphereGeometry, MeshBasicMaterial, OrthographicCamera, Vector3, DoubleSide } from 'three';
import { compileCadModel } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { CASE_KEYS, PINS, loadCase, proveCase, createNativeOptions, assertNative, assertBuffer }
  from './examples/native-trim-uv-classification-three-fixture.mjs';
import { createTrimUVHost } from './examples/native-trim-uv-classification-three-checkpoint.mjs';

const output = process.env.LOADER1106_EVIDENCE;
const data = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/native-trim-uv-classification-three-data');
const texts = new Map(), pins = [];
for (const pin of PINS) {
  const bytes = readFileSync(resolve(data, pin.file));
  assert.equal(bytes.length, pin.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256);
  texts.set(pin.file, bytes.toString('utf8')); pins.push({ ...pin });
}
assert.equal(pins.length, 36);
assert.deepEqual(CASE_KEYS, ['dyadic_exact', 'primary_cap_sixteen', 'edited_source_rebuild']);
const assets = new Map();
for (const key of CASE_KEYS) assets.set(key, await loadCase(key, file => texts.get(file)));
const proofs = CASE_KEYS.map(key => proveCase(assets.get(key)));
assert.equal(proofs.reduce((sum, proof) => sum + proof.classification.classifications.length, 0), 9);
assert.ok(proofs[1].classification.classifications[0].faces.every(face => face.classification === 'uncertain'));
const controls = proofs.flatMap(proof => proof.controls);
assert.equal(controls.length, 2);
assert.deepEqual(controls.map(control => control.name), ['outside-chart', 'zero-subdivision']);

const scene = new Scene(), callerGeometry = new SphereGeometry(.00018, 8, 6),
  callerMaterial = new MeshBasicMaterial({ color: 0x00ff00 }), marker = new Mesh(callerGeometry, callerMaterial);
marker.position.set(.017, .004, .012); scene.add(marker);
const caller = { geometry: 0, material: 0 };
callerGeometry.addEventListener('dispose', () => caller.geometry++);
callerMaterial.addEventListener('dispose', () => caller.material++);
const camera = new OrthographicCamera(-.015, .015, .010666666666666666, -.010666666666666666, .0001, 1);
camera.position.set(.025, .026, .04); camera.up.set(0, 1, 0); camera.lookAt(.005, .005, .011); camera.updateMatrixWorld(true);
let callbacks = 0;
const host = createTrimUVHost({ scene, onChange(record) {
  callbacks++;
  assert.equal(host.accepted, record);
  for (const old of host.records) if (old !== record) {
    assert.equal(old.result.group.parent, null);
    for (const resource of old.resources) {
      assert.equal(resource.geometryDisposals, 1); assert.equal(resource.materialDisposals, 1);
    }
  }
} });
const admitted = [];
function inspect(asset, state) {
  const record = host.accepted, proof = proveCase(asset);
  assert.ok(record); assert.equal(record.assetKey, asset.key); assert.equal(record.state, state);
  assert.equal(record.source, asset.source); assert.equal(record.result.source, asset.source);
  assertNative(record.model, proof.model, 'Complete original native Model');
  assertNative(record.proof.classification, asset.owned, 'Whole classification matches saved proof');
  assertNative(record.proof.controls, proof.controls, 'Extra native success controls');
  const cold = compileCadModel(record.source, { sourceVersion: 0 });
  assert.equal(cold.ok, true); assertNative(cold.model, record.model, 'Cold complete world Model');
  assert.equal(record.model.version, 0); assert.equal(record.model.objects.length, 8);
  assert.equal(record.model.lengthUnit, 'mm');
  const curves = record.model.objects.filter(object => object.kind === 'curve');
  assert.equal(curves.length, 7);
  assertNative(record.result.unrenderedCurveIds, curves.map(curve => curve.id), 'Seven retained native Curves');
  if (asset.key !== 'dyadic_exact') assert.equal(curves.find(curve => curve.id.endsWith('_cut')).degree, 4);
  assert.equal(record.result.curves.length, 0); assert.equal(record.resources.length, 1);
  assert.equal(record.result.group.parent, scene); assert.equal(record.result.group.children.length, 1);
  assert.deepEqual(scene.children, [marker, record.result.group]);
  assert.equal(record.proof.trim.vertices.length, 6); assert.equal(record.proof.trim.edges.length, 7);
  assert.equal(record.proof.trim.loops.length, 2); assert.equal(record.proof.trim.faces.length, 2);
  assert.equal(record.proof.classification.report.quality.worldProjectionPerformed, false);
  assert.equal(record.proof.classification.report.quality.idealPlaneSideCertified, false);
  assert.equal(record.proof.classification.report.quality.solid, false);
  const neutral = parseBaroCadSource(asset.source, createNativeOptions()), resource = record.resources[0];
  const mesh = resource.object, surface = neutral.surfaces[0];
  assert.ok(mesh instanceof Mesh); assert.equal(mesh.name, record.proof.trim.report.surfaceId);
  assert.equal(mesh.geometry, resource.geometry); assert.equal(mesh.material, resource.material);
  assert.equal(mesh.material.isMeshNormalMaterial, true); assert.equal(mesh.material.side, DoubleSide);
  assertNative(mesh.position.toArray(), [0, 0, 0], 'Original display pose');
  assertNative(mesh.quaternion.toArray(), [0, 0, 0, 1], 'Original display orientation');
  assertNative(mesh.scale.toArray(), [1, 1, 1], 'One mm scale only');
  assertBuffer(mesh.geometry.getAttribute('position').array, surface.mesh.positions, 'Position buffer');
  assertBuffer(mesh.geometry.getAttribute('normal').array, surface.mesh.normals, 'Normal buffer');
  assertBuffer(mesh.geometry.getAttribute('_CAD_UV').array, surface.mesh.parameters, 'Original native UV buffer');
  assertBuffer(mesh.geometry.getIndex().array, surface.mesh.indices, 'Index buffer');
  assert.equal(mesh.geometry.getAttribute('position').count, 64); assert.equal(mesh.geometry.getIndex().count, 294);
  assert.equal(resource.geometryDisposals, 0); assert.equal(resource.materialDisposals, 0);
  scene.updateMatrixWorld(true);
  for (let index = 0; index < 64; index++) {
    const projected = new Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), index).project(camera);
    assert.ok(Math.abs(projected.x) < .95 && Math.abs(projected.y) < .95 && Math.abs(projected.z) < 1, 'Camera clips Support Surface');
  }
  assert.deepEqual(caller, { geometry: 0, material: 0 });
  const observed = { key: record.assetKey, state, source: record.source, model: structuredClone(record.model),
    classification: structuredClone(record.proof.classification), controls: structuredClone(record.proof.controls),
    readout: structuredClone(record.readout), unrenderedCurveIds: [...record.result.unrenderedCurveIds],
    positions: Array.from(resource.positions), normals: Array.from(resource.normals),
    parameters: Array.from(resource.parameters), indices: Array.from(resource.indices) };
  admitted.push(observed); return observed;
}
const dyadic = assets.get('dyadic_exact');
host.load(dyadic); inspect(dyadic, 'original');
const savedRecord = host.accepted, savedReadout = structuredClone(savedRecord.readout);
const refused = host.runRefusals(dyadic);
assert.equal(refused.refusals.length, 12); assert.equal(refused.getterCalls, 0);
assert.equal(refused.acceptedRetained, true); assert.equal(host.accepted, savedRecord);
assertNative(host.accepted.readout, savedReadout, 'Accepted readout retained through refusals');
assert.equal(host.records.length, 1); assert.equal(host.allResources.length, 1);
host.load(assets.get('primary_cap_sixteen')); inspect(assets.get('primary_cap_sixteen'), 'original');
const edited = assets.get('edited_source_rebuild');
host.load(edited); const beforeReopen = inspect(edited, 'original');
host.coldReopen(); const reopened = inspect(edited, 'cold-reopen');
for (const key of ['source', 'model', 'classification', 'controls', 'readout', 'positions', 'normals', 'parameters', 'indices'])
  assertNative(beforeReopen[key], reopened[key], 'Cold original edited equality: ' + key);
assert.equal(host.records.length, 4); assert.equal(host.allResources.length, 4);
assert.equal(new Set(host.allResources.map(row => row.geometry)).size, 4);
assert.equal(new Set(host.allResources.map(row => row.material)).size, 4);
assert.equal(host.peakLivePairs, 2, 'Detached candidate and prior peak resource budget');
host.dispose(); host.dispose();
assert.equal(host.accepted, null); assert.deepEqual(scene.children, [marker]);
assert.deepEqual(caller, { geometry: 0, material: 0 });
assert.equal(callbacks, 5, 'Four admissions and one real cleanup callback');
for (const record of host.records) {
  assert.equal(record.result.group.parent, null); assert.equal(record.model.objects.length, 8);
  assert.equal(record.proof.trim.world.source, record.source); assert.ok(record.proof.classification.classifications.length > 0);
  for (const resource of record.resources) {
    assert.equal(resource.geometryDisposals, 1); assert.equal(resource.materialDisposals, 1);
    assert.equal(resource.positions.length, 192); assert.ok(Array.from(resource.positions).every(Number.isFinite));
  }
}
const summary = { result: 'stored-trim-uv-original-three-cpu-ok', pins, nativeQueries: 9,
  successControls: controls, admittedResults: 4, actualGeometryMaterialPairs: 4,
  peakLivePairs: host.peakLivePairs, actualRefusals: 12, getterCalls: 0, caller, admitted, refused, events: host.events,
  scope: 'Actual public source/file/whole UV classification/cold parents and Models/neutral/Three CPU and ownership; HTTP/WebGL2 pixels are separate' };
writeFileSync(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ result: summary.result, pins: 36, nativeQueries: 9, successControls: controls.length,
  admittedResults: 4, actualGeometryMaterialPairs: 4, actualRefusals: 12, getterCalls: 0, caller }));
`;

const source = await build({ stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'),
  sourcefile: 'stored-trim-uv-consumer.mjs' }, absWorkingDir: root, bundle: true, platform: 'node',
  format: 'esm', target: 'es2022', write: false, metafile: true });
const browser = await build({ entryPoints: [resolve(examples, 'native-trim-uv-classification-three.mjs')],
  absWorkingDir: root, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', write: false, metafile: true });
const config = await build({ entryPoints: [resolve(examples, 'native-trim-uv-classification-three.config.mjs')],
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
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LOADER1106_EVIDENCE: output } });
await writeFile(resolve(output, 'consumer.stdout'), execution.stdout ?? '');
await writeFile(resolve(output, 'consumer.stderr'), execution.stderr ?? '');
await writeFile(resolve(output, 'consumer.exit'), String(execution.status) + '\n');
process.stdout.write(JSON.stringify(sourceGraph) + '\n');
process.stdout.write(execution.stdout ?? ''); process.stderr.write(execution.stderr ?? '');
if (execution.error) throw execution.error;
assert.equal(execution.status, 0, 'Actual source/Three CPU checkpoint failed');
