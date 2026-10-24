import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkFit, fitLimits, lookupFit, fitTableProblem, faceGeometry, FitError, outputOf } from '../dist/index.js';

// R12c.2 (D155): fits from the user's tables, never computed (D139 S0: ISO 286's factor reproduces 55 of 91 IT values).
// Oracles written here:
// - https://en.wikipedia.org/wiki/Engineering_fit (read 2026-10-21, D139's F2): at Ø50, H8 0/+39 with f7 −50/−25 is a
//   clearance of +25…+89 µm; H7 0/+25 with k6 +2/+18, +23…−18; H7 0/+25 with p6 +26/+42, −1…−42 — the page's own results.
//   The rows below are those values, cited to it: test rows, not a table shipped;
// - coaxial pairs at MMC and LMC: the shaft's overlap with the hole's material πL(r_s² − r_h²) when r_s > r_h, else 0;
// - off-axis by e: the overlap is L(πr_s² − A), A the two circles' common area (the lens, in closed form).

const F2 = { id: 'f2-50', sources: [{ id: 'F2', label: 'Engineering fit (Wikipedia): the Ø50 worked examples', url: 'https://en.wikipedia.org/wiki/Engineering_fit', read: '2026-10-21' }], rows: [
  { class: 'H8', over: 30, upTo: 50, upper: 0.039, lower: 0, source: 'F2' }, { class: 'f7', over: 30, upTo: 50, upper: -0.025, lower: -0.05, source: 'F2' },
  { class: 'H7', over: 30, upTo: 50, upper: 0.025, lower: 0, source: 'F2' }, { class: 'k6', over: 30, upTo: 50, upper: 0.018, lower: 0.002, source: 'F2' },
  { class: 'p6', over: 30, upTo: 50, upper: 0.042, lower: 0.026, source: 'F2' }, { class: 'h6', over: 30, upTo: 50, upper: 0, lower: -0.016, estimate: true }] };
const near = (got, want, abs, what) => assert.ok(Math.abs(got - want) <= abs, `${what}: ${got} vs ${want}`);
const code = c => e => e instanceof FitError && e.code === c;
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
/** A ring with a Ø50 bore, 20 long, and a Ø50 shaft 30 long through it, its axis `e` off along X. */
function pair(e = 0) {
  const s = evaluateCadPart(D([
    { id: 'rs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 35 }, { id: 'ring', kind: 'extrude', sketch: 'rs', height: 20 },
    { id: 'bs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 25 }, { id: 'bore', kind: 'extrude', sketch: 'bs', height: 20 },
    { id: 'r', kind: 'difference', target: 'ring', tool: 'bore' },
    { id: 'ss', kind: 'sketch', profile: 'circle', center: [e, 0], radius: 25, plane: { origin: [0, 0, -5], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'shaft', kind: 'extrude', sketch: 'ss', height: 30 }]));
  return { hole: outputOf(s, 'r').brep, shaft: outputOf(s, 'shaft').brep };
}
/** The common area of circles of radii a and b, centres e apart. */
function lens(a, b, e) {
  if (e >= a + b) return 0; if (e <= Math.abs(a - b)) return Math.PI * Math.min(a, b) ** 2;
  const al = Math.acos((e * e + a * a - b * b) / (2 * e * a)), be = Math.acos((e * e + b * b - a * a) / (2 * e * b));
  return a * a * (al - Math.sin(2 * al) / 2) + b * b * (be - Math.sin(2 * be) / 2);
}

test('R12c.2 fit tables: the page\'s Ø50 results by the user\'s rows — clearance, transition, interference; a size outside a range or a class not loaded is a typed miss naming what to load', () => {
  assert.equal(fitTableProblem(F2), null);
  const cases = [['H8', 'f7', 0 / 1000 - -25 / 1000, 39 / 1000 - -50 / 1000, 'clearance'], ['H7', 'k6', 0 / 1000 - 18 / 1000, 25 / 1000 - 2 / 1000, 'transition'], ['H7', 'p6', 0 / 1000 - 42 / 1000, 25 / 1000 - 26 / 1000, 'interference'], ['H7', 'h6', 0 / 1000 - 0 / 1000, 25 / 1000 - -16 / 1000, 'clearance']];
  for (const [h, s, lo, hi, kind] of cases) { const f = fitLimits([F2], h, s, 50); assert.deepEqual([f.clearanceMin, f.clearanceMax, f.kind], [lo, hi, kind], `${h}/${s}`); }
  assert.equal(fitLimits([F2], 'H7', 'h6', 50).estimate, true);
  const l = lookupFit([F2], 'H7', 40);
  assert.deepEqual([l.min, l.max, l.table, l.row, l.source], [40, 40.025, 'f2-50', 2, 'F2']);
  // (over < size ≤ up to: 50 is in, 30 is not.)
  assert.throws(() => lookupFit([F2], 'H7', 30), e => code('FIT_TABLE_MISS')(e) && /load a row for H7 whose range holds 30 mm \(H7 has over 30 up to 50\)/.test(e.message));
  // A class the formula could compute is still a miss: limits are only ever loaded.
  assert.throws(() => lookupFit([F2], 'g6', 40), e => code('FIT_TABLE_MISS')(e) && /no g6 rows loaded/.test(e.message) && /never computed/.test(e.message));
  assert.throws(() => fitLimits([F2], 'h6', 'H7', 40), code('FIT_FACE'));
});

test('R12c.2 a nominal size is judged to 1e-6 mm, as it is named: a Ø50 bore measured a few ulps past 50 takes the "up to 50" row; 1e-6 past it does not (D266)', () => {
  // (A face's radius comes back from its arc's control points with their rounding: a Ø50 cylinder's side measures
  // 25.000000000000007. Unsnapped, the range's end decided the row on those ulps: FIT_TABLE_MISS "at Ø50 mm".)
  const s = evaluateCadPart(D([{ id: 'bs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 25 }, { id: 'bore', kind: 'extrude', sketch: 'bs', height: 20 }]));
  const measured = outputOf(s, 'bore').brep.faces.map(f => faceGeometry(f)).filter(g => g.kind === 'cylinder').map(g => 2 * g.r);
  for (const size of [...measured, 50 + 1.4210854715202004e-14, 50 - 1.4210854715202004e-14, 50.0000004]) {
    const l = lookupFit([F2], 'H8', size);
    assert.deepEqual([l.nominal, l.row, l.min, l.max], [50, 0, 50, 50.039], `Ø${size}`);
  }
  assert.throws(() => lookupFit([F2], 'H8', 50.000001), e => code('FIT_TABLE_MISS')(e) && /at Ø50\.000001 mm/.test(e.message));
  assert.throws(() => lookupFit([F2], 'H8', 4e-7), code('FIT_FACE'));
});

test('R12c.2 fit tables refused ([FIT_TABLE]): bad class, an empty or inverted range, ranges of one class overlapping, upper below lower, no source and no estimate, an unknown source', () => {
  const row = { class: 'H7', over: 30, upTo: 50, upper: 0.025, lower: 0, source: 'F2' }, t = rows => ({ id: 't', sources: [{ id: 'F2', label: 'x' }], rows });
  const bad = [[{ ...row, class: 'Q7' }, /not a tolerance class/], [{ ...row, class: 'H' }, /not a tolerance class/], [{ ...row, upTo: 30 }, /below up to/], [{ ...row, upper: -0.001 }, /at or above its lower/],
    [{ ...row, source: undefined }, /never neither/], [{ ...row, estimate: true }, /not both/], [{ ...row, source: 'X' }, /not among the table's sources/], [{ ...row, extra: 1 }, /unknown field extra/]];
  for (const [r, why] of bad) assert.match(fitTableProblem(t([r])) ?? 'accepted', why, JSON.stringify(r));
  assert.match(fitTableProblem(t([row, { ...row, over: 40, upTo: 65 }])), /overlap/);
  assert.equal(fitTableProblem(t([row, { ...row, over: 50, upTo: 65 }])), null, 'adjacent ranges');
  assert.match(fitTableProblem({ id: 't', rows: [] }), /at least one row/);
  assert.match(fitTableProblem('H7'), /object/);
});

test('R12c.2 checkFit coaxial: at MMC and LMC the analytic Boolean finds πL(r_s² − r_h²) where the shaft is the bigger, nothing where the hole is (D139 S0\'s construction)', t => {
  const { hole, shaft } = pair(), hf = 'bore.side0#1', sf = 'shaft.side0#1', L = 20;
  for (const [h, s] of [['H8', 'f7'], ['H7', 'k6'], ['H7', 'p6'], ['H7', 'h6']]) {
    const t0 = performance.now(), c = checkFit([F2], { brep: hole, face: hf, class: h }, { brep: shaft, face: sf, class: s }), ms = performance.now() - t0;
    near(c.length, L, 1e-9, 'overlap length'); near(c.offset, 0, 1e-12, 'coaxial');
    for (const [k, m] of [['mmc', c.mmc], ['lmc', c.lmc]]) {
      const rs = m.shaft / 2, rh = m.hole / 2, want = rs > rh ? Math.PI * L * (rs * rs - rh * rh) : 0;
      near(m.overlap, want, 1e-7 + 1e-7 * want, `${h}/${s} ${k}`);
    }
    assert.equal(c.contradicted, false);
    t.diagnostic(`${c.message}; MMC ${c.mmc.overlap.toFixed(6)} mm³, LMC ${c.lmc.overlap.toFixed(6)} (${ms.toFixed(0)} ms)`);
  }
  // S0's figures: H7/k6 at MMC 28.2794 mm³, H7/p6 at LMC 1.5716.
  near(checkFit([F2], { brep: hole, face: hf, class: 'H7' }, { brep: shaft, face: sf, class: 'k6' }).mmc.overlap, 28.2794, 1e-4, 'S0 H7/k6 MMC');
  near(checkFit([F2], { brep: hole, face: hf, class: 'H7' }, { brep: shaft, face: sf, class: 'p6' }).lmc.overlap, 1.5716, 1e-4, 'S0 H7/p6 LMC');
});

test('R12c.2 checkFit off-axis: a clearance fit whose shaft stands off by more than half its least clearance is contradicted — the overlap L(πr_s² − lens)', () => {
  // H8/f7's least clearance is 25 µm: 12.5 µm a side. Off by 10 µm it clears; by 50 µm it overlaps at MMC.
  for (const [e, bad] of [[0.010, false], [0.050, true]]) {
    const { hole, shaft } = pair(e), c = checkFit([F2], { brep: hole, face: 'bore.side0#1', class: 'H8' }, { brep: shaft, face: 'shaft.side0#1', class: 'f7' });
    near(c.offset, e, 1e-12, 'offset'); assert.equal(c.contradicted, bad, c.message);
    near(c.margin, 0.0125 - e, 1e-12, 'margin');
    for (const m of [c.mmc, c.lmc]) { const want = 20 * (Math.PI * (m.shaft / 2) ** 2 - lens(m.hole / 2, m.shaft / 2, e)); near(m.overlap, want, 1e-6 + 1e-6 * want, `overlap at e ${e}`); }
    if (bad) assert.match(c.message, /contradicted by the geometry: at MMC the shaft overlaps the hole/);
  }
});

test('R12c.2 checkFit refusals: a face that is no cylinder, a hole\'s face given as the shaft, two nominal sizes, no overlap along the axis, a class not loaded', () => {
  const { hole, shaft } = pair();
  assert.throws(() => checkFit([F2], { brep: hole, face: 'ring.top', class: 'H7' }, { brep: shaft, face: 'shaft.side0#1', class: 'k6' }), code('FIT_FACE'));
  assert.throws(() => checkFit([F2], { brep: shaft, face: 'shaft.side0#1', class: 'H7' }, { brep: hole, face: 'bore.side0#1', class: 'k6' }), e => code('FIT_FACE')(e) && /shaft's face/.test(e.message));
  assert.throws(() => checkFit([F2], { brep: hole, face: 'ring.side0#1', class: 'H7' }, { brep: shaft, face: 'shaft.side0#1', class: 'k6' }), code('FIT_FACE'));
  const s = evaluateCadPart(D([{ id: 'ss', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 24 }, { id: 'thin', kind: 'extrude', sketch: 'ss', height: 30 },
    { id: 'fs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 25, plane: { origin: [0, 0, 40], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'far', kind: 'extrude', sketch: 'fs', height: 10 }]));
  assert.throws(() => checkFit([F2], { brep: hole, face: 'bore.side0#1', class: 'H7' }, { brep: outputOf(s, 'thin').brep, face: 'thin.side0#1', class: 'k6' }), e => code('FIT_PAIR')(e) && /one nominal size/.test(e.message));
  assert.throws(() => checkFit([F2], { brep: hole, face: 'bore.side0#1', class: 'H7' }, { brep: outputOf(s, 'far').brep, face: 'far.side0#1', class: 'k6' }), e => code('FIT_PAIR')(e) && /do not overlap/.test(e.message));
  assert.throws(() => checkFit([F2], { brep: hole, face: 'bore.side0#1', class: 'H6' }, { brep: shaft, face: 'shaft.side0#1', class: 'k6' }), code('FIT_TABLE_MISS'));
});

// R7 public quantities are mm. These oracles use the independently specified Ø12 H7/g6 limits.
test('R12c.2 R7 public fit fields use mm, reject old names and preserve zero-clearance decisions', () => {
  const table = { id: 'r7-mm', rows: [
    { class: 'H7', over: 0, upTo: 18, upper: 0.018, lower: 0, estimate: true },
    { class: 'g6', over: 0, upTo: 18, upper: -0.006, lower: -0.017, estimate: true },
  ] };
  assert.equal(fitTableProblem(table), null);
  const limits = fitLimits([table], 'H7', 'g6', 12);
  assert.deepEqual([limits.hole.min, limits.hole.max, limits.shaft.min, limits.shaft.max], [12, 12.018, 11.983, 11.994]);
  near(limits.clearanceMin, 0.006, 1e-12, '6 µm clearance in mm');
  near(limits.clearanceMax, 0.035, 1e-12, '35 µm clearance in mm');
  assert.deepEqual(Object.keys(limits), ['hole', 'shaft', 'clearanceMin', 'clearanceMax', 'kind', 'estimate']);
  assert.deepEqual(Object.keys(limits.hole), ['class', 'nominal', 'upper', 'lower', 'max', 'min', 'table', 'row', 'estimate']);
  for (const old of ['upperUM', 'lowerUM']) assert.match(fitTableProblem({ ...table, rows: [{ ...table.rows[0], [old]: 18 }] }), new RegExp(`unknown field ${old}`));
  const boundary = (holeLower, holeUpper, shaftLower, shaftUpper) => fitLimits([{ id: 'zero', rows: [
    { class: 'H7', over: 0, upTo: 18, lower: holeLower, upper: holeUpper, estimate: true },
    { class: 'h6', over: 0, upTo: 18, lower: shaftLower, upper: shaftUpper, estimate: true },
  ] }], 'H7', 'h6', 12);
  assert.equal(boundary(0, 0.018, -0.011, 0).kind, 'clearance');
  assert.equal(boundary(-0.018, 0, 0, 0.011).kind, 'interference');
  assert.equal(boundary(-0.018, 0.018, -0.011, 0.011).kind, 'transition');
});
