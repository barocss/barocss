import { createViewer } from '@barocss/viewer';
import { loadBaroCadAssembly } from '@barocss/cad-interop/assembly';
import { loadBaroCadModelSet } from '@barocss/cad-interop/model-set';
import { updateCadAssembly, resolveCadGeometryReference, sampleCurveWideAdaptive } from '@barocss/cad';
import { createClothWorld } from '@barocss/physics/cloth';

const check = (condition, message) => { if (!condition) throw new Error(message); };
const clone = value => structuredClone(value);
const same = (a,b) => Object.is(a,b) || !!a && !!b && typeof a === 'object' && typeof b === 'object'
  && Object.keys(a).length === Object.keys(b).length
  && Object.keys(a).every(key => Object.hasOwn(b,key) && same(a[key],b[key]));
const near = (a,b,tolerance=1e-7) => a.length === b.length && a.every((n,i) => Math.abs(n-b[i]) <= tolerance);
const hash = bytes => bytes.reduce((n,byte) => Math.imul(n ^ byte,16777619) >>> 0,2166136261);
const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))]
  .map(n => n.toString(16).padStart(2,'0')).join('');
const canvas = document.querySelector('#view'), status = document.querySelector('#status');
const list = document.querySelector('#instances'), inspection = document.querySelector('#inspection');
const filter = document.querySelector('#filter');
const choiceList=document.querySelector('#assembly-choice'),choiceCount=document.querySelector('#assembly-choice-count');
const applyChoiceButton=document.querySelector('#apply-assembly-choice'),discardChoiceButton=document.querySelector('#discard-assembly-choice');
const buttons = Object.fromEntries(['revision0','revision1','fit','run-proof','dispose']
  .map(id => [id,document.querySelector('#'+id)]));
const errors = [], warnings = [];
window.addEventListener('error',event=>errors.push(event.message));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const warn=console.warn; console.warn=(...args)=>{warnings.push(args.map(String).join(' '));warn.apply(console,args);};
const defaultIDs=['child','surface_grandchild','shared_root','asset_b_instance'];
const options={native:{sourceVersion:0,countU:3,countV:3,
  curveDisplay:{version:1,chordToleranceMM:.01,maxSegments:64,maxDepth:8}},
  basis:'authored-xyz-matches-rhyup',instanceIds:[...defaultIDs]};
// Own the admission options before the external proof hook can expose its separate copy.
const choiceOptions=clone(options);
const mmToSceneUnit=.05;
const camera={eye:[.375,.25,2],target:[.375,.25,0],up:[0,1,0],fovYDegrees:45,near:.01,far:10};
const sameRef=(a,b)=>a?.kind===b?.kind && a?.modelId===b?.modelId
  && (a?.kind==='surface'?a.surfaceId===b.surfaceId:a?.curveId===b?.curveId);
let viewer=null,assemblies=[],clothWorld=null,nativeSet=null,result=null,running=false,disposed=false;
let choiceAssembly=null,choiceIDs=[],acceptedChoiceIDs=[],choiceEpoch=0,choiceRowsEpoch=-1;
const choiceRows=new Map();
const display=value=>status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
const pixels=async()=>hash(await viewer.readPixels());
function queryFor(binding) { return {assemblyId:binding.assemblyId,assemblyRevision:binding.assemblyRevision,
  instanceId:binding.instanceId,reference:clone(binding.reference),query:binding.ref.kind==='surface'
    ?{kind:'surface',u:.5,v:.5}:{kind:'curve',parameter:2}}; }
const showPoint=binding=>{ const point=viewer.queryAssemblyInstancePoint(queryFor(binding));
  inspection.textContent=JSON.stringify({instance:point.instanceId,revision:point.assemblyRevision,
    originalLocalPointMM:point.originalLocalPointMM,assemblyPointMM:point.assemblyPointMM,
    fullReference:point.reference,ancestors:point.ancestors,quality:point.report.quality},null,2); return point; };
function assemblyChoiceSnapshot() {
  return clone({version:0,assemblyId:choiceAssembly?.assembly.assemblyId??null,
    assemblyRevision:choiceAssembly?.assembly.revision??null,instanceIds:choiceIDs,
    acceptedInstanceIds:acceptedChoiceIDs,disposed});
}
function canonicalChoice(assembly,ids) {
  return assembly.assembly.instances.map(row=>row.id).filter(id=>ids.includes(id));
}
function syncAssemblyChoice(state,reset=false) {
  const assembly=!disposed?state.assembly:null;
  if(reset || !same(assembly,choiceAssembly)) {
    choiceEpoch++;choiceAssembly=assembly?clone(assembly):null;
    acceptedChoiceIDs=assembly?canonicalChoice(assembly,state.assemblyInstances.map(row=>row.instanceId)):[];
    choiceIDs=[...acceptedChoiceIDs];
  } else if(assembly) acceptedChoiceIDs=canonicalChoice(assembly,state.assemblyInstances.map(row=>row.instanceId));
}
function currentChoiceRow(item,epoch,assembly,id) {
  check(!disposed&&!running,'Instance choice needs an idle live host.');
  check(item.isConnected&&item.parentElement===choiceList,'This instance choice row is detached.');
  const state=viewer.getState();
  check(epoch===choiceEpoch&&same(assembly,choiceAssembly)&&same(state.assembly,assembly),
    'This original assembly choice is stale. Refresh the assembly.');
  check(assembly.instances.some(row=>row.instanceId===id),'This original instance is no longer current.');
  return state;
}
function renderAssemblyChoice(state) {
  syncAssemblyChoice(state);
  const available=!disposed&&!running&&!!choiceAssembly;
  if(choiceRowsEpoch!==choiceEpoch) {
    choiceRows.clear();choiceList.replaceChildren();choiceRowsEpoch=choiceEpoch;
    if(choiceAssembly) {
      const assembly=choiceAssembly,epoch=choiceEpoch;
      for(const authored of assembly.assembly.instances) {
        const original=assembly.instances.find(row=>row.instanceId===authored.id);
        const item=document.createElement('li'),label=document.createElement('label'),toggle=document.createElement('input');
        const title=document.createElement('strong'),lineage=document.createElement('small'),identity=document.createElement('small'),admission=document.createElement('small');
        item.dataset.instanceId=original.instanceId;item.dataset.kind=original.reference.geometryKind;
        toggle.type='checkbox';toggle.setAttribute('aria-label','Admit '+original.instanceId);
        title.textContent=original.instanceId+' · '+original.reference.geometryKind;
        lineage.textContent='Parent: '+(original.parentId??'root')+' · Ancestors: '+(original.ancestors.join(' → ')||'none');
        identity.textContent=JSON.stringify(original.reference);label.append(toggle,' Admit');
        toggle.addEventListener('change',()=>{
          try {currentChoiceRow(item,epoch,assembly,original.instanceId);
            const ids=choiceIDs.filter(id=>id!==original.instanceId);if(toggle.checked)ids.push(original.instanceId);
            stageAssemblyChoice(ids);display('Instance choice staged. Apply accepts 1–4 original instances.');
          } catch(error) {if(!disposed)renderAssemblyChoice(viewer.getState());display(error.message);}
        });
        item.append(title,lineage,identity,admission,label);choiceList.append(item);
        choiceRows.set(original.instanceId,{item,toggle,admission});
      }
    }
  }
  for(const[id,row]of choiceRows) {
    row.toggle.checked=choiceIDs.includes(id);row.toggle.disabled=!available;
    const admitted=acceptedChoiceIDs.includes(id);row.item.dataset.admitted=String(admitted);
    row.admission.textContent=admitted?'Accepted instance':'Metadata only · not admitted to the view';
  }
  choiceCount.textContent=choiceAssembly?'Choice: '+choiceIDs.length+' of '+choiceRows.size+' original instances; Apply accepts 1–4.':'No current original assembly.';
  applyChoiceButton.disabled=!available||state.status!=='ready'||choiceIDs.length<1||choiceIDs.length>4;
  discardChoiceButton.disabled=!available;
}
function choiceInput(input) {
  check(Array.isArray(input)&&Object.getPrototypeOf(input)===Array.prototype,'Instance choice must be an ordinary dense array.');
  const size=Object.getOwnPropertyDescriptor(input,'length');
  check(size&&'value' in size&&Number.isInteger(size.value)&&size.value>=0&&size.value<=32,'Instance choice allows 0–32 original IDs.');
  check(Reflect.ownKeys(input).length===size.value+1,'Instance choice has extra fields.');
  const ids=[];
  for(let index=0;index<size.value;index++) {
    const field=Object.getOwnPropertyDescriptor(input,String(index));
    check(field&&field.enumerable&&'value' in field&&typeof field.value==='string'
      &&/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(field.value),'Instance choice requires own ASCII IDs.');
    ids.push(field.value);
  }
  check(new Set(ids).size===ids.length,'Instance choice has duplicate IDs.');
  structuredClone(input); // Clone the ORIGINAL input so a Proxy is not laundered into an ordinary array.
  return ids;
}
function stageAssemblyChoice(input) {
  check(!disposed&&!running,'Instance choice needs an idle live host.');
  const ids=choiceInput(input); // Admit raw input before any Viewer read.
  const state=viewer.getState();
  check(choiceAssembly&&same(state.assembly,choiceAssembly),'The original assembly choice is stale. Refresh the assembly.');
  syncAssemblyChoice(state);
  check(ids.every(id=>choiceAssembly.instances.some(row=>row.instanceId===id)),'Instance choice contains an unrecognized original ID.');
  choiceIDs=canonicalChoice(choiceAssembly,ids);renderAssemblyChoice(state);return assemblyChoiceSnapshot();
}
function applyAssemblyChoice() {
  check(arguments.length===0,'Apply instance choice takes no arguments.');
  check(!disposed&&!running,'Instance choice needs an idle live host.');
  const state=viewer.getState();
  check(choiceAssembly&&same(state.assembly,choiceAssembly),'The original assembly choice is stale. Refresh the assembly.');
  syncAssemblyChoice(state);
  check(state.status==='ready','Apply needs a ready original assembly.');
  check(choiceIDs.length>=1&&choiceIDs.length<=4,'Apply accepts 1–4 original instances.');
  const epoch=choiceEpoch,assembly=clone(choiceAssembly),ids=canonicalChoice(assembly,choiceIDs);
  check(ids.length===choiceIDs.length&&new Set(ids).size===ids.length,'Instance choice is no longer current.');
  const current=viewer.getState();
  check(current.status==='ready'&&epoch===choiceEpoch&&same(current.assembly,assembly),
    'The original assembly changed before Apply.');
  try {viewer.loadAssembly(assembly,{...clone(choiceOptions),instanceIds:[...ids]});}
  catch(error) {renderAssemblyChoice(viewer.getState());throw error;}
  const accepted=viewer.getState();syncAssemblyChoice(accepted,true);inspection.textContent='';render();
  display('Applied '+acceptedChoiceIDs.length+' original assembly instance'+(acceptedChoiceIDs.length===1?'':'s')+'.');
  return assemblyChoiceSnapshot();
}
function discardAssemblyChoice() {
  check(arguments.length===0,'Discard instance choice takes no arguments.');
  check(!disposed&&!running,'Instance choice needs an idle live host.');
  const state=viewer.getState();
  check(choiceAssembly&&same(state.assembly,choiceAssembly),'The original assembly choice is stale. Refresh the assembly.');
  syncAssemblyChoice(state);
  choiceIDs=[...acceptedChoiceIDs];renderAssemblyChoice(state);display('Instance choice discarded. Accepted scene is unchanged.');
  return assemblyChoiceSnapshot();
}
function currentAcceptedRow(item,binding,epoch,assembly,gpu=false) {
  check(!disposed&&!running,'Instance action needs an idle live host.');
  check(item.isConnected&&item.parentElement===list,'This accepted instance row is detached.');
  const state=viewer.getState();
  check(epoch===choiceEpoch&&same(state.assembly,assembly)
    &&state.assemblyInstances.some(row=>same(row,binding)),'This accepted instance binding is stale.');
  if(gpu)check(state.status==='ready','Instance action needs a ready Viewer.');
  return state;
}
function render() {
  const state=viewer.getState(),ready=state.status==='ready' && !disposed;
  renderAssemblyChoice(state);
  const epoch=choiceEpoch,assembly=choiceAssembly;
  for(const [id,button] of Object.entries(buttons)) button.disabled=id==='dispose'?disposed:!ready||running;
  filter.disabled=!ready||running;
  list.replaceChildren(...state.assemblyInstances.map(binding=>{
    const item=document.createElement('li'); item.dataset.instanceId=binding.instanceId;
    item.dataset.kind=binding.ref.kind; item.setAttribute('aria-selected',String(sameRef(state.selectedGeometry,binding.ref)));
    const title=document.createElement('strong'),lineage=document.createElement('small'),identity=document.createElement('small');
    title.textContent=binding.instanceId+' · '+binding.ref.kind+' · revision '+binding.assemblyRevision;
    lineage.textContent='Parent: '+(binding.parentId??'root')+' · Ancestors: '+(binding.ancestors.join(' → ')||'none');
    identity.textContent=JSON.stringify(binding.reference);
    const visible=state.visibleGeometry.some(ref=>sameRef(ref,binding.ref));
    const label=document.createElement('label'),toggle=document.createElement('input');
    toggle.type='checkbox';toggle.checked=visible;toggle.disabled=!ready;
    toggle.setAttribute('aria-label','Show '+binding.instanceId);label.append(toggle,' Show');
    toggle.addEventListener('change',()=>action(()=>{const current=currentAcceptedRow(item,binding,epoch,assembly,true);
      viewer.setVisibleGeometry(current.assemblyInstances.map(row=>row.ref).filter(ref=>
        sameRef(ref,binding.ref)?toggle.checked:current.visibleGeometry.some(value=>sameRef(value,ref))));}));
    const select=document.createElement('button'),inspect=document.createElement('button');
    select.textContent='Select';select.setAttribute('aria-label','Select '+binding.instanceId);
    select.disabled=!ready||!visible||(filter.value!=='all'&&filter.value!==binding.ref.kind);
    select.addEventListener('click',()=>action(()=>{currentAcceptedRow(item,binding,epoch,assembly,true);viewer.selectGeometry(binding.ref);showPoint(binding);}));
    inspect.textContent='Inspect original point';inspect.setAttribute('aria-label','Inspect '+binding.instanceId);
    inspect.disabled=disposed||running;inspect.addEventListener('click',()=>action(()=>{currentAcceptedRow(item,binding,epoch,assembly);return showPoint(binding);}));
    item.append(title,lineage,identity,label,select,inspect);return item;
  }));
}
function action(callback) { if(disposed)return;try{callback();render();}catch(error){display(error.message);} }
function loadAssembly(revision=0,ids=defaultIDs) {
  viewer.loadAssembly(assemblies[revision],{...clone(options),instanceIds:[...ids]});
  const accepted=viewer.getState();syncAssemblyChoice(accepted,true);inspection.textContent='';renderAssemblyChoice(accepted);
  viewer.setView(camera);render();return viewer.getState();
}
function multiply(a,b) {return Array.from({length:16},(_,i)=>{
  const r=Math.floor(i/4),c=i%4;let n=0;for(let k=0;k<4;k++)n+=a[r*4+k]*b[k*4+c];return n;});}
function authoredWorld(assembly,id) {
  const row=assembly.assembly.instances.find(value=>value.id===id),[rx,ry,rz]=row.placement.rotationDegreesXYZ.map(n=>n*Math.PI/180);
  const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
  const r=multiply(multiply([cz,-sz,0,0,sz,cz,0,0,0,0,1,0,0,0,0,1],
    [cy,0,sy,0,0,1,0,0,-sy,0,cy,0,0,0,0,1]),[1,0,0,0,0,cx,-sx,0,0,sx,cx,0,0,0,0,1]);
  [r[3],r[7],r[11]]=row.placement.translationMM;
  return row.parentId?multiply(authoredWorld(assembly,row.parentId),r):r;
}
const worldPoint=(matrix,p)=>[0,1,2].map(axis=>matrix[axis*4]*p[0]+matrix[axis*4+1]*p[1]
  +matrix[axis*4+2]*p[2]+matrix[axis*4+3]);
function project(worldMM) {
  const rect=canvas.getBoundingClientRect(),state=viewer.getState(),c=state.camera;
  const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const forward=unit(c.target.map((n,i)=>n-c.eye[i])),right=unit(cross(forward,c.up)),up=cross(right,forward);
  const delta=worldMM.map((n,i)=>n*mmToSceneUnit-c.eye[i]),z=dot(delta,forward),t=Math.tan(c.fovYDegrees*Math.PI/360);
  return {xCss:(1+dot(delta,right)/(z*t*canvas.width/canvas.height))*rect.width/2,
    yCss:(1-dot(delta,up)/(z*t))*rect.height/2};
}
async function hitSamples() {
  const samples=[];
  for(const binding of viewer.getState().assemblyInstances) samples.push(await (async()=>{
    const point=viewer.queryAssemblyInstancePoint(queryFor(binding)),centre=project(point.assemblyPointMM);
    const search=()=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++) {
        const xCss=centre.xCss+dx,yCss=centre.yCss+dy;
        const hit=viewer.pickGeometry({xCss,yCss},{curveTolerancePx:4});
        if(hit&&sameRef({kind:hit.kind,...hit.ref},binding.ref))return {instanceId:binding.instanceId,xCss,yCss,hit,
          visible:clone(viewer.getState().visibleGeometry)};
      }return null;};
    const direct=search();if(direct)return {...direct,visibilityControl:'original all-visible state'};
    if(binding.ref.kind==='curve') {
      const before=viewer.getState(),pixelHash=await pixels();let uncovered;
      try { viewer.setVisibleGeometry(before.visibleGeometry.filter(ref=>ref.kind!=='surface'));uncovered=search(); }
      finally { viewer.setVisibleGeometry(before.visibleGeometry);
        if(before.selectedGeometry)viewer.selectGeometry(before.selectedGeometry); }
      check(same(before,viewer.getState())&&await pixels()===pixelHash,'Visibility hit control did not restore original state');
      if(uncovered)return {...uncovered,visibilityControl:'Surface temporarily hidden to inspect occluded native Curve',restored:true};
    }
    throw Error('No independently projected qualified hit for '+binding.instanceId);
  })());
  return samples;
}
async function retained(label,callback) {
  const before=viewer.getState(),pixelHash=await pixels();let error;
  try{callback();}catch(value){error=value;}
  check(error instanceof Error,label+' did not refuse');
  check(same(before,viewer.getState())&&await pixels()===pixelHash,label+' changed accepted state/pixels');
  result.refusals.push({label,error:error.message,type:error.name,code:error.code??null});
}
async function witness(assembly) {
  const state=viewer.getState(),points=[],lowered=[];
  check(state.assemblyInstances.length===4 && state.assembly.instances.length===6,'Selected/native capacity conflated');
  for(const binding of state.assemblyInstances) {
    const matrix=authoredWorld(assembly,binding.instanceId);check(near(matrix,binding.worldMatrix,1e-9),'Independent hierarchy matrix differs');
    const local=binding.ref.kind==='surface'?[1,1.5,0]:binding.reference.assetId==='asset_b'?[1,10,0]:[1,0,0];
    const before=viewer.getState(),pixelHash=await pixels(),point=viewer.queryAssemblyInstancePoint(queryFor(binding));
    check(near(point.originalLocalPointMM,local)&&near(point.assemblyPointMM,worldPoint(matrix,local)),'Independent native local/world point differs');
    check(same(before,viewer.getState())&&await pixels()===pixelHash,'Read-only native query changed state/pixels');
    points.push(point);
    const document=assembly.documents.find(value=>value.document.documentId===binding.reference.documentId);
    const resolved=resolveCadGeometryReference(document,binding.reference),original=resolved.geometry;
    check(resolved.source===assembly.assembly.parts[0].assets.find(asset=>asset.id===binding.reference.assetId).source,
      'Original authored source changed during display projection');
    if(original.kind==='surface')check(Object.is(original.knotsU[0],-0)&&Object.is(original.knotsV[0],-0),
      'Original native signed-zero knot domains lost');
    const raw=original.kind==='surface'?state.packets.find(packet=>packet.modelId===binding.ref.modelId).packet.positions
      :sampleCurveWideAdaptive(original,{chordToleranceMM:.01,maxSegments:64,maxDepth:8,resultIdPrefix:'host_witness'}).pointsMM.flat();
    const expected=[];for(let i=0;i<raw.length;i+=3)expected.push(...worldPoint(matrix,raw.slice(i,i+3)).map(n=>Math.fround(n*mmToSceneUnit)));
    lowered.push({instanceId:binding.instanceId,expected,
      originalSource:resolved.source,originalGeometry:original,
      originalUV:original.kind==='surface'?state.packets.find(packet=>packet.modelId===binding.ref.modelId).packet.parameters:null});
  }
  return {revision:assembly.assembly.revision,pixelHash:await pixels(),points,lowered,hits:await hitSamples(),
    bindings:state.assemblyInstances};
}
async function startClothScene() {
  nativeSet??=await loadBaroCadModelSet({format:'barocad-model-set',version:0,entries:[{aliasId:'cloth_original',
    url:'/original-panel.barocad',options:{sourceVersion:0,countU:3,countV:3,unitsPerMillimeter:1}}]}, {baseURL:location.href});
  clothWorld??=createClothWorld({format:'barocss-cloth-scene',version:1,revision:'assemblyClothPrior',
    basis:'right-handed-xyz-metres',fixedStepSeconds:1/120,profile:'pinned-sheet-sphere-v1'});
  const state=clothWorld.getState();viewer.loadModelSet(nativeSet);
  viewer.setView({eye:[0,100,0],target:[0,15,0],up:[0,0,-1],fovYDegrees:45,near:.01,far:500});
  const frame={version:0,layerId:'prior_native_cloth',contextId:'prior_world',sceneRevision:state.sceneRevision,
    stepIndex:state.stepIndex,vertexCount:state.vertexCount,triangleCount:state.triangleCount,
    positionsM:state.positionsM,triangles:state.triangles};viewer.setClothFrame(frame);return frame;
}
async function runProof() {
  if(running||disposed||viewer.getState().status!=='ready')throw Error('Proof needs a live ready Viewer');
  running=true;render();result={ok:false,schema:'barocss-viewer-assembly-997',receipts:[],refusals:[],failures:[],
    scope:'Four explicitly selected native instances; native local/world query, derived display only; no edit/playback/publication'};
  window.viewerAssemblyProof=result;
  try {
    result.inputAudit=await(await fetch('/input-audit.json')).json();result.fixtures=[];
    const expectedSHA=['4657ece41355db1870447efa0120f30c497ffa1b5b38dbe94de765d53176819b','54b07c917be1895f9e85ff1d4b0525ee6596b3941f30edafd015d4a9a7d2a9c5'];
    for(let revision=0;revision<2;revision++) {
      const bytes=await(await fetch('/assembly-revision'+revision+'.json')).arrayBuffer(),digest=await sha(bytes);
      check(bytes.byteLength===4207&&digest===expectedSHA[revision],'Original assembly fixture changed');
      result.fixtures.push({revision,bytes:bytes.byteLength,sha256:digest});
    }
    const prior=await startClothScene(),forged=clone(assemblies[0]);forged.instances[0].worldMatrix[3]+=1;
    await retained('failed assembly from actual prior cloth',()=>viewer.loadAssembly(forged,clone(options)));
    check(same(viewer.getState().clothFrame,prior),'Failed assembly dropped actual prior cloth');
    loadAssembly(0);check(viewer.getState().clothFrame===null&&viewer.getState().modelSet===null,'Successful assembly did not reset old mode');
    const original=await witness(assemblies[0]);result.receipts.push(original);
    const copied=viewer.getState();copied.assemblyInstances[0].worldMatrix[3]=999;copied.assembly.assembly.parts[0].assets[0].source='changed';
    check(same(viewer.getState().assembly,assemblies[0]),'State copy exposed native assembly');
    const binding=viewer.getState().assemblyInstances[0],query=queryFor(binding),queried=viewer.queryAssemblyInstancePoint(query);
    queried.originalLocalPointMM[0]=999;query.reference.assetId='foreign';
    check(viewer.queryAssemblyInstancePoint(queryFor(binding)).originalLocalPointMM[0]===1,'Caller/result query mutation reached source');
    for(const ids of [[],['child','child'],['foreign'],[...defaultIDs,'parent']])
      await retained('invalid IDs '+JSON.stringify(ids),()=>viewer.loadAssembly(assemblies[1],{...clone(options),instanceIds:ids}));
    await retained('forged world matrix',()=>viewer.loadAssembly(forged,clone(options)));
    const report=clone(assemblies[1]);report.report.instanceCount=5;
    await retained('forged report',()=>viewer.loadAssembly(report,clone(options)));
    await retained('units input',()=>viewer.loadAssembly(assemblies[1],{...clone(options),native:{...options.native,unitsPerMillimeter:1}}));
    await retained('unknown option',()=>viewer.loadAssembly(assemblies[1],{...clone(options),extra:true}));
    await retained('unsupported sampling version',()=>viewer.loadAssembly(assemblies[1],{...clone(options),native:{...options.native,sourceVersion:1}}));
    let getterCalls=0;const getter=clone(options);Object.defineProperty(getter,'instanceIds',{enumerable:true,get(){getterCalls++;return defaultIDs;}});
    await retained('option accessor',()=>viewer.loadAssembly(assemblies[1],getter));check(getterCalls===0,'Caller getter invoked');
    const translated=updateCadAssembly(assemblies[0],{expectedRevision:0,revision:1,
      instanceEdits:[{instanceId:'parent',translationMM:[10000,0,0],rotationDegreesXYZ:[0,0,0]}]});
    await retained('composed GPU translation over10000mm',()=>viewer.loadAssembly(translated,clone(options)));
    await retained('override authored display poses',()=>viewer.applyGeometryMotionFrame(viewer.getState().geometryMotion.frame,
      viewer.getState().geometryMotion.bindings,{basis:'part-xyz-matches-rhyup'}));
    await retained('reset authored motion',()=>viewer.resetMotion());
    await retained('legacy native projection',()=>viewer.projectNativePoint({...binding.ref,t:2}));
    await retained('assembly material clear',()=>viewer.setSurfaceMaterial(viewer.getState().surfaces[0],null));
    await retained('assembly cloth display',()=>viewer.setClothFrame(prior));
    const pointQuery=queryFor(binding);
    await retained('stale query revision',()=>viewer.queryAssemblyInstancePoint({...pointQuery,assemblyRevision:1}));
    await retained('unadmitted query instance',()=>viewer.queryAssemblyInstancePoint({...pointQuery,instanceId:'parent'}));
    await retained('foreign full native reference',()=>viewer.queryAssemblyInstancePoint({...pointQuery,reference:{...pointQuery.reference,assetId:'asset_b'}}));
    viewer.setClothFrame(null);viewer.setFluidFrame(null);viewer.selectGeometry(binding.ref);
    viewer.orbit(.01,.01);viewer.pan(.01,0);viewer.zoom(1.02);viewer.fit();viewer.fitGeometry(binding.ref);
    viewer.setVisibleGeometry(viewer.getState().visibleGeometry.filter(ref=>!sameRef(ref,binding.ref)));
    check(viewer.getState().assemblyInstances.length===4,'Hidden instance vanished from native inventory');
    await retained('hidden instance selection',()=>viewer.selectGeometry(binding.ref));
    viewer.setVisibleGeometry(viewer.getState().assemblyInstances.map(row=>row.ref));viewer.setView(camera);
    loadAssembly(1);const edited=await witness(assemblies[1]);result.receipts.push(edited);
    check(edited.pixelHash!==original.pixelHash,'Parent revision changed no display pixels');
    check(same(assemblies[0].assembly.parts,assemblies[1].assembly.parts),'Parent edit changed original parts');
    for(let i=0;i<4;i++)check(i<2?!near(original.bindings[i].worldMatrix,edited.bindings[i].worldMatrix)
      :same(original.bindings[i].worldMatrix,edited.bindings[i].worldMatrix),'Wrong descendant/root placement change');
    viewer.resize(480,360);viewer.resize(640,480);viewer.setView(camera);
    const source=viewer.getState().assembly.assembly.parts[0].assets[0].source;
    viewer.loadNative(source,{sourceVersion:0,countU:3,countV:3,
      curveDisplay:{version:1,chordToleranceMM:.01,maxSegments:64,maxDepth:8}});
    check(viewer.getState().assembly===null&&viewer.getState().assemblyInstances.length===0,'Later native generation retained assembly');
    loadAssembly(0);viewer.clear();check(viewer.getState().assembly===null,'Clear retained assembly');loadAssembly(0);
    result.errors=[...errors];result.warnings=[...warnings];
    check(errors.length===0&&warnings.length===0,'Browser error gate failed');
    result.getterCalls=getterCalls;result.ok=true;
  }catch(error){result.error=error.stack||error.message;result.failures.push({error:result.error,completed:result.receipts.length});
    result.errors=[...errors];result.warnings=[...warnings];}
  finally{running=false;render();display(result);window.viewerAssemblyProof=result;
    try{await fetch('/result',{method:'POST',body:JSON.stringify(result)});}catch(error){result.recordingError=error.message;}}
  return result;
}
function dispose() {
  if(disposed)return;disposed=true;choiceEpoch++;choiceAssembly=null;choiceIDs=[];acceptedChoiceIDs=[];
  viewer.dispose();viewer.dispose();clothWorld?.dispose();render();
  const receipt={status:viewer.getState().status,errors,warnings};
  if(result)result.disposal=receipt;display(receipt);return receipt;
}
try {
  assemblies=await Promise.all([0,1].map(revision=>loadBaroCadAssembly(new URL('/assembly-revision'+revision+'.json',location.href).href)));
  viewer=await createViewer(canvas,{mmToSceneUnit,background:[.035,.065,.105]});loadAssembly(0);
  window.viewerAssemblyProbe={viewer,assemblies,options,defaultIDs,camera,mmToSceneUnit,canvas,loadAssembly,queryFor,
    stageAssemblyChoice,applyAssemblyChoice,discardAssemblyChoice,render,get assemblyChoice(){return assemblyChoiceSnapshot();},
    showPoint,runProof,startClothScene,pixels,errors,warnings,retained,dispose,
    authoredWorld,worldPoint,project,hitSamples,witness,updateCadAssembly,resolveCadGeometryReference,
    loadBaroCadAssembly,loadBaroCadModelSet,
    fixtures:['/assembly-revision0.json','/assembly-revision1.json'],get result(){return result;}};
  display('Ready: four selected instances from six original native instances, revision0.');
}catch(error){display({ok:false,stage:'startup',error:error.stack||error.message});}
applyChoiceButton.addEventListener('click',()=>action(()=>applyAssemblyChoice()));
discardChoiceButton.addEventListener('click',()=>action(()=>discardAssemblyChoice()));
for(const revision of [0,1])buttons['revision'+revision].addEventListener('click',()=>action(()=>loadAssembly(revision)));
buttons.fit.addEventListener('click',()=>action(()=>viewer.fit()));buttons['run-proof'].addEventListener('click',runProof);
buttons.dispose.addEventListener('click',dispose);
filter.addEventListener('change',()=>action(()=>{const selected=viewer.getState().selectedGeometry;
  if(selected&&filter.value!=='all'&&selected.kind!==filter.value)viewer.selectGeometry(null);}));
canvas.addEventListener('click',event=>action(()=>{const rect=canvas.getBoundingClientRect(),hit=viewer.pickGeometry(
  {xCss:event.clientX-rect.left,yCss:event.clientY-rect.top},{curveTolerancePx:4,...(filter.value==='all'?{}:{kinds:[filter.value]})});
  const ref=hit&&{kind:hit.kind,...hit.ref};viewer.selectGeometry(ref);
  const binding=ref&&viewer.getState().assemblyInstances.find(value=>sameRef(value.ref,ref));if(binding)showPoint(binding);}));
window.addEventListener('beforeunload',()=>{if(viewer)dispose();});
