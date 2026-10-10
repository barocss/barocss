import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {serialize,deserialize} from 'node:v8';
import {execFileSync} from 'node:child_process';

const args=process.argv.slice(2),has=flag=>args.includes(flag);
const option=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const root=resolve(option('--root')??process.cwd());
const evidence=option('--evidence')&&resolve(option('--evidence'));
const mode=option('--mode')??(has('--compiled')?'compiled':'source');
const check=(value,message)=>{if(!value)throw Error(message);};
const copy=value=>structuredClone(value);
const sha=value=>createHash('sha256').update(value).digest('hex');
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  if(ArrayBuffer.isView(a)||ArrayBuffer.isView(b)){
    if(!ArrayBuffer.isView(a)||!ArrayBuffer.isView(b)||a.constructor!==b.constructor||a.byteLength!==b.byteLength)return false;
    const first=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),second=new Uint8Array(b.buffer,b.byteOffset,b.byteLength);
    return first.every((value,index)=>value===second[index]);
  }
  return Array.isArray(a)===Array.isArray(b)&&Reflect.ownKeys(a).length===Reflect.ownKeys(b).length
    &&Reflect.ownKeys(a).every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
}
const signature=value=>({encoding:'node-v8-runtime-data',bytes:serialize(value).length,sha256:sha(serialize(value))});
const describe=(error,depth=0)=>error&&depth<8?{name:error.name,message:error.message,code:error.code??null,
  cause:describe(error.cause,depth+1)}:null;
const PALETTE=[[.14,.58,.86],[.95,.57,.22],[.36,.72,.49],[.72,.48,.87]];

function outputDirectory(){
  check(evidence,'Supply --evidence with an absolute output directory outside the checkout.');
  check(evidence!==root&&!evidence.startsWith(root+'/'),'Evidence must stay outside the checkout.');
  check(mode==='source'||mode==='compiled','Mode must be source or compiled.');
  return evidence;
}
async function save(name,value){
  await mkdir(outputDirectory(),{recursive:true});
  const text=JSON.stringify(value,null,2)+'\n';
  check(Buffer.byteLength(text)<=4*1024*1024,'Evidence exceeds4MiB.');
  await writeFile(resolve(evidence,name),text,{flag:'wx'});
}
async function buildConsumer(){
  const require=createRequire(resolve(root,'package.json')),{build}=await import(require.resolve('esbuild'));
  const manifests=new Map(),resolutions=[];
  for(const name of await readdir(resolve(root,'packages'))){
    try{const directory=resolve(root,'packages',name),manifest=JSON.parse(await readFile(resolve(directory,'package.json'),'utf8'));
      if(manifest.name?.startsWith('@barocss/'))manifests.set(manifest.name,{directory,manifest});
    }catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;}
  }
  const compiledResolver={name:'viewer-appearance-public-publish-imports',setup(builder){
    builder.onResolve({filter:/^@barocss\//},({path})=>{
      const pieces=path.split('/'),name=pieces.slice(0,2).join('/'),item=manifests.get(name);
      const subpath=pieces.length===2?'.':'./'+pieces.slice(2).join('/');
      const entry=item?.manifest.publishConfig?.exports?.[subpath],target=typeof entry==='string'?entry:entry?.import;
      check(target?.startsWith('./dist/'),'Missing public publish import '+path);
      const resolved=resolve(item.directory,target);resolutions.push({publicName:path,target:relative(root,resolved)});
      return{path:resolved};
    });
  }};
  const script=resolve(root,'examples/viewer-native-scene-replacement/scene-appearance-preflight.mjs');
  const built=await build({absWorkingDir:root,entryPoints:[script],bundle:true,write:false,metafile:true,
    platform:'node',format:'esm',target:'es2022',plugins:mode==='compiled'?[compiledResolver]:[]});
  const inputs=Object.keys(built.metafile.inputs).map(path=>relative(root,resolve(root,path)));
  const source=inputs.filter(path=>/^packages\/[^/]+\/src\//.test(path));
  const dist=inputs.filter(path=>/^packages\/[^/]+\/dist\//.test(path));
  check(mode==='source'?!dist.length&&source.length:!source.length&&dist.length,'Source/dist input contamination.');
  const inputHashes={};for(const path of inputs.filter(path=>path.startsWith('packages/')))
    inputHashes[path]=sha(await readFile(resolve(root,path)));
  await mkdir(outputDirectory(),{recursive:true});
  await writeFile(resolve(evidence,mode+'-consumer.mjs'),built.outputFiles[0].contents,{flag:'wx'});
  await save(mode+'-audit.json',{mode,inputs,inputHashes,ownSourceCount:source.length,ownDistCount:dist.length,
    resolutions,bundleSHA256:sha(built.outputFiles[0].contents),scope:'CPU consumer compilation only; no package build or execution'});
  console.log(JSON.stringify({mode,ownSourceCount:source.length,ownDistCount:dist.length}));
}

async function publicModules(){
  const viewer=await import('@barocss/viewer'),gpu=await import('@barocss/gpu');
  const interop=await import('@barocss/cad-interop/document');
  check(typeof viewer.prepareViewerNativeSceneAppearance==='function','Public Viewer CPU preparation is unavailable.');
  return{viewer,gpu,interop};
}
async function fixture({gpu,interop}){
  const documentPath='packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json';
  const documentBytes=await readFile(resolve(root,documentPath));
  const result=interop.parseBaroCadDocument(documentBytes.toString('utf8'));
  const options={native:{sourceVersion:0,countU:5,countV:5,unitsPerMillimeter:1,
    curveDisplay:{version:1,chordToleranceMM:.02,maxSegments:512,maxDepth:16}},
    basis:'authored-xyz-matches-rhyup',bodyIds:['body_0_surface','body_1_surface','body_0_curve']};
  const projected=interop.prepareBaroCadDocumentPrimitiveNativeRefsV2(result,options);
  const paths=['examples/gpu-scene/mesh-material-cpu-probe.mjs','examples/gpu-scene/material-shorthand-flow.mjs'];
  const files=await Promise.all(paths.map(path=>readFile(resolve(root,path))));
  const shaderSources=[files[0].toString('utf8').match(/const source='([^']+)';/)?.[1],
    files[1].toString('utf8').match(/\{name: 'nested', short: '([^']+)'/)?.[1]];
  const bindings=shaderSources.map((source,index)=>{check(source,'Original authored shader literal missing.');
    const compiled=gpu.compileMeshMaterial(source);check(compiled.ok,'Original authored shader refused.');
    return{material:compiled.material,uniforms:index===0?{timeSeconds:.5}:{}};
  });
  const refs=projected.map(entry=>entry.kind==='surface'
    ?{kind:'surface',modelId:entry.ref.modelId,surfaceId:entry.ref.geometryId}
    :{kind:'curve',modelId:entry.ref.modelId,curveId:entry.ref.geometryId});
  const camera={eye:[.02,.015,.04],target:[.002,.002,0],up:[0,1,0],fovYDegrees:45,near:.001,far:1};
  const frame={contextId:'native_scene_appearance',timeSeconds:0,poses:projected.map((entry,index)=>({
    targetId:entry.binding.bodyId,translation:index===2?[12,0,0]:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]}))};
  const surfaces=projected.filter(entry=>entry.kind==='surface');
  const input={version:1,source:{kind:'document',result,options,bindings:projected.map(entry=>entry.binding)},
    display:{motion:{frame,bindings:projected.map((entry,index)=>({contextId:frame.contextId,targetId:entry.binding.bodyId,ref:refs[index]})),
      basis:'part-xyz-matches-rhyup'},visibleGeometry:refs,camera},
    appearance:{lighting:{ambientStrength:.3,directionalStrength:.7,direction:[-.6,.8,1]},
      materials:surfaces.map((entry,index)=>({ref:{modelId:entry.ref.modelId,surfaceId:entry.ref.geometryId},binding:bindings[index]}))}};
  const context={mmToSceneUnit:.001,background:[.06,.09,.12]};
  return{input,context,manifest:{document:{path:documentPath,bytes:documentBytes.length,sha256:sha(documentBytes)},
    shaders:paths.map((path,index)=>({path,fileSHA256:sha(files[index]),sourceBytes:Buffer.byteLength(shaderSources[index]),sourceSHA256:sha(shaderSources[index])}))}};
}
function geometryRef(entry){return entry.kind==='surface'
  ?{kind:'surface',modelId:entry.ref.modelId,surfaceId:entry.ref.geometryId}
  :{kind:'curve',modelId:entry.ref.modelId,curveId:entry.ref.geometryId};}
function oracle(input,context,{gpu,interop}){
  const projected=interop.prepareBaroCadDocumentPrimitiveNativeRefsV2(input.source.result,input.source.options);
  const ordered=[...projected.filter(entry=>entry.kind==='surface'),...projected.filter(entry=>entry.kind==='curve')];
  const inventory=ordered.map(geometryRef),motion=input.display.motion;
  const entries=ordered.map((entry,index)=>{
    const ref=geometryRef(entry),binding=motion?.bindings.find(binding=>same(binding.ref,ref));
    const pose=binding&&motion.frame.poses.find(pose=>pose.targetId===binding.targetId);
    const transform=pose?{translationMm:pose.translation??[0,0,0],rotationXYZW:pose.rotation??[0,0,0,1],scale:pose.scale??[1,1,1]}:undefined;
    const fields={ref:copy(entry.ref),color:copy(PALETTE[index%PALETTE.length]),...(transform?{transform}: {})};
    return entry.kind==='surface'?{kind:'surface',packet:copy(entry.packet),...fields}
      :{kind:'curve',sampleVersion:entry.sampleVersion,sample:copy(entry.sample),basis:'authored-xyz-matches-rhyup',...fields};
  });
  const materials=input.appearance.materials.map(material=>({ref:{modelId:material.ref.modelId,geometryId:material.ref.surfaceId},binding:copy(material.binding)}));
  const full=gpu.preparePrimitiveSceneFrame({version:0,scene:{version:2,entries},options:{...copy(context),translate:[0,0,0],
    camera:copy(input.display.camera),lighting:copy(input.appearance.lighting)},particles:null,materials},'qualified-v2');
  const visibleEntries=full.frame.scene.entries.filter(entry=>input.display.visibleGeometry.some(ref=>same(ref,geometryRef(entry))));
  const prepared=visibleEntries.length===entries.length?full:gpu.preparePrimitiveSceneFrame({...full.frame,
    scene:{version:2,entries:visibleEntries}},visibleEntries.length?'qualified-v2':'viewport-v2');
  return{projected,inventory,prepared};
}
function knownDOMGuard(){
  const saved=[],reads=[];
  for(const key of['window','document','HTMLCanvasElement','WebGL2RenderingContext','requestAnimationFrame']){
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);saved.push({key,descriptor});
    Object.defineProperty(globalThis,key,{configurable:true,get(){reads.push(key);throw Error('CPU consumer read '+key);}});
  }
  return{reads,restore(){for(const{key,descriptor}of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}
function summary(prepared){return{keys:Object.keys(prepared).sort(),inventory:prepared.inventory,
  documentId:prepared.source.result.document.documentId,documentRevision:prepared.source.result.document.revision,
  assets:prepared.source.result.document.assets.map(asset=>({id:asset.id,revision:asset.revision,sourceSHA256:sha(asset.source)})),
  profile:prepared.prepared.profile,bounds:prepared.prepared.bounds,bufferBytes:prepared.prepared.bufferBytes,
  materials:prepared.prepared.frame.materials.map(material=>({ref:material.ref,uniforms:material.binding.uniforms,sourceSHA256:sha(material.binding.material.source)})),
  lighting:prepared.prepared.frame.options.lighting,camera:prepared.display.camera,
  preparedSignature:signature(prepared.prepared),buffers:prepared.prepared.primitives.map(entry=>({kind:entry.entry.kind,
    positionsSHA256:sha(new Uint8Array(entry.positions.buffer,entry.positions.byteOffset,entry.positions.byteLength))}))};}
async function qualify(){
  const guard=knownDOMGuard(),report={scope:'Viewer document appearance PURE CPU consumer; not mount/Open/save-codec/atomic replacement',mode,ok:false,cases:[],refusals:[]};
  try{
    const modules=await publicModules(),prepare=modules.viewer.prepareViewerNativeSceneAppearance;
    const{input,context,manifest}=await fixture(modules),original=copy({input,context});report.fixture=manifest;
    check(input.source.result.document.assets.length===2&&input.source.result.document.bodies.length===6
      &&input.source.result.compiledAssets.every(asset=>asset.model.objects.length===3),'Original complete canonical document scope differs.');
    const assertCase=(label,request=input,ctor=context)=>{
      const before=copy({request,ctor}),actual=prepare(request,ctor),independent=oracle(request,ctor,modules);
      report.cases.push({label,actual:summary(actual),sourceWholeBitMatch:same(actual.source.result,request.source.result),
        inventoryBitMatch:same(actual.inventory,independent.inventory),publicGPUWholeBitMatch:same(actual.prepared,independent.prepared)});
      check(Object.keys(actual).sort().join(',')==='context,display,format,inventory,prepared,source,version'
        &&actual.format==='barocss-viewer-native-scene-appearance'&&actual.version===0
        &&same(actual.source.result,request.source.result)&&same(actual.source.bindings,independent.projected.map(entry=>entry.binding))
        &&same(actual.inventory,independent.inventory)&&same(actual.context,ctor)&&same(actual.prepared,independent.prepared)
        &&same(before,{request,ctor}),'Whole public Viewer/GPU/source authority differs: '+label);
      return actual;
    };
    const first=assertCase('full original document/TEN namespaces/two authored shaders/all poses');
    check(first.prepared.frame.materials[0].binding.uniforms.timeSeconds===.5
      &&first.prepared.frame.materials[1].binding.uniforms.amount===.25,'Actual provider default/override missing.');
    check(!first.prepared.frame.scene.entries.filter(entry=>entry.kind==='surface').some(entry=>Object.hasOwn(entry,'basis')),'Surface must not gain Curve basis.');
    const override=copy(input);override.appearance.materials[1].binding.uniforms.amount=.75;assertCase('authored second shader override',override);
    const hidden=copy(input);hidden.display.visibleGeometry=hidden.display.visibleGeometry.filter(ref=>ref.kind==='surface');assertCase('hidden native Curve/full inventory validation',hidden);
    const empty=copy(input);empty.display.visibleGeometry=[];empty.appearance.materials=[];const blank=assertCase('all-hidden complete CPU source with empty visible frame',empty);
    check(blank.inventory.length===3&&blank.prepared.bounds===null&&blank.prepared.bufferBytes===0&&blank.prepared.profile==='viewport-v2','Empty canonical profile differs.');
    let getters=0,coercions=0;
    const refuses=(label,request,ctor=context)=>{let error;try{prepare(request,ctor);}catch(value){error=value;}
      report.refusals.push({label,error:describe(error)});check(error,'Expected refusal: '+label);
      check(same({input,context},original),'Failed preparation changed original fixture.');
    };
    const alter=mutate=>{const request=copy(input);mutate(request);return request;};
    refuses('native source family',alter(request=>{request.source={kind:'native',source:input.source.result.document.assets[0].source,options:{sourceVersion:0,countU:5,countV:5},basis:'authored-xyz-matches-rhyup'};}));
    refuses('stale document revision TEN',alter(request=>request.source.bindings[0].documentRevision++));
    refuses('stale asset revision TEN',alter(request=>request.source.bindings[0].assetRevision++));
    refuses('forged original Model TEN',alter(request=>request.source.bindings[0].modelId='forged'));
    refuses('changed original source authority',alter(request=>request.source.result.document.assets[0].source+=' '));
    refuses('wrong original native namespace material',alter(request=>request.appearance.materials[0].ref.modelId=input.source.result.compiledAssets[0].model.name));
    refuses('Curve material target',alter(request=>{const ref=request.display.visibleGeometry.find(ref=>ref.kind==='curve');request.appearance.materials[0].ref={modelId:ref.modelId,surfaceId:ref.curveId};}));
    refuses('hidden Surface material',alter(request=>request.display.visibleGeometry=request.display.visibleGeometry.filter(ref=>!same(ref,{kind:'surface',...request.appearance.materials[0].ref}))));
    refuses('duplicate material ref',alter(request=>request.appearance.materials[1].ref=copy(request.appearance.materials[0].ref)));
    refuses('foreign visibility',alter(request=>request.display.visibleGeometry[0].modelId='unknown'));
    refuses('duplicate visibility',alter(request=>request.display.visibleGeometry.push(copy(request.display.visibleGeometry[0]))));
    refuses('missing motion target',alter(request=>request.display.motion.frame.poses.pop()));
    refuses('nonunit quaternion',alter(request=>request.display.motion.frame.poses[0].rotation=[0,0,0,2]));
    refuses('unsafe hidden posed Surface',alter(request=>{const ref=request.display.visibleGeometry.find(ref=>ref.kind==='surface');
      request.display.visibleGeometry=request.display.visibleGeometry.filter(value=>!same(value,ref));request.appearance.materials=request.appearance.materials.filter(value=>!same(value.ref,{modelId:ref.modelId,surfaceId:ref.surfaceId}));
      const binding=request.display.motion.bindings.find(value=>same(value.ref,ref));request.display.motion.frame.poses.find(pose=>pose.targetId===binding.targetId).translation=[10000,0,0];}),{...context,mmToSceneUnit:.2});
    refuses('camera is explicit',alter(request=>request.display.camera=null));
    refuses('light strength invalid',alter(request=>request.appearance.lighting.ambientStrength=2));
    refuses('uniform outside actual declared range',alter(request=>request.appearance.materials[0].binding.uniforms.timeSeconds=3));
    refuses('constructor context range',input,{...context,mmToSceneUnit:0});
    refuses('extra envelope',{...copy(input),extra:1});
    refuses('root Proxy',new Proxy(input,{}));
    refuses('nested Proxy',alter(request=>request.appearance.materials[0].binding=new Proxy(request.appearance.materials[0].binding,{})));
    const accessor=copy(input);Object.defineProperty(accessor.source,'result',{enumerable:true,get(){getters++;return input.source.result;}});refuses('nested getter0',accessor);
    refuses('no numeric coercion',input,{...context,mmToSceneUnit:{valueOf(){coercions++;return .001;}}});
    const cyclic=copy(input);cyclic.display.motion.frame.poses[0].translation=cyclic;refuses('cycle',cyclic);
    refuses('UTF8 string budget',alter(request=>request.source.result.document.assets[0].source='é'.repeat(131073)));
    refuses('visited-value budget',alter(request=>request.source.result.report={oversized:Array.from({length:81},()=>Array(4096).fill(0))}));
    check(getters===0&&coercions===0,'Caller getter/coercion evaluated.');report.getterCalls=getters;report.coercionCalls=coercions;
    const frameBefore=copy(first.prepared.frame);first.prepared.primitives[0].positions[0]+=1;
    check(same(frameBefore,first.prepared.frame),'Execution view modified canonical native frame.');
    let frozen=false;try{first.source.result.document.assets[0].source='caller mutation';}catch{frozen=true;}
    check(same({input,context},original),'Result metadata modified original request.');
    const fresh=prepare(input,context);check(same(fresh.prepared,oracle(input,context,modules).prepared),'Another preparation reused changed execution views.');
    report.ownership={executionViewIndependent:true,anotherCallIndependent:true,originalInputBitMatch:true,wrapperMetadataFrozen:frozen};
    const parameterPath=resolve(outputDirectory(),mode+'-parameters.v8');
    await writeFile(parameterPath,serialize({input,context}),{flag:'wx'});
    report.parameters={path:parameterPath,sha256:sha(await readFile(parameterPath)),format:'private Node V8 runtime input+context; NOT Render authored codec'};
    const child=execFileSync(process.execPath,[resolve(evidence,mode+'-consumer.mjs'),'--cold','--parameters',parameterPath,
      '--root',root,'--evidence',evidence,'--mode',mode],{cwd:root,encoding:'utf8'});
    const cold=JSON.parse(child.trim().split('\n').at(-1));report.cold=cold;
    check(cold.ok&&cold.resultSignature.sha256===signature(fresh).sha256,'Cold public re-admission differs.');
    check(guard.reads.length===0,'Known DOM/backend global read.');report.knownDOMReads=guard.reads;report.ok=true;
  }catch(error){report.error=error.stack??String(error);report.knownDOMReads=[...guard.reads];}
  finally{guard.restore();}
  await save(mode+'-result.json',report);
  console.log(JSON.stringify({ok:report.ok,mode,cases:report.cases.length,refusals:report.refusals.length}));
  if(!report.ok)throw Error(report.error);
}
async function coldConsumer(){
  const parameterPath=option('--parameters');check(parameterPath,'Supply --parameters for a cold CPU consumer.');
  const{input,context}=deserialize(await readFile(parameterPath));
  const guard=knownDOMGuard();let report;
  try{const modules=await publicModules(),actual=modules.viewer.prepareViewerNativeSceneAppearance(input,context);
    const expected=oracle(input,context,modules);check(same(actual.prepared,expected.prepared),'Cold independent public GPU frame differs.');
    check(guard.reads.length===0,'Cold consumer read DOM/backend global.');report={ok:true,mode,resultSignature:signature(actual),knownDOMReads:guard.reads,
      scope:'Cold Node public runtime parameter re-admission only; not authored file Open/history/first mount'};
  }catch(error){report={ok:false,mode,error:error.stack??String(error),knownDOMReads:[...guard.reads]};}
  finally{guard.restore();}
  await save(mode+'-cold-result.json',report);console.log(JSON.stringify(report));
  if(!report.ok)throw Error(report.error);
}
if(has('--build'))await buildConsumer();
else if(has('--run'))await qualify();
else if(has('--cold'))await coldConsumer();
else console.log('Use --build [--compiled], then run the emitted consumer with --run. Supply --root and --evidence outside the checkout.');
