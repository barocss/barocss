// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON, trimImageAsset, Canvas2DError } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 120, height: 120 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const atlas = { width: 2, height: 2, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 0, 0, 0,
  0, 0, 255, 255, 0, 255, 0, 255,
]) };
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const bordered = { width: 5, height: 4, pixels: new Uint8Array([
  7,8,9,0, 7,8,9,0, 7,8,9,0, 7,8,9,0, 7,8,9,0,
  7,8,9,0, 255,0,0,255, 10,20,30,0, 0,255,0,128, 7,8,9,0,
  7,8,9,0, 0,0,255,255, 255,0,255,64, 255,255,255,1, 7,8,9,0,
  7,8,9,0, 7,8,9,0, 7,8,9,0, 7,8,9,0, 7,8,9,0,
]) };
/** @param {import('@barocss/canvas2d').ImageAssetInput} asset */
function copyAsset(asset) { return { width: asset.width, height: asset.height, pixels: new Uint8Array(asset.pixels) }; }
/** @param {import('@barocss/canvas2d').Canvas2DRenderer} target @param {string} id */
function registeredAsset(target, id) { const asset = target.getImageAsset(id); if (!asset) throw new Error('Registered image missing'); return asset; }
function active() { if (disposed) throw new Canvas2DError('DISPOSED', 'host disposed'); }
let tree = createDisplayTree('SizeConsumer');
let team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(0, 0) });
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(10, 20),
  width: 100, height: 80, fill: [1, 1, 0, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(60, 60),
  imageId: 'Atlas', width: 40, height: 40, opacity: 1, sampling: 'nearest',
  anchorX: 0.5, anchorY: 0.5 });
tree.stage.addChild(team); team.addChild(back); team.addChild(sprite);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
/** @typedef {{created:number,deleted:number,objects:object[],live:()=>number}} Resource */
/** @type {{gl:WebGL2RenderingContext,lost:boolean,calls:{draw:number,read:number},resources:Record<string,Resource>}[]} */const contexts=[];
/** @param {HTMLCanvasElement} canvas */
function instrument(canvas){const get=canvas.getContext.bind(canvas);canvas.getContext=/** @type {HTMLCanvasElement['getContext']} */((/** @type {string} */kind,/** @type {any} */attrs)=>{const gl=/** @type {WebGL2RenderingContext|null} */(get(/** @type {'webgl2'} */(kind),attrs));if(kind==='webgl2'&&gl&&!contexts.some(c=>c.gl===gl)){const c={gl,lost:false,calls:{draw:0,read:0},resources:/** @type {Record<string,Resource>} */({})};contexts.push(c);canvas.addEventListener('webglcontextlost',()=>{c.lost=true;});for(const [name,create,del,is] of [['shader','createShader','deleteShader','isShader'],['program','createProgram','deleteProgram','isProgram'],['buffer','createBuffer','deleteBuffer','isBuffer'],['vao','createVertexArray','deleteVertexArray','isVertexArray'],['texture','createTexture','deleteTexture','isTexture'],['fbo','createFramebuffer','deleteFramebuffer','isFramebuffer']]){const raw=/** @type {any} */(gl),a=raw[create].bind(gl),b=raw[del].bind(gl),test=raw[is].bind(gl);const r={created:0,deleted:0,objects:/** @type {object[]} */([]),live:()=>r.objects.filter(v=>test(v)).length};c.resources[name]=r;raw[create]=/** @param {...any} args */(...args)=>{const v=a(...args);if(v){r.created++;r.objects.push(v);}return v;};raw[del]=(/** @type {object|null} */v)=>{if(v)r.deleted++;return b(v);};}for(const [name,key] of [['drawArrays','draw'],['readPixels','read']]){const raw=/** @type {any} */(gl),f=raw[name].bind(gl);raw[name]=/** @param {...any} args */(...args)=>{c.calls[/** @type {'draw'|'read'} */(key)]++;return f(...args);};}}return gl;});return canvas;}
instrument(canvas);
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', atlas);
/** @type {Map<string, import('@barocss/canvas2d').ImageAssetInput>} */
let hostAssets = new Map([['Atlas', registeredAsset(renderer, 'Atlas')]]);
/** @type {import('@barocss/canvas2d').Scene} */
let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1, borderedLoads = 0, trimPreparations = 0, candidates = 0, opens = 0, edits = 0, saves = 0, pngs = 0;
let disposed = false, binds = 0, unbinds = 0;
/** @type {{offsetX:number,offsetY:number}|null} */ let lastTrim = null;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[30, 50], [50, 50], [70, 50], [30, 70], [50, 70], [70, 70], [50, 30]];

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
  return { generation, disposed, borderedLoads, trimPreparations, candidates, opens, edits, saves, pngs, binds, unbinds, lastTrim: lastTrim && {...lastTrim}, contextId: accepted.contextId, sceneVersion: accepted.version, spriteData: sprite.data, size: [sprite.data.width, sprite.data.height],
    scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()),
    assetBytes: [...(hostAssets.get(sprite.data.imageId)?.pixels ?? [])],
    assets: Object.fromEntries([...hostAssets].map(([id, asset]) => [id, { width: asset.width, height: asset.height, pixels: [...asset.pixels] }])),
    contexts: contexts.map(c => ({ lost: c.lost, calls: {...c.calls}, error: c.gl.getError(), resources: Object.fromEntries(Object.entries(c.resources).map(([k,r]) => [k,{created:r.created,deleted:r.deleted,live:r.live()}])) })),
    samples: disposed ? [] : samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y),
      hit: renderer.hitTest({ x, y })?.id ?? null })), pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
  team.onPointer('pointerdown', () => pointerLog.push('Team'));
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
  current.addEventListener('pointerdown', onPointer); binds++;
  let removed = false;
  return () => { if (removed) return; removed = true; current.removeEventListener('pointerdown', onPointer); unbinds++; };
}
/** @param {string} message */
function submit(message) {
  active(); const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message);
}
/** @param {number} width @param {number} height */
function setSize(width, height) { active(); sprite.setSize(width, height); submit(`Size ${width} × ${height}`); }
function invalid() {
  active();
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { sprite.setSize(80, 0); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected size ${code}; retained ${JSON.stringify(observe()) === before}`);
  return code;
}
async function documentText() { return serializeCanvasDocument(accepted, id => hostAssets.get(id) ?? null); }
async function save() {
  active(); const text = await documentText(); saves++;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'sprite-size-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`); return text;
}
/** @param {string} text */
async function openText(text) {
  active(); const fresh = instrument(document.createElement('canvas')); fresh.id = 'scene'; candidates++;
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').ContainerHandle} */ let nextTeam;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextBack;
  /** @type {import('@barocss/canvas2d').SpriteHandle} */ let nextSprite;
  /** @type {Map<string, import('@barocss/canvas2d').ImageAssetInput>} */ let nextAssets;
  try {
    active();
    if (!staged.assets.has('Atlas')) staged.renderer.setImageAsset('Atlas', atlas);
    nextAssets = new Map([...new Set([...staged.assets.keys(), 'Atlas'])].map(id => [id, registeredAsset(staged.renderer, id)]));
    nextTree = createDisplayTreeFromScene(staged.scene);
    const group = nextTree.get('Team'), background = nextTree.get('Back'), image = nextTree.get('Sprite');
    if (group?.kind !== 'container' || background?.kind !== 'rect' || image?.kind !== 'sprite' ||
        group.children.length !== 2 || !group.children.includes(background) || !group.children.includes(image)) {
      throw new Error('Document does not contain the consumer objects');
    }
    nextTeam = group; nextBack = background; nextSprite = image;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer; hostAssets = nextAssets;
  tree = nextTree; team = nextTeam; back = nextBack; sprite = nextSprite;
  accepted = /** @type {import('@barocss/canvas2d').Scene} */ (staged.scene);
  generation++; opens++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened editable resized sprite');
}
/** @param {import('@barocss/canvas2d').DisplayTree} nextTree @param {Map<string, import('@barocss/canvas2d').ImageAssetInput>} assets */
function adoptPrepared(nextTree, assets) {
  const group = nextTree.get('Team'), background = nextTree.get('Back'), image = nextTree.get('Sprite');
  if (group?.kind !== 'container' || background?.kind !== 'rect' || image?.kind !== 'sprite') throw new Error('Consumer objects missing');
  const fresh = instrument(document.createElement('canvas')); fresh.id = 'scene'; candidates++;
  const nextRenderer = createCanvas2D(fresh, options);
  /** @type {Map<string, import('@barocss/canvas2d').ImageAssetInput>} */ let snapshots;
  try {
    for (const [id, asset] of assets) nextRenderer.setImageAsset(id, asset);
    nextRenderer.updateScene(nextTree.snapshot()); nextRenderer.render(); active();
    snapshots = new Map([...assets.keys()].map(id => [id, registeredAsset(nextRenderer, id)]));
  } catch (error) { nextRenderer.dispose(); throw error; }
  // Admit the copied tree, renderer and independent CPU assets before swapping.
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = nextRenderer; hostAssets = snapshots;
  tree = nextTree; team = group; back = background; sprite = image; accepted = tree.snapshot();
  generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
}
function loadBordered() {
  active(); const nextTree = createDisplayTreeFromScene(accepted), image = nextTree.get('Sprite');
  if (image?.kind !== 'sprite') throw new Error('Consumer Sprite missing');
  image.setImageSource('Bordered', {x:0,y:0,width:5,height:4}); image.setAnchor(0,0); image.setSize(80,80); image.setPosition(20,20);
  const assets = new Map(hostAssets); assets.set('Bordered', bordered);
  adoptPrepared(nextTree, assets); borderedLoads++; lastTrim = null; show('Loaded bordered 5×4 image');
}
/** @param {import('@barocss/canvas2d').ImageAssetInput} [input] */
function trim(input = bordered) {
  active(); const result = trimImageAsset(input);
  if (!result) return null; // A valid empty result does not create or mutate a candidate.
  const nextTree = createDisplayTreeFromScene(accepted), image = nextTree.get('Sprite');
  if (image?.kind !== 'sprite') throw new Error('Consumer Sprite missing');
  const prior = image.data, crop = prior.sourceRect;
  const preservePlacement = input === bordered && prior.imageId === 'Bordered' &&
    crop?.x === 0 && crop.y === 0 && crop.width === 5 && crop.height === 4 &&
    prior.anchorX === 0 && prior.anchorY === 0 &&
    prior.transform.scaleX === 1 && prior.transform.scaleY === 1 && prior.transform.rotation === 0 &&
    (!prior.pivot || (prior.pivot.x === 0 && prior.pivot.y === 0)) && !prior.slice && !prior.tile;
  const scaleX = preservePlacement ? prior.width / 5 : 16;
  const scaleY = preservePlacement ? prior.height / 4 : 20;
  const x = preservePlacement ? prior.transform.x : 20;
  const y = preservePlacement ? prior.transform.y : 20;
  image.setImageSource('Trimmed', {x:0,y:0,width:result.asset.width,height:result.asset.height}); image.setAnchor(0,0);
  image.setSize(result.asset.width * scaleX, result.asset.height * scaleY);
  image.setPosition(x + result.offsetX * scaleX,y + result.offsetY * scaleY);
  const assets = new Map(hostAssets); assets.set('Trimmed', result.asset);
  adoptPrepared(nextTree, assets); trimPreparations++; lastTrim = {offsetX:result.offsetX,offsetY:result.offsetY}; show('Trimmed alpha bounds without moving visible pixels'); return result;
}
function edit() { active(); sprite.setPosition(8,0); edits++; submit('Moved restored Sprite'); }
async function png() {
  active(); const result = await exportCanvasDocumentPNG(await documentText(), options, () => instrument(document.createElement('canvas')));
  const url = URL.createObjectURL(result.blob), link = document.createElement('a'); link.href = url; link.download = 'sprite-size.png'; link.click(); pngs++;
  setTimeout(() => URL.revokeObjectURL(url),1000); show('Exported PNG');
}
function dispose() { if (disposed) return; disposed = true; unbind(); renderer.dispose(); document.querySelectorAll('button').forEach(button => {button.disabled = true;}); openInput.disabled = true; show('Disposed'); }
subscribe(); unbind = bind();
document.querySelector('#wide')?.addEventListener('click', () => setSize(80, 40));
document.querySelector('#tall')?.addEventListener('click', () => setSize(40, 80));
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#bordered')?.addEventListener('click', loadBordered);
document.querySelector('#trim')?.addEventListener('click', () => trim());
document.querySelector('#edit')?.addEventListener('click', edit);
document.querySelector('#png')?.addEventListener('click', () => {void png();});
document.querySelector('#dispose')?.addEventListener('click', dispose);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __sizeConsumer: { observe, setSize, invalid, save, openText, loadBordered, trim, edit, png, dispose, documentText, contexts,
  original: () => copyAsset(atlas), bordered: () => copyAsset(bordered), tree: () => tree,
  assets: () => new Map([...hostAssets].map(([id, asset]) => [id, copyAsset(asset)])),
  asset: () => {const asset = hostAssets.get(sprite.data.imageId); return asset && copyAsset(asset);},
  get renderer() {return renderer;},
  get canvas() { return canvas; } } });
show('Ready with 40 × 40 centered sprite');
