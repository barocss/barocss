// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON, extrudeImageAsset, Canvas2DError } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const image = { width: 2, height: 1, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 0, 255, 255,
]) };
let tree = createDisplayTree('SamplingConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(10, 10),
  width: 70, height: 60, fill: [1, 1, 0, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20),
  imageId: 'Atlas', width: 40, height: 30, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0, tint: [1, 1, 1] });
tree.stage.addChild(back); tree.stage.addChild(sprite);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
/** @typedef {{created:number,deleted:number,objects:object[],live:()=>number}} Resource */
/** @type {{gl:WebGL2RenderingContext,lost:boolean,calls:{draw:number,read:number},resources:Record<string,Resource>}[]} */const contexts=[];
/** @param {HTMLCanvasElement} canvas */
function instrument(canvas){const get=canvas.getContext.bind(canvas);canvas.getContext=/** @type {HTMLCanvasElement['getContext']} */((/** @type {string} */kind,/** @type {any} */attrs)=>{const gl=/** @type {WebGL2RenderingContext|null} */(get(/** @type {'webgl2'} */(kind),attrs));if(kind==='webgl2'&&gl&&!contexts.some(c=>c.gl===gl)){const c={gl,lost:false,calls:{draw:0,read:0},resources:/** @type {Record<string,Resource>} */({})};contexts.push(c);canvas.addEventListener('webglcontextlost',()=>{c.lost=true;});for(const [name,create,del,is] of [['shader','createShader','deleteShader','isShader'],['program','createProgram','deleteProgram','isProgram'],['buffer','createBuffer','deleteBuffer','isBuffer'],['vao','createVertexArray','deleteVertexArray','isVertexArray'],['texture','createTexture','deleteTexture','isTexture'],['fbo','createFramebuffer','deleteFramebuffer','isFramebuffer']]){const raw=/** @type {any} */(gl),a=raw[create].bind(gl),b=raw[del].bind(gl),test=raw[is].bind(gl);const r={created:0,deleted:0,objects:/** @type {object[]} */([]),live:()=>r.objects.filter(v=>test(v)).length};c.resources[name]=r;raw[create]=/** @param {...any} args */(...args)=>{const v=a(...args);if(v){r.created++;r.objects.push(v);}return v;};raw[del]=(/** @type {object|null} */v)=>{if(v)r.deleted++;return b(v);};}for(const [name,key] of [['drawArrays','draw'],['readPixels','read']]){const raw=/** @type {any} */(gl),f=raw[name].bind(gl);raw[name]=/** @param {...any} args */(...args)=>{c.calls[/** @type {'draw'|'read'} */(key)]++;return f(...args);};}}return gl;});return canvas;}
instrument(canvas);
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', image);
/** @param {import('@barocss/canvas2d').Canvas2DRenderer} target @param {string} id */
function registeredAsset(target,id) {const asset=target.getImageAsset(id);if(!asset)throw new Error('Registered image missing');return asset;}
/** @type {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */
let hostAssets=new Map([['Atlas',registeredAsset(renderer,'Atlas')]]);
/** @param {import('@barocss/canvas2d').ImageAssetInput} asset */
function copyAsset(asset){return {width:asset.width,height:asset.height,pixels:new Uint8Array(asset.pixels)};}
function active(){if(disposed)throw new Canvas2DError('DISPOSED','host disposed');}
/** @type {import('@barocss/canvas2d').Scene} */
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation=1, extrusions=0, candidates=0, opens=0, edits=0, saves=0, pngs=0;
let disposed=false, binds=0, unbinds=0;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[30, 30], [39, 30], [50, 30], [65, 30]];
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
  return {generation,disposed,extrusions,candidates,opens,edits,saves,pngs,binds,unbinds,contextId:accepted.contextId,scene:stringifySceneJSON(accepted),treeScene:stringifySceneJSON(tree.snapshot()),sceneVersion: accepted.version, sampling: sprite.data.sampling,
    spriteData: sprite.data, acceptedSampling: accepted.nodes[1]?.kind === 'image'
      ? accepted.nodes[1].sampling : null,
    assetBytes:[...(hostAssets.get(sprite.data.imageId)?.pixels??[])],
    assets:Object.fromEntries([...hostAssets].map(([id,asset])=>[id,{width:asset.width,height:asset.height,pixels:[...asset.pixels]}])),
    contexts:contexts.map(c=>({lost:c.lost,calls:{...c.calls},error:c.gl.getError(),resources:Object.fromEntries(Object.entries(c.resources).map(([k,r])=>[k,{created:r.created,deleted:r.deleted,live:r.live()}]))})),
    samples:disposed?[]:samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y),
      hit: renderer.hitTest({ x, y })?.id ?? null })), pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
  tree.stage.onPointer('pointerdown', () => pointerLog.push('stage'));
}
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const onPointer = event => {
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * options.logicalSize.width / bounds.width,
      y: (event.clientY - bounds.top) * options.logicalSize.height / bounds.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
      point, hit: renderer.hitTest(point) });
    show('Dispatched pointerdown');
  };
  current.addEventListener('pointerdown',onPointer);binds++;let removed=false;
  return ()=>{if(removed)return;removed=true;current.removeEventListener('pointerdown',onPointer);unbinds++;};
}
/** @param {string} message */
function submit(message) {
  active(); const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message);
}
/** @param {'nearest' | 'linear'} sampling */
function setSampling(sampling) { active(); sprite.setSampling(sampling); submit(`Sampling ${sampling}`); }
function stableObservation() {
  const { contexts: diagnostics, ...stable } = observe();
  return JSON.stringify(stable);
}
function invalid() {
  active();
  const before = stableObservation();
  let code = 'ACCEPTED';
  try { sprite.setSampling(/** @type {'nearest'} */ (/** @type {unknown} */ ('cubic'))); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected ${code}; retained ${stableObservation() === before}`);
  return code;
}
async function documentText(){return serializeCanvasDocument(accepted,id=>hostAssets.get(id)??null);}
async function save() {
  active();const text=await documentText();saves++;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = 'sprite-sampling-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);return text;
}
/** @param {string} text */
async function openText(text) {
  active();const fresh=instrument(document.createElement('canvas'));fresh.id='scene';candidates++;
  fresh.width = options.logicalSize.width * options.dpr;
  fresh.height = options.logicalSize.height * options.dpr;
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').SpriteHandle} */ let nextSprite;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextBack;
  /** @type {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */ let nextAssets;
  try {
    active();
    nextTree = createDisplayTreeFromScene(staged.scene);
    const imageNode = nextTree.get('Sprite'), underlay = nextTree.get('Back');
    const bytes=imageNode?.kind==='sprite'?staged.renderer.getImageAsset(imageNode.data.imageId)?.pixels:null;
    if (imageNode?.kind !== 'sprite' || underlay?.kind !== 'rect' || !bytes) {
      throw new Error('Document image or display objects differ');
    }
    if(!staged.assets.has('Atlas'))staged.renderer.setImageAsset('Atlas',image);
    nextAssets=new Map([...new Set([...staged.assets.keys(),'Atlas'])].map(id=>[id,registeredAsset(staged.renderer,id)]));
    nextSprite = imageNode; nextBack = underlay;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;hostAssets=nextAssets;
  tree = nextTree; sprite = nextSprite; back = nextBack;
  accepted = staged.scene;
  generation++;opens++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show(`Opened Scene v${accepted.version} sampling`);
}
/** @param {number} [gutter] @param {import('@barocss/canvas2d').ImageAssetInput} [input] */
function extrude(gutter=1,input=image){
  active();const prepared=extrudeImageAsset(input,gutter);
  const nextTree=createDisplayTreeFromScene(accepted),nextSprite=nextTree.get('Sprite'),nextBack=nextTree.get('Back');
  if(nextSprite?.kind!=='sprite'||nextBack?.kind!=='rect')throw new Error('Consumer display objects missing');
  nextSprite.setImageSource('Extruded',{x:0,y:0,width:prepared.width,height:prepared.height});nextSprite.setSampling('nearest');
  const fresh=instrument(document.createElement('canvas'));fresh.id='scene';candidates++;
  const nextRenderer=createCanvas2D(fresh,options),assets=new Map(hostAssets);assets.set('Extruded',prepared);
  /** @type {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */ let snapshots;
  try{for(const[id,asset]of assets)nextRenderer.setImageAsset(id,asset);nextRenderer.updateScene(nextTree.snapshot());nextRenderer.render();active();snapshots=new Map([...assets.keys()].map(id=>[id,registeredAsset(nextRenderer,id)]));}
  catch(error){nextRenderer.dispose();throw error;}
  // Admit copied tree, renderer and independent CPU snapshots before swapping.
  unbind();const old=renderer;canvas.replaceWith(fresh);canvas=fresh;renderer=nextRenderer;hostAssets=snapshots;
  tree=nextTree;sprite=nextSprite;back=nextBack;accepted=tree.snapshot();generation++;extrusions++;pointerLog=[];subscribe();unbind=bind();old.dispose();show('Extruded one-pixel edge gutter');return prepared;
}
function edit(){active();sprite.setPosition(8,0);edits++;submit('Moved restored Sprite');}
async function png(){active();const result=await exportCanvasDocumentPNG(await documentText(),options,()=>instrument(document.createElement('canvas')));const url=URL.createObjectURL(result.blob),link=document.createElement('a');link.href=url;link.download='sprite-sampling.png';link.click();pngs++;setTimeout(()=>URL.revokeObjectURL(url),1000);show('Exported PNG');}
function dispose(){if(disposed)return;disposed=true;unbind();renderer.dispose();document.querySelectorAll('button').forEach(button=>{button.disabled=true;});openInput.disabled=true;show('Disposed');}
subscribe(); unbind = bind();
document.querySelector('#nearest')?.addEventListener('click', () => setSampling('nearest'));
document.querySelector('#linear')?.addEventListener('click', () => setSampling('linear'));
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#extrude')?.addEventListener('click',()=>extrude());
document.querySelector('#edit')?.addEventListener('click',edit);
document.querySelector('#png')?.addEventListener('click',()=>{void png();});
document.querySelector('#dispose')?.addEventListener('click',dispose);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __spriteSamplingConsumer: {observe,setSampling,invalid,save,openText,extrude,edit,png,dispose,documentText,contexts,
  original:()=>copyAsset(image),asset:()=>{const asset=hostAssets.get(sprite.data.imageId);return asset&&copyAsset(asset);},assets:()=>new Map([...hostAssets].map(([id,asset])=>[id,copyAsset(asset)])),tree:()=>tree,
  get renderer(){return renderer;},
  get canvas() { return canvas; } } });
show('Ready with nearest sampling');
