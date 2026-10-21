// IM2 (O78): the draft field — each face's draft against the pull from its exact normal, never the display mesh's (IM S0:
// a 3° cone's mesh normals are off by 0.014°). A plane's normal is its exact plane's; a cylinder's the radial from its
// exact axis; any other face's (a cone, a fillet, a torus …) from the B-rep's NURBS, each sample projected onto it
// (the kernel's `closestPointOnSurface`: Gauss–Newton on its first derivatives, from a parameter grid); a facet face's are its triangles'. The draft at a
// sample is asin(n·d): 0 a wall along the pull, ±90° a face across it. A face is drafted when every sample's |draft|
// reaches the minimum on one side, steep when some sample's does not, straddling when n·d takes both signs: the
// isocline n·d = 0 crosses it (a parting line runs there, IM5) — its points found on the exact surface.
import { closestPointOnSurface, surfaceSeedGrid, type Brep, type SurfaceSeedGrid } from '@barocss/cad';
import type { StudioDoc } from '../engine/doc';
import { partBreps, type BodyResult } from '../engine/evaluate';
import type { DisplayMesh, Vec3 } from '../engine/mesh';

export type DraftClass = 'drafted' | 'steep' | 'straddle';
export interface DraftFace {
  body: string; face: string; kind: 'plane' | 'cylinder' | 'surface' | 'facets';
  cls: DraftClass;
  /** The least and the greatest draft over the face's samples (degrees, signed by n·d). */
  minDeg: number; maxDeg: number;
  /** The least |draft| (degrees): the steepest sample. */
  steepestDeg: number;
  /** Which way it releases: + along the pull, − against it, ± both (straddling), 0 neither (a wall along the pull, n·d 0 throughout). */
  side: '+' | '-' | '±' | '0';
  /** Its area, and the area whose triangle centres' exact |draft| is under the minimum (the display mesh's triangles). */
  areaMM2: number; belowMM2: number;
  /** Straddling: points of its isocline n·d = 0, on the exact surface (one per mesh edge it crosses). */
  isocline?: Vec3[];
}
export interface DraftField { pull: Vec3; minDeg: number; faces: DraftFace[]; method: string }
const DEG = 180 / Math.PI, SIGN = 1e-12, GRID = 24;

type Surf = Parameters<typeof closestPointOnSurface>[0];
interface Piece { s: Surf; sense: 1 | -1; grid: SurfaceSeedGrid }
/** A NURBS face piece, with its parameter grid's points for a projection's start. */
function pieceOf(s: Surf, sense: 'forward' | 'reversed'): Piece { return { s, sense: sense === 'forward' ? 1 : -1, grid: surfaceSeedGrid(s, GRID) }; }
const query = new Float64Array(3);
/** A point's foot on a piece (the kernel's `closestPointOnSurface`, K4): its distance and the outward unit normal there (into `n`). */
function foot(P: Piece, x: number, y: number, z: number, n: Float64Array): number {
  query[0] = x; query[1] = y; query[2] = z;
  const f = closestPointOnSurface(P.s, query, { grid: P.grid });
  n[0] = f.normal[0] * P.sense; n[1] = f.normal[1] * P.sense; n[2] = f.normal[2] * P.sense;
  return f.distance;
}

/** How a display face's exact normal is had at a point. */
type Normal = { kind: 'plane'; n: Vec3 } | { kind: 'cylinder'; c: Vec3; a: Vec3; outward: 1 | -1 } | { kind: 'surface'; pieces: Piece[] } | { kind: 'facets' };
const scratch = new Float64Array(3), best = new Float64Array(3);
/** The exact outward normal at (x, y, z) of a face (into `out`); facets take the triangle's (`tri`). */
function normalAt(N: Normal, x: number, y: number, z: number, tri: readonly number[], out: Float64Array): void {
  if (N.kind === 'plane') { out[0] = N.n[0]; out[1] = N.n[1]; out[2] = N.n[2]; return; }
  if (N.kind === 'cylinder') {
    const px = x - N.c[0], py = y - N.c[1], pz = z - N.c[2], s = px * N.a[0] + py * N.a[1] + pz * N.a[2], rx = px - s * N.a[0], ry = py - s * N.a[1], rz = pz - s * N.a[2], l = Math.hypot(rx, ry, rz) * N.outward;
    out[0] = rx / l; out[1] = ry / l; out[2] = rz / l; return;
  }
  if (N.kind === 'facets') { out[0] = tri[0]; out[1] = tri[1]; out[2] = tri[2]; return; }
  let bd = Infinity;
  for (const P of N.pieces) { const d = foot(P, x, y, z, scratch); if (d < bd) { bd = d; best.set(scratch); } }
  out.set(best);
}
const baseName = (name: string) => name.replace(/#\d+$/, '');
/** Each display face's way to its exact normal: the display face's exact geometry, else its B-rep pieces (NURBS or facets). */
function normalsOf(body: BodyResult, brep: Brep | undefined): Map<number, Normal> {
  const m = body.mesh, out = new Map<number, Normal>();
  for (const f of m.faces) {
    const e = f.exact;
    if (e?.kind === 'plane') { out.set(f.index, { kind: 'plane', n: e.n }); continue; }
    if (e?.kind === 'cylinder') {
      // (Outward: the side the display normals point, at the face's first vertex.)
      const l = Math.hypot(e.a[0], e.a[1], e.a[2]), a: Vec3 = [e.a[0] / l, e.a[1] / l, e.a[2] / l], N: Normal = { kind: 'cylinder', c: e.c, a, outward: 1 };
      for (let i = 0; i < m.faceOfVertex.length; i++) if (m.faceOfVertex[i] === f.index) { normalAt(N, m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2], [], scratch); if (scratch[0] * m.normals[3 * i] + scratch[1] * m.normals[3 * i + 1] + scratch[2] * m.normals[3 * i + 2] < 0) N.outward = -1; break; }
      out.set(f.index, N); continue;
    }
    const pieces = brep?.faces.filter(x => baseName(x.name ?? x.id) === baseName(f.name)) ?? [];
    if (pieces.length && pieces.every(x => x.surface.kind === 'surface')) out.set(f.index, { kind: 'surface', pieces: pieces.map(x => pieceOf(x.surface as Surf, x.sense)) });
    else out.set(f.index, { kind: 'facets' });
  }
  return out;
}

const n0 = new Float64Array(3), n1 = new Float64Array(3), tn = [0, 0, 0];
/** n·d along a mesh edge's chord from a to b, its zero by bisection (each point's exact normal): the isocline's point. */
function isoclinePoint(N: Normal, a: readonly number[], b: readonly number[], d: Vec3, sa: number): Vec3 {
  let lo = 0, hi = 1;
  for (let it = 0; it < 60; it++) {
    const t = (lo + hi) / 2, x = a[0] + t * (b[0] - a[0]), y = a[1] + t * (b[1] - a[1]), z = a[2] + t * (b[2] - a[2]);
    normalAt(N, x, y, z, tn, n0);
    if (Math.sign(n0[0] * d[0] + n0[1] * d[1] + n0[2] * d[2]) === sa) lo = t; else hi = t;
  }
  const t = (lo + hi) / 2;
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}

/** The draft field of the part's bodies against a pull (a unit vector is taken) and a least draft (degrees). */
export function draftField(doc: StudioDoc, bodies: readonly BodyResult[], pull: readonly number[], minDeg: number): DraftField {
  const l = Math.hypot(pull[0], pull[1], pull[2]), d: Vec3 = [pull[0] / l, pull[1] / l, pull[2] / l], sinMin = Math.sin(minDeg / DEG);
  let breps: { key: string; brep: Brep }[] = [];
  try { breps = partBreps(doc); } catch { /* no B-rep: planes and cylinders still exact; the rest the triangles' */ }
  const faces: DraftFace[] = [];
  for (const body of bodies) faces.push(...bodyField(body, breps.find(x => x.key === body.key)?.brep, d, minDeg, sinMin));
  return { pull: d, minDeg, faces, method: 'exact normals: planes and cylinders from their exact geometry, other faces projected onto the B-rep\'s NURBS (Gauss–Newton), facet faces their triangles\'; samples the display mesh\'s vertices and triangle centres; the area under the minimum by triangle centres' };
}

function bodyField(body: BodyResult, brep: Brep | undefined, d: Vec3, minDeg: number, sinMin: number): DraftFace[] {
  const m: DisplayMesh = body.mesh, normals = normalsOf(body, brep), F = m.faces.length;
  const lo = new Float64Array(F).fill(Infinity), hi = new Float64Array(F).fill(-Infinity), steep = new Float64Array(F).fill(Infinity), area = new Float64Array(F), below = new Float64Array(F);
  const vdot = new Float64Array(m.faceOfVertex.length);
  // Vertices: each one's exact n·d.
  for (let i = 0; i < m.faceOfVertex.length; i++) {
    const f = m.faceOfVertex[i], N = normals.get(f)!;
    if (N.kind === 'facets') { vdot[i] = NaN; continue; }
    normalAt(N, m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2], tn, n1);
    const s = n1[0] * d[0] + n1[1] * d[1] + n1[2] * d[2]; vdot[i] = s;
    if (s < lo[f]) lo[f] = s; if (s > hi[f]) hi[f] = s; if (Math.abs(s) < steep[f]) steep[f] = Math.abs(s);
  }
  // Triangle centres: their exact n·d (a facet's the triangle's own), its area under the minimum.
  const I = m.indices, P = m.positions;
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2], f = m.faceOfVertex[I[t]], N = normals.get(f)!;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx, l2 = Math.hypot(cx, cy, cz); if (!(l2 > 0)) continue;
    tn[0] = cx / l2; tn[1] = cy / l2; tn[2] = cz / l2;
    normalAt(N, (P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3, tn, n1);
    const s = n1[0] * d[0] + n1[1] * d[1] + n1[2] * d[2];
    if (s < lo[f]) lo[f] = s; if (s > hi[f]) hi[f] = s; if (Math.abs(s) < steep[f]) steep[f] = Math.abs(s);
    area[f] += l2 / 2; if (Math.abs(s) < sinMin - 1e-12) below[f] += l2 / 2;
  }
  const out: DraftFace[] = [];
  for (const df of m.faces) {
    const f = df.index; if (!(area[f] > 0)) continue;
    const N = normals.get(f)!, pos = hi[f] > SIGN, neg = lo[f] < -SIGN, cls: DraftClass = pos && neg ? 'straddle' : steep[f] < sinMin - 1e-12 ? 'steep' : 'drafted';
    const face: DraftFace = { body: body.key, face: df.name.split('+')[0], kind: N.kind, cls, minDeg: Math.asin(Math.max(-1, Math.min(1, lo[f]))) * DEG, maxDeg: Math.asin(Math.max(-1, Math.min(1, hi[f]))) * DEG,
      steepestDeg: Math.asin(Math.min(1, steep[f])) * DEG, side: pos && neg ? '±' : pos ? '+' : neg ? '-' : '0', areaMM2: area[f], belowMM2: below[f] };
    if (cls === 'straddle' && N.kind !== 'facets') face.isocline = isoclineOf(m, f, N, vdot, d);
    out.push(face);
  }
  return out;
}
/** The isocline's points on a straddling face: one per mesh edge whose two vertices' n·d differ in sign. */
function isoclineOf(m: DisplayMesh, f: number, N: Normal, vdot: Float64Array, d: Vec3): Vec3[] {
  const seen = new Set<string>(), out: Vec3[] = [], I = m.indices, P = m.positions;
  for (let t = 0; t < I.length; t += 3) {
    if (m.faceOfVertex[I[t]] !== f) continue;
    for (let k = 0; k < 3; k++) {
      const i = I[t + k], j = I[t + (k + 1) % 3], si = vdot[i], sj = vdot[j];
      // (A vertex on the isocline itself — a circle's quadrant point — is one of its points.)
      if (Math.abs(si) <= SIGN && !seen.has(`v${i}`)) { seen.add(`v${i}`); out.push([P[3 * i], P[3 * i + 1], P[3 * i + 2]]); }
      if (!(Math.abs(si) > SIGN && Math.abs(sj) > SIGN && Math.sign(si) !== Math.sign(sj))) continue;
      const key = i < j ? `${i},${j}` : `${j},${i}`; if (seen.has(key)) continue; seen.add(key);
      out.push(isoclinePoint(N, [P[3 * i], P[3 * i + 1], P[3 * i + 2]], [P[3 * j], P[3 * j + 1], P[3 * j + 2]], d, Math.sign(si)));
    }
  }
  return out;
}

/** A body's exact outward normal at a point on one of its display faces (IM5): the same normals the draft field reads. */
export function exactNormals(doc: StudioDoc, body: BodyResult): (face: number, p: readonly number[]) => Vec3 {
  let brep: Brep | undefined;
  try { brep = partBreps(doc).find(x => x.key === body.key)?.brep; } catch { /* planes and cylinders still exact */ }
  const normals = normalsOf(body, brep), out = new Float64Array(3), tri = [0, 0, 1];
  return (face, p) => {
    const N = normals.get(face); if (!N) return [0, 0, 0];
    if (N.kind === 'facets') { const f = body.mesh.faces.find(x => x.index === face); return f ? [f.normal[0], f.normal[1], f.normal[2]] : [0, 0, 0]; }
    normalAt(N, p[0], p[1], p[2], tri, out);
    return [out[0], out[1], out[2]];
  };
}
