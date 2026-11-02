// B2: the sheet body of a band surface — one exact face per ruled patch, `${id}.band<k>`, sharing its ruling edges
// (a closed band shares its seam ruling): the faces' edges are `${id}.a|${id}.band<k>` and `${id}.b|${id}.band<k>` along the
// two source chains, `${id}.band<k-1>|${id}.band<k>` on the rulings between patches, and `${id}.end0|${id}.band0` and
// `${id}.band<n-1>|${id}.end1` on an open band's two end rulings.
import { buildBrep, lineCurve } from './brep-core.js';
const first = (c) => c.controlPoints[0];
const last = (c) => c.controlPoints[c.controlPoints.length - 1];
/** The patches (consecutive ones meeting along a ruling; a closed band's last meets its first) as one open-shell sheet body. */
export function bandSheetBrep(input) {
    const { id, patches, closed } = input, n = patches.length, rulings = closed ? n : n + 1;
    const vertices = [], edges = [];
    // Vertex k of each side is patch k's start; an open band's last is the last patch's end.
    const a = (k) => `${id}_va${k % rulings}`, b = (k) => `${id}_vb${k % rulings}`;
    for (let k = 0; k < rulings; k++) {
        const p = patches[k < n ? k : n - 1], pa = k < n ? first(p.a) : last(p.a), pb = k < n ? first(p.b) : last(p.b);
        vertices.push({ id: a(k), point: pa }, { id: b(k), point: pb });
        const near = closed ? `${id}.band${(k + n - 1) % n}` : k === 0 ? `${id}.end0` : `${id}.band${k - 1}`, far = !closed && k === n ? `${id}.end1` : `${id}.band${k % n}`;
        edges.push({ id: `${id}_r${k}`, curve: lineCurve(`${id}_r${k}`, pa, pb), vertices: [a(k), b(k)], name: `${near}|${far}` });
    }
    const faces = [];
    for (let k = 0; k < n; k++) {
        edges.push({ id: `${id}_a${k}`, curve: patches[k].a, vertices: [a(k), a(k + 1)], name: `${id}.a|${id}.band${k}` });
        edges.push({ id: `${id}_b${k}`, curve: patches[k].b, vertices: [b(k), b(k + 1)], name: `${id}.b|${id}.band${k}` });
        // Counter-clockwise in (u, v): along A, up the far ruling, back along B, down the near ruling.
        faces.push({ id: `${id}_f${k}`, name: `${id}.band${k}`, surface: patches[k].surface, sense: 'forward', loops: [{ kind: 'outer', uses: [
                        { edge: `${id}_a${k}`, sense: 'forward' }, { edge: `${id}_r${(k + 1) % rulings}`, sense: 'forward' }, { edge: `${id}_b${k}`, sense: 'reversed' }, { edge: `${id}_r${k}`, sense: 'reversed' }
                    ] }] });
    }
    return buildBrep({ source: { family: 'band-surface', id }, vertices, edges, bodies: [{ id, kind: 'sheet', shells: [{ id: `${id}_shell`, faces, closed: false }] }] });
}
