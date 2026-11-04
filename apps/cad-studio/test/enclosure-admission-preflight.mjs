// D539 source preparation. Root bundles/runs this under the serial native gate.
// Typed withNode authoring is controlled NON_UI input, not a Studio creation proof.
export const seedSHA256 = '17351eb2ad01ffbafcf9c76d21e2da5030b794600ca80a55a41a0928fdbaf6c9';
export const seedPath = '/tmp/barocss-d449-category-run01/shell-edited.bcad';
export const seedText = JSON.stringify({format:'barocss-cad-model',schema:3,units:'mm',parameters:{},nodes:[
  {kind:'sketch',profile:'rectangle',min:[-20,-20],max:[60,20],outline:{points:[[-20,-20],[60,-20],[60,20],[-20,20]],lengths:{0:80,1:40},hv:{h:[0,2],v:[1,3]}},sideTags:{outer:['e1','e2','e3','e4']},id:'n0'},
  {kind:'extrude',sketch:0,height:10,id:'n1'},
  {kind:'shell',parent:{node:1,side:'solid'},thickness:3,open:['n1.top'],id:'n2',sigs:{'n1.top':{k:'plane',p:[20,0,10],d:[0,0,1],s:3200}}},
],outputs:{b2:{node:2,side:'solid'}},nextId:3});

// Bundle stdin with resolveDir apps/cad-studio, platform node, format esm.
// CLI: node preflight.mjs FRESH_/tmp/barocss-d539-..._DIRECTORY [ACTUAL_SEED_PATH]
// First failure is retained. No fallback geometry, changed budget or retry exists.
export const preflightSource = String.raw`
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {withNode,type StudioDoc,type ModelNode} from '../../packages/barocss-cad-model/src/engine/doc.ts';
import {readStudioDoc} from '../../packages/barocss-cad-model/src/engine/migrate.ts';
import {editFields} from '../../packages/barocss-cad-model/src/app/editFields.ts';
import {captureSignatures} from '../../packages/barocss-cad-model/src/engine/references.ts';
import {toPartDocument,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {bodyMesh} from '../../packages/barocss-cad-model/src/engine/mesh.ts';
import type {BodyResult} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {evaluateCadPart,massPropertiesOf,brepMassProperties,checkBrep,checkOutput,faceGeometry,curveDomain,curveEvaluator} from '../../packages/barocss-cad/src/index.ts';
import {stepValidationBounds} from '../../packages/barocss-cad/src/brep/brep-bounds.ts';
const seedPin='${seedSHA256}',seedLiteral=${JSON.stringify(seedText)},out=resolve(process.argv[2]??''),seedFile=process.argv[3]??'${seedPath}';
assert.ok(out.startsWith('/tmp/barocss-d539-')&&!existsSync(out),'fresh owned external output required');mkdirSync(out);
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const error=(e:any)=>({name:e?.name??null,code:e?.code??null,feature:e?.feature??null,message:String(e?.message??e)});
const safe=(fn:()=>any)=>{try{return fn();}catch(e){return {observationError:error(e)};}};
const save=(label:string,data:any)=>writeFileSync(join(out,label+'.json'),JSON.stringify(data,null,2));
const report:any={status:'RUNNING',authority:'CONTROLLED_NON_UI_AUTHORED_SOURCE_PUBLIC_FIELDS_CURRENT_NATIVE_ADMISSION',independentExternalOracle:'NOT_RUN',publicStudio:'NOT_RUN',sourceClosure:'ROOT_WRAPPER_MUST_PIN_EXECUTED_IMPORT_CLOSURE',rows:[],references:null,limits:{volumeRelative:1e-9,centroidBoundsCoordinateAbsoluteMM:1e-9,density1MassAbsoluteG:1e-9},notClaimed:['No actual Studio creation, measurement, refusal retention, Undo/Redo or persistence proof.','Only the selected Shell/rail/Hole-row/four outer R1 profile and finite W80/90 Wall2/3 Copies3/2 classes.','Product strict checks and finite original native observations are not an independent full-domain geometry theorem.','No general Boolean, freeform, fitter, public-thicken, manufacturing, mobile, exchange or release acceptance.']};
let phase='seed input';const persist=()=>save('receipt',report);
const near=(a:number,b:number,label:string,t=1e-9)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,label+': '+a+' != '+b+' budget '+t);
const vector=(a:readonly number[],b:readonly number[],label:string,t=1e-9)=>{assert.equal(a.length,b.length,label+' dimensions');a.forEach((v,i)=>near(v,b[i],label+'['+i+']',t));};
const finite=(v:any):boolean=>typeof v==='number'?Number.isFinite(v):Array.isArray(v)?v.every(finite):v&&typeof v==='object'?Object.values(v).every(finite):true;
let seed:StudioDoc,railFace:string,cornerNames:string[],finishSignatures:any;
function field(doc:StudioDoc,index:number,key:string,value:number,label:string):StudioDoc{
 const before=JSON.stringify(doc),f=editFields(doc.nodes,index,doc.parameters).find(f=>f.key===key);assert.ok(f&&f.kind==='number',label+' public numeric field exists');
 const next={...doc,nodes:f.set(doc.nodes,value)};save(label+'-field-before-assert',{beforeDoc:doc,beforeJSON:before,index,key,label:f.label,value,candidate:next,candidateJSON:JSON.stringify(next)});
 assert.equal(JSON.stringify(doc),before,label+' does not mutate source');return next;
}
function source(doc:StudioDoc,width:number,wall:number,count:number,stage:string){
 assert.equal(doc.format,'barocss-cad-model');assert.equal(doc.schema,3);assert.equal(doc.units,'mm');assert.deepEqual(doc.parameters,{});
 const lengths:any={baseShell:3,railNew:5,union:6,HoleRow:7,finish:8};assert.equal(doc.nodes.length,lengths[stage]);assert.equal(doc.nextId,doc.nodes.length);
 const stock:any=structuredClone(seed.nodes[0]);stock.max[0]=width-20;stock.outline.points[1][0]=width-20;stock.outline.points[2][0]=width-20;stock.outline.lengths[0]=width;
 assert.deepEqual(doc.nodes[0],stock,'compact stock/locked outline/HV/tags agree');assert.deepEqual(doc.nodes[1],seed.nodes[1],'primary Extrude10 unchanged');assert.deepEqual(doc.nodes[2],{...seed.nodes[2],thickness:wall},'actual Shell/opening/historical signature retained');
 if(doc.nodes.length>=5){assert.deepEqual(doc.nodes[3],{kind:'sketch',profile:'rectangle',min:[0,-3],max:[30,3],sideTags:{outer:['e1','e2','e3','e4']},id:'n3'});assert.deepEqual(doc.nodes[4],{kind:'extrude',sketch:3,height:5,from:1,id:'n4'});}
 if(doc.nodes.length>=6)assert.deepEqual(doc.nodes[5],{kind:'union',left:{node:2,side:'solid'},right:{node:4,side:'solid'},id:'n5'});
 if(doc.nodes.length>=7)assert.deepEqual(doc.nodes[6],{kind:'hole',parent:{node:5,side:'solid'},radius:1,center:[5,0],face:railFace,pattern:{count,step:[10,0]},id:'n6'});
 if(doc.nodes.length>=8)assert.deepEqual(doc.nodes[7],{kind:'fillet',parent:{node:6,side:'solid'},edges:cornerNames,radius:1,id:'n7',sigs:finishSignatures});
 const output=stage==='railNew'?{b2:{node:2,side:'solid'},b4:{node:4,side:'solid'}}:{['b'+(doc.nodes.length-1)]:{node:doc.nodes.length-1,side:'solid'}};
 assert.deepEqual(doc.outputs,output,'raw live output ownership');
}
function targets(width:number,wall:number,count:number,stage:string){
 const vc=(width-2*wall)*(40-2*wall)*(10-wall),S=400*width-vc,R=180*(6-wall),F=10*(4-Math.PI),Q=6*count*Math.PI;
 const shell={volume:S,moment:[(width/2-20)*S,0,2000*width-vc*(10+wall)/2],bounds:{min:[-20,-20,0],max:[width-20,20,10]}};
 const one=(volume:number,moment:number[],bounds=shell.bounds)=>({volume,massDensity1:volume/1000,centroid:moment.map(v=>v/volume),bounds});
 if(stage==='baseShell')return {n2:one(shell.volume,shell.moment)};
 if(stage==='railNew')return {n2:one(shell.volume,shell.moment),n4:one(900,[13500,0,3150],{min:[0,-3,1],max:[30,3,6]})};
 const withHoles=stage==='HoleRow'||stage==='finish',withFinish=stage==='finish',holeMx=withHoles?6*Math.PI*Array.from({length:count},(_,i)=>5+10*i).reduce((a,b)=>a+b,0):0;
 const volume=S+R-(withHoles?Q:0)-(withFinish?F:0),moment=[(width/2-20)*(S-(withFinish?F:0))+15*R-holeMx,0,shell.moment[2]+R*(wall+6)/2-(withHoles?3*Q:0)-(withFinish?5*F:0)];
 return {['n'+(stage==='union'?5:stage==='HoleRow'?6:7)]:one(volume,moment)};
}
function observe(label:string,doc:StudioDoc){
 phase=label;const documentJSON=JSON.stringify(doc),packet:any={label,authority:'ORIGINAL_RAW_MODEL_DOC_CURRENT_TO_PART_DOCUMENT',ok:false,documentJSON,documentSHA256:sha(documentJSON),outputs:[]};
 writeFileSync(join(out,label+'-actual.bcad'),documentJSON);let snapshot:any;
 try{
  packet.partDocument=toPartDocument(doc);snapshot=evaluateCadPart(packet.partDocument);
  // ALL original output graphs/bytes are retained before any selected assertion.
  for(const output of snapshot.outputs){const nativeBRepJSON=JSON.stringify(output.brep);packet.outputs.push({outputId:output.id,bodyKey:bodyKeyOf(output.id,doc.nodes),representation:output.representation,nativeBodyCount:output.bodyCount,brep:output.brep,nativeBRepJSON,nativeBRepSHA256:sha(nativeBRepJSON)});}
  save(label+'-native-raw-before-observations',packet);
  packet.reader=safe(()=>readStudioDoc(documentJSON));
  snapshot.outputs.forEach((output:any,i:number)=>{const raw=packet.outputs[i],b=output.brep,vertices=new Map(b.vertices.map((v:any)=>[v.id,v.point]));
   raw.massUnits={density:1,densityUnit:'g/cm3',volume:'mm3',mass:'g',centroid:'mm',authority:'massPropertiesOf/brepMassProperties MMGS'};
   raw.mass=safe(()=>massPropertiesOf(output,1));raw.brepMass=safe(()=>brepMassProperties(b,1));raw.bounds=safe(()=>stepValidationBounds(b));raw.productChecks={authority:'PRODUCT_OBSERVATIONS_NOT_INDEPENDENT_ORACLE',default:safe(()=>checkBrep(b)),strict:safe(()=>checkBrep(b,{strict:true})),output:safe(()=>checkOutput(output))};
   raw.faces=b.faces.map((f:any)=>({id:f.id,name:f.name,sense:f.sense,loops:f.loops,geometry:safe(()=>faceGeometry(f))}));
   raw.edges=b.edges.map((e:any)=>({id:e.id,name:e.name,curve:e.curve,endpoints:e.vertices.map((v:string)=>vertices.get(v)),probe:safe(()=>{const[a,z]=curveDomain(e.curve),at=curveEvaluator(e.curve);return {domain:[a,z],samples:[0,.25,.5,.75,1].map(t=>at(a+(z-a)*t))};})}));
  });packet.ok=true;
 }catch(cause){packet.error=error(cause);}
 packet.inputUnchanged=JSON.stringify(doc)===documentJSON;save(label+'-native-before-assert',packet);report.rows.push({label,status:'CAPTURED',documentSHA256:packet.documentSHA256,outputs:packet.outputs.map((o:any)=>({id:o.outputId,key:o.bodyKey,bodyCount:o.nativeBodyCount,nativeBRepSHA256:o.nativeBRepSHA256})),packet:label+'-native-before-assert.json'});persist();return {packet,snapshot};
}
function qualify(label:string,doc:StudioDoc,width:number,wall:number,count:number,stage:string){
 const read=observe(label,doc),p=read.packet;assert.equal(p.ok,true,JSON.stringify(p.error));source(doc,width,wall,count,stage);assert.equal(p.inputUnchanged,true);assert.deepEqual(p.reader,{doc,notes:[]},'current reader/raw Doc identity');const expected=targets(width,wall,count,stage);assert.deepEqual(p.outputs.map((o:any)=>o.outputId).sort(),Object.keys(expected).sort(),'all actual live native outputs');
 const errors:any[]=[];for(const raw of p.outputs){const target=(expected as any)[raw.outputId];assert.equal(raw.nativeBodyCount,1);assert.equal(raw.brep.bodies.length,1);assert.equal(raw.brep.bodies[0].kind,'solid');assert.equal(raw.brep.shells.length,1);assert.ok(raw.brep.shells.every((s:any)=>s.closed));assert.ok(finite(raw.brep),'finite original native coefficients');assert.equal(sha(raw.nativeBRepJSON),raw.nativeBRepSHA256);assert.deepEqual(JSON.parse(raw.nativeBRepJSON),raw.brep);
  for(const name of ['default','strict','output']){const c=raw.productChecks[name];assert.equal(c.valid,true,JSON.stringify(c));assert.deepEqual(c.issues,[]);assert.equal(c.topology.length,1);assert.equal(c.topology[0].genus,stage==='HoleRow'||stage==='finish'?count:0);}
  const row:any={id:raw.outputId};for(const key of ['mass','brepMass']){const m=raw[key];assert.ok(['closed-form','planar-exact','quadrature'].includes(m.method),'native nonmesh mass method');near(m.volume,target.volume,key+' literal-profile volume',1e-9*target.volume);near(m.mass,target.massDensity1,key+' density1 grams');vector(m.centroid,target.centroid,key+' centroid');row[key]={volumeRelativeError:Math.abs(m.volume-target.volume)/target.volume,centroidAbsoluteErrorMM:Math.max(...m.centroid.map((v:number,i:number)=>Math.abs(v-target.centroid[i])))};}
  vector(raw.bounds.min,target.bounds.min,'native bounds min');vector(raw.bounds.max,target.bounds.max,'native bounds max');errors.push(row);
 }
 Object.assign(report.rows[report.rows.length-1],{status:'PASS_CONTROLLED_SOURCE_NATIVE_LITERAL_TARGET',parameters:{width,wall,count},stage,expected,errors});persist();return read;
}
function railTop(packet:any,owner:string){
 const raw=packet.outputs.find((o:any)=>o.outputId===owner);assert.ok(raw,'original owner '+owner);const b=raw.brep,vertices=new Map(b.vertices.map((v:any)=>[v.id,v.point]));
 const matches=raw.faces.filter((f:any)=>{const g=f.geometry;return g.kind==='plane'&&Math.abs(g.o[2]-6)<=1e-9&&Math.abs(g.n[2]-1)<=1e-9&&Math.abs(g.n[0])<=1e-9&&Math.abs(g.n[1])<=1e-9;});save(phase+'-rail-top-candidates',{owner,matches});assert.equal(matches.length,1,'one original current rail top');const face=matches[0];assert.ok(typeof face.name==='string'&&face.name.length>0,'actual rail top has native identity');assert.equal(face.loops.length,1,'rail top before Hole has one loop');
 const loop=b.loops.find((l:any)=>l.id===face.loops[0]),coedges=new Map(b.coedges.map((c:any)=>[c.id,c])),edges=new Map(b.edges.map((e:any)=>[e.id,e]));const points=loop.coedges.map((id:string)=>{const c:any=coedges.get(id),e:any=edges.get(c.edge);assert.equal(e.curve.degree,1);assert.equal(e.curve.controlPoints.length,2);return vertices.get(e.vertices[c.sense==='forward'?0:1]);});
 assert.equal(points.length,4);const expected=[[0,-3,6],[30,-3,6],[30,3,6],[0,3,6]];for(const p of points)assert.equal(expected.filter(q=>p.every((v:number,i:number)=>Math.abs(v-q[i])<=1e-9)).length,1,'actual rail top rectangle corner');assert.equal(new Set(points.map((p:any)=>p.join(','))).size,4);
 return {name:face.name,face,points,authority:'ORIGINAL_CURRENT_UNION_PREFIX_NATIVE_FACE_BEFORE_HOLE'};
}
function corners(packet:any,width:number){
 const raw=packet.outputs[0],out:any[]=[];for(const [x,y]of [[width-20,-20],[-20,-20],[width-20,20],[-20,20]]){const expected=[[x,y,0],[x,y,10]],matches=raw.edges.filter((e:any)=>e.curve.degree===1&&e.curve.controlPoints.length===2&&expected.every(p=>e.endpoints.some((q:any)=>q.every((v:number,i:number)=>Math.abs(v-p[i])<=1e-9))));save(phase+'-corner-'+out.length+'-candidates',{expected,matches});assert.equal(matches.length,1,'one original complete outer vertical corner');const edge=matches[0];assert.ok(typeof edge.name==='string'&&edge.name.length>0);out.push(edge);}
 const names=out.map(e=>e.name);assert.equal(new Set(names).size,4);const wanted=['n1.side[e1]|n1.side[e2]','n1.side[e1]|n1.side[e4]','n1.side[e2]|n1.side[e3]','n1.side[e3]|n1.side[e4]'];assert.deepEqual([...names].sort(),[...wanted].sort(),'observed surviving stock side identities');return out;
}
try{
 const bytes=readFileSync(seedFile);report.seed={path:seedFile,bytes:bytes.length,sha256:sha(bytes)};persist();assert.equal(bytes.length,582);assert.equal(sha(bytes),seedPin);assert.equal(sha(seedLiteral),seedPin);const loaded=readStudioDoc(bytes.toString('utf8'));assert.ok('doc'in loaded,JSON.stringify(loaded));assert.deepEqual(loaded.notes,[]);seed=loaded.doc;const seedBefore=JSON.stringify(seed);
 const base=field(seed,2,'t',2,'00-controlled-Wall3-to2');qualify('01-base-Shell-W80-Wall2',base,80,2,3,'baseShell');
 let rail=withNode(base,{kind:'sketch',profile:'rectangle',min:[0,-3],max:[30,3],sideTags:{outer:['e1','e2','e3','e4']}});rail=withNode(rail,{kind:'extrude',sketch:3,height:5,from:1});qualify('02-rail-New-two-live-outputs',rail,80,2,3,'railNew');
 const union=withNode(rail,{kind:'union',left:{node:2,side:'solid'},right:{node:4,side:'solid'}}),joined=qualify('03-Union-positive-floor-overlap',union,80,2,3,'union');const top=railTop(joined.packet,'n5');railFace=top.name;save('03-observed-rail-top-reference',top);assert.equal(railFace,'n4.top','selected rail top agrees with original rail producer identity');
 // Every centre is inside the observed rectangle; z6 is the actual selected plane.
 for(const x of [5,15,25])assert.ok(x-1>0&&x+1<30&&-1>-3&&1<3,'complete Hole disc on actual rail top');
 const holes=withNode(union,{kind:'hole',parent:{node:5,side:'solid'},radius:1,center:[5,0],face:railFace,pattern:{count:3,step:[10,0]}}),drilled=qualify('04-Hole-row-three-through-rail-floor',holes,80,2,3,'HoleRow');const edges=corners(drilled.packet,80);cornerNames=edges.map(e=>e.name);save('04-observed-outer-corner-references',{edges,authority:'ORIGINAL_CURRENT_HOLE_ROW_PREFIX_NATIVE_EDGES_BEFORE_FILLET'});
 const unsigned=withNode(holes,{kind:'fillet',parent:{node:6,side:'solid'},edges:cornerNames,radius:1});const beforeSignatures=JSON.stringify(holes),raw=drilled.packet.outputs[0],native=drilled.snapshot.outputs[0];
 // Native-derived display is used only by the existing signature-capture helper.
 // It is neither a physical oracle nor an invented source .made/signature record.
 const body:BodyResult={key:raw.bodyKey,ref:{node:6,side:'solid'},family:raw.representation,mesh:bodyMesh(native.brep,0,8),volume:raw.mass.volume,mass:raw.mass.mass,centroid:raw.mass.centroid};
 const A=captureSignatures(unsigned,[body]);finishSignatures=(A.nodes[7]as any).sigs;save('05-current-helper-signature-capture',{unsignedDoc:unsigned,signedDoc:A,originalNativeBRepSHA256:raw.nativeBRepSHA256,referenceObserver:'bodyMesh(original prefix native BRep,quality8) -> existing captureSignatures; identity only'});assert.equal(JSON.stringify(holes),beforeSignatures);assert.deepEqual(Object.keys(finishSignatures??{}).sort(),[...cornerNames].sort());
 report.references={railTop:top,outerCorners:edges,filletSignatures:finishSignatures,policy:'Keep actual source signatures immutable; they are historical identity anchors, not current physical measurements.'};qualify('05-finish-A-W80-Wall2-Copies3',A,80,2,3,'finish');
 const B=field(A,1,'w',90,'06-controlled-source-Width80-to90');assert.deepEqual(B.nodes.slice(1),A.nodes.slice(1),'source Width edit preserves entire downstream DAG');qualify('06-finish-B-W90-Wall2-Copies3',B,90,2,3,'finish');
 const C=field(B,2,'t',3,'07-controlled-Wall2-to3');assert.deepEqual(C.nodes.filter((_,i)=>i!==2),B.nodes.filter((_,i)=>i!==2));qualify('07-finish-C-W90-Wall3-Copies3',C,90,3,3,'finish');
 const D=field(C,6,'count',2,'08-controlled-HoleCopies3-to2');assert.deepEqual(D.nodes.filter((_,i)=>i!==6),C.nodes.filter((_,i)=>i!==6));qualify('08-finish-D-W90-Wall3-Copies2',D,90,3,2,'finish');
 const acceptedCBeforeInvalid=JSON.stringify(C),rejected=field(C,1,'w',4,'09-controlled-invalid-source-Width4-Wall3'),invalid=observe('09-invalid-Width4-Wall3-native-refusal',rejected).packet;assert.equal(invalid.ok,false,'collapse must refuse');assert.equal(invalid.error.code,'PARAMETER');assert.equal(invalid.error.feature,'n2');assert.match(invalid.error.message,/leaves no hollow/);assert.equal(JSON.stringify(C),acceptedCBeforeInvalid,'controlled candidate leaves accepted C owned separately');Object.assign(report.rows[report.rows.length-1],{status:'PASS_EXPECTED_CONTROLLED_NATIVE_REFUSAL',expectedCode:'PARAMETER',expectedFeature:'n2',GUIretention:'NOT_RUN'});
 assert.equal(JSON.stringify(seed),seedBefore,'original actual seed unchanged');report.status='PASS_CONTROLLED_NON_UI_ENCLOSURE_ADMISSION_ONLY';report.classes={A:{width:80,wall:2,count:3},B:{width:90,wall:2,count:3},C:{width:90,wall:3,count:3},D:{width:90,wall:3,count:2}};report.overlapPolicy={railBounds:{min:[0,-3,1],max:[30,3,6]},floorOverlapVolumeByWall:{2:180,3:360},addedRailVolumeByWall:{2:720,3:540},contactOnly:false,railTopIntent:'worldz6 fixed; clear height6-wall changes intentionally'};persist();console.log(JSON.stringify({status:report.status,out,rows:report.rows.map((r:any)=>({label:r.label,status:r.status})),references:{railFace,cornerNames}}));
}catch(cause){report.status='FAIL_CONTROLLED_ENCLOSURE_ADMISSION';report.firstFailure={phase,...error(cause)};persist();console.log(JSON.stringify({status:report.status,out,firstFailure:report.firstFailure}));process.exitCode=1;}
`;
