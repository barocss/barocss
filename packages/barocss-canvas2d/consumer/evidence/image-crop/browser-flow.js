async page => {
  // Use Playwright CLI in one named session. Run phases in order. Phase 1 saves once.
  // After phase 1 click the file input, then use CLI upload on saved-document.json once.
  // Phase 2 checks Open, edits and exports once. Phase 3 decodes, captures and disposes.
  const phase = 'PHASE';
  const dir = '/Users/user/.codex/worktrees/canvas2d-image-crop/barocss/packages/barocss-canvas2d/consumer/evidence/image-crop/';
  if (phase === '1' || phase === '1b') {
    if (phase === '1') {
    await page.waitForFunction(() => !!window.__cropConsumer);
    await page.evaluate(async () => {
      window.__cropAPI = await import('../dist/index.js');
      window.__cropStages = []; window.__cropErrors = []; window.__cropScratch = []; window.__cropBitmaps = [];
      addEventListener('error', e => __cropErrors.push(e.message));
      addEventListener('unhandledrejection', e => __cropErrors.push(String(e.reason)));
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
        const c = get.call(this, kind, ...args);
        if (kind === '2d' && c && !__cropScratch.includes(this)) __cropScratch.push(this);
        return c;
      };
      const createBitmap = createImageBitmap.bind(window);
      window.createImageBitmap = async (...args) => {
        const b = await createBitmap(...args), row = { bitmap: b, closes: 0 };
        __cropBitmaps.push(row); const close = b.close.bind(b);
        b.close = () => { row.closes++; close(); }; return b;
      };
      window.__cropEqual = (actual, expected, label) => {
        if (actual.length !== expected.length || actual.some((n, i) => n !== expected[i])) throw Error(label);
      };
      window.__cropRecord = label => { const o = __cropConsumer.observe(); __cropStages.push({ label, ...o }); return o; };
      const o = __cropRecord('originalRedCell');
      __cropEqual(o.assetBytes, [255,0,0,255,0,0,0,0,0,0,255,255,0,255,0,255], 'original all16');
      if(o.crop.x!==0||o.crop.y!==0||o.spriteData.width!==80||o.spriteData.height!==80) throw Error('original metadata');
      for(const s of o.samples) { __cropEqual(s.rgba,[255,0,0,255],'original red');if(s.hit!=='Sprite')throw Error('original hit'); }
      // Direct browser oracle: non-square pixels and alpha-zero hidden RGB use literal expected bytes.
      const a={width:3,height:2,pixels:new Uint8Array([1,2,3,255,71,82,93,0,4,5,6,128,7,8,9,1,10,11,12,255,13,14,15,0])};
      const b=__cropAPI.cropImageAsset(a,{x:1,y:0,width:2,height:2});
      __cropEqual(b.pixels,[71,82,93,0,4,5,6,128,10,11,12,255,13,14,15,0],'non-square literal16');
      const c=__cropAPI.cropImageAsset(a,{x:1,y:0,width:2,height:2});a.pixels.fill(33);c.pixels.fill(44);
      __cropEqual(b.pixels,[71,82,93,0,4,5,6,128,10,11,12,255,13,14,15,0],'browser isolation');
      window.__cropDirect={nonSquare:[3,2],output:[2,2],comparedBytes:16,hiddenRGB:[71,82,93,0],independent:true};
      const f=__cropConsumer, saved=await f.documentText(), before=f.observe();
      let getterReads=0;const accessor={x:0,y:0,width:1};Object.defineProperty(accessor,'height',{enumerable:true,get(){getterReads++;return 1;}});
      const huge={width:513,height:512,pixels:new Uint8Array(513*512*4)};
      const calls=JSON.stringify(f.contexts.map(c=>c.calls));window.__cropRefusals=[];
      for(const [label,rect,input,expected] of [
        ['malformed',{x:0,y:0,width:0,height:1},undefined,'INVALID_ASSET'],
        ['outside',{x:2,y:0,width:1,height:1},undefined,'INVALID_ASSET'],
        ['accessor',accessor,undefined,'INVALID_ASSET'],
        ['oversize',{x:0,y:0,width:1,height:1},huge,'ASSET_LIMIT']]){
        let code='ACCEPTED';try{f.extract(rect,input);}catch(e){code=e.code;}
        if(code!==expected)throw Error('refusal '+label);__cropRefusals.push({label,code});
      }
      if(getterReads!==0||calls!==JSON.stringify(f.contexts.map(c=>c.calls)))throw Error('getter or draw/read before refusal');
      const after=f.observe();for(const key of ['generation','preparations','scene','treeScene','assetBytes','originalBytes','samples','pointerLog'])if(JSON.stringify(before[key])!==JSON.stringify(after[key]))throw Error('retained '+key);
      if(saved!==await f.documentText())throw Error('refusal document');
      window.__cropGetterReads=getterReads;window.__cropRefusalProof={retained:true,drawReadBeforeRefusalUnchanged:true,documentEqual:true};
      __cropRecord('refusalsRetainOriginal');
    });
    await page.getByRole('button',{name:'Extract right column',exact:true}).click();
    }
    await page.evaluate(async phase => {
      const f=__cropConsumer,o=__cropRecord(phase === '1b' ? 'acceptedRightColumnValidationResumed' : 'oneAcceptedRightColumn');
      __cropEqual(o.assetBytes,[0,0,0,0,0,255,0,255],'extracted all8');
      __cropEqual(o.originalBytes,[255,0,0,255,0,0,0,0,0,0,255,255,0,255,0,255],'original remains16');
      if(o.preparations!==1||o.generation!==2||o.spriteData.width!==80||o.spriteData.height!==80||o.spriteData.imageId!=='Extracted'||JSON.stringify(o.crop)!==JSON.stringify({x:0,y:0,width:1,height:2}))throw Error('derived geometry');
      for(const s of o.samples){const e=s.y<60?[255,255,0,255]:[0,255,0,255];__cropEqual(s.rgba,e,'literal GL sample');if(s.hit!==(s.y<60?'Back':'Sprite'))throw Error('derived hit');}
      // Independent full backing oracle uses authored logical rectangles and solid literal colors.
      window.__cropDisplay=(x,y,moved=false)=>{
        const sx=moved?28:20;
        if(x>=sx&&x<sx+80&&y>=60&&y<100)return [0,255,0,255];
        if(x>=20&&x<100&&y>=20&&y<100)return [255,255,0,255];
        return [0,0,0,0];
      };
      const gl=f.canvas.getContext('webgl2'),p=new Uint8Array(320*240*4);gl.readPixels(0,0,320,240,gl.RGBA,gl.UNSIGNED_BYTE,p);
      for(let y=0;y<240;y++)for(let x=0;x<320;x++){const j=((239-y)*320+x)*4,e=__cropDisplay((x+.5)/2,(y+.5)/2);for(let c=0;c<4;c++)if(p[j+c]!==e[c])throw Error('full backing oracle '+x+','+y);}
      window.__cropGPU={comparedBytes:p.length,tolerance:0};
      const copy=f.asset();copy.pixels.fill(90);__cropEqual(f.asset().pixels,[0,0,0,0,0,255,0,255],'registry isolation');
      window.__cropSavedText=await f.documentText();
    }, phase);
    const box=await page.locator('#scene').boundingBox();
    await page.mouse.click(box.x+30,box.y+30);await page.mouse.click(box.x+30,box.y+70);
    await page.evaluate(()=>{const o=__cropRecord('realPointers');__cropEqual(o.pointerLog,['Team','stage','Sprite','Team','stage'],'pointer delivery');});
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save document',exact:true}).click()]);
    await download.saveAs(dir+'saved-document.json');
    await page.evaluate(()=>__cropRecord('oneSave'));
  }
  if(phase==='2'){
    await page.waitForFunction(()=>__cropConsumer.observe().opens===1);
    await page.evaluate(async()=>{
      const f=__cropConsumer,o=__cropRecord('physicalOneOpenFresh');
      if(o.generation!==3||o.preparations!==1||o.opens!==1||o.contextId!=='CropConsumer'||o.sceneVersion!==29||o.spriteData.id!=='Sprite'||o.spriteData.imageId!=='Extracted'||o.contexts.length!==3)throw Error('cold identity');
      __cropEqual(o.assetBytes,[0,0,0,0,0,255,0,255],'restored all8');
      if(JSON.stringify(o.crop)!==JSON.stringify({x:0,y:0,width:1,height:2})||await f.documentText()!==__cropSavedText)throw Error('saved crop/file equality');
      for(const s of o.samples){__cropEqual(s.rgba,s.y<60?[255,255,0,255]:[0,255,0,255],'restored literal');if(s.hit!==(s.y<60?'Back':'Sprite'))throw Error('restored hit');}
      window.__cropOpen={fileEqual:true,bytes:8,freshCanvasTreeRenderer:true,preparationsBefore:1,preparationsAfter:1};
    });
    await page.getByRole('button',{name:'Move restored Sprite',exact:true}).click();
    await page.evaluate(()=>{
      const f=__cropConsumer,o=__cropRecord('restoredPublicSpriteEdit');
      if(o.spriteData.transform.x!==28||o.spriteData.transform.y!==20||o.edits!==1)throw Error('restored move');
      __cropEqual(o.assetBytes,[0,0,0,0,0,255,0,255],'edit bytes');
      if(f.renderer.hitTest({x:104,y:70})?.id!=='Sprite'||f.renderer.hitTest({x:24,y:70})?.id!=='Back')throw Error('edit hit');
    });
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export PNG',exact:true}).click()]);
    await download.saveAs(dir+'exported.png');await page.evaluate(()=>__cropRecord('onePNGExport'));
  }
  if(phase==='3'){
    await page.evaluate(async()=>{
      const blob=await(await fetch('./evidence/image-crop/exported.png')).blob();
      const decoded=await __cropAPI.decodeImageBlob(blob);if(decoded.width!==320||decoded.height!==240)throw Error('PNG dimensions');
      for(let y=0;y<240;y++)for(let x=0;x<320;x++){const j=(y*320+x)*4,e=__cropDisplay((x+.5)/2,(y+.5)/2,true);for(let c=0;c<4;c++)if(decoded.pixels[j+c]!==e[c])throw Error('PNG literal full oracle '+x+','+y);}
      window.__cropDecoded={encodedBytes:blob.size,width:decoded.width,height:decoded.height,comparedBytes:decoded.pixels.length,tolerance:0,publicDecode:true,independentLiteral:true,bitmapClosed:__cropBitmaps.map(r=>r.closes),scratch:__cropScratch.map(c=>({width:c.width,height:c.height})),pending1249:true};
      __cropRecord('PNGPublicDecode');
    });
    await page.screenshot({path:dir+'screenshot.png'});
    const box=await page.locator('#scene').boundingBox(),before=await page.evaluate(()=>__cropConsumer.observe().pointerLog.length);
    await page.getByRole('button',{name:'Dispose',exact:true}).click();await page.mouse.click(box.x+50,box.y+70);
    await page.evaluate(before=>{
      const f=__cropConsumer,o=__cropRecord('DisposeLatePointer');
      if(o.pointerLog.length!==before||o.binds!==o.unbinds||o.contexts.length!==4||o.contexts.some(c=>c.lost||c.error||Object.values(c.resources).some(r=>r.live||r.created!==r.deleted)))throw Error('all-context lifetime');
      __cropEqual(__cropAPI.cropImageAsset(f.original(),{x:1,y:0,width:1,height:2}).pixels,[0,0,0,0,0,255,0,255],'CPU after Dispose');
      if(o.saves!==1||o.opens!==1||o.pngs!==1||o.preparations!==1)throw Error('one actual flow');
      if(__cropErrors.length)throw Error('runtime errors');
      const gl=f.contexts[0].gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
      window.__cropProof={runtime:navigator.userAgent,parent:'6bd3376d6943a8d84b83ca62b0031a9ec8927bea',direct:__cropDirect,refusals:__cropRefusals,getterReads:__cropGetterReads,refusalRetention:__cropRefusalProof,fullGPU:__cropGPU,open:__cropOpen,decoded:__cropDecoded,stages:__cropStages,final:o,cpuAfterDispose:true,noProductChangesAfterAcceptedCrop:true,firstFailures:[{phase:'1',error:'original remains16',cause:'Evidence expected literal had 14 elements; actual original retained all16',acceptedPreparations:1,productChanged:false,replayedExtraction:false,resumedCurrentPage:true}],runtimeErrors:__cropErrors,initialConsole:{favicon404:true,readPixelsStallWarnings:4},actualGL:{version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),error:gl.getError()},allCreatedContextsIncluded:true};
    },before);
  }
}
