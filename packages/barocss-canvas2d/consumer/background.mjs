// @ts-check
import { createCanvas2D, createDisplayTree } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';
const options = { logicalSize: { width: 80, height: 50 }, dpr: 2 };
const tree = createDisplayTree('BackgroundConsumer');
tree.stage.addChild(tree.createRect({ id: 'Red', layer: 0,
  transform: { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0 },
  width: 20, height: 20, fill: [1, 0, 0, 0.5] }));
/** @type {import('@barocss/canvas2d').Scene} */ let scene = tree.snapshot();
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
const original = /** @type {import('@barocss/canvas2d').Color} */ ([0, 0, 0, 0]);
let renderer = createCanvas2D(canvas, { ...options, backgroundColor: original });
original[0] = 1;
renderer.updateScene(scene); renderer.render();
let generation = 1;
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
/** @param {number} x @param {number} y */
function pixel(x, y) {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 unavailable');
  const bytes = new Uint8Array(4);
  gl.readPixels(x * options.dpr, canvas.height - y * options.dpr - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
function observe() { return { generation, version: scene.version, color: renderer.getBackgroundColor(),
  background: pixel(2, 2), rectangle: pixel(20, 20),
  backgroundHit: renderer.hitTest({ x: 2, y: 2 })?.id ?? null,
  rectangleHit: renderer.hitTest({ x: 20, y: 20 })?.id ?? null }; }
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
/** @param {import('@barocss/canvas2d').Color} color */
function set(color) { renderer.setBackgroundColor(color); renderer.render(); show(); }
function copiesAndExplicitRender() {
  const before = observe(); const getter = renderer.getBackgroundColor(); getter[0] = 0.8;
  const getterCopy = JSON.stringify(renderer.getBackgroundColor()) === JSON.stringify(before.color);
  const input = /** @type {import('@barocss/canvas2d').Color} */ ([0, 0, 1, 1]);
  renderer.setBackgroundColor(input); input[2] = 0;
  const pending = observe(); renderer.render(); show();
  return { before, pending, after: observe(), getterCopy };
}
function refusal() {
  const before = JSON.stringify(observe()); let code = 'ACCEPTED';
  try { renderer.setBackgroundColor([0, 0, 1, 2]); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  return { code, retained: JSON.stringify(observe()) === before };
}
function viewAndResize() {
  renderer.setView({ panX: 20, panY: 5, zoom: 2 }); renderer.render();
  const panned = observe(); renderer.resize({ width: 100, height: 60 }, 2); renderer.render();
  const resized = { color: renderer.getBackgroundColor(), background: pixel(2, 2), size: [canvas.width, canvas.height] };
  renderer.resize(options.logicalSize, options.dpr); renderer.setView({ panX: 0, panY: 0, zoom: 1 });
  renderer.render(); show(); return { panned, resized, restored: observe() };
}
async function contextRestore() {
  const gl = canvas.getContext('webgl2'); const ext = gl?.getExtension('WEBGL_lose_context');
  if (!ext) throw new Error('WEBGL_lose_context unavailable');
  const lost = new Promise(resolve => canvas.addEventListener('webglcontextlost', resolve, { once: true }));
  ext.loseContext(); await lost;
  renderer.setBackgroundColor([0, 1, 0, 1]); let renderCode = 'ACCEPTED';
  try { renderer.render(); } catch (error) { renderCode = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  const restored = new Promise(resolve => canvas.addEventListener('webglcontextrestored', resolve, { once: true }));
  await new Promise(resolve => setTimeout(resolve, 150)); ext.restoreContext(); await restored;
  show(); return { renderCode, after: observe() };
}
/** @param {Blob} blob @param {string} name */
function download(blob, name) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function save() { const text = await serializeCanvasDocument(scene, id => renderer.getImageAsset(id));
  download(new Blob([text], { type: 'application/json' }), 'background-document.json'); }
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, { ...options, backgroundColor: renderer.getBackgroundColor() });
  const old = renderer; canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  scene = staged.scene;
  generation++; old.dispose(); show();
}
async function png() {
  const text = await serializeCanvasDocument(scene, id => renderer.getImageAsset(id));
  const result = await exportCanvasDocumentPNG(text, { ...options, backgroundColor: renderer.getBackgroundColor() }, () => document.createElement('canvas'));
  const bitmap = await createImageBitmap(result.blob); const decoded = document.createElement('canvas');
  decoded.width = bitmap.width; decoded.height = bitmap.height;
  const ctx = decoded.getContext('2d'); if (!ctx) throw new Error('2D PNG decode unavailable');
  ctx.drawImage(bitmap, 0, 0); bitmap.close();
  const decodedBackground = [...ctx.getImageData(4, 4, 1, 1).data];
  download(result.blob, 'background-export.png');
  const observation = { type: result.blob.type, bytes: result.blob.size,
    size: result.backingSize, decodedBackground };
  Object.assign(window, { __backgroundPNG: observation }); return observation;
}
function disposed() {
  const fresh = document.createElement('canvas'); const target = createCanvas2D(fresh, options);
  target.render(); const defaultColor = target.getBackgroundColor();
  const gl = fresh.getContext('webgl2'); if (!gl) throw new Error('WebGL2 unavailable');
  const bytes = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  target.dispose();
  let setCode = '', getCode = '';
  try { target.setBackgroundColor([1, 0, 0, 1]); } catch (error) { setCode = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  try { target.getBackgroundColor(); } catch (error) { getCode = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  return { defaultColor, defaultPixel: [...bytes], setCode, getCode };
}
document.querySelector('#blue')?.addEventListener('click', () => set([0, 0, 1, 1]));
document.querySelector('#half')?.addEventListener('click', () => set([1, 0.5, 0, 0.5]));
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
document.querySelector('#png')?.addEventListener('click', () => { void png(); });
openInput.addEventListener('change', () => { const file = openInput.files?.[0]; if (file) void file.text().then(openText); openInput.value = ''; });
Object.assign(window, { __backgroundConsumer: { observe, set, copiesAndExplicitRender, refusal, viewAndResize, contextRestore, disposed, png } });
show();
