import type { Body, PhysicsErrorCode, Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { projectHingePoseVelocityReference } from '../physics-rigid-hinge-velocity-reference/candidate.js';
import type { measureBodies } from '../physics-rigid-hinge-velocity-reference/diagnostics.js';

export type PairBodies = [Body, Body];
export type ProjectionOutput = ReturnType<typeof projectHingePoseVelocityReference>;
export type PairMetrics = ReturnType<typeof measureBodies>;
export type Stage = 'admitted' | 'angular-ready' | 'motor-ready' | 'free-ready' | 'projection-ready' | 'report-ready';
export interface KnownErrorRecord { name: 'PhysicsError'; code: PhysicsErrorCode; message: string }
export interface HingeMotorOptions { observeAttempt?: (attempt: HingeMotorAttempt) => void }
export interface HingeMotorJointReport {
  id: string; kind: 'hinge'; aId: string; bId: string; angleRad: number;
  linearImpulseNs: Vec3; angularImpulseNms: Vec3; motorImpulseNms: number;
}
export interface ActionRecord { bodyId: string; torqueNm: Vec3 | null; angularImpulseNms: Vec3 | null }
export interface Frames {
  sourceBodies: PairBodies; angularBodies: PairBodies; motorBodies: PairBodies;
  freeBodies: PairBodies; projectedBodies: PairBodies;
}
export interface ReachedFrames {
  sourceBodies: PairBodies; angularBodies: PairBodies | null; motorBodies: PairBodies | null;
  freeBodies: PairBodies | null; projectedBodies: PairBodies | null;
}
export interface MotorDiagnostics {
  inputAngleRad: number; targetSpeedRadps: number; limitRad: [number, number]; maxImpulseNms: number;
  blocked: boolean; impulseNms: number; relativeSpeedBeforeRadps: number; relativeSpeedAfterRadps: number;
}
export interface BodyCorrection { bodyId: string; linearImpulseNs: Vec3; angularImpulseNms: Vec3 }
export interface ReportCap { angularReactionNormNms: number; maxReactionNms: number; exceedsCap: boolean }
export interface EnergyByPhase { sourceJ: number; angularJ: number; motorJ: number; freeJ: number; projectedJ: number }
export interface WorkDiagnostics {
  externalAngularByBodyJ: [number, number]; externalAngularTotalJ: number;
  motorMidpointJ: number; motorSpinMidpointJ: number; motorResidualJ: number;
  freeDeltaKJ: number; projectionDeltaKJ: number; projectionObjectiveJ: number;
}
export interface Calls { motorCalls: 0 | 1; projectionCalls: 0 | 1 }
export interface HingeMotorAttempt {
  stage: Stage; sourceStepIndex: number; sourceTimeSeconds: number; acceptedReportAngleRad: number;
  parsedActions: [ActionRecord, ActionRecord]; frames: ReachedFrames; motor: MotorDiagnostics | null;
  projection: ProjectionOutput | null; jointReport: HingeMotorJointReport | null;
  bodyCorrections: [BodyCorrection, BodyCorrection] | null; energyByPhase: EnergyByPhase | null;
  work: WorkDiagnostics | null; reportCap: ReportCap | null; calls: Calls; error: KnownErrorRecord | null;
}
export interface HingeMotorDiagnostics {
  sourceStepIndex: number; sourceTimeSeconds: number; acceptedReportAngleRad: number;
  rawSourceAngleRad: number; rawFreeAngleRad: number; rawFinalAngleRad: number;
  parsedActions: [ActionRecord, ActionRecord]; frames: Frames;
  metrics: { source: PairMetrics; angular: PairMetrics; motor: PairMetrics; free: PairMetrics; projected: PairMetrics };
  motor: MotorDiagnostics; projection: ProjectionOutput; bodyCorrections: [BodyCorrection, BodyCorrection];
  energyByPhase: EnergyByPhase; work: WorkDiagnostics; reportCap: ReportCap;
  calls: { motorCalls: 1; projectionCalls: 1 };
}
export interface HingeMotorOutput { bodies: PairBodies; jointReport: HingeMotorJointReport; diagnostics: HingeMotorDiagnostics }
