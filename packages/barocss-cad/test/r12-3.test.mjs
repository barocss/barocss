import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, flatPattern } from '../dist/index.js';

// R12.3a (D118): edge flanges and their end reliefs. Oracles from the definitions, not the construction:
// - where the outer virtual sharp lands: on the edge (material inside), T·tan(θ/2) past it (material outside: the inner
//   sharp on the edge), (R + T)·tan(θ/2) past it (bend outside); the flange's outer length L to it ('outer'), L less
//   T·tan(θ/2) ('inner', to the inner sharp), L less (R + T)·tan(θ/2) ('tangent'); the flat is the outside to the sharps
//   less BD = 2(R + T)·tan(θ/2) − θ(R + K·T);
// - the volume: the plate, less what the bend takes back ((R + T)·tan(θ/2) or R·tan(θ/2) of it) and the reliefs, plus
//   the flange's section θ·T(R + T/2) + T × its straight leg, times its width;
// - the K-factor's area identity on the flat (V/T + (K − ½)·T·Σθw).
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const refused = (features, code, pattern) => assert.throws(() => out(features), e => e.code === code && pattern.test(e.message), String(pattern));
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b} (${(a - b) / Math.max(1, Math.abs(b))})`);
const T = 1.5, R = 1.5, K = 0.44, A = 80, B = 50;
const BD = (th, r = R) => 2 * (r + T) * Math.tan(th / 2) - th * (r + K * T);
const plate = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [A, B] }, { id: 'b', kind: 'sheet-base', sketch: 's', thickness: T, bendRadius: R, kFactor: K }];
// Edge side1 is x = 80 on the plate's top (its skin), from y 0 to 50.
const flange = (o = {}) => ({ id: 'fl', kind: 'sheet-flange', target: 'b', edge: 'b.side1|b.top', length: 20, ...o });

test('R12.3a an edge flange in each position, at 30°–150°, measured outer, inner or from the tangent: the textbook flat and volume', () => {
  for (const position of ['material-inside', 'material-outside', 'bend-outside']) for (const deg of [30, 90, 120, 150]) for (const measure of ['outer', 'inner', 'tangent']) {
    const th = deg * Math.PI / 180, tn = Math.tan(th / 2), o = out([...plate, flange({ angleDegrees: deg, position, measure })]);
    assert.equal(o.validate().valid, true, `${position} ${deg}° ${measure}`);
    // The outer sharp past the edge; the outer length to it; the straight leg; what the bend takes back of the plate.
    const past = position === 'material-inside' ? 0 : position === 'material-outside' ? T * tn : (R + T) * tn;
    const Lout = measure === 'outer' ? 20 : measure === 'inner' ? 20 + T * tn : 20 + (R + T) * tn, leg = Lout - (R + T) * tn;
    const taken = position === 'material-inside' ? (R + T) * tn : position === 'material-outside' ? R * tn : 0;
    const f = o.flatPattern(), what = `${position} ${deg}° ${measure}`;
    close(f.box.max[0], A + past + Lout - BD(th), 1e-12, `${what} flat length`); close(f.box.max[1], B, 1e-12, `${what} flat width`);
    close(o.massProperties(1).volumeMM3, A * B * T - taken * T * B + B * (th * T * (R + T / 2) + leg * T), 1e-11, `${what} volume`);
    assert.deepEqual(f.bends.map(b => [b.name, b.direction]), [['fl.bend', 'up']]);
    close(f.bends[0].angleDegrees, deg, 1e-9, 'angle');
  }
  // Its own radius; the report gains the bend, by its definitions.
  const o = out([...plate, flange({ bendRadius: 4 })]), b = o.sheet.bends.at(-1), th = Math.PI / 2;
  assert.deepEqual({ name: b.name, inner: b.inner, outer: b.outer, r: b.radiusMM }, { name: 'fl.bend', inner: 'fl.bend.inner', outer: 'fl.bend.outer', r: 4 });
  close(b.allowanceMM, th * (4 + K * T), 1e-12, 'BA'); close(b.deductionMM, BD(th, 4), 1e-12, 'BD');
  close(o.flatPattern().box.max[0], A + 20 - BD(th, 4), 1e-12, 'own radius');
  assert.deepEqual(b.axis.direction.map(Math.abs), [0, 1, 0]);
});

test('R12.3a part width: a rectangular, an obround or no relief at each end inside the edge — the volume by closed form, the flat by its area identity', () => {
  const th = Math.PI / 2, t = (R + T) * Math.tan(th / 2);
  for (const [relief, cut] of [[undefined, 2 * T * (t + T)], [{ kind: 'obround' }, 2 * (T * (t + T - T / 2) + Math.PI * T * T / 8)], [{ kind: 'rectangular', width: 3, depth: 2 }, 2 * 3 * (t + 2)], [{ kind: 'none' }, 0]]) {
    const o = out([...plate, flange({ offsets: [10, 25], ...(relief ? { relief } : {}) })]), V = o.massProperties(1).volumeMM3;
    // (Offsets from the edge's start (y 0) and end (y 50): the flange from y 10 to 25.)
    const fw = 50 - 10 - 25;
    assert.equal(o.validate().valid, true, JSON.stringify(relief));
    close(V, A * B * T - t * T * fw - cut * T + fw * (th * T * (R + T / 2) + (20 - t) * T), 1e-11, `volume ${JSON.stringify(relief)}`);
    const f = o.flatPattern();
    close(f.areaMM2, V / T + (K - 0.5) * T * th * fw, 1e-11, `flat area ${JSON.stringify(relief)}`);
    assert.equal(f.loops.length, 1);
  }
  // A relief wider than its offset does not fit; the offsets may not leave nothing.
  refused([...plate, flange({ offsets: [1, 0] })], 'PARAMETER', /\[BEND_DOES_NOT_FIT\] a relief 1\.5 mm wide does not fit beside the flange on b\.side1\|b\.top/);
  refused([...plate, flange({ offsets: [30, 20] })], 'PARAMETER', /\[BEND_DOES_NOT_FIT\] offsets 30 and 20 leave nothing of the 50 mm edge/);
  refused([...plate, flange({ offsets: [10, 10], relief: { kind: 'obround', width: 6, depth: 2 } })], 'PARAMETER', /an obround relief needs a depth of at least half its width/);
});

test('R12.3a a tray: four flanges in turn, each 10 mm short of the corners with its reliefs; its flat by the area identity, four bends up; reliefs that cut a corner off refused', () => {
  const g = 10, fl = (id, target, edge, along) => ({ id, kind: 'sheet-flange', target, edge, length: 20, offsets: [g, g] });
  const o = out([...plate, fl('f1', 'b', 'b.side0|b.top'), fl('f2', 'f1', 'b.side1|b.top'), fl('f3', 'f2', 'b.side2|b.top'), fl('f4', 'f3', 'b.side3|b.top')]);
  assert.equal(o.validate().valid, true);
  const V = o.massProperties(1).volumeMM3, f = o.flatPattern(), widths = 2 * (A + B) - 8 * g;
  close(f.areaMM2, V / T + (K - 0.5) * T * Math.PI / 2 * widths, 1e-11, 'tray flat');
  assert.deepEqual(f.bends.map(b => [b.name, b.direction]).sort(), [['f1.bend', 'up'], ['f2.bend', 'up'], ['f3.bend', 'up'], ['f4.bend', 'up']]);
  // The volume: each flange takes back its trim and two reliefs and adds its section.
  const t = (R + T), per = (L) => -(t * T * (L - 2 * g)) - 2 * T * T * (t + T) + (L - 2 * g) * (Math.PI / 2 * T * (R + T / 2) + (20 - t) * T);
  close(V, A * B * T + 2 * per(A) + 2 * per(B), 1e-11, 'tray volume');
  // 5 mm from the corners, two neighbours' reliefs (4.5 mm deep, 1.5 wide) cut the corner's square off the sheet.
  const g5 = (id, target, edge) => ({ id, kind: 'sheet-flange', target, edge, length: 20, offsets: [5, 5] });
  refused([...plate, g5('f1', 'b', 'b.side0|b.top'), g5('f2', 'f1', 'b.side1|b.top')], 'GEOMETRY', /\[SHEET_IN_PIECES\] the flange on b\.side1\|b\.top and its reliefs leave the sheet in 2 pieces/);
});

test('R12.3a refusals: flanges running into each other at a corner (FLANGES_COLLIDE), an edge that is not the sheet\'s (EDGE_NOT_SHEET), a target that is no sheet, a hem, a flange inside its setback, a plate too narrow for the bend', () => {
  // Two neighbouring flanges leaning in (135°, 30 long) cross each other above the corner (the S0 tray's silent overlap).
  const lean = { angleDegrees: 135, length: 30 };
  refused([...plate, flange({ id: 'f1', edge: 'b.side0|b.top', ...lean }), flange({ id: 'f2', target: 'f1', ...lean })], 'GEOMETRY', /\[FLANGES_COLLIDE\] the flange on b\.side1\|b\.top runs into the sheet: [\d.e+-]+ mm³ of it overlaps/);
  // Square, the second flange's trim 2 mm from the corner reaches the first one's bend (its setback 3 mm).
  refused([...plate, flange({ id: 'f1', edge: 'b.side0|b.top', offsets: [2, 2] }), flange({ id: 'f2', target: 'f1', offsets: [2, 2] })], 'GEOMETRY', /\[FLANGES_COLLIDE\] the flange on b\.side1\|b\.top or its cut into the plate meets the sheet's other bends or flanges: keep it at least its setback \(3 mm\)/);
  // Both to the corner, square: the first trims the plate's corner, so the second's edge is shorter — they meet nowhere.
  assert.equal(out([...plate, flange({ id: 'f1', edge: 'b.side0|b.top' }), flange({ id: 'f2', target: 'f1' })]).validate().valid, true);
  // A vertical edge of the plate; a hole's edge.
  refused([...plate, flange({ edge: 'b.side0|b.side1' })], 'PARAMETER', /\[EDGE_NOT_SHEET\] b\.side0\|b\.side1 is not an edge between the sheet's skin and its 1\.5 mm thickness/);
  const holed = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [A, B], holes: [[{ kind: 'arc', start: [45, 25], center: [40, 25], direction: 'ccw' }]] }, plate[1]];
  refused([...holed, flange({ edge: 'b.hole0.side0#1|b.top' })], 'PARAMETER', /\[EDGE_NOT_SHEET\] b\.hole0\.side0#1\|b\.top is not straight/);
  refused([...plate, flange({ edge: 'b.side9|b.top' })], 'SELECTION', /no edge named b\.side9\|b\.top/);
  refused([...plate, flange({ angleDegrees: 180 })], 'PARAMETER', /\[BEND_ANGLE\] a flange bends between 0 and 180°/);
  refused([...plate, flange({ length: 2 })], 'PARAMETER', /\[BEND_DOES_NOT_FIT\] a flange 2 mm long \(outer\) is within its bend's setback of 3 mm/);
  const narrow = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, B] }, plate[1]];
  refused([...narrow, flange()], 'PARAMETER', /\[BEND_DOES_NOT_FIT\] the sheet is 2 mm deep behind b\.side1\|b\.top; the bend takes 3 mm of it/);
});

test('R12.3a the sheet\'s report is dropped, never carried stale, past a move, a turn, a mirror, a pattern or a union: the flat then needs T and K, and a flange refuses', () => {
  const base = [...plate, flange()], ref = out(base), area = ref.flatPattern().areaMM2;
  const after = [
    { id: 'm', kind: 'translate', target: 'fl', offset: [7, -3, 11] },
    { id: 'm', kind: 'rotate', target: 'fl', axis: 'x', angleDegrees: 30 },
    { id: 'm', kind: 'mirror', target: 'fl', plane: 'yz', keep: false },
    { id: 'm', kind: 'linear-pattern', target: 'fl', axis: 'x', spacing: 200, count: 2 },
    { id: 'q', kind: 'sketch', profile: 'rectangle', min: [200, 0], max: [210, 10] }, { id: 'qe', kind: 'extrude', sketch: 'q', height: 5 },
  ];
  for (const op of [after[0], after[1], after[2], after[3]]) {
    const o = out([...base, op]);
    assert.equal(o.sheet, undefined, op.kind);
    assert.throws(() => o.flatPattern(), e => e.code === 'CAPABILITY' && /not made as sheet metal/.test(e.message), op.kind);
    refused([...base, op, { id: 'f2', kind: 'sheet-flange', target: 'm', edge: 'b.side3|b.top', length: 10 }], 'CAPABILITY', /\[NOT_A_SHEET\] the target is not sheet metal/);
  }
  // Moved or turned, the body unfolds again from its own B-rep with T and K given: the same flat.
  for (const op of [after[0], after[1]]) close(flatPattern(out([...base, op]).brep, { thicknessMM: T, kFactor: K }).areaMM2, area, 1e-11, `${op.kind} then unfolded`);
  // A union with another body: no report either.
  const u = out([...base, after[4], after[5], { id: 'u', kind: 'union', target: 'fl', tool: 'qe' }]);
  assert.equal(u.sheet, undefined);
});
