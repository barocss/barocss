// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';
import { verifyAlphaComposites } from './alpha-composites.mjs';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const image = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) };
let tree = createDisplayTree('AlphaConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(10, 10),
  width: 80, height: 60, fill: [0.25, 0.25, 0.25, 1] });
let parent = tree.createContainer({ id: 'Parent', layer: 1, transform: pose(0, 0) });
let frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose(20, 20),
  width: 50, height: 40, fill: [0, 0, 1, 1], clip: true });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(0, 0),
  imageId: 'Atlas', width: 20, height: 20, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0 });
let vector = tree.createRect({ id: 'Vector', layer: 2, transform: pose(25, 0),
  width: 15, height: 20, fill: [0, 1, 0, 1] });
tree.stage.addChild(back); tree.stage.addChild(parent); parent.addChild(frame);
frame.addChild(sprite); frame.addChild(vector);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', image);
/** @type {import('@barocss/canvas2d').SceneV10 | import('@barocss/canvas2d').SceneV11 | import('@barocss/canvas2d').SceneV12 | import('@barocss/canvas2d').SceneV13 | import('@barocss/canvas2d').SceneV14 | import('@barocss/canvas2d').SceneV15 | import('@barocss/canvas2d').SceneV16 | import('@barocss/canvas2d').SceneV17 | import('@barocss/canvas2d').SceneV18 | import('@barocss/canvas2d').SceneV19 | import('@barocss/canvas2d').SceneV20 | import('@barocss/canvas2d').SceneV21 | import('@barocss/canvas2d').SceneV22 | import('@barocss/canvas2d').SceneV24 | import('@barocss/canvas2d').SceneV25} */
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
    parentAlpha: parent.data.alpha, frameAlpha: frame.data.alpha,
    spriteAlpha: sprite.data.alpha, spriteOpacity: sprite.data.opacity,
    assetBytes: [...(renderer.getImageAsset('Atlas')?.pixels ?? [])],
    spritePoint: sample(30, 30), vectorPoint: sample(50, 30),
    framePoint: sample(65, 55), backPoint: sample(15, 15), pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
  vector.onPointer('pointerdown', () => pointerLog.push('Vector'));
  back.onPointer('pointerdown', () => pointerLog.push('Back'));
  frame.onPointer('pointerdown', () => pointerLog.push('Frame'));
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
/** @param {number} alpha */
function setParentAlpha(alpha) { parent.setAlpha(alpha); submit(`Parent alpha ${alpha}`); }
/** @param {number} alpha */
function setSpriteAlpha(alpha) { sprite.setAlpha(alpha); submit(`Sprite alpha ${alpha}`); }
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { parent.setAlpha(-0); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected ${code}; retained ${JSON.stringify(observe()) === before}`);
  return code;
}
function invalidZeroAsset() {
  const before = JSON.stringify(observe());
  const next = structuredClone(tree.snapshot());
  const container = next.nodes.find(node => node.id === 'Parent');
  if (container?.kind !== 'group') throw new Error('Parent is missing');
  const frameNode = container.children.find(node => node.id === 'Frame');
  if (frameNode?.kind !== 'frame') throw new Error('Frame is missing');
  const imageNode = frameNode.children.find(node => node.id === 'Sprite');
  if (imageNode?.kind !== 'image') throw new Error('Sprite is missing');
  container.alpha = 0; imageNode.imageId = 'Missing';
  let missingCode = 'ACCEPTED';
  try { renderer.updateScene(next); }
  catch (error) { missingCode = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  imageNode.imageId = 'Atlas'; imageNode.sourceRect = { x: 1, y: 0, width: 1, height: 1 };
  let cropCode = 'ACCEPTED';
  try { renderer.updateScene(next); }
  catch (error) { cropCode = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  const retained = JSON.stringify(observe()) === before;
  show(`Zero-alpha asset ${missingCode}; crop ${cropCode}; retained ${retained}`);
  return { missingCode, cropCode, retained };
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = 'alpha-document.json'; link.click();
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
  /** @type {import('@barocss/canvas2d').FrameHandle} */ let nextFrame;
  /** @type {import('@barocss/canvas2d').SpriteHandle} */ let nextSprite;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextBack;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextVector;
  try {
    if (staged.scene.version !== 10 && staged.scene.version !== 11 && staged.scene.version !== 12 && staged.scene.version !== 13 && staged.scene.version !== 14 && staged.scene.version !== 15 && staged.scene.version !== 16 && staged.scene.version !== 17) throw new Error('Document needs Scene v10 or v11 or v12 or v13 or v14 or v15 or v16');
    nextTree = createDisplayTreeFromScene(staged.scene);
    const container = nextTree.get('Parent'), frameHandle = nextTree.get('Frame');
    const main = nextTree.get('Sprite'), underlay = nextTree.get('Back');
    const vectorHandle = nextTree.get('Vector');
    const bytes = staged.renderer.getImageAsset('Atlas')?.pixels;
    if (container?.kind !== 'container' || frameHandle?.kind !== 'frame' ||
        main?.kind !== 'sprite' || underlay?.kind !== 'rect' || vectorHandle?.kind !== 'rect' ||
        !bytes || bytes.length !== image.pixels.length ||
        bytes.some((byte, index) => byte !== image.pixels[index])) {
      throw new Error('Document image or display objects differ');
    }
    nextParent = container; nextFrame = frameHandle; nextSprite = main;
    nextBack = underlay; nextVector = vectorHandle;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; parent = nextParent; frame = nextFrame; sprite = nextSprite;
  back = nextBack; vector = nextVector;
  accepted = staged.scene;
  generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show(`Opened Scene v${accepted.version} alpha`);
}
subscribe(); unbind = bind();
document.querySelector('#half')?.addEventListener('click', () => setParentAlpha(0.5));
document.querySelector('#zero')?.addEventListener('click', () => setParentAlpha(0));
document.querySelector('#full')?.addEventListener('click', () => setParentAlpha(1));
document.querySelector('#sprite-half')?.addEventListener('click', () => setSpriteAlpha(0.5));
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#invalid-asset')?.addEventListener('click', invalidZeroAsset);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __alphaConsumer: { observe, setParentAlpha, setSpriteAlpha, verifyAlphaComposites,
  invalid, invalidZeroAsset, save, openText, get canvas() { return canvas; } } });
show('Ready with full alpha');
