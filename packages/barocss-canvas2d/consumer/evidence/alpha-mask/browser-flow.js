async page => {
const dir='/Users/user/.codex/worktrees/canvas2d-alpha-mask/barocss/packages/barocss-canvas2d/consumer/evidence/alpha-mask/';
const pointer=async names=>{const o=await page.evaluate(()=>rgbMatrixFixture.observe()),b=await page.locator('#scene').boundingBox();for(const name of names){const p=o.accepted.points[name];await page.mouse.click(b.x+p.x,b.y+p.y)}};
if(!await page.evaluate(()=>!!window.__alphaSaved)){
 await page.waitForFunction(()=>!!window.rgbMatrixFixture?.observe().accepted);
 await page.evaluate(()=>{window.__alphaStages=[];window.__recordAlpha=name=>{const o=rgbMatrixFixture.observe();__alphaStages.push({name,observation:o});return o};window.__assertAlpha=name=>{const o=__recordAlpha(name),s=o.accepted;if(s.version!==29||!s.sceneMatchesTree)throw Error('currentScene29');const interior=Object.entries(s.samples).filter(([key])=>!['maskedTile','Nine_opaque','Nine_transparent'].includes(key));for(const [key,v] of interior)if('withinTwo'in v&&!v.withinTwo)throw Error('fixed2byteoracle '+name+' '+key+' actual'+v.rgba+' expected'+v.oracle);if(s.samples.glyphOpaque.hit!=='Glyph'||JSON.stringify(s.samples.glyphOpaque.rgba)!=='[255,180,60,255]'||s.samples.Plain_opaque.hit!=='Plain')throw Error('following image/glyph reset');return o;};__assertAlpha('defaultScene29');});
 await pointer(['Swap_opaque']);
 await page.getByRole('button',{name:'Mask by green',exact:true}).click();
 await page.evaluate(()=>{const o=__assertAlpha('allGridGreenMask'),s=o.accepted;if(s.samples.Swap_opaque.hit!=='Back'||JSON.stringify(s.samples.Swap_opaque.rgba)!=='[32,64,96,255]'||s.samples.Swap_partial.hit!=='Swap'||s.samples.Swap_transparent.hit!=='Back'||s.alphaMasks.Plain!==null)throw Error('green alpha hit/sourcealpha/reset');});
 await pointer(['Swap_opaque','Swap_partial','Swap_transparent','Linear_filtered']);
 await page.getByRole('button',{name:'Edit Swap to gray',exact:true}).click();
 await page.evaluate(()=>{const o=__assertAlpha('RGBGrayIndependentOriginalMask');if(o.accepted.samples.Swap_opaque.hit!=='Back')throw Error('mask incorrectly uses styled RGB')});
 await page.getByRole('button',{name:'Reapply swap',exact:true}).click();
 for(const mode of ['normal','add','screen'])await page.evaluate(mode=>{rgbMatrixFixture.applyAlpha([0,1,0,0],mode);__assertAlpha('green-'+mode)},mode);
 await page.evaluate(()=>{rgbMatrixFixture.applyAlpha([0,0,0,1],'normal');const o=__assertAlpha('positiveBiasOriginalAlphaZero');if(o.accepted.samples.Swap_transparent.hit!=='Back')throw Error('bias alpha0');});
 await page.getByRole('button',{name:'Mask by average RGB',exact:true}).click();await page.evaluate(()=>__assertAlpha('allGridGrayMask'));
 await page.getByRole('button',{name:'Clear alpha masks',exact:true}).click();await page.evaluate(()=>{const o=__assertAlpha('clearedIdentityMask');if(Object.values(o.accepted.alphaMasks).some(v=>v!==null))throw Error('mask clear');});
 await page.getByRole('button',{name:'Mask by green',exact:true}).click();await page.evaluate(()=>__assertAlpha('acceptedGreenForSave'));
 await page.evaluate(async()=>{const before=await rgbMatrixFixture.documentText(),writeBefore=__alphaTaps.reduce((s,r)=>s+r.writes,0),results=[];let getters=0;
 const values=[undefined,[],[1,2,3],[1,2,3,4,5],[5,0,0,0],[0,0,0,2],[NaN,0,0,0]];
 const accessor=[0,1,0,0];Object.defineProperty(accessor,'1',{enumerable:true,get(){getters++;throw Error('getter')}});values.push(accessor);
 for(const value of values){const r=rgbMatrixFixture.invalidAlpha(value);if(r.code!=='INVALID_SCENE'||!r.retained)throw Error('actualinvalid retention');results.push(r)}
 if(getters||__alphaTaps.reduce((s,r)=>s+r.writes,0)!==writeBefore||before!==await rgbMatrixFixture.documentText())throw Error('getter/serializedretention');window.__alphaRefusals={results,getters,uploadDelta:0,serializedEqual:true};__recordAlpha('invalidMaskTupleGetterRetained');
 const {createCanvas2D}=await import('@barocss/canvas2d');const c=document.createElement('canvas'),gl=c.getContext('webgl2');const proxy=new Proxy(gl,{get(t,k){if(k==='getParameter')return p=>p===t.MAX_FRAGMENT_UNIFORM_VECTORS?127:t.getParameter(p);const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v}});c.getContext=()=>proxy;let code;try{createCanvas2D(c,{logicalSize:{width:320,height:240},dpr:2})}catch(e){code=e.code}const last=__alphaTaps.at(-1);if(code!=='UNSUPPORTED_FEATURE'||Object.values(last.created).some(v=>v)||last.writes)throw Error('reported127 beforeallocation');window.__reported127={code,actualCapacity:last.capacity,reported:127,created:last.created,writes:last.writes,physical127:false};
 const {parseCanvasDocument}=await import('@barocss/canvas2d/document'),{createDisplayTreeFromScene}=await import('@barocss/canvas2d');const text=await(await fetch('evidence/rgb-matrix/saved-document.json')).text(),old=await parseCanvasDocument(text),t=createDisplayTreeFromScene(old.scene);
 if(old.scene.version!==27||t.snapshot().version!==29||old.assets.size!==2||[...old.assets.values()].reduce((a,v)=>a+v.pixels.length,0)!==44||t.get('Swap').data.alphaMask!==undefined)throw Error('old27 compatibility');window.__old27={byteLength:new TextEncoder().encode(text).length,oldVersion:27,currentSnapshot:29,assetBytes:Object.fromEntries([...old.assets].map(([id,a])=>[id,[...a.pixels]])),maskAbsent:true,physicalChooser:false};});
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Save document',exact:true}).click();const d=await wait;await d.saveAs(dir+'saved-document.json');
 await page.evaluate(()=>{window.__alphaSaved=rgbMatrixFixture.observe();window.__beforeAlphaCanvas=rgbMatrixFixture.canvas;__recordAlpha('actualScene29Save');});
}else if(!await page.evaluate(()=>!!window.__alphaPNG)){
 await page.waitForFunction(()=>rgbMatrixFixture.observe().opened?.alphaMasksEqualPrevious===true);
 await page.evaluate(()=>{const o=__assertAlpha('physicalChooserOneUploadFresh29');if(rgbMatrixFixture.canvas===__beforeAlphaCanvas||Object.values(o.opened).some(v=>v!==true)||JSON.stringify(o.accepted.samples)!==JSON.stringify(__alphaSaved.accepted.samples)||o.accepted.contextId!==__alphaSaved.accepted.contextId||JSON.stringify(o.accepted.assetBytes)!==JSON.stringify(__alphaSaved.accepted.assetBytes))throw Error('fresh Open exactpixels masks bytes context');});
 await pointer(['Swap_opaque','Swap_partial']);
 await page.getByRole('button',{name:'Clear alpha masks',exact:true}).click();await page.evaluate(()=>__assertAlpha('restoredPublicSetAlphaMaskNull'));
 await page.getByRole('button',{name:'Mask by green',exact:true}).click();await page.evaluate(()=>__assertAlpha('restoredPublicGreenReapply'));
 await pointer(['Swap_opaque','Swap_partial']);
 await page.getByRole('button',{name:'Lose context',exact:true}).click();await page.waitForFunction(()=>rgbMatrixFixture.observe().accepted?.contextLost);
 await page.evaluate(()=>__recordAlpha('actualContextLost'));
 await page.getByRole('button',{name:'Restore context',exact:true}).click();await page.waitForFunction(()=>rgbMatrixFixture.observe().counts.contextRestores===1&&!rgbMatrixFixture.observe().accepted.contextLost);
 await page.evaluate(()=>{const o=__assertAlpha('actualContextRestoreReapplied');if(JSON.stringify(o.accepted.samples)!==JSON.stringify(__alphaSaved.accepted.samples))throw Error('restored masks pixels/hits')});
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();const d=await wait;await d.saveAs(dir+'exported.png');await page.evaluate(()=>{window.__alphaPNG=true;__recordAlpha('actualPNGDownload')});
}else{
 await page.evaluate(async()=>{const blob=await(await fetch('evidence/alpha-mask/exported.png')).blob(),bitmap=await createImageBitmap(blob),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);const o=rgbMatrixFixture.observe(),samples={};for(const [name,p]of Object.entries(o.accepted.points)){const actual=[...ctx.getImageData(Math.floor(p.x*2),Math.floor(p.y*2),1,1).data],expected=o.accepted.samples[name].rgba;if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('exact PNG '+name);samples[name]={actual,expected}}
 bitmap.close();window.__alphaDecoded={bytes:blob.size,width:c.width,height:c.height,samples,bitmapClosed:true};c.width=0;c.height=0;__recordAlpha('PNGAllSamplesBrowserDecode');});
 await page.screenshot({path:dir+'screenshot.png'});
 const box=await page.locator('#scene').boundingBox(),before=await page.evaluate(()=>rgbMatrixFixture.observe().counts.pointerEvents);
 await page.getByRole('button',{name:'Dispose',exact:true}).click();await page.mouse.click(box.x+120,box.y+30);
 await page.evaluate(before=>{const o=__recordAlpha('DisposeLatePhysicalPointer');if(o.counts.liveRenderers||o.counts.rendererCreated!==o.counts.rendererDisposed||o.counts.binds!==o.counts.unbinds||o.counts.pointerEvents!==before)throw Error('ownedlifetime');for(const r of o.resources){if(Object.values(r.categories).some(x=>x.nativeLive))throw Error('nativeGPUlive');if(!r.everLost&&Object.values(r.categories).some(x=>x.created!==x.deleteRequested))throw Error('explicitGPUdelete');}
 const gl=rgbMatrixFixture.canvas.getContext('webgl2'),blend={srcRGB:gl.getParameter(gl.BLEND_SRC_RGB),dstRGB:gl.getParameter(gl.BLEND_DST_RGB),srcAlpha:gl.getParameter(gl.BLEND_SRC_ALPHA),dstAlpha:gl.getParameter(gl.BLEND_DST_ALPHA),error:gl.getError(),capacity:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)};if(blend.error||blend.srcRGB!==gl.ONE||blend.dstRGB!==gl.ONE_MINUS_SRC_ALPHA||blend.srcAlpha!==gl.ONE||blend.dstAlpha!==gl.ONE_MINUS_SRC_ALPHA)throw Error('blendstate');
 window.__alphaProof={fixtureRepair:window.__alphaRepair??null,taps:__alphaTaps.map(r=>({created:r.created,deleted:r.deleted,live:r.live(),writes:r.writes,error:r.error(),capacity:r.capacity})),reported127:__reported127,runtime:navigator.userAgent,stages:__alphaStages,refusals:__alphaRefusals,old27:__old27,pngDecoded:__alphaDecoded,resources:o.resources,console:__alphaConsole,pointerBefore:before,pointerAfter:o.counts.pointerEvents,finalCounts:o.counts,blend};},before);
}
}
