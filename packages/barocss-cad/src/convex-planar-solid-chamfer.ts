import { splitConvexPlanarSolid } from './convex-planar-solid-split.js';
import type { ConvexPlanarSolidCutter, ConvexPlanarSolidSplitResult, ConvexPlanarSolidSplitOptions } from './convex-planar-solid-split.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidGraph } from './convex-planar-solid.js';
import type { Point, Surface } from './types.js';
import type { ExactPoint, ExactPointData } from './convex-planar-solid-proof-internal.js';
import type { SectionFraction, SectionRational } from './section-rational-internal.js';
import { SolidProof, ChamferLedger, CHAMFER_LIMITS, demand, fields, identity, same, at } from './planar-solids/convex-planar-solid-chamfer-internal.js';
export { ConvexPlanarSolidChamferError } from './planar-solids/convex-planar-solid-chamfer-internal.js';
export type { ChamferCode as ConvexPlanarSolidChamferDiagnosticCode } from './planar-solids/convex-planar-solid-chamfer-internal.js';

export interface ConvexPlanarChamferUseReference { sourceId: string; faceId: string; surfaceId: string; loopId: string; useId: string; curveId: string; pcurveId: string }
export interface ConvexPlanarChamferSelection { parentSolidId: string; a: ConvexPlanarChamferUseReference; b: ConvexPlanarChamferUseReference }
export interface ConvexPlanarSolidChamferOptions { operationId: string; resultIdPrefix: string; retainedSolidId: string; removedSolidId: string }
export interface ConvexPlanarSolidChamferReport {
  schema: 'barocss-convex-planar-solid-chamfer'; version: 0; operationId: string; lengthUnit: 'mm';
  nativeWork: ConvexPlanarSolidSplitResult['report']['nativeWork'];
  exactWork: { wrapper: ReturnType<SolidProof['rational']['counts']>; split: ConvexPlanarSolidSplitResult['report']['exactWork']; contextCount: 5; aggregateOperations: number; aggregateGcdSteps: number; maximumObservedBits: number };
  limits: typeof CHAMFER_LIMITS;
  snapshotAccounting: { wrapperCumulativeBytes: number; splitCumulativeBytes: number; qualifierCumulativeBytesEach: number; qualifierCount: 3; aggregateCumulativeBytes: number; measure: 'independent-serialized-signed-json-occurrence-ceilings-not-heap' };
  selectionPolicy: 'complete-source-use-pair-same-parent-distance-edits'; persistentNamingCertified: false;
  validationScope: 'whole-result-self-consistency-not-authenticity'; supportScope: 'one-cardinal-perpendicular-edge-with-orthogonal-ends';
}
export interface ConvexPlanarSolidChamferResult {
  request: { selection: ConvexPlanarChamferSelection; distanceMM: number; options: ConvexPlanarSolidChamferOptions };
  split: ConvexPlanarSolidSplitResult;
  metric: { outwardUnitNormals: [ExactPointData, ExactPointData]; supportConstantsMM: [SectionFraction, SectionFraction]; edgeDirection: ExactPointData; lowerEndpointMM: ExactPointData; edgeLengthMM: SectionFraction; distanceMM: SectionFraction; removedVolumeMM3: SectionFraction; boundary: 'sA+sB=d'; retained: 'sA+sB>=d'; setbacks: { nodeKey: string; sA: SectionFraction; sB: SectionFraction }[] };
  lineage: { parentEdgeId: string; removedParentVertexIds: [string, string]; retainedParentVertexIds: string[]; chamferFaceKey: string; setbackBoundaryKeys: [string, string]; retainedSide: 'negative'; removedSide: 'positive' };
  report: ConvexPlanarSolidChamferReport;
}
type Request = ConvexPlanarSolidChamferResult['request'] & { parent: ConvexPlanarSolidResult };
const REF_FIELDS = ['sourceId', 'faceId', 'surfaceId', 'loopId', 'useId', 'curveId', 'pcurveId'];
const array = (v: unknown, min: number, max: number): unknown[] => { demand(Array.isArray(v) && v.length >= min && v.length <= max, 'BUDGET', 'Bounded inventory required'); return v; };
const ref = (u: ConvexPlanarSolidGraph['edges'][number]['uses'][number]): ConvexPlanarChamferUseReference => ({ sourceId: u.sourceId, faceId: u.faceId, surfaceId: u.surfaceId, loopId: u.loopId, useId: u.use.id, curveId: u.use.curveId, pcurveId: u.use.pcurveId });
function build(request: Request, ledger: ChamferLedger): ConvexPlanarSolidChamferResult {
  fields(request, ['parent', 'selection', 'distanceMM', 'options']);
  const { parent, selection, distanceMM, options } = request;
  fields(selection, ['parentSolidId', 'a', 'b']); identity(selection.parentSolidId);
  for (const selected of [selection.a, selection.b]) { fields(selected, REF_FIELDS); for (const value of Object.values(selected)) identity(value); }
  demand(!same(selection.a, selection.b), 'SELECTION', 'Two distinct complete source/use references required');
  fields(options, ['operationId', 'resultIdPrefix', 'retainedSolidId', 'removedSolidId']);
  identity(options.operationId); identity(options.resultIdPrefix, 10); identity(options.retainedSolidId); identity(options.removedSolidId);
  demand(new Set([options.operationId, options.retainedSolidId, options.removedSolidId]).size === 3, 'IDENTITY', 'Distinct operation/output identities required');
  demand(typeof distanceMM === 'number' && Number.isFinite(distanceMM) && distanceMM > 0, 'METRIC', 'Finite positive physical setback in mm required');
  // Descriptor snapshots precede this bounded provisional inspection. Nothing here trusts a cached certificate.
  fields(parent, ['request', 'graph', 'supports', 'certificate', 'report']); fields(parent.request, ['assets', 'edgePairs', 'options']);
  fields(parent.request.options, ['solidId', 'resultIdPrefix']);
  demand(selection.parentSolidId === parent.request.options.solidId, 'SELECTION', 'Selected parent Solid identity differs');
  fields(parent.graph, ['vertices', 'edges', 'faces', 'vertexLinks']);
  const F = array(parent.request.assets, 4, 11).length, V = array(parent.graph.vertices, 4, 30).length, E = array(parent.graph.edges, 6, 29).length;
  demand(array(parent.graph.faces, 4, 11).length === F && array(parent.supports, 4, 11).length === F, 'INCIDENCE', 'Complete provisional facet/support inventory required');
  demand(array(parent.graph.vertexLinks, 4, 30).length === V && array(parent.request.edgePairs, 6, 29).length === E, 'INCIDENCE', 'Complete provisional incidence inventory required');
  let U = 0;
  for (const asset of parent.request.assets) { fields(asset, ['sourceId', 'face']); U += array(asset.face?.loop?.edges, 3, 8).length; }
  demand(U <= 58 && U === 2 * E && U - 2 * F <= 36, 'BUDGET', 'Parent directed-use/fan ceiling exceeded');
  for (const vertex of parent.graph.vertices) { fields(vertex, ['id', 'pointMM', 'members']); identity(vertex.id); array(vertex.pointMM, 3, 3); array(vertex.members, 3, 11); }
  for (const edge of parent.graph.edges) { fields(edge, ['id', 'pairIndex', 'vertexIds', 'uses', 'parameterMapAtoB']); identity(edge.id); array(edge.vertexIds, 2, 2); array(edge.uses, 2, 2); for (const use of edge.uses) { fields(use, ['sourceId', 'faceId', 'surfaceId', 'loopId', 'use']); fields(use.use, ['id', 'edgeId', 'curveId', 'vertexIds', 'sense', 'interval', 'pcurveId']); } }
  for (const face of parent.graph.faces) { fields(face, ['sourceId', 'faceId', 'surfaceId', 'loopId', 'vertexIds', 'edgeIds']); const n = array(face.vertexIds, 3, 8).length; demand(array(face.edgeIds, 3, 8).length === n, 'INCIDENCE', 'Facet vertex/edge inventory differs'); }
  const matches = parent.graph.edges.filter(edge => [selection.a, selection.b].every(s => edge.uses.some(u => same(s, ref(u)))));
  demand(matches.length === 1, 'SELECTION', 'Selection must resolve exactly one opposite paired edge'); const selected = matches[0];
  const proof = new SolidProof(), r = proof.rational, one = r.integer(1), d = r.from(distanceMM);
  const fraction = (f: SectionFraction): SectionRational => { fields(f, ['numerator', 'denominator']); demand(typeof f.numerator === 'string' && typeof f.denominator === 'string' && /^-?\d{1,2467}$/.test(f.numerator) && /^\d{1,2467}$/.test(f.denominator), 'INPUT', 'Bounded exact fraction required'); return r.rat(BigInt(f.numerator), BigInt(f.denominator)); };
  const fromText = (p: ExactPointData): ExactPoint => { array(p, 3, 3); return p.map(fraction) as ExactPoint; };
  const supportFor = (s: ConvexPlanarChamferUseReference) => { const found = parent.supports.filter(f => f.sourceId === s.sourceId && f.faceId === s.faceId && f.surfaceId === s.surfaceId); demand(found.length === 1, 'SELECTION', 'Complete selected support required'); return found[0]; };
  const normals = [selection.a, selection.b].map(s => { const n = fromText(supportFor(s).outwardNormal), nonzero = n.filter(c => c.n !== 0n); demand(nonzero.length === 1, 'METRIC', 'Adjacent outward supports must be signed world-axis planes'); return proof.scale(n, r.div(one, r.abs(nonzero[0]))); }) as [ExactPoint, ExactPoint];
  demand(proof.dot(normals[0], normals[1]).n === 0n, 'METRIC', 'Adjacent outward unit normals must be perpendicular');
  const constants = [selection.a, selection.b].map((s, i) => proof.dot(normals[i], fromText(supportFor(s).originMM))) as [SectionRational, SectionRational];
  const direction = proof.cross(normals[0], normals[1]);
  const endpoints = selected.vertexIds.map(id => { const found = parent.graph.vertices.filter(v => v.id === id); demand(found.length === 1, 'INCIDENCE', 'Selected endpoint identity required'); return found[0]; });
  demand(endpoints[0].id !== endpoints[1].id, 'INCIDENCE', 'Distinct selected endpoints required');
  endpoints.sort((a, b) => r.compare(proof.dot(direction, proof.point(a.pointMM)), proof.dot(direction, proof.point(b.pointMM))));
  const lower = proof.point(endpoints[0].pointMM), upper = proof.point(endpoints[1].pointMM), length = proof.dot(direction, proof.sub(upper, lower));
  demand(length.n > 0n && proof.equal(proof.sub(upper, lower), proof.scale(direction, length)), 'METRIC', 'Positive straight edge parallel to the exact cardinal direction required');
  const setback = (p: ExactPoint, i: number) => r.sub(constants[i], proof.dot(normals[i], p));
  for (const p of [lower, upper]) demand(setback(p, 0).n === 0n && setback(p, 1).n === 0n, 'INCIDENCE', 'Selected endpoints must lie on both selected supports');
  const incidentEdges: string[] = [];
  for (const endpoint of endpoints) {
    const edges = parent.graph.edges.filter(e => e.vertexIds.includes(endpoint.id)), faces = parent.graph.faces.filter(f => f.vertexIds.includes(endpoint.id));
    demand(edges.length === 3 && faces.length === 3, 'INCIDENCE', 'Selected endpoints require valence three');
    incidentEdges.push(...edges.filter(e => e !== selected).map(e => e.id));
    const third = faces.filter(f => ![selection.a, selection.b].some(s => s.sourceId === f.sourceId && s.faceId === f.faceId));
    demand(third.length === 1, 'INCIDENCE', 'One third end support required');
    demand(third[0].vertexIds.length <= 7, 'BUDGET', 'Third end support needs room for one additional edge');
    const supports = parent.supports.filter(s => s.sourceId === third[0].sourceId && s.faceId === third[0].faceId && s.surfaceId === third[0].surfaceId);
    demand(supports.length === 1, 'INCIDENCE', 'Third end support missing');
    const n = fromText(supports[0].outwardNormal);
    demand(n.some(c => c.n !== 0n) && proof.cross(n, direction).every(c => c.n === 0n), 'METRIC', 'Third end supports must be perpendicular to selected edge');
  }
  demand(new Set(incidentEdges).size === 4, 'INCIDENCE', 'Four distinct local crossing edges required');
  for (const vertex of parent.graph.vertices) {
    const p = proof.point(vertex.pointMM), sum = r.add(setback(p, 0), setback(p, 1));
    demand(endpoints.some(e => e.id === vertex.id) ? sum.n === 0n : r.compare(sum, d) > 0, 'LOCALITY', 'Only selected endpoints may be removed; touching/nonlocal cuts refused');
  }
  const span = (target: SectionRational): SectionRational => { let value = one, steps = 0; while (r.compare(value, target) < 0) { demand(++steps <= CHAMFER_LIMITS.spanDoublings, 'BUDGET', 'Bounded power-of-two cutter span exceeded'); value = r.mul(value, r.integer(2)); } return value; };
  const origin = proof.sub(lower, proof.scale(normals[0], d)), u = proof.scale(direction, span(length)), v = proof.scale(proof.sub(normals[0], normals[1]), span(d));
  const point = (p: ExactPoint) => p.map(c => r.exactFloat(c)) as Point;
  const prefix = options.resultIdPrefix, surface: Surface = { kind: 'surface', id: prefix + '_ch_s', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[point(origin), point(proof.add(origin, v))], [point(proof.add(origin, u)), point(proof.add(proof.add(origin, u), v))]], weights: [[1, 1], [1, 1]] };
  // Small fixed-size authored model, never a precompile or a second native reconstruction.
  const poles = JSON.stringify(surface.controlPoints);
  const source = `@model ${prefix}_ch_m { version:0; length-unit:mm; @surface #${surface.id} { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:${poles}; weights:[[1,1],[1,1]]; } }\n`;
  const cutter: ConvexPlanarSolidCutter = { sourceId: prefix + '_ch_src', source, sourceVersion: 0, model: { name: prefix + '_ch_m', version: 0, lengthUnit: 'mm', objects: [surface] }, surfaceId: surface.id };
  const splitOptions: ConvexPlanarSolidSplitOptions = { operationId: options.operationId, resultIdPrefix: prefix, negativeSolidId: options.retainedSolidId, positiveSolidId: options.removedSolidId };
  demand(!parent.request.assets.some(a => a.sourceId === cutter.sourceId), 'IDENTITY', 'Cutter namespace collides with parent');
  demand(3 * F + 12 <= 45 && 9 * U + 144 <= 666, 'BUDGET', 'Provisional whole-operation native reserve exceeded');
  const split = at('split', options.operationId, () => splitConvexPlanarSolid(parent, cutter, splitOptions));
  // The sole split reconstructs and authenticates all provisional parent data before any success is possible.
  ledger.copy(split, true, true, true);
  demand(split.report.status === 'split' && split.negative.kind === 'solid' && split.positive.kind === 'solid', 'LOCALITY', 'Both retained part and removed wedge must qualify');
  const retained = split.negative.solid, removed = split.positive.solid;
  demand(retained.graph.faces.length === F + 1 && retained.graph.vertices.length === V + 2 && retained.graph.edges.length === E + 3 && removed.graph.faces.length === 5 && removed.graph.vertices.length === 6 && removed.graph.edges.length === 9, 'INCIDENCE', 'Expected one-edge chamfer and triangular wedge topology required');
  demand(split.section.nodes.length === 4 && split.section.segments.length === 4 && split.section.nodes.every(n => n.origin.kind === 'crossing' && incidentEdges.includes(n.origin.parentEdgeId)), 'INCIDENCE', 'Exactly four local crossings and cap segments required');
  const setbacks = split.section.nodes.map(node => {
    const p = proof.point(node.pointMM), sA = setback(p, 0), sB = setback(p, 1), t = proof.dot(direction, proof.sub(p, lower));
    demand((sA.n === 0n && r.compare(sB, d) === 0 || sB.n === 0n && r.compare(sA, d) === 0) && (t.n === 0n || r.compare(t, length) === 0), 'METRIC', 'Section must meet exact equal setback and endpoint stations');
    return { nodeKey: node.key, sA: r.text(sA), sB: r.text(sB) };
  });
  const removedVolume = r.div(r.mul(length, r.mul(d, d)), r.integer(2));
  demand(r.compare(fraction(removed.certificate.volumeMM3), removedVolume) === 0, 'METRIC', 'Removed exact volume must equal length*d*d/2');
  const cap = split.lineage.faces.filter(f => f.side === 'negative' && f.role === 'cap');
  demand(cap.length === 1 && cap[0].output !== null, 'INCIDENCE', 'Exactly one retained chamfer Face required');
  const boundaries = [selection.a, selection.b].map(s => { const found = split.section.segments.filter(segment => segment.facets.some(f => f.sourceId === s.sourceId && f.faceId === s.faceId)); demand(found.length === 1, 'INCIDENCE', 'One setback boundary on each selected face required'); return found[0].key; }) as [string, string];
  demand(boundaries[0] !== boundaries[1], 'INCIDENCE', 'Distinct setback boundaries required');
  const negativeFaces = split.lineage.faces.filter(f => f.side === 'negative');
  demand(negativeFaces.every(f => f.edges.every(e => e.origin.kind !== 'parent-edge' || e.origin.parentEdgeId !== selected.id)), 'INCIDENCE', 'Selected original edge must be absent from retained boundary');
  const retainedKeys = new Set(negativeFaces.flatMap(f => f.edges.flatMap(e => e.nodeKeys)));
  for (const node of split.lineage.nodes) if (node.origin.kind === 'vertex') demand(retainedKeys.has(node.key) !== endpoints.some(e => e.id === (node.origin as { parentVertexId: string }).parentVertexId), 'LOCALITY', 'Retained original vertices differ from the strict local plan');
  const metric: ConvexPlanarSolidChamferResult['metric'] = { outwardUnitNormals: [proof.text(normals[0]), proof.text(normals[1])], supportConstantsMM: constants.map(c => r.text(c)) as [SectionFraction, SectionFraction], edgeDirection: proof.text(direction), lowerEndpointMM: proof.text(lower), edgeLengthMM: r.text(length), distanceMM: r.text(d), removedVolumeMM3: r.text(removedVolume), boundary: 'sA+sB=d', retained: 'sA+sB>=d', setbacks };
  const root = r.counts(), child = split.report.exactWork, native = split.report.nativeWork;
  const aggregateOperations = root.operations + child.aggregateOperations, aggregateGcdSteps = root.gcdSteps + child.aggregateGcdSteps;
  demand(child.contextCount === 4 && aggregateOperations <= 1000000 && aggregateGcdSteps <= 1000000 && native.parentReconstructions === 1 && native.outputQualifications === 2 && native.faceCompilations <= 45 && native.totalSourceCompilations <= 46 && native.bindingObservations <= 666 && native.totalD1 <= 1998, 'BUDGET', 'Whole chamfer arithmetic/native ceiling exceeded');
  return {
    request: { selection, distanceMM, options }, split,
    metric,
    lineage: { parentEdgeId: selected.id, removedParentVertexIds: endpoints.map(e => e.id) as [string, string], retainedParentVertexIds: parent.graph.vertices.filter(v => !endpoints.some(e => e.id === v.id)).map(v => v.id), chamferFaceKey: cap[0].key, setbackBoundaryKeys: boundaries, retainedSide: 'negative', removedSide: 'positive' },
    report: { schema: 'barocss-convex-planar-solid-chamfer', version: 0, operationId: options.operationId, lengthUnit: 'mm', nativeWork: native, exactWork: { wrapper: root, split: child, contextCount: 5, aggregateOperations, aggregateGcdSteps, maximumObservedBits: Math.max(root.maximumObservedBits, child.maximumObservedBits) }, limits: CHAMFER_LIMITS,
      snapshotAccounting: { wrapperCumulativeBytes: CHAMFER_LIMITS.cumulativeSnapshotBytes, splitCumulativeBytes: split.report.limits.cumulativeSnapshotBytes, qualifierCumulativeBytesEach: retained.report.limits.cumulativeSnapshotBytes, qualifierCount: 3, aggregateCumulativeBytes: CHAMFER_LIMITS.aggregateSnapshotBytesIncludingSplitAndQualifiers, measure: 'independent-serialized-signed-json-occurrence-ceilings-not-heap' },
      selectionPolicy: 'complete-source-use-pair-same-parent-distance-edits', persistentNamingCertified: false, validationScope: 'whole-result-self-consistency-not-authenticity', supportScope: 'one-cardinal-perpendicular-edge-with-orthogonal-ends' },
  };
}
/** One physical equal-distance chamfer on one complete source-qualified cardinal edge; returns both qualified sides once. */
export function chamferConvexPlanarSolid(parent: ConvexPlanarSolidResult, selection: ConvexPlanarChamferSelection, distanceMM: number, options: ConvexPlanarSolidChamferOptions): ConvexPlanarSolidChamferResult {
  return at('chamfer', 'request', () => { const ledger = new ChamferLedger(), request = ledger.copy({ parent, selection, distanceMM, options }), result = build(request, ledger); return ledger.copy(result, true); });
}
/** Reconstructs the entire feature exactly once, including one nested split; every field uses signed-zero-preserving equality. */
export function validateConvexPlanarSolidChamfer(input: ConvexPlanarSolidChamferResult): ConvexPlanarSolidChamferReport {
  return at('validation', 'result', () => {
    const ledger = new ChamferLedger(), owned = ledger.copy(input, true); fields(owned, ['request', 'split', 'metric', 'lineage', 'report']); fields(owned.request, ['selection', 'distanceMM', 'options']);
    const request = ledger.copy({ parent: owned.split.request.parent, ...owned.request }), expected = build(request, ledger); ledger.copy(expected, true, true, true);
    demand(same(owned, expected), 'OWNED', 'Complete chamfer differs from reconstruction'); return ledger.copy(expected.report, true);
  });
}
