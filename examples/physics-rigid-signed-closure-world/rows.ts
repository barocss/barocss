import { PhysicsError, type Body, type Vec3 } from '../../packages/barocss-physics/src/types.js';
import { detect, validateResult } from '../../packages/barocss-physics/src/collision.js';
import { ID } from '../../packages/barocss-physics/src/limits.js';
import { inspectSignedBoxSAT, FEATURE_INPUT_MESSAGE, AXIS_MESSAGE, type SignedSATSelection } from '../physics-rigid-signed-separation-reference/signed-sat.js';
import { SignedPositionReferenceError, MESSAGES } from '../physics-rigid-signed-separation-reference/signed-input.mjs';
import type { CompactSelection, InitialProblem, PairObservation, PositionPair, RowSource, SignedProblem } from './closure-types.js';

export const LIVE_ERRORS = {
  INPUT:'private live signed closure input is invalid', PROFILE:'private live signed closure profile is unsupported',
  ROW_CAP:'private live signed closure exceeds eight rows', GEOMETRY:'private live signed closure requires fresh matching box geometry',
  INFEASIBLE:'private live signed closure constraints are infeasible', RESULT:'private live signed closure result is invalid',
  PROTECTED:'private live signed closure left a protected pair unresolved',
  CONTRADICTION:'private live signed closure added pair is not separated at PRE', CHOICES:'private live signed closure exceeds nine choices',
} as const;
export function refuse(key:keyof typeof LIVE_ERRORS):never { throw new PhysicsError('NUMERIC_LIMIT',LIVE_ERRORS[key]); }
/** Only a recognized class, code AND exact parent message may be mapped. */
export function mapLiveError(error:unknown):unknown {
  try {
  if(error instanceof SignedPositionReferenceError) {
    if(error.code==='PROFILE_LIMIT' && error.message===MESSAGES.limit) return new PhysicsError('NUMERIC_LIMIT',LIVE_ERRORS.PROFILE);
    if(error.code==='INVALID_INPUT' && [MESSAGES.input,MESSAGES.empty,MESSAGES.ids,MESSAGES.mass,MESSAGES.endpoints,MESSAGES.normal,MESSAGES.bound].includes(error.message)) return new PhysicsError('NUMERIC_LIMIT',LIVE_ERRORS.INPUT);
    if(error.code==='NUMERIC_LIMIT' && error.message===MESSAGES.result) return new PhysicsError('NUMERIC_LIMIT',LIVE_ERRORS.RESULT);
  }
  if(error instanceof PhysicsError && ((error.code==='INVALID_CONFIG' && error.message===FEATURE_INPUT_MESSAGE) || (error.code==='NUMERIC_LIMIT' && error.message===AXIS_MESSAGE))) return new PhysicsError('NUMERIC_LIMIT',LIVE_ERRORS.GEOMETRY);
  } catch { /* Reflection must not replace an unknown original thrown value. */ }
  return error;
}
export function ordinaryDense(value:unknown,size?:number):value is unknown[] {
  return Array.isArray(value) && Object.getPrototypeOf(value)===Array.prototype && (size===undefined || value.length===size)
    && Reflect.ownKeys(value).length===value.length+1 && Array.from({length:value.length},(_,i)=>i).every(i=>{
      const d=Object.getOwnPropertyDescriptor(value,i); return d!==undefined && 'value' in d;
    });
}
function finiteVector(value:unknown,size:number,bound=Infinity):value is number[] {
  return ordinaryDense(value,size) && value.every(v=>typeof v==='number' && Number.isFinite(v) && Math.abs(v)<=bound);
}
function record(value:unknown):value is Record<string,unknown> { return value!==null && typeof value==='object'; }
function plainKeys(value:unknown,keys:readonly string[]):value is Record<string,unknown> {
  return record(value) && (Object.getPrototypeOf(value)===Object.prototype || Object.getPrototypeOf(value)===null)
    && Reflect.ownKeys(value).length===keys.length && keys.every(k=>Object.hasOwn(value,k));
}
export function checkedLiveInputs(bodies:readonly Body[],pairs:readonly PositionPair[]):void {
  if(!ordinaryDense(bodies) || !ordinaryDense(pairs) || bodies.length===0) refuse('INPUT');
  if(bodies.length>9) refuse('PROFILE');
  const ids=new Set<string>();
  for(const body of bodies) {
    if(!record(body) || typeof body.id!=='string' || !ID.test(body.id) || ids.has(body.id)
      || !finiteVector(body.positionM,3) || !finiteVector(body.velocityMps,3) || !finiteVector(body.orientation,4)
      || !finiteVector(body.angularVelocityRadps,3) || typeof body.inverseMass!=='number' || !Number.isFinite(body.inverseMass)) refuse('INPUT');
    ids.add(body.id);
    if((body.kind!=='dynamic' && body.kind!=='static') || body.shape?.kind!=='box' || body.sensor || body.ccd || body.collisionFilter
      || !finiteVector(body.shape.halfExtentsM,3,1000) || body.shape.halfExtentsM.some(v=>v<.0001)
      || body.restitution!==0 || !finiteVector(body.inverseInertiaLocal,3) || body.inverseInertiaLocal.some(v=>v<0)
      || (body.kind==='static' ? body.inverseMass!==0 : body.inverseMass<1e-6 || body.inverseMass>1e6)) refuse('PROFILE');
  }
  validateResult(bodies as Body[],[]);
  const expected:PositionPair[]=[];
  for(let a=0;a<bodies.length;a++) for(let b=a+1;b<bodies.length;b++) if(bodies[a].inverseMass!==0 || bodies[b].inverseMass!==0) expected.push(bodies[a].id<bodies[b].id?[a,b]:[b,a]);
  expected.sort((l,r)=>bodies[l[0]].id<bodies[r[0]].id?-1:bodies[l[0]].id>bodies[r[0]].id?1:bodies[l[1]].id<bodies[r[1]].id?-1:1);
  if(pairs.length!==expected.length || pairs.some((p,i)=>!ordinaryDense(p,2) || p[0]!==expected[i][0] || p[1]!==expected[i][1])) refuse('INPUT');
}
export function pairKey(bodies:readonly Body[],a:number,b:number):string { return `${bodies[a].id}\u0000${bodies[b].id}`; }
export function compactSelection(full:SignedSATSelection):CompactSelection {
  // The unchanged parent query computes and validates the full result first.
  return {normal:[...full.normal] as Vec3,boundM:full.boundM,candidateIndex:full.candidateIndex,pointM:[...full.pointM] as Vec3,
    rawAxisLength:full.rawAxisLength,label:full.label,feature:{...full.feature}};
}
export function freshSelection(a:Body,b:Body):CompactSelection { return compactSelection(inspectSignedBoxSAT(a,b)); }
/** Captures every original PRE detect. No cap or truncation is done here. */
export function buildLiveInitialProblem(bodies:readonly Body[],pairs:readonly PositionPair[],capture?:InitialProblem):InitialProblem {
  checkedLiveInputs(bodies,pairs);
  const result=capture??{problem:{bodies:bodies.map(b=>({id:b.id,inverseMass:b.inverseMass})),rows:[]},rowSources:[],initialDetections:[],tests:0,signedPreQueries:0};
  for(const [aIndex,bIndex] of pairs) {
    result.tests++;
    const a=bodies[aIndex],b=bodies[bIndex],hit=detect(a,b),key=pairKey(bodies,aIndex,bIndex);
    result.initialDetections.push({pairKey:key,aIndex,bIndex,hit:hit?structuredClone(hit):null});
    if(hit===null) continue;
    const selection=freshSelection(a,b); result.signedPreQueries++;
    if(!hit.normal.every((v,d)=>v===selection.normal[d]) || Math.max(0,selection.boundM)!==hit.penetration) refuse('GEOMETRY');
    result.problem.rows.push({aId:a.id,bId:b.id,normal:[...hit.normal] as Vec3,boundM:hit.penetration});
    result.rowSources.push({pairKey:key,aIndex,bIndex,kind:'initial',selection});
  }
  return result;
}
export function inspectHypothesis(bodies:readonly Body[],pairs:readonly PositionPair[],capture:PairObservation[]=[]):PairObservation[] {
  for(const [aIndex,bIndex] of pairs) capture.push({pairKey:pairKey(bodies,aIndex,bIndex),aIndex,bIndex,selection:freshSelection(bodies[aIndex],bodies[bIndex])});
  return capture;
}
function checkedObservation(value:unknown):value is PairObservation {
  if(!record(value) || typeof value.pairKey!=='string' || value.pairKey.split('\u0000').length!==2 || !Number.isInteger(value.aIndex) || !Number.isInteger(value.bIndex)
    || (value.aIndex as number)<0 || (value.aIndex as number)>8 || (value.bIndex as number)<0 || (value.bIndex as number)>8 || value.aIndex===value.bIndex
    || !plainKeys(value.selection,['normal','boundM','candidateIndex','pointM','rawAxisLength','label','feature'])) return false;
  const ids=value.pairKey.split('\u0000');
  if(!ids.every(id=>ID.test(id)) || !(ids[0]<ids[1])) return false;
  const s=value.selection;
  if(!record(s.feature)) return false;
  const f=s.feature,axis=(v:unknown)=>typeof v==='number' && Number.isInteger(v) && v>=0 && v<3;
  let index:number,label:string;
  if(f.kind==='face-a' && plainKeys(f,['kind','axisA']) && axis(f.axisA)) {index=f.axisA as number;label=`A.face.${index}`;}
  else if(f.kind==='face-b' && plainKeys(f,['kind','axisB']) && axis(f.axisB)) {index=3+(f.axisB as number);label=`B.face.${f.axisB}`;}
  else if(f.kind==='edge-cross' && plainKeys(f,['kind','axisA','axisB']) && axis(f.axisA) && axis(f.axisB)) {index=6+3*(f.axisA as number)+(f.axisB as number);label=`A.edge.${f.axisA}xB.edge.${f.axisB}`;}
  else return false;
  return finiteVector(s.normal,3) && Math.abs(Math.hypot(...s.normal)-1)<=1e-12 && finiteVector(s.pointM,3)
    && typeof s.boundM==='number' && Number.isFinite(s.boundM) && s.candidateIndex===index
    && typeof s.rawAxisLength==='number' && Number.isFinite(s.rawAxisLength) && s.rawAxisLength>=1e-12 && s.label===label;
}
/** Policy only: inspect all protected failures before choosing an unprotected pair. */
export function chooseAddedPair(rows:readonly RowSource[],hypObservations:readonly PairObservation[]):PairObservation|null {
  if(!ordinaryDense(rows) || !ordinaryDense(hypObservations) || rows.length>8) refuse('INPUT');
  const protectedKeys=new Set<string>(),observed=new Map<string,PairObservation>();
  for(const r of rows) {
    if(!plainKeys(r,['pairKey','aIndex','bIndex','selection','kind']) || !checkedObservation(r) || (r.kind!=='initial' && r.kind!=='added') || protectedKeys.has(r.pairKey)) refuse('INPUT');
    protectedKeys.add(r.pairKey);
  }
  let previous:string|null=null;
  const indexIds=new Map<number,string>(),idIndices=new Map<string,number>();
  for(const h of hypObservations) {
    if(!plainKeys(h,['pairKey','aIndex','bIndex','selection']) || !checkedObservation(h) || (previous!==null && h.pairKey<=previous)) refuse('INPUT');
    const ids=h.pairKey.split('\u0000');
    for(const [index,id] of [[h.aIndex,ids[0]],[h.bIndex,ids[1]]] as Array<[number,string]>) {
      if((indexIds.has(index) && indexIds.get(index)!==id) || (idIndices.has(id) && idIndices.get(id)!==index)) refuse('INPUT');
      indexIds.set(index,id);idIndices.set(id,index);
    }
    observed.set(h.pairKey,h); previous=h.pairKey;
  }
  if(rows.some(r=>!observed.has(r.pairKey) || observed.get(r.pairKey)!.aIndex!==r.aIndex || observed.get(r.pairKey)!.bIndex!==r.bIndex)) refuse('INPUT');
  if(hypObservations.some(h=>protectedKeys.has(h.pairKey) && h.selection.boundM>1e-12)) refuse('PROTECTED');
  const next=hypObservations.find(h=>!protectedKeys.has(h.pairKey) && h.selection.boundM>1e-12);
  if(next && rows.length===8) refuse('ROW_CAP');
  return next?structuredClone(next):null;
}
export function appendLiveRow(problem:SignedProblem,sources:RowSource[],pre:readonly Body[],observation:PairObservation,initial:InitialProblem):void {
  const {aIndex,bIndex,pairKey:key}=observation;
  const original=initial.initialDetections.find(d=>d.pairKey===key);
  if(!original || original.hit!==null || sources.some(r=>r.pairKey===key)) refuse('CONTRADICTION');
  const selection=freshSelection(pre[aIndex],pre[bIndex]); initial.signedPreQueries++;
  if(!(selection.boundM<0)) refuse('CONTRADICTION');
  problem.rows.push({aId:pre[aIndex].id,bId:pre[bIndex].id,normal:[...selection.normal] as Vec3,boundM:selection.boundM});
  sources.push({pairKey:key,aIndex,bIndex,kind:'added',selection});
}
