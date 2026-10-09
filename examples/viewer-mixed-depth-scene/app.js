import {createViewer} from '@barocss/viewer';
import {compileGpu,prepareMixedDepthFrame,MixedDepthRenderer,prepareCamera,prepareUniformCurvePreview,prepareSelectedUniformCurvePreview,
  PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer} from '@barocss/gpu';
import {compileCadModel,evaluateSurface,evaluateCurve,curveDomain,parseBooleanExtrusionFeatureGraph} from '@barocss/cad';
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
const canvas=document.querySelector('#view'),status=document.querySelector('#status'),inspection=document.querySelector('#inspection'),objects=document.querySelector('#objects');
const nativeMenu=document.querySelector('#native-source'),surfaceMenu=document.querySelector('#surface'),sphereInput=document.querySelector('#sphere-source');
const countU=document.querySelector('#count-u'),countV=document.querySelector('#count-v'),translationInputs=['x','y','z'].map(axis=>document.querySelector('#translate-'+axis));
const buttons=Object.fromEntries(['load','native-front','sphere-front','saved-view','orbit','pan','query','clear','run-proof','lose-context','dispose'].map(id=>[id,document.querySelector('#'+id)]));
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
WebGL2RenderingContext.prototype.bufferData=function(target,values,...args){const result=bufferData.call(this,target,values,...args);
  if(ArrayBuffer.isView(values)){const readback=new values.constructor(values.length);this.getBufferSubData(target,0,readback);
    uploads.push({type:values.constructor.name,values:Array.from(readback),bytes:values.byteLength,exactReadback:same(values,readback)});}return result;};
for(const name of['drawArrays','drawElements']){const original=WebGL2RenderingContext.prototype[name];
  WebGL2RenderingContext.prototype[name]=function(...args){draws.push({method:name,args:[...args],depth:this.getParameter(this.DEPTH_FUNC),write:this.getParameter(this.DEPTH_WRITEMASK)});return original.apply(this,args);};}
window.addEventListener('error',event=>errors.push(event.message));window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const warn=console.warn;console.warn=(...args)=>{warnings.push(args.map(String).join(' '));warn.apply(console,args);};
const sources={},fixtures={},models={};let manifest=[],viewer=null,currentNativeName='native-original',running=false,disposed=false,result=null,acceptedNativeOptions=null;
const camera={eye:[0,0,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:20},mmToSceneUnit=.001;
const nativeOptions={sourceVersion:0,countU:17,countV:17},surfaceColor=[.1,.2,1];
const resourceCounts=()=>Object.fromEntries(Object.entries(resources).map(([key,live])=>[key,live.size]));
const glErrors=()=>[...contexts].map(gl=>gl.getError());
const pixelInfo=()=>{const bytes=viewer.readPixels(),offset=(Math.floor(canvas.height/2)*canvas.width+Math.floor(canvas.width/2))*4;
  return{hash:hash(bytes),center:Array.from(bytes.slice(offset,offset+4))};};
const display=value=>status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
const isBlue=p=>p[2]>80&&p[2]>p[0]+40&&p[2]>p[1]+40&&p[3]===255;
const isRed=p=>p[0]>60&&p[0]>p[1]+40&&p[0]>p[2]+40&&p[3]===255;
function populateSurfaces(name,selected){surfaceMenu.replaceChildren(...models[name].objects.filter(object=>object.kind==='surface').map(surface=>{
  const option=document.createElement('option');option.value=surface.id;option.textContent=surface.id;return option;}));if(selected)surfaceMenu.value=selected;}
function candidate(overrides={}){const name=overrides.nativeName??currentNativeName,model=models[name],surfaceId=overrides.surfaceId??model.objects.find(object=>object.kind==='surface').id;
  const {nativeName:unusedName,surfaceId:unusedSurface,...changes}=overrides;
  return{version:0,sphereSource:sources['sphere-original'],nativeSource:sources[name],native:clone(nativeOptions),
    surface:{modelId:model.name,surfaceId},surfaceColor:[...surfaceColor],nativeTranslateScene:[0,0,-.75],camera:clone(camera),basis:'authored-xyz-matches-rhyup',...changes};}
function render(){const state=viewer.getState(),live=!disposed&&!['context-lost','unavailable'].includes(state.status),mixed=state.mixedDepth;
  for(const[id,button]of Object.entries(buttons))button.disabled=id==='dispose'?disposed:id==='query'?!mixed||disposed:!live||running;
  for(const control of[nativeMenu,surfaceMenu,sphereInput,countU,countV,...translationInputs])control.disabled=!live||running;
  if(mixed){const name=manifest.find(item=>sources[item.name]===mixed.native.source)?.name;if(name){currentNativeName=name;nativeMenu.value=name;populateSurfaces(name,mixed.frame.surface.ref.geometryId);}
    sphereInput.value=mixed.frame.source;
    if(acceptedNativeOptions){countU.value=String(acceptedNativeOptions.countU);countV.value=String(acceptedNativeOptions.countV);}
    translationInputs.forEach((input,i)=>input.value=String(mixed.frame.translate[i]));}
  if(!mixed)inspection.textContent='';
  objects.replaceChildren(...(mixed?.native.model.objects??[]).map(object=>{const item=document.createElement('li');item.textContent=object.id+' · '+object.kind+' · '
    +(object.kind==='surface'&&object.id===mixed.frame.surface.ref.geometryId?'Selected native display':'Retained CPU only, not displayed');return item;}));
}
function load(input=candidate()){uploads.length=0;draws.length=0;viewer.loadMixedDepthScene(input);acceptedNativeOptions=clone(input.native);inspection.textContent='';render();return viewer.getState();}
function action(callback){if(disposed)return;try{callback();render();}catch(error){render();display(error.message);}}
function nativeQueries(){const state=viewer.getState(),native=state.mixedDepth?.native;check(native,'Load an available original mixed source');
  const model=native.model,surface=model.objects.find(object=>object.kind==='surface'&&object.id===state.mixedDepth.frame.surface.ref.geometryId);
  const domainU=[surface.knotsU[surface.degreeU],surface.knotsU[surface.controlPoints.length]],domainV=[surface.knotsV[surface.degreeV],surface.knotsV[surface.controlPoints[0].length]];
  const u=(domainU[0]+domainU[1])/2,v=(domainV[0]+domainV[1])/2,input={modelId:model.name,surfaceId:surface.id,u,v};
  const measured=viewer.measureNativeSurfacePoints(input,{...input,u:domainU[0],v:domainV[0]}),expected=evaluateSurface(surface,u,v);
  check(near(measured.first.pointMM,expected,1e-10),'Original native mm Surface point differs');
  const output={selectedSurface:{ref:measured.first.ref,pointMM:measured.first.pointMM,expected,domainU,domainV,space:'original native mm'},retainedCPU:[]};
  for(const object of model.objects){if(object.id===surface.id)continue;
    if(object.kind==='surface'){const point=evaluateSurface(object,.5,.5),sample=viewer.measureNativeSurfacePoints({modelId:model.name,surfaceId:object.id,u:.5,v:.5},{modelId:model.name,surfaceId:object.id,u:0,v:0});
      check(near(sample.first.pointMM,point),'Retained native Surface query differs');output.retainedCPU.push({id:object.id,kind:object.kind,pointMM:sample.first.pointMM,displayed:false});}
    else{const[left,right]=curveDomain(object),t=(left+right)/2,sample=viewer.measureNativeCurvePoints({modelId:model.name,curveId:object.id,t},{modelId:model.name,curveId:object.id,t:left});
      check(near(sample.first.pointMM,evaluateCurve(object,t)),'Retained native Curve query differs');output.retainedCPU.push({id:object.id,kind:object.kind,pointMM:sample.first.pointMM,displayed:false});}}
  inspection.textContent=JSON.stringify(output,null,2);return output;
}
function witness(input){const state=viewer.getState(),mixed=state.mixedDepth;check(mixed.native.source===input.nativeSource&&mixed.frame.source===input.sphereSource,'Complete original source strings changed');
  check(same(mixed.native.model,models[input.nativeSource===sources['native-original']?'native-original':'native-mixed']),'Complete original native Model changed');
  const packet=mixed.frame.surface.packet,expected=packet.positions.map((n,i)=>Math.fround(n*mmToSceneUnit+input.nativeTranslateScene[i%3]));
  const actual=uploads.find(upload=>upload.type==='Float32Array'&&near(upload.values,expected));check(actual&&actual.exactReadback,'Native mm scale then scene translation GL upload differs');
  check(uploads.every(upload=>upload.exactReadback),'Actual mixed GL buffer readback differs');
  check(same(state.camera,input.camera)&&same(mixed.frame.translate,input.nativeTranslateScene)&&mixed.frame.mmToSceneUnit===mmToSceneUnit,'Explicit camera/translation/unit frame differs');
  return{positions:actual.values,expected,bytes:actual.bytes,parameters:packet.parameters,indices:packet.indices,sourceNative:input.nativeSource,sourceSphere:input.sphereSource};
}
function project(point,cameraInput=camera){const prepared=prepareCamera(cameraInput,canvas.width/canvas.height),multiply=(matrix,p)=>[0,1,2,3].map(row=>[0,1,2,3].reduce((sum,col)=>sum+matrix[col*4+row]*p[col],0));
  const clip=multiply(prepared.projection,multiply(prepared.view,[...point,1]));return[Math.round((clip[0]/clip[3]+1)*canvas.width/2),Math.round((clip[1]/clip[3]+1)*canvas.height/2)];}
function pixelAt(coordinates){const bytes=viewer.readPixels(),x=Math.max(0,Math.min(canvas.width-1,coordinates[0])),y=Math.max(0,Math.min(canvas.height-1,coordinates[1]));return Array.from(bytes.slice((y*canvas.width+x)*4,(y*canvas.width+x)*4+4));}
function retained(label,callback){const before=viewer.getState(),pixels=pixelInfo(),counts=resourceCounts();let error;
  try{callback();}catch(value){error=value;}check(error instanceof Error,label+' did not refuse');check(same(before,viewer.getState())&&same(pixels,pixelInfo())&&same(counts,resourceCounts()),label+' changed recoverable accepted state/pixels/resources');
  result?.refusals.push({label,error:error.message,type:error.name,code:error.code??null});return error;}
function capture(label){const state=viewer.getState(),row={label,status:state.status,...pixelInfo(),nativeObjects:state.mixedDepth?.native.model.objects.length??null,
  surfaces:state.surfaces,curves:state.curves,resources:resourceCounts(),glErrors:glErrors()};check(row.glErrors.every(n=>n===0),label+' GL error');result.cases.push(row);return row;}
function failAllocation(type='Buffer',at=3){faultType=type;faultAt=at;faultAttempts=0;faultConsumed=false;}
function clearAllocationFault(){const value={type:faultType,attempts:faultAttempts,consumed:faultConsumed};faultType=null;return value;}
async function runProof(){if(running||disposed||['context-lost','unavailable'].includes(viewer.getState().status))throw Error('Proof needs an available Viewer');running=true;render();
  result={ok:false,schema:'barocss-viewer-mixed-depth-1075-basic',cases:[],refusals:[],failures:[],scope:'One original Sphere/one original Surface; root adds complete old-mode/race/unavailable/loss gates'};window.__viewerMixedDepthResult=result;
  try{result.fixtures=manifest;result.inputAudit=await(await fetch('/input-audit.json')).json();
    const front=candidate({nativeName:'native-original',nativeTranslateScene:[0,0,.75]});load(front);result.frontUpload=witness(front);const frontPixels=capture('native-front');check(isBlue(frontPixels.center),'Original native front did not occlude Sphere');
    const behind=candidate({nativeName:'native-original',nativeTranslateScene:[0,0,-.75]});load(behind);result.backUpload=witness(behind);const backPixels=capture('sphere-front');check(isRed(backPixels.center),'Original Sphere did not occlude native behind');
    const missPosition=[.8,0,-.75],missPixel=project(missPosition),miss=pixelAt(missPixel);check(isBlue(miss),'SDF miss overwrote native pixels');result.depth={front:frontPixels,behind:backPixels,miss:{position:missPosition,pixel:missPixel,rgba:miss}};
    const original=viewer.getState().mixedDepth;check(Object.is(original.native.model.objects[0].knotsV[0],-0),'Original signed-zero native domain changed');result.native=nativeQueries();
    const copy=viewer.getState().mixedDepth;copy.frame.source='changed';copy.native.model.objects[0].weights[0][0]=99;check(same(original,viewer.getState().mixedDepth),'Copied CPU source exposed authority');
    const bad=mutate=>{const input=clone(behind);mutate(input);return input;};
    retained('wrong original native ref',()=>viewer.loadMixedDepthScene(bad(input=>input.surface.surfaceId='foreign')));
    retained('unknown field',()=>viewer.loadMixedDepthScene({...clone(behind),extra:true}));
    retained('wrong basis',()=>viewer.loadMixedDepthScene(bad(input=>input.basis='automatic')));
    retained('malformed original Sphere source',()=>viewer.loadMixedDepthScene(bad(input=>input.sphereSource='not a source1 scene')));
    retained('invalid camera inside Sphere',()=>viewer.loadMixedDepthScene(bad(input=>input.camera.eye=[0,0,0])));
    retained('native translation outside bounds',()=>viewer.loadMixedDepthScene(bad(input=>input.nativeTranslateScene=[1001,0,0])));
    let getterCalls=0;const getter=clone(behind);Object.defineProperty(getter,'nativeSource',{enumerable:true,get(){getterCalls++;return behind.nativeSource;}});
    retained('input getter',()=>viewer.loadMixedDepthScene(getter));check(getterCalls===0,'Caller getter invoked');
    uploads.length=0;failAllocation('Buffer',3);try{retained('late third native buffer allocation',()=>viewer.loadMixedDepthScene(front));}finally{result.allocation=clearAllocationFault();}
    check(result.allocation.consumed&&uploads.length>0,'Late third buffer allocation not consumed after upload');
    for(const[label,callback]of[['combined fit',()=>viewer.fit()],['combined pick',()=>viewer.pickGeometry({xCss:20,yCss:20})],
      ['null selection',()=>viewer.selectGeometry(null)],['visibility',()=>viewer.setVisibleGeometry([])],['motion reset',()=>viewer.resetMotion()],
      ['null cloth layer',()=>viewer.setClothFrame(null)],['null fluid layer',()=>viewer.setFluidFrame(null)]])retained(label,callback);
    viewer.setView({...clone(camera),eye:[.25,.1,6]});viewer.orbit(.01,.01);viewer.pan(.005,0);viewer.zoom(1.01);viewer.resize(480,360);viewer.resize(640,480);viewer.setView(camera);
    check(viewer.getState().mixedDepth.native.source===behind.nativeSource&&same(viewer.getState().mixedDepth.native.model,original.native.model),'Camera/resize changed original native authority');capture('camera-restored');
    const edit=bad(input=>input.sphereSource=input.sphereSource.replace('color:#ff0000','color:#00ff00'));load(edit);const edited=capture('explicit-original-source-color-edit');check(edited.hash!==backPixels.hash,'Actual Source1 edit changed no pixels');
    const whole=candidate({nativeName:'native-mixed',surfaceId:'left_patch'});load(whole);result.wholeUpload=witness(whole);result.retainedQueries=nativeQueries();
    check(viewer.getState().mixedDepth.native.model.objects.length===4&&viewer.getState().surfaces.length===1&&!viewer.getState().curves.length,'Retained whole source became full display');capture('whole-native-four-object-one-surface');
    viewer.clear();check(viewer.getState().mixedDepth===null&&viewer.getState().status==='empty','Clear retained mixed mode');load(behind);
    result.contextCount=contexts.size;result.resources=resourceCounts();result.glErrors=glErrors();result.errors=[...errors];result.warnings=[...warnings];result.getterCalls=getterCalls;
    check(contexts.size===1&&result.glErrors.every(n=>n===0)&&!errors.length&&!warnings.length,'Context/GL/browser gate failed');result.ok=true;
  }catch(error){result.error=error.stack||error.message;result.failures.push({error:result.error,completed:result.cases.length});result.resources=resourceCounts();result.errors=[...errors];}
  finally{running=false;render();window.__viewerMixedDepthResult=result;display({ok:result.ok,status:viewer.getState().status,cases:result.cases.length,refusals:result.refusals.length,error:result.error??null,scope:result.scope});
    try{await fetch('/result',{method:'POST',body:JSON.stringify(result)});}catch(error){result.recordingError=error.message;}}return result;
}
function dispose(){if(disposed)return;viewer.dispose();viewer.dispose();disposed=true;render();const receipt={status:viewer.getState().status,resources:resourceCounts(),contextCount:contexts.size,
  glErrors:glErrors(),errors:[...errors],warnings:[...warnings]};if(result)result.disposal=receipt;display(receipt);return receipt;}
try{manifest=await(await fetch('/fixture-manifest.json')).json();for(const item of manifest){const bytes=await(await fetch(item.url)).arrayBuffer();
    check(bytes.byteLength===item.bytes&&await sha(bytes)===item.sha256,'Original source bytes/hash changed');sources[item.name]=new TextDecoder().decode(bytes);fixtures[item.name]={...item,bytes:new Uint8Array(bytes)};
    if(item.name.startsWith('native-')){const compiled=compileCadModel(sources[item.name],{sourceVersion:0});check(compiled.ok,'Complete original native source did not compile');models[item.name]=compiled.model;
      const option=document.createElement('option');option.value=item.name;option.textContent=item.name;nativeMenu.append(option);}}
  populateSurfaces('native-original');sphereInput.value=sources['sphere-original'];viewer=createViewer(canvas,{mmToSceneUnit,background:[.035,.065,.105]});load(candidate());lossExtension=[...contexts][0].getExtension('WEBGL_lose_context');
  window.__viewerMixedDepthProof={viewer,createViewer,compileGpu,prepareMixedDepthFrame,MixedDepthRenderer,prepareCamera,compileCadModel,evaluateSurface,evaluateCurve,curveDomain,
    parseBaroCadSource,loadBaroCadModelSet,loadBaroCadDocument,parseBaroCadDocument,prepareBaroCadDocumentPrimitiveNativeRefsV2,parseBaroCadAssembly,loadBaroCadAssembly,
    parseBooleanExtrusionFeatureGraph,prepareUniformCurvePreview,prepareSelectedUniformCurvePreview,createClothWorld,createPhysicsClothWorld:createClothWorld,
    PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer,sources,fixtures,manifest,models,nativeOptions,surfaceColor,camera,mmToSceneUnit,canvas,candidate,load,nativeQueries,
    witness,project,pixelAt,pixelInfo,isBlue,isRed,retained,capture,runProof,render,dispose,resourceCounts,glErrors,uploads,draws,errors,warnings,lossExtension,failAllocation,
    failNextBuffer(at=3){failAllocation('Buffer',at);},clearAllocationFault,get gl(){return[...contexts][0];},get state(){return viewer.getState();},get result(){return result;}};
  window.__viewerMixedDepthProof.nativeSourcePanel=await(await fetch('/original-panel.barocad')).text();display('Ready: original Sphere scene units, one rational original native Surface at0.001scene units/mm, translated behind Sphere.');
}catch(error){display({ok:false,stage:'startup',error:error.stack||error.message});}
nativeMenu.addEventListener('change',()=>populateSurfaces(nativeMenu.value));buttons.load.addEventListener('click',()=>action(()=>load(candidate({nativeName:nativeMenu.value,surfaceId:surfaceMenu.value,
  sphereSource:sphereInput.value,native:{sourceVersion:0,countU:Number(countU.value),countV:Number(countV.value)},nativeTranslateScene:translationInputs.map(input=>Number(input.value))}))));
buttons['native-front'].addEventListener('click',()=>action(()=>load(candidate({nativeTranslateScene:[0,0,.75]}))));buttons['sphere-front'].addEventListener('click',()=>action(()=>load(candidate({nativeTranslateScene:[0,0,-.75]}))));
buttons['saved-view'].addEventListener('click',()=>action(()=>viewer.setView(camera)));buttons.orbit.addEventListener('click',()=>action(()=>viewer.orbit(.05,.02)));buttons.pan.addEventListener('click',()=>action(()=>viewer.pan(.01,0)));
buttons.query.addEventListener('click',()=>action(nativeQueries));buttons.clear.addEventListener('click',()=>action(()=>viewer.clear()));buttons['run-proof'].addEventListener('click',runProof);buttons.dispose.addEventListener('click',dispose);
buttons['lose-context'].addEventListener('click',()=>lossExtension?.loseContext());canvas.addEventListener('webglcontextlost',()=>{render();display('Context lost; original CPU sources remain readable. A fresh Viewer is required for GPU presentation.');});
window.addEventListener('beforeunload',()=>{if(viewer)dispose();});
