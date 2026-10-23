// R7 (the facade): typed selectors over a body's edges and faces. They read what the core's evaluation already worked
// out — the display mesh's edges and faces, each with its persistent names (engine/mesh.ts) — and hand back those
// names, which a feature node stores. No string selectors (CadQuery's ">Z"): every filter is a method with a type.
// Each query is immutable: a filter returns a new query.
import type { DisplayMesh } from '../engine/mesh';

export type Vec3 = readonly [number, number, number];
export type AxisName = 'x' | 'y' | 'z';
/** An outward direction along an axis, for faces: '+z' is a face whose normal points up. */
export type Direction = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

/** One edge of a body as the core sees it: its persistent names (a closed curve may carry two), its ends and its faces' names. */
export interface EdgeInfo {
  readonly names: readonly string[];
  readonly straight: boolean;
  /** The axis a straight edge runs along, when it runs along one. */
  readonly axis: AxisName | null;
  readonly a: Vec3; readonly b: Vec3;
  readonly faces: readonly [string, string];
}
/** One face of a body: its persistent name, plane or curved, its normal (a plane's) and centroid, its area. */
export interface FaceInfo {
  readonly name: string;
  readonly kind: 'plane' | 'curved';
  readonly normal: Vec3; readonly centroid: Vec3;
  readonly areaMM2: number;
  /** The edges that bound it, by their index in the body's edge list. */
  readonly edges: readonly number[];
}

const AXIS_INDEX: Record<AxisName, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
// (A plane's normal along an axis within this cosine: the mesh's normals are Float32.)
const ALONG = 1 - 1e-6;

function edgesOfMesh(mesh: DisplayMesh): EdgeInfo[] {
  return mesh.edges.map(e => ({
    names: e.names, straight: e.straight, axis: e.axis,
    a: [e.a[0], e.a[1], e.a[2]], b: [e.b[0], e.b[1], e.b[2]],
    faces: [mesh.faces[e.faces[0]]?.name ?? '', mesh.faces[e.faces[1]]?.name ?? ''],
  }));
}

function facesOfMesh(mesh: DisplayMesh): FaceInfo[] {
  const edges: number[][] = mesh.faces.map(() => []);
  mesh.edges.forEach((e, k) => { edges[e.faces[0]]?.push(k); if (e.faces[1] !== e.faces[0]) edges[e.faces[1]]?.push(k); });
  return mesh.faces.map((f, k) => ({
    name: f.name, kind: f.kind, normal: [f.normal[0], f.normal[1], f.normal[2]], centroid: [f.centroid[0], f.centroid[1], f.centroid[2]],
    areaMM2: f.areaMM2, edges: edges[k],
  }));
}

/** A body's edges and faces, read once from its display mesh. */
export class BodyQuery {
  readonly #edges: readonly EdgeInfo[];
  readonly #faces: readonly FaceInfo[];
  constructor(mesh: DisplayMesh) { this.#edges = edgesOfMesh(mesh); this.#faces = facesOfMesh(mesh); }
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
