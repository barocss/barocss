import type { Point, Curve, Surface } from './types.js';

/** Discrete right-handed rotations around the origin, in authored XYZ millimetres. */
export type CardinalRotationAxis = 'x' | 'y' | 'z';
export type CardinalRotationDegrees = 90 | 180 | 270;
export type CardinalRotationSpec = Readonly<{ axis: CardinalRotationAxis; degrees: CardinalRotationDegrees }>;

/**
 * Signed coordinate permutation: no trig, rounding, tolerance, or Float32.
 * The caller must separately qualify the parent, provenance and target solid.
 */
const refuse = (): never => { throw new RangeError('Finite XYZ and supported cardinal rotation required'); };

/** Own-data snapshot, bounded before arithmetic. Caller Proxy getters cannot influence geometry. */
function admit(point: Point, spec: CardinalRotationSpec): { point: Point; spec: CardinalRotationSpec } {
  try {
    if (!Array.isArray(point) || Object.getPrototypeOf(point) !== Array.prototype || point.length !== 3) refuse();
    const entries = Object.getOwnPropertyDescriptors(point);
    if (Reflect.ownKeys(entries).length !== 4) refuse();
    const values = [0, 1, 2].map(i => {
      const item = entries[String(i)];
      if (!item || !('value' in item) || !item.enumerable || typeof item.value !== 'number' ||
          !Number.isFinite(item.value) || Math.abs(item.value) > 10000) refuse();
      return item.value as number;
    }) as Point;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec) ||
        (Object.getPrototypeOf(spec) !== Object.prototype && Object.getPrototypeOf(spec) !== null)) refuse();
    const options = Object.getOwnPropertyDescriptors(spec);
    if (Reflect.ownKeys(options).length !== 2 || !['axis', 'degrees'].every(k =>
      Object.hasOwn(options, k) && 'value' in options[k] && options[k].enumerable)) refuse();
    const axis = options.axis.value, degrees = options.degrees.value;
    if ((axis !== 'x' && axis !== 'y' && axis !== 'z') ||
        (degrees !== 90 && degrees !== 180 && degrees !== 270)) refuse();
    return { point: values, spec: { axis, degrees } };
  } catch {
    return refuse();
  }
}

export function rotateCardinalPoint(point: Point, spec: CardinalRotationSpec): Point {
  const admitted = admit(point, spec);
  const [x, y, z] = admitted.point;
  const { axis, degrees } = admitted.spec;
  let rotated: Point;
  switch (axis) {
    case 'x':
      rotated = degrees === 90 ? [x, -z, y] :
        degrees === 180 ? [x, -y, -z] : [x, z, -y];
      break;
    case 'y':
      rotated = degrees === 90 ? [z, y, -x] :
        degrees === 180 ? [-x, y, -z] : [-z, y, x];
      break;
    case 'z':
      rotated = degrees === 90 ? [-y, x, z] :
        degrees === 180 ? [-x, -y, z] : [y, -x, z];
  }
  if (rotated.some(v => Math.abs(v) > 10000))
    throw new RangeError('Cardinal target coordinate exceeds +/-10000mm');
  return rotated;
}

/** Stage an independent rotated Curve coefficient set; never mutates the source. */
export function rotateCardinalCurve(source: Curve, spec: CardinalRotationSpec): Curve {
  const controlPoints = source.controlPoints.map(point => rotateCardinalPoint(point, spec));
  return { ...source, knots: [...source.knots], weights: [...source.weights], controlPoints };
}

/** Stage an independent rotated Surface coefficient grid; qualification happens downstream. */
export function rotateCardinalSurface(source: Surface, spec: CardinalRotationSpec): Surface {
  const controlPoints = source.controlPoints.map(row => row.map(point => rotateCardinalPoint(point, spec)));
  return { ...source, knotsU: [...source.knotsU], knotsV: [...source.knotsV],
    weights: source.weights.map(row => [...row]), controlPoints };
}
