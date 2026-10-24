import { validateAxisBoxSolidBoolean } from './axis-box-boolean.js';
import type { AxisBoxSolidBooleanResult } from './axis-box-boolean.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionRational, SectionFraction } from './section-rational-internal.js';
import type { Point } from './types.js';
import { same } from './core/structural-equality.js';
import { KernelError } from './core/barocss-error.js';

export const AxisBoxSolidMassDiagnosticCode = Object.freeze({ INPUT: 'INPUT', BUDGET: 'BUDGET', BOOLEAN: 'BOOLEAN', BINDING: 'BINDING', REPRESENTABILITY: 'REPRESENTABILITY', OWNED: 'OWNED' } as const);
export type AxisBoxSolidMassDiagnosticCode = typeof AxisBoxSolidMassDiagnosticCode[keyof typeof AxisBoxSolidMassDiagnosticCode];
export class AxisBoxSolidMassError extends KernelError {
  readonly code: AxisBoxSolidMassDiagnosticCode;
  constructor(code: AxisBoxSolidMassDiagnosticCode, detail: string, cause?: unknown) {
    super(('Axis-box Solid mass: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'AxisBoxSolidMassError'; this.code = code;
  }
}
export interface AxisBoxSolidMassOptions { densityKgPerM3: number; maximumCells: number }
type Fraction = SectionFraction;
type FractionVector = [Fraction, Fraction, Fraction];
type FractionMatrix = [FractionVector, FractionVector, FractionVector];
type Matrix = [Point, Point, Point];
type ErrorBound = { exact: Fraction; upper: number };
type ErrorVector = [ErrorBound, ErrorBound, ErrorBound];
type ErrorMatrix = [ErrorVector, ErrorVector, ErrorVector];
type Index3 = [number, number, number];
export interface AxisBoxSolidMassMeasure {
  bodyId: string | null; cellIndices: Index3[]; volumeMM3: number; massKG: number; centroidMM: Point | null; inertiaCentroidKgM2: Matrix | null;
  exact: { volumeMM3: Fraction; firstMomentsMM4: FractionVector; secondMomentsMM5: FractionMatrix; centralSecondMomentsMM5: FractionMatrix | null; massKG: Fraction; centroidMM: FractionVector | null; inertiaCentroidKgM2: FractionMatrix | null };
  conversionErrors: { massKG: ErrorBound; centroidMM: ErrorVector | null; inertiaCentroidKgM2: ErrorMatrix | null };
  positiveDefinite: { exactLeadingMinors: FractionVector; storedLeadingMinors: FractionVector } | null;
}
type CellMoment = { index: Index3; bodyId: string; boundsMM: { min: Point; max: Point }; widthsMM: FractionVector; centroidMM: FractionVector; volumeMM3: Fraction; firstMomentsMM4: FractionVector; secondMomentsMM5: FractionMatrix };
export interface AxisBoxSolidMassReport {
  schema: 'barocss-axis-box-solid-mass'; version: 0; evaluationId: string; densityKgPerM3: number; densityExactKgPerM3: Fraction; empty: boolean; bodyCount: number; integratedCellCount: number; measureCount: number;
  massKG: number; centroidMM: Point | null; inertiaCentroidKgM2: Matrix | null; volumeMM3: number; cellMoments: CellMoment[];
  units: { density: 'kg/m3'; mass: 'kg'; centroid: 'mm'; inertia: 'kg*m2'; volume: 'mm3'; firstMoment: 'mm4'; secondMoment: 'mm5' };
  unitConversions: { densityKgPerMM3: Fraction; inertiaKgM2PerVolumeSecondMomentMM5: Fraction; cubicMillimetresPerCubicMetre: 1000000000; squareMillimetresPerSquareMetre: 1000000 };
  sourceFrame: 'authored-xyz-no-axis-conversion'; directCounts: { booleanValidationCount: 1; cellIntegrationCount: number; measureCount: number; finalValueConversionCount: number; upwardErrorConversionCount: number; curvePointEvaluationCount: 0; curveDerivativeEvaluationCount: 0; surfacePointEvaluationCount: 0; surfaceDerivativeEvaluationCount: 0; sourceCompilationCount: 0 };
  rationalCounts: ReturnType<SectionRationalContext['counts']>;
  numericPolicy: { authority: 'exact-occupied-integer-cell-raw-and-central-coordinate-moments'; density: 'uniform-caller-declared-exact-represented-value'; siConversion: 'exact-integer-divisors-1e9-and-1e15'; output: 'nearest-even-final-values-only-symmetric-upper-triangle-mirrored'; errors: 'exact-absolute-conversion-error-and-least-upward-binary64'; positiveDefinite: 'exact-leading-minors-for-model-and-stored-binary64-matrix'; nonzeroUnderflow: 'refused'; generatedExactZero: 'positive-zero'; empty: 'mass-zero-centroid-and-tensor-null-no-pd-claim' };
  quality: { exactCellModelMassPropertiesCertified: true; nonemptyExactAndStoredTensorPositiveDefinite: boolean; densityCertified: false; materialCertified: false; arbitraryCurvedSolidPropertiesCertified: false; manufacturingToleranceCertified: false; globalBinary64GeometryEvaluationErrorCertified: false; physicalPoseConversionCertified: false; principalAxesCertified: false; parentProofUnchanged: true; ownership: 'independent-copied-cpu-data-gc' };
  limits: { maximumCells: 27; maximumBodies: 2; maximumMeasures: 3; maximumFinalFloatConversions: 60; maximumFloatSearchSteps: 3840; maximumDensityKgPerM3: 1000000; rationalOperations: 200000; gcdSteps: 200000; rationalIntegerBits: 8192; fractionIntegerCharacters: 5000; floatSearchStepsPerConversion: 64; ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; stringCharacters: 262144 };
  workScope: 'direct-parent-owned-validation-and-new-exact-cell-integration-parent-internal-work-excluded'; budgetFailure: 'atomic-no-partial-mass-properties';
}
export interface AxisBoxSolidMassResult { boolean: AxisBoxSolidBooleanResult; options: AxisBoxSolidMassOptions; bodies: AxisBoxSolidMassMeasure[]; total: AxisBoxSolidMassMeasure; report: AxisBoxSolidMassReport }

const CODE = AxisBoxSolidMassDiagnosticCode;
function check(condition: boolean, code: AxisBoxSolidMassDiagnosticCode, detail: string): asserts condition { if (!condition) throw new AxisBoxSolidMassError(code, detail); }
function record(input: unknown, fields: string[], code: AxisBoxSolidMassDiagnosticCode = CODE.INPUT): Record<string, unknown> { check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required'); const data = input as Record<string, unknown>; check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data; }
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
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded own arrays are required'); result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse/extra array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); }); }
    else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)])); ancestors.delete(value); return result;
  }; try { return copy(input, 0); } catch (cause) { if (cause instanceof AxisBoxSolidMassError) throw cause; throw new AxisBoxSolidMassError(code, 'Own snapshot failed', cause); }
}

/** Exact uniform-density properties of the actual occupied integer-cell material, with final conversion certificates. */
export function measureAxisBoxSolidBooleanMass(booleanInput: AxisBoxSolidBooleanResult, optionsInput: AxisBoxSolidMassOptions): AxisBoxSolidMassResult {
  const input = record(snapshot({ boolean: booleanInput, options: optionsInput }), ['boolean', 'options']), settings = record(input.options, ['densityKgPerM3', 'maximumCells']);
  check(typeof settings.densityKgPerM3 === 'number' && Number.isFinite(settings.densityKgPerM3) && settings.densityKgPerM3 > 0 && settings.densityKgPerM3 <= 1e6, CODE.INPUT, 'Positive finite declared density at most1e6kg/m3 is required');
  check(settings.maximumCells === 27, CODE.BUDGET, 'The complete fixed27-cell limit is required before parent calls');
  const options: AxisBoxSolidMassOptions = { densityKgPerM3: settings.densityKgPerM3, maximumCells: 27 }, boolean = input.boolean as AxisBoxSolidBooleanResult;
  try { validateAxisBoxSolidBoolean(boolean); } catch (cause) { throw new AxisBoxSolidMassError(CODE.BOOLEAN, 'Actual whole Boolean owned validation refused', cause); }
  const occupied = boolean.cells.filter(cell => cell.occupied); check(occupied.length <= 27 && boolean.bodies.length <= 2, CODE.BUDGET, 'The actual occupied cells and Bodies must fit the frozen complete property profile');
  const q = new SectionRationalContext((kind, detail) => { throw new AxisBoxSolidMassError(CODE[kind], detail); }), zero = q.integer(0), density = q.from(options.densityKgPerM3), massFactor = q.div(density, q.integer(1000000000)), inertiaFactor = q.div(density, q.integer(1000000000000000));
  const vectorText = (values: SectionRational[]) => values.map(value => q.text(value)) as FractionVector, matrixText = (values: SectionRational[][]) => values.map(vectorText) as FractionMatrix;
  const matrix = (entry: (row: number, column: number) => SectionRational): SectionRational[][] => { const result = Array.from({ length: 3 }, () => [zero, zero, zero]); for (let row = 0; row < 3; row++) for (let column = row; column < 3; column++) result[row][column] = result[column][row] = entry(row, column); return result; };
  type Integrated = { index: Index3; bodyId: string; volume: SectionRational; first: SectionRational[]; second: SectionRational[][] };
  const records: Integrated[] = [], cellMoments: CellMoment[] = [], grid = [boolean.grid.x, boolean.grid.y, boolean.grid.z];
  for (const cell of occupied) {
    check(cell.bodyId !== null, CODE.BINDING, 'Every integrated occupied cell must retain its actual Body ID');
    const min = cell.index.map((index, axis) => grid[axis][index]) as Point, max = cell.index.map((index, axis) => grid[axis][index + 1]) as Point;
    const widths = min.map((value, axis) => q.sub(q.from(max[axis]), q.from(value))), center = min.map((value, axis) => q.div(q.add(q.from(value), q.from(max[axis])), q.integer(2)));
    check(widths.every(value => q.compare(value, zero) > 0), CODE.BINDING, 'Each actual occupied cell must have three positive exact widths');
    const volume = widths.reduce((product, value) => q.mul(product, value), q.integer(1)), first = center.map(value => q.mul(volume, value));
    const second = matrix((row, column) => q.mul(volume, row === column ? q.add(q.mul(center[row], center[row]), q.div(q.mul(widths[row], widths[row]), q.integer(12))) : q.mul(center[row], center[column])));
    check(q.compare(volume, q.from(cell.volumeMM3)) === 0, CODE.BINDING, 'Analytical occupied cell volume must equal the actual parent integer volume');
    records.push({ index: cell.index, bodyId: cell.bodyId, volume, first, second }); cellMoments.push({ index: cell.index, bodyId: cell.bodyId, boundsMM: { min, max }, widthsMM: vectorText(widths), centroidMM: vectorText(center), volumeMM3: q.text(volume), firstMomentsMM4: vectorText(first), secondMomentsMM5: matrixText(second) });
  }
  const byCell = new Map(records.map(record => [record.index.join(':'), record])); check(byCell.size === records.length, CODE.BINDING, 'Occupied cell integration must not duplicate any physical material');
  const leadingMinors = (tensor: SectionRational[][]): SectionRational[] => {
    const a = tensor[0][0], b = tensor[0][1], c = tensor[0][2], d = tensor[1][1], e = tensor[1][2], f = tensor[2][2];
    return [a, q.sub(q.mul(a, d), q.mul(b, b)), q.sum([q.mul(q.mul(a, d), f), q.mul(q.integer(2), q.mul(q.mul(b, c), e)), q.neg(q.mul(a, q.mul(e, e))), q.neg(q.mul(d, q.mul(c, c))), q.neg(q.mul(f, q.mul(b, b)))])];
  };
  let finalValueConversionCount = 0, upwardErrorConversionCount = 0;
  const convert = (exact: SectionRational): { value: number; error: ErrorBound } => {
    check(finalValueConversionCount + upwardErrorConversionCount + 2 <= 60, CODE.BUDGET, 'The complete final float conversion limit exceeded');
    finalValueConversionCount++; const value = q.nearest(exact);
    check(Number.isFinite(value) && (q.compare(exact, zero) === 0 || value !== 0), CODE.REPRESENTABILITY, 'A nonzero final property cannot underflow to zero or become nonfinite');
    const difference = q.abs(q.sub(exact, q.from(value))); upwardErrorConversionCount++; return { value, error: q.bound(difference) };
  };
  const measure = (bodyId: string | null, members: Integrated[], expectedVolume: number): AxisBoxSolidMassMeasure => {
    const volume = q.sum(members.map(member => member.volume)), first = [0, 1, 2].map(axis => q.sum(members.map(member => member.first[axis]))), second = matrix((row, column) => q.sum(members.map(member => member.second[row][column]))), exactMass = q.mul(volume, massFactor);
    check(q.compare(volume, q.from(expectedVolume)) === 0 && Number.isSafeInteger(expectedVolume) && expectedVolume >= 0, CODE.BINDING, 'Body and total raw volume must equal the complete actual occupied-cell accounting');
    if (members.length === 0) {
      check(q.compare(volume, zero) === 0 && q.compare(exactMass, zero) === 0, CODE.BINDING, 'Empty material must retain exact zero volume and mass');
      return { bodyId, cellIndices: [], volumeMM3: 0, massKG: 0, centroidMM: null, inertiaCentroidKgM2: null,
        exact: { volumeMM3: q.text(zero), firstMomentsMM4: vectorText(first), secondMomentsMM5: matrixText(second), centralSecondMomentsMM5: null, massKG: q.text(zero), centroidMM: null, inertiaCentroidKgM2: null },
        conversionErrors: { massKG: { exact: q.text(zero), upper: 0 }, centroidMM: null, inertiaCentroidKgM2: null }, positiveDefinite: null };
    }
    check(q.compare(volume, zero) > 0 && q.compare(exactMass, zero) > 0, CODE.BINDING, 'Nonempty declared-density material must have exact positive volume and mass');
    const centroid = first.map(value => q.div(value, volume)), central = matrix((row, column) => q.sub(second[row][column], q.div(q.mul(first[row], first[column]), volume))), trace = q.sum([central[0][0], central[1][1], central[2][2]]);
    const inertia = matrix((row, column) => q.mul(inertiaFactor, row === column ? q.sub(trace, central[row][row]) : q.neg(central[row][column]))), exactMinors = leadingMinors(inertia);
    check(exactMinors.every(value => q.compare(value, zero) > 0), CODE.BINDING, 'Exact nonempty inertia must have three positive leading principal minors');
    const mass = convert(exactMass), centers = centroid.map(convert), stored: Matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], errors = Array.from({ length: 3 }, () => Array<ErrorBound>(3));
    for (let row = 0; row < 3; row++) for (let column = row; column < 3; column++) { const converted = convert(inertia[row][column]); stored[row][column] = stored[column][row] = converted.value; errors[row][column] = errors[column][row] = converted.error; }
    check(stored.every((row, i) => row.every((value, j) => Object.is(value, stored[j][i]))), CODE.BINDING, 'Stored tensor must retain exact mirrored binary64 symmetry');
    const storedMinors = leadingMinors(stored.map(row => row.map(value => q.from(value)))); check(storedMinors.every(value => q.compare(value, zero) > 0), CODE.REPRESENTABILITY, 'Rounded binary64 inertia must remain exactly positive definite');
    return { bodyId, cellIndices: members.map(member => member.index), volumeMM3: expectedVolume, massKG: mass.value, centroidMM: centers.map(center => center.value) as Point, inertiaCentroidKgM2: stored,
      exact: { volumeMM3: q.text(volume), firstMomentsMM4: vectorText(first), secondMomentsMM5: matrixText(second), centralSecondMomentsMM5: matrixText(central), massKG: q.text(exactMass), centroidMM: vectorText(centroid), inertiaCentroidKgM2: matrixText(inertia) },
      conversionErrors: { massKG: mass.error, centroidMM: centers.map(center => center.error) as ErrorVector, inertiaCentroidKgM2: errors as ErrorMatrix }, positiveDefinite: { exactLeadingMinors: vectorText(exactMinors), storedLeadingMinors: vectorText(storedMinors) } };
  };
  const covered = new Set<string>(), bodies = boolean.bodies.map(body => {
    const members = body.cellIndices.map(index => { const key = index.join(':'), member = byCell.get(key); check(member !== undefined && member.bodyId === body.id && !covered.has(key), CODE.BINDING, 'Each actual Body must cover its unique complete occupied cells'); covered.add(key); return member; });
    return measure(body.id, members, body.volumeMM3);
  });
  check(covered.size === records.length, CODE.BINDING, 'Per-Body properties must account for every occupied cell exactly once');
  const total = measure(null, records, boolean.report.volumeMM3), empty = records.length === 0;
  check(boolean.report.empty === empty && bodies.length + 1 <= 3 && finalValueConversionCount + upwardErrorConversionCount <= 60 && q.counts().floatSearchSteps <= 3840, CODE.BUDGET, 'Complete empty/Body/measure/conversion/search limits must hold');
  const report: AxisBoxSolidMassReport = {
    schema: 'barocss-axis-box-solid-mass', version: 0, evaluationId: boolean.options.evaluationId, densityKgPerM3: options.densityKgPerM3, densityExactKgPerM3: q.text(density), empty, bodyCount: bodies.length, integratedCellCount: records.length, measureCount: bodies.length + 1,
    massKG: total.massKG, centroidMM: total.centroidMM, inertiaCentroidKgM2: total.inertiaCentroidKgM2, volumeMM3: total.volumeMM3, cellMoments,
    units: { density: 'kg/m3', mass: 'kg', centroid: 'mm', inertia: 'kg*m2', volume: 'mm3', firstMoment: 'mm4', secondMoment: 'mm5' }, unitConversions: { densityKgPerMM3: q.text(massFactor), inertiaKgM2PerVolumeSecondMomentMM5: q.text(inertiaFactor), cubicMillimetresPerCubicMetre: 1000000000, squareMillimetresPerSquareMetre: 1000000 },
    sourceFrame: 'authored-xyz-no-axis-conversion', directCounts: { booleanValidationCount: 1, cellIntegrationCount: records.length, measureCount: bodies.length + 1, finalValueConversionCount, upwardErrorConversionCount, curvePointEvaluationCount: 0, curveDerivativeEvaluationCount: 0, surfacePointEvaluationCount: 0, surfaceDerivativeEvaluationCount: 0, sourceCompilationCount: 0 }, rationalCounts: q.counts(),
    numericPolicy: { authority: 'exact-occupied-integer-cell-raw-and-central-coordinate-moments', density: 'uniform-caller-declared-exact-represented-value', siConversion: 'exact-integer-divisors-1e9-and-1e15', output: 'nearest-even-final-values-only-symmetric-upper-triangle-mirrored', errors: 'exact-absolute-conversion-error-and-least-upward-binary64', positiveDefinite: 'exact-leading-minors-for-model-and-stored-binary64-matrix', nonzeroUnderflow: 'refused', generatedExactZero: 'positive-zero', empty: 'mass-zero-centroid-and-tensor-null-no-pd-claim' },
    quality: { exactCellModelMassPropertiesCertified: true, nonemptyExactAndStoredTensorPositiveDefinite: !empty, densityCertified: false, materialCertified: false, arbitraryCurvedSolidPropertiesCertified: false, manufacturingToleranceCertified: false, globalBinary64GeometryEvaluationErrorCertified: false, physicalPoseConversionCertified: false, principalAxesCertified: false, parentProofUnchanged: true, ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumCells: 27, maximumBodies: 2, maximumMeasures: 3, maximumFinalFloatConversions: 60, maximumFloatSearchSteps: 3840, maximumDensityKgPerM3: 1000000, rationalOperations: 200000, gcdSteps: 200000, rationalIntegerBits: 8192, fractionIntegerCharacters: 5000, floatSearchStepsPerConversion: 64, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, stringCharacters: 262144 }, workScope: 'direct-parent-owned-validation-and-new-exact-cell-integration-parent-internal-work-excluded', budgetFailure: 'atomic-no-partial-mass-properties',
  };
  return snapshot({ boolean, options, bodies, total, report }, true) as AxisBoxSolidMassResult;
}

/** Rebuild the complete parent/material integration and all exact/rounded witnesses before whole-result comparison. */
export function validateAxisBoxSolidBooleanMass(input: AxisBoxSolidMassResult): AxisBoxSolidMassReport {
  const owned = record(snapshot(input, true), ['boolean', 'options', 'bodies', 'total', 'report'], CODE.OWNED) as unknown as AxisBoxSolidMassResult;
  let expected: AxisBoxSolidMassResult;
  try { expected = measureAxisBoxSolidBooleanMass(owned.boolean, owned.options); } catch (cause) { throw new AxisBoxSolidMassError(CODE.OWNED, 'Whole owned exact cell mass-property reconstruction failed', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned parent/options/cells/raw-central moments/SI values/rounding bounds/PD witnesses/counters changed'); return snapshot(expected.report, true) as AxisBoxSolidMassReport;
}
