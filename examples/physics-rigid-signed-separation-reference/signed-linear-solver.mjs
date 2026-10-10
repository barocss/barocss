import {solveSignedCore} from './signed-linear-core.mjs';
import {validateSignedProblem,requireSigned,dense,finiteVector,plain} from './signed-input.mjs';
export {SignedPositionReferenceError,MESSAGES,validateSignedProblem} from './signed-input.mjs';
const fail=condition=>requireSigned(condition,'result','NUMERIC_LIMIT');
export function validateSignedResult(problem,result){
 validateSignedProblem(problem);const n=problem.rows.length,b=problem.bodies.length;
 fail(result!==null&&typeof result==='object'&&result.worldStepped===false&&typeof result.ok==='boolean'&&result.enumeratedMasks===1<<n&&dense(result.gram,n)&&result.gram.every(row=>finiteVector(row,n))&&dense(result.singularMasks)&&result.singularMasks.every(x=>Number.isInteger(x)&&x>=0&&x<1<<n)&&Number.isInteger(result.infeasibleMasks)&&result.infeasibleMasks>=0&&result.infeasibleMasks<=1<<n);
 const incidence=problem.rows.map(r=>problem.bodies.map(b=>r.normal.map(v=>b.id===r.aId?-v:b.id===r.bId?v:0)));
 const gram=problem.rows.map((_,i)=>problem.rows.map((_,j)=>problem.bodies.reduce((sum,b,k)=>sum+b.inverseMass*incidence[i][k].reduce((subtotal,v,d)=>subtotal+v*incidence[j][k][d],0),0)));
 fail(gram.every((row,i)=>row.every((v,j)=>Object.is(v,result.gram[i][j]))));
 fail(result.singularMasks.every((mask,i)=>i===0||mask>result.singularMasks[i-1])&&result.singularMasks.length+result.infeasibleMasks<=1<<n);
 if(!result.ok){fail(plain(result,['ok','status','gram','singularMasks','infeasibleMasks','enumeratedMasks','worldStepped']));fail(result.status==='INFEASIBLE'&&['activeMask','active','lambdaKgM','translations','primalMarginsM','objectiveKgM2','certificate'].every(k=>!Object.hasOwn(result,k)));fail(result.singularMasks.length+result.infeasibleMasks===1<<n);return result;}
 fail(plain(result,['ok','status','activeMask','active','lambdaKgM','translations','primalMarginsM','objectiveKgM2','certificate','gram','singularMasks','infeasibleMasks','enumeratedMasks','worldStepped']));
 fail(result.status==='SOLVED'&&Number.isInteger(result.activeMask)&&result.activeMask>=0&&result.activeMask<1<<n&&dense(result.active)&&result.active.every((x,i)=>Number.isInteger(x)&&x>=0&&x<n&&(i===0||x>result.active[i-1]))&&result.activeMask===result.active.reduce((mask,x)=>mask|(1<<x),0));
 fail(finiteVector(result.lambdaKgM,n)&&finiteVector(result.primalMarginsM,n)&&dense(result.translations,b)&&typeof result.objectiveKgM2==='number'&&Number.isFinite(result.objectiveKgM2)&&result.objectiveKgM2>=0);
 for(let k=0;k<b;k++){const t=result.translations[k];fail(plain(t,['id','u'])&&t.id===problem.bodies[k].id&&finiteVector(t.u,3)&&Math.hypot(...t.u)<=10);if(problem.bodies[k].inverseMass===0)fail(t.u.every(v=>v===0));}
 const c=result.certificate;fail(plain(c,['primalViolationM','negativeMultiplierKgM','complementarityKgM2','stationarityKgM'])&&['primalViolationM','negativeMultiplierKgM','complementarityKgM2','stationarityKgM'].every(key=>typeof c[key]==='number'&&Number.isFinite(c[key])&&c[key]>=0&&c[key]<=1e-12));
 const margins=problem.rows.map((r,i)=>incidence[i].reduce((sum,v,k)=>sum+v.reduce((subtotal,component,d)=>subtotal+component*result.translations[k].u[d],0),0)-r.boundM);

 fail(margins.every((v,i)=>Object.is(v,result.primalMarginsM[i]))&&gram.every((row,i)=>row.every((v,j)=>Object.is(v,result.gram[i][j]))));
 fail(!result.singularMasks.includes(result.activeMask)&&result.singularMasks.length+result.infeasibleMasks<1<<n&&result.lambdaKgM.every((v,i)=>result.active.includes(i)?Math.abs(margins[i])<=1e-12:v===0));
 const objective=problem.bodies.reduce((sum,b,k)=>sum+(b.inverseMass>0?result.translations[k].u.reduce((subtotal,v)=>subtotal+v*v,0)/b.inverseMass/2:0),0);
 const actual={primalViolationM:Math.max(0,...margins.map(v=>-v)),negativeMultiplierKgM:Math.max(0,...result.lambdaKgM.map(v=>-v)),complementarityKgM2:Math.max(0,...result.lambdaKgM.map((v,i)=>Math.abs(v*margins[i]))),stationarityKgM:Math.max(0,...problem.bodies.flatMap((b,k)=>b.inverseMass>0?result.translations[k].u.map((v,d)=>Math.abs(v/b.inverseMass-result.lambdaKgM.reduce((sum,q,i)=>sum+q*incidence[i][k][d],0))):[0]))};
 fail(Object.is(objective,result.objectiveKgM2)&&Object.keys(actual).every(k=>Object.is(actual[k],c[k])));
 return result;
}
export function solveSignedPositionReference(problem){validateSignedProblem(problem);return validateSignedResult(problem,solveSignedCore(problem));}
