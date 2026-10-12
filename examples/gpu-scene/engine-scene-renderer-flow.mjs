/** #1183 default --output mode: actual Node source/emitted import/admission only.
 * --prepare-browser <fresh-directory> generates the future genuine WebGL2 client,
 * original fixtures, frozen pixel oracle and exact-origin evidence-only server.
 * Neither Node mode launches a browser/server or performs graphics verification.
 * The generated browser client may execute only after original-target policy restoration.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const prepareAt=process.argv.indexOf('--prepare-browser');
if(prepareAt>=0){assert(process.argv[prepareAt+1],'--prepare-browser <fresh directory> required');await prepareBrowserProof(resolve(process.argv[prepareAt+1]));process.exit(0);}
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

/** Preparation only: generates owned future browser evidence files. Never launches a server or tab. */
async function prepareBrowserProof(directory){
 await mkdir(directory,{recursive:false});
 const packageRoot=resolve(repo,'packages/barocss-gpu'),packageJSON=JSON.parse(await readFile(resolve(packageRoot,'package.json'),'utf8')),published=packageJSON.publishConfig.exports['.'];
 const sourceBundle=resolve(directory,'gpu-public.js');
 const bundled=await build({entryPoints:[resolve(packageRoot,packageJSON.exports['.'].import)],bundle:true,platform:'browser',format:'esm',target:'es2022',outfile:sourceBundle,metafile:true});
 const sourceGraph=Object.keys(bundled.metafile.inputs);assert(!sourceGraph.some(p=>/barocss-(gpu|cad)\/dist\//.test(p)));
 const emittedPath=resolve(directory,'gpu-emitted.js');await writeFile(emittedPath,await readFile(resolve(packageRoot,published.import)));
 const declarationPath=resolve(directory,'public-index.d.ts'),rendererTypesPath=resolve(directory,'engine-scene-renderer.d.ts');
 await writeFile(declarationPath,await readFile(resolve(packageRoot,published.types)));
 await writeFile(rendererTypesPath,await readFile(resolve(dirname(resolve(packageRoot,published.types)),'engine-scene-renderer.d.ts')));
 const fixture=preparedRendererFixture();
 await writeFile(resolve(directory,'original.scene.json'),preparedSignedJSON(fixture.scene)+'\n');
 await writeFile(resolve(directory,'original.options.json'),JSON.stringify(fixture.options)+'\n');
 await writeFile(resolve(directory,'planned.json'),JSON.stringify(fixture.plan,null,2)+'\n');
 await writeFile(resolve(directory,'browser-client.mjs'),'('+futureRendererBrowserFlow.toString()+')();\n');
 await writeFile(resolve(directory,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><title>GPU1183 prepared actual renderer proof</title><style>body{font:14px system-ui;margin:20px;background:#eee;color:#111}canvas{border:1px solid #555;display:block;margin:12px 0}pre{white-space:pre-wrap;max-width:1100px}</style><h1>GPU1183 actual browser proof</h1><p id="status">PREPARED — actual rendering is UNRUN until this original authorized target executes.</p><canvas id="proof" width="256" height="128"></canvas><p>Separate visible canvas for optional real context-loss lifecycle proof:</p><canvas id="loss-proof" width="64" height="64"></canvas><pre id="details">Requires browser policy restoration. No alternate browser, origin, port or driver.</pre><script type="module" src="/browser-client.mjs"></script></html>`);
 await writeFile(resolve(directory,'serve.py'),futureRendererServerSource());
 const files=[];for(const name of ['gpu-public.js','gpu-emitted.js','public-index.d.ts','engine-scene-renderer.d.ts','original.scene.json','original.options.json','planned.json','browser-client.mjs','index.html','serve.py']){
  const path=resolve(directory,name),bytes=await readFile(path);files.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 const setup={issue:1183,stage:'PREPARED',actualGL:'UNRUN',actualBrowser:'UNRUN',renderAcceptanceFulfilled:false,origin:'http://127.0.0.1:52215',sourceGraph,files,
  launch:{command:'python3 serve.py',workingDirectory:directory,url:'http://127.0.0.1:52215/'},
  policy:'Start only your own temporary server after coordinating the exact original port; preserve EADDRINUSE and never kill another lane. Actual browser access requires restoration of the original administrator policy. This preparation performs no server/browser/GL operation.',
  result:'Only future actual execution may create browser-results/*.json via the same-origin /browser-report endpoint. A prepared setup without an executed report is not graphics evidence.'};
 await writeFile(resolve(directory,'setup-prepared.json'),JSON.stringify(setup,null,2)+'\n');
 console.log(JSON.stringify({issue:1183,stage:'PREPARED',actualGL:'UNRUN',directory,serverStarted:false,browserOpened:false,renderAcceptanceFulfilled:false}));
}
function preparedSignedJSON(value){
 if(typeof value==='number'){assert(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(preparedSignedJSON).join(',')+']';
 return '{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,v])=>JSON.stringify(key)+':'+preparedSignedJSON(v)).join(',')+'}';
}
function preparedRendererFixture(){
 const header=id=>({format:'barocss-gpu-triangle-geometry',version:0,id,coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw'});
 const shared={...header('shared_triangle'),positions:[-.75,-.75,-0,.75,-.75,0,0,.75,0],normals:[0,0,1,0,0,1,0,0,1],uvs:[-0,0,1,0,.5,1],indices:[-0,1,2]};
 const count=65537,positions=Array(count*3).fill(0),normals=Array(count*3).fill(0),uvs=Array(count*2).fill(0);
 for(let i=0;i<count;i++)normals[3*i+2]=1;
 positions.splice(0,3,-.75,-.75,-0);positions.splice(3,3,.75,-.75,0);positions.splice(65536*3,3,0,.75,0);uvs[0]=-0;uvs[2]=1;uvs[65536*2]=.5;uvs[65536*2+1]=1;
 const large={...header('referenced_uint32'),positions,normals,uvs,indices:[-0,1,65536]};
 const mesh=(id,geometryId,materialId,translation)=>({id,type:'mesh',parentId:null,translation,rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true,geometryId,materialId});
 const materials=[{id:'green',type:'unlit',colorSpace:'linear',color:[.08,.5,.12]},{id:'red',type:'unlit',colorSpace:'linear',color:[.6,.03,.04]},{id:'blue',type:'unlit',colorSpace:'linear',color:[.04,.12,.65]}];
 const scene={format:'barocss-gpu-engine-scene',version:0,id:'actual_renderer_shared_depth_uint32',coordinateSystem:'right-handed-y-up',positionUnit:'scene',background:[.02,.04,.08],
  camera:{eye:[0,0,6],target:[0,0,0],up:[0,1,0],fovYDegrees:90,near:.1,far:100},geometries:[shared,large],materials,
  nodes:[mesh('far_red','shared_triangle','red',[-2,0,-1]),mesh('left_green','shared_triangle','green',[-2,0,-0]),mesh('right_green','shared_triangle','green',[2,0,0]),mesh('uint32_blue','referenced_uint32','blue',[0,1.5,0])]};
 const options={width:256,height:128};
 const encode=rgb=>rgb.map(c=>Math.round(255*(c<=.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-.055))).concat(255);
 const color=id=>encode(materials.find(m=>m.id===id).color),background=encode(scene.background);
 function windows(width,height,eyeZ,shift=0,mode='normal',farWitness=false){
  const project=point=>[width/2+point[0]*height/(2*Math.tan(Math.PI/4)*(eyeZ-point[2])),height/2+point[1]*height/(2*Math.tan(Math.PI/4)*(eyeZ-point[2]))];
  const make=(name,worldPoint,rgba,radius=1)=>{const point=project(worldPoint);return{name,worldPoint,projectedCenter:point,x:Math.floor(point[0]),y:Math.floor(point[1]),radius,expectedRGBA:rgba,toleranceUNORM8:2};};
  const left=mode==='empty'||mode==='hidden'?background:color('green'),other=mode==='empty'?background:null;
  const result=[make('left',[-2+shift,-.25,0],left),make('right',[2+shift,-.25,0],other??color('green')),make('uint32',[0,1.25,0],other??color('blue')),
   {name:'background',x:4,y:4,radius:1,expectedRGBA:background,toleranceUNORM8:2}];
  if(mode==='normal'&&farWitness)result.push(make('far-red-only',[-1.4+shift,-.65,-1],color('red'),0));
  if(shift)result.push(make('old-left-after-source-shift',[-2,-.25,0],background));
  return result;
 }
 const bary2=(point,triangle)=>{const[a,b,c]=triangle,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);const w=((b[1]-c[1])*(point[0]-c[0])+(c[0]-b[0])*(point[1]-c[1]))/den,u=((c[1]-a[1])*(point[0]-c[0])+(a[0]-c[0])*(point[1]-c[1]))/den;return[w,u,1-w-u];};
 const declaredFrames={initial:{width:256,height:128,eyeZ:6,windows:windows(256,128,6,0,'normal',true)},camera:{width:256,height:128,eyeZ:8,windows:windows(256,128,8)},resize:{width:128,height:128,eyeZ:8,windows:windows(128,128,8)},hidden:{width:128,height:128,eyeZ:8,windows:windows(128,128,8,0,'hidden')},empty:{width:128,height:128,eyeZ:8,windows:windows(128,128,8,0,'empty')},sameIdShift:{width:128,height:128,eyeZ:8,shift:.75,windows:windows(128,128,8,.75)}};
 for(const[name,frame]of Object.entries(declaredFrames)){
  const focal=1/Math.tan(Math.PI/4),near=.1,far=100;
  frame.cameraMatrices={view:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,-frame.eyeZ,1],projection:[focal/(frame.width/frame.height),0,0,0,0,focal,0,0,0,0,-(far+near)/(far-near),-1,0,0,-2*far*near/(far-near),0]};
  frame.drawOrder=name==='initial'?['far_red','left_green','right_green','uint32_blue']:name==='hidden'?['right_green','uint32_blue']:name==='empty'?[]:['left_green','right_green','far_red','uint32_blue'];
  const project=point=>[frame.width/2+point[0]*frame.height/(2*Math.tan(Math.PI/4)*(frame.eyeZ-point[2])),frame.height/2+point[1]*frame.height/(2*Math.tan(Math.PI/4)*(frame.eyeZ-point[2]))];
  const projectedTriangle=id=>{
   const node=scene.nodes.find(n=>n.id===id),geometry=scene.geometries.find(g=>g.id===node.geometryId);
   return geometry.indices.map(index=>project([0,1,2].map(axis=>geometry.positions[3*index+axis]+node.translation[axis]+(axis===0&&geometry.id==='shared_triangle'?(frame.shift??0):0))));
  };
  const visible=frame.drawOrder.map(id=>({id,triangle:projectedTriangle(id)}));
  const targetNames={left:'left_green',right:'right_green',uint32:'uint32_blue','far-red-only':'far_red'};
  for(const window of frame.windows){
   let target=targetNames[window.name]??null;
   if(name==='empty'||name==='hidden'&&window.name==='left')target=null;
   window.independentPixelPreflight=[];
   for(let y=window.y-window.radius;y<=window.y+window.radius;y++)for(let x=window.x-window.radius;x<=window.x+window.radius;x++){
    const centre=[x+.5,y+.5],weights=visible.map(({id,triangle})=>({id,barycentric:bary2(centre,triangle)}));
    if(target){const admitted=weights.find(row=>row.id===target);assert(admitted&&admitted.barycentric.every(v=>v>0),name+'/'+window.name+' planned pixel centre must be strictly inside its intended triangle');}
    else assert(weights.every(row=>row.barycentric.some(v=>v<0)),name+'/'+window.name+' planned background pixel centre must be outside all visible triangles');
    window.independentPixelPreflight.push({pixelCentre:centre,targetNodeId:target,projectedBarycentrics:weights,passed:true});
   }
   if(window.name==='far-red-only'){
    const centre=[window.x+.5,window.y+.5],far=bary2(centre,projectedTriangle('far_red')),left=bary2(centre,projectedTriangle('left_green')),right=bary2(centre,projectedTriangle('right_green'));
    assert(far.every(v=>v>0)&&left.some(v=>v<0)&&right.some(v=>v<0),'Fixed initial far-only pixel centre must be inside far and outside both near triangles');
    window.independentProjectionPreflight={pixelCentre:centre,farBarycentric:far,leftBarycentric:left,rightBarycentric:right,strictlyInsideFar:true,outsideBothNear:true};
   }
  }
 }
 const plan={issue:1183,status:'PREPARED',actualGL:'UNRUN',origin:'http://127.0.0.1:52215',pixelRows:'bottom-left',oracle:'independent looking-negative-Z perspective using original declared camera; windows fixed before any observation',
  fixture:{vertexCounts:[3,65537],visibleDraws:4,indexTypes:['uint16','uint16','uint16','uint32'],steadyHandles:{vertexArrays:2,buffers:8,programs:1,framebuffers:1,textures:1,renderbuffers:1,shaders:0,total:14},emptyHandles:4},
  declaredFrames};
 return{scene,options,plan};
}
function futureRendererServerSource(){return String.raw`#!/usr/bin/env python3
# Owned evidence-only static server. Exact original target; no auto-browser or alternate port.
import datetime, json, pathlib, sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
ROOT = pathlib.Path(__file__).resolve().parent
ORIGIN = 'http://127.0.0.1:52215'
class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript', '.js': 'text/javascript'}
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def allowed_asset(self):
        route = self.path.split('?', 1)[0]
        allowed = {'/', '/index.html', '/gpu-public.js', '/gpu-emitted.js',
                   '/public-index.d.ts', '/engine-scene-renderer.d.ts',
                   '/original.scene.json', '/original.options.json', '/planned.json',
                   '/browser-client.mjs', '/setup-prepared.json'}
        if route == '/favicon.ico':
            self.send_response(204); self.end_headers(); return False
        if route not in allowed:
            self.send_error(404); return False
        return True
    def do_GET(self):
        if self.allowed_asset():
            super().do_GET()
    def do_HEAD(self):
        if self.allowed_asset():
            super().do_HEAD()
    def do_POST(self):
        if self.path != '/browser-report':
            self.send_error(404); return
        if self.headers.get('Origin', ORIGIN) != ORIGIN:
            self.send_error(403); return
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            self.send_error(415); return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 8 * 1024 * 1024:
                self.send_error(413); return
            raw = self.rfile.read(length)
            if len(raw) != length:
                self.send_error(400); return
            data = json.loads(raw)
            if not isinstance(data, dict) or data.get('issue') != 1183:
                self.send_error(400); return
        except (ValueError, UnicodeDecodeError):
            self.send_error(400); return
        destination = ROOT / 'browser-results'
        destination.mkdir(exist_ok=True)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        target = destination / ('actual-' + stamp + '.json')
        # Caller supplies no file path. Only this owned evidence directory is written.
        with target.open('xb') as output:
            output.write(raw)
        result = json.dumps({'saved': str(target.relative_to(ROOT))}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(result)))
        self.end_headers(); self.wfile.write(result)
try:
    server = ThreadingHTTPServer(('127.0.0.1', 52215), Handler)
except OSError as error:
    print('Exact proof port unavailable; preserve EADDRINUSE and coordinate its owner. ' + str(error), file=sys.stderr)
    raise SystemExit(1)
print('Owned proof server at ' + ORIGIN + '; no browser launched.', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
`;}

/** Serialized into the prepared client; runs only inside the future actual authorized browser. */
async function futureRendererBrowserFlow(){
 const status=document.getElementById('status'),details=document.getElementById('details');
 const report={issue:1183,stage:'ACTUAL_BROWSER_EXECUTION',origin:location.origin,status:'RUNNING',actualGL:false,renderAcceptanceFulfilled:false,frames:[],operations:[],consoleEvents:[],contexts:[]};
 const controllers=[];let renderer=null,lossRenderer=null,stage='origin';
 const log=(kind,value)=>{report.consoleEvents.push({kind,value});console.info('GPU1183 '+kind,value);};
 window.addEventListener('error',event=>report.consoleEvents.push({kind:'window-error',message:event.message}));
 window.addEventListener('unhandledrejection',event=>report.consoleEvents.push({kind:'unhandled-rejection',message:String(event.reason)}));
 const assert=(condition,message)=>{if(!condition)throw new Error(message);};
 function signed(value){if(typeof value==='number')return Object.is(value,-0)?'-0':JSON.stringify(value);if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(signed).join(',')+']';return '{'+Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,n])=>JSON.stringify(key)+':'+signed(n)).join(',')+'}';}
 const clone=value=>JSON.parse(signed(value));
 const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 const textSHA=text=>sha(new TextEncoder().encode(text));
 function encoded(bytes){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);}
 function instrumentation(canvas){
  assert(canvas instanceof HTMLCanvasElement,'Actual HTMLCanvasElement required');
  const nativeGetContext=canvas.getContext.bind(canvas),live={vertexArrays:new Set(),buffers:new Set(),programs:new Set(),framebuffers:new Set(),textures:new Set(),renderbuffers:new Set(),shaders:new Set()},names=new Map(),calls=[],errors=[],faults=[];
  let native=null,forwarding=null,identity=0,boundVAO=null,injectDepth=false,currentColor=null;const uniformNames=new Map();
  const creates={createVertexArray:'vertexArrays',createBuffer:'buffers',createProgram:'programs',createFramebuffer:'framebuffers',createTexture:'textures',createRenderbuffer:'renderbuffers',createShader:'shaders'};
  const deletes={deleteVertexArray:'vertexArrays',deleteBuffer:'buffers',deleteProgram:'programs',deleteFramebuffer:'framebuffers',deleteTexture:'textures',deleteRenderbuffer:'renderbuffers',deleteShader:'shaders'};
  Object.defineProperty(canvas,'getContext',{configurable:true,value(...args){
   const actual=nativeGetContext(...args);if(args[0]!=='webgl2'||actual===null)return actual;
   assert(actual instanceof WebGL2RenderingContext,'Actual WebGL2 native context required');
   if(native){assert(native===actual,'This proof canvas must retain its one actual context');return forwarding;}
   native=actual;report.actualGL=true;const wrappers=new Map();
   forwarding=new Proxy(actual,{get(target,key){
    const value=Reflect.get(target,key,target);if(typeof value!=='function')return value;if(wrappers.has(key))return wrappers.get(key);
    const wrapper=(...params)=>{
     if(key==='createRenderbuffer'&&injectDepth){injectDepth=false;faults.push({method:key,injection:'declared candidate depth-renderbuffer null',nativeDriverCall:false});return null;}
     const result=value.apply(target,params);
     if(creates[key]&&result!==null){live[creates[key]].add(result);names.set(result,++identity);}
     if(deletes[key]&&params[0]!==null)live[deletes[key]].delete(params[0]);
     if(key==='bindVertexArray')boundVAO=params[0];
     if(key==='getUniformLocation'&&result!==null)uniformNames.set(result,params[1]);
     if(key==='uniform3fv')currentColor=Array.from(params[1]);
     if(key==='drawElements')calls.push({method:key,mode:params[0],count:params[1],type:params[2],offset:params[3],vao:names.get(boundVAO)??null,color:currentColor?.slice()??null});
     else if(key==='uniformMatrix4fv')calls.push({method:key,uniformName:uniformNames.get(params[0])??null,transpose:params[1],values:Array.from(params[2])});
     else if(key==='bufferData')calls.push({method:key,target:params[0],bytes:typeof params[1]==='number'?params[1]:params[1]?.byteLength??null,usage:params[2]});
     else if(key==='getShaderParameter'||key==='getProgramParameter'||key==='checkFramebufferStatus')calls.push({method:key,pname:params[1]??params[0],result});
     else if(['enable','disable','depthFunc','depthMask','frontFace','cullFace','texStorage2D','renderbufferStorage','blitFramebuffer'].includes(key))calls.push({method:key,args:params});
     if(key==='getError')errors.push(result);
     return result;
    };wrappers.set(key,wrapper);return wrapper;
   }});return forwarding;
  }});
  const snapshot=()=>Object.fromEntries(Object.entries(live).map(([key,set])=>[key,Array.from(set,handle=>names.get(handle)).sort((a,b)=>a-b)]));
  const counts=()=>{const value=Object.fromEntries(Object.entries(live).map(([key,set])=>[key,set.size]));value.total=Object.values(value).reduce((sum,n)=>sum+n,0);return value;};
  const controller={canvas,live,calls,errors,faults,snapshot,counts,get native(){return native;},get gl(){return forwarding;},injectCandidateDepthNull(){injectDepth=true;},restore(){delete canvas.getContext;}};
  controllers.push(controller);return controller;
 }
 function equalBytes(a,b,message){assert(a.length===b.length&&a.every((n,i)=>n===b[i]),message);}
 function expectError(action,Class,label){let error;try{action();}catch(e){error=e;}assert(error instanceof Class,label+' must refuse with actual public error');return{class:error.name,message:error.message};}
 async function frame(label,instance,source,plan,controller){
  const declared=plan.declaredFrames[label];assert(declared,'Frame uses a predeclared plan');
  assert(controller.canvas.width===declared.width&&controller.canvas.height===declared.height,'Actual backing dimensions match declared frame');
  assert(source.camera.eye[2]===declared.eyeZ,'Actual authored camera matches declared oracle');
  assert(signed(instance.getScene())===signed(source),'Renderer retains complete original authored source');
  assert(instance.getScene()!==instance.getScene(),'CPU getters return fresh source copies');
  const cameraUploads={};
  for(const name of ['view','projection']){const upload=[...controller.calls].reverse().find(c=>c.method==='uniformMatrix4fv'&&c.uniformName===name);assert(upload&&upload.transpose===false,name+' actual active column-major uniform');const expected=declared.cameraMatrices[name].map(Math.fround);assert(upload.values.length===16&&upload.values.every((v,i)=>Math.abs(v-expected[i])<=1e-6),name+' actual uniform matches predeclared independent camera');cameraUploads[name]=upload.values;}
  const pixels=instance.readPixels(),observations=[];
  assert(pixels instanceof Uint8Array&&pixels.length===declared.width*declared.height*4,'Actual default RGBA readback dimensions');
  for(const window of declared.windows){
   const samples=[];assert(window.independentPixelPreflight?.length>0&&window.independentPixelPreflight.every(p=>p.passed),'Window pixel centres were numerically declared before readback');
   if(window.name==='far-red-only'){const pre=window.independentProjectionPreflight;assert(pre?.strictlyInsideFar&&pre.outsideBothNear,'Far witness has pre-readback independent numeric admission');}
   for(let y=window.y-window.radius;y<=window.y+window.radius;y++)for(let x=window.x-window.radius;x<=window.x+window.radius;x++){
    assert(x>=0&&y>=0&&x<declared.width&&y<declared.height,'Declared window remains inside target');
    const rgba=Array.from(pixels.slice((y*declared.width+x)*4,(y*declared.width+x)*4+4));
    assert(rgba[3]===255,label+'/'+window.name+' actual opaque alpha');
    for(let channel=0;channel<3;channel++)assert(Math.abs(rgba[channel]-window.expectedRGBA[channel])<=window.toleranceUNORM8,label+'/'+window.name+' predefined colour window');
    samples.push({pixel:[x,y],rgba});
   }
   observations.push({name:window.name,expectedRGBA:window.expectedRGBA,samples});
  }
  const sourceBytes=new TextEncoder().encode(signed(source));
  report.frames.push({label,width:declared.width,height:declared.height,cameraEyeZ:declared.eyeZ,sourceSHA256:await sha(sourceBytes),pixelSHA256:await sha(pixels),rgbaBase64:encoded(pixels),rowOrigin:'bottom-left',cameraUploads,windows:observations,liveHandles:controller.counts()});
  log('frame',label);return pixels;
 }
 function handles(controller,expected,label){const actual=controller.counts();for(const[key,value]of Object.entries(expected))assert(actual[key]===value,label+' actual '+key+' count');return actual;}
 async function post(){
  const response=await fetch('/browser-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});assert(response.ok,'Actual same-origin evidence save');report.saved=await response.json();
  details.textContent=JSON.stringify({status:report.status,stage:report.stage,frames:report.frames.map(f=>({label:f.label,pixelSHA256:f.pixelSHA256,liveHandles:f.liveHandles})),operations:report.operations,contextLoss:report.contextLoss,error:report.error,saved:report.saved},null,2);
 }
 try{
  assert(location.origin==='http://127.0.0.1:52215','Only the original authorized target origin is supported');
  status.textContent='RUNNING — actual WebGL2 proof; first failures remain evidence.';
  stage='public-source-emitted-imports';const gpu=await import('/gpu-public.js'),emitted=await import('/gpu-emitted.js');
  assert(JSON.stringify(Object.keys(gpu).sort())===JSON.stringify(Object.keys(emitted).sort()),'Actual public source/emitted runtime export names agree');
  const [sceneText,optionsText,plan,setup]=await Promise.all([fetch('/original.scene.json').then(r=>r.text()),fetch('/original.options.json').then(r=>r.text()),fetch('/planned.json').then(r=>r.json()),fetch('/setup-prepared.json').then(r=>r.json())]);
  const original=JSON.parse(sceneText),options=JSON.parse(optionsText),originalBits=signed(original),optionBits=signed(options);
  report.preparedArtifactReceipts=setup.files;report.publicExports=Object.keys(gpu).sort();report.originalSceneFileSHA256=await textSHA(sceneText);report.originalOptionsFileSHA256=await textSHA(optionsText);
  assert(plan.actualGL==='UNRUN','Prepared plan has no fabricated graphics receipt');
  const controller=instrumentation(document.getElementById('proof'));
  stage='original-mount';const beforeMount=controller.calls.length;renderer=gpu.mountEngineScene(controller.canvas,original,options);
  assert(signed(original)===originalBits&&signed(options)===optionBits,'Mount preserves source/options including signed zero');
  const initialDraws=controller.calls.slice(beforeMount).filter(c=>c.method==='drawElements');
  assert(initialDraws.length===4,'Initial actual draw count4');
  const materialRGB=id=>original.materials.find(m=>m.id===id).color;
  assert(initialDraws.every((draw,i)=>draw.color?.every((n,j)=>Math.abs(n-materialRGB(['red','green','green','blue'][i])[j])<=1e-6)),'Actual initial declared material/draw order');assert(initialDraws.slice(0,3).every(c=>c.type===controller.gl.UNSIGNED_SHORT)&&initialDraws[3].type===controller.gl.UNSIGNED_INT,'Actual uint16/uint32 drawElements types');
  assert(initialDraws[0].vao===initialDraws[1].vao&&initialDraws[1].vao===initialDraws[2].vao&&initialDraws[3].vao!==initialDraws[0].vao,'Actual shared geometry uploads/VAOs');
  assert(controller.calls.slice(beforeMount).filter(c=>c.method==='bufferData').length===8,'Each of two resources uploads four arrays exactly once');
  handles(controller,plan.fixture.steadyHandles,'initial');
  const gl=controller.gl;
  assert(controller.calls.some(c=>c.method==='depthFunc'&&c.args[0]===gl.LESS)&&controller.calls.some(c=>c.method==='depthMask'&&c.args[0]===true),'Actual common depth LESS/write state');
  assert(controller.calls.filter(c=>c.method==='checkFramebufferStatus').every(c=>c.result===gl.FRAMEBUFFER_COMPLETE),'Actual candidate framebuffer completeness');
  assert(controller.calls.some(c=>c.method==='getShaderParameter'&&c.pname===gl.COMPILE_STATUS&&c.result===true)&&controller.calls.some(c=>c.method==='getProgramParameter'&&c.pname===gl.LINK_STATUS&&c.result===true),'Actual trusted shader compile/link');
  const initialPixels=await frame('initial',renderer,original,plan,controller);
  stage='camera-source-update-with-far-after-near';const cameraSource=clone(original);cameraSource.camera.eye[2]=8;
  cameraSource.nodes=[cameraSource.nodes.find(n=>n.id==='left_green'),cameraSource.nodes.find(n=>n.id==='right_green'),cameraSource.nodes.find(n=>n.id==='far_red'),cameraSource.nodes.find(n=>n.id==='uint32_blue')];
  const cameraCalls=controller.calls.length;assert(renderer.update(cameraSource).ok,'Actual camera/source update');
  const cameraDraws=controller.calls.slice(cameraCalls).filter(c=>c.method==='drawElements');assert(cameraDraws.length===4,'Camera update draw delta4');
  assert(cameraDraws.every((draw,i)=>draw.color?.every((n,j)=>Math.abs(n-materialRGB(['green','green','red','blue'][i])[j])<=1e-6)),'Actual far-after-near camera draw order');
  await frame('camera',renderer,cameraSource,plan,controller);handles(controller,plan.fixture.steadyHandles,'camera update');
  report.operations.push({kind:'camera-update',declaredDrawOrder:plan.declaredFrames.camera.drawOrder,depthFarNowDrawnAfterNear:true});
  stage='explicit-resize';renderer.resize(128,128);await frame('resize',renderer,cameraSource,plan,controller);handles(controller,plan.fixture.steadyHandles,'resize');
  stage='live-refusals-retain-accepted';const savedPixels=renderer.readPixels(),savedSource=signed(renderer.getScene()),savedSize=[controller.canvas.width,controller.canvas.height],savedHandles=JSON.stringify(controller.snapshot());
  const invalid=clone(cameraSource);invalid.nodes[0].geometryId='absent_resource';const invalidCalls=controller.calls.length,invalidResult=renderer.update(invalid);
  assert(!invalidResult.ok&&invalidResult.error instanceof gpu.EngineSceneError&&invalidResult.error.code==='REFERENCE','Actual original reference refusal');
  assert(controller.calls.length===invalidCalls,'Pure reference refusal does not reach GL methods');
  equalBytes(renderer.readPixels(),savedPixels,'Reference refusal retains actual prior default RGBA');assert(signed(renderer.getScene())===savedSource,'Reference refusal retains source');assert(JSON.stringify(controller.snapshot())===savedHandles,'Reference refusal retains live handle IDs');
  controller.injectCandidateDepthNull();const injected=renderer.update(cameraSource);assert(!injected.ok&&injected.error instanceof gpu.GPUError,'Declared late real-GL-forwarded allocation failure');
  assert(controller.faults.length===1,'Exactly one declared depth-renderbuffer-null injection');
  equalBytes(renderer.readPixels(),savedPixels,'Injected candidate failure retains prior default RGBA');assert(signed(renderer.getScene())===savedSource,'Injected failure retains original source');assert(JSON.stringify([controller.canvas.width,controller.canvas.height])===JSON.stringify(savedSize),'Injected failure retains accepted backing');assert(JSON.stringify(controller.snapshot())===savedHandles,'Injected failure releases only candidate handles');
  report.operations.push({kind:'refusals',reference:{name:invalidResult.error.name,code:invalidResult.error.code},injection:{name:injected.error.name,message:injected.error.message,scope:controller.faults[0]},priorPixelSHA256:await sha(savedPixels),retainedSourceSHA256:await textSHA(savedSource),retainedSize:savedSize,retainedHandleIds:controller.snapshot()});
  stage='hidden-and-empty';const hidden=clone(cameraSource);for(const node of hidden.nodes)if(node.id==='left_green'||node.id==='far_red')node.visible=false;
  assert(renderer.update(hidden).ok,'Actual hidden source update');await frame('hidden',renderer,hidden,plan,controller);
  const empty=clone(cameraSource);empty.nodes=[];const emptyCalls=controller.calls.length;assert(renderer.update(empty).ok,'Actual empty scene update');
  assert(controller.calls.slice(emptyCalls).filter(c=>c.method==='drawElements').length===0,'True empty draws no dummy geometry');await frame('empty',renderer,empty,plan,controller);handles(controller,{total:4,vertexArrays:0,buffers:0,programs:1,framebuffers:1,textures:1,renderbuffers:1,shaders:0},'empty');
  stage='unchanged-id-changed-original-geometry';const changed=clone(cameraSource);const geometry=changed.geometries.find(g=>g.id==='shared_triangle');for(let i=0;i<geometry.positions.length;i+=3)geometry.positions[i]+=.75;
  const changedCalls=controller.calls.length;assert(renderer.update(changed).ok,'Actual changed source geometry with same IDs');assert(controller.calls.slice(changedCalls).filter(c=>c.method==='bufferData').length===8,'Changed geometry stages fresh complete resources');await frame('sameIdShift',renderer,changed,plan,controller);
  stage='external-backing-guard';controller.canvas.width=129;
  const renderError=expectError(()=>renderer.render(),gpu.GPUError,'External backing render'),readError=expectError(()=>renderer.readPixels(),gpu.GPUError,'External backing read');
  const externalUpdate=renderer.update(changed);assert(!externalUpdate.ok&&externalUpdate.error instanceof gpu.GPUError,'External backing update refuses');
  assert(signed(renderer.getScene())===signed(changed),'External backing mutation retains accepted CPU source');
  renderer.resize(128,128);await frame('sameIdShift',renderer,changed,plan,controller);
  report.operations.push({kind:'external-backing-guard',renderError,readError,updateError:{name:externalUpdate.error.name,message:externalUpdate.error.message},priorPixelsPromised:false,explicitResizeRestoresOwnPresentation:true});
  stage='source-provider-live-double-dispose';renderer.dispose();renderer.dispose();renderer=null;handles(controller,{total:0},'source double disposal');
  assert(controller.errors.every(code=>code===controller.gl.NO_ERROR),'Actual live-context GL errors remain zero');
  stage='cold-file-emitted-public-remount';const coldScene=JSON.parse(await fetch('/original.scene.json').then(r=>r.text())),coldOptions=JSON.parse(await fetch('/original.options.json').then(r=>r.text()));
  assert(Object.is(coldScene.geometries[0].positions[2],-0)&&Object.is(coldScene.geometries[0].uvs[0],-0)&&Object.is(coldScene.geometries[0].indices[0],-0),'Actual saved original file retains signed zero');
  renderer=emitted.mountEngineScene(controller.canvas,coldScene,coldOptions);const coldPixels=await frame('initial',renderer,coldScene,plan,controller);equalBytes(coldPixels,initialPixels,'Cold original-file emitted provider reproduces complete original RGBA frame');
  assert(signed(coldScene)===originalBits,'Cold file native source authority retained');renderer.dispose();renderer.dispose();renderer=null;handles(controller,{total:0},'emitted double disposal');assert(controller.errors.every(code=>code===controller.gl.NO_ERROR),'All live-context source/emitted GL checks zero');
  stage='actual-context-loss-availability';const lossController=instrumentation(document.getElementById('loss-proof'));
  lossRenderer=gpu.mountEngineScene(lossController.canvas,clone(original),{width:64,height:64});
  const extension=lossController.gl.getExtension('WEBGL_lose_context');report.contextLoss={supported:extension!==null,sourceCPUOnlyAfterLoss:false};
  if(extension){
   const retained=signed(lossRenderer.getScene());const event=new Promise((resolve,reject)=>{lossController.canvas.addEventListener('webglcontextlost',resolve,{once:true});setTimeout(()=>reject(new Error('Actual context-loss event did not arrive within5000ms')),5000);});
   extension.loseContext();await event;assert(lossController.gl.isContextLost(),'Actual driver context is lost');
   report.contextLoss.render=expectError(()=>lossRenderer.render(),gpu.GPUError,'Lost render');report.contextLoss.read=expectError(()=>lossRenderer.readPixels(),gpu.GPUError,'Lost read');
   const update=lossRenderer.update(original);assert(!update.ok&&update.error instanceof gpu.GPUError,'Actual lost-context update refuses');
   assert(signed(lossRenderer.getScene())===retained,'Actual terminal loss retains accepted CPU source');report.contextLoss.sourceCPUOnlyAfterLoss=true;report.contextLoss.terminalNoAutomaticRestore=true;
  }else assert(lossController.errors.every(code=>code===lossController.gl.NO_ERROR),'Live optional loss context remains error-free when extension is unavailable');
  lossRenderer.dispose();lossRenderer.dispose();lossRenderer=null;handles(lossController,{total:0},'optional loss-canvas disposal');
  for(const control of controllers)report.contexts.push({canvasId:control.canvas.id,liveHandles:control.counts(),calls:control.calls,glErrorCodes:control.errors,faults:control.faults,lost:control.native?.isContextLost()??false});
  report.stage='ACTUAL_BROWSER_FLOW_COMPLETE';report.status='PASS';report.renderAcceptanceFulfilled=true;status.textContent='PASS — actual source/emitted WebGL2 flow complete; support limits retained.';
  report.support='Bounded genuine WebGL2 generic unlit/shared indexed geometry, ushort/uint draws, common depth, declared encoded-sRGB RGBA windows, original/cold files and scoped live rollback/resource/lifecycle controls. Declared allocation-null injection is not hardware OOM. No general performance/max-memory/editor/texture/lighting/Three.js parity/publication proof. Optional context-loss support is recorded separately; lost-driver resource reclamation is not certified.';
  await post();log('complete',{status:report.status,saved:report.saved});
 }catch(error){
  report.stage=stage;report.status='FAIL';report.error={name:error?.name??'Error',message:String(error?.message??error),stack:String(error?.stack??'')};
  console.error('GPU1183 actual first failure',report.error);status.textContent='FAIL — '+stage+'; exact first failure retained.';
  try{renderer?.dispose();renderer?.dispose();lossRenderer?.dispose();lossRenderer?.dispose();}catch(cleanup){report.cleanupError={message:String(cleanup?.message??cleanup)};}
  for(const control of controllers)report.contexts.push({canvasId:control.canvas.id,liveHandles:control.counts(),calls:control.calls,glErrorCodes:control.errors,faults:control.faults,lost:control.native?.isContextLost()??false});
  try{await post();}catch(save){details.textContent=JSON.stringify({report,saveError:String(save?.message??save)},null,2);console.error('GPU1183 actual report save failed',save);}
 }finally{for(const control of controllers)control.restore();}
}
