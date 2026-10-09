// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const options = { logicalSize: { width: 240, height: 180 }, dpr: 2 };
const pose = (/** @type {number} */ x = 0, /** @type {number} */ y = 0) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** Host supplies all atlas pixels. No font or image loading is required. */
const assets = {
  Red: { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) },
  GlyphAtlas: { width: 2, height: 1, pixels: new Uint8Array([255, 0, 255, 255, 0, 0, 0, 0]) },
  TileAtlas: { width: 2, height: 1, pixels: new Uint8Array([0, 255, 255, 255, 0, 0, 0, 0]) },
  NineAtlas: { width: 3, height: 3, pixels: new Uint8Array([
    255, 255, 0, 255, 255, 255, 0, 255, 255, 255, 0, 255,
    255, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
    255, 255, 0, 255, 255, 255, 0, 255, 255, 255, 0, 255,
  ]) },
};
let tree = createDisplayTree('TransformedClipConsumer');
tree.stage.addChild(tree.createRect({ id: 'Back', layer: -1, transform: pose(),
  width: 240, height: 180, fill: [0.25, 0.25, 0.25, 1] }));
let frame = tree.createFrame({ id: 'RotatedFrame', layer: 0,
  transform: { ...pose(65, 55), rotation: Math.PI / 6 }, pivot: { x: 40, y: 28 },
  width: 80, height: 56, fill: [0, 0, 0, 0], clip: true });
frame.addChild(tree.createSprite({ id: 'Sprite', layer: 0, transform: pose(-30, -30),
  imageId: 'Red', width: 140, height: 116, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 }));
frame.addChild(tree.createPath({ id: 'Path', layer: 1, transform: pose(), commands: [
  { kind: 'M', x: 40, y: -20 }, { kind: 'L', x: 115, y: -20 },
  { kind: 'L', x: 115, y: 80 }, { kind: 'L', x: 40, y: 80 }, { kind: 'Z' },
  { kind: 'M', x: 55, y: 15 }, { kind: 'L', x: 65, y: 15 },
  { kind: 'L', x: 65, y: 25 }, { kind: 'L', x: 55, y: 25 }, { kind: 'Z' },
], fill: { rule: 'evenodd', color: [0, 1, 0, 1] } }));
frame.addChild(tree.createGlyphRun({ id: 'Glyph', layer: 2, transform: pose(),
  atlasId: 'GlyphAtlas', text: 'I', baseline: 0, opacity: 1, sampling: 'nearest', glyphs: [{
    sourceRect: { x: 0, y: 0, width: 2, height: 1 }, x: -8, y: 34, width: 40, height: 16,
    textStart: 0, textEnd: 1,
  }] }));
frame.addChild(tree.createContainer({ id: 'GroupArea', layer: 3, transform: pose(),
  hitArea: { x: -20, y: -20, width: 40, height: 32 } }));
tree.stage.addChild(frame);
const outer = tree.createFrame({ id: 'NestedOuter', layer: 1,
  transform: { ...pose(180, 125), rotation: -0.25, scaleX: -1.2, scaleY: 0.85 },
  pivot: { x: 20, y: 20 }, width: 52, height: 50, fill: [0.1, 0.1, 0.1, 1], clip: true });
const inner = tree.createFrame({ id: 'NestedInner', layer: 0,
  transform: { ...pose(12, 8), rotation: 0.6, scaleY: 1.2 }, pivot: { x: 10, y: 8 },
  width: 64, height: 42, fill: [0, 0, 0, 0], clip: true });
const pass = tree.createFrame({ id: 'NestedPass', layer: 0, transform: pose(),
  width: 64, height: 42, fill: [0, 0, 0, 0], clip: false });
pass.addChild(tree.createSprite({ id: 'NestedTile', layer: 0, transform: pose(-10, -10),
  imageId: 'TileAtlas', width: 40, height: 62, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0,
  sourceRect: { x: 0, y: 0, width: 2, height: 1 },
  tile: { width: 8, height: 8, offsetX: 0, offsetY: 0 } }));
pass.addChild(tree.createSprite({ id: 'NestedNine', layer: 1, transform: pose(26, -10),
  imageId: 'NineAtlas', width: 48, height: 62, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0,
  sourceRect: { x: 0, y: 0, width: 3, height: 3 },
  slice: { left: 1, right: 1, top: 1, bottom: 1 } }));
inner.addChild(pass); outer.addChild(inner); tree.stage.addChild(outer);
tree.stage.addChild(tree.createRect({ id: 'UnclippedSibling', layer: 2, transform: pose(125, 12),
  width: 30, height: 22, fill: [1, 0.5, 0, 1] }));
// This offscreen frame admits the default view. A compressed view loses device precision.
tree.stage.addChild(tree.createFrame({ id: 'PrecisionControl', layer: -2,
  transform: { ...pose(1e6, 1e6), rotation: 0.2 }, width: 1, height: 1,
  fill: [0, 0, 0, 0], clip: true }));
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
for (const [id, asset] of Object.entries(assets)) renderer.setImageAsset(id, asset);
/** @type {import('@barocss/canvas2d').Scene} */ let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
let restoredEdit = false;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
/** @type {null | { code: string, retained: boolean }} */ let refusal = null;

/** @param {string} id */
function getFrame(id) {
  const found = tree.get(id);
  if (found?.kind !== 'frame') throw new Error(`${id} frame missing`);
  return found;
}
/** @param {{ x: number, y: number }} point */
function pixel(point) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const bytes = new Uint8Array(4);
  gl.readPixels(Math.floor(point.x * options.dpr), canvas.height - Math.floor(point.y * options.dpr) - 1,
    1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
/** @param {{ x: number, y: number }} point */
function sample(point) {
  return { point, rgba: pixel(point), hit: renderer.hitTest(point)?.id ?? null,
    hits: renderer.hitTestAll(point).map(hit => hit.id) };
}
function samples() {
  const nested = getFrame('NestedInner');
  return {
    spriteInside: sample(frame.toWorld({ x: 25, y: 20 })),
    pathInside: sample(frame.toWorld({ x: 50, y: 32 })),
    pathHole: sample(frame.toWorld({ x: 60, y: 20 })),
    glyphOpaque: sample(frame.toWorld({ x: 2, y: 42 })),
    glyphTransparent: sample(frame.toWorld({ x: 24, y: 42 })),
    glyphOutside: sample(frame.toWorld({ x: -4, y: 42 })),
    groupInside: sample(frame.toWorld({ x: 8, y: 8 })),
    aabbOutside: sample({ x: 25, y: 25 }),
    pathOutside: sample(frame.toWorld({ x: 88, y: 32 })),
    nestedTileOpaque: sample(nested.toWorld({ x: 8, y: 16 })),
    nestedTileTransparent: sample(nested.toWorld({ x: 12, y: 16 })),
    nestedNine: sample(nested.toWorld({ x: 36, y: 16 })),
    outsideInner: sample(nested.toWorld({ x: -4, y: 8 })),
    outsideOuter: sample(nested.toWorld({ x: 55, y: 30 })),
    followingSibling: sample({ x: 140, y: 22 }),
  };
}
function observe() {
  const nested = getFrame('NestedInner');
  const origin = nested.toWorld({ x: 0, y: 0 });
  const x = nested.toWorld({ x: 1, y: 0 }), y = nested.toWorld({ x: 0, y: 1 });
  const outside = frame.toLocal({ x: 25, y: 25 });
  return { generation, sceneVersion: accepted.version, dpr: options.dpr,
    backing: { width: canvas.width, height: canvas.height }, frame: frame.data,
    frameBounds: frame.getWorldBounds(), outsideLocal: outside,
    outsideWithinAabb: (() => { const b = frame.getWorldBounds(); return !!b &&
      25 >= b.x && 25 <= b.x + b.width && 25 >= b.y && 25 <= b.y + b.height; })(),
    nestedMatrix: [x.x - origin.x, x.y - origin.y, y.x - origin.x, y.y - origin.y, origin.x, origin.y],
    nestedBounds: nested.getWorldBounds(), nestedLocalBounds: nested.getLocalBounds(),
    samples: samples(), sceneMatchesTree: stringifySceneJSON(accepted) === stringifySceneJSON(tree.snapshot()),
    assetMatchesHost: Object.entries(assets).every(([id, asset]) => {
      const stored = renderer.getImageAsset(id);
      return stored?.width === asset.width && stored.height === asset.height &&
        stored.pixels.length === asset.pixels.length && stored.pixels.every((v, i) => v === asset.pixels[i]);
    }), restoredEdit, refusal, pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  const born = generation;
  for (const id of ['Back', 'RotatedFrame', 'Sprite', 'Path', 'Glyph', 'GroupArea',
    'NestedOuter', 'NestedInner', 'NestedPass', 'NestedTile', 'NestedNine', 'UnclippedSibling']) {
    tree.get(id)?.onPointer('pointerdown', event => pointerLog.push(`g${born}:${id}:${event.target?.id}`));
  }
  tree.stage.onPointer('pointerdown', event => pointerLog.push(`g${born}:stage:${event.target?.id ?? 'none'}`));
}
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const onPointer = event => {
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * options.logicalSize.width / bounds.width,
      y: (event.clientY - bounds.top) * options.logicalSize.height / bounds.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point, hit: renderer.hitTest(point) });
    show('Dispatched pointerdown');
  };
  current.addEventListener('pointerdown', onPointer);
  return () => current.removeEventListener('pointerdown', onPointer);
}
/** @param {string} message */
function submit(message) {
  const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message);
}
function edit() {
  frame.setRotation(frame.data.transform.rotation === Math.PI / 6 ? Math.PI / 4 : Math.PI / 6);
  restoredEdit = generation > 1; submit('Edited frame rotation');
}
function toggleClip() {
  frame.setFrame({ width: frame.data.width, height: frame.data.height,
    fill: frame.data.fill, clip: !frame.data.clip }); submit('Changed frame clip');
}
function fingerprint() {
  return JSON.stringify({ scene: stringifySceneJSON(accepted), tree: stringifySceneJSON(tree.snapshot()),
    frame: frame.data, samples: samples() });
}
/** @param {unknown} error */
function errorCode(error) {
  return error instanceof Error && 'code' in error ? String(error.code) : String(error);
}
/** @param {() => void} operation @param {string} label */
function reject(operation, label) {
  const before = fingerprint(); let code = 'ACCEPTED';
  try { operation(); } catch (error) { code = errorCode(error); }
  renderer.render(); refusal = { code, retained: fingerprint() === before }; show(`${label}: ${code}`);
  return refusal;
}
function invalid() {
  return reject(() => frame.setFrame({ width: 0, height: 56, fill: [0, 0, 0, 0], clip: true }), 'Frame edit');
}
function rejectedView() {
  return reject(() => renderer.setView({ panX: 1e6, panY: 1e6, zoom: 0.05 }), 'View precision');
}
function rejectedScene() {
  return reject(() => {
    const probe = createDisplayTreeFromScene(accepted);
    const bad = probe.get('PrecisionControl');
    if (bad?.kind !== 'frame') throw new Error('Precision control missing');
    bad.setFrame({ width: 0.001, height: 0.001, fill: [0, 0, 0, 0], clip: true });
    renderer.updateScene(probe.snapshot());
  }, 'Scene precision');
}
async function documentText() { return serializeCanvasDocument(accepted, id => renderer.getImageAsset(id)); }
async function save() {
  const text = await documentText();
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'transformed-clip-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').FrameHandle} */ let nextFrame;
  try {
    if (staged.scene.version !== 24 && staged.scene.version !== 25 && staged.scene.version !== 26) throw new Error('Scene v24, v25 or v26 required');
    nextTree = createDisplayTreeFromScene(staged.scene);
    const found = nextTree.get('RotatedFrame');
    if (found?.kind !== 'frame' || nextTree.get('NestedInner')?.kind !== 'frame' ||
        nextTree.get('Sprite')?.kind !== 'sprite' || nextTree.get('Glyph')?.kind !== 'glyphRun') {
      throw new Error('Transformed clip objects missing');
    }
    nextFrame = found;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind(); const old = renderer; canvas.replaceWith(fresh);
  canvas = fresh; renderer = staged.renderer; tree = nextTree; frame = nextFrame;
  accepted = staged.scene; generation++; pointerLog = []; restoredEdit = false; refusal = null;
  subscribe(); unbind = bind(); old.dispose(); show('Opened an editable Scene v24 on a fresh canvas');
}
subscribe(); unbind = bind();
document.querySelector('#edit')?.addEventListener('click', edit);
document.querySelector('#toggle')?.addEventListener('click', toggleClip);
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#view')?.addEventListener('click', rejectedView);
document.querySelector('#scene-limit')?.addEventListener('click', rejectedScene);
document.querySelector('#save')?.addEventListener('click', () => { void save().catch(error => show(`Save failed: ${errorCode(error)}`)); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${errorCode(error)}`)); openInput.value = '';
});
Object.assign(window, { canvas2dTransformedClip: { observe, edit, toggleClip, invalid, rejectedView,
  rejectedScene, save, documentText, openText,
  get tree() { return tree; }, get canvas() { return canvas; }, get renderer() { return renderer; } } });
show('Ready: public transformed frame handles');
