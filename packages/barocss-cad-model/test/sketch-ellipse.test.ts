// Ellipse sketches: a definition (centre, semi-axes, angle) kept as a fixed-size outline of tangent arcs within ELLIPSE_TOLERANCE of
// the true ellipse, a definition that round-trips through the document, and the exact rational NURBS Make curves writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch } from '../src/api';
import { evaluateDoc } from '../src/engine/evaluate';
import type { SketchNode, StudioDoc } from '../src/engine/doc';
import { ellipseCurve } from '../src/engine/curveSource';
import { arcOf } from '../src/sketch/profile';
import { outlineOf, profileOf } from '../src/sketch/loops';
import { outlinePolygon, sketchShapes } from '../src/sketch/reopen';
import { settleShape } from '../src/sketch/settle';
import { xyPlane } from '../src/sketch/plane';
import { ELLIPSE_POINTS, ELLIPSE_TOLERANCE, ellipseDeviation, ellipseError, ellipseMatches, ellipseOutline, ellipseShape, reellipse, wellFormedEllipse, type EllipseDef } from '../src/sketch/ellipse';
import type { SketchShape } from '../src/sketch/types';

type P2 = [number, number];
type Poly = Extract<SketchShape, { kind: 'polygon' }>;
const def = (rx: number, ry: number, angle = 0, center: P2 = [0, 0]): EllipseDef => ({ center, rx, ry, angle });
/** The ellipse's implicit value ((x'/rx)² + (y'/ry)² − 1) at a point (x' y' in the ellipse's own frame). */
function implicit(d: EllipseDef, p: P2): number {
  const a = -d.angle * Math.PI / 180, x = p[0] - d.center[0], y = p[1] - d.center[1], u = Math.cos(a) * x - Math.sin(a) * y, v = Math.sin(a) * x + Math.cos(a) * y;
  return (u / d.rx) ** 2 + (v / d.ry) ** 2 - 1;
}
/** The area an outline of arcs encloses: the polygon's, plus each arc's circular segment. */
function area(o: { points: P2[]; bulges: number[] }): number {
  const n = o.points.length; let a = 0;
  for (let i = 0; i < n; i++) {
    const p = o.points[i], q = o.points[(i + 1) % n], b = o.bulges[i];
    a += (p[0] * q[1] - q[0] * p[1]) / 2;
    if (b) { const arc = arcOf(p, q, b); a += arc.radius ** 2 / 2 * (arc.sweep - Math.sin(arc.sweep)); }
  }
  return a;
}
const settle = (s: Poly) => { const r = settleShape(s, null); assert.equal(r.error, null); return r.shape as Poly; };
const named = (s: Poly): Poly => ({ ...s, ids: Array.from({ length: s.points.length }, (_, i) => `e${i + 5}`) });

test('the outline has 2 × ELLIPSE_POINTS points whatever the ratio, size, angle or centre', () => {
  for (const d of [def(50, 50), def(50, 10, 33), def(10, 50, -70, [5, 5]), def(1, 0.2, 90), def(2000, 1500, 12, [-3000, 2000]), def(0.5, 0.5)]) {
    const o = ellipseOutline(d);
    assert.equal(o.points.length, 2 * ELLIPSE_POINTS); assert.equal(o.bulges.length, 2 * ELLIPSE_POINTS);
    assert.equal(ellipseError(d), null);
  }
});

test('every fit point lies on the exact ellipse (1e-9 relative)', () => {
  for (const d of [def(50, 50), def(50, 10, 33), def(10, 50, -70, [5, 5]), def(2000, 1500, 12, [-3000, 2000]), def(1, 0.2, 90)]) {
    const o = ellipseOutline(d);
    for (let i = 0; i < o.points.length; i += 2) assert.ok(Math.abs(implicit(d, o.points[i])) < 1e-9, `${JSON.stringify(d)} point ${i}: ${implicit(d, o.points[i])}`);
  }
  // The first fit point is the +rx end.
  const o = ellipseOutline(def(30, 12, 40, [1, 2]));
  assert.ok(Math.hypot(o.points[0][0] - (1 + 30 * Math.cos(40 * Math.PI / 180)), o.points[0][1] - (2 + 30 * Math.sin(40 * Math.PI / 180))) < 1e-9);
});

test('the largest distance from the arcs to the true ellipse is within ELLIPSE_TOLERANCE × the longer axis, over ratios, angles and sizes', () => {
  let worst = 0;
  for (const size of [1, 7, 50, 400, 5000]) for (const ratio of [0.2, 0.25, 0.3, 0.5, 0.75, 1]) for (const angle of [0, 17, 90, -135]) for (const flip of [false, true]) {
    const long = size, short = size * ratio, d = flip ? def(short, long, angle) : def(long, short, angle);
    if (ellipseError(d)) continue; // (the 0.01 mm arc radius floor: a 1 mm × 0.2 ellipse is inside it only barely)
    const dev = ellipseDeviation(d) / long; worst = Math.max(worst, dev);
    assert.ok(dev <= ELLIPSE_TOLERANCE, `${JSON.stringify(d)}: ${dev}`);
  }
  assert.ok(worst > 1e-7 && worst <= ELLIPSE_TOLERANCE, `worst ${worst}`);
});

test('the outline encloses π·rx·ry within 1e-5 (relative)', () => {
  for (const d of [def(50, 50), def(50, 10, 33), def(10, 50, -70, [5, 5]), def(40, 8)]) {
    const a = area(ellipseOutline(d)); assert.ok(Math.abs(a / (Math.PI * d.rx * d.ry) - 1) < 1e-5, `${JSON.stringify(d)}: ${a / (Math.PI * d.rx * d.ry) - 1}`);
  }
});

test('ellipseError: non-finite or non-positive axes, a ratio below 1 : 5, coordinates beyond the kernel limits', () => {
  assert.equal(ellipseError(def(10, 2)), null); assert.equal(ellipseError(def(2, 10)), null);
  assert.match(ellipseError(def(NaN, 5)) ?? '', /numbers/); assert.match(ellipseError(def(5, 5, Infinity)) ?? '', /numbers/);
  assert.match(ellipseError({ center: [0, NaN], rx: 5, ry: 3, angle: 0 }) ?? '', /numbers/);
  assert.match(ellipseError(def(0, 5)) ?? '', /above 0/); assert.match(ellipseError(def(5, -1)) ?? '', /above 0/);
  assert.match(ellipseError(def(10, 1.9)) ?? '', /1 : 5/); assert.match(ellipseError(def(1.9, 10)) ?? '', /1 : 5/);
  assert.match(ellipseError(def(9000, 9000, 0, [5000, 0])) ?? '', /10000/); assert.match(ellipseError(def(5, 5, 0, [0, 1e5])) ?? '', /10000/);
  assert.match(ellipseError(def(5000, 1000)) ?? '', /10000/, 'its minor-axis arcs have centres 25000 mm out');
  assert.equal(ellipseError(def(5000, 4000)), null);
  assert.match(ellipseError(def(0.001, 0.001)) ?? '', /0.01 mm/);
});

test('ellipseMatches: true for a fresh shape, false once a point moves or the definition is gone', () => {
  const s = ellipseShape(def(40, 15, 25, [3, -4]));
  assert.ok(ellipseMatches(s)); assert.ok(s.fromEllipse);
  assert.ok(ellipseMatches(settle(s)), 'settling infers nothing and keeps it');
  const moved: Poly = { ...s, points: s.points.map((p, i) => i === 10 ? [p[0] + 0.001, p[1]] as P2 : p) };
  assert.equal(ellipseMatches(moved), false);
  assert.equal(ellipseMatches({ ...s, ellipse: undefined }), false);
  assert.equal(ellipseMatches({ ...s, ellipse: { ...s.ellipse!, rx: NaN } }), false);
  // Settling a shape whose points no longer match drops the definition but keeps the polygon.
  const r = settleShape(moved, s); assert.equal((r.shape as Poly).ellipse, undefined); assert.equal((r.shape as Poly).points.length, 2 * ELLIPSE_POINTS);
});

test('closing infers no tangents, equal radii or shared centres; a dimension is refused beyond the solver size', () => {
  const out = settle(ellipseShape(def(40, 15, 25)));
  assert.equal(out.tangents?.length ?? 0, 0); assert.equal(out.equalRadii?.length ?? 0, 0); assert.equal(out.concentric?.length ?? 0, 0);
  assert.ok(out.ellipse);
  // (A dimension on its 192 arcs is beyond the solver's 64 segments: refused with its reason, the definition stays.)
  const driven = settleShape({ ...out, radii: { 0: arcOf(out.points[0], out.points[1], out.bulges![0]).radius } }, out);
  assert.match(driven.error ?? '', /Too many points/); assert.ok((driven.shape as Poly).ellipse);
});

test('reellipse regenerates the outline, keeps ids and attached circles, drops other constraints', () => {
  const base = named(ellipseShape(def(40, 15)));
  const s: Poly = { ...base, circles: [{ c: [0, 0], r: 3 }], circleIds: ['e1'], lengths: { 0: 4 }, rules: [{ kind: 'fix', point: 0, at: [40, 0] }], hv: { h: [], v: [] } };
  const next = reellipse(s, def(50, 20, 10, [2, 2]));
  assert.deepEqual(next.ids, base.ids); assert.deepEqual(next.circleIds, ['e1']); assert.equal(next.circles?.length, 1);
  assert.equal(next.lengths, undefined); assert.equal(next.rules, undefined); assert.equal(next.hv, undefined);
  assert.equal(next.points.length, 2 * ELLIPSE_POINTS); assert.ok(ellipseMatches(next)); assert.deepEqual(next.ellipse, def(50, 20, 10, [2, 2]));
});

test('reopen: the definition survives profileOf → node → JSON → sketchShapes, and Finish again is idempotent', () => {
  const d = def(42, 17, 30, [5, -6]), first = named(settle(ellipseShape(d)));
  const p = profileOf([first]); assert.ok('node' in p);
  assert.equal(p.node.outline?.ellipse?.rx, 42);
  const node = JSON.parse(JSON.stringify({ ...p.node, id: 'n0' })) as SketchNode;
  const back = sketchShapes(node).shape as Poly;
  assert.deepEqual(back.ellipse, d); assert.ok(back.fromEllipse); assert.deepEqual(back.ids, first.ids);
  assert.equal(ellipseMatches(back), true);
  const again = profileOf([back]); assert.ok('node' in again);
  assert.deepEqual(again.node.outline, p.node.outline); assert.deepEqual(again.node.sideTags, p.node.sideTags);
  assert.deepEqual(outlineOf(back)?.ellipse, d);
});

test('a malformed or stale stored definition is ignored on reopen without throwing', () => {
  const s = settle(ellipseShape(def(30, 12))), p = profileOf([s]); assert.ok('node' in p);
  const bad: unknown[] = [null, 5, 'x', {}, { center: [0], rx: 1, ry: 1, angle: 0 }, { center: [0, 0], rx: 'a', ry: 1, angle: 0 }, { center: [0, 0], rx: -3, ry: 1, angle: 0 },
    { center: [0, 0], rx: 30, ry: 1, angle: 0 }, { center: [0, 0], rx: 30, ry: 12, angle: NaN }, { center: [0, NaN], rx: 30, ry: 12, angle: 0 },
    { center: [1, 0], rx: 30, ry: 12, angle: 0 }, // (well-formed but not what the points make)
    { center: [0, 0], rx: 30.5, ry: 12, angle: 0 }];
  for (const x of bad) {
    const outline = { ...p.node.outline!, ellipse: x as EllipseDef };
    const poly = outlinePolygon(outline); assert.equal(poly.ellipse, undefined, JSON.stringify(x)); assert.equal(poly.fromEllipse, undefined); assert.equal(poly.points.length, 2 * ELLIPSE_POINTS);
  }
  assert.equal(wellFormedEllipse({ center: [0, 0], rx: 30, ry: 12, angle: 0 })?.rx, 30);
  assert.equal(wellFormedEllipse({ center: [0, 0], rx: 30, ry: 1, angle: 0 }), null);
});

test('downstream: sketch + extrude evaluates, its volume is π·rx·ry·h within 2e-5, and editing keeps the side names', () => {
  const d = def(30, 12, 20), s = named(settle(ellipseShape(d))), p = profileOf([s]);
  assert.ok('node' in p);
  const base = part('ellipse').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 8 }).doc;
  const docOf = (node: unknown): StudioDoc => ({ ...base, nodes: base.nodes.map((n, i) => i === 0 ? { ...(node as object), id: 'n0' } as unknown as SketchNode : n) });
  const doc = docOf(p.node), r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const volume = part('x', doc).mass({ density: 1 }).volume, exact = Math.PI * d.rx * d.ry * 8;
  assert.ok(Math.abs(volume / exact - 1) < 2e-5, `${volume} vs ${exact}`);
  const next = reellipse(sketchShapes(JSON.parse(JSON.stringify({ ...p.node, id: 'n0' })) as SketchNode).shape as Poly, def(35, 12, 20)), q = profileOf([next]);
  assert.ok('node' in q); assert.deepEqual(q.node.sideTags, p.node.sideTags);
  const doc2 = docOf(q.node); assert.ok(evaluateDoc(doc2, 1).ok);
  assert.ok(Math.abs(part('x', doc2).mass({ density: 1 }).volume / (Math.PI * 35 * 12 * 8) - 1) < 2e-5);
});

/** The rational B-spline's point at t (de Boor on the homogeneous poles). */
function nurbsAt(c: { degree: number; knots: number[]; points: number[][]; weights: number[] }, t: number): number[] {
  const p = c.degree, k = c.knots; let s = p; while (s < k.length - p - 2 && t >= k[s + 1]) s++;
  const d = Array.from({ length: p + 1 }, (_, j) => { const i = s - p + j, w = c.weights[i]; return [...c.points[i].map(v => v * w), w]; });
  for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) {
    const i = s - p + j, a = (t - k[i]) / (k[i + p - r + 1] - k[i]);
    d[j] = d[j].map((v, m) => (1 - a) * d[j - 1][m] + a * v);
  }
  const h = d[p]; return h.slice(0, 3).map(v => v / h[3]);
}

test('ellipseCurve: the degree-2 rational NURBS lies on the exact ellipse (1e-9 relative) at many parameters', () => {
  for (const d of [def(50, 50), def(50, 10, 33), def(10, 50, -70, [5, 5]), def(2000, 1500, 12, [-3000, 2000]), def(1, 0.2, 90)]) {
    const plane = xyPlane(), c = ellipseCurve(plane, d), last = c.knots[c.knots.length - 1];
    assert.equal(c.degree, 2); assert.equal(c.points.length, 9); assert.equal(c.weights.length, 9);
    let hit = 0;
    for (let k = 0; k <= 400; k++) {
      const t = last * k / 400, q = nurbsAt(c, t), e = implicit(d, [q[0], q[1]]);
      assert.ok(Math.abs(e) < 1e-9, `${JSON.stringify(d)} t ${t}: ${e}`); assert.equal(q[2], 0); hit++;
    }
    assert.equal(hit, 401);
    // Closed, and the start is the +rx end.
    const a = nurbsAt(c, 0), b = nurbsAt(c, last);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9 * d.rx);
    assert.ok(Math.hypot(a[0] - (d.center[0] + d.rx * Math.cos(d.angle * Math.PI / 180)), a[1] - (d.center[1] + d.rx * Math.sin(d.angle * Math.PI / 180))) < 1e-9 * d.rx);
  }
  // Through a sketch plane: the poles are mapped by it.
  const plane = { origin: [0, 0, 5] as [number, number, number], normal: [0, 0, 1] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] };
  assert.equal(ellipseCurve(plane, def(5, 3)).points.every(p => p[2] === 5), true);
});

// ── audit gaps ──
import { carryPolygon } from '../src/sketch/entityIds';
import { roundCorner } from '../src/sketch/corner';
import { ellipseSideEdge, ELLIPSE_SIDE_EDGE_REFUSAL, normalAngle } from '../src/sketch/ellipse';
import { commands, type Ctx } from '../src/app/commands';

test('outlineOf stores the ellipse definition only while the points still match it', () => {
  const s = settle(ellipseShape(def(30, 12, 20)));
  assert.deepEqual(outlineOf(s)?.ellipse, s.ellipse);
  const stale: Poly = { ...s, ellipse: def(31, 12, 20) };
  assert.equal(ellipseMatches(stale), false);
  assert.equal(outlineOf(stale)?.ellipse, undefined, 'a non-matching definition is not stored');
});

test('a corner edit and a point edit (carryPolygon) make the ellipse an ordinary outline', () => {
  const s = settle(ellipseShape(def(30, 12, 20)));
  // (A square carrying an ellipse definition stands in: rounding a real ellipse's tangent joint is refused, a square's corner is not.)
  const sq: Poly = { ...s, points: [[0, 0], [20, 0], [20, 10], [0, 10]], bulges: [0, 0, 0, 0], ids: undefined };
  const r = roundCorner(sq, 1, 3); assert.ok('shape' in r);
  assert.equal(r.shape.ellipse, undefined); assert.equal(r.shape.fromEllipse, undefined);
  const n = s.points.length, carried = carryPolygon(s, { ...s, points: s.points.slice() }, Array.from({ length: n }, (_, i) => i));
  assert.equal(carried.ellipse, undefined); assert.equal(carried.fromEllipse, undefined);
});

test('the angle is stored in [0, 360) and an unusable one is refused', () => {
  assert.equal(normalAngle(-90), 270); assert.equal(normalAngle(360), 0); assert.ok(Object.is(normalAngle(-0), 0)); assert.equal(normalAngle(725), 5);
  assert.equal(ellipseShape(def(30, 12, -90)).ellipse!.angle, 270);
  assert.ok(Object.is(ellipseShape(def(30, 12, -0)).ellipse!.angle, 0));
  const s = settle(ellipseShape(def(30, 12, 10)));
  assert.equal(reellipse(s, def(30, 12, 370)).ellipse!.angle, 10);
  assert.equal(ellipseError(def(30, 12, 1e20)), 'The angle is not a usable number.');
  assert.equal(ellipseError(def(30, 12, Infinity)) !== null, true);
  assert.equal(ellipseError(def(30, 12, -450)), null);
  assert.equal(wellFormedEllipse(def(30, 12, -90))?.angle, 270);
});

function bodyOf(shapes: Poly[] | SketchShape[]): StudioDoc {
  const p = profileOf(shapes.map(x => settle(x as Poly)) as SketchShape[]); assert.ok('node' in p, JSON.stringify(p));
  const base = part('e').extrude(sketch().polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), { h: 8 }).doc;
  return { ...base, nodes: base.nodes.map((n, i) => i === 0 ? { ...p.node, id: 'n0' } as unknown as SketchNode : n) };
}
const edgesOf = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok); return r.ok ? r.bodies : []; };
const ctxFor = (doc: StudioDoc, pick: (names: string[]) => boolean): Ctx | null => {
  const bodies = edgesOf(doc), i = bodies[0].mesh.edges.findIndex(e => pick(e.names));
  return i < 0 ? null : { doc, bodies, selection: { faces: [], edges: [{ body: 0, edge: i }], bodies: [] } };
};

test('fillet and chamfer on an ellipse extrude\'s top edge are unavailable with the reason and refused in build', () => {
  const doc = bodyOf([ellipseShape(def(30, 12, 20))]);
  const ctx = ctxFor(doc, n => n.some(x => /\.side\[/.test(x)) && n.some(x => /\.top$/.test(x)))!; assert.ok(ctx);
  assert.ok(ellipseSideEdge(doc.nodes, ctxFor(doc, n => n.some(x => /\.side\[/.test(x)))!.bodies[0].mesh.edges.find(e => e.names.some(x => /\.side\[/.test(x)))!.names[0]));
  for (const id of ['fillet', 'chamfer']) {
    const c = commands.find(x => x.id === id)!, a = c.available(ctx);
    assert.deepEqual(a, { ok: false, reason: ELLIPSE_SIDE_EDGE_REFUSAL });
    assert.match(ELLIPSE_SIDE_EDGE_REFUSAL, /ellipse's side edges are not supported yet/);
    assert.throws(() => c.build!(ctx, c.defaults!(ctx)), (e: Error) => e.message.includes('ellipse\'s side edges'));
  }
});

test('an ellipse hole loses its definition on Finish, so a body edge of it is an ordinary arc edge; the rectangle\'s edges stay allowed', () => {
  const rect: Poly = { kind: 'polygon', closed: true, points: [[-50, -30], [50, -30], [50, 30], [-50, 30]], bulges: [0, 0, 0, 0] };
  const doc = bodyOf([rect, ellipseShape(def(20, 8, 0))]);
  const sk = doc.nodes[0] as SketchNode;
  assert.equal((sk as { outline?: { ellipse?: unknown } }).outline?.ellipse, undefined, 'a hole keeps no definition');
  for (const id of ['fillet', 'chamfer']) {
    const c = commands.find(x => x.id === id)!;
    const rectEdge = ctxFor(doc, n => n.some(x => /\.top$/.test(x)) && n.some(x => /\.side\[/.test(x)))!; assert.ok(rectEdge);
    assert.deepEqual(c.available(rectEdge), { ok: true });
  }
  assert.equal(ellipseSideEdge(doc.nodes, 'n1.side[e1]|n1.top'), false);
});
