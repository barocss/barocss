// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 80, height: 80 }, dpr: 2 };
const pose = { x: 10, y: 10, scaleX: 1, scaleY: 1, rotation: 0 };
const image = { width: 1, height: 1, pixels: new Uint8Array([0, 0, 255, 255]) };
let tree = createDisplayTree('HoverConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose,
  width: 50, height: 50, fill: [1, 0, 0, 1] });
let parent = tree.createContainer({ id: 'Parent', layer: 1,
  transform: { ...pose, x: 0, y: 0 } });
let frame = tree.createFrame({ id: 'Frame', layer: 0,
  transform: { ...pose, x: 0, y: 0 }, width: 50, height: 50,
  fill: [0, 0, 0, 0], clip: true });
let sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose,
  imageId: 'Atlas', width: 50, height: 50, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0 });
tree.stage.addChild(back); tree.stage.addChild(parent); parent.addChild(frame); frame.addChild(sprite);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', image);
/** @type {import('@barocss/canvas2d').SceneV11} */
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let log = [];
/** @type {string[]} */ const oldLog = [];
/** @type {() => void} */ let unbind = () => {};
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
function subscribe() {
  for (const handle of [back, parent, frame, sprite]) {
    for (const type of /** @type {const} */ (['pointerenter', 'pointerleave'])) {
      handle.onHover(type, event => log.push(`${event.pointerId}:${event.type}:${handle.id}`));
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
  const point = { x: 20, y: 20 };
  return { generation, sceneVersion: accepted.version, pixel: pixel(20, 20),
    hit: renderer.hitTest(point)?.id ?? null, spriteMode: sprite.data.hitMode,
    assetBytes: [...(renderer.getImageAsset('Atlas')?.pixels ?? [])],
    log: [...log], oldLog: [...oldLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const move = event => {
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * 80 / bounds.width,
      y: (event.clientY - bounds.top) * 80 / bounds.height };
    tree.dispatchHover({ pointerId: event.pointerId, point, hit: renderer.hitTest(point) });
    show();
  };
  current.addEventListener('pointermove', move);
  current.addEventListener('pointerleave', move);
  return () => { current.removeEventListener('pointermove', move);
    current.removeEventListener('pointerleave', move); };
}
/** @param {'auto' | 'none'} mode */
function setBlueMode(mode) {
  sprite.setHitMode(mode); accepted = tree.snapshot();
  renderer.updateScene(accepted); renderer.render(); show();
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'hover-document.json';
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 160; fresh.height = 160;
  const staged = await stageCanvasDocument(text, fresh, options);
  if (staged.scene.version !== 11) throw new Error('Scene v11 required');
  const nextTree = createDisplayTreeFromScene(staged.scene);
  const nextBack = nextTree.get('Back'), nextParent = nextTree.get('Parent');
  const nextFrame = nextTree.get('Frame'), nextSprite = nextTree.get('Sprite');
  const bytes = staged.renderer.getImageAsset('Atlas')?.pixels;
  if (nextBack?.kind !== 'rect' || nextParent?.kind !== 'container' ||
      nextFrame?.kind !== 'frame' || nextSprite?.kind !== 'sprite' ||
      !bytes || bytes.some((value, index) => value !== image.pixels[index])) {
    staged.renderer.dispose(); throw new Error('Document handles or asset differ');
  }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  oldLog.push(...log); log = [];
  tree = nextTree; back = nextBack; parent = nextParent; frame = nextFrame; sprite = nextSprite;
  accepted = staged.scene; generation++; subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind();
document.querySelector('#blue-none')?.addEventListener('click', () => setBlueMode('none'));
document.querySelector('#blue-auto')?.addEventListener('click', () => setBlueMode('auto'));
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => { output.textContent = String(error); });
  openInput.value = '';
});
Object.assign(window, { __hoverConsumer: { observe, setBlueMode, save, openText,
  get canvas() { return canvas; } } });
show();
