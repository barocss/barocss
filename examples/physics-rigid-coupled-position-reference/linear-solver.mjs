const LIMIT=8, EPS=1e-12, PIVOT=1e-14;
export class PositionReferenceError extends Error {
  constructor(code,message){super(message);this.name='PositionReferenceError';this.code=code;}
}
function requireInput(value,message){if(!value)throw new PositionReferenceError('INVALID_INPUT',message);}
export function validateProblem(problem){
  requireInput(problem&&Array.isArray(problem.bodies)&&Array.isArray(problem.rows),'bodies and rows are required');
  if(problem.bodies.length>9||problem.rows.length>LIMIT)throw new PositionReferenceError('PROFILE_LIMIT','position reference admits at most nine bodies and eight rows');
  requireInput(problem.bodies.length>0,'at least one body is required');
  const ids=new Set();
  for(const b of problem.bodies){requireInput(b&&typeof b.id==='string'&&b.id.length>0&&!ids.has(b.id),'body IDs must be nonempty and unique');ids.add(b.id);requireInput(Number.isFinite(b.inverseMass)&&(b.inverseMass===0||(b.inverseMass>=1e-6&&b.inverseMass<=1e6)),'inverse mass must be zero or within original mass bounds');}
  for(const r of problem.rows){requireInput(r&&ids.has(r.aId)&&ids.has(r.bId)&&r.aId!==r.bId,'row endpoints must name distinct bodies');requireInput(Array.isArray(r.normal)&&r.normal.length===3&&r.normal.every(Number.isFinite)&&Math.abs(Math.hypot(...r.normal)-1)<=EPS,'row normal must be finite and unit length');requireInput(Number.isFinite(r.depthM)&&r.depthM>=0&&r.depthM<=10,'row depth must be finite and between zero and ten metres');}
}
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
export function solvePosition(problem){
  validateProblem(problem);const {bodies,rows}=problem,n=rows.length;
  const incidence=rows.map(r=>bodies.map(b=>r.normal.map(v=>b.id===r.aId?-v:b.id===r.bId?v:0)));
  const gram=rows.map((_,i)=>rows.map((_,j)=>bodies.reduce((sum,b,k)=>sum+b.inverseMass*incidence[i][k].reduce((s,v,d)=>s+v*incidence[j][k][d],0),0)));
  let best=null;const singularMasks=[];let infeasibleMasks=0;
  for(let mask=0;mask<(1<<n);mask++){
    const active=rows.map((_,i)=>i).filter(i=>mask&(1<<i));const solved=solveSystem(active.map(i=>active.map(j=>gram[i][j])),active.map(i=>rows[i].depthM));
    if(solved===null){singularMasks.push(mask);continue;}
    const lambda=Array(n).fill(0);active.forEach((i,k)=>lambda[i]=solved[k]);
    const translations=bodies.map((b,k)=>({id:b.id,u: [0,1,2].map(d=>b.inverseMass*lambda.reduce((s,v,i)=>s+v*incidence[i][k][d],0))}));
    const margins=rows.map((r,i)=>incidence[i].reduce((s,v,k)=>s+v.reduce((t,c,d)=>t+c*translations[k].u[d],0),0)-r.depthM);
    if(lambda.some(v=>!Number.isFinite(v)||v < -EPS)||margins.some(v=>!Number.isFinite(v)||v < -EPS)){infeasibleMasks++;continue;}
    const objective=bodies.reduce((s,b,k)=>s+(b.inverseMass>0?translations[k].u.reduce((t,v)=>t+v*v,0)/b.inverseMass/2:0),0);
    if(!Number.isFinite(objective)){infeasibleMasks++;continue;}
    const certificate={primalViolationM:Math.max(0,...margins.map(v=>-v)),negativeMultiplierKgM:Math.max(0,...lambda.map(v=>-v)),complementarityKgM2:Math.max(0,...lambda.map((v,i)=>Math.abs(v*margins[i]))),stationarityKgM:Math.max(0,...bodies.flatMap((b,k)=>b.inverseMass>0?translations[k].u.map((v,d)=>Math.abs(v/b.inverseMass-lambda.reduce((t,q,i)=>t+q*incidence[i][k][d],0))):[0]))};
    const candidate={activeMask:mask,active,lambdaKgM:lambda,translations,primalMarginsM:margins,objectiveKgM2:objective,certificate};
    if(best===null||objective<best.objectiveKgM2-1e-24)best=candidate;
  }
  return {ok:best!==null,status:best===null?'INFEASIBLE':'SOLVED',...(best??{}),gram,singularMasks,infeasibleMasks,enumeratedMasks:1<<n,worldStepped:false};
}
