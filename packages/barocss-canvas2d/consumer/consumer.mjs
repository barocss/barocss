// @ts-check
import { createCanvas2D, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 320, height: 200 }, dpr: 2 };
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const stamp = { width: 2, height: 2, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 0, 0, 0,
  0, 0, 255, 255, 0, 255, 0, 255,
]) };

/**
 * @param {import('@barocss/canvas2d').Color} fill
 * @returns {import('@barocss/canvas2d').SceneV3}
 */
function sceneWithColor(fill) {
  return { version: 3, unit: 'logical-px', contextId: 'IndependentConsumer', nodes: [
    { kind: 'frame', id: 'Paper', layer: 0,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      width: 320, height: 200, fill: [1, 1, 1, 1], clip: true, children: [
        { kind: 'rect', id: 'Blue', layer: 0,
          transform: { x: 20, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
          width: 40, height: 30, fill },
        { kind: 'image', id: 'Stamp', layer: 1,
          transform: { x: 80, y: 60, scaleX: 1, scaleY: 1, rotation: 0 },
          imageId: 'Stamp2', width: 80, height: 80, opacity: 1, sampling: 'nearest' },
      ] },
  ] };
}

/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
/** @type {import('@barocss/canvas2d').Scene} */
let scene = sceneWithColor([0.2, 0.4, 0.8, 1]);
renderer.setImageAsset('Stamp2', stamp);
renderer.updateScene(scene);
renderer.render();

let generation = 1;
let lastSaved = '';
/** @type {string | null} */
let lastOldDisposeCode = null;
let stopped = false;
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const points = [[30, 30], [90, 70], [130, 70], [100, 110], [300, 180]];

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
  return { generation, canvasWidth: canvas.width, canvasHeight: canvas.height,
    scene: stringifySceneJSON(scene), assetBytes: [...(renderer.getImageAsset('Stamp2')?.pixels ?? [])],
    samples: points.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y }) })),
    oldDisposeCode: lastOldDisposeCode };
}
/** @param {string} message */
function show(message) {
  status.textContent = message;
  if (!stopped) output.textContent = JSON.stringify(observe(), null, 2);
}

async function save() {
  if (stopped) return;
  lastSaved = await serializeCanvasDocument(scene, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([lastSaved], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'independent-canvas-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(lastSaved).length} bytes`);
}
function edit() {
  if (stopped) return;
  const next = sceneWithColor([1, 1, 0, 1]);
  renderer.updateScene(next); renderer.render(); scene = next;
  show('Changed rectangle to yellow');
}
/** @param {string} text */
async function openText(text) {
  if (stopped) return;
  const fresh = document.createElement('canvas');
  fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  const old = renderer;
  canvas.replaceWith(fresh);
  canvas = fresh; renderer = staged.renderer; scene = staged.scene; generation++;
  old.dispose();
  try { old.render(); } catch (error) { lastOldDisposeCode = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show('Opened validated document on a fresh canvas');
}
async function tryCorrupt() {
  if (!lastSaved || stopped) return;
  const documentValue = JSON.parse(lastSaved);
  const digest = documentValue.assets[0].sha256;
  documentValue.assets[0].sha256 = `${digest[0] === '0' ? '1' : '0'}${digest.slice(1)}`;
  try { await openText(JSON.stringify(documentValue)); }
  catch (error) { show(`Rejected corrupt digest: ${/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code}`); }
}
function dispose() {
  if (stopped) return;
  const accepted = observe();
  renderer.dispose(); stopped = true;
  let code = null;
  try { renderer.render(); } catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  output.textContent = JSON.stringify({ ...accepted, finalDisposeCode: code }, null, 2);
  status.textContent = `Disposed: ${code}`;
}

document.querySelector('#save')?.addEventListener('click', () => { void save(); });
document.querySelector('#edit')?.addEventListener('click', edit);
document.querySelector('#open')?.addEventListener('change', () => {
  const file = openInput.files?.[0];
  if (!file) return;
  void file.text().then(openText).catch(error => {
    show(`Rejected Open: ${/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR'}`);
  });
  openInput.value = '';
});
document.querySelector('#corrupt')?.addEventListener('click', () => { void tryCorrupt(); });
document.querySelector('#dispose')?.addEventListener('click', dispose);
Object.assign(window, { __canvas2dConsumer: { observe, save, edit, openText, tryCorrupt, dispose,
  get saved() { return lastSaved; } } });
show('Ready: compiled package entries and copied Stamp2 asset');
