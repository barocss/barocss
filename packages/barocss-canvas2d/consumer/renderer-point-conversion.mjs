// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const view = { panX: 10, panY: 5, zoom: 2 };
const worldPoint = { x: 20, y: 15 };
let tree = createDisplayTree('RendererPointConsumer');
let rect = tree.createRect({ id: 'Red', layer: 0,
  transform: { x: 20, y: 15, scaleX: 1, scaleY: 1, rotation: 0 },
  width: 10, height: 10, fill: [1, 0, 0, 1] });
tree.stage.addChild(rect);
/** @type {HTMLCanvasElement} */ let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setView(view);
/** @type {import('@barocss/canvas2d').Scene} */ let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
/** @param {number} x @param {number} y */
function pixel(x, y) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const bytes = new Uint8Array(4);
  gl.readPixels(x * 2, canvas.height - y * 2 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
function observe() {
  const viewport = renderer.worldToViewport(worldPoint);
  const world = renderer.viewportToWorld(viewport);
  return { generation, sceneVersion: accepted.version, viewport, world,
    local: rect.toLocal(world), redPixel: pixel(51, 36), hit: renderer.hitTest(viewport)?.id ?? null,
    pointerLog: [...pointerLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  rect.onPointer('pointerdown', event => pointerLog.push(`Red:${event.target?.id}`));
  tree.stage.onPointer('pointerdown', event => pointerLog.push(`stage:${event.target?.id}`));
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
    show();
  };
  current.addEventListener('pointerdown', onPointer);
  return () => current.removeEventListener('pointerdown', onPointer);
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'renderer-point-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  fresh.width = 200; fresh.height = 160;
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextRect;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const found = nextTree.get('Red');
    if (found?.kind !== 'rect') throw new Error('Red rect missing');
    nextRect = found;
    staged.renderer.setView(view); staged.renderer.render();
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; rect = nextRect; accepted = staged.scene;
  generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind(); show();
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => { const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText); openInput.value = ''; });
Object.assign(window, { __rendererPointConsumer: { observe, save, openText,
  get renderer() { return renderer; }, get canvas() { return canvas; } } });
