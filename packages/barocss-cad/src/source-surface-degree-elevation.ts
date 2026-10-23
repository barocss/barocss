import { compileCadModel } from './model-compiler.js';
import type { CadCompileResult } from './model-compiler.js';
import type { CadAstDeclaration, CadAstValue } from './language/source-ast.js';
import { elevateC0BezierChainCoefficientsTrusted } from './curve-c0-degree-elevation-internal.js';
import type { C0ElevationKnotBlock, C0ElevationCoefficientResult } from './curve-c0-degree-elevation-internal.js';
import { curveDecimal } from './curve-source.js';
import { validateSurface, surfaceDomain, evaluateSurface } from './math.js';
import { evaluateSurfaceD1 } from './derivatives.js';
import type { SurfaceD1Result } from './derivatives.js';
import type { Curve, Surface, Model, Point } from './types.js';
import { same } from './structural-equality.js';

export const SourceSurfaceDegreeElevationDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', SOURCE: 'SOURCE', TARGET: 'TARGET',
  BASIS: 'BASIS', BUDGET: 'BUDGET', REPRESENTABILITY: 'REPRESENTABILITY',
  BINDING: 'BINDING', NATIVE: 'NATIVE', OWNED: 'OWNED', FILE: 'FILE',
} as const);
export type SourceSurfaceDegreeElevationDiagnosticCode =
  typeof SourceSurfaceDegreeElevationDiagnosticCode[keyof typeof SourceSurfaceDegreeElevationDiagnosticCode];
export class SourceSurfaceDegreeElevationError extends Error {
  readonly code: SourceSurfaceDegreeElevationDiagnosticCode;
  constructor(code: SourceSurfaceDegreeElevationDiagnosticCode, detail: string, cause?: unknown) {
    super(('Source Surface degree elevation: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'SourceSurfaceDegreeElevationError';
    this.code = code;
  }
}
export interface SourceSurfaceDegreeElevationRequest {
  source: string;
  sourceVersion: 0;
  surfaceId: string;
  axis: 'u' | 'v';
  targetDegree: 2 | 3 | 4 | 5;
  maximumObservations: 1024;
}
export interface SourceSurfaceDegreeElevationPatch {
  field: 'degree-u' | 'degree-v' | 'knots-u' | 'knots-v' | 'control-points' | 'weights';
  startUTF16: number;
  endUTF16: number;
  originalText: string;
  replacementText: string;
}
type Size = { utf16: number; utf8: number };
type Degrees = { u: number; v: number };
type Domains = { u: [number, number]; v: [number, number] };
type Grid = { u: number; v: number; total: number };
type D1State = { status: 'evaluated'; value: SurfaceD1Result } |
  { status: 'refused-c0'; name: string; reason: string; value: null };
type Observation = {
  u: number; v: number;
  originalPointMM: Point; elevatedPointMM: Point; pointDifferenceMM: number;
  originalD1: D1State; elevatedD1: D1State;
  relativeDuDifference: number | null; relativeDvDifference: number | null;
};
type CopiedPole = {
  originalUIndex: number; originalVIndex: number;
  elevatedUIndex: number; elevatedVIndex: number;
};
type Strip = { fixedPoleIndex: number; originalCurve: Curve; calculation: C0ElevationCoefficientResult };
type Provenance = {
  selectedObjectIndex: number; axis: 'u' | 'v';
  degrees: { original: Degrees; elevated: Degrees }; domain: Domains;
  selectedBlocks: C0ElevationKnotBlock[]; spanCount: number;
  parameterMap: { kind: 'identity'; formula: 'u=s;v=t'; uD1Factor: 1; vD1Factor: 1 };
  patches: SourceSurfaceDegreeElevationPatch[]; copiedPoles: CopiedPole[];
  knots: C0ElevationCoefficientResult['knots']; strips: Strip[];
};
export interface SourceSurfaceDegreeElevationReport {
  schema: 'barocss-source-surface-degree-elevation-report'; version: 0; sourceVersion: 0;
  lengthUnit: 'mm'; modelName: string; surfaceId: string; selectedObjectIndex: number;
  objectCount: number; axis: 'u' | 'v';
  degrees: { original: Degrees; elevated: Degrees }; domain: Domains;
  grids: { original: Grid; elevated: Grid };
  knotCounts: { original: Degrees; elevated: Degrees };
  spanCount: number; stripCount: number; patchCount: 4;
  sourceSizes: { original: Size; candidate: Size }; fileSizes: { request: Size; result: Size };
  stations: { u: number[]; v: number[] }; observations: Observation[];
  maximumPointDifferenceMM: number; maximumRelativeDuDifference: number;
  maximumRelativeDvDifference: number;
  receiptCounts: { spanReceiptCount: number; generatedPoleCount: number;
    liftedPoleCount: number; copiedPoleCount: number; addedAxisKnotCount: number };
  directCounts: {
    originalCompileCount: 1; candidateCompileCount: 1; coefficientElevationCallCount: number;
    nativeSurfaceValidationCount: 2; domainQueryCount: 2; patchCount: 4;
    decimalEmissionCount: number; observationCount: number;
    surfaceD0Count: number; surfaceD1AttemptCount: number;
    surfaceD1EvaluatedCount: number; surfaceD1RefusedCount: number;
    curveD0Count: 0; curveD1AttemptCount: 0; curveDomainQueryCount: 0;
    publicCurveElevationCallCount: 0; sourceWriterCallCount: 0; rationalOperationCount: 0;
  };
  preservation: {
    untouchedSourceSpans: true; modelHeaderBits: true; objectOrderAndIds: true;
    unselectedObjectBits: true; selectedSurfaceEqualsActualCoefficientCandidate: true;
    endpointAndJoinPoleBits: true; originalKnotSlotBits: true;
    nonselectedDegreeKnotsBits: true; domainBits: true; parameterIdentity: true;
  };
  quality: {
    geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
    localShapeObservations: true; globalShapeErrorCertified: false; globalBinary64ErrorCertified: false;
    g1g2Certified: false; manufacturingToleranceCertified: false; editorDisplayCertified: false;
    persistentTopologyBindingCertified: false; publication: false;
    derivativeSemantics: 'actual-native-guards-unchanged'; ownership: 'independent-copied-cpu-data-gc';
  };
  limits: {
    maximumInputSelectedDegree: 4; maximumOutputSelectedDegree: 5; maximumOtherDegree: 5;
    maximumElevations: 1; maximumSelectedSpans: 7; maximumOriginalSelectedPoles: 13;
    maximumElevatedSelectedPoles: 16; maximumOtherPoles: 16; maximumTotalPoles: 256;
    maximumKnotsPerAxis: 22; maximumStrips: 16; maximumGeneratedRows: 192;
    maximumLiftedPoles: 208; maximumCopiedPoles: 128; maximumSpanReceipts: 112;
    maximumSelectedStations: 29; maximumOtherStations: 31;
    maximumObservations: 1024; maximumProfileObservations: 899; maximumNativeAttempts: 3596;
    maximumPatches: 4; maximumDecimalEmissions: 1047; maximumModelObjects: 16;
    coordinateAbsMM: 10000; minimumWeight: 0.000001; maximumWeight: 1000000;
    maximumReplacementLiteralCharacters: 512; maximumPointDifferenceMM: 1e-7;
    maximumRelativeDerivativeDifference: 1e-7; sourceUTF16: 262144; sourceUTF8: 262144;
    maximumFileUTF16: 4194304; maximumFileUTF8: 4194304;
    ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64;
    keyCharacters: 128; stringCharacters: 262144; identifierCharacters: 48;
  };
  workScope: 'direct-wrapper-calls-private-strip-arithmetic-and-whole-native-surface-observations';
  budgetFailure: 'atomic-no-partial-source-surface-degree-elevation';
}
export interface SourceSurfaceDegreeElevationResult {
  request: SourceSurfaceDegreeElevationRequest; source: string;
  originalModel: Model; model: Model; originalSurface: Surface; surface: Surface;
  provenance: Provenance; report: SourceSurfaceDegreeElevationReport;
}

type NumericData = number | NumericData[];
const CODE = SourceSurfaceDegreeElevationDiagnosticCode;
function check(condition: boolean, code: SourceSurfaceDegreeElevationDiagnosticCode,
  detail: string): asserts condition {
  if (!condition) throw new SourceSurfaceDegreeElevationError(code, detail);
}
function delegated<T>(action: () => T, code: SourceSurfaceDegreeElevationDiagnosticCode,
  detail: string): T {
  try { return action(); }
  catch (cause) { throw new SourceSurfaceDegreeElevationError(code, detail, cause); }
}
function record(input: unknown, fields: string[],
  code: SourceSurfaceDegreeElevationDiagnosticCode = CODE.INPUT): Record<string, unknown> {
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
    check(utf16 <= 4194304 && utf8 <= 4194304, CODE.FILE,
      'Complete JSON exceeds4194304 UTF16 units or UTF8 bytes');
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
  if (!result.ok) throw new SourceSurfaceDegreeElevationError(CODE.SOURCE,
    'Actual ' + stage + ' complete Source0 compilation refused', result);
  return result;
}
function selectedArray(declaration: CadAstDeclaration,
  field: SourceSurfaceDegreeElevationPatch['field'], source: string,
  expected: NumericData[]): Extract<CadAstValue, { kind: 'array' }> {
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
  const bind = (value: CadAstValue, data: NumericData, start: number, end: number): void => {
    within(value, start, end);
    if (Array.isArray(data)) {
      check(value.kind === 'array' && value.items.length === data.length, CODE.TARGET,
        'Actual selected array counts must match the native Surface');
      value.items.forEach((item, index) => bind(item, data[index], value.range.start, value.range.end));
    } else {
      check(value.kind === 'number', CODE.TARGET, 'Selected array leaves must be direct numeric literals');
      const lexeme = source.slice(value.range.start, value.range.end);
      check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(lexeme) &&
        Object.is(Number(lexeme), value.value) && Object.is(value.value, data), CODE.BINDING,
      'Original source, AST and native coefficient bits disagree');
    }
  };
  check(node.items.length === expected.length, CODE.TARGET, 'Selected array length does not match the Surface');
  node.items.forEach((item, index) => bind(item, expected[index], node.range.start, node.range.end));
  return node;
}
function applyPatches(source: string, patches: SourceSurfaceDegreeElevationPatch[]): string {
  check(patches.length === 4 && patches.every((patch, index) => index === 0 ||
    patches[index - 1].endUTF16 <= patch.startUTF16), CODE.BINDING,
  'Exactly four sorted nonoverlapping token and array patches are required');
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

function degreeScalar(declaration: CadAstDeclaration, field: 'degree-u' | 'degree-v',
  source: string, degree: number): Extract<CadAstValue, { kind: 'number' }> {
  const fields = declaration.fields.filter(value => value.name === field);
  check(fields.length === 1 && fields[0].value.kind === 'number', CODE.TARGET,
    'Selected degree must be one directly authored numeric token');
  const node = fields[0].value, range = node.range;
  check(Number.isInteger(range.start) && Number.isInteger(range.end) && range.start >= 0 &&
    range.start >= declaration.range.start && range.start < range.end &&
    range.end <= declaration.range.end && range.end <= source.length, CODE.BINDING,
  'Actual selected degree token UTF16 range is invalid');
  const lexeme = source.slice(range.start, range.end);
  check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(lexeme) &&
    Object.is(Number(lexeme), node.value) && Object.is(node.value, degree), CODE.BINDING,
  'Original selected degree token, AST and native degree bits disagree');
  return node;
}
function knotBlocks(knots: number[], p: number, poleCount: number,
  domain: [number, number]): C0ElevationKnotBlock[] {
  const blocks: C0ElevationKnotBlock[] = [];
  knots.forEach((value, index) => {
    const last = blocks[blocks.length - 1];
    if (last !== undefined && last.value === value) {
      check(Object.is(last.value, value), CODE.BASIS,
        'Mixed zero bits within any selected numeric-equal knot block are unsupported');
      last.originalLastKnotIndex = index;
      last.multiplicity++;
    } else {
      blocks.push({ index: blocks.length, value, originalFirstKnotIndex: index,
        originalLastKnotIndex: index, multiplicity: 1 });
    }
  });
  const spanCount = blocks.length - 1;
  check(spanCount >= 1 && blocks.every((block, index) =>
    block.multiplicity === (index === 0 || index === blocks.length - 1 ? p + 1 : p)),
  CODE.BASIS, 'Only a single Bezier span or exact-multiplicity C0 Bernstein chain is admitted');
  check(poleCount === spanCount * p + 1 && Object.is(blocks[0].value, domain[0]) &&
    Object.is(blocks[blocks.length - 1].value, domain[1]), CODE.BASIS,
  'Selected C0 chunks must bind original pole count and native domain bits');
  return blocks;
}
function quartileStations(blocks: C0ElevationKnotBlock[]): number[] {
  const stations = [blocks[0].value];
  for (let span = 0; span + 1 < blocks.length; span++) {
    const a = blocks[span].value, b = blocks[span + 1].value, width = b - a;
    check(Number.isFinite(width) && width > 0, CODE.REPRESENTABILITY,
      'Each original selected span must have a finite positive represented width');
    for (const fraction of [0.25, 0.5, 0.75]) {
      const parameter = a + width * fraction;
      check(Number.isFinite(parameter) && parameter > a && parameter < b &&
        parameter > stations[stations.length - 1], CODE.REPRESENTABILITY,
      'Selected quarter, midpoint and three-quarter stations must be strictly represented');
      stations.push(parameter);
    }
    stations.push(b);
  }
  check(stations.length === 4 * (blocks.length - 1) + 1 && stations.length <= 29,
    CODE.BUDGET, 'Complete selected quartile schedule exceeds29 stations');
  return stations;
}
/** Retain actual first break bits, rather than Set's negative-zero normalization. */
function otherStations(knots: number[], domain: [number, number]): number[] {
  const breaks = [domain[0]];
  for (const value of knots) {
    if (value > domain[0] && value < domain[1] && !breaks.some(prior => prior === value)) {
      breaks.push(value);
    }
  }
  breaks.push(domain[1]);
  const stations: number[] = [];
  for (let index = 0; index < breaks.length; index++) {
    stations.push(breaks[index]);
    if (index + 1 === breaks.length) continue;
    const width = breaks[index + 1] - breaks[index], midpoint = breaks[index] + width / 2;
    check(Number.isFinite(width) && width > 0 && Number.isFinite(midpoint) &&
      midpoint > breaks[index] && midpoint < breaks[index + 1], CODE.REPRESENTABILITY,
    'Each original opposite span requires a finite strictly represented midpoint');
    stations.push(midpoint);
  }
  check(stations.length <= 31 && Object.is(stations[0], domain[0]) &&
    Object.is(stations[stations.length - 1], domain[1]), CODE.BUDGET,
  'Complete opposite break/midpoint schedule must fit31 and retain domain bits');
  return stations;
}
function grid(surface: Surface): Grid {
  const u = surface.controlPoints.length, v = surface.controlPoints[0].length;
  return { u, v, total: u * v };
}
function pointCopy(point: Point): Point { return [point[0], point[1], point[2]]; }
function relativeDifference(before: Point, after: Point): number {
  const differenceNorm = Math.hypot(...after.map((value, index) => value - before[index]));
  const originalNorm = Math.hypot(...before), elevatedNorm = Math.hypot(...after);
  const scale = Math.max(1, originalNorm, elevatedNorm);
  check(Number.isFinite(differenceNorm) && Number.isFinite(originalNorm) &&
    Number.isFinite(elevatedNorm) && Number.isFinite(scale), CODE.REPRESENTABILITY,
  'Native partial comparison difference and both provider norms must remain finite');
  const relative = differenceNorm / scale;
  check(Number.isFinite(relative) && relative <= 1e-7, CODE.BINDING,
    'Actual native relative partial difference exceeds1e-7');
  return relative;
}
function sharedSchedule(calculation: C0ElevationCoefficientResult): unknown {
  return { degree: calculation.candidate.degree, knots: calculation.candidate.knots,
    poleCount: calculation.candidate.controlPoints.length,
    copiedPoles: calculation.copiedPoles, knotReceipts: calculation.knots,
    spans: calculation.spans.map(span => ({ index: span.index, domain: span.domain,
      originalPoleIndices: span.originalPoleIndices, outputPoleIndices: span.outputPoleIndices,
      generated: span.generated.map(value => ({ outputPoleIndex: value.outputPoleIndex,
        leftOriginalPoleIndex: value.leftOriginalPoleIndex,
        rightOriginalPoleIndex: value.rightOriginalPoleIndex, alpha: value.alpha })) })) };
}

/** Elevate one admitted actual Surface axis through copied private strips and preserve the full source. */
export function elevateSourceSurfaceAxisDegree(input: SourceSurfaceDegreeElevationRequest): SourceSurfaceDegreeElevationResult {
  const data = record(snapshot(input), ['source', 'sourceVersion', 'surfaceId', 'axis',
    'targetDegree', 'maximumObservations']);
  check(Object.is(data.sourceVersion, 0), CODE.VERSION, 'Only explicit literal Source0 is supported');
  check(typeof data.source === 'string', CODE.INPUT, 'Complete original source text is required');
  check(typeof data.surfaceId === 'string' && data.surfaceId.length <= 48 &&
    /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.surfaceId), CODE.IDENTITY,
  'Selected ASCII Surface ID1..48 is required');
  check(data.axis === 'u' || data.axis === 'v', CODE.INPUT, 'Selected original axis must be u or v');
  check(data.targetDegree === 2 || data.targetDegree === 3 || data.targetDegree === 4 || data.targetDegree === 5,
    CODE.TARGET, 'An explicit one-step target degree2..5 is required');
  check(data.maximumObservations === 1024, CODE.BUDGET, 'Fixed complete observation budget1024 is required');
  const request = data as unknown as SourceSurfaceDegreeElevationRequest;
  const requestSize = fileSize(request), originalSize = sourceSize(request.source);
  const compiledOriginal = compile(request.source, 'original'), originalModel = compiledOriginal.model;
  check(originalModel.objects.length <= 16, CODE.BUDGET, 'Complete original Model capacity16 is required');
  const selectedObjectIndex = originalModel.objects.findIndex(object => object.id === request.surfaceId);
  const selected = originalModel.objects[selectedObjectIndex];
  check(selected !== undefined && selected.kind === 'surface', CODE.TARGET,
    'Selected ID must identify an actual original Surface');
  const originalSurface = selected, originalGrid = grid(originalSurface);
  const axis = request.axis, other = axis === 'u' ? 'v' : 'u';
  const originalDegrees = { u: originalSurface.degreeU, v: originalSurface.degreeV };
  const p = originalDegrees[axis], q = request.targetDegree;
  const selectedKnots = axis === 'u' ? originalSurface.knotsU : originalSurface.knotsV;
  const otherKnots = axis === 'u' ? originalSurface.knotsV : originalSurface.knotsU;
  check(p >= 1 && p <= 4 && q === p + 1, CODE.TARGET,
    'Selected original degree1..4 must elevate by exactly one to degree2..5');
  check(originalDegrees[other] >= 1 && originalDegrees[other] <= 5 &&
    originalGrid.u <= 16 && originalGrid.v <= 16 && originalGrid.total <= 256 &&
    selectedKnots.length <= 22 && otherKnots.length <= 22, CODE.BUDGET,
  'Original axes, complete net and both knot arrays must fit unchanged native Surface capacity');
  check(originalSurface.controlPoints.every(row => row.every(point =>
    point.every(value => Math.abs(value) <= 10000))), CODE.BUDGET,
  'Selected original Cartesian coordinates must remain within10000mm');
  delegated(() => validateSurface(originalSurface), CODE.NATIVE, 'Actual original Surface validation refused');
  const domain = delegated(() => surfaceDomain(originalSurface), CODE.NATIVE,
    'Actual original Surface domain query refused');
  for (const name of ['u', 'v'] as const) {
    const width = domain[name][1] - domain[name][0];
    check(Number.isFinite(width) && width > 0, CODE.REPRESENTABILITY,
      'Both full native domain spans must be finite and positive');
  }
  const selectedBlocks = knotBlocks(selectedKnots, p, originalGrid[axis], domain[axis]);
  const spanCount = selectedBlocks.length - 1, outputSelectedCount = spanCount * q + 1;
  const outputSelectedKnotCount = outputSelectedCount + q + 1;
  check(originalGrid[axis] <= 13 && outputSelectedCount <= 16 &&
    originalGrid[other] <= 16 && outputSelectedCount * originalGrid[other] <= 256 &&
    outputSelectedKnotCount <= 22 && spanCount <= 7, CODE.BUDGET,
  'Complete elevated axis/net/knot capacities must be admitted before any helper');
  const selectedStations = quartileStations(selectedBlocks), oppositeStations = otherStations(otherKnots, domain[other]);
  const stations = axis === 'u' ? { u: selectedStations, v: oppositeStations } :
    { u: oppositeStations, v: selectedStations };
  const m = stations.u.length * stations.v.length;
  check(m <= 899 && m <= request.maximumObservations, CODE.BUDGET,
    'Complete Surface Cartesian observation schedule exceeds the fixed profile');
  const declarations = compiledOriginal.ast.declarations.filter(value => value.id === request.surfaceId);
  const nodes = compiledOriginal.ir.nodes.filter(value => value.id === request.surfaceId);
  check(declarations.length === 1 && declarations[0].kind === 'surface' &&
    nodes.length === 1 && nodes[0].kind === 'surface' &&
    same(nodes[0].geometry, originalSurface) && same(nodes[0].span, declarations[0].range), CODE.BINDING,
  'Unique actual Surface declaration, literal IR geometry and full Model binding is required');
  const declaration = declarations[0], degreeField = axis === 'u' ? 'degree-u' as const : 'degree-v' as const;
  const degreeNode = degreeScalar(declaration, degreeField, request.source, p);
  const fields: SourceSurfaceDegreeElevationPatch['field'][] = [
    axis === 'u' ? 'knots-u' : 'knots-v', 'control-points', 'weights',
  ];
  const arrays = fields.map(field => selectedArray(declaration, field, request.source,
    field === 'control-points' ? originalSurface.controlPoints :
      field === 'weights' ? originalSurface.weights : selectedKnots));

  // Admission above is complete before any actual homogeneous coefficient work.
  let coefficientElevationCallCount = 0;
  const strips: Strip[] = Array.from({ length: originalGrid[other] }, (_, fixedPoleIndex) => {
    const points = axis === 'u' ? originalSurface.controlPoints.map(row => row[fixedPoleIndex]) :
      originalSurface.controlPoints[fixedPoleIndex];
    const weights = axis === 'u' ? originalSurface.weights.map(row => row[fixedPoleIndex]) :
      originalSurface.weights[fixedPoleIndex];
    const originalCurve: Curve = { kind: 'curve', id: 'surface_elevation_strip_' + fixedPoleIndex,
      degree: p, knots: selectedKnots.slice(), controlPoints: points.map(pointCopy), weights: weights.slice() };
    // These own DTOs are private coefficient contexts, never caller source/Model identities or isoCurves.
    coefficientElevationCallCount++;
    const calculation = delegated(() => elevateC0BezierChainCoefficientsTrusted(originalCurve, selectedBlocks),
      CODE.REPRESENTABILITY, 'Actual strip' + fixedPoleIndex + ' homogeneous elevation refused');
    return { fixedPoleIndex, originalCurve, calculation };
  });
  const first = strips[0].calculation, schedule = sharedSchedule(first);
  for (const strip of strips) {
    const current = strip.calculation;
    check(same(sharedSchedule(current), schedule) && current.candidate.id === strip.originalCurve.id &&
      current.candidate.degree === q && current.candidate.controlPoints.length === outputSelectedCount &&
      current.candidate.knots.length === outputSelectedKnotCount, CODE.BINDING,
    'Each actual strip must agree on the shared basis and copy/index/alpha schedule');
    // Actual homogeneous values, weights and generated Cartesian coefficients remain independent.
  }
  const countU = axis === 'u' ? outputSelectedCount : originalGrid.u;
  const countV = axis === 'v' ? outputSelectedCount : originalGrid.v;
  const candidate: Surface = {
    kind: 'surface', id: originalSurface.id,
    degreeU: axis === 'u' ? q : originalSurface.degreeU,
    degreeV: axis === 'v' ? q : originalSurface.degreeV,
    knotsU: (axis === 'u' ? first.candidate.knots : originalSurface.knotsU).slice(),
    knotsV: (axis === 'v' ? first.candidate.knots : originalSurface.knotsV).slice(),
    controlPoints: Array.from({ length: countU }, (_, u) => Array.from({ length: countV }, (_, v) =>
      pointCopy(axis === 'u' ? strips[v].calculation.candidate.controlPoints[u] :
        strips[u].calculation.candidate.controlPoints[v]))),
    weights: Array.from({ length: countU }, (_, u) => Array.from({ length: countV }, (_, v) =>
      axis === 'u' ? strips[v].calculation.candidate.weights[u] : strips[u].calculation.candidate.weights[v])),
  };
  let decimalEmissionCount = 0;
  const decimal = (value: number): string => {
    decimalEmissionCount++;
    const text = delegated(() => curveDecimal(value, 'Source Surface degree elevation'),
      CODE.REPRESENTABILITY, 'Actual replacement scalar emission refused');
    check(text.length <= 512 && Object.is(Number(text), value), CODE.BINDING,
      'Every replacement scalar must round-trip actual bits within512characters');
    return text;
  };
  const degreeText = decimal(q), outputKnots = axis === 'u' ? candidate.knotsU : candidate.knotsV;
  const replacements = [
    '[' + outputKnots.map(decimal).join(',') + ']',
    '[' + candidate.controlPoints.map(row => '[' + row.map(point =>
      '[' + point.map(decimal).join(',') + ']').join(',') + ']').join(',') + ']',
    '[' + candidate.weights.map(row => '[' + row.map(decimal).join(',') + ']').join(',') + ']',
  ];
  const patches: SourceSurfaceDegreeElevationPatch[] = [{ field: degreeField,
    startUTF16: degreeNode.range.start, endUTF16: degreeNode.range.end,
    originalText: request.source.slice(degreeNode.range.start, degreeNode.range.end), replacementText: degreeText },
  ...fields.map((field, index): SourceSurfaceDegreeElevationPatch => ({ field,
    startUTF16: arrays[index].range.start, endUTF16: arrays[index].range.end,
    originalText: request.source.slice(arrays[index].range.start, arrays[index].range.end),
    replacementText: replacements[index] }))];
  patches.sort((a, b) => a.startUTF16 - b.startUTF16);
  const source = applyPatches(request.source, patches), candidateSize = sourceSize(source);
  const compiledCandidate = compile(source, 'candidate'), expectedModel = snapshot(originalModel) as Model;
  expectedModel.objects[selectedObjectIndex] = candidate;
  check(same(compiledCandidate.model, expectedModel), CODE.BINDING,
    'Complete candidate Model changed beyond the actual elevated selected Surface');
  const model = compiledCandidate.model, surface = model.objects[selectedObjectIndex];
  check(surface !== undefined && surface.kind === 'surface' && same(surface, candidate), CODE.BINDING,
    'Actual compiled selected Surface must equal the complete assembled coefficient candidate');
  delegated(() => validateSurface(surface), CODE.NATIVE, 'Actual accepted Surface validation refused');
  const elevatedDomain = delegated(() => surfaceDomain(surface), CODE.NATIVE,
    'Actual accepted Surface domain query refused');
  check(same(domain, elevatedDomain), CODE.BINDING, 'Both original domain endpoint bit tuples must remain');
  check(Object.is(axis === 'u' ? surface.degreeV : surface.degreeU, originalDegrees[other]) &&
    same(axis === 'u' ? surface.knotsV : surface.knotsU, otherKnots), CODE.BINDING,
  'The entire opposite degree and knot axis must retain its original bits');
  const copiedPoles: CopiedPole[] = strips.flatMap(strip =>
    strip.calculation.copiedPoles.map(mapping => axis === 'u' ? {
      originalUIndex: mapping.originalPoleIndex, originalVIndex: strip.fixedPoleIndex,
      elevatedUIndex: mapping.outputPoleIndex, elevatedVIndex: strip.fixedPoleIndex,
    } : {
      originalUIndex: strip.fixedPoleIndex, originalVIndex: mapping.originalPoleIndex,
      elevatedUIndex: strip.fixedPoleIndex, elevatedVIndex: mapping.outputPoleIndex,
    }));
  for (const mapping of copiedPoles) {
    check(same(originalSurface.controlPoints[mapping.originalUIndex][mapping.originalVIndex],
      surface.controlPoints[mapping.elevatedUIndex][mapping.elevatedVIndex]) &&
      Object.is(originalSurface.weights[mapping.originalUIndex][mapping.originalVIndex],
        surface.weights[mapping.elevatedUIndex][mapping.elevatedVIndex]), CODE.BINDING,
    'Copied endpoints and shared joins must retain every original Cartesian and weight bit');
  }
  const acceptedKnots = axis === 'u' ? surface.knotsU : surface.knotsV;
  const originalSlots = first.knots.filter(value => value.originalKnotIndex !== null);
  check(originalSlots.length === selectedKnots.length && originalSlots.every((value, index) =>
    value.originalKnotIndex === index && value.origin === 'original-copy' &&
    Object.is(value.value, selectedKnots[index]) && Object.is(acceptedKnots[value.outputKnotIndex], selectedKnots[index])),
  CODE.BINDING, 'Every old selected knot slot must retain its actual source/native bits');
  const addedSlots = first.knots.filter(value => value.originalKnotIndex === null);
  check(addedSlots.length === selectedBlocks.length && addedSlots.every((value, index) =>
    value.blockIndex === index && value.origin === 'degree-multiplicity-increase' &&
    Object.is(value.value, selectedBlocks[index].value) &&
    Object.is(acceptedKnots[value.outputKnotIndex], selectedBlocks[index].value)), CODE.BINDING,
  'Each selected block must add exactly one represented common-bit duplicate');
  const elevatedGrid = grid(surface), elevatedDegrees = { u: surface.degreeU, v: surface.degreeV };
  const receiptCounts = {
    spanReceiptCount: strips.reduce((sum, strip) => sum + strip.calculation.spans.length, 0),
    generatedPoleCount: strips.reduce((sum, strip) => sum + strip.calculation.spans.reduce((count, span) =>
      count + span.generated.length, 0), 0),
    liftedPoleCount: strips.reduce((sum, strip) => sum + strip.calculation.liftedOriginalHomogeneous.length, 0),
    copiedPoleCount: copiedPoles.length, addedAxisKnotCount: addedSlots.length,
  };
  check(receiptCounts.spanReceiptCount <= 112 && receiptCounts.generatedPoleCount <= 192 &&
    receiptCounts.liftedPoleCount <= 208 && receiptCounts.copiedPoleCount <= 128 &&
    receiptCounts.generatedPoleCount + receiptCounts.copiedPoleCount === elevatedGrid.total &&
    receiptCounts.liftedPoleCount === originalGrid.total &&
    coefficientElevationCallCount === originalGrid[other], CODE.BINDING,
  'Complete actual strip/copy/generated/lift receipts must partition the admitted net');
  check(decimalEmissionCount === 1 + acceptedKnots.length + 4 * elevatedGrid.total &&
    decimalEmissionCount <= 1047, CODE.BINDING, 'Every actual replacement scalar must be counted once');

  let surfaceD0Count = 0, surfaceD1AttemptCount = 0, surfaceD1EvaluatedCount = 0, surfaceD1RefusedCount = 0;
  const d0 = (geometry: Surface, u: number, v: number): Point => {
    surfaceD0Count++;
    return delegated(() => evaluateSurface(geometry, u, v), CODE.NATIVE,
      'Actual original or elevated Surface D0 refused');
  };
  const d1 = (geometry: Surface, u: number, v: number): D1State => {
    surfaceD1AttemptCount++;
    try {
      const value = evaluateSurfaceD1(geometry, u, v);
      surfaceD1EvaluatedCount++;
      return { status: 'evaluated', value };
    } catch (cause) {
      if (!(cause instanceof Error && /exact C0 interior knot/.test(cause.message))) {
        throw new SourceSurfaceDegreeElevationError(CODE.NATIVE,
          'Only the actual whole exact-C0 interior-knot Surface D1 refusal is admissible', cause);
      }
      surfaceD1RefusedCount++;
      return { status: 'refused-c0', name: cause.name.slice(0, 1024),
        reason: cause.message.slice(0, 1024), value: null };
    }
  };
  const observations: Observation[] = stations.u.flatMap(u => stations.v.map(v => {
    const originalPointMM = d0(originalSurface, u, v), elevatedPointMM = d0(surface, u, v);
    const pointDifferenceMM = Math.hypot(...elevatedPointMM.map((value, index) => value - originalPointMM[index]));
    check(Number.isFinite(pointDifferenceMM) && pointDifferenceMM <= 1e-7, CODE.BINDING,
      'Actual native original/elevated point difference exceeds1e-7mm');
    const originalD1 = d1(originalSurface, u, v), elevatedD1 = d1(surface, u, v);
    let relativeDuDifference: number | null = null, relativeDvDifference: number | null = null;
    if (originalD1.status === 'evaluated' && elevatedD1.status === 'evaluated') {
      relativeDuDifference = relativeDifference(originalD1.value.du, elevatedD1.value.du);
      relativeDvDifference = relativeDifference(originalD1.value.dv, elevatedD1.value.dv);
    }
    return { u, v, originalPointMM, elevatedPointMM, pointDifferenceMM, originalD1, elevatedD1,
      relativeDuDifference, relativeDvDifference };
  }));
  check(observations.length === m && surfaceD0Count === 2 * m && surfaceD1AttemptCount === 2 * m &&
    surfaceD1EvaluatedCount + surfaceD1RefusedCount === surfaceD1AttemptCount &&
    surfaceD0Count + surfaceD1AttemptCount <= 3596, CODE.BINDING,
  'Every actual whole native Surface attempt must match the complete preflight schedule');
  const degrees = { original: originalDegrees, elevated: elevatedDegrees };
  const provenance: Provenance = { selectedObjectIndex, axis, degrees, domain, selectedBlocks, spanCount,
    parameterMap: { kind: 'identity', formula: 'u=s;v=t', uD1Factor: 1, vD1Factor: 1 },
    patches, copiedPoles, knots: first.knots, strips };
  const report: SourceSurfaceDegreeElevationReport = {
    schema: 'barocss-source-surface-degree-elevation-report', version: 0, sourceVersion: 0,
    lengthUnit: 'mm', modelName: model.name, surfaceId: surface.id, selectedObjectIndex,
    objectCount: model.objects.length, axis, degrees, domain,
    grids: { original: originalGrid, elevated: elevatedGrid },
    knotCounts: { original: { u: originalSurface.knotsU.length, v: originalSurface.knotsV.length },
      elevated: { u: surface.knotsU.length, v: surface.knotsV.length } },
    spanCount, stripCount: strips.length, patchCount: 4,
    sourceSizes: { original: originalSize, candidate: candidateSize },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, stations, observations,
    maximumPointDifferenceMM: Math.max(0, ...observations.map(value => value.pointDifferenceMM)),
    maximumRelativeDuDifference: Math.max(0, ...observations.map(value => value.relativeDuDifference ?? 0)),
    maximumRelativeDvDifference: Math.max(0, ...observations.map(value => value.relativeDvDifference ?? 0)),
    receiptCounts,
    directCounts: { originalCompileCount: 1, candidateCompileCount: 1, coefficientElevationCallCount,
      nativeSurfaceValidationCount: 2, domainQueryCount: 2, patchCount: 4, decimalEmissionCount,
      observationCount: m, surfaceD0Count, surfaceD1AttemptCount, surfaceD1EvaluatedCount, surfaceD1RefusedCount,
      curveD0Count: 0, curveD1AttemptCount: 0, curveDomainQueryCount: 0,
      publicCurveElevationCallCount: 0, sourceWriterCallCount: 0, rationalOperationCount: 0 },
    preservation: { untouchedSourceSpans: true, modelHeaderBits: true, objectOrderAndIds: true,
      unselectedObjectBits: true, selectedSurfaceEqualsActualCoefficientCandidate: true,
      endpointAndJoinPoleBits: true, originalKnotSlotBits: true, nonselectedDegreeKnotsBits: true,
      domainBits: true, parameterIdentity: true },
    quality: { geometricValidity: 'not-certified', topologyCertified: false, solid: false,
      localShapeObservations: true, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false,
      g1g2Certified: false, manufacturingToleranceCertified: false, editorDisplayCertified: false,
      persistentTopologyBindingCertified: false, publication: false,
      derivativeSemantics: 'actual-native-guards-unchanged', ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumInputSelectedDegree: 4, maximumOutputSelectedDegree: 5, maximumOtherDegree: 5,
      maximumElevations: 1, maximumSelectedSpans: 7, maximumOriginalSelectedPoles: 13,
      maximumElevatedSelectedPoles: 16, maximumOtherPoles: 16, maximumTotalPoles: 256,
      maximumKnotsPerAxis: 22, maximumStrips: 16, maximumGeneratedRows: 192,
      maximumLiftedPoles: 208, maximumCopiedPoles: 128, maximumSpanReceipts: 112,
      maximumSelectedStations: 29, maximumOtherStations: 31, maximumObservations: 1024,
      maximumProfileObservations: 899, maximumNativeAttempts: 3596,
      maximumPatches: 4, maximumDecimalEmissions: 1047, maximumModelObjects: 16,
      coordinateAbsMM: 10000, minimumWeight: 0.000001, maximumWeight: 1000000,
      maximumReplacementLiteralCharacters: 512, maximumPointDifferenceMM: 1e-7,
      maximumRelativeDerivativeDifference: 1e-7, sourceUTF16: 262144, sourceUTF8: 262144,
      maximumFileUTF16: 4194304, maximumFileUTF8: 4194304,
      ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64,
      keyCharacters: 128, stringCharacters: 262144, identifierCharacters: 48 },
    workScope: 'direct-wrapper-calls-private-strip-arithmetic-and-whole-native-surface-observations',
    budgetFailure: 'atomic-no-partial-source-surface-degree-elevation',
  };
  const result: SourceSurfaceDegreeElevationResult = {
    request, source, originalModel, model, originalSurface, surface, provenance, report,
  };
  let stable = false;
  for (let pass = 0; pass < 8; pass++) {
    const size = fileSize(result);
    if (same(size, report.fileSizes.result)) { stable = true; break; }
    report.fileSizes.result = size;
  }
  check(stable, CODE.FILE, 'Complete result size metadata must settle within8 passes');
  return snapshot(result) as SourceSurfaceDegreeElevationResult;
}

/** Reconstruct the complete source, every actual strip and native slot once, then compare all retained bits. */
export function validateSourceSurfaceAxisDegreeElevation(input: SourceSurfaceDegreeElevationResult): SourceSurfaceDegreeElevationReport {
  const owned = record(snapshot(input, true), ['request', 'source', 'originalModel', 'model',
    'originalSurface', 'surface', 'provenance', 'report'], CODE.OWNED) as unknown as SourceSurfaceDegreeElevationResult;
  let expected: SourceSurfaceDegreeElevationResult;
  try {
    fileSize(owned);
    expected = elevateSourceSurfaceAxisDegree(owned.request);
  } catch (cause) {
    throw new SourceSurfaceDegreeElevationError(CODE.OWNED,
      'Whole source, axis-strip and native Surface elevation reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED,
    'Owned full sources, Models, Surfaces, strips, patches, maps, observations, counts, quality or sizes changed');
  return snapshot(expected.report, true) as SourceSurfaceDegreeElevationReport;
}
