import {fail,readProblem,dense,matrix,exactFields,GATE,type LinearProblem,type LinearResult,type Phase,type Certificate} from './profile.js';

type Failure='system'|'certificate';
function checked(value:number,kind:Failure='system'):number{if(!Number.isFinite(value))fail(kind);return value;}
function dot(a:number[],b:number[],kind:Failure='system'):number{
 let sum=0;for(let j=0;j<a.length;j++)sum=checked(sum+checked(a[j]*b[j],kind),kind);return sum;
}
function normInf(a:number[][],kind:Failure='system'):number{
 let maximum=0;for(const row of a){let sum=0;for(const value of row)sum=checked(sum+Math.abs(value),kind);maximum=Math.max(maximum,sum);}return maximum;
}
function selected(problem:LinearProblem,active:boolean){
 return {a:active?[...problem.a.map(row=>[...row]),[...problem.stopRow]]:problem.a.map(row=>[...row]),b:active?[...problem.b,0]:[...problem.b]};
}
function gram(a:number[][],h:number[],kind:Failure='system'):number[][]{
 for(const value of h)checked(1/value,kind);
 return a.map(row=>a.map(other=>{let sum=0;for(let j=0;j<12;j++){const divided=checked(row[j]/h[j],kind);sum=checked(sum+checked(divided*other[j],kind),kind);}return sum;}));
}
function safeReciprocals(problem:LinearProblem):void{for(const value of problem.h)checked(1/value);}
function fromLambda(problem:LinearProblem,a:number[][],lambda:number[],kind:Failure='system'):number[]{
 const y=[];for(let j=0;j<12;j++){let sum=0;for(let i=0;i<a.length;i++)sum=checked(sum+checked(a[i][j]*lambda[i],kind),kind);y.push(checked(problem.y0[j]+checked(sum/problem.h[j],kind),kind));}return y;
}
function objective(problem:LinearProblem,y:number[]):number{
 let sum=0;for(let j=0;j<12;j++){const difference=checked(y[j]-problem.y0[j],'certificate');const square=checked(difference*difference,'certificate');sum=checked(sum+checked(problem.h[j]*square,'certificate'),'certificate');}return checked(.5*sum,'certificate');
}
function phaseResiduals(g:number[][],rhs:number[],lambda:number[],inverse:number[][],kind:Failure='system'){
 let linear=0,inverseError=0;
 for(let i=0;i<g.length;i++){
  linear=Math.max(linear,Math.abs(checked(dot(g[i],lambda,kind)-rhs[i],kind)));
  let rowError=0;
  for(let j=0;j<g.length;j++){let sum=0;for(let k=0;k<g.length;k++)sum=checked(sum+checked(g[i][k]*inverse[k][j],kind),kind);rowError=checked(rowError+Math.abs(checked(sum-(i===j?1:0),kind)),kind);}
  inverseError=Math.max(inverseError,rowError);
 }
 return {linear,inverse:inverseError};
}
function solvePhase(problem:LinearProblem,active:boolean):Phase{
 const system=selected(problem,active),a=system.a,b=system.b,n=a.length,g=gram(a,problem.h),rhs=b.map((value,i)=>checked(value-dot(a[i],problem.y0)));
 const norm=normInf(g),threshold=checked(1e-12*Math.max(1,norm));
 const augmented=g.map((row,i)=>[...row,rhs[i],...Array.from({length:n},(_,j)=>i===j?1:0)]),pivots=[];
 // One forward elimination of all RHS columns, then back substitution.
 for(let k=0;k<n;k++){
  let chosen=k;for(let i=k+1;i<n;i++)if(Math.abs(augmented[i][k])>Math.abs(augmented[chosen][k]))chosen=i;
  if(Math.abs(augmented[chosen][k])<=threshold)fail('system');
  if(chosen!==k)[augmented[k],augmented[chosen]]=[augmented[chosen],augmented[k]];
  const pivot=augmented[k][k];pivots.push(pivot);
  for(let i=k+1;i<n;i++){
   const factor=checked(augmented[i][k]/pivot);augmented[i][k]=0;
   for(let j=k+1;j<=2*n;j++)augmented[i][j]=checked(augmented[i][j]-checked(factor*augmented[k][j]));
  }
 }
 const solutions:number[][]=[];
 for(let column=n;column<=2*n;column++){
  const x=Array<number>(n).fill(0);
  for(let i=n-1;i>=0;i--){let sum=0;for(let j=i+1;j<n;j++)sum=checked(sum+checked(augmented[i][j]*x[j]));x[i]=checked(checked(augmented[i][column]-sum)/augmented[i][i]);}
  solutions.push(x);
 }
 const lambda=solutions[0],inverse=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>solutions[j+1][i]));
 const conditionInf=checked(norm*normInf(inverse));if(conditionInf>1e12)fail('system');
 const y=fromLambda(problem,a,lambda),residuals=phaseResiduals(g,rhs,lambda,inverse);
 if(residuals.linear>GATE||residuals.inverse>GATE)fail('certificate');
 return {rowIds:Array.from({length:n},(_,i)=>i),rowCount:n,pivots,inverse,normInf:norm,conditionInf,lambda,y,residuals};
}
function certificate(problem:LinearProblem,result:Pick<LinearResult,'y'|'lambda'|'activeStop'|'objectiveDimensionless'>):Certificate{
 const system=selected(problem,result.activeStop),a=system.a,b=system.b;
 let primal=0,stationarity=0;
 for(let i=0;i<a.length;i++)primal=Math.max(primal,Math.abs(checked(dot(a[i],result.y,'certificate')-b[i],'certificate')));
 for(let j=0;j<12;j++){let sum=0;for(let i=0;i<a.length;i++)sum=checked(sum+checked(a[i][j]*result.lambda[i],'certificate'),'certificate');const lhs=checked(problem.h[j]*checked(result.y[j]-problem.y0[j],'certificate'),'certificate');stationarity=Math.max(stationarity,Math.abs(checked(lhs-sum,'certificate')));}
 const signed=problem.stopKind==='none'?0:dot(problem.stopRow,result.y,'certificate'),mu=result.activeStop?-result.lambda[11]:0;
 const negativeMu=Math.max(0,-mu),complementarity=Math.abs(checked(mu*signed,'certificate'));
 const objectiveError=Math.abs(checked(objective(problem,result.y)-result.objectiveDimensionless,'certificate'));
 const value={primal,stationarity,negativeMu,complementarity,objective:objectiveError};
 if(problem.stopKind!=='none'&&signed>GATE||Object.values(value).some(v=>v>GATE)||result.objectiveDimensionless<0)fail('certificate');
 return value;
}
function exactIdentity(problem:LinearProblem):boolean{
 return problem.a.every((row,i)=>checked(dot(row,problem.y0)-problem.b[i])===0)&&(problem.stopKind==='none'||dot(problem.stopRow,problem.y0)<=0);
}
function readPhase(value:unknown,n:number):Phase{
 if(!exactFields(value,['rowIds','rowCount','pivots','inverse','normInf','conditionInf','lambda','y','residuals'])||value.rowCount!==n||!dense(value.rowIds,n)||value.rowIds.some((id,i)=>id!==i)||!dense(value.pivots,n)||!matrix(value.inverse,n,n)||!dense(value.lambda,n)||!dense(value.y,12)||typeof value.normInf!=='number'||!Number.isFinite(value.normInf)||value.normInf<0||typeof value.conditionInf!=='number'||!Number.isFinite(value.conditionInf)||value.conditionInf<0||!exactFields(value.residuals,['linear','inverse'])||![value.residuals.linear,value.residuals.inverse].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0))fail('certificate');
 return value as unknown as Phase;
}
function validatePhase(problem:LinearProblem,phase:Phase,active:boolean):void{
 const system=selected(problem,active),g=gram(system.a,problem.h,'certificate'),rhs=system.b.map((value,i)=>checked(value-dot(system.a[i],problem.y0,'certificate'),'certificate'));
 const norm=normInf(g,'certificate'),condition=checked(norm*normInf(phase.inverse,'certificate'),'certificate');
 if(!Object.is(norm,phase.normInf)||!Object.is(condition,phase.conditionInf)||condition>1e12||phase.pivots.some(value=>Math.abs(value)<=1e-12*Math.max(1,norm)))fail('certificate');
 const residuals=phaseResiduals(g,rhs,phase.lambda,phase.inverse,'certificate');
 if(residuals.linear>GATE||residuals.inverse>GATE||!Object.is(residuals.linear,phase.residuals.linear)||!Object.is(residuals.inverse,phase.residuals.inverse))fail('certificate');
 const y=fromLambda(problem,system.a,phase.lambda,'certificate');if(y.some((v,i)=>!Object.is(v,phase.y[i])))fail('certificate');
}
export function validateVelocityCertificate(problemValue:unknown,resultValue:unknown):Certificate{
 const problem=readProblem(problemValue);
 safeReciprocals(problem);
 if(!exactFields(resultValue,['y','lambda','activeStop','identity','solveAttempts','phases','objectiveDimensionless','certificate'])||typeof resultValue.activeStop!=='boolean'||typeof resultValue.identity!=='boolean'||!dense(resultValue.y,12)||!dense(resultValue.lambda,resultValue.activeStop?12:11)||typeof resultValue.objectiveDimensionless!=='number'||!Number.isFinite(resultValue.objectiveDimensionless)||!Number.isInteger(resultValue.solveAttempts)||!Array.isArray(resultValue.phases)||Object.getPrototypeOf(resultValue.phases)!==Array.prototype||Reflect.ownKeys(resultValue.phases).length!==resultValue.phases.length+1||!Array.from({length:resultValue.phases.length},(_,i)=>i).every(i=>Object.hasOwn(resultValue.phases as unknown[],i))||!exactFields(resultValue.certificate,['primal','stationarity','negativeMu','complementarity','objective'])||Object.values(resultValue.certificate).some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))fail('certificate');
 const result=resultValue as unknown as LinearResult,identity=exactIdentity(problem);
 if(result.identity!==identity||result.phases.length!==result.solveAttempts)fail('certificate');
 if(identity){if(result.solveAttempts!==0||result.activeStop||result.lambda.some(value=>value!==0)||result.y.some((value,j)=>!Object.is(value,problem.y0[j])))fail('certificate');}
 else{
  if(result.solveAttempts!==1&&result.solveAttempts!==2)fail('certificate');
  const equality=readPhase(result.phases[0],11);validatePhase(problem,equality,false);
  const active=problem.stopKind!=='none'&&dot(problem.stopRow,equality.y,'certificate')>0;
  if(result.activeStop!==active||result.solveAttempts!==(active?2:1))fail('certificate');
  if(active)validatePhase(problem,readPhase(result.phases[1],12),true);
  const final=result.phases[result.phases.length-1];if(result.y.some((value,j)=>!Object.is(value,final.y[j]))||result.lambda.some((value,i)=>!Object.is(value,final.lambda[i])))fail('certificate');
 }
 const computed=certificate(problem,result);for(const key of Object.keys(computed) as (keyof Certificate)[])if(Math.abs(computed[key]-result.certificate[key])>GATE)fail('certificate');
 return {...computed};
}
export function solveDimensionlessVelocity(value:unknown):LinearResult{
 const problem=readProblem(value);safeReciprocals(problem);
 const identity=exactIdentity(problem);let phases:Phase[]=[],activeStop=false,y:number[],lambda:number[];
 if(identity){y=[...problem.y0];lambda=Array(11).fill(0);}
 else{
  phases=[solvePhase(problem,false)];activeStop=problem.stopKind!=='none'&&dot(problem.stopRow,phases[0].y)>0;
  if(activeStop)phases.push(solvePhase(problem,true));
  const final=phases[phases.length-1];y=[...final.y];lambda=[...final.lambda];
 }
 const result:LinearResult={y,lambda,activeStop,identity,solveAttempts:phases.length,phases,objectiveDimensionless:objective(problem,y),certificate:{primal:0,stationarity:0,negativeMu:0,complementarity:0,objective:0}};
 result.certificate=certificate(problem,result);validateVelocityCertificate(problem,result);
 return structuredClone(result);
}
