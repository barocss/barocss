import { createViewer } from '@barocss/viewer';
import { loadBaroCadAssembly } from '@barocss/cad-interop/assembly';
import { loadBaroCadModelSet } from '@barocss/cad-interop/model-set';
import { updateCadAssembly, resolveCadGeometryReference, sampleCurveWideAdaptive } from '@barocss/cad';
import { createClothWorld } from '@barocss/physics/cloth';
import { PrimitiveSceneRendererV2, PrimitiveViewport } from '@barocss/gpu';

const check = (condition, message) => { if (!condition) throw new Error(message); };
const clone = value => structuredClone(value);
const same = (a,b) => Object.is(a,b) || !!a && !!b && typeof a === 'object' && typeof b === 'object'
  && Object.keys(a).length === Object.keys(b).length
  && Object.keys(a).every(key => Object.hasOwn(b,key) && same(a[key],b[key]));
const near = (a,b,tolerance=1e-7) => a.length === b.length && a.every((n,i) => Math.abs(n-b[i]) <= tolerance);
const hash = bytes => bytes.reduce((n,byte) => Math.imul(n ^ byte,16777619) >>> 0,2166136261);
const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
  .map(n => n.toString(16).padStart(2,'0')).join('');
const canvas = document.querySelector('#view'), status = document.querySelector('#status');
const list = document.querySelector('#instances'), inspection = document.querySelector('#inspection');
const filter = document.querySelector('#filter');
const buttons = Object.fromEntries(['revision0','revision1','fit','run-proof','lose-context','dispose']
  .map(id => [id,document.querySelector('#'+id)]));
const contexts = new Set(), resources = {}, uploads = [], errors = [], warnings = [];
let failedBufferAt=0,bufferAttempts=0;
for (const type of ['Buffer','Program','VertexArray','Framebuffer','Texture','Renderbuffer','Shader']) {
  const live = new Set(), p=WebGL2RenderingContext.prototype,create=p['create'+type],remove=p['delete'+type];
  resources[type]=live;
  p['create'+type]=function(...args) {
    if(type==='Buffer' && failedBufferAt && ++bufferAttempts===failedBufferAt) return null;
    const value=create.apply(this,args); if(value) live.add(value); return value;
  };
  p['delete'+type]=function(value) { live.delete(value); return remove.call(this,value); };
}
const getContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(kind,...args) {
  const value=getContext.call(this,kind,...args); if(kind==='webgl2' && value) contexts.add(value); return value;
};
const bufferData=WebGL2RenderingContext.prototype.bufferData;
WebGL2RenderingContext.prototype.bufferData=function(target,values,...args) {
  const result=bufferData.call(this,target,values,...args);
  if(ArrayBuffer.isView(values)) {
    const copied=new values.constructor(values.length); this.getBufferSubData(target,0,copied);
    uploads.push({type:values.constructor.name,values:Array.from(copied),bytes:values.byteLength,
      exactReadback:same(values,copied)});
  }
  return result;
};
window.addEventListener('error',event=>errors.push(event.message));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const warn=console.warn; console.warn=(...args)=>{warnings.push(args.map(String).join(' '));warn.apply(console,args);};
const defaultIDs=['child','surface_grandchild','shared_root','asset_b_instance'];
const options={native:{sourceVersion:0,countU:3,countV:3,
  curveDisplay:{version:1,chordToleranceMM:.01,maxSegments:64,maxDepth:8}},
  basis:'authored-xyz-matches-rhyup',instanceIds:[...defaultIDs]};
const mmToSceneUnit=.05;
const camera={eye:[.375,.25,2],target:[.375,.25,0],up:[0,1,0],fovYDegrees:45,near:.01,far:10};
const resourceCounts=()=>Object.fromEntries(Object.entries(resources).map(([key,live])=>[key,live.size]));
const glErrors=()=>[...contexts].map(gl=>gl.getError());
const sameRef=(a,b)=>a?.kind===b?.kind && a?.modelId===b?.modelId
  && (a?.kind==='surface'?a.surfaceId===b.surfaceId:a?.curveId===b?.curveId);
let viewer=null,assemblies=[],clothWorld=null,nativeSet=null,result=null,running=false,disposed=false;
const display=value=>status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
const pixels=()=>hash(viewer.readPixels());
function queryFor(binding) { return {assemblyId:binding.assemblyId,assemblyRevision:binding.assemblyRevision,
  instanceId:binding.instanceId,reference:clone(binding.reference),query:binding.ref.kind==='surface'
    ?{kind:'surface',u:.5,v:.5}:{kind:'curve',parameter:2}}; }
const showPoint=binding=>{ const point=viewer.queryAssemblyInstancePoint(queryFor(binding));
  inspection.textContent=JSON.stringify({instance:point.instanceId,revision:point.assemblyRevision,
    originalLocalPointMM:point.originalLocalPointMM,assemblyPointMM:point.assemblyPointMM,
    fullReference:point.reference,ancestors:point.ancestors,quality:point.report.quality},null,2); return point; };
function render() {
  const state=viewer.getState(),ready=state.status==='ready' && !disposed;
  for(const [id,button] of Object.entries(buttons)) button.disabled=id==='dispose'?disposed:!ready||running;
  filter.disabled=!ready||running;
  list.replaceChildren(...state.assemblyInstances.map(binding=>{
    const item=document.createElement('li'); item.dataset.instanceId=binding.instanceId;
    item.dataset.kind=binding.ref.kind; item.setAttribute('aria-selected',String(sameRef(state.selectedGeometry,binding.ref)));
    const title=document.createElement('strong'),lineage=document.createElement('small'),identity=document.createElement('small');
    title.textContent=binding.instanceId+' · '+binding.ref.kind+' · revision '+binding.assemblyRevision;
    lineage.textContent='Parent: '+(binding.parentId??'root')+' · Ancestors: '+(binding.ancestors.join(' → ')||'none');
    identity.textContent=JSON.stringify(binding.reference);
    const visible=state.visibleGeometry.some(ref=>sameRef(ref,binding.ref));
    const label=document.createElement('label'),toggle=document.createElement('input');
    toggle.type='checkbox';toggle.checked=visible;toggle.disabled=!ready;
    toggle.setAttribute('aria-label','Show '+binding.instanceId);label.append(toggle,' Show');
    toggle.addEventListener('change',()=>action(()=>{const current=viewer.getState();
      viewer.setVisibleGeometry(current.assemblyInstances.map(row=>row.ref).filter(ref=>
        sameRef(ref,binding.ref)?toggle.checked:current.visibleGeometry.some(value=>sameRef(value,ref))));}));
    const select=document.createElement('button'),inspect=document.createElement('button');
    select.textContent='Select';select.setAttribute('aria-label','Select '+binding.instanceId);
    select.disabled=!ready||!visible||(filter.value!=='all'&&filter.value!==binding.ref.kind);
    select.addEventListener('click',()=>action(()=>{viewer.selectGeometry(binding.ref);showPoint(binding);}));
    inspect.textContent='Inspect original point';inspect.setAttribute('aria-label','Inspect '+binding.instanceId);
    inspect.disabled=disposed;inspect.addEventListener('click',()=>action(()=>showPoint(binding)));
    item.append(title,lineage,identity,label,select,inspect);return item;
  }));
}
function action(callback) { if(disposed)return;try{callback();render();}catch(error){display(error.message);} }
function loadAssembly(revision=0,ids=defaultIDs) {
  uploads.length=0;viewer.loadAssembly(assemblies[revision],{...clone(options),instanceIds:[...ids]});
  viewer.setView(camera);render();return viewer.getState();
}
function multiply(a,b) {return Array.from({length:16},(_,i)=>{
  const r=Math.floor(i/4),c=i%4;let n=0;for(let k=0;k<4;k++)n+=a[r*4+k]*b[k*4+c];return n;});}
function authoredWorld(assembly,id) {
  const row=assembly.assembly.instances.find(value=>value.id===id),[rx,ry,rz]=row.placement.rotationDegreesXYZ.map(n=>n*Math.PI/180);
  const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
  const r=multiply(multiply([cz,-sz,0,0,sz,cz,0,0,0,0,1,0,0,0,0,1],
    [cy,0,sy,0,0,1,0,0,-sy,0,cy,0,0,0,0,1]),[1,0,0,0,0,cx,-sx,0,0,sx,cx,0,0,0,0,1]);
  [r[3],r[7],r[11]]=row.placement.translationMM;
  return row.parentId?multiply(authoredWorld(assembly,row.parentId),r):r;
}
const worldPoint=(matrix,p)=>[0,1,2].map(axis=>matrix[axis*4]*p[0]+matrix[axis*4+1]*p[1]
  +matrix[axis*4+2]*p[2]+matrix[axis*4+3]);
function project(worldMM) {
  const rect=canvas.getBoundingClientRect(),state=viewer.getState(),c=state.camera;
  const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const forward=unit(c.target.map((n,i)=>n-c.eye[i])),right=unit(cross(forward,c.up)),up=cross(right,forward);
  const delta=worldMM.map((n,i)=>n*mmToSceneUnit-c.eye[i]),z=dot(delta,forward),t=Math.tan(c.fovYDegrees*Math.PI/360);
  return {xCss:(1+dot(delta,right)/(z*t*canvas.width/canvas.height))*rect.width/2,
    yCss:(1-dot(delta,up)/(z*t))*rect.height/2};
}
function hitSamples() {
  return viewer.getState().assemblyInstances.map(binding=>{
    const point=viewer.queryAssemblyInstancePoint(queryFor(binding)),centre=project(point.assemblyPointMM);
    const search=()=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++) {
        const xCss=centre.xCss+dx,yCss=centre.yCss+dy;
        const hit=viewer.pickGeometry({xCss,yCss},{curveTolerancePx:4});
        if(hit&&sameRef({kind:hit.kind,...hit.ref},binding.ref))return {instanceId:binding.instanceId,xCss,yCss,hit,
          visible:clone(viewer.getState().visibleGeometry)};
      }return null;};
    const direct=search();if(direct)return {...direct,visibilityControl:'original all-visible state'};
    if(binding.ref.kind==='curve') {
      const before=viewer.getState(),pixelHash=pixels();let uncovered;
      try { viewer.setVisibleGeometry(before.visibleGeometry.filter(ref=>ref.kind!=='surface'));uncovered=search(); }
      finally { viewer.setVisibleGeometry(before.visibleGeometry);
        if(before.selectedGeometry)viewer.selectGeometry(before.selectedGeometry); }
      check(same(before,viewer.getState())&&pixels()===pixelHash,'Visibility hit control did not restore original state');
      if(uncovered)return {...uncovered,visibilityControl:'Surface temporarily hidden to inspect occluded native Curve',restored:true};
    }
    throw Error('No independently projected qualified hit for '+binding.instanceId);
  });
}
function retained(label,callback) {
  const before=viewer.getState(),pixelHash=pixels(),counts=resourceCounts();let error;
  try{callback();}catch(value){error=value;}
  check(error instanceof Error,label+' did not refuse');
  check(same(before,viewer.getState())&&pixels()===pixelHash&&same(counts,resourceCounts()),label+' changed accepted state/pixels/resources');
  result.refusals.push({label,error:error.message,type:error.name,code:error.code??null});
}
function witness(assembly) {
  const state=viewer.getState(),points=[],lowered=[];
  check(state.assemblyInstances.length===4 && state.assembly.instances.length===6,'Selected/native capacity conflated');
  for(const binding of state.assemblyInstances) {
    const matrix=authoredWorld(assembly,binding.instanceId);check(near(matrix,binding.worldMatrix,1e-9),'Independent hierarchy matrix differs');
    const local=binding.ref.kind==='surface'?[1,1.5,0]:binding.reference.assetId==='asset_b'?[1,10,0]:[1,0,0];
    const before=viewer.getState(),pixelHash=pixels(),point=viewer.queryAssemblyInstancePoint(queryFor(binding));
    check(near(point.originalLocalPointMM,local)&&near(point.assemblyPointMM,worldPoint(matrix,local)),'Independent native local/world point differs');
    check(same(before,viewer.getState())&&pixels()===pixelHash,'Read-only native query changed state/pixels');
    points.push(point);
    const document=assembly.documents.find(value=>value.document.documentId===binding.reference.documentId);
    const resolved=resolveCadGeometryReference(document,binding.reference),original=resolved.geometry;
    check(resolved.source===assembly.assembly.parts[0].assets.find(asset=>asset.id===binding.reference.assetId).source,
      'Original authored source changed during display projection');
    if(original.kind==='surface')check(Object.is(original.knotsU[0],-0)&&Object.is(original.knotsV[0],-0),
      'Original native signed-zero knot domains lost');
    const raw=original.kind==='surface'?state.packets.find(packet=>packet.modelId===binding.ref.modelId).packet.positions
      :sampleCurveWideAdaptive(original,{chordToleranceMM:.01,maxSegments:64,maxDepth:8,resultIdPrefix:'host_witness'}).pointsMM.flat();
    const expected=[];for(let i=0;i<raw.length;i+=3)expected.push(...worldPoint(matrix,raw.slice(i,i+3)).map(n=>Math.fround(n*mmToSceneUnit)));
    const upload=uploads.find(value=>value.type==='Float32Array'&&near(value.values,expected,1e-6));
    check(upload&&upload.exactReadback,'Actual GL native matrix/unit upload differs for '+binding.instanceId);
    lowered.push({instanceId:binding.instanceId,positions:upload.values,expected,
      originalSource:resolved.source,originalGeometry:original,
      originalUV:original.kind==='surface'?state.packets.find(packet=>packet.modelId===binding.ref.modelId).packet.parameters:null});
  }
  check(uploads.every(value=>value.exactReadback),'Original buffer bytes differ');
  return {revision:assembly.assembly.revision,pixelHash:pixels(),points,lowered,hits:hitSamples(),
    bindings:state.assemblyInstances,resources:resourceCounts(),glErrors:glErrors()};
}
async function startClothScene() {
  nativeSet??=await loadBaroCadModelSet({format:'barocad-model-set',version:0,entries:[{aliasId:'cloth_original',
    url:'/original-panel.barocad',options:{sourceVersion:0,countU:3,countV:3,unitsPerMillimeter:1}}]}, {baseURL:location.href});
  clothWorld??=createClothWorld({format:'barocss-cloth-scene',version:1,revision:'assemblyClothPrior',
    basis:'right-handed-xyz-metres',fixedStepSeconds:1/120,profile:'pinned-sheet-sphere-v1'});
  const state=clothWorld.getState();viewer.loadModelSet(nativeSet);
  viewer.setView({eye:[0,100,0],target:[0,15,0],up:[0,0,-1],fovYDegrees:45,near:.01,far:500});
  const frame={version:0,layerId:'prior_native_cloth',contextId:'prior_world',sceneRevision:state.sceneRevision,
    stepIndex:state.stepIndex,vertexCount:state.vertexCount,triangleCount:state.triangleCount,
    positionsM:state.positionsM,triangles:state.triangles};viewer.setClothFrame(frame);return frame;
}
async function runProof() {
  if(running||disposed||viewer.getState().status!=='ready')throw Error('Proof needs a live ready Viewer');
  running=true;render();result={ok:false,schema:'barocss-viewer-assembly-997',receipts:[],refusals:[],failures:[],
    scope:'Four explicitly selected native instances; native local/world query, derived display only; no edit/playback/publication'};
  window.viewerAssemblyProof=result;
  try {
    result.inputAudit=await(await fetch('/input-audit.json')).json();result.fixtures=[];
    const expectedSHA=['4657ece41355db1870447efa0120f30c497ffa1b5b38dbe94de765d53176819b','54b07c917be1895f9e85ff1d4b0525ee6596b3941f30edafd015d4a9a7d2a9c5'];
    for(let revision=0;revision<2;revision++) {
      const bytes=await(await fetch('/assembly-revision'+revision+'.json')).arrayBuffer(),digest=await sha(bytes);
      check(bytes.byteLength===4207&&digest===expectedSHA[revision],'Original assembly fixture changed');
      result.fixtures.push({revision,bytes:bytes.byteLength,sha256:digest});
    }
    const prior=await startClothScene(),forged=clone(assemblies[0]);forged.instances[0].worldMatrix[3]+=1;
    retained('failed assembly from actual prior cloth',()=>viewer.loadAssembly(forged,clone(options)));
    check(same(viewer.getState().clothFrame,prior),'Failed assembly dropped actual prior cloth');
    loadAssembly(0);check(viewer.getState().clothFrame===null&&viewer.getState().modelSet===null,'Successful assembly did not reset old mode');
    const original=witness(assemblies[0]);result.receipts.push(original);
    const copied=viewer.getState();copied.assemblyInstances[0].worldMatrix[3]=999;copied.assembly.assembly.parts[0].assets[0].source='changed';
    check(same(viewer.getState().assembly,assemblies[0]),'State copy exposed native assembly');
    const binding=viewer.getState().assemblyInstances[0],query=queryFor(binding),queried=viewer.queryAssemblyInstancePoint(query);
    queried.originalLocalPointMM[0]=999;query.reference.assetId='foreign';
    check(viewer.queryAssemblyInstancePoint(queryFor(binding)).originalLocalPointMM[0]===1,'Caller/result query mutation reached source');
    for(const ids of [[],['child','child'],['foreign'],[...defaultIDs,'parent']])
      retained('invalid IDs '+JSON.stringify(ids),()=>viewer.loadAssembly(assemblies[1],{...clone(options),instanceIds:ids}));
    retained('forged world matrix',()=>viewer.loadAssembly(forged,clone(options)));
    const report=clone(assemblies[1]);report.report.instanceCount=5;
    retained('forged report',()=>viewer.loadAssembly(report,clone(options)));
    retained('units input',()=>viewer.loadAssembly(assemblies[1],{...clone(options),native:{...options.native,unitsPerMillimeter:1}}));
    retained('unknown option',()=>viewer.loadAssembly(assemblies[1],{...clone(options),extra:true}));
    retained('unsupported sampling version',()=>viewer.loadAssembly(assemblies[1],{...clone(options),native:{...options.native,sourceVersion:1}}));
    let getterCalls=0;const getter=clone(options);Object.defineProperty(getter,'instanceIds',{enumerable:true,get(){getterCalls++;return defaultIDs;}});
    retained('option accessor',()=>viewer.loadAssembly(assemblies[1],getter));check(getterCalls===0,'Caller getter invoked');
    const translated=updateCadAssembly(assemblies[0],{expectedRevision:0,revision:1,
      instanceEdits:[{instanceId:'parent',translationMM:[10000,0,0],rotationDegreesXYZ:[0,0,0]}]});
    retained('composed GPU translation over10000mm',()=>viewer.loadAssembly(translated,clone(options)));
    failedBufferAt=5;bufferAttempts=0;try{retained('late fifth buffer allocation',()=>viewer.loadAssembly(assemblies[1],clone(options)));}
    finally{failedBufferAt=0;}check(bufferAttempts===5,'Late buffer failure not reached');
    retained('override authored display poses',()=>viewer.applyGeometryMotionFrame(viewer.getState().geometryMotion.frame,
      viewer.getState().geometryMotion.bindings,{basis:'part-xyz-matches-rhyup'}));
    retained('reset authored motion',()=>viewer.resetMotion());
    retained('legacy native projection',()=>viewer.projectNativePoint({...binding.ref,t:2}));
    retained('assembly material clear',()=>viewer.setSurfaceMaterial(viewer.getState().surfaces[0],null));
    retained('assembly cloth display',()=>viewer.setClothFrame(prior));
    const pointQuery=queryFor(binding);
    retained('stale query revision',()=>viewer.queryAssemblyInstancePoint({...pointQuery,assemblyRevision:1}));
    retained('unadmitted query instance',()=>viewer.queryAssemblyInstancePoint({...pointQuery,instanceId:'parent'}));
    retained('foreign full native reference',()=>viewer.queryAssemblyInstancePoint({...pointQuery,reference:{...pointQuery.reference,assetId:'asset_b'}}));
    viewer.setClothFrame(null);viewer.setFluidFrame(null);viewer.selectGeometry(binding.ref);
    viewer.orbit(.01,.01);viewer.pan(.01,0);viewer.zoom(1.02);viewer.fit();viewer.fitGeometry(binding.ref);
    viewer.setVisibleGeometry(viewer.getState().visibleGeometry.filter(ref=>!sameRef(ref,binding.ref)));
    check(viewer.getState().assemblyInstances.length===4,'Hidden instance vanished from native inventory');
    retained('hidden instance selection',()=>viewer.selectGeometry(binding.ref));
    viewer.setVisibleGeometry(viewer.getState().assemblyInstances.map(row=>row.ref));viewer.setView(camera);
    loadAssembly(1);const edited=witness(assemblies[1]);result.receipts.push(edited);
    check(edited.pixelHash!==original.pixelHash,'Parent revision changed no display pixels');
    check(same(assemblies[0].assembly.parts,assemblies[1].assembly.parts),'Parent edit changed original parts');
    for(let i=0;i<4;i++)check(i<2?!near(original.bindings[i].worldMatrix,edited.bindings[i].worldMatrix)
      :same(original.bindings[i].worldMatrix,edited.bindings[i].worldMatrix),'Wrong descendant/root placement change');
    viewer.resize(480,360);viewer.resize(640,480);viewer.setView(camera);
    const source=viewer.getState().assembly.assembly.parts[0].assets[0].source;
    viewer.loadNative(source,{sourceVersion:0,countU:3,countV:3,
      curveDisplay:{version:1,chordToleranceMM:.01,maxSegments:64,maxDepth:8}});
    check(viewer.getState().assembly===null&&viewer.getState().assemblyInstances.length===0,'Later native generation retained assembly');
    loadAssembly(0);viewer.clear();check(viewer.getState().assembly===null,'Clear retained assembly');loadAssembly(0);
    result.contextCount=contexts.size;result.resources=resourceCounts();result.glErrors=glErrors();result.errors=[...errors];result.warnings=[...warnings];
    check(result.contextCount===1&&result.glErrors.every(n=>n===0)&&errors.length===0&&warnings.length===0,'Context/GL/browser gate failed');
    result.getterCalls=getterCalls;result.ok=true;
  }catch(error){result.error=error.stack||error.message;result.failures.push({error:result.error,completed:result.receipts.length});
    result.resources=resourceCounts();result.errors=[...errors];result.warnings=[...warnings];}
  finally{running=false;render();display(result);window.viewerAssemblyProof=result;
    try{await fetch('/result',{method:'POST',body:JSON.stringify(result)});}catch(error){result.recordingError=error.message;}}
  return result;
}
function dispose() {
  if(disposed)return;viewer.dispose();viewer.dispose();clothWorld?.dispose();disposed=true;render();
  const receipt={status:viewer.getState().status,resources:resourceCounts(),contextCount:contexts.size,glErrors:glErrors(),errors,warnings};
  if(result)result.disposal=receipt;display(receipt);return receipt;
}
try {
  assemblies=await Promise.all([0,1].map(revision=>loadBaroCadAssembly(new URL('/assembly-revision'+revision+'.json',location.href).href)));
  viewer=createViewer(canvas,{mmToSceneUnit,background:[.035,.065,.105]});loadAssembly(0);
  window.viewerAssemblyProbe={viewer,assemblies,options,defaultIDs,camera,mmToSceneUnit,canvas,loadAssembly,queryFor,
    showPoint,runProof,startClothScene,pixels,resourceCounts,glErrors,uploads,errors,warnings,retained,dispose,
    authoredWorld,worldPoint,project,hitSamples,witness,updateCadAssembly,resolveCadGeometryReference,
    loadBaroCadAssembly,loadBaroCadModelSet,PrimitiveSceneRendererV2,PrimitiveViewport,
    fixtures:['/assembly-revision0.json','/assembly-revision1.json'],get result(){return result;}};
  display('Ready: four selected instances from six original native instances, revision0.');
}catch(error){display({ok:false,stage:'startup',error:error.stack||error.message});}
for(const revision of [0,1])buttons['revision'+revision].addEventListener('click',()=>action(()=>loadAssembly(revision)));
buttons.fit.addEventListener('click',()=>action(()=>viewer.fit()));buttons['run-proof'].addEventListener('click',runProof);
buttons.dispose.addEventListener('click',dispose);
buttons['lose-context'].addEventListener('click',()=>[...contexts][0]?.getExtension('WEBGL_lose_context')?.loseContext());
canvas.addEventListener('webglcontextlost',()=>{render();display('Context lost; original CPU assembly inspection remains available.');});
filter.addEventListener('change',()=>action(()=>{const selected=viewer.getState().selectedGeometry;
  if(selected&&filter.value!=='all'&&selected.kind!==filter.value)viewer.selectGeometry(null);}));
canvas.addEventListener('click',event=>action(()=>{const rect=canvas.getBoundingClientRect(),hit=viewer.pickGeometry(
  {xCss:event.clientX-rect.left,yCss:event.clientY-rect.top},{curveTolerancePx:4,...(filter.value==='all'?{}:{kinds:[filter.value]})});
  const ref=hit&&{kind:hit.kind,...hit.ref};viewer.selectGeometry(ref);
  const binding=ref&&viewer.getState().assemblyInstances.find(value=>sameRef(value.ref,ref));if(binding)showPoint(binding);}));
window.addEventListener('beforeunload',()=>{if(viewer)dispose();});
