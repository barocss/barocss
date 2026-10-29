import { writeFileSync } from 'node:fs';
import { directOps, directDisplay, emptyDirect, importSource, geometryOf, directIGES, importIGESFile, surfaceIntersection } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/direct.ts';
import { evaluateDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/evaluate.ts';
import { emptyDoc, withNode } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/doc.ts';
const out='/tmp/d336-probe';
const save=(name:string,value:unknown)=>writeFileSync(`${out}/${name}.json`,JSON.stringify(value,null,2));
const source=`@model d336 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }
 @curve #hole { type:nurbs; degree:1; knots:[0,0,1,2,3,4,4]; control-points:[[15,-1,3],[25,-1,3],[25,9,3],[15,9,3],[15,-1,3]]; weights:[1,1,1,1,1]; }
 @surface #wall { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[20,-8,-2],[20,-8,8]],[[20,26,-2],[20,26,8]]]; weights:[[1,1],[1,1]]; }
}`;
writeFileSync(`${out}/fixture.barocad`,source);
const imported=importSource(emptyDirect(),source,'D336');
const panel=imported.objects.find(o=>o.geometry==='panel')!.id;
const hole=imported.objects.find(o=>o.geometry==='hole')!.id;
const wall=imported.objects.find(o=>o.geometry==='wall')!.id;
const exactUV=[[-1,2],[1,2],[1,4],[-1,4]] as [number,number][];
const fixture={...imported,objects:imported.objects.map(o=>o.id===panel?{...o,trims:[{keep:'outside' as const,uv:exactUV}]}:{...o,hidden:true})};
const snapshot=JSON.stringify(fixture); save('fixture',fixture);
const error=(e:any)=>({name:e?.name,code:e?.code,message:e?.message,stack:e?.stack});
function moments(display:any){
 const p=display.positions, ix=display.indices; if(!ix)return null;
 let area=0; const moment=[0,0,0];
 for(let t=0;t<ix.length;t+=3){
  const a=[0,1,2].map(k=>p[3*ix[t]+k]),b=[0,1,2].map(k=>p[3*ix[t+1]+k]),c=[0,1,2].map(k=>p[3*ix[t+2]+k]);
  const v=b.map((n,k)=>n-a[k]),w=c.map((n,k)=>n-a[k]);
  const ar=Math.hypot(v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0])/2;
  area+=ar; for(let k=0;k<3;k++)moment[k]+=ar*(a[k]+b[k]+c[k])/3;
 }
 return {area,centroid:moment.map(m=>m/area),triangleCount:ix.length/3};
}
function state(d:any){
 const displays=directDisplay(d);
 return {objects:d.objects.map((o:any)=>({id:o.id,name:o.name,source:o.source,geometry:o.geometry,hidden:o.hidden??false,trims:o.trims??null})),
  visible:displays.map((g:any)=>({id:g.id,name:g.name,kind:g.kind,materialMesh:moments(g)}))};
}
let witness=withNode(emptyDoc(),{kind:'sketch',profile:'rectangle',min:[80,-3],max:[92,4]});
witness=withNode(witness,{kind:'extrude',sketch:0,height:5,from:1});
function witnessMass(d:any){const r=evaluateDoc({...witness,direct:d},1); return r.ok?{ok:true,bodies:r.bodies.map(b=>({key:b.key,volume:b.volume,centroid:b.centroid,bounds:b.mesh.bounds,faces:b.mesh.faces.map((f:any)=>f.name??f.names)}))}:{ok:false,error:r.error};}
const result:any={source:'1fb2d11e9e4713bac3bfbc1131fc45302aa558f3',probeKind:'immutable pre-fix own fixture programmatic source consumer',before:state(fixture),witnessBefore:witnessMass(fixture),cases:{},thickenStudioConsumer:{status:'NOT_PROVEN',reason:'No public Model command/facade for thicken is available. DirectInspector UI callback not invoked through private hooks; source guard chain is source evidence only.'}};
save('initial-state',result);
try{const made=directOps.trimByCurve(imported,panel,hole,'outside'); result.publicTrimProducer={status:'RETURNED',trimCount:made.objects.find(o=>o.id===panel)?.trims?.length,uvCount:made.objects.find(o=>o.id===panel)?.trims?.[0].uv.length,state:state({...made,objects:made.objects.map(o=>o.id===panel?o:{...o,hidden:true})})}; save('public-trim-producer',made);}catch(e){console.error('publicTrimProducer failure',e);result.publicTrimProducer={status:'REFUSED',error:error(e)};}
for(const [name,run] of [
 ['reverse',()=>directOps.reverseSurface(fixture,panel,'u')],
 ['split',()=>directOps.splitSurface(fixture,panel,'u',2)],
 ['region',()=>directOps.surfaceRegion(fixture,panel,[-1,3],[1.5,5.5])],
 ['extend',()=>directOps.extendSurface(fixture,panel,'u-max',5)],
] as const){
 console.log(`BEGIN ${name}`); const t=Date.now();
 try {const d=run(); save(`${name}-result`,d); const added=d.objects.filter(o=>!fixture.objects.some(q=>q.id===o.id)); result.cases[name]={status:'RETURNED',ms:Date.now()-t,originalRetained:!!d.objects.find(o=>o.id===panel&&o.trims?.length),originalHidden:d.objects.find(o=>o.id===panel)?.hidden??false,addedTrimCounts:added.map(o=>o.trims?.length??0),state:state(d),witness:witnessMass(d),inputUnchanged:JSON.stringify(fixture)===snapshot};}
 catch(e){console.error(`${name} failure`,e);result.cases[name]={status:'REFUSED',ms:Date.now()-t,error:error(e),inputUnchanged:JSON.stringify(fixture)===snapshot};}
 console.log(JSON.stringify({name,...result.cases[name]}));save('results-partial',result);
}
console.log('BEGIN iges');
try {const text=directIGES(fixture,'d336');writeFileSync(`${out}/trimmed-export.igs`,text); const reread=importIGESFile(emptyDirect(),text,'D336 roundtrip'); save('iges-reimport',reread); result.cases.iges={status:'RETURNED',bytes:Buffer.byteLength(text),directoryEntityTypes:[...new Set(text.split('\n').filter(l=>l[72]==='D').map(l=>Number(l.slice(0,8))))],reimport:state(reread.direct),inputUnchanged:JSON.stringify(fixture)===snapshot};}catch(e){console.error('iges failure',e);result.cases.iges={status:'REFUSED',error:error(e)};}
console.log(JSON.stringify({name:'iges',...result.cases.iges}));save('results-partial',result);
console.log('BEGIN intersection');
try {const x=surfaceIntersection(fixture,panel,wall);save('intersection-result',x); const curves=x.direct.objects.filter(o=>!fixture.objects.some(q=>q.id===o.id)).map(o=>({id:o.id,geometry:geometryOf(x.direct,o)}));
 const segments:any[]=[];for(const item of curves){const g:any=item.geometry;for(let i=1;i<g.controlPoints.length;i++){const a=g.controlPoints[i-1],b=g.controlPoints[i];const overlap=Math.max(0,Math.min(9,Math.max(a[1],b[1]))-Math.max(-1,Math.min(a[1],b[1]))); if(Math.abs(a[0]-20)<1e-6&&Math.abs(b[0]-20)<1e-6&&Math.abs(a[2]-3)<1e-6&&Math.abs(b[2]-3)<1e-6&&overlap>0)segments.push({a,b,voidOverlapY:overlap});}}
 result.cases.intersection={status:'RETURNED',count:x.count,curves,segmentsInsideRemovedHole:segments,voidOverlapY:segments.reduce((s,q)=>s+q.voidOverlapY,0),inputUnchanged:JSON.stringify(fixture)===snapshot};}catch(e){console.error('intersection failure',e);result.cases.intersection={status:'REFUSED',error:error(e)};}
console.log(JSON.stringify({name:'intersection',...result.cases.intersection}));
result.after=state(fixture);result.witnessAfter=witnessMass(fixture);result.inputUnchanged=JSON.stringify(fixture)===snapshot;
save('results',result);console.log('COMPLETE',JSON.stringify({cases:Object.fromEntries(Object.entries(result.cases).map(([k,v]:any)=>[k,v.status])),inputUnchanged:result.inputUnchanged}));
