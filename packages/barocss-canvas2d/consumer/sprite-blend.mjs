// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const image = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 128]) };
let tree = createDisplayTree('BlendConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(10, 10),
  width: 80, height: 60, fill: [0.25, 0.25, 0.25, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20),
  imageId: 'Atlas', width: 30, height: 30, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0, tint: [1, 1, 1] });
let follower = tree.createSprite({ id: 'Follower', layer: 2, transform: pose(55, 20),
  imageId: 'Atlas', width: 30, height: 30, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0, tint: [1, 1, 1] });
tree.stage.addChild(back); tree.stage.addChild(sprite); tree.stage.addChild(follower);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', image);
/** @type {import('@barocss/canvas2d').SceneV8 | import('@barocss/canvas2d').SceneV9 | import('@barocss/canvas2d').SceneV10 | import('@barocss/canvas2d').SceneV11 | import('@barocss/canvas2d').SceneV12 | import('@barocss/canvas2d').SceneV13 | import('@barocss/canvas2d').SceneV14 | import('@barocss/canvas2d').SceneV15 | import('@barocss/canvas2d').SceneV16 | import('@barocss/canvas2d').SceneV17 | import('@barocss/canvas2d').SceneV18 | import('@barocss/canvas2d').SceneV19 | import('@barocss/canvas2d').SceneV20 | import('@barocss/canvas2d').SceneV21 | import('@barocss/canvas2d').SceneV22 | import('@barocss/canvas2d').SceneV23} */
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[30, 30], [65, 30], [87, 30]];
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
  return { generation, sceneVersion: accepted.version, blendMode: sprite.data.blendMode,
    followerMode: follower.data.blendMode, acceptedMode: accepted.nodes[1]?.kind === 'image'
      ? accepted.nodes[1].blendMode : null,
    assetBytes: [...(renderer.getImageAsset('Atlas')?.pixels ?? [])],
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
/** @param {string} message */
function submit(message) {
  const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message);
}
/** @param {'normal' | 'add'} mode */
function setBlendMode(mode) { sprite.setBlendMode(mode); submit(`Blend ${mode}`); }
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { sprite.setBlendMode(/** @type {'add'} */ (/** @type {unknown} */ ('multiply'))); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected ${code}; retained ${JSON.stringify(observe()) === before}`);
  return code;
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = 'sprite-blend-document.json'; link.click();
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
  /** @type {import('@barocss/canvas2d').SpriteHandle} */ let nextFollower;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextBack;
  try {
    if (staged.scene.version !== 8 && staged.scene.version !== 9 && staged.scene.version !== 10 && staged.scene.version !== 11 && staged.scene.version !== 12 && staged.scene.version !== 13 && staged.scene.version !== 14 && staged.scene.version !== 15 && staged.scene.version !== 16 && staged.scene.version !== 17) throw new Error('Document needs Scene v8, v9, v10 or v11 or v12 or v13 or v14 or v15 or v16');
    nextTree = createDisplayTreeFromScene(staged.scene);
    const main = nextTree.get('Sprite'), next = nextTree.get('Follower'), underlay = nextTree.get('Back');
    const bytes = staged.renderer.getImageAsset('Atlas')?.pixels;
    if (main?.kind !== 'sprite' || next?.kind !== 'sprite' || underlay?.kind !== 'rect' ||
        !bytes || bytes.length !== image.pixels.length ||
        bytes.some((byte, index) => byte !== image.pixels[index])) {
      throw new Error('Document image or display objects differ');
    }
    nextSprite = main; nextFollower = next; nextBack = underlay;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; sprite = nextSprite; follower = nextFollower; back = nextBack;
  accepted = staged.scene;
  generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened Scene blend');
}
subscribe(); unbind = bind();
document.querySelector('#normal')?.addEventListener('click', () => setBlendMode('normal'));
document.querySelector('#add')?.addEventListener('click', () => setBlendMode('add'));
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __spriteBlendConsumer: { observe, setBlendMode, invalid, save, openText,
  get canvas() { return canvas; } } });
show('Ready with normal blend');
