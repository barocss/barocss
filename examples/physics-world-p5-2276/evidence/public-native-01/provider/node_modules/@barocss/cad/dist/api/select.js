import { refuse } from './refusal.js';
const AXIS_INDEX = { x: 0, y: 1, z: 2 };
const checkedAxis = (axis) => {
    if (axis !== 'x' && axis !== 'y' && axis !== 'z')
        throw refuse('VALUE', `an axis is x, y or z, not ${String(axis)}`);
    return axis;
};
const checkedCount = (count) => {
    if (!Number.isInteger(count) || count < 0)
        throw refuse('VALUE', `a selection count must be a non-negative integer, not ${String(count)}`);
    return count;
};
// (A plane's normal along an axis within this cosine; a straight edge along an axis within this, as cad-model's mesh has it.)
const ALONG = 1 - 1e-6, AXIS_TOL = 1e-9;
// Snapshot caller data before freezing: no input record or tuple belongs to a query.
const vector = (v) => Object.freeze([...v]);
const edgeSnapshot = (e) => Object.freeze({ ...e,
    names: Object.freeze([...e.names]), a: vector(e.a), b: vector(e.b),
    faces: Object.freeze([...e.faces]),
});
const faceSnapshot = (f) => Object.freeze({ ...f,
    normal: vector(f.normal), centroid: vector(f.centroid), edges: Object.freeze([...f.edges]),
});
const edgeSnapshots = (edges) => Object.freeze(edges.map(edgeSnapshot));
const faceSnapshots = (faces) => Object.freeze(faces.map(faceSnapshot));
/** A body's edges and faces, from the records its facade filled. */
export class BodyQuery {
    #edges;
    #faces;
    constructor(edges, faces) { this.#edges = edgeSnapshots(edges); this.#faces = faceSnapshots(faces); }
    /** Every edge of the body, in the core's order. */
    edges() { return new EdgeQuery(this.#edges); }
    /** Every face of the body, in the core's order. */
    faces() { return new FaceQuery(this.#faces, this.#edges); }
}
const midpoint = (e, i) => (e.a[i] + e.b[i]) / 2;
export class EdgeQuery {
    #items;
    constructor(items) { this.#items = edgeSnapshots(items); }
    /** Straight edges running along an axis. */
    along(axis) { checkedAxis(axis); return new EdgeQuery(this.#items.filter(e => e.straight && e.axis === axis)); }
    straight() { return new EdgeQuery(this.#items.filter(e => e.straight)); }
    curved() { return new EdgeQuery(this.#items.filter(e => !e.straight)); }
    /** The edges on a face, given by its persistent name. */
    on(face) { return new EdgeQuery(this.#items.filter(e => e.faces[0] === face || e.faces[1] === face)); }
    /** Any test of your own on an edge's data. */
    where(test) { return new EdgeQuery(this.#items.filter(test)); }
    /** Sorted by the edge's midpoint along an axis, lowest first (stable: equal ones keep the core's order). */
    sortBy(axis) {
        const i = AXIS_INDEX[checkedAxis(axis)];
        return new EdgeQuery([...this.#items].sort((p, q) => midpoint(p, i) - midpoint(q, i)));
    }
    first(count = 1) { return new EdgeQuery(this.#items.slice(0, checkedCount(count))); }
    last(count = 1) { return new EdgeQuery(this.#items.slice(Math.max(0, this.#items.length - checkedCount(count)))); }
    get count() { return this.#items.length; }
    list() { return this.#items; }
    /** The persistent names a feature stores, every name of every edge, in the query's order. */
    names() { return this.#items.flatMap(e => e.names); }
}
export class FaceQuery {
    #items;
    #edges;
    constructor(items, edges) { this.#items = faceSnapshots(items); this.#edges = edgeSnapshots(edges); }
    /** Plane faces whose outward normal points that way. */
    facing(direction) {
        if (direction !== '+x' && direction !== '-x' && direction !== '+y' && direction !== '-y' && direction !== '+z' && direction !== '-z')
            throw refuse('VALUE', `a face direction is +x, -x, +y, -y, +z or -z, not ${String(direction)}`);
        const i = AXIS_INDEX[direction[1]], sign = direction[0] === '+' ? 1 : -1;
        return new FaceQuery(this.#items.filter(f => f.kind === 'plane' && f.normal[i] * sign >= ALONG), this.#edges);
    }
    planar() { return new FaceQuery(this.#items.filter(f => f.kind === 'plane'), this.#edges); }
    curved() { return new FaceQuery(this.#items.filter(f => f.kind === 'curved'), this.#edges); }
    where(test) { return new FaceQuery(this.#items.filter(test), this.#edges); }
    /** Sorted by the face's centroid along an axis, lowest first (stable). */
    sortBy(axis) {
        const i = AXIS_INDEX[checkedAxis(axis)];
        return new FaceQuery([...this.#items].sort((p, q) => p.centroid[i] - q.centroid[i]), this.#edges);
    }
    first(count = 1) { return new FaceQuery(this.#items.slice(0, checkedCount(count)), this.#edges); }
    last(count = 1) { return new FaceQuery(this.#items.slice(Math.max(0, this.#items.length - checkedCount(count))), this.#edges); }
    get count() { return this.#items.length; }
    list() { return this.#items; }
    names() { return this.#items.map(f => f.name); }
    /** The edges that bound these faces, each once, in the body's order. */
    edges() {
        const picked = new Set();
        for (const f of this.#items)
            for (const k of f.edges)
                picked.add(k);
        return new EdgeQuery([...picked].sort((p, q) => p - q).map(k => this.#edges[k]));
    }
}
const unit = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
};
// (A tangent joint — two faces meeting smoothly, a cylinder's halves — is no corner to select, as the studio's display
// leaves it out: their tessellation normals at the edge's middle point within 20°, cad-model's engine/mesh.ts rule.)
const TANGENT_COS = Math.cos(Math.PI / 9);
function normalAt(mesh, face, x, y, z) {
    const P = mesh.positions, N = mesh.normals;
    if (face.kind === 'facet')
        return null;
    for (let v = face.vertexOffset; v < face.vertexOffset + face.vertexCount; v++)
        if (P[v * 3] === x && P[v * 3 + 1] === y && P[v * 3 + 2] === z)
            return [N[v * 3], N[v * 3 + 1], N[v * 3 + 2]];
    return null;
}
function tangent(mesh, fa, fb, points) {
    if (!fa || !fb || !points || points.length < 3)
        return false;
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
function usesOf(brep) {
    const loopFace = new Map(brep.loops.map(l => [l.id, l.face])), uses = new Map();
    for (const c of brep.coedges) {
        const f = loopFace.get(c.loop), l = uses.get(c.edge);
        if (l)
            l.push(f);
        else
            uses.set(c.edge, [f]);
    }
    return uses;
}
// (An edge a person sees and picks: two different faces meeting at it, not smoothly — no seam, no tangent joint.)
function shown(uses, mesh, meshFace, points) {
    return !!uses && uses.length === 2 && uses[0] !== uses[1] && !tangent(mesh, meshFace.get(uses[0]), meshFace.get(uses[1]), points);
}
/**
 * A B-rep's display lines (api-conventions.md §10.3): the edges the selectors offer — seams and tangent joints left out,
 * as the studio's display leaves them — as segment pairs of their tessellated polylines, in mm.
 */
export function brepLines(brep, mesh) {
    const uses = usesOf(brep), meshFace = new Map(mesh.faces.map(f => [f.faceId, f])), out = [];
    for (const e of mesh.edges) {
        if (!shown(uses.get(e.edgeId), mesh, meshFace, e.points))
            continue;
        const P = e.points;
        for (let k = 0; k + 5 < P.length; k += 3)
            out.push(P[k], P[k + 1], P[k + 2], P[k + 3], P[k + 4], P[k + 5]);
    }
    return Float32Array.from(out);
}
export function brepSelection(brep, mesh) {
    const faceName = new Map(brep.faces.map(f => [f.id, f.name ?? f.id]));
    const vertex = new Map(brep.vertices.map(v => [v.id, v.point]));
    const faceUses = usesOf(brep);
    const edges = [], edgesOfFace = new Map();
    const meshFace = new Map(mesh.faces.map(f => [f.faceId, f])), meshEdge = new Map(mesh.edges.map(e => [e.edgeId, e.points]));
    for (const e of brep.edges) {
        const uses = faceUses.get(e.id) ?? [];
        if (!shown(uses, mesh, meshFace, meshEdge.get(e.id)))
            continue;
        const a = vertex.get(e.vertices[0]), b = vertex.get(e.vertices[1]);
        const straight = e.curve.degree === 1 && e.curve.controlPoints.length === 2, dir = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
        const axis = straight ? ['x', 'y', 'z'].find((_, k) => Math.abs(Math.abs(dir[k]) - 1) < AXIS_TOL) ?? null : null;
        const k = edges.length;
        edges.push({ names: [e.name ?? e.id], straight, axis, a: [a[0], a[1], a[2]], b: [b[0], b[1], b[2]], faces: [faceName.get(uses[0]), faceName.get(uses[1])] });
        for (const f of uses) {
            const l = edgesOfFace.get(f);
            if (l)
                l.push(k);
            else
                edgesOfFace.set(f, [k]);
        }
    }
    const P = mesh.positions, N = mesh.normals;
    const faces = mesh.faces.map(f => {
        const v0 = f.vertexOffset * 3, centroid = [0, 0, 0];
        for (let v = f.vertexOffset; v < f.vertexOffset + f.vertexCount; v++) {
            centroid[0] += P[v * 3];
            centroid[1] += P[v * 3 + 1];
            centroid[2] += P[v * 3 + 2];
        }
        const n = Math.max(1, f.vertexCount);
        return {
            name: faceName.get(f.faceId) ?? f.faceId, kind: f.kind === 'planar' ? 'plane' : 'curved',
            normal: f.kind === 'planar' ? unit([N[v0], N[v0 + 1], N[v0 + 2]]) : [0, 0, 0],
            centroid: [centroid[0] / n, centroid[1] / n, centroid[2] / n], edges: edgesOfFace.get(f.faceId) ?? [],
        };
    });
    return new BodyQuery(edges, faces);
}
