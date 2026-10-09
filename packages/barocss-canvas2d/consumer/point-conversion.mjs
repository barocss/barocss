// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 120, height: 90 }, dpr: 2 };
const view = { panX: 10, panY: 5, zoom: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y,
  /** @type {number} */ scaleX = 1, /** @type {number} */ scaleY = 1,
  /** @type {number} */ rotation = 0) => ({ x, y, scaleX, scaleY, rotation });
const image = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) };
const localPoint = { x: 5, y: 5 };
let tree = createDisplayTree('PointConversionConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(0, 0),
  width: 120, height: 90, fill: [0.25, 0.25, 0.25, 1] });
let parent = tree.createContainer({ id: 'Parent', layer: 1,
  transform: pose(30, 10, 1.5, 1, Math.PI / 2) });
let sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose(4, 5),
  imageId: 'Atlas', width: 10, height: 10, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0 });
tree.stage.addChild(back); tree.stage.addChild(parent); parent.addChild(sprite);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', image);
renderer.setView(view);
/** @type {import('@barocss/canvas2d').SceneV9 | import('@barocss/canvas2d').SceneV10 | import('@barocss/canvas2d').SceneV11 | import('@barocss/canvas2d').SceneV12 | import('@barocss/canvas2d').SceneV13} */
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
  const world = sprite.toWorld(localPoint);
  const logicalCanvas = { x: world.x * view.zoom + view.panX,
    y: world.y * view.zoom + view.panY };
  const sample = (/** @type {number} */ x, /** @type {number} */ y) =>
    ({ rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null });
  return { generation, sceneVersion: accepted.version, parentTransform: parent.data.transform,
    localPoint, world, roundTrip: sprite.toLocal(world), logicalCanvas,
    assetBytes: [...(renderer.getImageAsset('Atlas')?.pixels ?? [])],
    originalPoint: sample(50, 52), movedPoint: sample(70, 52), pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
  parent.onPointer('pointerdown', () => pointerLog.push('Parent'));
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
  const x = parent.data.transform.x === 30 ? 40 : 30;
  parent.setTransform(pose(x, 10, 1.5, 1, Math.PI / 2));
  submit('Moved parent');
}
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { sprite.toWorld(/** @type {{x:number,y:number}} */ (/** @type {unknown} */ ({ x: -0, y: 5 }))); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected ${code}; retained ${JSON.stringify(observe()) === before}`);
  return code;
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = 'point-conversion-document.json'; link.click();
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
  /** @type {import('@barocss/canvas2d').ContainerHandle} */ let nextParent;
  /** @type {import('@barocss/canvas2d').SpriteHandle} */ let nextSprite;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextBack;
  try {
    if (staged.scene.version !== 9 && staged.scene.version !== 10 && staged.scene.version !== 11 && staged.scene.version !== 12 && staged.scene.version !== 13) throw new Error('Document needs Scene v9, v10 or v11 or v12 or v13');
    nextTree = createDisplayTreeFromScene(staged.scene);
    const container = nextTree.get('Parent'), main = nextTree.get('Sprite');
    const underlay = nextTree.get('Back');
    const bytes = staged.renderer.getImageAsset('Atlas')?.pixels;
    if (container?.kind !== 'container' || main?.kind !== 'sprite' || underlay?.kind !== 'rect' ||
        !bytes || bytes.length !== image.pixels.length ||
        bytes.some((byte, index) => byte !== image.pixels[index])) {
      throw new Error('Document image or display objects differ');
    }
    nextParent = container; nextSprite = main; nextBack = underlay;
    staged.renderer.setView(view); staged.renderer.render();
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; parent = nextParent; sprite = nextSprite; back = nextBack;
  accepted = staged.scene;
  generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened Scene v9, v10 or v11 points');
}
subscribe(); unbind = bind();
document.querySelector('#move')?.addEventListener('click', move);
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(() => show('Open failed'));
  openInput.value = '';
});
Object.assign(window, { __pointConversionConsumer: { observe, move, invalid, save, openText,
  get canvas() { return canvas; } } });
show('Ready with rotated parent and active view');
