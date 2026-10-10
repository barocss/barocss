import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
export function openReference(path){
 const child=spawn('python3',[path],{stdio:['pipe','pipe','pipe']});let pending=null,stderr='',ended=false;
 child.stderr.on('data',d=>stderr+=d);child.on('error',e=>{pending?.reject(e);pending=null;ended=true;});child.on('exit',code=>{ended=true;if(pending){pending.reject(new Error(`Independent observer exit ${code}: ${stderr}`));pending=null;}});
 createInterface({input:child.stdout}).on('line',line=>{if(!pending)throw new Error('Unsolicited independent observer output');const request=pending;pending=null;clearTimeout(request.timer);try{request.resolve(JSON.parse(line));}catch(e){request.reject(e);}});
 return {ask(data){assert.equal(pending,null);assert.equal(ended,false);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending=null;child.kill();reject(new Error('Independent observer response timed out'));},30000);pending={resolve,reject,timer};child.stdin.write(JSON.stringify(data)+'\n');});},close(){child.stdin.end();},stderr:()=>stderr};
}
/** Actual staged attempt copies are retained before any deliberate control mutation. */
export function attemptRecorder(){
 const attempts=[];let mode='record',thrownValue;
 return {attempts,setMode(value,marker){mode=value;thrownValue=marker;},observeAttempt(payload){
  attempts.push(structuredClone(payload));
  if(mode==='mutate'){
   payload.workingState.bodies[0].positionM[0]=999;payload.workingState.bodies[1].orientation[0]=999;
   payload.workingState.pairStats.eligiblePairs=-1;payload.diagnostics.acceptedCenterM[0]=999;
   if(payload.diagnostics.hit)payload.diagnostics.hit.normal[0]=999;
   if(payload.workingState.ccdHits.length)payload.workingState.ccdHits[0].normalFixtureToBody[0]=999;
   if(payload.workingState.contacts.length)payload.workingState.contacts[0].pointM[0]=999;
  }
  if(mode==='throw')throw thrownValue;
 },last(){return attempts.length?structuredClone(attempts.at(-1)):null;}};
}
