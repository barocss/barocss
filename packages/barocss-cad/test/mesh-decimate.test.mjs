import test from 'node:test';
import assert from 'node:assert/strict';
import { decimateMesh, meshDistance, evaluateCadPart, CadPartError, outputOf, checkOutput, massPropertiesOf } from '../dist/index.js';

// R9 (M4, D85): QEM decimation — feature lines kept (open edges, groups, creases), never a fold or a broken manifold,
// the distance measured both ways.

function icosphere(r, levels, jitter = 0) {
  const t = (1 + Math.sqrt(5)) / 2;
  const P = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => { const l = Math.hypot(...p); return p.map(x => x / l); });
  let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let l = 0; l < levels; l++) {
    const mid = new Map(), m = (a, b) => { const k = a < b ? `${a},${b}` : `${b},${a}`; if (!mid.has(k)) { const p = P[a].map((x, i) => (x + P[b][i]) / 2), q = Math.hypot(...p); mid.set(k, P.push(p.map(x => x / q)) - 1); } return mid.get(k); };
    F = F.flatMap(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
  }
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  return { positions: P.flatMap(p => { const k = 1 + jitter * rnd(); return p.map(x => x * r * k); }), indices: F.flat() };
}
/** A box s on a side, each side an n × n grid of triangle pairs; `group` gives each triangle's group (side, i, j). */
function gridBox(n, s = 10, group = null) {
  const at = new Map(), P = [], F = [], G = [];
  const v = p => { const k = p.join(); if (!at.has(k)) { at.set(k, P.length / 3); P.push(...p.map(x => x * s / n)); } return at.get(k); };
  let side = 0;
  for (const a of [0, 1, 2]) for (const e of [0, n]) {
    const [b, c] = e ? [(a + 1) % 3, (a + 2) % 3] : [(a + 2) % 3, (a + 1) % 3];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const q = (u, w) => { const p = [0, 0, 0]; p[a] = e; p[b] = u; p[c] = w; return v(p); };
      F.push([q(i, j), q(i + 1, j), q(i + 1, j + 1)], [q(i, j), q(i + 1, j + 1), q(i, j + 1)]);
      const g = group ? group(side, i, j) : side; G.push(g, g);
    }
    side++;
  }
  return { positions: P, indices: F.flat(), groups: G };
}
/** A flat (or wavy) square sheet, n × n triangle pairs. */
function sheet(n, s = 10, wave = 0) {
  const P = [], F = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const x = i * s / n, y = j * s / n; P.push(x, y, wave * Math.sin(x / 2) * Math.cos(y / 3)); }
  const at = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) F.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
  return { positions: P, indices: F };
}
/** Closed, each directed edge once with its twin; the signed volume. */
function closedVolume(P, I) {
  const e = new Set();
  for (let t = 0; t < I.length / 3; t++) for (let k = 0; k < 3; k++) { const key = `${I[3 * t + k]}>${I[3 * t + (k + 1) % 3]}`; assert.ok(!e.has(key), `edge ${key} twice`); e.add(key); }
  for (const key of e) { const [a, b] = key.split('>'); assert.ok(e.has(`${b}>${a}`), `open at ${key}`); }
  let vol = 0;
  for (let t = 0; t < I.length / 3; t++) { const [a, b, c] = [0, 1, 2].map(k => [0, 1, 2].map(j => P[3 * I[3 * t + k] + j])); vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; }
  return vol;
}
const pointSet = P => new Set(Array.from({ length: P.length / 3 }, (_, v) => [0, 1, 2].map(k => +P[3 * v + k].toFixed(9)).join()));

test('R9 a gridded box (1 200 triangles) decimates to its 12: the corners exactly, the creases kept, no distance at all; the volume 1000', () => {
  const b = gridBox(10), r = decimateMesh(b.positions, b.indices, { targetTriangles: 0 });
  assert.deepEqual([r.report.trianglesAfter, r.report.verticesAfter, r.report.stoppedBy], [12, 8, 'exhausted']);
  assert.deepEqual([...pointSet(r.positions)].sort(), ['0,0,0', '0,0,10', '0,10,0', '0,10,10', '10,0,0', '10,0,10', '10,10,0', '10,10,10']);
  assert.ok(Math.abs(closedVolume(r.positions, r.indices) - 1000) < 1e-9);
  assert.ok(r.report.distance.hausdorff < 1e-12 && r.report.bound < 1e-12, JSON.stringify(r.report.distance));
});

test('R9 a sphere (20 480 triangles, r 10): to a tenth and a fiftieth — closed, wound as before, near the original (measured both ways, the same as meshDistance finds); the same result every run', () => {
  const s = icosphere(10, 5), v0 = closedVolume(s.positions, s.indices);
  for (const [ratio, within] of [[0.1, 0.05], [0.02, 0.25]]) {
    const r = decimateMesh(s.positions, s.indices, { ratio }), d = r.report.distance;
    // (A collapse takes two triangles: at the target or one under it.)
    assert.ok(r.report.trianglesAfter <= Math.floor(ratio * 20480) && r.report.trianglesAfter >= Math.floor(ratio * 20480) - 1); assert.equal(r.report.stoppedBy, 'target');
    const v = closedVolume(r.positions, r.indices);
    assert.ok(v > 0 && Math.abs(v / v0 - 1) < 0.02, `${v} vs ${v0}`);
    assert.ok(d.hausdorff < within, `${ratio}: ${d.hausdorff} mm`);
    assert.equal(d.toResultMax, meshDistance(s.positions, s.indices, r.positions, r.indices).max);
    assert.equal(d.toOriginalMax, meshDistance(r.positions, r.indices, s.positions, s.indices).max);
    assert.ok(d.rms < d.hausdorff && d.samples > 0);
  }
  const a = decimateMesh(s.positions, s.indices, { ratio: 0.1, measure: false }), b = decimateMesh(s.positions, s.indices, { ratio: 0.1, measure: false });
  assert.deepEqual([...a.positions], [...b.positions]); assert.deepEqual([...a.indices], [...b.indices]);
});

/** Triangles turned in (their normal against the way out from the origin), and the worst one's cosine. */
function inward(P, I) {
  let n = 0, worst = 1;
  for (let t = 0; t < I.length / 3; t++) {
    const [a, b, c] = [0, 1, 2].map(k => [0, 1, 2].map(j => P[3 * I[3 * t + k] + j]));
    const nn = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])], m = [0, 1, 2].map(k => a[k] + b[k] + c[k]);
    const cos = (nn[0] * m[0] + nn[1] * m[1] + nn[2] * m[2]) / Math.hypot(...nn) / Math.hypot(...m);
    if (cos <= 0) n++; worst = Math.min(worst, cos);
  }
  return { n, worst };
}
test('R9 a noisy sphere (each vertex off by up to ±2.5%): as a scan (no crease angle) to a twentieth — closed, every triangle facing out, within 0.6 mm; with the 40° crease angle the noise is creases: it stops early, nothing turned past 95°', () => {
  const s = icosphere(10, 5, 0.05);
  assert.equal(inward(s.positions, s.indices).n, 0);
  const r = decimateMesh(s.positions, s.indices, { ratio: 0.05, feature: 180 });
  assert.ok(r.report.trianglesAfter <= 1024 && r.report.stoppedBy === 'target');
  assert.ok(closedVolume(r.positions, r.indices) > 0.9 * closedVolume(s.positions, s.indices));
  assert.equal(inward(r.positions, r.indices).n, 0);
  assert.ok(r.report.distance.hausdorff < 0.6, String(r.report.distance.hausdorff));
  assert.ok(r.report.refused.flip > 0, 'folds were refused');
  const c = decimateMesh(s.positions, s.indices, { ratio: 0.05 });
  assert.equal(c.report.stoppedBy, 'exhausted'); assert.ok(c.report.trianglesAfter > 10000);
  closedVolume(c.positions, c.indices);
  assert.ok(inward(c.positions, c.indices).worst > Math.cos(95 * Math.PI / 180), String(inward(c.positions, c.indices).worst));
});

test('R9 groups are kept: a box whose top has a 4 × 4 patch of its own — the patch keeps its square and area, every group keeps triangles, each triangle its group', () => {
  const b = gridBox(8, 8, (side, i, j) => side === 5 && i >= 2 && i < 6 && j >= 2 && j < 6 ? 9 : side);
  const r = decimateMesh(b.positions, b.indices, { targetTriangles: 0, groups: b.groups });
  assert.deepEqual([...new Set(r.groups)].sort((x, y) => x - y), [0, 1, 2, 3, 4, 5, 9]);
  let patch = 0;
  for (let t = 0; t < r.indices.length / 3; t++) {
    if (r.groups[t] !== 9) continue;
    const [a, b2, c] = [0, 1, 2].map(k => [0, 1, 2].map(j => r.positions[3 * r.indices[3 * t + k] + j]));
    assert.ok([a, b2, c].every(p => p[2] === 8 && p[0] >= 2 && p[0] <= 6 && p[1] >= 2 && p[1] <= 6), 'inside its square');
    patch += Math.abs((b2[0] - a[0]) * (c[1] - a[1]) - (b2[1] - a[1]) * (c[0] - a[0])) / 2;
  }
  assert.ok(Math.abs(patch - 16) < 1e-9, String(patch));
  for (const corner of ['2,2,8', '6,2,8', '6,6,8', '2,6,8']) assert.ok(pointSet(r.positions).has(corner), corner);
  assert.ok(Math.abs(closedVolume(r.positions, r.indices) - 512) < 1e-9);
});

test('R9 an open sheet keeps its boundary: flat, two triangles and its four corners; wavy, its edges still on the square', () => {
  const f = sheet(12), r = decimateMesh(f.positions, f.indices, { targetTriangles: 0 });
  assert.equal(r.report.trianglesAfter, 2);
  assert.deepEqual([...pointSet(r.positions)].sort(), ['0,0,0', '0,10,0', '10,0,0', '10,10,0']);
  const w = sheet(24, 10, 1), q = decimateMesh(w.positions, w.indices, { ratio: 0.2 });
  assert.ok(q.report.trianglesAfter <= 0.2 * 1152);
  // (Each boundary edge's ends on one side of the square.)
  const count = new Map(), I = q.indices, P = q.positions;
  for (let t = 0; t < I.length / 3; t++) for (let k = 0; k < 3; k++) { const a = I[3 * t + k], b = I[3 * t + (k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; count.set(key, (count.get(key) ?? 0) + 1); }
  for (const [key, n] of count) {
    if (n !== 1) continue;
    const [a, b] = key.split(',').map(Number), on = (v, k, x) => Math.abs(P[3 * v + k] - x) < 1e-9;
    assert.ok([[0, 0], [0, 10], [1, 0], [1, 10]].some(([k, x]) => on(a, k, x) && on(b, k, x)), `boundary edge ${key} off the square`);
  }
});

test('R9 stopped by an error bound: no collapse past it (its quadric bound), said so', () => {
  const s = icosphere(10, 5), r = decimateMesh(s.positions, s.indices, { maxError: 0.05 });
  assert.equal(r.report.stoppedBy, 'error'); assert.ok(r.report.bound <= 0.05);
  assert.ok(r.report.trianglesAfter < 20480 && r.report.trianglesAfter > 200, String(r.report.trianglesAfter));
  assert.throws(() => decimateMesh([0, 0], [0, 1, 2]), RangeError);
});

test('R9 the decimate feature: a gridded mesh box as far as it goes (its 12 triangles), its faces keeping their names, a valid solid with its report; refused on an exact body and without a target', () => {
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const b = gridBox(10), mesh = { id: 'm', kind: 'mesh', positions: b.positions, indices: b.indices, representation: 'facets' };
  const src = outputOf(evaluateCadPart(D([mesh])), 'm'), out = outputOf(evaluateCadPart(D([mesh, { id: 'd', kind: 'decimate', target: 'm', triangles: 4 }])), 'd');
  assert.equal(checkOutput(out).valid, true);
  assert.deepEqual(out.brep.faces.map(f => f.name).sort(), src.brep.faces.map(f => f.name).sort());
  assert.ok(Math.abs(massPropertiesOf(out).volume - 1000) < 1e-9);
  assert.equal(out.decimate.trianglesAfter, 12); assert.equal(out.representation, 'faceted');
  const refused = (features, code, msg) => assert.throws(() => evaluateCadPart(D(features)), e => e instanceof CadPartError && e.code === code && msg.test(e.message));
  refused([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'e', kind: 'extrude', sketch: 's', height: 5 }, { id: 'd', kind: 'decimate', target: 'e', ratio: 0.5 }], 'CAPABILITY', /mesh body/);
  refused([mesh, { id: 'd', kind: 'decimate', target: 'm' }], 'INPUT', /triangles, ratio or maxError/);
  refused([mesh, { id: 'd', kind: 'decimate', target: 'm', ratio: 1.5 }], 'INPUT', /ratio/);
});

test('R7 decimation wallTime is seconds and preserves a triangle when no collapse is requested', t => {
  let next = 2000;
  const clock = t.mock.method(performance, 'now', () => { const value = next; next += 500; return value; });
  const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0], indices = [0, 1, 2];
  const result = decimateMesh(positions, indices, { targetTriangles: 1, measure: false });
  assert.equal(clock.mock.callCount(), 2);
  assert.equal(result.report.wallTime, 0.5);
  assert.equal(Object.hasOwn(result.report, 'ms'), false);
  assert.deepEqual(Array.from(result.positions), positions); assert.deepEqual(Array.from(result.indices), indices);
  assert.equal(JSON.parse(JSON.stringify(result.report)).wallTime, 0.5);
});
