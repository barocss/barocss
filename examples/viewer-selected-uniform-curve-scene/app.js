import {createViewer} from '@barocss/viewer';
import {prepareSelectedUniformCurvePreview,validateSelectedUniformCurvePreview,prepareUniformCurvePreview,validateUniformCurvePreview,
  PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer} from '@barocss/gpu';
import {compileCadModel,evaluateCurve,evaluateSurface,curveDomain,parseBooleanExtrusionFeatureGraph} from '@barocss/cad';
import {parseBaroCadAssembly,loadBaroCadAssembly} from '@barocss/cad-interop/assembly';
import {loadBaroCadModelSet} from '@barocss/cad-interop/model-set';
import {loadBaroCadDocument,parseBaroCadDocument,prepareBaroCadDocumentPrimitiveNativeRefsV2} from '@barocss/cad-interop/document';
import {createClothWorld} from '@barocss/physics/cloth';

const check=(condition,message)=>{if(!condition)throw Error(message);},clone=value=>structuredClone(value);
const same=(a,b)=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length
  &&Object.keys(a).every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
const near=(a,b,tolerance=1e-10)=>a.length===b.length&&a.every((n,i)=>Math.abs(n-b[i])<=tolerance);
const hash=bytes=>bytes.reduce((n,byte)=>Math.imul(n^byte,16777619)>>>0,2166136261);
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const canvas=document.querySelector('#view'),status=document.querySelector('#status'),objects=document.querySelector('#objects');
const inspection=document.querySelector('#inspection'),unshownOutput=document.querySelector('#unshown-output');
const sourceMenu=document.querySelector('#source'),curveMenu=document.querySelector('#curve'),countMenu=document.querySelector('#count'),visible=document.querySelector('#visible');
const buttons=Object.fromEntries(['load','query','unshown-query','select','fit','orbit','pan','clear','run-proof','lose-context','dispose'].map(id=>[id,document.querySelector('#'+id)]));
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
const drawArrays=WebGL2RenderingContext.prototype.drawArrays;
WebGL2RenderingContext.prototype.drawArrays=function(mode,first,count){draws.push({mode,first,count});return drawArrays.call(this,mode,first,count);};
window.addEventListener('error',event=>errors.push(event.message));window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const warn=console.warn;console.warn=(...args)=>{warnings.push(args.map(String).join(' '));warn.apply(console,args);};
const sources={},fixtures={},models={};let manifest=[],viewer=null,disposed=false,running=false,result=null,currentName='mixed-quintic',currentCurve='primary_quintic';
const options={basis:'authored-xyz-matches-rhyup'},mmToSceneUnit=.17;
const resourceCounts=()=>Object.fromEntries(Object.entries(resources).map(([key,live])=>[key,live.size]));
const glErrors=()=>[...contexts].map(gl=>gl.getError());
const pixelInfo=()=>{const bytes=viewer.readPixels(),background=[.035,.065,.105].map(n=>Math.round(n*255));let nonBackgroundPixels=0;
  for(let i=0;i<bytes.length;i+=4)if(!background.every((n,channel)=>Math.abs(bytes[i+channel]-n)<=1))nonBackgroundPixels++;
  return{hash:hash(bytes),nonBackgroundPixels};};
const display=value=>status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
function ref(){const state=viewer.getState();check(state.selectedUniformCurve,'Load a selected uniform Curve first.');return{kind:'curve',...state.curves[0]};}
function populateCurves(sourceName,preferred){curveMenu.replaceChildren(...models[sourceName].objects.filter(object=>object.kind==='curve').map(curve=>{
  const option=document.createElement('option');option.value=curve.id;option.textContent=curve.id;return option;}));
  if(preferred&&[...curveMenu.options].some(option=>option.value===preferred))curveMenu.value=preferred;}
function render(){const state=viewer.getState(),sample=state.selectedUniformCurve,live=!disposed&&state.status!=='context-lost',ready=live&&state.status==='ready';
  for(const[id,button]of Object.entries(buttons))button.disabled=id==='dispose'?disposed:!live||running;
  buttons.query.disabled=!live||running||!sample;buttons['unshown-query'].disabled=!live||running||!sample;
  buttons.select.disabled=!ready||running||!sample||!state.visibleGeometry.length;buttons.fit.disabled=!ready||running||!state.visibleGeometry.length;
  sourceMenu.disabled=!live||running;curveMenu.disabled=!live||running;countMenu.disabled=!live||running;visible.disabled=!ready||running||!sample;
  visible.checked=state.visibleGeometry.length>0;
  const acceptedName=manifest.find(item=>sources[item.name]===sample?.source)?.name;
  if(acceptedName){currentName=acceptedName;currentCurve=sample.curveId;sourceMenu.value=acceptedName;populateCurves(acceptedName,currentCurve);countMenu.value=String(sample.count);}
  else{inspection.textContent='';unshownOutput.textContent='';}
  objects.replaceChildren(...(sample?.model.objects??[]).map(object=>{const item=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('small');
    title.textContent=object.id+' · '+object.kind;detail.textContent=object.id===sample.curveId&&object.kind==='curve'
      ?'Selected display · native coefficients retained':'Retained CPU only · not displayed';item.append(title,detail);return item;}));
}
function load(name=currentName,curveId=currentCurve,count=Number(countMenu.value)){
  const input=prepareSelectedUniformCurvePreview({source:sources[name],curveId,count});uploads.length=0;draws.length=0;
  viewer.loadSelectedUniformCurvePreview(input,clone(options));currentName=name;currentCurve=curveId;inspection.textContent='';unshownOutput.textContent='';render();return input;
}
function action(callback){if(disposed)return;try{callback();render();}catch(error){render();display(error.message);}}
function independentPoint(curve,parameter){const[left,right]=curveDomain(curve),t=(parameter-left)/(right-left),n=curve.degree;
  check(curve.controlPoints.length===n+1,'Independent fixture witness requires one clamped Bezier span');
  const binomial=i=>{let value=1;for(let k=1;k<=i;k++)value=value*(n-k+1)/k;return value;};
  const weighted=curve.weights.map((weight,i)=>weight*binomial(i)*(1-t)**(n-i)*t**i),sum=weighted.reduce((a,b)=>a+b,0);
  return[0,1,2].map(axis=>curve.controlPoints.reduce((value,point,i)=>value+point[axis]*weighted[i],0)/sum);
}
function query(parameter){const sample=viewer.getState().selectedUniformCurve;check(sample,'Selected source needed');
  const curve=sample.model.objects.find(object=>object.kind==='curve'&&object.id===sample.curveId),[left,right]=curveDomain(curve),t=parameter??(left+right)/2;
  const identity={modelId:sample.model.name,curveId:curve.id},measured=viewer.measureNativeCurvePoints({...identity,t},{...identity,t:left}),expected=independentPoint(curve,t);
  check(near(measured.first.pointMM,expected),'Independent original selected native point differs');
  const value={kind:'selected displayed Curve native inspection',ref:identity,parameter:t,domain:[left,right],pointMM:measured.first.pointMM,expected,certification:measured.certification};
  inspection.textContent=JSON.stringify(value,null,2);return value;
}
function unshownQueries(){const sample=viewer.getState().selectedUniformCurve;check(sample,'Selected source needed');const model=sample.model;
  const other=model.objects.find(object=>object.kind==='curve'&&object.id!==sample.curveId),surface=model.objects.find(object=>object.kind==='surface');
  check(other&&surface,'Authentic mixed source needs retained Curve and Surface');
  const[left,right]=curveDomain(other),t=(left+right)/2,curveInput={modelId:model.name,curveId:other.id,t};
  const curve=viewer.measureNativeCurvePoints(curveInput,{...curveInput,t:left}),expectedCurve=evaluateCurve(other,t);
  const surfaceInput={modelId:model.name,surfaceId:surface.id,u:.5,v:.5},surfacePoint=viewer.measureNativeSurfacePoints(surfaceInput,{...surfaceInput,u:0,v:0});
  const expectedSurface=evaluateSurface(surface,.5,.5);check(near(curve.first.pointMM,expectedCurve)&&near(surfacePoint.first.pointMM,expectedSurface),'Retained CPU original native inspection differs');
  const mixed=viewer.measureNativeSurfaceCurvePoints(surfaceInput,curveInput);
  check(near(mixed.curve.pointMM,expectedCurve)&&near(mixed.surface.pointMM,expectedSurface),'Retained mixed native points differ');
  const value={kind:'retained CPU geometry only; not displayed',curve:{ref:curve.first.ref,pointMM:curve.first.pointMM,expected:expectedCurve},
    surface:{ref:surfacePoint.first.ref,pointMM:surfacePoint.first.pointMM,expected:expectedSurface},mixedDistanceMM:mixed.distanceMM,certification:mixed.certification};
  unshownOutput.textContent=JSON.stringify(value,null,2);return value;
}
function witness(input){const state=viewer.getState();check(same(state.selectedUniformCurve,input)&&state.uniformCurve===null&&state.curveSampleVersion===3,'Complete copied selected DTO/state differs');
  check(state.curves.length===1&&!state.surfaces.length&&input.model.objects.length===4,'Whole native/source capacity conflated with display inventory');
  const curve=input.model.objects.find(object=>object.kind==='curve'&&object.id===input.curveId),[left,right]=curveDomain(curve);
  for(let i=0;i<input.count;i++){const parameter=i===0?left:i===input.count-1?right:(1-i/(input.count-1))*left+i/(input.count-1)*right;
    check(Object.is(input.parameters[i],parameter)&&near(input.pointsMM[i],independentPoint(curve,parameter)),'Selected uniform parameter/original native observation differs');}
  const expected=input.pointsMM.flat().map(n=>Math.fround(n*mmToSceneUnit)),uploaded=uploads.find(value=>value.type==='Float32Array'&&near(value.values,expected,1e-7));
  check(uploaded&&uploaded.exactReadback&&uploaded.bytes===input.count*12,'Actual selected Curve one-scale GL upload differs');
  check(draws.some(draw=>draw.mode===[...contexts][0].LINE_STRIP&&draw.count===input.count),'Actual selected Line strip missing');
  const min=[0,1,2].map(axis=>Math.min(...input.pointsMM.map(point=>point[axis]))*mmToSceneUnit),max=[0,1,2].map(axis=>Math.max(...input.pointsMM.map(point=>point[axis]))*mmToSceneUnit),target=min.map((n,i)=>(n+max[i])/2);
  check(near(state.camera.target,target,1e-12),'Fit included far retained unshown native objects');return{curveId:input.curveId,count:input.count,uploadBytes:uploaded.bytes,expectedF32:expected,actualF32:uploaded.values,target};
}
function qualifiedHit(){const sample=viewer.getState().selectedUniformCurve,curve=sample.model.objects.find(object=>object.kind==='curve'&&object.id===sample.curveId);
  const identity=ref(),t=sample.parameters[Math.floor((sample.count-1)/2)],projection=viewer.projectNativePoint({...identity,t});check(projection,'Selected native projection offscreen');
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const xCss=projection.xCss+dx,yCss=projection.yCss+dy;
    if(xCss<0||yCss<0||xCss>canvas.getBoundingClientRect().width||yCss>canvas.getBoundingClientRect().height)continue;
    const hit=viewer.pickGeometry({xCss,yCss},{curveTolerancePx:4});if(hit?.kind==='curve'){
      check(hit.ref.curveId===sample.curveId&&hit.ref.modelId===sample.model.name&&near(hit.nativePointMM,evaluateCurve(curve,hit.parameterApprox)),'Approximate selected hit lost original native authority');return{xCss,yCss,hit};}}
  throw Error('No qualified selected Curve hit');
}
function retained(label,callback){const before=viewer.getState(),pixels=pixelInfo(),counts=resourceCounts();let error;
  try{callback();}catch(value){error=value;}check(error instanceof Error,label+' did not refuse');check(same(before,viewer.getState())&&same(pixels,pixelInfo())&&same(counts,resourceCounts()),label+' changed accepted state/pixels/resources');
  result?.refusals.push({label,error:error.message,type:error.name,code:error.code??null});return error;}
function capture(label){const state=viewer.getState(),row={label,curveId:state.selectedUniformCurve?.curveId??null,count:state.selectedUniformCurve?.count??null,
  objectCount:state.selectedUniformCurve?.model.objects.length??null,curves:state.curves,surfaces:state.surfaces,...pixelInfo(),resources:resourceCounts(),glErrors:glErrors()};
  check(row.glErrors.every(n=>n===0),label+' GL error');
  if(state.selectedUniformCurve?.curveId!=='signed_zero')check(row.nonBackgroundPixels>0,label+' produced no genuine selected line pixels');
  result.cases.push(row);return row;}
function failAllocation(type='Texture',at=1){faultType=type;faultAt=at;faultAttempts=0;faultConsumed=false;}
function clearAllocationFault(){const receipt={type:faultType,attempts:faultAttempts,consumed:faultConsumed};faultType=null;return receipt;}
async function runProof(){if(running||disposed||viewer.getState().status==='context-lost')throw Error('Proof needs a live Viewer');running=true;render();
  result={ok:false,schema:'barocss-viewer-selected-uniform-1090-basic',cases:[],refusals:[],failures:[],scope:'One displayed Curve from complete original mixed source; root adds complete old-mode/URL/loss gates'};window.__viewerSelectedUniformResult=result;
  try{result.fixtures=manifest;result.inputAudit=await(await fetch('/input-audit.json')).json();result.observations=[];
    for(const count of[129,33,2]){const input=load('mixed-quintic','primary_quintic',count);result.observations.push(witness(input));capture('primary-quintic-'+count);}
    const input=load('mixed-quintic','primary_quintic',129);const nativeSource=input.source,originalModel=input.model;result.native=query(2);result.unshown=unshownQueries();result.hit=qualifiedHit();const baseline=capture('full-source-one-selected');
    const identity=ref();viewer.selectGeometry(identity);capture('selected-highlight');viewer.selectGeometry(null);viewer.setVisibleGeometry([]);
    check(viewer.projectNativePoint({...identity,t:2})===null&&viewer.pickGeometry({xCss:20,yCss:20})===null,'Hidden selected Curve projected/picked');
    retained('hidden invalid domain',()=>viewer.projectNativePoint({...identity,t:99}));viewer.setVisibleGeometry([identity]);
    const other=originalModel.objects.find(object=>object.kind==='curve'&&object.id!==input.curveId),surface=originalModel.objects.find(object=>object.kind==='surface');
    retained('unshown Curve projection',()=>viewer.projectNativePoint({kind:'curve',modelId:originalModel.name,curveId:other.id,t:2}));
    retained('unshown Surface projection',()=>viewer.projectNativePoint({kind:'surface',modelId:originalModel.name,surfaceId:surface.id,u:.5,v:.5}));
    retained('unshown Curve selection',()=>viewer.selectGeometry({kind:'curve',modelId:originalModel.name,curveId:other.id}));
    const copy=viewer.getState().selectedUniformCurve;copy.model.objects[0].weights[0][0]=2;copy.pointsMM[0][0]=999;
    check(same(viewer.getState().selectedUniformCurve,input),'Full source/query copy exposed mutable authority');
    const caller=clone(input);viewer.loadSelectedUniformCurvePreview(caller,options);caller.model.objects[0].weights[0][0]=2;
    check(same(viewer.getState().selectedUniformCurve,input),'Caller changed retained unshown native data');
    const bad=mutate=>{const value=clone(input);mutate(value);return value;};
    retained('forged unselected native object',()=>viewer.loadSelectedUniformCurvePreview(bad(value=>value.model.objects[0].controlPoints[0][0][0]+=1),options));
    retained('source-selector mismatch',()=>viewer.loadSelectedUniformCurvePreview(bad(value=>value.curveId='weighted_right'),options));
    retained('DTO0 old single profile',()=>viewer.loadSelectedUniformCurvePreview(prepareUniformCurvePreview({source:sources['old-single'],count:2}),options));
    retained('wrong selected profile',()=>viewer.loadSelectedUniformCurvePreview(bad(value=>value.profile='native-uniform-curve-v0'),options));
    retained('count outside bounds',()=>viewer.loadSelectedUniformCurvePreview(bad(value=>value.count=130),options));
    let getterCalls=0;const getter=clone(input);Object.defineProperty(getter,'curveId',{enumerable:true,get(){getterCalls++;return input.curveId;}});
    retained('selected identity getter',()=>viewer.loadSelectedUniformCurvePreview(getter,options));check(getterCalls===0,'Caller getter invoked');
    uploads.length=0;failAllocation('Texture',1);try{retained('late texture after selected upload',()=>viewer.loadSelectedUniformCurvePreview(
      prepareSelectedUniformCurvePreview({source:sources['mixed-quintic'],curveId:'weighted_right',count:33}),options));}
    finally{result.allocation=clearAllocationFault();}check(result.allocation.consumed&&uploads.length>0,'Late allocation not consumed after selected upload');
    viewer.applyGeometryMotionFrame({contextId:'selected_pose',timeSeconds:0,poses:[{targetId:'curve',translation:[1,.5,0]}]},
      [{contextId:'selected_pose',targetId:'curve',ref:identity}],{basis:'part-xyz-matches-rhyup'});query(2);unshownQueries();viewer.resetMotion();
    viewer.orbit(.05,.03);viewer.pan(.01,0);viewer.zoom(1.02);viewer.fit();viewer.resize(480,360);viewer.resize(640,480);
    check(viewer.getState().selectedUniformCurve.source===nativeSource&&same(viewer.getState().selectedUniformCurve.model,originalModel),'Poses/camera changed full source');
    const right=load('mixed-quintic','weighted_right',33);result.observations.push(witness(right));result.rightNative=query();result.rightUnshown=unshownQueries();capture('weighted-right-from-same-source');
    check(same(right.model,originalModel)&&right.source===nativeSource,'Curve choice changed complete original source');
    const original=load('mixed-original','weighted_left',33);result.observations.push(witness(original));capture('original-weighted-left');
    viewer.loadUniformCurvePreview(prepareUniformCurvePreview({source:sources['old-single'],count:2}),options);
    check(viewer.getState().selectedUniformCurve===null&&viewer.getState().uniformCurve?.version===0&&viewer.getState().curveSampleVersion===2,'Legacy DTO0 compatibility changed');
    load('mixed-quintic','primary_quintic',129);viewer.clear();check(viewer.getState().selectedUniformCurve===null&&!viewer.getState().curves.length,'Clear retained selected source');load('mixed-quintic','primary_quintic',129);
    result.contextCount=contexts.size;result.resources=resourceCounts();result.glErrors=glErrors();result.errors=[...errors];result.warnings=[...warnings];result.getterCalls=getterCalls;
    check(contexts.size===1&&result.glErrors.every(n=>n===0)&&!errors.length&&!warnings.length,'Context/GL/browser gate failed');result.ok=true;
  }catch(error){result.error=error.stack||error.message;result.failures.push({error:result.error,completed:result.cases.length});result.resources=resourceCounts();result.errors=[...errors];}
  finally{running=false;render();window.__viewerSelectedUniformResult=result;display({ok:result.ok,cases:result.cases.length,refusals:result.refusals.length,error:result.error??null,resources:resourceCounts(),scope:result.scope});
    try{await fetch('/result',{method:'POST',body:JSON.stringify(result)});}catch(error){result.recordingError=error.message;}}return result;
}
function dispose(){if(disposed)return;viewer.dispose();viewer.dispose();disposed=true;render();const receipt={status:viewer.getState().status,resources:resourceCounts(),contextCount:contexts.size,
  glErrors:glErrors(),errors:[...errors],warnings:[...warnings]};if(result)result.disposal=receipt;display(receipt);return receipt;}
try{manifest=await(await fetch('/fixture-manifest.json')).json();for(const item of manifest){const bytes=await(await fetch(item.url)).arrayBuffer();
    check(bytes.byteLength===item.bytes&&await sha(bytes)===item.sha256,'Original mixed file bytes/hash changed');sources[item.name]=new TextDecoder().decode(bytes);fixtures[item.name]={...item,bytes:new Uint8Array(bytes)};
    const compiled=compileCadModel(sources[item.name],{sourceVersion:0});check(compiled.ok,'Original complete Model did not compile');models[item.name]=compiled.model;
    if(!item.compatibilityOnly){const option=document.createElement('option');option.value=item.name;option.textContent=item.name;sourceMenu.append(option);}}
  viewer=createViewer(canvas,{mmToSceneUnit,background:[.035,.065,.105]});populateCurves('mixed-quintic','primary_quintic');load('mixed-quintic','primary_quintic',129);
  lossExtension=[...contexts][0].getExtension('WEBGL_lose_context');
  window.__viewerSelectedUniformProof={viewer,createViewer,prepareSelectedUniformCurvePreview,validateSelectedUniformCurvePreview,prepareUniformCurvePreview,validateUniformCurvePreview,
    compileCadModel,evaluateCurve,evaluateSurface,curveDomain,parseBooleanExtrusionFeatureGraph,parseBaroCadAssembly,loadBaroCadAssembly,loadBaroCadModelSet,
    loadBaroCadDocument,parseBaroCadDocument,prepareBaroCadDocumentPrimitiveNativeRefsV2,createClothWorld,createPhysicsClothWorld:createClothWorld,
    PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer,sources,fixtures,manifest,models,options,mmToSceneUnit,canvas,
    load,ref,query,unshownQueries,qualifiedHit,independentPoint,witness,uniformWitness:witness,retained,capture,render,runProof,pixelInfo,resourceCounts,glErrors,uploads,draws,errors,warnings,
    lossExtension,dispose,failAllocation,failNextBuffer(at=1){failAllocation('Buffer',at);},clearAllocationFault,
    get gl(){return[...contexts][0];},get state(){return viewer.getState();},get currentSource(){return viewer.getState().selectedUniformCurve?.source??null;},get result(){return result;}};
  window.__viewerSelectedUniformProof.nativeSourcePanel=await(await fetch('/original-panel.barocad')).text();display('Ready: complete four-object mixed source, only primary_quintic displayed with129 observations.');
}catch(error){display({ok:false,stage:'startup',error:error.stack||error.message});}
sourceMenu.addEventListener('change',()=>populateCurves(sourceMenu.value));buttons.load.addEventListener('click',()=>action(()=>load(sourceMenu.value,curveMenu.value,Number(countMenu.value))));
buttons.query.addEventListener('click',()=>action(()=>query()));buttons['unshown-query'].addEventListener('click',()=>action(unshownQueries));buttons.select.addEventListener('click',()=>action(()=>viewer.selectGeometry(ref())));
visible.addEventListener('change',()=>action(()=>viewer.setVisibleGeometry(visible.checked?[ref()]:[])));buttons.fit.addEventListener('click',()=>action(()=>viewer.fit()));
buttons.orbit.addEventListener('click',()=>action(()=>viewer.orbit(.2,.05)));buttons.pan.addEventListener('click',()=>action(()=>viewer.pan(.01,0)));buttons.clear.addEventListener('click',()=>action(()=>viewer.clear()));
buttons['run-proof'].addEventListener('click',runProof);buttons.dispose.addEventListener('click',dispose);buttons['lose-context'].addEventListener('click',()=>lossExtension?.loseContext());
canvas.addEventListener('webglcontextlost',()=>{render();display('Context lost; whole copied native source remains available for CPU inspection.');});
canvas.addEventListener('click',event=>action(()=>{const rect=canvas.getBoundingClientRect(),hit=viewer.pickGeometry({xCss:event.clientX-rect.left,yCss:event.clientY-rect.top});viewer.selectGeometry(hit?{kind:hit.kind,...hit.ref}:null);}));
window.addEventListener('beforeunload',()=>{if(viewer)dispose();});
