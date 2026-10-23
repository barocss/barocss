import { buildSourceLineWidthFace, SourceLineWidthFaceError } from './source-line-width-face.js';
import { extrudeConvexPlanarFace } from '../../convex-planar-face-extrusion.js';
import { qualifyRectangularFaceExtrusionBody } from '../../rectangular-face-extrusion-body.js';
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from '../../cad-document.js';

import type { SourceLineWidthFaceOptions, SourceLineWidthFaceResult } from './source-line-width-face.js';
import type { ConvexPlanarFaceExtrusionResult } from '../../convex-planar-face-extrusion.js';
import type { RectangularFaceExtrusionBodyOptions, RectangularFaceExtrusionBodyResult } from '../../rectangular-face-extrusion-body.js';
import { same } from '../../core/structural-equality.js';

type Size = { utf16: number; utf8: number };
type Parameter = { id: string; kind: 'length'; unit: 'mm'; valueMM: number };
type WidthNode = { id: string; kind: 'source-line-width-face'; sourceId: string;
  widthParameterId: string; options: SourceLineWidthFaceOptions };
type ExtrusionNode = { id: string; kind: 'convex-planar-face-extrusion'; faceNodeId: string;
  heightParameterId: string; suppressed: boolean;
  options: { evaluationId: string; resultIdPrefix: string; direction: 'positive-z' } };
type MaterialNode = { id: string; kind: 'rectangular-face-extrusion-body';
  extrusionNodeId: string; options: RectangularFaceExtrusionBodyOptions };
export interface SourceLineWidthMaterialBodyGraphV0 { // EXACT9
  format: 'barocss-source-line-width-material-body-graph'; version: 0;
  id: string; revision: number; lengthUnit: 'mm';
  sourceFrame: 'authored-xyz-no-axis-conversion';
  asset: { sourceId: string; sourceVersion: 0; source: string; curveId: string };
  parameters: [Parameter, Parameter];
  nodes: [WidthNode, ExtrusionNode, MaterialNode];
}
export interface SourceLineWidthMaterialBodyGraphOptions { // EXACT5
  maximumFeatureNodes: 3; maximumWidthEvaluations: 1;
  maximumExtrusionEvaluations: 1; maximumMaterialEvaluations: 1;
  maximumProducerEvaluations: 3;
}
type Request = { document: SourceLineWidthMaterialBodyGraphV0;
  options: SourceLineWidthMaterialBodyGraphOptions }; // EXACT2
export interface SourceLineWidthMaterialBodyGraphEdits { // EXACT4
  expectedRevision: number; revision: number;
  parameterEdits: { parameterId: string; valueMM: number }[];
  extrusionSuppressed: boolean | null;
}
type Dependency = { nodeId: string; dependencyNodeIds: string[];
  sourceIds: string[]; parameterIds: string[] };
type SourceContext = { context: 'original' | 'ruled' | 'face';
  authoredSourceId: string | null; sourceField: string; modelField: string;
  modelName: string; sourceVersion: 0 };
type Bindings = {
  graphId: string; revision: number;
  parameters: [
    { index: 0; parameterId: string; kind: 'length'; unit: 'mm'; valueMM: number; nodeId: string; role: 'width' },
    { index: 1; parameterId: string; kind: 'length'; unit: 'mm'; valueMM: number; nodeId: string; role: 'height' }
  ];
  sources: { original: SourceContext; ruled: SourceContext; face: SourceContext };
  width: { nodeId: string; sourceId: string; widthParameterId: string; curveId: string;
    modelName: string; selectedObjectIndex: number; faceId: string;
    provider: SourceLineWidthFaceResult['bindings'] };
  extrusion: { nodeId: string; inputNodeId: string; heightParameterId: string;
    status: 'active' | 'suppressed'; evaluationId: string; shellId: string | null;
    inputFaceId: string; provider: ConvexPlanarFaceExtrusionResult['bindings'] | null };
  material: { nodeId: string; inputNodeId: string; status: 'active' | 'suppressed';
    evaluationId: string; inputShellId: string | null; bodyId: string | null;
    shellId: string | null; materialCertificateId: string | null;
    provider: RectangularFaceExtrusionBodyResult['bindings'] | null };
  dependencies: [Dependency, Dependency, Dependency];
  plannedRoleIds: { width: string[]; extrusion: string[]; material: string[] };
  authority: 'complete-original-source-and-three-literal-mm-feature-recipes';
};
type RetainedProviderCounts = {
  width: SourceLineWidthFaceResult['report']['directCounts'];
  extrusion: ConvexPlanarFaceExtrusionResult['report']['directCounts'] | null;
  shellChildren: ConvexPlanarFaceExtrusionResult['report']['shellChildDirectCounts'] | null;
  material: RectangularFaceExtrusionBodyResult['report']['directCounts'] | null;
  materialRational: RectangularFaceExtrusionBodyResult['report']['rationalCounts'] | null;
  qualifiedBody: RectangularFaceExtrusionBodyResult['body']['report']['directCounts'] | null;
};
type ChangedProviderCounts = Omit<RetainedProviderCounts, 'width'> & {
  width: SourceLineWidthFaceResult['report']['directCounts'] | null;
};
type OperationCounts = {
  widthBuildCallCount: number; extrusionBuildCallCount: number;
  materialBuildCallCount: number; producerEvaluationCount: number;
  rootSourceCompilationCount: 0; rootCurveD0Count: 0; rootCurveD1AttemptCount: 0;
  rootSurfaceD0Count: 0; rootSurfaceD1AttemptCount: 0;
  rootRationalOperationCount: 0; oldGraphCallCount: 0;
};
export interface SourceLineWidthMaterialBodyGraphResult { // EXACT7
  document: SourceLineWidthMaterialBodyGraphV0; options: SourceLineWidthMaterialBodyGraphOptions;
  width: SourceLineWidthFaceResult; extrusion: ConvexPlanarFaceExtrusionResult | null;
  material: RectangularFaceExtrusionBodyResult | null;
  bindings: Bindings; report: SourceLineWidthMaterialBodyGraphReport;
}
export interface SourceLineWidthMaterialBodyGraphReport {
  schema: 'barocss-source-line-width-material-body-graph-report'; version: 0;
  graphId: string; revision: number; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  sourceId: string; originalModelName: string; originalCurveId: string; selectedObjectIndex: number;
  nodeOrder: [string, string, string]; parameterOrder: [string, string];
  dependencies: Bindings['dependencies']; widthMM: number; heightMM: number;
  extrusionStatus: 'active' | 'suppressed'; materialStatus: 'active' | 'suppressed';
  faceId: string; parentShellId: string | null; bodyId: string | null;
  materialShellId: string | null; materialCertificateId: string | null;
  exactVolumeMM3: RectangularFaceExtrusionBodyResult['report']['exactVolumeMM3'] | null;
  volumeMM3: number | null;
  conversionError: RectangularFaceExtrusionBodyResult['report']['conversionError'] | null;
  receiptCounts: { widthReceiptCount: 1; extrusionReceiptCount: 0 | 1;
    materialReceiptCount: 0 | 1; featureReceiptCount: 1 | 3 };
  retainedProviderCounts: RetainedProviderCounts;
  sourceSizes: { original: Size; ruled: Size; face: Size };
  fileSizes: { authored: Size; request: Size; result: Size }; ownValues: number;
  authority: 'complete-original-source-and-three-literal-mm-feature-recipes';
  reconstruction: 'whole-current-document-and-options-no-operation-history';
  workScope: 'retained-receipts-not-selective-constructor-call-counts';
  numericPolicy: { parameters: 'literal-finite-mm-values-not-source-expression-lowering';
    suppression: 'extrusion-and-material-suppressed-together-width-always-active';
    identity: 'qualified-source-contexts-and-explicit-current-recipe-roles';
    orientation: 'forward-natural-xy-positive-z-canonical-overshoot-material';
    comparison: 'object-is-semantic-values-and-complete-native-request-bits';
    noOp: 'new-revision-with-zero-changed-producer-calls';
    codec: 'small-authored-document-only-literal-negative-zero-and-one-newline' };
  quality: { completeOriginalSourceRetained: true; unrelatedOriginalGeometryPreserved: true;
    originalSelectedCurveBitsPreserved: true; sourceQualifiedBindings: true;
    fullWidthReceiptRetained: true; fullExtrusionReceiptWhenActive: true;
    fullMaterialReceiptWhenActive: true; parentFlagsUnchanged: true;
    affectedOnlyUpdates: true; ownedRebuild: true; faceIncidenceValid: true;
    closedAbstractShellProduced: boolean; freshRestrictedSolidProduced: boolean;
    sourceDefinedOccupiedRegion: boolean; wholeBoundaryImage: boolean;
    outwardMaterial: boolean; embeddedMaterialBody: boolean;
    geometricValidity: 'restricted-material-certified-when-active';
    genericSolid: false; genericBoolean: false; sourceExpressions: false;
    sourcePoleSubstitution: false; generalFeatureGraph: false;
    generalPersistentNaming: false; globalBinary64ErrorCertified: false;
    manufacturingToleranceCertified: false; editorDisplayCertified: false;
    publication: false; ownership: 'independent-copied-cpu-data-gc' };
  limits: Limits; budgetFailure: 'atomic-no-partial-width-extrusion-material-graph';
}
type Limits = {
  maximumFeatureNodes: 3; maximumParameters: 2; maximumWidthEvaluations: 1;
  maximumExtrusionEvaluations: 1; maximumMaterialEvaluations: 1; maximumProducerEvaluations: 3;
  maximumRevision: 1000000000; minimumLengthMM: 0.000001;
  maximumWidthMM: 10000; maximumHeightMM: 5000; maximumOriginalModelObjects: 16;
  sourceUTF16: 262144; sourceUTF8: 262144; identityCharacters: 48;
  maximumWidthRoleIds: 26; maximumExtrusionRoleIds: 269; maximumMaterialRoleIds: 208;
  maximumAuthoredUTF16: 2097152; maximumAuthoredUTF8: 2097152;
  maximumRequestUTF16: 2097152; maximumRequestUTF8: 2097152;
  maximumResultUTF16: 16777216; maximumResultUTF8: 16777216;
  maximumUpdateUTF16: 33554432; maximumUpdateUTF8: 33554432;
  ownValues: 4194304; updateOwnValues: 8388608; ownDepth: 64;
  arrayElements: 8192; recordFields: 64; keyCharacters: 128; stringCharacters: 262144;
  authoredParserDepth: 12; authoredParserValues: 65536; authoredParserRecordFields: 16;
  authoredParserStringCharacters: 262144;
  maximumSizeSettlePasses: 8;
  widthRequestUTF16: 1048576; widthRequestUTF8: 1048576;
  widthResultUTF16: 2097152; widthResultUTF8: 2097152;
  extrusionRequestUTF16: 2097152; extrusionRequestUTF8: 2097152;
  extrusionResultUTF16: 4194304; extrusionResultUTF8: 4194304;
  materialRequestUTF16: 4194304; materialRequestUTF8: 4194304;
  materialResultUTF16: 8388608; materialResultUTF8: 8388608;
};
export interface SourceLineWidthMaterialBodyGraphTransactionReport {
  schema: 'barocss-source-line-width-material-body-graph-transaction'; version: 0;
  graphId: string; previousRevision: number; revision: number; noOp: boolean;
  changedParameterIds: string[]; widthChanged: boolean; heightChanged: boolean;
  suppressionChanged: boolean; resumed: boolean;
  widthAction: 'rebuilt' | 'retained'; extrusionAction: 'rebuilt' | 'retained' | 'suppressed';
  materialAction: 'rebuilt' | 'retained' | 'suppressed';
  sourceEffectChanged: boolean; extrusionRequestChanged: boolean; materialRequestChanged: boolean;
  directCounts: OperationCounts; changedProviderCounts: ChangedProviderCounts;
  validationCounts: { previousGraphRebuildCount: 1; directCounts: OperationCounts;
    providers: RetainedProviderCounts };
  fileSizes: { update: Size }; ownValues: number;
  atomic: true; unchangedNativeReceiptsCopied: true;
  workScope: 'actual-selective-work-with-prior-cold-validation-reported-separately';
}
export interface SourceLineWidthMaterialBodyGraphTransaction { // EXACT2; no recursive previous Result
  request: { previousDocument: SourceLineWidthMaterialBodyGraphV0;
    options: SourceLineWidthMaterialBodyGraphOptions; edits: SourceLineWidthMaterialBodyGraphEdits };
  report: SourceLineWidthMaterialBodyGraphTransactionReport;
}
export interface SourceLineWidthMaterialBodyGraphUpdateResult { // EXACT2
  result: SourceLineWidthMaterialBodyGraphResult; transaction: SourceLineWidthMaterialBodyGraphTransaction;
}

export const SourceLineWidthMaterialBodyGraphDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', REFERENCE: 'REFERENCE',
  REVISION: 'REVISION', PARAMETER: 'PARAMETER', PROFILE: 'PROFILE', BUDGET: 'BUDGET',
  SOURCE: 'SOURCE', WIDTH: 'WIDTH', EXTRUSION: 'EXTRUSION', MATERIAL: 'MATERIAL',
  BINDING: 'BINDING', OWNED: 'OWNED', CODEC: 'CODEC', FILE: 'FILE',
} as const);
type DiagnosticCode = typeof SourceLineWidthMaterialBodyGraphDiagnosticCode[keyof typeof SourceLineWidthMaterialBodyGraphDiagnosticCode];
type ErrorContext = {
  stage: 'input' | 'width' | 'extrusion' | 'material' | 'update' | 'owned' | 'codec' | 'file';
  graphId: string | null; nodeId: string | null; revision: number | null;
  directCounts: OperationCounts;
};
export class SourceLineWidthMaterialBodyGraphError extends Error {
  readonly code: DiagnosticCode;
  readonly context: ErrorContext;
  constructor(code: DiagnosticCode, detail: string, state: ErrorContext, cause?: unknown) {
    super(('Source Line width material Body graph: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'SourceLineWidthMaterialBodyGraphError';
    this.code = code;
    this.context = { ...state, directCounts: { ...state.directCounts } };
  }
}

const CODE = SourceLineWidthMaterialBodyGraphDiagnosticCode;
const AUTHORED_LIMIT = 2097152, CURRENT_LIMIT = 16777216, UPDATE_LIMIT = 33554432;
function counts(): OperationCounts {
  return { widthBuildCallCount: 0, extrusionBuildCallCount: 0, materialBuildCallCount: 0, producerEvaluationCount: 0,
    rootSourceCompilationCount: 0, rootCurveD0Count: 0, rootCurveD1AttemptCount: 0,
    rootSurfaceD0Count: 0, rootSurfaceD1AttemptCount: 0, rootRationalOperationCount: 0, oldGraphCallCount: 0 };
}
function context(): ErrorContext {
  return { stage: 'input', graphId: null, nodeId: null, revision: null, directCounts: counts() };
}
function fail(state: ErrorContext, code: DiagnosticCode, detail: string, cause?: unknown): never {
  throw new SourceLineWidthMaterialBodyGraphError(code, detail, state, cause);
}
function check(state: ErrorContext, value: boolean, code: DiagnosticCode, detail: string): asserts value {
  if (!value) fail(state, code, detail);
}
function record(state: ErrorContext, value: unknown, fields: string[], code: DiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(state, value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(state, Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'Exact own fields are required');
  return data;
}
function snapshot(state: ErrorContext, input: unknown, owned = false, update = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT, budget = owned ? CODE.OWNED : CODE.BUDGET;
  let remaining = update ? 8388608 : 4194304;
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
function id(state: ErrorContext, value: unknown, maximum = 48): asserts value is string {
  check(state, typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'A bounded supported ASCII identity is required');
}
function revision(state: ErrorContext, value: unknown): asserts value is number {
  check(state, typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1000000000,
    CODE.REVISION, 'Revision must be an integer in0..1e9');
}
function length(state: ErrorContext, value: unknown): asserts value is number {
  check(state, typeof value === 'number' && Number.isFinite(value) && value >= 0.000001 && value <= 10000,
    CODE.PARAMETER, 'Literal length parameters must be finite mm values in1e-6..10000');
}
function size(state: ErrorContext, value: string, limit = 262144): Size {
  const measured = { utf16: value.length, utf8: new TextEncoder().encode(value).length };
  check(state, measured.utf16 <= limit && measured.utf8 <= limit, CODE.BUDGET, 'Complete source exceeds its UTF16 or UTF8 cap');
  return measured;
}
function json(state: ErrorContext, input: unknown, limit: number, retain = false): { text: string; size: Size } {
  let utf16 = 0, utf8 = 0;
  const parts: string[] = [], encoder = new TextEncoder();
  const append = (text: string): void => {
    utf16 += text.length; utf8 += encoder.encode(text).length;
    check(state, utf16 <= limit && utf8 <= limit, CODE.FILE, 'Complete JSON exceeds its full UTF16 or UTF8 envelope');
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
  return { text: retain ? parts.join('') : '', size: { utf16, utf8 } };
}
function ownValues(state: ErrorContext, input: unknown, update = false): number {
  // Callers supply already snapshotted or internally generated plain data.
  let count = 0;
  const visit = (value: unknown, depth: number): void => {
    check(state, ++count <= (update ? 8388608 : 4194304) && depth <= 64, CODE.BUDGET,
      'Complete retained own-value/depth cap exceeded');
    if (value !== null && typeof value === 'object') Object.values(value).forEach(item => visit(item, depth + 1));
  };
  visit(input, 0); return count;
}
function materialOptions(state: ErrorContext, input: unknown): RectangularFaceExtrusionBodyOptions {
  const data = record(state, input, ['evaluationId', 'resultIdPrefix', 'lowerSupport', 'upperSupport',
    'recipe', 'maximumParents', 'maximumSupports', 'maximumProducerCalls']);
  id(state, data.evaluationId); id(state, data.resultIdPrefix, 12);
  check(state, data.maximumParents === 1 && data.maximumSupports === 2 && data.maximumProducerCalls === 13,
    CODE.BUDGET, 'Complete fixed material budgets1/2/13 are required');
  for (const side of ['lowerSupport', 'upperSupport']) {
    const support = record(state, data[side], ['sourceId', 'surfaceId', 'bottomCurveId', 'extendedCurveId']);
    Object.values(support).forEach(value => id(state, value));
  }
  const recipe = record(state, data.recipe, ['lowerSection', 'upperSection', 'lowerBinding', 'upperBinding',
    'lowerWall', 'upperWall', 'cap', 'base', 'ends', 'volume', 'body']);
  const admit = (value: unknown, fields: string[], caps: Record<string, number>): void => {
    const r = record(state, value, fields);
    for (const [field, expected] of Object.entries(caps)) check(state, r[field] === expected,
      CODE.BUDGET, 'Complete fixed native material recipe budget required: ' + field);
    for (const field of fields) if (!Object.hasOwn(caps, field) && field !== 'orientation') {
      id(state, r[field], field === 'resultIdPrefix' ? 12 : 48);
    }
  };
  for (const side of ['lowerSection', 'upperSection']) admit(recipe[side],
    ['evaluationId', 'curveId', 'surfacePcurveId', 'planePcurveId', 'maximumObservations'], { maximumObservations: 17 });
  for (const side of ['lowerBinding', 'upperBinding']) admit(recipe[side],
    ['evaluationId', 'pcurveId', 'maximumObservations'], { maximumObservations: 17 });
  for (const side of ['lowerWall', 'upperWall']) admit(recipe[side],
    ['evaluationId', 'resultIdPrefix', 'orientation', 'maximumObservations'], { maximumObservations: 40 });
  check(state, (recipe.lowerWall as { orientation: unknown }).orientation === 'forward' &&
    (recipe.upperWall as { orientation: unknown }).orientation === 'reverse', CODE.PROFILE,
  'Canonical lower-forward/upper-reverse material walls are required');
  admit(recipe.cap, ['evaluationId', 'resultIdPrefix', 'maximumSections', 'maximumConnectors', 'maximumObservations'],
    { maximumSections: 2, maximumConnectors: 2, maximumObservations: 40 });
  admit(recipe.base, ['evaluationId', 'resultIdPrefix', 'baseLeftCurveId', 'baseRightCurveId', 'maximumParents', 'maximumObservations'],
    { maximumParents: 2, maximumObservations: 40 });
  admit(recipe.ends, ['evaluationId', 'resultIdPrefix', 'baseLeftCurveId', 'baseRightCurveId', 'maximumParents', 'maximumObservations'],
    { maximumParents: 3, maximumObservations: 24 });
  admit(recipe.volume, ['evaluationId', 'maximumParents', 'maximumObservations'], { maximumParents: 3, maximumObservations: 17 });
  admit(recipe.body, ['evaluationId', 'resultIdPrefix', 'maximumParents', 'maximumModels', 'maximumObservations'],
    { maximumParents: 3, maximumModels: 2, maximumObservations: 24 });
  const options = data as unknown as RectangularFaceExtrusionBodyOptions;
  check(state, options.recipe.body.evaluationId !== 'profile', CODE.IDENTITY,
    'Body evaluation identity collides with its inevitable section World Model namespace');
  check(state, options.recipe.base.baseLeftCurveId === options.recipe.ends.baseLeftCurveId &&
    options.recipe.base.baseRightCurveId === options.recipe.ends.baseRightCurveId,
  CODE.IDENTITY, 'Actual material base/end Line identity aliases must agree');
  return options;
}
function admit(state: ErrorContext, docInput: unknown, optionsInput: unknown): Request {
  const doc = record(state, docInput, ['format', 'version', 'id', 'revision', 'lengthUnit', 'sourceFrame',
    'asset', 'parameters', 'nodes']);
  check(state, doc.format === 'barocss-source-line-width-material-body-graph' && Object.is(doc.version, 0),
    CODE.VERSION, 'Exact independent material graph format and positive-zero version0 required');
  id(state, doc.id); revision(state, doc.revision);
  state.graphId = doc.id; state.revision = doc.revision;
  check(state, doc.lengthUnit === 'mm' && doc.sourceFrame === 'authored-xyz-no-axis-conversion',
    CODE.PARAMETER, 'Literal mm and raw authored XYZ frame required');
  const opts = record(state, optionsInput, ['maximumFeatureNodes', 'maximumWidthEvaluations',
    'maximumExtrusionEvaluations', 'maximumMaterialEvaluations', 'maximumProducerEvaluations']);
  check(state, opts.maximumFeatureNodes === 3 && opts.maximumWidthEvaluations === 1 &&
    opts.maximumExtrusionEvaluations === 1 && opts.maximumMaterialEvaluations === 1 &&
    opts.maximumProducerEvaluations === 3, CODE.BUDGET, 'Fixed feature budgets3/1/1/1/3 required');
  const asset = record(state, doc.asset, ['sourceId', 'sourceVersion', 'source', 'curveId']);
  id(state, asset.sourceId); id(state, asset.curveId);
  check(state, Object.is(asset.sourceVersion, 0), CODE.VERSION, 'Literal Source0 required');
  check(state, typeof asset.source === 'string', CODE.INPUT, 'Complete original source string required');
  size(state, asset.source);
  check(state, Array.isArray(doc.parameters) && doc.parameters.length === 2 &&
    Array.isArray(doc.nodes) && doc.nodes.length === 3, CODE.INPUT,
  'Fixed width,height parameters and width,extrusion,material nodes required');
  const parameters = doc.parameters.map(value => record(state, value, ['id', 'kind', 'unit', 'valueMM']));
  for (const parameter of parameters) {
    id(state, parameter.id); length(state, parameter.valueMM);
    check(state, parameter.kind === 'length' && parameter.unit === 'mm', CODE.PARAMETER,
      'Both parameters must retain literal length/mm records');
  }
  check(state, (parameters[1].valueMM as number) <= 5000, CODE.PARAMETER,
    'Height no greater than5000mm is required even when suppressed');
  const w = record(state, doc.nodes[0], ['id', 'kind', 'sourceId', 'widthParameterId', 'options']);
  const e = record(state, doc.nodes[1], ['id', 'kind', 'faceNodeId', 'heightParameterId', 'suppressed', 'options']);
  const m = record(state, doc.nodes[2], ['id', 'kind', 'extrusionNodeId', 'options']);
  id(state, w.id); id(state, e.id); id(state, m.id);
  check(state, w.kind === 'source-line-width-face' && e.kind === 'convex-planar-face-extrusion' &&
    m.kind === 'rectangular-face-extrusion-body', CODE.REFERENCE, 'Fixed ordered native feature kinds required');
  check(state, w.sourceId === asset.sourceId && w.widthParameterId === parameters[0].id &&
    e.faceNodeId === w.id && e.heightParameterId === parameters[1].id && m.extrusionNodeId === e.id,
  CODE.REFERENCE, 'Explicit source/parameter/predecessor references must resolve fixed objects');
  check(state, new Set([doc.id, asset.sourceId, parameters[0].id, parameters[1].id, w.id, e.id, m.id]).size === 7,
    CODE.IDENTITY, 'Logical graph/source/parameter/node namespace must be distinct');
  check(state, typeof e.suppressed === 'boolean', CODE.INPUT, 'Explicit coupled downstream suppression required');
  const width = record(state, w.options, ['lowerCurveId', 'upperCurveId', 'surfaceId', 'loopId', 'boundaryCurveIds', 'face']);
  for (const key of ['lowerCurveId', 'upperCurveId', 'surfaceId', 'loopId']) id(state, width[key]);
  check(state, Array.isArray(width.boundaryCurveIds) && width.boundaryCurveIds.length === 4, CODE.INPUT,
    'Four actual width boundary Curve IDs required');
  width.boundaryCurveIds.forEach(value => id(state, value));
  const face = record(state, width.face, ['faceId', 'evaluationId', 'resultIdPrefix', 'orientation']);
  id(state, face.faceId); id(state, face.evaluationId); id(state, face.resultIdPrefix, 20);
  check(state, face.orientation === 'forward', CODE.PROFILE, 'Only forward width Faces supported');
  const extrusion = record(state, e.options, ['evaluationId', 'resultIdPrefix', 'direction']);
  id(state, extrusion.evaluationId); id(state, extrusion.resultIdPrefix, 5);
  check(state, extrusion.direction === 'positive-z', CODE.PROFILE, 'Explicit positive-Z extrusion required');
  materialOptions(state, m.options);
  const document = doc as unknown as SourceLineWidthMaterialBodyGraphV0;
  const planned = { width: widthIds(document.nodes[0].options), extrusion: extrusionIds(document.nodes[1]),
    material: materialIds(document.nodes[2].options) };
  check(state, planned.width.length === 26 && planned.extrusion.length === 269 && planned.material.length === 208,
    CODE.IDENTITY, 'Exact planned26/269/208 role inventories required');
  const roles = [...planned.width, ...planned.extrusion, ...planned.material];
  roles.forEach(value => id(state, value));
  check(state, new Set(roles).size === roles.length, CODE.IDENTITY,
    'Unrelated planned native roles cannot collide even when suppressed');
  const options = opts as unknown as SourceLineWidthMaterialBodyGraphOptions;
  json(state, document, AUTHORED_LIMIT); json(state, { document, options }, AUTHORED_LIMIT);
  return { document, options };
}
function widthIds(options: SourceLineWidthFaceOptions): string[] {
  const p = options.face.resultIdPrefix;
  return [options.lowerCurveId, options.upperCurveId, options.surfaceId, options.loopId,
    options.face.faceId, options.face.evaluationId, ...options.boundaryCurveIds,
    ...Array.from({ length: 4 }, (_, i) => [p + '_v_' + i, p + '_e_' + i, p + '_use_' + i, p + '_uv_' + i]).flat()];
}
function extrusionIds(node: ExtrusionNode): string[] {
  const p = node.options.resultIdPrefix, roles = [p + '_s_b', p + '_s_t'];
  for (let i = 0; i < 4; i++) roles.push(p + '_c_t_' + i, p + '_s_w_' + i);
  for (let a = 0; a < 6; a++) {
    roles.push(p + '_f_' + a, p + '_l_' + a, p + '_src_' + a);
    for (let i = 0; i < 4; i++) roles.push(p + '_v_' + a + '_' + i, p + '_e_' + a + '_' + i, p + '_c_' + a + '_' + i);
  }
  roles.push(node.options.evaluationId);
  for (let i = 0; i < 12; i++) roles.push(p + '_e' + i);
  for (let i = 0; i < 24; i++) roles.push(p + '_v' + i);
  for (let pair = 0; pair < 12; pair++) {
    const child = p + '_' + pair;
    roles.push(child, child + '_e0', child + '_r0');
    for (let i = 0; i < 8; i++) roles.push(child + '_v' + i);
  }
  return roles;
}

function materialIds(options: RectangularFaceExtrusionBodyOptions): string[] {
  const reservedIds: string[] = [];
  const reserve = (value: string): void => {
    reservedIds.push(value);
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
  return reservedIds;
}

function plannedRoles(state: ErrorContext, doc: SourceLineWidthMaterialBodyGraphV0,
  width: SourceLineWidthFaceResult): Bindings['plannedRoleIds'] {
  const face = width.face;
  const occupied = new Set([width.originalCurve.id, ...width.originalModel.objects.map(object => object.id),
    ...widthIds(doc.nodes[0].options), face.loop.id, face.plane.id, face.topology.face.id,
    face.options.evaluationId, ...face.model.objects.map(object => object.id),
    ...face.topology.vertices.map(vertex => vertex.id), ...face.topology.edges.map(edge => edge.id),
    ...face.topology.loop.uses.map(use => use.id), ...face.pcurves.map(pcurve => pcurve.id),
    'parametric_face', 'curve_reverse_original']);
  state.stage = 'extrusion'; state.nodeId = doc.nodes[1].id;
  const extrusion = extrusionIds(doc.nodes[1]);
  check(state, extrusion.every(value => !occupied.has(value)), CODE.IDENTITY,
    'Planned extrusion roles must avoid every original sibling and actual width context even suppressed');
  extrusion.forEach(value => occupied.add(value));
  state.stage = 'material'; state.nodeId = doc.nodes[2].id;
  const material = materialIds(doc.nodes[2].options);
  check(state, material.every(value => !occupied.has(value)), CODE.IDENTITY,
    'Planned material roles must avoid all original/width/extrusion contexts even suppressed');
  return { width: widthIds(doc.nodes[0].options), extrusion, material };
}
function widthRequest(doc: SourceLineWidthMaterialBodyGraphV0): SourceLineWidthFaceResult['request'] {
  return { source: doc.asset.source, sourceVersion: 0, curveId: doc.asset.curveId,
    widthMM: doc.parameters[0].valueMM, options: doc.nodes[0].options };
}
function extrusionOptions(doc: SourceLineWidthMaterialBodyGraphV0): ConvexPlanarFaceExtrusionResult['request']['options'] {
  return { ...doc.nodes[1].options, distanceMM: doc.parameters[1].valueMM };
}
function materialRequest(doc: SourceLineWidthMaterialBodyGraphV0,
  extrusion: ConvexPlanarFaceExtrusionResult): RectangularFaceExtrusionBodyResult['request'] {
  return { extrusion, options: doc.nodes[2].options };
}
function providerCounts(width: SourceLineWidthFaceResult | null, extrusion: ConvexPlanarFaceExtrusionResult | null,
  material: RectangularFaceExtrusionBodyResult | null): ChangedProviderCounts {
  return { width: width?.report.directCounts ?? null, extrusion: extrusion?.report.directCounts ?? null,
    shellChildren: extrusion?.report.shellChildDirectCounts ?? null,
    material: material?.report.directCounts ?? null, materialRational: material?.report.rationalCounts ?? null,
    qualifiedBody: material?.body.report.directCounts ?? null };
}
function prefix(state: ErrorContext, document: SourceLineWidthMaterialBodyGraphV0,
  options: SourceLineWidthMaterialBodyGraphOptions, width: SourceLineWidthFaceResult | null,
  extrusion: ConvexPlanarFaceExtrusionResult | null, material: RectangularFaceExtrusionBodyResult | null,
  extra: unknown = null): void {
  const previous = state.stage; state.stage = 'file';
  const full = { document, options, width, extrusion, material, extra };
  json(state, full, extra === null ? CURRENT_LIMIT : UPDATE_LIMIT);
  snapshot(state, full, false, extra !== null);
  state.stage = previous;
}
function buildWidth(state: ErrorContext, doc: SourceLineWidthMaterialBodyGraphV0): SourceLineWidthFaceResult {
  state.stage = 'width'; state.nodeId = doc.nodes[0].id;
  check(state, state.directCounts.widthBuildCallCount < 1 && state.directCounts.producerEvaluationCount < 3,
    CODE.BUDGET, 'Width/feature evaluation budget exhausted');
  state.directCounts.widthBuildCallCount++; state.directCounts.producerEvaluationCount++;
  try { return buildSourceLineWidthFace(widthRequest(doc)); }
  catch (cause) { fail(state, cause instanceof SourceLineWidthFaceError && cause.code === 'SOURCE' ? CODE.SOURCE : CODE.WIDTH,
    'Actual full original-source width Face construction refused', cause); }
}
function buildExtrusion(state: ErrorContext, doc: SourceLineWidthMaterialBodyGraphV0,
  width: SourceLineWidthFaceResult): ConvexPlanarFaceExtrusionResult {
  state.stage = 'extrusion'; state.nodeId = doc.nodes[1].id;
  check(state, state.directCounts.extrusionBuildCallCount < 1 && state.directCounts.producerEvaluationCount < 3,
    CODE.BUDGET, 'Extrusion/feature evaluation budget exhausted');
  state.directCounts.extrusionBuildCallCount++; state.directCounts.producerEvaluationCount++;
  try { return extrudeConvexPlanarFace(width.face, extrusionOptions(doc)); }
  catch (cause) { fail(state, CODE.EXTRUSION, 'Actual full dependent extrusion refused', cause); }
}
function buildMaterial(state: ErrorContext, doc: SourceLineWidthMaterialBodyGraphV0,
  extrusion: ConvexPlanarFaceExtrusionResult): RectangularFaceExtrusionBodyResult {
  state.stage = 'material'; state.nodeId = doc.nodes[2].id;
  check(state, state.directCounts.materialBuildCallCount < 1 && state.directCounts.producerEvaluationCount < 3,
    CODE.BUDGET, 'Material/feature evaluation budget exhausted');
  state.directCounts.materialBuildCallCount++; state.directCounts.producerEvaluationCount++;
  try { return qualifyRectangularFaceExtrusionBody(materialRequest(doc, extrusion)); }
  catch (cause) { fail(state, CODE.MATERIAL, 'Actual full material Body qualification refused', cause); }
}
function limits(): Limits {
  return { maximumFeatureNodes: 3, maximumParameters: 2, maximumWidthEvaluations: 1,
    maximumExtrusionEvaluations: 1, maximumMaterialEvaluations: 1, maximumProducerEvaluations: 3,
    maximumRevision: 1000000000, minimumLengthMM: 1e-6,
    maximumWidthMM: 10000, maximumHeightMM: 5000, maximumOriginalModelObjects: 16,
    sourceUTF16: 262144, sourceUTF8: 262144, identityCharacters: 48,
    maximumWidthRoleIds: 26, maximumExtrusionRoleIds: 269, maximumMaterialRoleIds: 208,
    maximumAuthoredUTF16: 2097152, maximumAuthoredUTF8: 2097152,
    maximumRequestUTF16: 2097152, maximumRequestUTF8: 2097152,
    maximumResultUTF16: 16777216, maximumResultUTF8: 16777216,
    maximumUpdateUTF16: 33554432, maximumUpdateUTF8: 33554432,
    ownValues: 4194304, updateOwnValues: 8388608, ownDepth: 64,
    arrayElements: 8192, recordFields: 64, keyCharacters: 128, stringCharacters: 262144,
    authoredParserDepth: 12, authoredParserValues: 65536, authoredParserRecordFields: 16,
    authoredParserStringCharacters: 262144, maximumSizeSettlePasses: 8,
    widthRequestUTF16: 1048576, widthRequestUTF8: 1048576,
    widthResultUTF16: 2097152, widthResultUTF8: 2097152,
    extrusionRequestUTF16: 2097152, extrusionRequestUTF8: 2097152,
    extrusionResultUTF16: 4194304, extrusionResultUTF8: 4194304,
    materialRequestUTF16: 4194304, materialRequestUTF8: 4194304,
    materialResultUTF16: 8388608, materialResultUTF8: 8388608 };
}
function assemble(state: ErrorContext, document: SourceLineWidthMaterialBodyGraphV0,
  options: SourceLineWidthMaterialBodyGraphOptions, width: SourceLineWidthFaceResult,
  extrusion: ConvexPlanarFaceExtrusionResult | null,
  material: RectangularFaceExtrusionBodyResult | null): SourceLineWidthMaterialBodyGraphResult {
  check(state, same(width.request, widthRequest(document)) && width.originalCurve.id === document.asset.curveId &&
    width.report.directCounts.producerDelegationCount === 7 && width.face.report.incidenceValid,
  CODE.BINDING, 'Complete width request/source/incidence receipt required');
  const active = !document.nodes[1].suppressed;
  check(state, active ? extrusion !== null && material !== null : extrusion === null && material === null,
    CODE.BINDING, 'Current coupled suppression must match both dependent receipt states');
  if (extrusion !== null) check(state, same(extrusion.request, { face: width.face, options: extrusionOptions(document) }) &&
    extrusion.report.directCounts.totalDelegationCount === 18 && extrusion.shell.pairResults.length === 12 &&
    extrusion.shell.graph.vertices.length === 8 && extrusion.shell.graph.edges.length === 12 &&
    extrusion.shell.graph.faces.length === 6 && extrusion.shell.graph.vertexLinks.length === 8 &&
    extrusion.report.quality.closed && !extrusion.report.quality.solid &&
    !extrusion.report.quality.embeddedManifoldCertified && !extrusion.report.quality.volumeCertified,
  CODE.BINDING, 'Full active extrusion must bind actual width Face and preserve abstract-only flags');
  if (material !== null) check(state, extrusion !== null &&
    same(material.request, materialRequest(document, extrusion)) &&
    material.report.directCounts.totalDelegationCount === 14 &&
    material.report.quality.parentFlagsUnchanged && !material.report.quality.parentShellPromoted &&
    material.body.body.restrictedSolidCertified && material.body.body.solid &&
    material.proof.exactOccupiedRegionEqual && material.body.proof.material.restrictedSolidCertified,
  CODE.BINDING, 'Full material receipt must bind the complete current extrusion and real material authority');
  const w = document.nodes[0], e = document.nodes[1], m = document.nodes[2];
  const dependencies: Bindings['dependencies'] = [
    { nodeId: w.id, dependencyNodeIds: [], sourceIds: [document.asset.sourceId], parameterIds: [document.parameters[0].id] },
    { nodeId: e.id, dependencyNodeIds: [w.id], sourceIds: [], parameterIds: [document.parameters[1].id] },
    { nodeId: m.id, dependencyNodeIds: [e.id], sourceIds: [], parameterIds: [] },
  ];
  const bindings: Bindings = {
    graphId: document.id, revision: document.revision,
    parameters: [
      { index: 0, parameterId: document.parameters[0].id, kind: 'length', unit: 'mm',
        valueMM: document.parameters[0].valueMM, nodeId: w.id, role: 'width' },
      { index: 1, parameterId: document.parameters[1].id, kind: 'length', unit: 'mm',
        valueMM: document.parameters[1].valueMM, nodeId: e.id, role: 'height' },
    ],
    sources: {
      original: { context: 'original', authoredSourceId: document.asset.sourceId,
        sourceField: 'document.asset.source', modelField: 'width.originalModel',
        modelName: width.originalModel.name, sourceVersion: 0 },
      ruled: { context: 'ruled', authoredSourceId: null, sourceField: 'width.ruled.source',
        modelField: 'width.ruled.model', modelName: width.ruled.model.name, sourceVersion: 0 },
      face: { context: 'face', authoredSourceId: null, sourceField: 'width.face.source',
        modelField: 'width.face.model', modelName: width.face.model.name, sourceVersion: 0 },
    },
    width: { nodeId: w.id, sourceId: document.asset.sourceId, widthParameterId: w.widthParameterId,
      curveId: width.originalCurve.id, modelName: width.originalModel.name,
      selectedObjectIndex: width.report.selectedObjectIndex, faceId: width.face.topology.face.id,
      provider: width.bindings },
    extrusion: { nodeId: e.id, inputNodeId: w.id, heightParameterId: e.heightParameterId,
      status: active ? 'active' : 'suppressed', evaluationId: e.options.evaluationId,
      shellId: extrusion?.shell.options.shellId ?? null, inputFaceId: width.face.topology.face.id,
      provider: extrusion?.bindings ?? null },
    material: { nodeId: m.id, inputNodeId: e.id, status: active ? 'active' : 'suppressed',
      evaluationId: m.options.evaluationId, inputShellId: extrusion?.shell.options.shellId ?? null,
      bodyId: material?.body.body.id ?? null, shellId: material?.body.shell.id ?? null,
      materialCertificateId: material?.body.body.materialCertificateId ?? null, provider: material?.bindings ?? null },
    dependencies, plannedRoleIds: plannedRoles(state, document, width),
    authority: 'complete-original-source-and-three-literal-mm-feature-recipes',
  };
  const report: SourceLineWidthMaterialBodyGraphReport = {
    schema: 'barocss-source-line-width-material-body-graph-report', version: 0,
    graphId: document.id, revision: document.revision, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    sourceId: document.asset.sourceId, originalModelName: width.originalModel.name,
    originalCurveId: width.originalCurve.id, selectedObjectIndex: width.report.selectedObjectIndex,
    nodeOrder: [w.id, e.id, m.id], parameterOrder: [document.parameters[0].id, document.parameters[1].id],
    dependencies, widthMM: document.parameters[0].valueMM, heightMM: document.parameters[1].valueMM,
    extrusionStatus: active ? 'active' : 'suppressed', materialStatus: active ? 'active' : 'suppressed',
    faceId: width.face.topology.face.id, parentShellId: extrusion?.shell.options.shellId ?? null,
    bodyId: material?.body.body.id ?? null, materialShellId: material?.body.shell.id ?? null,
    materialCertificateId: material?.body.body.materialCertificateId ?? null,
    exactVolumeMM3: material?.report.exactVolumeMM3 ?? null, volumeMM3: material?.report.volumeMM3 ?? null,
    conversionError: material?.report.conversionError ?? null,
    receiptCounts: { widthReceiptCount: 1, extrusionReceiptCount: active ? 1 : 0,
      materialReceiptCount: active ? 1 : 0, featureReceiptCount: active ? 3 : 1 },
    retainedProviderCounts: providerCounts(width, extrusion, material) as RetainedProviderCounts,
    sourceSizes: { original: size(state, document.asset.source), ruled: size(state, width.ruled.source),
      face: size(state, width.face.source) },
    fileSizes: { authored: json(state, document, AUTHORED_LIMIT).size,
      request: json(state, { document, options }, AUTHORED_LIMIT).size, result: { utf16: 0, utf8: 0 } }, ownValues: 0,
    authority: 'complete-original-source-and-three-literal-mm-feature-recipes',
    reconstruction: 'whole-current-document-and-options-no-operation-history',
    workScope: 'retained-receipts-not-selective-constructor-call-counts',
    numericPolicy: { parameters: 'literal-finite-mm-values-not-source-expression-lowering',
      suppression: 'extrusion-and-material-suppressed-together-width-always-active',
      identity: 'qualified-source-contexts-and-explicit-current-recipe-roles',
      orientation: 'forward-natural-xy-positive-z-canonical-overshoot-material',
      comparison: 'object-is-semantic-values-and-complete-native-request-bits',
      noOp: 'new-revision-with-zero-changed-producer-calls',
      codec: 'small-authored-document-only-literal-negative-zero-and-one-newline' },
    quality: { completeOriginalSourceRetained: true, unrelatedOriginalGeometryPreserved: true,
      originalSelectedCurveBitsPreserved: true, sourceQualifiedBindings: true,
      fullWidthReceiptRetained: true, fullExtrusionReceiptWhenActive: true, fullMaterialReceiptWhenActive: true,
      parentFlagsUnchanged: true, affectedOnlyUpdates: true, ownedRebuild: true, faceIncidenceValid: true,
      closedAbstractShellProduced: active, freshRestrictedSolidProduced: active,
      sourceDefinedOccupiedRegion: active, wholeBoundaryImage: active, outwardMaterial: active,
      embeddedMaterialBody: active, geometricValidity: 'restricted-material-certified-when-active',
      genericSolid: false, genericBoolean: false, sourceExpressions: false, sourcePoleSubstitution: false,
      generalFeatureGraph: false, generalPersistentNaming: false, globalBinary64ErrorCertified: false,
      manufacturingToleranceCertified: false, editorDisplayCertified: false, publication: false,
      ownership: 'independent-copied-cpu-data-gc' },
    limits: limits(), budgetFailure: 'atomic-no-partial-width-extrusion-material-graph',
  };
  const result: SourceLineWidthMaterialBodyGraphResult = { document, options, width, extrusion, material, bindings, report };
  state.stage = 'file'; state.nodeId = null;
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const count = ownValues(state, result), measured = json(state, result, CURRENT_LIMIT).size;
    if (report.ownValues === count && same(measured, report.fileSizes.result)) { settled = true; break; }
    report.ownValues = count; report.fileSizes.result = measured;
  }
  check(state, settled && report.ownValues === ownValues(state, result) &&
    same(json(state, result, CURRENT_LIMIT).size, report.fileSizes.result), CODE.FILE,
  'Whole current file/own measurements must settle in8 passes');
  return snapshot(state, result) as SourceLineWidthMaterialBodyGraphResult;
}
function evaluate(state: ErrorContext, docInput: unknown, optionsInput: unknown): SourceLineWidthMaterialBodyGraphResult {
  const data = record(state, snapshot(state, { document: docInput, options: optionsInput }), ['document', 'options']);
  const { document, options } = admit(state, data.document, data.options);
  prefix(state, document, options, null, null, null);
  const width = buildWidth(state, document);
  prefix(state, document, options, width, null, null);
  plannedRoles(state, document, width);
  prefix(state, document, options, width, null, null);
  const extrusion = document.nodes[1].suppressed ? null : buildExtrusion(state, document, width);
  prefix(state, document, options, width, extrusion, null);
  const material = extrusion === null ? null : buildMaterial(state, document, extrusion);
  prefix(state, document, options, width, extrusion, material);
  return assemble(state, document, options, width, extrusion, material);
}
/** Evaluate a complete independent three-node literal Source0 feature graph. */
export function evaluateSourceLineWidthMaterialBodyGraph(document: SourceLineWidthMaterialBodyGraphV0,
  options: SourceLineWidthMaterialBodyGraphOptions): SourceLineWidthMaterialBodyGraphResult {
  return evaluate(context(), document, options);
}
function rebuild(state: ErrorContext, value: unknown): SourceLineWidthMaterialBodyGraphResult {
  try {
    const owned = record(state, snapshot(state, value, true), ['document', 'options', 'width', 'extrusion', 'material',
      'bindings', 'report'], CODE.OWNED) as unknown as SourceLineWidthMaterialBodyGraphResult;
    json(state, owned, CURRENT_LIMIT);
    const expected = evaluate(state, owned.document, owned.options);
    state.stage = 'owned'; state.nodeId = null;
    check(state, same(owned, expected), CODE.OWNED,
      'Complete document/native receipts/material proofs/references/counts/sizes differ from one reconstruction');
    return expected;
  } catch (cause) {
    if (cause instanceof SourceLineWidthMaterialBodyGraphError && cause.code === CODE.OWNED) throw cause;
    const failed = cause instanceof SourceLineWidthMaterialBodyGraphError ? cause.context : state;
    throw new SourceLineWidthMaterialBodyGraphError(CODE.OWNED, 'Whole current material graph reconstruction refused',
      { ...failed, stage: 'owned' }, cause);
  }
}
/** One complete current reconstruction; no redundant independent provider validation. */
export function validateSourceLineWidthMaterialBodyGraph(value: unknown): SourceLineWidthMaterialBodyGraphReport {
  const state = context(); state.stage = 'owned';
  return snapshot(state, rebuild(state, value).report, true) as SourceLineWidthMaterialBodyGraphReport;
}
function updateEdits(state: ErrorContext, input: unknown,
  previous: SourceLineWidthMaterialBodyGraphV0): SourceLineWidthMaterialBodyGraphEdits {
  const data = record(state, snapshot(state, input), ['expectedRevision', 'revision', 'parameterEdits', 'extrusionSuppressed']);
  revision(state, data.expectedRevision); revision(state, data.revision);
  check(state, data.expectedRevision === previous.revision && data.revision === previous.revision + 1,
    CODE.REVISION, 'Expected current revision and exact previous+1 are required');
  check(state, Array.isArray(data.parameterEdits) && data.parameterEdits.length <= 2,
    CODE.BUDGET, 'At most two unique existing parameter setters are supported');
  check(state, data.extrusionSuppressed === null || typeof data.extrusionSuppressed === 'boolean',
    CODE.INPUT, 'Explicit dependent suppression boolean or null is required');
  const requested = new Set<string>();
  for (const value of data.parameterEdits) {
    const edit = record(state, value, ['parameterId', 'valueMM']);
    id(state, edit.parameterId); length(state, edit.valueMM);
    check(state, !requested.has(edit.parameterId), CODE.IDENTITY, 'Duplicate parameter setters are refused');
    check(state, previous.parameters.some(parameter => parameter.id === edit.parameterId), CODE.REFERENCE,
      'Only the two existing literal-mm parameters may be changed');
    requested.add(edit.parameterId);
  }
  return data as unknown as SourceLineWidthMaterialBodyGraphEdits;
}
/** Selective replay consumes one actual cold-qualified previous state, never validates it again. */
function applyUpdate(previous: SourceLineWidthMaterialBodyGraphResult,
  editsInput: SourceLineWidthMaterialBodyGraphEdits, validation: OperationCounts): SourceLineWidthMaterialBodyGraphUpdateResult {
  const state = context(); state.stage = 'update'; state.graphId = previous.document.id;
  state.revision = previous.document.revision;
  const edits = updateEdits(state, editsInput, previous.document);
  const document = snapshot(state, previous.document) as SourceLineWidthMaterialBodyGraphV0;
  document.revision = edits.revision;
  for (const edit of edits.parameterEdits) document.parameters.find(value => value.id === edit.parameterId)!.valueMM = edit.valueMM;
  if (edits.extrusionSuppressed !== null) document.nodes[1].suppressed = edits.extrusionSuppressed;
  admit(state, document, previous.options);
  const widthChanged = !Object.is(document.parameters[0].valueMM, previous.document.parameters[0].valueMM);
  const heightChanged = !Object.is(document.parameters[1].valueMM, previous.document.parameters[1].valueMM);
  const suppressionChanged = document.nodes[1].suppressed !== previous.document.nodes[1].suppressed;
  const resumed = previous.document.nodes[1].suppressed && !document.nodes[1].suppressed;
  const request = { previousDocument: previous.document, options: previous.options, edits };
  let width = previous.width, extrusion = previous.extrusion, material = previous.material;
  prefix(state, document, previous.options, width, extrusion, material, request);
  if (widthChanged) {
    width = buildWidth(state, document);
    prefix(state, document, previous.options, width, extrusion, material, request);
  }
  plannedRoles(state, document, width);
  const sourceEffectChanged = !same(width.face, previous.width.face);
  const nextExtrusionRequest = document.nodes[1].suppressed ? null : { face: width.face, options: extrusionOptions(document) };
  const extrusionRequestChanged = !same(nextExtrusionRequest, previous.extrusion?.request ?? null);
  const extrusionRebuilt = nextExtrusionRequest !== null && (extrusionRequestChanged || resumed);
  if (document.nodes[1].suppressed) extrusion = null;
  else if (extrusionRebuilt) {
    prefix(state, document, previous.options, width, extrusion, material, request);
    extrusion = buildExtrusion(state, document, width);
  } else check(state, extrusion !== null && same(extrusion.request, nextExtrusionRequest), CODE.BINDING,
    'Retained active extrusion must match the complete actual current request');
  prefix(state, document, previous.options, width, extrusion, material, request);
  const nextMaterialRequest = extrusion === null ? null : materialRequest(document, extrusion);
  const materialRequestChanged = !same(nextMaterialRequest, previous.material?.request ?? null);
  const materialRebuilt = nextMaterialRequest !== null && (materialRequestChanged || resumed);
  if (nextMaterialRequest === null) material = null;
  else if (materialRebuilt) {
    prefix(state, document, previous.options, width, extrusion, material, request);
    material = buildMaterial(state, document, nextMaterialRequest.extrusion);
  } else check(state, material !== null && same(material.request, nextMaterialRequest), CODE.BINDING,
    'Retained active material must match the complete actual current extrusion/options request');
  prefix(state, document, previous.options, width, extrusion, material, request);
  const result = assemble(state, document, previous.options, width, extrusion, material);
  const report: SourceLineWidthMaterialBodyGraphTransactionReport = {
    schema: 'barocss-source-line-width-material-body-graph-transaction', version: 0,
    graphId: document.id, previousRevision: previous.document.revision, revision: document.revision,
    noOp: !widthChanged && !heightChanged && !suppressionChanged,
    changedParameterIds: document.parameters.filter((value, index) =>
      !Object.is(value.valueMM, previous.document.parameters[index].valueMM)).map(value => value.id),
    widthChanged, heightChanged, suppressionChanged, resumed,
    widthAction: widthChanged ? 'rebuilt' : 'retained',
    extrusionAction: document.nodes[1].suppressed ? 'suppressed' : extrusionRebuilt ? 'rebuilt' : 'retained',
    materialAction: document.nodes[1].suppressed ? 'suppressed' : materialRebuilt ? 'rebuilt' : 'retained',
    sourceEffectChanged, extrusionRequestChanged, materialRequestChanged,
    directCounts: { ...state.directCounts },
    changedProviderCounts: providerCounts(widthChanged ? width : null,
      extrusionRebuilt ? extrusion : null, materialRebuilt ? material : null),
    validationCounts: { previousGraphRebuildCount: 1, directCounts: { ...validation },
      providers: previous.report.retainedProviderCounts },
    fileSizes: { update: { utf16: 0, utf8: 0 } }, ownValues: 0,
    atomic: true, unchangedNativeReceiptsCopied: true,
    workScope: 'actual-selective-work-with-prior-cold-validation-reported-separately',
  };
  const update: SourceLineWidthMaterialBodyGraphUpdateResult = { result, transaction: { request, report } };
  state.stage = 'file'; state.nodeId = null;
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const count = ownValues(state, update, true), measured = json(state, update, UPDATE_LIMIT).size;
    if (count === report.ownValues && same(measured, report.fileSizes.update)) { settled = true; break; }
    report.ownValues = count; report.fileSizes.update = measured;
  }
  check(state, settled && report.ownValues === ownValues(state, update, true) &&
    same(json(state, update, UPDATE_LIMIT).size, report.fileSizes.update), CODE.FILE,
  'Complete update file/own measurements must settle in8 passes');
  return snapshot(state, update, false, true) as SourceLineWidthMaterialBodyGraphUpdateResult;
}
/** Reconstruct and compare the previous current graph once, then run only affected features. */
export function updateSourceLineWidthMaterialBodyGraph(previousInput: SourceLineWidthMaterialBodyGraphResult,
  editsInput: SourceLineWidthMaterialBodyGraphEdits): SourceLineWidthMaterialBodyGraphUpdateResult {
  const state = context(); state.stage = 'owned';
  const request = record(state, snapshot(state, { previous: previousInput, edits: editsInput }, false, true), ['previous', 'edits']);
  json(state, request, UPDATE_LIMIT);
  const previous = rebuild(state, request.previous);
  return applyUpdate(previous, request.edits as SourceLineWidthMaterialBodyGraphEdits, { ...state.directCounts });
}
/** Cold-evaluate only the nonrecursive authored baseline and privately replay one selective update. */
export function validateSourceLineWidthMaterialBodyGraphUpdate(value: unknown): SourceLineWidthMaterialBodyGraphTransactionReport {
  const state = context(); state.stage = 'owned';
  try {
    const owned = record(state, snapshot(state, value, true, true), ['result', 'transaction'], CODE.OWNED);
    const transaction = record(state, owned.transaction, ['request', 'report'], CODE.OWNED);
    const request = record(state, transaction.request, ['previousDocument', 'options', 'edits'], CODE.OWNED);
    json(state, owned, UPDATE_LIMIT);
    const previous = evaluate(state, request.previousDocument, request.options);
    const expected = applyUpdate(previous, request.edits as SourceLineWidthMaterialBodyGraphEdits, { ...state.directCounts });
    state.stage = 'owned'; state.nodeId = null;
    const changed = expected.transaction.report.directCounts;
    state.directCounts.widthBuildCallCount += changed.widthBuildCallCount;
    state.directCounts.extrusionBuildCallCount += changed.extrusionBuildCallCount;
    state.directCounts.materialBuildCallCount += changed.materialBuildCallCount;
    state.directCounts.producerEvaluationCount += changed.producerEvaluationCount;
    check(state, same(owned, expected), CODE.OWNED,
      'Owned current result/baseline/selective requests/actions/phase counters or sizes differ');
    return snapshot(state, expected.transaction.report, true, true) as SourceLineWidthMaterialBodyGraphTransactionReport;
  } catch (cause) {
    if (cause instanceof SourceLineWidthMaterialBodyGraphError && cause.code === CODE.OWNED) throw cause;
    const failed = cause instanceof SourceLineWidthMaterialBodyGraphError ? cause.context : state;
    throw new SourceLineWidthMaterialBodyGraphError(CODE.OWNED,
      'Whole authored baseline and selective transaction reconstruction refused', { ...failed, stage: 'owned' }, cause);
  }
}
function canonical(state: ErrorContext, value: unknown): unknown {
  if (typeof value === 'string') {
    try { cadDocumentOwnUtf8Bytes(value, 'JSON'); }
    catch (cause) { fail(state, CODE.CODEC, 'Malformed decoded source/string Unicode refused before JSON escaping', cause); }
    return value;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(item => canonical(state, item));
  const data = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(data).sort().map(key => [key, canonical(state, data[key])]));
}
/** Save authored intent only; perform one complete actual graph evaluation for admission. */
export function serializeSourceLineWidthMaterialBodyGraph(document: SourceLineWidthMaterialBodyGraphV0,
  options: SourceLineWidthMaterialBodyGraphOptions): string {
  const state = context(); state.stage = 'codec';
  const accepted = evaluate(state, document, options);
  state.stage = 'codec'; state.nodeId = null;
  const normalized = canonical(state, accepted.document) as SourceLineWidthMaterialBodyGraphV0;
  const ordered: SourceLineWidthMaterialBodyGraphV0 = { format: normalized.format, version: normalized.version,
    id: normalized.id, revision: normalized.revision, lengthUnit: normalized.lengthUnit, sourceFrame: normalized.sourceFrame,
    asset: normalized.asset, parameters: normalized.parameters, nodes: normalized.nodes };
  return json(state, ordered, AUTHORED_LIMIT, true).text;
}
/** Decode the small authored document through the unchanged strict grammar, then evaluate the real producers. */
export function parseSourceLineWidthMaterialBodyGraph(text: string,
  options: SourceLineWidthMaterialBodyGraphOptions): SourceLineWidthMaterialBodyGraphResult {
  const state = context(); state.stage = 'codec';
  check(state, typeof text === 'string', CODE.CODEC, 'Complete authored JSON text is required');
  check(state, text.length <= AUTHORED_LIMIT, CODE.FILE, 'Complete authored JSON exceeds its UTF16 envelope');
  let bytes: number;
  try { bytes = cadDocumentOwnUtf8Bytes(text, 'JSON'); }
  catch (cause) { fail(state, CODE.CODEC, 'Malformed authored Unicode refused', cause); }
  check(state, text.length <= AUTHORED_LIMIT && bytes <= AUTHORED_LIMIT, CODE.FILE,
    'Complete authored JSON exceeds its UTF16 or UTF8 envelope');
  let document: unknown;
  try { document = parseCadDocumentOwnJson(text); }
  catch (cause) { fail(state, CODE.CODEC, 'Unchanged strict authored JSON grammar refused', cause); }
  return evaluate(state, document, options);
}
