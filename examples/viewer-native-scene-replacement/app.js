import {createViewer,prepareViewerNativeSceneAppearance} from '@barocss/viewer';
import {loadBaroCadDocument,parseBaroCadDocument,prepareBaroCadDocumentPrimitiveNativeRefsV2} from '@barocss/cad-interop/document';
import {parseBaroCadSource} from '@barocss/cad-interop/native';
import {loadBaroCadModelSet} from '@barocss/cad-interop/model-set';
import {parseBaroCadAssembly,loadBaroCadAssembly} from '@barocss/cad-interop/assembly';
import {compileCadModel,evaluateCurve,evaluateSurface,curveDomain,parseBooleanExtrusionFeatureGraph,
  createCadGeometryReference,queryCadDocumentPoint} from '@barocss/cad';
import {prepareUniformCurvePreview,PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer,PrimitiveSceneRecoveryError,preparePrimitiveSceneFrame,compileMeshMaterial,validateMeshMaterialIR} from '@barocss/gpu';
import {createClothWorld} from '@barocss/physics/cloth';
import {readNativeFile,createNativeFileOpen} from './native-file-open.js';
import {prepareNativeSourceDownload,createNativeSourceDownload} from './native-source-download.js';
import {buildMountedAppearanceInput,MOUNTED_APPEARANCE_SHADER_SOURCES,MOUNTED_APPEARANCE_LIGHT_PRESETS} from './mounted-appearance.js';

const check=(condition,message)=>{if(!condition)throw Error(message);},clone=value=>structuredClone(value);
const same=(a,b)=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length
  &&Object.keys(a).every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
const near=(a,b,tolerance=1e-7)=>a.length===b.length&&a.every((n,i)=>Math.abs(n-b[i])<=tolerance);
const hash=bytes=>bytes.reduce((n,byte)=>Math.imul(n^byte,16777619)>>>0,2166136261);
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),inspection=document.querySelector('#inspection'),list=document.querySelector('#bodies');
const nativeFileChoice=document.querySelector('#native-file-choice'),openNativeFileButton=document.querySelector('#open-native-file'),discardNativeFileButton=document.querySelector('#discard-native-file');
const stagedNativeFile=document.querySelector('#staged-native-file'),acceptedNativeFile=document.querySelector('#accepted-native-file');
const downloadNativeSourceButton=document.querySelector('#download-native-source'),nativeSourceDownloadOutput=document.querySelector('#native-source-download-output');
const mountedAppearanceTime=document.querySelector('#mounted-appearance-time'),mountedAppearanceAmount=document.querySelector('#mounted-appearance-amount'),mountedAppearanceLight=document.querySelector('#mounted-appearance-light');
const replaceMountedAppearanceButton=document.querySelector('#replace-mounted-appearance'),mountedAppearanceOutput=document.querySelector('#mounted-appearance-output'),mountedAppearanceDetails=document.querySelector('#mounted-appearance-details');
const buttons=Object.fromEntries(['replacement','fit-replacement','document','native','native-replacement','show-all','hide-all','fit','saved-view','query','clear','run-proof','lose-context','dispose']
  .map(id=>[id,document.querySelector('button#'+id)]));
const contexts=new Set(),resources={},peaks={},uploads=[],draws=[],errors=[],warnings=[];
let faultType=null,faultAt=0,faultAttempts=0,faultConsumed=false,lossExtension=null;
for(const type of ['Buffer','Program','VertexArray','Framebuffer','Texture','Renderbuffer','Shader']) {
  const live=new Set(),p=WebGL2RenderingContext.prototype,create=p['create'+type],remove=p['delete'+type];resources[type]=live;peaks[type]=0;
  p['create'+type]=function(...args){if(faultType===type&&++faultAttempts===faultAt){faultConsumed=true;return null;}
    const value=create.apply(this,args);if(value){live.add(value);peaks[type]=Math.max(peaks[type],live.size);}return value;};
  p['delete'+type]=function(value){live.delete(value);return remove.call(this,value);};
}
const getContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(kind,...args){const value=getContext.call(this,kind,...args);if(kind==='webgl2'&&value)contexts.add(value);return value;};
const bufferData=WebGL2RenderingContext.prototype.bufferData;
WebGL2RenderingContext.prototype.bufferData=function(target,values,...args){const outcome=bufferData.call(this,target,values,...args);
  if(ArrayBuffer.isView(values)){const readback=new values.constructor(values.length);this.getBufferSubData(target,0,readback);
    uploads.push({type:values.constructor.name,values:Array.from(readback),bytes:values.byteLength,exactReadback:same(values,readback)});}return outcome;};
const drawArrays=WebGL2RenderingContext.prototype.drawArrays;
WebGL2RenderingContext.prototype.drawArrays=function(mode,first,count){draws.push({mode,first,count});return drawArrays.call(this,mode,first,count);};
window.addEventListener('error',event=>errors.push(event.message));window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const warn=console.warn;console.warn=(...args)=>{warnings.push(args.map(String).join(' '));warn.apply(console,args);};
const nativeOptions={sourceVersion:0,countU:5,countV:5,curveDisplay:{version:1,chordToleranceMM:.02,maxSegments:512,maxDepth:16}};
const bodyIds=['body_0_curve','body_0_surface','body_1_curve','body_1_surface'];
const documentOptions={native:{...clone(nativeOptions),unitsPerMillimeter:1},basis:'authored-xyz-matches-rhyup',bodyIds};
const mmToSceneUnit=.13,fixedCamera={eye:[4,3,7],target:[.35,.2,.3],up:[0,1,0],fovYDegrees:45,near:.01,far:30};
let documentResult=null,originalBytes=null,originalText='',projection=[],manifest=[],viewer=null,running=false,disposed=false,result=null,nativeFileOpen=null,nativeSourceDownload=null;
const sources={};
const resourceCounts=()=>Object.fromEntries(Object.entries(resources).map(([key,live])=>[key,live.size]));
const glErrors=()=>[...contexts].map(gl=>gl.getError());
const pixelInfo=()=>({hash:hash(viewer.readPixels())});
const display=value=>status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
const sameRef=(a,b)=>a.kind===b.kind&&a.modelId===b.modelId&&(a.kind==='surface'?a.surfaceId===b.surfaceId:a.curveId===b.curveId);
const refFor=entry=>entry.kind==='surface'?{kind:'surface',modelId:entry.ref.modelId,surfaceId:entry.ref.geometryId}
  :{kind:'curve',modelId:entry.ref.modelId,curveId:entry.ref.geometryId};
function initialDisplay(refs,camera=fixedCamera,hiddenIndices=[1]){
  return {motion:{frame:{contextId:'saved_display',timeSeconds:0,poses:refs.map((ref,i)=>({targetId:'target_'+i,
    translation:[i<2?-8:8,i%2===0?6:-6,0],rotation:[0,0,0,1],scale:[1,1,1]}))},
    bindings:refs.map((ref,i)=>({contextId:'saved_display',targetId:'target_'+i,ref:clone(ref)})),basis:'part-xyz-matches-rhyup'},
    visibleGeometry:refs.filter((ref,index)=>!hiddenIndices.includes(index)).map(clone),camera:camera===null?null:clone(camera)};
}
function buildCandidate(camera=fixedCamera,hiddenIndices=[1]){const entries=prepareBaroCadDocumentPrimitiveNativeRefsV2(documentResult,documentOptions);
  return {version:0,source:{kind:'document',result:clone(documentResult),options:clone(documentOptions),bindings:entries.map(entry=>clone(entry.binding))},
    display:initialDisplay(entries.map(refFor),camera,hiddenIndices)};}
function nativeEntries(){const parsed=parseBaroCadSource(sources['asset-a'],{...clone(nativeOptions),unitsPerMillimeter:1});
  return [...parsed.surfaces.map(surface=>({kind:'surface',packet:surface.packet,ref:{kind:'surface',modelId:parsed.model.name,surfaceId:surface.surfaceId}})),
    ...parsed.curves.map(curve=>({kind:'curve',sample:curve.sample,ref:{kind:'curve',modelId:parsed.model.name,curveId:curve.curveId}}))];}
function buildNativeCandidate(camera=fixedCamera){return {version:0,source:{kind:'native',source:sources['asset-a'],options:clone(nativeOptions),basis:'authored-xyz-matches-rhyup'},
  display:initialDisplay(nativeEntries().map(entry=>entry.ref),camera,[])};}
function nativeFileSnapshot(){const snapshot=nativeFileOpen?.snapshot()??{version:0,intent:0,staged:null,accepted:null,pending:false,disposed,error:null};
  const live=!!viewer&&!disposed&&!snapshot.disposed&&!running,state=live?viewer.getState():null;
  return{...clone(snapshot),openEnabled:live&&!!snapshot.staged&&!['context-lost','unavailable','disposed'].includes(state.status),
    choiceEnabled:live,discardEnabled:live&&(!!snapshot.staged||snapshot.pending)};}
function renderNativeFileControls(snapshot=nativeFileOpen?.snapshot()){const controls=nativeFileSnapshot(),value=snapshot??controls;
  nativeFileChoice.disabled=!controls.choiceEnabled;openNativeFileButton.disabled=!controls.openEnabled;discardNativeFileButton.disabled=!controls.discardEnabled;
  stagedNativeFile.textContent=value.staged?'Choice: '+value.staged.name+' · '+value.staged.bytes+' bytes'+(value.pending?' · Opening…':''):'No file choice.';
  if(value.error)stagedNativeFile.textContent+=' · '+value.error.message;
  acceptedNativeFile.textContent=value.accepted?'Opened: '+value.accepted.name+' · '+value.accepted.bytes+' bytes · Model '+value.accepted.modelId
    +' · '+value.accepted.refs.length+' original objects · SHA-256 '+value.accepted.sha256:'No local file is accepted.';}
function stageNativeFile(file){check(nativeFileOpen&&!disposed&&!running,'File choice needs a live host.');try{nativeFileOpen.stage(file);display('Original source file staged. Select Open to apply it.');}finally{nativeFileChoice.value='';}return nativeFileSnapshot();}
async function openNativeFile(){check(nativeFileOpen&&!disposed&&!running,'File opening needs a live host.');return await nativeFileOpen.open();}
function discardNativeFile(){check(nativeFileOpen&&!disposed&&!running,'File choice needs a live host.');nativeFileOpen.discard();nativeFileChoice.value='';display('File choice discarded. Accepted original geometry is unchanged.');return nativeFileSnapshot();}
function invalidateNativeFile(){if(!disposed)nativeFileOpen?.invalidate();return nativeFileSnapshot();}
function sourceAction(callback){invalidateNativeFile();try{const value=callback();nativeFileOpen?.clearAccepted();inspection.textContent='';render();return value;}catch(error){render();throw error;}}
function commitReplacement(candidate){uploads.length=0;draws.length=0;viewer.replaceNativeScene(candidate);return viewer.getState();}
function replace(candidate){return sourceAction(()=>commitReplacement(candidate===undefined?buildCandidate():candidate));}
function nativeSourceDownloadSnapshot(){return nativeSourceDownload?clone(nativeSourceDownload.snapshot()):{version:0,pending:false,disposed,enabled:false,report:null,error:null,activeUrls:0,activeAnchors:0,activeTimers:0};}
function renderNativeSourceDownloadControls(snapshot=nativeSourceDownloadSnapshot()){downloadNativeSourceButton.disabled=disposed||running||!snapshot.enabled;
  nativeSourceDownloadOutput.textContent=snapshot.report?'Original source offered: '+snapshot.report.name+' · '+snapshot.report.bytes+' bytes · SHA-256 '+snapshot.report.sha256
    +(snapshot.report.filenameOrigin==='generated'?' · generated filename':' · opened-file filename'):'';
  if(snapshot.pending)nativeSourceDownloadOutput.textContent+=(nativeSourceDownloadOutput.textContent?' · ':'')+'Preparing original source…';
  if(snapshot.error)nativeSourceDownloadOutput.textContent+=(nativeSourceDownloadOutput.textContent?' · ':'')+snapshot.error.message;}
async function downloadNativeSource(){check(nativeSourceDownload&&!disposed&&!running,'Source download needs a live host.');const report=await nativeSourceDownload.download();
  if(report&&!disposed)display('Original source download offered: '+report.name+'.');return report;}
function mountedAppearanceAccepted(state){return state.document?clone({documentId:state.document.document.documentId,
  revision:state.document.document.revision,documentBodies:state.documentBodies,visibleGeometry:state.visibleGeometry,
  geometryMotion:state.geometryMotion,camera:state.camera,lighting:state.lighting,surfaceMaterials:state.surfaceMaterials}):null;}
function renderMountedAppearanceControls(state){const enabled=!disposed&&!running&&['ready','empty'].includes(state.status),accepted=mountedAppearanceAccepted(state);
  for(const input of[mountedAppearanceTime,mountedAppearanceAmount,mountedAppearanceLight,replaceMountedAppearanceButton])input.disabled=!enabled;
  mountedAppearanceOutput.textContent=accepted?'Current accepted document '+accepted.documentId+' · revision '+accepted.revision+' · '+accepted.surfaceMaterials.length+' Surface materials'
    +' · '+(accepted.lighting?'light ambient '+accepted.lighting.ambientStrength+' / directional '+accepted.lighting.directionalStrength:'constructor/default light'):'';
  mountedAppearanceDetails.textContent=accepted?JSON.stringify(accepted,null,2):'';}
function mountedAppearanceSnapshot(){return{enabled:!replaceMountedAppearanceButton.disabled,
  drafts:{timeSeconds:mountedAppearanceTime.value,amount:mountedAppearanceAmount.value,lightPreset:mountedAppearanceLight.value},
  accepted:disposed?null:mountedAppearanceAccepted(viewer.getState()),output:mountedAppearanceOutput.textContent,technical:mountedAppearanceDetails.textContent};}
function mountedAppearanceDraft(input,label,min,max){const text=input.value.trim(),value=Number(text);
  check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)&&Number.isFinite(value)&&value>=min&&value<=max,label+' must be a complete finite decimal in '+min+'..'+max+'.');return value;}
function buildMountedAppearanceCandidate(overrides={}){return buildMountedAppearanceInput(documentResult,{camera:clone(fixedCamera),timeSeconds:.5,amount:.75,lightPreset:'primary',...overrides});}
function replaceMountedAppearance(input){check(!disposed&&!running,'Mounted appearance needs an idle live host.');const physical=arguments.length===0;
  const accepted=sourceAction(()=>{const candidate=physical?buildMountedAppearanceCandidate({timeSeconds:mountedAppearanceDraft(mountedAppearanceTime,'Material time',0,2),
    amount:mountedAppearanceDraft(mountedAppearanceAmount,'Material amount',0,1),lightPreset:mountedAppearanceLight.value}):input;
    viewer.replaceNativeSceneAppearance(candidate);return mountedAppearanceAccepted(viewer.getState());});
  display('Document scene and appearance replaced.');return clone(accepted);}
function inventory(){const state=viewer.getState();return state.documentBodies.length?state.documentBodies.map(body=>({ref:body.ref,label:body.binding.bodyId,pin:body.binding}))
  :[...state.surfaces.map(ref=>({ref:{kind:'surface',...ref},label:ref.surfaceId})),...state.curves.map(ref=>({ref:{kind:'curve',...ref},label:ref.curveId}))];}
function render(){const state=viewer.getState(),live=!disposed&&state.status!=='context-lost',ready=live&&state.status==='ready';
  for(const[id,button]of Object.entries(buttons))button.disabled=id==='dispose'?disposed:!live||running;
  buttons.fit.disabled=!ready||running||!state.visibleGeometry.length;buttons.query.disabled=!live||running||!state.curves.length;
  list.replaceChildren(...inventory().map(body=>{const item=document.createElement('li'),label=document.createElement('label'),checkbox=document.createElement('input');
    checkbox.type='checkbox';checkbox.checked=state.visibleGeometry.some(ref=>sameRef(ref,body.ref));checkbox.disabled=!ready||running;
    checkbox.setAttribute('aria-label','Show '+body.label);label.append(checkbox,' '+body.label+' · '+body.ref.kind);
    const identity=document.createElement('small');identity.textContent=JSON.stringify(body.pin??body.ref);
    checkbox.addEventListener('change',()=>action(()=>{if(!item.isConnected)throw Error('This body list is stale.');
      const accepted=viewer.getState(),refs=inventory().map(body=>body.ref).filter(ref=>sameRef(ref,body.ref)?checkbox.checked:accepted.visibleGeometry.some(value=>sameRef(value,ref)));
      viewer.setVisibleGeometry(refs);}));item.append(label,identity);return item;}));
  nativeFileOpen?.sync();renderNativeFileControls();nativeSourceDownload?.sync();renderNativeSourceDownloadControls();renderMountedAppearanceControls(state);
}
function action(callback){if(disposed)return;try{callback();render();}catch(error){display(error.message);}}
function transformedPoint(point,pose){if(!pose)return point.map(n=>n*mmToSceneUnit);const[x,y,z,w]=pose.rotation,
  p=point.map((n,i)=>n*pose.scale[i]),uv=[y*p[2]-z*p[1],z*p[0]-x*p[2],x*p[1]-y*p[0]],uuv=[y*uv[2]-z*uv[1],z*uv[0]-x*uv[2],x*uv[1]-y*uv[0]];
  return p.map((n,i)=>(n+2*(w*uv[i]+uuv[i])+pose.translation[i])*mmToSceneUnit);}
function candidatePoints(candidate,visibleOnly=true){const entries=candidate.source.kind==='document'?projection:nativeEntries();
  return entries.flatMap(entry=>{const ref=candidate.source.kind==='document'?refFor(entry):entry.ref;
    if(visibleOnly&&!candidate.display.visibleGeometry.some(value=>sameRef(value,ref)))return[];
    const binding=candidate.display.motion?.bindings.find(value=>sameRef(value.ref,ref));
    const pose=binding&&candidate.display.motion.frame.poses.find(value=>value.targetId===binding.targetId);
    const raw=entry.kind==='surface'?Array.from({length:entry.packet.positions.length/3},(_,index)=>entry.packet.positions.slice(index*3,index*3+3)):entry.sample.pointsMM;
    return raw.map(point=>transformedPoint(point,pose));});}
function expectedFit(points){check(points.length,'Visible posed points needed');const min=[0,1,2].map(axis=>Math.min(...points.map(point=>point[axis]))),max=[0,1,2].map(axis=>Math.max(...points.map(point=>point[axis])));
  const target=min.map((n,i)=>(n+max[i])/2),radius=Math.max(.01,Math.hypot(...max.map((n,i)=>n-target[i])));
  const distance=radius*1.3/Math.sin(Math.atan(Math.tan(45*Math.PI/360)*Math.min(1,canvas.width/canvas.height)));
  return{min,max,target,eye:target.map(n=>n+distance/Math.sqrt(3)),radius,distance};}
function uploadWitness(candidate){const entries=candidate.source.kind==='document'?projection:nativeEntries(),witness=[];
  for(const entry of entries){const ref=candidate.source.kind==='document'?refFor(entry):entry.ref;if(!candidate.display.visibleGeometry.some(value=>sameRef(value,ref)))continue;
    const binding=candidate.display.motion?.bindings.find(value=>sameRef(value.ref,ref)),pose=binding&&candidate.display.motion.frame.poses.find(value=>value.targetId===binding.targetId);
    const raw=entry.kind==='surface'?Array.from({length:entry.packet.positions.length/3},(_,index)=>entry.packet.positions.slice(index*3,index*3+3)):entry.sample.pointsMM;
    const expected=raw.flatMap(point=>transformedPoint(point,pose).map(Math.fround)),upload=uploads.find(value=>value.type==='Float32Array'&&near(value.values,expected));
    check(upload&&upload.exactReadback,'Independent posed original/one-scale upload differs for '+JSON.stringify(ref));
    witness.push({ref,values:upload.values,bytes:upload.bytes});}
  check(uploads.every(value=>value.exactReadback),'Actual GL buffer readback differs');return witness;}
function query(){const state=viewer.getState(),ref=state.curves[0];check(ref,'A native Curve is required');let model=null;
  if(state.document){const body=state.documentBodies.find(body=>sameRef(body.ref,{kind:'curve',...ref})),binding=body?.binding;
    check(binding&&binding.geometryKind==='curve'&&binding.geometryId===ref.curveId&&binding.documentId===state.document.document.documentId
      &&binding.documentRevision===state.document.document.revision,'Current document Curve binding is missing.');
    const asset=state.document.compiledAssets.find(asset=>asset.assetId===binding.assetId);check(asset&&asset.model.name===binding.modelId,'Original document Curve Model is missing.');model=asset.model;
  }else if(state.native?.model.name===ref.modelId)model=state.native.model;
  const curve=model?.objects.find(geometry=>geometry.kind==='curve'&&geometry.id===ref.curveId);check(curve,'Current original Curve is missing.');
  const domain=curveDomain(curve),lower=domain[0],midpoint=lower/2+domain[1]/2;check(Number.isFinite(midpoint)&&midpoint>=lower&&midpoint<=domain[1],'Original Curve midpoint is outside its domain.');
  const measured=viewer.measureNativeCurvePoints({...ref,t:midpoint},{...ref,t:lower}),expected=evaluateCurve(curve,midpoint);
  check(near(measured.first.pointMM,expected,1e-12),'Native local point changed under display pose');
  const value={ref,domain,parameters:{midpoint,lower},pointMM:measured.first.pointMM,expected,certification:measured.certification};inspection.textContent=JSON.stringify(value,null,2);return value;}
function retained(label,callback){const before=viewer.getState(),pixels=pixelInfo(),counts=resourceCounts();let error;
  try{callback();}catch(value){error=value;}check(error instanceof Error,label+' did not refuse');check(same(before,viewer.getState())&&same(pixels,pixelInfo())&&same(counts,resourceCounts()),label+' changed accepted state/pixels/resources');
  result?.refusals.push({label,error:error.message,type:error.name,code:error.code??null});return error;}
function capture(label){const state=viewer.getState(),row={label,status:state.status,documentRevision:state.document?.document.revision??null,
  bodyCount:state.documentBodies.length,visibleCount:state.visibleGeometry.length,camera:state.camera,...pixelInfo(),resources:resourceCounts(),glErrors:glErrors()};
  check(row.glErrors.every(n=>n===0),label+' GL error');result.cases.push(row);return row;}
function failAllocation(type='Texture',at=1){faultType=type;faultAt=at;faultAttempts=0;faultConsumed=false;}
function clearAllocationFault(){const value={type:faultType,attempts:faultAttempts,consumed:faultConsumed};faultType=null;return value;}
async function runProof(){invalidateNativeFile();if(running||disposed||viewer.getState().status==='context-lost')throw Error('Proof needs a live Viewer');running=true;render();
  result={ok:false,schema:'barocss-viewer-native-replacement-1061-basic',cases:[],refusals:[],failures:[],scope:'One native/document provider candidate; independent root script adds complete old-mode/race/loss acceptance'};window.__viewerReplacementResult=result;
  try{result.fixture=manifest[0];result.inputAudit=await(await fetch('/input-audit.json')).json();
    const candidate=buildCandidate();replace(candidate);result.uploads=uploadWitness(candidate);const accepted=viewer.getState();
    check(same(accepted.document,documentResult)&&same(accepted.camera,fixedCamera),'Original complete document or exact explicit camera changed');
    check(accepted.documentBodies.length===4&&accepted.visibleGeometry.length===3,'Hidden original inventory missing');
    check(accepted.documentBodies.every(body=>candidate.source.bindings.some(pin=>same(pin,body.binding))),'Exact native body pins changed');
    check(candidate.source.bindings[0].modelId==='authored_part'&&projection[0].ref.modelId==='asset.a','Native model/display namespaces conflated');
    const originalCurve=documentResult.compiledAssets[0].model.objects.find(geometry=>geometry.kind==='curve');
    check(Object.is(originalCurve.controlPoints[0][1],-0),'Original native signed zero lost');result.native=query();capture('initial-explicit-posed-hidden-document');
    const copy=viewer.getState();copy.document.document.assets[0].source='changed';copy.geometryMotion.frame.poses[0].translation[0]=999;
    check(same(viewer.getState().document,documentResult),'State copy exposed original document authority');
    const fitted=buildCandidate(null);replace(fitted);const independentlyFitted=expectedFit(candidatePoints(fitted));
    check(near(viewer.getState().camera.target,independentlyFitted.target,1e-12)&&near(viewer.getState().camera.eye,independentlyFitted.eye,1e-12),'Null camera did not fit visible posed union independently');
    result.independentFit=independentlyFitted;capture('null-camera-visible-posed-union');
    const hidden=buildCandidate(fixedCamera,[0,1,2,3]);replace(hidden);check(viewer.getState().status==='ready'&&!viewer.getState().visibleGeometry.length,'All-hidden explicit candidate rejected inventory');
    capture('all-hidden-explicit-camera');retained('all-hidden null fit',()=>viewer.replaceNativeScene(buildCandidate(null,[0,1,2,3])));retained('fit all-hidden accepted scene',()=>viewer.fit());
    replace(candidate);const bad=mutate=>{const value=clone(candidate);mutate(value);return value;};
    retained('stale document pin',()=>viewer.replaceNativeScene(bad(value=>value.source.bindings[0].documentRevision++)));
    retained('stale asset pin',()=>viewer.replaceNativeScene(bad(value=>value.source.bindings[0].assetRevision++)));
    retained('wrong original model pin',()=>viewer.replaceNativeScene(bad(value=>value.source.bindings[0].modelId='asset.a')));
    retained('duplicate expected binding',()=>viewer.replaceNativeScene(bad(value=>value.source.bindings[1]=clone(value.source.bindings[0]))));
    retained('unknown visible ref',()=>viewer.replaceNativeScene(bad(value=>value.display.visibleGeometry[0].modelId='foreign')));
    retained('wrong motion ref',()=>viewer.replaceNativeScene(bad(value=>value.display.motion.bindings[0].ref.modelId='foreign')));
    retained('nonunit quaternion',()=>viewer.replaceNativeScene(bad(value=>value.display.motion.frame.poses[0].rotation=[0,0,0,2])));
    retained('hidden posed scene bounds',()=>viewer.replaceNativeScene(bad(value=>value.display.motion.frame.poses[1].translation=[10000,0,0])));
    retained('invalid camera',()=>viewer.replaceNativeScene(bad(value=>value.display.camera.near=0)));
    let getterCalls=0;const accessor=clone(candidate);Object.defineProperty(accessor.display,'motion',{enumerable:true,get(){getterCalls++;return candidate.display.motion;}});
    retained('candidate accessor',()=>viewer.replaceNativeScene(accessor));check(getterCalls===0,'Caller candidate getter invoked');
    uploads.length=0;failAllocation('Texture',1);try{retained('late texture after native uploads',()=>viewer.replaceNativeScene(buildCandidate(null)));}
    finally{result.allocation=clearAllocationFault();}check(result.allocation.consumed&&uploads.length>0,'Late texture failure was not consumed after native uploads');
    const native=buildNativeCandidate();replace(native);result.nativeUploads=uploadWitness(native);check(viewer.getState().native.source===sources['asset-a']&&!viewer.getState().document,'Original native candidate admission changed authority');
    query();capture('native-original-full-file-candidate');
    viewer.loadDocument(documentResult,documentOptions);check(!viewer.getState().geometryMotion,'Legacy generation retained initial replacement pose');
    replace(candidate);viewer.setVisibleGeometry(projection.map(refFor));viewer.selectGeometry(refFor(projection[0]));viewer.selectGeometry(null);
    viewer.orbit(.03,.02);viewer.pan(.01,0);viewer.zoom(1.02);viewer.fit();viewer.resize(480,360);viewer.resize(640,480);viewer.setView(fixedCamera);query();
    check(same(viewer.getState().document,documentResult),'Subsequent commands changed original complete document');
    viewer.clear();check(viewer.getState().document===null&&!viewer.getState().curves.length&&!viewer.getState().surfaces.length,'Clear retained source inventory');replace(candidate);
    result.getterCalls=getterCalls;result.contextCount=contexts.size;result.resources=resourceCounts();result.glErrors=glErrors();result.errors=[...errors];result.warnings=[...warnings];
    check(contexts.size===1&&result.glErrors.every(n=>n===0)&&!errors.length&&!warnings.length,'Context/GL/browser gate failed');result.ok=true;
  }catch(error){result.error=error.stack||error.message;result.failures.push({error:result.error,completed:result.cases.length});result.resources=resourceCounts();result.errors=[...errors];}
  finally{running=false;render();window.__viewerReplacementResult=result;display({ok:result.ok,cases:result.cases.length,refusals:result.refusals.length,error:result.error??null,
    documentBytes:manifest[0]?.bytes,contextCount:contexts.size,resources:resourceCounts(),limits:result.scope});
    try{await fetch('/result',{method:'POST',body:JSON.stringify(result)});}catch(error){result.recordingError=error.message;}}
  return result;}
function dispose(){if(disposed)return;nativeSourceDownload?.dispose();nativeFileOpen?.dispose();viewer.dispose();viewer.dispose();disposed=true;render();const receipt={status:viewer.getState().status,resources:resourceCounts(),glErrors:glErrors(),
  contextCount:contexts.size,errors:[...errors],warnings:[...warnings]};if(result)result.disposal=receipt;display(receipt);return receipt;}
try{manifest=await(await fetch('/fixture-manifest.json')).json();const bytes=await(await fetch('/document.cad-document.json')).arrayBuffer();
  check(bytes.byteLength===manifest[0].bytes&&await sha(bytes)===manifest[0].sha256,'Unchanged original document bytes/hash differ');originalBytes=new Uint8Array(bytes);originalText=new TextDecoder().decode(bytes);
  documentResult=await loadBaroCadDocument(new URL('/document.cad-document.json',location.href).href);
  projection=prepareBaroCadDocumentPrimitiveNativeRefsV2(documentResult,documentOptions);for(const asset of documentResult.document.assets)sources[asset.id]=asset.source;
  viewer=createViewer(canvas,{mmToSceneUnit,background:[.035,.065,.105]});nativeFileOpen=createNativeFileOpen(viewer,{
    onChange:snapshot=>renderNativeFileControls(snapshot),onAccepted:accepted=>{inspection.textContent='';render();display('Opened original source '+accepted.name+'.');},
    onError:error=>{render();display(error instanceof Error?error.message:String(error));}});
  nativeSourceDownload=createNativeSourceDownload(viewer,canvas,{getAcceptedFile:()=>nativeFileSnapshot().accepted,
    onChange:snapshot=>renderNativeSourceDownloadControls(snapshot),onError:error=>display(error instanceof Error?error.message:String(error))});
  replace();lossExtension=[...contexts][0].getExtension('WEBGL_lose_context');
  window.__viewerReplacementProof={viewer,createViewer,prepareViewerNativeSceneAppearance,preparePrimitiveSceneFrame,compileMeshMaterial,validateMeshMaterialIR,PrimitiveSceneRecoveryError,
    buildMountedAppearanceInput,buildMountedAppearanceCandidate,replaceMountedAppearance,mountedAppearanceSnapshot,MOUNTED_APPEARANCE_SHADER_SOURCES,MOUNTED_APPEARANCE_LIGHT_PRESETS,prepareNativeSourceDownload,createNativeSourceDownload,downloadNativeSource,nativeSourceDownloadSnapshot,readNativeFile,createNativeFileOpen,stageNativeFile,openNativeFile,discardNativeFile,invalidateNativeFile,nativeFileSnapshot,documentResult,originalBytes,originalText,manifest,sources,projection,bodyIds,nativeOptions,documentOptions,fixedCamera,mmToSceneUnit,canvas,
    buildCandidate,makeCandidate:buildCandidate,buildNativeCandidate,initialDisplay,refFor,refs:projection.map(refFor),refsFor:()=>projection.map(refFor),replace,nativeEntries,candidatePoints,transformedPoint,expectedFit,uploadWitness,query,inventory,render,
    loadBaroCadDocument,parseBaroCadDocument,prepareBaroCadDocumentPrimitiveNativeRefsV2,parseBaroCadSource,compileCadModel,evaluateCurve,evaluateSurface,curveDomain,
    createCadGeometryReference,queryCadDocumentPoint,parseBooleanExtrusionFeatureGraph,prepareUniformCurvePreview,parseBaroCadAssembly,loadBaroCadAssembly,loadBaroCadModelSet,
    createClothWorld,createPhysicsClothWorld:createClothWorld,PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer,resourceCounts,glErrors,pixelInfo,uploads,draws,errors,warnings,
    retained,capture,runProof,dispose,lossExtension,failAllocation,failNextBuffer(at=1){failAllocation('Buffer',at);},clearAllocationFault,
    get gl(){return[...contexts][0];},get state(){return viewer.getState();},get result(){return result;}};
  window.__viewerReplacementProof.nativeSourcePanel=await(await fetch('/original-panel.barocad')).text();
  display('Ready: revision5 original two-asset document, four posed bodies, three visible, exact saved camera.');
}catch(error){display({ok:false,stage:'startup',error:error.stack||error.message});}
replaceMountedAppearanceButton.addEventListener('click',()=>action(()=>replaceMountedAppearance()));
downloadNativeSourceButton.addEventListener('click',()=>{downloadNativeSource().catch(()=>{});});
nativeFileChoice.addEventListener('change',()=>{const file=nativeFileChoice.files?.[0];if(file)try{stageNativeFile(file);}catch{}});
openNativeFileButton.addEventListener('click',()=>{openNativeFile().catch(()=>{});});discardNativeFileButton.addEventListener('click',()=>{if(disposed)return;try{discardNativeFile();}catch(error){display(error.message);}});
buttons.replacement.addEventListener('click',()=>action(()=>replace()));buttons['fit-replacement'].addEventListener('click',()=>action(()=>sourceAction(()=>commitReplacement(buildCandidate(null)))));
buttons.document.addEventListener('click',()=>action(()=>sourceAction(()=>viewer.loadDocument(documentResult,documentOptions))));buttons.native.addEventListener('click',()=>action(()=>sourceAction(()=>viewer.loadNative(sources['asset-a'],nativeOptions))));
buttons['native-replacement'].addEventListener('click',()=>action(()=>sourceAction(()=>commitReplacement(buildNativeCandidate()))));buttons['show-all'].addEventListener('click',()=>action(()=>viewer.setVisibleGeometry(inventory().map(body=>body.ref))));
buttons['hide-all'].addEventListener('click',()=>action(()=>viewer.setVisibleGeometry([])));buttons.fit.addEventListener('click',()=>action(()=>viewer.fit()));buttons['saved-view'].addEventListener('click',()=>action(()=>viewer.setView(fixedCamera)));
buttons.query.addEventListener('click',()=>action(query));buttons.clear.addEventListener('click',()=>action(()=>sourceAction(()=>viewer.clear())));buttons['run-proof'].addEventListener('click',runProof);buttons.dispose.addEventListener('click',dispose);
buttons['lose-context'].addEventListener('click',()=>lossExtension?.loseContext());canvas.addEventListener('webglcontextlost',()=>{render();display('Context lost; copied native source and initial display settings remain on CPU.');});
window.addEventListener('beforeunload',()=>{if(viewer)dispose();});
