import { CASES } from './fixture.mjs';
import { createController } from './controller.mjs';
import { evaluate } from './metrics.mjs';
import { DT,STEPS,clone } from './constants.mjs';
export function observe(){return CASES.map(fixture=>{
 let controller,states=[],error=null,retained=null,rejected=null;
 try{controller=createController(fixture);states.push(controller.getState());for(let i=0;i<STEPS;i++)states.push(controller.step(DT,fixture.requestMps));}
 catch(e){error={name:e.name,code:e.code,message:e.message};if(controller){retained=controller.getState();rejected=controller.getLastRejected();}}
 finally{controller?.dispose();}
 const expected=fixture.expectedError??null,metrics=expected?null:evaluate(fixture,states);
 return {name:fixture.name,scene:clone(fixture.scene),positionM:[...fixture.positionM],requestMps:[...fixture.requestMps],expectedError:expected,states,error,retained,rejected,metrics,passed:expected?error?.code===expected&&states.length===0:!error&&metrics.passed};
});}
const p95=times=>[...times].sort((a,b)=>a-b)[Math.ceil(times.length*.95)-1];
export function timing(){const accepted=CASES.filter(f=>!f.expectedError);
 for(const f of accepted){const c=createController(f);for(let i=0;i<STEPS;i++)c.step(DT,f.requestMps);c.dispose();}
 const trials=[];for(let t=0;t<3;t++){const trial=[];for(const f of accepted){const c=createController(f),times=[];for(let i=0;i<STEPS;i++){const start=performance.now();c.step(DT,f.requestMps);times.push(performance.now()-start);}c.dispose();const percentile=p95(times);trial.push({name:f.name,samplesMs:times,p95Ms:percentile,passed:percentile<=8.33});}trials.push(trial);}
 return {trials,passed:trials.flat().every(v=>v.passed)};
}
