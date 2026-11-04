// D541: controlled NON_UI authoring. Root owns all gated execution.
import {inspectorSource} from './bracket-baseline-oracles.mjs';
export const seedText=JSON.stringify({format:'barocss-cad-model',schema:3,units:'mm',parameters:{},nodes:[],outputs:{},nextId:0});
const marker='\nconst inputFile=';
if(!inspectorSource.includes(marker))throw Error('retained inspector CLI boundary changed');
const observer=inspectorSource.slice(0,inspectorSource.indexOf(marker));
const displayStart=observer.indexOf('  const selected=snapshot.outputs.findIndex'),displayEnd=observer.indexOf('  result.outputIds=');
if(displayStart<0||displayEnd<=displayStart)throw Error('retained diagnostic display boundary changed');
// B01's front-bottom line does not exist on this part. Actual top/rim pointer
// mappings are captured separately below from their original native prefixes.
const admissionObserver=observer.slice(0,displayStart)+"  result.display={status:'NOT_REQUESTED_CONTROLLED_NATIVE_ADMISSION',reason:'B01 line mapper is outside this round profile; actual prefix top/rim mappings captured separately'};\n"+observer.slice(displayEnd);
// Bundle stdin from apps/cad-studio. CLI: PREFLIGHT FRESH_/tmp/barocss-d541-..._DIR.
// Uses the unchanged original observer. No retry or replacement geometry exists.
export const preflightSource=admissionObserver+String.raw`
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {emptyDoc,withNode,type StudioDoc} from '../../packages/barocss-cad-model/src/engine/doc.ts';
import {editFields} from '../../packages/barocss-cad-model/src/app/editFields.ts';
import {captureSignatures} from '../../packages/barocss-cad-model/src/engine/references.ts';
import type {BodyResult} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const out=resolve(process.argv[2]??'');assert.ok(out.startsWith('/tmp/barocss-d541-')&&!existsSync(out),'fresh owned output directory');mkdirSync(out);
const save=(name:string,v:any)=>writeFileSync(join(out,name),typeof v==='string'?v:JSON.stringify(v,null,2));
const report:any={status:'RUNNING',authority:'CONTROLLED_NON_UI_WITHNODE_SOURCE_PUBLIC_DISTANCE_SETTER_CURRENT_NATIVE_ADMISSION',independentPython:'NOT_RUN',actualStudio:'NOT_RUN',rows:[],references:null,budgets:{volumeRelative:1e-9,centroidBoundsCoordinateMM:1e-9,density1MassAbsoluteG:1e-9},limits:['Only flangeR20,z0..6 plus shaftR10,z5..30/40, positive1mm overlap, Union, central ThroughR3 and outer top FilletR1.','Controlled source has no Cylinder .made metadata; actual public producer metadata and later dropStaleMade are separate.','Current product checks and literal formula comparisons are admission observations, not independent Python or GUI/history/project qualification.','No general Boolean/finish theorem, new cone/fitter/thicken profile, catalog/material/manufacturing/mobile/exchange/release claim.']};
let phase='emptyDoc',topName:string,rimNames:string[],anchors:any;
const persist=()=>save('receipt.json',report);
const near=(a:number,b:number,label:string,t=1e-9)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,label+': '+a+' != '+b+' budget '+t);
const vector=(a:number[],b:number[],label:string,t=1e-9)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i],label+'['+i+']',t));};
const finite=(x:any):boolean=>typeof x==='number'?Number.isFinite(x):Array.isArray(x)?x.every(finite):x&&typeof x==='object'?Object.values(x).every(finite):true;
function target(H:number,stage:string){
 const one=(volume:number,mz:number,bounds:any)=>({volume,mass:volume/1000,centroid:[0,0,mz/volume],bounds});
 const flange=one(2400*Math.PI,7200*Math.PI,{min:[-20,-20,0],max:[20,20,6]});
 if(stage==='flange')return {n1:flange};
 if(stage==='shaftNew')return {n1:flange,n3:one(100*(H-5)*Math.PI,50*(H*H-25)*Math.PI,{min:[-10,-10,5],max:[10,10,H]})};
 const holed=stage==='hole'||stage==='finish',finished=stage==='finish',D=2*Math.PI*(9*(1-Math.PI/4)+1/6);
 const V=Math.PI*(1800+(holed?91:100)*H)-(finished?D:0),Mz=Math.PI*(5400+(holed?45.5:50)*H*H)-(finished?(H-1)*D+13*Math.PI/4:0);
 return {['n'+(stage==='union'?4:stage==='hole'?5:6)]:one(V,Mz,{min:[-20,-20,0],max:[20,20,H]})};
}
function source(doc:StudioDoc,H:number,stage:string){
 const nodes:any[]=[{kind:'sketch',profile:'circle',center:[0,0],radius:20,id:'n0'},{kind:'extrude',sketch:0,height:6,id:'n1'}];
 if(stage!=='flange')nodes.push({kind:'sketch',profile:'circle',center:[0,0],radius:10,id:'n2'},{kind:'extrude',sketch:2,height:H-5,from:5,id:'n3'});
 if(['union','hole','finish'].includes(stage))nodes.push({kind:'union',left:{node:1,side:'solid'},right:{node:3,side:'solid'},id:'n4'});
 if(['hole','finish'].includes(stage))nodes.push({kind:'hole',parent:{node:4,side:'solid'},radius:3,center:[0,0],face:topName,id:'n5'});
 if(stage==='finish')nodes.push({kind:'fillet',parent:{node:5,side:'solid'},edges:rimNames,radius:1,id:'n6',sigs:anchors});
 const outputs=stage==='shaftNew'?{b1:{node:1,side:'solid'},b3:{node:3,side:'solid'}}:{['b'+(nodes.length-1)]:{node:nodes.length-1,side:'solid'}};
 assert.deepEqual(doc,{format:'barocss-cad-model',schema:3,units:'mm',parameters:{},nodes,outputs,nextId:nodes.length},'exact declared controlled source/DAG/references/ownership');
}
function observe(label:string,doc:StudioDoc,parameters:any){
 phase=label;const text=JSON.stringify(doc);save(label+'-actual.bcad',text);
 const read=inspect(doc,{label,parameters});save(label+'-native-before-assert.json',read);
 report.rows.push({label,status:'CAPTURED',packet:label+'-native-before-assert.json',documentSHA256:read.documentSHA256,outputs:read.outputs.map((o:any)=>({outputId:o.outputId,bodyKey:o.bodyKey,nativeBRepSHA256:o.nativeBRepSHA256}))});persist();return read;
}
function qualify(label:string,doc:StudioDoc,H:number,stage:string){
 const read=observe(label,doc,{height:H,shaftDistance:H-5,stage});assert.equal(read.ok,true,JSON.stringify(read.error));assert.equal(read.inputUnchanged,true);source(doc,H,stage);assert.deepEqual(read.reader,{doc,notes:[]});
 const expected=target(H,stage);assert.deepEqual(read.outputs.map((o:any)=>o.outputId).sort(),Object.keys(expected).sort(),'all live original outputs');const errors:any[]=[];
 for(const raw of read.outputs){const e=(expected as any)[raw.outputId];assert.equal(raw.bodyKey,'b'+raw.outputId.slice(1));assert.equal(raw.nativeBodyCount,1);assert.equal(raw.brep.bodies.length,1);assert.equal(raw.brep.bodies[0].kind,'solid');assert.equal(raw.brep.shells.length,1);assert.ok(raw.brep.shells[0].closed);assert.ok(finite(raw.brep));assert.equal(sha(raw.nativeBRepJSON),raw.nativeBRepSHA256);assert.deepEqual(JSON.parse(raw.nativeBRepJSON),raw.brep);
  for(const name of ['default','strict','output']){const c=raw.productChecks[name];assert.equal(c.valid,true,JSON.stringify(c));assert.deepEqual(c.issues,[]);assert.equal(c.topology.length,1);assert.equal(c.topology[0].genus,['hole','finish'].includes(stage)?1:0);}
  const er:any={owner:raw.outputId};for(const method of ['massProperties','brepMass']){const m=raw[method];assert.ok(['closed-form','planar-exact','quadrature'].includes(m.method),'native nonmesh mass method');near(m.volume,e.volume,method+' literal-profile volume',1e-9*e.volume);near(m.mass,e.mass,method+' density1 grams');vector(m.centroid,e.centroid,method+' centroid');er[method]={volumeRelative:Math.abs(m.volume-e.volume)/e.volume,massAbsoluteG:Math.abs(m.mass-e.mass),centroidAbsoluteMM:Math.max(...m.centroid.map((v:number,i:number)=>Math.abs(v-e.centroid[i])))};}
  vector(raw.bounds.min,e.bounds.min,'native material bounds min');vector(raw.bounds.max,e.bounds.max,'native material bounds max');errors.push(er);
 }
 Object.assign(report.rows[report.rows.length-1],{status:'PASS_CONTROLLED_SOURCE_NATIVE_LITERAL_TARGET',parameters:{height:H,shaftDistance:H-5},stage,expected,errors});persist();return read;
}
function circleEdges(raw:any,H:number,radius:number){return raw.edgeProbes.filter((e:any)=>e.degree>1&&e.probe?.samples?.length===9&&e.probe.samples.every((p:number[])=>Math.abs(p[2]-H)<=1e-9&&Math.abs(Math.hypot(p[0],p[1])-radius)<=1e-9));}
function completeCircle(edges:any[],H:number,radius:number,label:string){
 assert.ok(edges.length>0,label+' original arcs');const intervals:number[][]=[];
 for(const e of edges){assert.ok(typeof e.name==='string'&&e.name.length>0);const ps=e.probe.samples,angles=ps.map((p:number[])=>Math.atan2(p[1],p[0]));const turns=angles.slice(1).map((a:number,i:number)=>Math.atan2(Math.sin(a-angles[i]),Math.cos(a-angles[i])));assert.ok(turns.every((a:number)=>Math.abs(a)<Math.PI));const sweep=turns.reduce((a:number,b:number)=>a+b,0);assert.ok(Math.abs(sweep)>0);const start=(sweep>0?angles[0]:angles[angles.length-1]),a=(start%(2*Math.PI)+2*Math.PI)%(2*Math.PI),z=a+Math.abs(sweep);
  if(z<=2*Math.PI+1e-9)intervals.push([a,Math.min(z,2*Math.PI)]);else intervals.push([a,2*Math.PI],[0,z-2*Math.PI]);
 }let end=0;for(const [a,z]of intervals.sort((a,b)=>a[0]-b[0])){assert.ok(a<=end+1e-9/radius,label+' no angular gap');end=Math.max(end,z);}near(end,2*Math.PI,label+' complete original circular rim',1e-9/radius);return {heightMM:H,radiusMM:radius,nativeEdges:edges,intervals};
}
function topReference(read:any,H:number){
 const raw=read.outputs[0],matches=raw.surfaces.filter((f:any)=>{const g=f.geometry;return g.kind==='plane'&&Math.abs(g.o[2]-H)<=1e-9&&Math.abs(g.n[0])<=1e-9&&Math.abs(g.n[1])<=1e-9&&Math.abs(g.n[2]-1)<=1e-9;});save(phase+'-top-candidates.json',matches);assert.equal(matches.length,1,'one original upward shaft cap');const f=raw.brep.faces.find((f:any)=>f.id===matches[0].id);assert.ok(f&&typeof f.name==='string'&&f.name.length>0);assert.equal(f.loops.length,1,'unholed actual circular cap');
 const loop=raw.brep.loops.find((l:any)=>l.id===f.loops[0]),co=new Map(raw.brep.coedges.map((c:any)=>[c.id,c])),ids=loop.coedges.map((id:string)=>(co.get(id)as any).edge),arcs=circleEdges(raw,H,10);assert.deepEqual([...new Set(ids)].sort(),arcs.map((e:any)=>e.id).sort(),'entire actual cap boundary is declared R10 circle');return {name:f.name,face:f,geometry:matches[0].geometry,rim:completeCircle(arcs,H,10,'Union top'),authority:'ORIGINAL_UNION_NATIVE_PREFIX_BEFORE_HOLE'};
}
function field(doc:StudioDoc,value:number,label:string){
 const before=JSON.stringify(doc),f=editFields(doc.nodes,3,doc.parameters).find(f=>f.key==='h');assert.ok(f&&f.kind==='number'&&f.label==='Distance','existing shaft Extrude Distance field');const next={...doc,nodes:f.set(doc.nodes,value)};save(label+'-public-field-before-assert.json',{index:3,key:'h',label:f.label,value,beforeDoc:doc,candidate:next});assert.equal(JSON.stringify(doc),before,'setter leaves accepted source unchanged');return next;
}
try{
 const seed=emptyDoc();save('empty-source.bcad',JSON.stringify(seed));assert.equal(JSON.stringify(seed),${JSON.stringify(seedText)});report.seed={role:'CONTROLLED_EMPTY_DOC_LITERAL',documentSHA256:sha(JSON.stringify(seed)),bytes:Buffer.byteLength(JSON.stringify(seed))};persist();
 let flange=withNode(seed,{kind:'sketch',profile:'circle',center:[0,0],radius:20});flange=withNode(flange,{kind:'extrude',sketch:0,height:6});qualify('01-flange',flange,30,'flange');
 let shaft=withNode(flange,{kind:'sketch',profile:'circle',center:[0,0],radius:10});shaft=withNode(shaft,{kind:'extrude',sketch:2,height:25,from:5});qualify('02-shaft-New-two-live-outputs',shaft,30,'shaftNew');
 const union=withNode(shaft,{kind:'union',left:{node:1,side:'solid'},right:{node:3,side:'solid'}}),joined=qualify('03-Union-positive-1mm-overlap',union,30,'union'),top=topReference(joined,30);topName=top.name;save('03-original-top-reference.json',top);
 const holes=withNode(union,{kind:'hole',parent:{node:4,side:'solid'},radius:3,center:[0,0],face:topName}),drilled=qualify('04-central-Through-R3',holes,30,'hole'),raw=drilled.outputs[0],outer=circleEdges(raw,30,10);const rim=completeCircle(outer,30,10,'Hole outer shaft top');
 const mesh=bodyMesh(raw.brep,0,8),originalNames=[...new Set(outer.map((e:any)=>e.name))]as string[],mapped=mesh.edges.filter((e:any)=>!e.straight&&e.names.length===originalNames.length&&e.names.every((n:string)=>originalNames.includes(n)));save('04-original-rim-and-display-candidates.json',{rim,originalNames,mapped,role:'bodyMesh maps original native names only; not physical authority'});assert.equal(mapped.length,1,'one real complete top-outer display rim');rimNames=[...mapped[0].names];assert.deepEqual([...rimNames].sort(),[...originalNames].sort(),'all selected names came from actual original outer rim');
 const unsigned=withNode(holes,{kind:'fillet',parent:{node:5,side:'solid'},edges:rimNames,radius:1}),body:BodyResult={key:raw.bodyKey,ref:{node:5,side:'solid'},family:raw.representation,mesh,volume:raw.massProperties.volume,mass:raw.massProperties.mass,centroid:raw.massProperties.centroid},A=captureSignatures(unsigned,[body]);anchors=(A.nodes[6]as any).sigs;save('05-current-helper-signatures-before-assert.json',{unsignedDoc:unsigned,signedDoc:A,nativeBRepSHA256:raw.nativeBRepSHA256,authority:'EXISTING_CAPTURE_SIGNATURES_ON_BODYMESH_OF_ORIGINAL_HOLE_PREFIX_QUALITY8'});assert.deepEqual(Object.keys(anchors??{}).sort(),[...rimNames].sort(),'actual helper signature for every selected native name');
 report.references={top,rim,displayMapping:mapped[0],filletNames:rimNames,filletSignatures:anchors,policy:'Keep original A signatures immutable across controlled B edit; no fabricated/omitted anchor.'};qualify('05-finish-A-H30',A,30,'finish');
 const B=field(A,35,'06-Distance25-to35'),expectedB=structuredClone(A);(expectedB.nodes[3]as any).height=35;assert.deepEqual(B,expectedB,'Distance changes only original shaft height');qualify('06-finish-B-H40',B,40,'finish');
 const before=JSON.stringify(B),invalid=field(B,0,'07-invalid-Distance0'),negative=observe('07-invalid-Distance0-native-refusal',invalid,{shaftDistance:0});assert.equal(negative.ok,false,'zero shaft Distance must refuse');assert.equal(negative.inputUnchanged,true);assert.ok(typeof negative.error?.code==='string'&&typeof negative.error?.message==='string','retain actual typed native refusal');assert.equal(JSON.stringify(B),before,'rejected controlled candidate does not mutate accepted B');Object.assign(report.rows[report.rows.length-1],{status:'PASS_EXPECTED_CONTROLLED_TYPED_NATIVE_REFUSAL',observedError:negative.error,actualGUIretention:'NOT_RUN'});
 report.status='PASS_CONTROLLED_NON_UI_FLANGED_SHAFT_ADMISSION_ONLY';report.classes={A:{shaftDistance:25,height:30},B:{shaftDistance:35,height:40}};report.overlap={contactOnly:false,axialRange:[5,6],volumeMM3:100*Math.PI};persist();console.log(JSON.stringify({status:report.status,out,rows:report.rows.map((r:any)=>({label:r.label,status:r.status})),references:{topName,rimNames},invalid:negative.error}));
}catch(cause){report.status='FAIL_CONTROLLED_FLANGED_SHAFT_ADMISSION';report.firstFailure={phase,...error(cause)};persist();console.log(JSON.stringify({status:report.status,out,firstFailure:report.firstFailure}));process.exitCode=1;}
`;
