// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON, applyImageRGBMatrix } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';

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
/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const image = { width: 2, height: 1, pixels: new Uint8Array([255, 255, 255, 255, 255, 255, 255, 0]) };
/** @type {import('@barocss/canvas2d').SpriteRGBMatrix} */
const bakeMatrix = [0, 0, 0, 0.25, 0, 1, 0, 0, 0, 0, 1, 0];
const opaque = { x: 0, y: 0, width: 1, height: 1 }, clear = { x: 1, y: 0, width: 1, height: 1 };
/** @param {import('@barocss/canvas2d').ImageAssetInput} value @returns {import('@barocss/canvas2d').ImageAssetInput} */
function copyAsset(value) { return { width: value.width, height: value.height, pixels: new Uint8Array(value.pixels) }; }
/** @param {import('@barocss/canvas2d').Canvas2DRenderer} r @param {Iterable<string>} ids @returns {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */
function snapshotAssets(r, ids) { const result = new Map(); for (const id of ids) { const asset = r.getImageAsset(id); if (asset) result.set(id, asset); } return result; }
let tree = createDisplayTree('TintConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(10, 10), width: 70, height: 60, fill: [1, 1, 0, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20), imageId: 'Atlas', sourceRect: opaque, width: 50, height: 50, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
tree.stage.addChild(back); tree.stage.addChild(sprite);
/** @type {HTMLCanvasElement} */ let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(instrument(canvas), options); renderer.setImageAsset('Atlas', image);
let hostAssets = snapshotAssets(renderer, ['Atlas']);
/** @type {import('@barocss/canvas2d').Scene} */ let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1, disposed = false, bakePreparations = 0, opens = 0, edits = 0, saves = 0, pngs = 0;
let binds = 0, unbinds = 0, pointerEvents = 0, candidateAttempts = 0, candidateAccepted = 0, candidateRefused = 0;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[35, 40], [60, 40]];
function active() { if (disposed) throw new Error('consumer disposed'); }
/** @returns {Map<string,import('@barocss/canvas2d').ImageAssetInput>} */
function assets() { return new Map([...hostAssets].map(([id, asset]) => [id, copyAsset(asset)])); }
/** @param {number} x @param {number} y */
function pixel(x, y) { const gl = canvas.getContext('webgl2'); if (!gl) throw new Error('WebGL2 context missing'); const bytes = new Uint8Array(4); gl.readPixels(x * 2, canvas.height - y * 2 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes); return [...bytes]; }
function observe() { const registered = Object.fromEntries([...hostAssets].map(([id, asset]) => [id, { width: asset.width, height: asset.height, pixels: [...asset.pixels] }])); return { generation, disposed, bakePreparations, opens, edits, saves, pngs, binds, unbinds, pointerEvents,
  candidates: { attempted: candidateAttempts, accepted: candidateAccepted, refused: candidateRefused }, sceneVersion: accepted.version, contextId: accepted.contextId,
  tint: sprite.data.tint, imageId: sprite.data.imageId, sourceRect: sprite.data.sourceRect ?? null, spriteData: sprite.data,
  scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()), assets: registered, assetBytes: registered.Atlas?.pixels ?? null, coloredBytes: registered.Colored?.pixels ?? null,
  samples: disposed ? [] : samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null })), pointerLog: [...pointerLog],
  contexts: contexts.map(c => ({ lost: c.lost, calls: { ...c.calls }, error: c.gl.getError(), resources: Object.fromEntries(Object.entries(c.resources).map(([k, r]) => [k, { created: r.created, deleted: r.deleted, live: r.live() }])) })) }; }
/** @param {ReturnType<typeof observe>} value @param {string} text */
function retentionKey(value, text) { const { contexts: diagnostics, ...state } = value; void diagnostics; return JSON.stringify({ ...state, document: text }); }
/** @param {string} message */ function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() { sprite.onPointer('pointerdown', () => pointerLog.push('Sprite')); tree.stage.onPointer('pointerdown', () => pointerLog.push('stage')); }
function bind() { const current = canvas; let removed = false; binds++;
  /** @param {PointerEvent} event */ const on = event => { const bounds = current.getBoundingClientRect(); pointerEvents++; const point = { x: (event.clientX - bounds.left) * 100 / bounds.width, y: (event.clientY - bounds.top) * 80 / bounds.height }; tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point, hit: renderer.hitTest(point) }); show('Dispatched pointerdown'); };
  current.addEventListener('pointerdown', on); return () => { if (!removed) { removed = true; current.removeEventListener('pointerdown', on); unbinds++; } }; }
/** @param {string} message */ function submit(message) { active(); const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message); }
/** @param {import('@barocss/canvas2d').Tint} tint */ function setTint(tint) { active(); sprite.setTint(tint); submit(`Tint ${tint.join(',')}`); }
/** @param {import('@barocss/canvas2d').SourceRect} rect */ function setCrop(rect) { active(); sprite.setSourceRect(rect); submit(`Crop ${rect.x}`); }
async function invalid() { active(); const before = retentionKey(observe(), await documentText()); let code = 'ACCEPTED'; try { sprite.setTint([1, NaN, 1]); } catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; } const after = retentionKey(observe(), await documentText()); show(`Rejected ${code}; retained ${after === before}`); return code; }
/** @param {import('@barocss/canvas2d').DisplayTree} nextTree @param {import('@barocss/canvas2d').RectHandle} nextBack @param {import('@barocss/canvas2d').SpriteHandle} nextSprite @param {HTMLCanvasElement} fresh @param {import('@barocss/canvas2d').Canvas2DRenderer} nextRenderer @param {Map<string,import('@barocss/canvas2d').ImageAssetInput>} nextAssets @param {import('@barocss/canvas2d').Scene} nextScene */
function adopt(nextTree, nextBack, nextSprite, fresh, nextRenderer, nextAssets, nextScene) { unbind(); const old = renderer; canvas.replaceWith(fresh); canvas = fresh; renderer = nextRenderer; tree = nextTree; back = nextBack; sprite = nextSprite; hostAssets = nextAssets; accepted = nextScene; generation++; candidateAccepted++; pointerLog = []; subscribe(); unbind = bind(); old.dispose(); }
/** @param {import('@barocss/canvas2d').ImageAssetInput} [asset] @param {import('@barocss/canvas2d').SpriteRGBMatrix} [matrix] */
function bake(asset = image, matrix = bakeMatrix) { active(); const prepared = applyImageRGBMatrix(asset, matrix); const nextTree = createDisplayTreeFromScene(accepted), nextBack = nextTree.get('Back'), nextSprite = nextTree.get('Sprite'); if (nextBack?.kind !== 'rect' || nextSprite?.kind !== 'sprite') throw new Error('Consumer objects missing');
  nextSprite.setImageSource('Colored', { x: 0, y: 0, width: prepared.width, height: prepared.height }); nextSprite.setTint([1, 1, 1]); nextSprite.setRGBMatrix(null);
  const inputs = assets(); if (!inputs.has('Atlas')) inputs.set('Atlas', image); inputs.set('Colored', prepared); const fresh = instrument(document.createElement('canvas')); fresh.id = 'scene'; candidateAttempts++;
  /** @type {import('@barocss/canvas2d').Canvas2DRenderer|undefined} */ let candidate; const nextScene = nextTree.snapshot();
  try { candidate = createCanvas2D(fresh, options); for (const [id, asset] of inputs) candidate.setImageAsset(id, asset); candidate.updateScene(nextScene); candidate.render(); const nextAssets = snapshotAssets(candidate, inputs.keys()); adopt(nextTree, nextBack, nextSprite, fresh, candidate, nextAssets, nextScene); }
  catch (error) { candidate?.dispose(); candidateRefused++; throw error; }
  bakePreparations++; show('Baked RGB bytes'); return prepared; }
async function documentText() { return serializeCanvasDocument(accepted, id => hostAssets.get(id) ?? null); }
/** @param {Blob} blob @param {string} name */ function download(blob, name) { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function save() { active(); const text = await documentText(); active(); saves++; download(new Blob([text], { type: 'application/json' }), 'sprite-tint-document.json'); show(`Saved ${new TextEncoder().encode(text).length} bytes`); return text; }
/** @param {string} text */ async function openText(text) { active(); const fresh = instrument(document.createElement('canvas')); fresh.id = 'scene'; candidateAttempts++;
  /** @type {import('@barocss/canvas2d/document').StagedCanvasDocument|undefined} */ let staged;
  try { staged = await stageCanvasDocument(text, fresh, options); if (disposed) throw new Error('consumer disposed'); const nextTree = createDisplayTreeFromScene(staged.scene), nextSprite = nextTree.get('Sprite'), nextBack = nextTree.get('Back'); if (nextSprite?.kind !== 'sprite' || nextBack?.kind !== 'rect') throw new Error('Document display objects differ');
    if (!staged.renderer.getImageAsset('Atlas')) staged.renderer.setImageAsset('Atlas', image); const ids = new Set([...staged.assets.keys(), 'Atlas']); adopt(nextTree, nextBack, nextSprite, fresh, staged.renderer, snapshotAssets(staged.renderer, ids), /** @type {import('@barocss/canvas2d').Scene} */ (staged.scene)); }
  catch (error) { staged?.renderer.dispose(); candidateRefused++; throw error; }
  opens++; show(`Opened tinted Scene v${accepted.version}`); }
function edit() { active(); sprite.setPosition(8, 0); edits++; submit('Moved restored Sprite'); }
async function png() { active(); const text = await documentText(); active(); const result = await exportCanvasDocumentPNG(text, options, () => instrument(document.createElement('canvas'))); active(); pngs++; download(result.blob, 'sprite-tint-color.png'); show('Exported PNG'); return result; }
function dispose() { if (disposed) return; disposed = true; unbind(); renderer.dispose(); document.querySelectorAll('button').forEach(button => { button.disabled = true; }); openInput.disabled = true; show('Disposed'); }
subscribe(); unbind = bind();
const actions = { white: () => setTint([1, 1, 1]), cyan: () => setTint([0, 1, 1]), black: () => setTint([0, 0, 0]), transparent: () => setCrop(clear), invalid, bake: () => bake(), edit, save, png, dispose };
for (const [id, action] of Object.entries(actions)) document.querySelector('#' + id)?.addEventListener('click', () => { void Promise.resolve().then(async () => { await action(); }).catch(error => show(`Action failed: ${error.code ?? 'ERROR'}`)); });
openInput.addEventListener('change', () => { const file = openInput.files?.[0]; if (!file) return; void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`)); openInput.value = ''; });
Object.assign(window, { __spriteTintConsumer: { observe, retentionKey, setTint, setCrop, invalid, bake, save, openText, documentText, edit, png, dispose, assets, original: () => copyAsset(image), matrix: () => [...bakeMatrix], contexts,
  get canvas() { return canvas; }, get tree() { return tree; }, get sprite() { return sprite; }, get renderer() { return renderer; }, opaque, clear } });
show('Ready with white tint');
