import { CadNumericPolicy } from '../../numeric-policy.js';
import { validateCurve, evaluateCurve, curveDomain } from '../../core/math.js';
import { adopt } from '../../intersect/own-plane-cylinder-intersection-internal.js';
import { copyCadData } from '../../data-copy.js';
import { CurveInterpolationError } from './curve-interpolation.js';
import type { CurveInterpolationDiagnosticCode, CurveInterpolationPoint, CurveInterpolationOptions, CurveInterpolationReport, CurveInterpolationResult } from './curve-interpolation.js';
import type { Curve, Model, Point } from '../../types.js';

// Private literal codes avoid top-level reads of the public module during its import cycle.
const CODE = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', NATIVE: 'NATIVE', REPRESENTABILITY: 'REPRESENTABILITY',
  CONDITIONING: 'CONDITIONING', BINDING: 'BINDING', OWNED: 'OWNED' } as const), PIVOT_EPSILON = 128 * Number.EPSILON, TOLERANCE = CadNumericPolicy.linearToleranceMM;
function check(condition: boolean, code: CurveInterpolationDiagnosticCode, detail: string): asserts condition { if (!condition) throw new CurveInterpolationError(code, detail); }
function native<T>(action: () => T, detail: string, code: CurveInterpolationDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) { if (cause instanceof CurveInterpolationError) throw cause;
    throw new CurveInterpolationError(code, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause); }
}
export function snapshotCurveInterpolationKernelData(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 524288 : 32768;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 32 : 8), code, 'own-value/depth budget exceeded');
    if (value === null && owned || typeof value === 'boolean' && owned) return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= (owned ? 262144 : 128), code, 'own/source string budget exceeded'); return value; }
    check(value !== null && typeof value === 'object', code, 'plain own data required');
    check(!ancestors.has(value), code, 'ancestor cycles refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
    check(keys.length <= (array ? (owned ? 4097 : 129) : (owned ? 64 : 16)) && keys.every(key => typeof key === 'string' && key.length <= 128
      && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden/excess own fields refused');
    ancestors.add(value);
    try {
      if (array) {
        const length = descriptors.length.value as number;
        check(Number.isInteger(length) && length >= 0 && length <= (owned ? 4096 : 128) && keys.length === length + 1, code, 'dense bounded own array required');
        return Array.from({ length }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), code, 'sparse/foreign own array field refused'); return copy(descriptors[String(i)].value, depth + 1); });
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    } finally { ancestors.delete(value); }
  }; return copy(input, 0);
}
export function recordCurveInterpolationKernelData(input: unknown, fields: string[], code: CurveInterpolationDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required'); const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
export function sameCurveInterpolationKernelData(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => sameCurveInterpolationKernelData(value, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && sameCurveInterpolationKernelData(x[key], y[key])); } return Object.is(a, b);
}
function id(value: unknown): string { check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..48 required'); return value; }
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'finite knot/basis/elimination/backsubstitution arithmetic required'); return value; }
function product(a: number, b: number): number { const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero interpolation product underflow'); return value; }
function quotient(a: number, b: number): number { const value = finite(a / b); check(a === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero interpolation quotient underflow'); return value; }

/** INTERNAL actual943 arithmetic/order, with optional admitted fixed positive weights. */
export function buildCurveInterpolationKernel(pointsInput: CurveInterpolationPoint[], optionsInput: CurveInterpolationOptions, weightsInput?: number[]): CurveInterpolationResult {
  const copied = recordCurveInterpolationKernelData(snapshotCurveInterpolationKernelData({ points: pointsInput, options: optionsInput }), ['points', 'options']);
  check(Array.isArray(copied.points) && copied.points.length >= 2 && copied.points.length <= 16, CODE.INPUT, '2..16 explicit through-point records required');
  const points: CurveInterpolationPoint[] = copied.points.map(input => {
    const point = recordCurveInterpolationKernelData(input, ['parameter', 'pointMM']);
    check(typeof point.parameter === 'number' && Number.isFinite(point.parameter) && Math.abs(point.parameter) <= 10000, CODE.INPUT, 'original finite parameter within10000 required');
    check(Array.isArray(point.pointMM) && point.pointMM.length === 3 && point.pointMM.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000),
      CODE.INPUT, 'authored XYZ within10000mm required'); return { parameter: point.parameter, pointMM: point.pointMM as Point };
  });
  for (let i = 1; i < points.length; i++) check(points[i].parameter > points[i - 1].parameter && Number.isFinite(points[i].parameter - points[i - 1].parameter),
    CODE.INPUT, 'supplied native parameters must be strictly increasing without sorting or duplicate repair');
  const data = recordCurveInterpolationKernelData(copied.options, ['curveId', 'degree', 'maximumBasisEvaluations', 'maximumEliminationSteps']), curveId = id(data.curveId);
  check(typeof data.degree === 'number' && Number.isInteger(data.degree) && data.degree >= 1 && data.degree <= 3 && points.length >= data.degree + 1,
    CODE.INPUT, 'degree1..3 and pointCount>=degree+1 required');
  for (const [field, maximum] of [['maximumBasisEvaluations', 256], ['maximumEliminationSteps', 120]] as const) check(typeof data[field] === 'number'
    && Number.isInteger(data[field]) && (data[field] as number) >= 0 && (data[field] as number) <= maximum, CODE.BUDGET, 'integer ' + field + ' within frozen native work limits required');
  const options: CurveInterpolationOptions = { curveId, degree: data.degree, maximumBasisEvaluations: data.maximumBasisEvaluations as number, maximumEliminationSteps: data.maximumEliminationSteps as number };
  const count = points.length, degree = options.degree, parameters = points.map(point => point.parameter), domain: [number, number] = [parameters[0], parameters[count - 1]];
  const weightData = weightsInput === undefined ? Array<number>(count).fill(1) : snapshotCurveInterpolationKernelData(weightsInput);
  check(Array.isArray(weightData) && weightData.length === count && weightData.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 1e-6 && value <= 1e6),
    CODE.INPUT, 'fixed positive original weight vector must match point count and native1e-6..1e6 bounds');
  const providedWeights = weightData as number[];
  check(Number.isFinite(domain[1] - domain[0]) && domain[1] > domain[0], CODE.INPUT, 'finite positive original parameter span required');
  const expectedBasisCount = count * count, expectedEliminationCount = count * (count - 1) / 2;
  check(expectedBasisCount <= options.maximumBasisEvaluations && expectedEliminationCount <= options.maximumEliminationSteps, CODE.BUDGET,
    'complete N*N basis and N*(N-1)/2 row-stage budgets required before any basis evaluation or solve');
  const knots = Array<number>(degree + 1).fill(domain[0]), averages: CurveInterpolationReport['knotConstruction']['averages'] = [];
  for (let j = 1; j <= count - degree - 1; j++) {
    const origin = parameters[j], parameterIndices = Array.from({ length: degree }, (_, k) => j + k);
    const offsetSum = parameterIndices.reduce((sum, index) => finite(sum + finite(parameters[index] - origin)), 0);
    const offset = quotient(offsetSum, degree), mean = offset === 0 ? origin : finite(origin + offset);
    check(offset === 0 || mean !== origin, CODE.REPRESENTABILITY, 'nonzero averaged knot shift disappeared into unchanged parameter');
    check(mean > knots[knots.length - 1] && mean < domain[1], CODE.REPRESENTABILITY, 'averaged native interior knots must have positive represented spacing');
    averages.push({ knotIndex: knots.length, parameterIndices, origin, offsetSum, mean }); knots.push(mean);
  }
  knots.push(...Array<number>(degree + 1).fill(domain[1]));
  const basisCurveIds = Array.from({ length: count }, (_, column) => { const first = 'curve_interpolation_basis_' + column;
    return id(first === curveId ? 'curve_interpolation_basis_alt_' + column : first); });
  check(new Set(basisCurveIds).size === count && basisCurveIds.every(value => value !== curveId), CODE.IDENTITY, 'bounded transient basis identities must be distinct from final geometry');
  const basisCurves: Curve[] = basisCurveIds.map((id, column) => ({ kind: 'curve', id, degree, knots: copyCadData(knots), weights: copyCadData(providedWeights),
    controlPoints: Array.from({ length: count }, (_, pole) => [pole === column ? 1 : 0, 0, 0] as Point) }));
  native(() => validateCurve(basisCurves[0]), 'actual original native basis-probe knot/degree/weight profile validation');
  const basisMatrix: number[][] = [], basisEvaluations: CurveInterpolationReport['basisEvaluations'] = [];
  let basisEvaluationCount = 0;
  for (let row = 0; row < count; row++) {
    const coefficients: number[] = [];
    for (let column = 0; column < count; column++) {
      basisEvaluationCount++;
      const nativePointMM = native(() => evaluateCurve(basisCurves[column], parameters[row]), 'actual original native normalized basis Curve evaluation');
      const coefficient = nativePointMM[0]; check(Number.isFinite(coefficient) && coefficient >= 0 && coefficient <= 1, CODE.BINDING, 'actual native normalized basis coefficient must be finite in0..1');
      coefficients.push(coefficient); basisEvaluations.push({ row, column, parameter: parameters[row], basisCurveId: basisCurveIds[column], nativePointMM, coefficient });
    }
    basisMatrix.push(coefficients);
  }
  check(basisMatrix[0].every((value, column) => value === (column === 0 ? 1 : 0))
    && basisMatrix[count - 1].every((value, column) => value === (column === count - 1 ? 1 : 0)), CODE.BINDING, 'actual native clamped endpoint rows must be exact unit rows before endpoint bit copy');
  const pointRHS = points.map(point => copyCadData(point.pointMM)), matrix = copyCadData(basisMatrix), rhs = copyCadData(pointRHS);
  const originalRowScales = basisMatrix.map(row => Math.max(...row.map(Math.abs))), scales = [...originalRowScales], rowOrder = Array.from({ length: count }, (_, i) => i);
  check(scales.every(scale => scale > 0 && Number.isFinite(scale)), CODE.CONDITIONING, 'positive native matrix row scales required');
  const pivots: CurveInterpolationReport['solver']['pivots'] = [], eliminations: CurveInterpolationReport['solver']['eliminations'] = [];
  let eliminationStepCount = 0;
  for (let column = 0; column < count; column++) {
    let selectedCurrentRow = column, score = -1;
    for (let row = column; row < count; row++) { const candidateScore = quotient(Math.abs(matrix[row][column]), scales[row]);
      if (candidateScore > score) { score = candidateScore; selectedCurrentRow = row; } }
    let swappedCurrentRows: [number, number] | null = null;
    if (selectedCurrentRow !== column) {
      [matrix[column], matrix[selectedCurrentRow]] = [matrix[selectedCurrentRow], matrix[column]];
      [rhs[column], rhs[selectedCurrentRow]] = [rhs[selectedCurrentRow], rhs[column]];
      [scales[column], scales[selectedCurrentRow]] = [scales[selectedCurrentRow], scales[column]];
      [rowOrder[column], rowOrder[selectedCurrentRow]] = [rowOrder[selectedCurrentRow], rowOrder[column]];
      swappedCurrentRows = [column, selectedCurrentRow];
    }
    const pivotMagnitude = Math.abs(matrix[column][column]), threshold = product(PIVOT_EPSILON, scales[column]);
    check(pivotMagnitude > threshold, CODE.CONDITIONING, 'scaled native basis pivot is zero or within128-epsilon row-scale guard at column' + column);
    pivots.push({ column, selectedCurrentRow, pivotRowOriginalIndex: rowOrder[column], score, pivotMagnitude, rowScale: scales[column], threshold,
      swappedCurrentRows, rowOrder: [...rowOrder] });
    for (let row = column + 1; row < count; row++) {
      eliminationStepCount++;
      const factor = quotient(matrix[row][column], matrix[column][column]);
      eliminations.push({ column, row, rowOriginalIndex: rowOrder[row], pivotRowOriginalIndex: rowOrder[column], factor });
      matrix[row][column] = 0;
      if (factor === 0) continue;
      for (let next = column + 1; next < count; next++) matrix[row][next] = finite(matrix[row][next] - product(factor, matrix[column][next]));
      for (let axis = 0; axis < 3; axis++) rhs[row][axis] = finite(rhs[row][axis] - product(factor, rhs[column][axis]));
    }
  }
  const solvedPolesBeforeEndpointCopy: Point[] = Array.from({ length: count }, () => [0, 0, 0] as Point);
  for (let row = count - 1; row >= 0; row--) for (let axis = 0; axis < 3; axis++) {
    let value = rhs[row][axis];
    for (let column = row + 1; column < count; column++) value = finite(value - product(matrix[row][column], solvedPolesBeforeEndpointCopy[column][axis]));
    solvedPolesBeforeEndpointCopy[row][axis] = quotient(value, matrix[row][row]);
  }
  const solvedPoles = copyCadData(solvedPolesBeforeEndpointCopy);
  solvedPoles[0] = copyCadData(points[0].pointMM); solvedPoles[count - 1] = copyCadData(points[count - 1].pointMM);
  check(solvedPoles.every(point => point.every(value => Number.isFinite(value) && Math.abs(value) <= 10000)), CODE.REPRESENTABILITY, 'generated interpolation poles exceed10000mm; no clamping/projection allowed');
  const candidate: Curve = { kind: 'curve', id: curveId, degree, knots: copyCadData(knots), controlPoints: solvedPoles, weights: copyCadData(providedWeights) };
  native(() => validateCurve(candidate), weightsInput === undefined ? 'actual solved native polynomial Curve validation' : 'actual solved native fixed-weight Curve validation');
  const expected: Model = { name: curveId, version: 0, lengthUnit: 'mm', objects: [candidate] }, file = native(() => adopt(expected), 'actual one-Curve native Source0 adoption');
  check(file.source.length <= 262144, CODE.BUDGET, 'native source string budget exceeded'); check(sameCurveInterpolationKernelData(file.model, expected), CODE.BINDING, 'actual complete native source coefficients/knots/weights/IDs/signs must match');
  const curve = file.model.objects[0] as Curve;
  let pointEvaluationCount = 0;
  const observations: CurveInterpolationReport['observations'] = points.map(point => {
    pointEvaluationCount++; const actualPointMM = native(() => evaluateCurve(curve, point.parameter), 'actual final native through-point interpolation residual');
    const differenceMM = finite(Math.hypot(...actualPointMM.map((value, axis) => finite(value - point.pointMM[axis]))));
    check(differenceMM <= TOLERANCE, CODE.BINDING, 'actual native through-point residual exceeds1e-7mm');
    return { parameter: point.parameter, inputPointMM: point.pointMM, actualPointMM, differenceMM };
  });
  check(basisEvaluationCount === expectedBasisCount && eliminationStepCount === expectedEliminationCount && pointEvaluationCount === count,
    CODE.BINDING, 'complete actual basis/elimination/final point counts required');
  const report: CurveInterpolationReport = {
    schema: 'barocss-native-curve-interpolation', version: 0, curveId, degree, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion', parameters, domain: curveDomain(curve), knots,
    pointCount: count, knotConstruction: { method: 'original-parameter-clamped-averaging', endpointCopies: degree + 1, averages }, basisCurveIds, basisEvaluations, basisMatrix, pointRHS,
    solver: { method: 'deterministic-scaled-partial-pivot-xyz', originalRowScales, rowOrder, pivots, eliminations, upperTriangularMatrix: matrix,
      transformedRHS: rhs, solvedPolesBeforeEndpointCopy, endpointRowsVerified: true, endpointBitsCopied: true }, solvedPoles,
    basisEvaluationCount, eliminationStepCount, pointEvaluationCount, observations, maximumPointDifferenceMM: Math.max(...observations.map(observation => observation.differenceMM)),
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { authority: 'actual-original-native-normalized-basis-and-through-point-evaluator', weights: 'polynomial-all-one-no-rational-weight-solving',
      parameters: 'explicit-original-values-no-chord-length-or-normalization', solver: 'condition-limited-no-singularity-repair-qr-or-svd',
      endpoints: 'native-clamped-endpoint-rows-verified-then-authored-bit-copy', localInterpolationAccuracyOnly: true,
      nativeWork: 'actual-n-squared-basis-plus-all-lower-row-stages-and-final-point-checks-sourcecompiler-separate', periodicCertified: false, leastSquaresFit: false,
      tangentConstraintsSolved: false, curvatureConstraintsSolved: false, continuityConstraintsSolved: false, regularityCertified: false, globalShapeErrorCertified: false,
      globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, sourceObjectLimitUnchanged: 16, ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    budgetFailure: 'atomic-refusal-no-partial-interpolating-curve', limits: { maximumPoints: 16, maximumDegree: 3, maximumBasisEvaluations: 256, maximumEliminationSteps: 120,
      authoredIdCharacters: 48, parameterAbs: 10000, coordinateAbsMM: 10000, pivotRelativeThreshold: PIVOT_EPSILON, pointComparisonMM: TOLERANCE,
      inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128, ownValues: 524288, ownDepth: 32,
      arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144 },
  };
  return snapshotCurveInterpolationKernelData({ points, options, curve, source: file.source, sourceVersion: 0, model: file.model, report }, true) as CurveInterpolationResult;
}
