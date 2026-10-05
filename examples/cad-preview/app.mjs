import * as cad from '/cad.js';
import * as gpu from '/gpu.js';
import { createPreviewController } from '/pipeline.mjs';
import { fixtures, constructionFixtures, objectFixtures, controlPointEdit, weightEdit, vectorEdit, constructionWeightEdit } from '/fixtures.mjs';
const $ = id => document.getElementById(id);
const canvas = $('preview');
const allFixtures = [...fixtures, ...constructionFixtures, ...objectFixtures];
const controller = createPreviewController(canvas, cad, gpu, (message, accepted) => {
  $('status').textContent = message;
  $('export').disabled = !accepted || !controller.available;
  if (accepted) {
    const { packet,report,options,revision,viewRevision } = accepted;
    $('summary').textContent = `Accepted model revision ${revision} · view revision ${viewRevision} · ${packet.surfaceId}\nCanonical bounds (mm): ${JSON.stringify(packet.bounds)}\nScene units/mm: ${options.mmToSceneUnit} · translation: ${JSON.stringify(options.translate)}\nVertices: ${packet.positions.length/3} · triangles: ${packet.indices.length/3}\nSampled maximum distance (mm): ${report.maxSampledDeviationMM}\nFinite samples only · certified: ${report.certified}`;
    $('source-version').value=String(accepted.sourceVersion ?? 0);
    renderObjects();
    $('details').textContent = JSON.stringify({sourceVersion:accepted.sourceVersion??0,constructions:accepted.constructions,selectedConstruction:accepted.selectedConstruction,model:accepted.model,report,camera:options.camera??'Original fixed default'},null,2);
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
function applyEditor() { return controller.apply($('source').value,settings()); }
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
function renderObjects() {
  const rows=controller.objects(), inspection=controller.inspection();
  const list=$('objects');list.replaceChildren();
  for (const object of rows) {
    const row=document.createElement('li');row.dataset.objectId=object.id;
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
  $('inspection').textContent=inspection ? `Inspected object: ${inspection.id} · ${inspection.kind}\nDisplayed surface: ${inspection.displayedSurfaceId}\nNative control-point bounds (mm; not tight surface extent): ${JSON.stringify(inspection.controlPointBoundsMM)}\nDisplayed sampled preview-mesh bounds (mm; not tight surface extent): ${JSON.stringify(inspection.displayedSampledMeshBoundsMM)}\n${JSON.stringify(inspection,null,2)}` : 'No accepted native object';
}
// Inspection API for the local evidence runner. No source-provided code is evaluated.
window.cadPreview={inspectObject:id=>controller.inspectObject(id),showSurface:id=>controller.showSurface(id),objects:()=>controller.objects(),inspection:()=>controller.inspection(),get inspectedId(){return controller.inspectedId;},setCamera:camera=>controller.setCamera(camera),apply:(source,options)=>controller.apply(source,options),select,snapshot:()=>controller.snapshot(),readPixels:()=>controller.readPixels(),shaders:()=>controller.shaders(),resize:(w,h)=>controller.resize(w,h),dispose:()=>controller.dispose(),get renderer(){return controller.renderer;},get status(){return controller.status;},get available(){return controller.available;}};
window.addEventListener('pagehide',()=>controller.dispose(),{once:true});
select(fixtures[0].id);
