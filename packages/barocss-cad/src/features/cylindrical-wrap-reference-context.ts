import { kernelRefusal, isFrom, type KernelError } from '../core/barocss-error.js';
import { SectionRationalContext, type SectionRational, type SectionFraction } from '../section-rational-internal.js';
import type { WallCycleContext } from './cylindrical-wrap-wall-cycle.js';

export type ClosedReferenceCode = 'SUPPORT' | 'BUDGET' | 'REPRESENTABILITY';
export type ClosedReferenceError = KernelError & { readonly code: ClosedReferenceCode };
export function closedReferenceFailure(code: ClosedReferenceCode, detail: string): never { throw kernelRefusal('cylindrical-wrap-closed-reference', code, `Cylindrical wrap closed reference: ${detail}`) as ClosedReferenceError; }
export function isCylindricalWrapClosedReferenceError(error: unknown): error is ClosedReferenceError { try { return isFrom<ClosedReferenceCode>(error, 'cylindrical-wrap-closed-reference'); } catch { return false; } }
export class ReferenceProofContext implements WallCycleContext {
  readonly q = new SectionRationalContext(closedReferenceFailure);
  directOperations = 0; structural = 0; integerBits = 0;
  private readonly indices = new WeakMap<readonly { readonly id: string }[], Map<string, { readonly id: string }>>();
  constructor(readonly prior: { readonly exactOperations: number; readonly work: number; readonly maximumBits: number }, readonly maximum: number) {}
  localWork(): number { const c = this.q.counts(); return this.structural + this.directOperations + c.operations + c.gcdSteps + c.floatSearchSteps; }
  check(): void {
    const c = this.q.counts();
    if (this.prior.exactOperations + c.operations + this.directOperations > this.maximum || this.prior.work + this.localWork() > 1048576 || Math.max(this.prior.maximumBits, this.integerBits, c.maximumObservedBits) > 8192) closedReferenceFailure('BUDGET', 'the complete construction and closure/mass proof budget was exceeded');
  }
  integer(value: bigint): bigint {
    this.directOperations++; const bits = (value < 0n ? -value : value).toString(2).length;
    this.integerBits = Math.max(this.integerBits, bits); this.structural += Math.ceil(bits / 64); this.check(); return value;
  }
  direct(amount: number): void { this.directOperations += amount; this.check(); }
  structure(amount: number): void { this.structural += amount; this.check(); }
  from(value: number): SectionRational { const out = this.q.from(value); this.check(); return out; }
  read(value: SectionFraction): SectionRational {
    this.structure(value.numerator.length + value.denominator.length);
    const out = this.q.rat(BigInt(value.numerator), BigInt(value.denominator)); this.check(); return out;
  }
  text(value: SectionRational): SectionFraction { const out = this.q.text(value); this.check(); return out; }
  /** Exact common-denominator receipts need no Euclidean reduction. */
  fraction(n: bigint, d = 1n): SectionFraction {
    this.integer(n); this.integer(d); this.direct(1); if (d <= 0n) closedReferenceFailure('REPRESENTABILITY', 'a positive exact receipt denominator is required');
    return this.text({ n, d });
  }
  entity<T extends { readonly id: string }>(values: readonly T[], id: string): T {
    let index = this.indices.get(values); this.structure(2);
    if (!index) {
      index = new Map();
      for (const value of values) {
        this.structure(4 + value.id.length); this.direct(1);
        if (index.has(value.id)) closedReferenceFailure('SUPPORT', 'reference entity ownership must be unique');
        index.set(value.id, value);
      }
      this.indices.set(values, index);
    }
    this.direct(1); const result = index.get(id);
    if (!result) closedReferenceFailure('SUPPORT', 'a reference entity is missing'); return result as T;
  }
  counts() {
    const q = this.q.counts(); this.check();
    return { exactOperations: this.prior.exactOperations + q.operations + this.directOperations, priorOperations: this.prior.exactOperations, rationalOperations: q.operations, directOperations: this.directOperations,
      work: this.prior.work + this.localWork(), localWork: this.localWork(), maximumBits: Math.max(this.prior.maximumBits, this.integerBits, q.maximumObservedBits), localGcdSteps: q.gcdSteps };
  }
}
export function freezeReferenceProof(value: unknown, ctx: ReferenceProofContext): void {
  ctx.structure(4 + (typeof value === 'string' ? value.length : 0));
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freezeReferenceProof(child, ctx); Object.freeze(value); }
}
export function referenceSameNumbers(a: readonly number[], b: readonly number[], ctx: ReferenceProofContext): void {
  ctx.direct(1); ctx.structure(a.length + b.length); if (a.length !== b.length) closedReferenceFailure('SUPPORT', 'complete original coefficient arrays are required');
  for (let i = 0; i < a.length; i++) { ctx.direct(1); if (!Object.is(a[i], b[i])) closedReferenceFailure('SUPPORT', 'original coefficient bits differ from the required reference binding'); }
}
export function referenceEntity<T extends { readonly id: string }>(values: readonly T[], id: string, ctx: ReferenceProofContext): T { return ctx.entity(values, id); }
