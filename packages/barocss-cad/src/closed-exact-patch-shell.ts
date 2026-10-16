import { buildExactBoundaryFaceAdjacency } from './exact-boundary-face-adjacency.js';
import type { ExactBoundaryFaceAdjacencyAsset, ExactBoundaryFaceAdjacencyPair, ExactBoundaryFaceAdjacencyResult } from './exact-boundary-face-adjacency.js';
import type { SurfaceBoundary } from './boundary.js';
import { copyCadData } from './data-copy.js';
import { same } from './structural-equality.js';

export const ClosedExactPatchShellDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', COVERAGE: 'COVERAGE', CONNECTED: 'CONNECTED', BINDING: 'BINDING', NATIVE: 'NATIVE', INCIDENCE: 'INCIDENCE', OWNED: 'OWNED',
} as const);
export type ClosedExactPatchShellDiagnosticCode = typeof ClosedExactPatchShellDiagnosticCode[keyof typeof ClosedExactPatchShellDiagnosticCode];
export class ClosedExactPatchShellError extends Error {
  readonly code: ClosedExactPatchShellDiagnosticCode;
  constructor(code: ClosedExactPatchShellDiagnosticCode, detail: string, cause?: unknown) {
    super(('Closed exact patch Shell: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'ClosedExactPatchShellError'; this.code = code;
  }
}
export interface ClosedExactPatchShellOptions { shellId: string; resultIdPrefix: string; maximumPairEvaluations: number; maximumObservationPairs: number }
type VertexReference = ExactBoundaryFaceAdjacencyResult['vertexClasses'][number]['members'][number];
type CornerArc = { sourceId: string; faceId: string; vertexId: string; cornerIndex: number; previousEdgeId: string; nextEdgeId: string };
type VertexLink = { vertexClassId: string; incidentEdgeIds: string[]; cornerArcs: CornerArc[];
  degrees: { edgeId: string; degree: number; incoming: number; outgoing: number }[]; orientedCycleEdgeIds: string[]; orientedCycleArcIndices: number[] };
export interface ClosedExactPatchShellGraph {
  vertices: { id: string; representative: VertexReference; members: VertexReference[] }[];
  edges: { id: string; pairIndex: number; childEdgeId: string; vertexClassIds: [string, string]; uses: ExactBoundaryFaceAdjacencyResult['sharedEdges'][number]['uses'] }[];
  faces: { sourceId: string; faceId: string; loopId: string; vertexClassIds: [string, string, string, string]; edgeIds: [string, string, string, string] }[];
  vertexLinks: VertexLink[];
}
export interface ClosedExactPatchShellReport {
  schema: 'barocss-closed-exact-patch-shell'; version: 0; shellId: string; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  faceCount: number; edgeCount: number; vertexClassCount: number; vertexLinkCount: number; cornerArcCount: number; eulerCharacteristic: number;
  globalFreeBoundaryCount: 0; connectedFaceGraph: true; orientedClosedIncidence: true; abstractIncidenceManifold: true; closed: true;
  solid: false; geometricValidity: 'not-certified'; embeddedManifoldCertified: false; selfIntersectionCertified: false; insideOutsideCertified: false;
  childPairEvaluationCount: number;
  childDirectCounts: { sourceCompilationCount: number; faceValidationCount: number; boundaryExtractionCount: number;
    curveReversalCount: number; observationPairCount: number; curvePointEvaluationCount: number; curveDerivativeEvaluationCount: number };
  numericPolicy: { correspondence: 'unchanged1013-two-assets-one-pair-whole-native-proof';
    vertexUnion: 'only-actual-child-paired-endpoint-members-object-is-points'; vertexRepresentative: 'minimum-original-inventory-index';
    vertexLink: 'incident-global-edges-with-qualified-face-corner-arcs'; degree: 'arc-multiplicity-included-one-incoming-one-outgoing';
    parallelCycle: 'two-node-two-opposite-parallel-arcs-allowed'; euler: 'diagnostic-only-no-sphere-or-genus-claim';
    workCounts: 'direct-root-child-calls-and-sum-of-actual-child-direct-counters-not-hidden-descendant-work' };
  quality: { originalDataBitsPreserved: true; childClosedFalseScopePreserved: true; childLocalFreeBoundariesPreserved: true;
    weldingPerformed: false; sourceModelsMerged: false; supportRegularityCertified: false; continuityCertified: false;
    manufacturingToleranceCertified: false; globalBinary64ErrorCertified: false; persistentNamesCertified: false; ownership: 'independent-copied-cpu-data-gc' };
  budgetFailure: 'complete-global-coverage-connectivity-budget-and-id-preflight-atomic-no-partial-shell';
  limits: { maximumAssets: 6; maximumPairs: 12; maximumPairEvaluations: 12; maximumObservationPairs: 36; maximumOriginalVertices: 24;
    ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144; rootPrefixCharacters: 5; childPrefixCharacters: 8 };
}
export interface ClosedExactPatchShellResult { assets: ExactBoundaryFaceAdjacencyAsset[]; pairs: ExactBoundaryFaceAdjacencyPair[];
  options: ClosedExactPatchShellOptions; pairResults: ExactBoundaryFaceAdjacencyResult[]; graph: ClosedExactPatchShellGraph; report: ClosedExactPatchShellReport }

const CODE = ClosedExactPatchShellDiagnosticCode, ORDER: SurfaceBoundary[] = ['v-min', 'u-max', 'v-max', 'u-min'];
function check(condition: boolean, code: ClosedExactPatchShellDiagnosticCode, detail: string): asserts condition { if (!condition) throw new ClosedExactPatchShellError(code, detail); }
function record(value: unknown, fields: string[], code: ClosedExactPatchShellDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own Shell record is required'); const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own Shell fields are required'); return data;
}
function tuple(value: unknown, length: number): unknown[] { check(Array.isArray(value) && value.length === length, CODE.INPUT, 'A fixed native tuple is required'); return value; }
function id(value: unknown, maximum = 48): string { check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'A bounded ASCII Shell/context ID is required'); return value; }
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, code, 'Own value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, code, 'Own source string limit exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic plain own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
    check(keys.length <= (array ? 8193 : 64), code, 'Own field limit exceeded'); const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Getter, symbol, or hidden fields are refused');
    ancestors.add(value); let result: unknown;
    if (array) {
      const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded own arrays are required');
      result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse or extra own array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) { if (cause instanceof ClosedExactPatchShellError) throw cause; throw new ClosedExactPatchShellError(code, 'Own-data snapshot failed', cause); }
}
function vertexKey(vertex: Pick<VertexReference, 'sourceId' | 'faceId' | 'vertexId'>): string { return vertex.sourceId + ':' + vertex.faceId + ':' + vertex.vertexId; }
function boundaryKey(reference: { sourceId: string; boundary: SurfaceBoundary }): string { return reference.sourceId + ':' + reference.boundary; }
function connected(neighbors: Set<number>[]): boolean {
  const seen = new Set([0]), queue = [0]; for (let cursor = 0; cursor < queue.length; cursor++) for (const next of neighbors[queue[cursor]]) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  return seen.size === neighbors.length;
}
/** Only inspect safe structure/IDs here. Actual source and native Face validation remain in the unchanged child API. */
function basicAsset(value: unknown): ExactBoundaryFaceAdjacencyAsset {
  const asset = record(value, ['sourceId', 'source', 'face']); id(asset.sourceId); check(typeof asset.source === 'string', CODE.INPUT, 'An original bounded Source0 string is required');
  const face = record(asset.face, ['geometry', 'topology']), geometry = record(face.geometry, ['name', 'version', 'lengthUnit', 'objects']); id(geometry.name, 128);
  tuple(geometry.objects, 5).forEach((object, index) => { const data = record(object, index === 0 ? ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'] : ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']); id(data.id); });
  const topology = record(face.topology, ['version', 'face', 'vertices', 'edges', 'loop']), header = record(topology.face, ['id', 'surfaceId', 'outerLoopId', 'orientation']);
  id(header.id); id(header.surfaceId); id(header.outerLoopId);
  tuple(topology.vertices, 4).forEach(value => { const vertex = record(value, ['id', 'point']); id(vertex.id); check(tuple(vertex.point, 3).every(component => typeof component === 'number' && Number.isFinite(component)), CODE.INPUT, 'Original finite vertex points are required'); });
  tuple(topology.edges, 4).forEach(value => { const edge = record(value, ['id', 'curveId', 'vertexIds']); id(edge.id); id(edge.curveId); tuple(edge.vertexIds, 2).forEach(value => id(value)); });
  const loop = record(topology.loop, ['id', 'uses']); id(loop.id);
  tuple(loop.uses, 4).forEach(value => { const use = record(value, ['edgeId', 'sense', 'boundary', 'pcurve']); id(use.edgeId); const pcurve = record(use.pcurve, ['domain', 'uv0', 'uv1']);
    for (const field of ['domain', 'uv0', 'uv1']) check(tuple(pcurve[field], 2).every(component => typeof component === 'number' && Number.isFinite(component)), CODE.INPUT, 'Original finite pcurve tuples are required'); });
  return asset as unknown as ExactBoundaryFaceAdjacencyAsset;
}

/** Close an explicitly paired collection of original native quad Faces as an abstract oriented incidence manifold only. */
export function buildClosedExactPatchShell(assetsInput: ExactBoundaryFaceAdjacencyAsset[], pairsInput: ExactBoundaryFaceAdjacencyPair[], optionsInput: ClosedExactPatchShellOptions): ClosedExactPatchShellResult {
  const assetData = snapshot(assetsInput), pairData = snapshot(pairsInput), settings = record(snapshot(optionsInput), ['shellId', 'resultIdPrefix', 'maximumPairEvaluations', 'maximumObservationPairs']);
  check(Array.isArray(assetData) && assetData.length >= 2 && assetData.length <= 6, CODE.INPUT, 'Exactly2..6 source-qualified quad Face assets are required');
  check(Array.isArray(pairData), CODE.INPUT, 'An explicit complete boundary pairing list is required');
  const assets = assetData.map(basicAsset), bySource = new Map(assets.map((asset, index) => [asset.sourceId, index]));
  check(bySource.size === assets.length, CODE.IDENTITY, 'Global asset source IDs must be unique');
  const shellId = id(settings.shellId), resultIdPrefix = id(settings.resultIdPrefix, 5);
  for (const [field, maximum] of [['maximumPairEvaluations', 12], ['maximumObservationPairs', 36]] as const)
    check(typeof settings[field] === 'number' && Number.isInteger(settings[field]) && settings[field] >= 0 && settings[field] <= maximum, CODE.BUDGET, 'Complete integer Shell work budgets are required');
  const options: ClosedExactPatchShellOptions = { shellId, resultIdPrefix, maximumPairEvaluations: settings.maximumPairEvaluations as number, maximumObservationPairs: settings.maximumObservationPairs as number };
  check(pairData.length === 2 * assets.length && pairData.length <= 12, CODE.COVERAGE, 'Exactly2N pairs must cover all4N original qualified boundaries');
  const reached = new Set<string>(), faceNeighbors = assets.map(() => new Set<number>());
  const pairs: ExactBoundaryFaceAdjacencyPair[] = pairData.map(value => {
    const pair = record(value, ['first', 'second']); const select = (value: unknown) => { const reference = record(value, ['sourceId', 'boundary']); id(reference.sourceId);
      check(ORDER.includes(reference.boundary as SurfaceBoundary) && bySource.has(reference.sourceId as string), CODE.COVERAGE, 'Every boundary selector must identify one current original asset'); return reference as unknown as ExactBoundaryFaceAdjacencyPair['first']; };
    const first = select(pair.first), second = select(pair.second); check(first.sourceId !== second.sourceId, CODE.COVERAGE, 'A pair cannot reuse one source Face on both sides');
    for (const reference of [first, second]) { const key = boundaryKey(reference); check(!reached.has(key), CODE.COVERAGE, 'Duplicate, reused or third boundary uses are refused'); reached.add(key); }
    const a = bySource.get(first.sourceId)!, b = bySource.get(second.sourceId)!; faceNeighbors[a].add(b); faceNeighbors[b].add(a); return { first, second };
  });
  check(assets.every(asset => ORDER.every(boundary => reached.has(boundaryKey({ sourceId: asset.sourceId, boundary })))) && reached.size === 4 * assets.length, CODE.COVERAGE, 'Every original local boundary must be paired exactly once');
  check(connected(faceNeighbors), CODE.CONNECTED, 'The complete original Face graph must be connected before child work');
  check(pairs.length <= options.maximumPairEvaluations && 3 * pairs.length <= options.maximumObservationPairs, CODE.BUDGET, 'All child pair evaluations and three diagnostic observation pairs per child must fit the complete budget');
  const reserved = new Set(assets.flatMap(asset => [asset.sourceId, asset.face.geometry.name, ...asset.face.geometry.objects.map(object => object.id),
    asset.face.topology.face.id, asset.face.topology.loop.id, ...asset.face.topology.vertices.map(vertex => vertex.id), ...asset.face.topology.edges.map(edge => edge.id)])); reserved.add('curve_reverse_original');
  const reserve = (value: string) => { id(value); check(!reserved.has(value), CODE.IDENTITY, 'All root/child output IDs must be reserved against all current original contexts before work'); reserved.add(value); return value; };
  reserve(shellId);
  const edgeIds = pairs.map((_, index) => reserve(resultIdPrefix + '_e' + index));
  const vertexIds = Array.from({ length: 4 * assets.length }, (_, index) => reserve(resultIdPrefix + '_v' + index));
  const childIds = pairs.map((_, index) => { const prefix = resultIdPrefix + '_' + index; id(prefix, 8); reserve(prefix); reserve(prefix + '_e0'); reserve(prefix + '_r0');
    for (let vertex = 0; vertex < 8; vertex++) reserve(prefix + '_v' + vertex); return prefix; });
  const inventory: VertexReference[] = assets.flatMap(asset => asset.face.topology.vertices.map(vertex => ({ sourceId: asset.sourceId, faceId: asset.face.topology.face.id, vertexId: vertex.id, pointMM: vertex.point })));
  const inventoryIndex = new Map(inventory.map((vertex, index) => [vertexKey(vertex), index]));
  check(inventoryIndex.size === inventory.length, CODE.IDENTITY, 'Original qualified vertex inventory must be unique');
  const parents = inventory.map((_, index) => index); const root = (index: number): number => { while (parents[index] !== index) index = parents[index]; return index; };
  const indexOf = (reference: VertexReference): number => { const index = inventoryIndex.get(vertexKey(reference));
    check(index !== undefined && same(reference, inventory[index]), CODE.BINDING, 'Every child endpoint member must retain complete qualified original vertex and point bits'); return index; };
  const join = (a: number, b: number) => {
    const ra = root(a), rb = root(b); check(same(inventory[a].pointMM, inventory[b].pointMM), CODE.BINDING, 'Explicit child endpoint point bits disagree'); if (ra === rb) return;
    const members = inventory.filter((_, index) => root(index) === ra || root(index) === rb), sources = members.map(member => member.sourceId + ':' + member.faceId);
    check(new Set(sources).size === sources.length, CODE.INCIDENCE, 'A global vertex class cannot collapse two distinct vertices within one original source Face'); parents[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  const pairResults: ExactBoundaryFaceAdjacencyResult[] = pairs.map((pair, index) => {
    const selectedAssets = [assets[bySource.get(pair.first.sourceId)!], assets[bySource.get(pair.second.sourceId)!]];
    let child: ExactBoundaryFaceAdjacencyResult;
    try { child = buildExactBoundaryFaceAdjacency(selectedAssets, [pair], { evaluationId: childIds[index], resultIdPrefix: childIds[index], maximumCurveReversals: 1, maximumObservationPairs: 3 }); }
    catch (cause) { throw new ClosedExactPatchShellError(CODE.NATIVE, 'Actual unchanged1013 pair proof failed at pair ' + index, cause); }
    check(same(child.assets, selectedAssets) && same(child.report.pairs, [pair]) && child.sharedEdges.length === 1 && child.freeBoundaries.length === 6
      && child.report.quality.closed === false && child.report.pairCount === 1, CODE.BINDING, 'Child must retain its entire original two-asset one-pair open scope');
    const edge = child.sharedEdges[0];
    check(edge.uses[0].sourceId === pair.first.sourceId && edge.uses[0].boundary === pair.first.boundary && edge.uses[1].sourceId === pair.second.sourceId
      && edge.uses[1].boundary === pair.second.boundary && edge.uses[0].effectiveSense === 'forward' && edge.uses[1].effectiveSense === 'reverse', CODE.BINDING, 'Actual child qualified pair uses and opposite senses changed');
    for (const use of edge.uses) {
      const original = assets[bySource.get(use.sourceId)!], useIndex = ORDER.indexOf(use.boundary), originalEdge = original.face.topology.edges[useIndex], originalUse = original.face.topology.loop.uses[useIndex];
      check(use.faceId === original.face.topology.face.id && use.surfaceId === original.face.geometry.objects[0].id && use.loopId === original.face.topology.loop.id
        && use.useIndex === useIndex && use.edgeId === originalEdge.id && use.curveId === originalEdge.curveId && same(use.vertexIds, originalEdge.vertexIds)
        && same(use.pcurve, originalUse.pcurve) && use.originalSense === originalUse.sense, CODE.BINDING, 'Every child qualified use and inline pcurve must retain its complete original references');
    }
    check(same(edge.canonical, { sourceId: edge.uses[0].sourceId, faceId: edge.uses[0].faceId, edgeId: edge.uses[0].edgeId, curveId: edge.uses[0].curveId }), CODE.BINDING, 'Child canonical curve reference must remain the actual first original source curve');
    for (const [endpointIndex, classId] of edge.endpointClassIds.entries()) {
      const endpointClass = child.vertexClasses.find(value => value.id === classId); check(endpointClass !== undefined && endpointClass.members.length === 2, CODE.BINDING, 'Each paired endpoint must retain its two actual child class members');
      const expectedKeys = [vertexKey({ sourceId: edge.uses[0].sourceId, faceId: edge.uses[0].faceId, vertexId: edge.uses[0].vertexIds[endpointIndex] }),
        vertexKey({ sourceId: edge.uses[1].sourceId, faceId: edge.uses[1].faceId, vertexId: edge.uses[1].vertexIds[1 - endpointIndex] })];
      check(endpointClass.members.every(member => expectedKeys.includes(vertexKey(member))), CODE.BINDING, 'Actual child endpoint class must associate the original first endpoint and opposite second endpoint');
      const a = indexOf(endpointClass.members[0]), b = indexOf(endpointClass.members[1]);
      check(endpointClass.members[0].sourceId !== endpointClass.members[1].sourceId, CODE.BINDING, 'Actual child paired endpoint members require different original owners'); join(a, b);
    }
    return child;
  });
  const vertices: ClosedExactPatchShellGraph['vertices'] = [], classByRoot = new Map<number, string>();
  for (const [index] of inventory.entries()) { const r = root(index); if (classByRoot.has(r)) continue; const id = vertexIds[vertices.length], members = inventory.filter((_, index) => root(index) === r);
    check(members.every(member => same(member.pointMM, inventory[r].pointMM)) && new Set(members.map(member => member.sourceId + ':' + member.faceId)).size === members.length,
      CODE.INCIDENCE, 'Every complete global class requires exact points and one vertex per source Face'); classByRoot.set(r, id); vertices.push({ id, representative: inventory[r], members }); }
  const classOf = (vertex: VertexReference): string => { const id = classByRoot.get(root(indexOf(vertex))); check(id !== undefined, CODE.BINDING, 'Every actual vertex must retain one global class'); return id; };
  const edges: ClosedExactPatchShellGraph['edges'] = pairResults.map((child, pairIndex) => {
    const edge = child.sharedEdges[0], vertexClassIds = edge.endpointClassIds.map(id => {
      const endpoint = child.vertexClasses.find(value => value.id === id)!; const first = classOf(endpoint.members[0]); check(endpoint.members.every(member => classOf(member) === first), CODE.BINDING, 'Actual child endpoint association was not preserved globally'); return first;
    }) as [string, string];
    check(vertexClassIds[0] !== vertexClassIds[1], CODE.INCIDENCE, 'A closed Shell edge must have two distinct endpoint classes');
    return { id: edgeIds[pairIndex], pairIndex, childEdgeId: edge.id, vertexClassIds, uses: edge.uses };
  });
  const edgeByBoundary = new Map<string, ClosedExactPatchShellGraph['edges'][number]>(), provedNeighbors = assets.map(() => new Set<number>());
  for (const edge of edges) {
    check(edge.uses.length === 2 && edge.uses[0].sourceId !== edge.uses[1].sourceId && edge.uses[0].effectiveSense === 'forward' && edge.uses[1].effectiveSense === 'reverse', CODE.INCIDENCE, 'Every global edge requires exactly two actual opposite source-qualified uses');
    for (const use of edge.uses) { const key = boundaryKey(use); check(!edgeByBoundary.has(key), CODE.COVERAGE, 'Every original boundary must map to only one global edge'); edgeByBoundary.set(key, edge); }
    const a = bySource.get(edge.uses[0].sourceId)!, b = bySource.get(edge.uses[1].sourceId)!; provedNeighbors[a].add(b); provedNeighbors[b].add(a);
  }
  check(edgeByBoundary.size === 4 * assets.length && connected(provedNeighbors), CODE.CONNECTED, 'The complete actual edge-use proof must retain connected Face coverage');
  const faces: ClosedExactPatchShellGraph['faces'] = assets.map(asset => ({ sourceId: asset.sourceId, faceId: asset.face.topology.face.id, loopId: asset.face.topology.loop.id,
    vertexClassIds: asset.face.topology.vertices.map(vertex => classOf({ sourceId: asset.sourceId, faceId: asset.face.topology.face.id, vertexId: vertex.id, pointMM: vertex.point })) as [string, string, string, string],
    edgeIds: ORDER.map(boundary => { const edge = edgeByBoundary.get(boundaryKey({ sourceId: asset.sourceId, boundary })); check(edge !== undefined, CODE.COVERAGE, 'No original local boundary may be omitted'); return edge.id; }) as [string, string, string, string] }));
  for (const face of faces) {
    check(new Set(face.vertexClassIds).size === 4 && new Set(face.edgeIds).size === 4, CODE.INCIDENCE, 'Each actual quad must retain four distinct vertices and local boundary edges');
    for (let index = 0; index < 4; index++) { const edge = edges.find(edge => edge.id === face.edgeIds[index])!, use = edge.uses.find(use => use.sourceId === face.sourceId && use.faceId === face.faceId);
      check(use !== undefined && use.useIndex === index && use.vertexIds[0] === assets[bySource.get(face.sourceId)!].face.topology.vertices[index].id
        && use.vertexIds[1] === assets[bySource.get(face.sourceId)!].face.topology.vertices[(index + 1) % 4].id, CODE.BINDING, 'Actual child use must preserve original quad boundary/corner order');
      check(same(use.effectiveSense === 'forward' ? edge.vertexClassIds : [edge.vertexClassIds[1], edge.vertexClassIds[0]], [face.vertexClassIds[index], face.vertexClassIds[(index + 1) % 4]]), CODE.INCIDENCE, 'Actual oriented edge endpoints do not retain the original Face cycle'); }
  }
  const vertexLinks: VertexLink[] = vertices.map(vertex => {
    const incidentEdgeIds = edges.filter(edge => edge.vertexClassIds.includes(vertex.id)).map(edge => edge.id);
    const cornerArcs: CornerArc[] = faces.flatMap(face => face.vertexClassIds.flatMap((id, cornerIndex) => id === vertex.id ? [{ sourceId: face.sourceId, faceId: face.faceId,
      vertexId: assets[bySource.get(face.sourceId)!].face.topology.vertices[cornerIndex].id, cornerIndex, previousEdgeId: face.edgeIds[(cornerIndex + 3) % 4], nextEdgeId: face.edgeIds[cornerIndex] }] : []));
    check(incidentEdgeIds.length >= 2 && cornerArcs.length === vertex.members.length && cornerArcs.every(arc => arc.previousEdgeId !== arc.nextEdgeId
      && incidentEdgeIds.includes(arc.previousEdgeId) && incidentEdgeIds.includes(arc.nextEdgeId)), CODE.INCIDENCE, 'Every vertex link requires actual qualified Face-corner arcs between distinct incident global edges');
    const degrees = incidentEdgeIds.map(edgeId => { const incoming = cornerArcs.filter(arc => arc.nextEdgeId === edgeId).length, outgoing = cornerArcs.filter(arc => arc.previousEdgeId === edgeId).length;
      check(incoming === 1 && outgoing === 1, CODE.INCIDENCE, 'Each vertex-link node requires one incoming and one outgoing arc, counting multiplicity'); return { edgeId, degree: incoming + outgoing, incoming, outgoing }; });
    const orientedCycleEdgeIds: string[] = [], orientedCycleArcIndices: number[] = [], seen = new Set<string>(); let current = incidentEdgeIds[0];
    for (let step = 0; step < incidentEdgeIds.length; step++) { check(!seen.has(current), CODE.INCIDENCE, 'A vertex link contains an early or disconnected cycle'); seen.add(current); orientedCycleEdgeIds.push(current);
      const arcIndex = cornerArcs.findIndex(arc => arc.previousEdgeId === current); check(arcIndex >= 0, CODE.INCIDENCE, 'Complete oriented vertex-link continuation is required'); orientedCycleArcIndices.push(arcIndex); current = cornerArcs[arcIndex].nextEdgeId; }
    check(current === incidentEdgeIds[0] && seen.size === incidentEdgeIds.length && new Set(orientedCycleArcIndices).size === cornerArcs.length,
      CODE.INCIDENCE, 'Every node and actual corner arc must belong to one complete connected oriented vertex-link cycle');
    return { vertexClassId: vertex.id, incidentEdgeIds, cornerArcs, degrees, orientedCycleEdgeIds, orientedCycleArcIndices };
  });
  const graph: ClosedExactPatchShellGraph = { vertices, edges, faces, vertexLinks }, cornerArcCount = vertexLinks.reduce((count, link) => count + link.cornerArcs.length, 0);
  check(cornerArcCount === 4 * assets.length, CODE.INCIDENCE, 'Every original Face corner must occur in exactly one accounted vertex link');
  const childDirectCounts = { sourceCompilationCount: 0, faceValidationCount: 0, boundaryExtractionCount: 0, curveReversalCount: 0, observationPairCount: 0, curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0 };
  for (const child of pairResults) for (const field of Object.keys(childDirectCounts) as (keyof typeof childDirectCounts)[]) childDirectCounts[field] += child.report[field];
  check(childDirectCounts.sourceCompilationCount === 2 * pairs.length && childDirectCounts.faceValidationCount === 2 * pairs.length
    && childDirectCounts.boundaryExtractionCount === 2 * pairs.length && childDirectCounts.curveReversalCount === pairs.length
    && childDirectCounts.observationPairCount === 3 * pairs.length && childDirectCounts.curvePointEvaluationCount === 6 * pairs.length && childDirectCounts.curveDerivativeEvaluationCount === 6 * pairs.length,
  CODE.BINDING, 'Actual child direct call counters do not retain their frozen one-pair scopes');
  const report: ClosedExactPatchShellReport = { schema: 'barocss-closed-exact-patch-shell', version: 0, shellId, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    faceCount: faces.length, edgeCount: edges.length, vertexClassCount: vertices.length, vertexLinkCount: vertexLinks.length, cornerArcCount, eulerCharacteristic: vertices.length - edges.length + faces.length,
    globalFreeBoundaryCount: 0, connectedFaceGraph: true, orientedClosedIncidence: true, abstractIncidenceManifold: true, closed: true, solid: false, geometricValidity: 'not-certified',
    embeddedManifoldCertified: false, selfIntersectionCertified: false, insideOutsideCertified: false, childPairEvaluationCount: pairResults.length, childDirectCounts,
    numericPolicy: { correspondence: 'unchanged1013-two-assets-one-pair-whole-native-proof', vertexUnion: 'only-actual-child-paired-endpoint-members-object-is-points', vertexRepresentative: 'minimum-original-inventory-index',
      vertexLink: 'incident-global-edges-with-qualified-face-corner-arcs', degree: 'arc-multiplicity-included-one-incoming-one-outgoing', parallelCycle: 'two-node-two-opposite-parallel-arcs-allowed',
      euler: 'diagnostic-only-no-sphere-or-genus-claim', workCounts: 'direct-root-child-calls-and-sum-of-actual-child-direct-counters-not-hidden-descendant-work' },
    quality: { originalDataBitsPreserved: true, childClosedFalseScopePreserved: true, childLocalFreeBoundariesPreserved: true, weldingPerformed: false, sourceModelsMerged: false,
      supportRegularityCertified: false, continuityCertified: false, manufacturingToleranceCertified: false, globalBinary64ErrorCertified: false, persistentNamesCertified: false, ownership: 'independent-copied-cpu-data-gc' },
    budgetFailure: 'complete-global-coverage-connectivity-budget-and-id-preflight-atomic-no-partial-shell',
    limits: { maximumAssets: 6, maximumPairs: 12, maximumPairEvaluations: 12, maximumObservationPairs: 36, maximumOriginalVertices: 24,
      ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144, rootPrefixCharacters: 5, childPrefixCharacters: 8 } };
  return snapshot({ assets, pairs, options, pairResults, graph, report }, true) as ClosedExactPatchShellResult;
}

/** Rebuild every unchanged native child proof and the complete global incidence/link graph, then bit-check the owned result. */
export function validateClosedExactPatchShell(input: ClosedExactPatchShellResult): ClosedExactPatchShellReport {
  const owned = record(snapshot(input, true), ['assets', 'pairs', 'options', 'pairResults', 'graph', 'report'], CODE.OWNED) as unknown as ClosedExactPatchShellResult;
  let expected: ClosedExactPatchShellResult;
  try { expected = buildClosedExactPatchShell(owned.assets, owned.pairs, owned.options); } catch (cause) { throw new ClosedExactPatchShellError(CODE.OWNED, 'Whole owned closed incidence reconstruction failed', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned original sources, pairs, children, classes, oriented links, graph or counters changed'); return copyCadData(expected.report);
}
