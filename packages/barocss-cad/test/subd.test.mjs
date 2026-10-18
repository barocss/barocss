import test from 'node:test';
import assert from 'node:assert/strict';
import { subdBrep, SubdError, checkBrep, brepMassProperties, brepSurfaceArea, evaluateCadPart, exportStep, importStep, evaluateSurface } from '../dist/index.js';

// SD1 (R5, D51): a regular SubD cage as its exact limit surface, bicubic B-spline faces built from the cage's topology.
// The check that does not trust the construction: one Catmull–Clark step (written here, apart from it) gives a cage
// with the same limit surface, so the same volume and area.
const vol = b => brepMassProperties(b, 1).volumeMM3;
function torusCage(n, m, R = 20, r = 6) {
  const positions = [], faces = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const u = 2 * Math.PI * i / n, v = 2 * Math.PI * j / m; positions.push((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)); }
  const at = (i, j) => (i % n) * m + (j % m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) faces.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
  return { positions, faces };
}
function gridCage(nx, ny, z = () => 0) {
  const positions = [], faces = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) positions.push(i * 10, j * 10, z(i, j));
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) faces.push([j * (nx + 1) + i, j * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i + 1, (j + 1) * (nx + 1) + i]);
  return { positions, faces };
}
const CUBE = { positions: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10], faces: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
const CUBE_EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

/** One Catmull–Clark step of a quad cage: sharp edges (boundary, creases) take the midpoint and (a + 6v + b)/8, corners stay. */
function catmullClark(cage) {
  const P = cage.positions, nv = P.length / 3, pt = v => [P[3 * v], P[3 * v + 1], P[3 * v + 2]];
  const add = (a, b, k = 1) => a.map((x, i) => x + k * b[i]), sc = (a, k) => a.map(x => x * k), sum = ps => ps.reduce((s, p) => add(s, p), [0, 0, 0]);
  const ek = (a, b) => Math.min(a, b) * nv + Math.max(a, b), crease = new Set((cage.creases ?? []).map(([a, b]) => ek(a, b)));
  const edgeFaces = new Map();
  cage.faces.forEach((f, k) => f.forEach((a, s) => { const key = ek(a, f[(s + 1) % 4]); if (!edgeFaces.has(key)) edgeFaces.set(key, []); edgeFaces.get(key).push(k); }));
  const sharp = key => crease.has(key) || edgeFaces.get(key).length < 2, other = (k, v) => Math.floor(k / nv) === v ? k % nv : Math.floor(k / nv);
  const fp = cage.faces.map(f => sc(sum(f.map(pt)), 1 / 4));
  const edgePt = (a, b) => { const key = ek(a, b); if (sharp(key)) return sc(add(pt(a), pt(b)), 0.5); const [f, g] = edgeFaces.get(key); return sc(add(add(pt(a), pt(b)), add(fp[f], fp[g])), 0.25); };
  const vertPt = v => {
    const es = [...edgeFaces.keys()].filter(k => Math.floor(k / nv) === v || k % nv === v), sh = es.filter(sharp);
    if (sh.length >= 3 || (sh.length === es.length && es.length === 2)) return pt(v);
    if (sh.length === 2) return sc(add(add(pt(other(sh[0], v)), pt(other(sh[1], v))), pt(v), 6), 1 / 8);
    const n = es.length, Q = sc(sum(cage.faces.flatMap((f, k) => f.includes(v) ? [fp[k]] : [])), 1 / n), R = sc(sum(es.map(k => sc(add(pt(v), pt(other(k, v))), 0.5))), 1 / n);
    return sc(add(add(Q, R, 2), pt(v), n - 3), 1 / n);
  };
  const positions = [], at = new Map(), put = (key, p) => { if (!at.has(key)) { at.set(key, positions.length / 3); positions.push(...p); } return at.get(key); };
  const faces = cage.faces.flatMap((f, k) => f.map((v, s) => [put(`v${v}`, vertPt(v)), put(`e${ek(v, f[(s + 1) % 4])}`, edgePt(v, f[(s + 1) % 4])), put(`f${k}`, fp[k]), put(`e${ek(f[(s + 3) % 4], v)}`, edgePt(f[(s + 3) % 4], v))]));
  const creases = [...crease].flatMap(key => { const a = Math.floor(key / nv), b = key % nv, e = at.get(`e${key}`); return [[at.get(`v${a}`), e], [e, at.get(`v${b}`)]]; });
  return { positions, faces, creases };
}

test('a regular torus cage: exact limit surface — one Catmull–Clark step gives the same volume and area to 1e-12; valid; faces of at most 13 × 13 quads', () => {
  for (const [n, m] of [[16, 8], [32, 12], [30, 30]]) {
    const cage = torusCage(n, m), a = subdBrep(cage, { id: 's' }), b = subdBrep(catmullClark(cage), { id: 's' });
    assert.equal(checkBrep(a).valid, true, checkBrep(a).issues[0]); assert.equal(checkBrep(b).valid, true);
    assert.ok(Math.abs(vol(b) / vol(a) - 1) < 1e-12, `${n}×${m} volume ${vol(a)} vs ${vol(b)}`);
    assert.ok(Math.abs(brepSurfaceArea(b) / brepSurfaceArea(a) - 1) < 1e-12, `${n}×${m} area`);
    assert.equal(checkBrep(a).topology[0].genus, 1);
    assert.ok(a.faces.every(f => f.surface.controlPoints.length <= 16 && f.surface.controlPoints[0].length <= 16));
    assert.ok(a.faces.every(f => /^s\.patch\d+$/.test(f.name)));
  }
});

test('sharp creases, boundaries and corners (OpenSubdiv rules): a creased torus and a bumpy open sheet agree with a Catmull–Clark step; a crease runs as the B-spline of its vertices', () => {
  const n = 16, m = 8, cage = torusCage(n, m);
  cage.creases = []; for (let i = 0; i < n; i++) for (const j of [0, m / 2]) cage.creases.push([i * m + j, ((i + 1) % n) * m + j]);
  const a = subdBrep(cage), b = subdBrep(catmullClark(cage));
  assert.equal(checkBrep(a).valid, true);
  assert.ok(Math.abs(vol(b) / vol(a) - 1) < 1e-12 && Math.abs(brepSurfaceArea(b) / brepSurfaceArea(a) - 1) < 1e-12);
  // The crease ring at j = 0 lies on z = 0 (its vertices do): every face edge on it does too.
  const ring = a.edges.filter(e => e.curve.controlPoints.every(p => Math.abs(p[2]) < 1e-12));
  assert.ok(ring.length >= 2, `${ring.length} edges on the crease ring`);
  const sheet = gridCage(6, 4, (i, j) => 3 * Math.sin(i) * Math.cos(j)), s = subdBrep(sheet), s2 = subdBrep(catmullClark(sheet));
  assert.equal(s.bodies[0].kind, 'sheet'); assert.equal(checkBrep(s).valid, true);
  assert.ok(Math.abs(brepSurfaceArea(s2) / brepSurfaceArea(s) - 1) < 1e-12);
  // Corners interpolated: the limit surface passes through the cage's four corners.
  const corners = [[0, 0, 0], [60, 0, 3 * Math.sin(6)], [0, 40, 0], [60, 40, 3 * Math.sin(6) * Math.cos(4)]];
  const at = [0, 1].flatMap(u => [0, 1].map(v => { const f = s.faces[0].surface, U = f.knotsU.at(-1), V = f.knotsV.at(-1); return evaluateSurface(f, u * U, v * V); }));
  for (const c of corners) assert.ok(at.some(p => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < 1e-12), `corner ${c}`);
});

test('exact by construction: a flat grid fills its rectangle; an all-creased cube is the cube (every corner its own)', () => {
  assert.ok(Math.abs(brepSurfaceArea(subdBrep(gridCage(4, 3))) - 1200) < 1e-9);
  const cube = subdBrep({ ...CUBE, creases: CUBE_EDGES });
  assert.equal(cube.faces.length, 6); assert.equal(checkBrep(cube).valid, true);
  assert.ok(Math.abs(vol(cube) - 1000) < 1e-9 && Math.abs(brepSurfaceArea(cube) - 600) < 1e-9);
  // Wound inward, turned outward.
  assert.ok(Math.abs(vol(subdBrep({ ...CUBE, faces: CUBE.faces.map(f => [...f].reverse()), creases: CUBE_EDGES })) - 1000) < 1e-9);
});

test('refusals: extraordinary vertices, n-gons and darts are CAPABILITY (SD2); bad cages INPUT', () => {
  const refused = (cage, code, re) => assert.throws(() => subdBrep(cage), e => e instanceof SubdError && e.code === code && re.test(e.message));
  refused(CUBE, 'CAPABILITY', /vertex 0 has 3 edges \(extraordinary\)[\s\S]*SD2/);
  refused({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], faces: [[0, 1, 2]] }, 'CAPABILITY', /3 sides: n-gons arrive with SD2/);
  const dart = torusCage(16, 8); dart.creases = [[0, 8]];
  refused(dart, 'CAPABILITY', /a dart/);
  refused({ positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], faces: [[0, 1, 2, 9]] }, 'INPUT', /names vertex 9/);
  refused({ ...torusCage(8, 8), creases: [[0, 50]] }, 'INPUT', /not an edge/);
  const twice = torusCage(8, 8); twice.faces.push([...twice.faces[0]]);
  refused(twice, 'INPUT', /used twice the same way/);
});

test('part model: the subd feature — a solid with its patches named, a STEP round trip of its B-spline faces, CAPABILITY for an extraordinary cage', () => {
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const r = evaluateCadPart(D([{ id: 'ring', kind: 'subd', cage: torusCage(16, 8) }]));
  const o = r.output('ring');
  assert.equal(o.representation, 'curved'); assert.equal(o.validate().valid, true);
  assert.ok(o.brep.faces.every(f => /^ring\.patch\d+$/.test(f.name)));
  const back = importStep(exportStep([o.brep], { name: 'ring' }));
  assert.ok(Math.abs(vol(back) / o.massProperties(1).volumeMM3 - 1) < 1e-9);
  assert.throws(() => evaluateCadPart(D([{ id: 'c', kind: 'subd', cage: CUBE }])), e => e.code === 'CAPABILITY' && /extraordinary/.test(e.message));
  assert.throws(() => evaluateCadPart(D([{ id: 'c', kind: 'subd', cage: { positions: [], faces: 'x' } }])), e => e.code === 'INPUT');
  // A Boolean with it goes through the analytic path (B-spline faces).
  const cut = evaluateCadPart(D([{ id: 'ring', kind: 'subd', cage: torusCage(16, 8) }, { id: 'c', kind: 'split', target: 'ring', axis: 'z', at: 0 }]));
  assert.equal(cut.outputs.length, 2);
  assert.ok(Math.abs(cut.outputs.reduce((s, x) => s + x.massProperties(1).volumeMM3, 0) / o.massProperties(1).volumeMM3 - 1) < 1e-6);
});
