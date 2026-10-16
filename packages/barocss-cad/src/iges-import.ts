import { compileCadModel } from './model-compiler.js';
import type { CadCompileResult } from './model-compiler.js';
import { validateCurve, validateSurface, curveDomain, surfaceDomain } from './math.js';
import { curveDecimal } from './curve-source.js';
import type { Curve, Surface, Model, Point } from './types.js';
import { same } from './structural-equality.js';

export const IGESImportDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', FILE: 'FILE', RECORD: 'RECORD', GLOBAL: 'GLOBAL',
  DIRECTORY: 'DIRECTORY', PARAMETER: 'PARAMETER', UNSUPPORTED: 'UNSUPPORTED', BUDGET: 'BUDGET',
  NUMBER: 'NUMBER', NATIVE: 'NATIVE', SOURCE: 'SOURCE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type IGESImportDiagnosticCode = typeof IGESImportDiagnosticCode[keyof typeof IGESImportDiagnosticCode];
export class IGESImportError extends Error {
  readonly code: IGESImportDiagnosticCode;
  constructor(code: IGESImportDiagnosticCode, detail: string, cause?: unknown) {
    super(('Native IGES import: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'IGESImportError';
    this.code = code;
  }
}

type Size = { utf16: number; utf8: number };
type Span = [number, number]; // inclusive start, exclusive end token indices
type NumericData = number | NumericData[];

type GlobalField =
  | { index: number; kind: 'number'; text: string; value: number }
  | { index: number; kind: 'hollerith'; text: string; value: string };
// index is ZERO-based vector position. text is the complete token, excluding
// delimiter/padding, with actual continued Hollerith data retained.
interface IGESImportMetadata { // PRIVATE, not barrel-exported
  startText: string; // original full72-column S body, including right padding
  globals: GlobalField[]; // exactly26, numeric13/Hollerith13
  parameterDelimiter: ',';
  recordDelimiter: ';';
  unitFlag: 2;
  lengthUnit: 'mm';
  modelScale: 1;
  declaredMaximumCoordinateMM: number;
  actualMaximumCoordinateMM: number;
  records: { S: 1; G: number; D: number; P: number; T: 1 };
}
export interface IGESImportOptions {
  sourceId: string; // explicit actual imported source namespace, ASCII1..48
  modelName: string; // compiler identifier, ASCII1..48
  idPrefix: string; // ASCII1..32; generated IDs prefix+'_d'+odd D pointer
  maximumEntities: 16;
  maximumRecords: 8192;
}
type ParameterMapping = {
  firstSequence: number;
  lastSequence: number;
  recordCount: number;
  tokenCount: number;
  header: Span;
  knotsU: Span;
  knotsV: Span | null;
  weights: Span;
  cartesian: Span; // flat scalar positions, not a duplicate point array
  domains: Span;
  normal: Span | null;
};
type CurveFlags = {
  planar: 0; closed: 0; polynomial: 0 | 1; periodic: 0;
  normal: [0, 0, 0];
};
type SurfaceFlags = {
  closedU: 0; closedV: 0; polynomial: 0 | 1; periodicU: 0; periodicV: 0;
};
export interface IGESImportEntity {
  index: number;
  entity: 126 | 128;
  directoryPointer: number; // actual odd D sequence =2*index+1
  parameterPointer: number;
  parameterRecords: number;
  label: string; // decoded label; duplicates permitted
  labelField: string; // original exact8-character field, including padding
  nativeId: string;
  nativeObjectIndex: number;
  degrees: { u: number; v: number | null };
  poleCounts: { u: number; v: number | null; total: number };
  knotCounts: { u: number; v: number | null };
  domain: { u: [number, number]; v: [number, number] | null };
  flags: CurveFlags | SurfaceFlags;
  coefficientOrder: 'curve-pole-order-xyz' | 'surface-u-fastest-to-native-u-v';
  parameterMapping: ParameterMapping;
}
export interface IGESImportReport {
  schema: 'barocss-native-iges-import-report';
  version: 0;
  profile: 'barocss-writer-iges53-untransformed-open-126-128';
  format: 'IGES 5.3 ASCII';
  sourceVersion: 0;
  sourceId: string;
  modelName: string;
  idPrefix: string;
  lengthUnit: 'mm';
  modelScale: 1;
  entityCount: number;
  curveCount: number;
  surfaceCount: number;
  records: { S: 1; G: number; D: number; P: number; T: 1 };
  inputSizes: Size;
  sourceSizes: Size;
  fileSizes: { request: Size; result: Size };
  directoryPointers: number[]; // directory order, at most16
  parameterPointers: number[];
  nativeIds: string[];
  duplicateDirectoryLabelCount: number; // entities minus distinct decoded labels
  fileNegativeZeroTokenCount: number; // Number(full numeric token) is Object.is(-0)
  declaredMaximumCoordinateMM: number;
  actualMaximumCoordinateMM: number;
  directCounts: {
    recordScanCount: number;
    integerFieldParseCount: number;
    tokenScanCount: number;
    numericParseCount: number;
    hollerithParseCount: number;
    nativeCurveValidationCount: number;
    nativeSurfaceValidationCount: number;
    curveDomainQueryCount: number;
    surfaceDomainQueryCount: number;
    fullSourceCompileCount: 1;
    decimalEmissionCount: number;
    curveD0Count: 0;
    curveD1AttemptCount: 0;
    surfaceD0Count: 0;
    surfaceD1AttemptCount: 0;
    rationalOperationCount: 0;
  };
  preservation: {
    completeInputFile: true;
    directoryOrderAndOwnership: true;
    directoryLabelFields: true;
    parsedCoefficientBits: true;
    parsedDomains: true;
    independentWeights: true;
    sourceModelCoefficientBinding: true;
    nativeIdsFromDirectoryPointers: true;
  };
  losses: {
    fileNumberPolicy: 'complete-decimal-token-to-finite-binary64';
    parsedNegativeZeroBitsPreserved: true;
    originalFullNativeIdsRecovered: false;
    originalAuthoredZeroSignsRecovered: false;
    originalSourceSpellingRecovered: false;
    originalFeaturesHistoryRecovered: false;
    originalSourceIncluded: false;
    directoryLabelsMayBeTruncated: true;
    geometryReparameterized: false;
    unitsConverted: false;
    transformsApplied: false;
    sourceMeaning: 'new-imported-geometry-not-original-author-intent';
  };
  quality: {
    nativeGeometryValidated: true;
    sourceCoefficientBinding: true;
    geometryOnly: true;
    generalIGESConformance: false;
    trimmedTopology: false;
    topologyCertified: false;
    solid: false;
    assembly: false;
    smoothnessCertified: false;
    g1g2Certified: false;
    globalBinary64ErrorCertified: false;
    manufacturingToleranceCertified: false;
    editorDisplayCertified: false;
    persistentTopologyBindingCertified: false;
    publication: false;
    ownership: 'independent-copied-cpu-data-gc';
  };
  limits: {
    maximumInputUTF16: 1048576;
    maximumInputUTF8: 1048576;
    maximumRecords: 8192;
    recordCharacters: 80;
    maximumEntities: 16;
    maximumGlobalRecords: 64;
    globalTokenCount: 26;
    maximumTokens: 18000;
    maximumEntityTokens: 1082;
    maximumNumericTokenCharacters: 32;
    maximumHollerithCharacters: 256;
    maximumDegree: 5;
    maximumCurvePoles: 64;
    maximumCurveKnots: 70;
    maximumSurfaceAxisPoles: 16;
    maximumSurfacePoles: 256;
    maximumSurfaceAxisKnots: 22;
    maximumModelObjects: 16;
    coordinateAbsMM: 1000000;
    minimumWeight: 0.000001;
    maximumWeight: 1000000;
    maximumNativeIdCharacters: 48;
    maximumModelNameCharacters: 48;
    maximumIdPrefixCharacters: 32;
    maximumDecimalEmissionCount: 17120;
    maximumSourceLiteralCharacters: 350;
    sourceUTF16: 262144;
    sourceUTF8: 262144;
    maximumRequestFileUTF16: 1048576;
    maximumRequestFileUTF8: 1048576;
    maximumResultFileUTF16: 4194304;
    maximumResultFileUTF8: 4194304;
    ownValues: 1048576;
    ownDepth: 64;
    arrayElements: 8192;
    recordFields: 64;
    keyCharacters: 128;
    stringCharacters: 262144;
    requestIGESStringCharacters: 1048576;
  };
  workScope: 'actual-parser-native-validation-domain-and-full-source-compile-calls-inherited-work-excluded';
  budgetFailure: 'atomic-no-partial-imported-model-or-source';
}
export interface IGESImportResult {
  request: { iges: string; options: IGESImportOptions };
  source: string;
  model: Model;
  metadata: IGESImportMetadata;
  entities: IGESImportEntity[];
  report: IGESImportReport;
}

const CODE = IGESImportDiagnosticCode;
type Section = 'S' | 'G' | 'D' | 'P' | 'T';
type PhysicalRecord = { body: string; sequence: number };
type Sections = Record<Section, PhysicalRecord[]>;
type Counts = IGESImportReport['directCounts'];
type Directory = { entity: 126 | 128; directoryPointer: number; parameterPointer: number;
  parameterRecords: number; labelField: string; label: string };
function check(condition: boolean, code: IGESImportDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new IGESImportError(code, detail);
}
function delegated<T>(action: () => T, code: IGESImportDiagnosticCode, detail: string): T {
  try { return action(); }
  catch (cause) { throw new IGESImportError(code, detail, cause); }
}
function record(input: unknown, fields: string[], code: IGESImportDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required');
  const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'Exact own fields are required');
  return data;
}
function snapshot(input: unknown, owned = false, result = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT, budget = owned ? CODE.OWNED : CODE.BUDGET;
  let remaining = 1048576;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number, path: string[]): unknown => {
    check(--remaining >= 0 && depth <= 64, budget, 'Own value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      check(Number.isFinite(value), code, 'Finite own numbers are required');
      return value;
    }
    if (typeof value === 'string') {
      const raw = result ? path.length === 2 && path[0] === 'request' && path[1] === 'iges' :
        path.length === 1 && path[0] === 'iges';
      check(value.length <= (raw ? 1048576 : 262144), budget,
        'Only the typed request.iges path has the1MiB raw-string exception');
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
    let copied: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 8192, budget, 'Own array limit exceeded');
      check(keys.length === length + 1, code, 'Dense arrays without extra fields are required');
      copied = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'Sparse arrays are refused');
        return copy(descriptors[String(index)].value, depth + 1, [...path, String(index)]);
      });
    } else {
      copied = Object.fromEntries((keys as string[]).map(key =>
        [key, copy(descriptors[key].value, depth + 1, [...path, key])]));
    }
    ancestors.delete(value);
    return copied;
  };
  try { return copy(input, 0, []); }
  catch (cause) {
    if (cause instanceof IGESImportError) throw cause;
    throw new IGESImportError(code, 'Own snapshot failed', cause);
  }
}
function fileSize(input: unknown, limit: number): Size {
  let utf16 = 0, utf8 = 0;
  const encoder = new TextEncoder();
  const append = (text: string): void => {
    utf16 += text.length; utf8 += encoder.encode(text).length;
    check(utf16 <= limit && utf8 <= limit, CODE.FILE, 'Complete compactJSON UTF16 or UTF8 envelope exceeded');
  };
  const visit = (value: unknown): void => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') append(JSON.stringify(value));
    else if (typeof value === 'number') {
      check(Number.isFinite(value), CODE.FILE, 'Finite JSON numbers are required');
      append(Object.is(value, -0) ? '-0' : JSON.stringify(value));
    } else if (Array.isArray(value)) {
      append('['); value.forEach((item, index) => { if (index) append(','); visit(item); }); append(']');
    } else {
      check(value !== null && typeof value === 'object', CODE.FILE, 'Complete ownJSON data required');
      append('{');
      Object.entries(value).forEach(([key, item], index) => {
        if (index) append(','); append(JSON.stringify(key)); append(':'); visit(item);
      });
      append('}');
    }
  };
  visit(input); append('\n');
  return { utf16, utf8 };
}
function identifier(value: unknown, maximum: number): asserts value is string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'A bounded supported ASCII identifier is required');
}
function integerField(text: string, counts: Counts, code: IGESImportDiagnosticCode): number {
  counts.integerFieldParseCount++;
  check(/^ *[0-9]+$/.test(text), code, 'A complete nonnegative integer record field is required');
  const value = Number(text);
  check(Number.isSafeInteger(value) && value >= 0, code, 'Record integer must be represented safely');
  return value;
}
function physicalRecords(iges: string, counts: Counts): Sections {
  check(iges.endsWith('\n') && iges.length % 81 === 0, CODE.RECORD,
    'Exactly80 printableASCII columns, LF and finalLF are required');
  const total = iges.length / 81;
  check(total >= 6 && total <= 8192, CODE.BUDGET, 'Complete physical record count must fit6..8192');
  const sections: Sections = { S: [], G: [], D: [], P: [], T: [] };
  const order: Section[] = ['S', 'G', 'D', 'P', 'T'];
  let prior = 0;
  for (let offset = 0; offset < iges.length; offset += 81) {
    counts.recordScanCount++;
    const line = iges.slice(offset, offset + 80);
    check(iges[offset + 80] === '\n' && /^[\x20-\x7e]{80}$/.test(line), CODE.RECORD,
      'Physical records must preserve exact printableASCII columns and LF bytes');
    const section = line[72] as Section, index = order.indexOf(section);
    check(index >= prior && index >= 0, CODE.RECORD, 'Supported sections must appear once in S/G/D/P/T order');
    prior = index;
    const sequence = integerField(line.slice(73), counts, CODE.RECORD);
    check(sequence === sections[section].length + 1, CODE.RECORD, 'Every section sequence must be contiguous from1');
    const maximum = section === 'S' || section === 'T' ? 1 : section === 'G' ? 64 : section === 'D' ? 32 : 8192;
    check(sections[section].length < maximum, CODE.BUDGET, 'Section record count exceeds the writer profile');
    sections[section].push({ body: line.slice(0, 72), sequence });
  }
  check(sections.S.length === 1 && sections.G.length >= 1 && sections.D.length >= 2 &&
    sections.D.length % 2 === 0 && sections.P.length >= 1 && sections.T.length === 1, CODE.RECORD,
  'All five complete sections and paired Directory records are required');
  const end = sections.T[0].body;
  for (let index = 0; index < 4; index++) {
    const section = order[index];
    check(end[index * 8] === section, CODE.RECORD, 'Terminate section tags must match S/G/D/P');
    const declared = integerField(end.slice(index * 8 + 1, index * 8 + 8), counts, CODE.RECORD);
    check(declared === sections[section].length, CODE.RECORD, 'Terminate counts must equal actual section lengths');
  }
  check(/^ *$/.test(end.slice(32)), CODE.RECORD, 'Terminate remaining body must be padding only');
  return sections;
}
function scanTokens(payload: string, maximum: number, counts: Counts,
  global: boolean): GlobalField[] {
  const code = global ? CODE.GLOBAL : CODE.PARAMETER;
  const tokens: GlobalField[] = [];
  let position = 0, ended = false;
  const padding = (): void => { while (payload[position] === ' ') position++; };
  while (position < payload.length) {
    padding();
    check(position < payload.length, code, 'Every vector requires a real final semicolon');
    check(tokens.length < maximum && counts.tokenScanCount < 18000, CODE.BUDGET,
      'Complete vector and aggregate token budgets must be admitted before appending');
    const start = position;
    // Hollerith lengths are bounded before reading their actual opaque data.
    let digitEnd = position;
    while (/[0-9]/.test(payload[digitEnd] ?? '')) digitEnd++;
    let token: GlobalField;
    if (digitEnd > position && payload[digitEnd] === 'H') {
      check(global, CODE.UNSUPPORTED, 'Entity coefficient vectors do not admit Hollerith fields');
      check(digitEnd - position <= 3, CODE.BUDGET, 'Hollerith length prefix exceeds its256 bound');
      const length = Number(payload.slice(position, digitEnd));
      check(Number.isSafeInteger(length) && length >= 0 && length <= 256, CODE.BUDGET,
        'Opaque Hollerith payload must fit0..256 characters');
      const dataStart = digitEnd + 1, end = dataStart + length;
      check(end <= payload.length, code, 'Declared Hollerith payload exceeds the real continued records');
      counts.hollerithParseCount++;
      token = { index: tokens.length, kind: 'hollerith', text: payload.slice(start, end), value: payload.slice(dataStart, end) };
      position = end;
      padding();
    } else {
      while (position < payload.length && payload[position] !== ',' && payload[position] !== ';') position++;
      check(position < payload.length, code, 'Numeric vector token is missing its real delimiter');
      const text = payload.slice(start, position).replace(/ +$/, '');
      check(text.length >= 1 && text.length <= 32, CODE.BUDGET, 'Complete numeric token must fit1..32 characters');
      check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?$/.test(text), CODE.NUMBER,
        'Only a complete finite decimal token with optional uppercaseE is supported');
      counts.numericParseCount++;
      const value = Number(text), mantissa = text.split('E')[0];
      check(Number.isFinite(value), CODE.NUMBER, 'Numeric token overflows finite binary64');
      check(value !== 0 || !/[1-9]/.test(mantissa), CODE.NUMBER,
        'A nonzero decimal mantissa may not round to binary64 zero');
      token = { index: tokens.length, kind: 'number', text, value };
    }
    counts.tokenScanCount++;
    tokens.push(token);
    const delimiter = payload[position];
    check(delimiter === ',' || delimiter === ';', code, 'A supported delimiter must follow the complete token');
    position++;
    if (delimiter === ';') {
      padding();
      check(position === payload.length, code, 'Only padding may follow the one final vector terminator');
      ended = true; break;
    }
  }
  check(ended, code, 'The complete vector must terminate exactly once');
  return tokens;
}
function globalFields(sections: Sections, counts: Counts): GlobalField[] {
  const fields = scanTokens(sections.G.map(value => value.body).join(''), 26, counts, true);
  check(fields.length === 26, CODE.GLOBAL, 'Exactly26 actual typed Global fields are required');
  const strings = [0, 1, 2, 3, 4, 5, 11, 14, 17, 20, 21, 24, 25];
  fields.forEach((field, index) => check(field.kind === (strings.includes(index) ? 'hollerith' : 'number'),
    CODE.GLOBAL, 'Every actual Global position must match the writer number/Hollerith type'));
  const fixedStrings: [number, string][] = [[0, ','], [1, ';'], [14, 'MM'],
    [17, '20000101.000000'], [24, '20000101.000000'], [25, '']];
  for (const [index, value] of fixedStrings) {
    check(fields[index].value === value, CODE.UNSUPPORTED,
      'Global delimiters, units, fixed dates and protocol must match the actual writer profile');
  }
  const fixedNumbers: [number, number][] = [[6, 32], [7, 38], [8, 6], [9, 308], [10, 17],
    [12, 1], [13, 2], [15, 1], [16, 0], [18, 1e-9], [22, 11], [23, 0]];
  for (const [index, value] of fixedNumbers) {
    check(Object.is(fields[index].value, value), CODE.UNSUPPORTED,
      'Global precision, scale, units and fixed numeric metadata must match the actual writer');
  }
  check(typeof fields[19].value === 'number' && fields[19].value >= 0 && fields[19].value <= 1000000,
    CODE.GLOBAL, 'Declared maximum Cartesian coordinate must fit the native profile');
  return fields;
}
function directories(sections: Sections, counts: Counts): Directory[] {
  const values: Directory[] = [];
  let nextParameter = 1;
  for (let index = 0; index < sections.D.length; index += 2) {
    const first = sections.D[index], second = sections.D[index + 1];
    const a = Array.from({ length: 8 }, (_, field) => integerField(first.body.slice(field * 8, field * 8 + 8), counts, CODE.DIRECTORY));
    const b = Array.from({ length: 5 }, (_, field) => integerField(second.body.slice(field * 8, field * 8 + 8), counts, CODE.DIRECTORY));
    const subscript = integerField(second.body.slice(64, 72), counts, CODE.DIRECTORY);
    check(a[0] === 126 || a[0] === 128, CODE.UNSUPPORTED, 'Only actual untransformed126/128 entities are supported');
    check(b[0] === a[0], CODE.DIRECTORY, 'Both Directory rows must declare the same entity type');
    check(a.slice(2).every(value => value === 0) && first.body.slice(64) === '00000000' &&
      b[1] === 0 && b[2] === 0 && b[4] === 0 && subscript === 0,
    CODE.UNSUPPORTED, 'Directory references, transforms, styles, status, forms and subscripts must remain supported zero');
    check(second.body.slice(40, 56) === ' '.repeat(16), CODE.DIRECTORY, 'Both reserved Directory fields must be spaces');
    check(a[1] === nextParameter && b[3] >= 1 && b[3] <= sections.P.length &&
      a[1] - 1 + b[3] <= sections.P.length, CODE.DIRECTORY,
    'Directory parameter runs must partition real Parameter records in order');
    const pointer = first.sequence;
    for (let p = a[1] - 1; p < a[1] - 1 + b[3]; p++) {
      const owner = integerField(sections.P[p].body.slice(64), counts, CODE.PARAMETER);
      check(owner === pointer, CODE.PARAMETER, 'Every actual Parameter record must own its exact odd Directory pointer');
    }
    const labelField = second.body.slice(56, 64);
    values.push({ entity: a[0], directoryPointer: pointer, parameterPointer: a[1],
      parameterRecords: b[3], labelField, label: labelField.replace(/ +$/, '') });
    nextParameter += b[3];
  }
  check(values.length >= 1 && values.length <= 16 && nextParameter === sections.P.length + 1,
    CODE.DIRECTORY, 'All actual Parameter records must be owned exactly once by1..16 Directory pairs');
  return values;
}
function numericToken(tokens: GlobalField[], index: number): number {
  const value = tokens[index];
  check(value !== undefined && value.kind === 'number', CODE.PARAMETER,
    'Every entity parameter must be one complete numeric token');
  return value.value;
}
function integerToken(tokens: GlobalField[], index: number): number {
  const value = tokens[index];
  check(value !== undefined && value.kind === 'number' && /^[0-9]+$/.test(value.text) &&
    Number.isSafeInteger(value.value) && value.value >= 0, CODE.PARAMETER,
  'Entity headers and flags must be complete safely represented nonnegative integers');
  return value.value;
}
function mapping(directory: Directory, tokenCount: number, header: number,
  knotU: number, knotV: number | null, total: number, curve: boolean): ParameterMapping {
  let offset = header;
  const take = (length: number): Span => { const start = offset; offset += length; return [start, offset]; };
  const knotsU = take(knotU), knotsV = knotV === null ? null : take(knotV);
  const weights = take(total), cartesian = take(3 * total), domains = take(curve ? 2 : 4);
  const normal = curve ? take(3) : null;
  check(offset === tokenCount, CODE.PARAMETER, 'The exact parameter ranges must cover all and only entity tokens');
  return { firstSequence: directory.parameterPointer,
    lastSequence: directory.parameterPointer + directory.parameterRecords - 1,
    recordCount: directory.parameterRecords, tokenCount, header: [0, header],
    knotsU, knotsV, weights, cartesian, domains, normal };
}
function readRange(tokens: GlobalField[], range: Span): number[] {
  return Array.from({ length: range[1] - range[0] }, (_, index) => numericToken(tokens, range[0] + index));
}
function entity(directory: Directory, index: number, tokens: GlobalField[], options: IGESImportOptions,
  counts: Counts): { geometry: Curve | Surface; receipt: IGESImportEntity } {
  check(integerToken(tokens, 0) === directory.entity, CODE.PARAMETER,
    'Parameter entity type must match the actual owning Directory pair');
  const id = options.idPrefix + '_d' + directory.directoryPointer;
  identifier(id, 48);
  if (directory.entity === 126) {
    const k = integerToken(tokens, 1), p = integerToken(tokens, 2);
    check(k >= 1 && k <= 63 && p >= 1 && p <= 5 && p <= k, CODE.BUDGET,
      'Curve degree/count must fit native1..5 and2..64 BEFORE coefficient allocation');
    const n = k + 1, knotCount = n + p + 1;
    check(knotCount <= 70 && tokens.length === 5 * n + p + 13, CODE.PARAMETER,
      'Curve parameters must have exactly the header-derived knot/weight/XYZ/domain/normal count');
    const planar = integerToken(tokens, 3), closed = integerToken(tokens, 4), polynomial = integerToken(tokens, 5),
      periodic = integerToken(tokens, 6);
    check(planar === 0 && closed === 0 && periodic === 0 && (polynomial === 0 || polynomial === 1),
      CODE.UNSUPPORTED, 'Only general open nonperiodic126 with a supported polynomial flag is admitted');
    const ranges = mapping(directory, tokens.length, 7, knotCount, null, n, true);
    const knots = readRange(tokens, ranges.knotsU), weights = readRange(tokens, ranges.weights);
    const controlPoints: Point[] = Array.from({ length: n }, (_, pole) => [
      numericToken(tokens, ranges.cartesian[0] + 3 * pole),
      numericToken(tokens, ranges.cartesian[0] + 3 * pole + 1),
      numericToken(tokens, ranges.cartesian[0] + 3 * pole + 2),
    ]);
    const geometry: Curve = { kind: 'curve', id, degree: p, knots, controlPoints, weights };
    counts.nativeCurveValidationCount++;
    delegated(() => validateCurve(geometry), CODE.NATIVE, 'Actual imported Curve native validation refused');
    counts.curveDomainQueryCount++;
    const domain = delegated(() => curveDomain(geometry), CODE.NATIVE, 'Actual imported Curve domain query refused');
    check(same(readRange(tokens, ranges.domains), domain), CODE.BINDING,
      'Declared Curve domain must bind actual parsed native knot endpoint bits');
    check(ranges.normal !== null && readRange(tokens, ranges.normal).every(value => Object.is(value, 0)),
      CODE.UNSUPPORTED, 'The supported general126 normal tail is exactly the writer zero vector');
    check(polynomial === (weights.every(value => value === weights[0]) ? 1 : 0), CODE.BINDING,
      'Declared Curve polynomial flag must match actual independent weight equality');
    return { geometry, receipt: { index, entity: 126, directoryPointer: directory.directoryPointer,
      parameterPointer: directory.parameterPointer, parameterRecords: directory.parameterRecords,
      label: directory.label, labelField: directory.labelField, nativeId: id, nativeObjectIndex: index,
      degrees: { u: p, v: null }, poleCounts: { u: n, v: null, total: n }, knotCounts: { u: knotCount, v: null },
      domain: { u: domain, v: null }, flags: { planar: 0, closed: 0, polynomial, periodic: 0, normal: [0, 0, 0] },
      coefficientOrder: 'curve-pole-order-xyz', parameterMapping: ranges } };
  }
  const kU = integerToken(tokens, 1), kV = integerToken(tokens, 2), pU = integerToken(tokens, 3), pV = integerToken(tokens, 4);
  check(kU >= 1 && kU <= 15 && kV >= 1 && kV <= 15 && pU >= 1 && pU <= 5 && pV >= 1 && pV <= 5 &&
    pU <= kU && pV <= kV, CODE.BUDGET,
  'Surface degrees and each safe header count must fit native BEFORE additions, products or net allocation');
  const nU = kU + 1, nV = kV + 1, total = nU * nV, knotU = nU + pU + 1, knotV = nV + pV + 1;
  check(total <= 256 && knotU <= 22 && knotV <= 22 &&
    tokens.length === 4 * total + nU + nV + pU + pV + 16, CODE.PARAMETER,
  'Surface parameter count must match the complete admitted header-derived net');
  const closedU = integerToken(tokens, 5), closedV = integerToken(tokens, 6), polynomial = integerToken(tokens, 7),
    periodicU = integerToken(tokens, 8), periodicV = integerToken(tokens, 9);
  check(closedU === 0 && closedV === 0 && periodicU === 0 && periodicV === 0 &&
    (polynomial === 0 || polynomial === 1), CODE.UNSUPPORTED,
  'Only open nonperiodic128 with a supported polynomial flag is admitted');
  const ranges = mapping(directory, tokens.length, 10, knotU, knotV, total, false);
  check(ranges.knotsV !== null, CODE.PARAMETER, 'Surface requires both actual knot token ranges');
  const knotsU = readRange(tokens, ranges.knotsU), knotsV = readRange(tokens, ranges.knotsV);
  // Decode the actual file's U-fastest order ONCE into native [u][v] for both nets.
  const weights = Array.from({ length: nU }, (_, u) => Array.from({ length: nV }, (_, v) =>
    numericToken(tokens, ranges.weights[0] + v * nU + u)));
  const controlPoints: Point[][] = Array.from({ length: nU }, (_, u) => Array.from({ length: nV }, (_, v): Point => [
    numericToken(tokens, ranges.cartesian[0] + 3 * (v * nU + u)),
    numericToken(tokens, ranges.cartesian[0] + 3 * (v * nU + u) + 1),
    numericToken(tokens, ranges.cartesian[0] + 3 * (v * nU + u) + 2),
  ]));
  const geometry: Surface = { kind: 'surface', id, degreeU: pU, degreeV: pV, knotsU, knotsV, controlPoints, weights };
  counts.nativeSurfaceValidationCount++;
  delegated(() => validateSurface(geometry), CODE.NATIVE, 'Actual imported Surface native validation refused');
  counts.surfaceDomainQueryCount++;
  const domain = delegated(() => surfaceDomain(geometry), CODE.NATIVE, 'Actual imported Surface domain query refused');
  check(same(readRange(tokens, ranges.domains), [...domain.u, ...domain.v]), CODE.BINDING,
    'Declared Surface domains must bind actual parsed native knot endpoint bits');
  check(polynomial === (weights.every(row => row.every(value => value === weights[0][0])) ? 1 : 0), CODE.BINDING,
    'Declared Surface polynomial flag must match actual whole-net independent weight equality');
  return { geometry, receipt: { index, entity: 128, directoryPointer: directory.directoryPointer,
    parameterPointer: directory.parameterPointer, parameterRecords: directory.parameterRecords,
    label: directory.label, labelField: directory.labelField, nativeId: id, nativeObjectIndex: index,
    degrees: { u: pU, v: pV }, poleCounts: { u: nU, v: nV, total }, knotCounts: { u: knotU, v: knotV },
    domain, flags: { closedU: 0, closedV: 0, polynomial, periodicU: 0, periodicV: 0 },
    coefficientOrder: 'surface-u-fastest-to-native-u-v', parameterMapping: ranges } };
}
/** Append bounded source fragments before allocation, using the unchanged decimal serializer for every scalar. */
function fullSource(model: Model, counts: Counts): string {
  let source = '';
  const append = (text: string): void => {
    check(source.length + text.length <= 262144, CODE.BUDGET,
      'Full generated Source0 decimal expansion exceeds262144 before append');
    // Every emitted syntax/name/decimal is ASCII, so UTF8 and UTF16 lengths are equal.
    check(/^[\x20-\x7e\n]*$/.test(text), CODE.SOURCE, 'Generated literal source must remain supported ASCII');
    source += text;
  };
  const scalar = (value: number): void => {
    check(counts.decimalEmissionCount < 17120, CODE.BUDGET, 'Actual scalar emission budget17120 exceeded');
    counts.decimalEmissionCount++;
    const text = delegated(() => curveDecimal(value, 'Native IGES import'), CODE.SOURCE,
      'Actual imported coefficient decimal emission refused');
    check(text.length <= 350 && Object.is(Number(text), value), CODE.BINDING,
      'Every imported scalar literal must round-trip its actual parsed binary64 bits');
    append(text);
  };
  const array = (value: NumericData): void => {
    if (typeof value === 'number') { scalar(value); return; }
    append('[');
    value.forEach((item, index) => {
      if (index) append(',');
      array(item);
    });
    append(']');
  };
  append('@model ' + model.name + ' { version:0; length-unit:mm;\n');
  for (const object of model.objects) {
    if (object.kind === 'curve') {
      append('@curve #' + object.id + ' { type:nurbs; degree:'); scalar(object.degree);
      append('; knots:'); array(object.knots);
      append('; control-points:'); array(object.controlPoints);
      append('; weights:'); array(object.weights); append('; }\n');
    } else {
      append('@surface #' + object.id + ' { type:nurbs; degree-u:'); scalar(object.degreeU);
      append('; degree-v:'); scalar(object.degreeV);
      append('; knots-u:'); array(object.knotsU);
      append('; knots-v:'); array(object.knotsV);
      append('; control-points:'); array(object.controlPoints);
      append('; weights:'); array(object.weights); append('; }\n');
    }
  }
  append('}\n');
  return source;
}

/** Import only the current writer's bounded untransformed open126/128 family into editable literal Source0. */
export function importIGES(igesInput: string, optionsInput: IGESImportOptions): IGESImportResult {
  const data = record(snapshot({ iges: igesInput, options: optionsInput }), ['iges', 'options']);
  check(typeof data.iges === 'string', CODE.INPUT, 'The complete actual IGES text is required');
  const optionsData = record(data.options, ['sourceId', 'modelName', 'idPrefix', 'maximumEntities', 'maximumRecords']);
  identifier(optionsData.sourceId, 48); identifier(optionsData.modelName, 48); identifier(optionsData.idPrefix, 32);
  check(optionsData.maximumEntities === 16 && optionsData.maximumRecords === 8192, CODE.BUDGET,
    'Unchanged importer fixed budgets16entities/8192records are required');
  const request = data as unknown as { iges: string; options: IGESImportOptions };
  const inputSizes = { utf16: request.iges.length, utf8: new TextEncoder().encode(request.iges).length };
  check(inputSizes.utf16 <= 1048576 && inputSizes.utf8 <= 1048576, CODE.FILE,
    'Complete raw IGES UTF16 and UTF8 must fit1MiB');
  const requestSize = fileSize(request, 1048576);
  const counts: Counts = { recordScanCount: 0, integerFieldParseCount: 0, tokenScanCount: 0,
    numericParseCount: 0, hollerithParseCount: 0, nativeCurveValidationCount: 0, nativeSurfaceValidationCount: 0,
    curveDomainQueryCount: 0, surfaceDomainQueryCount: 0, fullSourceCompileCount: 1, decimalEmissionCount: 0,
    curveD0Count: 0, curveD1AttemptCount: 0, surfaceD0Count: 0, surfaceD1AttemptCount: 0, rationalOperationCount: 0 };
  const sections = physicalRecords(request.iges, counts), globals = globalFields(sections, counts), entries = directories(sections, counts);
  const entities: IGESImportEntity[] = [], objects: (Curve | Surface)[] = [];
  let fileNegativeZeroTokenCount = globals.filter(field => field.kind === 'number' && Object.is(field.value, -0)).length;
  let actualMaximumCoordinateMM = 0;
  for (let index = 0; index < entries.length; index++) {
    const directory = entries[index];
    const payload = sections.P.slice(directory.parameterPointer - 1,
      directory.parameterPointer - 1 + directory.parameterRecords).map(value => value.body.slice(0, 64)).join('');
    const tokens = scanTokens(payload, 1082, counts, false);
    fileNegativeZeroTokenCount += tokens.filter(field => field.kind === 'number' && Object.is(field.value, -0)).length;
    const decoded = entity(directory, index, tokens, request.options, counts);
    entities.push(decoded.receipt); objects.push(decoded.geometry);
    const points = decoded.geometry.kind === 'curve' ? decoded.geometry.controlPoints : decoded.geometry.controlPoints.flat();
    for (const point of points) for (const value of point) actualMaximumCoordinateMM = Math.max(actualMaximumCoordinateMM, Math.abs(value));
  }
  const declaredMaximumCoordinateMM = globals[19].value as number;
  check(Object.is(actualMaximumCoordinateMM, declaredMaximumCoordinateMM), CODE.GLOBAL,
    'Declared Global maximumCoordinate must equal the actual imported maximum absolute Cartesian coefficient');
  check(counts.tokenScanCount === counts.numericParseCount + counts.hollerithParseCount &&
    counts.hollerithParseCount === 13 && counts.integerFieldParseCount ===
      counts.recordScanCount + 14 * entries.length + sections.P.length + 4, CODE.BINDING,
  'Actual one-pass token and integer-field work must match the complete admitted records');
  const expectedModel: Model = { name: request.options.modelName, version: 0, lengthUnit: 'mm', objects };
  const source = fullSource(expectedModel, counts);
  let sourceCompileCount = 0;
  sourceCompileCount++;
  const compiled: CadCompileResult = delegated(() => compileCadModel(source, { sourceVersion: 0 }), CODE.SOURCE,
    'Actual full imported Source0 compilation failed');
  if (!compiled.ok) throw new IGESImportError(CODE.SOURCE, 'Actual full imported Source0 compilation refused', compiled);
  check(sourceCompileCount === counts.fullSourceCompileCount && same(compiled.model, expectedModel), CODE.BINDING,
    'The one actual whole compiler Model must retain every imported coefficient, domain, ID and directory order');
  const model = compiled.model;
  const records: IGESImportMetadata['records'] = { S: 1, G: sections.G.length, D: sections.D.length, P: sections.P.length, T: 1 };
  const metadata: IGESImportMetadata = { startText: sections.S[0].body, globals,
    parameterDelimiter: ',', recordDelimiter: ';', unitFlag: 2, lengthUnit: 'mm', modelScale: 1,
    declaredMaximumCoordinateMM, actualMaximumCoordinateMM, records };
  const report: IGESImportReport = {
    schema: 'barocss-native-iges-import-report', version: 0,
    profile: 'barocss-writer-iges53-untransformed-open-126-128', format: 'IGES 5.3 ASCII', sourceVersion: 0,
    sourceId: request.options.sourceId, modelName: model.name, idPrefix: request.options.idPrefix,
    lengthUnit: 'mm', modelScale: 1, entityCount: entities.length,
    curveCount: objects.filter(value => value.kind === 'curve').length,
    surfaceCount: objects.filter(value => value.kind === 'surface').length, records, inputSizes,
    sourceSizes: { utf16: source.length, utf8: source.length },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } },
    directoryPointers: entities.map(value => value.directoryPointer),
    parameterPointers: entities.map(value => value.parameterPointer), nativeIds: entities.map(value => value.nativeId),
    duplicateDirectoryLabelCount: entities.length - new Set(entities.map(value => value.label)).size,
    fileNegativeZeroTokenCount, declaredMaximumCoordinateMM, actualMaximumCoordinateMM, directCounts: counts,
    preservation: { completeInputFile: true, directoryOrderAndOwnership: true, directoryLabelFields: true,
      parsedCoefficientBits: true, parsedDomains: true, independentWeights: true,
      sourceModelCoefficientBinding: true, nativeIdsFromDirectoryPointers: true },
    losses: { fileNumberPolicy: 'complete-decimal-token-to-finite-binary64', parsedNegativeZeroBitsPreserved: true,
      originalFullNativeIdsRecovered: false, originalAuthoredZeroSignsRecovered: false,
      originalSourceSpellingRecovered: false, originalFeaturesHistoryRecovered: false, originalSourceIncluded: false,
      directoryLabelsMayBeTruncated: true, geometryReparameterized: false, unitsConverted: false,
      transformsApplied: false, sourceMeaning: 'new-imported-geometry-not-original-author-intent' },
    quality: { nativeGeometryValidated: true, sourceCoefficientBinding: true, geometryOnly: true,
      generalIGESConformance: false, trimmedTopology: false, topologyCertified: false, solid: false,
      assembly: false, smoothnessCertified: false, g1g2Certified: false, globalBinary64ErrorCertified: false,
      manufacturingToleranceCertified: false, editorDisplayCertified: false,
      persistentTopologyBindingCertified: false, publication: false, ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumInputUTF16: 1048576, maximumInputUTF8: 1048576, maximumRecords: 8192, recordCharacters: 80,
      maximumEntities: 16, maximumGlobalRecords: 64, globalTokenCount: 26, maximumTokens: 18000,
      maximumEntityTokens: 1082, maximumNumericTokenCharacters: 32, maximumHollerithCharacters: 256,
      maximumDegree: 5, maximumCurvePoles: 64, maximumCurveKnots: 70, maximumSurfaceAxisPoles: 16,
      maximumSurfacePoles: 256, maximumSurfaceAxisKnots: 22, maximumModelObjects: 16,
      coordinateAbsMM: 1000000, minimumWeight: 0.000001, maximumWeight: 1000000,
      maximumNativeIdCharacters: 48, maximumModelNameCharacters: 48, maximumIdPrefixCharacters: 32,
      maximumDecimalEmissionCount: 17120, maximumSourceLiteralCharacters: 350,
      sourceUTF16: 262144, sourceUTF8: 262144, maximumRequestFileUTF16: 1048576,
      maximumRequestFileUTF8: 1048576, maximumResultFileUTF16: 4194304, maximumResultFileUTF8: 4194304,
      ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, keyCharacters: 128,
      stringCharacters: 262144, requestIGESStringCharacters: 1048576 },
    workScope: 'actual-parser-native-validation-domain-and-full-source-compile-calls-inherited-work-excluded',
    budgetFailure: 'atomic-no-partial-imported-model-or-source',
  };
  const result: IGESImportResult = { request, source, model, metadata, entities, report };
  let stable = false;
  for (let pass = 0; pass < 8; pass++) {
    const size = fileSize(result, 4194304);
    if (same(size, report.fileSizes.result)) { stable = true; break; }
    report.fileSizes.result = size;
  }
  check(stable, CODE.FILE, 'Complete result size metadata must settle within8 passes');
  return snapshot(result, false, true) as IGESImportResult;
}

/** Rebuild once from complete actual file authority, then compare every retained bit and parser/native receipt. */
export function validateIGESImport(input: IGESImportResult): IGESImportReport {
  const owned = record(snapshot(input, true, true), ['request', 'source', 'model', 'metadata', 'entities', 'report'],
    CODE.OWNED) as unknown as IGESImportResult;
  const request = record(owned.request, ['iges', 'options'], CODE.OWNED);
  let expected: IGESImportResult;
  try {
    fileSize(owned, 4194304);
    expected = importIGES(request.iges as string, request.options as IGESImportOptions);
  } catch (cause) {
    throw new IGESImportError(CODE.OWNED, 'Whole file, parser, native geometry and fullSource reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED,
    'Owned actual file, source, Model, metadata, pointer mappings, parser counts, losses, quality or sizes changed');
  return snapshot(expected.report, true) as IGESImportReport;
}
