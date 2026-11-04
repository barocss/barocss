import {DEFAULT_LIMITS,CoreStop,createMeter,validateFullPairProblem,finite,unsafe} from './full-pair-input.mjs';
import {EPS,prepareModel,reconstruct,margins,translations,fullCertificate,checkIterate,solveBasis,direction,dot} from './full-pair-linear.mjs';
import {makeExactSystem,exactDependency,dependencyNumbers,makeInfeasibilityCertificate} from './full-pair-exact.mjs';
export {DEFAULT_LIMITS} from './full-pair-input.mjs';
const copySafe=s=>({uDynamic:[...s.u],lambdaKgM:[...s.lambda],pendingRow:s.pending,pendingLambdaKgM:s.pending===null?0:s.lambda[s.pending],basisRows:[...s.W]});
function ieeeState(s){const view=new DataView(new ArrayBuffer(8));const encode=x=>{view.setFloat64(0,x,false);return view.getBigUint64(0,false).toString(16);};return s.W.join(',')+'|'+String(s.pending)+'|'+s.u.map(encode).join(',')+'|'+s.lambda.map(encode).join(',');}
function context(state,meter){return {iteration:meter.counters.iterations,enteringRow:state.pending,basisBefore:[...state.W],basisAfter:[...state.W],blocker:null,stepKgM:null,schurInverseKg:null,condition:null,exactDependent:null};}
function traceEntry(ctx,action,state){return {...ctx,basisBefore:[...ctx.basisBefore],basisAfter:[...state.W],action};}
/** Guard-only reduced budgets. All physical callers use solveFullPairPosition/defaults. */
/** @returns {import('./full-pair-types.js').FullPairResult} */
export function runFullPairCore(rawProblem,limits=DEFAULT_LIMITS){
  const problem=validateFullPairProblem(rawProblem),meter=createMeter(limits),model=prepareModel(problem),n=problem.rows.length;
  let state={u:Array(model.dynamicDof).fill(0),lambda:Array(n).fill(0),W:[],pending:null},ctx=context(state,meter),exact=null;
  const trace=[],seen=new Set();
  const getExact=()=>exact??(exact=makeExactSystem(model,meter));
  const common=()=>({basisRows:[...state.W],basisRank:state.W.length,dynamicDof:model.dynamicDof,counters:{...meter.counters},trace:trace.map(x=>({...x,basisBefore:[...x.basisBefore],basisAfter:[...x.basisAfter]})),lastSafeIterate:copySafe(state),worldStepped:false});
  const refused=(status,reason,proof=null)=>({ok:false,status,...common(),translations:null,lambdaKgM:null,primalMarginsM:null,objectiveKgM2:null,certificate:null,infeasibilityCertificate:proof,reason});
  try{
    // Exact zero incidence has no reciprocal/pivot ambiguity. Keep every row.
    for(let i=0;i<n;i++){
      meter.take('constraintTests');
      if(model.A[i].every(x=>x===0)&&model.b[i]>0){const proof=makeInfeasibilityCertificate(getExact(),[],i,[],meter);ctx.exactDependent=true;trace.push(traceEntry(ctx,'infeasible',state));return refused('INFEASIBLE',null,proof);}
    }
    while(true){
      if(state.pending===null){
        ctx=context(state,meter);const allMargins=margins(model,state.u,meter);
        if(state.W.some(i=>Math.abs(allMargins[i])>EPS))unsafe('iterate-certificate');
        const p=allMargins.findIndex((v,i)=>v< -EPS&&!state.W.includes(i));
        if(p<0){
          const u=reconstruct(model,state.lambda),checked=fullCertificate(model,u,state.lambda,meter),bodyTranslations=translations(model,u);
          if(Object.values(checked.certificate).some(v=>!Number.isFinite(v)||v>EPS)||checked.objectiveKgM2<0)unsafe('result-certificate');
          if(bodyTranslations.some(t=>Math.hypot(...t.u)>10))unsafe('translation-bound');
          state={...state,u};return {ok:true,status:'SOLVED',...common(),translations:bodyTranslations,lambdaKgM:[...state.lambda],primalMarginsM:[...checked.primalMarginsM],objectiveKgM2:checked.objectiveKgM2,certificate:{...checked.certificate},infeasibilityCertificate:null,reason:null};
        }
        state={...state,pending:p};
      }
      ctx=context(state,meter);meter.take('iterations');ctx.iteration=meter.counters.iterations;
      const key=ieeeState(state);if(seen.has(key))throw new CoreStop('WORK_LIMIT','cycle');seen.add(key);
      const p=state.pending,W=state.W,solved=solveBasis(W.map(i=>W.map(j=>model.G[i][j])),W.map(i=>model.G[i][p]),meter);
      ctx.condition=solved.condition;let r=solved.r;
      const projected=direction(model,W,p,r,meter);ctx.schurInverseKg=projected.delta;
      let dependent=false;
      if(projected.near){
        meter.take('rankChecks');const relation=exactDependency(getExact(),W,p,meter);
        ctx.exactDependent=relation.dependent;if(!relation.dependent)unsafe('near-dependent-independent');dependent=true;
        if(!relation.rExact.some(x=>x.n>0n)){const proof=makeInfeasibilityCertificate(getExact(),W,p,relation.rExact,meter);trace.push(traceEntry(ctx,'infeasible',state));return refused('INFEASIBLE',null,proof);}
        r=dependencyNumbers(relation.rExact,meter);
      }
      let dualStep=Infinity,blocker=null;
      for(let j=0;j<W.length;j++)if(r[j]>0){const step=finite(state.lambda[W[j]]/r[j]);if(step<0)unsafe('negative-step');if(step<dualStep||(step===dualStep&&(blocker===null||W[j]<blocker))){dualStep=step;blocker=W[j];}}
      let primalStep=Infinity;
      if(!dependent){meter.take('constraintTests');const deficit=finite(model.b[p]-dot(model.A[p],state.u));primalStep=finite(deficit/projected.delta);if(primalStep<0)unsafe('negative-step');}
      const drop=dualStep<=primalStep,step=drop?dualStep:primalStep;
      if(!Number.isFinite(step))unsafe('uncertified-infeasibility');ctx.stepKgM=step;ctx.blocker=drop?blocker:null;
      if(drop&&blocker===null)unsafe('uncertified-infeasibility');
      const lambda=[...state.lambda];for(let j=0;j<W.length;j++)lambda[W[j]]=finite(lambda[W[j]]-finite(step*r[j]));lambda[p]=finite(lambda[p]+step);
      if(drop)lambda[blocker]=0;
      const nextW=drop?W.filter(i=>i!==blocker):[...W,p].sort((a,b)=>a-b),pending=drop?p:null,u=reconstruct(model,lambda);
      checkIterate(model,u,lambda,nextW,pending,meter);
      meter.take('activeChanges');state={u,lambda,W:nextW,pending};trace.push(traceEntry(ctx,drop?(dependent?'dependent-drop':'drop'):'add',state));
    }
  }catch(error){
    if(!(error instanceof CoreStop))throw error;
    ctx.iteration=meter.counters.iterations;trace.push(traceEntry(ctx,error.status==='WORK_LIMIT'?'work-limit':'unsafe',state));
    return refused(error.status,error.reason);
  }
}
