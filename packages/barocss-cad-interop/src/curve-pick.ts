import { evaluateCurve } from '@barocss/cad';
import type { Curve } from '@barocss/cad';
import type { BaroCadCurvePreview } from './native.js';

export interface BaroCadCurveDisplayPick {
  target: 'three' | 'babylon';
  modelName: string;
  curveId: string;
  segmentIndex: number;
  /** Original native Curve parameter interval for this display chord. */
  interval: [number, number];
  fraction: number;
  parameterApprox: number;
  /** Closest point on the accepted Float32 chord, local renderer units. */
  displayPoint: [number, number, number];
  /** The same chord point after the current affine target transform, renderer-world units. */
  worldPoint: [number, number, number];
  /** Own CAD evaluation at parameterApprox, authored XYZ millimetres. */
  nativePointMM: [number, number, number];
}

export interface CurvePickBinding {
  modelName: string;
  curveId: string;
  curve: Curve;
  positions: Float32Array;
  parameters: number[];
}

export function makeCurvePickBinding(modelName: string, curve: Curve, preview: BaroCadCurvePreview): CurvePickBinding {
  if (preview.positions.length / 3 !== preview.sample.parameters.length ||
      preview.sample.segments.length !== preview.sample.parameters.length - 1) {
    throw new RangeError('BaroCAD Curve display samples do not form adjacent segments');
  }
  return {
    modelName, curveId: curve.id, curve: structuredClone(curve),
    positions: Float32Array.from(preview.positions), parameters: [...preview.sample.parameters],
  };
}

export function readOwnData(object: unknown, key: string): unknown {
  if (object === null || typeof object !== 'object') throw new TypeError('BaroCAD pick must be an object');
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !('value' in descriptor)) throw new TypeError(`BaroCAD pick ${key} must be own data`);
  return descriptor.value;
}

export function sameValues(actual: ArrayLike<number> | null | undefined, expected: ArrayLike<number>): boolean {
  if (!actual || actual.length !== expected.length) return false;
  for (let index = 0; index < expected.length; index++) {
    if (!Object.is(actual[index], expected[index])) return false;
  }
  return true;
}

/** Both target SDKs store 4x4 matrices in column-major order. */
export function readAffineMatrix(elements: unknown): number[] {
  if (!Array.isArray(elements) && !(elements instanceof Float32Array) && !(elements instanceof Float64Array)) {
    throw new TypeError('BaroCAD pick transform must contain numeric matrix data');
  }
  if (elements.length !== 16) throw new RangeError('BaroCAD pick transform must be a 4x4 matrix');
  const matrix: number[] = [];
  for (let index = 0; index < 16; index++) {
    const value = Array.isArray(elements) ? readOwnData(elements, String(index)) : elements[index];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new RangeError('BaroCAD pick transform must be finite');
    matrix.push(value);
  }
  if (matrix[3] !== 0 || matrix[7] !== 0 || matrix[11] !== 0 || matrix[15] !== 1) {
    throw new RangeError('BaroCAD pick requires an affine transform');
  }
  const determinant = matrix[0] * (matrix[5] * matrix[10] - matrix[6] * matrix[9]) -
    matrix[4] * (matrix[1] * matrix[10] - matrix[2] * matrix[9]) +
    matrix[8] * (matrix[1] * matrix[6] - matrix[2] * matrix[5]);
  if (!Number.isFinite(determinant) || determinant === 0 || !Number.isFinite(1 / determinant)) {
    throw new RangeError('BaroCAD pick requires an invertible transform');
  }
  return matrix;
}

export function readPoint(x: number, y: number, z: number): [number, number, number] {
  if (![x, y, z].every(Number.isFinite)) throw new RangeError('BaroCAD pick point must be finite');
  return [x, y, z];
}

function transform(matrix: number[], point: [number, number, number]): [number, number, number] {
  const [x, y, z] = point;
  return readPoint(
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  );
}

export function resolveCurveChord(
  target: BaroCadCurveDisplayPick['target'], binding: CurvePickBinding, segmentIndex: number,
  hitWorld: [number, number, number], matrix: number[], maximumDistance: number,
): BaroCadCurveDisplayPick {
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= binding.parameters.length - 1) {
    throw new RangeError('BaroCAD pick segment index is stale or out of range');
  }
  if (!Number.isFinite(maximumDistance) || maximumDistance < 0) throw new RangeError('BaroCAD pick tolerance is unsafe');
  const offset = segmentIndex * 3;
  const start = readPoint(binding.positions[offset], binding.positions[offset + 1], binding.positions[offset + 2]);
  const end = readPoint(binding.positions[offset + 3], binding.positions[offset + 4], binding.positions[offset + 5]);
  const worldStart = transform(matrix, start);
  const worldEnd = transform(matrix, end);
  const delta = worldEnd.map((value, index) => value - worldStart[index]);
  const lengthSquared = delta.reduce((sum, value) => sum + value * value, 0);
  if (!Number.isFinite(lengthSquared) || lengthSquared <= 0) throw new RangeError('BaroCAD pick display segment collapsed');
  const dot = delta.reduce((sum, value, index) => sum + (hitWorld[index] - worldStart[index]) * value, 0);
  const fraction = Math.min(1, Math.max(0, dot / lengthSquared));
  const displayPoint = readPoint(
    start[0] + fraction * (end[0] - start[0]),
    start[1] + fraction * (end[1] - start[1]),
    start[2] + fraction * (end[2] - start[2]),
  );
  const worldPoint = transform(matrix, displayPoint);
  const distance = Math.hypot(...worldPoint.map((value, index) => value - hitWorld[index]));
  if (!Number.isFinite(distance) || distance > maximumDistance) throw new RangeError('BaroCAD pick point is stale for this segment');
  const interval: [number, number] = [binding.parameters[segmentIndex], binding.parameters[segmentIndex + 1]];
  const parameterApprox = interval[0] + fraction * (interval[1] - interval[0]);
  if (!Number.isFinite(parameterApprox)) throw new RangeError('BaroCAD pick parameter is unsafe');
  const nativePointMM = evaluateCurve(binding.curve, parameterApprox);
  return {
    target, modelName: binding.modelName, curveId: binding.curveId, segmentIndex,
    interval, fraction, parameterApprox, displayPoint, worldPoint,
    nativePointMM: readPoint(...nativePointMM),
  };
}
