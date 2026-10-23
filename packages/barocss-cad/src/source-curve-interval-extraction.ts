import { compileCadModel } from './model-compiler.js';
import type { CadCompileResult } from './model-compiler.js';
import type { CadAstDeclaration, CadAstValue } from './language/source-ast.js';
import { insertCurveKnotCoefficientsTrusted } from './curve-knot-insertion.js';
import type { CurveKnotCoefficientResult } from './curve-knot-insertion.js';
import { curveDecimal } from './curve-source.js';
import { validateCurve, curveDomain, evaluateCurve } from './math.js';
import { evaluateCurveD1 } from './derivatives.js';
import type { CurveD1Result } from './derivatives.js';
import type { Curve, Model, Point } from './types.js';
import { same } from './structural-equality.js';

export const SourceCurveIntervalExtractionDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', SOURCE: 'SOURCE',
  TARGET: 'TARGET', INTERVAL: 'INTERVAL', BUDGET: 'BUDGET',
  REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', NATIVE: 'NATIVE',
  OWNED: 'OWNED', FILE: 'FILE',
} as const);
export type SourceCurveIntervalExtractionDiagnosticCode =
  typeof SourceCurveIntervalExtractionDiagnosticCode[keyof typeof SourceCurveIntervalExtractionDiagnosticCode];
export class SourceCurveIntervalExtractionError extends Error {
  readonly code: SourceCurveIntervalExtractionDiagnosticCode;
  constructor(code: SourceCurveIntervalExtractionDiagnosticCode, detail: string, cause?: unknown) {
    super(('Source Curve interval extraction: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'SourceCurveIntervalExtractionError';
    this.code = code;
  }
}
export interface SourceCurveIntervalExtractionRequest {
  source: string;
  sourceVersion: 0;
  curveId: string;
  interval: [number, number];
  maximumObservations: 256;
}
export interface SourceCurveIntervalExtractionPatch {
  field: 'knots' | 'control-points' | 'weights';
  startUTF16: number;
  endUTF16: number;
  originalText: string;
  replacementText: string;
}
type Size = { utf16: number; utf8: number };
type BoundaryChoice = {
  boundary: 'start' | 'end';
  requested: number;
  effective: number;
  origin: 'original-domain-endpoint' | 'interior-request';
  adoptedOriginalEndpointBits: boolean;
};
type Basis = { degree: number; poleCount: number; knots: number[]; domain: [number, number] };
type CutPlan = {
  index: number;
  boundary: 'start' | 'end';
  parameter: number;
  retainedSide: 'upper' | 'lower';
  input: Basis;
  requiredInsertions: number;
  refined: Basis;
  firstRefinedKnotIndex: number;
  sharedRefinedPoleIndex: number;
  lower: Basis;
  upper: Basis;
};
type CompletePlan = {
  effectiveInterval: [number, number];
  stages: CutPlan[];
  output: Basis;
  helperCallCount: number;
  insertedKnotCount: number;
  maximumTemporaryPoles: number;
  maximumTemporaryKnots: number;
};
type PoleMap = { refinedPoleIndex: number; childPoleIndex: number };
type KnotMap = {
  childKnotIndex: number;
  refinedKnotIndex: number | null;
  value: number;
  origin: 'refined-copy' | 'requested-clamp';
};
type ChildMaps = { poles: PoleMap[]; knots: KnotMap[] };
type Shared = {
  refinedPoleIndex: number;
  lowerPoleIndex: number;
  upperPoleIndex: number;
  pointMM: Point;
  weight: number;
};
type D1State = { status: 'evaluated'; value: CurveD1Result } |
  { status: 'refused-c0'; name: string; reason: string; value: null };
type Provider = { d0: Point; d1: D1State };
type CutWitness = {
  parameter: number;
  input: Provider;
  refined: Provider;
  lower: Provider;
  upper: Provider;
  maximumPointDifferenceMM: number;
  relativeInputLowerDifference: number | null;
  relativeInputUpperDifference: number | null;
  relativeLowerUpperDifference: number;
};
type Refinement = {
  kind: 'knot-insertion' | 'direct-copy';
  insertions: number;
  calculation: CurveKnotCoefficientResult | null;
};
type Stage = {
  index: number;
  boundary: 'start' | 'end';
  parameter: number;
  retainedSide: 'upper' | 'lower';
  input: Curve;
  refined: Curve;
  refinement: Refinement;
  firstRefinedKnotIndex: number;
  lower: Curve;
  upper: Curve;
  lowerMaps: ChildMaps;
  upperMaps: ChildMaps;
  shared: Shared;
  witness: CutWitness;
};
type CopiedPole = { originalPoleIndex: number; outputPoleIndex: number };
type CopiedKnot = { originalKnotIndex: number; outputKnotIndex: number };
type Provenance = {
  selectedObjectIndex: number;
  degree: number;
  boundaries: [BoundaryChoice, BoundaryChoice];
  parameterMap: { kind: 'identity'; formula: 'u=t'; d1Factor: 1 };
  plan: CompletePlan;
  stages: Stage[];
  unchangedPoles: CopiedPole[];
  unchangedKnots: CopiedKnot[];
  patches: SourceCurveIntervalExtractionPatch[];
};
type Observation = {
  parameter: number;
  originalPointMM: Point;
  pointMM: Point;
  pointDifferenceMM: number;
  originalD1: D1State;
  outputD1: D1State;
  relativeDerivativeDifference: number | null;
};
export interface SourceCurveIntervalExtractionReport {
  schema: 'barocss-source-curve-interval-extraction-report';
  version: 0;
  sourceVersion: 0;
  lengthUnit: 'mm';
  modelName: string;
  curveId: string;
  selectedObjectIndex: number;
  objectCount: number;
  degree: number;
  interval: { requested: [number, number]; effective: [number, number] };
  domains: { original: [number, number]; output: [number, number] };
  poleCounts: { original: number; output: number; maximumTemporary: number };
  knotCounts: { original: number; output: number; maximumTemporary: number };
  cutStageCount: number;
  coefficientInsertionCallCount: number;
  insertedKnotCount: number;
  patchCount: 3;
  sourceSizes: { original: Size; candidate: Size };
  fileSizes: { request: Size; result: Size };
  stations: number[];
  observations: Observation[];
  maximumPointDifferenceMM: number;
  maximumRelativeDerivativeDifference: number;
  maximumCutPointDifferenceMM: number;
  directCounts: {
    originalCompileCount: 1; candidateCompileCount: 1;
    cutStageCount: number; coefficientInsertionCallCount: number; insertedKnotCount: number;
    nativeCurveValidationCount: number; domainQueryCount: number; patchCount: 3;
    decimalEmissionCount: number; observationCount: number; cutWitnessCount: number;
    curveD0Count: number; curveD1AttemptCount: number;
    curveD1EvaluatedCount: number; curveD1RefusedCount: number;
    sourceWriterCallCount: 0; publicSplitCallCount: 0; publicIntervalCallCount: 0;
    publicRefinementCallCount: 0; rationalOperationCount: 0;
  };
  preservation: {
    untouchedSourceSpans: true; modelHeaderBits: true; objectOrderAndIds: true;
    unselectedObjectBits: true; selectedCurveEqualsActualRetainedCandidate: true;
    unaffectedCoefficientBits: true; degree: true; originalParameterUnits: true;
    effectiveEndpointBits: true; parameterIdentity: true;
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
    maximumDegree: 5; maximumOriginalPoles: 64; maximumTemporaryPoles: 64;
    maximumOutputPoles: 64; maximumKnots: 70; maximumCuts: 2;
    maximumInsertionsPerCut: 5; maximumTotalInsertions: 10; maximumHelperCalls: 2;
    maximumObservations: 256; maximumProfileObservations: 129; maximumCutWitnesses: 2;
    maximumNativeAttempts: 532; maximumPatches: 3; maximumModelObjects: 16;
    coordinateAbsMM: 10000; minimumWeight: 0.000001; maximumWeight: 1000000;
    maximumReplacementLiteralCharacters: 512; maximumPointDifferenceMM: 1e-7;
    maximumRelativeDerivativeDifference: 1e-7; sourceUTF16: 262144; sourceUTF8: 262144;
    maximumFileUTF16: 2097152; maximumFileUTF8: 2097152;
    ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64;
    keyCharacters: 128; stringCharacters: 262144; identifierCharacters: 48;
  };
  workScope: 'direct-wrapper-calls-inherited-helper-compiler-work-excluded';
  budgetFailure: 'atomic-no-partial-source-curve-interval';
}
export interface SourceCurveIntervalExtractionResult {
  request: SourceCurveIntervalExtractionRequest;
  source: string;
  originalModel: Model;
  model: Model;
  originalCurve: Curve;
  curve: Curve;
  provenance: Provenance;
  report: SourceCurveIntervalExtractionReport;
}

const CODE = SourceCurveIntervalExtractionDiagnosticCode;
function check(condition: boolean, code: SourceCurveIntervalExtractionDiagnosticCode,
  detail: string): asserts condition {
  if (!condition) throw new SourceCurveIntervalExtractionError(code, detail);
}
function delegated<T>(action: () => T, code: SourceCurveIntervalExtractionDiagnosticCode,
  detail: string): T {
  try { return action(); }
  catch (cause) { throw new SourceCurveIntervalExtractionError(code, detail, cause); }
}
function record(input: unknown, fields: string[],
  code: SourceCurveIntervalExtractionDiagnosticCode = CODE.INPUT): Record<string, unknown> {
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
  if (!result.ok) throw new SourceCurveIntervalExtractionError(CODE.SOURCE,
    'Actual ' + stage + ' complete Source0 compilation refused', result);
  return result;
}
function selectedArray(declaration: CadAstDeclaration,
  field: SourceCurveIntervalExtractionPatch['field'], source: string,
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
function applyPatches(source: string, patches: SourceCurveIntervalExtractionPatch[]): string {
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

function makeBasis(degree: number, poleCount: number, knots: number[]): Basis {
  const data: Basis = {
    degree, poleCount, knots: knots.slice(), domain: [knots[degree], knots[poleCount]],
  };
  check(Number.isInteger(degree) && degree >= 1 && degree <= 5 &&
    Number.isInteger(poleCount) && poleCount >= degree + 1 && poleCount <= 64 &&
    knots.length === poleCount + degree + 1 && knots.length <= 70, CODE.BUDGET,
  'Every planned basis must fit native degree/count/knot capacity');
  check(knots.every((value, index) => Number.isFinite(value) &&
    (index === 0 || value >= knots[index - 1])) && data.domain[0] < data.domain[1],
  CODE.BINDING, 'Planned native knots must be finite, ordered and nonempty');
  for (let index = 0; index <= degree; index++) {
    check(knots[index] === data.domain[0] && knots[poleCount + index] === data.domain[1],
      CODE.BINDING, 'Planned native basis must be open and clamped');
  }
  let repeated = 0, previous = data.domain[0];
  for (let index = degree + 1; index < poleCount; index++) {
    const value = knots[index];
    check(value > data.domain[0] && value < data.domain[1], CODE.BINDING,
      'Planned endpoint multiplicity must equal degree+1');
    repeated = value === previous ? repeated + 1 : 1;
    check(repeated <= degree, CODE.BINDING, 'Planned interior multiplicity exceeds degree');
    previous = value;
  }
  return data;
}
function basisOfCurve(curve: Curve): Basis {
  return makeBasis(curve.degree, curve.controlPoints.length, curve.knots);
}
/** Pure metadata preflight: no Curve placeholder, native call or coefficient arithmetic. */
function planInterval(original: Basis, boundaries: [BoundaryChoice, BoundaryChoice]): CompletePlan {
  const stages: CutPlan[] = [];
  let current = makeBasis(original.degree, original.poleCount, original.knots);
  let helperCallCount = 0, insertedKnotCount = 0;
  let maximumTemporaryPoles = current.poleCount, maximumTemporaryKnots = current.knots.length;
  for (const boundary of boundaries) {
    if (boundary.adoptedOriginalEndpointBits) continue;
    const parameter = boundary.effective;
    check(parameter > current.domain[0] && parameter < current.domain[1], CODE.INTERVAL,
      'Every planned cut must be strictly inside its current original-unit basis');
    check(parameter !== 0 || current.knots.every(knot => knot !== 0 || Object.is(knot, parameter)),
      CODE.INTERVAL, 'Existing interior zero slots must agree with requested cut bits');
    const multiplicity = current.knots.filter(knot => knot === parameter).length;
    const requiredInsertions = current.degree - multiplicity;
    check(requiredInsertions >= 0 && requiredInsertions <= 5, CODE.INTERVAL,
      'Planned cut multiplicity cannot exceed degree');
    check(current.poleCount + requiredInsertions <= 64 &&
      current.knots.length + requiredInsertions <= 70, CODE.BUDGET,
    'Complete temporary refinement exceeds native64 poles or70 knots');
    let knots = current.knots.slice(), poleCount = current.poleCount;
    for (let insertion = 0; insertion < requiredInsertions; insertion++) {
      let span = -1;
      for (let index = current.degree; index < poleCount; index++) {
        if (knots[index] <= parameter && parameter < knots[index + 1]) span = index;
      }
      check(span >= current.degree, CODE.BINDING, 'Actual planned knot span is required');
      knots = [...knots.slice(0, span + 1), parameter, ...knots.slice(span + 1)];
      poleCount++;
    }
    const refined = makeBasis(current.degree, poleCount, knots);
    const firstRefinedKnotIndex = knots.findIndex(knot => knot === parameter);
    const sharedRefinedPoleIndex = firstRefinedKnotIndex - 1;
    check(firstRefinedKnotIndex >= current.degree + 1 &&
      knots.filter(knot => knot === parameter).length === current.degree, CODE.BINDING,
    'Planned cut must reach actual degree multiplicity');
    const lower = makeBasis(current.degree, sharedRefinedPoleIndex + 1,
      [...knots.slice(0, firstRefinedKnotIndex + current.degree), parameter]);
    const upper = makeBasis(current.degree, poleCount - sharedRefinedPoleIndex,
      [parameter, ...knots.slice(firstRefinedKnotIndex)]);
    check(Object.is(lower.domain[0], current.domain[0]) && Object.is(lower.domain[1], parameter) &&
      Object.is(upper.domain[0], parameter) && Object.is(upper.domain[1], current.domain[1]), CODE.BINDING,
    'Planned children must preserve outer endpoints and exact requested clamp bits');
    const retainedSide = boundary.boundary === 'start' ? 'upper' : 'lower';
    stages.push({ index: stages.length, boundary: boundary.boundary, parameter, retainedSide,
      input: current, requiredInsertions, refined, firstRefinedKnotIndex,
      sharedRefinedPoleIndex, lower, upper });
    helperCallCount += requiredInsertions > 0 ? 1 : 0;
    insertedKnotCount += requiredInsertions;
    maximumTemporaryPoles = Math.max(maximumTemporaryPoles, refined.poleCount);
    maximumTemporaryKnots = Math.max(maximumTemporaryKnots, refined.knots.length);
    current = retainedSide === 'upper' ? upper : lower;
  }
  const effectiveInterval: [number, number] = [boundaries[0].effective, boundaries[1].effective];
  check(stages.length >= 1 && stages.length <= 2 && helperCallCount <= 2 && insertedKnotCount <= 10 &&
    same(current.domain, effectiveInterval), CODE.BINDING, 'Complete two-boundary plan is inconsistent');
  return { effectiveInterval, stages, output: current, helperCallCount, insertedKnotCount,
    maximumTemporaryPoles, maximumTemporaryKnots };
}
function intervalStations(original: Basis, plan: CompletePlan): number[] {
  const [start, end] = plan.effectiveInterval;
  const stations = [start, end];
  const add = (value: number): void => {
    if (value >= start && value <= end && !stations.some(prior => prior === value)) stations.push(value);
  };
  const bases = [original];
  for (const stage of plan.stages) bases.push(stage.refined, stage[stage.retainedSide]);
  bases.push(plan.output);
  for (const basis of bases) {
    const breaks = [basis.domain[0]];
    for (const knot of basis.knots) {
      if (knot > basis.domain[0] && knot < basis.domain[1] && !breaks.some(prior => prior === knot)) {
        breaks.push(knot);
      }
    }
    breaks.push(basis.domain[1]);
    for (let index = 0; index < breaks.length; index++) {
      add(breaks[index]);
      if (index + 1 === breaks.length || breaks[index] >= end || breaks[index + 1] <= start) continue;
      const width = breaks[index + 1] - breaks[index];
      const midpoint = breaks[index] + width / 2;
      check(Number.isFinite(width) && width > 0 && Number.isFinite(midpoint) &&
        midpoint > breaks[index] && midpoint < breaks[index + 1], CODE.REPRESENTABILITY,
      'Eligible native spans require finite strictly represented midpoints');
      add(midpoint);
    }
  }
  stations.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  check(stations.length <= 129 && Object.is(stations[0], start) &&
    Object.is(stations[stations.length - 1], end), CODE.BUDGET,
  'Complete first-bit interval stations exceed129 or change effective endpoints');
  return stations;
}
function pointCopy(point: Point): Point { return [point[0], point[1], point[2]]; }
function relativeDifference(before: Point, after: Point, gated = true): number {
  const differenceNorm = Math.hypot(...after.map((value, axis) => value - before[axis]));
  const originalNorm = Math.hypot(...before), refinedNorm = Math.hypot(...after);
  const scale = Math.max(1, originalNorm, refinedNorm);
  check(Number.isFinite(differenceNorm) && Number.isFinite(originalNorm) &&
    Number.isFinite(refinedNorm) && Number.isFinite(scale), CODE.REPRESENTABILITY,
  'Native derivative comparison norms must remain finite');
  const relative = differenceNorm / scale;
  check(Number.isFinite(relative) && (!gated || relative <= 1e-7), CODE.BINDING,
    'Actual native relative derivative comparison exceeds its local bound');
  return relative;
}
function pointDifference(before: Point, after: Point): number {
  const gap = Math.hypot(...after.map((value, axis) => value - before[axis]));
  check(Number.isFinite(gap) && gap <= 1e-7, CODE.BINDING,
    'Actual native point difference exceeds1e-7mm');
  return gap;
}
function makeChild(refined: Curve, cut: CutPlan, side: 'lower' | 'upper', id: string):
  { curve: Curve; maps: ChildMaps } {
  const first = cut.firstRefinedKnotIndex, common = cut.sharedRefinedPoleIndex;
  const offset = side === 'lower' ? 0 : common;
  const count = side === 'lower' ? common + 1 : refined.controlPoints.length - common;
  const poles: PoleMap[] = Array.from({ length: count }, (_, childPoleIndex) =>
    ({ refinedPoleIndex: offset + childPoleIndex, childPoleIndex }));
  const knots: KnotMap[] = side === 'lower' ? [
    ...refined.knots.slice(0, first + refined.degree).map((value, childKnotIndex): KnotMap =>
      ({ childKnotIndex, refinedKnotIndex: childKnotIndex, value, origin: 'refined-copy' })),
    { childKnotIndex: first + refined.degree, refinedKnotIndex: null,
      value: cut.parameter, origin: 'requested-clamp' },
  ] : [
    { childKnotIndex: 0, refinedKnotIndex: null, value: cut.parameter, origin: 'requested-clamp' },
    ...refined.knots.slice(first).map((value, index): KnotMap =>
      ({ childKnotIndex: index + 1, refinedKnotIndex: first + index, value, origin: 'refined-copy' })),
  ];
  const curve: Curve = { kind: 'curve', id, degree: refined.degree, knots: knots.map(slot => slot.value),
    controlPoints: poles.map(mapping => pointCopy(refined.controlPoints[mapping.refinedPoleIndex])),
    weights: poles.map(mapping => refined.weights[mapping.refinedPoleIndex]) };
  check(same(basisOfCurve(curve), cut[side]), CODE.BINDING,
    'Actual indexed child basis disagrees with its complete preflight');
  for (const mapping of poles) {
    check(same(curve.controlPoints[mapping.childPoleIndex], refined.controlPoints[mapping.refinedPoleIndex]) &&
      Object.is(curve.weights[mapping.childPoleIndex], refined.weights[mapping.refinedPoleIndex]), CODE.BINDING,
    'Actual child pole and weight copying changed bits');
  }
  for (const mapping of knots) {
    check(Object.is(curve.knots[mapping.childKnotIndex], mapping.refinedKnotIndex === null ?
      cut.parameter : refined.knots[mapping.refinedKnotIndex]), CODE.BINDING,
    'Actual child knot copying or requested clamp bits changed');
  }
  return { curve, maps: { poles, knots } };
}

/** Restrict a selected Curve through actual refinements and indexed children in full Source0. */
export function extractSourceCurveInterval(input: SourceCurveIntervalExtractionRequest): SourceCurveIntervalExtractionResult {
  const data = record(snapshot(input), ['source', 'sourceVersion', 'curveId', 'interval', 'maximumObservations']);
  check(data.sourceVersion === 0, CODE.VERSION, 'Only explicit literal Source0 is supported');
  check(typeof data.source === 'string', CODE.INPUT, 'Complete original source is required');
  check(typeof data.curveId === 'string' && data.curveId.length <= 48 &&
    /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.curveId), CODE.IDENTITY, 'Selected ASCII Curve ID1..48 is required');
  check(Array.isArray(data.interval) && data.interval.length === 2 &&
    data.interval.every(value => typeof value === 'number' && Number.isFinite(value)), CODE.INTERVAL,
  'Two finite original-parameter interval endpoints are required');
  check(data.maximumObservations === 256, CODE.BUDGET, 'Fixed complete observation budget256 is required');
  const request = data as unknown as SourceCurveIntervalExtractionRequest;
  const requestSize = fileSize(request), originalSize = sourceSize(request.source);
  const compiledOriginal = compile(request.source, 'original');
  const originalModel = compiledOriginal.model;
  check(originalModel.objects.length <= 16, CODE.BUDGET, 'Complete Model capacity16 is required');
  const selectedObjectIndex = originalModel.objects.findIndex(object => object.id === request.curveId);
  const selected = originalModel.objects[selectedObjectIndex];
  check(selected !== undefined && selected.kind === 'curve', CODE.TARGET,
    'Selected ID must identify an actual original Curve');
  const originalCurve = selected;
  check(originalCurve.degree >= 1 && originalCurve.degree <= 5 &&
    originalCurve.controlPoints.length >= originalCurve.degree + 1 &&
    originalCurve.controlPoints.length <= 64 && originalCurve.knots.length <= 70 &&
    originalCurve.controlPoints.every(point => point.every(value => Math.abs(value) <= 10000)), CODE.BUDGET,
  'Selected original Curve exceeds degree1..5/64/70 or10000mm profile');
  let nativeCurveValidationCount = 0, domainQueryCount = 0;
  const validateAndDomain = (curve: Curve): [number, number] => {
    nativeCurveValidationCount++;
    delegated(() => validateCurve(curve), CODE.NATIVE, 'Actual native Curve validation refused');
    domainQueryCount++;
    return delegated(() => curveDomain(curve), CODE.NATIVE, 'Actual native Curve domain query refused');
  };
  const originalDomain = validateAndDomain(originalCurve);
  const [start, end] = request.interval;
  check(start < end && start >= originalDomain[0] && end <= originalDomain[1] &&
    (start > originalDomain[0] || end < originalDomain[1]), CODE.INTERVAL,
  'A proper nonempty ordered subset of the original closed domain is required');
  const boundaries = request.interval.map((requested, index): BoundaryChoice => {
    const adoptedOriginalEndpointBits = requested === originalDomain[index];
    return { boundary: index === 0 ? 'start' : 'end', requested,
      effective: adoptedOriginalEndpointBits ? originalDomain[index] : requested,
      origin: adoptedOriginalEndpointBits ? 'original-domain-endpoint' : 'interior-request',
      adoptedOriginalEndpointBits };
  }) as [BoundaryChoice, BoundaryChoice];
  const declarations = compiledOriginal.ast.declarations.filter(value => value.id === request.curveId);
  const nodes = compiledOriginal.ir.nodes.filter(value => value.id === request.curveId);
  check(declarations.length === 1 && declarations[0].kind === 'curve' &&
    nodes.length === 1 && nodes[0].kind === 'curve' && same(nodes[0].geometry, originalCurve) &&
    same(nodes[0].span, declarations[0].range), CODE.BINDING,
  'A unique actual Curve AST/IR/full Model binding is required');
  const fields: SourceCurveIntervalExtractionPatch['field'][] = ['knots', 'control-points', 'weights'];
  const arrays = fields.map(field => selectedArray(declarations[0], field, request.source,
    field === 'knots' ? originalCurve.knots : field === 'weights' ? originalCurve.weights : originalCurve.controlPoints));
  const originalBasis = basisOfCurve(originalCurve);
  check(same(originalBasis.domain, originalDomain), CODE.BINDING, 'Original basis must bind actual domain bits');
  // Complete both cut capacities and all ordinary stations before the first coefficient call.
  const plan = planInterval(originalBasis, boundaries);
  const stations = intervalStations(originalBasis, plan);
  check(stations.length <= request.maximumObservations, CODE.BUDGET, 'Ordinary station budget exceeded');

  let curveD0Count = 0, curveD1AttemptCount = 0;
  let curveD1EvaluatedCount = 0, curveD1RefusedCount = 0;
  const d0 = (curve: Curve, parameter: number): Point => {
    curveD0Count++;
    return delegated(() => evaluateCurve(curve, parameter), CODE.NATIVE, 'Actual native Curve D0 refused');
  };
  const d1 = (curve: Curve, parameter: number, requiredEndpoint = false): D1State => {
    curveD1AttemptCount++;
    try {
      const value = evaluateCurveD1(curve, parameter);
      curveD1EvaluatedCount++;
      return { status: 'evaluated', value };
    } catch (cause) {
      if (requiredEndpoint || !(cause instanceof Error && /exact C0 interior knot/.test(cause.message))) {
        throw new SourceCurveIntervalExtractionError(CODE.NATIVE,
          'Actual native D1 refused beyond an admissible interior C0 state', cause);
      }
      curveD1RefusedCount++;
      return { status: 'refused-c0', name: cause.name.slice(0, 1024),
        reason: cause.message.slice(0, 1024), value: null };
    }
  };
  const cutWitness = (current: Curve, refined: Curve, lower: Curve, upper: Curve,
    parameter: number): CutWitness => {
    const inputValue = { d0: d0(current, parameter), d1: d1(current, parameter) };
    const refinedValue = { d0: d0(refined, parameter), d1: d1(refined, parameter) };
    const lowerValue = { d0: d0(lower, parameter), d1: d1(lower, parameter, true) };
    const upperValue = { d0: d0(upper, parameter), d1: d1(upper, parameter, true) };
    check(refinedValue.d1.status === 'refused-c0' && lowerValue.d1.status === 'evaluated' &&
      upperValue.d1.status === 'evaluated', CODE.BINDING,
    'Actual refined interior C0 and clamped child endpoint states must remain distinct');
    const points = [inputValue.d0, refinedValue.d0, lowerValue.d0, upperValue.d0];
    let maximumPointDifferenceMM = 0;
    for (let left = 0; left < points.length; left++) {
      for (let right = left + 1; right < points.length; right++) {
        maximumPointDifferenceMM = Math.max(maximumPointDifferenceMM, pointDifference(points[left], points[right]));
      }
    }
    let relativeInputLowerDifference: number | null = null;
    let relativeInputUpperDifference: number | null = null;
    if (inputValue.d1.status === 'evaluated') {
      relativeInputLowerDifference = relativeDifference(inputValue.d1.value.derivative, lowerValue.d1.value.derivative);
      relativeInputUpperDifference = relativeDifference(inputValue.d1.value.derivative, upperValue.d1.value.derivative);
    }
    const relativeLowerUpperDifference = relativeDifference(lowerValue.d1.value.derivative,
      upperValue.d1.value.derivative, inputValue.d1.status === 'evaluated');
    return { parameter, input: inputValue, refined: refinedValue, lower: lowerValue, upper: upperValue,
      maximumPointDifferenceMM, relativeInputLowerDifference, relativeInputUpperDifference,
      relativeLowerUpperDifference };
  };
  const stages: Stage[] = [];
  let current = snapshot(originalCurve) as Curve;
  let coefficientInsertionCallCount = 0, insertedKnotCount = 0;
  let unchangedPoles: CopiedPole[] = originalCurve.controlPoints.map((_, index) =>
    ({ originalPoleIndex: index, outputPoleIndex: index }));
  let unchangedKnots: CopiedKnot[] = originalCurve.knots.map((_, index) =>
    ({ originalKnotIndex: index, outputKnotIndex: index }));
  for (const cut of plan.stages) {
    check(same(basisOfCurve(current), cut.input) && current.id === originalCurve.id, CODE.BINDING,
      'Actual retained stage input must match complete preflight and selected identity');
    const stageInput = snapshot(current) as Curve;
    let calculation: CurveKnotCoefficientResult | null = null;
    if (cut.requiredInsertions > 0) {
      coefficientInsertionCallCount++;
      insertedKnotCount += cut.requiredInsertions;
      calculation = delegated(() => insertCurveKnotCoefficientsTrusted(stageInput,
        cut.parameter, cut.requiredInsertions), CODE.REPRESENTABILITY,
      'Actual r-fold native homogeneous refinement refused');
    }
    const refined = calculation === null ? snapshot(stageInput) as Curve : calculation.candidate;
    check(same(basisOfCurve(refined), cut.refined) && refined.id === stageInput.id, CODE.BINDING,
      'Actual refined Curve must match the full count/basis preflight');
    check(same(validateAndDomain(refined), cut.refined.domain), CODE.BINDING,
      'Actual refined native domain changed');
    const lowerId = cut.retainedSide === 'lower' ? originalCurve.id : 'interval_discard_start';
    const upperId = cut.retainedSide === 'upper' ? originalCurve.id : 'interval_discard_end';
    const lowerData = makeChild(refined, cut, 'lower', lowerId);
    const upperData = makeChild(refined, cut, 'upper', upperId);
    const lower = lowerData.curve, upper = upperData.curve;
    check(same(validateAndDomain(lower), cut.lower.domain) && same(validateAndDomain(upper), cut.upper.domain),
      CODE.BINDING, 'Actual native child domains must match original-unit cut planning');
    const common = cut.sharedRefinedPoleIndex;
    const shared: Shared = { refinedPoleIndex: common, lowerPoleIndex: common, upperPoleIndex: 0,
      pointMM: pointCopy(refined.controlPoints[common]), weight: refined.weights[common] };
    check(same(lower.controlPoints[common], upper.controlPoints[0]) &&
      Object.is(lower.weights[common], upper.weights[0]), CODE.BINDING,
    'Both child endpoint stored coefficients must share exact copied bits');
    const witness = cutWitness(stageInput, refined, lower, upper, cut.parameter);
    const retainedMaps = cut.retainedSide === 'lower' ? lowerData.maps : upperData.maps;
    const copiedPoles = calculation?.unchangedPoles ?? stageInput.controlPoints.map((_, index) =>
      ({ originalPoleIndex: index, refinedPoleIndex: index }));
    const copiedKnots = calculation?.unchangedKnots ?? stageInput.knots.map((_, index) =>
      ({ originalKnotIndex: index, refinedKnotIndex: index }));
    unchangedPoles = unchangedPoles.flatMap(prior => {
      const refinedMapping = copiedPoles.find(mapping => mapping.originalPoleIndex === prior.outputPoleIndex);
      const retainedMapping = refinedMapping && retainedMaps.poles.find(mapping =>
        mapping.refinedPoleIndex === refinedMapping.refinedPoleIndex);
      return retainedMapping ? [{ originalPoleIndex: prior.originalPoleIndex,
        outputPoleIndex: retainedMapping.childPoleIndex }] : [];
    });
    unchangedKnots = unchangedKnots.flatMap(prior => {
      const refinedMapping = copiedKnots.find(mapping => mapping.originalKnotIndex === prior.outputKnotIndex);
      const retainedMapping = refinedMapping && retainedMaps.knots.find(mapping =>
        mapping.refinedKnotIndex === refinedMapping.refinedKnotIndex);
      return retainedMapping ? [{ originalKnotIndex: prior.originalKnotIndex,
        outputKnotIndex: retainedMapping.childKnotIndex }] : [];
    });
    stages.push({ index: cut.index, boundary: cut.boundary, parameter: cut.parameter,
      retainedSide: cut.retainedSide, input: stageInput, refined,
      refinement: { kind: calculation === null ? 'direct-copy' : 'knot-insertion',
        insertions: cut.requiredInsertions, calculation },
      firstRefinedKnotIndex: cut.firstRefinedKnotIndex, lower, upper,
      lowerMaps: lowerData.maps, upperMaps: upperData.maps, shared, witness });
    current = cut.retainedSide === 'lower' ? lower : upper;
  }
  check(same(basisOfCurve(current), plan.output) && current.id === originalCurve.id &&
    coefficientInsertionCallCount === plan.helperCallCount && insertedKnotCount === plan.insertedKnotCount,
  CODE.BINDING, 'Actual final retained Curve and helper counts disagree with preflight');
  const actualPlan: CompletePlan = { ...plan, stages: stages.map(stage => ({
    index: stage.index, boundary: stage.boundary, parameter: stage.parameter, retainedSide: stage.retainedSide,
    input: basisOfCurve(stage.input), requiredInsertions: stage.refinement.insertions,
    refined: basisOfCurve(stage.refined), firstRefinedKnotIndex: stage.firstRefinedKnotIndex,
    sharedRefinedPoleIndex: stage.shared.refinedPoleIndex,
    lower: basisOfCurve(stage.lower), upper: basisOfCurve(stage.upper),
  })), output: basisOfCurve(current) };
  check(same(actualPlan, plan) && same(intervalStations(originalBasis, actualPlan), stations), CODE.BINDING,
    'Actual support bases and ordinary stations must match the precomputed metadata');
  let decimalEmissionCount = 0;
  const decimal = (value: number): string => {
    decimalEmissionCount++;
    const text = delegated(() => curveDecimal(value, 'Source Curve interval extraction'), CODE.REPRESENTABILITY,
      'Actual final-array decimal emission refused');
    check(text.length <= 512 && Object.is(Number(text), value), CODE.BINDING,
      'Every final replacement scalar must round-trip its actual bits');
    return text;
  };
  const replacements = [
    '[' + current.knots.map(decimal).join(',') + ']',
    '[' + current.controlPoints.map(point => '[' + point.map(decimal).join(',') + ']').join(',') + ']',
    '[' + current.weights.map(decimal).join(',') + ']',
  ];
  const patches: SourceCurveIntervalExtractionPatch[] = fields.map((field, index) => ({
    field, startUTF16: arrays[index].range.start, endUTF16: arrays[index].range.end,
    originalText: request.source.slice(arrays[index].range.start, arrays[index].range.end),
    replacementText: replacements[index],
  }));
  patches.sort((a, b) => a.startUTF16 - b.startUTF16);
  const source = applyPatches(request.source, patches);
  const candidateSize = sourceSize(source);
  const compiledCandidate = compile(source, 'candidate');
  const expectedModel = snapshot(originalModel) as Model;
  expectedModel.objects[selectedObjectIndex] = current;
  check(same(compiledCandidate.model, expectedModel), CODE.BINDING,
    'Complete candidate Model changed beyond the actual retained selected Curve');
  const model = compiledCandidate.model;
  const curve = model.objects[selectedObjectIndex];
  check(curve !== undefined && curve.kind === 'curve' && same(curve, current), CODE.BINDING,
    'Actual compiled selected Curve must equal the complete retained candidate');
  const outputDomain = validateAndDomain(curve);
  check(same(outputDomain, plan.effectiveInterval) && curve.id === originalCurve.id &&
    curve.degree === originalCurve.degree, CODE.BINDING,
  'Final selected identity, degree and effective original-unit endpoint bits must remain');
  for (const mapping of unchangedPoles) {
    check(same(originalCurve.controlPoints[mapping.originalPoleIndex], curve.controlPoints[mapping.outputPoleIndex]) &&
      Object.is(originalCurve.weights[mapping.originalPoleIndex], curve.weights[mapping.outputPoleIndex]), CODE.BINDING,
    'Every composed unchanged original pole and weight must retain exact bits');
  }
  for (const mapping of unchangedKnots) {
    check(Object.is(originalCurve.knots[mapping.originalKnotIndex], curve.knots[mapping.outputKnotIndex]), CODE.BINDING,
      'Every composed unchanged original knot must retain exact bits');
  }
  const observations: Observation[] = stations.map(parameter => {
    const originalPointMM = d0(originalCurve, parameter), pointMM = d0(curve, parameter);
    const pointDifferenceMM = pointDifference(originalPointMM, pointMM);
    const originalD1 = d1(originalCurve, parameter), outputD1 = d1(curve, parameter);
    const relativeDerivativeDifference = originalD1.status === 'evaluated' && outputD1.status === 'evaluated' ?
      relativeDifference(originalD1.value.derivative, outputD1.value.derivative) : null;
    return { parameter, originalPointMM, pointMM, pointDifferenceMM, originalD1, outputD1,
      relativeDerivativeDifference };
  });
  const c = stages.length, m = observations.length;
  check(c === plan.stages.length && nativeCurveValidationCount === 2 + 3 * c &&
    domainQueryCount === 2 + 3 * c && curveD0Count === 2 * m + 4 * c &&
    curveD1AttemptCount === 2 * m + 4 * c &&
    curveD1EvaluatedCount + curveD1RefusedCount === curveD1AttemptCount &&
    curveD0Count + curveD1AttemptCount <= 532 &&
    decimalEmissionCount === 4 * curve.controlPoints.length + curve.knots.length, CODE.BINDING,
  'Actual direct validation, domain, native witness or scalar emission counts disagree');
  const provenance: Provenance = {
    selectedObjectIndex, degree: originalCurve.degree, boundaries,
    parameterMap: { kind: 'identity', formula: 'u=t', d1Factor: 1 }, plan, stages,
    unchangedPoles, unchangedKnots, patches,
  };
  const report: SourceCurveIntervalExtractionReport = {
    schema: 'barocss-source-curve-interval-extraction-report', version: 0, sourceVersion: 0,
    lengthUnit: 'mm', modelName: model.name, curveId: curve.id, selectedObjectIndex,
    objectCount: model.objects.length, degree: curve.degree,
    interval: { requested: request.interval, effective: plan.effectiveInterval },
    domains: { original: originalDomain, output: outputDomain },
    poleCounts: { original: originalCurve.controlPoints.length, output: curve.controlPoints.length,
      maximumTemporary: plan.maximumTemporaryPoles },
    knotCounts: { original: originalCurve.knots.length, output: curve.knots.length,
      maximumTemporary: plan.maximumTemporaryKnots },
    cutStageCount: c, coefficientInsertionCallCount, insertedKnotCount, patchCount: 3,
    sourceSizes: { original: originalSize, candidate: candidateSize },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, stations, observations,
    maximumPointDifferenceMM: Math.max(...observations.map(value => value.pointDifferenceMM)),
    maximumRelativeDerivativeDifference: Math.max(0, ...observations.map(value => value.relativeDerivativeDifference ?? 0)),
    maximumCutPointDifferenceMM: Math.max(...stages.map(stage => stage.witness.maximumPointDifferenceMM)),
    directCounts: {
      originalCompileCount: 1, candidateCompileCount: 1, cutStageCount: c,
      coefficientInsertionCallCount, insertedKnotCount, nativeCurveValidationCount, domainQueryCount,
      patchCount: 3, decimalEmissionCount, observationCount: m, cutWitnessCount: c,
      curveD0Count, curveD1AttemptCount, curveD1EvaluatedCount, curveD1RefusedCount,
      sourceWriterCallCount: 0, publicSplitCallCount: 0, publicIntervalCallCount: 0,
      publicRefinementCallCount: 0, rationalOperationCount: 0,
    },
    preservation: {
      untouchedSourceSpans: true, modelHeaderBits: true, objectOrderAndIds: true,
      unselectedObjectBits: true, selectedCurveEqualsActualRetainedCandidate: true,
      unaffectedCoefficientBits: true, degree: true, originalParameterUnits: true,
      effectiveEndpointBits: true, parameterIdentity: true,
    },
    quality: {
      geometricValidity: 'not-certified', topologyCertified: false, solid: false,
      localShapeObservations: true, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false,
      g1g2Certified: false, manufacturingToleranceCertified: false, editorDisplayCertified: false,
      persistentTopologyBindingCertified: false, publication: false,
      derivativeSemantics: 'actual-native-guards-unchanged', ownership: 'independent-copied-cpu-data-gc',
    },
    limits: {
      maximumDegree: 5, maximumOriginalPoles: 64, maximumTemporaryPoles: 64, maximumOutputPoles: 64,
      maximumKnots: 70, maximumCuts: 2, maximumInsertionsPerCut: 5, maximumTotalInsertions: 10,
      maximumHelperCalls: 2, maximumObservations: 256, maximumProfileObservations: 129,
      maximumCutWitnesses: 2, maximumNativeAttempts: 532, maximumPatches: 3, maximumModelObjects: 16,
      coordinateAbsMM: 10000, minimumWeight: 0.000001, maximumWeight: 1000000,
      maximumReplacementLiteralCharacters: 512, maximumPointDifferenceMM: 1e-7,
      maximumRelativeDerivativeDifference: 1e-7, sourceUTF16: 262144, sourceUTF8: 262144,
      maximumFileUTF16: 2097152, maximumFileUTF8: 2097152, ownValues: 1048576, ownDepth: 64,
      arrayElements: 8192, recordFields: 64, keyCharacters: 128, stringCharacters: 262144,
      identifierCharacters: 48,
    },
    workScope: 'direct-wrapper-calls-inherited-helper-compiler-work-excluded',
    budgetFailure: 'atomic-no-partial-source-curve-interval',
  };
  const result: SourceCurveIntervalExtractionResult = {
    request, source, originalModel, model, originalCurve, curve, provenance, report,
  };
  let stable = false;
  for (let pass = 0; pass < 8; pass++) {
    const measured = fileSize(result);
    if (same(measured, report.fileSizes.result)) { stable = true; break; }
    report.fileSizes.result = measured;
  }
  check(stable, CODE.FILE, 'Complete interval result size metadata did not settle within8 passes');
  return snapshot(result) as SourceCurveIntervalExtractionResult;
}

/** Reconstruct complete source and all actual interval stages from the owned request. */
export function validateSourceCurveIntervalExtraction(input: SourceCurveIntervalExtractionResult): SourceCurveIntervalExtractionReport {
  const owned = record(snapshot(input, true), ['request', 'source', 'originalModel', 'model',
    'originalCurve', 'curve', 'provenance', 'report'], CODE.OWNED) as unknown as SourceCurveIntervalExtractionResult;
  let expected: SourceCurveIntervalExtractionResult;
  try { expected = extractSourceCurveInterval(owned.request); }
  catch (cause) {
    throw new SourceCurveIntervalExtractionError(CODE.OWNED,
      'Complete owned source Curve interval reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED,
    'Owned source, Models, plan, stages, maps, native witnesses, stations, counts or sizes changed');
  return snapshot(expected.report, true) as SourceCurveIntervalExtractionReport;
}
