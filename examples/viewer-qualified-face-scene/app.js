import {createViewer} from '@barocss/viewer';
import {prepareQualifiedFaceScene,QualifiedFaceSceneRenderer,MixedDepthRenderer,prepareMixedDepthFrame,compileGpu,prepareCamera,
  prepareUniformCurvePreview,prepareSelectedUniformCurvePreview,PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer} from '@barocss/gpu';
import {compileCadModel,validateFaceBundle,tessellateSurface,evaluateSurface,evaluateCurve,curveDomain,parseBooleanExtrusionFeatureGraph} from '@barocss/cad';
import {parseBaroCadSource} from '@barocss/cad-interop/native';
import {loadBaroCadModelSet} from '@barocss/cad-interop/model-set';
import {loadBaroCadDocument,parseBaroCadDocument,prepareBaroCadDocumentPrimitiveNativeRefsV2} from '@barocss/cad-interop/document';
import {parseBaroCadAssembly,loadBaroCadAssembly} from '@barocss/cad-interop/assembly';
import {createClothWorld} from '@barocss/physics/cloth';

const check=(condition,message)=>{if(!condition)throw Error(message);},clone=value=>structuredClone(value);
const same=(a,b)=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length
  &&Object.keys(a).every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
const near=(a,b,tolerance=1e-7)=>a.length===b.length&&a.every((n,i)=>Math.abs(n-b[i])<=tolerance);
const hash=bytes=>bytes.reduce((n,byte)=>Math.imul(n^byte,16777619)>>>0,2166136261);
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const canvas=document.querySelector('#view'),status=document.querySelector('#status'),inspection=document.querySelector('#inspection'),rows=document.querySelector('#assets');
const assetCount=document.querySelector('#asset-count'),countU=document.querySelector('#count-u'),countV=document.querySelector('#count-v');
const colorAsset=document.querySelector('#color-asset'),colorInput=document.querySelector('#color');
const measureButton=document.querySelector('#measure-points'),measurementOutput=document.querySelector('#measurement-output');
const measurementControls=['first','second'].map(side=>({side,
  source:document.querySelector('#measure-'+side+'-source'),geometry:document.querySelector('#measure-'+side+'-geometry'),
  u:document.querySelector('#measure-'+side+'-u'),v:document.querySelector('#measure-'+side+'-v'),t:document.querySelector('#measure-'+side+'-t')}));
const buttons=Object.fromEntries(['load','interior-edit','mismatch','reverse','apply-color','saved-view','orbit','pan','resize','clear','run-proof','lose-context','dispose']
  .map(id=>[id,document.querySelector('#'+id)]));
const contexts=new Set(),resources={},peaks={},uploads=[],draws=[],errors=[],warnings=[];
let faultType=null,faultAt=0,faultAttempts=0,faultConsumed=false,lossExtension=null;
for(const type of['Buffer','Program','VertexArray','Framebuffer','Texture','Renderbuffer','Shader']){
  const live=new Set(),p=WebGL2RenderingContext.prototype,create=p['create'+type],remove=p['delete'+type];resources[type]=live;peaks[type]=0;
  p['create'+type]=function(...args){if(type===faultType&&++faultAttempts===faultAt){faultConsumed=true;return null;}
    const value=create.apply(this,args);if(value){live.add(value);peaks[type]=Math.max(peaks[type],live.size);}return value;};
  p['delete'+type]=function(value){live.delete(value);return remove.call(this,value);};
}
const getContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(kind,...args){const value=getContext.call(this,kind,...args);if(kind==='webgl2'&&value)contexts.add(value);return value;};
const bufferData=WebGL2RenderingContext.prototype.bufferData;
WebGL2RenderingContext.prototype.bufferData=function(target,values,...args){const outcome=bufferData.call(this,target,values,...args);
  if(ArrayBuffer.isView(values)){const readback=new values.constructor(values.length);this.getBufferSubData(target,0,readback);
    uploads.push({type:values.constructor.name,values:Array.from(readback),bytes:values.byteLength,exactReadback:same(values,readback)});}return outcome;};
const drawElements=WebGL2RenderingContext.prototype.drawElements;
WebGL2RenderingContext.prototype.drawElements=function(mode,count,...args){draws.push({mode,count,depth:this.getParameter(this.DEPTH_FUNC),write:this.getParameter(this.DEPTH_WRITEMASK)});return drawElements.call(this,mode,count,...args);};
window.addEventListener('error',event=>errors.push(event.message));window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const warn=console.warn;console.warn=(...args)=>{warnings.push(args.map(String).join(' '));warn.apply(console,args);};
const fixtures={},originalRequests={},originalSources={};let manifest=[],viewer=null,disposed=false,running=false,result=null,inspectionReport=null,measurementReport=null;
const colors=[[.9,.3,.2],[.25,.8,.4],[.25,.45,.95],[.95,.7,.2],[.3,.8,.9],[.85,.35,.75]];
const camera={eye:[2,1.5,3.2],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:10},mmToSceneUnit=.12,background=[.02,.03,.04],translateScene=[-.6,-.6,-.7];
const resourceCounts=()=>Object.fromEntries(Object.entries(resources).map(([key,live])=>[key,live.size]));
const glErrors=()=>[...contexts].map(gl=>gl.getError());
const pixelInfo=()=>({hash:hash(viewer.readPixels())});
const display=value=>status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
function clearInspection(){inspectionReport=null;inspection.textContent='';}
function clearMeasurement(){measurementReport=null;measurementOutput.textContent='';}
function renderMeasurementControls(scene){const enabled=!disposed&&!running&&!!scene;measureButton.disabled=!enabled;
  for(const control of measurementControls){const previousSource=control.source.value,previousGeometry=control.geometry.value;
    control.source.replaceChildren(...(scene?.assets??[]).map(asset=>{const option=document.createElement('option');option.value=asset.sourceId;option.textContent=asset.sourceId;return option;}));
    if(scene?.assets.some(asset=>asset.sourceId===previousSource))control.source.value=previousSource;
    else if(control.side==='second'&&scene?.assets.some(asset=>asset.sourceId==='F'))control.source.value='F';
    const asset=scene?.assets.find(value=>value.sourceId===control.source.value);
    control.geometry.replaceChildren(...(asset?.face.geometry.objects??[]).filter(object=>object.kind==='curve'
      ||object.kind==='surface'&&object.id===asset.face.topology.face.surfaceId).map(object=>{const option=document.createElement('option');
      option.value=object.id;option.dataset.kind=object.kind;option.textContent=object.kind+' · '+object.id;return option;}));
    if([...control.geometry.options].some(option=>option.value===previousGeometry))control.geometry.value=previousGeometry;
    const curve=control.geometry.selectedOptions[0]?.dataset.kind==='curve';
    control.source.disabled=!enabled;control.geometry.disabled=!enabled;
    for(const parameter of['u','v','t']){const active=parameter==='t'?curve:!curve;
      control[parameter].disabled=!enabled||!active;document.querySelector('#measure-'+control.side+'-'+parameter+'-label').hidden=!active;}
  }
}
function measurementInput(sourceId,geometryId,params={}){const asset=viewer.getState().qualifiedFaceScene?.assets.find(value=>value.sourceId===sourceId);
  check(asset,'Choose a current source-qualified asset.');const geometry=asset.face.geometry.objects.find(object=>object.id===geometryId);
  check(geometry&&(geometry.kind==='curve'||geometry.id===asset.face.topology.face.surfaceId),'Choose the current Face Surface or an original Curve.');
  const pin={kind:geometry.kind,sourceId:asset.sourceId,expectedSource:asset.source,faceId:asset.face.topology.face.id,modelId:asset.face.geometry.name,geometryId:geometry.id};
  const parameter=key=>Object.hasOwn(params,key)?params[key]:.5;
  return geometry.kind==='surface'?{...pin,u:parameter('u'),v:parameter('v')}:{...pin,t:parameter('t')};
}
function controlMeasurementInput(control){const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  const value=parameter=>{const text=control[parameter].value.trim(),number=Number(text);
    check(decimal.test(text)&&Number.isFinite(number),control.side+' '+parameter+' must be a complete finite decimal.');return number;};
  const curve=control.geometry.selectedOptions[0]?.dataset.kind==='curve';
  return measurementInput(control.source.value,control.geometry.value,curve?{t:value('t')}:{u:value('u'),v:value('v')});
}
function measure(first=controlMeasurementInput(measurementControls[0]),second=controlMeasurementInput(measurementControls[1])){
  const report=viewer.measureQualifiedFacePoints(first,second);measurementReport=clone(report);
  const point=value=>({kind:value.kind,sourceId:value.sourceId,faceId:value.faceId,modelId:value.modelId,geometryId:value.geometryId,
    parameters:value.kind==='surface'?{u:value.u,v:value.v}:{t:value.t},pointMM:value.pointMM,pointScene:value.pointScene});
  measurementOutput.textContent=JSON.stringify({first:point(report.first),second:point(report.second),
    distanceMM:report.distanceMM,distanceScene:report.distanceScene,units:{pointMM:'mm',pointScene:'scene units',distanceMM:'mm',distanceScene:'scene units'},
    metric:report.metric,basis:report.basis,certification:report.certification},null,2);return report;
}
function candidate(overrides={}){const variant=overrides.variant??'warped',amount=overrides.assetCount??6,sourceAssets=originalRequests[variant].assets;
  const {variant:unusedVariant,assetCount:unusedAmount,...changes}=overrides;
  const selected=amount===2?sourceAssets.filter(asset=>['B','F'].includes(asset.sourceId)):sourceAssets;
  return {version:0,basis:'authored-xyz-matches-rhyup',assets:selected.map(asset=>({...clone(asset),color:[...colors['ABCDEF'.indexOf(asset.sourceId)]]})),
    countU:17,countV:17,camera:clone(camera),translateScene:[...translateScene],...changes};
}
function render(){const state=viewer.getState(),scene=state.qualifiedFaceScene,available=!disposed&&!['context-lost','unavailable'].includes(state.status);
  if(measurementReport&&[measurementReport.first,measurementReport.second].some(point=>{const asset=scene?.assets.find(value=>value.sourceId===point.sourceId);
    return !asset||asset.source!==point.expectedSource||asset.face.topology.face.id!==point.faceId||asset.face.geometry.name!==point.modelId;}))clearMeasurement();
  for(const[id,button]of Object.entries(buttons))button.disabled=id==='dispose'?disposed:!available||running;
  for(const control of[assetCount,countU,countV,colorAsset,colorInput])control.disabled=!available||running;
  if(scene){assetCount.value=String(scene.assets.length);countU.value=String(scene.countU);countV.value=String(scene.countV);}
  const previous=colorAsset.value;colorAsset.replaceChildren(...(scene?.assets??[]).map(asset=>{const option=document.createElement('option');option.value=asset.sourceId;option.textContent=asset.sourceId;return option;}));
  if([...colorAsset.options].some(option=>option.value===previous))colorAsset.value=previous;
  rows.replaceChildren(...(scene?.assets??[]).map(asset=>{const item=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('small'),button=document.createElement('button');
    item.dataset.sourceId=asset.sourceId;title.textContent=asset.sourceId+' · '+asset.face.topology.face.id;
    detail.textContent='Surface '+asset.face.topology.face.surfaceId+' · '+asset.face.geometry.objects.length+' original native objects · forward Face';
    button.textContent='Inspect '+asset.sourceId;button.setAttribute('aria-label','Inspect original Face '+asset.sourceId);button.disabled=disposed||running;
    button.addEventListener('click',()=>{try{inspect(asset.sourceId);}catch(error){display(error.message);}});item.append(title,detail,button);return item;}));
  renderMeasurementControls(scene);
}
function load(input=candidate()){uploads.length=0;draws.length=0;viewer.loadQualifiedFaceScene(input);clearInspection();clearMeasurement();render();return viewer.getState();}
function action(callback){if(disposed)return;try{callback();render();}catch(error){render();display(error.message);}}
function inspect(sourceId){const scene=viewer.getState().qualifiedFaceScene,asset=scene?.assets.find(value=>value.sourceId===sourceId);check(asset,'This source is not in the current accepted scene.');
  const compiled=compileCadModel(asset.source,{sourceVersion:0});check(compiled.ok&&same(compiled.model,asset.face.geometry),'Current original source/Face binding differs');
  const report=validateFaceBundle(asset.face),surface=asset.face.geometry.objects.find(object=>object.kind==='surface'&&object.id===asset.face.topology.face.surfaceId);
  inspectionReport={sourceId:asset.sourceId,modelVersion:compiled.model.version,originalObjectIds:compiled.model.objects.map(object=>object.id),
    faceId:asset.face.topology.face.id,surfaceId:surface.id,nativePointMM:evaluateSurface(surface,.5,.5),parametersUV:[.5,.5],
    originalBoundaryUV:clone(asset.face.topology.loop.uses.map(use=>use.pcurve)),orientation:asset.face.topology.face.orientation,
    incidenceValid:report.incidenceValid,solid:report.solid,geometricValidity:report.geometricValidity,source:asset.source};
  inspection.textContent=JSON.stringify(inspectionReport,null,2);return clone(inspectionReport);
}
function witness(input){const scene=viewer.getState().qualifiedFaceScene;check(scene.assets.length===input.assets.length&&same(scene.assets,input.assets),'Whole original source-qualified assets changed');
  const records=[];for(const asset of scene.assets){const surface=asset.face.geometry.objects.find(object=>object.kind==='surface'&&object.id===asset.face.topology.face.surfaceId),
    packet=tessellateSurface(surface,{countU:scene.countU,countV:scene.countV,revision:0}).packet;
    const expected=packet.positions.map((n,i)=>Math.fround(n*mmToSceneUnit+input.translateScene[i%3])),position=uploads.find(upload=>upload.type==='Float32Array'&&near(upload.values,expected));
    check(position&&position.exactReadback,'Original one-scale/scene-translation GL positions differ for '+asset.sourceId);
    check(uploads.some(upload=>upload.type==='Float32Array'&&near(upload.values,packet.normals.map(Math.fround)))
      &&uploads.some(upload=>upload.type==='Uint16Array'&&same(upload.values,packet.indices)),'Native normals/index upload differs');
    records.push({sourceId:asset.sourceId,vertices:packet.positions.length/3,triangles:packet.indices.length/3,positionBytes:position.bytes,parametersUV:packet.parameters});}
  check(uploads.every(upload=>upload.exactReadback),'Actual GL readback differs');return records;
}
function retained(label,callback){const before=viewer.getState(),pixels=pixelInfo(),counts=resourceCounts(),report=inspection.textContent;let error;
  try{callback();}catch(value){error=value;}check(error instanceof Error,label+' did not refuse');check(same(before,viewer.getState())&&same(pixels,pixelInfo())&&same(counts,resourceCounts()),label+' changed recoverable accepted state/pixels/resources');
  check(inspection.textContent===report,label+' changed accepted read-only inspection');result?.refusals.push({label,error:error.message,type:error.name,code:error.code??null});return error;}
function capture(label){const state=viewer.getState(),row={label,status:state.status,...pixelInfo(),sourceIds:state.qualifiedFaceScene?.assets.map(asset=>asset.sourceId)??[],resources:resourceCounts(),glErrors:glErrors()};
  check(row.glErrors.every(n=>n===0),label+' GL error');result.cases.push(row);return row;}
function failAllocation(type='Buffer',at=16){faultType=type;faultAt=at;faultAttempts=0;faultConsumed=false;}
function clearAllocationFault(){const value={type:faultType,attempts:faultAttempts,consumed:faultConsumed};faultType=null;return value;}
function mismatchCandidate(){const value=candidate();value.assets[5].source=originalRequests.interior_edit.assets[5].source;return value;}
async function runProof(){if(running||disposed||['context-lost','unavailable'].includes(viewer.getState().status))throw Error('An available scene is required');running=true;render();
  result={ok:false,schema:'barocss-viewer-qualified-face-1080-basic',cases:[],refusals:[],failures:[],scope:'Independent original forward Faces; root adds complete pixel/depth/transitions/race/recovery/loss gates'};window.__viewerQualifiedFaceResult=result;
  try{result.fixtures=manifest;result.inputAudit=await(await fetch('/input-audit.json')).json();const original=candidate();load(original);result.uploads=witness(original);const baseline=capture('six-original-qualified-Faces');
    check(!viewer.getState().surfaces.length&&!viewer.getState().curves.length,'Qualified Faces became unqualified primitive inventory');result.inspection=inspect('F');
    const copy=viewer.getState().qualifiedFaceScene;copy.assets[0].source='changed';copy.assets[0].face.geometry.objects[0].weights[0][0]=2;
    check(same(viewer.getState().qualifiedFaceScene.assets,original.assets),'Copied source/Face data exposed authority');
    retained('authentic F source with previous Face',()=>viewer.loadQualifiedFaceScene(mismatchCandidate()));
    const bad=mutate=>{const value=clone(original);mutate(value);return value;};
    retained('duplicate sourceId',()=>viewer.loadQualifiedFaceScene(bad(value=>value.assets[1].sourceId='A')));
    retained('foreign Surface association',()=>viewer.loadQualifiedFaceScene(bad(value=>value.assets[0].face.topology.face.surfaceId='foreign')));
    retained('grid budget18',()=>viewer.loadQualifiedFaceScene(bad(value=>value.countU=18)));
    retained('incorrect basis',()=>viewer.loadQualifiedFaceScene(bad(value=>value.basis='automatic')));
    let getterCalls=0;const getter=clone(original);Object.defineProperty(getter.assets[2],'source',{enumerable:true,get(){getterCalls++;return original.assets[2].source;}});
    retained('native source accessor',()=>viewer.loadQualifiedFaceScene(getter));check(getterCalls===0,'Caller getter invoked');
    uploads.length=0;failAllocation('Buffer',16);try{retained('late sixteenth Face buffer',()=>viewer.loadQualifiedFaceScene(original));}finally{result.allocation=clearAllocationFault();}
    check(result.allocation.consumed&&uploads.length>0,'Late sixth-Face allocation was not consumed');
    for(const[label,callback]of[['combined fit',()=>viewer.fit()],['unqualified pick',()=>viewer.pickGeometry({xCss:20,yCss:20})],
      ['unqualified selection',()=>viewer.selectGeometry(null)],['unqualified native metric',()=>viewer.measureNativeSurfacePoints(
        {modelId:original.assets[0].face.geometry.name,surfaceId:'patch_A',u:.5,v:.5},{modelId:original.assets[0].face.geometry.name,surfaceId:'patch_A',u:0,v:0})],
      ['null cloth',()=>viewer.setClothFrame(null)],['null fluid',()=>viewer.setFluidFrame(null)]])retained(label,callback);
    const faceF=original.assets.find(asset=>asset.sourceId==='F');
    const surfaceF=faceF.face.geometry.objects.find(object=>object.kind==='surface'&&object.id===faceF.face.topology.face.surfaceId);
    const packetF=tessellateSurface(surfaceF,{countU:original.countU,countV:original.countV,revision:0}).packet;
    const triangleUV=index=>packetF.indices.slice(index*3,index*3+3).reduce((uv,vertex)=>
      [uv[0]+packetF.parameters[vertex*2]/3,uv[1]+packetF.parameters[vertex*2+1]/3],[0,0]);
    const interiorUV=Array.from({length:packetF.indices.length/3},(_,index)=>triangleUV(index))
      .reduce((best,uv)=>Math.hypot(uv[0]-.5,uv[1]-.5)<Math.hypot(best[0]-.5,best[1]-.5)?uv:best,[0,0]);
    check(interiorUV.every(value=>value>.25&&value<.75),'Qualified F probe must be inside its original native boundary');
    const nativePointMM=evaluateSurface(surfaceF,...interiorUV),pointScene=nativePointMM.map((value,axis)=>value*mmToSceneUnit+original.translateScene[axis]);
    const commonCamera=prepareCamera(original.camera,canvas.width/canvas.height);
    const multiply=(matrix,point)=>[0,1,2,3].map(row=>[0,1,2,3].reduce((sum,column)=>sum+matrix[column*4+row]*point[column],0));
    const clip=multiply(commonCamera.projection,multiply(commonCamera.view,[...pointScene,1]));
    const probePixel=[Math.floor((clip[0]/clip[3]+1)*canvas.width/2),Math.floor((clip[1]/clip[3]+1)*canvas.height/2)];
    check(probePixel[0]>=0&&probePixel[0]<canvas.width&&probePixel[1]>=0&&probePixel[1]<canvas.height,'Qualified F interior probe must be on screen');
    const readProbe=()=>{const bytes=viewer.readPixels(),offset=(probePixel[1]*canvas.width+probePixel[0])*4;return Array.from(bytes.slice(offset,offset+4));};
    const originalProbe=readProbe();
    const reversed=candidate({assets:[...clone(original.assets)].reverse()});load(reversed);const reversedFrame=capture('reversed-original-order'),reversedProbe=readProbe();
    result.orderComparison={sourceId:'F',faceId:faceF.face.topology.face.id,surfaceId:surfaceF.id,parametersUV:interiorUV,nativePointMM,probePixel,
      originalHash:baseline.hash,reversedHash:reversedFrame.hash,originalPixel:originalProbe,reversedPixel:reversedProbe,
      boundaryColorPolicy:'Touching equal-depth native boundaries can resolve color by draw order under strict LESS.'};
    check(same(originalProbe,reversedProbe),'Reversed order changed the qualified original F interior pixel');
    check(viewer.getState().qualifiedFaceScene.assets.every(asset=>original.assets.some(value=>same(value,asset))),
      'Reversed order changed original source-qualified assets');
    const edited=candidate({variant:'interior_edit'});load(edited);result.editedUploads=witness(edited);const edit=capture('authentic-F-interior-edit');check(edit.hash!==baseline.hash,'Authentic F source/Face edit changed no pixels');
    for(let i=0;i<5;i++)check(same(edited.assets[i],original.assets[i]),'F edit changed another original source');check(inspectionReport===null,'Accepted source replacement kept stale report');
    inspect('F');const report=inspection.textContent;viewer.orbit(.03,.02);viewer.pan(.01,0);viewer.zoom(1.02);viewer.resize(480,360);viewer.resize(640,480);viewer.setView(camera);
    check(inspection.textContent===report,'Camera/resize changed source inspection');capture('camera-retains-current-original-Faces');
    load(candidate({assetCount:2}));capture('two-original-Faces');check(viewer.getState().qualifiedFaceScene.assets.length===2,'Two-asset admission failed');
    viewer.clear();clearInspection();clearMeasurement();check(viewer.getState().qualifiedFaceScene===null,'Clear retained qualified Face authority');load(original);
    result.contextCount=contexts.size;result.resources=resourceCounts();result.glErrors=glErrors();result.errors=[...errors];result.warnings=[...warnings];result.getterCalls=getterCalls;
    check(contexts.size===1&&result.glErrors.every(n=>n===0)&&!errors.length&&!warnings.length,'Context/GL/browser gate failed');result.ok=true;
  }catch(error){result.error=error.stack||error.message;result.failures.push({error:result.error,completed:result.cases.length});result.resources=resourceCounts();result.errors=[...errors];}
  finally{running=false;render();window.__viewerQualifiedFaceResult=result;display(result.ok?'Original Face checks completed.':('Face checks stopped: '+(result.error??'Unknown error')));
    try{await fetch('/result',{method:'POST',body:JSON.stringify(result)});}catch(error){result.recordingError=error.message;}}return result;}
function dispose(){if(disposed)return;viewer.dispose();viewer.dispose();disposed=true;clearInspection();clearMeasurement();render();const receipt={status:viewer.getState().status,resources:resourceCounts(),contextCount:contexts.size,
  glErrors:glErrors(),errors:[...errors],warnings:[...warnings]};if(result)result.disposal=receipt;display('Viewer disposed.');return receipt;}
try{manifest=await(await fetch('/fixture-manifest.json')).json();for(const item of manifest){const bytes=await(await fetch(item.url)).arrayBuffer();
    check(bytes.byteLength===item.bytes&&await sha(bytes)===item.sha256,'Original Face fixture bytes/hash changed');fixtures[item.name]={...item,bytes:new Uint8Array(bytes),text:new TextDecoder().decode(bytes)};}
  for(const name of['warped','interior_edit'])originalRequests[name]=JSON.parse(fixtures[name+'.authentic-request.json'].text);
  for(const id of'ABCDEF'){const source=fixtures['warped_'+id+'.source0.css'].text;check(source===originalRequests.warped.assets.find(asset=>asset.sourceId===id).source,'Original source file/Face association differs');originalSources[id]=source;}
  check(fixtures['interior_edit_F.source0.css'].text===originalRequests.interior_edit.assets[5].source,'Original interior-edit Source0 association differs');
  viewer=createViewer(canvas,{mmToSceneUnit,background});load(candidate());lossExtension=[...contexts][0].getExtension('WEBGL_lose_context');
  window.__viewerQualifiedFaceProof={viewer,createViewer,candidate,load,render,inspect,measurementInput,measure,mismatchCandidate,dispose,resourceCounts,uploads,draws,glErrors,errors,warnings,lossExtension,failAllocation,
    failNextBuffer(at=16){failAllocation('Buffer',at);},clearAllocationFault,originalRequests,originalSources,fixtures,manifest,colors,camera,translateScene,mmToSceneUnit,background,pixelInfo,witness,retained,capture,runProof,
    prepareQualifiedFaceScene,QualifiedFaceSceneRenderer,MixedDepthRenderer,prepareMixedDepthFrame,compileGpu,prepareCamera,prepareUniformCurvePreview,prepareSelectedUniformCurvePreview,
    compileCadModel,validateFaceBundle,tessellateSurface,evaluateSurface,evaluateCurve,curveDomain,parseBooleanExtrusionFeatureGraph,parseBaroCadSource,
    loadBaroCadModelSet,loadBaroCadDocument,parseBaroCadDocument,prepareBaroCadDocumentPrimitiveNativeRefsV2,parseBaroCadAssembly,loadBaroCadAssembly,
    createClothWorld,createPhysicsClothWorld:createClothWorld,PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer,canvas,
    get gl(){return[...contexts][0];},get state(){return viewer.getState();},get currentScene(){return viewer.getState().qualifiedFaceScene;},get inspectionReport(){return clone(inspectionReport);},
    get measurementReport(){return clone(measurementReport);},get result(){return result;}};
  display('Original Faces ready. Inspect a current source from its row.');
}catch(error){display('Original Faces could not load: '+error.message);}
buttons.load.addEventListener('click',()=>action(()=>load(candidate({assetCount:Number(assetCount.value),countU:Number(countU.value),countV:Number(countV.value)}))));
buttons['interior-edit'].addEventListener('click',()=>action(()=>load(candidate({variant:'interior_edit'}))));buttons.mismatch.addEventListener('click',()=>action(()=>load(mismatchCandidate())));
buttons.reverse.addEventListener('click',()=>action(()=>{const scene=viewer.getState().qualifiedFaceScene;check(scene,'Load current Faces first.');load({version:0,basis:scene.basis,assets:[...clone(scene.assets)].reverse(),countU:scene.countU,countV:scene.countV,camera:clone(scene.camera),translateScene:[...scene.translate]});}));
buttons['apply-color'].addEventListener('click',()=>action(()=>{const scene=viewer.getState().qualifiedFaceScene;check(scene,'Load current Faces first.');const assets=clone(scene.assets),asset=assets.find(value=>value.sourceId===colorAsset.value);
  check(asset,'Choose a current source');asset.color=[1,3,5].map(index=>parseInt(colorInput.value.slice(index,index+2),16)/255);
  load({version:0,basis:scene.basis,assets,countU:scene.countU,countV:scene.countV,camera:clone(scene.camera),translateScene:[...scene.translate]});}));
buttons['saved-view'].addEventListener('click',()=>action(()=>viewer.setView(camera)));buttons.orbit.addEventListener('click',()=>action(()=>viewer.orbit(.05,.02)));buttons.pan.addEventListener('click',()=>action(()=>viewer.pan(.01,0)));
buttons.resize.addEventListener('click',()=>action(()=>viewer.resize(canvas.width===640?480:640,canvas.height===480?360:480)));buttons.clear.addEventListener('click',()=>action(()=>{viewer.clear();clearInspection();clearMeasurement();}));
for(const control of measurementControls)for(const field of['source','geometry'])control[field].addEventListener('change',()=>renderMeasurementControls(viewer.getState().qualifiedFaceScene));
measureButton.addEventListener('click',()=>action(()=>measure()));
buttons['run-proof'].addEventListener('click',runProof);buttons.dispose.addEventListener('click',dispose);buttons['lose-context'].addEventListener('click',()=>lossExtension?.loseContext());
canvas.addEventListener('webglcontextlost',()=>{render();display('Context lost. Original source inspection remains available.');});window.addEventListener('beforeunload',()=>{if(viewer)dispose();});
