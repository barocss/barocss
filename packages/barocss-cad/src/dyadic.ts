// Exact value of a binary64: v = m / 2^k with k ≥ 0 as small as possible (shared by the exact
// arrangement and the exact polyhedral Boolean).
const view = new DataView(new ArrayBuffer(8));
export function binary64Dyadic(v: number): { readonly m: bigint; readonly k: number } {
  if (!Number.isFinite(v)) throw new RangeError('finite coordinates required');
  if (v === 0) return { m: 0n, k: 0 };
  view.setFloat64(0, v); const bits = view.getBigUint64(0), exp = Number((bits >> 52n) & 2047n), frac = bits & 0xfffffffffffffn;
  let m = exp === 0 ? frac : frac | (1n << 52n), e = (exp === 0 ? 1 : exp) - 1075;
  while (m && !(m & 1n) && e < 0) { m >>= 1n; e++; }
  if (bits >> 63n) m = -m;
  return e >= 0 ? { m: m << BigInt(e), k: 0 } : { m, k: -e };
}
