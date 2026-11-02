
/** A bounded, deterministic-order 3D primitive dynamics profile. Units are SI. */
export type Vec3 = [number, number, number];
/** Local-to-world quaternion in [x, y, z, w] order. */
export type Quat = [number, number, number, number];
export { PhysicsError } from './types.js';
export type { FailureCode as PhysicsErrorCode } from './types.js';
export type SphereShape = { kind: 'sphere'; radiusM: number };
export type BoxShape = { kind: 'box'; halfExtentsM: Vec3 };
export type CapsuleShape = { kind: 'capsule'; radiusM: number; halfLengthM: number };
export type PhysicsShape = SphereShape | BoxShape | CapsuleShape;
export type PhysicsFriction = { static: number; dynamic: number };
export type PhysicsCollisionFilter = { categoryBits: number; maskBits: number };
export interface PhysicsHingeMotorConfig {
  targetSpeedRadps: number;
  maxImpulseNms: number;
  maxReactionNms: number;
}
export interface PhysicsBodyState {
  id: string;
  kind: 'dynamic' | 'static' | 'kinematic';
  shape: PhysicsShape;
  positionM: Vec3;
  velocityMps: Vec3;
  orientation: Quat;
  angularVelocityRadps: Vec3;
  inertiaKgM2?: number;
  inertiaDiagonalKgM2?: Vec3;
  sensor?: boolean;
  ccd?: true;
  collisionFilter?: PhysicsCollisionFilter;
  sleeping?: boolean;
}
export interface PhysicsContact {
  aId: string;
  bId: string;
  normalAtoB: Vec3;
  pointM: Vec3;
  penetrationM: number;
  impulseNs: number;
  tangentImpulseNs: Vec3;
}
export interface PhysicsEvent {
  aId: string;
  bId: string;
  kind: 'contact' | 'sensor';
  phase: 'begin' | 'stay' | 'end';
}
export interface PhysicsJointState {
  id: string;
  kind: 'fixed' | 'hinge';
  aId: string;
  bId: string;
  linearImpulseNs: Vec3;
  angularImpulseNms: Vec3;
  angleRad?: number;
  motorImpulseNms?: number;
}
export interface PhysicsCcdHit {
  bodyId: string;
  fixtureId: string;
  toiFraction: number;
  normalFixtureToBody: Vec3;
}
export interface PhysicsPairStats {
  eligiblePairs: number;
  candidatePairs: number;
  aabbTests: number;
}
export interface PhysicsRayHit { bodyId: string; distanceM: number }

export interface Body extends PhysicsBodyState {
  sensor: boolean;
  inverseMass: number;
  inverseInertiaLocal: Vec3;
  restitution: number;
  frictionStatic: number;
  frictionDynamic: number;
}
export interface Hit { normal: Vec3; penetration: number; pointM: Vec3 }
export interface Joint {
  id: string;
  kind: 'fixed' | 'hinge';
  aIndex: number;
  bIndex: number;
  anchorALocalM: Vec3;
  anchorBLocalM: Vec3;
  referenceOrientation: Quat;
  axisWorld?: Vec3;
  limitRad?: [number, number];
  motor?: PhysicsHingeMotorConfig;
}
