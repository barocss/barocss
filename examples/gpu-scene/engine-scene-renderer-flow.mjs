/** #1183 implementation-first import/admission receipt only.
 * node examples/gpu-scene/engine-scene-renderer-flow.mjs --output <fresh-directory>
 * No canvas, DOM, WebGL context, browser, mocked driver, rendering or pixels.
 * The canonical actual browser/render acceptance remains BLOCKED and unfulfilled.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const at=process.argv.indexOf('--output');assert(at>=0&&process.argv[at+1],'--output <fresh directory> required');
const output=resolve(process.argv[at+1]);await mkdir(output,{recursive:false});
assert.equal(typeof globalThis.document,'undefined','This receipt uses genuine Node without DOM');
assert.equal(typeof globalThis.HTMLCanvasElement,'undefined','No real or mocked canvas is installed');
const pkg=resolve(repo,'packages/barocss-gpu'),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8')),published=manifest.publishConfig.exports['.'];
assert.equal(published.import,'./dist/index.js');
const hash=x=>createHash('sha256').update(x).digest('hex');
async function receipt(path){const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:hash(bytes)};}
// Example-only original-scene JSON emitter preserves native signed zero.
function json(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(json).join(',')+']';return '{'+Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,n])=>JSON.stringify(k)+':'+json(n)).join(',')+'}';}
const clone=v=>JSON.parse(json(v));
function source(){
 const geometry={format:'barocss-gpu-triangle-geometry',version:0,id:'shared_triangle',coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',
  positions:[-0,-0,0,.5,0,0,0,.5,0],normals:[0,0,1,0,0,1,0,0,1],uvs:[-0,0,1,0,0,1],indices:[-0,1,2]};
 const transform={parentId:'root',translation:[-0,0,0],rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true};
 return {format:'barocss-gpu-engine-scene',version:0,id:'renderer_admission_scene',coordinateSystem:'right-handed-y-up',positionUnit:'scene',background:[.05,.1,.2],
  camera:{eye:[0,0,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100},geometries:[geometry],
  materials:[{id:'shared_unlit',type:'unlit',colorSpace:'linear',color:[.1,.7,.2]}],nodes:[
   {id:'left',type:'mesh',...transform,translation:[-1,0,0],geometryId:'shared_triangle',materialId:'shared_unlit'},
   {id:'root',type:'group',...transform,parentId:null},
   {id:'right',type:'mesh',...transform,translation:[1,0,0],geometryId:'shared_triangle',materialId:'shared_unlit'},
  ]};
}
const options={width:64,height:48};
const ordinary=resolve(output,'ordinary-source.mjs');
const bundle=await build({entryPoints:[resolve(pkg,manifest.exports['.'].import)],bundle:true,platform:'node',format:'esm',target:'node22',outfile:ordinary,metafile:true});
const graph=Object.keys(bundle.metafile.inputs);
for(const module of ['engine-scene-renderer.ts','engine-scene-shaders.ts','engine-scene.ts'])assert(graph.some(p=>p.endsWith('/src/'+module)),module+' actual source dependency');
assert(!graph.some(p=>/barocss-(gpu|cad)\/dist\//.test(p)),'Ordinary module graph must use actual source');
const publicDeclaration=resolve(pkg,published.types),rendererDeclaration=resolve(dirname(publicDeclaration),'engine-scene-renderer.d.ts');
const barrelText=await readFile(publicDeclaration,'utf8'),rendererTypes=await readFile(rendererDeclaration,'utf8');
for(const name of ['mountEngineScene','EngineSceneRenderer','EngineSceneRendererOptions'])assert(new RegExp('\\b'+name+'\\b').test(barrelText),name+' public declaration export');
assert(/export\s+declare\s+class\s+EngineSceneRenderer\b/.test(rendererTypes),'Actual renderer class declaration');
assert(/export\s+declare\s+function\s+mountEngineScene\b/.test(rendererTypes),'Actual mount declaration');
assert(/export\s+interface\s+EngineSceneRendererOptions\b/.test(rendererTypes),'Actual options type declaration');
for(const field of ['width','height'])assert(new RegExp('\\b'+field+'\\s*:\\s*number').test(rendererTypes),field+' numeric options type');
for(const method of ['getScene','render','update','resize','readPixels','dispose'])assert(new RegExp('\\b'+method+'\\s*\\(').test(rendererTypes),method+' declared renderer method');
const providers=[['ordinary-source',await import(pathToFileURL(ordinary).href)],['emitted-public',await import(pathToFileURL(resolve(pkg,published.import)).href)]];
assert.deepEqual(Object.keys(providers[0][1]).sort(),Object.keys(providers[1][1]).sort(),'Full dynamic public namespace agreement');
const results=[];let getterCalls=0;
for(const[name,gpu]of providers){
 for(const fn of ['prepareEngineScene','mountEngineScene','EngineSceneRenderer','EngineSceneError','GPUError'])assert.equal(typeof gpu[fn],'function',name+' runtime '+fn);
 for(const method of ['getScene','render','update','resize','readPixels','dispose'])assert.equal(typeof gpu.EngineSceneRenderer.prototype[method],'function',name+' class method '+method);
 const original=source(),bits=json(original),optionBits=json(options),prepared=gpu.prepareEngineScene(original);
 assert.deepEqual(prepared.scene,original);assert.equal(json(original),bits);assert.equal(prepared.draws.length,2);
 assert.strictEqual(prepared.draws[0].geometry,prepared.draws[1].geometry);assert.strictEqual(prepared.draws[0].material,prepared.draws[1].material);
 assert.deepEqual(prepared.draws.map(d=>d.id),['left','right']);assert.equal(prepared.bufferBytes,prepared.geometries[0].bufferBytes);assert.equal(prepared.vertexWork,6);
 assert(Object.is(prepared.scene.geometries[0].positions[0],-0));assert(Object.is(prepared.scene.geometries[0].uvs[0],-0));assert(Object.is(prepared.scene.geometries[0].indices[0],-0));
 assert(Object.isFrozen(prepared.scene));assert(Object.isFrozen(prepared.scene.geometries[0].positions));assert.notStrictEqual(prepared.scene.geometries[0].positions,original.geometries[0].positions);
 const scenePath=resolve(output,name+'.accepted.scene.json'),optionsPath=resolve(output,name+'.accepted.options.json');
 await writeFile(scenePath,bits+'\n');await writeFile(optionsPath,optionBits+'\n');
 const coldInput=JSON.parse(await readFile(scenePath,'utf8')),coldOptions=JSON.parse(await readFile(optionsPath,'utf8')),cold=gpu.prepareEngineScene(coldInput);
 assert.deepEqual(cold.scene,prepared.scene);assert.deepEqual(coldOptions,options);assert.notStrictEqual(cold.scene,prepared.scene);assert.notStrictEqual(cold.geometries[0].positions.buffer,prepared.geometries[0].positions.buffer);
 assert(Object.is(coldInput.geometries[0].positions[0],-0));
 const savedScene=await readFile(scenePath),savedOptions=await readFile(optionsPath),priorBits=json(prepared.scene),priorBuffers=Array.from(prepared.geometries[0].positions),checks=[];
 async function refused(label,action,errorClass,message=null,code=null,causeRequired=false){
  let error;try{action();}catch(e){error=e;}assert(error instanceof errorClass,label+' actual public error class');
  if(message!==null)assert.equal(error.message,message,label);if(code!==null)assert.equal(error.code,code,label);if(causeRequired)assert(error.cause instanceof Error,label+' actual dependent cause');
  assert.equal(getterCalls,0);assert.equal(json(original),bits);assert.equal(json(options),optionBits);assert.equal(json(prepared.scene),priorBits);
  assert.deepEqual(Array.from(prepared.geometries[0].positions),priorBuffers);assert.deepEqual(await readFile(scenePath),savedScene);assert.deepEqual(await readFile(optionsPath),savedOptions);
  checks.push({label,error:error.name,code:error.code??null,message:error.message,cause:error.cause?.message??null,getters:0,originalSourceOptionsPreparedResourcesAndFilesRetained:true});
 }
 // Null is deliberately not a canvas substitute. Reaching this exact refusal
 // shows source, options and camera admission finished before any GL acquisition.
 await refused('valid-cold-source-options-no-canvas',()=>gpu.mountEngineScene(null,coldInput,coldOptions),gpu.GPUError,'Engine renderer requires an HTMLCanvasElement');
 await refused('invalid-size-before-canvas',()=>gpu.mountEngineScene(null,original,{width:0,height:48}),gpu.GPUError,'Engine renderer dimensions must be integers in1..2048');
 const accessor={height:48};Object.defineProperty(accessor,'width',{enumerable:true,get(){getterCalls++;return 64;}});
 await refused('options-accessor-before-canvas',()=>gpu.mountEngineScene(null,original,accessor),gpu.GPUError,'Engine renderer options require exact own width/height data',null,true);
 const invalid=clone(original);invalid.nodes[0].geometryId='absent_resource';
 await refused('original-scene-reference-before-canvas',()=>gpu.mountEngineScene(null,invalid,options),gpu.EngineSceneError,null,'REFERENCE');
 const badCamera=clone(original);badCamera.camera.target=[0,0,6];
 await refused('original-scene-camera-cause-before-canvas',()=>gpu.mountEngineScene(null,badCamera,options),gpu.EngineSceneError,null,'CAMERA',true);
 results.push({provider:name,exports:Object.keys(gpu).sort(),source:await receipt(scenePath),options:await receipt(optionsPath),checks,
  sharedGeometryCPUAdmission:true,coldOriginalSourceReconstruction:true,rendererInstanceCreated:false});
}
assert.equal(typeof globalThis.document,'undefined');assert.equal(typeof globalThis.HTMLCanvasElement,'undefined');
const report={issue:1183,stage:'code-build-import-admission-only',graphicsGate:'BLOCKED',actualGL:false,actualBrowser:false,renderAcceptanceFulfilled:false,getterCalls,
 sourceGraph:graph,ordinary:await receipt(ordinary),emitted:await receipt(resolve(pkg,published.import)),publicDeclaration:await receipt(publicDeclaration),rendererDeclaration:await receipt(rendererDeclaration),results,
 support:'Actual Node source/emitted public imports, class/type exports, original generic shared scene admission, signed-zero source/cold file authority and real pre-canvas refusal order only. No DOM/canvas/context/mock GL, renderer instance, shader compile/link, resources, transactions, pixels, browser, editor, performance, parity or publication proof. Canonical same-target browser rendering flow remains BLOCKED and must be completed separately after policy restoration.'};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({issue:1183,stage:report.stage,providers:results.length,admissionRefusals:results.reduce((n,r)=>n+r.checks.length,0),getterCalls,actualGL:false,graphicsGate:'BLOCKED',renderAcceptanceFulfilled:false,exports:results[0].exports.length}));
