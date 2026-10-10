async (page) => {
 await page.waitForFunction(()=>window.textRaster.observe().accepted?.source==='document');
 await page.evaluate(()=>{
  const o=window.textRaster.observe(),p=window.__gpuProof,b=window.__beforeOpen,bytes=[...window.textRaster.bytes()];
  const proof=window.__currentOpenProof={freshCanvas:window.textRaster.canvas!==window.__savedCanvas,allBytes:bytes.length===window.__savedBytes.length&&bytes.every((v,i)=>v===window.__savedBytes[i]),byteLength:bytes.length,layout:JSON.stringify(o.accepted.layout)===JSON.stringify(window.__savedObservation.layout),context:o.accepted.contextId===window.__savedObservation.contextId,ids:JSON.stringify(o.accepted.ids)===JSON.stringify(window.__savedObservation.ids),ink:JSON.stringify(o.accepted.ink)===JSON.stringify(window.__savedObservation.ink),space:JSON.stringify(o.accepted.space)===JSON.stringify(window.__savedObservation.space),font:o.accepted.font===null,helperCalls:o.counts.helperCalls===b.helper,fontLoads:p.fontLoads===b.fontLoads,scratch:p.scratch2D===b.scratch};
  for(const [k,v]of Object.entries(proof))if(k!=='byteLength'&&!v)throw new Error('current physical Open '+k);
  window.__record('physicalOpenCurrent27');
 });
 const p=await page.evaluate(()=>window.textRaster.points()),b=await page.locator('#scene').boundingBox();await page.mouse.click(b.x+p.ink.point.x,b.y+p.ink.point.y);
 await page.getByRole('button',{name:'Edit restored label to HI',exact:true}).click();await page.waitForFunction(()=>window.textRaster.observe().accepted?.text==='HI'&&window.textRaster.observe().state==='ready');
 await page.evaluate(()=>{if(window.textRaster.observe().counts.layoutEdits!==1)throw new Error('restored current handle not edited');window.__record('restoredCurrentPublicLayoutHI')});
 // Controlled unresolved font-ready injection exercises the real host timer,
 // not physical platform font loading failure.
 await page.evaluate(()=>{
  const fonts=document.fonts;window.__fontReadyOriginal=Object.getOwnPropertyDescriptor(fonts,'ready');window.__fontTimeoutStart=performance.now();
  Object.defineProperty(fonts,'ready',{value:new Promise(()=>{}),configurable:true});
  window.__timeoutBefore={scratch:window.__gpuProof.scratch2D,helper:window.textRaster.observe().counts.helperCalls,renderers:window.textRaster.observe().counts.rendererCreated};
 });
 await page.getByRole('button',{name:'HI',exact:true}).click();await page.waitForFunction(()=>window.textRaster.observe().failure?.code==='HOST_FONT_TIMEOUT',null,{timeout:7000});
 await page.evaluate(()=>{
  if(window.__fontReadyOriginal)Object.defineProperty(document.fonts,'ready',window.__fontReadyOriginal);else delete document.fonts.ready;
  const o=window.textRaster.observe(),b=window.__timeoutBefore;
  window.__timeoutProof={controlledInjection:true,elapsedMS:performance.now()-window.__fontTimeoutStart,retained:o.failure.retained,helperUnchanged:o.counts.helperCalls===b.helper,scratchUnchanged:window.__gpuProof.scratch2D===b.scratch,rendererUnchanged:o.counts.rendererCreated===b.renderers};
  if(!Object.values(window.__timeoutProof).every(Boolean))throw new Error('timeout retention');window.__record('controlledReadyTimeout5s');
 });
}
