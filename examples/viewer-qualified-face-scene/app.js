import {createViewer} from '@barocss/viewer';
import {prepareQualifiedFaceScene,QualifiedFaceSceneRenderer,MixedDepthRenderer,prepareMixedDepthFrame,compileGpu,prepareCamera,prepareMesh,
  prepareUniformCurvePreview,prepareSelectedUniformCurvePreview,PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer} from '@barocss/gpu';
import {compileCadModel,validateFaceBundle,tessellateSurface,evaluateSurface,evaluateCurve,curveDomain,parseBooleanExtrusionFeatureGraph,
  createCadDocument,createCadGeometryReference,queryCadDocumentSurfaceArea,validateCadDocumentSurfaceArea,
  queryCadDocumentCurveArcLength,validateCadDocumentCurveArcLength,evaluateCurveCurvature,evaluateCurveD2,evaluateSurfaceCurvature,evaluateSurfaceD2,evaluateCurveD1,evaluateSurfaceD1} from '@barocss/cad';
import {AREA_OPTIONS,areaPin,queryQualifiedFaceSurfaceArea} from './surface-area.js';
import {LENGTH_OPTIONS,lengthPin,queryQualifiedFaceCurveLength} from './curve-length.js';
import {queryQualifiedFaceAngle} from './native-angle.js';
import {curvaturePin,queryQualifiedFaceCurveCurvature} from './curve-curvature.js';
import {surfaceCurvaturePin,queryQualifiedFaceSurfaceCurvature} from './surface-curvature.js';
import {tangentAnglePin,queryQualifiedFaceTangentAngle} from './tangent-angle.js';
import {normalAnglePin,queryQualifiedFaceNormalAngle} from './normal-angle.js';
import {createPickedFacePoint,measurePickedFaceChord,isPickedFacePointCurrent} from './picked-chord.js';
import {measurePickedFaceAngle} from './picked-angle.js';
import {queryPickedFaceSurfaceCurvature} from './picked-curvature.js';
import {measurePickedFaceNormalAngle} from './picked-normal-angle.js';
import {buildQualifiedFaceTree,queryQualifiedFaceTreeNode,inspectQualifiedFaceTreeNode} from './qualified-face-tree.js';
import {filterQualifiedFaceTree} from './qualified-face-tree-filter.js';
import {queryQualifiedTreeCurveLength} from './tree-curve-length.js';
import {queryQualifiedTreeSurfaceArea} from './tree-surface-area.js';
import {queryQualifiedTreeCurveCurvature} from './tree-curve-curvature.js';
import {queryQualifiedTreeSurfaceCurvature} from './tree-surface-curvature.js';
import {queryQualifiedTreeTangentAngle} from './tree-curve-tangent-angle.js';
import {queryQualifiedTreeNormalAngle} from './tree-surface-normal-angle.js';
import {createQualifiedFacePointerNavigation} from './pointer-navigation.js';
import {createQualifiedFaceKeyboardFraming} from './keyboard-framing.js';
import {applyQualifiedTreeFaceColor} from './tree-face-appearance.js';
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
const navigateFaceView=document.querySelector('#navigate-face-view');
const faceInspectMode=document.querySelector('#face-inspect-mode'),faceScreenOutput=document.querySelector('#face-screen-inspection'),faceRowRefs=new WeakMap();
const nativeSampleMode=document.querySelector('#native-sample-mode'),nativeSampleOutput=document.querySelector('#native-sample-output');
const inspectPickedSurfaceCurvatureButton=document.querySelector('#inspect-picked-surface-curvature'),resetPickedSurfaceCurvatureButton=document.querySelector('#reset-picked-surface-curvature');
const pickedSurfaceCurvatureOutput=document.querySelector('#picked-surface-curvature-output'),pickedSurfaceCurvatureLabel=document.querySelector('#picked-surface-curvature-label');
const pickedChordMode=document.querySelector('#picked-chord-mode'),resetPickedChordButton=document.querySelector('#reset-picked-chord'),pickedChordOutput=document.querySelector('#picked-chord-output');
const pickedChordLabels=[1,2].map(index=>document.querySelector('#picked-chord-point-'+index)),pickedChordDistanceLabel=document.querySelector('#picked-chord-distance');
const pickedAngleMode=document.querySelector('#picked-angle-mode'),resetPickedAngleButton=document.querySelector('#reset-picked-angle'),pickedAngleOutput=document.querySelector('#picked-angle-output');
const pickedAngleLabels=['first','vertex','third'].map(side=>document.querySelector('#picked-angle-'+side)),pickedAngleValueLabel=document.querySelector('#picked-angle-value');
const pickedNormalAngleMode=document.querySelector('#picked-normal-angle-mode'),resetPickedNormalAngleButton=document.querySelector('#reset-picked-normal-angle'),pickedNormalAngleOutput=document.querySelector('#picked-normal-angle-output');
const pickedNormalAngleLabels=['first','second'].map(side=>document.querySelector('#picked-normal-angle-'+side)),pickedNormalAngleValueLabel=document.querySelector('#picked-normal-angle-value');
const qualifiedTreeElement=document.querySelector('#qualified-face-tree'),treeProperties=document.querySelector('#tree-properties'),treePointOutput=document.querySelector('#tree-point-output');
const treeU=document.querySelector('#tree-u'),treeV=document.querySelector('#tree-v'),treeT=document.querySelector('#tree-t'),treePointLabel=document.querySelector('#tree-point-label');
const inspectTreePointButton=document.querySelector('#inspect-tree-point'),frameTreeFaceButton=document.querySelector('#frame-tree-face'),clearTreeSelectionButton=document.querySelector('#clear-tree-selection'),syncFaceTree=document.querySelector('#sync-face-tree');
const treeButtonRefs=new WeakMap();
const treeFilterQuery=document.querySelector('#tree-filter-query'),treeFilterSource=document.querySelector('#tree-filter-source'),treeFilterKind=document.querySelector('#tree-filter-kind');
const clearTreeFiltersButton=document.querySelector('#clear-tree-filters'),treeFilterStatus=document.querySelector('#tree-filter-status');
const measureTreeLengthButton=document.querySelector('#measure-tree-length'),resetTreeLengthButton=document.querySelector('#reset-tree-length');
const treeLengthOutput=document.querySelector('#tree-length-output'),treeLengthLabel=document.querySelector('#tree-length-label');
const inspectTreeAreaButton=document.querySelector('#inspect-tree-area'),resetTreeAreaButton=document.querySelector('#reset-tree-area');
const treeAreaOutput=document.querySelector('#tree-area-output'),treeAreaLabel=document.querySelector('#tree-area-label');
const inspectTreeCurvatureButton=document.querySelector('#inspect-tree-curvature'),resetTreeCurvatureButton=document.querySelector('#reset-tree-curvature');
const treeCurvatureOutput=document.querySelector('#tree-curvature-output'),treeCurvatureLabel=document.querySelector('#tree-curvature-label');
const inspectTreeSurfaceCurvatureButton=document.querySelector('#inspect-tree-surface-curvature'),resetTreeSurfaceCurvatureButton=document.querySelector('#reset-tree-surface-curvature');
const treeSurfaceCurvatureOutput=document.querySelector('#tree-surface-curvature-output'),treeSurfaceCurvatureLabel=document.querySelector('#tree-surface-curvature-label');
const captureTreeTangentButton=document.querySelector('#capture-tree-tangent'),resetTreeTangentAngleButton=document.querySelector('#reset-tree-tangent-angle'),treeTangentAngleOutput=document.querySelector('#tree-tangent-angle-output');
const treeTangentLabels=Object.fromEntries(['first','second','angle'].map(side=>[side,document.querySelector('#tree-tangent-'+side+'-label')]));
const captureTreeNormalButton=document.querySelector('#capture-tree-normal'),resetTreeNormalAngleButton=document.querySelector('#reset-tree-normal-angle'),treeNormalAngleOutput=document.querySelector('#tree-normal-angle-output');
const treeNormalLabels=Object.fromEntries(['first','second','angle'].map(side=>[side,document.querySelector('#tree-normal-'+side+'-label')]));
const assetCount=document.querySelector('#asset-count'),countU=document.querySelector('#count-u'),countV=document.querySelector('#count-v');
const colorAsset=document.querySelector('#color-asset'),colorInput=document.querySelector('#color');
const applyTreeColorButton=document.querySelector('#apply-tree-color'),treeColorTarget=document.querySelector('#tree-color-target');
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
const tangentAngleButton=document.querySelector('#measure-tangent-angle'),tangentAngleOutput=document.querySelector('#tangent-angle-output'),tangentAngleLabel=document.querySelector('#native-tangent-angle-label');
const tangentControls=['first','second'].map((side,index)=>({side,defaultSource:index===0?'E':'F',defaultCurve:index===0?'c1':'c2',
  source:document.querySelector('#tangent-'+side+'-source'),curve:document.querySelector('#tangent-'+side+'-curve'),t:document.querySelector('#tangent-'+side+'-t')}));
const normalAngleButton=document.querySelector('#measure-normal-angle'),normalAngleOutput=document.querySelector('#normal-angle-output'),normalAngleLabel=document.querySelector('#native-normal-angle-label');
const normalControls=['first','second'].map((side,index)=>({side,defaultSource:index===0?'E':'F',
  source:document.querySelector('#normal-'+side+'-source'),surface:document.querySelector('#normal-'+side+'-surface'),
  u:document.querySelector('#normal-'+side+'-u'),v:document.querySelector('#normal-'+side+'-v')}));
const angleControls=['first','vertex','third'].map(point=>({side:'angle-'+point,
  source:document.querySelector('#angle-'+point+'-source'),geometry:document.querySelector('#angle-'+point+'-geometry'),
  u:document.querySelector('#angle-'+point+'-u'),v:document.querySelector('#angle-'+point+'-v'),t:document.querySelector('#angle-'+point+'-t')}));
const distanceFormat=new Intl.NumberFormat('en',{maximumFractionDigits:4});
const measurementControls=['first','second'].map(side=>({side,
  source:document.querySelector('#measure-'+side+'-source'),geometry:document.querySelector('#measure-'+side+'-geometry'),
  u:document.querySelector('#measure-'+side+'-u'),v:document.querySelector('#measure-'+side+'-v'),t:document.querySelector('#measure-'+side+'-t')}));
const buttons=Object.fromEntries(['load','interior-edit','mismatch','reverse','apply-color','saved-view','frame-all-faces','orbit','pan','resize','clear','run-proof','lose-context','dispose']
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
const fixtures={},originalRequests={},originalSources={};let manifest=[],viewer=null,disposed=false,running=false,result=null,inspectionReport=null,inspectionFace=null,measurementReport=null;
let labelPins=null,currentProjections=[null,null],labelResizeObserver=null,faceNavigation=null,disposeFaceKeyboard=null;
let areaReport=null,areaProjection=null;
let lengthReport=null,lengthProjection=null;
let angleReport=null,angleProjection=null;
let curvatureReport=null,curvatureProjection=null;
let surfaceCurvatureReport=null,surfaceCurvatureProjection=null;
let tangentAngleReport=null,tangentAngleProjection=null;
let normalAngleReport=null,normalAngleProjection=null,normalAngleFaces=null;
let faceInspectionEpoch=0,faceInspectionScope=null,faceInspectionRecord=null;
let nativeSampleRecord=null;
let pickedChordFirst=null,pickedChordReport=null,pickedChordProjections=[null,null];
let pickedAngleFirst=null,pickedAngleVertex=null,pickedAngleReport=null,pickedAngleProjections=[null,null,null];
let pickedSurfaceCurvatureReport=null,pickedSurfaceCurvatureProjection=null;
let pickedNormalAngleFirst=null,pickedNormalAngleReport=null,pickedNormalAngleProjections=[null,null];
let qualifiedTreeContent=null,qualifiedTreeData=null,qualifiedTreeSelected=null,qualifiedTreeReport=null,treePointProjection=null,treeGeneration=0,treeNodeButtons=[];
let qualifiedTreeFilter={query:'',sourceId:null,kind:'all'},qualifiedTreeFiltered=null,qualifiedTreeSelectedHidden=false;
let treeCurveLengthReport=null,treeCurveLengthProjection=null;
let treeSurfaceAreaReport=null,treeSurfaceAreaProjection=null;
let treeCurveCurvatureReport=null,treeCurveCurvatureProjection=null;
let treeSurfaceCurvatureReport=null,treeSurfaceCurvatureProjection=null;
let treeTangentFirstCapture=null,treeTangentAngleReport=null,treeTangentProjections={first:null,second:null,angle:null},treeTangentHidden={first:false,second:false};
let treeNormalFirstCapture=null,treeNormalAngleReport=null,treeNormalProjections={first:null,second:null,angle:null},treeNormalHidden={first:false,second:false};
const colors=[[.9,.3,.2],[.25,.8,.4],[.25,.45,.95],[.95,.7,.2],[.3,.8,.9],[.85,.35,.75]];
const camera={eye:[2,1.5,3.2],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:10},mmToSceneUnit=.12,background=[.02,.03,.04],translateScene=[-.6,-.6,-.7];
const resourceCounts=()=>Object.fromEntries(Object.entries(resources).map(([key,live])=>[key,live.size]));
const glErrors=()=>[...contexts].map(gl=>gl.getError());
const pixelInfo=()=>({hash:hash(viewer.readPixels())});
const display=value=>status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
function clearInspection(){inspectionReport=null;inspectionFace=null;inspection.textContent='';}
function inspectionScopeChanged(scene){if(!inspectionReport)return false;const asset=scene?.assets.find(asset=>asset.sourceId===inspectionReport.sourceId);
  return !asset||asset.source!==inspectionReport.source||!inspectionFace||!same(asset.face,inspectionFace);}
function currentFaceInspectionScope(){if(!viewer)return null;const state=viewer.getState(),rect=canvas.getBoundingClientRect();
  return{scene:state.qualifiedFaceScene,camera:state.camera,status:state.status,width:canvas.width,height:canvas.height,
    css:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}};}
function currentFaceRef(asset){return{sourceId:asset.sourceId,expectedSource:asset.source,faceId:asset.face.topology.face.id,
  modelId:asset.face.geometry.name,surfaceId:asset.face.topology.face.surfaceId};}
function markFaceInspectionRows(){for(const item of rows.children)item.dataset.screenInspected=String(!!faceInspectionRecord?.pick
  &&same(faceRowRefs.get(item),faceInspectionRecord.pick.ref));}
function clearNativeSample(){nativeSampleRecord=null;nativeSampleOutput.textContent='';inspectPickedSurfaceCurvatureButton.disabled=true;}
function invalidateFaceInspection(){faceInspectionEpoch++;faceInspectionRecord=null;faceScreenOutput.textContent='';clearNativeSample();markFaceInspectionRows();}
function refreshFaceInspection(){const scope=currentFaceInspectionScope();if(!same(scope,faceInspectionScope)){invalidateFaceInspection();faceInspectionScope=clone(scope);}
  const available=!disposed&&!!scope?.scene&&!['context-lost','unavailable','disposed'].includes(scope.status);
  faceInspectMode.disabled=!available||running;nativeSampleMode.disabled=!available||running;if(!available&&(faceInspectionRecord||nativeSampleRecord))invalidateFaceInspection();
  markFaceInspectionRows();return clone(faceInspectionScope);
}
function checkFaceInspectionScope(epoch,scope){refreshFaceInspection();check(epoch===faceInspectionEpoch&&same(scope,faceInspectionScope),
  'This Face inspection view is stale. Inspect the current view.');}
function inspectFaceAt(point){refreshFaceInspection();const epoch=faceInspectionEpoch,scope=clone(faceInspectionScope);
  check(!disposed&&scope?.scene&&!['context-lost','unavailable','disposed'].includes(scope.status),'Face screen inspection requires an available Face view.');
  const pick=viewer.pickQualifiedFace(point);checkFaceInspectionScope(epoch,scope);
  faceInspectionRecord={epoch,scope,point:clone(point),pick:clone(pick)};
  faceScreenOutput.textContent=pick?'Current '+pick.ref.sourceId+' / '+pick.ref.faceId+' / '+pick.ref.modelId+' / '+pick.ref.surfaceId
    +' · derived triangle '+pick.triangleIndex+' · depth '+pick.depthScene.toPrecision(6)+' scene units'+(pick.ambiguous?' · ambiguous source tie':'')
    :'No current filled Face triangle at this point.';
  markFaceInspectionRows();if(pick&&syncFaceTree.checked)syncQualifiedTreeFromPick(pick);
  display(pick?'Current Face screen inspection ready for '+pick.ref.sourceId+'.':'No current filled Face triangle at this point.');return clone(pick);
}
function faceInspectionSnapshot(){return{mode:faceInspectMode.checked,epoch:faceInspectionEpoch,scope:clone(faceInspectionScope),record:clone(faceInspectionRecord),
  output:faceScreenOutput.textContent,markedRefs:[...rows.children].filter(item=>item.dataset.screenInspected==='true').map(item=>clone(faceRowRefs.get(item)))};}
function readFaceSample(point){refreshFaceInspection();const epoch=faceInspectionEpoch,scope=clone(faceInspectionScope);
  check(!disposed&&scope?.scene&&!['context-lost','unavailable','disposed'].includes(scope.status),'Native screen sampling requires an available Face view.');
  const sample=viewer.sampleQualifiedFace(point);checkFaceInspectionScope(epoch,scope);
  return{epoch,scope,point:clone(point),sample:clone(sample)};
}
function adoptNativeSample(record){checkFaceInspectionScope(record.epoch,record.scope);const sample=record.sample;nativeSampleRecord=clone(record);
  nativeSampleOutput.textContent=sample?'Current '+sample.pick.ref.sourceId+' / '+sample.pick.ref.surfaceId+' · approximate u '+areaNumber(sample.parameters.u)
    +', v '+areaNumber(sample.parameters.v)+' · original point ['+sample.nativePoint.pointMM.map(areaNumber).join(', ')+'] mm'
    +' · display/native discrepancy '+areaNumber(sample.displayToNativeDistanceScene)+' scene units'+(sample.pick.ambiguous?' · ambiguous source tie':'')
    :'No current filled Face triangle at this point.';
  refreshPickedSurfaceCurvature();display(sample?'Original native point sampled for '+sample.pick.ref.sourceId+'.':'No current filled Face triangle at this point.');return clone(sample);
}
function sampleFaceAt(point){return adoptNativeSample(readFaceSample(point));}
function nativeSampleSnapshot(){return{mode:nativeSampleMode.checked,enabled:!nativeSampleMode.disabled,epoch:faceInspectionEpoch,scope:clone(faceInspectionScope),
  record:clone(nativeSampleRecord),report:clone(nativeSampleRecord?.sample??null),output:nativeSampleOutput.textContent};}
function clearPickedSurfaceCurvature(){pickedSurfaceCurvatureReport=null;pickedSurfaceCurvatureProjection=null;pickedSurfaceCurvatureOutput.textContent='';pickedSurfaceCurvatureLabel.hidden=true;}
function pickedSurfaceCurvatureSnapshot(){return{enabled:!inspectPickedSurfaceCurvatureButton.disabled,report:clone(pickedSurfaceCurvatureReport),
  output:pickedSurfaceCurvatureOutput.textContent,projection:clone(pickedSurfaceCurvatureProjection),label:pickedChordLabelSnapshot(pickedSurfaceCurvatureLabel)};}
function refreshPickedSurfaceCurvature(){if(disposed){clearPickedSurfaceCurvature();inspectPickedSurfaceCurvatureButton.disabled=true;resetPickedSurfaceCurvatureButton.disabled=true;return pickedSurfaceCurvatureSnapshot();}
  refreshFaceInspection();const state=viewer.getState();
  if(pickedSurfaceCurvatureReport){let current=false;try{current=isPickedFacePointCurrent(viewer,pickedSurfaceCurvatureReport.point);}catch{}
    if(!current)clearPickedSurfaceCurvature();}
  const sampleCurrent=!!nativeSampleRecord?.sample&&nativeSampleRecord.epoch===faceInspectionEpoch&&same(nativeSampleRecord.scope,faceInspectionScope);
  inspectPickedSurfaceCurvatureButton.disabled=running||state.status!=='ready'||!state.qualifiedFaceScene||!sampleCurrent;
  resetPickedSurfaceCurvatureButton.disabled=running||!pickedSurfaceCurvatureReport;
  pickedSurfaceCurvatureProjection=null;pickedSurfaceCurvatureLabel.hidden=true;if(state.status!=='ready'||!pickedSurfaceCurvatureReport)return pickedSurfaceCurvatureSnapshot();
  try{pickedSurfaceCurvatureProjection=viewer.projectQualifiedFacePoint(pickedSurfaceCurvatureReport.measurement.anchor);}catch{}
  if(pickedSurfaceCurvatureProjection){const next=pickedSurfaceCurvatureReport.measurement;
    pickedSurfaceCurvatureLabel.textContent=next.pin.sourceId+'/'+next.pin.surfaceId+' · H '+signedCurvature(next.curvature.meanCurvaturePerMM)+' 1/mm';
    pickedSurfaceCurvatureLabel.style.left=pickedSurfaceCurvatureProjection.xCss+'px';pickedSurfaceCurvatureLabel.style.top=pickedSurfaceCurvatureProjection.yCss+'px';pickedSurfaceCurvatureLabel.hidden=false;}
  return pickedSurfaceCurvatureSnapshot();
}
function renderPickedSurfaceCurvatureOutput(){const next=pickedSurfaceCurvatureReport.measurement,curvature=next.curvature;
  pickedSurfaceCurvatureOutput.textContent=next.pin.sourceId+'/'+next.pin.surfaceId+' · approximate selected u '+areaNumber(next.pin.u)+', v '+areaNumber(next.pin.v)
    +' · H '+signedCurvature(curvature.meanCurvaturePerMM)+' 1/mm · K '+signedCurvature(curvature.gaussianCurvaturePerMM2)+' 1/mm²'
    +' · k1 '+signedCurvature(curvature.principalCurvaturesPerMM[0])+', k2 '+signedCurvature(curvature.principalCurvaturesPerMM[1])+' 1/mm';}
function inspectPickedSurfaceCurvature(){refreshPickedSurfaceCurvature();check(!inspectPickedSurfaceCurvatureButton.disabled,'Obtain a current native sample in an available Face view first.');
  const record=clone(nativeSampleRecord);checkFaceInspectionScope(record.epoch,record.scope);
  const point=createPickedFacePoint(viewer,record.sample),next=queryPickedFaceSurfaceCurvature(viewer,point),report=clone(next);checkFaceInspectionScope(record.epoch,record.scope);
  pickedSurfaceCurvatureReport=report;renderPickedSurfaceCurvatureOutput();refreshPickedSurfaceCurvature();display('Original picked Surface curvature ready for '+report.point.input.sourceId+'.');return clone(report);}
function remeasurePickedSurfaceCurvature(){check(pickedSurfaceCurvatureReport,'Inspect a current picked Surface point first.');
  const next=queryPickedFaceSurfaceCurvature(viewer,pickedSurfaceCurvatureReport.point),report=clone(next);pickedSurfaceCurvatureReport=report;
  renderPickedSurfaceCurvatureOutput();refreshPickedSurfaceCurvature();display('Original picked Surface curvature measured again.');return clone(report);}
function resetPickedSurfaceCurvature(){clearPickedSurfaceCurvature();refreshPickedSurfaceCurvature();display('Picked Surface curvature reset.');}
function hidePickedChordLabels(){pickedChordProjections=[null,null];for(const label of[...pickedChordLabels,pickedChordDistanceLabel])label.hidden=true;}
function clearPickedChord(){pickedChordFirst=null;pickedChordReport=null;pickedChordOutput.textContent='Select the first original point.';hidePickedChordLabels();}
function pickedChordLabelSnapshot(label){return{visible:!label.hidden,text:label.hidden?null:label.textContent,
  xCss:label.hidden?null:Number.parseFloat(label.style.left),yCss:label.hidden?null:Number.parseFloat(label.style.top)};}
function pickedChordSnapshot(){return{mode:pickedChordMode.checked,enabled:!pickedChordMode.disabled,phase:pickedChordReport?'complete':pickedChordFirst?'first':'empty',
  first:clone(pickedChordFirst),report:clone(pickedChordReport),output:pickedChordOutput.textContent,projections:clone(pickedChordProjections),
  labels:{first:pickedChordLabelSnapshot(pickedChordLabels[0]),second:pickedChordLabelSnapshot(pickedChordLabels[1]),chord:pickedChordLabelSnapshot(pickedChordDistanceLabel)}};}
function refreshPickedChord(){if(disposed){clearPickedChord();pickedChordMode.disabled=true;resetPickedChordButton.disabled=true;return pickedChordSnapshot();}
  const state=viewer.getState(),scene=state.qualifiedFaceScene;let current=!!scene;
  try{if(pickedChordFirst)current&&=isPickedFacePointCurrent(viewer,pickedChordFirst);
    if(pickedChordReport)current&&=isPickedFacePointCurrent(viewer,pickedChordReport.second);}catch{current=false;}
  if(!current)clearPickedChord();pickedChordMode.disabled=running||!scene||state.status!=='ready';resetPickedChordButton.disabled=running||!pickedChordFirst;
  hidePickedChordLabels();if(state.status!=='ready'||!pickedChordFirst)return pickedChordSnapshot();
  const points=[pickedChordFirst,pickedChordReport?.second??null];
  for(let index=0;index<points.length;index++){const point=points[index];if(!point)continue;
    try{pickedChordProjections[index]=viewer.projectQualifiedFacePoint(point.input);}catch{pickedChordProjections[index]=null;}
    const projected=pickedChordProjections[index],label=pickedChordLabels[index];if(!projected)continue;
    label.textContent=(index+1)+': '+point.input.sourceId+'/'+point.input.geometryId;label.style.left=projected.xCss+'px';label.style.top=projected.yCss+'px';label.hidden=false;
  }
  if(pickedChordReport&&pickedChordProjections.every(Boolean)){pickedChordDistanceLabel.textContent='Approximate chord '+areaNumber(pickedChordReport.measurement.distanceMM)+' mm';
    pickedChordDistanceLabel.style.left=((pickedChordProjections[0].xCss+pickedChordProjections[1].xCss)/2)+'px';
    pickedChordDistanceLabel.style.top=((pickedChordProjections[0].yCss+pickedChordProjections[1].yCss)/2)+'px';pickedChordDistanceLabel.hidden=false;}
  return pickedChordSnapshot();
}
function renderPickedChordOutput(){pickedChordOutput.textContent=pickedChordReport?'Approximate selected chord '+areaNumber(pickedChordReport.measurement.distanceMM)+' mm · '
  +[pickedChordReport.first.input,pickedChordReport.second.input].map(input=>input.sourceId+'/'+input.geometryId).join(' ↔ ')
  :pickedChordFirst?'First original point selected on '+pickedChordFirst.input.sourceId+'/'+pickedChordFirst.input.geometryId+'. Select the second point.':'Select the first original point.';}
function adoptPickedChord(record){checkFaceInspectionScope(record.epoch,record.scope);refreshPickedChord();if(record.sample===null)return pickedChordSnapshot();
  const point=createPickedFacePoint(viewer,record.sample),next=pickedChordFirst&&!pickedChordReport?measurePickedFaceChord(viewer,pickedChordFirst,point):null;
  const first=clone(next?next.first:point),report=clone(next);checkFaceInspectionScope(record.epoch,record.scope);
  pickedChordFirst=first;pickedChordReport=report;renderPickedChordOutput();refreshPickedChord();
  display(report?'Original chord measured from approximate selected parameters.':'First original point selected. Select the second point.');return pickedChordSnapshot();
}
function pickChordAt(point){return adoptPickedChord(readFaceSample(point));}
function remeasurePickedChord(){check(pickedChordReport,'Select two current original points first.');
  const next=measurePickedFaceChord(viewer,pickedChordReport.first,pickedChordReport.second),first=clone(next.first),report=clone(next);
  pickedChordFirst=first;pickedChordReport=report;renderPickedChordOutput();refreshPickedChord();display('Original picked chord measured again.');return clone(next);}
function resetPickedChord(){clearPickedChord();refreshPickedChord();display('Picked chord reset.');}
function hidePickedAngleLabels(){pickedAngleProjections=[null,null,null];for(const label of[...pickedAngleLabels,pickedAngleValueLabel])label.hidden=true;}
function clearPickedAngle(){pickedAngleFirst=null;pickedAngleVertex=null;pickedAngleReport=null;pickedAngleOutput.textContent='Select the first original angle point.';hidePickedAngleLabels();}
function pickedAngleSnapshot(){return{mode:pickedAngleMode.checked,enabled:!pickedAngleMode.disabled,phase:pickedAngleReport?'complete':pickedAngleVertex?'vertex':pickedAngleFirst?'first':'empty',
  first:clone(pickedAngleFirst),vertex:clone(pickedAngleVertex),report:clone(pickedAngleReport),output:pickedAngleOutput.textContent,projections:clone(pickedAngleProjections),
  labels:{first:pickedChordLabelSnapshot(pickedAngleLabels[0]),vertex:pickedChordLabelSnapshot(pickedAngleLabels[1]),third:pickedChordLabelSnapshot(pickedAngleLabels[2]),angle:pickedChordLabelSnapshot(pickedAngleValueLabel)}};}
function refreshPickedAngle(){if(disposed){clearPickedAngle();pickedAngleMode.disabled=true;resetPickedAngleButton.disabled=true;return pickedAngleSnapshot();}
  const state=viewer.getState(),scene=state.qualifiedFaceScene;let current=!!scene;
  try{for(const point of[pickedAngleFirst,pickedAngleVertex,pickedAngleReport?.third??null])if(point)current&&=isPickedFacePointCurrent(viewer,point);}catch{current=false;}
  if(!current)clearPickedAngle();pickedAngleMode.disabled=running||!scene||state.status!=='ready';resetPickedAngleButton.disabled=running||!pickedAngleFirst;
  hidePickedAngleLabels();if(state.status!=='ready'||!pickedAngleFirst)return pickedAngleSnapshot();
  const points=[pickedAngleFirst,pickedAngleVertex,pickedAngleReport?.third??null];
  for(let index=0;index<points.length;index++){const point=points[index];if(!point)continue;
    try{pickedAngleProjections[index]=viewer.projectQualifiedFacePoint(point.input);}catch{pickedAngleProjections[index]=null;}
    const projected=pickedAngleProjections[index],label=pickedAngleLabels[index];if(!projected)continue;
    label.textContent=['1','Vertex','3'][index]+': '+point.input.sourceId+'/'+point.input.geometryId;
    label.style.left=projected.xCss+'px';label.style.top=projected.yCss+'px';label.hidden=false;
  }
  const vertex=pickedAngleProjections[1];if(pickedAngleReport&&vertex){pickedAngleValueLabel.textContent='Approximate angle '+areaNumber(pickedAngleReport.measurement.angleDegrees)+'°';
    pickedAngleValueLabel.style.left=vertex.xCss+'px';pickedAngleValueLabel.style.top=vertex.yCss+'px';pickedAngleValueLabel.hidden=false;}
  return pickedAngleSnapshot();
}
function renderPickedAngleOutput(){pickedAngleOutput.textContent=pickedAngleReport?'Approximate selected angle '+areaNumber(pickedAngleReport.measurement.angleDegrees)+' degrees · '
  +[pickedAngleReport.first.input,pickedAngleReport.vertex.input,pickedAngleReport.third.input].map(input=>input.sourceId+'/'+input.geometryId).join(' → ')
  :pickedAngleVertex?'Original vertex selected. Select the third point.':pickedAngleFirst?'First original angle point selected. Select the vertex.':'Select the first original angle point.';}
function adoptPickedAngle(record){checkFaceInspectionScope(record.epoch,record.scope);refreshPickedAngle();if(record.sample===null)return pickedAngleSnapshot();
  const point=createPickedFacePoint(viewer,record.sample);let first,vertex=null,report=null;
  if(!pickedAngleFirst||pickedAngleReport)first=clone(point);
  else if(!pickedAngleVertex){const leg=measurePickedFaceChord(viewer,pickedAngleFirst,point);
    check(leg.measurement.distanceMM>0,'Picked angle needs a nonzero first-to-vertex leg.');first=clone(leg.first);vertex=clone(leg.second);
  }else{const next=measurePickedFaceAngle(viewer,pickedAngleFirst,pickedAngleVertex,point);first=clone(next.first);vertex=clone(next.vertex);report=clone(next);}
  checkFaceInspectionScope(record.epoch,record.scope);pickedAngleFirst=first;pickedAngleVertex=vertex;pickedAngleReport=report;
  renderPickedAngleOutput();refreshPickedAngle();display(report?'Original angle measured from approximate selected parameters.':vertex?'Original vertex selected. Select the third point.':'First original angle point selected. Select the vertex.');
  return pickedAngleSnapshot();
}
function pickAngleAt(point){return adoptPickedAngle(readFaceSample(point));}
function remeasurePickedAngle(){check(pickedAngleReport,'Select three current original points first.');
  const next=measurePickedFaceAngle(viewer,pickedAngleReport.first,pickedAngleReport.vertex,pickedAngleReport.third),first=clone(next.first),vertex=clone(next.vertex),report=clone(next);
  pickedAngleFirst=first;pickedAngleVertex=vertex;pickedAngleReport=report;renderPickedAngleOutput();refreshPickedAngle();display('Original picked angle measured again.');return clone(next);}
function resetPickedAngle(){clearPickedAngle();refreshPickedAngle();display('Picked angle reset.');}
function hidePickedNormalAngleLabels(){pickedNormalAngleProjections=[null,null];for(const label of[...pickedNormalAngleLabels,pickedNormalAngleValueLabel])label.hidden=true;}
function clearPickedNormalAngle(){pickedNormalAngleFirst=null;pickedNormalAngleReport=null;pickedNormalAngleOutput.textContent='Select the first original normal point.';hidePickedNormalAngleLabels();}
function pickedNormalAngleSnapshot(){return{mode:pickedNormalAngleMode.checked,enabled:!pickedNormalAngleMode.disabled,phase:pickedNormalAngleReport?'complete':pickedNormalAngleFirst?'first':'empty',
  first:clone(pickedNormalAngleFirst),report:clone(pickedNormalAngleReport),output:pickedNormalAngleOutput.textContent,projections:clone(pickedNormalAngleProjections),
  labels:{first:pickedChordLabelSnapshot(pickedNormalAngleLabels[0]),second:pickedChordLabelSnapshot(pickedNormalAngleLabels[1]),angle:pickedChordLabelSnapshot(pickedNormalAngleValueLabel)}};}
function refreshPickedNormalAngle(){if(disposed){clearPickedNormalAngle();pickedNormalAngleMode.disabled=true;resetPickedNormalAngleButton.disabled=true;return pickedNormalAngleSnapshot();}
  const state=viewer.getState(),scene=state.qualifiedFaceScene;let current=!!scene;
  try{for(const point of[pickedNormalAngleFirst,pickedNormalAngleReport?.second??null])if(point)current&&=isPickedFacePointCurrent(viewer,point);}catch{current=false;}
  if(!current)clearPickedNormalAngle();pickedNormalAngleMode.disabled=running||!scene||state.status!=='ready';resetPickedNormalAngleButton.disabled=running||!pickedNormalAngleFirst;
  hidePickedNormalAngleLabels();if(state.status!=='ready'||!pickedNormalAngleFirst)return pickedNormalAngleSnapshot();
  const points=[pickedNormalAngleFirst,pickedNormalAngleReport?.second??null];
  for(let index=0;index<points.length;index++){const point=points[index];if(!point)continue;
    try{pickedNormalAngleProjections[index]=viewer.projectQualifiedFacePoint(point.input);}catch{pickedNormalAngleProjections[index]=null;}
    const projected=pickedNormalAngleProjections[index],label=pickedNormalAngleLabels[index];if(!projected)continue;
    label.textContent=(index+1)+': '+point.input.sourceId+'/'+point.input.geometryId;label.style.left=projected.xCss+'px';label.style.top=projected.yCss+'px';label.hidden=false;
  }
  const first=pickedNormalAngleProjections[0];if(pickedNormalAngleReport&&first){pickedNormalAngleValueLabel.textContent='Approximate normal angle '+areaNumber(pickedNormalAngleReport.measurement.angleDegrees)+'°';
    pickedNormalAngleValueLabel.style.left=first.xCss+'px';pickedNormalAngleValueLabel.style.top=first.yCss+'px';pickedNormalAngleValueLabel.hidden=false;}
  return pickedNormalAngleSnapshot();
}
function renderPickedNormalAngleOutput(){pickedNormalAngleOutput.textContent=pickedNormalAngleReport?'Approximate selected normal angle '+areaNumber(pickedNormalAngleReport.measurement.angleDegrees)+' degrees · '
  +[pickedNormalAngleReport.first.input,pickedNormalAngleReport.second.input].map(input=>input.sourceId+'/'+input.geometryId).join(' ↔ ')
  :pickedNormalAngleFirst?'First original normal point selected. Select the second point.':'Select the first original normal point.';}
function adoptPickedNormalAngle(record){checkFaceInspectionScope(record.epoch,record.scope);refreshPickedNormalAngle();if(record.sample===null)return pickedNormalAngleSnapshot();
  const point=createPickedFacePoint(viewer,record.sample),complete=!!pickedNormalAngleFirst&&!pickedNormalAngleReport;
  const next=measurePickedFaceNormalAngle(viewer,complete?pickedNormalAngleFirst:point,point),first=clone(next.first),report=complete?clone(next):null;
  checkFaceInspectionScope(record.epoch,record.scope);pickedNormalAngleFirst=first;pickedNormalAngleReport=report;
  renderPickedNormalAngleOutput();refreshPickedNormalAngle();display(report?'Original normal angle measured from approximate selected parameters.':'First original normal point selected. Select the second point.');return pickedNormalAngleSnapshot();
}
function pickNormalAngleAt(point){return adoptPickedNormalAngle(readFaceSample(point));}
function remeasurePickedNormalAngle(){check(pickedNormalAngleReport,'Select two current original normal points first.');
  const next=measurePickedFaceNormalAngle(viewer,pickedNormalAngleReport.first,pickedNormalAngleReport.second),first=clone(next.first),report=clone(next);
  pickedNormalAngleFirst=first;pickedNormalAngleReport=report;renderPickedNormalAngleOutput();refreshPickedNormalAngle();display('Original picked normal angle measured again.');return clone(next);}
function resetPickedNormalAngle(){clearPickedNormalAngle();refreshPickedNormalAngle();display('Picked normal angle reset.');}
function clearTreeSelection(){qualifiedTreeSelected=null;qualifiedTreeReport=null;treePointProjection=null;treeProperties.textContent='';treePointOutput.textContent='';
  clearTreeCurveLength();measureTreeLengthButton.disabled=true;resetTreeLengthButton.disabled=true;
  clearTreeSurfaceArea();inspectTreeAreaButton.disabled=true;resetTreeAreaButton.disabled=true;
  clearTreeCurveCurvature();inspectTreeCurvatureButton.disabled=true;resetTreeCurvatureButton.disabled=true;
  clearTreeSurfaceCurvature();inspectTreeSurfaceCurvatureButton.disabled=true;resetTreeSurfaceCurvatureButton.disabled=true;
  qualifiedTreeSelectedHidden=false;applyTreeColorButton.disabled=true;treeColorTarget.textContent='Select an original Surface or Curve for its parent Face color.';
  treeU.value='';treeV.value='';treeT.value='';treePointLabel.hidden=true;
  for(const input of[treeU,treeV,treeT,inspectTreePointButton,frameTreeFaceButton,clearTreeSelectionButton])input.disabled=true;
  for(const id of['tree-u-label','tree-v-label','tree-t-label'])document.querySelector('#'+id).hidden=true;markQualifiedTreeSelection();}
function markQualifiedTreeSelection(){for(const node of treeNodeButtons){const selected=!!qualifiedTreeSelected&&same(node.ref,qualifiedTreeSelected.ref);
  node.button.dataset.treeSelected=String(selected);node.button.setAttribute('aria-pressed',String(selected));}}
function qualifiedTreeSnapshot(){return{tree:clone(qualifiedTreeData),selected:clone(qualifiedTreeSelected),report:clone(qualifiedTreeReport),
  filter:clone(qualifiedTreeFilter),filtered:clone(qualifiedTreeFiltered),selectedHidden:qualifiedTreeSelectedHidden,
  parameters:{u:treeU.value,v:treeV.value,t:treeT.value},output:treePointOutput.textContent,projection:clone(treePointProjection),label:pickedChordLabelSnapshot(treePointLabel),
  enabled:!inspectTreePointButton.disabled,frameEnabled:!frameTreeFaceButton.disabled};}
function clearQualifiedTree(){if(qualifiedTreeData||qualifiedTreeContent)treeGeneration++;qualifiedTreeContent=null;qualifiedTreeData=null;treeNodeButtons=[];
  qualifiedTreeFilter={query:'',sourceId:null,kind:'all'};qualifiedTreeFiltered=null;treeFilterStatus.textContent='';restoreQualifiedTreeFilterControls();
  qualifiedTreeElement.replaceChildren();clearTreeSelection();clearTreeTangentAngle();captureTreeTangentButton.disabled=true;resetTreeTangentAngleButton.disabled=true;
  clearTreeNormalAngle();captureTreeNormalButton.disabled=true;resetTreeNormalAngleButton.disabled=true;}
function restoreQualifiedTreeFilterControls(){for(const[input,value]of[[treeFilterQuery,qualifiedTreeFilter.query],[treeFilterSource,qualifiedTreeFilter.sourceId??''],[treeFilterKind,qualifiedTreeFilter.kind]])if(input.value!==value)input.value=value;}
function qualifiedTreeNodeVisible(ref){return !!qualifiedTreeFiltered?.sources.some(source=>source.geometries.some(geometry=>same(geometry.ref,ref)));}
function setQualifiedTreeFilter(input){let next;try{next=filterQualifiedFaceTree(viewer,input);}catch(error){restoreQualifiedTreeFilterControls();throw error;}
  if(!next){clearQualifiedTree();refreshQualifiedTree();return qualifiedTreeSnapshot();}
  const generation=treeGeneration;qualifiedTreeFilter=clone(next.filter);qualifiedTreeFiltered=clone(next);refreshQualifiedTree();
  if(generation===treeGeneration){treeGeneration++;buildQualifiedTreeDom(qualifiedTreeFiltered);}
  const selected=treeNodeButtons.find(node=>qualifiedTreeSelected&&same(node.ref,qualifiedTreeSelected.ref));if(selected){selected.sourceGroup.open=true;selected.faceGroup.open=true;}
  refreshQualifiedTree();display('Original tree filters applied.');return qualifiedTreeSnapshot();}
function clearQualifiedTreeFilter(){return setQualifiedTreeFilter({query:'',sourceId:null,kind:'all'});}
function buildQualifiedTreeDom(tree){const openGroups=new Set([...qualifiedTreeElement.querySelectorAll('details[open]')].map(group=>group.dataset.treeGroup+':'+group.dataset.sourceId));
  const focusedRef=treeButtonRefs.get(document.activeElement),focusedGroup=document.activeElement?.tagName==='SUMMARY'?document.activeElement.parentElement:null,
    focusedGroupKey=focusedGroup?.dataset.treeGroup?focusedGroup.dataset.treeGroup+':'+focusedGroup.dataset.sourceId:null,generation=treeGeneration;treeNodeButtons=[];
  const groups=(tree?.sources??[]).map(source=>{const sourceGroup=document.createElement('details'),sourceTitle=document.createElement('summary'),faceGroup=document.createElement('details'),faceTitle=document.createElement('summary'),geometryGroup=document.createElement('div');
    sourceGroup.dataset.treeGroup='source';sourceGroup.dataset.sourceId=source.sourceId;sourceTitle.textContent='Source '+source.sourceId;
    faceGroup.dataset.treeGroup='face';faceGroup.dataset.sourceId=source.sourceId;faceTitle.textContent='Face '+source.faceId+' · Model '+source.modelId;
    sourceGroup.open=openGroups.has('source:'+source.sourceId);faceGroup.open=openGroups.has('face:'+source.sourceId);
    for(const geometry of source.geometries){const button=document.createElement('button'),ref=clone(geometry.ref);
      button.textContent=ref.sourceId+' · '+ref.kind+' · '+ref.geometryId;button.setAttribute('aria-label','Inspect original tree geometry '+ref.sourceId+' '+ref.kind+' '+ref.geometryId);
      button.dataset.sourceId=ref.sourceId;button.dataset.kind=ref.kind;button.dataset.geometryId=ref.geometryId;treeButtonRefs.set(button,clone(ref));
      button.addEventListener('click',()=>action(()=>{refreshQualifiedTree();check(button.isConnected&&generation===treeGeneration,'This original geometry tree node is stale.');
        check(qualifiedTreeNodeVisible(ref),'This original geometry tree node is outside the current filter.');
        queryQualifiedFaceTreeNode(viewer,ref);selectQualifiedTreeNode(ref);}));
      treeNodeButtons.push({button,ref,sourceGroup,faceGroup});geometryGroup.append(button);
    }
    faceGroup.append(faceTitle,geometryGroup);sourceGroup.append(sourceTitle,faceGroup);return sourceGroup;
  });qualifiedTreeElement.replaceChildren(...groups);markQualifiedTreeSelection();
  if(focusedRef){const focused=treeNodeButtons.find(node=>same(node.ref,focusedRef));if(focused){focused.sourceGroup.open=true;focused.faceGroup.open=true;focused.button.focus({preventScroll:true});}}
  else if(focusedGroupKey){const group=[...qualifiedTreeElement.querySelectorAll('details')].find(value=>value.dataset.treeGroup+':'+value.dataset.sourceId===focusedGroupKey);group?.querySelector('summary').focus({preventScroll:true});}
}
function treePointInput(){const ref=qualifiedTreeReport.node.ref,parameters=qualifiedTreeReport.parameters;
  return{kind:ref.kind,sourceId:ref.sourceId,expectedSource:ref.expectedSource,faceId:ref.faceId,modelId:ref.modelId,geometryId:ref.geometryId,
    ...(ref.kind==='surface'?{u:parameters.u,v:parameters.v}:{t:parameters.t})};}
function updateTreePointLabel(){treePointProjection=null;treePointLabel.hidden=true;if(disposed||qualifiedTreeSelectedHidden||!qualifiedTreeReport||viewer.getState().status!=='ready')return;
  try{treePointProjection=viewer.projectQualifiedFacePoint(treePointInput());}catch{}
  if(treePointProjection){const ref=qualifiedTreeReport.node.ref;treePointLabel.textContent=ref.sourceId+'/'+ref.geometryId+' · original point';
    treePointLabel.style.left=treePointProjection.xCss+'px';treePointLabel.style.top=treePointProjection.yCss+'px';treePointLabel.hidden=false;}}
function clearTreeCurveLength(){treeCurveLengthReport=null;treeCurveLengthProjection=null;treeLengthOutput.textContent='';treeLengthLabel.hidden=true;}
function treeCurveLengthSnapshot(){return{report:clone(treeCurveLengthReport),output:treeLengthOutput.textContent,enabled:!measureTreeLengthButton.disabled,
  projection:clone(treeCurveLengthProjection),label:pickedChordLabelSnapshot(treeLengthLabel)};}
function refreshTreeCurveLength(){const state=disposed?null:viewer.getState();
  if(treeCurveLengthReport&&(!qualifiedTreeSelected||!same(treeCurveLengthReport.node.ref,qualifiedTreeSelected.ref)))clearTreeCurveLength();
  measureTreeLengthButton.disabled=disposed||running||!state?.qualifiedFaceScene||qualifiedTreeSelected?.ref.kind!=='curve';
  resetTreeLengthButton.disabled=disposed||running||!treeCurveLengthReport;
  treeCurveLengthProjection=null;treeLengthLabel.hidden=true;if(disposed||qualifiedTreeSelectedHidden||!treeCurveLengthReport||state.status!=='ready')return;
  try{treeCurveLengthProjection=viewer.projectQualifiedFacePoint(treeCurveLengthReport.measurement.anchor);}catch{}
  if(treeCurveLengthProjection){const ref=treeCurveLengthReport.node.ref;
    treeLengthLabel.textContent=ref.sourceId+'/'+ref.geometryId+' · length estimate '+areaNumber(treeCurveLengthReport.measurement.length.estimatedLengthMM)+' mm';
    treeLengthLabel.style.left=treeCurveLengthProjection.xCss+'px';treeLengthLabel.style.top=treeCurveLengthProjection.yCss+'px';treeLengthLabel.hidden=false;}}
function measureTreeCurveLength(options=LENGTH_OPTIONS){refreshQualifiedTree();check(!measureTreeLengthButton.disabled&&qualifiedTreeSelected,'Select a current original Curve first.');
  const ref=clone(qualifiedTreeSelected.ref),next=queryQualifiedTreeCurveLength(viewer,ref,options),current=queryQualifiedFaceTreeNode(viewer,ref);
  check(qualifiedTreeSelected&&same(qualifiedTreeSelected.ref,current.ref)&&same(ref,current.ref),'The original Curve selection changed during length inspection.');
  const report=clone(next);treeCurveLengthReport=report;
  treeLengthOutput.textContent=report.node.ref.sourceId+'/'+report.node.ref.geometryId+' · Curve length estimate '+areaNumber(report.measurement.length.estimatedLengthMM)
    +' mm · endpoint chord '+areaNumber(report.measurement.chordMM)+' mm';
  refreshQualifiedTree();display('Original tree Curve length ready for '+ref.sourceId+'/'+ref.geometryId+'.');return clone(report);}
function resetTreeCurveLength(){clearTreeCurveLength();refreshQualifiedTree();display('Tree Curve length reset.');}
function clearTreeSurfaceArea(){treeSurfaceAreaReport=null;treeSurfaceAreaProjection=null;treeAreaOutput.textContent='';treeAreaLabel.hidden=true;}
function treeSurfaceAreaSnapshot(){return{report:clone(treeSurfaceAreaReport),output:treeAreaOutput.textContent,enabled:!inspectTreeAreaButton.disabled,
  projection:clone(treeSurfaceAreaProjection),label:pickedChordLabelSnapshot(treeAreaLabel)};}
function refreshTreeSurfaceArea(){const state=disposed?null:viewer.getState();
  if(treeSurfaceAreaReport&&(!qualifiedTreeSelected||!same(treeSurfaceAreaReport.node.ref,qualifiedTreeSelected.ref)))clearTreeSurfaceArea();
  inspectTreeAreaButton.disabled=disposed||running||!state?.qualifiedFaceScene||qualifiedTreeSelected?.ref.kind!=='surface';
  resetTreeAreaButton.disabled=disposed||running||!treeSurfaceAreaReport;
  treeSurfaceAreaProjection=null;treeAreaLabel.hidden=true;if(disposed||qualifiedTreeSelectedHidden||!treeSurfaceAreaReport||state.status!=='ready')return;
  try{treeSurfaceAreaProjection=viewer.projectQualifiedFacePoint(treeSurfaceAreaReport.measurement.anchor);}catch{}
  if(treeSurfaceAreaProjection){const ref=treeSurfaceAreaReport.node.ref;
    treeAreaLabel.textContent=ref.sourceId+'/'+ref.geometryId+' · area estimate '+areaNumber(treeSurfaceAreaReport.measurement.area.areaEstimateMM2)+' mm²';
    treeAreaLabel.style.left=treeSurfaceAreaProjection.xCss+'px';treeAreaLabel.style.top=treeSurfaceAreaProjection.yCss+'px';treeAreaLabel.hidden=false;}}
function inspectTreeSurfaceArea(options=AREA_OPTIONS){refreshQualifiedTree();check(!inspectTreeAreaButton.disabled&&qualifiedTreeSelected,'Select a current original Surface first.');
  const ref=clone(qualifiedTreeSelected.ref),before=queryQualifiedFaceTreeNode(viewer,ref);check(before.ref.kind==='surface','Select a current original Surface first.');
  const next=queryQualifiedTreeSurfaceArea(viewer,ref,options),current=queryQualifiedFaceTreeNode(viewer,ref);
  check(qualifiedTreeSelected&&same(qualifiedTreeSelected.ref,current.ref)&&same(ref,current.ref),'The original Surface selection changed during area inspection.');
  const report=clone(next);treeSurfaceAreaReport=report;
  treeAreaOutput.textContent=report.node.ref.sourceId+'/'+report.node.ref.geometryId+' · Surface area estimate '+areaNumber(report.measurement.area.areaEstimateMM2)
    +' mm² · heuristic error estimate '+areaNumber(report.measurement.area.errorEstimateMM2)+' mm²';
  refreshQualifiedTree();display('Original tree Surface area ready for '+ref.sourceId+'/'+ref.geometryId+'.');return clone(report);}
function resetTreeSurfaceArea(){clearTreeSurfaceArea();refreshQualifiedTree();display('Tree Surface area reset.');}
function clearTreeCurveCurvature(){treeCurveCurvatureReport=null;treeCurveCurvatureProjection=null;treeCurvatureOutput.textContent='';treeCurvatureLabel.hidden=true;}
function treeCurveCurvatureSnapshot(){return{report:clone(treeCurveCurvatureReport),output:treeCurvatureOutput.textContent,enabled:!inspectTreeCurvatureButton.disabled,
  projection:clone(treeCurveCurvatureProjection),label:pickedChordLabelSnapshot(treeCurvatureLabel)};}
function refreshTreeCurveCurvature(){const state=disposed?null:viewer.getState();
  if(treeCurveCurvatureReport&&(!qualifiedTreeSelected||!same(treeCurveCurvatureReport.node.ref,qualifiedTreeSelected.ref)))clearTreeCurveCurvature();
  inspectTreeCurvatureButton.disabled=disposed||running||!state?.qualifiedFaceScene||qualifiedTreeSelected?.ref.kind!=='curve';
  resetTreeCurvatureButton.disabled=disposed||running||!treeCurveCurvatureReport;
  treeCurveCurvatureProjection=null;treeCurvatureLabel.hidden=true;if(disposed||qualifiedTreeSelectedHidden||!treeCurveCurvatureReport||state.status!=='ready')return;
  try{treeCurveCurvatureProjection=viewer.projectQualifiedFacePoint(treeCurveCurvatureReport.measurement.anchor);}catch{}
  if(treeCurveCurvatureProjection){const ref=treeCurveCurvatureReport.node.ref,radius=treeCurveCurvatureReport.measurement.curvature.radiusMM;
    treeCurvatureLabel.textContent=ref.sourceId+'/'+ref.geometryId+' · '+(radius===null?'straight · no finite radius':'local radius '+areaNumber(radius)+' mm');
    treeCurvatureLabel.style.left=treeCurveCurvatureProjection.xCss+'px';treeCurvatureLabel.style.top=treeCurveCurvatureProjection.yCss+'px';treeCurvatureLabel.hidden=false;}}
function inspectTreeCurveCurvature(t){refreshQualifiedTree();check(!inspectTreeCurvatureButton.disabled&&qualifiedTreeSelected,'Select a current original Curve first.');
  const ref=clone(qualifiedTreeSelected.ref),before=queryQualifiedFaceTreeNode(viewer,ref);check(before.ref.kind==='curve','Select a current original Curve first.');
  if(arguments.length===0)t=treeControlParameters().t;
  const next=queryQualifiedTreeCurveCurvature(viewer,ref,t),current=queryQualifiedFaceTreeNode(viewer,ref);
  check(qualifiedTreeSelected&&same(qualifiedTreeSelected.ref,current.ref)&&same(ref,current.ref),'The original Curve selection changed during curvature inspection.');
  const report=clone(next);treeCurveCurvatureReport=report;const curvature=report.measurement.curvature;
  treeCurvatureOutput.textContent=ref.sourceId+'/'+ref.geometryId+' · t '+areaNumber(report.measurement.pin.t)+' · '
    +(curvature.radiusMM===null?'regular straight point · no finite radius · curvature 0 1/mm'
      :'local radius '+areaNumber(curvature.radiusMM)+' mm · curvature '+areaNumber(curvature.curvaturePerMM)+' 1/mm');
  refreshQualifiedTree();display('Original tree Curve curvature ready for '+ref.sourceId+'/'+ref.geometryId+'.');return clone(report);}
function resetTreeCurveCurvature(){clearTreeCurveCurvature();refreshQualifiedTree();display('Tree Curve curvature reset.');}
function clearTreeSurfaceCurvature(){treeSurfaceCurvatureReport=null;treeSurfaceCurvatureProjection=null;treeSurfaceCurvatureOutput.textContent='';treeSurfaceCurvatureLabel.hidden=true;}
function treeSurfaceCurvatureSnapshot(){return{report:clone(treeSurfaceCurvatureReport),output:treeSurfaceCurvatureOutput.textContent,enabled:!inspectTreeSurfaceCurvatureButton.disabled,
  projection:clone(treeSurfaceCurvatureProjection),label:pickedChordLabelSnapshot(treeSurfaceCurvatureLabel)};}
function refreshTreeSurfaceCurvature(){const state=disposed?null:viewer.getState();
  if(treeSurfaceCurvatureReport&&(!qualifiedTreeSelected||!same(treeSurfaceCurvatureReport.node.ref,qualifiedTreeSelected.ref)))clearTreeSurfaceCurvature();
  inspectTreeSurfaceCurvatureButton.disabled=disposed||running||!state?.qualifiedFaceScene||qualifiedTreeSelected?.ref.kind!=='surface';
  resetTreeSurfaceCurvatureButton.disabled=disposed||running||!treeSurfaceCurvatureReport;
  treeSurfaceCurvatureProjection=null;treeSurfaceCurvatureLabel.hidden=true;if(disposed||qualifiedTreeSelectedHidden||!treeSurfaceCurvatureReport||state.status!=='ready')return;
  try{treeSurfaceCurvatureProjection=viewer.projectQualifiedFacePoint(treeSurfaceCurvatureReport.measurement.anchor);}catch{}
  if(treeSurfaceCurvatureProjection){const ref=treeSurfaceCurvatureReport.node.ref;
    treeSurfaceCurvatureLabel.textContent=ref.sourceId+'/'+ref.geometryId+' · H '+signedCurvature(treeSurfaceCurvatureReport.measurement.curvature.meanCurvaturePerMM)+' 1/mm';
    treeSurfaceCurvatureLabel.style.left=treeSurfaceCurvatureProjection.xCss+'px';treeSurfaceCurvatureLabel.style.top=treeSurfaceCurvatureProjection.yCss+'px';treeSurfaceCurvatureLabel.hidden=false;}}
function inspectTreeSurfaceCurvature(u,v){refreshQualifiedTree();check(!inspectTreeSurfaceCurvatureButton.disabled&&qualifiedTreeSelected,'Select a current original Surface first.');
  const ref=clone(qualifiedTreeSelected.ref),before=queryQualifiedFaceTreeNode(viewer,ref);check(before.ref.kind==='surface','Select a current original Surface first.');
  if(arguments.length===0){const parameters=treeControlParameters();u=parameters.u;v=parameters.v;}
  const next=queryQualifiedTreeSurfaceCurvature(viewer,ref,u,v),current=queryQualifiedFaceTreeNode(viewer,ref);
  check(qualifiedTreeSelected&&same(qualifiedTreeSelected.ref,current.ref)&&same(ref,current.ref),'The original Surface selection changed during curvature inspection.');
  const report=clone(next);treeSurfaceCurvatureReport=report;const measurement=report.measurement,curvature=measurement.curvature;
  treeSurfaceCurvatureOutput.textContent=ref.sourceId+'/'+ref.geometryId+' · u '+areaNumber(measurement.pin.u)+', v '+areaNumber(measurement.pin.v)
    +' · H '+signedCurvature(curvature.meanCurvaturePerMM)+' 1/mm · K '+signedCurvature(curvature.gaussianCurvaturePerMM2)+' 1/mm²'
    +' · k1 '+signedCurvature(curvature.principalCurvaturesPerMM[0])+', k2 '+signedCurvature(curvature.principalCurvaturesPerMM[1])+' 1/mm';
  refreshQualifiedTree();display('Original tree Surface curvature ready for '+ref.sourceId+'/'+ref.geometryId+'.');return clone(report);}
function resetTreeSurfaceCurvature(){clearTreeSurfaceCurvature();refreshQualifiedTree();display('Tree Surface curvature reset.');}
function hideTreeTangentLabels(){treeTangentProjections={first:null,second:null,angle:null};for(const label of Object.values(treeTangentLabels))label.hidden=true;}
function clearTreeTangentAngle(){treeTangentFirstCapture=null;treeTangentAngleReport=null;treeTangentHidden={first:false,second:false};treeTangentAngleOutput.textContent='';hideTreeTangentLabels();}
function treeTangentAngleSnapshot(){return{phase:treeTangentAngleReport?'complete':treeTangentFirstCapture?'first':'empty',first:clone(treeTangentFirstCapture),report:clone(treeTangentAngleReport),
  output:treeTangentAngleOutput.textContent,enabled:!captureTreeTangentButton.disabled,projections:clone(treeTangentProjections),
  labels:Object.fromEntries(Object.entries(treeTangentLabels).map(([side,label])=>[side,pickedChordLabelSnapshot(label)])),hidden:clone(treeTangentHidden)};}
function treeTangentPin(node,t){const ref=node.ref;return{kind:'curve',sourceId:ref.sourceId,expectedSource:ref.expectedSource,faceId:ref.faceId,modelId:ref.modelId,geometryId:ref.geometryId,t};}
function treeTangentCapture(candidate){const native=candidate.measurement.first;return clone({node:candidate.first.node,t:candidate.first.t,
  derivatives:native.derivatives,tangentNormMM:native.tangentNormMM,unitTangent:native.unitTangent});}
function treeTangentDescription(node,t){return node.ref.sourceId+'/'+node.ref.geometryId+' at t '+areaNumber(t);}
function renderTreeTangentOutput(){const first=treeTangentFirstCapture,second=treeTangentAngleReport?.second;
  treeTangentAngleOutput.textContent=treeTangentAngleReport?treeTangentDescription(first.node,first.t)+' ↔ '+treeTangentDescription(second.node,second.t)+' · '+areaNumber(treeTangentAngleReport.measurement.angleDegrees)+'°'
    :first?'First tangent '+treeTangentDescription(first.node,first.t)+'. Select a Curve for the second tangent.':'';
  if(first&&treeTangentHidden.first)treeTangentAngleOutput.textContent+=' First '+first.node.ref.sourceId+'/'+first.node.ref.geometryId+' is outside the filter.';
  if(second&&treeTangentHidden.second)treeTangentAngleOutput.textContent+=' Second '+second.node.ref.sourceId+'/'+second.node.ref.geometryId+' is outside the filter.';}
function refreshTreeTangentAngle(){if(disposed){clearTreeTangentAngle();captureTreeTangentButton.disabled=true;resetTreeTangentAngleButton.disabled=true;return treeTangentAngleSnapshot();}
  const state=viewer.getState();let current=!!state.qualifiedFaceScene;
  try{for(const node of[treeTangentFirstCapture?.node,treeTangentAngleReport?.second.node])if(node)queryQualifiedFaceTreeNode(viewer,node.ref);}catch{current=false;}
  if(!current)clearTreeTangentAngle();captureTreeTangentButton.disabled=running||!state.qualifiedFaceScene||qualifiedTreeSelected?.ref.kind!=='curve';
  resetTreeTangentAngleButton.disabled=running||!treeTangentFirstCapture;
  const first=treeTangentFirstCapture,second=treeTangentAngleReport?.second;
  treeTangentHidden={first:!!first&&!qualifiedTreeNodeVisible(first.node.ref),second:!!second&&!qualifiedTreeNodeVisible(second.node.ref)};
  renderTreeTangentOutput();hideTreeTangentLabels();if(state.status!=='ready'||!first)return treeTangentAngleSnapshot();
  for(const[side,capture]of[['first',first],['second',second]]){if(!capture||treeTangentHidden[side])continue;
    try{treeTangentProjections[side]=viewer.projectQualifiedFacePoint(treeTangentPin(capture.node,capture.t));}catch{}
    const projection=treeTangentProjections[side],label=treeTangentLabels[side];if(!projection)continue;
    label.textContent=(side==='first'?'1: ':'2: ')+capture.node.ref.sourceId+'/'+capture.node.ref.geometryId;
    label.style.left=projection.xCss+'px';label.style.top=projection.yCss+'px';label.hidden=false;}
  if(treeTangentAngleReport&&treeTangentProjections.first){const projection=treeTangentProjections.first;treeTangentProjections.angle=clone(projection);
    treeTangentLabels.angle.textContent=areaNumber(treeTangentAngleReport.measurement.angleDegrees)+'°';treeTangentLabels.angle.style.left=projection.xCss+'px';
    treeTangentLabels.angle.style.top=(projection.yCss+18)+'px';treeTangentLabels.angle.hidden=false;}
  return treeTangentAngleSnapshot();}
function captureTreeTangent(t){refreshQualifiedTree();check(!captureTreeTangentButton.disabled&&qualifiedTreeSelected,'Select a current original Curve first.');
  const selected=clone(qualifiedTreeSelected.ref),current=queryQualifiedFaceTreeNode(viewer,selected);check(current.ref.kind==='curve','Select a current original Curve first.');
  if(arguments.length===0)t=treeControlParameters().t;
  const priorFirst=clone(treeTangentFirstCapture),priorReport=clone(treeTangentAngleReport),pair=!!priorFirst&&!priorReport;
  if(priorFirst)queryQualifiedFaceTreeNode(viewer,priorFirst.node.ref);
  const firstRef=pair?priorFirst.node.ref:selected,firstT=pair?priorFirst.t:t,next=queryQualifiedTreeTangentAngle(viewer,firstRef,firstT,selected,t);
  const firstCurrent=queryQualifiedFaceTreeNode(viewer,firstRef),secondCurrent=queryQualifiedFaceTreeNode(viewer,selected);
  check(qualifiedTreeSelected&&same(selected,qualifiedTreeSelected.ref)&&same(selected,secondCurrent.ref)&&same(firstRef,firstCurrent.ref)
    &&same(priorFirst,treeTangentFirstCapture)&&same(priorReport,treeTangentAngleReport),'The original tangent capture changed during inspection.');
  if(priorFirst)queryQualifiedFaceTreeNode(viewer,priorFirst.node.ref);
  const first=treeTangentCapture(next),report=pair?clone(next):null;treeTangentFirstCapture=first;treeTangentAngleReport=report;
  refreshQualifiedTree();display(report?'Original tree tangent angle ready.':'First original tree tangent captured. Select the second Curve.');return treeTangentAngleSnapshot();}
function remeasureTreeTangentAngle(){refreshQualifiedTree();check(!disposed&&!running&&treeTangentAngleReport,'Capture two current original Curve tangents first.');
  const priorFirst=clone(treeTangentFirstCapture),priorReport=clone(treeTangentAngleReport),first=priorReport.first,second=priorReport.second;
  const next=queryQualifiedTreeTangentAngle(viewer,first.node.ref,first.t,second.node.ref,second.t);
  queryQualifiedFaceTreeNode(viewer,first.node.ref);queryQualifiedFaceTreeNode(viewer,second.node.ref);
  check(same(priorFirst,treeTangentFirstCapture)&&same(priorReport,treeTangentAngleReport),'The original tangent pair changed during inspection.');
  const capture=treeTangentCapture(next),report=clone(next);treeTangentFirstCapture=capture;treeTangentAngleReport=report;
  refreshQualifiedTree();display('Original tree tangent angle measured again.');return clone(report);}
function resetTreeTangentAngle(){clearTreeTangentAngle();refreshQualifiedTree();display('Tree tangent angle reset.');}
function hideTreeNormalLabels(){treeNormalProjections={first:null,second:null,angle:null};for(const label of Object.values(treeNormalLabels))label.hidden=true;}
function clearTreeNormalAngle(){treeNormalFirstCapture=null;treeNormalAngleReport=null;treeNormalHidden={first:false,second:false};treeNormalAngleOutput.textContent='';hideTreeNormalLabels();}
function treeNormalAngleSnapshot(){return{phase:treeNormalAngleReport?'complete':treeNormalFirstCapture?'first':'empty',first:clone(treeNormalFirstCapture),report:clone(treeNormalAngleReport),
  output:treeNormalAngleOutput.textContent,enabled:!captureTreeNormalButton.disabled,projections:clone(treeNormalProjections),
  labels:Object.fromEntries(Object.entries(treeNormalLabels).map(([side,label])=>[side,pickedChordLabelSnapshot(label)])),hidden:clone(treeNormalHidden)};}
function treeNormalPin(node,u,v){const ref=node.ref;return{kind:'surface',sourceId:ref.sourceId,expectedSource:ref.expectedSource,faceId:ref.faceId,modelId:ref.modelId,geometryId:ref.geometryId,u,v};}
function treeNormalCapture(candidate){const native=candidate.measurement.first;return clone({node:candidate.first.node,u:candidate.first.u,v:candidate.first.v,
  derivatives:native.derivatives,duNormMM:native.duNormMM,dvNormMM:native.dvNormMM,unitDu:native.unitDu,unitDv:native.unitDv,
  parameterCross:native.parameterCross,crossNorm:native.crossNorm,unitNormal:native.unitNormal});}
function treeNormalDescription(node,u,v){return node.ref.sourceId+'/'+node.ref.geometryId+' at u '+areaNumber(u)+', v '+areaNumber(v);}
function renderTreeNormalOutput(){const first=treeNormalFirstCapture,second=treeNormalAngleReport?.second;
  treeNormalAngleOutput.textContent=treeNormalAngleReport?treeNormalDescription(first.node,first.u,first.v)+' ↔ '+treeNormalDescription(second.node,second.u,second.v)+' · '+areaNumber(treeNormalAngleReport.measurement.angleDegrees)+'°'
    :first?'First normal '+treeNormalDescription(first.node,first.u,first.v)+'. Select a Surface for the second normal.':'';
  if(first&&treeNormalHidden.first)treeNormalAngleOutput.textContent+=' First '+first.node.ref.sourceId+'/'+first.node.ref.geometryId+' is outside the filter.';
  if(second&&treeNormalHidden.second)treeNormalAngleOutput.textContent+=' Second '+second.node.ref.sourceId+'/'+second.node.ref.geometryId+' is outside the filter.';}
function refreshTreeNormalAngle(){if(disposed){clearTreeNormalAngle();captureTreeNormalButton.disabled=true;resetTreeNormalAngleButton.disabled=true;return treeNormalAngleSnapshot();}
  const state=viewer.getState();let current=!!state.qualifiedFaceScene;
  try{for(const node of[treeNormalFirstCapture?.node,treeNormalAngleReport?.second.node])if(node)queryQualifiedFaceTreeNode(viewer,node.ref);}catch{current=false;}
  if(!current)clearTreeNormalAngle();captureTreeNormalButton.disabled=running||!state.qualifiedFaceScene||qualifiedTreeSelected?.ref.kind!=='surface';
  resetTreeNormalAngleButton.disabled=running||!treeNormalFirstCapture;
  const first=treeNormalFirstCapture,second=treeNormalAngleReport?.second;
  treeNormalHidden={first:!!first&&!qualifiedTreeNodeVisible(first.node.ref),second:!!second&&!qualifiedTreeNodeVisible(second.node.ref)};
  renderTreeNormalOutput();hideTreeNormalLabels();if(state.status!=='ready'||!first)return treeNormalAngleSnapshot();
  for(const[side,capture]of[['first',first],['second',second]]){if(!capture||treeNormalHidden[side])continue;
    try{treeNormalProjections[side]=viewer.projectQualifiedFacePoint(treeNormalPin(capture.node,capture.u,capture.v));}catch{}
    const projection=treeNormalProjections[side],label=treeNormalLabels[side];if(!projection)continue;
    label.textContent=(side==='first'?'1: ':'2: ')+capture.node.ref.sourceId+'/'+capture.node.ref.geometryId;
    label.style.left=projection.xCss+'px';label.style.top=projection.yCss+'px';label.hidden=false;}
  if(treeNormalAngleReport&&treeNormalProjections.first){const projection=treeNormalProjections.first;treeNormalProjections.angle=clone(projection);
    treeNormalLabels.angle.textContent=areaNumber(treeNormalAngleReport.measurement.angleDegrees)+'°';treeNormalLabels.angle.style.left=projection.xCss+'px';
    treeNormalLabels.angle.style.top=(projection.yCss+18)+'px';treeNormalLabels.angle.hidden=false;}
  return treeNormalAngleSnapshot();}
function captureTreeNormal(u,v){refreshQualifiedTree();check(!captureTreeNormalButton.disabled&&qualifiedTreeSelected,'Select a current original Surface first.');
  const selected=clone(qualifiedTreeSelected.ref),current=queryQualifiedFaceTreeNode(viewer,selected);check(current.ref.kind==='surface','Select a current original Surface first.');
  if(arguments.length===0){const parameters=treeControlParameters();u=parameters.u;v=parameters.v;}
  const priorFirst=clone(treeNormalFirstCapture),priorReport=clone(treeNormalAngleReport),pair=!!priorFirst&&!priorReport;
  if(priorFirst)queryQualifiedFaceTreeNode(viewer,priorFirst.node.ref);
  const firstRef=pair?priorFirst.node.ref:selected,firstU=pair?priorFirst.u:u,firstV=pair?priorFirst.v:v;
  const next=queryQualifiedTreeNormalAngle(viewer,firstRef,firstU,firstV,selected,u,v),firstCurrent=queryQualifiedFaceTreeNode(viewer,firstRef),secondCurrent=queryQualifiedFaceTreeNode(viewer,selected);
  check(qualifiedTreeSelected&&same(selected,qualifiedTreeSelected.ref)&&same(selected,secondCurrent.ref)&&same(firstRef,firstCurrent.ref)
    &&same(priorFirst,treeNormalFirstCapture)&&same(priorReport,treeNormalAngleReport),'The original normal capture changed during inspection.');
  if(priorFirst)queryQualifiedFaceTreeNode(viewer,priorFirst.node.ref);
  const first=treeNormalCapture(next),report=pair?clone(next):null;treeNormalFirstCapture=first;treeNormalAngleReport=report;
  refreshQualifiedTree();display(report?'Original tree normal angle ready.':'First original tree normal captured. Select the second Surface.');return treeNormalAngleSnapshot();}
function remeasureTreeNormalAngle(){refreshQualifiedTree();check(!disposed&&!running&&treeNormalAngleReport,'Capture two current original Surface normals first.');
  const priorFirst=clone(treeNormalFirstCapture),priorReport=clone(treeNormalAngleReport),first=priorReport.first,second=priorReport.second;
  const next=queryQualifiedTreeNormalAngle(viewer,first.node.ref,first.u,first.v,second.node.ref,second.u,second.v);
  queryQualifiedFaceTreeNode(viewer,first.node.ref);queryQualifiedFaceTreeNode(viewer,second.node.ref);
  check(same(priorFirst,treeNormalFirstCapture)&&same(priorReport,treeNormalAngleReport),'The original normal pair changed during inspection.');
  const capture=treeNormalCapture(next),report=clone(next);treeNormalFirstCapture=capture;treeNormalAngleReport=report;
  refreshQualifiedTree();display('Original tree normal angle measured again.');return clone(report);}
function resetTreeNormalAngle(){clearTreeNormalAngle();refreshQualifiedTree();display('Tree normal angle reset.');}
function refreshQualifiedTree(){if(disposed){clearQualifiedTree();for(const input of[treeU,treeV,treeT,inspectTreePointButton,frameTreeFaceButton,clearTreeSelectionButton,syncFaceTree,treeFilterQuery,treeFilterSource,treeFilterKind,clearTreeFiltersButton])input.disabled=true;return qualifiedTreeSnapshot();}
  const state=viewer.getState(),scene=state.qualifiedFaceScene,content=scene?scene.assets.map(asset=>({sourceId:asset.sourceId,source:asset.source,face:asset.face}))
    .sort((a,b)=>a.sourceId<b.sourceId?-1:a.sourceId>b.sourceId?1:0):null;
  if(!scene)clearQualifiedTree();
  if(!same(content,qualifiedTreeContent)){const next=buildQualifiedFaceTree(viewer),filtered=filterQualifiedFaceTree(viewer,qualifiedTreeFilter);let retained=null;
    if(qualifiedTreeSelected)try{retained=queryQualifiedFaceTreeNode(viewer,qualifiedTreeSelected.ref);}catch{}
    if(qualifiedTreeSelected&&!retained)clearTreeSelection();else if(retained)qualifiedTreeSelected=clone(retained);
    qualifiedTreeContent=clone(content);qualifiedTreeData=clone(next);qualifiedTreeFiltered=clone(filtered);treeGeneration++;buildQualifiedTreeDom(qualifiedTreeFiltered);
  }
  const enabled=!running&&!!scene,selected=enabled&&!!qualifiedTreeSelected,surface=qualifiedTreeSelected?.ref.kind==='surface';
  for(const node of treeNodeButtons)node.button.disabled=!enabled;syncFaceTree.disabled=!enabled;
  for(const input of[treeFilterQuery,treeFilterSource,treeFilterKind,clearTreeFiltersButton])input.disabled=!enabled;restoreQualifiedTreeFilterControls();
  qualifiedTreeSelectedHidden=!!qualifiedTreeSelected&&!qualifiedTreeNodeVisible(qualifiedTreeSelected.ref);
  const counts=qualifiedTreeFiltered?.counts;treeFilterStatus.textContent=counts?(counts.visibleGeometries?'Showing '+counts.visibleGeometries+' of '+counts.totalGeometries+' original geometries across '+counts.visibleSources+' of '+counts.totalSources+' sources.':'No matching original geometry.')
    +(qualifiedTreeSelectedHidden?' Selected '+qualifiedTreeSelected.ref.sourceId+'/'+qualifiedTreeSelected.ref.geometryId+' is outside the filter.':''):'';
  inspectTreePointButton.disabled=!selected;frameTreeFaceButton.disabled=!selected||state.status!=='ready';clearTreeSelectionButton.disabled=!selected;
  treeU.disabled=!selected||!surface;treeV.disabled=!selected||!surface;treeT.disabled=!selected||surface;
  document.querySelector('#tree-u-label').hidden=!surface;document.querySelector('#tree-v-label').hidden=!surface;document.querySelector('#tree-t-label').hidden=!qualifiedTreeSelected||surface;
  markQualifiedTreeSelection();updateTreePointLabel();refreshTreeCurveLength();refreshTreeSurfaceArea();refreshTreeCurveCurvature();refreshTreeSurfaceCurvature();refreshTreeTangentAngle();refreshTreeNormalAngle();renderAppearanceControls(state);return qualifiedTreeSnapshot();
}
function treeDomainMidpoint(domain){const value=domain[0]/2+domain[1]/2;check(Number.isFinite(value)&&value>=domain[0]&&value<=domain[1],'Original parameter-domain midpoint is not finite or inclusive.');return Object.is(value,-0)?'-0':String(value);}
function selectQualifiedTreeNode(ref){refreshQualifiedTree();const next=queryQualifiedFaceTreeNode(viewer,ref),changed=!qualifiedTreeSelected||!same(qualifiedTreeSelected.ref,next.ref);
  const defaults=changed?Object.fromEntries(Object.entries(next.properties.domain).map(([key,domain])=>[key,treeDomainMidpoint(domain)])):null;
  qualifiedTreeSelected=clone(next);if(changed){clearTreeCurveLength();clearTreeSurfaceArea();clearTreeCurveCurvature();clearTreeSurfaceCurvature();qualifiedTreeReport=null;treePointOutput.textContent='';treeU.value=defaults.u??'';treeV.value=defaults.v??'';treeT.value=defaults.t??'';}
  treeProperties.textContent=JSON.stringify(next.properties,null,2);refreshQualifiedTree();const selected=treeNodeButtons.find(node=>same(node.ref,next.ref));
  if(selected){selected.sourceGroup.open=true;selected.faceGroup.open=true;}display('Original geometry ready for '+next.ref.sourceId+'/'+next.ref.geometryId+'.');return clone(next);}
function treeControlParameters(){check(qualifiedTreeSelected,'Select an original geometry tree node first.');const fields=qualifiedTreeSelected.ref.kind==='surface'?{u:treeU,v:treeV}:{t:treeT};
  return Object.fromEntries(Object.entries(fields).map(([key,input])=>{const text=input.value.trim(),value=Number(text);
    check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)&&Number.isFinite(value),'Original tree '+key+' must be a complete finite decimal.');return[key,value];}));}
function inspectTreePoint(parameters=treeControlParameters()){refreshQualifiedTree();check(qualifiedTreeSelected,'Select a current original geometry tree node first.');
  const next=inspectQualifiedFaceTreeNode(viewer,qualifiedTreeSelected.ref,parameters),report=clone(next);qualifiedTreeReport=report;
  const point=report.measurement.first;treePointOutput.textContent=report.node.ref.sourceId+'/'+report.node.ref.geometryId+' · original point ['+point.pointMM.map(areaNumber).join(', ')+'] mm · scene point ['+point.pointScene.map(areaNumber).join(', ')+'] scene units';
  refreshQualifiedTree();display('Original tree point ready for '+report.node.ref.sourceId+'/'+report.node.ref.geometryId+'.');return clone(report);}
function frameTreeFace(){refreshQualifiedTree();check(!frameTreeFaceButton.disabled&&qualifiedTreeSelected,'Select a current original geometry in an available Face view first.');
  const node=queryQualifiedFaceTreeNode(viewer,qualifiedTreeSelected.ref),ref=node.ref;frameFace({sourceId:ref.sourceId,expectedSource:ref.expectedSource,faceId:ref.faceId,modelId:ref.modelId,surfaceId:ref.expectedFace.topology.face.surfaceId});
  display('Current parent Face framed for '+ref.sourceId+'.');}
function syncQualifiedTreeFromPick(pick){refreshQualifiedTree();const source=qualifiedTreeData?.sources.find(value=>value.sourceId===pick.ref.sourceId),geometry=source?.geometries.find(value=>
  value.ref.kind==='surface'&&value.ref.geometryId===pick.ref.surfaceId&&value.ref.expectedSource===pick.ref.expectedSource&&value.ref.faceId===pick.ref.faceId&&value.ref.modelId===pick.ref.modelId);
  check(geometry,'Current screen Face has no matching original Surface tree node.');selectQualifiedTreeNode(geometry.ref);}
function clearNormalAngle(){normalAngleReport=null;normalAngleProjection=null;normalAngleFaces=null;normalAngleOutput.textContent='';normalAngleLabel.hidden=true;}
function normalAngleScopeChanged(scene){return normalAngleReport&&[normalAngleReport.first.pin,normalAngleReport.second.pin].some((pin,index)=>{
  const asset=scene?.assets.find(value=>value.sourceId===pin.sourceId);
  if(!asset||asset.source!==pin.expectedSource||asset.face.topology.face.id!==pin.faceId||asset.face.geometry.name!==pin.modelId
    ||asset.face.topology.face.surfaceId!==pin.surfaceId||!asset.face.geometry.objects.some(object=>object.id===pin.surfaceId&&object.kind==='surface')
    ||!same(asset.face,normalAngleFaces[index]))return true;
  try{const compiled=compileCadModel(pin.expectedSource,{sourceVersion:0});return !compiled.ok||compiled.model.version!==0||compiled.model.lengthUnit!=='mm'
    ||compiled.model.objects.length!==5||!same(compiled.model,asset.face.geometry);}catch{return true;}
});}
function updateNormalAngleLabel(){if(!viewer||disposed||!normalAngleReport){normalAngleProjection=null;normalAngleLabel.hidden=true;return;}
  const state=viewer.getState();if(normalAngleScopeChanged(state.qualifiedFaceScene)){clearNormalAngle();return;}
  if(state.status!=='ready'){normalAngleProjection=null;normalAngleLabel.hidden=true;return;}
  try{normalAngleProjection=viewer.projectQualifiedFacePoint(normalAngleReport.anchor);}catch{normalAngleProjection=null;}
  normalAngleLabel.hidden=!normalAngleProjection;if(!normalAngleProjection)return;
  normalAngleLabel.textContent=normalAngleReport.first.pin.sourceId+'/'+normalAngleReport.first.pin.surfaceId+' · '+distanceFormat.format(normalAngleReport.angleDegrees)+'°';
  normalAngleLabel.style.left=normalAngleProjection.xCss+'px';normalAngleLabel.style.top=normalAngleProjection.yCss+'px';
}
function renderNormalAngleControls(scene){const enabled=!disposed&&!running&&!!scene;let surfacesPresent=true;
  for(const control of normalControls){const previous=control.source.value;
    control.source.replaceChildren(...(scene?.assets??[]).map(asset=>{const option=document.createElement('option');option.value=asset.sourceId;option.textContent=asset.sourceId;return option;}));
    if(scene?.assets.some(asset=>asset.sourceId===previous))control.source.value=previous;
    else if(scene?.assets.some(asset=>asset.sourceId===control.defaultSource))control.source.value=control.defaultSource;
    const asset=scene?.assets.find(value=>value.sourceId===control.source.value),surface=asset?.face.geometry.objects.find(object=>object.kind==='surface'&&object.id===asset.face.topology.face.surfaceId);
    control.surface.replaceChildren(...(surface?[surface]:[]).map(value=>{const option=document.createElement('option');option.value=value.id;option.textContent=value.id;return option;}));
    surfacesPresent&&=!!surface;for(const input of[control.source,control.surface,control.u,control.v])input.disabled=!enabled;
  }
  normalAngleButton.disabled=!enabled||!surfacesPresent;
}
function controlNormalPin(control){return normalAnglePin(viewer.getState().qualifiedFaceScene,control.source.value,
  surfaceCurvatureParameter(control.u,control.side+' normal u'),surfaceCurvatureParameter(control.v,control.side+' normal v'));}
function measureNormalAngle(first=controlNormalPin(normalControls[0]),second=controlNormalPin(normalControls[1])){
  const scene=viewer.getState().qualifiedFaceScene,next=queryQualifiedFaceNormalAngle(scene,first,second),copied=clone(next);
  const faces=[copied.first.pin,copied.second.pin].map(pin=>clone(scene.assets.find(asset=>asset.sourceId===pin.sourceId).face));
  normalAngleReport=copied;normalAngleFaces=faces;
  normalAngleOutput.textContent=[copied.first.pin,copied.second.pin].map(pin=>pin.sourceId+'/'+pin.surfaceId+' at u '+areaNumber(pin.u)+', v '+areaNumber(pin.v)).join(' ↔ ')
    +' · '+areaNumber(copied.angleDegrees)+'°';updateNormalAngleLabel();display('Original native normal angle ready.');return clone(copied);
}
function normalAngleSnapshot(){return{enabled:!normalAngleButton.disabled,output:normalAngleOutput.textContent,report:clone(normalAngleReport),projection:clone(normalAngleProjection),
  label:{visible:!normalAngleLabel.hidden,text:normalAngleLabel.hidden?null:normalAngleLabel.textContent,xCss:normalAngleLabel.hidden?null:Number.parseFloat(normalAngleLabel.style.left),yCss:normalAngleLabel.hidden?null:Number.parseFloat(normalAngleLabel.style.top)}};}
function clearTangentAngle(){tangentAngleReport=null;tangentAngleProjection=null;tangentAngleOutput.textContent='';tangentAngleLabel.hidden=true;}
function tangentAngleScopeChanged(scene){return tangentAngleReport&&[tangentAngleReport.first.pin,tangentAngleReport.second.pin].some(pin=>{
  const asset=scene?.assets.find(value=>value.sourceId===pin.sourceId);
  return !asset||asset.source!==pin.expectedSource||asset.face.topology.face.id!==pin.faceId||asset.face.geometry.name!==pin.modelId
    ||!asset.face.geometry.objects.some(object=>object.id===pin.curveId&&object.kind==='curve');});}
function updateTangentAngleLabel(){if(!viewer||disposed||!tangentAngleReport){tangentAngleProjection=null;tangentAngleLabel.hidden=true;return;}
  const state=viewer.getState();if(tangentAngleScopeChanged(state.qualifiedFaceScene)){clearTangentAngle();return;}
  if(state.status!=='ready'){tangentAngleProjection=null;tangentAngleLabel.hidden=true;return;}
  try{tangentAngleProjection=viewer.projectQualifiedFacePoint(tangentAngleReport.anchor);}catch{tangentAngleProjection=null;}
  tangentAngleLabel.hidden=!tangentAngleProjection;if(!tangentAngleProjection)return;
  tangentAngleLabel.textContent=tangentAngleReport.first.pin.sourceId+'/'+tangentAngleReport.first.pin.curveId+' · '+distanceFormat.format(tangentAngleReport.angleDegrees)+'°';
  tangentAngleLabel.style.left=tangentAngleProjection.xCss+'px';tangentAngleLabel.style.top=tangentAngleProjection.yCss+'px';
}
function renderTangentAngleControls(scene){const enabled=!disposed&&!running&&!!scene;tangentAngleButton.disabled=!enabled;
  for(const control of tangentControls){const previousSource=control.source.value,previousCurve=control.curve.value;
    control.source.replaceChildren(...(scene?.assets??[]).map(asset=>{const option=document.createElement('option');option.value=asset.sourceId;option.textContent=asset.sourceId;return option;}));
    if(scene?.assets.some(asset=>asset.sourceId===previousSource))control.source.value=previousSource;
    else if(scene?.assets.some(asset=>asset.sourceId===control.defaultSource))control.source.value=control.defaultSource;
    const asset=scene?.assets.find(value=>value.sourceId===control.source.value);
    control.curve.replaceChildren(...(asset?.face.geometry.objects??[]).filter(object=>object.kind==='curve').map(curve=>{const option=document.createElement('option');option.value=curve.id;option.textContent=curve.id;return option;}));
    if([...control.curve.options].some(option=>option.value===previousCurve))control.curve.value=previousCurve;
    else if([...control.curve.options].some(option=>option.value===control.defaultCurve))control.curve.value=control.defaultCurve;
    for(const input of[control.source,control.curve,control.t])input.disabled=!enabled;
  }
}
function controlTangentPin(control){const text=control.t.value.trim(),t=Number(text);
  check(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)&&Number.isFinite(t),control.side+' tangent t must be a complete finite decimal.');
  return tangentAnglePin(viewer.getState().qualifiedFaceScene,control.source.value,control.curve.value,t);}
function measureTangentAngle(first=controlTangentPin(tangentControls[0]),second=controlTangentPin(tangentControls[1])){
  const next=queryQualifiedFaceTangentAngle(viewer.getState().qualifiedFaceScene,first,second);tangentAngleReport=clone(next);
  tangentAngleOutput.textContent=[next.first.pin,next.second.pin].map(pin=>pin.sourceId+'/'+pin.curveId+' at t '+areaNumber(pin.t)).join(' ↔ ')
    +' · '+areaNumber(next.angleDegrees)+'°';updateTangentAngleLabel();display('Original native tangent angle ready.');return clone(next);
}
function tangentAngleSnapshot(){return{enabled:!tangentAngleButton.disabled,output:tangentAngleOutput.textContent,report:clone(tangentAngleReport),projection:clone(tangentAngleProjection),
  label:{visible:!tangentAngleLabel.hidden,text:tangentAngleLabel.hidden?null:tangentAngleLabel.textContent,xCss:tangentAngleLabel.hidden?null:Number.parseFloat(tangentAngleLabel.style.left),yCss:tangentAngleLabel.hidden?null:Number.parseFloat(tangentAngleLabel.style.top)}};}
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
function faceNavigationSnapshot(){return faceNavigation?clone(faceNavigation.snapshot()):{enabled:false,attached:false,disposed,status:viewer&&!disposed?viewer.getState().status:disposed?'disposed':'empty'};}
function syncFaceNavigation(){faceNavigation?.sync();const snapshot=faceNavigationSnapshot();navigateFaceView.checked=snapshot.enabled;
  navigateFaceView.disabled=disposed||running||!viewer||snapshot.status!=='ready'||!viewer.getState().qualifiedFaceScene;return snapshot;}
function setFaceNavigationEnabled(enabled){if(typeof enabled!=='boolean')throw new RangeError('Face navigation preference must be a boolean.');
  check(faceNavigation&&!disposed,'Face navigation is unavailable after disposal.');
  if(enabled){const state=viewer.getState();check(!running&&state.status==='ready'&&state.qualifiedFaceScene,'Load an available qualified Face view before enabling navigation.');}
  faceNavigation.setEnabled(enabled);const snapshot=syncFaceNavigation();display(enabled?'View navigation enabled. Drag to turn, Shift-drag to pan, or use the wheel to zoom.':'View navigation disabled.');return snapshot;}
function colorDraft(){const hex=colorInput.value;check(typeof hex==='string'&&/^#[0-9a-fA-F]{6}$/.test(hex),'Color must be an exact six-digit hex value.');
  return[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255);}
function finishAppearance(result){if(result.changed)invalidateFaceInspection();render();const ref=result.node.ref;
  display('Parent Face color '+(result.changed?'applied':'unchanged')+' for '+ref.sourceId+'/'+ref.expectedFace.topology.face.surfaceId+'.');return clone(result);}
function applySourceColor(){check(arguments.length===0,'Source color uses the current color draft only.');check(!disposed&&!running,'Color changes need an idle live host.');
  const rgb=colorDraft(),tree=buildQualifiedFaceTree(viewer),source=tree?.sources.find(source=>source.sourceId===colorAsset.value),node=source?.geometries.find(node=>node.ref.kind==='surface');
  check(node,'Choose a current original Face source.');return finishAppearance(applyQualifiedTreeFaceColor(viewer,node.ref,rgb));}
function applyTreeParentColor(){check(arguments.length===0,'Tree parent color uses the current color draft only.');check(!disposed&&!running,'Color changes need an idle live host.');
  const rgb=colorDraft();refreshQualifiedTree();check(qualifiedTreeSelected,'Select a current original Surface or Curve first.');
  return finishAppearance(applyQualifiedTreeFaceColor(viewer,clone(qualifiedTreeSelected.ref),rgb));}
function renderAppearanceControls(state){const ready=!disposed&&!running&&state.status==='ready'&&!!state.qualifiedFaceScene;
  buttons['apply-color'].disabled=!ready||!state.qualifiedFaceScene?.assets.some(asset=>asset.sourceId===colorAsset.value);applyTreeColorButton.disabled=!ready||!qualifiedTreeSelected;
  const ref=qualifiedTreeSelected?.ref;treeColorTarget.textContent=ref?'Current tree parent: '+ref.sourceId+'/'+ref.expectedFace.topology.face.surfaceId+' · selected '+ref.kind+' '+ref.geometryId
    :'Select an original Surface or Curve for its parent Face color.';}
function render(){refreshFaceInspection();refreshPickedChord();refreshPickedAngle();refreshPickedNormalAngle();refreshPickedSurfaceCurvature();refreshQualifiedTree();const state=viewer.getState(),scene=state.qualifiedFaceScene,available=!disposed&&!['context-lost','unavailable'].includes(state.status);
  if(inspectionScopeChanged(scene))clearInspection();
  if(measurementScopeChanged(scene))clearMeasurement();
  if(areaScopeChanged(scene))clearArea();
  if(lengthScopeChanged(scene))clearLength();
  if(angleScopeChanged(scene))clearAngle();
  if(curvatureScopeChanged(scene))clearCurvature();
  if(surfaceCurvatureScopeChanged(scene))clearSurfaceCurvature();
  if(tangentAngleScopeChanged(scene))clearTangentAngle();
  if(normalAngleScopeChanged(scene))clearNormalAngle();
  for(const[id,button]of Object.entries(buttons))button.disabled=id==='dispose'?disposed:!available||running;
  buttons['frame-all-faces'].disabled=!available||running||!scene||state.status!=='ready';
  for(const control of[assetCount,countU,countV,colorAsset,colorInput])control.disabled=!available||running;
  if(scene){assetCount.value=String(scene.assets.length);countU.value=String(scene.countU);countV.value=String(scene.countV);}
  const previous=colorAsset.value;colorAsset.replaceChildren(...(scene?.assets??[]).map(asset=>{const option=document.createElement('option');option.value=asset.sourceId;option.textContent=asset.sourceId;return option;}));
  if([...colorAsset.options].some(option=>option.value===previous))colorAsset.value=previous;
  renderAppearanceControls(state);
  const rowEpoch=faceInspectionEpoch,rowScope=clone(faceInspectionScope);
  rows.replaceChildren(...(scene?.assets??[]).map(asset=>{const item=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('small'),button=document.createElement('button'),frameButton=document.createElement('button'),ref=currentFaceRef(asset);
    faceRowRefs.set(item,clone(ref));
    item.dataset.sourceId=asset.sourceId;title.textContent=asset.sourceId+' · '+asset.face.topology.face.id;
    detail.textContent='Surface '+asset.face.topology.face.surfaceId+' · '+asset.face.geometry.objects.length+' original native objects · forward Face';
    button.textContent='Inspect '+asset.sourceId;button.setAttribute('aria-label','Inspect original Face '+asset.sourceId);button.disabled=disposed||running;
    button.addEventListener('click',()=>{try{checkFaceInspectionScope(rowEpoch,rowScope);check(item.isConnected,'This Face row is stale.');
      const current=viewer.getState().qualifiedFaceScene?.assets.find(value=>value.sourceId===ref.sourceId);
      check(current&&same(currentFaceRef(current),ref),'This original Face source reference is stale.');inspect(ref.sourceId);
    }catch(error){display(error.message);}});
    frameButton.textContent='Frame this Face';frameButton.setAttribute('aria-label','Frame original Face '+asset.sourceId);
    frameButton.disabled=!available||running||state.status!=='ready';
    frameButton.addEventListener('click',()=>action(()=>{checkFaceInspectionScope(rowEpoch,rowScope);check(item.isConnected,'This Face row is stale.');
      const current=viewer.getState().qualifiedFaceScene?.assets.find(value=>value.sourceId===ref.sourceId);
      check(current&&same(currentFaceRef(current),ref),'This original Face source reference is stale.');frameFace(clone(ref));
    }));item.append(title,detail,button,frameButton);return item;}));
  markFaceInspectionRows();
  renderMeasurementControls(scene);
  updateLabels();
  renderAreaControls(scene);updateAreaLabel();
  renderLengthControls(scene);updateLengthLabel();
  renderAngleControls(scene);updateAngleLabel();
  renderCurvatureControls(scene);updateCurvatureLabel();
  renderSurfaceCurvatureControls(scene);updateSurfaceCurvatureLabel();
  renderTangentAngleControls(scene);updateTangentAngleLabel();
  renderNormalAngleControls(scene);updateNormalAngleLabel();
  syncFaceNavigation();
}
function load(input=candidate()){uploads.length=0;draws.length=0;viewer.loadQualifiedFaceScene(input);invalidateFaceInspection();clearInspection();clearMeasurement();render();return viewer.getState();}
function action(callback){if(disposed)return;try{callback();render();}catch(error){render();display(error.message);}}
function changeView(callback){callback();invalidateFaceInspection();}
function frameAllFaces(){check(viewer.getState().qualifiedFaceScene,'Load current Faces first.');changeView(()=>viewer.fit());render();display('All current Faces framed.');}
function frameFace(pin){changeView(()=>viewer.fitQualifiedFace(pin));render();display('Current Face framed for '+pin.sourceId+'.');}
function inspect(sourceId){const scene=viewer.getState().qualifiedFaceScene,asset=scene?.assets.find(value=>value.sourceId===sourceId);check(asset,'This source is not in the current accepted scene.');
  const compiled=compileCadModel(asset.source,{sourceVersion:0});check(compiled.ok&&same(compiled.model,asset.face.geometry),'Current original source/Face binding differs');
  const report=validateFaceBundle(asset.face),surface=asset.face.geometry.objects.find(object=>object.kind==='surface'&&object.id===asset.face.topology.face.surfaceId);
  inspectionReport={sourceId:asset.sourceId,modelVersion:compiled.model.version,originalObjectIds:compiled.model.objects.map(object=>object.id),
    faceId:asset.face.topology.face.id,surfaceId:surface.id,nativePointMM:evaluateSurface(surface,.5,.5),parametersUV:[.5,.5],
    originalBoundaryUV:clone(asset.face.topology.loop.uses.map(use=>use.pcurve)),orientation:asset.face.topology.face.orientation,
    incidenceValid:report.incidenceValid,solid:report.solid,geometricValidity:report.geometricValidity,source:asset.source};
  inspectionFace=clone(asset.face);inspection.textContent=JSON.stringify(inspectionReport,null,2);return clone(inspectionReport);
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
    for(const[label,callback]of[['individual geometry fit',()=>viewer.fitGeometry({kind:'surface',modelId:original.assets[0].face.geometry.name,
      surfaceId:original.assets[0].face.topology.face.surfaceId})],['unqualified pick',()=>viewer.pickGeometry({xCss:20,yCss:20})],
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
    viewer.clear();clearInspection();clearMeasurement();clearArea();clearLength();clearAngle();clearCurvature();clearSurfaceCurvature();clearTangentAngle();check(viewer.getState().qualifiedFaceScene===null,'Clear retained qualified Face authority');load(original);
    result.contextCount=contexts.size;result.resources=resourceCounts();result.glErrors=glErrors();result.errors=[...errors];result.warnings=[...warnings];result.getterCalls=getterCalls;
    check(contexts.size===1&&result.glErrors.every(n=>n===0)&&!errors.length&&!warnings.length,'Context/GL/browser gate failed');result.ok=true;
  }catch(error){result.error=error.stack||error.message;result.failures.push({error:result.error,completed:result.cases.length});result.resources=resourceCounts();result.errors=[...errors];}
  finally{running=false;render();window.__viewerQualifiedFaceResult=result;display(result.ok?'Original Face checks completed.':('Face checks stopped: '+(result.error??'Unknown error')));
    try{await fetch('/result',{method:'POST',body:JSON.stringify(result)});}catch(error){result.recordingError=error.message;}}return result;}
function dispose(){if(disposed)return;disposeFaceKeyboard?.();faceNavigation?.dispose();viewer.dispose();viewer.dispose();disposed=true;labelResizeObserver?.disconnect();invalidateFaceInspection();clearPickedChord();clearPickedAngle();clearPickedNormalAngle();clearPickedSurfaceCurvature();clearQualifiedTree();clearInspection();clearMeasurement();clearArea();clearLength();clearAngle();clearCurvature();clearSurfaceCurvature();clearTangentAngle();clearNormalAngle();render();const receipt={status:viewer.getState().status,resources:resourceCounts(),contextCount:contexts.size,
  glErrors:glErrors(),errors:[...errors],warnings:[...warnings]};if(result)result.disposal=receipt;display('Viewer disposed.');return receipt;}
try{manifest=await(await fetch('/fixture-manifest.json')).json();for(const item of manifest){const bytes=await(await fetch(item.url)).arrayBuffer();
    check(bytes.byteLength===item.bytes&&await sha(bytes)===item.sha256,'Original Face fixture bytes/hash changed');fixtures[item.name]={...item,bytes:new Uint8Array(bytes),text:new TextDecoder().decode(bytes)};}
  for(const name of['warped','interior_edit'])originalRequests[name]=JSON.parse(fixtures[name+'.authentic-request.json'].text);
  for(const id of'ABCDEF'){const source=fixtures['warped_'+id+'.source0.css'].text;check(source===originalRequests.warped.assets.find(asset=>asset.sourceId===id).source,'Original source file/Face association differs');originalSources[id]=source;}
  check(fixtures['interior_edit_F.source0.css'].text===originalRequests.interior_edit.assets[5].source,'Original interior-edit Source0 association differs');
  viewer=createViewer(canvas,{mmToSceneUnit,background});faceNavigation=createQualifiedFacePointerNavigation(viewer,canvas,{
    onViewChange:()=>{render();display('Qualified Face view moved.');},onError:error=>{display(error instanceof Error?error.message:String(error));render();}});
  disposeFaceKeyboard=createQualifiedFaceKeyboardFraming(viewer,canvas,{
    frameAll:()=>{check(!disposed&&!running,'Keyboard framing needs an idle live host.');frameAllFaces();},
    frameParent:()=>{check(!disposed&&!running,'Keyboard framing needs an idle live host.');frameTreeFace();},
    onError:error=>{display(error instanceof Error?error.message:String(error));render();}});
  load(candidate());lossExtension=[...contexts][0].getExtension('WEBGL_lose_context');
  labelResizeObserver=new ResizeObserver(()=>{refreshFaceInspection();refreshPickedChord();refreshPickedAngle();refreshPickedNormalAngle();refreshPickedSurfaceCurvature();refreshQualifiedTree();updateLabels();updateAreaLabel();updateLengthLabel();updateAngleLabel();updateCurvatureLabel();updateSurfaceCurvatureLabel();updateTangentAngleLabel();updateNormalAngleLabel();syncFaceNavigation();});labelResizeObserver.observe(canvas);
  window.__viewerQualifiedFaceProof={viewer,createViewer,applyQualifiedTreeFaceColor,applySourceColor,applyTreeParentColor,createQualifiedFaceKeyboardFraming,createQualifiedFacePointerNavigation,setFaceNavigationEnabled,syncFaceNavigation,faceNavigationSnapshot,candidate,load,render,frameAllFaces,frameFace,inspect,inspectFaceAt,faceInspectionSnapshot,refreshFaceInspection,sampleFaceAt,nativeSampleSnapshot,measurementInput,measure,updateLabels,labelSnapshot,
    createPickedFacePoint,measurePickedFaceChord,isPickedFacePointCurrent,pickedChordSnapshot,pickChordAt,refreshPickedChord,remeasurePickedChord,resetPickedChord,
    measurePickedFaceAngle,pickAngleAt,refreshPickedAngle,remeasurePickedAngle,resetPickedAngle,pickedAngleSnapshot,
    queryPickedFaceSurfaceCurvature,inspectPickedSurfaceCurvature,refreshPickedSurfaceCurvature,remeasurePickedSurfaceCurvature,resetPickedSurfaceCurvature,pickedSurfaceCurvatureSnapshot,
    measurePickedFaceNormalAngle,pickNormalAngleAt,refreshPickedNormalAngle,remeasurePickedNormalAngle,resetPickedNormalAngle,pickedNormalAngleSnapshot,
    buildQualifiedFaceTree,queryQualifiedFaceTreeNode,inspectQualifiedFaceTreeNode,selectQualifiedTreeNode,refreshQualifiedTree,inspectTreePoint,frameTreeFace,clearTreeSelection,qualifiedTreeSnapshot,
    filterQualifiedFaceTree,setQualifiedTreeFilter,clearQualifiedTreeFilter,
    queryQualifiedTreeCurveLength,measureTreeCurveLength,resetTreeCurveLength,treeCurveLengthSnapshot,
    queryQualifiedTreeSurfaceArea,inspectTreeSurfaceArea,resetTreeSurfaceArea,treeSurfaceAreaSnapshot,
    queryQualifiedTreeCurveCurvature,inspectTreeCurveCurvature,resetTreeCurveCurvature,treeCurveCurvatureSnapshot,
    queryQualifiedTreeSurfaceCurvature,inspectTreeSurfaceCurvature,resetTreeSurfaceCurvature,treeSurfaceCurvatureSnapshot,
    queryQualifiedTreeTangentAngle,captureTreeTangent,refreshTreeTangentAngle,remeasureTreeTangentAngle,resetTreeTangentAngle,treeTangentAngleSnapshot,
    queryQualifiedTreeNormalAngle,captureTreeNormal,refreshTreeNormalAngle,remeasureTreeNormalAngle,resetTreeNormalAngle,treeNormalAngleSnapshot,
    AREA_OPTIONS,areaPin,queryQualifiedFaceSurfaceArea,inspectArea,updateAreaLabel,areaSnapshot,mismatchCandidate,dispose,resourceCounts,uploads,draws,glErrors,errors,warnings,lossExtension,failAllocation,
    LENGTH_OPTIONS,lengthPin,queryQualifiedFaceCurveLength,inspectLength,updateLengthLabel,lengthSnapshot,
    queryQualifiedFaceAngle,measureAngle,updateAngleLabel,angleSnapshot,
    curvaturePin,queryQualifiedFaceCurveCurvature,inspectCurvature,updateCurvatureLabel,curvatureSnapshot,evaluateCurveCurvature,evaluateCurveD2,
    surfaceCurvaturePin,queryQualifiedFaceSurfaceCurvature,inspectSurfaceCurvature,updateSurfaceCurvatureLabel,surfaceCurvatureSnapshot,evaluateSurfaceCurvature,evaluateSurfaceD2,
    tangentAnglePin,queryQualifiedFaceTangentAngle,measureTangentAngle,updateTangentAngleLabel,tangentAngleSnapshot,evaluateCurveD1,
    normalAnglePin,queryQualifiedFaceNormalAngle,measureNormalAngle,updateNormalAngleLabel,normalAngleSnapshot,evaluateSurfaceD1,
    failNextBuffer(at=16){failAllocation('Buffer',at);},clearAllocationFault,originalRequests,originalSources,fixtures,manifest,colors,camera,translateScene,mmToSceneUnit,background,pixelInfo,witness,retained,capture,runProof,
    prepareQualifiedFaceScene,QualifiedFaceSceneRenderer,MixedDepthRenderer,prepareMixedDepthFrame,compileGpu,prepareCamera,prepareMesh,prepareUniformCurvePreview,prepareSelectedUniformCurvePreview,
    compileCadModel,validateFaceBundle,tessellateSurface,evaluateSurface,evaluateCurve,curveDomain,parseBooleanExtrusionFeatureGraph,parseBaroCadSource,
    createCadDocument,createCadGeometryReference,queryCadDocumentSurfaceArea,validateCadDocumentSurfaceArea,queryCadDocumentCurveArcLength,validateCadDocumentCurveArcLength,
    loadBaroCadModelSet,loadBaroCadDocument,parseBaroCadDocument,prepareBaroCadDocumentPrimitiveNativeRefsV2,parseBaroCadAssembly,loadBaroCadAssembly,
    createClothWorld,createPhysicsClothWorld:createClothWorld,PrimitiveSceneRendererV2,PrimitiveViewport,BooleanShellSceneRenderer,canvas,
    get gl(){return[...contexts][0];},get state(){return viewer.getState();},get currentScene(){return viewer.getState().qualifiedFaceScene;},get inspectionReport(){return clone(inspectionReport);},
    get measurementReport(){return clone(measurementReport);},get currentProjections(){return clone(currentProjections);},get areaReport(){return clone(areaReport);},
    get lengthReport(){return clone(lengthReport);},get angleReport(){return clone(angleReport);},get curvatureReport(){return clone(curvatureReport);},
    get surfaceCurvatureReport(){return clone(surfaceCurvatureReport);},get tangentAngleReport(){return clone(tangentAngleReport);},get normalAngleReport(){return clone(normalAngleReport);},
    get nativeSampleReport(){return clone(nativeSampleRecord?.sample??null);},get pickedChordReport(){return clone(pickedChordReport);},get pickedAngleReport(){return clone(pickedAngleReport);},
    get pickedSurfaceCurvatureReport(){return clone(pickedSurfaceCurvatureReport);},get pickedNormalAngleReport(){return clone(pickedNormalAngleReport);},
    get treeCurveLengthReport(){return clone(treeCurveLengthReport);},get treeSurfaceAreaReport(){return clone(treeSurfaceAreaReport);},get treeCurveCurvatureReport(){return clone(treeCurveCurvatureReport);},get treeSurfaceCurvatureReport(){return clone(treeSurfaceCurvatureReport);},get treeTangentAngleReport(){return clone(treeTangentAngleReport);},get treeNormalAngleReport(){return clone(treeNormalAngleReport);},get result(){return result;}};
  display('Original Faces ready. Inspect a current source from its row.');
}catch(error){display('Original Faces could not load: '+error.message);}
navigateFaceView.addEventListener('change',()=>action(()=>setFaceNavigationEnabled(navigateFaceView.checked)));
buttons.load.addEventListener('click',()=>action(()=>load(candidate({assetCount:Number(assetCount.value),countU:Number(countU.value),countV:Number(countV.value)}))));
buttons['interior-edit'].addEventListener('click',()=>action(()=>load(candidate({variant:'interior_edit'}))));buttons.mismatch.addEventListener('click',()=>action(()=>load(mismatchCandidate())));
buttons.reverse.addEventListener('click',()=>action(()=>{const scene=viewer.getState().qualifiedFaceScene;check(scene,'Load current Faces first.');load({version:0,basis:scene.basis,assets:[...clone(scene.assets)].reverse(),countU:scene.countU,countV:scene.countV,camera:clone(scene.camera),translateScene:[...scene.translate]});}));
buttons['apply-color'].addEventListener('click',()=>action(applySourceColor));applyTreeColorButton.addEventListener('click',()=>action(applyTreeParentColor));
buttons['saved-view'].addEventListener('click',()=>action(()=>changeView(()=>viewer.setView(camera))));buttons.orbit.addEventListener('click',()=>action(()=>changeView(()=>viewer.orbit(.05,.02))));buttons.pan.addEventListener('click',()=>action(()=>changeView(()=>viewer.pan(.01,0))));
buttons['frame-all-faces'].addEventListener('click',()=>action(frameAllFaces));
buttons.resize.addEventListener('click',()=>action(()=>changeView(()=>viewer.resize(canvas.width===640?480:640,canvas.height===480?360:480))));buttons.clear.addEventListener('click',()=>action(()=>{viewer.clear();invalidateFaceInspection();clearPickedChord();clearPickedAngle();clearPickedNormalAngle();clearPickedSurfaceCurvature();clearQualifiedTree();clearInspection();clearMeasurement();clearArea();clearLength();clearAngle();clearCurvature();clearSurfaceCurvature();clearTangentAngle();clearNormalAngle();}));
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
for(const control of tangentControls)control.source.addEventListener('change',()=>renderTangentAngleControls(viewer.getState().qualifiedFaceScene));
tangentAngleButton.addEventListener('click',()=>action(()=>measureTangentAngle()));
for(const control of normalControls)control.source.addEventListener('change',()=>renderNormalAngleControls(viewer.getState().qualifiedFaceScene));
normalAngleButton.addEventListener('click',()=>action(()=>measureNormalAngle()));
faceInspectMode.addEventListener('change',()=>{faceInspectionRecord=null;faceScreenOutput.textContent='';markFaceInspectionRows();render();});
nativeSampleMode.addEventListener('change',()=>{clearNativeSample();render();});
pickedChordMode.addEventListener('change',render);resetPickedChordButton.addEventListener('click',()=>action(resetPickedChord));
pickedAngleMode.addEventListener('change',render);resetPickedAngleButton.addEventListener('click',()=>action(resetPickedAngle));
pickedNormalAngleMode.addEventListener('change',render);resetPickedNormalAngleButton.addEventListener('click',()=>action(resetPickedNormalAngle));
inspectPickedSurfaceCurvatureButton.addEventListener('click',()=>action(inspectPickedSurfaceCurvature));resetPickedSurfaceCurvatureButton.addEventListener('click',()=>action(resetPickedSurfaceCurvature));
inspectTreePointButton.addEventListener('click',()=>action(()=>inspectTreePoint()));frameTreeFaceButton.addEventListener('click',()=>action(frameTreeFace));clearTreeSelectionButton.addEventListener('click',()=>action(()=>{clearTreeSelection();refreshQualifiedTree();display('Original tree selection cleared.');}));
function applyTreeFilterControls(){try{setQualifiedTreeFilter({query:treeFilterQuery.value,sourceId:treeFilterSource.value||null,kind:treeFilterKind.value});}catch(error){display(error.message);}}
treeFilterQuery.addEventListener('input',applyTreeFilterControls);treeFilterSource.addEventListener('change',applyTreeFilterControls);treeFilterKind.addEventListener('change',applyTreeFilterControls);
clearTreeFiltersButton.addEventListener('click',()=>action(clearQualifiedTreeFilter));
measureTreeLengthButton.addEventListener('click',()=>action(()=>measureTreeCurveLength()));resetTreeLengthButton.addEventListener('click',()=>action(resetTreeCurveLength));
inspectTreeAreaButton.addEventListener('click',()=>action(()=>inspectTreeSurfaceArea()));resetTreeAreaButton.addEventListener('click',()=>action(resetTreeSurfaceArea));
inspectTreeCurvatureButton.addEventListener('click',()=>action(()=>inspectTreeCurveCurvature()));resetTreeCurvatureButton.addEventListener('click',()=>action(resetTreeCurveCurvature));
inspectTreeSurfaceCurvatureButton.addEventListener('click',()=>action(()=>inspectTreeSurfaceCurvature()));resetTreeSurfaceCurvatureButton.addEventListener('click',()=>action(resetTreeSurfaceCurvature));
captureTreeTangentButton.addEventListener('click',()=>action(()=>captureTreeTangent()));resetTreeTangentAngleButton.addEventListener('click',()=>action(resetTreeTangentAngle));
captureTreeNormalButton.addEventListener('click',()=>action(()=>captureTreeNormal()));resetTreeNormalAngleButton.addEventListener('click',()=>action(resetTreeNormalAngle));
canvas.addEventListener('click',event=>{const inspectEnabled=faceInspectMode.checked&&!faceInspectMode.disabled,sampleEnabled=nativeSampleMode.checked&&!nativeSampleMode.disabled,
  chordEnabled=pickedChordMode.checked&&!pickedChordMode.disabled,angleEnabled=pickedAngleMode.checked&&!pickedAngleMode.disabled,normalAngleEnabled=pickedNormalAngleMode.checked&&!pickedNormalAngleMode.disabled;
  if(!inspectEnabled&&!sampleEnabled&&!chordEnabled&&!angleEnabled&&!normalAngleEnabled)return;const rect=canvas.getBoundingClientRect(),point={xCss:event.clientX-rect.left,yCss:event.clientY-rect.top};
  if(inspectEnabled)try{inspectFaceAt(point);}catch(error){display(error.message);}
  if(sampleEnabled||chordEnabled||angleEnabled||normalAngleEnabled)try{const record=readFaceSample(point);
    if(sampleEnabled)try{adoptNativeSample(record);}catch(error){display(error.message);}
    if(chordEnabled)try{adoptPickedChord(record);}catch(error){display(error.message);}
    if(angleEnabled)try{adoptPickedAngle(record);}catch(error){display(error.message);}
    if(normalAngleEnabled)try{adoptPickedNormalAngle(record);}catch(error){display(error.message);}
  }catch(error){display(error.message);}});
buttons['run-proof'].addEventListener('click',runProof);buttons.dispose.addEventListener('click',dispose);buttons['lose-context'].addEventListener('click',()=>lossExtension?.loseContext());
canvas.addEventListener('webglcontextlost',()=>{render();display('Context lost. Original source inspection remains available.');});window.addEventListener('beforeunload',()=>{if(viewer)dispose();});
