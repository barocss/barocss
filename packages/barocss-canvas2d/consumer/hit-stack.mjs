// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 80, height: 80 }, dpr: 2 };
const pose = { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0 };
const point = { x: 20, y: 20 };
const image = { width: 1, height: 1, pixels: new Uint8Array([0, 0, 255, 255]) };
let tree = createDisplayTree('HitStackConsumer');
let rect = tree.createRect({ id: 'Rect', layer: 0, transform: pose,
  width: 50, height: 50, fill: [1, 0, 0, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose,
  imageId: 'Blue', width: 50, height: 50, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0 });
tree.stage.addChild(rect); tree.stage.addChild(sprite);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Blue', image);
/** @type {import('@barocss/canvas2d').SceneV11 | import('@barocss/canvas2d').SceneV12 | import('@barocss/canvas2d').SceneV13 | import('@barocss/canvas2d').SceneV14 | import('@barocss/canvas2d').SceneV15 | import('@barocss/canvas2d').SceneV16 | import('@barocss/canvas2d').SceneV17 | import('@barocss/canvas2d').SceneV18 | import('@barocss/canvas2d').SceneV19 | import('@barocss/canvas2d').SceneV20 | import('@barocss/canvas2d').SceneV21 | import('@barocss/canvas2d').SceneV22 | import('@barocss/canvas2d').SceneV24} */
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
/** @type {string[]} */ const oldLog = [];
/** @type {() => void} */ let unbind = () => {};
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
function pixel() {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 missing');
  const bytes = new Uint8Array(4);
  gl.readPixels(40, canvas.height - 41, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
function observe() {
  return { generation, sceneVersion: accepted.version, spriteMode: sprite.data.hitMode,
    pixel: pixel(), top: renderer.hitTest(point), stack: renderer.hitTestAll(point),
    assetBytes: [...(renderer.getImageAsset('Blue')?.pixels ?? [])],
    pointerLog: [...pointerLog], oldLog: [...oldLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  rect.onPointer('pointerdown', () => pointerLog.push('Rect'));
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
  tree.stage.onPointer('pointerdown', () => pointerLog.push('stage'));
}
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const onPointer = event => {
    const bounds = current.getBoundingClientRect();
    const logical = { x: (event.clientX - bounds.left) * 80 / bounds.width,
      y: (event.clientY - bounds.top) * 80 / bounds.height };
    const hits = renderer.hitTestAll(logical);
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
      point: logical, hit: hits[1] ?? hits[0] ?? null });
    show();
  };
  current.addEventListener('pointerdown', onPointer);
  return () => current.removeEventListener('pointerdown', onPointer);
}
/** @param {'auto' | 'none'} mode */
function setSpriteMode(mode) {
  sprite.setHitMode(mode); accepted = tree.snapshot();
  renderer.updateScene(accepted); renderer.render(); show();
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'hit-stack-document.json';
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 160; fresh.height = 160;
  const staged = await stageCanvasDocument(text, fresh, options);
  if (staged.scene.version !== 11 && staged.scene.version !== 12 && staged.scene.version !== 13 && staged.scene.version !== 14 && staged.scene.version !== 15 && staged.scene.version !== 16 && staged.scene.version !== 17) throw new Error('Scene v11, v12 or v13 or v14 or v15 or v16 required');
  const nextTree = createDisplayTreeFromScene(staged.scene);
  const nextRect = nextTree.get('Rect'), nextSprite = nextTree.get('Sprite');
  const bytes = staged.renderer.getImageAsset('Blue')?.pixels;
  if (nextRect?.kind !== 'rect' || nextSprite?.kind !== 'sprite' ||
      !bytes || bytes.length !== image.pixels.length ||
      bytes.some((value, index) => value !== image.pixels[index])) {
    staged.renderer.dispose(); throw new Error('Document handles or asset differ');
  }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  oldLog.push(...pointerLog); pointerLog = [];
  tree = nextTree; rect = nextRect; sprite = nextSprite;
  accepted = staged.scene; generation++; subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind();
document.querySelector('#sprite-none')?.addEventListener('click', () => setSpriteMode('none'));
document.querySelector('#sprite-auto')?.addEventListener('click', () => setSpriteMode('auto'));
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => { output.textContent = String(error); });
  openInput.value = '';
});
Object.assign(window, { __hitStackConsumer: { observe, setSpriteMode, save, openText,
  get renderer() { return renderer; }, get tree() { return tree; } } });
show();
