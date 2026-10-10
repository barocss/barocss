import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Use Node 22');
const argument = process.argv.indexOf('--output');
assert.ok(argument >= 0 && process.argv[argument + 1], '--output EVIDENCE_DIR is required');
const output = resolve(process.argv[argument + 1]), root = process.cwd();
const examples = resolve(root, 'packages/barocss-cad-interop/examples');
await mkdir(output, { recursive: true });
for (const name of ['cad', 'cad-interop']) {
  let exists = false;
  try { await access(resolve(root, `packages/barocss-${name}/dist`)); exists = true; } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  assert.equal(exists, false, 'This source checkpoint must precede own library builds');
}

const consumer = String.raw`
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Scene, Mesh, SphereGeometry, MeshBasicMaterial, OrthographicCamera, Vector3, DoubleSide } from 'three';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { compileCadModel, evaluateSurface, surfaceDomain } from '@barocss/cad';
import { CASE_KEYS, PINS, loadCase, proveCase, createNativeOptions, assertNative, assertBuffer } from './examples/source-surface-control-net-three-fixture.mjs';
import { createSourceEditHost } from './examples/source-surface-control-net-three-checkpoint.mjs';

const output = process.env.LOADER1094_EVIDENCE;
const data = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/source-surface-control-net-three-data');
const texts = new Map(), pins = [];
for (const pin of PINS) {
  const bytes = readFileSync(resolve(data, pin.file));
  assert.equal(bytes.length, pin.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256);
  texts.set(pin.file, bytes.toString('utf8')); pins.push({ ...pin });
}
assert.equal(pins.length, 25);
const assets = new Map();
for (const key of CASE_KEYS) assets.set(key, await loadCase(key, file => texts.get(file)));
const proofs = CASE_KEYS.map(key => proveCase(assets.get(key)));
assert.equal(proofs.reduce((sum, proof) => sum + proof.observations.length, 0), 45);
assert.ok(proofs.every(proof => proof.maximumIndependentDifference <= 1e-10));
assert.equal(assets.get('cold_candidate_reedit').originalSource, assets.get('mixed_weighted').candidateSource);

const scene = new Scene(), callerGeometry = new SphereGeometry(.00018, 8, 6),
  callerMaterial = new MeshBasicMaterial({ color: 0x00ff00 }), marker = new Mesh(callerGeometry, callerMaterial);
marker.position.set(.016, .003, .002); scene.add(marker);
const caller = { geometry: 0, material: 0 };
callerGeometry.addEventListener('dispose', () => caller.geometry++);
callerMaterial.addEventListener('dispose', () => caller.material++);
const camera = new OrthographicCamera(-.0225, .0225, .01575, -.01575, .0001, 1);
camera.position.set(.032, .037, .045); camera.up.set(0, 1, 0); camera.lookAt(.004, .014, .002); camera.updateMatrixWorld(true);
const host = createSourceEditHost({ scene });
const admitted = [], points = [];
function inspect(source, model, selectedId) {
  const record = host.accepted;
  assert.ok(record); assert.equal(record.source, source); assert.equal(record.result.source, source);
  assertNative(record.model, model, 'Complete native Model binding');
  const cold = compileCadModel(source, { sourceVersion: 0 });
  assert.equal(cold.ok, true); assertNative(cold.model, record.model, 'Cold full native Model');
  assert.equal(record.model.version, 0); assert.equal(record.model.lengthUnit, 'mm');
  assert.equal(record.result.group.parent, scene);
  assert.equal(record.result.curves.length, 0);
  const expectedCurves = model.objects.filter(object => object.kind === 'curve');
  assertNative(record.result.unrenderedCurveIds, expectedCurves.map(curve => curve.id), 'Unrendered original Curve identity');
  if (model.objects.length === 4) assert.equal(expectedCurves.find(curve => curve.id === 'degree_five_sibling').degree, 5);
  const neutral = parseBaroCadSource(source, createNativeOptions());
  assert.equal(record.resources.length, neutral.surfaces.length);
  assert.equal(record.result.group.children.length, neutral.surfaces.length);
  const members = [];
  scene.updateMatrixWorld(true);
  for (const row of record.resources) {
    const object = row.object, preview = neutral.surfaces.find(surface => surface.surfaceId === row.surfaceId);
    assert.ok(object.isMesh && preview); assert.equal(object.name, row.surfaceId);
    assert.equal(object.geometry, row.geometry); assert.equal(object.material, row.material);
    assert.equal(object.material.isMeshNormalMaterial, true); assert.equal(object.material.side, DoubleSide);
    assert.equal(object.geometry.getAttribute('position').count, 64); assert.equal(object.geometry.getIndex().count, 294);
    assertBuffer(object.geometry.getAttribute('position').array, preview.mesh.positions, 'Actual positions');
    assertBuffer(object.geometry.getAttribute('normal').array, preview.mesh.normals, 'Actual normals');
    assertBuffer(object.geometry.getAttribute('_CAD_UV').array, preview.mesh.parameters, 'Actual native U/V');
    assertBuffer(object.geometry.getIndex().array, preview.mesh.indices, 'Actual indices');
    assertNative(object.position.toArray(), [0, 0, 0], 'No display pose');
    assertNative(object.scale.toArray(), [1, 1, 1], 'No second scale');
    assert.equal(row.geometryDisposals, 0); assert.equal(row.materialDisposals, 0);
    const position = object.geometry.getAttribute('position');
    for (let index = 0; index < position.count; index++) {
      const projected = new Vector3().fromBufferAttribute(position, index).project(camera);
      assert.ok(Math.abs(projected.x) < .95 && Math.abs(projected.y) < .95 && Math.abs(projected.z) < 1, 'Fixed camera clips original Surface');
    }
    members.push({ surfaceId: row.surfaceId, positions: Array.from(row.positions), normals: Array.from(row.normals),
      parameters: Array.from(row.parameters), indices: Array.from(row.indices) });
  }
  for (const previous of host.records) if (previous !== record) {
    assert.equal(previous.result.group.parent, null);
    for (const resource of previous.resources) {
      assert.equal(resource.geometryDisposals, 1); assert.equal(resource.materialDisposals, 1);
    }
  }
  assert.deepEqual(scene.children, [marker, record.result.group], 'Only caller and accepted display');
  const selected = model.objects.find(object => object.id === selectedId), domain = surfaceDomain(selected);
  const pointMM = evaluateSurface(selected, (domain.u[0] + domain.u[1]) / 2, (domain.v[0] + domain.v[1]) / 2);
  points.push({ key: record.assetKey, state: record.state, pointMM });
  admitted.push({ key: record.assetKey, state: record.state, source, model: structuredClone(model),
    unrenderedCurveIds: [...record.result.unrenderedCurveIds], members });
  assert.deepEqual(caller, { geometry: 0, material: 0 });
  return { record, members, pointMM };
}
for (const [index, key] of CASE_KEYS.entries()) {
  const asset = assets.get(key), proof = proofs[index];
  host.loadOriginal(asset);
  const original = inspect(asset.originalSource, proof.originalModel, asset.request.surfaceId);
  if (key === 'mixed_weighted') {
    const before = host.accepted, children = [...scene.children], count = host.records.length;
    const refusals = host.runRefusals(asset);
    assert.equal(refusals.refusals.length, 16); assert.equal(refusals.getterCalls, 0);
    assert.equal(host.accepted, before); assert.equal(host.records.length, count);
    assert.deepEqual(scene.children, children);
    writeFileSync(resolve(output, 'actual-refusals.json'), JSON.stringify(refusals, null, 2));
  }
  host.applyEdit(asset);
  const candidate = inspect(asset.candidateSource, proof.model, asset.request.surfaceId);
  for (const before of original.members) if (before.surfaceId !== asset.request.surfaceId || ['signed_zero_only', 'no_op_original_spelling'].includes(key)) {
    assertNative(candidate.members.find(member => member.surfaceId === before.surfaceId), before, 'Unchanged sibling/display buffers');
  }
  if (key === 'mixed_weighted') {
    assertNative(original.pointMM, [4.523809523809524, 5.714285714285714, 2.7142857142857144], 'Original mixed center');
    assertNative(candidate.pointMM, [4.851063829787234, 5.25531914893617, 4.957446808510638], 'Candidate mixed center');
    const accepted = host.accepted;
    host.coldReopen(); inspect(asset.candidateSource, proof.model, asset.request.surfaceId);
    assert.notEqual(host.accepted, accepted); assert.equal(accepted.result.group.parent, null);
  }
  if (key === 'maximum_64_scalar_patches') {
    assertNative(original.pointMM, [1.5, 1.5, 3], 'Original maximum center');
    assertNative(candidate.pointMM, [1.75, 2, 3.75], 'Candidate maximum center');
  }
  if (key === 'cold_candidate_reedit') assert.equal(candidate.pointMM[2], 5.723404255319149);
}
assert.equal(host.records.length, 11);
assert.equal(host.records.reduce((sum, record) => sum + record.resources.length, 0), 20);
assert.equal(new Set(host.records.flatMap(record => record.resources.map(row => row.geometry))).size, 20);
assert.equal(new Set(host.records.flatMap(record => record.resources.map(row => row.material))).size, 20);
host.dispose(); host.dispose();
assert.equal(host.accepted, null); assert.deepEqual(scene.children, [marker]);
assert.deepEqual(caller, { geometry: 0, material: 0 });
for (const record of host.records) {
  assert.equal(record.result.group.parent, null); assert.ok(record.model.objects.length > 0);
  for (const resource of record.resources) {
    assert.equal(resource.geometryDisposals, 1); assert.equal(resource.materialDisposals, 1);
    assert.equal(resource.positions.length, 192); assert.ok(Array.from(resource.positions).every(Number.isFinite));
  }
}
const summary = { result: 'complete-source-surface-edit-three-cpu-ok', pins, actualFamilies: CASE_KEYS,
  admittedResults: host.records.length, actualGeometryMaterialPairs: 20, geometryDisposals: 20, materialDisposals: 20,
  actualRefusals: 16, getterCalls: 0, caller, nativeObservationSites: 45,
  maximumIndependentDifference: Math.max(...proofs.map(proof => proof.maximumIndependentDifference)),
  points, admitted, observations: host.observations(), events: host.events,
  scope: 'actual public source/file/full-edit/whole-owned/cold/nativeD0D1/neutral/Three CPU instances and lifetime; actual HTTP/WebGL2 pixels are separate' };
writeFileSync(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ result: summary.result, admittedResults: 11, actualGeometryMaterialPairs: 20,
  actualRefusals: 16, getterCalls: 0, nativeObservationSites: 45, maximumIndependentDifference: summary.maximumIndependentDifference, caller }));
`;

const source = await build({ stdin: { contents: consumer,
  resolveDir: resolve(root, 'packages/barocss-cad-interop'), sourcefile: 'whole-source-edit-consumer.mjs' },
  absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true });
const browser = await build({ entryPoints: [resolve(examples, 'source-surface-control-net-three.mjs')],
  absWorkingDir: root, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', write: false, metafile: true });
const config = await build({ entryPoints: [resolve(examples, 'source-surface-control-net-three.config.mjs')],
  absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', target: 'es2022',
  packages: 'external', write: false, metafile: true });
const graph = bundle => {
  const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(root, path));
  const own = inputs.filter(path => path.startsWith(resolve(root, 'packages') + '/'));
  const dist = own.filter(path => path.includes('/dist/'));
  const cad = own.filter(path => path.startsWith(resolve(root, 'packages/barocss-cad/src') + '/'));
  const interop = own.filter(path => path.startsWith(resolve(root, 'packages/barocss-cad-interop/src') + '/'));
  assert.equal(dist.length, 0); assert.ok(cad.length > 0 && interop.length > 0);
  assert.ok(!inputs.some(path => /node_modules\/(?:@babylonjs|pixi3d|pixi\.js)\//.test(path)));
  return { ownSource: cad.length + interop.length, cad: cad.length, interop: interop.length,
    ownDist: 0, sourceInputs: [...cad, ...interop].map(path => relative(root, path)),
    foreignEngines: 0 };
};
const sourceGraph = { node: process.version, source: graph(source), browser: graph(browser),
  affectedExampleBuilds: ['actual-source-node-consumer', 'actual-source-browser-entry', 'actual-vite-config'],
  aliases: false, customConditions: false, prebuild: false };
await writeFile(resolve(output, 'source-graph.json'), JSON.stringify(sourceGraph, null, 2));
await writeFile(resolve(output, 'source-metafile.json'), JSON.stringify(source.metafile, null, 2));
await writeFile(resolve(output, 'browser-metafile.json'), JSON.stringify(browser.metafile, null, 2));
await writeFile(resolve(output, 'config-metafile.json'), JSON.stringify(config.metafile, null, 2));
const execution = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: source.outputFiles[0].text,
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LOADER1094_EVIDENCE: output } });
await writeFile(resolve(output, 'consumer.stdout'), execution.stdout ?? '');
await writeFile(resolve(output, 'consumer.stderr'), execution.stderr ?? '');
await writeFile(resolve(output, 'consumer.exit'), String(execution.status) + '\n');
process.stdout.write(JSON.stringify(sourceGraph) + '\n');
process.stdout.write(execution.stdout ?? ''); process.stderr.write(execution.stderr ?? '');
if (execution.error) throw execution.error;
assert.equal(execution.status, 0, 'Actual source/Three CPU checkpoint failed');
