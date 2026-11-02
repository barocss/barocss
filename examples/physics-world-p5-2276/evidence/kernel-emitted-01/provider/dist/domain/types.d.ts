/** Private P5a candidate data. No public World admission or lifetime. */
import type { Cloth, Fluid, PhysicsModel, PhysicsState, PlannedVisualProfileId } from '../types.js';
import type { ClothConstraint } from '../cloth/types.js';
import type { FluidStaticBox } from '../fluid/static-box.js';
export type ClothOutput = PhysicsState['cloths'][number];
export type FluidOutput = PhysicsState['fluids'][number];
export type FluidProfile = Exclude<PlannedVisualProfileId, 'cloth-pinned-sphere-visual-v1'>;
export interface StaticDomainData {
    readonly profile: PlannedVisualProfileId;
    readonly gravityMps2: PhysicsModel['gravityMps2'];
    readonly bodies: PhysicsModel['bodies'];
    readonly colliders: PhysicsModel['colliders'];
}
export interface ClothDefinition {
    readonly cloth: Cloth;
    readonly staticData: StaticDomainData;
}
export interface FluidDefinition {
    readonly fluid: Fluid;
    readonly staticData: StaticDomainData;
    readonly restDensity: number;
    readonly staticBox: FluidStaticBox | null;
}
export interface ClothCandidate {
    readonly positions: Float64Array;
    readonly velocities: Float64Array;
    readonly constraints: ClothConstraint[];
    readonly diagnostics: ClothOutput['diagnostics'];
}
export interface FluidCandidate {
    readonly positions: Float64Array;
    readonly velocities: Float64Array;
    readonly diagnostics: FluidOutput['diagnostics'];
}
export interface Prepared<C, O> {
    readonly candidate: C;
    readonly output: O;
}
export declare function invalid(condition: unknown, message: string): asserts condition;
/** Only inert plain data enters definitions; freeze every nested plain object. */
export declare function immutableCopy<T>(input: T): T;
export declare function flat(points: readonly (readonly number[])[], count: number): Float64Array;
export declare function validateStatic(data: StaticDomainData, colliderIds: readonly string[]): void;
