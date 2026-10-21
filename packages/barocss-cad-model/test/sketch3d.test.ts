import test from 'node:test';
import assert from 'node:assert/strict';
import { solveSketch3D, sketch3dRefusal, type Constraint3D, type V3 } from '../src/frames/sketch3d';

// FRg (O122): the 3D skeleton sketch's solver against closed-form constructions — a tetrahedron of given edges (one
// corner fixed, one on the x axis, one on the xy plane: no freedom left, each edge to 1e-9, its third corner where the
// trilateration puts it); a rectangle of given sides square in 3D; the freedoms left counted (a free segment 5, a
// rectangle fixed at one corner 3); a conflict (a triangle that cannot close) named; a redundant constraint named.

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const angleOf = (u: readonly number[], v: readonly number[]) => Math.acos((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(u[0], u[1], u[2]) * Math.hypot(v[0], v[1], v[2]))) * 180 / Math.PI;
const sub = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

test('FRg a tetrahedron of edges 3, √5, √6, √8, 3, √5 (corners (0,0,0) (3,0,0) (1,2,0) (1,1,2)): p0 fixed, p1 on the x axis, p2 on the xy plane — well constrained (0 freedoms), every edge to 1e-9, p1 = (3, 0, 0), p2 = (1, ±2, 0), p3 = (1, ±1, ±2); edges 3 4 5 6 7 8, which bound no tetrahedron — a conflict', () => {
  const E = [[0, 1, 3], [0, 2, Math.sqrt(5)], [0, 3, Math.sqrt(6)], [1, 2, Math.sqrt(8)], [1, 3, 3], [2, 3, Math.sqrt(5)]] as const;
  const points: V3[] = [[0.1, -0.2, 0.3], [2.5, 0.4, -0.2], [1, 3, 0.5], [0.5, 1, 4]], segments = E.map(([a, b]) => [a, b] as [number, number]);
  const cs: Constraint3D[] = [{ kind: 'fixed', point: 0 }, { kind: 'on-axis', point: 1, axis: 'x' }, { kind: 'on-plane', point: 2, plane: { origin: [0, 0, 0], normal: [0, 0, 1] } }, ...E.map(([, , L], k) => ({ kind: 'length', segment: k, value: L }) as Constraint3D)];
  assert.equal(sketch3dRefusal(points, segments, cs), null);
  const s = solveSketch3D(points, segments, cs);
  assert.deepEqual([s.status, s.dof, s.redundant, s.unmet, s.free], ['well', 0, [], [], []]);
  for (const [a, b, L] of E) assert.ok(Math.abs(dist(s.points[a], s.points[b]) - L) <= 1e-9, `${a}-${b}`);
  const near = (a: readonly number[], b: readonly number[]) => a.every((v, k) => Math.abs(Math.abs(v) - Math.abs(b[k])) <= 1e-9);
  assert.ok(near(s.points[1], [3, 0, 0]) && near(s.points[2], [1, 2, 0]) && near(s.points[3], [1, 1, 2]), JSON.stringify(s.points));
  // (Edges no tetrahedron has — its Cayley–Menger determinant is negative — cannot all be met.)
  const bad = [3, 4, 5, 6, 7, 8], none = solveSketch3D(points, segments, [...cs.slice(0, 3), ...bad.map((L, k) => ({ kind: 'length', segment: k, value: L }) as Constraint3D)]);
  assert.equal(none.status, 'conflict'); assert.ok(none.unmet.length > 0);
});

test('FRg a rectangle 30 × 20 square in 3D (a tilted start): p0 fixed, the sides\' lengths, the corners square, opposite sides parallel — every side and right angle to 1e-9, planar; 3 freedoms left (turning about p0); p1 on an axis through p0 — 1', () => {
  const points: V3[] = [[0, 0, 0], [28, 3, 4], [27, 22, 9], [-2, 19, 6]], segments: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0]];
  const sides: Constraint3D[] = [{ kind: 'length', segment: 0, value: 30 }, { kind: 'length', segment: 1, value: 20 }, { kind: 'perpendicular', a: 0, b: 1 }, { kind: 'parallel', a: 0, b: 2 }, { kind: 'parallel', a: 1, b: 3 }];
  const s = solveSketch3D(points, segments, [{ kind: 'fixed', point: 0 }, ...sides]);
  assert.deepEqual([s.status, s.dof], ['under', 3], JSON.stringify(s));
  const P = s.points;
  for (const [a, b, L] of [[0, 1, 30], [1, 2, 20], [2, 3, 30], [3, 0, 20]]) assert.ok(Math.abs(dist(P[a], P[b]) - L) <= 1e-9, `side ${a}-${b}: ${dist(P[a], P[b])}`);
  for (const k of [0, 1, 2, 3]) assert.ok(Math.abs(angleOf(sub(P[(k + 1) % 4], P[k]), sub(P[(k + 3) % 4], P[k])) - 90) <= 1e-7, `corner ${k}`);
  assert.deepEqual(s.free, [1, 2, 3]);
  const pinned = solveSketch3D(points, segments, [{ kind: 'fixed', point: 0 }, { kind: 'along', segment: 0, axis: 'x' }, ...sides]);
  assert.deepEqual([pinned.status, pinned.dof], ['under', 1], JSON.stringify(pinned));
  assert.ok(Math.abs(pinned.points[1][0] - 30) <= 1e-9 || Math.abs(pinned.points[1][0] + 30) <= 1e-9);
});

test('FRg the freedoms counted: one free segment of length 10 — 5 (3 moves, 2 turns); two points coincident — 3; nothing at all — 3 a point', () => {
  const one = solveSketch3D([[0, 0, 0], [3, 4, 5]], [[0, 1]], [{ kind: 'length', segment: 0, value: 10 }]);
  assert.deepEqual([one.status, one.dof], ['under', 5]); assert.ok(Math.abs(dist(one.points[0], one.points[1]) - 10) <= 1e-9);
  assert.equal(solveSketch3D([[0, 0, 0], [1, 1, 1]], [], [{ kind: 'coincident', a: 0, b: 1 }]).dof, 3);
  assert.equal(solveSketch3D([[0, 0, 0], [1, 1, 1]], [], []).dof, 6);
});

test('FRg diagnosis, typed: a triangle 1 1 5 cannot close — conflict, its unmet lengths named; a length given twice — over, the second redundant; a bad index refused', () => {
  const tri = solveSketch3D([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 1], [1, 2], [2, 0]], [{ kind: 'length', segment: 0, value: 1 }, { kind: 'length', segment: 1, value: 1 }, { kind: 'length', segment: 2, value: 5 }]);
  assert.equal(tri.status, 'conflict'); assert.ok(tri.unmet.length >= 1 && tri.unmet.every(u => u.residual > 1e-9), JSON.stringify(tri.unmet));
  const twice = solveSketch3D([[0, 0, 0], [3, 4, 0]], [[0, 1]], [{ kind: 'fixed', point: 0 }, { kind: 'length', segment: 0, value: 10 }, { kind: 'distance', a: 0, b: 1, value: 10 }]);
  assert.deepEqual([twice.status, twice.redundant, twice.dof], ['over', [2], 2]);
  assert.match(sketch3dRefusal([[0, 0, 0]], [], [{ kind: 'fixed', point: 3 }])!, /constraint 0 \(fixed\): a point of the sketch/);
});

test('FRg a skeleton with constraints through the chat: a rectangle 600 × 400 from a rough start, solved on add (diagnosis returned), a mitred frame on it A · L; its length constraint edited to 800, solved again, the frame follows; a constraint that cannot hold refused (SKETCH3D_CONFLICT, named)', async () => {
  const { dispatchTool } = await import('../src/chat/tools'), { evaluatePart } = await import('../src/engine/evaluate'), { emptyDoc } = await import('../src/engine/doc');
  const evaluate = async (d: Parameters<typeof evaluatePart>[0]) => evaluatePart(d, 1);
  const cs = (L: number): Constraint3D[] => [{ kind: 'fixed', point: 0 }, { kind: 'along', segment: 0, axis: 'x' }, { kind: 'on-plane', point: 2, plane: { origin: [0, 0, 0], normal: [0, 0, 1] } }, { kind: 'length', segment: 0, value: L }, { kind: 'length', segment: 1, value: 400 }, { kind: 'perpendicular', a: 0, b: 1 }, { kind: 'parallel', a: 0, b: 2 }, { kind: 'parallel', a: 1, b: 3 }];
  const sk = (L: number) => ({ kind: 'skeleton', points: [[0, 0, 0], [590, 10, 0], [610, 390, 5], [-5, 405, 3]], segments: [[0, 1], [1, 2], [2, 3], [3, 0]], constraints: cs(L) });
  const frame = { kind: 'frame', follows: { skeleton: 0 }, section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } };
  let r = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'add_features', { features: [sk(600), frame] }, evaluate);
  assert.ok(!r.isError, r.content);
  const out = JSON.parse(r.content);
  assert.equal(out.skeletons[0].feature, 0); assert.ok(['well', 'under'].includes(out.skeletons[0].status), JSON.stringify(out.skeletons));
  const A = 1600 - 34 * 34, vols = (s: typeof r.state) => s.bodies.map(b => b.volumeMM3!).sort((a, b) => a - b);
  const close = (a: number[], b: number[]) => assert.ok(a.every((v, k) => Math.abs(v - b[k]) <= 1e-6 * b[k]), `${a} vs ${b}`);
  close(vols(r.state), [400, 400, 600, 600].map(L => A * L));
  r = await dispatchTool(r.state, 'edit_feature', { index: 0, feature: sk(800) }, evaluate); assert.ok(!r.isError, r.content);
  close(vols(r.state), [400, 400, 800, 800].map(L => A * L));
  const bad = await dispatchTool(r.state, 'edit_feature', { index: 0, feature: { ...sk(800), constraints: [...cs(800), { kind: 'distance', a: 0, b: 2, value: 10 }] } }, evaluate);
  assert.ok(bad.isError); assert.match(JSON.parse(bad.content).error, /\[SKETCH3D_CONFLICT\] the skeleton's constraints cannot all hold: .*constraint \d+ \((length|distance|perpendicular|parallel)\)/);
});
