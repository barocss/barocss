/** Private P5a candidate data. No public World admission or lifetime. */
import type { Cloth, Fluid, PhysicsModel, PhysicsState, PlannedVisualProfileId } from '../types.js';
import type { ClothConstraint } from '../cloth/types.js';
import type { FluidStaticBox } from '../fluid/static-box.js';
import { copyData } from '../identity.js';
import { PhysicsError } from '../types.js';

export type ClothOutput = PhysicsState['cloths'][number];
export type FluidOutput = PhysicsState['fluids'][number];
export type FluidProfile = Exclude<PlannedVisualProfileId, 'cloth-pinned-sphere-visual-v1'>;
export interface StaticDomainData {
  readonly profile: PlannedVisualProfileId;
  readonly gravityMps2: PhysicsModel['gravityMps2'];
  readonly bodies: PhysicsModel['bodies'];
  readonly colliders: PhysicsModel['colliders'];
}
export interface ClothDefinition { readonly cloth: Cloth; readonly staticData: StaticDomainData }
export interface FluidDefinition {
  readonly fluid: Fluid; readonly staticData: StaticDomainData;
  readonly restDensity: number; readonly staticBox: FluidStaticBox | null;
}
export interface ClothCandidate {
  readonly positions: Float64Array; readonly velocities: Float64Array;
  readonly constraints: ClothConstraint[]; readonly diagnostics: ClothOutput['diagnostics'];
}
export interface FluidCandidate {
  readonly positions: Float64Array; readonly velocities: Float64Array;
  readonly diagnostics: FluidOutput['diagnostics'];
}
export interface Prepared<C, O> { readonly candidate: C; readonly output: O }
export function invalid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PhysicsError('INVALID_CONFIG', message);
}
/** Only inert plain data enters definitions; freeze every nested plain object. */
export function immutableCopy<T>(input: T): T {
  const result = copyData(input);
  function freeze(value: unknown): void {
    if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  }
  freeze(result);
  return result;
}
export function flat(points: readonly (readonly number[])[], count: number): Float64Array {
  invalid(points.length === count, 'Unexpected domain point count');
  invalid(points.every(p => p.length === 3 && p.every(Number.isFinite)), 'Expected finite domain triples');
  return new Float64Array(points.flat());
}
export function validateStatic(data: StaticDomainData, colliderIds: readonly string[]): void {
  invalid(data.gravityMps2.length === 3 && data.gravityMps2.every((x, i) => x === [0, -9.81, 0][i]), 'Unsupported domain gravity');
  invalid(new Set(colliderIds).size === colliderIds.length && data.colliders.length === colliderIds.length, 'Static collider population mismatch');
  invalid(data.bodies.length === data.colliders.length, 'Static owner population mismatch');
  const ids = new Set<string>();
  const owners = new Set<string>();
  for (const c of data.colliders) {
    invalid(colliderIds.includes(c.id) && !ids.has(c.id), 'Invalid static collider identity'); ids.add(c.id);
    invalid(!owners.has(c.bodyId), 'Duplicate static collider owner'); owners.add(c.bodyId);
    const b = data.bodies.find(b => b.id === c.bodyId);
    invalid(b?.kind === 'static', 'Domain colliders require static bodies');
    invalid(b.initial.orientationXYZW.every((x,i) => x === (i === 3 ? 1 : 0)), 'Unsupported static rotation');
    invalid(c.local.positionM.every(x => x === 0) && c.local.orientationXYZW.every((x,i) => x === (i === 3 ? 1 : 0)), 'Unsupported collider transform');
    invalid(!c.sensor && !c.ccd, 'Unsupported domain sensor or CCD');
  }
}
