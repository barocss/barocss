// @ts-check
import { createCanvas2D, decodeImageBlob, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 160, height: 120 }, dpr: 2 };
const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @type {import('@barocss/canvas2d').SceneV6} */
const background = { version: 6, unit: 'logical-px', contextId: 'BlobConsumer',
  nodes: [{ kind: 'rect', id: 'Back', layer: 0, transform: pose(20, 20),
    width: 80, height: 80, fill: [1, 1, 0, 1] }] };
/** @type {import('@barocss/canvas2d').SceneV6} */
const withImage = { ...background, nodes: [...background.nodes, { kind: 'image', id: 'Sprite',
  layer: 1, transform: pose(20, 20), imageId: 'RGBA2', width: 80, height: 80,
  opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 }] };
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
/** @type {import('@barocss/canvas2d').SceneV6} */ let accepted = background;
renderer.updateScene(accepted); renderer.render();
let generation = 1;
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const fileInput = /** @type {HTMLInputElement} */ (document.querySelector('#file'));
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
    assetBytes: [...(renderer.getImageAsset('RGBA2')?.pixels ?? [])],
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y),
      hit: renderer.hitTest({ x, y })?.id ?? null })) };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
/** @param {Blob} blob */
async function loadBlob(blob) {
  const asset = await decodeImageBlob(blob);
  renderer.setImageAsset('RGBA2', asset);
  renderer.updateScene(withImage); accepted = withImage; renderer.render();
  show(`Decoded ${asset.width}×${asset.height} raster image`);
}
/** @param {Blob} blob */
async function tryBlob(blob) {
  const before = JSON.stringify(observe());
  try { await decodeImageBlob(blob); return { code: 'ACCEPTED', retained: JSON.stringify(observe()) === before }; }
  catch (error) {
    const code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR';
    const retained = JSON.stringify(observe()) === before;
    show(`Rejected Blob: ${code}; retained ${retained}`);
    return { code, retained };
  }
}
/** @param {number} width @param {number} height */
async function makePng(width = 2, height = 2) {
  const source = document.createElement('canvas'); source.width = width; source.height = height;
  const context = source.getContext('2d'); if (!context) throw new Error('2D canvas missing');
  if (width === 2 && height === 2) {
    const data = context.createImageData(2, 2);
    data.data.set([255, 0, 0, 255, 0, 0, 0, 0,
      0, 0, 255, 255, 0, 255, 0, 255]);
    context.putImageData(data, 0, 0);
  } else context.fillRect(0, 0, width, height);
  return await new Promise((resolve, reject) => source.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encode failed')), 'image/png'));
}
async function downloadSample() {
  const blob = await makePng();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'rgba2.png'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Downloaded ${blob.size}-byte PNG`);
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'decoded-document.json'; link.click();
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
  const oldRenderer = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  accepted = /** @type {import('@barocss/canvas2d').SceneV6} */ (staged.scene);
  generation++; oldRenderer.dispose(); show('Opened decoded image document');
}
document.querySelector('#sample')?.addEventListener('click', () => { void downloadSample(); });
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]; if (!file) return;
  void loadBlob(file).catch(error => show(`Rejected image: ${/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR'}`));
  fileInput.value = '';
});
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Rejected Open: ${/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __decodeConsumer: { observe, loadBlob, tryBlob, makePng, save, openText,
  get renderer() { return renderer; }, get canvas() { return canvas; } } });
show('Ready: choose a raster Blob');
