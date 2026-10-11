import type { Body, Hit, PhysicsWorld, Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { AdmittedCommands } from '../../packages/barocss-physics/src/validation.js';
import type { PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import type { WarmCacheStats } from '../physics-rigid-feature-contact-reference/warm-cache.js';
import type { SATFeature } from '../physics-rigid-signed-separation-reference/signed-sat.js';
import type { GlobalIslandStats } from './global-island.js';
import type { FullPairProblem, FullPairResult, FullPairCounters, FullPairCertificate } from './full-pair-types.js';

export type PositionPair = readonly [number, number];

/** The full original signed query runs before this compact copy is made. */
export interface CompactSelection {
  normal: Vec3;
  boundM: number;
  candidateIndex: number;
  pointM: Vec3;
  rawAxisLength: number;
  label: string;
  feature: SATFeature;
}

export interface PairObservation {
  pairKey: string;
  aIndex: number;
  bIndex: number;
  selection: CompactSelection;
}

export interface RowSource extends PairObservation { rowIndex: number }

export interface InitialDetection {
  pairKey: string;
  aIndex: number;
  bIndex: number;
  hit: Hit | null;
}

export interface Rounding {
  id: string;
  nominalTranslationM: Vec3;
  roundedFinalM: Vec3;
  actualDeltaM: Vec3;
  nominalActualDeltaDifferenceM: Vec3;
  exactRoundedFinalMatch: true;
  staticPositionAdditionPerformed: false;
  dynamicPositionAdditionPerformed: boolean;
}

export interface ErrorRecord {
  kind: 'typed-refusal' | 'unexpected-error';
  name: string;
  code?: string;
  message: string;
}

export interface FullPairPositionAttempt {
  preBodies: Body[];
  pairs: PositionPair[];
  initialDetections: InitialDetection[];
  pairObservations: PairObservation[];
  problem: FullPairProblem | null;
  rowSources: RowSource[];
  result: FullPairResult | null;
  hypotheticalBodies: Body[] | null;
  rounding: Rounding[] | null;
  finalPairObservations: PairObservation[];
  failurePair: string | null;
  workingApplicationCount: 0 | 1;
  error: ErrorRecord | null;
}

export interface FullPairPositionStats {
  tests: number;
  hits: number;
  rows: number;
  signedPreQueries: number;
  solverCalls: number;
  postPairTests: number;
  maxTranslationM: number;
  workingApplicationCount: 0 | 1;
  solverCounters: FullPairCounters;
  certificate: FullPairCertificate | null;
}

/** Private evidence/guard hooks. None is a PhysicsWorldConfig field. */
export interface FullPairPositionOptions {
  solve?: (problem: FullPairProblem) => FullPairResult;
  observeAttempt?: (attempt: FullPairPositionAttempt) => void;
}

/** Internal capture retains reached PRE observations on a known refusal. */
export interface FullPairProblemBuild {
  problem: FullPairProblem;
  rowSources: RowSource[];
  initialDetections: InitialDetection[];
  pairObservations: PairObservation[];
  tests: number;
  hits: number;
  signedPreQueries: number;
}

/** Actual frozen velocity-assembly geometry and current-step accumulators. */
export interface PointLedger {
  aId: string;
  bId: string;
  aIndex: number;
  bIndex: number;
  pairKey: string;
  pointId: string;
  family: 'face' | 'edge';
  pointM: Vec3;
  normal: Vec3;
  aPositionM: Vec3;
  bPositionM: Vec3;
  warm: PointImpulse;
  final: PointImpulse;
}

/** Accepted step only; every frame and action is copied. */
export interface StepLedger {
  beforeBodies: Body[];
  freeBodies: Body[];
  velocityBodies: Body[];
  finalBodies: Body[];
  fixedStepSeconds: number;
  gravityMps2: Vec3;
  actions: Array<[string, AdmittedCommands]>;
  points: PointLedger[];
}

/** Null means the later phase has not run. */
export interface StepAttempt {
  stage: 'free-ready' | 'velocity-ready' | 'closure-ready';
  ledger: Omit<StepLedger, 'velocityBodies' | 'finalBodies' | 'points'> & {
    velocityBodies: Body[] | null;
    finalBodies: Body[] | null;
    points: PointLedger[] | null;
  };
}

export interface FullPairPositionWorldOptions extends FullPairPositionOptions {
  observeStepAttempt?: (attempt: StepAttempt) => void;
}

export interface FullPairPositionWorld extends PhysicsWorld {
  getFullPairPositionStats(): FullPairPositionStats;
  getFullPairPositionAttempt(): FullPairPositionAttempt | null;
  getStepLedger(): StepLedger | null;
  getWarmCacheStats(): WarmCacheStats;
  getWarmCacheSnapshot(): Array<[string, PointImpulse]>;
  getGlobalContactStats(): GlobalIslandStats;
}
