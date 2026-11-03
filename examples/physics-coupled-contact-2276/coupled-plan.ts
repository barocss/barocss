/** Private cold one-point, one-host-step plan. Never reads a reference or observer. */
import {coupledStaticTarget,type StaticInput,type StaticResult} from '../../C/candidate.js';
import type {Body,Vec3} from './internal-types.js';
import type {PhaseHit,PhasePoint} from './phase-hit.js';
import {dot,rotate} from './math.js';
import {phaseCoupledPlan} from './private-phase.js';
export type CoupledCode='COUPLED_DYNAMIC_REQUIRED'|'COUPLED_PROFILE_UNSUPPORTED'|'COUPLED_UNRESOLVED';
export class CoupledContactError extends Error {
  constructor(readonly code:CoupledCode,message:string,readonly details:unknown=null){super(message);this.name='CoupledContactError';}
}
export interface CoupledPlan {
  readonly key:string;readonly hostStep:number;readonly binding:string;readonly input:StaticInput;
  readonly target:Extract<StaticResult,{status:'STATIC_TARGET'}>;applied:boolean;slots:number;
}
function refuse(reason:string):never {throw new CoupledContactError('COUPLED_PROFILE_UNSUPPORTED',reason);}
function canonical(value:unknown):string {
  if(typeof value==='number'){if(!Number.isFinite(value))refuse('NONFINITE_BINDING_WORD');const data=new DataView(new ArrayBuffer(8));data.setFloat64(0,value,false);return '{"$f64be":"'+data.getBigUint64(0,false).toString(16).padStart(16,'0')+'"}';}
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(record(value))return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return refuse('NONDATA_BINDING_VALUE');
}
function same(a:unknown,b:unknown):boolean{return canonical(a)===canonical(b);}
function record(x:unknown):x is Record<string,unknown>{return typeof x==='object'&&x!==null&&!Array.isArray(x);}
function direction(x:unknown):x is [string,string,string]{return Array.isArray(x)&&x.length===3&&x.every(v=>typeof v==='string');}
function geometry(a:Body,b:Body,hit:PhaseHit,point:PhasePoint):{axis:0|1|2;sign:-1|1;normal:[string,string,string]} {
  const feature:unknown=hit._phase.result.feature;
  if(!record(feature)||feature.kind!=='FACE'||feature.owner!=='b'||(feature.axis!==0&&feature.axis!==1&&feature.axis!==2))refuse('SINGLE_DYNAMIC_NATIVE_FACE_REQUIRED');
  if(a.kind!=='static'||b.kind!=='dynamic'||a.shape.kind!=='box'||b.shape.kind!=='box'||a.inverseMass!==0||b.inverseMass!==1||b.shape.halfExtentsM.some(v=>v!==.5)||b.inverseInertiaLocal.some(v=>v!==6)||a.velocityMps.some(v=>v!==0)||a.angularVelocityRadps.some(v=>v!==0))refuse('STATIC_BOX_UNIT_ISOTROPIC_DYNAMIC_CUBE_REQUIRED');
  if(a.restitution!==0||b.restitution!==0||a.frictionStatic!==1||b.frictionStatic!==1||a.frictionDynamic!==.7||b.frictionDynamic!==.7)refuse('EXACT_PASSIVE_MATERIAL_PROFILE_REQUIRED');
  if(hit.penetration!==0||hit._phase.result.points.length!==1||!same(point.pointM,point.aPointM)||!same(point.pointM,point.bPointM)||!same(point.exact.a,point.exact.b)||!same(point.exact.a,point.exact.midpoint))refuse('SINGLE_EXACT_TOUCH_POINT_WITHOUT_CORRECTION_REQUIRED');
  const n=hit._phase.result.exactNormalDirection;if(!direction(n))refuse('EXACT_NATIVE_NORMAL_REQUIRED');
  const axis:0|1|2=feature.axis;const unit:Vec3=[0,0,0];unit[axis]=1;const alignment=dot(rotate(b.orientation,unit),hit.normal);
  if(!Number.isFinite(alignment)||alignment===0)refuse('NATIVE_FACE_SIGN_UNRESOLVED');
  return {axis,sign:alignment>0?1:-1,normal:n};
}
function binding(a:Body,b:Body,hit:PhaseHit,point:PhasePoint):string {
  return canonical({a:{id:a.id,kind:a.kind,position:a.positionM,q:a.orientation,shape:a.shape,inverseMass:a.inverseMass,inverseInertia:a.inverseInertiaLocal},b:{id:b.id,kind:b.kind,position:b.positionM,q:b.orientation,shape:b.shape,inverseMass:b.inverseMass,inverseInertia:b.inverseInertiaLocal},feature:hit._phase.result.feature,normal:hit.normal,exactNormal:hit._phase.result.exactNormalDirection,point});
}
export function prepareCoupledPlan(key:string,hostStep:number,a:Body,b:Body,hit:PhaseHit,point:PhasePoint):CoupledPlan {
  const native=geometry(a,b,hit,point);if(hostStep!==1||b.angularVelocityRadps.some(v=>v!==0))refuse('FIRST_COLD_INTERVAL_ZERO_FREE_SPIN_REQUIRED');
  if(b.shape.kind!=='box')refuse('DYNAMIC_BOX_REQUIRED');
  const exactPoint=point.exact.midpoint;if(!direction(exactPoint))refuse('EXACT_NATIVE_POINT_REQUIRED');
  const input:StaticInput={nativePointExact:[...exactPoint],pointM:[...point.pointM],comM:[...b.positionM],orientationXYZW:[...b.orientation],freeVelocityMps:[...b.velocityMps],freeAngularVelocityRadps:[...b.angularVelocityRadps],massKg:1/b.inverseMass,halfExtentsM:[...b.shape.halfExtentsM],muStaticA:a.frictionStatic,muStaticB:b.frictionStatic,nativeFaceAxis:native.axis,nativeFaceSign:native.sign,nativeNormalDirection:[...native.normal]};
  const target=coupledStaticTarget(input);phaseCoupledPlan({key,hostStep,input,result:target,geometry:{feature:hit._phase.result.feature,point,normal:hit.normal,exactNormalDirection:native.normal}});
  if(target.status==='COUPLED_DYNAMIC_REQUIRED')throw new CoupledContactError('COUPLED_DYNAMIC_REQUIRED','Exact static cone is infeasible; coupled dynamic physics is not supported',target);
  if(target.status==='UNRESOLVED')throw new CoupledContactError('COUPLED_UNRESOLVED',target.reason,target);
  return {key,hostStep,binding:binding(a,b,hit,point),input,target,applied:false,slots:0};
}
export function guardCoupledIdentity(plan:CoupledPlan,key:string,hostStep:number,a:Body,b:Body,hit:PhaseHit,point:PhasePoint):void {
  geometry(a,b,hit,point);
  if(plan.key!==key||plan.hostStep!==hostStep||plan.binding!==binding(a,b,hit,point))refuse('FROZEN_POINT_NATIVE_FRAME_POSE_CHANGED');
}
export function guardCoupledPlan(plan:CoupledPlan,key:string,hostStep:number,a:Body,b:Body,hit:PhaseHit,point:PhasePoint):void {
  guardCoupledIdentity(plan,key,hostStep,a,b,hit,point);
  if(plan.slots>=64)refuse('ORIGINAL_64_SLOT_BOUND');
}
