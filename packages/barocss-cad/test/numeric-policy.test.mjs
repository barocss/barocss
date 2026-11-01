import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CadNumericPolicy, chartRoundingBoundMM } from '../dist/index.js';
import { SolidProof } from '../dist/convex-planar-solid-proof-internal.js';

// createCadModel's stored-solid assets of a 22 × 20 × 10 box split at x = 3.3 (its negative part; -0 stored as "-0"),
// recorded from the build at fa79c9969 before its retirement (R7.3d).
const assetsOfA = () => JSON.parse(readFileSync(new URL('./fixtures/legacy-inputs/numeric-policy-assets.json', import.meta.url), 'utf8'), (k, v) => v === '-0' ? -0 : v);

test('policy constants match the values the kernel applies', () => {
  assert.equal(CadNumericPolicy.version, 1);
  assert.equal(CadNumericPolicy.coordinateAbs, 10000);
  assert.equal(CadNumericPolicy.linearTolerance, 1e-7);
  assert.equal(CadNumericPolicy.chartParameters, 'exact-or-one-rounding-certified-v1');
  assert.ok(Object.isFrozen(CadNumericPolicy));
  // One rounding of u in [0, 22] on a 22 mm axis moves at most ~2 ulp(22)/22 · 22 mm.
  const bound = chartRoundingBoundMM([22, 0, 0], [0, 22], [0, 0, 10], [0, 10]);
  assert.ok(bound[0] > 0 && bound[0] < 1e-13 && bound[1] === 0 && bound[2] > 0 && bound[2] < 1e-13, JSON.stringify(bound));
});

test('the stored-solid proof certifies one rounding and refuses anything larger', () => {
  const assets = assetsOfA();
  const certified = assets.map(a => { const proof = new SolidProof(); proof.plane(a.face); return { face: a.face, proof }; }).filter(x => x.proof.certifiedLifts > 0);
  assert.ok(certified.length > 0 && certified.every(x => x.proof.maximumLiftDeviationMM < 1e-12));
  const face = certified[0].face;
  // Move one stored UV pole by 1e-9 (far more than one rounding): the proof refuses.
  const tampered = structuredClone(face), pole = tampered.pcurves.flatMap(p => p.curve.controlPoints).find(c => !Number.isInteger(c[0]) || !Number.isInteger(c[1]));
  pole[Number.isInteger(pole[0]) ? 1 : 0] += 1e-9;
  assert.throws(() => new SolidProof().plane(tampered), /exceeds one chart rounding/);
});
