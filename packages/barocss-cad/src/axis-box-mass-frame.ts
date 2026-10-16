import { validateAxisBoxSolidBooleanMass } from './axis-box-solid-mass.js';
import type { AxisBoxSolidMassResult, AxisBoxSolidMassMeasure } from './axis-box-solid-mass.js';
import type { CadAssemblyMatrix } from './cad-assembly.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionRational, SectionFraction } from './section-rational-internal.js';
import type { Point } from './types.js';
import { same } from './structural-equality.js';

export const AxisBoxSolidMassFrameDiagnosticCode = Object.freeze({ INPUT: 'INPUT', BUDGET: 'BUDGET', MASS: 'MASS', SELECTION: 'SELECTION', POSE: 'POSE', REPRESENTABILITY: 'REPRESENTABILITY', OWNED: 'OWNED' } as const);
export type AxisBoxSolidMassFrameDiagnosticCode = typeof AxisBoxSolidMassFrameDiagnosticCode[keyof typeof AxisBoxSolidMassFrameDiagnosticCode];
export class AxisBoxSolidMassFrameError extends Error {
  readonly code: AxisBoxSolidMassFrameDiagnosticCode;
  constructor(code: AxisBoxSolidMassFrameDiagnosticCode, detail: string, cause?: unknown) {
    super(('Axis-box Solid mass frame: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'AxisBoxSolidMassFrameError'; this.code = code;
  }
}
type Selection = { kind: 'total' } | { kind: 'body'; bodyId: string };
export interface AxisBoxSolidMassFramePose { frameId: string; matrix: CadAssemblyMatrix }
export interface AxisBoxSolidMassFrameOptions { selection: Selection; pose: AxisBoxSolidMassFramePose; maximumConversions: number }
type Matrix = [Point, Point, Point];
type FractionVector = [SectionFraction, SectionFraction, SectionFraction];
type FractionMatrix = [FractionVector, FractionVector, FractionVector];
type ErrorBound = { exact: SectionFraction; upper: number };
type ErrorVector = [ErrorBound, ErrorBound, ErrorBound];
type ErrorMatrix = [ErrorVector, ErrorVector, ErrorVector];
type PD = { exactLeadingMinors: FractionVector; storedLeadingMinors: FractionVector };
type Posed = { bodyId: string | null; volumeMM3: number; massKG: number; centroidMM: Point | null; inertiaCentroidKgM2: Matrix | null; inertiaOriginKgM2: Matrix | null;
  exact: { massKG: SectionFraction; centroidMM: FractionVector | null; inertiaCentroidKgM2: FractionMatrix | null; inertiaOriginKgM2: FractionMatrix | null };
  conversionErrors: { massKG: ErrorBound; centroidMM: ErrorVector | null; inertiaCentroidKgM2: ErrorMatrix | null; inertiaOriginKgM2: ErrorMatrix | null };
  positiveDefinite: { centroid: PD; origin: PD } | null };
type AxisMap = { sourceAxis: number; sign: 1 | -1 };
type Proof = { rotationRows: Matrix; axisMap: [AxisMap, AxisMap, AxisMap]; determinant: 1; translationExactMM: FractionVector; squareMillimetresPerSquareMetre: 1000000 };
export interface AxisBoxSolidMassFrameReport {
  schema: 'barocss-axis-box-solid-mass-frame'; version: 0; evaluationId: string; sourceFrame: 'authored-xyz-no-axis-conversion'; targetFrame: string; selectedBodyId: string | null; empty: boolean;
  units: { mass: 'kg'; centroid: 'mm'; inertia: 'kg*m2'; volume: 'mm3' }; options: AxisBoxSolidMassFrameOptions;
  directCounts: { massValidationCount: 1; selectedMeasureBindingCount: 1; finalValueConversionCount: number; upwardErrorConversionCount: number; curvePointEvaluationCount: 0; curveDerivativeEvaluationCount: 0; surfacePointEvaluationCount: 0; surfaceDerivativeEvaluationCount: 0; sourceCompilationCount: 0 };
  rationalCounts: ReturnType<SectionRationalContext['counts']>;
  numericPolicy: { authority: 'exact-parent-canonical-fractions-not-stored-parent-approximations'; rotation: 'proper-signed-permutation-exact-axis-and-sign-selection'; siConversion: 'exact-integer-square-millimetres-per-square-metre-divisor'; output: 'nearest-even-final-values-only-symmetric-upper-triangle-mirrored'; errors: 'exact-absolute-conversion-error-and-least-upward-binary64'; positiveDefinite: 'exact-and-stored-leading-principal-minors-for-both-tensors'; generatedExactZero: 'positive-zero'; nonzeroUnderflow: 'refused'; empty: 'zero-mass-null-centroid-and-tensors-no-pd-claim' };
  quality: { exactSignedAxisFramePropertiesCertified: true; nonemptyExactAndStoredTensorsPositiveDefinite: boolean; parentExactAndConversionProofUnchanged: true; arbitraryAngleRotationCertified: false; wholeSolidAssemblyBindingCertified: false; geometryPoseBaked: false; densityCertified: false; materialCertified: false; manufacturingToleranceCertified: false; globalBinary64GeometryEvaluationErrorCertified: false; ownership: 'independent-copied-cpu-data-gc' };
  limits: { maximumFinalFloatConversions: 32; maximumFloatSearchSteps: 2048; maximumTranslationMM: 1000000; maximumCentroidComponentMM: 10000000; rationalOperations: 200000; gcdSteps: 200000; rationalIntegerBits: 8192; fractionIntegerCharacters: 5000; floatSearchStepsPerConversion: 64; ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; stringCharacters: 262144 };
  workScope: 'direct-parent-owned-validation-and-new-exact-frame-arithmetic-parent-internal-work-excluded'; budgetFailure: 'atomic-no-partial-frame-properties';
}
export interface AxisBoxSolidMassFrameResult { mass: AxisBoxSolidMassResult; options: AxisBoxSolidMassFrameOptions; measure: AxisBoxSolidMassMeasure; posed: Posed; proof: Proof; report: AxisBoxSolidMassFrameReport }

const CODE = AxisBoxSolidMassFrameDiagnosticCode;
function check(condition: boolean, code: AxisBoxSolidMassFrameDiagnosticCode, detail: string): asserts condition { if (!condition) throw new AxisBoxSolidMassFrameError(code, detail); }
function record(input: unknown, fields: string[], code: AxisBoxSolidMassFrameDiagnosticCode = CODE.INPUT): Record<string, unknown> { check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required'); const data = input as Record<string, unknown>; check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data; }
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
  }; try { return copy(input, 0); } catch (cause) { if (cause instanceof AxisBoxSolidMassFrameError) throw cause; throw new AxisBoxSolidMassFrameError(code, 'Own snapshot failed', cause); }
}

/** Exact signed-axis rigid-frame mass properties, without baking geometry or inferring an assembly binding. */
export function transformAxisBoxSolidMassFrame(massInput: AxisBoxSolidMassResult, optionsInput: AxisBoxSolidMassFrameOptions): AxisBoxSolidMassFrameResult {
  const input = record(snapshot({ mass: massInput, options: optionsInput }), ['mass', 'options']), settings = record(input.options, ['selection', 'pose', 'maximumConversions']);
  check(settings.maximumConversions === 32, CODE.BUDGET, 'The complete fixed32 conversion limit is required before parent calls');
  check(settings.selection !== null && typeof settings.selection === 'object' && !Array.isArray(settings.selection), CODE.SELECTION, 'An exact total/Body selection is required'); const selection = settings.selection as Record<string, unknown>;
  check(selection.kind === 'total' || selection.kind === 'body', CODE.SELECTION, 'Selection kind must be total or body'); record(selection, selection.kind === 'total' ? ['kind'] : ['kind', 'bodyId'], CODE.SELECTION);
  if (selection.kind === 'body') check(typeof selection.bodyId === 'string' && selection.bodyId.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(selection.bodyId), CODE.SELECTION, 'Selected Body ID must be ASCII1..48');
  const pose = record(settings.pose, ['frameId', 'matrix'], CODE.POSE); check(typeof pose.frameId === 'string' && pose.frameId.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(pose.frameId), CODE.POSE, 'An independent coordinate-frame ASCII label1..48 is required');
  check(Array.isArray(pose.matrix) && pose.matrix.length === 16 && pose.matrix.every(value => typeof value === 'number' && Number.isFinite(value)), CODE.POSE, 'An own finite row-major4x4 column-vector matrix is required'); const m = pose.matrix as CadAssemblyMatrix;
  check(m[12] === 0 && m[13] === 0 && m[14] === 0 && m[15] === 1, CODE.POSE, 'The original numeric homogeneous last row must be0/0/0/1');
  const rotationRows = [0, 1, 2].map(row => [m[4 * row], m[4 * row + 1], m[4 * row + 2]]) as Matrix;
  check(rotationRows.every(row => row.every(value => value === -1 || value === 0 || value === 1) && row.filter(value => value !== 0).length === 1) && [0, 1, 2].every(column => rotationRows.filter(row => row[column] !== 0).length === 1), CODE.POSE, 'Only exact signed permutations with one nonzero per row/column are supported');
  const r = rotationRows, determinant = r[0][0] * (r[1][1] * r[2][2] - r[1][2] * r[2][1]) - r[0][1] * (r[1][0] * r[2][2] - r[1][2] * r[2][0]) + r[0][2] * (r[1][0] * r[2][1] - r[1][1] * r[2][0]);
  check(determinant === 1, CODE.POSE, 'Only proper determinant+1 signed rotations are admitted');
  const translation = [m[3], m[7], m[11]]; check(translation.every(value => Number.isSafeInteger(value) && Math.abs(value) <= 1e6), CODE.POSE, 'Translation must be safe integer millimetres within1e6');
  const axisMap = r.map(row => { const sourceAxis = row.findIndex(value => value !== 0); return { sourceAxis, sign: row[sourceAxis] as 1 | -1 }; }) as [AxisMap, AxisMap, AxisMap];
  const options = settings as unknown as AxisBoxSolidMassFrameOptions, mass = input.mass as AxisBoxSolidMassResult;
  try { validateAxisBoxSolidBooleanMass(mass); } catch (cause) { throw new AxisBoxSolidMassFrameError(CODE.MASS, 'Actual complete Solid mass owned validation refused', cause); }
  const bodyId = options.selection.kind === 'body' ? options.selection.bodyId : null, measure = bodyId === null ? mass.total : mass.bodies.find(value => value.bodyId === bodyId);
  check(measure !== undefined, CODE.SELECTION, 'The selected actual Body must exist; an empty total has no Body selection');
  const q = new SectionRationalContext((kind, detail) => { throw new AxisBoxSolidMassFrameError(CODE[kind], detail); }), zero = q.integer(0), read = (value: SectionFraction) => q.rat(BigInt(value.numerator), BigInt(value.denominator));
  const vectorText = (values: SectionRational[]) => values.map(value => q.text(value)) as FractionVector, matrixText = (values: SectionRational[][]) => values.map(vectorText) as FractionMatrix;
  const matrix = (entry: (row: number, column: number) => SectionRational) => { const result = Array.from({ length: 3 }, () => [zero, zero, zero]); for (let row = 0; row < 3; row++) for (let column = row; column < 3; column++) result[row][column] = result[column][row] = entry(row, column); return result; };
  const minors = (tensor: SectionRational[][]) => { const a = tensor[0][0], b = tensor[0][1], c = tensor[0][2], d = tensor[1][1], e = tensor[1][2], f = tensor[2][2]; return [a, q.sub(q.mul(a, d), q.mul(b, b)), q.sum([q.mul(q.mul(a, d), f), q.mul(q.integer(2), q.mul(q.mul(b, c), e)), q.neg(q.mul(a, q.mul(e, e))), q.neg(q.mul(d, q.mul(c, c))), q.neg(q.mul(f, q.mul(b, b)))])]; };
  let finalValueConversionCount = 0, upwardErrorConversionCount = 0;
  const convert = (exact: SectionRational) => { check(finalValueConversionCount + upwardErrorConversionCount + 2 <= 32, CODE.BUDGET, 'Final frame conversion limit exceeded'); finalValueConversionCount++; const value = q.nearest(exact);
    check(Number.isFinite(value) && (q.compare(exact, zero) === 0 || value !== 0), CODE.REPRESENTABILITY, 'Nonzero final frame values cannot underflow to zero or become nonfinite'); upwardErrorConversionCount++; return { value, error: q.bound(q.abs(q.sub(exact, q.from(value)))) }; };
  const convertTensor = (exact: SectionRational[][]) => { const exactMinors = minors(exact); check(exactMinors.every(value => q.compare(value, zero) > 0), CODE.REPRESENTABILITY, 'Exact transformed tensor must be positive definite');
    const stored: Matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], errors = Array.from({ length: 3 }, () => Array<ErrorBound>(3));
    for (let row = 0; row < 3; row++) for (let column = row; column < 3; column++) { const converted = convert(exact[row][column]); stored[row][column] = stored[column][row] = converted.value; errors[row][column] = errors[column][row] = converted.error; }
    const storedMinors = minors(stored.map(row => row.map(value => q.from(value)))); check(storedMinors.every(value => q.compare(value, zero) > 0), CODE.REPRESENTABILITY, 'Stored binary64 transformed tensor must remain exactly positive definite');
    return { stored, errors: errors as ErrorMatrix, pd: { exactLeadingMinors: vectorText(exactMinors), storedLeadingMinors: vectorText(storedMinors) } };
  };
  const translationExact = translation.map(value => q.from(value)), proof: Proof = { rotationRows, axisMap, determinant: 1, translationExactMM: vectorText(translationExact), squareMillimetresPerSquareMetre: 1000000 }, exactMass = read(measure.exact.massKG), massValue = convert(exactMass), empty = measure.volumeMM3 === 0;
  let posed: Posed;
  if (empty) {
    check(q.compare(exactMass, zero) === 0 && measure.exact.centroidMM === null && measure.exact.inertiaCentroidKgM2 === null, CODE.REPRESENTABILITY, 'Empty total must retain exact mass0/null centroid/nulltensor');
    posed = { bodyId: measure.bodyId, volumeMM3: 0, massKG: massValue.value, centroidMM: null, inertiaCentroidKgM2: null, inertiaOriginKgM2: null, exact: { massKG: q.text(exactMass), centroidMM: null, inertiaCentroidKgM2: null, inertiaOriginKgM2: null }, conversionErrors: { massKG: massValue.error, centroidMM: null, inertiaCentroidKgM2: null, inertiaOriginKgM2: null }, positiveDefinite: null };
  } else {
    check(measure.exact.centroidMM !== null && measure.exact.inertiaCentroidKgM2 !== null && q.compare(exactMass, zero) > 0, CODE.REPRESENTABILITY, 'Nonempty selected Measure must retain its complete exact parent authority');
    const parentCenter = measure.exact.centroidMM.map(read), parentTensor = measure.exact.inertiaCentroidKgM2.map(row => row.map(read));
    const center = axisMap.map((axis, row) => q.add(q.mul(q.integer(axis.sign), parentCenter[axis.sourceAxis]), translationExact[row])); check(center.every(value => q.compare(q.abs(value), q.integer(10000000)) <= 0), CODE.REPRESENTABILITY, 'Every exact output centroid component must remain within1e7mm');
    const centroidTensor = matrix((row, column) => q.mul(q.integer(axisMap[row].sign * axisMap[column].sign), parentTensor[axisMap[row].sourceAxis][axisMap[column].sourceAxis]));
    const square = q.sum(center.map(value => q.mul(value, value))), factor = q.div(exactMass, q.integer(1000000)), originTensor = matrix((row, column) => q.add(centroidTensor[row][column], q.mul(factor, row === column ? q.sub(square, q.mul(center[row], center[row])) : q.neg(q.mul(center[row], center[column])))));
    const centers = center.map(convert), centroidResult = convertTensor(centroidTensor), originResult = convertTensor(originTensor);
    posed = { bodyId: measure.bodyId, volumeMM3: measure.volumeMM3, massKG: massValue.value, centroidMM: centers.map(value => value.value) as Point, inertiaCentroidKgM2: centroidResult.stored, inertiaOriginKgM2: originResult.stored,
      exact: { massKG: q.text(exactMass), centroidMM: vectorText(center), inertiaCentroidKgM2: matrixText(centroidTensor), inertiaOriginKgM2: matrixText(originTensor) }, conversionErrors: { massKG: massValue.error, centroidMM: centers.map(value => value.error) as ErrorVector, inertiaCentroidKgM2: centroidResult.errors, inertiaOriginKgM2: originResult.errors }, positiveDefinite: { centroid: centroidResult.pd, origin: originResult.pd } };
  }
  check(finalValueConversionCount === (empty ? 1 : 16) && upwardErrorConversionCount === finalValueConversionCount && q.counts().floatSearchSteps <= 2048, CODE.BUDGET, 'Complete logical conversion counts and exact helper search limit must match the frozen profile');
  const report: AxisBoxSolidMassFrameReport = {
    schema: 'barocss-axis-box-solid-mass-frame', version: 0, evaluationId: mass.report.evaluationId, sourceFrame: 'authored-xyz-no-axis-conversion', targetFrame: options.pose.frameId, selectedBodyId: measure.bodyId, empty, units: { mass: 'kg', centroid: 'mm', inertia: 'kg*m2', volume: 'mm3' }, options,
    directCounts: { massValidationCount: 1, selectedMeasureBindingCount: 1, finalValueConversionCount, upwardErrorConversionCount, curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0, surfacePointEvaluationCount: 0, surfaceDerivativeEvaluationCount: 0, sourceCompilationCount: 0 }, rationalCounts: q.counts(),
    numericPolicy: { authority: 'exact-parent-canonical-fractions-not-stored-parent-approximations', rotation: 'proper-signed-permutation-exact-axis-and-sign-selection', siConversion: 'exact-integer-square-millimetres-per-square-metre-divisor', output: 'nearest-even-final-values-only-symmetric-upper-triangle-mirrored', errors: 'exact-absolute-conversion-error-and-least-upward-binary64', positiveDefinite: 'exact-and-stored-leading-principal-minors-for-both-tensors', generatedExactZero: 'positive-zero', nonzeroUnderflow: 'refused', empty: 'zero-mass-null-centroid-and-tensors-no-pd-claim' },
    quality: { exactSignedAxisFramePropertiesCertified: true, nonemptyExactAndStoredTensorsPositiveDefinite: !empty, parentExactAndConversionProofUnchanged: true, arbitraryAngleRotationCertified: false, wholeSolidAssemblyBindingCertified: false, geometryPoseBaked: false, densityCertified: false, materialCertified: false, manufacturingToleranceCertified: false, globalBinary64GeometryEvaluationErrorCertified: false, ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumFinalFloatConversions: 32, maximumFloatSearchSteps: 2048, maximumTranslationMM: 1000000, maximumCentroidComponentMM: 10000000, rationalOperations: 200000, gcdSteps: 200000, rationalIntegerBits: 8192, fractionIntegerCharacters: 5000, floatSearchStepsPerConversion: 64, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, stringCharacters: 262144 }, workScope: 'direct-parent-owned-validation-and-new-exact-frame-arithmetic-parent-internal-work-excluded', budgetFailure: 'atomic-no-partial-frame-properties',
  };
  return snapshot({ mass, options, measure, posed, proof, report }, true) as AxisBoxSolidMassFrameResult;
}

/** Rebuild actual parent binding and every exact pose/conversion/PD witness, then compare full retained bits. */
export function validateAxisBoxSolidMassFrame(input: AxisBoxSolidMassFrameResult): AxisBoxSolidMassFrameReport {
  const owned = record(snapshot(input, true), ['mass', 'options', 'measure', 'posed', 'proof', 'report'], CODE.OWNED) as unknown as AxisBoxSolidMassFrameResult;
  let expected: AxisBoxSolidMassFrameResult;
  try { expected = transformAxisBoxSolidMassFrame(owned.mass, owned.options); } catch (cause) { throw new AxisBoxSolidMassFrameError(CODE.OWNED, 'Whole owned exact mass-frame reconstruction failed', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned parent/selection/original pose bits/exact fractions/tensors/errors/PD witnesses/counts changed'); return snapshot(expected.report, true) as AxisBoxSolidMassFrameReport;
}
