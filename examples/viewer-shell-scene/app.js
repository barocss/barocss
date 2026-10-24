import {createViewer} from '@barocss/viewer';
import {parseBooleanExtrusionFeatureGraph,evaluateBooleanExtrusionFeatureGraph,updateBooleanExtrusionFeatureGraph} from '@barocss/cad';
import {loadBaroCadModelSet} from '@barocss/cad-interop/model-set';
import {parseBaroCadAssembly,loadBaroCadAssembly} from '@barocss/cad-interop/assembly';
import {createClothWorld} from '@barocss/physics/cloth';
import {prepareCamera,prepareBooleanShellBuffers} from '@barocss/gpu';

const check=(condition,message)=>{if(!condition)throw Error(message);};
const clone=value=>structuredClone(value);
const same=(a,b)=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'
  &&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
const hash=bytes=>bytes.reduce((n,byte)=>Math.imul(n^byte,16777619)>>>0,2166136261);
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const canvas=document.querySelector('#view'),status=document.querySelector('#status'),list=document.querySelector('#leaves');
const fixtureSelect=document.querySelector('#fixture');
const inspectMode=document.querySelector('#inspect-mode'),inspectionOutput=document.querySelector('#shell-inspection');
const buttons=Object.fromEntries(['load','show-all','clear','fit','orbit','pan','run-proof','dispose']
  .map(id=>[id,document.querySelector('#'+id)]));
const errors=[],warnings=[];
window.addEventListener('error',event=>errors.push(event.message));window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const warn=console.warn;console.warn=(...args)=>{warnings.push(args.map(String).join(' '));warn.apply(console,args);};
const graphOptions={maximumParameterResolutions:8,maximumFeatureEvaluations:7};
const meshOptions={meshId:'shell_mesh',maximumVertices:384,maximumTriangles:288,maximumEdgePaths:192,maximumNativeSamples:1024};
const colors=[[.95,.35,.2],[.25,.8,.4],[.3,.5,.95],[.9,.7,.2]],mmToSceneUnit=.07;
const refFor=(graph,leaf)=>({graphId:graph.document.id,graphRevision:graph.document.revision,featureId:leaf.featureId,outputSlotId:leaf.outputSlotId});
const leavesFor=graph=>graph.features.filter(feature=>feature.kind==='normal-extrusion');
const entriesFor=(graph,ids=leavesFor(graph).map(leaf=>leaf.featureId))=>leavesFor(graph).flatMap((leaf,index)=>ids.includes(leaf.featureId)
  ?[{ref:refFor(graph,leaf),mesh:clone(meshOptions),color:[...colors[index]],edges:null}]:[]);
const loadOptions=(graph,ids)=>({basis:'authored-xyz-matches-rhyup',entries:entriesFor(graph,ids)});
const graphs={},sources={},fixtures={};let manifest=[],viewer=null,currentName='three',running=false,disposed=false,result=null;
let inspectionEpoch=0,inspectionScope=null,inspectionRecord=null,inspectionObserver=null;
const pixelInfo=async()=>{const bytes=await viewer.readPixels(),offset=(Math.floor(canvas.height/2)*canvas.width+Math.floor(canvas.width/2))*4;
  return{hash:hash(bytes),center:Array.from(bytes.slice(offset,offset+4))};};
const display=value=>status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
function currentInspectionScope(){if(!viewer)return null;const state=viewer.getState(),rect=canvas.getBoundingClientRect();
  return{shell:state.shell,camera:state.camera,status:state.status,width:canvas.width,height:canvas.height,
    css:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}};}
function markInspectionRows(){for(const item of list.children)item.dataset.inspected=String(!!inspectionRecord?.pick&&same(JSON.parse(item.dataset.ref),inspectionRecord.pick.ref));}
function invalidateInspection(){inspectionEpoch++;inspectionRecord=null;inspectionOutput.textContent='';markInspectionRows();}
function refreshInspection(){const scope=currentInspectionScope();if(!same(scope,inspectionScope)){invalidateInspection();inspectionScope=clone(scope);}
  if(disposed||!scope?.shell||scope.status==='disposed'){
    if(inspectionRecord)invalidateInspection();
  }
  markInspectionRows();return clone(inspectionScope);
}
function checkInspectionScope(epoch,scope){refreshInspection();check(epoch===inspectionEpoch&&same(scope,inspectionScope),'This inspection view is stale. Query the current view.');}
function inspectAt(point){refreshInspection();const epoch=inspectionEpoch,scope=clone(inspectionScope);
  check(!disposed&&scope?.shell&&scope.status!=='disposed','Shell inspection requires an available Shell view.');
  const pick=viewer.pickShell(point);checkInspectionScope(epoch,scope);
  inspectionRecord={epoch,scope,point:clone(point),pick:clone(pick)};
  inspectionOutput.textContent=pick?'Current '+pick.ref.graphId+' / revision '+pick.ref.graphRevision+' / '+pick.ref.featureId+' / '+pick.ref.outputSlotId
    +' · derived triangle '+pick.triangleIndex+' · depth '+pick.depthScene.toPrecision(6)+' scene units'+(pick.ambiguous?' · ambiguous leaf tie':'')
    :'No current filled Shell triangle at this point.';
  markInspectionRows();return clone(pick);
}
function inspectionSnapshot(){return{mode:inspectMode.checked,epoch:inspectionEpoch,scope:clone(inspectionScope),record:clone(inspectionRecord),output:inspectionOutput.textContent,
  markedRefs:[...list.children].filter(item=>item.dataset.inspected==='true').map(item=>JSON.parse(item.dataset.ref))};}
function render(){refreshInspection();const state=viewer.getState(),live=!disposed;
  for(const[id,button]of Object.entries(buttons))button.disabled=id==='dispose'?disposed:!live||running;
  buttons.fit.disabled=!live||running||(!state.shell?.boundsScene&&state.status==='empty');fixtureSelect.disabled=!live||running;
  inspectMode.disabled=!live||running||!state.shell;
  const graph=state.shell?.graph??graphs[currentName];
  const epoch=inspectionEpoch,scope=clone(inspectionScope);
  list.replaceChildren(...leavesFor(graph).map(leaf=>{const item=document.createElement('li'),label=document.createElement('label'),checkbox=document.createElement('input');
    item.dataset.ref=JSON.stringify(refFor(graph,leaf));
    item.dataset.featureId=leaf.featureId;checkbox.type='checkbox';checkbox.disabled=!live||running;
    checkbox.checked=!!state.shell?.scene.entries.some(entry=>entry.ref.featureId===leaf.featureId);
    checkbox.setAttribute('aria-label','Show '+leaf.featureId);label.append(checkbox,' '+leaf.featureId);
    const identity=document.createElement('small'),details=document.createElement('small');identity.textContent=JSON.stringify(refFor(graph,leaf));
    const summary=graph.report.summary.extrusions.find(row=>row.featureId===leaf.featureId);
    details.textContent='Distance '+summary.distanceMM+' mm · '+(summary.empty?'Empty native output':summary.shellIds.length+' native Shell(s)');
    checkbox.addEventListener('change',()=>action(()=>{checkInspectionScope(epoch,scope);if(!item.isConnected)throw Error('This leaf list is stale.');
      const ids=[...list.querySelectorAll('input:checked')].map(input=>input.closest('li').dataset.featureId);
      viewer.loadShellGraph(graph,loadOptions(graph,ids));}));item.append(label,identity,details);return item;}));
  markInspectionRows();
}
function action(callback){if(disposed)return;const epoch=inspectionEpoch;try{callback();if(epoch===inspectionEpoch)invalidateInspection();render();}catch(error){render();display(error.message);}}
function load(name='three',ids){viewer.loadShellGraph(graphs[name],loadOptions(graphs[name],ids));
  currentName=name;fixtureSelect.value=name;invalidateInspection();render();return viewer.getState();}
async function retained(label,callback){const before=viewer.getState(),pixels=await pixelInfo();let error;
  try{callback();}catch(value){error=value;}check(error instanceof Error,label+' did not refuse');
  check(same(before,viewer.getState())&&same(pixels,await pixelInfo()),label+' changed accepted state/pixels');
  result.refusals.push({label,error:error.message,type:error.name,code:error.code??null});}
async function capture(label){const state=viewer.getState(),row={label,status:state.status,refs:state.shell?.scene.entries.map(entry=>entry.ref)??[],
  bounds:state.shell?.boundsScene??null,...await pixelInfo()};
  result.cases.push(row);return row;}
const subtract=(a,b)=>a.map((n,i)=>n-b[i]),dot=(a,b)=>a.reduce((n,value,i)=>n+value*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=value=>{const n=Math.hypot(...value);return value.map(component=>component/n);};
function rayTriangle(origin,direction,a,b,c){const e1=subtract(b,a),e2=subtract(c,a),p=cross(direction,e2),det=dot(e1,p);
  if(Math.abs(det)<1e-12)return null;const inverse=1/det,t=subtract(origin,a),u=dot(t,p)*inverse;
  if(u<0||u>1)return null;const q=cross(t,e1),v=dot(direction,q)*inverse;if(v<0||u+v>1)return null;
  const distance=dot(e2,q)*inverse;return distance>0?distance:null;}
async function depthProof(){load('three');const entries=clone(viewer.getState().shell.scene.entries),native=entries[0].native;
  const cap=native.faceRanges.find(face=>face.kind==='top-cap'),triangle=cap.triangles[0].vertexIndices;
  const point=[0,1,2].map(axis=>triangle.reduce((sum,index)=>sum+native.mesh.positionsMM[index*3+axis],0)/3*mmToSceneUnit);
  const normal=unit(native.mesh.normals.slice(cap.vertexStart*3,cap.vertexStart*3+3));
  const camera={eye:point.map((n,i)=>n+normal[i]*3),target:point,up:[0,1,0],fovY:45,near:.01,far:20};
  viewer.setView(camera);const forward=unit(subtract(camera.target,camera.eye)),right=unit(cross(forward,camera.up)),up=cross(right,forward);
  const tangent=Math.tan(camera.fovY*Math.PI/360),px=Math.floor(canvas.width/2)+.5,py=Math.floor(canvas.height/2)+.5;
  const direction=unit(forward.map((n,i)=>n+right[i]*(px/canvas.width*2-1)*tangent*canvas.width/canvas.height+up[i]*(py/canvas.height*2-1)*tangent));
  const distances=entries.map(entry=>{const p=entry.native.mesh.positionsMM.map(n=>n*mmToSceneUnit),indices=entry.native.mesh.indices;let closest=Infinity;
    for(let i=0;i<indices.length;i+=3){const distance=rayTriangle(camera.eye,direction,...indices.slice(i,i+3).map(index=>p.slice(index*3,index*3+3)));
      if(distance!==null)closest=Math.min(closest,distance);}return closest;});
  check(distances.every(Number.isFinite),'Independent fixed native overlap pixel missing');
  const nearIndex=distances.indexOf(Math.min(...distances)),farIndex=distances.indexOf(Math.max(...distances));
  const options=loadOptions(graphs.three),sample=entries=>{viewer.loadShellGraph(graphs.three,{...clone(options),entries});viewer.setView(camera);return pixelInfo();};
  const nearOnly=await sample([options.entries[nearIndex]]),farOnly=await sample([options.entries[farIndex]]),forwardFull=await sample(options.entries),reverseFull=await sample([...options.entries].reverse());
  const expected=options.entries[nearIndex].color.map(n=>Math.round(n*255)),farColor=options.entries[farIndex].color.map(n=>Math.round(n*255));
  // The Viewer lights the leaf colours, so the near pixel is identified as the nearer of the two leaf colours.
  const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
  check(distance(nearOnly.center.slice(0,3),expected)<distance(nearOnly.center.slice(0,3),farColor)&&same(nearOnly.center,forwardFull.center)&&same(nearOnly.center,reverseFull.center)
    &&!same(nearOnly.center,farOnly.center),'Independent native nearest cap/shared depth differed');
  return{camera,pixel:[Math.floor(canvas.width/2),Math.floor(canvas.height/2)],distances,nearestRef:options.entries[nearIndex].ref,expected,
    nearOnly,farOnly,forwardFull,reverseFull};
}
async function runProof(){if(running||disposed)throw Error('Proof needs a live Viewer');running=true;render();
  result={ok:false,schema:'barocss-viewer-shell-998-basic',cases:[],refusals:[],failures:[],scope:'Bounded native Shell consumer; root acceptance adds complete transition/race/context gates'};
  window.__viewerShellResult=result;
  try{result.inputAudit=await(await fetch('/input-audit.json')).json();result.fixtures=manifest.map(row=>({...row}));
    load('three');const original=await capture('three-qualified-native-leaves');
    check(original.refs.length===3&&viewer.getState().surfaces.length===0&&viewer.getState().curves.length===0,'Shell authority leaked primitive refs');
    const copy=viewer.getState();copy.shell.scene.entries[0].ref.featureId='foreign';copy.shell.graph.document.parameters[0].id='changed';
    check(same(viewer.getState().shell.graph,graphs.three),'State copy exposed native graph');
    const options=loadOptions(graphs.three),bad=mutate=>{const value=clone(options);mutate(value);return value;};
    await retained('duplicate refs',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries.push(clone(value.entries[0])))));
    await retained('stale revision',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries[0].ref.graphRevision++)));
    await retained('foreign graph',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries[0].ref.graphId='foreign')));
    await retained('wrong output slot',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries[0].ref.outputSlotId='foreign')));
    await retained('non-extrusion leaf',()=>viewer.loadShellGraph(graphs.three,bad(value=>{const row=graphs.three.features.find(feature=>feature.kind==='face-input');value.entries[0].ref=refFor(graphs.three,row);})));
    await retained('fifth entry',()=>viewer.loadShellGraph(graphs.three,bad(value=>{while(value.entries.length<5)value.entries.push(clone(value.entries[0]));})));
    await retained('RGB out of range',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries[0].color=[2,0,0])));
    await retained('mesh triangle budget',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries[0].mesh.maximumTriangles=0)));
    await retained('unknown basis',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.basis='automatic')));
    const forged=clone(graphs.three);forged.report.summary.extrusions[0].distanceMM+=1;
    await retained('forged complete graph report',()=>viewer.loadShellGraph(forged,options));
    let getterCalls=0;const accessor=clone(options);Object.defineProperty(accessor,'entries',{enumerable:true,get(){getterCalls++;return options.entries;}});
    await retained('accessor options',()=>viewer.loadShellGraph(graphs.three,accessor));check(getterCalls===0,'Caller getter invoked');
    await retained('Shell pick boundary',()=>viewer.pickGeometry({xCss:10,yCss:10}));await retained('Shell visibility API boundary',()=>viewer.setVisibleGeometry([]));
    await retained('Shell motion reset boundary',()=>viewer.resetMotion());viewer.selectGeometry(null);viewer.setFluidFrame(null);viewer.setClothFrame(null);
    const before=clone(viewer.getState().shell);viewer.orbit(.05,.03);viewer.pan(.02,0);viewer.zoom(1.03);viewer.fit();viewer.resize(480,360);viewer.resize(640,480);
    check(same(before,viewer.getState().shell),'Camera/resize changed native Shell source');await capture('camera-retains-native-shell');
    result.depth=await depthProof();
    load('edited');await capture('edited-native-distances');
    for(const name of ['four','hole','strip','revision1','revision3'])if(graphs[name]){load(name);await capture(name+'-original-native');}
    const camera=viewer.getState().camera;load('empty');const empty=await capture('genuine-empty-native-leaves');
    check(empty.status==='empty'&&empty.refs.length===3&&empty.bounds===null&&same(camera,viewer.getState().camera),'Genuine empty provenance/camera changed');
    await retained('fit genuine empty',()=>viewer.fit());load('three',[]);const zero=await capture('zero-selected-native-leaves');check(zero.refs.length===0&&zero.bounds===null,'Zero selection not empty');
    const nativeSource=await(await fetch('/original-panel.barocad')).text();viewer.loadNative(nativeSource,{sourceVersion:0,countU:3,countV:3});
    check(viewer.getState().shell===null&&viewer.getState().surfaces.length===1,'Shell-to-primitive transition missing');load('three');viewer.clear();
    check(viewer.getState().shell===null&&viewer.getState().status==='empty','Clear retained Shell');load('three');
    result.getterCalls=getterCalls;result.errors=[...errors];result.warnings=[...warnings];
    check(!errors.length&&!warnings.length,'Browser error gate failed');result.ok=true;
  }catch(error){result.error=error.stack||error.message;result.failures.push({error:result.error,completed:result.cases.length});result.errors=[...errors];}
  finally{running=false;render();display(result);window.__viewerShellResult=result;try{await fetch('/result',{method:'POST',body:JSON.stringify(result)});}catch(error){result.recordingError=error.message;}}
  return result;}
function dispose(){if(disposed)return;viewer.dispose();viewer.dispose();disposed=true;inspectionObserver?.disconnect();invalidateInspection();render();const receipt={status:viewer.getState().status,
  errors:[...errors],warnings:[...warnings]};
  if(result)result.disposal=receipt;display(receipt);return receipt;}
try{manifest=await(await fetch('/fixture-manifest.json')).json();
  for(const item of manifest){const bytes=await(await fetch(item.url)).arrayBuffer();check(bytes.byteLength===item.bytes&&await sha(bytes)===item.sha256,'Original fixture bytes/hash differ');
    const text=new TextDecoder().decode(bytes);sources[item.name]=text;fixtures[item.name]={...item,bytes:new Uint8Array(bytes)};graphs[item.name]=parseBooleanExtrusionFeatureGraph(text,graphOptions);
    const option=document.createElement('option');option.value=item.name;option.textContent=item.name;fixtureSelect.append(option);}
  viewer=await createViewer(canvas,{mmToSceneUnit,background:[.035,.065,.105],lighting:{ambientStrength:1,directionalStrength:0,direction:[0,1,0]}});load('three');
  inspectionObserver=new ResizeObserver(()=>refreshInspection());inspectionObserver.observe(canvas);
  window.__viewerShellProof={viewer,get state(){return viewer.getState();},graphs,sources,fixtures,manifest,graphOptions,meshOptions,colors,
    mmToSceneUnit,canvas,createViewer,parseBooleanExtrusionFeatureGraph,evaluateBooleanExtrusionFeatureGraph,updateBooleanExtrusionFeatureGraph,
    parseBaroCadAssembly,loadBaroCadAssembly,loadBaroCadModelSet,createPhysicsClothWorld:createClothWorld,createClothWorld,
    prepareCamera,prepareBooleanShellBuffers,entriesFor,loadOptions,refFor,load,render,
    inspectAt,inspectionSnapshot,refreshInspection,runProof,retained,capture,depthProof,
    pixelInfo,errors,warnings,dispose,get result(){return result;}};
  window.__viewerShellProof.nativeSourcePanel=await(await fetch('/original-panel.barocad')).text();
  display('Ready: three current native Shell leaves. Choose leaves or run the bounded proof.');
}catch(error){display({ok:false,stage:'startup',error:error.stack||error.message});}
buttons.load.addEventListener('click',()=>action(()=>load(fixtureSelect.value)));buttons['show-all'].addEventListener('click',()=>action(()=>load(currentName)));
buttons.clear.addEventListener('click',()=>action(()=>viewer.clear()));buttons.fit.addEventListener('click',()=>action(()=>viewer.fit()));
buttons.orbit.addEventListener('click',()=>action(()=>viewer.orbit(.2,.05)));buttons.pan.addEventListener('click',()=>action(()=>viewer.pan(.03,0)));
buttons['run-proof'].addEventListener('click',runProof);buttons.dispose.addEventListener('click',dispose);
inspectMode.addEventListener('change',()=>{invalidateInspection();render();});
canvas.addEventListener('click',event=>{if(!inspectMode.checked||inspectMode.disabled)return;const rect=canvas.getBoundingClientRect();
  try{inspectAt({xCss:event.clientX-rect.left,yCss:event.clientY-rect.top});}catch(error){display(error.message);}});
window.addEventListener('beforeunload',()=>{if(viewer)dispose();});
