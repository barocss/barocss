import test from 'node:test';
import assert from 'node:assert/strict';
import { polygonSectionProperties, symmetricEigen3, symmetricEigen3InPlace, meshVolume, frameSection, convexHull } from '../dist/index.js';

// K5 (D144): a polygonal section's properties, a symmetric 3 × 3 eigen decomposition, a closed mesh's volume. Oracles,
// none of them the kernel's routines: closed forms (a rectangle's bh³/12, a hollow one, an I-beam by its parts, a
// right triangle's product moment −b²h²/72, an equal angle's principal axes at 45°), the invariants of a rotation (the
// principal moments unchanged, the axis turned by it), FR's own section closed forms (D123), and for the eigen solver
// its defining identities (AV = VΛ, VᵀV = I, the trace and the determinant).

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const turn = (loop, a, c = [0, 0]) => loop.map(([x, y]) => [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)]);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('K5 sections: closed forms — a rectangle, a hollow one (its hole either way round), an I-beam by its parts, a right triangle\'s product moment', () => {
  const b = 30, h = 50, r = polygonSectionProperties([rect(2, 3, 2 + b, 3 + h)]);
  near(r.area, b * h, 1e-15, 'A'); near(r.centroid[0], 2 + b / 2, 1e-15, 'cx'); near(r.centroid[1], 3 + h / 2, 1e-15, 'cy');
  near(r.Ixx, b * h ** 3 / 12, 1e-13, 'Ixx'); near(r.Iyy, h * b ** 3 / 12, 1e-13, 'Iyy'); assert.ok(Math.abs(r.Ixy) <= 1e-9, 'Ixy 0');
  near(r.I1, b * h ** 3 / 12, 1e-13, 'I1'); near(Math.abs(r.angle), 0, 1e-12, 'about x');
  // Hollow 60 × 40 less 40 × 20 (centred), the hole clockwise or anticlockwise alike.
  for (const hole of [rect(10, 10, 50, 30), [...rect(10, 10, 50, 30)].reverse()]) {
    const s = polygonSectionProperties([rect(0, 0, 60, 40), hole]);
    near(s.area, 2400 - 800, 1e-15, 'hollow A'); near(s.Ixx, 60 * 40 ** 3 / 12 - 40 * 20 ** 3 / 12, 1e-13, 'hollow Ixx'); near(s.Iyy, 40 * 60 ** 3 / 12 - 20 * 40 ** 3 / 12, 1e-13, 'hollow Iyy');
  }
  // An I-beam (flanges 100 × 10, web 10 × 80) as one outline: Ixx = 2(100·10³/12 + 1000·45²) + 10·80³/12.
  const I = [[0, 0], [100, 0], [100, 10], [55, 10], [55, 90], [100, 90], [100, 100], [0, 100], [0, 90], [45, 90], [45, 10], [0, 10]];
  const ib = polygonSectionProperties([I]);
  near(ib.area, 2800, 1e-15, 'I A'); near(ib.Ixx, 2 * (100 * 1000 / 12 + 1000 * 45 * 45) + 10 * 80 ** 3 / 12, 1e-13, 'I Ixx'); near(ib.Iyy, 2 * 10 * 100 ** 3 / 12 + 80 * 10 ** 3 / 12, 1e-13, 'I Iyy');
  // A right triangle, legs b along x and h along y: about its centroid Ixx = bh³/36, Iyy = hb³/36, Ixy = −b²h²/72.
  const t = polygonSectionProperties([[[0, 0], [b, 0], [0, h]]]);
  near(t.Ixx, b * h ** 3 / 36, 1e-13, 'tri Ixx'); near(t.Iyy, h * b ** 3 / 36, 1e-13, 'tri Iyy'); near(t.Ixy, -(b * b * h * h) / 72, 1e-13, 'tri Ixy');
  // Nested: an island inside the hole is material again.
  const nest = polygonSectionProperties([rect(0, 0, 100, 100), rect(10, 10, 90, 90), rect(30, 30, 70, 70)]);
  near(nest.area, 10000 - 6400 + 1600, 1e-15, 'island');
});

test('K5 sections: a rotation leaves the principal moments and turns their axis; an equal angle\'s axes at 45°; FR\'s closed forms agree', () => {
  const base = polygonSectionProperties([rect(-15, -25, 15, 25)]);
  for (const a of [0.3, 1.1, -0.7, 2.5]) {
    const r = polygonSectionProperties([turn(rect(-15, -25, 15, 25), a, [7, -3])]);
    near(r.I1, base.I1, 1e-12, `I1 at ${a}`); near(r.I2, base.I2, 1e-12, `I2 at ${a}`); near(r.centroid[0], 7, 1e-12, 'cx');
    // I1 (50 tall) lies along the turned x axis: its direction is a mod π.
    const d = ((r.angle - a) % Math.PI + Math.PI) % Math.PI; assert.ok(d < 1e-9 || Math.PI - d < 1e-9, `axis ${r.angle} vs ${a}`);
  }
  // An equal angle 50 × 50 × 5: its principal axes along and across the diagonal (±45°).
  const L = polygonSectionProperties([[[0, 0], [50, 0], [50, 5], [5, 5], [5, 50], [0, 50]]]);
  near(Math.abs(Math.abs(L.angle) - Math.PI / 4), 0, 1e-12, 'L at 45°'); near(L.Ixx, L.Iyy, 1e-13, 'L symmetric');
  // FR's sections (D123): a sharp rectangular tube's area and centroid in their closed forms.
  const fr = frameSection({ kind: 'rect-tube', width: 60, height: 40, wall: 3, outerRadius: 0 }), [x0, y0] = fr.box.min, [x1, y1] = fr.box.max, poly = polygonSectionProperties([rect(x0, y0, x1, y1), rect(x0 + 3, y0 + 3, x1 - 3, y1 - 3)]);
  near(poly.area, fr.area, 1e-13, 'FR area'); near(poly.centroid[0], fr.centroid[0], 1e-12, 'FR cx'); near(poly.centroid[1], fr.centroid[1], 1e-12, 'FR cy');
});

test('K5 eigen: random symmetric matrices — AV = VΛ, VᵀV = I, ascending, trace and determinant; repeated and closed-form cases; in place the same', () => {
  const r = rng(31);
  for (let k = 0; k < 500; k++) {
    const a = r() * 10 - 5, b = r() * 10 - 5, c = r() * 10 - 5, d = r() * 4 - 2, e = r() * 4 - 2, f = r() * 4 - 2, S = [a, d, e, d, b, f, e, f, c];
    const { values: L, vectors: V } = symmetricEigen3(S), n = Math.hypot(...S);
    assert.ok(L[0] <= L[1] && L[1] <= L[2], 'ascending');
    for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
      let av = 0; for (let j = 0; j < 3; j++) av += S[row * 3 + j] * V[j * 3 + col];
      assert.ok(Math.abs(av - L[col] * V[row * 3 + col]) <= 1e-12 * n, `AV = VΛ ${k}`);
      let vv = 0; for (let j = 0; j < 3; j++) vv += V[j * 3 + row] * V[j * 3 + col];
      assert.ok(Math.abs(vv - (row === col ? 1 : 0)) <= 1e-12, `VᵀV = I ${k}`);
    }
    near(L[0] + L[1] + L[2], a + b + c, 1e-12, 'trace');
    const det = a * (b * c - f * f) - d * (d * c - f * e) + e * (d * f - b * e); near(L[0] * L[1] * L[2], det, 1e-10, 'det');
  }
  // [[2, 1, 0], [1, 3, 1], [0, 1, 4]]: 3 − √3, 3, 3 + √3; a diagonal one with a repeated value; the identity.
  const q = symmetricEigen3([2, 1, 0, 1, 3, 1, 0, 1, 4]);
  near(q.values[0], 3 - Math.sqrt(3), 1e-14, 'λ1'); near(q.values[1], 3, 1e-14, 'λ2'); near(q.values[2], 3 + Math.sqrt(3), 1e-14, 'λ3');
  assert.deepEqual(symmetricEigen3([5, 0, 0, 0, 5, 0, 0, 0, 1]).values, [1, 5, 5]);
  assert.deepEqual(symmetricEigen3([1, 0, 0, 0, 1, 0, 0, 0, 1]).vectors, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const A = new Float64Array([2, 1, 0, 1, 3, 1, 0, 1, 4]), W = new Float64Array(9); symmetricEigen3InPlace(A, W);
  assert.deepEqual([A[0], A[4], A[8]].sort((x, y) => x - y), [...q.values]);
});

test('K5 mesh volume: a tetrahedron 1/6, a box, the sign of its orientation, a translation; a hull of sphere points below 4/3πR³', () => {
  const P = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], I = [0, 2, 1, 0, 1, 3, 1, 2, 3, 0, 3, 2];
  near(meshVolume(P, I), 1 / 6, 1e-15, 'tetra'); near(meshVolume(P, [...I].reverse()), -1 / 6, 1e-15, 'reversed');
  const box = [0, 0, 0, 4, 0, 0, 4, 3, 0, 0, 3, 0, 0, 0, 2, 4, 0, 2, 4, 3, 2, 0, 3, 2], bi = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
  near(meshVolume(box, bi), 24, 1e-14, 'box'); near(meshVolume(box.map((x, i) => x + [100, -50, 7][i % 3]), bi), 24, 1e-12, 'moved');
  const pts = []; for (let i = 0; i < 2000; i++) { const z = 1 - 2 * (i + 0.5) / 2000, s = Math.sqrt(1 - z * z), a = 2.399963 * i; pts.push(10 * s * Math.cos(a), 10 * s * Math.sin(a), 10 * z); }
  const h = convexHull(pts), v = meshVolume(h.positions, h.indices);
  assert.ok(v < 4 / 3 * Math.PI * 1000 && v > 0.995 * 4 / 3 * Math.PI * 1000, String(v));
});
