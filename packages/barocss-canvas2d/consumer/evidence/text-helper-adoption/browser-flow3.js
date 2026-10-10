async (page) => {
 await page.waitForFunction(()=>window.textRaster.observe().accepted?.source==='document'&&window.textRaster.observe().accepted.text==='H I');
 await page.evaluate(()=>{
  const o=window.textRaster.observe(),e=window.__nativeExpected,b=window.__beforeNative,p=window.__gpuProof,bytes=[...window.textRaster.bytes()],l=e.label;
  const proof=window.__nativeOpenProof={sourceVersion:e.scene.version,admittedVersion:o.accepted.sceneVersion,byteLength:bytes.length,allBytes:bytes.length===e.bytes.length&&bytes.every((v,i)=>v===e.bytes[i]),glyphs:JSON.stringify(o.accepted.layout.glyphs)===JSON.stringify(l.glyphs),text:o.accepted.text===l.text,baseline:o.accepted.layout.baseline===l.baseline,atlas:o.accepted.layout.atlasId===l.atlasId,opacity:o.accepted.layout.opacity===l.opacity,sampling:o.accepted.layout.sampling===l.sampling,context:o.accepted.contextId===e.scene.contextId,ids:JSON.stringify(o.accepted.ids)===JSON.stringify(e.scene.nodes.map(n=>n.id)),freshCanvas:window.textRaster.canvas!==b.canvas,font:o.accepted.font===null,helperCalls:o.counts.helperCalls===b.helper,fontLoads:p.fontLoads===b.fontLoads,scratch:p.scratch2D===b.scratch,ink:JSON.stringify(o.accepted.ink)===JSON.stringify(window.__savedObservation.ink),space:JSON.stringify(o.accepted.space)===JSON.stringify(window.__savedObservation.space)};
  for(const [k,v]of Object.entries(proof))if(!['sourceVersion','admittedVersion','byteLength'].includes(k)&&!v)throw new Error('native physical Open '+k);
  window.__record('physicalOpenNative1011Scene23');
 });
 await page.getByRole('button',{name:'Edit restored label to HI',exact:true}).click();await page.waitForFunction(()=>window.textRaster.observe().accepted?.text==='HI'&&window.textRaster.observe().state==='ready');
 await page.evaluate(()=>{if(window.textRaster.observe().counts.layoutEdits!==2)throw new Error('native restored helper layout missing');window.__record('nativeRestoredHelperSetLayoutHI')});
 const p=await page.evaluate(()=>window.textRaster.points()),b=await page.locator('#scene').boundingBox();await page.mouse.click(b.x+p.ink.point.x,b.y+p.ink.point.y);
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();await(await downloaded).saveAs('/tmp/c2d1150-exported.png');await page.waitForFunction(()=>!!window.textRaster.observe().png);
 await page.evaluate(()=>window.__record('pngNativeRestoredCurrent27'));await page.screenshot({path:'/tmp/c2d1150-screenshot.png'});
}
