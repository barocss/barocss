import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Group, Line, Scene } from 'three';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene as BabylonScene } from '@babylonjs/core/scene.js';
import { sampleCurveWideAdaptive } from '@barocss/cad';
import { baroCadSourceToGLB, parseBaroCadSource } from '../dist/native.js';
import { BaroCADLoader } from '../dist/three.js';
import { BaroCADBabylonLoader } from '../dist/babylon.js';

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
assert.throws(() => baroCadSourceToGLB(source, options, { includeSourceText: false }), /version 1/);

const engine = new NullEngine();
const babylonScene = new BabylonScene(engine);
babylonScene.useRightHandedSystem = true;
const originalBabylonMeshes = babylonScene.meshes.length;
assert.throws(() => new BaroCADBabylonLoader(babylonScene, options).parse(source), /version 1/);
assert.equal(babylonScene.meshes.length, originalBabylonMeshes);
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
  threeLines: 1, oldV0Refused: true, babylonAndGlbV1Refused: true, callerChildRetained: true,
}));
