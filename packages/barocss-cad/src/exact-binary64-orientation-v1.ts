/**
 * Exact orientation of the six REPRESENTED IEEE-754 binary64 input values.
 * No tolerance, no approximation, no statement about measurement error,
 * true design intent, non-planar topology or B-Rep material validity.
 */
export type ExactBinary64OrientationV1 =
  | { readonly status: 'exact'; readonly sign: 'positive' | 'negative' | 'zero'; readonly method: 'binary64-dyadic-bigint' }
  | { readonly status: 'unsupported'; readonly reason: 'invalid-input' | 'non-finite-coordinate' | 'out-of-range-coordinate' };
export interface Binary64PointV1 { readonly x: number; readonly y: number }

/** Admit and capture exact own data values once; never re-read input.x/y. */
const point = (input: unknown): Binary64PointV1 | null => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  try {
    const proto = Object.getPrototypeOf(input);
    if (proto !== Object.prototype && proto !== null) return null;
    const fields = Object.getOwnPropertyDescriptors(input);
    const keys = Reflect.ownKeys(fields);
    if (keys.length !== 2 || !['x', 'y'].every(k =>
      Object.hasOwn(fields, k) && 'value' in fields[k] &&
      fields[k].enumerable && typeof fields[k].value === 'number')) return null;
    return { x: fields.x.value as number, y: fields.y.value as number };
  } catch {
    // A hostile Proxy can throw while reflecting descriptors. Refuse rather
    // than allowing it to drive a native topology decision or propagate.
    return null;
  }
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
  const pa = point(a), pb = point(b), pc = point(c);
  if (!pa || !pb || !pc ||
      typeof maxAbsCoordinateMM !== 'number' || !Number.isFinite(maxAbsCoordinateMM) ||
      maxAbsCoordinateMM <= 0 || maxAbsCoordinateMM > 10000)
    return { status: 'unsupported', reason: 'invalid-input' };

  const values = [pa.x, pa.y, pb.x, pb.y, pc.x, pc.y];
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
