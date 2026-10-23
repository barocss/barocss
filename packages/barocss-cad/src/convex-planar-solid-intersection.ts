import { qualifyConvexPlanarSolid, validateConvexPlanarSolid } from './convex-planar-solid.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidAsset, ConvexPlanarSolidEdgePair, ConvexPlanarSolidReport } from './convex-planar-solid.js';
import { buildConvexPlanarFace } from './own-convex-planar-face.js';
import type { Curve, Point } from './types.js';
import type { ExactPoint, ExactPointData } from './convex-planar-solid-proof-internal.js';
import type { SectionFraction, SectionRational } from './section-rational-internal.js';
import { SolidProof, IntersectionLedger, INTERSECTION_LIMITS, demand, fields, identity, same, at } from './planar-solids/convex-planar-solid-intersection-internal.js';
export { ConvexPlanarSolidIntersectionError } from './planar-solids/convex-planar-solid-intersection-internal.js';
export type { IntersectionCode as ConvexPlanarSolidIntersectionDiagnosticCode } from './planar-solids/convex-planar-solid-intersection-internal.js';

export interface ConvexPlanarSolidIntersectionOptions { operationId: string; solidId: string; resultIdPrefix: string }
export interface ConvexPlanarSolidIntersectionSource { operand: 'left' | 'right'; sourceId: string; faceId: string; surfaceId: string; loopId: string }
export interface ConvexPlanarSolidIntersectionNode { key: string; exactPointMM: ExactPointData; supports: ConvexPlanarSolidIntersectionSource[] }
export interface ConvexPlanarSolidIntersectionEdgeOrigin extends ConvexPlanarSolidIntersectionSource { edgeId: string; useId: string; curveId: string; pcurveId: string; domain: [number, number]; sourceInterval: [SectionFraction, SectionFraction] }
export interface ConvexPlanarSolidIntersectionFace {
  key: string; sources: ConvexPlanarSolidIntersectionSource[];
  output: { sourceId: string; faceId: string; surfaceId: string; loopId: string };
  edges: { useId: string; nodeKeys: [string, string]; originalEdges: ConvexPlanarSolidIntersectionEdgeOrigin[]; supportingSources: ConvexPlanarSolidIntersectionSource[] }[];
}
export interface ConvexPlanarSolidIntersectionReport {
  schema: 'barocss-convex-planar-solid-intersection'; version: 0; operationId: string;
  status: 'solid' | 'empty'; contactDimension: -1 | 0 | 1 | 2 | 3;
  boundaryProof: 'all-original-facets-clipped-by-all-opposite-halfspaces-complete-coplanar-coverage';
  nativeWork: { parentReconstructions: 2; outputQualifications: number; completeFaceReconstructions: number; newFaceConstructions: number; faceCompilations: number; sourceCompilations: number; bindingObservations: number; totalD1: number; retries: 0; scope: 'direct-calls-and-known-parent-loops-not-provider-internals' };
  clipWork: { facetPlanePasses: number; classifications: number; crossings: number; candidateRecords: number; maximumPolygonVertices: number; temporaryNonDyadicCrossings: number };
  exactWork: { root: ReturnType<SolidProof['rational']['counts']>; qualifiers: ConvexPlanarSolidReport['exactWork'][]; contextCount: number; aggregateOperations: number; aggregateGcdSteps: number; maximumObservedBits: number };
  limits: typeof INTERSECTION_LIMITS; validationScope: 'whole-result-self-consistency-not-authenticity'; numericPolicy: 'exact-stored-binary64-native-admission-no-welding'; persistentNamingCertified: false;
  memoryAccounting: 'root-signed-json-occurrences-plus-unchanged-child-ledgers-not-heap';
}
export interface ConvexPlanarSolidIntersectionResult {
  request: { left: ConvexPlanarSolidResult; right: ConvexPlanarSolidResult; options: ConvexPlanarSolidIntersectionOptions };
  outcome: { kind: 'solid'; solid: ConvexPlanarSolidResult } | { kind: 'empty' };
  contact: { dimension: -1 | 0 | 1 | 2 | 3; nodes: ConvexPlanarSolidIntersectionNode[] };
  lineage: { nodes: ConvexPlanarSolidIntersectionNode[]; faces: ConvexPlanarSolidIntersectionFace[]; discardedSources: ConvexPlanarSolidIntersectionSource[] };
  report: ConvexPlanarSolidIntersectionReport;
}
type Facet = { source: ConvexPlanarSolidIntersectionSource; asset: ConvexPlanarSolidAsset; normal: ExactPoint; origin: ExactPoint; plane: SectionRational[]; polygon: ExactPoint[]; operand: number };
const sourceKey = (s: ConvexPlanarSolidIntersectionSource) => [s.operand, s.sourceId, s.faceId, s.surfaceId, s.loopId].join('|');
const equal = (a: ExactPoint, b: ExactPoint) => a.every((v, i) => v.n === b[i].n && v.d === b[i].d);
const array = (v: unknown, min: number, max: number): unknown[] => { demand(Array.isArray(v) && v.length >= min && v.length <= max, 'BUDGET', 'Bounded inventory required'); return v; };
function build(request: ConvexPlanarSolidIntersectionResult['request'], ledger: IntersectionLedger): ConvexPlanarSolidIntersectionResult {
  fields(request, ['left', 'right', 'options']); fields(request.options, ['operationId', 'solidId', 'resultIdPrefix']);
  const { options } = request, { operationId, resultIdPrefix: prefix } = options;
  identity(operationId); identity(options.solidId); identity(prefix, 10); demand(operationId !== options.solidId, 'IDENTITY', 'Distinct operation/output Solid identities required');
  const parents = [request.left, request.right]; let parentUses = 0;
  for (const parent of parents) {
    fields(parent, ['request', 'graph', 'supports', 'certificate', 'report']); fields(parent.request, ['assets', 'edgePairs', 'options']);
    const assets = array(parent.request.assets, 4, 12) as ConvexPlanarSolidAsset[]; let uses = 0;
    for (const asset of assets) { fields(asset, ['sourceId', 'face']); uses += array(asset.face?.loop?.edges, 3, 8).length; }
    demand(uses <= 64, 'BUDGET', 'Parent use ceiling exceeded before native calls'); parentUses += uses;
    fields(parent.graph, ['vertices', 'edges', 'faces', 'vertexLinks']); array(parent.graph.vertices, 4, 32); array(parent.graph.edges, 6, 32); array(parent.graph.faces, 4, 12);
  }
  // Both complete snapshots and inventories are admitted before either native reconstruction.
  const parentReports = parents.map((parent, i) => at('parent-reconstruction', i ? 'right' : 'left', () => validateConvexPlanarSolid(parent)));
  const proof = new SolidProof(), r = proof.rational, zero = r.integer(0), one = r.integer(1);
  const dot = (a: ExactPoint, b: ExactPoint) => r.sum(a.flatMap((v, i) => v.n && b[i].n ? [r.mul(v, b[i])] : []));
  const fromText = (p: ExactPointData) => p.map(v => r.rat(BigInt(v.numerator), BigInt(v.denominator))) as ExactPoint;
  const distance = (facet: Facet, p: ExactPoint) => r.sub(dot(facet.normal, p), dot(facet.normal, facet.origin));
  const work = { facetPlanePasses: 0, classifications: 0, crossings: 0, candidateRecords: 0, maximumPolygonVertices: 0, temporaryNonDyadicCrossings: 0 };
  const facets: Facet[] = parents.flatMap((parent, operand) => parent.graph.faces.map((face, i) => {
    const support = parent.supports[i], normal = fromText(support.outwardNormal), origin = fromText(support.originMM), pivot = normal.find(v => v.n !== 0n)!;
    const scale = r.abs(pivot), plane = [...normal, dot(normal, origin)].map(v => r.div(v, scale));
    const polygon = face.vertexIds.map(id => proof.point(parent.graph.vertices.find(v => v.id === id)!.pointMM));
    work.candidateRecords += polygon.length; work.maximumPolygonVertices = Math.max(work.maximumPolygonVertices, polygon.length);
    return { source: { operand: operand === 0 ? 'left' : 'right', sourceId: face.sourceId, faceId: face.faceId, surfaceId: face.surfaceId, loopId: face.loopId }, asset: parent.request.assets[i], normal, origin, plane, polygon, operand };
  }));
  const compact = (polygon: ExactPoint[]) => polygon.filter((p, i) => !polygon.slice(0, i).some(q => equal(p, q)));
  for (const facet of facets) {
    let polygon = facet.polygon;
    for (const cutter of facets.filter(f => f.operand !== facet.operand)) {
      demand(++work.facetPlanePasses <= 288, 'BUDGET', 'Facet-plane pass ceiling exceeded');
      const values = polygon.map(p => { demand(++work.classifications <= 5760, 'BUDGET', 'Clip classification ceiling exceeded'); return distance(cutter, p); });
      const clipped: ExactPoint[] = [];
      for (let i = 0; i < polygon.length; i++) {
        const j = (i + 1) % polygon.length, a = values[i], b = values[j]; if (a.n <= 0n) clipped.push(polygon[i]);
        if (a.n < 0n && b.n > 0n || a.n > 0n && b.n < 0n) {
          demand(++work.crossings <= 576 && ++work.candidateRecords <= 768, 'BUDGET', 'Crossing/candidate ceiling exceeded');
          const t = r.div(a, r.sub(a, b)), point = proof.add(polygon[i], proof.scale(proof.sub(polygon[j], polygon[i]), t));
          if (point.some(v => (v.d & (v.d - 1n)) !== 0n)) work.temporaryNonDyadicCrossings++;
          clipped.push(point);
        }
      }
      polygon = compact(clipped); work.maximumPolygonVertices = Math.max(work.maximumPolygonVertices, polygon.length);
      demand(polygon.length <= 20, 'BUDGET', 'Temporary polygon vertex ceiling exceeded');
    }
    // Convex clipping can leave exact collinear corners, including collapsed contact rings.
    let changed = true;
    while (changed && polygon.length > 2) {
      changed = false;
      for (let i = 0; i < polygon.length; i++) {
        const before = polygon[(i + polygon.length - 1) % polygon.length], after = polygon[(i + 1) % polygon.length];
        if (!proof.cross(proof.sub(polygon[i], before), proof.sub(after, polygon[i])).some(v => v.n !== 0n) && dot(proof.sub(polygon[i], before), proof.sub(after, polygon[i])).n >= 0n) {
          polygon.splice(i, 1); changed = true; break;
        }
      }
    }
    facet.polygon = polygon;
  }
  // Retain degenerate clipped polygons until the affine rank of their complete union is known.
  const points = compact(facets.flatMap(f => f.polygon));
  const rank = (): -1 | 0 | 1 | 2 | 3 => {
    if (!points.length) return -1; if (points.length === 1) return 0;
    const dirs = points.slice(1).map(p => proof.sub(p, points[0])), first = dirs[0];
    const normal = dirs.map(p => proof.cross(first, p)).find(p => p.some(v => v.n !== 0n));
    return !normal ? 1 : dirs.some(p => dot(normal, p).n !== 0n) ? 3 : 2;
  };
  const dimension = rank();
  const nodes = points.map(point => {
    const supports = facets.filter(f => distance(f, point).n === 0n).map(f => f.source);
    demand(supports.length >= 3, 'INCIDENCE', 'Intersection vertex lacks complete original supporting incidence');
    return { key: [operationId, 'vertex', ...supports.map(sourceKey).sort()].join('|'), exactPointMM: proof.text(point), supports };
  });
  demand(new Set(nodes.map(n => n.key)).size === nodes.length, 'INCIDENCE', 'Distinct exact vertices have ambiguous support incidence');
  const pointIndex = (p: ExactPoint) => { const i = points.findIndex(q => equal(p, q)); demand(i >= 0, 'INCIDENCE', 'Final vertex missing'); return i; };
  const nodeKey = (p: ExactPoint) => nodes[pointIndex(p)].key;
  // A same-oriented plane is normalized by its first nonzero normal magnitude; no tolerance or coordinate hash.
  const planeEqual = (a: Facet, b: Facet) => a.plane.every((v, i) => v.n === b.plane[i].n && v.d === b.plane[i].d);
  const area = (p: ExactPoint[]) => p.reduce((sum, v, i) => proof.add(sum, proof.cross(v, p[(i + 1) % p.length])), proof.point([0, 0, 0]));
  const plans: { facet: Facet; sources: ConvexPlanarSolidIntersectionSource[]; polygon: ExactPoint[] }[] = [];
  if (dimension === 3) for (const facet of facets) {
    const polygon = facet.polygon; if (polygon.length < 3 || !area(polygon).some(v => v.n !== 0n)) continue;
    const existing = plans.find(p => planeEqual(p.facet, facet));
    if (existing) {
      demand(polygon.length === existing.polygon.length && polygon.every(p => existing.polygon.some(q => equal(p, q))), 'BINDING', 'Coincident supports lack identical complete final coverage');
      existing.sources.push(facet.source);
    } else plans.push({ facet, sources: [facet.source], polygon });
  }
  const outputUses = plans.reduce((n, p) => n + p.polygon.length, 0);
  if (dimension === 3) demand(plans.length >= 4 && plans.length <= 12 && plans.every(p => p.polygon.length <= 8) && outputUses <= 64 && outputUses % 2 === 0 && points.length <= 32 && outputUses - 2 * plans.length <= 40, 'BUDGET', 'Final inventory exceeds unchanged native qualifier');
  const inputFaces = facets.length, faceCompilations = inputFaces + 2 * plans.length;
  demand(faceCompilations <= 48 && (parentUses + 2 * outputUses) * 3 <= 768, 'BUDGET', 'Native construction reserve exceeded');
  const finalPoints = dimension === 3 ? points.map((p, i) => at('final-representability', nodes[i].key, () => p.map(v => r.exactFloat(v)) as Point)) : [];
  for (const [i, plan] of plans.entries()) {
    const p = prefix + '_f' + i, f = plan.facet.asset.face;
    const ids = [f.plane.id, f.loop.id, f.options.faceId, p + '_model', ...plan.polygon.flatMap((_, j) => [p + '_c' + j, p + '_v_' + j, p + '_e_' + j, p + '_use_' + j, p + '_uv_' + j])];
    demand(new Set(ids).size === ids.length && !facets.some(a => a.source.sourceId === p), 'IDENTITY', 'Generated namespace/context identities collide with original data');
  }
  const faces: ConvexPlanarSolidIntersectionFace[] = [], assets: ConvexPlanarSolidAsset[] = [], pairing: { sourceId: string; useId: string; nodes: [string, string] }[] = [];
  const originalEdges = facets.flatMap(f => f.asset.face.topology.loop.uses.map(use => {
    const native = f.asset.face, line = native.loop.edges.find(c => c.id === use.curveId)!;
    const parentEdge = parents[f.operand].graph.edges.find(e => e.uses.some(u => u.sourceId === f.source.sourceId && u.use.id === use.id))!;
    const supports = parentEdge.uses.map(u => facets.find(g => g.operand === f.operand && g.source.sourceId === u.sourceId && g.source.faceId === u.faceId)!.source);
    const start = proof.point(native.topology.vertices.find(v => v.id === use.vertexIds[0])!.point), end = proof.point(native.topology.vertices.find(v => v.id === use.vertexIds[1])!.point), d = proof.sub(end, start);
    return { f, use, line, supports, start, d, axis: d.findIndex(v => v.n !== 0n) };
  }));
  const originCache = new Map<string, ConvexPlanarSolidIntersectionEdgeOrigin[]>();
  const edgeOrigins = (a: ExactPoint, b: ExactPoint): ConvexPlanarSolidIntersectionEdgeOrigin[] => {
    const ai = pointIndex(a), bi = pointIndex(b), cacheKey = ai + ':' + bi, cached = originCache.get(cacheKey); if (cached) return cached;
    const reversed = originCache.get(bi + ':' + ai); if (reversed) return reversed.map(o => ({ ...o, sourceInterval: [o.sourceInterval[1], o.sourceInterval[0]] }));
    const origins = originalEdges.flatMap(({ f, use, line, supports, start, d, axis }) => {
      if (!supports.every(s => nodes[ai].supports.includes(s) && nodes[bi].supports.includes(s))) return [];
      const parameter = (p: ExactPoint) => { const t = r.div(r.sub(p[axis], start[axis]), d[axis]); return r.compare(t, zero) < 0 || r.compare(t, one) > 0 || !equal(proof.add(start, proof.scale(d, t)), p) ? null : r.add(r.from(use.interval[0]), r.mul(t, r.sub(r.from(use.interval[1]), r.from(use.interval[0])))); };
      const ta = parameter(a), tb = parameter(b); if (!ta || !tb) return [];
      return [{ ...f.source, edgeId: use.edgeId, useId: use.id, curveId: use.curveId, pcurveId: use.pcurveId, domain: [line.knots[1], line.knots[2]] as [number, number], sourceInterval: [r.text(ta), r.text(tb)] as [SectionFraction, SectionFraction] }];
    });
    originCache.set(cacheKey, origins); return origins;
  };
  for (const [i, plan] of plans.entries()) {
    const p = prefix + '_f' + i, original = plan.facet.asset.face;
    const lines: Curve[] = plan.polygon.map((point, j) => ({ kind: 'curve', id: p + '_c' + j, degree: 1, knots: [0, 0, 1, 1], weights: [1, 1], controlPoints: [finalPoints[pointIndex(point)], finalPoints[pointIndex(plan.polygon[(j + 1) % plan.polygon.length])]] }));
    const native = at('face-construction', p, () => buildConvexPlanarFace(original.plane, { id: original.loop.id, edges: lines }, { faceId: original.options.faceId, evaluationId: p + '_model', resultIdPrefix: p, orientation: original.options.orientation }));
    assets.push({ sourceId: p, face: native });
    const edges = native.topology.loop.uses.map(use => {
      const j = lines.findIndex(c => c.id === use.curveId), a = plan.polygon[use.sense === 'forward' ? j : (j + 1) % lines.length], b = plan.polygon[use.sense === 'forward' ? (j + 1) % lines.length : j];
      const nodeKeys: [string, string] = [nodeKey(a), nodeKey(b)]; pairing.push({ sourceId: p, useId: use.id, nodes: nodeKeys });
      return { useId: use.id, nodeKeys, originalEdges: edgeOrigins(a, b), supportingSources: nodes[pointIndex(a)].supports.filter(s => nodes[pointIndex(b)].supports.includes(s)) };
    });
    faces.push({ key: [operationId, 'facet', ...plan.sources.map(sourceKey).sort()].join('|'), sources: plan.sources, output: { sourceId: p, faceId: native.options.faceId, surfaceId: native.plane.id, loopId: native.loop.id }, edges });
  }
  const consumed = new Set<number>(), pairs: ConvexPlanarSolidEdgePair[] = [];
  for (const [i, a] of pairing.entries()) if (!consumed.has(i)) {
    const matches = pairing.flatMap((b, j) => j !== i && !consumed.has(j) && a.nodes[0] === b.nodes[1] && a.nodes[1] === b.nodes[0] ? [j] : []);
    demand(matches.length === 1, 'INCIDENCE', 'Exactly two opposite support-incidence edge uses required'); const j = matches[0], b = pairing[j]; consumed.add(i); consumed.add(j); pairs.push({ a: { sourceId: a.sourceId, useId: a.useId }, b: { sourceId: b.sourceId, useId: b.useId } });
  }
  let outcome: ConvexPlanarSolidIntersectionResult['outcome'] = { kind: 'empty' };
  const qualifiers = parentReports.map(p => p.exactWork);
  if (dimension === 3) {
    const solid = at('output-qualification', options.solidId, () => qualifyConvexPlanarSolid(assets, pairs, { solidId: options.solidId, resultIdPrefix: prefix }));
    ledger.copy(solid, true, true, true); qualifiers.push(solid.report.exactWork); outcome = { kind: 'solid', solid };
  }
  const root = r.counts(), aggregateOperations = root.operations + qualifiers.reduce((n, q) => n + q.operations, 0), aggregateGcdSteps = root.gcdSteps + qualifiers.reduce((n, q) => n + q.gcdSteps, 0);
  demand(aggregateOperations <= 800000 && aggregateGcdSteps <= 800000, 'BUDGET', 'Aggregate rational work ceiling exceeded');
  const report: ConvexPlanarSolidIntersectionReport = {
    schema: 'barocss-convex-planar-solid-intersection', version: 0, operationId, status: outcome.kind, contactDimension: dimension,
    boundaryProof: 'all-original-facets-clipped-by-all-opposite-halfspaces-complete-coplanar-coverage',
    nativeWork: { parentReconstructions: 2, outputQualifications: outcome.kind === 'solid' ? 1 : 0, completeFaceReconstructions: inputFaces + plans.length, newFaceConstructions: plans.length, faceCompilations, sourceCompilations: faceCompilations, bindingObservations: (parentUses + 2 * outputUses) * 3, totalD1: (parentUses + 2 * outputUses) * 9, retries: 0, scope: 'direct-calls-and-known-parent-loops-not-provider-internals' },
    clipWork: work, exactWork: { root, qualifiers, contextCount: qualifiers.length + 1, aggregateOperations, aggregateGcdSteps, maximumObservedBits: Math.max(root.maximumObservedBits, ...qualifiers.map(q => q.maximumObservedBits)) }, limits: INTERSECTION_LIMITS,
    validationScope: 'whole-result-self-consistency-not-authenticity', numericPolicy: 'exact-stored-binary64-native-admission-no-welding', persistentNamingCertified: false, memoryAccounting: 'root-signed-json-occurrences-plus-unchanged-child-ledgers-not-heap',
  };
  return { request, outcome, contact: { dimension, nodes: dimension < 3 ? nodes : [] }, lineage: { nodes, faces, discardedSources: facets.filter(f => !plans.some(p => p.sources.includes(f.source))).map(f => f.source) }, report };
}
/** Intersect occupied convex planar material, constructing only final native facets. */
export function intersectConvexPlanarSolids(left: ConvexPlanarSolidResult, right: ConvexPlanarSolidResult, options: ConvexPlanarSolidIntersectionOptions): ConvexPlanarSolidIntersectionResult {
  return at('intersection', 'request', () => { const ledger = new IntersectionLedger(), request = ledger.copy({ left, right, options }), result = build(request, ledger); ledger.copy(result, true, true, true); return ledger.copy(result, true); });
}
/** Reconstruct complete operands, result, contact, lineage, proof and work report once. */
export function validateConvexPlanarSolidIntersection(input: ConvexPlanarSolidIntersectionResult): ConvexPlanarSolidIntersectionReport {
  return at('validation', 'result', () => { const ledger = new IntersectionLedger(), owned = ledger.copy(input, true); fields(owned, ['request', 'outcome', 'contact', 'lineage', 'report']); const expected = build(ledger.copy(owned.request), ledger); ledger.copy(expected, true, true, true); demand(same(owned, expected), 'OWNED', 'Complete intersection differs from reconstruction'); return ledger.copy(expected.report, true); });
}
