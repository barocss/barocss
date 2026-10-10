import type { Body,Vec3 } from '../../packages/barocss-physics/src/types.js';
import { error } from '../../packages/barocss-physics/src/validation.js';
import { MAX_STEP_DISPLACEMENT_M,ID } from '../../packages/barocss-physics/src/limits.js';
import { selectBoxSATFeature,FEATURE_INPUT_MESSAGE } from './sat-feature.js';
import { faceContact } from './face-contact.js';
import { edgeContact } from './edge-contact.js';
import { WITNESS_MESSAGE,basis,extents,WITNESS_TOLERANCE_M } from './witness.js';
import { dot,sub } from '../../packages/barocss-physics/src/math.js';
function witnessInside(body:Body,w:Vec3):boolean {
  const local=basis(body).map(axis=>dot(sub(w,body.positionM),axis)),e=extents(body);
  return local.every((v,i)=>Number.isFinite(v)&&Math.abs(v)<=e[i]+WITNESS_TOLERANCE_M);
}
function denseVector(v:unknown,size:number,min:number,max:number):boolean {
  return Array.isArray(v)&&v.length===size&&Array.from({length:size},(_,i)=>i).every(i=>Object.hasOwn(v,i)&&Number.isFinite(v[i])&&v[i]>=min&&v[i]<=max);
}
function admitted(b:Body):boolean {
  return b!==null&&typeof b==='object'&&typeof b.id==='string'&&ID.test(b.id)
    &&['dynamic','static','kinematic'].includes(b.kind)&&b.shape?.kind==='box'
    &&denseVector(b.shape.halfExtentsM,3,.0001,1000)
    &&denseVector(b.positionM,3,-10000,10000)
    &&denseVector(b.orientation,4,-1,1)
    &&Math.abs(Math.hypot(...b.orientation)-1)<=1e-9;
}
/** Geometry only. No world, cache, response, projection or mutable caller reference. */
export function featureContact(a:Body,b:Body) {
  if(!admitted(a)||!admitted(b)||a.id===b.id) error('INVALID_CONFIG',FEATURE_INPUT_MESSAGE);
  const selection=selectBoxSATFeature(a,b);if(!selection) return null;
  if(selection.hit.penetration>MAX_STEP_DISPLACEMENT_M) error('NUMERIC_LIMIT',WITNESS_MESSAGE);
  const geometry=selection.feature.kind==='edge-cross'?edgeContact(a,b,selection):faceContact(a,b,selection);
  if(!geometry.points.length||geometry.points.some(p=>!witnessInside(a,p.witnessAM)||!witnessInside(b,p.witnessBM))) error('NUMERIC_LIMIT',WITNESS_MESSAGE);
  return geometry;
}
