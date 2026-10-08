// @ts-check
import { createCanvas2D, loadImageURL, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 160, height: 120 }, dpr: 2 };
const pose = (/** @type {number} */ x = 0, /** @type {number} */ y = 0) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @type {import('@barocss/canvas2d').Scene} */
const background = { version: 6, unit: 'logical-px', contextId: 'URLConsumer',
  nodes: [{ kind: 'rect', id: 'Back', layer: 0, transform: pose(20, 20),
    width: 80, height: 80, fill: [1, 1, 0, 1] }] };
/** @type {import('@barocss/canvas2d').Scene} */
const withImage = { ...background, nodes: [...background.nodes, { kind: 'image', id: 'Sprite',
  layer: 1, transform: pose(20, 20), imageId: 'URLRGBA2', width: 80, height: 80,
  opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 }] };
const pngURL = new URL('./evidence/image-decode/rgba2.png', import.meta.url).href;
const htmlURL = new URL('./image-url.html', import.meta.url).href;
const oversizeURL = new URL('/examples/canvas2d-scene/oversize-url-test.png', location.href).href;
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
/** @type {import('@barocss/canvas2d').Scene} */ let accepted = background;
renderer.updateScene(accepted); renderer.render();
let generation = 1;
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
  return { generation, scene: stringifySceneJSON(accepted),
    assetBytes: [...(renderer.getImageAsset('URLRGBA2')?.pixels ?? [])],
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y),
      hit: renderer.hitTest({ x, y })?.id ?? null })) };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
async function load() {
  const asset = await loadImageURL(pngURL);
  renderer.setImageAsset('URLRGBA2', asset);
  renderer.updateScene(withImage); accepted = withImage; renderer.render();
  show(`Loaded ${asset.width}×${asset.height} raster URL`);
}
/** @param {string} url */
async function tryURL(url) {
  const before = JSON.stringify(observe());
  try { await loadImageURL(url); return { code: 'ACCEPTED', retained: JSON.stringify(observe()) === before }; }
  catch (error) {
    const code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR';
    const retained = JSON.stringify(observe()) === before;
    show(`Rejected URL: ${code}; retained ${retained}`);
    return { code, retained };
  }
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'url-image-document.json'; link.click();
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
  generation++; old.dispose(); show('Opened URL image document');
}
document.querySelector('#load')?.addEventListener('click', () => { void load().catch(error => show(`Rejected load: ${error.code ?? 'ERROR'}`)); });
document.querySelector('#nonimage')?.addEventListener('click', () => { void tryURL(htmlURL); });
document.querySelector('#oversize')?.addEventListener('click', () => { void tryURL(oversizeURL); });
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Rejected Open: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __urlConsumer: { observe, load, tryURL, save, openText,
  get renderer() { return renderer; }, get canvas() { return canvas; },
  pngURL, htmlURL, oversizeURL } });
show('Ready: load a same-origin PNG');
