// @ts-nocheck
// Private producer authority. No observer or event-ledger reads.
import {PhysicsError} from './types.js';
import {phaseQuery,phaseProducerBucket} from './private-phase.js';
import {representedNativeLine} from '../../B/candidate.js';
const zero=()=>({linearImpulseNs:[0,0,0],angularImpulseAboutWorldOriginNms:[0,0,0]});
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const emptyContribution=()=>({nonzero:false,onA:zero(),onB:zero()});
export function actualContribution(anchor,actualImpulseOnB){
 const actualImpulseOnA=actualImpulseOnB.map(v=>-v);
 // Compute each side from the vector actually used by this common-anchor primitive.
 const result={nonzero:actualImpulseOnB.some(v=>v!==0),onA:{linearImpulseNs:[...actualImpulseOnA],angularImpulseAboutWorldOriginNms:cross(anchor,actualImpulseOnA)},onB:{linearImpulseNs:[...actualImpulseOnB],angularImpulseAboutWorldOriginNms:cross(anchor,actualImpulseOnB)}};
 checkContribution(result);return result;
}
export function checkContribution(value){for(const side of ['onA','onB'])for(const key of ['linearImpulseNs','angularImpulseAboutWorldOriginNms'])if(value[side][key].length!==3||value[side][key].some(v=>!Number.isFinite(v)))throw new PhysicsError('NUMERIC_LIMIT','unsafe producer contact contribution');}
export function combineContribution(a,b){checkContribution(a);checkContribution(b);const result={nonzero:a.nonzero||b.nonzero,onA:zero(),onB:zero()};for(const side of ['onA','onB'])for(const key of ['linearImpulseNs','angularImpulseAboutWorldOriginNms'])result[side][key]=add(a[side][key],b[side][key]);checkContribution(result);return result;}
export function addPairContribution(map,a,b,colliderIds,value){checkContribution(value);if(!value.nonzero)return;const key=a.id+'\u0000'+b.id;let entry=map.get(key);if(!entry){entry={colliderAId:colliderIds.get(a.id),colliderBId:colliderIds.get(b.id),bodyAId:a.id,bodyBId:b.id,onA:zero(),onB:zero()};map.set(key,entry);}for(const side of ['onA','onB'])for(const field of ['linearImpulseNs','angularImpulseAboutWorldOriginNms'])entry[side][field]=add(entry[side][field],value[side][field]);checkContribution(entry);phaseProducerBucket(key,map,value);}
export function copyPairWrenches(map){return [...map.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,v])=>structuredClone(v));}
export function acceptedGeometry(bodies,pairs,colliderIds){const contacts=[];
 for(const[ai,bi]of pairs){const a=bodies[ai],b=bodies[bi],hit=phaseQuery(a,b,true);if(!hit)continue;const pair=hit._phase.pair;
  const points=hit._phase.result.points.map(point=>{let native;try{native=representedNativeLine(pair,point.pointM,hit.normal);}catch(error){throw new PhysicsError('NUMERIC_LIMIT','accepted native line/gap refused: '+error.message);}return {id:point.id,normalAtoB:[...hit.normal],anchorM:[...point.pointM],pointOnAM:native.pointOnAM,pointOnBM:native.pointOnBM,signedGapM:native.signedGapM};}).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  if(points.some(p=>!Number.isFinite(p.signedGapM)))throw new PhysicsError('NUMERIC_LIMIT','unsafe accepted native gap');
  contacts.push({colliderAId:colliderIds.get(a.id),colliderBId:colliderIds.get(b.id),bodyAId:a.id,bodyBId:b.id,points});
 }return contacts.sort((a,b)=>a.bodyAId<b.bodyAId?-1:a.bodyAId>b.bodyAId?1:a.bodyBId<b.bodyBId?-1:a.bodyBId>b.bodyBId?1:0);
}
export function acceptedMembership(contacts){return new Map(contacts.map(c=>[c.bodyAId+'\u0000'+c.bodyBId,{aId:c.bodyAId,bId:c.bodyBId,kind:'contact'}]));}
