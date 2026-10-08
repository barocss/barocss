// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene,
  createSpriteAnimation, createSpriteAtlas, createTicker, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const atlasImage = { width: 3, height: 1, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 0,
]) };
const entries = [
  { name: 'Red', sourceRect: { x: 0, y: 0, width: 1, height: 1 }, durationMS: 40 },
  { name: 'Blue', sourceRect: { x: 1, y: 0, width: 1, height: 1 }, durationMS: 60 },
  { name: 'Clear', sourceRect: { x: 2, y: 0, width: 1, height: 1 }, durationMS: 20 },
];
const sheet = createSpriteAtlas('Atlas', { width: 3, height: 1 }, entries);
const frames = sheet.sequence(['Red', 'Blue', 'Clear']);
let tree = createDisplayTree('SpriteAtlasConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(10, 10),
  width: 70, height: 60, fill: [1, 1, 0, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20),
  imageId: 'Atlas', sourceRect: { x: 0, y: 0, width: 1, height: 1 },
  width: 50, height: 50, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
tree.stage.addChild(back); tree.stage.addChild(sprite);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', atlasImage);
let animation = createSpriteAnimation(sprite, frames);
/** @type {import('@barocss/canvas2d').SceneV6} */
let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[35, 40], [60, 40]];

/** @type {{token:number, callback:(timestampMS:number)=>void}|null} */ let pending = null;
let nextToken = 0;
let clockMS = 0;
const scheduler = {
  /** @param {(timestampMS:number)=>void} callback */
  requestFrame(callback) {
    if (pending) throw new Error('one pending frame expected');
    const token = ++nextToken; pending = { token, callback }; return token;
  },
  /** @param {unknown} token */
  cancelFrame(token) { if (pending?.token === token) pending = null; },
};
let ticker = createTicker(scheduler);

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
  return { generation, frameIndex: animation.frameIndex, playing: animation.playing,
    tickerRunning: ticker.running, imageId: sprite.data.imageId,
    sourceRect: sprite.data.sourceRect ?? null, scene: stringifySceneJSON(accepted),
    treeScene: stringifySceneJSON(tree.snapshot()),
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y),
      hit: renderer.hitTest({ x, y })?.id ?? null })), pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
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
function bindTicker() {
  ticker.onTick(info => {
    if (animation.advance(info.deltaMS)) {
      accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
    }
    show(`Tick ${info.deltaMS} ms`);
  });
}
bindTicker();
/** @param {number} milliseconds */
function tick(milliseconds) {
  if (!pending) throw new Error('ticker is not waiting for a frame');
  const current = pending; pending = null; clockMS += milliseconds;
  current.callback(clockMS);
}
function start() { animation.play(); ticker.start(); show('Started'); }
function pause() { ticker.stop(); animation.pause(); show('Paused'); }
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'sprite-atlas-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').SpriteHandle} */ let nextSprite;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextBack;
  /** @type {import('@barocss/canvas2d').SpriteAnimation} */ let nextAnimation;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const image = nextTree.get('Sprite'), underlay = nextTree.get('Back');
    if (image?.kind !== 'sprite' || underlay?.kind !== 'rect' ||
        image.data.imageId !== 'Atlas' || image.data.sourceRect?.x !== 2) {
      throw new Error('Document does not contain the saved animation frame');
    }
    nextSprite = image; nextBack = underlay;
    const reopened = staged.renderer.getImageAsset('Atlas');
    if (!reopened || reopened.width !== atlasImage.width || reopened.height !== atlasImage.height ||
        reopened.pixels.some((byte, index) => byte !== atlasImage.pixels[index])) {
      throw new Error('Document atlas bytes differ');
    }
    const nextSheet = createSpriteAtlas('Atlas', { width: reopened.width, height: reopened.height }, entries);
    nextAnimation = createSpriteAnimation(nextSprite, nextSheet.sequence(['Red', 'Blue', 'Clear']),
      { initialFrameIndex: 2 });
  } catch (error) { staged.renderer.dispose(); throw error; }
  ticker.dispose(); animation.dispose(); unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; sprite = nextSprite; back = nextBack; animation = nextAnimation;
  accepted = /** @type {import('@barocss/canvas2d').SceneV6} */ (staged.scene);
  generation++; pointerLog = []; clockMS = 0; pending = null;
  ticker = createTicker(scheduler); bindTicker(); subscribe(); unbind = bind(); old.dispose();
  show('Opened saved frame 2');
}
subscribe(); unbind = bind();
document.querySelector('#start')?.addEventListener('click', start);
document.querySelector('#tick40')?.addEventListener('click', () => tick(40));
document.querySelector('#tick60')?.addEventListener('click', () => tick(60));
document.querySelector('#tick20')?.addEventListener('click', () => tick(20));
document.querySelector('#pause')?.addEventListener('click', pause);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __spriteAtlasConsumer: { observe, start, pause, tick, save, openText,
  get canvas() { return canvas; } } });
show('Ready at frame 0');
