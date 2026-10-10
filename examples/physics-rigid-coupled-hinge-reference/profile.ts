import type {PhysicsState,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
import {error} from '../../packages/barocss-physics/src/validation.js';
export const ERRORS={dt:'private coupled hinge step must equal 1/120',profile:'private coupled hinge profile is unsupported',pose:'private coupled hinge archived pose is invalid',result:'private coupled hinge result is invalid'} as const;
export const DT=1/120;
export function denseDataArray(value:unknown):value is unknown[]{return Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&Reflect.ownKeys(value).length===value.length+1&&Array.from({length:value.length},(_,i)=>i).every(i=>Object.hasOwn(value,i));}
export function denseFinite(value:unknown,size:number,bound=Infinity):value is number[]{return denseDataArray(value)&&value.length===size&&value.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=bound);}
export function profileError():never{return error('INVALID_CONFIG',ERRORS.profile);}
export function poseError():never{return error('NUMERIC_LIMIT',ERRORS.pose);}
function data(value:unknown):boolean{
 if(typeof value==='number')return Number.isFinite(value);if(typeof value==='string'||typeof value==='boolean')return true;if(value===null||typeof value!=='object')return false;
 if(Array.isArray(value))return denseDataArray(value)&&value.every(data);
 if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return false;
 return Reflect.ownKeys(value).every(key=>{const d=Object.getOwnPropertyDescriptor(value,key);return typeof key==='string'&&d!==undefined&&'value'in d&&data(d.value);});
}
export function copyCarrier(input:PhysicsState):PhysicsState{
 if(!input||typeof input!=='object'||(Object.getPrototypeOf(input)!==Object.prototype&&Object.getPrototypeOf(input)!==null)||!data(input))poseError();
 if(!Number.isInteger(input.stepIndex)||input.stepIndex<0||input.stepIndex>3600||typeof input.timeSeconds!=='number'||input.timeSeconds!==input.stepIndex*DT)poseError();
 for(const field of ['bodies','contacts','events','joints','ccdHits'] as const)if(!denseDataArray(input[field]))poseError();
 if(input.bodies.length!==2||input.joints.length!==1||!input.pairStats||!['eligiblePairs','candidatePairs','aabbTests'].every(key=>{const v=(input.pairStats as unknown as Record<string,unknown>)[key];return typeof v==='number'&&Number.isInteger(v)&&v>=0;}))poseError();
 return structuredClone(input);
}
export type InputConfig=PhysicsWorldConfig;
