// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const options = { logicalSize: { width: 32, height: 24 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const pixels = new Uint8Array([
  255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 0, 0, 0, 0, 255, 255,
]);
const crop = { x: 0, y: 0, width: 2, height: 2 };
let tree = createDisplayTree('TiledConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(0, 0),
  width: 32, height: 24, fill: [0.25, 0.25, 0.25, 1] });
let floor = tree.createSprite({ id: 'Floor', layer: 1, transform: pose(4, 4),
  imageId: 'Pattern', width: 5, height: 4, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0, sourceRect: crop,
  tile: { width: 2, height: 2, offsetX: 0, offsetY: 0 } });
tree.stage.addChild(back); tree.stage.addChild(floor);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Pattern', { width: 2, height: 2, pixels });
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
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
  const opaque = { x: 4.5, y: 4.5 }, transparent = { x: 4.5, y: 5.5 };
  return { generation, sceneVersion: accepted.version, width: floor.data.width,
    height: floor.data.height, tile: floor.data.tile,
    pixel: { first: pixel(4, 4), next: pixel(5, 4), repeat: pixel(6, 4),
      partial: pixel(8, 4), transparent: pixel(4, 5), blue: pixel(5, 5),
      bottom: pixel(4, 4 + floor.data.height - 1) },
    hit: renderer.hitTest(opaque), stack: renderer.hitTestAll(opaque),
    transparentStack: renderer.hitTestAll(transparent),
    assetBytes: [...(renderer.getImageAsset('Pattern')?.pixels ?? [])],
    pointerLog: [...pointerLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  floor.onPointer('pointerdown', () => pointerLog.push('Floor'));
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
  floor.setSize(7, 5); accepted = tree.snapshot(); renderer.updateScene(accepted);
  renderer.render(); show();
}
function edit() {
  floor.setTile({ width: 2, height: 2, offsetX: 1, offsetY: 0 });
  accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show();
}
function invalidAsset() {
  floor.setSourceRect({ x: 1, y: 1, width: 2, height: 2 });
  const rejected = tree.snapshot();
  let errorCode = '';
  try { renderer.updateScene(rejected); } catch (error) {
    errorCode = error instanceof Error && 'code' in error ? String(error.code) : String(error);
  }
  floor.setSourceRect(crop);
  show();
  return { errorCode, acceptedVersion: accepted.version, pixel: pixel(4, 4) };
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url;
  anchor.download = 'tiled-sprite-document.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 64; fresh.height = 48;
  const staged = await stageCanvasDocument(text, fresh, options);
  if (staged.scene.version !== 13) throw new Error('Scene v13 required');
  const nextTree = createDisplayTreeFromScene(staged.scene);
  const nextBack = nextTree.get('Back'), nextFloor = nextTree.get('Floor');
  const bytes = staged.renderer.getImageAsset('Pattern')?.pixels;
  if (nextBack?.kind !== 'rect' || nextFloor?.kind !== 'sprite' ||
      !bytes || bytes.length !== pixels.length ||
      bytes.some((value, index) => value !== pixels[index])) {
    staged.renderer.dispose(); throw new Error('Document handles or asset differ');
  }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; back = nextBack; floor = nextFloor;
  accepted = staged.scene; generation++; pointerLog = [];
  subscribe(); unbind = bind(); old.dispose(); show();
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
Object.assign(window, { __tiledSpriteConsumer: { observe, resize, edit, save, invalidAsset,
  get renderer() { return renderer; }, get tree() { return tree; } } });
show();
