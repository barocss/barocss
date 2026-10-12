import { validateXYAffineSketch } from './xy-affine-sketch.js';
import type { XYAffineSketchSuccess } from './xy-affine-sketch.js';
import { buildConvexPlanarFace } from './own-convex-planar-face.js';
import type { ConvexPlanarFaceResult } from './own-convex-planar-face.js';
import { qualifyConvexPlanarSolid } from './convex-planar-solid.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidAsset, ConvexPlanarSolidEdgePair } from './convex-planar-solid.js';
import { SolidSnapshotLedger, same, record, id } from './convex-planar-solid-proof-internal.js';
import type { Curve, Point, Surface } from './types.js';

export interface XYAffineSketchPrismOptions {
  sourceId: string; sourceRevision: number; orderedSegmentIds: string[]; heightMM: number;
  capChart: { originXY: [number, number]; spanXY: [number, number] };
  solidId: string; resultIdPrefix: string;
}
export interface XYAffineSketchPrismWallReference { sourceId: string; sketchId: string; sourceRevision: number; segmentId: string }
export interface XYAffineSketchPrismFaceReference { sourceId: string; faceId: string; surfaceId: string }
export interface XYAffineSketchPrismLineage {
  sourceId: string; sketchId: string; sourceRevision: number;
  caps: { role: 'bottom' | 'top'; status: 'generated'; target: XYAffineSketchPrismFaceReference }[];
  segments: { segmentId: string; startPointId: string; endPointId: string; status: 'preserved'; wall: XYAffineSketchPrismFaceReference;
    bottomEdgeId: string; topEdgeId: string; boundaryEdgeStatus: 'generated'; nativeParameterDomain: [number, number] }[];
  points: { pointId: string; status: 'generated'; verticalEdgeId: string; bottomVertexId: string; topVertexId: string }[];
}
export interface XYAffineSketchPrismReport {
  schema: 'barocss-xy-affine-sketch-prism'; version: 0; solid: true; sourceId: string; sketchId: string; sourceRevision: number;
  profileOrientation: 'ccw' | 'cw'; segmentCount: number; heightMM: number;
  childNativeWork: { sketchReconstructionCount: 1; initialFaceConstructionCount: number; solidQualificationCount: 1;
    solidFaceReconstructionCount: number; sourceCompilationCount: number; bindingObservationCount: number; totalD1Count: number; retries: 0 };
  exactWork: { sketch: XYAffineSketchSuccess['report']['rationalWork']; solid: ConvexPlanarSolidResult['report']['exactWork'] };
  limits: { segments: 8; facets: 10; directedUses: 48; edgePairs: 24; vertices: 16; fanTriangles: 28;
    sourceCompilations: 21; bindingObservations: 288; totalD1: 864 };
  numericPolicy: 'declared-cap-chart-natural-wall-chart-exact-stored-solid-proof-no-retry';
  revisionPolicy: 'explicit-caller-revision-complete-source-reconstruction-no-historical-authenticity';
  persistentNamingCertified: false; manufacturingToleranceCertified: false;
}
export interface XYAffineSketchPrismResult {
  request: { sketch: XYAffineSketchSuccess; options: XYAffineSketchPrismOptions };
  solid: ConvexPlanarSolidResult; lineage: XYAffineSketchPrismLineage; report: XYAffineSketchPrismReport;
}
export interface XYAffineSketchPrismWallResolution {
  reference: XYAffineSketchPrismWallReference; currentRevision: number;
  status: 'preserved' | 'deleted' | 'stale'; targets: XYAffineSketchPrismFaceReference[];
}
export type XYAffineSketchPrismStage = 'input' | 'sketch' | 'cycle' | 'chart' | 'face' | 'qualification' | 'lineage' | 'result' | 'reference';
export class XYAffineSketchPrismError extends Error {
  constructor(readonly stage: XYAffineSketchPrismStage, readonly entityId: string | null, detail: string, cause?: unknown) {
    super(('XY affine sketch prism: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'XYAffineSketchPrismError';
  }
}
function at<T>(stage: XYAffineSketchPrismStage, entityId: string | null, action: () => T): T {
  try { return action(); } catch (cause) {
    if (cause instanceof XYAffineSketchPrismError) throw cause;
    throw new XYAffineSketchPrismError(stage, entityId, cause instanceof Error ? cause.message : 'Native operation refused', cause);
  }
}
function check(condition: boolean, stage: XYAffineSketchPrismStage, entityId: string | null, message: string): asserts condition {
  if (!condition) throw new XYAffineSketchPrismError(stage, entityId, message);
}
function revision(value: unknown): asserts value is number { check(Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 2147483647, 'input', null, 'Revision integer0..2147483647 required'); }
function tuple(value: unknown, positive = false): asserts value is [number, number] {
  check(Array.isArray(value) && value.length === 2 && value.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 10000 && (!positive || v > 0)), 'chart', null, 'Bounded finite XY tuple required');
}
function settings(input: unknown): XYAffineSketchPrismOptions {
  const o = record(input, ['sourceId', 'sourceRevision', 'orderedSegmentIds', 'heightMM', 'capChart', 'solidId', 'resultIdPrefix']);
  id(o.sourceId); id(o.solidId); id(o.resultIdPrefix, 12); revision(o.sourceRevision);
  check(typeof o.heightMM === 'number' && Number.isFinite(o.heightMM) && o.heightMM > 0 && o.heightMM <= 10000, 'input', null, 'Finite +Z height >0..10000mm required');
  check(Array.isArray(o.orderedSegmentIds) && o.orderedSegmentIds.length >= 3 && o.orderedSegmentIds.length <= 8, 'cycle', null, '3..8 explicit ordered segment IDs required');
  o.orderedSegmentIds.forEach(value => id(value));
  check(new Set(o.orderedSegmentIds).size === o.orderedSegmentIds.length, 'cycle', null, 'Repeated segment identity refused');
  const chart = record(o.capChart, ['originXY', 'spanXY']); tuple(chart.originXY); tuple(chart.spanXY, true);
  return o as unknown as XYAffineSketchPrismOptions;
}
// Error-free two-sum residual: refuse an unrepresentable declared chart corner, never change the chart.
function exactAdd(a: number, b: number): number {
  const sum = a + b, virtual = sum - a, error = (a - (sum - virtual)) + (b - virtual);
  check(Number.isFinite(sum) && Math.abs(sum) <= 10000 && error === 0, 'chart', null, 'Declared cap chart corner is not exactly representable within +/-10000mm'); return sum;
}
function plane(name: string, corners: [[Point, Point], [Point, Point]]): Surface {
  return { kind: 'surface', id: name + '_s', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: corners, weights: [[1, 1], [1, 1]] };
}
function line(name: string, a: Point, b: Point): Curve { return { kind: 'curve', id: name, degree: 1, knots: [0, 0, 1, 1], controlPoints: [a, b], weights: [1, 1] }; }
interface Recipe { name: string; face: ConvexPlanarFaceResult; edgeKeys: string[] }
function build(request: XYAffineSketchPrismResult['request']): XYAffineSketchPrismResult {
  const options = at('input', null, () => settings(request.options)), { sketch } = request, n = options.orderedSegmentIds.length;
  // All nested calls are bounded: one sketch reconstruction, n+2 faces, one solid qualification.
  at('sketch', options.sourceId, () => validateXYAffineSketch(sketch));
  const segments = options.orderedSegmentIds.map(segmentId => {
    const found = sketch.document.segments.find(segment => segment.id === segmentId);
    check(found !== undefined, 'cycle', segmentId, 'Unknown authored segment identity'); return found;
  });
  check(segments.length === sketch.document.segments.length, 'cycle', options.sourceId, 'Explicit cycle must cover every authored segment');
  check(new Set(segments.map(s => s.startPointId)).size === n, 'cycle', options.sourceId, 'Repeated cycle point identity refused');
  const curves = segments.map((segment, i) => {
    check(segment.endPointId === segments[(i + 1) % n].startPointId, 'cycle', segment.id, 'Authored endpoint identities do not form one directed closed cycle');
    const curve = sketch.solution.model.objects.find(object => object.id === segment.id);
    check(curve?.kind === 'curve' && curve.degree === 1 && curve.controlPoints.length === 2 && curve.knots.length === 4 && curve.weights.every(w => w === 1), 'cycle', segment.id, 'Actual native two-pole degree1 line required');
    for (const [j, pointId] of [segment.startPointId, segment.endPointId].entries()) {
      const point = sketch.solution.points.find(p => p.id === pointId);
      check(point !== undefined && same(curve.controlPoints[j], [...point.position, 0]), 'cycle', segment.id, 'Actual native endpoints differ from authored solved point identities');
    }
    return curve;
  });
  const bottom = curves.map(c => c.controlPoints[0]), top = bottom.map(p => [p[0], p[1], options.heightMM] as Point);
  const { originXY: [x, y], spanXY: [sx, sy] } = options.capChart, x1 = exactAdd(x, sx), y1 = exactAdd(y, sy);
  const prefix = options.resultIdPrefix, recipes: Recipe[] = [];
  const add = (name: string, support: Surface, edges: Curve[], edgeKeys: string[], orientation: 'forward' | 'reverse', entity: string): ConvexPlanarFaceResult => {
    const face = at('face', entity, () => buildConvexPlanarFace(support, { id: name + '_l', edges }, { faceId: name + '_f', evaluationId: name + '_m', resultIdPrefix: name, orientation }));
    recipes.push({ name, face, edgeKeys }); return face;
  };
  const cap = (role: 'bottom' | 'top', z: number) => {
    const name = prefix + (role === 'bottom' ? '_b' : '_t');
    return add(name, plane(name, [[[x, y, z], [x, y1, z]], [[x1, y, z], [x1, y1, z]]]),
      curves.map(c => ({ ...c, controlPoints: c.controlPoints.map(p => [p[0], p[1], z] as Point) })),
      segments.map(s => role + ':' + s.id), role === 'bottom' ? 'reverse' : 'forward', options.sourceId);
  };
  const bottomFace = cap('bottom', 0); cap('top', options.heightMM);
  const orientation = bottomFace.report.authoredOrientation;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, name = prefix + '_w_' + i, vertices = [bottom[i], bottom[j], top[j], top[i]], segment = segments[i];
    add(name, plane(name, [[bottom[i], top[i]], [bottom[j], top[j]]]),
      vertices.map((p, k) => line(name + '_c_' + k, p, vertices[(k + 1) % 4])),
      ['bottom:' + segment.id, 'vertical:' + segment.endPointId, 'top:' + segment.id, 'vertical:' + segment.startPointId],
      orientation === 'ccw' ? 'forward' : 'reverse', segment.id);
  }
  const pairsByKey = new Map<string, ConvexPlanarSolidEdgePair['a'][]>();
  for (const recipe of recipes) for (const [i, curve] of recipe.face.loop.edges.entries()) {
    const use = recipe.face.topology.loop.uses.find(u => u.curveId === curve.id)!;
    const key = recipe.edgeKeys[i], members = pairsByKey.get(key) ?? []; members.push({ sourceId: recipe.name, useId: use.id }); pairsByKey.set(key, members);
  }
  const keys = [...pairsByKey.keys()], edgePairs = keys.map(key => {
    const uses = pairsByKey.get(key)!; check(uses.length === 2, 'lineage', key, 'Every authored edge incidence must declare exactly two uses'); return { a: uses[0], b: uses[1] };
  });
  const assets: ConvexPlanarSolidAsset[] = recipes.map(r => ({ sourceId: r.name, face: r.face }));
  const solid = at('qualification', options.solidId, () => qualifyConvexPlanarSolid(assets, edgePairs, { solidId: options.solidId, resultIdPrefix: prefix }));
  const faceRef = (recipe: Recipe): XYAffineSketchPrismFaceReference => ({ sourceId: recipe.name, faceId: recipe.face.options.faceId, surfaceId: recipe.face.plane.id });
  const edgeId = (key: string): string => solid.graph.edges[keys.indexOf(key)].id;
  const vertexId = (recipe: Recipe, curveIndex: number): string => {
    const originalVertex = recipe.face.topology.edges[curveIndex].vertexIds[0];
    const vertex = solid.graph.vertices.find(v => v.members.some(m => m.sourceId === recipe.name && m.vertexId === originalVertex));
    check(vertex !== undefined, 'lineage', originalVertex, 'Source-qualified vertex missing from qualified graph'); return vertex.id;
  };
  const lineage: XYAffineSketchPrismLineage = {
    sourceId: options.sourceId, sketchId: sketch.document.id, sourceRevision: options.sourceRevision,
    caps: [{ role: 'bottom', status: 'generated', target: faceRef(recipes[0]) }, { role: 'top', status: 'generated', target: faceRef(recipes[1]) }],
    segments: segments.map((segment, i) => ({ segmentId: segment.id, startPointId: segment.startPointId, endPointId: segment.endPointId, status: 'preserved', wall: faceRef(recipes[i + 2]),
      bottomEdgeId: edgeId('bottom:' + segment.id), topEdgeId: edgeId('top:' + segment.id), boundaryEdgeStatus: 'generated', nativeParameterDomain: [curves[i].knots[1], curves[i].knots[2]] })),
    points: segments.map((segment, i) => ({ pointId: segment.startPointId, status: 'generated', verticalEdgeId: edgeId('vertical:' + segment.startPointId), bottomVertexId: vertexId(recipes[0], i), topVertexId: vertexId(recipes[1], i) })),
  };
  const report: XYAffineSketchPrismReport = {
    schema: 'barocss-xy-affine-sketch-prism', version: 0, solid: true, sourceId: options.sourceId, sketchId: sketch.document.id, sourceRevision: options.sourceRevision,
    profileOrientation: orientation, segmentCount: n, heightMM: options.heightMM,
    childNativeWork: { sketchReconstructionCount: 1, initialFaceConstructionCount: n + 2, solidQualificationCount: 1, solidFaceReconstructionCount: n + 2,
      sourceCompilationCount: 2 * (n + 2) + 1, bindingObservationCount: 36 * n, totalD1Count: 108 * n, retries: 0 },
    exactWork: { sketch: sketch.report.rationalWork, solid: solid.report.exactWork },
    limits: { segments: 8, facets: 10, directedUses: 48, edgePairs: 24, vertices: 16, fanTriangles: 28, sourceCompilations: 21, bindingObservations: 288, totalD1: 864 },
    numericPolicy: 'declared-cap-chart-natural-wall-chart-exact-stored-solid-proof-no-retry',
    revisionPolicy: 'explicit-caller-revision-complete-source-reconstruction-no-historical-authenticity', persistentNamingCertified: false, manufacturingToleranceCertified: false,
  };
  return { request, solid, lineage, report };
}
function reconstruct(input: XYAffineSketchPrismResult, ledger: SolidSnapshotLedger): XYAffineSketchPrismResult {
  const owned = record(input, ['request', 'solid', 'lineage', 'report']) as unknown as XYAffineSketchPrismResult;
  const request = ledger.copy(owned.request, false, true); record(request, ['sketch', 'options']);
  const expected = ledger.copy(build(request), true); check(same(owned, expected), 'result', null, 'Complete prism source/operation/solid/lineage/report differs from reconstruction'); return expected;
}
/** Construct only the declared exact-admitted +Z prism; no shell cast, chart search or tolerance sewing. */
export function buildXYAffineSketchPrism(sketch: XYAffineSketchSuccess, options: XYAffineSketchPrismOptions): XYAffineSketchPrismResult {
  return at('input', null, () => { const ledger = new SolidSnapshotLedger(), request = ledger.copy({ sketch, options }); return at('result', null, () => ledger.copy(build(request), true)); });
}
/** One full native rebuild checks self-consistency, not historical provenance or persistent naming. */
export function validateXYAffineSketchPrism(input: XYAffineSketchPrismResult): XYAffineSketchPrismReport {
  return at('result', null, () => { const ledger = new SolidSnapshotLedger(); return ledger.copy(reconstruct(ledger.copy(input, true), ledger).report, true); });
}
/** Old revisions never silently retarget a wall. Rebuild and explicitly qualify the intended new reference. */
export function resolveXYAffineSketchPrismWall(input: XYAffineSketchPrismResult, reference: XYAffineSketchPrismWallReference): XYAffineSketchPrismWallResolution {
  return at('reference', null, () => {
    const ledger = new SolidSnapshotLedger(), owned = ledger.copy({ input, reference }, true);
    const ref = record(owned.reference, ['sourceId', 'sketchId', 'sourceRevision', 'segmentId']) as unknown as XYAffineSketchPrismWallReference;
    id(ref.sourceId); id(ref.sketchId); id(ref.segmentId); revision(ref.sourceRevision);
    const result = reconstruct(owned.input, ledger), current = result.lineage;
    check(ref.sourceId === current.sourceId && ref.sketchId === current.sketchId, 'reference', ref.segmentId, 'Source namespace or sketch identity mismatch');
    const matches = current.segments.filter(s => s.segmentId === ref.segmentId), stale = ref.sourceRevision !== current.sourceRevision;
    check(matches.length <= 1, 'reference', ref.segmentId, 'Ambiguous source segment lineage refused');
    return ledger.copy({ reference: ref, currentRevision: current.sourceRevision, status: stale ? 'stale' : matches.length ? 'preserved' : 'deleted', targets: stale ? [] : matches.map(s => s.wall) } as XYAffineSketchPrismWallResolution, true);
  });
}
