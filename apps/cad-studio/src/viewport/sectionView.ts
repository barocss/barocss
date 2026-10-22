// The section view while its planes move (G2, G19): on WebGPU the bodies and instances are shown whole and the viewer's
// clip planes cut and cap them on the GPU; on WebGL2 (no clip planes there) each mesh is clipped and capped on the CPU
// (clipMesh — for a plane not along an axis, in the plane's own frame), as before. The kernel's exact section (Splits,
// one a plane, each kept piece split by the next) replaces the bodies when it arrives, either way.
import { clipMesh } from '@barocss/cad-model/engine/clip';
import { withNode, type BodyRef, type ModelNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { bodyKeyFor } from '@barocss/cad-model/engine/ids';
import type { DisplayFace, DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import { refOf } from '@barocss/cad-model/app/bodyRef';
import { posedBody } from '@barocss/cad-model/robot/preview';
import { capHatchAxes } from '@barocss/gpu/viewer';
import { motionOf } from './instancePose';

type Axis = 'x' | 'y' | 'z';
/** One plane of a section (G19): what is kept is where dot(normal, p) ≥ offset (normal of unit length); along an axis, or from a face. */
export interface SectionPlane { normal: Vec3; offset: number; axis?: Axis; face?: string }
/**
 * The section (G19): one plane, a box (six axis planes, the inside kept), or two or three planes — the kept region their
 * intersection; or a cut-out (G20): two or three planes, kept on any one's kept side — the corner where their cut-away
 * sides meet removed (a quarter, an octant).
 */
export interface Section { mode: 'plane' | 'box' | 'planes' | 'cutout'; planes: SectionPlane[] }
/** The axis section as it was (G2): across `axis` at `at`, the `keep` side shown. */
export interface AxisSection { axis: Axis; at: number; keep: 'negative' | 'positive' }
type Placed = {
  id: string; bodies: BodyResult[];
  /** CPU display-section provenance; maps shown indices back to the original instance packet. */
  sourceBodies?: readonly number[];
  sourceFaces?: readonly (readonly number[])[];
  sourceEdges?: readonly (readonly number[])[];
};

/** An axis plane: across `axis` at `at`, kept on the `keep` side. */
export function axisPlane(axis: Axis, at: number, keep: 'negative' | 'positive'): SectionPlane {
  const k = 'xyz'.indexOf(axis), sg = keep === 'negative' ? -1 : 1, normal: Vec3 = [0, 0, 0];
  normal[k] = sg;
  return { normal, offset: sg * at, axis };
}
/** A section of one axis plane. */
export const axisSection = (s: AxisSection): Section => ({ mode: 'plane', planes: [axisPlane(s.axis, s.at, s.keep)] });
/** A section given either way (the hooks take the axis form too). */
export const asSection = (s: Section | AxisSection): Section => 'planes' in s ? s : axisSection(s);
/** An axis plane's axis (its index), the coordinate it is at and the side kept; null for any other plane. */
export function planeAxis(p: SectionPlane): { k: 0 | 1 | 2; at: number; keep: 'negative' | 'positive' } | null {
  const n = p.normal, k = Math.abs(n[0]) === 1 ? 0 : Math.abs(n[1]) === 1 ? 1 : Math.abs(n[2]) === 1 ? 2 : -1;
  if (k < 0 || n.some((v, i) => i !== k && v !== 0)) return null;
  const j = k as 0 | 1 | 2;
  return { k: j, at: n[j] > 0 ? p.offset : -p.offset, keep: n[j] > 0 ? 'positive' : 'negative' };
}
/** A box section: six axis planes inset `inset` of the box's size from its faces, the inside kept. */
export function boxSection(min: Vec3, max: Vec3, inset = 0.1): Section {
  const planes: SectionPlane[] = [];
  for (const k of [0, 1, 2] as const) {
    const d = (max[k] - min[k]) * inset, axis = 'xyz'[k] as Axis;
    planes.push(axisPlane(axis, min[k] + d, 'positive'), axisPlane(axis, max[k] - d, 'negative'));
  }
  return { mode: 'box', planes };
}
/**
 * A plane from a planar face (G19): the face's plane, the material behind it kept (the normal into it), moved in to the
 * middle of `box` along it — the face itself would cut nothing.
 */
export function planeFromFace(face: Pick<DisplayFace, 'normal' | 'centroid' | 'name'>, box: { min: Vec3; max: Vec3 }): SectionPlane {
  const l = Math.hypot(...face.normal) || 1, normal = face.normal.map(v => -v / l) as Vec3;
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => dot(normal, [i & 1 ? box.max[0] : box.min[0], i & 2 ? box.max[1] : box.min[1], i & 4 ? box.max[2] : box.min[2]]));
  const lo = Math.min(...corners), hi = Math.max(...corners), at = dot(normal, face.centroid), axis = planeAxis({ normal, offset: 0 });
  return { normal, offset: (Math.max(lo, at) + hi) / 2, face: face.name, ...(axis ? { axis: 'xyz'[axis.k] as Axis } : {}) };
}

/** The section's planes as the viewer takes them. */
export const sectionPlanes = (s: Section): { normal: Vec3; offset: number }[] => s.planes.map(p => ({ normal: p.normal, offset: p.offset }));
/** A plane's other side: kept where the plane cuts away. */
export const flipPlane = (p: SectionPlane): SectionPlane => ({ ...p, normal: p.normal.map(v => -v || 0) as Vec3, offset: -p.offset || 0 });
/**
 * The cut-out's default planes (G20): the corner of `box` facing the eye removed through the box's centre — along X and
 * Y (a quarter), and Z too (`n` 3, an octant).
 */
export function cutoutCorner(box: { min: readonly number[]; max: readonly number[] }, eye: readonly number[] | null, n: 2 | 3 = 2): SectionPlane[] {
  return (['x', 'y', 'z'] as const).slice(0, n).map((axis, k) => {
    const c = Math.round(box.min[k] + box.max[k]) / 2;
    return axisPlane(axis, c, eye && eye[k] < c ? 'positive' : 'negative');
  });
}
/** The first plane as G2's one (normal, offset), for what reads one plane. */
export function sectionPlane(s: Section): { normal: Vec3; offset: number } { return { normal: s.planes[0].normal, offset: s.planes[0].offset }; }

/**
 * Whether a mesh lies wholly on a cut-away side of a plane: when clipMesh gives null (by its box, with clipMesh's
 * tolerance). A cut-out's (G20): on every plane's cut-away side — in the removed corner.
 */
export function cutAway(m: Pick<DisplayMesh, 'bounds'>, s: Section): boolean {
  const b = m.bounds, size = Math.max(1, ...b.max.map(Math.abs), ...b.min.map(Math.abs)), eps = 1e-9 * size;
  return s.planes[s.mode === 'cutout' ? 'every' : 'some'](p => {
    const a = planeAxis(p);
    if (a) return a.keep === 'negative' ? a.at - b.min[a.k] <= eps : b.max[a.k] - a.at <= eps;
    let hi = -Infinity;
    for (let i = 0; i < 8; i++) hi = Math.max(hi, dot(p.normal, [i & 1 ? b.max[0] : b.min[0], i & 2 ? b.max[1] : b.min[1], i & 4 ? b.max[2] : b.min[2]]) - p.offset);
    return hi <= eps;
  });
}

/**
 * A mesh clipped by one plane and capped (clipMesh): along an axis, clipMesh itself; else in the plane's own frame — the
 * mesh turned so that the normal is +z, clipped there, and turned back (its cap face, normal and centre, with it).
 */
export function clipMeshPlane(m: DisplayMesh, p: SectionPlane, capName: string): DisplayMesh | null {
  const a = planeAxis(p);
  if (a) return clipMesh(m, a.k, a.at, a.keep, capName);
  const Z = p.normal, X = unit(cross(Z, Math.abs(Z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), Y = cross(Z, X);
  const into = (v: readonly number[]): Vec3 => [dot(X, v), dot(Y, v), dot(Z, v)];
  const back = (v: readonly number[]): Vec3 => [X[0] * v[0] + Y[0] * v[1] + Z[0] * v[2], X[1] * v[0] + Y[1] * v[1] + Z[1] * v[2], X[2] * v[0] + Y[2] * v[1] + Z[2] * v[2]];
  const turned = turnMesh(m, into);
  const cut = clipMesh(turned, 2, p.offset, 'positive', capName);
  if (cut === turned) return m;
  if (!cut) return null;
  const out = turnMesh(cut, back);
  const cap = cut.faces[cut.faces.length - 1];
  return { ...out, faces: [...m.faces, { ...cap, normal: back(cap.normal), centroid: back(cap.centroid) }], edges: m.edges };
}
/** A mesh clipped by each plane in turn (the later ones cutting the earlier caps): the kept region's part, or null. */
export function clipMeshPlanes(m: DisplayMesh, planes: readonly SectionPlane[], capName: string): DisplayMesh | null {
  let out: DisplayMesh | null = m;
  for (const p of planes) { if (!out) return null; out = clipMeshPlane(out, p, capName); }
  return out;
}
/**
 * A mesh less a cut-out's corner (G20), as one mesh: its pieces kept by plane i and cut away by every plane before it —
 * disjoint, together what any plane keeps — each clipped and capped, merged. The caps between two pieces lie inside the
 * solid (hidden; none faces the side cut away, so none is hatched); the notch's faces are the pieces' caps there.
 */
export function clipMeshCutout(m: DisplayMesh, planes: readonly SectionPlane[], capName: string): DisplayMesh | null {
  const pieces: DisplayMesh[] = [];
  for (let i = 0; i < planes.length; i++) {
    const piece = clipMeshPlanes(m, [...planes.slice(0, i).map(flipPlane), planes[i]], capName);
    if (piece === m) return m;
    if (piece) pieces.push(piece);
  }
  return pieces.length ? pieces.reduce(mergeMeshes) : null;
}
/** The planes' part of a mesh: G19's intersection, or a cut-out's (G20). */
export const clipMeshSection = (m: DisplayMesh, s: Section, capName: string): DisplayMesh | null => s.mode === 'cutout' ? clipMeshCutout(m, s.planes, capName) : clipMeshPlanes(m, s.planes, capName);
/** Two display meshes as one: points, faces and edges of the second after the first's, renumbered. */
export function mergeMeshes(a: DisplayMesh, b: DisplayMesh): DisplayMesh {
  const nv = a.positions.length / 3, nf = a.faces.length, ne = a.edges.length;
  const cat = (x: Float32Array, y: Float32Array) => { const o = new Float32Array(x.length + y.length); o.set(x); o.set(y, x.length); return o; };
  const fov = cat(a.faceOfVertex, b.faceOfVertex), eos = cat(a.edgeOfSegment, b.edgeOfSegment), idx = new Uint32Array(a.indices.length + b.indices.length);
  for (let i = a.faceOfVertex.length; i < fov.length; i++) fov[i] += nf;
  for (let i = a.edgeOfSegment.length; i < eos.length; i++) eos[i] += ne;
  idx.set(a.indices); for (let i = 0; i < b.indices.length; i++) idx[a.indices.length + i] = b.indices[i] + nv;
  return {
    positions: cat(a.positions, b.positions), normals: cat(a.normals, b.normals), faceOfVertex: fov, indices: idx,
    faces: [...a.faces, ...b.faces.map(f => ({ ...f, index: f.index + nf }))], edgeLines: cat(a.edgeLines, b.edgeLines), edgeOfSegment: eos,
    edges: [...a.edges, ...b.edges.map(e => ({ ...e, index: e.index + ne, faces: [e.faces[0] + nf, e.faces[1] + nf] as [number, number] }))],
    bounds: { min: [0, 1, 2].map(k => Math.min(a.bounds.min[k], b.bounds.min[k])) as Vec3, max: [0, 1, 2].map(k => Math.max(a.bounds.max[k], b.bounds.max[k])) as Vec3 },
    ...(a.quality !== undefined ? { quality: a.quality } : {}),
  };
}
/**
 * A body's pieces as one body (G20: a cut-out's exact section splits a body in two or three; everything that reports per
 * body — the solids count, mass and properties, picks — reports the body): their meshes merged, volume and mass summed,
 * the centre of mass by volume; the first piece's key and the rest of what it says.
 */
export function mergeBodies(pieces: readonly BodyResult[]): BodyResult {
  if (pieces.length === 1) return pieces[0];
  const sum = (f: (b: BodyResult) => number | null) => pieces.every(b => f(b) !== null) ? pieces.reduce((v, b) => v + f(b)!, 0) : null;
  const volume = sum(b => b.volumeMM3), mass = sum(b => b.massG);
  const centroid = volume && pieces.every(b => b.centroid && b.volumeMM3 !== null) ? [0, 1, 2].map(k => pieces.reduce((v, b) => v + b.centroid![k] * b.volumeMM3!, 0) / volume) as [number, number, number] : undefined;
  // (The area and inertia of the whole are not the pieces' sum — the faces between them are inside — so left out.)
  const { areaMM2: _a, areaBasis: _b, inertia: _i, pieces: _p, ...first } = pieces[0];
  void _a; void _b; void _i; void _p;
  return { ...first, mesh: pieces.map(b => b.mesh).reduce(mergeMeshes), volumeMM3: volume, massG: mass, ...(centroid ? { centroid } : {}) };
}
/** The exact section's bodies, one a source body (its pieces merged), and each one's source body's key. */
export function exactBodies(bodies: readonly BodyResult[], kept: readonly string[], from: readonly string[]): { bodies: BodyResult[]; from: Map<string, string> } {
  const byKey = new Map(bodies.map(b => [b.key, b])), groups = new Map<string, BodyResult[]>();
  for (let i = 0; i < kept.length; i++) { const b = byKey.get(kept[i]); if (!b) continue; const g = groups.get(from[i]); if (g) g.push(b); else groups.set(from[i], [b]); }
  const out: BodyResult[] = [], src = new Map<string, string>();
  for (const [source, pieces] of groups) { const b = mergeBodies(pieces); out.push(b); src.set(b.key, source); }
  return { bodies: out, from: src };
}
/**
 * A mesh's points, normals and edge lines through a rotation, its box again from the points its triangles use (clipMesh
 * keeps the points of the triangles it drops); the rest as it is.
 */
function turnMesh(m: DisplayMesh, f: (v: readonly number[]) => Vec3): DisplayMesh {
  const P = new Float32Array(m.positions.length), N = new Float32Array(m.normals.length), L = new Float32Array(m.edgeLines.length);
  for (let i = 0; i < P.length; i += 3) {
    const q = f([m.positions[i], m.positions[i + 1], m.positions[i + 2]]), n = f([m.normals[i], m.normals[i + 1], m.normals[i + 2]]);
    P[i] = q[0]; P[i + 1] = q[1]; P[i + 2] = q[2]; N[i] = n[0]; N[i + 1] = n[1]; N[i + 2] = n[2];
  }
  for (let i = 0; i < L.length; i += 3) { const q = f([m.edgeLines[i], m.edgeLines[i + 1], m.edgeLines[i + 2]]); L[i] = q[0]; L[i + 1] = q[1]; L[i + 2] = q[2]; }
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let t = 0; t < m.indices.length; t++) { const v = 3 * m.indices[t]; for (let k = 0; k < 3; k++) { const x = P[v + k]; if (x < min[k]) min[k] = x; if (x > max[k]) max[k] = x; } }
  return { ...m, positions: P, normals: N, edgeLines: L, bounds: m.indices.length ? { min, max } : m.bounds };
}

/**
 * The part's bodies shown in the section while it moves: on the GPU the bodies themselves, less those wholly cut away
 * (the planes cut and cap the rest); on the CPU each clipped and capped by every plane, its cap faces named `capName`.
 */
export function sectionedBodies(bodies: readonly BodyResult[], s: Section, gpu: boolean, capName: string): BodyResult[] {
  if (gpu) return bodies.filter(b => !cutAway(b.mesh, s));
  return bodies.flatMap(b => { const mesh = clipMeshSection(b.mesh, s, capName); return mesh ? [{ ...b, mesh }] : []; });
}

/**
 * The placed instances in the section: on the GPU the list itself, as placed (their pose matrices on their meshes, the
 * planes in world space cutting them where they are shown); on the CPU moved copies, clipped and capped.
 */
export function sectionedInstances<T extends Placed>(instances: T[], poses: ReadonlyMap<string, Float64Array>, s: Section, gpu: boolean): T[] | Placed[] {
  // (The same list: nothing is made again while the planes move.)
  if (gpu) return instances;
  return instances.map(i => {
    const M = poses.get(i.id), m = M && motionOf(M);
    const bodies: BodyResult[] = [], sourceBodies: number[] = [], sourceFaces: number[][] = [], sourceEdges: number[][] = [];
    i.bodies.forEach((b, bi) => {
      const mesh = clipMeshSection(m ? posedBody(b, m).mesh : b.mesh, s, 'section');
      if (!mesh) return;
      const priorFaces = i.sourceFaces ? i.sourceFaces[bi] ?? [] : undefined, priorEdges = i.sourceEdges ? i.sourceEdges[bi] ?? [] : undefined;
      const faces = sectionFaceSources(b.mesh, mesh, priorFaces);
      bodies.push({ ...b, mesh });
      sourceBodies.push(sourceIndex(i.sourceBodies, bi));
      sourceFaces.push(faces);
      sourceEdges.push(sectionEdgeSources(b.mesh, mesh, faces, priorFaces, priorEdges));
    });
    return { id: i.id, bodies, sourceBodies, sourceFaces, sourceEdges };
  });
}

/** A missing optional map is identity; a missing/invalid entry in an existing map has no native authority. */
function sourceIndex(map: readonly number[] | undefined, index: number): number {
  const value = map ? map[index] : index;
  return Number.isInteger(value) && value >= 0 ? value : -1;
}

/** Cutout pieces duplicate/renumber native faces; exact full identity reconnects them without inventing cap IDs. */
function sectionFaceSources(source: DisplayMesh, shown: DisplayMesh, prior?: readonly number[]): number[] {
  const byIdentity = new Map<string, Set<number>>();
  for (const f of source.faces) {
    if (f.id === 'section-cap') continue;
    const native = sourceIndex(prior, f.index);
    if (native < 0) continue;
    const key = JSON.stringify([f.id, f.name]), values = byIdentity.get(key) ?? new Set<number>();
    values.add(native); byIdentity.set(key, values);
  }
  const out = Array.from({ length: shown.faces.reduce((max, f) => Math.max(max, f.index), -1) + 1 }, () => -1);
  for (const f of shown.faces) {
    if (f.id === 'section-cap') continue;
    const values = byIdentity.get(JSON.stringify([f.id, f.name]));
    if (values?.size === 1) out[f.index] = values.values().next().value!;
  }
  return out;
}

/** Full edge names and both original adjacent faces identify a native edge; ambiguous/boundary-cap edges stay -1. */
function sectionEdgeSources(source: DisplayMesh, shown: DisplayMesh, faces: readonly number[], priorFaces?: readonly number[], priorEdges?: readonly number[]): number[] {
  const keyOf = (edge: DisplayMesh['edges'][number], face: (index: number) => number): string | null => {
    const adjacent = edge.faces.map(face);
    if (!edge.names.length || adjacent.some(f => f < 0)) return null;
    return JSON.stringify([[...edge.names].sort(), adjacent.sort((a, b) => a - b)]);
  };
  const nativeFaces = new Map(source.faces.map(f => [f.index, f.id === 'section-cap' ? -1 : sourceIndex(priorFaces, f.index)]));
  const byIdentity = new Map<string, Set<number>>();
  for (const edge of source.edges) {
    const key = keyOf(edge, index => nativeFaces.get(index) ?? -1), native = sourceIndex(priorEdges, edge.index);
    if (key === null || native < 0) continue;
    const values = byIdentity.get(key) ?? new Set<number>(); values.add(native); byIdentity.set(key, values);
  }
  const out = Array.from({ length: shown.edges.reduce((max, e) => Math.max(max, e.index), -1) + 1 }, () => -1);
  for (const edge of shown.edges) {
    const key = keyOf(edge, index => faces[index] ?? -1), values = key === null ? undefined : byIdentity.get(key);
    if (values?.size === 1) out[edge.index] = values.values().next().value!;
  }
  return out;
}

/**
 * The exact section's document (G2, G19): each body the planes cross split by them in turn — each kept piece split by
 * the next plane that crosses it; G20, a cut-out: each body's pieces kept by each plane in turn from what the planes
 * before it cut away — and the keys of the pieces kept (bodies wholly kept as they are, those wholly cut away left
 * out), and each kept piece's body (`from`, by its key). One axis plane: by the bodies' boxes, as before; otherwise by
 * their display meshes clipped plane by plane (whether a plane crosses what is left of a body; the kernel refuses a
 * split that does not).
 */
export function sectionSplits(evaluated: StudioDoc, bodies: readonly BodyResult[], s: Section): { doc: StudioDoc; kept: string[]; from: string[] } {
  let doc: StudioDoc = { ...evaluated, nodes: [...evaluated.nodes] };
  const kept: string[] = [], from: string[] = [], one = s.planes.length === 1 ? planeAxis(s.planes[0]) : null;
  for (const b of bodies) {
    if (one) {
      const { min, max } = b.mesh.bounds, { k, at, keep } = one;
      if (min[k] < at - 1e-6 && max[k] > at + 1e-6) { doc = withNode(doc, split(refOf(b), s.planes[0])); kept.push(bodyKeyFor(doc.nodes, doc.nodes.length - 1, keep)); from.push(b.key); }
      else if (keep === 'negative' ? max[k] <= at + 1e-6 : min[k] >= at - 1e-6) { kept.push(b.key); from.push(b.key); }
      continue;
    }
    if (s.mode === 'cutout') {
      // (G20: the body's pieces kept by each plane in turn from what the planes before it cut away — what is left of it
      // after a plane taken on to the next; the rest, in the removed corner, dropped.)
      let ref: BodyRef | null = null, key = b.key, mesh: DisplayMesh | null = b.mesh;
      for (const p of s.planes) {
        const side = classify(mesh!, p);
        if (side === 'kept') { kept.push(key); from.push(b.key); break; }
        if (side === 'cut') continue;
        doc = withNode(doc, split(ref ?? refOf(b), p));
        const node = doc.nodes.length - 1, a = planeAxis(p), keep = a ? a.keep : 'positive', other = keep === 'positive' ? 'negative' : 'positive';
        kept.push(bodyKeyFor(doc.nodes, node, keep)); from.push(b.key);
        ref = { node, side: other }; key = bodyKeyFor(doc.nodes, node, other);
        mesh = clipMeshPlane(mesh!, flipPlane(p), 'section');
        if (!mesh) break;
      }
      continue;
    }
    let ref: BodyRef | null = null, key = b.key, mesh: DisplayMesh | null = b.mesh;
    for (const p of s.planes) {
      const side = classify(mesh!, p);
      if (side === 'cut') { mesh = null; break; }
      if (side === 'kept') continue;
      doc = withNode(doc, split(ref ?? refOf(b), p));
      const node = doc.nodes.length - 1, a = planeAxis(p), keep = a ? a.keep : 'positive';
      ref = { node, side: keep }; key = bodyKeyFor(doc.nodes, node, keep);
      mesh = clipMeshPlane(mesh!, p, 'section');
      if (!mesh) break;
    }
    if (mesh) { kept.push(key); from.push(b.key); }
  }
  return { doc, kept, from };
}
/** The split node for a plane: across an axis, or across the plane normal·p = offset (the kept piece its positive one). */
function split(parent: BodyRef, p: SectionPlane): ModelNode {
  const a = planeAxis(p);
  return a ? { kind: 'split', parent, axis: 'xyz'[a.k] as Axis, at: a.at } : { kind: 'split', parent, axis: 'x', at: p.offset, normal: [p.normal[0], p.normal[1], p.normal[2]] };
}
/**
 * Which side of a plane a mesh is on — wholly kept, wholly cut away, or across it — by the points its triangles use
 * (clipMesh's tolerance; a clipped mesh keeps the points of the triangles it dropped).
 */
function classify(m: DisplayMesh, p: SectionPlane): 'kept' | 'cut' | 'cross' {
  const P = m.positions, I = m.indices, size = Math.max(1, ...m.bounds.max.map(Math.abs), ...m.bounds.min.map(Math.abs)), eps = 1e-9 * size;
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < I.length; t++) { const i = 3 * I[t]; let d = p.normal[0] * P[i] + p.normal[1] * P[i + 1] + p.normal[2] * P[i + 2] - p.offset; if (Math.abs(d) <= eps) d = 0; if (d < lo) lo = d; if (d > hi) hi = d; }
  return lo >= 0 ? 'kept' : hi <= 0 ? 'cut' : 'cross';
}

const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: readonly number[], b: readonly number[]): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/**
 * The hatch's angles (G19.3), degrees, by body: the bodies' and then the placed parts' surfaces in turn, so neighbours
 * read apart.
 */
export const HATCH_ANGLES = [45, 135, 30, 120, 60, 150] as const;
export const hatchAngle = (i: number) => HATCH_ANGLES[i % HATCH_ANGLES.length];
const HATCH_STEPS = [0.5, 1, 2, 5, 10];
/** The hatch's spacing (mm) for a scene box: a sixtieth of its diagonal, down to the step below (0.5, 1, 2, 5, 10 mm). */
export function hatchSpacing(box: { min: readonly number[]; max: readonly number[] } | null): number {
  const d = box ? Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]) / 60 : 0;
  let s = HATCH_STEPS[0];
  for (const step of HATCH_STEPS) if (step <= d) s = step;
  return s;
}

const hatchScratch = { h: [0, 0, 0] as number[] };
/**
 * A mesh's hatch on the cut (G19.3; WebGL2's, and the exact section's on either renderer): the lines `spacing` apart at
 * `angle` in each plane's axes (capHatchAxes, as the viewer's cap shader draws them, through the world's origin), cut
 * against its triangles lying on a plane and facing the side cut away — a clipped mesh's caps, an exact piece's cut
 * faces. Six numbers a segment.
 */
export function hatchSegments(m: DisplayMesh, planes: readonly SectionPlane[], angle: number, spacing: number): Float32Array {
  const P = m.positions, I = m.indices, out: number[] = [], { h } = hatchScratch;
  const tol = 1e-3, c = Math.cos(angle * Math.PI / 180), sn = Math.sin(angle * Math.PI / 180);
  const across = planes.map(p => { const { u, v } = capHatchAxes(p.normal); return [(c * v[0] - sn * u[0]) / spacing, (c * v[1] - sn * u[1]) / spacing, (c * v[2] - sn * u[2]) / spacing]; });
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], d = 3 * I[t + 2];
    const plane = planeOf(P, a, b, d, planes, tol);
    if (plane < 0) continue;
    const w = across[plane];
    h[0] = w[0] * P[a] + w[1] * P[a + 1] + w[2] * P[a + 2]; h[1] = w[0] * P[b] + w[1] * P[b + 1] + w[2] * P[b + 2]; h[2] = w[0] * P[d] + w[1] * P[d + 1] + w[2] * P[d + 2];
    const k0 = Math.ceil(Math.min(h[0], h[1], h[2])), k1 = Math.floor(Math.max(h[0], h[1], h[2]));
    for (let k = k0; k <= k1; k++) {
      // (Half open: an edge crosses line k when its ends lie either side of it, k on the upper side — two edges or none.)
      const n0 = out.length;
      crossing(P, a, b, h[0], h[1], k, out); crossing(P, b, d, h[1], h[2], k, out); crossing(P, d, a, h[2], h[0], k, out);
      if (out.length - n0 !== 6) out.length = n0;
    }
  }
  return new Float32Array(out);
}
/** The plane a triangle lies on, facing the side it cuts away (−normal), or −1. */
function planeOf(P: ArrayLike<number>, a: number, b: number, d: number, planes: readonly SectionPlane[], tol: number): number {
  const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[d] - P[a], vy = P[d + 1] - P[a + 1], vz = P[d + 2] - P[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz);
  if (nl < 1e-12) return -1;
  for (let i = 0; i < planes.length; i++) {
    const p = planes[i], q = p.normal;
    if ((nx * q[0] + ny * q[1] + nz * q[2]) / nl > -0.999) continue;
    if (Math.abs(q[0] * P[a] + q[1] * P[a + 1] + q[2] * P[a + 2] - p.offset) > tol || Math.abs(q[0] * P[b] + q[1] * P[b + 1] + q[2] * P[b + 2] - p.offset) > tol || Math.abs(q[0] * P[d] + q[1] * P[d + 1] + q[2] * P[d + 2] - p.offset) > tol) continue;
    return i;
  }
  return -1;
}
/** Where an edge crosses line k (its ends' values ha, hb), pushed. */
function crossing(P: ArrayLike<number>, a: number, b: number, ha: number, hb: number, k: number, out: number[]): void {
  if ((ha < k) === (hb < k)) return;
  const f = (k - ha) / (hb - ha);
  out.push(P[a] + (P[b] - P[a]) * f, P[a + 1] + (P[b + 1] - P[a + 1]) * f, P[a + 2] + (P[b + 2] - P[a + 2]) * f);
}
/** Each body's hatch on the cut (G19.3): its segments at its angle by its index; bodies with none left out. */
export function sectionHatch(bodies: readonly BodyResult[], planes: readonly SectionPlane[], spacing: number): { body: number; segments: Float32Array }[] {
  const out: { body: number; segments: Float32Array }[] = [];
  for (let i = 0; i < bodies.length; i++) { const segments = hatchSegments(bodies[i].mesh, planes, hatchAngle(i), spacing); if (segments.length) out.push({ body: i, segments }); }
  return out;
}
