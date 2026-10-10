// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 80, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const image = { width: 1, height: 1, pixels: new Uint8Array([0, 0, 255, 255]) };
let tree = createDisplayTree('LocalBoundsConsumer');
let parent = tree.createContainer({ id: 'Parent', layer: 0, transform: pose(20, 20) });
let sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose(0, 0),
  imageId: 'Blue', width: 10, height: 10, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0 });
let rect = tree.createRect({ id: 'Rect', layer: 1, transform: pose(20, 0),
  width: 10, height: 10, fill: [1, 0, 0, 1] });
tree.stage.addChild(parent); parent.addChild(sprite); parent.addChild(rect);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Blue', image);
/** @type {import('@barocss/canvas2d').SceneV11 | import('@barocss/canvas2d').SceneV12 | import('@barocss/canvas2d').SceneV13 | import('@barocss/canvas2d').SceneV14 | import('@barocss/canvas2d').SceneV15 | import('@barocss/canvas2d').SceneV16 | import('@barocss/canvas2d').SceneV17 | import('@barocss/canvas2d').SceneV18 | import('@barocss/canvas2d').SceneV19 | import('@barocss/canvas2d').SceneV20 | import('@barocss/canvas2d').SceneV21 | import('@barocss/canvas2d').SceneV22 | import('@barocss/canvas2d').SceneV24 | import('@barocss/canvas2d').SceneV25 | import('@barocss/canvas2d').SceneV26 | import('@barocss/canvas2d').SceneV27 | import('@barocss/canvas2d').SceneV28 | import('@barocss/canvas2d').SceneV29} */
let accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
let generation = 1;
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
/** @param {number} x @param {number} y */
function pixel(x, y) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 missing');
  const bytes = new Uint8Array(4);
  gl.readPixels(Math.round(x * 2), canvas.height - Math.round(y * 2) - 1,
    1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
/** @param {import('@barocss/canvas2d').DisplayHandle} handle */
function sample(handle) {
  const world = handle.getWorldBounds();
  if (!world) throw new Error('Object has no world bounds');
  const point = { x: world.x + world.width / 2, y: world.y + world.height / 2 };
  return { point, pixel: pixel(point.x, point.y), hit: renderer.hitTest(point)?.id ?? null };
}
function observe() {
  return { generation, sceneVersion: accepted.version, parentTransform: parent.data.transform,
    parentLocal: parent.getLocalBounds(), parentWorld: parent.getWorldBounds(),
    spriteLocal: sprite.getLocalBounds(), spriteWorld: sprite.getWorldBounds(),
    rectLocal: rect.getLocalBounds(), rectWorld: rect.getWorldBounds(),
    blue: sample(sprite), red: sample(rect),
    assetBytes: [...(renderer.getImageAsset('Blue')?.pixels ?? [])] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function submit() {
  const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show();
}
function move() { parent.setPosition(parent.data.transform.x + 10, parent.data.transform.y); submit(); }
function rotate() { parent.setRotation(parent.data.transform.rotation === 0 ? Math.PI / 2 : 0); submit(); }
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'local-bounds-document.json';
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 160; fresh.height = 160;
  const staged = await stageCanvasDocument(text, fresh, options);
  if (staged.scene.version !== 11 && staged.scene.version !== 12 && staged.scene.version !== 13 && staged.scene.version !== 14 && staged.scene.version !== 15 && staged.scene.version !== 16 && staged.scene.version !== 17) throw new Error('Scene v11, v12 or v13 or v14 or v15 or v16 required');
  const nextTree = createDisplayTreeFromScene(staged.scene);
  const nextParent = nextTree.get('Parent'), nextSprite = nextTree.get('Sprite');
  const nextRect = nextTree.get('Rect');
  const bytes = staged.renderer.getImageAsset('Blue')?.pixels;
  if (nextParent?.kind !== 'container' || nextSprite?.kind !== 'sprite' ||
      nextRect?.kind !== 'rect' || !bytes || bytes.length !== image.pixels.length ||
      bytes.some((value, index) => value !== image.pixels[index])) {
    staged.renderer.dispose(); throw new Error('Document handles or asset differ');
  }
  const old = renderer; canvas.replaceWith(fresh);
  canvas = fresh; renderer = staged.renderer; tree = nextTree;
  parent = nextParent; sprite = nextSprite; rect = nextRect;
  accepted = staged.scene; generation++; old.dispose(); show();
}
document.querySelector('#move')?.addEventListener('click', move);
document.querySelector('#rotate')?.addEventListener('click', rotate);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => { output.textContent = String(error); });
  openInput.value = '';
});
Object.assign(window, { __localBoundsConsumer: { observe, move, rotate, save, openText } });
show();
