import test from 'node:test';
import assert from 'node:assert/strict';
import { subdBrep, checkBrep, brepMassProperties, validateCage, edgeLoop, edgeRing, moveVertices, selectionVertices, extrudeFaces, extrudeEdges, insertEdgeLoop, deleteFaces, fillHole, bridge, weldVertices, weldWithin, setCreases, mirrorCage, halfCage, keepOnPlane, cageTopology, SubdError } from '../dist/index.js';

// SD3 (R8.1, D80): the cage's topology and edits as pure functions. Every edit keeps the cage a valid manifold and the
// kernel builds it; exact answers where there are closed ones (the all-creased cube, the mirror, the bridge's genus).
const CUBE = { positions: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10], faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
const CUBE_EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
function torusCage(n, m, R = 20, r = 6) {
  const positions = [], faces = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m; positions.push((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)); }
  const at = (i, j) => (i % n) * m + (j % m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) faces.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
  return { positions, faces };
}
function gridCage(nx, ny) {
  const positions = [], faces = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) positions.push(i * 10, j * 10, 0);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) faces.push([j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i]);
  return { positions, faces };
}
const vol = c => brepMassProperties(subdBrep(c), 1).volumeMM3;
/** A box cage at `o` of size `s`, n[k] quads along each axis, wound outward. */
function box(o, s, n) {
  const at = new Map(), positions = [], faces = [];
  const vertex = p => { const key = p.join(','); if (!at.has(key)) { at.set(key, positions.length / 3); positions.push(...[0, 1, 2].map(k => o[k] + p[k] * s[k] / n[k])); } return at.get(key); };
  for (const a of [0, 1, 2]) for (const side of [0, 1]) {
    const [b, c] = side ? [(a + 1) % 3, (a + 2) % 3] : [(a + 2) % 3, (a + 1) % 3];
    for (let i = 0; i < n[b]; i++) for (let j = 0; j < n[c]; j++) { const p = (u, v) => { const q = [0, 0, 0]; q[a] = side * n[a]; q[b] = u; q[c] = v; return vertex(q); }; faces.push([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)]); }
  }
  return { positions, faces };
}
/** Valid as a cage and as the kernel's body. */
function sound(c, kind = 'solid') {
  const v = validateCage(c);
  assert.equal(v.valid, true, JSON.stringify(v));
  const b = subdBrep(c), r = checkBrep(b);
  assert.equal(r.valid, true, r.issues[0]); assert.equal(b.bodies[0].kind, kind);
  return { v, b, r };
}

test('validation: the cube cage valid with 8 poles of valence 3; a sheet\'s boundary; a bowtie, a doubled face and an unused vertex flagged', () => {
  const v = validateCage(CUBE);
  assert.equal(v.valid, true); assert.equal(v.poles.length, 8); assert.ok(v.poles.every(p => p.valence === 3)); assert.deepEqual([v.boundaryEdges.length, v.ngons.length], [0, 0]);
  assert.equal(validateCage(gridCage(3, 2)).boundaryEdges.length, 10);
  const bow = validateCage({ positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, -1, 0, 0, -1, -1, 0, 0, -1, 0, 9, 9, 9], faces: [[0, 1, 2, 3], [0, 4, 5, 6]] });
  assert.deepEqual([bow.valid, bow.nonManifoldVertices, bow.unused], [false, [0], [7]]);
  assert.equal(validateCage({ ...CUBE, faces: [...CUBE.faces, CUBE.faces[0]] }).nonManifoldEdges.length > 0, true);
  assert.deepEqual(validateCage({ ...torusCage(8, 6), creases: [[0, 6]] }).darts, [0, 6]);
});

test('selection: an edge loop round a torus (closed, 8 edges) and along a grid row (open, to the boundary); an edge ring round the tube (6) and across a grid; a face\'s vertices', () => {
  const t = torusCage(8, 6);
  const loop = edgeLoop(t, 0, 6); assert.equal(loop.length, 8); assert.ok(loop.every(([a, b]) => cageTopology(t).edges.has(a < b ? `${a}_${b}` : `${b}_${a}`)));
  const ring = edgeRing(t, 0, 6); assert.equal(ring.length, 6);
  const g = gridCage(4, 3), row = edgeLoop(g, 6, 7); assert.equal(row.length, 4); assert.deepEqual(row.map(e => e[0]), [5, 6, 7, 8]);
  assert.equal(edgeRing(g, 6, 7).length, 4);
  assert.deepEqual(selectionVertices(CUBE, { faces: [1] }).sort(), [4, 5, 6, 7]);
  assert.throws(() => edgeLoop(CUBE, 0, 6), e => e instanceof SubdError && /not an edge/.test(e.message));
});

test('edits keep the cage valid and the kernel builds it: extrude the cube\'s top 5 mm (taller), extrude a sheet\'s edge, insert an edge loop round the cube and round a torus, move a face', () => {
  const up = extrudeFaces(CUBE, [1], 5);
  assert.deepEqual([up.cage.faces.length, up.cage.positions.length / 3, up.vertices.length], [10, 12, 4]);
  assert.ok(up.vertices.every(v => Math.abs(up.cage.positions[3 * v + 2] - 15) < 1e-12));
  sound(up.cage); assert.ok(vol(up.cage) > vol(CUBE) * 1.3);
  const sheet = extrudeEdges(gridCage(2, 1), [[0, 1], [1, 2]], [0, -10, 5]);
  assert.equal(sheet.vertices.length, 3); sound(sheet.cage, 'sheet');
  const loop = insertEdgeLoop(CUBE, 0, 1, 0.5);
  assert.deepEqual([loop.cage.faces.length, loop.vertices.length], [10, 4]); sound(loop.cage);
  const t = insertEdgeLoop(torusCage(8, 6), 0, 6, 0.25);
  assert.equal(t.cage.faces.length, 48 + 6); sound(t.cage); // (the ring through 0–6 runs round the tube: 6 quads)
  const moved = moveVertices(CUBE, selectionVertices(CUBE, { faces: [1] }), [0, 0, 4]);
  sound(moved); assert.ok(vol(moved) > vol(CUBE));
  // A loop whose ring ends at an n-gon: that face takes the point (an n-gon, which R7 builds).
  const open = insertEdgeLoop(gridCage(3, 1), 1, 5, 0.5); sound(open.cage, 'sheet');
});

test('delete and fill: the cube\'s top removed (an open box, 4 boundary edges), filled again (the cube\'s volume); two open boxes bridged into one closed body; weld; creases make the cube exact', () => {
  const box = deleteFaces(CUBE, [1]);
  assert.deepEqual([box.faces.length, validateCage(box).boundaryEdges.length], [5, 4]); sound(box, 'sheet');
  const filled = fillHole(box, validateCage(box).boundaryEdges);
  assert.ok(Math.abs(vol(filled) / vol(CUBE) - 1) < 1e-12);
  // Two open boxes, one above the other (the lower open at its top, the upper at its bottom): bridged, one closed body.
  const lower = deleteFaces(CUBE, [1]), upper = deleteFaces(CUBE, [0]);
  const two = { positions: [...lower.positions, ...upper.positions.map((x, i) => i % 3 === 2 ? x + 20 : x)], faces: [...lower.faces, ...upper.faces.map(f => f.map(v => v + 8))] };
  const ends = validateCage(two).boundaryEdges, low = ends.filter(([a]) => a < 8), high = ends.filter(([a]) => a >= 8);
  const tall = bridge(two, low, high), r = sound(tall);
  assert.equal(r.r.topology[0].genus, 0); assert.equal(tall.faces.length, 14);
  assert.throws(() => bridge(two, low, high.slice(0, 3)), e => e instanceof SubdError && /differ/.test(e.message));
  assert.throws(() => fillHole(two, low.slice(0, 3)), e => e instanceof SubdError && /do not close/.test(e.message));
  // Welding an edge's two ends: the edge collapses, its two faces become triangles.
  const w = weldVertices(CUBE, [0, 1]); assert.deepEqual([w.positions.length / 3, w.faces.length], [7, 6]); sound(w);
  // Two sheets side by side, their touching edges welded by distance: one sheet.
  const a = gridCage(1, 1), pair = { positions: [...a.positions, ...a.positions.map((x, i) => i % 3 === 0 ? x + 10 : x)], faces: [...a.faces, ...a.faces.map(f => f.map(v => v + 4))] };
  const joined = weldWithin(pair, [1, 3, 4, 6], 1e-9); assert.equal(joined.positions.length / 3, 6); sound(joined, 'sheet');
  const sharp = setCreases(CUBE, CUBE_EDGES, true); assert.ok(Math.abs(vol(sharp) - 1000) < 1e-9);
  assert.equal(setCreases(sharp, CUBE_EDGES, false).creases, undefined);
});

test('mirror across X: a half box (open on the plane) and its mirror are exactly the same body as the whole box cage of two quads across X; on-plane vertices kept on it; a face in the plane refused', () => {
  // A 10 × 10 × 10 half box over x ∈ [0, 10], open at x = 0.
  const half = deleteFaces({ ...CUBE }, [5]);
  const full = mirrorCage(half, 'x');
  assert.equal(full.faces.length, 10); sound(full);
  // The same cage built whole: a 20 × 10 × 10 box of two quads across X (its middle ring on the plane).
  const whole = box([-10, 0, 0], [20, 10, 10], [2, 1, 1]);
  const sym = brepMassProperties(subdBrep(full), 1);
  assert.ok(Math.abs(sym.centroidMM[0]) < 1e-9, `centred on the plane: ${sym.centroidMM}`);
  assert.ok(Math.abs(vol(full) / vol(whole) - 1) < 1e-12, `${vol(full)} vs ${vol(whole)}`);
  // (Vertices renumber as faces go: the plane's by position.)
  const onPlane = [...Array(half.positions.length / 3).keys()].filter(v => half.positions[3 * v] === 0), off = [...Array(half.positions.length / 3).keys()].find(v => half.positions[3 * v] !== 0);
  const moved = keepOnPlane(moveVertices(half, [...onPlane, off], [0.5, 0, 0]), 'x', onPlane);
  assert.equal(onPlane.length, 4); assert.ok(onPlane.every(v => moved.positions[3 * v] === 0)); sound(mirrorCage(moved, 'x'));
  assert.throws(() => mirrorCage(CUBE, 'x'), e => e instanceof SubdError && /lies in the mirror plane/.test(e.message));
  // Halving a whole cage for mirroring: the 2 × 1 × 1 box's positive half, mirrored, is that box again; a face across the plane refused.
  const back = mirrorCage(halfCage(whole, 'x'), 'x');
  assert.ok(Math.abs(vol(back) / vol(whole) - 1) < 1e-12);
  assert.throws(() => halfCage(box([-10, 0, 0], [20, 10, 10], [1, 1, 1]), 'x'), e => e instanceof SubdError && /crosses the X plane/.test(e.message));
});
