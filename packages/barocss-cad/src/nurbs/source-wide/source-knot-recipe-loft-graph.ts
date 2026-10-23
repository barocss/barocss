import { editSourceCurveControlPolygon } from './source-curve-control-polygon.js';
import type { SourceCurveControlPolygonResult } from './source-curve-control-polygon.js';
import type { CurveControlPolygonEdits } from '../curves/curve-control-polygon.js';
import { insertSourceCurveKnot } from './source-curve-knot-insertion.js';
import type { SourceCurveKnotInsertionResult } from './source-curve-knot-insertion.js';
import { buildSourceKnotAlignedLoft } from './source-knot-aligned-loft.js';
import type { SourceKnotAlignedLoftOptions, SourceKnotAlignedLoftResult,
  SourceKnotAlignedLoftRequest } from './source-knot-aligned-loft.js';
import { parseCadDocumentOwnJson, cadDocumentOwnUtf8Bytes } from '../../cad-document.js';
import type { Curve } from '../../types.js';

export const SourceKnotRecipeLoftGraphDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', REFERENCE: 'REFERENCE',
  REVISION: 'REVISION', BASIS: 'BASIS', REQUEST: 'REQUEST', STATIONS: 'STATIONS',
  BUDGET: 'BUDGET', SOURCE: 'SOURCE', TARGET: 'TARGET', NATIVE: 'NATIVE',
  REPRESENTABILITY: 'REPRESENTABILITY', INSERTION: 'INSERTION', LOFT: 'LOFT',
  BINDING: 'BINDING', OWNED: 'OWNED', CODEC: 'CODEC', FILE: 'FILE',
} as const);
export type SourceKnotRecipeLoftGraphDiagnosticCode =
  typeof SourceKnotRecipeLoftGraphDiagnosticCode[keyof typeof SourceKnotRecipeLoftGraphDiagnosticCode];
export class SourceKnotRecipeLoftGraphError extends Error {
  readonly code: SourceKnotRecipeLoftGraphDiagnosticCode;
  constructor(code: SourceKnotRecipeLoftGraphDiagnosticCode, detail: string, cause?: unknown) {
    super(('Source knot-recipe Loft graph: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'SourceKnotRecipeLoftGraphError';
    this.code = code;
  }
}
type Triple<T> = [T, T, T];
type Size = { utf16: number; utf8: number };
type Asset = { sourceId: string; sourceVersion: 0; source: string; curveId: string };
type SourceEdit = { id: string; kind: 'source-curve-edit'; sourceId: string;
  edits: CurveControlPolygonEdits };
type Refinement = { id: string; kind: 'shared-original-curve-knot'; knot: number; suppressed: boolean };
type Terminal = { id: string; kind: 'source-knot-aligned-loft'; sections: Triple<string>;
  parametersV: Triple<number>; options: SourceKnotAlignedLoftOptions };
export interface SourceKnotRecipeLoftGraphV0 {
  format: 'barocss-source-knot-recipe-loft-graph'; version: 0; id: string; revision: number;
  lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  assets: Triple<Asset>; sourceEdits: Triple<SourceEdit>; refinement: Refinement; terminal: Terminal;
}
export interface SourceKnotRecipeLoftGraphOptions {
  maximumSourceEdits: 3; maximumRefinementInsertions: 3;
  maximumLoftSections: 3; maximumProducerEvaluations: 7;
}
export interface SourceKnotRecipeLoftGraphEdits {
  expectedRevision: number; revision: number;
  nodeEdits: { nodeId: string; edits: CurveControlPolygonEdits }[];
  refinementKnot: number | null; refinementSuppressed: boolean | null;
}
type SourceBinding = { nodeId: string; sourceId: string; curveId: string;
  modelName: string; objectIndex: number; status: 'scalar' | 'refined';
  scalarObjectIndex: number; terminalSectionIndex: number };
type Bindings = {
  graphId: string; revision: number; sources: Triple<SourceBinding>;
  refinement: { nodeId: string; status: 'active' | 'bypassed'; inputNodeIds: Triple<string> };
  terminal: { nodeId: string; sourceId: string; modelName: string; surfaceId: string;
    sectionNodeIds: Triple<string>; constructionSectionIds: Triple<string>;
    sections: SourceKnotAlignedLoftResult['bindings']['sections'];
    output: SourceKnotAlignedLoftResult['bindings']['output'] };
};
type ProviderCounts = {
  sourceEditCallCount: number; refinementInsertionCallCount: number; terminalBuildCallCount: number;
  nestedLoftBuildCallCount: number; sourceCompilationCount: number;
  nativeCurveValidationCount: number; nativeSurfaceValidationCount: number;
  curveDomainQueryCount: number; surfaceDomainQueryCount: number;
  curveD0Count: number; curveD1AttemptCount: number;
  surfaceD0Count: number; surfaceD1AttemptCount: number;
  curveD1EvaluatedCount: number; curveD1RefusedCount: number;
  surfaceD1EvaluatedCount: number; surfaceD1RefusedCount: number;
  basisEvaluationCount: number; decimalEmissionCount: number;
};
export interface SourceKnotRecipeLoftGraphReport {
  schema: 'barocss-source-knot-recipe-loft-graph-report'; version: 0;
  graphId: string; revision: number; lengthUnit: 'mm';
  sourceFrame: 'authored-xyz-no-axis-conversion';
  sourceIds: Triple<string>; sourceModelNames: Triple<string>;
  nodeOrder: string[]; dependencies: { nodeId: string; dependencyNodeIds: string[] }[];
  sectionNodeIds: Triple<string>; refinementStatus: 'active' | 'bypassed';
  degreeU: number; scalarUPoleCount: number; outputUPoleCount: number;
  domainU: [number, number]; parametersV: Triple<number>;
  receiptCounts: { sourceEditReceiptCount: 3; refinementReceiptCount: 0 | 3;
    terminalReceiptCount: 1; terminalAlignmentInsertionCount: 0; nestedLoftReceiptCount: 1 };
  retainedProviderCounts: ProviderCounts;
  authority: 'complete-authored-sources-and-literal-original-pole-recipes';
  reconstruction: 'whole-current-document-and-options-no-operation-history';
  workScope: 'retained-receipts-not-selective-constructor-call-counts';
  fileSizes: { authored: Size; request: Size; result: Size };
  quality: { completeOriginalSourcesRetained: true; unrelatedSourceGeometryPreserved: true;
    sourceQualifiedBindings: true; originalSelectedIdsPreserved: true;
    independentWeightsPreserved: true; terminalZeroAlignment: true; ownedRebuild: true;
    affectedOnlyUpdates: true; expressionGraph: false; sharedSourceGraph: false;
    smoothLoft: false; G1: false; G2: false; topologyCertified: false; solid: false;
    globalBinary64ErrorCertified: false; manufacturing: false; editorDisplay: false;
    persistentTopologyBinding: false; publication: false;
    ownership: 'independent-copied-cpu-data-gc' };
  limits: { maximumSourceEdits: 3; maximumRefinementInsertions: 3; maximumLoftSections: 3;
    maximumProducerEvaluations: 7; maximumLogicalNodes: 5; maximumSelectedDegree: 5;
    maximumSelectedUPoles: 16; maximumPoleEditsPerNode: 16; maximumRevision: 1000000000;
    maximumModelObjects: 16; selectedCoordinateAbsMM: 10000;
    maximumSourceUTF16: 262144; maximumSourceUTF8: 262144;
    maximumAggregateOriginalSourceUTF16: 786432; maximumAggregateOriginalSourceUTF8: 786432;
    maximumAuthoredUTF16: 2097152; maximumAuthoredUTF8: 2097152;
    maximumResultUTF16: 16777216; maximumResultUTF8: 16777216;
    maximumUpdateUTF16: 33554432; maximumUpdateUTF8: 33554432;
    ownValues: 4194304; updateOwnValues: 8388608; ownDepth: 64;
    arrayElements: 8192; recordFields: 64; keyCharacters: 128; stringCharacters: 262144;
    authoredCodecDepth: 12; authoredCodecValues: 65536; authoredCodecRecordFields: 16;
    authoredCodecDecodedStringCharacters: 262144 };
}
export interface SourceKnotRecipeLoftGraphResult {
  document: SourceKnotRecipeLoftGraphV0; options: SourceKnotRecipeLoftGraphOptions;
  sourceEdits: Triple<SourceCurveControlPolygonResult>;
  refinement: Triple<SourceCurveKnotInsertionResult | null>;
  terminal: SourceKnotAlignedLoftResult; bindings: Bindings; report: SourceKnotRecipeLoftGraphReport;
}
export interface SourceKnotRecipeLoftGraphTransactionReport {
  schema: 'barocss-source-knot-recipe-loft-graph-transaction'; version: 0;
  graphId: string; previousRevision: number; revision: number; noOp: boolean;
  changedSourceNodeIds: string[]; sourceEffectNodeIds: string[];
  rebuiltRefinementNodeIds: string[]; reusedSourceNodeIds: string[]; reusedRefinementNodeIds: string[];
  recipeChanged: boolean; suppressionChanged: boolean; resumed: boolean;
  terminalAction: 'rebuilt' | 'retained';
  directCounts: { sourceEditCallCount: number; refinementInsertionCallCount: number;
    terminalBuildCallCount: 0 | 1; oldGraphCallCount: 0; rootCurveD0Count: 0;
    rootCurveD1Count: 0; rootSurfaceD0Count: 0; rootSurfaceD1Count: 0 };
  validationCounts: { previousGraphRebuildCount: 1; providers: ProviderCounts };
  changedProviderCounts: ProviderCounts;
  fileSizes: { update: Size }; atomic: true; unchangedNativeReceiptsCopied: true;
  workScope: 'actual-selective-work-with-prior-cold-validation-reported-separately';
}
export interface SourceKnotRecipeLoftGraphTransaction {
  request: { previousDocument: SourceKnotRecipeLoftGraphV0;
    options: SourceKnotRecipeLoftGraphOptions; edits: SourceKnotRecipeLoftGraphEdits };
  report: SourceKnotRecipeLoftGraphTransactionReport;
}
export interface SourceKnotRecipeLoftGraphUpdateResult {
  result: SourceKnotRecipeLoftGraphResult; transaction: SourceKnotRecipeLoftGraphTransaction;
}
const CODE = SourceKnotRecipeLoftGraphDiagnosticCode;
const CURRENT_LIMIT = 16777216;
const UPDATE_LIMIT = 33554432;
const AUTHORED_LIMIT = 2097152;
const LIMITS: SourceKnotRecipeLoftGraphReport['limits'] = {
  maximumSourceEdits: 3, maximumRefinementInsertions: 3, maximumLoftSections: 3,
  maximumProducerEvaluations: 7, maximumLogicalNodes: 5, maximumSelectedDegree: 5,
  maximumSelectedUPoles: 16, maximumPoleEditsPerNode: 16, maximumRevision: 1000000000,
  maximumModelObjects: 16, selectedCoordinateAbsMM: 10000,
  maximumSourceUTF16: 262144, maximumSourceUTF8: 262144,
  maximumAggregateOriginalSourceUTF16: 786432, maximumAggregateOriginalSourceUTF8: 786432,
  maximumAuthoredUTF16: 2097152, maximumAuthoredUTF8: 2097152,
  maximumResultUTF16: 16777216, maximumResultUTF8: 16777216,
  maximumUpdateUTF16: 33554432, maximumUpdateUTF8: 33554432,
  ownValues: 4194304, updateOwnValues: 8388608, ownDepth: 64,
  arrayElements: 8192, recordFields: 64, keyCharacters: 128, stringCharacters: 262144,
  authoredCodecDepth: 12, authoredCodecValues: 65536, authoredCodecRecordFields: 16,
  authoredCodecDecodedStringCharacters: 262144,
};

function check(condition: boolean, code: SourceKnotRecipeLoftGraphDiagnosticCode,
  detail: string): asserts condition {
  if (!condition) throw new SourceKnotRecipeLoftGraphError(code, detail);
}
function record(input: unknown, fields: string[],
  code: SourceKnotRecipeLoftGraphDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code,
    'An own record is required');
  const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'Exact own fields are required');
  return data;
}
function id(input: unknown): asserts input is string {
  check(typeof input === 'string' && input.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input),
    CODE.IDENTITY, 'ASCII identity1..48 is required');
}
function revision(input: unknown): asserts input is number {
  check(typeof input === 'number' && Number.isInteger(input) && input >= 0 &&
    input <= 1000000000 && !Object.is(input, -0), CODE.REVISION,
  'Revision must be an integer0..1e9 without negative zero');
}
function triple<T>(input: T[]): Triple<T> {
  check(input.length === 3, CODE.BINDING, 'Exactly three ordered entries are required');
  return input as Triple<T>;
}
function snapshot(input: unknown, owned = false, update = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  const budget = owned ? CODE.OWNED : CODE.BUDGET;
  let remaining = update ? 8388608 : 4194304;
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
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'Plain own-data prototypes are required');
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 8193 : 64), budget, 'Own field limit exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 &&
      'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable)),
    code, 'Getters, symbols and hidden fields are refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 8192, budget,
        'Own array limit exceeded');
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
  try { return copy(input, 0); }
  catch (cause) {
    if (cause instanceof SourceKnotRecipeLoftGraphError) throw cause;
    throw new SourceKnotRecipeLoftGraphError(code, 'Own snapshot failed', cause);
  }
}
function same(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => same(value, right[index]));
  }
  if (left !== null && right !== null && typeof left === 'object' && typeof right === 'object') {
    const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
    return Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
  }
  return Object.is(left, right);
}
function utf8(text: string, code: SourceKnotRecipeLoftGraphDiagnosticCode): number {
  try { return cadDocumentOwnUtf8Bytes(text, 'JSON'); }
  catch (cause) { throw new SourceKnotRecipeLoftGraphError(code, 'Malformed Unicode is refused', cause); }
}
/** Count every retained occurrence, literal negative zero, and exactly one newline. */
function fileSize(input: unknown, limit: number): Size {
  let utf16 = 0, bytes = 0;
  const append = (text: string): void => {
    utf16 += text.length;
    bytes += utf8(text, CODE.FILE);
    check(utf16 <= limit && bytes <= limit, CODE.FILE,
      'Complete aggregate JSON exceeds its UTF16 or UTF8 envelope');
  };
  const visit = (value: unknown): void => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
      append(JSON.stringify(value));
    } else if (typeof value === 'number') {
      check(Number.isFinite(value), CODE.FILE, 'Finite JSON numbers are required');
      append(Object.is(value, -0) ? '-0' : JSON.stringify(value));
    } else if (Array.isArray(value)) {
      append('[');
      value.forEach((item, index) => { if (index) append(','); visit(item); });
      append(']');
    } else {
      check(value !== null && typeof value === 'object', CODE.FILE, 'Complete own JSON data required');
      append('{');
      Object.entries(value).forEach(([key, child], index) => {
        if (index) append(',');
        append(JSON.stringify(key)); append(':'); visit(child);
      });
      append('}');
    }
  };
  visit(input); append('\n');
  return { utf16, utf8: bytes };
}
function json(value: unknown): string {
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(json).join(',') + ']';
  check(value !== null && typeof value === 'object', CODE.CODEC, 'Only own JSON data may be encoded');
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + json(child)).join(',') + '}';
}
function delegate<T>(action: () => T, fallback: SourceKnotRecipeLoftGraphDiagnosticCode,
  detail: string): T {
  try { return action(); }
  catch (cause) {
    if (cause instanceof SourceKnotRecipeLoftGraphError) throw cause;
    const childCode = cause !== null && typeof cause === 'object' && 'code' in cause ?
      (cause as { code: unknown }).code : null;
    const code = typeof childCode === 'string' && Object.hasOwn(CODE, childCode) ?
      CODE[childCode as keyof typeof CODE] : fallback;
    throw new SourceKnotRecipeLoftGraphError(code, detail, cause);
  }
}
function literalEdits(input: unknown): CurveControlPolygonEdits {
  const data = record(input, ['poleEdits']);
  check(Array.isArray(data.poleEdits) && data.poleEdits.length >= 1 && data.poleEdits.length <= 16,
    CODE.BUDGET, 'Exactly1..16 literal original-pole edits are required');
  const indices = new Set<number>();
  for (const value of data.poleEdits) {
    check(value !== null && typeof value === 'object' && !Array.isArray(value), CODE.INPUT,
      'Each pole edit must be an own literal record');
    const pole = value as Record<string, unknown>, keys = Object.keys(pole);
    check(Object.hasOwn(pole, 'index') && keys.length >= 2 && keys.length <= 5 &&
      keys.every(key => ['index', 'xMM', 'yMM', 'zMM', 'weight'].includes(key)), CODE.INPUT,
    'An original index and nonempty existing scalar subset are required');
    check(typeof pole.index === 'number' && Number.isInteger(pole.index) && pole.index >= 0 &&
      !indices.has(pole.index), CODE.INPUT, 'Unique nonnegative original pole indices are required');
    indices.add(pole.index);
    for (const key of keys) if (key !== 'index') {
      check(typeof pole[key] === 'number' && Number.isFinite(pole[key]), CODE.INPUT,
        'Finite literal scalar replacements are required');
    }
  }
  return input as CurveControlPolygonEdits;
}
function admit(documentInput: unknown, optionsInput: unknown): {
  document: SourceKnotRecipeLoftGraphV0; options: SourceKnotRecipeLoftGraphOptions;
} {
  const options = record(optionsInput, ['maximumSourceEdits', 'maximumRefinementInsertions',
    'maximumLoftSections', 'maximumProducerEvaluations']);
  check(options.maximumSourceEdits === 3 && options.maximumRefinementInsertions === 3 &&
    options.maximumLoftSections === 3 && options.maximumProducerEvaluations === 7, CODE.BUDGET,
  'Fixed graph producer budgets3/3/3/7 are required');
  const data = record(documentInput, ['format', 'version', 'id', 'revision', 'lengthUnit',
    'sourceFrame', 'assets', 'sourceEdits', 'refinement', 'terminal']);
  check(data.format === 'barocss-source-knot-recipe-loft-graph' && Object.is(data.version, 0),
    CODE.VERSION, 'Only the literal source knot-recipe graph format/version0 is supported');
  id(data.id); revision(data.revision);
  check(data.lengthUnit === 'mm' && data.sourceFrame === 'authored-xyz-no-axis-conversion',
    CODE.INPUT, 'Explicit authored mm/XYZ frame is required');
  const logical = new Set<string>([data.id]);
  const unique = (value: unknown): string => {
    id(value); check(!logical.has(value), CODE.IDENTITY, 'Graph, source and logical roles must be distinct');
    logical.add(value); return value;
  };
  check(Array.isArray(data.assets) && data.assets.length === 3, CODE.BUDGET,
    'Exactly three complete original source assets are required');
  const sourceIds = new Set<string>();
  let units = 0, bytes = 0;
  for (const value of data.assets) {
    const asset = record(value, ['sourceId', 'sourceVersion', 'source', 'curveId']);
    sourceIds.add(unique(asset.sourceId)); id(asset.curveId);
    check(Object.is(asset.sourceVersion, 0), CODE.VERSION, 'Literal sourceVersion0 is required');
    check(typeof asset.source === 'string', CODE.INPUT, 'Complete original Source0 is required');
    const length = asset.source.length, size = utf8(asset.source, CODE.SOURCE);
    check(length <= 262144 && size <= 262144, CODE.BUDGET, 'Each original source must fit262144');
    units += length; bytes += size;
  }
  check(units <= 786432 && bytes <= 786432, CODE.BUDGET, 'Three-source aggregate limit exceeded');
  check(Array.isArray(data.sourceEdits) && data.sourceEdits.length === 3, CODE.BUDGET,
    'Exactly three independent literal source-edit nodes are required');
  const nodeIds = new Set<string>(), usedSources = new Set<string>();
  for (const value of data.sourceEdits) {
    const node = record(value, ['id', 'kind', 'sourceId', 'edits']);
    nodeIds.add(unique(node.id)); id(node.sourceId);
    check(node.kind === 'source-curve-edit', CODE.INPUT, 'Only literal source-curve-edit nodes are supported');
    check(sourceIds.has(node.sourceId) && !usedSources.has(node.sourceId), CODE.REFERENCE,
      'Each scalar node must use one distinct declared original asset exactly once');
    usedSources.add(node.sourceId); literalEdits(node.edits);
  }
  const recipe = record(data.refinement, ['id', 'kind', 'knot', 'suppressed']);
  unique(recipe.id);
  check(recipe.kind === 'shared-original-curve-knot', CODE.INPUT, 'One shared original-knot recipe required');
  check(typeof recipe.knot === 'number' && Number.isFinite(recipe.knot), CODE.REQUEST,
    'The shared original knot must be finite, including while bypassed');
  check(typeof recipe.suppressed === 'boolean', CODE.INPUT, 'Explicit boolean refinement suppression required');
  const terminal = record(data.terminal, ['id', 'kind', 'sections', 'parametersV', 'options']);
  unique(terminal.id);
  check(terminal.kind === 'source-knot-aligned-loft', CODE.INPUT, 'One actual source-knot-aligned Loft required');
  check(Array.isArray(terminal.sections) && terminal.sections.length === 3 &&
    terminal.sections.every(value => typeof value === 'string' && nodeIds.has(value)) &&
    new Set(terminal.sections).size === 3, CODE.REFERENCE,
  'Terminal sections must be an ordered permutation of the three source-edit nodes');
  check(Array.isArray(terminal.parametersV) && terminal.parametersV.length === 3 &&
    terminal.parametersV.every(value => typeof value === 'number' && Number.isFinite(value)),
  CODE.STATIONS, 'Exactly three finite original V stations are required');
  const v = terminal.parametersV as number[];
  check(v[1] > v[0] && v[2] > v[1] && Number.isFinite(v[1] - v[0]) &&
    Number.isFinite(v[2] - v[1]) && Number.isFinite(v[2] - v[0]), CODE.STATIONS,
  'Adjacent and full original V spans must be finite and strictly positive');
  const t = record(terminal.options, ['evaluationId', 'constructionSourceId', 'modelName', 'surfaceId',
    'constructionSectionIds', 'maximumSections', 'maximumAlignedUPoles', 'maximumInsertionCalls']);
  id(t.evaluationId); id(t.modelName); id(t.surfaceId); unique(t.constructionSourceId);
  check(t.maximumSections === 3 && t.maximumAlignedUPoles === 16 && t.maximumInsertionCalls === 28,
    CODE.BUDGET, 'Unchanged terminal fixed budgets3/16/28 are required');
  check(Array.isArray(t.constructionSectionIds) && t.constructionSectionIds.length === 3,
    CODE.IDENTITY, 'Three explicit construction-copy Curve IDs are required');
  t.constructionSectionIds.forEach(id);
  check(new Set([...t.constructionSectionIds, t.surfaceId]).size === 4, CODE.IDENTITY,
    'Construction-copy Curve IDs and Surface ID must be distinct');
  const document = data as unknown as SourceKnotRecipeLoftGraphV0;
  const settings = options as unknown as SourceKnotRecipeLoftGraphOptions;
  fileSize(document, AUTHORED_LIMIT);
  fileSize({ document, options: settings }, AUTHORED_LIMIT);
  return { document, options: settings };
}

function assetFor(document: SourceKnotRecipeLoftGraphV0, node: SourceEdit): Asset {
  const asset = document.assets.find(value => value.sourceId === node.sourceId);
  check(asset !== undefined, CODE.REFERENCE, 'Scalar node must resolve its declared original source');
  return asset;
}
function scalarIndex(document: SourceKnotRecipeLoftGraphV0, nodeId: string): number {
  const index = document.sourceEdits.findIndex(node => node.id === nodeId);
  check(index >= 0, CODE.REFERENCE, 'Terminal section must resolve a declared scalar node');
  return index;
}
function scalar(document: SourceKnotRecipeLoftGraphV0, index: number): SourceCurveControlPolygonResult {
  const node = document.sourceEdits[index], asset = assetFor(document, node);
  const result = delegate(() => editSourceCurveControlPolygon({ source: asset.source,
    sourceVersion: 0, curveId: asset.curveId, edits: node.edits }), CODE.SOURCE,
  'Actual complete-source original-pole writer refused');
  check(same(result.request, { source: asset.source, sourceVersion: 0,
    curveId: asset.curveId, edits: node.edits }) && result.curve.id === asset.curveId &&
    same(result.model.objects[result.report.selectedObjectIndex], result.curve), CODE.BINDING,
  'Actual scalar receipt must bind its declared original asset and candidate Curve');
  return result;
}
function basis(curve: Curve): { degree: number; poleCount: number; knots: number[]; domain: [number, number] } {
  return { degree: curve.degree, poleCount: curve.controlPoints.length, knots: curve.knots,
    domain: [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]] };
}
function commonBasis(curves: Curve[], maximum: number): ReturnType<typeof basis> {
  check(curves.length === 3, CODE.BINDING, 'Three actual native Curves are required');
  const first = basis(curves[0]);
  for (const curve of curves) {
    check(Number.isInteger(curve.degree) && curve.degree >= 1 && curve.degree <= 5 &&
      curve.controlPoints.length <= maximum && curve.weights.length === curve.controlPoints.length &&
      curve.knots.length === curve.controlPoints.length + curve.degree + 1, CODE.BUDGET,
    'Selected common basis must fit native degree1..5 and the current U-pole capacity');
    check(curve.controlPoints.every(point => point.every(value =>
      Number.isFinite(value) && Math.abs(value) <= 10000)) &&
      curve.weights.every(value => Number.isFinite(value) && value >= 0.000001 && value <= 1000000),
    CODE.BUDGET, 'Actual selected coefficients must fit the unchanged terminal native profile');
    check(same(basis(curve), first), CODE.BASIS,
      'Actual three Curves must have identical degree, count, knot and domain bits');
  }
  return first;
}
function preflight(document: SourceKnotRecipeLoftGraphV0,
  results: Triple<SourceCurveControlPolygonResult>): ReturnType<typeof basis> {
  const originals = results.map(result => {
    const value = result.originalModel.objects[result.report.selectedObjectIndex];
    check(value !== undefined && value.kind === 'curve', CODE.BINDING,
      'Scalar selected original object must remain an actual Curve');
    check(same(basis(value), basis(result.curve)) && value.id === result.curve.id &&
      same(result.report.domain, basis(value).domain), CODE.BINDING,
    'Scalar writer must retain the actual original parameter basis, native domain and identity');
    return value;
  });
  commonBasis(originals, 16);
  const current = commonBasis(results.map(result => result.curve), 16);
  const knot = document.refinement.knot;
  check(Number.isFinite(knot) && knot > current.domain[0] && knot < current.domain[1], CODE.REQUEST,
    'Shared knot must lie strictly inside the current unrefined original domain, even while bypassed');
  for (const result of results) {
    const curve = result.curve;
    check(curve.knots.filter(value => value === knot).length < curve.degree, CODE.REQUEST,
      'One insertion must remain below or at original interior degree multiplicity');
    check(knot !== 0 || curve.knots.every(value => value !== 0 || Object.is(value, knot)),
      CODE.REQUEST, 'An existing numeric zero knot must agree with the requested zero bits');
  }
  if (!document.refinement.suppressed) {
    check(current.poleCount + 1 <= 16, CODE.BUDGET,
      'Active refinement must fit final U16 before any insertion call');
  }
  return current;
}
function refinementMatches(result: SourceCurveKnotInsertionResult,
  source: SourceCurveControlPolygonResult, knot: number): boolean {
  return same(result.request, { source: source.source, sourceVersion: 0,
    curveId: source.curve.id, knot, maximumObservations: 128 }) &&
    same(result.originalModel, source.model) && same(result.originalCurve, source.curve);
}
function refine(source: SourceCurveControlPolygonResult, knot: number): SourceCurveKnotInsertionResult {
  const result = delegate(() => insertSourceCurveKnot({ source: source.source, sourceVersion: 0,
    curveId: source.curve.id, knot, maximumObservations: 128 }), CODE.INSERTION,
  'Actual complete-source single-knot insertion refused');
  check(refinementMatches(result, source, knot), CODE.BINDING,
    'Actual insertion must bind the current unrefined scalar source, Model and Curve');
  return result;
}
function terminalRequest(document: SourceKnotRecipeLoftGraphV0,
  scalars: Triple<SourceCurveControlPolygonResult>,
  refinements: Triple<SourceCurveKnotInsertionResult | null>): SourceKnotAlignedLoftRequest {
  const assets = document.terminal.sections.map((nodeId, sectionIndex) => {
    const index = scalarIndex(document, nodeId), node = document.sourceEdits[index];
    const source = scalars[index], refined = refinements[sectionIndex];
    check(document.refinement.suppressed ? refined === null : refined !== null &&
      refinementMatches(refined, source, document.refinement.knot), CODE.BINDING,
    'Every ordered refinement receipt must bind its current explicit scalar node');
    return { sourceId: node.sourceId, sourceVersion: 0 as const,
      source: refined === null ? source.source : refined.source, curveId: source.curve.id };
  });
  const curves = document.terminal.sections.map((nodeId, sectionIndex) =>
    refinements[sectionIndex]?.curve ?? scalars[scalarIndex(document, nodeId)].curve);
  commonBasis(curves, 16);
  return { assets: triple(assets), parametersV: document.terminal.parametersV,
    options: document.terminal.options };
}
function terminal(request: SourceKnotAlignedLoftRequest): SourceKnotAlignedLoftResult {
  const result = delegate(() => buildSourceKnotAlignedLoft(request), CODE.LOFT,
    'Actual terminal source-knot-aligned Loft refused');
  check(same(result.request, request) && result.insertions.length === 0 &&
    result.report.insertionCount === 0 && result.report.directCounts.sourceInsertionCallCount === 0 &&
    result.plan.insertionCount === 0 && result.plan.sections.every(section => section.missingKnots.length === 0),
  CODE.BINDING, 'Terminal must retain the actual requested contexts with zero additional alignment insertions');
  return result;
}
function prefix(document: SourceKnotRecipeLoftGraphV0, options: SourceKnotRecipeLoftGraphOptions,
  scalars: SourceCurveControlPolygonResult[], refinements: (SourceCurveKnotInsertionResult | null)[],
  loft: SourceKnotAlignedLoftResult | null): void {
  const full = { document, options, sourceEdits: scalars, refinement: refinements, terminal: loft };
  fileSize(full, CURRENT_LIMIT);
  snapshot(full);
}
function emptyProviderCounts(): ProviderCounts {
  return { sourceEditCallCount: 0, refinementInsertionCallCount: 0, terminalBuildCallCount: 0,
    nestedLoftBuildCallCount: 0, sourceCompilationCount: 0, nativeCurveValidationCount: 0,
    nativeSurfaceValidationCount: 0, curveDomainQueryCount: 0, surfaceDomainQueryCount: 0,
    curveD0Count: 0, curveD1AttemptCount: 0, surfaceD0Count: 0, surfaceD1AttemptCount: 0,
    curveD1EvaluatedCount: 0, curveD1RefusedCount: 0, surfaceD1EvaluatedCount: 0,
    surfaceD1RefusedCount: 0, basisEvaluationCount: 0, decimalEmissionCount: 0 };
}
function providerCounts(scalars: SourceCurveControlPolygonResult[],
  refinements: (SourceCurveKnotInsertionResult | null)[],
  loft: SourceKnotAlignedLoftResult | null): ProviderCounts {
  const counts = emptyProviderCounts();
  for (const result of scalars) {
    const d = result.report.directCounts;
    counts.sourceEditCallCount++;
    counts.sourceCompilationCount += d.originalCompileCount + d.candidateCompileCount;
    counts.nativeCurveValidationCount += d.nativeCurveValidationCount;
    counts.curveDomainQueryCount += d.domainQueryCount;
    counts.curveD0Count += d.curvePointEvaluationCount;
    counts.curveD1AttemptCount += d.curveDerivativeEvaluationCount;
    counts.curveD1EvaluatedCount += d.derivativeSuccessCount;
    counts.curveD1RefusedCount += d.derivativeRefusalCount;
    counts.decimalEmissionCount += d.decimalEmissionCount;
  }
  for (const result of refinements) if (result !== null) {
    const d = result.report.directCounts;
    counts.refinementInsertionCallCount++;
    counts.sourceCompilationCount += d.originalCompileCount + d.candidateCompileCount;
    counts.nativeCurveValidationCount += d.nativeCurveValidationCount;
    counts.curveDomainQueryCount += d.domainQueryCount;
    counts.curveD0Count += d.curveD0Count;
    counts.curveD1AttemptCount += d.curveD1AttemptCount;
    counts.curveD1EvaluatedCount += d.curveD1EvaluatedCount;
    counts.curveD1RefusedCount += d.curveD1RefusedCount;
    counts.decimalEmissionCount += d.decimalEmissionCount;
  }
  if (loft !== null) {
    const d = loft.report.directCounts, l = loft.loft.report.directCounts;
    check(d.sourceInsertionCallCount === 0, CODE.BINDING, 'Terminal delegation cannot hide alignment work');
    counts.terminalBuildCallCount++;
    counts.nestedLoftBuildCallCount += d.loftBuildCallCount;
    counts.sourceCompilationCount += d.originalCompileCount + l.sourceCompilationCount;
    counts.nativeCurveValidationCount += d.nativeCurveValidationCount + l.curveValidationCount;
    counts.nativeSurfaceValidationCount += l.surfaceValidationCount;
    counts.curveDomainQueryCount += d.domainQueryCount + l.curveDomainQueryCount;
    counts.surfaceDomainQueryCount += l.surfaceDomainQueryCount;
    counts.curveD0Count += l.curvePointEvaluationCount;
    counts.surfaceD0Count += l.surfacePointEvaluationCount;
    counts.surfaceD1AttemptCount += l.surfaceDerivativeEvaluationCount;
    counts.surfaceD1EvaluatedCount += l.derivativeSuccessCount;
    counts.surfaceD1RefusedCount += l.derivativeRefusalCount;
    counts.basisEvaluationCount += l.basisEvaluationCount;
    counts.decimalEmissionCount += l.decimalEmissionCount;
  }
  return counts;
}

function assemble(document: SourceKnotRecipeLoftGraphV0, options: SourceKnotRecipeLoftGraphOptions,
  scalars: Triple<SourceCurveControlPolygonResult>,
  refinements: Triple<SourceCurveKnotInsertionResult | null>,
  loft: SourceKnotAlignedLoftResult): SourceKnotRecipeLoftGraphResult {
  const scalarBasis = preflight(document, scalars);
  const request = terminalRequest(document, scalars, refinements);
  check(same(loft.request, request), CODE.BINDING, 'Retained terminal must bind the complete current ordered request');
  prefix(document, options, scalars, refinements, loft);
  const status = document.refinement.suppressed ? 'bypassed' as const : 'active' as const;
  const bindings: Bindings = {
    graphId: document.id, revision: document.revision,
    sources: triple(document.sourceEdits.map((node, index) => {
      const terminalSectionIndex = document.terminal.sections.indexOf(node.id);
      check(terminalSectionIndex >= 0, CODE.REFERENCE, 'Every scalar node must have one terminal slot');
      const refined = refinements[terminalSectionIndex], result = scalars[index];
      return { nodeId: node.id, sourceId: node.sourceId, curveId: result.curve.id,
        modelName: refined?.model.name ?? result.model.name,
        objectIndex: refined?.provenance.selectedObjectIndex ?? result.report.selectedObjectIndex,
        status: refined === null ? 'scalar' as const : 'refined' as const,
        scalarObjectIndex: result.report.selectedObjectIndex, terminalSectionIndex };
    })),
    refinement: { nodeId: document.refinement.id, status, inputNodeIds: document.terminal.sections },
    terminal: { nodeId: document.terminal.id, sourceId: loft.bindings.output.sourceId,
      modelName: loft.bindings.output.modelName, surfaceId: loft.bindings.output.surfaceId,
      sectionNodeIds: document.terminal.sections,
      constructionSectionIds: document.terminal.options.constructionSectionIds,
      sections: loft.bindings.sections, output: loft.bindings.output },
  };
  const report: SourceKnotRecipeLoftGraphReport = {
    schema: 'barocss-source-knot-recipe-loft-graph-report', version: 0,
    graphId: document.id, revision: document.revision, lengthUnit: 'mm',
    sourceFrame: 'authored-xyz-no-axis-conversion',
    sourceIds: triple(document.sourceEdits.map(node => node.sourceId)),
    sourceModelNames: triple(scalars.map(value => value.originalModel.name)),
    nodeOrder: [...document.sourceEdits.map(node => node.id), document.refinement.id, document.terminal.id],
    dependencies: [...document.sourceEdits.map(node => ({ nodeId: node.id, dependencyNodeIds: [] as string[] })),
      { nodeId: document.refinement.id, dependencyNodeIds: document.terminal.sections },
      { nodeId: document.terminal.id, dependencyNodeIds: [document.refinement.id] }],
    sectionNodeIds: document.terminal.sections, refinementStatus: status,
    degreeU: scalarBasis.degree, scalarUPoleCount: scalarBasis.poleCount,
    outputUPoleCount: loft.report.alignedUPoleCount, domainU: scalarBasis.domain,
    parametersV: document.terminal.parametersV,
    receiptCounts: { sourceEditReceiptCount: 3, refinementReceiptCount: document.refinement.suppressed ? 0 : 3,
      terminalReceiptCount: 1, terminalAlignmentInsertionCount: 0, nestedLoftReceiptCount: 1 },
    retainedProviderCounts: providerCounts(scalars, refinements, loft),
    authority: 'complete-authored-sources-and-literal-original-pole-recipes',
    reconstruction: 'whole-current-document-and-options-no-operation-history',
    workScope: 'retained-receipts-not-selective-constructor-call-counts',
    fileSizes: { authored: fileSize(document, AUTHORED_LIMIT),
      request: fileSize({ document, options }, AUTHORED_LIMIT), result: { utf16: 0, utf8: 0 } },
    quality: { completeOriginalSourcesRetained: true, unrelatedSourceGeometryPreserved: true,
      sourceQualifiedBindings: true, originalSelectedIdsPreserved: true,
      independentWeightsPreserved: true, terminalZeroAlignment: true, ownedRebuild: true,
      affectedOnlyUpdates: true, expressionGraph: false, sharedSourceGraph: false,
      smoothLoft: false, G1: false, G2: false, topologyCertified: false, solid: false,
      globalBinary64ErrorCertified: false, manufacturing: false, editorDisplay: false,
      persistentTopologyBinding: false, publication: false, ownership: 'independent-copied-cpu-data-gc' },
    limits: LIMITS,
  };
  const result: SourceKnotRecipeLoftGraphResult = {
    document, options, sourceEdits: scalars, refinement: refinements, terminal: loft, bindings, report,
  };
  let stable = false;
  for (let pass = 0; pass < 8; pass++) {
    const size = fileSize(result, CURRENT_LIMIT);
    if (same(size, report.fileSizes.result)) { stable = true; break; }
    report.fileSizes.result = size;
  }
  check(stable, CODE.FILE, 'Complete current result size metadata must settle within8 passes');
  return snapshot(result) as SourceKnotRecipeLoftGraphResult;
}

/** Reuse only the three actual scalar writers, one insertion per active branch, and the full terminal. */
export function evaluateSourceKnotRecipeLoftGraph(documentInput: SourceKnotRecipeLoftGraphV0,
  optionsInput: SourceKnotRecipeLoftGraphOptions): SourceKnotRecipeLoftGraphResult {
  const data = record(snapshot({ document: documentInput, options: optionsInput }), ['document', 'options']);
  const { document, options } = admit(data.document, data.options);
  const scalars: SourceCurveControlPolygonResult[] = [];
  const refinements: Triple<SourceCurveKnotInsertionResult | null> = [null, null, null];
  prefix(document, options, scalars, refinements, null);
  for (let index = 0; index < 3; index++) {
    prefix(document, options, scalars, refinements, null);
    scalars.push(scalar(document, index));
    prefix(document, options, scalars, refinements, null);
  }
  const selected = triple(scalars);
  preflight(document, selected);
  if (!document.refinement.suppressed) {
    for (let sectionIndex = 0; sectionIndex < 3; sectionIndex++) {
      prefix(document, options, selected, refinements, null);
      const index = scalarIndex(document, document.terminal.sections[sectionIndex]);
      refinements[sectionIndex] = refine(selected[index], document.refinement.knot);
      prefix(document, options, selected, refinements, null);
    }
  }
  const request = terminalRequest(document, selected, refinements);
  prefix(document, options, selected, refinements, null);
  const loft = terminal(request);
  prefix(document, options, selected, refinements, loft);
  return assemble(document, options, selected, refinements, loft);
}
function rebuild(input: unknown): SourceKnotRecipeLoftGraphResult {
  const owned = record(snapshot(input, true), ['document', 'options', 'sourceEdits', 'refinement',
    'terminal', 'bindings', 'report'], CODE.OWNED) as unknown as SourceKnotRecipeLoftGraphResult;
  let expected: SourceKnotRecipeLoftGraphResult;
  try {
    fileSize(owned, CURRENT_LIMIT);
    expected = evaluateSourceKnotRecipeLoftGraph(owned.document, owned.options);
  }
  catch (cause) {
    throw new SourceKnotRecipeLoftGraphError(CODE.OWNED, 'Whole current authored graph reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED,
    'Owned source edits, refinements, terminal, copy bindings, native receipts, counts or sizes changed');
  return expected;
}
/** Reconstruct exactly once from authored authority and compare all retained data. */
export function validateSourceKnotRecipeLoftGraph(input: SourceKnotRecipeLoftGraphResult): SourceKnotRecipeLoftGraphReport {
  return snapshot(rebuild(input).report, true) as SourceKnotRecipeLoftGraphReport;
}
function updateEdits(input: unknown, previous: SourceKnotRecipeLoftGraphV0): SourceKnotRecipeLoftGraphEdits {
  const data = record(snapshot(input), ['expectedRevision', 'revision', 'nodeEdits',
    'refinementKnot', 'refinementSuppressed']);
  revision(data.expectedRevision); revision(data.revision);
  check(data.expectedRevision === previous.revision && data.revision === previous.revision + 1,
    CODE.REVISION, 'Expected current revision and exact previous+1 are required');
  check(Array.isArray(data.nodeEdits) && data.nodeEdits.length <= 3, CODE.BUDGET,
    'At most three unique existing source-node recipe setters are supported');
  check(data.refinementKnot === null || typeof data.refinementKnot === 'number' &&
    Number.isFinite(data.refinementKnot), CODE.REQUEST, 'Explicit finite shared knot or null is required');
  check(data.refinementSuppressed === null || typeof data.refinementSuppressed === 'boolean',
    CODE.INPUT, 'Explicit refinement suppression boolean or null is required');
  check(data.nodeEdits.length > 0 || data.refinementKnot !== null || data.refinementSuppressed !== null,
    CODE.INPUT, 'At least one explicit literal setter is required');
  const requested = new Set<string>();
  for (const value of data.nodeEdits) {
    const node = record(value, ['nodeId', 'edits']); id(node.nodeId);
    check(!requested.has(node.nodeId), CODE.INPUT, 'Duplicate scalar node setter is refused');
    requested.add(node.nodeId);
    check(previous.sourceEdits.some(item => item.id === node.nodeId), CODE.REFERENCE,
      'Only existing original scalar-node recipes may be changed');
    literalEdits(node.edits);
  }
  return data as unknown as SourceKnotRecipeLoftGraphEdits;
}
/** Internal only: callers provide one freshly reconstructed, whole-qualified prior graph. */
function applyUpdate(previous: SourceKnotRecipeLoftGraphResult,
  editsInput: SourceKnotRecipeLoftGraphEdits): SourceKnotRecipeLoftGraphUpdateResult {
  const edits = updateEdits(editsInput, previous.document);
  const document = snapshot(previous.document) as SourceKnotRecipeLoftGraphV0;
  document.revision = edits.revision;
  const changed = new Set<string>();
  for (const setter of edits.nodeEdits) {
    const node = document.sourceEdits[scalarIndex(document, setter.nodeId)];
    if (!same(node.edits, setter.edits)) {
      node.edits = setter.edits;
      changed.add(node.id);
    }
  }
  if (edits.refinementKnot !== null) document.refinement.knot = edits.refinementKnot;
  if (edits.refinementSuppressed !== null) document.refinement.suppressed = edits.refinementSuppressed;
  admit(document, previous.options);
  const recipeChanged = !Object.is(document.refinement.knot, previous.document.refinement.knot);
  const suppressionChanged = document.refinement.suppressed !== previous.document.refinement.suppressed;
  const resumed = previous.document.refinement.suppressed && !document.refinement.suppressed;
  const scalars = triple([...previous.sourceEdits]);
  const refinements = triple([...previous.refinement]);
  const changedScalars: SourceCurveControlPolygonResult[] = [];
  const changedRefinements: SourceCurveKnotInsertionResult[] = [];
  const effects = new Set<string>(), rebuiltRefinements = new Set<string>();
  prefix(document, previous.options, scalars, refinements, previous.terminal);
  for (let index = 0; index < 3; index++) {
    const node = document.sourceEdits[index];
    if (!changed.has(node.id)) continue;
    prefix(document, previous.options, scalars, refinements, previous.terminal);
    const result = scalar(document, index);
    changedScalars.push(result);
    if (result.source !== scalars[index].source) effects.add(node.id);
    else check(same(result.model, scalars[index].model) && same(result.curve, scalars[index].curve),
      CODE.BINDING, 'Equal actual source bytes must retain equal actual scalar coefficients');
    scalars[index] = result;
    prefix(document, previous.options, scalars, refinements, previous.terminal);
  }
  preflight(document, scalars);
  for (let sectionIndex = 0; sectionIndex < 3; sectionIndex++) {
    const nodeId = document.terminal.sections[sectionIndex], index = scalarIndex(document, nodeId);
    if (document.refinement.suppressed) {
      refinements[sectionIndex] = null;
    } else if (recipeChanged || resumed || effects.has(nodeId)) {
      prefix(document, previous.options, scalars, refinements, previous.terminal);
      const result = refine(scalars[index], document.refinement.knot);
      changedRefinements.push(result); rebuiltRefinements.add(nodeId);
      refinements[sectionIndex] = result;
    } else {
      const retained = refinements[sectionIndex];
      check(retained !== null && refinementMatches(retained, scalars[index], document.refinement.knot),
        CODE.BINDING, 'Unchanged refinement must retain its complete current unrefined input binding');
    }
    prefix(document, previous.options, scalars, refinements, previous.terminal);
  }
  const request = terminalRequest(document, scalars, refinements);
  const terminalChanged = !same(request, previous.terminal.request);
  prefix(document, previous.options, scalars, refinements, previous.terminal);
  const loft = terminalChanged ? terminal(request) : previous.terminal;
  prefix(document, previous.options, scalars, refinements, loft);
  const result = assemble(document, previous.options, scalars, refinements, loft);
  const report: SourceKnotRecipeLoftGraphTransactionReport = {
    schema: 'barocss-source-knot-recipe-loft-graph-transaction', version: 0,
    graphId: document.id, previousRevision: previous.document.revision, revision: document.revision,
    noOp: changed.size === 0 && !recipeChanged && !suppressionChanged,
    changedSourceNodeIds: document.sourceEdits.filter(node => changed.has(node.id)).map(node => node.id),
    sourceEffectNodeIds: document.sourceEdits.filter(node => effects.has(node.id)).map(node => node.id),
    rebuiltRefinementNodeIds: document.terminal.sections.filter(nodeId => rebuiltRefinements.has(nodeId)),
    reusedSourceNodeIds: document.sourceEdits.filter(node => !changed.has(node.id)).map(node => node.id),
    reusedRefinementNodeIds: document.refinement.suppressed ? [] :
      document.terminal.sections.filter(nodeId => !rebuiltRefinements.has(nodeId)),
    recipeChanged, suppressionChanged, resumed, terminalAction: terminalChanged ? 'rebuilt' : 'retained',
    directCounts: { sourceEditCallCount: changedScalars.length,
      refinementInsertionCallCount: changedRefinements.length, terminalBuildCallCount: terminalChanged ? 1 : 0,
      oldGraphCallCount: 0, rootCurveD0Count: 0, rootCurveD1Count: 0, rootSurfaceD0Count: 0, rootSurfaceD1Count: 0 },
    validationCounts: { previousGraphRebuildCount: 1, providers: previous.report.retainedProviderCounts },
    changedProviderCounts: providerCounts(changedScalars, changedRefinements, terminalChanged ? loft : null),
    fileSizes: { update: { utf16: 0, utf8: 0 } }, atomic: true, unchangedNativeReceiptsCopied: true,
    workScope: 'actual-selective-work-with-prior-cold-validation-reported-separately',
  };
  check(changedScalars.length + changedRefinements.length + (terminalChanged ? 1 : 0) <= 7,
    CODE.BUDGET, 'Selective producer stage exceeds seven real direct evaluations');
  const transaction: SourceKnotRecipeLoftGraphTransaction = {
    request: { previousDocument: previous.document, options: previous.options, edits }, report,
  };
  const update: SourceKnotRecipeLoftGraphUpdateResult = { result, transaction };
  let stable = false;
  for (let pass = 0; pass < 8; pass++) {
    const size = fileSize(update, UPDATE_LIMIT);
    if (same(size, report.fileSizes.update)) { stable = true; break; }
    report.fileSizes.update = size;
  }
  check(stable, CODE.FILE, 'Complete update wrapper size metadata must settle within8 passes');
  return snapshot(update, false, true) as SourceKnotRecipeLoftGraphUpdateResult;
}

/** Validate prior authority exactly once, then perform only newly affected producer calls. */
export function updateSourceKnotRecipeLoftGraph(previousInput: SourceKnotRecipeLoftGraphResult,
  editsInput: SourceKnotRecipeLoftGraphEdits): SourceKnotRecipeLoftGraphUpdateResult {
  return applyUpdate(rebuild(previousInput), editsInput);
}
/** Rebuild the authored baseline once, then replay the same selective stage without another cold rebuild. */
export function validateSourceKnotRecipeLoftGraphUpdate(input: SourceKnotRecipeLoftGraphUpdateResult): SourceKnotRecipeLoftGraphTransactionReport {
  const owned = record(snapshot(input, true, true), ['result', 'transaction'], CODE.OWNED);
  const transaction = record(owned.transaction, ['request', 'report'], CODE.OWNED);
  const request = record(transaction.request, ['previousDocument', 'options', 'edits'], CODE.OWNED);
  let expected: SourceKnotRecipeLoftGraphUpdateResult;
  try {
    fileSize(owned, UPDATE_LIMIT);
    const previous = evaluateSourceKnotRecipeLoftGraph(request.previousDocument as SourceKnotRecipeLoftGraphV0,
      request.options as SourceKnotRecipeLoftGraphOptions);
    expected = applyUpdate(previous, request.edits as SourceKnotRecipeLoftGraphEdits);
  } catch (cause) {
    throw new SourceKnotRecipeLoftGraphError(CODE.OWNED,
      'Whole authored baseline and selective transaction reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED,
    'Owned current result, previous authored document, selective actions, phase counts or full update sizes changed');
  return snapshot(expected.transaction.report, true, true) as SourceKnotRecipeLoftGraphTransactionReport;
}
/** Save only authored intent. Acceptance performs one complete actual graph construction. */
export function serializeSourceKnotRecipeLoftGraph(document: SourceKnotRecipeLoftGraphV0,
  options: SourceKnotRecipeLoftGraphOptions): string {
  const accepted = evaluateSourceKnotRecipeLoftGraph(document, options);
  fileSize(accepted.document, AUTHORED_LIMIT);
  return json(accepted.document) + '\n';
}
/** Reuse the unchanged strict own JSON grammar, then perform one complete actual graph construction. */
export function parseSourceKnotRecipeLoftGraph(text: string,
  options: SourceKnotRecipeLoftGraphOptions): SourceKnotRecipeLoftGraphResult {
  check(typeof text === 'string', CODE.CODEC, 'Complete authored JSON text is required');
  check(text.length <= AUTHORED_LIMIT && utf8(text, CODE.CODEC) <= AUTHORED_LIMIT,
    CODE.FILE, 'Authored JSON UTF16 or UTF8 envelope exceeded');
  let document: unknown;
  try { document = parseCadDocumentOwnJson(text); }
  catch (cause) {
    throw new SourceKnotRecipeLoftGraphError(CODE.CODEC, 'Unchanged strict authored JSON grammar refused', cause);
  }
  return evaluateSourceKnotRecipeLoftGraph(document as SourceKnotRecipeLoftGraphV0, options);
}
