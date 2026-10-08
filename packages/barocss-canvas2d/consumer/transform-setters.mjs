// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const image = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) };
let tree = createDisplayTree('TransformSettersConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(0, 0),
  width: 100, height: 80, fill: [0.25, 0.25, 0.25, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(10, 10),
  imageId: 'Atlas', width: 10, height: 10, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0 });
let line = tree.createLine({ id: 'Line', layer: 2, transform: pose(70, 20),
  x1: 0, y1: 0, x2: 20, y2: 0, width: 4, stroke: [0, 0, 1, 1] });
tree.stage.addChild(back); tree.stage.addChild(sprite); tree.stage.addChild(line);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', image);
/** @type {import('@barocss/canvas2d').SceneV9 | import('@barocss/canvas2d').SceneV10} */
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
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
  const sample = (/** @type {number} */ x, /** @type {number} */ y) =>
    ({ rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null });
  return { generation, sceneVersion: accepted.version,
    spriteTransform: sprite.data.transform, lineTransform: line.data.transform,
    assetBytes: [...(renderer.getImageAsset('Atlas')?.pixels ?? [])],
    oldSprite: sample(15, 15), movedSprite: sample(35, 25), scaledSprite: sample(45, 35),
    editedSprite: sample(65, 25),
    oldLine: sample(80, 20), rotatedLine: sample(70, 30), pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
  line.onPointer('pointerdown', () => pointerLog.push('Line'));
  back.onPointer('pointerdown', () => pointerLog.push('Back'));
  tree.stage.onPointer('pointerdown', () => pointerLog.push('stage'));
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
    show('Dispatched pointerdown');
  };
  current.addEventListener('pointerdown', onPointer);
  return () => current.removeEventListener('pointerdown', onPointer);
}
/** @param {string} message */
function submit(message) {
  const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message);
}
function move() {
  sprite.setPosition(sprite.data.transform.x === 30 ? 50 : 30, 20);
  submit('Moved sprite');
}
function scale() { sprite.setScale(2, 2); submit('Scaled sprite'); }
function rotate() { line.setRotation(Math.PI / 2); submit('Rotated line'); }
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { sprite.setScale(0, 1); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected ${code}; retained ${JSON.stringify(observe()) === before}`);
  return code;
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = 'transform-setters-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  fresh.width = options.logicalSize.width * options.dpr;
  fresh.height = options.logicalSize.height * options.dpr;
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').SpriteHandle} */ let nextSprite;
  /** @type {import('@barocss/canvas2d').LineHandle} */ let nextLine;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextBack;
  try {
    if (staged.scene.version !== 9 && staged.scene.version !== 10) throw new Error('Document needs Scene v9 or v10');
    nextTree = createDisplayTreeFromScene(staged.scene);
    const main = nextTree.get('Sprite'), stroke = nextTree.get('Line'), underlay = nextTree.get('Back');
    const bytes = staged.renderer.getImageAsset('Atlas')?.pixels;
    if (main?.kind !== 'sprite' || stroke?.kind !== 'line' || underlay?.kind !== 'rect' ||
        !bytes || bytes.length !== image.pixels.length ||
        bytes.some((byte, index) => byte !== image.pixels[index])) {
      throw new Error('Document image or display objects differ');
    }
    nextSprite = main; nextLine = stroke; nextBack = underlay;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; sprite = nextSprite; line = nextLine; back = nextBack;
  accepted = staged.scene;
  generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened Scene v9 or v10 transforms');
}
subscribe(); unbind = bind();
document.querySelector('#move')?.addEventListener('click', move);
document.querySelector('#scale')?.addEventListener('click', scale);
document.querySelector('#rotate')?.addEventListener('click', rotate);
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: error`));
  openInput.value = '';
});
Object.assign(window, { __transformSettersConsumer: { observe, move, scale, rotate, invalid, save,
  openText, get canvas() { return canvas; } } });
show('Ready with unmodified transforms');
