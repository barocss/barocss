// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene,
  createSpriteAnimation, createSpriteAtlas, packSpriteAtlas, createTicker, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';

/** @typedef {{created:number,deleted:number,objects:object[],live:()=>number}} Resource */
/** @type {{gl:WebGL2RenderingContext,lost:boolean,calls:{draw:number,read:number},resources:Record<string,Resource>}[]} */const contexts=[];
/** @param {HTMLCanvasElement} canvas */
function instrument(canvas){const get=canvas.getContext.bind(canvas);canvas.getContext=/** @type {HTMLCanvasElement['getContext']} */((/** @type {string} */kind,/** @type {any} */attrs)=>{const gl=/** @type {WebGL2RenderingContext|null} */(get(/** @type {'webgl2'} */(kind),attrs));if(kind==='webgl2'&&gl&&!contexts.some(c=>c.gl===gl)){const c={gl,lost:false,calls:{draw:0,read:0},resources:/** @type {Record<string,Resource>} */({})};contexts.push(c);canvas.addEventListener('webglcontextlost',()=>{c.lost=true;});for(const [name,create,del,is] of [['shader','createShader','deleteShader','isShader'],['program','createProgram','deleteProgram','isProgram'],['buffer','createBuffer','deleteBuffer','isBuffer'],['vao','createVertexArray','deleteVertexArray','isVertexArray'],['texture','createTexture','deleteTexture','isTexture'],['fbo','createFramebuffer','deleteFramebuffer','isFramebuffer']]){const raw=/** @type {any} */(gl),a=raw[create].bind(gl),b=raw[del].bind(gl),test=raw[is].bind(gl);const r={created:0,deleted:0,objects:/** @type {object[]} */([]),live:()=>r.objects.filter(v=>test(v)).length};c.resources[name]=r;raw[create]=/** @param {...any} args */(...args)=>{const v=a(...args);if(v){r.created++;r.objects.push(v);}return v;};raw[del]=(/** @type {object|null} */v)=>{if(v)r.deleted++;return b(v);};}for(const [name,key] of [['drawArrays','draw'],['readPixels','read']]){const raw=/** @type {any} */(gl),f=raw[name].bind(gl);raw[name]=/** @param {...any} args */(...args)=>{c.calls[/** @type {'draw'|'read'} */(key)]++;return f(...args);};}}return gl;});return canvas;}

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
let atlasImage = { width: 3, height: 1, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 0,
]) };
let entries = [
  { name: 'Red', sourceRect: { x: 0, y: 0, width: 1, height: 1 }, durationMS: 40 },
  { name: 'Blue', sourceRect: { x: 1, y: 0, width: 1, height: 1 }, durationMS: 60 },
  { name: 'Clear', sourceRect: { x: 2, y: 0, width: 1, height: 1 }, durationMS: 20 },
];
let sheet = createSpriteAtlas('Atlas', { width: 3, height: 1 }, entries);
let frames = sheet.sequence(['Red', 'Blue', 'Clear']);
let tree = createDisplayTree('SpriteAtlasConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(10, 10),
  width: 70, height: 60, fill: [1, 1, 0, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20),
  imageId: 'Atlas', sourceRect: { x: 0, y: 0, width: 1, height: 1 },
  width: 50, height: 50, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
tree.stage.addChild(back); tree.stage.addChild(sprite);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(instrument(canvas), options);
renderer.setImageAsset('Atlas', atlasImage);
let animation = createSpriteAnimation(sprite, frames);
/** @type {import('@barocss/canvas2d').Scene} */
let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1, packCalls=0, disposed=false, binds=0, unbinds=0, pointerEvents=0;
let packed=false;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[35, 40], [60, 40]];

/** @type {{token:number, callback:(timestampMS:number)=>void}|null} */ let pending = null;
let nextToken = 0;
let clockMS = 0;
const scheduler = {
  /** @param {(timestampMS:number)=>void} callback */
  requestFrame(callback) {
    if (pending) throw new Error('one pending frame expected');
    const token = ++nextToken; pending = { token, callback }; return token;
  },
  /** @param {unknown} token */
  cancelFrame(token) { if (pending?.token === token) pending = null; },
};
let ticker = createTicker(scheduler);

/** @param {number} x @param {number} y */
function pixel(x, y) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 context missing');
  const bytes = new Uint8Array(4);
  gl.readPixels(x * options.dpr, canvas.height - y * options.dpr - 1,
    1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
function observe() {
  return { generation, frameIndex: animation.frameIndex, playing: animation.playing,
    tickerRunning: ticker.running, imageId: sprite.data.imageId,
    sourceRect: sprite.data.sourceRect ?? null, scene: stringifySceneJSON(accepted),
    treeScene: stringifySceneJSON(tree.snapshot()),
    packed,packCalls,disposed,binds,unbinds,pointerEvents,asset: {width:atlasImage.width,height:atlasImage.height,bytes:atlasImage.pixels.length},contexts:contexts.map(c=>({lost:c.lost,calls:{...c.calls},error:c.gl.getError(),resources:Object.fromEntries(Object.entries(c.resources).map(([k,r])=>[k,{created:r.created,deleted:r.deleted,live:r.live()}]))})),
    samples: disposed ? [] : samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y),
      hit: renderer.hitTest({ x, y })?.id ?? null })), pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
  tree.stage.onPointer('pointerdown', () => pointerLog.push('stage'));
}
function bind() {
  const current = canvas; binds++; let removed=false;
  /** @param {PointerEvent} event */
  const onPointer = event => {
    pointerEvents++;
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * options.logicalSize.width / bounds.width,
      y: (event.clientY - bounds.top) * options.logicalSize.height / bounds.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
      point, hit: renderer.hitTest(point) });
    show('Dispatched pointerdown');
  };
  current.addEventListener('pointerdown', onPointer);
  return () => {if(!removed){removed=true;current.removeEventListener('pointerdown', onPointer);unbinds++;}};
}
function bindTicker() {
  ticker.onTick(info => {
    if (animation.advance(info.deltaMS)) {
      accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
    }
    show(`Tick ${info.deltaMS} ms`);
  });
}
bindTicker();
/** @param {number} milliseconds */
function tick(milliseconds) {
  if (!pending) throw new Error('ticker is not waiting for a frame');
  const current = pending; pending = null; clockMS += milliseconds;
  current.callback(clockMS);
}
function start() { animation.play(); ticker.start(); show('Started'); }
function pause() { ticker.stop(); animation.pause(); show('Paused'); }
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'sprite-atlas-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {import('@barocss/canvas2d').SpriteAtlas} catalog
 * @param {import('@barocss/canvas2d').SourceRect|null|undefined} crop
 * @param {boolean} hasGold */
function selectSavedAtlasFrame(catalog, crop, hasGold) {
  const frames = catalog.sequence(['Red', 'Blue', 'Clear']);
  /** @param {import('@barocss/canvas2d').SpriteAnimationFrame} frame */
  const matches = frame => {
    const source = frame.sourceRect;
    return !!source && !!crop && source.x === crop.x && source.y === crop.y &&
      source.width === crop.width && source.height === crop.height;
  };
  const initialFrameIndex = frames.findIndex(matches);
  if (initialFrameIndex >= 0) return { frames, initialFrameIndex };
  if (hasGold) {
    const gold = catalog.frame('Gold');
    if (matches(gold)) return { frames: [...frames, gold], initialFrameIndex: 3 };
  }
  throw new Error('Document does not contain the saved animation frame');
}
/** @param {string} text */
async function openText(text) {
  if (disposed) throw new Error('consumer disposed');
  const fresh = instrument(document.createElement('canvas')); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  if (disposed) {
    staged.renderer.dispose();
    throw new Error('consumer disposed');
  }
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').SpriteHandle} */ let nextSprite;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextBack;
  /** @type {import('@barocss/canvas2d').SpriteAnimation} */ let nextAnimation;
  /** @type {import('@barocss/canvas2d').SpriteAtlas} */ let nextSheet;
  let nextInitialFrameIndex = 0;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const image = nextTree.get('Sprite'), underlay = nextTree.get('Back');
    if (image?.kind !== 'sprite' || underlay?.kind !== 'rect' ||
        image.data.imageId !== 'Atlas') {
      throw new Error('Document does not contain the saved animation frame');
    }
    nextSprite = image; nextBack = underlay;
    const reopened = staged.renderer.getImageAsset('Atlas');
    if (!reopened || reopened.width !== atlasImage.width || reopened.height !== atlasImage.height ||
        reopened.pixels.some((byte, index) => byte !== atlasImage.pixels[index])) {
      throw new Error('Document atlas bytes differ');
    }
    nextSheet = createSpriteAtlas('Atlas', { width: reopened.width, height: reopened.height }, entries);
    const selected = selectSavedAtlasFrame(nextSheet, nextSprite.data.sourceRect,
      entries.some(entry => entry.name === 'Gold'));
    nextInitialFrameIndex = selected.initialFrameIndex;
    nextAnimation = createSpriteAnimation(nextSprite, selected.frames,
      { initialFrameIndex: selected.initialFrameIndex });
  } catch (error) { staged.renderer.dispose(); throw error; }
  ticker.dispose(); animation.dispose(); unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; sprite = nextSprite; back = nextBack; animation = nextAnimation; sheet=nextSheet;
  accepted = /** @type {import('@barocss/canvas2d').Scene} */ (staged.scene);
  generation++; pointerLog = []; clockMS = 0; pending = null;
  ticker = createTicker(scheduler); bindTicker(); subscribe(); unbind = bind(); old.dispose();
  show(`Opened saved frame ${nextInitialFrameIndex}`);
}
/** @param {number} width @param {number} height @param {number[]} rgba */
function solid(width,height,rgba){const pixels=new Uint8Array(width*height*4);for(let i=0;i<pixels.length;i+=4)pixels.set(rgba,i);return {width,height,pixels};}
function inputs(){return [
 {name:'Red',asset:solid(3,2,[255,0,0,255]),durationMS:40},
 {name:'Blue',asset:solid(2,3,[0,0,255,255]),durationMS:60},
 {name:'Clear',asset:solid(1,2,[0,255,0,0]),durationMS:20},
 {name:'Gold',asset:solid(4,1,[255,0,255,128]),durationMS:80},
];}
/** @param {number} maxWidth */
function pack(maxWidth=5){if(disposed)throw new Error('consumer disposed');const candidate=packSpriteAtlas('Atlas',inputs(),maxWidth);const nextFrames=candidate.atlas.sequence(['Red','Blue','Clear']);pause();renderer.setImageAsset('Atlas',candidate.asset);animation.dispose();animation=createSpriteAnimation(sprite,nextFrames);atlasImage=candidate.asset;sheet=candidate.atlas;frames=nextFrames;entries=['Red','Blue','Clear','Gold'].map(name=>{const f=sheet.frame(name);if(!f.sourceRect)throw new Error('packed crop missing');return {name,sourceRect:f.sourceRect,durationMS:f.durationMS};});packed=true;packCalls++;(/** @type {HTMLButtonElement} */(document.querySelector('#gold'))).disabled=false;accepted=tree.snapshot();renderer.updateScene(accepted);renderer.render();show('Packed four images into a 5 by 5 atlas');return candidate;}
async function documentText(){return serializeCanvasDocument(accepted,id=>renderer.getImageAsset(id));}
function editGold(){pause();const crop=sheet.frame('Gold').sourceRect;if(!crop)throw new Error('Gold crop missing');sprite.setSourceRect(crop);accepted=tree.snapshot();renderer.updateScene(accepted);renderer.render();show('Edited restored Sprite to Gold');}
async function png(){const text=await documentText(),result=await exportCanvasDocumentPNG(text,options,()=>instrument(document.createElement('canvas'))),url=URL.createObjectURL(result.blob),a=document.createElement('a');a.href=url;a.download='packed-atlas.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return {bytes:result.blob.size,size:result.backingSize};}
function dispose(){if(disposed)return;ticker.dispose();animation.dispose();unbind();renderer.dispose();disposed=true;document.querySelectorAll('button').forEach(button=>{button.disabled=true;});openInput.disabled=true;show('Disposed');}
subscribe(); unbind = bind();
document.querySelector('#pack')?.addEventListener('click',()=>pack());
document.querySelector('#gold')?.addEventListener('click',editGold);
document.querySelector('#png')?.addEventListener('click',()=>{void png();});
document.querySelector('#dispose')?.addEventListener('click',dispose);
document.querySelector('#start')?.addEventListener('click', start);
document.querySelector('#tick40')?.addEventListener('click', () => tick(40));
document.querySelector('#tick60')?.addEventListener('click', () => tick(60));
document.querySelector('#tick20')?.addEventListener('click', () => tick(20));
document.querySelector('#pause')?.addEventListener('click', pause);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __spriteAtlasConsumer: { observe, start, pause, tick, save, openText, pack, inputs, editGold, png, dispose, documentText, contexts,
  get renderer(){return renderer;}, get tree(){return tree;}, get sprite(){return sprite;}, get catalog(){return sheet;}, get asset(){return atlasImage;},
  get canvas() { return canvas; } } });
show('Ready at frame 0');
