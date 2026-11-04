/** Private cold single-point contact target. No runtime/geometry solver imports. */
import { coupledStaticTarget, type StaticInput, type StaticResult, type StaticCertificate,
  type Counts as StaticCounts, type Vec } from '../physics-coupled-contact-2276/candidate.js';

export interface CoupledInput extends StaticInput {
  muDynamicA: number;
  muDynamicB: number;
  /** Actual represented query normal. Never used for exact branch/root selection. */
  reportedNormal: Vec;
}
export interface DynamicCounts {
  rationalOps: number; integerOps: number; gcdSteps: number; peakBits: number;
  subdivisions: number; maxDyadicExponent: number;
}
export interface RootCertificate {
  lower: string; upper: string; openRootCount: number; exactRationalRoot: boolean;
  hRange: [string, string]; disposition: 'ADMISSIBLE' | 'NEGATIVE_NORMAL';
}
export interface DynamicCertificate {
  staticPriority: StaticCertificate;
  nativeUnitNormal: string[]; nativeTangentAxes: string[][];
  effectiveDynamicCoefficient: string; dynamicCoefficientSquared: string;
  k: string; c: string[]; dBlock: string[][]; schurA: string[][]; schurB: string[];
  polynomialAscending: string[]; sturmAscending: string[][]; roots: RootCertificate[];
  selectedRoot: number; idealParameter: [string, string];
  idealNormalNs: [string, string]; idealTangentNs: [string, string][];
  idealWorldImpulseNs: [string, string][]; idealSlipMps: [string, string][];
  worldPresentationErrorNs: [string, string][];
  cacheNormalPresentationErrorNs: [string, string]; cacheTangentPresentationErrorNs: [string, string][];
  representedNormalNs: string; representedTangentNs: string[];
  representedContactVelocityMps: string[];
  residualBounds: Record<string, [string, string]>;
  staticCounts: StaticCounts; dynamicCounts: DynamicCounts;
  cumulativeRationalOps: number; cumulativeGcdSteps: number;
}
type StaticTerminal = Extract<StaticResult, { status: 'UNRESOLVED' }>
  | (Extract<StaticResult, { status: 'STATIC_TARGET' }> & {
      dynamicAdmissionCounts: DynamicCounts; cumulativeRationalOps: number; cumulativeGcdSteps: number });
export type CoupledResult = StaticTerminal
  | { status: 'DYNAMIC_TARGET'; worldImpulseNs: Vec; normalNs: number; tangentNs: Vec;
      certificate: DynamicCertificate }
  | { status: 'UNRESOLVED'; reason: string; stage: 'dynamic'; staticCounts: StaticCounts;
      dynamicCounts: DynamicCounts };

interface Q { n: bigint; d: bigint }
type V = [Q, Q, Q];
type P = Q[];
type IP = bigint[];
type Interval = [Q, Q];
interface Point { n: bigint; e: number }
interface Root { lo: Point; hi: Point; exact: boolean }
const LIMIT = Object.freeze({ bits: 16384, rationals: 4096, integerOps: 262144,
  gcdSteps: 262144, subdivisions: 256, exponent: 128, initialExponent: 64 });
class Unresolved extends Error {}

/** Static J/N/T and its complete certificate remain unchanged after common eligibility. */
export function coupledContactTarget(input: CoupledInput): CoupledResult {
  const initial = coupledStaticTarget(input);
  if (initial.status === 'UNRESOLVED') return initial;
  const staticCertificate = initial.certificate, staticCounts = { ...initial.certificate.counts };
  const counts: DynamicCounts = { rationalOps: 0, integerOps: 0, gcdSteps: 0, peakBits: 0,
    subdivisions: 0, maxDyadicExponent: 0 };
  function fail(reason: string): never { throw new Unresolved(reason); }
  function tick(n = 1): void {
    counts.integerOps += n;
    if (counts.integerOps > LIMIT.integerOps) fail('DYNAMIC_INTEGER_WORK_LIMIT');
  }
  function sign(n: bigint): number { tick(2); return n < 0n ? -1 : n > 0n ? 1 : 0; }
  function bits(n: bigint): number {
    tick(2); return (n < 0n ? -n : n).toString(2).length;
  }
  function checked(n: bigint): bigint {
    const b = bits(n); counts.peakBits = Math.max(counts.peakBits, b);
    if (b > LIMIT.bits) fail('DYNAMIC_EXACT_BIT_LIMIT');
    return n;
  }
  function iadd(a: bigint, b: bigint): bigint { tick(); return checked(a + b); }
  function ineg(a: bigint): bigint { tick(); return checked(-a); }
  function isub(a: bigint, b: bigint): bigint { return iadd(a, ineg(b)); }
  function imul(a: bigint, b: bigint): bigint {
    if (sign(a) && sign(b) && bits(a) + bits(b) > LIMIT.bits) fail('DYNAMIC_PRODUCT_BIT_LIMIT');
    tick(); return checked(a * b);
  }
  function idiv(a: bigint, b: bigint): bigint {
    if (!sign(b)) fail('DYNAMIC_ZERO_INTEGER_DIVISOR');
    tick(); return checked(a / b);
  }
  function irem(a: bigint, b: bigint): bigint {
    if (!sign(b)) fail('DYNAMIC_ZERO_INTEGER_DIVISOR');
    tick(); return checked(a % b);
  }
  function ishift(a: bigint, e: number): bigint {
    if (!Number.isInteger(e) || e < 0 || bits(a) + e > LIMIT.bits) fail('DYNAMIC_SHIFT_BIT_LIMIT');
    tick(2); return checked(a << BigInt(e));
  }
  function gcd(a: bigint, b: bigint): bigint {
    if (sign(a) < 0) a = ineg(a);
    if (sign(b) < 0) b = ineg(b);
    while (sign(b)) {
      if (++counts.gcdSteps > LIMIT.gcdSteps) fail('DYNAMIC_GCD_WORK_LIMIT');
      const r = irem(a, b); a = b; b = r;
    }
    return a;
  }
  function q(n: bigint, d = 1n): Q {
    if (++counts.rationalOps > LIMIT.rationals) fail('DYNAMIC_RATIONAL_WORK_LIMIT');
    checked(n); checked(d);
    if (!sign(d)) fail('DYNAMIC_ZERO_DENOMINATOR');
    if (!sign(n)) return { n: 0n, d: 1n };
    if (sign(d) < 0) { n = ineg(n); d = ineg(d); }
    const g = gcd(n, d); return { n: idiv(n, g), d: idiv(d, g) };
  }
  /** Only cross-cancelled arithmetic below may use this already-reduced constructor. */
  function reduced(n: bigint, d: bigint): Q {
    if (++counts.rationalOps > LIMIT.rationals) fail('DYNAMIC_RATIONAL_WORK_LIMIT');
    checked(n); checked(d);
    if (!sign(d)) fail('DYNAMIC_ZERO_DENOMINATOR');
    if (!sign(n)) return { n: 0n, d: 1n };
    return sign(d) < 0 ? { n: ineg(n), d: ineg(d) } : { n, d };
  }
  const neg = (a: Q): Q => ({ n: ineg(a.n), d: a.d });
  function add(a: Q, b: Q): Q {
    if (!sign(a.n)) return b;
    if (!sign(b.n)) return a;
    const g = gcd(a.d, b.d), ad = idiv(a.d, g), bd = idiv(b.d, g);
    const numerator = iadd(imul(a.n, bd), imul(b.n, ad)), h = gcd(numerator, g);
    // Reduced inputs imply the only possible common factor is in g.
    return reduced(idiv(numerator, h), imul(ad, idiv(b.d, h)));
  }
  const sub = (a: Q, b: Q): Q => add(a, neg(b));
  function mul(a: Q, b: Q): Q {
    if (!sign(a.n) || !sign(b.n)) return zero;
    const g = gcd(a.n, b.d), h = gcd(b.n, a.d);
    return reduced(imul(idiv(a.n, g), idiv(b.n, h)), imul(idiv(a.d, h), idiv(b.d, g)));
  }
  function div(a: Q, b: Q): Q {
    if (!sign(b.n)) fail('DYNAMIC_ZERO_DENOMINATOR');
    if (!sign(a.n)) return zero;
    const g = gcd(a.n, b.n), h = gcd(a.d, b.d);
    return reduced(imul(idiv(a.n, g), idiv(b.d, h)), imul(idiv(a.d, h), idiv(b.n, g)));
  }
  const cmp = (a: Q, b: Q): number => sign(isub(imul(a.n, b.d), imul(b.n, a.d)));
  const same = (a: Q, b: Q): boolean => cmp(a, b) === 0;
  const text = (a: Q): string => `${a.n}/${a.d}`;
  const vtext = (a: Q[]): string[] => a.map(text);
  const itext = (a: Interval): [string, string] => [text(a[0]), text(a[1])];
  function parsed(s: string): Q {
    if (typeof s !== 'string' || s.length > 4096 || !/^-?\d+\/\d+$/.test(s)) fail('DYNAMIC_CERTIFICATE_ENCODING');
    const [n, d] = s.split('/'); tick(2); return q(BigInt(n), BigInt(d));
  }
  function word(value: number): Q {
    if (!Number.isFinite(value)) fail('DYNAMIC_NONFINITE_INPUT');
    const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, value, false);
    tick(8);
    const raw = bytes.getBigUint64(0, false), exponent = Number(raw >> 52n & 2047n);
    const mantissa = (raw & 0xfffffffffffffn) | (exponent ? 0x10000000000000n : 0n);
    const signed = raw >> 63n ? ineg(mantissa) : mantissa;
    const power = exponent ? exponent - 1075 : -1074;
    return power < 0 ? q(signed, ishift(1n, -power)) : q(ishift(signed, power));
  }
  const dot = (a: Q[], b: Q[]): Q => a.reduce((sum, x, i) => add(sum, mul(x, b[i])), zero);
  const vm = (a: Q[], s: Q): Q[] => a.map(x => mul(x, s));
  const va = (a: Q[], b: Q[]): Q[] => a.map((x, i) => add(x, b[i]));
  const vs = (a: Q[], b: Q[]): Q[] => a.map((x, i) => sub(x, b[i]));
  let zero: Q, one: Q;

  function trim(a: P): P { while (a.length > 1 && !sign(a[a.length - 1].n)) a.pop(); return a; }
  function pAdd(a: P, b: P): P {
    return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] ?? zero, b[i] ?? zero)));
  }
  function pNeg(a: P): P { return a.map(neg); }
  function pSub(a: P, b: P): P { return pAdd(a, pNeg(b)); }
  function pScale(a: P, s: Q): P { return trim(a.map(x => mul(x, s))); }
  function pMul(a: P, b: P): P {
    if (a.length + b.length - 2 > 4) fail('DYNAMIC_POLYNOMIAL_DEGREE_LIMIT');
    const out = Array<Q>(a.length + b.length - 1).fill(zero);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] = add(out[i + j], mul(a[i], b[j]));
    return trim(out);
  }
  function primitive(a: P): IP {
    trim(a);
    let denominator = 1n;
    for (const x of a) denominator = imul(idiv(denominator, gcd(denominator, x.d)), x.d);
    let out = a.map(x => imul(x.n, idiv(denominator, x.d))), content = 0n;
    for (const x of out) content = gcd(content, x);
    if (!sign(content)) return [0n];
    out = out.map(x => idiv(x, content));
    // The removed common denominator and content are positive. Never flip sign.
    return out;
  }
  function remainder(a: IP, b: IP): IP {
    let out = a.map(x => q(x));
    const divisor = b.map(x => q(x));
    if (b.length === 1 && !sign(b[0])) fail('DYNAMIC_ZERO_STURM_DIVISOR');
    while (out.length >= b.length && !(out.length === 1 && !sign(out[0].n))) {
      const index = out.length - b.length, factor = div(out[out.length - 1], divisor[divisor.length - 1]);
      for (let j = 0; j < divisor.length; j++) out[index + j] = sub(out[index + j], mul(factor, divisor[j]));
      trim(out);
    }
    return primitive(pNeg(out));
  }
  function derivative(p: IP): IP {
    return p.length === 1 ? [0n] : p.slice(1).map((x, i) => { tick(); return imul(x, BigInt(i + 1)); });
  }
  function sturm(p: IP): IP[] {
    const chain = [p, derivative(p)];
    if (chain[1].length === 1 && !sign(chain[1][0])) fail('DYNAMIC_CONSTANT_POLYNOMIAL');
    while (chain[chain.length - 1].length > 1) {
      if (chain.length >= 5) fail('DYNAMIC_STURM_CHAIN_LIMIT');
      const r = remainder(chain[chain.length - 2], chain[chain.length - 1]);
      if (r.length === 1 && !sign(r[0])) fail('DYNAMIC_MULTIPLE_ROOT_UNQUALIFIED');
      chain.push(r);
    }
    return chain;
  }
  function point(n: bigint, e: number): Point {
    if (e > LIMIT.exponent) fail('DYNAMIC_DYADIC_EXPONENT_LIMIT');
    checked(n); counts.maxDyadicExponent = Math.max(counts.maxDyadicExponent, e); return { n, e };
  }
  function value(p: IP, x: Point): bigint {
    let result = p[p.length - 1];
    for (let i = p.length - 2; i >= 0; i--)
      result = iadd(imul(result, x.n), ishift(p[i], x.e * (p.length - 1 - i)));
    return result;
  }
  function sideSign(p: IP, x: Point, side: -1 | 1): number {
    let derivativeOrder = 0, current = p;
    for (;;) {
      const s = sign(value(current, x));
      if (s) return side === -1 && derivativeOrder % 2 ? -s : s;
      if (current.length === 1) fail('DYNAMIC_ZERO_STURM_MEMBER');
      current = derivative(current); derivativeOrder++;
    }
  }
  function variations(chain: IP[], x: Point, side: -1 | 1): number {
    let previous = 0, result = 0;
    for (const member of chain) {
      const s = sideSign(member, x, side);
      if (previous && previous !== s) result++;
      previous = s;
    }
    return result;
  }
  function countOpen(chain: IP[], lo: Point, hi: Point): number {
    const count = variations(chain, lo, 1) - variations(chain, hi, -1);
    if (count < 0 || count > 4) fail('DYNAMIC_INVALID_STURM_COUNT');
    return count;
  }
  function midpoint(lo: Point, hi: Point): Point {
    if (++counts.subdivisions > LIMIT.subdivisions) fail('DYNAMIC_SUBDIVISION_LIMIT');
    const e = Math.max(lo.e, hi.e);
    return point(iadd(ishift(lo.n, e - lo.e), ishift(hi.n, e - hi.e)), e + 1);
  }
  function isolate(p: IP, chain: IP[]): Root[] {
    const lo = point(0n, 0), hi = point(1n, 0);
    if (!sign(value(p, lo)) || !sign(value(p, hi))) fail('DYNAMIC_ENDPOINT_ROOT_UNQUALIFIED');
    const total = countOpen(chain, lo, hi);
    if (!total) fail('DYNAMIC_NO_INTERIOR_ROOT');
    const roots: Root[] = [], stack = [{ lo, hi, count: total }];
    while (stack.length) {
      const cell = stack.pop()!;
      if (!cell.count) continue;
      if (cell.count === 1 && Math.min(cell.lo.e, cell.hi.e) >= LIMIT.initialExponent) {
        roots.push({ lo: cell.lo, hi: cell.hi, exact: false }); continue;
      }
      const mid = midpoint(cell.lo, cell.hi), exact = !sign(value(p, mid));
      const left = countOpen(chain, cell.lo, mid), right = countOpen(chain, mid, cell.hi);
      if (left + right + Number(exact) !== cell.count) fail('DYNAMIC_ROOT_PARTITION_COUNT');
      if (right) stack.push({ lo: mid, hi: cell.hi, count: right });
      if (exact) roots.push({ lo: mid, hi: mid, exact: true });
      if (left) stack.push({ lo: cell.lo, hi: mid, count: left });
    }
    if (roots.length !== total || roots.length > 4) fail('DYNAMIC_INCOMPLETE_ROOT_POPULATION');
    return roots;
  }
  function refine(root: Root, p: IP, chain: IP[], rounds: number): void {
    for (let i = 0; i < rounds && !root.exact; i++) {
      const mid = midpoint(root.lo, root.hi);
      if (!sign(value(p, mid))) { root.lo = mid; root.hi = mid; root.exact = true; break; }
      const left = countOpen(chain, root.lo, mid), right = countOpen(chain, mid, root.hi);
      if (left + right !== 1) fail('DYNAMIC_REFINEMENT_COUNT');
      if (left) root.hi = mid; else root.lo = mid;
    }
  }
  const singleton = (a: Q): Interval => [a, a];
  const iAdd = (a: Interval, b: Interval): Interval => [add(a[0], b[0]), add(a[1], b[1])];
  const iNeg = (a: Interval): Interval => [neg(a[1]), neg(a[0])];
  const iSub = (a: Interval, b: Interval): Interval => iAdd(a, iNeg(b));
  function iMul(a: Interval, b: Interval): Interval {
    const values = [mul(a[0], b[0]), mul(a[0], b[1]), mul(a[1], b[0]), mul(a[1], b[1])];
    return [values.reduce((x, y) => cmp(x, y) < 0 ? x : y), values.reduce((x, y) => cmp(x, y) > 0 ? x : y)];
  }
  function iDiv(a: Interval, b: Interval): Interval {
    if (cmp(b[0], zero) <= 0 && cmp(b[1], zero) >= 0) fail('DYNAMIC_INTERVAL_ZERO_DIVISOR');
    return iMul(a, [div(one, b[1]), div(one, b[0])]);
  }
  function pInterval(p: P, x: Interval): Interval {
    let result = singleton(p[p.length - 1]);
    for (let i = p.length - 2; i >= 0; i--) result = iAdd(iMul(result, x), singleton(p[i]));
    return result;
  }
  const pointQ = (p: Point): Q => q(p.n, ishift(1n, p.e));
  const rootInterval = (r: Root): Interval => [pointQ(r.lo), pointQ(r.hi)];
  function isqrt(n: bigint): bigint {
    if (sign(n) < 0) fail('DYNAMIC_NEGATIVE_SQRT');
    if (!sign(n)) return 0n;
    let x = ishift(1n, Math.ceil(bits(n) / 2));
    for (;;) {
      const next = idiv(iadd(x, idiv(n, x)), 2n);
      if (sign(isub(next, x)) >= 0) {
        if (sign(isub(imul(x, x), n)) > 0 || sign(isub(imul(iadd(x, 1n), iadd(x, 1n)), n)) <= 0)
          fail('DYNAMIC_INTEGER_SQRT_CERTIFICATE');
        return x;
      }
      x = next;
    }
  }
  function sqrtRange(a: Q): Interval {
    if (sign(a.n) < 0) fail('DYNAMIC_NEGATIVE_SQRT');
    if (!sign(a.n)) return singleton(zero);
    const scaled = ishift(a.n, 256), root = isqrt(idiv(scaled, a.d)), denominator = ishift(1n, 128);
    const lo = q(root, denominator);
    const exact = sign(isub(imul(imul(root, root), a.d), scaled)) === 0;
    const hi = exact ? lo : q(iadd(root, 1n), denominator);
    if (cmp(mul(lo, lo), a) > 0 || cmp(mul(hi, hi), a) < 0) fail('DYNAMIC_SQRT_ENCLOSURE');
    return [lo, hi];
  }
  function numeric(a: Q): number {
    const negative = sign(a.n) < 0, n = negative ? ineg(a.n) : a.n;
    if (!sign(n)) return 0;
    let exponent = bits(n) - bits(a.d);
    if (exponent >= 0 ? sign(isub(n, ishift(a.d, exponent))) < 0
      : sign(isub(ishift(n, -exponent), a.d)) < 0) exponent--;
    if (exponent > 1023) fail('DYNAMIC_NONFINITE_PRESENTATION');
    const unit = Math.max(-1074, exponent - 52);
    const numerator = unit < 0 ? ishift(n, -unit) : n, denominator = unit > 0 ? ishift(a.d, unit) : a.d;
    let significand = idiv(numerator, denominator);
    const twice = imul(irem(numerator, denominator), 2n), comparison = sign(isub(twice, denominator));
    tick();
    if (comparison > 0 || comparison === 0 && (significand & 1n) !== 0n) significand = iadd(significand, 1n);
    tick(); const result = Number(significand) * 2 ** unit;
    if (!Number.isFinite(result)) fail('DYNAMIC_NONFINITE_PRESENTATION');
    return negative ? -result : result;
  }
  function adjacent(value: number, direction: -1 | 1): number {
    if (value === 0) return direction < 0 ? -Number.MIN_VALUE : Number.MIN_VALUE;
    const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, value, false);
    const raw = bytes.getBigUint64(0, false);
    const next = (value > 0) === (direction > 0) ? iadd(raw, 1n) : isub(raw, 1n);
    tick(); bytes.setBigUint64(0, next, false); const result = bytes.getFloat64(0, false);
    if (!Number.isFinite(result)) fail('DYNAMIC_UNBOUNDED_ROUNDING_CELL');
    return result;
  }
  function present(range: Interval): number | null {
    // A nonzero algebraic component must lie strictly inside one RNE cell.
    // Exact zero is proved only by a singleton exact rational evaluation here.
    if (!sign(range[0].n) && !sign(range[1].n)) return 0;
    // A single numeric zero cell covers two IEEE zero signs. Prove the sign too.
    if (cmp(range[0], zero) <= 0 && cmp(range[1], zero) >= 0) return null;
    const value = numeric(div(add(range[0], range[1]), q(2n))), valueQ = word(value);
    const lower = div(add(word(adjacent(value, -1)), valueQ), q(2n));
    const upper = div(add(valueQ, word(adjacent(value, 1))), q(2n));
    if (cmp(range[0], lower) > 0 && cmp(range[1], upper) < 0) return value;
    // A singleton rational midpoint is resolvable exactly by numeric's parity rule.
    if (same(range[0], range[1]) && cmp(range[0], lower) >= 0 && cmp(range[1], upper) <= 0) return numeric(range[0]);
    return null;
  }

  try {
    zero = q(0n); one = q(1n);
    if (input.muDynamicA !== 0.7 || input.muDynamicB !== 0.7) fail('OUTSIDE_DYNAMIC_MATERIAL_PROFILE');
    if (!Array.isArray(input.reportedNormal) || input.reportedNormal.length !== 3
      || [0, 1, 2].some(i => !Number.isFinite(input.reportedNormal[i]))) fail('DYNAMIC_REPORTED_NORMAL_SHAPE');
    const normal = staticCertificate.nativeUnitNormal.map(parsed) as V;
    const publicNormal = input.reportedNormal.map(word) as V, impulseGate = q(1n, 1000000000000n), motionGate = q(1n, 10000000000n);
    if (normal.some((n, i) => cmp(sub(publicNormal[i], n), impulseGate) > 0 || cmp(sub(n, publicNormal[i]), impulseGate) > 0))
      fail('DYNAMIC_REPORTED_NORMAL_CORRESPONDENCE');
    if (initial.status === 'STATIC_TARGET') return { ...initial, dynamicAdmissionCounts: { ...counts },
      cumulativeRationalOps: staticCounts.rationalOps + counts.rationalOps,
      cumulativeGcdSteps: staticCounts.gcdSteps + counts.gcdSteps };
    const matrix = staticCertificate.physicalK.map(row => row.map(parsed) as V);
    const free = staticCertificate.freePointVelocityMps.map(parsed) as V;
    if (sign(parsed(staticCertificate.exactNormalNs).n) <= 0 || sign(parsed(staticCertificate.exactConeMarginSquared).n) <= 0)
      fail('DYNAMIC_STATIC_PRIORITY_GUARD');
    const quaternion = input.orientationXYZW.map(word), [x, y, z, w] = quaternion;
    const norm = dot(quaternion, quaternion), two = q(2n);
    const rows: V[] = [
      [sub(norm, mul(two, add(mul(y, y), mul(z, z)))), mul(two, sub(mul(x, y), mul(z, w))), mul(two, add(mul(x, z), mul(y, w)))],
      [mul(two, add(mul(x, y), mul(z, w))), sub(norm, mul(two, add(mul(x, x), mul(z, z)))), mul(two, sub(mul(y, z), mul(x, w)))],
      [mul(two, sub(mul(x, z), mul(y, w))), mul(two, add(mul(y, z), mul(x, w))), sub(norm, mul(two, add(mul(x, x), mul(y, y))))],
    ];
    const axes = [0, 1, 2].map(i => rows.map(row => div(row[i], norm)) as V);
    const tangent = axes.filter((_, i) => i !== input.nativeFaceAxis);
    if (!same(dot(normal, normal), one) || tangent.some(t => !same(dot(t, t), one) || sign(dot(t, normal).n))
      || sign(dot(tangent[0], tangent[1]).n)) fail('DYNAMIC_NATIVE_FRAME_NOT_ORTHONORMAL');
    const response = (a: Q[], b: Q[]): Q => dot(a, matrix.map(row => dot(row, b)));
    const k = response(normal, normal), c = tangent.map(t => response(normal, t));
    const dBlock = tangent.map(a => tangent.map(b => response(a, b)));
    const aBlock = dBlock.map((row, i) => row.map((value, j) => sub(value, div(mul(c[i], c[j]), k))));
    const un = dot(free, normal), ut = tangent.map(t => dot(free, t));
    const b = ut.map((value, i) => sub(value, div(mul(c[i], un), k)));
    const mu = word(input.muDynamicA), qD = mul(mu, word(input.muDynamicB));
    if (sign(k.n) <= 0 || sign(aBlock[0][0].n) <= 0
      || sign(sub(mul(aBlock[0][0], aBlock[1][1]), mul(aBlock[0][1], aBlock[1][0])).n) <= 0)
      fail('DYNAMIC_SCHUR_NOT_SPD');
    if (!same(aBlock[0][1], aBlock[1][0])) fail('DYNAMIC_SCHUR_NOT_SYMMETRIC');
    if (sign(un.n) >= 0) fail('DYNAMIC_FREE_NORMAL_NOT_CLOSING');
    if (sign(sub(mul(k, k), mul(qD, dot(c, c))).n) <= 0) fail('DYNAMIC_NORMAL_DENOMINATOR_UNQUALIFIED');
    if (!b.some(value => sign(value.n))) fail('DYNAMIC_ZERO_SCHUR_SLIP');
    // M=(1-s)I+s*A, z=adj(M)b, Y=s*z, H=-un*det(M)+c*Y.
    const m00 = [one, sub(aBlock[0][0], one)], m01 = [zero, aBlock[0][1]];
    const m10 = [zero, aBlock[1][0]], m11 = [one, sub(aBlock[1][1], one)];
    const determinant = pSub(pMul(m00, m11), pMul(m01, m10));
    const zPolys = [pSub(pScale(m11, b[0]), pScale(m01, b[1])), pSub(pScale(m00, b[1]), pScale(m10, b[0]))];
    const yPolys = zPolys.map(p => pMul([zero, one], p));
    const h = pAdd(pScale(determinant, neg(un)), pAdd(pScale(yPolys[0], c[0]), pScale(yPolys[1], c[1])));
    const polynomial = primitive(pSub(pScale(pAdd(pMul(yPolys[0], yPolys[0]), pMul(yPolys[1], yPolys[1])), mul(k, k)), pScale(pMul(h, h), qD)));
    if (polynomial.length < 2 || polynomial.length > 5) fail('DYNAMIC_POLYNOMIAL_DEGREE');
    if (sign(value(polynomial, point(0n, 0))) >= 0 || sign(value(polynomial, point(1n, 0))) <= 0)
      fail('DYNAMIC_EXISTENCE_ENDPOINT_SIGNS');
    const chain = sturm(polynomial), roots = isolate(polynomial, chain);
    const rootCertificates: RootCertificate[] = [];
    let selected = -1;
    for (let i = 0; i < roots.length; i++) {
      let hRange = pInterval(h, rootInterval(roots[i]));
      while (cmp(hRange[0], zero) <= 0 && cmp(hRange[1], zero) >= 0) {
        if (roots[i].exact) fail('DYNAMIC_ZERO_NORMAL_ROOT');
        refine(roots[i], polynomial, chain, 8); hRange = pInterval(h, rootInterval(roots[i]));
      }
      const admissible = cmp(hRange[0], zero) > 0;
      if (admissible) {
        if (selected !== -1) fail('DYNAMIC_AMBIGUOUS_ADMISSIBLE_ROOTS');
        selected = i;
      }
      rootCertificates.push({ lower: text(pointQ(roots[i].lo)), upper: text(pointQ(roots[i].hi)),
        openRootCount: roots[i].exact ? 0 : 1, exactRationalRoot: roots[i].exact,
        hRange: itext(hRange), disposition: admissible ? 'ADMISSIBLE' : 'NEGATIVE_NORMAL' });
    }
    if (selected < 0) fail('DYNAMIC_NO_ADMISSIBLE_ROOT');
    const selectedRoot = roots[selected];
    let idealNormal: Interval, idealTangent: Interval[], idealWorld: Interval[], idealSlip: Interval[], sRange: Interval;
    let world: (number | null)[], cacheN: number | null, cacheT: (number | null)[];
    for (;;) {
      sRange = rootInterval(selectedRoot);
      const detRange = pInterval(determinant, sRange), hRange = pInterval(h, sRange);
      if (cmp(detRange[0], zero) <= 0 || cmp(hRange[0], zero) <= 0) fail('DYNAMIC_PRESENTATION_POSITIVITY_UNCERTIFIED');
      idealNormal = iDiv(hRange, iMul(singleton(k), detRange));
      const coordinateT = yPolys.map(p => iNeg(iDiv(pInterval(p, sRange), detRange)));
      idealTangent = [0, 1, 2].map(i => iAdd(iMul(coordinateT[0], singleton(tangent[0][i])), iMul(coordinateT[1], singleton(tangent[1][i]))));
      idealWorld = idealTangent.map((t, i) => iAdd(t, iMul(idealNormal, singleton(normal[i]))));
      idealSlip = zPolys.map(p => iDiv(iMul(iSub(singleton(one), sRange), pInterval(p, sRange)), detRange));
      world = idealWorld.map(present); cacheN = present(idealNormal); cacheT = idealTangent.map(present);
      if (world.every(x => x !== null) && cacheN !== null && cacheT.every(x => x !== null)) break;
      if (selectedRoot.exact) fail('DYNAMIC_RNE_CELL_UNRESOLVED');
      refine(selectedRoot, polynomial, chain, 8);
    }
    if (cacheN === null || world.some(x => x === null) || cacheT.some(x => x === null)) fail('DYNAMIC_INCOMPLETE_PRESENTATION');
    const worldImpulseNs = world as Vec, normalNs: number = cacheN, tangentNs = cacheT as Vec;
    const represented = worldImpulseNs.map(word) as V, cacheNormal = word(normalNs), cacheTangent = tangentNs.map(word) as V;
    const representedN = dot(represented, normal), representedT = vs(represented, vm(normal, representedN));
    const contact = va(free, matrix.map(row => dot(row, represented))), contactNormal = dot(contact, normal);
    const contactTangent = vs(contact, vm(normal, contactNormal)), tangentNorm = sqrtRange(dot(representedT, representedT));
    const slipNorm = sqrtRange(dot(contactTangent, contactTangent));
    const residualBounds: Record<string, [string, string]> = {};
    function gate(name: string, range: Interval, limit: Q): void {
      residualBounds[name] = itext(range);
      if (cmp(range[0], neg(limit)) < 0 || cmp(range[1], limit) > 0) fail('DYNAMIC_PRESENTED_' + name);
    }
    if (sign(representedN.n) <= 0 || cmp(slipNorm[0], motionGate) <= 0) fail('DYNAMIC_PRESENTED_NONACTIVE_OR_ZERO_SLIP');
    gate('normalSpeedMps', singleton(contactNormal), motionGate);
    gate('coneMagnitudeNs', iSub(tangentNorm, singleton(mul(mu, representedN))), impulseGate);
    for (let i = 0; i < 3; i++) {
      gate('antiparallelNs' + i, iAdd(singleton(representedT[i]),
        iDiv(singleton(mul(mul(mu, representedN), contactTangent[i])), slipNorm)), impulseGate);
      gate('cacheTangentAgreementNs' + i, singleton(sub(cacheTangent[i], representedT[i])), impulseGate);
    }
    gate('cacheNormalAgreementNs', singleton(sub(cacheNormal, representedN)), impulseGate);
    gate('cachePublicTangentPlaneNs', singleton(dot(cacheTangent, publicNormal)), impulseGate);
    const work = add(dot(free, represented), div(dot(represented, matrix.map(row => dot(row, represented))), two));
    residualBounds.workJ = itext(singleton(work));
    if (sign(work.n) > 0) fail('DYNAMIC_PRESENTED_POSITIVE_WORK');
    rootCertificates[selected] = { ...rootCertificates[selected], lower: text(pointQ(selectedRoot.lo)), upper: text(pointQ(selectedRoot.hi)),
      openRootCount: selectedRoot.exact ? 0 : 1, exactRationalRoot: selectedRoot.exact,
      hRange: itext(pInterval(h, sRange)) };
    const certificate: DynamicCertificate = { staticPriority: staticCertificate,
      nativeUnitNormal: vtext(normal), nativeTangentAxes: tangent.map(vtext),
      effectiveDynamicCoefficient: text(mu), dynamicCoefficientSquared: text(qD),
      k: text(k), c: vtext(c), dBlock: dBlock.map(vtext), schurA: aBlock.map(vtext), schurB: vtext(b),
      polynomialAscending: polynomial.map(String), sturmAscending: chain.map(p => p.map(String)), roots: rootCertificates,
      selectedRoot: selected, idealParameter: itext(sRange), idealNormalNs: itext(idealNormal),
      idealTangentNs: idealTangent.map(itext), idealWorldImpulseNs: idealWorld.map(itext), idealSlipMps: idealSlip.map(itext),
      worldPresentationErrorNs: represented.map((x, i) => itext(iSub(singleton(x), idealWorld[i]))),
      cacheNormalPresentationErrorNs: itext(iSub(singleton(cacheNormal), idealNormal)),
      cacheTangentPresentationErrorNs: cacheTangent.map((x, i) => itext(iSub(singleton(x), idealTangent[i]))),
      representedNormalNs: text(representedN), representedTangentNs: vtext(representedT),
      representedContactVelocityMps: vtext(contact), residualBounds,
      staticCounts, dynamicCounts: { ...counts }, cumulativeRationalOps: 0, cumulativeGcdSteps: 0 };
    certificate.dynamicCounts = { ...counts };
    certificate.cumulativeRationalOps = staticCounts.rationalOps + counts.rationalOps;
    certificate.cumulativeGcdSteps = staticCounts.gcdSteps + counts.gcdSteps;
    return { status: 'DYNAMIC_TARGET', worldImpulseNs, normalNs, tangentNs, certificate };
  } catch (error) {
    if (!(error instanceof Unresolved)) throw error;
    return { status: 'UNRESOLVED', reason: error.message, stage: 'dynamic', staticCounts, dynamicCounts: { ...counts } };
  }
}
