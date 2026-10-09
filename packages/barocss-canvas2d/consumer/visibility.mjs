// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const image = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 128]) };
let tree = createDisplayTree('VisibilityConsumer');
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(10, 10),
  width: 80, height: 60, fill: [0.25, 0.25, 0.25, 1] });
let parent = tree.createContainer({ id: 'Parent', layer: 1, transform: pose(0, 0) });
let frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose(20, 20),
  width: 40, height: 40, fill: [0.25, 0.25, 0.25, 1], clip: true });
let sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose(0, 0),
  imageId: 'Atlas', width: 30, height: 30, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0 });
tree.stage.addChild(back); tree.stage.addChild(parent); parent.addChild(frame); frame.addChild(sprite);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', image);
/** @type {import('@barocss/canvas2d').SceneV9 | import('@barocss/canvas2d').SceneV10 | import('@barocss/canvas2d').SceneV11 | import('@barocss/canvas2d').SceneV12 | import('@barocss/canvas2d').SceneV13 | import('@barocss/canvas2d').SceneV14 | import('@barocss/canvas2d').SceneV15 | import('@barocss/canvas2d').SceneV16 | import('@barocss/canvas2d').SceneV17 | import('@barocss/canvas2d').SceneV18 | import('@barocss/canvas2d').SceneV19 | import('@barocss/canvas2d').SceneV20 | import('@barocss/canvas2d').SceneV21} */
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
  const point = { x: 30, y: 30 };
  return { generation, sceneVersion: accepted.version,
    spriteVisible: sprite.data.visible, frameVisible: frame.data.visible,
    parentVisible: parent.data.visible,
    assetBytes: [...(renderer.getImageAsset('Atlas')?.pixels ?? [])],
    spritePoint: { rgba: pixel(point.x, point.y), hit: renderer.hitTest(point)?.id ?? null },
    framePoint: { rgba: pixel(55, 55), hit: renderer.hitTest({ x: 55, y: 55 })?.id ?? null },
    backPoint: { rgba: pixel(15, 15), hit: renderer.hitTest({ x: 15, y: 15 })?.id ?? null },
    pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
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
/** @param {boolean} visible */
function setSpriteVisible(visible) { sprite.setVisible(visible); submit(`Sprite ${visible}`); }
/** @param {boolean} visible */
function setFrameVisible(visible) { frame.setVisible(visible); submit(`Frame ${visible}`); }
/** @param {boolean} visible */
function setParentVisible(visible) { parent.setVisible(visible); submit(`Parent ${visible}`); }
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { sprite.setVisible(/** @type {boolean} */ (/** @type {unknown} */ ('false'))); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected ${code}; retained ${JSON.stringify(observe()) === before}`);
  return code;
}
function invalidHiddenAsset() {
  const before = JSON.stringify(observe());
  const next = structuredClone(tree.snapshot());
  const container = next.nodes.find(node => node.id === 'Parent');
  if (container?.kind !== 'group') throw new Error('Parent is missing');
  const frameNode = container.children.find(node => node.id === 'Frame');
  if (frameNode?.kind !== 'frame') throw new Error('Frame is missing');
  const imageNode = frameNode.children.find(node => node.id === 'Sprite');
  if (imageNode?.kind !== 'image') throw new Error('Sprite is missing');
  container.visible = false;
  imageNode.imageId = 'Missing';
  let missingCode = 'ACCEPTED';
  try { renderer.updateScene(next); }
  catch (error) { missingCode = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  imageNode.imageId = 'Atlas';
  imageNode.sourceRect = { x: 1, y: 0, width: 1, height: 1 };
  let cropCode = 'ACCEPTED';
  try { renderer.updateScene(next); }
  catch (error) { cropCode = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  const retained = JSON.stringify(observe()) === before;
  show(`Hidden asset ${missingCode}; crop ${cropCode}; retained ${retained}`);
  return { missingCode, cropCode, retained };
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = 'visibility-document.json'; link.click();
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
  try {
    if (staged.scene.version !== 9 && staged.scene.version !== 10 && staged.scene.version !== 11 && staged.scene.version !== 12 && staged.scene.version !== 13 && staged.scene.version !== 14 && staged.scene.version !== 15 && staged.scene.version !== 16 && staged.scene.version !== 17) throw new Error('Document needs Scene v9, v10 or v11 or v12 or v13 or v14 or v15 or v16');
    nextTree = createDisplayTreeFromScene(staged.scene);
    const container = nextTree.get('Parent'), frameHandle = nextTree.get('Frame');
    const main = nextTree.get('Sprite'), underlay = nextTree.get('Back');
    const bytes = staged.renderer.getImageAsset('Atlas')?.pixels;
    if (container?.kind !== 'container' || frameHandle?.kind !== 'frame' ||
        main?.kind !== 'sprite' || underlay?.kind !== 'rect' ||
        !bytes || bytes.length !== image.pixels.length ||
        bytes.some((byte, index) => byte !== image.pixels[index])) {
      throw new Error('Document image or display objects differ');
    }
    nextParent = container; nextFrame = frameHandle; nextSprite = main; nextBack = underlay;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; parent = nextParent; frame = nextFrame; sprite = nextSprite; back = nextBack;
  accepted = staged.scene;
  generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened Scene v9, v10 or v11 visibility');
}
subscribe(); unbind = bind();
document.querySelector('#sprite-hide')?.addEventListener('click', () => setSpriteVisible(false));
document.querySelector('#sprite-show')?.addEventListener('click', () => setSpriteVisible(true));
document.querySelector('#frame-hide')?.addEventListener('click', () => setFrameVisible(false));
document.querySelector('#frame-show')?.addEventListener('click', () => setFrameVisible(true));
document.querySelector('#parent-hide')?.addEventListener('click', () => setParentVisible(false));
document.querySelector('#parent-show')?.addEventListener('click', () => setParentVisible(true));
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#invalid-asset')?.addEventListener('click', invalidHiddenAsset);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __visibilityConsumer: { observe, setSpriteVisible, setFrameVisible, setParentVisible,
  invalid, invalidHiddenAsset, save, openText, get canvas() { return canvas; } } });
show('Ready with visible sprite');
