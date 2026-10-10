import {validateSignedProblem} from './signed-input.mjs';
const LIMIT=8, EPS=1e-12, PIVOT=1e-14;
function solveSystem(matrix,rhs){
  const n=rhs.length,a=matrix.map((r,i)=>[...r,rhs[i]]),scale=Math.max(1,...matrix.flat().map(Math.abs));
  for(let col=0;col<n;col++){
    let pivot=col;for(let r=col+1;r<n;r++)if(Math.abs(a[r][col])>Math.abs(a[pivot][col]))pivot=r;
    if(Math.abs(a[pivot][col])<=PIVOT*scale)return null;
    [a[pivot],a[col]]=[a[col],a[pivot]];
    for(let r=col+1;r<n;r++){const ratio=a[r][col]/a[col][col];for(let c=col;c<=n;c++)a[r][c]-=ratio*a[col][c];}
  }
  const x=Array(n).fill(0);for(let r=n-1;r>=0;r--){let value=a[r][n];for(let c=r+1;c<n;c++)value-=a[r][c]*x[c];x[r]=value/a[r][r];}return x;
}
export function solveSignedCore(problem){
  validateSignedProblem(problem);const {bodies,rows}=problem,n=rows.length;
  const incidence=rows.map(r=>bodies.map(b=>r.normal.map(v=>b.id===r.aId?-v:b.id===r.bId?v:0)));
  const gram=rows.map((_,i)=>rows.map((_,j)=>bodies.reduce((sum,b,k)=>sum+b.inverseMass*incidence[i][k].reduce((s,v,d)=>s+v*incidence[j][k][d],0),0)));
  let best=null;const singularMasks=[];let infeasibleMasks=0;
  for(let mask=0;mask<(1<<n);mask++){
    const active=rows.map((_,i)=>i).filter(i=>mask&(1<<i));const solved=solveSystem(active.map(i=>active.map(j=>gram[i][j])),active.map(i=>rows[i].boundM));
    if(solved===null){singularMasks.push(mask);continue;}
    const lambda=Array(n).fill(0);active.forEach((i,k)=>lambda[i]=solved[k]);
    const translations=bodies.map((b,k)=>({id:b.id,u: [0,1,2].map(d=>b.inverseMass*lambda.reduce((s,v,i)=>s+v*incidence[i][k][d],0))}));
    const margins=rows.map((r,i)=>incidence[i].reduce((s,v,k)=>s+v.reduce((t,c,d)=>t+c*translations[k].u[d],0),0)-r.boundM);
    if(lambda.some(v=>!Number.isFinite(v)||v < -EPS)||margins.some(v=>!Number.isFinite(v)||v < -EPS)){infeasibleMasks++;continue;}
    const objective=bodies.reduce((s,b,k)=>s+(b.inverseMass>0?translations[k].u.reduce((t,v)=>t+v*v,0)/b.inverseMass/2:0),0);
    if(!Number.isFinite(objective)){infeasibleMasks++;continue;}
    const certificate={primalViolationM:Math.max(0,...margins.map(v=>-v)),negativeMultiplierKgM:Math.max(0,...lambda.map(v=>-v)),complementarityKgM2:Math.max(0,...lambda.map((v,i)=>Math.abs(v*margins[i]))),stationarityKgM:Math.max(0,...bodies.flatMap((b,k)=>b.inverseMass>0?translations[k].u.map((v,d)=>Math.abs(v/b.inverseMass-lambda.reduce((t,q,i)=>t+q*incidence[i][k][d],0))):[0]))};
    const candidate={activeMask:mask,active,lambdaKgM:lambda,translations,primalMarginsM:margins,objectiveKgM2:objective,certificate};
    if(best===null||objective<best.objectiveKgM2-1e-24)best=candidate;
  }
  return {ok:best!==null,status:best===null?'INFEASIBLE':'SOLVED',...(best??{}),gram,singularMasks,infeasibleMasks,enumeratedMasks:1<<n,worldStepped:false};
}
