async page => {
const evidence='/Users/user/.codex/worktrees/canvas2d-wrap-native/barocss/packages/barocss-canvas2d/consumer/evidence/wrapped-text/';
if(!await page.evaluate(()=>!!window.__beforeOpen)){
 await page.waitForFunction(()=>browserTextConsumer.observe().accepted?.text==='Canvas2D');
 await page.evaluate(()=>{window.__stages=[];window.__record=name=>{const o=browserTextConsumer.observe();if(o.accepted)o.accepted={...o.accepted,allBytes:undefined};__stages.push({name,observation:o});return o};__record('defaultSingleLine');});
 await page.getByRole('button',{name:'Wrap paragraph',exact:true}).click();
 await page.waitForFunction(()=>browserTextConsumer.observe().accepted?.maxWidth===160);
 await page.evaluate(async()=>{
 const api=await import('@barocss/canvas2d'),parent=await import('/dist/wrap-parent.js');
 const basic={text:'A',font:'24px monospace',atlasId:'BrowserTextAtlas',dpr:1.5};
 if(JSON.stringify(api.rasterizeBrowserText(basic))!==JSON.stringify(parent.rasterizeBrowserText(basic)))throw Error('single parent compatibility');
 const explicit={...basic,text:'Balance\n-$20',lineAdvance:40,lineAlign:'center'};
 if(JSON.stringify(api.rasterizeBrowserMultilineText(explicit))!==JSON.stringify(parent.rasterizeBrowserMultilineText(explicit)))throw Error('multiline parent compatibility');
 window.__oldAPIEqual={single:true,multiline:true,parent:'bfd13fee',scope:'fixed labels only'};
 window.__wrapChecks=[];window.__checkWrap=(result,width,texts,ranges,align='left')=>{
  const c=document.createElement('canvas'),ctx=c.getContext('2d',{willReadFrequently:true});ctx.font='24px monospace';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.direction='ltr';ctx.fontKerning='auto';if('letterSpacing'in ctx)ctx.letterSpacing='0px';if('wordSpacing'in ctx)ctx.wordSpacing='0px';
  const metrics=texts.map(t=>ctx.measureText(t)),offsets=metrics.map(m=>align==='left'?0:(width-m.width)/(align==='center'?2:1));
  const left=Math.floor(Math.min(...metrics.map((m,i)=>offsets[i]-m.actualBoundingBoxLeft)))-2,right=Math.ceil(Math.max(...metrics.map((m,i)=>offsets[i]+m.actualBoundingBoxRight)))+2,top=Math.floor(Math.min(...metrics.map((m,i)=>i*30-m.actualBoundingBoxAscent)))-2,bottom=Math.ceil(Math.max(...metrics.map((m,i)=>i*30+m.actualBoundingBoxDescent)))+2;
  c.width=Math.ceil((right-left)*2);c.height=Math.ceil((bottom-top)*2);ctx.font='24px monospace';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.direction='ltr';ctx.fillStyle='#fff';ctx.fontKerning='auto';if('letterSpacing'in ctx)ctx.letterSpacing='0px';if('wordSpacing'in ctx)ctx.wordSpacing='0px';ctx.scale(2,2);texts.forEach((t,i)=>ctx.fillText(t,offsets[i]-left,i*30-top));
  const bytes=ctx.getImageData(0,0,c.width,c.height).data;
  if(result.asset.width!==c.width||result.asset.height!==c.height||!bytes.every((v,i)=>v===result.asset.pixels[i])||result.layout.text!=='Canvas2D labels fit this panel'||result.layout.glyphs.length!==1||result.layout.glyphs[0].textEnd!==30||result.maxWidth!==width||result.lines.length!==texts.length)throw Error('wrapped independent pixels/text/shape');
  for(let i=0;i<texts.length;i++)if(result.lines[i].textStart!==ranges[i][0]||result.lines[i].textEnd!==ranges[i][1]||result.lines[i].baseline!==i*30||result.lines[i].advance!==metrics[i].width||metrics[i].width>width)throw Error('original ranges and advances');
  __wrapChecks.push({width,align,texts,ranges,advances:metrics.map(m=>m.width),offsets,atlas:{width:c.width,height:c.height,bytes:bytes.length},fullRGBAEqual:true,originalText:true});c.width=0;c.height=0;
 };
 const base={text:'Canvas2D labels fit this panel',font:'24px monospace',atlasId:'BrowserTextAtlas',lineAdvance:30,maxWidth:160,dpr:2};
 const r=api.rasterizeBrowserWrappedText(base),o=browserTextConsumer.observe();
 __checkWrap(r,160,['Canvas2D','labels fit','this panel'],[[0,8],[9,19],[20,30]]);
 if(JSON.stringify(r.asset.pixels)!==JSON.stringify(new Uint8Array(o.accepted.allBytes)))throw Error('host helper bytes');
 __checkWrap(api.rasterizeBrowserWrappedText({...base,lineAlign:'center'}),160,['Canvas2D','labels fit','this panel'],[[0,8],[9,19],[20,30]],'center');
 for(const name of ['line1','line2','line3'])if(o.accepted.samples[name]?.hit!=='Label'||JSON.stringify(o.accepted.samples[name].rgba)!=='[255,255,255,255]')throw Error('three line interiors');
 if(o.accepted.samples.interline.hit!=='Back'||JSON.stringify(o.accepted.samples.interline.rgba)!=='[32,40,56,255]')throw Error('wrapped interline');
 __record('wrapped160ThreeLines');
 });
 let o=await page.evaluate(()=>browserTextConsumer.observe()),box=await page.locator('#scene').boundingBox();
 for(const name of ['line1','line2','line3','interline']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 await page.evaluate(async()=>{
 const base={text:'Canvas2D labels fit this panel',font:'24px monospace',atlasId:'BrowserTextAtlas',lineAdvance:30,maxWidth:160,dpr:2};
 const before=__gpuProof.scratch2D,doc=await browserTextConsumer.documentText(),results=[];let getters=0;
 const invalid=[undefined,null,0,-1,NaN,Infinity,'160'].map(maxWidth=>({...base,maxWidth}));
 for(const text of [' A','A ','A  B','A\nB','한글'])invalid.push({...base,text});
 const v={...base};Object.defineProperty(v,'maxWidth',{enumerable:true,get(){getters++;throw Error('getter')}});invalid.push(v);
 for(const opts of invalid){const r=browserTextConsumer.rejectWrapped(opts);if(r.code!=='INVALID_SCENE'||!r.retained||!r.candidatesUnchanged)throw Error('wrapped early refusal');results.push(r)}
 if(getters||__gpuProof.scratch2D!==before)throw Error('early scratch/getter');window.__early={count:invalid.length,getters,scratchDelta:0,results:[...results]};
 for(const opts of [{...base,maxWidth:10},{...base,text:'A B C D E',maxWidth:15},{...base,font:'1000px monospace',maxWidth:1e6},{...base,lineAdvance:200}]){
  const scratch=__gpuProof.scratchCanvases.length,draw=__gpuProof.draws,r=browserTextConsumer.rejectWrapped(opts);const owned=__gpuProof.scratchCanvases.slice(scratch);
  if(r.code!=='ASSET_LIMIT'||!r.retained||!r.candidatesUnchanged||draw!==__gpuProof.draws||owned.length!==1||owned[0].width||owned[0].height)throw Error('wrapped limit cleanup/retention');results.push({...r,scratchReleased:true,drawDelta:0});
 }
 if(doc!==await browserTextConsumer.documentText())throw Error('serialized document retention');window.__refusals={results,serializedEqual:true,historyAPI:false};__record('InvalidLongWordFiveLinesRasterHeightRetention');
 });
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Save document',exact:true}).click();const d=await wait;await d.saveAs(evidence+'saved-document.json');
 await page.evaluate(()=>{window.__beforeOpen=browserTextConsumer.observe();window.__beforeCanvas=browserTextConsumer.canvas;window.__beforeFont={helper:__beforeOpen.counts.helperCalls,font:__beforeOpen.counts.fontPreparations,scratch:__gpuProof.scratch2D};__record('actualOriginalParagraphSave');});
}else if(!await page.evaluate(()=>!!window.__pngReady)){
 await page.waitForFunction(()=>browserTextConsumer.observe().opened?.helperCallsUnchanged);
 await page.evaluate(()=>{const o=browserTextConsumer.observe();if(browserTextConsumer.canvas===__beforeCanvas||o.accepted.text!=='Canvas2D labels fit this panel'||Object.values(o.opened).some(v=>v!==true)||JSON.stringify(o.accepted.allBytes)!==JSON.stringify(__beforeOpen.accepted.allBytes)||o.counts.helperCalls!==__beforeFont.helper||o.counts.fontPreparations!==__beforeFont.font||__gpuProof.scratch2D!==__beforeFont.scratch||o.accepted.maxWidth!==null)throw Error('cold fresh paragraph Open');__record('physicalChooserOneUploadFreshOpen');});
 let o=await page.evaluate(()=>browserTextConsumer.observe()),box=await page.locator('#scene').boundingBox();for(const name of ['line1','line2','line3','interline']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 await page.getByRole('button',{name:'Refit restored paragraph',exact:true}).click();await page.waitForFunction(()=>browserTextConsumer.observe().accepted?.maxWidth===220);
 await page.evaluate(async()=>{const api=await import('@barocss/canvas2d'),r=api.rasterizeBrowserWrappedText({text:'Canvas2D labels fit this panel',font:'24px monospace',atlasId:'BrowserTextAtlas',lineAdvance:30,maxWidth:220,dpr:2});__checkWrap(r,220,['Canvas2D labels','fit this panel'],[[0,15],[16,30]]);
 const o=browserTextConsumer.observe();__record('restoredPublicHelperSetLayoutWidth220');if(o.accepted.text!==__beforeOpen.accepted.text||o.accepted.lines.length!==2||JSON.stringify(o.accepted.ids)!==JSON.stringify(__beforeOpen.accepted.ids)||o.accepted.contextId!==__beforeOpen.accepted.contextId||!o.accepted.sceneMatchesTree||JSON.stringify(r.asset.pixels)!==JSON.stringify(new Uint8Array(o.accepted.allBytes)))throw Error('restored original reflow');});
 o=await page.evaluate(()=>browserTextConsumer.observe());box=await page.locator('#scene').boundingBox();for(const name of ['line1','line2','interline']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();const d=await wait;await d.saveAs(evidence+'exported.png');await page.evaluate(()=>{window.__pngReady=true;__record('actualPNGDownload')});
}else{
 await page.evaluate(async()=>{const blob=await(await fetch('evidence/wrapped-text/exported.png')).blob(),bitmap=await createImageBitmap(blob),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);const o=browserTextConsumer.observe(),samples={};
 for(const name of ['line1','line2','interline','background']){const p=o.accepted.points[name],actual=[...ctx.getImageData(Math.floor(p.x*2),Math.floor(p.y*2),1,1).data],expected=o.accepted.samples[name].rgba;if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('PNG decode');samples[name]={actual,expected};}
 bitmap.close();window.__pngDecoded={bytes:blob.size,width:c.width,height:c.height,samples,bitmapClosed:true};c.width=0;c.height=0;__record('PNGIndependentBrowserDecode');});
 await page.screenshot({path:evidence+'screenshot.png'});
 const box=await page.locator('#scene').boundingBox(),pointerBefore=await page.evaluate(()=>browserTextConsumer.observe().counts.pointerEvents);await page.getByRole('button',{name:'Dispose',exact:true}).click();await page.mouse.click(box.x+45,box.y+60);
 await page.evaluate(pointerBefore=>{const o=__record('DisposeLatePhysicalPointer');if(o.counts.rendererCreated!==o.counts.rendererDisposed||o.counts.liveRenderers||o.counts.binds!==o.counts.unbinds||o.counts.pointerEvents!==pointerBefore)throw Error('display lifetime');
 const resources=__gpuProof.contexts.map(r=>({created:r.created,deleted:r.deleted,live:r.live(),error:r.error(),capacity:r.capacity}));for(const r of resources)if(r.error||Object.values(r.live).some(v=>v)||Object.entries(r.created).some(([k,v])=>v!==r.deleted[k]))throw Error('GPU lifetime');
 const gl=browserTextConsumer.canvas.getContext('webgl2'),blend={srcRGB:gl.getParameter(gl.BLEND_SRC_RGB),dstRGB:gl.getParameter(gl.BLEND_DST_RGB),srcAlpha:gl.getParameter(gl.BLEND_SRC_ALPHA),dstAlpha:gl.getParameter(gl.BLEND_DST_ALPHA),error:gl.getError()};
 if(blend.srcRGB!==gl.ONE||blend.dstRGB!==gl.ONE_MINUS_SRC_ALPHA||blend.srcAlpha!==gl.ONE||blend.dstAlpha!==gl.ONE_MINUS_SRC_ALPHA||blend.error)throw Error('GL blend state');
 window.__proof={fixtureRepair:window.__fixtureRepair ?? null,runtime:navigator.userAgent,stages:__stages,early:__early,refusals:__refusals,oldAPIEqual:__oldAPIEqual,wrapChecks:__wrapChecks,pngDecoded:__pngDecoded,resources,errors:__gpuProof.errors,warnings:__gpuProof.warnings,pointerBefore,pointerAfter:o.counts.pointerEvents,blend,scratch:__gpuProof.scratchCanvases.map(c=>({width:c.width,height:c.height})),finalCounts:o.counts};
 },pointerBefore);
}
}
