// D417: a bounded proof of INVALID binding, not a general surface/trim certificate.
// A uniform-weight tensor extrusion of a Cartesian piecewise-linear graph has a global slope bound.
// One line point farther than its own tolerance from that entire graph proves its incident edge invalid.
import { validateCurve, validateSurface } from '../core/math.js';
import { kernelRefusal } from '../core/barocss-error.js';
import { SectionRationalContext } from '../section-rational-internal.js';
const SOURCE = 'brep-boundary-binding';
// Only a runtime-locked knot-count chain can bypass the live eligibility scan. No geometry/mass claim.
const permanentlyIneligible = new WeakSet();
const AXES = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
function indeterminate(detail) { throw kernelRefusal(SOURCE, 'CAPABILITY', `B-rep: boundary binding proof unavailable: ${detail}`); }
function exactUnavailable(kind, detail) { return indeterminate(`${kind}: ${detail}`); }
function gridPoint(s, transposed, i, j) { return transposed ? s.controlPoints[j][i] : s.controlPoints[i][j]; }
function monotone(values) {
    const increasing = values[1] > values[0];
    for (let i = 1; i < values.length; i++)
        if (!(increasing ? values[i] > values[i - 1] : values[i] < values[i - 1]))
            return false;
    return true;
}
function graphForAxes(s, transposed, axes) {
    const [xAxis, yAxis, zAxis] = axes, n = transposed ? s.controlPoints[0].length : s.controlPoints.length, m = transposed ? s.controlPoints.length : s.controlPoints[0].length;
    const x = [], z = [], y = [];
    for (let i = 0; i < n; i++) {
        const p = gridPoint(s, transposed, i, 0);
        x.push(p[xAxis]);
        z.push(p[zAxis]);
    }
    if (!monotone(x))
        return null;
    let nonconstant = false;
    for (let i = 1; i < n; i++)
        if (z[i] !== z[0])
            nonconstant = true;
    if (!nonconstant)
        return null; // Ordinary planes keep their existing numerical path without exact-proof work.
    for (let j = 0; j < m; j++)
        y.push(gridPoint(s, transposed, 0, j)[yAxis]);
    if (!monotone(y))
        return null;
    for (let i = 0; i < n; i++)
        for (let j = 0; j < m; j++) {
            const p = gridPoint(s, transposed, i, j);
            if (p[xAxis] !== x[i] || p[yAxis] !== y[j] || p[zAxis] !== z[i])
                return null;
        }
    if (x[0] > x[n - 1]) {
        x.reverse();
        z.reverse();
    }
    return { x, z, xAxis, zAxis };
}
function graphOf(s) {
    if (!Array.isArray(s.controlPoints) || !Array.isArray(s.controlPoints[0]))
        return null;
    const u = s.degreeU === 1 && s.controlPoints.length >= 3, v = s.degreeV === 1 && s.controlPoints[0]?.length >= 3;
    if (!u && !v)
        return null;
    try {
        validateSurface(s);
    }
    catch {
        return null;
    } // No claim for a non-native/unsupported input.
    const weight = s.weights[0][0];
    for (const row of s.weights)
        for (const w of row)
            if (w !== weight)
                return null;
    for (const transposed of [false, true]) {
        if (transposed ? !v : !u)
            continue;
        for (const axes of AXES) {
            const graph = graphForAxes(s, transposed, axes);
            if (graph)
                return graph;
        }
    }
    return null;
}
function exactGraph(graph) {
    const q = new SectionRationalContext(exactUnavailable), x = [], z = [];
    for (const value of graph.x)
        x.push(q.from(value));
    for (const value of graph.z)
        z.push(q.from(value));
    let slope = q.rat(0n);
    for (let i = 1; i < x.length; i++)
        slope = q.max(slope, q.abs(q.div(q.sub(z[i], z[i - 1]), q.sub(x[i], x[i - 1]))));
    return { q, x, z, factor: q.add(q.rat(1n), q.mul(slope, slope)) };
}
function heightAt(g, x) {
    const { q } = g;
    for (let i = 1; i < g.x.length; i++)
        if (q.compare(x, g.x[i]) <= 0)
            return q.add(g.z[i - 1], q.mul(q.div(q.sub(x, g.x[i - 1]), q.sub(g.x[i], g.x[i - 1])), q.sub(g.z[i], g.z[i - 1])));
    return g.z[g.z.length - 1];
}
function separated(edge, graph, g) {
    const c = edge.curve;
    if (!c || c.degree !== 1 || !Array.isArray(c.controlPoints) || c.controlPoints.length !== 2 || !Number.isFinite(edge.tolerance) || edge.tolerance < 0)
        return false;
    try {
        validateCurve(c);
    }
    catch {
        return false;
    }
    if (c.weights[0] !== c.weights[1])
        return false;
    const a = c.controlPoints[0], b = c.controlPoints[1];
    if (a[graph.xAxis] === b[graph.xAxis])
        return false;
    const { q } = g, ax = q.from(a[graph.xAxis]), bx = q.from(b[graph.xAxis]), az = q.from(a[graph.zAxis]), bz = q.from(b[graph.zAxis]);
    const lo = q.compare(ax, bx) < 0 ? ax : bx, hi = lo === ax ? bx : ax;
    // Points outside the represented graph domain do not justify this proof; the existing checker owns them.
    if (q.compare(lo, g.x[0]) < 0 || q.compare(hi, g.x[g.x.length - 1]) > 0)
        return false;
    const tolerance = q.from(edge.tolerance), threshold = q.mul(q.mul(tolerance, tolerance), g.factor), probes = [ax, bx];
    for (const x of g.x)
        if (q.compare(x, lo) > 0 && q.compare(x, hi) < 0)
            probes.push(x);
    for (const x of probes) {
        const lineZ = q.add(az, q.mul(q.div(q.sub(x, ax), q.sub(bx, ax)), q.sub(bz, az))), delta = q.sub(lineZ, heightAt(g, x));
        // |delta| <= sqrt(1+L²) * distance to ANY surface point, not just its matching parameter.
        if (q.compare(q.mul(delta, delta), threshold) > 0)
            return true;
    }
    return false;
}
/** Null means no contradiction proved; it NEVER certifies a binding or an unsupported family. */
export function faceBoundaryContradiction(brep, face) {
    if (face.surface.kind !== 'surface')
        return null;
    const graph = graphOf(face.surface);
    if (!graph)
        return null;
    const exact = exactGraph(graph);
    let work = 0;
    for (const lid of face.loops) {
        let loop;
        for (const l of brep.loops)
            if (l.id === lid) {
                loop = l;
                break;
            }
        if (!loop)
            continue;
        for (const cid of loop.coedges) {
            if (++work > 4096)
                indeterminate('incident edge work limit 4096 exceeded');
            let coedge;
            for (const c of brep.coedges)
                if (c.id === cid) {
                    coedge = c;
                    break;
                }
            if (!coedge)
                continue;
            let edge;
            for (const e of brep.edges)
                if (e.id === coedge.edge) {
                    edge = e;
                    break;
                }
            if (edge && separated(edge, graph, exact))
                return `face ${face.id}, edge ${edge.id}: edge is separated from its face surface (exact ruled-graph lower bound exceeds edge tolerance)`;
        }
    }
    return null;
}
function fixedOwnValue(record, key) {
    const d = Object.getOwnPropertyDescriptor(record, key);
    return d && 'value' in d && !d.writable && !d.configurable ? d.value : undefined;
}
/** Internal producer registration. Does NOT freeze anything, and rejects mutable/foreign eligibility bindings. */
export function registerImmutableMeshPlaneExclusion(brep) {
    if (!Object.isFrozen(brep))
        return false;
    const faces = fixedOwnValue(brep, 'faces');
    if (!Array.isArray(faces) || !Object.isFrozen(faces) || !faces.length)
        return false;
    for (let i = 0; i < faces.length; i++) {
        const face = fixedOwnValue(faces, String(i));
        if (!face || typeof face !== 'object' || !Object.isFrozen(face))
            return false;
        const surface = fixedOwnValue(face, 'surface');
        if (!surface || typeof surface !== 'object' || !Object.isFrozen(surface) || fixedOwnValue(surface, 'kind') !== 'surface'
            || fixedOwnValue(surface, 'degreeU') !== 1 || fixedOwnValue(surface, 'degreeV') !== 1)
            return false;
        const u = fixedOwnValue(surface, 'knotsU'), v = fixedOwnValue(surface, 'knotsV');
        if (!Array.isArray(u) || !Array.isArray(v) || !Object.isFrozen(u) || !Object.isFrozen(v) || u.length !== 4 || v.length !== 4)
            return false;
    }
    // A valid degree1 graph needs >=5 knots on one axis; immutable4+4 prevents this proof's family forever.
    permanentlyIneligible.add(brep);
    return true;
}
/** Before caches/fallbacks/export: immutable producer exclusion or CURRENT mutable eligibility, never stale identity. */
export function assertBoundaryBindings(brep) {
    if (permanentlyIneligible.has(brep))
        return;
    // Current fields are read on EVERY call: a cached negative classification would hide plane-to-graph mutation.
    // Keep the common 2x2 case in this hot loop, without per-face proof/graph function dispatch.
    const faces = brep.faces;
    for (let i = 0; i < faces.length; i++) {
        const face = faces[i], s = face.surface;
        if (s.kind !== 'surface')
            continue;
        const points = s.controlPoints;
        if (!Array.isArray(points) || !Array.isArray(points[0]))
            continue;
        if (points.length < 3 && points[0].length < 3)
            continue;
        if (!(s.degreeU === 1 && points.length >= 3) && !(s.degreeV === 1 && points[0].length >= 3))
            continue;
        const contradiction = faceBoundaryContradiction(brep, face);
        if (contradiction)
            throw kernelRefusal(SOURCE, 'GEOMETRY', `B-rep: geometry: ${contradiction}`);
    }
}
