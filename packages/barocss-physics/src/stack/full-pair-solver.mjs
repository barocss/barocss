import {DEFAULT_LIMITS,COUNTER_KEYS,CoreStop,createMeter,dataRecord,dataArray,dataFiniteVector,requireFull,validateFullPairProblem} from './full-pair-input.mjs';
import {prepareModel,reconstruct,fullCertificate,checkIterate,EPS} from './full-pair-linear.mjs';
import {verifyInfeasibilityCertificate} from './full-pair-exact.mjs';
import {runFullPairCore} from './full-pair-core.mjs';
export {DEFAULT_LIMITS,FullPairPositionReferenceError,MESSAGES,validateFullPairProblem,zeroFullPairCounters} from './full-pair-input.mjs';
export {runFullPairCore} from './full-pair-core.mjs';
const RESULT_KEYS=['ok','status','basisRows','basisRank','dynamicDof','counters','trace','lastSafeIterate','translations','lambdaKgM','primalMarginsM','objectiveKgM2','certificate','infeasibilityCertificate','reason','worldStepped'];
const CERT_KEYS=['primalViolationM','negativeMultiplierKgM','complementarityKgM2','stationarityKgM'];
const TRACE_KEYS=['iteration','enteringRow','basisBefore','basisAfter','action','blocker','stepKgM','schurInverseKg','condition','exactDependent'];
const UNSAFE_REASONS=['nonfinite','negative-step','negative-multiplier','pivot','condition','factor-residual','direction-residual','near-dependent-independent','dependent-basis','dependency-conversion','uncertified-infeasibility','iterate-certificate','result-certificate','translation-bound'];
const WORK_REASONS=[...Object.keys(DEFAULT_LIMITS).map(k=>'budget:'+k),'cycle'];
const fail=condition=>requireFull(condition,'result','NUMERIC_LIMIT');
const finiteNumber=x=>typeof x==='number'&&Number.isFinite(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const sameVector=(a,b)=>a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
function checkedArithmetic(fn){try{return fn();}catch(error){if(error instanceof CoreStop)requireFull(false,'result','NUMERIC_LIMIT');throw error;}}
function indices(raw,n,d){const a=dataArray(raw);fail(a!==null&&a.length<=d&&a.every((v,i)=>integer(v)&&v<n&&(i===0||v>a[i-1])));return a;}
function numberVector(raw,size){const a=dataFiniteVector(raw,size);fail(a!==null);return a;}
function indexOrNull(value,n){fail(value===null||(integer(value)&&value<n));return value;}
function checkedCounters(raw,d,n){
  const c=dataRecord(raw,COUNTER_KEYS);fail(c!==null&&COUNTER_KEYS.every(k=>integer(c[k])));
  for(const k of ['iterations','activeChanges','rankChecks','linearSolves','constraintTests','exactIntegerOperations'])fail(c[k]<=DEFAULT_LIMITS[k]);
  fail(c.exactPeakBits<=DEFAULT_LIMITS.intermediateIntegerBits&&c.activeChanges<=c.iterations&&c.rankChecks<=2*c.iterations&&c.linearSolves<=2*c.iterations);
  fail(c.factorizations<=c.linearSolves&&c.blockRightHandSides>=c.factorizations&&c.blockRightHandSides<=(Math.min(d,n)+1)*c.factorizations);
  if(n===0)fail(['iterations','activeChanges','rankChecks','linearSolves','constraintTests','factorizations','blockRightHandSides','exactIntegerOperations','exactPeakBits'].every(k=>c[k]===0));
  return {...c};
}
function checkedTrace(raw,n,d,counters,basisRows){
  const entries=dataArray(raw);fail(entries!==null&&entries.length<=counters.iterations+1);
  const trace=[];let previous=[],iteration=0,changes=0;
  for(const rawEntry of entries){
    const e=dataRecord(rawEntry,TRACE_KEYS);fail(e!==null&&integer(e.iteration)&&e.iteration>=iteration&&e.iteration<=counters.iterations);
    const before=indices(e.basisBefore,n,d),after=indices(e.basisAfter,n,d);fail(sameVector(before,previous));
    const enteringRow=indexOrNull(e.enteringRow,n),blocker=indexOrNull(e.blocker,n);
    fail(['add','drop','dependent-drop','infeasible','unsafe','work-limit'].includes(e.action)&&(e.exactDependent===null||typeof e.exactDependent==='boolean'));
    fail(e.stepKgM===null||(finiteNumber(e.stepKgM)&&e.stepKgM>=0));fail(e.schurInverseKg===null||finiteNumber(e.schurInverseKg));fail(e.condition===null||(finiteNumber(e.condition)&&e.condition>=0));
    if(e.action==='add'){
      fail(e.iteration>0&&enteringRow!==null&&!before.includes(enteringRow)&&blocker===null&&e.stepKgM!==null&&e.exactDependent!==true);
      fail(sameVector(after,[...before,enteringRow].sort((a,b)=>a-b)));changes++;
    }else if(e.action==='drop'||e.action==='dependent-drop'){
      fail(e.iteration>0&&enteringRow!==null&&!before.includes(enteringRow)&&blocker!==null&&before.includes(blocker)&&e.stepKgM!==null);
      fail((e.action==='dependent-drop'?e.exactDependent===true:e.exactDependent!==true)&&sameVector(after,before.filter(i=>i!==blocker)));changes++;
    }else fail(sameVector(before,after));
    trace.push({...e,basisBefore:[...before],basisAfter:[...after]});previous=after;iteration=e.iteration;
  }
  fail(changes===counters.activeChanges&&sameVector(previous,basisRows));return trace;
}
function checkedSafe(raw,model,basisRows){
  const s=dataRecord(raw,['uDynamic','lambdaKgM','pendingRow','pendingLambdaKgM','basisRows']);fail(s!==null);
  const u=numberVector(s.uDynamic,model.dynamicDof),lambda=numberVector(s.lambdaKgM,model.A.length),basis=indices(s.basisRows,model.A.length,model.dynamicDof),pending=indexOrNull(s.pendingRow,model.A.length);
  fail(sameVector(basis,basisRows)&&finiteNumber(s.pendingLambdaKgM)&&s.pendingLambdaKgM>=0&&lambda.every(v=>v>=0));
  fail(pending===null?s.pendingLambdaKgM===0:!basis.includes(pending)&&Object.is(s.pendingLambdaKgM,lambda[pending]));
  const expected=checkedArithmetic(()=>reconstruct(model,lambda));fail(u.every((v,k)=>Math.abs(v-expected[k])<=EPS));
  // This is separate validation work, not edits to copied core counters.
  checkedArithmetic(()=>checkIterate(model,u,lambda,basis,pending,createMeter()));
  return {uDynamic:[...u],lambdaKgM:[...lambda],pendingRow:pending,pendingLambdaKgM:s.pendingLambdaKgM,basisRows:[...basis]};
}
function checkedInfeasibility(problem,model,raw){
  const proof=dataRecord(raw,['weights','sumWeights','dynamicDot','boundDotM']);fail(proof!==null);
  const weights=dataArray(proof.weights,problem.rows.length),dynamicDot=dataArray(proof.dynamicDot,model.dynamicDof);
  fail(weights!==null&&weights.every(v=>typeof v==='string')&&dynamicDot!==null&&dynamicDot.every(v=>v==='0/1')&&proof.sumWeights==='1/1'&&typeof proof.boundDotM==='string');
  const copied={weights:[...weights],sumWeights:'1/1',dynamicDot:[...dynamicDot],boundDotM:proof.boundDotM};
  fail(checkedArithmetic(()=>verifyInfeasibilityCertificate(problem,copied,createMeter())));return copied;
}
/** @returns {import('./full-pair-types.js').FullPairResult} */
export function validateFullPairResult(rawProblem,rawResult){
  const problem=validateFullPairProblem(rawProblem);
  try{
    const model=checkedArithmetic(()=>prepareModel(problem)),r=dataRecord(rawResult,RESULT_KEYS);fail(r!==null);
    fail(typeof r.ok==='boolean'&&['SOLVED','INFEASIBLE','NUMERIC_UNSAFE','WORK_LIMIT'].includes(r.status)&&r.worldStepped===false);
    const basisRows=indices(r.basisRows,problem.rows.length,model.dynamicDof);fail(integer(r.basisRank)&&r.basisRank===basisRows.length&&r.dynamicDof===model.dynamicDof);
    const counters=checkedCounters(r.counters,model.dynamicDof,problem.rows.length),trace=checkedTrace(r.trace,problem.rows.length,model.dynamicDof,counters,basisRows),lastSafeIterate=checkedSafe(r.lastSafeIterate,model,basisRows);
    const common={basisRows:[...basisRows],basisRank:basisRows.length,dynamicDof:model.dynamicDof,counters,trace,lastSafeIterate,worldStepped:false};
    if(r.status==='SOLVED'){
      fail(r.ok===true&&r.reason===null&&r.infeasibilityCertificate===null&&lastSafeIterate.pendingRow===null);
      const ts=dataArray(r.translations,problem.bodies.length);fail(ts!==null);const translations=[];
      for(let i=0;i<ts.length;i++){const t=dataRecord(ts[i],['id','u']);fail(t!==null&&t.id===problem.bodies[i].id);const u=numberVector(t.u,3);fail(Math.hypot(...u)<=10);if(problem.bodies[i].inverseMass===0)fail(u.every(v=>Object.is(v,0)));translations.push({id:t.id,u:[...u]});}
      const lambdaKgM=numberVector(r.lambdaKgM,problem.rows.length),primalMarginsM=numberVector(r.primalMarginsM,problem.rows.length),certificate=dataRecord(r.certificate,CERT_KEYS);
      fail(certificate!==null&&CERT_KEYS.every(k=>finiteNumber(certificate[k])&&certificate[k]>=0&&certificate[k]<=EPS)&&finiteNumber(r.objectiveKgM2)&&r.objectiveKgM2>=0);
      fail(sameVector(lambdaKgM,lastSafeIterate.lambdaKgM));const u=translations.flatMap((t,i)=>model.offsets[i]===null?[]:t.u);fail(sameVector(u,lastSafeIterate.uDynamic));
      const actual=checkedArithmetic(()=>fullCertificate(model,u,lambdaKgM,createMeter()));
      fail(actual.primalMarginsM.every((v,i)=>v>=-EPS&&Math.abs(v-primalMarginsM[i])<=EPS)&&Math.abs(actual.objectiveKgM2-r.objectiveKgM2)<=EPS);
      fail(CERT_KEYS.every(k=>actual.certificate[k]<=EPS&&Math.abs(actual.certificate[k]-certificate[k])<=EPS));
      return {ok:true,status:'SOLVED',...common,translations,lambdaKgM:[...lambdaKgM],primalMarginsM:[...primalMarginsM],objectiveKgM2:r.objectiveKgM2,certificate:{...certificate},infeasibilityCertificate:null,reason:null};
    }
    fail(r.ok===false&&['translations','lambdaKgM','primalMarginsM','objectiveKgM2','certificate'].every(k=>r[k]===null));
    let infeasibilityCertificate=null;
    if(r.status==='INFEASIBLE'){fail(r.reason===null);infeasibilityCertificate=checkedInfeasibility(problem,model,r.infeasibilityCertificate);}
    else{fail(r.infeasibilityCertificate===null);fail((r.status==='NUMERIC_UNSAFE'?UNSAFE_REASONS:WORK_REASONS).includes(r.reason));}
    return {ok:false,status:r.status,...common,translations:null,lambdaKgM:null,primalMarginsM:null,objectiveKgM2:null,certificate:null,infeasibilityCertificate,reason:r.reason};
  }catch(error){throw error;}
}
/** No options, limits, seed, preferred basis, or prior result enters this API. */
/** @returns {import('./full-pair-types.js').FullPairResult} */
export function solveFullPairPosition(problem){return validateFullPairResult(problem,runFullPairCore(problem,DEFAULT_LIMITS));}
