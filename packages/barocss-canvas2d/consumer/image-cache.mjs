// @ts-check
import { createCanvas2D, createImageAssetCache, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 160, height: 120 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @type {import('@barocss/canvas2d').Scene} */
const background = { version: 6, unit: 'logical-px', contextId: 'CacheConsumer',
  nodes: [{ kind: 'rect', id: 'Back', layer: 0, transform: pose(20, 20),
    width: 80, height: 80, fill: [1, 1, 0, 1] }] };
/** @type {import('@barocss/canvas2d').Scene} */
const withImage = { ...background, nodes: [...background.nodes, { kind: 'image', id: 'Sprite',
  layer: 1, transform: pose(20, 20), imageId: 'CachedRGBA2', width: 80, height: 80,
  opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 }] };
const pngURL = new URL('./evidence/image-decode/rgba2.png', import.meta.url).href;
const alternateURL = new URL(`${pngURL}?second=1`).href;
let getCount = 0;
const cache = createImageAssetCache({ maxEntries: 1, fetcher: (url, init) => {
  getCount++;
  return fetch(url, init);
} });
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
/** @type {import('@barocss/canvas2d').Scene} */ let accepted = background;
renderer.updateScene(accepted); renderer.render();
let generation = 1;
let cacheDisposed = false;
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[30, 30], [70, 30], [30, 70], [70, 70]];

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
  return { generation, getCount, cacheDisposed,
    cacheSize: cacheDisposed ? null : cache.size,
    cacheBytes: cacheDisposed ? null : cache.byteLength,
    cachedAssetBytes: cacheDisposed ? [] : [...(cache.get(pngURL)?.pixels ?? [])],
    scene: stringifySceneJSON(accepted),
    rendererAssetBytes: [...(renderer.getImageAsset('CachedRGBA2')?.pixels ?? [])],
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y),
      hit: renderer.hitTest({ x, y })?.id ?? null })) };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
async function load() {
  const asset = await cache.load(pngURL);
  renderer.setImageAsset('CachedRGBA2', asset);
  renderer.updateScene(withImage); accepted = withImage; renderer.render();
  show('Loaded PNG through cache');
}
async function repeat() {
  const asset = await cache.load(`${pngURL}#another-fragment`);
  asset.pixels[0] = 0;
  show('Reused PNG; changed only returned copy');
}
async function evict() {
  await cache.load(alternateURL);
  const evicted = cache.get(pngURL) === null;
  await cache.load(pngURL);
  show(`Evicted and refetched: ${evicted}`);
  return evicted;
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'cached-image-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  if (stringifySceneJSON(staged.scene) !== stringifySceneJSON(withImage)) {
    staged.renderer.dispose(); throw new Error('Document scene does not match consumer');
  }
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  accepted = /** @type {import('@barocss/canvas2d').Scene} */ (staged.scene);
  generation++; old.dispose(); cache.dispose(); cacheDisposed = true;
  show('Opened document without cache');
}
document.querySelector('#load')?.addEventListener('click', () => { void load().catch(error => show(`Load failed: ${error.code ?? 'ERROR'}`)); });
document.querySelector('#repeat')?.addEventListener('click', () => { void repeat().catch(error => show(`Reuse failed: ${error.code ?? 'ERROR'}`)); });
document.querySelector('#evict')?.addEventListener('click', () => { void evict().catch(error => show(`Evict failed: ${error.code ?? 'ERROR'}`)); });
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __cacheConsumer: { observe, load, repeat, evict, save, openText,
  get canvas() { return canvas; }, pngURL, alternateURL } });
show('Ready to load same-origin PNG');
