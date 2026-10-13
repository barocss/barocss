/**
 * Exact orientation of the six REPRESENTED IEEE-754 binary64 input values.
 * No tolerance, no approximation, no statement about measurement error,
 * true design intent, non-planar topology or B-Rep material validity.
 */
export type ExactBinary64OrientationV1 =
  | { readonly status: 'exact'; readonly sign: 'positive' | 'negative' | 'zero'; readonly method: 'binary64-dyadic-bigint' }
  | { readonly status: 'unsupported'; readonly reason: 'invalid-input' | 'non-finite-coordinate' | 'out-of-range-coordinate' };
export interface Binary64PointV1 { readonly x: number; readonly y: number }

const point = (input: unknown): input is Binary64PointV1 => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) return false;
  const fields = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(input);
  return keys.length === 2 && ['x', 'y'].every(k =>
    Object.hasOwn(fields, k) && 'value' in fields[k] &&
    fields[k].enumerable && typeof fields[k].value === 'number');
};

type Dyadic = { coefficient: bigint; exponent: number };
const view = new DataView(new ArrayBuffer(8));

/** Number = coefficient * 2^exponent, exactly, including subnormals. */
function dyadic(value: number): Dyadic {
  view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false);
  const negative = (bits >> 63n) !== 0n;
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  const coefficient = exponent === 0 ? fraction : (1n << 52n) | fraction;
  return {
    coefficient: negative ? -coefficient : coefficient,
    exponent: exponent === 0 ? -1074 : exponent - 1023 - 52,
  };
}

/**
 * Integer-scaled exact determinant. At the bounded input magnitude <=10000,
 * only a few thousand BigInt bits are required even for the smallest subnormal.
 */
export function orient2dExactBinary64V1(
  a: unknown, b: unknown, c: unknown,
  maxAbsCoordinateMM = 10000,
): ExactBinary64OrientationV1 {
  if (!point(a) || !point(b) || !point(c) ||
      typeof maxAbsCoordinateMM !== 'number' || !Number.isFinite(maxAbsCoordinateMM) ||
      maxAbsCoordinateMM <= 0 || maxAbsCoordinateMM > 10000)
    return { status: 'unsupported', reason: 'invalid-input' };

  const values = [a.x, a.y, b.x, b.y, c.x, c.y];
  if (!values.every(Number.isFinite))
    return { status: 'unsupported', reason: 'non-finite-coordinate' };
  if (values.some(value => Math.abs(value) > maxAbsCoordinateMM))
    return { status: 'unsupported', reason: 'out-of-range-coordinate' };

  const parts = values.map(dyadic);
  const common = Math.min(...parts.map(part => part.exponent));
  const [ax, ay, bx, by, cx, cy] = parts.map(part =>
    part.coefficient << BigInt(part.exponent - common));
  const determinant = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return { status: 'exact',
    sign: determinant > 0n ? 'positive' : determinant < 0n ? 'negative' : 'zero',
    method: 'binary64-dyadic-bigint' };
}
