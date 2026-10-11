import type { Body, Hit, Joint, PhysicsContact, PhysicsEvent, PhysicsJointState, PhysicsPairStats,
  PhysicsState, PhysicsWorld, PhysicsWorldConfig, Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { AdmittedCommands } from '../../packages/barocss-physics/src/validation.js';
import type { PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import type { ActionRecord, BodyCorrection, HingeMotorJointReport, KnownErrorRecord, MotorDiagnostics,
  PairBodies, PairMetrics, ProjectionOutput, ReportCap } from '../physics-rigid-hinge-motor-reference/types.js';

export type { Body, Joint, KnownErrorRecord, PairBodies, PairMetrics, ProjectionOutput };
export type WorldBodies = [Body, Body, Body, Body];
export type WorldActions = [ActionRecord, ActionRecord, ActionRecord, ActionRecord];
export type Actions = Map<string, AdmittedCommands>;
export interface WorldProfile {
  dt: number; gravity: Vec3; bodies: WorldBodies; joints: [Joint, Joint]; pairs: Array<[number, number]>;
  pairConfigs: [PhysicsWorldConfig, PhysicsWorldConfig]; localJoints: [Joint, Joint];
}
export interface WorldCalls {
  angularUpdates: number; freeIntegrations: number; motorCalls: number; projectionCalls: number; reportCalls: number;
}
export interface PairCalls { motorCalls: 0 | 1; projectionCalls: 0 | 1; reportCalls: 0 | 1 }
export type PairOperation = 'motor' | 'projection' | 'report';
export interface PairLastCall { operation: PairOperation; ordinal: 1 | 2; outcome: 'started' | 'returned' | 'known-refused' }
export interface PairReport {
  jointReport: HingeMotorJointReport; bodyCorrections: [BodyCorrection, BodyCorrection]; reportCap: ReportCap;
}
export interface PairProgress {
  jointId: string; motor: MotorDiagnostics | null; projection: ProjectionOutput | null; report: PairReport | null;
  calls: PairCalls; completedCalls: PairCalls; lastCall: PairLastCall | null; projectedRawHex: string | null;
}
export interface WorldFrames {
  sourceBodies: WorldBodies; angularBodies: WorldBodies; motorBodies: WorldBodies; freeBodies: WorldBodies;
  postContactBodies: WorldBodies; projectedBodies: WorldBodies;
}
export interface ReachedWorldFrames {
  sourceBodies: WorldBodies; angularBodies: WorldBodies | null; motorBodies: WorldBodies | null;
  freeBodies: WorldBodies | null; postContactBodies: WorldBodies | null; projectedBodies: WorldBodies | null;
}
export interface WorldEnergyByPhase {
  sourceJ: number; angularJ: number; motorJ: number; freeJ: number; postContactJ: number; projectedJ: number;
}
export interface WorldPairWork {
  externalAngularByBodyJ: [number, number]; externalAngularTotalJ: number;
  motorMidpointJ: number; motorSpinMidpointJ: number; motorResidualJ: number;
  freeDeltaKJ: number; projectionDeltaKJ: number; projectionObjectiveJ: number; contactDeltaKJ: number;
}
export interface PairDiagnostic {
  jointId: string; aId: string; bId: string; acceptedReportAngleRad: number;
  rawSourceAngleRad: number; rawFreeAngleRad: number; rawPostContactAngleRad: number; rawFinalAngleRad: number;
  parsedActions: [ActionRecord, ActionRecord]; motor: MotorDiagnostics; projection: ProjectionOutput;
  jointReport: HingeMotorJointReport; bodyCorrections: [BodyCorrection, BodyCorrection];
  energyByPhase: WorldEnergyByPhase; work: WorldPairWork; reportCap: ReportCap;
  metrics: { source: PairMetrics; angular: PairMetrics; motor: PairMetrics; free: PairMetrics;
    postContact: PairMetrics; projected: PairMetrics }; calls: PairCalls;
}
export interface ContactCheck {
  pass: number; pairIndex: number; aId: string; bId: string; aPositionM: Vec3; bPositionM: Vec3; hit: Hit | null;
}
export interface WorldDiagnostics {
  sourceStepIndex: number; sourceTimeSeconds: number; acceptedStepIndex: number; acceptedTimeSeconds: number;
  fixedStepSeconds: number; frames: WorldFrames; pairs: [PairDiagnostic, PairDiagnostic];
  contactPasses: number; pairStats: PhysicsPairStats; calls: WorldCalls; contactChecks: ContactCheck[];
}
export type WorldStage = 'admitted' | 'angular-ready' | 'motor-ready' | 'free-ready' | 'contact-ready' |
  'pair0-ready' | 'pair1-ready' | 'report-ready';
export interface WorldAttempt {
  stage: WorldStage; sourceStepIndex: number; sourceTimeSeconds: number;
  attemptedStepIndex: number; attemptedTimeSeconds: number; acceptedReportAnglesRad: [number, number];
  parsedActions: WorldActions; frames: ReachedWorldFrames; pairs: [PairDiagnostic | null, PairDiagnostic | null];
  pairProgress: [PairProgress, PairProgress]; contactPasses: number; pairStats: PhysicsPairStats;
  calls: WorldCalls; contactChecks: ContactCheck[]; error: KnownErrorRecord | null;
}
export interface WorldOptions { observeAttempt?: (attempt: WorldAttempt) => void }
export interface ContactStageResult {
  contacts: PhysicsContact[]; persistentPoints: Map<string, PointImpulse>;
  sensed: Map<string, Omit<PhysicsEvent, 'phase'>>;
}
export interface WorldTransactionSnapshot {
  stepIndex: number; timeSeconds: number; bodies: WorldBodies; contacts: PhysicsState['contacts'];
  events: PhysicsState['events']; joints: PhysicsJointState[]; ccdHits: PhysicsState['ccdHits'];
  pairStats: PhysicsPairStats; activePairs: Array<[string, Omit<PhysicsEvent, 'phase'>]>;
  persistentPoints: Array<[string, PointImpulse]>; sleepFrames: number[]; diagnostics: WorldDiagnostics | null;
}
export interface HingeVelocityWorld extends PhysicsWorld {
  getDiagnostics(): WorldDiagnostics | null; getTransactionSnapshot(): WorldTransactionSnapshot;
}
