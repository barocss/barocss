// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 160, height: 120 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const atlas = { width: 2, height: 2, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 0, 0, 0,
  0, 0, 255, 255, 0, 255, 0, 255,
]) };
/** @type {import('@barocss/canvas2d').SourceRect} */
const red = { x: 0, y: 0, width: 1, height: 1 };
/** @type {import('@barocss/canvas2d').SourceRect} */
const transparent = { x: 1, y: 0, width: 1, height: 1 };
/** @type {import('@barocss/canvas2d').SourceRect} */
const green = { x: 1, y: 1, width: 1, height: 1 };
/** @type {import('@barocss/canvas2d').SourceRect} */
const blue = { x: 0, y: 1, width: 1, height: 1 };

let tree = createDisplayTree('CropConsumer');
let team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(0, 0) });
let back = tree.createRect({ id: 'Back', layer: 0, transform: pose(20, 20),
  width: 80, height: 80, fill: [1, 1, 0, 1] });
let sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20),
  imageId: 'Atlas', width: 80, height: 80, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0, sourceRect: red });
tree.stage.addChild(team); team.addChild(back); team.addChild(sprite);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', atlas);
/** @type {import('@barocss/canvas2d').Scene} */
let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[50, 50], [30, 30], [70, 30], [30, 70], [70, 70]];

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
  return { generation, crop: sprite.data.sourceRect ?? null,
    scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()),
    assetBytes: [...(renderer.getImageAsset('Atlas')?.pixels ?? [])],
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y),
      hit: renderer.hitTest({ x, y })?.id ?? null })), pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  sprite.onPointer('pointerdown', () => pointerLog.push('Sprite'));
  team.onPointer('pointerdown', () => pointerLog.push('Team'));
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
/** @param {import('@barocss/canvas2d').SourceRect|null} crop */
function setCrop(crop) { sprite.setSourceRect(crop); submit(crop ? `Source cell ${crop.x},${crop.y}` : 'Full source image'); }
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { sprite.setSourceRect({ x: 0, y: 0, width: 0, height: 1 }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected crop ${code}; retained ${JSON.stringify(observe()) === before}`);
  return code;
}
function outOfBounds() {
  const prior = sprite.data.sourceRect ?? null;
  const before = JSON.stringify(observe());
  sprite.setSourceRect({ x: 2, y: 0, width: 1, height: 1 });
  let code = 'ACCEPTED';
  try { renderer.updateScene(tree.snapshot()); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  sprite.setSourceRect(prior);
  show(`Renderer refused crop ${code}; retained ${JSON.stringify(observe()) === before}`);
  return code;
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'sprite-crop-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').ContainerHandle} */ let nextTeam;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextBack;
  /** @type {import('@barocss/canvas2d').SpriteHandle} */ let nextSprite;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const group = nextTree.get('Team'), background = nextTree.get('Back'), image = nextTree.get('Sprite');
    if (group?.kind !== 'container' || background?.kind !== 'rect' || image?.kind !== 'sprite' ||
        group.children.length !== 2 || !group.children.includes(background) || !group.children.includes(image)) {
      throw new Error('Document does not contain the consumer objects');
    }
    nextTeam = group; nextBack = background; nextSprite = image;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; team = nextTeam; back = nextBack; sprite = nextSprite;
  accepted = /** @type {import('@barocss/canvas2d').Scene} */ (staged.scene);
  generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened editable cropped sprite');
}
subscribe(); unbind = bind();
document.querySelector('#red')?.addEventListener('click', () => setCrop(red));
document.querySelector('#transparent')?.addEventListener('click', () => setCrop(transparent));
document.querySelector('#green')?.addEventListener('click', () => setCrop(green));
document.querySelector('#blue')?.addEventListener('click', () => setCrop(blue));
document.querySelector('#full')?.addEventListener('click', () => setCrop(null));
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#out-of-bounds')?.addEventListener('click', outOfBounds);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __cropConsumer: { observe, setCrop, invalid, outOfBounds, save, openText,
  get canvas() { return canvas; }, blue, green, red, transparent } });
show('Ready with red source cell');
