import { CASES,PROFILES } from './fixture.mjs';
import { createSnapshot } from '../physics-capsule-reuse-reference/snapshot.mjs';
import { createSnapshot as createBaselineSnapshot } from '../physics-capsule-sweep-reference/snapshot.mjs';
import { encodeF64 } from '../physics-capsule-sweep-reference/binary.mjs';
const ensure=(condition,message)=>{if(!condition)throw new Error(message);};
const copy=value=>JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const packed=hit=>hit?[hit.fraction,...hit.normalM,...hit.pointM,...hit.segmentM,hit.iterations]:[];
const exactBytes=(a,b)=>{const x=encodeF64(Float64Array.from(a)),y=encodeF64(Float64Array.from(b));return x.length===y.length&&x.every((v,i)=>v===y[i]);};
function queryResult(snapshot,query,onSweep){try{return {hit:snapshot.query(query,onSweep),code:null,error:null};}catch(error){return {hit:null,code:error.code??'UNEXPECTED',error:{name:error.name,message:error.message,string:String(error)}};}}
export function runControls(){
 const cases=[];
 for(let i=0;i<CASES.length;i++){
  const fixture=CASES[i],profile=PROFILES[i],source=copy(fixture.scene),snapshot=createSnapshot(source),baseline=createBaselineSnapshot(source),accepted=snapshot.getSnapshot();
  const diagnostics=snapshot.getDiagnostics();
  ensure(diagnostics.sourceCount===profile.sourceCount&&diagnostics.groupCount===profile.groupCount,'Distinct source/group count');
  ensure(diagnostics.keyByteCount===80*profile.groupCount,'Serialized key count');
  ensure(same(diagnostics.memberIDs,fixture.scene.boxes.map(box=>[box.id])),'Original order and IDs');
  let calls=0;const visited=[];
  const result=queryResult(snapshot,fixture.query,event=>{calls++;visited.push(event.selectedId);event.memberIDs[0]='caller-mutated';});
  const original=queryResult(baseline,fixture.query);
  ensure(calls===profile.expectedScalarCalls,'Actual scalar call count');
  ensure(same(visited,fixture.scene.boxes.filter(box=>box.id!==fixture.query.excludeId).map(box=>box.id)),'All eligible groups visited');
  ensure(result.code===fixture.error&&result.code===original.code&&same(result.error,original.error),'Exact full-query error name/message/string/code');
  ensure(same(result.hit,original.hit)&&exactBytes(packed(result.hit),packed(original.hit)),'Unchanged baseline output and original bits');
  ensure(same(accepted,fixture.scene)&&same(snapshot.getSnapshot(),accepted),'Accepted source and refusal retention');
  source.boxes[0].centerM[0]=9;source.boxes[0].id='mutated';
  const exposed=snapshot.getSnapshot();exposed.boxes[0].halfExtentsM[0]=4;exposed.boxes.reverse();
  diagnostics.memberIDs[0][0]='mutated';diagnostics.memberIDs.reverse();
  ensure(same(snapshot.getSnapshot(),accepted),'Source and output copies');
  ensure(same(snapshot.getDiagnostics().memberIDs,fixture.scene.boxes.map(box=>[box.id])),'Diagnostic copies and hook retention');
  const second=queryResult(snapshot,fixture.query);
  ensure(same(result,second)&&exactBytes(packed(result.hit),packed(second.hit)),'Same query after caller mutations');
  snapshot.dispose();snapshot.dispose();baseline.dispose();
  ensure(queryResult(snapshot,fixture.query).code==='DISPOSED','Disposed refusal');
  cases.push({name:fixture.name,sourceCount:profile.sourceCount,groupCount:profile.groupCount,scalarCalls:calls,code:result.code,error:result.error,baselineExact:true,copies:true});
 }
 return {passed:cases.length===9,cases,hookAbsentFromTimedCampaign:true};
}
