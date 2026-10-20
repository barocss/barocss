// Analysis an agent can ask for (A2.2): mass properties, interference and clearance, a section, wall thickness
// and draft. From the evaluated bodies (exact mass from the kernel; distances, rays and angles on the display
// mesh, whose chord error is stated), or by evaluating a probe (an intersection, a split) with the kernel.
// Names, keys and numbers only: no mesh index.
import { withNode, type StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import { bodyKeyFor } from '../engine/ids';
import { materialIdOf } from '../app/bodies';
import { draftField } from '../mould/draft';
import { refOf } from '../app/bodyRef';
import { materialOf } from '../app/materials';

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const v3 = (v: readonly number[]) => v.map(r3) as Vec3;
type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;

/** A body's material and whether it is the default (none set: aluminium assumed). */
export function materialFact(doc: StudioDoc, b: BodyResult): { material: string; assumed: boolean } {
  const id = materialIdOf(doc, b), m = materialOf(id);
  return { material: m.label, assumed: !id };
}

/** Mass properties of bodies: volume, area, mass (its material's density), centroid, inertia about it, box. */
export function massProperties(doc: StudioDoc, bodies: readonly BodyResult[]): Record<string, unknown>[] {
  return bodies.map(b => {
    const mat = materialFact(doc, b), rho = materialOf(materialIdOf(doc, b)).gPerCm3;
    // (The kernel's inertia is for aluminium, 2.70 g/cm³: scaled to the body's density.)
    const inertia = b.inertia?.map(row => row.map(x => Number((x * rho / 2.7).toPrecision(6))));
    return { body: b.key, ...mat, volume_mm3: b.volumeMM3 === null ? null : r3(b.volumeMM3), area_mm2: r3(b.mesh.faces.reduce((a, f) => a + f.areaMM2, 0)),
      mass_g: b.volumeMM3 === null ? null : r3(b.volumeMM3 * rho / 1000), centroid: b.centroid ? v3(b.centroid) : null,
      ...(inertia ? { inertia_kg_m2_about_centroid: inertia } : {}), bbox: { min: v3(b.mesh.bounds.min), max: v3(b.mesh.bounds.max) } };
  });
}

// ---- mesh geometry (module level: the loops below run per triangle) ----------------------------------------
const tri = new Float64Array(9);
function triangleAt(m: DisplayMesh, t: number): void {
  for (let k = 0; k < 3; k++) { const i = m.indices[t * 3 + k]; tri[k * 3] = m.positions[i * 3]; tri[k * 3 + 1] = m.positions[i * 3 + 1]; tri[k * 3 + 2] = m.positions[i * 3 + 2]; }
}
/** Distance along (dx, dy, dz) from (ox, oy, oz) to the triangle in `tri` (Möller–Trumbore), or Infinity. */
function rayHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
  const e1x = tri[3] - tri[0], e1y = tri[4] - tri[1], e1z = tri[5] - tri[2], e2x = tri[6] - tri[0], e2y = tri[7] - tri[1], e2z = tri[8] - tri[2];
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-14) return Infinity;
  const inv = 1 / det, tx = ox - tri[0], ty = oy - tri[1], tz = oz - tri[2], u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return Infinity;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return Infinity;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > 1e-9 ? t : Infinity;
}
/** Squared distance from p to the triangle in `tri` (closest point by regions). */
function pointTriangle2(px: number, py: number, pz: number): number {
  const ax = tri[0], ay = tri[1], az = tri[2], abx = tri[3] - ax, aby = tri[4] - ay, abz = tri[5] - az, acx = tri[6] - ax, acy = tri[7] - ay, acz = tri[8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az, d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let cx: number, cy: number, cz: number;
  if (d1 <= 0 && d2 <= 0) { cx = ax; cy = ay; cz = az; }
  else {
    const bpx = px - tri[3], bpy = py - tri[4], bpz = pz - tri[5], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    const cpx = px - tri[6], cpy = py - tri[7], cpz = pz - tri[8], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) { cx = tri[3]; cy = tri[4]; cz = tri[5]; }
    else if (d6 >= 0 && d5 <= d6) { cx = tri[6]; cy = tri[7]; cz = tri[8]; }
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); cx = ax + abx * v; cy = ay + aby * v; cz = az + abz * v; }
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); cx = ax + acx * w; cy = ay + acy * w; cz = az + acz * w; }
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + d5 - d6); cx = tri[3] + (tri[6] - tri[3]) * w; cy = tri[4] + (tri[7] - tri[4]) * w; cz = tri[5] + (tri[8] - tri[5]) * w; }
    else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; cx = ax + abx * v + acx * w; cy = ay + aby * v + acy * w; cz = az + abz * v + acz * w; }
  }
  return (px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2;
}

/** The smallest distance between two bodies' meshes (each one's vertices against the other's triangles), with the points. */
function clearance(a: DisplayMesh, b: DisplayMesh): { distance: number; at: Vec3 } {
  let best = Infinity, at: Vec3 = [0, 0, 0];
  for (const [m, o] of [[a, b], [b, a]] as const) {
    const n = m.positions.length / 3, T = o.indices.length / 3;
    for (let v = 0; v < n; v++) {
      const px = m.positions[v * 3], py = m.positions[v * 3 + 1], pz = m.positions[v * 3 + 2];
      for (let t = 0; t < T; t++) { triangleAt(o, t); const d = pointTriangle2(px, py, pz); if (d < best) { best = d; at = [px, py, pz]; } }
    }
  }
  return { distance: Math.sqrt(best), at };
}

/**
 * Interference and clearance between bodies (every pair of `keys`, or of all): overlapping pairs with the
 * overlap's volume (the kernel's intersection), and the others' clearance (on the display mesh).
 */
export async function interference(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, keys?: readonly string[]): Promise<Record<string, unknown>[]> {
  const list = keys?.length ? bodies.filter(b => keys.includes(b.key)) : bodies, out: Record<string, unknown>[] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const A = list[i].mesh.bounds, B = list[j].mesh.bounds;
    const apart = [0, 1, 2].some(k => A.max[k] < B.min[k] - 1e-6 || B.max[k] < A.min[k] - 1e-6);
    let overlap = 0;
    if (!apart) {
      const probe = withNode(doc, { kind: 'intersect', left: refOf(list[i]), right: refOf(list[j]) });
      const r = await evaluate(probe);
      overlap = r?.ok ? r.bodies.find(b => b.key === bodyKeyFor(probe.nodes, probe.nodes.length - 1))?.volumeMM3 ?? 0 : 0;
    }
    if (overlap > 1e-6) out.push({ a: list[i].key, b: list[j].key, overlap_mm3: r3(overlap) });
    else { const c = clearance(list[i].mesh, list[j].mesh); out.push({ a: list[i].key, b: list[j].key, clearance_mm: r3(c.distance), near: v3(c.at) }); }
  }
  return out;
}

/** A section across `axis` at `at`: each body it cuts, with the cut's area and box (the kernel's split). */
export async function section(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, axis: 'x' | 'y' | 'z', at: number): Promise<Record<string, unknown>[] | string> {
  const k = 'xyz'.indexOf(axis), crossed = bodies.filter(b => b.mesh.bounds.min[k] < at - 1e-6 && b.mesh.bounds.max[k] > at + 1e-6);
  if (!crossed.length) return `the plane ${axis} = ${at} cuts no body (bodies span ${bodies.map(b => `${b.key}: ${r3(b.mesh.bounds.min[k])}…${r3(b.mesh.bounds.max[k])}`).join(', ') || 'nothing'})`;
  let probe = doc;
  const cuts = crossed.map(b => { probe = withNode(probe, { kind: 'split', parent: refOf(b), axis, at }); return { body: b.key, node: probe.nodes.length - 1 }; });
  const r = await evaluate(probe);
  if (!r?.ok) return 'the section could not be cut';
  return cuts.map(c => {
    const half = r.bodies.find(b => b.key === bodyKeyFor(probe.nodes, c.node, 'negative')), id = probe.nodes[c.node].id;
    const faces = half?.mesh.faces.filter(f => f.name.split('+').some(n => n.startsWith(`${id}.cut`))) ?? [];
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const m = half?.mesh;
    if (m) for (let v = 0; v < m.faceOfVertex.length; v++) if (faces.some(f => f.index === m.faceOfVertex[v])) for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], m.positions[v * 3 + q]); hi[q] = Math.max(hi[q], m.positions[v * 3 + q]); }
    return { body: c.body, cut_area_mm2: r3(faces.reduce((a, f) => a + f.areaMM2, 0)), regions: faces.length, ...(faces.length ? { box: { min: v3(lo), max: v3(hi) } } : {}) };
  });
}

// A uniform grid over a mesh's triangles, for rays (wall thickness): cells about two triangles each.
interface Grid { n: number; lo: Float64Array; size: Float64Array; cells: Int32Array[]; stamp: Int32Array; mark: number }
function gridOf(m: DisplayMesh): Grid {
  const T = m.indices.length / 3, n = Math.max(1, Math.min(64, Math.ceil(Math.cbrt(T / 2)))), lo = new Float64Array(3), hi = new Float64Array(3);
  for (let k = 0; k < 3; k++) { lo[k] = m.bounds.min[k] - 1e-6; hi[k] = m.bounds.max[k] + 1e-6; }
  const size = new Float64Array(3); for (let k = 0; k < 3; k++) size[k] = Math.max(1e-9, (hi[k] - lo[k]) / n);
  const lists: number[][] = Array.from({ length: n * n * n }, () => []);
  for (let t = 0; t < T; t++) {
    triangleAt(m, t);
    const a = [0, 0, 0], b = [0, 0, 0];
    for (let k = 0; k < 3; k++) { const mn = Math.min(tri[k], tri[3 + k], tri[6 + k]), mx = Math.max(tri[k], tri[3 + k], tri[6 + k]); a[k] = Math.max(0, Math.min(n - 1, Math.floor((mn - lo[k]) / size[k]))); b[k] = Math.max(0, Math.min(n - 1, Math.floor((mx - lo[k]) / size[k]))); }
    for (let i = a[0]; i <= b[0]; i++) for (let j = a[1]; j <= b[1]; j++) for (let k = a[2]; k <= b[2]; k++) lists[(i * n + j) * n + k].push(t);
  }
  return { n, lo, size, cells: lists.map(l => Int32Array.from(l)), stamp: new Int32Array(T), mark: 0 };
}
/** The nearest hit along a ray through the grid (Amanatides–Woo), skipping triangle `skip`; Infinity for none. */
function gridRay(m: DisplayMesh, g: Grid, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, skip: number): number {
  const o = [ox, oy, oz], d = [dx, dy, dz], c = [0, 0, 0], step = [0, 0, 0], tMax = [0, 0, 0], tDelta = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    c[k] = Math.max(0, Math.min(g.n - 1, Math.floor((o[k] - g.lo[k]) / g.size[k])));
    step[k] = d[k] > 0 ? 1 : d[k] < 0 ? -1 : 0;
    const edge = g.lo[k] + (c[k] + (step[k] > 0 ? 1 : 0)) * g.size[k];
    tMax[k] = step[k] ? (edge - o[k]) / d[k] : Infinity; tDelta[k] = step[k] ? g.size[k] / Math.abs(d[k]) : Infinity;
  }
  g.mark++;
  let best = Infinity;
  for (;;) {
    const list = g.cells[(c[0] * g.n + c[1]) * g.n + c[2]];
    for (let q = 0; q < list.length; q++) {
      const t = list[q]; if (t === skip || g.stamp[t] === g.mark) continue;
      g.stamp[t] = g.mark; triangleAt(m, t);
      const h = rayHit(ox, oy, oz, dx, dy, dz); if (h < best) best = h;
    }
    const k = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
    // (A hit nearer than the next cell's boundary cannot be beaten further on.)
    if (best <= tMax[k]) return best;
    c[k] += step[k]; if (c[k] < 0 || c[k] >= g.n) return best;
    tMax[k] += tDelta[k];
  }
}

/**
 * Wall thickness of a body: from sample points on its faces (each triangle's centre), a ray inward against the
 * face's normal to the next wall (through a uniform grid of the triangles). The thinnest (with where), and the
 * faces under `below` mm if asked. On the display mesh: good to its chord error on curved walls.
 */
// (A body's wall thickness depends on its mesh alone: kept per mesh, as the print rules and checks ask again, PERF3 A1.)
const walls = new WeakMap<DisplayMesh, Map<number | undefined, Record<string, unknown>>>();
export function wallThickness(b: BodyResult, below?: number): Record<string, unknown> {
  let byBelow = walls.get(b.mesh); if (!byBelow) { byBelow = new Map(); walls.set(b.mesh, byBelow); }
  let r = byBelow.get(below); if (!r) { r = measureWalls(b, below); byBelow.set(below, r); }
  return r;
}
function measureWalls(b: BodyResult, below?: number): Record<string, unknown> {
  const m = b.mesh, T = m.indices.length / 3, perFace = new Map<number, number>(), g = gridOf(m), depth = new Float64Array(T), area = new Float64Array(T);
  let min = Infinity, at: Vec3 = [0, 0, 0], face = -1;
  for (let t = 0; t < T; t++) {
    triangleAt(m, t);
    const cx = (tri[0] + tri[3] + tri[6]) / 3, cy = (tri[1] + tri[4] + tri[7]) / 3, cz = (tri[2] + tri[5] + tri[8]) / 3;
    const e1x = tri[3] - tri[0], e1y = tri[4] - tri[1], e1z = tri[5] - tri[2], e2x = tri[6] - tri[0], e2y = tri[7] - tri[1], e2z = tri[8] - tri[2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const l = Math.hypot(nx, ny, nz); if (!(l > 0)) continue;
    nx /= -l; ny /= -l; nz /= -l;
    const d = gridRay(m, g, cx, cy, cz, nx, ny, nz, t);
    depth[t] = d; area[t] = l / 2;
    const f = m.faceOfVertex[m.indices[t * 3]];
    if (d < (perFace.get(f) ?? Infinity)) perFace.set(f, d);
    if (d < min) { min = d; at = [cx, cy, cz]; face = f; }
  }
  const name = (f: number) => m.faces[f]?.name.split('+')[0];
  // (The thick sections, IM1: the depth that 95 % of the surface's area is within — a rim's ray down its wall's length,
  // a small area, is left above it.)
  const order = Array.from(depth.keys()).filter(t => Number.isFinite(depth[t])).sort((x, y) => depth[x] - depth[y]), total = order.reduce((a, t) => a + area[t], 0);
  let acc = 0, p95 = NaN;
  for (const t of order) { acc += area[t]; if (acc >= 0.95 * total) { p95 = depth[t]; break; } }
  return { body: b.key, ...(Number.isFinite(min) ? { thinnest_mm: r3(min), at: v3(at), face: name(face), thick95_mm: r3(p95) } : { thinnest_mm: null }),
    ...(below !== undefined ? { faces_below: [...perFace].filter(([, d]) => d < below).map(([f, d]) => ({ face: name(f), thickness_mm: r3(d) })) } : {}) };
}

/**
 * Draft of a body's faces against a pull direction (IM2, O78): each face's exact draft (degrees, signed by n·d: 0 a wall
 * along the pull) — planes, cylinders and curved faces alike — its class against `min`, and the walls (faces within
 * 45° of the pull) with their least draft; those under `min`.
 */
export function draftAnalysis(doc: StudioDoc, b: BodyResult, pull: Vec3, min = 1): Record<string, unknown> {
  const f = draftField(doc, [b], pull, min), walls = f.faces.filter(x => Math.min(Math.abs(x.minDeg), Math.abs(x.maxDeg)) < 45 || x.cls === 'straddle');
  return { body: b.key, pull: v3(f.pull),
    walls: walls.map(x => ({ face: x.face, draft_deg: r3(x.cls === 'straddle' ? 0 : Math.sign(x.maxDeg) * x.steepestDeg), min_deg: r3(x.minDeg), max_deg: r3(x.maxDeg), class: x.cls, ...(x.isocline ? { isocline_points: x.isocline.length } : {}) })),
    under_min: walls.filter(x => x.cls !== 'drafted').map(x => x.face), note: 'exact normals (planes, cylinders, curved faces from the B-rep); straddle: n·d takes both signs, a parting line crosses it' };
}
