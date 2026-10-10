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
import { compileCadModel, validateAxisBoxSolidBoolean, measureAxisBoxSolidBooleanMass,
  validateAxisBoxSolidBooleanMass, analyzeAxisBoxSolidPrincipalInertia, validateAxisBoxSolidPrincipalInertia } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { GEOMETRY_KEYS, CASE_KEYS, PINS, loadGeometry, createNativeOptions, assertNative, assertBuffer }
  from './examples/solid-mass-principal-three-fixture.mjs';
import { createMassPrincipalThreeHost } from './examples/solid-mass-principal-three-checkpoint.mjs';

const output = process.env.LOADER1131_EVIDENCE;
const data = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/solid-mass-principal-three-data');
const texts = new Map();
for (const pin of PINS) {
  const bytes = readFileSync(resolve(data, pin.file));
  assert.equal(bytes.length, pin.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256);
  texts.set(pin.file, bytes.toString('utf8'));
}
assert.equal(PINS.length, 51); assert.equal(PINS.reduce((sum, pin) => sum + pin.bytes, 0), 2243273);
assert.equal(PINS.filter(pin => pin.file.endsWith('.css')).length, 31);
assert.deepEqual(GEOMETRY_KEYS, ['rect', 'disjoint', 'cube', 'empty']);
const assets = new Map();
for (const key of GEOMETRY_KEYS) assets.set(key, await loadGeometry(key, file => texts.get(file)));
const actualNative = [];
for (const key of CASE_KEYS) {
  const request = JSON.parse(texts.get(key + '.authored-principal-request.json')),
    owned = JSON.parse(texts.get(key + '.owned-principal.json'));
  validateAxisBoxSolidBoolean(request.mass.boolean);
  const mass = measureAxisBoxSolidBooleanMass(request.mass.boolean, request.mass.options);
  assertNative(mass, request.mass, 'Full independent public mass result'); validateAxisBoxSolidBooleanMass(mass);
  const principal = analyzeAxisBoxSolidPrincipalInertia(mass, request.options);
  assertNative(principal, owned, 'Full independent public stored principal result'); validateAxisBoxSolidPrincipalInertia(principal);
  assertNative(principal.measure, request.options.selection.kind === 'total' ? mass.total : mass.bodies.find(body => body.bodyId === request.options.selection.bodyId), 'Actual selected full measure');
  assertNative(principal.report.inputTensorKgM2, principal.measure.inertiaCentroidKgM2, 'Only selected stored tensor authority');
  assert.equal(principal.report.quality.storedTensorAnalysisOnly, true);
  assert.equal(principal.report.quality.exactGeometryAxesCertified, false);
  actualNative.push({ key, selection: principal.options.selection, massKG: principal.measure.massKG,
    centroidMM: principal.measure.centroidMM, momentsKgM2: principal.principal?.momentsKgM2 ?? null,
    clusters: principal.report.observedDegenerateClusters, axesUnique: principal.report.axesUnique,
    rotationCount: principal.report.rotationCount, fullOwnedExact: true });
}
assert.equal(actualNative.length, 6); assert.deepEqual(actualNative.map(row => row.axesUnique), [true, false, false, false, false, null]);
assert.deepEqual(actualNative[0].momentsKgM2, [2.5e-7, 5e-7, 6.5e-7]);
assert.deepEqual(actualNative[2].centroidMM, [2, 2, 2]); assert.deepEqual(actualNative[3].centroidMM, [9, 9, 9]);
const scene = new Scene(), markerGeometry = new SphereGeometry(.0004, 8, 6), markerMaterial = new MeshBasicMaterial({ color: 0x00ff00 }), marker = new Mesh(markerGeometry, markerMaterial);
marker.position.set(.018, -.004, .004); scene.add(marker);
const caller = { geometry: 0, material: 0 }; markerGeometry.addEventListener('dispose', () => caller.geometry++); markerMaterial.addEventListener('dispose', () => caller.material++);
let callbacks = 0;
const host = createMassPrincipalThreeHost({ scene, onChange(record) {
  callbacks++; assert.equal(host.accepted, record);
  for (const old of host.records) if (old !== record) for (const resource of old.resources) {
    assert.equal(resource.geometryDisposals, 1); assert.equal(resource.materialDisposals, 1);
    assert.equal(resource.result.group.parent, null);
  }
} });
const admitted = [], selections = [];
function inspect(key, state) {
  const asset = assets.get(key), record = host.accepted, parent = asset.boolean;
  assert.ok(record); assert.equal(record.assetKey, key); assert.equal(record.state, state);
  assertNative(record.proof.boolean, parent, 'Complete original Boolean proof retained');
  assertNative(record.proof.mass.boolean, parent, 'Mass original complete Boolean');
  validateAxisBoxSolidBooleanMass(record.proof.mass); validateAxisBoxSolidPrincipalInertia(record.principal);
  assertNative(record.principal, JSON.parse(texts.get(record.caseKey + '.owned-principal.json')), 'Current original selected principal output');
  assertNative(record.proof.operandModels, parent.originalModels, 'Full original operand Models');
  for (const [i, source] of asset.operandSources.entries()) {
    const cold = compileCadModel(source, { sourceVersion: 0 }); assert.equal(cold.ok, true); assert.equal(cold.model.objects.length, 7);
    assertNative(cold.model, parent.originalModels[i], 'Complete operand cold compile');
  }
  assert.equal(record.results.length, parent.panels.length); assert.equal(record.resources.length, parent.panels.length);
  assert.deepEqual(caller, { geometry: 0, material: 0 });
  const observed = { key, state, caseKey: record.caseKey, principal: structuredClone(record.principal), readout: structuredClone(record.readout), panels: [] };
  if (!parent.panels.length) {
    assert.equal(record.root, null); assert.deepEqual(scene.children, [marker]);
    assert.equal(record.principal.measure.massKG, 0); assert.equal(record.principal.measure.centroidMM, null);
    assert.equal(record.principal.measure.inertiaCentroidKgM2, null); assert.equal(record.principal.principal, null); assert.equal(record.principal.report.axesUnique, null);
  } else { assert.equal(record.root.parent, scene); assert.deepEqual(scene.children, [marker, record.root]); assert.equal(record.root.children.length, parent.bodies.length); }
  for (const [i, panel] of parent.panels.entries()) {
    const source = asset.panelSourcesMap.get(panel.id), result = record.results[i], resource = record.resources[i], cold = compileCadModel(source.source, { sourceVersion: 0 });
    assert.equal(cold.ok, true); assert.equal(cold.model.objects.length, 5);
    assert.equal(result.source, source.source); assertNative(result.model, cold.model, 'Full target original Model0');
    assertNative(record.proof.panelModels[i].model, cold.model, 'Full cold proof panel Model');
    assert.equal(result.model.objects.filter(object => object.kind === 'curve').length, 4); assert.equal(result.unrenderedCurveIds.length, 4);
    assert.equal(result.curves.length, 0); assert.equal(result.surfaces.length, 1); assert.equal(result.group.children.length, 1);
    const mesh = result.group.children[0], shell = parent.shells.find(item => item.panelIds.includes(panel.id));
    assert.ok(mesh instanceof Mesh); assert.equal(mesh, resource.object); assert.equal(mesh.parent, result.group);
    assert.equal(result.group.parent.name, shell.id); assert.equal(result.group.parent.parent.name, shell.bodyId);
    assert.equal(mesh.material.isMeshNormalMaterial, true); assert.equal(mesh.material.side, DoubleSide);
    for (const object of [mesh, result.group, result.group.parent, result.group.parent.parent, record.root]) {
      assertNative(object.position.toArray(), [0, 0, 0], 'Original position'); assertNative(object.quaternion.toArray(), [0, 0, 0, 1], 'Original rotation'); assertNative(object.scale.toArray(), [1, 1, 1], 'One scale conversion');
    }
    const neutral = parseBaroCadSource(source.source, createNativeOptions()).surfaces[0];
    assertBuffer(mesh.geometry.attributes.position.array, neutral.mesh.positions, 'Original neutral XYZ'); assertBuffer(mesh.geometry.attributes.normal.array, neutral.mesh.normals, 'Neutral normals');
    assertBuffer(mesh.geometry.attributes._CAD_UV.array, neutral.mesh.parameters, 'Original parameter UV'); assertBuffer(mesh.geometry.index.array, neutral.mesh.indices, 'Actual derived indices');
    assert.equal(mesh.geometry.attributes.position.count, 4); assert.equal(mesh.geometry.index.count, 6); assert.equal(resource.geometryDisposals, 0); assert.equal(resource.materialDisposals, 0);
    observed.panels.push({ panelId: panel.id, bodyId: shell.bodyId, shellId: shell.id, source: result.source, model: structuredClone(result.model),
      positions: [...resource.positions], normals: [...resource.normals], parameters: [...resource.parameters], indices: [...resource.indices] });
  }
  admitted.push(observed); return observed;
}
host.load(assets.get('rect')); inspect('rect', 'original');
const accepted = host.accepted, readout = structuredClone(accepted.readout), proof = structuredClone(accepted.proof), principal = structuredClone(accepted.principal), children = [...scene.children];
const refused = host.runRefusals(assets.get('rect'), assets.get('disjoint'));
assert.equal(refused.refusals.length, 17); assert.equal(refused.getterCalls, 0); assert.equal(host.accepted, accepted);
assertNative(accepted.readout, readout, 'Refused readout retained'); assertNative(accepted.proof, proof, 'Refused complete proof retained'); assertNative(accepted.principal, principal, 'Refused complete principal retained'); assert.deepEqual(scene.children, children);
assert.equal(host.allResources.length, 8); assert.equal(host.counts.partialPairs, 2);
for (const resource of host.allResources.slice(6)) { assert.equal(resource.geometryDisposals, 1); assert.equal(resource.materialDisposals, 1); }
function select(caseKey, state) {
  const record = host.accepted, refs = { root: record.root, proof: record.proof, results: record.results, resources: record.resources, children: [...scene.children] }, before = { ...host.counts };
  const buffers = record.resources.map(row => ['position', 'normal', '_CAD_UV'].map(key => ({ key, ref: row.geometry.attributes[key].array, values: Array.from(row.geometry.attributes[key].array) })));
  host.select(caseKey); assert.equal(host.accepted, record); assert.equal(record.root, refs.root); assert.equal(record.proof, refs.proof); assert.equal(record.results, refs.results); assert.equal(record.resources, refs.resources); assert.deepEqual(scene.children, refs.children);
  for (const field of ['pairs', 'targetParseCalls', 'livePairs', 'geometryDisposals', 'materialDisposals']) assert.equal(host.counts[field], before[field], 'Selection allocates/disposes no target: ' + field);
  for (const [i, rows] of buffers.entries()) for (const row of rows) { assert.equal(record.resources[i].geometry.attributes[row.key].array, row.ref); assertBuffer(row.ref, row.values, 'Selection retains CPU buffer data'); }
  const observation = inspect('disjoint', state); assert.equal(observation.caseKey, caseKey); selections.push(observation); return observation;
}
host.load(assets.get('disjoint')); const originalTotal = inspect('disjoint', 'original');
const originalBody0 = select('disconnected_body_0', 'original'), originalBody1 = select('disconnected_body_1', 'original');
host.load(assets.get('cube')); inspect('cube', 'original'); host.load(assets.get('empty')); inspect('empty', 'original');
host.coldReopen(assets.get('disjoint')); const coldTotal = inspect('disjoint', 'cold-reopen');
const coldBody0 = select('disconnected_body_0', 'cold-reopen'), coldBody1 = select('disconnected_body_1', 'cold-reopen');
for (const [first, cold] of [[originalTotal, coldTotal], [originalBody0, coldBody0], [originalBody1, coldBody1]])
  for (const field of ['caseKey', 'principal', 'readout', 'panels']) assertNative(first[field], cold[field], 'Complete cold native/display equivalence: ' + field);
assert.equal(host.records.length, 5); assert.equal(host.updates.length, 9); assert.equal(host.allResources.length, 38); assert.equal(host.peakLivePairs, 18); assert.equal(host.targetParseCalls, 41);
assert.equal(new Set(host.allResources.map(row => row.geometry)).size, 38); assert.equal(new Set(host.allResources.map(row => row.material)).size, 38);
host.dispose(); host.dispose(); assert.equal(host.accepted, null); assert.deepEqual(scene.children, [marker]); assert.deepEqual(caller, { geometry: 0, material: 0 }); assert.equal(callbacks, 10);
for (const row of host.allResources) {
  assert.equal(row.geometryDisposals, 1); assert.equal(row.materialDisposals, 1); assert.equal(row.result.group.parent, null);
  assertBuffer(row.geometry.attributes.position.array, row.positions, 'CPU positions retained after disposal'); assertBuffer(row.geometry.attributes.normal.array, row.normals, 'CPU normals retained'); assertBuffer(row.geometry.attributes._CAD_UV.array, row.parameters, 'CPU UV retained'); assertBuffer(row.geometry.index.array, row.indices, 'CPU index retained');
  assert.equal(row.result.model.objects.length, 5); assert.equal(row.result.unrenderedCurveIds.length, 4);
}
for (const update of host.updates) validateAxisBoxSolidPrincipalInertia(update.principal);
for (const record of host.records) { validateAxisBoxSolidBooleanMass(record.proof.mass); validateAxisBoxSolidPrincipalInertia(record.principal); }
const summary = { result: 'complete-solid-mass-principal-three-cpu-ok', pins: PINS, actualNative, admitted, actualRefusals: refused.refusals, getterCalls: refused.getterCalls, counts: host.counts, callbackCount: callbacks, caller, events: host.events,
  scope: 'Actual public original full mass/stored principal results/selection authority/cold complete Models/neutral and Three CPU/target selection retention and lifetime. HTTP/WebGL2 pixels remain separate.' };
writeFileSync(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n'); console.log(JSON.stringify({ result: summary.result, pins: 51, cases: 6, updates: host.updates.length, refusals: 17, counts: host.counts, caller }));
`;

const source = await build({ stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'),
  sourcefile: 'complete-solid-mass-principal-consumer.mjs' }, absWorkingDir: root, bundle: true, platform: 'node',
  format: 'esm', target: 'es2022', write: false, metafile: true });
const browser = await build({ entryPoints: [resolve(examples, 'solid-mass-principal-three.mjs')],
  absWorkingDir: root, bundle: true, platform: 'browser', format: 'esm', target: 'es2022', write: false, metafile: true });
const config = await build({ entryPoints: [resolve(examples, 'solid-mass-principal-three.config.mjs')],
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
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LOADER1131_EVIDENCE: output } });
await writeFile(resolve(output, 'consumer.stdout'), execution.stdout ?? '');
await writeFile(resolve(output, 'consumer.stderr'), execution.stderr ?? '');
await writeFile(resolve(output, 'consumer.exit'), String(execution.status) + '\n');
process.stdout.write(JSON.stringify(sourceGraph) + '\n');
process.stdout.write(execution.stdout ?? ''); process.stderr.write(execution.stderr ?? '');
if (execution.error) throw execution.error;
assert.equal(execution.status, 0, 'Actual source/Three CPU checkpoint failed');
