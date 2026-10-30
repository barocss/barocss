// B1: the associative 2D band's geometry is exact. Oracles are independent of band.ts: the open-belt closed form of @barocss/cad for two
// circles, Cauchy's integrals (perimeter = ∫h, area = ½∫(h² − h′²)) over 1e6 support samples taken from each source's own analytic
// support, a monotone-chain hull for polygons, and the kernel's own volume of the extruded band.
import test from 'node:test';
import assert from 'node:assert/strict';
import { massPropertiesOf, openBeltLength } from '@barocss/cad';
import { bandLoops, bandProfile, type BandLoops } from '../src/sketch/band';
import { framedLoftSections, profileMiddle, profileRings } from '../src/app/profiles';
import { sketchDxfDocument } from '../src/sketch/dxf';
import { withIds } from '../src/sketch/entityIds';
import { partSnapshot } from '../src/engine/part';
import { evaluateDoc } from '../src/engine/evaluate';
import type { LoopSegment, SketchBand, SketchNode, StudioDoc } from '../src/engine/doc';
import type { SketchShape } from '../src/sketch/types';

type P = [number, number];
const TAU = 2 * Math.PI;
const norm = (a: number) => { const t = a % TAU; return t < 0 ? t + TAU : t; };
const circle = (c: P, r: number): SketchShape => ({ kind: 'circle', c, r, construction: true });
const rect = (a: P, b: P): SketchShape => ({ kind: 'rectangle', a, b, construction: true });
const slot = (a: P, b: P, r: number): SketchShape => ({ kind: 'slot', a, b, r, construction: true });
const poly = (points: P[]): SketchShape => ({ kind: 'polygon', points, closed: true, bulges: points.map(() => 0), construction: true });
/** Shapes with ids, and a band over the first side id of each of them. */
function make(shapes: SketchShape[], extra: Partial<SketchBand> = {}) {
  const all = withIds(shapes);
  return { all, band: { version: 1, id: 'b1', sources: all.map(s => s.ids![0]), ...extra } as SketchBand };
}
function loops(shapes: SketchShape[], extra: Partial<SketchBand> = {}): BandLoops {
  const { all, band } = make(shapes, extra), r = bandLoops(all, band);
  assert.ok(!('error' in r), 'error' in r ? r.error : '');
  return r;
}
const errorOf = (shapes: SketchShape[], extra: Partial<SketchBand> = {}, edit?: (b: SketchBand) => void) => {
  const { all, band } = make(shapes, extra); edit?.(band);
  const r = bandLoops(all, band); assert.ok('error' in r, 'expected a refusal'); return r.error;
};

/** A loop's perimeter and area, from its segments (an arc ends where the next segment starts). */
function measure(l: LoopSegment[]) {
  let perimeter = 0, area = 0;
  l.forEach((s, i) => {
    const a = s.start as P, b = l[(i + 1) % l.length].start as P;
    area += (a[0] * b[1] - b[0] * a[1]) / 2;
    if (s.kind === 'line') { perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]); return; }
    const c = s.center as P, r = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const sweep = norm(Math.atan2(b[1] - c[1], b[0] - c[0]) - Math.atan2(a[1] - c[1], a[0] - c[0]));
    perimeter += r * sweep; area += r * r * (sweep - Math.sin(sweep)) / 2;
  });
  return { perimeter, area };
}
const near = (a: number, b: number, rel: number, what = '') => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

/** Each source's support candidates (point, radius): the analytic support function is max(p·u + r). */
function candidates(s: SketchShape): { p: P; r: number }[] {
  if (s.kind === 'circle') return [{ p: s.c, r: s.r }];
  if (s.kind === 'slot') return [{ p: s.a, r: s.r }, { p: s.b, r: s.r }];
  if (s.kind === 'rectangle') return [s.a, [s.b[0], s.a[1]], s.b, [s.a[0], s.b[1]]].map(p => ({ p: p as P, r: 0 }));
  if (s.kind === 'polygon') return s.points.map(p => ({ p, r: 0 }));
  return [];
}
/** Cauchy's perimeter and area of the hull of the sources grown by d, from 1e6 samples of its support function. */
function cauchy(shapes: SketchShape[], d: number, N = 1e6) {
  const cs = shapes.flatMap(candidates);
  let per = 0, area = 0;
  for (let k = 0; k < N; k++) {
    const t = (k + 0.5) * TAU / N, cu = Math.cos(t), su = Math.sin(t);
    let h = -Infinity, hp = 0;
    for (const c of cs) { const v = c.p[0] * cu + c.p[1] * su + c.r; if (v > h) { h = v; hp = -c.p[0] * su + c.p[1] * cu; } }
    h += d; per += h; area += (h * h - hp * hp) / 2;
  }
  return { perimeter: per * TAU / N, area: area * TAU / N };
}
/** The convex hull of points (monotone chain), ccw. */
function hull(pts: P[]): P[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P[] = [], up: P[] = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...s].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

test('two circles: the open belt, exactly (perimeter, area, tangents and endpoints)', () => {
  for (const d of [0, 3]) {
    const R1 = 20, R2 = 12, c1: P = [0, 0], c2: P = [70, 10], C = Math.hypot(70, 10);
    const r = loops([circle(c1, R1), circle(c2, R2)], d ? { offset: d } : {});
    const m = measure(r.outer), belt = openBeltLength(R1 + d, R2 + d, C), beta = belt.beta * Math.PI / 180;
    near(m.perimeter, belt.length, 1e-9, 'perimeter');
    near(m.area, (R1 + R2 + 2 * d) * C * Math.cos(beta) + 0.5 * (R1 + d) ** 2 * (Math.PI + 2 * beta) + 0.5 * (R2 + d) ** 2 * (Math.PI - 2 * beta), 1e-9, 'area');
    assert.equal(r.outer.length, 4); assert.deepEqual(r.tags.outer.length, 4);
    // Every line is perpendicular to the radii at its ends, whose ends lie on their circles.
    r.outer.forEach((s, i) => {
      if (s.kind !== 'line') return;
      const prev = r.outer[(i + r.outer.length - 1) % r.outer.length], next = r.outer[(i + 1) % r.outer.length];
      assert.equal(prev.kind, 'arc'); assert.equal(next.kind, 'arc');
      const a = s.start as P, b = next.start as P, len = Math.hypot(b[0] - a[0], b[1] - a[1]), u: P = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      for (const [pt, arc] of [[a, prev], [b, next]] as [P, LoopSegment][]) {
        const c = (arc as { center: P }).center, rho = Math.hypot(pt[0] - c[0], pt[1] - c[1]);
        assert.ok(Math.abs(u[0] * (pt[0] - c[0]) / rho + u[1] * (pt[1] - c[1]) / rho) <= 1e-12, 'tangent line is perpendicular to its radius');
        assert.ok(Math.abs(rho - ((c[0] === 0 ? R1 : R2) + d)) <= 1e-12, 'endpoint on its circle');
      }
    });
  }
});

test('three circles, circle + rectangle, circle + slot: perimeter and area against Cauchy integrals', () => {
  const cases: [string, SketchShape[], number][] = [
    ['three circles', [circle([0, 0], 15), circle([80, 5], 9), circle([35, 60], 12)], 0],
    ['three circles offset', [circle([0, 0], 15), circle([80, 5], 9), circle([35, 60], 12)], 4],
    ['circle + rectangle', [circle([0, 0], 10), rect([40, -8], [60, 20])], 0],
    ['circle + rectangle offset', [circle([0, 0], 10), rect([40, -8], [60, 20])], 2.5],
    ['circle + slot', [circle([0, 0], 10), slot([40, 0], [60, 25], 6)], 0],
    ['circle + slot offset', [circle([0, 0], 10), slot([40, 0], [60, 25], 6)], 5],
  ];
  for (const [name, shapes, d] of cases) {
    const r = loops(shapes, d ? { offset: d } : {}), m = measure(r.outer), c = cauchy(shapes, d);
    near(m.perimeter, c.perimeter, 1e-7, name + ' perimeter'); near(m.area, c.area, 1e-5, name + ' area');
  }
});

test('polygon + polygon: exactly the convex hull at offset 0, Cauchy with an offset', () => {
  const A: P[] = [[0, 0], [30, -5], [40, 20], [10, 30]], B: P[] = [[70, 10], [100, 0], [110, 35], [80, 50], [65, 35]];
  const r = loops([poly(A), poly(B)]), m = measure(r.outer), h = hull([...A, ...B]);
  const area = h.reduce((s, p, i) => s + (p[0] * h[(i + 1) % h.length][1] - h[(i + 1) % h.length][0] * p[1]) / 2, 0), per = h.reduce((s, p, i) => s + Math.hypot(h[(i + 1) % h.length][0] - p[0], h[(i + 1) % h.length][1] - p[1]), 0);
  near(m.area, area, 1e-12, 'hull area'); near(m.perimeter, per, 1e-12, 'hull perimeter');
  assert.ok(r.outer.every(s => s.kind === 'line'), 'a band over polygons at offset 0 is a polygon: vertex to vertex');
  // (The hull's corners are the polygons' own corners.)
  for (const s of r.outer) assert.ok([...A, ...B].some(p => Math.hypot(p[0] - (s.start as P)[0], p[1] - (s.start as P)[1]) < 1e-9));
  const g = loops([poly(A), poly(B)], { offset: 3 }), c = cauchy([poly(A), poly(B)], 3);
  near(measure(g.outer).perimeter, c.perimeter, 1e-7, 'offset perimeter'); near(measure(g.outer).area, c.area, 1e-5, 'offset area');
});

test('a source that wins twice is named by the generator before each piece; every side has its own tag', () => {
  const r = loops([circle([0, 0], 10), circle([-100, 0], 1), circle([100, 0], 1)]);
  assert.equal(r.outer.length, 8);
  // (The big circle wins twice, once after each small one: its two arcs carry that neighbour, the single pieces keep their plain names.)
  assert.deepEqual(r.tags.outer.filter(t => /^b1_e1-e[23]$/.test(t)).sort(), ['b1_e1-e2', 'b1_e1-e3']);
  assert.equal(new Set(r.tags.outer).size, r.tags.outer.length);
  assert.ok(r.tags.outer.includes('b1_e2') && r.tags.outer.includes('b1_e3'));
  // Tangent sides are named by the pieces they join.
  assert.ok(r.tags.outer.some(t => /^b1_e\d_e\d$/.test(t)));
  assert.ok(r.tags.outer.every(t => /^[A-Za-z0-9_-]{1,32}$/.test(t)));
});

test('the names of a repeated piece follow the piece when the sources turn round it (no swaps)', () => {
  // e1 (r 10, at the origin) wins twice; e2, e3 (r 1) sit opposite each other at radius 100 and turn through 360°.
  let before: Map<string, number> | null = null, tagSet = '';
  for (let deg = 0; deg <= 360; deg += 1) {
    const a = deg * Math.PI / 180, p = (t: number): P => [100 * Math.cos(t), 100 * Math.sin(t)];
    const r = loops([circle([0, 0], 10), circle(p(a), 1), circle(p(a + Math.PI), 1)]);
    const now = new Map<string, number>(), sorted = [...r.tags.outer].sort().join(' ');
    if (!tagSet) tagSet = sorted; else assert.equal(sorted, tagSet, `the topology (and its names) is unchanged at ${deg}°`);
    r.outer.forEach((s, i) => {
      if (s.kind !== 'arc') return;
      const c = s.center as P, b = r.outer[(i + 1) % r.outer.length].start as P, a0 = Math.atan2((s.start as P)[1] - c[1], (s.start as P)[0] - c[0]);
      // The arc's middle direction, measured from e2's direction: it moves continuously while the sources turn.
      const mid = norm(a0 + norm(Math.atan2(b[1] - c[1], b[0] - c[0]) - a0) / 2 - a);
      now.set(r.tags.outer[i], mid);
      if (/^b1_e1[-_]/.test(r.tags.outer[i])) assert.ok(Math.hypot(c[0], c[1]) < 1e-9, `${r.tags.outer[i]} stays on e1's circle`);
      else assert.ok(Math.abs(Math.hypot(c[0], c[1]) - 100) < 1e-9, `${r.tags.outer[i]} stays on a small circle`);
    });
    if (before) for (const [t, m] of now) { const d = Math.abs(norm(m - before.get(t)! + Math.PI) - Math.PI); assert.ok(d < 0.05, `${t} jumped by ${d} rad at ${deg}°`); }
    before = now;
  }
});

test('a width makes a strip: the hull at offset + width with the hull at offset as its hole; its volume', async () => {
  const shapes = [circle([0, 0], 20), circle([70, 10], 12)];
  const r = loops(shapes, { offset: 2, width: 3 });
  assert.ok(r.hole); assert.equal(r.tags.outer.every(t => t.startsWith('b1o_')), true); assert.equal(r.tags.holes![0].every(t => t.startsWith('b1i_')), true);
  const C = Math.hypot(70, 10), outer = openBeltLength(20 + 5, 12 + 5, C).length, inner = openBeltLength(22, 14, C).length;
  near(measure(r.outer).perimeter, outer, 1e-9); near(measure(r.hole!).perimeter, inner, 1e-9);
  const area = measure(r.outer).area - measure(r.hole!).area;
  const { all, band } = make(shapes, { offset: 2, width: 3 });
  const doc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'band', band, construction: all, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 10, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 } as unknown as StudioDoc;
  const snap = partSnapshot(doc);
  near(massPropertiesOf(snap.outputs[0], 1).volume, area * 10, 1e-6, 'extruded volume');
  assert.ok((await evaluateDoc(doc, 1)).ok);
});

test('a filled band extrudes to area x height; bandProfile is the plain loop it makes', () => {
  const shapes = [circle([0, 0], 20), rect([50, -10], [80, 15])];
  const { all, band } = make(shapes, { offset: 1 });
  const node = { kind: 'sketch', profile: 'band', band, construction: all } as SketchNode;
  const loop = bandProfile(node, {}, 0) as Extract<SketchNode, { profile: 'loop' }>;
  assert.equal(loop.profile, 'loop'); assert.ok(!('band' in loop)); assert.ok(loop.sideTags!.outer.length === loop.segments.length);
  const doc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ ...node, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 7, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 } as unknown as StudioDoc;
  near(massPropertiesOf(partSnapshot(doc).outputs[0], 1).volume, measure(loop.segments).area * 7, 1e-6);
});

test('refusals name the sketch, the band and the cause', () => {
  const two = [circle([0, 0], 10), circle([50, 0], 10)];
  assert.match(errorOf(two, { sources: ['e1'] }), /^Sketch band b1: pick at least two sources$/);
  assert.match(errorOf(two, {}, b => { b.sources = ['e1', 'e9']; }), /source e9 is not in the sketch \(deleted, or no longer construction\); pick the sources again/);
  assert.match(errorOf(two, {}, b => { b.sources = ['e1', 'e1']; }), /sources e1 and e1 are sides of the same shape/);
  assert.match(errorOf([circle([0, 0], 10), { ...circle([50, 0], 10), construction: undefined }]), /source e2 is not in the sketch/);
  assert.match(errorOf([circle([0, 0], 10), { kind: 'polygon', points: [[40, 0], [60, 0], [60, 20]], closed: false, construction: true }]), /source e2 is not a closed shape/);
  assert.match(errorOf([circle([0, 0], 10), poly([[40, 0], [80, 0], [80, 40], [60, 40], [60, 20], [40, 20]])]), /source e2 is not convex \(v1 bands wrap convex shapes only\)/);
  assert.match(errorOf([circle([0, 0], 10), circle([5, 0], 10)]), /sources e1 and e2 overlap/);
  assert.match(errorOf([circle([0, 0], 10), circle([20.00005, 0], 10)]), /sources e1 and e2 touch or are closer than 0\.0001 mm/);
  assert.match(errorOf([circle([0, 0], 30), circle([3, 0], 5)]), /source e2 lies inside e1/);
  assert.match(errorOf([circle([-50, 0], 30), circle([50, 0], 30), circle([0, 0], 5)]), /source e3 does not reach the band's outline \(no tangent\): remove it from the band/);
  assert.match(errorOf(two, { offset: -1 }), /the offset must be a finite number, 0 or more/);
  assert.match(errorOf(two, { offset: Number.NaN }), /the offset must be a finite number/);
  assert.match(errorOf(two, { width: 0.005 }), /a strip must be at least 0\.01 mm wide/);
  assert.match(errorOf(two, { width: -1 }), /the width must be a finite number above 0/);
  assert.match(errorOf([circle([0, 0], 10), circle([50, 0], 0.005)]), /an arc of radius 0\.005 mm is smaller than 0\.01 mm/);
  assert.match(errorOf([circle([9995, 0], 10), circle([9960, 0], 10)]), /beyond ±10000 mm/);
  const long = withIds([circle([0, 0], 10), circle([50, 0], 10)]).map((s, i) => ({ ...s, ids: ['x'.repeat(29) + i] }));
  const r = bandLoops(long, { version: 1, id: 'b1', sources: long.map(s => s.ids![0]) });
  assert.ok('error' in r && /longer than 32 characters/.test(r.error));
  const many = Array.from({ length: 33 }, (_, i) => circle([i * 40, (i % 2) * 5], 10));
  assert.match(errorOf(many), /at most 32 sources/);
  // An index names the sketch.
  const { all, band } = make(two, { offset: -1 });
  const e = bandLoops(all, band, {}, 2); assert.ok('error' in e && e.error.startsWith('Sketch 3 band b1: '));
});

test('bandProfile refuses, never keeps a stale loop: unknown parameter, regions, holes, a linked sketch', () => {
  const { all, band } = make([circle([0, 0], 10), circle([50, 0], 10)]);
  const node = { kind: 'sketch', profile: 'band', band: { ...band, offset: { parameter: 'GAP' } }, construction: all } as SketchNode;
  assert.throws(() => bandProfile(node, {}, 1), /Sketch 2 uses parameter GAP/);
  assert.equal((bandProfile(node, { GAP: 2 }, 1) as Extract<SketchNode, { profile: 'loop' }>).profile, 'loop');
  const only = /A band sketch holds only the band and its construction sources: draw other shapes in their own sketch\./;
  assert.throws(() => bandProfile({ ...node, holes: [[{ kind: 'line', start: [0, 0] }]] } as SketchNode, { GAP: 1 }), only);
  assert.throws(() => bandProfile({ ...node, regions: [[{ kind: 'line', start: [0, 0] }]] } as SketchNode, { GAP: 1 }), only);
  assert.throws(() => bandProfile({ ...node, association: { kind: 'planar-face-outline-inset' } } as unknown as SketchNode, { GAP: 1 }), /linked sketch/);
  assert.throws(() => bandProfile(node, { GAP: -1 }, 0), /Sketch 1 band b1: the offset/);
});

/** The loop's own support function against the sources' analytic one (+ d), over many directions: the largest difference. */
function supportError(l: LoopSegment[], shapes: SketchShape[], d: number, N = 20000) {
  const cs = shapes.flatMap(candidates);
  let worst = 0;
  for (let k = 0; k < N; k++) {
    const t = (k + 0.37) * TAU / N, cu = Math.cos(t), su = Math.sin(t);
    const hs = Math.max(...cs.map(c => c.p[0] * cu + c.p[1] * su + c.r)) + d;
    let hl = -Infinity;
    l.forEach((s, i) => {
      const a = s.start as P, b = l[(i + 1) % l.length].start as P;
      hl = Math.max(hl, a[0] * cu + a[1] * su);
      if (s.kind !== 'arc') return;
      const c = s.center as P, r = Math.hypot(a[0] - c[0], a[1] - c[1]), a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
      if (norm(t - a0) <= norm(Math.atan2(b[1] - c[1], b[0] - c[0]) - a0)) hl = Math.max(hl, c[0] * cu + c[1] * su + r);
    });
    worst = Math.max(worst, Math.abs(hl - hs));
  }
  return worst;
}
async function extrudes(shapes: SketchShape[], extra: Partial<SketchBand> = {}) {
  const { all, band } = make(shapes, extra);
  const doc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [{ kind: 'sketch', profile: 'band', band, construction: all, id: 'n0' }, { kind: 'extrude', sketch: 0, height: 5, id: 'n1' }], outputs: { b1: { node: 1, side: 'solid' } }, nextId: 2 } as unknown as StudioDoc;
  return (await evaluateDoc(doc, 1)).ok;
}

test('no false "share part of their outline": tiny intervals from unrelated breakpoints are not ties', async () => {
  const cases: SketchShape[][] = [];
  for (const dy of [1e-10, 1e-9, 1e-8, 1e-7]) {
    cases.push([circle([0, 0], 10), circle([100, dy], 10), rect([40, -60], [60, -40])]);
    cases.push([circle([0, 0], 10), circle([50, dy], 10), circle([100, 0], 10)]);
  }
  for (const shapes of cases) {
    const r = loops(shapes);
    assert.ok(supportError(r.outer, shapes, 0) < 1e-6, `support differs for ${JSON.stringify(shapes.map(s => (s as { c?: P }).c))}`);
    assert.ok(await extrudes(shapes), 'the kernel extrudes it');
  }
});

test('guided loft refuses a band strip as a section (holes), as it refuses any sketch with holes', () => {
  const { all, band } = make([circle([0, 0], 10), circle([50, 0], 10)], { width: 3 });
  const strip = { kind: 'sketch', profile: 'band', band, construction: all } as SketchNode;
  const filled = { kind: 'sketch', profile: 'band', band: { ...band, width: undefined }, construction: all } as SketchNode;
  const plain = { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 } as SketchNode;
  const r = framedLoftSections([strip, plain] as never, [0, 1]);
  assert.ok('error' in r && /Sketch 1 has holes or several shapes: a loft section is one closed shape\./.test(r.error), JSON.stringify(r));
  assert.ok('sections' in framedLoftSections([filled, plain] as never, [0, 1]));
});

test('a malformed file is a refusal, not a TypeError', () => {
  const { all, band } = make([circle([0, 0], 10), circle([50, 0], 10)]);
  const node = { kind: 'sketch', profile: 'band', band, construction: all } as SketchNode;
  const noBand = { ...node } as Record<string, unknown>; delete noBand.band;
  assert.throws(() => bandProfile(noBand as never, {}, 3), /Sketch 4: band data is missing/);
  assert.throws(() => bandProfile(noBand as never), /Sketch: band data is missing/);
  const bad = bandLoops(all, undefined as never); assert.ok('error' in bad && /band data is missing/.test(bad.error));
  const noCentre = all.map((s, i) => { if (i !== 0) return s; const c = { ...s } as Record<string, unknown>; delete c.c; return c as unknown as SketchShape; });
  assert.throws(() => bandProfile({ ...node, construction: noCentre } as SketchNode, {}, 0), /Sketch 1 band b1: source e1 is malformed/);
  const poly = withIds([circle([0, 0], 10), poly3()]), lost = poly.map((s, i) => { if (i !== 1) return s; const c = { ...s } as Record<string, unknown>; delete c.points; return c as unknown as SketchShape; });
  const r = bandLoops(lost, { version: 1, id: 'b1', sources: poly.map(s => s.ids![0]) });
  assert.ok('error' in r && /source e2 is malformed/.test(r.error), JSON.stringify(r));
});
function poly3(): SketchShape { return poly([[40, 0], [60, 0], [50, 20]]); }

test('two references to one shape (two holders of an id) are refused as ambiguous', () => {
  const all = withIds([circle([0, 0], 10), circle([50, 0], 10)]);
  all[1] = { ...all[1], ids: [...all[0].ids!] };
  const r = bandLoops(all, { version: 1, id: 'b1', sources: [all[0].ids![0], 'e9'] });
  assert.ok('error' in r && /source e1 is ambiguous \(two construction shapes carry it\)/.test(r.error), JSON.stringify(r));
});

test('previews, the middle and the DXF use the loop the band makes', () => {
  const { all, band } = make([circle([0, 0], 20), circle([70, 10], 12)], { offset: 1 });
  const node = { kind: 'sketch', profile: 'band', band, construction: all } as SketchNode, plain = bandProfile(node, {});
  assert.deepEqual(profileRings(node, {}), profileRings(plain, {}));
  assert.equal(profileRings(node, {}).length, 1); assert.ok(profileRings(node, {})[0].length > 20);
  assert.deepEqual(profileMiddle(node, {}), profileMiddle(plain, {}));
  const m = profileMiddle(node, {}); assert.ok(m[0] > 10 && m[0] < 60, String(m));
  const dxf = sketchDxfDocument(node, {}), flat = sketchDxfDocument(plain, {});
  assert.deepEqual(dxf.entities[0], flat.entities[0]);
  assert.ok(dxf.entities[0].type === 'lwpolyline' && dxf.entities[0].layer === 'PROFILE' && dxf.entities[0].points.length >= 4);
  assert.equal(dxf.entities.filter(e => e.type === 'circle' && e.layer === 'CONSTRUCTION').length, 2);
});

test('an arc shorter than 0.0001 mm collapses to its middle point and the loop is admitted', async () => {
  // A small circle poking 1e-8 mm out of the line between two big ones: its arc is about 4e-5 mm long.
  const shapes = [circle([0, 0], 10), circle([100, 0], 10), circle([50, 10 - 0.02 + 1e-8], 0.02)];
  const r = loops(shapes);
  assert.ok(!r.outer.some(s => s.kind === 'arc' && Math.abs((s.center as P)[0] - 50) < 1e-9), 'no arc on the small circle');
  assert.equal(r.outer.length, 5, 'two big arcs, the bottom line and two lines to the point');
  assert.ok(supportError(r.outer, shapes, 0) < 1e-6);
  assert.ok(await extrudes(shapes));
});
