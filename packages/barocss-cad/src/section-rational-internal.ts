/** Private, request-local exact arithmetic for the bounded section construction. */
export type SectionRational = { n: bigint; d: bigint };
export type SectionFraction = { numerator: string; denominator: string };
export class SectionRationalContext {
  private operations = 0;
  private gcdSteps = 0;
  private floatSearchSteps = 0;
  private floatConversions = 0;
  private maximumObservedBits = 0;
  private readonly storage = new DataView(new ArrayBuffer(8));
  private readonly maximumFiniteBits = 0x7fefffffffffffffn;
  constructor(private readonly fail: (kind: 'BUDGET' | 'REPRESENTABILITY', detail: string) => never) {}
  private work(): void { if (++this.operations > 200000) this.fail('BUDGET', 'Exact rational operation budget exceeded'); }
  private sized(value: bigint): bigint {
    this.work(); const bits = (value < 0n ? -value : value).toString(2).length;
    if (bits > 8192) this.fail('BUDGET', 'Exact rational integer bit budget exceeded');
    this.maximumObservedBits = Math.max(this.maximumObservedBits, bits); return value;
  }
  private multiply(a: bigint, b: bigint): bigint { this.work(); return this.sized(a * b); }
  private gcd(a: bigint, b: bigint): bigint {
    this.work(); a = a < 0n ? -a : a;
    while (b !== 0n) {
      this.work(); if (++this.gcdSteps > 200000) this.fail('BUDGET', 'Exact rational GCD budget exceeded');
      const remainder = a % b; a = b; b = remainder;
    }
    return a;
  }
  rat(n: bigint, d = 1n): SectionRational {
    this.work(); this.sized(n); this.sized(d);
    if (d === 0n) this.fail('REPRESENTABILITY', 'An exact rational denominator is zero');
    if (d < 0n) { n = -n; d = -d; }
    if (n === 0n) return { n: 0n, d: 1n };
    const divisor = this.gcd(n, d); return { n: n / divisor, d: d / divisor };
  }
  integer(value: number): SectionRational { this.work(); return this.rat(BigInt(value)); }
  private atBits(bits: bigint): number { this.work(); this.storage.setBigUint64(0, bits, false); return this.storage.getFloat64(0, false); }
  from(value: number): SectionRational {
    this.work(); if (!Number.isFinite(value)) this.fail('REPRESENTABILITY', 'Finite represented binary64 input is required');
    this.storage.setFloat64(0, value, false); const bits = this.storage.getBigUint64(0, false);
    const exponent = Number((bits >> 52n) & 2047n), fraction = bits & 0xfffffffffffffn;
    if (exponent === 0 && fraction === 0n) return this.rat(0n);
    const significand = exponent === 0 ? fraction : (1n << 52n) + fraction;
    const power = exponent === 0 ? -1074 : exponent - 1075;
    const signed = bits >> 63n ? -significand : significand;
    // The only denominator is a power of two. Remove its common trailing bits
    // directly instead of running Euclid for every float-search candidate.
    if (power >= 0) { this.work(); return { n: this.sized(signed << BigInt(power)), d: 1n }; }
    this.work(); const binary = significand.toString(2);
    this.work(); const trailing = binary.length - binary.lastIndexOf('1') - 1, cancelled = Math.min(trailing, -power);
    this.work(); const reduced = signed / (1n << BigInt(cancelled));
    this.work(); return { n: this.sized(reduced), d: this.sized(1n << BigInt(-power - cancelled)) };
  }
  add(a: SectionRational, b: SectionRational): SectionRational {
    this.work(); const shared = this.gcd(a.d, b.d), ad = a.d / shared, bd = b.d / shared;
    return this.rat(this.sized(this.multiply(a.n, bd) + this.multiply(b.n, ad)), this.multiply(ad, b.d));
  }
  neg(a: SectionRational): SectionRational { this.work(); return { n: -a.n, d: a.d }; }
  sub(a: SectionRational, b: SectionRational): SectionRational { this.work(); return this.add(a, this.neg(b)); }
  mul(a: SectionRational, b: SectionRational): SectionRational {
    this.work(); const x = this.gcd(a.n, b.d), y = this.gcd(b.n, a.d);
    return this.rat(this.multiply(a.n / x, b.n / y), this.multiply(a.d / y, b.d / x));
  }
  div(a: SectionRational, b: SectionRational): SectionRational {
    this.work(); if (b.n === 0n) this.fail('REPRESENTABILITY', 'Exact rational division by zero');
    return this.mul(a, this.rat(b.d, b.n));
  }
  compare(a: SectionRational, b: SectionRational): number {
    this.work(); const left = this.multiply(a.n, b.d), right = this.multiply(b.n, a.d); return left < right ? -1 : left > right ? 1 : 0;
  }
  abs(a: SectionRational): SectionRational { this.work(); return a.n < 0n ? this.neg(a) : a; }
  max(a: SectionRational, b: SectionRational): SectionRational { this.work(); return this.compare(a, b) >= 0 ? a : b; }
  sum(values: SectionRational[]): SectionRational { this.work(); return values.reduce((a, b) => this.add(a, b), this.rat(0n)); }
  /** Search positive finite float codes, which have the same order as their values. */
  private floorBits(value: SectionRational): bigint {
    this.work(); this.floatConversions++;
    if (this.compare(value, this.from(this.atBits(this.maximumFiniteBits))) > 0) this.fail('REPRESENTABILITY', 'Exact value exceeds the finite binary64 range');
    let lower = 0n, upper = this.maximumFiniteBits, steps = 0;
    while (lower < upper) {
      this.work(); if (++steps > 64) this.fail('BUDGET', 'Exact float search exceeded64 iterations'); this.floatSearchSteps++;
      const midpoint = (lower + upper + 1n) >> 1n;
      if (this.compare(this.from(this.atBits(midpoint)), value) <= 0) lower = midpoint; else upper = midpoint - 1n;
    }
    return lower;
  }
  nearest(value: SectionRational): number {
    this.work(); if (value.n === 0n) return 0;
    const positive = this.abs(value), lowerBits = this.floorBits(positive), lower = this.atBits(lowerBits), lowerValue = this.from(lower);
    if (this.compare(lowerValue, positive) === 0) return value.n < 0n ? -lower : lower;
    const upperBits = lowerBits + 1n;
    if (upperBits > this.maximumFiniteBits) this.fail('REPRESENTABILITY', 'Nearest finite binary64 conversion is unavailable');
    const upper = this.atBits(upperBits), distanceLower = this.sub(positive, lowerValue), distanceUpper = this.sub(this.from(upper), positive);
    const comparison = this.compare(distanceLower, distanceUpper);
    const rounded = comparison < 0 || comparison === 0 && (lowerBits & 1n) === 0n ? lower : upper;
    return value.n < 0n ? -rounded : rounded;
  }
  upward(value: SectionRational): number {
    this.work(); if (value.n < 0n) this.fail('REPRESENTABILITY', 'An upward error bound must be nonnegative');
    if (value.n === 0n) return 0;
    const lowerBits = this.floorBits(value), lower = this.atBits(lowerBits);
    if (this.compare(this.from(lower), value) === 0) return lower;
    if (lowerBits === this.maximumFiniteBits) this.fail('REPRESENTABILITY', 'A finite upward error bound is unavailable');
    return this.atBits(lowerBits + 1n);
  }
  exactFloat(value: SectionRational): number {
    this.work(); const result = this.nearest(value);
    if (this.compare(value, this.from(result)) !== 0) this.fail('REPRESENTABILITY', 'A derived weight is not exactly represented in binary64'); return result;
  }
  text(value: SectionRational): SectionFraction {
    this.work(); const numerator = value.n.toString(), denominator = value.d.toString();
    if (numerator.length > 5000 || denominator.length > 5000) this.fail('BUDGET', 'Exact fraction string budget exceeded');
    return { numerator, denominator };
  }
  bound(value: SectionRational): { exact: SectionFraction; upper: number } { this.work(); return { exact: this.text(value), upper: this.upward(value) }; }
  counts(): { operations: number; gcdSteps: number; floatSearchSteps: number; floatConversions: number; maximumObservedBits: number } {
    return { operations: this.operations, gcdSteps: this.gcdSteps, floatSearchSteps: this.floatSearchSteps, floatConversions: this.floatConversions, maximumObservedBits: this.maximumObservedBits };
  }
}
