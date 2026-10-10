// Actual CLI flow, one page. Run initialize, beforeOpen, then the separate physical chooser upload, afterOpen, finalize.
// Phase guards refuse duplicate completed flow. The post-Dispose GL query only records retained context metadata.
export const phases = {
initialize: async (page) => {
 await page.addInitScript(() => {
  const proof = window.__gpuProof = {contexts:[],pointerAdds:0,pointerRemoves:0, errors:[],warnings:[],scratchCanvases:[],scratch2D:0,draws:0,bitmaps:[]};
  const get = HTMLCanvasElement.prototype.getContext;
  const add = HTMLCanvasElement.prototype.addEventListener;
  const remove = HTMLCanvasElement.prototype.removeEventListener;
  HTMLCanvasElement.prototype.addEventListener=function(t,...a){if(t==='pointerdown')proof.pointerAdds++;return add.call(this,t,...a)};
  HTMLCanvasElement.prototype.removeEventListener=function(t,...a){if(t==='pointerdown')proof.pointerRemoves++;return remove.call(this,t,...a)};
  const error=console.error, warn=console.warn;
  console.error=(...a)=>{proof.errors.push(a.map(String).join(' '));error(...a)};
  console.warn=(...a)=>{proof.warnings.push(a.map(String).join(' '));warn(...a)};
  window.addEventListener('error',e=>proof.errors.push(e.message)); window.addEventListener('unhandledrejection',e=>proof.errors.push(String(e.reason))); const createBitmap=window.createImageBitmap.bind(window); window.createImageBitmap=async(...a)=>{const b=await createBitmap(...a);const r={close:0,b};proof.bitmaps.push(r);const close=b.close.bind(b);b.close=()=>{r.close++;return close()};return b};
  HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=get.call(this,type,...args);if(type==='2d'&&gl&&!gl.__tracked){gl.__tracked=true;proof.scratch2D++;proof.scratchCanvases.push(this);const draw=gl.fillText.bind(gl);gl.fillText=(...a)=>{proof.draws++;return draw(...a)};} if(type!=='webgl2'||!gl||gl.__tracked)return gl;
   gl.__tracked=true;const record={created:{},deleted:{},handles:{},capacity:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)};proof.contexts.push(record);
   for(const kind of ['Shader','Program','Buffer','VertexArray','Texture','Framebuffer']){
    record.created[kind]=0;record.deleted[kind]=0;record.handles[kind]=[];
    const create=gl['create'+kind].bind(gl),del=gl['delete'+kind].bind(gl);
    gl['create'+kind]=(...args)=>{const h=create(...args);if(h){record.created[kind]++;record.handles[kind].push(h)}return h};
    gl['delete'+kind]=h=>{if(h)record.deleted[kind]++;return del(h)};
   }
   record.error=()=>gl.getError(); record.live=()=>Object.fromEntries(Object.entries(record.handles).map(([k,v])=>[k,v.filter(h=>gl['is'+k](h)).length]));
   return gl;
  };
 });
 await page.goto('http://127.0.0.1:31266/consumer/browser-text.html'); await page.waitForFunction(()=>window.browserTextConsumer?.observe().accepted?.text==='Canvas2D'); console.log(await page.evaluate(()=>({text:browserTextConsumer.observe().accepted.text,scratch:__gpuProof.scratchCanvases.map(c=>({width:c.width,height:c.height})),gl:__gpuProof.contexts.length})));
},
beforeOpen: async page => {
 const evidence='/Users/user/.codex/worktrees/canvas2d-text-scratch/barocss/packages/barocss-canvas2d/consumer/evidence/text-scratch/';
 if(await page.evaluate(()=>!!window.__beforeOpen))throw Error('phase1 already completed');
 await page.evaluate(()=>{window.__stages=[];window.__record=name=>{const o=browserTextConsumer.observe();if(o.accepted)o.accepted={...o.accepted,allBytes:undefined};__stages.push({name,observation:o});return o};__gpuProof.scratchCanvases.forEach(c=>c.__role='text');__record('defaultSingleCanvas2DReleased');});
 await page.getByRole('button',{name:'HI at DPR 2',exact:true}).click();
 await page.waitForFunction(()=>browserTextConsumer.observe().accepted?.text==='HI');
 await page.evaluate(async()=>{
  const api=await import('@barocss/canvas2d');window.__oracle=[];
  window.__assertSingle=(text,dpr,policy='alphanumeric',compareHost=false)=>{
   const from=__gpuProof.scratchCanvases.length,r=api.rasterizeBrowserText({text,font:'24px monospace',atlasId:'BrowserTextAtlas',dpr,textPolicy:policy});
   __gpuProof.scratchCanvases.slice(from).forEach(c=>c.__role='text');
   const c=document.createElement('canvas');c.__role='reference';const ctx=c.getContext('2d',{willReadFrequently:true});
   const config=()=>{ctx.setTransform(1,0,0,1,0,0);ctx.font='24px monospace';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.direction='ltr';ctx.fillStyle='#fff';ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fontKerning='auto';if('letterSpacing'in ctx)ctx.letterSpacing='0px';if('wordSpacing'in ctx)ctx.wordSpacing='0px'};
   config();const m=ctx.measureText(text),left=Math.floor(-m.actualBoundingBoxLeft)-2,right=Math.ceil(m.actualBoundingBoxRight)+2,top=Math.floor(-m.actualBoundingBoxAscent)-2,bottom=Math.ceil(m.actualBoundingBoxDescent)+2;
   c.width=Math.ceil((right-left)*dpr);c.height=Math.ceil((bottom-top)*dpr);config();ctx.scale(dpr,dpr);ctx.fillText(text,-left,-top);const bytes=ctx.getImageData(0,0,c.width,c.height).data;
   const expectedLayout={atlasId:'BrowserTextAtlas',text,baseline:0,opacity:1,sampling:'nearest',glyphs:[{sourceRect:{x:0,y:0,width:c.width,height:c.height},x:left,y:top,width:c.width/dpr,height:c.height/dpr,textStart:0,textEnd:text.length}]};
   if(r.asset.width!==c.width||r.asset.height!==c.height||!bytes.every((v,i)=>v===r.asset.pixels[i])||r.asset.pixels.length!==bytes.length||JSON.stringify(r.layout)!==JSON.stringify(expectedLayout)||r.advance!==m.width||JSON.stringify(r.bounds)!==JSON.stringify({left,top,width:c.width/dpr,height:c.height/dpr}))throw Error('independent full single RGBA/layout');
   if(compareHost){const o=browserTextConsumer.observe();if(JSON.stringify(o.accepted.allBytes)!==JSON.stringify([...bytes])||JSON.stringify(o.accepted.layout)!==JSON.stringify(expectedLayout))throw Error('host independent bytes/layout');}
   const snapshot=[...r.asset.pixels];ctx.clearRect(0,0,c.width,c.height);c.width=0;c.height=0;if(!r.asset.pixels.every((v,i)=>v===snapshot[i]))throw Error('reference reset copy isolation');
   __oracle.push({text,dpr,policy,width:r.asset.width,height:r.asset.height,bytes:snapshot.length,fullRGBAEqual:true,layoutEqual:true,copyAfterReferenceReset:true,hostEqual:compareHost});return r;
  };
  __gpuProof.scratchCanvases.filter(c=>!c.__role).forEach(c=>c.__role='text');
  const r=__assertSingle('HI',2,'alphanumeric',true),copy=[...r.asset.pixels];r.asset.pixels.fill(0);if(!browserTextConsumer.observe().accepted.allBytes.every((v,i)=>v===copy[i]))throw Error('public returned copy isolation');
  __assertSingle('A',1.5);__assertSingle('-$20',2,'printable-ascii');
  const o=browserTextConsumer.observe();for(const [name,rgba,hit]of [['ink',[255,255,255,255],'Label'],['background',[32,40,56,255],'Back']])if(JSON.stringify(o.accepted.samples[name].rgba)!==JSON.stringify(rgba)||o.accepted.samples[name].hit!==hit)throw Error('independent display pixels/hits');
  if(__gpuProof.scratchCanvases.some(c=>c.__role==='text'&&(c.width||c.height)))throw Error('successful text scratch');
  __record('HIAllBytesLayoutIndependentNativeCanvasAndCopies');
 });
 let o=await page.evaluate(()=>browserTextConsumer.observe()),box=await page.locator('#scene').boundingBox();for(const name of ['ink','background']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 await page.evaluate(async()=>{
  const doc=await browserTextConsumer.documentText();window.__refusals=[];
  for(const [font,code]of [['not a font','INVALID_SCENE'],['1000px monospace','ASSET_LIMIT']]){const from=__gpuProof.scratchCanvases.length,r=browserTextConsumer.rejectFont(font,'HI');const scratch=__gpuProof.scratchCanvases.slice(from);scratch.forEach(c=>c.__role='text');if(r.code!==code||!r.retained||!r.candidatesUnchanged||scratch.length!==1||scratch.some(c=>c.width||c.height))throw Error('actual font refusal cleanup retention');__refusals.push({...r,kind:'actual font',font,scratchZero:true});}
  const get=HTMLCanvasElement.prototype.getContext;let hook=0;HTMLCanvasElement.prototype.getContext=function(type,...args){const ctx=get.call(this,type,...args);if(type==='2d'&&ctx){const read=ctx.getImageData.bind(ctx);ctx.getImageData=(...a)=>{hook++;throw new Error('controlled text readback failure')};}return ctx};
  const from=__gpuProof.scratchCanvases.length;let r;try{r=browserTextConsumer.rejectFont('24px monospace','HI')}finally{HTMLCanvasElement.prototype.getContext=get};
  const scratch=__gpuProof.scratchCanvases.slice(from);scratch.forEach(c=>c.__role='text');if(r.code!=='INVALID_ASSET'||!r.retained||!r.candidatesUnchanged||hook!==1||scratch.length!==1||scratch.some(c=>c.width||c.height))throw Error('controlled readback refusal cleanup retention');__refusals.push({...r,kind:'CONTROLLED readback throw',hook,scratchZero:true});
  if(doc!==await browserTextConsumer.documentText())throw Error('refusal serialized document retention');window.__serializedRetained=true;__record('ActualFontAndControlledReadbackRefusalsRetained');
 });
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Save document',exact:true}).click();const d=await wait;await d.saveAs(evidence+'saved-document.json');
 await page.evaluate(()=>{window.__beforeOpen=browserTextConsumer.observe();window.__beforeCanvas=browserTextConsumer.canvas;window.__beforeFont={helper:__beforeOpen.counts.helperCalls,font:__beforeOpen.counts.fontPreparations,scratch:__gpuProof.scratch2D};__record('ActualScene29SaveHI');});
},
afterOpen: async page => {
 const evidence='/Users/user/.codex/worktrees/canvas2d-text-scratch/barocss/packages/barocss-canvas2d/consumer/evidence/text-scratch/';
 if(await page.evaluate(()=>!!window.__pngReady))throw Error('phase2 already completed');
 await page.waitForFunction(()=>browserTextConsumer.observe().opened?.helperCallsUnchanged);
 await page.evaluate(()=>{const o=browserTextConsumer.observe();if(browserTextConsumer.canvas===__beforeCanvas||o.accepted.text!=='HI'||Object.values(o.opened).some(v=>v!==true)||JSON.stringify(o.accepted.allBytes)!==JSON.stringify(__beforeOpen.accepted.allBytes)||o.counts.helperCalls!==__beforeFont.helper||o.counts.fontPreparations!==__beforeFont.font||__gpuProof.scratch2D!==__beforeFont.scratch||JSON.stringify(o.accepted.ids)!==JSON.stringify(__beforeOpen.accepted.ids)||o.accepted.contextId!==__beforeOpen.accepted.contextId||o.accepted.version!==29)throw Error('cold fresh chooser Open');__record('PhysicalChooserOneUploadFreshScene29OpenAll8640Bytes');});
 let o=await page.evaluate(()=>browserTextConsumer.observe()),box=await page.locator('#scene').boundingBox();for(const name of ['ink','space']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 await page.getByRole('button',{name:'Edit restored label',exact:true}).click();await page.waitForFunction(()=>browserTextConsumer.observe().accepted?.text==='-$20');
 await page.evaluate(()=>{__gpuProof.scratchCanvases.filter(c=>!c.__role).forEach(c=>c.__role='text');__assertSingle('-$20',2,'printable-ascii',true);const o=browserTextConsumer.observe();if(JSON.stringify(o.accepted.ids)!==JSON.stringify(__beforeOpen.accepted.ids)||o.accepted.contextId!==__beforeOpen.accepted.contextId||!o.accepted.sceneMatchesTree||__gpuProof.scratchCanvases.some(c=>c.__role==='text'&&(c.width||c.height)))throw Error('restored helper/glyph layout ownership');__record('RestoredPublicSingleHelperAndGlyphSetLayoutCurrency');});
 o=await page.evaluate(()=>browserTextConsumer.observe());box=await page.locator('#scene').boundingBox();for(const name of ['ink','background']){const p=o.accepted.points[name];await page.mouse.click(box.x+p.x,box.y+p.y)}
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Export PNG',exact:true}).click();const d=await wait;await d.saveAs(evidence+'exported.png');await page.evaluate(()=>{window.__pngReady=true;__record('ActualPNGDownload');});
},
finalize: async page => {
 const evidence='/Users/user/.codex/worktrees/canvas2d-text-scratch/barocss/packages/barocss-canvas2d/consumer/evidence/text-scratch/';
 if(await page.evaluate(()=>!!window.__proof))throw Error('phase3 already completed');
 await page.evaluate(async()=>{
  const api=await import('@barocss/canvas2d'),blob=await(await fetch('evidence/text-scratch/exported.png')).blob(),from=__gpuProof.scratchCanvases.length,r=await api.decodeImageBlob(blob);
  __gpuProof.scratchCanvases.slice(from).forEach(c=>c.__role='legacy image decoder');
  if(r.width!==640||r.height!==288||r.pixels.length!==640*288*4)throw Error('PNG extent');
  const o=browserTextConsumer.observe(),samples={};for(const [name,expected,hit]of [['ink',[255,255,255,255],'Label'],['background',[32,40,56,255],'Back']]){const p=o.accepted.points[name],offset=(Math.floor(p.y*2)*r.width+Math.floor(p.x*2))*4,actual=[...r.pixels.slice(offset,offset+4)];if(JSON.stringify(actual)!==JSON.stringify(expected)||o.accepted.samples[name].hit!==hit)throw Error('independent PNG sample');samples[name]={point:p,actual,expected,hit};}
  window.__pngDecoded={bytes:blob.size,width:r.width,height:r.height,pixelBytes:r.pixels.length,samples,independentLiteral:true,decoderScratchReleased:false,scope:'Parent decoder before unadopted #1249 retains private backing'};__record('OneActualPNGPublicDecodeIndependentLiteralSamples');
 });
 await page.screenshot({path:evidence+'screenshot.png'});
 const box=await page.locator('#scene').boundingBox(),pointerBefore=await page.evaluate(()=>browserTextConsumer.observe().counts.pointerEvents);
 await page.getByRole('button',{name:'Dispose',exact:true}).click();await page.mouse.click(box.x+45,box.y+60);
 await page.evaluate(pointerBefore=>{
  const o=__record('DisposeLatePhysicalPointer');if(o.counts.rendererCreated!==o.counts.rendererDisposed||o.counts.liveRenderers||o.counts.binds!==o.counts.unbinds||o.counts.pointerEvents!==pointerBefore)throw Error('display lifetime');
  const resources=__gpuProof.contexts.map(r=>({created:r.created,deleted:r.deleted,live:r.live(),error:r.error(),capacity:r.capacity}));for(const r of resources)if(r.error||Object.values(r.live).some(v=>v)||Object.entries(r.created).some(([k,v])=>v!==r.deleted[k]))throw Error('all GL lifetime');
  const scratch=__gpuProof.scratchCanvases.map(c=>({role:c.__role,width:c.width,height:c.height}));if(scratch.some(c=>c.role==='text'&&(c.width||c.height)))throw Error('all text scratch released');
  const bitmaps=__gpuProof.bitmaps.map(r=>({close:r.close,width:r.b.width,height:r.b.height}));if(bitmaps.length!==1||bitmaps.some(r=>r.close!==1||r.width||r.height))throw Error('bitmap lifetime');
  window.__proof={runtime:navigator.userAgent,parent:'65deaed23712cb1ca64a5d213cc899ee6b5225e1',stages:__stages,oracle:__oracle,refusals:__refusals,serializedRetained:__serializedRetained,pngDecoded:__pngDecoded,resources,errors:__gpuProof.errors,warnings:__gpuProof.warnings,pointerBefore,pointerAfter:o.counts.pointerEvents,pointerAdds:__gpuProof.pointerAdds,pointerRemoves:__gpuProof.pointerRemoves,scratch,bitmaps,finalCounts:o.counts,fixtureRepairs:[],noProductCodeAfterFirstText:true};
 },pointerBefore);
}
};

export const retainedGLQuery = () => { const gl=browserTextConsumer.canvas.getContext("webgl2"),d=gl.getExtension("WEBGL_debug_renderer_info"); return {version:gl.getParameter(gl.VERSION),renderer:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),error:gl.getError()}; };
