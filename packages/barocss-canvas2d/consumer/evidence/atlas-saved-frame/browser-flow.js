async page=>{
 const phase=PHASE,dir='/Users/user/.codex/worktrees/canvas2d-atlas-reopen/barocss/packages/barocss-canvas2d/consumer/evidence/atlas-saved-frame/';
 if(phase===0){
  await page.addInitScript(()=>{
   window.__savedFrameRuntime={errors:[],rejections:[],contexts:[]};
   addEventListener('error',event=>__savedFrameRuntime.errors.push(event.message));
   addEventListener('unhandledrejection',event=>__savedFrameRuntime.rejections.push(String(event.reason)));
   const get=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(...args){const gl=get.apply(this,args);
    if(args[0]==='webgl2'&&gl&&!__savedFrameRuntime.contexts.some(item=>item.gl===gl))__savedFrameRuntime.contexts.push({gl,canvas:this});
    return gl;};
  });
  await page.goto('http://127.0.0.1:31296/packages/barocss-canvas2d/consumer/sprite-atlas.html');
  await page.waitForFunction(()=>!!window.__spriteAtlasConsumer);
  await page.evaluate(()=>{
   window.__savedStages=[];
   window.__savedExpected=new Uint8Array(['RRRBB','RRRBB','000BB','CMMMM','C0000'].flatMap(row=>[...row].flatMap(c=>({R:[255,0,0,255],B:[0,0,255,255],C:[0,255,0,0],M:[255,0,255,128],0:[0,0,0,0]})[c])));
   window.__savedCrops={Red:{x:0,y:0,width:3,height:2},Blue:{x:3,y:0,width:2,height:3},Clear:{x:0,y:3,width:1,height:2},Gold:{x:1,y:3,width:4,height:1}};
   window.__savedEqual=(a,b,label)=>{if(a.length!==b.length||a.some((value,index)=>value!==b[index]))throw Error(label);};
   window.__savedRecord=label=>{const current=__spriteAtlasConsumer.observe();if(current.contexts.some(item=>item.error!==0||item.lost))throw Error(label+' context error/loss');__savedStages.push({label,...current});return current;};
   window.__savedFullFrame=()=>{const f=__spriteAtlasConsumer,gl=f.canvas.getContext('webgl2'),pixels=new Uint8Array(200*160*4);gl.readPixels(0,0,200,160,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
   // Independent pixel-center geometry and premultiplied color oracle. Tolerance2 was frozen before execution.
   window.__savedFrameOracle=(pixels,rgba)=>{let maximum=0;for(let y=0;y<160;y++)for(let x=0;x<200;x++){
    const logicalX=(x+0.5)/2,logicalY=(159-y+0.5)/2;
    const expected=logicalX>=20&&logicalX<70&&logicalY>=20&&logicalY<70?rgba:
     logicalX>=10&&logicalX<80&&logicalY>=10&&logicalY<70?[255,255,0,255]:[0,0,0,0];
    const offset=(y*200+x)*4;for(let c=0;c<4;c++){const difference=Math.abs(pixels[offset+c]-expected[c]);maximum=Math.max(maximum,difference);if(difference>2)throw Error('independent framebuffer oracle '+x+','+y+','+c);}
   }return {comparedBytes:pixels.length,tolerance:2,maximumDifference:maximum};};
   window.__savedCheck=(label,rgba,index)=>{const current=__savedRecord(label);for(const sample of current.samples){if(sample.hit!=='Sprite'||sample.rgba.some((value,c)=>Math.abs(value-rgba[c])>2))throw Error(label+' pixels/hits');}
    if(index!==undefined&&current.frameIndex!==index)throw Error(label+' frame index');
    return current;};
   __savedCheck('manualDefaultRed',[255,0,0,255],0);
  });
  return {ready:await page.title()};
 }
 if(phase===1){
  await page.getByRole('button',{name:'Pack images',exact:true}).click();
  await page.evaluate(()=>{const f=__spriteAtlasConsumer,current=__savedCheck('packedRed',[255,0,0,255],0);
   if(current.packCalls!==1||current.asset.width!==5||current.asset.height!==5||current.asset.bytes!==100)throw Error('packed atlas dimensions');
   __savedEqual(f.asset.pixels,__savedExpected,'all100 host packed bytes');__savedEqual(f.renderer.getImageAsset('Atlas').pixels,__savedExpected,'all100 renderer bytes');
   for(const[name,crop]of Object.entries(__savedCrops))if(JSON.stringify(f.catalog.frame(name).sourceRect)!==JSON.stringify(crop))throw Error('packed crop '+name);
  });
  await page.getByRole('button',{name:'Edit restored Gold',exact:true}).click();
  await page.evaluate(async()=>{const f=__spriteAtlasConsumer,current=__savedCheck('goldBeforeSave',[255,127,128,255]);
   if(current.playing||current.tickerRunning||JSON.stringify(current.sourceRect)!==JSON.stringify(__savedCrops.Gold))throw Error('saved Gold crop/pause');
   __savedEqual(f.renderer.getImageAsset('Atlas').pixels,__savedExpected,'Gold all100 bytes');
   window.__savedText=await f.documentText();window.__savedScene=current.scene;window.__savedOldCanvas=f.canvas;window.__savedOldTree=f.tree;window.__savedOldRenderer=f.renderer;
   const envelope=JSON.parse(__savedText),scene=JSON.parse(envelope.scene);
   if(envelope.version!==1||scene.version!==29||scene.contextId!=='SpriteAtlasConsumer'||scene.nodes.map(n=>n.id).join(',')!=='Back,Sprite')throw Error('saved versions/IDs/context');
   window.__savedGoldPixels=__savedFullFrame();window.__savedGoldOracle=__savedFrameOracle(__savedGoldPixels,[255,127,128,255]);
  });
  const[download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save document',exact:true}).click()]);
  await download.saveAs(dir+'saved-document.json');
  await page.evaluate(()=>__savedRecord('savedGoldScene29'));
  return {savedGold:true,saveDownloads:1};
 }
 // Between phase1 and phase2, click Open document and use Playwright CLI upload
 // exactly once. The first run reached this chooser inside run-code; CLI paused
 // at the modal, so one CLI upload and same-page phase2 resumed without replay.
 if(phase===2){
  await page.waitForFunction(()=>__spriteAtlasConsumer.observe().generation===2);
  await page.evaluate(async()=>{const f=__spriteAtlasConsumer,current=__savedCheck('physicalOneOpenGold',[255,127,128,255],3);
   if(f.canvas===__savedOldCanvas||f.tree===__savedOldTree||f.renderer===__savedOldRenderer)throw Error('fresh canvas/tree/renderer');
   if(current.playing||current.tickerRunning||current.packCalls!==1||current.scene!==__savedScene||current.treeScene!==__savedScene||await f.documentText()!==__savedText)throw Error('paused3/full saved scene/file/no repack');
   if(f.tree.snapshot().version!==29||f.tree.snapshot().contextId!=='SpriteAtlasConsumer'||f.tree.get('Sprite')?.kind!=='sprite'||f.tree.get('Back')?.kind!=='rect')throw Error('restored version/IDs/context');
   __savedEqual(f.asset.pixels,__savedExpected,'fresh host all100 bytes');__savedEqual(f.renderer.getImageAsset('Atlas').pixels,__savedExpected,'fresh renderer all100 bytes');
   __savedEqual(__savedFullFrame(),__savedGoldPixels,'fresh full framebuffer exact');
   window.__savedUnknownBefore={observation:current,canvas:f.canvas,tree:f.tree,renderer:f.renderer,asset:[...f.renderer.getImageAsset('Atlas').pixels],text:await f.documentText(),frame:__savedFullFrame()};
   const candidate=JSON.parse(__savedText),candidateScene=JSON.parse(candidate.scene);candidateScene.nodes.find(node=>node.id==='Sprite').sourceRect={x:0,y:0,width:1,height:1};candidate.scene=JSON.stringify(candidateScene);
   window.__savedUnknown={validCrop:{x:0,y:0,width:1,height:1},contextCountBefore:f.contexts.length};
   let caught;try{await f.openText(JSON.stringify(candidate));}catch(error){caught={name:error.name,code:error.code??null,message:error.message};}
   if(!caught)throw Error('unknown catalog crop accepted');__savedUnknown.refusal=caught;
   const after=__savedCheck('unknownCropRefusedRetainedGold',[255,127,128,255],3),before=__savedUnknownBefore;
   if(f.canvas!==before.canvas||f.tree!==before.tree||f.renderer!==before.renderer)throw Error('unknown crop changed accepted object identities');
   for(const key of ['generation','scene','treeScene','frameIndex','playing','tickerRunning','imageId','sourceRect','packed','packCalls','binds','unbinds','pointerEvents','pointerLog','asset','samples'])if(JSON.stringify(after[key])!==JSON.stringify(before.observation[key]))throw Error('unknown crop retained '+key);
   if(await f.documentText()!==before.text)throw Error('unknown crop changed accepted document');__savedEqual(f.renderer.getImageAsset('Atlas').pixels,before.asset,'unknown crop retained asset100');__savedEqual(__savedFullFrame(),before.frame,'unknown crop fullframe retained');
   if(f.contexts.length!==__savedUnknown.contextCountBefore+1)throw Error('unknown staged candidate context absent');
   const rejected=f.contexts.at(-1);if(rejected.gl.getError()!==0||Object.values(rejected.resources).some(r=>r.created!==r.deleted||r.live()!==0))throw Error('unknown staged candidate resource leak');
   __savedUnknown.contextCountAfter=f.contexts.length;__savedUnknown.retained=true;__savedUnknown.candidateDisposed=true;
  });
  await page.getByRole('button',{name:'Start',exact:true}).click();
  // Existing scheduler is controlled. The first timestamp contributes delta0.
  await page.evaluate(()=>{const f=__spriteAtlasConsumer;f.tick(0);const current=__savedCheck('startFirstDeltaZeroGold',[255,127,128,255],3);
   if(!current.playing||!current.tickerRunning||document.querySelector('#status').textContent!=='Tick 0 ms')throw Error('first delta zero state');
   __savedEqual(__savedFullFrame(),__savedGoldPixels,'first delta0 fullframe Gold');f.tick(80);__savedCheck('tick80WrapRed',[255,0,0,255],0);
   if(JSON.stringify(f.sprite.data.sourceRect)!==JSON.stringify(__savedCrops.Red))throw Error('Gold80ms wraps Red');window.__savedRedOracle=__savedFrameOracle(__savedFullFrame(),[255,0,0,255]);
  });
  const box=await page.locator('#scene').boundingBox();await page.mouse.click(box.x+35,box.y+40);await page.mouse.click(box.x+15,box.y+15);
  await page.evaluate(()=>{const current=__savedRecord('realSpriteThenBackPointers');if(current.pointerEvents!==2||current.pointerLog.join(',')!=='Sprite,stage,stage')throw Error('real pointer routing');});
  await page.screenshot({path:dir+'screenshot.png'});
  await page.getByRole('button',{name:'Dispose',exact:true}).click();await page.mouse.click(box.x+35,box.y+40);
  return await page.evaluate(()=>{const f=__spriteAtlasConsumer,current=__savedRecord('disposeLatePointer');
   if(!current.disposed||current.playing||current.tickerRunning||current.pointerEvents!==2||current.binds!==current.unbinds)throw Error('ticker/pointer disposal');
   if(__savedFrameRuntime.contexts.length!==3||f.contexts.length!==3||__savedFrameRuntime.contexts.some(c=>!f.contexts.some(item=>item.gl===c.gl)))throw Error('all actual GL context population');
   for(const item of f.contexts)if(item.gl.getError()!==0||item.lost||Object.values(item.resources).some(resource=>resource.created!==resource.deleted||resource.live()!==0))throw Error('all actual contexts resources');
   if(__savedFrameRuntime.errors.length||__savedFrameRuntime.rejections.length)throw Error('runtime errors/rejections');
   return {status:'PASS',actualBrowser:true,compiledEntry:true,controlledScheduler:true,physicalUploads:1,saveDownloads:1,
    logical:[100,80],dpr:2,backing:[200,160],userAgent:navigator.userAgent,assetRGBA:[...__savedExpected],fullAssetBytes:100,crops:__savedCrops,
    goldFramebuffer:__savedGoldOracle,redFramebuffer:__savedRedOracle,unknownCrop:__savedUnknown,stages:__savedStages,
    errors:__savedFrameRuntime.errors,rejections:__savedFrameRuntime.rejections,final:current,
    allNativeGLContexts:__savedFrameRuntime.contexts.length,
    contextDetails:f.contexts.map(item=>{const gl=item.gl,extension=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),capacity:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),error:gl.getError()};}),
    savedText:__savedText,saveOpenSameSessionCatalog:true,persistedAnimationProgress:false,pngExportRerun:false,integratedCurrentRootAcceptance:'UNRUN'};
  });
 }
}
