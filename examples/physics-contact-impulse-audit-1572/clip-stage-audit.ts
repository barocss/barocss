/** Test-only classification of actual b0/b1 polygon clip and separation stages.
 * Tracked Physics source stays unchanged; temporary esbuild graph instruments
 * the real manifold implementation. Original OFFSET/YAW floor + 3 boxes only.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type Event={step:number,pass:number,pair:string,stage:'clip'|'separation',stageIndex:number,
 before:number,after:number,rejected?:number};
const host=globalThis as typeof globalThis & {
 __p1572ClipContext?:{step:number,pass:number,pair:string};
 __p1572ClipProbe?:(event:Event)=>void;
};
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+.5*i,0],velocityMps:[0,0,0],massKg:1,orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
}
for(const mode of ['OFFSET','YAW'] as const){
 const totals={clipEmpty:[0,0,0,0],clipTransitions:[0,0,0,0],separationEmpty:0,
  separationRemoved:0,nonempty:0,firstEmpty:null as Event|null,events:0};
 const checkpoints:Event[]=[];
 host.__p1572ClipProbe=e=>{
  if(!host.__p1572ClipContext||e.step!==host.__p1572ClipContext.step||
     e.pass!==host.__p1572ClipContext.pass)throw Error('P1572_CLIP_PROBE_CONTEXT');
  if(e.stage==='clip'){
   totals.clipTransitions[e.stageIndex]++;
   if(e.before>0&&e.after===0){totals.clipEmpty[e.stageIndex]++;totals.firstEmpty??=e;}
  }else{
   totals.separationRemoved+=(e.rejected??0);
   if(e.before>0&&e.after===0){totals.separationEmpty++;totals.firstEmpty??=e;}
   if(e.after>0)totals.nonempty++;
  }
  totals.events++;
  if((e.step===1||e.step===600||e.step===1200)&&checkpoints.length<120)checkpoints.push(e);
 };
 const world=createPhysicsWorld({fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],
  contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,failure:string|null=null;
 try{for(let step=1;step<=1200;step++){try{world.step(1/120);accepted=step;}
  catch(e){failure=e instanceof Error?e.message:String(e);break;}}}
 finally{world.dispose();delete host.__p1572ClipProbe;delete host.__p1572ClipContext;}
 console.log(JSON.stringify({mode,accepted,failure,totals,checkpoints,
  interpretation:'exact temporary source observations of four clip planes and separation filter; no collision-law change',
  physicalEightBoxGO:false}));
 if(failure||accepted!==1200||totals.events===0)process.exitCode=1;
}
