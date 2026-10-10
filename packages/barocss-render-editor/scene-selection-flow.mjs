import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
assert(process.argv.length===4&&process.argv[2]==='--output','Use --output <new-evidence-directory>.');
const output=resolve(process.argv[3]);await mkdir(dirname(output),{recursive:true});await mkdir(output);
const receipt={issue:1332,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,scope:'Code-only Source selection input protocol. Real input/session/controller; declared EventTarget/canvas model and injected identity-query model. No actual GPU pickObject call, GL, browser, pixels or #1095 qualification.',ok:false,cases:[]};let stage='ordinary source graph';
const savedGlobals=new Map();
try {
 assert.equal(Number(process.versions.node.split('.')[0]),22);
 const bundle=await build({absWorkingDir:root,stdin:{contents:"export * from '@barocss/render-editor'; export {createSceneSelectionInput} from './src/scene-selection-input.ts'; export {createSceneCameraInput} from './src/scene-camera-input.ts';",resolveDir:here,sourcefile:'selection-protocol-consumer.mjs'},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true});
 const inputs=Object.keys(bundle.metafile.inputs);assert(inputs.includes('packages/barocss-render-editor/src/scene-selection-input.ts'));assert(inputs.includes('packages/barocss-render-editor/src/scene-camera-input.ts'));assert(!inputs.some(p=>/packages\/barocss-[^/]+\/dist\//.test(p)||/node_modules\/react\//.test(p)));receipt.sourceInputs=inputs.filter(p=>/packages\/barocss-[^/]+\/src\//.test(p)).length;receipt.ownDistInputs=0;
 await writeFile(resolve(output,'source-metafile.json'),JSON.stringify(bundle.metafile,null,2)+'\n');await writeFile(resolve(output,'ordinary-source.mjs'),bundle.outputFiles[0].text);
 const api=await import(pathToFileURL(resolve(output,'ordinary-source.mjs')).href);
 // This models capture-before-bubble ordering explicitly. It is not a browser.
 class Target {
  listeners=new Map();
  addEventListener(type,listener,options){const capture=typeof options==='boolean'?options:!!options?.capture;const rows=this.listeners.get(type)??[];rows.push({listener,capture});this.listeners.set(type,rows);}
  removeEventListener(type,listener,options){const capture=typeof options==='boolean'?options:!!options?.capture;this.listeners.set(type,(this.listeners.get(type)??[]).filter(row=>row.listener!==listener||row.capture!==capture));}
  emit(type,data={},phases=[true,false]){const event={type,target:this,currentTarget:this,defaultPrevented:false,stopped:false,immediate:false,...data,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;}};const rows=[...(this.listeners.get(type)??[])];for(const phase of phases){for(const row of rows.filter(row=>row.capture===phase)){if(event.immediate)break;if(typeof row.listener==='function')row.listener(event);else row.listener.handleEvent(event);}if(event.stopped)break;}return event;}
 }
 const frames=new Map(),observers=new Set();let frameId=0;
 const view=new Target();view.devicePixelRatio=1;view.visualViewport={scale:1};
 const computed={width:'1000px',height:'600px',boxSizing:'content-box',paddingLeft:'0px',paddingRight:'0px',paddingTop:'0px',paddingBottom:'0px',borderLeftWidth:'0px',borderRightWidth:'0px',borderTopWidth:'0px',borderBottomWidth:'0px',transform:'none',translate:'none',rotate:'none',scale:'none',zoom:'1',perspective:'none',getPropertyValue(name){return this[name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??'';}};
 view.getComputedStyle=element=>element.computed??computed;
 class Observer {constructor(callback){this.callback=callback;observers.add(this);}observe(){}unobserve(){}disconnect(){observers.delete(this);}}
 view.ResizeObserver=Observer;view.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};view.cancelAnimationFrame=id=>frames.delete(id);
 for(const [key,value]of Object.entries({window:view,ResizeObserver:Observer,requestAnimationFrame:view.requestAnimationFrame,cancelAnimationFrame:view.cancelAnimationFrame,getComputedStyle:view.getComputedStyle})){savedGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
 const flush=async()=>{await Promise.resolve();for(const [id,callback]of [...frames]){frames.delete(id);callback(16);}await Promise.resolve();};
 const source='/* original */\r\n@scene selection { version: 1; sphere #orb; box #block; }\r\n#orb { radius: .7; translate: -1 0 0; }\r\n#block { size: 1 2 1; translate: 1 0 -0; }\r\n',camera={eye:[5,4,7],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100},clip={format:'barocss-render-editor-translation-clip',version:0,id:'selection_clip',timeUnit:'seconds',interpolation:'linear',tracks:[{objectId:'orb',keys:[{timeSeconds:0,translation:[-1,0,0]}]}]},doc={format:'barocss-render-editor',version:1,kind:'gpu-scene',documentId:'selection_document',title:'Selection',revision:0,sourceVersion:1,sceneSource:source,camera,animation:clip};
 const hit=id=>({sceneName:'selection',sourceVersion:1,objectId:id,approximate:true});
 function harness(){
  const session=api.createRenderEditorSession(doc);session.markSaved(0);const model={shown:null,events:[],queries:[],errors:[],selected:[],result:hit('orb'),pickHook:null,enabled:true};
  const presenter={present(candidate,previous){assert.deepEqual(previous,model.shown);model.shown=candidate.document;return {ok:true};},recover(document){model.shown=document;return {ok:true};},dispose(){model.shown=null;},pickObject(point,document,camera){for(const key of ['documentId','revision','version','sourceVersion','sceneSource'])assert.equal(document[key],model.shown[key],'Injected presenter identity seam '+key);assert.deepEqual(camera,model.shown.camera,'Injected query must receive actual local camera.');model.events.push('pick');assert.equal(canvas.capture.size,0,'Selection query preceded camera capture release.');model.queries.push({...point});model.pickHook?.();return model.result;}};
  const controller=api.createRenderEditorController(session,presenter);
  const canvas=new Target();canvas.width=1280;canvas.height=768;canvas.clientWidth=1000;canvas.clientHeight=600;canvas.isConnected=true;canvas.parentElement=null;canvas.ownerDocument={defaultView:view,hidden:false};canvas.computed={...computed};canvas.rect={x:10,y:20,left:10,top:20,right:1010,bottom:620,width:1000,height:600};canvas.capture=new Set();canvas.getBoundingClientRect=()=>({...canvas.rect});canvas.focus=()=>{};
  canvas.setPointerCapture=id=>{canvas.capture.add(id);model.events.push('capture');};canvas.hasPointerCapture=id=>canvas.capture.has(id);canvas.releasePointerCapture=id=>{if(canvas.capture.delete(id)){model.events.push('release');canvas.emit('lostpointercapture',{pointerId:id});}};
  // Actual camera listener first; selection capture phase must arbitrate correctly.
  const cameraInput=api.createSceneCameraInput(canvas,controller,{mode:()=> 'orbit',canNavigate:()=>model.enabled,onError:error=>model.errors.push(error)});
  const selection=api.createSceneSelectionInput(canvas,controller,presenter,{canSelect:()=>model.enabled,onClick:()=>cameraInput.reset(),onSelection:id=>model.selected.push(id),onError:error=>model.errors.push(error)});
  const pointer=(type,values={})=>canvas.emit(type,{pointerId:1,pointerType:'mouse',isPrimary:true,button:type==='pointermove'?-1:0,buttons:type==='pointerup'?0:1,clientX:60,clientY:80,shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,...values});
  const click=async(values={})=>{pointer('pointerdown',values);pointer('pointerup',values);await flush();};
  return {session,controller,presenter,canvas,model,selection,cameraInput,pointer,click,async close(){selection.dispose();selection.dispose();cameraInput.dispose();controller.dispose();session.dispose();await flush();assert.equal(canvas.capture.size,0);}};
 }
 const preserved=s=>({accepted:s.accepted,draftSource:s.draftSource,draftCamera:s.draftCamera,draftAnimation:s.draftAnimation,objectInputInvalid:s.objectInputInvalid,animationInputInvalid:s.animationInputInvalid,sourceDirty:s.sourceDirty,cameraDirty:s.cameraDirty,animationDirty:s.animationDirty,diagnostics:s.diagnostics,canUndo:s.canUndo,canRedo:s.canRedo,savedRevision:s.savedRevision});
 stage='primary click release order and threshold';let h=harness(),baseline=h.session.getSnapshot(),bytes=api.serializeRenderEditorDocument(baseline.accepted);await h.click();assert.equal(h.session.getSnapshot().activeObjectId,'orb');assert.deepEqual(h.model.queries,[{xCss:50,yCss:60}]);assert(h.model.events.indexOf('release')<h.model.events.indexOf('pick'));assert.deepEqual(preserved(h.session.getSnapshot()),preserved(baseline));assert.equal(api.serializeRenderEditorDocument(h.session.getSnapshot().accepted),bytes);assert.equal(h.controller.getSnapshot().viewportCamera,null);
 h.model.result=hit('block');h.pointer('pointerdown');h.pointer('pointermove',{clientX:62.9});h.pointer('pointerup',{clientX:62.9});await flush();assert.equal(h.session.getSnapshot().activeObjectId,'block');assert.equal(h.model.queries.length,2);assert.equal(h.controller.getSnapshot().viewportCamera,null);
 h.model.result=hit('orb');h.pointer('pointerdown');h.pointer('pointerup',{clientX:63});await flush();assert.equal(h.session.getSnapshot().activeObjectId,'orb');assert.equal(h.model.queries.length,3);assert.equal(h.controller.getSnapshot().viewportCamera,null);
 h.model.result=null;await h.click();assert.equal(h.session.getSnapshot().activeObjectId,null);assert.equal(h.model.selected.at(-1),null);h.model.result=hit('orb');await h.click();const same=h.session.getSnapshot();await h.click();assert.equal(h.session.getSnapshot().activeObjectId,'orb');assert.deepEqual(preserved(h.session.getSnapshot()),preserved(same));await h.close();receipt.cases.push('primary unmodified <=3 CSS click; actual camera release before injected query; content coordinates; null background and same originalID; no authored source/camera/clip/history/file change');
 stage='navigation input during a pending click';
 const pendingNavigation=[];
 for(const kind of ['wheel','ArrowRight']){
  h=harness();const before=h.session.getSnapshot();h.pointer('pointerdown');
  if(kind==='wheel'){
   const wheel={target:h.canvas,deltaMode:0,deltaY:120,deltaX:0,clientX:60,clientY:80,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false};
   const captured=view.emit('wheel',wheel,[true]);if(!captured.stopped)h.canvas.emit('wheel',{...captured,currentTarget:h.canvas});
  }else{
   const key={target:h.canvas,key:'ArrowRight',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,isComposing:false,repeat:false};
   // Browser ordering: window capture precedes the focused canvas bubble listener.
   const captured=view.emit('keydown',key,[true]);if(!captured.stopped)h.canvas.emit('keydown',{...captured,currentTarget:h.canvas},[false]);
  }
  h.pointer('pointerup');await flush();const after=h.session.getSnapshot();
  assert.deepEqual(preserved(after),preserved(before),'Navigation input must preserve authored and raw state.');
  pendingNavigation.push({kind,queries:h.model.queries.length,viewportCamera:h.controller.getSnapshot().viewportCamera,activeObjectId:after.activeObjectId});await h.close();
 }
 receipt.pendingNavigation=pendingNavigation;
 for(const observed of pendingNavigation){assert.equal(observed.queries,0,observed.kind+' during pending click must cancel selection before camera rAF.');assert(observed.viewportCamera,observed.kind+' navigation must survive pointerup and flush.');assert.equal(observed.activeObjectId,null);}
 receipt.cases.push('pending click followed by Wheel or focused-canvas ArrowRight cancels selection, retains queued local navigation and leaves originals/raw/history/saved unchanged; window-capture before canvas-bubble key order');
 stage='maximum excursion and modifiers';
 for(const scenario of ['drag','return','shift','ctrl','meta','alt','secondary','nonprimary','wrong-pointer']){h=harness();const start=h.session.getSnapshot();if(scenario==='drag'||scenario==='return'){h.pointer('pointerdown');h.pointer('pointermove',{clientX:65});h.pointer('pointerup',{clientX:scenario==='return'?60:65});}else if(scenario==='wrong-pointer'){h.pointer('pointerdown');h.pointer('pointerup',{pointerId:2});h.pointer('pointercancel');}else{const values=scenario==='secondary'?{button:2}:scenario==='nonprimary'?{isPrimary:false}:{[scenario+'Key']:true};h.pointer('pointerdown',values);h.pointer('pointerup',values);}await flush();assert.equal(h.model.queries.length,0,scenario);assert.equal(h.session.getSnapshot().activeObjectId,start.activeObjectId,scenario);assert.deepEqual(preserved(h.session.getSnapshot()),preserved(start));await h.close();}
 receipt.cases.push('maximum excursion >3 remains drag after returning to origin; modifier/secondary/nonprimary/wrong pointer refusal; camera navigation remains separate and unauthored');
 stage='cancellation stale frame and disable fences';
 for(const scenario of ['pointercancel','lostpointercapture','blur','escape','resize','disable','accepted','same-revision-open','local-camera','legacy','transform','animation','unavailable']){
  h=harness();const start=h.session.getSnapshot();h.pointer('pointerdown');
  if(scenario==='pointercancel')h.pointer('pointercancel');if(scenario==='lostpointercapture')h.canvas.releasePointerCapture(1);if(scenario==='blur'){view.emit('blur');h.canvas.emit('blur');}if(scenario==='escape')view.emit('keydown',{key:'Escape',ctrlKey:false,metaKey:false,altKey:false,isComposing:false});
  if(scenario==='resize'){h.canvas.width=1281;h.canvas.rect.width=1001;h.canvas.rect.right=1011;h.canvas.clientWidth=1001;h.canvas.computed.width='1001px';for(const observer of [...observers])observer.callback([]);}
  if(scenario==='disable')h.model.enabled=false;
  if(scenario==='accepted'){h.session.setDraftSource(source+'/* accepted change */');h.session.commitPrepared(h.session.prepareDraft());}
  if(scenario==='same-revision-open'){h.session.commitPrepared(h.session.prepareOpen(api.serializeRenderEditorDocument({...doc,sceneSource:source+'/* same revision changed source */'})));}
  if(scenario==='local-camera'){const moved=api.deriveRenderCameraInteraction(camera,{kind:'orbit',deltaX:20,deltaY:5,width:1000,height:600});assert(h.controller.navigateViewportCamera(moved).ok);}
  if(scenario==='legacy')assert(h.controller.previewCamera(camera).ok);
  if(scenario==='transform'){h.session.setActiveObject('block');assert(h.controller.previewObjectSource('block',api.editRenderSceneObjectSource(source,'block',{size:[1.2,2,1]})).ok);}
  if(scenario==='animation')assert(h.controller.previewAnimation(0).ok);
  if(scenario==='unavailable')h.controller.presentationUnavailable(Error('model loss'));
  h.pointer('pointerup');await flush();assert.equal(h.model.queries.length,0,scenario);assert.equal(h.model.selected.length,0,scenario);if(!['accepted','same-revision-open','transform'].includes(scenario))assert.equal(h.session.getSnapshot().accepted,start.accepted);await h.close();
 }
 receipt.cases.push('cancel/lost capture/blur/Escape/resize/disable/stale accepted source or displayed camera; legacy/object/animation transients and unavailable frame forbid query');
 stage='query identity and stale result admission';
 for(const result of [{...hit('orb'),sceneName:'foreign'},{...hit('orb'),sourceVersion:2},hit('foreign'),{...hit('orb'),approximate:false}]){h=harness();h.model.result=result;const start=h.session.getSnapshot();await h.click();assert.equal(h.model.queries.length,1);assert.equal(h.session.getSnapshot().activeObjectId,null);assert.equal(h.model.selected.length,0);assert(h.model.errors.length>0);assert.deepEqual(preserved(h.session.getSnapshot()),preserved(start));await h.close();}
 h=harness();h.model.pickHook=()=>h.controller.presentationUnavailable(Error('loss during injected query'));await h.click();assert.equal(h.session.getSnapshot().activeObjectId,null);assert.equal(h.model.selected.length,0);await h.close();receipt.cases.push('injected foreign scene/version/unknown originalID/nonapproximate refused; result cannot select after query-induced frame loss');
 stage='selection preserves all hidden raw drafts';h=harness();h.session.setDraftSource('invalid original source draft');h.session.setDraftCamera({...camera,near:NaN});h.session.setDraftObjectSource(null);h.session.setAnimationInputInvalid(true);const raw=h.session.getSnapshot();await h.click();assert.equal(h.session.getSnapshot().activeObjectId,'orb');assert.deepEqual(preserved(h.session.getSnapshot()),preserved(raw));h.model.result=null;await h.click();assert.equal(h.session.getSnapshot().activeObjectId,null);assert.deepEqual(preserved(h.session.getSnapshot()),preserved(raw));await h.close();receipt.cases.push('object/source/camera/key raw and diagnostics, accepted originals, clip refs, history and saved revision survive object/background selection');
 receipt.ok=true;
}catch(error){receipt.firstFailure={stage,name:error.name,message:error.message,stack:error.stack};process.exitCode=1;await writeFile(resolve(output,'first-failure.json'),JSON.stringify(receipt.firstFailure,null,2)+'\n');}
finally{for(const [key,d]of savedGlobals){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}}
receipt.finishedAt=new Date().toISOString();await writeFile(resolve(output,'scene-selection-flow.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({ok:receipt.ok,stage,output,cases:receipt.cases.length,failure:receipt.firstFailure?.message}));
