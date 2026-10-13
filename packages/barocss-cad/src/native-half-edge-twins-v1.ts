import type { NativeIncidenceEdgeV1, NativeIncidenceVertexV1, NativeCrossingIncidenceGraphV1 } from './native-crossing-incidence-graph-v1.js';

export interface NativeDirectedHalfEdgeV1 {
  readonly id: string;
  readonly edgeId: string;
  readonly originVertexId: string;
  readonly destinationVertexId: string;
  readonly twinId: string;
}
export type NativeHalfEdgeTwinsV1 =
  | { readonly status: 'exact'; readonly halfEdges: readonly NativeDirectedHalfEdgeV1[] }
  | { readonly status: 'refused'; readonly reason: string };

const own = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x) &&
  (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const ownString = (x: Record<string, unknown>, k: string): x is Record<string, string> =>
  Object.hasOwn(x, k) && Object.getOwnPropertyDescriptor(x, k)?.value !== undefined &&
  typeof Object.getOwnPropertyDescriptor(x, k)?.value === 'string';

/** Incidence-only. Deliberately does not invent next/prev or face loops. */
export function constructNativeHalfEdgeTwinsV1(input: NativeCrossingIncidenceGraphV1): NativeHalfEdgeTwinsV1 {
  if (!own(input) || input.status !== 'exact' ||
      !Array.isArray(input.vertices) || !Array.isArray(input.edges) ||
      input.vertices.length !== 5 || input.edges.length !== 4 ||
      input.crossingVertexId !== 'crossing')
    return { status: 'refused', reason: 'invalid-incidence-graph' };
  const vertices = input.vertices as readonly NativeIncidenceVertexV1[];
  const edges = input.edges as readonly NativeIncidenceEdgeV1[];
  if (vertices.some(v => !own(v) || !ownString(v, 'id') || !Array.isArray(v.incidentEdgeIds) ||
      v.incidentEdgeIds.some(id => typeof id !== 'string')) ||
      edges.some(e => !own(e) || !ownString(e, 'id') || !ownString(e, 'startVertexId') ||
      !ownString(e, 'endVertexId')) ||
      new Set(vertices.map(v => v.id)).size !== 5 ||
      new Set(edges.map(e => e.id)).size !== 4)
    return { status: 'refused', reason: 'invalid-incidence-records' };
  const incidence = new Map(vertices.map(v => [v.id, v.incidentEdgeIds]));
  const degree = new Map(vertices.map(v => [v.id, 0]));
  for (const edge of edges) {
    if (edge.startVertexId === edge.endVertexId ||
        !incidence.has(edge.startVertexId) || !incidence.has(edge.endVertexId))
      return { status: 'refused', reason: 'missing-or-degenerate-edge-endpoints' };
    for (const id of [edge.startVertexId, edge.endVertexId]) {
      if (incidence.get(id)?.filter(x => x === edge.id).length !== 1)
        return { status: 'refused', reason: 'inconsistent-vertex-incidence' };
      degree.set(id, (degree.get(id) ?? 0) + 1);
    }
  }
  if (degree.get('crossing') !== 4 ||
      [...degree].some(([id, n]) => n !== (id === 'crossing' ? 4 : 1)) ||
      vertices.some(v => v.incidentEdgeIds.length !== degree.get(v.id)))
    return { status: 'refused', reason: 'invalid-crossing-valence' };
  const halfEdges: NativeDirectedHalfEdgeV1[] = [];
  for (const edge of edges) {
    const forward = edge.id + ':forward', backward = edge.id + ':backward';
    halfEdges.push(Object.freeze({ id: forward, edgeId: edge.id,
      originVertexId: edge.startVertexId, destinationVertexId: edge.endVertexId, twinId: backward }));
    halfEdges.push(Object.freeze({ id: backward, edgeId: edge.id,
      originVertexId: edge.endVertexId, destinationVertexId: edge.startVertexId, twinId: forward }));
  }
  if (new Set(halfEdges.map(h => h.id)).size !== 8)
    return { status: 'refused', reason: 'duplicate-half-edge-ids' };
  return Object.freeze({ status: 'exact', halfEdges: Object.freeze(halfEdges) });
}
