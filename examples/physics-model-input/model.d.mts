import type { PhysicsModel, RigidBody, Geometry, Collider, Inertia, Vec3, QuatXYZW, Joint, SourceBinding } from '../../packages/barocss-physics/src/types.js';
type Mutable<T> = T extends (...args: never[]) => unknown ? T : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
export interface Part<T extends RigidBody = RigidBody> { body: Mutable<T>; collider: Mutable<Collider> }
export interface PartOptions {
  restitution?: number; friction?: Collider['material']['friction']; sensor?: boolean; ccd?: boolean;
  filter?: Collider['filter']; inertia?: Inertia; colliderId?: string;
}
export function dynamicPart(id: string, geometry: Geometry, initial: { positionM: Vec3; orientationXYZW?: QuatXYZW;
  velocityMps?: Vec3; angularVelocityRadps?: Vec3 }, massKg?: number, options?: PartOptions): Part<Extract<RigidBody, {kind:'dynamic'}>>;
export function staticPart(id: string, geometry: Geometry, initial: { positionM: Vec3; orientationXYZW?: QuatXYZW }, options?: PartOptions): Part<Extract<RigidBody, {kind:'static'|'kinematic'}>>;
export function kinematicPart(id: string, geometry: Geometry, initial: { positionM: Vec3; orientationXYZW?: QuatXYZW }, options?: PartOptions): Part<Extract<RigidBody, {kind:'static'|'kinematic'}>>;
export function makeModel(input: { revision?: string; gravityMps2?: Vec3; parts?: readonly Part[];
  joints?: readonly Joint[]; sourceBindings?: readonly SourceBinding[] }): Mutable<PhysicsModel>;
