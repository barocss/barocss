import * as gpu from '/gpu.js';
import * as cad from '/cad.js';
import {fixtures,constructionFixtures,objectFixtures,parameterFixture} from './fixtures.mjs';
import {prepareCandidate} from './pipeline.mjs';
import {prepareNativeTopologyPreview} from './native-topology-preview.mjs';
import {prepareBoxPreview} from './box-preview.mjs';
import {bindMouseOrbit,defaultOrbitCamera} from './orbit.mjs';
const viewer=document.getElementById('viewer'),picker=document.getElementById('example'),error=document.getElementById('error');
const scene=(name,objects,styles)=>`@scene ${name}{version:0;background:#101820;${objects}}${styles}`;
const examples=[
 {id:'sphere',label:'GPU · Sphere',kind:'sdf',source:scene('sphere','sphere #ball;','#ball{radius:1;color:#ee7358;}')},
 {id:'box',label:'GPU · Box',kind:'sdf',source:scene('box','box #block;','#block{size:2 2 2;color:#7cd8ca;}')},
 {id:'sphere-box',label:'GPU · Sphere + Box',kind:'sdf',source:scene('pair','sphere #ball;box #block;','#ball{radius:.8;translate:-1 0 0;color:#ee7358;}#block{size:1.2 1.2 1.2;translate:1 0 0;color:#7cd8ca;}')},
 {id:'torus',label:'GPU · Torus',kind:'sdf',sourceVersion:1,camera:{...defaultOrbitCamera,eye:[0,6,0],up:[0,0,-1]},source:'@scene ring{version:1;torus #ring;}#ring{major-radius:1;minor-radius:.25;color:#7cd8ca;}'},
 {id:'rounded-box',label:'GPU · Rounded box',kind:'sdf',sourceVersion:1,source:'@scene rounded{version:1;rounded-box #block;}#block{size:2 2 2;radius:.35;color:#7cd8ca;}'},
 {id:'capsule',label:'GPU · Capsule',kind:'sdf',sourceVersion:1,camera:{...defaultOrbitCamera,eye:[3,2.5,7]},source:'@scene struts{version:1;capsule #strut;cylinder #post;box #block;}capsule{start:0 -1 0;end:0 1 0;radius:.4;color:#80d0a0;}#strut{rotate-x:20deg;rotate-z:-20deg;translate:-1.3 0 0;}#post{radius:.4;height:1.5;translate:.5 0 0;color:#e08040;}#block{size:.7 .7 .7;translate:1.6 0 0;color:#4090e0;}'},
 {id:'cylinder',label:'GPU · Cylinder',kind:'sdf',sourceVersion:1,camera:{...defaultOrbitCamera,eye:[3,2.5,7]},source:'@scene posts{version:1;background:#101820;cylinder #post;box #block;sphere #ball;}cylinder{radius:.6;height:2;color:#e08040;}#post{translate:-1.4 0 0;rotate-x:20deg;rotate-z:-15deg;}#block{size:1 1 1;translate:.4 0 0;color:#4090e0;}#ball{radius:.4;translate:1.7 0 0;color:#80d040;}'},
 {id:'rotated-box',label:'GPU · Rotated box',kind:'sdf',sourceVersion:1,source:'@scene tilted{version:1;background:#101820;box #block;sphere #ball;}#block{size:1 2 .8;rotate-x:20deg;rotate-y:35deg;rotate-z:-10deg;color:#e08040;}#ball{radius:.6;translate:1.4 0 0;color:#4090e0;}'},
 {id:'cad-native-l-shell',label:'CAD · Original L shell + edges',kind:'native-shell'},
 {id:'cad-native-hole-shell',label:'CAD · Through-hole shell + edges',kind:'native-hole-shell'},
 {id:'cad-native-hole-face',label:'CAD · Planar face with hole + edges',kind:'native-hole'},
 {id:'native-box',label:'CAD · Six-face box',kind:'box'},
 {id:'cad-triangle-region',label:'CAD · Triangle filled region',kind:'region',request:{id:'gallery_triangle',points:[[0,0],[3,0],[0,3]]}},
 {id:'cad-l-region',label:'CAD · L filled region',kind:'region',request:{id:'gallery_L',points:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]]}},
 {id:'cad-triangle-prism',label:'CAD · Triangle prism preview',kind:'prism',request:{id:'gallery_triangle',points:[[0,0],[3,0],[0,3]]}},
 {id:'cad-l-prism',label:'CAD · L prism preview',kind:'prism',request:{id:'gallery_L',points:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]]}},

 ...[...fixtures,...constructionFixtures,...objectFixtures,parameterFixture].map(f=>({id:'cad-'+(f.selectorId??f.id),label:'CAD · '+f.label,kind:'surface',fixture:f})),
];
let active,disposed=false;
function dimensions(){const w=Math.max(1,Math.floor(innerWidth*devicePixelRatio)),h=Math.max(1,Math.floor(innerHeight*devicePixelRatio)),factor=Math.min(1,4096/w,4096/h,Math.sqrt(4194304/(w*h)));return[Math.max(1,Math.floor(w*factor)),Math.max(1,Math.floor(h*factor))];}
function release(state){if(!state)return;state.orbit?.dispose();state.renderer.dispose();state.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();}
function select(id){
 if(disposed)return false;
 const example=examples.find(x=>x.id===id);if(!example)throw new RangeError('Unknown example');
 const canvas=document.createElement('canvas');canvas.id='preview';canvas.tabIndex=0;canvas.setAttribute('aria-label',example.label);[canvas.width,canvas.height]=dimensions();
 let renderer,packet,options,native,overlay;
 try{
  if(example.kind==='sdf')renderer=gpu.mountScene(canvas,example.source,example.camera??defaultOrbitCamera,example.sourceVersion===1?{sourceVersion:1}:undefined);
  else{
   if(example.kind==='native-shell'||example.kind==='native-hole'||example.kind==='native-hole-shell'){({native,packet,options,overlay}=prepareNativeTopologyPreview(example.kind,cad,gpu));}
   else if(example.kind==='box'){native=prepareBoxPreview({id:'gallery_box',origin:[0,0,0],sides:[2,3,5],revision:1},cad);packet=native.packet;options={mmToSceneUnit:.5,translate:[-.5,-.75,-1.25],color:[.25,.8,.75],background:[16/255,24/255,32/255],camera:{eye:[4,3,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100}};}
   else if(example.kind==='region'||example.kind==='prism'){
    const authoring=cad.buildXYPolygonRegion(example.request);
    const preview=example.kind==='region'?cad.tessellateXYPolygonRegion(authoring.curve,{meshId:example.request.id+'_mesh',revision:1}):cad.buildXYPolygonPrismPreview({bodyId:example.request.id+'_body',profile:authoring.curve,distanceMM:6,revision:1});
    packet=preview.packet;native={authoring,preview};
    const extents=packet.bounds.max.map((value,i)=>value-packet.bounds.min[i]),scale=3/Math.max(...extents);
    options={mmToSceneUnit:scale,translate:packet.bounds.min.map((value,i)=>-(value+extents[i]/2)*scale),color:example.kind==='region'?[.3,.76,.69]:[.82,.55,.36],background:[16/255,24/255,32/255],camera:example.kind==='region'?structuredClone(defaultOrbitCamera):{...structuredClone(defaultOrbitCamera),eye:[4,3,6]}};
   }
   else{const f=example.fixture,candidate=prepareCandidate(f.source,{sourceVersion:f.sourceVersion??0,surfaceId:f.id,countU:f.countU,countV:f.countV,revision:1,options:f.options},cad,gpu);packet=candidate.packet;options=candidate.options;native=candidate;}
   renderer=gpu.mountMesh(canvas,packet,options,overlay);
  }
  const next={id,kind:example.kind,canvas,renderer,native,viewRevision:0,available:true};
  canvas.addEventListener('webglcontextlost',()=>{if(active!==next)return;next.available=false;error.textContent='Preview unavailable. Choose an example to create a new view.';error.hidden=false;});
  const previous=active;document.getElementById('preview').replaceWith(canvas);active=next;release(previous);
  {
   canvas.classList.add('is-orbitable');canvas.setAttribute('aria-label',example.label+'; drag to orbit the camera');
   next.orbit=bindMouseOrbit(canvas,{get available(){return next.available;},snapshot:()=>({options:example.kind==='sdf'?{camera:renderer.camera}:renderer.options,viewRevision:next.viewRevision}),setCamera(camera){const result=example.kind==='sdf'?renderer.setCamera(camera):renderer.update(renderer.packet,{...renderer.options,camera});if(result.ok)next.viewRevision++;return result;}});
  }
  picker.value=id;error.hidden=true;return true;
 }catch(cause){renderer?.dispose();canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();if(active)picker.value=active.id;error.textContent=cause.message;error.hidden=false;return false;}
}
for(const example of examples){const option=document.createElement('option');option.value=example.id;option.textContent=example.label;picker.append(option);}
const workspaceOption=document.createElement('option');workspaceOption.value='workspace-box';workspaceOption.textContent='Box workspace · Create / Edit';picker.append(workspaceOption);
const polygonOption=document.createElement('option');polygonOption.value='workspace-polygon';polygonOption.textContent='Polygon prism · Create / Edit';picker.append(polygonOption);
const cutoutOption=document.createElement('option');cutoutOption.value='workspace-cutout';cutoutOption.textContent='Cutout prism · Create / Edit';picker.append(cutoutOption);
const featureOption=document.createElement('option');featureOption.value='workspace-rectangle-features';featureOption.textContent='Rectangle features · Create / Edit';picker.append(featureOption);
const circleOption=document.createElement('option');circleOption.value='workspace-circle-face';circleOption.textContent='Circle face · Create / Edit';picker.append(circleOption);
picker.addEventListener('change',()=>{if(picker.value==='workspace-circle-face'){location.href='/workspace.html#circle-face';return;}if(picker.value==='workspace-rectangle-features'){location.href='/workspace.html#rectangle-features';return;}if(picker.value==='workspace-cutout'){location.href='/workspace.html#cutout-prism';return;}if(picker.value==='workspace-polygon'){location.href='/workspace.html#polygon-prism';return;}if(picker.value==='workspace-box'){location.href='/workspace.html#box';return;}if(select(picker.value))history.replaceState(null,'','#'+picker.value);});
addEventListener('resize',()=>{if(!active||!active.available)return;try{active.renderer.resize(...dimensions());}catch(cause){error.textContent=cause.message;error.hidden=false;}});
addEventListener('pagehide',()=>{disposed=true;release(active);},{once:true});
window.examplePreview={select,examples:()=>examples.map(({id,label,kind})=>({id,label,kind})),snapshot:()=>active?{id:active.id,kind:active.kind,viewRevision:active.viewRevision,...(['region','prism','native-shell','native-hole','native-hole-shell'].includes(active.kind)?{native:structuredClone(active.native)}:{}),...(['native-shell','native-hole','native-hole-shell'].includes(active.kind)?{overlay:active.renderer.edgeOverlay}:{}),...(active.kind==='sdf'?{scene:active.renderer.scene,options:{camera:active.renderer.camera}}:{packet:active.renderer.packet,options:active.renderer.options})}:null,readPixels:()=>active.renderer.readPixels(),get renderer(){return active?.renderer;}};
const initialId=location.hash.slice(1);select(examples.some(example=>example.id===initialId)?initialId:'sphere');
addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(id!==active?.id&&examples.some(example=>example.id===id))select(id);});
