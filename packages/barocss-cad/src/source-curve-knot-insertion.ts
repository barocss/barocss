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

export const SourceCurveKnotInsertionDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', IDENTITY: 'IDENTITY', SOURCE: 'SOURCE',
  TARGET: 'TARGET', REQUEST: 'REQUEST', BUDGET: 'BUDGET',
  REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', NATIVE: 'NATIVE',
  OWNED: 'OWNED', FILE: 'FILE',
} as const);
export type SourceCurveKnotInsertionDiagnosticCode =
  typeof SourceCurveKnotInsertionDiagnosticCode[keyof typeof SourceCurveKnotInsertionDiagnosticCode];
export class SourceCurveKnotInsertionError extends Error {
  readonly code: SourceCurveKnotInsertionDiagnosticCode;
  constructor(code: SourceCurveKnotInsertionDiagnosticCode, detail: string, cause?: unknown) {
    super(('Source Curve knot insertion: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'SourceCurveKnotInsertionError';
    this.code = code;
  }
}
export interface SourceCurveKnotInsertionRequest {
  source: string;
  sourceVersion: 0;
  curveId: string;
  knot: number;
  maximumObservations: 128;
}
export interface SourceCurveKnotInsertionPatch {
  field: 'knots' | 'control-points' | 'weights';
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
  refinedPointMM: Point;
  pointDifferenceMM: number;
  originalD1: D1State;
  refinedD1: D1State;
  relativeDerivativeDifference: number | null;
};
type Provenance = {
  selectedObjectIndex: number;
  degree: number;
  domain: [number, number];
  knot: number;
  priorMultiplicity: number;
  refinedMultiplicity: number;
  parameterMap: { kind: 'identity'; formula: 'u=t'; d1Factor: 1 };
  patches: SourceCurveKnotInsertionPatch[];
  unchangedPoles: CurveKnotCoefficientResult['unchangedPoles'];
  unchangedKnots: CurveKnotCoefficientResult['unchangedKnots'];
  steps: CurveKnotCoefficientResult['steps'];
  homogeneousSteps: CurveKnotCoefficientResult['homogeneousSteps'];
};
export interface SourceCurveKnotInsertionReport {
  schema: 'barocss-source-curve-knot-insertion-report';
  version: 0;
  sourceVersion: 0;
  lengthUnit: 'mm';
  modelName: string;
  curveId: string;
  selectedObjectIndex: number;
  objectCount: number;
  degree: number;
  domain: [number, number];
  poleCounts: { original: number; refined: number };
  knotCounts: { original: number; refined: number };
  knot: number;
  priorMultiplicity: number;
  refinedMultiplicity: number;
  patchCount: 3;
  sourceSizes: { original: Size; candidate: Size };
  fileSizes: { request: Size; result: Size };
  observations: Observation[];
  maximumPointDifferenceMM: number;
  maximumRelativeDerivativeDifference: number;
  directCounts: {
    originalCompileCount: 1; candidateCompileCount: 1;
    coefficientInsertionCallCount: 1; insertedKnotCount: 1;
    nativeCurveValidationCount: 2; domainQueryCount: 2; patchCount: 3;
    decimalEmissionCount: number; observationCount: number;
    curveD0Count: number; curveD1AttemptCount: number;
    curveD1EvaluatedCount: number; curveD1RefusedCount: number;
    sourceWriterCallCount: 0; publicRefinementCallCount: 0;
    loftCallCount: 0; rationalOperationCount: 0;
  };
  preservation: {
    untouchedSourceSpans: true; modelHeaderBits: true; objectOrderAndIds: true;
    unselectedObjectBits: true; selectedCurveEqualsActualCoefficientCandidate: true;
    unaffectedCoefficientBits: true; degreeDomain: true; parameterIdentity: true;
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
    maximumDegree: 5; maximumOriginalPoles: 63; maximumRefinedPoles: 64;
    maximumKnots: 70; maximumInsertions: 1; maximumObservations: 128;
    maximumPatches: 3; maximumModelObjects: 16; coordinateAbsMM: 10000;
    minimumWeight: 0.000001; maximumWeight: 1000000;
    maximumReplacementLiteralCharacters: 512; maximumPointDifferenceMM: 1e-7;
    maximumRelativeDerivativeDifference: 1e-7; sourceUTF16: 262144;
    sourceUTF8: 262144; maximumFileUTF16: 2097152; maximumFileUTF8: 2097152;
    ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64;
    keyCharacters: 128; stringCharacters: 262144; identifierCharacters: 48;
  };
  workScope: 'direct-wrapper-calls-inherited-helper-compiler-work-excluded';
  budgetFailure: 'atomic-no-partial-source-curve-insertion';
}
export interface SourceCurveKnotInsertionResult {
  request: SourceCurveKnotInsertionRequest;
  source: string;
  originalModel: Model;
  model: Model;
  originalCurve: Curve;
  curve: Curve;
  provenance: Provenance;
  report: SourceCurveKnotInsertionReport;
}

const CODE = SourceCurveKnotInsertionDiagnosticCode;
function check(condition: boolean, code: SourceCurveKnotInsertionDiagnosticCode,
  detail: string): asserts condition {
  if (!condition) throw new SourceCurveKnotInsertionError(code, detail);
}
function delegated<T>(action: () => T, code: SourceCurveKnotInsertionDiagnosticCode,
  detail: string): T {
  try { return action(); }
  catch (cause) { throw new SourceCurveKnotInsertionError(code, detail, cause); }
}
function record(input: unknown, fields: string[],
  code: SourceCurveKnotInsertionDiagnosticCode = CODE.INPUT): Record<string, unknown> {
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
  if (!result.ok) throw new SourceCurveKnotInsertionError(CODE.SOURCE,
    'Actual ' + stage + ' complete Source0 compilation refused', result);
  return result;
}
function selectedArray(declaration: CadAstDeclaration,
  field: SourceCurveKnotInsertionPatch['field'], source: string,
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
function applyPatches(source: string, patches: SourceCurveKnotInsertionPatch[]): string {
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
/** Keep first numeric-equal bits; a Set would change negative zero. */
function observationParameters(original: Curve, curve: Curve, domain: [number, number]): number[] {
  const parameters: number[] = [];
  const add = (value: number): void => {
    if (!parameters.some(prior => prior === value)) parameters.push(value);
  };
  add(domain[0]);
  add(domain[1]);
  for (const geometry of [original, curve]) {
    const breaks = [domain[0]];
    for (const knot of geometry.knots) {
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
  check(parameters.length <= 128 && Object.is(parameters[0], domain[0]) &&
    Object.is(parameters[parameters.length - 1], domain[1]), CODE.BINDING,
  'Complete observation schedule must retain endpoint bits within128 stations');
  return parameters;
}

/** Insert once through the existing coefficient kernel and adopt the complete compiled source. */
export function insertSourceCurveKnot(input: SourceCurveKnotInsertionRequest): SourceCurveKnotInsertionResult {
  const data = record(snapshot(input), ['source', 'sourceVersion', 'curveId', 'knot', 'maximumObservations']);
  check(data.sourceVersion === 0, CODE.VERSION, 'Only explicit literal Source0 is supported');
  check(typeof data.source === 'string', CODE.INPUT, 'The complete original source string is required');
  check(typeof data.curveId === 'string' && data.curveId.length <= 48 &&
    /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.curveId), CODE.IDENTITY, 'Selected ASCII Curve ID1..48 is required');
  check(typeof data.knot === 'number' && Number.isFinite(data.knot), CODE.REQUEST,
    'A finite original-parameter knot is required');
  check(data.maximumObservations === 128, CODE.BUDGET, 'The complete fixed observation budget128 is required');
  const request = data as unknown as SourceCurveKnotInsertionRequest;
  const requestSize = fileSize(request);
  const originalSize = sourceSize(request.source);
  const compiledOriginal = compile(request.source, 'original');
  const originalModel = compiledOriginal.model;
  check(originalModel.objects.length <= 16, CODE.BUDGET, 'Complete original Model capacity16 is required');
  const selectedObjectIndex = originalModel.objects.findIndex(object => object.id === request.curveId);
  const selected = originalModel.objects[selectedObjectIndex];
  check(selected !== undefined && selected.kind === 'curve', CODE.TARGET,
    'Selected ID must identify an actual original Curve');
  const originalCurve = selected;
  check(originalCurve.degree >= 1 && originalCurve.degree <= 5 &&
    originalCurve.controlPoints.length >= originalCurve.degree + 1 &&
    originalCurve.controlPoints.length <= 63 && originalCurve.knots.length <= 69,
  CODE.BUDGET, 'Selected original Curve exceeds degree1..5 or insertion capacity63/69');
  check(originalCurve.controlPoints.every(point => point.every(value => Math.abs(value) <= 10000)),
    CODE.BUDGET, 'Selected original coordinates must remain within10000mm');
  delegated(() => validateCurve(originalCurve), CODE.NATIVE, 'Actual original Curve validation refused');
  const domain = delegated(() => curveDomain(originalCurve), CODE.NATIVE, 'Actual original Curve domain refused');
  check(request.knot > domain[0] && request.knot < domain[1], CODE.REQUEST,
    'Requested knot must be strictly inside the actual original domain');
  const priorMultiplicity = originalCurve.knots.filter(knot => knot === request.knot).length;
  check(priorMultiplicity + 1 <= originalCurve.degree, CODE.REQUEST,
    'Final numeric interior multiplicity cannot exceed degree');
  check(request.knot !== 0 || originalCurve.knots.every(knot => knot !== 0 || Object.is(knot, request.knot)),
    CODE.REQUEST, 'An existing numeric zero knot must agree with the requested zero bits');
  const declarations = compiledOriginal.ast.declarations.filter(value => value.id === request.curveId);
  const nodes = compiledOriginal.ir.nodes.filter(value => value.id === request.curveId);
  check(declarations.length === 1 && declarations[0].kind === 'curve' &&
    nodes.length === 1 && nodes[0].kind === 'curve' &&
    same(nodes[0].geometry, originalCurve) && same(nodes[0].span, declarations[0].range), CODE.BINDING,
  'A unique actual Curve declaration, IR geometry and Model binding is required');
  const declaration = declarations[0];
  const fields: SourceCurveKnotInsertionPatch['field'][] = ['knots', 'control-points', 'weights'];
  const arrays = fields.map(field => selectedArray(declaration, field, request.source,
    field === 'knots' ? originalCurve.knots : field === 'weights' ? originalCurve.weights : originalCurve.controlPoints));

  const calculation = delegated(() => insertCurveKnotCoefficientsTrusted(originalCurve, request.knot, 1),
    CODE.REPRESENTABILITY, 'Actual homogeneous insertion arithmetic or native candidate refused');
  const candidate = calculation.candidate;
  check(candidate.controlPoints.length === originalCurve.controlPoints.length + 1 &&
    candidate.controlPoints.length <= 64 && candidate.knots.length === originalCurve.knots.length + 1 &&
    candidate.knots.length <= 70 && candidate.id === originalCurve.id && candidate.degree === originalCurve.degree,
  CODE.BINDING, 'Actual coefficient candidate must be one original-identity insertion');
  let decimalEmissionCount = 0;
  const decimal = (value: number): string => {
    decimalEmissionCount++;
    const text = delegated(() => curveDecimal(value, 'Source Curve knot insertion'), CODE.REPRESENTABILITY,
      'Actual replacement decimal emission refused');
    check(text.length <= 512 && Object.is(Number(text), value), CODE.BINDING,
      'Every emitted replacement scalar must round-trip its actual bits');
    return text;
  };
  const replacements = [
    '[' + candidate.knots.map(decimal).join(',') + ']',
    '[' + candidate.controlPoints.map(point => '[' + point.map(decimal).join(',') + ']').join(',') + ']',
    '[' + candidate.weights.map(decimal).join(',') + ']',
  ];
  const patches: SourceCurveKnotInsertionPatch[] = fields.map((field, index) => ({
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
    'Complete candidate Model changed beyond the actual selected coefficient candidate');
  const model = compiledCandidate.model;
  const curve = model.objects[selectedObjectIndex];
  check(curve !== undefined && curve.kind === 'curve' && same(curve, candidate), CODE.BINDING,
    'Actual compiled selected Curve must equal the complete coefficient candidate');
  delegated(() => validateCurve(curve), CODE.NATIVE, 'Actual accepted candidate Curve validation refused');
  const refinedDomain = delegated(() => curveDomain(curve), CODE.NATIVE, 'Actual accepted candidate domain refused');
  check(same(domain, refinedDomain), CODE.BINDING, 'Original native domain endpoint bits must remain unchanged');
  for (const mapping of calculation.unchangedPoles) {
    check(same(originalCurve.controlPoints[mapping.originalPoleIndex], curve.controlPoints[mapping.refinedPoleIndex]) &&
      Object.is(originalCurve.weights[mapping.originalPoleIndex], curve.weights[mapping.refinedPoleIndex]), CODE.BINDING,
    'Every copied original pole and weight must retain its exact bits');
  }
  for (const mapping of calculation.unchangedKnots) {
    check(Object.is(originalCurve.knots[mapping.originalKnotIndex], curve.knots[mapping.refinedKnotIndex]),
      CODE.BINDING, 'Every copied original knot must retain its exact bits');
  }
  const refinedMultiplicity = curve.knots.filter(knot => knot === request.knot).length;
  check(refinedMultiplicity === priorMultiplicity + 1 &&
    decimalEmissionCount === 4 * curve.controlPoints.length + curve.knots.length,
  CODE.BINDING, 'Actual insertion and scalar emission counts disagree');
  const parameters = observationParameters(originalCurve, curve, domain);
  let curveD0Count = 0, curveD1AttemptCount = 0;
  let curveD1EvaluatedCount = 0, curveD1RefusedCount = 0;
  const d0 = (geometry: Curve, parameter: number): Point => {
    curveD0Count++;
    return delegated(() => evaluateCurve(geometry, parameter), CODE.NATIVE,
      'Actual original or refined Curve D0 refused');
  };
  const d1 = (geometry: Curve, parameter: number): D1State => {
    curveD1AttemptCount++;
    try {
      const value = evaluateCurveD1(geometry, parameter);
      curveD1EvaluatedCount++;
      return { status: 'evaluated', value };
    } catch (cause) {
      if (!(cause instanceof Error && /exact C0 interior knot/.test(cause.message))) {
        throw new SourceCurveKnotInsertionError(CODE.NATIVE,
          'Only the actual exact-C0 interior-knot D1 refusal is admissible', cause);
      }
      curveD1RefusedCount++;
      return { status: 'refused-c0', name: cause.name.slice(0, 1024),
        reason: cause.message.slice(0, 1024), value: null };
    }
  };
  const observations: Observation[] = parameters.map(parameter => {
    const originalPointMM = d0(originalCurve, parameter);
    const refinedPointMM = d0(curve, parameter);
    const pointDifferenceMM = Math.hypot(...refinedPointMM.map((value, axis) => value - originalPointMM[axis]));
    check(Number.isFinite(pointDifferenceMM) && pointDifferenceMM <= 1e-7, CODE.BINDING,
      'Actual native original/refined point difference exceeds1e-7mm');
    const originalD1 = d1(originalCurve, parameter), refinedD1 = d1(curve, parameter);
    let relativeDerivativeDifference: number | null = null;
    if (originalD1.status === 'evaluated' && refinedD1.status === 'evaluated') {
      const before = originalD1.value.derivative, after = refinedD1.value.derivative;
      const differenceNorm = Math.hypot(...after.map((value, axis) => value - before[axis]));
      const originalNorm = Math.hypot(...before);
      const refinedNorm = Math.hypot(...after);
      const scale = Math.max(1, originalNorm, refinedNorm);
      check(Number.isFinite(differenceNorm) && Number.isFinite(originalNorm) &&
        Number.isFinite(refinedNorm) && Number.isFinite(scale), CODE.REPRESENTABILITY,
      'Native derivative comparison norms must remain finite');
      relativeDerivativeDifference = differenceNorm / scale;
      check(Number.isFinite(relativeDerivativeDifference) && relativeDerivativeDifference <= 1e-7,
        CODE.BINDING, 'Actual native relative derivative difference exceeds1e-7');
    }
    return { parameter, originalPointMM, refinedPointMM, pointDifferenceMM,
      originalD1, refinedD1, relativeDerivativeDifference };
  });
  check(curveD0Count === 2 * observations.length && curveD1AttemptCount === 2 * observations.length &&
    curveD1EvaluatedCount + curveD1RefusedCount === curveD1AttemptCount, CODE.BINDING,
  'Every actual native observation attempt must be counted');
  const provenance: Provenance = {
    selectedObjectIndex, degree: curve.degree, domain, knot: request.knot,
    priorMultiplicity, refinedMultiplicity,
    parameterMap: { kind: 'identity', formula: 'u=t', d1Factor: 1 }, patches,
    unchangedPoles: calculation.unchangedPoles, unchangedKnots: calculation.unchangedKnots,
    steps: calculation.steps, homogeneousSteps: calculation.homogeneousSteps,
  };
  const report: SourceCurveKnotInsertionReport = {
    schema: 'barocss-source-curve-knot-insertion-report', version: 0, sourceVersion: 0,
    lengthUnit: 'mm', modelName: model.name, curveId: curve.id, selectedObjectIndex,
    objectCount: model.objects.length, degree: curve.degree, domain,
    poleCounts: { original: originalCurve.controlPoints.length, refined: curve.controlPoints.length },
    knotCounts: { original: originalCurve.knots.length, refined: curve.knots.length },
    knot: request.knot, priorMultiplicity, refinedMultiplicity, patchCount: 3,
    sourceSizes: { original: originalSize, candidate: candidateSize },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, observations,
    maximumPointDifferenceMM: Math.max(...observations.map(value => value.pointDifferenceMM)),
    maximumRelativeDerivativeDifference: Math.max(0, ...observations.map(value => value.relativeDerivativeDifference ?? 0)),
    directCounts: {
      originalCompileCount: 1, candidateCompileCount: 1, coefficientInsertionCallCount: 1,
      insertedKnotCount: 1, nativeCurveValidationCount: 2, domainQueryCount: 2, patchCount: 3,
      decimalEmissionCount, observationCount: observations.length, curveD0Count, curveD1AttemptCount,
      curveD1EvaluatedCount, curveD1RefusedCount, sourceWriterCallCount: 0,
      publicRefinementCallCount: 0, loftCallCount: 0, rationalOperationCount: 0,
    },
    preservation: {
      untouchedSourceSpans: true, modelHeaderBits: true, objectOrderAndIds: true,
      unselectedObjectBits: true, selectedCurveEqualsActualCoefficientCandidate: true,
      unaffectedCoefficientBits: true, degreeDomain: true, parameterIdentity: true,
    },
    quality: {
      geometricValidity: 'not-certified', topologyCertified: false, solid: false,
      localShapeObservations: true, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false,
      g1g2Certified: false, manufacturingToleranceCertified: false, editorDisplayCertified: false,
      persistentTopologyBindingCertified: false, publication: false,
      derivativeSemantics: 'actual-native-guards-unchanged', ownership: 'independent-copied-cpu-data-gc',
    },
    limits: {
      maximumDegree: 5, maximumOriginalPoles: 63, maximumRefinedPoles: 64,
      maximumKnots: 70, maximumInsertions: 1, maximumObservations: 128, maximumPatches: 3,
      maximumModelObjects: 16, coordinateAbsMM: 10000, minimumWeight: 0.000001,
      maximumWeight: 1000000, maximumReplacementLiteralCharacters: 512,
      maximumPointDifferenceMM: 1e-7, maximumRelativeDerivativeDifference: 1e-7,
      sourceUTF16: 262144, sourceUTF8: 262144, maximumFileUTF16: 2097152, maximumFileUTF8: 2097152,
      ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64,
      keyCharacters: 128, stringCharacters: 262144, identifierCharacters: 48,
    },
    workScope: 'direct-wrapper-calls-inherited-helper-compiler-work-excluded',
    budgetFailure: 'atomic-no-partial-source-curve-insertion',
  };
  const result: SourceCurveKnotInsertionResult = {
    request, source, originalModel, model, originalCurve, curve, provenance, report,
  };
  let stable = false;
  for (let pass = 0; pass < 8; pass++) {
    const measured = fileSize(result);
    if (same(measured, report.fileSizes.result)) { stable = true; break; }
    report.fileSizes.result = measured;
  }
  check(stable, CODE.FILE, 'Complete result size metadata did not settle within8 passes');
  return snapshot(result) as SourceCurveKnotInsertionResult;
}

/** Rebuild all source, coefficient and native receipts from the complete owned request. */
export function validateSourceCurveKnotInsertion(input: SourceCurveKnotInsertionResult): SourceCurveKnotInsertionReport {
  const owned = record(snapshot(input, true), ['request', 'source', 'originalModel', 'model',
    'originalCurve', 'curve', 'provenance', 'report'], CODE.OWNED) as unknown as SourceCurveKnotInsertionResult;
  let expected: SourceCurveKnotInsertionResult;
  try { expected = insertSourceCurveKnot(owned.request); }
  catch (cause) {
    throw new SourceCurveKnotInsertionError(CODE.OWNED,
      'Complete owned Source0 knot insertion reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED,
    'Owned source, Models, coefficients, patches, native observations, counts or sizes changed');
  return snapshot(expected.report, true) as SourceCurveKnotInsertionReport;
}
