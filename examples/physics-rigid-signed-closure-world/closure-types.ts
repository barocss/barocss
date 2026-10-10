import type { Body, Hit, Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { SATFeature } from '../physics-rigid-signed-separation-reference/signed-sat.js';

export type PositionPair = readonly [number, number];
export interface SignedRow { aId:string; bId:string; normal:Vec3; boundM:number }
export interface SignedProblem { bodies:Array<{id:string;inverseMass:number}>; rows:SignedRow[] }
export interface SignedCertificate {
  primalViolationM:number; negativeMultiplierKgM:number; complementarityKgM2:number; stationarityKgM:number;
}
interface SignedCommon {
  gram:number[][]; singularMasks:number[]; infeasibleMasks:number; enumeratedMasks:number; worldStepped:false;
}
export interface SignedSolved extends SignedCommon {
  ok:true; status:'SOLVED'; activeMask:number; active:number[]; lambdaKgM:number[];
  translations:Array<{id:string;u:Vec3}>; primalMarginsM:number[]; objectiveKgM2:number; certificate:SignedCertificate;
}
export interface SignedInfeasible extends SignedCommon { ok:false; status:'INFEASIBLE' }
export type SignedResult = SignedSolved | SignedInfeasible;
export interface CompactSelection {
  normal:Vec3; boundM:number; candidateIndex:number; pointM:Vec3; rawAxisLength:number; label:string; feature:SATFeature;
}
export interface PairObservation { pairKey:string; aIndex:number; bIndex:number; selection:CompactSelection }
export interface RowSource extends PairObservation { kind:'initial'|'added' }
export interface InitialDetection { pairKey:string; aIndex:number; bIndex:number; hit:Hit|null }
export interface Rounding {
  id:string; nominalTranslationM:Vec3; roundedFinalM:Vec3; actualDeltaM:Vec3; nominalActualDeltaDifferenceM:Vec3;
  exactRoundedFinalMatch:true; staticPositionAdditionPerformed:false; dynamicPositionAdditionPerformed:boolean;
}
export interface Choice {
  index:number; problem:SignedProblem; rowSources:RowSource[]; solution:SignedResult|null;
  hypBodies:Body[]|null; rounding:Rounding[]|null; hypSelections:PairObservation[]; failurePair:string|null;
}
export interface ErrorRecord { kind:'typed-refusal'|'unexpected-error'; name:string; code?:string; message:string }
export interface LiveSignedClosureAttempt {
  preBodies:Body[]; pairs:PositionPair[]; initialDetections:InitialDetection[]; initialRows:number;
  choices:Choice[]; finalBodies:Body[]|null; rounding:Rounding[]|null;
  workingApplicationCount:0|1; error:ErrorRecord|null;
}
export interface LiveSignedClosureStats extends SignedCertificate {
  tests:number; hits:number; initialRows:number; rows:number; choices:number; hypothesisPairTests:number;
  signedPreQueries:number; enumeratedMasks:number; singularMasks:number; infeasibleMasks:number;
  activeMask:number|null; maxTranslationM:number; workingApplicationCount:0|1;
}
/** Private hooks. Neither hook is a PhysicsWorldConfig field. */
export interface LiveSignedClosureOptions {
  solve?:(problem:SignedProblem)=>SignedResult;
  observeAttempt?:(attempt:LiveSignedClosureAttempt)=>void;
}
export interface InitialProblem {
  problem:SignedProblem; rowSources:RowSource[]; initialDetections:InitialDetection[]; tests:number; signedPreQueries:number;
}
