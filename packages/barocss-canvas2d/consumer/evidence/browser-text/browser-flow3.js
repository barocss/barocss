async (page) => {
 await page.evaluate(async()=>{
  const blob=await (await fetch('/consumer/evidence/browser-text/exported.png')).blob();const bitmap=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);const o=window.browserTextConsumer.observe();const rows=[];
  for(const [name,sample]of Object.entries(o.accepted.samples)){if(!sample)continue;const x=Math.floor(sample.point.x*2),y=Math.floor(sample.point.y*2);const rgba=[...ctx.getImageData(x,y,1,1).data];if(JSON.stringify(rgba)!==JSON.stringify(sample.rgba))throw new Error('PNG mismatch '+name);rows.push({name,x,y,rgba})}
  window.__pngProof={bytes:blob.size,width:bitmap.width,height:bitmap.height,rows,exact:true};bitmap.close();
 });
 await page.getByRole('button',{name:'Dispose',exact:true}).click();
 const b=await page.locator('#scene').boundingBox();await page.mouse.click(b.x+30,b.y+60);
 await page.evaluate(()=>{
  window.__record('disposed');const p=window.__gpuProof;window.__gpuFinal={contexts:p.contexts.map(c=>({created:c.created,deleted:c.deleted,capacity:c.capacity,live:c.live()})),pointerAdds:p.pointerAdds,pointerRemoves:p.pointerRemoves,errors:p.errors,warnings:p.warnings};
  const o=window.browserTextConsumer.observe();if(o.counts.liveRenderers!==0||o.counts.rendererCreated!==o.counts.rendererDisposed||o.counts.binds!==o.counts.unbinds||o.counts.pointerEvents!==7)throw new Error('dispose mismatch');
  for(const c of window.__gpuFinal.contexts){if(Object.values(c.live).some(Boolean)||JSON.stringify(c.created)!==JSON.stringify(c.deleted))throw new Error('GPU resources remain')}
 });
}
