import {createUprightCapsuleController} from '@barocss/physics';
import {config,command,copyData,bindingsFor,frameFor,BASIS} from './frame.mjs';
export function createHostController(viewer,inputFixture,packets,{onPresent=()=>{}}={}){
 const fixture=copyData(inputFixture);
 let cpu=createUprightCapsuleController(config(fixture)),bindings=bindingsFor(packets,fixture),frame=frameFor(cpu.getSnapshot(),bindings),displayStep=0,needsReset=false,disposed=false;
 try{onPresent();viewer.setPackets(copyData(packets));viewer.applyMotionFrame(copyData(frame),copyData(bindings),BASIS);}catch(e){cpu.dispose();throw e;}
 return {
 getSnapshot(){if(disposed)throw new Error('Host disposed');return {state:cpu.getSnapshot(),frame:copyData(frame),bindings:copyData(bindings),displayStep,needsReset};},
 step(request=command(fixture)){if(disposed||needsReset)throw new Error('Host needs reset');const start=performance.now();const state=cpu.step(request),next=frameFor(state,bindings),solverMs=performance.now()-start,submitStart=performance.now();try{viewer.applyMotionFrame(copyData(next),copyData(bindings),BASIS);frame=next;displayStep=state.stepIndex;}catch(e){needsReset=true;throw e;}const submitMs=performance.now()-submitStart;return {state:copyData(state),stepIndex:state.stepIndex,solverMs,submitMs,hostMs:performance.now()-start,twinSteps:0};},
 markDisplayUncertain(){needsReset=true;displayStep=null;},
 dispose(){if(!disposed){disposed=true;cpu.dispose();}}
 };
}
