import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel, validateCircularGeometryPattern, evaluateCurve, evaluateSurface,
  evaluateCurveD1, evaluateSurfaceD1, tessellateSurface } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';

assert.equal(process.argv.length, 3, 'Usage: node circular-geometry-pattern-pixi3d-verify.mjs <CAD-967-demo-output-directory>');
const evidence = resolve(process.argv[2]);
const manifest = JSON.parse(readFileSync(new URL('./circular-geometry-pattern-pixi3d-data/manifest.json', import.meta.url)));
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const local = name => readFileSync(new URL(`./circular-geometry-pattern-pixi3d-data/${name}`, import.meta.url));
const verifyPreview = (source, natives) => {
  const preview = parseBaroCadSource(source, options);
  assert.deepEqual(preview.model.objects, natives);
  assert.deepEqual(preview.unrenderedCurveIds, []);
  for (const [index, native] of natives.entries()) {
    if (native.kind === 'curve') {
      const curve = preview.curves[index];
      assert.equal(curve.curveId, native.id);
      assert.deepEqual(curve.sample.pointsMM, curve.sample.parameters.map(parameter => evaluateCurve(native, parameter)));
      assert.deepEqual(Array.from(curve.positions), curve.sample.pointsMM.flatMap(point => point.map(value => Math.fround(value * 0.001))));
    } else {
      const surface = preview.surfaces[index];
      assert.equal(surface.surfaceId, native.id);
      assert.equal(surface.report.vertexCount, 64);
      assert.equal(surface.report.triangleCount, 98);
      assert.deepEqual(surface.packet, tessellateSurface(native, { countU: 8, countV: 8, revision: 0 }).packet);
    }
  }
  return preview;
};
const accepted = [];
let pairCount = 0;
let directRefusals = 0;
for (const item of manifest.cases) {
  const bytes = local(item.file);
  assert.equal(digest(bytes), item.sourceSha256);
  assert.deepEqual(bytes, readFileSync(resolve(evidence, `${item.key}.source0.css`)));
  const source = bytes.toString('utf8');
  const ownedBytes = readFileSync(resolve(evidence, `${item.key}.owned-circular-pattern.json`));
  assert.equal(digest(ownedBytes), item.ownedSha256);
  if (item.ownedFile) assert.deepEqual(local(item.ownedFile), ownedBytes);
  const owned = JSON.parse(ownedBytes);
  const report = validateCircularGeometryPattern(owned);
  assert.deepEqual(report, owned.report);
  assert.deepEqual(owned.options, item.options);
  assert.deepEqual(report.normalizedAxis, item.normalizedAxis);
  assert.deepEqual(report.anglesDegrees, item.anglesDegrees);
  assert.deepEqual(report.matrices, item.matrices);
  assert.deepEqual(report.activeGeometryIds, item.ids);
  assert.equal(report.count, item.count);
  assert.equal(owned.instances[0].evaluation, null);
  assert.equal(owned.instances[0].angleDegrees, 0);
  assert.equal(owned.source, source);
  const cold = compileCadModel(source, { sourceVersion: 0 });
  assert.equal(cold.ok, true, `${item.key}: ${JSON.stringify(cold.diagnostics)}`);
  assert.deepEqual(cold.model, owned.model);
  assert.deepEqual(cold.model.objects, owned.instances.map(member => member.geometry));
  assert.equal(cold.model.objects.length, item.count);
  if (item.count <= 4) verifyPreview(source, cold.model.objects);
  else { assert.throws(() => parseBaroCadSource(source, options), /1\.\.4 total native objects/); directRefusals++; }
  assert.equal(item.pairs.length, item.count - 1);
  for (const pair of item.pairs) {
    const pairBytes = local(pair.file);
    assert.equal(digest(pairBytes), pair.sha256);
    assert.deepEqual(pairBytes, readFileSync(resolve(evidence, `${item.key}.actual-copy_${pair.index}.source0.css`)));
    const member = owned.instances[pair.index];
    assert.equal(member.geometryId, item.ids[pair.index]);
    assert.equal(member.angleDegrees, pair.index * item.options.angleStepDegrees);
    assert.deepEqual(member.matrix, item.matrices[pair.index]);
    assert.deepEqual(member.evaluation.original, owned.original);
    assert.deepEqual(member.evaluation.geometry, member.geometry);
    assert.equal(member.evaluation.report.handedness, 'preserved');
    assert.deepEqual(member.evaluation.matrix, member.matrix);
    for (const observation of [member.evaluation.report.observations[0], member.evaluation.report.observations.at(-1)]) {
      if (observation.kind === 'curve') {
        assert.deepEqual(evaluateCurve(owned.original, observation.parameter), observation.originalPointMM);
        assert.deepEqual(evaluateCurve(member.geometry, observation.parameter), observation.actualPointMM);
        if (observation.originalD1.status === 'evaluated') assert.deepEqual(evaluateCurveD1(owned.original, observation.parameter), observation.originalD1.value);
        if (observation.targetD1.status === 'evaluated') assert.deepEqual(evaluateCurveD1(member.geometry, observation.parameter), observation.targetD1.value);
      } else {
        assert.deepEqual(evaluateSurface(owned.original, observation.u, observation.v), observation.originalPointMM);
        assert.deepEqual(evaluateSurface(member.geometry, observation.u, observation.v), observation.actualPointMM);
        if (observation.originalD1.status === 'evaluated') assert.deepEqual(evaluateSurfaceD1(owned.original, observation.u, observation.v), observation.originalD1.value);
        if (observation.targetD1.status === 'evaluated') assert.deepEqual(evaluateSurfaceD1(member.geometry, observation.u, observation.v), observation.targetD1.value);
      }
    }
    verifyPreview(pairBytes.toString('utf8'), [owned.original, member.geometry]);
    pairCount++;
  }
  accepted.push({ key: item.key, source, count: item.count, ids: item.ids,
    normalizedAxis: item.normalizedAxis, angleStepDegrees: item.options.angleStepDegrees,
    derivativeRefusals: report.derivativeRefusalCount });
}
assert.equal(accepted.length, 7);
assert.equal(accepted.reduce((n, item) => n + item.count, 0), 25);
assert.equal(pairCount, 18);
assert.equal(directRefusals, 2);
assert.ok(Object.is(manifest.cases[0].options.axisDirection[1], -0));
const sourcesBefore = accepted.map(item => item.source);
const tampered = JSON.parse(readFileSync(resolve(evidence, 'offset_positive90.owned-circular-pattern.json')));
tampered.instances[1].angleDegrees = 37;
const attempts = [
  () => parseBaroCadSource('@model invalid {}', options),
  () => parseBaroCadSource(accepted[0].source, { ...options, sourceVersion: 1 }),
  () => parseBaroCadSource(accepted[0].source, { ...options, curveDisplay: { ...options.curveDisplay, version: 2 } }),
  () => parseBaroCadSource(accepted[0].source, { ...options, curveDisplay: { ...options.curveDisplay, maxSegments: 4093 } }),
  () => validateCircularGeometryPattern(tampered),
];
for (const attempt of attempts) assert.throws(attempt);
assert.deepEqual(accepted.map(item => item.source), sourcesBefore);
console.log(JSON.stringify({ nativeCases: 7, nativeMembers: 25, pairSources: pairCount, directFiveMemberRefusals: directRefusals,
  otherRefusals: attempts.length, accepted: accepted.map(({ source, ...item }) => item),
  nativeSourcesRetained: true, displayOptions: options, targetProof: 'separate actual headed Pixi3D browser flow' }));
