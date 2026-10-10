// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, parseCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';
/** @typedef {import('@barocss/canvas2d').Point} Point */
/** @typedef {{canvas:HTMLCanvasElement,renderer:import('@barocss/canvas2d').Canvas2DRenderer,
 * tree:import('@barocss/canvas2d').DisplayTree,group:import('@barocss/canvas2d').ContainerHandle,
 * frame:import('@barocss/canvas2d').FrameHandle,scene:import('@barocss/canvas2d').Scene,
 * generation:number,unbind:()=>void}} Session */
/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 320, height: 240 }, dpr: 2, backgroundColor:[32/255,64/255,96/255,1] };
const pose = (/** @type {number} */ x = 0, /** @type {number} */ y = 0) =>
  ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });
/** @type {Record<string,import('@barocss/canvas2d').SpriteRGBMatrix>} */
const matrices = {
  identity: [1,0,0,0,0,1,0,0,0,0,1,0], swap: [0,0,1,0,0,1,0,0,1,0,0,0],
  gray: [1/3,1/3,1/3,0,1/3,1/3,1/3,0,1/3,1/3,1/3,0],
  bias: [1,0,0,0.25,0,1,0,0.25,0,0,1,0.25],
};
const pixels = new Uint8Array(36);
for (let y=0;y<3;y++) { pixels.set([255,0,0,255],y*12); pixels.set([40,160,80,128],y*12+4); pixels.set([0,0,0,0],y*12+8); }
const assets = { RGBA: {width:3,height:3,pixels}, GlyphAtlas: {width:2,height:1,pixels:new Uint8Array([255,180,60,255,0,0,0,0])} };
/** @param {number} width @param {number} height @returns {import('@barocss/canvas2d').PolygonMask} */
function rectangleMask(width,height) { return {commands:[{kind:'M',x:0,y:0},{kind:'L',x:width,y:0},{kind:'L',x:width,y:height},{kind:'L',x:0,y:height},{kind:'Z'}]}; }
const tree=createDisplayTree('RGBMatrixConsumer');
tree.stage.addChild(tree.createRect({id:'Back',layer:0,transform:pose(),width:320,height:240,fill:[32/255,64/255,96/255,1]}));
const frame=tree.createFrame({id:'Frame',layer:1,transform:{...pose(8,8),rotation:0.015},width:296,height:162,fill:[0,0,0,0],clip:true});
const group=tree.createContainer({id:'Outer',layer:0,transform:pose(),mask:rectangleMask(290,160)});
const inner=tree.createContainer({id:'Inner',layer:0,transform:pose(),mask:rectangleMask(280,158)});
const effectIds=['Identity','Swap','Gray','TintSwap','Bias','Add','Linear','Nine','Tile'];
for (const [index,id] of effectIds.entries()) {
  const x=10+(index%3)*96,y=10+Math.floor(index/3)*52;
  const matrix=id==='Identity'?matrices.identity:id==='Gray'||id==='Tile'?matrices.gray:id==='Bias'?matrices.bias:matrices.swap;
  inner.addChild(tree.createSprite({id,layer:index,transform:pose(x,y),imageId:'RGBA',sourceRect:{x:0,y:0,width:3,height:3},
    width:id==='Tile'?96:72,height:36,opacity:1,anchorX:0,anchorY:0,sampling:id==='Linear'?'linear':'nearest',rgbMatrix:matrix,
    tint:id==='TintSwap'?[1,1,0.5]:[1,1,1],blendMode:id==='Add'?'add':'normal',
    ...(id==='Nine'?{slice:{left:1,right:1,top:1,bottom:1}}:{}),
    ...(id==='Tile'?{tile:{width:24,height:24,offsetX:0,offsetY:0}}:{})}));
}
group.addChild(inner);frame.addChild(group);tree.stage.addChild(frame);
// Glyph first detects a stale grayscale matrix; the plain Sprite then checks identity reset again.
tree.stage.addChild(tree.createGlyphRun({id:'Glyph',layer:2,transform:pose(20,195),atlasId:'GlyphAtlas',text:'I',baseline:0,opacity:1,sampling:'nearest',
  glyphs:[{sourceRect:{x:0,y:0,width:2,height:1},x:0,y:0,width:32,height:20,textStart:0,textEnd:1}]}));
tree.stage.addChild(tree.createSprite({id:'Plain',layer:3,transform:pose(80,195),imageId:'RGBA',sourceRect:{x:0,y:0,width:3,height:3},
  width:72,height:30,opacity:1,sampling:'nearest',anchorX:0,anchorY:0}));
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let requestedGeneration = 1;
let disposed = false;
/** @type {Session|null} */ let session = null;
/** @type {ReturnType<typeof sessionObservation>|null} */ let terminal = null;
/** @type {{code:string,retained:boolean}|null} */ let failure = null;
/** @type {{byteLength:number,filename:string}|null} */ let saved = null;
/** @type {{bytesEqualPrevious:boolean|null,commandsEqualPrevious:boolean|null,idsEqualPrevious:boolean|null}|null} */ let opened = null;
/** @type {{byteLength:number,width:number,height:number}|null} */ let png = null;
/** @type {string[]} */ const pointerLog = [];
/** @type {(()=>void)[]} */ const hostUnbind = [];
/** @type {'open'|'png'|null} */ let temporary = null;
/** @type {(()=>void)[]} */ const waiters = [];
const counts = { rendererCreated: 0, rendererDisposed: 0, liveRenderers: 0, maxRenderers: 0,
  binds: 0, unbinds: 0, pointerEvents: 0, edits: 0, errors: 0, ignored: 0, pngCanvases: 0, disposeCalls: 0,
  contextLosses: 0, contextRestores: 0 };
/** @typedef {{name:string,created:Set<object>,deleted:Set<object>,deleteCalls:number,isLive:(value:object)=>boolean}} Resource */
/** @type {{gl:WebGL2RenderingContext,resources:Resource[],lost:boolean}[]} */ const resourceContexts=[];
/** @param {HTMLCanvasElement} target */
function instrumentCanvas(target) {
  const native=target.getContext.bind(target);
  target.getContext=/** @type {HTMLCanvasElement['getContext']} */((/** @type {string} */ kind,/** @type {unknown} */ settings)=>{
    const result=native(kind,settings);
    if(kind==='webgl2'&&result){const gl=/** @type {WebGL2RenderingContext} */(result);
      if(!resourceContexts.some(record=>record.gl===gl)){
        /** @type {Resource[]} */const resources=[];
        const methods=/** @type {Record<string,unknown>} */(/** @type {unknown} */(gl));
        for(const [name,createName,deleteName,isName] of /** @type {const} */([
          ['shader','createShader','deleteShader','isShader'],['program','createProgram','deleteProgram','isProgram'],
          ['buffer','createBuffer','deleteBuffer','isBuffer'],['vao','createVertexArray','deleteVertexArray','isVertexArray'],
          ['texture','createTexture','deleteTexture','isTexture'],['framebuffer','createFramebuffer','deleteFramebuffer','isFramebuffer']
        ])){
          const create=/** @type {(...args:unknown[])=>object|null} */(methods[createName]);
          const remove=/** @type {(...args:unknown[])=>void} */(methods[deleteName]);
          const check=/** @type {(value:object)=>boolean} */(methods[isName]);
          /** @type {Resource} */const resource={name,created:new Set(),deleted:new Set(),deleteCalls:0,isLive:value=>check.call(gl,value)};
          methods[createName]=(/** @type {unknown[]} */...args)=>{const value=create.apply(gl,args);if(value)resource.created.add(value);return value;};
          methods[deleteName]=(/** @type {unknown[]} */...args)=>{resource.deleteCalls++;const value=args[0];if(value&&typeof value==='object')resource.deleted.add(value);return remove.apply(gl,args);};
          resources.push(resource);
        }
        resourceContexts.push({gl,resources,lost:false});
      }
    }
    return result;
  });
}
function resources() {return resourceContexts.map((record,index)=>({context:index,lost:record.gl.isContextLost(),everLost:record.lost,
  categories:Object.fromEntries(record.resources.map(resource=>{
    const nativeLive=record.gl.isContextLost()?0:[...resource.created].filter(value=>resource.isLive(value)).length;
    return[resource.name,{created:resource.created.size,deleteCalls:resource.deleteCalls,deleteRequested:resource.deleted.size,nativeLive,
      invalidWithoutDelete:Math.max(0,resource.created.size-resource.deleted.size-nativeLive)}];
  }))}));}
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const input = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
/** @param {unknown} error */
function codeOf(error) { return error instanceof Error && 'code' in error ? String(error.code) : error instanceof Error ? error.name : String(error); }
/** @param {number} token */
function current(token) { return !disposed && token === requestedGeneration; }
/** @param {Session} s @param {Point} viewport */
function sample(s, viewport) {
  const hit = s.renderer.hitTest(viewport)?.id ?? null, hits = s.renderer.hitTestAll(viewport).map(item => item.id);
  if (viewport.x < 0 || viewport.y < 0 || viewport.x >= 320 || viewport.y >= 240) return { viewport, rgba: null, hit, hits };
  const gl = s.canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable'); const bytes = new Uint8Array(4);
  if (gl.isContextLost()) return { viewport, rgba: null, hit, hits };
  gl.readPixels(Math.floor(viewport.x * 2), s.canvas.height - Math.floor(viewport.y * 2) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return { viewport, rgba: [...bytes], hit, hits };
}
/** @param {import('@barocss/canvas2d').DisplayTree} tree */
function getInner(tree) { const handle = tree.get('Inner'); if (handle?.kind !== 'container') throw new Error('Inner group missing'); return handle; }
/** @param {Session} s @param {string} id */
function getSprite(s,id) {const handle=s.tree.get(id);if(handle?.kind!=='sprite') throw new Error(`${id} Sprite missing`);return handle;}
/** @param {Session} s */
function pointsFor(s) {
  /** @type {Record<string,Point>} */ const points={};
  for(const id of [...effectIds,'Plain']) {
    const sprite=getSprite(s,id);
    for(const [part,x] of /** @type {const} */([['opaque',9],['partial',36],['transparent',63]])) {
      const localX=id==='Tile'?part==='opaque'?4:part==='partial'?12:20:id==='Nine'?part==='opaque'?0.4:part==='partial'?36:71.6:x;
      points[`${id}_${part}`]=s.renderer.worldToViewport(sprite.toWorld({x:localX,y:18}));
    }
  }
  points.Linear_filtered=s.renderer.worldToViewport(getSprite(s,'Linear').toWorld({x:18,y:18}));
  points.maskedTile=s.renderer.worldToViewport(getSprite(s,'Tile').toWorld({x:80,y:18}));
  points.glyphOpaque={x:28,y:205};points.glyphTransparent={x:44,y:205};points.background={x:300,y:230};return points;
}
/** @param {Session} s @param {string} id @param {Point} viewport */
function oracle(s,id,viewport) {
  const sprite=getSprite(s,id),node=sprite.data;
  // Readback selects this physical pixel center, not an arbitrary point on an edge.
  const world=s.renderer.viewportToWorld({x:(Math.floor(viewport.x*2)+0.5)/2,y:(Math.floor(viewport.y*2)+0.5)/2});
  const local=sprite.toLocal(world);let sx=local.x/node.width*3;
  if(node.tile) sx=((local.x-node.tile.offsetX)%node.tile.width+node.tile.width)%node.tile.width/node.tile.width*3;
  if(node.slice) sx=local.x<1?0.5:local.x>=node.width-1?2.5:1.5;
  const source=s.renderer.getImageAsset('RGBA');if(!source)throw new Error('RGBA asset missing');
  const pixel=(/** @type {number} */ x)=>Array.from(source.pixels.subarray(x*4,x*4+4),v=>v/255);
  let rgba;
  if(node.sampling==='linear'){const x=Math.max(0,Math.min(2,sx-0.5)),lo=Math.floor(x),hi=Math.min(2,lo+1),fraction=x-lo;
    const a=pixel(lo),b=pixel(hi);rgba=a.map((v,i)=>v*(1-fraction)+b[i]*fraction);
  }else rgba=pixel(Math.max(0,Math.min(2,Math.floor(sx))));
  const matrix=node.rgbMatrix??matrices.identity,tint=node.tint,alpha=rgba[3]*node.opacity*node.alpha;
  const rgb=[0,1,2].map(row=>Math.max(0,Math.min(1,Math.fround(matrix[row*4])*rgba[0]+Math.fround(matrix[row*4+1])*rgba[1]+
    Math.fround(matrix[row*4+2])*rgba[2]+Math.fround(matrix[row*4+3])))*tint[row]);
  const back=[32/255,64/255,96/255];
  return [...rgb.map((v,i)=>Math.round(Math.max(0,Math.min(1,v*alpha+back[i]*(node.blendMode==='add'?1:1-alpha)))*255)),255];
}
/** @param {Session} s */
function samplesFor(s) {
  return Object.fromEntries(Object.entries(pointsFor(s)).map(([key,point])=>{
    const result=sample(s,point),id=key.split('_')[0];
    if([...effectIds,'Plain'].includes(id)) {const expected=oracle(s,id,point);return[key,{...result,oracle:expected,
      withinTwo:!!result.rgba&&result.rgba.every((v,i)=>Math.abs(v-expected[i])<=2)}];}
    return[key,result];
  }));
}
/** @param {import('@barocss/canvas2d').DisplayHandle} handle @returns {string[]} */
function idsFor(handle){return[handle.id,...('children'in handle?handle.children.flatMap(idsFor):[])];}
/** @param {Session} s */
function sessionObservation(s) {
  return {generation:s.generation,version:s.scene.version,ids:s.tree.stage.children.flatMap(idsFor),
    matrices:Object.fromEntries([...effectIds,'Plain'].map(id=>[id,getSprite(s,id).data.rgbMatrix??null])),
    assetBytes:Object.fromEntries(Object.keys(assets).map(id=>[id,[...(s.renderer.getImageAsset(id)?.pixels??[])]])),
    samples:samplesFor(s),points:pointsFor(s),sceneMatchesTree:stringifySceneJSON(s.scene)===stringifySceneJSON(s.tree.snapshot()),
    contextLost:!!s.canvas.getContext('webgl2')?.isContextLost(),backing:{width:s.canvas.width,height:s.canvas.height}};
}
function observe() { return { disposed, requestedGeneration, temporary, counts: { ...counts }, resources:resources(), failure, saved, opened, png,
  pointerLog: [...pointerLog], accepted: session ? sessionObservation(session) : terminal }; }
function show(/** @type {string} */ message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2);
  for (const button of Array.from(document.querySelectorAll('button'))) button.disabled = disposed; input.disabled = disposed; }
function fingerprint() { return JSON.stringify(session ? { scene: stringifySceneJSON(session.scene), accepted: sessionObservation(session) } : null); }
function bind(/** @type {Session} */ s) {
  counts.binds++; const unsubscribe = s.tree.stage.onPointer('pointerdown', event => pointerLog.push(`g${s.generation}:stage:${event.target?.id ?? 'none'}`));
  /** @type {(()=>void)[]} */ const listeners = [unsubscribe];
  for (const id of ['Back','Frame','Outer','Inner',...effectIds,'Glyph','Plain']) {
    const handle = s.tree.get(id); if (handle) listeners.push(handle.onPointer('pointerdown', event => pointerLog.push(`g${s.generation}:${id}:${event.target?.id}`)));
  }
  const onPointer = (/** @type {PointerEvent} */ event) => {
    if (disposed || session !== s) return; counts.pointerEvents++; const rect = s.canvas.getBoundingClientRect();
    const viewport = { x: (event.clientX - rect.left) * 320 / rect.width, y: (event.clientY - rect.top) * 240 / rect.height };
    s.tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point: s.renderer.viewportToWorld(viewport), hit: s.renderer.hitTest(viewport) });
    show('Dispatched real pointerdown');
  };
  const onLoss = (/** @type {Event} */ event) => { event.preventDefault(); if (!disposed && session === s) {
    const gl=s.canvas.getContext('webgl2');const record=resourceContexts.find(record=>record.gl===gl);if(record)record.lost=true;
    counts.contextLosses++; show('Context lost; handles may be invalidated without explicit deletion'); } };
  const onRestore = () => { if (!disposed && session === s) { counts.contextRestores++; s.renderer.render(); show('Rendered accepted masks after context restoration'); } };
  s.canvas.addEventListener('pointerdown', onPointer);
  s.canvas.addEventListener('webglcontextlost', onLoss); s.canvas.addEventListener('webglcontextrestored', onRestore); let done = false;
  return () => { if (done) return; done = true; counts.unbinds++; s.canvas.removeEventListener('pointerdown', onPointer);
    s.canvas.removeEventListener('webglcontextlost', onLoss); s.canvas.removeEventListener('webglcontextrestored', onRestore); for (const stop of listeners) stop(); };
}
/** @param {unknown} error @param {string} before */
function refused(error, before) { counts.errors++; failure = { code: codeOf(error), retained: fingerprint() === before }; show(`Refused ${failure.code}`); return failure; }
/** @param {(sprite:import('@barocss/canvas2d').SpriteHandle)=>void} change */
function edit(change) {
  const s=session;if(!s||disposed)return false;const token=++requestedGeneration,before=fingerprint();
  /** @type {Session|null} */let next=null;let admitted=false;
  try{const tree=createDisplayTreeFromScene(s.scene),group=tree.get('Outer'),frame=tree.get('Frame'),sprite=tree.get('Swap');
    if(group?.kind!=='container'||frame?.kind!=='frame'||sprite?.kind!=='sprite')throw new Error('RGB fixture topology missing');
    change(sprite);const scene=tree.snapshot();s.renderer.updateScene(scene);admitted=true;s.renderer.render();
    next={...s,tree,group,frame,scene,generation:token,unbind:()=>{}};next.unbind=bind(next);session=next;s.unbind();counts.edits++;failure=null;show('Edited restored Swap matrix');return true;
  }catch(error){if(next&&session!==next)next.unbind();if(admitted&&session===s){try{s.renderer.updateScene(s.scene);s.renderer.render();}catch{}}
    refused(error,before);return false;}
}
function grayscale(){return edit(sprite=>sprite.setRGBMatrix(matrices.gray));}
function clear(){return edit(sprite=>sprite.setRGBMatrix(null));}
function reapply(){return edit(sprite=>sprite.setRGBMatrix(matrices.swap));}
function invalid(){const s=session;if(!s||disposed)return null;requestedGeneration++;const before=fingerprint();
  try{getSprite(s,'Swap').setRGBMatrix([5,0,0,0,0,1,0,0,0,0,1,0]);failure={code:'ACCEPTED',retained:fingerprint()===before};show('Invalid candidate admitted');return failure;
  }catch(error){return refused(error,before);}}
/** @type {WEBGL_lose_context|null} */let contextExtension=null;
function loseContext(){if(!session||disposed)return false;contextExtension=session.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')??null;
  if(!contextExtension)return false;contextExtension.loseContext();return true;}
function restoreContext(){if(disposed||!contextExtension)return false;contextExtension.restoreContext();return true;}
function releaseTemporary() { temporary = null; for (const resolve of waiters.splice(0)) resolve(); }
/** @param {number} token @param {'open'|'png'} operation */
async function acquireTemporary(token, operation) { while (temporary && current(token)) await new Promise(resolve => waiters.push(() => resolve(undefined)));
  if (!current(token)) return false; temporary = operation; return true; }
function disposeRenderer(/** @type {import('@barocss/canvas2d').Canvas2DRenderer} */ renderer) { renderer.dispose(); counts.rendererDisposed++; counts.liveRenderers--; }
/** @param {import('@barocss/canvas2d').DisplayTree} tree @param {Map<string,import('@barocss/canvas2d').ImageAssetInput>} images @param {number} token */
function fresh(tree, images, token) {
  const group = tree.get('Outer'), frame = tree.get('Frame');
  if (group?.kind !== 'container' || frame?.kind !== 'frame') throw new Error('Frame or MaskGroup missing');
  const nextCanvas = document.createElement('canvas'); nextCanvas.id = 'scene';
  instrumentCanvas(nextCanvas);
  const renderer = createCanvas2D(nextCanvas, options); counts.rendererCreated++; counts.liveRenderers++;
  counts.maxRenderers = Math.max(counts.maxRenderers, counts.liveRenderers);
  try { for (const [id, image] of images) renderer.setImageAsset(id, image);
    const scene = tree.snapshot(); renderer.updateScene(scene); renderer.render();
    return { canvas: nextCanvas, renderer, tree, group, frame, scene, generation: token, unbind: () => {} };
  } catch (error) { disposeRenderer(renderer); throw error; }
}
function adopt(/** @type {Session} */ next) { next.unbind = bind(next); const old = session;
  canvas.replaceWith(next.canvas); canvas = next.canvas; session = next; failure = null; contextExtension = null; if (old) { old.unbind(); disposeRenderer(old.renderer); } }
/** @param {string} text @param {number|null} reservedToken */
async function openText(text, reservedToken = null) {
  if (disposed) return; const token = reservedToken ?? ++requestedGeneration; if (!current(token)) return;
  const before = fingerprint(), previous = session; let acquired = false;
  /** @type {Session|null} */ let next = null;
  try {
    const parsed = await parseCanvasDocument(text); if (!current(token)) { counts.ignored++; return; }
    const tree = createDisplayTreeFromScene(parsed.scene), group = tree.get('Outer'), frame = tree.get('Frame');
    if(parsed.scene.version!==27||group?.kind!=='container'||frame?.kind!=='frame'||getInner(tree).kind!=='container'||parsed.assets.size!==2||
      !parsed.assets.has('RGBA')||!parsed.assets.has('GlyphAtlas'))throw new Error('RGB document topology differs');
    for(const id of [...effectIds,'Plain'])if(tree.get(id)?.kind!=='sprite')throw new Error(`${id} Sprite missing`);
    if(tree.get('Glyph')?.kind!=='glyphRun')throw new Error('Glyph missing');
    acquired = await acquireTemporary(token, 'open'); if (!acquired || !current(token)) { counts.ignored++; return; }
    next = fresh(tree, parsed.assets, token);
    const prior = previous && sessionObservation(previous);
    const now = sessionObservation(next);
    opened = { bytesEqualPrevious: prior ? JSON.stringify(prior.assetBytes) === JSON.stringify(now.assetBytes) : null,
      commandsEqualPrevious: prior ? JSON.stringify(prior.matrices) === JSON.stringify(now.matrices) : null,
      idsEqualPrevious: prior ? JSON.stringify(prior.ids) === JSON.stringify(now.ids) : null };
    adopt(next); releaseTemporary(); acquired = false; show('Opened Scene27 matrices and authoritative asset bytes on a fresh canvas');
  } catch (error) { if (next && session !== next) { next.unbind(); disposeRenderer(next.renderer); }
    if (current(token)) refused(error, before); else counts.ignored++;
  } finally { if (acquired) releaseTemporary(); }
}
function serialize(/** @type {Session} */ s) { return serializeCanvasDocument(s.scene, id => s.renderer.getImageAsset(id)); }
function download(/** @type {Blob} */ blob, /** @type {string} */ name) { const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function save() { const s = session; if (!s || disposed) return; const token = requestedGeneration;
  const text = await serialize(s); if (!current(token) || session !== s) return;
  const filename = 'rgb-matrix-document.json'; download(new Blob([text], { type: 'application/json' }), filename);
  saved = { filename, byteLength: new TextEncoder().encode(text).length }; show('Saved accepted RGB matrix scene and assets'); return text; }
async function exportPNG() {
  const s = session; if (!s || disposed) return; const token = requestedGeneration; let acquired = false;
  try { const text = await serialize(s); if (!current(token) || session !== s) return;
    acquired = await acquireTemporary(token, 'png'); if (!acquired || !current(token) || session !== s) return;
    const result = await exportCanvasDocumentPNG(text, options, () => { if (!current(token)) throw new Error('PNG canceled'); counts.pngCanvases++;
      const target=document.createElement('canvas');instrumentCanvas(target);return target; });
    if (!current(token) || session !== s) return; releaseTemporary(); acquired = false;
    download(result.blob, 'rgb-matrix.png'); png = { byteLength: result.blob.size, width: result.backingSize.width, height: result.backingSize.height };
    show('Exported accepted RGB matrix scene to PNG'); return png;
  } catch (error) { if (current(token)) show(`PNG failed: ${codeOf(error)}`); }
  finally { if (acquired) releaseTemporary(); }
}
function dispose() { counts.disposeCalls++; if (disposed) return; const s = session;
  if (s) { terminal = sessionObservation(s); s.unbind(); disposeRenderer(s.renderer); } session = null; disposed = true; requestedGeneration++;
  for (const resolve of waiters.splice(0)) resolve(); for (const remove of hostUnbind.splice(0)) remove(); show('Disposed RGB matrix fixture and listeners'); }
const actions={gray:grayscale,clear,reapply,invalid,lose:loseContext,context:restoreContext,save:()=>{void save().catch(error=>show(`Save failed: ${codeOf(error)}`));},png:()=>{void exportPNG();},dispose};
for (const [id, action] of Object.entries(actions)) { const button = document.querySelector(`#${id}`); button?.addEventListener('click', action);
  hostUnbind.push(() => button?.removeEventListener('click', action)); }
const onOpen = () => { const file = input.files?.[0]; if (!file || disposed) return; const token = ++requestedGeneration, before = fingerprint();
  void file.text().then(text => { if (!current(token)) { counts.ignored++; return; } return openText(text, token); })
    .catch(error => { if (current(token)) refused(error, before); }); input.value = ''; };
input.addEventListener('change', onOpen); hostUnbind.push(() => input.removeEventListener('change', onOpen));
Object.defineProperty(window,'rgbMatrixFixture',{value:Object.freeze({observe,grayscale,clear,reapply,invalid,save,openText,exportPNG,loseContext,restoreContext,dispose,
  get canvas(){return canvas;},points(){return session?pointsFor(session):null;},samples(){return session?samplesFor(session):null;},
  /** @param {Point} point */probe(point){return session?sample(session,point):null;},
  documentText(){return session?serialize(session):Promise.resolve(null);},debug(){return session?{scene:structuredClone(session.scene)}:null;}
}),writable:false,configurable:false});
adopt(fresh(tree, new Map(Object.entries(assets)), requestedGeneration)); show('Ready: sampled RGB matrix, tint, alpha and reset interiors');
