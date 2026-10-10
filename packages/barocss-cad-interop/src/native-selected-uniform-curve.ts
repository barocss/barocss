import { compileCadModel, curveDomain, sampleCurve } from '@barocss/cad';
import type { CadCompileResult, Curve, CurveSample, Point } from '@barocss/cad';
import { BaroCadUniformCurveSourceError, validateBaroCadUniformCurveSourceOptions } from './native-uniform-curve.js';
import type { BaroCadUniformCurveSourceOptions, BaroCadUniformCurveSourceResult } from './native-uniform-curve.js';
export { BaroCadUniformCurveSourceError } from './native-uniform-curve.js';
export type { BaroCadUniformCurveDisplayV1, BaroCadUniformCurveSourceDiagnosticCode } from './native-uniform-curve.js';

export interface BaroCadSelectedUniformCurveSourceOptions extends BaroCadUniformCurveSourceOptions {
  /** Original ASCII Curve ID in the complete source Model. */
  curveId: string;
}

export interface BaroCadSelectedUniformCurveSourceResult extends Omit<BaroCadUniformCurveSourceResult, 'format' | 'options'> {
  format: 'barocad-selected-uniform-curve-preview';
  options: BaroCadSelectedUniformCurveSourceOptions;
  /** Original zero-based Model object ordinal; selection does not reorder the Model. */
  selectedObjectIndex: number;
  /** Independent copied selected occurrence, preserving native coefficient bits. */
  curve: Curve;
  /** All other original object IDs, including Curves and Surfaces, in source order. */
  unrenderedObjectIds: string[];
}

/** Snapshot four exact own data fields before inspecting source or invoking native sampling. */
export function validateBaroCadSelectedUniformCurveSourceOptions(input: unknown): BaroCadSelectedUniformCurveSourceOptions {
  try {
    if (input === null || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
      throw new BaroCadUniformCurveSourceError('OPTIONS', 'Selected uniform options must have a plain or null prototype');
    }
    const fields = ['sourceVersion', 'unitsPerMillimeter', 'uniformCurveDisplay', 'curveId'];
    const keys = Reflect.ownKeys(input);
    if (keys.length !== fields.length || !keys.every(key => typeof key === 'string' && fields.includes(key))) {
      throw new BaroCadUniformCurveSourceError('OPTIONS', 'Selected uniform options require sourceVersion, unitsPerMillimeter, uniformCurveDisplay and curveId only');
    }
    const values: Record<string, unknown> = Object.create(null);
    for (const field of fields) {
      const descriptor = Object.getOwnPropertyDescriptor(input, field);
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        throw new BaroCadUniformCurveSourceError('OPTIONS', 'Selected uniform options must be own enumerable data');
      }
      values[field] = descriptor.value;
    }
    const base = validateBaroCadUniformCurveSourceOptions({ sourceVersion: values.sourceVersion,
      unitsPerMillimeter: values.unitsPerMillimeter, uniformCurveDisplay: values.uniformCurveDisplay });
    const id = values.curveId;
    if (typeof id !== 'string' || id.length < 1 || id.length > 48 || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)) {
      throw new BaroCadUniformCurveSourceError('OPTIONS', 'Selected Curve ID must be an original ASCII identifier of 1..48 characters');
    }
    return { ...base, curveId: id };
  } catch (cause) {
    if (cause instanceof BaroCadUniformCurveSourceError) throw cause;
    throw new BaroCadUniformCurveSourceError('OPTIONS', 'Selected uniform options could not be inspected', [], cause);
  }
}

/** Sample one original Curve while retaining the complete source0/mm Model and every unrendered sibling. */
export function parseBaroCadSelectedUniformCurveSource(source: string,
  options: BaroCadSelectedUniformCurveSourceOptions): BaroCadSelectedUniformCurveSourceResult {
  const snapshot = validateBaroCadSelectedUniformCurveSourceOptions(options);
  let compiled: CadCompileResult;
  try { compiled = compileCadModel(source, { sourceVersion: snapshot.sourceVersion }); }
  catch (cause) { throw new BaroCadUniformCurveSourceError('SOURCE', 'Complete selected Curve source compilation failed', [], cause); }
  if (!compiled.ok) throw new BaroCadUniformCurveSourceError('SOURCE', 'Complete selected Curve source compilation was refused', compiled.diagnostics);
  const model = compiled.model, selectedObjectIndex = model.objects.findIndex(object => object.id === snapshot.curveId), selected = model.objects[selectedObjectIndex];
  if (model.version !== 0 || model.lengthUnit !== 'mm' || model.objects.length < 1 || model.objects.length > 16 || selected?.kind !== 'curve') {
    throw new BaroCadUniformCurveSourceError('PROFILE', 'Selected uniform display requires a complete source0/mm Model of 1..16 objects and a matching original Curve');
  }
  if (!Number.isInteger(selected.degree) || selected.degree < 1 || selected.degree > 5 || selected.controlPoints.length < 2 || selected.controlPoints.length > 64 ||
      selected.knots.length > 70 || !selected.controlPoints.every(point => point.length === 3 && point.every(value => Number.isFinite(value) && Math.abs(value) <= 1e6)) ||
      !selected.weights.every(value => Number.isFinite(value) && value >= 1e-6 && value <= 1e6)) {
    throw new BaroCadUniformCurveSourceError('PROFILE', 'Selected original Curve requires degree1..5, 2..64 poles, at most70 knots and admitted native coordinates/weights');
  }
  const curve: Curve = { kind: 'curve', id: selected.id, degree: selected.degree, knots: [...selected.knots],
    controlPoints: selected.controlPoints.map((point): Point => [point[0], point[1], point[2]]), weights: [...selected.weights] };
  let nativeDomain: [number, number], samples: CurveSample[];
  try { nativeDomain = curveDomain(curve); }
  catch (cause) { throw new BaroCadUniformCurveSourceError('SAMPLING', 'Selected original Curve domain query failed', [], cause); }
  const domain: [number, number] = [nativeDomain[0], nativeDomain[1]];
  if (!domain.every(Number.isFinite) || !(domain[0] < domain[1])) {
    throw new BaroCadUniformCurveSourceError('PARAMETERS', 'Selected original Curve domain must be finite and increasing');
  }
  try { samples = sampleCurve(curve, snapshot.uniformCurveDisplay.count); }
  catch (cause) { throw new BaroCadUniformCurveSourceError('SAMPLING', 'Selected original uniform sampling failed', [], cause); }
  if (samples.length !== snapshot.uniformCurveDisplay.count) throw new BaroCadUniformCurveSourceError('SAMPLING', 'Selected original sample count differs from the requested count');
  const parameters = samples.map(sample => sample.parameter);
  if (!Object.is(parameters[0], domain[0]) || !Object.is(parameters.at(-1), domain[1])) {
    throw new BaroCadUniformCurveSourceError('PARAMETERS', 'Selected original endpoint parameter bits differ from the native domain');
  }
  for (let index = 0; index < parameters.length; index++) {
    const parameter = parameters[index];
    if (!Number.isFinite(parameter) || parameter < domain[0] || parameter > domain[1] || (index > 0 && !(parameters[index - 1] < parameter))) {
      throw new BaroCadUniformCurveSourceError('PARAMETERS', 'Selected uniform parameters must increase strictly inside the original domain');
    }
  }
  const pointsMM = samples.map((sample): Point => [sample.point[0], sample.point[1], sample.point[2]]), positions = new Float32Array(pointsMM.length * 3);
  for (let index = 0; index < pointsMM.length; index++) {
    for (let axis = 0; axis < 3; axis++) {
      const original = pointsMM[index][axis], scaled = original * snapshot.unitsPerMillimeter, converted = Math.fround(scaled);
      if (!Number.isFinite(original) || !Number.isFinite(scaled) || !Number.isFinite(converted) || (original !== 0 && scaled === 0) || (scaled !== 0 && converted === 0)) {
        throw new BaroCadUniformCurveSourceError('POSITIONS', 'Selected Curve position is unsafe in renderer Float32 units');
      }
      positions[index * 3 + axis] = converted;
    }
    if (index > 0 && positions[index * 3] === positions[(index - 1) * 3] && positions[index * 3 + 1] === positions[(index - 1) * 3 + 1] && positions[index * 3 + 2] === positions[(index - 1) * 3 + 2]) {
      throw new BaroCadUniformCurveSourceError('SEGMENTS', 'Selected uniform Curve has a collapsed Float32 display segment');
    }
  }
  const intervals = parameters.slice(0, -1).map((parameter, index): [number, number] => [parameter, parameters[index + 1]]);
  return { format: 'barocad-selected-uniform-curve-preview', version: 1, mode: 'uniform-original-parameter', source, model, curveId: curve.id,
    options: snapshot, selectedObjectIndex, curve, unrenderedObjectIds: model.objects.filter((_, index) => index !== selectedObjectIndex).map(object => object.id),
    domain, parameters, pointsMM, intervals, positions,
    quality: { approximateDisplay: true, adaptiveErrorBound: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false } };
}
