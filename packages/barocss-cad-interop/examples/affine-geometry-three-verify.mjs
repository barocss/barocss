import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileCadModel, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface,
  evaluateCurveD1, evaluateSurfaceD1, validateAffineGeometryTransform } from '@barocss/cad';
import { parseBaroCadSource } from '../dist/native.js';
import { BaroCADLoader } from '../dist/three.js';

assert.equal(process.argv.length, 3, 'Usage: node affine-geometry-three-verify.mjs <CAD-958-demo-output-directory>');
const evidence = resolve(process.argv[2]);
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 } };
const hashes = {
  identity_rational_curve: '1b13d316e0aa4679cdcb2b796e37678864ab4713456db4a37f88e53a6be1f0de',
  mirror_translated_quarter: 'c3ddfc7b69f90ae579336ec9ff26621dcc19078a13a66b7ef5581a09098b1c48',
  rotation90_translated_cubic: '7db8d28c03bc9dd1ab7a8b349569ed795256a04c1dbd5a16a3e3fc8c33555ee6',
  maximum64_curve_c0: '1681363adc63ba8176a8c4f9cbd4e9ec7ad352df1df6013cbba83c17a1ad207a',
  sheared_scaled_plane: '8743556157c41b4cc9761239ff21a6b7a889d851bd57f1d5dc1861060ad3fb59',
  reflected_plane_parity: '4dc48bf83b2325729056a7920655d9935068bdcb9ae8b9c7d632e63f325aa728',
  maximum16_by16_surface_c0: 'd05872aa94f8f5e085d15fd517fd4c3ac4b7b109f32526bdbac4920ae8e332f4',
};
const loader = new BaroCADLoader(options);
const accepted = [];
for (const [key, expectedHash] of Object.entries(hashes)) {
  const bytes = readFileSync(new URL(`./affine-geometry-three-data/${key}.barocad`, import.meta.url));
  const originalBytes = readFileSync(resolve(evidence, `${key}.source0.css`));
  const source = bytes.toString('utf8');
  const authored = JSON.parse(readFileSync(resolve(evidence, `${key}.authored-transform.json`), 'utf8'));
  const owned = JSON.parse(readFileSync(resolve(evidence, `${key}.owned-affine-transform.json`), 'utf8'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expectedHash);
  assert.deepEqual(bytes, originalBytes, `${key} original source bytes`);
  assert.deepEqual({ original: owned.original, matrix: owned.matrix, options: owned.options }, authored);
  assert.deepEqual(validateAffineGeometryTransform(owned), owned.report);
  assert.equal(source, owned.source);
  assert.equal(owned.sourceVersion, 0);
  assert.equal(owned.geometry.id, `${key}_target`);
  assert.notEqual(owned.original.id, owned.geometry.id);
  assert.equal(owned.report.originalId, owned.original.id);
  assert.equal(owned.report.geometryId, owned.geometry.id);
  assert.equal(owned.report.handedness, owned.report.determinant < 0 ? 'reversed' : 'preserved');
  const cold = compileCadModel(source, { sourceVersion: 0 });
  assert.equal(cold.ok, true, `${key} cold compile: ${JSON.stringify(cold.diagnostics)}`);
  assert.deepEqual(cold.model, owned.model);
  assert.deepEqual(cold.model.objects, [owned.original, owned.geometry]);
  for (const observation of [owned.report.observations[0], owned.report.observations.at(-1)]) {
    if (observation.kind === 'curve') {
      assert.deepEqual(evaluateCurve(owned.original, observation.parameter), observation.originalPointMM);
      assert.deepEqual(evaluateCurve(owned.geometry, observation.parameter), observation.actualPointMM);
      if (observation.originalD1.status === 'evaluated')
        assert.deepEqual(evaluateCurveD1(owned.original, observation.parameter), observation.originalD1.value);
      if (observation.targetD1.status === 'evaluated')
        assert.deepEqual(evaluateCurveD1(owned.geometry, observation.parameter), observation.targetD1.value);
    } else {
      assert.deepEqual(evaluateSurface(owned.original, observation.u, observation.v), observation.originalPointMM);
      assert.deepEqual(evaluateSurface(owned.geometry, observation.u, observation.v), observation.actualPointMM);
      if (observation.originalD1.status === 'evaluated')
        assert.deepEqual(evaluateSurfaceD1(owned.original, observation.u, observation.v), observation.originalD1.value);
      if (observation.targetD1.status === 'evaluated')
        assert.deepEqual(evaluateSurfaceD1(owned.geometry, observation.u, observation.v), observation.targetD1.value);
    }
  }
  const neutral = parseBaroCadSource(source, options);
  assert.deepEqual(neutral.model, cold.model);
  assert.deepEqual(neutral.unrenderedCurveIds, []);
  const display = loader.parse(source);
  assert.equal(display.group.children.length, 2);
  for (const [index, native] of [owned.original, owned.geometry].entries()) {
    const object = display.group.children[index];
    assert.equal(object.name, native.id);
    if (native.kind === 'curve') {
      assert.equal(object.type, 'Line');
      assert.deepEqual(curveDomain(native), owned.report.domains.curve);
      const preview = neutral.curves[index];
      assert.equal(preview.curveId, native.id);
      assert.equal(object.userData.barocss.curveId, native.id);
      assert.deepEqual(object.userData.barocss.nativeParameters, preview.sample.parameters);
      assert.deepEqual(Array.from(object.geometry.getAttribute('position').array), Array.from(preview.positions));
    } else {
      assert.equal(object.type, 'Mesh');
      assert.deepEqual(surfaceDomain(native), { u: owned.report.domains.u, v: owned.report.domains.v });
      const preview = neutral.surfaces[index];
      assert.equal(preview.surfaceId, native.id);
      assert.equal(object.userData.surfaceId, native.id);
      assert.equal(preview.report.vertexCount, 64);
      assert.equal(preview.report.triangleCount, 98);
      for (const [attribute, values] of [['position', preview.mesh.positions], ['normal', preview.mesh.normals],
        ['_CAD_UV', preview.mesh.parameters]])
        assert.deepEqual(Array.from(object.geometry.getAttribute(attribute).array), Array.from(values));
      assert.deepEqual(Array.from(object.geometry.getIndex().array), Array.from(preview.mesh.indices));
    }
  }
  accepted.push({ key, source, kind: owned.geometry.kind, originalId: owned.original.id,
    targetId: owned.geometry.id, determinant: owned.report.determinant,
    originalSamples: neutral.curves[0]?.sample.pointsMM.length ?? null,
    targetSamples: neutral.curves[1]?.sample.pointsMM.length ?? null,
    derivativeRefusals: owned.report.derivativeRefusalCount });
  display.dispose();
  display.dispose();
}
assert.equal(accepted.length, 7);
assert.deepEqual(accepted.map(item => item.kind), ['curve', 'curve', 'curve', 'curve', 'surface', 'surface', 'surface']);
assert.deepEqual(accepted.slice(0, 4).map(item => [item.originalSamples, item.targetSamples]),
  [[5, 5], [5, 5], [11, 11], [64, 64]]);
assert.equal(accepted.filter(item => item.determinant < 0).length, 2);
assert.equal(accepted.find(item => item.key === 'maximum16_by16_surface_c0').derivativeRefusals, 672);
const acceptedSources = accepted.map(item => item.source);
const owned = JSON.parse(readFileSync(resolve(evidence, 'mirror_translated_quarter.owned-affine-transform.json'), 'utf8'));
const refusals = [
  () => loader.parse('@model invalid {}'),
  () => new BaroCADLoader({ ...options, sourceVersion: 1 }).parse(accepted[0].source),
  () => new BaroCADLoader({ ...options, countU: 1 }).parse(accepted[4].source),
  () => new BaroCADLoader({ ...options, curveDisplay: { ...options.curveDisplay, maxSegments: 4093 } }).parse(accepted[0].source),
  () => validateAffineGeometryTransform({ ...owned, report: { ...owned.report, geometryId: 'forged' } }),
];
for (const candidate of refusals) assert.throws(candidate);
assert.deepEqual(accepted.map(item => item.source), acceptedSources);
console.log(JSON.stringify({ parentCadIssue: 958, displayOptions: options,
  accepted: accepted.map(({ key, kind, originalId, targetId, determinant, originalSamples, targetSamples,
    derivativeRefusals }) => ({ key, kind, originalId, targetId, determinant, originalSamples,
    targetSamples, derivativeRefusals })), previewPairs: 7, previewRefusals: 0,
  otherRefusals: refusals.length, acceptedRetained: true }));
