async (page)=>{
 const ensure=(v,m)=>{if(!v)throw new Error(m);};
 const record=async name=>{const o=await page.evaluate(()=>window.rgbMatrixFixture.observe());for(const [k,s]of Object.entries(o.accepted.samples))ensure(s.withinTwo!==false,`${name}:${k} oracle`);await page.evaluate(([name,o])=>{window.rgb1109Evidence.push({name,observation:o});},[name,o]);return o;};
 await page.evaluate(()=>{window.rgb1109Evidence=[];window.rgb1109Errors=[];});
 page.on('pageerror',e=>page.evaluate(m=>window.rgb1109Errors.push(m),e.message));
 const initial=await record('initial');ensure(initial.accepted.version===27,'v27');ensure(initial.accepted.ids.length===15,'15IDs');ensure(JSON.stringify(initial.accepted.samples.TintSwap_opaque.rgba)==='[0,0,128,255]','tint order');ensure(initial.accepted.samples.maskedTile.hit==='Back','two masks');
 const points=initial.accepted.points,rect=await page.evaluate(()=>{const r=window.rgbMatrixFixture.canvas.getBoundingClientRect();return{x:r.x,y:r.y};});
 for(const key of ['Identity_opaque','TintSwap_opaque','Bias_transparent','Plain_opaque','glyphOpaque','maskedTile'])await page.mouse.click(rect.x+points[key].x,rect.y+points[key].y);
 const pointer=await record('real-pointer');ensure(pointer.counts.pointerEvents===6,'6physicalpointers');
 await page.click('#gray');const gray=await record('gray-edit');ensure(JSON.stringify(gray.accepted.samples.Swap_opaque.rgba)==='[85,85,85,255]','gray');
 await page.click('#clear');const clear=await record('clear');ensure(clear.accepted.matrices.Swap===null,'clear field');ensure(JSON.stringify(clear.accepted.samples.Swap_opaque.rgba)==='[255,0,0,255]','identity after clear');
 await page.click('#reapply');await record('reapply');await page.click('#invalid');const invalid=await record('invalid-retained');ensure(invalid.failure.code==='INVALID_SCENE'&&invalid.failure.retained,'invalid rollback');
 await page.evaluate(()=>{window.rgb1109BeforeOpen=window.rgbMatrixFixture.observe();window.rgb1109OldCanvas=window.rgbMatrixFixture.canvas;});
 const promise=page.waitForEvent('download');await page.click('#save');const download=await promise;await download.saveAs('/tmp/c2d1109-document.json');await record('physical-save');
 return {stages:7,pointerEvents:pointer.counts.pointerEvents,download:'/tmp/c2d1109-document.json',samples:35,oracleSamples:Object.values(initial.accepted.samples).filter(s=>s.withinTwo!==undefined).length};
}
