import { clone,dot,QUERY_CAP,MovementRefusal } from './constants.mjs';
export function queryContext(query,candidate,diagnostic={}){
 function raw(position,delta,kind,preview,excludeId=null){
  if(candidate.queryCount>=(diagnostic.queryBudget??QUERY_CAP))throw new MovementRefusal('QUERY_BUDGET','Per-step query budget exhausted');
  const input={revision:candidate.sceneRevision,centerM:[...position],displacementM:[...delta],excludeId},index=candidate.lastQueries.length;
  candidate.queryCount++;let hit=null,error=null;
  try{hit=query.sweep(input);}catch(e){error={name:e.name,code:e.code,message:e.message};candidate.lastQueries.push({kind,preview,input:clone(input),hit:null,error});throw e;}
  candidate.lastQueries.push({kind,preview,input:clone(input),hit:clone(hit),error});return {hit,indices:[index]};
 }
 function sweep(position,delta,kind,preview=false){
  const first=raw(position,delta,kind,preview);
  if(first.hit?.toiFraction===0 && dot(first.hit.normalFixtureToCapsule,delta)>=-1e-12){
   const second=raw(position,delta,kind+'-fresh-touch-departure',preview,first.hit.bodyId);
   if(second.hit?.toiFraction===0)throw new MovementRefusal('UNRESOLVED_TOUCH','Second unresolved touch');
   return {hit:second.hit,indices:[...first.indices,...second.indices]};
  }
  return first;
 }
 function commit(position,delta,kind,indices){const target=position.map((v,i)=>v+delta[i]);candidate.lastSegments.push({kind,fromM:[...position],displacementM:[...delta],toM:[...target],queryIndices:[...indices]});return target;}
 return {sweep,commit};
}
