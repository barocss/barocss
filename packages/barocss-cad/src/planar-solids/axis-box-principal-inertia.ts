import { validateAxisBoxSolidBooleanMass } from '../axis-box-solid-mass.js';
import type { AxisBoxSolidMassResult, AxisBoxSolidMassMeasure } from '../axis-box-solid-mass.js';
import { copyCadData } from '../data-copy.js';
import type { Point } from '../types.js';
import { same } from '../core/structural-equality.js';

export const AxisBoxSolidPrincipalInertiaDiagnosticCode = Object.freeze({ INPUT: 'INPUT', BUDGET: 'BUDGET', MASS: 'MASS', SELECTION: 'SELECTION', REPRESENTABILITY: 'REPRESENTABILITY', OWNED: 'OWNED' } as const);
export type AxisBoxSolidPrincipalInertiaDiagnosticCode = typeof AxisBoxSolidPrincipalInertiaDiagnosticCode[keyof typeof AxisBoxSolidPrincipalInertiaDiagnosticCode];
export class AxisBoxSolidPrincipalInertiaError extends Error {
  readonly code: AxisBoxSolidPrincipalInertiaDiagnosticCode;
  constructor(code: AxisBoxSolidPrincipalInertiaDiagnosticCode, detail: string, cause?: unknown) {
    super(('Axis-box Solid principal inertia: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'AxisBoxSolidPrincipalInertiaError'; this.code = code;
  }
}
export type AxisBoxSolidPrincipalInertiaSelection = { kind: 'total' } | { kind: 'body'; bodyId: string };
export interface AxisBoxSolidPrincipalInertiaOptions { selection: AxisBoxSolidPrincipalInertiaSelection; maximumRotations: number; scaledResidualTolerance: number; degeneracyToleranceRelative: number }
type Matrix = [Point, Point, Point];
type Axis = { index: number; directionXYZ: Point; momentKgM2: number };
type Principal = { momentsKgM2: Point; axesXYZ: [Axis, Axis, Axis] };
type Rotation = { index: number; pivot: [number, number]; pivotValueScaled: number; diagonalBeforeScaled: [number, number]; thetaRadians: number; sine: number; cosine: number;
  rawAnnihilationResidualScaled: number; annihilationGuardScaled: number; remainingOffDiagonalNormScaled: number; similarityResidualScaled: number; similarityGuardScaled: number; matrixBeforeScaled: Matrix; matrixAfterScaled: Matrix; eigenvectorsAfter: Matrix };
type Cluster = { indices: number[]; momentsKgM2: number[]; maximumAdjacentGapKgM2: number; thresholdKgM2: number };
type Residuals = { similarityScaled: number; eigensystemScaled: number; reconstructionScaled: number; orthogonality: number; maximumUnitNorm: number; determinant: number; scaledGuard: number; unitGuard: number };
export interface AxisBoxSolidPrincipalInertiaReport {
  schema: 'barocss-axis-box-solid-principal-inertia'; version: 0; evaluationId: string; selection: AxisBoxSolidPrincipalInertiaSelection; selectedBodyId: string | null;
  units: { moment: 'kg*m2'; centroid: 'mm'; direction: 'world-xyz-unit-vector' }; sourceFrame: 'authored-xyz-no-axis-conversion'; densityKgPerM3: number; massKG: number; centroidMM: Point | null; empty: boolean;
  storedTensorAuthority: 'only-selected-stored-binary64-tensor-parent-exact-moments-and-errors-separate'; inputTensorKgM2: Matrix | null; matrixScaleKgM2: number; normalizedMatrix: Matrix | null;
  options: AxisBoxSolidPrincipalInertiaOptions; rotationTrace: Rotation[]; rotationCount: number; convergence: { offDiagonalNormScaled: number; toleranceScaled: number; converged: true };
  sortedMomentsKgM2: Point | null; axesXYZ: Principal['axesXYZ'] | null; residuals: Residuals | null; observedDegenerateClusters: Cluster[]; axesUnique: boolean | null;
  signPolicy: 'first-two-largest-absolute-component-positive-xyz-ties-third-right-handed';
  directCounts: { massValidationCount: 1; selectedMeasureBindingCount: 1; rotationCount: number; curvePointEvaluationCount: 0; curveDerivativeEvaluationCount: 0; surfacePointEvaluationCount: 0; surfaceDerivativeEvaluationCount: 0; sourceCompilationCount: 0 };
  numericPolicy: { pivot: 'largest-absolute-offdiagonal-lexicographic-01-02-12'; angle: 'half-atan2-2b-d-minus-a'; annihilation: 'checked-raw-jacobi-pivot-residual-then-zero'; residualNorm: 'frobenius'; convergenceNorm: 'upper-offdiagonal-euclidean'; roundingFactor: 512;
    clustering: 'connected-adjacent-gaps-within-relative-original-matrix-scale'; axesMeaning: 'canonical-local-representatives-not-persistent-axes'; axisZeroSign: 'positive-zero-only-for-exact-zero-components'; guards: 'observed-normalized-rounding-residual-policy-not-rigorous-global-error-bounds'; uniqueness: 'observed-cluster-status-not-certified-geometry-axis-uniqueness' };
  quality: { storedTensorAnalysisOnly: true; exactGeometryEigenvaluesCertified: false; exactGeometryAxesCertified: false; globalFloatingEigenanalysisCertified: false; axesUniquenessCertified: false; persistentAxesCertified: false; densityCertified: false; materialCertified: false; manufacturingToleranceCertified: false; physicalPoseConversionCertified: false; parentExactAndConversionProofUnchanged: true; ownership: 'independent-copied-cpu-data-gc' };
  workScope: 'one-actual-public-solid-mass-validation-and-new-jacobi-rotations-parent-rebuild-work-excluded'; budgetFailure: 'atomic-no-partial-eigensystem';
  limits: { maximumRotations: 64; ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; stringCharacters: 262144 };
}
export interface AxisBoxSolidPrincipalInertiaResult { mass: AxisBoxSolidMassResult; options: AxisBoxSolidPrincipalInertiaOptions; measure: AxisBoxSolidMassMeasure; principal: Principal | null; report: AxisBoxSolidPrincipalInertiaReport }

const CODE = AxisBoxSolidPrincipalInertiaDiagnosticCode, ROUNDING = 512 * Number.EPSILON;
function check(condition: boolean, code: AxisBoxSolidPrincipalInertiaDiagnosticCode, detail: string): asserts condition { if (!condition) throw new AxisBoxSolidPrincipalInertiaError(code, detail); }
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'Finite principal-inertia arithmetic range exceeded'); return value; }
function product(a: number, b: number): number { const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'Nonzero principal-inertia product underflowed'); return value; }
function quotient(a: number, b: number): number { check(Number.isFinite(b) && b !== 0, CODE.REPRESENTABILITY, 'A finite nonzero moment denominator is required'); const value = finite(a / b); check(a === 0 || value !== 0, CODE.REPRESENTABILITY, 'Nonzero principal-inertia quotient underflowed'); return value; }
function sum(values: number[]): number { return values.reduce((total, value) => finite(total + value), 0); }
function matrix(value: (row: number, column: number) => number): Matrix { return [0, 1, 2].map(row => [0, 1, 2].map(column => finite(value(row, column))) as Point) as Matrix; }
function identity(): Matrix { return matrix((row, column) => row === column ? 1 : 0); }
function transpose(a: Matrix): Matrix { return matrix((row, column) => a[column][row]); }
function multiply(a: Matrix, b: Matrix): Matrix { return matrix((row, column) => sum([0, 1, 2].map(index => product(a[row][index], b[index][column])))); }
function norm(a: Matrix): number { return finite(Math.hypot(...a.flat())); }
function residual(a: Matrix, b: Matrix): number { return norm(matrix((row, column) => finite(a[row][column] - b[row][column]))); }
function similarity(a: Matrix, vectors: Matrix): Matrix { return multiply(multiply(transpose(vectors), a), vectors); }
function offDiagonal(a: Matrix): number { return finite(Math.hypot(a[0][1], a[0][2], a[1][2])); }
function determinant(a: Matrix): number { return sum([product(a[0][0], finite(product(a[1][1], a[2][2]) - product(a[1][2], a[2][1]))), -product(a[0][1], finite(product(a[1][0], a[2][2]) - product(a[1][2], a[2][0]))), product(a[0][2], finite(product(a[1][0], a[2][1]) - product(a[1][1], a[2][0])))]); }
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, owned ? CODE.OWNED : CODE.BUDGET, 'Own value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, owned ? CODE.OWNED : CODE.BUDGET, 'Own string budget exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
    check(keys.length <= (array ? 8193 : 64) && keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Bounded fields without getters/symbols/hidden data are required');
    ancestors.add(value); let result: unknown;
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded own arrays are required'); result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse/extra own array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); }); }
    else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)])); ancestors.delete(value); return result;
  }; try { return copy(input, 0); } catch (cause) { if (cause instanceof AxisBoxSolidPrincipalInertiaError) throw cause; throw new AxisBoxSolidPrincipalInertiaError(code, 'Own snapshot failed', cause); }
}
function record(input: unknown, fields: string[], code: AxisBoxSolidPrincipalInertiaDiagnosticCode = CODE.INPUT): Record<string, unknown> { check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required'); const data = input as Record<string, unknown>; check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data; }

/** Local static adaptation of the established bounded Jacobi method; no prism DTO or constructor is used. */
function analyzeTensor(original: Matrix, scale: number, options: AxisBoxSolidPrincipalInertiaOptions): { principal: Principal; rotationTrace: Rotation[]; residuals: Residuals; clusters: Cluster[]; finalOffDiagonal: number } {
  const a = copyCadData(original), vectors = identity(), rotationTrace: Rotation[] = [], originalNorm = Math.max(1, norm(original));
  const roundingGuard = (rotations: number) => product(product(ROUNDING, rotations + 1), originalNorm);
  while (offDiagonal(a) > options.scaledResidualTolerance) {
    check(rotationTrace.length < options.maximumRotations, CODE.BUDGET, 'Jacobi rotation budget exhausted before actual scaled convergence');
    const pairs: [number, number][] = [[0, 1], [0, 2], [1, 2]]; let pivot = pairs[0];
    for (const pair of pairs.slice(1)) if (Math.abs(a[pair[0]][pair[1]]) > Math.abs(a[pivot[0]][pivot[1]])) pivot = pair;
    const [p, q] = pivot, av = a[p][p], b = a[p][q], d = a[q][q], matrixBeforeScaled = copyCadData(a);
    check(b !== 0, CODE.REPRESENTABILITY, 'A nonzero Jacobi pivot is required');
    const thetaRadians = product(.5, finite(Math.atan2(product(2, b), finite(d - av)))), sine = finite(Math.sin(thetaRadians)), cosine = finite(Math.cos(thetaRadians));
    const cc = product(cosine, cosine), ss = product(sine, sine), cs = product(cosine, sine);
    check(Math.abs(finite(cc + ss - 1)) <= ROUNDING, CODE.REPRESENTABILITY, 'Jacobi sine/cosine unit residual exceeded its rounding guard');
    const rawAnnihilationResidualScaled = sum([product(finite(av - d), cs), product(b, finite(cc - ss))]), annihilationGuardScaled = product(ROUNDING, Math.max(1, Math.abs(av), Math.abs(b), Math.abs(d)));
    check(Math.abs(rawAnnihilationResidualScaled) <= annihilationGuardScaled, CODE.REPRESENTABILITY, 'Raw computed Jacobi annihilation residual exceeded its disclosed guard');
    a[p][p] = sum([product(cc, av), -product(2, product(cs, b)), product(ss, d)]); a[q][q] = sum([product(ss, av), product(2, product(cs, b)), product(cc, d)]);
    for (const index of [0, 1, 2]) if (index !== p && index !== q) {
      const ap = matrixBeforeScaled[index][p], aq = matrixBeforeScaled[index][q]; a[index][p] = a[p][index] = finite(product(cosine, ap) - product(sine, aq)); a[index][q] = a[q][index] = sum([product(sine, ap), product(cosine, aq)]);
    }
    // Retain the raw computed annihilation witness before setting the pivot to zero.
    a[p][q] = a[q][p] = 0;
    for (const row of [0, 1, 2]) { const vp = vectors[row][p], vq = vectors[row][q]; vectors[row][p] = finite(product(cosine, vp) - product(sine, vq)); vectors[row][q] = sum([product(sine, vp), product(cosine, vq)]); }
    const similarityResidualScaled = residual(similarity(original, vectors), a), similarityGuardScaled = roundingGuard(rotationTrace.length + 1);
    check(similarityResidualScaled <= similarityGuardScaled, CODE.REPRESENTABILITY, 'Actual accumulated Jacobi similarity residual exceeded its rounding guard');
    rotationTrace.push({ index: rotationTrace.length, pivot, pivotValueScaled: b, diagonalBeforeScaled: [av, d], thetaRadians, sine, cosine, rawAnnihilationResidualScaled, annihilationGuardScaled,
      remainingOffDiagonalNormScaled: offDiagonal(a), similarityResidualScaled, similarityGuardScaled, matrixBeforeScaled, matrixAfterScaled: copyCadData(a), eigenvectorsAfter: copyCadData(vectors) });
  }
  const order = [0, 1, 2].sort((left, right) => a[left][left] - a[right][right] || left - right), eigenvalues = order.map(index => a[index][index]) as Point, sortedVectors = matrix((row, column) => vectors[row][order[column]]);
  for (const column of [0, 1]) {
    let dominant = 0; for (const row of [1, 2]) if (Math.abs(sortedVectors[row][column]) > Math.abs(sortedVectors[dominant][column])) dominant = row;
    if (sortedVectors[dominant][column] < 0) for (const row of [0, 1, 2]) sortedVectors[row][column] = -sortedVectors[row][column];
  }
  if (determinant(sortedVectors) < 0) for (const row of [0, 1, 2]) sortedVectors[row][2] = -sortedVectors[row][2];
  for (const row of [0, 1, 2]) for (const column of [0, 1, 2]) if (sortedVectors[row][column] === 0) sortedVectors[row][column] = 0;
  const diagonal = matrix((row, column) => row === column ? eigenvalues[row] : 0), finalOffDiagonal = offDiagonal(a), scaledGuard = sum([product(Math.SQRT2, options.scaledResidualTolerance), roundingGuard(rotationTrace.length)]);
  check(eigenvalues.every(value => value > scaledGuard), CODE.REPRESENTABILITY, 'A principal moment is nonpositive or numerical uncertainty overlaps zero');
  const similarityScaled = residual(similarity(original, sortedVectors), diagonal), eigensystemScaled = residual(multiply(original, sortedVectors), multiply(sortedVectors, diagonal)), reconstructionScaled = residual(multiply(multiply(sortedVectors, diagonal), transpose(sortedVectors)), original);
  const orthogonality = residual(multiply(transpose(sortedVectors), sortedVectors), identity()), maximumUnitNorm = Math.max(...[0, 1, 2].map(column => Math.abs(finite(Math.hypot(...sortedVectors.map(row => row[column])) - 1)))), orientation = determinant(sortedVectors), unitGuard = product(ROUNDING, rotationTrace.length + 1);
  check(similarityScaled <= scaledGuard && eigensystemScaled <= scaledGuard && reconstructionScaled <= scaledGuard, CODE.REPRESENTABILITY, 'Actual final similarity/eigenvector/reconstruction residual exceeded its disclosed guard');
  check(orthogonality <= unitGuard && maximumUnitNorm <= unitGuard && Math.abs(finite(orientation - 1)) <= unitGuard, CODE.REPRESENTABILITY, 'Actual final eigenbasis unit/orthogonality/right-handed determinant residual exceeded its guard');
  const momentsKgM2 = eigenvalues.map(value => product(value, scale)) as Point, axesXYZ = [0, 1, 2].map(index => ({ index, directionXYZ: sortedVectors.map(row => row[index]) as Point, momentKgM2: momentsKgM2[index] })) as Principal['axesXYZ'];
  const thresholdKgM2 = product(options.degeneracyToleranceRelative, scale), clusters: Cluster[] = []; let indices = [0];
  const emitCluster = () => { if (indices.length > 1) clusters.push({ indices, momentsKgM2: indices.map(index => momentsKgM2[index]), maximumAdjacentGapKgM2: Math.max(...indices.slice(1).map(index => finite(momentsKgM2[index] - momentsKgM2[index - 1]))), thresholdKgM2 }); };
  for (const index of [1, 2]) { if (finite(momentsKgM2[index] - momentsKgM2[index - 1]) <= thresholdKgM2) indices.push(index); else { emitCluster(); indices = [index]; } } emitCluster();
  return { principal: { momentsKgM2, axesXYZ }, rotationTrace, finalOffDiagonal, residuals: { similarityScaled, eigensystemScaled, reconstructionScaled, orthogonality, maximumUnitNorm, determinant: orientation, scaledGuard, unitGuard }, clusters };
}

/** Analyze one actual total/Body STORED tensor; exact parent moment/conversion certificates remain separate and unchanged. */
export function analyzeAxisBoxSolidPrincipalInertia(massInput: AxisBoxSolidMassResult, optionsInput: AxisBoxSolidPrincipalInertiaOptions): AxisBoxSolidPrincipalInertiaResult {
  const input = record(snapshot({ mass: massInput, options: optionsInput }), ['mass', 'options']), data = record(input.options, ['selection', 'maximumRotations', 'scaledResidualTolerance', 'degeneracyToleranceRelative']);
  check(typeof data.maximumRotations === 'number' && Number.isInteger(data.maximumRotations) && data.maximumRotations >= 0 && data.maximumRotations <= 64, CODE.BUDGET, 'An integer maximumRotations in0..64 is required');
  for (const [field, maximum] of [['scaledResidualTolerance', 1e-8], ['degeneracyToleranceRelative', 1e-6]] as const) check(typeof data[field] === 'number' && data[field] >= 256 * Number.EPSILON && data[field] <= maximum, CODE.INPUT, 'Finite analysis tolerances within the declared bounds are required');
  check(data.selection !== null && typeof data.selection === 'object' && !Array.isArray(data.selection), CODE.SELECTION, 'An exact total/Body selection is required'); const selected = data.selection as Record<string, unknown>;
  check(selected.kind === 'total' || selected.kind === 'body', CODE.SELECTION, 'Selection kind must be total or body'); record(selected, selected.kind === 'total' ? ['kind'] : ['kind', 'bodyId'], CODE.SELECTION);
  if (selected.kind === 'body') check(typeof selected.bodyId === 'string' && selected.bodyId.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(selected.bodyId), CODE.SELECTION, 'Selected Body ID must be ASCII1..48');
  const options = data as unknown as AxisBoxSolidPrincipalInertiaOptions, mass = input.mass as AxisBoxSolidMassResult;
  try { validateAxisBoxSolidBooleanMass(mass); } catch (cause) { throw new AxisBoxSolidPrincipalInertiaError(CODE.MASS, 'Actual whole Solid mass owned validation failed', cause); }
  const selectedBodyId = options.selection.kind === 'body' ? options.selection.bodyId : null;
  const measure = selectedBodyId === null ? mass.total : mass.bodies.find(body => body.bodyId === selectedBodyId);
  check(measure !== undefined, CODE.SELECTION, 'The selected Body must exist in the complete actual mass result');
  const tensor = measure.inertiaCentroidKgM2, empty = measure.volumeMM3 === 0; let principal: Principal | null = null, normalizedMatrix: Matrix | null = null, matrixScaleKgM2 = 0;
  let rotationTrace: Rotation[] = [], residuals: Residuals | null = null, observedDegenerateClusters: Cluster[] = [], finalOffDiagonal = 0;
  if (!empty) {
    check(Array.isArray(tensor) && tensor.length === 3 && tensor.every(row => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite)), CODE.REPRESENTABILITY, 'Actual selected mass must retain its finite3x3 stored inertia tensor');
    check(tensor.every((row, i) => row.every((value, j) => Object.is(value, tensor[j][i]))), CODE.REPRESENTABILITY, 'Actual selected stored tensor must be bitwise symmetric');
    matrixScaleKgM2 = Math.max(...tensor.flat().map(Math.abs)); check(matrixScaleKgM2 > 0, CODE.REPRESENTABILITY, 'A positive finite selected stored tensor scale is required');
    normalizedMatrix = matrix((row, column) => quotient(tensor[row][column], matrixScaleKgM2)); const analysis = analyzeTensor(normalizedMatrix, matrixScaleKgM2, options);
    principal = analysis.principal; rotationTrace = analysis.rotationTrace; residuals = analysis.residuals; observedDegenerateClusters = analysis.clusters; finalOffDiagonal = analysis.finalOffDiagonal;
  } else check(tensor === null && measure.centroidMM === null && measure.massKG === 0, CODE.SELECTION, 'Empty total must retain mass0/nullcentroid/nulltensor and no axes');
  const report: AxisBoxSolidPrincipalInertiaReport = {
    schema: 'barocss-axis-box-solid-principal-inertia', version: 0, evaluationId: mass.report.evaluationId, selection: options.selection, selectedBodyId: measure.bodyId, units: { moment: 'kg*m2', centroid: 'mm', direction: 'world-xyz-unit-vector' }, sourceFrame: 'authored-xyz-no-axis-conversion', densityKgPerM3: mass.options.densityKgPerM3, massKG: measure.massKG, centroidMM: measure.centroidMM, empty,
    storedTensorAuthority: 'only-selected-stored-binary64-tensor-parent-exact-moments-and-errors-separate', inputTensorKgM2: tensor, matrixScaleKgM2, normalizedMatrix, options, rotationTrace, rotationCount: rotationTrace.length, convergence: { offDiagonalNormScaled: finalOffDiagonal, toleranceScaled: options.scaledResidualTolerance, converged: true },
    sortedMomentsKgM2: principal?.momentsKgM2 ?? null, axesXYZ: principal?.axesXYZ ?? null, residuals, observedDegenerateClusters, axesUnique: principal === null ? null : observedDegenerateClusters.length === 0,
    signPolicy: 'first-two-largest-absolute-component-positive-xyz-ties-third-right-handed', directCounts: { massValidationCount: 1, selectedMeasureBindingCount: 1, rotationCount: rotationTrace.length, curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0, surfacePointEvaluationCount: 0, surfaceDerivativeEvaluationCount: 0, sourceCompilationCount: 0 },
    numericPolicy: { pivot: 'largest-absolute-offdiagonal-lexicographic-01-02-12', angle: 'half-atan2-2b-d-minus-a', annihilation: 'checked-raw-jacobi-pivot-residual-then-zero', residualNorm: 'frobenius', convergenceNorm: 'upper-offdiagonal-euclidean', roundingFactor: 512, clustering: 'connected-adjacent-gaps-within-relative-original-matrix-scale', axesMeaning: 'canonical-local-representatives-not-persistent-axes', axisZeroSign: 'positive-zero-only-for-exact-zero-components', guards: 'observed-normalized-rounding-residual-policy-not-rigorous-global-error-bounds', uniqueness: 'observed-cluster-status-not-certified-geometry-axis-uniqueness' },
    quality: { storedTensorAnalysisOnly: true, exactGeometryEigenvaluesCertified: false, exactGeometryAxesCertified: false, globalFloatingEigenanalysisCertified: false, axesUniquenessCertified: false, persistentAxesCertified: false, densityCertified: false, materialCertified: false, manufacturingToleranceCertified: false, physicalPoseConversionCertified: false, parentExactAndConversionProofUnchanged: true, ownership: 'independent-copied-cpu-data-gc' },
    workScope: 'one-actual-public-solid-mass-validation-and-new-jacobi-rotations-parent-rebuild-work-excluded', budgetFailure: 'atomic-no-partial-eigensystem', limits: { maximumRotations: 64, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, stringCharacters: 262144 },
  };
  return snapshot({ mass, options, measure, principal, report }, true) as AxisBoxSolidPrincipalInertiaResult;
}

/** Re-run the complete actual parent binding and stored-tensor analysis, then compare all sources/proofs/numeric trace bits. */
export function validateAxisBoxSolidPrincipalInertia(input: AxisBoxSolidPrincipalInertiaResult): AxisBoxSolidPrincipalInertiaReport {
  const owned = record(snapshot(input, true), ['mass', 'options', 'measure', 'principal', 'report'], CODE.OWNED) as unknown as AxisBoxSolidPrincipalInertiaResult;
  let expected: AxisBoxSolidPrincipalInertiaResult;
  try { expected = analyzeAxisBoxSolidPrincipalInertia(owned.mass, owned.options); } catch (cause) { throw new AxisBoxSolidPrincipalInertiaError(CODE.OWNED, 'Whole owned Solid principal-inertia reconstruction failed', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned mass/selection/measure/options/trace/eigensystem/signs/clusters/counters changed'); return snapshot(expected.report, true) as AxisBoxSolidPrincipalInertiaReport;
}
