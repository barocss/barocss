async (page) => {
 await page.waitForFunction(()=>window.browserTextConsumer.observe().accepted.source==='document');
 await page.evaluate(()=>{const o=window.browserTextConsumer.observe();if(!Object.values(o.opened).every(Boolean)||o.accepted.font!==null)throw new Error('cold Open mismatch');window.__record('opened')});
 const p=await page.evaluate(()=>window.browserTextConsumer.points());const b=await page.locator('#scene').boundingBox();await page.mouse.click(b.x+p.ink.x,b.y+p.ink.y);
 await page.getByRole('button',{name:'Rerasterize restored HI',exact:true}).click();await page.waitForFunction(()=>window.browserTextConsumer.observe().accepted.text==='HI'&&!window.browserTextConsumer.observe().preparing);
 await page.evaluate(()=>window.__record('restoredHI'));
 await page.evaluate(async()=>{
  const {rasterizeBrowserText}=await import('/dist/index.js');const rows=[];
  for(const dpr of [1,2,1.5]){
   const o={text:'Canvas2D',font:'24px monospace',atlasId:'Proof',dpr};const a=rasterizeBrowserText(o),b=rasterizeBrowserText(o);
   const ctx=document.createElement('canvas').getContext('2d');ctx.font=a.font;const m=ctx.measureText(o.text);
   rows.push({dpr,font:a.font,advance:a.advance,bounds:a.bounds,backing:[a.asset.width,a.asset.height],metrics:{width:m.width,left:m.actualBoundingBoxLeft,right:m.actualBoundingBoxRight,ascent:m.actualBoundingBoxAscent,descent:m.actualBoundingBoxDescent},copies:a.asset.pixels!==b.asset.pixels&&a.layout!==b.layout&&a.bounds!==b.bounds});
  }window.__helperProof={browser:navigator.userAgent,rows};
 });
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();await (await downloaded).saveAs('/tmp/c2d1024-exported.png');await page.waitForFunction(()=>!!window.browserTextConsumer.observe().png);await page.evaluate(()=>window.__record('png'));
 await page.screenshot({path:'/tmp/c2d1024-screen.png'});
}
