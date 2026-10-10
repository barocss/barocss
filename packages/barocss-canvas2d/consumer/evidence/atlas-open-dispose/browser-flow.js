async page=>{
 const phase=PHASE,dir='/Users/user/.codex/worktrees/canvas2d-atlas-open-dispose/barocss/packages/barocss-canvas2d/consumer/evidence/atlas-open-dispose/';
 if(phase===0){
  await page.addInitScript(()=>{
   window.__atlasLifetime={contexts:[],canvases:[],listeners:[],added:0,removed:0,hashes:[],fileTexts:0,errors:[],rejections:[]};
   const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
   const capture=options=>typeof options==='boolean'?options:!!options?.capture;
   EventTarget.prototype.addEventListener=function(type,listener,options){
    if(this instanceof HTMLCanvasElement&&type==='pointerdown'&&listener){const key=capture(options);let item=__atlasLifetime.listeners.find(entry=>entry.target===this&&entry.listener===listener&&entry.capture===key);
     if(!item){item={id:__atlasLifetime.listeners.length+1,target:this,listener,capture:key,active:false,adds:0,removes:0};__atlasLifetime.listeners.push(item);}
     if(!item.active){item.active=true;item.adds++;__atlasLifetime.added++;}
    }
    return add.call(this,type,listener,options);
   };
   EventTarget.prototype.removeEventListener=function(type,listener,options){
    if(this instanceof HTMLCanvasElement&&type==='pointerdown'){const key=capture(options),item=__atlasLifetime.listeners.find(entry=>entry.target===this&&entry.listener===listener&&entry.capture===key);
     if(item?.active){item.active=false;item.removes++;__atlasLifetime.removed++;}
    }
    return remove.call(this,type,listener,options);
   };
   addEventListener('error',event=>__atlasLifetime.errors.push(event.message));
   addEventListener('unhandledrejection',event=>__atlasLifetime.rejections.push(String(event.reason)));
   const get=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(...args){const gl=get.apply(this,args);
    if(args[0]==='webgl2'&&gl&&!__atlasLifetime.contexts.some(item=>item.gl===gl))__atlasLifetime.contexts.push({gl,canvas:this});return gl;};
   const create=Document.prototype.createElement;
   Document.prototype.createElement=function(...args){const element=create.apply(this,args);if(String(args[0]).toLowerCase()==='canvas')__atlasLifetime.canvases.push(element);return element;};
   const digest=SubtleCrypto.prototype.digest;
   SubtleCrypto.prototype.digest=function(...args){const item={id:__atlasLifetime.hashes.length+1,settled:false};__atlasLifetime.hashes.push(item);
    return digest.apply(this,args).then(value=>{item.settled=true;return value;},error=>{item.settled=true;throw error;});};
   const text=Blob.prototype.text;
   Blob.prototype.text=function(...args){if(this instanceof File)__atlasLifetime.fileTexts++;return text.apply(this,args);};
   window.__atlasFacilities=()=>({contexts:__atlasLifetime.contexts.length,createdCanvases:__atlasLifetime.canvases.length,
    pointerAdded:__atlasLifetime.added,pointerRemoved:__atlasLifetime.removed,pointerActive:__atlasLifetime.listeners.filter(item=>item.active).length,
    listeners:__atlasLifetime.listeners.map(item=>({id:item.id,canvasId:item.target.id,capture:item.capture,active:item.active,adds:item.adds,removes:item.removes})),
    hashes:__atlasLifetime.hashes.map(item=>({...item})),fileTexts:__atlasLifetime.fileTexts});
  });
  await page.goto('http://127.0.0.1:31304/packages/barocss-canvas2d/consumer/sprite-atlas.html');
  await page.waitForFunction(()=>!!window.__spriteAtlasConsumer);
  return {ready:await page.title()};
 }
 if(phase===1){
  await page.evaluate(async()=>{
   const f=__spriteAtlasConsumer;
   window.__disposeStages=[];
   window.__disposeRecord=label=>{const observation=f.observe(),facilities=__atlasFacilities();if(observation.contexts.some(item=>item.error!==0||item.lost))throw Error(label+' GLerror/loss');const result={label,observation,facilities};__disposeStages.push(result);return result;};
   const initial=__disposeRecord('defaultManualBaseline');
   const literal=[255,0,0,255,0,0,255,255,0,255,0,0];
   if(initial.observation.generation!==1||initial.observation.frameIndex!==0||initial.observation.packed||initial.observation.packCalls!==0||initial.facilities.contexts!==1||initial.facilities.pointerAdded!==1||initial.facilities.pointerActive!==1)throw Error('manual default baseline');
   if(JSON.stringify([...f.asset.pixels])!==JSON.stringify(literal)||initial.observation.samples.some(sample=>sample.hit!=='Sprite'||JSON.stringify(sample.rgba)!=='[255,0,0,255]'))throw Error('manual literal12bytes/pixels-hits');
   const canonical=await f.documentText();window.__disposeCanonical=canonical;
   const identities={canvas:f.canvas,tree:f.tree,sprite:f.sprite,catalog:f.catalog,renderer:f.renderer};
   const before=__atlasFacilities();
   // These are real public staging/hash calls. Dispose runs synchronously before their native hash settles.
   const opening=f.openText(canonical).then(()=>({accepted:true}),error=>({accepted:false,name:error.name,message:error.message,code:error.code??null}));
   const awaiting=__atlasFacilities();
   if(awaiting.hashes.length!==before.hashes.length+1||awaiting.hashes.at(-1).settled||awaiting.contexts!==1||awaiting.createdCanvases!==before.createdCanvases+1)throw Error('open is not awaiting observed native SHA256');
   f.dispose();
   const disposedBeforeHash=__disposeRecord('disposedWhileNativeHashPending');
   if(disposedBeforeHash.facilities.contexts!==1||disposedBeforeHash.facilities.pointerActive!==0||disposedBeforeHash.facilities.pointerRemoved!==1)throw Error('immediate original disposal');
   const outcome=await opening;
   if(outcome.accepted||outcome.name!=='Error'||outcome.message!=='consumer disposed')throw Error('inflight disposal refusal');
   const after=__disposeRecord('inflightCandidateRefusedAndClosed');
   if(f.canvas!==identities.canvas||f.tree!==identities.tree||f.sprite!==identities.sprite||f.catalog!==identities.catalog||f.renderer!==identities.renderer)throw Error('accepted object swapped');
   for(const key of ['generation','scene','treeScene','frameIndex','imageId','sourceRect','packed','packCalls','asset','pointerEvents','pointerLog'])if(JSON.stringify(after.observation[key])!==JSON.stringify(initial.observation[key]))throw Error('accepted retained '+key);
   if(after.facilities.contexts!==2||after.facilities.pointerAdded!==1||after.facilities.pointerRemoved!==1||after.facilities.pointerActive!==0)throw Error('candidate population/binding');
   for(const item of after.observation.contexts)for(const resource of Object.values(item.resources))if(resource.created!==resource.deleted||resource.live!==0)throw Error('candidate/native resources not deleted');
   const postBefore=__atlasFacilities();let direct;
   try{await f.openText(canonical);}catch(error){direct={name:error.name,message:error.message,code:error.code??null};}
   if(!direct||direct.message!=='consumer disposed')throw Error('postdisposed direct admitted');
   const postAfter=__atlasFacilities();
   for(const key of ['contexts','createdCanvases','pointerAdded','pointerRemoved','pointerActive','hashes','fileTexts'])if(JSON.stringify(postBefore[key])!==JSON.stringify(postAfter[key]))throw Error('postdisposed direct allocated '+key);
   __disposeRecord('postDisposedDirectAllocationZero');
   window.__disposeOutcome={inflight:outcome,direct,awaitingNativeHash:awaiting,immediateDispose:disposedBeforeHash.facilities,postDirectBefore:postBefore,postDirectAfter:postAfter};
   window.__disposeSyntheticBefore=__atlasFacilities();
   const input=document.querySelector('#open'),transfer=new DataTransfer(),file=new File([canonical],'controlled-memory-document.json',{type:'application/json'});
   transfer.items.add(file);input.files=transfer.files;
   // Controlled DOM injection: no file chooser or physical upload is used.
   input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Open failed: ERROR');
  await page.evaluate(async()=>{
   const f=__spriteAtlasConsumer,before=__disposeSyntheticBefore,after=__atlasFacilities();
   if(after.fileTexts!==before.fileTexts+1)throw Error('controlled File.text not executed');
   for(const key of ['contexts','createdCanvases','pointerAdded','pointerRemoved','pointerActive','hashes'])if(JSON.stringify(before[key])!==JSON.stringify(after[key]))throw Error('controlled File event allocated '+key);
   __disposeOutcome.syntheticFile={controlledDOMInjection:true,physicalChooser:false,fileTextsDelta:1,before,after,observedStatus:document.querySelector('#status').textContent};
   __disposeRecord('controlledFileChangeRefusedAllocationZero');
   const {serializeCanvasDocument}=await import('../dist/document.js');
   const retained=await serializeCanvasDocument(f.tree.snapshot(),id=>id==='Atlas'?f.asset:null);
   if(retained!==__disposeCanonical)throw Error('accepted canonical document changed');
   __disposeOutcome.retainedCanonicalExact=true;
  });
  const canvasBox=await page.locator('#scene').boundingBox(),startBox=await page.getByRole('button',{name:'Start',exact:true}).boundingBox();
  await page.mouse.click(canvasBox.x+35,canvasBox.y+40);
  await page.mouse.click(startBox.x+startBox.width/2,startBox.y+startBox.height/2);
  const allButtons=await page.locator('button').evaluateAll(buttons=>buttons.every(button=>button.disabled));
  const fileDisabled=await page.getByLabel('Open document',{exact:true}).isDisabled();
  if(!allButtons||!fileDisabled)throw Error('controls not disabled');
  await page.evaluate(()=>{const f=__spriteAtlasConsumer,before=__atlasFacilities();f.dispose();f.dispose();const after=__atlasFacilities();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('repeated disposal side effect');window.__disposeDisabled={allButtons:true,fileInput:true};__disposeRecord('realLatePointerDisabledStartRepeatedDispose');});
  await page.screenshot({path:dir+'screenshot.png'});
  return await page.evaluate(()=>{
   const f=__spriteAtlasConsumer,current=__disposeRecord('final'),facilities=__atlasFacilities();
   if(!current.observation.disposed||current.observation.generation!==1||current.observation.playing||current.observation.tickerRunning||current.observation.binds!==1||current.observation.unbinds!==1||current.observation.pointerEvents!==0)throw Error('final host state');
   if(facilities.pointerAdded!==1||facilities.pointerRemoved!==1||facilities.pointerActive!==0||facilities.listeners.length!==1||facilities.listeners[0].adds!==1||facilities.listeners[0].removes!==1)throw Error('exact callback identity removal');
   if(__atlasLifetime.contexts.length!==2||f.contexts.length!==2||__atlasLifetime.contexts.some(context=>!f.contexts.some(item=>item.gl===context.gl)))throw Error('all actual GL contexts');
   for(const item of f.contexts)if(item.gl.getError()!==0||item.lost||Object.values(item.resources).some(resource=>resource.created!==resource.deleted||resource.live()!==0))throw Error('GL lifetime');
   if(__atlasLifetime.errors.length||__atlasLifetime.rejections.length)throw Error('runtime errors/rejections');
   return {status:'PASS',actualBrowser:true,compiledEntry:true,defaultManualAtlas:true,canonicalDocumentInMemoryOnly:true,
    physicalChoosers:0,physicalUploads:0,saveDownloads:0,packCalls:current.observation.packCalls,pngExports:0,
    nativeHashObserved:true,outcomes:__disposeOutcome,disabled:__disposeDisabled,stages:__disposeStages,final:current,
    errors:__atlasLifetime.errors,rejections:__atlasLifetime.rejections,facilities,canonicalText:__disposeCanonical,
    allNativeGLContexts:__atlasLifetime.contexts.length,userAgent:navigator.userAgent,
    contextDetails:f.contexts.map(item=>{const gl=item.gl,extension=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),error:gl.getError()};}),
    inFlightCandidateAllocation:true,postDisposedNewAllocation:false,syntheticFilePhysicalLatencyClaim:false,
    genericCompetingOpenSupersession:false,integratedCurrentRootAcceptance:'UNRUN'};
  });
 }
}
