import { validateConvexPlanarSolid } from './convex-planar-solid.js';
import type { ConvexPlanarSolidResult, ConvexPlanarSolidReport } from './convex-planar-solid.js';
import type { Point } from './types.js';
import { MassLedger, ConvexPlanarSolidMassError, same } from './convex-planar-solid-mass-internal.js';

export type ConvexPlanarSolidMeshDiagnosticCode = 'INPUT' | 'BUDGET' | 'PARENT' | 'BINDING' | 'REPRESENTABILITY' | 'OWNED';
export class ConvexPlanarSolidMeshError extends Error {
  constructor(readonly code: ConvexPlanarSolidMeshDiagnosticCode, detail: string, cause?: unknown) {
    super(('Convex planar Solid mesh: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'ConvexPlanarSolidMeshError';
  }
}
export const ConvexPlanarSolidMeshLimits = Object.freeze({ faces: 12, directedUses: 64, nativeVertices: 32, nativeEdges: 32, faceVertices: 8, meshVertices: 64, triangles: 40, indices: 120, positionValues: 192, normalValues: 192, uvValues: 128, faceReconstructions: 12, nativeD1Calls: 576, snapshotBytes: 16777216, wrapperSnapshotBytes: 67108864, parentSnapshotReserveBytes: 50331648, aggregateSnapshotBytes: 117440512 });
export interface ConvexPlanarSolidMeshOptions { maximumFanTriangles: number }
export interface ConvexPlanarSolidMeshVertex {
  sourceId: string; faceId: string; surfaceId: string; loopId: string; useId: string; nativeVertexId: string; solidVertexId: string;
}
export interface ConvexPlanarSolidMeshFace {
  sourceId: string; faceId: string; surfaceId: string; loopId: string; orientation: 'forward' | 'reverse';
  vertexOffset: number; vertexCount: number; indexOffset: number; indexCount: number; triangleAreaMM2: number; signedAreaUV: number;
}
export interface ConvexPlanarSolidMeshBoundary {
  faceIndex: number; sourceId: string; faceId: string; loopId: string; useId: string; edgeId: string; solidEdgeId: string; curveId: string; pcurveId: string;
  sense: 'forward' | 'reverse'; interval: [number, number]; vertexIndices: [number, number]; nativeVertexIds: [string, string]; solidVertexIds: [string, string]; role: 'native-boundary';
}
export interface ConvexPlanarSolidMeshReport {
  schema: 'barocss-convex-planar-solid-mesh'; version: 0; solidId: string; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  faceCount: number; vertexCount: number; triangleCount: number; boundaryUseCount: number; internalDiagonalCount: number;
  directCounts: { parentValidationCount: 1; newGeometryEvaluationCount: 0; retries: 0 }; parentNativeWork: ConvexPlanarSolidReport['childNativeWork'];
  limits: typeof ConvexPlanarSolidMeshLimits; validationScope: 'whole-result-self-consistency-not-authenticity';
  positionPolicy: 'original-stored-native-vertices'; uvPolicy: 'original-directed-pcurve-endpoint-coefficients'; normalPolicy: 'validated-original-face-binding';
  ownership: 'independent-copied-cpu-data-gc'; nativeAuthority: false; float32ProjectionCertified: false; manufacturingToleranceCertified: false;
}
export interface ConvexPlanarSolidMeshResult {
  solid: ConvexPlanarSolidResult; options: ConvexPlanarSolidMeshOptions;
  mesh: { positionsMM: number[]; normals: number[]; parametersUV: number[]; indices: number[]; vertices: ConvexPlanarSolidMeshVertex[]; faces: ConvexPlanarSolidMeshFace[] };
  boundaries: ConvexPlanarSolidMeshBoundary[];
  internalDiagonals: { faceIndex: number; vertexIndices: [number, number]; role: 'display-internal-not-brep-edge' }[];
  report: ConvexPlanarSolidMeshReport;
}
function demand(value: boolean, code: ConvexPlanarSolidMeshDiagnosticCode, message: string): asserts value { if (!value) throw new ConvexPlanarSolidMeshError(code, message); }
function fields(value: unknown, keys: string[]): Record<string, unknown> {
  demand(value !== null && typeof value === 'object' && !Array.isArray(value), 'INPUT', 'Own record required');
  const record = value as Record<string, unknown>; demand(Object.keys(record).length === keys.length && keys.every(key => Object.hasOwn(record, key)), 'INPUT', 'Exact own fields required'); return record;
}
function guarded<T>(action: () => T): T {
  try { return action(); } catch (cause) {
    if (cause instanceof ConvexPlanarSolidMeshError) throw cause;
    if (cause instanceof ConvexPlanarSolidMassError) throw new ConvexPlanarSolidMeshError(cause.code, 'Bounded own-data snapshot refused', cause);
    throw new ConvexPlanarSolidMeshError('INPUT', 'Own-data inspection refused', cause);
  }
}
function finite(value: number): number { demand(Number.isFinite(value), 'REPRESENTABILITY', 'Finite display arithmetic required'); return value; }
function build(solid: ConvexPlanarSolidResult, options: ConvexPlanarSolidMeshOptions, ledger: MassLedger): ConvexPlanarSolidMeshResult {
  const settings = fields(options, ['maximumFanTriangles']);
  demand(Number.isInteger(settings.maximumFanTriangles) && options.maximumFanTriangles >= 1 && options.maximumFanTriangles <= 40, 'BUDGET', 'Explicit fan budget integer 1..40 required');
  const input = fields(solid, ['request', 'graph', 'supports', 'certificate', 'report']), graph = fields(input.graph, ['vertices', 'edges', 'faces', 'vertexLinks']);
  demand(Array.isArray(graph.faces) && graph.faces.length >= 4 && graph.faces.length <= 12, 'BUDGET', 'Complete bounded facet inventory required');
  demand(Array.isArray(graph.vertices) && graph.vertices.length >= 4 && graph.vertices.length <= 32 && Array.isArray(graph.edges) && graph.edges.length >= 6 && graph.edges.length <= 32, 'BUDGET', 'Complete bounded vertex/edge inventory required');
  const request = fields(input.request, ['assets', 'edgePairs', 'options']);
  demand(Array.isArray(request.assets) && request.assets.length === graph.faces.length && Array.isArray(request.edgePairs) && request.edgePairs.length === graph.edges.length, 'BINDING', 'Complete parent request/graph inventory required');
  let expectedTriangles = 0, expectedVertices = 0;
  for (const value of graph.faces) {
    const face = fields(value, ['sourceId', 'faceId', 'surfaceId', 'loopId', 'vertexIds', 'edgeIds']);
    demand(Array.isArray(face.vertexIds) && face.vertexIds.length >= 3 && face.vertexIds.length <= 8, 'BUDGET', 'Facet requires 3..8 vertices');
    demand(Array.isArray(face.edgeIds) && face.edgeIds.length === face.vertexIds.length, 'BINDING', 'Complete facet edge/vertex inventory required');
    expectedTriangles += face.vertexIds.length - 2; expectedVertices += face.vertexIds.length;
  }
  demand((request.edgePairs as unknown[]).length * 2 === expectedVertices, 'BINDING', 'Complete paired directed-use inventory required');
  demand(expectedTriangles <= options.maximumFanTriangles && expectedVertices <= 64, 'BUDGET', 'Complete mesh exceeds caller budget before native reconstruction');
  let parent: ConvexPlanarSolidReport;
  try { parent = validateConvexPlanarSolid(solid); } catch (cause) { throw new ConvexPlanarSolidMeshError('PARENT', 'Complete qualified parent reconstruction refused', cause); }
  demand(parent.childNativeWork.completeFaceReconstructionCount <= 12 && parent.childNativeWork.totalD1Count <= 576, 'BUDGET', 'Parent native work ceiling exceeded');
  const mesh: ConvexPlanarSolidMeshResult['mesh'] = { positionsMM: [], normals: [], parametersUV: [], indices: [], vertices: [], faces: [] };
  const boundaries: ConvexPlanarSolidMeshBoundary[] = [], internalDiagonals: ConvexPlanarSolidMeshResult['internalDiagonals'] = [];
  for (const [faceIndex, face] of solid.graph.faces.entries()) {
    const asset = solid.request.assets.find(item => item.sourceId === face.sourceId)!;
    const native = asset.face, uses = native.topology.loop.uses, offset = mesh.vertices.length, indexOffset = mesh.indices.length;
    for (const [i, use] of uses.entries()) {
      const vertex = native.topology.vertices.find(item => item.id === use.vertexIds[0])!;
      const pcurve = native.pcurves.find(item => item.id === use.pcurveId)!, uv = pcurve.curve.controlPoints[use.sense === 'forward' ? 0 : 1];
      const binding = native.bindings.find(item => item.useId === use.id && item.parameter === use.interval[0])!;
      demand(binding !== undefined && vertex !== undefined, 'BINDING', 'Complete directed endpoint binding required');
      mesh.positionsMM.push(...vertex.point); mesh.normals.push(...binding.orientedFaceNormal); mesh.parametersUV.push(uv[0], uv[1]);
      mesh.vertices.push({ sourceId: face.sourceId, faceId: face.faceId, surfaceId: face.surfaceId, loopId: face.loopId, useId: use.id, nativeVertexId: vertex.id, solidVertexId: face.vertexIds[i] });
      boundaries.push({ faceIndex, sourceId: face.sourceId, faceId: face.faceId, loopId: face.loopId, useId: use.id, edgeId: use.edgeId, solidEdgeId: face.edgeIds[i], curveId: use.curveId, pcurveId: use.pcurveId, sense: use.sense, interval: use.interval, vertexIndices: [offset + i, offset + (i + 1) % uses.length], nativeVertexIds: use.vertexIds, solidVertexIds: [face.vertexIds[i], face.vertexIds[(i + 1) % uses.length]], role: 'native-boundary' });
    }
    let triangleAreaMM2 = 0, signedAreaUV = 0;
    const point = (i: number) => mesh.positionsMM.slice(3 * (offset + i), 3 * (offset + i) + 3) as Point;
    for (let k = 1; k + 1 < uses.length; k++) {
      const a = point(0), b = point(k), c = point(k + 1), u = b.map((v, i) => finite(v - a[i])), v = c.map((x, i) => finite(x - a[i]));
      const cross = [finite(u[1] * v[2] - u[2] * v[1]), finite(u[2] * v[0] - u[0] * v[2]), finite(u[0] * v[1] - u[1] * v[0])];
      const normal = mesh.normals.slice(offset * 3, offset * 3 + 3), terms = cross.map((x, i) => finite(x * normal[i])), dot = finite(terms.reduce((sum, x) => sum + x, 0));
      demand(dot > 64 * Number.EPSILON * terms.reduce((sum, x) => sum + Math.abs(x), 0), 'REPRESENTABILITY', 'Unrepresented or uncertain outward display triangle');
      const uv = (i: number) => mesh.parametersUV.slice(2 * (offset + i), 2 * (offset + i) + 2), x = uv(0), y = uv(k), z = uv(k + 1);
      const left = finite((y[0] - x[0]) * (z[1] - x[1])), right = finite((y[1] - x[1]) * (z[0] - x[0])), determinant = finite(left - right), sense = native.options.orientation === 'forward' ? 1 : -1;
      demand(sense * determinant > 64 * Number.EPSILON * (Math.abs(left) + Math.abs(right)), 'REPRESENTABILITY', 'Unrepresented or uncertain directed UV triangle');
      triangleAreaMM2 = finite(triangleAreaMM2 + finite(Math.hypot(...cross) / 2)); signedAreaUV = finite(signedAreaUV + determinant / 2);
      mesh.indices.push(offset, offset + k, offset + k + 1);
      if (k > 1) internalDiagonals.push({ faceIndex, vertexIndices: [offset, offset + k], role: 'display-internal-not-brep-edge' });
    }
    mesh.faces.push({ sourceId: face.sourceId, faceId: face.faceId, surfaceId: face.surfaceId, loopId: face.loopId, orientation: native.options.orientation, vertexOffset: offset, vertexCount: uses.length, indexOffset, indexCount: mesh.indices.length - indexOffset, triangleAreaMM2, signedAreaUV });
  }
  demand(mesh.vertices.length === expectedVertices && mesh.indices.length === expectedTriangles * 3, 'BINDING', 'Whole parent mesh inventory mismatch');
  const report: ConvexPlanarSolidMeshReport = { schema: 'barocss-convex-planar-solid-mesh', version: 0, solidId: parent.solidId, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion', faceCount: mesh.faces.length, vertexCount: mesh.vertices.length, triangleCount: expectedTriangles, boundaryUseCount: boundaries.length, internalDiagonalCount: internalDiagonals.length, directCounts: { parentValidationCount: 1, newGeometryEvaluationCount: 0, retries: 0 }, parentNativeWork: parent.childNativeWork, limits: ConvexPlanarSolidMeshLimits, validationScope: 'whole-result-self-consistency-not-authenticity', positionPolicy: 'original-stored-native-vertices', uvPolicy: 'original-directed-pcurve-endpoint-coefficients', normalPolicy: 'validated-original-face-binding', ownership: 'independent-copied-cpu-data-gc', nativeAuthority: false, float32ProjectionCertified: false, manufacturingToleranceCertified: false };
  return ledger.copy({ solid, options, mesh, boundaries, internalDiagonals, report });
}
/** Display-only fans over every actual qualified convex facet, never over support rectangles. */
export function tessellateConvexPlanarSolid(solid: ConvexPlanarSolidResult, options: ConvexPlanarSolidMeshOptions): ConvexPlanarSolidMeshResult {
  return guarded(() => { const ledger = new MassLedger(), owned = ledger.copy({ solid, options }); return build(owned.solid, owned.options, ledger); });
}
/** One complete parent reconstruction; compares all retained native and derived data, including signed zero. */
export function validateConvexPlanarSolidMesh(input: ConvexPlanarSolidMeshResult): ConvexPlanarSolidMeshReport {
  return guarded(() => { const ledger = new MassLedger(), owned = fields(ledger.copy(input), ['solid', 'options', 'mesh', 'boundaries', 'internalDiagonals', 'report']) as unknown as ConvexPlanarSolidMeshResult;
    const rebuilt = build(owned.solid, owned.options, ledger); demand(same(owned, rebuilt), 'OWNED', 'Complete native/mesh/provenance/report differs from reconstruction'); return ledger.copy(rebuilt.report); });
}
