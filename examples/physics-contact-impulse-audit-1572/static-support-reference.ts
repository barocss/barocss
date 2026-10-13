/**
 * #1572 — independent quasi-static support polygon reference for the exact
 * #1185 FIRST THREE cubes of ALIGNED / OFFSET / YAW.
 *
 * Does NOT import collision.ts, contact-manifold.ts, or Physics math for the
 * static reference. A separately executed public PhysicsWorld supplies the
 * dynamic observations for comparison. No solver or admission changes.
 *
 * Bounds: SI; horizontal x-z footprints of horizontal box faces only;
 * gravity vertical; 1 kg each, no external horizontal loads. A positive
 * support certificate establishes feasibility of a static vertical-normal
 * force distribution, NOT a stable trajectory or engineering certification.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';

type Vec2=[number,number];
type Mode='ALIGNED'|'OFFSET'|'YAW';
type PlanarBox={id:string,x:number,z:number,halfX:number,halfZ:number,yaw:number,massKg:number};
const DT=1/120,GRAVITY=9.81,STEPS=1200,EPS=1e-12;
const sum=(a:Vec2,b:Vec2):Vec2=>[a[0]+b[0],a[1]+b[1]];
const sub=(a:Vec2,b:Vec2):Vec2=>[a[0]-b[0],a[1]-b[1]];
const mul=(a:Vec2,v:number):Vec2=>[a[0]*v,a[1]*v];
const cross=(a:Vec2,b:Vec2):number=>a[0]*b[1]-a[1]*b[0];
const distance=(a:Vec2,b:Vec2)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

function footprint(box:PlanarBox):Vec2[]{
 const c=Math.cos(box.yaw),s=Math.sin(box.yaw);
 return ([[-1,-1],[1,-1],[1,1],[-1,1]] as Vec2[]).map(([u,v])=>{
  const lx=u*box.halfX,lz=v*box.halfZ;
  return [box.x+c*lx+s*lz,box.z-s*lx+c*lz];
 });
}
function polygonArea(poly:Vec2[]):number{
 let twice=0;
 for(let i=0;i<poly.length;i++)twice+=cross(poly[i],poly[(i+1)%poly.length]);
 return .5*twice;
}
function normalized(poly:Vec2[]):Vec2[]{
 const filtered=poly.filter((p,i)=>i===0||distance(p,poly[i-1])>EPS);
 if(filtered.length>1&&distance(filtered[0],filtered[filtered.length-1])<=EPS)filtered.pop();
 return filtered;
}
/** Independent convex polygon intersection, two-dimensional Sutherland–Hodgman. */
function overlap(subject:Vec2[],clipper:Vec2[]):Vec2[]{
 let poly=subject.slice();
 for(let i=0;i<clipper.length;i++){
  if(!poly.length)break;
  const a=clipper[i],b=clipper[(i+1)%clipper.length],edge=sub(b,a);
  const next:Vec2[]=[];
  for(let j=0;j<poly.length;j++){
   const p=poly[j],q=poly[(j+1)%poly.length];
   const sp=cross(edge,sub(p,a)),sq=cross(edge,sub(q,a));
   const inP=sp>=-EPS,inQ=sq>=-EPS;
   if(inP)next.push(p);
   if(inP!==inQ){
    const denom=sp-sq;
    if(Math.abs(denom)<1e-16)throw Error('SUPPORT_CLIP_UNSTABLE');
    const t=sp/denom;
    next.push(sum(p,mul(sub(q,p),t)));
   }
  }
  poly=normalized(next);
 }
 return poly;
}
function edgeMargin(p:Vec2,poly:Vec2[]):number{
 if(poly.length<3)return -Infinity;
 let margin=Infinity;
 for(let i=0;i<poly.length;i++){
  const a=poly[i],edge=sub(poly[(i+1)%poly.length],a);
  const length=Math.hypot(...edge);
  if(length<=EPS)throw Error('SUPPORT_ZERO_EDGE');
  margin=Math.min(margin,cross(edge,sub(p,a))/length);
 }
 return margin;
}
function triangleCertificate(poly:Vec2[],p:Vec2):number[]|null{
 for(let k=1;k<poly.length-1;k++){
  const a=poly[0],b=poly[k],c=poly[k+1],den=cross(sub(b,a),sub(c,a));
  if(!(den>EPS))continue;
  const wb=cross(sub(p,a),sub(c,a))/den;
  const wc=cross(sub(b,a),sub(p,a))/den;
  const wa=1-wb-wc;
  if(Math.min(wa,wb,wc)<-1e-10)continue;
  const values=poly.map(()=>0);
  values[0]=wa;values[k]=wb;values[k+1]=wc;
  return values;
 }
 return null;
}
function checkPolygonControl():void{
 const a:PlanarBox={id:'A',x:0,z:0,halfX:.25,halfZ:.25,yaw:0,massKg:1};
 const b={...a,id:'B',x:.05};
 const identical=overlap(footprint(a),footprint(a));
 const offset=overlap(footprint(a),footprint(b));
 if(Math.abs(polygonArea(identical)-.25)>1e-12 ||
    Math.abs(polygonArea(offset)-.225)>1e-12 ||
    Math.abs(edgeMargin([0,0],identical)-.25)>1e-12)
  throw Error('SUPPORT_INDEPENDENT_REFERENCE_CONTROL_FAILED');
}
function boxes(mode:Mode):PlanarBox[]{
 return Array.from({length:3},(_,i)=>({
  id:'b'+i,x:mode==='ALIGNED'?0:(i%2)*.05,z:0,halfX:.25,halfZ:.25,
  yaw:mode==='YAW'?(i%2===0?.05:-.05):0,massKg:1
 }));
}
const floor:PlanarBox={id:'floor',x:0,z:0,halfX:2,halfZ:2,yaw:0,massKg:0};
function witness(mode:Mode){
 const bodies=boxes(mode),stack=[floor,...bodies];
 const interfaces=[];
 for(let lower=0;lower<3;lower++){
  const low=stack[lower],high=stack[lower+1];
  const above=stack.slice(lower+1);
  const mass=above.reduce((n,b)=>n+b.massKg,0);
  const centre:Vec2=[above.reduce((n,b)=>n+b.massKg*b.x,0)/mass,
    above.reduce((n,b)=>n+b.massKg*b.z,0)/mass];
  const intersection=overlap(footprint(low),footprint(high));
  const area=polygonArea(intersection);
  const signedMargin=edgeMargin(centre,intersection);
  const weights=triangleCertificate(intersection,centre);
  const force=mass*GRAVITY;
  const vertexForces=weights?.map(w=>w*force)??[];
  const total=vertexForces.reduce((n,f)=>n+f,0);
  const resultant:Vec2= total? [
    vertexForces.reduce((n,f,i)=>n+f*intersection[i][0],0)/total,
    vertexForces.reduce((n,f,i)=>n+f*intersection[i][1],0)/total
  ]:[NaN,NaN];
  const normalResidualN=weights?Math.abs(total-force):null;
  const momentResidualNm=weights?force*distance(centre,resultant):null;
  const feasible=area>EPS&&signedMargin>=-EPS&&weights!==null
    &&normalResidualN!==null&&normalResidualN<1e-10
    &&momentResidualNm!==null&&momentResidualNm<1e-10;
  interfaces.push({interface:low.id+'/'+high.id,aboveMassKg:mass,
    normalSupportLoadN:force,centreOfMassXZ:centre,overlapAreaM2:area,
    minSignedSupportMarginM:signedMargin,feasible,
    normalForceResidualN:normalResidualN,momentResidualNm,
    polygonVerticesXZ:intersection,vertexNormalForcesN:vertexForces});
 }
 return interfaces;
}
function worldBody(b:PlanarBox):PhysicsBodyConfig{
 return {id:b.id,kind:'dynamic',shape:{kind:'box',halfExtentsM:[b.halfX,.25,b.halfZ]},
  positionM:[b.x,.25+parseInt(b.id.slice(1))*.5,b.z],massKg:b.massKg,
  velocityMps:[0,0,0],orientation:[0,Math.sin(b.yaw/2),0,Math.cos(b.yaw/2)],
  restitution:0,friction:{static:1,dynamic:.7}};
}
function actualWorld(mode:Mode){
 const cfg:PhysicsWorldConfig={fixedStepSeconds:DT,gravityMps2:[0,-GRAVITY,0],
  contactMode:'persistent-box-v1',bodies:[
   {id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},
     positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}},
   ...boxes(mode).map(worldBody)]};
 const world=createPhysicsWorld(cfg);
 let accepted=0,firstFailure:string|null=null,maxHorizontalFromInitialM=0,maxLinearSpeedMps=0,
  maxAngularSpeedRadps=0,maxReportedPenetrationM=0;
 try{
  for(let step=1;step<=STEPS;step++){
   try{
    const state=world.step(DT);
    if(state.stepIndex!==step)throw Error('SUPPORT_WORLD_CURSOR');
    for(const contact of state.contacts){
     if(!Number.isFinite(contact.penetrationM))throw Error('SUPPORT_WORLD_CONTACT_NONFINITE');
     maxReportedPenetrationM=Math.max(maxReportedPenetrationM,contact.penetrationM);
    }
    if(step>960)for(const body of state.bodies.filter(b=>b.kind==='dynamic')){
     const original=boxes(mode).find(b=>b.id===body.id)!;
     maxHorizontalFromInitialM=Math.max(maxHorizontalFromInitialM,
      Math.hypot(body.positionM[0]-original.x,body.positionM[2]-original.z));
     maxLinearSpeedMps=Math.max(maxLinearSpeedMps,Math.hypot(...body.velocityMps));
     maxAngularSpeedRadps=Math.max(maxAngularSpeedRadps,Math.hypot(...body.angularVelocityRadps));
    }
    accepted++;
   }catch(e){firstFailure=e instanceof Error?e.message:String(e);break;}
  }
 }finally{world.dispose();}
 return {accepted,firstFailure,maxHorizontalFromInitialM,maxLinearSpeedMps,
  maxAngularSpeedRadps,maxReportedPenetrationM,
  boundedHorizontalAndSpeedGates:accepted===STEPS&&maxHorizontalFromInitialM<=.01&&
    maxLinearSpeedMps<=.02&&maxAngularSpeedRadps<=.02,
  producerContactOnly:true};
}
checkPolygonControl();
let executionFailure=false;
for(const mode of ['ALIGNED','OFFSET','YAW'] as const){
 const certificates=witness(mode);
 if(certificates.some(c=>!c.feasible))throw Error('SUPPORT_FEASIBILITY_REFERENCE_UNEXPECTED:'+mode);
 const observed=actualWorld(mode);
 console.log(JSON.stringify({mode,reference:'independent horizontal convex support polygons',
  geometricStaticNormalSupportFeasible:certificates.every(c=>c.feasible),
  interfaces:certificates,publicWorld:observed,physicalEightBoxGO:false,
  limitation:'static vertical-normal feasibility at frozen initial geometry is not sufficient for dynamical stability or friction/torque correctness'}));
 if(observed.firstFailure)executionFailure=true;
}
if(executionFailure)process.exitCode=1;
