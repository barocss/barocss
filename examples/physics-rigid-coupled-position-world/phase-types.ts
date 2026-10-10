import type { Body } from '../../packages/barocss-physics/src/types.js';
import type { PositionProblem, PositionSolution } from './linear-adapter.mjs';
export type PositionPair = readonly [number, number];
export interface CoupledPositionStats {
  tests: number; hits: number; rows: number; enumeratedMasks: number; singularMasks: number; infeasibleMasks: number;
  activeMask: number | null; maxTranslationM: number; primalViolationM: number; negativeMultiplierKgM: number;
  complementarityKgM2: number; stationarityKgM: number;
}
export interface CoupledAttempt {
  workingBodies: Body[]; problem: PositionProblem; tests: number;
  solution: PositionSolution | null;
  error: {kind:'typed-refusal'|'unexpected-error';name:string;code?:string;message:string} | null;
}
/** Private example injection hooks. They are not PhysicsWorldConfig fields. */
export interface CoupledOptions {
  solve?: (problem: PositionProblem) => PositionSolution;
  observeAttempt?: (attempt: CoupledAttempt) => void;
}
export function zeroCoupledStats(): CoupledPositionStats { return { tests:0,hits:0,rows:0,enumeratedMasks:0,singularMasks:0,infeasibleMasks:0,activeMask:null,maxTranslationM:0,primalViolationM:0,negativeMultiplierKgM:0,complementarityKgM2:0,stationarityKgM:0 }; }
