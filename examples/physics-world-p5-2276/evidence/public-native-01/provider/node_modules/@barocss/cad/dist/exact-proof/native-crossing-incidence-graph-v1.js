import { planExactStraightEdgeCrossingSplitV1 } from './exact-straight-edge-split-plan-v1.js';
const copyRational = (r) => Object.freeze({ numerator: r.numerator, denominator: r.denominator });
const copyPoint = (p) => Object.freeze({ x: copyRational(p.x), y: copyRational(p.y) });
const key = (p) => [p.x.numerator, p.x.denominator, p.y.numerator, p.y.denominator].join('/');
/**
 * Five-vertex, four-edge incidence graph for exactly two crossing straight edges.
 * No B-Rep loops, shells, sewing, or vertex tolerance equivalence is asserted.
 */
export function constructNativeCrossingIncidenceGraphV1(firstId, a, b, secondId, c, d, maxAbsCoordinateMM = 10000) {
    const plan = planExactStraightEdgeCrossingSplitV1(firstId, a, b, secondId, c, d, maxAbsCoordinateMM);
    if (plan.status !== 'exact')
        return plan;
    const [e0, e1, e2, e3] = plan.subedges;
    const ends = [e0.startMM, e1.endMM, e2.startMM, e3.endMM];
    if (new Set([...ends, plan.intersectionMM].map(key)).size !== 5)
        return { status: 'refused', reason: 'non-distinct-exact-vertices' };
    const vertexIds = ['first-start', 'first-end', 'second-start', 'second-end'];
    const edgeIds = ['first-before', 'first-after', 'second-before', 'second-after'];
    const vertices = ends.map((p, i) => ({
        id: vertexIds[i], pointMM: copyPoint(p), incidentEdgeIds: Object.freeze([edgeIds[i]]),
    }));
    vertices.push({ id: 'crossing', pointMM: copyPoint(plan.intersectionMM), incidentEdgeIds: Object.freeze([...edgeIds]) });
    const topology = [
        [e0, vertexIds[0], 'crossing'],
        [e1, 'crossing', vertexIds[1]],
        [e2, vertexIds[2], 'crossing'],
        [e3, 'crossing', vertexIds[3]],
    ];
    const edges = topology.map(([e, startVertexId, endVertexId], i) => Object.freeze({
        id: edgeIds[i], parentEdgeId: e.parentEdgeId, startVertexId, endVertexId,
        startParameter: copyRational(e.startParameter), endParameter: copyRational(e.endParameter),
    }));
    return Object.freeze({ status: 'exact', vertices: Object.freeze(vertices.map(v => Object.freeze(v))),
        edges: Object.freeze(edges), crossingVertexId: 'crossing' });
}
