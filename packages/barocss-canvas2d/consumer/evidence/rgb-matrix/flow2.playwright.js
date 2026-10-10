async(page)=>{
 const ensure=(v,m)=>{if(!v)throw new Error(m);};
 const record=async name=>{const o=await page.evaluate(()=>window.rgbMatrixFixture.observe());for(const [k,s]of Object.entries(o.accepted.samples))ensure(s.withinTwo!==false,`${name}:${k} oracle`);await page.evaluate(([name,o])=>window.rgb1109Evidence.push({name,observation:o}),[name,o]);return o;};
 await page.waitForFunction(()=>window.rgbMatrixFixture.observe().opened!==null);
 const opened=await record('physical-open'),prior=await page.evaluate(()=>window.rgb1109BeforeOpen);ensure(opened.counts.rendererCreated===2,'exactlyonefresh renderer');ensure(Object.values(opened.opened).every(v=>v===true),'allmatrices IDs bytes');
 ensure(await page.evaluate(()=>window.rgbMatrixFixture.canvas!==window.rgb1109OldCanvas&&!window.rgb1109OldCanvas.isConnected),'freshcanvas');ensure(JSON.stringify(opened.accepted.samples)===JSON.stringify(prior.accepted.samples),'allcoldpixels/hits');
 await page.click('#gray');await record('restored-gray');await page.click('#clear');await record('restored-clear');await page.click('#reapply');const edit=await record('restored-reapply');
 const point=edit.accepted.points.Swap_opaque,rect=await page.evaluate(()=>{const r=window.rgbMatrixFixture.canvas.getBoundingClientRect();return{x:r.x,y:r.y};});await page.mouse.click(rect.x+point.x,rect.y+point.y);const pointer=await record('restored-realpointer');ensure(pointer.counts.pointerEvents===7,'restoredpointer');
 const dlPromise=page.waitForEvent('download');await page.click('#png');const dl=await dlPromise;await dl.saveAs('/tmp/c2d1109.png');const exported=await record('physical-png');ensure(exported.png.width===640&&exported.png.height===480,'PNGsize');
 await page.evaluate(()=>{window.rgb1109PNGExpected=window.rgbMatrixFixture.observe().accepted;});
 await page.screenshot({path:'/tmp/c2d1109-screen.png'});
 return {opened:opened.opened,renderers:opened.counts.rendererCreated,pointer:pointer.counts.pointerEvents,png:exported.png,stages:6};
}
