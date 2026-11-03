import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const home=dirname(fileURLToPath(import.meta.url));
export function transformLifecycle(stage){
 const src=resolve(stage,'physics/src'),once=(s,a,b)=>{assert.equal(s.split(a).length-1,1,'Unique immutable lifecycle source anchor');return s.replace(a,b);},edit=(n,f)=>{const p=resolve(src,n);writeFileSync(p,f(readFileSync(p,'utf8')));};
 copyFileSync(resolve(home,'lifecycle-capture.ts'),resolve(src,'lifecycle-capture.ts'));
 edit('private-phase.ts',s=>{
  s=once(s,'const contexts=[];let active=null,records=0,applications=0,queries=0,queryPoints=0,anchorChecks=0,traceBytes=0,attempts=0;','const contexts=[];let active=null,records=0,applications=0,queries=0,queryPoints=0,anchorChecks=0,traceBytes=0,attempts=0,lifecycleBytes=0;');
  s=once(s,'traceBytes+size>phaseLimits.bytes','traceBytes+lifecycleBytes+size>phaseLimits.bytes');
  return s+`\nexport function phaseReserveLifecycle(bytes:number):boolean {if(!Number.isSafeInteger(bytes)||bytes<0||traceBytes+lifecycleBytes+bytes>phaseLimits.bytes)return false;lifecycleBytes+=bytes;return true;}
export function phaseLifecycleBudget():{traceBytes:number;lifecycleBytes:number;limitBytes:number}{return{traceBytes,lifecycleBytes,limitBytes:phaseLimits.bytes};}
`;
 });
 edit('world.ts',s=>{
  s="import {captureBeforeDispose} from './lifecycle-capture.js';\nimport {phasePrivateSnapshot} from './private-phase.js';\n"+s;
  return once(s,"  world.dispose = () => { if (!disposed) guarded('read', dispose); };",`  world.dispose = () => {
    if(disposed)return;
    // Preserve original reentrant refusal without observing or changing cleanup.
    if(running){guarded('read',dispose);return;}
    try{
      captureBeforeDispose(phaseContext.id,{
        view:()=>{
          if(bodies.length>2||contacts.length>1||pairWrenches.length>1||persistentPoints.size>1||activePairs.size>1||(owner?.recording?.frames.length??0)>1)throw new Error('Lifecycle shallow profile bound');
          return {model:modelCopy,options:optionsCopy,identity,
            publicStorage:{bodies,contacts,pairWrenches,events,jointStates,ccdHits,pairStats,stepIndex},
            privateStorage:{accepted:phaseContext.accepted,bodies,contacts,pairWrenches,persistentPoints:[...persistentPoints],activePairs:[...activePairs],sleepFrames,stepIndex},
            owner:owner?{recording:owner.recording,commandCount:owner.commandCount}:null};
        },
        state:()=>world.getState(),model:()=>world.getModel(),private:()=>phasePrivateSnapshot(phaseContext.id),
        owner:()=>owner?{recording:owner.recording,commandCount:owner.commandCount}:null,
      });
    }catch{} // Diagnostic observation can never mask the original dispose/serializer result.
    guarded('read',dispose);
  };`);
 });
 const entry=resolve(stage,'entry.ts');writeFileSync(entry,readFileSync(entry,'utf8')+"export {lifecycleCaptures,lifecycleCaptureStats} from './physics/src/lifecycle-capture.js';\n");
}
