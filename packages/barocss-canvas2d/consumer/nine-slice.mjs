// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const options = { logicalSize: { width: 32, height: 24 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const pixels = new Uint8Array([
  255, 0, 0, 255, 255, 128, 0, 255, 255, 255, 0, 255,
  0, 0, 0, 0, 0, 255, 0, 255, 0, 255, 255, 255,
  0, 0, 255, 255, 128, 0, 255, 255, 255, 255, 255, 255,
]);
let tree = createDisplayTree('NineSliceConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(0, 0),
  width: 32, height: 24, fill: [0.25, 0.25, 0.25, 1] });
let panel = tree.createSprite({ id: 'Panel', layer: 1, transform: pose(4, 4),
  imageId: 'Nine', width: 7, height: 5, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0, sourceRect: { x: 0, y: 0, width: 3, height: 3 },
  slice: { left: 1, right: 1, top: 1, bottom: 1 } });
tree.stage.addChild(back); tree.stage.addChild(panel);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Nine', { width: 3, height: 3, pixels });
/** @type {import('@barocss/canvas2d').SceneV12 | import('@barocss/canvas2d').SceneV13 | import('@barocss/canvas2d').SceneV14 | import('@barocss/canvas2d').SceneV15 | import('@barocss/canvas2d').SceneV16 | import('@barocss/canvas2d').SceneV17 | import('@barocss/canvas2d').SceneV18 | import('@barocss/canvas2d').SceneV19 | import('@barocss/canvas2d').SceneV20 | import('@barocss/canvas2d').SceneV21 | import('@barocss/canvas2d').SceneV22 | import('@barocss/canvas2d').SceneV24 | import('@barocss/canvas2d').SceneV25 | import('@barocss/canvas2d').SceneV26 | import('@barocss/canvas2d').SceneV27 | import('@barocss/canvas2d').SceneV28 | import('@barocss/canvas2d').SceneV29} */
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
/** @type {string[]} */ const oldLog = [];
/** @type {() => void} */ let unbind = () => {};
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
/** @param {number} x @param {number} y */
function pixel(x, y) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 missing');
  const bytes = new Uint8Array(4);
  gl.readPixels(x * 2, canvas.height - y * 2 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
function observe() {
  const right = 4 + panel.data.width - 1, bottom = 4 + panel.data.height - 1;
  const opaque = { x: 8, y: 6 }, transparent = { x: 4, y: 6 };
  return { generation, sceneVersion: accepted.version, width: panel.data.width,
    height: panel.data.height, slice: panel.data.slice,
    pixel: { topLeft: pixel(4, 4), top: pixel(8, 4), topRight: pixel(right, 4),
      leftTransparent: pixel(4, 6), center: pixel(8, 6), right: pixel(right, 6),
      bottomLeft: pixel(4, bottom), bottom: pixel(8, bottom), bottomRight: pixel(right, bottom) },
    hit: renderer.hitTest(opaque), stack: renderer.hitTestAll(opaque),
    transparentStack: renderer.hitTestAll(transparent),
    assetBytes: [...(renderer.getImageAsset('Nine')?.pixels ?? [])],
    pointerLog: [...pointerLog], oldLog: [...oldLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  panel.onPointer('pointerdown', () => pointerLog.push('Panel'));
  back.onPointer('pointerdown', () => pointerLog.push('Back'));
  tree.stage.onPointer('pointerdown', () => pointerLog.push('stage'));
}
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const onPointer = event => {
    const rect = current.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) * 32 / rect.width,
      y: (event.clientY - rect.top) * 24 / rect.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
      point, hit: renderer.hitTest(point) });
    show();
  };
  current.addEventListener('pointerdown', onPointer);
  return () => current.removeEventListener('pointerdown', onPointer);
}
function resize() {
  panel.setSize(9, 7); accepted = tree.snapshot(); renderer.updateScene(accepted);
  renderer.render(); show();
}
function edit() {
  panel.setSlice({ left: 1, right: 0, top: 1, bottom: 1 });
  panel.setSize(11, 9); accepted = tree.snapshot(); renderer.updateScene(accepted);
  renderer.render(); show();
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url;
  anchor.download = 'nine-slice-document.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 64; fresh.height = 48;
  const staged = await stageCanvasDocument(text, fresh, options);
  if (staged.scene.version !== 12 && staged.scene.version !== 13 && staged.scene.version !== 14 && staged.scene.version !== 15 && staged.scene.version !== 16 && staged.scene.version !== 17) throw new Error('Scene v12 or v13 or v14 or v15 or v16 required');
  const nextTree = createDisplayTreeFromScene(staged.scene);
  const nextBack = nextTree.get('Back'), nextPanel = nextTree.get('Panel');
  const bytes = staged.renderer.getImageAsset('Nine')?.pixels;
  if (nextBack?.kind !== 'rect' || nextPanel?.kind !== 'sprite' ||
      !bytes || bytes.length !== pixels.length ||
      bytes.some((value, index) => value !== pixels[index])) {
    staged.renderer.dispose(); throw new Error('Document handles or asset differ');
  }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  oldLog.push(...pointerLog); pointerLog = [];
  tree = nextTree; back = nextBack; panel = nextPanel;
  accepted = staged.scene; generation++; subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind();
document.querySelector('#resize')?.addEventListener('click', resize);
document.querySelector('#edit')?.addEventListener('click', edit);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => { output.textContent = String(error); });
  openInput.value = '';
});
Object.assign(window, { __nineSliceConsumer: { observe, resize, edit, save, openText,
  get renderer() { return renderer; }, get tree() { return tree; } } });
show();
