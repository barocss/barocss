/** #1172: authored mixed workplanes composed with selected native world-Curve CPU previews.
 * After the affected GPU build: node examples/gpu-scene/mixed-workplane-arc-preview-flow.mjs
 * --fixtures <native1161-input-directory> --output <new-directory>.
 * Authored local intent remains separate from generated child Source0 and samples.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
function option(name){const i=process.argv.indexOf(name);assert(i>=0&&process.argv[i+1],name+' required');return resolve(process.argv[i+1]);}
const output=option('--output'),fixtureRoot=option('--fixtures');await mkdir(output,{recursive:false});
const sha=x=>createHash('sha256').update(x).digest('hex');
async function receipt(path){const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:sha(bytes)};}
// Example-only owned-result/preview emission preserves -0, separate from authored codec.
function nativeJSON(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(nativeJSON).join(',')+']';return '{'+Object.entries(v).map(([k,n])=>JSON.stringify(k)+':'+nativeJSON(n)).join(',')+'}';}
const clone=v=>JSON.parse(nativeJSON(v));
// Pinned native request / authored codec hashes; explicit caller-order world selectors.
const fixtures=[
 [
  "interleaved_actual_three_providers",
  "c3c0d6bff368e8b96981148bf03d7a807eb56b840d9e5f669ee9234f331b1653",
  "dd9409f3f2851080f30b5e22274b85e483eee70139c75352306db4469ffcdcd3",
  [
   "world_line_profile",
   "world_arc_profile",
   "world_rectangle_profile",
   "world_circle_profile"
  ],
  17,
  [
   [
    "line_profile",
    "line",
    "world_line_profile"
   ],
   [
    "arc_profile",
    "arc",
    "world_arc_profile"
   ],
   [
    "poly_profile",
    "polyline",
    "world_poly_profile"
   ],
   [
    "rectangle_profile",
    "rectangle",
    "world_rectangle_profile"
   ],
   [
    "circle_profile",
    "arc",
    "world_circle_profile"
   ]
  ]
 ],
 [
  "linear_point_and_arc_dimensions_angles_edit",
  "af55ec1f00219d9836472d121b51bde488b48809819e0a05d6a0c5df7e9a282f",
  "07cfc75b6cc359f6f86b58933a7943e043345e2c52c31a6f7337bb8e0fec5c64",
  [
   "world_line_profile",
   "world_arc_profile",
   "world_rectangle_profile",
   "world_circle_profile"
  ],
  17,
  [
   [
    "line_profile",
    "line",
    "world_line_profile"
   ],
   [
    "arc_profile",
    "arc",
    "world_arc_profile"
   ],
   [
    "poly_profile",
    "polyline",
    "world_poly_profile"
   ],
   [
    "rectangle_profile",
    "rectangle",
    "world_rectangle_profile"
   ],
   [
    "circle_profile",
    "arc",
    "world_circle_profile"
   ]
  ]
 ],
 [
  "plane_only_rebuild_all_native_children",
  "ace43ef8e03d7039a72751d2ac73c3db0abf76d2605957cfe64fcabf061c0d6a",
  "523dbf0173eac4dbfce550eb91ec1daa4c17fa9dca0c3eef99b8f08ec802ccb1",
  [
   "world_line_profile",
   "world_arc_profile",
   "world_rectangle_profile",
   "world_circle_profile"
  ],
  17,
  [
   [
    "line_profile",
    "line",
    "world_line_profile"
   ],
   [
    "arc_profile",
    "arc",
    "world_arc_profile"
   ],
   [
    "poly_profile",
    "polyline",
    "world_poly_profile"
   ],
   [
    "rectangle_profile",
    "rectangle",
    "world_rectangle_profile"
   ],
   [
    "circle_profile",
    "arc",
    "world_circle_profile"
   ]
  ]
 ],
 [
  "partial_arc_to_fullturn_stable_endpoint_ids",
  "1e8bf4df3034b24e942dd23edc6795d7faf3cce310d4aa9f6c0dc4f1d72c09ca",
  "dd562553382b99f406a34159ebc48494436c2a45b8418196872af4c4c1a981a6",
  [
   "world_line_profile",
   "world_arc_profile",
   "world_rectangle_profile",
   "world_circle_profile"
  ],
  17,
  [
   [
    "line_profile",
    "line",
    "world_line_profile"
   ],
   [
    "arc_profile",
    "arc",
    "world_arc_profile"
   ],
   [
    "poly_profile",
    "polyline",
    "world_poly_profile"
   ],
   [
    "rectangle_profile",
    "rectangle",
    "world_rectangle_profile"
   ],
   [
    "circle_profile",
    "arc",
    "world_circle_profile"
   ]
  ]
 ],
 [
  "fullturn_back_to_partial_arc",
  "28781e783aced6d92f7701644c431f34bc0346e447c38039f2a4331ae77139de",
  "23cc76451d4b5b8273bbc497d0ee9b6e1d46e68449fdbf0223f354b3cf2fb07f",
  [
   "world_line_profile",
   "world_arc_profile",
   "world_rectangle_profile",
   "world_circle_profile"
  ],
  17,
  [
   [
    "line_profile",
    "line",
    "world_line_profile"
   ],
   [
    "arc_profile",
    "arc",
    "world_arc_profile"
   ],
   [
    "poly_profile",
    "polyline",
    "world_poly_profile"
   ],
   [
    "rectangle_profile",
    "rectangle",
    "world_rectangle_profile"
   ],
   [
    "circle_profile",
    "arc",
    "world_circle_profile"
   ]
  ]
 ],
 [
  "empty_real_linear_receipt_no_geometry",
  "f31bf9575104ffa26b8339beecd2f9bc0b026fd3fa9c45b33035884254153e00",
  "d101014fbd206239902be93f8bc0c2e9b8c42d2cbd565cc3f67f0371bf253b99",
  [],
  17,
  []
 ],
 [
  "arc_only_actual_empty_linear_subset",
  "40f13c9763d1befce2d45e41ad421b0ef1e067220ef8cae29dbe64bd029f4ea0",
  "23372a712a5a5fb604ac59da4ff2f63e324b10774aa6ade945f7a5bbbfbb042c",
  [
   "world_arc_profile"
  ],
  17,
  [
   [
    "arc_profile",
    "arc",
    "world_arc_profile"
   ]
  ]
 ]
];
const inputs=[];
for(const[name,requestHash,authoredHash,ids,count,profiles]of fixtures){
 const paths=['authored-request.json','authored-mixed-sketch.json'].map(s=>resolve(fixtureRoot,name+'.'+s)),bytes=await Promise.all(paths.map(p=>readFile(p)));
 [requestHash,authoredHash].forEach((hash,i)=>assert.equal(sha(bytes[i]),hash,name+' pinned input '+i));
 inputs.push({name,request:JSON.parse(bytes[0]),authored:bytes[1].toString(),ids,count,profiles,files:await Promise.all(paths.map(receipt))});
}
const manifests={};for(const name of ['cad','gpu']){const root=resolve(repo,'packages/barocss-'+name),manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));assert.equal(manifest.publishConfig.exports['.'].import,'./dist/index.js');manifests[name]={root,manifest};}
const ordinary=resolve(output,'ordinary-source.mjs'),sourceCode=['cad','gpu'].map(name=>`import * as ${name} from ${JSON.stringify(resolve(manifests[name].root,manifests[name].manifest.exports['.'].import))};`).join('\n')+'\nexport {cad,gpu};';
const built=await build({stdin:{contents:sourceCode,resolveDir:repo,sourcefile:'mixed-workplane-preview-source.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',outfile:ordinary,metafile:true});
const graph=Object.keys(built.metafile.inputs);assert(graph.some(p=>p.endsWith('/src/mixed-workplane-sketch-document.ts')));assert(graph.some(p=>p.endsWith('/src/mesh/uniform-curve-preview.ts')));assert(!graph.some(p=>p.includes('barocss-cad/dist/')||p.includes('barocss-gpu/dist/')));
const providers=[{name:'ordinary-source',...await import(pathToFileURL(ordinary).href),files:[await receipt(ordinary)]}];
const emitted={name:'emitted-public',files:[]};for(const name of ['cad','gpu']){const{root,manifest}=manifests[name],entry=resolve(root,manifest.publishConfig.exports['.'].import);emitted[name]=await import(pathToFileURL(entry).href);emitted.files.push(await receipt(entry),await receipt(resolve(root,manifest.publishConfig.exports['.'].types)));}providers.push(emitted);
function select(native,ids){
 if(!Array.isArray(ids)||ids.length>4||new Set(ids).size!==ids.length)throw new RangeError('Example selection requires at most four unique current world IDs');
 if(native.profiles.length===0){if(ids.length!==0)throw new RangeError('Empty authored document requires empty selection');return [];}
 if(ids.length===0)throw new RangeError('Nonempty authored document requires one to four selected world IDs');
 return ids.map(id=>{const child=native.profiles.find(profile=>profile.worldCurveId===id);if(!child)throw new RangeError('Example selection world ID is absent from current authored document: '+id);return child;});
}
function matrixPoint(matrix,point){return [0,1,2].map(axis=>{const row=matrix.slice(axis*4,axis*4+4);return row[0]*point[0]+row[1]*point[1]+row[2]*point[2]+row[3];});}
const localCurve=child=>child.local.kind==='linear'?child.local.evaluation.evaluation.curve:child.local.evaluation.curve;
function verifyNative(cad,native){
 assert.equal(native.document.format,'barocss-mixed-workplane-sketch');assert.equal(native.document.version,0);assert.equal(native.document.lengthUnit,'mm');assert.equal(native.document.angleUnit,'rad');
 assert.deepEqual(Object.keys(native.document).sort(),['format','version','id','lengthUnit','angleUnit','plane','profiles','worldBindings','limits'].sort());
 assert.equal(native.planeReport.accepted,true);assert.equal(native.planeReport.tolerance,1e-9);assert.equal(native.report.quality.exactRigidFrameCertified,false);assert.equal(native.report.quality.globalExactCircleCertified,false);
 assert.deepEqual(native.document.profiles.filter(p=>p.kind!=='arc'),native.linear.document.profiles);assert.deepEqual(native.report.worldCurveIds,native.profiles.map(p=>p.worldCurveId));
 assert(!Object.isFrozen(native));assert(!Object.isFrozen(native.document));assert.notStrictEqual(native.request.document,native.document);
 const witnesses=[];
 for(const child of native.profiles){
  const local=localCurve(child),world=child.affine.geometry,intent=native.document.profiles.find(p=>p.id===child.profileId);
  assert.deepEqual(child.affine.original,local);assert.deepEqual(child.affine.matrix,native.matrix);assert.notEqual(local.id,world.id);assert.equal(world.id,child.worldCurveId);assert.equal(child.kind,intent.kind);
  for(const key of ['kind','degree','weights','knots'])assert.deepEqual(world[key],local[key]);assert.equal(world.controlPoints.length,local.controlPoints.length);
  const compiled=cad.compileCadModel(child.affine.source,{sourceVersion:0});assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,child.affine.model);assert.deepEqual(compiled.model.objects.find(o=>o.id===child.worldCurveId),world);
  if(intent.kind==='rectangle'){
   const closing=native.worldPointBindings.find(b=>b.profileId===child.profileId&&b.isClosing);assert(closing);assert.equal(closing.poleIndex,4);assert.equal(closing.parameter,4);assert.equal(closing.pointId,intent.cornerIds[0]);assert.deepEqual(world.controlPoints[4],world.controlPoints[0]);assert.deepEqual(local.controlPoints[4],local.controlPoints[0]);
  }
  if(intent.kind==='arc'){
   assert.equal(child.local.kind,'arc');const report=child.local.evaluation.report;
   assert.equal(report.quality.nativeParameterIsAngle,false);assert.equal(report.periodic,false);assert.equal(report.quality.periodicContinuityCertified,false);
   assert.equal(report.spanCount,Math.ceil(Math.abs(intent.sweepAngleRad)/(Math.PI/2)));assert.deepEqual(report.nativeDomain,[0,report.spanCount]);assert.equal(local.controlPoints.length,2*report.spanCount+1);
   const center=native.arcConstructionBindings.find(b=>b.profileId===child.profileId);assert(center);assert.equal(center.centerId,intent.centerId);assert.deepEqual(center.localCenterMM,[...intent.centerMM,0]);
   assert.deepEqual(center.radius,{parameterId:intent.radius.id,valueMM:intent.radius.valueMM,role:'construction-radius-mm-not-world-global-circle-certificate'});
   assert(!Object.hasOwn(center,'poleIndex'));assert(!Object.hasOwn(center,'parameter'));assert(!native.worldPointBindings.some(b=>b.pointId===center.centerId||b.pointId===intent.radius.id));
   const mapped=matrixPoint(native.matrix,center.localCenterMM);assert(Math.hypot(...mapped.map((x,i)=>x-center.worldCenterMM[i]))<=1e-7);
   assert.equal(center.axes.length,3);for(const axis of center.axes){assert.deepEqual(axis.row,native.matrix.slice(axis.axis*4,axis.axis*4+4));assert(Object.is(axis.value,center.worldCenterMM[axis.axis]));assert(['guarded-affine-dot','identity-axis-bit-copy'].includes(axis.policy));}
   const endpoints=native.worldPointBindings.filter(b=>b.profileId===child.profileId);assert.equal(endpoints.length,2);assert.notEqual(intent.endpointIds[0],intent.endpointIds[1]);
   assert.deepEqual(endpoints.map(b=>b.pointId),intent.endpointIds);assert.deepEqual(endpoints.map(b=>b.poleIndex),[0,2*report.spanCount]);assert.deepEqual(endpoints.map(b=>b.parameter),[0,report.spanCount]);
   const full=Math.abs(intent.sweepAngleRad)===Math.PI*2;assert.equal(report.endpointClosed,full);
   assert.deepEqual(endpoints.map(b=>b.role),full?['seam-start','seam-end']:['arc-start','arc-end']);assert.deepEqual(endpoints.map(b=>b.isClosing),[false,full]);
   if(full){assert.deepEqual(local.controlPoints[0],local.controlPoints.at(-1));assert.deepEqual(world.controlPoints[0],world.controlPoints.at(-1));assert(report.derivativeRefusalCount>0);}
   assert.equal(report.derivativeRefusalCount,report.spanCount-1);assert.equal(report.observations.filter(o=>o.d1.status==='native-refused').length,report.derivativeRefusalCount);
   // Retain a real report witness against substituting a linear authored angle.
   const observation=report.observations.find(o=>o.parameter>0&&o.parameter<report.spanCount&&Math.abs(o.analyticAngleRad-(intent.startAngleRad+intent.sweepAngleRad*(o.parameter/report.spanCount)))>1e-5);
   if(observation)witnesses.push({profileId:child.profileId,parameter:observation.parameter,analyticAngleRad:observation.analyticAngleRad,linearAngleSubstituteRad:intent.startAngleRad+intent.sweepAngleRad*(observation.parameter/report.spanCount),retainedObservation:clone(observation)});
  }
 }
 if(native.profiles.some(p=>p.kind==='arc'))assert(witnesses.length>0,'Actual noncardinal rational-native/linear-angle discrepancy witness');
 return witnesses;
}
function verifyPreview(cad,native,child,preview){
 assert.equal(preview.format,'barocss-gpu-uniform-curve-preview');assert.equal(preview.version,1);assert.equal(preview.profile,'native-selected-uniform-curve-v1');assert.equal(preview.sourceVersion,0);
 assert.equal(preview.source,child.affine.source);assert.equal(preview.curveId,child.worldCurveId);assert.deepEqual(preview.model,child.affine.model);assert.equal(preview.count,17);
 const world=child.affine.geometry,local=localCurve(child),samples=cad.sampleCurve(world,preview.count),localSamples=cad.sampleCurve(local,preview.count);
 assert.deepEqual(preview.parameters,samples.map(s=>s.parameter));assert.deepEqual(preview.pointsMM,samples.map(s=>s.point));assert.deepEqual(preview.parameters,localSamples.map(s=>s.parameter));
 let maximumMappedDifferenceMM=0;
 for(let i=0;i<samples.length;i++){
  const expected=matrixPoint(native.matrix,localSamples[i].point),actual=cad.evaluateCurve(world,preview.parameters[i]);assert.deepEqual(actual,preview.pointsMM[i]);
  const difference=Math.hypot(...expected.map((x,j)=>x-actual[j]));assert(difference<=1e-7,'Observed local/matrix/world native D0 agreement');maximumMappedDifferenceMM=Math.max(maximumMappedDifferenceMM,difference);
 }
 assert(Object.isFrozen(preview));assert(Object.isFrozen(preview.model));assert(Object.isFrozen(preview.pointsMM));assert.notStrictEqual(preview.model,child.affine.model);
 return{worldCurveId:child.worldCurveId,count:17,domain:[preview.parameters[0],preview.parameters.at(-1)],poles:world.controlPoints.length,knots:world.knots.length,maximumMappedDifferenceMM,nativeD1Refusals:child.affine.report.derivativeRefusalCount};
}
const results=[];
for(const provider of providers){
 const{cad,gpu,name}=provider;
 for(const fn of ['evaluateMixedWorkplaneSketchDocument','updateMixedWorkplaneSketchDocument','validateMixedWorkplaneSketchDocument','serializeMixedWorkplaneSketchDocument','parseMixedWorkplaneSketchDocument','sampleCurve','evaluateCurve','compileCadModel'])assert.equal(typeof cad[fn],'function',name+' public '+fn);
 for(const fn of ['prepareSelectedUniformCurvePreview','validateSelectedUniformCurvePreview'])assert.equal(typeof gpu[fn],'function',name+' public '+fn);
 for(const helper of ['mapPoint','admitWorkplaneSketchFrame'])assert(!Object.hasOwn(cad,helper),'Internal helper is not a public root export');
 const dir=resolve(output,name);await mkdir(dir);const accepted=[],refusals=[];let current;
 const acceptedPaths=['accepted.authored-mixed-sketch.json','accepted.native.json','accepted.previews.json'].map(p=>resolve(dir,p));
 function prepare(request,ids,count){
  const before=clone(request),native=request.edit===null?cad.evaluateMixedWorkplaneSketchDocument(request.document):cad.updateMixedWorkplaneSketchDocument(request.document,request.edit);assert.deepEqual(request,before);
  const report=cad.validateMixedWorkplaneSketchDocument(native);assert.deepEqual(report,native.report);assert.notStrictEqual(report,native.report);assert(!Object.isFrozen(report));
  const reportBits=nativeJSON(native.report);report.worldCurveIds.push('example_mutation');assert.equal(nativeJSON(native.report),reportBits,'Report does not alias owned native result');
  const witnesses=verifyNative(cad,native);
  const children=select(native,ids),observations=[];
  const previews=children.map(child=>{
   const preview=gpu.prepareSelectedUniformCurvePreview({source:child.affine.source,curveId:child.worldCurveId,count}),validated=gpu.validateSelectedUniformCurvePreview(preview);
   assert.deepEqual(validated,preview);assert.notStrictEqual(validated,preview);observations.push(verifyPreview(cad,native,child,preview));return preview;
  });
  assert.deepEqual(previews.map(p=>p.curveId),ids);return{native,selection:[...ids],count,previews,observations,witnesses};
 }
 async function accept(value){const authored=cad.serializeMixedWorkplaneSketchDocument(value.native.document);await writeFile(acceptedPaths[0],authored);await writeFile(acceptedPaths[1],nativeJSON(value.native)+'\n');await writeFile(acceptedPaths[2],nativeJSON(value.previews)+'\n');current=value;}
 async function saveAndCold(label,value){
  const paths=[label+'.authored-mixed-sketch.json',label+'.native.json',label+'.previews.json'].map(p=>resolve(dir,p));
  await writeFile(paths[0],cad.serializeMixedWorkplaneSketchDocument(value.native.document));await writeFile(paths[1],nativeJSON(value.native)+'\n');await writeFile(paths[2],nativeJSON(value.previews)+'\n');
  const document=cad.parseMixedWorkplaneSketchDocument(await readFile(paths[0],'utf8')),owned=JSON.parse(await readFile(paths[1],'utf8')),previews=JSON.parse(await readFile(paths[2],'utf8'));
  assert.deepEqual(document,value.native.document);assert.deepEqual(cad.validateMixedWorkplaneSketchDocument(owned),value.native.report);
  const cold=prepare({document,edit:null},value.selection,value.count);
  for(const key of ['document','matrix','profiles','worldPointBindings','arcConstructionBindings'])assert.deepEqual(cold.native[key],value.native[key],'Cold authored regeneration '+key);
  assert.deepEqual(cold.previews,value.previews);
  for(let i=0;i<previews.length;i++){
   const rebuilt=gpu.validateSelectedUniformCurvePreview(previews[i]);assert.deepEqual(rebuilt,value.previews[i]);assert.notStrictEqual(rebuilt,value.previews[i]);
   const bits=nativeJSON(rebuilt);previews[i].pointsMM[0][0]+=1;assert.equal(nativeJSON(rebuilt),bits,'Cold preview frozen independent copy');
  }
  const bits=nativeJSON(cold.native);document.plane.originMM[0]+=1;owned.document.plane.originMM[0]+=1;assert.equal(nativeJSON(cold.native),bits,'Mutable native result independent of callers');
  for(let i=0;i<value.previews.length;i++){
   const path=resolve(dir,label+'.preview_'+i+'.json');await writeFile(path,nativeJSON(value.previews[i])+'\n');paths.push(path);
  }
  return paths;
 }
 for(const input of inputs){
  const value=prepare(input.request,input.ids,17);assert.equal(cad.serializeMixedWorkplaneSketchDocument(value.native.document),input.authored,'Pinned complete authored codec bytes');
  assert.deepEqual(value.native.profiles.map(p=>[p.profileId,p.kind,p.worldCurveId]),input.profiles,'Whole interleaved current native profile identities/order');
  assert.deepEqual(value.native.document.worldBindings,input.request.document.worldBindings);
  if(input.request.edit!==null){
   if(input.request.edit.profiles.length===0)assert.deepEqual(value.native.document.profiles,input.request.document.profiles,'Plane-only edits retain all local native intent');
   for(const old of input.request.document.profiles){
    const next=value.native.document.profiles.find(p=>p.id===old.id);assert(next);assert.equal(next.kind,old.kind);
    if(old.kind==='arc'){assert.equal(next.centerId,old.centerId);assert.equal(next.radius.id,old.radius.id);assert.deepEqual(next.endpointIds,old.endpointIds);}
    if(!input.request.edit.profiles.some(e=>e.kind==='upsert'&&e.profile.id===old.id))assert.deepEqual(next,old,'Unedited whole authored intent bits');
   }
  }
  if(input.name==='empty_real_linear_receipt_no_geometry'){assert.deepEqual(value.native.profiles,[]);assert.deepEqual(value.previews,[]);assert.deepEqual(value.native.arcConstructionBindings,[]);}
  if(input.name==='arc_only_actual_empty_linear_subset'){assert.deepEqual(value.native.linear.profiles,[]);assert.equal(value.native.profiles.length,1);assert.equal(value.previews.length,1);}
  if(value.native.profiles.length===5){assert.equal(value.previews.length,4);assert(value.native.profiles.some(p=>p.worldCurveId==='world_poly_profile'));assert(!value.selection.includes('world_poly_profile'));}
  if(input.name==='partial_arc_to_fullturn_stable_endpoint_ids')assert(value.native.profiles.find(p=>p.profileId==='arc_profile').local.evaluation.report.endpointClosed);
  if(input.name==='fullturn_back_to_partial_arc')assert(!value.native.profiles.find(p=>p.profileId==='arc_profile').local.evaluation.report.endpointClosed);
  const paths=await saveAndCold(input.name,value);await accept(value);
  accepted.push({name:input.name,profiles:value.native.profiles.length,selection:value.selection,observations:value.observations,parameterAngleWitnesses:value.witnesses,arcConstructionBindings:value.native.arcConstructionBindings,files:await Promise.all(paths.map(receipt))});
 }
 const primary=inputs[0],coldDocument=cad.parseMixedWorkplaneSketchDocument(await readFile(resolve(dir,primary.name+'.authored-mixed-sketch.json'),'utf8'));
 const arc=clone(coldDocument.profiles.find(p=>p.id==='arc_profile'));arc.radius.valueMM+=.25;
 const reedit=prepare({document:coldDocument,edit:{plane:null,profiles:[{kind:'upsert',profile:arc}],worldBindings:null}},primary.ids,17);
 assert.equal(reedit.native.document.profiles.find(p=>p.id===arc.id).radius.valueMM,2.25);assert.deepEqual(reedit.native.document.worldBindings,coldDocument.worldBindings);
 const edited=reedit.native.document.profiles.find(p=>p.id===arc.id),original=coldDocument.profiles.find(p=>p.id===arc.id);
 for(const key of ['id','kind','centerId','centerMM','startAngleRad','sweepAngleRad','endpointIds'])assert.deepEqual(edited[key],original[key]);assert.equal(edited.radius.id,original.radius.id);
 for(const intent of coldDocument.profiles.filter(p=>p.id!==arc.id))assert.deepEqual(reedit.native.document.profiles.find(p=>p.id===intent.id),intent);
 const primaryOwned=JSON.parse(await readFile(resolve(dir,primary.name+'.native.json'),'utf8'));
 for(const child of primaryOwned.profiles.filter(p=>p.profileId!==arc.id))assert.deepEqual(reedit.native.profiles.find(p=>p.profileId===child.profileId),child,'Radius edit retains every unedited native/local/world/source child');
 assert.deepEqual(reedit.native.arcConstructionBindings,primaryOwned.arcConstructionBindings.map(b=>b.profileId===arc.id?{...b,radius:{...b.radius,valueMM:2.25}}:b),'Centre proof/role IDs unchanged except explicit radius value');
 const reeditPaths=await saveAndCold('cold-primary-arc-radius-reedit',reedit);await accept(reedit);
 accepted.push({name:'cold-primary-arc-radius-reedit',profiles:5,selection:reedit.selection,observations:reedit.observations,parameterAngleWitnesses:reedit.witnesses,arcConstructionBindings:reedit.native.arcConstructionBindings,files:await Promise.all(reeditPaths.map(receipt))});
 const retained=nativeJSON(current),retainedState=current,saved=await Promise.all(acceptedPaths.map(p=>readFile(p)));
 async function refused(label,action,errorClass,code=null,details={}){
  let error;try{action();}catch(e){error=e;}assert(error instanceof errorClass,label+' actual error class');if(code!==null)assert.equal(error.code,code,label);
  assert.strictEqual(current,retainedState);assert.equal(nativeJSON(current),retained);for(let i=0;i<acceptedPaths.length;i++)assert.deepEqual(await readFile(acceptedPaths[i]),saved[i]);
  refusals.push({name:label,error:error.name,code:error.code??null,message:error.message,cause:error.cause?.message??null,causeCode:error.cause?.code??null,...details,priorAcceptedVariablesAndAuthoredNativePreviewFilesRetained:true});
  return error;
 }
 const wrong=clone(primary.request);wrong.document.format='barocss-workplane-sketch';
 await refused('foreign-authored-format',()=>prepare(wrong,primary.ids,17),cad.MixedWorkplaneSketchDocumentError,'VERSION');
 const zero=clone(primary.request);zero.document.profiles.find(p=>p.id==='arc_profile').radius.valueMM=0;
 const arcError=await refused('native-radius-zero',()=>prepare(zero,primary.ids,17),cad.MixedWorkplaneSketchDocumentError,'ARC');assert(arcError.cause instanceof Error,'Actual native Arc cause is retained');
 const center=clone(current.native);center.arcConstructionBindings[0].worldCenterMM[0]+=1;
 await refused('tampered-owned-construction-centre',()=>cad.validateMixedWorkplaneSketchDocument(center),cad.MixedWorkplaneSketchDocumentError,'OWNED');
 const seam=clone(current.native),seamEnd=seam.worldPointBindings.find(p=>p.role==='seam-end');assert(seamEnd);seamEnd.pointId='tampered_seam_endpoint';
 await refused('tampered-owned-fullturn-seam-endpoint',()=>cad.validateMixedWorkplaneSketchDocument(seam),cad.MixedWorkplaneSketchDocumentError,'OWNED');
 await refused('construction-centre-selector',()=>prepare(primary.request,[primary.request.document.profiles.find(p=>p.id==='arc_profile').centerId],17),RangeError);
 const late=JSON.parse(await readFile(resolve(dir,primary.name+'.previews.json'),'utf8'));late[2].pointsMM[0][0]+=1;let successfulPrefix=0;
 await refused('third-saved-preview-reconstruction',()=>{for(const preview of late){gpu.validateSelectedUniformCurvePreview(preview);successfulPrefix++;}},gpu.UniformCurvePreviewError,'RECONSTRUCTION',{successfulPrefix:2});assert.equal(successfulPrefix,2);
 let getters=0;const child=current.native.profiles[0],accessor={curveId:child.worldCurveId,count:17};Object.defineProperty(accessor,'source',{enumerable:true,get(){getters++;return child.affine.source;}});
 await refused('preview-source-accessor',()=>gpu.prepareSelectedUniformCurvePreview(accessor),gpu.UniformCurvePreviewError,'INPUT');assert.equal(getters,0);
 assert.equal(accepted.length,8);assert.equal(refusals.length,7);
 results.push({provider:name,files:provider.files,accepted,refusals,getters,finalNative:current.native,finalPreviews:current.previews,cadExports:Object.keys(cad).sort(),gpuExports:Object.keys(gpu).sort()});
}
for(const key of ['cadExports','gpuExports','finalNative','finalPreviews'])assert.deepEqual(results[0][key],results[1][key],'Source/emitted '+key);
const cadClosure=[];for(const entry of(await readdir(resolve(manifests.cad.root,'dist'))).sort())if(entry.endsWith('.js'))cadClosure.push(await receipt(resolve(manifests.cad.root,'dist',entry)));
const result={ok:true,issue:1172,inputs:inputs.map(({name,ids,count,files})=>({name,ids,count,files})),results,sourceGraph:graph,cadClosure,actualGL:false,
 support:'Complete distinct mixed authored workplane/local linear-Arc intent/mm/rad/frame/native world children and selected original-parameter uniform CPU D0 previews. Native endpoint IDs/coefficients/seam roles/construction centre/radius proofs and C0 refusals retained. Actual rational parameter is not angle. Observed affine agreement within1e-7mm is not a global certificate. No axis conversion/angular sampling/Float32/rendering/editor/periodic continuity/manufacturing/topology/release/filesystem crash atomicity proof.'};
await writeFile(resolve(output,'actual-result.json'),nativeJSON(result)+'\n');console.log(JSON.stringify({ok:true,accepted:16,refusals:14,getters:0,cadExports:results[0].cadExports.length,gpuExports:results[0].gpuExports.length,actualGL:false}));
