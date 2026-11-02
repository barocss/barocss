/** Proposed canonical breaking data contract. Design artifact; not a package export. */
import type {
  EntityId, Vec3, Identity, BodyState, JointState, PhysicsCommand, PhysicsModel,
  WorldOptions, Query, QueryResult, PhysicsState as UnchangedDomainFields,
} from '../../packages/barocss-physics/src/types.js';

/** Geometry on the accepted end pose. This is not a historical force application. */
export interface ContactPoint {
  /** Deterministic within this accepted geometry snapshot; not a cache identity. */
  readonly id: string;
  readonly normalAtoB: Vec3;
  /** Validated finite-cell represented native normal-line anchor. */
  readonly anchorM: Vec3;
  readonly pointOnAM: Vec3;
  readonly pointOnBM: Vec3;
  /** (B-entry t - A-exit t)*|normal| on anchor+t*normal; negative is penetration. */
  readonly signedGapM: number;
}

export interface Contact {
  readonly colliderAId: EntityId;
  readonly colliderBId: EntityId;
  readonly bodyAId: EntityId;
  readonly bodyBId: EntityId;
  /** Nonempty, independently validated native points; no average representative. */
  readonly points: readonly ContactPoint[];
}

/** Actual contact impulse on one body over the accepted step interval. */
export interface BodyContactWrench {
  readonly linearImpulseNs: Vec3;
  /** Sum of actual p cross J about O=[0,0,0]m in the state frame. */
  readonly angularImpulseAboutWorldOriginNms: Vec3;
}

export interface PairWrench {
  readonly colliderAId: EntityId;
  readonly colliderBId: EntityId;
  readonly bodyAId: EntityId;
  readonly bodyBId: EntityId;
  /** Independently accumulated actual A contribution, not a fabricated reaction. */
  readonly onA: BodyContactWrench;
  readonly onB: BodyContactWrench;
}

/** Membership changes between successive accepted contact/sensor geometries. */
export interface ContactEvent {
  readonly colliderAId: EntityId;
  readonly colliderBId: EntityId;
  readonly kind: 'contact' | 'sensor';
  readonly phase: 'begin' | 'stay' | 'end';
}

export interface PhysicsState {
  readonly schemaVersion: 2;
  readonly identity: Identity;
  readonly stepIndex: number;
  readonly timeSeconds: number;
  readonly bodies: readonly BodyState[];
  readonly joints: readonly JointState[];
  readonly contacts: readonly Contact[];
  /** Mandatory, including [] at step0 and in current visual-domain states. */
  readonly pairWrenches: readonly PairWrench[];
  readonly events: readonly ContactEvent[];
  readonly ccdHits: UnchangedDomainFields['ccdHits'];
  readonly cloths: UnchangedDomainFields['cloths'];
  readonly fluids: UnchangedDomainFields['fluids'];
  readonly pairStats: UnchangedDomainFields['pairStats'];
}

type Serialized<T> = T extends Float64Array ? readonly number[]
  : T extends readonly (infer Item)[] ? readonly Serialized<Item>[]
  : T extends object ? { readonly [Key in keyof T]: Serialized<T[Key]> } : T;
export type RecordedState = Serialized<PhysicsState>;

export interface Recording {
  readonly format: 'barocss-physics-recording';
  readonly version: 2;
  readonly model: PhysicsModel;
  readonly options: WorldOptions;
  readonly identity: Identity;
  readonly frames: readonly { readonly stepIndex: number; readonly commands: readonly PhysicsCommand[] }[];
  readonly finalState: RecordedState;
}

export interface PhysicsWorld {
  getModel(): PhysicsModel;
  getState(): PhysicsState;
  step(commands?: readonly PhysicsCommand[]): PhysicsState;
  query(input: Query): QueryResult;
  dispose(): void;
}
export interface PhysicsRecorder {
  getState(): PhysicsState;
  step(commands?: readonly PhysicsCommand[]): PhysicsState;
  saveRecording(): Recording;
  dispose(): void;
}
export interface RestoredRecording { readonly world: PhysicsWorld; readonly recorder: PhysicsRecorder }
