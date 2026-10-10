import type { Vec3, Quat } from '../types.js';
import type { CapsuleQuerySceneV1, CapsuleSweepInputV1, CapsuleSweepHitV1 } from '../capsule-query.js';

export interface CapsuleControllerConfigV1 {
  version: 1;
  profile: 'upright-capsule-controller-v1';
  scene: CapsuleQuerySceneV1;
  positionM: Vec3;
}
export interface CapsuleControllerStepV1 {
  dtSeconds: number;
  sceneRevision: string;
  desiredVelocityMps: Vec3;
}
export interface CapsuleControllerSupportV1 { bodyId: string; normal: Vec3; }
export interface CapsuleControllerAssistV1 {
  bodyId: string;
  heightM: number;
  directionXZ: [number, number];
  frames: number;
}
export interface CapsuleControllerStateV1 {
  version: 1;
  profile: 'upright-capsule-controller-v1';
  sceneRevision: string;
  stepIndex: number;
  timeSeconds: number;
  positionM: Vec3;
  velocityMps: Vec3;
  orientationXYZW: Quat;
  fallVelocityYMps: number;
  grounded: boolean;
  support: CapsuleControllerSupportV1 | null;
  blocked: boolean;
  assist: CapsuleControllerAssistV1 | null;
  queryCount: number;
}
export interface UprightCapsuleController {
  getSnapshot(): CapsuleControllerStateV1;
  step(command: CapsuleControllerStepV1): CapsuleControllerStateV1;
  dispose(): void;
}

/** Private recording types. These are not root API exports. */
export interface ErrorRecord { name: string; code?: string; message: string; }
export interface QueryRecord {
  kind: string;
  preview: boolean;
  input: CapsuleSweepInputV1;
  hit: CapsuleSweepHitV1 | null;
  error: ErrorRecord | null;
}
export interface SegmentRecord {
  kind: string;
  fromM: Vec3;
  displacementM: Vec3;
  toM: Vec3;
  queryIndices: number[];
}
export interface GravityPrediction {
  previousFallVelocityYMps: number;
  previousGrounded: boolean;
  previousAssisted: boolean;
  predictedFallVelocityYMps: number;
  predictedDeltaYM: number;
}
export interface CharacterState extends Omit<CapsuleControllerStateV1, 'version' | 'profile'> {
  lastQueries: QueryRecord[];
  lastSegments: SegmentRecord[];
  gravityPrediction: GravityPrediction | null;
}
export interface RejectedAttempt {
  acceptedState: CharacterState;
  attemptedState: CharacterState | null;
  error: ErrorRecord;
}
export interface CharacterDiagnostics {
  queryBudget?: number;
  slideBudget?: number;
  assistCap?: number;
  numericFault?: boolean;
}
export interface CharacterCore {
  getState(): CharacterState;
  getLastRejected(): RejectedAttempt | null;
  step(dt: number, velocity: Vec3, revision?: string): CharacterState;
  dispose(): void;
}
