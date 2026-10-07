/** Native Z-up instance placement. Geometry stays in its authoritative local frame. */
export type Vec3 = [number, number, number];
export type Axis = 0 | 1 | 2;
export interface Placement {
 translateMM: Vec3;
 rotationDegXYZ: Vec3;
 scaleXYZ: Vec3;
}
export function identityPlacement(): Placement {
 return {translateMM:[0,0,0],rotationDegXYZ:[0,0,0],scaleXYZ:[1,1,1]};
}
function vector(input:unknown,label:string,min:number,max:number):Vec3 {
 if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype)throw Error(label+' requires three own numbers');
 const keys=Reflect.ownKeys(input),descriptors=Object.getOwnPropertyDescriptors(input) as Record<string,PropertyDescriptor>;
 if(keys.length!==4||descriptors.length?.value!==3||![0,1,2].every(i=>{
  const d=descriptors[String(i)];return d&&'value'in d&&d.enumerable&&typeof d.value==='number'&&Number.isFinite(d.value)&&d.value>=min&&d.value<=max;
 }))throw Error(label+' requires three finite numbers within '+min+'..'+max);
 return [descriptors['0'].value,descriptors['1'].value,descriptors['2'].value];
}
/** Admission never reads accessors, sparse arrays, foreign prototypes, or extra fields. */
export function validatePlacement(input:unknown):Placement {
 if(!input||typeof input!=='object'||Object.getPrototypeOf(input)!==Object.prototype)throw Error('Plain placement record required');
 const keys=Reflect.ownKeys(input),d=Object.getOwnPropertyDescriptors(input),fields=['translateMM','rotationDegXYZ','scaleXYZ'];
 if(keys.length!==3||!fields.every(k=>Object.hasOwn(d,k)&&'value'in d[k]&&d[k].enumerable)||keys.some(k=>typeof k!=='string'||!fields.includes(k)))throw Error('Explicit translation, rotation and scale required');
 return {
  translateMM:vector(d.translateMM.value,'Translation (mm)',-10000,10000),
  rotationDegXYZ:vector(d.rotationDegXYZ.value,'Rotation (degrees)',-360,360),
  scaleXYZ:vector(d.scaleXYZ.value,'Positive scale',.001,100),
 };
}
function finiteVector(p:readonly number[],label:string):void {
 if(p.length!==3||p.some(n=>!Number.isFinite(n)))throw Error('Finite '+label+' XYZ required');
}
/** Row-major Rz * Ry * Rx. Same Euler convention as the own GPU rotation source. */
export function rotationMatrix(degrees:readonly number[]):number[] {
 finiteVector(degrees,'rotation');
 if(degrees.some(n=>Math.abs(n)>360))throw Error('Rotation exceeds ±360 degrees');
 const [x,y,z]=degrees.map(n=>n*Math.PI/180),sx=Math.sin(x),cx=Math.cos(x),sy=Math.sin(y),cy=Math.cos(y),sz=Math.sin(z),cz=Math.cos(z);
 return [cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx,sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx,-sy,cy*sx,cy*cx];
}
function multiply(m:readonly number[],v:readonly number[]):Vec3 {
 const result:Vec3=[m[0]*v[0]+m[1]*v[1]+m[2]*v[2],m[3]*v[0]+m[4]*v[1]+m[5]*v[2],m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
 finiteVector(result,'transformed');return result;
}
export function transformPoint(local:readonly number[],placement:Placement):Vec3 {
 finiteVector(local,'local point');const p=validatePlacement(placement),r=multiply(rotationMatrix(p.rotationDegXYZ),local.map((n,i)=>n*p.scaleXYZ[i]));
 const result:Vec3=[r[0]+p.translateMM[0],r[1]+p.translateMM[1],r[2]+p.translateMM[2]];finiteVector(result,'world point');return result;
}
export function transformNormal(local:readonly number[],placement:Placement):Vec3 {
 finiteVector(local,'local normal');const p=validatePlacement(placement),r=multiply(rotationMatrix(p.rotationDegXYZ),local.map((n,i)=>n/p.scaleXYZ[i])),length=Math.hypot(...r);
 if(!Number.isFinite(length)||length===0)throw Error('Nonzero finite transformed normal required');return r.map(n=>n/length) as Vec3;
}
export function inverseTransformPoint(world:readonly number[],placement:Placement):Vec3 {
 finiteVector(world,'world point');const p=validatePlacement(placement),m=rotationMatrix(p.rotationDegXYZ),v=world.map((n,i)=>n-p.translateMM[i]);
 const rotated=multiply([m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]],v),result=rotated.map((n,i)=>n/p.scaleXYZ[i]) as Vec3;
 finiteVector(result,'inverse point');return result;
}
function checkAxis(axis:Axis){if(axis!==0&&axis!==1&&axis!==2)throw Error('X, Y or Z axis required');}
/** Direction of a local scale handle after authored rotation; no scale factor in its unit axis. */
export function localAxis(axis:Axis,placement:Placement):Vec3 {
 checkAxis(axis);const p=validatePlacement(placement),m=rotationMatrix(p.rotationDegXYZ);return [m[axis],m[3+axis],m[6+axis]];
}
/** Instantaneous native-world axis for the corresponding authored Euler angle. */
export function rotationAxis(axis:Axis,placement:Placement):Vec3 {
 checkAxis(axis);const p=validatePlacement(placement),angles:Vec3=[0,axis===0?p.rotationDegXYZ[1]:0,axis===2?0:p.rotationDegXYZ[2]],m=rotationMatrix(angles);
 return [m[axis],m[3+axis],m[6+axis]];
}
export function wrapDegrees(angle:number):number {
 if(!Number.isFinite(angle))throw Error('Finite angle required');
 if(Math.abs(angle)<=360)return angle;
 return ((angle+180)%360+360)%360-180;
}
