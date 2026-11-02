// @ts-nocheck
// This module is copied into the private staged graph. It is not a public API.
import { PhysicsError } from './types.js';
import { quantizedContact } from '../../B/candidate.js';
const clone=x=>structuredClone(x);
export const phaseLimits={worlds:4,attempts:8,records:8192,applications:4352,queries:72,queryPoints:288,anchorChecks:7776,bytes:16*1024*1024-65536};
const contexts=[];let active=null,records=0,applications=0,queries=0,queryPoints=0,anchorChecks=0,traceBytes=0,attempts=0;
export const unknownMarker=new Error('PRIVATE_PHASE_AFTER_ACTUAL_CANDIDATE_IMPULSE');
function refuse(message){throw new PhysicsError('NUMERIC_LIMIT',message);}
export function bodyWords(b){return clone({id:b.id,kind:b.kind,shape:b.shape,positionM:b.positionM,orientationXYZW:b.orientation,velocityMps:b.velocityMps,angularVelocityRadps:b.angularVelocityRadps,inertiaKgM2:b.inertiaKgM2??null,inertiaDiagonalKgM2:b.inertiaDiagonalKgM2??null,inverseMass:b.inverseMass});}
function emit(kind,data){if(!active)throw Error('No private phase attempt');const record={kind,world:active.id,attempt:active.current.attempt,stepIndex:active.current.stepIndex,owner:active.current.attempt===0?'creation':'step',outerPass:active.current.pass,...clone(data)};const size=new TextEncoder().encode(JSON.stringify(record)).length;if(records+1>phaseLimits.records||traceBytes+size>phaseLimits.bytes)refuse('PRIVATE_PHASE_TRACE_RESOURCE');active.current.records.push(record);records++;traceBytes+=size;return record;}
export function phaseWorld(read){if(contexts.length>=phaseLimits.worlds)refuse('PRIVATE_PHASE_WORLD_CAP');const c={id:contexts.length+1,read,accepted:{cursor:0,stepIndex:0,cacheFrames:{}},current:null,history:[],fault:null};contexts.push(c);return c;}
export function phaseInitial(c,prepare){const previous=active;active=c;c.creation={attempt:0,stepIndex:0,pass:-1,records:[],cacheFrames:{},cacheOrigins:{},point:null,kind:null,fault:null};c.current=c.creation;try{const value=prepare();c.accepted={...c.accepted,cursor:c.creation.records.length};return value;}finally{c.current=null;active=previous;}}
export function phaseBegin(c,stepIndex,bodies){if(++attempts>phaseLimits.attempts)refuse('PRIVATE_PHASE_ATTEMPT_CAP');active=c;c.current={attempt:attempts,stepIndex,pass:-1,records:[],cacheFrames:{},cacheOrigins:{},point:null,kind:null,fault:c.fault};c.history.push(c.current);emit('attempt-start',{acceptedCursor:c.accepted.cursor,bodies:bodies.map(bodyWords)});}
export function phaseBodies(kind,bodies,extra={}){emit(kind,{bodies:bodies.map(bodyWords),...extra});}
export function phaseBody(kind,before,after,extra={}){emit(kind,{before,after:bodyWords(after),...extra});}
export function phasePass(pass){active.current.pass=pass;}
function box(b){return {id:b.id,positionM:[...b.positionM],orientationXYZW:[...b.orientation],halfExtentsM:[...b.shape.halfExtentsM]};}
export function phaseQuery(a,b,final=false){
 if(!final&&active.current.fault==='known')refuse('PRIVATE_B_FAULT_BEFORE_APPLICATION');
 if(queries+1>phaseLimits.queries)refuse('PRIVATE_B_QUERY_CAP');const pair={id:`w${active.id}-a${active.current.attempt}-q${queries+1}`,a:box(a),b:box(b)};
 const result=quantizedContact(pair);queries++;queryPoints+=result.points?.length??0;anchorChecks+=result.counts?.anchorChecks??0;if(queryPoints>phaseLimits.queryPoints||anchorChecks>phaseLimits.anchorChecks)refuse('PRIVATE_B_POINT_ANCHOR_CAP');
 const projectedDepthM=result.status==='HIT'?Math.max(0,...result.points.map(p=>-p.bPointM.reduce((s,v,i)=>s+(v-p.aPointM[i])*result.normal[i],0))):null;
 const record=emit('geometry-query',{queryId:queries,final,pair,result,projectedDepthM,depthMapping:'SAMPLED_PATCH_DEPTH',bodyA:bodyWords(a),bodyB:bodyWords(b)});
 if(result.status==='UNRESOLVED')refuse('PRIVATE_B_UNRESOLVED:'+result.reason);if(result.status==='MISS')return null;
 if(result.status!=='HIT'||!['FACE','EDGE'].includes(result.feature?.kind)||!result.points.length||result.points.length>4)refuse('PRIVATE_B_UNSUPPORTED_POINT_LIST');
 const n=result.normal;const penetration=projectedDepthM;
 return {normal:[...n],penetration,pointM:[...result.points[0].pointM],_phase:{queryId:record.queryId,result,pair}};
}
export function phaseCacheInit(key,point,normal,hit,impulse,prior){const old=active.accepted.cacheFrames[key]??null;active.current.cacheOrigins[key]=prior?'prior-step':'cold';emit('cache-init',{key,pointId:point.id,queryId:hit._phase.queryId,feature:hit._phase.result.feature,normal,prior:prior??null,producingFrame:old,actualCache:impulse});}
export function phasePoint(key,point,normal,hit,impulse,iteration,order){active.current.point={key,pointId:point.id,queryId:hit._phase.queryId,feature:clone(hit._phase.result.feature),queryPair:clone(hit._phase.pair),native:clone(point.exact),aPointM:clone(point.aPointM),bPointM:clone(point.bPointM),normal:clone(normal),iteration,order,cacheOrigin:active.current.cacheOrigins[key]??'current-pass',producingFrame:clone(active.current.cacheFrames[key]??active.accepted.cacheFrames[key]??null),cacheBefore:clone(impulse),impulse};}
export function phaseKind(kind,branch={}){active.current.kind=kind;active.current.branch=clone(branch);}
export function phaseApplyBefore(a,b,p,j){if(applications+1>phaseLimits.applications)refuse('PRIVATE_APPLY_CAP');return {pointM:clone(p),anchorOnAM:clone(p),anchorOnBM:clone(p),impulseOnANs:j.map(v=>-v),impulseOnBNs:clone(j),bodyABefore:bodyWords(a),bodyBBefore:bodyWords(b)};}
export function phaseApplyAfter(token,a,b){applications++;const point=active.current.point;if(!point)throw Error('Missing actual point/cache context');const {impulse,queryPair,...metadata}=point;emit('impulse-application',{...metadata,eventKind:active.current.kind,branch:active.current.branch,...token,bodyAAfter:bodyWords(a),bodyBAfter:bodyWords(b),cacheAfter:clone(impulse)});active.current.cacheFrames[point.key]={normal:clone(point.normal),feature:clone(point.feature),pointId:point.pointId,native:clone(point.native),pair:clone(queryPair),queryId:point.queryId};point.cacheBefore=clone(impulse);point.producingFrame=clone(active.current.cacheFrames[point.key]);}
export function phaseNoNormal(){emit('normal-zero-no-call',{key:active.current.point?.key,normal:active.current.point?.normal});}
export function phaseCorrectionBefore(a,b,n,depth){return {queryId:active.current.point.queryId,feature:clone(active.current.point.feature),bodyABefore:bodyWords(a),bodyBBefore:bodyWords(b),normal:clone(n),penetration:depth};}
export function phaseCorrectionAfter(token,a,b){emit('pose-correction',{...token,bodyAAfter:bodyWords(a),bodyBAfter:bodyWords(b)});}
export function phasePrepare(c,cache){const prepared={cursor:c.accepted.cursor+c.current.records.length,stepIndex:c.current.stepIndex,cacheFrames:clone(c.current.cacheFrames),actualCache:clone([...cache])};emit('attempt-prepared',{candidateAcceptedCursor:prepared.cursor,cache:prepared.actualCache});prepared.cursor++;return prepared;}
export function phasePrivateSnapshot(worldId){const c=contexts[worldId-1];return clone({accepted:c.accepted,world:c.read()});}
export function phaseFault(worldId,mode){contexts[worldId-1].fault=mode;}
export function phaseHistory(){return clone({counts:{worlds:contexts.length,attempts,records,applications,queries,queryPoints,anchorChecks,traceBytes},worlds:contexts.map(c=>({id:c.id,accepted:c.accepted,creation:c.creation?(({point,...rest})=>rest)(c.creation):null,history:c.history.map(({point,...rest})=>rest)}))});}

export function phaseProducerBucket(key,map,contribution){if(active.current.fault==='unknown'&&contribution.nonzero){const bucket=map.get(key);if(!bucket)throw Error('Unknown fault must follow actual producer bucket mutation');emit('producer-bucket-mutated-before-unknown',{key,contributionNonzero:true,bucket:clone(bucket)});throw unknownMarker;}}
