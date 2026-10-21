// Reference bodies, datums and keep-outs (A6.3, O26). A STEP or mesh file the part must fit — a board, a housing, a
// motor — kept in the document as a **locked reference**: evaluated on its own (never a node of the part's tree, so no
// feature can take it as a parent, and it is in no mass, export, print check or drawing), placed, and shown ghosted.
// **Datums** are named planes, axes and points taken from a reference's faces (fitted to the face's own vertices, the
// fit's residual kept: a B-rep plane or cylinder is exact to rounding) or given; they move with their reference.
// **Keep-outs** are regions the part must not enter — a box or a cylinder on a frame, or a reference's envelope grown
// by an offset — each with the clearance it asks for. Their check: the overlap's volume by the kernel's intersection
// (exact), else the distance between the meshes (exact on the triangles), which is the true distance within the two
// meshes' chord tolerance (a curved face's sag, r(1 − cos(π/32)) at the studio's 8 segments a quarter); a verdict
// within that tolerance of the limit is **undecided**, never a pass.
import type { StudioDoc, DocPlane, ModelNode } from '../engine/doc';
import { emptyDoc, withNode } from '../engine/doc';
import { partBreps, placeBody, type BodyResult, type EvalResult } from '../engine/evaluate';
import { measureChords, unmeasured, type DisplayMesh, type Vec3 } from '../engine/mesh';
import { rotationMatrix } from '../assembly/mates';
import { symmetricEigen, type Mat3 } from '../robot/inertia';
import { meshDistance } from '../robot/sweep';
import { refOf } from '../app/bodyRef';
import { bodyKeyFor } from '../engine/ids';
import { stepLengthUnit } from '../engine/stepUnits';

type Evaluate = (doc: StudioDoc) => Promise<EvalResult | null>;
export interface Placement { position: Vec3; rotation: Vec3 }
export type ReferenceSource = { step: string } | { mesh: { positions: number[]; indices: number[] } };
export interface Reference { id: string; name: string; source: ReferenceSource; at: Placement; /** Solids in a STEP file that holds several. */ solids?: number }
/** A datum in its reference's own coordinates (or the part's, given explicitly): moved with the reference. */
export interface Datum {
  id: string; name: string; kind: 'plane' | 'axis' | 'point';
  /** The face (or vertex) it was taken from; absent: given. */
  of?: { reference: string; face?: string; vertex?: Vec3 };
  origin: Vec3; normal?: Vec3; xAxis?: Vec3; direction?: Vec3; radius?: number;
  /** The largest distance of the face's vertices from the fitted plane or cylinder (mm). */
  residualMM?: number;
}
export type KeepoutShape = { kind: 'box'; size: Vec3 } | { kind: 'cylinder'; radius: number; height: number };
export interface Keepout {
  id: string; name: string;
  /** Its frame (the part's coordinates): a box from the origin along xAxis, normal × xAxis and normal; a cylinder about the normal. */
  frame: DocPlane; shape: KeepoutShape;
  /** Made from a reference's envelope grown by an offset (kept to say so). */
  around?: { reference: string; offset: number };
  /** The clearance the part must keep from it (mm, 0: not enter). */
  clearance: number;
}
export interface ReferenceSet { version: 1; references: Reference[]; datums: Datum[]; keepouts: Keepout[] }
export type ReferenceCode = 'REFERENCE_LOCKED' | 'BAD_REFERENCE' | 'NO_REFERENCE' | 'DATUM_FIT' | 'BAD_KEEPOUT' | 'NOT_READ';
export class ReferenceError extends Error { constructor(public code: ReferenceCode, message: string) { super(`[${code}] ${message}`); this.name = 'ReferenceError'; } }

export const readReferences = (raw: unknown): ReferenceSet => {
  const r = raw as ReferenceSet | undefined;
  return r && r.version === 1 && Array.isArray(r.references) ? { version: 1, references: r.references, datums: Array.isArray(r.datums) ? r.datums : [], keepouts: Array.isArray(r.keepouts) ? r.keepouts : [] } : { version: 1, references: [], datums: [], keepouts: [] };
};
/** A reference's id prefix: its faces are named `<id>.face<k>` (STEP) or `<id>.region<k>` (a mesh). */
export const REFERENCE_PREFIX = /^ref\d+[._]/;
/** Whether a name is a reference's face, edge or body: no feature may use it (REFERENCE_LOCKED). */
export const isReferenceName = (name: unknown) => typeof name === 'string' && (REFERENCE_PREFIX.test(name) || /^ref\d+$/.test(name));
const nextId = (prefix: string, taken: readonly { id: string }[]) => { let k = 1; while (taken.some(x => x.id === `${prefix}${k}`)) k++; return `${prefix}${k}`; };

// ——— evaluation
/** The reference as a document of its own: one import (scaled to mm when the file says another unit) or one mesh node. */
export function referenceDoc(ref: Reference): StudioDoc {
  if ('step' in ref.source) {
    let d: StudioDoc = { ...emptyDoc(), nodes: [{ id: ref.id, kind: 'import', name: ref.name, step: ref.source.step, ...(ref.solids && ref.solids > 1 ? { solids: ref.solids } : {}) } as ModelNode] };
    const unit = stepLengthUnit(ref.source.step), n = ref.solids ?? 1;
    if (unit.toMM !== 1) for (let k = 0; k < n; k++) d = withNode(d, { kind: 'scale', parent: { node: 0, side: n > 1 ? `part${k}` as const : 'solid' }, factor: unit.toMM, pivot: [0, 0, 0] });
    return d;
  }
  return { ...emptyDoc(), nodes: [{ id: ref.id, kind: 'mesh', name: ref.name, unit: 'mm', positions: ref.source.mesh.positions, indices: ref.source.mesh.indices, representation: 'facets' } as ModelNode] };
}
const matrixOf = (at: Placement) => rotationMatrix(at.rotation) as unknown as number[];
/** A reference's bodies in its own coordinates (unplaced), keyed by its id. */
export async function referenceLocal(ref: Reference, evaluate: Evaluate): Promise<BodyResult[]> {
  const r = await evaluate(referenceDoc(ref));
  if (!r?.ok) throw new ReferenceError('NOT_READ', `${ref.name} could not be read: ${r ? r.error.detail : 'no result'}`);
  return r.bodies.map((b, j) => ({ ...b, key: r.bodies.length > 1 ? `${ref.id}_part${j}` : ref.id }));
}
/** A reference's bodies where it is placed (copies). */
export function placeReference(local: readonly BodyResult[], at: Placement): BodyResult[] {
  return local.map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, matrixOf(at), at.position));
}
const turn = (m: readonly number[], v: readonly number[]): Vec3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const add = (a: readonly number[], b: readonly number[]): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** A datum where its reference is placed (the part's coordinates). */
export function datumWorld(set: ReferenceSet, d: Datum): Datum {
  const ref = d.of ? set.references.find(r => r.id === d.of!.reference) : undefined;
  if (!ref) return d;
  const m = matrixOf(ref.at);
  return { ...d, origin: add(turn(m, d.origin), ref.at.position), ...(d.normal ? { normal: turn(m, d.normal) } : {}), ...(d.xAxis ? { xAxis: turn(m, d.xAxis) } : {}), ...(d.direction ? { direction: turn(m, d.direction) } : {}) };
}

// ——— datums fitted to a face's vertices
const sub = (a: readonly number[], b: readonly number[]): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: readonly number[], b: readonly number[]): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: readonly number[]): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
/** The face's vertices and normals (from the display mesh). */
function faceSamples(mesh: DisplayMesh, face: number): { p: Vec3[]; n: Vec3[] } {
  const p: Vec3[] = [], n: Vec3[] = [];
  for (let v = 0; v < mesh.faceOfVertex.length; v++) if (mesh.faceOfVertex[v] === face) { p.push([mesh.positions[3 * v], mesh.positions[3 * v + 1], mesh.positions[3 * v + 2]]); n.push([mesh.normals[3 * v], mesh.normals[3 * v + 1], mesh.normals[3 * v + 2]]); }
  return { p, n };
}
/** The eigenvector of the smallest eigenvalue of Σ (x − c)(x − c)ᵀ (a plane's normal, or the axis of a cylinder's normals). */
function leastAxis(xs: readonly Vec3[], c: Vec3): Vec3 {
  const M = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const x of xs) { const d = sub(x, c); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[3 * i + j] += d[i] * d[j]; }
  const { values, vectors } = symmetricEigen(M as Mat3);
  let k = 0; for (let i = 1; i < 3; i++) if (values[i] < values[k]) k = i;
  return unit([vectors[k], vectors[3 + k], vectors[6 + k]]);
}
const mean = (xs: readonly Vec3[]): Vec3 => { const c: Vec3 = [0, 0, 0]; for (const x of xs) { c[0] += x[0]; c[1] += x[1]; c[2] += x[2]; } return [c[0] / xs.length, c[1] / xs.length, c[2] / xs.length]; };
/** A face's plane: its exact surface where the kernel knows it (residual 0), else the plane through its vertices; the
 * normal out of the face; the origin the face's centre on the plane. */
export function fitPlane(mesh: DisplayMesh, face: number): { origin: Vec3; normal: Vec3; residual: number; exact?: true } {
  const ex = mesh.faces[face].exact;
  if (ex?.kind === 'plane') { const n = unit(ex.n), c = mesh.faces[face].centroid, h = dot(sub(c, ex.o), n); return { origin: [c[0] - h * n[0], c[1] - h * n[1], c[2] - h * n[2]], normal: n, residual: 0, exact: true }; }
  const { p } = faceSamples(mesh, face), c = mean(p);
  let n = leastAxis(p, c); if (dot(n, mesh.faces[face].normal) < 0) n = [-n[0], -n[1], -n[2]];
  let residual = 0; for (const x of p) residual = Math.max(residual, Math.abs(dot(sub(x, c), n)));
  return { origin: mesh.faces[face].centroid.slice() as Vec3, normal: n, residual };
}
/** A face's cylinder: its exact surface where the kernel knows it, else the cylinder through its vertices: its axis (the direction the surface normals do not span), a point on it, the radius, the residual. */
export function fitCylinder(mesh: DisplayMesh, face: number): { origin: Vec3; direction: Vec3; radius: number; residual: number; exact?: true } {
  const ex = mesh.faces[face].exact;
  if (ex?.kind === 'cylinder') { const a = unit(ex.a), c = mesh.faces[face].centroid, h = dot(sub(c, ex.c), a); return { origin: [ex.c[0] + h * a[0], ex.c[1] + h * a[1], ex.c[2] + h * a[2]], direction: a, radius: ex.r, residual: 0, exact: true }; }
  if (ex?.kind === 'plane') return { origin: [0, 0, 0], direction: [0, 0, 1], radius: 0, residual: Infinity };
  const { p, n } = faceSamples(mesh, face);
  // (The normals of a cylinder all lie across its axis: the axis is the least direction of Σ n nᵀ.)
  const M = [0, 0, 0, 0, 0, 0, 0, 0, 0]; for (const v of n) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[3 * i + j] += v[i] * v[j];
  const { values, vectors } = symmetricEigen(M as Mat3); let k = 0; for (let i = 1; i < 3; i++) if (values[i] < values[k]) k = i;
  const a = unit([vectors[k], vectors[3 + k], vectors[6 + k]]), e1 = unit(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])), e2 = cross(a, e1);
  // (A circle through the points across the axis, by least squares on x² + y² + D x + E y + F = 0, then refined by Gauss–Newton.)
  const u = p.map(x => [dot(x, e1), dot(x, e2)] as [number, number]);
  let s11 = 0, s12 = 0, s13 = 0, s22 = 0, s23 = 0, s33 = 0, b1 = 0, b2 = 0, b3 = 0;
  for (const [x, y] of u) { const r = -(x * x + y * y); s11 += x * x; s12 += x * y; s13 += x; s22 += y * y; s23 += y; s33 += 1; b1 += x * r; b2 += y * r; b3 += r; }
  const det = s11 * (s22 * s33 - s23 * s23) - s12 * (s12 * s33 - s23 * s13) + s13 * (s12 * s23 - s22 * s13);
  const D = (b1 * (s22 * s33 - s23 * s23) - s12 * (b2 * s33 - s23 * b3) + s13 * (b2 * s23 - s22 * b3)) / det;
  const E = (s11 * (b2 * s33 - s23 * b3) - b1 * (s12 * s33 - s23 * s13) + s13 * (s12 * b3 - b2 * s13)) / det;
  const F = (s11 * (s22 * b3 - b2 * s23) - s12 * (s12 * b3 - b2 * s13) + b1 * (s12 * s23 - s22 * s13)) / det;
  let cx = -D / 2, cy = -E / 2, r = Math.sqrt(Math.max(0, cx * cx + cy * cy - F));
  for (let it = 0; it < 20; it++) {
    let j11 = 0, j12 = 0, j13 = 0, j22 = 0, j23 = 0, j33 = 0, g1 = 0, g2 = 0, g3 = 0;
    for (const [x, y] of u) { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1e-300, res = d - r, a1 = -dx / d, a2 = -dy / d, a3 = -1; j11 += a1 * a1; j12 += a1 * a2; j13 += a1 * a3; j22 += a2 * a2; j23 += a2 * a3; j33 += a3 * a3; g1 += a1 * res; g2 += a2 * res; g3 += a3 * res; }
    const dt = j11 * (j22 * j33 - j23 * j23) - j12 * (j12 * j33 - j23 * j13) + j13 * (j12 * j23 - j22 * j13); if (!(Math.abs(dt) > 0)) break;
    const x1 = (g1 * (j22 * j33 - j23 * j23) - j12 * (g2 * j33 - j23 * g3) + j13 * (g2 * j23 - j22 * g3)) / dt, x2 = (j11 * (g2 * j33 - j23 * g3) - g1 * (j12 * j33 - j23 * j13) + j13 * (j12 * g3 - g2 * j13)) / dt, x3 = (j11 * (j22 * g3 - g2 * j23) - j12 * (j12 * g3 - g2 * j13) + g1 * (j12 * j23 - j22 * j13)) / dt;
    cx -= x1; cy -= x2; r -= x3; if (Math.abs(x1) + Math.abs(x2) + Math.abs(x3) < 1e-15 * (1 + r)) break;
  }
  let residual = 0; for (const [x, y] of u) residual = Math.max(residual, Math.abs(Math.hypot(x - cx, y - cy) - r));
  // (The point on the axis nearest the face's centroid.)
  const c = mean(p), base: Vec3 = add(add([e1[0] * cx, e1[1] * cx, e1[2] * cx], [e2[0] * cy, e2[1] * cy, e2[2] * cy]), [a[0] * dot(c, a), a[1] * dot(c, a), a[2] * dot(c, a)]);
  return { origin: base, direction: a, radius: r, residual };
}
/** How close a fit must be to be taken (mm): a B-rep plane or cylinder is exact to rounding; a scan's faces may not be. */
export const FIT_TOLERANCE = 1e-3;
/** The x axis a datum plane's sketches run along (horizontal where it can be, as the studio's own face planes). */
function xAxisFor(n: Vec3): Vec3 { const h = Math.hypot(n[0], n[1]); return h < 1e-12 ? [1, 0, 0] : unit([-n[1] / h, n[0] / h, 0]); }
/** A datum from a reference face (its local coordinates), or refused (DATUM_FIT) when the face is not that shape. */
export function datumFromFace(local: readonly BodyResult[], refId: string, face: string, kind: 'plane' | 'axis' | 'point', id: string, name: string): Datum {
  for (const b of local) {
    const f = b.mesh.faces.find(x => x.name === face || x.name.split('+').includes(face));
    if (!f) continue;
    if (kind === 'plane') {
      const fit = fitPlane(b.mesh, f.index);
      if (fit.residual > FIT_TOLERANCE) throw new ReferenceError('DATUM_FIT', `${face} is not flat: its vertices are up to ${fit.residual.toPrecision(3)} mm off the best plane (at most ${FIT_TOLERANCE} mm)`);
      return { id, name, kind, of: { reference: refId, face }, origin: fit.origin, normal: fit.normal, xAxis: xAxisFor(fit.normal), residualMM: fit.residual };
    }
    if (kind === 'axis') {
      if (f.kind !== 'curved') throw new ReferenceError('DATUM_FIT', `${face} is flat: an axis comes from a cylindrical face`);
      const fit = fitCylinder(b.mesh, f.index);
      if (!(fit.residual <= FIT_TOLERANCE)) throw new ReferenceError('DATUM_FIT', `${face} is not a cylinder: its vertices are up to ${fit.residual.toPrecision(3)} mm off the best one (at most ${FIT_TOLERANCE} mm)`);
      return { id, name, kind, of: { reference: refId, face }, origin: fit.origin, direction: fit.direction, radius: fit.radius, residualMM: fit.residual };
    }
    return { id, name, kind, of: { reference: refId, face }, origin: f.centroid.slice() as Vec3 };
  }
  throw new ReferenceError('NO_REFERENCE', `${refId} has no face ${face}; its faces: ${local.flatMap(b => b.mesh.faces.map(x => x.name)).slice(0, 40).join(', ')}`);
}
/** A point datum at a reference's vertex nearest a given point (its local coordinates), within 1 mm. */
export function datumAtVertex(local: readonly BodyResult[], refId: string, near: Vec3, id: string, name: string): Datum {
  let best: Vec3 | null = null, d = Infinity;
  for (const b of local) for (const e of b.mesh.edges) for (const v of [e.a, e.b]) { const k = Math.hypot(v[0] - near[0], v[1] - near[1], v[2] - near[2]); if (k < d) { d = k; best = v.slice() as Vec3; } }
  if (!best || d > 1) throw new ReferenceError('NO_REFERENCE', `no vertex of ${refId} within 1 mm of [${near.join(', ')}] (nearest ${d.toPrecision(3)} mm)`);
  return { id, name, kind: 'point', of: { reference: refId, vertex: best }, origin: best };
}

// ——— keep-outs
/** The keep-out's solid as nodes on a document: a sketch on its frame and its extrusion. */
export function keepoutNodes(k: Keepout): ModelNode[] {
  const plane = k.frame;
  const sketch: ModelNode = k.shape.kind === 'box' ? { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [k.shape.size[0], k.shape.size[1]], plane } as ModelNode : { kind: 'sketch', profile: 'circle', center: [0, 0], radius: k.shape.radius, plane } as ModelNode;
  return [sketch, { kind: 'extrude', sketch: -1, height: k.shape.kind === 'box' ? k.shape.size[2] : k.shape.height } as unknown as ModelNode];
}
/** A document with the keep-out's solid at its end, and the solid's node index. */
export function withKeepout(doc: StudioDoc, k: Keepout): { doc: StudioDoc; node: number } {
  const [s, e] = keepoutNodes(k);
  let d = withNode(doc, s as never); const si = d.nodes.length - 1;
  d = withNode(d, { ...(e as object), sketch: si } as never);
  return { doc: d, node: d.nodes.length - 1 };
}
/** A reference's envelope (its local bounds, placed) grown by an offset: a box on the reference's frame, or a cylinder about its local Z. */
export function envelopeOf(ref: Reference, local: readonly BodyResult[], offset: number, shape: 'box' | 'cylinder'): { frame: DocPlane; shape: KeepoutShape } {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of local) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.mesh.bounds.min[k]); max[k] = Math.max(max[k], b.mesh.bounds.max[k]); }
  const m = matrixOf(ref.at), x = turn(m, [1, 0, 0]), z = turn(m, [0, 0, 1]);
  if (shape === 'box') {
    const corner = add(turn(m, [min[0] - offset, min[1] - offset, min[2] - offset]), ref.at.position);
    return { frame: { origin: corner, normal: z, xAxis: x }, shape: { kind: 'box', size: [max[0] - min[0] + 2 * offset, max[1] - min[1] + 2 * offset, max[2] - min[2] + 2 * offset] } };
  }
  const cx = (min[0] + max[0]) / 2, cy = (min[1] + max[1]) / 2;
  let r = 0; for (const b of local) for (let i = 0; i < b.mesh.positions.length; i += 3) r = Math.max(r, Math.hypot(b.mesh.positions[i] - cx, b.mesh.positions[i + 1] - cy));
  return { frame: { origin: add(turn(m, [cx, cy, min[2] - offset]), ref.at.position), normal: z, xAxis: x }, shape: { kind: 'cylinder', radius: r + offset, height: max[2] - min[2] + 2 * offset } };
}
/**
 * How far a body's display mesh can be from its surface (mm): the worst depth of any curved face's triangle, bounded from
 * the tessellation's own steps in both directions (O55). The mesh's vertex normals are the surface's. Each edge's sag is
 * |c·(nᵢ − nⱼ)| / (4(1 + cos(θ/2))), with θ the angle between its normals. That is exact for a circular arc, and for a
 * cylinder's diagonal, whose axial run adds nothing. A triangle's worst point is the maximum over it of the quadratic patch
 * through its edges' sags, 4(λ₁λ₂s₁₂ + λ₂λ₃s₂₃ + λ₃λ₁s₃₁). Only that two-way bound holds on a doubly curved face: a sphere's
 * triangle sits about twice an edge's sagitta below it at its middle, which A6.3's first bound (an edge's sag at the face's
 * radius) missed. A curved face without normals is unbounded. The model holds at constant curvature along circles (cylinder,
 * sphere, cone, torus); a freeform face also takes its sampled depth against the exact surface, a face of no known kind is
 * unbounded (O59).
 */
export function chordOf(mesh: DisplayMesh): number {
  const have = chords.get(mesh); if (have !== undefined) return have;
  let s = 0;
  // (O59: the model is exact only at constant curvature along circles. A freeform face — a NURBS or SubD patch, whose
  // curvature varies inside a triangle — also takes its depth measured against the exact surface (bodyMesh); a curved face
  // of no known kind is unbounded.)
  const curved = new Uint8Array(mesh.faces.length);
  for (const f of mesh.faces) {
    if (f.kind !== 'curved' || f.facet) continue;
    if (f.analytic) curved[f.index] = 1;
    else if (f.freeform && f.chordMM !== undefined) { curved[f.index] = 1; s = Math.max(s, f.chordMM); }
    else s = Infinity;
  }
  // (A freeform face not yet measured: unbounded, and not kept, so measureChords can still decide it.)
  if (unmeasured(mesh)) return Infinity;
  for (let t = 0; t < mesh.indices.length && s < Infinity; t += 3) {
    const a = mesh.indices[t], b = mesh.indices[t + 1], c = mesh.indices[t + 2];
    if (!curved[mesh.faceOfVertex[a]]) continue;
    s = Math.max(s, trianglePatchDepth(edgeSag(mesh, a, b), edgeSag(mesh, b, c), edgeSag(mesh, c, a)));
  }
  chords.set(mesh, s);
  return s;
}
const chords = new WeakMap<DisplayMesh, number>();
/** The sag of the surface over the edge a–b, from its chord and its ends' normals (exact for a circular arc). */
function edgeSag(m: DisplayMesh, a: number, b: number): number {
  const P = m.positions, N = m.normals, cx = P[b * 3] - P[a * 3], cy = P[b * 3 + 1] - P[a * 3 + 1], cz = P[b * 3 + 2] - P[a * 3 + 2];
  const ax = N[a * 3], ay = N[a * 3 + 1], az = N[a * 3 + 2], bx = N[b * 3], by = N[b * 3 + 1], bz = N[b * 3 + 2];
  const la = Math.hypot(ax, ay, az), lb = Math.hypot(bx, by, bz);
  if (!(la > 0 && lb > 0)) return Infinity;
  const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (la * lb))), half = Math.sqrt((1 + cos) / 2);
  const dot = cx * (ax / la - bx / lb) + cy * (ay / la - by / lb) + cz * (az / la - bz / lb);
  return Math.abs(dot) / (4 * (1 + half));
}
/** The maximum over a triangle of 4(λ₁λ₂p + λ₂λ₃q + λ₃λ₁r): at an edge's middle, or where its gradient vanishes inside. */
function trianglePatchDepth(p: number, q: number, r: number): number {
  if (!Number.isFinite(p + q + r)) return Infinity;
  let best = Math.max(p, q, r);
  // (With λ₃ = 1 − λ₁ − λ₂: f = λ₁λ₂p + λ₂(1 − λ₁ − λ₂)q + (1 − λ₁ − λ₂)λ₁r; ∂f/∂λ₁ = λ₂p − λ₂q + r(1 − 2λ₁ − λ₂) = 0,
  // ∂f/∂λ₂ = λ₁p + q(1 − λ₁ − 2λ₂) − λ₁r = 0: a 2 × 2 system.)
  const a11 = -2 * r, a12 = p - q - r, a21 = p - q - r, a22 = -2 * q, b1 = -r, b2 = -q, det = a11 * a22 - a12 * a21;
  if (Math.abs(det) > 1e-300) {
    const l1 = (b1 * a22 - a12 * b2) / det, l2 = (a11 * b2 - a21 * b1) / det, l3 = 1 - l1 - l2;
    if (l1 >= 0 && l2 >= 0 && l3 >= 0) best = Math.max(best, 4 * (l1 * l2 * p + l2 * l3 * q + l3 * l1 * r));
  }
  return best;
}
export type Verdict = 'clear' | 'violated' | 'undecided';
export interface KeepoutResult { keepout: string; body: string; verdict: Verdict; overlapMM3: number; clearanceMM: number | null; requiredMM: number; chordMM: number; why: string }
/** The verdict for one keep-out against one body: overlap (exact) violates; else the mesh distance d against the required c within the chord δ. */
export function verdictOf(overlap: number, d: number, required: number, chord: number): { verdict: Verdict; why: string } {
  if (overlap > 1e-6) return { verdict: 'violated', why: `it enters the keep-out: ${overlap.toPrecision(4)} mm³ overlap (exact, the kernel's intersection)` };
  const tol = chord === Infinity ? 'an unbounded chord tolerance (a curved face without normals, or of no known surface kind)' : `the meshes' chord tolerance ${chord.toPrecision(3)} mm`;
  if (d - chord >= required) return { verdict: 'clear', why: `${d.toPrecision(6)} mm from it, at least ${required} mm with ${tol}` };
  if (d + chord < required) return { verdict: 'violated', why: `${d.toPrecision(6)} mm from it, less than the ${required} mm it asks for, beyond ${tol}` };
  return { verdict: 'undecided', why: `${d.toPrecision(6)} mm from it, within ${tol} of the ${required} mm it asks for: not decided by the meshes` };
}
/** A body's freeform faces measured against its B-rep (O59, measureChords), when the part's B-rep for it is at hand. */
export function measureBody(doc: StudioDoc, b: { key: string; mesh: DisplayMesh }): void {
  if (!unmeasured(b.mesh)) return;
  const brep = partBreps(doc).find(x => x.key === b.key)?.brep; if (brep) measureChords(b.mesh, brep);
}
/** Each keep-out against each of the part's bodies (or the named ones). */
export async function checkKeepouts(doc: StudioDoc, bodies: readonly BodyResult[], evaluate: Evaluate, only?: { keepout?: string; body?: string }): Promise<KeepoutResult[]> {
  const set = readReferences(doc.references), out: KeepoutResult[] = [];
  for (const k of set.keepouts) {
    if (only?.keepout && k.id !== only.keepout) continue;
    const probe = withKeepout(doc, k), r = await evaluate(probe.doc);
    const kb = r?.ok ? r.bodies.find(b => b.key === bodyKeyFor(probe.doc.nodes, probe.node)) : undefined;
    if (!kb) throw new ReferenceError('BAD_KEEPOUT', `${k.id}'s solid could not be made`);
    const kIdx = Uint32Array.from(kb.mesh.indices);
    for (const b of bodies) {
      if (only?.body && b.key !== only.body) continue;
      const A = b.mesh.bounds, B = kb.mesh.bounds, apart = [0, 1, 2].some(i => A.max[i] < B.min[i] - 1e-6 || B.max[i] < A.min[i] - 1e-6);
      let overlap = 0;
      if (!apart) {
        const p2 = withNode(probe.doc, { kind: 'intersect', left: refOf(b), right: { node: probe.node, side: 'solid' } });
        const r2 = await evaluate(p2); overlap = r2?.ok ? r2.bodies.find(x => x.key === bodyKeyFor(p2.nodes, p2.nodes.length - 1))?.volumeMM3 ?? 0 : 0;
      }
      measureBody(doc, b);
      const d = overlap > 1e-6 ? 0 : meshDistance(b.mesh.positions, b.mesh.indices, kb.mesh.positions, kIdx), chord = chordOf(b.mesh) + chordOf(kb.mesh), v = verdictOf(overlap, d, k.clearance, chord);
      out.push({ keepout: k.id, body: b.key, verdict: v.verdict, overlapMM3: overlap, clearanceMM: overlap > 1e-6 ? null : d, requiredMM: k.clearance, chordMM: chord, why: v.why });
    }
  }
  return out;
}

/** Ids for new entries. */
export const newReferenceId = (set: ReferenceSet) => nextId('ref', set.references);
export const newDatumId = (set: ReferenceSet) => nextId('D', set.datums);
export const newKeepoutId = (set: ReferenceSet) => nextId('K', set.keepouts);

// ——— datums as subjects: a datum against a part face (measure, requirements)
/** A datum against a face of the part: the angle between them, and the distance (a plane's to a parallel flat face or
 * to a point; an axis's to a cylinder's axis — their concentricity — or to a point; a point's to a plane or a point). */
export function datumToFace(d: Datum, mesh: DisplayMesh, face: number): { distanceMM: number; angleDeg: number | null; what: string } {
  const f = mesh.faces[face], deg = (c: number) => Math.acos(Math.min(1, Math.abs(c))) * 180 / Math.PI;
  if (d.kind === 'plane') {
    if (f.kind === 'plane') { const fit = fitPlane(mesh, face), a = deg(dot(fit.normal, d.normal!)); return { distanceMM: Math.abs(dot(sub(fit.origin, d.origin), d.normal!)), angleDeg: a, what: a < 1e-6 ? 'the distance between the parallel planes' : 'the distance from the datum plane to the face\'s centre (not parallel)' }; }
    return { distanceMM: Math.abs(dot(sub(f.centroid, d.origin), d.normal!)), angleDeg: null, what: 'the distance from the datum plane to the face\'s centre' };
  }
  if (d.kind === 'axis') {
    if (f.kind === 'curved') {
      const c = fitCylinder(mesh, face), a = deg(dot(c.direction, d.direction!)), w = sub(c.origin, d.origin), along = dot(w, d.direction!);
      return { distanceMM: Math.hypot(w[0] - along * d.direction![0], w[1] - along * d.direction![1], w[2] - along * d.direction![2]), angleDeg: a, what: 'the offset between the axes (concentricity)' };
    }
    const w = sub(f.centroid, d.origin), along = dot(w, d.direction!);
    return { distanceMM: Math.hypot(w[0] - along * d.direction![0], w[1] - along * d.direction![1], w[2] - along * d.direction![2]), angleDeg: null, what: 'the distance from the axis to the face\'s centre' };
  }
  if (f.kind === 'plane') { const fit = fitPlane(mesh, face); return { distanceMM: Math.abs(dot(sub(d.origin, fit.origin), fit.normal)), angleDeg: null, what: 'the distance from the point to the face\'s plane' }; }
  return { distanceMM: Math.hypot(...sub(d.origin, f.centroid)), angleDeg: null, what: 'the distance from the point to the face\'s centre' };
}
/** A datum plane as a sketch plane (the part's coordinates). */
export function datumPlane(set: ReferenceSet, id: string): DocPlane {
  const d0 = set.datums.find(x => x.id === id);
  if (!d0) throw new ReferenceError('NO_REFERENCE', `no datum ${id}; datums: ${set.datums.map(x => x.id).join(', ') || 'none'}`);
  if (d0.kind !== 'plane') throw new ReferenceError('NO_REFERENCE', `${id} is a datum ${d0.kind}, not a plane`);
  const d = datumWorld(set, d0);
  return { origin: d.origin, normal: d.normal!, xAxis: d.xAxis ?? xAxisFor(d.normal!) };
}

// ——— the tools
export const REFERENCE_TOOL_NAMES = new Set(['get_references', 'add_reference', 'add_datum', 'add_keepout', 'delete_reference_item', 'check_keepouts']);
const V3S = { type: 'array', items: { type: 'number' } };
const FRAME = { type: 'object', properties: { origin: V3S, normal: V3S, xAxis: V3S } };
export const REFERENCE_TOOLS = [
  {
    name: 'get_references',
    description: 'The part\'s locked reference bodies (STEP or mesh files it must fit: boards, housings, motors), each with its placement and its faces (name, plane or curved, radius, area: what datums are taken from), the datums (in the part\'s coordinates, with the face they come from and the fit\'s residual) and the keep-outs (frame, shape, the clearance asked). A reference is never part of the part: no feature may use its faces or body (REFERENCE_LOCKED), and it is in no mass, export, print check or drawing. Changes nothing.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'add_reference',
    description: 'Adds a locked reference body: "step" (a STEP file\'s text) or "mesh" {positions, indices} (mm), named, placed at "at" {position: mm, rotation: degrees about X, Y, Z} (absent: as in the file). Moving it later is the user\'s (the References card). Usually the user adds references in the studio; get_references lists them.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, step: { type: 'string' }, mesh: { type: 'object', properties: { positions: { type: 'array', items: { type: 'number' } }, indices: { type: 'array', items: { type: 'number' } } } }, at: { type: 'object', properties: { position: V3S, rotation: V3S } } }, required: ['name'], additionalProperties: false },
  },
  {
    name: 'add_datum',
    description: 'Adds a named datum: from a reference face — {reference, face, kind: plane (a flat face) | axis (a cylindrical face) | point (the face\'s centre)} — or a vertex {reference, vertex: [x, y, z] near it, in the reference\'s coordinates}, fitted to the face\'s vertices (refused, DATUM_FIT, when the face is not that shape within 0.001 mm; the residual is kept), moving with the reference; or given {kind, origin, normal | direction} in the part\'s coordinates. A datum plane is a sketch plane: in add_features a sketch\'s "plane" may be {"datum": id}; measure takes a datum id as "a" against a face as "b"; the requirement query datum_distance {datum, face} too.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, reference: { type: 'string' }, face: { type: 'string' }, vertex: V3S, kind: { type: 'string', enum: ['plane', 'axis', 'point'] }, origin: V3S, normal: V3S, direction: V3S }, additionalProperties: false },
  },
  {
    name: 'add_keepout',
    description: 'Adds a keep-out the part must not enter, with the clearance it asks for ("clearance", mm, default 0): a box {frame: {origin, normal, xAxis}, size: [x, y, z]} (from the origin along xAxis, normal × xAxis and normal), a cylinder {frame, radius, height} (about the normal), or a reference\'s envelope {around: reference, offset (mm), shape: box | cylinder}. Checked by check_keepouts and by the requirement query keepout {keepout}.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, box: { type: 'object', properties: { frame: FRAME, size: V3S } }, cylinder: { type: 'object', properties: { frame: FRAME, radius: { type: 'number' }, height: { type: 'number' } } }, around: { type: 'string' }, offset: { type: 'number' }, shape: { type: 'string', enum: ['box', 'cylinder'] }, clearance: { type: 'number' } }, additionalProperties: false },
  },
  {
    name: 'delete_reference_item',
    description: 'Deletes a datum (D<k>) or a keep-out (K<k>) by id. A reference itself is the user\'s to remove, in the studio.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
  },
  {
    name: 'check_keepouts',
    description: 'Checks every keep-out (or "keepout") against every body of the part (or "body"): violated when it enters (the overlap\'s volume, exact, by the kernel\'s intersection) or keeps less than its clearance; clear when the distance between the meshes (exact on their triangles) less their chord tolerance (a curved face\'s sag at the studio\'s tessellation, stated) is at least the clearance; undecided when the distance is within that tolerance of it — never a pass. Changes nothing.',
    input_schema: { type: 'object', properties: { keepout: { type: 'string' }, body: { type: 'string' } }, additionalProperties: false },
  },
];
const isV3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && Number.isFinite(x));
const isUnit = (v: unknown): v is Vec3 => isV3(v) && Math.abs(Math.hypot(...v) - 1) < 1e-6;
const r9 = (v: number) => Number(v.toPrecision(12)) + 0;
const v9 = (v: readonly number[]) => v.map(r9);
function checkFrame(f: unknown): DocPlane | string {
  const p = f as DocPlane;
  if (!p || !isV3(p.origin) || !isUnit(p.normal) || !isUnit(p.xAxis) || Math.abs(dot(p.normal, p.xAxis)) > 1e-6) return 'a frame is {origin, normal, xAxis}: two unit vectors at right angles';
  return { origin: p.origin, normal: p.normal, xAxis: p.xAxis };
}
/** The references as get_references reports them. */
export async function referencesReport(doc: StudioDoc, evaluate: Evaluate) {
  const set = readReferences(doc.references), refs = [];
  for (const r of set.references) {
    let faces: unknown[] = [], problem: string | undefined;
    try { const local = await referenceLocal(r, evaluate); faces = local.flatMap(b => b.mesh.faces.slice(0, 80).map(f => ({ name: f.name, kind: f.kind, ...(f.radius ? { radius: r9(f.radius) } : {}), area_mm2: r9(f.areaMM2) }))); } catch (e) { problem = e instanceof Error ? e.message : String(e); }
    refs.push({ id: r.id, name: r.name, kind: 'step' in r.source ? 'step' : 'mesh', at: r.at, faces, ...(problem ? { problem } : {}) });
  }
  const problems = await verifyDatums(set, evaluate);
  return {
    references: refs, ...(problems.length ? { problems } : {}),
    datums: set.datums.map(d => { const w = datumWorld(set, d); return { id: d.id, name: d.name, kind: d.kind, ...(d.of ? { of: d.of } : {}), origin: v9(w.origin), ...(w.normal ? { normal: v9(w.normal) } : {}), ...(w.direction ? { direction: v9(w.direction) } : {}), ...(d.radius ? { radius: r9(d.radius) } : {}), ...(d.residualMM !== undefined ? { residual_mm: r9(d.residualMM) } : {}) }; }),
    keepouts: set.keepouts.map(k => ({ id: k.id, name: k.name, frame: k.frame, shape: k.shape, clearance_mm: k.clearance, ...(k.around ? { around: k.around } : {}) })),
  };
}
/** Runs a reference tool. */
export async function runReferenceTool(doc: StudioDoc, bodies: readonly BodyResult[], name: string, args: Record<string, unknown>, evaluate: Evaluate): Promise<{ doc: StudioDoc; content: unknown; changed: boolean; summary: string } | { error: string }> {
  const set = readReferences(doc.references), put = (next: ReferenceSet) => ({ ...doc, references: next });
  try {
    if (name === 'get_references') { const r = await referencesReport(doc, evaluate); return { doc, content: r, changed: false, summary: `${r.references.length} references, ${r.datums.length} datums, ${r.keepouts.length} keep-outs` }; }
    if (name === 'check_keepouts') {
      if (!set.keepouts.length) return { error: 'There are no keep-outs: add_keepout first.' };
      const res = await checkKeepouts(doc, bodies, evaluate, { ...(typeof args.keepout === 'string' ? { keepout: args.keepout } : {}), ...(typeof args.body === 'string' ? { body: args.body } : {}) });
      const n = (v: number | null) => (v === null || !Number.isFinite(v) ? null : r9(v));
      const counts = { clear: res.filter(r => r.verdict === 'clear').length, violated: res.filter(r => r.verdict === 'violated').length, undecided: res.filter(r => r.verdict === 'undecided').length };
      return { doc, content: { results: res.map(r => ({ keepout: r.keepout, body: r.body, verdict: r.verdict, overlap_mm3: n(r.overlapMM3), clearance_mm: n(r.clearanceMM), required_mm: r.requiredMM, chord_tolerance_mm: n(r.chordMM), why: r.why })), ...counts }, changed: false, summary: `${counts.clear} clear, ${counts.violated} violated, ${counts.undecided} undecided` };
    }
    if (name === 'add_reference') {
      if (typeof args.name !== 'string' || !args.name.trim()) return { error: '[BAD_REFERENCE] a reference has a name.' };
      const hasStep = typeof args.step === 'string', mesh = args.mesh as { positions?: unknown; indices?: unknown } | undefined;
      if (hasStep === !!mesh) return { error: '[BAD_REFERENCE] give "step" (the file\'s text) or "mesh" {positions, indices}, one of them.' };
      if (mesh && (!Array.isArray(mesh.positions) || !Array.isArray(mesh.indices) || mesh.positions.length % 3 || mesh.indices.length % 3 || !mesh.indices.length || mesh.positions.some(x => typeof x !== 'number' || !Number.isFinite(x)) || mesh.indices.some(i => !Number.isInteger(i) || i < 0 || i >= (mesh.positions as number[]).length / 3))) return { error: '[BAD_REFERENCE] a mesh is {positions: x, y, z a vertex (mm), indices: three a triangle}.' };
      const at = (args.at ?? { position: [0, 0, 0], rotation: [0, 0, 0] }) as Placement;
      if (!isV3(at.position) || !isV3(at.rotation)) return { error: '[BAD_REFERENCE] "at" is {position: [x, y, z] mm, rotation: [x, y, z] degrees}.' };
      const ref: Reference = { id: newReferenceId(set), name: args.name.trim(), source: hasStep ? { step: args.step as string } : { mesh: { positions: mesh!.positions as number[], indices: mesh!.indices as number[] } }, at };
      let local = await referenceLocal(ref, evaluate);
      // (A STEP file of several solids: read solid by solid, as the studio opens one.)
      if ('step' in ref.source) { const n = (await referenceLocal({ ...ref, solids: 2 }, evaluate)).length; if (n > 1) { ref.solids = n; local = await referenceLocal(ref, evaluate); } }
      return { doc: put({ ...set, references: [...set.references, ref] }), content: { ok: true, id: ref.id, bodies: local.length, faces: local.reduce((s, b) => s + b.mesh.faces.length, 0) }, changed: true, summary: `reference ${ref.id} (${ref.name})` };
    }
    if (name === 'add_datum') {
      const id = newDatumId(set), label = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : id;
      let d: Datum;
      if (typeof args.reference === 'string') {
        const ref = set.references.find(r => r.id === args.reference); if (!ref) return { error: `[NO_REFERENCE] no reference ${args.reference}; references: ${set.references.map(r => r.id).join(', ') || 'none'}.` };
        const local = await referenceLocal(ref, evaluate);
        if (isV3(args.vertex)) d = datumAtVertex(local, ref.id, args.vertex, id, label);
        else if (typeof args.face === 'string') { const kind = (args.kind ?? 'plane') as Datum['kind']; if (!['plane', 'axis', 'point'].includes(kind)) return { error: '[BAD_REFERENCE] kind is plane, axis or point.' }; d = datumFromFace(local, ref.id, args.face, kind, id, label); }
        else return { error: '[BAD_REFERENCE] a datum from a reference takes its "face" (and kind) or a "vertex".' };
      } else {
        const kind = args.kind as Datum['kind'];
        if (!isV3(args.origin)) return { error: '[BAD_REFERENCE] a given datum has its origin [x, y, z] (mm, the part\'s coordinates).' };
        if (kind === 'plane') { if (!isV3(args.normal) || !(Math.hypot(...args.normal) > 0)) return { error: '[BAD_REFERENCE] a datum plane has a normal.' }; const n = unit(args.normal); d = { id, name: label, kind, origin: args.origin, normal: n, xAxis: xAxisFor(n) }; }
        else if (kind === 'axis') { if (!isV3(args.direction) || !(Math.hypot(...args.direction) > 0)) return { error: '[BAD_REFERENCE] a datum axis has a direction.' }; d = { id, name: label, kind, origin: args.origin, direction: unit(args.direction) }; }
        else if (kind === 'point') d = { id, name: label, kind, origin: args.origin };
        else return { error: '[BAD_REFERENCE] kind is plane, axis or point.' };
      }
      const w = datumWorld({ ...set, datums: [...set.datums, d] }, d);
      return { doc: put({ ...set, datums: [...set.datums, d] }), content: { ok: true, id, kind: d.kind, origin: v9(w.origin), ...(w.normal ? { normal: v9(w.normal) } : {}), ...(w.direction ? { direction: v9(w.direction) } : {}), ...(d.radius ? { radius: r9(d.radius) } : {}), ...(d.residualMM !== undefined ? { residual_mm: r9(d.residualMM) } : {}) }, changed: true, summary: `datum ${id} (${d.kind})` };
    }
    if (name === 'add_keepout') {
      const id = newKeepoutId(set), label = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : id, clearance = args.clearance === undefined ? 0 : args.clearance;
      if (typeof clearance !== 'number' || !(clearance >= 0)) return { error: '[BAD_KEEPOUT] clearance is a distance of 0 mm or more.' };
      const given = ['box', 'cylinder', 'around'].filter(k => args[k] !== undefined);
      if (given.length !== 1) return { error: '[BAD_KEEPOUT] give one of box {frame, size}, cylinder {frame, radius, height} or around (a reference) with offset.' };
      let k: Keepout;
      if (args.around !== undefined) {
        const ref = set.references.find(r => r.id === args.around); if (!ref) return { error: `[NO_REFERENCE] no reference ${String(args.around)}.` };
        const offset = args.offset ?? 0, shape = (args.shape ?? 'box') as 'box' | 'cylinder';
        if (typeof offset !== 'number' || !(offset >= 0) || (shape !== 'box' && shape !== 'cylinder')) return { error: '[BAD_KEEPOUT] around takes an offset of 0 mm or more and a shape box or cylinder.' };
        k = { id, name: label, ...envelopeOf(ref, await referenceLocal(ref, evaluate), offset, shape), around: { reference: ref.id, offset }, clearance };
      } else if (args.box !== undefined) {
        const b = args.box as { frame?: unknown; size?: unknown }, f = checkFrame(b.frame);
        if (typeof f === 'string') return { error: `[BAD_KEEPOUT] ${f}.` };
        if (!isV3(b.size) || b.size.some(x => !(x > 0))) return { error: '[BAD_KEEPOUT] a box\'s size is [x, y, z], each above 0.' };
        k = { id, name: label, frame: f, shape: { kind: 'box', size: b.size }, clearance };
      } else {
        const c = args.cylinder as { frame?: unknown; radius?: unknown; height?: unknown }, f = checkFrame(c.frame);
        if (typeof f === 'string') return { error: `[BAD_KEEPOUT] ${f}.` };
        if (typeof c.radius !== 'number' || !(c.radius > 0) || typeof c.height !== 'number' || !(c.height > 0)) return { error: '[BAD_KEEPOUT] a cylinder has a radius and height above 0.' };
        k = { id, name: label, frame: f, shape: { kind: 'cylinder', radius: c.radius, height: c.height }, clearance };
      }
      return { doc: put({ ...set, keepouts: [...set.keepouts, k] }), content: { ok: true, id, frame: k.frame, shape: k.shape, clearance_mm: k.clearance }, changed: true, summary: `keep-out ${id}` };
    }
    // delete_reference_item
    const iid = args.id;
    if (typeof iid === 'string' && /^ref\d+$/.test(iid)) return { error: `[REFERENCE_LOCKED] ${iid} is a reference: the user removes it, in the studio.` };
    if (!set.datums.some(d => d.id === iid) && !set.keepouts.some(k => k.id === iid)) return { error: `No datum or keep-out ${String(iid)}; datums: ${set.datums.map(d => d.id).join(', ') || 'none'}; keep-outs: ${set.keepouts.map(k => k.id).join(', ') || 'none'}.` };
    return { doc: put({ ...set, datums: set.datums.filter(d => d.id !== iid), keepouts: set.keepouts.filter(k => k.id !== iid) }), content: { ok: true, deleted: iid }, changed: true, summary: `deleted ${String(iid)}` };
  } catch (e) {
    if (e instanceof ReferenceError) return { error: e.message };
    throw e;
  }
}
/** The first locked reference name in a tool's arguments (a part tool may not use one), or null. */
export function referenceNameIn(x: unknown, depth = 0): string | null {
  if (depth > 8) return null;
  if (typeof x === 'string') return isReferenceName(x) ? x : null;
  if (Array.isArray(x)) { for (const v of x) { const r = referenceNameIn(v, depth + 1); if (r) return r; } return null; }
  if (x && typeof x === 'object') { for (const v of Object.values(x)) { const r = referenceNameIn(v, depth + 1); if (r) return r; } }
  return null;
}

/** Each datum taken from a face fitted again from that face (opening a file, a kernel update): the ones that no longer match (1e-9 relative). */
export async function verifyDatums(set: ReferenceSet, evaluate: Evaluate): Promise<{ datum: string; problem: string }[]> {
  const out: { datum: string; problem: string }[] = [], locals = new Map<string, BodyResult[]>();
  for (const d of set.datums) {
    if (!d.of) continue;
    const ref = set.references.find(r => r.id === d.of!.reference);
    if (!ref) { out.push({ datum: d.id, problem: `its reference ${d.of.reference} is gone` }); continue; }
    try {
      if (!locals.has(ref.id)) locals.set(ref.id, await referenceLocal(ref, evaluate));
      const again = d.of.vertex ? datumAtVertex(locals.get(ref.id)!, ref.id, d.of.vertex, d.id, d.name) : datumFromFace(locals.get(ref.id)!, ref.id, d.of.face!, d.kind, d.id, d.name);
      const off = Math.max(...[0, 1, 2].map(k => Math.abs(again.origin[k] - d.origin[k])), ...(d.normal ? [0, 1, 2].map(k => Math.abs(again.normal![k] - d.normal![k])) : []), ...(d.direction ? [0, 1, 2].map(k => Math.abs(again.direction![k] - d.direction![k])) : []));
      const scale = 1 + Math.max(...d.origin.map(Math.abs));
      if (off > 1e-9 * scale) out.push({ datum: d.id, problem: `its face ${d.of.face ?? 'vertex'} now fits ${off.toPrecision(3)} away from where it was taken` });
    } catch (e) { out.push({ datum: d.id, problem: e instanceof Error ? e.message : String(e) }); }
  }
  return out;
}
