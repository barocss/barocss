import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const outputIndex = process.argv.indexOf('--output');
if (outputIndex < 0 || !process.argv[outputIndex + 1]) throw new Error('--output EVIDENCE_DIR is required');
const output = resolve(process.argv[outputIndex + 1]), root = process.cwd();
await mkdir(output, { recursive: true });
const consumer = String.raw`
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { evaluateSurfaceCurvature, evaluateSurfaceD2 } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { Scene } from '@babylonjs/core/scene.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { FIXTURES, PINS, loadFixtures, assertSame, REFUSAL_KINDS, refusalAction } from './examples/native-surface-curvature-babylon-fixture.mjs';
import { options, ANNOTATION_DIMENSIONS, createInspection } from './examples/native-surface-curvature-babylon-checkpoint.mjs';
const output = process.env.CURVATURE_EVIDENCE;
const data = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/native-surface-curvature-babylon-data');
const texts = new Map();
for (const pin of PINS) {
  const bytes = readFileSync(resolve(data, pin.file));
  assert.equal(bytes.length, pin.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256);
  texts.set(pin.file, bytes.toString('utf8'));
}
const fixtures = await loadFixtures(file => texts.get(file)), fixtureCopy = structuredClone(fixtures);
const nativeQueries = [];
function near(actual, expected) { assert.ok(Math.abs(actual - expected) <= 1e-7); }
for (const key of ['cylinder', 'sphere']) {
  const fixture = fixtures[key], surface = fixture.model.objects[0];
  assertSame(surface, fixture.queries.geometry, 'Original Surface coefficient/sign bits');
  assert.equal(fixture.model.name, FIXTURES[key].modelId); assert.equal(surface.id, FIXTURES[key].surfaceId);
  assertSame([surface.knotsU[surface.degreeU], surface.knotsU[surface.controlPoints.length]], [-3,7]);
  assertSame([surface.knotsV[surface.degreeV], surface.knotsV[surface.controlPoints[0].length]], [2,5]);
  assert.equal(fixture.queries.queries.length, 4); assert.equal(fixture.results.length, 4);
  for (let index = 0; index < 4; index++) {
    const query = fixture.queries.queries[index], saved = fixture.results[index];
    assertSame(query, saved.query);
    const curvature = evaluateSurfaceCurvature(surface, query.u, query.v), d2 = evaluateSurfaceD2(surface, query.u, query.v);
    assertSame(curvature, saved.result, 'Whole native curvature and sign bits');
    assertSame(d2, saved.actualUnchangedD2, 'Whole original native D2'); assertSame(curvature.derivatives, d2);
    near(curvature.meanCurvaturePerMM, key === 'cylinder' ? -0.25 : -0.5);
    if (key === 'cylinder') {
      assert.ok(Object.is(curvature.gaussianCurvaturePerMM2, -0)); near(curvature.principalCurvaturesPerMM[0], -0.5); near(curvature.principalCurvaturesPerMM[1], 0);
    } else {
      near(curvature.gaussianCurvaturePerMM2, 0.25); for (const principal of curvature.principalCurvaturesPerMM) near(principal, -0.5);
    }
    nativeQueries.push({ key, query, curvature, d2 });
  }
}
const engine = new NullEngine({ renderWidth: 840, renderHeight: 560 }), scene = new Scene(engine); scene.useRightHandedSystem = true;
const camera = new FreeCamera('caller_camera', new Vector3(0.008,0.008,0.008), scene);
camera.mode = Camera.ORTHOGRAPHIC_CAMERA; camera.orthoLeft = -0.0035; camera.orthoRight = 0.0035;
camera.orthoTop = 0.0023333333333333335; camera.orthoBottom = -0.0023333333333333335;
camera.minZ = 0.0001; camera.maxZ = 1; camera.setTarget(new Vector3(0.001,0.001,0.0015)); scene.activeCamera = camera;
const cameraPosition = camera.position.asArray(), cameraRotation = camera.rotation.asArray();
const marker = MeshBuilder.CreateSphere('caller_marker', { diameter: 0.00018, segments: 8 }, scene); marker.position.set(0.001,-0.0008,0.0005);
const markerMaterial = new StandardMaterial('caller_marker_material', scene); markerMaterial.diffuseColor = Color3.Black(); markerMaterial.specularColor = Color3.Black(); markerMaterial.emissiveColor = new Color3(0,1,0); marker.material = markerMaterial;
const markerGeometry = marker.geometry, caller = { engine: 0, scene: 0, camera: 0, mesh: 0, geometry: 0, material: 0 };
engine.onDisposeObservable.add(() => { caller.engine++; }); scene.onDisposeObservable.add(() => { caller.scene++; }); camera.onDisposeObservable.add(() => { caller.camera++; });
marker.onDisposeObservable.add(() => { caller.mesh++; }); markerMaterial.onDisposeObservable.add(() => { caller.material++; });
const originalMarkerDispose = markerGeometry.dispose;
markerGeometry.dispose = function (...args) { caller.geometry++; return originalMarkerDispose.apply(this, args); };
const inspection = createInspection(scene), queryActions = [], refusals = [];
const admitted = inspection.admit(fixtures.cylinder.source);
assertSame(inspection.result.model, fixtures.cylinder.model);
assert.equal(inspection.result.source, fixtures.cylinder.source); assert.equal(inspection.originalSurface, inspection.result.model.objects[0]);
assertSame(inspection.identity, { modelId: 'cylinder_r2_input', surfaceId: 'cylinder_r2' });
const preview = inspection.result.meshes[0], neutral = parseBaroCadSource(fixtures.cylinder.source, options), previewData = neutral.surfaces[0].mesh;
assert.equal(preview.getTotalVertices(), 64); assert.equal(preview.getIndices().length, 294);
assertSame(Array.from(preview.getVerticesData('position')), Array.from(previewData.positions));
assertSame(Array.from(preview.getVerticesData('normal')), Array.from(previewData.normals));
assertSame(Array.from(preview.getIndices()), Array.from(previewData.indices));
assertSame(Array.from(preview.metadata.barocss.nativeParameters), Array.from(previewData.parameters));
assert.equal(preview.metadata.barocss.modelName, 'cylinder_r2_input'); assert.equal(preview.metadata.barocss.surfaceId, 'cylinder_r2');
assert.equal(preview.metadata.barocss.coordinateSystem, 'right-handed-y-up'); assert.equal(preview.renderingGroupId, 0);
assertSame(preview.position.asArray(), [0,0,0]); assertSame(preview.scaling.asArray(), [1,1,1]);
assertSame(Array.from(preview.computeWorldMatrix(true).asArray()), [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
assertSame(inspection.result.surfaces[0].packet, neutral.surfaces[0].packet);
function verifyAnnotations(index) {
  const saved = fixtures.cylinder.results[index], value = inspection.readout, objects = inspection.annotations;
  assertSame({ u: value.u, v: value.v }, saved.query); assertSame(value.curvature, saved.result); assertSame(value.d2, saved.actualUnchangedD2);
  assert.ok(Object.is(value.curvature.gaussianCurvaturePerMM2, -0));
  const start = value.curvature.derivatives.point.map(coordinate => coordinate * 0.001);
  const end = start.map((coordinate, axis) => coordinate + value.curvature.unitNormal[axis] * 0.0008);
  assertSame(objects.point.position.asArray(), start); assertSame(objects.start, start); assertSame(objects.end, end);
  const linePositions = objects.line.getVerticesData('position');
  assert.ok(Array.isArray(linePositions), 'Actual Babylon CreateLines CPU positions are a number[]');
  for (let j = 0; j < 6; j++) assert.ok(Object.is(linePositions[j], [...start,...end][j]), 'actual normal endpoint Binary64 CPU bits');
  assert.equal(objects.line.getTotalVertices(), 2); assertSame(Array.from(objects.line.getIndices()), [0,1]);
  assert.equal(objects.point.material, objects.pointMaterial); assert.equal(objects.point.material.emissiveColor.toHexString(), '#FF00FF');
  assert.equal(objects.line.color.toHexString(), '#FFFF00');
  for (const mesh of [objects.point, objects.line]) {
    assert.equal(mesh.getScene(), scene); assert.equal(mesh.isEnabled(), true); assert.equal(mesh.renderingGroupId, 1);
    assert.equal(mesh.material.depthFunction, Constants.ALWAYS); assert.equal(mesh.material.depthFunction, 519); assert.equal(mesh.material.disableDepthWrite, true);
  }
  assert.equal(ANNOTATION_DIMENSIONS.pointRadius, 0.00008); assert.equal(ANNOTATION_DIMENSIONS.normalLength, 0.0008);
  queryActions.push({ query: saved.query, curvature: structuredClone(value.curvature), d2: structuredClone(value.d2), actualPointPosition: objects.point.position.asArray(), actualNormalPositions: Array.from(linePositions), normalCPUStorage: 'number[]/Binary64; GPU upload is a separate browser observation' });
}
assertSame(admitted, inspection.readout); verifyAnnotations(0);
function refuse(kind) {
  const snapshot = inspection.snapshot(), meshes = [...scene.meshes], materials = [...scene.materials], geometries = [...scene.geometries];
  assert.throws(refusalAction(kind, inspection, fixtures), error => {
    if (['nan-u','infinite-v','outside-u','outside-v','invalid-surface'].includes(kind)) { assert.equal(error.code, 'DERIVATIVE'); assert.equal(error.cause.code, 'INPUT'); }
    if (kind === 'forged-reference') { assert.ok(error instanceof TypeError); assert.match(error.message, /accepted original object/); }
    if (kind === 'sphere') { assert.ok(error instanceof RangeError); assert.match(error.message, /Collapsed or nonfinite preview triangle/); }
    refusals.push({ kind, name: error.name, code: error.code ?? null, causeCode: error.cause?.code ?? null, message: error.message }); return true;
  });
  assertSame(inspection.snapshot(), snapshot); assert.deepEqual(scene.meshes, meshes); assert.deepEqual(scene.materials, materials); assert.deepEqual(scene.geometries, geometries);
}
for (const kind of REFUSAL_KINDS) refuse(kind);
for (let index = 1; index < 4; index++) {
  const previous = inspection.annotations, query = fixtures.cylinder.queries.queries[index];
  inspection.query(query.u, query.v); verifyAnnotations(index);
  assert.equal(previous.point.isDisposed(), true); assert.equal(previous.line.isDisposed(), true);
}
refuse('forged-reference');
assert.equal(inspection.resources.length, 9); assert.equal(inspection.resources.filter(row => row.kind === 'preview').length, 1);
assert.equal(inspection.resources.filter(row => row.kind === 'point').length, 4); assert.equal(inspection.resources.filter(row => row.kind === 'normal').length, 4);
const retainedSurface = inspection.originalSurface, retainedResult = inspection.result, retainedReadout = inspection.readout;
inspection.dispose(); inspection.dispose();
assert.equal(inspection.originalSurface, retainedSurface); assert.equal(inspection.result, retainedResult); assert.equal(inspection.readout, retainedReadout);
assertSame(inspection.originalSurface, fixtures.cylinder.queries.geometry); assertSame(inspection.result.model, fixtures.cylinder.model);
assertSame(inspection.readout.curvature, fixtures.cylinder.results[3].result);
for (const row of inspection.resources) { assert.equal(row.meshDisposals, 1); assert.equal(row.geometryDisposals, 1); assert.equal(row.materialDisposals, 1); assert.equal(row.mesh.isDisposed(), true); }
assert.deepEqual(scene.meshes, [marker]); assert.ok(scene.materials.includes(markerMaterial)); assert.ok(scene.geometries.includes(markerGeometry));
assert.equal(scene.isDisposed, false); assert.equal(scene.activeCamera, camera); assertSame(camera.position.asArray(), cameraPosition); assertSame(camera.rotation.asArray(), cameraRotation);
assert.deepEqual(caller, { engine: 0, scene: 0, camera: 0, mesh: 0, geometry: 0, material: 0 });
assertSame(fixtures, fixtureCopy);
const flow = { node: process.version, pins: PINS, options, annotationDimensions: ANNOTATION_DIMENSIONS, nativeQueries, queryActions, refusals,
  preview: { vertices: 64, triangles: 98, positions: Array.from(previewData.positions), normals: Array.from(previewData.normals), indices: Array.from(previewData.indices), nativeUV: Array.from(previewData.parameters) },
  resourceCounts: { meshes: inspection.resources.length, geometries: inspection.resources.length, materials: inspection.resources.length, disposalEventsPerResource: 1 },
  caller: { ...caller }, final: inspection.snapshot(), scope: 'Actual source/file/native + NullEngine/annotation lifetime. No HTTP/WebGL2/pixel proof. Caller counters before private engine teardown.' };
writeFileSync(resolve(output, 'curvature-flow.json'), JSON.stringify(flow, null, 2) + '\n');
console.log('CURVATURE_RECEIPT=' + JSON.stringify({ nativeQueries: nativeQueries.length, queryActions: queryActions.length, actualRefusals: refusals.length, resourceCounts: flow.resourceCounts, caller: { ...caller } }));
engine.dispose();
`;
try {
  const built = await build({ stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'), sourcefile: 'curvature-nullengine-consumer.mjs', loader: 'js' },
    bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022', metafile: true });
  const inputs = Object.keys(built.metafile.inputs);
  const cadSource = inputs.filter(path => path.includes('packages/barocss-cad/src/'));
  const interopSource = inputs.filter(path => path.includes('packages/barocss-cad-interop/src/'));
  const ownDist = inputs.filter(path => /packages\/barocss-cad(?:-interop)?\/dist\//.test(path));
  const graph = { cadSource, interopSource, ownDist, sourceCount: cadSource.length + interopSource.length, compiledCount: ownDist.length };
  await writeFile(resolve(output, 'curvature-inputs.json'), JSON.stringify({ graph, metafile: built.metafile }, null, 2) + '\n');
  if (!cadSource.length || !interopSource.length || ownDist.length) throw new Error('Actual own source graph with zero dist required');
  const child = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: built.outputFiles[0].text, encoding: 'utf8', env: { ...process.env, CURVATURE_EVIDENCE: output }, maxBuffer: 8 * 1024 * 1024 });
  await writeFile(resolve(output, 'cpu.stdout.log'), child.stdout ?? ''); await writeFile(resolve(output, 'cpu.stderr.log'), child.stderr ?? ''); await writeFile(resolve(output, 'cpu.exit'), String(child.status) + '\n');
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error('Actual NullEngine curvature flow failed: ' + child.stderr);
  const receipt = child.stdout.split('\n').find(line => line.startsWith('CURVATURE_RECEIPT='));
  if (!receipt) throw new Error('Actual NullEngine receipt missing');
  const summary = { node: process.version, graph: { cadSource: cadSource.length, interopSource: interopSource.length, sourceCount: graph.sourceCount, compiledCount: 0 },
    cpu: JSON.parse(receipt.slice('CURVATURE_RECEIPT='.length)), scope: 'Source/file/native/actual NullEngine. Browser pixels are separate.' };
  await writeFile(resolve(output, 'curvature-summary.json'), JSON.stringify(summary, null, 2) + '\n'); console.log(JSON.stringify(summary, null, 2));
} catch (error) { await writeFile(resolve(output, 'curvature-failure.json'), JSON.stringify({ message: error.message, stack: error.stack }, null, 2) + '\n'); throw error; }
