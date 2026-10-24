// Analysis an agent can ask for (A2.2): mass properties, interference and clearance, a section, wall thickness
// and draft. From the evaluated bodies (exact mass from the kernel; distances, rays and angles on the display
// mesh, whose chord error is stated), or by evaluating a probe (an intersection, a split) with the kernel.
// Names, keys and numbers only: no mesh index.
import { meshClearance, nearestDistance2, rayHit, triangleBvh, type TriangleBvh } from '@barocss/cad';
import { withNode, type StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import { bodyKeyFor } from '../engine/ids';
import { materialIdOf } from '../app/bodies';
import { draftField } from '../mould/draft';
import { refOf } from '../app/bodyRef';
import { materialOf } from '../library/materials';
import { r3Signed as r3 } from '../util/round';
import { KERNEL_DENSITY, massGOf } from '../app/mass';

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
    const mat = materialFact(doc, b), rho = materialOf(materialIdOf(doc, b)).density;
    // (The kernel's inertia is for aluminium, 2.70 g/cm³: scaled to the body's density — as (x · ρ) / 2.7, an order kept
    // apart from app/mass's x · (ρ / 2.7), which rounds differently.)
    const inertia = b.inertia?.map(row => row.map(x => Number((x * rho / KERNEL_DENSITY).toPrecision(6))));
    return { body: b.key, ...mat, volume: b.volume === null ? null : r3(b.volume), area: r3(b.area ?? b.mesh.faces.reduce((a, f) => a + f.area, 0)), ...(b.areaBasis === 'exact' ? {} : { area_basis: 'the display mesh\'s triangles (the kernel could not integrate it): a little low on curved faces' }),
      mass: b.volume === null ? null : r3(massGOf(b.volume, rho)),
      // (O179: a volume from the mesh is said so, with its bound and the mass's — never shown as exact.)
      ...(b.volumeBasis ? { volume_basis: { method: b.volumeBasis.method, bound: b.volumeBasis.bound === null ? null : r3(b.volumeBasis.bound), massBound: b.volumeBasis.bound === null ? null : r3(massGOf(b.volumeBasis.bound, rho)), note: 'the display mesh\'s volume (the kernel could not integrate it): within the bound of the exact, an estimate' } } : {}),
      centroid: b.centroid ? v3(b.centroid) : null,
      ...(inertia ? { inertia: inertia } : {}), bbox: { min: v3(b.mesh.bounds.min), max: v3(b.mesh.bounds.max) } };
  });
}

/**
 * O179: how far the bodies' mass may be off, in grams — the sum of each tessellated body's volume bound times its
 * material's density; 0 when every volume is exact; null when a tessellated body has no bound.
 */
export function massBoundOf(doc: StudioDoc, bodies: readonly BodyResult[]): number | null {
  let g = 0;
  for (const b of bodies) {
    if (!b.volumeBasis) continue;
    if (b.volumeBasis.bound === null) return null;
    g += massGOf(b.volumeBasis.bound, materialOf(materialIdOf(doc, b)).density);
  }
  return g;
}

// ---- mesh geometry (module level: the loops below run per triangle) ----------------------------------------
const tri = new Float64Array(9);
function triangleAt(m: DisplayMesh, t: number): void {
  for (let k = 0; k < 3; k++) { const i = m.indices[t * 3 + k]; tri[k * 3] = m.positions[i * 3]; tri[k * 3 + 1] = m.positions[i * 3 + 1]; tri[k * 3 + 2] = m.positions[i * 3 + 2]; }
}
/** The smallest distance between two bodies' meshes, exactly (the kernel's `meshClearance`, K3: every triangle pair, an edge to an edge included), with its point on the first. */
function clearance(a: DisplayMesh, b: DisplayMesh): { distance: number; at: Vec3 } {
  const c = meshClearance(a.positions, a.indices, b.positions, b.indices);
  return { distance: c.distance, at: (c.pointA ?? [0, 0, 0]) as Vec3 };
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
      overlap = r?.ok ? r.bodies.find(b => b.key === bodyKeyFor(probe.nodes, probe.nodes.length - 1))?.volume ?? 0 : 0;
    }
    if (overlap > 1e-6) out.push({ a: list[i].key, b: list[j].key, overlap: r3(overlap) });
    else { const c = clearance(list[i].mesh, list[j].mesh); out.push({ a: list[i].key, b: list[j].key, clearance: r3(c.distance), near: v3(c.at) }); }
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
    return { body: c.body, cutArea: r3(faces.reduce((a, f) => a + f.area, 0)), regions: faces.length, ...(faces.length ? { box: { min: v3(lo), max: v3(hi) } } : {}) };
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
  return { body: b.key, ...(Number.isFinite(min) ? { thinnest: r3(min), at: v3(at), face: name(face), thick95: r3(p95) } : { thinnest: null }),
    ...(below !== undefined ? { faces_below: [...perFace].filter(([, d]) => d < below).map(([f, d]) => ({ face: name(f), thickness: r3(d) })) } : {}) };
}

/**
 * Draft of a body's faces against a pull direction (IM2, O78): each face's exact draft (degrees, signed by n·d: 0 a wall
 * along the pull) — planes, cylinders and curved faces alike — its class against `min`, and the walls (faces within
 * 45° of the pull) with their least draft; those under `min`.
 */
export function draftAnalysis(doc: StudioDoc, b: BodyResult, pull: Vec3, min = 1): Record<string, unknown> {
  const f = draftField(doc, [b], pull, min), walls = f.faces.filter(x => Math.min(Math.abs(x.min), Math.abs(x.max)) < 45 || x.cls === 'straddle');
  return { body: b.key, pull: v3(f.pull),
    walls: walls.map(x => ({ face: x.face, draft: r3(x.cls === 'straddle' ? 0 : Math.sign(x.max) * x.steepest), min: r3(x.min), max: r3(x.max), class: x.cls, ...(x.isocline ? { isocline_points: x.isocline.length } : {}) })),
    under_min: walls.filter(x => x.cls !== 'drafted').map(x => x.face), note: 'exact normals (planes, cylinders, curved faces from the B-rep); straddle: n·d takes both signs, a parting line crosses it' };
}
