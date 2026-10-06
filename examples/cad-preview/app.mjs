import { parseProject, serializeProject, projectByteLimit } from '/project.mjs';
import { bindMouseOrbit } from '/orbit.mjs';
import * as cad from '/cad.js';
import * as gpu from '/gpu.js';
import { createPreviewController } from '/pipeline.mjs';
import { fixtures, constructionFixtures, objectFixtures, parameterFixture, controlPointEdit, weightEdit, vectorEdit, constructionWeightEdit } from '/fixtures.mjs';
const $ = id => document.getElementById(id);
const canvas = $('preview');
const allFixtures = [...fixtures, ...constructionFixtures, ...objectFixtures, parameterFixture];
const controller = createPreviewController(canvas, cad, gpu, (message, accepted) => {
  $('status').textContent = message;
  $('export').disabled = !accepted || !controller.available;
  if (accepted) {
    const { packet,report,options,revision,viewRevision } = accepted;
    $('summary').textContent = `Accepted model revision ${revision} · view revision ${viewRevision} · ${packet.surfaceId}\nCanonical bounds (mm): ${JSON.stringify(packet.bounds)}\nScene units/mm: ${options.mmToSceneUnit} · translation: ${JSON.stringify(options.translate)}\nVertices: ${packet.positions.length/3} · triangles: ${packet.indices.length/3}\nSampled maximum distance (mm): ${report.maxSampledDeviationMM}\nFinite samples only · certified: ${report.certified}`;
    $('source-version').value=String(accepted.sourceVersion ?? 0);
    renderObjects();renderParameters();renderPrimitive();renderScene(accepted);updateEditorState();
    $('details').textContent = JSON.stringify({sourceVersion:accepted.sourceVersion??0,constructions:accepted.constructions,selectedConstruction:accepted.selectedConstruction,model:accepted.model,report,camera:options.camera??'Original fixed default'},null,2);
  }else{
    $('scene-title').textContent='No accepted surface';$('scene-meta').textContent='No native geometry adopted';
    for(const id of ['export','camera-front','camera-side','camera-oblique','camera-reset','camera-apply'])$(id).disabled=true;
    updateEditorState();
  }
});
function fields(fixture) {
  $('source').value=fixture.source;$('surface').value=fixture.id;$('source-version').value=String(fixture.sourceVersion??0);
  $('count-u').value=fixture.countU;$('count-v').value=fixture.countV;
  $('scale').value=fixture.options.mmToSceneUnit;$('translate').value=fixture.options.translate.join(',');$('color').value=fixture.options.color.join(',');$('background').value=fixture.options.background.join(',');
  $('weight-edit').disabled=fixture.id==='flat_patch'||fixture.selectorId==='multi_native';
  $('vector-edit').disabled=fixture.sourceVersion!==1;$('control-edit').disabled=fixture.sourceVersion===1||Boolean(fixture.selectorId);
}
function settings() {
  const camera=controller.snapshot()?.options.camera;
  return {sourceVersion:Number($('source-version').value),surfaceId:$('surface').value,countU:Number($('count-u').value),countV:Number($('count-v').value),options:{mmToSceneUnit:Number($('scale').value),translate:$('translate').value.split(',').map(Number),color:$('color').value.split(',').map(Number),background:$('background').value.split(',').map(Number),...(camera ? {camera} : {})}};
}
function applyEditor() { const result=controller.apply($('source').value,settings());$('source').setAttribute('aria-invalid',String(!result.ok));updateEditorState();return result; }
function select(id) {
  const fixture=allFixtures.find(value=>(value.selectorId??value.id)===id);
  if (!fixture) throw new RangeError('Unknown example');
  fields(fixture);$('fixture').value=id;
  const next=settings();
  if (fixture.options.camera) {next.options.camera=structuredClone(fixture.options.camera);cameraFields(next.options.camera);}
  return controller.apply(fixture.source,next);
}
for (const fixture of allFixtures) { const option=document.createElement('option');option.value=fixture.selectorId??fixture.id;option.textContent=fixture.label;$('fixture').append(option); }
$('fixture').addEventListener('change',()=>select($('fixture').value));
$('apply').addEventListener('click',applyEditor);
$('source-version').addEventListener('change',applyEditor);
function edit(transform) {
  try { $('source').value=transform($('source').value);applyEditor(); }
  catch(error) { $('status').textContent=`Source edit unavailable: ${error.message}. Accepted preview retained.`; }
}
$('control-edit').addEventListener('click',()=>edit(controlPointEdit));
$('weight-edit').addEventListener('click',()=>edit(Number($('source-version').value)===1 ? constructionWeightEdit : weightEdit));
$('vector-edit').addEventListener('click',()=>edit(vectorEdit));
$('fine').addEventListener('click',()=>{ $('count-u').value=33;$('count-v').value=17;applyEditor(); });
$('export').addEventListener('click',()=>{
  const accepted=controller.snapshot();if(!accepted||!controller.available)return;
  const url=URL.createObjectURL(new Blob([accepted.iges.iges],{type:'application/iges'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=`surface-${accepted.revision}.iges`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0);
});
const defaultCamera={eye:[0,0,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:0.01,far:100};
function cameraFields(camera) {
  for(const key of ['eye','target','up']) $(`camera-${key}`).value=camera[key].join(',');
  $('camera-fov').value=camera.fovYDegrees;$('camera-near').value=camera.near;$('camera-far').value=camera.far;
}
for(const [name,eye] of [['front',[0,0,6]],['side',[6,0,0]],['oblique',[4,3,6]]]) {
  $(`camera-${name}`).addEventListener('click',()=>{const camera={...defaultCamera,eye};cameraFields(camera);controller.setCamera(camera);});
}
$('camera-reset').addEventListener('click',()=>{cameraFields(defaultCamera);controller.setCamera(undefined);});
$('camera-apply').addEventListener('click',()=>controller.setCamera({
  eye:$('camera-eye').value.split(',').map(Number),target:$('camera-target').value.split(',').map(Number),up:$('camera-up').value.split(',').map(Number),
  fovYDegrees:Number($('camera-fov').value),near:Number($('camera-near').value),far:Number($('camera-far').value),
}));
function renderParameters() {
  const state=controller.parameterState(), available=Boolean(state)&&controller.available;
  $('parameter-apply').disabled=!available;
  $('parameter-fields').hidden=!state;
  for(const id of ['parameter-vector-x','parameter-vector-y','parameter-vector-z','parameter-weight-index','parameter-weight-value']) $(id).disabled=!available;
  $('parameter-state').textContent=state ? `Displayed output: ${state.surfaceId} · input curve: ${state.inputId}\nShared outputs: ${state.sharedOutputs.join(', ')} · weights: ${state.indexCount}` : 'Numeric controls require an accepted displayed source-v1 extrusion.';
  if(state) {
    for(const [axis,value] of ['x','y','z'].map((axis,index)=>[axis,state.vector[index]])) $(`parameter-vector-${axis}`).value=Object.is(value,-0)?'-0':String(value);
    $('parameter-weight-index').max=String(state.indexCount-1);
    const index=Number($('parameter-weight-index').value);
    const ownedIndex=Number.isInteger(index)&&index>=0&&index<state.indexCount?index:0;
    $('parameter-weight-index').value=String(ownedIndex);$('parameter-weight-value').value=String(state.weights[ownedIndex]);
  }
}
function numberField(id) {const text=$(id).value.trim();if(!text)throw new RangeError('Numeric fields cannot be empty');const value=Number(text);if(!Number.isFinite(value))throw new RangeError('Numeric fields must be finite');return value;}
$('parameter-weight-index').addEventListener('change',()=>{
  const state=controller.parameterState(),index=Number($('parameter-weight-index').value);
  if(state&&Number.isInteger(index)&&index>=0&&index<state.indexCount)$('parameter-weight-value').value=String(state.weights[index]);
});
$('parameter-apply').addEventListener('click',()=>{
  try {
    const request={vector:['x','y','z'].map(axis=>numberField(`parameter-vector-${axis}`)),weight:{index:numberField('parameter-weight-index'),value:numberField('parameter-weight-value')}};
    const result=controller.applyParameters(request,$('source').value);
    if(result.ok){$('source').value=controller.snapshot().source;updateEditorState();}
    else $('status').textContent=`Parameter edit rejected: ${result.error}. Accepted preview retained.`;
  } catch(error) {$('status').textContent=`Parameter edit rejected: ${error.message}. Accepted preview retained.`;}
});
$('discard-source').addEventListener('click',()=>{const accepted=controller.snapshot();if(accepted)$('source').value=accepted.source;$('source').setAttribute('aria-invalid','false');updateEditorState();});
$('source').addEventListener('input',updateEditorState);
$('source-toggle').addEventListener('click',()=>{$('source-panel').open=!$('source-panel').open;$('source-toggle').setAttribute('aria-expanded',String($('source-panel').open));if($('source-panel').open)$('source').focus();});
$('source-panel').addEventListener('toggle',()=> $('source-toggle').setAttribute('aria-expanded',String($('source-panel').open)));

function renderObjects() {
  const rows=controller.objects(), inspection=controller.inspection();
  const list=$('objects'),active=document.activeElement,focusedRow=active?.closest?.('[data-object-id]');
  const focusKey=focusedRow&&active.dataset.action?{id:focusedRow.dataset.objectId,action:active.dataset.action}:null;
  list.replaceChildren();$('object-count').textContent=String(rows.length);
  for (const object of rows) {
    const row=document.createElement('li');row.dataset.objectId=object.id;
    row.classList.toggle('is-inspected',controller.inspectedId===object.id);row.classList.toggle('is-displayed',controller.snapshot()?.packet.surfaceId===object.id);
    const label=document.createElement('span');label.textContent=`${object.id} · ${object.kind}`;row.append(label);
    const inspect=document.createElement('button');inspect.textContent='Inspect';inspect.dataset.action='inspect';
    inspect.disabled=!controller.available;inspect.addEventListener('click',()=>controller.inspectObject(object.id));row.append(inspect);
    if(object.supportedSurface) {
      const show=document.createElement('button');show.textContent='Show surface';show.dataset.action='show';
      show.disabled=!controller.available;show.addEventListener('click',()=>{const result=controller.showSurface(object.id);
        if(result.ok)$('surface').value=object.id;else $('status').textContent=`Selection rejected: ${result.error}`;});row.append(show);
    }
    list.append(row);
  }
  if(focusKey){const row=[...list.children].find(item=>item.dataset.objectId===focusKey.id);const button=row&&[...row.querySelectorAll('button')].find(item=>item.dataset.action===focusKey.action&&!item.disabled);(button??$('objects-title')).focus({preventScroll:true});}
  renderProperties(inspection);
  $('inspection').textContent=inspection ? `Inspected object: ${inspection.id} · ${inspection.kind}\nDisplayed surface: ${inspection.displayedSurfaceId}\nNative control-point bounds (mm; not tight surface extent): ${JSON.stringify(inspection.controlPointBoundsMM)}\nDisplayed sampled preview-mesh bounds (mm; not tight surface extent): ${JSON.stringify(inspection.displayedSampledMeshBoundsMM)}\n${JSON.stringify(inspection,null,2)}` : 'No accepted native object';
}
function renderPrimitive(){
 const owned=controller.primitiveState();$('primitive-update').disabled=!owned||!controller.available;
 $('primitive-state').textContent=owned?`Accepted ${owned.kind} · ${owned.size} × ${owned.height} mm · displayed #surface`:'Update requires a matching tool-created surface';
}
$('primitive-kind').addEventListener('change',()=>{$('primitive-size-label').textContent=$('primitive-kind').value==='sheet'?'Width · mm':'Radius · mm';});
function primitiveAction(update){
 try{const dimensions={size:numberField('primitive-size'),height:numberField('primitive-height')};const result=update?controller.updateDimensions(dimensions,$('source').value):controller.createPrimitive({kind:$('primitive-kind').value,...dimensions},$('source').value);
 if(result.ok){const accepted=controller.snapshot(),owned=controller.primitiveState();$('source').value=accepted.source;$('surface').value=accepted.packet.surfaceId;$('source-version').value='1';$('count-u').value=accepted.report.grid.countU;$('count-v').value=accepted.report.grid.countV;$('scale').value=accepted.options.mmToSceneUnit;$('translate').value=accepted.options.translate.join(',');$('color').value=accepted.options.color.join(',');$('background').value=accepted.options.background.join(',');$('primitive-kind').value=owned.kind;$('primitive-kind').dispatchEvent(new Event('change'));cameraFields(accepted.options.camera??defaultCamera);updateEditorState();}
 else $('status').textContent=`Creation rejected: ${result.error}. Accepted state retained.`;
 }catch(error){$('status').textContent=`Creation rejected: ${error.message}. Accepted state retained.`;}
}
$('primitive-create').addEventListener('click',()=>primitiveAction(false));$('primitive-update').addEventListener('click',()=>primitiveAction(true));

// Display formatting never feeds source, parameters, packet data or exports.
function displayNumber(value){return Number(value.toPrecision(4)).toString();}
function displayVector(value){return value.map(displayNumber).join(', ');}
function updateEditorState(){
  const accepted=controller.snapshot(),pending=Boolean(accepted)&&$('source').value!==accepted.source;
  $('editor-state').textContent=accepted?(pending?'Pending source · not applied':'Source matches accepted scene'):'No accepted source';
  $('editor-state').classList.toggle('is-pending',pending);
  renderHistory(pending);
}
function renderScene(accepted){
  const {model,packet,report,options,revision,viewRevision}=accepted;
  $('scene-title').textContent=model.name.replaceAll('_',' ');
  $('scene-meta').textContent=`Displayed #${packet.surfaceId} · source v${accepted.sourceVersion??0} · native mm`;
  $('surface-badge').textContent=`#${packet.surfaceId}`;
  $('revision-label').textContent=`${revision} / ${viewRevision}`;
  $('mesh-label').textContent=`${packet.positions.length/3} vertices · ${packet.indices.length/3} triangles`;
  $('distance-label').textContent=displayNumber(report.maxSampledDeviationMM);$('distance-label').title=String(report.maxSampledDeviationMM)+' mm · finite samples · uncertified';
  const poses=[['front',[0,0,6]],['side',[6,0,0]],['oblique',[4,3,6]]];
  const camera=options.camera,pose=camera&&poses.find(([,eye])=>JSON.stringify(camera)===JSON.stringify({...defaultCamera,eye}));
  $('view-label').textContent=camera?(pose?pose[0]+' view':'Custom camera'):'Default view';
  for(const [name] of poses)$(`camera-${name}`).classList.toggle('is-active',pose?.[0]===name);
  $('camera-reset').classList.toggle('is-active',!camera);
  for(const id of ['camera-front','camera-side','camera-oblique','camera-reset','camera-apply','camera-eye','camera-target','camera-up','camera-fov','camera-near','camera-far','apply','fine','discard-source','fixture','source-version','primitive-create','project-save','project-open'])$(id).disabled=!controller.available;
  if(!controller.available)for(const id of ['control-edit','weight-edit','vector-edit'])$(id).disabled=true;
  const history=$('creation-history');history.replaceChildren();
  if(accepted.sourceVersion===1){for(const feature of accepted.constructions){const item=document.createElement('li');item.textContent=`${feature.outputId} ← ${feature.inputId} · ${feature.operation} [${displayVector(feature.vector)}] mm`;item.title=JSON.stringify(feature);history.append(item);}}
  else{const item=document.createElement('li');item.textContent='Authored directly in native source v0.';history.append(item);}
}
function renderProperties(inspection){
  $('properties').replaceChildren();
  $('inspected-title').textContent=inspection?'#'+inspection.id:'No accepted object';
  $('inspected-kind').textContent=inspection?.kind??'—';
  $('inspected-context').textContent=inspection?`Inspected ${inspection.id} · displayed ${inspection.displayedSurfaceId} · ${inspection.nativeSource}`:'';
  if(!inspection)return;
  const axisValues=value=>Object.entries(value).map(([key,number])=>`${key}: ${Array.isArray(number)?displayVector(number):number}`).join(' · ');
  const fields=[['Degree',axisValues(inspection.degrees)],['Original domains',axisValues(inspection.originalDomains)],['Knot counts',axisValues(inspection.knotCounts)],['Pole counts',axisValues(inspection.poleCounts)],['Weight range',displayVector(inspection.weightRange)],['Control points · min mm',displayVector(inspection.controlPointBoundsMM.min)],['Control points · max mm',displayVector(inspection.controlPointBoundsMM.max)],['Displayed mesh · min mm',displayVector(inspection.displayedSampledMeshBoundsMM.min)],['Displayed mesh · max mm',displayVector(inspection.displayedSampledMeshBoundsMM.max)]];
  for(const [label,value] of fields){const row=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=value;row.append(term,description);$('properties').append(row);}
}

function renderHistory(pending=false){
 const state=controller.historyState();$('history-undo').disabled=pending||!state.canUndo;$('history-redo').disabled=pending||!state.canRedo;
 $('history-count').textContent=state.count?`State ${state.cursor+1} of ${state.count} · Undo ${state.undoCount} · Redo ${state.redoCount}`:'No accepted model history';
}
for(const direction of ['undo','redo'])$('history-'+direction).addEventListener('click',()=>{
 const result=controller[direction]($('source').value);
 if(result.ok){refreshProjectFields();if($('history-'+direction).disabled){const next=$('history-'+(direction==='undo'?'redo':'undo'));(next.disabled?$('history-count'):next).focus({preventScroll:true});}$('history-status').textContent=`${direction==='undo'?'Undo':'Redo'} restored the accepted model. Current camera retained.`;}
 else $('history-status').textContent=`History rejected: ${result.error}. Accepted scene and history retained.`;
});
function refreshProjectFields(){
 const accepted=controller.snapshot(),owned=controller.primitiveState();
 fields({source:accepted.source,id:accepted.packet.surfaceId,sourceVersion:accepted.sourceVersion??0,...accepted.report.grid,options:accepted.options});
 cameraFields(accepted.options.camera??defaultCamera);
 if(owned){$('primitive-kind').value=owned.kind;$('primitive-size').value=String(owned.size);$('primitive-height').value=String(owned.height);$('primitive-kind').dispatchEvent(new Event('change'));}
 updateEditorState();
}
$('project-save').addEventListener('click',()=>{
 try{
  const text=serializeProject(controller.projectState(),gpu),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='accepted.barocad.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  $('project-status').textContent='Saved accepted project. Pending fields were not saved.';
 }catch(error){$('project-status').textContent=`Save rejected: ${error.message}`;}
});
let opening=false;
$('project-open').addEventListener('change',async()=>{
 if(opening)return;
 opening=true;
 try{
  const file=$('project-open').files[0];if(!file)throw new Error('Choose a local project file');
  if(file.size>projectByteLimit)throw new RangeError('Project file exceeds 300 KiB');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
  const record=parseProject(text,gpu),result=controller.loadProject(record,$('source').value);
  if(!result.ok)throw new Error(result.error);
  refreshProjectFields();$('project-status').textContent=`Opened ${file.name}. Accepted source and settings restored.`;
 }catch(error){$('project-status').textContent=`Open rejected: ${error.message}. Accepted scene and staged fields retained.`;}
 finally{opening=false;$('project-open').value='';}
});
const mouseOrbit=bindMouseOrbit(canvas,controller,cameraFields);
// Inspection API for the local evidence runner. No source-provided code is evaluated.
$('surface-edges').addEventListener('change',()=>{const result=controller.setEdges($('surface-edges').checked);if(!result.ok){$('surface-edges').checked=controller.edgesEnabled;$('status').textContent=result.error;}});
window.cadPreview={setEdges:enabled=>controller.setEdges(enabled),historyState:()=>controller.historyState(),undo:source=>controller.undo(source),redo:source=>controller.redo(source),projectState:()=>controller.projectState(),loadProject:(record,editorSource)=>controller.loadProject(record,editorSource),primitiveState:()=>controller.primitiveState(),createPrimitive:(request,editorSource)=>controller.createPrimitive(request,editorSource),updateDimensions:(request,editorSource)=>controller.updateDimensions(request,editorSource),parameterState:()=>controller.parameterState(),applyParameters:(request,editorSource)=>controller.applyParameters(request,editorSource),inspectObject:id=>controller.inspectObject(id),showSurface:id=>controller.showSurface(id),objects:()=>controller.objects(),inspection:()=>controller.inspection(),get inspectedId(){return controller.inspectedId;},setCamera:camera=>controller.setCamera(camera),apply:(source,options)=>controller.apply(source,options),select,snapshot:()=>controller.snapshot(),readPixels:()=>controller.readPixels(),shaders:()=>controller.shaders(),resize:(w,h)=>controller.resize(w,h),dispose:()=>{mouseOrbit.dispose();controller.dispose();},get renderer(){return controller.renderer;},get status(){return controller.status;},get available(){return controller.available;}};
window.addEventListener('pagehide',()=>{mouseOrbit.dispose();controller.dispose();},{once:true});
select(fixtures[0].id);
