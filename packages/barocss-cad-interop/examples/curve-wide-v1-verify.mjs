import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Group, Line, Scene } from 'three';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene as BabylonScene } from '@babylonjs/core/scene.js';
import { Mesh as BabylonMesh } from '@babylonjs/core/Meshes/mesh.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { Vector3 as BabylonVector3 } from '@babylonjs/core/Maths/math.vector.js';
import { sampleCurveWideAdaptive } from '@barocss/cad';
import { baroCadSourceToGLB, parseBaroCadSource } from '../dist/native.js';
import { BaroCADLoader } from '../dist/three.js';
import { BaroCADBabylonLoader, resolveBaroCadBabylonCurvePick } from '../dist/babylon.js';

// Exact source0 text generated in CAD #696's integrated flow, including lexical -0.
const source = readFileSync(new URL('./curve-wide-v1.barocad', import.meta.url), 'utf8');
const base = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const curveDisplay = { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 };
const options = { ...base, curveDisplay };
const result = parseBaroCadSource(source, options);
const original = result.model.objects[0];
assert.equal(result.source, source);
assert.equal(result.model.name, 'wide_model');
assert.equal(original.id, 'wide_64');
assert.equal(original.controlPoints.length, 64);
assert.equal(original.knots.length, 68);
assert.ok(Object.is(original.controlPoints[0][0], -0));
assert.deepEqual(result.curves[0].sample, sampleCurveWideAdaptive(original, {
  chordToleranceMM: curveDisplay.chordToleranceMM, maxSegments: curveDisplay.maxSegments,
  maxDepth: curveDisplay.maxDepth, resultIdPrefix: 'bcv1c0',
}));
assert.equal(result.curves[0].sample.report.dto.version, 1);
assert.deepEqual(result.curves[0].sample.domain, [-0, 26]);
assert.equal(result.curves[0].sample.segments.length, 39);
assert.equal(result.curves[0].sample.pointsMM.length, 40);
for (const [index, point] of result.curves[0].sample.pointsMM.entries()) {
  for (let axis = 0; axis < 3; axis++) {
    assert.equal(result.curves[0].positions[index * 3 + axis], Math.fround(point[axis] * 0.001));
  }
}

assert.throws(() => parseBaroCadSource(source, {
  ...base, curveDisplay: { chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 },
}), /own data|pole|capacity/);
assert.throws(() => parseBaroCadSource(source, {
  ...base, curveDisplay: { ...curveDisplay, version: 2 },
}), /version 1/);
assert.throws(() => parseBaroCadSource(source, {
  ...base, curveDisplay: { ...curveDisplay, maxSegments: 4093 },
}), /bounds/);
assert.throws(() => parseBaroCadSource(source, {
  ...base, curveDisplay: { ...curveDisplay, get extra() { throw new Error('getter ran'); } },
}), /requires .* only/);
const wideGlb = baroCadSourceToGLB(source, options, { includeSourceText: true });
assert.ok(wideGlb.byteLength <= 1024 * 1024);
const glbJsonLength = new DataView(wideGlb).getUint32(12, true);
const glbJson = JSON.parse(new TextDecoder().decode(new Uint8Array(wideGlb, 20, glbJsonLength)));
assert.equal(glbJson.asset.extras.barocss.curveSampleVersion, 1);
assert.equal(glbJson.nodes[0].extras.barocss.sampleVersion, 1);
assert.equal(glbJson.asset.extras.barocss.source.text, source);

const engine = new NullEngine();
const babylonScene = new BabylonScene(engine);
babylonScene.useRightHandedSystem = true;
const callerBabylonMesh = new BabylonMesh('caller', babylonScene);
const babylonLoader = new BaroCADBabylonLoader(babylonScene, options);
const babylon = babylonLoader.parse(source);
assert.equal(babylon.source, source);
assert.equal(babylon.meshes.length, 1);
const babylonLine = babylon.meshes[0];
assert.ok(babylonLine instanceof LinesMesh);
assert.equal(babylonLine.metadata.barocss.curveId, original.id);
assert.equal(babylonLine.metadata.barocss.sampleReport.dto.version, 1);
assert.deepEqual(babylonLine.metadata.barocss.nativeParameters, result.curves[0].sample.parameters);
assert.deepEqual(Array.from(babylonLine.getVerticesData('position')), Array.from(result.curves[0].positions));
const babylonPositions = babylonLine.getVerticesData('position');
const babylonPick = resolveBaroCadBabylonCurvePick(babylon, {
  hit: true, pickedMesh: babylonLine, faceId: 0, subMeshFaceId: 0, subMeshId: 0,
  pickedPoint: new BabylonVector3(
    (babylonPositions[0] + babylonPositions[3]) / 2,
    (babylonPositions[1] + babylonPositions[4]) / 2,
    (babylonPositions[2] + babylonPositions[5]) / 2,
  ),
});
assert.equal(babylonPick.curveId, original.id);
assert.ok(babylonPick.parameterApprox >= result.curves[0].sample.parameters[0]);
assert.throws(() => babylonLoader.parse('@model invalid {}'));
assert.ok(!babylonLine.isDisposed());
assert.ok(!callerBabylonMesh.isDisposed());
babylon.dispose();
babylon.dispose();
assert.ok(babylonLine.isDisposed());
assert.ok(!callerBabylonMesh.isDisposed());
babylonScene.dispose();
engine.dispose();

const threeScene = new Scene();
const callerChild = new Group();
threeScene.add(callerChild);
const loader = new BaroCADLoader(options);
const three = loader.parse(source);
threeScene.add(three.group);
assert.equal(three.group.children.length, 1);
assert.ok(three.group.children[0] instanceof Line);
assert.deepEqual(three.group.children[0].userData.barocss.nativeParameters, result.curves[0].sample.parameters);
assert.throws(() => loader.parse('@model invalid {}'));
assert.ok(threeScene.children.includes(three.group));
three.dispose();
three.dispose();
assert.ok(!threeScene.children.includes(three.group));
assert.ok(threeScene.children.includes(callerChild));

console.log(JSON.stringify({
  sourceBytes: Buffer.byteLength(source), originalId: original.id, originalPoles: original.controlPoints.length,
  originalKnots: original.knots.length, originalSignedZero: Object.is(original.controlPoints[0][0], -0),
  domain: result.curves[0].sample.domain, sampleVersion: result.curves[0].sample.report.dto.version,
  segments: result.curves[0].sample.segments.length, points: result.curves[0].sample.pointsMM.length,
  threeLines: 1, babylonLines: 1, babylonPickParameter: babylonPick.parameterApprox,
  oldV0Refused: true, glbV1Bytes: wideGlb.byteLength, callerChildRetained: true,
}));
