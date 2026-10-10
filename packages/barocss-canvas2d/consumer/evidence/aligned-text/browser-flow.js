async page => {
const evidence='/Users/user/.codex/worktrees/canvas2d-align-1192/barocss/packages/barocss-canvas2d/consumer/evidence/aligned-text/';
if(!await page.evaluate(()=>!!window.__beforeOpen)){
 await page.waitForFunction(()=>browserTextConsumer.observe().accepted?.text==='Canvas2D');
 await page.evaluate(()=>{window.__stages=[];window.__record=name=>{const o=browserTextConsumer.observe();if(o.accepted)o.accepted={...o.accepted,allBytes:undefined};__stages.push({name,observation:o});return o};__record('defaultSingleLineScene28');});
 await page.getByRole('button',{name:'Left lines',exact:true}).click();
 await page.waitForFunction(()=>browserTextConsumer.observe().accepted?.text==='Balance\n-$20');
 await page.evaluate(()=>{const o=__record('multilineOriginal');
 if(o.accepted.version!==28||o.accepted.layout.glyphs.length!==1||o.accepted.layout.glyphs[0].textEnd!==12||o.accepted.lineAdvance!==40||o.accepted.lines[1].baseline!==40)throw Error('original identity/layout');
 for(const name of ['line1','line2'])if(o.accepted.samples[name]?.hit!=='Label'||JSON.stringify(o.accepted.samples[name].rgba)!=='[255,255,255,255]')throw Error('line interior');
 if(o.accepted.samples.interline?.hit!=='Back'||JSON.stringify(o.accepted.samples.interline.rgba)!=='[32,40,56,255]')throw Error('interline alpha hit');});
 await page.evaluate(async()=>{
 const current=await import('@barocss/canvas2d'),parent=await import('/dist/alignment-parent.js');
 const base={text:'Balance\n-$20',font:'24px monospace',atlasId:'BrowserTextAtlas',lineAdvance:40,dpr:2};
 const old=parent.rasterizeBrowserMultilineText(base),absent=current.rasterizeBrowserMultilineText(base),left=current.rasterizeBrowserMultilineText({...base,lineAlign:'left'});
 if(JSON.stringify(old)!==JSON.stringify(absent)||JSON.stringify(old)!==JSON.stringify(left))throw Error('exact parent default/left compatibility');
 window.__alignmentChecks=[];window.__checkAlignment=async(mode)=>{
  const o=browserTextConsumer.observe(),a=o.accepted,c=document.createElement('canvas'),ctx=c.getContext('2d',{willReadFrequently:true});
  c.width=old.asset.width;c.height=old.asset.height;ctx.font=base.font;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.direction='ltr';ctx.fillStyle='#fff';ctx.fontKerning='auto';if('letterSpacing'in ctx)ctx.letterSpacing='0px';if('wordSpacing'in ctx)ctx.wordSpacing='0px';
  const widths=base.text.split('\n').map(t=>ctx.measureText(t).width),W=Math.max(...widths),offsets=widths.map(w=>mode==='left'?0:(W-w)/(mode==='center'?2:1));
  ctx.scale(2,2);base.text.split('\n').forEach((t,i)=>ctx.fillText(t,offsets[i]-old.bounds.left,i*40-old.bounds.top));
  const bytes=ctx.getImageData(0,0,c.width,c.height).data;
  if(a.lineAlign!==mode||a.text!==base.text||a.atlas.width!==c.width||a.atlas.height!==c.height||!bytes.every((v,i)=>v===a.allBytes[i]))throw Error('independent alignment pixels');
  for(const name of ['line1','line2'])if(a.samples[name].hit!=='Label'||JSON.stringify(a.samples[name].rgba)!=='[255,255,255,255]')throw Error('aligned line pixels/hits');
  if(a.samples.interline.hit!=='Back'||JSON.stringify(a.samples.interline.rgba)!=='[32,40,56,255]')throw Error('aligned gap hit');
  __alignmentChecks.push({mode,measuredWidths:widths,maxAdvance:W,offsets,fullRGBAEqual:true,bytes:bytes.length,fractionalOffset:offsets[1]%1!==0});c.width=0;c.height=0;
 };
 window.__defaultEqual={nativeParent:'d54063cd',absent:true,explicitLeft:true,allRGBA:true,layoutBoundsLinesShape:true};await __checkAlignment('left');
 });
 let o=await page.evaluate(()=>browserTextConsumer.observe()),box=await page.locator('#scene').boundingBox();
 for(const name of ['line1','line2','interline']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 for(const mode of ['center','right']){
  await page.getByRole('button',{name:mode==='center'?'Center lines':'Right lines',exact:true}).click();
  await page.waitForFunction(mode=>browserTextConsumer.observe().accepted?.lineAlign===mode,mode);
  await page.evaluate(async mode=>{await __checkAlignment(mode);__record('aligned-'+mode)},mode);
  o=await page.evaluate(()=>browserTextConsumer.observe());box=await page.locator('#scene').boundingBox();for(const name of ['line1','line2','interline']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 }
 await page.evaluate(async()=>{
 const {rasterizeBrowserMultilineText:multi,rasterizeBrowserText:single}=await import('@barocss/canvas2d');
 const base={text:'Balance\n-$20',font:'24px monospace',atlasId:'BrowserTextAtlas',lineAdvance:40,dpr:2};
 const before=__gpuProof.scratch2D,serialized=await browserTextConsumer.documentText();let getters=0;const results=[];
 const options=[undefined,null,'middle','CENTER',0,{},true].map(lineAlign=>({...base,lineAlign}));
 const accessor={...base};Object.defineProperty(accessor,'lineAlign',{enumerable:true,get(){getters++;throw Error('getter')}});options.push(accessor);
 const hidden={...base};Object.defineProperty(hidden,'lineAlign',{value:'center',enumerable:false});options.push(hidden);
 for(const v of options){const r=browserTextConsumer.rejectMultiline(v);if(r.code!=='INVALID_SCENE'||!r.retained||!r.candidatesUnchanged)throw Error('before scratch alignment refusal');results.push(r)}
 if(getters||__gpuProof.scratch2D!==before)throw Error('getter/scratch');window.__earlyRefusals={results:[...results],getters,scratchDelta:0};
 for(const v of [{...base,lineAlign:'right',lineAdvance:200},{...base,lineAlign:'center',font:'1000px monospace'}]){const start=__gpuProof.scratchCanvases.length,draw=__gpuProof.draws;const r=browserTextConsumer.rejectMultiline(v);if(r.code!=='ASSET_LIMIT'||!r.retained||!r.candidatesUnchanged||__gpuProof.draws!==draw)throw Error('oversize retention');const owned=__gpuProof.scratchCanvases.slice(start);if(owned.length!==1||owned.some(c=>c.width||c.height))throw Error('scratch cleanup');results.push({...r,scratchReleased:true,drawDelta:0})}
 if(serialized!==await browserTextConsumer.documentText())throw Error('serialized accepted document retention');window.__serializedRetention={equal:true,checks:results.length,historyAPI:false};window.__direct=[];__record('invalidAlignmentOversizeSerializedRetention');
 });
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Save document',exact:true}).click();const d=await wait;await d.saveAs(evidence+'saved-document.json');
 await page.evaluate(()=>{window.__beforeOpen=browserTextConsumer.observe();window.__beforeCanvas=browserTextConsumer.canvas;window.__beforeFont={helper:__beforeOpen.counts.helperCalls,font:__beforeOpen.counts.fontPreparations,scratch:__gpuProof.scratch2D};__record('actualOriginalSave');});
}else if(!await page.evaluate(()=>!!window.__pngReady)){
 await page.waitForFunction(()=>browserTextConsumer.observe().opened?.helperCallsUnchanged);
 await page.evaluate(()=>{const o=browserTextConsumer.observe();if(browserTextConsumer.canvas===__beforeCanvas||o.accepted.text!=='Balance\n-$20'||Object.values(o.opened).some(v=>v!==true)||JSON.stringify(o.accepted.allBytes)!==JSON.stringify(__beforeOpen.accepted.allBytes)||o.counts.helperCalls!==__beforeFont.helper||o.counts.fontPreparations!==__beforeFont.font||__gpuProof.scratch2D!==__beforeFont.scratch)throw Error('cold fresh Open');__record('physicalChooserOneUploadFreshOpen');});
 let o=await page.evaluate(()=>browserTextConsumer.observe()),box=await page.locator('#scene').boundingBox();for(const name of ['line1','line2','interline']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 await page.getByRole('button',{name:'Center restored lines',exact:true}).click();await page.waitForFunction(()=>browserTextConsumer.observe().accepted?.lineAlign==='center');
 await page.evaluate(async()=>{await __checkAlignment('center');const o=__record('restoredAlignmentPublicHelperSetLayout');if(o.accepted.layout.glyphs.length!==1||!o.accepted.sceneMatchesTree||o.accepted.samples.line2.hit!=='Label'||o.accepted.samples.interline.hit!=='Back'||JSON.stringify(o.accepted.ids)!==JSON.stringify(__beforeOpen.accepted.ids)||o.accepted.contextId!==__beforeOpen.accepted.contextId)throw Error('restored edit');});
 o=await page.evaluate(()=>browserTextConsumer.observe());box=await page.locator('#scene').boundingBox();for(const name of ['line1','line2','interline']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();const d=await wait;await d.saveAs(evidence+'exported.png');await page.evaluate(()=>{window.__pngReady=true;__record('actualPNGDownload')});
}else{
 await page.evaluate(async()=>{const blob=await(await fetch('evidence/aligned-text/exported.png')).blob(),bitmap=await createImageBitmap(blob),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);const o=browserTextConsumer.observe(),samples={};
 for(const name of ['line1','line2','interline','background']){const p=o.accepted.points[name],actual=[...ctx.getImageData(Math.floor(p.x*2),Math.floor(p.y*2),1,1).data],expected=o.accepted.samples[name].rgba;if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('PNG decode');samples[name]={actual,expected};}
 bitmap.close();window.__pngDecoded={bytes:blob.size,width:c.width,height:c.height,samples,bitmapClosed:true};c.width=0;c.height=0;__record('PNGIndependentBrowserDecode');});
 await page.screenshot({path:evidence+'screenshot.png'});
 const box=await page.locator('#scene').boundingBox(),pointerBefore=await page.evaluate(()=>browserTextConsumer.observe().counts.pointerEvents);await page.getByRole('button',{name:'Dispose',exact:true}).click();await page.mouse.click(box.x+45,box.y+60);
 await page.evaluate(pointerBefore=>{const o=__record('DisposeLatePhysicalPointer');if(o.counts.rendererCreated!==o.counts.rendererDisposed||o.counts.liveRenderers||o.counts.binds!==o.counts.unbinds||o.counts.pointerEvents!==pointerBefore)throw Error('display lifetime');
 const resources=__gpuProof.contexts.map(r=>({created:r.created,deleted:r.deleted,live:r.live(),error:r.error(),capacity:r.capacity}));for(const r of resources)if(r.error||Object.values(r.live).some(v=>v)||Object.entries(r.created).some(([k,v])=>v!==r.deleted[k]))throw Error('GPU lifetime');
 window.__proof={runtime:navigator.userAgent,stages:__stages,earlyRefusals:__earlyRefusals,defaultEqual:__defaultEqual,alignmentChecks:__alignmentChecks,serializedRetention:__serializedRetention,direct:__direct,pngDecoded:__pngDecoded,resources,errors:__gpuProof.errors,warnings:__gpuProof.warnings,pointerBefore,pointerAfter:o.counts.pointerEvents};
 const old=__beforeOpen.accepted,now=browserTextConsumer.observe().accepted;
 const cut=Math.floor((20-old.layout.glyphs[0].y)*2),prefix=cut*old.atlas.width*4;
 const firstLineEqual=old.allBytes.slice(0,prefix).every((v,i)=>v===now.allBytes[i]);
 const changedSecondLine=old.allBytes.slice(prefix).filter((v,i)=>v!==now.allBytes[prefix+i]).length;
 if(!firstLineEqual||!changedSecondLine)throw Error('second line edit bytes');
 const gl=browserTextConsumer.canvas.getContext('webgl2'),blend={srcRGB:gl.getParameter(gl.BLEND_SRC_RGB),dstRGB:gl.getParameter(gl.BLEND_DST_RGB),srcAlpha:gl.getParameter(gl.BLEND_SRC_ALPHA),dstAlpha:gl.getParameter(gl.BLEND_DST_ALPHA),error:gl.getError()};
 if(blend.srcRGB!==gl.ONE||blend.dstRGB!==gl.ONE_MINUS_SRC_ALPHA||blend.srcAlpha!==gl.ONE||blend.dstAlpha!==gl.ONE_MINUS_SRC_ALPHA||blend.error)throw Error('GL blend state');
 __proof.scratchAndFinalCounts={scratch:__gpuProof.scratchCanvases.map(c=>({width:c.width,height:c.height})),final:browserTextConsumer.observe().counts,runtime:navigator.userAgent};
 __proof.restoredEdit={originalText:old.text,newText:now.text,textUnchanged:old.text===now.text,alignmentChanged:true,firstLineEqual,firstLineBytes:prefix,changedSecondLineBytes:changedSecondLine,layoutIDsContextEqual:true,blend};},pointerBefore);
}
}
