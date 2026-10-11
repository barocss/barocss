async page=>{
 const phase=PHASE,dir='/Users/user/.barocss-ai/v3/wt/canvas2d-svg-arcs-native/packages/barocss-canvas2d/consumer/evidence/svg-arcs/';
 if(phase===0){
  await page.evaluate(async()=>{const f=__svgArcConsumer,o=f.observe();
   const before=__coldFlat(__coldOpenScene.nodes).find(n=>n.id==='ArcPath'),after=__coldFlat(o.scene.nodes).find(n=>n.id==='ArcPath');window.__coldBernsteinRows=[];
   for(const t of [.25,.5,.75]){const a=__coldBernstein(before.commands[2],before.commands[3],t),b=__coldBernstein(after.commands[2],after.commands[3],t);if(Math.abs((b.x-a.x)-30*(1-t)*t*t)>1e-10||b.y!==a.y)throw Error('independent Bernstein delta');__coldBernsteinRows.push({t,before:a,after:b,expectedDeltaX:30*(1-t)*t*t});}
   window.__coldAfterStroke=__coldPoint(__coldStroke);__coldPaint(__coldAfterStroke,[238,242,255,255],'ArcPath','literal edited stroke/hit');
   window.__coldEditedFrame=f.fullFrame();if(__coldEditedFrame.every((v,i)=>v===__coldOpenedFrame[i]))throw Error('edited fullframe unchanged');window.__coldEditedHash=await __coldHash(__coldEditedFrame);__coldRecord('OneRealColdEditClickLastControlOnlyBernsteinPaintHit');
  });
  let p=await page.evaluate(()=>__coldForward(80,110)),box=await page.locator('#live').boundingBox();await page.mouse.click(box.x+p.x*box.width/600,box.y+p.y*box.height/300);await page.screenshot({path:dir+'screenshot.png'});
  return await page.evaluate(()=>({phase:2,screenshotReady:true,stage:__coldRecord('ActualRestoredScreenshotBeforeDispose')}));
 }
 if(phase===1){
  const before=await page.evaluate(()=>__svgArcConsumer.observe()),box=await page.locator('#live').boundingBox();await page.locator('#arc-dispose').click();await page.mouse.click(box.x+120,box.y+120);
  const result=await page.evaluate(before=>{
   const f=__svgArcConsumer,o=f.observe(),life=__saFacilities();
   if(!o.disposed||o.failure||o.busy||o.counts.imports||o.counts.svgUploads||o.counts.saves||o.counts.edits!==1||o.counts.opens!==2||o.counts.jsonUploads!==2||o.PNG)throw Error('new host counts');
   for(const key of ['candidates','accepted','disposes','binds','unbinds','subscriptions','subscriptionsRemoved'])if(o.counts[key]!==4)throw Error('new3 lifetime '+key);
   __coldEq(o.scene,before.scene,'terminal Scene');__coldEq(o.pointers,before.pointers,'late physical pointer inert');__coldEq(o.routes,before.routes,'late public route inert');
   if(o.pointers.length!==2||o.pointers.some(p=>!p.trusted||p.hit!=='ArcPath')||o.routes.length!==2)throw Error('two trusted ArcPath routes');
   if(life.contexts.length!==4||life.listeners.length!==20||life.listeners.filter(r=>r.category==='canvas').length!==12||life.listeners.filter(r=>r.category==='control').length!==8||life.listeners.some(r=>r.active||r.adds!==1||r.removes!==1))throw Error('ALL20 exact target/type/callback/capture identities');
   for(const c of life.contexts){if(c.error||c.lost)throw Error('nativeGL');for(const [name,n]of Object.entries({shader:4,program:2,buffer:3,vao:2,texture:0,fbo:0,renderbuffer:0})){const r=c.resources[name];if(r.created!==n||r.deleted!==n||r.live)throw Error('allnative '+c.id+'/'+name);}}
   if(life.twoD.length||life.images.length||life.decodeCalls||life.bitmaps.length||life.urls.length||life.downloads.length||life.fileTexts!==2||life.inputChanges!==2||__saLife.errors.length||__saLife.rejections.length||life.nativeErrors.length)throw Error('new onlyfile/noSVG reference or save/native errors');
   if(![...document.querySelectorAll('button,input')].every(e=>e.disabled))throw Error('controls disabled');const stable=JSON.stringify(o);f.dispose();if(JSON.stringify(f.observe())!==stable)throw Error('repeatDispose');
   return{status:'PASS_MEASURED_COLD_RESTORED_EDIT_LIFETIME',firstColdDriverStatus:'INCOMPLETE_DUPLICATE_NATIVE_DELIVERY',actualJSONUploads:2,actualJSONOpens:2,actualNewGL:4,actualCallbacks:20,originalStatus:'INCOMPLETE_PARTIAL_SESSION_LOST',originalLostSessionTerminal:'UNPROVED',actualBrowser:true,userAgent:navigator.userAgent,logical:[600,300],DPR:2,backing:[1200,600],nativeSavedFile:JSON.parse(__coldNativeText),openedFullFrameBytes:2880000,originalFrameSHA256:__coldOpenedHash,editedFrameSHA256:__coldEditedHash,wholeSceneOnlyLastCChange:true,bernstein:__coldBernsteinRows,literalLastControl:__coldLiteralLast,strokePoint:__coldStroke,beforeStroke:__coldBeforeStroke,afterStroke:__coldAfterStroke,stages:__coldRows,terminal:__coldRecord('NEWActualFourGLAnd20CallbacksTerminalBeforeBrowserClosure'),facilities:life,errors:__saLife.errors,rejections:__saLife.rejections,nativeErrors:life.nativeErrors,originalAcceptedReplay:0,physicalSVG:0,physicalSave:0,physicalJSONOpen:2,originalTerminalExtrapolated:false,broaderRootAcceptance:'UNRUN'};
  },before);
  result.requests=[...page.__saRequests];result.externalRequests=result.requests.filter(u=>!u.startsWith('http://127.0.0.1:31451/'));result.console=[...page.__coldConsole];if(result.externalRequests.length)throw Error('externalrequests');return result;
 }
}
