// Analysis an agent can ask for (A2.2): mass properties, interference and clearance, a section, wall thickness
// and draft. From the evaluated bodies (exact mass from the kernel; distances, rays and angles on the display
// mesh, whose chord error is stated), or by evaluating a probe (an intersection, a split) with the kernel.
// Names, keys and numbers only: no mesh index.
import { withNode, type StudioDoc } from '../engine/doc';
import type { BodyResult, EvalResult } from '../engine/evaluate';
import type { DisplayMesh, Vec3 } from '../engine/mesh';
import { bodyKeyFor } from '../engine/ids';
import { lookOf } from '../app/bodies';
import { refOf } from '../app/bodyRef';
import { materialOf } from '../app/materials';

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const v3 = (v: readonly number[]) => v.map(r3) as Vec3;
type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;

/** A body's material and whether it is the default (none set: aluminium assumed). */
export function materialFact(doc: StudioDoc, b: BodyResult): { material: string; assumed: boolean } {
  const id = lookOf(doc, b).material, m = materialOf(id);
  return { material: m.label, assumed: !id };
}

/** Mass properties of bodies: volume, area, mass (its material's density), centroid, inertia about it, box. */
export function massProperties(doc: StudioDoc, bodies: readonly BodyResult[]): Record<string, unknown>[] {
  return bodies.map(b => {
    const mat = materialFact(doc, b), rho = materialOf(lookOf(doc, b).material).gPerCm3;
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

/**
 * Wall thickness of a body: from sample points on its faces (each triangle's centre), a ray inward against the
 * face's normal to the next wall. The thinnest (with where), and the faces under `below` mm if asked. On the
 * display mesh: good to its chord error on curved walls.
 */
export function wallThickness(b: BodyResult, below?: number): Record<string, unknown> {
  const m = b.mesh, T = m.indices.length / 3, perFace = new Map<number, number>();
  let min = Infinity, at: Vec3 = [0, 0, 0], face = -1;
  for (let t = 0; t < T; t++) {
    triangleAt(m, t);
    const cx = (tri[0] + tri[3] + tri[6]) / 3, cy = (tri[1] + tri[4] + tri[7]) / 3, cz = (tri[2] + tri[5] + tri[8]) / 3;
    const e1x = tri[3] - tri[0], e1y = tri[4] - tri[1], e1z = tri[5] - tri[2], e2x = tri[6] - tri[0], e2y = tri[7] - tri[1], e2z = tri[8] - tri[2];
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x; const l = Math.hypot(nx, ny, nz); if (!(l > 0)) continue;
    nx /= -l; ny /= -l; nz /= -l;
    let d = Infinity;
    for (let s = 0; s < T; s++) { if (s === t) continue; triangleAt(m, s); const h = rayHit(cx, cy, cz, nx, ny, nz); if (h < d) d = h; }
    const f = m.faceOfVertex[m.indices[t * 3]];
    if (d < (perFace.get(f) ?? Infinity)) perFace.set(f, d);
    if (d < min) { min = d; at = [cx, cy, cz]; face = f; }
  }
  const name = (f: number) => m.faces[f]?.name.split('+')[0];
  return { body: b.key, ...(Number.isFinite(min) ? { thinnest_mm: r3(min), at: v3(at), face: name(face) } : { thinnest_mm: null }),
    ...(below !== undefined ? { faces_below: [...perFace].filter(([, d]) => d < below).map(([f, d]) => ({ face: name(f), thickness_mm: r3(d) })) } : {}) };
}

/** Draft of a body's faces against a pull direction: each flat face's draft angle (degrees; negative: an undercut); those under `min`. */
export function draftAnalysis(b: BodyResult, pull: Vec3, min = 1): Record<string, unknown> {
  const l = Math.hypot(...pull), p = pull.map(x => x / l);
  const faces = b.mesh.faces.filter(f => f.kind === 'plane').map(f => ({ face: f.name.split('+')[0], angle: 90 - Math.acos(Math.max(-1, Math.min(1, f.normal[0] * p[0] + f.normal[1] * p[1] + f.normal[2] * p[2]))) * 180 / Math.PI }));
  // (Faces facing the pull or against it, within 45°, are tops and bottoms: no draft to speak of.)
  const walls = faces.filter(f => Math.abs(f.angle) < 45);
  return { body: b.key, pull: v3(p), walls: walls.map(f => ({ face: f.face, draft_deg: r3(f.angle) })), under_min: walls.filter(f => f.angle < min).map(f => f.face),
    ...(b.mesh.faces.some(f => f.kind === 'curved') ? { note: 'curved faces are not judged here (their draft varies across them)' } : {}) };
}
