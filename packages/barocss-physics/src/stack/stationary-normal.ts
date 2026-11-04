/** Private exact stationary-chain candidate. Not adopted by the normal bridge. */
import type {NormalBody,NormalProblem} from './normal-solver.js';
type Q={n:bigint;d:bigint};
type V=[Q,Q,Q];
type Six=[number,number,number,number,number,number];
export const STATIONARY_LIMITS=Object.freeze({rationalOperations:200000,integerOperations:2000000,integerBits:16384,triangleTrials:32});
export type StationaryStatus='SOLVED_STATIONARY_WITNESS'|'INVALID_INPUT'|'UNSUPPORTED_PROFILE'|'NO_WITNESS'|'RESOURCE_LIMIT'|'NUMERIC_LIMIT';
export interface StationaryStats {rationalOperations:number;integerOperations:number;peakIntegerBits:number;triangleTrials:number;interfacesProcessed:number}
export interface Ratio {n:string;d:string}
interface Endpoint {bodyId:string;coefficients:Six;words:string[]}
export interface StationaryResult {
 ok:boolean;status:StationaryStatus;reason:string|null;bodies:readonly NormalBody[];normalImpulsesNs:number[]|null;
 exactApplied:null|{format:'STATIONARY_FLOAT_J_RATIOS_V1';points:{id:string;a:Endpoint;b:Endpoint;lambda:Ratio;roundedWord:string}[];
  dynamicResiduals:{bodyId:string;values:Ratio[]}[];allRowsPrimalZero:true;allRowsComplementarityZero:true;nonnegative:true};
 roundedReconstruction:null|{maxVelocityErrorMps:number;maxAngularVelocityErrorRadps:number;maxUnscaledMassWeightedResidualSqrtJ:number};stats:StationaryStats;
}
const ZERO:Q={n:0n,d:1n};
class Stop extends Error {
 constructor(readonly status:Exclude<StationaryStatus,'SOLVED_STATIONARY_WITNESS'>,message:string){
  super(message);
  this.name='StationaryNormalFailure';
 }
}
function need(ok:unknown,status:Exclude<StationaryStatus,'SOLVED_STATIONARY_WITNESS'>,message:string):asserts ok{
 if(!ok)throw new Stop(status,message);
}
class Exact {
 readonly stats:StationaryStats={rationalOperations:0,integerOperations:0,peakIntegerBits:0,triangleTrials:0,interfacesProcessed:0};
 private ieee=new DataView(new ArrayBuffer(8));
 op(){
  if(++this.stats.rationalOperations>STATIONARY_LIMITS.rationalOperations)
   throw new Stop('RESOURCE_LIMIT','rational work limit');
 }
 tick(){
  if(++this.stats.integerOperations>STATIONARY_LIMITS.integerOperations)
   throw new Stop('RESOURCE_LIMIT','integer work limit');
 }
 check(n:bigint){
  const h=(n<0n?-n:n).toString(16),c=h.charCodeAt(0);
  const bits=4*(h.length-1)+(c<=49?1:c<=51?2:c<=55?3:4);
  this.stats.peakIntegerBits=Math.max(this.stats.peakIntegerBits,bits);
  need(bits<=STATIONARY_LIMITS.integerBits,'RESOURCE_LIMIT','integer bit limit');
  return n;
 }
 addI(a:bigint,b:bigint){this.tick();return this.check(a+b);}
 mulI(a:bigint,b:bigint){this.tick();return this.check(a*b);}
 divI(a:bigint,b:bigint){this.tick();need(b!==0n,'NUMERIC_LIMIT','zero integer divisor');return this.check(a/b);}
 modI(a:bigint,b:bigint){this.tick();need(b!==0n,'NUMERIC_LIMIT','zero integer divisor');return this.check(a%b);}
 negI(a:bigint){this.tick();return this.check(-a);}
 shift(a:bigint,b:number){this.tick();return this.check(a<<BigInt(b));}
 private normalized(n:bigint,d:bigint):Q{
  this.check(n);
  this.check(d);
  need(d!==0n,'NUMERIC_LIMIT','zero rational denominator');
  if(n===0n)return ZERO;
  if(d<0n){n=this.negI(n);d=this.negI(d);}
  let a=n<0n?this.negI(n):n,b=d;
  while(b!==0n){
   const t=this.modI(a,b);
   a=b;
   b=t;
  }
  return {n:this.divI(n,a),d:this.divI(d,a)};
 }
 make(n:bigint,d=1n){this.op();return this.normalized(n,d);}
 from(value:number):Q{
  this.op();
  need(Number.isFinite(value),'INVALID_INPUT','nonfinite exact operand');
  this.ieee.setFloat64(0,value,false);
  const bits=this.ieee.getBigUint64(0,false),e=Number((bits>>52n)&2047n);
  const f=bits&((1n<<52n)-1n),s=e===0?f:f+(1n<<52n);
  const p=e===0?-1074:e-1075,n=(bits>>63n)!==0n?-s:s;
  return p>=0?this.normalized(this.shift(n,p),1n):this.normalized(n,this.shift(1n,-p));
 }
 add(a:Q,b:Q){this.op();return this.normalized(this.addI(this.mulI(a.n,b.d),this.mulI(b.n,a.d)),this.mulI(a.d,b.d));}
 neg(a:Q):Q{this.op();return a.n===0n?ZERO:{n:this.negI(a.n),d:a.d};}
 sub(a:Q,b:Q){return this.add(a,this.neg(b));}
 mul(a:Q,b:Q){this.op();return this.normalized(this.mulI(a.n,b.n),this.mulI(a.d,b.d));}
 div(a:Q,b:Q){this.op();return this.normalized(this.mulI(a.n,b.d),this.mulI(a.d,b.n));}
 number(a:Q):number{
  this.op();
  if(a.n===0n)return 0;
  const negative=a.n<0n,n=negative?this.negI(a.n):a.n,d=a.d;
  let e=n.toString(2).length-d.toString(2).length;
  if(e>=0?n<this.shift(d,e):this.shift(n,-e)<d)e--;
  const unit=Math.max(-1074,e-52);
  const nn=unit<0?this.shift(n,-unit):n,dd=unit>0?this.shift(d,unit):d;
  let q=this.divI(nn,dd);
  const rem=this.modI(nn,dd),twice=this.shift(rem,1);
  if(twice>dd||twice===dd&&(q&1n)!==0n)q=this.addI(q,1n);
  const out=Number(q)*Math.pow(2,unit);
  need(Number.isFinite(out),'NUMERIC_LIMIT','rounded impulse overflow');
  return negative?-out:out;
 }
}
const ratio=(q:Q):Ratio=>({n:q.n.toString(),d:q.d.toString()});
const same=(a:Q,b:Q)=>a.n===b.n&&a.d===b.d;
function word(n:number){const d=new DataView(new ArrayBuffer(8));d.setFloat64(0,n,false);return d.getBigUint64(0,false).toString(16).padStart(16,'0');}
function data(input:unknown,depth=0,meter={nodes:0}):unknown{
 need(++meter.nodes<=8192&&depth<=12,'INVALID_INPUT','input size or depth');
 if(input===null||typeof input==='string'||typeof input==='boolean'||typeof input==='number'&&Number.isFinite(input))return input;
 need(input&&typeof input==='object','INVALID_INPUT','finite plain data required');
 const ds=Object.getOwnPropertyDescriptors(input),keys=Reflect.ownKeys(input),array=Array.isArray(input);
 need(Object.getPrototypeOf(input)===(array?Array.prototype:Object.prototype),'INVALID_INPUT','plain data required');
 if(array){
  need(input.length<=64&&keys.length===input.length+1,'INVALID_INPUT','dense bounded array');
  return Array.from({length:input.length},(_,i)=>{
   need(ds[i]?.enumerable&&'value'in ds[i],'INVALID_INPUT','dense data array');
   return data(ds[i].value,depth+1,meter);
  });
 }
 need(keys.length<=12&&keys.every(k=>typeof k==='string'&&ds[k].enumerable&&'value'in ds[k]),'INVALID_INPUT','data fields required');
 return Object.fromEntries((keys as string[]).map(k=>[k,data(ds[k].value,depth+1,meter)]));
}
function fields(value:unknown,keys:string[]):Record<string,unknown>{
 need(value!==null&&typeof value==='object'&&!Array.isArray(value),'INVALID_INPUT','record required');
 const o=value as Record<string,unknown>;
 need(Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k)),'INVALID_INPUT','exact fields required');
 return o;
}
function vec(value:unknown,n=3,bound=10000):number[]{
 need(Array.isArray(value)&&value.length===n&&value.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=bound),'INVALID_INPUT','finite bounded vector required');
 return value;
}
function coefficients(body:NormalBody,p:NormalProblem['points'][number],sign:number):Six{
 const r=p.pointM.map((x,i)=>x-body.positionM[i]);
 need(r.every(x=>Number.isFinite(x)&&Math.abs(x)<=10),'UNSUPPORTED_PROFILE','contact arm bound');
 const n=p.normalAtoB;
 const t=[r[1]*n[2]-r[2]*n[1],r[2]*n[0]-r[0]*n[2],r[0]*n[1]-r[1]*n[0]];
 return [...n.map(x=>sign*x),...t.map(x=>sign*x)] as Six;
}
function det(m:Exact,c:V[]):Q{
 return m.add(
  m.sub(
   m.mul(c[0][0],m.sub(m.mul(c[1][1],c[2][2]),m.mul(c[1][2],c[2][1]))),
   m.mul(c[1][0],m.sub(m.mul(c[0][1],c[2][2]),m.mul(c[0][2],c[2][1])))
  ),
  m.mul(c[2][0],m.sub(m.mul(c[0][1],c[1][2]),m.mul(c[0][2],c[1][1])))
 );
}
function triangle(m:Exact,columns:V[],rhs:V):Q[]|null{
 if(rhs.every(q=>q.n===0n))return [ZERO,ZERO,ZERO,ZERO];
 for(const ids of [[0,1,2],[0,1,3],[0,2,3],[1,2,3]]){
  need(++m.stats.triangleTrials<=STATIONARY_LIMITS.triangleTrials,'RESOURCE_LIMIT','triangle work limit');
  const c=ids.map(i=>columns[i]),d=det(m,c);
  if(d.n===0n)continue;
  const values=c.map((_,j)=>m.div(det(m,c.map((v,k)=>k===j?rhs:v)),d));
  if(values.some(v=>v.n<0n))continue;
  const out=[ZERO,ZERO,ZERO,ZERO];
  ids.forEach((id,j)=>out[id]=values[j]);
  return out;
 }
 return null;
}
interface Row {a:number;b:number;ca:Six;cb:Six;qa:Q[];qb:Q[]}
interface Edge {lower:number;upper:number;rows:number[]}
function solveCore(raw:NormalProblem,count:1|2|8):StationaryResult{
 const m=new Exact();
 let input:NormalProblem|null=null;
 try{
  const root=fields(data(raw),['bodies','points']);
  need(Array.isArray(root.bodies)&&Array.isArray(root.points),'INVALID_INPUT','body and point lists required');
  need(root.bodies.length===count+1&&root.points.length===4*count,'UNSUPPORTED_PROFILE','stationary population');
  input=root as unknown as NormalProblem;
  const ids=new Map<string,number>();let floor=-1,dynamics=0;
  for(const [i,b]of input.bodies.entries()){
   fields(b,['id','positionM','velocityMps','angularVelocityRadps','inverseMass','inverseInertiaWorld']);
   need(typeof b.id==='string'&&/^[A-Za-z][A-Za-z0-9._:-]{0,63}$/.test(b.id)&&!ids.has(b.id),'INVALID_INPUT','body identity');
   ids.set(b.id,i);
   vec(b.positionM);
   vec(b.velocityMps,3,1000);
   vec(b.angularVelocityRadps,3,1000);
   need(Array.isArray(b.inverseInertiaWorld)&&b.inverseInertiaWorld.length===3,'INVALID_INPUT','inertia matrix');
   b.inverseInertiaWorld.forEach(x=>vec(x,3,1000000));
   const fixed=b.inverseMass===0;
   need(fixed||b.inverseMass===1,'UNSUPPORTED_PROFILE','unit dynamic mass');
   need(b.inverseInertiaWorld.every((r,i)=>r.every((v,j)=>v===(fixed?0:i===j?24:0))),'UNSUPPORTED_PROFILE','isotropic24 inertia');
   need(b.angularVelocityRadps.every(x=>x===0)&&b.velocityMps[0]===0&&b.velocityMps[2]===0&&b.velocityMps[1]<=0&&-b.velocityMps[1]<=1,'UNSUPPORTED_PROFILE','stationary free motion');
   if(fixed){
    need(floor===-1&&b.velocityMps[1]===0,'UNSUPPORTED_PROFILE','one fixed floor');
    floor=i;
   }else dynamics++;
  }
  need(floor>=0&&dynamics===count,'UNSUPPORTED_PROFILE','one floor and complete dynamics');
  const seen=new Set<string>(),rows:Row[]=[],edges=new Map<string,Edge>();
  for(const [index,p]of input.points.entries()){
   fields(p,['id','aId','bId','pointM','normalAtoB']);
   need(typeof p.id==='string'&&p.id.length>0&&p.id.length<=4096&&!seen.has(p.id)&&ids.has(p.aId)&&ids.has(p.bId)&&p.aId!==p.bId,'INVALID_INPUT','point identity');
   seen.add(p.id);
   vec(p.pointM);
   vec(p.normalAtoB,3,1);
   need(p.normalAtoB[0]===0&&p.normalAtoB[2]===0&&Math.abs(p.normalAtoB[1])===1,'UNSUPPORTED_PROFILE','exact vertical normal');
   const a=ids.get(p.aId)!,b=ids.get(p.bId)!;
   const ca=coefficients(input.bodies[a],p,-1),cb=coefficients(input.bodies[b],p,1);
   need([ca,cb].every(c=>c[0]===0&&c[2]===0&&c[4]===0),'UNSUPPORTED_PROFILE','other Jacobian dofs must be zero');
   rows.push({a,b,ca,cb,qa:ca.map(x=>m.from(x)),qb:cb.map(x=>m.from(x))});
   const lower=ca[1]===-1?a:b,upper=lower===a?b:a,key=lower+'\0'+upper;
   let edge=edges.get(key);
   if(!edge){edge={lower,upper,rows:[]};edges.set(key,edge);}
   edge.rows.push(index);
  }
  need(edges.size===count&&[...edges.values()].every(e=>e.rows.length===4),'UNSUPPORTED_PROFILE','four points per chain interface');
  const above=new Map<number,Edge>(),below=new Map<number,Edge>();
  for(const e of edges.values()){
   need(!above.has(e.lower)&&!below.has(e.upper)&&e.upper!==floor,'UNSUPPORTED_PROFILE','unbranched directed chain');
   above.set(e.lower,e);
   below.set(e.upper,e);
  }
  const chain=[floor];
  while(above.has(chain[chain.length-1])){
   const next=above.get(chain[chain.length-1])!.upper;
   need(!chain.includes(next),'UNSUPPORTED_PROFILE','acyclic chain');
   chain.push(next);
  }
  need(chain.length===count+1,'UNSUPPORTED_PROFILE','connected floor-to-top chain');
  const incoming:V[]=input.bodies.map(()=>[ZERO,ZERO,ZERO]),lambda:Q[]=rows.map(()=>ZERO);
  for(let k=chain.length-1;k>0;k--){
   const body=chain[k],edge=below.get(body)!;
   const rhs:V=[
    m.sub(m.neg(m.from(input.bodies[body].velocityMps[1])),incoming[body][0]),
    m.neg(incoming[body][1]),m.neg(incoming[body][2])
   ];
   const columns=edge.rows.map(i=>{
    const row=rows[i],c=row.a===body?row.qa:row.qb;
    return [c[1],c[3],c[5]] as V;
   });
   const chosen=triangle(m,columns,rhs);
   need(chosen,'NO_WITNESS','greedy support triangle not found');
   for(let j=0;j<4;j++){
    const index=edge.rows[j],row=rows[index],q=chosen[j],c=row.a===edge.lower?row.qa:row.qb;
    lambda[index]=q;
    for(let d=0;d<3;d++)incoming[edge.lower][d]=m.add(incoming[edge.lower][d],m.mul(c[[1,3,5][d]],q));
   }
   m.stats.interfacesProcessed++;
  }
  const balances=input.bodies.map(b=>[...b.velocityMps.map(x=>m.from(x)),ZERO,ZERO,ZERO]);
  for(let i=0;i<rows.length;i++){
   need(lambda[i].n>=0n,'NUMERIC_LIMIT','negative exact multiplier');
   for(const [body,c]of [[rows[i].a,rows[i].qa],[rows[i].b,rows[i].qb]] as const){
    if(body===floor)continue;
    for(let d=0;d<6;d++)balances[body][d]=m.add(balances[body][d],m.mul(c[d],lambda[i]));
   }
  }
  for(let i=0;i<input.bodies.length;i++){
   if(i!==floor)need(balances[i].every(q=>q.n===0n),'NUMERIC_LIMIT','global exact stationarity failed');
  }
  // All48 dynamic after components are now proved zero, so every original row
  // has primal0 and lambda*primal0. No point is omitted from this check.
  for(const row of rows){
   let primal=ZERO;
   for(let d=0;d<6;d++)primal=m.add(primal,m.add(m.mul(row.qa[d],ZERO),m.mul(row.qb[d],ZERO)));
   need(primal.n===0n,'NUMERIC_LIMIT','global exact primal failed');
  }
  const rounded=lambda.map(q=>m.number(q));
  const bodies=input.bodies.map((b,i)=>({
   ...b,positionM:[...b.positionM] as [number,number,number],
   velocityMps:(i===floor?[...b.velocityMps]:[0,0,0]) as [number,number,number],
   angularVelocityRadps:(i===floor?[...b.angularVelocityRadps]:[0,0,0]) as [number,number,number],
   inverseInertiaWorld:b.inverseInertiaWorld.map(r=>[...r]) as unknown as NormalBody['inverseInertiaWorld']
  }));
  const applied=input.bodies.map(()=>[0,0,0,0,0,0]);
  for(let i=0;i<rows.length;i++){
   for(const [body,c]of [[rows[i].a,rows[i].ca],[rows[i].b,rows[i].cb]] as const){
    for(let d=0;d<6;d++)applied[body][d]+=c[d]*rounded[i];
   }
  }
  let v=0,w=0,stationarity=0;
  for(const [i,b]of input.bodies.entries())if(i!==floor){
   for(let d=0;d<3;d++){
    const dv=b.velocityMps[d]+applied[i][d],dw=24*applied[i][d+3];
    v=Math.max(v,Math.abs(dv));
    w=Math.max(w,Math.abs(dw));
    stationarity=Math.max(stationarity,Math.abs(dv),Math.abs(dw)/Math.sqrt(24));
   }
  }
  need([v,w,stationarity,...rounded].every(Number.isFinite),'NUMERIC_LIMIT','nonfinite rounded diagnostic');
  return {
   ok:true,status:'SOLVED_STATIONARY_WITNESS',reason:null,bodies,normalImpulsesNs:rounded,
   exactApplied:{
    format:'STATIONARY_FLOAT_J_RATIOS_V1',
    points:input.points.map((p,i)=>({
     id:p.id,
     a:{bodyId:p.aId,coefficients:rows[i].ca,words:rows[i].ca.map(word)},
     b:{bodyId:p.bId,coefficients:rows[i].cb,words:rows[i].cb.map(word)},
     lambda:ratio(lambda[i]),roundedWord:word(rounded[i])
    })),
    dynamicResiduals:input.bodies.flatMap((b,i)=>i===floor?[]:[{bodyId:b.id,values:balances[i].map(ratio)}]),
    allRowsPrimalZero:true,allRowsComplementarityZero:true,nonnegative:true
   },
   roundedReconstruction:{maxVelocityErrorMps:v,maxAngularVelocityErrorRadps:w,maxUnscaledMassWeightedResidualSqrtJ:stationarity},
   stats:{...m.stats}
  };
 }catch(e){
  if(!(e instanceof Stop))throw e;
  return {
   ok:false,status:e.status,reason:e.message,bodies:input?.bodies??[],
   normalImpulsesNs:null,exactApplied:null,roundedReconstruction:null,stats:{...m.stats}
  };
 }
}
/** Sole production entry: no bridge or public World imports this candidate yet. */
export function solveStationaryNormal(problem:NormalProblem):StationaryResult{return solveCore(problem,8);}
