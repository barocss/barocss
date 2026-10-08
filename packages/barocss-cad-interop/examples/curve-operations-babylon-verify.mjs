import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { parseBaroCadSource } from '../dist/native.js';
import { BaroCADBabylonLoader, resolveBaroCadBabylonCurvePick } from '../dist/babylon.js';
import { createCurveOperationCases, displayOptions } from './curve-operations-fixture.mjs';

const engine = new NullEngine();
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
const marker = new Mesh('caller-marker', scene);
const loader = new BaroCADBabylonLoader(scene, displayOptions);
const accepted = [];
try {
  for (const item of createCurveOperationCases()) {
    const source = readFileSync(new URL(`./curve-operations-data/${item.key}.barocad`, import.meta.url), 'utf8');
    assert.equal(source, item.result.source);
    const neutral = parseBaroCadSource(source, displayOptions);
    const display = loader.parse(source);
    assert.equal(display.source, source);
    assert.equal(display.meshes.length, 1);
    const line = display.meshes[0];
    assert.ok(line instanceof LinesMesh);
    assert.equal(line.metadata.barocss.curveId, item.result.curve.id);
    assert.equal(line.metadata.barocss.sampleReport.dto.version, 1);
    assert.deepEqual(line.metadata.barocss.nativeParameters, neutral.curves[0].sample.parameters);
    assert.deepEqual(Array.from(line.getVerticesData('position')), Array.from(neutral.curves[0].positions));
    assert.deepEqual(display.model.objects[0], item.result.curve);
    if (item.key === 'refined') {
      assert.ok(Object.is(item.result.original.controlPoints[0][0], -0));
      assert.ok(Object.is(neutral.curves[0].sample.domain[0], -0));
    }
    accepted.push({ item, display, line, samples: neutral.curves[0].sample.pointsMM.length });
  }
  assert.equal(accepted.length, 3);
  assert.equal(scene.meshes.filter(mesh => mesh instanceof LinesMesh).length, 3);
  const first = accepted[0];
  const positions = first.line.getVerticesData('position');
  const midpoint = new Vector3((positions[0] + positions[3]) / 2,
    (positions[1] + positions[4]) / 2, (positions[2] + positions[5]) / 2);
  const pick = resolveBaroCadBabylonCurvePick(first.display, {
    hit: true, pickedMesh: first.line, faceId: 0, subMeshFaceId: 0, subMeshId: 0, pickedPoint: midpoint,
  });
  assert.equal(pick.curveId, first.item.result.curve.id);
  assert.equal(first.item.result.provenance.originalCurveId, first.item.result.original.id);
  assert.ok(pick.parameterApprox >= -3 && pick.parameterApprox <= 7);

  const retained = accepted.map(({ display, line }) => ({ source: display.source, line }));
  const refuse = action => {
    assert.throws(action);
    for (const [index, { display, line }] of accepted.entries()) {
      assert.equal(display.source, retained[index].source);
      assert.equal(line, retained[index].line);
      assert.ok(scene.meshes.includes(line) && !line.isDisposed());
    }
  };
  refuse(() => loader.parse('@model invalid {}'));
  refuse(() => new BaroCADBabylonLoader(scene, { ...displayOptions, sourceVersion: 1 }).parse(first.display.source));
  refuse(() => new BaroCADBabylonLoader(scene, { ...displayOptions,
    curveDisplay: { ...displayOptions.curveDisplay, version: 2 } }).parse(first.display.source));
  refuse(() => new BaroCADBabylonLoader(scene, { ...displayOptions,
    curveDisplay: { ...displayOptions.curveDisplay, maxSegments: 4093 } }).parse(first.display.source));
  const forged = structuredClone(first.item.result);
  forged.source += ' ';
  refuse(() => first.item.validate(forged));
  const previousBasis = scene.useRightHandedSystem;
  scene.useRightHandedSystem = false;
  refuse(() => loader.parse(first.display.source));
  scene.useRightHandedSystem = previousBasis;

  const summary = accepted.map(({ item, samples }) => ({ key: item.key, outputId: item.result.curve.id,
    originalId: item.result.original.id, outputPoles: item.result.curve.controlPoints.length, samples }));
  for (const { display, line } of accepted) {
    display.dispose();
    display.dispose();
    assert.ok(line.isDisposed());
    assert.ok(!scene.meshes.includes(line));
  }
  assert.ok(scene.meshes.includes(marker) && !marker.isDisposed());
  console.log(JSON.stringify({ summary, pickOutputId: pick.curveId,
    pickInputId: first.item.result.provenance.originalCurveId, refusals: 6, callerRetained: true }));
} finally {
  for (const { display } of accepted) display.dispose();
  scene.dispose();
  engine.dispose();
}
