import {copyBody} from '../../packages/barocss-physics/src/validation.js';
import {validateResult} from '../../packages/barocss-physics/src/collision.js';
import {validateSignedResult} from './signed-linear-solver.mjs';
import {requireSigned,dense,finiteVector} from './signed-input.mjs';
function same(a,b){if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return Object.is(a,b);const ka=Reflect.ownKeys(a),kb=Reflect.ownKeys(b);return ka.length===kb.length&&ka.every(k=>kb.includes(k)&&same(a[k],b[k]));}
const fail=ok=>requireSigned(ok,'result','NUMERIC_LIMIT');
export function applySignedTranslationsOnce(preBodies,problem,result){
 validateSignedResult(problem,result);fail(result.ok===true&&result.status==='SOLVED'&&dense(preBodies,9)&&problem.bodies.length===9);
 for(let i=0;i<9;i++){const body=preBodies[i];fail(body&&body.id===problem.bodies[i].id&&body.inverseMass===problem.bodies[i].inverseMass&&finiteVector(body.positionM,3)&&finiteVector(body.velocityMps,3)&&finiteVector(body.orientation,4)&&finiteVector(body.angularVelocityRadps,3));}
 validateResult(preBodies,[]);const bodies=preBodies.map(copyBody),rounding=[];
 for(let i=0;i<9;i++){
  const before=preBodies[i],body=bodies[i],u=result.translations[i].u;fail(Math.hypot(...u)<=10);
  if(before.inverseMass===0)fail(u.every(v=>v===0));
  const roundedFinalM=before.inverseMass===0?[...before.positionM]:before.positionM.map((v,j)=>v+u[j]);fail(roundedFinalM.every(Number.isFinite));body.positionM=roundedFinalM;
  const actualDeltaM=body.positionM.map((v,j)=>v-before.positionM[j]);
  if(before.inverseMass===0)fail(u.every(v=>v===0)&&same(body,before));
  fail(same(body.orientation,before.orientation)&&same(body.velocityMps,before.velocityMps)&&same(body.angularVelocityRadps,before.angularVelocityRadps));
  rounding.push({id:body.id,nominalTranslationM:[...u],roundedFinalM:[...roundedFinalM],actualDeltaM,nominalActualDeltaDifferenceM:actualDeltaM.map((v,j)=>v-u[j]),exactRoundedFinalMatch:true,staticPositionAdditionPerformed:false,dynamicPositionAdditionPerformed:before.inverseMass>0});
 }
 validateResult(bodies,[]);return {bodies:bodies.map(copyBody),rounding:structuredClone(rounding),applications:1,worldCreated:false,worldStepped:false};
}
