import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { compileCadModel, evaluateCurve, validateWeightedInterpolatingCurve } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';
import { BaroCADBabylonLoader, resolveBaroCadBabylonCurvePick } from '../dist/babylon.js';

assert.equal(process.argv.length, 3, 'Usage: node weighted-curve-babylon-verify.mjs <CAD-949-demo-output-directory>');
const evidence = resolve(process.argv[2]);
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
const hashes = {
  rational_quadratic_quarter: 'ca5b2d1697f2d134a2d0858ebe7d42060c19801a76b2748d2b85e6f078fee956',
  rational_cubic_target: '27850779c533e14f7c47cf5fa4f9612f4aea6a5782b1e0dac23b25d46930e267',
  same_points_changed_fixed_weights: 'be36c0ee80378ff437e22aacefde61e461de2e1ebd332fe3adceba3d26626421',
  all_one_authentic_polynomial: '9857e753edef6870ecce538dce52d7ff83a6044309b64006379628c56be1fd3e',
  common_weight_scale_two: '4571fe461a94024f7639bada06bc382999e43a06d9d1e9ef240bf489a19e1a7d',
  maximum_16_positive_weights: '28407f4aef0abdda43ab7dcaf539bf1ce5781d23efd4e94e66dd17a098e8b6e0',
  coincident_xyz_fixed_weights: 'd74db7d1a43cd0a6196a5479284628ac175a97f3670cb885f36ebf94b3104132',
};
const engine = new NullEngine();
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
const marker = new Mesh('caller-marker', scene);
const loader = new BaroCADBabylonLoader(scene, options);
const accepted = [];
let coincidentRefused = false;
try {
  for (const [key, expectedHash] of Object.entries(hashes)) {
    const bytes = readFileSync(new URL(`./weighted-curve-babylon-data/${key}.barocad`, import.meta.url));
    const original = readFileSync(resolve(evidence, `${key}.source0.css`));
    const source = bytes.toString('utf8');
    const authored = JSON.parse(readFileSync(resolve(evidence, `${key}.authored-points-weights.json`), 'utf8'));
    const owned = JSON.parse(readFileSync(resolve(evidence, `${key}.owned-weighted-curve.json`), 'utf8'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash);
    assert.deepEqual(bytes, original, `${key} original source bytes`);
    assert.deepEqual({ points: owned.points, weights: owned.weights, options: owned.options }, authored);
    assert.deepEqual(validateWeightedInterpolatingCurve(owned), owned.report);
    assert.equal(source, owned.source);
    assert.deepEqual(owned.curve.weights, owned.weights);
    const cold = compileCadModel(source, { sourceVersion: 0 });
    assert.equal(cold.ok, true, `${key} cold source0 compile: ${JSON.stringify(cold.diagnostics)}`);
    assert.deepEqual(cold.model, owned.model);
    assert.deepEqual(cold.model.objects, [owned.curve]);
    for (const { parameter } of owned.points) {
      assert.deepEqual(evaluateCurve(cold.model.objects[0], parameter), evaluateCurve(owned.curve, parameter));
    }
    if (key === 'coincident_xyz_fixed_weights') {
      assert.throws(() => parseBaroCadSource(source, options), /collapsed Float32 display segment/);
      assert.throws(() => loader.parse(source), /collapsed Float32 display segment/);
      coincidentRefused = true;
      continue;
    }
    const neutral = parseBaroCadSource(source, options);
    assert.deepEqual(neutral.model, cold.model);
    assert.equal(neutral.curves.length, 1);
    assert.equal(neutral.surfaces.length, 0);
    const display = loader.parse(source);
    assert.equal(display.meshes.length, 1);
    const line = display.meshes[0];
    assert.ok(line instanceof LinesMesh);
    assert.equal(line.metadata.barocss.curveId, owned.curve.id);
    assert.equal(line.metadata.barocss.coordinateSystem, 'right-handed-y-up');
    assert.deepEqual(line.metadata.barocss.nativeParameters, neutral.curves[0].sample.parameters);
    assert.deepEqual(Array.from(line.getVerticesData('position')), Array.from(neutral.curves[0].positions));
    assert.ok(neutral.curves[0].sample.pointsMM.length <= 4096);
    accepted.push({ key, source, owned, display, line, samples: neutral.curves[0].sample.pointsMM.length,
      segments: neutral.curves[0].sample.segments.length, basis: owned.report.basisEvaluationCount,
      eliminations: owned.report.eliminationStepCount });
  }
  assert.equal(coincidentRefused, true);
  assert.equal(accepted.length, 6);
  const quarter = accepted[0], changed = accepted[2], scaled = accepted[4];
  assert.deepEqual(quarter.owned.points, changed.owned.points);
  assert.notDeepEqual(quarter.owned.weights, changed.owned.weights);
  assert.notEqual(quarter.source, changed.source);
  assert.notDeepEqual(evaluateCurve(quarter.owned.curve, 0), evaluateCurve(changed.owned.curve, 0));
  assert.deepEqual(quarter.owned.points, scaled.owned.points);
  for (const t of [-3, -0.5, 0, 2, 4.5, 7]) {
    const left = evaluateCurve(quarter.owned.curve, t), right = evaluateCurve(scaled.owned.curve, t);
    assert.ok(Math.hypot(...left.map((value, axis) => value - right[axis])) < 1e-12,
      'local common-weight-scale Curve probes agree');
  }
  const positions = quarter.line.getVerticesData('position');
  const picked = resolveBaroCadBabylonCurvePick(quarter.display, { hit: true, pickedMesh: quarter.line,
    faceId: 0, subMeshFaceId: 0, subMeshId: 0,
    pickedPoint: new Vector3((positions[0] + positions[3]) / 2, (positions[1] + positions[4]) / 2,
      (positions[2] + positions[5]) / 2) });
  assert.equal(picked.curveId, quarter.owned.curve.id);
  const sourcesBefore = accepted.map(item => item.source);
  const refused = [
    () => loader.parse('@model invalid {}'),
    () => new BaroCADBabylonLoader(scene, { ...options, sourceVersion: 1 }).parse(quarter.source),
    () => new BaroCADBabylonLoader(scene, { ...options, curveDisplay: { ...options.curveDisplay, version: 2 } }).parse(quarter.source),
    () => new BaroCADBabylonLoader(scene, { ...options, curveDisplay: { ...options.curveDisplay, maxSegments: 4093 } }).parse(quarter.source),
    () => validateWeightedInterpolatingCurve({ ...quarter.owned, report: { ...quarter.owned.report, curveId: 'forged' } }),
    () => { scene.useRightHandedSystem = false; try { loader.parse(quarter.source); } finally { scene.useRightHandedSystem = true; } },
  ];
  for (const candidate of refused) {
    assert.throws(candidate);
    assert.deepEqual(accepted.map(item => item.source), sourcesBefore);
    assert.ok(accepted.every(item => scene.meshes.includes(item.line) && !item.line.isDisposed()));
  }
  const summary = { parentCadIssue: 949, displayOptions: options,
    accepted: accepted.map(({ key, samples, segments, basis, eliminations }) => ({ key, samples, segments, basis, eliminations, lineCount: 1 })),
    coincidentNativeSourceValid: true, coincidentDisplayRefused: true, changedWeightsChangeNativeProbe: true,
    localCommonWeightScaleProbesAgree: true, pickedCurveId: picked.curveId, otherRefusals: refused.length };
  for (const { display, line } of accepted) {
    display.dispose(); display.dispose();
    assert.ok(line.isDisposed() && !scene.meshes.includes(line));
  }
  assert.ok(scene.meshes.includes(marker) && !marker.isDisposed());
  console.log(JSON.stringify({ ...summary, callerRetained: true }));
} finally {
  for (const { display } of accepted) display.dispose();
  scene.dispose(); engine.dispose();
}
