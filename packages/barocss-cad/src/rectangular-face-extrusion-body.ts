import { validateConvexPlanarFaceExtrusion } from './convex-planar-face-extrusion.js';
import type { ConvexPlanarFaceExtrusionResult } from './convex-planar-face-extrusion.js';
import { buildCompatibleRuledSurface } from './compatible-ruled-surface.js';
import type { CompatibleRuledSurfaceResult } from './compatible-ruled-surface.js';
import { buildMultiSpanVLinearSurfacePlaneSection } from './multispan-vlinear-plane-section.js';
import type { MultiSpanVLinearSurfacePlaneSectionOptions, MultiSpanVLinearSurfacePlaneSectionAsset } from './multispan-vlinear-plane-section.js';
import { buildSectionExactSurfaceBinding } from './section-exact-surface-binding.js';
import type { SectionExactSurfaceBindingOptions } from './section-exact-surface-binding.js';
import { buildExactSurfaceLowerTrim } from './exact-surface-lower-trim.js';
import type { ExactSurfaceLowerTrimOptions } from './exact-surface-lower-trim.js';
import { buildPairedSectionPlaneCap } from './paired-section-plane-cap.js';
import type { PairedSectionPlaneCapOptions } from './paired-section-plane-cap.js';
import { buildTranslatedSurfaceBaseFace } from './translated-surface-base-face.js';
import type { TranslatedSurfaceBaseFaceOptions } from './translated-surface-base-face.js';
import { buildTranslatedSurfaceEndFaces } from './translated-surface-end-faces.js';
import type { TranslatedSurfaceEndFacesOptions } from './translated-surface-end-faces.js';
import { measureTranslatedSurfaceStripVolume } from './translated-surface-strip-volume.js';
import type { TranslatedSurfaceStripVolumeOptions } from './translated-surface-strip-volume.js';
import { buildQualifiedTranslatedStripBody } from './qualified-translated-strip-body.js';
import type { QualifiedTranslatedStripBodyOptions, QualifiedTranslatedStripBodyResult, QualifiedTranslatedStripBodyReport } from './qualified-translated-strip-body.js';
import { proveRectangularExtrusionBodyCorrespondenceTrusted } from './rectangular-extrusion-cube-correspondence-internal.js';
import type { RectangularExtrusionCubeProof } from './rectangular-extrusion-cube-correspondence-internal.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionFraction } from './section-rational-internal.js';
import type { Curve, Surface, Point } from './types.js';
import { same } from './structural-equality.js';

export const RectangularFaceExtrusionBodyDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', PROFILE: 'PROFILE', DISTANCE: 'DISTANCE',
  PARENT: 'PARENT', RULED: 'RULED', SECTION: 'SECTION', BINDING: 'BINDING',
  CAP: 'CAP', CONSTRUCTION: 'CONSTRUCTION', MATERIAL: 'MATERIAL',
  REPRESENTABILITY: 'REPRESENTABILITY', BUDGET: 'BUDGET', FILE: 'FILE', OWNED: 'OWNED',
} as const);
export type RectangularFaceExtrusionBodyDiagnosticCode =
  typeof RectangularFaceExtrusionBodyDiagnosticCode[keyof typeof RectangularFaceExtrusionBodyDiagnosticCode];
export class RectangularFaceExtrusionBodyError extends Error {
  readonly code: RectangularFaceExtrusionBodyDiagnosticCode;
  constructor(code: RectangularFaceExtrusionBodyDiagnosticCode, detail: string, cause?: unknown) {
    super(('Rectangular Face extrusion Body: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'RectangularFaceExtrusionBodyError';
    this.code = code;
  }
}

type Fraction = SectionFraction;
type Size = {utf16:number;utf8:number};
type SupportIds = {sourceId:string;surfaceId:string;
  bottomCurveId:string;extendedCurveId:string};
type Recipe = {
  lowerSection:MultiSpanVLinearSurfacePlaneSectionOptions;
  upperSection:MultiSpanVLinearSurfacePlaneSectionOptions;
  lowerBinding:SectionExactSurfaceBindingOptions;
  upperBinding:SectionExactSurfaceBindingOptions;
  lowerWall:ExactSurfaceLowerTrimOptions;
  upperWall:ExactSurfaceLowerTrimOptions;
  cap:PairedSectionPlaneCapOptions;
  base:TranslatedSurfaceBaseFaceOptions;
  ends:TranslatedSurfaceEndFacesOptions;
  volume:TranslatedSurfaceStripVolumeOptions;
  body:QualifiedTranslatedStripBodyOptions;
};
export interface RectangularFaceExtrusionBodyOptions {
  evaluationId:string;resultIdPrefix:string;
  lowerSupport:SupportIds;upperSupport:SupportIds;
  recipe:Recipe;
  maximumParents:1;maximumSupports:2;maximumProducerCalls:13;
}
export interface RectangularFaceExtrusionBodyRequest {
  extrusion:ConvexPlanarFaceExtrusionResult;
  options:RectangularFaceExtrusionBodyOptions;
}
type Support = {
  role:'lower'|'upper';sourceId:string;
  inputCurves:[Curve,Curve];ruled:CompatibleRuledSurfaceResult;
};
export interface RectangularFaceExtrusionBodyResult {
  request:RectangularFaceExtrusionBodyRequest;
  supports:[Support,Support];
  body:QualifiedTranslatedStripBodyResult;
  bindings:Bindings;proof:Proof;
  report:RectangularFaceExtrusionBodyReport;
}
type QualifiedRef = {
  sourceField:string;modelField:string;sourceId:string|null;
  modelName:string;objectIndex:number;objectId:string;
};
type Bindings = {
  parent:{evaluationId:string;faceId:string;shellId:string;
    assetAuthority:'request.extrusion.shell.assets'};
  roof:QualifiedRef&{assetIndex:1;surfaceId:string};
  supports:[QualifiedRef&{role:'lower';surfaceId:string},
    QualifiedRef&{role:'upper';surfaceId:string}];
  material:{bodyId:string;shellId:string;certificateId:string;
    modelNames:[string,string];sourceIds:[string,string]};
  sourceAuthority:'full-parent-top-asset-two-new-ruled-sources-and-full-qualified-body';
  reservedIds:string[];
};
type Proof = RectangularExtrusionCubeProof;
export interface RectangularFaceExtrusionBodyReport {
  schema:'barocss-rectangular-face-extrusion-body';version:0;
  evaluationId:string;parentEvaluationId:string;parentShellId:string;
  bodyId:string;shellId:string;materialCertificateId:string;
  profile:'forward-unit-chart-xy-rectangle-positive-z-canonical-overshoot';
  distanceMM:number;supportHeightMM:number;lengthUnit:'mm';volumeUnit:'mm3';
  exactVolumeMM3:Fraction;volumeMM3:number;
  conversionError:QualifiedTranslatedStripBodyReport['conversionError'];
  vertexCount:8;edgeCount:12;faceCount:6;useCount:24;
  modelCount:2;geometryObjectCount:18;
  wholeFaceCorrespondenceCount:6;wholeEdgeCorrespondenceCount:12;
  vertexCorrespondenceCount:8;
  directCounts:{parentValidationCount:1;ruledBuildCount:2;
    sectionBuildCount:2;bindingBuildCount:2;wallBuildCount:2;
    capBuildCount:1;baseBuildCount:1;endBuildCount:1;
    volumeBuildCount:1;qualifiedBodyBuildCount:1;
    newProducerCallCount:13;totalDelegationCount:14;
    rootCurveD0Count:0;rootCurveD1Count:0;
    rootSurfaceD0Count:0;rootSurfaceD1Count:0;
    rootSourceCompilationCount:0;rootFloatConversionCount:0};
  rationalCounts:ReturnType<SectionRationalContext['counts']>;
  quality:{freshRestrictedSolid:true;sourceDefinedOccupiedRegion:true;
    wholeBoundaryImage:true;outwardMaterial:true;
    exactExtrusionRegionCorrespondence:true;parentFlagsUnchanged:true;
    parentShellPromoted:false;genericExtrusionSolid:false;genericBoolean:false;
    generalCurvedSolid:false;globalBinary64ErrorCertified:false;
    manufacturingToleranceCertified:false;welding:false;publication:false;
    ownership:'independent-copied-cpu-data-gc'};
  fileSizes:{request:Size;result:Size};ownValues:number;
  limits:{maximumParents:1;maximumSupports:2;maximumProducerCalls:13;
    maximumDistanceMM:5000;maximumCoordinateAbsMM:10000;
    maximumRootCurveDegree:2;maximumCubeTensorDegree:2;
    maximumFaceCorrespondences:6;maximumEdgeCorrespondences:12;
    maximumVertexCorrespondences:8;maximumOriginalObjectsPerModel:16;
    maximumBodyObjects:18;maximumBodyModels:2;
    minimumDerivedWeight:0.000001;maximumDerivedWeight:1000000;
    sourceUTF16:262144;sourceUTF8:262144;
    requestBytes:4194304;resultBytes:8388608;
    ownValues:4194304;ownDepth:64;arrayElements:8192;recordFields:64;
    keyCharacters:128;stringCharacters:262144;prefixCharacters:12;
    rationalOperations:200000;gcdSteps:200000;rationalIntegerBits:8192;
    maximumRootFloatConversions:0;maximumSettlePasses:8};
  workScope:'one-full-parent-validation-thirteen-new-producers-and-root-correspondence-arithmetic';
  budgetFailure:'atomic-no-partial-material-qualification';
}

const CODE = RectangularFaceExtrusionBodyDiagnosticCode;
const OWN_LIMIT = 4194304, REQUEST_LIMIT = 4194304, RESULT_LIMIT = 8388608;
function check(condition: boolean, code: RectangularFaceExtrusionBodyDiagnosticCode,
  detail: string): asserts condition {
  if (!condition) throw new RectangularFaceExtrusionBodyError(code, detail);
}
function delegated<T>(action: () => T, code: RectangularFaceExtrusionBodyDiagnosticCode,
  detail: string): T {
  try { return action(); } catch (cause) {
    if (cause instanceof RectangularFaceExtrusionBodyError) throw cause;
    throw new RectangularFaceExtrusionBodyError(code, detail, cause);
  }
}
function finite(value: number, detail: string,
  code: RectangularFaceExtrusionBodyDiagnosticCode = CODE.REPRESENTABILITY): number {
  check(Number.isFinite(value), code, detail);
  return value;
}
/** Descriptor inspection never invokes authored getters. Counts every retained occurrence. */
function ownData(input: unknown, owned = false, copyData = true): { value: unknown; count: number } {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  const budget = owned ? CODE.OWNED : CODE.BUDGET;
  let count = 0;
  const ancestors = new Set<object>();
  const visit = (value: unknown, depth: number): unknown => {
    check(++count <= OWN_LIMIT && depth <= 64, budget, 'Own value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      check(Number.isFinite(value), code, 'Finite own numbers required');
      return value;
    }
    if (typeof value === 'string') {
      check(value.length <= 262144, budget, 'Own string limit exceeded');
      return value;
    }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic plain own data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'Foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.length <= (array ? 8193 : 64), budget, 'Own field limit exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 &&
      'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable)),
    code, 'Getter, symbol or hidden own field refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 8192,
        budget, 'Own array limit exceeded');
      check(keys.length === length + 1, code, 'Dense arrays without extra fields required');
      const output: unknown[] = [];
      for (let index = 0; index < length; index++) {
        check(Object.hasOwn(descriptors, String(index)), code, 'Sparse array refused');
        const item = visit(descriptors[String(index)].value, depth + 1);
        if (copyData) output.push(item);
      }
      result = copyData ? output : value;
    } else {
      const output: Record<string, unknown> = {};
      for (const key of keys as string[]) {
        const item = visit(descriptors[key].value, depth + 1);
        if (copyData) Object.defineProperty(output, key, { value: item, writable: true,
          configurable: true, enumerable: true });
      }
      result = copyData ? output : value;
    }
    ancestors.delete(value);
    return result;
  };
  return { value: visit(input, 0), count };
}
function record(input: unknown, fields: string[]): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), CODE.INPUT,
    'Own record required');
  const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    CODE.INPUT, 'Exact fields required: ' + fields.join(','));
  return data;
}
function identifier(input: unknown): string {
  check(typeof input === 'string' && input.length >= 1 && input.length <= 48 &&
    /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), CODE.IDENTITY, 'ASCII ID1..48 required');
  return input;
}
/** Measure compact native JSON preserving negative zero and one trailing newline. */
function fileSize(input: unknown, limit: number): Size {
  let utf16 = 0, utf8 = 0;
  const encoder = new TextEncoder();
  const append = (text: string): void => {
    utf16 += text.length;
    utf8 += encoder.encode(text).length;
    check(utf16 <= limit && utf8 <= limit, CODE.FILE, 'Complete JSON file envelope exceeded');
  };
  const visit = (value: unknown): void => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
      append(JSON.stringify(value));
    } else if (typeof value === 'number') {
      check(Number.isFinite(value), CODE.FILE, 'Finite JSON number required');
      append(Object.is(value, -0) ? '-0' : JSON.stringify(value));
    } else if (Array.isArray(value)) {
      append('[');
      value.forEach((item, index) => { if (index) append(','); visit(item); });
      append(']');
    } else {
      check(value !== null && typeof value === 'object', CODE.FILE, 'Own JSON record required');
      append('{');
      Object.entries(value).forEach(([key, item], index) => {
        if (index) append(',');
        append(JSON.stringify(key)); append(':'); visit(item);
      });
      append('}');
    }
  };
  visit(input); append('\n');
  return { utf16, utf8 };
}
function contexts(input: unknown): Set<string> {
  const values = new Set<string>();
  const visit = (value: unknown, key = ''): void => {
    if (typeof value === 'string') {
      if (key === 'id' || key === 'name' || /Ids?$/.test(key) || key === 'resultIdPrefix') values.add(value);
      return;
    }
    if (Array.isArray(value)) value.forEach(item => visit(item, key));
    else if (value !== null && typeof value === 'object') {
      for (const [field, item] of Object.entries(value)) visit(item, field);
    }
  };
  visit(input);
  return values;
}
function supportIds(input: unknown): SupportIds {
  const data = record(input, ['sourceId', 'surfaceId', 'bottomCurveId', 'extendedCurveId']);
  return { sourceId: identifier(data.sourceId), surfaceId: identifier(data.surfaceId),
    bottomCurveId: identifier(data.bottomCurveId), extendedCurveId: identifier(data.extendedCurveId) };
}
function recipe(input: unknown): Recipe {
  const data = record(input, ['lowerSection', 'upperSection', 'lowerBinding', 'upperBinding',
    'lowerWall', 'upperWall', 'cap', 'base', 'ends', 'volume', 'body']);
  const admit = (value: unknown, fields: string[], caps: Record<string, number>, prefix = false): void => {
    const r = record(value, fields);
    for (const [field, expected] of Object.entries(caps)) {
      check(r[field] === expected, CODE.BUDGET, 'Complete fixed provider budget required: ' + field);
    }
    for (const field of fields) {
      if (Object.hasOwn(caps, field) || field === 'orientation') continue;
      const id = identifier(r[field]);
      if (field === 'resultIdPrefix' && prefix) check(id.length <= 12, CODE.IDENTITY, 'Provider prefix1..12 required');
    }
  };
  for (const side of ['lowerSection', 'upperSection']) admit(data[side],
    ['evaluationId', 'curveId', 'surfacePcurveId', 'planePcurveId', 'maximumObservations'],
    { maximumObservations: 17 });
  for (const side of ['lowerBinding', 'upperBinding']) admit(data[side],
    ['evaluationId', 'pcurveId', 'maximumObservations'], { maximumObservations: 17 });
  for (const side of ['lowerWall', 'upperWall']) admit(data[side],
    ['evaluationId', 'resultIdPrefix', 'orientation', 'maximumObservations'], { maximumObservations: 40 }, true);
  check((data.lowerWall as ExactSurfaceLowerTrimOptions).orientation === 'forward' &&
    (data.upperWall as ExactSurfaceLowerTrimOptions).orientation === 'reverse', CODE.PROFILE,
  'Canonical lower-forward/upper-reverse recipe required');
  admit(data.cap, ['evaluationId', 'resultIdPrefix', 'maximumSections', 'maximumConnectors', 'maximumObservations'],
    { maximumSections: 2, maximumConnectors: 2, maximumObservations: 40 }, true);
  admit(data.base, ['evaluationId', 'resultIdPrefix', 'baseLeftCurveId', 'baseRightCurveId', 'maximumParents', 'maximumObservations'],
    { maximumParents: 2, maximumObservations: 40 }, true);
  admit(data.ends, ['evaluationId', 'resultIdPrefix', 'baseLeftCurveId', 'baseRightCurveId', 'maximumParents', 'maximumObservations'],
    { maximumParents: 3, maximumObservations: 24 }, true);
  admit(data.volume, ['evaluationId', 'maximumParents', 'maximumObservations'],
    { maximumParents: 3, maximumObservations: 17 });
  admit(data.body, ['evaluationId', 'resultIdPrefix', 'maximumParents', 'maximumModels', 'maximumObservations'],
    { maximumParents: 3, maximumModels: 2, maximumObservations: 24 }, true);
  const result = data as unknown as Recipe;
  check(result.base.baseLeftCurveId === result.ends.baseLeftCurveId &&
    result.base.baseRightCurveId === result.ends.baseRightCurveId, CODE.IDENTITY,
  'Base/end recipes must share the explicit same Line identities');
  return result;
}
function reserveInventory(options: RectangularFaceExtrusionBodyOptions, parent: ConvexPlanarFaceExtrusionResult): string[] {
  const occupied = contexts(parent), reservedIds: string[] = [];
  const reserve = (value: string): void => {
    identifier(value);
    check(!occupied.has(value), CODE.IDENTITY, 'Fresh role collides with a full parent or planned role: ' + value);
    occupied.add(value); reservedIds.push(value);
  };
  const repeat = (prefix: string, suffix: string, count: number): void => {
    for (let i = 0; i < count; i++) reserve(prefix + suffix + i);
  };
  reserve(options.evaluationId);
  for (const ids of [options.lowerSupport, options.upperSupport]) {
    reserve(ids.sourceId); reserve(ids.surfaceId); reserve(ids.bottomCurveId); reserve(ids.extendedCurveId);
  }
  const r = options.recipe;
  for (const section of [r.lowerSection, r.upperSection]) {
    reserve(section.evaluationId); reserve(section.curveId);
    reserve(section.surfacePcurveId); reserve(section.planePcurveId);
  }
  for (const binding of [r.lowerBinding, r.upperBinding]) {
    reserve(binding.evaluationId); reserve(binding.pcurveId);
  }
  for (const wall of [r.lowerWall, r.upperWall]) {
    reserve(wall.evaluationId);
    const p = wall.resultIdPrefix;
    for (const suffix of ['_bottom', '_right', '_left', '_bottom_uv', '_right_uv', '_left_uv']) reserve(p + suffix);
    for (const suffix of ['_v', '_e', '_use']) repeat(p, suffix, 4);
    reserve(p + '_loop'); reserve(p + '_face');
  }
  reserve(r.cap.evaluationId);
  const cp = r.cap.resultIdPrefix;
  for (const suffix of ['_right', '_left', '_right_uv', '_left_uv']) reserve(cp + suffix);
  for (const suffix of ['_v', '_e', '_use']) repeat(cp, suffix, 4);
  reserve(cp + '_loop'); reserve(cp + '_face');
  reserve(r.base.evaluationId); reserve(r.base.baseLeftCurveId); reserve(r.base.baseRightCurveId);
  const bp = r.base.resultIdPrefix;
  reserve(bp + '_surface');
  for (const suffix of ['_uv', '_v', '_e', '_use']) repeat(bp, suffix, 4);
  reserve(bp + '_loop'); reserve(bp + '_face');
  reserve(r.ends.evaluationId);
  const ep = r.ends.resultIdPrefix;
  for (const suffix of ['_s', '_f', '_l']) repeat(ep, suffix, 2);
  for (let f = 0; f < 2; f++) {
    for (const suffix of ['_v', '_e', '_use', '_uv']) repeat(ep + '_f' + f, suffix, 4);
  }
  reserve(r.volume.evaluationId); reserve(r.body.evaluationId);
  const p = r.body.resultIdPrefix;
  repeat(p, '_v', 8); repeat(p, '_e', 12); repeat(p, '_f', 6); repeat(p, '_l', 6); repeat(p, '_use', 24);
  for (const suffix of ['_shell', '_body', '_body_material', '_m0', '_m1', '_source0', '_source1']) reserve(p + suffix);
  check(reservedIds.length === 208, CODE.IDENTITY, 'Exact208-role inventory required');
  return reservedIds;
}
function line(id: string, points: [Point, Point]): Curve {
  return { kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1],
    controlPoints: points.map(point => point.slice() as Point), weights: [1, 1] };
}
function limits(): RectangularFaceExtrusionBodyReport['limits'] {
  return { maximumParents: 1, maximumSupports: 2, maximumProducerCalls: 13,
    maximumDistanceMM: 5000, maximumCoordinateAbsMM: 10000,
    maximumRootCurveDegree: 2, maximumCubeTensorDegree: 2,
    maximumFaceCorrespondences: 6, maximumEdgeCorrespondences: 12,
    maximumVertexCorrespondences: 8, maximumOriginalObjectsPerModel: 16,
    maximumBodyObjects: 18, maximumBodyModels: 2,
    minimumDerivedWeight: 1e-6, maximumDerivedWeight: 1e6,
    sourceUTF16: 262144, sourceUTF8: 262144,
    requestBytes: 4194304, resultBytes: 8388608,
    ownValues: 4194304, ownDepth: 64, arrayElements: 8192, recordFields: 64,
    keyCharacters: 128, stringCharacters: 262144, prefixCharacters: 12,
    rationalOperations: 200000, gcdSteps: 200000, rationalIntegerBits: 8192,
    maximumRootFloatConversions: 0, maximumSettlePasses: 8 };
}
/** Qualify a fresh restricted material Body without promoting the retained abstract Shell. */
export function qualifyRectangularFaceExtrusionBody(input: RectangularFaceExtrusionBodyRequest):
  RectangularFaceExtrusionBodyResult {
  const data = record(ownData(input).value, ['extrusion', 'options']);
  const o = record(data.options, ['evaluationId', 'resultIdPrefix', 'lowerSupport', 'upperSupport',
    'recipe', 'maximumParents', 'maximumSupports', 'maximumProducerCalls']);
  check(o.maximumParents === 1 && o.maximumSupports === 2 && o.maximumProducerCalls === 13,
    CODE.BUDGET, 'Complete fixed wrapper budgets1/2/13 required');
  const prefix = identifier(o.resultIdPrefix);
  check(prefix.length <= 12, CODE.IDENTITY, 'Wrapper prefix1..12 required');
  const options: RectangularFaceExtrusionBodyOptions = {
    evaluationId: identifier(o.evaluationId), resultIdPrefix: prefix,
    lowerSupport: supportIds(o.lowerSupport), upperSupport: supportIds(o.upperSupport),
    recipe: recipe(o.recipe), maximumParents: 1, maximumSupports: 2, maximumProducerCalls: 13,
  };
  const extrusion = data.extrusion as ConvexPlanarFaceExtrusionResult;
  const request: RectangularFaceExtrusionBodyRequest = { extrusion, options };
  const requestSize = fileSize(request, REQUEST_LIMIT);
  type Counts = { [K in keyof RectangularFaceExtrusionBodyReport['directCounts']]: number };
  const counts: Counts = {
    parentValidationCount: 0, ruledBuildCount: 0, sectionBuildCount: 0,
    bindingBuildCount: 0, wallBuildCount: 0, capBuildCount: 0,
    baseBuildCount: 0, endBuildCount: 0, volumeBuildCount: 0,
    qualifiedBodyBuildCount: 0, newProducerCallCount: 0, totalDelegationCount: 0,
    rootCurveD0Count: 0, rootCurveD1Count: 0,
    rootSurfaceD0Count: 0, rootSurfaceD1Count: 0,
    rootSourceCompilationCount: 0, rootFloatConversionCount: 0,
  };
  counts.parentValidationCount++; counts.totalDelegationCount++;
  delegated(() => validateConvexPlanarFaceExtrusion(extrusion), CODE.PARENT,
    'Whole actual Convex Face extrusion validation refused');
  const parentFace = extrusion.request.face;
  const plane = parentFace.plane;
  check(parentFace.options.orientation === 'forward' && parentFace.topology.face.orientation === 'forward' &&
    extrusion.request.options.direction === 'positive-z', CODE.PROFILE,
  'Only the original forward natural rectangle and positive-Z direction are supported');
  check(plane.degreeU === 1 && plane.degreeV === 1 && plane.controlPoints.length === 2 &&
    plane.controlPoints.every(row => row.length === 2) &&
    same(plane.knotsU, [0, 0, 1, 1]) && same(plane.knotsV, [0, 0, 1, 1]) &&
    plane.weights.every(row => row.every(weight => Object.is(weight, 1))),
  CODE.PROFILE, 'Actual degree1 unit-chart unit-weight XY support required');
  const a = plane.controlPoints[0][0], b = plane.controlPoints[1][0],
    c = plane.controlPoints[1][1], d = plane.controlPoints[0][1];
  check([a, b, c, d].every(point => point.every(value => Number.isFinite(value) && Math.abs(value) <= 10000) &&
    point[2] === 0) && Object.is(a[0], d[0]) && Object.is(b[0], c[0]) &&
    Object.is(a[1], b[1]) && Object.is(c[1], d[1]) && b[0] > a[0] && d[1] > a[1],
  CODE.PROFILE, 'Actual +X/+Y natural rectangle at numeric Z0 required');
  const distance = extrusion.request.options.distanceMM;
  check(Number.isFinite(distance) && distance > 0 && distance <= 5000,
    CODE.DISTANCE, 'Positive distance no greater than5000mm required');
  const extension = finite(distance * 2, 'Canonical support extension overflow');
  check(extension <= 10000, CODE.DISTANCE, 'Canonical support extension exceeds10000mm');
  const q = new SectionRationalContext((kind, detail) => {
    throw new RectangularFaceExtrusionBodyError(CODE[kind], detail);
  });
  const zero = q.integer(0), two = q.integer(2);
  check(q.compare(q.from(extension), q.mul(two, q.from(distance))) === 0,
    CODE.REPRESENTABILITY, 'Represented support extension must equal exact2D');
  const dx = q.sub(q.from(b[0]), q.from(a[0])), dy = q.sub(q.from(d[1]), q.from(a[1]));
  check(q.compare(dx, zero) > 0 && q.compare(dy, zero) > 0, CODE.PROFILE,
    'Positive exact rectangle spans required');
  const derivedWeight = q.mul(q.mul(q.mul(q.integer(4), q.from(distance)), dx), dy);
  check(q.compare(derivedWeight, q.from(1e-6)) >= 0 && q.compare(derivedWeight, q.from(1e6)) <= 0,
    CODE.REPRESENTABILITY, 'Actual unchanged derived section weight is outside native range');
  const top = extrusion.shell.assets[1];
  check(top !== undefined && top.face.geometry.objects.length === 5, CODE.PARENT,
    'Complete actual original top Model5 required');
  const roofIndex = top.face.geometry.objects.findIndex(object =>
    object.id === top.face.topology.face.surfaceId && object.kind === 'surface');
  check(roofIndex >= 0, CODE.PARENT, 'Actual top Surface is absent from its complete source Model');
  const roofSurface = top.face.geometry.objects[roofIndex] as Surface;
  check(roofSurface.controlPoints.every(row => row.every(point =>
    Object.is(point[2], distance))), CODE.BINDING, 'Actual unchanged roof height differs from distance');
  const roofAsset: MultiSpanVLinearSurfacePlaneSectionAsset = {
    sourceId: top.sourceId, source: top.source, surface: roofSurface,
  };
  const reservedIds = reserveInventory(options, extrusion);
  const supports: Support[] = [];
  const staged: Record<string, unknown> = {};
  const prefixGuard = (): void => {
    const retained = { request, supports, staged, reservedIds, directCounts: counts };
    ownData(retained, false, false); fileSize(retained, RESULT_LIMIT);
  };
  const produce = <T>(field: keyof Counts, code: RectangularFaceExtrusionBodyDiagnosticCode,
    label: string, action: () => T): T => {
    prefixGuard();
    check(counts.newProducerCallCount < 13, CODE.BUDGET, 'New producer budget exhausted');
    counts[field]++; counts.newProducerCallCount++; counts.totalDelegationCount++;
    const result = delegated(action, code, label);
    staged[label] = result;
    prefixGuard();
    return result;
  };
  prefixGuard();
  for (const [index, ids] of [options.lowerSupport, options.upperSupport].entries()) {
    const bottomPoints: [Point, Point] = index === 0
      ? [a.slice() as Point, b.slice() as Point] : [d.slice() as Point, c.slice() as Point];
    const extendedPoints = bottomPoints.map(point => [point[0], point[1], extension] as Point) as [Point, Point];
    const bottom = line(ids.bottomCurveId, bottomPoints), extended = line(ids.extendedCurveId, extendedPoints);
    const ruled = produce('ruledBuildCount', CODE.RULED, index === 0 ? 'lowerRuled' : 'upperRuled',
      () => buildCompatibleRuledSurface(bottom, extended, { surfaceId: ids.surfaceId }));
    check(ruled.surface.id === ids.surfaceId && ruled.model.name === ids.surfaceId &&
      same(ruled.first, bottom) && same(ruled.second, extended), CODE.BINDING,
    'Actual ruled Source/Model/Curve identity or input coefficients changed');
    supports.push({ role: index === 0 ? 'lower' : 'upper', sourceId: ids.sourceId,
      inputCurves: [bottom, extended], ruled });
    prefixGuard();
  }
  check(supports.length === 2, CODE.BINDING, 'Two complete actual supports required');
  const supportTuple: [Support, Support] = [supports[0], supports[1]];
  const lowerAsset: MultiSpanVLinearSurfacePlaneSectionAsset = {
    sourceId: supportTuple[0].sourceId, source: supportTuple[0].ruled.source,
    surface: supportTuple[0].ruled.surface,
  };
  const upperAsset: MultiSpanVLinearSurfacePlaneSectionAsset = {
    sourceId: supportTuple[1].sourceId, source: supportTuple[1].ruled.source,
    surface: supportTuple[1].ruled.surface,
  };
  const r = options.recipe;
  const lowerSection = produce('sectionBuildCount', CODE.SECTION, 'lowerSection',
    () => buildMultiSpanVLinearSurfacePlaneSection(lowerAsset, roofAsset, r.lowerSection));
  const upperSection = produce('sectionBuildCount', CODE.SECTION, 'upperSection',
    () => buildMultiSpanVLinearSurfacePlaneSection(upperAsset, roofAsset, r.upperSection));
  for (const section of [lowerSection, upperSection]) {
    check(section.world.curve.weights.every(weight => q.compare(q.from(weight), derivedWeight) === 0) &&
      section.pcurves.plane.curve.weights.every(weight => q.compare(q.from(weight), derivedWeight) === 0),
    CODE.BINDING, 'Actual stored derived section weights differ from exact4D*DX*DY');
  }
  const lowerBinding = produce('bindingBuildCount', CODE.BINDING, 'lowerBinding',
    () => buildSectionExactSurfaceBinding(lowerSection, r.lowerBinding));
  const upperBinding = produce('bindingBuildCount', CODE.BINDING, 'upperBinding',
    () => buildSectionExactSurfaceBinding(upperSection, r.upperBinding));
  const half = q.div(q.integer(1), two);
  for (const binding of [lowerBinding, upperBinding]) {
    check(binding.pcurve.curve.degree === 2 && binding.pcurve.curve.controlPoints.every(point =>
      q.compare(q.from(point[1]), half) === 0), CODE.BINDING,
    'Actual stored roof UV must equal one-half throughout its complete controls');
  }
  const lowerWall = produce('wallBuildCount', CODE.CONSTRUCTION, 'lowerWall',
    () => buildExactSurfaceLowerTrim(lowerBinding, r.lowerWall));
  const upperWall = produce('wallBuildCount', CODE.CONSTRUCTION, 'upperWall',
    () => buildExactSurfaceLowerTrim(upperBinding, r.upperWall));
  const cap = produce('capBuildCount', CODE.CAP, 'cap',
    () => buildPairedSectionPlaneCap(lowerSection, upperSection, r.cap));
  const base = produce('baseBuildCount', CODE.CONSTRUCTION, 'base',
    () => buildTranslatedSurfaceBaseFace(lowerWall, upperWall, r.base));
  const ends = produce('endBuildCount', CODE.CONSTRUCTION, 'ends',
    () => buildTranslatedSurfaceEndFaces(lowerWall, upperWall, cap, r.ends));
  const volume = produce('volumeBuildCount', CODE.CONSTRUCTION, 'volume',
    () => measureTranslatedSurfaceStripVolume(lowerWall, upperWall, cap, r.volume));
  const body = produce('qualifiedBodyBuildCount', CODE.MATERIAL, 'body',
    () => buildQualifiedTranslatedStripBody(base, ends, volume, r.body));
  // All prior construction receipts survive within the complete actual Body.
  for (const key of Object.keys(staged)) delete staged[key];
  staged.body = body;
  prefixGuard();
  const proof = delegated(() => proveRectangularExtrusionBodyCorrespondenceTrusted(
    extrusion, supportTuple, body, q), CODE.MATERIAL, 'Whole cube-skin material correspondence refused');
  staged.proof = proof;
  check(proof.exactOccupiedRegionEqual && proof.parentFlagsUnchanged &&
    proof.faces.length === 6 && proof.edges.length === 12 && proof.vertices.length === 8 &&
    body.body.solid && body.body.restrictedSolidCertified &&
    body.vertices.length === 8 && body.edges.length === 12 && body.faces.length === 6,
  CODE.MATERIAL, 'Complete new restricted Body and whole material correspondence required');
  check(q.counts().floatConversions === 0, CODE.BINDING, 'Root rational Float conversions must remain zero');
  const bindings: Bindings = {
    parent: { evaluationId: extrusion.report.evaluationId, faceId: parentFace.topology.face.id,
      shellId: extrusion.shell.options.shellId, assetAuthority: 'request.extrusion.shell.assets' },
    roof: { sourceField: 'request.extrusion.shell.assets[1].source',
      modelField: 'request.extrusion.shell.assets[1].face.geometry', sourceId: top.sourceId,
      modelName: top.face.geometry.name, objectIndex: roofIndex,
      objectId: roofSurface.id, assetIndex: 1, surfaceId: roofSurface.id },
    supports: supportTuple.map((support, index) => ({
      role: support.role, sourceField: 'supports[' + index + '].ruled.source',
      modelField: 'supports[' + index + '].ruled.model', sourceId: support.sourceId,
      modelName: support.ruled.model.name,
      objectIndex: support.ruled.model.objects.findIndex(object => object.id === support.ruled.surface.id),
      objectId: support.ruled.surface.id, surfaceId: support.ruled.surface.id,
    })) as Bindings['supports'],
    material: { bodyId: body.body.id, shellId: body.shell.id,
      certificateId: body.body.materialCertificateId,
      modelNames: [body.models[0].model.name, body.models[1].model.name],
      sourceIds: [body.models[0].sourceId, body.models[1].sourceId] },
    sourceAuthority: 'full-parent-top-asset-two-new-ruled-sources-and-full-qualified-body', reservedIds,
  };
  staged.bindings = bindings;
  prefixGuard();
  check(counts.parentValidationCount === 1 && counts.ruledBuildCount === 2 &&
    counts.sectionBuildCount === 2 && counts.bindingBuildCount === 2 && counts.wallBuildCount === 2 &&
    counts.capBuildCount === 1 && counts.baseBuildCount === 1 && counts.endBuildCount === 1 &&
    counts.volumeBuildCount === 1 && counts.qualifiedBodyBuildCount === 1 &&
    counts.newProducerCallCount === 13 && counts.totalDelegationCount === 14,
  CODE.BINDING, 'Actual accepted direct delegation counts disagree');
  const report: RectangularFaceExtrusionBodyReport = {
    schema: 'barocss-rectangular-face-extrusion-body', version: 0,
    evaluationId: options.evaluationId, parentEvaluationId: extrusion.report.evaluationId,
    parentShellId: extrusion.shell.options.shellId, bodyId: body.body.id, shellId: body.shell.id,
    materialCertificateId: body.body.materialCertificateId,
    profile: 'forward-unit-chart-xy-rectangle-positive-z-canonical-overshoot',
    distanceMM: distance, supportHeightMM: extension, lengthUnit: 'mm', volumeUnit: 'mm3',
    exactVolumeMM3: body.report.exactVolumeMM3, volumeMM3: body.report.volumeMM3,
    conversionError: body.report.conversionError,
    vertexCount: 8, edgeCount: 12, faceCount: 6, useCount: 24,
    modelCount: 2, geometryObjectCount: 18,
    wholeFaceCorrespondenceCount: 6, wholeEdgeCorrespondenceCount: 12, vertexCorrespondenceCount: 8,
    directCounts: counts as RectangularFaceExtrusionBodyReport['directCounts'], rationalCounts: q.counts(),
    quality: { freshRestrictedSolid: true, sourceDefinedOccupiedRegion: true,
      wholeBoundaryImage: true, outwardMaterial: true, exactExtrusionRegionCorrespondence: true,
      parentFlagsUnchanged: true, parentShellPromoted: false, genericExtrusionSolid: false,
      genericBoolean: false, generalCurvedSolid: false, globalBinary64ErrorCertified: false,
      manufacturingToleranceCertified: false, welding: false, publication: false,
      ownership: 'independent-copied-cpu-data-gc' },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, ownValues: 0, limits: limits(),
    workScope: 'one-full-parent-validation-thirteen-new-producers-and-root-correspondence-arithmetic',
    budgetFailure: 'atomic-no-partial-material-qualification',
  };
  const result: RectangularFaceExtrusionBodyResult = { request, supports: supportTuple,
    body, bindings, proof, report };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const ownValues = ownData(result, false, false).count;
    const size = fileSize(result, RESULT_LIMIT);
    if (report.ownValues === ownValues && same(report.fileSizes.result, size)) { settled = true; break; }
    report.ownValues = ownValues; report.fileSizes.result = size;
  }
  check(settled && report.ownValues === ownData(result, false, false).count &&
    same(report.fileSizes.result, fileSize(result, RESULT_LIMIT)), CODE.FILE,
  'Whole result file/own measurement failed to settle in8 passes');
  return ownData(result).value as RectangularFaceExtrusionBodyResult;
}

/** Rebuild the complete qualification once; return only a fully independent Report. */
export function validateRectangularFaceExtrusionBody(input: RectangularFaceExtrusionBodyResult):
  RectangularFaceExtrusionBodyReport {
  try {
    const value = ownData(input, true).value as RectangularFaceExtrusionBodyResult;
    const data = record(value, ['request', 'supports', 'body', 'bindings', 'proof', 'report']);
    fileSize(value, RESULT_LIMIT);
    const expected = qualifyRectangularFaceExtrusionBody(data.request as RectangularFaceExtrusionBodyRequest);
    check(same(value, expected), CODE.OWNED, 'Complete qualification differs from independent reconstruction');
    return ownData(expected.report, true).value as RectangularFaceExtrusionBodyReport;
  } catch (cause) {
    if (cause instanceof RectangularFaceExtrusionBodyError && cause.code === CODE.OWNED) throw cause;
    throw new RectangularFaceExtrusionBodyError(CODE.OWNED, 'Whole ownership reconstruction refused', cause);
  }
}
