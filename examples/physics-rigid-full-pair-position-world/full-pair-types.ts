import type { Vec3 } from '../../packages/barocss-physics/src/types.js';
export interface FullPairRow { aId:string; bId:string; normal:Vec3; boundM:number }
export interface FullPairProblem { bodies:Array<{id:string;inverseMass:number}>; rows:FullPairRow[] }
export interface FullPairLimits {
  iterations:number; activeChanges:number; rankChecks:number; linearSolves:number; constraintTests:number;
  exactIntegerOperations:number; reducedRationalBits:number; intermediateIntegerBits:number;
}
export interface FullPairCounters {
  iterations:number; activeChanges:number; rankChecks:number; linearSolves:number; constraintTests:number;
  factorizations:number; blockRightHandSides:number; exactIntegerOperations:number; exactPeakBits:number;
}
export interface FullPairCertificate {
  primalViolationM:number; negativeMultiplierKgM:number; complementarityKgM2:number; stationarityKgM:number;
}
export interface FullPairInfeasibilityCertificate {
  weights:string[]; sumWeights:'1/1'; dynamicDot:string[]; boundDotM:string;
}
export interface FullPairLastSafeIterate {
  uDynamic:number[]; lambdaKgM:number[]; pendingRow:number|null; pendingLambdaKgM:number; basisRows:number[];
}
export type FullPairUnsafeReason = 'nonfinite'|'negative-step'|'negative-multiplier'|'pivot'|'condition'|'factor-residual'
  |'direction-residual'|'near-dependent-independent'|'dependent-basis'|'dependency-conversion'
  |'uncertified-infeasibility'|'iterate-certificate'|'result-certificate'|'translation-bound';
export type FullPairWorkReason = `budget:${keyof FullPairLimits}`|'cycle';
export interface FullPairTrace {
  iteration:number; enteringRow:number|null; basisBefore:number[]; basisAfter:number[];
  action:'add'|'drop'|'dependent-drop'|'infeasible'|'unsafe'|'work-limit';
  blocker:number|null; stepKgM:number|null; schurInverseKg:number|null; condition:number|null; exactDependent:boolean|null;
}
interface Common {
  basisRows:number[]; basisRank:number; dynamicDof:number; counters:FullPairCounters; trace:FullPairTrace[];
  lastSafeIterate:FullPairLastSafeIterate; worldStepped:false;
}
export interface FullPairSolved extends Common {
  ok:true; status:'SOLVED'; translations:Array<{id:string;u:Vec3}>; lambdaKgM:number[]; primalMarginsM:number[];
  objectiveKgM2:number; certificate:FullPairCertificate; infeasibilityCertificate:null; reason:null;
}
export interface FullPairInfeasible extends Common {
  ok:false; status:'INFEASIBLE'; translations:null; lambdaKgM:null; primalMarginsM:null; objectiveKgM2:null;
  certificate:null; infeasibilityCertificate:FullPairInfeasibilityCertificate; reason:null;
}
export interface FullPairUnsafe extends Common {
  ok:false; status:'NUMERIC_UNSAFE'; translations:null; lambdaKgM:null; primalMarginsM:null; objectiveKgM2:null;
  certificate:null; infeasibilityCertificate:null; reason:FullPairUnsafeReason;
}
export interface FullPairWorkLimit extends Common {
  ok:false; status:'WORK_LIMIT'; translations:null; lambdaKgM:null; primalMarginsM:null; objectiveKgM2:null;
  certificate:null; infeasibilityCertificate:null; reason:FullPairWorkReason;
}
export type FullPairResult = FullPairSolved|FullPairInfeasible|FullPairUnsafe|FullPairWorkLimit;
