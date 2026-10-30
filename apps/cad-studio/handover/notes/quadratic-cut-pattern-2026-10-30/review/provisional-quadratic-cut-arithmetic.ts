// Checked dyadic arithmetic for the bounded quadratic CUT planner, not a general curve evaluator.
export interface CutDyadic { readonly n: bigint; readonly e: number }
export type CutRefuse = (code: 'INPUT' | 'CAPABILITY' | 'PARAMETER', message: string) => never;
export interface CutWorkCounts { operations: number; maximumIntegerBits: number; speedEvaluations: number; subdivisions: number; integrationDepth: number; inverseIterations: number }
const FRACTION = (1n << 52n) - 1n, HIDDEN = 1n << 52n;
export class QuadraticCutWork {
  readonly counts: CutWorkCounts = { operations: 0, maximumIntegerBits: 0, speedEvaluations: 0, subdivisions: 0, integrationDepth: 0, inverseIterations: 0 };
  private readonly storage = new DataView(new ArrayBuffer(8));
  constructor(readonly fail: CutRefuse) {}
  take(amount = 1): void { if (this.counts.operations + amount > 200000) this.fail('CAPABILITY', 'quadratic path certification arithmetic budget exhausted'); this.counts.operations += amount; }
  bits(n: bigint): number { this.take(); const size = (n < 0n ? -n : n).toString(2).length; if (size > 8192) this.fail('CAPABILITY', 'quadratic path certification integer bit budget exceeded'); if (size > this.counts.maximumIntegerBits) this.counts.maximumIntegerBits = size; return n === 0n ? 0 : size; }
  plus(a: bigint, b: bigint): bigint { this.take(); if (Math.max(this.bits(a), this.bits(b)) + 1 > 8192 && (a < 0n) === (b < 0n)) this.fail('CAPABILITY', 'quadratic path sum exceeds proof bit budget'); return a + b; }
  minus(a: bigint, b: bigint): bigint { this.take(); return this.plus(a, -b); }
  times(a: bigint, b: bigint): bigint { this.take(); if (this.bits(a) + this.bits(b) > 8192) this.fail('CAPABILITY', 'quadratic path product exceeds proof bit budget'); return a * b; }
  shift(a: bigint, power: number): bigint { this.take(); if (!Number.isSafeInteger(power)) this.fail('CAPABILITY', 'quadratic path shift is not representable'); if (power >= 0 && a !== 0n && this.bits(a) + power > 8192) this.fail('CAPABILITY', 'quadratic path shift exceeds proof bit budget'); return power >= 0 ? a << BigInt(power) : a >> BigInt(-power); }
  quotient(a: bigint, b: bigint): bigint { this.take(); if (b <= 0n || a < 0n) this.fail('CAPABILITY', 'quadratic path interval division needs nonnegative numerator and positive denominator'); return a / b; }
  compare(a: bigint, b: bigint): number { this.take(); return a < b ? -1 : a > b ? 1 : 0; }
  abs(a: bigint): bigint { this.take(); return a < 0n ? -a : a; }
  canonical(value: CutDyadic): CutDyadic { this.take(4); if (value.n === 0n) return { n: 0n, e: 0 }; const magnitude = value.n < 0n ? -value.n : value.n, low = magnitude & -magnitude, trailing = this.bits(low) - 1; return { n: this.shift(value.n, -trailing), e: value.e + trailing }; }
  from(value: number): CutDyadic {
    this.take(10); if (!Number.isFinite(value)) this.fail('INPUT', 'quadratic path requires finite represented numbers'); this.storage.setFloat64(0, value);
    const bits = this.storage.getBigUint64(0), exponent = Number(bits >> 52n & 2047n), fraction = bits & FRACTION;
    return this.canonical({ n: (exponent ? fraction + HIDDEN : fraction) * (bits >> 63n ? -1n : 1n), e: exponent ? exponent - 1075 : -1074 });
  }
  add(a: CutDyadic, b: CutDyadic): CutDyadic { if (this.compare(a.n, 0n) === 0) return b; if (this.compare(b.n, 0n) === 0) return a; const e = Math.min(a.e, b.e); return { n: this.plus(this.shift(a.n, a.e - e), this.shift(b.n, b.e - e)), e }; }
  sub(a: CutDyadic, b: CutDyadic): CutDyadic { this.take(); return this.add(a, { n: -b.n, e: b.e }); }
  mul(a: CutDyadic, b: CutDyadic): CutDyadic { return { n: this.times(a.n, b.n), e: a.e + b.e }; }
  cmp(a: CutDyadic, b: CutDyadic): number { if (this.compare(a.n, 0n) === 0 && this.compare(b.n, 0n) === 0) return 0; const e = Math.min(a.e, b.e); return this.compare(this.shift(a.n, a.e - e), this.shift(b.n, b.e - e)); }
  magnitude(a: CutDyadic): CutDyadic { return { n: this.abs(a.n), e: a.e }; }
  scale(a: CutDyadic, power: number): CutDyadic { this.take(); return { n: a.n, e: a.e + power }; }
  midpoint(a: CutDyadic, b: CutDyadic): CutDyadic { return this.canonical(this.scale(this.add(a, b), -1)); }
  floorLogRatio(n: bigint, d: bigint): number { if (this.compare(n, 0n) <= 0 || this.compare(d, 0n) <= 0) this.fail('CAPABILITY', 'quadratic path positive scalar required'); let e = this.bits(n) - this.bits(d); if (this.compare(e >= 0 ? n : this.shift(n, -e), e >= 0 ? this.shift(d, e) : d) < 0) e--; return e; }
  ratio(n: bigint, d: bigint, power: number, upward: boolean): bigint {
    if (this.compare(n, 0n) === 0) return 0n;
    // Avoid allocating a denominator above the bit budget merely to prove a positive value below one.
    if (power < 0 && this.bits(n) < this.bits(d) - power) return upward ? 1n : 0n;
    const numerator = power >= 0 ? this.shift(n, power) : n, denominator = power >= 0 ? d : this.shift(d, -power), q = this.quotient(numerator, denominator);
    return upward && this.compare(this.times(q, denominator), numerator) !== 0 ? this.plus(q, 1n) : q;
  }
  root(n: bigint): bigint {
    if (this.compare(n, 0n) === 0) return 0n;
    let x = this.shift(1n, Math.ceil(this.bits(n) / 2));
    for (;;) { const next = this.shift(this.plus(x, this.quotient(n, x)), -1); if (this.compare(next, x) >= 0) break; x = next; }
    if (this.compare(this.times(x, x), n) > 0 || this.compare(this.times(this.plus(x, 1n), this.plus(x, 1n)), n) <= 0) this.fail('CAPABILITY', 'quadratic path integer square-root certificate failed');
    return x;
  }
  sqrt(value: CutDyadic, quantum: number): [CutDyadic, CutDyadic] { const root = this.root(this.ratio(value.n, 1n, value.e - 2 * quantum, false)); return [{ n: root, e: quantum }, { n: this.plus(root, 1n), e: quantum }]; }
  sqrtRatioLower(n: bigint, d: bigint, exponent: number): CutDyadic { const e = Math.floor((this.floorLogRatio(n, d) + exponent) / 2) - 8, root = this.root(this.ratio(n, d, exponent - 2 * e, false)); return { n: root, e }; }
  /** Number only proposes an inverse step; it never decides geometry or admission. */
  estimate(value: CutDyadic): number { if (this.compare(value.n, 0n) === 0) return 0; const shift = Math.max(0, this.bits(value.n) - 53); return Number(this.shift(value.n, -shift)) * 2 ** (value.e + shift); }
  private roundedInteger(n: bigint, shift: number, mode: 'nearest' | 'down' | 'up'): bigint {
    if (shift <= 0) return this.shift(n, -shift);
    const size = this.bits(n);
    if (shift > size) return mode === 'up' && this.compare(n, 0n) > 0 ? 1n : 0n;
    const q = this.shift(n, -shift), remainder = this.minus(n, this.shift(q, shift));
    if (this.compare(remainder, 0n) === 0 || mode === 'down') return q;
    if (mode === 'up') return this.plus(q, 1n);
    const halfway = this.shift(1n, shift - 1), compared = this.compare(remainder, halfway); this.take();
    return compared > 0 || compared === 0 && (q & 1n) !== 0n ? this.plus(q, 1n) : q;
  }
  /** Exact dyadic to binary64 under this SAME before-operation counter, including ties/subnormals. */
  number(value: CutDyadic, mode: 'nearest' | 'down' | 'up' = 'nearest'): number {
    if (this.compare(value.n, 0n) === 0) return 0;
    const negative = this.compare(value.n, 0n) < 0, n = this.abs(value.n), size = this.bits(n), exponent = size - 1 + value.e;
    if (exponent > 1023) this.fail('CAPABILITY', 'quadratic path finite Number conversion is unavailable');
    const direction = negative && mode !== 'nearest' ? mode === 'down' ? 'up' : 'down' : mode;
    let bits: bigint;
    if (exponent < -1022) bits = this.roundedInteger(n, -1074 - value.e, direction);
    else {
      let m = this.roundedInteger(n, size - 53, direction), e = exponent;
      if (this.compare(m, 1n << 53n) >= 0) { m = this.shift(m, -1); e++; }
      if (e > 1023) this.fail('CAPABILITY', 'quadratic path finite Number conversion is unavailable');
      this.take(3); bits = (BigInt(e + 1023) << 52n) | (m - HIDDEN);
    }
    this.take(2); if (negative) bits |= 1n << 63n;
    this.storage.setBigUint64(0, bits); const result = this.storage.getFloat64(0);
    if (!Number.isFinite(result)) this.fail('CAPABILITY', 'quadratic path finite Number conversion is unavailable'); return result;
  }
}
