async (page)=>{
 const assert=(ok,m)=>{if(!ok)throw Error(m)};const get=()=>page.evaluate(()=>window.nestedMaskFixture.observe());
 const initial=await page.evaluate(()=>window.__nestedReport.observations[0]);
 const decoded=await page.evaluate(async points=>{const blob=await(await fetch('./evidence/nested-mask/exported.png')).blob();const bitmap=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);const samples=Object.fromEntries(Object.entries(points).map(([key,p])=>[key,Array.from(ctx.getImageData(Math.floor(p.x*2),Math.floor(p.y*2),1,1).data)]));bitmap.close();return{width:c.width,height:c.height,samples}},initial.accepted.points);
 assert(decoded.width===640&&decoded.height===480,'PNG dimensions');for(const[k,s]of Object.entries(initial.accepted.samples))assert(JSON.stringify(decoded.samples[k])===JSON.stringify(s.rgba),'decoded '+k);
 await page.evaluate(decoded=>window.__nestedReport.decodedPNG=decoded,decoded);
 await page.getByRole('button',{name:'Lose context',exact:true}).click();await page.waitForFunction(()=>window.nestedMaskFixture.observe().counts.contextLosses===1);
 await page.evaluate(()=>window.__nestedReport.observations.push({name:'context lost',...window.nestedMaskFixture.observe()}));
 await page.getByRole('button',{name:'Restore context',exact:true}).click();await page.waitForFunction(()=>window.nestedMaskFixture.observe().counts.contextRestores===1);
 const restored=await get();assert(JSON.stringify(restored.accepted.samples)===JSON.stringify(initial.accepted.samples),'restore pixels/hits');await page.evaluate(o=>window.__nestedReport.observations.push({name:'context restored',...o}),restored);
 await page.screenshot({path:'/tmp/canvas2d-1054-screen.png'});
 const r=await page.locator('#scene').boundingBox();await page.getByRole('button',{name:'Dispose',exact:true}).click();const stopped=await get();await page.mouse.click(r.x+initial.accepted.points.both.x,r.y+initial.accepted.points.both.y);const final=await get();assert(final.disposed&&final.counts.liveRenderers===0&&final.counts.pointerEvents===stopped.counts.pointerEvents,'Dispose');
 return await page.evaluate(o=>{window.__nestedReport.observations.push({name:'Dispose and later pointer',...o});return {browser:navigator.userAgent,...window.__nestedReport}},final);
}
