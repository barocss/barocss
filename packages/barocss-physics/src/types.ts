
/** A bounded, deterministic-order 3D primitive dynamics profile. Units are SI. */
export type Vec3 = [number, number, number];
/** Local-to-world quaternion in [x, y, z, w] order. */
export type Quat = [number, number, number, number];
export type PhysicsErrorCode = 'INVALID_CONFIG' | 'INVALID_STEP' | 'INVALID_COMMAND' | 'INVALID_QUERY' | 'INVALID_SNAPSHOT' | 'STALE_SOURCE' | 'STALE_SNAPSHOT' | 'WORLD_LIMIT' | 'NUMERIC_LIMIT' | 'DISPOSED';

export class PhysicsError extends Error {
  constructor(readonly code: PhysicsErrorCode, message: string) {
    super(message);
    this.name = 'PhysicsError';
  }
}

export type SphereShape = { kind: 'sphere'; radiusM: number };
export type BoxShape = { kind: 'box'; halfExtentsM: Vec3 };
export type CapsuleShape = { kind: 'capsule'; radiusM: number; halfLengthM: number };
export type PhysicsShape = SphereShape | BoxShape | CapsuleShape;
export type PhysicsFriction = { static: number; dynamic: number };
export type PhysicsBodyConfig =
  | { id: string; kind: 'dynamic'; shape: PhysicsShape; positionM: Vec3; velocityMps: Vec3; massKg: number; restitution: number;
      orientation?: Quat; angularVelocityRadps?: Vec3; inertiaKgM2?: number; friction?: PhysicsFriction; ccd?: true }
  | { id: string; kind: 'static' | 'kinematic'; shape: PhysicsShape; positionM: Vec3; restitution: number;
      orientation?: Quat; sensor?: true; friction?: PhysicsFriction };
export type PhysicsStepCommand =
  | { kind: 'force'; bodyId: string; forceN: Vec3 }
  | { kind: 'impulse'; bodyId: string; impulseNs: Vec3 }
  | { kind: 'torque'; bodyId: string; torqueNm: Vec3 }
  | { kind: 'angularImpulse'; bodyId: string; angularImpulseNms: Vec3 }
  | { kind: 'kinematicTarget'; bodyId: string; positionM: Vec3 };
export type PhysicsJointConfig =
  | { id: string; kind: 'fixed'; aId: string; bId: string; anchorALocalM: Vec3; anchorBLocalM: Vec3 }
  | { id: string; kind: 'hinge'; aId: string; bId: string; anchorALocalM: Vec3; anchorBLocalM: Vec3;
      axisWorld: Vec3; limitRad: [number, number] };
export interface PhysicsWorldConfig {
  fixedStepSeconds: number;
  gravityMps2: Vec3;
  bodies: PhysicsBodyConfig[];
  joints?: PhysicsJointConfig[];
  broadPhase?: 'aabb';
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
export interface PhysicsState {
  stepIndex: number;
  timeSeconds: number;
  bodies: PhysicsBodyState[];
  contacts: PhysicsContact[];
  events: PhysicsEvent[];
  joints: PhysicsJointState[];
  ccdHits: PhysicsCcdHit[];
  pairStats: PhysicsPairStats;
}
export interface PhysicsOverlapSphereQuery { centerM: Vec3; radiusM: number; includeSensors?: boolean }
export interface PhysicsRayQuery { originM: Vec3; direction: Vec3; maxDistanceM: number; includeSensors?: boolean }
export interface PhysicsRayHit { bodyId: string; distanceM: number }
export interface PhysicsWorld {
  getState(): PhysicsState;
  step(fixedStepSeconds: number, commands?: PhysicsStepCommand[]): PhysicsState;
  overlapSphere(query: PhysicsOverlapSphereQuery): string[];
  raycast(query: PhysicsRayQuery): PhysicsRayHit | null;
  dispose(): void;
}

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
}
