/** P0 design contract only. Not exported by the package and not a runtime API. */
export type Vec3 = readonly [number, number, number];
export type QuatXYZW = readonly [number, number, number, number];
export type Triangle = readonly [number, number, number];
export type EntityId = string;
export type Digest = `sha256:${string}`;

export interface Transform {
  readonly positionM: Vec3;
  readonly orientationXYZW: QuatXYZW;
}
export interface InitialRigidState extends Transform {
  readonly velocityMps: Vec3;
  readonly angularVelocityRadps: Vec3;
}
export type Inertia =
  | { readonly kind: 'primitive-com'; readonly about: 'com'; readonly frame: 'body-local' }
  | { readonly kind: 'sphere-isotropic'; readonly about: 'com'; readonly frame: 'body-local'; readonly kgM2: number };
export type RigidBody =
  | { readonly id: EntityId; readonly kind: 'dynamic'; readonly massKg: number;
      readonly inertia: Inertia; readonly initial: InitialRigidState }
  | { readonly id: EntityId; readonly kind: 'static' | 'kinematic'; readonly initial: Transform };
export type Geometry =
  | { readonly kind: 'sphere'; readonly radiusM: number }
  | { readonly kind: 'box'; readonly halfExtentsM: Vec3 }
  | { readonly kind: 'capsule'; readonly radiusM: number; readonly halfLengthM: number }
  // Reserved for the existing fluid basin in P5; never admitted by a rigid profile.
  | { readonly kind: 'box-interior'; readonly halfExtentsM: Vec3 };
export interface Collider {
  readonly id: EntityId;
  readonly bodyId: EntityId;
  readonly geometry: Geometry;
  readonly local: Transform;
  readonly material: { readonly restitution: number; readonly friction: {
    readonly static: number; readonly dynamic: number } };
  readonly sensor: boolean;
  readonly ccd: boolean;
  readonly filter: { readonly categoryBits: number; readonly maskBits: number };
}
interface JointBase {
  readonly id: EntityId;
  readonly bodyAId: EntityId;
  readonly bodyBId: EntityId;
  readonly anchorALocalM: Vec3;
  readonly anchorBLocalM: Vec3;
}
export type Joint =
  | (JointBase & { readonly kind: 'fixed' })
  | (JointBase & { readonly kind: 'hinge'; readonly axisWorld: Vec3;
      readonly limitRad: readonly [number, number]; readonly motor: null | {
        readonly targetSpeedRadps: number; readonly maxImpulseNms: number; readonly maxReactionNms: number } });

/** P5 schema. Declaring this data does not admit a cloth or coupled profile in P1. */
export interface Cloth {
  readonly id: EntityId;
  readonly restPositionsM: readonly Vec3[];
  readonly initialPositionsM: readonly Vec3[];
  readonly initialVelocitiesMps: readonly Vec3[];
  readonly vertexMassesKg: readonly number[];
  readonly triangles: readonly Triangle[];
  readonly pinnedVertexIndices: readonly number[];
  readonly constraints: readonly { readonly a: number; readonly b: number;
    readonly kind: 'stretch' | 'shear' | 'bend-distance'; readonly restLengthM: number;
    readonly complianceMPerN: number }[];
  readonly staticColliderIds: readonly EntityId[];
}
/** Existing PBF model uses visual unit weights, not calibrated kg or viscosity. */
export interface Fluid {
  readonly id: EntityId;
  readonly initialPositionsM: readonly Vec3[];
  readonly initialVelocitiesMps: readonly Vec3[];
  readonly massModel: { readonly kind: 'visual-unit-weights' };
  readonly particleRadiusM: number;
  readonly smoothingRadiusM: number;
  readonly staticColliderIds: readonly EntityId[];
  readonly visualSmoothing: { readonly kind: 'none' } | { readonly kind: 'xsph'; readonly coefficient: 0.15 };
}
export interface SourceBinding {
  readonly id: EntityId;
  readonly sourceRevision: string;
  readonly sourceDigest: Digest;
  readonly modelId: string;
  readonly occurrenceId: string;
  readonly entityIds: readonly EntityId[];
  readonly approximation: { readonly kind: 'control-net-box' | 'control-net-sphere'; readonly lossLabel: string };
}
export interface PhysicsModel {
  readonly format: 'barocss-physics-model';
  readonly version: 1;
  readonly revision: string;
  readonly frame: { readonly id: string; readonly basis: 'right-handed-xyz'; readonly rotation: 'local-to-world-xyzw' };
  readonly units: { readonly length: 'm'; readonly mass: 'kg'; readonly time: 's'; readonly angle: 'rad' };
  readonly gravityMps2: Vec3;
  readonly bodies: readonly RigidBody[];
  readonly colliders: readonly Collider[];
  readonly joints: readonly Joint[];
  readonly cloths: readonly Cloth[];
  readonly fluids: readonly Fluid[];
  readonly sourceBindings: readonly SourceBinding[];
}
export type RigidProfileId = 'rigid-discrete-v1' | 'rigid-persistent-box-v1' | 'rigid-large-v1';
export type PlannedVisualProfileId = 'cloth-pinned-sphere-visual-v1' | 'fluid-basin-visual-v1' |
  'fluid-basin-xsph-visual-v1' | 'fluid-static-box-visual-v1';
export type SupportProfileId = RigidProfileId | PlannedVisualProfileId;
export type WorldOptions =
  | { readonly profile: 'rigid-discrete-v1' | 'rigid-persistent-box-v1'; readonly fixedStepSeconds: number;
      readonly broadPhase: 'direct' | 'aabb' }
  | { readonly profile: 'rigid-large-v1'; readonly fixedStepSeconds: number; readonly broadPhase: 'aabb' }
  | { readonly profile: PlannedVisualProfileId; readonly fixedStepSeconds: number; readonly broadPhase: 'domain-fixed' };

export type PhysicsCommand =
  | { readonly kind: 'force'; readonly bodyId: EntityId; readonly forceN: Vec3 }
  | { readonly kind: 'impulse'; readonly bodyId: EntityId; readonly impulseNs: Vec3 }
  | { readonly kind: 'torque'; readonly bodyId: EntityId; readonly torqueNm: Vec3 }
  | { readonly kind: 'angularImpulse'; readonly bodyId: EntityId; readonly angularImpulseNms: Vec3 }
  | { readonly kind: 'kinematicTarget'; readonly bodyId: EntityId; readonly positionM: Vec3 };
export type Query =
  | { readonly kind: 'overlap-sphere'; readonly centerM: Vec3; readonly radiusM: number; readonly includeSensors: boolean }
  | { readonly kind: 'raycast'; readonly originM: Vec3; readonly direction: Vec3;
      readonly maxDistanceM: number; readonly includeSensors: boolean };
export type QueryResult =
  | { readonly kind: 'overlap-sphere'; readonly colliderIds: readonly EntityId[] }
  | { readonly kind: 'raycast'; readonly hit: null | { readonly bodyId: EntityId;
      readonly colliderId: EntityId; readonly distanceM: number } };
export interface Identity {
  readonly modelRevision: string;
  readonly modelDigest: Digest;
  readonly configurationDigest: Digest;
  readonly providerDigest: Digest;
  readonly profile: SupportProfileId;
  readonly frameId: string;
  readonly fixedStepSeconds: number;
}
export interface BodyState extends InitialRigidState {
  readonly id: EntityId;
  readonly kind: 'dynamic' | 'static' | 'kinematic';
  readonly sleeping: boolean;
}
export interface Contact {
  readonly colliderAId: EntityId;
  readonly colliderBId: EntityId;
  readonly bodyAId: EntityId;
  readonly bodyBId: EntityId;
  readonly normalAtoB: Vec3;
  readonly pointM: Vec3;
  readonly penetrationM: number;
  readonly normalImpulseNs: number;
  readonly tangentImpulseOnBNs: Vec3;
}
export interface JointState {
  readonly id: EntityId;
  readonly bodyAId: EntityId;
  readonly bodyBId: EntityId;
  readonly linearImpulseOnBNs: Vec3;
  readonly angularImpulseOnBNms: Vec3;
  readonly angleRad: number | null;
  readonly motorImpulseNms: number | null;
}
export interface PhysicsState {
  readonly identity: Identity;
  readonly stepIndex: number;
  readonly timeSeconds: number;
  readonly bodies: readonly BodyState[];
  readonly joints: readonly JointState[];
  readonly contacts: readonly Contact[];
  readonly events: readonly { readonly colliderAId: EntityId; readonly colliderBId: EntityId;
    readonly kind: 'contact' | 'sensor'; readonly phase: 'begin' | 'stay' | 'end' }[];
  readonly ccdHits: readonly { readonly bodyId: EntityId; readonly colliderId: EntityId;
    readonly toiFraction: number; readonly normalFixtureToBody: Vec3 }[];
  readonly cloths: readonly { readonly id: EntityId; readonly positionsM: Float64Array;
    readonly velocitiesMps: Float64Array; readonly diagnostics: {
      readonly maxStructuralExtension: number; readonly maxStructuralCompression: number;
      readonly maxVertexPenetrationM: number; readonly maxPinDriftM: number; readonly totalMassKg: number } }[];
  readonly fluids: readonly { readonly id: EntityId; readonly positionsM: Float64Array;
    readonly velocitiesMps: Float64Array; readonly diagnostics: {
      readonly meanAbsoluteDensityError: number; readonly p95Compression: number;
      readonly boundaryHits: number; readonly obstacleHits: number } }[];
  readonly pairStats: { readonly eligiblePairs: number; readonly candidatePairs: number; readonly aabbTests: number };
}
export type FailureCode = 'INVALID_STEP' | 'INITIAL_OVERLAP' | 'ITERATION_LIMIT' | 'INVALID_CONFIG' | 'INVALID_COMMAND' | 'INVALID_QUERY' | 'INVALID_SNAPSHOT' |
  'STALE_SOURCE' | 'STALE_SNAPSHOT' | 'WORLD_LIMIT' | 'NUMERIC_LIMIT' | 'DISPOSED' | 'WORLD_OWNED' | 'REENTRANT_CALL';
export interface FailureDetails {
  readonly code: FailureCode;
  readonly operation: 'create' | 'step' | 'query' | 'read' | 'record' | 'restore' | 'cad-adapter';
  readonly phase: 'lifecycle' | 'identity' | 'admission' | 'budget' | 'candidate' | 'validation' | 'prepare-output';
  readonly reason: string;
  readonly domain: 'world' | 'rigid' | 'fluid' | 'cloth' | 'recording' | 'cad';
  readonly entityIds: readonly EntityId[];
  readonly accepted: null | { readonly stepIndex: number; readonly timeSeconds: number };
}
/** Runtime implementation must extend the package's canonical Error constructor. */
export interface PhysicsFailure extends Error { readonly code: FailureCode; readonly details: FailureDetails }
export interface PhysicsWorld {
  getModel(): PhysicsModel;
  getState(): PhysicsState;
  step(commands?: readonly PhysicsCommand[]): PhysicsState;
  query(input: Query): QueryResult;
  dispose(): void;
}
export type CreatePhysicsWorld = (model: PhysicsModel, options: WorldOptions) => PhysicsWorld;

type Serialized<T> = T extends Float64Array ? readonly number[]
  : T extends readonly (infer Item)[] ? readonly Serialized<Item>[]
  : T extends object ? { readonly [Key in keyof T]: Serialized<T[Key]> } : T;
export type RecordedState = Serialized<PhysicsState>;
export interface Recording {
  readonly format: 'barocss-physics-recording';
  readonly version: 1;
  readonly model: PhysicsModel;
  readonly options: WorldOptions;
  readonly identity: Identity;
  readonly frames: readonly { readonly stepIndex: number; readonly commands: readonly PhysicsCommand[] }[];
  readonly finalState: RecordedState;
}
export interface PhysicsRecorder {
  getState(): PhysicsState;
  step(commands?: readonly PhysicsCommand[]): PhysicsState;
  saveRecording(): Recording;
  dispose(): void;
}
export interface RestoredRecording { readonly world: PhysicsWorld; readonly recorder: PhysicsRecorder }
export type CreatePhysicsRecorder = (world: PhysicsWorld) => PhysicsRecorder;
export type RestorePhysicsRecording = (recording: Recording,
  expected: { readonly model: PhysicsModel; readonly options: WorldOptions;
    readonly providerDigest: Digest }) => RestoredRecording;

/** P2 wire codec: magic + bounded canonical typed encoding; preserves signed zero. */
export type SerializePhysicsRecording = (recording: Recording) => Uint8Array;
export type DeserializePhysicsRecording = (bytes: Uint8Array) => Recording;
