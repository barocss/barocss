const bits = new DataView(new ArrayBuffer(8));

/** A finite binary64 value as an integer in fixed units of 2^-1074. */
export function finiteBinary64Integer(value: number): bigint {
  bits.setFloat64(0, value, false);
  const raw = bits.getBigUint64(0, false);
  const exponent = Number((raw >> 52n) & 2047n), fraction = raw & ((1n << 52n) - 1n);
  const magnitude = exponent === 0 ? fraction : ((1n << 52n) | fraction) << BigInt(exponent - 1);
  return raw >> 63n ? -magnitude : magnitude;
}
