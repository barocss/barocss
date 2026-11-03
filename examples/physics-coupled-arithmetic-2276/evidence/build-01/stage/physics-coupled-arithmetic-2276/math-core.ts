import type {ArithmeticLimits} from './limits.js';
import type {DynamicCounts,RootCertificate,Q,P,IP,Chain,Interval,Point,Root} from './types.js';
export class Unresolved extends Error {}

/** Internal dependency injection; production supplies only its frozen default limits. */
export function createArithmeticContext(LIMIT:Readonly<ArithmeticLimits>) {
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
    const out = a.map(x => imul(x.n, idiv(denominator, x.d)));
    // The removed common denominator and content are positive. Never flip sign.
    return primitiveInteger(out);
  }
  function trimInteger(a: IP): IP {
    while (a.length > 1 && !sign(a[a.length - 1])) a.pop();
    return a;
  }
  function primitiveInteger(a: IP): IP {
    trimInteger(a);
    let content = 0n;
    for (const x of a) content = gcd(content, x);
    if (!sign(content)) return [0n];
    // gcd is nonnegative: only positive rescaling is allowed in a Sturm chain.
    return a.map(x => idiv(x, content));
  }
  function remainder(a: IP, b: IP): IP {
    let out = [...a];
    if (b.length === 1 && !sign(b[0])) fail('DYNAMIC_ZERO_STURM_DIVISOR');
    const leadingB = b[b.length - 1], negativeB = sign(leadingB) < 0;
    const absoluteB = negativeB ? ineg(leadingB) : leadingB;
    let normalized = false;
    while (out.length >= b.length && !(out.length === 1 && !sign(out[0]))) {
      const index = out.length - b.length, leadingR = out[out.length - 1];
      const factor = negativeB ? ineg(leadingR) : leadingR;
      // abs(LC(B))*R - sign(LC(B))*LC(R)*x^index*B cancels the leading term.
      // Its remainder modulo B is a POSITIVE multiple of the old remainder.
      const next = out.map(x => imul(absoluteB, x));
      for (let j = 0; j < b.length; j++) next[index + j] = isub(next[index + j], imul(factor, b[j]));
      out = primitiveInteger(next); normalized = true;
    }
    const negative = out.map(ineg);
    return normalized ? negative : primitiveInteger(negative);
  }
  function derivative(p: ReadonlyArray<bigint>): IP {
    return p.length === 1 ? [0n] : p.slice(1).map((x, i) => { tick(); return imul(x, BigInt(i + 1)); });
  }
  function sturm(p: IP): Chain {
    const chain = [p, derivative(p)];
    if (chain[1].length === 1 && !sign(chain[1][0])) fail('DYNAMIC_CONSTANT_POLYNOMIAL');
    while (chain[chain.length - 1].length > 1) {
      if (chain.length >= 5) fail('DYNAMIC_STURM_CHAIN_LIMIT');
      const r = remainder(chain[chain.length - 2], chain[chain.length - 1]);
      if (r.length === 1 && !sign(r[0])) fail('DYNAMIC_MULTIPLE_ROOT_UNQUALIFIED');
      chain.push(r);
    }
    return Object.freeze(chain.map(member => Object.freeze(member)));
  }
  function point(n: bigint, e: number): Point {
    if (e > LIMIT.exponent) fail('DYNAMIC_DYADIC_EXPONENT_LIMIT');
    checked(n); counts.maxDyadicExponent = Math.max(counts.maxDyadicExponent, e); return Object.freeze({ n, e });
  }
  function value(p: ReadonlyArray<bigint>, x: Point): bigint {
    let result = p[p.length - 1];
    for (let i = p.length - 2; i >= 0; i--)
      result = iadd(imul(result, x.n), ishift(p[i], x.e * (p.length - 1 - i)));
    return result;
  }
  interface Variations { readonly left: number; readonly right: number; readonly root: boolean }
  // There is one immutable chain per invocation, and at most 2+256 dyadic points.
  // A hit reuses an already-checked result; it performs no displaced BigInt work.
  const variationMemo = new Map<Point, Variations>();
  let variationChain: Chain | null = null;
  function variations(chain: Chain, x: Point): Variations {
    if (variationChain === null) variationChain = chain;
    else if (variationChain !== chain) fail('DYNAMIC_VARIATION_CHAIN_IDENTITY');
    const found = variationMemo.get(x);
    if (found) return found;
    if (variationMemo.size >= LIMIT.subdivisions + 2) fail('DYNAMIC_VARIATION_CACHE_BOUND');
    let previousLeft = 0, previousRight = 0, left = 0, right = 0, root = false;
    for (let i = 0; i < chain.length; i++) {
      let order = 0, current = chain[i], s = sign(value(current, x));
      if (i === 0) root = s === 0;
      while (!s) {
        if (current.length === 1) fail('DYNAMIC_ZERO_STURM_MEMBER');
        current = derivative(current); order++; s = sign(value(current, x));
      }
      const leftSign = order % 2 ? -s : s;
      if (previousLeft && previousLeft !== leftSign) left++;
      if (previousRight && previousRight !== s) right++;
      previousLeft = leftSign; previousRight = s;
    }
    const result = Object.freeze({ left, right, root }); variationMemo.set(x, result); return result;
  }
  function countOpen(chain: Chain, lo: Point, hi: Point): number {
    const count = variations(chain, lo).right - variations(chain, hi).left;
    if (count < 0 || count > 4) fail('DYNAMIC_INVALID_STURM_COUNT');
    return count;
  }
  function midpoint(lo: Point, hi: Point): Point {
    if (++counts.subdivisions > LIMIT.subdivisions) fail('DYNAMIC_SUBDIVISION_LIMIT');
    const e = Math.max(lo.e, hi.e);
    return point(iadd(ishift(lo.n, e - lo.e), ishift(hi.n, e - hi.e)), e + 1);
  }
  function isolate(p: IP, chain: Chain): Root[] {
    const lo = point(0n, 0), hi = point(1n, 0);
    if (variations(chain, lo).root || variations(chain, hi).root) fail('DYNAMIC_ENDPOINT_ROOT_UNQUALIFIED');
    const total = countOpen(chain, lo, hi);
    if (!total) fail('DYNAMIC_NO_INTERIOR_ROOT');
    const roots: Root[] = [], stack = [{ lo, hi, count: total }];
    while (stack.length) {
      const cell = stack.pop()!;
      if (!cell.count) continue;
      if (cell.count === 1 && Math.min(cell.lo.e, cell.hi.e) >= LIMIT.initialExponent) {
        roots.push({ lo: cell.lo, hi: cell.hi, exact: false }); continue;
      }
      const mid = midpoint(cell.lo, cell.hi), exact = variations(chain, mid).root;
      const left = countOpen(chain, cell.lo, mid), right = countOpen(chain, mid, cell.hi);
      if (left + right + Number(exact) !== cell.count) fail('DYNAMIC_ROOT_PARTITION_COUNT');
      if (right) stack.push({ lo: mid, hi: cell.hi, count: right });
      if (exact) roots.push({ lo: mid, hi: mid, exact: true });
      if (left) stack.push({ lo: cell.lo, hi: mid, count: left });
    }
    if (roots.length !== total || roots.length > 4) fail('DYNAMIC_INCOMPLETE_ROOT_POPULATION');
    return roots;
  }
  function refine(root: Root, p: IP, chain: Chain, rounds: number): void {
    for (let i = 0; i < rounds && !root.exact; i++) {
      const mid = midpoint(root.lo, root.hi);
      if (variations(chain, mid).root) { root.lo = mid; root.hi = mid; root.exact = true; break; }
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

  function classifyRoots(polynomial:IP,h:P) {
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
    return {chain,roots,rootCertificates,selected};
  }
  let initialized = false;
  function initialize() {
    if(initialized) fail('ARITHMETIC_CONTEXT_ALREADY_INITIALIZED');
    zero = q(0n); one = q(1n); initialized = true; return {zero,one};
  }
  return {initialize,copyCounts:():DynamicCounts=>({...counts}),fail,sign,bits,checked,iadd,ineg,isub,imul,idiv,irem,ishift,gcd,q,neg,add,sub,mul,div,cmp,same,text,vtext,itext,parsed,word,dot,vm,va,vs,trim,pAdd,pNeg,pSub,pScale,pMul,primitive,trimInteger,primitiveInteger,remainder,derivative,sturm,point,value,variations,countOpen,midpoint,isolate,refine,singleton,iAdd,iNeg,iSub,iMul,iDiv,pInterval,pointQ,rootInterval,isqrt,sqrtRange,numeric,adjacent,present,classifyRoots};
}
export type ArithmeticContext=ReturnType<typeof createArithmeticContext>;
