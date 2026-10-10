import { PhysicsError, type Body, type Vec3 } from '../../packages/barocss-physics/src/types.js';
import { MAX_STEP_DISPLACEMENT_M } from '../../packages/barocss-physics/src/limits.js';
import { PositionReferenceError, solvePosition, validateProblem } from './linear-adapter.mjs';
import type { PositionProblem, PositionSolution } from './linear-adapter.mjs';
import { freshPositionProblem } from './rows.js';
import type { CoupledAttempt, CoupledOptions, CoupledPositionStats, PositionPair } from './phase-types.js';
export const COUPLED_ERRORS = {
  PROFILE_LIMIT:'private coupled position profile is unsupported',
  INVALID_INPUT:'private coupled position input is invalid',
  INFEASIBLE:'private coupled position constraints are infeasible',
  RESULT:'private coupled position result is invalid',
} as const;
function invalid(): never { throw new PhysicsError('NUMERIC_LIMIT',COUPLED_ERRORS.RESULT); }
/** Validate all copied outputs/certificates before any working position changes. */
export function checkedPositionSolution(problem: PositionProblem, solution: PositionSolution): PositionSolution {
  if (!solution || solution.worldStepped!==false) invalid();
  if (solution.ok!==true || solution.status!=='SOLVED') {
    if (solution?.ok===false && solution.status==='INFEASIBLE') throw new PhysicsError('NUMERIC_LIMIT',COUPLED_ERRORS.INFEASIBLE);
    invalid();
  }
  const {translations,lambdaKgM,certificate,activeMask,primalMarginsM}=solution;
  const n=problem.rows.length;
  if (!Array.isArray(translations)||translations.length!==problem.bodies.length || !Array.isArray(lambdaKgM)||lambdaKgM.length!==n || !certificate ||
      !Array.isArray(primalMarginsM)||primalMarginsM.length!==n || !Array.from(primalMarginsM).every(Number.isFinite) || !Number.isInteger(activeMask)||activeMask!<0||activeMask!>=2**n ||
      solution.enumeratedMasks!==2**n||!Array.isArray(solution.singularMasks)||!Number.isInteger(solution.infeasibleMasks)||solution.infeasibleMasks<0 ||
      Array.from(solution.singularMasks).some(x=>!Number.isInteger(x)||x<0||x>=2**n)||new Set(solution.singularMasks).size!==solution.singularMasks.length || solution.singularMasks.length+solution.infeasibleMasks>2**n ||
      !Array.isArray(solution.gram)||solution.gram.length!==n||Array.from(solution.gram).some(row=>!Array.isArray(row)||row.length!==n||!Array.from(row).every(Number.isFinite)) ||
      !Array.isArray(solution.active)||solution.active.length!==Array.from({length:n},(_,i)=>i).filter(i=>activeMask!&(1<<i)).length||Array.from(solution.active).some((x,i)=>x!==Array.from({length:n},(_,j)=>j).filter(j=>activeMask!&(1<<j))[i]) ||
      !Number.isFinite(solution.objectiveKgM2)||solution.objectiveKgM2!<0) invalid();
  const certKeys=['primalViolationM','negativeMultiplierKgM','complementarityKgM2','stationarityKgM'] as const;
  if (certKeys.some(k=>!Number.isFinite(certificate[k])||certificate[k]<0||certificate[k]>1e-12) || Array.from(lambdaKgM).some(x=>!Number.isFinite(x)||x< -1e-12)) invalid();
  for(let i=0;i<translations.length;i++) {
    const t=translations[i],body=problem.bodies[i];
    if(!t||t.id!==body.id||!Array.isArray(t.u)||t.u.length!==3||!Array.from(t.u).every(Number.isFinite)||Math.hypot(...t.u)>MAX_STEP_DISPLACEMENT_M || (body.inverseMass===0&&t.u.some(x=>x!==0))) invalid();
  }
  // Recompute the KKT residuals from the exact problem and returned translations.
  const incidence=problem.rows.map(r=>problem.bodies.map(b=>r.normal.map(v=>b.id===r.aId?-v:b.id===r.bId?v:0)));
  const margins=problem.rows.map((r,i)=>incidence[i].reduce((sum,v,k)=>sum+v.reduce((s,c,d)=>s+c*translations[k].u[d],0),0)-r.depthM);
  if(margins.some((v,i)=>!Number.isFinite(v)||v< -1e-12||Math.abs(v-primalMarginsM[i])>1e-12||Math.abs(lambdaKgM[i]*v)>1e-12)) invalid();
  const stationary=problem.bodies.flatMap((b,k)=>b.inverseMass>0?translations[k].u.map((v,d)=>Math.abs(v/b.inverseMass-lambdaKgM.reduce((sum,q,i)=>sum+q*incidence[i][k][d],0))):[0]);
  if(stationary.some(v=>!Number.isFinite(v)||v>1e-12)) invalid();
  return structuredClone(solution);
}
export function solveCoupledProblem(problem: PositionProblem, solver: (problem: PositionProblem) => PositionSolution = solvePosition): PositionSolution {
  try { validateProblem(problem); return checkedPositionSolution(problem, solver(structuredClone(problem))); }
  catch(caught) {
    if(caught instanceof PositionReferenceError && (caught.code==='PROFILE_LIMIT'||caught.code==='INVALID_INPUT'||caught.code==='INFEASIBLE')) throw new PhysicsError('NUMERIC_LIMIT', COUPLED_ERRORS[caught.code]);
    throw caught;
  }
}
export function runCoupledPositionPhase(bodies: Body[], pairs: readonly PositionPair[], options: CoupledOptions = {}): {stats:CoupledPositionStats;attempt:CoupledAttempt} {
  const {problem,tests}=freshPositionProblem(bodies,pairs);
  const attempt: CoupledAttempt={workingBodies:structuredClone(bodies),problem:structuredClone(problem),tests,solution:null,error:null};
  let solution: PositionSolution;
  let positions: Vec3[];
  try {
    validateProblem(problem);
    const raw=(options.solve??solvePosition)(structuredClone(problem));
    attempt.solution=structuredClone(raw);
    solution=checkedPositionSolution(problem,raw);
    positions=bodies.map((b,i)=>b.positionM.map((x,d)=>x+solution.translations![i].u[d]) as Vec3);
    if(positions.some(p=>p.some(x=>!Number.isFinite(x)))) invalid();
  } catch(caught) {
    let error:unknown=caught;
    if(caught instanceof PositionReferenceError) {
      if(caught.code==='PROFILE_LIMIT'||caught.code==='INVALID_INPUT'||caught.code==='INFEASIBLE') error=new PhysicsError('NUMERIC_LIMIT',COUPLED_ERRORS[caught.code]);
    }
    let name='ThrownValue',message='Unexpected non-Error exception';
    try { if(error instanceof Error) { name=error.name;message=error.message; } } catch { /* Diagnostic reflection must not replace the original thrown value. */ }
    attempt.error={kind:error instanceof PhysicsError?'typed-refusal':'unexpected-error',name,message,...(error instanceof PhysicsError?{code:error.code}:{})};
    options.observeAttempt?.(structuredClone(attempt));
    throw error;
  }
  const translations=solution.translations!,certificate=solution.certificate!;
  // External attempt data is detached. Observer exceptions abort before application.
  options.observeAttempt?.(structuredClone(attempt));
  for(let i=0;i<bodies.length;i++) if(bodies[i].inverseMass>0) bodies[i].positionM=positions[i];
  return {stats:{tests,hits:problem.rows.length,rows:problem.rows.length,enumeratedMasks:solution.enumeratedMasks,singularMasks:solution.singularMasks.length,infeasibleMasks:solution.infeasibleMasks,activeMask:solution.activeMask!,maxTranslationM:Math.max(0,...translations.map(t=>Math.hypot(...t.u))),...certificate},attempt:structuredClone(attempt)};
}
