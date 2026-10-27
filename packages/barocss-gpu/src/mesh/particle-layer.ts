import {GPUError} from '../core/gpu-error.js';

/** Host-tagged display data. Positions are scene units, not CAD mm or Physics metres. */
export interface ParticleLayerV0 {
 version:0;
 contextId:string;
 sceneRevision:string;
 stepIndex:number;
 coordinateSystem:'right-handed-y-up-scene-units';
 positions:number[];
}
export interface PreparedParticleLayer {layer:ParticleLayerV0;positions:Float32Array}
function check(value:unknown,message:string):asserts value {
 if(!value)throw new GPUError('Particle layer: '+message);
}
/** Copy own data before allocation. A new context is permitted only by full scene replacement. */
export function prepareParticleLayer(input:unknown,previous:ParticleLayerV0|null,newGeneration=false):PreparedParticleLayer|null {
 if(input===null)return null;
 check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'plain own DTO required');
 const fields=['version','contextId','sceneRevision','stepIndex','coordinateSystem','positions'],keys=Reflect.ownKeys(input),d=Object.getOwnPropertyDescriptors(input);
 check(keys.length===fields.length&&keys.every(k=>typeof k==='string'&&fields.includes(k)&&'value'in d[k]&&d[k].enumerable),'exact own fields required');
 const version=d.version.value,contextId=d.contextId.value,sceneRevision=d.sceneRevision.value,stepIndex=d.stepIndex.value,coordinateSystem=d.coordinateSystem.value,raw=d.positions.value;
 check(version===0&&coordinateSystem==='right-handed-y-up-scene-units','unsupported version or coordinate system');
 for(const value of[contextId,sceneRevision])check(typeof value==='string'&&/^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/.test(value),'ASCII context/revision1..128 required');
 check(typeof stepIndex==='number'&&Number.isInteger(stepIndex)&&stepIndex>=0&&stepIndex<=2147483647,'stepIndex0..2147483647 required');
 check(Array.isArray(raw)&&Object.getPrototypeOf(raw)===Array.prototype,'plain dense positions array required');
 const descriptors=Object.getOwnPropertyDescriptors(raw as object),length=descriptors.length.value;
 check(Number.isInteger(length)&&length>=3&&length<=768&&length%3===0&&Reflect.ownKeys(raw).length===length+1,'1..256 dense XYZ points required');
 const positions:number[]=[];
 for(let i=0;i<length;i++){
  const point=descriptors[String(i)];
  check(point&&'value'in point&&point.enumerable&&typeof point.value==='number'&&Number.isFinite(point.value)&&Math.abs(point.value)<=1000,'own finite XYZ±1000 scene units required');
  positions.push(point.value);
 }
 const layer:ParticleLayerV0={version:0,contextId,sceneRevision,stepIndex,coordinateSystem,positions};
 if(previous){
  const changedContext=contextId!==previous.contextId;
  check(!changedContext||newGeneration,'clear layer or replace scene before new context');
  if(!changedContext){
   check(sceneRevision===previous.sceneRevision,'scene revision changed within current context');
   check(stepIndex>=previous.stepIndex,'regressing step requires explicit reset/new generation');
   if(stepIndex===previous.stepIndex)check(positions.length===previous.positions.length&&positions.every((n,i)=>Object.is(n,previous.positions[i])),'equal step must retain original positions');
  }
 }
 const lowered=Float32Array.from(positions);
 check(lowered.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000),'Float32 target positions exceed bounds');
 return{layer,positions:lowered};
}
