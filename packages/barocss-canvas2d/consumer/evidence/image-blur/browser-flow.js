async page => {
 const dir='/Users/user/.codex/worktrees/canvas2d-box-blur/barocss/packages/barocss-canvas2d/consumer/evidence/image-blur/';
 const phase=PHASE;
 if(phase===1){
  await page.waitForFunction(()=>!!window.captureFixture);
  await page.evaluate(async()=>{
   window.__blurStages=[];window.__blurConsole={errors:[],rejections:[]};addEventListener('error',e=>__blurConsole.errors.push(e.message));addEventListener('unhandledrejection',e=>__blurConsole.rejections.push(String(e.reason)));
   window.__blurAPI=await import('../dist/index.js');
   window.__blurRecord=label=>{const o=captureFixture.observe();__blurStages.push({label,...o});return o;};
   window.__blurSource=()=>{const p=new Uint8Array(128*64*4);for(let y=0;y<64;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;if(x<32&&y<32)p.set([255,0,0,255],i);else if(x>=32&&x<64&&y<32)p.set([0,255,0,128],i);else if(x<32&&y>=32)p.set([0,0,255,255],i);}return p;};
   window.__blurNaive=(p,w,h,r)=>{const out=new Uint8Array(p.length),area=(2*r+1)**2;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sums=[0,0,0,0];for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++){if(xx<0||xx>=w||yy<0||yy>=h)continue;const i=(yy*w+xx)*4,a=p[i+3];sums[3]+=a;for(let c=0;c<3;c++)sums[c]+=p[i+c]*a;}const i=(y*w+x)*4,a=Math.round(sums[3]/area);out[i+3]=a;if(a)for(let c=0;c<3;c++)out[i+c]=Math.round(sums[c]/sums[3]);}return out;};
   window.__blurExpected=__blurNaive(__blurSource(),128,64,2);
   window.__blurEqual=(actual,expected,label)=>{if(actual.length!==expected.length||actual.some((v,i)=>v!==expected[i]))throw Error(label);};
   window.__blurPremul=i=>{const a=__blurExpected[i+3];return [0,1,2].map(c=>Math.round(__blurExpected[i+c]*a/255)).concat(a);};
   window.__blurPoints=[[1,1],[15,15],[32,15],[50,15],[15,32],[50,45],[100,50]];
   __blurRecord('readyScene29');
  });
  await page.getByRole('button',{name:'Capture source',exact:true}).click();
  await page.evaluate(()=>{__blurEqual(captureFixture.asset().pixels,__blurSource(),'literal source');__blurRecord('capturedOriginal');});
  await page.getByRole('button',{name:'Blur 2 pixels',exact:true}).click();
  await page.evaluate(()=>{
   const f=captureFixture;__blurEqual(f.asset().pixels,__blurExpected,'all32768blurbytes');__blurEqual(f.original().pixels,__blurSource(),'original retained');
   const twice=__blurAPI.blurImageAsset(f.original(),2);__blurEqual(twice.pixels,__blurExpected,'repeat blur');twice.pixels.fill(9);__blurEqual(f.asset().pixels,__blurExpected,'repeat isolation');__blurEqual(f.target.getImageAsset('Captured').pixels,__blurExpected,'registered isolation');
   const gl=f.canvas.getContext('webgl2'),p=new Uint8Array(32768);gl.readPixels(0,0,128,64,gl.RGBA,gl.UNSIGNED_BYTE,p);let max=0;for(let y=0;y<64;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4,j=((63-y)*128+x)*4,e=__blurPremul(i);for(let c=0;c<4;c++){const d=Math.abs(p[j+c]-e[c]);max=Math.max(max,d);if(d>2)throw Error('fullGPU oracle '+x+','+y);}}window.__blurGPU={comparedBytes:32768,tolerance:2,maxDifference:max};
   window.__blurSamples=__blurPoints.map(([x,y])=>{const actual=f.targetSample(x,y),expected=__blurPremul((y*128+x)*4),hit=expected[3]>0?'CapturedSprite':null;if(actual.rgba.some((v,c)=>Math.abs(v-expected[c])>2)||actual.hit!==hit)throw Error('sample hit');return {x,y,actual,expected};});__blurRecord('radius2FullOracle');
  });
  const box=await page.locator('canvas').nth(1).boundingBox();for(const [x,y]of await page.evaluate(()=>__blurPoints))await page.mouse.click(box.x+1+x+0.5,box.y+1+y+0.5);
  await page.evaluate(async()=>{
   const f=captureFixture,o=f.observe();if(o.pointers!==7||o.hits.join(',')!==__blurSamples.map(s=>s.actual.hit??'none').join(','))throw Error('real pointer hits');__blurRecord('realPointers');
   const saved=await f.documentText(),before=f.observe().contexts.map(c=>c.calls),bytes=[...f.target.getImageAsset('Captured').pixels];let getterReads=0;
   const getter={width:1,height:1};Object.defineProperty(getter,'pixels',{enumerable:true,get(){getterReads++;return new Uint8Array(4)}});
   const asset={width:513,height:512,pixels:new Uint8Array(513*512*4)};
   window.__blurRefusals=[];
   for(const [label,call,code]of [['radiusNegative',()=>f.blur(-1),'INVALID_ASSET'],['radiusFraction',()=>f.blur(1.5),'INVALID_ASSET'],['radius9',()=>f.blur(9),'INVALID_ASSET'],['assetGetter',()=>__blurAPI.blurImageAsset(getter,2),'INVALID_ASSET'],['oversize',()=>__blurAPI.blurImageAsset(asset,2),'ASSET_LIMIT']]){let actual;try{call()}catch(e){actual=e.code;}if(actual!==code)throw Error('refusal '+label);__blurRefusals.push({label,code:actual});}
   if(getterReads!==0||JSON.stringify(before)!==JSON.stringify(f.observe().contexts.map(c=>c.calls))||saved!==await f.documentText())throw Error('refusal mutation');__blurEqual(f.target.getImageAsset('Captured').pixels,bytes,'refusal bytes retained');window.__blurGetterReads=getterReads;window.__blurSavedText=saved;__blurRecord('refusalsRetained');
  });
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save derived Sprite',exact:true}).click()]);await download.saveAs(dir+'saved-document.json');
  await page.evaluate(()=>__blurRecord('savedDerivedScene29'));
 }
 if(phase===2){
  await page.waitForFunction(()=>captureFixture.observe().opens===1);
  await page.evaluate(async()=>{const f=captureFixture,o=f.observe();if(o.sceneVersion!==29||o.contextId!=='CaptureDerived'||f.tree().get('CapturedSprite')?.kind!=='sprite')throw Error('restored scene');__blurEqual(f.target.getImageAsset('Captured').pixels,__blurExpected,'fresh allbytes');if(await f.documentText()!==__blurSavedText)throw Error('file equality');for(const s of __blurSamples){const a=f.targetSample(s.x,s.y);if(JSON.stringify(a)!==JSON.stringify(s.actual))throw Error('restored pixels/hits');}__blurRecord('physicalOneOpenFresh');});
  await page.getByRole('button',{name:'Move restored Sprite',exact:true}).click();
  await page.evaluate(()=>{const f=captureFixture;__blurEqual(f.target.getImageAsset('Captured').pixels,__blurExpected,'restoredmove bytes');window.__blurPNGPoints=__blurPoints.map(([x,y])=>[Math.min(x+8,127),y]);window.__blurPNGExpected=__blurPNGPoints.map(([x,y])=>f.targetSample(x,y).rgba);if(f.targetSample(23,15).hit!=='CapturedSprite'||f.targetSample(0,15).hit!==null)throw Error('restoredmove hits');__blurRecord('restoredMove');});
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export PNG',exact:true}).click()]);await download.saveAs(dir+'exported.png');
  await page.evaluate(()=>__blurRecord('exportedPNG'));
 }
 if(phase===3){
  await page.evaluate(async()=>{const blob=await(await fetch('./evidence/image-blur/exported.png')).blob(),bitmap=await createImageBitmap(blob),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);let max=0;const samples=__blurPNGPoints.map((p,i)=>{const straight=[...ctx.getImageData(...p,1,1).data],actual=straight.map((v,c)=>c<3?Math.round(v*straight[3]/255):v),expected=__blurPNGExpected[i];actual.forEach((v,c)=>{const d=Math.abs(v-expected[c]);max=Math.max(max,d);if(d>2)throw Error('PNG oracle');});return {p,straight,premultiplied:actual,expected};});bitmap.close();window.__blurDecoded={bytes:blob.size,width:c.width,height:c.height,samples,tolerance:2,maxDifference:max,bitmapClosed:true};c.width=0;c.height=0;__blurDecoded.decoderBackingZero=true;__blurRecord('browserPNGDecode');});
  await page.screenshot({path:dir+'screenshot.png'});const box=await page.locator('canvas').nth(1).boundingBox();const before=await page.evaluate(()=>captureFixture.observe().pointers);await page.getByRole('button',{name:'Dispose',exact:true}).click();await page.mouse.click(box.x+16,box.y+16);
  await page.evaluate(before=>{const f=captureFixture,o=__blurRecord('DisposeLatePointer');if(o.pointers!==before||o.binds!==o.unbinds||o.contexts.some(c=>c.error||Object.values(c.resources).some(r=>r.live||r.created!==r.deleted)))throw Error('lifetime');const after=__blurAPI.blurImageAsset(f.original(),2);__blurEqual(after.pixels,__blurExpected,'CPUafterDispose');window.__blurProof={runtime:navigator.userAgent,sourceDPR:2,sourceBacking:[128,64],targetDPR:1,fullCPUBytes:32768,fullGPU:__blurGPU,samples:__blurSamples,refusals:__blurRefusals,getterReads:__blurGetterReads,decoded:__blurDecoded,stages:__blurStages,console:__blurConsole,cpuAfterDispose:true,final:o};},before);
 }
}