import { error } from '../validation.js';
import type { LinearProblem } from './types.js';

export const ERRORS = {
  pose: 'hinge pose state is invalid',
  result: 'hinge projection result is invalid',
  linear: 'hinge velocity problem is invalid',
  system: 'hinge velocity system is singular or unsafe',
  certificate: 'hinge velocity certificate is invalid',
} as const;
export const GATE = 1e-10;
export function fail(kind:'pose'|'linear'|'system'|'certificate'|'result'):never{return error('NUMERIC_LIMIT',ERRORS[kind]);}
export function exactFields(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
 if(value===null||typeof value!=='object'||Array.isArray(value))return false;
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return false;
 const own=Reflect.ownKeys(value);
 return own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,k)!,'value'));
}
export function dense(value:unknown,size:number):value is number[]{
 return Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&value.length===size&&Reflect.ownKeys(value).length===size+1&&Array.from({length:size},(_,i)=>i).every(i=>Object.hasOwn(value,i)&&typeof value[i]==='number'&&Number.isFinite(value[i]));
}
export function matrix(value:unknown,rows:number,columns:number):value is number[][]{
 return Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&value.length===rows&&Reflect.ownKeys(value).length===rows+1&&Array.from({length:rows},(_,i)=>i).every(i=>Object.hasOwn(value,i)&&dense(value[i],columns));
}
export function finiteData(value:unknown):boolean{
 if(typeof value==='number')return Number.isFinite(value);if(typeof value==='string'||typeof value==='boolean')return true;
 if(Array.isArray(value))return Object.getPrototypeOf(value)===Array.prototype&&Reflect.ownKeys(value).length===value.length+1&&Array.from({length:value.length},(_,i)=>i).every(i=>Object.hasOwn(value,i)&&finiteData(value[i]));
 if(value===null||typeof value!=='object')return false;
 const proto=Object.getPrototypeOf(value);return (proto===Object.prototype||proto===null)&&Reflect.ownKeys(value).every(k=>typeof k==='string'&&finiteData((value as Record<string,unknown>)[k]));
}
export function readProblem(value:unknown):LinearProblem{
 if(!exactFields(value,['a','b','h','y0','stopKind','stopRow'])||!matrix(value.a,11,12)||!dense(value.b,11)||!dense(value.h,12)||value.h.some(x=>x<=0)||!dense(value.y0,12))fail('linear');
 if(value.stopKind!=='none'&&value.stopKind!=='upper'&&value.stopKind!=='lower')fail('linear');
 if(!dense(value.stopRow,value.stopKind==='none'?0:12))fail('linear');
 return structuredClone(value) as unknown as LinearProblem;
}
