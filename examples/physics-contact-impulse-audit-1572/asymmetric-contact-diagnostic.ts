import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
/** #1572: read-only public-contact diagnostics for original asymmetric 3-box stacks.
 * Producer contact fields, not independent collision or force certification.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {BodyState,Contact} from '../../packages/barocss-physics/src/types.js';
type V=readonly [number,number,number];
const dt=1/120,steps=1200;
const floor=staticPart('floor',{kind:'box',halfExtentsM:[2,.1,2]},{positionM:[0,-.1,0]},{restitution:0,friction:{static:1,dynamic:.7}});
function cube(i:number,mode:'OFFSET'|'YAW'){
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return dynamicPart(`b${i}`,{kind:'box',halfExtentsM:[.25,.25,.25]},{positionM:[(i%2)*.05,.25+.5*i,0],velocityMps:[0,0,0],orientationXYZW:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)]},1,{restitution:0,friction:{static:1,dynamic:.7}});
}
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const plus=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function velocity(b:BodyState,p:V):V {return plus(b.velocityMps,cross(b.angularVelocityRadps,sub(p,b.positionM)));}
function sample(c:Contact,bodies:Map<string,BodyState>){
 const a=bodies.get(c.bodyAId)!,b=bodies.get(c.bodyBId)!;
 const relative=sub(velocity(b,c.pointM),velocity(a,c.pointM));
 const normal=dot(relative,c.normalAtoB);
 const tangent=sub(relative,[c.normalAtoB[0]*normal,c.normalAtoB[1]*normal,c.normalAtoB[2]*normal]);
 const tangentNs=Math.hypot(...c.tangentImpulseOnBNs);
 return {pair:`${c.bodyAId}/${c.bodyBId}`,slipSpeedMps:Math.hypot(...tangent),
  tangentImpulseNs:tangentNs,normalImpulseNs:c.normalImpulseNs,
  ratio:c.normalImpulseNs>0?tangentNs/c.normalImpulseNs:null,
  penetrationM:c.penetrationM};
}
for(const mode of ['OFFSET','YAW'] as const){
 const world=createPhysicsWorld(makeModel({gravityMps2:[0,-9.81,0],parts:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]}),{profile:'rigid-persistent-box-v1',fixedStepSeconds:dt,broadPhase:'direct'});
 let accepted=0, firstFailure:string|null=null;
 const checkpoints:unknown[]=[];
 try{
  for(let step=1;step<=steps;step++){
   try{
    const state=world.step();accepted=step;
    if(step===1||step%120===0){
     const bodies=new Map(state.bodies.map(b=>[b.id,b]));
     checkpoints.push({step,contacts:state.contacts.map(c=>sample(c,bodies)),
       bodyXZ:state.bodies.filter(b=>b.kind==='dynamic').map(b=>({id:b.id,x:b.positionM[0],z:b.positionM[2]}))});
    }
   }catch(e){firstFailure=e instanceof Error?e.message:String(e);break;}
  }
  console.log(JSON.stringify({mode,accepted,firstFailure,checkpoints,
    observation:'public producer snapshots only',eightBoxQualified:false,physicalGo:false}));
  if(firstFailure)process.exitCode=1;
 }finally{world.dispose();}
}
