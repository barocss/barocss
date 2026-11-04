// D536 source preparation only. Root bundles/runs this in an owned external directory.
// No solved coordinates are authored here; this uses the actual public setter/Finish helpers.
export const seedSHA256 = 'cdfeb4bda2509da3748a3c1ae071a682e7408ee0bdabb5595ae74062b30b4758';
export const seedText = JSON.stringify({
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [
    {kind: 'sketch', profile: 'loop', segments: [
      {kind: 'line', start: [0, 0]}, {kind: 'line', start: [60, 0]}, {kind: 'line', start: [60, 20]},
      {kind: 'line', start: [20.5, 20]}, {kind: 'arc', start: [20.5, 37.5], center: [17.5, 37.5], direction: 'ccw'},
      {kind: 'line', start: [17.5, 40.5]}, {kind: 'line', start: [0, 40.5]},
    ], outline: {points: [[0, 0], [60, 0], [60, 20], [20.5, 20], [20.5, 37.5], [17.5, 40.5], [0, 40.5]],
      bulges: [0, 0, 0, 0, 0.41421356237309503, 0, 0], lengths: {'0': 60, '1': 20}, radii: {'4': 3},
      tangents: [4, 5], hv: {h: [0, 2, 5], v: [1, 3, 6]}},
    holes: [[{kind: 'line', start: [5, 5]}, {kind: 'line', start: [15, 5]}, {kind: 'line', start: [15, 10]}, {kind: 'line', start: [5, 10]}]],
    sideTags: {outer: ['e1', 'e2', 'e3', 'e4', 'e12', 'e5', 'e6'], holes: [['e7', 'e8', 'e9', 'e10']]},
    construction: [{kind: 'polygon', closed: false, points: [[0, 0], [60, 40]], bulges: [0, 0], construction: true, ids: ['e11']}], id: 'n0'},
    {kind: 'extrude', sketch: 0, height: 10, id: 'n1'},
    {kind: 'fillet', parent: {node: 1, side: 'solid'}, edges: ['n1.side[e2]|n1.side[e3]'], radius: 3, id: 'n2',
      sigs: {'n1.side[e2]|n1.side[e3]': {k: 'line', p: [60, 20, 5], d: [0, 0, 1], s: 10}}},
  ], outputs: {b2: {node: 2, side: 'solid'}}, nextId: 3,
}, null, 2);

// CLI: node preflight.mjs FRESH_/tmp/barocss-d536-..._DIRECTORY [ACTUAL_SEED_PATH]
// Writes observations before assertions and stops at the first failure. Native admission
// is not independent physical qualification, public UI proof or a solver-family certificate.
export const preflightSource = String.raw`
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {editFields} from '../../packages/barocss-cad-model/src/app/editFields.ts';
import {NODE_EXTRA_FIELDS,dropStaleMade,prefixDoc} from '../../packages/barocss-cad-model/src/engine/doc.ts';
import {captureSignatures} from '../../packages/barocss-cad-model/src/engine/references.ts';
import {toPartDocument,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {sketchShapes,reopenedOrder,rebindDims} from '../../packages/barocss-cad-model/src/sketch/reopen.ts';
import {commitDimension,solveShape} from '../../packages/barocss-cad-model/src/sketch/rules.ts';
import {settleShape} from '../../packages/barocss-cad-model/src/sketch/settle.ts';
import {withIds} from '../../packages/barocss-cad-model/src/sketch/entityIds.ts';
import {joinOpen} from '../../packages/barocss-cad-model/src/sketch/trim.ts';
import {profileOf} from '../../packages/barocss-cad-model/src/sketch/loops.ts';
import {preserveConstruction} from './src/sketch/preserveConstruction.ts';
import {evaluateCadPart,massPropertiesOf,brepMassProperties,checkBrep,checkOutput,faceGeometry,curveDomain,curveEvaluator} from '../../packages/barocss-cad/src/index.ts';
import {stepValidationBounds} from '../../packages/barocss-cad/src/brep/brep-bounds.ts';
const seedPin='${seedSHA256}',out=resolve(process.argv[2]??''),seedFile=process.argv[3]??'/tmp/barocss-d461-workflow-run01/07-saved-R3-opfs.bcad';
assert.ok(out.startsWith('/tmp/barocss-d536-')&&!existsSync(out),'Fresh owned external output required');mkdirSync(out);
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const error=(e:any)=>({name:e?.name??null,code:e?.code??null,feature:e?.feature??null,message:String(e?.message??e)});
const safe=(fn:()=>any)=>{try{return fn();}catch(e){return {observationError:error(e)};}};
const report:any={status:'RUNNING',authority:'CONTROLLED_NON_UI_SETTER_FINISH_AND_NATIVE_ADMISSION_ONLY',independentPhysicalOracle:'NOT_RUN',publicStudio:'NOT_RUN',rows:[]};
const save=(label:string,data:any)=>writeFileSync(join(out,label+'.json'),JSON.stringify(data,null,2));
const persist=()=>save('receipt',report);
function shapeFinish(doc:any,value:number,label:string){
 const originalJSON=JSON.stringify(doc),old=doc.nodes[0],reopened=sketchShapes(old,doc.parameters),shape:any=reopened.shape;
 assert.equal(shape?.kind,'polygon');
 // Observe the existing NodeEditor route too: it intentionally returns the same
 // node list when solve/profile admission fails; it supplies no refusal message.
 const field=editFields(doc.nodes,1,doc.parameters).find((f:any)=>f.key==='olen0');assert.ok(field&&field.kind==='number');
 const nodeEditorNodes=field.set(doc.nodes,value),direct=commitDimension(shape,'len0',value);
 const candidate={...shape,lengths:{...shape.lengths,0:value}},settled=settleShape(candidate,shape);
 save(label+'-solver-before-assert',{actualBeforeDoc:doc,actualBeforeDocJSON:originalJSON,target:value,reopened,nodeEditor:{key:field.key,label:field.label,returnsSameNodes:nodeEditorNodes===doc.nodes,nodes:nodeEditorNodes},commitDimension:direct,panelCandidate:candidate,panelSettle:settled});
 if(settled.error||!settled.shape)return {ok:false,phase:'SOLVER_REFUSED',reason:settled.error};
 const authored=reopenedOrder(settled.shape,reopened.done,shape.ids);
 const shapes=withIds(joinOpen(authored.map((x:any)=>x.kind==='polygon'&&!x.closed?{...x,pending:false}:x)));
 const profile=profileOf(shapes);
 save(label+'-profile-before-assert',{target:value,actualBeforeDoc:doc,authored,finishedShapes:shapes,profile,solverReport:safe(()=>solveShape(settled.shape as any))});
 if('error' in profile)return {ok:false,phase:'PROFILE_REFUSED',reason:profile.error};
 // This exact seed is a default-XY, unlinked, in-place sketch. These are the
 // existing useSketchActions Finish policies, not an invented geometry update.
 const finishedRefs=shapes.filter((x:any)=>x.construction||x.kind==='bezier').map((x:any)=>{if(x.kind==='bezier'&&x.construction){const {construction:_,...rest}=x;return rest;}return x;});
 const refs=preserveConstruction(old.construction??[],authored,finishedRefs);
 const placed:any={...profile.node,...(refs.length?{construction:refs}:{})},rebound=rebindDims(old,placed,doc.parameters),kept:any={};
 for(const key of NODE_EXTRA_FIELDS)if(old[key]!==undefined)kept[key]=old[key];
 if(!('on' in placed)&&old.on!==undefined)kept.on=old.on;
 const replacement={...rebound.node,...kept},edited={...doc,nodes:dropStaleMade(doc.nodes,doc.nodes.map((n:any,i:number)=>i===0?replacement:n))};
 // App.commit captures only missing references. This seed already has its full
 // fillet signature, so no current body is required by this no-op capture call.
 const accepted=captureSignatures(edited,[]);
 writeFileSync(join(out,label+'-actual-candidate.bcad'),JSON.stringify(accepted));
 save(label+'-finished-before-assert',{doc:accepted,documentJSON:JSON.stringify(accepted),documentSHA256:sha(JSON.stringify(accepted)),rebindDropped:rebound.dropped,originalInputUnchanged:JSON.stringify(doc)===originalJSON,captureExistingReferencesUnchanged:JSON.stringify(accepted)===JSON.stringify(edited)});
 assert.equal(JSON.stringify(doc),originalJSON,'Actual source input must not mutate');assert.equal(JSON.stringify(accepted),JSON.stringify(edited),'Complete historical references stay unchanged');
 return {ok:true,doc:accepted,shape:settled.shape,nodeEditorNodes,direct};
}
function nativeRead(doc:any,label:string){
 const documentJSON=JSON.stringify(doc),result:any={ok:false,documentJSON,documentSHA256:sha(documentJSON),outputs:[]};
 try{
  const input=prefixDoc(doc,doc.nodes.length);result.nativeInputDoc=input;result.partDocument=toPartDocument(input);const snap=evaluateCadPart(result.partDocument);
  // Capture ALL original BRep bytes before any strict or selected-shape assertions.
  for(const output of snap.outputs){const nativeBRepJSON=JSON.stringify(output.brep);result.outputs.push({outputId:output.id,bodyKey:bodyKeyOf(output.id,doc.nodes),brep:output.brep,nativeBRepJSON,nativeBRepSHA256:sha(nativeBRepJSON)});}
  for(let i=0;i<result.outputs.length;i++){
   const raw=result.outputs[i],output=snap.outputs[i],b=raw.brep,verts=new Map(b.vertices.map((v:any)=>[v.id,v.point]));
   raw.massUnits={density:1,densityUnit:'g/cm3',volume:'mm3',mass:'g',centroid:'mm'};raw.mass=safe(()=>massPropertiesOf(output,1));raw.brepMass=safe(()=>brepMassProperties(b,1));raw.bounds=safe(()=>stepValidationBounds(b));raw.defaultCheck=safe(()=>checkBrep(b));raw.strict=safe(()=>checkBrep(b,{strict:true}));raw.outputCheck=safe(()=>checkOutput(output));
   raw.faces=b.faces.map((f:any)=>({id:f.id,name:f.name,geometry:safe(()=>faceGeometry(f))}));
   raw.edges=b.edges.map((e:any)=>({id:e.id,name:e.name,curve:e.curve,endpoints:e.vertices.map((id:string)=>verts.get(id)),samples:safe(()=>{const[a,z]=curveDomain(e.curve),at=curveEvaluator(e.curve);return [0,.125,.25,.375,.5,.625,.75,.875,1].map(t=>at(a+(z-a)*t));})}));
  }
  result.ok=true;
 }catch(e){result.error=error(e);}
 save(label+'-native-before-assert',result);return result;
}
function invariants(doc:any,seed:any,value:number){
 assert.deepEqual(doc.nodes.slice(1),seed.nodes.slice(1),'Downstream Extrude/Fillet/ref/historical signature exact');assert.deepEqual({...doc,nodes:seed.nodes},seed,'Root metadata, b2 and nextId exact');
 const n=doc.nodes[0],s=seed.nodes[0];assert.equal(n.profile,'loop');assert.deepEqual(n.holes,s.holes);assert.deepEqual(n.construction,s.construction);assert.deepEqual(n.sideTags,s.sideTags);assert.equal(n.id,'n0');
 assert.deepEqual(n.outline.lengths,{'0':value,'1':20});assert.deepEqual(n.outline.radii,{'4':3});assert.deepEqual(n.outline.hv,s.outline.hv);assert.deepEqual(n.outline.tangents,[4,5]);assert.equal(n.segments.length,7);assert.deepEqual(n.segments.map((v:any,i:number)=>v.kind==='arc'?i:null).filter((v:any)=>v!==null),[4]);
}
function admission(doc:any,label:string){
 const final=nativeRead(doc,label+'-final'),pre=nativeRead(prefixDoc(doc,2),label+'-preFillet');
 report.rows.push({label,documentSHA256:sha(JSON.stringify(doc)),final,preFillet:pre});persist();
 for(const item of [final,pre]){assert.equal(item.ok,true,JSON.stringify(item.error));assert.equal(item.outputs.length,1);const raw=item.outputs[0];assert.equal(raw.strict.valid,true,JSON.stringify(raw.strict));assert.equal(raw.outputCheck.valid,true);assert.equal(raw.defaultCheck.valid,true);assert.ok(raw.bounds&&!raw.bounds.observationError);}
 const edge=pre.outputs[0].edges.filter((e:any)=>e.name==='n1.side[e2]|n1.side[e3]');assert.equal(edge.length,1);save(label+'-source-and-reference',{actualEmittedLoop:doc.nodes[0].segments,actualOutline:doc.nodes[0].outline,actualSourceCorner:doc.nodes[0].segments[2].start,downstreamReference:edge[0],authority:'Actual returned authored geometry; no fixed X60 corner assumption',independentPhysicalQualification:'NOT_RUN'});
}
try{
 const bytes=readFileSync(seedFile);writeFileSync(join(out,'original-seed.bcad'),bytes);report.seed={path:seedFile,bytes:bytes.length,sha256:sha(bytes)};persist();assert.equal(sha(bytes),seedPin);assert.equal(bytes.length,3942);const seed=JSON.parse(bytes.toString());
 const a:any=shapeFinish(seed,64,'01-length64');report.rows.push({label:'controlled-Finish64',result:a});persist();assert.equal(a.ok,true,JSON.stringify(a));invariants(a.doc,seed,64);admission(a.doc,'02-A64');
 const bad:any=shapeFinish(a.doc,10,'03-invalid-length10');report.rows.push({label:'controlled-invalid-Finish10',result:bad});persist();assert.equal(bad.ok,false,'Do not accept an unintended disjoint region');assert.equal(bad.phase,'PROFILE_REFUSED');assert.match(bad.reason,/Shapes 1 and 2 overlap/);
 const b:any=shapeFinish(a.doc,68,'04-postOpen-style-length68');report.rows.push({label:'controlled-Finish68',result:b});persist();assert.equal(b.ok,true,JSON.stringify(b));invariants(b.doc,seed,68);admission(b.doc,'05-B68');
 report.status='PASS_CONTROLLED_SETTER_FINISH_AND_NATIVE_ADMISSION_ONLY';persist();console.log(JSON.stringify({status:report.status,output:out,independentPhysicalOracle:'NOT_RUN',publicStudio:'NOT_RUN'}));
}catch(e){report.status='FAIL_FIRST_CONTROLLED_BOUNDARY';report.failure=error(e);persist();console.log(JSON.stringify({status:report.status,output:out,error:report.failure}));process.exitCode=2;}
`;
