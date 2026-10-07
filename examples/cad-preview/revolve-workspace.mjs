import * as cad from '/cad.js';
import * as gpu from '/gpu.js';
import {bindMouseOrbit} from '/orbit.mjs';
import {sameData} from '/screen-ray.mjs';

const $=id=>document.getElementById(id);
const defaultCamera={eye:[5,-7,5],target:[0,0,0],up:[0,0,1],fovYDegrees:45,near:.01,far:100};
let accepted,renderer,canvas,orbit,selectedPole=0,unavailable=false,disposed=false,opening=false;
let intentRevision=0,displayRevision=0,viewRevision=0,edges=true;
let failedFile=null;
let view={segmentsPerMeridianSpan:2,segmentsPerQuarter:8,orientation:'forward'};
const draft=new Map();
export function revolveSeed(){return{
 format:'barocss-z-axis-revolve-feature',version:0,id:'revolve_document',lengthUnit:'mm',
 meridian:{kind:'curve',id:'meridian_profile',degree:2,knots:[-2,-2,-2,0,2,4,4,4],controlPoints:[[3,-0,-5],[6,-0,-3],[8,-0,0],[5,-0,3],[4,-0,6]],weights:[1,.8,1.2,.75,1]},
 feature:{id:'revolve_feature',kind:'z-axis-revolve',surfaceId:'revolved_surface'},
};}
const displayNumber=n=>Object.is(n,-0)?'-0':String(n);
function message(text){$('rv-status').textContent=text;}
function controls(){for(const id of ['rv-new','rv-apply','rv-discard','rv-fit','rv-edges','rv-u','rv-v','rv-orientation','rv-radius','rv-z','rv-weight'])$(id).disabled=disposed||unavailable||opening;$('rv-save').disabled=!accepted||opening;$('rv-open').disabled=opening;}
function renderList(){
 const list=$('rv-list');list.replaceChildren();if(!accepted)return;
 const doc=accepted.native.document,lineage=document.createElement('div');lineage.className='editor-revolve-lineage';lineage.textContent=doc.meridian.id+' → '+doc.feature.id+' → '+doc.feature.surfaceId;list.append(lineage);
 for(let index=0;index<doc.meridian.controlPoints.length;index++){
  const button=document.createElement('button');button.type='button';button.dataset.id='pole_'+index;button.className='feature-row'+(index===selectedPole?' selected':'');button.textContent='Pole '+index+(draft.has(index)?' · pending':' · applied');button.addEventListener('click',()=>{selectedPole=index;renderList();renderSelected();});list.append(button);
 }
}
function renderSelected(){
 if(!accepted)return;const m=accepted.native.document.meridian,p=m.controlPoints[selectedPole],staged=draft.get(selectedPole)??{};
 for(const[key,id,value]of [['radiusMM','rv-radius',p[0]],['zMM','rv-z',p[2]],['weight','rv-weight',m.weights[selectedPole]]])$(id).value=staged[key]??displayNumber(value);
 $('rv-applied').textContent='Applied: radius '+displayNumber(p[0])+' mm · Z '+displayNumber(p[2])+' mm · weight '+displayNumber(m.weights[selectedPole]);
 $('rv-fixed').textContent='Fixed Y '+displayNumber(p[1])+' mm · degree '+m.degree+' · original knots ['+m.knots.map(displayNumber).join(', ')+']';
 controls();
}
for(const[id,key]of [['rv-radius','radiusMM'],['rv-z','zMM'],['rv-weight','weight']])$(id).addEventListener('input',()=>{draft.set(selectedPole,{...draft.get(selectedPole),[key]:$(id).value});renderList();message('Pole edits pending. Apply all staged poles or discard.');});
function dims(){const rect=$('rv-viewport').getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),factor=Math.min(1,4096/Math.max(1,rect.width*d),4096/Math.max(1,rect.height*d),Math.sqrt(4000000/Math.max(1,rect.width*rect.height*d*d)));return[Math.max(1,Math.floor(rect.width*d*factor)),Math.max(1,Math.floor(rect.height*d*factor))];}
function options(packet,fit){if(renderer&&!fit)return renderer.options;const span=packet.bounds.max.map((n,i)=>n-packet.bounds.min[i]),scale=3/Math.max(...span);return{mmToSceneUnit:scale,translate:packet.bounds.min.map((n,i)=>-(n+span[i]/2)*scale),color:[.35,.72,.72],background:[16/255,24/255,32/255],camera:structuredClone(defaultCamera)};}
function release(r,o,c){o?.dispose();r?.dispose();c?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();}
function viewFields(){ $('rv-u').value=String(view.segmentsPerMeridianSpan);$('rv-v').value=String(view.segmentsPerQuarter);$('rv-orientation').value=view.orientation; }
function diagnostics(){
 const {native,preview}=accepted;
 $('rv-boundaries').textContent='Three parameter boundaries: meridian start ring, meridian end ring, one meridian seam (V=0 and V=4).';
 $('rv-view-report').textContent=preview.report.panelCount+' panels · native midpoint faceted normals · '+view.orientation+' orientation';
 $('rv-details').textContent=JSON.stringify({bindings:native.report.bindings,preview:preview.report,boundaryProvenance:preview.boundaryProvenance,source:native.native.source},null,2);
}
function adopt(native,nextView=view,{intent=false,fit=false}={}){
 let candidate,nextCanvas,nextOrbit;
 try{
  if(unavailable||disposed)throw Error('View unavailable. Save accepted intent, then reload.');
  const preview=cad.tessellateZAxisRevolvedSurface(native.document.meridian,{surfaceId:native.document.feature.surfaceId,meshId:'revolve_display_mesh',revision:displayRevision+1,...nextView});
  if(!sameData(preview.native,native.native))throw Error('Native document and preview construction differ.');
  const packet=gpu.validatePreviewPacket(preview.packet),opts=options(packet,fit),overlay={version:0,packet:structuredClone(packet),paths:structuredClone(preview.boundaryPaths),color:[.06,.085,.11]};
  const compiled=gpu.compileGpu({kind:'mesh',packet,options:opts});if(!compiled.ok)throw Error(compiled.diagnostics[0].message);
  nextCanvas=document.createElement('canvas');nextCanvas.id='rv-preview';nextCanvas.tabIndex=0;nextCanvas.setAttribute('aria-label','Original revolved Surface; drag to orbit, wheel to zoom');[nextCanvas.width,nextCanvas.height]=dims();
  candidate=gpu.mountMesh(nextCanvas,packet,opts,edges?overlay:null);const mounted=candidate;
  nextOrbit=bindMouseOrbit(nextCanvas,{get available(){return renderer===mounted&&!unavailable&&!disposed;},snapshot:()=>({options:mounted.options,viewRevision}),setCamera(camera){const result=mounted.update(mounted.packet,{...mounted.options,camera});if(result.ok)viewRevision++;return result;}});
  nextCanvas.addEventListener('webglcontextlost',()=>{if(renderer!==mounted)return;unavailable=true;controls();message('View unavailable. Save accepted intent, then reload.');});
  const previous={renderer,canvas,orbit};$('rv-preview').replaceWith(nextCanvas);renderer=candidate;canvas=nextCanvas;orbit=nextOrbit;accepted={native,preview,compiled,overlay};view={...nextView};displayRevision=packet.revision;viewRevision++;
  if(intent){intentRevision++;failedFile=null;$('rv-file-error').textContent='';draft.clear();selectedPole=Math.min(selectedPole,native.document.meridian.controlPoints.length-1);renderList();renderSelected();}
  viewFields();diagnostics();release(previous.renderer,previous.orbit,previous.canvas);message(intent?'Original revolve document applied.':'View updated. Native document and pending pole edits retained.');return{ok:true};
 }catch(error){release(candidate,nextOrbit,nextCanvas);viewFields();message('Display rejected: '+error.message+' Native document remains valid; previous accepted frame and edits retained.');return{ok:false,error};}
}
function clean(){if(draft.size)throw Error('Apply or discard pending pole edits first.');}
function apply(){
 let native;
 try{
  if(!draft.size){message('No pole edits to apply.');return{ok:true};}
  const poleEdits=[...draft].map(([index,fields])=>{const edit={index};for(const[key,text]of Object.entries(fields)){if(text.trim()===''||!Number.isFinite(Number(text)))throw Error('Enter finite radius, Z and weight values.');edit[key]=Number(text);}return edit;});
  native=cad.updateZAxisRevolveFeatureDocument(accepted.native.document,{poleEdits});
 }catch(error){message('Native rejected: '+error.message+' Previous accepted frame and pole edits retained.');return{ok:false,error};}
 return adopt(native,view,{intent:true});
}
function newDocument(){try{clean();const result=cad.evaluateZAxisRevolveFeatureDocument(revolveSeed()),adopted=adopt(result,view,{intent:true,fit:true});if(adopted.ok){selectedPole=0;renderList();renderSelected();}return adopted;}catch(error){message('New rejected: '+error.message);return{ok:false,error};}}
$('rv-new').addEventListener('click',newDocument);$('rv-apply').addEventListener('click',apply);
$('rv-discard').addEventListener('click',()=>{draft.clear();renderList();renderSelected();message('Pending pole edits discarded.');});
$('rv-fit').addEventListener('click',()=>{const result=renderer.update(renderer.packet,options(renderer.packet,true));if(result.ok){viewRevision++;message('View fitted. Native document and pending pole edits retained.');}else message('Fit rejected: '+result.error.message);});
for(const id of ['rv-u','rv-v','rv-orientation'])$(id).addEventListener('change',()=>{try{const u=Number($('rv-u').value),v=Number($('rv-v').value);if(!Number.isInteger(u)||u<1||u>2||!Number.isInteger(v)||v<2||v>8)throw Error('Use integer sampling U1–2 and V2–8.');adopt(accepted.native,{segmentsPerMeridianSpan:u,segmentsPerQuarter:v,orientation:$('rv-orientation').value});}catch(error){viewFields();message('View settings rejected: '+error.message);}});
$('rv-edges').addEventListener('change',()=>{const next=$('rv-edges').checked,result=renderer.setEdgeOverlay(next?accepted.overlay:null);if(result.ok){edges=next;viewRevision++;message('Parameter boundary view changed. Native document and pending edits retained.');}else{$('rv-edges').checked=edges;message('Boundary view rejected: '+result.error.message);}});
$('rv-save').addEventListener('click',()=>{try{const text=cad.serializeZAxisRevolveFeatureDocument(accepted.native.document),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=accepted.native.document.id+'.barocad.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);message(draft.size?'Saved accepted authored revolve intent; pending pole edits excluded.':'Saved original authored revolve intent.');}catch(error){message('Save rejected: '+error.message);}});
$('rv-open').addEventListener('change',async()=>{
 try{const file=$('rv-open').files[0];if(!file)return;clean();opening=true;controls();if(file.size>131072)throw Error('Revolve file exceeds128KiB.');const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());let native;
  try{native=cad.evaluateZAxisRevolveFeatureDocument(cad.parseZAxisRevolveFeatureDocument(text));}catch(error){failedFile={name:file.name,text,nativeValid:false,error:error.message};$('rv-file-error').textContent='Rejected file: '+file.name+' · native admission failed';message('Native file rejected: '+error.message+' Previous accepted document/frame retained.');return;}
  const result=adopt(native,view,{intent:true});if(result.ok)message('Original authored revolve file opened and rebuilt.');else{failedFile={name:file.name,text,document:native.document,nativeValid:true,error:result.error.message};$('rv-file-error').textContent='Staged file: '+file.name+' · native valid, display refused. Accepted document is unchanged.';}
 }catch(error){message('Open rejected: '+error.message);}finally{opening=false;$('rv-open').value='';controls();}
});
function activate(){const active=location.hash==='#revolve';$('revolve-workspace').hidden=!active;if(active&&!accepted)newDocument();if(active&&renderer)renderer.resize(...dims());}
addEventListener('hashchange',activate);addEventListener('pagehide',()=>{disposed=true;release(renderer,orbit,canvas);},{once:true});
window.revolveWorkspace={snapshot:()=>accepted&&structuredClone({...accepted,packet:renderer.packet,edgeOverlay:renderer.edgeOverlay,options:renderer.options,view,intentRevision,displayRevision,viewRevision,pending:draft.size>0,selected:'pole_'+selectedPole,selectedPole,failedFile,draft:[...draft].map(([index,fields])=>({index,fields}))}),readPixels:()=>renderer.readPixels(),get renderer(){return renderer;}};
activate();
