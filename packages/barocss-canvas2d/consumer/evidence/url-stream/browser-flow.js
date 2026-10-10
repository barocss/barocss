async page => {
 const dir='/Users/user/.codex/worktrees/canvas2d-url-stream/barocss/packages/barocss-canvas2d/consumer/evidence/url-stream/';
 const phase=PHASE;
 if(phase===0){
  await page.addInitScript(()=>{
   window.__streamTracking={canvases:[],bitmaps:[],gl:[],errors:[],rejections:[],mode:null,events:[]};const t=__streamTracking;
   addEventListener('error',e=>t.errors.push(e.message));addEventListener('unhandledrejection',e=>t.rejections.push(String(e.reason)));
   const create=document.createElement.bind(document);document.createElement=function(tag,...args){const c=create(tag,...args);if(tag.toLowerCase()==='canvas')t.canvases.push(c);return c;};
   const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){if(kind==='2d'&&t.mode==='null'){t.events.push('null2d');return null;}const gl=get.call(this,kind,...args);if(kind==='2d'&&gl&&t.mode==='read'){gl.getImageData=()=>{t.events.push('injectedReadError');throw new Error('controlled readback refusal');};}if(kind==='webgl2'&&gl&&!t.gl.some(c=>c.gl===gl)){const c={gl,canvas:this,resources:{}};t.gl.push(c);for(const [name,a,b,is]of [['shader','createShader','deleteShader','isShader'],['program','createProgram','deleteProgram','isProgram'],['buffer','createBuffer','deleteBuffer','isBuffer'],['vao','createVertexArray','deleteVertexArray','isVertexArray'],['texture','createTexture','deleteTexture','isTexture'],['fbo','createFramebuffer','deleteFramebuffer','isFramebuffer']]){const rawCreate=gl[a].bind(gl),rawDelete=gl[b].bind(gl),rawIs=gl[is].bind(gl),r={created:0,deleted:0,objects:[],live:()=>r.objects.filter(v=>rawIs(v)).length};c.resources[name]=r;gl[a]=(...v)=>{const o=rawCreate(...v);if(o){r.created++;r.objects.push(o);}return o;};gl[b]=o=>{if(o)r.deleted++;return rawDelete(o);};}}return gl;};
   const bitmap=createImageBitmap.bind(window);window.createImageBitmap=async(...args)=>{const b=await bitmap(...args),close=b.close.bind(b),r={initial:[b.width,b.height],closeCalls:0,widthAfter:null,heightAfter:null};t.bitmaps.push(r);b.close=()=>{r.closeCalls++;close();r.widthAfter=b.width;r.heightAfter=b.height;t.events.push('bitmapClose');};return b;};
  });
  await page.goto('http://127.0.0.1:31258/consumer/image-url.html');await page.waitForFunction(()=>!!window.__urlConsumer);
  await page.evaluate(async()=>{window.__streamAPI=await import('../dist/index.js');window.__streamDoc=await import('../dist/document.js');window.__streamStages=[];window.__streamRecord=label=>__streamStages.push({label,...__urlConsumer.observe()});window.__streamExpected=[255,0,0,255,0,0,0,0,0,0,255,255,0,255,0,255];window.__streamPixels=[[255,0,0,255],[255,255,0,255],[0,0,255,255],[0,255,0,255]];window.__streamEqual=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(label)};__streamRecord('readyOriginalURLHost');});
 }
 if(phase===1){
  await page.waitForFunction(()=>__urlConsumer.observe().assetBytes.length===16);
  await page.evaluate(async()=>{
   const f=__urlConsumer;__streamEqual(f.observe().assetBytes,__streamExpected,'literal16');f.observe().samples.forEach((s,i)=>{__streamEqual(s.rgba,__streamPixels[i],'fourGLpixels');if(s.hit!==['Sprite','Back','Sprite','Sprite'][i])throw Error('four hits')});__streamRecord('actualSameOriginPNG');
   window.__streamSaved=await __streamDoc.serializeCanvasDocument(JSON.parse(f.observe().scene),id=>f.renderer.getImageAsset(id));const before=JSON.stringify(f.observe());window.__streamCases=[];
   for(const mode of ['invalidChunk','overflow','abortBlocked','lateResponse','cancelReject']){
    let hooks=0,cancels=0,releases=0;const controller=new AbortController();
    const body=new ReadableStream({start(c){if(mode==='invalidChunk'||mode==='cancelReject')c.enqueue('invalid');if(mode==='overflow')c.enqueue(new Uint8Array(8*1024*1024+1));},cancel(){hooks++;if(mode==='cancelReject')return Promise.reject(new Error('controlled cancel rejection'));}});
    const nativeReader=body.getReader.bind(body);body.getReader=()=>{const r=nativeReader(),cancel=r.cancel.bind(r),release=r.releaseLock.bind(r);r.cancel=(...v)=>{cancels++;return cancel(...v)};r.releaseLock=()=>{releases++;return release()};return r};
    const nativeCancel=body.cancel.bind(body);body.cancel=(...v)=>{cancels++;return nativeCancel(...v)};
    const response=new Response(body,{headers:{'Content-Type':'image/png'}});
    const fetcher=async()=>{if(mode==='lateResponse')controller.abort();return response};
    const pending=__streamAPI.loadImageURL('https://controlled.invalid/image.png',{signal:controller.signal,fetcher});if(mode==='abortBlocked')setTimeout(()=>controller.abort(),0);
    let code;try{await pending}catch(e){code=e.name==='AbortError'?e.name:e.code}await new Promise(r=>setTimeout(r,0));
    const expected=mode==='overflow'?'ASSET_LIMIT':mode==='abortBlocked'||mode==='lateResponse'?'AbortError':'INVALID_ASSET';if(code!==expected||cancels!==1||hooks!==1||releases!==(mode==='lateResponse'?0:1)||body.locked)throw Error('controlled stream cleanup '+mode+' '+JSON.stringify({code,cancels,hooks,releases,locked:body.locked}));
    if(JSON.stringify(f.observe())!==before)throw Error('accepted retained');__streamCases.push({mode,controlled:true,code,cancellationRequests:cancels,underlyingCancelHooks:hooks,releaseCalls:releases,locked:body.locked});
   }
   if(await __streamDoc.serializeCanvasDocument(JSON.parse(f.observe().scene),id=>f.renderer.getImageAsset(id))!==__streamSaved)throw Error('serialized retain');__streamRecord('controlledRefusalsRetained');
  });
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save document',exact:true}).click()]);await download.saveAs(dir+'saved-document.json');await page.evaluate(()=>__streamRecord('savedScene6'));
 }
 if(phase===2){
  await page.waitForFunction(()=>__urlConsumer.observe().generation===2);
  await page.evaluate(async()=>{const f=__urlConsumer;__streamEqual(f.observe().assetBytes,__streamExpected,'fresh16');f.observe().samples.forEach((s,i)=>{__streamEqual(s.rgba,__streamPixels[i],'fresh pixels');if(s.hit!==['Sprite','Back','Sprite','Sprite'][i])throw Error('fresh hits')});if(await __streamDoc.serializeCanvasDocument(JSON.parse(f.observe().scene),id=>f.renderer.getImageAsset(id))!==__streamSaved)throw Error('file exact');__streamRecord('physicalOneOpenFresh');});
  const [download]=await Promise.all([page.waitForEvent('download'),page.evaluate(async()=>{const result=await __streamDoc.exportCanvasDocumentPNG(__streamSaved,{logicalSize:{width:160,height:120},dpr:2},()=>document.createElement('canvas'));window.__streamExport={size:result.blob.size,backing:result.backingSize};const u=URL.createObjectURL(result.blob),a=document.createElement('a');a.href=u;a.download='url-stream.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);})]);await download.saveAs(dir+'exported.png');await page.evaluate(()=>__streamRecord('exportedPNG'));
 }
 if(phase===3){
  await page.evaluate(async()=>{const a=await __streamAPI.decodeImageBlob(await(await fetch('./evidence/url-stream/exported.png')).blob());if(a.width!==320||a.height!==240)throw Error('PNG size');let max=0;const samples=__urlConsumer.observe().samples.map((s,i)=>{const j=((s.y*2)*a.width+s.x*2)*4,v=[...a.pixels.slice(j,j+4)];v.forEach((c,k)=>{max=Math.max(max,Math.abs(c-__streamPixels[i][k]))});return v});if(max>2)throw Error('PNG literal');window.__streamPNG={width:a.width,height:a.height,bytes:a.pixels.length,samples,tolerance:2,maxDifference:max};__streamRecord('browserPNGDecode');});
  await page.screenshot({path:dir+'screenshot.png'});
  await page.evaluate(()=>{const f=__urlConsumer,t=__streamTracking;f.renderer.dispose();const resources=t.gl.map(c=>({error:c.gl.getError(),cap:c.gl.getParameter(c.gl.MAX_FRAGMENT_UNIFORM_VECTORS),resources:Object.fromEntries(Object.entries(c.resources).map(([k,r])=>[k,{created:r.created,deleted:r.deleted,live:r.live()}]))}));if(resources.some(c=>c.error||Object.values(c.resources).some(r=>r.live||r.created!==r.deleted)))throw Error('GL cleanup');if(t.bitmaps.some(b=>b.closeCalls!==1||b.widthAfter||b.heightAfter))throw Error('bitmap cleanup');window.__streamProof={runtime:navigator.userAgent,stages:__streamStages,controlledStreams:__streamCases,savedSceneVersion:6,currentAPISceneVersion:__streamAPI.createDisplayTree('CurrentProbe').snapshot().version,allSourceBytes:16,pixels:__streamPixels,decodedPNG:__streamPNG,exported:__streamExport,canvasBackings:t.canvases.map(c=>[c.width,c.height]),bitmaps:t.bitmaps,console:{errors:t.errors,rejections:t.rejections},gl:resources};});
 }
}
