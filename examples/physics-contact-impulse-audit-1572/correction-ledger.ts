import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig} from '../../packages/barocss-physics/src/types.js';
type E={step:number,pass:number,fallback:boolean,depth:number,normal:number[],aBefore:number[],bBefore:number[],aAfter:number[],bAfter:number[]};
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,m:'OFFSET'|'YAW'):PhysicsBodyConfig{const y=m==='YAW'?(i%2===0?.05:-.05):0;return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+i*.5,0],velocityMps:[0,0,0],massKg:1,orientation:[0,Math.sin(y/2),0,Math.cos(y/2)],restitution:0,friction:{static:1,dynamic:.7}};}
const h=globalThis as typeof globalThis&{__p1572Correction?:(e:E)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 const samples:unknown[]=[];let count=0,fallback=0,positiveNormalCorrection=0,maxCorrection=0;
 h.__p1572Correction=e=>{
  count++;if(e.fallback)fallback++;
  const a=e.aAfter.map((x,i)=>x-e.aBefore[i]);
  const b=e.bAfter.map((x,i)=>x-e.bBefore[i]);
  const normalShift=e.normal.reduce((v,n,i)=>v+n*(b[i]-a[i]),0);
  if(!Number.isFinite(normalShift)||normalShift< -1e-8)throw Error('CORRECTION_NEGATIVE_NORMAL');
  if(normalShift>0)positiveNormalCorrection++;
  maxCorrection=Math.max(maxCorrection,normalShift);
  if(e.step===600&&samples.length<8)samples.push({...e,relativeNormalPositionCorrectionM:normalShift});
 };
 const world=createPhysicsWorld({fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],contactMode:'persistent-box-v1',
 bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,failure:null|string=null;
 try{for(let k=1;k<=1200;k++){try{world.step(1/120);accepted=k;}catch(e){failure=String(e);break;}}}
 finally{world.dispose();delete h.__p1572Correction;}
 console.log(JSON.stringify({mode,accepted,failure,count,fallback,positiveNormalCorrection,maxCorrection,samples,
 scope:'pair-block position correction; compare across passes with historical separation ledgers; no production change'}));
 if(failure||count!==9600)process.exitCode=1;
}
