import test from 'node:test';
import assert from 'node:assert/strict';
import { cad, CadNumericPolicy, chartRoundingBoundMM } from '../dist/index.js';
import { SolidProof } from '../dist/convex-planar-solid-proof-internal.js';

const box = (w, d = 20, h = 10) => { const m = cad.model(); return { m, b: m.sketch.rectangle({ width: w, height: d }).extrude(h) }; };
const split = (w, at) => { const { m, b } = box(w); const s = b.split({ axis: 'x', at }); return m.build({ a: s.negative, b: s.positive }); };
const hole = (w, d, r, center = [w / 2, d / 2]) => { const m = cad.model(); const p = m.sketch.rectangle({ width: w, height: d }).extrude(5); return m.build({ p: p.hole({ center, radius: r }) }); };

test('policy constants match the values the kernel applies', () => {
  assert.equal(CadNumericPolicy.version, 1);
  assert.equal(CadNumericPolicy.coordinateAbsMM, 10000);
  assert.equal(CadNumericPolicy.linearToleranceMM, 1e-7);
  assert.equal(CadNumericPolicy.chartParameters, 'exact-or-one-rounding-certified-v1');
  assert.ok(Object.isFrozen(CadNumericPolicy));
  // One rounding of u in [0, 22] on a 22 mm axis moves at most ~2 ulp(22)/22 · 22 mm.
  const bound = chartRoundingBoundMM([22, 0, 0], [0, 22], [0, 0, 10], [0, 10]);
  assert.ok(bound[0] > 0 && bound[0] < 1e-13 && bound[1] === 0 && bound[2] > 0 && bound[2] < 1e-13, JSON.stringify(bound));
});

test('C3: integer split positions are exact on every width (no certification needed)', () => {
  for (const [w, at] of [[22, 7], [25, 7], [50, 7], [100, 33]]) {
    const s = split(w, at);
    assert.equal(s.bodies.a.native.report.pcurveLift, undefined, `${w}@${at}`);
    assert.equal(s.bodies.b.native.report.pcurveLift, undefined, `${w}@${at}`);
  }
});

test('C3: non-representable chart parameters are certified within one rounding, and the parts measure', () => {
  const s = split(22, 3.3), lift = s.bodies.a.native.report.pcurveLift ?? s.bodies.b.native.report.pcurveLift;
  assert.equal(lift.policy, 'exact-or-one-rounding-certified-v1');
  assert.ok(lift.certifiedPoles > 0 && lift.maximumDeviationMM > 0 && lift.maximumDeviationMM < 1e-12, JSON.stringify(lift));
  const a = s.massProperties('a', { densityKgPerM3: 1000 }), b = s.massProperties('b', { densityKgPerM3: 1000 });
  assert.ok(Math.abs(a.volumeMM3 + b.volumeMM3 - 22 * 20 * 10) < 1e-9);
  assert.ok(s.exportStl('a').triangleCount > 0);
});

test('C4: holes of any radius on an 80 × 40 plate (r = 5 stays exact)', () => {
  for (const r of [3, 4, 6, 3.5]) {
    const lift = hole(80, 40, r).bodies.p.native.certificate.pcurveLift;
    assert.equal(lift.policy, 'exact-or-one-rounding-certified-v1', String(r)); assert.ok(lift.maximumDeviationMM < 1e-12);
  }
  assert.equal(hole(80, 40, 5).bodies.p.native.certificate.pcurveLift, undefined);
  assert.ok(hole(100, 60, 3, [6, 6]));
});

test('the stored-solid proof certifies one rounding and refuses anything larger', () => {
  const s = split(22, 3.3), assets = s.bodies.a.native.request.assets;
  const certified = assets.map(a => { const proof = new SolidProof(); proof.plane(a.face); return { face: a.face, proof }; }).filter(x => x.proof.certifiedLifts > 0);
  assert.ok(certified.length > 0 && certified.every(x => x.proof.maximumLiftDeviationMM < 1e-12));
  const face = certified[0].face;
  // Move one stored UV pole by 1e-9 (far more than one rounding): the proof refuses.
  const tampered = structuredClone(face), pole = tampered.pcurves.flatMap(p => p.curve.controlPoints).find(c => !Number.isInteger(c[0]) || !Number.isInteger(c[1]));
  pole[Number.isInteger(pole[0]) ? 1 : 0] += 1e-9;
  assert.throws(() => new SolidProof().plane(tampered), /exceeds one chart rounding/);
});
