// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 80, height: 80 }, dpr: 2 };
/** @param {number} x @param {number} y */
const pose = (x, y) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
let tree = createDisplayTree('CaptureConsumer');
let parent = tree.createContainer({ id: 'Parent', layer: 0, transform: pose(0, 0) });
let red = tree.createRect({ id: 'Red', layer: 0, transform: pose(10, 10),
  width: 20, height: 20, fill: [1, 0, 0, 1] });
let blue = tree.createRect({ id: 'Blue', layer: 1, transform: pose(40, 10),
  width: 20, height: 20, fill: [0, 0, 1, 1] });
tree.stage.addChild(parent); parent.addChild(red); tree.stage.addChild(blue);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
/** @type {import('@barocss/canvas2d').SceneV13 | import('@barocss/canvas2d').SceneV14 | import('@barocss/canvas2d').SceneV15 | import('@barocss/canvas2d').SceneV16 | import('@barocss/canvas2d').SceneV17 | import('@barocss/canvas2d').SceneV18 | import('@barocss/canvas2d').SceneV19 | import('@barocss/canvas2d').SceneV20 | import('@barocss/canvas2d').SceneV21 | import('@barocss/canvas2d').SceneV22 | import('@barocss/canvas2d').SceneV24 | import('@barocss/canvas2d').SceneV25 | import('@barocss/canvas2d').SceneV26 | import('@barocss/canvas2d').SceneV27 | import('@barocss/canvas2d').SceneV28} */
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
let lastPointerId = -1;
/** @type {string[]} */ let log = [];
/** @type {string[]} */ let hover = [];
/** @type {() => void} */ let unbind = () => {};
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
function subscribe() {
  red.onPointer('pointerdown', event => tree.capturePointer(event.pointerId, red));
  for (const handle of [red, parent, blue, tree.stage]) {
    for (const type of /** @type {const} */ (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])) {
      handle.onPointer(type, event => log.push(`${event.pointerId}:${type}:${event.target?.id ?? 'stage'}:${'id' in handle ? handle.id : 'stage'}`));
    }
  }
  for (const handle of [red, blue]) {
    for (const type of /** @type {const} */ (['pointerenter', 'pointerleave'])) {
      handle.onHover(type, event => hover.push(`${event.pointerId}:${type}:${handle.id}`));
    }
  }
}
/** @param {number} x @param {number} y */
function pixel(x, y) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const bytes = new Uint8Array(4);
  gl.readPixels(x * 2, canvas.height - y * 2 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
function observe() {
  return { generation, sceneVersion: accepted.version, redPixel: pixel(15, 15),
    bluePixel: pixel(45, 15), emptyPixel: pixel(70, 70),
    redHit: renderer.hitTest({ x: 15, y: 15 })?.id ?? null,
    blueHit: renderer.hitTest({ x: 45, y: 15 })?.id ?? null,
    capture: lastPointerId < 0 ? null : tree.getPointerCapture(lastPointerId)?.id ?? null,
    log: [...log], hover: [...hover] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const pointer = event => {
    lastPointerId = event.pointerId;
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * 80 / bounds.width,
      y: (event.clientY - bounds.top) * 80 / bounds.height };
    const hit = renderer.hitTest(point);
    if (event.type === 'pointermove') tree.dispatchHover({ pointerId: event.pointerId, point, hit });
    tree.dispatchPointer({ type: /** @type {import('@barocss/canvas2d').PointerEventType} */ (event.type),
      pointerId: event.pointerId, point, hit });
    if (event.type === 'pointerdown') current.setPointerCapture(event.pointerId);
    show();
  };
  for (const type of /** @type {const} */ (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])) {
    current.addEventListener(type, pointer);
  }
  return () => { for (const type of /** @type {const} */ (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])) {
    current.removeEventListener(type, pointer);
  } };
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'pointer-capture-document.json';
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 160; fresh.height = 160;
  const staged = await stageCanvasDocument(text, fresh, options);
  if (staged.scene.version !== 13 && staged.scene.version !== 14 && staged.scene.version !== 15 && staged.scene.version !== 16 && staged.scene.version !== 17) throw new Error('Scene v13 or v14 or v15 or v16 required');
  const nextTree = createDisplayTreeFromScene(staged.scene);
  const nextParent = nextTree.get('Parent'), nextRed = nextTree.get('Red'), nextBlue = nextTree.get('Blue');
  if (nextParent?.kind !== 'container' || nextRed?.kind !== 'rect' || nextBlue?.kind !== 'rect') {
    staged.renderer.dispose(); throw new Error('Document handles differ');
  }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; parent = nextParent; red = nextRed; blue = nextBlue;
  accepted = staged.scene; generation++; lastPointerId = -1; log = []; hover = [];
  subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind();
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => { output.textContent = String(error); });
  openInput.value = '';
});
Object.assign(window, { __captureConsumer: { observe, save, openText,
  get canvas() { return canvas; } } });
show();
