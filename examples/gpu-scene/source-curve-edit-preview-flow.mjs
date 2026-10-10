/** #1144: complete-source Curve editing composed with selected CPU previews. */
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
// Example-only JSON number emission retains native signed zero. No public codec.
function nativeJSON(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return'['+v.map(nativeJSON).join(',')+']';return'{'+Object.entries(v).map(([k,n])=>JSON.stringify(k)+':'+nativeJSON(n)).join(',')+'}';}
const clone=v=>JSON.parse(nativeJSON(v));
const fixtures=[
 ['quartic_rational_nonzero_domain',9,'4f0a57faa921de97ca40882f341139bd99eb44fb00691b47a8b153120c4415f3','bc192a98ed84365aad618210c6382e1e09a7c61dc49a7bbaefea4eb034db8219','52ba53b42ffc41562b8d872b6cd4a78ae2507cc2930a79b42152b147a2c48c74'],
 ['quintic_actual_native_profile',9,'c1c3ab1b99a9dee3bb7f28dd59b3f011f05c5e0997255c23e355b52e9755ef4d','a88de9cd7ca2e75a86b5a0aac1104dff7062eafa690f104bf75a4cb8dd7a2ec0','a9d27dac769292649144da2033b809f7de396fd9705aa1a335d513db4d869272'],
 ['actual_64_poles_all_256_fields_changed',129,'8017a05c0d828ff4b4ed49c2edd58249546cbec752f7acb8a11b78d119635451','e67003868bd810cbfe59de9ab87a8b72b0f9e9fbe2e9d684f94def4a4a7a74fd','f84efd137c16d939c369717c1a28cad24ae683960a4a644f0b613ed51f61e86e'],
 ['exact_noop_unusual_decimal_minus_zero',9,'570034a384fb0bbc80c44d0d650e882a92937f1069de1be279c364fc14510f2a','026895642ccb593b2c4288d2d883db8af309ab8374ec0ec1d0e0cc266f0c03aa','570034a384fb0bbc80c44d0d650e882a92937f1069de1be279c364fc14510f2a']
];
const inputs=[];
for(const[name,count,sourceHash,requestHash,candidateHash]of fixtures){
 const paths=['complete-original.source0.css','authored-request.json','complete-candidate.source0.css'].map(s=>resolve(fixtureRoot,name+'.'+s)),bytes=await Promise.all(paths.map(p=>readFile(p)));
 [sourceHash,requestHash,candidateHash].forEach((hash,i)=>assert.equal(sha(bytes[i]),hash,name+' pinned input '+i));
 const request=JSON.parse(bytes[1]);assert.equal(request.source,bytes[0].toString());assert.equal(request.curveId,'target_curve');assert.equal(request.sourceVersion,0);
 inputs.push({name,count,request,expected:bytes[2].toString(),files:await Promise.all(paths.map(receipt))});
}
const manifests={};for(const name of ['cad','gpu']){const root=resolve(repo,'packages/barocss-'+name),manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));assert.equal(manifest.publishConfig.exports['.'].import,'./dist/index.js');manifests[name]={root,manifest};}
const ordinary=resolve(output,'ordinary-source.mjs'),sourceCode=['cad','gpu'].map(name=>`import * as ${name} from ${JSON.stringify(resolve(manifests[name].root,manifests[name].manifest.exports['.'].import))};`).join('\n')+'\nexport {cad,gpu};';
const built=await build({stdin:{contents:sourceCode,resolveDir:repo,sourcefile:'curve-edit-preview-source.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',outfile:ordinary,metafile:true});
const graph=Object.keys(built.metafile.inputs);assert(graph.some(p=>p.endsWith('/src/source-curve-control-polygon.ts')));assert(graph.some(p=>p.endsWith('/src/uniform-curve-preview.ts')));assert(!graph.some(p=>p.includes('barocss-cad/dist/')||p.includes('barocss-gpu/dist/')));
const providers=[{name:'ordinary-source',...await import(pathToFileURL(ordinary).href),files:[await receipt(ordinary)]}];
const emitted={name:'emitted-public',files:[]};for(const name of ['cad','gpu']){const{root,manifest}=manifests[name],entry=resolve(root,manifest.publishConfig.exports['.'].import);emitted[name]=await import(pathToFileURL(entry).href);emitted.files.push(await receipt(entry),await receipt(resolve(root,manifest.publishConfig.exports['.'].types)));}providers.push(emitted);
const results=[];
for(const provider of providers){
 const{cad,gpu,name}=provider;for(const fn of ['editSourceCurveControlPolygon','validateSourceCurveControlPolygonEdit','sampleCurve','compileCadModel'])assert.equal(typeof cad[fn],'function',name+' public '+fn);
 for(const fn of ['prepareSelectedUniformCurvePreview','validateSelectedUniformCurvePreview'])assert.equal(typeof gpu[fn],'function',name+' public '+fn);
 const accepted=[],refusals=[],dir=resolve(output,name);await mkdir(dir);let current;
 const acceptedSource=resolve(dir,'accepted.source0.css'),acceptedDTO=resolve(dir,'accepted.preview.json');
 function prepare(request,count){
  const before=clone(request),edit=cad.editSourceCurveControlPolygon(request);assert.deepEqual(request,before);const owned=cad.validateSourceCurveControlPolygonEdit(edit);assert.deepEqual(owned,edit.report);assert.notStrictEqual(owned,edit.report);
  const preview=gpu.prepareSelectedUniformCurvePreview({source:edit.source,curveId:request.curveId,count}),rebuilt=gpu.validateSelectedUniformCurvePreview(preview);assert.deepEqual(rebuilt,preview);assert.notStrictEqual(rebuilt,preview);
  assert.equal(preview.version,1);assert.equal(preview.profile,'native-selected-uniform-curve-v1');assert.equal(preview.sourceVersion,0);assert.equal(preview.source,edit.source);assert.deepEqual(preview.model,edit.model);
  return{edit,preview};
 }
 async function accept(value){await writeFile(acceptedSource,value.edit.source);await writeFile(acceptedDTO,nativeJSON(value.preview)+'\n');current=value;}
 function observe(preview){const curve=preview.model.objects.find(o=>o.id===preview.curveId);assert.equal(curve.kind,'curve');const samples=cad.sampleCurve(curve,preview.count);assert.deepEqual(preview.parameters,samples.map(x=>x.parameter));assert.deepEqual(preview.pointsMM,samples.map(x=>x.point));assert.equal(samples.length,preview.count);return{degree:curve.degree,poles:curve.controlPoints.length,knots:curve.knots.length,domain:[preview.parameters[0],preview.parameters.at(-1)],samples:samples.length};}
 for(const input of inputs){
  const{request,count}=input,before=gpu.prepareSelectedUniformCurvePreview({source:request.source,curveId:request.curveId,count}),value=prepare(request,count),{edit,preview}=value;
  assert.equal(edit.source,input.expected,input.name+' original producer candidate bytes');assert.deepEqual(before.model,edit.originalModel);assert.equal(before.curveId,preview.curveId);assert.equal(before.model.name,preview.model.name);assert.equal(before.model.lengthUnit,'mm');
  assert.deepEqual(before.model.objects.map(x=>[x.id,x.kind]),preview.model.objects.map(x=>[x.id,x.kind]));
  for(const object of before.model.objects)if(object.id!==request.curveId)assert.deepEqual(preview.model.objects.find(x=>x.id===object.id),object,'Unselected whole native object bits');
  const original=before.model.objects.find(x=>x.id===request.curveId),edited=preview.model.objects.find(x=>x.id===request.curveId);assert.deepEqual(original.knots,edited.knots);assert.equal(original.degree,edited.degree);assert.equal(original.controlPoints.length,edited.controlPoints.length);assert.deepEqual(edited,edit.curve);
  let patched=request.source;for(const patch of [...edit.patches].reverse()){assert.equal(request.source.slice(patch.startUTF16,patch.endUTF16),patch.originalText);patched=patched.slice(0,patch.startUTF16)+patch.replacementText+patched.slice(patch.endUTF16);}assert.equal(patched,edit.source);
  const beforeObservations=observe(before),afterObservations=observe(preview);assert.deepEqual(beforeObservations,afterObservations);const changed=!preview.pointsMM.every((p,i)=>p.every((x,j)=>Object.is(x,before.pointsMM[i][j])));
  assert.equal(changed,!edit.report.noOp,input.name+' sampled change/no-op');if(edit.report.noOp)assert.equal(edit.source,request.source);
  const sourceFile=resolve(dir,input.name+'.source0.css'),dtoFile=resolve(dir,input.name+'.preview.json'),editFile=resolve(dir,input.name+'.edit.json');await writeFile(sourceFile,edit.source);await writeFile(dtoFile,nativeJSON(preview)+'\n');await writeFile(editFile,nativeJSON(edit)+'\n');
  const coldSource=await readFile(sourceFile,'utf8'),coldOwned=JSON.parse(await readFile(dtoFile,'utf8')),cold=gpu.validateSelectedUniformCurvePreview(coldOwned);assert.deepEqual(cold,preview);assert.deepEqual(gpu.prepareSelectedUniformCurvePreview({source:coldSource,curveId:request.curveId,count}),preview);assert.deepEqual(cad.validateSourceCurveControlPolygonEdit(JSON.parse(await readFile(editFile,'utf8'))),edit.report);
  const beforeCold=nativeJSON(cold);coldOwned.pointsMM[0][0]=999;assert.equal(nativeJSON(cold),beforeCold);assert(Object.isFrozen(cold.model));
  await accept(value);accepted.push({name:input.name,beforeObservations,afterObservations,changed,patches:edit.patches.length,derivativeRefusals:edit.report.directCounts.derivativeRefusalCount,files:await Promise.all([sourceFile,dtoFile,editFile].map(receipt))});
 }
 const quarticSource=await readFile(resolve(dir,inputs[0].name+'.source0.css'),'utf8'),reedit=prepare({source:quarticSource,sourceVersion:0,curveId:'target_curve',edits:{poleEdits:[{index:0,xMM:.125}]}},9);observe(reedit.preview);assert.equal(reedit.edit.curve.controlPoints[0][0],.125);await accept(reedit);accepted.push({name:'cold-quartic-reedit',sourceSHA256:sha(reedit.edit.source),sampleCount:9});
 const retained=nativeJSON(current),savedSource=await readFile(acceptedSource),savedDTO=await readFile(acceptedDTO);
 async function refused(label,action,code,errorClass){let error;try{action();}catch(e){error=e;}assert(error instanceof errorClass,label+' real public class');assert.equal(error.code,code,label);assert.equal(nativeJSON(current),retained);assert.deepEqual(await readFile(acceptedSource),savedSource);assert.deepEqual(await readFile(acceptedDTO),savedDTO);refusals.push({name:label,code,message:error.message,cause:error.cause?.message??null,priorSourceAndDTORetained:true});}
 const source=current.edit.source;
 await refused('wrong-selector',()=>gpu.prepareSelectedUniformCurvePreview({source,curveId:'absent_curve',count:9}),'PROFILE',gpu.UniformCurvePreviewError);
 await refused('count130',()=>gpu.prepareSelectedUniformCurvePreview({source,curveId:'target_curve',count:130}),'BUDGET',gpu.UniformCurvePreviewError);
 const altered=clone(current.preview);altered.pointsMM[0][0]+=1;await refused('altered-owned-observations',()=>gpu.validateSelectedUniformCurvePreview(altered),'RECONSTRUCTION',gpu.UniformCurvePreviewError);
 await refused('native-invalid-weight',()=>prepare({source,sourceVersion:0,curveId:'target_curve',edits:{poleEdits:[{index:0,weight:0}]}},9),'NATIVE',cad.SourceCurveControlPolygonError);
 const spare=id=>`@curve #${id} {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[1,0,0]];weights:[1,1];}\n`,original=inputs[0].request.source,close=original.lastIndexOf('}');assert(close>=0);
 const five=original.slice(0,close)+spare('spare_one')+spare('spare_two')+original.slice(close),fiveEdit=cad.editSourceCurveControlPolygon({...clone(inputs[0].request),source:five});assert.equal(fiveEdit.model.objects.length,5);assert.deepEqual(cad.validateSourceCurveControlPolygonEdit(fiveEdit),fiveEdit.report);
 await refused('valid-native-five-objects',()=>gpu.prepareSelectedUniformCurvePreview({source:fiveEdit.source,curveId:'target_curve',count:9}),'PROFILE',gpu.UniformCurvePreviewError);
 const long='/*'+'a'.repeat(70000)+'*/\n'+original,longEdit=cad.editSourceCurveControlPolygon({...clone(inputs[0].request),source:long});assert(longEdit.source.length>65536&&Buffer.byteLength(longEdit.source)>65536&&Buffer.byteLength(longEdit.source)<262144);assert.deepEqual(cad.validateSourceCurveControlPolygonEdit(longEdit),longEdit.report);
 await refused('valid-native-long-source',()=>gpu.prepareSelectedUniformCurvePreview({source:longEdit.source,curveId:'target_curve',count:9}),'BUDGET',gpu.UniformCurvePreviewError);
 let getters=0;const accessor={curveId:'target_curve',count:9};Object.defineProperty(accessor,'source',{enumerable:true,get(){getters++;return source;}});
 await refused('own-accessor',()=>gpu.prepareSelectedUniformCurvePreview(accessor),'INPUT',gpu.UniformCurvePreviewError);assert.equal(getters,0);
 results.push({provider:name,files:provider.files,accepted,refusals,getters,finalSource:current.edit.source,finalPreview:current.preview,cadExports:Object.keys(cad).sort(),gpuExports:Object.keys(gpu).sort()});
}
assert.deepEqual(results[0].finalPreview,results[1].finalPreview);assert.equal(results[0].finalSource,results[1].finalSource);assert.deepEqual(results[0].cadExports,results[1].cadExports);assert.deepEqual(results[0].gpuExports,results[1].gpuExports);
const cadClosure=[];for(const entry of(await readdir(resolve(manifests.cad.root,'dist'))).sort())if(entry.endsWith('.js'))cadClosure.push(await receipt(resolve(manifests.cad.root,'dist',entry)));
const result={ok:true,issue:1144,inputs:inputs.map(({name,count,files})=>({name,count,files})),results,sourceGraph:graph,cadClosure,actualGL:false,support:'Complete Source0 native edit and selected uniform CPU observations. Native mm/coefficient/domain/ID/UV authority unchanged except exact requested scalars; no editor session/revision, topology binding, rendering, Float32, adaptive error or publication. Staging refusals retain accepted variables/files; file-system crash atomicity is untested.'};
await writeFile(resolve(output,'actual-result.json'),nativeJSON(result)+'\n');console.log(JSON.stringify({ok:true,accepted:results.reduce((n,r)=>n+r.accepted.length,0),refusals:results.reduce((n,r)=>n+r.refusals.length,0),getters:0,actualGL:false}));
