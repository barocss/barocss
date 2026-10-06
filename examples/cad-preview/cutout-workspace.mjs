import * as cad from '/cad.js';
import * as gpu from '/gpu.js';
import {screenRay,sameData} from '/screen-ray.mjs';
import {bindMouseOrbit} from '/orbit.mjs';
const $=id=>document.getElementById(id);
const initialCamera={eye:[3,2.5,8],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100};
let selection=null;
let accepted,renderer,orbit,canvas,revision=0,viewRevision=0,pending=false,opening=false,unavailable=false,disposed=false,edges=true;
function status(text){$('cut-status').textContent=text;}
function template(){return{format:'barocss-xy-polygon-prism-hole-feature',version:0,id:'cutout_document',lengthUnit:'mm',profiles:{outer:{id:'cutout_outer',kind:'xy-polygon',points:[[0,0],[10,0],[10,10],[0,10]]},hole:{id:'cutout_hole',kind:'xy-polygon',points:[[3,3],[7,3],[7,7],[3,7]]}},feature:{id:'cutout_extrusion',kind:'xy-polygon-prism-with-hole',outerProfileId:'cutout_outer',holeProfileId:'cutout_hole',faceId:'cutout_face',bodyId:'cutout_body',distanceMM:6}};}
const number=n=>Object.is(n,-0)?'-0':String(n);
function pointText(points){return '['+points.map(p=>'['+p.map(number).join(', ')+']').join(',\n ')+']';}
function points(id){const text=$(id).value;if(text.length>4096)throw Error('Profile text exceeds4096 characters.');let value;try{value=JSON.parse(text);}catch{throw Error('Enter a JSON list of integer XY pairs.');}if(!Array.isArray(value)||value.length<3||value.length>9||value.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isInteger(n)||Math.abs(n)>10000)))throw Error('Each loop needs3–9 integer XY pairs within ±10000mm.');return value;}
function height(){const value=$('cut-height').valueAsNumber;if(!Number.isInteger(value)||value<1||value>10000)throw Error('Height must be a whole millimetre from1 to10000.');return value;}
function dimensions(){const r=$('cut-viewport').getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.min(4096,Math.round(r.width*d))),h=Math.max(1,Math.min(4096,Math.round(r.height*d))),scale=Math.min(1,Math.sqrt(4000000/(w*h)));return[Math.max(1,Math.floor(w*scale)),Math.max(1,Math.floor(h*scale))];}
function options(packet){const size=packet.bounds.max.map((v,i)=>v-packet.bounds.min[i]),scale=3/Math.max(...size);return{mmToSceneUnit:scale,translate:packet.bounds.min.map((v,i)=>-(v+size[i]/2)*scale),color:[.82,.55,.36],background:[16/255,24/255,32/255],camera:structuredClone(renderer?.options.camera??initialCamera)};}
function overlay(candidate,packet){return{version:0,packet:structuredClone(packet),paths:structuredClone(candidate.evaluation.preview.edgePaths),color:[.06,.085,.11]};}
function controls(){for(const id of ['cut-outer','cut-hole','cut-height','cut-apply','cut-new','cut-edges','cut-mode','cut-clear-selection'])$(id).disabled=opening||unavailable||disposed;$('cut-discard').disabled=opening||!accepted;$('cut-open').disabled=opening||disposed;$('cut-save').disabled=opening||!accepted||disposed;}
function refresh(){const d=accepted.document;$('cut-outer').value=pointText(d.profiles.outer.points);$('cut-hole').value=pointText(d.profiles.hole.points);$('cut-height').value=String(d.feature.distanceMM);$('cut-area').textContent=accepted.evaluation.face.report.areasMM2.net+' mm²';$('cut-volume').textContent=accepted.evaluation.shell.report.referenceSweptVolumeMM3+' mm³';$('cut-bounds').textContent=accepted.evaluation.preview.packet.bounds.min.join(', ')+' → '+accepted.evaluation.preview.packet.bounds.max.join(', ');pending=false;controls();}
function release(r,o,c){o?.dispose();r?.dispose();c?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();}
function adopt(candidate){let nextRenderer,nextOrbit,nextCanvas;try{
 if(disposed||unavailable)throw Error('View unavailable. Save accepted intent, then reload this tool.');
 const packet=gpu.validatePreviewPacket(candidate.evaluation.preview.packet),opts=options(packet),edgeData=edges?overlay(candidate,packet):null;
 nextCanvas=document.createElement('canvas');nextCanvas.id='cut-preview';nextCanvas.tabIndex=0;nextCanvas.setAttribute('aria-label','Cutout prism preview; drag to orbit');[nextCanvas.width,nextCanvas.height]=dimensions();
 nextRenderer=gpu.mountMesh(nextCanvas,packet,opts,edgeData);
 const mounted=nextRenderer;
 nextOrbit=bindMouseOrbit(nextCanvas,{get available(){return renderer===mounted&&!unavailable&&!disposed&&$('cut-mode').value==='orbit';},snapshot:()=>({options:mounted.options,viewRevision}),setCamera(next){const result=mounted.update(mounted.packet,{...mounted.options,camera:next});if(result.ok)viewRevision++;return result;}});
 nextCanvas.addEventListener('pointerup',event=>{if(event.pointerType==='mouse'&&event.isPrimary&&event.button===0&&$('cut-mode').value==='select'&&renderer===mounted)pick(event);});
 nextCanvas.addEventListener('webglcontextlost',()=>{if(renderer!==mounted)return;unavailable=true;controls();status('View unavailable. Save accepted intent, then reload this tool.');});
 const previous={renderer,orbit,canvas};$('cut-preview').replaceWith(nextCanvas);renderer=nextRenderer;orbit=nextOrbit;canvas=nextCanvas;accepted=candidate;revision=packet.revision;viewRevision++;selection=null;selectionText();refresh();release(previous.renderer,previous.orbit,previous.canvas);status('Applied original profiles and height.');return{ok:true};
 }catch(error){release(nextRenderer,nextOrbit,nextCanvas);status('Cannot apply: '+error.message);return{ok:false,error:error.message};}}
function requireClean(){if(pending)throw Error('Apply or discard the pending draft first.');}
function create(){try{requireClean();return adopt(cad.evaluateXYPolygonPrismHoleDocument(template(),{revision:revision+1}));}catch(error){status('Create rejected: '+error.message);return{ok:false,error:error.message};}}
function apply(){try{if(opening)throw Error('A file is opening.');const outerPoints=points('cut-outer'),holePoints=points('cut-hole');if(outerPoints.length+holePoints.length>12)throw Error('At most12 vertices across both loops.');return adopt(cad.updateXYPolygonPrismHoleDocument(accepted.document,{outerPoints,holePoints,distanceMM:height()},{revision:revision+1}));}catch(error){status('Cannot apply: '+error.message);return{ok:false,error:error.message};}}
for(const id of ['cut-outer','cut-hole','cut-height'])$(id).addEventListener('input',()=>{pending=true;status('Draft pending. Apply both profiles and height together.');});
function selectionText(){const text=selection?.selected?`${selection.selected.role} · ${selection.selected.faceId}
Surface: ${selection.selected.surfaceId}
Point mm: ${selection.selected.pointMM.map(n=>n.toFixed(4)).join(', ')}
Normal: ${selection.selected.outwardNormal.map(n=>n.toFixed(4)).join(', ')}`:selection?`${selection.result.status}
Candidates: ${[...selection.result.hits,...selection.result.coplanarFaces].map(h=>h.faceId).join(', ')||'none'}`:'No face selected.';$('cut-selection').textContent=text;}
function clearSelection(){const result=renderer.setFaceHighlight(null);if(!result.ok){status('Selection unavailable: '+result.error.message);return;}selection=null;selectionText();}
function pick(event){try{
 if(unavailable||disposed||opening||!accepted)throw Error('Selection unavailable');
 const binding={accepted,renderer,canvas,revision,viewRevision,packet:renderer.packet,options:renderer.options},ray=screenRay(canvas,binding.options,event.clientX,event.clientY,gpu),result=cad.queryXYPolygonPrismShellWithHoleRay(accepted.evaluation.shell.shell,ray.query),now=canvas.getBoundingClientRect();
 if(binding.accepted!==accepted||binding.renderer!==renderer||binding.canvas!==canvas||binding.revision!==revision||binding.viewRevision!==viewRevision||!sameData(binding.packet,renderer.packet)||!sameData(binding.options,renderer.options)||ray.viewport.bufferWidth!==canvas.width||ray.viewport.bufferHeight!==canvas.height||now.left!==ray.viewport.left||now.top!==ray.viewport.top||now.width!==ray.viewport.width||now.height!==ray.viewport.height)throw Error('Selection binding became stale');
 const selected=result.status==='unique-hit'?result.hits[0]:null;let highlight=null;
 if(selected){const matches=accepted.evaluation.preview.faceRanges.filter(r=>r.faceId===selected.faceId&&r.surfaceId===selected.surfaceId);if(matches.length!==1)throw Error('Original face range does not resolve uniquely');highlight={version:0,packet:binding.packet,faceId:selected.faceId,indexRange:matches[0].indexRange,color:[.15,.5,1]};}
 const shown=renderer.setFaceHighlight(highlight);if(!shown.ok)throw shown.error;
 selection={selected,ray,result,binding:{documentId:accepted.document.id,revision,viewRevision},highlight:renderer.faceHighlight};selectionText();status(selected?'Original face selected.':result.status==='miss'?'No original face hit.':'Ambiguous original faces; no single face selected.');
 }catch(error){status('Selection unavailable: '+error.message);}}
$('cut-clear-selection').addEventListener('click',clearSelection);
$('cut-mode').addEventListener('change',()=>status($('cut-mode').value==='select'?'Click to select an original face.':'Drag to orbit the camera.'));
$('cut-new').addEventListener('click',create);$('cut-apply').addEventListener('click',apply);$('cut-discard').addEventListener('click',()=>{refresh();status('Pending draft discarded.');});
$('cut-edges').addEventListener('change',()=>{try{const enabled=$('cut-edges').checked,result=renderer.setEdgeOverlay(enabled?overlay(accepted,renderer.packet):null);if(!result.ok)throw result.error;edges=enabled;viewRevision++;status('Edge view changed. Original intent is unchanged.');}catch(error){$('cut-edges').checked=edges;status(error.message);}});
$('cut-save').addEventListener('click',()=>{try{const text=cad.serializeXYPolygonPrismHoleDocument(accepted.document),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=accepted.document.feature.bodyId+'.barocad.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);status(pending?'Download requested for accepted intent. Pending draft was excluded.':'Native cutout intent download requested.');}catch(error){status('Save rejected: '+error.message);}});
$('cut-open').addEventListener('change',async()=>{try{const file=$('cut-open').files[0];if(!file)return;requireClean();if(file.size>128*1024)throw Error('Native document exceeds128KiB.');opening=true;controls();const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()),document=cad.parseXYPolygonPrismHoleDocument(text),candidate=cad.evaluateXYPolygonPrismHoleDocument(document,{revision:revision+1}),result=adopt(candidate);if(!result.ok)throw Error(result.error);status('Original cutout intent opened and rebuilt.');}catch(error){status('Open rejected: '+error.message);}finally{opening=false;$('cut-open').value='';controls();}});
function activate(){const active=location.hash==='#cutout-prism';$('cutout-workspace').hidden=!active;if(active){for(const id of ['surface-workspace','body-workspace','polygon-workspace'])$(id).hidden=true;if(!accepted)create();if(renderer&&!unavailable)renderer.resize(...dimensions());}}
addEventListener('hashchange',activate);addEventListener('resize',()=>{if(renderer&&!unavailable&&!disposed&&!$('cutout-workspace').hidden)try{renderer.resize(...dimensions());}catch(error){status(error.message);}});addEventListener('pagehide',()=>{disposed=true;release(renderer,orbit,canvas);},{once:true});
window.cutoutWorkspace={snapshot:()=>accepted&&structuredClone({...accepted,packet:renderer.packet,overlay:renderer.edgeOverlay,options:renderer.options,revision,viewRevision,pending,selection,highlight:renderer.faceHighlight}),readPixels:()=>renderer.readPixels(),get renderer(){return renderer;}};
activate();
