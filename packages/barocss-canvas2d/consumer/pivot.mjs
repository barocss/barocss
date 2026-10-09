// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 80, height: 80 }, dpr: 2 };
/** @param {number} x @param {number} y @param {number} rotation */
const pose = (x, y, rotation = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation });
const image = { width: 2, height: 2, pixels: new Uint8Array([
  0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255,
]) };
let tree = createDisplayTree('PivotConsumer');
let back = tree.createRect({ id: 'Back', layer: -1, transform: pose(0, 0),
  width: 80, height: 80, fill: [0.25, 0.25, 0.25, 1] });
let rect = tree.createRect({ id: 'Rect', layer: 1, transform: pose(20, 20, Math.PI / 2),
  width: 10, height: 4, fill: [1, 0, 0, 1] });
let parent = tree.createContainer({ id: 'Parent', layer: 2, transform: pose(50, 35) });
let sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose(0, 0),
  imageId: 'Atlas', width: 4, height: 4, opacity: 1, sampling: 'nearest', anchorX: 0.5, anchorY: 0.5 });
let frame = tree.createFrame({ id: 'Frame', layer: 3, transform: pose(60, 55),
  width: 10, height: 10, fill: [0, 0, 0, 0], clip: true });
let green = tree.createRect({ id: 'Green', layer: 0, transform: pose(8, 0),
  width: 10, height: 10, fill: [0, 1, 0, 1] });
tree.stage.addChild(back); tree.stage.addChild(rect); tree.stage.addChild(parent);
parent.addChild(sprite); tree.stage.addChild(frame); frame.addChild(green);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', image);
/** @type {import('@barocss/canvas2d').SceneV14 | import('@barocss/canvas2d').SceneV15 | import('@barocss/canvas2d').SceneV16 | import('@barocss/canvas2d').SceneV17 | import('@barocss/canvas2d').SceneV18 | import('@barocss/canvas2d').SceneV19 | import('@barocss/canvas2d').SceneV20 | import('@barocss/canvas2d').SceneV21} */
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string | null} */ let invalidError = null;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
function subscribe() {
  rect.onPointer('pointerdown', event => pointerLog.push(`Rect:${event.target?.id}`));
  tree.stage.onPointer('pointerdown', event => pointerLog.push(`stage:${event.target?.id ?? 'none'}`));
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
  /** @param {number} x @param {number} y */
  const sample = (x, y) => ({ pixel: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null });
  return { generation, sceneVersion: accepted.version,
    oldRect: sample(17, 27), newRect: sample(19, 17),
    oldSprite: sample(50, 35), parentSprite: sample(43, 35), pivotSprite: sample(41, 35),
    oldClip: sample(69, 56), newClip: sample(67, 56), outsideClip: sample(72, 56),
    rectPivot: rect.data.pivot ?? null, parentPivot: parent.data.pivot ?? null,
    spritePivot: sprite.data.pivot ?? null, framePivot: frame.data.pivot ?? null,
    rectWorld: rect.getWorldBounds(), rectLocal: rect.getLocalBounds(),
    rectCenterWorld: rect.toWorld({ x: 5, y: 2 }),
    rectCenterLocal: rect.toLocal(rect.toWorld({ x: 5, y: 2 })),
    assetBytes: [...(renderer.getImageAsset('Atlas')?.pixels ?? [])],
    invalidError, pointerLog: [...pointerLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function submit() { accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show(); }
function setRectPivot() { rect.setPivot(5, 2); submit(); }
function resetRectPivot() { rect.setPivot(0, 0); submit(); }
function setParentPivot() { parent.setPivot(6, 0); submit(); }
function setSpritePivot() { sprite.setPivot(1, 0); submit(); }
function setFramePivot() { frame.setPivot(2, 0); submit(); }
function rejectPivot() {
  try { rect.setPivot(NaN, 0); } catch (error) {
    invalidError = error instanceof Error && 'code' in error ? String(error.code) : String(error);
  }
  show();
}
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const down = event => {
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * 80 / bounds.width,
      y: (event.clientY - bounds.top) * 80 / bounds.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
      point, hit: renderer.hitTest(point) });
    show();
  };
  current.addEventListener('pointerdown', down);
  return () => current.removeEventListener('pointerdown', down);
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'pivot-document.json';
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 160; fresh.height = 160;
  const staged = await stageCanvasDocument(text, fresh, options);
  if (staged.scene.version !== 14 && staged.scene.version !== 15 && staged.scene.version !== 16 && staged.scene.version !== 17) throw new Error('Scene v14 or v15 or v16 required');
  const nextTree = createDisplayTreeFromScene(staged.scene);
  const nextBack = nextTree.get('Back'), nextRect = nextTree.get('Rect');
  const nextParent = nextTree.get('Parent'), nextSprite = nextTree.get('Sprite');
  const nextFrame = nextTree.get('Frame'), nextGreen = nextTree.get('Green');
  const bytes = staged.renderer.getImageAsset('Atlas')?.pixels;
  if (nextBack?.kind !== 'rect' || nextRect?.kind !== 'rect' ||
      nextParent?.kind !== 'container' || nextSprite?.kind !== 'sprite' ||
      nextFrame?.kind !== 'frame' || nextGreen?.kind !== 'rect' ||
      !bytes || bytes.some((value, index) => value !== image.pixels[index])) {
    staged.renderer.dispose(); throw new Error('Document handles or bytes differ');
  }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; back = nextBack; rect = nextRect; parent = nextParent;
  sprite = nextSprite; frame = nextFrame; green = nextGreen;
  accepted = staged.scene; generation++; pointerLog = []; invalidError = null;
  subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind();
document.querySelector('#rect-pivot')?.addEventListener('click', setRectPivot);
document.querySelector('#rect-reset')?.addEventListener('click', resetRectPivot);
document.querySelector('#parent-pivot')?.addEventListener('click', setParentPivot);
document.querySelector('#sprite-pivot')?.addEventListener('click', setSpritePivot);
document.querySelector('#frame-pivot')?.addEventListener('click', setFramePivot);
document.querySelector('#invalid')?.addEventListener('click', rejectPivot);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => { output.textContent = String(error); });
  openInput.value = '';
});
Object.assign(window, { __pivotConsumer: { observe, save, openText, setRectPivot, resetRectPivot,
  setParentPivot, setSpritePivot, setFramePivot, rejectPivot,
  get canvas() { return canvas; } } });
show();
