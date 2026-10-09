import {createViewer} from '@barocss/viewer';
import {parseBooleanExtrusionFeatureGraph,evaluateBooleanExtrusionFeatureGraph,updateBooleanExtrusionFeatureGraph} from '@barocss/cad';
import {loadBaroCadModelSet} from '@barocss/cad-interop/model-set';
import {parseBaroCadAssembly,loadBaroCadAssembly} from '@barocss/cad-interop/assembly';
import {createClothWorld} from '@barocss/physics/cloth';
import {BooleanShellSceneRenderer,PrimitiveSceneRendererV2,PrimitiveViewport} from '@barocss/gpu';

const check=(condition,message)=>{if(!condition)throw Error(message);};
const clone=value=>structuredClone(value);
const same=(a,b)=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'
  &&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
const near=(a,b,tolerance=1e-6)=>a.length===b.length&&a.every((n,i)=>Math.abs(n-b[i])<=tolerance);
const hash=bytes=>bytes.reduce((n,byte)=>Math.imul(n^byte,16777619)>>>0,2166136261);
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const canvas=document.querySelector('#view'),status=document.querySelector('#status'),list=document.querySelector('#leaves');
const fixtureSelect=document.querySelector('#fixture');
const buttons=Object.fromEntries(['load','show-all','clear','fit','orbit','pan','run-proof','lose-context','dispose']
  .map(id=>[id,document.querySelector('#'+id)]));
const contexts=new Set(),resources={},peaks={},uploads=[],draws=[],errors=[],warnings=[];
let failBufferAt=0,bufferAttempts=0;
for(const type of ['Buffer','Program','VertexArray','Framebuffer','Texture','Renderbuffer','Shader']) {
  const live=new Set(),p=WebGL2RenderingContext.prototype,create=p['create'+type],remove=p['delete'+type];resources[type]=live;peaks[type]=0;
  p['create'+type]=function(...args){if(type==='Buffer'&&failBufferAt&&++bufferAttempts===failBufferAt)return null;
    const value=create.apply(this,args);if(value){live.add(value);peaks[type]=Math.max(peaks[type],live.size);}return value;};
  p['delete'+type]=function(value){live.delete(value);return remove.call(this,value);};
}
const getContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(kind,...args){const value=getContext.call(this,kind,...args);
  if(kind==='webgl2'&&value)contexts.add(value);return value;};
const bufferData=WebGL2RenderingContext.prototype.bufferData;
WebGL2RenderingContext.prototype.bufferData=function(target,values,...args){const result=bufferData.call(this,target,values,...args);
  if(ArrayBuffer.isView(values)){const readback=new values.constructor(values.length);this.getBufferSubData(target,0,readback);
    uploads.push({type:values.constructor.name,values:Array.from(readback),bytes:values.byteLength,exactReadback:same(values,readback)});}return result;};
const drawElements=WebGL2RenderingContext.prototype.drawElements;
WebGL2RenderingContext.prototype.drawElements=function(mode,count,...args){draws.push({mode,count,depth:this.getParameter(this.DEPTH_FUNC),write:this.getParameter(this.DEPTH_WRITEMASK)});
  return drawElements.call(this,mode,count,...args);};
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
const resourceCounts=()=>Object.fromEntries(Object.entries(resources).map(([key,live])=>[key,live.size]));
const glErrors=()=>[...contexts].map(gl=>gl.getError());
const pixelInfo=()=>{const bytes=viewer.readPixels(),offset=(Math.floor(canvas.height/2)*canvas.width+Math.floor(canvas.width/2))*4;
  return{hash:hash(bytes),center:Array.from(bytes.slice(offset,offset+4))};};
const display=value=>status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
function render(){const state=viewer.getState(),live=!disposed&&state.status!=='context-lost';
  for(const[id,button]of Object.entries(buttons))button.disabled=id==='dispose'?disposed:!live||running;
  buttons.fit.disabled=!live||running||(!state.shell?.boundsScene&&state.status==='empty');fixtureSelect.disabled=!live||running;
  const graph=state.shell?.graph??graphs[currentName];
  list.replaceChildren(...leavesFor(graph).map(leaf=>{const item=document.createElement('li'),label=document.createElement('label'),checkbox=document.createElement('input');
    item.dataset.featureId=leaf.featureId;checkbox.type='checkbox';checkbox.disabled=!live||running;
    checkbox.checked=!!state.shell?.scene.entries.some(entry=>entry.ref.featureId===leaf.featureId);
    checkbox.setAttribute('aria-label','Show '+leaf.featureId);label.append(checkbox,' '+leaf.featureId);
    const identity=document.createElement('small'),details=document.createElement('small');identity.textContent=JSON.stringify(refFor(graph,leaf));
    const summary=graph.report.summary.extrusions.find(row=>row.featureId===leaf.featureId);
    details.textContent='Distance '+summary.distanceMM+' mm · '+(summary.empty?'Empty native output':summary.shellIds.length+' native Shell(s)');
    checkbox.addEventListener('change',()=>action(()=>{if(!item.isConnected)throw Error('This leaf list is stale.');
      const ids=[...list.querySelectorAll('input:checked')].map(input=>input.closest('li').dataset.featureId);
      viewer.loadShellGraph(graph,loadOptions(graph,ids));}));item.append(label,identity,details);return item;}));
}
function action(callback){if(disposed)return;try{callback();render();}catch(error){display(error.message);}}
function load(name='three',ids){uploads.length=0;draws.length=0;viewer.loadShellGraph(graphs[name],loadOptions(graphs[name],ids));
  currentName=name;fixtureSelect.value=name;render();return viewer.getState();}
function retained(label,callback){const before=viewer.getState(),pixels=pixelInfo(),counts=resourceCounts();let error;
  try{callback();}catch(value){error=value;}check(error instanceof Error,label+' did not refuse');
  check(same(before,viewer.getState())&&same(pixels,pixelInfo())&&same(counts,resourceCounts()),label+' changed accepted state/pixels/resources');
  result.refusals.push({label,error:error.message,type:error.name,code:error.code??null});}
function capture(label){const state=viewer.getState(),row={label,status:state.status,refs:state.shell?.scene.entries.map(entry=>entry.ref)??[],
  bounds:state.shell?.boundsScene??null,...pixelInfo(),resources:resourceCounts(),glErrors:glErrors()};
  check(row.glErrors.every(code=>code===0),label+' GL error');result.cases.push(row);return row;}
function uploadWitness(){const state=viewer.getState();for(const entry of state.shell.scene.entries){const expected=entry.native.mesh.positionsMM.map(n=>Math.fround(n*mmToSceneUnit));
  check(!expected.length||uploads.some(upload=>upload.type==='Float32Array'&&near(upload.values,expected)), 'Original mm/one-scale Shell GL positions differ');}
  check(uploads.every(upload=>upload.exactReadback),'Actual Shell GL readback differs');return uploads.map(upload=>({type:upload.type,bytes:upload.bytes,length:upload.values.length}));}
const subtract=(a,b)=>a.map((n,i)=>n-b[i]),dot=(a,b)=>a.reduce((n,value,i)=>n+value*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=value=>{const n=Math.hypot(...value);return value.map(component=>component/n);};
function rayTriangle(origin,direction,a,b,c){const e1=subtract(b,a),e2=subtract(c,a),p=cross(direction,e2),det=dot(e1,p);
  if(Math.abs(det)<1e-12)return null;const inverse=1/det,t=subtract(origin,a),u=dot(t,p)*inverse;
  if(u<0||u>1)return null;const q=cross(t,e1),v=dot(direction,q)*inverse;if(v<0||u+v>1)return null;
  const distance=dot(e2,q)*inverse;return distance>0?distance:null;}
function depthProof(){load('three');const entries=clone(viewer.getState().shell.scene.entries),native=entries[0].native;
  const cap=native.faceRanges.find(face=>face.kind==='top-cap'),triangle=cap.triangles[0].vertexIndices;
  const point=[0,1,2].map(axis=>triangle.reduce((sum,index)=>sum+native.mesh.positionsMM[index*3+axis],0)/3*mmToSceneUnit);
  const normal=unit(native.mesh.normals.slice(cap.vertexStart*3,cap.vertexStart*3+3));
  const camera={eye:point.map((n,i)=>n+normal[i]*3),target:point,up:[0,1,0],fovYDegrees:45,near:.01,far:20};
  viewer.setView(camera);const forward=unit(subtract(camera.target,camera.eye)),right=unit(cross(forward,camera.up)),up=cross(right,forward);
  const tangent=Math.tan(camera.fovYDegrees*Math.PI/360),px=Math.floor(canvas.width/2)+.5,py=Math.floor(canvas.height/2)+.5;
  const direction=unit(forward.map((n,i)=>n+right[i]*(px/canvas.width*2-1)*tangent*canvas.width/canvas.height+up[i]*(py/canvas.height*2-1)*tangent));
  const distances=entries.map(entry=>{const p=entry.native.mesh.positionsMM.map(n=>n*mmToSceneUnit),indices=entry.native.mesh.indices;let closest=Infinity;
    for(let i=0;i<indices.length;i+=3){const distance=rayTriangle(camera.eye,direction,...indices.slice(i,i+3).map(index=>p.slice(index*3,index*3+3)));
      if(distance!==null)closest=Math.min(closest,distance);}return closest;});
  check(distances.every(Number.isFinite),'Independent fixed native overlap pixel missing');
  const nearIndex=distances.indexOf(Math.min(...distances)),farIndex=distances.indexOf(Math.max(...distances));
  const options=loadOptions(graphs.three),sample=entries=>{viewer.loadShellGraph(graphs.three,{...clone(options),entries});viewer.setView(camera);return pixelInfo();};
  const nearOnly=sample([options.entries[nearIndex]]),farOnly=sample([options.entries[farIndex]]),forwardFull=sample(options.entries),reverseFull=sample([...options.entries].reverse());
  const expected=options.entries[nearIndex].color.map(n=>Math.round(n*255));
  check(near(nearOnly.center.slice(0,3),expected,2)&&same(nearOnly.center,forwardFull.center)&&same(nearOnly.center,reverseFull.center)
    &&!same(nearOnly.center,farOnly.center),'Independent native nearest cap/shared depth differed');
  return{camera,pixel:[Math.floor(canvas.width/2),Math.floor(canvas.height/2)],distances,nearestRef:options.entries[nearIndex].ref,expected,
    nearOnly,farOnly,forwardFull,reverseFull};
}
async function runProof(){if(running||disposed||viewer.getState().status==='context-lost')throw Error('Proof needs a live Viewer');running=true;render();
  result={ok:false,schema:'barocss-viewer-shell-998-basic',cases:[],refusals:[],failures:[],scope:'Bounded native Shell consumer; root acceptance adds complete transition/race/context gates'};
  window.__viewerShellResult=result;
  try{result.inputAudit=await(await fetch('/input-audit.json')).json();result.fixtures=manifest.map(row=>({...row}));
    load('three');result.uploads=uploadWitness();const original=capture('three-qualified-native-leaves');
    check(original.refs.length===3&&viewer.getState().surfaces.length===0&&viewer.getState().curves.length===0,'Shell authority leaked primitive refs');
    const copy=viewer.getState();copy.shell.scene.entries[0].ref.featureId='foreign';copy.shell.graph.document.parameters[0].id='changed';
    check(same(viewer.getState().shell.graph,graphs.three),'State copy exposed native graph');
    const options=loadOptions(graphs.three),bad=mutate=>{const value=clone(options);mutate(value);return value;};
    retained('duplicate refs',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries.push(clone(value.entries[0])))));
    retained('stale revision',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries[0].ref.graphRevision++)));
    retained('foreign graph',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries[0].ref.graphId='foreign')));
    retained('wrong output slot',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries[0].ref.outputSlotId='foreign')));
    retained('non-extrusion leaf',()=>viewer.loadShellGraph(graphs.three,bad(value=>{const row=graphs.three.features.find(feature=>feature.kind==='face-input');value.entries[0].ref=refFor(graphs.three,row);})));
    retained('fifth entry',()=>viewer.loadShellGraph(graphs.three,bad(value=>{while(value.entries.length<5)value.entries.push(clone(value.entries[0]));})));
    retained('RGB out of range',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries[0].color=[2,0,0])));
    retained('mesh triangle budget',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.entries[0].mesh.maximumTriangles=0)));
    retained('unknown basis',()=>viewer.loadShellGraph(graphs.three,bad(value=>value.basis='automatic')));
    const forged=clone(graphs.three);forged.report.summary.extrusions[0].distanceMM+=1;
    retained('forged complete graph report',()=>viewer.loadShellGraph(forged,options));
    let getterCalls=0;const accessor=clone(options);Object.defineProperty(accessor,'entries',{enumerable:true,get(){getterCalls++;return options.entries;}});
    retained('accessor options',()=>viewer.loadShellGraph(graphs.three,accessor));check(getterCalls===0,'Caller getter invoked');
    failBufferAt=5;bufferAttempts=0;try{retained('late fifth buffer',()=>viewer.loadShellGraph(graphs.edited,loadOptions(graphs.edited)));}finally{failBufferAt=0;}
    check(bufferAttempts===5,'Late fifth allocation was not reached');
    retained('Shell pick boundary',()=>viewer.pickGeometry({xCss:10,yCss:10}));retained('Shell visibility API boundary',()=>viewer.setVisibleGeometry([]));
    retained('Shell motion reset boundary',()=>viewer.resetMotion());viewer.selectGeometry(null);viewer.setFluidFrame(null);viewer.setClothFrame(null);
    const before=clone(viewer.getState().shell);viewer.orbit(.05,.03);viewer.pan(.02,0);viewer.zoom(1.03);viewer.fit();viewer.resize(480,360);viewer.resize(640,480);
    check(same(before,viewer.getState().shell),'Camera/resize changed native Shell source');capture('camera-retains-native-shell');
    result.depth=depthProof();
    load('edited');capture('edited-native-distances');
    for(const name of ['four','hole','strip','revision1','revision3'])if(graphs[name]){load(name);capture(name+'-original-native');uploadWitness();}
    const camera=viewer.getState().camera;load('empty');const empty=capture('genuine-empty-native-leaves');
    check(empty.status==='empty'&&empty.refs.length===3&&empty.bounds===null&&same(camera,viewer.getState().camera),'Genuine empty provenance/camera changed');
    retained('fit genuine empty',()=>viewer.fit());load('three',[]);const zero=capture('zero-selected-native-leaves');check(zero.refs.length===0&&zero.bounds===null,'Zero selection not empty');
    const nativeSource=await(await fetch('/original-panel.barocad')).text();viewer.loadNative(nativeSource,{sourceVersion:0,countU:3,countV:3});
    check(viewer.getState().shell===null&&viewer.getState().surfaces.length===1,'Shell-to-primitive transition missing');load('three');viewer.clear();
    check(viewer.getState().shell===null&&viewer.getState().status==='empty','Clear retained Shell');load('three');
    result.getterCalls=getterCalls;result.contextCount=contexts.size;result.resources=resourceCounts();result.peaks={...peaks};result.glErrors=glErrors();result.errors=[...errors];result.warnings=[...warnings];
    check(contexts.size===1&&result.glErrors.every(code=>code===0)&&!errors.length&&!warnings.length,'Context/GL/browser gate failed');result.ok=true;
  }catch(error){result.error=error.stack||error.message;result.failures.push({error:result.error,completed:result.cases.length});result.resources=resourceCounts();result.errors=[...errors];}
  finally{running=false;render();display(result);window.__viewerShellResult=result;try{await fetch('/result',{method:'POST',body:JSON.stringify(result)});}catch(error){result.recordingError=error.message;}}
  return result;}
function dispose(){if(disposed)return;viewer.dispose();viewer.dispose();disposed=true;render();const receipt={status:viewer.getState().status,
  resources:resourceCounts(),peaks:{...peaks},contextCount:contexts.size,glErrors:glErrors(),errors:[...errors],warnings:[...warnings]};
  if(result)result.disposal=receipt;display(receipt);return receipt;}
try{manifest=await(await fetch('/fixture-manifest.json')).json();
  for(const item of manifest){const bytes=await(await fetch(item.url)).arrayBuffer();check(bytes.byteLength===item.bytes&&await sha(bytes)===item.sha256,'Original fixture bytes/hash differ');
    const text=new TextDecoder().decode(bytes);sources[item.name]=text;fixtures[item.name]={...item,bytes:new Uint8Array(bytes)};graphs[item.name]=parseBooleanExtrusionFeatureGraph(text,graphOptions);
    const option=document.createElement('option');option.value=item.name;option.textContent=item.name;fixtureSelect.append(option);}
  viewer=createViewer(canvas,{mmToSceneUnit,background:[.035,.065,.105],lighting:{ambientStrength:1,directionalStrength:0,direction:[0,1,0]}});load('three');
  window.__viewerShellProof={viewer,get gl(){return[...contexts][0];},get state(){return viewer.getState();},graphs,sources,fixtures,manifest,graphOptions,meshOptions,colors,
    mmToSceneUnit,canvas,createViewer,parseBooleanExtrusionFeatureGraph,evaluateBooleanExtrusionFeatureGraph,updateBooleanExtrusionFeatureGraph,
    parseBaroCadAssembly,loadBaroCadAssembly,loadBaroCadModelSet,createPhysicsClothWorld:createClothWorld,createClothWorld,
    BooleanShellSceneRenderer,PrimitiveSceneRendererV2,PrimitiveViewport,entriesFor,loadOptions,refFor,load,runProof,retained,capture,depthProof,
    resourceCounts,glErrors,pixelInfo,uploads,draws,errors,warnings,dispose,get result(){return result;},
    failNextBuffer(at=1){failBufferAt=at;bufferAttempts=0;},clearAllocationFault(){failBufferAt=0;return bufferAttempts;}};
  window.__viewerShellProof.nativeSourcePanel=await(await fetch('/original-panel.barocad')).text();
  display('Ready: three current native Shell leaves. Choose leaves or run the bounded proof.');
}catch(error){display({ok:false,stage:'startup',error:error.stack||error.message});}
buttons.load.addEventListener('click',()=>action(()=>load(fixtureSelect.value)));buttons['show-all'].addEventListener('click',()=>action(()=>load(currentName)));
buttons.clear.addEventListener('click',()=>action(()=>viewer.clear()));buttons.fit.addEventListener('click',()=>action(()=>viewer.fit()));
buttons.orbit.addEventListener('click',()=>action(()=>viewer.orbit(.2,.05)));buttons.pan.addEventListener('click',()=>action(()=>viewer.pan(.03,0)));
buttons['run-proof'].addEventListener('click',runProof);buttons.dispose.addEventListener('click',dispose);
buttons['lose-context'].addEventListener('click',()=>[...contexts][0]?.getExtension('WEBGL_lose_context')?.loseContext());
canvas.addEventListener('webglcontextlost',()=>{render();display('Context lost; copied native graph remains readable until disposal.');});
window.addEventListener('beforeunload',()=>{if(viewer)dispose();});
