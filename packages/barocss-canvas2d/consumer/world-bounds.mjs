// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 120, height: 90 }, dpr: 2 };
const view = { panX: 10, panY: 5, zoom: 1.5 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const image = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) };
let tree = createDisplayTree('WorldBoundsConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(0, 0),
  width: 120, height: 90, fill: [0.25, 0.25, 0.25, 1] });
let parent = tree.createContainer({ id: 'Parent', layer: 1, transform: pose(20, 15) });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(10, 10),
  imageId: 'Atlas', width: 20, height: 20, opacity: 1, sampling: 'nearest',
  anchorX: 0.5, anchorY: 0.5 });
let path = tree.createPath({ id: 'Curve', layer: 2, transform: pose(45, 25),
  commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'Q', cx: 10, cy: 20, x: 20, y: 0 }],
  stroke: { color: [0, 1, 0, 1], width: 2 } });
tree.stage.addChild(back); tree.stage.addChild(parent);
parent.addChild(sprite); parent.addChild(path);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', image);
renderer.setView(view);
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const outline = /** @type {HTMLElement} */ (document.querySelector('#outline'));
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
  const spriteBounds = sprite.getWorldBounds();
  const pathBounds = path.getWorldBounds();
  const sample = (/** @type {number} */ x, /** @type {number} */ y) =>
    ({ rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null });
  return { generation, sceneVersion: accepted.version, parentX: parent.data.transform.x,
    parentAlpha: parent.data.alpha,
    spriteBounds, pathBounds, stageBounds: tree.stage.getWorldBounds(),
    outline: { left: outline.style.left, top: outline.style.top,
      width: outline.style.width, height: outline.style.height },
    assetBytes: [...(renderer.getImageAsset('Atlas')?.pixels ?? [])],
    original: sample(48, 43), moved: sample(63, 43), curve: sample(109, 69),
    pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) {
  const bounds = sprite.getWorldBounds();
  if (!bounds) throw new Error('Sprite has no bounds');
  outline.style.left = `${bounds.x * view.zoom + view.panX}px`;
  outline.style.top = `${bounds.y * view.zoom + view.panY}px`;
  outline.style.width = `${bounds.width * view.zoom}px`;
  outline.style.height = `${bounds.height * view.zoom}px`;
  status.textContent = message;
  output.textContent = JSON.stringify(observe(), null, 2);
}
function subscribe() {
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
  path.onPointer('pointerdown', () => pointerLog.push('Curve'));
  parent.onPointer('pointerdown', () => pointerLog.push('Parent'));
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
  parent.setPosition(parent.data.transform.x === 20 ? 30 : 20, 15);
  submit('Moved parent');
}
function toggleAlpha() {
  parent.setAlpha(parent.data.alpha === 0 ? 1 : 0);
  submit('Changed parent alpha');
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = 'world-bounds-document.json'; link.click();
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
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextPath;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextBack;
  try {
    if (staged.scene.version !== 10) throw new Error('Document needs Scene v10');
    nextTree = createDisplayTreeFromScene(staged.scene);
    const foundParent = nextTree.get('Parent'), foundSprite = nextTree.get('Sprite');
    const foundPath = nextTree.get('Curve'), foundBack = nextTree.get('Back');
    const bytes = staged.renderer.getImageAsset('Atlas')?.pixels;
    if (foundParent?.kind !== 'container' || foundSprite?.kind !== 'sprite' ||
        foundPath?.kind !== 'path' || foundBack?.kind !== 'rect' ||
        !bytes || bytes.length !== image.pixels.length ||
        bytes.some((byte, index) => byte !== image.pixels[index])) {
      throw new Error('Document asset or handles differ');
    }
    nextParent = foundParent; nextSprite = foundSprite; nextPath = foundPath; nextBack = foundBack;
    staged.renderer.setView(view); staged.renderer.render();
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; parent = nextParent; sprite = nextSprite; path = nextPath; back = nextBack;
  accepted = tree.snapshot(); generation++;
  pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened document on a fresh canvas');
}

document.querySelector('#move')?.addEventListener('click', move);
document.querySelector('#alpha')?.addEventListener('click', toggleAlpha);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0];
  if (file) void file.text().then(openText).catch(error => { status.textContent = String(error); });
});
subscribe(); unbind = bind(); show('Ready');
Object.assign(window, { __worldBoundsConsumer: { observe, move, toggleAlpha, save, openText } });
