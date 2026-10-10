async (page) => {
 await page.reload();
 await page.waitForFunction(()=>window.textRaster?.observe().state==='ready');
 await page.evaluate(()=>{
  window.__flow=[];
  window.__record=label=>{const o=window.textRaster.observe(),p=window.__gpuProof;window.__flow.push({label,...o,runtime:{scratch2D:p.scratch2D,draws:p.draws,fontLoads:p.fontLoads,fontChecks:p.fontChecks,glContexts:p.contexts.length}})};
  window.__record('initial');
 });
 async function pointer(){const p=await page.evaluate(()=>window.textRaster.points());const b=await page.locator('#scene').boundingBox();await page.mouse.click(b.x+p.ink.point.x,b.y+p.ink.point.y);if(p.space)await page.mouse.click(b.x+p.space.point.x,b.y+p.space.point.y)}
 await pointer();
 for(const text of ['HI','H I']){
  await page.getByRole('button',{name:text,exact:true}).click();await page.waitForFunction(t=>window.textRaster.observe().state==='ready'&&window.textRaster.observe().accepted.text===t,text);
  await pointer();await page.evaluate(t=>window.__record(t),text);
 }
 await page.getByRole('button',{name:'Reject malformed text',exact:true}).click();await page.waitForFunction(()=>window.textRaster.observe().failure?.code==='HOST_TEXT');
 await page.evaluate(()=>{if(!window.textRaster.observe().failure.retained)throw new Error('text refusal changed accepted state');window.__record('malformed')});
 await page.getByRole('button',{name:'Reject oversized font',exact:true}).click();
 await page.evaluate(()=>{const o=window.textRaster.observe();if(o.failure?.code!=='ASSET_LIMIT'||!o.failure.retained)throw new Error('real oversize refusal mismatch');window.__record('actualOversize32M1000px')});
 const before=await page.evaluate(()=>({ignored:window.textRaster.observe().counts.ignored,helper:window.textRaster.observe().counts.helperCalls}));
 await page.getByRole('button',{name:'Slow HI',exact:true}).click();await page.getByRole('button',{name:'H I',exact:true}).click();
 await page.waitForFunction(n=>window.textRaster.observe().counts.ignored>n,before.ignored);
 await page.evaluate(h=>{const o=window.textRaster.observe();if(o.counts.helperCalls!==h+1||o.accepted.text!=='H I')throw new Error('stale readiness reached helper');window.__record('supersededReadinessNoScratch')},before.helper);
 await page.evaluate(()=>{window.__savedBytes=[...window.textRaster.bytes()];window.__savedObservation=window.textRaster.observe().accepted;window.__savedCanvas=window.textRaster.canvas;window.__beforeOpen={helper:window.textRaster.observe().counts.helperCalls,fontLoads:window.__gpuProof.fontLoads,scratch:window.__gpuProof.scratch2D}});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save document',exact:true}).click();await(await download).saveAs('/tmp/c2d1150-saved-document.json');await page.waitForFunction(()=>!!window.textRaster.observe().saved);
 await page.evaluate(()=>window.__record('savedCurrentScene27'));
}
