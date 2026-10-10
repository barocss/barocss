async (page) => {
 await page.evaluate(async()=>{
  const blob=await(await fetch('/consumer/evidence/text-helper-adoption/exported.png')).blob(),bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);
  const o=window.textRaster.observe(),samples=[];
  for(const key of ['ink','space','background']){const expected=o.accepted[key];if(!expected)continue;const rgba=[...ctx.getImageData(Math.floor(expected.point.x*2),Math.floor(expected.point.y*2),1,1).data];samples.push({key,point:expected.point,rgba,expected:expected.rgba,equal:JSON.stringify(rgba)===JSON.stringify(expected.rgba)})}
  window.__pngDecode={bytes:blob.size,backing:[bitmap.width,bitmap.height],samples,allEqual:samples.every(s=>s.equal)};bitmap.close();if(!window.__pngDecode.allEqual)throw new Error('PNG pixel mismatch');window.__record('actualDownloadedPNGDecoded');
 });
 const before=await page.evaluate(()=>({counts:window.textRaster.observe().counts,scratch:window.__gpuProof.scratch2D,draws:window.__gpuProof.draws,contexts:window.__gpuProof.contexts.length}));
 await page.getByRole('button',{name:'Slow HI',exact:true}).click();await page.getByRole('button',{name:'Dispose',exact:true}).click();
 await page.waitForFunction(n=>window.textRaster.observe().counts.ignored>n,before.counts.ignored);
 const canvasBox=await page.locator('#scene').boundingBox();await page.mouse.click(canvasBox.x+25,canvasBox.y+50);
 await page.evaluate(b=>{
  const o=window.textRaster.observe(),p=window.__gpuProof;
  window.__lateDisposeProof={helperUnchanged:o.counts.helperCalls===b.counts.helperCalls,scratchUnchanged:p.scratch2D===b.scratch,drawsUnchanged:p.draws===b.draws,contextsUnchanged:p.contexts.length===b.contexts,rendererCreationsUnchanged:o.counts.rendererCreated===b.counts.rendererCreated,submitsUnchanged:o.counts.sceneSubmits===b.counts.sceneSubmits,rendersUnchanged:o.counts.renders===b.counts.renders,latePointerUnchanged:o.counts.pointerEvents===b.counts.pointerEvents,allDisplayDisposed:o.counts.rendererCreated===o.counts.rendererDisposed&&o.counts.liveDisplayRenderers===0,bindingsRemoved:o.counts.bindings===o.counts.unbindings};
  if(!Object.values(window.__lateDisposeProof).every(Boolean))throw new Error('late disposed readiness changed host');window.__record('lateReadinessAfterDisposeAndPhysicalPointer');
  window.__resources=p.contexts.map(c=>({created:c.created,deleted:c.deleted,live:c.live(),capacity:c.capacity,error:c.error()}));
  for(const c of window.__resources){if(Object.values(c.live).some(Boolean)||c.error!==0)throw new Error('live GPU handle/error after Dispose');for(const k in c.created)if(c.created[k]!==c.deleted[k])throw new Error('unmatched normal GPU '+k)}
  window.__finalProof={browser:navigator.userAgent,dpr:devicePixelRatio,flow:window.__flow,currentOpen:window.__currentOpenProof,nativeOpen:window.__nativeOpenProof,controlledTimeout:window.__timeoutProof,png:window.__pngDecode,lateDispose:window.__lateDisposeProof,resources:window.__resources,pointerAdds:p.pointerAdds,pointerRemoves:p.pointerRemoves,applicationConsole:{errors:p.errors,warnings:p.warnings},actualPlatformFontTimeout:false,contextLossRun:false,performanceClaim:false};
 },before);
}
