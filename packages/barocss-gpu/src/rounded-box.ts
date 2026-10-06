import type {Vec3} from './scene-types.js';
/** Outer half extents and radius in the actual scalar Float32 representation. */
export function roundedBoxInner(size:Vec3,radius:number):Vec3{
 if(!Number.isFinite(radius)||radius<=0||radius>1000||Math.fround(radius)<=0||size.length!==3||size.some(n=>!Number.isFinite(n)||n<=0||n>1000)||radius>Math.min(...size)/2)throw new Error('Rounded box radius must be positive and at most half the outer size');
 const r=Math.fround(radius),half=size.map(n=>Math.fround(n/2));
 if(half.some(n=>!Number.isFinite(n)||n<=0||r>n))throw new Error('Rounded box radius exceeds a represented Float32 half extent');
 return half.map(n=>Math.fround(n-r)) as Vec3;
}
