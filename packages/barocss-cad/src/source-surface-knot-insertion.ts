import { compileCadModel } from './model-compiler.js';
import type { CadCompileResult } from './model-compiler.js';
import type { CadAstDeclaration, CadAstValue } from './language/source-ast.js';
import { insertCurveKnotCoefficientsTrusted } from './curve-knot-insertion.js';
import type { CurveKnotCoefficientResult } from './curve-knot-insertion.js';
import { curveDecimal } from './curve-source.js';
import { validateSurface, surfaceDomain, evaluateSurface } from './math.js';
import { evaluateSurfaceD1 } from './derivatives.js';
import type { SurfaceD1Result } from './derivatives.js';
import type { Curve, Surface, Model, Point } from './types.js';
import { same } from './structural-equality.js';

export const SourceSurfaceKnotInsertionDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', SOURCE: 'SOURCE',
  TARGET: 'TARGET', REQUEST: 'REQUEST', BUDGET: 'BUDGET',
  REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', NATIVE: 'NATIVE',
  OWNED: 'OWNED', FILE: 'FILE',
} as const);
export type SourceSurfaceKnotInsertionDiagnosticCode =
  typeof SourceSurfaceKnotInsertionDiagnosticCode[keyof typeof SourceSurfaceKnotInsertionDiagnosticCode];
export class SourceSurfaceKnotInsertionError extends Error {
  readonly code: SourceSurfaceKnotInsertionDiagnosticCode;
  constructor(code: SourceSurfaceKnotInsertionDiagnosticCode, detail: string, cause?: unknown) {
    super(('Source Surface knot insertion: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'SourceSurfaceKnotInsertionError';
    this.code = code;
  }
}
export interface SourceSurfaceKnotInsertionRequest {
  source: string;
  sourceVersion: 0;
  surfaceId: string;
  axis: 'u' | 'v';
  knot: number;
  maximumObservations: 1024;
}
export interface SourceSurfaceKnotInsertionPatch {
  field: 'knots-u' | 'knots-v' | 'control-points' | 'weights';
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
  u: number;
  v: number;
  originalPointMM: Point;
  refinedPointMM: Point;
  pointDifferenceMM: number;
  originalD1: D1State;
  refinedD1: D1State;
  relativeDuDifference: number | null;
  relativeDvDifference: number | null;
};
type UnchangedPole = {
  originalUIndex: number; originalVIndex: number;
  refinedUIndex: number; refinedVIndex: number;
};
type Strip = {
  fixedPoleIndex: number;
  originalCurve: Curve;
  calculation: CurveKnotCoefficientResult;
};
type Provenance = {
  selectedObjectIndex: number;
  axis: 'u' | 'v';
  degrees: Degrees;
  domain: Domains;
  knot: number;
  priorMultiplicity: number;
  refinedMultiplicity: number;
  parameterMap: { kind: 'identity'; formula: 'u=s;v=t'; uD1Factor: 1; vD1Factor: 1 };
  patches: SourceSurfaceKnotInsertionPatch[];
  unchangedPoles: UnchangedPole[];
  unchangedKnots: CurveKnotCoefficientResult['unchangedKnots'];
  strips: Strip[];
};
export interface SourceSurfaceKnotInsertionReport {
  schema: 'barocss-source-surface-knot-insertion-report';
  version: 0;
  sourceVersion: 0;
  lengthUnit: 'mm';
  modelName: string;
  surfaceId: string;
  selectedObjectIndex: number;
  objectCount: number;
  axis: 'u' | 'v';
  degrees: Degrees;
  domain: Domains;
  grids: { original: Grid; refined: Grid };
  knotCounts: { original: Degrees; refined: Degrees };
  knot: number;
  priorMultiplicity: number;
  refinedMultiplicity: number;
  stripCount: number;
  patchCount: 3;
  sourceSizes: { original: Size; candidate: Size };
  fileSizes: { request: Size; result: Size };
  stations: { u: number[]; v: number[] };
  observations: Observation[];
  maximumPointDifferenceMM: number;
  maximumRelativeDuDifference: number;
  maximumRelativeDvDifference: number;
  directCounts: {
    originalCompileCount: 1; candidateCompileCount: 1;
    coefficientInsertionCallCount: number; insertedAxisKnotCount: 1;
    nativeSurfaceValidationCount: 2; domainQueryCount: 2; patchCount: 3;
    decimalEmissionCount: number; observationCount: number;
    surfaceD0Count: number; surfaceD1AttemptCount: number;
    surfaceD1EvaluatedCount: number; surfaceD1RefusedCount: number;
    curveD0Count: 0; curveD1AttemptCount: 0; sourceWriterCallCount: 0;
    publicRefinementCallCount: 0; rationalOperationCount: 0;
  };
  preservation: {
    untouchedSourceSpans: true; modelHeaderBits: true; objectOrderAndIds: true;
    unselectedObjectBits: true; selectedSurfaceEqualsActualCoefficientCandidate: true;
    unaffectedCoefficientBits: true; degreesDomains: true; nonselectedKnots: true;
    parameterIdentity: true;
  };
  quality: {
    geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
    localShapeObservations: true; globalShapeErrorCertified: false;
    globalBinary64ErrorCertified: false; g1g2Certified: false;
    manufacturingToleranceCertified: false; editorDisplayCertified: false;
    persistentTopologyBindingCertified: false; publication: false;
    derivativeSemantics: 'actual-native-guards-unchanged';
    ownership: 'independent-copied-cpu-data-gc';
  };
  limits: {
    maximumDegree: 5; maximumOriginalSelectedPoles: 15; maximumRefinedSelectedPoles: 16;
    maximumOtherPoles: 16; maximumTotalPoles: 256; maximumKnotsPerAxis: 22;
    maximumInsertions: 1; maximumStrips: 16; maximumSelectedStations: 32;
    maximumOtherStations: 31; maximumObservations: 1024; maximumProfileObservations: 992;
    maximumNativeAttempts: 3968; maximumPatches: 3; maximumModelObjects: 16;
    coordinateAbsMM: 10000; minimumWeight: 0.000001; maximumWeight: 1000000;
    maximumReplacementLiteralCharacters: 512; maximumPointDifferenceMM: 1e-7;
    maximumRelativeDerivativeDifference: 1e-7; sourceUTF16: 262144; sourceUTF8: 262144;
    maximumFileUTF16: 4194304; maximumFileUTF8: 4194304;
    ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64;
    keyCharacters: 128; stringCharacters: 262144; identifierCharacters: 48;
  };
  workScope: 'direct-wrapper-calls-inherited-helper-compiler-work-excluded';
  budgetFailure: 'atomic-no-partial-source-surface-insertion';
}
export interface SourceSurfaceKnotInsertionResult {
  request: SourceSurfaceKnotInsertionRequest;
  source: string;
  originalModel: Model;
  model: Model;
  originalSurface: Surface;
  surface: Surface;
  provenance: Provenance;
  report: SourceSurfaceKnotInsertionReport;
}

type NumericData = number | NumericData[];
const CODE = SourceSurfaceKnotInsertionDiagnosticCode;
function check(condition: boolean, code: SourceSurfaceKnotInsertionDiagnosticCode,
  detail: string): asserts condition {
  if (!condition) throw new SourceSurfaceKnotInsertionError(code, detail);
}
function delegated<T>(action: () => T, code: SourceSurfaceKnotInsertionDiagnosticCode,
  detail: string): T {
  try { return action(); }
  catch (cause) { throw new SourceSurfaceKnotInsertionError(code, detail, cause); }
}
function record(input: unknown, fields: string[],
  code: SourceSurfaceKnotInsertionDiagnosticCode = CODE.INPUT): Record<string, unknown> {
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
  if (!result.ok) throw new SourceSurfaceKnotInsertionError(CODE.SOURCE,
    'Actual ' + stage + ' complete Source0 compilation refused', result);
  return result;
}
function selectedArray(declaration: CadAstDeclaration,
  field: SourceSurfaceKnotInsertionPatch['field'], source: string,
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
function applyPatches(source: string, patches: SourceSurfaceKnotInsertionPatch[]): string {
  check(patches.length === 3 && patches.every((patch, index) => index === 0 ||
    patches[index - 1].endUTF16 <= patch.startUTF16), CODE.BINDING,
  'Exactly three sorted nonoverlapping array patches are required');
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

/** Numeric deduplication retains first chosen bits, including original endpoints. */
function axisStations(knotArrays: number[][], domain: [number, number]): number[] {
  const parameters: number[] = [];
  const add = (value: number): void => {
    if (!parameters.some(prior => prior === value)) parameters.push(value);
  };
  add(domain[0]);
  add(domain[1]);
  for (const knots of knotArrays) {
    const breaks = [domain[0]];
    for (const knot of knots) {
      if (knot > domain[0] && knot < domain[1] && !breaks.some(prior => prior === knot)) {
        breaks.push(knot);
      }
    }
    breaks.push(domain[1]);
    for (let index = 0; index < breaks.length; index++) {
      add(breaks[index]);
      if (index + 1 === breaks.length) continue;
      const width = breaks[index + 1] - breaks[index];
      const midpoint = breaks[index] + width / 2;
      check(Number.isFinite(width) && width > 0 && Number.isFinite(midpoint) &&
        midpoint > breaks[index] && midpoint < breaks[index + 1], CODE.REPRESENTABILITY,
      'Every original and refined span requires a finite strictly represented midpoint');
      add(midpoint);
    }
  }
  parameters.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  check(Object.is(parameters[0], domain[0]) &&
    Object.is(parameters[parameters.length - 1], domain[1]), CODE.BINDING,
  'Axis station endpoint bits must match the original domain');
  return parameters;
}
function grid(surface: Surface): Grid {
  const u = surface.controlPoints.length, v = surface.controlPoints[0].length;
  return { u, v, total: u * v };
}
function pointCopy(point: Point): Point { return [point[0], point[1], point[2]]; }
function relativeDifference(before: Point, after: Point): number {
  const differenceNorm = Math.hypot(...after.map((value, axis) => value - before[axis]));
  const originalNorm = Math.hypot(...before);
  const refinedNorm = Math.hypot(...after);
  const scale = Math.max(1, originalNorm, refinedNorm);
  check(Number.isFinite(differenceNorm) && Number.isFinite(originalNorm) &&
    Number.isFinite(refinedNorm) && Number.isFinite(scale), CODE.REPRESENTABILITY,
  'Native partial comparison norms must remain finite');
  const relative = differenceNorm / scale;
  check(Number.isFinite(relative) && relative <= 1e-7, CODE.BINDING,
    'Actual native relative partial difference exceeds1e-7');
  return relative;
}

/** Refine one native axis through copied private strips and adopt the complete source. */
export function insertSourceSurfaceKnot(input: SourceSurfaceKnotInsertionRequest): SourceSurfaceKnotInsertionResult {
  const data = record(snapshot(input), ['source', 'sourceVersion', 'surfaceId', 'axis', 'knot', 'maximumObservations']);
  check(data.sourceVersion === 0, CODE.VERSION, 'Only explicit literal Source0 is supported');
  check(typeof data.source === 'string', CODE.INPUT, 'The complete original source string is required');
  check(typeof data.surfaceId === 'string' && data.surfaceId.length <= 48 &&
    /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.surfaceId), CODE.IDENTITY,
  'Selected ASCII Surface ID1..48 is required');
  check(data.axis === 'u' || data.axis === 'v', CODE.REQUEST, 'Selected original axis must be u or v');
  check(typeof data.knot === 'number' && Number.isFinite(data.knot), CODE.REQUEST,
    'A finite original-parameter knot is required');
  check(data.maximumObservations === 1024, CODE.BUDGET,
    'The complete fixed observation budget1024 is required');
  const request = data as unknown as SourceSurfaceKnotInsertionRequest;
  const requestSize = fileSize(request);
  const originalSize = sourceSize(request.source);
  const compiledOriginal = compile(request.source, 'original');
  const originalModel = compiledOriginal.model;
  check(originalModel.objects.length <= 16, CODE.BUDGET, 'Complete original Model capacity16 is required');
  const selectedObjectIndex = originalModel.objects.findIndex(object => object.id === request.surfaceId);
  const selected = originalModel.objects[selectedObjectIndex];
  check(selected !== undefined && selected.kind === 'surface', CODE.TARGET,
    'Selected ID must identify an actual original Surface');
  const originalSurface = selected;
  const originalGrid = grid(originalSurface);
  const axis = request.axis, other = axis === 'u' ? 'v' : 'u';
  const degrees = { u: originalSurface.degreeU, v: originalSurface.degreeV };
  const selectedKnots = axis === 'u' ? originalSurface.knotsU : originalSurface.knotsV;
  const otherKnots = axis === 'u' ? originalSurface.knotsV : originalSurface.knotsU;
  check(degrees.u >= 1 && degrees.u <= 5 && degrees.v >= 1 && degrees.v <= 5 &&
    originalGrid[axis] >= degrees[axis] + 1 && originalGrid[axis] <= 15 &&
    originalGrid[other] >= degrees[other] + 1 && originalGrid[other] <= 16 &&
    (originalGrid[axis] + 1) * originalGrid[other] <= 256 &&
    selectedKnots.length <= 21 && otherKnots.length <= 22, CODE.BUDGET,
  'Selected Surface exceeds degree1..5 or one-axis insertion capacity15/16/256/22');
  check(originalSurface.controlPoints.every(row => row.every(point =>
    point.every(value => Math.abs(value) <= 10000))), CODE.BUDGET,
  'Selected original coordinates must remain within10000mm');
  delegated(() => validateSurface(originalSurface), CODE.NATIVE,
    'Actual original Surface validation refused');
  const domain = delegated(() => surfaceDomain(originalSurface), CODE.NATIVE,
    'Actual original Surface domain refused');
  check(request.knot > domain[axis][0] && request.knot < domain[axis][1], CODE.REQUEST,
    'Requested knot must be strictly inside the original selected domain');
  const priorMultiplicity = selectedKnots.filter(knot => knot === request.knot).length;
  check(priorMultiplicity + 1 <= degrees[axis], CODE.REQUEST,
    'Final numeric multiplicity cannot exceed selected degree');
  check(request.knot !== 0 || selectedKnots.every(knot => knot !== 0 || Object.is(knot, request.knot)),
    CODE.REQUEST, 'An existing numeric zero knot must agree with requested zero bits');
  const declarations = compiledOriginal.ast.declarations.filter(value => value.id === request.surfaceId);
  const nodes = compiledOriginal.ir.nodes.filter(value => value.id === request.surfaceId);
  check(declarations.length === 1 && declarations[0].kind === 'surface' &&
    nodes.length === 1 && nodes[0].kind === 'surface' &&
    same(nodes[0].geometry, originalSurface) && same(nodes[0].span, declarations[0].range), CODE.BINDING,
  'A unique actual Surface declaration, IR geometry and Model binding is required');
  const fields: SourceSurfaceKnotInsertionPatch['field'][] = [
    axis === 'u' ? 'knots-u' : 'knots-v', 'control-points', 'weights',
  ];
  const arrays = fields.map(field => selectedArray(declarations[0], field, request.source,
    field === 'control-points' ? originalSurface.controlPoints :
      field === 'weights' ? originalSurface.weights : selectedKnots));

  let coefficientInsertionCallCount = 0;
  const strips: Strip[] = Array.from({ length: originalGrid[other] }, (_, fixedPoleIndex) => {
    // These copied Curves are private coefficient contexts, never authored Model objects.
    const points = axis === 'u' ? originalSurface.controlPoints.map(row => row[fixedPoleIndex]) :
      originalSurface.controlPoints[fixedPoleIndex];
    const weights = axis === 'u' ? originalSurface.weights.map(row => row[fixedPoleIndex]) :
      originalSurface.weights[fixedPoleIndex];
    const originalCurve: Curve = {
      kind: 'curve', id: 'surface_strip_' + fixedPoleIndex, degree: degrees[axis],
      knots: selectedKnots.slice(), controlPoints: points.map(pointCopy), weights: weights.slice(),
    };
    coefficientInsertionCallCount++;
    const calculation = delegated(() => insertCurveKnotCoefficientsTrusted(originalCurve, request.knot, 1),
      CODE.REPRESENTABILITY, 'Actual strip' + fixedPoleIndex + ' homogeneous insertion or native candidate refused');
    return { fixedPoleIndex, originalCurve, calculation };
  });
  const first = strips[0].calculation;
  for (const strip of strips) {
    const current = strip.calculation;
    check(same(current.candidate.knots, first.candidate.knots) &&
      same(current.unchangedPoles, first.unchangedPoles) &&
      same(current.unchangedKnots, first.unchangedKnots) && same(current.steps, first.steps), CODE.BINDING,
    'Actual strip knot bits and common insertion index/alpha maps must agree');
    check(current.candidate.controlPoints.length === originalGrid[axis] + 1 &&
      current.candidate.degree === degrees[axis] && current.candidate.id === strip.originalCurve.id,
    CODE.BINDING, 'Each actual strip candidate must preserve its private identity and degree');
    // Homogeneous data and generated weights intentionally remain separate for every strip.
  }
  const countU = originalGrid.u + (axis === 'u' ? 1 : 0);
  const countV = originalGrid.v + (axis === 'v' ? 1 : 0);
  const candidate: Surface = {
    kind: 'surface', id: originalSurface.id,
    degreeU: originalSurface.degreeU, degreeV: originalSurface.degreeV,
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
    const text = delegated(() => curveDecimal(value, 'Source Surface knot insertion'), CODE.REPRESENTABILITY,
      'Actual replacement decimal emission refused');
    check(text.length <= 512 && Object.is(Number(text), value), CODE.BINDING,
      'Every emitted replacement scalar must round-trip actual bits');
    return text;
  };
  const selectedCandidateKnots = axis === 'u' ? candidate.knotsU : candidate.knotsV;
  const replacements = [
    '[' + selectedCandidateKnots.map(decimal).join(',') + ']',
    '[' + candidate.controlPoints.map(row => '[' + row.map(point =>
      '[' + point.map(decimal).join(',') + ']').join(',') + ']').join(',') + ']',
    '[' + candidate.weights.map(row => '[' + row.map(decimal).join(',') + ']').join(',') + ']',
  ];
  const patches: SourceSurfaceKnotInsertionPatch[] = fields.map((field, index) => ({
    field,
    startUTF16: arrays[index].range.start,
    endUTF16: arrays[index].range.end,
    originalText: request.source.slice(arrays[index].range.start, arrays[index].range.end),
    replacementText: replacements[index],
  }));
  patches.sort((a, b) => a.startUTF16 - b.startUTF16);
  const source = applyPatches(request.source, patches);
  const candidateSize = sourceSize(source);
  const compiledCandidate = compile(source, 'candidate');
  const expectedModel = snapshot(originalModel) as Model;
  expectedModel.objects[selectedObjectIndex] = candidate;
  check(same(compiledCandidate.model, expectedModel), CODE.BINDING,
    'Complete candidate Model changed beyond the actual reconstructed Surface net');
  const model = compiledCandidate.model;
  const surface = model.objects[selectedObjectIndex];
  check(surface !== undefined && surface.kind === 'surface' && same(surface, candidate), CODE.BINDING,
    'Actual compiled selected Surface must equal the complete coefficient candidate');
  delegated(() => validateSurface(surface), CODE.NATIVE, 'Actual accepted Surface validation refused');
  const refinedDomain = delegated(() => surfaceDomain(surface), CODE.NATIVE,
    'Actual accepted Surface domain refused');
  check(same(domain, refinedDomain), CODE.BINDING, 'Both original domain endpoint bits must remain');
  check(same(axis === 'u' ? surface.knotsV : surface.knotsU, otherKnots), CODE.BINDING,
    'The complete unselected knots must retain every original bit');
  const unchangedPoles: UnchangedPole[] = strips.flatMap(strip =>
    strip.calculation.unchangedPoles.map(mapping => axis === 'u' ? {
      originalUIndex: mapping.originalPoleIndex, originalVIndex: strip.fixedPoleIndex,
      refinedUIndex: mapping.refinedPoleIndex, refinedVIndex: strip.fixedPoleIndex,
    } : {
      originalUIndex: strip.fixedPoleIndex, originalVIndex: mapping.originalPoleIndex,
      refinedUIndex: strip.fixedPoleIndex, refinedVIndex: mapping.refinedPoleIndex,
    }));
  for (const mapping of unchangedPoles) {
    check(same(originalSurface.controlPoints[mapping.originalUIndex][mapping.originalVIndex],
      surface.controlPoints[mapping.refinedUIndex][mapping.refinedVIndex]) &&
      Object.is(originalSurface.weights[mapping.originalUIndex][mapping.originalVIndex],
        surface.weights[mapping.refinedUIndex][mapping.refinedVIndex]), CODE.BINDING,
    'Every copied original pole and weight must retain exact bits');
  }
  const refinedKnots = axis === 'u' ? surface.knotsU : surface.knotsV;
  for (const mapping of first.unchangedKnots) {
    check(Object.is(selectedKnots[mapping.originalKnotIndex], refinedKnots[mapping.refinedKnotIndex]),
      CODE.BINDING, 'Every copied selected knot must retain exact original bits');
  }
  const refinedGrid = grid(surface);
  const refinedMultiplicity = refinedKnots.filter(knot => knot === request.knot).length;
  check(refinedMultiplicity === priorMultiplicity + 1 && coefficientInsertionCallCount === strips.length &&
    strips.length === originalGrid[other] && strips.length <= 16 &&
    decimalEmissionCount === 4 * refinedGrid.total + refinedKnots.length, CODE.BINDING,
  'Actual strip, insertion and scalar emission counts disagree');
  const selectedStations = axisStations([selectedKnots, refinedKnots], domain[axis]);
  const otherStations = axisStations([otherKnots], domain[other]);
  const m = selectedStations.length * otherStations.length;
  check(selectedStations.length <= 34 - 2 * degrees[axis] && selectedStations.length <= 32 &&
    otherStations.length <= 33 - 2 * degrees[other] && otherStations.length <= 31 &&
    m <= 992 && m <= request.maximumObservations, CODE.BUDGET,
  'The complete native station grid exceeds the fixed Surface profile');
  const stations = axis === 'u' ? { u: selectedStations, v: otherStations } :
    { u: otherStations, v: selectedStations };
  let surfaceD0Count = 0, surfaceD1AttemptCount = 0;
  let surfaceD1EvaluatedCount = 0, surfaceD1RefusedCount = 0;
  const d0 = (geometry: Surface, u: number, v: number): Point => {
    surfaceD0Count++;
    return delegated(() => evaluateSurface(geometry, u, v), CODE.NATIVE,
      'Actual original or refined Surface D0 refused');
  };
  const d1 = (geometry: Surface, u: number, v: number): D1State => {
    surfaceD1AttemptCount++;
    try {
      const value = evaluateSurfaceD1(geometry, u, v);
      surfaceD1EvaluatedCount++;
      return { status: 'evaluated', value };
    } catch (cause) {
      if (!(cause instanceof Error && /exact C0 interior knot/.test(cause.message))) {
        throw new SourceSurfaceKnotInsertionError(CODE.NATIVE,
          'Only the actual exact-C0 interior-knot Surface D1 refusal is admissible', cause);
      }
      surfaceD1RefusedCount++;
      return { status: 'refused-c0', name: cause.name.slice(0, 1024),
        reason: cause.message.slice(0, 1024), value: null };
    }
  };
  const observations: Observation[] = stations.u.flatMap(u => stations.v.map(v => {
    const originalPointMM = d0(originalSurface, u, v), refinedPointMM = d0(surface, u, v);
    const pointDifferenceMM = Math.hypot(...refinedPointMM.map((value, index) => value - originalPointMM[index]));
    check(Number.isFinite(pointDifferenceMM) && pointDifferenceMM <= 1e-7, CODE.BINDING,
      'Actual native original/refined point difference exceeds1e-7mm');
    const originalD1 = d1(originalSurface, u, v), refinedD1 = d1(surface, u, v);
    let relativeDuDifference: number | null = null, relativeDvDifference: number | null = null;
    if (originalD1.status === 'evaluated' && refinedD1.status === 'evaluated') {
      relativeDuDifference = relativeDifference(originalD1.value.du, refinedD1.value.du);
      relativeDvDifference = relativeDifference(originalD1.value.dv, refinedD1.value.dv);
    }
    return { u, v, originalPointMM, refinedPointMM, pointDifferenceMM, originalD1, refinedD1,
      relativeDuDifference, relativeDvDifference };
  }));
  check(observations.length === m && surfaceD0Count === 2 * m && surfaceD1AttemptCount === 2 * m &&
    surfaceD1EvaluatedCount + surfaceD1RefusedCount === surfaceD1AttemptCount &&
    surfaceD0Count + surfaceD1AttemptCount <= 3968, CODE.BINDING,
  'Every actual native Surface attempt must match the complete station grid');
  const provenance: Provenance = {
    selectedObjectIndex, axis, degrees, domain, knot: request.knot,
    priorMultiplicity, refinedMultiplicity,
    parameterMap: { kind: 'identity', formula: 'u=s;v=t', uD1Factor: 1, vD1Factor: 1 },
    patches, unchangedPoles, unchangedKnots: first.unchangedKnots, strips,
  };
  const report: SourceSurfaceKnotInsertionReport = {
    schema: 'barocss-source-surface-knot-insertion-report', version: 0, sourceVersion: 0,
    lengthUnit: 'mm', modelName: model.name, surfaceId: surface.id, selectedObjectIndex,
    objectCount: model.objects.length, axis, degrees, domain,
    grids: { original: originalGrid, refined: refinedGrid },
    knotCounts: {
      original: { u: originalSurface.knotsU.length, v: originalSurface.knotsV.length },
      refined: { u: surface.knotsU.length, v: surface.knotsV.length },
    },
    knot: request.knot, priorMultiplicity, refinedMultiplicity, stripCount: strips.length, patchCount: 3,
    sourceSizes: { original: originalSize, candidate: candidateSize },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, stations, observations,
    maximumPointDifferenceMM: Math.max(...observations.map(value => value.pointDifferenceMM)),
    maximumRelativeDuDifference: Math.max(0, ...observations.map(value => value.relativeDuDifference ?? 0)),
    maximumRelativeDvDifference: Math.max(0, ...observations.map(value => value.relativeDvDifference ?? 0)),
    directCounts: {
      originalCompileCount: 1, candidateCompileCount: 1, coefficientInsertionCallCount,
      insertedAxisKnotCount: 1, nativeSurfaceValidationCount: 2, domainQueryCount: 2, patchCount: 3,
      decimalEmissionCount, observationCount: observations.length, surfaceD0Count, surfaceD1AttemptCount,
      surfaceD1EvaluatedCount, surfaceD1RefusedCount, curveD0Count: 0, curveD1AttemptCount: 0,
      sourceWriterCallCount: 0, publicRefinementCallCount: 0, rationalOperationCount: 0,
    },
    preservation: {
      untouchedSourceSpans: true, modelHeaderBits: true, objectOrderAndIds: true,
      unselectedObjectBits: true, selectedSurfaceEqualsActualCoefficientCandidate: true,
      unaffectedCoefficientBits: true, degreesDomains: true, nonselectedKnots: true, parameterIdentity: true,
    },
    quality: {
      geometricValidity: 'not-certified', topologyCertified: false, solid: false,
      localShapeObservations: true, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false,
      g1g2Certified: false, manufacturingToleranceCertified: false, editorDisplayCertified: false,
      persistentTopologyBindingCertified: false, publication: false,
      derivativeSemantics: 'actual-native-guards-unchanged', ownership: 'independent-copied-cpu-data-gc',
    },
    limits: {
      maximumDegree: 5, maximumOriginalSelectedPoles: 15, maximumRefinedSelectedPoles: 16,
      maximumOtherPoles: 16, maximumTotalPoles: 256, maximumKnotsPerAxis: 22, maximumInsertions: 1,
      maximumStrips: 16, maximumSelectedStations: 32, maximumOtherStations: 31,
      maximumObservations: 1024, maximumProfileObservations: 992, maximumNativeAttempts: 3968,
      maximumPatches: 3, maximumModelObjects: 16, coordinateAbsMM: 10000,
      minimumWeight: 0.000001, maximumWeight: 1000000, maximumReplacementLiteralCharacters: 512,
      maximumPointDifferenceMM: 1e-7, maximumRelativeDerivativeDifference: 1e-7,
      sourceUTF16: 262144, sourceUTF8: 262144, maximumFileUTF16: 4194304, maximumFileUTF8: 4194304,
      ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64,
      keyCharacters: 128, stringCharacters: 262144, identifierCharacters: 48,
    },
    workScope: 'direct-wrapper-calls-inherited-helper-compiler-work-excluded',
    budgetFailure: 'atomic-no-partial-source-surface-insertion',
  };
  const result: SourceSurfaceKnotInsertionResult = {
    request, source, originalModel, model, originalSurface, surface, provenance, report,
  };
  let stable = false;
  for (let pass = 0; pass < 8; pass++) {
    const measured = fileSize(result);
    if (same(measured, report.fileSizes.result)) { stable = true; break; }
    report.fileSizes.result = measured;
  }
  check(stable, CODE.FILE, 'Complete result size metadata did not settle within8 passes');
  return snapshot(result) as SourceSurfaceKnotInsertionResult;
}

/** Reconstruct complete source, net, private receipts and native observations from the owned request. */
export function validateSourceSurfaceKnotInsertion(input: SourceSurfaceKnotInsertionResult): SourceSurfaceKnotInsertionReport {
  const owned = record(snapshot(input, true), ['request', 'source', 'originalModel', 'model',
    'originalSurface', 'surface', 'provenance', 'report'], CODE.OWNED) as unknown as SourceSurfaceKnotInsertionResult;
  let expected: SourceSurfaceKnotInsertionResult;
  try { expected = insertSourceSurfaceKnot(owned.request); }
  catch (cause) {
    throw new SourceSurfaceKnotInsertionError(CODE.OWNED,
      'Complete owned Source0 Surface knot insertion reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED,
    'Owned source, Models, net, strip receipts, patches, stations, observations, counts or sizes changed');
  return snapshot(expected.report, true) as SourceSurfaceKnotInsertionReport;
}
