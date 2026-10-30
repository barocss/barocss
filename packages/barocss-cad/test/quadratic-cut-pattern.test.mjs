import test from 'node:test';
import assert from 'node:assert/strict';
import { part, planCurveFeaturePatternPath, BarocssError } from '../dist/api/index.js';
import { evaluateCadPart, checkBrep, massPropertiesOf, saveCadPart, loadCadPart } from '../dist/index.js';
import { curveCutOffsets } from '../dist/features/curve-cut-pattern.js';
import { planQuadraticCut } from '../dist/features/quadratic-cut-plan.js';
import { QuadraticCutWork } from '../dist/features/quadratic-cut-arithmetic.js';
import { quadraticOracle } from './helpers/quadratic-cut-oracle.mjs';
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const path = (points = [[0, 0], [20, 0], [20, 20]], z = 0) => ({ degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: points.map(p => [...p, z]), weights: [1, 1, 1] });
const refused = fn => assert.throws(fn, e => e instanceof BarocssError && e.code === 'VALUE');
function seed() { return { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
  { id: 'stockSketch', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] }, { id: 'stock', kind: 'extrude', sketch: 'stockSketch', height: 10 },
  { id: 'toolSketch', kind: 'sketch', profile: 'rectangle', min: [0, 6], max: [3, 11] }, { id: 'tool', kind: 'extrude', sketch: 'toolSketch', height: 10 },
  { id: 'position', kind: 'translate', target: 'tool', offset: [7, 0, 0] }, { id: 'seed', kind: 'difference', target: 'stock', tool: 'position' },
] }; }

test('quadratic cut: three independent certified placement balls, nonchord offsets and bounded length intervals', () => {
  for (const oracle of quadraticOracle) {
    const raw = path(oracle.points), before = structuredClone(raw), plan = planCurveFeaturePatternPath(raw, 10, 3);
    assert.deepEqual(Object.keys(plan).sort(), ['length', 'offsets']); assert.deepEqual(plan.offsets[0], [0, 0, 0]);
    assert.ok(plan.length.lower <= oracle.totalLength[1] && plan.length.upper >= oracle.totalLength[0]);
    assert.ok(plan.length.lower <= plan.length.estimate && plan.length.estimate <= plan.length.upper);
    oracle.offsets.forEach((o, k) => assert.ok(Math.hypot(plan.offsets[k + 1][0] - o.offset[0], plan.offsets[k + 1][1] - o.offset[1]) <= 2.5e-8 + o.worldEuclideanResidualUpper));
    assert.deepEqual(raw, before); assert.deepEqual(curveCutOffsets(raw, 10, 3, 10000, fail), plan.offsets);
  }
  const p = planCurveFeaturePatternPath(path(), 10, 3); assert.ok(p.offsets[1][1] < 2); // A chord approximation would have y=10/sqrt(2).
});

test('quadratic cut: asymmetric fixed tool corners, names, mass and editable native round trip', () => {
  for (const oracle of [quadraticOracle[0], quadraticOracle[2]]) {
    const raw = path(oracle.points), original = seed(), before = structuredClone(original), model = part('curved cut', original).curveFeaturePattern({ path: raw, spacing: 10, count: 3 });
    const out = evaluateCadPart(model.doc), check = output => {
      assert.equal(output.outputs.length, 1); const body = output.outputs[0], mass = massPropertiesOf(body, 1), report = checkBrep(body.brep, { strict: true });
      assert.equal(report.valid, true, report.issues.join('\n')); assert.equal(body.bodyCount, 1); assert.ok(body.brep.shells.every(s => s.closed));
      assert.ok(Math.abs(mass.volume - 23550) <= 1e-7);
      mass.centroid.forEach((x, k) => assert.ok(Math.abs(x - oracle.stockMinusThreeCutsGuide.centroid[k]) <= 1e-9));
      const names = body.brep.faces.map(f => f.name); assert.equal(new Set(names).size, names.length);
      const offsets = [[0, 0], ...oracle.offsets.map(o => o.offset)];
      offsets.forEach(([dx, dy], k) => {
        for (let side = 0; side < 4; side++) assert.ok(names.includes(`tool.side${side}${k ? `@${k}` : ''}`));
        for (const x of [7 + dx, 10 + dx]) for (const y of [6 + dy, 11 + dy]) for (const z of [0, 10]) assert.ok(body.brep.vertices.some(v => Math.hypot(v.point[0] - x, v.point[1] - y, v.point[2] - z) <= 4e-8));
      }); return names.sort();
    };
    const names = check(out), back = loadCadPart(saveCadPart(out)); assert.deepEqual(back.document, out.document); assert.deepEqual(check(back), names); assert.deepEqual(original, before);
  }
});

test('quadratic cut: represented translation, constant nonzero Z and nonunit clamped domain preserve offsets', () => {
  const initial = path(), base = planCurveFeaturePatternPath(initial, 10, 3), shifted = path([[3.25, -7.5], [23.25, -7.5], [23.25, 12.5]], 17.25);
  shifted.knots = [-2, -2, -2, 7.25, 7.25, 7.25]; assert.deepEqual(planCurveFeaturePatternPath(shifted, 10, 3).offsets, base.offsets);
  const large = path([[0, 0], [10000, 0], [10000, 10000]]); const early = planCurveFeaturePatternPath(large, 10, 3);
  assert.equal(early.offsets.length, 3); assert.ok(early.length.upper - early.length.lower > 1e-7); // Tail precision is not required for early targets.
});

test('quadratic cut: count one validates geometry; signed spacing and endpoint uncertainty fail atomically', () => {
  const raw = path(), before = structuredClone(raw); assert.deepEqual(planCurveFeaturePatternPath(raw, 10000, 1).offsets, [[0, 0, 0]]);
  for (const spacing of [0, -1, NaN, Infinity, 10001]) refused(() => planCurveFeaturePatternPath(raw, spacing, 3));
  for (const count of [0, 1.5, 65]) refused(() => planCurveFeaturePatternPath(raw, 1, count));
  refused(() => planCurveFeaturePatternPath(raw, 17, 3));
  refused(() => planCurveFeaturePatternPath(raw, 32.46450480280461, 2)); // An uncertified near-endpoint Number must not clamp.
  assert.deepEqual(raw, before); assert.equal(planCurveFeaturePatternPath(raw, 10, 3).offsets.length, 3);
});

test('quadratic cut: cusp, collinear nonmidpoint, rational, curved multispan and varying Z remain refused', () => {
  const variants = [path([[0, 0], [20, 0], [0, 0]]), path([[0, 0], [0, 0], [20, 0]]), path([[0, 0], [3, 0], [20, 0]]), { ...path(), weights: [1, .5, 1] }, { ...path(), controlPoints: [[0, 0, 0], [20, 0, 1], [20, 20, 0]] }, { degree: 2, knots: [0, 0, 0, 1, 1, 2, 2, 2], controlPoints: [[0, 0, 0], [20, 0, 0], [20, 20, 0], [30, 20, 0], [40, 20, 0]], weights: [1, 1, 1, 1, 1] }];
  for (const raw of variants) { const before = structuredClone(raw); refused(() => planCurveFeaturePatternPath(raw, 1, 1)); assert.deepEqual(raw, before); }
});

test('quadratic cut: owned plain numeric descriptors reject getters, sparse arrays and unknown frame fields', () => {
  let called = 0; const getter = () => { called++; throw Error('getter must not execute'); };
  for (const raw of [Object.defineProperty(path(), 'degree', { get: getter }), Object.defineProperty(path(), 'controlPoints', { get: getter }), { ...path(), frame: {} }, { ...path(), weights: [1, , 1] }, { ...path(), extra: 0 }]) refused(() => planCurveFeaturePatternPath(raw, 10, 3));
  const nested = path(); Object.defineProperty(nested.controlPoints[1], '0', { get: getter }); refused(() => planCurveFeaturePatternPath(nested, 10, 3));
  assert.equal(called, 0); const raw = path(), first = planCurveFeaturePatternPath(raw, 10, 3); raw.controlPoints[1][0] = 18; assert.notDeepEqual(planCurveFeaturePatternPath(raw, 10, 3).offsets, first.offsets);
});

test('quadratic cut: legacy query gives genuine norm bounds while preserving old Number admission and offsets', () => {
  const raw = { degree: 1, knots: [0, 0, 1, 2, 2], controlPoints: [[0, 0, 0], [1, 0, 0], [1, .1, 0]], weights: [1, 1, 1] };
  const p = planCurveFeaturePatternPath(raw, 1.1, 2); assert.deepEqual(p.offsets, [[0, 0, 0], [1, .1, 0]]); assert.equal(p.length.estimate, 1.1); assert.ok(p.length.lower <= 1.1 && p.length.upper >= 1.1);
  refused(() => planCurveFeaturePatternPath(raw, 1.1000000000000003, 2));
  const diagonal = { degree: 1, knots: [0, 0, 1, 1], controlPoints: [[0, 0, 0], [1, 1, 0]], weights: [1, 1] }, d = planCurveFeaturePatternPath(diagonal, 1, 2); assert.ok(d.length.lower ** 2 <= 2 && d.length.upper ** 2 >= 2); assert.equal(d.length.estimate, Math.SQRT2);
});

test('quadratic cut: scalar directed conversion covers signed underflow, ties, carry and the same pre-operation budget', () => {
  const w = new QuadraticCutWork(fail);
  assert.equal(w.number({ n: (1n << 53n) + 1n, e: -53 }), 1); assert.equal(w.number({ n: (1n << 53n) + 3n, e: -53 }), 1 + 2 ** -51);
  assert.equal(w.number({ n: (1n << 54n) - 1n, e: -53 }), 2);
  assert.equal(w.number({ n: 1n, e: -1075 }), 0); assert.ok(Object.is(w.number({ n: -1n, e: -1075 }), -0)); assert.ok(Object.is(w.number({ n: -1n, e: -1075 }, 'up'), -0));
  assert.equal(w.number({ n: 1n, e: -1075 }, 'up'), Number.MIN_VALUE); assert.equal(w.number({ n: -1n, e: -1075 }, 'down'), -Number.MIN_VALUE);
  const exhausted = new QuadraticCutWork(fail); exhausted.take(200000); assert.throws(() => exhausted.number({ n: 1n, e: 0 }), /budget/); assert.equal(exhausted.counts.operations, 200000);
});

test('quadratic cut: all63 added ordinary placements share one bounded work owner', () => {
  const result = planQuadraticCut(path().controlPoints, .5, 64, 10000, fail);
  assert.equal(result.offsets.length, 64); assert.ok(result.work.operations <= 200000); assert.ok(result.work.maximumIntegerBits <= 8192); assert.ok(result.work.speedEvaluations <= 16384); assert.ok(result.work.subdivisions <= 512); assert.ok(result.work.integrationDepth <= 16);
  assert.equal(planCurveFeaturePatternPath(path(), .5, 64).offsets.length, 64);
});


test('quadratic cut: legacy63-pole trailing-zero normalization stays outside the charged query path', () => {
  const raw = { degree: 2, controlPoints: Array.from({ length: 63 }, (_, i) => [i / 2, .5, .5]), weights: Array(63).fill(1), knots: [0, 0, 0] };
  for (let i = 1; i < 31; i++) raw.knots.push(i, i); raw.knots.push(31, 31, 31);
  const before = structuredClone(raw), result = planCurveFeaturePatternPath(raw, .25, 64);
  assert.equal(result.length.estimate, 31); assert.ok(result.length.lower <= 31 && result.length.upper >= 31);
  assert.deepEqual(result.offsets, Array.from({ length: 64 }, (_, i) => [i / 4, 0, 0]));
  assert.deepEqual(result.offsets, curveCutOffsets(raw, .25, 64, 10000, fail)); assert.deepEqual(raw, before);
  const rational = { ...path([[0, 0], [10, 0], [20, 0]]), weights: [1, 2, 1] }; refused(() => planCurveFeaturePatternPath(rational, 1, 2));
  const nonC0 = { degree: 2, knots: [0, 0, 0, 1, 2, 3, 3, 3], controlPoints: [[0, 0, 0], [5, 0, 0], [10, 0, 0], [15, 0, 0], [20, 0, 0]], weights: [1, 1, 1, 1, 1] };
  refused(() => planCurveFeaturePatternPath(nonC0, 1, 2));
});

test('quadratic cut: out-of-range numeric array keys are unknown fields, including accessors', () => {
  let calls = 0;
  for (const property of ['4294967295', '9007199254740993', '99999999999999999999999999999']) {
    for (const field of ['knots', 'weights', 'controlPoints']) {
      const raw = path(); Object.defineProperty(raw[field], property, { get: () => { calls++; return 1; } });
      refused(() => planCurveFeaturePatternPath(raw, 10, 3));
    }
    const raw = path(); Object.defineProperty(raw.controlPoints[1], property, { value: 0 }); refused(() => planCurveFeaturePatternPath(raw, 10, 3));
  }
  assert.equal(calls, 0);
});

test('quadratic cut: small signed reflections and XY swap respect independent certified placement balls', () => {
  const source = quadraticOracle[1], scale = .125;
  for (const transform of [([x, y]) => [-x, y], ([x, y]) => [y, x], ([x, y]) => [-y, -x]]) {
    const points = source.points.map(p => transform(p).map(x => x * scale)), result = planCurveFeaturePatternPath(path(points, -.5), 10 * scale, 3);
    source.offsets.forEach((value, index) => {
      const expected = transform(value.offset).map(x => x * scale);
      assert.ok(Math.hypot(result.offsets[index + 1][0] - expected[0], result.offsets[index + 1][1] - expected[1]) <= 2.5e-8 + value.worldEuclideanResidualUpper * scale);
    });
    assert.ok(result.length.lower <= source.totalLength[1] * scale && result.length.upper >= source.totalLength[0] * scale);
  }
});
