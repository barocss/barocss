import type {Vec3} from '../scene/scene.js';

/** Dimensionless strengths and direction in renderer world-normal coordinates. */
export interface MeshLighting {ambientStrength:number;directionalStrength:number;direction:Vec3}
export function validateMeshLighting(input:unknown):MeshLighting {
 const keys=['ambientStrength','directionalStrength','direction'];
 if(!input||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype)throw new RangeError('Mesh lighting must be plain own data');
 const actual=Reflect.ownKeys(input),descriptors=Object.getOwnPropertyDescriptors(input);
 if(actual.length!==3||actual.some(k=>typeof k!=='string'||!keys.includes(k)||!('value'in descriptors[k])||!descriptors[k].enumerable))throw new RangeError('Mesh lighting has missing, unsupported or non-data fields');
 const ambientStrength=descriptors.ambientStrength.value,directionalStrength=descriptors.directionalStrength.value;
 if([ambientStrength,directionalStrength].some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)||ambientStrength+directionalStrength>1)throw new RangeError('Mesh lighting strengths must be in [0,1] with sum≤1');
 const inputDirection=descriptors.direction.value;
 if(!Array.isArray(inputDirection)||Object.getPrototypeOf(inputDirection)!==Array.prototype||inputDirection.length!==3||Reflect.ownKeys(inputDirection).length!==4)throw new RangeError('Light direction requires three own components');
 const direction=Array.from({length:3},(_,i)=>{const d=Object.getOwnPropertyDescriptor(inputDirection,String(i));if(!d||!('value'in d)||!d.enumerable||typeof d.value!=='number'||!Number.isFinite(d.value)||Math.abs(d.value)>1000)throw new RangeError('Light direction must be finite own data within ±1000');return d.value;}) as [number, number, number];
 if(Math.hypot(...direction)===0)throw new RangeError('Light direction must be nonzero');
 Object.freeze(direction);return Object.freeze({ambientStrength,directionalStrength,direction});
}
