// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 90, height: 70 }, dpr: 2 };
/** @param {number} x @param {number} y */
const pose = (x, y) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const image = { width: 2, height: 2, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 255, 0, 255,
  0, 0, 255, 255, 255, 255, 0, 255,
]) };
let tree = createDisplayTree('SignedScaleConsumer');
let back = tree.createRect({ id: 'Back', layer: -1, transform: pose(0, 0), width: 90, height: 70,
  fill: [0.25, 0.25, 0.25, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 15), pivot: { x: 6, y: 3 },
  imageId: 'Atlas', width: 12, height: 6, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
let parent = tree.createContainer({ id: 'Parent', layer: 2, transform: pose(60, 18), pivot: { x: 3, y: 0 } });
let child = tree.createRect({ id: 'Child', layer: 0, transform: pose(0, 0), width: 2, height: 4,
  fill: [1, 0, 1, 1] });
let rect = tree.createRect({ id: 'Rect', layer: 3, transform: pose(20, 45), pivot: { x: 3, y: 1 },
  width: 6, height: 2, fill: [0, 1, 1, 1] });
let frame = tree.createFrame({ id: 'Frame', layer: 4, transform: pose(75, 45), width: 10, height: 10,
  fill: [0, 0, 0, 0], clip: true });
let green = tree.createRect({ id: 'Green', layer: 0, transform: pose(8, 0), width: 7, height: 10,
  fill: [0, 1, 0, 1] });
let path = tree.createPath({ id: 'Path', layer: 5, transform: pose(45, 45), pivot: { x: 5, y: 0 },
  commands: [
    { kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 }, { kind: 'L', x: 10, y: 10 }, { kind: 'L', x: 0, y: 10 }, { kind: 'Z' },
    { kind: 'M', x: 1, y: 1 }, { kind: 'L', x: 3, y: 1 }, { kind: 'L', x: 3, y: 3 }, { kind: 'L', x: 1, y: 3 }, { kind: 'Z' },
  ], fill: { color: [1, 1, 1, 1], rule: 'evenodd' } });
tree.stage.addChild(back); tree.stage.addChild(sprite); tree.stage.addChild(parent); parent.addChild(child);
tree.stage.addChild(rect); tree.stage.addChild(frame); frame.addChild(green); tree.stage.addChild(path);
/** @type {HTMLCanvasElement} */ let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options); renderer.setImageAsset('Atlas', image);
/** @type {import('@barocss/canvas2d').SceneV15 | import('@barocss/canvas2d').SceneV16 | import('@barocss/canvas2d').SceneV17} */ let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string | null} */ let invalidError = null;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
function subscribe() {
  sprite.onPointer('pointerdown', event => pointerLog.push(`Sprite:${event.target?.id}`));
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
    imageTopLeft: sample(16, 13), imageTopRight: sample(23, 13),
    imageBottomLeft: sample(16, 16), imageBottomRight: sample(23, 16),
    parentOld: sample(58, 19), parentNew: sample(62, 19),
    frameOld: sample(84, 46), frameNew: sample(66, 46), outsideFrame: sample(64, 46),
    pathOldHole: sample(42, 47), pathNewHole: sample(48, 47),
    spriteScale: { x: sprite.data.transform.scaleX, y: sprite.data.transform.scaleY },
    parentScale: parent.data.transform.scaleX, frameScale: frame.data.transform.scaleX,
    pathScale: path.data.transform.scaleX, rectScale: rect.data.transform.scaleX,
    spriteWorld: sprite.getWorldBounds(), rectWorld: rect.getWorldBounds(),
    childWorld: child.getWorldBounds(), childOriginWorld: child.toWorld({ x: 0, y: 0 }),
    rectOriginWorld: rect.toWorld({ x: 0, y: 0 }),
    rectOriginLocal: rect.toLocal(rect.toWorld({ x: 0, y: 0 })),
    assetBytes: [...(renderer.getImageAsset('Atlas')?.pixels ?? [])], invalidError, pointerLog: [...pointerLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function submit() { accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show(); }
function flipX() { sprite.setScale(-1, 1); rect.setScale(-1, 1); submit(); }
function flipY() { sprite.setScale(1, -1); submit(); }
function flipBoth() { sprite.setScale(-1, -1); submit(); }
function reset() { sprite.setScale(1, 1); submit(); }
function flipParent() { parent.setScale(-1, 1); submit(); }
function flipFrame() { frame.setScale(-1, 1); submit(); }
function flipPath() { path.setScale(-1, 1); submit(); }
function rejectScale() {
  for (const scale of [0, 0.001]) {
    try { sprite.setScale(scale, 1); } catch (error) {
      invalidError = error instanceof Error && 'code' in error ? String(error.code) : String(error);
    }
  }
  show();
}
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const down = event => {
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * 90 / bounds.width,
      y: (event.clientY - bounds.top) * 70 / bounds.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
      point, hit: renderer.hitTest(point) }); show();
  };
  current.addEventListener('pointerdown', down);
  return () => current.removeEventListener('pointerdown', down);
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'signed-scale-document.json';
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 180; fresh.height = 140;
  const staged = await stageCanvasDocument(text, fresh, options);
  if (staged.scene.version !== 15 && staged.scene.version !== 16 && staged.scene.version !== 17) throw new Error('Scene v15 or v16 required');
  const nextTree = createDisplayTreeFromScene(staged.scene);
  const nextBack = nextTree.get('Back'), nextSprite = nextTree.get('Sprite');
  const nextParent = nextTree.get('Parent'), nextChild = nextTree.get('Child');
  const nextRect = nextTree.get('Rect'), nextFrame = nextTree.get('Frame');
  const nextGreen = nextTree.get('Green'), nextPath = nextTree.get('Path');
  const bytes = staged.renderer.getImageAsset('Atlas')?.pixels;
  if (nextBack?.kind !== 'rect' || nextSprite?.kind !== 'sprite' || nextParent?.kind !== 'container' ||
      nextChild?.kind !== 'rect' || nextRect?.kind !== 'rect' || nextFrame?.kind !== 'frame' ||
      nextGreen?.kind !== 'rect' || nextPath?.kind !== 'path' ||
      !bytes || bytes.some((value, index) => value !== image.pixels[index])) {
    staged.renderer.dispose(); throw new Error('Document handles or bytes differ');
  }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; back = nextBack; sprite = nextSprite; parent = nextParent;
  child = nextChild; rect = nextRect; frame = nextFrame; green = nextGreen; path = nextPath;
  accepted = staged.scene; generation++; pointerLog = []; invalidError = null;
  subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind();
document.querySelector('#flip-x')?.addEventListener('click', flipX);
document.querySelector('#flip-y')?.addEventListener('click', flipY);
document.querySelector('#flip-both')?.addEventListener('click', flipBoth);
document.querySelector('#reset')?.addEventListener('click', reset);
document.querySelector('#flip-parent')?.addEventListener('click', flipParent);
document.querySelector('#flip-frame')?.addEventListener('click', flipFrame);
document.querySelector('#flip-path')?.addEventListener('click', flipPath);
document.querySelector('#invalid')?.addEventListener('click', rejectScale);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => { output.textContent = String(error); });
  openInput.value = '';
});
Object.assign(window, { __signedScaleConsumer: { observe, save, openText, flipX, flipY, flipBoth,
  reset, flipParent, flipFrame, flipPath, rejectScale, get canvas() { return canvas; } } });
show();
