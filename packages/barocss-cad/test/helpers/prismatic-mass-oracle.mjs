// Test-only exact binary64 arithmetic and rectangular volume integration. Product imports: zero.
export function rational(n, d = 1n) {
  if (d === 0n) throw new Error('Zero oracle denominator.');
  if (d < 0n) { n = -n; d = -d; }
  let a = n < 0n ? -n : n, b = d;
  while (b !== 0n) { const remainder = a % b; a = b; b = remainder; }
  return { n: n / a, d: d / a };
}
export const add = (a, b) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a, b) => rational(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a, b) => rational(a.n * b.n, a.d * b.d);
export const div = (a, b) => rational(a.n * b.d, a.d * b.n);
export const abs = a => rational(a.n < 0n ? -a.n : a.n, a.d);
export const compare = (a, b) => { const n = a.n * b.d - b.n * a.d; return n < 0n ? -1 : n > 0n ? 1 : 0; };
export const power = (a, exponent) => rational(a.n ** BigInt(exponent), a.d ** BigInt(exponent));
export const text = a => ({ numerator: String(a.n), denominator: String(a.d) });
export function bits(value) { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value); return view.getBigUint64(0); }
export function fromNumber(value) {
  if (!Number.isFinite(value)) throw new Error('The oracle requires finite represented input.');
  const stored = bits(value), exponent = Number((stored >> 52n) & 2047n), fraction = stored & ((1n << 52n) - 1n);
  const significand = exponent === 0 ? fraction : fraction | (1n << 52n), signed = stored >> 63n ? -significand : significand;
  const scale = exponent === 0 ? -1074 : exponent - 1075;
  return scale < 0 ? rational(signed, 1n << BigInt(-scale)) : rational(signed << BigInt(scale));
}
/** Step through adjacent stored finite values; fixtures use nonzero normal values away from overflow. */
export function stepStored(value, count) {
  if (!Number.isFinite(value) || value === 0) throw new Error('Stored-step fixture needs a nonzero finite value.');
  const view = new DataView(new ArrayBuffer(8)), delta = BigInt(count) * (value < 0 ? -1n : 1n);
  view.setBigUint64(0, bits(value) + delta); const result = view.getFloat64(0);
  if (!Number.isFinite(result)) throw new Error('Stored-step fixture overflow.');
  return result;
}
/** Integral of t^degree on exact stored [a,b], using power differences, not production factorization. */
export function longitudinal(a, b, degree) {
  return div(sub(power(fromNumber(b), degree + 1), power(fromNumber(a), degree + 1)), rational(BigInt(degree + 1)));
}
function section(rect) {
  const [x0, y0, x1, y1] = rect.map(fromNumber), dx = sub(x1, x0), dy = sub(y1, y0);
  const x1m = div(sub(power(x1, 2), power(x0, 2)), rational(2n)), y1m = div(sub(power(y1, 2), power(y0, 2)), rational(2n));
  const x2m = div(sub(power(x1, 3), power(x0, 3)), rational(3n)), y2m = div(sub(power(y1, 3), power(y0, 3)), rational(3n));
  return [mul(dx, dy), mul(x1m, dy), mul(y1m, dx), mul(x2m, dy), mul(y2m, dx), mul(x1m, y1m)];
}
/** Exact rectangle sections × direct longitudinal polynomial integrals, then exact weighted central tensor. */
export function rectangularMass(slabs, density) {
  const I = Array.from({ length: 10 }, () => rational(0n));
  for (const slab of slabs) {
    const [A, X, Y, XX, YY, XY] = section(slab.rect), J0 = longitudinal(slab.z0, slab.z1, 0), J1 = longitudinal(slab.z0, slab.z1, 1), J2 = longitudinal(slab.z0, slab.z1, 2);
    const terms = [mul(A, J0), mul(X, J0), mul(Y, J0), mul(A, J1), mul(XX, J0), mul(YY, J0), mul(A, J2), mul(XY, J0), mul(X, J1), mul(Y, J1)];
    for (let k = 0; k < 10; k++) I[k] = add(I[k], terms[k]);
  }
  const [V, X, Y, Z, XX, YY, ZZ, XY, XZ, YZ] = I, centroid = [X, Y, Z].map(moment => div(moment, V)), rho = div(fromNumber(density), rational(1000n));
  const centered = (raw, a, b) => sub(raw, mul(V, mul(centroid[a], centroid[b])));
  const xx = centered(XX, 0, 0), yy = centered(YY, 1, 1), zz = centered(ZZ, 2, 2), xy = centered(XY, 0, 1), xz = centered(XZ, 0, 2), yz = centered(YZ, 1, 2);
  const negative = value => rational(-value.n, value.d);
  return { integrals: I, volume: V, mass: mul(V, rho), centroid,
    inertia: [[add(yy, zz), negative(xy), negative(xz)], [negative(xy), add(xx, zz), negative(yz)], [negative(xz), negative(yz), add(xx, yy)]].map(row => row.map(value => mul(value, rho))) };
}
