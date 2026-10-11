import { buildSourceLineWidthFace } from './source-line-width-face.js';
import { SourceLineWidthFaceError } from './source-line-width-face.js';
import { extrudeConvexPlanarFace } from './convex-planar-face-extrusion.js';
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from './cad-document.js';

import type { SourceLineWidthFaceOptions,SourceLineWidthFaceResult } from './source-line-width-face.js';
import type { ConvexPlanarFaceExtrusionResult } from './convex-planar-face-extrusion.js';
type Size={utf16:number;utf8:number};
type Pair<T>=[T,T];
type Asset={sourceId:string;sourceVersion:0;source:string;curveId:string};
type Parameter={id:string;kind:'length';unit:'mm';valueMM:number};
type WidthNode={id:string;kind:'source-line-width-face';sourceId:string;widthParameterId:string;
  options:SourceLineWidthFaceOptions};
type ExtrusionNode={id:string;kind:'convex-planar-face-extrusion';faceNodeId:string;heightParameterId:string;
  suppressed:boolean;options:{evaluationId:string;resultIdPrefix:string;direction:'positive-z'}};
export interface SourceLineWidthExtrusionGraphV0 { // exact9
  format:'barocss-source-line-width-extrusion-graph';version:0;id:string;revision:number;
  lengthUnit:'mm';sourceFrame:'authored-xyz-no-axis-conversion';asset:Asset;
  parameters:Pair<Parameter>;nodes:[WidthNode,ExtrusionNode];
}
export interface SourceLineWidthExtrusionGraphOptions { // exact4, unchanged across update
  maximumFeatureNodes:2;maximumWidthEvaluations:1;maximumExtrusionEvaluations:1;maximumProducerEvaluations:2;
}
export interface SourceLineWidthExtrusionGraphEdits { // exact4
  expectedRevision:number;revision:number;
  parameterEdits:{parameterId:string;valueMM:number}[]; // ≤2, unique IDs
  extrusionSuppressed:boolean|null;
}
type SourceContext={context:'original'|'ruled'|'face';authoredSourceId:string|null;
  sourceField:'document.asset.source'|'width.ruled.source'|'width.face.source';
  modelField:'width.originalModel'|'width.ruled.model'|'width.face.model';
  modelName:string;sourceVersion:0};
type Bindings={
  graphId:string;revision:number;
  parameters:[{index:0;parameterId:string;kind:'length';unit:'mm';valueMM:number;nodeId:string;role:'width'},
    {index:1;parameterId:string;kind:'length';unit:'mm';valueMM:number;nodeId:string;role:'height'}];
  sources:{original:SourceContext;ruled:SourceContext;face:SourceContext};
  width:{nodeId:string;sourceId:string;widthParameterId:string;curveId:string;modelName:string;
    selectedObjectIndex:number;faceId:string;provider:SourceLineWidthFaceResult['bindings']};
  extrusion:{nodeId:string;inputNodeId:string;heightParameterId:string;status:'active'|'suppressed';
    evaluationId:string;shellId:string|null;inputFaceId:string;
    provider:ConvexPlanarFaceExtrusionResult['bindings']|null};
  dependencies:[{nodeId:string;dependencyNodeIds:[];sourceIds:[string];parameterIds:[string]},
    {nodeId:string;dependencyNodeIds:[string];sourceIds:[];parameterIds:[string]}];
  authority:'complete-original-source-and-two-literal-mm-feature-recipes';
};
type RetainedProviderCounts={
  width:SourceLineWidthFaceResult['report']['directCounts'];
  extrusion:ConvexPlanarFaceExtrusionResult['report']['directCounts']|null;
  shellChildren:ConvexPlanarFaceExtrusionResult['report']['shellChildDirectCounts']|null;
};
type ChangedProviderCounts={
  width:SourceLineWidthFaceResult['report']['directCounts']|null;
  extrusion:ConvexPlanarFaceExtrusionResult['report']['directCounts']|null;
  shellChildren:ConvexPlanarFaceExtrusionResult['report']['shellChildDirectCounts']|null;
};
type OperationCounts={widthBuildCallCount:number;extrusionBuildCallCount:number;producerEvaluationCount:number;
  rootSourceCompilationCount:0;rootCurveD0Count:0;rootCurveD1AttemptCount:0;
  rootSurfaceD0Count:0;rootSurfaceD1AttemptCount:0;rootRationalOperationCount:0;oldGraphCallCount:0};
export interface SourceLineWidthExtrusionGraphReport {
  schema:'barocss-source-line-width-extrusion-graph-report';version:0;
  graphId:string;revision:number;lengthUnit:'mm';sourceFrame:'authored-xyz-no-axis-conversion';
  sourceId:string;originalModelName:string;originalCurveId:string;selectedObjectIndex:number;
  nodeOrder:Pair<string>;parameterOrder:Pair<string>;dependencies:Bindings['dependencies'];
  widthMM:number;heightMM:number;extrusionStatus:'active'|'suppressed';
  faceId:string;shellId:string|null;
  receiptCounts:{widthReceiptCount:1;extrusionReceiptCount:0|1;featureReceiptCount:1|2};
  retainedProviderCounts:RetainedProviderCounts;
  sourceSizes:{original:Size;ruled:Size;face:Size};
  fileSizes:{authored:Size;request:Size;result:Size};
  authority:'complete-original-source-and-two-literal-mm-feature-recipes';
  reconstruction:'whole-current-document-and-options-no-operation-history';
  workScope:'retained-receipts-not-selective-constructor-call-counts';
  numericPolicy:{parameters:'literal-finite-mm-values-not-source2-expression-lowering';
    width:'actual1417-represented-centered-width-policy';
    height:'actual1433-positive-z-distance-policy';
    suppression:'dependent-extrusion-only-width-face-always-active';
    identity:'qualified-source-contexts-and-explicit-current-recipe-roles';
    orientation:'forward-natural-xy-face-positive-z-outward-native-quad-charts';
    comparison:'object-is-semantic-values-and-complete-native-request-bits';
    noOp:'new-revision-with-zero-changed-producer-calls';
    codec:'small-authored-document-only-literal-negative-zero-and-one-newline'};
  quality:{completeOriginalSourceRetained:true;unrelatedOriginalGeometryPreserved:true;
    sourceQualifiedBindings:true;originalSelectedCurveBitsPreserved:true;
    fullWidthReceiptRetained:true;fullExtrusionReceiptWhenActive:true;
    faceIncidenceValid:true;closedAbstractShellProduced:boolean;
    parentFlagsUnchanged:true;affectedOnlyUpdates:true;ownedRebuild:true;
    source2Expressions:false;sourcePoleSubstitution:false;generalFeatureGraph:false;
    generalPersistentNaming:false;geometricValidity:'not-certified';
    solid:false;embeddedManifoldCertified:false;volumeCertified:false;
    globalBinary64ErrorCertified:false;manufacturingToleranceCertified:false;
    editorDisplayCertified:false;publication:false;ownership:'independent-copied-cpu-data-gc'};
  limits:{maximumFeatureNodes:2;maximumParameters:2;maximumWidthEvaluations:1;
    maximumExtrusionEvaluations:1;maximumProducerEvaluations:2;maximumRevision:1000000000;
    minimumLengthMM:0.000001;maximumLengthMM:10000;maximumOriginalModelObjects:16;
    sourceUTF16:262144;sourceUTF8:262144;identityCharacters:48;
    widthFacePrefixCharacters:20;extrusionPrefixCharacters:5;shellChildPrefixCharacters:8;
    maximumAuthoredUTF16:2097152;maximumAuthoredUTF8:2097152;
    maximumRequestUTF16:2097152;maximumRequestUTF8:2097152;
    maximumResultUTF16:8388608;maximumResultUTF8:8388608;
    maximumUpdateUTF16:16777216;maximumUpdateUTF8:16777216;
    ownValues:2097152;updateOwnValues:4194304;ownDepth:64;arrayElements:8192;
    recordFields:64;keyCharacters:128;stringCharacters:262144;
    authoredParserDepth:12;authoredParserValues:65536;authoredParserRecordFields:16;
    authoredParserStringCharacters:262144;
    widthRequestUTF16:1048576;widthRequestUTF8:1048576;widthResultUTF16:2097152;widthResultUTF8:2097152;
    extrusionRequestUTF16:2097152;extrusionRequestUTF8:2097152;
    extrusionResultUTF16:4194304;extrusionResultUTF8:4194304};
  budgetFailure:'atomic-no-partial-accepted-width-extrusion-graph';
}
export interface SourceLineWidthExtrusionGraphResult { // exact6
  document:SourceLineWidthExtrusionGraphV0;options:SourceLineWidthExtrusionGraphOptions;
  width:SourceLineWidthFaceResult;extrusion:ConvexPlanarFaceExtrusionResult|null;
  bindings:Bindings;report:SourceLineWidthExtrusionGraphReport;
}
export interface SourceLineWidthExtrusionGraphTransactionReport {
  schema:'barocss-source-line-width-extrusion-graph-transaction';version:0;
  graphId:string;previousRevision:number;revision:number;noOp:boolean;
  changedParameterIds:string[];widthChanged:boolean;heightChanged:boolean;
  suppressionChanged:boolean;resumed:boolean;
  widthAction:'rebuilt'|'retained';extrusionAction:'rebuilt'|'retained'|'suppressed';
  sourceEffectChanged:boolean; // actual complete width.face changed, not revision metadata
  extrusionRequestChanged:boolean; // actual complete parent/options compared when active
  directCounts:OperationCounts;changedProviderCounts:ChangedProviderCounts;
  validationCounts:{previousGraphRebuildCount:1;directCounts:OperationCounts;providers:RetainedProviderCounts};
  fileSizes:{update:Size};atomic:true;unchangedNativeReceiptsCopied:true;
  workScope:'actual-selective-work-with-prior-cold-validation-reported-separately';
}
export interface SourceLineWidthExtrusionGraphTransaction { // exact2, no recursive previous result
  request:{previousDocument:SourceLineWidthExtrusionGraphV0;options:SourceLineWidthExtrusionGraphOptions;
    edits:SourceLineWidthExtrusionGraphEdits};
  report:SourceLineWidthExtrusionGraphTransactionReport;
}
export interface SourceLineWidthExtrusionGraphUpdateResult { // exact2
  result:SourceLineWidthExtrusionGraphResult;transaction:SourceLineWidthExtrusionGraphTransaction;
}
export const SourceLineWidthExtrusionGraphDiagnosticCode=Object.freeze({
  INPUT:'INPUT',VERSION:'VERSION',IDENTITY:'IDENTITY',REFERENCE:'REFERENCE',REVISION:'REVISION',
  PARAMETER:'PARAMETER',PROFILE:'PROFILE',BUDGET:'BUDGET',SOURCE:'SOURCE',WIDTH:'WIDTH',
  EXTRUSION:'EXTRUSION',BINDING:'BINDING',OWNED:'OWNED',CODEC:'CODEC',FILE:'FILE',
} as const); // fifteen exact keys
type DiagnosticCode=typeof SourceLineWidthExtrusionGraphDiagnosticCode[keyof typeof SourceLineWidthExtrusionGraphDiagnosticCode];
type ErrorContext={stage:'input'|'width'|'extrusion'|'update'|'owned'|'codec'|'file';
  graphId:string|null;nodeId:string|null;revision:number|null;directCounts:OperationCounts};
export class SourceLineWidthExtrusionGraphError extends Error {
  readonly code: DiagnosticCode;
  readonly context: ErrorContext;
  constructor(code: DiagnosticCode, detail: string, context: ErrorContext, cause?: unknown) {
    super(('Source Line width extrusion graph: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'SourceLineWidthExtrusionGraphError';
    this.code = code;
    this.context = { ...context, directCounts: { ...context.directCounts } };
  }
}
// Public runtime signatures:
// evaluateSourceLineWidthExtrusionGraph(document,options):Result
// updateSourceLineWidthExtrusionGraph(previous,edits):UpdateResult
// validateSourceLineWidthExtrusionGraph(unknown):Report
// validateSourceLineWidthExtrusionGraphUpdate(unknown):TransactionReport
// serializeSourceLineWidthExtrusionGraph(document,options):string
// parseSourceLineWidthExtrusionGraph(text,options):Result


const CODE = SourceLineWidthExtrusionGraphDiagnosticCode;
const AUTHORED_LIMIT = 2097152, CURRENT_LIMIT = 8388608, UPDATE_LIMIT = 16777216;
function counts(): OperationCounts {
  return { widthBuildCallCount: 0, extrusionBuildCallCount: 0, producerEvaluationCount: 0,
    rootSourceCompilationCount: 0, rootCurveD0Count: 0, rootCurveD1AttemptCount: 0,
    rootSurfaceD0Count: 0, rootSurfaceD1AttemptCount: 0, rootRationalOperationCount: 0, oldGraphCallCount: 0 };
}
function context(): ErrorContext {
  return { stage: 'input', graphId: null, nodeId: null, revision: null, directCounts: counts() };
}
function fail(state: ErrorContext, code: DiagnosticCode, detail: string, cause?: unknown): never {
  throw new SourceLineWidthExtrusionGraphError(code, detail, state, cause);
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
  let remaining = update ? 4194304 : 2097152;
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
function admit(state: ErrorContext, docInput: unknown, optionsInput: unknown): {
  document: SourceLineWidthExtrusionGraphV0; options: SourceLineWidthExtrusionGraphOptions;
} {
  const doc = record(state, docInput, ['format', 'version', 'id', 'revision', 'lengthUnit', 'sourceFrame', 'asset', 'parameters', 'nodes']);
  check(state, doc.format === 'barocss-source-line-width-extrusion-graph' && Object.is(doc.version, 0),
    CODE.VERSION, 'Exact graph format and positive-zero version0 are required');
  id(state, doc.id); revision(state, doc.revision);
  state.graphId = doc.id; state.revision = doc.revision;
  check(state, doc.lengthUnit === 'mm' && doc.sourceFrame === 'authored-xyz-no-axis-conversion', CODE.PARAMETER,
    'Original rawXYZ frame and mm units are required');
  const options = record(state, optionsInput, ['maximumFeatureNodes', 'maximumWidthEvaluations', 'maximumExtrusionEvaluations', 'maximumProducerEvaluations']);
  check(state, options.maximumFeatureNodes === 2 && options.maximumWidthEvaluations === 1 &&
    options.maximumExtrusionEvaluations === 1 && options.maximumProducerEvaluations === 2, CODE.BUDGET,
  'Complete fixed graph budgets2/1/1/2 are required');
  const asset = record(state, doc.asset, ['sourceId', 'sourceVersion', 'source', 'curveId']);
  id(state, asset.sourceId); id(state, asset.curveId);
  check(state, Object.is(asset.sourceVersion, 0), CODE.VERSION, 'Only literal Source0 is supported; no Source2 lowering or pole substitution');
  check(state, typeof asset.source === 'string', CODE.INPUT, 'A complete original Source0 string is required');
  size(state, asset.source);
  check(state, Array.isArray(doc.parameters) && doc.parameters.length === 2 && Array.isArray(doc.nodes) && doc.nodes.length === 2,
    CODE.INPUT, 'Fixed parameters[width,height] and nodes[width,extrusion] are required');
  const parameters = doc.parameters.map(value => record(state, value, ['id', 'kind', 'unit', 'valueMM']));
  for (const parameter of parameters) {
    id(state, parameter.id); length(state, parameter.valueMM);
    check(state, parameter.kind === 'length' && parameter.unit === 'mm', CODE.PARAMETER, 'Both parameters must be literal length/mm records');
  }
  const width = record(state, doc.nodes[0], ['id', 'kind', 'sourceId', 'widthParameterId', 'options']);
  const extrusion = record(state, doc.nodes[1], ['id', 'kind', 'faceNodeId', 'heightParameterId', 'suppressed', 'options']);
  id(state, width.id); id(state, extrusion.id);
  check(state, width.kind === 'source-line-width-face' && extrusion.kind === 'convex-planar-face-extrusion',
    CODE.REFERENCE, 'The fixed ordered feature kinds must be width then extrusion');
  check(state, width.sourceId === asset.sourceId && width.widthParameterId === parameters[0].id &&
    extrusion.faceNodeId === width.id && extrusion.heightParameterId === parameters[1].id, CODE.REFERENCE,
  'Explicit original source, parameter and dependency references must resolve the exact fixed objects');
  check(state, new Set([doc.id, asset.sourceId, parameters[0].id, parameters[1].id, width.id, extrusion.id]).size === 6,
    CODE.IDENTITY, 'Logical graph/source/parameter/node IDs must be distinct within their namespace');
  check(state, typeof extrusion.suppressed === 'boolean', CODE.INPUT, 'Dependent suppression must be an explicit boolean');
  const w = record(state, width.options, ['lowerCurveId', 'upperCurveId', 'surfaceId', 'loopId', 'boundaryCurveIds', 'face']);
  const face = record(state, w.face, ['faceId', 'evaluationId', 'resultIdPrefix', 'orientation']);
  for (const key of ['lowerCurveId', 'upperCurveId', 'surfaceId', 'loopId']) id(state, w[key]);
  check(state, Array.isArray(w.boundaryCurveIds) && w.boundaryCurveIds.length === 4, CODE.INPUT, 'Four explicit boundary Curve IDs are required');
  w.boundaryCurveIds.forEach(value => id(state, value));
  id(state, face.faceId); id(state, face.evaluationId); id(state, face.resultIdPrefix, 20);
  check(state, face.orientation === 'forward', CODE.PROFILE, 'Only forward width Faces are supported');
  const e = record(state, extrusion.options, ['evaluationId', 'resultIdPrefix', 'direction']);
  id(state, e.evaluationId); id(state, e.resultIdPrefix, 5);
  check(state, e.direction === 'positive-z', CODE.PROFILE, 'Only explicit positive-Z dependent extrusion is supported');
  const document = doc as unknown as SourceLineWidthExtrusionGraphV0;
  const nativeIds = widthIds(document.nodes[0].options);
  nativeIds.forEach(value => id(state, value));
  check(state, new Set(nativeIds).size === nativeIds.length, CODE.IDENTITY, 'Every actual width-generated role must be distinct');
  json(state, document, AUTHORED_LIMIT); json(state, { document, options }, AUTHORED_LIMIT);
  return { document, options: options as unknown as SourceLineWidthExtrusionGraphOptions };
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
function plannedRoles(state: ErrorContext, doc: SourceLineWidthExtrusionGraphV0, width: SourceLineWidthFaceResult): void {
  state.stage = 'extrusion'; state.nodeId = doc.nodes[1].id;
  const face = width.face;
  const original = new Set([width.originalCurve.id, ...width.originalModel.objects.map(object => object.id),
    ...widthIds(doc.nodes[0].options), face.loop.id, face.plane.id, face.topology.face.id,
    face.options.evaluationId, ...face.model.objects.map(object => object.id),
    ...face.topology.vertices.map(vertex => vertex.id), ...face.topology.edges.map(edge => edge.id),
    ...face.topology.loop.uses.map(use => use.id), ...face.pcurves.map(pcurve => pcurve.id),
    'parametric_face', 'curve_reverse_original']);
  const roles = extrusionIds(doc.nodes[1]);
  roles.forEach(value => id(state, value));
  check(state, new Set(roles).size === roles.length && roles.every(value => !original.has(value)), CODE.IDENTITY,
    'Every planned extrusion role must avoid all original siblings and width contexts even when suppressed');
}
function widthRequest(doc: SourceLineWidthExtrusionGraphV0): SourceLineWidthFaceResult['request'] {
  return { source: doc.asset.source, sourceVersion: 0, curveId: doc.asset.curveId,
    widthMM: doc.parameters[0].valueMM, options: doc.nodes[0].options };
}
function extrusionOptions(doc: SourceLineWidthExtrusionGraphV0): ConvexPlanarFaceExtrusionResult['request']['options'] {
  return { evaluationId: doc.nodes[1].options.evaluationId, resultIdPrefix: doc.nodes[1].options.resultIdPrefix,
    distanceMM: doc.parameters[1].valueMM, direction: 'positive-z' };
}
function providerCounts(width: SourceLineWidthFaceResult | null, extrusion: ConvexPlanarFaceExtrusionResult | null): ChangedProviderCounts {
  return { width: width?.report.directCounts ?? null, extrusion: extrusion?.report.directCounts ?? null,
    shellChildren: extrusion?.report.shellChildDirectCounts ?? null };
}
function prefix(state: ErrorContext, doc: SourceLineWidthExtrusionGraphV0, options: SourceLineWidthExtrusionGraphOptions,
  width: SourceLineWidthFaceResult | null, extrusion: ConvexPlanarFaceExtrusionResult | null, extra: unknown = null): void {
  const stage = state.stage; state.stage = 'file';
  const full = { document: doc, options, width, extrusion, extra };
  json(state, full, extra === null ? CURRENT_LIMIT : UPDATE_LIMIT); snapshot(state, full, false, extra !== null);
  state.stage = stage;
}
function buildWidth(state: ErrorContext, doc: SourceLineWidthExtrusionGraphV0): SourceLineWidthFaceResult {
  state.stage = 'width'; state.nodeId = doc.nodes[0].id;
  check(state, state.directCounts.widthBuildCallCount < 1 && state.directCounts.producerEvaluationCount < 2,
    CODE.BUDGET, 'The changed-stage width or producer budget is exhausted');
  state.directCounts.widthBuildCallCount++; state.directCounts.producerEvaluationCount++;
  try { return buildSourceLineWidthFace(widthRequest(doc)); }
  catch (cause) {
    fail(state, cause instanceof SourceLineWidthFaceError && cause.code === 'SOURCE' ? CODE.SOURCE : CODE.WIDTH,
      'Actual complete Source0 width Face construction refused', cause);
  }
}
function buildExtrusion(state: ErrorContext, doc: SourceLineWidthExtrusionGraphV0,
  width: SourceLineWidthFaceResult): ConvexPlanarFaceExtrusionResult {
  state.stage = 'extrusion'; state.nodeId = doc.nodes[1].id;
  check(state, state.directCounts.extrusionBuildCallCount < 1 && state.directCounts.producerEvaluationCount < 2,
    CODE.BUDGET, 'The changed-stage extrusion or producer budget is exhausted');
  state.directCounts.extrusionBuildCallCount++; state.directCounts.producerEvaluationCount++;
  try { return extrudeConvexPlanarFace(width.face, extrusionOptions(doc)); }
  catch (cause) { fail(state, CODE.EXTRUSION, 'Actual full Convex Face dependent extrusion refused', cause); }
}

function assemble(state: ErrorContext, document: SourceLineWidthExtrusionGraphV0,
  options: SourceLineWidthExtrusionGraphOptions, width: SourceLineWidthFaceResult,
  extrusion: ConvexPlanarFaceExtrusionResult | null): SourceLineWidthExtrusionGraphResult {
  check(state, same(width.request, widthRequest(document)) && width.originalCurve.id === document.asset.curveId &&
    width.report.directCounts.producerDelegationCount === 7 && width.face.report.incidenceValid === true,
  CODE.BINDING, 'The complete width receipt must retain its actual source, literal request and original incidence');
  check(state, document.nodes[1].suppressed ? extrusion === null : extrusion !== null,
    CODE.BINDING, 'Current dependent suppression must match actual receipt presence');
  if (extrusion !== null) check(state, same(extrusion.request, { face: width.face, options: extrusionOptions(document) }) &&
    extrusion.report.directCounts.totalDelegationCount === 18 && extrusion.shell.pairResults.length === 12 &&
    extrusion.shell.graph.vertices.length === 8 && extrusion.shell.graph.edges.length === 12 &&
    extrusion.shell.graph.faces.length === 6 && extrusion.shell.graph.vertexLinks.length === 8 &&
    extrusion.report.quality.closed && extrusion.report.quality.solid === false &&
    extrusion.report.quality.embeddedManifoldCertified === false && extrusion.report.quality.volumeCertified === false,
  CODE.BINDING, 'The full active extrusion must bind the actual width Face and preserve its abstract-only Shell scope');
  const w = document.nodes[0], e = document.nodes[1];
  const dependencies: Bindings['dependencies'] = [
    { nodeId: w.id, dependencyNodeIds: [], sourceIds: [document.asset.sourceId], parameterIds: [document.parameters[0].id] },
    { nodeId: e.id, dependencyNodeIds: [w.id], sourceIds: [], parameterIds: [document.parameters[1].id] },
  ];
  const sources: Bindings['sources'] = {
    original: { context: 'original', authoredSourceId: document.asset.sourceId, sourceField: 'document.asset.source',
      modelField: 'width.originalModel', modelName: width.originalModel.name, sourceVersion: 0 },
    ruled: { context: 'ruled', authoredSourceId: null, sourceField: 'width.ruled.source', modelField: 'width.ruled.model',
      modelName: width.ruled.model.name, sourceVersion: 0 },
    face: { context: 'face', authoredSourceId: null, sourceField: 'width.face.source', modelField: 'width.face.model',
      modelName: width.face.model.name, sourceVersion: 0 },
  };
  const bindings: Bindings = {
    graphId: document.id, revision: document.revision,
    parameters: [
      { index: 0, parameterId: document.parameters[0].id, kind: 'length', unit: 'mm', valueMM: document.parameters[0].valueMM,
        nodeId: w.id, role: 'width' },
      { index: 1, parameterId: document.parameters[1].id, kind: 'length', unit: 'mm', valueMM: document.parameters[1].valueMM,
        nodeId: e.id, role: 'height' },
    ], sources,
    width: { nodeId: w.id, sourceId: document.asset.sourceId, widthParameterId: w.widthParameterId,
      curveId: width.originalCurve.id, modelName: width.originalModel.name, selectedObjectIndex: width.report.selectedObjectIndex,
      faceId: width.face.topology.face.id, provider: width.bindings },
    extrusion: { nodeId: e.id, inputNodeId: w.id, heightParameterId: e.heightParameterId,
      status: e.suppressed ? 'suppressed' : 'active', evaluationId: e.options.evaluationId,
      shellId: extrusion?.shell.options.shellId ?? null, inputFaceId: width.face.topology.face.id, provider: extrusion?.bindings ?? null },
    dependencies, authority: 'complete-original-source-and-two-literal-mm-feature-recipes',
  };
  const report: SourceLineWidthExtrusionGraphReport = {
    schema: 'barocss-source-line-width-extrusion-graph-report', version: 0, graphId: document.id,
    revision: document.revision, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    sourceId: document.asset.sourceId, originalModelName: width.originalModel.name, originalCurveId: width.originalCurve.id,
    selectedObjectIndex: width.report.selectedObjectIndex, nodeOrder: [w.id, e.id],
    parameterOrder: [document.parameters[0].id, document.parameters[1].id], dependencies,
    widthMM: document.parameters[0].valueMM, heightMM: document.parameters[1].valueMM,
    extrusionStatus: e.suppressed ? 'suppressed' : 'active', faceId: width.face.topology.face.id,
    shellId: extrusion?.shell.options.shellId ?? null,
    receiptCounts: { widthReceiptCount: 1, extrusionReceiptCount: extrusion === null ? 0 : 1,
      featureReceiptCount: extrusion === null ? 1 : 2 },
    retainedProviderCounts: { width: width.report.directCounts, extrusion: extrusion?.report.directCounts ?? null,
      shellChildren: extrusion?.report.shellChildDirectCounts ?? null },
    sourceSizes: { original: size(state, document.asset.source), ruled: size(state, width.ruled.source), face: size(state, width.face.source) },
    fileSizes: { authored: json(state, document, AUTHORED_LIMIT).size,
      request: json(state, { document, options }, AUTHORED_LIMIT).size, result: { utf16: 0, utf8: 0 } },
    authority: 'complete-original-source-and-two-literal-mm-feature-recipes',
    reconstruction: 'whole-current-document-and-options-no-operation-history',
    workScope: 'retained-receipts-not-selective-constructor-call-counts',
    numericPolicy: { parameters: 'literal-finite-mm-values-not-source2-expression-lowering',
      width: 'actual1417-represented-centered-width-policy', height: 'actual1433-positive-z-distance-policy',
      suppression: 'dependent-extrusion-only-width-face-always-active',
      identity: 'qualified-source-contexts-and-explicit-current-recipe-roles',
      orientation: 'forward-natural-xy-face-positive-z-outward-native-quad-charts',
      comparison: 'object-is-semantic-values-and-complete-native-request-bits', noOp: 'new-revision-with-zero-changed-producer-calls',
      codec: 'small-authored-document-only-literal-negative-zero-and-one-newline' },
    quality: { completeOriginalSourceRetained: true, unrelatedOriginalGeometryPreserved: true,
      sourceQualifiedBindings: true, originalSelectedCurveBitsPreserved: true, fullWidthReceiptRetained: true,
      fullExtrusionReceiptWhenActive: true, faceIncidenceValid: true, closedAbstractShellProduced: extrusion !== null,
      parentFlagsUnchanged: true, affectedOnlyUpdates: true, ownedRebuild: true, source2Expressions: false,
      sourcePoleSubstitution: false, generalFeatureGraph: false, generalPersistentNaming: false,
      geometricValidity: 'not-certified', solid: false, embeddedManifoldCertified: false, volumeCertified: false,
      globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, editorDisplayCertified: false,
      publication: false, ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumFeatureNodes: 2, maximumParameters: 2, maximumWidthEvaluations: 1, maximumExtrusionEvaluations: 1,
      maximumProducerEvaluations: 2, maximumRevision: 1000000000, minimumLengthMM: 0.000001, maximumLengthMM: 10000,
      maximumOriginalModelObjects: 16, sourceUTF16: 262144, sourceUTF8: 262144, identityCharacters: 48,
      widthFacePrefixCharacters: 20, extrusionPrefixCharacters: 5, shellChildPrefixCharacters: 8,
      maximumAuthoredUTF16: 2097152, maximumAuthoredUTF8: 2097152,
      maximumRequestUTF16: 2097152, maximumRequestUTF8: 2097152,
      maximumResultUTF16: 8388608, maximumResultUTF8: 8388608,
      maximumUpdateUTF16: 16777216, maximumUpdateUTF8: 16777216,
      ownValues: 2097152, updateOwnValues: 4194304, ownDepth: 64, arrayElements: 8192,
      recordFields: 64, keyCharacters: 128, stringCharacters: 262144,
      authoredParserDepth: 12, authoredParserValues: 65536, authoredParserRecordFields: 16, authoredParserStringCharacters: 262144,
      widthRequestUTF16: 1048576, widthRequestUTF8: 1048576, widthResultUTF16: 2097152, widthResultUTF8: 2097152,
      extrusionRequestUTF16: 2097152, extrusionRequestUTF8: 2097152, extrusionResultUTF16: 4194304, extrusionResultUTF8: 4194304 },
    budgetFailure: 'atomic-no-partial-accepted-width-extrusion-graph',
  };
  const result: SourceLineWidthExtrusionGraphResult = { document, options, width, extrusion, bindings, report };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const actual = json(state, result, CURRENT_LIMIT).size;
    if (same(actual, report.fileSizes.result)) { settled = true; break; }
    report.fileSizes.result = actual;
  }
  check(state, settled && same(json(state, result, CURRENT_LIMIT).size, report.fileSizes.result), CODE.FILE,
    'Complete current result file sizes must settle within eight passes');
  return snapshot(state, result) as SourceLineWidthExtrusionGraphResult;
}
function evaluate(state: ErrorContext, docInput: unknown, optionsInput: unknown): SourceLineWidthExtrusionGraphResult {
  const data = record(state, snapshot(state, { document: docInput, options: optionsInput }), ['document', 'options']);
  const { document, options } = admit(state, data.document, data.options);
  prefix(state, document, options, null, null);
  const width = buildWidth(state, document);
  prefix(state, document, options, width, null);
  plannedRoles(state, document, width);
  prefix(state, document, options, width, null);
  const extrusion = document.nodes[1].suppressed ? null : buildExtrusion(state, document, width);
  prefix(state, document, options, width, extrusion);
  return assemble(state, document, options, width, extrusion);
}
/** Evaluate the two actual typed feature producers from full original Source0 and literal-mm intent. */
export function evaluateSourceLineWidthExtrusionGraph(document: SourceLineWidthExtrusionGraphV0,
  options: SourceLineWidthExtrusionGraphOptions): SourceLineWidthExtrusionGraphResult {
  return evaluate(context(), document, options);
}
function rebuild(state: ErrorContext, value: unknown): SourceLineWidthExtrusionGraphResult {
  try {
    const owned = record(state, snapshot(state, value, true), ['document', 'options', 'width', 'extrusion', 'bindings', 'report'],
      CODE.OWNED) as unknown as SourceLineWidthExtrusionGraphResult;
    json(state, owned, CURRENT_LIMIT);
    const expected = evaluate(state, owned.document, owned.options);
    state.stage = 'owned'; state.nodeId = null;
    check(state, same(owned, expected), CODE.OWNED,
      'Whole authored graph, native sources/Models/proofs, references, counts or file sizes differ from reconstruction');
    return expected;
  } catch (cause) {
    if (cause instanceof SourceLineWidthExtrusionGraphError && cause.code === CODE.OWNED) throw cause;
    const failed = cause instanceof SourceLineWidthExtrusionGraphError ? cause.context : state;
    throw new SourceLineWidthExtrusionGraphError(CODE.OWNED, 'Whole current graph reconstruction refused', { ...failed, stage: 'owned' }, cause);
  }
}
/** One complete current-document rebuild, with no separate duplicate child validation. */
export function validateSourceLineWidthExtrusionGraph(value: unknown): SourceLineWidthExtrusionGraphReport {
  const state = context(); state.stage = 'owned';
  return snapshot(state, rebuild(state, value).report, true) as SourceLineWidthExtrusionGraphReport;
}

function updateEdits(state: ErrorContext, input: unknown,
  previous: SourceLineWidthExtrusionGraphV0): SourceLineWidthExtrusionGraphEdits {
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
  return data as unknown as SourceLineWidthExtrusionGraphEdits;
}
/** Internal update consumes one actual cold-qualified previous state; it never validates that state again. */
function applyUpdate(previous: SourceLineWidthExtrusionGraphResult, editsInput: SourceLineWidthExtrusionGraphEdits,
  validation: OperationCounts): SourceLineWidthExtrusionGraphUpdateResult {
  const state = context(); state.stage = 'update'; state.graphId = previous.document.id; state.revision = previous.document.revision;
  const edits = updateEdits(state, editsInput, previous.document);
  const document = snapshot(state, previous.document) as SourceLineWidthExtrusionGraphV0;
  document.revision = edits.revision;
  for (const edit of edits.parameterEdits) {
    const parameter = document.parameters.find(value => value.id === edit.parameterId)!;
    parameter.valueMM = edit.valueMM;
  }
  if (edits.extrusionSuppressed !== null) document.nodes[1].suppressed = edits.extrusionSuppressed;
  admit(state, document, previous.options);
  const widthChanged = !Object.is(document.parameters[0].valueMM, previous.document.parameters[0].valueMM);
  const heightChanged = !Object.is(document.parameters[1].valueMM, previous.document.parameters[1].valueMM);
  const suppressionChanged = document.nodes[1].suppressed !== previous.document.nodes[1].suppressed;
  const resumed = previous.document.nodes[1].suppressed && !document.nodes[1].suppressed;
  const request = { previousDocument: previous.document, options: previous.options, edits };
  let width = previous.width, extrusion = previous.extrusion;
  prefix(state, document, previous.options, width, extrusion, request);
  if (widthChanged) {
    width = buildWidth(state, document);
    prefix(state, document, previous.options, width, extrusion, request);
  }
  plannedRoles(state, document, width);
  const sourceEffectChanged = !same(width.face, previous.width.face);
  const nextExtrusionRequest = document.nodes[1].suppressed ? null : { face: width.face, options: extrusionOptions(document) };
  const extrusionRequestChanged = !same(nextExtrusionRequest, previous.extrusion?.request ?? null);
  const extrusionRebuilt = nextExtrusionRequest !== null && (extrusionRequestChanged || resumed);
  if (document.nodes[1].suppressed) extrusion = null;
  else if (extrusionRebuilt) {
    prefix(state, document, previous.options, width, extrusion, request);
    extrusion = buildExtrusion(state, document, width);
  } else check(state, extrusion !== null && same(extrusion.request, nextExtrusionRequest), CODE.BINDING,
    'An unchanged active dependency must retain its entire actual current parent/options request');
  prefix(state, document, previous.options, width, extrusion, request);
  const result = assemble(state, document, previous.options, width, extrusion);
  const transactionReport: SourceLineWidthExtrusionGraphTransactionReport = {
    schema: 'barocss-source-line-width-extrusion-graph-transaction', version: 0,
    graphId: document.id, previousRevision: previous.document.revision, revision: document.revision,
    noOp: !widthChanged && !heightChanged && !suppressionChanged,
    changedParameterIds: document.parameters.filter((parameter, index) =>
      !Object.is(parameter.valueMM, previous.document.parameters[index].valueMM)).map(parameter => parameter.id),
    widthChanged, heightChanged, suppressionChanged, resumed,
    widthAction: widthChanged ? 'rebuilt' : 'retained',
    extrusionAction: document.nodes[1].suppressed ? 'suppressed' : extrusionRebuilt ? 'rebuilt' : 'retained',
    sourceEffectChanged, extrusionRequestChanged, directCounts: { ...state.directCounts },
    changedProviderCounts: providerCounts(widthChanged ? width : null, extrusionRebuilt ? extrusion : null),
    validationCounts: { previousGraphRebuildCount: 1, directCounts: { ...validation },
      providers: previous.report.retainedProviderCounts },
    fileSizes: { update: { utf16: 0, utf8: 0 } }, atomic: true, unchangedNativeReceiptsCopied: true,
    workScope: 'actual-selective-work-with-prior-cold-validation-reported-separately',
  };
  const transaction: SourceLineWidthExtrusionGraphTransaction = { request, report: transactionReport };
  const update: SourceLineWidthExtrusionGraphUpdateResult = { result, transaction };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const actual = json(state, update, UPDATE_LIMIT).size;
    if (same(actual, transactionReport.fileSizes.update)) { settled = true; break; }
    transactionReport.fileSizes.update = actual;
  }
  check(state, settled && same(json(state, update, UPDATE_LIMIT).size, transactionReport.fileSizes.update), CODE.FILE,
    'Complete update wrapper file sizes must settle within eight passes');
  return snapshot(state, update, false, true) as SourceLineWidthExtrusionGraphUpdateResult;
}
/** Cold-validate the complete previous state once, then execute only the newly affected producers. */
export function updateSourceLineWidthExtrusionGraph(previousInput: SourceLineWidthExtrusionGraphResult,
  editsInput: SourceLineWidthExtrusionGraphEdits): SourceLineWidthExtrusionGraphUpdateResult {
  const state = context(); state.stage = 'owned';
  const request = record(state, snapshot(state, { previous: previousInput, edits: editsInput }, false, true), ['previous', 'edits']);
  json(state, request, UPDATE_LIMIT);
  const previous = rebuild(state, request.previous);
  return applyUpdate(previous, request.edits as SourceLineWidthExtrusionGraphEdits, { ...state.directCounts });
}
/** Rebuild only the nonrecursive authored baseline, then replay the trusted selective update once. */
export function validateSourceLineWidthExtrusionGraphUpdate(value: unknown): SourceLineWidthExtrusionGraphTransactionReport {
  const state = context(); state.stage = 'owned';
  try {
    const owned = record(state, snapshot(state, value, true, true), ['result', 'transaction'], CODE.OWNED);
    const transaction = record(state, owned.transaction, ['request', 'report'], CODE.OWNED);
    const request = record(state, transaction.request, ['previousDocument', 'options', 'edits'], CODE.OWNED);
    json(state, owned, UPDATE_LIMIT);
    const previous = evaluate(state, request.previousDocument, request.options);
    const expected = applyUpdate(previous, request.edits as SourceLineWidthExtrusionGraphEdits, { ...state.directCounts });
    state.stage = 'owned'; state.nodeId = null;
    // Include both actual phases in an OWNED mismatch diagnostic, while the accepted transaction keeps them separate.
    state.directCounts.widthBuildCallCount += expected.transaction.report.directCounts.widthBuildCallCount;
    state.directCounts.extrusionBuildCallCount += expected.transaction.report.directCounts.extrusionBuildCallCount;
    state.directCounts.producerEvaluationCount += expected.transaction.report.directCounts.producerEvaluationCount;
    check(state, same(owned, expected), CODE.OWNED,
      'Owned current result, authored baseline, selective actions, phase counts or full update sizes differ');
    return snapshot(state, expected.transaction.report, true, true) as SourceLineWidthExtrusionGraphTransactionReport;
  } catch (cause) {
    if (cause instanceof SourceLineWidthExtrusionGraphError && cause.code === CODE.OWNED) throw cause;
    const failed = cause instanceof SourceLineWidthExtrusionGraphError ? cause.context : state;
    throw new SourceLineWidthExtrusionGraphError(CODE.OWNED, 'Whole authored baseline and selective transaction reconstruction refused',
      { ...failed, stage: 'owned' }, cause);
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
export function serializeSourceLineWidthExtrusionGraph(document: SourceLineWidthExtrusionGraphV0,
  options: SourceLineWidthExtrusionGraphOptions): string {
  const state = context(); state.stage = 'codec';
  const accepted = evaluate(state, document, options);
  state.stage = 'codec'; state.nodeId = null;
  const normalized = canonical(state, accepted.document) as SourceLineWidthExtrusionGraphV0;
  const ordered: SourceLineWidthExtrusionGraphV0 = { format: normalized.format, version: normalized.version,
    id: normalized.id, revision: normalized.revision, lengthUnit: normalized.lengthUnit, sourceFrame: normalized.sourceFrame,
    asset: normalized.asset, parameters: normalized.parameters, nodes: normalized.nodes };
  return json(state, ordered, AUTHORED_LIMIT, true).text;
}
/** Decode the small authored document through the unchanged strict grammar, then evaluate the real producers. */
export function parseSourceLineWidthExtrusionGraph(text: string,
  options: SourceLineWidthExtrusionGraphOptions): SourceLineWidthExtrusionGraphResult {
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
