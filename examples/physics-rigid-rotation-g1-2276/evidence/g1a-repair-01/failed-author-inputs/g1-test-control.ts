/** Private staged test control. No public package export or production hook. */
import type { FreeRotationResult } from './rigid-free-rotation.js';
type Name = "dispatch" | "prepare" | "null" | "eligible" | "zero" | "nonzero" | "validate" | "inheritedAdvanceOrientation" | "sharedSin" | "sharedCos" | "bodySin" | "bodyCos" | "F01Site" | "F02Site" | "F03Site" | "faultThrows" | "guardReplacements" | "attachments" | "releases" | "cacheReads";
const counts: Record<Name,number> = {"dispatch":0,"prepare":0,"null":0,"eligible":0,"zero":0,"nonzero":0,"validate":0,"inheritedAdvanceOrientation":0,"sharedSin":0,"sharedCos":0,"bodySin":0,"bodyCos":0,"F01Site":0,"F02Site":0,"F03Site":0,"faultThrows":0,"guardReplacements":0,"attachments":0,"releases":0,"cacheReads":0};
const readers = new WeakMap<object,()=>Record<string,unknown>>();
const owned = new Set<object>();
let armed: {kind:string; marker?:Error; replacement?:[number,number,number]} | null = null;
export const g1Control = {
  count(name:Name):void { counts[name]++; },
  trig(name:'sharedSin'|'sharedCos'|'bodySin'|'bodyCos',result:number):number { counts[name]++; return result; },
  attach(world:object,reader:()=>Record<string,unknown>):void { if(readers.has(world))throw new Error('duplicate staged observer');readers.set(world,reader);owned.add(world);counts.attachments++; },
  release(world:object):void { if(!owned.delete(world))throw new Error('missing staged observer');readers.delete(world);counts.releases++; },
  cache(world:object):Record<string,unknown> { const read=readers.get(world);if(!read)throw new Error('missing staged observer');counts.cacheReads++;return read(); },
  arm(kind:string,marker?:Error,replacement?:[number,number,number]):void { if(armed)throw new Error('staged control already armed');armed={kind,marker,replacement}; },
  pending():boolean { return armed!==null; },
  cancel():void { armed=null; },
  replace(result:FreeRotationResult):void { if(armed?.kind.startsWith('N')){const value=armed.replacement;if(!value)throw new Error('missing guard replacement');result.angularVelocityRadps=[...value];armed=null;counts.guardReplacements++;} },
  hit(kind:'F01'|'F02'|'F03'):void { counts[(kind+'Site') as Name]++;if(armed?.kind===kind){const marker=armed.marker;armed=null;counts.faultThrows++;throw marker;} },
  stats():Record<Name,number> { return {...counts}; },
  assertReleased():void { if(owned.size||armed)throw new Error('staged observer/control leak'); }
};
