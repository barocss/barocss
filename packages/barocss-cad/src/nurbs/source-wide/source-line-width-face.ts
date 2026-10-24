import type { Model, Curve, Point } from '../../types.js';
import { buildCompatibleRuledSurface } from '../surfaces/compatible-ruled-surface.js';
import type { CompatibleRuledSurfaceResult } from '../surfaces/compatible-ruled-surface.js';
import { buildConvexPlanarFace } from '../../own-convex-planar-face.js';
import type { ConvexPlanarFaceOptions, ConvexPlanarFaceResult } from '../../own-convex-planar-face.js';
import { extractSurfaceBoundary } from '../../core/boundary.js';
import type { SurfaceBoundary } from '../../core/boundary.js';
import { compileCadModel } from '../../model-compiler.js';
import type { CadCompileResult } from '../../model-compiler.js';
import { same } from '../../core/structural-equality.js';
import { KernelError } from '../../core/barocss-error.js';

export const SourceLineWidthFaceDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', SOURCE: 'SOURCE', TARGET: 'TARGET',
  PROFILE: 'PROFILE', WIDTH: 'WIDTH', REPRESENTABILITY: 'REPRESENTABILITY', BUDGET: 'BUDGET',
  RULED: 'RULED', BOUNDARY: 'BOUNDARY', FACE: 'FACE', BINDING: 'BINDING', OWNED: 'OWNED', FILE: 'FILE',
} as const);
export type SourceLineWidthFaceDiagnosticCode =
  typeof SourceLineWidthFaceDiagnosticCode[keyof typeof SourceLineWidthFaceDiagnosticCode];
export class SourceLineWidthFaceError extends KernelError {
  readonly code: SourceLineWidthFaceDiagnosticCode;
  constructor(code: SourceLineWidthFaceDiagnosticCode, detail: string, cause?: unknown) {
    super(('Source Line width Face: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'SourceLineWidthFaceError';
    this.code = code;
  }
}

type Four<T> = [T, T, T, T];
type Size = { utf16: number; utf8: number };
export interface SourceLineWidthFaceOptions { // EXACT6
  lowerCurveId: string;
  upperCurveId: string;
  surfaceId: string;
  loopId: string;
  boundaryCurveIds: Four<string>;
  face: ConvexPlanarFaceOptions; // unchanged EXACT4 nested provider options
}
export interface SourceLineWidthFaceRequest { // EXACT5
  source: string;
  sourceVersion: 0;
  curveId: string;
  widthMM: number;
  options: SourceLineWidthFaceOptions;
}
type SourceContext = {
  context: 'original' | 'ruled' | 'face';
  sourceField: 'request.source' | 'ruled.source' | 'face.source';
  modelField: 'originalModel' | 'ruled.model' | 'face.model';
  sourceVersion: 0;
  modelName: string;
};
type CurveReference = {
  context: 'original' | 'ruled' | 'face';
  modelName: string;
  objectIndex: number;
  curveId: string;
};
type SurfaceReference = {
  context: 'ruled' | 'face';
  modelName: string;
  objectIndex: 2 | 0;
  surfaceId: string;
};
type BoundaryBinding = {
  index: number; // canonical v-min/u-max/v-max/u-min index, NOT traversal rank
  boundary: SurfaceBoundary;
  curve: CurveReference;
  edgeId: string;
  pcurveId: string;
  useId: string;
  traversalIndex: number;
  sense: 'forward' | 'reverse';
  interval: [number, number];
};
type Bindings = {
  sources: { original: SourceContext; ruled: SourceContext; face: SourceContext };
  original: CurveReference;
  sections: { lower: CurveReference; upper: CurveReference };
  support: { ruled: SurfaceReference; face: SurfaceReference; completeBitsEqual: true };
  boundaries: Four<BoundaryBinding>;
  face: { faceId: string; loopId: string; orientation: 'forward' | 'reverse';
    useIdsInTraversalOrder: Four<string> };
};
export interface SourceLineWidthFaceReport {
  schema: 'barocss-source-line-width-face-report';
  version: 0;
  sourceVersion: 0;
  lengthUnit: 'mm';
  profile: 'unit-line-positive-x-centered-y0-z0';
  curveId: string;
  selectedObjectIndex: number;
  originalModelName: string;
  originalObjectCount: number;
  widthIntent: { placement: 'centered-y'; centerYMM: 0; centerZMM: 0;
    requestedWidthMM: number; halfWidthMM: number;
    lowerYMM: number; upperYMM: number; representedWidthMM: number;
    representedWidthEqualsRequest: true };
  originalBasis: { degree: 1; poleCount: 2; knots: [0,0,1,1];
    weights: [1,1]; domain: [0,1] };
  diagnostics: { representedLengthMM: number; representedAreaMM2: number;
    authority: 'axis-product-diagnostics-not-solid-or-global-error-certificate' };
  generatedRoleIds: string[]; // actual26 unique roles, listed once each
  directCounts: { originalSourceCompileCount: 1; ruledBuildCallCount: 1;
    boundaryExtractionCallCount: 4; convexFaceBuildCallCount: 1;
    producerDelegationCount: 7;
    curveD0Count: 0; curveD1AttemptCount: 0;
    surfaceD0Count: 0; surfaceD1AttemptCount: 0;
    rationalOperationCount: 0; sourceWriterCallCount: 0;
    parentValidationCallCount: 0 };
  childReceiptCounts: { ruledObservationCount: 9; faceBindingCount: 12;
    boundaryCurveCount: 4; facePcurveCount: 4;
    ruledModelObjectCount: 3; faceModelObjectCount: 5 };
  sourceSizes: { original: Size; ruled: Size; face: Size };
  fileSizes: { request: Size; result: Size };
  preservation: { completeOriginalSource: true; completeOriginalModel: true;
    originalSelectedCurveBits: true; originalUnselectedObjectBits: true;
    completeRuledReceipt: true; completeConvexFaceReceipt: true;
    selectedXZBasisWeightCopies: true; supportBitsAcrossDerivedContexts: true;
    naturalBoundaryDirections: true;
    sourceQualification: 'retained-source-field-path-and-actual-model-name' };
  quality: { nativeFaceConstructed: true; incidenceValid: true;
    geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
    originalSourceEdited: false;
    faceTopologyEncodedInNativeSource: false;
    ownedRebuild: true; generalCurveOffset: false; arbitraryDirection: false;
    globalShapeErrorCertified: false; globalBinary64ErrorCertified: false;
    g1g2Certified: false; manufacturingToleranceCertified: false;
    editorDisplayCertified: false; persistentTopologyBindingCertified: false;
    publication: false; ownership: 'independent-copied-cpu-data-gc' };
  limits: { maximumOriginalModelObjects: 16; sourceUTF16: 262144; sourceUTF8: 262144;
    selectedDegree: 1; selectedPoles: 2; selectedKnots: 4;
    selectedCoordinateAbsMM: 10000; minimumLengthMM: 0.000001;
    minimumWidthMM: 0.000001; maximumWidthMM: 10000;
    maximumSectionCurves: 2; boundaryCurveCount: 4;
    maximumProducerDelegations: 7; maximumRoleIds: 26;
    identityCharacters: 48; facePrefixCharacters: 20;
    maximumRequestUTF16: 1048576; maximumRequestUTF8: 1048576;
    maximumResultUTF16: 2097152; maximumResultUTF8: 2097152;
    ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64;
    keyCharacters: 128; stringCharacters: 262144 };
  workScope: 'direct-wrapper-delegations-child-native-work-retained-in-full-receipts';
  budgetFailure: 'atomic-no-partial-width-face-or-source';
}
export interface SourceLineWidthFaceResult { // EXACT7
  request: SourceLineWidthFaceRequest;
  originalModel: Model;
  originalCurve: Curve;
  ruled: CompatibleRuledSurfaceResult;
  face: ConvexPlanarFaceResult;
  bindings: Bindings;
  report: SourceLineWidthFaceReport;
}

const CODE = SourceLineWidthFaceDiagnosticCode;
function check(condition: boolean, code: SourceLineWidthFaceDiagnosticCode,
  detail: string): asserts condition {
  if (!condition) throw new SourceLineWidthFaceError(code, detail);
}
function delegated<T>(action: () => T, code: SourceLineWidthFaceDiagnosticCode,
  detail: string): T {
  try { return action(); }
  catch (cause) { throw new SourceLineWidthFaceError(code, detail, cause); }
}
function record(input: unknown, fields: string[],
  code: SourceLineWidthFaceDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code,
    'An own record is required');
  const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'Exact own fields are required');
  return data;
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  const budget = owned ? CODE.OWNED : CODE.BUDGET;
  let remaining = 1048576;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, budget, 'Own value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      check(Number.isFinite(value), code, 'Finite own numbers are required');
      return value;
    }
    if (typeof value === 'string') {
      check(value.length <= 262144, budget, 'Own string limit exceeded');
      return value;
    }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'Plain own-data prototypes are required');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 8193 : 64), budget, 'Own field limit exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 &&
      'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable)),
    code, 'Getters, symbols and hidden fields are refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 8192,
        budget, 'Own array limit exceeded');
      check(keys.length === length + 1, code, 'Dense arrays without extra fields are required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'Sparse arrays are refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else {
      result = Object.fromEntries((keys as string[]).map(key =>
        [key, copy(descriptors[key].value, depth + 1)]));
    }
    ancestors.delete(value);
    return result;
  };
  return copy(input, 0);
}
function sourceSize(source: string): Size {
  const size = { utf16: source.length, utf8: new TextEncoder().encode(source).length };
  check(size.utf16 <= 262144 && size.utf8 <= 262144, CODE.BUDGET,
    'Complete Source0 exceeds262144 UTF16 units or UTF8 bytes');
  return size;
}
/** Count compact native JSON with original signed zeros and exactly one newline. */
function fileSize(input: unknown, limit = 2097152): Size {
  let utf16 = 0, utf8 = 0;
  const encoder = new TextEncoder();
  const append = (text: string): void => {
    utf16 += text.length;
    utf8 += encoder.encode(text).length;
    check(utf16 <= limit && utf8 <= limit, CODE.FILE,
      'Complete JSON exceeds its full UTF16 or UTF8 envelope');
  };
  const visit = (value: unknown): void => {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
      append(JSON.stringify(value));
    } else if (typeof value === 'number') {
      check(Number.isFinite(value), CODE.FILE, 'Finite JSON numbers are required');
      append(Object.is(value, -0) ? '-0' : JSON.stringify(value));
    } else if (Array.isArray(value)) {
      append('[');
      value.forEach((item, index) => { if (index) append(','); visit(item); });
      append(']');
    } else {
      check(value !== null && typeof value === 'object', CODE.FILE, 'Complete own JSON data is required');
      append('{');
      Object.entries(value).forEach(([key, item], index) => {
        if (index) append(',');
        append(JSON.stringify(key));
        append(':');
        visit(item);
      });
      append('}');
    }
  };
  visit(input);
  append('\n');
  return { utf16, utf8 };
}
function compile(source: string, stage: string): Extract<CadCompileResult, { ok: true }> {
  const result = delegated(() => compileCadModel(source, { sourceVersion: 0 }), CODE.SOURCE,
    'Actual ' + stage + ' complete Source0 compilation failed');
  if (!result.ok) throw new SourceLineWidthFaceError(CODE.SOURCE,
    'Actual ' + stage + ' complete Source0 compilation refused', result);
  return result;
}
function identifier(value: unknown, maximum = 48): asserts value is string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'A bounded supported ASCII identity is required');
}
function four<T>(values: T[]): Four<T> {
  check(values.length === 4, CODE.BINDING, 'Exactly four canonical boundary entries are required');
  return values as Four<T>;
}
function options(input: unknown): { value: SourceLineWidthFaceOptions; roles: string[] } {
  const data = record(input, ['lowerCurveId', 'upperCurveId', 'surfaceId', 'loopId', 'boundaryCurveIds', 'face']);
  identifier(data.lowerCurveId); identifier(data.upperCurveId); identifier(data.surfaceId); identifier(data.loopId);
  check(Array.isArray(data.boundaryCurveIds) && data.boundaryCurveIds.length === 4, CODE.IDENTITY,
    'Exactly four explicit natural boundary Curve IDs are required');
  data.boundaryCurveIds.forEach(value => identifier(value));
  const face = record(data.face, ['faceId', 'evaluationId', 'resultIdPrefix', 'orientation']);
  identifier(face.faceId); identifier(face.evaluationId); identifier(face.resultIdPrefix, 20);
  check(face.orientation === 'forward' || face.orientation === 'reverse', CODE.INPUT,
    'Explicit forward or reverse Face orientation is required');
  const resultIdPrefix = face.resultIdPrefix;
  const generated = Array.from({ length: 4 }, (_, index) => ['v', 'e', 'use', 'uv'].map(role =>
    resultIdPrefix + '_' + role + '_' + index)).flat();
  const roles = [data.lowerCurveId, data.upperCurveId, data.surfaceId, data.loopId,
    face.faceId, face.evaluationId, ...data.boundaryCurveIds, ...generated] as string[];
  roles.forEach(value => identifier(value));
  check(roles.length === 26 && new Set(roles).size === 26, CODE.IDENTITY,
    'All26 actual geometry/topology/evaluation roles must be distinct before staging');
  // Model names are source-qualified contexts. Surface/evaluation name aliases add no roles.
  return { value: data as unknown as SourceLineWidthFaceOptions, roles };
}
function prefix(request: SourceLineWidthFaceRequest, originalModel: Model | null, originalCurve: Curve | null,
  ruled: CompatibleRuledSurfaceResult | null, edges: Curve[], face: ConvexPlanarFaceResult | null): void {
  const retained = { request, originalModel, originalCurve, ruled, stagedBoundaries: edges, face };
  fileSize(retained);
  snapshot(retained);
}
function curveReference(context: CurveReference['context'], model: Model, index: number,
  expectedId: string): CurveReference {
  const curve = model.objects[index];
  check(curve !== undefined && curve.kind === 'curve' && curve.id === expectedId, CODE.BINDING,
    'Qualified Curve reference must resolve the actual retained Model member');
  return { context, modelName: model.name, objectIndex: index, curveId: curve.id };
}
function surfaceReference(context: SurfaceReference['context'], model: Model, index: 0 | 2,
  expectedId: string): SurfaceReference {
  const surface = model.objects[index];
  check(surface !== undefined && surface.kind === 'surface' && surface.id === expectedId, CODE.BINDING,
    'Qualified Surface reference must resolve the actual retained Model member');
  return { context, modelName: model.name, objectIndex: index, surfaceId: surface.id };
}
const BOUNDARIES: Four<SurfaceBoundary> = ['v-min', 'u-max', 'v-max', 'u-min'];

/** Preserve complete authored width intent and delegate real native rectangle/Face construction. */
export function buildSourceLineWidthFace(input: SourceLineWidthFaceRequest): SourceLineWidthFaceResult {
  const data = record(snapshot(input), ['source', 'sourceVersion', 'curveId', 'widthMM', 'options']);
  check(Object.is(data.sourceVersion, 0), CODE.VERSION, 'Only explicit positivezero literal Source0 is supported');
  check(typeof data.source === 'string', CODE.INPUT, 'The complete original source text is required');
  identifier(data.curveId);
  check(typeof data.widthMM === 'number' && Number.isFinite(data.widthMM) &&
    data.widthMM >= 0.000001 && data.widthMM <= 10000, CODE.WIDTH,
  'Centered width must be finite and in1e-6..10000mm');
  const settings = options(data.options), request = data as unknown as SourceLineWidthFaceRequest;
  const requestSize = fileSize(request, 1048576), originalSize = sourceSize(request.source);
  const halfWidthMM = request.widthMM / 2, lowerYMM = -halfWidthMM, upperYMM = halfWidthMM;
  const representedWidthMM = upperYMM - lowerYMM;
  check(Number.isFinite(halfWidthMM) && halfWidthMM > 0 && lowerYMM < 0 && upperYMM > 0 &&
    Number.isFinite(representedWidthMM) && Object.is(representedWidthMM, request.widthMM),
  CODE.REPRESENTABILITY, 'Actual represented centered offsets must retain the requested width exactly');
  let originalSourceCompileCount = 0, ruledBuildCallCount = 0, boundaryExtractionCallCount = 0,
    convexFaceBuildCallCount = 0;
  prefix(request, null, null, null, [], null);
  originalSourceCompileCount++;
  const original = compile(request.source, 'original'), originalModel = original.model;
  prefix(request, originalModel, null, null, [], null);
  check(originalModel.objects.length >= 1 && originalModel.objects.length <= 16, CODE.BUDGET,
    'Complete original Model must retain its unchanged1..16 object capacity');
  const selectedObjectIndex = originalModel.objects.findIndex(object => object.id === request.curveId);
  const selected = originalModel.objects[selectedObjectIndex];
  check(selected !== undefined && selected.kind === 'curve', CODE.TARGET,
    'Selected ID must resolve an actual original Curve');
  const originalCurve = selected;
  const declarations = original.ast.declarations.filter(value => value.id === request.curveId);
  const nodes = original.ir.nodes.filter(value => value.id === request.curveId);
  check(declarations.length === 1 && declarations[0].kind === 'curve' &&
    nodes.length === 1 && nodes[0].kind === 'curve', CODE.TARGET,
  'Selected original Line must have one actual literal Curve declaration and IR node');
  check(same(nodes[0].geometry, originalCurve) && same(nodes[0].span, declarations[0].range), CODE.BINDING,
    'Complete original source, literal IR and selected native Model Curve must bind exactly');
  check(originalCurve.degree === 1 && originalCurve.controlPoints.length === 2 &&
    same(originalCurve.weights, [1, 1]) && same(originalCurve.knots, [0, 0, 1, 1]) &&
    originalCurve.controlPoints.every(point => point.every(value => Math.abs(value) <= 10000) &&
      point[1] === 0 && point[2] === 0), CODE.PROFILE,
  'Only the actual unit-weight two-pole +X/XY Line with positivezero unit basis is supported');
  const representedLengthMM = originalCurve.controlPoints[1][0] - originalCurve.controlPoints[0][0];
  check(Number.isFinite(representedLengthMM), CODE.REPRESENTABILITY, 'Original represented X span must remain finite');
  check(representedLengthMM >= 0.000001, CODE.PROFILE, 'Original Line must point along+X with length at least1e-6mm');
  const representedAreaMM2 = representedLengthMM * request.widthMM;
  check(Number.isFinite(representedAreaMM2), CODE.REPRESENTABILITY, 'Axis product area diagnostic must remain finite');
  const originalIds = originalModel.objects.map(object => object.id);
  check(new Set([...originalIds, ...settings.roles]).size === originalIds.length + settings.roles.length,
    CODE.IDENTITY, 'Real new role IDs must be distinct from all original object IDs; Model names are not reserved');
  prefix(request, originalModel, originalCurve, null, [], null);
  const section = (id: string, y: number): Curve => ({ kind: 'curve', id, degree: originalCurve.degree,
    knots: originalCurve.knots.slice(), weights: originalCurve.weights.slice(),
    controlPoints: originalCurve.controlPoints.map((point): Point => [point[0], y, point[2]]) });
  const lower = section(settings.value.lowerCurveId, lowerYMM), upper = section(settings.value.upperCurveId, upperYMM);
  check([lower, upper].every(curve => curve.controlPoints.every(point => point.every(value =>
    Number.isFinite(value) && Math.abs(value) <= 10000))), CODE.BUDGET,
  'Both actual derived section Curves must fit the unchanged ruled coefficient profile');
  ruledBuildCallCount++;
  const ruled = delegated(() => buildCompatibleRuledSurface(lower, upper, { surfaceId: settings.value.surfaceId }),
    CODE.RULED, 'Actual compatible ruled Surface construction refused');
  prefix(request, originalModel, originalCurve, ruled, [], null);
  check(same(ruled.first, lower) && same(ruled.second, upper) &&
    same(ruled.model.objects, [ruled.first, ruled.second, ruled.surface]) &&
    ruled.model.name === settings.value.surfaceId && ruled.surface.id === settings.value.surfaceId &&
    Object.is(ruled.sourceVersion, 0), CODE.BINDING,
  'The complete real ruled receipt must retain both actual section Curves and its actual support context');
  const edges: Curve[] = [];
  for (let index = 0; index < 4; index++) {
    prefix(request, originalModel, originalCurve, ruled, edges, null);
    boundaryExtractionCallCount++;
    const curve = delegated(() => extractSurfaceBoundary(ruled.surface, { boundary: BOUNDARIES[index],
      id: settings.value.boundaryCurveIds[index] }), CODE.BOUNDARY,
    'Actual natural boundary' + index + ' extraction refused');
    edges.push(curve);
    prefix(request, originalModel, originalCurve, ruled, edges, null);
  }
  prefix(request, originalModel, originalCurve, ruled, edges, null);
  convexFaceBuildCallCount++;
  // Upper/left native boundary directions are already correct; no caller geometry reversal or repair.
  const face = delegated(() => buildConvexPlanarFace(ruled.surface, { id: settings.value.loopId, edges }, settings.value.face),
    CODE.FACE, 'Actual Convex Plane Face construction refused; original native coefficients were not repaired');
  prefix(request, originalModel, originalCurve, ruled, edges, face);
  check(same(face.plane, ruled.surface) && same(face.model.objects[0], ruled.surface) &&
    same(face.loop, { id: settings.value.loopId, edges }) && same(face.options, settings.value.face) &&
    same(face.model.objects.slice(1), edges) && face.model.name === settings.value.face.evaluationId &&
    Object.is(face.sourceVersion, 0), CODE.BINDING,
  'The real Convex Face must retain the same complete support, actual natural World Curves and source-qualified context');
  const sources: Bindings['sources'] = {
    original: { context: 'original', sourceField: 'request.source', modelField: 'originalModel',
      sourceVersion: 0, modelName: originalModel.name },
    ruled: { context: 'ruled', sourceField: 'ruled.source', modelField: 'ruled.model',
      sourceVersion: 0, modelName: ruled.model.name },
    face: { context: 'face', sourceField: 'face.source', modelField: 'face.model',
      sourceVersion: 0, modelName: face.model.name },
  };
  const boundaryBindings = edges.map((curve, index): BoundaryBinding => {
    const topologyEdge = face.topology.edges[index], pcurve = face.pcurves[index];
    check(topologyEdge !== undefined && pcurve !== undefined && topologyEdge.curveId === curve.id &&
      pcurve.curveId === curve.id && pcurve.edgeId === topologyEdge.id, CODE.BINDING,
    'Canonical actual boundary must resolve the same World Edge and UV pcurve');
    const matching = face.topology.loop.uses.filter(use => use.curveId === curve.id && use.edgeId === topologyEdge.id);
    check(matching.length === 1 && matching[0].pcurveId === pcurve.id, CODE.BINDING,
      'Canonical World Curve must resolve one actual stored Use and UV binding');
    const use = matching[0], traversalIndex = face.topology.loop.uses.findIndex(value => value.id === use.id);
    return { index, boundary: BOUNDARIES[index], curve: curveReference('face', face.model, index + 1, curve.id),
      edgeId: topologyEdge.id, pcurveId: pcurve.id, useId: use.id, traversalIndex, sense: use.sense,
      interval: [use.interval[0], use.interval[1]] };
  });
  const bindings: Bindings = {
    sources, original: curveReference('original', originalModel, selectedObjectIndex, originalCurve.id),
    sections: { lower: curveReference('ruled', ruled.model, 0, lower.id),
      upper: curveReference('ruled', ruled.model, 1, upper.id) },
    support: { ruled: surfaceReference('ruled', ruled.model, 2, ruled.surface.id),
      face: surfaceReference('face', face.model, 0, face.plane.id), completeBitsEqual: true },
    boundaries: four(boundaryBindings),
    face: { faceId: face.topology.face.id, loopId: face.topology.loop.id,
      orientation: face.topology.face.orientation, useIdsInTraversalOrder: four(face.topology.loop.uses.map(use => use.id)) },
  };
  const actualRoles = [ruled.first.id, ruled.second.id, face.plane.id, face.loop.id,
    face.topology.face.id, face.options.evaluationId, ...face.loop.edges.map(curve => curve.id),
    ...face.topology.vertices.map(vertex => vertex.id), ...face.topology.edges.map(edge => edge.id),
    ...face.topology.loop.uses.map(use => use.id), ...face.pcurves.map(pcurve => pcurve.id)];
  check(actualRoles.length === 26 && new Set(actualRoles).size === 26 &&
    settings.roles.every(value => actualRoles.includes(value)), CODE.BINDING,
  'Every reserved actual role must appear exactly once across real derived geometry/topology contexts');
  check(ruled.report.observations.length === 9 && face.bindings.length === 12 && face.pcurves.length === 4 &&
    face.loop.edges.length === 4 && face.topology.edges.length === 4 && face.topology.vertices.length === 4 &&
    face.topology.loop.uses.length === 4 && face.report.edgeCount === 4 && face.report.bindingCount === 12 &&
    ruled.model.objects.length === 3 && face.model.objects.length === 5 && face.report.incidenceValid === true &&
    face.report.geometricValidity === 'not-certified' && face.report.topologyCertified === false && face.report.solid === false &&
    ruled.report.geometricValidity === 'not-certified' && ruled.report.topologyCertified === false && ruled.report.solid === false,
  CODE.BINDING, 'Complete child receipt data must retain the fixed Line/four-edge profile and original false certificates');
  const producerDelegationCount = originalSourceCompileCount + ruledBuildCallCount + boundaryExtractionCallCount + convexFaceBuildCallCount;
  check(originalSourceCompileCount === 1 && ruledBuildCallCount === 1 && boundaryExtractionCallCount === 4 &&
    convexFaceBuildCallCount === 1 && producerDelegationCount === 7, CODE.BINDING,
  'All seven real direct producer delegations must be counted once');
  const report: SourceLineWidthFaceReport = {
    schema: 'barocss-source-line-width-face-report', version: 0, sourceVersion: 0, lengthUnit: 'mm',
    profile: 'unit-line-positive-x-centered-y0-z0', curveId: originalCurve.id, selectedObjectIndex,
    originalModelName: originalModel.name, originalObjectCount: originalModel.objects.length,
    widthIntent: { placement: 'centered-y', centerYMM: 0, centerZMM: 0,
      requestedWidthMM: request.widthMM, halfWidthMM, lowerYMM, upperYMM, representedWidthMM,
      representedWidthEqualsRequest: true },
    originalBasis: { degree: 1, poleCount: 2, knots: [0, 0, 1, 1], weights: [1, 1], domain: [0, 1] },
    diagnostics: { representedLengthMM, representedAreaMM2,
      authority: 'axis-product-diagnostics-not-solid-or-global-error-certificate' },
    generatedRoleIds: settings.roles,
    directCounts: { originalSourceCompileCount: 1, ruledBuildCallCount: 1, boundaryExtractionCallCount: 4,
      convexFaceBuildCallCount: 1, producerDelegationCount: 7,
      curveD0Count: 0, curveD1AttemptCount: 0, surfaceD0Count: 0, surfaceD1AttemptCount: 0,
      rationalOperationCount: 0, sourceWriterCallCount: 0, parentValidationCallCount: 0 },
    childReceiptCounts: { ruledObservationCount: 9, faceBindingCount: 12, boundaryCurveCount: 4,
      facePcurveCount: 4, ruledModelObjectCount: 3, faceModelObjectCount: 5 },
    sourceSizes: { original: originalSize, ruled: sourceSize(ruled.source), face: sourceSize(face.source) },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } },
    preservation: { completeOriginalSource: true, completeOriginalModel: true,
      originalSelectedCurveBits: true, originalUnselectedObjectBits: true,
      completeRuledReceipt: true, completeConvexFaceReceipt: true,
      selectedXZBasisWeightCopies: true, supportBitsAcrossDerivedContexts: true, naturalBoundaryDirections: true,
      sourceQualification: 'retained-source-field-path-and-actual-model-name' },
    quality: { nativeFaceConstructed: true, incidenceValid: true, geometricValidity: 'not-certified',
      topologyCertified: false, solid: false, originalSourceEdited: false, faceTopologyEncodedInNativeSource: false,
      ownedRebuild: true, generalCurveOffset: false, arbitraryDirection: false,
      globalShapeErrorCertified: false, globalBinary64ErrorCertified: false, g1g2Certified: false,
      manufacturingToleranceCertified: false, editorDisplayCertified: false, persistentTopologyBindingCertified: false,
      publication: false, ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumOriginalModelObjects: 16, sourceUTF16: 262144, sourceUTF8: 262144,
      selectedDegree: 1, selectedPoles: 2, selectedKnots: 4, selectedCoordinateAbsMM: 10000,
      minimumLengthMM: 0.000001, minimumWidthMM: 0.000001, maximumWidthMM: 10000,
      maximumSectionCurves: 2, boundaryCurveCount: 4, maximumProducerDelegations: 7, maximumRoleIds: 26,
      identityCharacters: 48, facePrefixCharacters: 20,
      maximumRequestUTF16: 1048576, maximumRequestUTF8: 1048576,
      maximumResultUTF16: 2097152, maximumResultUTF8: 2097152,
      ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64,
      keyCharacters: 128, stringCharacters: 262144 },
    workScope: 'direct-wrapper-delegations-child-native-work-retained-in-full-receipts',
    budgetFailure: 'atomic-no-partial-width-face-or-source',
  };
  const result: SourceLineWidthFaceResult = { request, originalModel, originalCurve, ruled, face, bindings, report };
  let stable = false;
  for (let pass = 0; pass < 8; pass++) {
    const size = fileSize(result);
    if (same(size, report.fileSizes.result)) { stable = true; break; }
    report.fileSizes.result = size;
  }
  check(stable, CODE.FILE, 'Complete width Face result size metadata must settle within8 passes');
  return snapshot(result) as SourceLineWidthFaceResult;
}

/** Reconstruct once from complete original source and authored width, then compare every full receipt and bit. */
export function validateSourceLineWidthFace(input: SourceLineWidthFaceResult): SourceLineWidthFaceReport {
  const owned = record(snapshot(input, true), ['request', 'originalModel', 'originalCurve', 'ruled', 'face', 'bindings', 'report'],
    CODE.OWNED) as unknown as SourceLineWidthFaceResult;
  let expected: SourceLineWidthFaceResult;
  try {
    fileSize(owned);
    expected = buildSourceLineWidthFace(owned.request);
  } catch (cause) {
    throw new SourceLineWidthFaceError(CODE.OWNED, 'Whole original source, width and real derived Face reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED,
    'Owned original context, width, full real parents, sources, World/UV/Use bindings, counts, quality or sizes changed');
  return snapshot(expected.report, true) as SourceLineWidthFaceReport;
}
