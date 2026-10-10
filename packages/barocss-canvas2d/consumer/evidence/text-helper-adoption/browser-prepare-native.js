async (page) => {
 await page.evaluate(async () => {
  const {parseCanvasDocument}=await import('/dist/document.js');
  const text=await(await fetch('/consumer/evidence/text-raster/saved-document.json')).text();
  const parsed=await parseCanvasDocument(text),label=parsed.scene.nodes.find(n=>n.id==='Label');
  window.__nativeExpected={text,scene:parsed.scene,label,bytes:[...parsed.assets.get('TextAtlas').pixels]};
  window.__beforeNative={helper:window.textRaster.observe().counts.helperCalls,fontLoads:window.__gpuProof.fontLoads,scratch:window.__gpuProof.scratch2D,canvas:window.textRaster.canvas};
 });
}
