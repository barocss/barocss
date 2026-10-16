import { compileCadModel } from './model-compiler.js';
import type { CadCompileResult } from './model-compiler.js';
import type { CadAstDeclaration, CadAstValue } from './source-ast.js';
import { elevateC0BezierChainCoefficientsTrusted } from './curve-c0-degree-elevation-internal.js';
import type { C0ElevationKnotBlock, C0ElevationCoefficientResult } from './curve-c0-degree-elevation-internal.js';
import { curveDecimal } from './curve-source.js';
import { validateCurve, curveDomain, evaluateCurve } from './math.js';
import { evaluateCurveD1 } from './derivatives.js';
import type { CurveD1Result } from './derivatives.js';
import type { Curve, Model, Point } from './types.js';
import { same } from './structural-equality.js';

export const SourceCurveDegreeElevationDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', SOURCE: 'SOURCE', TARGET: 'TARGET',
  DEGREE: 'DEGREE', BASIS: 'BASIS', BUDGET: 'BUDGET', REPRESENTABILITY: 'REPRESENTABILITY',
  BINDING: 'BINDING', NATIVE: 'NATIVE', OWNED: 'OWNED', FILE: 'FILE',
} as const);
export type SourceCurveDegreeElevationDiagnosticCode =
  typeof SourceCurveDegreeElevationDiagnosticCode[keyof typeof SourceCurveDegreeElevationDiagnosticCode];
export class SourceCurveDegreeElevationError extends Error {
  readonly code: SourceCurveDegreeElevationDiagnosticCode;
  constructor(code: SourceCurveDegreeElevationDiagnosticCode, detail: string, cause?: unknown) {
    super(('Source Curve degree elevation: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'SourceCurveDegreeElevationError';
    this.code = code;
  }
}
export interface SourceCurveDegreeElevationRequest {
  source: string;
  sourceVersion: 0;
  curveId: string;
  targetDegree: 2 | 3 | 4 | 5;
  maximumObservations: 128;
}
export interface SourceCurveDegreeElevationPatch {
  field: 'degree' | 'knots' | 'control-points' | 'weights';
  startUTF16: number;
  endUTF16: number;
  originalText: string;
  replacementText: string;
}
type Size = { utf16: number; utf8: number };
type D1State = { status: 'evaluated'; value: CurveD1Result } |
  { status: 'refused-c0'; name: string; reason: string; value: null };
type Observation = {
  parameter: number;
  originalPointMM: Point;
  pointMM: Point;
  pointDifferenceMM: number;
  originalD1: D1State;
  outputD1: D1State;
  relativeDerivativeDifference: number | null;
};
type Provenance = {
  selectedObjectIndex: number;
  originalDegree: number;
  targetDegree: number;
  domain: [number, number];
  blocks: C0ElevationKnotBlock[];
  parameterMap: { kind: 'identity'; formula: 'u=t'; d1Factor: 1 };
  coefficientResult: C0ElevationCoefficientResult;
  patches: SourceCurveDegreeElevationPatch[];
};
export interface SourceCurveDegreeElevationReport {
  schema: 'barocss-source-curve-degree-elevation-report';
  version: 0;
  sourceVersion: 0;
  lengthUnit: 'mm';
  modelName: string;
  curveId: string;
  selectedObjectIndex: number;
  objectCount: number;
  originalDegree: number;
  targetDegree: number;
  domain: [number, number];
  spanCount: number;
  poleCounts: { original: number; output: number };
  knotCounts: { original: number; output: number };
  patchCount: 4;
  sourceSizes: { original: Size; candidate: Size };
  fileSizes: { request: Size; result: Size };
  stations: number[];
  observations: Observation[];
  maximumPointDifferenceMM: number;
  maximumRelativeDerivativeDifference: number;
  directCounts: {
    originalCompileCount: 1; candidateCompileCount: 1; coefficientElevationCallCount: 1;
    nativeCurveValidationCount: 2; domainQueryCount: 2; spanCount: number;
    generatedPoleCount: number; liftedPoleCount: number; copiedEndpointCount: number;
    addedKnotCount: number; patchCount: 4; decimalEmissionCount: number;
    observationCount: number; curveD0Count: number; curveD1AttemptCount: number;
    curveD1EvaluatedCount: number; curveD1RefusedCount: number;
    oldPublicElevationCallCount: 0; sourceWriterCallCount: 0; insertionCallCount: 0;
    rationalOperationCount: 0;
  };
  preservation: {
    untouchedSourceSpans: true; modelHeaderBits: true; objectOrderAndIds: true;
    unselectedObjectBits: true; selectedCurveEqualsActualCoefficientCandidate: true;
    endpointAndJoinPoleBits: true; originalKnotSlotBits: true; domainBits: true; parameterIdentity: true;
  };
  quality: {
    geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
    localShapeObservations: true; globalShapeErrorCertified: false; globalBinary64ErrorCertified: false;
    g1g2Certified: false; manufacturingToleranceCertified: false; editorDisplayCertified: false;
    persistentTopologyBindingCertified: false; publication: false;
    derivativeSemantics: 'actual-native-guards-unchanged'; ownership: 'independent-copied-cpu-data-gc';
  };
  limits: {
    maximumInputDegree: 4; maximumOutputDegree: 5; maximumElevations: 1; maximumSpans: 31;
    maximumOriginalPoles: 64; maximumProfileOriginalPoles: 49; maximumOutputPoles: 64;
    maximumKnots: 70; maximumGeneratedRows: 48; maximumCopiedEndpoints: 32;
    maximumObservations: 128; maximumProfileObservations: 125; maximumNativeAttempts: 500;
    maximumPatches: 4; maximumDecimalEmissions: 325; maximumModelObjects: 16;
    coordinateAbsMM: 10000; minimumWeight: 0.000001; maximumWeight: 1000000;
    maximumReplacementLiteralCharacters: 512; maximumPointDifferenceMM: 1e-7;
    maximumRelativeDerivativeDifference: 1e-7; sourceUTF16: 262144; sourceUTF8: 262144;
    maximumFileUTF16: 2097152; maximumFileUTF8: 2097152;
    ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64;
    keyCharacters: 128; stringCharacters: 262144; identifierCharacters: 48;
  };
  workScope: 'direct-wrapper-calls-private-coefficient-arithmetic-and-native-observations';
  budgetFailure: 'atomic-no-partial-source-degree-elevation';
}
export interface SourceCurveDegreeElevationResult {
  request: SourceCurveDegreeElevationRequest;
  source: string;
  originalModel: Model;
  model: Model;
  originalCurve: Curve;
  curve: Curve;
  provenance: Provenance;
  report: SourceCurveDegreeElevationReport;
}

const CODE = SourceCurveDegreeElevationDiagnosticCode;
function check(condition: boolean, code: SourceCurveDegreeElevationDiagnosticCode,
  detail: string): asserts condition {
  if (!condition) throw new SourceCurveDegreeElevationError(code, detail);
}
function delegated<T>(action: () => T, code: SourceCurveDegreeElevationDiagnosticCode,
  detail: string): T {
  try { return action(); }
  catch (cause) { throw new SourceCurveDegreeElevationError(code, detail, cause); }
}
function record(input: unknown, fields: string[],
  code: SourceCurveDegreeElevationDiagnosticCode = CODE.INPUT): Record<string, unknown> {
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
function fileSize(input: unknown): Size {
  let utf16 = 0, utf8 = 0;
  const encoder = new TextEncoder();
  const append = (text: string): void => {
    utf16 += text.length;
    utf8 += encoder.encode(text).length;
    check(utf16 <= 2097152 && utf8 <= 2097152, CODE.FILE,
      'Complete JSON exceeds2097152 UTF16 units or UTF8 bytes');
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
  if (!result.ok) throw new SourceCurveDegreeElevationError(CODE.SOURCE,
    'Actual ' + stage + ' complete Source0 compilation refused', result);
  return result;
}
function selectedArray(declaration: CadAstDeclaration,
  field: SourceCurveDegreeElevationPatch['field'], source: string,
  expected: number[] | Point[]): Extract<CadAstValue, { kind: 'array' }> {
  const fields = declaration.fields.filter(value => value.name === field);
  check(fields.length === 1 && fields[0].value.kind === 'array', CODE.TARGET,
    'A unique directly authored selected array is required');
  const node = fields[0].value;
  const within = (value: CadAstValue, start: number, end: number): void => {
    const range = value.range;
    check(Number.isInteger(range.start) && Number.isInteger(range.end) &&
      range.start >= start && range.start < range.end && range.end <= end &&
      range.start >= 0 && range.end <= source.length, CODE.BINDING,
    'Actual selected array or leaf UTF16 range is invalid');
  };
  within(node, declaration.range.start, declaration.range.end);
  const text = source.slice(node.range.start, node.range.end);
  check(!text.includes('/*'), CODE.TARGET, 'Comments inside selected array values are refused');
  check(text.startsWith('[') && text.endsWith(']'), CODE.BINDING,
    'Selected array must bind its actual bracketed source value');
  const bind = (value: CadAstValue, data: number | number[], start: number, end: number): void => {
    within(value, start, end);
    if (Array.isArray(data)) {
      check(value.kind === 'array' && value.items.length === data.length, CODE.TARGET,
        'Actual selected array counts must match the native Curve');
      value.items.forEach((item, index) => bind(item, data[index], value.range.start, value.range.end));
    } else {
      check(value.kind === 'number', CODE.TARGET, 'Selected array leaves must be direct numeric literals');
      const lexeme = source.slice(value.range.start, value.range.end);
      check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(lexeme) &&
        Object.is(Number(lexeme), value.value) && Object.is(value.value, data), CODE.BINDING,
      'Original source, AST and native coefficient bits disagree');
    }
  };
  check(node.items.length === expected.length, CODE.TARGET, 'Selected array length does not match the Curve');
  node.items.forEach((item, index) => bind(item, expected[index], node.range.start, node.range.end));
  return node;
}
function applyPatches(source: string, patches: SourceCurveDegreeElevationPatch[]): string {
  check(patches.length === 4 && patches.every((patch, index) => index === 0 ||
    patches[index - 1].endUTF16 <= patch.startUTF16), CODE.BINDING,
  'Exactly four sorted nonoverlapping source patches are required');
  let result = source;
  for (let index = patches.length - 1; index >= 0; index--) {
    const patch = patches[index];
    check(source.slice(patch.startUTF16, patch.endUTF16) === patch.originalText, CODE.BINDING,
      'Patch original text does not bind the source');
    result = result.slice(0, patch.startUTF16) + patch.replacementText + result.slice(patch.endUTF16);
  }
  let before = 0, after = 0;
  for (const patch of patches) {
    const length = patch.startUTF16 - before;
    check(source.slice(before, patch.startUTF16) === result.slice(after, after + length), CODE.BINDING,
      'An untouched original source span changed');
    after += length;
    check(result.slice(after, after + patch.replacementText.length) === patch.replacementText,
      CODE.BINDING, 'Actual candidate patch text changed');
    after += patch.replacementText.length;
    before = patch.endUTF16;
  }
  check(source.slice(before) === result.slice(after), CODE.BINDING,
    'The untouched original source suffix changed');
  return result;
}

function degreeScalar(declaration: CadAstDeclaration, source: string, degree: number):
  Extract<CadAstValue, { kind: 'number' }> {
  const fields = declaration.fields.filter(field => field.name === 'degree');
  check(fields.length === 1 && fields[0].value.kind === 'number', CODE.TARGET,
    'Selected degree must be one directly authored numeric token');
  const node = fields[0].value, range = node.range;
  check(Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= 0 &&
    range.start >= declaration.range.start && range.start < range.end && range.end <= declaration.range.end &&
    range.end <= source.length, CODE.BINDING, 'Actual degree token UTF16 range is invalid');
  const lexeme = source.slice(range.start, range.end);
  check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(lexeme) &&
    Object.is(Number(lexeme), node.value) && Object.is(node.value, degree), CODE.BINDING,
  'Original degree token, AST and native degree bits disagree');
  return node;
}
function knotBlocks(original: Curve, domain: [number, number]): C0ElevationKnotBlock[] {
  const blocks: C0ElevationKnotBlock[] = [];
  original.knots.forEach((value, index) => {
    const last = blocks[blocks.length - 1];
    if (last !== undefined && last.value === value) {
      check(Object.is(last.value, value), CODE.BASIS,
        'Mixed zero bits within any original numeric-equal knot block are unsupported');
      last.originalLastKnotIndex = index;
      last.multiplicity++;
    } else {
      blocks.push({ index: blocks.length, value, originalFirstKnotIndex: index,
        originalLastKnotIndex: index, multiplicity: 1 });
    }
  });
  const p = original.degree, spans = blocks.length - 1;
  check(spans >= 1 && blocks.every((block, index) =>
    block.multiplicity === (index === 0 || index === blocks.length - 1 ? p + 1 : p)), CODE.BASIS,
  'Only a single Bezier span or exact-multiplicity C0 Bernstein chain is admitted');
  check(original.controlPoints.length === spans * p + 1 &&
    Object.is(blocks[0].value, domain[0]) && Object.is(blocks[blocks.length - 1].value, domain[1]),
  CODE.BASIS, 'Actual C0 chunks must bind original pole counts and domain bits');
  const width = domain[1] - domain[0];
  check(Number.isFinite(width) && width > 0, CODE.REPRESENTABILITY,
    'Full original domain span must be finite and positive');
  return blocks;
}
function quartileStations(blocks: C0ElevationKnotBlock[]): number[] {
  const stations = [blocks[0].value];
  for (let span = 0; span + 1 < blocks.length; span++) {
    const a = blocks[span].value, b = blocks[span + 1].value, width = b - a;
    check(Number.isFinite(width) && width > 0, CODE.REPRESENTABILITY,
      'Every original span must have a finite positive represented width');
    for (const fraction of [0.25, 0.5, 0.75]) {
      const parameter = a + width * fraction;
      check(Number.isFinite(parameter) && parameter > a && parameter < b &&
        parameter > stations[stations.length - 1], CODE.REPRESENTABILITY,
      'Each quarter, midpoint and three-quarter station must be strictly represented');
      stations.push(parameter);
    }
    stations.push(b);
  }
  check(stations.length === 4 * (blocks.length - 1) + 1 && stations.length <= 125,
    CODE.BUDGET, 'Complete original quartile schedule exceeds125 stations');
  return stations;
}
function relativeDifference(before: Point, after: Point): number {
  const differenceNorm = Math.hypot(...after.map((value, index) => value - before[index]));
  const originalNorm = Math.hypot(...before), outputNorm = Math.hypot(...after);
  const scale = Math.max(1, originalNorm, outputNorm);
  check(Number.isFinite(differenceNorm) && Number.isFinite(originalNorm) &&
    Number.isFinite(outputNorm) && Number.isFinite(scale), CODE.REPRESENTABILITY,
  'Native derivative comparison norms must remain finite');
  const relative = differenceNorm / scale;
  check(Number.isFinite(relative) && relative <= 1e-7, CODE.BINDING,
    'Actual relative derivative difference exceeds1e-7');
  return relative;
}

/** Elevate one admitted Bernstein chain degree through actual coefficients and complete Source0. */
export function elevateSourceCurveDegree(input: SourceCurveDegreeElevationRequest): SourceCurveDegreeElevationResult {
  const data = record(snapshot(input), ['source', 'sourceVersion', 'curveId', 'targetDegree', 'maximumObservations']);
  check(data.sourceVersion === 0, CODE.VERSION, 'Only explicit literal Source0 is supported');
  check(typeof data.source === 'string', CODE.INPUT, 'The complete original source string is required');
  check(typeof data.curveId === 'string' && data.curveId.length <= 48 &&
    /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.curveId), CODE.IDENTITY, 'Selected ASCII Curve ID1..48 is required');
  check(typeof data.targetDegree === 'number' && Number.isInteger(data.targetDegree) && (data.targetDegree === 2 || data.targetDegree === 3 ||
    data.targetDegree === 4 || data.targetDegree === 5), CODE.DEGREE, 'Explicit target degree2..5 is required');
  check(data.maximumObservations === 128, CODE.BUDGET, 'Complete fixed observation budget128 is required');
  const request = data as unknown as SourceCurveDegreeElevationRequest;
  const requestSize = fileSize(request), originalSize = sourceSize(request.source);
  const compiledOriginal = compile(request.source, 'original');
  const originalModel = compiledOriginal.model;
  check(originalModel.objects.length <= 16, CODE.BUDGET, 'Complete original Model capacity16 is required');
  const selectedObjectIndex = originalModel.objects.findIndex(object => object.id === request.curveId);
  const selected = originalModel.objects[selectedObjectIndex];
  check(selected !== undefined && selected.kind === 'curve', CODE.TARGET,
    'Selected ID must identify an actual original Curve');
  const originalCurve = selected;
  check(originalCurve.degree >= 1 && originalCurve.degree <= 4 &&
    request.targetDegree === originalCurve.degree + 1, CODE.DEGREE,
  'One degree step from original1..4 to target2..5 is required');
  check(originalCurve.controlPoints.length <= 64 && originalCurve.knots.length <= 70 &&
    originalCurve.controlPoints.every(point => point.every(value => Math.abs(value) <= 10000)), CODE.BUDGET,
  'Selected original exceeds native64/70 or10000mm profile');
  delegated(() => validateCurve(originalCurve), CODE.NATIVE, 'Actual original Curve validation refused');
  const domain = delegated(() => curveDomain(originalCurve), CODE.NATIVE, 'Actual original domain refused');
  const blocks = knotBlocks(originalCurve, domain);
  const spanCount = blocks.length - 1;
  const outputPoleCount = spanCount * request.targetDegree + 1;
  const outputKnotCount = outputPoleCount + request.targetDegree + 1;
  check(outputPoleCount <= 64 && outputKnotCount <= 70, CODE.BUDGET,
    'Complete elevated coefficient dimensions exceed native64 poles or70 knots');
  const stations = quartileStations(blocks);
  check(stations.length <= request.maximumObservations, CODE.BUDGET, 'Complete observation budget exceeded');
  const declarations = compiledOriginal.ast.declarations.filter(value => value.id === request.curveId);
  const nodes = compiledOriginal.ir.nodes.filter(value => value.id === request.curveId);
  check(declarations.length === 1 && declarations[0].kind === 'curve' && nodes.length === 1 &&
    nodes[0].kind === 'curve' && same(nodes[0].geometry, originalCurve) &&
    same(nodes[0].span, declarations[0].range), CODE.BINDING,
  'Unique actual Curve AST/IR/full Model binding is required');
  const declaration = declarations[0];
  const degreeNode = degreeScalar(declaration, request.source, originalCurve.degree);
  const fields: SourceCurveDegreeElevationPatch['field'][] = ['knots', 'control-points', 'weights'];
  const arrays = fields.map(field => selectedArray(declaration, field, request.source,
    field === 'knots' ? originalCurve.knots : field === 'weights' ? originalCurve.weights : originalCurve.controlPoints));

  // All source, dimensions and strict quartile stations are admitted before homogeneous work.
  const coefficientResult = delegated(() => elevateC0BezierChainCoefficientsTrusted(originalCurve, blocks),
    CODE.REPRESENTABILITY, 'Actual one-step homogeneous Bernstein coefficients refused');
  const candidate = coefficientResult.candidate;
  check(candidate.id === originalCurve.id && candidate.degree === request.targetDegree &&
    candidate.controlPoints.length === outputPoleCount && candidate.knots.length === outputKnotCount,
  CODE.BINDING, 'Actual coefficient candidate must match complete degree/count preflight');
  let decimalEmissionCount = 0;
  const decimal = (value: number): string => {
    decimalEmissionCount++;
    const text = delegated(() => curveDecimal(value, 'Source Curve degree elevation'), CODE.REPRESENTABILITY,
      'Actual replacement scalar emission refused');
    check(text.length <= 512 && Object.is(Number(text), value), CODE.BINDING,
      'Every replacement scalar must round-trip actual bits');
    return text;
  };
  const degreeText = decimal(candidate.degree);
  const replacements = [
    '[' + candidate.knots.map(decimal).join(',') + ']',
    '[' + candidate.controlPoints.map(point => '[' + point.map(decimal).join(',') + ']').join(',') + ']',
    '[' + candidate.weights.map(decimal).join(',') + ']',
  ];
  const patches: SourceCurveDegreeElevationPatch[] = [{ field: 'degree', startUTF16: degreeNode.range.start,
    endUTF16: degreeNode.range.end, originalText: request.source.slice(degreeNode.range.start, degreeNode.range.end),
    replacementText: degreeText }, ...fields.map((field, index): SourceCurveDegreeElevationPatch => ({
    field, startUTF16: arrays[index].range.start, endUTF16: arrays[index].range.end,
    originalText: request.source.slice(arrays[index].range.start, arrays[index].range.end),
    replacementText: replacements[index],
  }))];
  patches.sort((a, b) => a.startUTF16 - b.startUTF16);
  const source = applyPatches(request.source, patches);
  const candidateSize = sourceSize(source);
  const compiledCandidate = compile(source, 'candidate');
  const expectedModel = snapshot(originalModel) as Model;
  expectedModel.objects[selectedObjectIndex] = candidate;
  check(same(compiledCandidate.model, expectedModel), CODE.BINDING,
    'Complete candidate Model changed beyond the actual elevated selected Curve');
  const model = compiledCandidate.model;
  const curve = model.objects[selectedObjectIndex];
  check(curve !== undefined && curve.kind === 'curve' && same(curve, candidate), CODE.BINDING,
    'Actual compiled selected Curve must equal the complete coefficient candidate');
  delegated(() => validateCurve(curve), CODE.NATIVE, 'Actual elevated Curve validation refused');
  const outputDomain = delegated(() => curveDomain(curve), CODE.NATIVE, 'Actual elevated domain refused');
  check(same(outputDomain, domain), CODE.BINDING, 'Original native domain bits must remain exact');
  for (const mapping of coefficientResult.copiedPoles) {
    check(same(originalCurve.controlPoints[mapping.originalPoleIndex], curve.controlPoints[mapping.outputPoleIndex]) &&
      Object.is(originalCurve.weights[mapping.originalPoleIndex], curve.weights[mapping.outputPoleIndex]), CODE.BINDING,
    'Every endpoint and C0 join must preserve copied original XYZ/weight bits');
  }
  for (const slot of coefficientResult.knots) {
    check(Object.is(curve.knots[slot.outputKnotIndex], slot.originalKnotIndex === null ?
      blocks[slot.blockIndex].value : originalCurve.knots[slot.originalKnotIndex]), CODE.BINDING,
    'Every original or added knot slot must preserve actual represented bits');
  }
  let curveD0Count = 0, curveD1AttemptCount = 0;
  let curveD1EvaluatedCount = 0, curveD1RefusedCount = 0;
  const d0 = (geometry: Curve, parameter: number): Point => {
    curveD0Count++;
    return delegated(() => evaluateCurve(geometry, parameter), CODE.NATIVE,
      'Actual original or elevated native Curve D0 refused');
  };
  const d1 = (geometry: Curve, parameter: number): D1State => {
    curveD1AttemptCount++;
    try {
      const value = evaluateCurveD1(geometry, parameter);
      curveD1EvaluatedCount++;
      return { status: 'evaluated', value };
    } catch (cause) {
      if (!(cause instanceof Error && /exact C0 interior knot/.test(cause.message))) {
        throw new SourceCurveDegreeElevationError(CODE.NATIVE,
          'Only actual exact-C0 interior native derivative refusal is admitted', cause);
      }
      curveD1RefusedCount++;
      return { status: 'refused-c0', name: cause.name.slice(0, 1024),
        reason: cause.message.slice(0, 1024), value: null };
    }
  };
  const observations: Observation[] = stations.map(parameter => {
    const originalPointMM = d0(originalCurve, parameter), pointMM = d0(curve, parameter);
    const pointDifferenceMM = Math.hypot(...pointMM.map((value, index) => value - originalPointMM[index]));
    check(Number.isFinite(pointDifferenceMM) && pointDifferenceMM <= 1e-7, CODE.BINDING,
      'Actual native original/elevated point difference exceeds1e-7mm');
    const originalD1 = d1(originalCurve, parameter), outputD1 = d1(curve, parameter);
    const atJoin = blocks.slice(1, -1).some(block => block.value === parameter);
    check(atJoin ? originalD1.status === 'refused-c0' && outputD1.status === 'refused-c0' :
      originalD1.status === 'evaluated' && outputD1.status === 'evaluated', CODE.BINDING,
    'Actual native endpoint/interior C0 states must remain truthful on both supports');
    const relativeDerivativeDifference = originalD1.status === 'evaluated' && outputD1.status === 'evaluated' ?
      relativeDifference(originalD1.value.derivative, outputD1.value.derivative) : null;
    return { parameter, originalPointMM, pointMM, pointDifferenceMM, originalD1, outputD1,
      relativeDerivativeDifference };
  });
  const generatedPoleCount = coefficientResult.spans.reduce((sum, span) => sum + span.generated.length, 0);
  const liftedPoleCount = coefficientResult.liftedOriginalHomogeneous.length;
  const copiedEndpointCount = coefficientResult.copiedPoles.length;
  const addedKnotCount = coefficientResult.knots.filter(slot => slot.originalKnotIndex === null).length;
  check(coefficientResult.spans.length === spanCount && generatedPoleCount === originalCurve.degree * spanCount &&
    generatedPoleCount <= 48 && liftedPoleCount === originalCurve.controlPoints.length && liftedPoleCount <= 49 &&
    copiedEndpointCount === spanCount + 1 && copiedEndpointCount <= 32 && addedKnotCount === spanCount + 1 &&
    coefficientResult.knots.length === curve.knots.length && curveD0Count === 2 * observations.length &&
    curveD1AttemptCount === 2 * observations.length &&
    curveD1EvaluatedCount + curveD1RefusedCount === curveD1AttemptCount &&
    curveD0Count + curveD1AttemptCount <= 500 &&
    decimalEmissionCount === 1 + curve.knots.length + 4 * curve.controlPoints.length && decimalEmissionCount <= 325,
  CODE.BINDING, 'Actual coefficient receipts, native attempts and decimal emission counts disagree');
  const provenance: Provenance = {
    selectedObjectIndex, originalDegree: originalCurve.degree, targetDegree: curve.degree, domain, blocks,
    parameterMap: { kind: 'identity', formula: 'u=t', d1Factor: 1 }, coefficientResult, patches,
  };
  const report: SourceCurveDegreeElevationReport = {
    schema: 'barocss-source-curve-degree-elevation-report', version: 0, sourceVersion: 0,
    lengthUnit: 'mm', modelName: model.name, curveId: curve.id, selectedObjectIndex,
    objectCount: model.objects.length, originalDegree: originalCurve.degree, targetDegree: curve.degree,
    domain, spanCount, poleCounts: { original: originalCurve.controlPoints.length, output: curve.controlPoints.length },
    knotCounts: { original: originalCurve.knots.length, output: curve.knots.length }, patchCount: 4,
    sourceSizes: { original: originalSize, candidate: candidateSize },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, stations, observations,
    maximumPointDifferenceMM: Math.max(...observations.map(value => value.pointDifferenceMM)),
    maximumRelativeDerivativeDifference: Math.max(0, ...observations.map(value => value.relativeDerivativeDifference ?? 0)),
    directCounts: {
      originalCompileCount: 1, candidateCompileCount: 1, coefficientElevationCallCount: 1,
      nativeCurveValidationCount: 2, domainQueryCount: 2, spanCount, generatedPoleCount, liftedPoleCount,
      copiedEndpointCount, addedKnotCount, patchCount: 4, decimalEmissionCount,
      observationCount: observations.length, curveD0Count, curveD1AttemptCount,
      curveD1EvaluatedCount, curveD1RefusedCount, oldPublicElevationCallCount: 0,
      sourceWriterCallCount: 0, insertionCallCount: 0, rationalOperationCount: 0,
    },
    preservation: {
      untouchedSourceSpans: true, modelHeaderBits: true, objectOrderAndIds: true,
      unselectedObjectBits: true, selectedCurveEqualsActualCoefficientCandidate: true,
      endpointAndJoinPoleBits: true, originalKnotSlotBits: true, domainBits: true, parameterIdentity: true,
    },
    quality: {
      geometricValidity: 'not-certified', topologyCertified: false, solid: false, localShapeObservations: true,
      globalShapeErrorCertified: false, globalBinary64ErrorCertified: false, g1g2Certified: false,
      manufacturingToleranceCertified: false, editorDisplayCertified: false, persistentTopologyBindingCertified: false,
      publication: false, derivativeSemantics: 'actual-native-guards-unchanged',
      ownership: 'independent-copied-cpu-data-gc',
    },
    limits: {
      maximumInputDegree: 4, maximumOutputDegree: 5, maximumElevations: 1, maximumSpans: 31,
      maximumOriginalPoles: 64, maximumProfileOriginalPoles: 49, maximumOutputPoles: 64,
      maximumKnots: 70, maximumGeneratedRows: 48, maximumCopiedEndpoints: 32,
      maximumObservations: 128, maximumProfileObservations: 125, maximumNativeAttempts: 500,
      maximumPatches: 4, maximumDecimalEmissions: 325, maximumModelObjects: 16,
      coordinateAbsMM: 10000, minimumWeight: 0.000001, maximumWeight: 1000000,
      maximumReplacementLiteralCharacters: 512, maximumPointDifferenceMM: 1e-7,
      maximumRelativeDerivativeDifference: 1e-7, sourceUTF16: 262144, sourceUTF8: 262144,
      maximumFileUTF16: 2097152, maximumFileUTF8: 2097152,
      ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64,
      keyCharacters: 128, stringCharacters: 262144, identifierCharacters: 48,
    },
    workScope: 'direct-wrapper-calls-private-coefficient-arithmetic-and-native-observations',
    budgetFailure: 'atomic-no-partial-source-degree-elevation',
  };
  const result: SourceCurveDegreeElevationResult = {
    request, source, originalModel, model, originalCurve, curve, provenance, report,
  };
  let stable = false;
  for (let pass = 0; pass < 8; pass++) {
    const measured = fileSize(result);
    if (same(measured, report.fileSizes.result)) { stable = true; break; }
    report.fileSizes.result = measured;
  }
  check(stable, CODE.FILE, 'Complete degree elevation size metadata did not settle within8 passes');
  return snapshot(result) as SourceCurveDegreeElevationResult;
}

/** Reconstruct once from full original source, including actual coefficients and observations. */
export function validateSourceCurveDegreeElevation(input: SourceCurveDegreeElevationResult): SourceCurveDegreeElevationReport {
  const owned = record(snapshot(input, true), ['request', 'source', 'originalModel', 'model',
    'originalCurve', 'curve', 'provenance', 'report'], CODE.OWNED) as unknown as SourceCurveDegreeElevationResult;
  let expected: SourceCurveDegreeElevationResult;
  try { expected = elevateSourceCurveDegree(owned.request); }
  catch (cause) {
    throw new SourceCurveDegreeElevationError(CODE.OWNED,
      'Complete source degree elevation reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED,
    'Owned source, Models, degree, chain receipts, patches, observations, counts or sizes changed');
  return snapshot(expected.report, true) as SourceCurveDegreeElevationReport;
}
