// Analysis an agent can ask for (A2.2): mass properties, interference and clearance, a section, wall thickness
// and draft. From the evaluated bodies (exact mass from the kernel; distances, rays and angles on the display
// mesh, whose chord error is stated), or by evaluating a probe (an intersection, a split) with the kernel.
// Names, keys and numbers only: no mesh index.
import { nearestDistance2, rayHit, triangleBvh, type TriangleBvh } from '@barocss/cad';
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

// Rays and nearest points through the kernel's triangle hierarchy (`triangleBvh`, K2), one per mesh as it is asked for.
// (The two ray ends written into module scratch: the loops below run per triangle.)
const rayO = new Float64Array(3), rayD = new Float64Array(3);
function inward(g: TriangleBvh, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, skip: number): number {
  rayO[0] = ox; rayO[1] = oy; rayO[2] = oz; rayD[0] = dx; rayD[1] = dy; rayD[2] = dz;
  return rayHit(g, rayO, rayD, 1e-9, skip);
}
/**
 * A body's wall samples (IM4, O80), one per display triangle: its centre, area and face, the ray depth inward along its
 * normal, and the local thickness — twice the distance from the ray's midpoint to the nearest surface, at most the ray
 * depth: the inscribed sphere there. A ray along a rim runs down its wall's length; the sphere at its middle touches the
 * wall's two faces, so the rim reads the wall. Kept per mesh.
 */
export interface WallSamples { depth: Float64Array; local: Float64Array; area: Float64Array; face: Int32Array; centre: Float64Array }
const samplesOf = new WeakMap<DisplayMesh, WallSamples>();
export function wallSamples(b: BodyResult): WallSamples {
  const have = samplesOf.get(b.mesh); if (have) return have;
  const m = b.mesh, T = m.indices.length / 3, g = triangleBvh(m.positions, m.indices), out: WallSamples = { depth: new Float64Array(T).fill(Infinity), local: new Float64Array(T).fill(Infinity), area: new Float64Array(T), face: new Int32Array(T), centre: new Float64Array(3 * T) };
  for (let t = 0; t < T; t++) {
    triangleAt(m, t);
    const cx = (tri[0] + tri[3] + tri[6]) / 3, cy = (tri[1] + tri[4] + tri[7]) / 3, cz = (tri[2] + tri[5] + tri[8]) / 3;
    const e1x = tri[3] - tri[0], e1y = tri[4] - tri[1], e1z = tri[5] - tri[2], e2x = tri[6] - tri[0], e2y = tri[7] - tri[1], e2z = tri[8] - tri[2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const l = Math.hypot(nx, ny, nz);
    out.face[t] = m.faceOfVertex[m.indices[t * 3]]; out.centre[3 * t] = cx; out.centre[3 * t + 1] = cy; out.centre[3 * t + 2] = cz;
    if (!(l > 0)) continue;
    nx /= -l; ny /= -l; nz /= -l; out.area[t] = l / 2;
    const d = inward(g, cx, cy, cz, nx, ny, nz, t); out.depth[t] = d;
    if (Number.isFinite(d)) out.local[t] = 2 * Math.sqrt(nearestDistance2(g, cx + nx * d / 2, cy + ny * d / 2, cz + nz * d / 2, d * d / 4));
  }
  samplesOf.set(b.mesh, out);
  return out;
}

/**
 * Wall thickness of a body: from sample points on its faces (each triangle's centre), a ray inward against the
 * face's normal to the next wall (through the kernel's triangle hierarchy). The thinnest (with where), and the
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
  const m = b.mesh, T = m.indices.length / 3, perFace = new Map<number, number>(), g = triangleBvh(m.positions, m.indices), depth = new Float64Array(T), area = new Float64Array(T);
  let min = Infinity, at: Vec3 = [0, 0, 0], face = -1;
  for (let t = 0; t < T; t++) {
    triangleAt(m, t);
    const cx = (tri[0] + tri[3] + tri[6]) / 3, cy = (tri[1] + tri[4] + tri[7]) / 3, cz = (tri[2] + tri[5] + tri[8]) / 3;
    const e1x = tri[3] - tri[0], e1y = tri[4] - tri[1], e1z = tri[5] - tri[2], e2x = tri[6] - tri[0], e2y = tri[7] - tri[1], e2z = tri[8] - tri[2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const l = Math.hypot(nx, ny, nz); if (!(l > 0)) continue;
    nx /= -l; ny /= -l; nz /= -l;
    const d = inward(g, cx, cy, cz, nx, ny, nz, t);
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
