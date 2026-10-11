import { compileCadModel } from './model-compiler.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionRational } from './section-rational-internal.js';
import { validateQualifiedTranslatedStripBody, buildQualifiedTranslatedStripBody } from './qualified-translated-strip-body.js';
import { buildMultiSpanVLinearSurfacePlaneSection } from './multispan-vlinear-plane-section.js';
import { buildSectionExactSurfaceBinding } from './section-exact-surface-binding.js';
import { buildExactSurfaceLowerTrim } from './exact-surface-lower-trim.js';
import { buildPairedSectionPlaneCap } from './paired-section-plane-cap.js';
import { buildTranslatedSurfaceBaseFace } from './translated-surface-base-face.js';
import { buildTranslatedSurfaceEndFaces } from './translated-surface-end-faces.js';
import { measureTranslatedSurfaceStripVolume } from './translated-surface-strip-volume.js';
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from './cad-document.js';

import type { Model, Point, Curve, Surface } from './types.js';
import type { SectionFraction } from './section-rational-internal.js';
import type { QualifiedTranslatedStripBodyResult,QualifiedTranslatedStripBodyOptions }
  from './qualified-translated-strip-body.js';
import type { MultiSpanVLinearSurfacePlaneSectionAsset,MultiSpanVLinearSurfacePlaneSectionOptions }
  from './multispan-vlinear-plane-section.js';
import type { SectionExactSurfaceBindingOptions } from './section-exact-surface-binding.js';
import type { ExactSurfaceLowerTrimOptions } from './exact-surface-lower-trim.js';
import type { PairedSectionPlaneCapOptions } from './paired-section-plane-cap.js';
import type { TranslatedSurfaceBaseFaceOptions } from './translated-surface-base-face.js';
import type { TranslatedSurfaceEndFacesOptions } from './translated-surface-end-faces.js';
import type { TranslatedSurfaceStripVolumeOptions } from './translated-surface-strip-volume.js';

type Two<T> = [T,T];
type Size = {utf16:number;utf8:number};
type Side = 'below-y'|'above-y';
type Recipe = { // exact11, every actual provider option record is retained
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
export interface TranslatedStripPlaneSplitOptions { // exact4
  evaluationId:string;
  maximumOutputBodies:2;
  maximumProducerDelegations:22;
  outputRecipes:Two<Recipe>;
}
export interface TranslatedStripPlaneSplitRequest { // exact3, complete authority
  body:QualifiedTranslatedStripBodyResult;
  cutAsset:MultiSpanVLinearSurfacePlaneSectionAsset; // sourceId/source/actualSurface
  options:TranslatedStripPlaneSplitOptions;
}
type SourceRef = {
  sourceField:'request.body'|'request.cutAsset.source'|'outputs.body.models.source';
  componentIndex:0|1|null;
  sourceId:string;modelName:string;objectIndex:number;objectId:string;
};
type FaceRef = {componentIndex:0|1|null;bodyId:string;faceId:string;surfaceId:string;
  role:QualifiedTranslatedStripBodyResult['faces'][number]['role'];support:SourceRef};
type EdgeRef = {componentIndex:0|1|null;bodyId:string;edgeId:string;curveId:string;
  role:QualifiedTranslatedStripBodyResult['edges'][number]['role'];curve:SourceRef};
type VertexRef = {componentIndex:0|1|null;bodyId:string;vertexId:string;world:Point};
type Interval = {lowerY:SectionFraction;upperY:SectionFraction;width:SectionFraction};
type CutProof = {
  selectedObjectIndex:number;
  source:SourceRef;
  lowerSource:SourceRef;upperSource:SourceRef;roofSource:SourceRef;
  domains:{u:[number,number];v:[number,number]};
  degrees:[1,1];knotsU:number[];knotsV:number[];unitWeight:SectionFraction;
  yLower:SectionFraction;yCut:SectionFraction;yUpper:SectionFraction;
  lowerYResiduals:SectionFraction[][];cutYResiduals:SectionFraction[][];upperYResiduals:SectionFraction[][];
  cutToLowerDifferences:SectionFraction[][][];cutToUpperDifferences:SectionFraction[][][];
  xzBitsEqual:true;basisWeightBitsEqual:true;
  plane:{origin:SectionFraction[];uDirection:SectionFraction[];vDirection:SectionFraction[];
    rawNormal:SectionFraction[];d:SectionFraction;fourthCornerResiduals:SectionFraction[];
    equation:'Y-yCut=0';nativeNormalYSign:-1;strictPositiveXZ:true};
};
type Proof = {
  cut:CutProof;
  intervals:{original:Interval;outputs:Two<Interval>;
    sharedEndpointResidual:SectionFraction;
    originalWidthResidual:SectionFraction;
    disjointOpenInteriors:true;closedUnionEqualsInput:true;
    commonMap:'S_originalLower(u,v)+[0,translationY,0]';
    materialSemantics:'partition-of-one-occupied-region-no-removed-slab'};
  outputMaterial:{index:0|1;bodyId:string;materialCertificateId:string;
    originalMaterialCertificateId:string;lowerSourceId:string;upperSourceId:string;roofSourceId:string;
    unchangedSourceDomainRoof:true;sourceDefinedOccupiedRegion:true;wholeBoundaryImage:true;
    embeddedClosedBoundary:true;outwardMaterial:true;restrictedSolidCertified:true}[];
  volume:{areaFactorMM2:SectionFraction;originalExactVolumeMM3:SectionFraction;
    expectedOutputExactVolumeMM3:Two<SectionFraction>;actualOutputExactVolumeMM3:Two<SectionFraction>;
    outputResiduals:Two<SectionFraction>;sumExactVolumeMM3:SectionFraction;conservationResidual:SectionFraction};
  generatedIds:string[]; // only actual fresh roles, aliases listed once
};
type Bindings = {
  original:{bodyId:string;shellId:string;materialCertificateId:string};
  cut:{source:SourceRef;surfaceId:string;first:FaceRef;second:FaceRef;
    originalCutSurfaceBitsEqual:true;wholeNativePatchImageEqual:true;
    effectiveOrientations:['reverse','forward'];outwardNormalYSigns:[1,-1];
    boundaryMaps:{first:EdgeRef;second:EdgeRef;parameterScale:SectionFraction;
      parameterOffset:SectionFraction;coefficientResiduals:SectionFraction[][];
      oppositeEffectiveUses:true}[]}; // four complete cut-boundary maps, actual IDs differ
  faceLineage:{original:FaceRef;outputs:FaceRef[];
    semantics:'same-whole-face-image'|'partition-of-original-face-image';
    translationIntervals:Interval[];materialMapResiduals:SectionFraction[][]}[];
  edgeLineage:{original:EdgeRef;outputs:{edge:EdgeRef;nativeParameterScale:SectionFraction;
    nativeParameterOffset:SectionFraction;coefficientResiduals:SectionFraction[][]}[];
    semantics:'same-whole-edge-image'|'partition-of-original-edge-image'}[];
  vertexLineage:{original:VertexRef;output:VertexRef;pointBitsEqual:true}[];
  directionConvention:'parent-stored-use-order-already-includes-face-orientation';
  namingAuthority:'explicit-source-qualified-operation-lineage-no-generic-persistent-matching';
};
type Output = { // exact4
  index:0|1;side:Side;recipe:Recipe;body:QualifiedTranslatedStripBodyResult;
};
type DirectCounts = {
  originalBodyValidationCount:number; // success1
  cutSourceCompilationCount:number; // success1
  outputBodyConstructionCount:number; // completed success2
  sectionBuildCount:number;bindingBuildCount:number;wallBuildCount:number;
  capBuildCount:number;baseBuildCount:number;endBuildCount:number;
  volumeBuildCount:number;qualifiedBodyBuildCount:number;
  producerDelegationCount:number; // success22, increment before actual calls
  totalDirectDelegationCount:number; // success24
  curvePointEvaluationCount:0;curveDerivativeEvaluationCount:0;
  surfacePointEvaluationCount:0;surfaceDerivativeEvaluationCount:0;
  cutSurfaceValidationCount:0;cutSurfaceDomainCallCount:0;
  floatConversionCount:0;nativeRootCount:0;booleanCallCount:0;sourceWriterCallCount:0;
};
export const TranslatedStripPlaneSplitDiagnosticCode = Object.freeze({
  INPUT:'INPUT',IDENTITY:'IDENTITY',BUDGET:'BUDGET',PARENT:'PARENT',SOURCE:'SOURCE',
  REFERENCE:'REFERENCE',SUPPORT:'SUPPORT',CUT:'CUT',PARTITION:'PARTITION',ORIENTATION:'ORIENTATION',
  REPRESENTABILITY:'REPRESENTABILITY',BINDING:'BINDING',CONSTRUCTION:'CONSTRUCTION',
  VOLUME:'VOLUME',FILE:'FILE',CODEC:'CODEC',OWNED:'OWNED',
} as const);
type DiagnosticCode = typeof TranslatedStripPlaneSplitDiagnosticCode[keyof typeof TranslatedStripPlaneSplitDiagnosticCode];
type Context = {stage:'input'|'parent'|'cut-source'|'cut-binding'|'partition'|'identity'|
  'section'|'binding'|'wall'|'cap'|'base'|'ends'|'volume'|'body'|'lineage'|'file'|'codec'|'owned';
  componentIndex:0|1|null;directCounts:DirectCounts;
  codecCounts:{ownedSplitValidationCount:number;originalBodyReconstructionCount:number;
    originalProducerDelegationCount:number;splitConstructionCount:number}};
export class TranslatedStripPlaneSplitError extends Error {
  readonly code: DiagnosticCode;
  readonly context: Context;
  constructor(code: DiagnosticCode, detail: string, context: Context, cause?: unknown) {
    super(('Translated strip Plane Split: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'TranslatedStripPlaneSplitError';
    this.code = code;
    this.context = { ...context, directCounts: { ...context.directCounts }, codecCounts: { ...context.codecCounts } };
  }
}
export interface TranslatedStripPlaneSplitReport {
  schema:'barocss-translated-strip-plane-split';version:0;evaluationId:string;
  lengthUnit:'mm';volumeUnit:'mm3';sourceFrame:'authored-xyz-no-axis-conversion';
  profile:'qualified-affine-xz-constant-y-side-supports-and-interior-y-plane';
  originalBodyId:string;originalMaterialCertificateId:string;cutSourceId:string;cutSurfaceId:string;
  cutModelName:string;selectedCutObjectIndex:number;outputBodyIds:Two<string>;
  outputMaterialCertificateIds:Two<string>;inputBodyCount:1;outputBodyCount:2;
  exactVolumeMM3:SectionFraction;outputExactVolumesMM3:Two<SectionFraction>;
  conservationResidual:SectionFraction;
  yInterval:Interval;outputYIntervals:Two<Interval>;
  directCounts:DirectCounts;
  rationalCounts:ReturnType<import('./section-rational-internal.js').SectionRationalContext['counts']>;
  outputCounts:Two<{vertexCount:8;edgeCount:12;faceCount:6;useCount:24;loopCount:6;
    vertexLinkCount:8;cornerArcCount:24;modelCount:2;geometryObjectCount:18;
    shellCount:1;bodyCount:1}>;
  lineageCounts:{originalFaces:6;originalEdges:12;originalVertices:8;
    unchangedFaceImages:2;partitionedFaceImages:4;unchangedEdgeImages:8;partitionedEdgeImages:4;
    commonCutFaces:2;commonCutBoundaryPairs:4};
  sourceSizes:{cut:Size}; // all original/child source receipts retained, no fictional recompile
  fileSizes:{request:Size;result:Size};
  numericPolicy:{authority:'exact-represented-original-and-cut-source-material-map';
    cutSelection:'unchanged-original-caller-plane-surface-not-computed-endpoint';
    semantics:'conserved-closed-interval-partition-not-finite-width-subtraction';
    commonRoof:'same-full-original-plane-and-stored-native-roof';
    volume:'exact-area-factor-times-positive-y-width';
    lineage:'explicit-qualified-source-and-complete-coefficient-parameter-maps';
    orientation:'cut-upper-reverse-and-cut-lower-forward-parent-uses-once';
    rootNativeSampling:false;rootFloatConversion:false;weldingPerformed:false;
    sourceIdentityRenaming:false;coefficientGeneration:false;toleranceUsed:false};
  quality:{restrictedSplitCertified:true;inputMaterialConserved:true;disjointOutputInteriors:true;
    closedOutputUnionEqualsInput:true;actualOutputBodiesQualified:true;commonCutImageCertified:true;
    oppositeCutOutwardOrientations:true;originalBodySourcesAndSiblingsPreserved:true;
    fullParentProofsUnchanged:true;genericSplitBody:false;arbitraryPlaneCut:false;
    arbitraryCurvedSolid:false;globalC1:false;globalBinary64ErrorCertified:false;
    manufacturingToleranceCertified:false;genericPersistentNaming:false;editorAccepted:false;
    publication:false;ownedRebuild:true;ownership:'independent-copied-cpu-data-gc'};
  limits:{maximumInputBodies:1;maximumCutAssets:1;maximumOutputBodies:2;
    maximumProducerDelegations:22;maximumOutputModels:4;maximumOutputGeometryObjects:36;
    selectedDegreeU:1;selectedDegreeV:1;selectedAxisPoles:2;maximumOriginalSpans:1;unitWeight:1;
    maximumObjectsPerModel:16;maximumBodyUTF16:2097152;maximumBodyUTF8:2097152;
    sourceUTF16:262144;sourceUTF8:262144;identityCharacters:48;
    maximumRequestUTF16:6291456;maximumRequestUTF8:6291456;
    maximumResultUTF16:12582912;maximumResultUTF8:12582912;
    ownValues:4194304;ownDepth:64;arrayElements:8192;recordFields:64;keyCharacters:128;stringCharacters:262144;
    rationalOperations:200000;gcdSteps:200000;rationalIntegerBits:8192;fractionIntegerCharacters:5000;
    rootNativeCalls:0;rootFloatConversions:0;maximumAuthoredUTF16:2097152;maximumAuthoredUTF8:2097152;
    authoredParserDepth:12;authoredParserValues:65536;
    authoredParserRecordFields:16;authoredParserStringCharacters:262144};
  workScope:'one-body-validation-one-cut-compile-and-actual-twenty-two-producer-calls-child-work-retained-separately';
  budgetFailure:'atomic-no-partial-accepted-split-bodies-or-authored-update';
}
export interface TranslatedStripPlaneSplitResult { // exact6
  request:TranslatedStripPlaneSplitRequest;
  cutModel:Model;
  proof:Proof;
  outputs:Two<Output>;
  bindings:Bindings;
  report:TranslatedStripPlaneSplitReport;
}
// splitTranslatedStripBodyByPlane(request):TranslatedStripPlaneSplitResult
// validateTranslatedStripPlaneSplit(owned:unknown):TranslatedStripPlaneSplitReport
// serializeTranslatedStripPlaneSplit(result:TranslatedStripPlaneSplitResult):string
// parseTranslatedStripPlaneSplit(text:string):TranslatedStripPlaneSplitResult

type AuthoredSplitV0 = { // exact6, PRIVATE authored type, all records<16 fields
  schema:'barocss-authored-translated-strip-plane-split';version:0;
  original:{assets:[MultiSpanVLinearSurfacePlaneSectionAsset,MultiSpanVLinearSurfacePlaneSectionAsset,
    MultiSpanVLinearSurfacePlaneSectionAsset];recipe:Recipe}; // lower,upper,ROOF
  cutAsset:MultiSpanVLinearSurfacePlaneSectionAsset;
  outputRecipes:Two<Recipe>;
  options:{evaluationId:string;maximumOutputBodies:2;maximumProducerDelegations:22};
};


const CODE = TranslatedStripPlaneSplitDiagnosticCode;
function counts(): DirectCounts {
  return { originalBodyValidationCount: 0, cutSourceCompilationCount: 0, outputBodyConstructionCount: 0,
    sectionBuildCount: 0, bindingBuildCount: 0, wallBuildCount: 0, capBuildCount: 0,
    baseBuildCount: 0, endBuildCount: 0, volumeBuildCount: 0, qualifiedBodyBuildCount: 0,
    producerDelegationCount: 0, totalDirectDelegationCount: 0,
    curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0, surfacePointEvaluationCount: 0,
    surfaceDerivativeEvaluationCount: 0, cutSurfaceValidationCount: 0, cutSurfaceDomainCallCount: 0,
    floatConversionCount: 0, nativeRootCount: 0, booleanCallCount: 0, sourceWriterCallCount: 0 };
}
function context(): Context {
  return { stage: 'input', componentIndex: null, directCounts: counts(), codecCounts: {
    ownedSplitValidationCount: 0, originalBodyReconstructionCount: 0,
    originalProducerDelegationCount: 0, splitConstructionCount: 0 } };
}
function fail(state: Context, code: DiagnosticCode, detail: string, cause?: unknown): never {
  throw new TranslatedStripPlaneSplitError(code, detail, state, cause);
}
function check(state: Context, value: boolean, code: DiagnosticCode, detail: string): asserts value {
  if (!value) fail(state, code, detail);
}
function native<T>(state: Context, action: () => T, code: DiagnosticCode, detail: string): T {
  try { return action(); }
  catch (cause) { if (cause instanceof TranslatedStripPlaneSplitError) throw cause; fail(state, code, detail, cause); }
}
function record(state: Context, value: unknown, fields: string[], code: DiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(state, value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(state, Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), code,
    'Exact own record fields are required');
  return data;
}
function snapshot(state: Context, input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT, budget = owned ? CODE.OWNED : CODE.BUDGET;
  let remaining = 4194304;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(state, --remaining >= 0 && depth <= 64, budget, 'Own value or depth cap exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(state, Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(state, value.length <= 262144, budget, 'Own source string cap exceeded'); return value; }
    check(state, typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(state, array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'Plain own-data prototypes are required');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(state, keys.length <= (array ? 8193 : 64), budget, 'Own field cap exceeded');
    check(state, keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] &&
      (array && key === 'length' || descriptors[key].enumerable)), code, 'Getters, symbols and hidden fields are refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(state, Number.isInteger(length) && length >= 0 && length <= 8192, budget, 'Own array element cap exceeded');
      check(state, keys.length === length + 1, code, 'Dense arrays without extra fields are required');
      result = Array.from({ length }, (_, index) => {
        check(state, Object.hasOwn(descriptors, String(index)), code, 'Sparse arrays are refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value);
    return result;
  };
  return copy(input, 0);
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key]));
  }
  return Object.is(a, b);
}
function id(state: Context, value: unknown, maximum = 48): asserts value is string {
  check(state, typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'A bounded supported ASCII identity is required');
}
function sourceSize(state: Context, text: string): Size {
  const size = { utf16: text.length, utf8: new TextEncoder().encode(text).length };
  check(state, size.utf16 <= 262144 && size.utf8 <= 262144, CODE.BUDGET, 'Complete source exceeds262144 UTF16 or UTF8 units');
  return size;
}
function json(state: Context, input: unknown, limit: number, retain = false): { size: Size; text: string } {
  let utf16 = 0, utf8 = 0;
  const parts: string[] = [], encoder = new TextEncoder();
  const append = (text: string): void => {
    utf16 += text.length; utf8 += encoder.encode(text).length;
    check(state, utf16 <= limit && utf8 <= limit, CODE.FILE, 'Complete JSON exceeds its UTF16 or UTF8 envelope');
    if (retain) parts.push(text);
  };
  const visit = (value: unknown): void => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') append(JSON.stringify(value));
    else if (typeof value === 'number') { check(state, Number.isFinite(value), CODE.FILE, 'Finite JSON numbers are required'); append(Object.is(value, -0) ? '-0' : String(value)); }
    else if (Array.isArray(value)) { append('['); value.forEach((item, index) => { if (index) append(','); visit(item); }); append(']'); }
    else {
      check(state, value !== null && typeof value === 'object', CODE.FILE, 'Complete own JSON data is required');
      append('{'); Object.entries(value).forEach(([key, item], index) => { if (index) append(','); append(JSON.stringify(key)); append(':'); visit(item); }); append('}');
    }
  };
  visit(input); append('\n');
  return { size: { utf16, utf8 }, text: retain ? parts.join('') : '' };
}
function contexts(input: unknown): Set<string> {
  const found = new Set<string>();
  const visit = (value: unknown, key = ''): void => {
    if (typeof value === 'string') { if (key === 'id' || key === 'name' || /Ids?$/.test(key)) found.add(value); return; }
    if (Array.isArray(value)) { value.forEach(item => visit(item, key)); return; }
    if (value !== null && typeof value === 'object') for (const [field, item] of Object.entries(value)) visit(item, field);
  };
  visit(input);
  return found;
}
const RECIPE_FIELDS = ['lowerSection', 'upperSection', 'lowerBinding', 'upperBinding', 'lowerWall', 'upperWall',
  'cap', 'base', 'ends', 'volume', 'body'];
function admitRecipe(state: Context, value: unknown): Recipe {
  const r = record(state, value, RECIPE_FIELDS) as unknown as Recipe;
  for (const section of [r.lowerSection, r.upperSection]) {
    record(state, section, ['evaluationId', 'curveId', 'surfacePcurveId', 'planePcurveId', 'maximumObservations']);
    check(state, section.maximumObservations === 17, CODE.BUDGET, 'Section observation budget17 is required');
  }
  for (const binding of [r.lowerBinding, r.upperBinding]) {
    record(state, binding, ['evaluationId', 'pcurveId', 'maximumObservations']);
    check(state, binding.maximumObservations === 17, CODE.BUDGET, 'Binding observation budget17 is required');
  }
  for (const wall of [r.lowerWall, r.upperWall]) {
    record(state, wall, ['evaluationId', 'resultIdPrefix', 'orientation', 'maximumObservations']);
    id(state, wall.resultIdPrefix, 12);
    check(state, wall.maximumObservations === 40, CODE.BUDGET, 'Wall observation budget40 is required');
  }
  check(state, r.lowerWall.orientation === 'forward' && r.upperWall.orientation === 'reverse', CODE.ORIENTATION,
    'Canonical lower-forward and upper-reverse wall intent is required');
  record(state, r.cap, ['evaluationId', 'resultIdPrefix', 'maximumSections', 'maximumConnectors', 'maximumObservations']);
  check(state, r.cap.maximumSections === 2 && r.cap.maximumConnectors === 2 && r.cap.maximumObservations === 40,
    CODE.BUDGET, 'Complete cap budgets2/2/40 are required');
  record(state, r.base, ['evaluationId', 'resultIdPrefix', 'baseLeftCurveId', 'baseRightCurveId', 'maximumParents', 'maximumObservations']);
  record(state, r.ends, ['evaluationId', 'resultIdPrefix', 'baseLeftCurveId', 'baseRightCurveId', 'maximumParents', 'maximumObservations']);
  check(state, r.base.maximumParents === 2 && r.base.maximumObservations === 40 && r.ends.maximumParents === 3 &&
    r.ends.maximumObservations === 24, CODE.BUDGET, 'Unchanged base2/40 and ends3/24 budgets are required');
  check(state, r.base.baseLeftCurveId === r.ends.baseLeftCurveId && r.base.baseRightCurveId === r.ends.baseRightCurveId,
    CODE.IDENTITY, 'Base and ends must share their explicit actual Line IDs within each component');
  record(state, r.volume, ['evaluationId', 'maximumParents', 'maximumObservations']);
  check(state, r.volume.maximumParents === 3 && r.volume.maximumObservations === 17, CODE.BUDGET, 'Volume budgets3/17 are required');
  record(state, r.body, ['evaluationId', 'resultIdPrefix', 'maximumParents', 'maximumModels', 'maximumObservations']);
  check(state, r.body.maximumParents === 3 && r.body.maximumModels === 2 && r.body.maximumObservations === 24,
    CODE.BUDGET, 'Body budgets3/2/24 are required');
  for (const item of [r.cap, r.base, r.ends, r.body]) id(state, item.resultIdPrefix, 12);
  recipeIds(r).forEach(value => id(state, value));
  return r;
}
function recipeIds(r:Recipe):string[] {
 const result:string[]=[],push=(value:string)=>result.push(value),group=(prefix:string,suffixes:string[])=>suffixes.forEach(suffix=>push(prefix+'_'+suffix)),range=(prefix:string,tag:string,n:number)=>{for(let i=0;i<n;i++)push(prefix+'_'+tag+i)};
 for(const section of [r.lowerSection,r.upperSection]){push(section.evaluationId);push(section.curveId);push(section.surfacePcurveId);push(section.planePcurveId)}for(const binding of [r.lowerBinding,r.upperBinding]){push(binding.evaluationId);push(binding.pcurveId)}
 for(const wall of [r.lowerWall,r.upperWall]){push(wall.evaluationId);group(wall.resultIdPrefix,['bottom','right','left','bottom_uv','right_uv','left_uv']);for(const tag of ['v','e','use'])range(wall.resultIdPrefix,tag,4);group(wall.resultIdPrefix,['loop','face'])}
 push(r.cap.evaluationId);group(r.cap.resultIdPrefix,['right','left','right_uv','left_uv']);for(const tag of ['v','e','use'])range(r.cap.resultIdPrefix,tag,4);group(r.cap.resultIdPrefix,['loop','face']);
 push(r.base.evaluationId);push(r.base.baseLeftCurveId);push(r.base.baseRightCurveId);group(r.base.resultIdPrefix,['surface']);for(const tag of ['uv','v','e','use'])range(r.base.resultIdPrefix,tag,4);group(r.base.resultIdPrefix,['loop','face']);
 push(r.ends.evaluationId);for(const tag of ['s','f','l'])range(r.ends.resultIdPrefix,tag,2);for(let i=0;i<2;i++)for(const tag of ['v','e','use','uv'])range(r.ends.resultIdPrefix+'_f'+i,tag,4);
 push(r.volume.evaluationId);push(r.body.evaluationId);for(const [tag,n]of [['v',8],['e',12],['f',6],['l',6],['use',24]] as const)range(r.body.resultIdPrefix,tag,n);group(r.body.resultIdPrefix,['shell','body','body_material','m0','m1','source0','source1']);return result;
}

type ProducerKey = 'sectionBuildCount'|'bindingBuildCount'|'wallBuildCount'|'capBuildCount'|
  'baseBuildCount'|'endBuildCount'|'volumeBuildCount'|'qualifiedBodyBuildCount';
function construct(state: Context, assets: [MultiSpanVLinearSurfacePlaneSectionAsset,
  MultiSpanVLinearSurfacePlaneSectionAsset, MultiSpanVLinearSurfacePlaneSectionAsset], r: Recipe,
  staged: unknown[], guard: () => void, codec = false): QualifiedTranslatedStripBodyResult {
  const call = <T>(stage: Context['stage'], key: ProducerKey, action: () => T): T => {
    state.stage = stage; guard();
    if (codec) state.codecCounts.originalProducerDelegationCount++;
    else {
      check(state, state.directCounts.producerDelegationCount < 22, CODE.BUDGET, 'The complete producer budget22 is exhausted');
      state.directCounts[key]++; state.directCounts.producerDelegationCount++; state.directCounts.totalDirectDelegationCount++;
    }
    const child = native(state, action, codec ? CODE.CODEC : CODE.CONSTRUCTION, 'Actual unchanged public ' + stage + ' construction refused');
    staged.push(child); guard();
    return child;
  };
  const lowerSection = call('section', 'sectionBuildCount', () => buildMultiSpanVLinearSurfacePlaneSection(assets[0], assets[2], r.lowerSection));
  const upperSection = call('section', 'sectionBuildCount', () => buildMultiSpanVLinearSurfacePlaneSection(assets[1], assets[2], r.upperSection));
  const lowerBinding = call('binding', 'bindingBuildCount', () => buildSectionExactSurfaceBinding(lowerSection, r.lowerBinding));
  const upperBinding = call('binding', 'bindingBuildCount', () => buildSectionExactSurfaceBinding(upperSection, r.upperBinding));
  const lowerWall = call('wall', 'wallBuildCount', () => buildExactSurfaceLowerTrim(lowerBinding, r.lowerWall));
  const upperWall = call('wall', 'wallBuildCount', () => buildExactSurfaceLowerTrim(upperBinding, r.upperWall));
  const cap = call('cap', 'capBuildCount', () => buildPairedSectionPlaneCap(lowerSection, upperSection, r.cap));
  const base = call('base', 'baseBuildCount', () => buildTranslatedSurfaceBaseFace(lowerWall, upperWall, r.base));
  const ends = call('ends', 'endBuildCount', () => buildTranslatedSurfaceEndFaces(lowerWall, upperWall, cap, r.ends));
  const volume = call('volume', 'volumeBuildCount', () => measureTranslatedSurfaceStripVolume(lowerWall, upperWall, cap, r.volume));
  return call('body', 'qualifiedBodyBuildCount', () => buildQualifiedTranslatedStripBody(base, ends, volume, r.body));
}
function originalRecipe(body: QualifiedTranslatedStripBodyResult): Recipe {
  const lower = body.base.lowerWall, upper = body.base.upperWall;
  return { lowerSection: lower.binding.section.options, upperSection: upper.binding.section.options,
    lowerBinding: lower.binding.options, upperBinding: upper.binding.options,
    lowerWall: lower.options, upperWall: upper.options, cap: body.ends.cap.options,
    base: body.base.options, ends: body.ends.options, volume: body.volume.options, body: body.options };
}
function originalAssets(body: QualifiedTranslatedStripBodyResult): [MultiSpanVLinearSurfacePlaneSectionAsset,
  MultiSpanVLinearSurfacePlaneSectionAsset, MultiSpanVLinearSurfacePlaneSectionAsset] {
  return [body.base.lowerWall.binding.section.surfaceAsset, body.base.upperWall.binding.section.surfaceAsset,
    body.base.lowerWall.binding.section.planeAsset];
}
function modelRef(state: Context, body: QualifiedTranslatedStripBodyResult, componentIndex: 0|1|null,
  sourceModelId: string, objectId: string): SourceRef {
  const matches = body.models.filter(value => value.model.name === sourceModelId);
  check(state, matches.length === 1, CODE.BINDING, 'A qualified reference must resolve one actual native Model namespace');
  const model = matches[0], objectIndex = model.model.objects.findIndex(object => object.id === objectId);
  check(state, objectIndex >= 0, CODE.BINDING, 'A qualified reference must resolve the actual native object member');
  return { sourceField: componentIndex === null ? 'request.body' : 'outputs.body.models.source', componentIndex,
    sourceId: model.sourceId, modelName: model.model.name, objectIndex, objectId };
}
function faceRef(state: Context, body: QualifiedTranslatedStripBodyResult, componentIndex: 0|1|null,
  face: QualifiedTranslatedStripBodyResult['faces'][number]): FaceRef {
  return { componentIndex, bodyId: body.body.id, faceId: face.id, surfaceId: face.nativeSurface.id, role: face.role,
    support: modelRef(state, body, componentIndex, face.supportRef.sourceModelId, face.supportRef.objectId) };
}
function edgeRef(state: Context, body: QualifiedTranslatedStripBodyResult, componentIndex: 0|1|null,
  edge: QualifiedTranslatedStripBodyResult['edges'][number]): EdgeRef {
  return { componentIndex, bodyId: body.body.id, edgeId: edge.id, curveId: edge.curve.id, role: edge.role,
    curve: modelRef(state, body, componentIndex, edge.curveRef.sourceModelId, edge.curveRef.objectId) };
}
function vertexRef(body: QualifiedTranslatedStripBodyResult, componentIndex: 0|1|null,
  vertex: QualifiedTranslatedStripBodyResult['vertices'][number]): VertexRef {
  return { componentIndex, bodyId: body.body.id, vertexId: vertex.id, world: vertex.world };
}
function geometry(curve: Curve): Omit<Curve, 'id'> {
  return { kind: curve.kind, degree: curve.degree, knots: curve.knots, controlPoints: curve.controlPoints, weights: curve.weights };
}
function basis(surface: Surface): unknown {
  return { degreeU: surface.degreeU, degreeV: surface.degreeV, knotsU: surface.knotsU,
    knotsV: surface.knotsV, weights: surface.weights };
}
function selectedSource(state: Context, asset: MultiSpanVLinearSurfacePlaneSectionAsset, model: Model,
  field: SourceRef['sourceField']): SourceRef {
  const index = model.objects.findIndex(object => object.id === asset.surface.id);
  check(state, index >= 0 && same(model.objects[index], asset.surface), CODE.BINDING,
    'The full source-qualified selected Surface must retain its actual member bits');
  return { sourceField: field, componentIndex: null, sourceId: asset.sourceId,
    modelName: model.name, objectIndex: index, objectId: asset.surface.id };
}

/** Partition one actual occupied region using an unchanged source-backed interior Y Plane. */
export function splitTranslatedStripBodyByPlane(input: TranslatedStripPlaneSplitRequest): TranslatedStripPlaneSplitResult {
  const state = context();
  const data = record(state, snapshot(state, input), ['body', 'cutAsset', 'options']);
  const settings = record(state, data.options, ['evaluationId', 'maximumOutputBodies', 'maximumProducerDelegations', 'outputRecipes']);
  id(state, settings.evaluationId);
  check(state, settings.maximumOutputBodies === 2 && settings.maximumProducerDelegations === 22,
    CODE.BUDGET, 'Complete fixed output/producer budgets2/22 are required');
  check(state, Array.isArray(settings.outputRecipes) && settings.outputRecipes.length === 2,
    CODE.INPUT, 'Exactly two full eleven-stage construction recipes are required');
  settings.outputRecipes.forEach(value => admitRecipe(state, value));
  const cutData = record(state, data.cutAsset, ['sourceId', 'source', 'surface']);
  id(state, cutData.sourceId);
  check(state, typeof cutData.source === 'string', CODE.INPUT, 'A complete original cut Source0 string is required');
  const cutSurfaceData = record(state, cutData.surface, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
  id(state, cutSurfaceData.id);
  const request = data as unknown as TranslatedStripPlaneSplitRequest, options = request.options, original = request.body;
  const cutSize = sourceSize(state, request.cutAsset.source), requestSize = json(state, request, 6291456).size;
  const outputs: Output[] = [], staged: unknown[] = [];
  let cutModel: Model | null = null;
  let retainedProof: unknown = null, retainedBindings: unknown = null;
  const guard = (): void => {
    const stage = state.stage; state.stage = 'file';
    const prefix = { request, cutModel, outputs, staged, proof: retainedProof, bindings: retainedBindings };
    json(state, prefix, 12582912); snapshot(state, prefix); state.stage = stage;
  };
  state.stage = 'parent'; guard();
  state.directCounts.originalBodyValidationCount++; state.directCounts.totalDirectDelegationCount++;
  native(state, () => validateQualifiedTranslatedStripBody(original), CODE.PARENT, 'Complete original qualified Body validation refused');
  guard();
  state.stage = 'cut-source';
  state.directCounts.cutSourceCompilationCount++; state.directCounts.totalDirectDelegationCount++;
  const compiled = native(state, () => compileCadModel(request.cutAsset.source, { sourceVersion: 0 }), CODE.SOURCE,
    'Actual complete original cut source compilation refused');
  if (!compiled.ok) fail(state, CODE.SOURCE, 'Actual cut Source0 did not compile', compiled.diagnostics);
  cutModel = compiled.model; guard();
  state.stage = 'cut-binding';
  const cut = request.cutAsset.surface, assets = originalAssets(original), low = assets[0].surface, high = assets[1].surface;
  const found = cutModel.objects.filter(object => object.id === cut.id);
  check(state, found.length === 1 && found[0].kind === 'surface', CODE.REFERENCE, 'The cut must select one actual original native Surface');
  check(state, same(found[0], cut), CODE.BINDING, 'Every supplied cut Surface bit must match its actual original source');
  for (const surface of [low, high, cut]) check(state, surface.degreeU === 1 && surface.degreeV === 1 &&
    surface.controlPoints.length === 2 && surface.controlPoints.every(row => row.length === 2) &&
    surface.weights.length === 2 && surface.weights.every(row => row.length === 2 && row.every(value => Object.is(value, 1))),
  CODE.SUPPORT, 'Only actual unit-weight affine2x2 side/cut supports are admitted');
  check(state, same(basis(low), basis(high)) && same(basis(low), basis(cut)), CODE.SUPPORT,
    'Actual original/cut bases, domains and weight bits must match without normalization');
  const yL = low.controlPoints[0][0][1], yC = cut.controlPoints[0][0][1], yH = high.controlPoints[0][0][1];
  for (const [surface, y] of [[low, yL], [high, yH], [cut, yC]] as const) check(state,
    surface.controlPoints.every(row => row.every(point => Object.is(point[1], y))), CODE.SUPPORT,
    'Each actual side/cut support must have uniformly represented constant Y');
  check(state, [high, cut].every(surface => surface.controlPoints.every((row, u) => row.every((point, v) =>
    Object.is(point[0], low.controlPoints[u][v][0]) && Object.is(point[2], low.controlPoints[u][v][2])))),
  CODE.SUPPORT, 'All actual XZ coefficients must be copied bits of the original support');
  check(state, Object.is(low.controlPoints[0][0][0], low.controlPoints[0][1][0]) &&
    Object.is(low.controlPoints[1][0][0], low.controlPoints[1][1][0]) &&
    Object.is(low.controlPoints[0][0][2], low.controlPoints[1][0][2]) &&
    Object.is(low.controlPoints[0][1][2], low.controlPoints[1][1][2]), CODE.SUPPORT,
  'Original affine X must depend only onU and Z only onV');
  const selectedIds = [...assets, request.cutAsset].map(asset => asset.surface.id), sourceIds = [...assets, request.cutAsset].map(asset => asset.sourceId);
  check(state, new Set(selectedIds).size === 4 && new Set(sourceIds).size === 4, CODE.IDENTITY,
    'Original lower/upper/roof/cut selected Surface and source identities must be distinct');
  state.stage = 'identity';
  const inputContexts = contexts({ original, cutAsset: request.cutAsset, cutModel });
  const reserved = new Set(inputContexts), generatedIds: string[] = [];
  const reserve = (value: string): void => { id(state, value); check(state, !reserved.has(value), CODE.IDENTITY,
    'A real fresh recipe role collides with complete original/cut contexts or the other output'); reserved.add(value); generatedIds.push(value); };
  reserve(options.evaluationId);
  for (const recipe of options.outputRecipes) recipeIds(recipe).forEach(reserve);
  state.stage = 'partition';
  const q = new SectionRationalContext((kind, detail) => fail(state, CODE[kind], detail));
  const read = (fraction: SectionFraction): SectionRational => q.rat(BigInt(fraction.numerator), BigInt(fraction.denominator));
  const text = (values: SectionRational[]): SectionFraction[] => values.map(value => q.text(value));
  const zero = q.integer(0), one = q.integer(1), lo = q.from(yL), mid = q.from(yC), hi = q.from(yH);
  const h = q.sub(hi, lo), h0 = q.sub(mid, lo), h1 = q.sub(hi, mid);
  check(state, h0.n > 0n && h1.n > 0n, CODE.CUT, 'The actual cut Plane must be strictly inside the original Y interval');
  check(state, q.compare(h, read(original.report.h)) === 0 && q.compare(h, read(original.proof.material.cubeMap.h)) === 0,
    CODE.PARTITION, 'Actual original source width must bind to the full occupied-material certificate');
  const dx = q.sub(q.from(low.controlPoints[1][0][0]), q.from(low.controlPoints[0][0][0]));
  const dz = q.sub(q.from(low.controlPoints[0][1][2]), q.from(low.controlPoints[0][0][2]));
  check(state, dx.n > 0n && dz.n > 0n, CODE.SUPPORT, 'Actual affine X/Z charts must have positive exact directions');
  const nativeDomains = original.proof.material.cubeMap.nativeDomains;
  const interval = (lower: SectionRational, upper: SectionRational): Interval => ({ lowerY: q.text(lower), upperY: q.text(upper), width: q.text(q.sub(upper, lower)) });
  const intervals: Two<Interval> = [interval(lo, mid), interval(mid, hi)];
  const origin = cut.controlPoints[0][0].map(value => q.from(value)), uDirection = [dx, zero, zero], vDirection = [zero, zero, dz];
  const rawNormal = [zero, q.neg(q.mul(dx, dz)), zero], d = q.neg(q.sum(rawNormal.map((value, axis) => q.mul(value, origin[axis]))));
  const fourth = cut.controlPoints[1][1].map((value, axis) => q.sub(q.from(value), q.add(q.add(origin[axis], uDirection[axis]), vDirection[axis])));
  check(state, fourth.every(value => value.n === 0n), CODE.CUT, 'The actual cut is not the exact original affine Plane');
  const originalVolume = read(original.report.exactVolumeMM3), area = q.div(originalVolume, h);
  const expectedVolumes: Two<SectionRational> = [q.mul(area, h0), q.mul(area, h1)];
  const lowSection = original.base.lowerWall.binding.section, highSection = original.base.upperWall.binding.section;
  const cutProof: CutProof = { selectedObjectIndex: cutModel.objects.findIndex(object => object.id === cut.id),
    source: selectedSource(state, request.cutAsset, cutModel, 'request.cutAsset.source'),
    lowerSource: selectedSource(state, assets[0], lowSection.originalModels[0], 'request.body'),
    upperSource: selectedSource(state, assets[1], highSection.originalModels[0], 'request.body'),
    roofSource: selectedSource(state, assets[2], lowSection.originalModels[1], 'request.body'),
    domains: nativeDomains, degrees: [1, 1], knotsU: low.knotsU, knotsV: low.knotsV, unitWeight: q.text(one),
    yLower: q.text(lo), yCut: q.text(mid), yUpper: q.text(hi),
    lowerYResiduals: low.controlPoints.map(row => row.map(point => q.text(q.sub(q.from(point[1]), lo)))),
    cutYResiduals: cut.controlPoints.map(row => row.map(point => q.text(q.sub(q.from(point[1]), mid)))),
    upperYResiduals: high.controlPoints.map(row => row.map(point => q.text(q.sub(q.from(point[1]), hi)))),
    cutToLowerDifferences: cut.controlPoints.map((row, u) => row.map((point, v) => text(point.map((value, axis) => q.sub(q.from(value), q.from(low.controlPoints[u][v][axis])))))),
    cutToUpperDifferences: cut.controlPoints.map((row, u) => row.map((point, v) => text(point.map((value, axis) => q.sub(q.from(high.controlPoints[u][v][axis]), q.from(value)))))),
    xzBitsEqual: true, basisWeightBitsEqual: true,
    plane: { origin: text(origin), uDirection: text(uDirection), vDirection: text(vDirection), rawNormal: text(rawNormal), d: q.text(d),
      fourthCornerResiduals: text(fourth), equation: 'Y-yCut=0', nativeNormalYSign: -1, strictPositiveXZ: true } };
  retainedProof = { cut: cutProof, intervals, generatedIds }; guard();
  const actualVolumes: SectionRational[] = [], outputMaterial: Proof['outputMaterial'] = [];
  for (let index = 0; index < 2; index++) {
    state.componentIndex = index as 0 | 1;
    const donors: [MultiSpanVLinearSurfacePlaneSectionAsset, MultiSpanVLinearSurfacePlaneSectionAsset,
      MultiSpanVLinearSurfacePlaneSectionAsset] = index === 0 ? [assets[0], request.cutAsset, assets[2]] : [request.cutAsset, assets[1], assets[2]];
    const body = construct(state, donors, options.outputRecipes[index], staged, guard);
    check(state, same(originalAssets(body), donors) && same(originalRecipe(body), options.outputRecipes[index]), CODE.BINDING,
      'Every output must retain the exact fresh recipe and unchanged original/cut/roof donors');
    check(state, same(body.proof.material.cubeMap.nativeDomains, nativeDomains) &&
      same(body.base.lowerWall.binding.pcurve.curve.controlPoints, original.base.lowerWall.binding.pcurve.curve.controlPoints) &&
      same(body.base.lowerWall.binding.pcurve.curve.knots, original.base.lowerWall.binding.pcurve.curve.knots) &&
      same(body.base.lowerWall.binding.pcurve.curve.weights, original.base.lowerWall.binding.pcurve.curve.weights), CODE.PARTITION,
    'Actual output domains and complete stored roof geometry must match the original occupied map');
    const material = body.proof.material;
    const actualFresh = [...contexts(body)].filter(value => !inputContexts.has(value) && value !== 'profile').sort();
    check(state, same(actualFresh, recipeIds(options.outputRecipes[index]).sort()), CODE.BINDING,
      'Actual output roles must equal the complete pre-reserved recipe, with source-qualified fixed aliases only');
    check(state, body.body.restrictedSolidCertified && body.body.solid && material.restrictedSolidCertified &&
      material.sourceDefinedOccupiedRegion && material.wholeBoundaryImage && material.embeddedClosedBoundary && material.outwardMaterial &&
      body.vertices.length === 8 && body.edges.length === 12 && body.faces.length === 6 &&
      body.faces.reduce((n, face) => n + face.loop.uses.length, 0) === 24 && body.proof.vertexLinks.length === 8 &&
      body.models[0].model.objects.length === 16 && body.models[1].model.objects.length === 2 &&
      body.faces.length === body.shell.faceIds.length && body.body.shellIds.length === 1 &&
      body.proof.vertexLinks.reduce((total, link) => total + link.cornerArcs.length, 0) === 24 &&
      same(body.faces.map(face => face.orientation), ['forward', 'reverse', 'forward', 'reverse', 'forward', 'reverse']),
    CODE.BINDING, 'Every real output must retain its complete shared topology and whole embedded occupied-material qualification');
    const actual = read(body.report.exactVolumeMM3), expectedWidth = index === 0 ? h0 : h1;
    check(state, q.compare(actual, expectedVolumes[index]) === 0 && q.compare(read(body.report.h), expectedWidth) === 0 &&
      q.compare(read(material.cubeMap.h), expectedWidth) === 0, CODE.VOLUME,
    'Actual output volume and material width must equal the exact source-defined interval restriction');
    actualVolumes.push(actual);
    outputMaterial.push({ index: index as 0 | 1, bodyId: body.body.id, materialCertificateId: material.certificateId,
      originalMaterialCertificateId: original.proof.material.certificateId, lowerSourceId: donors[0].sourceId,
      upperSourceId: donors[1].sourceId, roofSourceId: donors[2].sourceId, unchangedSourceDomainRoof: true,
      sourceDefinedOccupiedRegion: true, wholeBoundaryImage: true, embeddedClosedBoundary: true,
      outwardMaterial: true, restrictedSolidCertified: true });
    outputs.push({ index: index as 0 | 1, side: index === 0 ? 'below-y' : 'above-y', recipe: options.outputRecipes[index], body });
    state.directCounts.outputBodyConstructionCount++;
    staged.length = 0; guard();
  }
  state.stage = 'lineage'; state.componentIndex = null;
  const outputBodies = outputs.map(output => output.body) as Two<QualifiedTranslatedStripBodyResult>;
  const getFace = (body: QualifiedTranslatedStripBodyResult, role: FaceRef['role']) => {
    const face = body.faces.find(value => value.role === role);
    check(state, face !== undefined, CODE.BINDING, 'An actual qualified Face role is missing'); return face;
  };
  const getEdge = (body: QualifiedTranslatedStripBodyResult, role: EdgeRef['role']) => {
    const edge = body.edges.find(value => value.role === role);
    check(state, edge !== undefined, CODE.BINDING, 'An actual qualified Edge role is missing'); return edge;
  };
  const firstCut = getFace(outputBodies[0], 'upper'), secondCut = getFace(outputBodies[1], 'lower');
  check(state, same(firstCut.nativeSurface, cut) && same(secondCut.nativeSurface, cut) &&
    firstCut.orientation === 'reverse' && secondCut.orientation === 'forward', CODE.ORIENTATION,
  'Actual cut Faces must retain the same original Plane and opposite outward orientations');
  const boundaryMaps: Bindings['cut']['boundaryMaps'] = [];
  for (const [firstRole, secondRole] of [['upperBottom', 'lowerBottom'], ['upperCut', 'lowerCut'],
    ['upperLeft', 'lowerLeft'], ['upperRight', 'lowerRight']] as const) {
    const first = getEdge(outputBodies[0], firstRole), second = getEdge(outputBodies[1], secondRole);
    check(state, same(geometry(first.curve), geometry(second.curve)), CODE.BINDING,
      'Each common cut-boundary pair must have identical complete native geometry apart from IDs');
    const firstUse = first.uses.find(use => use.faceId === firstCut.id), secondUse = second.uses.find(use => use.faceId === secondCut.id);
    check(state, firstUse !== undefined && secondUse !== undefined && firstUse.sense !== secondUse.sense &&
      same(geometry(firstUse.pcurve.curve), geometry(secondUse.pcurve.curve)), CODE.ORIENTATION,
    'Actual already-oriented cut Uses and local UV geometry must be opposite on the same original chart');
    const residuals = first.curve.controlPoints.map((point, i) => text(point.map((value, axis) =>
      q.sub(q.from(value), q.from(second.curve.controlPoints[i][axis])))));
    boundaryMaps.push({ first: edgeRef(state, outputBodies[0], 0, first), second: edgeRef(state, outputBodies[1], 1, second),
      parameterScale: q.text(one), parameterOffset: q.text(zero), coefficientResiduals: residuals, oppositeEffectiveUses: true });
  }
  const faceLineage: Bindings['faceLineage'] = [];
  for (const originalFace of original.faces) {
    const indices: (0|1)[] = originalFace.role === 'lower' ? [0] : originalFace.role === 'upper' ? [1] : [0, 1];
    const outputRefs: FaceRef[] = [], materialMapResiduals: SectionFraction[][] = [];
    for (const index of indices) {
      const face = getFace(outputBodies[index], originalFace.role), s = originalFace.nativeSurface, t = face.nativeSurface;
      check(state, same(basis(s), basis(t)) && s.controlPoints.length === t.controlPoints.length &&
        s.controlPoints.every((row, u) => row.length === t.controlPoints[u].length), CODE.BINDING,
      'Actual Face restriction bases/grids must preserve their original native chart');
      for (let u = 0; u < t.controlPoints.length; u++) for (let v = 0; v < t.controlPoints[u].length; v++) {
        let expected: SectionRational[];
        if (originalFace.role === 'base' || originalFace.role === 'uMin' || originalFace.role === 'uMax') {
          const offset = index === 0 ? zero : q.div(h0, h), scale = q.div(index === 0 ? h0 : h1, h);
          const oldW = q.add(offset, q.mul(scale, q.integer(v)));
          expected = s.controlPoints[u][0].map((value, axis) => q.add(q.from(value),
            q.mul(oldW, q.sub(q.from(s.controlPoints[u][1][axis]), q.from(value)))));
        } else expected = s.controlPoints[u][v].map(value => q.from(value));
        const row = t.controlPoints[u][v].map((value, axis) => q.sub(q.from(value), expected[axis]));
        check(state, row.every(value => value.n === 0n), CODE.PARTITION,
          'Every actual Face support coefficient must equal the whole source-material restriction');
        materialMapResiduals.push(text(row));
      }
      outputRefs.push(faceRef(state, outputBodies[index], index, face));
    }
    faceLineage.push({ original: faceRef(state, original, null, originalFace), outputs: outputRefs,
      semantics: indices.length === 1 ? 'same-whole-face-image' : 'partition-of-original-face-image',
      translationIntervals: indices.map(index => intervals[index]), materialMapResiduals });
  }
  const edgeLineage: Bindings['edgeLineage'] = [];
  const crossRoles = new Set<EdgeRef['role']>(['capLeft', 'capRight', 'baseLeft', 'baseRight']);
  for (const old of original.edges) {
    const partitioned = crossRoles.has(old.role);
    const indices: (0|1)[] = partitioned ? [0, 1] : old.role.startsWith('lower') ? [0] : [1];
    const children: Bindings['edgeLineage'][number]['outputs'] = [];
    for (const index of indices) {
      const child = getEdge(outputBodies[index], old.role), a = old.curve, b = child.curve;
      check(state, a.degree === b.degree && same(a.knots, b.knots) && same(a.weights, b.weights) &&
        a.controlPoints.length === b.controlPoints.length, CODE.BINDING,
      'Every actual Edge image must retain the original complete native basis');
      let scale = one, offset = zero;
      if (partitioned) {
        check(state, a.degree === 1 && a.controlPoints.length === 2 && same(a.knots, [0, 0, 1, 1]) && same(a.weights, [1, 1]),
          CODE.SUPPORT, 'Actual cross-Y edges must be unit-domain native Lines');
        const denominator = q.sub(q.from(a.controlPoints[1][1]), q.from(a.controlPoints[0][1]));
        offset = q.div(q.sub(q.from(b.controlPoints[0][1]), q.from(a.controlPoints[0][1])), denominator);
        scale = q.div(q.sub(q.from(b.controlPoints[1][1]), q.from(b.controlPoints[0][1])), denominator);
        check(state, scale.n > 0n && q.compare(offset, zero) >= 0 && q.compare(q.add(offset, scale), one) <= 0,
          CODE.PARTITION, 'Actual ascending or descending Line images must restrict their complete original interval');
      }
      const residuals = b.controlPoints.map((point, pole) => point.map((value, axis) => {
        const expected = partitioned ? q.add(q.from(a.controlPoints[0][axis]), q.mul(q.add(offset, q.mul(scale, q.integer(pole))),
          q.sub(q.from(a.controlPoints[1][axis]), q.from(a.controlPoints[0][axis])))) : q.from(a.controlPoints[pole][axis]);
        return q.sub(q.from(value), expected);
      }));
      check(state, residuals.every(row => row.every(value => value.n === 0n)), CODE.PARTITION,
        'Every complete stored Edge coefficient must equal its explicit original-parameter image');
      children.push({ edge: edgeRef(state, outputBodies[index], index, child), nativeParameterScale: q.text(scale),
        nativeParameterOffset: q.text(offset), coefficientResiduals: residuals.map(text) });
    }
    if (partitioned) {
      const maps = children.map(child => ({ start: read(child.nativeParameterOffset), length: read(child.nativeParameterScale) }))
        .sort((a, b) => q.compare(a.start, b.start));
      check(state, maps[0].start.n === 0n && q.compare(q.add(maps[0].start, maps[0].length), maps[1].start) === 0 &&
        q.compare(q.add(maps[1].start, maps[1].length), one) === 0, CODE.PARTITION,
      'The two actual cross-Y Line restrictions must cover the entire original interval without a gap');
    }
    edgeLineage.push({ original: edgeRef(state, original, null, old), outputs: children,
      semantics: partitioned ? 'partition-of-original-edge-image' : 'same-whole-edge-image' });
  }
  const vertexLineage: Bindings['vertexLineage'] = original.vertices.map(vertex => {
    const matches = outputBodies.flatMap((body, index) => body.vertices.filter(value => same(value.world, vertex.world))
      .map(value => ({ body, index: index as 0 | 1, value })));
    check(state, matches.length === 1, CODE.PARTITION, 'Each original outer vertex must map to exactly one actual output vertex with unchanged bits');
    return { original: vertexRef(original, null, vertex), output: vertexRef(matches[0].body, matches[0].index, matches[0].value), pointBitsEqual: true };
  });
  const bindings: Bindings = { original: { bodyId: original.body.id, shellId: original.shell.id,
    materialCertificateId: original.proof.material.certificateId },
    cut: { source: cutProof.source, surfaceId: cut.id, first: faceRef(state, outputBodies[0], 0, firstCut),
      second: faceRef(state, outputBodies[1], 1, secondCut), originalCutSurfaceBitsEqual: true,
      wholeNativePatchImageEqual: true, effectiveOrientations: ['reverse', 'forward'], outwardNormalYSigns: [1, -1], boundaryMaps },
    faceLineage, edgeLineage, vertexLineage, directionConvention: 'parent-stored-use-order-already-includes-face-orientation',
    namingAuthority: 'explicit-source-qualified-operation-lineage-no-generic-persistent-matching' };
  retainedBindings = bindings; guard();
  const sum = q.sum(actualVolumes), conservation = q.sub(sum, originalVolume);
  check(state, conservation.n === 0n && q.counts().floatConversions === 0, CODE.VOLUME,
    'Actual fresh occupied volumes must conserve all original material with exact zero residual and no root float conversion');
  const proof: Proof = { cut: cutProof, intervals: { original: interval(lo, hi), outputs: intervals,
      sharedEndpointResidual: q.text(q.sub(read(intervals[0].upperY), read(intervals[1].lowerY))),
      originalWidthResidual: q.text(q.sub(q.add(h0, h1), h)), disjointOpenInteriors: true, closedUnionEqualsInput: true,
      commonMap: 'S_originalLower(u,v)+[0,translationY,0]', materialSemantics: 'partition-of-one-occupied-region-no-removed-slab' },
    outputMaterial, volume: { areaFactorMM2: q.text(area), originalExactVolumeMM3: q.text(originalVolume),
      expectedOutputExactVolumeMM3: expectedVolumes.map(value => q.text(value)) as Two<SectionFraction>,
      actualOutputExactVolumeMM3: actualVolumes.map(value => q.text(value)) as Two<SectionFraction>,
      outputResiduals: actualVolumes.map((value, index) => q.text(q.sub(value, expectedVolumes[index]))) as Two<SectionFraction>,
      sumExactVolumeMM3: q.text(sum), conservationResidual: q.text(conservation) }, generatedIds };
  retainedProof = proof; guard();
  state.stage = 'file';
  check(state, state.directCounts.producerDelegationCount === 22 && state.directCounts.totalDirectDelegationCount === 24,
    CODE.BINDING, 'Only completed actual twenty-two producers and two original authority calls establish the report');
  const report: TranslatedStripPlaneSplitReport = {
    schema: 'barocss-translated-strip-plane-split', version: 0, evaluationId: options.evaluationId,
    lengthUnit: 'mm', volumeUnit: 'mm3', sourceFrame: 'authored-xyz-no-axis-conversion',
    profile: 'qualified-affine-xz-constant-y-side-supports-and-interior-y-plane',
    originalBodyId: original.body.id, originalMaterialCertificateId: original.proof.material.certificateId,
    cutSourceId: request.cutAsset.sourceId, cutSurfaceId: cut.id, cutModelName: cutModel.name,
    selectedCutObjectIndex: cutProof.selectedObjectIndex, outputBodyIds: outputBodies.map(body => body.body.id) as Two<string>,
    outputMaterialCertificateIds: outputBodies.map(body => body.proof.material.certificateId) as Two<string>,
    inputBodyCount: 1, outputBodyCount: 2, exactVolumeMM3: q.text(sum),
    outputExactVolumesMM3: proof.volume.actualOutputExactVolumeMM3, conservationResidual: proof.volume.conservationResidual,
    yInterval: proof.intervals.original, outputYIntervals: intervals, directCounts: { ...state.directCounts }, rationalCounts: q.counts(),
    outputCounts: outputBodies.map(() => ({ vertexCount: 8, edgeCount: 12, faceCount: 6, useCount: 24, loopCount: 6,
      vertexLinkCount: 8, cornerArcCount: 24, modelCount: 2, geometryObjectCount: 18, shellCount: 1, bodyCount: 1 })) as TranslatedStripPlaneSplitReport['outputCounts'],
    lineageCounts: { originalFaces: 6, originalEdges: 12, originalVertices: 8, unchangedFaceImages: 2,
      partitionedFaceImages: 4, unchangedEdgeImages: 8, partitionedEdgeImages: 4, commonCutFaces: 2, commonCutBoundaryPairs: 4 },
    sourceSizes: { cut: cutSize }, fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } },
    numericPolicy: { authority: 'exact-represented-original-and-cut-source-material-map',
      cutSelection: 'unchanged-original-caller-plane-surface-not-computed-endpoint',
      semantics: 'conserved-closed-interval-partition-not-finite-width-subtraction',
      commonRoof: 'same-full-original-plane-and-stored-native-roof', volume: 'exact-area-factor-times-positive-y-width',
      lineage: 'explicit-qualified-source-and-complete-coefficient-parameter-maps',
      orientation: 'cut-upper-reverse-and-cut-lower-forward-parent-uses-once', rootNativeSampling: false,
      rootFloatConversion: false, weldingPerformed: false, sourceIdentityRenaming: false, coefficientGeneration: false, toleranceUsed: false },
    quality: { restrictedSplitCertified: true, inputMaterialConserved: true, disjointOutputInteriors: true,
      closedOutputUnionEqualsInput: true, actualOutputBodiesQualified: true, commonCutImageCertified: true,
      oppositeCutOutwardOrientations: true, originalBodySourcesAndSiblingsPreserved: true,
      fullParentProofsUnchanged: true, genericSplitBody: false, arbitraryPlaneCut: false, arbitraryCurvedSolid: false,
      globalC1: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false,
      genericPersistentNaming: false, editorAccepted: false, publication: false, ownedRebuild: true,
      ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumInputBodies: 1, maximumCutAssets: 1, maximumOutputBodies: 2, maximumProducerDelegations: 22,
      maximumOutputModels: 4, maximumOutputGeometryObjects: 36, selectedDegreeU: 1, selectedDegreeV: 1, selectedAxisPoles: 2,
      maximumOriginalSpans: 1, unitWeight: 1, maximumObjectsPerModel: 16, maximumBodyUTF16: 2097152, maximumBodyUTF8: 2097152,
      sourceUTF16: 262144, sourceUTF8: 262144, identityCharacters: 48,
      maximumRequestUTF16: 6291456, maximumRequestUTF8: 6291456, maximumResultUTF16: 12582912, maximumResultUTF8: 12582912,
      ownValues: 4194304, ownDepth: 64, arrayElements: 8192, recordFields: 64, keyCharacters: 128, stringCharacters: 262144,
      rationalOperations: 200000, gcdSteps: 200000, rationalIntegerBits: 8192, fractionIntegerCharacters: 5000,
      rootNativeCalls: 0, rootFloatConversions: 0, maximumAuthoredUTF16: 2097152, maximumAuthoredUTF8: 2097152,
      authoredParserDepth: 12, authoredParserValues: 65536, authoredParserRecordFields: 16, authoredParserStringCharacters: 262144 },
    workScope: 'one-body-validation-one-cut-compile-and-actual-twenty-two-producer-calls-child-work-retained-separately',
    budgetFailure: 'atomic-no-partial-accepted-split-bodies-or-authored-update' };
  const result: TranslatedStripPlaneSplitResult = { request, cutModel, proof, outputs: outputs as Two<Output>, bindings, report };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const size = json(state, result, 12582912).size;
    if (same(size, report.fileSizes.result)) { settled = true; break; }
    report.fileSizes.result = size;
  }
  check(state, settled && same(json(state, result, 12582912).size, report.fileSizes.result), CODE.FILE,
    'Full result file-size metadata must settle within eight passes');
  return snapshot(state, result) as TranslatedStripPlaneSplitResult;
}

/** Compare the complete family with one real cold reconstruction, retaining failure work. */
export function validateTranslatedStripPlaneSplit(value: unknown): TranslatedStripPlaneSplitReport {
  const state = context(); state.stage = 'owned';
  try {
    const owned = record(state, snapshot(state, value, true), ['request', 'cutModel', 'proof', 'outputs', 'bindings', 'report'],
      CODE.OWNED) as unknown as TranslatedStripPlaneSplitResult;
    json(state, owned, 12582912);
    const expected = splitTranslatedStripBodyByPlane(owned.request);
    state.directCounts = { ...expected.report.directCounts };
    check(state, same(owned, expected), CODE.OWNED,
      'Complete original/cut/output sources, material, lineage, topology, counts or sizes differ from reconstruction');
    return snapshot(state, expected.report, true) as TranslatedStripPlaneSplitReport;
  } catch (cause) {
    if (cause instanceof TranslatedStripPlaneSplitError && cause.code === CODE.OWNED) throw cause;
    const failed = cause instanceof TranslatedStripPlaneSplitError ? cause.context : state;
    throw new TranslatedStripPlaneSplitError(CODE.OWNED, 'Whole owned reconstruction refused', { ...failed, stage: 'owned' }, cause);
  }
}
function canonical(state: Context, value: unknown): unknown {
  if (typeof value === 'string') {
    // Validate decoded strings themselves: JSON escaping must not hide malformed Unicode.
    native(state, () => cadDocumentOwnUtf8Bytes(value, 'JSON'), CODE.CODEC, 'Malformed authored string Unicode refused');
    return value;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(item => canonical(state, item));
  const data = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(data).sort().map(key => [key, canonical(state, data[key])]));
}
function codecFailure(state: Context, cause: unknown): never {
  if (cause instanceof TranslatedStripPlaneSplitError && cause.code === CODE.CODEC) throw cause;
  const directCounts = cause instanceof TranslatedStripPlaneSplitError ? cause.context.directCounts : state.directCounts;
  throw new TranslatedStripPlaneSplitError(CODE.CODEC, 'Canonical authored Split codec refused',
    { ...state, stage: 'codec', directCounts,
      componentIndex: cause instanceof TranslatedStripPlaneSplitError ? cause.context.componentIndex : state.componentIndex }, cause);
}
/** Encode only the actual authored construction recipe; all derived Bodies remain separate. */
export function serializeTranslatedStripPlaneSplit(value: TranslatedStripPlaneSplitResult): string {
  const state = context(); state.stage = 'codec';
  try {
    const owned = snapshot(state, value, true) as TranslatedStripPlaneSplitResult;
    state.codecCounts.ownedSplitValidationCount++;
    const report = validateTranslatedStripPlaneSplit(owned);
    state.directCounts = { ...report.directCounts };
    const original = owned.request.body;
    const document: AuthoredSplitV0 = { schema: 'barocss-authored-translated-strip-plane-split', version: 0,
      original: { assets: originalAssets(original), recipe: originalRecipe(original) },
      cutAsset: owned.request.cutAsset, outputRecipes: owned.request.options.outputRecipes,
      options: { evaluationId: owned.request.options.evaluationId, maximumOutputBodies: 2, maximumProducerDelegations: 22 } };
    const normalized = canonical(state, snapshot(state, document)) as AuthoredSplitV0;
    // Root field order is fixed; all nested record keys use one deterministic order.
    const ordered: AuthoredSplitV0 = { schema: normalized.schema, version: normalized.version,
      original: normalized.original, cutAsset: normalized.cutAsset, outputRecipes: normalized.outputRecipes, options: normalized.options };
    return json(state, ordered, 2097152, true).text;
  } catch (cause) { codecFailure(state, cause); }
}
/** Strict authored decode, real original eleven-stage reconstruction, then the real conserved Split. */
export function parseTranslatedStripPlaneSplit(text: string): TranslatedStripPlaneSplitResult {
  const state = context(); state.stage = 'codec';
  try {
    check(state, typeof text === 'string' && text.length <= 2097152, CODE.CODEC, 'Authored text must fit the2MiB UTF16 envelope');
    const bytes = native(state, () => cadDocumentOwnUtf8Bytes(text, 'JSON'), CODE.CODEC, 'Actual authored Unicode/UTF8 admission refused');
    check(state, bytes <= 2097152, CODE.CODEC, 'Authored text must fit the2MiB UTF8 envelope');
    const parsed = native(state, () => parseCadDocumentOwnJson(text), CODE.CODEC,
      'Unchanged strict authored JSON parser refused');
    const document = record(state, snapshot(state, parsed), ['schema', 'version', 'original', 'cutAsset', 'outputRecipes', 'options'],
      CODE.CODEC) as unknown as AuthoredSplitV0;
    check(state, document.schema === 'barocss-authored-translated-strip-plane-split' && Object.is(document.version, 0),
      CODE.CODEC, 'The exact authored Split schema and positive-zero version0 are required');
    const original = record(state, document.original, ['assets', 'recipe'], CODE.CODEC);
    check(state, Array.isArray(original.assets) && original.assets.length === 3, CODE.CODEC, 'Three actual original source assets are required');
    for (const value of [...original.assets, document.cutAsset]) {
      const asset = record(state, value, ['sourceId', 'source', 'surface'], CODE.CODEC);
      id(state, asset.sourceId);
      check(state, typeof asset.source === 'string', CODE.CODEC, 'Complete original source strings are required');
      sourceSize(state, asset.source);
      record(state, asset.surface, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'], CODE.CODEC);
    }
    const recipe = admitRecipe(state, original.recipe);
    check(state, Array.isArray(document.outputRecipes) && document.outputRecipes.length === 2, CODE.CODEC,
      'Two explicit output recipes are required');
    document.outputRecipes.forEach(value => admitRecipe(state, value));
    const options = record(state, document.options, ['evaluationId', 'maximumOutputBodies', 'maximumProducerDelegations'], CODE.CODEC);
    id(state, options.evaluationId);
    check(state, options.maximumOutputBodies === 2 && options.maximumProducerDelegations === 22,
      CODE.CODEC, 'Exact authored output/producer budgets2/22 are required');
    const staged: unknown[] = [];
    const guard = (): void => { const prefix = { document, staged }; json(state, prefix, 12582912); snapshot(state, prefix); };
    guard();
    state.codecCounts.originalBodyReconstructionCount++;
    const body = construct(state, original.assets as [MultiSpanVLinearSurfacePlaneSectionAsset,
      MultiSpanVLinearSurfacePlaneSectionAsset, MultiSpanVLinearSurfacePlaneSectionAsset], recipe, staged, guard, true);
    check(state, state.codecCounts.originalProducerDelegationCount === 11 && same(originalRecipe(body), recipe) &&
      same(originalAssets(body), original.assets), CODE.CODEC,
    'The real original Body must cold-reconstruct from all eleven exact authored options and full sources');
    state.codecCounts.splitConstructionCount++;
    const result = splitTranslatedStripBodyByPlane({ body, cutAsset: document.cutAsset,
      options: { evaluationId: options.evaluationId, maximumOutputBodies: 2, maximumProducerDelegations: 22,
        outputRecipes: document.outputRecipes } });
    check(state, result.report.directCounts.totalDirectDelegationCount === 24, CODE.CODEC,
      'The cold Split must retain its own actual24 direct calls, separate from original reconstruction11');
    return result;
  } catch (cause) { codecFailure(state, cause); }
}
