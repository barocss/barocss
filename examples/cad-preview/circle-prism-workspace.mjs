import * as cad from '/cad.js';
import * as gpu from '/gpu.js';
import {bindMouseOrbit} from '/orbit.mjs';
const $=id=>document.getElementById(id);
const defaultCamera={eye:[4,3,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100};
let accepted,renderer,canvas,orbit,quality=8,intentRevision=0,displayRevision=0,viewRevision=0;
let pending=false,opening=false,disposed=false,unavailable=false,edges=true,previousHash=location.hash;
function status(text){$('cp-status').textContent=text;}
function seed(){return{format:'barocss-xy-circle-prism-feature',version:0,id:'circle_part_document',lengthUnit:'mm',sketch:{format:'barocss-xy-arc-sketch',version:0,id:'part_sketch',lengthUnit:'mm',workplane:'xy',profiles:[{id:'part_circle',kind:'circle',centerId:'part_center',centerMM:[2,-3],radius:{id:'part_radius',valueMM:4},seamId:'part_seam'}]},feature:{id:'circle_extrude',kind:'xy-circle-extrude',profileId:'part_circle',shellId:'part_shell',height:{id:'part_height',valueMM:6}}};}
function scalar(id){const n=$(id).valueAsNumber;if(!Number.isFinite(n))throw Error('Enter a finite number: '+id);return n;}
function sampleCount(){const k=$('cp-quality').valueAsNumber;if(!Number.isInteger(k)||k<2||k>15)throw Error('Sampling must be a whole number2–15 for the original edge paths.');return k;}
function controls(){
 for(const id of ['cp-x','cp-y','cp-radius','cp-height','cp-apply','cp-new','cp-quality','cp-fit','cp-edges'])$(id).disabled=opening||unavailable||disposed;
 $('cp-save').disabled=opening||!accepted;$('cp-open').disabled=opening;$('cp-discard').disabled=opening||!accepted;
}
function fields(){
 const d=accepted.native.document,p=d.sketch.profiles[0];
 for(const[id,n]of[['cp-x',p.centerMM[0]],['cp-y',p.centerMM[1]],['cp-radius',p.radius.valueMM],['cp-height',d.feature.height.valueMM]])$(id).value=Object.is(n,-0)?'-0':String(n);
 pending=false;
}
function metrics(){
 const {native,preview}=accepted;
 $('cp-quality').value=String(quality);
 $('cp-volume').textContent=native.report.referenceVolumeMM3.toPrecision(7)+' mm³';
 $('cp-area').textContent=preview.report.areasMM2.total.toPrecision(7)+' mm² (approximate)';
 $('cp-count').textContent=preview.packet.positions.length/3+' vertices / '+preview.packet.indices.length/3+' triangles';
 $('cp-deviation').textContent=preview.report.observedChordDeviationMM.toPrecision(5)+' mm (observed, not certified)';
 $('cp-ids').textContent='Profile: '+native.report.bindings.profileId+'\nShell: '+native.report.bindings.shellId+'\nFaces: '+preview.faceRanges.map(face=>face.faceId).join(', ')+'\nEdges: '+preview.edgePaths.map(path=>path.id).join(', ');
 controls();
}
function dims(){const r=$('cp-viewport').getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.min(4096,Math.round(r.width*d))),h=Math.max(1,Math.min(4096,Math.round(r.height*d))),s=Math.min(1,Math.sqrt(4000000/(w*h)));return[Math.max(1,Math.floor(w*s)),Math.max(1,Math.floor(h*s))];}
function options(packet,fit){
 if(renderer&&!fit)return renderer.options;
 const span=packet.bounds.max.map((n,i)=>n-packet.bounds.min[i]),scale=3/Math.max(...span);
 return{mmToSceneUnit:scale,translate:packet.bounds.min.map((n,i)=>-(n+span[i]/2)*scale),color:[.82,.55,.36],background:[16/255,24/255,32/255],camera:structuredClone(defaultCamera)};
}
function release(r,o,c){o?.dispose();r?.dispose();c?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();}
function adopt(native,k,{intent=false,fit=false}={}){
 let next,c,o;
 try{
  if(disposed||unavailable)throw Error('View unavailable. Save accepted intent, then reload.');
  const preview=cad.tessellateXYCirclePrismShell(native.shell.bundle,{meshId:'circle_prism_display_mesh',revision:displayRevision+1,segmentsPerQuarter:k});
  const packet=gpu.validatePreviewPacket(preview.packet),opts=options(packet,fit),overlay={version:0,packet:structuredClone(packet),paths:structuredClone(preview.edgePaths),color:[.06,.085,.11]};
  const compiled=gpu.compileGpu({kind:'mesh',packet,options:opts});if(!compiled.ok)throw Error(compiled.diagnostics[0].message);
  c=document.createElement('canvas');c.id='cp-preview';c.tabIndex=0;c.setAttribute('aria-label','Original circle prism; drag to orbit');[c.width,c.height]=dims();
  next=gpu.mountMesh(c,packet,opts,edges?overlay:null);const mounted=next;
  o=bindMouseOrbit(c,{get available(){return renderer===mounted&&!unavailable&&!disposed;},snapshot:()=>({options:mounted.options,viewRevision}),setCamera(camera){const result=mounted.update(mounted.packet,{...mounted.options,camera});if(result.ok)viewRevision++;return result;}});
  c.addEventListener('webglcontextlost',()=>{if(renderer!==mounted)return;unavailable=true;controls();status('View unavailable. Save accepted native intent, then reload.');});
  const old={renderer,orbit,canvas};$('cp-preview').replaceWith(c);renderer=next;orbit=o;canvas=c;
  accepted={native,preview,compiled,overlay};quality=k;displayRevision=packet.revision;if(intent)intentRevision++;viewRevision++;
  if(intent)fields();metrics();release(old.renderer,old.orbit,old.canvas);
  status(intent?'Original circle prism intent applied.':'Display updated. Native intent unchanged.');return{ok:true};
 }catch(error){
  release(next,o,c);$('cp-quality').value=String(quality);const message='Display rejected: '+error.message;status(message);return{ok:false,error:message};
 }
}
function clean(){if(pending)throw Error('Apply or discard pending circle prism fields first.');}
function create(){try{clean();return adopt(cad.evaluateXYCirclePrismDocument(seed()),quality,{intent:true,fit:true});}catch(error){status('Create rejected: '+error.message);return{ok:false};}}
function apply(){
 try{return adopt(cad.updateXYCirclePrismDocument(accepted.native.document,{centreMM:[scalar('cp-x'),scalar('cp-y')],radiusMM:scalar('cp-radius'),heightMM:scalar('cp-height')}),quality,{intent:true});}
 catch(error){status('Cannot apply native intent: '+error.message);return{ok:false,error:error.message};}
}
for(const id of ['cp-x','cp-y','cp-radius','cp-height'])$(id).addEventListener('input',()=>{pending=true;status('Circle prism fields pending. Apply or discard.');});
$('cp-apply').addEventListener('click',apply);$('cp-new').addEventListener('click',create);
$('cp-discard').addEventListener('click',()=>{fields();status('Pending circle prism fields discarded.');});
$('cp-quality').addEventListener('change',()=>{try{const k=sampleCount();if(k===quality)return;adopt(accepted.native,k);}catch(error){$('cp-quality').value=String(quality);status(error.message);}});
$('cp-fit').addEventListener('click',()=>adopt(accepted.native,quality,{fit:true}));
$('cp-edges').addEventListener('change',()=>{
 const enabled=$('cp-edges').checked,result=renderer.setEdgeOverlay(enabled?accepted.overlay:null);
 if(!result.ok){$('cp-edges').checked=edges;status(result.error.message);return;}
 edges=enabled;viewRevision++;status('Original edge view changed. Native intent unchanged.');
});
$('cp-save').addEventListener('click',()=>{
 try{const text=cad.serializeXYCirclePrismDocument(accepted.native.document),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=accepted.native.document.id+'.barocad.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);status(pending?'Download requested for accepted native intent; draft excluded.':'Native circle prism intent download requested.');}
 catch(error){status('Save rejected: '+error.message);}
});
$('cp-open').addEventListener('change',async()=>{
 try{const file=$('cp-open').files[0];if(!file)return;clean();if(file.size>131072)throw Error('Native intent exceeds128KiB');opening=true;controls();const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()),document=cad.parseXYCirclePrismDocument(text),result=adopt(cad.evaluateXYCirclePrismDocument(document),quality,{intent:true});if(!result.ok)throw Error(result.error);status('Original circle prism intent opened and rebuilt.');}
 catch(error){status('Open rejected: '+error.message);}
 finally{opening=false;$('cp-open').value='';controls();}
});
for(const anchor of $('circle-prism-workspace').querySelectorAll('a'))anchor.addEventListener('click',event=>{if(pending){event.preventDefault();status('Apply or discard pending fields before leaving.');}});
function hideOther(){for(const id of ['surface-workspace','body-workspace','polygon-workspace','cutout-workspace','rectangle-feature-workspace','circle-face-workspace'])$(id).hidden=true;}
function activate(){
 if(previousHash==='#circle-prism'&&location.hash!=='#circle-prism'&&pending){history.replaceState(null,'','#circle-prism');hideOther();status('Apply or discard pending fields before leaving.');return;}
 previousHash=location.hash;const active=location.hash==='#circle-prism';$('circle-prism-workspace').hidden=!active;
 if(active){hideOther();if(!accepted)create();if(renderer&&!unavailable)renderer.resize(...dims());}
}
addEventListener('hashchange',activate);
addEventListener('resize',()=>{if(renderer&&!unavailable&&!disposed&&!$('circle-prism-workspace').hidden)renderer.resize(...dims());});
addEventListener('pagehide',()=>{disposed=true;release(renderer,orbit,canvas);},{once:true});
window.circlePrismWorkspace={editor:{get position(){return accepted?.native.document.sketch.profiles[0].centerMM.slice();},moveTo(position){['cp-x','cp-y'].forEach((id,i)=>{$(id).value=String(position[i]);});pending=true;return apply();}},snapshot:()=>accepted&&structuredClone({...accepted,packet:renderer.packet,edgeOverlay:renderer.edgeOverlay,options:renderer.options,quality,intentRevision,displayRevision,viewRevision,pending}),readPixels:()=>renderer.readPixels(),get renderer(){return renderer;}};
activate();
