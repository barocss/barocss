/** #1391 source-builder CPU flow. Raw-result Loader codec and graphics are separate.
 * node examples/gpu-scene/knot-aligned-loft-frame-flow.mjs --output <fresh-dir> --request <main.request.json>
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {prepareSourceLoftFrame} from './knot-aligned-loft-frame-internal.mjs';

assert.equal(Number(process.versions.node.split('.')[0]),22);
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),args=process.argv.slice(2);
function arg(name){const index=args.indexOf(name);assert(index>=0&&args[index+1],name+' is required');return resolve(args[index+1]);}
const output=arg('--output'),requestPath=arg('--request');await mkdir(output,{recursive:false});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const requestBytes=await readFile(requestPath);
assert.equal(requestBytes.length,3265);
assert.equal(hash(requestBytes),'b4b86254e816ea91d402313125ea2b64085cdc9ffd5550dd433fae3e19a1037a');
const request=JSON.parse(requestBytes),originalRequest=structuredClone(request);
const gpuDir=resolve(repo,'packages/barocss-gpu'),cadDir=resolve(repo,'packages/barocss-cad');
const gpuManifest=JSON.parse(await readFile(resolve(gpuDir,'package.json'),'utf8'));
const cadManifest=JSON.parse(await readFile(resolve(cadDir,'package.json'),'utf8'));
const cadPath=resolve(output,'cad-source.mjs'),ordinary=resolve(output,'gpu-source.mjs');
const [cadBuild,gpuBuild]=await Promise.all([
 build({entryPoints:[resolve(cadDir,cadManifest.exports['.'].import)],bundle:true,platform:'node',format:'esm',target:'node22',outfile:cadPath,metafile:true}),
 build({entryPoints:[resolve(gpuDir,gpuManifest.exports['.'].import)],bundle:true,platform:'node',format:'esm',target:'node22',outfile:ordinary,metafile:true}),
]);
const graph=Object.keys(gpuBuild.metafile.inputs),cadGraph=Object.keys(cadBuild.metafile.inputs);
assert(cadGraph.some(path=>path.endsWith('/source-knot-aligned-loft.ts')));
assert(graph.some(path=>path.endsWith('/primitive-frame-preflight.ts')));
assert(!graph.some(path=>path.includes('barocss-gpu/dist/')));
const cad=await import(pathToFileURL(cadPath).href),emitted=resolve(gpuDir,gpuManifest.publishConfig.exports['.'].import);
const providers=[['source',ordinary,await import(pathToFileURL(ordinary).href)],['emitted',emitted,await import(pathToFileURL(emitted).href)]];
const namespace=Object.keys(providers[0][2]).sort();assert.deepEqual(namespace,Object.keys(providers[1][2]).sort());
const declaration=await readFile(resolve(gpuDir,gpuManifest.publishConfig.exports['.'].types),'utf8');
for(const name of ['preparePrimitiveSceneFrame','prepareSelectedUniformCurvePreview'])assert(declaration.includes(name));
const helper=resolve(repo,'examples/gpu-scene/knot-aligned-loft-frame-internal.mjs');
// Value digest only: preserve Binary64 bits, ignore object storage/alias layout.
// No native payload is saved/read and this is not an exchange codec.
function nativeDigest(value){
 const digest=createHash('sha256'),size=number=>{const bytes=Buffer.alloc(4);bytes.writeUInt32BE(number);digest.update(bytes);};
 const text=value=>{const bytes=Buffer.from(value,'utf8');size(bytes.length);digest.update(bytes);};
 function visit(item){
  if(item===null){digest.update('z');return;}
  if(typeof item==='number'){assert(Number.isFinite(item));digest.update('n');const bytes=Buffer.alloc(8);bytes.writeDoubleBE(item);digest.update(bytes);return;}
  if(typeof item==='string'){digest.update('s');text(item);return;}
  if(typeof item==='boolean'){digest.update(item?'t':'f');return;}
  if(item===undefined){digest.update('u');return;}
  assert(item&&typeof item==='object');
  if(Array.isArray(item)){digest.update('a');size(item.length);for(const child of item)visit(child);return;}
  digest.update('o');const keys=Object.keys(item).sort();size(keys.length);for(const key of keys){text(key);visit(item[key]);}
 }
 visit(value);return digest.digest('hex');
}
const buffers=p=>p.primitives.map(part=>Object.fromEntries(['positions','normals','indices'].filter(key=>part[key]).map(key=>{
 const view=part[key];return[key,hash(Buffer.from(view.buffer,view.byteOffset,view.byteLength))];
})));
function verify(record){
 assert.deepEqual(Object.keys(record).sort(),['curvePreviews','native','prepared','surfacePreview','validationReport'].sort());
 assert.deepStrictEqual(record.validationReport,record.native.report);
 assert.equal(record.prepared.primitives.length,4);assert.equal(record.prepared.bufferBytes,7356);
 assert.equal(record.surfacePreview.packet.positions.length/3,81);assert.equal(record.surfacePreview.packet.indices.length/3,128);
 assert.equal(record.prepared.frame.options.mmToSceneUnit,.01);
 assert.deepStrictEqual(record.prepared.frame.options.translate,[0,0,0]);
 assert(record.curvePreviews.every(curve=>curve.count===129&&curve.model.objects.length===4&&curve.model.name==='main_model'));
 assert.deepEqual(record.prepared.frame.scene.entries.map(entry=>entry.ref),[
  {modelId:'main_model',geometryId:'main_surface'},...['main_section_a','main_section_b','main_section_c'].map(geometryId=>({modelId:'main_model',geometryId})),
 ]);
 for(let entry=0;entry<4;entry++){
  const original=entry===0?record.surfacePreview.packet.positions:record.curvePreviews[entry-1].pointsMM.flat();
  assert.deepEqual(Array.from(record.prepared.primitives[entry].positions),original.map(value=>Math.fround(value*.01)));
 }
 assert(Object.isFrozen(record.prepared.frame));assert(Object.isFrozen(record.prepared.primitives));
 const c0=record.native.loft.report.derivativeObservations.filter(row=>row.result.kind==='refused');
 assert.equal(c0.length,3);assert(c0.every(row=>row.v===.5));
 const first=record.native.insertions.find(item=>item.sectionIndex===0);
 if(first)assert.equal(first.result.provenance.steps[0].generatedPoles[0].refinedPoleIndex,2);
}
async function saveSources(label,input,native){
 const inputPath=resolve(output,label+'.source-request.json');await writeFile(inputPath,JSON.stringify(input,null,2)+'\n');
 const files=[inputPath];
 for(const [stage,contexts]of [['original',native.originalSources],['aligned',native.alignedSections]])for(const context of contexts){
  const path=resolve(output,label+'.'+stage+'.'+context.index+'.source0.css');await writeFile(path,context.source);files.push(path);
 }
 const construction=resolve(output,label+'.construction.source0.css');await writeFile(construction,native.loft.source);files.push(construction);
 return files;
}
let accepted=0,refused=0,getters=0,reflections=0;const results=[],failures=[];
try{
 let crossNative=null,crossEdited=null;
 for(const [provider,providerPath,gpu]of providers){
  const initial=prepareSourceLoftFrame(cad,gpu,request);verify(initial);accepted++;
  assert.deepStrictEqual(request,originalRequest);
  if(crossNative)assert.deepStrictEqual(initial.native,crossNative);else crossNative=structuredClone(initial.native);
  const first=initial.native.insertions.find(item=>item.sectionIndex===0);assert(first);
  const generated=first.result.provenance.steps[0].generatedPoles[0].refinedPoleIndex;
  assert(!first.result.provenance.unchangedPoles.some(row=>row.refinedPoleIndex===generated));
  const aligned=initial.native.alignedSections[0],curve=aligned.model.objects.find(object=>object.id===request.assets[0].curveId);
  assert.equal(curve.kind,'curve');assert.equal(curve.controlPoints[generated][0],2.8749999999999996);
  const editRequest={source:aligned.source,sourceVersion:0,curveId:curve.id,edits:{poleEdits:[{index:generated,xMM:curve.controlPoints[generated][0]+.125}]}};
  const edit=cad.editSourceCurveControlPolygon(editRequest);
  assert.equal(edit.curve.controlPoints[generated][0],2.9999999999999996);
  assert.deepStrictEqual(edit.curve.knots,curve.knots);assert.deepStrictEqual(edit.curve.weights,curve.weights);
  for(let i=0;i<curve.controlPoints.length;i++)if(i!==generated)assert.deepStrictEqual(edit.curve.controlPoints[i],curve.controlPoints[i]);
  for(let i=0;i<aligned.model.objects.length;i++)if(i!==1)assert.deepStrictEqual(edit.model.objects[i],aligned.model.objects[i]);
  const editedRequest={assets:initial.native.alignedSections.map((context,index)=>({sourceId:context.sourceId,sourceVersion:0,source:index===0?edit.source:context.source,curveId:request.assets[index].curveId})),
   parametersV:request.parametersV.slice(),options:{...request.options,evaluationId:'gpu_frame_edited'}};
  const edited=prepareSourceLoftFrame(cad,gpu,editedRequest);verify(edited);accepted++;
  assert.equal(edited.native.insertions.length,0);assert.deepStrictEqual(edited.native.plan.knots,initial.native.plan.knots);
  assert.notDeepEqual(buffers(initial.prepared),buffers(edited.prepared));
  if(crossEdited)assert.deepStrictEqual(edited.native,crossEdited);else crossEdited=structuredClone(edited.native);
  const files=[...await saveSources(provider+'.initial',request,initial.native),...await saveSources(provider+'.edited',editedRequest,edited.native)];
  const retained=await Promise.all(files.map(async path=>({path,sha256:hash(await readFile(path))})));
  const priorNative=structuredClone(initial.native),priorBuffers=buffers(initial.prepared),priorFrame=structuredClone(initial.prepared.frame);
  const repeated=gpu.preparePrimitiveSceneFrame(initial.prepared.frame);assert.deepStrictEqual(repeated.frame,initial.prepared.frame);
  for(let i=0;i<4;i++){
   assert.notStrictEqual(repeated.primitives[i].positions,initial.prepared.primitives[i].positions);
   const view=repeated.primitives[i].positions;view[0]+=1;
  }
  assert.deepEqual(buffers(initial.prepared),priorBuffers);accepted++;
  const refusals=[];
  function reject(label,operation){let error;try{operation();}catch(cause){error=cause;}assert(error instanceof Error,label+' must refuse');
   assert.deepStrictEqual(initial.native,priorNative);assert.deepStrictEqual(initial.prepared.frame,priorFrame);assert.deepEqual(buffers(initial.prepared),priorBuffers);
   refused++;refusals.push({label,name:error.name,code:error.code??null,message:error.message});return error;
  }
  reject('duplicate stations',()=>prepareSourceLoftFrame(cad,gpu,{...request,parametersV:[-2,-2,4]}));
  reject('four source assets',()=>prepareSourceLoftFrame(cad,gpu,{...request,assets:[...request.assets,request.assets[0]]}));
  reject('unsupported source version',()=>prepareSourceLoftFrame(cad,gpu,{...request,assets:request.assets.map((asset,index)=>index?asset:{...asset,sourceVersion:1})}));
  reject('malformed full source',()=>prepareSourceLoftFrame(cad,gpu,{...request,assets:request.assets.map((asset,index)=>index?asset:{...asset,source:'@model broken {'})}));
  const badBinding=structuredClone(initial.native);badBinding.bindings.output.modelName='wrong';reject('whole native binding tamper',()=>cad.validateSourceKnotAlignedLoft(badBinding));
  const getter={...request};Object.defineProperty(getter,'assets',{enumerable:true,get(){getters++;return request.assets;}});reject('request getter not invoked',()=>prepareSourceLoftFrame(cad,gpu,getter));
  const marker=new Error('Actual source request reflection refusal');reject('request reflection',()=>prepareSourceLoftFrame(cad,gpu,new Proxy(request,{ownKeys(){reflections++;throw marker;}})));
  for(const [label,change]of [
   ['wrong qualified identity',frame=>{frame.scene.entries[1].ref.geometryId='wrong';}],
   ['double-scale overflow',frame=>{frame.options.mmToSceneUnit=1e100;}],
   ['invalid camera',frame=>{frame.options.camera.eye=frame.options.camera.target.slice();}],
   ['wrong packet unit',frame=>{frame.scene.entries[0].packet.lengthUnit='scene';}],
   ['unsupported particles',frame=>{frame.particles={};}],
  ]){const frame=structuredClone(initial.prepared.frame);change(frame);reject(label,()=>gpu.preparePrimitiveSceneFrame(frame));}
  for(const file of retained)assert.equal(hash(await readFile(file.path)),file.sha256);
  const configs=[{path:resolve(output,provider+'.initial.source-request.json'),digest:nativeDigest(initial.native),buffers:priorBuffers},
   {path:resolve(output,provider+'.edited.source-request.json'),digest:nativeDigest(edited.native),buffers:buffers(edited.prepared)}];
  const child=String.raw`import{readFile}from'node:fs/promises';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';import assert from'node:assert/strict';
   ${nativeDigest.toString()}
   const c=JSON.parse(process.argv[1]),{prepareSourceLoftFrame}=await import(pathToFileURL(c.helper).href),cad=await import(pathToFileURL(c.cad).href),gpu=await import(pathToFileURL(c.gpu).href);
   assert.equal(Number(process.versions.node.split('.')[0]),22);const hash=b=>createHash('sha256').update(b).digest('hex'),out=[];
   for(const row of c.requests){const request=JSON.parse(await readFile(row.path,'utf8')),record=prepareSourceLoftFrame(cad,gpu,request);assert.equal(record.prepared.bufferBytes,7356);assert.equal(nativeDigest(record.native),row.digest);
    const buffers=record.prepared.primitives.map(p=>Object.fromEntries(['positions','normals','indices'].filter(k=>p[k]).map(k=>{const a=p[k];return[k,hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength))]})));assert.deepEqual(buffers,row.buffers);out.push({nativeDigest:row.digest,bytes:record.prepared.bufferBytes,buffers});}
   console.log(JSON.stringify({node:process.version,sourceRequestsRebuilt:true,rawResultFileRead:false,results:out}));`;
  const cold=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',child,JSON.stringify({helper,cad:cadPath,gpu:providerPath,requests:configs})],{encoding:'utf8'}));
  results.push({provider,initial:{nativeDigest:nativeDigest(initial.native),bytes:7356,bindings:initial.native.bindings,buffers:priorBuffers},
   edited:{nativeDigest:nativeDigest(edited.native),insertionCount:0,generatedPole:generated,oldX:curve.controlPoints[generated][0],newX:edit.curve.controlPoints[generated][0],buffers:buffers(edited.prepared)},
   retainedSourceFiles:retained,cold,refusals});
 }
 assert.equal(getters,0);
}catch(error){failures.push(String(error.stack??error));throw error;}
finally{
 const report={issue:1391,scope:'SOURCE_BUILDER_CPU',parent:'9d8cb20e86f34e71271e9b04bb2f55fdd08717de',head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
  accepted,refused,getters,reflections,namespaceCount:namespace.length,results,failures,sourceGraph:graph,cadSourceGraph:cadGraph,
  providers:{cadSource:{path:cadPath,sha256:hash(await readFile(cadPath))},gpuSource:{path:ordinary,sha256:hash(await readFile(ordinary))},gpuEmitted:{path:emitted,sha256:hash(await readFile(emitted))},dtsSHA256:hash(declaration)},
  sourceRequest:{path:requestPath,bytes:3265,sha256:hash(requestBytes)},rawResultCodec:false,rawResultFileRead:false,rawNativeResultSaved:false,actualGL:false,
  limits:['Complete native in-memory results retained; canonical value digest is not an exchange file/codec.','Degree5 Curve preview is full-source uniform D0/sampleVersion3; adaptiveWide is not used.',
   'Surface norms are derived D0 triangle normals; native whole-D1 C0 refusals/smoothness remain separate.','Source/request/CSS cold rebuild is distinct from pending Loader1390 raw-result file route.',
   'GPU emitted proof uses actual artifact; CAD constructor/validator/editor/tessellator provider is own source, not all-published-CAD proof.','No renderer/pixels/lifetime/globalshape/G1G2/BodySolid/currentRoot/parity/publication proof.']};
 await writeFile(resolve(output,'actual-result.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({issue:1391,accepted,refused,getters,reflections,namespaceCount:namespace.length,actualGL:false,rawResultCodec:false,failures}));
}
