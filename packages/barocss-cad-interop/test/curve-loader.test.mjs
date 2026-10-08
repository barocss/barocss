import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Line, Mesh as ThreeMesh, Scene as ThreeScene } from 'three';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { sampleCurveAdaptive } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';
import { BaroCADLoader } from '../dist/three.js';
import { BaroCADBabylonLoader } from '../dist/babylon.js';

const mixedSource = readFileSync(new URL('../examples/curve-display.barocad', import.meta.url), 'utf8');
const curveSource = readFileSync(new URL('../examples/curve-only.barocad', import.meta.url), 'utf8');
const base = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const curveDisplay = { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 };
const options = { ...base, curveDisplay };

const old = parseBaroCadSource(mixedSource, base);
assert.deepEqual(old.model.objects.map(object => object.id), ['weighted_quarter', 'asymmetric_nonunit', 'base_panel']);
assert.deepEqual(old.unrenderedCurveIds, ['weighted_quarter', 'asymmetric_nonunit']);
assert.equal(old.curves.length, 0);
assert.equal(old.surfaces.length, 1);
assert.throws(() => parseBaroCadSource(curveSource, base), /1\.\.4 native surfaces/);

const native = parseBaroCadSource(mixedSource, options);
assert.equal(native.source, mixedSource);
assert.deepEqual(native.model, old.model);
assert.deepEqual(native.unrenderedCurveIds, []);
assert.deepEqual(native.surfaces, old.surfaces);
assert.equal(native.curves.length, 2);
assert.equal(native.model.objects[0].weights[1], 0.7071067811865476);
assert.deepEqual(native.model.objects[1].knots, [-1, -1, -1, -1, 2, 2, 2, 2]);
for (const [index, curve] of native.curves.entries()) {
  const original = native.model.objects[index];
  const direct = sampleCurveAdaptive(original, { ...curveDisplay, resultIdPrefix: `bcv0c${index}` });
  assert.deepEqual(curve.sample, direct);
  assert.equal(curve.curveId, original.id);
  assert.equal(curve.positions.length, direct.pointsMM.length * 3);
  assert.equal(curve.sample.report.dto.schema, 'barocss-native-curve-samples');
  assert.equal(curve.sample.report.geometricValidity, 'not-certified');
  for (let point = 0; point < direct.pointsMM.length; point++) {
    for (let axis = 0; axis < 3; axis++) {
      assert.equal(curve.positions[point * 3 + axis], Math.fround(direct.pointsMM[point][axis] * 0.001));
    }
  }
}
assert.deepEqual(native.curves[1].sample.domain, [-1, 2]);
const only = parseBaroCadSource(curveSource, options);
assert.equal(only.surfaces.length, 0);
assert.equal(only.curves.length, 1);
assert.ok(Object.is(only.model.objects[0].controlPoints[0][1], -0));

const threeLoader = new BaroCADLoader(options);
const defaultThree = new BaroCADLoader(base).parse(mixedSource);
assert.equal(defaultThree.group.children.length, 1);
assert.ok(defaultThree.group.children[0] instanceof ThreeMesh);
defaultThree.dispose();
const three = threeLoader.parse(mixedSource);
assert.deepEqual(three.model, native.model);
assert.equal(three.group.children.length, 3);
assert.ok(three.group.children[0] instanceof Line);
assert.ok(three.group.children[1] instanceof Line);
assert.ok(three.group.children[2] instanceof ThreeMesh);
for (const [index, child] of three.group.children.slice(0, 2).entries()) {
  assert.deepEqual(Array.from(child.geometry.getAttribute('position').array), Array.from(native.curves[index].positions));
  assert.equal(child.geometry.getAttribute('normal'), undefined);
  assert.equal(child.geometry.getAttribute('_CAD_UV'), undefined);
  assert.equal(child.geometry.getIndex(), null);
  child.geometry.computeBoundingBox();
  assert.ok(child.geometry.boundingBox.max.x <= Math.fround(0.1));
  assert.deepEqual(child.userData.barocss.nativeParameters, native.curves[index].sample.parameters);
  assert.deepEqual(child.userData.barocss.nativeIntervals, native.curves[index].sample.segments.map(segment => segment.domain));
  assert.equal(child.userData.barocss.curveId, native.curves[index].curveId);
}
const threeScene = new ThreeScene();
const callerThree = new ThreeMesh();
threeScene.add(callerThree, three.group);
three.dispose();
three.dispose();
assert.ok(threeScene.children.includes(callerThree));
assert.ok(!threeScene.children.includes(three.group));
assert.equal(three.group.children.length, 0);

const engine = new NullEngine();
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
const callerMesh = new Mesh('caller', scene);
const defaultBabylon = new BaroCADBabylonLoader(scene, base).parse(mixedSource);
assert.equal(defaultBabylon.meshes.length, 1);
assert.ok(!(defaultBabylon.meshes[0] instanceof LinesMesh));
defaultBabylon.dispose();
const babylonLoader = new BaroCADBabylonLoader(scene, options);
const babylon = babylonLoader.parse(mixedSource);
assert.deepEqual(babylon.model, native.model);
assert.equal(babylon.meshes.length, 3);
assert.ok(babylon.meshes[0] instanceof LinesMesh);
assert.ok(babylon.meshes[1] instanceof LinesMesh);
assert.ok(babylon.meshes[2] instanceof Mesh);
for (const [index, line] of babylon.meshes.slice(0, 2).entries()) {
  assert.equal(line.metadata.barocss.curveId, native.curves[index].curveId);
  assert.deepEqual(line.metadata.barocss.nativeParameters, native.curves[index].sample.parameters);
  assert.deepEqual(line.metadata.barocss.nativeIntervals, native.curves[index].sample.segments.map(segment => segment.domain));
  assert.equal(line.metadata.barocss.surfaceId, undefined);
  assert.deepEqual(Array.from(line.getVerticesData('position')), Array.from(native.curves[index].positions));
  assert.ok(line.getIndices().length >= native.curves[index].sample.segments.length * 2);
  assert.ok(line.getBoundingInfo().boundingBox.maximumWorld.x <= Math.fround(0.1));
  assert.ok(line.getTotalVertices() >= native.curves[index].sample.pointsMM.length);
}
const curveOnlyBabylon = babylonLoader.parse(curveSource);
assert.equal(curveOnlyBabylon.meshes.length, 1);
assert.ok(curveOnlyBabylon.meshes[0] instanceof LinesMesh);
curveOnlyBabylon.dispose();
babylon.dispose();
babylon.dispose();
assert.ok(scene.meshes.includes(callerMesh));
assert.ok(!callerMesh.isDisposed());
assert.ok(!scene.isDisposed);

globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init) { this.type = type; Object.assign(this, init); }
};
const server = createServer((request, response) => {
  if (request.url !== '/curve-display.barocad') { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(mixedSource);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const url = `http://127.0.0.1:${server.address().port}/curve-display.barocad`;
  const loadedThree = await threeLoader.loadAsync(url);
  const loadedBabylon = await babylonLoader.loadAsync(url);
  assert.equal(loadedThree.source, mixedSource);
  assert.equal(loadedBabylon.source, mixedSource);
  assert.equal(loadedThree.group.children.filter(child => child instanceof Line).length, 2);
  assert.equal(loadedBabylon.meshes.filter(mesh => mesh instanceof LinesMesh).length, 2);
  loadedThree.dispose();
  loadedBabylon.dispose();
} finally {
  server.close();
  await once(server, 'close');
}

const tighter = parseBaroCadSource(curveSource, { ...options, curveDisplay: { ...curveDisplay, chordToleranceMM: 0.025 } });
assert.ok(tighter.curves[0].sample.segments.length >= only.curves[0].sample.segments.length);
assert.throws(() => parseBaroCadSource(curveSource, { ...options, curveDisplay: { ...curveDisplay, maxSegments: 1 } }), /budget|capacity|exhausted/);
assert.throws(() => parseBaroCadSource(curveSource, { ...options, curveDisplay: { ...curveDisplay, maxDepth: 0 } }), /maxDepth/);
assert.throws(() => parseBaroCadSource(curveSource, { ...options, curveDisplay: { ...curveDisplay, chordToleranceMM: 0 } }), /bounds/);
assert.throws(() => parseBaroCadSource(curveSource.replace('curve_only_demo', 'bcv0c0_model'), options), /conflicts with source IDs/);
assert.throws(() => parseBaroCadSource(curveSource, { ...options, unitsPerMillimeter: 1e39 }), /Float32/);
assert.throws(() => parseBaroCadSource(curveSource, { ...options, unitsPerMillimeter: 1e-50 }), /Float32/);
const priorMeshCount = scene.meshes.length;
assert.throws(() => babylonLoader.parse(curveSource.replace('curve_only_demo', 'bcv0c0_model')), /conflicts/);
assert.equal(scene.meshes.length, priorMeshCount);
const stable = babylonLoader.parse(curveSource);
const beforeResourceFailure = [...scene.meshes];
const beforeMaterialFailure = [...scene.materials];
const createLines = MeshBuilder.CreateLines;
try {
  MeshBuilder.CreateLines = function (...args) {
    createLines.apply(this, args);
    throw new Error('injected target resource failure');
  };
  assert.throws(() => babylonLoader.parse(curveSource), /injected target resource failure/);
} finally {
  MeshBuilder.CreateLines = createLines;
}
assert.deepEqual(scene.meshes, beforeResourceFailure);
assert.deepEqual(scene.materials, beforeMaterialFailure);
assert.ok(!stable.meshes[0].isDisposed());
stable.dispose();
scene.useRightHandedSystem = false;
assert.throws(() => babylonLoader.parse(curveSource), /useRightHandedSystem/);
assert.equal(scene.meshes.length, priorMeshCount);
assert.ok(!callerMesh.isDisposed());
scene.dispose();
engine.dispose();
console.log(JSON.stringify({ result: 'curve-display-ok', mixedCurveSegments: native.curves.map(curve => curve.sample.segments.length), curveOnlySegments: only.curves[0].sample.segments.length, tighterSegments: tighter.curves[0].sample.segments.length, targets: ['three-line', 'babylon-lines-mesh'] }));
