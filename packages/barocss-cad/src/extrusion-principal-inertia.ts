import { validateCoplanarFaceBooleanExtrusionMass } from './coplanar-face-boolean-extrusion-mass.js';
import type { CoplanarFaceBooleanExtrusionMassResult } from './coplanar-face-boolean-extrusion-mass.js';
import { copyCadData } from './data-copy.js';
import type { Point } from './types.js';
import { same } from './structural-equality.js';

export const ExtrusionPrincipalInertiaDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', BUDGET: 'BUDGET', NATIVE: 'NATIVE', REPRESENTABILITY: 'REPRESENTABILITY', OWNED: 'OWNED',
} as const);
export type ExtrusionPrincipalInertiaDiagnosticCode = typeof ExtrusionPrincipalInertiaDiagnosticCode[keyof typeof ExtrusionPrincipalInertiaDiagnosticCode];
export class ExtrusionPrincipalInertiaError extends Error {
  readonly code: ExtrusionPrincipalInertiaDiagnosticCode;
  constructor(code: ExtrusionPrincipalInertiaDiagnosticCode, detail: string, cause?: unknown) {
    super(('Extrusion principal inertia: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'ExtrusionPrincipalInertiaError'; this.code = code;
  }
}
export interface ExtrusionPrincipalInertiaOptions {
  maximumRotations: number; scaledResidualTolerance: number; degeneracyToleranceRelative: number;
}
export interface ExtrusionPrincipalInertiaAxis { index: number; directionXYZ: Point; momentKgM2: number }
type Matrix = [Point, Point, Point];
type Principal = { momentsKgM2: Point; axesXYZ: [ExtrusionPrincipalInertiaAxis, ExtrusionPrincipalInertiaAxis, ExtrusionPrincipalInertiaAxis] };
type Rotation = { index: number; pivot: [number, number]; pivotValueScaled: number; diagonalBeforeScaled: [number, number];
  thetaRadians: number; sine: number; cosine: number; rawAnnihilationResidualScaled: number; annihilationGuardScaled: number;
  remainingOffDiagonalNormScaled: number; similarityResidualScaled: number; similarityGuardScaled: number;
  matrixBeforeScaled: Matrix; matrixAfterScaled: Matrix; eigenvectorsAfter: Matrix };
type Cluster = { indices: number[]; momentsKgM2: number[]; maximumAdjacentGapKgM2: number; thresholdKgM2: number };
type Residuals = { similarityScaled: number; eigensystemScaled: number; reconstructionScaled: number; orthogonality: number;
  maximumUnitNorm: number; determinant: number; scaledGuard: number; unitGuard: number };
export interface ExtrusionPrincipalInertiaReport {
  schema: 'barocss-native-extrusion-principal-inertia'; version: 0; evaluationId: string;
  units: { moment: 'kg*m2'; centroid: 'mm'; direction: 'world-xyz-unit-vector' }; sourceFrame: 'authored-xyz-no-axis-conversion';
  densityKgPerM3: number; massKG: number; centroidMM: Point | null; empty: boolean;
  parentMassValidationCount: 1; matrixScaleKgM2: number; normalizedMatrix: Matrix | null;
  options: ExtrusionPrincipalInertiaOptions; rotationTrace: Rotation[]; rotationCount: number;
  convergence: { offDiagonalNormScaled: number; toleranceScaled: number; converged: true };
  sortedMomentsKgM2: Point | null; axesXYZ: Principal['axesXYZ'] | null; residuals: Residuals | null;
  observedDegenerateClusters: Cluster[]; axesUnique: boolean | null;
  signPolicy: 'first-two-largest-absolute-component-positive-xyz-ties-third-right-handed';
  numericPolicy: { pivot: 'largest-absolute-offdiagonal-lexicographic-01-02-12'; angle: 'half-atan2-2b-d-minus-a';
    annihilation: 'checked-raw-jacobi-pivot-residual-then-zero'; residualNorm: 'frobenius';
    convergenceNorm: 'upper-offdiagonal-euclidean'; roundingFactor: 512;
    clustering: 'connected-adjacent-gaps-within-relative-original-matrix-scale'; axesMeaning: 'canonical-local-representatives-not-persistent-axes';
    axisZeroSign: 'positive-zero-only-for-exact-zero-components' };
  quality: { constructionEstimateOnly: true; densityCertified: false; materialCertified: false; solidCertified: false;
    globalAccuracyCertified: false; physicalConsumerCertified: false; symmetryCertified: false; ownership: 'independent-copied-cpu-data-gc' };
  workScope: 'one-actual-public-mass-validation-and-new-jacobi-rotations-parent-rebuild-work-excluded'; budgetFailure: 'atomic-no-partial-eigensystem';
  limits: { maximumRotations: 64; ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface ExtrusionPrincipalInertiaResult {
  mass: CoplanarFaceBooleanExtrusionMassResult; options: ExtrusionPrincipalInertiaOptions; principal: Principal | null; report: ExtrusionPrincipalInertiaReport;
}

const CODE = ExtrusionPrincipalInertiaDiagnosticCode, ROUNDING = 512 * Number.EPSILON;
function check(condition: boolean, code: ExtrusionPrincipalInertiaDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new ExtrusionPrincipalInertiaError(code, detail);
}
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'Finite principal-inertia arithmetic range exceeded'); return value; }
function product(a: number, b: number): number {
  const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'Nonzero principal-inertia product underflowed'); return value;
}
function quotient(a: number, b: number): number {
  check(Number.isFinite(b) && b !== 0, CODE.REPRESENTABILITY, 'A finite nonzero principal-inertia divisor is required');
  const value = finite(a / b); check(a === 0 || value !== 0, CODE.REPRESENTABILITY, 'Nonzero principal-inertia quotient underflowed'); return value;
}
function sum(values: number[]): number { return values.reduce((total, value) => finite(total + value), 0); }
function matrix(value: (row: number, column: number) => number): Matrix {
  return [0, 1, 2].map(row => [0, 1, 2].map(column => finite(value(row, column))) as Point) as Matrix;
}
function identity(): Matrix { return matrix((row, column) => row === column ? 1 : 0); }
function transpose(a: Matrix): Matrix { return matrix((row, column) => a[column][row]); }
function multiply(a: Matrix, b: Matrix): Matrix { return matrix((row, column) => sum([0, 1, 2].map(index => product(a[row][index], b[index][column])))); }
function norm(a: Matrix): number { return finite(Math.hypot(...a.flat())); }
function residual(a: Matrix, b: Matrix): number { return norm(matrix((row, column) => finite(a[row][column] - b[row][column]))); }
function similarity(a: Matrix, vectors: Matrix): Matrix { return multiply(multiply(transpose(vectors), a), vectors); }
function offDiagonal(a: Matrix): number { return finite(Math.hypot(a[0][1], a[0][2], a[1][2])); }
function determinant(a: Matrix): number {
  return sum([product(a[0][0], finite(product(a[1][1], a[2][2]) - product(a[1][2], a[2][1]))),
    -product(a[0][1], finite(product(a[1][0], a[2][2]) - product(a[1][2], a[2][0]))),
    product(a[0][2], finite(product(a[1][0], a[2][1]) - product(a[1][1], a[2][0])))]);
}
function snapshot(input: unknown, code: ExtrusionPrincipalInertiaDiagnosticCode): unknown {
  let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, code, 'Own value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, code, 'Own source string limit exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic plain own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
    check(keys.length <= (array ? 8193 : 64), code, 'Own field limit exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Getter, symbol, or hidden fields are refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded own arrays are required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'Sparse or extra own array fields are refused'); return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) {
    if (cause instanceof ExtrusionPrincipalInertiaError) throw cause;
    throw new ExtrusionPrincipalInertiaError(code, 'Own-data snapshot failed', cause);
  }
}
function record(value: unknown, fields: string[], code: ExtrusionPrincipalInertiaDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data;
}
function analyzeTensor(original: Matrix, scale: number, options: ExtrusionPrincipalInertiaOptions): {
  principal: Principal; rotationTrace: Rotation[]; residuals: Residuals; clusters: Cluster[]; finalOffDiagonal: number;
} {
  const a = copyCadData(original), vectors = identity(), rotationTrace: Rotation[] = [], originalNorm = Math.max(1, norm(original));
  const roundingGuard = (rotations: number) => product(product(ROUNDING, rotations + 1), originalNorm);
  while (offDiagonal(a) > options.scaledResidualTolerance) {
    check(rotationTrace.length < options.maximumRotations, CODE.BUDGET, 'Jacobi rotation budget exhausted before actual scaled convergence');
    const pairs: [number, number][] = [[0, 1], [0, 2], [1, 2]];
    let pivot = pairs[0];
    for (const pair of pairs.slice(1)) if (Math.abs(a[pair[0]][pair[1]]) > Math.abs(a[pivot[0]][pivot[1]])) pivot = pair;
    const [p, q] = pivot, av = a[p][p], b = a[p][q], d = a[q][q], matrixBeforeScaled = copyCadData(a);
    check(b !== 0, CODE.REPRESENTABILITY, 'A nonzero Jacobi pivot is required');
    const thetaRadians = product(.5, finite(Math.atan2(product(2, b), finite(d - av))));
    const sine = finite(Math.sin(thetaRadians)), cosine = finite(Math.cos(thetaRadians));
    const cc = product(cosine, cosine), ss = product(sine, sine), cs = product(cosine, sine);
    check(Math.abs(finite(cc + ss - 1)) <= ROUNDING, CODE.REPRESENTABILITY, 'Jacobi sine/cosine unit residual exceeded its rounding guard');
    const rawAnnihilationResidualScaled = sum([product(finite(av - d), cs), product(b, finite(cc - ss))]);
    const annihilationGuardScaled = product(ROUNDING, Math.max(1, Math.abs(av), Math.abs(b), Math.abs(d)));
    check(Math.abs(rawAnnihilationResidualScaled) <= annihilationGuardScaled, CODE.REPRESENTABILITY, 'Raw computed Jacobi annihilation residual exceeded its disclosed guard');
    a[p][p] = sum([product(cc, av), -product(2, product(cs, b)), product(ss, d)]);
    a[q][q] = sum([product(ss, av), product(2, product(cs, b)), product(cc, d)]);
    for (const index of [0, 1, 2]) if (index !== p && index !== q) {
      const ap = matrixBeforeScaled[index][p], aq = matrixBeforeScaled[index][q];
      a[index][p] = a[p][index] = finite(product(cosine, ap) - product(sine, aq));
      a[index][q] = a[q][index] = sum([product(sine, ap), product(cosine, aq)]);
    }
    // The pivot is mathematically annihilated; preserve and check its computed residual first.
    a[p][q] = a[q][p] = 0;
    for (const row of [0, 1, 2]) {
      const vp = vectors[row][p], vq = vectors[row][q];
      vectors[row][p] = finite(product(cosine, vp) - product(sine, vq));
      vectors[row][q] = sum([product(sine, vp), product(cosine, vq)]);
    }
    const similarityResidualScaled = residual(similarity(original, vectors), a), similarityGuardScaled = roundingGuard(rotationTrace.length + 1);
    check(similarityResidualScaled <= similarityGuardScaled, CODE.REPRESENTABILITY, 'Actual accumulated Jacobi similarity residual exceeded its rounding guard');
    rotationTrace.push({ index: rotationTrace.length, pivot, pivotValueScaled: b, diagonalBeforeScaled: [av, d], thetaRadians, sine, cosine,
      rawAnnihilationResidualScaled, annihilationGuardScaled, remainingOffDiagonalNormScaled: offDiagonal(a), similarityResidualScaled,
      similarityGuardScaled, matrixBeforeScaled, matrixAfterScaled: copyCadData(a), eigenvectorsAfter: copyCadData(vectors) });
  }
  const order = [0, 1, 2].sort((left, right) => a[left][left] - a[right][right] || left - right);
  const eigenvalues = order.map(index => a[index][index]) as Point;
  const sortedVectors = matrix((row, column) => vectors[row][order[column]]);
  for (const column of [0, 1]) {
    let dominant = 0;
    for (const row of [1, 2]) if (Math.abs(sortedVectors[row][column]) > Math.abs(sortedVectors[dominant][column])) dominant = row;
    if (sortedVectors[dominant][column] < 0) for (const row of [0, 1, 2]) sortedVectors[row][column] = -sortedVectors[row][column];
  }
  if (determinant(sortedVectors) < 0) for (const row of [0, 1, 2]) sortedVectors[row][2] = -sortedVectors[row][2];
  // Canonical sign changes may create negative zero; only exact zero axis components use positive zero.
  for (const row of [0, 1, 2]) for (const column of [0, 1, 2]) if (sortedVectors[row][column] === 0) sortedVectors[row][column] = 0;
  const diagonal = matrix((row, column) => row === column ? eigenvalues[row] : 0);
  const finalOffDiagonal = offDiagonal(a), scaledGuard = sum([product(Math.SQRT2, options.scaledResidualTolerance), roundingGuard(rotationTrace.length)]);
  check(eigenvalues.every(value => value > scaledGuard), CODE.REPRESENTABILITY, 'A principal moment is nonpositive or uncertainty overlaps zero');
  const similarityScaled = residual(similarity(original, sortedVectors), diagonal);
  const eigensystemScaled = residual(multiply(original, sortedVectors), multiply(sortedVectors, diagonal));
  const reconstructionScaled = residual(multiply(multiply(sortedVectors, diagonal), transpose(sortedVectors)), original);
  const orthogonality = residual(multiply(transpose(sortedVectors), sortedVectors), identity());
  const maximumUnitNorm = Math.max(...[0, 1, 2].map(column => Math.abs(finite(Math.hypot(...sortedVectors.map(row => row[column])) - 1))));
  const orientation = determinant(sortedVectors), unitGuard = product(ROUNDING, rotationTrace.length + 1);
  check(similarityScaled <= scaledGuard && eigensystemScaled <= scaledGuard && reconstructionScaled <= scaledGuard,
    CODE.REPRESENTABILITY, 'Actual final similarity, eigenvector or reconstruction residual exceeded its disclosed scaled guard');
  check(orthogonality <= unitGuard && maximumUnitNorm <= unitGuard && Math.abs(finite(orientation - 1)) <= unitGuard,
    CODE.REPRESENTABILITY, 'Actual final eigenbasis unit, orthogonality or right-handed determinant residual exceeded its guard');
  const momentsKgM2 = eigenvalues.map(value => product(value, scale)) as Point;
  const axesXYZ = [0, 1, 2].map(index => ({ index, directionXYZ: sortedVectors.map(row => row[index]) as Point, momentKgM2: momentsKgM2[index] })) as Principal['axesXYZ'];
  const thresholdKgM2 = product(options.degeneracyToleranceRelative, scale), clusters: Cluster[] = [];
  let indices = [0];
  const emitCluster = () => {
    if (indices.length > 1) clusters.push({ indices, momentsKgM2: indices.map(index => momentsKgM2[index]),
      maximumAdjacentGapKgM2: Math.max(...indices.slice(1).map(index => finite(momentsKgM2[index] - momentsKgM2[index - 1]))), thresholdKgM2 });
  };
  for (const index of [1, 2]) {
    if (finite(momentsKgM2[index] - momentsKgM2[index - 1]) <= thresholdKgM2) indices.push(index);
    else { emitCluster(); indices = [index]; }
  }
  emitCluster();
  return { principal: { momentsKgM2, axesXYZ }, rotationTrace, finalOffDiagonal,
    residuals: { similarityScaled, eigensystemScaled, reconstructionScaled, orthogonality, maximumUnitNorm, determinant: orientation, scaledGuard, unitGuard }, clusters };
}

/** Principal moments and local representative world axes of an actual owned construction mass tensor. */
export function analyzeExtrusionConstructionPrincipalInertia(massInput: CoplanarFaceBooleanExtrusionMassResult,
  optionsInput: ExtrusionPrincipalInertiaOptions): ExtrusionPrincipalInertiaResult {
  const mass = snapshot(massInput, CODE.INPUT) as CoplanarFaceBooleanExtrusionMassResult;
  const data = record(snapshot(optionsInput, CODE.INPUT), ['maximumRotations', 'scaledResidualTolerance', 'degeneracyToleranceRelative']);
  check(typeof data.maximumRotations === 'number' && Number.isInteger(data.maximumRotations) && data.maximumRotations >= 0 && data.maximumRotations <= 64,
    CODE.BUDGET, 'An integer maximumRotations in0..64 is required');
  for (const [field, maximum] of [['scaledResidualTolerance', 1e-8], ['degeneracyToleranceRelative', 1e-6]] as const)
    check(typeof data[field] === 'number' && data[field] >= 256 * Number.EPSILON && data[field] <= maximum, CODE.INPUT, 'Finite principal-analysis tolerances within their declared bounds are required');
  const options = data as unknown as ExtrusionPrincipalInertiaOptions;
  try { validateCoplanarFaceBooleanExtrusionMass(mass); } catch (cause) {
    throw new ExtrusionPrincipalInertiaError(CODE.NATIVE, 'Actual complete construction mass validation failed', cause);
  }
  const tensor = mass.report.inertiaCentroidKgM2;
  let principal: Principal | null = null, normalizedMatrix: Matrix | null = null, matrixScaleKgM2 = 0;
  let rotationTrace: Rotation[] = [], residuals: Residuals | null = null, observedDegenerateClusters: Cluster[] = [], finalOffDiagonal = 0;
  if (!mass.report.empty) {
    check(Array.isArray(tensor) && tensor.length === 3 && tensor.every(row => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite)),
      CODE.INPUT, 'Actual mass must retain its finite3x3 inertia tensor');
    check(tensor.every((row, i) => row.every((value, j) => Object.is(value, tensor[j][i]))), CODE.REPRESENTABILITY, 'Actual inertia tensor must be exactly symmetric');
    matrixScaleKgM2 = Math.max(...tensor.flat().map(Math.abs));
    check(matrixScaleKgM2 > 0, CODE.REPRESENTABILITY, 'A positive finite original inertia matrix scale is required');
    normalizedMatrix = matrix((row, column) => quotient(tensor[row][column], matrixScaleKgM2));
    const analysis = analyzeTensor(normalizedMatrix, matrixScaleKgM2, options);
    principal = analysis.principal; rotationTrace = analysis.rotationTrace; residuals = analysis.residuals;
    observedDegenerateClusters = analysis.clusters; finalOffDiagonal = analysis.finalOffDiagonal;
  } else check(tensor === null && mass.report.centroidMM === null, CODE.INPUT, 'Empty mass must retain null tensor and centroid');
  const report: ExtrusionPrincipalInertiaReport = { schema: 'barocss-native-extrusion-principal-inertia', version: 0,
    evaluationId: mass.report.evaluationId, units: { moment: 'kg*m2', centroid: 'mm', direction: 'world-xyz-unit-vector' },
    sourceFrame: 'authored-xyz-no-axis-conversion', densityKgPerM3: mass.report.densityKgPerM3, massKG: mass.report.massKG, centroidMM: mass.report.centroidMM,
    empty: mass.report.empty, parentMassValidationCount: 1, matrixScaleKgM2, normalizedMatrix, options, rotationTrace, rotationCount: rotationTrace.length,
    convergence: { offDiagonalNormScaled: finalOffDiagonal, toleranceScaled: options.scaledResidualTolerance, converged: true },
    sortedMomentsKgM2: principal?.momentsKgM2 ?? null, axesXYZ: principal?.axesXYZ ?? null, residuals, observedDegenerateClusters,
    axesUnique: principal === null ? null : observedDegenerateClusters.length === 0,
    signPolicy: 'first-two-largest-absolute-component-positive-xyz-ties-third-right-handed',
    numericPolicy: { pivot: 'largest-absolute-offdiagonal-lexicographic-01-02-12', angle: 'half-atan2-2b-d-minus-a',
      annihilation: 'checked-raw-jacobi-pivot-residual-then-zero', residualNorm: 'frobenius', convergenceNorm: 'upper-offdiagonal-euclidean', roundingFactor: 512,
      clustering: 'connected-adjacent-gaps-within-relative-original-matrix-scale', axesMeaning: 'canonical-local-representatives-not-persistent-axes',
      axisZeroSign: 'positive-zero-only-for-exact-zero-components' },
    quality: { constructionEstimateOnly: true, densityCertified: false, materialCertified: false, solidCertified: false,
      globalAccuracyCertified: false, physicalConsumerCertified: false, symmetryCertified: false, ownership: 'independent-copied-cpu-data-gc' },
    workScope: 'one-actual-public-mass-validation-and-new-jacobi-rotations-parent-rebuild-work-excluded', budgetFailure: 'atomic-no-partial-eigensystem',
    limits: { maximumRotations: 64, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 } };
  return snapshot({ mass, options, principal, report }, CODE.BUDGET) as ExtrusionPrincipalInertiaResult;
}

/** Rebuild the actual public analysis once and bit-check all parent sources and numerical evidence. */
export function validateExtrusionConstructionPrincipalInertia(input: ExtrusionPrincipalInertiaResult): ExtrusionPrincipalInertiaReport {
  const owned = record(snapshot(input, CODE.OWNED), ['mass', 'options', 'principal', 'report'], CODE.OWNED) as unknown as ExtrusionPrincipalInertiaResult;
  let expected: ExtrusionPrincipalInertiaResult;
  try { expected = analyzeExtrusionConstructionPrincipalInertia(owned.mass, owned.options); } catch (cause) {
    throw new ExtrusionPrincipalInertiaError(CODE.OWNED, 'Whole owned principal-analysis rebuild failed', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'Owned mass, source, options, eigensystem, trace, signs, clusters or counter bits changed');
  return copyCadData(expected.report);
}
