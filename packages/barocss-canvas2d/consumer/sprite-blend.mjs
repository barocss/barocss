// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON, applyImageAlphaMask, applyImageColorKey } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';

/** @typedef {{created:number,deleted:number,objects:object[],live:()=>number}} Resource */
/** @type {{canvas:HTMLCanvasElement,gl:WebGL2RenderingContext,lost:boolean,calls:{draw:number,read:number},resources:Record<string,Resource>,offDiagnostic:()=>void}[]} */
const contexts = [];
/** @param {HTMLCanvasElement} target */
function instrument(target) {
  const get = target.getContext.bind(target);
  target.getContext = /** @type {HTMLCanvasElement['getContext']} */ ((/** @type {string} */ kind, /** @type {any} */ attrs) => {
    const gl = /** @type {WebGL2RenderingContext|null} */ (get(/** @type {'webgl2'} */ (kind), attrs));
    if (kind === 'webgl2' && gl && !contexts.some(item => item.gl === gl)) {
      const onLost = () => { item.lost = true; };
      let removed = false;
      const item = { canvas: target, gl, lost: false, calls: { draw: 0, read: 0 }, resources: /** @type {Record<string,Resource>} */ ({}), offDiagnostic: () => { if (!removed) { removed = true; target.removeEventListener('webglcontextlost', onLost); } } };
      contexts.push(item); target.addEventListener('webglcontextlost', onLost);
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
/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const keyMode = new URLSearchParams(location.search).get('key') === '1';
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const image = keyMode ? { width: 3, height: 2, pixels: new Uint8Array([40,160,80,255,35,165,75,128,34,160,80,255,46,160,80,64,40,160,86,1,7,8,9,0]) } : { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 128]) };
/** @type {import('@barocss/canvas2d').ImageRGBKey} */ const keyRGB = [40,160,80];
const keyTolerance = 5;
/** @type {import('@barocss/canvas2d').SpriteAlphaMask} */
const alphaMask = [0, 0, 0, 0.5];
/** @param {import('@barocss/canvas2d').ImageAssetInput} value @returns {import('@barocss/canvas2d').ImageAssetInput} */
function copyAsset(value) { return { width: value.width, height: value.height, pixels: new Uint8Array(value.pixels) }; }
/** @param {import('@barocss/canvas2d').Canvas2DRenderer} r @param {Iterable<string>} ids @returns {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */
function snapshotAssets(r, ids) { const result = new Map(); for (const id of ids) { const asset = r.getImageAsset(id); if (asset) result.set(id, asset); } return result; }
let tree = createDisplayTree('BlendConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(10, 10), width: 80, height: 60, fill: [0.25, 0.25, 0.25, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20), imageId: 'Atlas', width: 30, height: 30, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
let follower = tree.createSprite({ id: 'Follower', layer: 2, transform: pose(55, 20), imageId: 'Atlas', width: 30, height: 30, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0, tint: [1, 1, 1] });
if (keyMode) { sprite.setSourceRect({x:0,y:0,width:3,height:2}); follower.setSourceRect({x:0,y:0,width:3,height:2}); }
tree.stage.addChild(back); tree.stage.addChild(sprite); tree.stage.addChild(follower);
/** @type {HTMLCanvasElement} */ let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(instrument(canvas), options); renderer.setImageAsset('Atlas', image);
let hostAssets = snapshotAssets(renderer, ['Atlas']);
/** @type {import('@barocss/canvas2d').Scene} */ let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1, disposed = false, keyPreparations = 0, maskPreparations = 0, opens = 0, edits = 0, saves = 0, pngs = 0;
let binds = 0, unbinds = 0, pointerEvents = 0, candidateAttempts = 0, candidateAccepted = 0, candidateRefused = 0;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
/** @type {import('@barocss/canvas2d').ImageAssetInput|null} */ let lastKeyResult = null;
/** @type {Array<()=>void>} */ const controlOff = [];
/** @type {()=>void} */ let routesUnbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[30, 30], [65, 30], [87, 30]];
function active() { if (disposed) throw new Error('consumer disposed'); }
/** @returns {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */
function assets() { return new Map([...hostAssets].map(([id, asset]) => [id, copyAsset(asset)])); }
/** @param {number} x @param {number} y */
function pixel(x, y) { const gl = canvas.getContext('webgl2'); if (!gl) throw new Error('WebGL2 context missing'); const bytes = new Uint8Array(4); gl.readPixels(x * 2, canvas.height - y * 2 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return [...bytes]; }
function observe() { const registered = Object.fromEntries([...hostAssets].map(([id, asset]) => [id, { width: asset.width, height: asset.height, pixels: [...asset.pixels] }])); return { generation, disposed, keyMode, keyPreparations, maskPreparations, opens, edits, saves, pngs, binds, unbinds, pointerEvents,
  candidates: { attempted: candidateAttempts, accepted: candidateAccepted, refused: candidateRefused }, sceneVersion: accepted.version, contextId: accepted.contextId,
  blendMode: sprite.data.blendMode, followerMode: follower.data.blendMode, acceptedMode: accepted.nodes[1]?.kind === 'image' && 'blendMode' in accepted.nodes[1] ? accepted.nodes[1].blendMode : null, imageId: sprite.data.imageId, sourceRect: sprite.data.sourceRect ?? null, spriteData: sprite.data, followerData: follower.data,
  scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()), assets: registered, assetBytes: registered.Atlas?.pixels ?? null, fadedBytes: registered.Faded?.pixels ?? null, keyedBytes: registered.Keyed?.pixels ?? null,
  samples: disposed ? [] : samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null })), pointerLog: [...pointerLog],
  contexts: contexts.map(c => ({ lost: c.lost, calls: { ...c.calls }, error: c.gl.getError(), resources: Object.fromEntries(Object.entries(c.resources).map(([k, r]) => [k, { created: r.created, deleted: r.deleted, live: r.live() }])) })) }; }
/** @param {ReturnType<typeof observe>} value @param {string} text */
function retentionKey(value, text) { const { contexts: diagnostics, ...state } = value; void diagnostics; return JSON.stringify({ ...state, document: text }); }
/** @param {string} message */ function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function clearRoutes() { routesUnbind(); routesUnbind = () => {}; }
/** @param {import('@barocss/canvas2d').DisplayTree} ownerTree @param {import('@barocss/canvas2d').SpriteHandle} ownerSprite */
function subscribeTo(ownerTree, ownerSprite) {
  /** @type {Array<()=>void>} */ const off = [];
  try {
    off.push(ownerSprite.onPointer('pointerdown', () => { if (!disposed && tree === ownerTree) pointerLog.push('Sprite'); }));
    off.push(ownerTree.stage.onPointer('pointerdown', () => { if (!disposed && tree === ownerTree) pointerLog.push('stage'); }));
  } catch (error) { for (const remove of off) remove(); throw error; }
  let removed = false;
  return () => { if (!removed) { removed = true; for (const remove of off) remove(); } };
}
function subscribe() { routesUnbind = subscribeTo(tree, sprite); }
/** @param {HTMLCanvasElement} current @param {import('@barocss/canvas2d').DisplayTree} ownerTree @param {import('@barocss/canvas2d').Canvas2DRenderer} ownerRenderer */
function bindTo(current, ownerTree, ownerRenderer) {
  let removed = false;
  /** @param {PointerEvent} event */ const on = event => {
    if (disposed || canvas !== current) return;
    const bounds = current.getBoundingClientRect(); pointerEvents++;
    const point = { x: (event.clientX - bounds.left) * 100 / bounds.width, y: (event.clientY - bounds.top) * 80 / bounds.height };
    ownerTree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point, hit: ownerRenderer.hitTest(point) }); show('Dispatched pointerdown');
  };
  try { current.addEventListener('pointerdown', on); }
  catch (error) { current.removeEventListener('pointerdown', on); throw error; }
  binds++;
  return () => { if (!removed) { removed = true; current.removeEventListener('pointerdown', on); unbinds++; } };
}
function bind() { return bindTo(canvas, tree, renderer); }
/** @param {HTMLCanvasElement} target */
function closeDiagnostic(target) { for (const context of contexts) if (context.canvas === target) context.offDiagnostic(); }
/** @param {import('@barocss/canvas2d').Canvas2DRenderer|undefined} value @param {HTMLCanvasElement} target */
function closeRenderer(value, target) { try { value?.dispose(); } finally { closeDiagnostic(target); } }
/** @param {string} message */ function submit(message) { active(); const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message); }
/** @param {'normal'|'add'} mode */ function setBlendMode(mode) { active(); sprite.setBlendMode(mode); submit(`Blend ${mode}`); }
async function invalid() { active(); const before = retentionKey(observe(), await documentText()); let code = 'ACCEPTED'; try { sprite.setBlendMode(/** @type {'add'} */ (/** @type {unknown} */ ('multiply'))); } catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; } const after = retentionKey(observe(), await documentText()); show(`Rejected ${code}; retained ${after === before}`); return code; }
/** @param {import('@barocss/canvas2d').DisplayTree} nextTree @param {import('@barocss/canvas2d').RectHandle} nextBack @param {import('@barocss/canvas2d').SpriteHandle} nextSprite @param {import('@barocss/canvas2d').SpriteHandle} nextFollower @param {HTMLCanvasElement} fresh @param {import('@barocss/canvas2d').Canvas2DRenderer} nextRenderer @param {Map<string,import('@barocss/canvas2d').ImageAssetInput>} nextAssets @param {import('@barocss/canvas2d').Scene} nextScene */
function adopt(nextTree, nextBack, nextSprite, nextFollower, fresh, nextRenderer, nextAssets, nextScene) {
  /** @type {()=>void} */ let nextRoutes = () => {}, nextPointer = () => {};
  try { nextRoutes = subscribeTo(nextTree, nextSprite); nextPointer = bindTo(fresh, nextTree, nextRenderer); canvas.replaceWith(fresh); }
  catch (error) { nextPointer(); nextRoutes(); throw error; }
  const old = renderer, oldCanvas = canvas, oldPointer = unbind, oldRoutes = routesUnbind;
  canvas = fresh; renderer = nextRenderer; tree = nextTree; back = nextBack; sprite = nextSprite; follower = nextFollower; hostAssets = nextAssets; accepted = nextScene;
  unbind = nextPointer; routesUnbind = nextRoutes; generation++; candidateAccepted++; pointerLog = [];
  oldPointer(); oldRoutes(); closeRenderer(old, oldCanvas);
}
/** @param {import('@barocss/canvas2d').ImageAssetInput} [asset] @param {import('@barocss/canvas2d').SpriteAlphaMask} [matrix] */
function mask(asset = image, matrix = alphaMask) { active(); const prepared = applyImageAlphaMask(asset, matrix); const nextTree = createDisplayTreeFromScene(accepted), nextBack = nextTree.get('Back'), nextSprite = nextTree.get('Sprite'), nextFollower = nextTree.get('Follower'); if (nextBack?.kind !== 'rect' || nextSprite?.kind !== 'sprite' || nextFollower?.kind !== 'sprite') throw new Error('Consumer objects missing');
  nextSprite.setImageSource('Faded', { x: 0, y: 0, width: prepared.width, height: prepared.height }); nextSprite.setTint([1, 1, 1]); nextSprite.setRGBMatrix(null); nextSprite.setAlphaMask(null); nextSprite.setOpacity(1); nextSprite.setBlendMode('normal'); nextFollower.setSourceRect({ x: 0, y: 0, width: image.width, height: image.height });
  const inputs = assets(); if (!inputs.has('Atlas')) inputs.set('Atlas', image); inputs.set('Faded', prepared); const fresh = instrument(document.createElement('canvas')); fresh.id = 'scene'; candidateAttempts++;
  /** @type {import('@barocss/canvas2d').Canvas2DRenderer|undefined} */ let candidate; const nextScene = nextTree.snapshot();
  try { candidate = createCanvas2D(fresh, options); for (const [id, asset] of inputs) candidate.setImageAsset(id, asset); candidate.updateScene(nextScene); candidate.render(); const nextAssets = snapshotAssets(candidate, inputs.keys()); adopt(nextTree, nextBack, nextSprite, nextFollower, fresh, candidate, nextAssets, nextScene); }
  catch (error) { if (candidate !== renderer) closeRenderer(candidate, fresh); candidateRefused++; throw error; }
  maskPreparations++; show('Prepared image alpha'); return prepared; }
/** @param {import('@barocss/canvas2d').ImageAssetInput} [asset] @param {import('@barocss/canvas2d').ImageRGBKey} [rgb] @param {number} [tolerance] */
function key(asset = image, rgb = keyRGB, tolerance = keyTolerance) {
  active();
  const prepared = applyImageColorKey(asset, rgb, tolerance);
  const nextTree = createDisplayTreeFromScene(accepted), nextBack = nextTree.get('Back'), nextSprite = nextTree.get('Sprite'), nextFollower = nextTree.get('Follower');
  if (nextBack?.kind !== 'rect' || nextSprite?.kind !== 'sprite' || nextFollower?.kind !== 'sprite') throw new Error('Consumer objects missing');
  nextSprite.setImageSource('Keyed', { x: 0, y: 0, width: prepared.width, height: prepared.height });
  nextSprite.setTint([1,1,1]); nextSprite.setRGBMatrix(null); nextSprite.setAlphaMask(null); nextSprite.setOpacity(1); nextSprite.setBlendMode('normal');
  const inputs = assets(); if (!inputs.has('Atlas')) inputs.set('Atlas', image); inputs.set('Keyed', prepared);
  const fresh = instrument(document.createElement('canvas')); fresh.id = 'scene'; candidateAttempts++;
  /** @type {import('@barocss/canvas2d').Canvas2DRenderer|undefined} */ let candidate;
  try {
    candidate = createCanvas2D(fresh, options);
    for (const [id, value] of inputs) candidate.setImageAsset(id, value);
    const nextScene = nextTree.snapshot(); candidate.updateScene(nextScene); candidate.render();
    const owned = snapshotAssets(candidate, inputs.keys());
    adopt(nextTree, nextBack, nextSprite, nextFollower, fresh, candidate, owned, nextScene);
  } catch (error) { if (candidate !== renderer) closeRenderer(candidate, fresh); candidateRefused++; throw error; }
  keyPreparations++; lastKeyResult = prepared; show('Prepared RGB color-key cutout'); return prepared;
}
async function documentText() { return serializeCanvasDocument(accepted, id => hostAssets.get(id) ?? null); }
/** @param {Blob} blob @param {string} name */ function download(blob, name) { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function save() { active(); const text = await documentText(); active(); saves++; download(new Blob([text], { type: 'application/json' }), 'sprite-blend-document.json'); show(`Saved ${new TextEncoder().encode(text).length} bytes`); return text; }
/** @param {string} text */ async function openText(text) { active(); const fresh = instrument(document.createElement('canvas')); fresh.id = 'scene'; candidateAttempts++;
  /** @type {import('@barocss/canvas2d/document').StagedCanvasDocument|undefined} */ let staged;
  try { staged = await stageCanvasDocument(text, fresh, options); if (disposed) throw new Error('consumer disposed'); const nextTree = createDisplayTreeFromScene(staged.scene), nextSprite = nextTree.get('Sprite'), nextBack = nextTree.get('Back'), nextFollower = nextTree.get('Follower'); if (nextSprite?.kind !== 'sprite' || nextBack?.kind !== 'rect' || nextFollower?.kind !== 'sprite') throw new Error('Document display objects differ');
    if (!staged.renderer.getImageAsset('Atlas')) staged.renderer.setImageAsset('Atlas', image); const ids = new Set([...staged.assets.keys(), 'Atlas']); adopt(nextTree, nextBack, nextSprite, nextFollower, fresh, staged.renderer, snapshotAssets(staged.renderer, ids), /** @type {import('@barocss/canvas2d').Scene} */ (staged.scene)); }
  catch (error) { if (staged?.renderer !== renderer) closeRenderer(staged?.renderer, fresh); candidateRefused++; throw error; }
  opens++; show(`Opened blend Scene v${accepted.version}`); }
function edit() { active(); sprite.setPosition(8, 0); edits++; submit('Moved restored Sprite'); }
async function png() {
  active(); const text = await documentText(); active();
  /** @type {HTMLCanvasElement|undefined} */ let temporary;
  try {
    const result = await exportCanvasDocumentPNG(text, options, () => { temporary = instrument(document.createElement('canvas')); return temporary; });
    active(); pngs++; download(result.blob, 'sprite-blend-alpha-mask.png'); show('Exported PNG'); return result;
  } finally { if (temporary) closeDiagnostic(temporary); }
}
function dispose() { if (disposed) return; disposed = true; unbind(); clearRoutes(); for (const off of controlOff.splice(0)) off(); closeRenderer(renderer, canvas); for (const context of contexts) context.offDiagnostic(); document.querySelectorAll('button').forEach(button => { button.disabled = true; }); openInput.disabled = true; show('Disposed'); }
subscribe(); unbind = bind();
const actions = { normal: () => setBlendMode('normal'), add: () => setBlendMode('add'), invalid, mask: () => mask(), edit, save, png, dispose, ...(keyMode ? { key: () => key() } : {}) };
for (const [id, action] of Object.entries(actions)) {
  const button = document.querySelector('#' + id);
  const onClick = () => { if (disposed) return; void Promise.resolve().then(async () => { await action(); }).catch(error => { if (!disposed) show(`Action failed: ${error.code ?? 'ERROR'}`); }); };
  button?.addEventListener('click', onClick); controlOff.push(() => button?.removeEventListener('click', onClick));
}
const onOpen = () => { const file = openInput.files?.[0]; if (!file || disposed) return; void file.text().then(text => { if (!disposed) return openText(text); }).catch(error => { if (!disposed) show(`Open failed: ${error.code ?? 'ERROR'}`); }); openInput.value = ''; };
openInput.addEventListener('change', onOpen); controlOff.push(() => openInput.removeEventListener('change', onOpen));
if (keyMode) { document.querySelector('#key')?.removeAttribute('hidden'); /** @type {HTMLElement} */(document.querySelector('#description')).textContent='Clear pixels within five encoded RGB steps of [40,160,80]. The original Follower stays unchanged. Keyed hidden RGB and nonmatched partial alpha remain in saved assets.'; }
Object.assign(window, { __spriteBlendConsumer: { observe, retentionKey, setBlendMode, invalid, mask, key, save, openText, documentText, edit, png, dispose, assets, original: () => copyAsset(image), matrix: () => [...alphaMask], lastKeyResult: () => lastKeyResult, contexts,
  get canvas() { return canvas; }, get tree() { return tree; }, get sprite() { return sprite; }, get renderer() { return renderer; }, get follower() { return follower; } } });
show('Ready with normal blend');
