async page => {
  const phase = PHASE;
  const evidence = '/Users/user/.codex/worktrees/canvas2d-image-retention/barocss/packages/barocss-canvas2d/consumer/evidence/image-source-retention/';
  if (phase === 0) {
    page.__imageRequests = []; page.on('request', r => page.__imageRequests.push(r.url()));
    await page.addInitScript(() => {
      const life = window.__imageLife = { contexts: [], listeners: [], targets: [], events: [], errors: [], rejections: [], nativeErrors: [], urls: [], downloads: [], files: 0, fileTexts: 0, hashes: [] };
      const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
      const capture = options => typeof options === 'boolean' ? options : !!options?.capture;
      const relevant = (target, type) => (target instanceof HTMLCanvasElement && ['webglcontextlost','webglcontextrestored','pointerdown'].includes(type)) || (target instanceof HTMLButtonElement && type === 'click') || (target instanceof HTMLInputElement && target.id === 'open' && type === 'change');
      EventTarget.prototype.addEventListener = function(type, callback, options) {
        if (callback && relevant(this, type)) {
          const flag = capture(options); let row = life.listeners.find(r => r.target === this && r.type === type && r.callback === callback && r.capture === flag);
          if (!row) {
            if (!life.targets.includes(this)) life.targets.push(this);
            const diagnostic = this instanceof HTMLCanvasElement && type === 'webglcontextlost' && !life.listeners.some(r => r.target === this && r.type === type);
            row = { id: life.listeners.length+1, target: this, targetIdentity: life.targets.indexOf(this)+1, callback, type, capture: flag, active: false, adds: 0, removes: 0, category: diagnostic ? 'host-diagnostic' : type.startsWith('webgl') ? 'renderer-core' : 'host-product' }; life.listeners.push(row);
          }
          if (!row.active) { row.active = true; row.adds++; }
        }
        return add.call(this, type, callback, options);
      };
      EventTarget.prototype.removeEventListener = function(type, callback, options) {
        const row = life.listeners.find(r => r.target === this && r.type === type && r.callback === callback && r.capture === capture(options));
        if (row?.active) { row.active = false; row.removes++; }
        return remove.call(this, type, callback, options);
      };
      for (const type of ['click','pointerdown']) add.call(window, type, event => { if (event.target instanceof HTMLElement && (event.target instanceof HTMLButtonElement || event.target.id === 'scene')) life.events.push({ type, target: event.target.id, trusted: event.isTrusted, clientX: event.clientX, clientY: event.clientY }); }, true);
      add.call(window, 'error', event => life.errors.push(event.message)); add.call(window, 'unhandledrejection', event => life.rejections.push(String(event.reason)));
      add.call(window, 'change', event => { if (event.target instanceof HTMLInputElement && event.target.id === 'open') life.files++; }, true);
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(...args) {
        const gl = get.apply(this,args);
        if (args[0] === 'webgl2' && gl && !life.contexts.some(c => c.gl === gl)) {
          const row = { id: life.contexts.length+1, canvas: this, gl, draws: 0, reads: 0, resources: {} }; life.contexts.push(row);
          for (const [name, create, drop, test] of [['shader','createShader','deleteShader','isShader'],['program','createProgram','deleteProgram','isProgram'],['buffer','createBuffer','deleteBuffer','isBuffer'],['vao','createVertexArray','deleteVertexArray','isVertexArray'],['texture','createTexture','deleteTexture','isTexture'],['fbo','createFramebuffer','deleteFramebuffer','isFramebuffer']]) {
            const allocate = gl[create].bind(gl), release = gl[drop].bind(gl), isLive = gl[test].bind(gl), resource = { created: 0, deleted: 0, handles: [], live: () => resource.handles.filter(handle => isLive(handle)).length }; row.resources[name] = resource;
            gl[create] = (...values) => { const handle = allocate(...values); if (handle) { resource.created++; resource.handles.push(handle); } return handle; };
            gl[drop] = handle => { if (handle) resource.deleted++; return release(handle); };
          }
          for (const [method, key] of [['drawArrays','draws'],['readPixels','reads']]) { const native = gl[method].bind(gl); gl[method] = (...values) => { row[key]++; return native(...values); }; }
          const error = gl.getError.bind(gl); gl.getError = () => { const code = error(); if (code !== gl.NO_ERROR) life.nativeErrors.push({ context: row.id, code }); return code; };
        }
        return gl;
      };
      const createURL = URL.createObjectURL.bind(URL), revokeURL = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (...args) => { const url = createURL(...args); life.urls.push({ url, revoked: 0 }); return url; };
      URL.revokeObjectURL = url => { const row = life.urls.find(r => r.url === url); if (row) row.revoked++; return revokeURL(url); };
      const text = Blob.prototype.text; Blob.prototype.text = function(...args) { if (this instanceof File) life.fileTexts++; return text.apply(this,args); };
      const click = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function(...args) { if (this.download) life.downloads.push(this.download); return click.apply(this,args); };
      const digest = SubtleCrypto.prototype.digest; SubtleCrypto.prototype.digest = function(...args) { const row = { settled: false }; life.hashes.push(row); return digest.apply(this,args).then(value => { row.settled = true; return value; }, error => { row.settled = true; throw error; }); };
      window.__imageFacilities = () => ({ contexts: life.contexts.map(c => ({ id: c.id, canvasId: c.canvas.id, lost: c.gl.isContextLost(), error: c.gl.getError(), draws: c.draws, reads: c.reads, resources: Object.fromEntries(Object.entries(c.resources).map(([name,r]) => [name,{created:r.created,deleted:r.deleted,live:r.live()}])) })), listeners: life.listeners.map(r => ({ id:r.id,targetIdentity:r.targetIdentity,targetId:r.target.id,type:r.type,capture:r.capture,category:r.category,active:r.active,adds:r.adds,removes:r.removes,disabled:r.target instanceof HTMLButtonElement||r.target instanceof HTMLInputElement?r.target.disabled:null })), events:structuredClone(life.events), errors:[...life.errors],rejections:[...life.rejections],nativeErrors:[...life.nativeErrors],urls:structuredClone(life.urls),downloads:[...life.downloads],files:life.files,fileTexts:life.fileTexts,hashes:structuredClone(life.hashes),nativeImages:'UNINSTRUMENTED; no decoder flow exercised',nativeFonts:'UNINSTRUMENTED; no font flow exercised' });
    });
    await page.goto('http://127.0.0.1:31449/consumer/sprite-image-source.html');
    await page.waitForFunction(() => window.__imageSourceConsumer);
    return await page.evaluate(() => {
      window.__imageAssert = (condition,label) => { if (!condition) throw Error(label); };
      window.__imageEq = (a,b,label) => __imageAssert(JSON.stringify(a)===JSON.stringify(b),label);
      window.__imageFrame = () => { const f=__imageSourceConsumer, gl=f.canvas.getContext('webgl2'), bytes=new Uint8Array(f.canvas.width*f.canvas.height*4);gl.readPixels(0,0,f.canvas.width,f.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes; };
      window.__imageFrameEq = (a,b,label) => { __imageAssert(a.length===230400&&b.length===a.length,'full frame byte length '+label);for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error('full frame differs '+label+' byte '+i); };
      window.__imageOracle = (bytes, sx, sy) => { let compared=0;for(let y=0;y<240;y++)for(let x=0;x<240;x++){const lx=(x+.5)/2,ly=(239-y+.5)/2;let rgba=[0,0,0,0];if(lx>=20&&lx<100&&ly>=20&&ly<100)rgba=[255,255,0,255];if(lx>=sx&&lx<sx+80&&ly>=sy&&ly<sy+80){const column=lx-sx<40?0:1,row=ly-sy<40?0:1;const literal=[[255,0,255,255],[0,0,0,0],[0,255,255,255],[255,255,255,255]][row*2+column];if(literal[3])rgba=literal;}const index=(y*240+x)*4;for(let c=0;c<4;c++){if(bytes[index+c]!==rgba[c])throw Error('literal full frame oracle '+index+' channel '+c+' '+bytes[index+c]+' != '+rgba[c]);compared++;}}return compared; };
      window.__imageStable = async () => {const f=__imageSourceConsumer,o=f.observe();const {contexts,...state}=o;return{state,document:await f.documentText()};};
      window.__imageRows=[];
      window.__imageRecord=async label=>{const row={label,stable:await __imageStable(),facilities:__imageFacilities()};__imageRows.push(row);return row;};
      const f=__imageSourceConsumer;window.__imageIdentity={tree:f.tree,sprite:f.sprite,team:f.tree.get('Team'),back:f.tree.get('Back'),renderer:f.renderer,canvas:f.canvas};
      window.__imageIdentityCheck=()=>{const f=__imageSourceConsumer,s=__imageIdentity;__imageAssert(f.tree===s.tree&&f.sprite===s.sprite&&f.tree.get('Team')===s.team&&f.tree.get('Back')===s.back&&f.renderer===s.renderer&&f.canvas===s.canvas,'all public object identities retained');};
      return{phase:0,status:'READY',facilities:__imageFacilities(),observation:f.observe()};
    });
  }
  if (phase === 1) {
    await page.locator('#switch-b').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Image AtlasB full');
    await page.locator('#remove-a').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Removed unused AtlasA');
    await page.evaluate(async()=>{const f=__imageSourceConsumer;__imageIdentityCheck();const o=f.observe();__imageAssert(o.imageId==='AtlasB'&&o.crop===null&&o.treeScene===o.scene,'accepted fullB tree');__imageEq(o.assetB,[255,0,255,255,0,0,0,0,0,255,255,255,255,255,255,255],'all literal B bytes');__imageAssert(o.assetA===null,'unused A absent');window.__imageBefore=await __imageStable();window.__imageBeforeFrame=__imageFrame();__imageOracle(__imageBeforeFrame,20,20);window.__imageAdmission=[];const native=f.renderer.updateScene.bind(f.renderer);f.renderer.updateScene=value=>{const before=__imageFacilities();try{const result=native(value);__imageAdmission.push({accepted:true,before,after:__imageFacilities()});return result;}catch(error){__imageAdmission.push({accepted:false,code:error.code,message:error.message,before,after:__imageFacilities()});throw error;}};await __imageRecord('full B after unused A removal; literal230400-byte oracle');});
    await page.locator('#switch-a').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Action failed: INVALID_ASSET');
    await page.evaluate(async()=>{__imageIdentityCheck();__imageEq(await __imageStable(),__imageBefore,'every semantic observation and exact document retained');const frame=__imageFrame();__imageFrameEq(frame,__imageBeforeFrame,'normal source refusal');__imageOracle(frame,20,20);const a=__imageAdmission[0];__imageAssert(!a.accepted&&a.code==='INVALID_ASSET','normal button renderer refusal exactcode');__imageEq(a.after,a.before,'native admission rows exactly unchanged zero draw/read/allocation');__imageAssert(__imageSourceConsumer.observe().treeScene===__imageSourceConsumer.observe().scene,'tree and accepted Scene synchronized');await __imageRecord('normal Switch A refusal; complete tree/document/assets/frame/hits/identities retained');});
    await page.locator('#edit').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Moved restored Sprite');
    await page.evaluate(async()=>{const f=__imageSourceConsumer,o=f.observe(),expected=JSON.parse(__imageBefore.state.scene);expected.nodes[0].children.find(n=>n.id==='Sprite').transform.x=8;expected.nodes[0].children.find(n=>n.id==='Sprite').transform.y=0;__imageEq(JSON.parse(o.scene),expected,'whole Scene changes only Sprite position8,0');__imageAssert(o.treeScene===o.scene&&o.imageId==='AtlasB'&&o.edits===1,'normal edit recovers on B');__imageIdentityCheck();__imageOracle(__imageFrame(),8,0);await __imageRecord('physical normal Edit succeeds with literal230400-byte moved B oracle');});
    const bounds=await page.locator('#scene').boundingBox();await page.mouse.click(bounds.x+20*bounds.width/120,bounds.y+10*bounds.height/120);
    await page.evaluate(async()=>{const f=__imageSourceConsumer;__imageEq(f.observe().pointerLog,['Sprite','Team','stage'],'real pointer route after refused source and recovered edit');const event=__imageFacilities().events.filter(e=>e.type==='pointerdown'&&e.target==='scene').at(-1);__imageAssert(event?.trusted,'native trusted Sprite pointer');__imageEq(f.renderer.hitTest({x:20,y:10})?.id,'Sprite','recovered literal Sprite hit');__imageEq(f.renderer.hitTest({x:60,y:10})?.id??null,null,'transparent texel outside Back falls through');__imageEq(f.renderer.hitTest({x:95,y:95})?.id,'Back','stable Back hit');__imageIdentityCheck();window.__imageDocument=await f.documentText();await __imageRecord('same Sprite-Team-stage native pointer route');});
    await page.screenshot({path:evidence+'screenshot.png'});
    return await page.evaluate(()=>({phase:1,status:'PASS',screenshotReady:true,documentSnapshot:__imageDocument,retainedFrameBytes:230400,literalWholeFrameOracles:2,admission:__imageAdmission,stages:__imageRows,facilities:__imageFacilities()}));
  }
  if (phase === 2) {
    const bounds=await page.locator('#scene').boundingBox();await page.locator('#dispose').click();await page.waitForFunction(()=>__imageSourceConsumer.observe().disposed);
    const beforeLate=await page.evaluate(()=>__imageSourceConsumer.observe());await page.mouse.click(bounds.x+20*bounds.width/120,bounds.y+10*bounds.height/120);
    const result = await page.evaluate(async beforeLate=>{
      const f=__imageSourceConsumer,o=f.observe(),l=__imageFacilities();__imageEq(o.pointerLog,beforeLate.pointerLog,'late native pointer inert');__imageEq(o.pointerEvents,beforeLate.pointerEvents,'late native pointer no host callback');__imageAssert(o.disposed&&o.binds===1&&o.unbinds===1,'samecanvas terminal');__imageAssert(l.contexts.length===1,'ALL one GL context');
      for(const c of l.contexts){__imageAssert(!c.error&&!c.lost,'native GL healthy');for(const [name,r] of Object.entries(c.resources))__imageAssert(r.created===r.deleted&&r.live===0,'all GL native handles retired '+name);__imageEq(Object.fromEntries(Object.entries(c.resources).map(([name,r])=>[name,r.created])),{shader:4,program:2,buffer:3,vao:2,texture:2,fbo:0},'actual native population');}
      __imageAssert(l.listeners.length===17&&l.listeners.reduce((n,r)=>n+r.adds,0)===17&&l.listeners.reduce((n,r)=>n+r.removes,0)===3,'exact17adds/3removes');const active=l.listeners.filter(r=>r.active);__imageAssert(active.length===14&&active.filter(r=>r.category==='host-product').length===13&&active.filter(r=>r.category==='host-diagnostic').length===1,'existing13disabledcontrols+diagnostic remain untilpageclosure');__imageAssert(active.filter(r=>r.category==='host-product').every(r=>r.disabled),'remaining controls disabled');__imageAssert(l.listeners.filter(r=>r.category==='renderer-core'||r.type==='pointerdown').every(r=>!r.active&&r.removes===1),'core2 and pointer1 removed exactidentity');
      __imageAssert(l.files===0&&l.fileTexts===0&&l.downloads.length===0&&l.urls.length===0&&l.hashes.every(r=>r.settled),'no new native file/URL; serialization settled');__imageAssert(!l.errors.length&&!l.rejections.length&&!l.nativeErrors.length,'runtime errors0');
      const stable=await __imageStable();let disposedError;try{f.setImageSource('AtlasB');}catch(error){disposedError={name:error.name,message:error.message,code:error.code??null};}__imageEq(disposedError,{name:'Error',message:'consumer disposed',code:null},'unchanged existing plainError disposedpolicy');__imageEq(await __imageStable(),stable,'disposed source call retains allstate');const resources=__imageFacilities().contexts;f.dispose();__imageEq(__imageFacilities().contexts,resources,'repeatdispose native inert');
      const result={status:'PASS',phase:2,actualBrowser:true,userAgent:navigator.userAgent,sourceProfile:'SOURCE bundled public ESM; no native installed tarball flow',logical:[120,120],DPR:2,backing:[240,240],wholeFrameBytes:230400,allRetainedFrameExact:true,allPublicObjectIdentitiesRetained:true,Download:0,physicalOpen:0,PNG:0,APIArtifactQualification:'document-snapshot.json is API serialization ONLY, not UISave or genuine download',disposedError,terminal:o,facilities:__imageFacilities(),admission:__imageAdmission,stages:__imageRows,documentSnapshot:__imageDocument,broaderAcceptance:'UNRUN',listenerBoundary:'Host pointer1 and renderer core2 removed; existing disabled controls13 and host diagnostic1 remain registered until ownedpageclosure; no allDOM0 claim'};
      window.__imageFinal=result;return result;
    },beforeLate);
    const requests=[...page.__imageRequests],external=requests.filter(url=>!url.startsWith('http://127.0.0.1:31449/')&&!url.startsWith('blob:'));
    if(external.length)throw Error('external request');
    return {...result,requestAudit:{requests,external,externalCount:external.length}};
  }
}
