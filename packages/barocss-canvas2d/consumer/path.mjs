// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 320, height: 200 }, dpr: 2 };
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const asset = { width: 1, height: 1, pixels: new Uint8Array([255, 255, 0, 255]) };
const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @returns {import('@barocss/canvas2d').PathCommand[]} */
const ring = (/** @type {number} */ right, /** @type {number} */ bottom,
  /** @type {number} */ left = 0, /** @type {number} */ top = 0) => ([
  { kind: 'M', x: left, y: top }, { kind: 'L', x: right, y: top },
  { kind: 'L', x: right, y: bottom }, { kind: 'L', x: left, y: bottom }, { kind: 'Z' },
]);
const originalCommands = [...ring(100, 100), ...ring(70, 70, 30, 30)];
/** @type {import('@barocss/canvas2d').PathCommand[]} */
const crossing = [
  { kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 80, y: 80 },
  { kind: 'L', x: 0, y: 80 }, { kind: 'L', x: 80, y: 0 }, { kind: 'Z' },
];
let tree = createDisplayTree('PathConsumer');
let team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(20, 20) });
let filled = tree.createPath({ id: 'Filled', layer: 0, transform: pose(), commands: originalCommands,
  fill: { color: [1, 0, 0, 1], rule: 'evenodd' } });
let curve = tree.createPath({ id: 'Curve', layer: 1, transform: pose(120, 0),
  commands: [{ kind: 'M', x: 0, y: 50 }, { kind: 'C', c1x: 20, c1y: 0,
    c2x: 60, c2y: 100, x: 80, y: 50 }], stroke: { color: [0, 0, 1, 1], width: 8 } });
let image = tree.createSprite({ id: 'Image', layer: 2, transform: pose(10, 10), imageId: 'Yellow',
  width: 20, height: 20, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
tree.stage.addChild(team); team.addChild(filled); team.addChild(curve); team.addChild(image);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Yellow', asset);
/** @type {import('@barocss/canvas2d').SceneV6} */
let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let log = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[25, 25], [35, 35], [80, 80], [180, 70]];

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
  return { generation, scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()),
    children: team.children.map(child => `${child.kind}:${child.id}`),
    fill: filled.data.fill, stroke: filled.data.stroke ?? null,
    assetBytes: [...(renderer.getImageAsset('Yellow')?.pixels ?? [])],
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null })),
    log: [...log] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  const born = generation;
  filled.onPointer('pointerdown', event => log.push(`g${born}:path:${event.target?.id}`));
  team.onPointer('pointerdown', event => log.push(`g${born}:group:${'id' in event.currentTarget ? event.currentTarget.id : 'stage'}`));
  tree.stage.onPointer('pointerdown', () => log.push(`g${born}:stage`));
}
function bind() {
  const currentCanvas = canvas;
  /** @param {PointerEvent} event */
  const onPointer = (event) => {
    const rect = currentCanvas.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) * options.logicalSize.width / rect.width,
      y: (event.clientY - rect.top) * options.logicalSize.height / rect.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point, hit: renderer.hitTest(point) });
    show('Dispatched pointerdown');
  };
  currentCanvas.addEventListener('pointerdown', onPointer);
  return () => currentCanvas.removeEventListener('pointerdown', onPointer);
}
/** @param {string} message */
function submit(message) { const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message); }
function edit() {
  filled.setPath({ commands: ring(40, 40), fill: { color: [0, 1, 0, 1], rule: 'evenodd' },
    stroke: { color: [0, 0, 1, 1], width: 2 } });
  submit('Filled path is green with a blue stroke');
}
function reorder() { image.setLayer(-1); submit('Image is behind the filled path'); }
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { filled.setPath({ commands: crossing,
    fill: { color: [1, 0, 0, 1], rule: 'nonzero' } }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected path ${code}; retained ${JSON.stringify(observe()) === before}`);
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'path-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').ContainerHandle} */ let nextTeam;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextFilled;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextCurve;
  /** @type {import('@barocss/canvas2d').SpriteHandle} */ let nextImage;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const group = nextTree.get('Team'), fill = nextTree.get('Filled');
    const line = nextTree.get('Curve'), sprite = nextTree.get('Image');
    if (group?.kind !== 'container' || fill?.kind !== 'path' || line?.kind !== 'path' ||
        sprite?.kind !== 'sprite' || group.children.length !== 3 ||
        !group.children.includes(fill) || !group.children.includes(line) || !group.children.includes(sprite)) {
      throw new Error('Document does not have the consumer objects');
    }
    nextTeam = group; nextFilled = fill; nextCurve = line; nextImage = sprite;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const oldRenderer = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; team = nextTeam; filled = nextFilled; curve = nextCurve; image = nextImage;
  accepted = /** @type {import('@barocss/canvas2d').SceneV6} */ (staged.scene);
  generation++; log = []; subscribe(); unbind = bind(); oldRenderer.dispose();
  show(`Opened editable path tree with ${staged.assets.size} asset`);
}
subscribe(); unbind = bind();
for (const [id, action] of Object.entries({ edit, reorder, invalid })) {
  document.querySelector(`#${id}`)?.addEventListener('click', action);
}
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => {
    show(`Rejected Open: ${/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR'}`);
  });
  openInput.value = '';
});
Object.assign(window, { __pathConsumer: { observe, edit, reorder, invalid, save, openText,
  get tree() { return tree; }, get canvas() { return canvas; }, get renderer() { return renderer; } } });
show('Ready: public path handles and compiled package entries');
