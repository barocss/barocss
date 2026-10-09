// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 90, height: 60 }, dpr: 2 };
/** @param {number} x @param {number} y */
const pose = (x, y) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const image = { width: 2, height: 2, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 255, 0, 0,
  0, 0, 255, 255, 255, 255, 0, 255,
]) };
let tree = createDisplayTree('HitAreaConsumer');
let back = tree.createRect({ id: 'Back', layer: -2, transform: pose(0, 0), width: 90, height: 60,
  fill: [0.25, 0.25, 0.25, 1] });
let under = tree.createRect({ id: 'Under', layer: -1, transform: pose(10, 10), width: 75, height: 40,
  fill: [1, 0, 1, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20), imageId: 'Atlas',
  width: 8, height: 8, opacity: 1, sampling: 'nearest', anchorX: 0.5, anchorY: 0.5 });
let frame = tree.createFrame({ id: 'Frame', layer: 2, transform: pose(40, 15), width: 10, height: 10,
  fill: [0, 0, 0, 0], clip: true });
let clipped = tree.createSprite({ id: 'Clipped', layer: 0, transform: pose(8, 3), imageId: 'Atlas',
  width: 8, height: 8, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0,
  hitArea: { x: -2, y: -2, width: 12, height: 12 } });
let tiled = tree.createSprite({ id: 'Tiled', layer: 3, transform: pose(65, 20), imageId: 'Atlas',
  width: 8, height: 8, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0,
  sourceRect: { x: 0, y: 0, width: 2, height: 2 },
  tile: { width: 2, height: 2, offsetX: 0, offsetY: 0 },
  hitArea: { x: 0, y: 0, width: 8, height: 8 } });
tree.stage.addChild(back); tree.stage.addChild(under); tree.stage.addChild(sprite);
tree.stage.addChild(frame); frame.addChild(clipped); tree.stage.addChild(tiled);
/** @type {HTMLCanvasElement} */ let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options); renderer.setImageAsset('Atlas', image);
/** @type {import('@barocss/canvas2d').SceneV16 | import('@barocss/canvas2d').SceneV17 | import('@barocss/canvas2d').SceneV18 | import('@barocss/canvas2d').SceneV19 | import('@barocss/canvas2d').SceneV20 | import('@barocss/canvas2d').SceneV21 | import('@barocss/canvas2d').SceneV22 | import('@barocss/canvas2d').SceneV24 | import('@barocss/canvas2d').SceneV25} */ let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string | null} */ let invalidError = null;
/** @type {string | null} */ let missingError = null;
/** @type {string | null} */ let worldError = null;
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
  const sample = (x, y) => ({ pixel: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null,
    hits: renderer.hitTestAll({ x, y }).map(hit => hit.id) });
  return { generation, sceneVersion: accepted.version,
    transparent: sample(22, 18), outsidePaint: sample(25, 20), mirroredTransparent: sample(20, 18),
    mirroredOutside: sample(27, 20), clippedInside: sample(47, 20), clippedOutside: sample(51, 20),
    tiled: sample(66, 21), area: sprite.data.hitArea ?? null, scale: sprite.data.transform.scaleX,
    pivot: sprite.data.pivot ?? null, spriteBounds: sprite.getWorldBounds(),
    bytes: [...(renderer.getImageAsset('Atlas')?.pixels ?? [])], invalidError, missingError, worldError,
    pointerLog: [...pointerLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function submit() { accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show(); }
function setArea() { sprite.setHitArea({ x: -6, y: -6, width: 12, height: 12 }); submit(); }
function removeArea() { sprite.setHitArea(null); submit(); }
function mirror() { sprite.setPivot(2, 0); sprite.setScale(-1, 1); submit(); }
function hideAlpha() { sprite.setAlpha(0); submit(); }
function disableHit() { sprite.setHitMode('none'); submit(); }
function resetFlags() { sprite.setAlpha(1); sprite.setHitMode('auto'); submit(); }
function rejectArea() {
  try { sprite.setHitArea({ x: -0, y: 0, width: 1, height: 1 }); } catch (error) {
    invalidError = error instanceof Error && 'code' in error ? String(error.code) : String(error);
  }
  show();
}
function rejectMissingAsset() {
  const fresh = document.createElement('canvas'); fresh.width = 180; fresh.height = 120;
  const empty = createCanvas2D(fresh, options);
  try { empty.updateScene(accepted); } catch (error) {
    missingError = error instanceof Error && 'code' in error ? String(error.code) : String(error);
  } finally { empty.dispose(); }
  show();
}
function rejectWorldLimit() {
  const probe = createDisplayTree('HitAreaLimit');
  const outer = probe.createContainer({ id: 'Outer', layer: 0,
    transform: { ...pose(0, 0), scaleX: 100, scaleY: 100 } });
  const inner = probe.createContainer({ id: 'Inner', layer: 0,
    transform: { ...pose(0, 0), scaleX: 100, scaleY: 100 } });
  const far = probe.createSprite({ id: 'Far', layer: 0, transform: pose(0, 0), imageId: 'Atlas',
    width: 1, height: 1, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0,
    hitArea: { x: 1000000, y: 0, width: 1, height: 1 } });
  probe.stage.addChild(outer); outer.addChild(inner); inner.addChild(far);
  const fresh = document.createElement('canvas'); fresh.width = 180; fresh.height = 120;
  const isolated = createCanvas2D(fresh, options); isolated.setImageAsset('Atlas', image);
  try { isolated.updateScene(probe.snapshot()); } catch (error) {
    worldError = error instanceof Error && 'code' in error ? String(error.code) : String(error);
  } finally { isolated.dispose(); }
  show();
}
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const down = event => {
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * 90 / bounds.width,
      y: (event.clientY - bounds.top) * 60 / bounds.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
      point, hit: renderer.hitTest(point) }); show();
  };
  current.addEventListener('pointerdown', down);
  return () => current.removeEventListener('pointerdown', down);
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'sprite-hit-area-document.json';
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 180; fresh.height = 120;
  const staged = await stageCanvasDocument(text, fresh, options);
  if (staged.scene.version !== 16 && staged.scene.version !== 17) throw new Error('Scene v16 required');
  const nextTree = createDisplayTreeFromScene(staged.scene);
  const nextBack = nextTree.get('Back'), nextUnder = nextTree.get('Under');
  const nextSprite = nextTree.get('Sprite'), nextFrame = nextTree.get('Frame');
  const nextClipped = nextTree.get('Clipped'), nextTiled = nextTree.get('Tiled');
  const bytes = staged.renderer.getImageAsset('Atlas')?.pixels;
  if (nextBack?.kind !== 'rect' || nextUnder?.kind !== 'rect' || nextSprite?.kind !== 'sprite' ||
      nextFrame?.kind !== 'frame' || nextClipped?.kind !== 'sprite' || nextTiled?.kind !== 'sprite' ||
      !bytes || bytes.some((value, index) => value !== image.pixels[index])) {
    staged.renderer.dispose(); throw new Error('Document handles or bytes differ');
  }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; back = nextBack; under = nextUnder; sprite = nextSprite;
  frame = nextFrame; clipped = nextClipped; tiled = nextTiled;
  accepted = staged.scene; generation++; pointerLog = []; invalidError = null; missingError = null; worldError = null;
  subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind();
document.querySelector('#area')?.addEventListener('click', setArea);
document.querySelector('#remove-area')?.addEventListener('click', removeArea);
document.querySelector('#mirror')?.addEventListener('click', mirror);
document.querySelector('#hide-alpha')?.addEventListener('click', hideAlpha);
document.querySelector('#disable-hit')?.addEventListener('click', disableHit);
document.querySelector('#reset-flags')?.addEventListener('click', resetFlags);
document.querySelector('#invalid')?.addEventListener('click', rejectArea);
document.querySelector('#missing')?.addEventListener('click', rejectMissingAsset);
document.querySelector('#world-limit')?.addEventListener('click', rejectWorldLimit);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => { output.textContent = String(error); });
  openInput.value = '';
});
Object.assign(window, { __hitAreaConsumer: { observe, save, openText, setArea, removeArea, mirror,
  hideAlpha, disableHit, resetFlags, rejectArea, rejectMissingAsset, rejectWorldLimit,
  get canvas() { return canvas; } } });
show();
