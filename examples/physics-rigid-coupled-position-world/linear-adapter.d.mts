export interface PositionBody { id: string; inverseMass: number }
export interface PositionRow { aId: string; bId: string; normal: [number,number,number]; depthM: number }
export interface PositionProblem { bodies: PositionBody[]; rows: PositionRow[] }
export interface Certificate { primalViolationM: number; negativeMultiplierKgM: number; complementarityKgM2: number; stationarityKgM: number }
export interface PositionSolution {
  ok: boolean; status: 'SOLVED' | 'INFEASIBLE'; activeMask?: number; active?: number[];
  lambdaKgM?: number[]; translations?: {id:string;u:[number,number,number]}[];
  primalMarginsM?: number[]; objectiveKgM2?: number; certificate?: Certificate;
  gram: number[][]; singularMasks: number[]; infeasibleMasks: number; enumeratedMasks: number; worldStepped: false;
}
export class PositionReferenceError extends Error { code: string; constructor(code:string,message:string) }
export function validateProblem(problem: PositionProblem): void;
export function solvePosition(problem: PositionProblem): PositionSolution;
