// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 70 }, dpr: 2 };
/** @param {number} x @param {number} y */
const pose = (x, y) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
let tree = createDisplayTree('ContainerAreaConsumer');
let back = tree.createRect({ id: 'Back', layer: -2, transform: pose(0, 0), width: 100, height: 70,
  fill: [0.25, 0.25, 0.25, 1] });
let lower = tree.createRect({ id: 'Lower', layer: -1, transform: pose(10, 10), width: 80, height: 50,
  fill: [1, 0, 1, 1] });
let group = tree.createContainer({ id: 'Group', layer: 0, transform: pose(20, 20) });
let blue = tree.createRect({ id: 'Blue', layer: 0, transform: pose(0, 0), width: 8, height: 8,
  fill: [0, 0, 1, 1] });
let green = tree.createRect({ id: 'Green', layer: 1, transform: pose(20, 0), width: 8, height: 8,
  fill: [0, 1, 0, 1] });
let far = tree.createRect({ id: 'Far', layer: 2, transform: pose(40, 0), width: 5, height: 5,
  fill: [1, 1, 0, 1] });
let nested = tree.createContainer({ id: 'Nested', layer: 3, transform: pose(10, 10),
  hitArea: { x: 0, y: 0, width: 8, height: 5 } });
let frame = tree.createFrame({ id: 'Frame', layer: 4, transform: pose(70, 10), width: 10, height: 10,
  fill: [0, 0, 0, 0], clip: true });
let clipped = tree.createContainer({ id: 'Clipped', layer: 0, transform: pose(5, 3),
  hitArea: { x: -3, y: -2, width: 10, height: 10 } });
tree.stage.addChild(back); tree.stage.addChild(lower); tree.stage.addChild(group);
group.addChild(blue); group.addChild(green); group.addChild(far); group.addChild(nested);
tree.stage.addChild(frame); frame.addChild(clipped);
/** @type {HTMLCanvasElement} */ let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
/** @type {import('@barocss/canvas2d').SceneV17 | import('@barocss/canvas2d').SceneV18} */ let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string | null} */ let invalidError = null;
/** @type {string | null} */ let worldError = null;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
function subscribe() {
  group.onPointer('pointerdown', event => pointerLog.push(`Group:${event.target?.id}`));
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
  const mirroredGap = group.toWorld({ x: 14, y: 4 });
  return { generation, sceneVersion: accepted.version,
    gap: sample(34, 24), child: sample(22, 22), outsideChild: sample(62, 22),
    nested: sample(32, 32), clippedInside: sample(77, 15), clippedOutside: sample(82, 15),
    mirroredGap: { point: mirroredGap, ...sample(mirroredGap.x, mirroredGap.y) },
    area: group.data.hitArea ?? null, groupBounds: group.getWorldBounds(),
    nestedBounds: nested.getWorldBounds(), scale: group.data.transform.scaleX,
    pivot: group.data.pivot ?? null, invalidError, worldError, pointerLog: [...pointerLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function submit() { accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show(); }
function setArea() { group.setHitArea({ x: 0, y: 0, width: 30, height: 15 }); submit(); }
function removeArea() { group.setHitArea(null); submit(); }
function mirror() { group.setPivot(5, 0); group.setScale(-1, 1); submit(); }
function hideAlpha() { group.setAlpha(0); submit(); }
function disableHit() { group.setHitMode('none'); submit(); }
function resetFlags() { group.setAlpha(1); group.setHitMode('auto'); submit(); }
function rejectArea() {
  try { group.setHitArea({ x: -0, y: 0, width: 1, height: 1 }); } catch (error) {
    invalidError = error instanceof Error && 'code' in error ? String(error.code) : String(error);
  }
  show();
}
function rejectWorldLimit() {
  const probe = createDisplayTree('GroupAreaLimit');
  const outer = probe.createContainer({ id: 'Outer', layer: 0,
    transform: { ...pose(0, 0), scaleX: 100, scaleY: 100 } });
  const inner = probe.createContainer({ id: 'Inner', layer: 0,
    transform: { ...pose(0, 0), scaleX: 100, scaleY: 100 },
    hitArea: { x: 1000000, y: 0, width: 1, height: 1 } });
  probe.stage.addChild(outer); outer.addChild(inner);
  const fresh = document.createElement('canvas'); fresh.width = 200; fresh.height = 140;
  const isolated = createCanvas2D(fresh, options);
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
    const point = { x: (event.clientX - bounds.left) * 100 / bounds.width,
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
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'container-hit-area-document.json';
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 200; fresh.height = 140;
  const staged = await stageCanvasDocument(text, fresh, options);
  if (staged.scene.version !== 17) throw new Error('Scene v17 required');
  const nextTree = createDisplayTreeFromScene(staged.scene);
  const nextBack = nextTree.get('Back'), nextLower = nextTree.get('Lower');
  const nextGroup = nextTree.get('Group'), nextBlue = nextTree.get('Blue'), nextGreen = nextTree.get('Green');
  const nextFar = nextTree.get('Far'), nextNested = nextTree.get('Nested');
  const nextFrame = nextTree.get('Frame'), nextClipped = nextTree.get('Clipped');
  if (nextBack?.kind !== 'rect' || nextLower?.kind !== 'rect' || nextGroup?.kind !== 'container' ||
      nextBlue?.kind !== 'rect' || nextGreen?.kind !== 'rect' || nextFar?.kind !== 'rect' ||
      nextNested?.kind !== 'container' || nextFrame?.kind !== 'frame' || nextClipped?.kind !== 'container') {
    staged.renderer.dispose(); throw new Error('Document handles differ');
  }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; back = nextBack; lower = nextLower; group = nextGroup;
  blue = nextBlue; green = nextGreen; far = nextFar; nested = nextNested;
  frame = nextFrame; clipped = nextClipped;
  accepted = staged.scene; generation++; pointerLog = []; invalidError = null; worldError = null;
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
document.querySelector('#world-limit')?.addEventListener('click', rejectWorldLimit);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => { output.textContent = String(error); });
  openInput.value = '';
});
Object.assign(window, { __containerAreaConsumer: { observe, save, openText, setArea, removeArea, mirror,
  hideAlpha, disableHit, resetFlags, rejectArea, rejectWorldLimit, get canvas() { return canvas; } } });
show();
