import {finite,unsafe} from './full-pair-input.mjs';
export const EPS=1e-12,PIVOT=1e-14;
export const normInfVector=v=>Math.max(0,...v.map(Math.abs));
export const normInfMatrix=m=>Math.max(0,...m.map(row=>row.reduce((s,v)=>finite(s+Math.abs(v)),0)));
export function dot(a,b){let sum=0;for(let i=0;i<a.length;i++)sum=finite(sum+finite(a[i]*b[i]));return sum;}
/** Full immutable incidence, dynamic coordinates in input-body then xyz order. */
export function prepareModel(problem){
  const offsets=[],D=[];for(const body of problem.bodies){if(body.inverseMass===0)offsets.push(null);else{offsets.push(D.length);D.push(body.inverseMass,body.inverseMass,body.inverseMass);}}
  const locations=new Map(problem.bodies.map((b,i)=>[b.id,i]));
  const A=problem.rows.map(row=>{const a=Array(D.length).fill(0),ia=offsets[locations.get(row.aId)],ib=offsets[locations.get(row.bId)];for(let k=0;k<3;k++){if(ia!==null)a[ia+k]=-row.normal[k];if(ib!==null)a[ib+k]=row.normal[k];}return a;});
  const b=problem.rows.map(row=>row.boundM),G=A.map(left=>A.map(right=>{let sum=0;for(let k=0;k<D.length;k++)sum=finite(sum+finite(finite(left[k]*D[k])*right[k]));return sum;}));
  return {problem,A,b,D,G,offsets,dynamicDof:D.length};
}
export function reconstruct(model,lambda){
  return model.D.map((inverseMass,k)=>{let sum=0;for(let i=0;i<model.A.length;i++)sum=finite(sum+finite(model.A[i][k]*lambda[i]));return finite(inverseMass*sum);});
}
export function margins(model,u,meter){return model.A.map((row,i)=>{meter?.take('constraintTests');return finite(dot(row,u)-model.b[i]);});}
export function translations(model,u){return model.problem.bodies.map((body,i)=>({id:body.id,u:model.offsets[i]===null?[0,0,0]:u.slice(model.offsets[i],model.offsets[i]+3)}));}
export function fullCertificate(model,u,lambda,meter){
  const primalMarginsM=margins(model,u,meter);
  let stationarityKgM=0;for(let k=0;k<u.length;k++){let sum=0;for(let i=0;i<lambda.length;i++)sum=finite(sum+finite(model.A[i][k]*lambda[i]));stationarityKgM=Math.max(stationarityKgM,Math.abs(finite(u[k]/model.D[k]-sum)));}
  const certificate={primalViolationM:Math.max(0,...primalMarginsM.map(v=>-v)),negativeMultiplierKgM:Math.max(0,...lambda.map(v=>-v)),
    complementarityKgM2:Math.max(0,...lambda.map((v,i)=>Math.abs(finite(v*primalMarginsM[i])))),stationarityKgM};
  let objectiveKgM2=0;for(let i=0;i<model.problem.bodies.length;i++){const start=model.offsets[i];if(start===null)continue;let square=0;for(let k=0;k<3;k++)square=finite(square+finite(u[start+k]*u[start+k]));objectiveKgM2=finite(objectiveKgM2+finite(square/model.problem.bodies[i].inverseMass/2));}
  return {primalMarginsM,certificate,objectiveKgM2};
}
export function checkIterate(model,u,lambda,W,pending,meter){
  if(u.some(v=>!Number.isFinite(v))||lambda.some(v=>!Number.isFinite(v)))unsafe('nonfinite');
  if(lambda.some(v=>v<0))unsafe('negative-multiplier');
  const allowed=new Set(W);if(pending!==null)allowed.add(pending);if(lambda.some((v,i)=>v!==0&&!allowed.has(i)))unsafe('iterate-certificate');
  for(const i of W){meter.take('constraintTests');if(Math.abs(finite(dot(model.A[i],u)-model.b[i]))>EPS)unsafe('iterate-certificate');}
  for(let k=0;k<u.length;k++){let sum=0;for(let i=0;i<lambda.length;i++)sum=finite(sum+finite(model.A[i][k]*lambda[i]));if(Math.abs(finite(u[k]/model.D[k]-sum))>EPS)unsafe('iterate-certificate');}
}
/** One augmented block factorization solves r plus every inverse column. */
export function solveBasis(matrix,rhs,meter){
  const n=rhs.length;if(n===0)return {r:[],inverse:[],condition:null};
  meter.take('linearSolves');meter.counters.factorizations++;meter.counters.blockRightHandSides+=1+n;
  const scale=Math.max(1,...matrix.flat().map(Math.abs)),aug=matrix.map((row,i)=>[...row,rhs[i],...Array.from({length:n},(_,j)=>i===j?1:0)]);
  for(let col=0;col<n;col++){
    let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(aug[row][col])>Math.abs(aug[pivot][col]))pivot=row;
    if(!Number.isFinite(aug[pivot][col]))unsafe('nonfinite');if(Math.abs(aug[pivot][col])<=PIVOT*scale)unsafe('pivot');
    [aug[pivot],aug[col]]=[aug[col],aug[pivot]];
    for(let row=col+1;row<n;row++){const ratio=finite(aug[row][col]/aug[col][col]);for(let k=col;k<2*n+1;k++)aug[row][k]=finite(aug[row][k]-finite(ratio*aug[col][k]));}
  }
  const solved=Array.from({length:n},()=>Array(n+1).fill(0));
  for(let row=n-1;row>=0;row--)for(let k=0;k<n+1;k++){let value=aug[row][n+k];for(let col=row+1;col<n;col++)value=finite(value-finite(aug[row][col]*solved[col][k]));solved[row][k]=finite(value/aug[row][row]);}
  const r=solved.map(row=>row[0]),inverse=solved.map(row=>row.slice(1));
  const normG=normInfMatrix(matrix),condition=finite(normG*normInfMatrix(inverse));if(condition>1e12)unsafe('condition');
  const residual=normInfVector(matrix.map((row,i)=>finite(dot(row,r)-rhs[i]))),denominator=finite(Math.max(1,finite(normG*normInfVector(r))+normInfVector(rhs)));
  if(finite(residual/denominator)>EPS)unsafe('factor-residual');
  const product=matrix.map((row,i)=>Array.from({length:n},(_,j)=>finite(dot(row,inverse.map(x=>x[j]))-(i===j?1:0))));
  if(normInfMatrix(product)>EPS)unsafe('factor-residual');
  return {r,inverse,condition};
}
export function direction(model,W,p,r,meter){
  const z=model.D.map((inv,k)=>{let projection=0;for(let j=0;j<W.length;j++)projection=finite(projection+finite(model.A[W[j]][k]*r[j]));return finite(inv*finite(model.A[p][k]-projection));});
  meter.take('rankChecks');const delta=dot(model.A[p],z),scale=Math.max(1,model.G[p][p]);
  let zMz=0;for(let k=0;k<z.length;k++)zMz=finite(zMz+finite(finite(z[k]*z[k])/model.D[k]));
  const orthogonal=normInfVector(W.map(i=>dot(model.A[i],z))),orthScale=Math.max(1,...W.map(i=>Math.abs(model.G[i][p])),...W.map(i=>{let sum=0;for(let j=0;j<W.length;j++)sum=finite(sum+Math.abs(finite(model.G[i][W[j]]*r[j])));return sum;}));
  if(finite(orthogonal/orthScale)>EPS||finite(Math.abs(finite(delta-zMz))/Math.max(1,Math.abs(delta),Math.abs(zMz),Math.abs(model.G[p][p])))>EPS)unsafe('direction-residual');
  if(delta< -PIVOT*scale)unsafe('direction-residual');
  return {z,delta,near:Math.abs(delta)<=PIVOT*scale||W.length+1>model.dynamicDof};
}
