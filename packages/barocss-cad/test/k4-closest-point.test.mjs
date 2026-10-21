import test from 'node:test';
import assert from 'node:assert/strict';
import { closestPointOnSurface, surfaceSeedGrid, closestPointOnTriangle, pointTriangleDistance2, evaluateCadPart, surfaceEvaluator } from '../dist/index.js';

// K4 (D143): the nearest point of a NURBS surface, and of a triangle. Oracles, none of them the kernel's: closed-form
// feet on exact surfaces the part model builds (a cylinder, a sphere, a torus: the radial foot), a plane patch's
// orthogonal projection, a patch's edge for a point past it, a dense parameter scan for a freeform patch; for triangles,
// the K2 point–triangle distance and a barycentric scan.

const run = features => evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const curved = brep => brep.faces.filter(f => f.surface.kind === 'surface' && (f.surface.degreeU > 1 || f.surface.degreeV > 1)).map(f => f.surface);
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** The nearest of several faces (a closed surface split into patches), as a caller does. */
const grids = new WeakMap(), gridOf = s => { let g = grids.get(s); if (!g) { g = surfaceSeedGrid(s); grids.set(s, g); } return g; };
const nearestOf = (faces, p) => faces.map(s => closestPointOnSurface(s, p, { grid: gridOf(s) })).reduce((a, b) => (b.distance < a.distance ? b : a));

test('K4 surfaces: a cylinder, a sphere and a torus (the radial foot in closed form), on and off them, the unit normal radial', () => {
  const r = rng(21);
  // A cylinder R 10, 0 ≤ z ≤ 30 (a circle extruded): its side's foot (R p_xy/|p_xy|, z), the distance ||p_xy| − R|.
  const cyl = curved(run([{ id: 'c', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 }, { id: 'e', kind: 'extrude', sketch: 'c', height: 30 }]).output('e').brep);
  for (let k = 0; k < 200; k++) {
    const a = 2 * Math.PI * r(), rr = 10 * (0.3 + 2 * r()), z = 1 + 28 * r(), p = [rr * Math.cos(a), rr * Math.sin(a), z], f = nearestOf(cyl, p);
    assert.ok(Math.abs(f.distance - Math.abs(rr - 10)) <= 1e-9, `cylinder ${k}: ${f.distance} vs ${Math.abs(rr - 10)}`);
    assert.ok(Math.abs(f.point[0] - 10 * Math.cos(a)) <= 1e-9 && Math.abs(f.point[1] - 10 * Math.sin(a)) <= 1e-9 && Math.abs(f.point[2] - z) <= 1e-9);
    assert.ok(Math.abs(Math.abs(f.normal[0] * Math.cos(a) + f.normal[1] * Math.sin(a)) - 1) <= 1e-9, 'radial normal');
  }
  // Exactly on the circle's quadrant joins (a C0 knot of the rational circle): no throw, the foot.
  for (const a of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) { const f = nearestOf(cyl, [15 * Math.cos(a), 15 * Math.sin(a), 10]); assert.ok(Math.abs(f.distance - 5) <= 1e-9, `on the join ${a}`); }
  // Past the patch's end (z > 30): the foot on its top circle, the distance √((ρ − R)² + (z − 30)²).
  { const f = nearestOf(cyl, [13, 0, 34]); assert.ok(Math.abs(f.distance - 5) <= 1e-9 && Math.abs(f.point[2] - 30) <= 1e-12, `past the end ${f.distance}`); }
  // A sphere R 12 (a half disc revolved): the distance ||p| − R|.
  const sph = curved(run([{ id: 'p', kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, -12] }, { kind: 'arc', start: [0, 12], center: [0, 0], direction: 'cw' }] }, { id: 's', kind: 'revolve', sketch: 'p', axis: { origin: [0, 0], direction: 'y' } }]).output('s').brep);
  for (let k = 0; k < 150; k++) {
    const z = 2 * r() - 1, ph = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z), rr = 12 * (0.2 + 2 * r()), p = [rr * s * Math.cos(ph), rr * s * Math.sin(ph), rr * z], f = nearestOf(sph, p);
    assert.ok(Math.abs(f.distance - Math.abs(rr - 12)) <= 1e-8, `sphere ${k}: ${f.distance} vs ${Math.abs(rr - 12)}`);
  }
  // A torus R 20, r 4 about Y: the distance |√((ρ − R)² + y²) − r|, ρ the distance from the axis.
  const tor = curved(run([{ id: 'c', kind: 'sketch', profile: 'circle', center: [20, 0], radius: 4 }, { id: 't', kind: 'revolve', sketch: 'c', axis: { origin: [0, 0], direction: 'y' } }]).output('t').brep);
  for (let k = 0; k < 150; k++) {
    const a = 2 * Math.PI * r(), b = 2 * Math.PI * r(), d = 4 * (0.1 + 1.6 * r()), rho = 20 + d * Math.cos(b), p = [rho * Math.cos(a), d * Math.sin(b), rho * Math.sin(a)], f = nearestOf(tor, p);
    assert.ok(Math.abs(f.distance - Math.abs(d - 4)) <= 1e-8, `torus ${k}: ${f.distance} vs ${Math.abs(d - 4)}`);
  }
});

test('K4 surfaces: a freeform bicubic patch — the foot against a dense parameter scan polished by bisection; the seed and the grid agree; a prebuilt grid is the same', () => {
  const cp = []; for (let i = 0; i < 4; i++) { const row = []; for (let j = 0; j < 4; j++) row.push([i * 40 / 3, j * 40 / 3, ((i - 1.5) ** 2 - (j - 1.5) ** 2) * 2 + (i === 1 && j === 2 ? 6 : 0)]); cp.push(row); }
  const s = { kind: 'surface', id: 's', degreeU: 3, degreeV: 3, knotsU: [0, 0, 0, 0, 1, 1, 1, 1], knotsV: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: cp, weights: cp.map(r => r.map(() => 1)) };
  const r = rng(22), grid = surfaceSeedGrid(s, 24), S = surfaceEvaluator(s);
  for (let k = 0; k < 40; k++) {
    const p = [5 + 30 * r(), 5 + 30 * r(), -4 + 8 * r()], f = closestPointOnSurface(s, p), g = closestPointOnSurface(s, p, { grid });
    // The scan: 200 × 200, then a local refinement by shrinking the window round the best (independent of Gauss–Newton).
    let bu = 0, bv = 0, bd = Infinity, h = 1 / 200;
    for (let i = 0; i <= 200; i++) for (let j = 0; j <= 200; j++) { const q = S(i * h, j * h), d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); if (d < bd) { bd = d; bu = i * h; bv = j * h; } }
    for (let round = 0; round < 40; round++) { h /= 2; let nu = bu, nv = bv; for (const du of [-h, 0, h]) for (const dv of [-h, 0, h]) { const u = Math.min(1, Math.max(0, bu + du)), v = Math.min(1, Math.max(0, bv + dv)), q = S(u, v), d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); if (d < bd) { bd = d; nu = u; nv = v; } } bu = nu; bv = nv; }
    assert.ok(f.distance <= bd + 1e-9, `patch ${k}: Gauss–Newton ${f.distance} vs the scan ${bd}`);
    assert.ok(Math.abs(f.distance - bd) <= 1e-7, `patch ${k}: ${f.distance} vs ${bd}`);
    assert.equal(g.distance, f.distance, 'a prebuilt grid');
    const seeded = closestPointOnSurface(s, p, { seed: [f.u, f.v] }); assert.ok(Math.abs(seeded.distance - f.distance) <= 1e-12, 'from its own foot');
  }
});

test('K4 triangles: the closest point lies in the triangle, at the K2 distance, nearer than a barycentric scan', () => {
  const r = rng(23);
  for (let k = 0; k < 300; k++) {
    const a = [r() * 10, r() * 10, r() * 10], b = [r() * 10, r() * 10, r() * 10], c = [r() * 10, r() * 10, r() * 10], p = [r() * 20 - 5, r() * 20 - 5, r() * 20 - 5];
    const q = closestPointOnTriangle(p, a, b, c), d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    assert.ok(Math.abs(d * d - pointTriangleDistance2([...a, ...b, ...c], [0, 1, 2], 0, ...p)) <= 1e-9 * Math.max(1, d * d), `triangle ${k}`);
    let scan = Infinity; for (let i = 0; i <= 60; i++) for (let j = 0; i + j <= 60; j++) { const l1 = i / 60, l2 = j / 60, l3 = 1 - l1 - l2, x = [0, 1, 2].map(m => l1 * a[m] + l2 * b[m] + l3 * c[m]); scan = Math.min(scan, Math.hypot(x[0] - p[0], x[1] - p[1], x[2] - p[2])); }
    assert.ok(d <= scan + 1e-12, `triangle ${k}: ${d} vs scan ${scan}`);
  }
});
