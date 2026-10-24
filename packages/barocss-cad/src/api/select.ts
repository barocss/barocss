// R7 (the facades): typed selectors over a body's edges and faces, shared by cad's and cad-model's facades. Each facade
// fills the same records from what its core already worked out — cad from the B-rep (brepSelection below), cad-model
// from its display mesh — and the queries hand back the persistent names a feature stores. No string selectors
// (CadQuery's ">Z"): every filter is a typed method. Each query is immutable: a filter returns a new query.
import type { Brep } from '../brep/brep-core.js';
import type { BrepMesh, BrepMeshFace } from '../brep/brep-tessellate.js';

/** A point or direction, mm, Z up: the facades' one shape (api-conventions §10.2), the same tuple gpu's core/geometry-types.ts declares. */
export type Vec3 = readonly [number, number, number];
export type AxisName = 'x' | 'y' | 'z';
/** An outward direction along an axis, for faces: '+z' is a face whose normal points up. */
export type Direction = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

/** One edge of a body: its persistent names (a closed curve may carry two), straight or not, its ends and its faces' names. */
export interface EdgeInfo {
  readonly names: readonly string[];
  readonly straight: boolean;
  /** The axis a straight edge runs along, when it runs along one. */
  readonly axis: AxisName | null;
  readonly a: Vec3; readonly b: Vec3;
  readonly faces: readonly [string, string];
}
/** One face of a body: its persistent name, plane or curved, its outward normal (a plane's) and centroid. */
export interface FaceInfo {
  readonly name: string;
  readonly kind: 'plane' | 'curved';
  readonly normal: Vec3; readonly centroid: Vec3;
  /** Its area (mm²), where the facade's core gives one. */
  readonly areaMM2?: number;
  /** The edges that bound it, by their index in the body's edge list. */
  readonly edges: readonly number[];
}

const AXIS_INDEX: Record<AxisName, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
// (A plane's normal along an axis within this cosine; a straight edge along an axis within this, as cad-model's mesh has it.)
const ALONG = 1 - 1e-6, AXIS_TOL = 1e-9;

/** A body's edges and faces, from the records its facade filled. */
export class BodyQuery {
  readonly #edges: readonly EdgeInfo[];
  readonly #faces: readonly FaceInfo[];
  constructor(edges: readonly EdgeInfo[], faces: readonly FaceInfo[]) { this.#edges = edges; this.#faces = faces; }
  /** Every edge of the body, in the core's order. */
  edges(): EdgeQuery { return new EdgeQuery(this.#edges); }
  /** Every face of the body, in the core's order. */
  faces(): FaceQuery { return new FaceQuery(this.#faces, this.#edges); }
}

const midpoint = (e: EdgeInfo, i: 0 | 1 | 2) => (e.a[i] + e.b[i]) / 2;

export class EdgeQuery {
  readonly #items: readonly EdgeInfo[];
  constructor(items: readonly EdgeInfo[]) { this.#items = items; }
  /** Straight edges running along an axis. */
  along(axis: AxisName): EdgeQuery { return new EdgeQuery(this.#items.filter(e => e.straight && e.axis === axis)); }
  straight(): EdgeQuery { return new EdgeQuery(this.#items.filter(e => e.straight)); }
  curved(): EdgeQuery { return new EdgeQuery(this.#items.filter(e => !e.straight)); }
  /** The edges on a face, given by its persistent name. */
  on(face: string): EdgeQuery { return new EdgeQuery(this.#items.filter(e => e.faces[0] === face || e.faces[1] === face)); }
  /** Any test of your own on an edge's data. */
  where(test: (edge: EdgeInfo) => boolean): EdgeQuery { return new EdgeQuery(this.#items.filter(test)); }
  /** Sorted by the edge's midpoint along an axis, lowest first (stable: equal ones keep the core's order). */
  sortBy(axis: AxisName): EdgeQuery {
    const i = AXIS_INDEX[axis];
    return new EdgeQuery([...this.#items].sort((p, q) => midpoint(p, i) - midpoint(q, i)));
  }
  first(count = 1): EdgeQuery { return new EdgeQuery(this.#items.slice(0, count)); }
  last(count = 1): EdgeQuery { return new EdgeQuery(this.#items.slice(Math.max(0, this.#items.length - count))); }
  get count(): number { return this.#items.length; }
  list(): readonly EdgeInfo[] { return this.#items; }
  /** The persistent names a feature stores, every name of every edge, in the query's order. */
  names(): string[] { return this.#items.flatMap(e => e.names); }
}

export class FaceQuery {
  readonly #items: readonly FaceInfo[];
  readonly #edges: readonly EdgeInfo[];
  constructor(items: readonly FaceInfo[], edges: readonly EdgeInfo[]) { this.#items = items; this.#edges = edges; }
  /** Plane faces whose outward normal points that way. */
  facing(direction: Direction): FaceQuery {
    const i = AXIS_INDEX[direction[1] as AxisName], sign = direction[0] === '+' ? 1 : -1;
    return new FaceQuery(this.#items.filter(f => f.kind === 'plane' && f.normal[i] * sign >= ALONG), this.#edges);
  }
  planar(): FaceQuery { return new FaceQuery(this.#items.filter(f => f.kind === 'plane'), this.#edges); }
  curved(): FaceQuery { return new FaceQuery(this.#items.filter(f => f.kind === 'curved'), this.#edges); }
  where(test: (face: FaceInfo) => boolean): FaceQuery { return new FaceQuery(this.#items.filter(test), this.#edges); }
  /** Sorted by the face's centroid along an axis, lowest first (stable). */
  sortBy(axis: AxisName): FaceQuery {
    const i = AXIS_INDEX[axis];
    return new FaceQuery([...this.#items].sort((p, q) => p.centroid[i] - q.centroid[i]), this.#edges);
  }
  first(count = 1): FaceQuery { return new FaceQuery(this.#items.slice(0, count), this.#edges); }
  last(count = 1): FaceQuery { return new FaceQuery(this.#items.slice(Math.max(0, this.#items.length - count)), this.#edges); }
  get count(): number { return this.#items.length; }
  list(): readonly FaceInfo[] { return this.#items; }
  names(): string[] { return this.#items.map(f => f.name); }
  /** The edges that bound these faces, each once, in the body's order. */
  edges(): EdgeQuery {
    const picked = new Set<number>();
    for (const f of this.#items) for (const k of f.edges) picked.add(k);
    return new EdgeQuery([...picked].sort((p, q) => p - q).map(k => this.#edges[k]));
  }
}

const unit = (v: readonly number[]): [number, number, number] => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
};

// (A tangent joint — two faces meeting smoothly, a cylinder's halves — is no corner to select, as the studio's display
// leaves it out: their tessellation normals at the edge's middle point within 20°, cad-model's engine/mesh.ts rule.)
const TANGENT_COS = Math.cos(Math.PI / 9);

function normalAt(mesh: BrepMesh, face: BrepMeshFace, x: number, y: number, z: number): [number, number, number] | null {
  const P = mesh.positions, N = mesh.normals;
  if (face.kind === 'facet') return null;
  for (let v = face.vertexOffset; v < face.vertexOffset + face.vertexCount; v++) if (P[v * 3] === x && P[v * 3 + 1] === y && P[v * 3 + 2] === z) return [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
  return null;
}

function tangent(mesh: BrepMesh, fa: BrepMeshFace | undefined, fb: BrepMeshFace | undefined, points: Float64Array | undefined): boolean {
  if (!fa || !fb || !points || points.length < 3) return false;
  const k = Math.floor(points.length / 6) * 3, na = normalAt(mesh, fa, points[k], points[k + 1], points[k + 2]), nb = normalAt(mesh, fb, points[k], points[k + 1], points[k + 2]);
  return !!na && !!nb && na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2] > TANGENT_COS;
}

/**
 * A B-rep's edges and faces as selection records: the kernel's own data — each edge's persistent name, its curve a line
 * or not (a degree-1 curve of two control points), its two faces through its coedges; each face's name, planar or not
 * by the kernel's tessellation, its normal and centroid from that tessellation. A seam (an edge both of whose uses are
 * on one face) is left out, as the studio's display leaves it out.
 */
/** Each edge's faces through its coedges, by face id. */
function usesOf(brep: Brep): Map<string, string[]> {
  const loopFace = new Map(brep.loops.map(l => [l.id, l.face])), uses = new Map<string, string[]>();
  for (const c of brep.coedges) { const f = loopFace.get(c.loop)!, l = uses.get(c.edge); if (l) l.push(f); else uses.set(c.edge, [f]); }
  return uses;
}

// (An edge a person sees and picks: two different faces meeting at it, not smoothly — no seam, no tangent joint.)
function shown(uses: readonly string[] | undefined, mesh: BrepMesh, meshFace: ReadonlyMap<string, BrepMeshFace>, points: Float64Array | undefined): boolean {
  return !!uses && uses.length === 2 && uses[0] !== uses[1] && !tangent(mesh, meshFace.get(uses[0]), meshFace.get(uses[1]), points);
}

/**
 * A B-rep's display lines (api-conventions.md §10.3): the edges the selectors offer — seams and tangent joints left out,
 * as the studio's display leaves them — as segment pairs of their tessellated polylines, in mm.
 */
export function brepLines(brep: Brep, mesh: BrepMesh): Float32Array {
  const uses = usesOf(brep), meshFace = new Map(mesh.faces.map(f => [f.faceId, f])), out: number[] = [];
  for (const e of mesh.edges) {
    if (!shown(uses.get(e.edgeId), mesh, meshFace, e.points)) continue;
    const P = e.points;
    for (let k = 0; k + 5 < P.length; k += 3) out.push(P[k], P[k + 1], P[k + 2], P[k + 3], P[k + 4], P[k + 5]);
  }
  return Float32Array.from(out);
}

export function brepSelection(brep: Brep, mesh: BrepMesh): BodyQuery {
  const faceName = new Map(brep.faces.map(f => [f.id, f.name ?? f.id]));
  const vertex = new Map(brep.vertices.map(v => [v.id, v.point]));
  const faceUses = usesOf(brep);
  const edges: EdgeInfo[] = [], edgesOfFace = new Map<string, number[]>();
  const meshFace = new Map(mesh.faces.map(f => [f.faceId, f])), meshEdge = new Map(mesh.edges.map(e => [e.edgeId, e.points]));
  for (const e of brep.edges) {
    const uses = faceUses.get(e.id) ?? [];
    if (!shown(uses, mesh, meshFace, meshEdge.get(e.id))) continue;
    const a = vertex.get(e.vertices[0])!, b = vertex.get(e.vertices[1])!;
    const straight = e.curve.degree === 1 && e.curve.controlPoints.length === 2, dir = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const axis = straight ? (['x', 'y', 'z'] as const).find((_, k) => Math.abs(Math.abs(dir[k]) - 1) < AXIS_TOL) ?? null : null;
    const k = edges.length;
    edges.push({ names: [e.name ?? e.id], straight, axis, a: [a[0], a[1], a[2]], b: [b[0], b[1], b[2]], faces: [faceName.get(uses[0])!, faceName.get(uses[1])!] });
    for (const f of uses) { const l = edgesOfFace.get(f); if (l) l.push(k); else edgesOfFace.set(f, [k]); }
  }
  const P = mesh.positions, N = mesh.normals;
  const faces: FaceInfo[] = mesh.faces.map(f => {
    const v0 = f.vertexOffset * 3, centroid: [number, number, number] = [0, 0, 0];
    for (let v = f.vertexOffset; v < f.vertexOffset + f.vertexCount; v++) { centroid[0] += P[v * 3]; centroid[1] += P[v * 3 + 1]; centroid[2] += P[v * 3 + 2]; }
    const n = Math.max(1, f.vertexCount);
    return {
      name: faceName.get(f.faceId) ?? f.faceId, kind: f.kind === 'planar' ? 'plane' : 'curved',
      normal: f.kind === 'planar' ? unit([N[v0], N[v0 + 1], N[v0 + 2]]) : [0, 0, 0],
      centroid: [centroid[0] / n, centroid[1] / n, centroid[2] / n], edges: edgesOfFace.get(f.faceId) ?? [],
    };
  });
  return new BodyQuery(edges, faces);
}
