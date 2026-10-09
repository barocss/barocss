import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const args = process.argv.slice(2), buildOnly = args.includes('--build-only');
function argument(name, required = true) {
  const index = args.indexOf(name);
  if (index < 0) { if (required) throw new Error('Missing ' + name); return null; }
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('Missing value for ' + name);
  return resolve(args[index + 1]);
}
const output = argument('--output'), graphs = argument('--graphs', !buildOnly), meshes = argument('--meshes', !buildOnly);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const gpuManifest = JSON.parse(await readFile(resolve(repo, 'packages/barocss-gpu/package.json'), 'utf8'));
const gpuEntry = gpuManifest.exports['.'].import;
assert.equal(typeof gpuEntry, 'string');
const gpuClientEntry = '../../packages/barocss-gpu/' + gpuEntry.replace(/^\.\//, '');
const graphNames = ['authentic_single_current_arrays', 'three_shared_region_leaves', 'shared_height_parameter_edit', 'fourth_literal_extrusion_leaf', 'three_genuine_empty_leaves'];
const controlNames = ['containment_hole', 'strip_two_components', 'reverse_containment_empty'];
const colors = [[0.85, 0.2, 0.15], [0.15, 0.8, 0.25], [0.15, 0.35, 0.9], [0.95, 0.7, 0.1]];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
// JSON.stringify loses authored negative zero. Preserve all finite native numeric values.
function nativeJSON(value) {
  if (typeof value === 'number') { assert.ok(Number.isFinite(value)); return Object.is(value, -0) ? '-0' : JSON.stringify(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(nativeJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, child]) => JSON.stringify(key) + ':' + nativeJSON(child)).join(',') + '}';
}
const fixtures = new Map(), provenance = [];
await mkdir(output, {recursive: true});
if (!buildOnly) {
  const manifest = JSON.parse(await readFile(resolve(repo, 'packages/barocss-cad/package.json'), 'utf8'));
  const entry = manifest.exports['.'].import;
  assert.equal(typeof entry, 'string');
  const cad = await import(pathToFileURL(resolve(repo, 'packages/barocss-cad', entry)).href);
  const meshOptions = {meshId: 'shell_mesh', maximumVertices: 384, maximumTriangles: 288, maximumEdgePaths: 192, maximumNativeSamples: 1024};
  for (const name of graphNames) {
    const file = resolve(graphs, name + '.authored-graph.json'), bytes = await readFile(file);
    const current = cad.parseBooleanExtrusionFeatureGraph(bytes.toString('utf8'), {maximumParameterResolutions: 8, maximumFeatureEvaluations: 7});
    assert.deepEqual(cad.validateBooleanExtrusionFeatureGraph(current), current.report);
    const rows = current.features.filter(row => row.kind === 'normal-extrusion');
    assert.ok(rows.length >= 1 && rows.length <= 4);
    const scene = {schema: 'barocss-gpu-boolean-shell-scene', version: 0, entries: rows.map((row, index) => {
      const native = cad.tessellateCoplanarFaceBooleanExtrusion(row.evaluation, meshOptions);
      assert.deepEqual(cad.validateCoplanarFaceBooleanExtrusionMesh(native), native.report);
      return {ref: {graphId: current.document.id, graphRevision: current.document.revision, featureId: row.featureId, outputSlotId: row.outputSlotId}, native, color: colors[index], edges: null};
    })};
    assert.deepEqual(scene.entries.map(e => [e.ref.featureId, e.ref.outputSlotId]), current.report.summary.extrusions.map(e => [e.featureId, e.outputSlotId]));
    const fixture = {name, authority: 'actual-current-compiled-CAD-authored-graph-parse-and-all-native-leaves', scene, graph: {id: current.document.id, revision: current.document.revision, sourceSHA256: sha256(bytes), distances: current.report.summary.extrusions.map(e => e.distanceMM)}};
    const text = nativeJSON(fixture) + '\n';
    assert.deepEqual(JSON.parse(text), fixture);
    fixtures.set(name, text);
    await writeFile(resolve(output, name + '.scene.json'), text);
    provenance.push({name, file, bytes: bytes.length, sha256: sha256(bytes), sceneSHA256: sha256(text), refs: scene.entries.map(e => e.ref), distances: fixture.graph.distances});
  }
  // Genuine #896 files are separate complete validated native controls, not graph cache authority.
  for (const name of controlNames) {
    const file = resolve(meshes, name + '.owned-extrusion-mesh.json'), bytes = await readFile(file), native = JSON.parse(bytes.toString('utf8'));
    assert.deepEqual(cad.validateCoplanarFaceBooleanExtrusionMesh(native), native.report);
    const fixture = {name, authority: 'actual-896-complete-native-file-control-with-explicit-caller-ref', scene: {schema: 'barocss-gpu-boolean-shell-scene', version: 0, entries: [{ref: {graphId: 'native_controls', graphRevision: 0, featureId: name, outputSlotId: 'control_shell'}, native, color: colors[0], edges: null}]}};
    const text = nativeJSON(fixture) + '\n'; assert.deepEqual(JSON.parse(text), fixture); fixtures.set(name, text);
    await writeFile(resolve(output, name + '.scene.json'), text);
    provenance.push({name, file, bytes: bytes.length, sha256: sha256(bytes), sceneSHA256: sha256(text), qualification: 'explicit-caller-control-not-CAD-graph-association'});
  }
  await writeFile(resolve(output, 'inputs.json'), JSON.stringify({cadEntry: resolve(repo, 'packages/barocss-cad', entry), cadCompiledSHA256: sha256(await readFile(resolve(repo, 'packages/barocss-cad', entry))), gpuEntry: resolve(repo, 'packages/barocss-gpu', gpuEntry), gpuCompiledSHA256: sha256(await readFile(resolve(repo, 'packages/barocss-gpu', gpuEntry))), provenance}, null, 2) + '\n');
}
const client = String.raw`
import {mountBooleanShellScene, prepareCamera} from '__GPU_ENTRY__';
const canvas = document.querySelector('canvas'), button = document.querySelector('button'), status = document.querySelector('pre');
const names = ['authentic_single_current_arrays','three_shared_region_leaves','shared_height_parameter_edit','fourth_literal_extrusion_leaf','three_genuine_empty_leaves','containment_hole','strip_two_components','reverse_containment_empty'];
const base = {mmToSceneUnit:0.05, translate:[0,0,0], background:[0.05,0.07,0.1], camera:{eye:[-0.85,-0.2,0.95], target:[-0.075,-0.2,-0.025], up:[0,1,0], fovYDegrees:45, near:0.01, far:10}};
const background = base.background.map(n => Math.round(n*255));
function check(value,message){if(!value)throw new Error(message);}
function same(a,b){if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
function hash(bytes){let h=2166136261;for(const byte of bytes)h=Math.imul(h^byte,16777619);return(h>>>0).toString(16);}
function world(p,options=base){return p.map((n,i)=>n*options.mmToSceneUnit+options.translate[i]);}
function center(native,face){const points=native.mesh.positionsMM.slice(face.vertexStart*3,(face.vertexStart+face.vertexCount)*3);return [0,1,2].map(axis=>points.filter((_,i)=>i%3===axis).reduce((a,b)=>a+b,0)/face.vertexCount);}
function cameraFor(native){const face=native.faceRanges.find(f=>f.kind==='top-cap');if(!face)return structuredClone(base.camera);const target=world(center(native,face));const normal=native.mesh.normals.slice(face.vertexStart*3,face.vertexStart*3+3);return {...base.camera,target,eye:target.map((n,i)=>n+normal[i]*1.8)};}
function projection(point,camera){const m=prepareCamera(camera,canvas.width/canvas.height);const mul=(matrix,p)=>[0,1,2,3].map(row=>[0,1,2,3].reduce((s,col)=>s+matrix[col*4+row]*p[col],0));const clip=mul(m.projection,mul(m.view,[...point,1]));return [Math.round((clip[0]/clip[3]+1)*canvas.width/2),Math.round((clip[1]/clip[3]+1)*canvas.height/2)];}
function pixel(bytes,p){const x=Math.max(0,Math.min(canvas.width-1,p[0])),y=Math.max(0,Math.min(canvas.height-1,p[1]));return [...bytes.slice((y*canvas.width+x)*4,(y*canvas.width+x)*4+3)];}
function material(rgb){return rgb.some((n,i)=>Math.abs(n-background[i])>2);}
function count(bytes){let n=0;for(let i=0;i<bytes.length;i+=4)if(material(bytes.slice(i,i+3)))n++;return n;}
function trianglePoint(native,face){const indices=face.triangles[0].vertexIndices;return [0,1,2].map(axis=>indices.reduce((s,i)=>s+native.mesh.positionsMM[i*3+axis],0)/3);}
button.addEventListener('click',async()=>{
 button.disabled=true;let renderer=null;const result={schema:'barocss-gpu-shell-scene-flow',version:0,actualGL:false,cases:[],refusals:[],failures:[],limits:{entries:4,vertices:1536,triangles:1152,truePaths:768,faces:320,shells:32,derivedGeometryBytes:77568,scope:'software WebGL2 actual bounded correctness; not GPU memory/performance or CAD shape certification'}};
 try{
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true});check(gl,'Actual WebGL2 unavailable');
  const uploads=[],events=[];
  const bufferData=gl.bufferData.bind(gl);gl.bufferData=(target,data,usage)=>{bufferData(target,data,usage);if(ArrayBuffer.isView(data)){const actual=new data.constructor(data.length);gl.getBufferSubData(target,0,actual);check(same([...actual],[...data]),'Actual GPU buffer read differs from upload');uploads.push({target,type:data.constructor.name,values:[...actual]});}};
  const drawElements=gl.drawElements.bind(gl);gl.drawElements=(mode,...args)=>{events.push({kind:'draw',mode,depth:gl.getParameter(gl.DEPTH_FUNC),write:gl.getParameter(gl.DEPTH_WRITEMASK)});return drawElements(mode,...args);};
  const clear=gl.clear.bind(gl);gl.clear=bits=>{events.push({kind:'clear',bits});return clear(bits);};
  const files=[];for(const name of names){const response=await fetch('/fixture/'+name);check(response.ok,'Authentic fixture unavailable');const bytes=await response.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);files.push({...JSON.parse(new TextDecoder().decode(bytes)),sha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')});}
  const highest=scene=>{const occupied=scene.entries.filter(e=>e.native.mesh.indices.length);check(occupied.every(e=>typeof e.native.extrusion.options.distanceMM==='number'&&Number.isFinite(e.native.extrusion.options.distanceMM)),'Native extrusion distance identity unavailable');return occupied.sort((a,b)=>b.native.extrusion.options.distanceMM-a.native.extrusion.options.distanceMM)[0];};
  const fixedCamera=cameraFor(highest(files.find(f=>f.name==='fourth_literal_extrusion_leaf').scene).native);
  const optionsFor=scene=>({...base,camera:highest(scene)?cameraFor(highest(scene).native):base.camera});
  function adopt(scene,options){uploads.length=0;events.length=0;if(!renderer)renderer=mountBooleanShellScene(canvas,scene,options);else check(renderer.update(scene,options).ok,'Complete native scene update refused');check(same(renderer.scene,scene),'Qualified native scene or original data changed');check(same(renderer.options,options),'Explicit options changed');}
  function witnessUploads(scene,options){for(const entry of scene.entries){if(!entry.native.mesh.indices.length)continue;const expected=entry.native.mesh.positionsMM.map((n,i)=>Math.fround(n*options.mmToSceneUnit+options.translate[i%3]));check(uploads.some(u=>u.type==='Float32Array'&&same(u.values,expected)),'Original XYZ not uploaded exactly once-converted');check(uploads.some(u=>u.type==='Float32Array'&&same(u.values,entry.native.mesh.normals.map(Math.fround))),'Native hard normals upload missing');check(uploads.some(u=>u.type==='Uint16Array'&&same(u.values,entry.native.mesh.indices)),'Native triangle indices upload missing');if(entry.edges){const edges=entry.native.edgePaths.flatMap(p=>p.samples.flatMap(s=>s.curveD1.point)).map((n,i)=>Math.fround(n*options.mmToSceneUnit+options.translate[i%3]));check(uploads.some(u=>u.type==='Float32Array'&&same(u.values,edges)),'True native Curve path upload missing');}}
  }
  const snapshots=new Map();
  for(const file of files){const options=['three_shared_region_leaves','shared_height_parameter_edit'].includes(file.name)?{...base,camera:fixedCamera}:optionsFor(file.scene);adopt(file.scene,options);witnessUploads(file.scene,options);const bytes=renderer.readPixels(),n=count(bytes),isEmpty=file.scene.entries.every(e=>!e.native.mesh.indices.length);check(isEmpty?n===0&&renderer.empty:n>300&&!renderer.empty,'Filled/empty native scene pixels mismatch');check(renderer.scene.entries.length===file.scene.entries.length,'Returned leaf dropped');
   if(file.name==='containment_hole'){const native=file.scene.entries[0].native,top=native.faceRanges.find(f=>f.kind==='top-cap'),hole=top.loops.find(l=>l.role==='hole');check(hole,'Authentic native hole missing');const vertices=[...new Set(hole.uses.flatMap(u=>u.effectiveVertexIndices))];const p=[0,1,2].map(axis=>vertices.reduce((s,i)=>s+native.mesh.positionsMM[i*3+axis],0)/vertices.length);check(!material(pixel(bytes,projection(world(p),options.camera))),'Genuine native hole filled');}
   if(file.name==='strip_two_components'){const native=file.scene.entries[0].native;check(native.shellRanges.length===2,'Genuine native two components missing');for(const face of native.faceRanges.filter(f=>f.kind==='top-cap'))check(material(pixel(bytes,projection(world(trianglePoint(native,face)),options.camera))),'Component cap not visible');}
   const resources=renderer.resourceCounts;for(const [key,limit] of Object.entries({programs:4,shaders:4,vertexArrays:16,buffers:40,framebuffers:2,textures:2,renderbuffers:2}))check(resources[key]<=limit,'Owned handle cap exceeded: '+key);check(gl.getError()===gl.NO_ERROR,'Actual GL error');snapshots.set(file.name,hash(bytes));result.cases.push({name:file.name,authority:file.authority,sha256:file.sha256,graph:file.graph,refs:renderer.scene.entries.map(e=>e.ref),leafCount:file.scene.entries.length,geometry:{vertices:file.scene.entries.reduce((n,e)=>n+e.native.mesh.positionsMM.length/3,0),triangles:file.scene.entries.reduce((n,e)=>n+e.native.mesh.indices.length/3,0),truePaths:file.scene.entries.reduce((n,e)=>n+e.native.edgePaths.length,0),faces:file.scene.entries.reduce((n,e)=>n+e.native.faceRanges.length,0),shells:file.scene.entries.reduce((n,e)=>n+e.native.shellRanges.length,0)},pixels:n,pixelHash:hash(bytes),resources:renderer.resourceCounts});
  }
  check(snapshots.get('three_shared_region_leaves')!==snapshots.get('shared_height_parameter_edit'),'Authored independent distance edit did not change actual frame');
  const four=files.find(f=>f.name==='fourth_literal_extrusion_leaf').scene,three=files.find(f=>f.name==='three_shared_region_leaves').scene;
  // Two entries are an explicit subset of actual returned leaves; full three/four were admitted above.
  const two={...three,entries:three.entries.slice(0,2)};adopt(two,optionsFor(two));check(count(renderer.readPixels())>300,'Explicit two-leaf native scene has no filled pixels');result.cases.push({name:'explicit_two_leaf_subset',leafCount:2,refs:renderer.scene.entries.map(e=>e.ref),pixelHash:hash(renderer.readPixels())});
  // Same genuine native IDs may occur under two distinct caller qualifications. This control is not a claim of CAD graph association.
  const sharedNative=three.entries[0].native,repeated={schema:'barocss-gpu-boolean-shell-scene',version:0,entries:[0,1].map(index=>({ref:{graphId:'native_controls',graphRevision:0,featureId:'shared_'+index,outputSlotId:'original_shell'},native:sharedNative,color:[0.4,0.6,0.8],edges:null}))};check(typeof sharedNative.mesh.id==='string'&&sharedNative.mesh.id.length>0&&sharedNative.mesh.id===sharedNative.options.meshId,'Genuine native mesh identity unavailable');adopt(repeated,optionsFor(repeated));check(count(renderer.readPixels())>300&&renderer.scene.entries[0].native.mesh.id===renderer.scene.entries[1].native.mesh.id,'Repeated native IDs across qualified leaves refused');result.repeatedNativeIds={refs:renderer.scene.entries.map(e=>e.ref),nativeId:sharedNative.mesh.id,qualification:'explicit caller control, not CAD graph association'};
  // Highest top cap is strictly closer to this camera than every overlapping lower cap.
  const near=highest(four),depthOptions={...base,camera:cameraFor(near.native)},top=near.native.faceRanges.find(f=>f.kind==='top-cap'),sample=projection(world(trianglePoint(near.native,top)),depthOptions.camera);
  const nearOnly={...four,entries:[near]};adopt(nearOnly,depthOptions);const expectedPixel=pixel(renderer.readPixels(),sample);check(material(expectedPixel),'Depth witness has no actual near cap pixel');
  const far=four.entries[0],farOnly={...four,entries:[far]};adopt(farOnly,depthOptions);const farPixel=pixel(renderer.readPixels(),sample);check(material(farPixel)&&!same(farPixel,expectedPixel),'Depth witness lacks overlapping differently colored far pixel');
  adopt(four,depthOptions);const forwardPixel=pixel(renderer.readPixels(),sample);check(same(forwardPixel,expectedPixel),'Far leaf overwrote closer native cap');
  const reversed={...four,entries:[...four.entries].reverse()};adopt(reversed,depthOptions);const reversedPixel=pixel(renderer.readPixels(),sample);check(same(reversedPixel,expectedPixel),'Shared depth changed with input order');result.sharedDepth={sample,expectedPixel,farPixel,forwardPixel,reversedPixel,nearRef:near.ref,comparison:'actual single near/far caps vs full forward/reversed scene; strict separated-depth opaque overlap only'};
  const edgeScene={...four,entries:four.entries.map(e=>({...e,edges:{color:[0.95,0.9,0.1]}}))};adopt(edgeScene,depthOptions);witnessUploads(edgeScene,depthOptions);const firstLine=events.findIndex(e=>e.kind==='draw'&&e.mode===gl.LINES),lastTriangle=events.findLastIndex(e=>e.kind==='draw'&&e.mode===gl.TRIANGLES);check(firstLine>lastTriangle&&lastTriangle>=0,'Edges drawn before all filled leaves');check(events.filter(e=>e.kind==='clear').length===1,'Shared candidate frame cleared more than once');check(events.filter(e=>e.kind==='draw'&&e.mode===gl.TRIANGLES).every(e=>e.depth===gl.LESS&&e.write),'Filled depth state mismatch');check(events.filter(e=>e.kind==='draw'&&e.mode===gl.LINES).every(e=>e.depth===gl.LEQUAL&&!e.write),'True edge depth state mismatch');result.sharedDepthSequence=events;
  const accepted=renderer.scene,acceptedOptions=renderer.options,acceptedCounts=renderer.resourceCounts,acceptedHash=hash(renderer.readPixels());
  function retained(label,input,options=acceptedOptions){check(!renderer.update(input,options).ok,label+' accepted');check(same(renderer.scene,accepted)&&same(renderer.options,acceptedOptions)&&same(renderer.resourceCounts,acceptedCounts)&&hash(renderer.readPixels())===acceptedHash,label+' changed accepted metadata/frame/resources');result.refusals.push(label);}
  const duplicate=structuredClone(accepted);duplicate.entries[1].ref=structuredClone(duplicate.entries[0].ref);retained('duplicate qualified tuple',duplicate);
  const excess=structuredClone(accepted);excess.entries.push({...structuredClone(excess.entries[0]),ref:{...excess.entries[0].ref,featureId:'fifth_leaf'}});retained('fifth entry',excess);
  const forged=structuredClone(accepted);forged.entries[2].native.faceRanges[0].surfaceId='forged_surface';retained('forged native face',forged);
  let getterCalled=false;const accessor=structuredClone(accepted);Object.defineProperty(accessor.entries[2],'color',{enumerable:true,get(){getterCalled=true;throw new Error('Do not invoke caller getter');}});retained('caller accessor',accessor);check(!getterCalled,'Caller getter was invoked');
  const createBuffer=gl.createBuffer.bind(gl);let allocations=0;gl.createBuffer=()=>++allocations===4?null:createBuffer();try{retained('late fourth buffer allocation',accepted);}finally{gl.createBuffer=createBuffer;}check(allocations===4,'Late allocation refusal was not reached');result.lateAllocationCount=allocations;
  retained('invalid conversion',accepted,{...acceptedOptions,mmToSceneUnit:0});
  const sceneCopy=renderer.scene;sceneCopy.entries[0].ref.featureId='mutated_copy';sceneCopy.entries[0].native.mesh.positionsMM[0]=999;const optionCopy=renderer.options;optionCopy.translate[0]=999;const boundsCopy=renderer.bounds;if(boundsCopy)boundsCopy.min[0]=999;renderer.render();check(same(renderer.scene,accepted)&&same(renderer.options,acceptedOptions)&&hash(renderer.readPixels())===acceptedHash,'Copied getter authority changed');
  const input=structuredClone(accepted);adopt(input,acceptedOptions);const callerHash=hash(renderer.readPixels());input.entries[0].ref.featureId='caller_changed';input.entries[0].native.mesh.positionsMM[0]=999;renderer.render();check(same(renderer.scene,accepted)&&hash(renderer.readPixels())===callerHash,'Caller mutation changed authority');
  uploads.length=0;check(renderer.setOptions({...acceptedOptions,camera:{...acceptedOptions.camera,eye:[-0.95,0.3,1.15]}}).ok,'Camera update refused');check(count(renderer.readPixels())>300&&same(renderer.scene,accepted),'Camera changed native scene or lost material');
  renderer.resize(480,360);check(count(renderer.readPixels())>300&&same(renderer.scene,accepted),'Resize changed authority/lost material');renderer.resize(640,480);check(renderer.setOptions(acceptedOptions).ok,'Restore explicit camera refused');
  const converted={...acceptedOptions,mmToSceneUnit:0.04,translate:[0.01,0.02,0.03]};uploads.length=0;check(renderer.setOptions(converted).ok,'Changed conversion refused');witnessUploads(accepted,converted);check(same(renderer.scene,accepted),'View conversion changed native source');check(renderer.setOptions(acceptedOptions).ok,'Restore conversion refused');
  const emptyScene={schema:'barocss-gpu-boolean-shell-scene',version:0,entries:[]};adopt(emptyScene,base);check(renderer.empty&&renderer.bounds===null&&count(renderer.readPixels())===0,'Empty complete scene not a clear frame');adopt(accepted,acceptedOptions);
  check(gl.getError()===gl.NO_ERROR,'Actual final GL error');const cpuScene=renderer.scene,cpuOptions=renderer.options,loss=gl.getExtension('WEBGL_lose_context');check(loss,'Actual context-loss extension unavailable');const lost=new Promise(resolve=>canvas.addEventListener('webglcontextlost',resolve,{once:true}));loss.loseContext();await lost;check(!renderer.update(cpuScene,cpuOptions).ok&&same(renderer.scene,cpuScene)&&same(renderer.options,cpuOptions),'Context loss changed CPU authority');let refused=false;try{renderer.readPixels();}catch{refused=true;}check(refused,'Lost-context pixels accepted');renderer.dispose();renderer.dispose();check(Object.values(renderer.resourceCounts).every(n=>n===0),'Owned resource handles leaked');result.disposedResources=renderer.resourceCounts;result.actualGL=true;status.textContent='PASS '+JSON.stringify(result);document.body.dataset.result='pass';
 }catch(error){result.failures.push(String(error.stack||error));status.textContent='FAIL '+result.failures[0];document.body.dataset.result='fail';if(renderer)renderer.dispose();}
 await fetch('/receipt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(result)});
});
`;
const resolvedClient = client.replace('__GPU_ENTRY__', gpuClientEntry);
await build({stdin:{contents:resolvedClient,resolveDir:resolve(repo,'examples/gpu-scene'),sourcefile:'shell-scene-client.mjs',loader:'js'},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:resolve(output,'client.mjs')});
const html='<!doctype html><html><head><meta charset="utf-8"><title>Qualified native Shell shared-depth flow</title></head><body><canvas width="640" height="480"></canvas><button>Run actual Shell scene flow</button><pre>Pending actual WebGL2 proof</pre><script type="module" src="/client.mjs"></script></body></html>';
await writeFile(resolve(output,'client-source.mjs'),resolvedClient);await writeFile(resolve(output,'index.html'),html);
if(buildOnly){await writeFile(resolve(output,'build-only.json'),JSON.stringify({schema:'shell-scene-build-only',actualGL:false,browserRun:false,serverStarted:false,clientCompiled:true},null,2)+'\n');console.log('Actual-flow client compiled; no native reconstruction, server, browser or GL execution.');}
else {
 const server=createServer(async(request,response)=>{
  try {
   if(request.url==='/'&&request.method==='GET'){response.setHeader('content-type','text/html');response.end(html);return;}
   if(request.url==='/client.mjs'&&request.method==='GET'){response.setHeader('content-type','text/javascript');response.end(await readFile(resolve(output,'client.mjs')));return;}
   if(request.method==='GET'&&request.url?.startsWith('/fixture/')){const text=fixtures.get(request.url.slice(9));if(!text)throw new Error('Unknown native fixture');response.setHeader('content-type','application/json');response.end(text);return;}
   if(request.url==='/receipt'&&request.method==='POST'){let body='';for await(const chunk of request){body+=chunk;if(body.length>262144)throw new Error('Receipt budget exceeded');}const receipt=JSON.parse(body);await writeFile(resolve(output,'actual-result.json'),JSON.stringify(receipt,null,2)+'\n');response.end('saved');console.log('Actual result received: '+JSON.stringify(receipt));return;}
   response.statusCode=404;response.end('Not found');
  }catch(error){response.statusCode=400;response.end(String(error));}
 });
 server.listen(52215,'127.0.0.1',()=>console.log('Own actual flow target http://127.0.0.1:52215/'));
}
