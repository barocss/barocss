import {requireArchive,dense,rawState,digest} from './archive.mjs';
const fields=['positionM','velocityMps','orientation','angularVelocityRadps'];
function same(a,b){if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return Object.is(a,b);const ka=Reflect.ownKeys(a),kb=Reflect.ownKeys(b);return ka.length===kb.length&&ka.every(k=>kb.includes(k)&&same(a[k],b[k]));}
function metadata(body){return Object.fromEntries(Object.entries(body).filter(([k])=>!fields.includes(k)));}
export function sortedPairs(bodies){const pairs=[];for(let a=0;a<bodies.length;a++)for(let b=a+1;b<bodies.length;b++)pairs.push(bodies[a].id<bodies[b].id?[a,b]:[b,a]);pairs.sort((x,y)=>bodies[x[0]].id<bodies[y[0]].id?-1:bodies[x[0]].id>bodies[y[0]].id?1:bodies[x[1]].id<bodies[y[1]].id?-1:1);return pairs;}
export function restoreBodies(m,config,state){
  requireArchive(Array.isArray(state.bodies)&&state.bodies.length===9,'body');
  return state.bodies.map((b,i)=>{const parsed=m.parseBody(structuredClone(config.bodies[i]));requireArchive(b.id===parsed.id&&b.kind===parsed.kind&&same(b.shape,parsed.shape)&&same(b.inertiaDiagonalKgM2,parsed.inertiaDiagonalKgM2),'body');for(const [field,n]of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]]){requireArchive(dense(b[field],n),'body');parsed[field]=[...b[field]];}return parsed;});
}
export function prepareFrames(m,row){
  const previous=restoreBodies(m,row.report.config,row.frames.previous.state),final=restoreBodies(m,row.report.config,row.frames.final.state),pre=structuredClone(row.frames.preCoupled.workingBodies),parsed=row.report.config.bodies.map(c=>m.parseBody(structuredClone(c)));
  requireArchive(pre.length===9&&pre.every((b,i)=>same(metadata(b),metadata(parsed[i]))),'body');
  const solution=row.archivedSolution;requireArchive(solution?.ok===true&&solution.status==='SOLVED'&&Array.isArray(solution.translations)&&solution.translations.length===9&&row.problem?.bodies?.length===9&&row.problem.rows.length<=8,'result');
  const translations=solution.translations.map((t,i)=>{requireArchive(t.id===pre[i].id&&dense(t.u,3)&&row.problem.bodies[i].id===pre[i].id&&row.problem.bodies[i].inverseMass===pre[i].inverseMass,'result');return {id:t.id,u:[...t.u]};});
  const rounding=[];
  for(let i=0;i<9;i++){
    const a=pre[i],b=final[i],u=translations[i].u;requireArchive(same(metadata(a),metadata(b))&&same(a.orientation,b.orientation)&&same(a.velocityMps,b.velocityMps)&&same(a.angularVelocityRadps,b.angularVelocityRadps),'pose');
    const rounded=a.positionM.map((v,j)=>v+u[j]),actualDelta=b.positionM.map((v,j)=>v-a.positionM[j]);requireArchive(rounded.every((v,j)=>Object.is(v,b.positionM[j])),'pose');if(a.inverseMass===0)requireArchive(u.every(v=>v===0)&&same(a,b),'pose');
    rounding.push({id:a.id,nominalTranslationM:[...u],roundedFinalM:rounded,actualDeltaM:actualDelta,nominalActualDeltaDifferenceM:actualDelta.map((v,j)=>v-u[j]),exactRoundedFinalMatch:true});
  }
  const frames=[{...row.frames.previous,bodies:previous},{...row.frames.preCoupled,bodies:pre},{...row.frames.final,bodies:final}];
  const pairs=sortedPairs(pre);requireArchive(pairs.length===36,'rows');
  return {frames,pairs,translations,rounding,rawHashes:Object.fromEntries(Object.entries(row.rawSlices).map(([k,v])=>[k,digest(v)]))};
}
