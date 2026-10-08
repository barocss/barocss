// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const image = { width: 2, height: 1, pixels: new Uint8Array([
  255, 255, 255, 255, 255, 255, 255, 0,
]) };
const opaque = { x: 0, y: 0, width: 1, height: 1 };
const clear = { x: 1, y: 0, width: 1, height: 1 };
let tree = createDisplayTree('TintConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(10, 10),
  width: 70, height: 60, fill: [1, 1, 0, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20),
  imageId: 'Atlas', sourceRect: opaque, width: 50, height: 50,
  opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
tree.stage.addChild(back); tree.stage.addChild(sprite);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', image);
/** @type {import('@barocss/canvas2d').Scene} */
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[35, 40], [60, 40]];
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
  return { generation, sceneVersion: accepted.version, tint: sprite.data.tint,
    sourceRect: sprite.data.sourceRect ?? null,
    scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()),
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
/** @param {import('@barocss/canvas2d').Tint} tint */
function setTint(tint) { sprite.setTint(tint); submit(`Tint ${tint.join(',')}`); }
/** @param {import('@barocss/canvas2d').SourceRect} rect */
function setCrop(rect) { sprite.setSourceRect(rect); submit(`Crop ${rect.x}`); }
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { sprite.setTint([1, NaN, 1]); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected ${code}; retained ${JSON.stringify(observe()) === before}`);
  return code;
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = 'sprite-tint-document.json'; link.click();
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
  try {
    if (staged.scene.version !== 7 && staged.scene.version !== 8 && staged.scene.version !== 9) throw new Error('Document needs Scene v7, v8 or v9');
    nextTree = createDisplayTreeFromScene(staged.scene);
    const imageNode = nextTree.get('Sprite'), underlay = nextTree.get('Back');
    const bytes = staged.renderer.getImageAsset('Atlas')?.pixels;
    if (imageNode?.kind !== 'sprite' || underlay?.kind !== 'rect' || !bytes ||
        bytes.length !== image.pixels.length || bytes.some((byte, index) => byte !== image.pixels[index])) {
      throw new Error('Document image or display objects differ');
    }
    nextSprite = imageNode; nextBack = underlay;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; sprite = nextSprite; back = nextBack;
  accepted = staged.scene;
  generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show(`Opened tinted Scene v${accepted.version}`);
}
subscribe(); unbind = bind();
document.querySelector('#white')?.addEventListener('click', () => setTint([1, 1, 1]));
document.querySelector('#cyan')?.addEventListener('click', () => setTint([0, 1, 1]));
document.querySelector('#black')?.addEventListener('click', () => setTint([0, 0, 0]));
document.querySelector('#transparent')?.addEventListener('click', () => setCrop(clear));
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __spriteTintConsumer: { observe, setTint, setCrop, invalid, save, openText,
  get canvas() { return canvas; }, opaque, clear } });
show('Ready with white tint');
