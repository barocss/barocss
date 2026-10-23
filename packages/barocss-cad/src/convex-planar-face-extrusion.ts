import type { Point, Curve, Surface, Model } from './types.js';
import { validateConvexPlanarFace } from './own-convex-planar-face.js';
import type { ConvexPlanarFaceResult } from './own-convex-planar-face.js';
import { buildCompatibleRuledSurface } from './nurbs/surfaces/compatible-ruled-surface.js';
import type { CompatibleRuledSurfaceResult } from './nurbs/surfaces/compatible-ruled-surface.js';
import { buildClosedExactPatchShell } from './closed-exact-patch-shell.js';
import type { ClosedExactPatchShellResult } from './closed-exact-patch-shell.js';
import { buildParametricFace } from './face.js';
import type { FaceIds, FaceBundle } from './face.js';
import type { ExactBoundaryFaceAdjacencyAsset, ExactBoundaryFaceAdjacencyPair } from './exact-proof/exact-boundary-face-adjacency.js';
import type { SurfaceBoundary } from './boundary.js';
import { adopt as adoptSourceModel } from './intersect/own-plane-cylinder-intersection-internal.js';
import { same } from './structural-equality.js';

export const ConvexPlanarFaceExtrusionDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', PROFILE: 'PROFILE', DISTANCE: 'DISTANCE',
  REPRESENTABILITY: 'REPRESENTABILITY', PARENT: 'PARENT', RULED: 'RULED', FACE: 'FACE',
  SOURCE: 'SOURCE', SHELL: 'SHELL', BINDING: 'BINDING', BUDGET: 'BUDGET', FILE: 'FILE', OWNED: 'OWNED',
} as const);
export type ConvexPlanarFaceExtrusionDiagnosticCode =
  typeof ConvexPlanarFaceExtrusionDiagnosticCode[keyof typeof ConvexPlanarFaceExtrusionDiagnosticCode];
export class ConvexPlanarFaceExtrusionError extends Error {
  readonly code: ConvexPlanarFaceExtrusionDiagnosticCode;
  constructor(code: ConvexPlanarFaceExtrusionDiagnosticCode, detail: string, cause?: unknown) {
    super(('Direct Convex Face extrusion: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'ConvexPlanarFaceExtrusionError';
    this.code = code;
  }
}

type Four<T> = [T,T,T,T];
type Six<T> = [T,T,T,T,T,T];
type Size = { utf16: number; utf8: number };
export interface ConvexPlanarFaceExtrusionOptions { // EXACT4
  evaluationId: string; // actual Shell ID
  resultIdPrefix: string; // unchanged Shell ASCII1..5
  distanceMM: number;
  direction: 'positive-z';
}
export interface ConvexPlanarFaceExtrusionRequest { // EXACT2
  face: ConvexPlanarFaceResult; // complete direct input, not a width Result cast
  options: ConvexPlanarFaceExtrusionOptions;
}
type Translation = {
  normal: Point; // actual qualified input declared normal, geometrically+Z
  vector: Point; // [0,0,distanceMM]
  distanceMM: number;
  coefficientMappings: {
    origin: {kind:'support-pole';uIndex:number;vIndex:number}
      | {kind:'boundary-pole';boundaryIndex:number;poleIndex:number};
    originalPointMM: Point;
    translatedPointMM: Point;
    actualOffsetMM: Point;
  }[]; // twelve actual maps:4support+8boundary poles
};
type AssetReference = {
  assetIndex: number; // actual shell.assets index
  role: 'bottom' | 'top' | 'wall';
  wallIndex: number | null;
  sourceId: string; // actual generated SourceAsset namespace
  modelName: string; // actual face.geometry.name, may repeat parametric_face
  faceId: string;
  surfaceId: string;
  loopId: string;
};
type CurveReference = {
  sourceField: 'request.face.source' | 'walls.source' | 'shell.assets.source';
  contextIndex: number | null;
  modelName: string;
  objectIndex: number;
  curveId: string;
};
type Bindings = {
  parent: {sourceField:'request.face.source';modelField:'request.face.model';
    modelName:string;faceId:string;surfaceId:string;loopId:string;
    orientation:'forward';boundaryCurveIds:Four<string>};
  assets: Six<AssetReference>; // references only; no raw source/geometry duplication
  bottomChart: {assetIndex:0;kind:'transpose-u-v';
    uRole:'original-support-v';vRole:'original-support-u';
    originalPoleForOutput: {uIndex:number;vIndex:number;originalUIndex:number;originalVIndex:number}[]};
  topChart: {assetIndex:1;kind:'identity-plus-z';
    uRole:'original-support-u';vRole:'original-support-v'};
  walls: Four<{wallIndex:number;assetIndex:number;boundaryIndex:number;
    original:CurveReference;bottom:CurveReference;top:CurveReference;
    surfaceId:string;uRole:'original-boundary-parameter';vRole:'extrusion-interpolation'}>;
  pairs: ClosedExactPatchShellResult['pairs']; // actual qualified12pair list
  directionConvention: 'forward-parent-plus-z-outward-native-quad-charts';
  assetAuthority: 'complete-six-source-assets-retained-in-shell.assets';
};
export interface ConvexPlanarFaceExtrusionReport {
  schema:'barocss-direct-convex-planar-face-extrusion-report';version:0;lengthUnit:'mm';
  profile:'forward-natural-xy-rectangle-positive-z';
  evaluationId:string;parentFaceId:string;parentModelName:string;
  direction:'positive-z';distanceMM:number;normal:Point;translationMM:Point;
  boundsMM:{min:Point;max:Point};
  diagnostics:{spanXMM:number;spanYMM:number;spanZMM:number;volumeMM3:number;
    authority:'axis-range-product-diagnostic-not-volume-certificate'};
  directCounts:{parentValidationCallCount:1;
    ruledBuildCallCount:4;parametricFaceBuildCallCount:6;
    sourceAdoptionCallCount:6;closedShellBuildCallCount:1;
    constructionDelegationCount:17;totalDelegationCount:18;
    curveD0Count:0;curveD1AttemptCount:0;surfaceD0Count:0;surfaceD1AttemptCount:0;
    rationalOperationCount:0;booleanCallCount:0;affineTransformCallCount:0;extrudeCurveCallCount:0};
  childReceiptCounts:{wallReceiptCount:4;assetCount:6;pairCount:12;pairProofCount:12;
    acceptedVertexClassCount:8;acceptedEdgeCount:12;acceptedFaceCount:6;
    vertexLinkCount:8;cornerArcCount:24;globalFreeBoundaryCount:0;
    reservedOriginalInventorySlots:24};
  shellChildDirectCounts:ClosedExactPatchShellResult['report']['childDirectCounts'];
  sourceSizes:{parent:Size;assets:Six<{assetIndex:number;sourceId:string;size:Size}>;
    walls:Four<Size>};
  fileSizes:{request:Size;result:Size};
  preservation:{completeOriginalConvexInput:true;completeWallReceipts:true;
    completeShellAssetsAndPairProofs:true;sourceModelsNotMerged:true;
    originalXYAndBasisWeightBits:true;bottomUVPermutation:true;
    noOriginalCurveRenaming:true;noBooleanProvenanceFabricated:true;noEndpointWelding:true};
  quality:{closed:true;orientedClosedIncidence:true;abstractIncidenceManifold:true;
    geometricValidity:'not-certified';solid:false;embeddedManifoldCertified:false;
    selfIntersectionCertified:false;insideOutsideCertified:false;
    supportRegularityCertified:false;continuityCertified:false;
    volumeCertified:false;globalBinary64ErrorCertified:false;
    manufacturingToleranceCertified:false;editorDisplayCertified:false;
    publication:false;ownedRebuild:true;
    ownership:'independent-copied-cpu-data-gc'};
  limits:{minimumDistanceMM:0.000001;maximumDistanceMM:10000;coordinateAbsMM:10000;
    maximumWalls:4;maximumAssets:6;maximumPairs:12;maximumPairEvaluations:12;
    maximumObservationPairs:36;maximumModelObjects:16;sourceUTF16:262144;sourceUTF8:262144;
    identityCharacters:48;rootPrefixCharacters:5;childPrefixCharacters:8;
    maximumRequestUTF16:2097152;maximumRequestUTF8:2097152;
    maximumResultUTF16:4194304;maximumResultUTF8:4194304;
    ownValues:1048576;ownDepth:64;arrayElements:8192;recordFields:64;
    keyCharacters:128;stringCharacters:262144};
  workScope:'parent-validation-and-new-construction-delegations-child-work-retained-separately';
  budgetFailure:'atomic-no-partial-direct-face-extrusion-or-shell';
}
export interface ConvexPlanarFaceExtrusionResult { // EXACT6
  request:ConvexPlanarFaceExtrusionRequest;
  translation:Translation;
  walls:Four<CompatibleRuledSurfaceResult>;
  shell:ClosedExactPatchShellResult;
  bindings:Bindings;
  report:ConvexPlanarFaceExtrusionReport;
}

const CODE = ConvexPlanarFaceExtrusionDiagnosticCode;
function check(condition: boolean, code: ConvexPlanarFaceExtrusionDiagnosticCode,
  detail: string): asserts condition {
  if (!condition) throw new ConvexPlanarFaceExtrusionError(code, detail);
}
function delegated<T>(action: () => T, code: ConvexPlanarFaceExtrusionDiagnosticCode,
  detail: string): T {
  try { return action(); }
  catch (cause) { throw new ConvexPlanarFaceExtrusionError(code, detail, cause); }
}
function record(input: unknown, fields: string[],
  code: ConvexPlanarFaceExtrusionDiagnosticCode = CODE.INPUT): Record<string, unknown> {
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
function fileSize(input: unknown, limit = 4194304): Size {
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
function identifier(value: unknown, maximum = 48): asserts value is string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'A bounded supported ASCII identity is required');
}
function four<T>(values: T[]): Four<T> {
  check(values.length === 4, CODE.BINDING, 'Exactly four actual entries are required');
  return values as Four<T>;
}
function six<T>(values: T[]): Six<T> {
  check(values.length === 6, CODE.BINDING, 'Exactly six actual source-qualified quad assets are required');
  return values as Six<T>;
}
function copyPoint(point: Point): Point { return [point[0], point[1], point[2]]; }
const BOUNDARIES: Four<SurfaceBoundary> = ['v-min', 'u-max', 'v-max', 'u-min'];
function faceIds(prefix: string, asset: number): FaceIds {
  return { faceId: prefix + '_f_' + asset, loopId: prefix + '_l_' + asset,
    vertexIds: four(Array.from({ length: 4 }, (_, index) => prefix + '_v_' + asset + '_' + index)),
    edgeIds: four(Array.from({ length: 4 }, (_, index) => prefix + '_e_' + asset + '_' + index)),
    curveIds: four(Array.from({ length: 4 }, (_, index) => prefix + '_c_' + asset + '_' + index)) };
}
function reserve(face: ConvexPlanarFaceResult, options: ConvexPlanarFaceExtrusionOptions): void {
  const p = options.resultIdPrefix;
  const original = new Set<string>([face.plane.id, face.loop.id, face.topology.face.id, face.options.evaluationId,
    ...face.model.objects.map(object => object.id), ...face.topology.vertices.map(vertex => vertex.id),
    ...face.topology.edges.map(edge => edge.id), ...face.topology.loop.uses.map(use => use.id),
    ...face.pcurves.map(pcurve => pcurve.id)]);
  // These fixed namespaces are reserved by the unchanged Shell/pair providers, not globally merged Model names.
  original.add('parametric_face'); original.add('curve_reverse_original');
  const roles = [p + '_s_b', p + '_s_t'];
  for (let index = 0; index < 4; index++) roles.push(p + '_c_t_' + index, p + '_s_w_' + index);
  for (let asset = 0; asset < 6; asset++) {
    const ids = faceIds(p, asset);
    roles.push(ids.faceId, ids.loopId, ...ids.vertexIds, ...ids.edgeIds, ...ids.curveIds, p + '_src_' + asset);
  }
  roles.push(options.evaluationId);
  for (let index = 0; index < 12; index++) roles.push(p + '_e' + index);
  for (let index = 0; index < 24; index++) roles.push(p + '_v' + index);
  for (let pair = 0; pair < 12; pair++) {
    const child = p + '_' + pair;
    identifier(child, 8);
    roles.push(child, child + '_e0', child + '_r0');
    for (let vertex = 0; vertex < 8; vertex++) roles.push(child + '_v' + vertex);
  }
  roles.forEach(value => identifier(value));
  check(new Set(roles).size === roles.length && roles.every(value => !original.has(value)), CODE.IDENTITY,
    'Every real derived and Shell-reserved role must be distinct from current original roles before construction');
}
function profile(face: ConvexPlanarFaceResult): { corners: Four<Point>; normal: Point; spanX: number; spanY: number } {
  const plane = face.plane;
  check(face.options.orientation === 'forward' && face.topology.face.orientation === 'forward', CODE.PROFILE,
    'Reverse input is unsupported; positive-Z is never silently applied to a reverse Face');
  check(plane.degreeU === 1 && plane.degreeV === 1 && plane.controlPoints.length === 2 &&
    plane.controlPoints.every(row => row.length === 2) && same(plane.knotsU, [0, 0, 1, 1]) &&
    same(plane.knotsV, [0, 0, 1, 1]) && plane.weights.every(row => row.every(weight => Object.is(weight, 1))),
  CODE.PROFILE, 'Only the actual unit2x2 positivezero unit-basis XY rectangle is supported');
  const a = plane.controlPoints[0][0], b = plane.controlPoints[1][0],
    c = plane.controlPoints[1][1], d = plane.controlPoints[0][1];
  check([a, b, c, d].every(point => point.every(value => Math.abs(value) <= 10000) && point[2] === 0) &&
    Object.is(a[0], d[0]) && Object.is(b[0], c[0]) && Object.is(a[1], b[1]) && Object.is(c[1], d[1]),
  CODE.PROFILE, 'The complete actual support must be an axis rectangle at numeric Z0');
  const spanX = b[0] - a[0], spanY = d[1] - a[1];
  check(Number.isFinite(spanX) && Number.isFinite(spanY), CODE.REPRESENTABILITY,
    'Both actual original rectangle spans must remain finite');
  check(spanX >= 0.000001 && spanY >= 0.000001, CODE.PROFILE,
    'The original natural chart must point along+X/+Y with represented spans at least1e-6mm');
  check(face.loop.edges.length === 4 && face.model.objects.length === 5 && face.pcurves.length === 4 &&
    face.topology.vertices.length === 4 && face.topology.loop.uses.length === 4,
  CODE.PROFILE, 'One complete four-natural-boundary Face is required');
  const corners: Four<Point> = [a, b, c, d];
  for (let index = 0; index < 4; index++) {
    const curve = face.loop.edges[index];
    check(curve.degree === 1 && same(curve.knots, [0, 0, 1, 1]) && same(curve.weights, [1, 1]) &&
      same(curve.controlPoints, [corners[index], corners[(index + 1) % 4]]) &&
      same(face.model.objects[index + 1], curve), CODE.PROFILE,
    'Each canonical input Curve must be the exact actual full natural boundary, not a trimmed surrogate');
  }
  check(face.bindings.length === 12 && face.bindings.every(binding =>
    binding.orientedFaceNormal[0] === 0 && binding.orientedFaceNormal[1] === 0 && binding.orientedFaceNormal[2] === 1),
  CODE.PROFILE, 'The actual qualified declared forward Face normal must be geometrically+Z');
  return { corners, normal: copyPoint(face.bindings[0].orientedFaceNormal), spanX, spanY };
}
function prefix(request: ConvexPlanarFaceExtrusionRequest, translation: Translation | null,
  walls: CompatibleRuledSurfaceResult[], assets: ExactBoundaryFaceAdjacencyAsset[],
  faces: FaceBundle[], shell: ClosedExactPatchShellResult | null): void {
  const full = { request, translation, walls, stagedAssets: assets, stagedFaces: faces, shell };
  fileSize(full);
  snapshot(full);
}
function curveReference(sourceField: CurveReference['sourceField'], contextIndex: number | null,
  model: Model, objectIndex: number, id: string): CurveReference {
  const value = model.objects[objectIndex];
  check(value !== undefined && value.kind === 'curve' && value.id === id, CODE.BINDING,
    'Qualified Curve reference must identify the actual retained source Model member');
  return { sourceField, contextIndex, modelName: model.name, objectIndex, curveId: id };
}

/** Direct full owned forward rectangle input; reuse real wall, quad, source and Shell providers only. */
export function extrudeConvexPlanarFace(faceInput: ConvexPlanarFaceResult,
  optionsInput: ConvexPlanarFaceExtrusionOptions): ConvexPlanarFaceExtrusionResult {
  const data = record(snapshot({ face: faceInput, options: optionsInput }), ['face', 'options']);
  const settings = record(data.options, ['evaluationId', 'resultIdPrefix', 'distanceMM', 'direction']);
  identifier(settings.evaluationId); identifier(settings.resultIdPrefix, 5);
  check(settings.direction === 'positive-z', CODE.PROFILE, 'Only explicit positive-Z direction is supported');
  check(typeof settings.distanceMM === 'number' && Number.isFinite(settings.distanceMM) &&
    settings.distanceMM >= 0.000001 && settings.distanceMM <= 10000, CODE.DISTANCE,
  'Positive distance must be finite and in1e-6..10000mm');
  const request = data as unknown as ConvexPlanarFaceExtrusionRequest, options = request.options;
  const requestSize = fileSize(request, 2097152);
  let parentValidationCallCount = 0, ruledBuildCallCount = 0, parametricFaceBuildCallCount = 0,
    sourceAdoptionCallCount = 0, closedShellBuildCallCount = 0;
  prefix(request, null, [], [], [], null);
  parentValidationCallCount++;
  const parentReport = delegated(() => validateConvexPlanarFace(request.face), CODE.PARENT,
    'Complete actual original Convex Face owned reconstruction refused');
  const parent = request.face;
  check(same(parentReport, parent.report), CODE.BINDING, 'Original input must retain its actual whole-owned report');
  const admitted = profile(parent), p = options.resultIdPrefix;
  reserve(parent, options);
  const translation: Translation = { normal: admitted.normal, vector: [0, 0, options.distanceMM],
    distanceMM: options.distanceMM, coefficientMappings: [] };
  const translate = (point: Point, origin: Translation['coefficientMappings'][number]['origin']): Point => {
    const target: Point = [point[0], point[1], point[2] + options.distanceMM];
    check(target.every(value => Number.isFinite(value) && Math.abs(value) <= 10000), CODE.REPRESENTABILITY,
      'Every actual translated coefficient must remain finite and within10000mm');
    const actualOffsetMM: Point = [target[0] - point[0], target[1] - point[1], target[2] - point[2]];
    check(actualOffsetMM.every(Number.isFinite) && actualOffsetMM[0] === 0 && actualOffsetMM[1] === 0 &&
      Object.is(actualOffsetMM[2], options.distanceMM), CODE.REPRESENTABILITY,
    'Actual coefficient translation must retain the requested positive-Z distance');
    translation.coefficientMappings.push({ origin, originalPointMM: copyPoint(point), translatedPointMM: copyPoint(target), actualOffsetMM });
    return target;
  };
  const top: Surface = { ...parent.plane, id: p + '_s_t',
    knotsU: parent.plane.knotsU.slice(), knotsV: parent.plane.knotsV.slice(),
    weights: parent.plane.weights.map(row => row.slice()),
    controlPoints: parent.plane.controlPoints.map((row, uIndex) => row.map((point, vIndex) =>
      translate(point, { kind: 'support-pole', uIndex, vIndex }))) };
  const bottom: Surface = { kind: 'surface', id: p + '_s_b',
    degreeU: parent.plane.degreeV, degreeV: parent.plane.degreeU,
    knotsU: parent.plane.knotsV.slice(), knotsV: parent.plane.knotsU.slice(),
    controlPoints: Array.from({ length: 2 }, (_, u) => Array.from({ length: 2 }, (_, v) => copyPoint(parent.plane.controlPoints[v][u]))),
    weights: Array.from({ length: 2 }, (_, u) => Array.from({ length: 2 }, (_, v) => parent.plane.weights[v][u])) };
  const topCurves: Curve[] = parent.loop.edges.map((curve, boundaryIndex) => ({ kind: 'curve', id: p + '_c_t_' + boundaryIndex,
    degree: curve.degree, knots: curve.knots.slice(), weights: curve.weights.slice(),
    controlPoints: curve.controlPoints.map((point, poleIndex) => translate(point,
      { kind: 'boundary-pole', boundaryIndex, poleIndex })) }));
  check(translation.coefficientMappings.length === 12, CODE.BINDING,
    'Actual translation must retain four support and eight boundary-pole maps');
  const walls: CompatibleRuledSurfaceResult[] = [], assets: ExactBoundaryFaceAdjacencyAsset[] = [], faces: FaceBundle[] = [];
  prefix(request, translation, walls, assets, faces, null);
  for (let index = 0; index < 4; index++) {
    prefix(request, translation, walls, assets, faces, null);
    ruledBuildCallCount++;
    const wall = delegated(() => buildCompatibleRuledSurface(parent.loop.edges[index], topCurves[index],
      { surfaceId: p + '_s_w_' + index }), CODE.RULED, 'Actual ruled wall' + index + ' construction refused');
    check(same(wall.first, parent.loop.edges[index]) && same(wall.second, topCurves[index]) &&
      same(wall.model.objects, [wall.first, wall.second, wall.surface]), CODE.BINDING,
    'Each full actual wall must retain borrowed original and real translated Curve coefficients');
    walls.push(wall);
    prefix(request, translation, walls, assets, faces, null);
  }
  const supports = [bottom, top, ...walls.map(wall => wall.surface)];
  for (let assetIndex = 0; assetIndex < 6; assetIndex++) {
    prefix(request, translation, walls, assets, faces, null);
    parametricFaceBuildCallCount++;
    const face = delegated(() => buildParametricFace(supports[assetIndex], faceIds(p, assetIndex)), CODE.FACE,
      'Actual outward native quad Face' + assetIndex + ' construction refused');
    check(face.geometry.objects.length === 5 && same(face.geometry.objects[0], supports[assetIndex]) &&
      face.geometry.name === 'parametric_face' && face.topology.face.orientation === 'forward', CODE.BINDING,
    'Every real ParametricFace must retain its complete outward native support and fixed source-qualified Model');
    faces.push(face);
    prefix(request, translation, walls, assets, faces, null);
    sourceAdoptionCallCount++;
    const adopted = delegated(() => adoptSourceModel(face.geometry), CODE.SOURCE,
      'Actual complete quad Model5 source adoption refused');
    sourceSize(adopted.source);
    check(same(adopted.model, face.geometry), CODE.BINDING,
      'The actual adopted full source must retain the entire real FaceBundle geometry Model5');
    assets.push({ sourceId: p + '_src_' + assetIndex, source: adopted.source, face });
    prefix(request, translation, walls, assets, faces, null);
  }
  const pairs: ExactBoundaryFaceAdjacencyPair[] = [];
  for (let index = 0; index < 4; index++) pairs.push({
    first: { sourceId: assets[0].sourceId, boundary: BOUNDARIES[3 - index] },
    second: { sourceId: assets[index + 2].sourceId, boundary: 'v-min' },
  });
  for (let index = 0; index < 4; index++) pairs.push({
    first: { sourceId: assets[1].sourceId, boundary: BOUNDARIES[index] },
    second: { sourceId: assets[index + 2].sourceId, boundary: 'v-max' },
  });
  for (let index = 0; index < 4; index++) pairs.push({
    first: { sourceId: assets[index + 2].sourceId, boundary: 'u-max' },
    second: { sourceId: assets[(index + 1) % 4 + 2].sourceId, boundary: 'u-min' },
  });
  prefix(request, translation, walls, assets, faces, null);
  closedShellBuildCallCount++;
  const shell = delegated(() => buildClosedExactPatchShell(assets, pairs, { shellId: options.evaluationId,
    resultIdPrefix: p, maximumPairEvaluations: 12, maximumObservationPairs: 36 }), CODE.SHELL,
  'Actual unchanged full closed exact-patch Shell proof refused; no endpoints were normalized or welded');
  prefix(request, translation, walls, assets, faces, shell);
  check(same(shell.assets, assets) && same(shell.pairs, pairs) && same(shell.options, {
    shellId: options.evaluationId, resultIdPrefix: p,
    maximumPairEvaluations: 12, maximumObservationPairs: 36,
  }), CODE.BINDING, 'The full actual Shell must retain all six source-qualified Faces and twelve exact pair selectors');
  const cornerArcCount = shell.graph.vertexLinks.reduce((sum, link) => sum + link.cornerArcs.length, 0);
  check(shell.graph.vertices.length === 8 && shell.graph.edges.length === 12 && shell.graph.faces.length === 6 &&
    shell.graph.vertexLinks.length === 8 && cornerArcCount === 24 && shell.pairResults.length === 12 &&
    shell.report.globalFreeBoundaryCount === 0 && shell.report.closed === true &&
    shell.report.orientedClosedIncidence === true && shell.report.abstractIncidenceManifold === true &&
    shell.report.solid === false && shell.report.geometricValidity === 'not-certified' &&
    shell.report.embeddedManifoldCertified === false && shell.report.selfIntersectionCertified === false &&
    shell.report.insideOutsideCertified === false, CODE.BINDING,
  'Accepted closure must retain the actual eight classes, twelve edges, six Faces and unchanged abstract-only scope');
  for (const [index, child] of shell.pairResults.entries()) {
    const pair = pairs[index];
    const selected = [assets.find(asset => asset.sourceId === pair.first.sourceId),
      assets.find(asset => asset.sourceId === pair.second.sourceId)];
    check(same(child.assets, selected) && same(child.report.pairs, [pair]) && child.report.quality.closed === false,
      CODE.BINDING, 'Every complete actual pair proof must retain its original two-asset open scope');
  }
  const bindings: Bindings = {
    parent: { sourceField: 'request.face.source', modelField: 'request.face.model',
      modelName: parent.model.name, faceId: parent.topology.face.id, surfaceId: parent.plane.id,
      loopId: parent.topology.loop.id, orientation: 'forward',
      boundaryCurveIds: four(parent.loop.edges.map(curve => curve.id)) },
    assets: six(shell.assets.map((asset, assetIndex) => ({ assetIndex,
      role: assetIndex === 0 ? 'bottom' as const : assetIndex === 1 ? 'top' as const : 'wall' as const,
      wallIndex: assetIndex < 2 ? null : assetIndex - 2, sourceId: asset.sourceId,
      modelName: asset.face.geometry.name, faceId: asset.face.topology.face.id,
      surfaceId: asset.face.topology.face.surfaceId, loopId: asset.face.topology.loop.id }))),
    bottomChart: { assetIndex: 0, kind: 'transpose-u-v', uRole: 'original-support-v', vRole: 'original-support-u',
      originalPoleForOutput: Array.from({ length: 2 }, (_, uIndex) => Array.from({ length: 2 }, (_, vIndex) =>
        ({ uIndex, vIndex, originalUIndex: vIndex, originalVIndex: uIndex }))).flat() },
    topChart: { assetIndex: 1, kind: 'identity-plus-z', uRole: 'original-support-u', vRole: 'original-support-v' },
    walls: four(walls.map((wall, wallIndex) => ({ wallIndex, assetIndex: wallIndex + 2, boundaryIndex: wallIndex,
      original: curveReference('request.face.source', null, parent.model, wallIndex + 1, parent.loop.edges[wallIndex].id),
      bottom: curveReference('walls.source', wallIndex, wall.model, 0, wall.first.id),
      top: curveReference('walls.source', wallIndex, wall.model, 1, wall.second.id), surfaceId: wall.surface.id,
      uRole: 'original-boundary-parameter' as const, vRole: 'extrusion-interpolation' as const }))),
    pairs: shell.pairs,
    directionConvention: 'forward-parent-plus-z-outward-native-quad-charts',
    assetAuthority: 'complete-six-source-assets-retained-in-shell.assets',
  };
  const actualPoints = shell.graph.vertices.map(vertex => vertex.representative.pointMM);
  const min = [0, 1, 2].map(axis => Math.min(...actualPoints.map(point => point[axis]))) as Point;
  const max = [0, 1, 2].map(axis => Math.max(...actualPoints.map(point => point[axis]))) as Point;
  const volumeMM3 = admitted.spanX * admitted.spanY * options.distanceMM;
  check([...min, ...max, volumeMM3].every(Number.isFinite), CODE.REPRESENTABILITY,
    'Actual accepted bounds and the uncertified axis-product diagnostic must remain finite');
  check(parentValidationCallCount === 1 && ruledBuildCallCount === 4 && parametricFaceBuildCallCount === 6 &&
    sourceAdoptionCallCount === 6 && closedShellBuildCallCount === 1, CODE.BINDING,
  'Only actual completed direct calls can establish the retained delegation counts');
  const report: ConvexPlanarFaceExtrusionReport = {
    schema: 'barocss-direct-convex-planar-face-extrusion-report', version: 0, lengthUnit: 'mm',
    profile: 'forward-natural-xy-rectangle-positive-z', evaluationId: options.evaluationId,
    parentFaceId: parent.topology.face.id, parentModelName: parent.model.name,
    direction: 'positive-z', distanceMM: options.distanceMM, normal: translation.normal,
    translationMM: translation.vector, boundsMM: { min, max },
    diagnostics: { spanXMM: admitted.spanX, spanYMM: admitted.spanY, spanZMM: options.distanceMM, volumeMM3,
      authority: 'axis-range-product-diagnostic-not-volume-certificate' },
    directCounts: { parentValidationCallCount: 1, ruledBuildCallCount: 4, parametricFaceBuildCallCount: 6,
      sourceAdoptionCallCount: 6, closedShellBuildCallCount: 1, constructionDelegationCount: 17,
      totalDelegationCount: 18, curveD0Count: 0, curveD1AttemptCount: 0, surfaceD0Count: 0,
      surfaceD1AttemptCount: 0, rationalOperationCount: 0, booleanCallCount: 0, affineTransformCallCount: 0,
      extrudeCurveCallCount: 0 },
    childReceiptCounts: { wallReceiptCount: 4, assetCount: 6, pairCount: 12, pairProofCount: 12,
      acceptedVertexClassCount: 8, acceptedEdgeCount: 12, acceptedFaceCount: 6, vertexLinkCount: 8,
      cornerArcCount: 24, globalFreeBoundaryCount: 0, reservedOriginalInventorySlots: 24 },
    shellChildDirectCounts: shell.report.childDirectCounts,
    sourceSizes: { parent: sourceSize(parent.source),
      assets: six(shell.assets.map((asset, assetIndex) => ({ assetIndex, sourceId: asset.sourceId, size: sourceSize(asset.source) }))),
      walls: four(walls.map(wall => sourceSize(wall.source))) },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } },
    preservation: { completeOriginalConvexInput: true, completeWallReceipts: true,
      completeShellAssetsAndPairProofs: true, sourceModelsNotMerged: true, originalXYAndBasisWeightBits: true,
      bottomUVPermutation: true, noOriginalCurveRenaming: true, noBooleanProvenanceFabricated: true, noEndpointWelding: true },
    quality: { closed: true, orientedClosedIncidence: true, abstractIncidenceManifold: true,
      geometricValidity: 'not-certified', solid: false, embeddedManifoldCertified: false,
      selfIntersectionCertified: false, insideOutsideCertified: false, supportRegularityCertified: false,
      continuityCertified: false, volumeCertified: false, globalBinary64ErrorCertified: false,
      manufacturingToleranceCertified: false, editorDisplayCertified: false, publication: false,
      ownedRebuild: true, ownership: 'independent-copied-cpu-data-gc' },
    limits: { minimumDistanceMM: 0.000001, maximumDistanceMM: 10000, coordinateAbsMM: 10000,
      maximumWalls: 4, maximumAssets: 6, maximumPairs: 12, maximumPairEvaluations: 12,
      maximumObservationPairs: 36, maximumModelObjects: 16, sourceUTF16: 262144, sourceUTF8: 262144,
      identityCharacters: 48, rootPrefixCharacters: 5, childPrefixCharacters: 8,
      maximumRequestUTF16: 2097152, maximumRequestUTF8: 2097152,
      maximumResultUTF16: 4194304, maximumResultUTF8: 4194304,
      ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64,
      keyCharacters: 128, stringCharacters: 262144 },
    workScope: 'parent-validation-and-new-construction-delegations-child-work-retained-separately',
    budgetFailure: 'atomic-no-partial-direct-face-extrusion-or-shell',
  };
  const result: ConvexPlanarFaceExtrusionResult = { request, translation, walls: four(walls), shell, bindings, report };
  let settled = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    const size = fileSize(result);
    if (same(size, report.fileSizes.result)) { settled = true; break; }
    report.fileSizes.result = size;
  }
  check(settled && same(fileSize(result), report.fileSizes.result), CODE.FILE,
    'Complete result file-size metadata must settle within eight passes');
  return snapshot(result) as ConvexPlanarFaceExtrusionResult;
}

/** Reconstruct the complete owned family once; no partial parent or proof acts as authority. */
export function validateConvexPlanarFaceExtrusion(value: unknown): ConvexPlanarFaceExtrusionReport {
  try {
    const owned = record(snapshot(value, true),
      ['request', 'translation', 'walls', 'shell', 'bindings', 'report'], CODE.OWNED) as unknown as ConvexPlanarFaceExtrusionResult;
    fileSize(owned);
    const expected = extrudeConvexPlanarFace(owned.request.face, owned.request.options);
    check(same(owned, expected), CODE.OWNED, 'Whole owned data differs from its actual complete request reconstruction');
    return snapshot(expected.report, true) as ConvexPlanarFaceExtrusionReport;
  } catch (cause) {
    if (cause instanceof ConvexPlanarFaceExtrusionError && cause.code === CODE.OWNED) throw cause;
    throw new ConvexPlanarFaceExtrusionError(CODE.OWNED, 'Whole owned reconstruction refused', cause);
  }
}
