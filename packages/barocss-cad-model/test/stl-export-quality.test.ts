import test from 'node:test';
import assert from 'node:assert/strict';
import { part } from '../src/api';
import { evaluatePart, stlFor } from '../src/engine/evaluate';

const fixture = () => part('export-quality').box({ w: 10, d: 10, h: 2 })
  .hole(b => b.faces().facing('+z'), { d: 1, x: 5, y: 5 });
type Point = [number, number, number];
const radius = 0.5, coordinateToleranceMM = 1e-9;
// Float32 rounding at coordinates within 0..10 mm; separate from the inherited coordinate tolerance.
const float32XYRoundingMM = Math.SQRT2 * 2 ** -21;
const pointKey = (p: Point) => p.join(',');

function readTriangles(bytes: Uint8Array): { count: number; points: Point[] } {
  assert.ok(bytes.length >= 84);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), count = view.getUint32(80, true);
  assert.ok(count > 0);
  assert.equal(bytes.length, 84 + 50 * count);
  const points: Point[] = [];
  for (let t = 0; t < count; t++) {
    const base = 84 + 50 * t;
    for (let k = 0; k < 3; k++) assert.ok(Number.isFinite(view.getFloat32(base + 4 * k, true)));
    for (let j = 0; j < 3; j++) {
      const p: Point = [0, 0, 0];
      for (let k = 0; k < 3; k++) p[k] = view.getFloat32(base + 12 + 12 * j + 4 * k, true);
      assert.ok(p.every(Number.isFinite)); points.push(p);
    }
  }
  return { count, points };
}

function checkClosedHole(points: Point[]): void {
  const vertices = new Set(points.map(pointKey)), edges = new Map<string, { uses: number; direction: number }>();
  const neighbors = new Map<string, Set<string>>();
  for (let i = 0; i < points.length; i += 3) {
    const [a, b, c] = points.slice(i, i + 3), u = b.map((x, k) => x - a[k]), v = c.map((x, k) => x - a[k]);
    assert.ok(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) > 0);
    for (let k = 0; k < 3; k++) {
      const x = pointKey(points[i + k]), y = pointKey(points[i + (k + 1) % 3]);
      const key = x < y ? `${x}|${y}` : `${y}|${x}`, edge = edges.get(key) ?? { uses: 0, direction: 0 };
      edge.uses++; edge.direction += x < y ? 1 : -1; edges.set(key, edge);
      for (const [from, to] of [[x, y], [y, x]]) {
        const next = neighbors.get(from) ?? new Set<string>(); next.add(to); neighbors.set(from, next);
      }
    }
  }
  for (const edge of edges.values()) { assert.equal(edge.uses, 2); assert.equal(edge.direction, 0); }
  const visited = new Set<string>(), pending = [pointKey(points[0])];
  while (pending.length) {
    const vertex = pending.pop()!; if (visited.has(vertex)) continue;
    visited.add(vertex); for (const next of neighbors.get(vertex) ?? []) if (!visited.has(next)) pending.push(next);
  }
  assert.equal(visited.size, vertices.size, 'one connected STL surface');
  assert.equal(vertices.size - edges.size + points.length / 3, 0, 'one through-hole plate has Euler characteristic zero');
}

function checkRim(points: Point[], q: number, z: number): number {
  const n = 4 * q, bound = float32XYRoundingMM + coordinateToleranceMM;
  const expectedSagitta = radius * (1 - Math.cos(Math.PI / (4 * q)));
  const vertices = new Map<number, string>(), edges = new Map<string, [Point, Point, number, number]>();
  const onRim = (p: Point) => p[2] === z && Math.abs(Math.hypot(p[0] - 5, p[1] - 5) - radius) <= bound;
  const indexOf = (p: Point) => {
    const angle = Math.atan2(p[1] - 5, p[0] - 5), j = ((Math.round(angle * n / (2 * Math.PI)) % n) + n) % n;
    const angleExpected = 2 * Math.PI * j / n;
    assert.ok(Math.hypot(p[0] - (5 + radius * Math.cos(angleExpected)), p[1] - (5 + radius * Math.sin(angleExpected))) <= bound);
    const prior = vertices.get(j), key = pointKey(p);
    if (prior !== undefined) assert.equal(prior, key, 'one encoded point per angular sample');
    vertices.set(j, key); return j;
  };
  for (let i = 0; i < points.length; i += 3) for (let k = 0; k < 3; k++) {
    const a = points[i + k], b = points[i + (k + 1) % 3];
    if (!onRim(a) || !onRim(b)) continue;
    const ja = indexOf(a), jb = indexOf(b), gap = Math.abs(ja - jb);
    assert.ok(gap === 1 || gap === n - 1, 'rim edges connect adjacent independent angular samples');
    edges.set(ja < jb ? `${ja}/${jb}` : `${jb}/${ja}`, [a, b, ja, jb]);
  }
  assert.equal(vertices.size, n); assert.equal(edges.size, n);
  const degrees = new Array<number>(n).fill(0);
  let maximumSagitta = 0;
  for (const [a, b, ja, jb] of edges.values()) {
    degrees[ja]++; degrees[jb]++;
    const sagitta = radius - Math.hypot((a[0] + b[0]) / 2 - 5, (a[1] + b[1]) / 2 - 5);
    assert.ok(Math.abs(sagitta - expectedSagitta) <= bound, `${sagitta} vs ${expectedSagitta} mm`);
    maximumSagitta = Math.max(maximumSagitta, sagitta);
  }
  assert.ok(degrees.every(d => d === 2));
  return maximumSagitta;
}

test('STL export quality follows its own sampling and preserves the document and display mesh', t => {
  const p = fixture(), doc = p.doc, keys = p.bodies(); assert.equal(keys.length, 1);
  const key = keys[0], saved = JSON.stringify(doc), beforeDoc = structuredClone(doc);
  const display = evaluatePart(doc, 1, 8, 'probe'); assert.ok(display.ok);
  const body = display.bodies.find(b => b.key === key); assert.ok(body); assert.equal(body.mesh.quality, 8);
  const beforeMesh = structuredClone(body.mesh);
  let previousSagitta = Infinity;
  for (const q of [8, 16, 32]) {
    const options = Object.freeze({ segmentsPerQuarter: q }), bytes = stlFor(doc, key, options); assert.ok(bytes);
    const { count, points } = readTriangles(bytes); checkClosedHole(points);
    const sagitta = Math.max(checkRim(points, q, 0), checkRim(points, q, 2));
    assert.ok(sagitta < previousSagitta); previousSagitta = sagitta;
    // Record the first observed count. Twist refinement can add rows: no 144/272/528 exact-count gate.
    t.diagnostic(JSON.stringify({ segmentsPerQuarter: q, triangles: count, bytes: bytes.length, maximumRimSagittaMM: sagitta }));
    assert.equal(options.segmentsPerQuarter, q);
    assert.deepEqual(doc, beforeDoc); assert.equal(JSON.stringify(doc), saved); assert.deepEqual(body.mesh, beforeMesh);
  }
  const after = evaluatePart(doc, 2, 8, 'probe'); assert.ok(after.ok);
  const afterBody = after.bodies.find(b => b.key === key); assert.ok(afterBody);
  assert.deepEqual(afterBody.mesh, beforeMesh);
});

test('STL export keeps default sixteen, missing-key null and rejects non-finite quality', () => {
  const p = fixture(), doc = p.doc, keys = p.bodies(); assert.equal(keys.length, 1);
  const key = keys[0], before = structuredClone(doc), saved = JSON.stringify(doc);
  const explicit = stlFor(doc, key, { segmentsPerQuarter: 16 }); assert.ok(explicit);
  assert.deepEqual(stlFor(doc, key), explicit);
  assert.deepEqual(stlFor(doc, key, {}), explicit);
  assert.equal(stlFor(doc, '__missing_export_quality_body__', { segmentsPerQuarter: 16 }), null);
  for (const q of [NaN, Infinity, -Infinity]) assert.equal(stlFor(doc, key, { segmentsPerQuarter: q }), null);
  assert.deepEqual(doc, before); assert.equal(JSON.stringify(doc), saved);
});
