// Inert original authored fixture lowering. No runtime body is relabeled as input.
import {fixture} from '../physics-rigid-contact-reference/fixtures.mjs';
export const PROFILE='rigid-stationary-cube-stack-v1';
export const options={profile:PROFILE,fixedStepSeconds:1/120,broadPhase:'direct'};
export function model(scene='ALIGNED'){
 const original=fixture(scene);
 return {format:'barocss-physics-model',version:1,revision:'stationary-'+scene+'-v1',frame:{id:'world',basis:'right-handed-xyz',rotation:'local-to-world-xyzw'},units:{length:'m',mass:'kg',time:'s',angle:'rad'},gravityMps2:[...original.gravityMps2],
  bodies:original.bodies.map(body=>({id:body.id,kind:body.kind,...(body.kind==='dynamic'?{massKg:body.massKg,inertia:{kind:'primitive-com',about:'com',frame:'body-local'}}:{}),initial:{positionM:[...body.positionM],orientationXYZW:[...(body.orientation??[0,0,0,1])],...(body.kind==='dynamic'?{velocityMps:[...body.velocityMps],angularVelocityRadps:[0,0,0]}:{})}})),
  colliders:original.bodies.map(body=>({id:'col-'+body.id,bodyId:body.id,geometry:structuredClone(body.shape),local:{positionM:[0,0,0],orientationXYZW:[0,0,0,1]},material:{restitution:body.restitution,friction:{...body.friction}},sensor:false,ccd:false,filter:{categoryBits:1,maskBits:65535}})),joints:[],cloths:[],fluids:[],sourceBindings:[]};
}
export function bodyWords(state){const out=Buffer.alloc(state.bodies.length*104);let at=0;for(const body of state.bodies)for(const [key,n]of [['positionM',3],['velocityMps',3],['orientationXYZW',4],['angularVelocityRadps',3]])for(let i=0;i<n;i++){out.writeDoubleLE(body[key][i],at);at+=8;}return out;}
export function rename(input){const copy=structuredClone(input),names=new Map(copy.bodies.map((body,i)=>[body.id,'opaque'+(20-i)]));for(const body of copy.bodies)body.id=names.get(body.id);for(const [i,c]of copy.colliders.entries()){c.id='shape'+(40-i);c.bodyId=names.get(c.bodyId);}return copy;}
