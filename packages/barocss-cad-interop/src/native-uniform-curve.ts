import { compileCadModel, curveDomain, sampleCurve } from '@barocss/cad';
import type { CadCompileResult, CadDiagnostic, CurveSample, Model, Point } from '@barocss/cad';

export type BaroCadUniformCurveSourceDiagnosticCode =
  'OPTIONS' | 'SOURCE' | 'PROFILE' | 'SAMPLING' | 'PARAMETERS' | 'POSITIONS' | 'SEGMENTS';

export interface BaroCadUniformCurveDisplayV1 {
  version: 1;
  count: number;
}

export interface BaroCadUniformCurveSourceOptions {
  sourceVersion: 0;
  /** Renderer units per original native millimetre. */
  unitsPerMillimeter: number;
  uniformCurveDisplay: BaroCadUniformCurveDisplayV1;
}

export interface BaroCadUniformCurveSourceResult {
  format: 'barocad-uniform-curve-preview';
  version: 1;
  mode: 'uniform-original-parameter';
  source: string;
  model: Model;
  curveId: string;
  options: BaroCadUniformCurveSourceOptions;
  domain: [number, number];
  parameters: number[];
  pointsMM: Point[];
  intervals: [number, number][];
  positions: Float32Array;
  quality: {
    approximateDisplay: true;
    adaptiveErrorBound: false;
    geometricValidity: 'not-certified';
    topologyCertified: false;
    solid: false;
  };
}

export class BaroCadUniformCurveSourceError extends Error {
  readonly code: BaroCadUniformCurveSourceDiagnosticCode;
  readonly diagnostics: CadDiagnostic[];
  readonly cause: unknown;

  constructor(code: BaroCadUniformCurveSourceDiagnosticCode, message: string,
    diagnostics: CadDiagnostic[] = [], cause?: unknown) {
    super(message);
    this.name = 'BaroCadUniformCurveSourceError';
    this.code = code;
    this.diagnostics = diagnostics;
    this.cause = cause;
  }
}

function readOptionData(input: unknown, keys: string[], label: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new BaroCadUniformCurveSourceError('OPTIONS', `${label} must be a plain data object`);
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new BaroCadUniformCurveSourceError('OPTIONS', `${label} must have a plain or null prototype`);
  }
  const actualKeys = Reflect.ownKeys(input);
  if (actualKeys.length !== keys.length || !actualKeys.every(key => typeof key === 'string' && keys.includes(key))) {
    throw new BaroCadUniformCurveSourceError('OPTIONS', `${label} has missing or unsupported fields`);
  }
  const values: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      throw new BaroCadUniformCurveSourceError('OPTIONS', `${label} fields must be own enumerable data`);
    }
    values[key] = descriptor.value;
  }
  return values;
}

function snapshotOptions(input: unknown): BaroCadUniformCurveSourceOptions {
  try {
    const values = readOptionData(input, ['sourceVersion', 'unitsPerMillimeter', 'uniformCurveDisplay'], 'Uniform Curve options');
    const display = readOptionData(values.uniformCurveDisplay, ['version', 'count'], 'Uniform Curve display');
    if (values.sourceVersion !== 0 || display.version !== 1) {
      throw new BaroCadUniformCurveSourceError('OPTIONS', 'Uniform Curve display requires sourceVersion 0 and display version 1');
    }
    const scale = values.unitsPerMillimeter, count = display.count;
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) {
      throw new BaroCadUniformCurveSourceError('OPTIONS', 'Uniform Curve unitsPerMillimeter must be finite and positive');
    }
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 2 || count > 129) {
      throw new BaroCadUniformCurveSourceError('OPTIONS', 'Uniform Curve count must be an integer in 2..129');
    }
    return { sourceVersion: 0, unitsPerMillimeter: scale, uniformCurveDisplay: { version: 1, count } };
  } catch (cause) {
    if (cause instanceof BaroCadUniformCurveSourceError) throw cause;
    throw new BaroCadUniformCurveSourceError('OPTIONS', 'Uniform Curve options could not be inspected', [], cause);
  }
}

/** Original CAD uniform parameter samples, with an explicit bounded CPU display profile. */
export function parseBaroCadUniformCurveSource(source: string,
  options: BaroCadUniformCurveSourceOptions): BaroCadUniformCurveSourceResult {
  const snapshot = snapshotOptions(options);
  let compiled: CadCompileResult;
  try {
    compiled = compileCadModel(source, { sourceVersion: snapshot.sourceVersion });
  } catch (cause) {
    throw new BaroCadUniformCurveSourceError('SOURCE', 'Original Curve source compilation failed', [], cause);
  }
  if (!compiled.ok) {
    throw new BaroCadUniformCurveSourceError('SOURCE', 'Original Curve source compilation was refused', compiled.diagnostics);
  }
  const model = compiled.model, curve = model.objects[0];
  if (model.version !== 0 || model.lengthUnit !== 'mm' || model.objects.length !== 1 ||
      curve?.kind !== 'curve' || !Number.isInteger(curve.degree) || curve.degree < 1 || curve.degree > 5) {
    throw new BaroCadUniformCurveSourceError('PROFILE', 'Uniform display requires exactly one original source0/mm Curve of degree 1..5');
  }

  let nativeDomain: [number, number], samples: CurveSample[];
  try {
    nativeDomain = curveDomain(curve);
  } catch (cause) {
    throw new BaroCadUniformCurveSourceError('SAMPLING', 'Original Curve domain query failed', [], cause);
  }
  const domain: [number, number] = [nativeDomain[0], nativeDomain[1]];
  if (!domain.every(Number.isFinite) || !(domain[0] < domain[1])) {
    throw new BaroCadUniformCurveSourceError('PARAMETERS', 'Uniform Curve original domain must be finite and increasing');
  }
  try {
    samples = sampleCurve(curve, snapshot.uniformCurveDisplay.count);
  } catch (cause) {
    throw new BaroCadUniformCurveSourceError('SAMPLING', 'Original Curve uniform sampling failed', [], cause);
  }
  if (samples.length !== snapshot.uniformCurveDisplay.count) {
    throw new BaroCadUniformCurveSourceError('SAMPLING', 'Original Curve sample count differs from the requested count');
  }
  const parameters = samples.map(sample => sample.parameter);
  if (!Object.is(parameters[0], domain[0]) || !Object.is(parameters[parameters.length - 1], domain[1])) {
    throw new BaroCadUniformCurveSourceError('PARAMETERS', 'Uniform Curve domain or original endpoint parameter bits are invalid');
  }
  for (let index = 0; index < parameters.length; index++) {
    const parameter = parameters[index];
    if (!Number.isFinite(parameter) || parameter < domain[0] || parameter > domain[1] ||
        (index > 0 && !(parameters[index - 1] < parameter))) {
      throw new BaroCadUniformCurveSourceError('PARAMETERS', 'Uniform Curve parameters must increase strictly inside the original domain');
    }
  }

  const pointsMM = samples.map((sample): Point => [sample.point[0], sample.point[1], sample.point[2]]);
  const positions = new Float32Array(pointsMM.length * 3);
  for (let index = 0; index < pointsMM.length; index++) {
    for (let axis = 0; axis < 3; axis++) {
      const original = pointsMM[index][axis], scaled = original * snapshot.unitsPerMillimeter;
      const converted = Math.fround(scaled);
      if (!Number.isFinite(original) || !Number.isFinite(scaled) || !Number.isFinite(converted) ||
          (original !== 0 && scaled === 0) || (scaled !== 0 && converted === 0)) {
        throw new BaroCadUniformCurveSourceError('POSITIONS', 'Uniform Curve position is unsafe in renderer Float32 units');
      }
      positions[index * 3 + axis] = converted;
    }
    if (index > 0 && positions[index * 3] === positions[(index - 1) * 3] &&
        positions[index * 3 + 1] === positions[(index - 1) * 3 + 1] &&
        positions[index * 3 + 2] === positions[(index - 1) * 3 + 2]) {
      throw new BaroCadUniformCurveSourceError('SEGMENTS', 'Uniform Curve has a collapsed Float32 display segment');
    }
  }
  const intervals = parameters.slice(0, -1).map((parameter, index): [number, number] => [parameter, parameters[index + 1]]);
  return {
    format: 'barocad-uniform-curve-preview', version: 1, mode: 'uniform-original-parameter',
    source, model, curveId: curve.id, options: snapshot, domain, parameters, pointsMM, intervals, positions,
    quality: { approximateDisplay: true, adaptiveErrorBound: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false },
  };
}
