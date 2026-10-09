import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel, curveDomain, evaluateCurve, validateParameterizedInterpolatingCurve } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';
import { BaroCADLoader } from '../dist/three.js';

assert.equal(process.argv.length, 3, 'Usage: node curve-parameterization-three-verify.mjs <CAD-947-demo-output-directory>');
const evidence = resolve(process.argv[2]);
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
const expectedHashes = {
  same_points_uniform: 'd8255447223647badbd718f6e953ecf91dbe4aaf40fdc328a3abe59f73b8eb3a',
  same_points_chord: 'd8bc917b2b21dc63d314fd3397c2920ef49626a71766430ef657291e07b1436a',
  same_points_centripetal: '1cad60b35adf42e2c0cad52e8878eee8f97f68d2c5d7d5fc594326ecf28126f5',
  numeric_point_edit_chord: 'c11ae993f41ae2b8493007275431516582baaca74331f15da205c8d41eadb9a0',
};
const loader = new BaroCADLoader(options);
const accepted = [];
for (const [key, expectedHash] of Object.entries(expectedHashes)) {
  const fixture = readFileSync(new URL(`./curve-parameterization-three-data/${key}.barocad`, import.meta.url));
  const original = readFileSync(resolve(evidence, `${key}.source0.css`));
  const source = fixture.toString('utf8');
  const saved = JSON.parse(readFileSync(resolve(evidence, `${key}.owned-parameterized-curve.json`), 'utf8'));
  const points = JSON.parse(readFileSync(resolve(evidence, `${key}.authored-points.json`), 'utf8'));
  assert.equal(createHash('sha256').update(fixture).digest('hex'), expectedHash, `${key} fixture SHA`);
  assert.deepEqual(fixture, original, `${key} original source bytes`);
  assert.deepEqual({ points: saved.points, options: saved.options }, points, `${key} original authored XYZ points and options`);
  assert.deepEqual(validateParameterizedInterpolatingCurve(saved), saved.report, `${key} current public owned validator`);
  assert.equal(source, saved.interpolation.source, `${key} original native output`);
  assert.deepEqual(saved.interpolation.points.map(point => point.parameter), saved.report.generatedParameters);
  const cold = compileCadModel(source, { sourceVersion: 0 });
  assert.equal(cold.ok, true, `${key} cold source0 compile: ${JSON.stringify(cold.diagnostics)}`);
  assert.deepEqual(cold.model, saved.interpolation.model);
  assert.deepEqual(cold.model.objects[0], saved.interpolation.curve);
  assert.deepEqual(curveDomain(saved.interpolation.curve), [-3, 7]);
  const neutral = parseBaroCadSource(source, options);
  assert.deepEqual(neutral.model, cold.model);
  assert.equal(neutral.curves.length, 1);
  assert.equal(neutral.surfaces.length, 0);
  assert.equal(neutral.unrenderedCurveIds.length, 0);
  const display = loader.parse(source);
  assert.equal(display.group.children.length, 1);
  const line = display.group.children[0];
  assert.equal(line.type, 'Line');
  assert.equal(line.name, saved.interpolation.curve.id);
  assert.equal(line.userData.barocss.curveId, saved.interpolation.curve.id);
  assert.equal(line.userData.barocss.sourceVersion, 0);
  assert.equal(line.userData.barocss.coordinateSystem, 'right-handed-y-up');
  assert.deepEqual(line.userData.barocss.nativeParameters, neutral.curves[0].sample.parameters);
  assert.deepEqual(Array.from(line.geometry.getAttribute('position').array), Array.from(neutral.curves[0].positions));
  assert.equal(neutral.curves[0].sample.pointsMM.length <= 4096, true);
  assert.equal(neutral.curves[0].sample.segments.length <= 4092, true);
  for (const parameter of saved.report.generatedParameters) {
    const nativePoint = evaluateCurve(saved.interpolation.curve, parameter);
    assert.deepEqual(evaluateCurve(cold.model.objects[0], parameter), nativePoint);
  }
  accepted.push({ key, source, saved, curve: cold.model.objects[0], hash: expectedHash,
    samples: neutral.curves[0].sample.pointsMM.length, segments: neutral.curves[0].sample.segments.length,
    metrics: saved.report.metricEvaluationCount, basis: saved.report.basisEvaluationCount,
    eliminations: saved.report.eliminationStepCount, lineCount: 1 });
  display.dispose();
  display.dispose();
}
assert.deepEqual(accepted.slice(0, 3).map(item => item.saved.points),
  Array.from({ length: 3 }, () => accepted[0].saved.points));
assert.deepEqual(accepted.slice(0, 3).map(item => item.saved.options.domain),
  [[-3, 7], [-3, 7], [-3, 7]]);
assert.equal(new Set(accepted.slice(0, 3).map(item => JSON.stringify(item.saved.report.generatedParameters))).size, 3);
const probe = 0;
assert.equal(new Set(accepted.slice(0, 3).map(item => JSON.stringify(evaluateCurve(item.curve, probe)))).size, 3,
  'three native Curve probes must differ');
assert.notDeepEqual(accepted[1].saved.points, accepted[3].saved.points);
assert.notEqual(accepted[1].source, accepted[3].source);
assert.notDeepEqual(evaluateCurve(accepted[1].curve, probe), evaluateCurve(accepted[3].curve, probe));
const sourcesBefore = accepted.map(item => item.source);
const reportsBefore = accepted.map(item => item.saved.report);
const refused = [
  () => loader.parse('@model invalid {}'),
  () => new BaroCADLoader({ ...options, sourceVersion: 1 }).parse(accepted[0].source),
  () => new BaroCADLoader({ ...options, curveDisplay: { ...options.curveDisplay, version: 2 } }).parse(accepted[0].source),
  () => new BaroCADLoader({ ...options, curveDisplay: { ...options.curveDisplay, maxSegments: 4093 } }).parse(accepted[0].source),
  () => validateParameterizedInterpolatingCurve({ ...accepted[0].saved, report: { ...accepted[0].saved.report, method: 'chord-length' } }),
];
for (const candidate of refused) assert.throws(candidate);
assert.deepEqual(accepted.map(item => item.source), sourcesBefore);
assert.deepEqual(accepted.map(item => item.saved.report), reportsBefore);
console.log(JSON.stringify({ parentCadIssue: 947, displayOptions: options, accepted: accepted.map(({ key, hash, samples, segments,
  metrics, basis, eliminations, lineCount }) => ({ key, hash, samples, segments, metrics, basis, eliminations, lineCount })),
  distinctNativeProbes: 3, editedPointChangesNativeProbe: true, refused: refused.length, acceptedRetained: true }));
