async page=>{
 const phase=PHASE,dir='/Users/user/.barocss-ai/v3/wt/canvas2d-svg-arcs-native/packages/barocss-canvas2d/consumer/evidence/svg-arcs/';
 if(phase===0){
  page.__saRequests=[];page.on('request',request=>page.__saRequests.push(request.url()));
  await page.addInitScript(()=>{
   window.__saLife={contexts:[],canvases:[],twoD:[],listeners:[],added:0,removed:0,fileTexts:0,inputChanges:0,inputFiles:[],downloads:[],hashes:[],bitmaps:[],errors:[],rejections:[],nativeErrors:[],urls:[],images:[],decodes:[]};
   const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener,capture=options=>typeof options==='boolean'?options:!!options?.capture;
   const category=(target,type)=>target instanceof HTMLCanvasElement&&['pointerdown','webglcontextlost','webglcontextrestored'].includes(type)?'canvas':((target===window&&type==='pagehide')||(target instanceof Element&&(['arc-save','arc-edit','arc-refuse','arc-dispose','arc-open-button'].includes(target.id)&&type==='click'||['open-svg','arc-open'].includes(target.id)&&type==='change')))?'control':null;
   EventTarget.prototype.addEventListener=function(type,listener,options){const cat=category(this,type);if(cat&&listener){const flag=capture(options);let row=__saLife.listeners.find(r=>r.target===this&&r.type===type&&r.listener===listener&&r.capture===flag);if(!row){row={id:__saLife.listeners.length+1,target:this,type,category:cat,listener,capture:flag,active:false,adds:0,removes:0};__saLife.listeners.push(row);}if(!row.active){row.active=true;row.adds++;__saLife.added++;}}return add.call(this,type,listener,options);};
   EventTarget.prototype.removeEventListener=function(type,listener,options){const cat=category(this,type);if(cat){const flag=capture(options),row=__saLife.listeners.find(r=>r.target===this&&r.type===type&&r.listener===listener&&r.capture===flag);if(row?.active){row.active=false;row.removes++;__saLife.removed++;}}return remove.call(this,type,listener,options);};
   addEventListener('error',event=>__saLife.errors.push(event.message));addEventListener('unhandledrejection',event=>__saLife.rejections.push(String(event.reason)));
   addEventListener('change',event=>{const input=event.target;if(input instanceof HTMLInputElement&&['open-svg','arc-open'].includes(input.id)){__saLife.inputChanges++;__saLife.inputFiles.push([...input.files??[]].map(file=>({name:file.name,size:file.size,type:file.type})));}},true);
   const create=Document.prototype.createElement;Document.prototype.createElement=function(...args){const element=create.apply(this,args);if(String(args[0]).toLowerCase()==='canvas')__saLife.canvases.push(element);if(String(args[0]).toLowerCase()==='img')__saLife.images.push(element);return element;};
   const context=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args){const result=context.apply(this,args);if(args[0]==='2d'&&result&&!__saLife.twoD.includes(this))__saLife.twoD.push(this);if(args[0]==='webgl2'&&result&&!__saLife.contexts.some(c=>c.gl===result)){
    const gl=result,c={id:__saLife.contexts.length+1,gl,canvas:this,calls:{draw:0,read:0},resources:{}};__saLife.contexts.push(c);
    for(const [name,create,del,test]of [['shader','createShader','deleteShader','isShader'],['program','createProgram','deleteProgram','isProgram'],['buffer','createBuffer','deleteBuffer','isBuffer'],['vao','createVertexArray','deleteVertexArray','isVertexArray'],['texture','createTexture','deleteTexture','isTexture'],['fbo','createFramebuffer','deleteFramebuffer','isFramebuffer'],['renderbuffer','createRenderbuffer','deleteRenderbuffer','isRenderbuffer']]){const a=gl[create].bind(gl),b=gl[del].bind(gl),nativeTest=gl[test].bind(gl),r={created:0,deleted:0,objects:[],live:()=>r.objects.filter(value=>nativeTest(value)).length};c.resources[name]=r;gl[create]=(...params)=>{const v=a(...params);if(v){r.created++;r.objects.push(v);}return v;};gl[del]=v=>{if(v)r.deleted++;return b(v);};}
    for(const [name,key]of [['drawArrays','draw'],['readPixels','read']]){const fn=gl[name].bind(gl);gl[name]=(...params)=>{c.calls[key]++;return fn(...params);};}
    const error=gl.getError.bind(gl);gl.getError=()=>{const code=error();if(code!==gl.NO_ERROR)__saLife.nativeErrors.push({context:c.id,code});return code;};
   }return result;};
   const text=Blob.prototype.text;Blob.prototype.text=function(...args){if(this instanceof File)__saLife.fileTexts++;return text.apply(this,args);};
   const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(...args){if(this.download)__saLife.downloads.push(this.download);return click.apply(this,args);};
   const bitmap=globalThis.createImageBitmap;globalThis.createImageBitmap=async function(...args){const result=await bitmap.apply(this,args);__saLife.bitmaps.push({bitmap:result,closes:0});return result;};
   const close=ImageBitmap.prototype.close;ImageBitmap.prototype.close=function(...args){const item=__saLife.bitmaps.find(item=>item.bitmap===this);if(item)item.closes++;return close.apply(this,args);};
   const createURL=URL.createObjectURL.bind(URL),revokeURL=URL.revokeObjectURL.bind(URL);URL.createObjectURL=(...args)=>{const url=createURL(...args);__saLife.urls.push({url,revoked:0});return url;};URL.revokeObjectURL=url=>{const row=__saLife.urls.find(r=>r.url===url);if(row)row.revoked++;return revokeURL(url);};
   const decode=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=function(...args){__saLife.decodes.push(this);return decode.apply(this,args);};
   window.__saFacilities=()=>({contexts:__saLife.contexts.map(c=>({id:c.id,canvasId:c.canvas.id,lost:c.gl.isContextLost(),error:c.gl.getError(),calls:{...c.calls},resources:Object.fromEntries(Object.entries(c.resources).map(([name,r])=>[name,{created:r.created,deleted:r.deleted,live:r.live()}]))})),canvasesCreated:__saLife.canvases.length,twoD:__saLife.twoD.map(c=>({width:c.width,height:c.height})),pointerAdded:__saLife.added,pointerRemoved:__saLife.removed,pointerActive:__saLife.listeners.filter(i=>i.active).length,listeners:__saLife.listeners.map(i=>({id:i.id,targetId:i.target===window?'window':i.target.id,type:i.type,category:i.category,capture:i.capture,active:i.active,adds:i.adds,removes:i.removes})),fileTexts:__saLife.fileTexts,inputChanges:__saLife.inputChanges,inputFiles:__saLife.inputFiles.map(files=>files.map(file=>({...file}))),downloads:[...__saLife.downloads],hashes:__saLife.hashes.map(h=>({...h})),bitmaps:__saLife.bitmaps.map(i=>({closes:i.closes,width:i.bitmap.width,height:i.bitmap.height})),urls:__saLife.urls.map(u=>({...u})),decodeCalls:__saLife.decodes.length,images:__saLife.images.map(i=>({src:i.getAttribute('src'),naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight})),nativeErrors:[...__saLife.nativeErrors]});
  });


  page.__coldConsole=[];page.on('console',m=>page.__coldConsole.push({type:m.type(),text:m.text()}));
  await page.goto('http://127.0.0.1:31451/examples/canvas2d-scene/svg-v5.html?arcs=1');
  await page.waitForFunction(()=>document.documentElement.dataset.svgArcReady==='ready');
  return await page.evaluate(async()=>{
   window.__coldDoc=await import('/packages/barocss-canvas2d/dist/document.js');
   window.__coldRows=[];
   window.__coldEq=(a,b,l)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(l);};
   window.__coldFlat=ns=>ns.flatMap(n=>[n,...(n.children?__coldFlat(n.children):[])]);
   window.__coldHash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
   window.__coldRecord=label=>{const row={label,observation:__svgArcConsumer.observe(),facilities:__saFacilities()};if(row.facilities.contexts.some(c=>c.error||c.lost)||__saLife.nativeErrors.length)throw Error('native GL '+label);__coldRows.push(row);return row;};
   window.__coldForward=(x,y)=>{const a=5*Math.PI/180;return{x:90+2*Math.cos(a)*x-2*Math.sin(a)*y,y:15+2*Math.sin(a)*x+2*Math.cos(a)*y};};
   window.__coldBernstein=(p0,c,t)=>{const u=1-t;return{x:u**3*p0.x+3*u*u*t*c.c1x+3*u*t*t*c.c2x+t**3*c.x,y:u**3*p0.y+3*u*u*t*c.c1y+3*u*t*t*c.c2y+t**3*c.y};};
   const k=4/3*Math.tan(Math.PI/16),q=Math.SQRT1_2;
   window.__coldLiteralLast={p0:{x:140-40*q,y:100+20*q},curve:{c1x:140-40*q-40*q*k,c1y:100+20*q-20*q*k,c2x:110,c2y:100+20*k,x:100,y:100}};
   window.__coldStroke=__coldBernstein(__coldLiteralLast.p0,__coldLiteralLast.curve,2/3);
   window.__coldPoint=p=>{const f=__svgArcConsumer,w=__coldForward(p.x,p.y),ix=Math.floor(w.x*2),iy=Math.floor(w.y*2),bytes=new Uint8Array(4),gl=f.canvas.getContext('webgl2');gl.readPixels(ix,599-iy,1,1,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return{world:w,pixel:[ix,iy],rgba:[...bytes],hit:f.renderer.hitTest(w)?.id??null};};
   window.__coldPaint=(r,color,hit,l)=>{if(r.rgba.some((v,i)=>Math.abs(v-color[i])>2)||r.hit!==hit)throw Error(l+': '+JSON.stringify(r));};
   const o=__svgArcConsumer.observe();if(o.counts.accepted!==1||o.counts.candidates!==1||o.counts.edits||o.counts.imports||o.counts.saves||o.counts.opens||__saFacilities().contexts.length!==1)throw Error('fresh default only');
   return __coldRecord('IndependentDefaultNoReconstructedCounters');
  });
 }
 if(phase===1){
  const chooser=page.waitForEvent('filechooser');await page.locator('#arc-open-button').click();await(await chooser).setFiles('/tmp/.playwright-cli/svg-arcs-document.json');
  await page.waitForFunction(()=>__svgArcConsumer.observe().counts.opens===1&&!__svgArcConsumer.observe().busy);
  return await page.evaluate(async()=>{
   const f=__svgArcConsumer,o=f.observe(),life=__saFacilities();
   if(o.failure||o.counts.imports||o.counts.svgUploads||o.counts.saves||o.counts.edits||o.counts.jsonUploads!==1||life.fileTexts!==1||life.inputChanges!==1||life.contexts.length!==2||o.source5!==null||o.sourceText!==null||o.diagnostics!==null)throw Error('cold Open only/native file/provenance');
   __coldEq(o.scene,JSON.parse(__coldNativeText).sceneObject,'WHOLE genuine file Scene29');
   if(await __coldDoc.serializeCanvasDocument(o.scene,()=>null)!==JSON.parse(__coldNativeText).text)throw Error('WHOLE native document serialization');
   window.__coldOpenedFrame=f.fullFrame();window.__coldOpenedHash=await __coldHash(__coldOpenedFrame);
   if(__coldOpenedHash!=='f08907d570a3b1752b8b739da84002d25ddb98f6d3df8ba64724dd9bbd91f9c9')throw Error('ALL2880000 original saved frame SHA mismatch '+__coldOpenedHash);
   window.__coldOpenScene=o.scene;window.__coldBeforeStroke=__coldPoint(__coldStroke);__coldPaint(__coldBeforeStroke,[32,40,56,255],'SourceBackgroundPath','old saved outside future stroke');
   return __coldRecord('PhysicalGenuineJSONOpenCurrent29AllFrameBytesAndColdImport0');
  });
 }
 if(phase===2){
  let box=await page.locator('#live').boundingBox(),p=await page.evaluate(()=>__coldForward(80,110));await page.mouse.click(box.x+p.x*box.width/600,box.y+p.y*box.height/300);
  await page.locator('#arc-edit').click();await page.waitForFunction(()=>__svgArcConsumer.observe().counts.edits===1&&!__svgArcConsumer.observe().busy);
  await page.evaluate(async()=>{
   const f=__svgArcConsumer,o=f.observe(),expected=JSON.parse(JSON.stringify(__coldOpenScene));__coldFlat(expected.nodes).find(n=>n.id==='ArcPath').commands[3].c2x+=10;
   __coldEq(o.scene,expected,'WHOLE Scene only lastC.c2x+10 with cold edits0');
   if(o.failure||o.counts.imports||o.counts.saves||o.source5!==null||__saFacilities().contexts.length!==3||o.counts.accepted!==3)throw Error('new3 candidate/source independent restored edit');
   const before=__coldFlat(__coldOpenScene.nodes).find(n=>n.id==='ArcPath'),after=__coldFlat(o.scene.nodes).find(n=>n.id==='ArcPath');window.__coldBernsteinRows=[];
   for(const t of [.25,.5,.75]){const a=__coldBernstein(before.commands[2],before.commands[3],t),b=__coldBernstein(after.commands[2],after.commands[3],t);if(Math.abs((b.x-a.x)-30*(1-t)*t*t)>1e-10||b.y!==a.y)throw Error('independent Bernstein delta');__coldBernsteinRows.push({t,before:a,after:b,expectedDeltaX:30*(1-t)*t*t});}
   window.__coldAfterStroke=__coldPoint(__coldStroke);__coldPaint(__coldAfterStroke,[238,242,255,255],'ArcPath','literal edited stroke/hit');
   window.__coldEditedFrame=f.fullFrame();if(__coldEditedFrame.every((v,i)=>v===__coldOpenedFrame[i]))throw Error('edited fullframe unchanged');window.__coldEditedHash=await __coldHash(__coldEditedFrame);__coldRecord('OneRealColdEditClickLastControlOnlyBernsteinPaintHit');
  });
  box=await page.locator('#live').boundingBox();await page.mouse.click(box.x+p.x*box.width/600,box.y+p.y*box.height/300);await page.screenshot({path:dir+'screenshot.png'});
  return await page.evaluate(()=>({phase:2,screenshotReady:true,stage:__coldRecord('ActualRestoredScreenshotBeforeDispose')}));
 }
 if(phase===3){
  const before=await page.evaluate(()=>__svgArcConsumer.observe()),box=await page.locator('#live').boundingBox();await page.locator('#arc-dispose').click();await page.mouse.click(box.x+120,box.y+120);
  const result=await page.evaluate(before=>{
   const f=__svgArcConsumer,o=f.observe(),life=__saFacilities();
   if(!o.disposed||o.failure||o.busy||o.counts.imports||o.counts.svgUploads||o.counts.saves||o.counts.edits!==1||o.counts.opens!==1||o.counts.jsonUploads!==1||o.PNG)throw Error('new host counts');
   for(const key of ['candidates','accepted','disposes','binds','unbinds','subscriptions','subscriptionsRemoved'])if(o.counts[key]!==3)throw Error('new3 lifetime '+key);
   __coldEq(o.scene,before.scene,'terminal Scene');__coldEq(o.pointers,before.pointers,'late physical pointer inert');__coldEq(o.routes,before.routes,'late public route inert');
   if(o.pointers.length!==2||o.pointers.some(p=>!p.trusted||p.hit!=='ArcPath')||o.routes.length!==2)throw Error('two trusted ArcPath routes');
   if(life.contexts.length!==3||life.listeners.length!==17||life.listeners.filter(r=>r.category==='canvas').length!==9||life.listeners.filter(r=>r.category==='control').length!==8||life.listeners.some(r=>r.active||r.adds!==1||r.removes!==1))throw Error('ALL17 exact target/type/callback/capture identities');
   for(const c of life.contexts){if(c.error||c.lost)throw Error('nativeGL');for(const [name,n]of Object.entries({shader:4,program:2,buffer:3,vao:2,texture:0,fbo:0,renderbuffer:0})){const r=c.resources[name];if(r.created!==n||r.deleted!==n||r.live)throw Error('allnative '+c.id+'/'+name);}}
   if(life.twoD.length||life.images.length||life.decodeCalls||life.bitmaps.length||life.urls.length||life.downloads.length||life.fileTexts!==1||life.inputChanges!==1||__saLife.errors.length||__saLife.rejections.length||life.nativeErrors.length)throw Error('new onlyfile/noSVG reference or save/native errors');
   if(![...document.querySelectorAll('button,input')].every(e=>e.disabled))throw Error('controls disabled');const stable=JSON.stringify(o);f.dispose();if(JSON.stringify(f.observe())!==stable)throw Error('repeatDispose');
   return{status:'PASS_COLD_OPEN_RESTORED_EDIT_LIFETIME',originalStatus:'INCOMPLETE_PARTIAL_SESSION_LOST',originalLostSessionTerminal:'UNPROVED',actualBrowser:true,userAgent:navigator.userAgent,logical:[600,300],DPR:2,backing:[1200,600],nativeSavedFile:JSON.parse(__coldNativeText),openedFullFrameBytes:2880000,originalFrameSHA256:__coldOpenedHash,editedFrameSHA256:__coldEditedHash,wholeSceneOnlyLastCChange:true,bernstein:__coldBernsteinRows,literalLastControl:__coldLiteralLast,strokePoint:__coldStroke,beforeStroke:__coldBeforeStroke,afterStroke:__coldAfterStroke,stages:__coldRows,terminal:__coldRecord('NEWThreeGLAnd17CallbacksTerminalBeforeBrowserClosure'),facilities:life,errors:__saLife.errors,rejections:__saLife.rejections,nativeErrors:life.nativeErrors,originalAcceptedReplay:0,physicalSVG:0,physicalSave:0,physicalJSONOpen:1,originalTerminalExtrapolated:false,broaderRootAcceptance:'UNRUN'};
  },before);
  result.requests=[...page.__saRequests];result.externalRequests=result.requests.filter(u=>!u.startsWith('http://127.0.0.1:31451/'));result.console=[...page.__coldConsole];if(result.externalRequests.length)throw Error('externalrequests');return result;
 }
}
