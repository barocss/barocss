/** Private exact static-contact arithmetic. No engine, geometry builder, or dependencies. */
export type Vec = [number, number, number];
export interface StaticInput {
  pointM: Vec; comM: Vec; orientationXYZW: [number, number, number, number];
  freeVelocityMps: Vec; freeAngularVelocityRadps: Vec;
  massKg: number; halfExtentsM: Vec; muStaticA: number; muStaticB: number;
  nativeFaceAxis: 0 | 1 | 2; nativeFaceSign: -1 | 1;
  nativeNormalDirection: [string, string, string];
  nativePointExact: [string, string, string];
}
interface Q { n: bigint; d: bigint }
type V = [Q, Q, Q];
export interface Counts { rationalOps: number; gcdSteps: number; peakBits: number }
export interface StaticCertificate {
  nativePointM: string[]; armM: string[]; freePointVelocityMps: string[]; physicalK: string[][];
  principalMinors: string[]; nativeUnitNormal: string[]; exactImpulseNs: string[];
  exactNormalNs: string; exactTangentNs: string[]; exactConeMarginSquared: string;
  exactContactResidual: string[]; counts: Counts;
}
export type StaticResult =
  | { status: 'STATIC_TARGET'; worldImpulseNs: Vec; normalNs: number; tangentNs: Vec; certificate: StaticCertificate }
  | { status: 'COUPLED_DYNAMIC_REQUIRED'; certificate: StaticCertificate }
  | { status: 'UNRESOLVED'; reason: string; counts: Counts };
const BIT_LIMIT = 16384, RATIONAL_LIMIT = 4096, GCD_LIMIT = 262144;
class Unresolved extends Error {}

export function coupledStaticTarget(input: StaticInput): StaticResult {
  const counts: Counts = { rationalOps: 0, gcdSteps: 0, peakBits: 0 };
  const bits = (n: bigint): number => (n < 0n ? -n : n).toString(2).length;
  function check(n: bigint): bigint {
    const b = bits(n); counts.peakBits = Math.max(counts.peakBits, b);
    if (b > BIT_LIMIT) throw new Unresolved('EXACT_BIT_LIMIT');
    return n;
  }
  function product(a: bigint, b: bigint): bigint {
    if (a !== 0n && b !== 0n && bits(a) + bits(b) > BIT_LIMIT) throw new Unresolved('EXACT_PRODUCT_BIT_LIMIT');
    return check(a * b);
  }
  function q(n: bigint, d = 1n): Q {
    if (++counts.rationalOps > RATIONAL_LIMIT) throw new Unresolved('RATIONAL_WORK_LIMIT');
    if (d === 0n) throw new Unresolved('ZERO_EXACT_DENOMINATOR');
    check(n); check(d);
    if (n === 0n) return { n: 0n, d: 1n };
    if (d < 0n) { n = -n; d = -d; }
    let a = n < 0n ? -n : n, b = d;
    while (b !== 0n) {
      if (++counts.gcdSteps > GCD_LIMIT) throw new Unresolved('GCD_WORK_LIMIT');
      const r = a % b; a = b; b = r;
    }
    return { n: n / a, d: d / a };
  }
  const neg = (a: Q): Q => ({ n: -a.n, d: a.d });
  const add = (a: Q, b: Q): Q => q(check(product(a.n, b.d) + product(b.n, a.d)), product(a.d, b.d));
  const sub = (a: Q, b: Q): Q => add(a, neg(b));
  const mul = (a: Q, b: Q): Q => q(product(a.n, b.n), product(a.d, b.d));
  const div = (a: Q, b: Q): Q => q(product(a.n, b.d), product(a.d, b.n));
  const same = (a: Q, b: Q): boolean => a.n === b.n && a.d === b.d;
  const text = (a: Q): string => `${a.n}/${a.d}`;
  const vtext = (a: V): string[] => a.map(text);
  const finite = (a: number[]): boolean => {
    for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) return false;
    return true;
  };
  function word(value: number): Q {
    if (!Number.isFinite(value)) throw new Unresolved('NONFINITE_INPUT');
    const data = new DataView(new ArrayBuffer(8)); data.setFloat64(0, value, false);
    const raw = data.getBigUint64(0, false), e = Number(raw >> 52n & 2047n);
    const mantissa = ((raw & 0xfffffffffffffn) | (e ? 0x10000000000000n : 0n)) * (raw >> 63n ? -1n : 1n);
    const power = e ? e - 1075 : -1074;
    return power < 0 ? q(mantissa, 1n << BigInt(-power)) : q(mantissa << BigInt(power));
  }
  const vec = (a: Vec): V => a.map(word) as V;
  const vs = (a: V, b: V): V => a.map((x, i) => sub(x, b[i])) as V;
  const va = (a: V, b: V): V => a.map((x, i) => add(x, b[i])) as V;
  const vm = (a: V, s: Q): V => a.map(x => mul(x, s)) as V;
  const dot = (a: V, b: V): Q => add(add(mul(a[0], b[0]), mul(a[1], b[1])), mul(a[2], b[2]));
  const cross = (a: V, b: V): V => [sub(mul(a[1], b[2]), mul(a[2], b[1])),
    sub(mul(a[2], b[0]), mul(a[0], b[2])), sub(mul(a[0], b[1]), mul(a[1], b[0]))];
  function parsed(value: string): Q {
    if (typeof value !== 'string' || value.length > 4096 || !/^-?\d+(?:\/\d+)?$/.test(value)) throw new Unresolved('NATIVE_NORMAL_ENCODING');
    const [n, d = '1'] = value.split('/'); return q(BigInt(n), BigInt(d));
  }
  function numeric(a: Q): number {
    const n = a.n < 0n ? -a.n : a.n;
    if (!n) return 0;
    const shift = (v: bigint, count: number): bigint => {
      if (bits(v) + count > BIT_LIMIT) throw new Unresolved('PRESENTATION_SHIFT_BIT_LIMIT');
      return check(v << BigInt(count));
    };
    let exponent = bits(n) - bits(a.d);
    if (exponent >= 0 ? n < shift(a.d, exponent) : shift(n, -exponent) < a.d) exponent--;
    if (exponent > 1023) throw new Unresolved('NONFINITE_PRESENTATION');
    const unit = Math.max(-1074, exponent - 52);
    const numerator = unit < 0 ? shift(n, -unit) : n;
    const denominator = unit > 0 ? shift(a.d, unit) : a.d;
    let significand = numerator / denominator;
    const remainder = numerator % denominator, twice = check(remainder + remainder);
    if (twice > denominator || twice === denominator && (significand & 1n) !== 0n) significand++;
    const result = Number(significand) * 2 ** unit;
    if (!Number.isFinite(result)) throw new Unresolved('NONFINITE_PRESENTATION');
    return a.n < 0n ? -result : result;
  }
  try {
    if (input === null || typeof input !== 'object') throw new Unresolved('INPUT_SHAPE');
    const vectors = [input.pointM, input.comM, input.freeVelocityMps, input.freeAngularVelocityRadps, input.halfExtentsM];
    if (vectors.some(a => !Array.isArray(a) || a.length !== 3 || !finite(a))
      || !Array.isArray(input.orientationXYZW) || input.orientationXYZW.length !== 4 || !finite(input.orientationXYZW)
      || !Array.isArray(input.nativeNormalDirection) || input.nativeNormalDirection.length !== 3
      || !Array.isArray(input.nativePointExact) || input.nativePointExact.length !== 3
      || [0, 1, 2].some(i => typeof input.nativeNormalDirection[i] !== 'string' || typeof input.nativePointExact[i] !== 'string')) throw new Unresolved('INPUT_SHAPE');
    if (input.massKg !== 1 || input.halfExtentsM.some(x => x !== .5)
      || input.freeAngularVelocityRadps.some(x => x !== 0) || input.muStaticA !== 1 || input.muStaticB !== 1) throw new Unresolved('OUTSIDE_STATIC_UNIT_CUBE_PROFILE');
    if (![0, 1, 2].includes(input.nativeFaceAxis) || ![-1, 1].includes(input.nativeFaceSign)) throw new Unresolved('NATIVE_FACE_METADATA');
    const zero = q(0n), one = q(1n), two = q(2n), six = q(6n);
    const [x, y, z, w] = input.orientationXYZW.map(word), norm = add(add(mul(x, x), mul(y, y)), add(mul(z, z), mul(w, w)));
    if (norm.n <= 0n) throw new Unresolved('ZERO_QUATERNION');
    const rows: V[] = [
      [sub(norm, mul(two, add(mul(y, y), mul(z, z)))), mul(two, sub(mul(x, y), mul(z, w))), mul(two, add(mul(x, z), mul(y, w)))],
      [mul(two, add(mul(x, y), mul(z, w))), sub(norm, mul(two, add(mul(x, x), mul(z, z)))), mul(two, sub(mul(y, z), mul(x, w)))],
      [mul(two, sub(mul(x, z), mul(y, w))), mul(two, add(mul(y, z), mul(x, w))), sub(norm, mul(two, add(mul(x, x), mul(y, y))))],
    ];
    const axes = [0, 1, 2].map(i => rows.map(row => div(row[i], norm)) as V);
    const normal = vm(axes[input.nativeFaceAxis], word(input.nativeFaceSign));
    const supplied = input.nativeNormalDirection.map(parsed) as V;
    if (!same(dot(normal, normal), one) || cross(normal, supplied).some(v => v.n !== 0n) || dot(normal, supplied).n <= 0n) throw new Unresolved('NATIVE_NORMAL_CORRESPONDENCE');
    const point = vec(input.pointM), nativePoint = input.nativePointExact.map(parsed) as V;
    if (nativePoint.some((value, i) => !same(value, point[i]))) throw new Unresolved('NATIVE_POINT_PRESENTATION_NOT_EXACT');
    const arm = vs(point, vec(input.comM)), half = q(1n, 2n);
    if (!same(dot(normal, arm), neg(half)) || axes.some((axis, i) => {
      const local = dot(axis, arm);
      return i !== input.nativeFaceAxis && sub(mul(local, local), mul(half, half)).n >= 0n;
    })) throw new Unresolved('NATIVE_FINITE_FACE_INTERIOR');
    const free = va(vec(input.freeVelocityMps), cross(vec(input.freeAngularVelocityRadps), arm));
    const armSquared = dot(arm, arm);
    const matrix = [0, 1, 2].map(i => [0, 1, 2].map(j => add(i === j ? one : zero,
      mul(six, sub(i === j ? armSquared : zero, mul(arm[i], arm[j]))))) as V);
    // Adjugate columns via row cofactors, independent of the Gaussian reference.
    const c0 = cross(matrix[1], matrix[2]), c1 = cross(matrix[2], matrix[0]), c2 = cross(matrix[0], matrix[1]);
    const determinant = dot(matrix[0], c0);
    const minor2 = sub(mul(matrix[0][0], matrix[1][1]), mul(matrix[0][1], matrix[1][0]));
    if (matrix[0][0].n <= 0n || minor2.n <= 0n || determinant.n <= 0n) throw new Unresolved('PHYSICAL_K_NOT_SPD');
    const rhs = vm(free, q(-1n));
    const target = [0, 1, 2].map(i => div(add(add(mul(c0[i], rhs[0]), mul(c1[i], rhs[1])), mul(c2[i], rhs[2])), determinant)) as V;
    const residual = va(free, matrix.map(row => dot(row, target)) as V);
    if (residual.some(v => v.n !== 0n)) throw new Unresolved('EXACT_LINEAR_RESIDUAL');
    const load = dot(target, normal), tangent = vs(target, vm(normal, load));
    const coefficientSquared = mul(word(input.muStaticA), word(input.muStaticB));
    const margin = sub(dot(tangent, tangent), mul(coefficientSquared, mul(load, load)));
    const certificate: StaticCertificate = { nativePointM: vtext(nativePoint), armM: vtext(arm), freePointVelocityMps: vtext(free), physicalK: matrix.map(vtext),
      principalMinors: [matrix[0][0], minor2, determinant].map(text), nativeUnitNormal: vtext(normal), exactImpulseNs: vtext(target),
      exactNormalNs: text(load), exactTangentNs: vtext(tangent), exactConeMarginSquared: text(margin),
      exactContactResidual: vtext(residual), counts: { ...counts } };
    if (load.n < 0n) throw new Unresolved('SEPARATING_TARGET_NOT_QUALIFIED');
    if (margin.n > 0n) return { status: 'COUPLED_DYNAMIC_REQUIRED', certificate };
    const present = (value: Q): number => {
      const result = numeric(value);
      if (!same(word(result), value)) throw new Unresolved('STATIC_PRESENTATION_NOT_EXACT');
      return result;
    };
    const worldImpulseNs = target.map(present) as Vec, normalNs = present(load), tangentNs = tangent.map(present) as Vec;
    certificate.counts = { ...counts };
    return { status: 'STATIC_TARGET', worldImpulseNs, normalNs, tangentNs, certificate };
  } catch (error) {
    if (!(error instanceof Unresolved)) throw error;
    return { status: 'UNRESOLVED', reason: error.message, counts: { ...counts } };
  }
}
