// Private producer authority. No observer or event-ledger reads.
import {PhysicsError} from './types.js';
import type {Contact, ContactPoint, PairWrench, Vec3} from './types.js';
import type {Body, PhysicsEvent, Vec3 as MutableVec3} from './internal-types.js';
import {phaseQuery,phaseProducerBucket} from './private-phase.js';
import {representedNativeLine} from '../../B/candidate.js';
export interface MutableBodyWrench {linearImpulseNs:MutableVec3;angularImpulseAboutWorldOriginNms:MutableVec3}
export interface PairContribution {nonzero:boolean;onA:MutableBodyWrench;onB:MutableBodyWrench}
export interface MutablePairWrench {colliderAId:string;colliderBId:string;bodyAId:string;bodyBId:string;onA:MutableBodyWrench;onB:MutableBodyWrench}
const sides: readonly ('onA'|'onB')[]=['onA','onB'];
const fields: readonly ('linearImpulseNs'|'angularImpulseAboutWorldOriginNms')[]=['linearImpulseNs','angularImpulseAboutWorldOriginNms'];
const zero=():MutableBodyWrench=>({linearImpulseNs:[0,0,0],angularImpulseAboutWorldOriginNms:[0,0,0]});
const add=(a:Vec3,b:Vec3):MutableVec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const cross=(a:Vec3,b:Vec3):MutableVec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const emptyContribution=():PairContribution=>({nonzero:false,onA:zero(),onB:zero()});
export function actualContribution(anchor:Vec3,actualImpulseOnB:MutableVec3):PairContribution {
 const actualImpulseOnA:MutableVec3=[-actualImpulseOnB[0],-actualImpulseOnB[1],-actualImpulseOnB[2]];
 const result:PairContribution={nonzero:actualImpulseOnB.some(v=>v!==0),onA:{linearImpulseNs:[...actualImpulseOnA],angularImpulseAboutWorldOriginNms:cross(anchor,actualImpulseOnA)},onB:{linearImpulseNs:[...actualImpulseOnB],angularImpulseAboutWorldOriginNms:cross(anchor,actualImpulseOnB)}};
 checkContribution(result);return result;
}
export function checkContribution(value:Pick<PairWrench,'onA'|'onB'>):void {
 for(const side of sides)for(const key of fields)if(value[side][key].length!==3||value[side][key].some(v=>!Number.isFinite(v)))throw new PhysicsError('NUMERIC_LIMIT','unsafe producer contact contribution');
}
export function combineContribution(a:PairContribution,b:PairContribution):PairContribution {
 checkContribution(a);checkContribution(b);const result={nonzero:a.nonzero||b.nonzero,onA:zero(),onB:zero()};for(const side of sides)for(const key of fields)result[side][key]=add(a[side][key],b[side][key]);checkContribution(result);return result;
}
function colliderId(ids:ReadonlyMap<string,string>,id:string):string {
 const value=ids.get(id);if(value===undefined)throw new PhysicsError('NUMERIC_LIMIT','missing producer collider identity');return value;
}
export function addPairContribution(map:Map<string,MutablePairWrench>,a:Body,b:Body,colliderIds:ReadonlyMap<string,string>,value:PairContribution):void {
 checkContribution(value);if(!value.nonzero)return;const key=a.id+'\u0000'+b.id;let entry=map.get(key);if(!entry){entry={colliderAId:colliderId(colliderIds,a.id),colliderBId:colliderId(colliderIds,b.id),bodyAId:a.id,bodyBId:b.id,onA:zero(),onB:zero()};map.set(key,entry);}for(const side of sides)for(const field of fields)entry[side][field]=add(entry[side][field],value[side][field]);checkContribution(entry);phaseProducerBucket(key,map,value);
}
export function copyPairWrenches(map:ReadonlyMap<string,MutablePairWrench>):PairWrench[] {
 return [...map.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,v])=>structuredClone(v));
}
export function acceptedGeometry(bodies:Body[],pairs:readonly (readonly [number,number])[],colliderIds:ReadonlyMap<string,string>):Contact[] {
 const contacts:Contact[]=[];
 for(const[ai,bi]of pairs){const a=bodies[ai],b=bodies[bi],hit=phaseQuery(a,b,true);if(!hit)continue;const pair=hit._phase.pair;
  const points=hit._phase.result.points.map((point):ContactPoint=>{let native:ReturnType<typeof representedNativeLine>;try{native=representedNativeLine(pair,point.pointM,hit.normal);}catch(error){throw new PhysicsError('NUMERIC_LIMIT','accepted native line/gap refused: '+(error instanceof Error?error.message:String(error)));}return {id:point.id,normalAtoB:[...hit.normal],anchorM:[...point.pointM],pointOnAM:native.pointOnAM,pointOnBM:native.pointOnBM,signedGapM:native.signedGapM};}).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  if(points.some(p=>!Number.isFinite(p.signedGapM)))throw new PhysicsError('NUMERIC_LIMIT','unsafe accepted native gap');
  contacts.push({colliderAId:colliderId(colliderIds,a.id),colliderBId:colliderId(colliderIds,b.id),bodyAId:a.id,bodyBId:b.id,points});
 }return contacts.sort((a,b)=>a.bodyAId<b.bodyAId?-1:a.bodyAId>b.bodyAId?1:a.bodyBId<b.bodyBId?-1:a.bodyBId>b.bodyBId?1:0);
}
export function acceptedMembership(contacts:readonly Contact[]):Map<string,Omit<PhysicsEvent,'phase'>> {
 return new Map(contacts.map((c):[string,Omit<PhysicsEvent,'phase'>]=>[c.bodyAId+'\u0000'+c.bodyBId,{aId:c.bodyAId,bId:c.bodyBId,kind:'contact'}]));
}
