import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from 'node:inspector';
import { evaluateCadPart, booleanAnalytic, brepMassProperties, cutPiece, cutList, cutListCsv, massPropertiesOf, checkOutput } from '../dist/index.js';

const ROUND = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 6 };
const A = 1600 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9);
const frame = (more = {}) => ({
  id: 't', kind: 'frame', section: ROUND, corners: { multi: 'order' },
  points: [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0], [0, 0, 700], [600, 0, 700], [600, 400, 700], [0, 400, 700]],
  segments: [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]], ...more,
});
const run = f => evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [f] });
const volume = o => massPropertiesOf(o).volume;
const near = (got, want, label) => assert.ok(Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want)), `${label}: ${got} vs ${want}`);

// Observe the real private dispatch without adding a product API or replacing a
// Boolean. Four table corners need 12 member subtractions, with no envelope
// subtractions. The general route adds one envelope subtraction per corner.
async function observedBuild(f) {
  const inspector = new Session(); inspector.connect();
  const post = (method, params = {}) => new Promise((yes, no) => inspector.post(method, params, (e, r) => e ? no(e) : yes(r)));
  try {
    await post('Profiler.enable');
    await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    const snapshot = run(f); snapshot.outputs.forEach(o => o.brep);
    const coverage = await post('Profiler.takePreciseCoverage');
    const module = coverage.result.find(s => s.url.endsWith('/part-model.js'));
    assert.ok(module, 'observe the actual compiled part-model module');
    const dispatch = module.functions.find(f => f.functionName === 'boolean');
    assert.ok(dispatch, 'observe the actual Boolean dispatcher');
    return { snapshot, booleans: dispatch.ranges[0].count };
  } finally {
    await post('Profiler.stopPreciseCoverage'); inspector.disconnect();
  }
}

const GL5 = [[-.906179845938664, .2369268850561891], [-.5384693101056831, .4786286704993665], [0, .5688888888888889], [.5384693101056831, .4786286704993665], [.906179845938664, .2369268850561891]];
const gauss = (f, a, b) => {
  let sum = 0; const step = (b - a) / 400;
  for (let i = 0; i < 400; i++) for (const [x, w] of GL5) sum += w * step / 2 * f(a + step * (i + .5 + x / 2));
  return sum;
};
// s = end - t², ds = -2t dt. Pass t directly so a removable square root
// need not be recovered from the rounded subtraction end - s.
const gaussRootEnd = (f, start, end) => gauss(t => 2 * t * f(end - t * t, t), 0, Math.sqrt(end - start));
function roundEndOracles() {
  // D126's independent corner quadrature: the volume beyond a flat 20mm cut.
  const outer = gauss(t => 2 * (14 + 6 * Math.cos(t)) * (6 - 6 * Math.cos(t)) * 6 * Math.cos(t), 0, Math.PI / 2);
  const bore = gauss(t => 2 * (14 + 3 * Math.cos(t)) * (6 - Math.sqrt(36 - (3 * Math.sin(t)) ** 2)) * 3 * Math.cos(t), 0, Math.PI / 2);
  const bonus = 2 * (outer - bore);
  const H = s => s <= 14 ? 20 : 14 + Math.sqrt(Math.max(0, 36 - (s - 14) ** 2));
  const J = s => {
    if (s <= 14) return 20 * s;
    const t = s - 14;
    return 280 + 14 * t + (t * Math.sqrt(Math.max(0, 36 - t * t)) + 36 * Math.asin(t / 6)) / 2;
  };
  // A last-ranked rail first loses the leg, y<=H(s). The earlier rail on
  // s>=0 then takes [H(|z|)-H(s)]+. Integrate that over the tube wall using
  // J'=H. ±z gives factor2; the earlier rail occupies only the positive s side.
  const active = 14 + 3 / Math.SQRT2, cross = 14 + 3 * Math.SQRT2;
  // Splitting at17/20 alone leaves square-root endpoints. Remove them using
  // exact substitutions, preserving the physical integral and400 panels.
  const left = gaussRootEnd((s, t) => {
    const lo = 14 + t * Math.sqrt(6 - t * t);
    return 2 * (J(s) - J(lo) - H(s) * (s - lo));
  }, active, 17);
  // The bore is absent on this whole branch, including its right-hand limit
  // at17. Do not reuse the left branch's lo(17)=14 in a derivative bound.
  const middle = gauss(s => 2 * (J(s) - H(s) * s), 17, cross);
  const right = gaussRootEnd((_, t) => {
    const hi = 14 + t * Math.sqrt(12 - t * t);
    return 2 * (J(hi) - hi * hi);
  }, cross, 20);
  const delta = left + middle + right;
  return { bonus, delta };
}

test('FRk6 oracle endpoint substitution agrees with independent constant and square-root antiderivatives', () => {
  for (const [start, end] of [[14 + 3 / Math.SQRT2, 17], [14 + 3 * Math.SQRT2, 20]]) {
    const span = end - start;
    for (const [got, want] of [[gaussRootEnd(() => 1, start, end), span], [gaussRootEnd((_, t) => t, start, end), 2 * span ** 1.5 / 3]]) {
      assert.ok(Math.abs(got - want) <= 1e-12 * Math.max(1, Math.abs(want)), `${got} vs closed-form ${want}`);
    }
  }
});

test('FRk6 the ordinary rounded ordered table uses capped tools and preserves D126 volumes, BRep, weld sum and cut list', async t => {
  const { snapshot: s, booleans } = await observedBuild(frame());
  assert.equal(booleans, 12, 'four intermediate envelope Booleans are absent');
  const { bonus, delta } = roundEndOracles();
  assert.ok(delta > 227 && delta < 228, 'D126 leg-round sliver is retained, not removed by the opposite stub');
  const expected = [A * 720, A * 720, A * 720, A * 720, A * 560 + 2 * bonus, A * 360 + 2 * bonus - delta, A * 560 + 2 * bonus - delta, A * 360 + 2 * bonus - 2 * delta];
  assert.equal(s.outputs.length, 8);
  s.outputs.forEach((o, i) => { near(volume(o), expected[i], `member ${i}`); assert.equal(o.bodyCount, 1); assert.equal(checkOutput(o).valid, true); });
  const pieces = s.outputs.map(o => cutPiece(o)), list = cutList(pieces, { density: 7.85 });
  assert.equal(list.totals.quantity, 8);
  pieces.forEach((p, i) => { near(p.volumeMM3, expected[i], `cut piece ${i}`); assert.equal(p.fromVolume, i >= 4); });
  near(list.totals.mass, expected.reduce((a, b) => a + b, 0) * 7.85e-3, 'cut-list total mass');
  const csv = cutListCsv(list); s.outputs.forEach(o => assert.ok(csv.includes(o.id), `CSV retains ${o.id}`));
  let welded = s.outputs[0].brep;
  for (const o of s.outputs.slice(1)) welded = booleanAnalytic(welded, o.brep, 'union');
  assert.equal(welded.bodies.length, 1);
  near(brepMassProperties(welded, 1).volume, expected.reduce((a, b) => a + b, 0), 'welded table sum');
  t.diagnostic(`observed Boolean calls=${booleans}; D126 bonus=${bonus}, last-rail delta=${delta}`);
});

test('FRk6 unsafe placements and finite windows retain the general ordered-envelope route', async t => {
  const corner = { points: [[0, 0, 0], [0, 0, 700], [600, 0, 700], [0, 400, 700]], segments: [[0, 1], [1, 2], [3, 1]] };
  for (const [name, more] of [
    ['aligned control', {}],
    ['rolled second section', { overrides: [{ member: 1, roll: 45 }] }],
    ['offset second section', { overrides: [{ member: 1, offset: [.25, 0] }] }],
    ['different section width', { overrides: [{ member: 1, section: { ...ROUND, width: 38 } }] }],
    ['short first window', { points: [[0, 0, 690], ...corner.points.slice(1)] }],
  ]) {
    const { snapshot, booleans } = await observedBuild(frame({ ...corner, ...more }));
    assert.equal(booleans, name === 'aligned control' ? 3 : 4, name);
    assert.equal(snapshot.outputs.length, 3);
    t.diagnostic(`${name}: observed Boolean calls=${booleans}`);
  }
});
