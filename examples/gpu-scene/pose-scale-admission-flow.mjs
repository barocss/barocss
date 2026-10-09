/** #1107: original native pose scalar admission; no successful or simulated GL. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const args=process.argv.slice(2),index=args.indexOf('--output');
assert(index>=0&&args[index+1],'--output <unique-directory> required');
const output=resolve(args[index+1]),repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
await mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function nativeJSON(value){
 if(typeof value==='number'){assert(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(nativeJSON).join(',')+']';
 return '{'+Object.entries(value).map(([key,item])=>JSON.stringify(key)+':'+nativeJSON(item)).join(',')+'}';
}
const minimum='0.'+'0'.repeat(323)+'5',tiny='0.'+'0'.repeat(319)+'1';
assert.equal(Number(minimum),Number.MIN_VALUE);
const cases=[
 {name:'minimum-positive-no-mask',raw:minimum,scale:.001,refusal:true},
 {name:'minimum-negative-no-mask',raw:'-'+minimum,scale:.001,refusal:true},
 {name:'minimum-masked-scene-translation',raw:minimum,scale:.001,translate:[0,0,1],refusal:true},
 {name:'alternate-x-minimum',raw:minimum,scale:.001,axis:0,refusal:true},
 {name:'exact-raw-zero',raw:'0',scale:.001},
 {name:'signed-raw-zero',raw:'-0',scale:.001},
 {name:'minimum-scale-one-then-translation',raw:minimum,scale:1,translate:[0,0,1]},
 {name:'minimum-scale-hundred-then-translation',raw:minimum,scale:100,translate:[0,0,1]},
 {name:'nonzero-scaled-subnormal-then-translation',raw:tiny,scale:.001,translate:[0,0,1]},
 {name:'half-turn-native-translation-cancellation',raw:'1',scale:1,rotation:[1,0,0,0],nativeTranslation:[0,0,1]},
 {name:'standard-nonzero',raw:'2',scale:.5}
];
function source(item,kind){
 const raw=item.raw,axis=item.axis??2;
 const geometry=kind==='surface'?
  '@surface #original_patch {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[0,0,1,1];control-points:[[[0,0,'+raw+'],[0,1,'+raw+']],[[1,0,'+raw+'],[1,1,'+raw+']]];weights:[[1,1],[1,1]];}':
  '@curve #original_line {type:nurbs;degree:1;knots:[0,0,1,1];control-points:'+(axis===0?'[['+raw+',0,0],['+raw+',1,0]]':'[[0,0,'+raw+'],[1,0,'+raw+']]')+';weights:[1,1];}';
 const sibling=kind==='selected'?'@curve #retained_sibling {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[2,3,4],[3,4,5]];weights:[1,1];}':'';
 return '@model pose_scale_native {version:0;length-unit:mm;'+geometry+sibling+'}';
}
const pkg=resolve(repo,'packages/barocss-gpu'),cadPkg=resolve(repo,'packages/barocss-cad');
const manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8')),published=manifest.publishConfig.exports['.'];
assert.equal(published.import,'./dist/index.js');assert.equal(published.types,'./dist/index.d.ts');
const compiledPath=resolve(pkg,published.import),typesPath=resolve(pkg,published.types);
const sourcePath=resolve(output,'ordinary-source-api.mjs'),cadPath=resolve(output,'ordinary-cad-source-api.mjs');
await build({entryPoints:[resolve(cadPkg,'src/index.ts')],bundle:true,format:'esm',platform:'node',target:'es2022',outfile:cadPath});
await build({entryPoints:[resolve(pkg,'src/index.ts')],bundle:true,format:'esm',platform:'node',target:'es2022',outfile:sourcePath});
const cad=await import(pathToFileURL(cadPath)),sourceAPI=await import(pathToFileURL(sourcePath)),compiledAPI=await import(pathToFileURL(compiledPath));
const exports=Object.keys(compiledAPI).sort(),types=await readFile(typesPath,'utf8');
assert.deepEqual(Object.keys(sourceAPI).sort(),exports);assert.equal(exports.length,52,'Frozen root export count differs');
const declarationNames=['prepareUniformCurvePreview','prepareSelectedUniformCurvePreview','mountPrimitiveSceneV2','mountMeshScene'];
for(const name of declarationNames)assert(types.includes(name),name+' missing from actual root declarations');
const receipts=[];
for(const [provider,api] of [['ordinary-source',sourceAPI],['compiled-public',compiledAPI]])for(const item of cases){
 for(const kind of item.axis===0?['curve','selected']:['curve','selected','surface']){
  const original=source(item,kind),file=resolve(output,item.name+'.'+kind+'.source0.css');
  await writeFile(file,original);assert.equal(await readFile(file,'utf8'),original);
  const native=cad.compileCadModel(original,{sourceVersion:0}),cold=cad.compileCadModel(await readFile(file,'utf8'),{sourceVersion:0});
  assert.equal(native.ok,true,JSON.stringify(native.diagnostics));assert.equal(cold.ok,true);assert.equal(nativeJSON(cold.model),nativeJSON(native.model));
  assert.equal(native.model.version,0);assert.equal(native.model.lengthUnit,'mm');assert.equal(native.model.objects.length,kind==='selected'?2:1);
  const geometry=native.model.objects[0],axis=item.axis??2,raw=Number(item.raw);
  assert.equal(geometry.id,kind==='surface'?'original_patch':'original_line');
  const control=kind==='surface'?geometry.controlPoints[0][0]:geometry.controlPoints[0];
  assert(Object.is(control[axis],raw),'Original native control value/sign differs');
  let packet=null,sample=null;
  if(kind==='surface'){
   packet=cad.tessellateSurface(geometry,{countU:2,countV:2,revision:0}).packet;
   assert.equal(nativeJSON(packet),nativeJSON(cad.tessellateSurface(cold.model.objects[0],{countU:2,countV:2,revision:0}).packet));
   assert.equal(packet.version,0);assert.equal(packet.lengthUnit,'mm');assert.equal(packet.coordinateSystem,'right-handed-y-up');assert.equal(packet.winding,'ccw');
   assert.equal(packet.positions.length,12);assert.equal(packet.indices.length,6);
  }else{
   const prepare=text=>kind==='selected'?api.prepareSelectedUniformCurvePreview({source:text,curveId:'original_line',count:2}):api.prepareUniformCurvePreview({source:text,count:2});
   sample=prepare(original);assert.equal(nativeJSON(sample),nativeJSON(prepare(await readFile(file,'utf8'))));
   assert.equal(sample.source,original);assert.equal(nativeJSON(sample.model),nativeJSON(native.model));assert.equal(sample.pointsMM.length,2);
  }
  const points=packet?packet.positions:sample.pointsMM.flat();
  assert(points.filter((_,i)=>i%3===axis).every(n=>n===raw),'Actual sampled native component differs');
  const authority={source:original,model:native.model,...(packet?{packet}:{sample})},authorityBits=nativeJSON(authority);
  const saved=resolve(output,provider+'.'+item.name+'.'+kind+'.native.json');
  await writeFile(saved,authorityBits+'\n');assert.equal(nativeJSON(JSON.parse(await readFile(saved,'utf8'))),authorityBits);
  const scale=[1,1,1];scale[axis]=item.scale;
  const transform={translationMm:item.nativeTranslation??[0,0,0],rotationXYZW:item.rotation??[0,0,0,1],scale};
  const options={mmToSceneUnit:1,translate:item.translate??[0,0,0],background:[0,0,0]},callerBits=nativeJSON({transform,options});
  const callerFile=resolve(output,provider+'.'+item.name+'.'+kind+'.caller.json');
  await writeFile(callerFile,callerBits+'\n');assert.equal(nativeJSON(JSON.parse(await readFile(callerFile,'utf8'))),callerBits);
  let contextRequests=0,contextKind=null,arrays=[],caught=null;
  const canvas={width:16,height:16,getContext(kind){contextRequests++;contextKind=kind;return null;}};
  const from=Float32Array.from;
  try{
   Float32Array.from=function(values,...rest){const result=from.call(this,values,...rest);arrays.push(Array.from(result));return result;};
   if(packet)api.mountMeshScene(canvas,[{packet,color:[1,1,1],transform}],options);
   else api.mountPrimitiveSceneV2(canvas,{version:2,entries:[{kind:'curve',sampleVersion:kind==='selected'?3:2,sample,basis:'authored-xyz-matches-rhyup',color:[1,1,1],ref:{modelId:native.model.name,geometryId:geometry.id},transform}]},options);
   assert.fail('Intentional NULL context cannot construct a renderer');
  }catch(error){caught=error;}finally{Float32Array.from=from;}
  if(item.refusal){
   assert(caught instanceof (packet?RangeError:api.GPUError),'Existing error type differs');assert(caught.message.includes('pose scaling'),item.name+': '+caught.message);
   assert.equal(contextRequests,0,'Unsafe pose reached context acquisition');assert.equal(arrays.length,0,'Unsafe pose allocated output Float32 arrays');
  }else{
   assert(caught instanceof api.GPUError);assert.equal(caught.message,'WebGL2 is unavailable');assert.equal(contextRequests,1);assert.equal(contextKind,'webgl2');
   assert.equal(arrays.length,packet?2:1);assert.equal(arrays[0].length,packet?12:6);
   const rotated=item.rotation?-raw*item.scale:raw*item.scale,expected=Math.fround(rotated+transform.translationMm[axis]+options.translate[axis]);
   assert(arrays[0].filter((_,i)=>i%3===axis).every(n=>n===expected),'Actual display component differs');
   assert.notDeepEqual(arrays[0].slice(0,3),arrays[0].slice(3,6),'Safe primitive edge collapsed');
   if(packet)assert.notDeepEqual(arrays[0].slice(0,3),arrays[0].slice(6,9),'Safe Surface second edge collapsed');
  }
  assert.equal(nativeJSON(authority),authorityBits,'Original native/source inputs changed');assert.equal(nativeJSON({transform,options}),callerBits,'Caller pose/options changed');
  receipts.push({provider,name:item.name,kind,axis,rawValue:raw,scaledValue:raw*item.scale,transform,options,callerSHA256:hash(callerBits),sourceSHA256:hash(original),nativeSHA256:hash(authorityBits),originalObjects:native.model.objects.map(o=>o.id),
   outcome:item.refusal?'refused':'intentional-null-context',contextRequests,error:{name:caught.name,message:caught.message},positions:arrays[0]??null,normals:packet?arrays[1]??null:null,
   sourceAndNativeRetained:true,coldOriginalSourceEqual:true,coldNativeFileEqual:true});
 }
}
assert.deepEqual(receipts.filter(r=>r.provider==='ordinary-source').map(({provider,...r})=>r),receipts.filter(r=>r.provider==='compiled-public').map(({provider,...r})=>r),'Source/compiled receipts differ');
const result={actualSourceAPI:true,actualGL:false,successfulRenderer:false,scope:'Original pose scalar CPU admission; NULL context instrumentation only, no Viewer reproduction or global rotation/addition precision guarantee',
 providers:{cadSource:{path:cadPath,sha256:hash(await readFile(cadPath))},ordinaryGPU:{path:sourcePath,sha256:hash(await readFile(sourcePath))},compiledGPU:{path:compiledPath,sha256:hash(await readFile(compiledPath))},
 declarations:{path:typesPath,sha256:hash(types),requiredNames:declarationNames},publicExports:exports,publicExportCount:exports.length,publishConfigExports:manifest.publishConfig.exports},cases:receipts};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({actualSourceAPI:true,actualGL:false,successfulRenderer:false,cases:receipts.length,refusals:receipts.filter(r=>r.outcome==='refused').length}));
