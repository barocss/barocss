import type { Body, Hit, Vec3 } from '../internal-types.js';
import type { PointImpulse } from '../persistent-box-contact.js';
import type { SATFeature } from './signed-sat.js';
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

