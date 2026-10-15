import { buildConvexPlanarFace } from './own-convex-planar-face.js';
import type { ConvexPlanarFaceResult, ConvexPlanarFaceUse } from './own-convex-planar-face.js';
import type { Point } from './types.js';
import type { SectionFraction } from './section-rational-internal.js';
import { check, id, record, same, SolidSnapshotLedger, SolidProof, ConvexPlanarSolidError } from './convex-planar-solid-proof-internal.js';
import type { ExactPointData } from './convex-planar-solid-proof-internal.js';
export { ConvexPlanarSolidError, ConvexPlanarSolidDiagnosticCode } from './convex-planar-solid-proof-internal.js';

export interface ConvexPlanarSolidAsset { sourceId: string; face: ConvexPlanarFaceResult }
export interface ConvexPlanarSolidUseReference { sourceId: string; useId: string }
export interface ConvexPlanarSolidEdgePair { a: ConvexPlanarSolidUseReference; b: ConvexPlanarSolidUseReference }
export interface ConvexPlanarSolidOptions { solidId: string; resultIdPrefix: string }
export interface ConvexPlanarSolidQueryOptions { maximumHalfspacePredicates: number }
export interface ConvexPlanarSolidVertexReference { sourceId: string; faceId: string; vertexId: string }
export interface ConvexPlanarSolidGraph {
  vertices: { id: string; pointMM: Point; members: ConvexPlanarSolidVertexReference[] }[];
  edges: { id: string; pairIndex: number; vertexIds: [string, string]; uses: { sourceId: string; faceId: string; surfaceId: string; loopId: string; use: ConvexPlanarFaceUse }[]; parameterMapAtoB: { scale: SectionFraction; offset: SectionFraction } }[];
  faces: { sourceId: string; faceId: string; surfaceId: string; loopId: string; vertexIds: string[]; edgeIds: string[] }[];
  vertexLinks: { vertexId: string; arcs: { sourceId: string; faceId: string; fromEdgeId: string; toEdgeId: string }[]; cycleEdgeIds: string[] }[];
}
export interface ConvexPlanarSolidSupport { sourceId: string; faceId: string; surfaceId: string; originMM: ExactPointData; outwardNormal: ExactPointData; offset: SectionFraction }
export interface ConvexPlanarSolidCertificate {
  family: 'exact-stored-affine-convex-polyhedron-v0'; solid: true; boundary: 'complete-convex-hull-facets';
  vertexRank: 3; volumeMM3: SectionFraction; strictInteriorMM: ExactPointData;
  incidence: { connected: true; oppositeEdgeUses: true; vertexLinksSingleCycles: true; eulerCharacteristic: 2 };
}
export interface ConvexPlanarSolidReport {
  schema: 'barocss-convex-planar-solid'; version: 0; solidId: string; lengthUnit: 'mm'; solid: true;
  faceCount: number; edgeCount: number; vertexCount: number;
  exactWork: { supportPredicates: number; coefficientProofs: number; fanTriangles: number; operations: number; gcdSteps: number; floatSearchSteps: number; floatConversions: number; maximumObservedBits: number };
  childNativeWork: { completeFaceReconstructionCount: number; sourceCompilationCount: number; bindingObservationCount: number; curveD1Count: number; pcurveD1Count: number; surfaceD1Count: number; totalD1Count: number; retries: 0; scope: 'direct-calls-and-known-parent-loop-work-not-hidden-provider-internals' };
  numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion';
  qualificationScope: 'complete-convex-affine-facets-only-not-general-brep-or-manufacturing-tolerance';
  validationScope: 'whole-result-self-consistency-not-authenticity'; childReportsUnchanged: true; persistentNamingCertified: false;
  limits: { faces: 12; directedUses: 64; pairs: 32; vertices: 32; supportPredicates: 384; coefficientProofs: 64; fanTriangles: 40; queryPoints: 64; queryPredicates: 768; rationalOperations: 200000; gcdSteps: 200000; integerBits: 8192; inputValues: 524288; resultValues: 786432; inputDepth: 24; resultDepth: 32; arrayElements: 4096; recordFields: 64; stringCharacters: 262144; inputStringCharacters: 4194304; resultStringCharacters: 8388608; inputBytes: 8388608; resultBytes: 16777216; cumulativeSnapshotBytes: 50331648; retainedInputAndResultBytes: 33554432 };
  dataCharge: 'alias-occurrence-counted-serialized-json-utf8-not-v8-heap';
  /** Present only when some stored pcurve pole was not exact and was certified within one chart rounding (CadNumericPolicy). */
  pcurveLift?: { policy: 'exact-or-one-rounding-certified-v1'; certifiedPoles: number; maximumDeviationMM: number };
}
export interface ConvexPlanarSolidResult {
  request: { assets: ConvexPlanarSolidAsset[]; edgePairs: ConvexPlanarSolidEdgePair[]; options: ConvexPlanarSolidOptions };
  graph: ConvexPlanarSolidGraph; supports: ConvexPlanarSolidSupport[]; certificate: ConvexPlanarSolidCertificate; report: ConvexPlanarSolidReport;
}
export interface ConvexPlanarSolidPointClassification { pointMM: Point; classification: 'inside' | 'boundary' | 'outside'; incidentFaces: { sourceId: string; faceId: string; surfaceId: string }[]; supportSigns: (-1 | 0 | 1)[] }
export interface ConvexPlanarSolidPointBatch {
  solidId: string; points: ConvexPlanarSolidPointClassification[]; halfspacePredicateCount: number;
  reconstructionWork: ConvexPlanarSolidReport['childNativeWork']; exactWorkIncludingReconstruction: ConvexPlanarSolidReport['exactWork'];
}
const FIELDS = ['request', 'graph', 'supports', 'certificate', 'report'];
const FACE_FIELDS = ['plane', 'loop', 'options', 'source', 'sourceVersion', 'model', 'topology', 'pcurves', 'bindings', 'report'];
function guarded<T>(action: () => T): T { try { return action(); } catch (cause) { if (cause instanceof ConvexPlanarSolidError) throw cause; throw new ConvexPlanarSolidError('NATIVE', 'Complete native face reconstruction or solid proof refused', cause); } }
function settings(input: unknown): ConvexPlanarSolidOptions { const r = record(input, ['solidId', 'resultIdPrefix']); return { solidId: id(r.solidId), resultIdPrefix: id(r.resultIdPrefix, 20) }; }
function array(value: unknown, minimum: number, maximum: number): unknown[] { check(Array.isArray(value) && value.length >= minimum && value.length <= maximum, 'BUDGET', 'Bounded inventory array required'); return value; }
function build(request: ConvexPlanarSolidResult['request'], proof: SolidProof): ConvexPlanarSolidResult {
  const input = record(request, ['assets', 'edgePairs', 'options']), options = settings(input.options);
  const assets = array(input.assets, 4, 12).map(item => { const a = record(item, ['sourceId', 'face']); id(a.sourceId); record(a.face, FACE_FIELDS); return a as unknown as ConvexPlanarSolidAsset; });
  const pairs = array(input.edgePairs, 6, 32).map(item => { const p = record(item, ['a', 'b']); for (const ref of [p.a, p.b]) { const r = record(ref, ['sourceId', 'useId']); id(r.sourceId); id(r.useId); } return p as unknown as ConvexPlanarSolidEdgePair; });
  check(new Set(assets.map(a => a.sourceId)).size === assets.length, 'IDENTITY', 'Unique original source namespaces required');
  const uses: { assetIndex: number; use: ConvexPlanarFaceUse }[] = [];
  // Full input snapshot precedes this admission; native compilation is delayed until coverage/bounds pass.
  for (const [assetIndex, asset] of assets.entries()) {
    const loop = record(asset.face.loop, ['id', 'edges']), topology = record(asset.face.topology, ['version', 'face', 'vertices', 'edges', 'loop']);
    const originalEdges = array(loop.edges, 3, 8), localLoop = record(topology.loop, ['id', 'uses']), localUses = array(localLoop.uses, 3, 8);
    check(originalEdges.length === localUses.length, 'COVERAGE', 'Every complete face edge must have one use');
    array(topology.vertices, 3, 8); array(topology.edges, 3, 8);
    for (const use of localUses) { const u = record(use, ['id', 'edgeId', 'curveId', 'vertexIds', 'sense', 'interval', 'pcurveId']); id(u.id); uses.push({ assetIndex, use: u as unknown as ConvexPlanarFaceUse }); }
  }
  check(uses.length <= 64 && pairs.length * 2 === uses.length, 'COVERAGE', 'Complete bounded directed-use coverage required');
  const locate = (ref: ConvexPlanarSolidUseReference): number => { const matches = uses.flatMap((item, i) => assets[item.assetIndex].sourceId === ref.sourceId && item.use.id === ref.useId ? [i] : []); check(matches.length === 1, 'IDENTITY', 'One source-qualified original use required'); return matches[0]; };
  const covered = new Set<number>(), planned = pairs.map(pair => { const a = locate(pair.a), b = locate(pair.b); check(a !== b && uses[a].assetIndex !== uses[b].assetIndex, 'INCIDENCE', 'An edge must join distinct source-qualified faces'); check(!covered.has(a) && !covered.has(b), 'COVERAGE', 'Repeated directed use in pairing'); covered.add(a); covered.add(b); return [a, b] as const; });
  check(covered.size === uses.length, 'COVERAGE', 'Every directed use must be paired once');
  check(uses.length - 2 * assets.length <= 40, 'BUDGET', 'Complete face fan triangle ceiling exceeded');
  // Exactly one reconstruction per supplied face. The original asset is retained, not replaced.
  for (const asset of assets) { const f = asset.face, rebuilt = buildConvexPlanarFace(f.plane, f.loop, f.options); check(same(f, rebuilt), 'OWNED', 'Complete supplied native face differs from reconstruction'); }
  const supports = assets.map(asset => proof.plane(asset.face)), r = proof.rational;
  const inventory = assets.flatMap((asset, assetIndex) => asset.face.topology.vertices.map(vertex => ({ assetIndex, vertex, parent: -1 })));
  inventory.forEach((v, i) => { v.parent = i; });
  const find = (i: number): number => { while (inventory[i].parent !== i) i = inventory[i].parent; return i; };
  const vertexIndex = (assetIndex: number, vertexId: string): number => { const index = inventory.findIndex(item => item.assetIndex === assetIndex && item.vertex.id === vertexId); check(index >= 0, 'IDENTITY', 'Original qualified vertex required'); return index; };
  const union = (a: number, b: number) => { const x = find(a), y = find(b); if (x !== y) inventory[Math.max(x, y)].parent = Math.min(x, y); };
  const parameterMaps = planned.map(([ai, bi]) => {
    const a = uses[ai], b = uses[bi], a0 = vertexIndex(a.assetIndex, a.use.vertexIds[0]), a1 = vertexIndex(a.assetIndex, a.use.vertexIds[1]), b0 = vertexIndex(b.assetIndex, b.use.vertexIds[0]), b1 = vertexIndex(b.assetIndex, b.use.vertexIds[1]);
    check(proof.equal(proof.point(inventory[a0].vertex.point), proof.point(inventory[b1].vertex.point)) && proof.equal(proof.point(inventory[a1].vertex.point), proof.point(inventory[b0].vertex.point)), 'BINDING', 'Explicit edge pair lacks opposite exact whole-segment correspondence');
    const scale = r.div(r.sub(r.from(b.use.interval[0]), r.from(b.use.interval[1])), r.sub(r.from(a.use.interval[1]), r.from(a.use.interval[0]))), offset = r.sub(r.from(b.use.interval[1]), r.mul(scale, r.from(a.use.interval[0])));
    union(a0, b1); union(a1, b0); return { scale: r.text(scale), offset: r.text(offset) };
  });
  const roots = inventory.flatMap((_, i) => find(i) === i ? [i] : []);
  check(roots.length >= 4 && roots.length <= 32, 'BUDGET', '4..32 declared vertex equivalence classes required');
  const points = roots.map(i => proof.point(inventory[i].vertex.point));
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) check(!proof.equal(points[i], points[j]), 'INCIDENCE', 'Coincident unpaired vertex classes refused');
  const vertexId = (assetIndex: number, local: string) => options.resultIdPrefix + '_v_' + roots.indexOf(find(vertexIndex(assetIndex, local)));
  const vertices: ConvexPlanarSolidGraph['vertices'] = roots.map((root, i) => ({ id: options.resultIdPrefix + '_v_' + i, pointMM: inventory[root].vertex.point, members: inventory.flatMap((item, j) => find(j) === root ? [{ sourceId: assets[item.assetIndex].sourceId, faceId: assets[item.assetIndex].face.options.faceId, vertexId: item.vertex.id }] : []) }));
  const edges: ConvexPlanarSolidGraph['edges'] = planned.map((pair, pairIndex) => {
    const a = uses[pair[0]], refs = pair.map(index => { const item = uses[index], asset = assets[item.assetIndex]; return { sourceId: asset.sourceId, faceId: asset.face.options.faceId, surfaceId: asset.face.plane.id, loopId: asset.face.loop.id, use: item.use }; });
    return { id: options.resultIdPrefix + '_e_' + pairIndex, pairIndex, vertexIds: [vertexId(a.assetIndex, a.use.vertexIds[0]), vertexId(a.assetIndex, a.use.vertexIds[1])], uses: refs, parameterMapAtoB: parameterMaps[pairIndex] };
  });
  for (let i = 0; i < edges.length; i++) { check(edges[i].vertexIds[0] !== edges[i].vertexIds[1], 'DEGENERATE', 'Collapsed paired edge'); for (let j = 0; j < i; j++) check(!edges[i].vertexIds.every(v => edges[j].vertexIds.includes(v)), 'INCIDENCE', 'Duplicate global edge refused'); }
  const faces: ConvexPlanarSolidGraph['faces'] = assets.map((asset, assetIndex) => ({ sourceId: asset.sourceId, faceId: asset.face.options.faceId, surfaceId: asset.face.plane.id, loopId: asset.face.loop.id, vertexIds: asset.face.topology.loop.uses.map(use => vertexId(assetIndex, use.vertexIds[0])), edgeIds: asset.face.topology.loop.uses.map(use => edges.find(edge => edge.uses.some(ref => ref.sourceId === asset.sourceId && ref.use.id === use.id))!.id) }));
  faces.forEach(face => check(new Set(face.vertexIds).size === face.vertexIds.length, 'INCIDENCE', 'Repeated global vertex within a facet'));
  const reached = new Set<number>([0]);
  for (let pass = 0; pass < assets.length; pass++) for (const [a, b] of planned) { const x = uses[a].assetIndex, y = uses[b].assetIndex; if (reached.has(x) || reached.has(y)) { reached.add(x); reached.add(y); } }
  check(reached.size === assets.length, 'INCIDENCE', 'Face adjacency graph is disconnected');
  const vertexLinks: ConvexPlanarSolidGraph['vertexLinks'] = vertices.map(vertex => {
    const arcs = faces.flatMap(face => { const i = face.vertexIds.indexOf(vertex.id); return i < 0 ? [] : [{ sourceId: face.sourceId, faceId: face.faceId, fromEdgeId: face.edgeIds[(i + face.edgeIds.length - 1) % face.edgeIds.length], toEdgeId: face.edgeIds[i] }]; });
    const incident = edges.filter(edge => edge.vertexIds.includes(vertex.id)).map(edge => edge.id);
    check(incident.length >= 3 && arcs.length === incident.length && incident.every(edge => arcs.filter(a => a.fromEdgeId === edge).length === 1 && arcs.filter(a => a.toEdgeId === edge).length === 1), 'INCIDENCE', 'Vertex link must have one incoming/outgoing corner per edge');
    const cycleEdgeIds: string[] = []; let cursor = incident[0];
    while (!cycleEdgeIds.includes(cursor)) { cycleEdgeIds.push(cursor); cursor = arcs.find(a => a.fromEdgeId === cursor)!.toEdgeId; }
    check(cursor === incident[0] && cycleEdgeIds.length === incident.length, 'INCIDENCE', 'Pinched or disconnected vertex link'); return { vertexId: vertex.id, arcs, cycleEdgeIds };
  });
  check(vertices.length - edges.length + faces.length === 2, 'INCIDENCE', 'Convex boundary Euler diagnostic must equal two');
  // Explicit affine rank3, independent of Euler, floating volume or cached native reports.
  const directions = points.slice(1).map(p => proof.sub(p, points[0])), first = directions.find(p => p.some(v => v.n !== 0n))!;
  const normal = directions.map(p => proof.cross(first, p)).find(p => p.some(v => v.n !== 0n));
  check(normal !== undefined && directions.some(p => proof.dot(normal, p).n !== 0n), 'DEGENERATE', 'Global vertices do not have affine rank three');
  const interior = proof.scale(points.reduce((sum, p) => proof.add(sum, p)), r.div(r.integer(1), r.integer(points.length)));
  let volume6 = r.integer(0);
  for (let i = 0; i < supports.length; i++) {
    const support = supports[i], face = faces[i];
    for (let j = 0; j < i; j++) check(proof.cross(support.normal, supports[j].normal).some(v => v.n !== 0n) || proof.dot(support.normal, proof.sub(supports[j].origin, support.origin)).n !== 0n, 'CONVEXITY', 'Duplicate or coplanar subdivided support refused');
    for (let j = 0; j < points.length; j++) {
      check(++proof.supportPredicates <= 384, 'BUDGET', 'Global support predicate ceiling exceeded');
      const value = proof.dot(support.normal, proof.sub(points[j], support.origin));
      check(value.n <= 0n, 'CONVEXITY', 'A global vertex lies in front of an outward support');
      check((value.n === 0n) === face.vertexIds.includes(vertices[j].id), 'CONVEXITY', 'Every coplanar global vertex must belong to the complete facet');
    }
    check(proof.dot(support.normal, proof.sub(interior, support.origin)).n < 0n, 'DEGENERATE', 'Strict interior witness required');
    for (let j = 1; j + 1 < support.vertices.length; j++) { check(++proof.fanTriangles <= 40, 'BUDGET', 'Fan triangle ceiling exceeded'); volume6 = r.add(volume6, proof.dot(support.vertices[0], proof.cross(support.vertices[j], support.vertices[j + 1]))); }
  }
  check(volume6.n > 0n, 'DEGENERATE', 'Positive exact signed occupied volume required');
  const nativeCount = uses.length * 3;
  const report: ConvexPlanarSolidReport = {
    schema: 'barocss-convex-planar-solid', version: 0, solidId: options.solidId, lengthUnit: 'mm', solid: true, faceCount: faces.length, edgeCount: edges.length, vertexCount: vertices.length,
    exactWork: { supportPredicates: proof.supportPredicates, coefficientProofs: proof.coefficientProofs, fanTriangles: proof.fanTriangles, ...r.counts() },
    childNativeWork: { completeFaceReconstructionCount: assets.length, sourceCompilationCount: assets.length, bindingObservationCount: nativeCount, curveD1Count: nativeCount, pcurveD1Count: nativeCount, surfaceD1Count: nativeCount, totalD1Count: nativeCount * 3, retries: 0, scope: 'direct-calls-and-known-parent-loop-work-not-hidden-provider-internals' },
    numericPolicy: 'exact-rationals-of-stored-binary64-no-welding-no-tolerance-promotion', qualificationScope: 'complete-convex-affine-facets-only-not-general-brep-or-manufacturing-tolerance', validationScope: 'whole-result-self-consistency-not-authenticity', childReportsUnchanged: true, persistentNamingCertified: false,
    limits: { faces: 12, directedUses: 64, pairs: 32, vertices: 32, supportPredicates: 384, coefficientProofs: 64, fanTriangles: 40, queryPoints: 64, queryPredicates: 768, rationalOperations: 200000, gcdSteps: 200000, integerBits: 8192, inputValues: 524288, resultValues: 786432, inputDepth: 24, resultDepth: 32, arrayElements: 4096, recordFields: 64, stringCharacters: 262144, inputStringCharacters: 4194304, resultStringCharacters: 8388608, inputBytes: 8388608, resultBytes: 16777216, cumulativeSnapshotBytes: 50331648, retainedInputAndResultBytes: 33554432 }, dataCharge: 'alias-occurrence-counted-serialized-json-utf8-not-v8-heap',
  };
  const result: ConvexPlanarSolidResult = { request, graph: { vertices, edges, faces, vertexLinks }, supports: supports.map((s, i) => ({ sourceId: assets[i].sourceId, faceId: faces[i].faceId, surfaceId: faces[i].surfaceId, originMM: proof.text(s.origin), outwardNormal: proof.text(s.normal), offset: r.text(proof.dot(s.normal, s.origin)) })), certificate: { family: 'exact-stored-affine-convex-polyhedron-v0', solid: true, boundary: 'complete-convex-hull-facets', vertexRank: 3, volumeMM3: r.text(r.div(volume6, r.integer(6))), strictInteriorMM: proof.text(interior), incidence: { connected: true, oppositeEdgeUses: true, vertexLinksSingleCycles: true, eulerCharacteristic: 2 } }, report };
  if (proof.certifiedLifts > 0) report.pcurveLift = { policy: 'exact-or-one-rounding-certified-v1', certifiedPoles: proof.certifiedLifts, maximumDeviationMM: proof.maximumLiftDeviationMM };
  // Serialization arithmetic is part of root exact work as well.
  result.report.exactWork = { supportPredicates: proof.supportPredicates, coefficientProofs: proof.coefficientProofs, fanTriangles: proof.fanTriangles, ...r.counts() }; return result;
}
function reconstruct(input: ConvexPlanarSolidResult, ledger: SolidSnapshotLedger, proof: SolidProof): ConvexPlanarSolidResult {
  const owned = record(input, FIELDS) as unknown as ConvexPlanarSolidResult;
  // Apply construction input ceilings to the retained request without a second native reconstruction.
  const request = ledger.copy(owned.request, false, true), expected = ledger.copy(build(request, proof), true);
  check(same(owned, expected), 'OWNED', 'Complete solid source/topology/certificate/report differs from reconstruction'); return expected;
}
/** Exact qualification of complete original convex planar facets; no geometry repair or tolerance sewing. */
export function qualifyConvexPlanarSolid(assets: ConvexPlanarSolidAsset[], edgePairs: ConvexPlanarSolidEdgePair[], options: ConvexPlanarSolidOptions): ConvexPlanarSolidResult {
  return guarded(() => { const ledger = new SolidSnapshotLedger(), proof = new SolidProof(), request = ledger.copy({ assets, edgePairs, options }); return ledger.copy(build(request, proof), true); });
}
/** Single complete reconstruction establishes owned-data self-consistency, not provenance/authenticity. */
export function validateConvexPlanarSolid(input: ConvexPlanarSolidResult): ConvexPlanarSolidReport {
  return guarded(() => { const ledger = new SolidSnapshotLedger(), proof = new SolidProof(); return ledger.copy(reconstruct(ledger.copy(input, true), ledger, proof).report, true); });
}
/** One reconstruction and one cumulative exact context for an entire bounded point batch. */
export function classifyConvexPlanarSolidPoints(input: ConvexPlanarSolidResult, points: Point[], options: ConvexPlanarSolidQueryOptions): ConvexPlanarSolidPointBatch {
  return guarded(() => {
    const ledger = new SolidSnapshotLedger(), proof = new SolidProof(), owned = ledger.copy({ input, points, options }, true), settings = record(owned.options, ['maximumHalfspacePredicates']);
    check(Number.isInteger(settings.maximumHalfspacePredicates) && (settings.maximumHalfspacePredicates as number) >= 1 && (settings.maximumHalfspacePredicates as number) <= 768, 'BUDGET', 'Query predicate ceiling1..768 required');
    const query = array(owned.points, 0, 64).map(p => { check(Array.isArray(p) && p.length === 3 && p.every(v => typeof v === 'number' && Number.isFinite(v)), 'INPUT', 'Finite XYZ query tuple required'); return p as Point; });
    const request = record(record(owned.input, FIELDS).request, ['assets', 'edgePairs', 'options']);
    check(query.length * array(request.assets, 4, 12).length <= (settings.maximumHalfspacePredicates as number), 'BUDGET', 'Batch support work exceeds requested ceiling before reconstruction');
    const result = reconstruct(owned.input, ledger, proof), r = proof.rational;
    const supports = result.supports.map(s => ({ origin: s.originMM.map(v => r.rat(BigInt(v.numerator), BigInt(v.denominator))) as ReturnType<SolidProof['point']>, normal: s.outwardNormal.map(v => r.rat(BigInt(v.numerator), BigInt(v.denominator))) as ReturnType<SolidProof['point']> }));
    const classifications = query.map(pointMM => {
      const point = proof.point(pointMM), supportSigns = supports.map(s => { check(++proof.queryPredicates <= 768, 'BUDGET', 'Query predicate ceiling exceeded'); const n = proof.dot(s.normal, proof.sub(point, s.origin)).n; return (n < 0n ? -1 : n > 0n ? 1 : 0) as -1 | 0 | 1; });
      const classification = supportSigns.includes(1) ? 'outside' : supportSigns.includes(0) ? 'boundary' : 'inside';
      return { pointMM, classification, supportSigns, incidentFaces: classification === 'boundary' ? result.supports.flatMap((s, i) => supportSigns[i] === 0 ? [{ sourceId: s.sourceId, faceId: s.faceId, surfaceId: s.surfaceId }] : []) : [] } as ConvexPlanarSolidPointClassification;
    });
    return ledger.copy({ solidId: result.report.solidId, points: classifications, halfspacePredicateCount: proof.queryPredicates, reconstructionWork: result.report.childNativeWork, exactWorkIncludingReconstruction: { supportPredicates: proof.supportPredicates, coefficientProofs: proof.coefficientProofs, fanTriangles: proof.fanTriangles, ...r.counts() } }, true);
  });
}
