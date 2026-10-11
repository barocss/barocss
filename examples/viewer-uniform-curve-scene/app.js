import {createViewer} from '@barocss/viewer';
import {prepareUniformCurvePreview,validateUniformCurvePreview,prepareSelectedUniformCurvePreview,
  PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer} from '@barocss/gpu';
import {compileCadModel,evaluateCurve,evaluateSurface,curveDomain,parseBooleanExtrusionFeatureGraph} from '@barocss/cad';
import {parseBaroCadAssembly,loadBaroCadAssembly} from '@barocss/cad-interop/assembly';
import {loadBaroCadModelSet} from '@barocss/cad-interop/model-set';
import {createClothWorld} from '@barocss/physics/cloth';

const check=(condition,message)=>{if(!condition)throw Error(message);},clone=value=>structuredClone(value);
const same=(a,b)=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length
  &&Object.keys(a).every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
const near=(a,b,tolerance=1e-12)=>a.length===b.length&&a.every((n,i)=>Math.abs(n-b[i])<=tolerance);
const hash=bytes=>bytes.reduce((n,byte)=>Math.imul(n^byte,16777619)>>>0,2166136261);
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const canvas=document.querySelector('#view'),status=document.querySelector('#status'),inspection=document.querySelector('#inspection');
const sectionButton=document.querySelector('#section-inspect'),sectionOutput=document.querySelector('#section-output');
const sourceMenu=document.querySelector('#source'),countMenu=document.querySelector('#count'),visible=document.querySelector('#visible');
const buttons=Object.fromEntries(['load','query','select','fit','orbit','pan','clear','run-proof','lose-context','dispose'].map(id=>[id,document.querySelector('#'+id)]));
const contexts=new Set(),resources={},peaks={},uploads=[],draws=[],errors=[],warnings=[];
let failBufferAt=0,bufferAttempts=0,lossExtension=null;
// Install global ownership/readback instrumentation before the first Viewer mount.
for(const type of ['Buffer','Program','VertexArray','Framebuffer','Texture','Renderbuffer','Shader']){
  const live=new Set(),p=WebGL2RenderingContext.prototype,create=p['create'+type],remove=p['delete'+type];resources[type]=live;peaks[type]=0;
  p['create'+type]=function(...args){if(type==='Buffer'&&failBufferAt&&++bufferAttempts===failBufferAt)return null;
    const value=create.apply(this,args);if(value){live.add(value);peaks[type]=Math.max(peaks[type],live.size);}return value;};
  p['delete'+type]=function(value){live.delete(value);return remove.call(this,value);};
}
const getContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(kind,...args){const value=getContext.call(this,kind,...args);if(kind==='webgl2'&&value)contexts.add(value);return value;};
const bufferData=WebGL2RenderingContext.prototype.bufferData;
WebGL2RenderingContext.prototype.bufferData=function(target,values,...args){const result=bufferData.call(this,target,values,...args);
  if(ArrayBuffer.isView(values)){const copied=new values.constructor(values.length);this.getBufferSubData(target,0,copied);
    uploads.push({type:values.constructor.name,values:Array.from(copied),bytes:values.byteLength,exactReadback:same(values,copied)});}return result;};
const drawArrays=WebGL2RenderingContext.prototype.drawArrays;
WebGL2RenderingContext.prototype.drawArrays=function(mode,first,count){draws.push({mode,first,count});return drawArrays.call(this,mode,first,count);};
window.addEventListener('error',event=>errors.push(event.message));window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const warn=console.warn;console.warn=(...args)=>{warnings.push(args.map(String).join(' '));warn.apply(console,args);};
const sources={},fixtures={};let manifest=[],viewer=null,currentName='primary_quintic',disposed=false,running=false,result=null;
let sectionInputs=null,sectionReport=null;
const options={basis:'authored-xyz-matches-rhyup'},mmToSceneUnit=.17;
const resourceCounts=()=>Object.fromEntries(Object.entries(resources).map(([key,live])=>[key,live.size]));
const glErrors=()=>[...contexts].map(gl=>gl.getError());
const pixelInfo=()=>({hash:hash(viewer.readPixels())});
const display=value=>status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
function ref(){const state=viewer.getState();check(state.uniformCurve,'Load a uniform Curve first.');return{kind:'curve',...state.curves[0]};}
function render(){const state=viewer.getState(),live=!disposed&&state.status!=='context-lost',ready=live&&state.status==='ready';
  for(const[id,button]of Object.entries(buttons))button.disabled=id==='dispose'?disposed:!live||running;
  buttons.query.disabled=!live||running||!state.uniformCurve;buttons.select.disabled=!ready||running||state.visibleGeometry.length===0;
  buttons.fit.disabled=!ready||running||state.visibleGeometry.length===0;
  sourceMenu.disabled=!live||running;countMenu.disabled=!live||running;visible.disabled=!ready||running;
  visible.checked=state.visibleGeometry.length>0;
  const acceptedName=manifest.find(item=>sources[item.name]===state.uniformCurve?.source)?.name;
  sourceMenu.value=acceptedName??'';
  if(acceptedName)currentName=acceptedName;
  if(state.uniformCurve)countMenu.value=String(state.uniformCurve.count);
  const currentSection=!!sources.degree4_section&&state.uniformCurve?.source===sources.degree4_section;
  sectionButton.disabled=!live||running||!currentSection;
  if(!currentSection){sectionReport=null;sectionOutput.textContent='';}
}
function load(name=currentName,count=Number(countMenu.value)){
  const input=prepareUniformCurvePreview({source:sources[name],count});uploads.length=0;draws.length=0;
  viewer.loadUniformCurvePreview(input,clone(options));currentName=name;sourceMenu.value=name;countMenu.value=String(count);render();return input;
}
function action(callback){if(disposed)return;try{callback();render();}catch(error){display(error.message);}}
function independentPoint(curve,parameter){const[left,right]=curveDomain(curve),x=(parameter-left)/(right-left);
  let degree,choose;
  if(curve.degree===4){check(curve.id==='poly_world'&&curve.controlPoints.length===5
      &&curve.weights.every(n=>n===24000)&&left===0&&right===1,'Fixture requires original degree4 section/equal24000 weights');
    degree=4;choose=[1,4,6,4,1];
  }else{check(curve.degree===5&&curve.controlPoints.length===6&&curve.weights.every(n=>n===1),'Fixture requires original polynomial quintic');
    degree=5;choose=[1,5,10,10,5,1];}
  return[0,1,2].map(axis=>curve.controlPoints.reduce((sum,point,i)=>sum+point[axis]*choose[i]*(1-x)**(degree-i)*x**i,0));}
function query(parameter){const state=viewer.getState(),curve=state.uniformCurve?.model.objects[0];check(curve,'Load a uniform Curve first.');
  const[left,right]=curveDomain(curve),t=parameter??(left+right)/2,identity=ref();
  const measured=viewer.measureNativeCurvePoints({modelId:identity.modelId,curveId:identity.curveId,t},
    {modelId:identity.modelId,curveId:identity.curveId,t:left});
  const expected=independentPoint(curve,t);check(near(measured.first.pointMM,expected),'Original native interior point differs from independent Bernstein evaluation');
  const point={parameter:t,domain:[left,right],originalNativePointMM:measured.first.pointMM,expected,sourceName:currentName,
    profile:state.uniformCurve.profile,observations:state.uniformCurve.count,certification:measured.certification};inspection.textContent=JSON.stringify(point,null,2);return point;
}
async function inspectSection(){
  check(!disposed,'Section inspection requires a live Viewer.');
  const before=viewer.getState();
  check(!!sources.degree4_section&&before.uniformCurve?.source===sources.degree4_section,
    'Load the original degree4 section source before inspecting its separate UV data.');
  let inputs=sectionInputs?clone(sectionInputs):null;
  if(!inputs){
    const files=await Promise.all(['/section-request.json','/section-surface-uv.json','/section-plane-uv.json'].map(async url=>{
      const response=await fetch(url);check(response.ok,'Section input unavailable: '+url);return response.json();}));
    inputs={request:files[0],surfaceUV:files[1],planeUV:files[2]};
  }
  const request=inputs.request;
  const parent=compileCadModel(request.surfaceAsset.source,{sourceVersion:0});
  const planeParent=compileCadModel(request.planeAsset.source,{sourceVersion:0});
  check(parent.ok&&planeParent.ok,'Original section parent Source0 did not compile.');
  check(parent.model.objects.length===3&&planeParent.model.objects.length===1,
    'Section inspection requires complete original three-object parent and one-object Plane models.');
  const surface=parent.model.objects.find(object=>object.kind==='surface'&&object.id===request.surfaceAsset.surface.id);
  const plane=planeParent.model.objects.find(object=>object.kind==='surface'&&object.id===request.planeAsset.surface.id);
  check(surface&&plane&&same(surface,request.surfaceAsset.surface)&&same(plane,request.planeAsset.surface),
    'Original compiled parent coefficients differ from the authored request bits.');
  for(const[sidecar,coordinateSystem,degree,id]of[
    [inputs.surfaceUV,'native-surface-uv',3,request.options.surfacePcurveId],
    [inputs.planeUV,'native-plane-uv',4,request.options.planePcurveId]]){
    const curve=sidecar.curve;
    check(sidecar.coordinateSystem===coordinateSystem&&sidecar.lengthUnit==='dimensionless'
      &&curve.kind==='curve'&&curve.id===id&&curve.degree===degree
      &&curve.controlPoints.length===degree+1&&curve.controlPoints.every(point=>point.length===3&&point[2]===0)
      &&curve.weights.length===degree+1&&curve.weights.every(weight=>Number.isFinite(weight)&&weight>0)
      &&near(curveDomain(curve),[0,1]),'Section UV must retain original degree/domain and dimensionless zero-Z data.');
  }
  const state=viewer.getState();
  check(state.uniformCurve?.source===sources.degree4_section,'The accepted source changed during section input loading.');
  const world=state.uniformCurve,curve=world.model.objects[0],identity={modelId:state.curves[0].modelId,curveId:state.curves[0].curveId};
  check(world.model.name==='profile'&&curve.kind==='curve'&&curve.id===request.options.curveId
    &&curve.degree===4&&curve.controlPoints.length===5&&curve.weights.every(weight=>weight===24000)
    &&near(curveDomain(curve),[0,1]),'Accepted world source differs from the original degree4 section.');
  const candidates=[0,.25,.5,.75,1].map(t=>{
    const worldPointMM=evaluateCurve(curve,t),surfacePointUV=evaluateCurve(inputs.surfaceUV.curve,t),planePointUV=evaluateCurve(inputs.planeUV.curve,t);
    check(surfacePointUV[2]===0&&planePointUV[2]===0,'Dimensionless UV evaluation has a nonzero Z component.');
    const surfaceUV=surfacePointUV.slice(0,2),planeUV=planePointUV.slice(0,2);
    const surfacePointMM=evaluateSurface(surface,...surfaceUV),planePointMM=evaluateSurface(plane,...planeUV);
    const surfaceResidualMM=Math.hypot(...worldPointMM.map((value,index)=>value-surfacePointMM[index]));
    const planeResidualMM=Math.hypot(...worldPointMM.map((value,index)=>value-planePointMM[index]));
    check(Number.isFinite(surfaceResidualMM)&&Number.isFinite(planeResidualMM)
      &&surfaceResidualMM<=1e-7&&planeResidualMM<=1e-7,'A local original-parent residual exceeds1e-7mm.');
    return{t,worldPointMM,surfaceUV,planeUV,surfacePointMM,planePointMM,surfaceResidualMM,planeResidualMM};
  });
  const observations=candidates.map(row=>{
    const measured=viewer.measureNativeCurvePoints({...identity,t:row.t},{...identity,t:0});
    check(near(measured.first.pointMM,row.worldPointMM),'Viewer native world query differs from original Curve evaluation.');
    return{...row,nativeQueryPointMM:measured.first.pointMM,nativeDistanceFromStartMM:measured.distanceMM};
  });
  const report={source:world.source,sourceName:'degree4_section',worldUnit:'mm',uvUnit:'dimensionless',
    scope:'Five local original-parent observations; no global section or evaluator certificate.',observations,
    parentSource:request.surfaceAsset.source,planeSource:request.planeAsset.source,
    parentModel:parent.model,planeModel:planeParent.model};
  sectionInputs=clone(inputs);sectionReport=clone(report);
  sectionOutput.textContent=JSON.stringify({worldUnit:report.worldUnit,uvUnit:report.uvUnit,scope:report.scope,observations},null,2);
  render();display('Inspected five native world mm points and two separate unscaled dimensionless UV curves.');
  return clone(report);
}
function retained(label,callback){const before=viewer.getState(),pixels=pixelInfo(),counts=resourceCounts();let error;
  try{callback();}catch(value){error=value;}check(error instanceof Error,label+' did not refuse');
  check(same(before,viewer.getState())&&same(pixels,pixelInfo())&&same(counts,resourceCounts()),label+' changed accepted state/pixels/resources');
  result?.refusals.push({label,error:error.message,type:error.name,code:error.code??null});return error;
}
function capture(label){const state=viewer.getState(),row={label,sourceName:currentName,count:state.uniformCurve?.count??null,
  curveSampleVersion:state.curveSampleVersion,curves:state.curves,...pixelInfo(),resources:resourceCounts(),glErrors:glErrors()};
  check(row.glErrors.every(n=>n===0),label+' GL error');result.cases.push(row);return row;}
function uniformWitness(input){check(same(input,viewer.getState().uniformCurve),'Copied original uniform DTO differs');const curve=input.model.objects[0],[left,right]=curveDomain(curve);
  for(let i=0;i<input.count;i++){const expected=i===0?left:i===input.count-1?right:(1-i/(input.count-1))*left+i/(input.count-1)*right;
    check(Object.is(input.parameters[i],expected),'Original uniform parameter formula/endpoint differs');
    check(near(input.pointsMM[i],independentPoint(curve,expected)),'Original observed native point differs');}
  const expected=input.pointsMM.flat().map(n=>Math.fround(n*mmToSceneUnit));
  check(uploads.some(upload=>upload.type==='Float32Array'&&near(upload.values,expected,1e-7)&&upload.exactReadback),'Actual GL observed positions/unit lowering differs');
  return{source:input.source,model:input.model,parameters:input.parameters,pointsMM:input.pointsMM,expectedF32:expected,
    actualUploads:uploads.map(upload=>({type:upload.type,bytes:upload.bytes,values:upload.values,exactReadback:upload.exactReadback}))};}
function qualifiedHit(){const state=viewer.getState(),sample=state.uniformCurve,identity=ref();
  const middle=Math.floor((sample.count-1)/2),projection=viewer.projectNativePoint({...identity,t:sample.parameters[middle]});
  check(projection,'Original projected point is offscreen');
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const xCss=projection.xCss+dx,yCss=projection.yCss+dy;
    if(xCss<0||yCss<0||xCss>canvas.getBoundingClientRect().width||yCss>canvas.getBoundingClientRect().height)continue;
    const hit=viewer.pickGeometry({xCss,yCss},{curveTolerancePx:4});if(hit?.kind==='curve'){
      const native=evaluateCurve(sample.model.objects[0],hit.parameterApprox);check(near(hit.nativePointMM,native),'Approximate hit native point used sample interpolation');
      check(hit.ref.modelId===identity.modelId&&hit.ref.curveId===identity.curveId,'Qualified hit identity differs');return{xCss,yCss,hit};}}
  throw Error('No qualified uniform Curve hit near independent native projection');
}
async function runProof(){if(running||disposed||viewer.getState().status==='context-lost')throw Error('Proof needs a live Viewer');running=true;render();
  result={ok:false,schema:'barocss-viewer-uniform-curve-1056-basic',cases:[],refusals:[],failures:[],scope:'Original single-Curve DTO0 consumer; root acceptance owns full transitions/URL/loss'};window.__viewerUniformResult=result;
  try{result.fixtures=manifest.map(row=>({...row}));result.inputAudit=await(await fetch('/input-audit.json')).json();result.observations=[];
    for(const count of[129,33,2]){const input=load('primary_quintic',count);result.observations.push(uniformWitness(input));capture('original-'+count);}
    load('primary_quintic',129);const native=query(2),originalCamera=viewer.getState().camera,original=capture('original-unselected');
    result.nativeInterior=native;result.hit=qualifiedHit();const identity=ref();viewer.selectGeometry(identity);capture('selected');viewer.selectGeometry(null);
    const beforeSource=viewer.getState().uniformCurve;
    viewer.applyGeometryMotionFrame({contextId:'uniform_pose',timeSeconds:0,poses:[{targetId:'curve',translation:[1,.5,0]}]},
      [{contextId:'uniform_pose',targetId:'curve',ref:identity}],{basis:'part-xyz-matches-rhyup'});
    check(same(beforeSource,viewer.getState().uniformCurve),'Display pose changed original uniform source');
    query(2);viewer.resetMotion();viewer.setView(originalCamera);
    viewer.setVisibleGeometry([]);check(viewer.projectNativePoint({...identity,t:2})===null&&viewer.pickGeometry({xCss:20,yCss:20})===null,'Hidden Curve remained projected/pickable');
    viewer.setVisibleGeometry([identity]);viewer.orbit(.05,.03);viewer.pan(.01,0);viewer.zoom(1.02);viewer.fitGeometry(identity);viewer.fit();
    viewer.resize(480,360);viewer.resize(640,480);viewer.setView(originalCamera);
    check(same(beforeSource,viewer.getState().uniformCurve),'Camera/visibility changed original uniform DTO');
    load('endpoint_jet_edit',129);viewer.setView(originalCamera);const edited=capture('original-endpoint-edit');check(edited.hash!==original.hash,'Original endpoint edit changed no actual pixels');
    load('signed_zero',33);const zero=viewer.getState().uniformCurve;check(Object.is(zero.parameters[0],-0)&&Object.is(zero.model.objects[0].knots[0],-0),'Original signed-zero domain changed');capture('constant-signed-zero');
    const input=load('primary_quintic',33),bad=mutate=>{const value=clone(input);mutate(value);return value;};
    const copied=viewer.getState().uniformCurve;copied.pointsMM[0][0]=999;copied.model.objects[0].controlPoints[0][0]=999;
    check(same(input,viewer.getState().uniformCurve),'getState exposed mutable DTO/model');
    const caller=clone(input);viewer.loadUniformCurvePreview(caller,options);caller.pointsMM[0][0]=999;
    check(same(input,viewer.getState().uniformCurve),'Caller DTO mutation reached accepted state');
    retained('DTO1 version',()=>viewer.loadUniformCurvePreview(prepareSelectedUniformCurvePreview({source:sources.primary_quintic,curveId:'primary_quintic',count:33}),options));
    retained('wrong profile',()=>viewer.loadUniformCurvePreview(bad(value=>value.profile='adaptive'),options));
    retained('derived point mutation',()=>viewer.loadUniformCurvePreview(bad(value=>value.pointsMM[10][0]+=.01),options));
    retained('source/model mismatch',()=>viewer.loadUniformCurvePreview(bad(value=>value.source=sources.endpoint_jet_edit),options));
    retained('unknown basis',()=>viewer.loadUniformCurvePreview(input,{basis:'automatic'}));
    retained('unknown options field',()=>viewer.loadUniformCurvePreview(input,{...options,extra:true}));
    let getterCalls=0;const accessor=clone(input);Object.defineProperty(accessor,'source',{enumerable:true,get(){getterCalls++;return input.source;}});
    retained('source accessor',()=>viewer.loadUniformCurvePreview(accessor,options));check(getterCalls===0,'Caller getter invoked');
    failBufferAt=1;bufferAttempts=0;try{retained('actual candidate buffer allocation',()=>viewer.loadUniformCurvePreview(prepareUniformCurvePreview({source:sources.endpoint_jet_edit,count:129}),options));}finally{failBufferAt=0;}
    check(bufferAttempts===1,'Injected buffer failure not reached');
    const legacyAssembly=parseBaroCadAssembly(await(await fetch('/assembly-revision0.json')).text());
    const legacySource=legacyAssembly.assembly.parts[0].assets[0].source;
    for(const version of[0,1]){viewer.loadNative(legacySource,{sourceVersion:0,countU:3,countV:3,
      curveDisplay:{...(version?{version:1}:{}),chordToleranceMM:.01,maxSegments:128,maxDepth:12}});
      check(viewer.getState().uniformCurve===null&&viewer.getState().curveSampleVersion===version,'Existing adaptive native generation changed');capture('legacy-adaptive-'+version);}
    const source=await(await fetch('/original-panel.barocad')).text();viewer.loadNative(source,{sourceVersion:0,countU:3,countV:3});
    check(viewer.getState().uniformCurve===null&&viewer.getState().surfaces.length===1,'Native Surface generation did not clear uniform mode');
    load('primary_quintic',129);viewer.clear();check(viewer.getState().uniformCurve===null&&viewer.getState().curves.length===0,'Clear retained uniform source');load('primary_quintic',129);
    result.getterCalls=getterCalls;result.contextCount=contexts.size;result.resources=resourceCounts();result.peaks={...peaks};result.glErrors=glErrors();result.errors=[...errors];result.warnings=[...warnings];
    check(contexts.size===1&&result.glErrors.every(n=>n===0)&&!errors.length&&!warnings.length,'Context/GL/browser gate failed');result.ok=true;
  }catch(error){result.error=error.stack||error.message;result.failures.push({error:result.error,completed:result.cases.length});result.resources=resourceCounts();result.errors=[...errors];}
  finally{running=false;render();display({ok:result.ok,cases:result.cases.length,refusals:result.refusals.length,
    error:result.error??null,contextCount:result.contextCount??null,glErrors:result.glErrors??null});
    window.__viewerUniformResult=result;try{await fetch('/result',{method:'POST',body:JSON.stringify(result)});}catch(error){result.recordingError=error.message;}}
  return result;
}
function dispose(){if(disposed)return;viewer.dispose();viewer.dispose();disposed=true;render();const receipt={status:viewer.getState().status,
  resources:resourceCounts(),contextCount:contexts.size,glErrors:glErrors(),errors:[...errors],warnings:[...warnings]};if(result)result.disposal=receipt;display(receipt);return receipt;}
try{manifest=await(await fetch('/fixture-manifest.json')).json();for(const item of manifest){const bytes=await(await fetch(item.url)).arrayBuffer();
    check(bytes.byteLength===item.bytes&&await sha(bytes)===item.sha256,'Original committed source bytes/hash changed');sources[item.name]=new TextDecoder().decode(bytes);
    fixtures[item.name]={...item,bytes:new Uint8Array(bytes)};const option=document.createElement('option');option.value=item.name;option.textContent=item.name;sourceMenu.append(option);}
  viewer=createViewer(canvas,{mmToSceneUnit,background:[.035,.065,.105]});load('primary_quintic',129);
  lossExtension=[...contexts][0].getExtension('WEBGL_lose_context');
  window.__viewerUniformProof={viewer,createViewer,prepareUniformCurvePreview,validateUniformCurvePreview,prepareSelectedUniformCurvePreview,
    compileCadModel,evaluateCurve,evaluateSurface,curveDomain,parseBooleanExtrusionFeatureGraph,parseBaroCadAssembly,loadBaroCadAssembly,loadBaroCadModelSet,
    createClothWorld,createPhysicsClothWorld:createClothWorld,PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer,sources,fixtures,manifest,options,mmToSceneUnit,canvas,
    get currentSource(){return viewer.getState().uniformCurve?.source??null;},get sourceName(){return currentName;},get gl(){return[...contexts][0];},get state(){return viewer.getState();},
    inspectSection,get sectionInputs(){return sectionInputs?clone(sectionInputs):null;},get sectionReport(){return sectionReport?clone(sectionReport):null;},
    load,ref,query,independentPoint,uniformWitness,qualifiedHit,runProof,retained,capture,render,pixelInfo,resourceCounts,glErrors,uploads,draws,errors,warnings,dispose,
    get result(){return result;},lossExtension,failNextBuffer(at=1){failBufferAt=at;bufferAttempts=0;},clearAllocationFault(){failBufferAt=0;return bufferAttempts;}};
  window.__viewerUniformProof.nativeSourcePanel=await(await fetch('/original-panel.barocad')).text();
  display('Ready: original primary quintic,129 uniform observations. Native point queries remain original.');
}catch(error){display({ok:false,stage:'startup',error:error.stack||error.message});}
buttons.load.addEventListener('click',()=>action(()=>load(sourceMenu.value,Number(countMenu.value))));buttons.query.addEventListener('click',()=>action(()=>query()));
buttons.select.addEventListener('click',()=>action(()=>viewer.selectGeometry(ref())));visible.addEventListener('change',()=>action(()=>viewer.setVisibleGeometry(visible.checked?[ref()]:[])));
buttons.fit.addEventListener('click',()=>action(()=>viewer.fit()));buttons.orbit.addEventListener('click',()=>action(()=>viewer.orbit(.2,.05)));buttons.pan.addEventListener('click',()=>action(()=>viewer.pan(.01,0)));
buttons.clear.addEventListener('click',()=>action(()=>viewer.clear()));buttons['run-proof'].addEventListener('click',runProof);buttons.dispose.addEventListener('click',dispose);
sectionButton.addEventListener('click',async()=>{try{await inspectSection();}catch(error){display('Section inspection refused: '+error.message);}finally{render();}});
buttons['lose-context'].addEventListener('click',()=>lossExtension?.loseContext());canvas.addEventListener('webglcontextlost',()=>{render();display('Context lost; original copied source remains readable.');});
canvas.addEventListener('click',event=>action(()=>{const rect=canvas.getBoundingClientRect(),hit=viewer.pickGeometry({xCss:event.clientX-rect.left,yCss:event.clientY-rect.top});
  viewer.selectGeometry(hit?{kind:hit.kind,...hit.ref}:null);}));window.addEventListener('beforeunload',()=>{if(viewer)dispose();});
