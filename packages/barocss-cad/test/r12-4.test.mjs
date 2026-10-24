import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, flatPattern, lookupBend, rowKFactor, bendTableProblem } from '../dist/index.js';

// R12.4 (D120): bend tables in the part. Oracles from the definitions: a row's deduction or allowance is what the flat
// must honour — the flat of an L, its legs to the outer sharp, is A + B − BD for the row's BD exactly, A + B − (2·OSSB −
// BA) for its BA; interpolation by hand from the rows' K = (BA/θ − R)/T.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const refused = (features, code, pattern) => assert.throws(() => out(features), e => (e.details?.category ?? e.code) === code && pattern.test(e.message), String(pattern));
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const OSSB = (th, R, T) => (R + T) * Math.tan(th / 2);
const T = 2, R = 3, A = 50, B = 35;
const sources = [{ id: 'shop', label: 'a shop\'s test bends (made up for the test)' }];
const L = (deg, rules, r = R) => { const th = deg * Math.PI / 180; return { id: 'c', kind: 'sheet-contour', path: [[0, 0], [A, 0], [A + B * Math.cos(th), B * Math.sin(th)]], side: 'left', width: 20, thickness: T, bendRadius: r, ...rules }; };

test('R12.4 a row\'s deduction, allowance or K is what the flat honours: A + B − BD, A + B − (2·OSSB − BA), and K by its definition', () => {
  const table = { id: 't', sources, rows: [
    { thicknessMM: 2, radiusMM: 3, angleDegrees: 90, deductionMM: 4.2, source: 'shop' },
    { thicknessMM: 2, radiusMM: 3, angleDegrees: 120, allowanceMM: 7.5, estimate: true },
    { thicknessMM: 2, radiusMM: 6, kFactor: 0.45, source: 'shop' },
  ] };
  assert.equal(bendTableProblem(table), null);
  for (const [deg, flat, r] of [[90, A + B - 4.2, R], [120, A + B - (2 * OSSB(2 * Math.PI / 3, R, T) - 7.5), R]]) {
    const o = out([L(deg, { bendTable: table }, r)]), f = o.flatPattern(), b = o.sheet.bends[0];
    close(f.box.max[0], flat, 1e-12, `${deg}° flat`);
    close(b.deductionMM, deg === 90 ? 4.2 : 2 * OSSB(2 * Math.PI / 3, R, T) - 7.5, 1e-12, `${deg}° BD in the report`);
    assert.deepEqual(b.table, { table: 't', rows: [deg === 90 ? 0 : 1], how: 'exact', estimate: deg !== 90 });
    assert.deepEqual(f.bends[0].table, b.table); close(f.bends[0].kFactor, b.kFactor, 1e-12, 'the flat\'s K');
    assert.equal(o.sheet.kFactor, undefined); assert.equal(f.kFactor, undefined);
  }
  // A K row for any angle (R 6): its K at 60° and 150°.
  for (const deg of [60, 150]) { const th = deg * Math.PI / 180, BD = 2 * OSSB(th, 6, T) - th * (6 + 0.45 * T); close(out([L(deg, { bendTable: table }, 6)]).flatPattern().box.max[0], A + B - BD, 1e-12, `K row ${deg}°`); }
  // K from BA and from BD by hand.
  close(rowKFactor(table.rows[1]), (7.5 / (2 * Math.PI / 3) - 3) / 2, 1e-15, 'K from BA');
  close(rowKFactor(table.rows[0]), ((2 * OSSB(Math.PI / 2, 3, 2) - 4.2) / (Math.PI / 2) - 3) / 2, 1e-15, 'K from BD');
});

test('R12.4 between rows: linear in R (rows for any angle), bilinear in R and the angle (a grid of four); the rows named, an estimate among them said', () => {
  const k = (r) => rowKFactor(r), grid = { id: 'g', sources, rows: [
    { thicknessMM: 2, radiusMM: 2, angleDegrees: 60, kFactor: 0.40, source: 'shop' }, { thicknessMM: 2, radiusMM: 4, angleDegrees: 60, kFactor: 0.44, source: 'shop' },
    { thicknessMM: 2, radiusMM: 2, angleDegrees: 120, allowanceMM: 5.4, source: 'shop' }, { thicknessMM: 2, radiusMM: 4, angleDegrees: 120, kFactor: 0.47, estimate: true },
  ] };
  // At R 3 and 90°: u = v = ½.
  const r = lookupBend(grid, 2, 3, Math.PI / 2), want = (k(grid.rows[0]) + k(grid.rows[1]) + k(grid.rows[2]) + k(grid.rows[3])) / 4;
  close(r.kFactor, want, 1e-15, 'bilinear'); assert.deepEqual(r.use, { table: 'g', rows: [0, 1, 2, 3], how: 'interpolated', estimate: true });
  // At R 2 exactly and 75°: along the angle only, u = 0, v = ¼; the rows of R 2 alone.
  const s = lookupBend(grid, 2, 2, 75 * Math.PI / 180);
  close(s.kFactor, 0.75 * k(grid.rows[0]) + 0.25 * k(grid.rows[2]), 1e-15, 'along the angle'); assert.deepEqual(s.use.rows, [0, 2]); assert.equal(s.use.estimate, false);
  // Rows for any angle: linear in R.
  const free = { id: 'f', sources, rows: [{ thicknessMM: 1.5, radiusMM: 1, kFactor: 0.33, source: 'shop' }, { thicknessMM: 1.5, radiusMM: 3, kFactor: 0.42, source: 'shop' }] };
  close(lookupBend(free, 1.5, 2.5, 1).kFactor, 0.33 + 0.75 * 0.09, 1e-15, 'linear in R');
  // The flat of an L at R 3, 90° on the grid: A + B − (2·OSSB − θ(R + K·T)) with that K.
  const o = out([L(90, { bendTable: grid })]), th = Math.PI / 2;
  close(o.flatPattern().box.max[0], A + B - (2 * OSSB(th, 3, 2) - th * (3 + want * 2)), 1e-12, 'flat on the grid');
});

test('R12.4 a sheet built on a table: a flange looks up its own radius and angle; the flat bend by bend; a STEP body with the table given', () => {
  const table = { id: 'p', sources, rows: [{ thicknessMM: 1.5, radiusMM: 1.5, kFactor: 0.4, source: 'shop' }, { thicknessMM: 1.5, radiusMM: 4, kFactor: 0.46, source: 'shop' }] };
  const plate = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 50] }, { id: 'b', kind: 'sheet-base', sketch: 's', thickness: 1.5, bendRadius: 1.5, bendTable: table }];
  const o = out([...plate, { id: 'f1', kind: 'sheet-flange', target: 'b', edge: 'b.side1|b.top', length: 20 }, { id: 'f2', kind: 'sheet-flange', target: 'f1', edge: 'b.side3|b.top', length: 20, bendRadius: 4 }]);
  const f = o.flatPattern(), th = Math.PI / 2, BD = (r, k) => 2 * (r + 1.5) - th * (r + k * 1.5);
  close(f.box.max[0], 80 + 20 - BD(1.5, 0.4) + 20 - BD(4, 0.46), 1e-12, 'flat with two radii');
  assert.deepEqual(f.bends.map(b => [b.name, +b.kFactor.toFixed(12)]).sort(), [['f1.bend', 0.4], ['f2.bend', 0.46]]);
  const back = flatPattern(evaluateCadPart(D([{ id: 'i', kind: 'import', step: o.exportStep() }])).outputs[0].brep, { thicknessMM: 1.5, bendTable: table });
  close(back.box.max[0], f.box.max[0], 1e-9, 'through STEP');
});

test('R12.4 refusals: a bend outside the table (BEND_TABLE_MISS: no row of its T, outside its R or angle), a table with a row unsourced, given twice, out of the sheet; a K and a table both, or neither', () => {
  const table = { id: 't', sources, rows: [{ thicknessMM: 2, radiusMM: 3, angleDegrees: 90, deductionMM: 4.2, source: 'shop' }, { thicknessMM: 2, radiusMM: 3, angleDegrees: 120, kFactor: 0.42, source: 'shop' }] };
  refused([L(60, { bendTable: table })], 'PARAMETER', /\[BEND_TABLE_MISS\] bend1: table t has no rows round 2 mm, R 3 mm, 60° \(an exact row, or rows either side in R and in the angle\)/);
  refused([L(90, { bendTable: table }, 5)], 'PARAMETER', /\[BEND_TABLE_MISS\] bend1: table t has no rows round 2 mm, R 5 mm, 90°/);
  refused([{ ...L(90, { bendTable: table }), thickness: 3 }], 'PARAMETER', /\[BEND_TABLE_MISS\] bend1: table t has no row for 3 mm/);
  const bad = (rows, sources_ = sources) => refused([L(90, { bendTable: { id: 'x', sources: sources_, rows } })], 'PARAMETER', /\[BEND_TABLE\]/);
  bad([{ thicknessMM: 2, radiusMM: 3, kFactor: 0.4 }]);
  bad([{ thicknessMM: 2, radiusMM: 3, kFactor: 0.4, source: 'nobody' }]);
  bad([{ thicknessMM: 2, radiusMM: 3, kFactor: 0.4, source: 'shop' }, { thicknessMM: 2, radiusMM: 3, kFactor: 0.45, source: 'shop' }]);
  bad([{ thicknessMM: 2, radiusMM: 3, allowanceMM: 40, angleDegrees: 90, source: 'shop' }]);
  bad([{ thicknessMM: 2, radiusMM: 3, allowanceMM: 5 }]);
  assert.equal(bendTableProblem({ id: 'x', sources, rows: [{ thicknessMM: 2, radiusMM: 3, deductionMM: 4, source: 'shop' }] }), 'row 0: an allowance or a deduction holds at an angle: give angleDegrees');
  refused([L(90, { kFactor: 0.4, bendTable: table })], 'PARAMETER', /give the sheet a kFactor or a bendTable \(one of them\)/);
  refused([L(90, {})], 'PARAMETER', /give the sheet a kFactor or a bendTable \(one of them\)/);
  // A flange whose radius the table lacks.
  const plate = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 50] }, { id: 'b', kind: 'sheet-base', sketch: 's', thickness: 2, bendRadius: 3, bendTable: table }];
  refused([...plate, { id: 'fl', kind: 'sheet-flange', target: 'b', edge: 'b.side1|b.top', length: 20, bendRadius: 7 }], 'PARAMETER', /\[BEND_TABLE_MISS\] the flange: table t has no rows round 2 mm, R 7 mm, 90°/);
  // The kernel's flat with a table that misses a bend of the body.
  const o = out([L(90, { kFactor: 0.4 })]);
  assert.throws(() => flatPattern(o.brep, { thicknessMM: 2, bendTable: { id: 'y', sources, rows: [{ thicknessMM: 2, radiusMM: 9, kFactor: 0.4, source: 'shop' }] } }), e => e.code === 'BEND_TABLE_MISS' && /a bend of R 3 mm, 90°: table y has no rows round/.test(e.message));
});
