import { closestCandidate, RADIUS_M, dot } from './geometry.mjs';
export class SweepRefusal extends Error {constructor(code,message){super(message);this.name='SweepRefusal';this.code=code;}}
export function sweepBox(center,displacement,box,cap=64){
 let fraction=0;
 for(let iteration=0;iteration<cap;iteration++){
  const at=center.map((v,i)=>v+fraction*displacement[i]),closest=closestCandidate(at,box),gap=closest.distanceM-RADIUS_M;
  if(!Number.isFinite(gap))throw new SweepRefusal('NUMERIC_LIMIT','Nonfinite distance');
  if(iteration===0 && gap< -1e-12)throw new SweepRefusal('INITIAL_OVERLAP','Initial capsule overlaps a box');
  if(!closest.normalM)throw new SweepRefusal('AMBIGUOUS_NORMAL','No distance normal');
  if((iteration===0 && Math.abs(gap)<=1e-12)||gap<=1e-14){
   if(gap< -1e-12)throw new SweepRefusal('NUMERIC_LIMIT','Advancement crossed contact');
   return {bodyId:box.id,fraction,normalM:closest.normalM.slice(),pointM:closest.pointM.slice(),segmentM:closest.segmentM.slice(),iterations:iteration+1};
  }
  const closing=-dot(closest.normalM,displacement);
  if(closing<=0)return null;
  const next=fraction+gap/closing;
  if(!Number.isFinite(next))throw new SweepRefusal('NUMERIC_LIMIT','Nonfinite advancement');
  if(next>1)return null;
  if(next<=fraction)throw new SweepRefusal('ITERATION_LIMIT','Advancement cannot make progress');
  fraction=next;
 }
 throw new SweepRefusal('ITERATION_LIMIT','Fixed advancement cap exhausted');
}
export function sweepScene(center,displacement,boxes,excludeId){
 const hits=[];
 for(const box of boxes){if(box.id===excludeId)continue;const hit=sweepBox(center,displacement,box);if(hit)hits.push(hit);}
 if(!hits.length)return null;
 const minimum=Math.min(...hits.map(hit=>hit.fraction));
 return hits.filter(hit=>hit.fraction<=minimum+1e-9).sort((a,b)=>a.bodyId<b.bodyId?-1:a.bodyId>b.bodyId?1:0)[0];
}
