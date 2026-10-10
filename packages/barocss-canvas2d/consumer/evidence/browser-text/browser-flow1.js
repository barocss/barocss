async (page) => {
 await page.reload();
 await page.waitForFunction(()=>window.browserTextConsumer?.observe().accepted?.text==='Canvas2D'&&!window.browserTextConsumer.observe().preparing);
 await page.evaluate(()=>{window.__flow=[];window.__record=label=>{const o=window.browserTextConsumer.observe();window.__flow.push({label,...JSON.parse(JSON.stringify(o,(k,v)=>k==='allBytes'?undefined:v))})};window.__record('initial')});
 async function pointer(){const p=await page.evaluate(()=>window.browserTextConsumer.points());const b=await page.locator('#scene').boundingBox();await page.mouse.click(b.x+p.ink.x,b.y+p.ink.y);if(p.space)await page.mouse.click(b.x+p.space.x,b.y+p.space.y)}
 await pointer();
 await page.getByRole('button',{name:'HI at DPR 2',exact:true}).click();await page.waitForFunction(()=>window.browserTextConsumer.observe().accepted.text==='HI'&&!window.browserTextConsumer.observe().preparing);await pointer();await page.evaluate(()=>window.__record('HI2'));
 await page.getByRole('button',{name:'H I at DPR 1.5',exact:true}).click();await page.waitForFunction(()=>window.browserTextConsumer.observe().accepted.text==='H I'&&!window.browserTextConsumer.observe().preparing);await pointer();await page.evaluate(()=>window.__record('space1.5'));
 await page.getByRole('button',{name:'Reject invalid font',exact:true}).click();await page.evaluate(()=>window.__record('invalid'));
 await page.getByRole('button',{name:'Reject oversized font',exact:true}).click();await page.evaluate(()=>window.__record('oversize'));
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save document',exact:true}).click();await (await download).saveAs('/tmp/c2d1024-saved-document.json');await page.waitForFunction(()=>!!window.browserTextConsumer.observe().saved);await page.evaluate(()=>window.__record('saved'));
}
