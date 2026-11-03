import type { Vec3 } from './internal-types.js';
import { PhysicsError } from './types.js';
import { add, cross, scale } from './math.js';

/** Actual application operands. These are not geometric boundary witnesses. */
export interface ContactApplicationSide {
  readonly comM: Vec3;
  readonly armM: Vec3;
  readonly linearImpulseNs: Vec3;
  readonly armTorqueNms: Vec3;
}
export interface ContactApplication {
  readonly onA: ContactApplicationSide;
  readonly onB: ContactApplicationSide;
  /** Present only for the original normal-axis/scalar angular mutation. */
  readonly normalOperands?: { readonly direction: Vec3; readonly torqueAxisA: Vec3;
    readonly torqueAxisB: Vec3; readonly scalarNs: number };
}
export interface ContactContribution {
  readonly applications: readonly ContactApplication[];
}
interface BodyTotal { linearImpulseNs: Vec3; angularImpulseAboutWorldOriginNms: Vec3 }
interface PairTotal { anyNonzero: boolean; onA: BodyTotal; onB: BodyTotal }
export interface CompletedContactPair {
  readonly aId: string; readonly bId: string; readonly anyNonzero: boolean;
  readonly onA: BodyTotal; readonly onB: BodyTotal;
}
const zero = (): BodyTotal => ({ linearImpulseNs: [0, 0, 0], angularImpulseAboutWorldOriginNms: [0, 0, 0] });
const copy = (v: Vec3): Vec3 => [...v];
function check(v: Vec3): void {
  if (v.length !== 3 || v.some(value => !Number.isFinite(value))) {
    throw new PhysicsError('NUMERIC_LIMIT', 'unsafe actual contact contribution');
  }
}
function side(com: Vec3, arm: Vec3, impulse: Vec3, torque: Vec3): ContactApplicationSide {
  for (const v of [com, arm, impulse, torque]) check(v);
  return { comM: copy(com), armM: copy(arm), linearImpulseNs: copy(impulse), armTorqueNms: copy(torque) };
}
export function emptyContactContribution(): ContactContribution { return { applications: [] }; }

/** Capture before mutation. Keep each body's actual COM and arm separately. */
export function contactApplication(comA: Vec3, comB: Vec3, armA: Vec3, armB: Vec3,
  impulseOnB: Vec3): ContactContribution {
  const impulseOnA = scale(impulseOnB, -1);
  return { applications: [{ onA: side(comA, armA, impulseOnA, scale(cross(armA, impulseOnB), -1)),
    onB: side(comB, armB, impulseOnB, cross(armB, impulseOnB)) }] };
}

/** Record cross(arm,normal)*scalar, exactly the original normal operands. */
export function normalContactApplication(comA: Vec3, comB: Vec3, armA: Vec3, armB: Vec3,
  direction: Vec3, torqueAxisA: Vec3, torqueAxisB: Vec3, scalarNs: number): ContactContribution {
  const impulseOnB = scale(direction, scalarNs);
  const contribution: ContactContribution = { applications: [{
    onA: side(comA, armA, scale(impulseOnB, -1), scale(scale(torqueAxisA, scalarNs), -1)),
    onB: side(comB, armB, impulseOnB, scale(torqueAxisB, scalarNs)),
    normalOperands: { direction: copy(direction), torqueAxisA: copy(torqueAxisA),
      torqueAxisB: copy(torqueAxisB), scalarNs },
  }] };
  return contribution;
}
export function combineContactContributions(a: ContactContribution, b: ContactContribution): ContactContribution {
  return { applications: [...a.applications, ...b.applications] };
}

/** Step-local storage: at most one bucket per existing solver pair, no trace. */
export class ContactPairAccumulator {
  private readonly pairs = new Map<string, PairTotal & { aId: string; bId: string }>();
  add(aId: string, bId: string, contribution: ContactContribution): void {
    if (contribution.applications.length === 0) return;
    const key = aId + '\u0000' + bId;
    let pair = this.pairs.get(key);
    if (!pair) { pair = { aId, bId, anyNonzero: false, onA: zero(), onB: zero() }; this.pairs.set(key, pair); }
    for (const application of contribution.applications) {
      for (const owner of ['onA', 'onB'] as const) {
        const applied = application[owner];
        for (const v of [applied.comM, applied.armM, applied.linearImpulseNs, applied.armTorqueNms]) check(v);
        pair.anyNonzero ||= applied.linearImpulseNs.some(value => value !== 0)
          || applied.armTorqueNms.some(value => value !== 0);
        const moment = add(cross(applied.comM, applied.linearImpulseNs), applied.armTorqueNms);
        pair[owner].linearImpulseNs = add(pair[owner].linearImpulseNs, applied.linearImpulseNs);
        pair[owner].angularImpulseAboutWorldOriginNms = add(pair[owner].angularImpulseAboutWorldOriginNms, moment);
      }
    }
  }
  /** Validate the complete candidate ledger before World's existing commit. */
  finish(): readonly CompletedContactPair[] {
    for (const pair of this.pairs.values()) for (const owner of ['onA', 'onB'] as const) {
      check(pair[owner].linearImpulseNs);
      check(pair[owner].angularImpulseAboutWorldOriginNms);
    }
    return [...this.pairs.values()].map(pair => ({ aId: pair.aId, bId: pair.bId,
      anyNonzero: pair.anyNonzero, onA: { linearImpulseNs: copy(pair.onA.linearImpulseNs),
        angularImpulseAboutWorldOriginNms: copy(pair.onA.angularImpulseAboutWorldOriginNms) },
      onB: { linearImpulseNs: copy(pair.onB.linearImpulseNs),
        angularImpulseAboutWorldOriginNms: copy(pair.onB.angularImpulseAboutWorldOriginNms) } }));
  }
}
