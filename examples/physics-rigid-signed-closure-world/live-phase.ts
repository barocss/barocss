import { PhysicsError, type Body } from '../../packages/barocss-physics/src/types.js';
import { copyBody } from '../../packages/barocss-physics/src/validation.js';
import { solveSignedPositionReference, validateSignedProblem, validateSignedResult } from '../physics-rigid-signed-separation-reference/signed-linear-solver.mjs';
import { applyLiveTranslationsOnce } from './apply.js';
import { refuse, mapLiveError, checkedLiveInputs, buildLiveInitialProblem, inspectHypothesis, chooseAddedPair, appendLiveRow } from './rows.js';
import type { Choice, ErrorRecord, InitialProblem, LiveSignedClosureAttempt, LiveSignedClosureOptions, LiveSignedClosureStats, PositionPair, SignedResult } from './closure-types.js';

export { LIVE_ERRORS, buildLiveInitialProblem, chooseAddedPair } from './rows.js';
export { applyLiveTranslationsOnce } from './apply.js';
export function zeroLiveSignedClosureStats():LiveSignedClosureStats {
  return {tests:0,hits:0,initialRows:0,rows:0,choices:0,hypothesisPairTests:0,signedPreQueries:0,
    enumeratedMasks:0,singularMasks:0,infeasibleMasks:0,activeMask:null,maxTranslationM:0,
    primalViolationM:0,negativeMultiplierKgM:0,complementarityKgM2:0,stationarityKgM:0,workingApplicationCount:0};
}
function errorRecord(error:unknown):ErrorRecord {
  let result:ErrorRecord={kind:'unexpected-error',name:'ThrownValue',message:'Unexpected non-Error exception'};
  try {
    if(error instanceof Error) result={kind:'unexpected-error',name:error.name,message:error.message};
    if(error instanceof PhysicsError) result={kind:'typed-refusal',name:error.name,code:error.code,message:error.message};
  } catch { /* A diagnostic getter/proxy cannot replace the primary thrown value. */ }
  return result;
}
/** Mutates only World-owned working dynamic positions, once, after the copied observer returns. */
export function runLiveSignedClosurePhase(workingBodies:Body[],sortedPairs:readonly PositionPair[],options:LiveSignedClosureOptions={}):{
  stats:LiveSignedClosureStats; attempt:LiveSignedClosureAttempt;
} {
  const stats=zeroLiveSignedClosureStats();
  const attempt:LiveSignedClosureAttempt={preBodies:[],pairs:[],initialDetections:[],initialRows:0,choices:[],finalBodies:null,rounding:null,workingApplicationCount:0,error:null};
  const initial:InitialProblem={problem:{bodies:[],rows:[]},rowSources:[],initialDetections:attempt.initialDetections,tests:0,signedPreQueries:0};
  let ready=false;
  try {
    checkedLiveInputs(workingBodies,sortedPairs);
    attempt.preBodies=workingBodies.map(copyBody);
    attempt.pairs=sortedPairs.map(([a,b])=>[a,b] as PositionPair);
    initial.problem.bodies=attempt.preBodies.map(b=>({id:b.id,inverseMass:b.inverseMass}));
    buildLiveInitialProblem(attempt.preBodies,attempt.pairs,initial);
    attempt.initialRows=initial.problem.rows.length;
    stats.tests=initial.tests;stats.hits=attempt.initialRows;stats.initialRows=attempt.initialRows;
    stats.rows=attempt.initialRows;stats.signedPreQueries=initial.signedPreQueries;
    if(attempt.initialRows>8) refuse('ROW_CAP');
    for(let index=0;index<9;index++) {
      const choice:Choice={index,problem:structuredClone(initial.problem),rowSources:structuredClone(initial.rowSources),
        solution:null,hypBodies:null,rounding:null,hypSelections:[],failurePair:null};
      attempt.choices.push(choice);
      validateSignedProblem(choice.problem);
      stats.choices++;
      const raw=(options.solve??solveSignedPositionReference)(structuredClone(choice.problem)) as SignedResult;
      // Validate first: malformed/proxy/copy failures retain their own exact thrown value.
      validateSignedResult(choice.problem,raw);
      choice.solution=structuredClone(raw);
      stats.enumeratedMasks+=raw.enumeratedMasks;stats.singularMasks+=raw.singularMasks.length;stats.infeasibleMasks+=raw.infeasibleMasks;
      stats.rows=choice.problem.rows.length;
      if(!raw.ok) refuse('INFEASIBLE');
      stats.activeMask=raw.activeMask;stats.maxTranslationM=Math.max(0,...raw.translations.map(t=>Math.hypot(...t.u)));
      Object.assign(stats,raw.certificate);
      const applied=applyLiveTranslationsOnce(attempt.preBodies,choice.problem,raw);
      choice.hypBodies=applied.bodies;choice.rounding=applied.rounding;
      inspectHypothesis(choice.hypBodies,attempt.pairs,choice.hypSelections);
      stats.hypothesisPairTests+=choice.hypSelections.length;
      // Keep the failing pair in evidence even when the policy helper refuses.
      const keys=new Set(choice.rowSources.map(r=>r.pairKey));
      choice.failurePair=choice.hypSelections.find(h=>keys.has(h.pairKey) && h.selection.boundM>1e-12)?.pairKey
        ?? choice.hypSelections.find(h=>!keys.has(h.pairKey) && h.selection.boundM>1e-12)?.pairKey ?? null;
      const next=chooseAddedPair(choice.rowSources,choice.hypSelections);
      if(next===null) {
        attempt.finalBodies=choice.hypBodies.map(copyBody);attempt.rounding=structuredClone(choice.rounding);ready=true;break;
      }
      appendLiveRow(initial.problem,initial.rowSources,attempt.preBodies,next,initial);
      stats.signedPreQueries=initial.signedPreQueries;stats.rows=initial.problem.rows.length;
      if(index===8) refuse('CHOICES');
    }
    if(!ready || attempt.finalBodies===null) refuse('CHOICES');
  } catch(caught) {
    const error=mapLiveError(caught);
    attempt.initialRows=attempt.initialDetections.filter(d=>d.hit!==null).length;
    attempt.error=errorRecord(error);
    options.observeAttempt?.(structuredClone(attempt));
    throw error;
  }
  // Observer mutation is detached; throwing observer wins and no working position is applied.
  options.observeAttempt?.(structuredClone(attempt));
  for(let i=0;i<workingBodies.length;i++) if(workingBodies[i].inverseMass>0) workingBodies[i].positionM=[...attempt.finalBodies![i].positionM];
  attempt.workingApplicationCount=1;stats.workingApplicationCount=1;
  return {stats:{...stats},attempt:structuredClone(attempt)};
}
