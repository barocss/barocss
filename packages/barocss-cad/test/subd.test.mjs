import test from 'node:test';
import assert from 'node:assert/strict';
import { subdBrep, subdReport, tessellateBrep, evaluateSurfaceD1, SubdError, checkBrep, brepMassProperties, brepSurfaceArea, evaluateCadPart, exportStep, importStep, evaluateSurface, outputOf, checkOutput, massPropertiesOf } from '../dist/index.js';
import { openEdges } from '../scripts/rb/stages.mjs';
import { tessellateBrepWithParameters } from '../dist/brep/brep-tessellate.js';

// SD1 (R5, D51): a regular SubD cage as its exact limit surface, bicubic B-spline faces built from the cage's topology.
// The check that does not trust the construction: one Catmull–Clark step (written here, apart from it) gives a cage
// with the same limit surface, so the same volume and area.
const vol = b => brepMassProperties(b, 1).volume;
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

test('refusals: bad cages INPUT (a bowtie, a face of two sides, an unknown vertex, a crease off the cage, a doubled face); past 32 edges at a vertex CAPABILITY', () => {
  const refused = (cage, code, re) => assert.throws(() => subdBrep(cage), e => e instanceof SubdError && e.code === code && re.test(e.message));
  refused({ positions: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, -10, 0, 0, -10, -10, 0, 0, -10, 0], faces: [[0, 1, 2, 3], [0, 4, 5, 6]] }, 'INPUT', /vertex 0 joins faces that do not form one fan[\s\S]*not a manifold/);
  refused({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], faces: [[0, 1]] }, 'INPUT', /2 sides \(at least 3\)/);
  refused({ positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], faces: [[0, 1, 2, 9]] }, 'INPUT', /names vertex 9/);
  refused({ ...torusCage(8, 8), creases: [[0, 50]] }, 'INPUT', /not an edge/);
  const twice = torusCage(8, 8); twice.faces.push([...twice.faces[0]]);
  refused(twice, 'INPUT', /used twice the same way/);
  const fan = { positions: [0, 0, 0], faces: [] }, n = 33;
  for (let k = 0; k < 2 * n; k++) { const a = Math.PI * k / n, r = k % 2 ? 12 : 10; fan.positions.push(r * Math.cos(a), r * Math.sin(a), 0); }
  for (let k = 0; k < n; k++) fan.faces.push([0, 1 + 2 * k, 2 + 2 * k, 1 + (2 * k + 2) % (2 * n)]);
  refused(fan, 'CAPABILITY', /vertex 0 has 33 faces round it \(at most 32\)/);
});

test('part model: the subd feature — a solid with its patches named, a STEP round trip of its B-spline faces, a cube cage of caps', () => {
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const r = evaluateCadPart(D([{ id: 'ring', kind: 'subd', cage: torusCage(16, 8) }]));
  const o = outputOf(r, 'ring');
  assert.equal(o.representation, 'curved'); assert.equal(checkOutput(o).valid, true);
  assert.ok(o.brep.faces.every(f => /^ring\.patch\d+$/.test(f.name)));
  const back = importStep(exportStep([o.brep], { name: 'ring' }));
  assert.ok(Math.abs(vol(back) / massPropertiesOf(o).volume - 1) < 1e-9);
  // (SD2: a cube cage, extraordinary everywhere, is a solid of caps.)
  const cube = outputOf(evaluateCadPart(D([{ id: 'c', kind: 'subd', cage: CUBE }])), 'c');
  assert.equal(checkOutput(cube).valid, true); assert.ok(cube.brep.faces.every(f => /^c\.cap\d+_\d+$/.test(f.name)));
  assert.throws(() => evaluateCadPart(D([{ id: 'c', kind: 'subd', cage: { positions: [], faces: 'x' } }])), e => e.code === 'INPUT');
  // A Boolean with it goes through the analytic path (B-spline faces).
  const cut = evaluateCadPart(D([{ id: 'ring', kind: 'subd', cage: torusCage(16, 8) }, { id: 'c', kind: 'split', target: 'ring', axis: 'z', at: 0 }]));
  assert.equal(cut.outputs.length, 2);
  assert.ok(Math.abs(cut.outputs.reduce((s, x) => s + massPropertiesOf(x).volume, 0) / massPropertiesOf(o).volume - 1) < 1e-6);
});

// ---- SD2 (R7, D78): extraordinary vertices, n-gons and darts ---------------------------------------------------------
// Checked against an independent Catmull–Clark written here (any polygon; OpenSubdiv's sharp rules), each vertex then
// taken to its limit position (masks written here): the limit mesh's volume, refined 5 and 6 times, extrapolated.
function ccStep(cage) {
  const P = cage.positions, nv = P.length / 3, pt = v => [P[3 * v], P[3 * v + 1], P[3 * v + 2]];
  const ek = (a, b) => Math.min(a, b) * nv + Math.max(a, b), crease = new Set((cage.creases ?? []).map(([a, b]) => ek(a, b)));
  const edgeFaces = new Map(), vEdges = Array.from({ length: nv }, () => new Set()), vFaces = Array.from({ length: nv }, () => []);
  cage.faces.forEach((f, k) => f.forEach((a, s) => { const b = f[(s + 1) % f.length], key = ek(a, b); if (!edgeFaces.has(key)) edgeFaces.set(key, []); edgeFaces.get(key).push(k); vEdges[a].add(key); vEdges[b].add(key); vFaces[a].push(k); }));
  const sharp = key => crease.has(key) || edgeFaces.get(key).length < 2, other = (key, v) => Math.floor(key / nv) === v ? key % nv : Math.floor(key / nv);
  const fp = cage.faces.map(f => { const s = [0, 0, 0]; for (const v of f) { const p = pt(v); for (let i = 0; i < 3; i++) s[i] += p[i]; } return s.map(x => x / f.length); });
  const ep = key => { const a = pt(Math.floor(key / nv)), b = pt(key % nv); if (sharp(key)) return a.map((x, i) => (x + b[i]) / 2); const [f, g] = edgeFaces.get(key); return a.map((x, i) => (x + b[i] + fp[f][i] + fp[g][i]) / 4); };
  const vp = v => {
    const es = [...vEdges[v]], sh = es.filter(sharp), p = pt(v);
    if (sh.length >= 3 || (sh.length === 2 && vFaces[v].length === 1)) return p;
    if (sh.length === 2) { const a = pt(other(sh[0], v)), b = pt(other(sh[1], v)); return p.map((x, i) => (a[i] + 6 * x + b[i]) / 8); }
    const n = es.length, Q = [0, 0, 0], R = [0, 0, 0];
    for (const k of vFaces[v]) for (let i = 0; i < 3; i++) Q[i] += fp[k][i] / n;
    for (const key of es) { const o = pt(other(key, v)); for (let i = 0; i < 3; i++) R[i] += (p[i] + o[i]) / 2 / n; }
    return p.map((x, i) => (Q[i] + 2 * R[i] + (n - 3) * x) / n);
  };
  const positions = [], at = new Map(), put = (key, f) => { if (!at.has(key)) { at.set(key, positions.length / 3); positions.push(...f()); } return at.get(key); };
  const faces = cage.faces.flatMap((f, k) => f.map((v, s) => { const nx = f[(s + 1) % f.length], pv = f[(s + f.length - 1) % f.length];
    return [put(`v${v}`, () => vp(v)), put(`e${ek(v, nx)}`, () => ep(ek(v, nx))), put(`f${k}`, () => fp[k]), put(`e${ek(pv, v)}`, () => ep(ek(pv, v)))]; }));
  const creases = [...crease].flatMap(key => { const e = at.get(`e${key}`); return [[at.get(`v${Math.floor(key / nv)}`), e], [e, at.get(`v${key % nv}`)]]; });
  return { positions, faces, creases };
}
/** The limit mesh's volume, area and centroid (the solid's, by the divergence theorem over its triangles). */
function limitMeasures(cage, levels) {
  let c = cage; for (let i = 0; i < levels; i++) c = ccStep(c);
  const P = c.positions, nv = P.length / 3, pt = v => [P[3 * v], P[3 * v + 1], P[3 * v + 2]];
  const ek = (a, b) => Math.min(a, b) * nv + Math.max(a, b), crease = new Set(c.creases.map(([a, b]) => ek(a, b)));
  const edgeFaces = new Map(), vEdges = Array.from({ length: nv }, () => new Set()), diag = Array.from({ length: nv }, () => []);
  c.faces.forEach(f => f.forEach((a, s) => { const key = ek(a, f[(s + 1) % 4]); edgeFaces.set(key, (edgeFaces.get(key) ?? 0) + 1); vEdges[a].add(key); vEdges[f[(s + 1) % 4]].add(key); diag[a].push(f[(s + 2) % 4]); }));
  const sharp = key => crease.has(key) || edgeFaces.get(key) < 2, other = (key, v) => Math.floor(key / nv) === v ? key % nv : Math.floor(key / nv);
  const L = [];
  for (let v = 0; v < nv; v++) {
    const es = [...vEdges[v]], sh = es.filter(sharp), p = pt(v);
    if (sh.length >= 3 || (sh.length === 2 && diag[v].length === 1)) { L.push(p); continue; }
    if (sh.length === 2) { const a = pt(other(sh[0], v)), b = pt(other(sh[1], v)); L.push(p.map((x, i) => (a[i] + 4 * x + b[i]) / 6)); continue; }
    const n = es.length, s = p.map(x => n * n * x);
    for (const key of es) { const o = pt(other(key, v)); for (let i = 0; i < 3; i++) s[i] += 4 * o[i]; }
    for (const d of diag[v]) { const o = pt(d); for (let i = 0; i < 3; i++) s[i] += o[i]; }
    L.push(s.map(x => x / (n * (n + 5))));
  }
  let vol = 0, area = 0; const m = [0, 0, 0];
  for (const f of c.faces) for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
    const a = L[f[i]], b = L[f[j]], d = L[f[k]], v = (a[0] * (b[1] * d[2] - b[2] * d[1]) - a[1] * (b[0] * d[2] - b[2] * d[0]) + a[2] * (b[0] * d[1] - b[1] * d[0])) / 6;
    vol += v; for (let x = 0; x < 3; x++) m[x] += v * (a[x] + b[x] + d[x]) / 4;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    area += Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
  }
  return { volume: vol, area, centroid: m.map(x => x / vol) };
}
const limitVolume = (cage, levels) => limitMeasures(cage, levels).volume;
const extrapolated = (cage, l = 5) => { const a = limitVolume(cage, l), b = limitVolume(cage, l + 1); return b + (b - a) / 3; };
function prism(n, r = 10, h = 10) {
  const positions = [];
  for (const z of [0, h]) for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n; positions.push(r * Math.cos(a), r * Math.sin(a), z); }
  const faces = [[...Array(n)].map((_, k) => n - 1 - k), [...Array(n)].map((_, k) => n + k)];
  for (let k = 0; k < n; k++) faces.push([k, (k + 1) % n, n + (k + 1) % n, n + k]);
  return { positions, faces };
}
const TET = { positions: [0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10], faces: [[0, 2, 1], [0, 1, 3], [1, 2, 3], [0, 3, 2]] };
/** What every SD2 build promises: valid; G1 (to rounding) along every edge that is not sharp; the faces meet; near the limit. */
function promised(cage, id, dev) {
  const b = subdBrep(cage, { id }), c = checkBrep(b, { strict: true }), r = subdReport(cage, { id });
  assert.equal(c.valid, true, `${id}: ${c.issues[0]}`);
  assert.ok(r.g1.maxAngleDeg < 1e-5, `${id}: normals ${r.g1.maxAngleDeg}° apart`);
  assert.ok(r.g1.maxGapMM < 1e-12, `${id}: faces ${r.g1.maxGapMM} mm apart`);
  assert.ok(r.deviation.maxMM < dev, `${id}: ${r.deviation.maxMM} mm from the limit`);
  assert.ok(r.deviation.exactMaxMM < 1e-12, `${id}: an exact quad ${r.deviation.exactMaxMM} mm from the limit (the measure)`);
  // No degenerate point, no fold: G1 and a small distance do not show those (a folded cap once passed both).
  assert.ok(r.caps.minJacobianRatio > 0.05, `${id}: |Su × Sv| down to ${r.caps.minJacobianRatio} of its median`);
  assert.ok(r.caps.maxNormalTurnDeg < 15, `${id}: normals turn ${r.caps.maxNormalTurnDeg}° between grid neighbours`);
  // And it tessellates (the B-rep tessellator refines by normals: a fold never settles).
  const mesh = tessellateBrep(b, { segmentsPerQuarter: 8 });
  assert.ok(mesh.indices.length > 0, `${id}: tessellated`);
  return { b, r };
}

test('SD2 a cube cage (every vertex valence 3): one step, 24 G1 caps named by face and corner; G1 to rounding, no fold; within 0.004 mm of the limit; its volume the limit\'s to 2e-3; a STEP round trip of its double-knot faces', () => {
  const { b, r } = promised(CUBE, 'c', 0.004);
  assert.deepEqual([r.steps, r.irregularVertices, r.capCount, r.faces], [1, 8, 24, 24]);
  assert.deepEqual(b.faces.map(f => f.name).sort().slice(0, 4), ['c.cap0_0', 'c.cap0_1', 'c.cap0_2', 'c.cap0_3']);
  assert.ok(b.faces.every(f => f.surface.knotsU.join() === '0,0,0,0,0.25,0.25,1,1,1,1'));
  const v = vol(b), want = extrapolated(CUBE);
  assert.ok(Math.abs(v / want - 1) < 2e-3, `${v} vs the limit ${want}`);
  assert.ok(brepMassProperties(b, 1).centroid.every(x => Math.abs(x - 5) < 1e-9));
  const back = importStep(exportStep([b], { name: 'c' }));
  assert.ok(Math.abs(vol(back) / v - 1) < 1e-9);
  // The cage wound inward is turned outward.
  assert.ok(Math.abs(vol(subdBrep({ ...CUBE, faces: CUBE.faces.map(f => [...f].reverse()) })) / v - 1) < 1e-12);
});

test('SD2 n-gons: a tetrahedron (triangles) and pentagonal and hexagonal prisms take two steps (a face point beside an irregular vertex); exact B-spline faces between the caps; volumes the limit\'s to 2e-3', () => {
  for (const [cage, id, caps] of [[TET, 'tet', null], [prism(5), 'p5', null], [prism(6), 'p6', null]]) {
    const { b, r } = promised(cage, id, 0.011);
    assert.equal(r.steps, 2, id); void caps;
    const v = vol(b), want = extrapolated(cage);
    assert.ok(Math.abs(v / want - 1) < 2e-3, `${id}: ${v} vs the limit ${want}`);
    assert.ok(b.faces.some(f => f.name.startsWith(`${id}.patch`)) || id === 'tet', `${id} keeps exact patches`);
  }
});

test('SD2 creases and darts: a cube with its top ring creased (crease vertices of 3 edges); a torus with one crease edge ending inside (two darts) — G1 off the creases, the crease edges sharp; volumes the limit\'s', () => {
  const top = { ...CUBE, creases: [[4, 5], [5, 6], [6, 7], [7, 4]] };
  const t = promised(top, 't', 0.004);
  assert.ok(t.r.g1.sharpEdges >= 4);
  assert.ok(Math.abs(vol(t.b) / extrapolated(top) - 1) < 2e-3);
  const dart = torusCage(8, 6); dart.creases = [[0, 6]];
  const d = promised(dart, 'd', 0.058);
  assert.equal(d.r.irregularVertices, 2); assert.equal(checkBrep(d.b).topology[0].genus, 1);
  assert.ok(Math.abs(vol(d.b) / extrapolated(dart, 4) - 1) < 2e-3);
});

test('SD2 open sheets: a star of n quads round an inside vertex (valence 3, 5, 6) and a half star round a boundary vertex of 3 and 4 faces — G1 caps; the outer corners interpolated', () => {
  // (Their rims convex: a reflex rim corner folds the exact patch at it, by the cage, not the caps.)
  const star = n => { const positions = [0, 0, 0]; for (let k = 0; k < 2 * n; k++) { const a = Math.PI * k / n, r = 10; positions.push(r * Math.cos(a), r * Math.sin(a), 0.5 * Math.cos(3 * a)); } return { positions, faces: [...Array(n)].map((_, k) => [0, 1 + 2 * k, 1 + (2 * k + 1) % (2 * n), 1 + (2 * k + 2) % (2 * n)]) }; };
  const half = n => { const positions = [0, 0, 0]; for (let k = 0; k <= 2 * n; k++) { const a = Math.PI * k / (2 * n), r = 10; positions.push(r * Math.cos(a), r * Math.sin(a), 0.4 * Math.sin(2 * a)); } return { positions, faces: [...Array(n)].map((_, k) => [0, 1 + 2 * k, 2 + 2 * k, 3 + 2 * k]) }; };
  for (const n of [3, 5, 6]) { const { b, r } = promised(star(n), `s${n}`, 0.015); assert.equal(b.bodies[0].kind, 'sheet'); assert.equal(r.irregularVertices, 1); }
  for (const n of [3, 4]) {
    // (At a boundary vertex the limit's edges are not evenly spread; the caps' even angles cost the most there, D78.)
    const cage = half(n), { b, r } = promised(cage, `h${n}`, n === 3 ? 0.08 : 0.16);
    assert.equal(b.bodies[0].kind, 'sheet'); assert.ok(r.irregularVertices >= 1, `h${n}`);
    // The boundary's ends are corners: the surface passes through them.
    const P = cage.positions, ends = [[P[3], P[4], P[5]], [P[3 * (2 * n + 1)], P[3 * (2 * n + 1) + 1], P[3 * (2 * n + 1) + 2]]];
    const corners = b.faces.flatMap(f => [0, 1].flatMap(u => [0, 1].map(v => evaluateSurface(f.surface, u * f.surface.knotsU.at(-1), v * f.surface.knotsV.at(-1)))));
    for (const e of ends) assert.ok(corners.some(p => Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]) < 1e-12), `h${n} corner ${e}`);
  }
});

test('SD2 leaves regular cages to SD1: a torus cage takes no step, its names and faces as before; the limit measure reads 0 on exact quads', () => {
  const r = subdReport(torusCage(16, 8), { id: 's' });
  assert.deepEqual([r.steps, r.capCount], [0, 0]);
  assert.ok(r.deviation.exactMaxMM < 1e-12 && r.deviation.exactSamples > 0);
  assert.ok(subdBrep(torusCage(16, 8), { id: 's' }).faces.every(f => /^s\.patch\d+$/.test(f.name)));
});

// ---- D79: shading and tessellation of SubD bodies ------------------------------------------------------------------
function boxCage(w, d, h, n) {
  const at = new Map(), positions = [], faces = [];
  const vertex = p => { const key = p.join(','); let i = at.get(key); if (i === undefined) { i = positions.length / 3; at.set(key, i); positions.push(-w / 2 + p[0] * w / n, -d / 2 + p[1] * d / n, p[2] * h / n); } return i; };
  for (const a of [0, 1, 2]) for (const s of [0, n]) {
    const [b, c] = s ? [(a + 1) % 3, (a + 2) % 3] : [(a + 2) % 3, (a + 1) % 3];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const p = (u, v) => { const q = [0, 0, 0]; q[a] = s; q[b] = u; q[c] = v; return vertex(q); }; faces.push([p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)]); }
  }
  return { positions, faces };
}
/** The largest concave fold between neighbouring triangles (a dent; 0 on a convex body tessellated well). */
function worstFold(mesh) {
  const P = mesh.positions, I = mesh.indices, key = v => `${P[3 * v]},${P[3 * v + 1]},${P[3 * v + 2]}`, pt = v => [P[3 * v], P[3 * v + 1], P[3 * v + 2]], edges = new Map();
  for (let t = 0; t < I.length / 3; t++) for (let k = 0; k < 3; k++) { const a = key(I[3 * t + k]), c = key(I[3 * t + (k + 1) % 3]), e = a < c ? `${a}|${c}` : `${c}|${a}`; if (!edges.has(e)) edges.set(e, []); edges.get(e).push(t); }
  const tri = t => { const a = pt(I[3 * t]), b = pt(I[3 * t + 1]), c = pt(I[3 * t + 2]), u = b.map((x, i) => x - a[i]), v = c.map((x, i) => x - a[i]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n); return { n: n.map(x => x / l), c: [0, 1, 2].map(i => (a[i] + b[i] + c[i]) / 3) }; };
  let worst = 0;
  for (const ts of edges.values()) {
    if (ts.length !== 2) continue;
    const A = tri(ts[0]), B = tri(ts[1]);
    if ((B.c[0] - A.c[0]) * A.n[0] + (B.c[1] - A.c[1]) * A.n[1] + (B.c[2] - A.c[2]) * A.n[2] <= 0) continue;
    worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2]))) * 180 / Math.PI);
  }
  return worst;
}

test('D79 display of a SubD box: vertex normals are the surface\'s own (they were each face\'s triangles\' average, 8° off on caps, 17° on exact faces — a seam at every edge); edge chords that tilted their triangles are split (a 51° dent, 180° on a finer cage, before); watertight', () => {
  const b = subdBrep(boxCage(30, 20, 16, 3), { id: 'n0' });
  const { mesh, parameters } = tessellateBrepWithParameters(b, { segmentsPerQuarter: 8 });
  let worst = 0;
  for (const f of mesh.faces) {
    const face = b.faces.find(x => x.id === f.faceId), uv = parameters.get(f.faceId).uv, sign = face.sense === 'forward' ? 1 : -1;
    for (let k = 0; k < f.vertexCount; k++) {
      const d = evaluateSurfaceD1(face.surface, uv[k][0], uv[k][1]), a = d.du, c = d.dv, n = [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]], l = Math.hypot(...n);
      const v = f.vertexOffset + k, m = [mesh.normals[3 * v], mesh.normals[3 * v + 1], mesh.normals[3 * v + 2]];
      worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, sign * (n[0] * m[0] + n[1] * m[1] + n[2] * m[2]) / l))) * 180 / Math.PI);
    }
  }
  assert.ok(worst < 0.01, `vertex normals ${worst}° off the surface's`);
  assert.ok(worstFold(mesh) < 25, `a ${worstFold(mesh)}° dent`);
  assert.ok(worstFold(tessellateBrep(subdBrep(boxCage(30, 20, 16, 6)), { segmentsPerQuarter: 8 })) < 45);
  assert.equal(openEdges(mesh.positions, mesh.indices), 0);
});

test('PERF3 A4 (D82): caps kept by their vertex\'s 2-ring — the same cage again has the same caps; a vertex moved outside every irregular vertex\'s 2-ring leaves them all, one inside a corner\'s changes that corner\'s only', async () => {
  const { buildSubd } = await import('../dist/features/subd.js');
  const capsOf = b => new Map([...b.caps].map(([f, c]) => [f, JSON.stringify([c.vertex, c.poles, c.deviationMM])]));
  // (A shift no other test uses: built cold.)
  const cage = boxCage(30, 20, 16, 6), shifted = { ...cage, positions: cage.positions.map((x, i) => i % 3 === 1 ? x + 0.0123 : x) };
  const first = capsOf(buildSubd(shifted)), again = capsOf(buildSubd(shifted));
  assert.equal(first.size, 24); assert.deepEqual(again, first);
  const at = (p, x, y, z) => { for (let v = 0; v < p.length / 3; v++) if (Math.abs(p[3 * v] - x) < 1e-9 && Math.abs(p[3 * v + 1] - y) < 1e-9 && Math.abs(p[3 * v + 2] - z) < 1e-9) return v; throw new Error('no vertex'); };
  const moved = (v, dz) => { const p = [...shifted.positions]; p[3 * v + 2] += dz; return { ...shifted, positions: p }; };
  // The top's centre: three cage edges from every corner.
  const centre = at(shifted.positions, 0, 0.0123, 16);
  assert.deepEqual(capsOf(buildSubd(moved(centre, 3))), first);
  // Next to a top corner (two edges in along the top): in that corner's 2-ring, no other's.
  // (Cap vertices are the refined cage's: the three changed caps share one, the corner's.)
  const near = at(shifted.positions, -15 + 10, -10 + 20 / 3 * 2 + 0.0123, 16);
  const after = capsOf(buildSubd(moved(near, 0.5)));
  const changed = [...after].filter(([f, s]) => s !== first.get(f)).map(([f]) => JSON.parse(after.get(f))[0]);
  assert.ok(changed.length === 3 && new Set(changed).size === 1, JSON.stringify(changed));
});

test('PERF3 C16 (D82): the caps are kept whatever the cage\'s extent — the top\'s centre raised above the rest (a new extent) reuses every cap: the build far under a cold one, the caps the same', async () => {
  const { buildSubd } = await import('../dist/features/subd.js');
  const capsOf = b => new Map([...b.caps].map(([f, c]) => [f, JSON.stringify([c.vertex, c.poles, c.deviationMM])]));
  const cage = boxCage(30, 20, 16, 6), shifted = { ...cage, positions: cage.positions.map((x, i) => i % 3 === 0 ? x + 0.0456 : x) };
  let t0 = performance.now(); const first = buildSubd(shifted); const cold = performance.now() - t0;
  let centre = 0; for (let v = 0; v < shifted.positions.length / 3; v++) if (Math.abs(shifted.positions[3 * v] - 0.0456) < 1e-9 && Math.abs(shifted.positions[3 * v + 1]) < 1e-9 && Math.abs(shifted.positions[3 * v + 2] - 16) < 1e-9) centre = v;
  const p = [...shifted.positions]; p[3 * centre + 2] += 4;
  t0 = performance.now(); const raised = buildSubd({ ...shifted, positions: p }); const warm = performance.now() - t0;
  assert.deepEqual(capsOf(raised), capsOf(first));
  assert.ok(warm < 0.5 * cold, `${warm.toFixed(1)} ms raised against ${cold.toFixed(1)} ms cold: the caps were built again`);
});

test('D84 (R8.3) the owner\'s acceptance part, a SubD pipe clamp (conformance r8-subd-pipe-clamp, built by the studio\'s agent cage tools): what every SD2 build promises; one solid of genus 2; its volume the independent limit\'s; the tessellation\'s folds no worse than recorded', async () => {
  const { readFileSync } = await import('node:fs');
  const cage = JSON.parse(readFileSync(new URL('../conformance/r8/subd-pipe-clamp.json', import.meta.url), 'utf8')).input.partDocument.features[0].cage;
  const { b, r } = promised(cage, 'clamp', 0.02);
  assert.deepEqual([r.steps, r.irregularVertices, r.capCount], [1, 20, 88]);
  assert.deepEqual(checkBrep(b).topology.map(t => [t.shells, t.genus]), [[1, 2]]);
  // (Refined 3 and 4 times here, for time: the extrapolation is 6e-8 from the 4-and-5 one the case records.)
  const v = vol(b), want = extrapolated(cage, 3);
  assert.ok(Math.abs(v / want - 1) < 1e-6, `${v} vs the limit ${want}`);
  // D79's to-do, open (A5): sliver triangles along the rims' tight holding loops fold up to 88.6° inside exact patches
  // (the caps' normals turn 3.3° at most, above). Held where it is: no worse.
  assert.ok(worstFold(tessellateBrep(b, { segmentsPerQuarter: 8 })) < 89, 'a fold worse than recorded');
});
