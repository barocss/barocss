async page => {
const evidence='/Users/user/.codex/worktrees/canvas2d-multiline-1186/barocss/packages/barocss-canvas2d/consumer/evidence/multiline-text/';
if(!await page.evaluate(()=>!!window.__beforeOpen)){
 await page.waitForFunction(()=>browserTextConsumer.observe().accepted?.text==='Canvas2D');
 await page.evaluate(()=>{window.__stages=[];window.__record=name=>{const o=browserTextConsumer.observe();if(o.accepted)o.accepted={...o.accepted,allBytes:undefined};__stages.push({name,observation:o});return o};__record('defaultSingleLineScene28');});
 await page.getByRole('button',{name:'Balance / -$20',exact:true}).click();
 await page.waitForFunction(()=>browserTextConsumer.observe().accepted?.text==='Balance\n-$20');
 await page.evaluate(()=>{const o=__record('multilineOriginal');
 if(o.accepted.version!==28||o.accepted.layout.glyphs.length!==1||o.accepted.layout.glyphs[0].textEnd!==12||o.accepted.lineAdvance!==40||o.accepted.lines[1].baseline!==40)throw Error('original identity/layout');
 for(const name of ['line1','line2'])if(o.accepted.samples[name]?.hit!=='Label'||JSON.stringify(o.accepted.samples[name].rgba)!=='[255,255,255,255]')throw Error('line interior');
 if(o.accepted.samples.interline?.hit!=='Back'||JSON.stringify(o.accepted.samples.interline.rgba)!=='[32,40,56,255]')throw Error('interline alpha hit');});
 let o=await page.evaluate(()=>browserTextConsumer.observe()),box=await page.locator('#scene').boundingBox();
 for(const name of ['line1','line2','interline']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 await page.evaluate(async()=>{
 const {rasterizeBrowserMultilineText:multi,rasterizeBrowserText:single}=await import('@barocss/canvas2d');
 const base={text:'Balance\n-$20',font:'24px monospace',atlasId:'BrowserTextAtlas',lineAdvance:40,dpr:2};
 const before=__gpuProof.scratch2D;let getters=0;const results=[];
 const options=[{...base,text:'A\n\nB'},{...base,text:'A\r\nB'},{...base,text:'A\tB'},{...base,text:'A\n한글'},{...base,text:'A\n '},{...base,lineAdvance:0},{...base,lineAdvance:Infinity},{...base,textPolicy:'printable-ascii'}];
 const accessor={...base};Object.defineProperty(accessor,'lineAdvance',{enumerable:true,get(){getters++;throw Error('getter')}});options.push(accessor);
 for(const v of options){const r=browserTextConsumer.rejectMultiline(v);if(r.code!=='INVALID_SCENE'||!r.retained||!r.candidatesUnchanged)throw Error('before scratch refusal');results.push(r)}
 if(getters||__gpuProof.scratch2D!==before)throw Error('getter/scratch');window.__earlyRefusals={results,getters,scratchDelta:0};
 const later=[{...base,font:'not a font'},{...base,lineAdvance:200},{...base,font:'1000px monospace'}];
 for(const [i,v]of later.entries()){const start=__gpuProof.scratchCanvases.length,draw=__gpuProof.draws;const r=browserTextConsumer.rejectMultiline(v);
 if(r.code!==(i===0?'INVALID_SCENE':'ASSET_LIMIT')||!r.retained||!r.candidatesUnchanged||__gpuProof.draws!==draw)throw Error('font/oversize retention');
 const owned=__gpuProof.scratchCanvases.slice(start);if(owned.length!==1||owned.some(c=>c.width||c.height))throw Error('refused scratch cleanup');results.push({...r,scratchReleased:true,drawDelta:0})}
 const direct=[];
 for(const v of [{...base,text:'A',dpr:1.5},{...base,text:'A\nB\nC\nD',lineAdvance:16,dpr:1.5},{...base,text:'A\nB',lineAdvance:0.5,dpr:1.5}]){
 const start=__gpuProof.scratchCanvases.length;const r=multi(v);if(r.layout.text!==v.text||r.layout.glyphs.length!==1||r.lines.length!==v.text.split('\n').length||__gpuProof.scratchCanvases[start].width||__gpuProof.scratchCanvases[start].height)throw Error('direct multiline');
 direct.push({text:v.text,width:r.asset.width,height:r.asset.height,bytes:r.asset.pixels.length,bounds:r.bounds,lines:r.lines,lineAdvance:r.lineAdvance,original:true,scratchReleased:true});
 if(v.text==='A'){const old=single({text:'A',font:v.font,atlasId:v.atlasId,dpr:v.dpr,textPolicy:'printable-ascii'});
 if(JSON.stringify(r.asset)!==JSON.stringify(old.asset)||JSON.stringify(r.layout)!==JSON.stringify(old.layout)||JSON.stringify(r.bounds)!==JSON.stringify(old.bounds)||r.advance!==old.advance)throw Error('one line raster compatibility');direct[0].singleLineEqual=true;}
 }
 window.__direct=direct;__record('invalidOptionsFontOversizeAndDirectPreparation');
 });
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Save document',exact:true}).click();const d=await wait;await d.saveAs(evidence+'saved-document.json');
 await page.evaluate(()=>{window.__beforeOpen=browserTextConsumer.observe();window.__beforeCanvas=browserTextConsumer.canvas;window.__beforeFont={helper:__beforeOpen.counts.helperCalls,font:__beforeOpen.counts.fontPreparations,scratch:__gpuProof.scratch2D};__record('actualOriginalSave');});
}else if(!await page.evaluate(()=>!!window.__pngReady)){
 await page.waitForFunction(()=>browserTextConsumer.observe().opened?.helperCallsUnchanged);
 await page.evaluate(()=>{const o=browserTextConsumer.observe();if(browserTextConsumer.canvas===__beforeCanvas||o.accepted.text!=='Balance\n-$20'||Object.values(o.opened).some(v=>v!==true)||JSON.stringify(o.accepted.allBytes)!==JSON.stringify(__beforeOpen.accepted.allBytes)||o.counts.helperCalls!==__beforeFont.helper||o.counts.fontPreparations!==__beforeFont.font||__gpuProof.scratch2D!==__beforeFont.scratch)throw Error('cold fresh Open');__record('physicalChooserOneUploadFreshOpen');});
 let o=await page.evaluate(()=>browserTextConsumer.observe()),box=await page.locator('#scene').boundingBox();for(const name of ['line1','line2','interline']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 await page.getByRole('button',{name:'Edit restored label',exact:true}).click();await page.waitForFunction(()=>browserTextConsumer.observe().accepted?.text==='Balance\n-$25');
 await page.evaluate(()=>{const o=__record('restoredSecondLinePublicHelperSetLayout');if(o.accepted.layout.glyphs.length!==1||!o.accepted.sceneMatchesTree||o.accepted.samples.line2.hit!=='Label'||o.accepted.samples.interline.hit!=='Back'||JSON.stringify(o.accepted.ids)!==JSON.stringify(__beforeOpen.accepted.ids)||o.accepted.contextId!==__beforeOpen.accepted.contextId)throw Error('restored edit');});
 o=await page.evaluate(()=>browserTextConsumer.observe());box=await page.locator('#scene').boundingBox();for(const name of ['line1','line2','interline']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();const d=await wait;await d.saveAs(evidence+'exported.png');await page.evaluate(()=>{window.__pngReady=true;__record('actualPNGDownload')});
}else{
 await page.evaluate(async()=>{const blob=await(await fetch('evidence/multiline-text/exported.png')).blob(),bitmap=await createImageBitmap(blob),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);const o=browserTextConsumer.observe(),samples={};
 for(const name of ['line1','line2','interline','background']){const p=o.accepted.points[name],actual=[...ctx.getImageData(Math.floor(p.x*2),Math.floor(p.y*2),1,1).data],expected=o.accepted.samples[name].rgba;if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('PNG decode');samples[name]={actual,expected};}
 bitmap.close();window.__pngDecoded={bytes:blob.size,width:c.width,height:c.height,samples,bitmapClosed:true};c.width=0;c.height=0;__record('PNGIndependentBrowserDecode');});
 await page.screenshot({path:evidence+'screenshot.png'});
 const box=await page.locator('#scene').boundingBox(),pointerBefore=await page.evaluate(()=>browserTextConsumer.observe().counts.pointerEvents);await page.getByRole('button',{name:'Dispose',exact:true}).click();await page.mouse.click(box.x+45,box.y+60);
 await page.evaluate(pointerBefore=>{const o=__record('DisposeLatePhysicalPointer');if(o.counts.rendererCreated!==o.counts.rendererDisposed||o.counts.liveRenderers||o.counts.binds!==o.counts.unbinds||o.counts.pointerEvents!==pointerBefore)throw Error('display lifetime');
 const resources=__gpuProof.contexts.map(r=>({created:r.created,deleted:r.deleted,live:r.live(),error:r.error(),capacity:r.capacity}));for(const r of resources)if(r.error||Object.values(r.live).some(v=>v)||Object.entries(r.created).some(([k,v])=>v!==r.deleted[k]))throw Error('GPU lifetime');
 window.__proof={runtime:navigator.userAgent,stages:__stages,earlyRefusals:__earlyRefusals,direct:__direct,pngDecoded:__pngDecoded,resources,errors:__gpuProof.errors,warnings:__gpuProof.warnings,pointerBefore,pointerAfter:o.counts.pointerEvents};
 const old=__beforeOpen.accepted,now=browserTextConsumer.observe().accepted;
 const cut=Math.floor((20-old.layout.glyphs[0].y)*2),prefix=cut*old.atlas.width*4;
 const firstLineEqual=old.allBytes.slice(0,prefix).every((v,i)=>v===now.allBytes[i]);
 const changedSecondLine=old.allBytes.slice(prefix).filter((v,i)=>v!==now.allBytes[prefix+i]).length;
 if(!firstLineEqual||!changedSecondLine)throw Error('second line edit bytes');
 const gl=browserTextConsumer.canvas.getContext('webgl2'),blend={srcRGB:gl.getParameter(gl.BLEND_SRC_RGB),dstRGB:gl.getParameter(gl.BLEND_DST_RGB),srcAlpha:gl.getParameter(gl.BLEND_SRC_ALPHA),dstAlpha:gl.getParameter(gl.BLEND_DST_ALPHA),error:gl.getError()};
 if(blend.srcRGB!==gl.ONE||blend.dstRGB!==gl.ONE_MINUS_SRC_ALPHA||blend.srcAlpha!==gl.ONE||blend.dstAlpha!==gl.ONE_MINUS_SRC_ALPHA||blend.error)throw Error('GL blend state');
 __proof.restoredEdit={originalText:old.text,newText:now.text,firstLineEqual,firstLineBytes:prefix,changedSecondLineBytes:changedSecondLine,layoutIDsContextEqual:true,blend};},pointerBefore);
}
}
