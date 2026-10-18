import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseMesh, repairMesh, selfIntersections, facetBrepFromTriangles, facetBrepsFromTriangles, checkBrep, evaluateCadPart, CadPartError, DEFAULT_REPAIR } from '../dist/index.js';

// M3 (R3.4): the broken set — a hole, flipped triangles, a fin, floaters, degenerate and duplicate triangles, crossing
// shells, an open sheet — each diagnosed, repaired by explicit steps, with the report it should give.

/** A 20 × 10 × 5 box whose top is a 4 × 2 grid of 5 mm squares (so a square hole can be cut in it), wound outward. */
function gridBox() {
  const P = [], I = [], at = new Map();
  const v = (x, y, z) => { const k = `${x},${y},${z}`; let i = at.get(k); if (i === undefined) { i = P.length / 3; P.push(x, y, z); at.set(k, i); } return i; };
  const quad = (a, b, c, d) => I.push(a, b, c, a, c, d);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) quad(v(5 * i, 5 * j, 5), v(5 * i + 5, 5 * j, 5), v(5 * i + 5, 5 * j + 5, 5), v(5 * i, 5 * j + 5, 5)); // top, +z
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) quad(v(5 * i, 5 * j, 0), v(5 * i, 5 * j + 5, 0), v(5 * i + 5, 5 * j + 5, 0), v(5 * i + 5, 5 * j, 0)); // bottom, −z
  for (let i = 0; i < 4; i++) { quad(v(5 * i, 0, 0), v(5 * i + 5, 0, 0), v(5 * i + 5, 0, 5), v(5 * i, 0, 5)); quad(v(5 * i, 10, 0), v(5 * i, 10, 5), v(5 * i + 5, 10, 5), v(5 * i + 5, 10, 0)); }
  for (let j = 0; j < 2; j++) { quad(v(0, 5 * j, 0), v(0, 5 * j, 5), v(0, 5 * j + 5, 5), v(0, 5 * j + 5, 0)); quad(v(20, 5 * j, 0), v(20, 5 * j + 5, 0), v(20, 5 * j + 5, 5), v(20, 5 * j, 5)); }
  return { P, I };
}
/** A UV sphere, outward. */
function sphere(r, n, m, c = [0, 0, 0]) {
  const P = [c[0], c[1], c[2] - r], I = [];
  for (let j = 1; j < m; j++) { const phi = -Math.PI / 2 + Math.PI * j / m; for (let i = 0; i < n; i++) { const th = 2 * Math.PI * i / n; P.push(c[0] + r * Math.cos(phi) * Math.cos(th), c[1] + r * Math.cos(phi) * Math.sin(th), c[2] + r * Math.sin(phi)); } }
  P.push(c[0], c[1], c[2] + r);
  const top = P.length / 3 - 1, at = (j, i) => 1 + (j - 1) * n + (i % n);
  for (let i = 0; i < n; i++) I.push(0, at(1, i + 1), at(1, i));
  for (let j = 1; j < m - 1; j++) for (let i = 0; i < n; i++) I.push(at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j, i), at(j + 1, i + 1), at(j + 1, i));
  for (let i = 0; i < n; i++) I.push(at(m - 1, i), at(m - 1, i + 1), top);
  return { P, I };
}
const volumeOf = (P, I) => { let v = 0; for (let t = 0; t < I.length; t += 3) { const [a, b, c] = [I[t], I[t + 1], I[t + 2]].map(k => [P[3 * k], P[3 * k + 1], P[3 * k + 2]]); v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]); } return v / 6; };
const addBox = (P, I, c, h) => { const b = P.length / 3; for (let k = 0; k < 8; k++) P.push(c[0] + (k & 1 ? h : -h), c[1] + (k & 2 ? h : -h), c[2] + (k & 4 ? h : -h)); for (const [a, e, f, d] of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) I.push(b + a, b + e, b + f, b + a, b + f, b + d); };

test('a clean box: nothing to report; repair leaves it as it was', () => {
  const { P, I } = gridBox(), d = diagnoseMesh(P, I);
  assert.deepEqual([d.degenerate, d.duplicates, d.nonManifoldEdges, d.inconsistentEdges, d.holes.length, d.pieces, d.selfIntersections, d.closed], [0, 0, 0, 0, 0, 1, 0, true]);
  const r = repairMesh(P, I);
  assert.equal(r.indices.length, I.length); assert.ok(r.report.closed);
  assert.ok(Math.abs(volumeOf(r.positions, r.indices) - 1000) < 1e-9);
});

test('a square hole in the flat top: found (8 rim edges, 20 mm), filled flat — the volume exactly the box\'s again, the patch its own face', () => {
  const { P, I } = gridBox();
  // The top's middle 2 × 1 squares (x 5..15, y 0..5 and 5..10? — the two middle columns' lower cells): 4 triangles out.
  const cut = I.slice(); cut.splice(6 * 1, 6); cut.splice(6 * 2, 6); // top cells (1,0) and (2,0) → a 10 × 5 hole
  const d = diagnoseMesh(P, cut);
  assert.equal(d.holes.length, 1); assert.equal(d.closed, false);
  assert.ok(Math.abs(d.holes[0].perimeterMM - 30) < 1e-9, String(d.holes[0].perimeterMM));
  const r = repairMesh(P, cut);
  assert.deepEqual([r.report.holesFilled, r.report.holesLeft, r.report.closed], [1, 0, true]);
  assert.ok(Math.abs(r.report.filledAreaMM2 - 50) < 1e-9, String(r.report.filledAreaMM2));
  assert.ok(Math.abs(volumeOf(r.positions, r.indices) - 1000) < 1e-9, 'a planar fill closes it exactly');
  // Built with its fill groups, the patch is a face of its own (named so), and the body is a valid solid.
  const b = facetBrepFromTriangles(r.positions, r.indices, { id: 'm', groups: r.fill });
  assert.deepEqual(checkBrep(b).issues, []);
  assert.ok(b.faces.some(f => /^m\.fill0\.region\d+$/.test(f.name)));
  // Skipped: left open — it imports only as a sheet, said so.
  const open = repairMesh(P, cut, { ...DEFAULT_REPAIR, fill: { skip: [0] } });
  assert.deepEqual([open.report.holesLeft, open.report.closed], [1, false]);
  assert.throws(() => facetBrepFromTriangles(open.positions, open.indices), /not closed/);
  const sheet = facetBrepFromTriangles(open.positions, open.indices, { id: 's', open: true });
  assert.deepEqual(checkBrep(sheet).issues, []); assert.equal(sheet.bodies[0].kind, 'sheet');
});

test('a curved hole (a sphere\'s cap off): filled by refinement and fairing — denser than its rim, closed, its volume between the open and the whole', () => {
  const { P, I } = sphere(10, 32, 16), n = 32;
  // The top fan and the row below it out: a hole round the 14th row.
  const cut = I.slice(0, I.length - 3 * n - 6 * n);
  const d = diagnoseMesh(P, cut);
  assert.equal(d.holes.length, 1); assert.equal(d.holes[0].edges, n);
  const r = repairMesh(P, cut);
  assert.ok(r.report.closed); assert.equal(r.report.holesFilled, 1);
  assert.ok(r.report.fillTriangles > n - 2, `refined: ${r.report.fillTriangles} triangles over ${n} rim edges`);
  const v = volumeOf(r.positions, r.indices), whole = volumeOf(P, I);
  assert.ok(v > volumeOf(P, cut) && v < whole, `${v} between the open ${volumeOf(P, cut)} and the whole ${whole}`);
  assert.deepEqual(checkBrep(facetBrepFromTriangles(r.positions, r.indices, { groups: r.fill })).issues, []);
});

test('flipped triangles turned back; a mesh wound inside out turned outward; both counted', () => {
  const { P, I } = gridBox(), f = I.slice();
  for (const t of [3, 9, 20]) { const x = f[3 * t + 1]; f[3 * t + 1] = f[3 * t + 2]; f[3 * t + 2] = x; }
  const d = diagnoseMesh(P, f);
  assert.ok(d.inconsistentEdges > 0); assert.equal(d.closed, false);
  const r = repairMesh(P, f);
  assert.equal(r.report.flipped, 3); assert.ok(r.report.closed);
  assert.ok(Math.abs(volumeOf(r.positions, r.indices) - 1000) < 1e-9);
  const inside = I.slice(); for (let t = 0; t < inside.length; t += 3) { const x = inside[t + 1]; inside[t + 1] = inside[t + 2]; inside[t + 2] = x; }
  const o = repairMesh(P, inside);
  assert.equal(o.report.flipped, I.length / 3);
  assert.ok(Math.abs(volumeOf(o.positions, o.indices) - 1000) < 1e-9);
});

test('PERF3 B11: a triangle turned by both passes counts once — the first triangle among the flipped ones (the orient pass then turns all the others, the outward pass all of them back): 3 turned, not 3 + the rest twice', () => {
  const { P, I } = gridBox(), f = I.slice();
  for (const t of [0, 9, 20]) { const x = f[3 * t + 1]; f[3 * t + 1] = f[3 * t + 2]; f[3 * t + 2] = x; }
  const r = repairMesh(P, f);
  assert.equal(r.report.flipped, 3); assert.ok(r.report.closed);
  assert.ok(Math.abs(volumeOf(r.positions, r.indices) - 1000) < 1e-9);
});

test('a fin on an edge (three triangles there) dropped; degenerate and duplicate triangles dropped; all counted', () => {
  const { P, I } = gridBox(), apex = P.length / 3, Q = [...P, 3, 3, 9];
  const J = [...I, I[0], I[1], apex, I[1], I[0], apex];
  // Degenerate (a repeated corner, and three in a line) and a duplicate (the first triangle again, turned).
  J.push(I[0], I[0], I[1], I[3], I[4], I[3], I[2], I[1], I[0]);
  // (The fin's two triangles are one triangle either way round: a duplicate too, so one is left, and dropped as the fin.)
  const d = diagnoseMesh(Q, J);
  assert.deepEqual([d.nonManifoldEdges, d.degenerate, d.duplicates], [1, 2, 2]);
  const r = repairMesh(Q, J);
  assert.deepEqual([r.report.finsRemoved, r.report.finTriangles, r.report.degenerateRemoved, r.report.duplicatesRemoved, r.report.nonManifoldEdgesLeft, r.report.closed], [1, 1, 2, 2, 0, true]);
  assert.ok(Math.abs(volumeOf(r.positions, r.indices) - 1000) < 1e-9);
});

test('floaters under 1% of the largest piece dropped (count and volume); bigger pieces kept as bodies', () => {
  const { P, I } = gridBox(), Q = P.slice(), J = I.slice();
  for (let k = 0; k < 3; k++) addBox(Q, J, [40 + 4 * k, 0, 0], 0.5);
  addBox(Q, J, [0, 40, 0], 3); // 216 mm³: kept (21.6%)
  const d = diagnoseMesh(Q, J);
  assert.deepEqual([d.pieces, d.floaters], [5, 3]);
  const r = repairMesh(Q, J);
  assert.deepEqual([r.report.floatersRemoved, +r.report.floaterVolumeMM3.toFixed(9)], [3, 3]);
  assert.equal(facetBrepsFromTriangles(r.positions, r.indices).length, 2);
  const keep = repairMesh(Q, J, { ...DEFAULT_REPAIR, floaters: false });
  assert.equal(keep.report.floatersRemoved, 0);
});

test('crossing shells: self-intersections found (count and where), not repaired; Booleans on such a body refused, saying so', () => {
  const { P, I } = gridBox(), Q = P.slice(), J = I.slice();
  addBox(Q, J, [10, 5, 5], 2); // through the top
  const d = diagnoseMesh(Q, J);
  assert.ok(d.selfIntersections > 0, String(d.selfIntersections));
  const r = repairMesh(Q, J);
  assert.ok(r.report.selfIntersections > 0);
  const where = selfIntersections(Float64Array.from(Q), Uint32Array.from(J)).at;
  assert.ok(where.every(p => Math.abs(p[2] - 5) < 3), 'near the top');
  // One closed body through itself (the top's middle corner pushed through the bottom): a hole through it refused, saying why.
  const folded = gridBox(), F = folded.P.slice(), k = F.findIndex((_, i) => i % 3 === 0 && F[i] === 10 && F[i + 1] === 5 && F[i + 2] === 5);
  F[k] = 10.3; F[k + 1] = 5.4; F[k + 2] = -2;
  const d2 = diagnoseMesh(F, folded.I);
  assert.ok(d2.selfIntersections > 0 && d2.closed, `${d2.selfIntersections}`);
  const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
  assert.throws(() => evaluateCadPart(D([{ id: 'm', kind: 'mesh', positions: F, indices: folded.I, representation: 'facets' }, { id: 'h', kind: 'hole', target: 'm', center: [3, 3], radius: 1 }])),
    e => e instanceof CadPartError && e.code === 'GEOMETRY' && /does not cross itself: this one does in \d+ place/.test(e.message));
});

test('an open sheet in a part: no mass and no Booleans, each refused with its reason', () => {
  const P = [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0], I = [0, 1, 2, 0, 2, 3];
  const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
  assert.throws(() => evaluateCadPart(D([{ id: 's', kind: 'mesh', positions: P, indices: I, representation: 'facets' }])), /encloses nothing|not closed/);
  const snap = evaluateCadPart(D([{ id: 's', kind: 'mesh', positions: P, indices: I, representation: 'facets', open: true }]));
  assert.equal(snap.output('s').brep.bodies[0].kind, 'sheet');
  assert.throws(() => snap.output('s').massProperties(1), /encloses no volume/);
  assert.throws(() => evaluateCadPart(D([{ id: 's', kind: 'mesh', positions: P, indices: I, representation: 'facets', open: true }, { id: 'h', kind: 'hole', target: 's', center: [5, 5], radius: 1 }])), /need a closed solid: this mesh is open/);
});

test('fill coarseness: half the resolution, about a quarter of the triangles; stages reported as it goes', () => {
  function sphereCut(n, m) { const P = [0, 0, -10], I = []; for (let j = 1; j < m; j++) { const phi = -Math.PI / 2 + Math.PI * j / m; for (let i = 0; i < n; i++) { const th = 2 * Math.PI * i / n; P.push(10 * Math.cos(phi) * Math.cos(th), 10 * Math.cos(phi) * Math.sin(th), 10 * Math.sin(phi)); } } const at = (j, i) => 1 + (j - 1) * n + (i % n); for (let i = 0; i < n; i++) I.push(0, at(1, i + 1), at(1, i)); for (let j = 1; j < m - 3; j++) for (let i = 0; i < n; i++) I.push(at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j, i), at(j + 1, i + 1), at(j + 1, i)); return { P, I }; }
  const { P, I } = sphereCut(64, 40), stages = [];
  const fine = repairMesh(P, I, undefined, s => stages.push(s)), coarse = repairMesh(P, I, { ...DEFAULT_REPAIR, fill: { coarseness: 2 } });
  assert.deepEqual(stages, ['weld', 'fins', 'orient', 'fill 1 of 1', 'floaters', 'check']);
  assert.ok(fine.report.closed && coarse.report.closed);
  const ratio = coarse.report.fillTriangles / fine.report.fillTriangles;
  assert.ok(ratio > 0.15 && ratio < 0.45, `${coarse.report.fillTriangles} / ${fine.report.fillTriangles}`);
});
