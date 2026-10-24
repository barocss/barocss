import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { faceBoundary } from '../src/app/faceProfile';

// FR S0 (O114): what FR's leftovers can build on today, against closed forms — a mitred corner's weld seam is read off
// the geometry (the mitre face's outer loop of a 40 × 40 tube cut at 45°: 2 · (40 + 40√2)), so weld lengths need no
// table; 1D nesting must be exact for small counts (first-fit-decreasing packs 5 5 4 4 3 3 3 3 into 10s as four bars,
// the optimum is three); a parameter already moves two frames together (numbers shared, not a skeleton's topology);
// the cut list's pieces carry what nesting needs (each length and its count).

const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const RHS = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 };
const L = () => withNode(emptyDoc(), { kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [300, 200, 0]], segments: [[0, 1], [1, 2]], section: RHS, corners: { default: 'mitre' } } as never);
const perimeter = (loop: readonly number[][]) => loop.reduce((t, p, i) => { const q = loop[(i + 1) % loop.length]; return t + Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); }, 0);

test('FR S0 P1: a weld seam from the geometry — the mitre face of a 40 × 40 × 3 tube cut at 45°: its outer loop 2 · (40 + 40√2) = 193.137, its inner 2 · (34 + 34√2); its normal 45° off the member\'s axis', () => {
  const bodies = bodiesOf(L());
  assert.equal(bodies.length, 2, 'two members');
  const m = bodies[0].mesh, k = m.faces.findIndex(f => f.kind === 'plane' && Math.abs(Math.abs(f.normal[0]) - Math.SQRT1_2) < 1e-6 && Math.abs(Math.abs(f.normal[1]) - Math.SQRT1_2) < 1e-6);
  assert.ok(k >= 0, m.faces.map(f => `${f.name} ${f.normal.map(v => +v.toFixed(3))}`).join(' | '));
  const loops = faceBoundary(m, k).map(perimeter).sort((a, b) => b - a);
  assert.equal(loops.length, 2, 'the tube\'s wall: an outer and an inner loop');
  assert.ok(Math.abs(loops[0] - 2 * (40 + 40 * Math.SQRT2)) <= 1e-3, String(loops[0]));
  assert.ok(Math.abs(loops[1] - 2 * (34 + 34 * Math.SQRT2)) <= 1e-3, String(loops[1]));
});

/** First-fit decreasing: each piece, longest first, into the first bar it fits (with kerf after every piece but a bar's last). */
function ffd(pieces: readonly number[], stock: number, kerf: number): number[][] {
  const bars: number[][] = [];
  for (const p of [...pieces].sort((a, b) => b - a)) {
    const bar = bars.find(b => b.reduce((t, x) => t + x + kerf, 0) + p <= stock + 1e-9);
    if (bar) bar.push(p); else bars.push([p]);
  }
  return bars;
}
/** The fewest bars, by exhaustive search (small counts only: the S0's oracle). */
function fewest(pieces: readonly number[], stock: number, kerf: number): number {
  const ps = [...pieces].sort((a, b) => b - a); let best = ps.length;
  const go = (i: number, used: number[]) => {
    if (used.length >= best) return;
    if (i === ps.length) { best = used.length; return; }
    const seen = new Set<number>();
    for (let b = 0; b < used.length; b++) if (!seen.has(used[b]) && used[b] + kerf + ps[i] <= stock + 1e-9) { seen.add(used[b]); used[b] += kerf + ps[i]; go(i + 1, used); used[b] -= kerf + ps[i]; }
    used.push(ps[i]); go(i + 1, used); used.pop();
  };
  go(0, []); return best;
}

test('FR S0 P2: nesting must be exact for small counts — 5 5 4 4 3 3 3 3 into bars of 10 (no kerf): first-fit-decreasing four bars, the optimum three (5 5 · 4 3 3 · 4 3 3); with a kerf of 0.5 the optimum is four', () => {
  const pieces = [5, 5, 4, 4, 3, 3, 3, 3];
  assert.equal(ffd(pieces, 10, 0).length, 4);
  assert.equal(fewest(pieces, 10, 0), 3);
  // (A kerf between pieces in a bar: 4 + 3 + 3 needs 11 with two cuts — the three-bar packing no longer fits.)
  assert.equal(fewest(pieces, 10, 0.5), 4);
  // (The waste is exact: the bars' total less the pieces and the kerfs cut.)
  const bars = ffd(pieces, 10, 0), waste = bars.length * 10 - pieces.reduce((t, p) => t + p, 0);
  assert.equal(waste, 10);
});

test('FR S0 P3: a parameter already moves two frames together — w = 300 then 400 in both skeletons: each frame\'s X extent follows (numbers shared; a skeleton shared as topology is FR item 4)', () => {
  const two = (w: number) => {
    let d: StudioDoc = { ...emptyDoc(), parameters: { w } };
    for (const y of [0, 500]) d = withNode(d, { kind: 'frame', points: [[0, y, 0], [{ parameter: 'w' }, y, 0]], segments: [[0, 1]], section: RHS } as never);
    return bodiesOf(d);
  };
  for (const w of [300, 400]) {
    const b = two(w);
    assert.equal(b.length, 2);
    for (const x of b) assert.ok(Math.abs(x.mesh.bounds.max[0] - x.mesh.bounds.min[0] - w) <= 1e-6, `${w}: ${x.mesh.bounds.max[0] - x.mesh.bounds.min[0]}`);
  }
});

test('FR S0 P4: the cut list carries what nesting needs — the L\'s two mitred members: each piece\'s long-point length (300 + 20 and 200 + 20 at the 45° cuts) and the row counts', () => {
  const pieces = bodiesOf(L()).map(b => b.cutPiece!).filter(Boolean);
  assert.equal(pieces.length, 2);
  const longs = pieces.map(p => Math.round(p.longPoint * 1e6) / 1e6).sort((a, b) => b - a);
  assert.deepEqual(longs, [320, 220]);
});
