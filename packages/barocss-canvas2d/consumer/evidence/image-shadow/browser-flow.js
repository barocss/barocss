async page => {
 const dir='/Users/user/.codex/worktrees/canvas2d-shadow-1240/barocss/packages/barocss-canvas2d/consumer/evidence/image-shadow/';
 const phase=PHASE;
 if(phase===1){
  await page.waitForFunction(()=>!!window.captureFixture);
  await page.evaluate(async()=>{
   window.__shadowStages=[];window.__shadowConsole={errors:[],rejections:[]};addEventListener('error',e=>__shadowConsole.errors.push(e.message));addEventListener('unhandledrejection',e=>__shadowConsole.rejections.push(String(e.reason)));
   window.__shadowAPI=await import('../dist/index.js');
   window.__shadowRecord=label=>{const o=captureFixture.observe();__shadowStages.push({label,...o});return o;};
   window.__shadowSource=()=>{const p=new Uint8Array(128*64*4);for(let y=0;y<64;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;if(x<32&&y<32)p.set([255,0,0,255],i);else if(x>=32&&x<64&&y<32)p.set([0,255,0,128],i);else if(x<32&&y>=32)p.set([0,0,255,255],i);}return p;};
   window.__shadowOptions={radius:2,offsetX:6,offsetY:4,color:[0.25,0.5,1,0.75]};
   window.__shadowNaive=(p,w,h,o)=>{const out=new Uint8Array(p.length),area=(2*o.radius+1)**2;for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0;for(let yy=y-o.offsetY-o.radius;yy<=y-o.offsetY+o.radius;yy++)for(let xx=x-o.offsetX-o.radius;xx<=x-o.offsetX+o.radius;xx++){if(xx<0||xx>=w||yy<0||yy>=h)continue;sum+=p[(yy*w+xx)*4+3];}const i=(y*w+x)*4,a=Math.round(sum/area*o.color[3]);if(a){out[i+3]=a;for(let c=0;c<3;c++)out[i+c]=Math.round(o.color[c]*255);}}return out;};
   window.__shadowExpected=__shadowNaive(__shadowSource(),128,64,__shadowOptions);
   window.__shadowEqual=(actual,expected,label)=>{if(actual.length!==expected.length||actual.some((v,i)=>v!==expected[i]))throw Error(label);};
   window.__shadowPremul=i=>{const a=__shadowExpected[i+3];return [0,1,2].map(c=>Math.round(__shadowExpected[i+c]*a/255)).concat(a);};
   window.__shadowPoints=[[1,1],[4,4],[20,20],[38,20],[60,20],[20,38],[100,50]];
   __shadowRecord('readyScene29');
  });
  await page.getByRole('button',{name:'Capture source',exact:true}).click();
  await page.evaluate(()=>{__shadowEqual(captureFixture.asset().pixels,__shadowSource(),'literal source');__shadowRecord('capturedOriginal');});
  await page.getByRole('button',{name:'Blue alpha shadow',exact:true}).click();
  await page.evaluate(()=>{
   const f=captureFixture;__shadowEqual(f.asset().pixels,__shadowExpected,'all32768shadowbytes');__shadowEqual(f.original().pixels,__shadowSource(),'original retained');
   const twice=__shadowAPI.shadowImageAsset(f.original(),__shadowOptions);__shadowEqual(twice.pixels,__shadowExpected,'repeat shadow');twice.pixels.fill(9);__shadowEqual(f.asset().pixels,__shadowExpected,'repeat isolation');__shadowEqual(f.target.getImageAsset('Captured').pixels,__shadowExpected,'registered isolation');
   const gl=f.canvas.getContext('webgl2'),p=new Uint8Array(32768);gl.readPixels(0,0,128,64,gl.RGBA,gl.UNSIGNED_BYTE,p);let max=0;for(let y=0;y<64;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4,j=((63-y)*128+x)*4,e=__shadowPremul(i);for(let c=0;c<4;c++){const d=Math.abs(p[j+c]-e[c]);max=Math.max(max,d);if(d>2)throw Error('fullGPU oracle '+x+','+y);}}window.__shadowGPU={comparedBytes:32768,tolerance:2,maxDifference:max};
   window.__shadowSamples=__shadowPoints.map(([x,y])=>{const actual=f.targetSample(x,y),expected=__shadowPremul((y*128+x)*4),hit=expected[3]>0?'CapturedSprite':null;if(actual.rgba.some((v,c)=>Math.abs(v-expected[c])>2)||actual.hit!==hit)throw Error('sample hit');return {x,y,actual,expected};});__shadowRecord('shiftedColorAlphaFullOracle');
  });
  const box=await page.locator('canvas').nth(1).boundingBox();for(const [x,y]of await page.evaluate(()=>__shadowPoints))await page.mouse.click(box.x+1+x+0.5,box.y+1+y+0.5);
  await page.evaluate(async()=>{
   const f=captureFixture,o=f.observe();if(o.pointers!==7||o.hits.join(',')!==__shadowSamples.map(s=>s.actual.hit??'none').join(','))throw Error('real pointer hits');__shadowRecord('realPointers');
   const saved=await f.documentText(),before=f.observe().contexts.map(c=>c.calls),bytes=[...f.target.getImageAsset('Captured').pixels];let getterReads=0;
   const getter={width:1,height:1};Object.defineProperty(getter,'pixels',{enumerable:true,get(){getterReads++;return new Uint8Array(4)}});
   const asset={width:513,height:512,pixels:new Uint8Array(513*512*4)};
   window.__shadowRefusals=[];
   for(const [label,call,code]of [['radiusNegative',()=>f.shadow({...__shadowOptions,radius:-1}),'INVALID_ASSET'],['offset65',()=>f.shadow({...__shadowOptions,offsetX:65}),'INVALID_ASSET'],['colorOutside',()=>f.shadow({...__shadowOptions,color:[0,0,1,1.1]}),'INVALID_ASSET'],['assetGetter',()=>__shadowAPI.shadowImageAsset(getter,__shadowOptions),'INVALID_ASSET'],['oversize',()=>__shadowAPI.shadowImageAsset(asset,__shadowOptions),'ASSET_LIMIT']]){let actual;try{call()}catch(e){actual=e.code;}if(actual!==code)throw Error('refusal '+label);__shadowRefusals.push({label,code:actual});}
   if(getterReads!==0||JSON.stringify(before)!==JSON.stringify(f.observe().contexts.map(c=>c.calls))||saved!==await f.documentText())throw Error('refusal mutation');__shadowEqual(f.target.getImageAsset('Captured').pixels,bytes,'refusal bytes retained');window.__shadowGetterReads=getterReads;window.__shadowSavedText=saved;__shadowRecord('refusalsRetained');
  });
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save derived Sprite',exact:true}).click()]);await download.saveAs(dir+'saved-document.json');
  await page.evaluate(()=>__shadowRecord('savedDerivedScene29'));
 }
 if(phase===2){
  await page.waitForFunction(()=>captureFixture.observe().opens===1);
  await page.evaluate(async()=>{const f=captureFixture,o=f.observe();if(o.sceneVersion!==29||o.contextId!=='CaptureDerived'||f.tree().get('CapturedSprite')?.kind!=='sprite')throw Error('restored scene');__shadowEqual(f.target.getImageAsset('Captured').pixels,__shadowExpected,'fresh allbytes');if(await f.documentText()!==__shadowSavedText)throw Error('file equality');for(const s of __shadowSamples){const a=f.targetSample(s.x,s.y);if(JSON.stringify(a)!==JSON.stringify(s.actual))throw Error('restored pixels/hits');}if(o.shadowPreparations!==1)throw Error('Open must not regenerate shadow');__shadowRecord('physicalOneOpenFresh');});
  await page.getByRole('button',{name:'Move restored Sprite',exact:true}).click();
  await page.evaluate(()=>{const f=captureFixture;__shadowEqual(f.target.getImageAsset('Captured').pixels,__shadowExpected,'restoredmove bytes');window.__shadowPNGPoints=__shadowPoints.map(([x,y])=>[Math.min(x+8,127),y]);window.__shadowPNGExpected=__shadowPNGPoints.map(([x,y])=>x<8?[0,0,0,0]:__shadowPremul((y*128+x-8)*4));if(f.targetSample(28,20).hit!=='CapturedSprite'||f.targetSample(0,15).hit!==null)throw Error('restoredmove hits');__shadowRecord('restoredMove');});
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export PNG',exact:true}).click()]);await download.saveAs(dir+'exported.png');
  await page.evaluate(()=>__shadowRecord('exportedPNG'));
 }
 if(phase===3){
  await page.evaluate(async()=>{const blob=await(await fetch('./evidence/image-shadow/exported.png')).blob(),bitmap=await createImageBitmap(blob),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);let max=0;const samples=__shadowPNGPoints.map((p,i)=>{const straight=[...ctx.getImageData(...p,1,1).data],actual=straight.map((v,c)=>c<3?Math.round(v*straight[3]/255):v),expected=__shadowPNGExpected[i];actual.forEach((v,c)=>{const d=Math.abs(v-expected[c]);max=Math.max(max,d);if(d>2)throw Error('PNG oracle');});return {p,straight,premultiplied:actual,expected};});bitmap.close();window.__shadowDecoded={bytes:blob.size,width:c.width,height:c.height,samples,tolerance:2,maxDifference:max,bitmapClosed:true};c.width=0;c.height=0;__shadowDecoded.decoderBackingZero=true;__shadowRecord('browserPNGDecode');});
  await page.screenshot({path:dir+'screenshot.png'});const box=await page.locator('canvas').nth(1).boundingBox();const before=await page.evaluate(()=>captureFixture.observe().pointers);await page.getByRole('button',{name:'Dispose',exact:true}).click();await page.mouse.click(box.x+16,box.y+16);
  await page.evaluate(before=>{const f=captureFixture,o=__shadowRecord('DisposeLatePointer');if(o.pointers!==before||o.binds!==o.unbinds||o.contexts.some(c=>c.error||Object.values(c.resources).some(r=>r.live||r.created!==r.deleted)))throw Error('lifetime');const after=__shadowAPI.shadowImageAsset(f.original(),__shadowOptions);__shadowEqual(after.pixels,__shadowExpected,'CPUafterDispose');window.__shadowProof={runtime:navigator.userAgent,sourceDPR:2,sourceBacking:[128,64],targetDPR:1,fullCPUBytes:32768,fullGPU:__shadowGPU,samples:__shadowSamples,refusals:__shadowRefusals,getterReads:__shadowGetterReads,decoded:__shadowDecoded,stages:__shadowStages,console:__shadowConsole,cpuAfterDispose:true,final:o};},before);
  await page.evaluate(()=>{__shadowProof.finalGL=captureFixture.contexts.map(c=>({cap:c.gl.getParameter(c.gl.MAX_FRAGMENT_UNIFORM_VECTORS),blend:[c.gl.getParameter(c.gl.BLEND_SRC_RGB),c.gl.getParameter(c.gl.BLEND_DST_RGB),c.gl.getParameter(c.gl.BLEND_SRC_ALPHA),c.gl.getParameter(c.gl.BLEND_DST_ALPHA)],error:c.gl.getError()}));});
 }
}