import { kernelRefusal, isFrom, type KernelError } from '../core/barocss-error.js';
import { ownSnapshot, hasExactOwnFields, type OwnSnapshotSpec } from '../core/own-data.js';
import type { Part } from '../part/part-model.js';
import { buildCylindricalWrapNativeBoundAssembly, type CylindricalWrapAssemblyComponent, type CylindricalWrapNativeBoundResult } from './cylindrical-wrap-assembly.js';
import { certifyCylindricalWrapFormalPadMass, type FormalPadBudgets, type FormalPadRectangle, type CylindricalWrapFormalPadMass } from './cylindrical-wrap-formal-mass.js';

export interface CylindricalWrapBoundReferenceOptions {
  readonly id: string; readonly height: number; readonly density: number;
  readonly budgets: FormalPadBudgets; readonly maxOperations?: number;
}
export interface CylindricalWrapBoundReferenceCounts {
  readonly exactOperations: number; readonly nativeOperations: number; readonly formalOperations: number; readonly outerDirectOperations: number;
  readonly nativeWork: number; readonly formalWork: number; readonly outerWork: number; readonly work: number; readonly maximumBits: number;
}
const MEANING = Object.freeze({
  sourceIdentity: 'same-owned-frozen-part-two-synchronous-fresh-checks' as const,
  sourceChecks: 2 as const,
  sourceCosts: 'both-complete-child-costs-counted' as const,
  nativePositionBindingCertified: true as const,
  formalReferenceMassOnly: true as const,
  closedReferenceCertified: false as const,
  physicalBrepCertified: false as const,
  retainedFaceClosureCertified: false as const,
  representedVolumeCertified: false as const,
  partMassProvider: false as const,
  productFeature: false as const,
});
export interface CylindricalWrapBoundReferenceResult {
  readonly native: CylindricalWrapNativeBoundResult; readonly formal: CylindricalWrapFormalPadMass;
  readonly rectangle: FormalPadRectangle; readonly options: CylindricalWrapBoundReferenceOptions;
  readonly reservations: { readonly native: number; readonly formal: number };
  readonly counts: CylindricalWrapBoundReferenceCounts;
  readonly limits: { readonly exactOperations: number; readonly hardExactOperations: 200000; readonly integerBits: 8192; readonly work: 1048576 };
  readonly meaning: typeof MEANING; readonly solidQualified: false;
}
export type CylindricalWrapBoundReferenceCode = 'INPUT' | 'SUPPORT' | 'BUDGET';
export type CylindricalWrapBoundReferenceError = KernelError & { readonly code: CylindricalWrapBoundReferenceCode };
const SOURCE = 'cylindrical-wrap-bound-reference';
const MAX_OPERATIONS = 200000, MAX_BITS = 8192, MAX_WORK = 1048576;
// Each child import checks safe-integer/nonnegative for operations, work and bits.
const CHILD_IMPORT_COMPARISONS = 12;
// Conservative structural reservation for final counts/reservations/limits/result and their freezes.
const FINAL_RECORD_WORK = 128;
function fail(code: CylindricalWrapBoundReferenceCode, detail: string): never { throw kernelRefusal(SOURCE, code, `Cylindrical wrap bound reference: ${detail}`) as CylindricalWrapBoundReferenceError; }
export function isCylindricalWrapBoundReferenceError(error: unknown): error is CylindricalWrapBoundReferenceError { try { return isFrom<CylindricalWrapBoundReferenceCode>(error, SOURCE); } catch { return false; } }
function wrap(code: CylindricalWrapBoundReferenceCode, detail: string): never { return fail(code, detail); }
const OWN: OwnSnapshotSpec<CylindricalWrapBoundReferenceCode> = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap, isRefusal: isCylindricalWrapBoundReferenceError };

class Ledger {
  maximum = MAX_OPERATIONS;
  outerDirect = 0; outerWork = 0;
  nativeOperations = 0; nativeWork = 0; nativeBits = 0;
  formalOperations = 0; formalWork = 0; formalBits = 0;
  totalOperations(): number { return this.outerDirect + this.nativeOperations + this.formalOperations; }
  totalWork(): number { return this.outerWork + this.outerDirect + this.nativeWork + this.formalWork; }
  maximumBits(): number { return Math.max(this.nativeBits, this.formalBits); }
  check(): void {
    if (this.totalOperations() > this.maximum || this.totalWork() > MAX_WORK || this.maximumBits() > MAX_BITS) fail('BUDGET', 'the complete operation, work, or integer-bit budget was exceeded');
  }
  direct(amount: number): void { this.outerDirect += amount; this.check(); }
  structure(amount: number): void { this.outerWork += amount; this.check(); }
  remaining(): number {
    this.check(); const value = this.maximum - this.totalOperations();
    if (value < 1) fail('BUDGET', 'no aggregate operation allowance remains for a fresh child');
    return value;
  }
  native(value: CylindricalWrapNativeBoundResult): void {
    const counts = value.nativeBinding.counts;
    childCounts(counts.exactOperations, counts.work, counts.maximumBits);
    this.nativeOperations = counts.exactOperations; this.nativeWork = counts.work; this.nativeBits = counts.maximumBits; this.check();
  }
  formal(value: CylindricalWrapFormalPadMass): void {
    const counts = value.counts;
    childCounts(counts.totalOperations, counts.work, counts.maximumBits);
    this.formalOperations = counts.totalOperations; this.formalWork = counts.work; this.formalBits = counts.maximumBits; this.check();
  }
  counts(): CylindricalWrapBoundReferenceCounts {
    this.check();
    return { exactOperations: this.totalOperations(), nativeOperations: this.nativeOperations, formalOperations: this.formalOperations, outerDirectOperations: this.outerDirect,
      nativeWork: this.nativeWork, formalWork: this.formalWork, outerWork: this.outerWork + this.outerDirect, work: this.totalWork(), maximumBits: this.maximumBits() };
  }
}
/** These six guards per child were prepaid before either child reservation. */
function childCounts(operations: number, work: number, bits: number): void {
  for (const value of [operations, work, bits]) if (!Number.isSafeInteger(value) || value < 0) fail('BUDGET', 'actual child counters must be nonnegative safe integers');
}
/** Same four-units-per-value structural convention as the child family, plus actual string length. */
function freezeOwned(value: unknown, ledger: Ledger): void {
  ledger.structure(4 + (typeof value === 'string' ? value.length : 0));
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeOwned(child, ledger);
    Object.freeze(value);
  }
}
function owned<T>(value: unknown, ledger: Ledger): T {
  const copy = ownSnapshot(value, false, OWN); freezeOwned(copy, ledger); return copy as T;
}
function optionsMaximum(options: CylindricalWrapBoundReferenceOptions, ledger: Ledger): number {
  if (!options || typeof options !== 'object' || Array.isArray(options)) fail('INPUT', 'plain owned wrapper options are required');
  const value = options as unknown as Record<string, unknown>;
  ledger.direct(1); const hasMaximum = Object.hasOwn(value, 'maxOperations');
  const fields = hasMaximum ? ['id', 'height', 'density', 'budgets', 'maxOperations'] : ['id', 'height', 'density', 'budgets'];
  ledger.structure(fields.length + 1);
  if (!hasExactOwnFields(value, fields)) fail('INPUT', 'only id, height, density, budgets and optional maxOperations are accepted');
  const maximum = hasMaximum ? value.maxOperations : MAX_OPERATIONS;
  ledger.direct(4);
  if (typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum < 1 || maximum > MAX_OPERATIONS) fail('INPUT', 'maxOperations may only tighten200000');
  return maximum;
}
function rectangleOf(components: readonly CylindricalWrapAssemblyComponent[], ledger: Ledger): FormalPadRectangle {
  ledger.structure(8);
  if (!Array.isArray(components) || components.length !== 1) fail('SUPPORT', 'exactly one actual component is required');
  const component = components[0];
  if (!component || !Array.isArray(component.outer) || component.outer.length !== 4 || !Array.isArray(component.holes) || component.holes.length !== 0) fail('SUPPORT', 'the admitted native input must retain four points and no holes');
  const points: (readonly [number, number])[] = [];
  for (const value of component.outer) {
    ledger.structure(6);
    if (!Array.isArray(value) || value.length !== 2) fail('INPUT', 'original owned UV points must retain exactly two coordinates');
    ledger.direct(2);
    if (typeof value[0] !== 'number' || typeof value[1] !== 'number') fail('INPUT', 'original owned UV coordinates must be Numbers');
    // The fresh native child admitted these exact finite values.
    points.push([value[0], value[1]]);
  }
  let uLow = points[0][0], uHigh = uLow, vLow = points[0][1], vHigh = vLow;
  for (let i = 1; i < 4; i++) {
    const p = points[i]; ledger.direct(4);
    if (p[0] < uLow) uLow = p[0];
    if (p[0] > uHigh) uHigh = p[0];
    if (p[1] < vLow) vLow = p[1];
    if (p[1] > vHigh) vHigh = p[1];
  }
  ledger.direct(2);
  if (!(uLow < uHigh) || !(vLow < vHigh)) fail('SUPPORT', 'both actual coordinate sets must have positive extent');
  const seen = [false, false, false, false];
  for (const p of points) {
    ledger.direct(4);
    const lowU = Object.is(p[0], uLow), highU = Object.is(p[0], uHigh), lowV = Object.is(p[1], vLow), highV = Object.is(p[1], vHigh);
    if (!(lowU || highU) || !(lowV || highV)) fail('SUPPORT', 'every admitted point must use the same two original U and V values');
    ledger.direct(1); const slot = (highU ? 1 : 0) + (highV ? 2 : 0);
    ledger.direct(1); if (seen[slot]) fail('SUPPORT', 'each of the four actual rectangle corners must occur once');
    seen[slot] = true;
  }
  const rectangle: FormalPadRectangle = { u: [uLow, uHigh], v: [vLow, vHigh] };
  freezeOwned(rectangle, ledger); return rectangle;
}
/**
 * Two fresh synchronous checks of one owned source, with both complete costs retained.
 * Position binding and formal reference mass do not qualify the assembled physical solid.
 */
export function buildCylindricalWrapBoundReference(partInput: Part, componentsInput: readonly CylindricalWrapAssemblyComponent[], optionsInput: CylindricalWrapBoundReferenceOptions): CylindricalWrapBoundReferenceResult {
  const ledger = new Ledger();
  const part = owned<Part>(partInput, ledger), components = owned<readonly CylindricalWrapAssemblyComponent[]>(componentsInput, ledger), options = owned<CylindricalWrapBoundReferenceOptions>(optionsInput, ledger);
  ledger.maximum = optionsMaximum(options, ledger); ledger.check();
  // Prepay both imports and final fixed-size bookkeeping. No outer direct work is added after the formal reservation.
  ledger.direct(CHILD_IMPORT_COMPARISONS); ledger.structure(FINAL_RECORD_WORK);
  const nativeReservation = ledger.remaining();
  // The native child proves height===the radius of this same owned Part.
  const native = buildCylindricalWrapNativeBoundAssembly(part, components, { id: options.id, height: options.height, maxOperations: nativeReservation });
  ledger.native(native);
  const rectangle = rectangleOf(components, ledger), formalReservation = ledger.remaining();
  // This intentionally performs a second complete source validation. No source count is subtracted or shared.
  const formal = certifyCylindricalWrapFormalPadMass(part, rectangle, { id: options.id, density: options.density, budgets: options.budgets, maxOperations: formalReservation });
  ledger.formal(formal); ledger.check();
  const counts = Object.freeze(ledger.counts()), reservations = Object.freeze({ native: nativeReservation, formal: formalReservation });
  const limits = Object.freeze({ exactOperations: ledger.maximum, hardExactOperations: 200000, integerBits: 8192, work: 1048576 } as const);
  return Object.freeze({ native, formal, rectangle, options, reservations, counts, limits, meaning: MEANING, solidQualified: false as const });
}
