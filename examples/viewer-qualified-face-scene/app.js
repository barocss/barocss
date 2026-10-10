import {createViewer} from '@barocss/viewer';
import {prepareQualifiedFaceScene,QualifiedFaceSceneRenderer,MixedDepthRenderer,prepareMixedDepthFrame,compileGpu,prepareCamera,
  prepareUniformCurvePreview,prepareSelectedUniformCurvePreview,PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer} from '@barocss/gpu';
import {compileCadModel,validateFaceBundle,tessellateSurface,evaluateSurface,evaluateCurve,curveDomain,parseBooleanExtrusionFeatureGraph,
  createCadDocument,createCadGeometryReference,queryCadDocumentSurfaceArea,validateCadDocumentSurfaceArea,
  queryCadDocumentCurveArcLength,validateCadDocumentCurveArcLength,evaluateCurveCurvature,evaluateCurveD2,evaluateSurfaceCurvature,evaluateSurfaceD2} from '@barocss/cad';
import {AREA_OPTIONS,areaPin,queryQualifiedFaceSurfaceArea} from './surface-area.js';
import {LENGTH_OPTIONS,lengthPin,queryQualifiedFaceCurveLength} from './curve-length.js';
import {queryQualifiedFaceAngle} from './native-angle.js';
import {curvaturePin,queryQualifiedFaceCurveCurvature} from './curve-curvature.js';
import {surfaceCurvaturePin,queryQualifiedFaceSurfaceCurvature} from './surface-curvature.js';
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
const pointLabels=[1,2].map(index=>document.querySelector('#measurement-point-'+index)),distanceLabel=document.querySelector('#measurement-distance');
const areaSource=document.querySelector('#area-source'),inspectAreaButton=document.querySelector('#inspect-area'),areaOutput=document.querySelector('#area-output');
const areaLabel=document.querySelector('#surface-area-label'),areaFormat=new Intl.NumberFormat('en',{maximumFractionDigits:6});
const lengthSource=document.querySelector('#length-source'),lengthCurve=document.querySelector('#length-curve'),inspectLengthButton=document.querySelector('#inspect-length');
const lengthOutput=document.querySelector('#length-output'),lengthLabel=document.querySelector('#curve-length-label');
const angleButton=document.querySelector('#measure-angle'),angleOutput=document.querySelector('#angle-output'),angleLabel=document.querySelector('#native-angle-label');
const curvatureSource=document.querySelector('#curvature-source'),curvatureCurve=document.querySelector('#curvature-curve'),curvatureT=document.querySelector('#curvature-t');
const inspectCurvatureButton=document.querySelector('#inspect-curvature'),curvatureOutput=document.querySelector('#curvature-output'),curvatureLabel=document.querySelector('#curve-curvature-label');
const surfaceCurvatureSource=document.querySelector('#surface-curvature-source'),surfaceCurvatureU=document.querySelector('#surface-curvature-u'),surfaceCurvatureV=document.querySelector('#surface-curvature-v');
const inspectSurfaceCurvatureButton=document.querySelector('#inspect-surface-curvature'),surfaceCurvatureOutput=document.querySelector('#surface-curvature-output'),surfaceCurvatureLabel=document.querySelector('#surface-curvature-label');
const angleControls=['first','vertex','third'].map(point=>({side:'angle-'+point,
  source:document.querySelector('#angle-'+point+'-source'),geometry:document.querySelector('#angle-'+point+'-geometry'),
  u:document.querySelector('#angle-'+point+'-u'),v:document.querySelector('#angle-'+point+'-v'),t:document.querySelector('#angle-'+point+'-t')}));
const distanceFormat=new Intl.NumberFormat('en',{maximumFractionDigits:4});
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
let labelPins=null,currentProjections=[null,null],labelResizeObserver=null;
let areaReport=null,areaProjection=null;
let lengthReport=null,lengthProjection=null;
let angleReport=null,angleProjection=null;
let curvatureReport=null,curvatureProjection=null;
let surfaceCurvatureReport=null,surfaceCurvatureProjection=null;
const colors=[[.9,.3,.2],[.25,.8,.4],[.25,.45,.95],[.95,.7,.2],[.3,.8,.9],[.85,.35,.75]];
const camera={eye:[2,1.5,3.2],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:10},mmToSceneUnit=.12,background=[.02,.03,.04],translateScene=[-.6,-.6,-.7];
const resourceCounts=()=>Object.fromEntries(Object.entries(resources).map(([key,live])=>[key,live.size]));
const glErrors=()=>[...contexts].map(gl=>gl.getError());
const pixelInfo=()=>({hash:hash(viewer.readPixels())});
const display=value=>status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
function clearInspection(){inspectionReport=null;inspection.textContent='';}
function clearSurfaceCurvature(){surfaceCurvatureReport=null;surfaceCurvatureProjection=null;surfaceCurvatureOutput.textContent='';surfaceCurvatureLabel.hidden=true;}
function surfaceCurvatureScopeChanged(scene){if(!surfaceCurvatureReport)return false;const pin=surfaceCurvatureReport.pin,asset=scene?.assets.find(value=>value.sourceId===pin.sourceId);
  return !asset||asset.source!==pin.expectedSource||asset.face.topology.face.id!==pin.faceId||asset.face.geometry.name!==pin.modelId
    ||asset.face.topology.face.surfaceId!==pin.surfaceId||!asset.face.geometry.objects.some(object=>object.id===pin.surfaceId&&object.kind==='surface');}
function signedCurvature(value){return value>0?'+'+areaNumber(value):Object.is(value,-0)?'-0':areaNumber(value);}
function updateSurfaceCurvatureLabel(){if(!viewer||disposed||!surfaceCurvatureReport){surfaceCurvatureProjection=null;surfaceCurvatureLabel.hidden=true;return;}
  const state=viewer.getState();if(surfaceCurvatureScopeChanged(state.qualifiedFaceScene)){clearSurfaceCurvature();return;}
  if(state.status!=='ready'){surfaceCurvatureProjection=null;surfaceCurvatureLabel.hidden=true;return;}
  try{surfaceCurvatureProjection=viewer.projectQualifiedFacePoint(surfaceCurvatureReport.anchor);}catch{surfaceCurvatureProjection=null;}
  surfaceCurvatureLabel.hidden=!surfaceCurvatureProjection;if(!surfaceCurvatureProjection)return;
  surfaceCurvatureLabel.textContent=surfaceCurvatureReport.pin.sourceId+'/'+surfaceCurvatureReport.pin.surfaceId+' · H '
    +signedCurvature(surfaceCurvatureReport.curvature.meanCurvaturePerMM)+' 1/mm';
  surfaceCurvatureLabel.style.left=surfaceCurvatureProjection.xCss+'px';surfaceCurvatureLabel.style.top=surfaceCurvatureProjection.yCss+'px';
}
function renderSurfaceCurvatureControls(scene){const previous=surfaceCurvatureSource.value;
  surfaceCurvatureSource.replaceChildren(...(scene?.assets??[]).map(asset=>{const option=document.createElement('option');option.value=asset.sourceId;option.textContent=asset.sourceId;return option;}));
  if(scene?.assets.some(asset=>asset.sourceId===previous))surfaceCurvatureSource.value=previous;
  else if(scene?.assets.some(asset=>asset.sourceId==='F'))surfaceCurvatureSource.value='F';
  const enabled=!disposed&&!running&&!!scene;
  for(const control of[surfaceCurvatureSource,surfaceCurvatureU,surfaceCurvatureV,inspectSurfaceCurvatureButton])control.disabled=!enabled;
}
function surfaceCurvatureParameter(input,name){const text=input.value.trim(),value=Number(text);
  check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)&&Number.isFinite(value),'Surface curvature '+name+' must be a complete finite decimal.');return value;}
function inspectSurfaceCurvature(pin=surfaceCurvaturePin(viewer.getState().qualifiedFaceScene,surfaceCurvatureSource.value,
  surfaceCurvatureParameter(surfaceCurvatureU,'u'),surfaceCurvatureParameter(surfaceCurvatureV,'v'))){
  const next=queryQualifiedFaceSurfaceCurvature(viewer.getState().qualifiedFaceScene,pin);surfaceCurvatureReport=clone(next);const curvature=next.curvature;
  surfaceCurvatureOutput.textContent=next.pin.sourceId+'/'+next.pin.surfaceId+' · u '+areaNumber(next.pin.u)+', v '+areaNumber(next.pin.v)
    +' · H '+signedCurvature(curvature.meanCurvaturePerMM)+' 1/mm · K '+signedCurvature(curvature.gaussianCurvaturePerMM2)+' 1/mm²'
    +' · k1 '+signedCurvature(curvature.principalCurvaturesPerMM[0])+', k2 '+signedCurvature(curvature.principalCurvaturesPerMM[1])+' 1/mm';
  updateSurfaceCurvatureLabel();display('Original Surface curvature ready for '+next.pin.sourceId+'/'+next.pin.surfaceId+'.');return clone(next);
}
function surfaceCurvatureSnapshot(){return{sourceId:surfaceCurvatureSource.value,u:surfaceCurvatureU.value,v:surfaceCurvatureV.value,enabled:!inspectSurfaceCurvatureButton.disabled,
  output:surfaceCurvatureOutput.textContent,report:clone(surfaceCurvatureReport),projection:clone(surfaceCurvatureProjection),label:{visible:!surfaceCurvatureLabel.hidden,
    text:surfaceCurvatureLabel.hidden?null:surfaceCurvatureLabel.textContent,xCss:surfaceCurvatureLabel.hidden?null:Number.parseFloat(surfaceCurvatureLabel.style.left),yCss:surfaceCurvatureLabel.hidden?null:Number.parseFloat(surfaceCurvatureLabel.style.top)}};}
function clearCurvature(){curvatureReport=null;curvatureProjection=null;curvatureOutput.textContent='';curvatureLabel.hidden=true;}
function curvatureScopeChanged(scene){if(!curvatureReport)return false;const pin=curvatureReport.pin,asset=scene?.assets.find(value=>value.sourceId===pin.sourceId);
  return !asset||asset.source!==pin.expectedSource||asset.face.topology.face.id!==pin.faceId||asset.face.geometry.name!==pin.modelId
    ||!asset.face.geometry.objects.some(object=>object.id===pin.curveId&&object.kind==='curve');}
function updateCurvatureLabel(){if(!viewer||disposed||!curvatureReport){curvatureProjection=null;curvatureLabel.hidden=true;return;}
  const state=viewer.getState();if(curvatureScopeChanged(state.qualifiedFaceScene)){clearCurvature();return;}
  if(state.status!=='ready'){curvatureProjection=null;curvatureLabel.hidden=true;return;}
  try{curvatureProjection=viewer.projectQualifiedFacePoint(curvatureReport.anchor);}catch{curvatureProjection=null;}
  curvatureLabel.hidden=!curvatureProjection;if(!curvatureProjection)return;
  const radius=curvatureReport.curvature.radiusMM;
  curvatureLabel.textContent=curvatureReport.pin.sourceId+'/'+curvatureReport.pin.curveId+' · '
    +(radius===null?'straight · no finite radius':'radius '+distanceFormat.format(radius)+' mm');
  curvatureLabel.style.left=curvatureProjection.xCss+'px';curvatureLabel.style.top=curvatureProjection.yCss+'px';
}
function renderCurvatureControls(scene){const previousSource=curvatureSource.value,previousCurve=curvatureCurve.value;
  curvatureSource.replaceChildren(...(scene?.assets??[]).map(asset=>{const option=document.createElement('option');option.value=asset.sourceId;option.textContent=asset.sourceId;return option;}));
  if(scene?.assets.some(asset=>asset.sourceId===previousSource))curvatureSource.value=previousSource;
  else if(scene?.assets.some(asset=>asset.sourceId==='F'))curvatureSource.value='F';
  const asset=scene?.assets.find(value=>value.sourceId===curvatureSource.value);
  curvatureCurve.replaceChildren(...(asset?.face.geometry.objects??[]).filter(object=>object.kind==='curve').map(curve=>{
    const option=document.createElement('option');option.value=curve.id;option.textContent=curve.id;return option;}));
  if([...curvatureCurve.options].some(option=>option.value===previousCurve))curvatureCurve.value=previousCurve;
  else if([...curvatureCurve.options].some(option=>option.value==='c2'))curvatureCurve.value='c2';
  const enabled=!disposed&&!running&&!!scene&&curvatureCurve.options.length>0;
  for(const control of[curvatureSource,curvatureCurve,curvatureT,inspectCurvatureButton])control.disabled=!enabled;
}
function curvatureParameter(){const text=curvatureT.value.trim(),value=Number(text);
  check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)&&Number.isFinite(value),'Curvature t must be a complete finite decimal.');return value;}
function inspectCurvature(pin=curvaturePin(viewer.getState().qualifiedFaceScene,curvatureSource.value,curvatureCurve.value,curvatureParameter())){
  const next=queryQualifiedFaceCurveCurvature(viewer.getState().qualifiedFaceScene,pin);curvatureReport=clone(next);
  const curvature=next.curvature;
  curvatureOutput.textContent=next.pin.sourceId+'/'+next.pin.curveId+' · t '+areaNumber(next.pin.t)+' · '
    +(curvature.radiusMM===null?'regular straight point · no finite radius · curvature 0 1/mm'
      :'local radius '+areaNumber(curvature.radiusMM)+' mm · curvature '+areaNumber(curvature.curvaturePerMM)+' 1/mm');
  updateCurvatureLabel();display('Original Curve curvature ready for '+next.pin.sourceId+'/'+next.pin.curveId+'.');return clone(next);
}
function curvatureSnapshot(){return{sourceId:curvatureSource.value,curveId:curvatureCurve.value,t:curvatureT.value,enabled:!inspectCurvatureButton.disabled,
  output:curvatureOutput.textContent,report:clone(curvatureReport),projection:clone(curvatureProjection),label:{visible:!curvatureLabel.hidden,
    text:curvatureLabel.hidden?null:curvatureLabel.textContent,xCss:curvatureLabel.hidden?null:Number.parseFloat(curvatureLabel.style.left),yCss:curvatureLabel.hidden?null:Number.parseFloat(curvatureLabel.style.top)}};}
function clearAngle(){angleReport=null;angleProjection=null;angleOutput.textContent='';angleLabel.hidden=true;}
function angleScopeChanged(scene){return angleReport&&[angleReport.first,angleReport.vertex,angleReport.third].some(point=>{
  const asset=scene?.assets.find(value=>value.sourceId===point.sourceId);
  return !asset||asset.source!==point.expectedSource||asset.face.topology.face.id!==point.faceId||asset.face.geometry.name!==point.modelId
    ||!asset.face.geometry.objects.some(object=>object.id===point.geometryId&&object.kind===point.kind)
    ||point.kind==='surface'&&asset.face.topology.face.surfaceId!==point.geometryId;});}
function updateAngleLabel(){if(!viewer||disposed||!angleReport){angleProjection=null;angleLabel.hidden=true;return;}
  const state=viewer.getState();if(angleScopeChanged(state.qualifiedFaceScene)){clearAngle();return;}
  if(state.status!=='ready'){angleProjection=null;angleLabel.hidden=true;return;}
  try{angleProjection=viewer.projectQualifiedFacePoint(angleReport.anchor);}catch{angleProjection=null;}
  angleLabel.hidden=!angleProjection;if(!angleProjection)return;
  angleLabel.textContent=angleReport.vertex.sourceId+'/'+angleReport.vertex.geometryId+' · '+distanceFormat.format(angleReport.angleDegrees)+'°';
  angleLabel.style.left=angleProjection.xCss+'px';angleLabel.style.top=angleProjection.yCss+'px';
}
function renderAngleControls(scene){const enabled=!disposed&&!running&&!!scene;angleButton.disabled=!enabled;
  for(const control of angleControls){const previousSource=control.source.value,previousGeometry=control.geometry.value;
    control.source.replaceChildren(...(scene?.assets??[]).map(asset=>{const option=document.createElement('option');option.value=asset.sourceId;option.textContent=asset.sourceId;return option;}));
    if(scene?.assets.some(asset=>asset.sourceId===previousSource))control.source.value=previousSource;
    else if(scene?.assets.some(asset=>asset.sourceId==='A'))control.source.value='A';
    const asset=scene?.assets.find(value=>value.sourceId===control.source.value);
    control.geometry.replaceChildren(...(asset?.face.geometry.objects??[]).filter(object=>object.kind==='curve'
      ||object.kind==='surface'&&object.id===asset.face.topology.face.surfaceId).map(object=>{const option=document.createElement('option');
      option.value=object.id;option.dataset.kind=object.kind;option.textContent=object.kind+' · '+object.id;return option;}));
    if([...control.geometry.options].some(option=>option.value===previousGeometry))control.geometry.value=previousGeometry;
    const curve=control.geometry.selectedOptions[0]?.dataset.kind==='curve';control.source.disabled=!enabled;control.geometry.disabled=!enabled;
    for(const parameter of['u','v','t']){const active=parameter==='t'?curve:!curve;control[parameter].disabled=!enabled||!active;
      document.querySelector('#'+control.side+'-'+parameter+'-label').hidden=!active;}
  }
}
function measureAngle(first=controlMeasurementInput(angleControls[0]),vertex=controlMeasurementInput(angleControls[1]),third=controlMeasurementInput(angleControls[2])){
  const next=queryQualifiedFaceAngle(viewer,first,vertex,third);angleReport=clone(next);
  angleOutput.textContent=[next.first,next.vertex,next.third].map(point=>point.sourceId+'/'+point.geometryId).join(' → ')
    +' · '+areaNumber(next.angleDegrees)+'°';updateAngleLabel();display('Original native angle ready.');return clone(next);
}
function angleSnapshot(){return{enabled:!angleButton.disabled,output:angleOutput.textContent,report:clone(angleReport),projection:clone(angleProjection),
  label:{visible:!angleLabel.hidden,text:angleLabel.hidden?null:angleLabel.textContent,xCss:angleLabel.hidden?null:Number.parseFloat(angleLabel.style.left),yCss:angleLabel.hidden?null:Number.parseFloat(angleLabel.style.top)}};}
function clearLength(){lengthReport=null;lengthProjection=null;lengthOutput.textContent='';lengthLabel.hidden=true;}
function lengthScopeChanged(scene){if(!lengthReport)return false;const pin=lengthReport.pin,asset=scene?.assets.find(value=>value.sourceId===pin.sourceId);
  return !asset||asset.source!==pin.expectedSource||asset.face.topology.face.id!==pin.faceId||asset.face.geometry.name!==pin.modelId
    ||!asset.face.geometry.objects.some(object=>object.id===pin.curveId&&object.kind==='curve');}
function updateLengthLabel(){if(!viewer||disposed||!lengthReport){lengthProjection=null;lengthLabel.hidden=true;return;}
  const state=viewer.getState();if(lengthScopeChanged(state.qualifiedFaceScene)){clearLength();return;}
  if(state.status!=='ready'){lengthProjection=null;lengthLabel.hidden=true;return;}
  try{lengthProjection=viewer.projectQualifiedFacePoint(lengthReport.anchor);}catch{lengthProjection=null;}
  lengthLabel.hidden=!lengthProjection;if(!lengthProjection)return;
  lengthLabel.textContent=lengthReport.pin.sourceId+'/'+lengthReport.pin.curveId+' · '+distanceFormat.format(lengthReport.length.estimatedLengthMM)+' mm';
  lengthLabel.style.left=lengthProjection.xCss+'px';lengthLabel.style.top=lengthProjection.yCss+'px';
}
function renderLengthControls(scene){const previousSource=lengthSource.value,previousCurve=lengthCurve.value;
  lengthSource.replaceChildren(...(scene?.assets??[]).map(asset=>{const option=document.createElement('option');option.value=asset.sourceId;option.textContent=asset.sourceId;return option;}));
  if(scene?.assets.some(asset=>asset.sourceId===previousSource))lengthSource.value=previousSource;
  else if(scene?.assets.some(asset=>asset.sourceId==='F'))lengthSource.value='F';
  const asset=scene?.assets.find(value=>value.sourceId===lengthSource.value);
  lengthCurve.replaceChildren(...(asset?.face.geometry.objects??[]).filter(object=>object.kind==='curve').map(curve=>{
    const option=document.createElement('option');option.value=curve.id;option.textContent=curve.id;return option;}));
  if([...lengthCurve.options].some(option=>option.value===previousCurve))lengthCurve.value=previousCurve;
  else if([...lengthCurve.options].some(option=>option.value==='c2'))lengthCurve.value='c2';
  const enabled=!disposed&&!running&&!!scene&&lengthCurve.options.length>0;lengthSource.disabled=!enabled;lengthCurve.disabled=!enabled;inspectLengthButton.disabled=!enabled;
}
function inspectLength(pin=lengthPin(viewer.getState().qualifiedFaceScene,lengthSource.value,lengthCurve.value),options=LENGTH_OPTIONS){
  const next=queryQualifiedFaceCurveLength(viewer.getState().qualifiedFaceScene,pin,options);lengthReport=clone(next);
  lengthOutput.textContent=next.pin.sourceId+'/'+next.pin.curveId+' · Curve length estimate '+areaNumber(next.length.estimatedLengthMM)
    +' mm · endpoint chord '+areaNumber(next.chordMM)+' mm.';updateLengthLabel();
  display('Original Curve length ready for '+next.pin.sourceId+'/'+next.pin.curveId+'.');return clone(next);
}
function lengthSnapshot(){return{sourceId:lengthSource.value,curveId:lengthCurve.value,enabled:!inspectLengthButton.disabled,output:lengthOutput.textContent,
  report:clone(lengthReport),projection:clone(lengthProjection),label:{visible:!lengthLabel.hidden,text:lengthLabel.hidden?null:lengthLabel.textContent,
    xCss:lengthLabel.hidden?null:Number.parseFloat(lengthLabel.style.left),yCss:lengthLabel.hidden?null:Number.parseFloat(lengthLabel.style.top)}};}
function clearArea(){areaReport=null;areaProjection=null;areaOutput.textContent='';areaLabel.hidden=true;}
function areaScopeChanged(scene){if(!areaReport)return false;const pin=areaReport.pin,asset=scene?.assets.find(value=>value.sourceId===pin.sourceId);
  return !asset||asset.source!==pin.expectedSource||asset.face.topology.face.id!==pin.faceId||asset.face.geometry.name!==pin.modelId||asset.face.topology.face.surfaceId!==pin.surfaceId;}
function areaNumber(value){return value!==0&&Math.abs(value)<1e-4?value.toExponential(3):areaFormat.format(value);}
function updateAreaLabel(){if(!viewer||disposed||!areaReport){areaProjection=null;areaLabel.hidden=true;return;}
  const state=viewer.getState();if(areaScopeChanged(state.qualifiedFaceScene)){clearArea();return;}
  if(state.status!=='ready'){areaProjection=null;areaLabel.hidden=true;return;}
  try{areaProjection=viewer.projectQualifiedFacePoint(areaReport.anchor);}catch{areaProjection=null;}
  areaLabel.hidden=!areaProjection;if(!areaProjection)return;
  areaLabel.textContent=areaReport.pin.sourceId+' · '+distanceFormat.format(areaReport.area.areaEstimateMM2)+' mm²';
  areaLabel.style.left=areaProjection.xCss+'px';areaLabel.style.top=areaProjection.yCss+'px';
}
function renderAreaControls(scene){const previous=areaSource.value;areaSource.replaceChildren(...(scene?.assets??[]).map(asset=>{
    const option=document.createElement('option');option.value=asset.sourceId;option.textContent=asset.sourceId;return option;}));
  if(scene?.assets.some(asset=>asset.sourceId===previous))areaSource.value=previous;
  else if(scene?.assets.some(asset=>asset.sourceId==='F'))areaSource.value='F';
  const enabled=!disposed&&!running&&!!scene;areaSource.disabled=!enabled;inspectAreaButton.disabled=!enabled;
}
function inspectArea(pin=areaPin(viewer.getState().qualifiedFaceScene,areaSource.value),options=AREA_OPTIONS){
  const next=queryQualifiedFaceSurfaceArea(viewer.getState().qualifiedFaceScene,pin,options);areaReport=clone(next);
  areaOutput.textContent=next.pin.sourceId+'/'+next.pin.surfaceId+' · Surface area estimate '+areaNumber(next.area.areaEstimateMM2)
    +' mm²; heuristic error estimate '+areaNumber(next.area.errorEstimateMM2)+' mm².';updateAreaLabel();
  display('Original Surface area ready for '+next.pin.sourceId+'.');return clone(next);
}
function areaSnapshot(){return{sourceId:areaSource.value,enabled:!inspectAreaButton.disabled,output:areaOutput.textContent,report:clone(areaReport),projection:clone(areaProjection),
  label:{visible:!areaLabel.hidden,text:areaLabel.hidden?null:areaLabel.textContent,xCss:areaLabel.hidden?null:Number.parseFloat(areaLabel.style.left),yCss:areaLabel.hidden?null:Number.parseFloat(areaLabel.style.top)}};}
function measurementScopeChanged(scene){return measurementReport&&[measurementReport.first,measurementReport.second].some(point=>{
  const asset=scene?.assets.find(value=>value.sourceId===point.sourceId);
  return !asset||asset.source!==point.expectedSource||asset.face.topology.face.id!==point.faceId||asset.face.geometry.name!==point.modelId;});}
function hideLabels(){currentProjections=[null,null];for(const label of[...pointLabels,distanceLabel])label.hidden=true;}
function clearMeasurement(){measurementReport=null;measurementOutput.textContent='';labelPins=null;hideLabels();}
function updateLabels(){if(!viewer||disposed||!labelPins||!measurementReport){hideLabels();return;}
  const state=viewer.getState();if(measurementScopeChanged(state.qualifiedFaceScene)){clearMeasurement();return;}
  if(state.status!=='ready'||!state.qualifiedFaceScene){hideLabels();return;}
  currentProjections=labelPins.map(pin=>{try{return viewer.projectQualifiedFacePoint(pin);}catch{return null;}});
  currentProjections.forEach((projection,index)=>{const label=pointLabels[index];label.hidden=!projection;if(!projection)return;
    label.textContent=(index+1)+' · '+labelPins[index].sourceId+'/'+labelPins[index].geometryId;
    label.style.left=projection.xCss+'px';label.style.top=projection.yCss+'px';});
  distanceLabel.hidden=!currentProjections.every(Boolean);
  if(!distanceLabel.hidden){const [first,second]=currentProjections;
    distanceLabel.textContent=distanceFormat.format(measurementReport.distanceMM)+' mm';
    distanceLabel.style.left=(first.xCss+second.xCss)/2+'px';distanceLabel.style.top=(first.yCss+second.yCss)/2+'px';}
}
function labelSnapshot(){const snapshot=label=>({id:label.id,visible:!label.hidden,text:label.hidden?null:label.textContent,
  xCss:label.hidden?null:Number.parseFloat(label.style.left),yCss:label.hidden?null:Number.parseFloat(label.style.top)});
  return{points:pointLabels.map(snapshot),distance:snapshot(distanceLabel),projections:clone(currentProjections)};}
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
  const report=viewer.measureQualifiedFacePoints(first,second);measurementReport=clone(report);labelPins=[clone(first),clone(second)];
  const point=value=>({kind:value.kind,sourceId:value.sourceId,faceId:value.faceId,modelId:value.modelId,geometryId:value.geometryId,
    parameters:value.kind==='surface'?{u:value.u,v:value.v}:{t:value.t},pointMM:value.pointMM,pointScene:value.pointScene});
  measurementOutput.textContent=JSON.stringify({first:point(report.first),second:point(report.second),
    distanceMM:report.distanceMM,distanceScene:report.distanceScene,units:{pointMM:'mm',pointScene:'scene units',distanceMM:'mm',distanceScene:'scene units'},
    metric:report.metric,basis:report.basis,certification:report.certification},null,2);updateLabels();return report;
}
function candidate(overrides={}){const variant=overrides.variant??'warped',amount=overrides.assetCount??6,sourceAssets=originalRequests[variant].assets;
  const {variant:unusedVariant,assetCount:unusedAmount,...changes}=overrides;
  const selected=amount===2?sourceAssets.filter(asset=>['B','F'].includes(asset.sourceId)):sourceAssets;
  return {version:0,basis:'authored-xyz-matches-rhyup',assets:selected.map(asset=>({...clone(asset),color:[...colors['ABCDEF'.indexOf(asset.sourceId)]]})),
    countU:17,countV:17,camera:clone(camera),translateScene:[...translateScene],...changes};
}
function render(){const state=viewer.getState(),scene=state.qualifiedFaceScene,available=!disposed&&!['context-lost','unavailable'].includes(state.status);
  if(measurementScopeChanged(scene))clearMeasurement();
  if(areaScopeChanged(scene))clearArea();
  if(lengthScopeChanged(scene))clearLength();
  if(angleScopeChanged(scene))clearAngle();
  if(curvatureScopeChanged(scene))clearCurvature();
  if(surfaceCurvatureScopeChanged(scene))clearSurfaceCurvature();
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
  updateLabels();
  renderAreaControls(scene);updateAreaLabel();
  renderLengthControls(scene);updateLengthLabel();
  renderAngleControls(scene);updateAngleLabel();
  renderCurvatureControls(scene);updateCurvatureLabel();
  renderSurfaceCurvatureControls(scene);updateSurfaceCurvatureLabel();
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
    viewer.clear();clearInspection();clearMeasurement();clearArea();clearLength();clearAngle();clearCurvature();clearSurfaceCurvature();check(viewer.getState().qualifiedFaceScene===null,'Clear retained qualified Face authority');load(original);
    result.contextCount=contexts.size;result.resources=resourceCounts();result.glErrors=glErrors();result.errors=[...errors];result.warnings=[...warnings];result.getterCalls=getterCalls;
    check(contexts.size===1&&result.glErrors.every(n=>n===0)&&!errors.length&&!warnings.length,'Context/GL/browser gate failed');result.ok=true;
  }catch(error){result.error=error.stack||error.message;result.failures.push({error:result.error,completed:result.cases.length});result.resources=resourceCounts();result.errors=[...errors];}
  finally{running=false;render();window.__viewerQualifiedFaceResult=result;display(result.ok?'Original Face checks completed.':('Face checks stopped: '+(result.error??'Unknown error')));
    try{await fetch('/result',{method:'POST',body:JSON.stringify(result)});}catch(error){result.recordingError=error.message;}}return result;}
function dispose(){if(disposed)return;viewer.dispose();viewer.dispose();disposed=true;labelResizeObserver?.disconnect();clearInspection();clearMeasurement();clearArea();clearLength();clearAngle();clearCurvature();clearSurfaceCurvature();render();const receipt={status:viewer.getState().status,resources:resourceCounts(),contextCount:contexts.size,
  glErrors:glErrors(),errors:[...errors],warnings:[...warnings]};if(result)result.disposal=receipt;display('Viewer disposed.');return receipt;}
try{manifest=await(await fetch('/fixture-manifest.json')).json();for(const item of manifest){const bytes=await(await fetch(item.url)).arrayBuffer();
    check(bytes.byteLength===item.bytes&&await sha(bytes)===item.sha256,'Original Face fixture bytes/hash changed');fixtures[item.name]={...item,bytes:new Uint8Array(bytes),text:new TextDecoder().decode(bytes)};}
  for(const name of['warped','interior_edit'])originalRequests[name]=JSON.parse(fixtures[name+'.authentic-request.json'].text);
  for(const id of'ABCDEF'){const source=fixtures['warped_'+id+'.source0.css'].text;check(source===originalRequests.warped.assets.find(asset=>asset.sourceId===id).source,'Original source file/Face association differs');originalSources[id]=source;}
  check(fixtures['interior_edit_F.source0.css'].text===originalRequests.interior_edit.assets[5].source,'Original interior-edit Source0 association differs');
  viewer=createViewer(canvas,{mmToSceneUnit,background});load(candidate());lossExtension=[...contexts][0].getExtension('WEBGL_lose_context');
  labelResizeObserver=new ResizeObserver(()=>{updateLabels();updateAreaLabel();updateLengthLabel();updateAngleLabel();updateCurvatureLabel();updateSurfaceCurvatureLabel();});labelResizeObserver.observe(canvas);
  window.__viewerQualifiedFaceProof={viewer,createViewer,candidate,load,render,inspect,measurementInput,measure,updateLabels,labelSnapshot,
    AREA_OPTIONS,areaPin,queryQualifiedFaceSurfaceArea,inspectArea,updateAreaLabel,areaSnapshot,mismatchCandidate,dispose,resourceCounts,uploads,draws,glErrors,errors,warnings,lossExtension,failAllocation,
    LENGTH_OPTIONS,lengthPin,queryQualifiedFaceCurveLength,inspectLength,updateLengthLabel,lengthSnapshot,
    queryQualifiedFaceAngle,measureAngle,updateAngleLabel,angleSnapshot,
    curvaturePin,queryQualifiedFaceCurveCurvature,inspectCurvature,updateCurvatureLabel,curvatureSnapshot,evaluateCurveCurvature,evaluateCurveD2,
    surfaceCurvaturePin,queryQualifiedFaceSurfaceCurvature,inspectSurfaceCurvature,updateSurfaceCurvatureLabel,surfaceCurvatureSnapshot,evaluateSurfaceCurvature,evaluateSurfaceD2,
    failNextBuffer(at=16){failAllocation('Buffer',at);},clearAllocationFault,originalRequests,originalSources,fixtures,manifest,colors,camera,translateScene,mmToSceneUnit,background,pixelInfo,witness,retained,capture,runProof,
    prepareQualifiedFaceScene,QualifiedFaceSceneRenderer,MixedDepthRenderer,prepareMixedDepthFrame,compileGpu,prepareCamera,prepareUniformCurvePreview,prepareSelectedUniformCurvePreview,
    compileCadModel,validateFaceBundle,tessellateSurface,evaluateSurface,evaluateCurve,curveDomain,parseBooleanExtrusionFeatureGraph,parseBaroCadSource,
    createCadDocument,createCadGeometryReference,queryCadDocumentSurfaceArea,validateCadDocumentSurfaceArea,queryCadDocumentCurveArcLength,validateCadDocumentCurveArcLength,
    loadBaroCadModelSet,loadBaroCadDocument,parseBaroCadDocument,prepareBaroCadDocumentPrimitiveNativeRefsV2,parseBaroCadAssembly,loadBaroCadAssembly,
    createClothWorld,createPhysicsClothWorld:createClothWorld,PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer,canvas,
    get gl(){return[...contexts][0];},get state(){return viewer.getState();},get currentScene(){return viewer.getState().qualifiedFaceScene;},get inspectionReport(){return clone(inspectionReport);},
    get measurementReport(){return clone(measurementReport);},get currentProjections(){return clone(currentProjections);},get areaReport(){return clone(areaReport);},
    get lengthReport(){return clone(lengthReport);},get angleReport(){return clone(angleReport);},get curvatureReport(){return clone(curvatureReport);},
    get surfaceCurvatureReport(){return clone(surfaceCurvatureReport);},get result(){return result;}};
  display('Original Faces ready. Inspect a current source from its row.');
}catch(error){display('Original Faces could not load: '+error.message);}
buttons.load.addEventListener('click',()=>action(()=>load(candidate({assetCount:Number(assetCount.value),countU:Number(countU.value),countV:Number(countV.value)}))));
buttons['interior-edit'].addEventListener('click',()=>action(()=>load(candidate({variant:'interior_edit'}))));buttons.mismatch.addEventListener('click',()=>action(()=>load(mismatchCandidate())));
buttons.reverse.addEventListener('click',()=>action(()=>{const scene=viewer.getState().qualifiedFaceScene;check(scene,'Load current Faces first.');load({version:0,basis:scene.basis,assets:[...clone(scene.assets)].reverse(),countU:scene.countU,countV:scene.countV,camera:clone(scene.camera),translateScene:[...scene.translate]});}));
buttons['apply-color'].addEventListener('click',()=>action(()=>{const scene=viewer.getState().qualifiedFaceScene;check(scene,'Load current Faces first.');const assets=clone(scene.assets),asset=assets.find(value=>value.sourceId===colorAsset.value);
  check(asset,'Choose a current source');asset.color=[1,3,5].map(index=>parseInt(colorInput.value.slice(index,index+2),16)/255);
  load({version:0,basis:scene.basis,assets,countU:scene.countU,countV:scene.countV,camera:clone(scene.camera),translateScene:[...scene.translate]});}));
buttons['saved-view'].addEventListener('click',()=>action(()=>viewer.setView(camera)));buttons.orbit.addEventListener('click',()=>action(()=>viewer.orbit(.05,.02)));buttons.pan.addEventListener('click',()=>action(()=>viewer.pan(.01,0)));
buttons.resize.addEventListener('click',()=>action(()=>viewer.resize(canvas.width===640?480:640,canvas.height===480?360:480)));buttons.clear.addEventListener('click',()=>action(()=>{viewer.clear();clearInspection();clearMeasurement();clearArea();clearLength();clearAngle();clearCurvature();clearSurfaceCurvature();}));
for(const control of measurementControls)for(const field of['source','geometry'])control[field].addEventListener('change',()=>renderMeasurementControls(viewer.getState().qualifiedFaceScene));
measureButton.addEventListener('click',()=>action(()=>measure()));
inspectAreaButton.addEventListener('click',()=>action(()=>inspectArea()));
lengthSource.addEventListener('change',()=>renderLengthControls(viewer.getState().qualifiedFaceScene));
inspectLengthButton.addEventListener('click',()=>action(()=>inspectLength()));
for(const control of angleControls)for(const field of['source','geometry'])control[field].addEventListener('change',()=>renderAngleControls(viewer.getState().qualifiedFaceScene));
angleButton.addEventListener('click',()=>action(()=>measureAngle()));
curvatureSource.addEventListener('change',()=>renderCurvatureControls(viewer.getState().qualifiedFaceScene));
inspectCurvatureButton.addEventListener('click',()=>action(()=>inspectCurvature()));
inspectSurfaceCurvatureButton.addEventListener('click',()=>action(()=>inspectSurfaceCurvature()));
buttons['run-proof'].addEventListener('click',runProof);buttons.dispose.addEventListener('click',dispose);buttons['lose-context'].addEventListener('click',()=>lossExtension?.loseContext());
canvas.addEventListener('webglcontextlost',()=>{render();display('Context lost. Original source inspection remains available.');});window.addEventListener('beforeunload',()=>{if(viewer)dispose();});
