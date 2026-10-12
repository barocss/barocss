import { qualifyConvexPlanarSolid, validateConvexPlanarSolid } from './convex-planar-solid.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidAsset, ConvexPlanarSolidEdgePair, ConvexPlanarSolidReport, ConvexPlanarSolidGraph } from './convex-planar-solid.js';
import { buildConvexPlanarFace } from './own-convex-planar-face.js';
import { buildAffinePlaneAxes } from './own-affine-plane-loop-internal.js';
import { compileCadModel } from './model-compiler.js';
import type { Model, Surface, Curve, Point } from './types.js';
import type { SectionFraction, SectionRational } from './section-rational-internal.js';
import type { ExactPointData } from './convex-planar-solid-proof-internal.js';
import { SolidProof, SplitLedger, SPLIT_LIMITS, demand, fields, identity, same, at } from './convex-planar-solid-split-internal.js';
export { ConvexPlanarSolidSplitError } from './convex-planar-solid-split-internal.js';
export type { SplitCode as ConvexPlanarSolidSplitDiagnosticCode } from './convex-planar-solid-split-internal.js';

export interface ConvexPlanarSolidCutter { sourceId: string; source: string; sourceVersion: 0; model: Model; surfaceId: string }
export interface ConvexPlanarSolidSplitOptions { operationId: string; resultIdPrefix: string; negativeSolidId: string; positiveSolidId: string }
export type ConvexPlanarSolidSplitOutcome = { kind: 'solid'; solid: ConvexPlanarSolidResult } | { kind: 'empty' };
export interface ConvexPlanarSolidSplitNode {
  key: string; pointMM: Point; exactPointMM: ExactPointData;
  origin: { kind: 'vertex'; parentVertexId: string; members: ConvexPlanarSolidGraph['vertices'][number]['members'] }
    | { kind: 'crossing'; parentEdgeId: string; parameters: { sourceId: string; faceId: string; useId: string; curveId: string; parameter: SectionFraction; domain: [number, number] }[] };
}
export interface ConvexPlanarSolidSplitSegment { key: string; nodeKeys: [string, string]; parentEdgeId: string | null; facets: { sourceId: string; faceId: string }[] }
export interface ConvexPlanarSolidSplitFaceLineage {
  side: 'negative' | 'positive'; role: 'retained' | 'clipped' | 'deleted' | 'cap'; key: string;
  parent: { sourceId: string; faceId: string; surfaceId: string; loopId: string } | null;
  output: { sourceId: string; faceId: string; surfaceId: string; loopId: string } | null;
  edges: { useId: string; edgeId: string; curveId: string; pcurveId: string; nodeKeys: [string, string];
    origin: { kind: 'parent-edge'; parentEdgeId: string; sourceId: string; faceId: string; useId: string; curveId: string; pcurveId: string; domain: [number, number]; sourceInterval: [SectionFraction, SectionFraction] }
      | { kind: 'section'; sectionKey: string } }[];
}
export interface ConvexPlanarSolidSplitReport {
  schema: 'barocss-convex-planar-solid-split'; version: 0; operationId: string;
  status: 'split' | 'outside' | 'tangent'; volumeMM3: { parent: SectionFraction; negative: SectionFraction; positive: SectionFraction; conserved: true };
  nativeWork: { parentReconstructions: 1; outputQualifications: number; completeFaceReconstructions: number; newFaceConstructions: number; faceCompilations: number; cutterCompilations: 1; totalSourceCompilations: number; bindingObservations: number; totalD1: number; retries: 0; scope: 'direct-calls-and-known-parent-loops-not-provider-internals' };
  exactWork: { root: ReturnType<SolidProof['rational']['counts']>; qualifiers: ConvexPlanarSolidReport['exactWork'][]; contextCount: number; aggregateOperations: number; aggregateGcdSteps: number; maximumObservedBits: number };
  limits: typeof SPLIT_LIMITS;
  validationScope: 'whole-result-self-consistency-not-authenticity'; numericPolicy: 'exact-stored-binary64-native-admission-no-welding'; persistentNamingCertified: false;
  memoryAccounting: 'root-signed-json-occurrences-plus-unchanged-child-ledgers-not-heap';
}
export interface ConvexPlanarSolidSplitResult {
  request: { parent: ConvexPlanarSolidResult; cutter: ConvexPlanarSolidCutter; options: ConvexPlanarSolidSplitOptions };
  negative: ConvexPlanarSolidSplitOutcome; positive: ConvexPlanarSolidSplitOutcome;
  section: { kind: 'none' | 'contact' | 'cycle'; dimension: -1 | 0 | 1 | 2; nodes: ConvexPlanarSolidSplitNode[]; segments: ConvexPlanarSolidSplitSegment[]; cycleNodeKeys: string[]; parentContactFaces: { sourceId: string; faceId: string }[] };
  lineage: { nodes: ConvexPlanarSolidSplitNode[]; faces: ConvexPlanarSolidSplitFaceLineage[]; capUses: { sectionKey: string; negative: { sourceId: string; useId: string }; positive: { sourceId: string; useId: string } }[] };
  report: ConvexPlanarSolidSplitReport;
}
type Side = 'negative' | 'positive';
type Polygon = { faceIndex: number; nodeKeys: string[] };
const RESULT_FIELDS = ['request', 'negative', 'positive', 'section', 'lineage', 'report'];
const key = (...parts: string[]) => parts.join('|');
const edgeKey = (operation: string, edge: ConvexPlanarSolidGraph['edges'][number]) => key(operation, 'crossing', ...edge.uses.map(u => key(u.sourceId, u.faceId, u.use.id)).sort());
const array = (v: unknown, min: number, max: number): unknown[] => { demand(Array.isArray(v) && v.length >= min && v.length <= max, 'BUDGET', 'Bounded inventory required'); return v; };
function build(request: ConvexPlanarSolidSplitResult['request'], ledger: SplitLedger): ConvexPlanarSolidSplitResult {
  fields(request, ['parent', 'cutter', 'options']); fields(request.options, ['operationId', 'resultIdPrefix', 'negativeSolidId', 'positiveSolidId']);
  const { parent, cutter, options } = request, { operationId, resultIdPrefix: prefix } = options;
  identity(operationId); identity(prefix, 10); identity(options.negativeSolidId); identity(options.positiveSolidId);
  demand(new Set([operationId, options.negativeSolidId, options.positiveSolidId]).size === 3, 'IDENTITY', 'Distinct operation and output Solid identities required');
  fields(cutter, ['sourceId', 'source', 'sourceVersion', 'model', 'surfaceId']); identity(cutter.sourceId); identity(cutter.surfaceId);
  demand(cutter.sourceVersion === 0 && typeof cutter.source === 'string' && cutter.source.length <= 262144, 'INPUT', 'Bounded original Source0 required');
  fields(cutter.model, ['name', 'version', 'lengthUnit', 'objects']); array(cutter.model.objects, 1, 16);
  fields(parent, ['request', 'graph', 'supports', 'certificate', 'report']); fields(parent.request, ['assets', 'edgePairs', 'options']);
  const originalAssets = array(parent.request.assets, 4, 12) as ConvexPlanarSolidAsset[];
  fields(parent.graph, ['vertices', 'edges', 'faces', 'vertexLinks']); array(parent.graph.vertices, 4, 32); array(parent.graph.edges, 6, 32); array(parent.graph.faces, 4, 12);
  let parentUses = 0;
  for (const asset of originalAssets) { fields(asset, ['sourceId', 'face']); demand(asset.face !== null && typeof asset.face === 'object', 'INPUT', 'Native Face required'); parentUses += array(asset.face.loop?.edges, 3, 8).length; }
  demand(parentUses <= 64, 'BUDGET', 'Parent directed-use ceiling exceeded before native reconstruction');
  // A pessimistic whole-operation reserve precedes all native calls. Exact output inventories tighten it below.
  const reservedFaces = originalAssets.length + 48, reservedUses = parentUses + 256;
  demand(reservedFaces <= 60 && reservedUses * 3 <= 960, 'BUDGET', 'Aggregate native call reserve exceeded');
  const selected = cutter.model.objects.filter(o => o.id === cutter.surfaceId);
  demand(selected.length === 1 && selected[0].kind === 'surface', 'IDENTITY', 'One source-qualified cutter Surface required');
  const plane = selected[0] as Surface;
  at('cutter-admission', cutter.sourceId, () => buildAffinePlaneAxes(plane));
  const parentReport = at('parent-reconstruction', parent.request.options.solidId, () => validateConvexPlanarSolid(parent));
  at('cutter-source', cutter.sourceId, () => { const compiled = compileCadModel(cutter.source, { sourceVersion: 0 }); demand(compiled.ok && same(compiled.model, cutter.model), 'OWNED', 'Complete cutter Source0/model mismatch'); });
  const proof = new SolidProof(), r = proof.rational, zero = r.integer(0), one = r.integer(1);
  const origin = proof.point(plane.controlPoints[0][0]), u = proof.sub(proof.point(plane.controlPoints[1][0]), origin), v = proof.sub(proof.point(plane.controlPoints[0][1]), origin), normal = proof.cross(u, v);
  demand(proof.equal(proof.point(plane.controlPoints[1][1]), proof.add(proof.add(origin, u), v)), 'BINDING', 'Cutter coefficients are not exactly affine');
  demand(normal.some(n => n.n !== 0n), 'DEGENERATE', 'Cutter has no exact normal');
  const distances = parent.graph.vertices.map(vertex => proof.dot(normal, proof.sub(proof.point(vertex.pointMM), origin)));
  const signs = distances.map(d => d.n < 0n ? -1 : d.n > 0n ? 1 : 0), hasNegative = signs.includes(-1), hasPositive = signs.includes(1);
  const nodes: ConvexPlanarSolidSplitNode[] = parent.graph.vertices.map(vertex => ({ key: key(operationId, 'vertex', ...vertex.members.map(m => key(m.sourceId, m.faceId, m.vertexId)).sort()), pointMM: vertex.pointMM, exactPointMM: proof.text(proof.point(vertex.pointMM)), origin: { kind: 'vertex', parentVertexId: vertex.id, members: vertex.members } }));
  const vertexNode = new Map(parent.graph.vertices.map((vertex, i) => [vertex.id, nodes[i]]));
  const exactPoints = new Map(nodes.map(node => [node.key, proof.point(node.pointMM)]));
  const crossingNodes = new Map<string, ConvexPlanarSolidSplitNode>();
  const vertexIndex = (id: string) => { const i = parent.graph.vertices.findIndex(vertex => vertex.id === id); demand(i >= 0, 'INCIDENCE', 'Original vertex reference missing'); return i; };
  const originalEdge = (id: string) => { const edge = parent.graph.edges.find(e => e.id === id); demand(edge !== undefined, 'INCIDENCE', 'Original edge reference missing'); return edge; };
  const parameter = (edge: ConvexPlanarSolidGraph['edges'][number], node: ConvexPlanarSolidSplitNode, ref: ConvexPlanarSolidGraph['edges'][number]['uses'][number]): SectionRational => {
    const face = parent.graph.faces.find(f => f.sourceId === ref.sourceId)!, index = face.edgeIds.indexOf(edge.id), startId = face.vertexIds[index], endId = face.vertexIds[(index + 1) % face.vertexIds.length];
    let t: SectionRational;
    if (node.origin.kind === 'vertex') { demand(node.origin.parentVertexId === startId || node.origin.parentVertexId === endId, 'INCIDENCE', 'Lineage endpoint not on original edge'); t = node.origin.parentVertexId === startId ? zero : one; }
    else { const a = distances[vertexIndex(startId)], b = distances[vertexIndex(endId)]; t = r.div(a, r.sub(a, b)); }
    return r.add(r.from(ref.use.interval[0]), r.mul(t, r.sub(r.from(ref.use.interval[1]), r.from(ref.use.interval[0]))));
  };
  if (hasNegative && hasPositive) for (const edge of parent.graph.edges) {
    const ia = vertexIndex(edge.vertexIds[0]), ib = vertexIndex(edge.vertexIds[1]); if (signs[ia] * signs[ib] !== -1) continue;
    const t = r.div(distances[ia], r.sub(distances[ia], distances[ib])), a = proof.point(parent.graph.vertices[ia].pointMM), b = proof.point(parent.graph.vertices[ib].pointMM), point = proof.add(a, proof.scale(proof.sub(b, a), t));
    const node: ConvexPlanarSolidSplitNode = { key: edgeKey(operationId, edge), pointMM: at('crossing-representability', edge.id, () => point.map(c => r.exactFloat(c)) as Point), exactPointMM: proof.text(point), origin: { kind: 'crossing', parentEdgeId: edge.id, parameters: [] } };
    if (node.origin.kind === 'crossing') node.origin.parameters = edge.uses.map(ref => { const f = originalAssets.find(asset => asset.sourceId === ref.sourceId)!.face, curve = f.loop.edges.find(c => c.id === ref.use.curveId)!; return { sourceId: ref.sourceId, faceId: ref.faceId, useId: ref.use.id, curveId: ref.use.curveId, parameter: r.text(parameter(edge, node, ref)), domain: [curve.knots[1], curve.knots[2]] }; });
    crossingNodes.set(edge.id, node); exactPoints.set(node.key, point); nodes.push(node);
  }
  const byKey = new Map(nodes.map(node => [node.key, node]));
  const onPlane = (nodeKey: string) => { const node = byKey.get(nodeKey)!; return node.origin.kind === 'crossing' || signs[vertexIndex(node.origin.parentVertexId)] === 0; };
  const area = (keys: string[]) => keys.reduce((sum, k, i) => proof.add(sum, proof.cross(exactPoints.get(k)!, exactPoints.get(keys[(i + 1) % keys.length])!)), proof.point([0, 0, 0]));
  const polygons: Record<Side, Polygon[]> = { negative: [], positive: [] };
  if (hasNegative && hasPositive) for (const side of ['negative', 'positive'] as const) for (const [faceIndex, face] of parent.graph.faces.entries()) {
    const clipped: string[] = [];
    for (let i = 0; i < face.vertexIds.length; i++) {
      const vi = vertexIndex(face.vertexIds[i]), sign = signs[vi];
      if (side === 'negative' ? sign <= 0 : sign >= 0) clipped.push(vertexNode.get(face.vertexIds[i])!.key);
      const cross = crossingNodes.get(face.edgeIds[i]); if (cross) clipped.push(cross.key);
    }
    const compact = clipped.filter((n, i) => i === 0 || n !== clipped[i - 1]); if (compact.length > 1 && compact[0] === compact[compact.length - 1]) compact.pop();
    if (compact.length >= 3 && area(compact).some(c => c.n !== 0n)) polygons[side].push({ faceIndex, nodeKeys: compact });
  }
  const segments: ConvexPlanarSolidSplitSegment[] = [];
  const addSegment = (a: string, b: string, faceIndex: number) => {
    demand(a !== b, 'INCIDENCE', 'Collapsed section edge');
    const face = parent.graph.faces[faceIndex], existing = segments.find(s => s.nodeKeys.includes(a) && s.nodeKeys.includes(b));
    if (existing) { if (!existing.facets.some(f => f.sourceId === face.sourceId)) existing.facets.push({ sourceId: face.sourceId, faceId: face.faceId }); return; }
    const na = byKey.get(a)!, nb = byKey.get(b)!;
    const edge = na.origin.kind === 'vertex' && nb.origin.kind === 'vertex' ? parent.graph.edges.find(e => e.vertexIds.includes((na.origin as Extract<typeof na.origin, { kind: 'vertex' }>).parentVertexId) && e.vertexIds.includes((nb.origin as Extract<typeof nb.origin, { kind: 'vertex' }>).parentVertexId)) : undefined;
    segments.push({ key: edge ? key(operationId, 'section-original-edge', ...edge.uses.map(u => key(u.sourceId, u.faceId, u.use.id)).sort()) : key(operationId, 'section-facet', face.sourceId, face.faceId), nodeKeys: [a, b], parentEdgeId: edge?.id ?? null, facets: [{ sourceId: face.sourceId, faceId: face.faceId }] });
  };
  for (const side of ['negative', 'positive'] as const) for (const polygon of polygons[side]) for (let i = 0; i < polygon.nodeKeys.length; i++) { const a = polygon.nodeKeys[i], b = polygon.nodeKeys[(i + 1) % polygon.nodeKeys.length]; if (onPlane(a) && onPlane(b)) addSegment(a, b, polygon.faceIndex); }
  const cycle: string[] = [];
  if (hasNegative && hasPositive) {
    demand(segments.length >= 3 && segments.length <= 8, 'BUDGET', 'Section needs 3..8 native cap edges');
    const sectionKeys = [...new Set(segments.flatMap(s => s.nodeKeys))];
    demand(sectionKeys.length === segments.length && sectionKeys.every(k => segments.filter(s => s.nodeKeys.includes(k)).length === 2), 'INCIDENCE', 'Section incidence must be one degree-two cycle');
    let current = sectionKeys[0], previous = '';
    while (!cycle.includes(current)) { cycle.push(current); const neighbors = segments.filter(s => s.nodeKeys.includes(current)).map(s => s.nodeKeys.find(k => k !== current)!); const next = neighbors.find(k => k !== previous)!; previous = current; current = next; }
    demand(current === cycle[0] && cycle.length === sectionKeys.length, 'INCIDENCE', 'Disconnected section cycles refused');
    const alignment = proof.dot(area(cycle), normal); demand(alignment.n !== 0n, 'DEGENERATE', 'Zero-area section refused'); if (alignment.n < 0n) cycle.reverse();
  }
  // Preflight both complete child inventories before creating any Face.
  let newFaceCount = 0, newUses = 0;
  if (cycle.length) for (const side of ['negative', 'positive'] as const) {
    const counts = [...polygons[side].map(p => p.nodeKeys.length), cycle.length], uses = counts.reduce((a, b) => a + b, 0), childVertices = new Set(polygons[side].flatMap(p => p.nodeKeys));
    demand(counts.length >= 4 && counts.length <= 12 && counts.every(n => n >= 3 && n <= 8) && uses <= 64 && uses % 2 === 0 && uses / 2 <= 32 && childVertices.size <= 32 && uses - counts.length * 2 <= 40, 'BUDGET', 'Planned child exceeds unchanged Solid/Face inventory');
    newFaceCount += counts.length; newUses += uses;
  }
  demand(originalAssets.length + 2 * newFaceCount <= 60 && (parentUses + 2 * newUses) * 3 <= 960, 'BUDGET', 'Planned aggregate child native work exceeded');
  if (cycle.length) for (const side of ['negative', 'positive'] as const) {
    const capSource = prefix + (side === 'negative' ? '_cap_n' : '_cap_p');
    demand(!originalAssets.some(asset => asset.sourceId === capSource), 'IDENTITY', 'Planned cap source namespace collides with parent');
    for (const [index, polygon] of [...polygons[side], { faceIndex: -1, nodeKeys: cycle }].entries()) {
      const original = polygon.faceIndex < 0 ? null : originalAssets[polygon.faceIndex].face, p = prefix + (side === 'negative' ? '_n' : '_p') + '_f' + index;
      const ids = [original?.plane.id ?? plane.id, original?.loop.id ?? p + '_loop', original?.options.faceId ?? p + '_face', p + '_model', ...polygon.nodeKeys.flatMap((_, i) => [p + '_c' + i, p + '_v_' + i, p + '_e_' + i, p + '_use_' + i, p + '_uv_' + i])];
      demand(new Set(ids).size === ids.length, 'IDENTITY', 'Planned native context/Surface/loop/curve identities collide');
    }
  }

  const faces: ConvexPlanarSolidSplitFaceLineage[] = [], capUses: ConvexPlanarSolidSplitResult['lineage']['capUses'] = [], childReports: ConvexPlanarSolidReport[] = [];
  const sourceRef = (index: number) => { const face = parent.graph.faces[index]; return { sourceId: face.sourceId, faceId: face.faceId, surfaceId: face.surfaceId, loopId: face.loopId }; };
  const segmentFor = (a: string, b: string) => { const segment = segments.find(s => s.nodeKeys.includes(a) && s.nodeKeys.includes(b)); demand(segment !== undefined, 'INCIDENCE', 'Section correspondence missing'); return segment; };
  const parentEdgeFor = (a: string, b: string, faceIndex: number) => parent.graph.faces[faceIndex].edgeIds.map(originalEdge).find(edge => [a, b].every(k => { const o = byKey.get(k)!.origin; return o.kind === 'crossing' ? o.parentEdgeId === edge.id : edge.vertexIds.includes(o.parentVertexId); }));
  const construct = (side: Side): ConvexPlanarSolidSplitOutcome => {
    if (!cycle.length) {
      const occupied = side === 'negative' ? hasNegative : hasPositive;
      for (const [i, face] of parent.graph.faces.entries()) {
        const edges: ConvexPlanarSolidSplitFaceLineage['edges'] = occupied ? face.edgeIds.map((edgeId, j) => {
          const edge = originalEdge(edgeId), ref = edge.uses.find(u => u.sourceId === face.sourceId)!, line = originalAssets[i].face.loop.edges.find(c => c.id === ref.use.curveId)!;
          return { useId: ref.use.id, edgeId: ref.use.edgeId, curveId: ref.use.curveId, pcurveId: ref.use.pcurveId,
            nodeKeys: [vertexNode.get(face.vertexIds[j])!.key, vertexNode.get(face.vertexIds[(j + 1) % face.vertexIds.length])!.key],
            origin: { kind: 'parent-edge', parentEdgeId: edge.id, sourceId: ref.sourceId, faceId: ref.faceId, useId: ref.use.id, curveId: ref.use.curveId, pcurveId: ref.use.pcurveId, domain: [line.knots[1], line.knots[2]], sourceInterval: [r.text(r.from(ref.use.interval[0])), r.text(r.from(ref.use.interval[1]))] } };
        }) : [];
        faces.push({ side, role: occupied ? 'retained' : 'deleted', key: key(operationId, 'facet', face.sourceId, face.faceId), parent: sourceRef(i), output: occupied ? sourceRef(i) : null, edges });
      }
      return occupied ? { kind: 'solid', solid: parent } : { kind: 'empty' };
    }
    const assets: ConvexPlanarSolidAsset[] = [], pairing: { nodeKeys: [string, string]; sourceId: string; useId: string }[] = [];
    const planned = [...polygons[side], { faceIndex: -1, nodeKeys: cycle }];
    for (const [index, polygon] of planned.entries()) {
      const cap = polygon.faceIndex < 0, original = cap ? null : originalAssets[polygon.faceIndex].face, p = prefix + (side === 'negative' ? '_n' : '_p') + '_f' + index;
      const sourceId = cap ? prefix + (side === 'negative' ? '_cap_n' : '_cap_p') : originalAssets[polygon.faceIndex].sourceId;
      demand(!cap || !originalAssets.some(asset => asset.sourceId === sourceId), 'IDENTITY', 'Cap source namespace collides with parent');
      const lines: Curve[] = polygon.nodeKeys.map((k, i) => ({ kind: 'curve', id: p + '_c' + i, degree: 1, knots: [0, 0, 1, 1], weights: [1, 1], controlPoints: [byKey.get(k)!.pointMM, byKey.get(polygon.nodeKeys[(i + 1) % polygon.nodeKeys.length])!.pointMM] }));
      const native = at('face-construction', sourceId, () => buildConvexPlanarFace(original?.plane ?? plane, { id: original?.loop.id ?? p + '_loop', edges: lines }, { faceId: original?.options.faceId ?? p + '_face', evaluationId: p + '_model', resultIdPrefix: p, orientation: original?.options.orientation ?? (side === 'negative' ? 'forward' : 'reverse') }));
      assets.push({ sourceId, face: native });
      const edgeLineage: ConvexPlanarSolidSplitFaceLineage['edges'] = native.topology.loop.uses.map(use => {
        const i = lines.findIndex(line => line.id === use.curveId), forward = use.sense === 'forward', a = polygon.nodeKeys[forward ? i : (i + 1) % polygon.nodeKeys.length], b = polygon.nodeKeys[forward ? (i + 1) % polygon.nodeKeys.length : i];
        pairing.push({ nodeKeys: [a, b], sourceId, useId: use.id });
        const inherited = cap ? undefined : parentEdgeFor(a, b, polygon.faceIndex);
        let origin: ConvexPlanarSolidSplitFaceLineage['edges'][number]['origin'];
        if (inherited) {
          const ref = inherited.uses.find(ref => ref.sourceId === sourceId)!, line = original!.loop.edges.find(line => line.id === ref.use.curveId)!;
          origin = { kind: 'parent-edge', parentEdgeId: inherited.id, sourceId, faceId: ref.faceId, useId: ref.use.id, curveId: ref.use.curveId, pcurveId: ref.use.pcurveId, domain: [line.knots[1], line.knots[2]], sourceInterval: [r.text(parameter(inherited, byKey.get(a)!, ref)), r.text(parameter(inherited, byKey.get(b)!, ref))] };
        } else origin = { kind: 'section', sectionKey: segmentFor(a, b).key };
        return { useId: use.id, edgeId: use.edgeId, curveId: use.curveId, pcurveId: use.pcurveId, nodeKeys: [a, b], origin };
      });
      const unchanged = !cap && polygon.nodeKeys.length === parent.graph.faces[polygon.faceIndex].vertexIds.length && polygon.nodeKeys.every(k => byKey.get(k)!.origin.kind === 'vertex');
      faces.push({ side, role: cap ? 'cap' : unchanged ? 'retained' : 'clipped', key: cap ? key(operationId, 'cap', cutter.sourceId, cutter.surfaceId, side) : key(operationId, 'facet', sourceId, original!.options.faceId), parent: cap ? null : sourceRef(polygon.faceIndex), output: { sourceId, faceId: native.options.faceId, surfaceId: native.plane.id, loopId: native.loop.id }, edges: edgeLineage });
    }
    for (const [i] of parent.graph.faces.entries()) if (!polygons[side].some(p => p.faceIndex === i)) faces.push({ side, role: 'deleted', key: key(operationId, 'facet', parent.graph.faces[i].sourceId, parent.graph.faces[i].faceId), parent: sourceRef(i), output: null, edges: [] });
    const consumed = new Set<number>(), edgePairs: ConvexPlanarSolidEdgePair[] = [];
    for (const [i, a] of pairing.entries()) if (!consumed.has(i)) {
      const matches = pairing.flatMap((b, j) => j !== i && !consumed.has(j) && b.nodeKeys[0] === a.nodeKeys[1] && b.nodeKeys[1] === a.nodeKeys[0] ? [j] : []);
      demand(matches.length === 1, 'INCIDENCE', 'Exactly two opposite semantic edge uses required'); const j = matches[0], b = pairing[j]; consumed.add(i); consumed.add(j); edgePairs.push({ a: { sourceId: a.sourceId, useId: a.useId }, b: { sourceId: b.sourceId, useId: b.useId } });
    }
    const solid = at('output-qualification', side, () => qualifyConvexPlanarSolid(assets, edgePairs, { solidId: side === 'negative' ? options.negativeSolidId : options.positiveSolidId, resultIdPrefix: prefix + (side === 'negative' ? '_n' : '_p') }));
    // Register native-owned children before retaining a root result copy; child internal snapshots use their own unchanged ledger.
    ledger.copy(solid, true, true, true); childReports.push(solid.report); return { kind: 'solid', solid };
  };
  const negative = construct('negative'), positive = construct('positive');
  if (cycle.length) for (const segment of segments) {
    const n = faces.find(f => f.side === 'negative' && f.role === 'cap')!, p = faces.find(f => f.side === 'positive' && f.role === 'cap')!, ne = n.edges.find(e => e.origin.kind === 'section' && e.origin.sectionKey === segment.key)!, pe = p.edges.find(e => e.origin.kind === 'section' && e.origin.sectionKey === segment.key)!;
    demand(ne !== undefined && pe !== undefined && ne.nodeKeys[0] === pe.nodeKeys[1] && ne.nodeKeys[1] === pe.nodeKeys[0], 'BINDING', 'Caps must have opposite shared exact edge correspondence');
    capUses.push({ sectionKey: segment.key, negative: { sourceId: n.output!.sourceId, useId: ne.useId }, positive: { sourceId: p.output!.sourceId, useId: pe.useId } });
  }
  const fraction = (f: SectionFraction) => r.rat(BigInt(f.numerator), BigInt(f.denominator));
  const volume = (outcome: ConvexPlanarSolidSplitOutcome) => outcome.kind === 'solid' ? fraction(outcome.solid.certificate.volumeMM3) : zero;
  demand(r.compare(r.add(volume(negative), volume(positive)), fraction(parent.certificate.volumeMM3)) === 0, 'BINDING', 'Exact split volume is not conserved');
  const contactNodes = nodes.filter(n => onPlane(n.key)), contactFaces = parent.graph.faces.filter(f => f.vertexIds.every(id => signs[vertexIndex(id)] === 0)).map(f => ({ sourceId: f.sourceId, faceId: f.faceId }));
  if (!cycle.length) for (const edge of parent.graph.edges) if (edge.vertexIds.every(id => signs[vertexIndex(id)] === 0)) { for (const [fi, face] of parent.graph.faces.entries()) if (face.edgeIds.includes(edge.id)) addSegment(vertexNode.get(edge.vertexIds[0])!.key, vertexNode.get(edge.vertexIds[1])!.key, fi); }
  const dimension = cycle.length || contactFaces.length ? 2 : segments.length ? 1 : contactNodes.length ? 0 : -1;
  const qualifiers = [parentReport.exactWork, ...childReports.map(report => report.exactWork)], root = r.counts(), aggregateOperations = root.operations + qualifiers.reduce((n, q) => n + q.operations, 0), aggregateGcdSteps = root.gcdSteps + qualifiers.reduce((n, q) => n + q.gcdSteps, 0);
  demand(aggregateOperations <= 800000 && aggregateGcdSteps <= 800000, 'BUDGET', 'Aggregate exact child work ceiling exceeded');
  const nativeUses = parentUses + 2 * newUses, completeFaceReconstructions = originalAssets.length + newFaceCount;
  const report: ConvexPlanarSolidSplitReport = {
    schema: 'barocss-convex-planar-solid-split', version: 0, operationId, status: cycle.length ? 'split' : contactNodes.length ? 'tangent' : 'outside',
    volumeMM3: { parent: parent.certificate.volumeMM3, negative: negative.kind === 'solid' ? negative.solid.certificate.volumeMM3 : { numerator: '0', denominator: '1' }, positive: positive.kind === 'solid' ? positive.solid.certificate.volumeMM3 : { numerator: '0', denominator: '1' }, conserved: true },
    nativeWork: { parentReconstructions: 1, outputQualifications: childReports.length, completeFaceReconstructions, newFaceConstructions: newFaceCount, faceCompilations: completeFaceReconstructions + newFaceCount, cutterCompilations: 1, totalSourceCompilations: completeFaceReconstructions + newFaceCount + 1, bindingObservations: nativeUses * 3, totalD1: nativeUses * 9, retries: 0, scope: 'direct-calls-and-known-parent-loops-not-provider-internals' },
    exactWork: { root, qualifiers, contextCount: qualifiers.length + 1, aggregateOperations, aggregateGcdSteps, maximumObservedBits: Math.max(root.maximumObservedBits, ...qualifiers.map(q => q.maximumObservedBits)) }, limits: SPLIT_LIMITS,
    validationScope: 'whole-result-self-consistency-not-authenticity', numericPolicy: 'exact-stored-binary64-native-admission-no-welding', persistentNamingCertified: false, memoryAccounting: 'root-signed-json-occurrences-plus-unchanged-child-ledgers-not-heap',
  };
  return { request, negative, positive, section: { kind: cycle.length ? 'cycle' : contactNodes.length ? 'contact' : 'none', dimension, nodes: contactNodes, segments, cycleNodeKeys: cycle, parentContactFaces: contactFaces }, lineage: { nodes, faces, capUses }, report };
}
/** Atomic exact split. The two nonempty outcomes satisfy the unchanged convex planar Solid qualifier. */
export function splitConvexPlanarSolid(parent: ConvexPlanarSolidResult, cutter: ConvexPlanarSolidCutter, options: ConvexPlanarSolidSplitOptions): ConvexPlanarSolidSplitResult {
  return at('split', 'request', () => { const ledger = new SplitLedger(), request = ledger.copy({ parent, cutter, options }); const result = build(request, ledger); ledger.copy(result, true, true, true); return ledger.copy(result, true); });
}
/** Reconstructs one entire operation, checking source, both outcomes, exact lineage, caps and work report. */
export function validateConvexPlanarSolidSplit(input: ConvexPlanarSolidSplitResult): ConvexPlanarSolidSplitReport {
  return at('validation', 'result', () => { const ledger = new SplitLedger(), owned = ledger.copy(input, true); fields(owned, RESULT_FIELDS); const request = ledger.copy(owned.request), expected = build(request, ledger); ledger.copy(expected, true, true, true); demand(same(owned, expected), 'OWNED', 'Complete split differs from reconstruction'); return ledger.copy(expected.report, true); });
}
