import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionTableProblem, lookupSection, connectorRowProblem, connectorSectionArea, connectorFrame, checkBrep, brepMassProperties, evaluateCadPart } from '../dist/index.js';

// R12c.7 (D162): section tables and connector envelopes. The section rows are test rows flagged estimates; the
// connector row is D139's U1 (Wikipedia, "USB hardware": the USB-C receptacle opening 8.34 × 2.56, 6.2 deep; the plug
// body 8.25 × 2.4 × 6.51), a test row citing it, not a built-in. Oracles written here:
// - a rounded rectangular tube's area w·h − (4 − π)r_o² − ((w − 2t)(h − 2t) − (4 − π)r_i²), a member's volume A·L;
// - a stadium's area (w − h)h + πh²/4, the opening's removal A·depth; S0's gaps 0.045 and 0.080, the 0.31 it stands out;
// - a square-cornered body in a stadium opening: the corners beyond the round ends, ∫ 2(h_b/2 − √(r² − (x − a)²)) dx
//   over each end (Simpson), times the depth inside the panel — its overlap, the declared fit refused.

const near = (got, want, abs, what) => assert.ok(Math.abs(got - want) <= abs, `${what}: ${got} vs ${want} (±${abs})`);
const vol = b => brepMassProperties(b, 1, { quadratureSegments: 16 }).volumeMM3;
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const RHS = { id: 'rhs-a', kind: 'rect-tube', estimate: true, rows: [{ size: '40x40x3', width: 40, height: 40, wall: 3, outerRadius: 6, innerRadius: 3 }, { size: '60x40x4', width: 60, height: 40, wall: 4, outerRadius: 8, innerRadius: 4, source: 'a test row with its own source' }] };
const U1 = { id: 'usb-c', name: 'USB-C receptacle opening', opening: { shape: 'stadium', widthMM: 8.34, heightMM: 2.56, depthMM: 6.2 }, body: { shape: 'stadium', widthMM: 8.25, heightMM: 2.4, lengthMM: 6.51 }, keepOut: { marginMM: 1, depthMM: 15 }, source: 'U1 (D139): Wikipedia, "USB hardware", the connector dimensions table' };
const PANEL = [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 10 }];
const stadium = (w, h) => (w - h) * h + Math.PI * h * h / 4;

test('R12c.7 section tables: checked whole — a source or an estimate per size (its own or the table\'s), every dimension, no unknown field, a size that builds; a lookup, and a miss naming the sizes', () => {
  assert.equal(sectionTableProblem(RHS), null);
  const bad = (t, re) => assert.match(String(sectionTableProblem(t)), re);
  bad({ ...RHS, estimate: undefined }, /size 40x40x3: cite its source or say estimate: true — never neither/);
  bad({ ...RHS, kind: 'future-section' }, /kind must be rect-tube/);
  bad({ ...RHS, rows: [{ ...RHS.rows[0] }, { ...RHS.rows[0] }] }, /size 40x40x3 is listed twice/);
  bad({ ...RHS, rows: [{ size: 'x', width: 40, height: 40, wall: 3 }] }, /size x: outerRadius is missing/);
  bad({ ...RHS, rows: [{ ...RHS.rows[0], colour: 'red' }] }, /unknown field colour/);
  bad({ ...RHS, rows: [{ ...RHS.rows[0], wall: 25 }] }, /size 40x40x3: /);
  bad({ ...RHS, rows: [] }, /at least one size/);
  const a = lookupSection(RHS, '40x40x3'), b = lookupSection(RHS, '60x40x4');
  assert.deepEqual([a.estimate, b.estimate, b.source], [true, false, 'a test row with its own source']);
  assert.match(lookupSection(RHS, '50x50x5').miss, /has no size 50x50x5 \(sizes: 40x40x3, 60x40x4\)/);
});

test('R12c.7 a frame member on a table\'s size: its volume A·L by the rounded tube\'s closed form; the label names the table, the size and the estimate; [SECTION_TABLE] and [SECTION_TABLE_MISS]', () => {
  const A = (w, h, t, ro, ri) => w * h - (4 - Math.PI) * ro * ro - ((w - 2 * t) * (h - 2 * t) - (4 - Math.PI) * ri * ri);
  const m = size => evaluateCadPart(D([{ id: 'm', kind: 'frame-member', section: { kind: 'table', table: RHS, size }, start: [0, 0, 0], end: [0, 0, 300] }])).output('m');
  const one = m('40x40x3'), two = m('60x40x4');
  assert.equal(checkBrep(one.brep).valid, true);
  near(vol(one.brep), A(40, 40, 3, 6, 3) * 300, 1e-6 * 133200, 'A·L 40x40x3'); near(vol(two.brep), A(60, 40, 4, 8, 4) * 300, 1e-6 * 300000, 'A·L 60x40x4');
  assert.match(one.member.section, /^rhs-a 40x40x3, an estimate: rect-tube 40 × 40 × 3/);
  assert.match(two.member.section, /^rhs-a 60x40x4 \(a test row with its own source\): rect-tube 60 × 40 × 4/);
  assert.throws(() => m('50x50x5'), e => (e.details?.category ?? e.code) === 'PARAMETER' && /\[SECTION_TABLE_MISS\] section: the section table rhs-a has no size 50x50x5/.test(e.message));
  assert.throws(() => evaluateCadPart(D([{ id: 'm', kind: 'frame-member', section: { kind: 'table', table: { ...RHS, estimate: undefined }, size: '40x40x3' }, start: [0, 0, 0], end: [0, 0, 300] }])).output('m'), e => (e.details?.category ?? e.code) === 'PARAMETER' && /\[SECTION_TABLE\] section table rhs-a size 40x40x3: cite its source/.test(e.message));
});

test('R12c.7 connector rows checked: a source or an estimate, shapes, a body no larger than its opening, a keep-out', () => {
  assert.equal(connectorRowProblem(U1), null);
  const bad = (r, re) => assert.match(String(connectorRowProblem(r)), re);
  bad({ ...U1, source: undefined }, /never neither/); bad({ ...U1, opening: { ...U1.opening, shape: 'oval' } }, /stadium, rect or round/);
  bad({ ...U1, opening: { ...U1.opening, widthMM: 2 } }, /width 2 is at least its height/); bad({ ...U1, body: { ...U1.body, widthMM: 9 } }, /larger than its opening/);
  bad({ ...U1, keepOut: { marginMM: 1 } }, /keepOut must be/); bad({ ...U1, pins: 24 }, /unknown field pins/);
  near(connectorSectionArea(U1.opening), stadium(8.34, 2.56), 1e-12, 'stadium area');
  near(connectorSectionArea({ shape: 'rect', widthMM: 10, heightMM: 4, cornerRadiusMM: 1 }), 40 - (4 - Math.PI), 1e-12, 'rounded rect');
});

test('R12c.7 U1\'s USB-C opening in a panel\'s top: the removal A·6.2, the body seated (A_b·6.51), the gaps 0.045 and 0.080, 0.31 standing out, touching nothing; the keep-out in front of it; turned 90°', () => {
  const s = evaluateCadPart(D([...PANEL, { id: 'o', kind: 'connector-opening', target: 'p', face: 'p.top', row: U1, center: [20, 10, 10] }, { id: 'b', kind: 'connector-body', opening: 'o' }]));
  const o = s.output('o'), b = s.output('b'), r = o.connector;
  assert.equal(checkBrep(o.brep).valid, true); assert.equal(checkBrep(b.brep).valid, true);
  near(vol(o.brep), 8000 - stadium(8.34, 2.56) * 6.2, 1e-7, 'the panel less the opening'); near(vol(b.brep), stadium(8.25, 2.4) * 6.51, 1e-9, 'the body');
  near(r.body.gapWidthMM, 0.045, 1e-12, 'gap across the width'); near(r.body.gapHeightMM, 0.08, 1e-12, 'gap across the height'); near(r.body.standsOutMM, 0.31, 1e-12, 'stands out');
  assert.equal(b.connectorBody.overlapMM3, 0);
  // The body's top at z 10 − 6.2 + 6.51.
  const zs = b.brep.vertices.map(v => v.point[2]); near(Math.max(...zs), 10.31, 1e-9, 'its top'); near(Math.min(...zs), 3.8, 1e-9, 'its bottom');
  // (From the body's front, 0.31 out of the face: the plug fills the space up to there.)
  assert.deepEqual(r.keepOut.frame.origin.map(x => Math.round(x * 1e9) / 1e9), [20 - 10.25 / 2, 10 - 4.4 / 2, 10.31]);
  assert.deepEqual([r.keepOut.frame.normal, r.keepOut.frame.xAxis, r.keepOut.size, r.keepOut.clearance], [[0, 0, 1], [1, 0, 0], [10.25, 4.4, 15], 0]);
  assert.equal(r.source, U1.source); assert.equal(r.estimate, false);
  const turned = evaluateCadPart(D([...PANEL, { id: 'o', kind: 'connector-opening', target: 'p', face: 'p.top', row: U1, center: [20, 10, 10], rotation: 90 }])).output('o').connector;
  near(turned.frame.x[1], 1, 1e-12, 'x along world Y'); near(turned.keepOut.frame.origin[0], 20 + 4.4 / 2, 1e-12, 'the keep-out turned');
  const f = connectorFrame([0, 0, 0], [1, 0, 0]); assert.deepEqual([f.x, f.z], [[0, 1, 0], [1, 0, 0]]);
});

test('R12c.7 refusals: a square-cornered body in a stadium opening overlaps the panel by its corners beyond the round ends (CONNECTOR_FIT, the overlap by Simpson); an opening off its face or on a curved face (CONNECTOR_PLACEMENT)', () => {
  const sq = { ...U1, body: { shape: 'rect', widthMM: 8.25, heightMM: 2.4, lengthMM: 6.51 } };
  // Each end: x from a = (8.34 − 2.56)/2 to the body's half-width 4.125, the body's |y| ≤ 1.2 outside the end's circle (r 1.28).
  const a = (8.34 - 2.56) / 2, r = 1.28, f = x => 2 * Math.max(0, 1.2 - Math.sqrt(Math.max(0, r * r - (x - a) ** 2)));
  let A = 0; const N = 20000, h = (4.125 - a) / N; for (let i = 0; i < N; i++) { const x = a + i * h; A += h / 6 * (f(x) + 4 * f(x + h / 2) + f(x + h)); }
  const want = 2 * A * 6.2;
  assert.throws(() => evaluateCadPart(D([...PANEL, { id: 'o', kind: 'connector-opening', target: 'p', face: 'p.top', row: sq, center: [20, 10, 10] }, { id: 'b', kind: 'connector-body', opening: 'o' }])).output('b'), e => {
    const m = /\[CONNECTOR_FIT\] the body overlaps the panel by ([\d.]+) mm³/.exec(e.message); return (e.details?.category ?? e.code) === 'GEOMETRY' && m && Math.abs(Number(m[1]) - want) < 1e-5;
  }, String(want));
  assert.throws(() => evaluateCadPart(D([...PANEL, { id: 'o', kind: 'connector-opening', target: 'p', face: 'p.top', row: U1, center: [2, 10, 10] }])).output('o'), e => (e.details?.category ?? e.code) === 'GEOMETRY' && /\[CONNECTOR_PLACEMENT\] the opening runs off the face/.test(e.message));
  assert.throws(() => evaluateCadPart(D([...PANEL, { id: 'o', kind: 'connector-opening', target: 'p', face: 'p.top', row: U1, center: [20, 10, 9] }])).output('o'), e => /off the face's plane/.test(e.message));
  const cyl = [{ id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 }, { id: 'c', kind: 'extrude', sketch: 'cs', height: 20 }];
  assert.throws(() => evaluateCadPart(D([...cyl, { id: 'o', kind: 'connector-opening', target: 'c', face: 'c.side0', row: U1, center: [10, 0, 10] }])).output('o'), e => /\[CONNECTOR_PLACEMENT\] c\.side0 is not flat/.test(e.message));
  assert.throws(() => evaluateCadPart(D([...PANEL, { id: 'o', kind: 'connector-opening', target: 'p', face: 'p.top', row: { ...U1, source: undefined }, center: [20, 10, 10] }])).output('o'), e => (e.details?.category ?? e.code) === 'INPUT' && /\[INVALID_INPUT\]/.test(e.message));
});
