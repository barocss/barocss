// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON,
  compositeImageAssets } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 120, height: 120 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const atlasA = { width: 2, height: 2, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 0, 0, 0,
  0, 0, 255, 255, 0, 255, 0, 255,
]) };
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const atlasB = { width: 2, height: 2, pixels: new Uint8Array([
  255, 0, 255, 255, 0, 0, 0, 0,
  0, 255, 255, 255, 255, 255, 255, 255,
]) };
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const foreground = { width: 2, height: 2, pixels: new Uint8Array([
  255, 0, 255, 128, 0, 255, 255, 128,
  255, 255, 255, 0, 255, 255, 255, 128,
]) };
/** @typedef {{created:number,deleted:number,objects:object[],live:()=>number}} Resource */
/** @type {{gl:WebGL2RenderingContext,lost:boolean,calls:{draw:number,read:number},resources:Record<string,Resource>}[]} */
const contexts = [];
/** @param {HTMLCanvasElement} target */
function instrument(target) {
  const get = target.getContext.bind(target);
  target.getContext = /** @type {HTMLCanvasElement['getContext']} */ ((/** @type {string} */ kind, /** @type {any} */ attrs) => {
    const gl = /** @type {WebGL2RenderingContext|null} */ (get(/** @type {'webgl2'} */ (kind), attrs));
    if (kind === 'webgl2' && gl && !contexts.some(item => item.gl === gl)) {
      const item = { gl, lost: false, calls: { draw: 0, read: 0 }, resources: /** @type {Record<string,Resource>} */ ({}) };
      contexts.push(item); target.addEventListener('webglcontextlost', () => { item.lost = true; });
      for (const [name, create, remove, test] of [
        ['shader','createShader','deleteShader','isShader'], ['program','createProgram','deleteProgram','isProgram'],
        ['buffer','createBuffer','deleteBuffer','isBuffer'], ['vao','createVertexArray','deleteVertexArray','isVertexArray'],
        ['texture','createTexture','deleteTexture','isTexture'], ['fbo','createFramebuffer','deleteFramebuffer','isFramebuffer'],
      ]) {
        const raw = /** @type {any} */ (gl), allocate = raw[create].bind(gl), release = raw[remove].bind(gl), isLive = raw[test].bind(gl);
        const resource = { created: 0, deleted: 0, objects: /** @type {object[]} */ ([]), live: () => resource.objects.filter(value => isLive(value)).length };
        item.resources[name] = resource;
        raw[create] = /** @param {...any} args */ (...args) => { const value = allocate(...args); if (value) { resource.created++; resource.objects.push(value); } return value; };
        raw[remove] = (/** @type {object|null} */ value) => { if (value) resource.deleted++; return release(value); };
      }
      for (const [name, key] of [['drawArrays','draw'], ['readPixels','read']]) {
        const raw = /** @type {any} */ (gl), call = raw[name].bind(gl);
        raw[name] = /** @param {...any} args */ (...args) => { item.calls[/** @type {'draw'|'read'} */ (key)]++; return call(...args); };
      }
    }
    return gl;
  });
  return target;
}
/** @param {import('@barocss/canvas2d').ImageAssetInput} asset */
function copyAsset(asset) { return { width: asset.width, height: asset.height, pixels: new Uint8Array(asset.pixels) }; }
/** @param {import('@barocss/canvas2d').Canvas2DRenderer} current @param {Iterable<string>} ids */
function snapshotAssets(current, ids) {
  /** @type {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */ const result = new Map();
  for (const id of ids) { const asset = current.getImageAsset(id); if (asset) result.set(id, asset); }
  return result;
}

let tree = createDisplayTree('ImageSourceConsumer');
let team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(0, 0) });
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(20, 20), width: 80, height: 80, fill: [1, 1, 0, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20),
  imageId: 'AtlasA', width: 80, height: 80, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0, sourceRect: { x: 0, y: 0, width: 1, height: 1 } });
tree.stage.addChild(team); team.addChild(back); team.addChild(sprite);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(instrument(canvas), options);
renderer.setImageAsset('AtlasA', atlasA); renderer.setImageAsset('AtlasB', atlasB);
let hostAssets = snapshotAssets(renderer, ['AtlasA', 'AtlasB']);
/** @type {import('@barocss/canvas2d').Scene} */
let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1, disposed = false, composePreparations = 0, opens = 0, edits = 0, saves = 0, pngs = 0;
let binds = 0, unbinds = 0, pointerEvents = 0, candidateAttempts = 0, candidateAccepted = 0, candidateRefused = 0;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[30, 30], [70, 30], [30, 70], [70, 70]];
function active() { if (disposed) throw new Error('consumer disposed'); }
/** @returns {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */
function assets() { return new Map([...hostAssets].map(([id, asset]) => [id, copyAsset(asset)])); }
/** @param {number} x @param {number} y */
function pixel(x, y) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 context missing');
  const bytes = new Uint8Array(4);
  gl.readPixels(x * options.dpr, canvas.height - y * options.dpr - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
function observe() {
  const registered = Object.fromEntries([...hostAssets].map(([id, asset]) => [id, { width: asset.width, height: asset.height, pixels: [...asset.pixels] }]));
  return { generation, disposed, composePreparations, opens, edits, saves, pngs, binds, unbinds, pointerEvents,
    candidates: { attempted: candidateAttempts, accepted: candidateAccepted, refused: candidateRefused },
    imageId: sprite.data.imageId, crop: sprite.data.sourceRect ?? null, spriteData: sprite.data,
    sceneVersion: accepted.version, contextId: accepted.contextId,
    scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()), assets: registered,
    assetA: registered.AtlasA?.pixels ?? null, assetB: registered.AtlasB?.pixels ?? null,
    composite: registered.Composite ?? null, compositeBytes: registered.Composite?.pixels ?? null,
    samples: disposed ? [] : samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null })),
    pointerLog: [...pointerLog],
    contexts: contexts.map(item => ({ lost: item.lost, calls: { ...item.calls }, error: item.gl.getError(),
      resources: Object.fromEntries(Object.entries(item.resources).map(([key, resource]) => [key, { created: resource.created, deleted: resource.deleted, live: resource.live() }])) })) };
}
/** @param {ReturnType<typeof observe>} observation @param {string} text */
function retentionKey(observation, text) {
  const { contexts: diagnostics, ...state } = observation; void diagnostics;
  return JSON.stringify({ ...state, document: text });
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
  team.onPointer('pointerdown', () => pointerLog.push('Team'));
  tree.stage.onPointer('pointerdown', () => pointerLog.push('stage'));
}
function bind() {
  const current = canvas; let removed = false;
  /** @param {PointerEvent} event */
  const onPointer = event => {
    pointerEvents++;
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * options.logicalSize.width / bounds.width,
      y: (event.clientY - bounds.top) * options.logicalSize.height / bounds.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point, hit: renderer.hitTest(point) });
    show('Dispatched pointerdown');
  };
  current.addEventListener('pointerdown', onPointer); binds++;
  return () => { if (!removed) { removed = true; current.removeEventListener('pointerdown', onPointer); unbinds++; } };
}
/** @param {string} message */
function submit(message) { active(); const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message); }
/** @param {string} imageId @param {import('@barocss/canvas2d').SourceRect|null} [crop] */
function setImageSource(imageId, crop = null) {
  active(); const prior = sprite.data;
  sprite.setImageSource(imageId, crop);
  const next = tree.snapshot();
  try { renderer.updateScene(next); }
  catch (error) {
    sprite.setImageSource(prior.imageId, prior.sourceRect ?? null);
    throw error;
  }
  accepted = next; renderer.render(); show(`Image ${imageId}${crop ? ' cropped' : ' full'}`);
}
async function documentText() { return serializeCanvasDocument(accepted, id => hostAssets.get(id) ?? null); }
/** @param {string} imageId @param {import('@barocss/canvas2d').SourceRect|null} [crop] */
async function rejected(imageId, crop = null) {
  active(); const prior = sprite.data, before = retentionKey(observe(), await documentText());
  sprite.setImageSource(imageId, crop); let code = 'ACCEPTED';
  try { renderer.updateScene(tree.snapshot()); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  sprite.setImageSource(prior.imageId, prior.sourceRect ?? null);
  const after = retentionKey(observe(), await documentText());
  show(`Renderer refused ${code}; retained ${after === before}`); return code;
}
function removeA() { active(); renderer.removeImageAsset('AtlasA'); hostAssets.delete('AtlasA'); show('Removed unused AtlasA'); }
function registerA() { active(); renderer.setImageAsset('AtlasA', atlasA); hostAssets.set('AtlasA', /** @type {import('@barocss/canvas2d').ImageAssetInput} */ (renderer.getImageAsset('AtlasA'))); show('Registered AtlasA'); }
/** @param {import('@barocss/canvas2d').DisplayTree} nextTree
 * @param {import('@barocss/canvas2d').ContainerHandle} nextTeam
 * @param {import('@barocss/canvas2d').RectHandle} nextBack
 * @param {import('@barocss/canvas2d').SpriteHandle} nextSprite
 * @param {HTMLCanvasElement} fresh @param {import('@barocss/canvas2d').Canvas2DRenderer} nextRenderer
 * @param {Map<string,import('@barocss/canvas2d').ImageAssetInput>} nextAssets
 * @param {import('@barocss/canvas2d').Scene} nextScene */
function adopt(nextTree, nextTeam, nextBack, nextSprite, fresh, nextRenderer, nextAssets, nextScene) {
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = nextRenderer;
  tree = nextTree; team = nextTeam; back = nextBack; sprite = nextSprite;
  hostAssets = nextAssets; accepted = nextScene;
  generation++; candidateAccepted++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
}
/** @param {import('@barocss/canvas2d').ImageAssetInput} [background]
 * @param {import('@barocss/canvas2d').ImageAssetInput} [front] */
function compose(background = atlasA, front = foreground) {
  active(); const prepared = compositeImageAssets(background, front);
  const nextTree = createDisplayTreeFromScene(accepted);
  const group = nextTree.get('Team'), backgroundNode = nextTree.get('Back'), image = nextTree.get('Sprite');
  if (group?.kind !== 'container' || backgroundNode?.kind !== 'rect' || image?.kind !== 'sprite') throw new Error('Consumer objects missing');
  image.setImageSource('Composite', { x: 0, y: 0, width: prepared.width, height: prepared.height });
  const nextInputs = assets();
  if (!nextInputs.has('AtlasA')) nextInputs.set('AtlasA', atlasA);
  if (!nextInputs.has('AtlasB')) nextInputs.set('AtlasB', atlasB);
  nextInputs.set('Composite', prepared);
  const fresh = instrument(document.createElement('canvas')); fresh.id = 'scene'; candidateAttempts++;
  /** @type {import('@barocss/canvas2d').Canvas2DRenderer|undefined} */ let candidate;
  /** @type {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */ let nextAssets;
  const nextScene = nextTree.snapshot();
  try {
    candidate = createCanvas2D(fresh, options);
    for (const [id, asset] of nextInputs) candidate.setImageAsset(id, asset);
    candidate.updateScene(nextScene); candidate.render();
    // Snapshot renderer-owned copies; a caller may later mutate the returned preparation.
    nextAssets = snapshotAssets(candidate, nextInputs.keys());
  } catch (error) { candidate?.dispose(); candidateRefused++; throw error; }
  adopt(nextTree, group, backgroundNode, image, fresh, candidate, nextAssets, nextScene);
  composePreparations++; show('Composed foreground over AtlasA'); return prepared;
}
async function save() {
  active(); const text = await documentText(); active();
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = document.createElement('a');
  link.href = url; link.download = 'sprite-image-source-document.json'; link.click(); saves++;
  setTimeout(() => URL.revokeObjectURL(url), 1000); show(`Saved ${new TextEncoder().encode(text).length} bytes`); return text;
}
/** @param {string} text */
async function openText(text) {
  active(); const fresh = instrument(document.createElement('canvas')); fresh.id = 'scene'; candidateAttempts++;
  /** @type {import('@barocss/canvas2d/document').StagedCanvasDocument|undefined} */ let staged;
  try {
    staged = await stageCanvasDocument(text, fresh, options);
    if (disposed) throw new Error('consumer disposed');
    const nextTree = createDisplayTreeFromScene(staged.scene);
    const group = nextTree.get('Team'), background = nextTree.get('Back'), image = nextTree.get('Sprite');
    if (group?.kind !== 'container' || background?.kind !== 'rect' || image?.kind !== 'sprite' ||
        group.children.length !== 2 || !group.children.includes(background) || !group.children.includes(image)) {
      throw new Error('Document does not contain the consumer objects');
    }
    if (!staged.renderer.getImageAsset('AtlasA')) staged.renderer.setImageAsset('AtlasA', atlasA);
    if (!staged.renderer.getImageAsset('AtlasB')) staged.renderer.setImageAsset('AtlasB', atlasB);
    const ids = new Set([...staged.assets.keys(), 'AtlasA', 'AtlasB']);
    const nextAssets = snapshotAssets(staged.renderer, ids);
    adopt(nextTree, group, background, image, fresh, staged.renderer, nextAssets, /** @type {import('@barocss/canvas2d').Scene} */ (staged.scene));
  } catch (error) { staged?.renderer.dispose(); candidateRefused++; throw error; }
  opens++; show('Opened editable sprite image source');
}
function edit() { active(); sprite.setPosition(8, 0); edits++; submit('Moved restored Sprite'); }
async function png() {
  active(); const text = await documentText(); active();
  const result = await exportCanvasDocumentPNG(text, options, () => instrument(document.createElement('canvas')));
  active(); const url = URL.createObjectURL(result.blob), link = document.createElement('a');
  link.href = url; link.download = 'sprite-image-composite.png'; link.click(); pngs++;
  setTimeout(() => URL.revokeObjectURL(url), 1000); show('Exported PNG'); return result;
}
function dispose() {
  if (disposed) return; disposed = true; unbind(); renderer.dispose();
  document.querySelectorAll('button').forEach(button => { button.disabled = true; }); openInput.disabled = true; show('Disposed');
}
subscribe(); unbind = bind();
const actions = {
  'switch-b': () => setImageSource('AtlasB'), 'crop-b': () => setImageSource('AtlasB', { x: 1, y: 1, width: 1, height: 1 }),
  missing: () => rejected('Missing'), outside: () => rejected('AtlasB', { x: 2, y: 0, width: 1, height: 1 }),
  'remove-a': removeA, 'register-a': registerA, 'switch-a': () => setImageSource('AtlasA'),
  compose: () => compose(), edit, save, png, dispose,
};
for (const [id, action] of Object.entries(actions)) document.querySelector('#' + id)?.addEventListener('click', () => {
  void Promise.resolve().then(async () => { await action(); }).catch(error => show(`Action failed: ${error.code ?? 'ERROR'}`));
});
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`)); openInput.value = '';
});
Object.assign(window, { __imageSourceConsumer: { observe, retentionKey, setImageSource, rejected, removeA, registerA,
  compose, save, openText, documentText, edit, png, dispose, assets, contexts,
  originalA: () => copyAsset(atlasA), originalB: () => copyAsset(atlasB), foreground: () => copyAsset(foreground),
  get renderer() { return renderer; }, get tree() { return tree; }, get sprite() { return sprite; }, get canvas() { return canvas; } } });
show('Ready with cropped AtlasA');
