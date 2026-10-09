/** #1103: actual authored Surface CPU admission, with no simulated WebGL. */
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
const hash=value=>createHash('sha256').update(value).digest('hex');
function nativeJSON(value){
 if(typeof value==='number'){assert(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(nativeJSON).join(',')+']';
 return '{'+Object.entries(value).map(([key,item])=>JSON.stringify(key)+':'+nativeJSON(item)).join(',')+'}';
}
const tiny=zeros=>'0.'+'0'.repeat(zeros)+'1';
const pose=translationMm=>({translationMm,rotationXYZW:[0,0,0,1],scale:[1,1,1]});
function source(z,{start='0',end='1'}={}){
 return '@model surface_coordinate_flow {version:0;length-unit:mm;@surface #offset_patch {'+
  'type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[0,0,1,1];control-points:['+
  '[['+start+',0,'+z+'],['+start+',1,'+z+']],[['+end+',0,'+z+'],['+end+',1,'+z+']]];weights:[[1,1],[1,1]];}}';
}
const cases=[
 {name:'binary64-positive',z:tiny(319),scale:1e-10,refusal:'scene scaling'},
 {name:'binary64-negative',z:'-'+tiny(319),scale:1e-10,refusal:'scene scaling'},
 {name:'binary64-masked-scene-translation',z:tiny(319),scale:1e-10,translate:[0,0,1],refusal:'scene scaling'},
 {name:'binary64-identity-pose',z:tiny(319),scale:1e-10,refusal:'scene scaling'},
 {name:'float32-positive',z:tiny(39),scale:1e-6,refusal:'Float32 display'},
 {name:'float32-negative',z:'-'+tiny(39),scale:1e-6,refusal:'Float32 display'},
 {name:'float32-identity-pose',z:tiny(39),scale:1e-6,refusal:'Float32 display'},
 {name:'exact-zero',z:'0',scale:1e-10},
 {name:'signed-zero-source',z:'-0',scale:1},
 {name:'safe-float32-subnormal',z:tiny(39),scale:1},
 {name:'safe-scaled-float32-subnormal',z:tiny(34),scale:1e-10},
 {name:'posed-native-translation-cancellation',z:'1',scale:1,transform:pose([0,0,-1])},
 {name:'final-scene-translation-cancellation',z:'1',scale:1,translate:[0,0,-1]},
 {name:'pose-translation-before-scaling',z:tiny(319),scale:1e-10,transform:pose([0,0,1]),posedOnly:true},
 {name:'legacy-zero-area-after-float32',z:'0',start:'1',end:'1.000000001',scale:1,refusal:'zero area'}
];
const pkg=resolve(repo,'packages/barocss-gpu'),cadPkg=resolve(repo,'packages/barocss-cad');
const manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8')),published=manifest.publishConfig.exports['.'];
assert.equal(published.import,'./dist/index.js');assert.equal(published.types,'./dist/index.d.ts');
const compiledPath=resolve(pkg,published.import),declarationsPath=resolve(pkg,published.types);
const sourcePath=resolve(output,'ordinary-source-api.mjs'),cadPath=resolve(output,'ordinary-cad-source-api.mjs');
await build({entryPoints:[resolve(cadPkg,'src/index.ts')],bundle:true,format:'esm',platform:'node',target:'es2022',outfile:cadPath});
await build({entryPoints:[resolve(pkg,'src/index.ts')],bundle:true,format:'esm',platform:'node',target:'es2022',outfile:sourcePath});
const cad=await import(pathToFileURL(cadPath)),sourceAPI=await import(pathToFileURL(sourcePath)),compiledAPI=await import(pathToFileURL(compiledPath));
const exports=Object.keys(compiledAPI).sort(),types=await readFile(declarationsPath,'utf8');
assert.deepEqual(Object.keys(sourceAPI).sort(),exports,'Source/compiled public exports differ');
const declarationNames=['prepareMesh','validatePreviewPacket','mountMeshScene','MeshSceneRenderer'];
for(const name of declarationNames)assert(types.includes(name),name+' absent from actual root declarations');
const fixtures=[];
for(const item of cases){
 const original=source(item.z,item),path=resolve(output,item.name+'.source0.css');
 await writeFile(path,original);assert.equal(await readFile(path,'utf8'),original);
 const native=cad.compileCadModel(original,{sourceVersion:0}),cold=cad.compileCadModel(await readFile(path,'utf8'),{sourceVersion:0});
 assert.equal(native.ok,true,JSON.stringify(native.diagnostics));assert.equal(cold.ok,true);
 assert.equal(nativeJSON(cold.model),nativeJSON(native.model),'Cold original model differs');
 assert.equal(native.model.version,0);assert.equal(native.model.lengthUnit,'mm');assert.equal(native.model.objects.length,1);
 const surface=native.model.objects[0];assert.equal(surface.kind,'surface');assert.equal(surface.id,'offset_patch');
 assert.equal(surface.controlPoints.length,2);assert.equal(surface.controlPoints[0].length,2);
 if(item.z==='-0')assert(Object.is(surface.controlPoints[0][0][2],-0),'Original source signed zero lost');
 const sampling={countU:2,countV:2,revision:0},samplingBits=nativeJSON(sampling);
 const packet=cad.tessellateSurface(surface,sampling).packet,coldPacket=cad.tessellateSurface(cold.model.objects[0],sampling).packet;
 assert.equal(nativeJSON(sampling),samplingBits);assert.equal(nativeJSON(packet),nativeJSON(coldPacket));
 assert.equal(packet.version,0);assert.equal(packet.lengthUnit,'mm');assert.equal(packet.coordinateSystem,'right-handed-y-up');assert.equal(packet.winding,'ccw');
 assert.equal(packet.positions.length,12);assert.equal(packet.indices.length,6);
 assert(packet.positions.filter((_,i)=>i%3===2).every(z=>z===Number(item.z)),'Native sampled Z differs');
 const authority={source:original,model:native.model,packet},bits=nativeJSON(authority),file=resolve(output,item.name+'.native.json');
 await writeFile(file,bits+'\n');assert.equal(nativeJSON(JSON.parse(await readFile(file,'utf8'))),bits);
 fixtures.push({item,authority,bits,sourceSHA256:hash(original),nativeSHA256:hash(bits),coldOriginalSourceEqual:true});
}
const receipts=[];
for(const [provider,api] of [['ordinary-source',sourceAPI],['compiled-public',compiledAPI]])for(const fixture of fixtures){
 const {item,authority,bits}=fixture,packet=authority.packet;
 for(const route of item.posedOnly?['posed']:['direct','posed']){
  const options={mmToSceneUnit:item.scale,translate:item.translate??[0,0,0],background:[0,0,0]},directOptions={...options,color:[1,1,1]};
  const transform=item.transform??pose([0,0,0]),entries=[{packet,color:[1,1,1],transform}],callerBits=nativeJSON({options,directOptions,entries});
  let contextRequests=0,contextKind=null,arrays=[],caught=null,prepared=null;
  // NULL is an intentional CPU boundary. This object offers no WebGL methods.
  const canvas={width:16,height:16,getContext(kind){contextRequests++;contextKind=kind;return null;}};
  const from=Float32Array.from;
  try{
   Float32Array.from=function(values,...rest){const result=from.call(this,values,...rest);arrays.push(Array.from(result));return result;};
   if(route==='direct')prepared=api.prepareMesh(packet,directOptions);
   else{api.mountMeshScene(canvas,entries,options);assert.fail('NULL context cannot construct a renderer');}
  }catch(error){caught=error;}finally{Float32Array.from=from;}
  if(item.refusal){
   assert(caught instanceof RangeError,item.name+' requires existing RangeError');assert(caught.message.includes(item.refusal),item.name+': '+caught.message);
   assert.equal(contextRequests,0,'Unsafe data reached GL acquisition');assert.equal(prepared,null);
   assert.equal(arrays.length,item.refusal==='zero area'?2:0,'Unexpected output Float32 allocation');
  }else{
   assert.equal(arrays.length,2,'Positions/normals CPU arrays missing');assert.equal(arrays[0].length,12);
   const millimeters=route==='posed'?Number(item.z)+transform.translationMm[2]:Number(item.z);
   const expected=Math.fround(millimeters*item.scale+options.translate[2]);
   assert(arrays[0].filter((_,i)=>i%3===2).every(z=>Object.is(z,expected)||z===expected),'Converted Z differs');
   assert.notEqual(arrays[0][0],arrays[0][6],'Safe X edges collapsed');assert.notEqual(arrays[0][1],arrays[0][4],'Safe Y edges collapsed');
   if(route==='direct'){
    assert.equal(caught,null);assert.equal(contextRequests,0);assert(prepared.positions instanceof Float32Array);assert(prepared.normals instanceof Float32Array);assert(prepared.indices instanceof Uint16Array);
    assert.deepEqual(Array.from(prepared.positions),arrays[0]);assert.deepEqual(Array.from(prepared.indices),packet.indices);
    assert.notStrictEqual(prepared.packet,packet);assert.notStrictEqual(prepared.options,directOptions);assert.equal(nativeJSON(prepared.packet),nativeJSON(packet));
   }else{
    assert(caught instanceof api.GPUError);assert.equal(caught.message,'WebGL2 is unavailable');assert.equal(contextRequests,1);assert.equal(contextKind,'webgl2');
   }
  }
  assert.equal(nativeJSON(authority),bits,'Original source/model/packet changed');assert.equal(nativeJSON({options,directOptions,entries}),callerBits,'Caller options/pose changed');
  receipts.push({provider,route,name:item.name,sourceSHA256:fixture.sourceSHA256,nativeSHA256:fixture.nativeSHA256,contextRequests,
   outcome:item.refusal?'refused':route==='direct'?'actual-Float32-arrays':'intentional-null-context',error:caught?{name:caught.name,message:caught.message}:null,
   positions:arrays[0]??null,normals:arrays[1]??null,indices:prepared?Array.from(prepared.indices):null,sourceAndNativeRetained:true,coldOriginalSourceEqual:true});
 }
}
assert.deepEqual(receipts.filter(r=>r.provider==='ordinary-source').map(({provider,...r})=>r),receipts.filter(r=>r.provider==='compiled-public').map(({provider,...r})=>r),'Source/compiled admission differs');
const result={actualSourceAPI:true,actualGL:false,successfulRenderer:false,scope:'Direct GPU CPU admission and cold authored Source0 Surface files; posed NULL context, no Viewer reproduction or WebGL simulation',
 providers:{cadSource:{path:cadPath,sha256:hash(await readFile(cadPath))},ordinaryGPU:{path:sourcePath,sha256:hash(await readFile(sourcePath))},compiledGPU:{path:compiledPath,sha256:hash(await readFile(compiledPath))},
 declarations:{path:declarationsPath,sha256:hash(types),requiredNames:declarationNames},publicExportCount:exports.length,publicExports:exports,publishConfigExports:manifest.publishConfig.exports},cases:receipts};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({actualSourceAPI:true,actualGL:false,successfulRenderer:false,providers:2,cases:receipts.length,fixtures:fixtures.length,refusals:receipts.filter(r=>r.outcome==='refused').length}));
