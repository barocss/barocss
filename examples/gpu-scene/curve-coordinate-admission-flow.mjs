/** #1102: actual native source/API CPU admission, never a fake WebGL renderer. */
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
 if(typeof value==='number')return Object.is(value,-0)?'-0':JSON.stringify(value);
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(nativeJSON).join(',')+']';
 return '{'+Object.entries(value).map(([key,item])=>JSON.stringify(key)+':'+nativeJSON(item)).join(',')+'}';
}
const tiny=zeros=>'0.'+'0'.repeat(zeros)+'1';
function source(y,{selected=false,start='0',end='1'}={}){
 const extra=selected?'@curve #unrendered {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[2,3,4],[3,4,5]];weights:[1,1];}':'';
 return '@model coordinate_flow {version:0;length-unit:mm;@curve #offset_line {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[['+start+','+y+',0],['+end+','+y+',0]];weights:[1,1];}'+extra+'}';
}
const pose=translationMm=>({translationMm,rotationXYZW:[0,0,0,1],scale:[1,1,1]});
const cases=[
 {name:'binary64-positive',y:tiny(319),scale:1e-10,refusal:'scene scaling'},
 {name:'binary64-negative',y:'-'+tiny(319),scale:1e-10,refusal:'scene scaling'},
 {name:'binary64-masked-translation',y:tiny(319),scale:1e-10,translate:[0,1,0],refusal:'scene scaling'},
 {name:'binary64-identity-pose',y:tiny(319),scale:1e-10,transform:pose([0,0,0]),refusal:'scene scaling'},
 {name:'float32-positive',y:tiny(39),scale:1e-10,refusal:'Float32 display'},
 {name:'float32-negative',y:'-'+tiny(39),scale:1e-10,refusal:'Float32 display'},
 {name:'float32-below-subnormal',y:tiny(35),scale:1e-10,refusal:'Float32 display'},
 {name:'selected-binary64',y:tiny(319),scale:1e-10,selected:true,refusal:'scene scaling'},
 {name:'selected-float32',y:tiny(39),scale:1e-10,selected:true,refusal:'Float32 display'},
 {name:'safe-subnormal',y:tiny(39),scale:1,expectedY:Math.fround(1e-40)},
 {name:'safe-scaled-subnormal',y:tiny(34),scale:1e-10,expectedY:Math.fround(1e-45)},
 {name:'exact-zero',y:'0',scale:1e-10,expectedY:0},
 {name:'signed-zero-source',y:'-0',scale:1,expectedY:0},
 {name:'legitimate-pose-cancellation',y:'1',scale:1,transform:pose([-.25,-1,0]),expectedY:0},
 {name:'pose-translation-before-scaling',y:tiny(319),scale:1e-10,transform:pose([0,1,0]),expectedY:Math.fround(1e-10)},
 {name:'selected-safe-original-siblings',y:'2',scale:.1,selected:true,expectedY:Math.fround(.2)},
 {name:'legacy-segment-collapse',y:'0',start:'1',end:'1.000000001',scale:1,refusal:'segment collapses'}
];
const pkg=resolve(repo,'packages/barocss-gpu'),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8'));
const published=manifest.publishConfig.exports['.'];
assert.equal(published.import,'./dist/index.js');assert.equal(published.types,'./dist/index.d.ts');
const compiledPath=resolve(pkg,published.import),declarationsPath=resolve(pkg,published.types);
const sourcePath=resolve(output,'ordinary-source-api.mjs');
await build({entryPoints:[resolve(pkg,'src/index.ts')],bundle:true,format:'esm',platform:'node',target:'es2022',outfile:sourcePath});
const sourceAPI=await import(pathToFileURL(sourcePath)),compiledAPI=await import(pathToFileURL(compiledPath));
assert.deepEqual(Object.keys(sourceAPI).sort(),Object.keys(compiledAPI).sort(),'source/compiled public exports differ');
const types=await readFile(declarationsPath,'utf8');
for(const name of ['mountPrimitiveSceneV1','mountPrimitiveSceneV2','prepareUniformCurvePreview','prepareSelectedUniformCurvePreview'])assert(types.includes(name),name+' absent from actual declarations');
const receipts=[];
for(const [provider,api] of [['ordinary-source',sourceAPI],['compiled-public',compiledAPI]]){
 for(const item of cases){
  const original=source(item.y,item),path=resolve(output,item.name+'.source0.css');
  await writeFile(path,original);assert.equal(await readFile(path,'utf8'),original);
  const prepare=text=>item.selected?api.prepareSelectedUniformCurvePreview({source:text,curveId:'offset_line',count:2}):api.prepareUniformCurvePreview({source:text,count:2});
  const sample=prepare(original),cold=prepare(await readFile(path,'utf8'));
  assert.equal(nativeJSON(cold),nativeJSON(sample),'cold source/native reconstruction differs');
  assert.equal(sample.source,original);assert.equal(sample.model.version,0);assert.equal(sample.model.lengthUnit,'mm');
  assert.equal(sample.model.objects.length,item.selected?2:1);assert.equal(sample.model.objects[0].id,'offset_line');
  const originalBits=nativeJSON(sample),options={mmToSceneUnit:item.scale,translate:item.translate??[0,0,0],background:[0,0,0]},optionsBits=nativeJSON(options);
  const entry={kind:'curve',sampleVersion:item.selected?3:2,sample,basis:'authored-xyz-matches-rhyup',color:[1,1,1],ref:{modelId:sample.model.name,geometryId:'offset_line'},...(item.transform?{transform:item.transform}:{})};
  let contextRequests=0,contextKind=null,arrays=[],caught=null;
  // This endpoint supplies no GL methods. Reaching it proves CPU preparation only.
  const canvas={width:16,height:16,getContext(kind){contextRequests++;contextKind=kind;return null;}};
  const from=Float32Array.from;
  try{
   Float32Array.from=function(values,...rest){const result=from.call(this,values,...rest);arrays.push(Array.from(result));return result;};
   api.mountPrimitiveSceneV2(canvas,{version:2,entries:[entry]},options);
   assert.fail('Intentional null context cannot construct a renderer');
  }catch(error){caught=error;}finally{Float32Array.from=from;}
  assert(caught instanceof api.GPUError,'actual existing GPUError required');
  if(item.refusal){
   assert.equal(contextRequests,0,item.name+' reached GL acquisition');
   assert(caught.message.includes(item.refusal),item.name+': '+caught.message);
   assert.equal(arrays.length,item.name==='legacy-segment-collapse'?1:0,'unexpected conversion allocation');
  }else{
   assert.equal(contextRequests,1,'safe CPU preparation did not reach context boundary');assert.equal(contextKind,'webgl2');
   assert.equal(caught.message,'WebGL2 is unavailable');assert.equal(arrays.length,1);assert.equal(arrays[0].length,6);
   assert.equal(arrays[0][1],item.expectedY);assert.equal(arrays[0][4],item.expectedY);
   assert.notEqual(arrays[0][0],arrays[0][3],'safe native segment collapsed');
  }
  assert.equal(nativeJSON(sample),originalBits,'native input changed');assert.equal(nativeJSON(options),optionsBits,'caller options changed');
  await writeFile(resolve(output,provider+'-'+item.name+'.native.json'),originalBits+'\n');
  receipts.push({provider,name:item.name,sourceSHA256:hash(original),sourceBytes:Buffer.byteLength(original),pointsMM:sample.pointsMM,nativeObjects:sample.model.objects.map(object=>object.id),contextRequests,error:{name:caught.name,message:caught.message},positions:arrays[0]??null,sourceAndNativeRetained:true,coldOriginalSourceEqual:true});
 }
}
const result={actualSourceAPI:true,actualGL:false,successfulRenderer:false,scope:'CPU admission and cold original-source files only; intentional null context; no browser or WebGL simulation',providers:{ordinarySourceSHA256:hash(await readFile(sourcePath)),compiledJS:compiledPath,compiledSHA256:hash(await readFile(compiledPath)),declarations:declarationsPath,declarationsSHA256:hash(types),publicExportCount:Object.keys(compiledAPI).length},cases:receipts,refusedPerProvider:cases.filter(item=>item.refusal).length,admittedToNullContextPerProvider:cases.filter(item=>!item.refusal).length};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({actualSourceAPI:true,actualGL:false,cases:receipts.length,refusedPerProvider:result.refusedPerProvider,admittedToNullContextPerProvider:result.admittedToNullContextPerProvider}));
