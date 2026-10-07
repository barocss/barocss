import * as cad from '/cad.js';
import * as gpu from '/gpu.js';
import { bindMouseOrbit } from '/orbit.mjs';

const $ = id => document.getElementById(id);
const presets = { triangle: [[0,0],[3,0],[0,3]], L: [[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]] };
let accepted, renderer, orbit, revision = 0, viewRevision = 0, unavailable = false, opening = false, disposed = false;
const camera = { eye:[4,3,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100 };
function status(text) { $('poly-status').textContent = text; }
function template(points) {
  return { format:'barocss-xy-polygon-prism-feature',version:0,id:'polygon_document',lengthUnit:'mm',
    profile:{id:'polygon_profile',kind:'xy-polygon',points:structuredClone(points)},
    feature:{id:'polygon_extrusion',kind:'xy-polygon-prism-preview',profileId:'polygon_profile',bodyId:'polygon_body',distanceMM:6} };
}
function rows(points) {
  $('poly-points').replaceChildren();
  points.forEach((point,i) => {
    const row=document.createElement('tr'), number=document.createElement('th');number.textContent=String(i+1);row.append(number);
    for(let axis=0;axis<2;axis++) {
      const cell=document.createElement('td'), input=document.createElement('input');input.type='number';input.step='1';input.min='-10000';input.max='10000';input.value=String(point[axis]);input.id=`poly-${axis?'y':'x'}-${i}`;input.setAttribute('aria-label',`Point ${i+1} ${axis?'Y':'X'} millimetres`);input.addEventListener('input',()=>status('Coordinates pending. Apply to rebuild the prism.'));cell.append(input);row.append(cell);
    }
    const cell=document.createElement('td'), remove=document.createElement('button');remove.textContent='−';remove.setAttribute('aria-label',`Remove point ${i+1}`);remove.disabled=points.length<=3;remove.addEventListener('click',()=>{try{const draft=readPoints();if(draft.length<=3)return;draft.splice(i,1);rows(draft);status('Vertex removed from draft. Apply to rebuild.');}catch(error){status(error.message);}});cell.append(remove);row.append(cell);$('poly-points').append(row);
  });
}
function integer(input) { const value=input.valueAsNumber;if(!Number.isInteger(value))throw Error('Enter whole millimetres.');return value; }
function readPoints() { return [...$('poly-points').querySelectorAll('tr')].map(row=>[...row.querySelectorAll('input')].map(integer)); }
function dirty() {
  if(!accepted)return false;
  try{return JSON.stringify(readPoints())!==JSON.stringify(accepted.document.profile.points)||integer($('poly-height'))!==accepted.document.feature.distanceMM;}catch{return true;}
}
function dimensions() { const rect=$('poly-viewport').getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);let w=Math.max(1,Math.min(4096,Math.round(rect.width*dpr))),h=Math.max(1,Math.min(4096,Math.round(rect.height*dpr)));const scale=Math.min(1,Math.sqrt(4_000_000/(w*h)));return[Math.floor(w*scale),Math.floor(h*scale)]; }
function options(packet) {const size=packet.bounds.max.map((v,i)=>v-packet.bounds.min[i]),scale=3/Math.max(...size);return{mmToSceneUnit:scale,translate:packet.bounds.min.map((v,i)=>-(v+size[i]/2)*scale),color:[.82,.55,.36],background:[16/255,24/255,32/255],camera:structuredClone(renderer?.options.camera??camera)};}
function controls() {for(const id of ['poly-apply','poly-triangle','poly-L','poly-add'])$(id).disabled=unavailable||opening||disposed;for(const input of $('poly-points').querySelectorAll('input,button'))input.disabled=opening||unavailable||(input.tagName==='BUTTON'&&$('poly-points').children.length<=3);$('poly-height').disabled=opening||unavailable;$('poly-open').disabled=opening;$('poly-save').disabled=!accepted||opening;}
function refresh() {rows(accepted.document.profile.points);$('poly-height').value=String(accepted.document.feature.distanceMM);const report=accepted.evaluation.prism.report;$('poly-volume').textContent=report.volumeMM3+' mm³';$('poly-area').textContent=new Intl.NumberFormat('en',{maximumFractionDigits:4}).format(report.areaMM2)+' mm²';$('poly-bounds').textContent=report.boundsMM.min.join(', ')+' → '+report.boundsMM.max.join(', ');controls();}
function bind(canvas) {
  canvas.addEventListener('webglcontextlost',()=>{unavailable=true;controls();status('View unavailable. Reload this tool after saving the document.');});
  orbit=bindMouseOrbit(canvas,{get available(){return !!renderer&&!unavailable&&!disposed;},snapshot:()=>accepted&&{options:renderer.options,viewRevision},setCamera(next){const result=renderer.update(renderer.packet,{...renderer.options,camera:next});if(result.ok)viewRevision++;return result;}});
}
function adopt(candidate) {
  try {
    if(unavailable||disposed)throw Error('View unavailable');
    const packet=candidate.evaluation.packet;cad.validatePreviewPacket(packet);gpu.validatePreviewPacket(packet);
    if(renderer){const result=renderer.update(packet,options(packet),null);if(!result.ok)throw result.error;}
    else{const canvas=$('poly-preview');[canvas.width,canvas.height]=dimensions();renderer=gpu.mountMesh(canvas,packet,options(packet));bind(canvas);}
    accepted=candidate;revision=packet.revision;viewRevision++;refresh();status('Prism rebuilt from the applied coordinates.');return{ok:true};
  }catch(error){status('Cannot apply: '+error.message);return{ok:false,error:error.message};}
}
function create(kind) {try{return adopt(cad.evaluateXYPolygonPrismDocument(template(presets[kind]),{revision:revision+1}));}catch(error){status(error.message);return{ok:false,error:error.message};}}
function apply() {try{if(opening)throw Error('A file is opening');return adopt(cad.updateXYPolygonPrismDocument(accepted.document,{points:readPoints(),distanceMM:integer($('poly-height'))},{revision:revision+1}));}catch(error){status('Cannot apply: '+error.message);return{ok:false,error:error.message};}}
$('poly-triangle').addEventListener('click',()=>create('triangle'));
$('poly-L').addEventListener('click',()=>create('L'));
$('poly-apply').addEventListener('click',apply);
$('poly-discard').addEventListener('click',()=>{refresh();status('Draft coordinates discarded.');});
$('poly-add').addEventListener('click',()=>{try{const points=readPoints();if(points.length>=63)throw Error('At most63 vertices');points.push([0,0]);rows(points);status('Vertex added to draft. Set its coordinates, then Apply.');}catch(error){status(error.message);}});
$('poly-height').addEventListener('input',()=>status('Height pending. Apply to rebuild.'));
$('poly-save').addEventListener('click',()=>{if(!accepted)return;const text=cad.serializeXYPolygonPrismDocument(accepted.document),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=accepted.document.feature.bodyId+'.barocad.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);status(dirty()?'Download requested for the applied prism. Draft values were not included.':'Native prism document download requested.');});
$('poly-open').addEventListener('change',async()=>{try{const file=$('poly-open').files[0];if(!file)return;if(dirty())throw Error('Apply or discard the pending coordinates first.');if(file.size>128*1024)throw Error('Document exceeds128KiB');opening=true;controls();const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()),document=cad.parseXYPolygonPrismDocument(text),candidate=cad.evaluateXYPolygonPrismDocument(document,{revision:revision+1});opening=false;const result=adopt(candidate);if(!result.ok)throw Error(result.error);status('Original prism document opened and rebuilt.');}catch(error){status('Open rejected: '+error.message);}finally{opening=false;$('poly-open').value='';controls();}});
function activate() {const active=location.hash==='#polygon-prism';$('polygon-workspace').hidden=!active;if(active){$('surface-workspace').hidden=true;$('body-workspace').hidden=true;if(!accepted)create('L');if(renderer&&!unavailable)renderer.resize(...dimensions());}}
addEventListener('hashchange',activate);addEventListener('resize',()=>{if(renderer&&!unavailable&&!disposed&&!$('polygon-workspace').hidden)renderer.resize(...dimensions());});addEventListener('pagehide',()=>{disposed=true;orbit?.dispose();renderer?.dispose();},{once:true});
window.polygonWorkspace={get pending(){return dirty();},snapshot:()=>accepted&&structuredClone({...accepted,packet:renderer.packet,options:renderer.options,revision,viewRevision}),readPixels:()=>renderer.readPixels(),get renderer(){return renderer;}};
activate();
