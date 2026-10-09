async (page) => {
 const assert=(ok,m)=>{if(!ok)throw Error(m)};
 const observations=[]; const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')errors.push(m.type()+': '+m.text())});
 const get=()=>page.evaluate(()=>window.nestedMaskFixture.observe());
 const stage=async name=>{const o=await get();observations.push({name,...o});return o};
 const click=async name=>{await page.getByRole('button',{name,exact:true}).click();return stage(name)};
 const initial=await stage('initial');for(const [k,id] of Object.entries(initial.accepted.initialExpectedTopIds))assert(initial.accepted.samples[k].hit===id,'initial '+k);
 const expected={both:[255,0,0,255],outerOnly:[51,51,51,255],innerOnly:[51,51,51,255],neither:[51,51,51,255],nonzeroHole:[255,0,0,255],glyphOpaque:[255,255,255,255],glyphTransparent:[255,0,0,255],stroke:[255,255,0,255],zeroSibling:[0,0,255,255],oneSibling:[255,0,0,255],twoSibling:[0,255,255,255]};for(const[k,rgba]of Object.entries(expected))assert(JSON.stringify(initial.accepted.samples[k].rgba)===JSON.stringify(rgba),'pixel '+k);
 assert(initial.accepted.samples.gradient.rgba[1]>0&&initial.accepted.samples.gradient.rgba[2]>0,'gradient');
 for(const key of ['both','outerOnly','innerOnly','glyphOpaque','groupArea','twoSibling']){const p=initial.accepted.points[key],r=await page.locator('#scene').boundingBox();await page.mouse.click(r.x+p.x,r.y+p.y)}
 const pointer=await stage('real pointer');assert(pointer.counts.pointerEvents===6,'pointer count');assert(pointer.pointerLog.some(x=>x.includes('Inner:Glyph')),'glyph bubble');
 let o=await click('Remove outer');assert(o.accepted.masks.outer===null&&o.accepted.masks.inner!==null,'remove outer');assert(o.accepted.samples.innerOnly.hit==='Sprite','inner only revealed');await click('Restore outer');
 o=await click('Remove inner');assert(o.accepted.masks.inner===null,'remove inner');assert(o.accepted.samples.outerOnly.hit==='Sprite','outer only revealed');await click('Restore inner');
 o=await click('Disjoint overlap');assert(o.accepted.samples.both.hit==='Back','disjoint empty');await click('Restore both');
 o=await click('Reject third ancestor');assert(o.failure.code==='SCENE_LIMIT'&&o.failure.retained,'third atomic refusal');
 const before=await get();await page.evaluate(()=>window.__oldNestedCanvas=window.nestedMaskFixture.canvas);
 const [doc]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save document',exact:true}).click()]);await doc.saveAs('/tmp/canvas2d-1054-document.json');await stage('physical Save');
 const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.locator('#open').click()]);await chooser.setFiles('/tmp/canvas2d-1054-document.json');await page.waitForFunction(()=>window.nestedMaskFixture.observe().opened!==null);
 o=await stage('chooser Open fresh canvas');assert(o.opened.bytesEqualPrevious&&o.opened.commandsEqualPrevious,'asset/mask equality');assert(await page.evaluate(()=>window.__oldNestedCanvas!==window.nestedMaskFixture.canvas),'fresh canvas');assert(JSON.stringify(o.accepted.samples)===JSON.stringify(before.accepted.samples),'fresh pixels/hits');assert(Object.values(o.accepted.assetBytes).reduce((s,a)=>s+a.length,0)===448,'all atlas bytes');
 await page.evaluate(()=>window.__oldNestedCanvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:100,clientY:100,pointerId:1})));assert((await get()).counts.pointerEvents===6,'old canvas unbound');
 await click('Remove inner');o=await click('Restore inner');assert(JSON.stringify(o.accepted.samples)===JSON.stringify(initial.accepted.samples),'restored handle edit');
 const [png]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export PNG',exact:true}).click()]);await png.saveAs('/tmp/canvas2d-1054.png');await stage('physical PNG');
 await page.evaluate(report=>window.__nestedReport=report,{observations,console:errors}); return {stages:observations.map(x=>x.name),saved:(await get()).saved,png:(await get()).png};
}
