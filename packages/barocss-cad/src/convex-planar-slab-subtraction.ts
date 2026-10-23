import { qualifyConvexPlanarSolid, validateConvexPlanarSolid } from './convex-planar-solid.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidAsset, ConvexPlanarSolidEdgePair, ConvexPlanarSolidReport } from './convex-planar-solid.js';
import { buildConvexPlanarFace } from './own-convex-planar-face.js';
import type { Curve, Point } from './types.js';
import type { ExactPoint, ExactPointData } from './convex-planar-solid-proof-internal.js';
import type { SectionFraction, SectionRational } from './section-rational-internal.js';
import { SolidProof, SlabSubtractionLedger, SLAB_LIMITS, demand, fields, identity, same, at } from './planar-solids/convex-planar-slab-subtraction-internal.js';
export { ConvexPlanarSlabSubtractionError } from './planar-solids/convex-planar-slab-subtraction-internal.js';
export type { SlabSubtractionCode as ConvexPlanarSlabSubtractionDiagnosticCode } from './planar-solids/convex-planar-slab-subtraction-internal.js';

export interface ConvexPlanarSlabFaceReference { sourceId: string; faceId: string }
export interface ConvexPlanarSlabSubtractionOptions {
  operationId: string;
  first: { toolFace: ConvexPlanarSlabFaceReference; solidId: string; resultIdPrefix: string };
  second: { toolFace: ConvexPlanarSlabFaceReference; solidId: string; resultIdPrefix: string };
}
export interface ConvexPlanarSlabSubtractionSource { operand: 'parent' | 'tool'; sourceId: string; faceId: string; surfaceId: string; loopId: string }
export interface ConvexPlanarSlabSubtractionNode { key: string; exactPointMM: ExactPointData; supports: ConvexPlanarSlabSubtractionSource[] }
export interface ConvexPlanarSlabSubtractionEdgeOrigin extends ConvexPlanarSlabSubtractionSource { edgeId: string; useId: string; curveId: string; pcurveId: string; domain: [number, number]; sourceInterval: [SectionFraction, SectionFraction] }
export interface ConvexPlanarSlabSubtractionFace {
  key: string; sources: ConvexPlanarSlabSubtractionSource[];
  output: { sourceId: string; faceId: string; surfaceId: string; loopId: string };
  edges: { useId: string; nodeKeys: [string, string]; originalEdges: ConvexPlanarSlabSubtractionEdgeOrigin[]; supportingSources: ConvexPlanarSlabSubtractionSource[] }[];
}
export type ConvexPlanarSlabSubtractionOutcome = { kind: 'solid'; solid: ConvexPlanarSolidResult } | { kind: 'empty' };
export interface ConvexPlanarSlabSubtractionComponent {
  role: 'first' | 'second'; selectedToolFace: ConvexPlanarSlabSubtractionSource; outcome: ConvexPlanarSlabSubtractionOutcome;
  affineDimension: -1 | 0 | 1 | 2 | 3;
  lineage: { nodes: ConvexPlanarSlabSubtractionNode[]; faces: ConvexPlanarSlabSubtractionFace[]; discardedSources: ConvexPlanarSlabSubtractionSource[] };
}
export interface ConvexPlanarSlabSubtractionReport {
  schema: 'barocss-convex-planar-slab-subtraction'; version: 0; operationId: string; componentCount: number;
  boundaryProof: 'complete-parent-facets-outside-selected-support-plus-reversed-finite-tool-cap';
  nativeWork: { parentReconstructions: 2; outputQualifications: number; completeFaceReconstructions: number; newFaceConstructions: number; faceCompilations: number; sourceCompilations: number; bindingObservations: number; totalD1: number; retries: 0; scope: 'direct-calls-and-known-parent-loops-not-provider-internals' };
  clipWork: { facetPlanePasses: number; classifications: number; crossings: number; candidateRecords: number; maximumPolygonVertices: number; temporaryNonDyadicCrossings: number; coveragePredicates: number };
  exactWork: { root: ReturnType<SolidProof['rational']['counts']>; qualifiers: ConvexPlanarSolidReport['exactWork'][]; contextCount: number; aggregateOperations: number; aggregateGcdSteps: number; maximumObservedBits: number };
  volumeMM3: { parent: SectionFraction; first: SectionFraction; second: SectionFraction; remaining: SectionFraction; removed: SectionFraction };
  limits: typeof SLAB_LIMITS; validationScope: 'whole-result-self-consistency-not-authenticity'; numericPolicy: 'exact-stored-binary64-native-admission-no-welding'; persistentNamingCertified: false;
  memoryAccounting: 'root-signed-json-occurrences-plus-unchanged-child-ledgers-not-heap';
}
export interface ConvexPlanarSlabSubtractionResult {
  request: { parent: ConvexPlanarSolidResult; tool: ConvexPlanarSolidResult; options: ConvexPlanarSlabSubtractionOptions };
  first: ConvexPlanarSlabSubtractionComponent; second: ConvexPlanarSlabSubtractionComponent;
  materialProof: {
    semantics: 'closure-of-interior-parent-minus-tool'; selected: [ConvexPlanarSlabSubtractionSource, ConvexPlanarSlabSubtractionSource];
    normalizedFirstNormal: ExactPointData; firstOffset: SectionFraction; secondOffsetInFirstDirection: SectionFraction; positiveOffsetGap: SectionFraction;
    coverage: { source: ConvexPlanarSlabSubtractionSource; maximumParentSignedDistance: SectionFraction }[];
    equality: 'within-parent-tool-equals-selected-closed-slab'; separation: 'positive-width-gap-between-fixed-outside-components';
  };
  report: ConvexPlanarSlabSubtractionReport;
}
type Facet = { source: ConvexPlanarSlabSubtractionSource; asset: ConvexPlanarSolidAsset; normal: ExactPoint; origin: ExactPoint; plane: SectionRational[]; polygon: ExactPoint[]; operand: number; orientation: 'forward' | 'reverse' };
type Plan = { facet: Facet; sources: ConvexPlanarSlabSubtractionSource[]; polygon: ExactPoint[] };
const sourceKey = (s: ConvexPlanarSlabSubtractionSource) => [s.operand, s.sourceId, s.faceId, s.surfaceId, s.loopId].join('|');
const equal = (a: ExactPoint, b: ExactPoint) => a.every((v, i) => v.n === b[i].n && v.d === b[i].d);
const array = (v: unknown, min: number, max: number): unknown[] => { demand(Array.isArray(v) && v.length >= min && v.length <= max, 'BUDGET', 'Bounded inventory required'); return v; };
function build(request: ConvexPlanarSlabSubtractionResult['request'], ledger: SlabSubtractionLedger): ConvexPlanarSlabSubtractionResult {
  fields(request, ['parent', 'tool', 'options']); fields(request.options, ['operationId', 'first', 'second']);
  const { options } = request, { operationId } = options;
  identity(operationId);
  for (const o of [options.first, options.second]) { fields(o, ['toolFace', 'solidId', 'resultIdPrefix']); fields(o.toolFace, ['sourceId', 'faceId']); identity(o.toolFace.sourceId); identity(o.toolFace.faceId); identity(o.solidId); identity(o.resultIdPrefix, 10); }
  demand(new Set([operationId, options.first.solidId, options.second.solidId]).size === 3 && options.first.resultIdPrefix !== options.second.resultIdPrefix, 'IDENTITY', 'Distinct operation/output Solid identities and component prefixes required');
  const parents = [request.parent, request.tool]; let parentUses = 0;
  for (const parent of parents) {
    fields(parent, ['request', 'graph', 'supports', 'certificate', 'report']); fields(parent.request, ['assets', 'edgePairs', 'options']);
    const assets = array(parent.request.assets, 4, 12) as ConvexPlanarSolidAsset[]; let uses = 0;
    for (const asset of assets) { fields(asset, ['sourceId', 'face']); uses += array(asset.face?.loop?.edges, 3, 8).length; }
    demand(uses <= 64, 'BUDGET', 'Parent use ceiling exceeded before native calls'); parentUses += uses;
    fields(parent.graph, ['vertices', 'edges', 'faces', 'vertexLinks']); array(parent.graph.vertices, 4, 32); array(parent.graph.edges, 6, 32); array(parent.graph.faces, 4, 12);
  }
  // Complete snapshots and both bounded inventories precede either native reconstruction.
  const parentReports = parents.map((parent, i) => at('parent-reconstruction', i ? 'tool' : 'parent', () => validateConvexPlanarSolid(parent)));
  const proof = new SolidProof(), r = proof.rational, zero = r.integer(0), one = r.integer(1);
  const dot = (a: ExactPoint, b: ExactPoint) => r.sum(a.flatMap((v, i) => v.n && b[i].n ? [r.mul(v, b[i])] : []));
  const fraction = (v: SectionFraction) => r.rat(BigInt(v.numerator), BigInt(v.denominator));
  const fromText = (p: ExactPointData) => p.map(fraction) as ExactPoint;
  const distance = (facet: Facet, p: ExactPoint) => r.sub(dot(facet.normal, p), dot(facet.normal, facet.origin));
  const work = { facetPlanePasses: 0, classifications: 0, crossings: 0, candidateRecords: 0, maximumPolygonVertices: 0, temporaryNonDyadicCrossings: 0, coveragePredicates: 0 };
  const facets: Facet[] = parents.flatMap((parent, operand) => parent.graph.faces.map((face, i) => {
    const support = parent.supports[i], normal = fromText(support.outwardNormal), origin = fromText(support.originMM), pivot = normal.find(v => v.n !== 0n)!;
    const scale = r.abs(pivot), plane = [...normal, dot(normal, origin)].map(v => r.div(v, scale));
    return { source: { operand: operand === 0 ? 'parent' : 'tool', sourceId: face.sourceId, faceId: face.faceId, surfaceId: face.surfaceId, loopId: face.loopId }, asset: parent.request.assets[i], normal, origin, plane, polygon: face.vertexIds.map(id => proof.point(parent.graph.vertices.find(v => v.id === id)!.pointMM)), operand, orientation: parent.request.assets[i].face.options.orientation };
  }));
  const parentFacets = facets.filter(f => f.operand === 0), toolFacets = facets.filter(f => f.operand === 1);
  const selected = [options.first, options.second].map(o => {
    const found = toolFacets.filter(f => f.source.sourceId === o.toolFace.sourceId && f.source.faceId === o.toolFace.faceId);
    demand(found.length === 1, 'IDENTITY', 'One source-qualified selected tool face required'); return found[0];
  });
  demand(selected[0] !== selected[1], 'IDENTITY', 'Distinct selected tool faces required');
  demand(selected[0].plane.slice(0, 3).every((v, i) => r.add(v, selected[1].plane[i]).n === 0n), 'SLAB', 'Selected outward supports must be exactly antiparallel');
  const gap = r.add(selected[0].plane[3], selected[1].plane[3]);
  demand(gap.n > 0n, 'SLAB', 'Selected supporting planes require strictly positive slab width');
  const parentPoints = request.parent.graph.vertices.map(v => proof.point(v.pointMM));
  const coverage = toolFacets.filter(f => !selected.includes(f)).map(f => {
    let maximum: SectionRational | undefined;
    for (const point of parentPoints) { demand(++work.coveragePredicates <= 320, 'BUDGET', 'Other-tool coverage predicate ceiling exceeded'); const d = distance(f, point); demand(d.n <= 0n, 'SLAB', 'Every other tool halfspace must contain the entire parent'); if (!maximum || r.compare(d, maximum) > 0) maximum = d; }
    return { source: f.source, maximumParentSignedDistance: r.text(maximum!) };
  });
  const materialProof: ConvexPlanarSlabSubtractionResult['materialProof'] = {
    semantics: 'closure-of-interior-parent-minus-tool', selected: [selected[0].source, selected[1].source], normalizedFirstNormal: proof.text(selected[0].plane.slice(0, 3) as ExactPoint), firstOffset: r.text(selected[0].plane[3]), secondOffsetInFirstDirection: r.text(r.neg(selected[1].plane[3])), positiveOffsetGap: r.text(gap), coverage,
    equality: 'within-parent-tool-equals-selected-closed-slab', separation: 'positive-width-gap-between-fixed-outside-components',
  };
  const compact = (polygon: ExactPoint[]) => polygon.filter((p, i) => !polygon.slice(0, i).some(q => equal(p, q)));
  const area = (p: ExactPoint[]) => p.reduce((sum, v, i) => proof.add(sum, proof.cross(v, p[(i + 1) % p.length])), proof.point([0, 0, 0]));
  const planeEqual = (a: Facet, b: Facet) => a.plane.every((v, i) => v.n === b.plane[i].n && v.d === b.plane[i].d);
  const prepared = selected.map((support, side) => {
    const role = side === 0 ? 'first' as const : 'second' as const, componentOptions = options[role], prefix = componentOptions.resultIdPrefix;
    const cap: Facet = { ...support, normal: support.normal.map(v => r.neg(v)) as ExactPoint, plane: support.plane.map(v => r.neg(v)), orientation: support.orientation === 'forward' ? 'reverse' : 'forward', polygon: [...support.polygon].reverse() };
    const boundary = [...parentFacets.map(f => ({ ...f, polygon: [...f.polygon] })), cap];
    for (const facet of boundary) {
      let polygon = facet.polygon; work.candidateRecords += polygon.length; work.maximumPolygonVertices = Math.max(work.maximumPolygonVertices, polygon.length);
      demand(work.candidateRecords <= 256, 'BUDGET', 'Initial candidate ceiling exceeded');
      for (const cutter of facet === cap ? parentFacets : [cap]) {
        demand(++work.facetPlanePasses <= 48, 'BUDGET', 'Facet-plane pass ceiling exceeded');
        const values = polygon.map(p => { demand(++work.classifications <= 960, 'BUDGET', 'Clip classification ceiling exceeded'); return distance(cutter, p); });
        const clipped: ExactPoint[] = [];
        for (let i = 0; i < polygon.length; i++) {
          const j = (i + 1) % polygon.length, a = values[i], b = values[j]; if (a.n <= 0n) clipped.push(polygon[i]);
          if (a.n < 0n && b.n > 0n || a.n > 0n && b.n < 0n) {
            demand(++work.crossings <= 96 && ++work.candidateRecords <= 256, 'BUDGET', 'Crossing/candidate ceiling exceeded');
            const t = r.div(a, r.sub(a, b)), point = proof.add(polygon[i], proof.scale(proof.sub(polygon[j], polygon[i]), t));
            if (point.some(v => (v.d & (v.d - 1n)) !== 0n)) work.temporaryNonDyadicCrossings++;
            clipped.push(point);
          }
        }
        polygon = compact(clipped); work.maximumPolygonVertices = Math.max(work.maximumPolygonVertices, polygon.length);
        demand(polygon.length <= 20, 'BUDGET', 'Temporary polygon vertex ceiling exceeded');
      }
      let changed = true;
      while (changed && polygon.length > 2) {
        changed = false;
        for (let i = 0; i < polygon.length; i++) {
          const before = polygon[(i + polygon.length - 1) % polygon.length], after = polygon[(i + 1) % polygon.length];
          if (!proof.cross(proof.sub(polygon[i], before), proof.sub(after, polygon[i])).some(v => v.n !== 0n) && dot(proof.sub(polygon[i], before), proof.sub(after, polygon[i])).n >= 0n) { polygon.splice(i, 1); changed = true; break; }
        }
      }
      facet.polygon = polygon;
    }
    const points = compact(boundary.flatMap(f => f.polygon));
    const rank = (): -1 | 0 | 1 | 2 | 3 => {
      if (!points.length) return -1; if (points.length === 1) return 0;
      const dirs = points.slice(1).map(p => proof.sub(p, points[0])), first = dirs[0], normal = dirs.map(p => proof.cross(first, p)).find(p => p.some(v => v.n !== 0n));
      return !normal ? 1 : dirs.some(p => dot(normal, p).n !== 0n) ? 3 : 2;
    };
    const dimension = rank(), nodes = points.map(point => {
      const supports = facets.filter(f => distance(f, point).n === 0n).map(f => f.source);
      demand(supports.length >= 3, 'INCIDENCE', 'Component vertex lacks original supporting incidence');
      return { key: [operationId, role, 'vertex', ...supports.map(sourceKey).sort()].join('|'), exactPointMM: proof.text(point), supports };
    });
    demand(new Set(nodes.map(n => n.key)).size === nodes.length, 'INCIDENCE', 'Distinct exact vertices have ambiguous support incidence');
    const plans: Plan[] = [];
    if (dimension === 3) for (const facet of boundary) {
      const polygon = facet.polygon; if (polygon.length < 3 || !area(polygon).some(v => v.n !== 0n)) continue;
      const existing = plans.find(p => planeEqual(p.facet, facet));
      if (existing) { demand(polygon.length === existing.polygon.length && polygon.every(p => existing.polygon.some(q => equal(p, q))), 'BINDING', 'Coincident supports lack identical complete final coverage'); existing.sources.push(facet.source); }
      else plans.push({ facet, sources: [facet.source], polygon });
    }
    const uses = plans.reduce((n, p) => n + p.polygon.length, 0);
    if (dimension === 3) demand(plans.length >= 4 && plans.length <= 12 && plans.every(p => p.polygon.length <= 8) && uses <= 64 && uses % 2 === 0 && points.length <= 32 && uses - 2 * plans.length <= 40, 'BUDGET', 'Final inventory exceeds unchanged native qualifier');
    const finalPoints = dimension === 3 ? points.map((p, i) => at('final-representability', nodes[i].key, () => p.map(v => r.exactFloat(v)) as Point)) : [];
    for (const [i, plan] of plans.entries()) {
      const p = prefix + '_f' + i, f = plan.facet.asset.face;
      const ids = [f.plane.id, f.loop.id, f.options.faceId, p + '_model', ...plan.polygon.flatMap((_, j) => [p + '_c' + j, p + '_v_' + j, p + '_e_' + j, p + '_use_' + j, p + '_uv_' + j])];
      demand(new Set(ids).size === ids.length && !facets.some(a => a.source.sourceId === p), 'IDENTITY', 'Generated namespace/context identities collide with original data');
    }
    return { role, componentOptions, prefix, support, boundary, points, dimension, nodes, plans, uses, finalPoints };
  });
  const newFaceCount = prepared.reduce((n, p) => n + p.plans.length, 0), outputUses = prepared.reduce((n, p) => n + p.uses, 0), inputFaces = facets.length, faceCompilations = inputFaces + 2 * newFaceCount;
  demand(faceCompilations <= 72 && (parentUses + 2 * outputUses) * 3 <= 1152, 'BUDGET', 'Native construction reserve exceeded');
  const qualifiers = parentReports.map(p => p.exactWork);
  const components = prepared.map(preparation => {
    const { role, componentOptions, prefix, support, boundary, points, dimension, nodes, plans, finalPoints } = preparation;
    const pointIndex = (p: ExactPoint) => { const i = points.findIndex(q => equal(p, q)); demand(i >= 0, 'INCIDENCE', 'Final vertex missing'); return i; };
    const nodeKey = (p: ExactPoint) => nodes[pointIndex(p)].key;
    const faces: ConvexPlanarSlabSubtractionFace[] = [], assets: ConvexPlanarSolidAsset[] = [], pairing: { sourceId: string; useId: string; nodes: [string, string] }[] = [];
  const originalEdges = facets.flatMap(f => f.asset.face.topology.loop.uses.map(use => {
    const native = f.asset.face, line = native.loop.edges.find(c => c.id === use.curveId)!;
    const parentEdge = parents[f.operand].graph.edges.find(e => e.uses.some(u => u.sourceId === f.source.sourceId && u.use.id === use.id))!;
    const supports = parentEdge.uses.map(u => facets.find(g => g.operand === f.operand && g.source.sourceId === u.sourceId && g.source.faceId === u.faceId)!.source);
    const start = proof.point(native.topology.vertices.find(v => v.id === use.vertexIds[0])!.point), end = proof.point(native.topology.vertices.find(v => v.id === use.vertexIds[1])!.point), d = proof.sub(end, start);
    return { f, use, line, supports, start, d, axis: d.findIndex(v => v.n !== 0n) };
  }));
  const originCache = new Map<string, ConvexPlanarSlabSubtractionEdgeOrigin[]>();
  const edgeOrigins = (a: ExactPoint, b: ExactPoint): ConvexPlanarSlabSubtractionEdgeOrigin[] => {
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
    const native = at('face-construction', p, () => buildConvexPlanarFace(original.plane, { id: original.loop.id, edges: lines }, { faceId: original.options.faceId, evaluationId: p + '_model', resultIdPrefix: p, orientation: plan.facet.orientation }));
    assets.push({ sourceId: p, face: native });
    const edges = native.topology.loop.uses.map(use => {
      const j = lines.findIndex(c => c.id === use.curveId), a = plan.polygon[use.sense === 'forward' ? j : (j + 1) % lines.length], b = plan.polygon[use.sense === 'forward' ? (j + 1) % lines.length : j];
      const nodeKeys: [string, string] = [nodeKey(a), nodeKey(b)]; pairing.push({ sourceId: p, useId: use.id, nodes: nodeKeys });
      return { useId: use.id, nodeKeys, originalEdges: edgeOrigins(a, b), supportingSources: nodes[pointIndex(a)].supports.filter(s => nodes[pointIndex(b)].supports.includes(s)) };
    });
    faces.push({ key: [operationId, role, 'facet', ...plan.sources.map(sourceKey).sort()].join('|'), sources: plan.sources, output: { sourceId: p, faceId: native.options.faceId, surfaceId: native.plane.id, loopId: native.loop.id }, edges });
  }
  const consumed = new Set<number>(), pairs: ConvexPlanarSolidEdgePair[] = [];
  for (const [i, a] of pairing.entries()) if (!consumed.has(i)) {
    const matches = pairing.flatMap((b, j) => j !== i && !consumed.has(j) && a.nodes[0] === b.nodes[1] && a.nodes[1] === b.nodes[0] ? [j] : []);
    demand(matches.length === 1, 'INCIDENCE', 'Exactly two opposite support-incidence edge uses required'); const j = matches[0], b = pairing[j]; consumed.add(i); consumed.add(j); pairs.push({ a: { sourceId: a.sourceId, useId: a.useId }, b: { sourceId: b.sourceId, useId: b.useId } });
  }
  let outcome: ConvexPlanarSlabSubtractionOutcome = { kind: 'empty' };
  if (dimension === 3) {
    const solid = at('output-qualification', componentOptions.solidId, () => qualifyConvexPlanarSolid(assets, pairs, { solidId: componentOptions.solidId, resultIdPrefix: prefix }));
    ledger.copy(solid, true, true, true); qualifiers.push(solid.report.exactWork); outcome = { kind: 'solid', solid };
  }
    return { role, selectedToolFace: support.source, outcome, affineDimension: dimension, lineage: { nodes, faces, discardedSources: boundary.filter(f => !plans.some(p => p.sources.includes(f.source))).map(f => f.source) } };
  });
  const [first, second] = components;
  const volume = (component: ConvexPlanarSlabSubtractionComponent) => component.outcome.kind === 'solid' ? fraction(component.outcome.solid.certificate.volumeMM3) : zero;
  const firstVolume = volume(first), secondVolume = volume(second), remaining = r.add(firstVolume, secondVolume), removed = r.sub(fraction(request.parent.certificate.volumeMM3), remaining);
  demand(removed.n >= 0n, 'BINDING', 'Remaining exact volume exceeds parent');
  const volumeMM3 = { parent: request.parent.certificate.volumeMM3, first: r.text(firstVolume), second: r.text(secondVolume), remaining: r.text(remaining), removed: r.text(removed) };
  const root = r.counts(), aggregateOperations = root.operations + qualifiers.reduce((n, q) => n + q.operations, 0), aggregateGcdSteps = root.gcdSteps + qualifiers.reduce((n, q) => n + q.gcdSteps, 0);
  demand(aggregateOperations <= 1000000 && aggregateGcdSteps <= 1000000, 'BUDGET', 'Aggregate rational work ceiling exceeded');
  const componentCount = components.filter(c => c.outcome.kind === 'solid').length;
  const report: ConvexPlanarSlabSubtractionReport = {
    schema: 'barocss-convex-planar-slab-subtraction', version: 0, operationId, componentCount, boundaryProof: 'complete-parent-facets-outside-selected-support-plus-reversed-finite-tool-cap',
    nativeWork: { parentReconstructions: 2, outputQualifications: componentCount, completeFaceReconstructions: inputFaces + newFaceCount, newFaceConstructions: newFaceCount, faceCompilations, sourceCompilations: faceCompilations, bindingObservations: (parentUses + 2 * outputUses) * 3, totalD1: (parentUses + 2 * outputUses) * 9, retries: 0, scope: 'direct-calls-and-known-parent-loops-not-provider-internals' },
    clipWork: work, exactWork: { root, qualifiers, contextCount: qualifiers.length + 1, aggregateOperations, aggregateGcdSteps, maximumObservedBits: Math.max(root.maximumObservedBits, ...qualifiers.map(q => q.maximumObservedBits)) },
    volumeMM3, limits: SLAB_LIMITS,
    validationScope: 'whole-result-self-consistency-not-authenticity', numericPolicy: 'exact-stored-binary64-native-admission-no-welding', persistentNamingCertified: false, memoryAccounting: 'root-signed-json-occurrences-plus-unchanged-child-ledgers-not-heap',
  };
  return { request, first, second, materialProof, report };
}
/** Subtract a positively wide through slab with two caller-selected opposite tool supports. */
export function subtractConvexPlanarSlab(parent: ConvexPlanarSolidResult, tool: ConvexPlanarSolidResult, options: ConvexPlanarSlabSubtractionOptions): ConvexPlanarSlabSubtractionResult {
  return at('slab-subtraction', 'request', () => { const ledger = new SlabSubtractionLedger(), request = ledger.copy({ parent, tool, options }), result = build(request, ledger); ledger.copy(result, true, true, true); return ledger.copy(result, true); });
}
/** Reconstruct complete operands, both fixed outcomes, material proof, lineage and work once. */
export function validateConvexPlanarSlabSubtraction(input: ConvexPlanarSlabSubtractionResult): ConvexPlanarSlabSubtractionReport {
  return at('validation', 'result', () => { const ledger = new SlabSubtractionLedger(), owned = ledger.copy(input, true); fields(owned, ['request', 'first', 'second', 'materialProof', 'report']); const expected = build(ledger.copy(owned.request), ledger); ledger.copy(expected, true, true, true); demand(same(owned, expected), 'OWNED', 'Complete slab subtraction differs from reconstruction'); return ledger.copy(expected.report, true); });
}
