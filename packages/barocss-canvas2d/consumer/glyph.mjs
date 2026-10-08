// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const options = { logicalSize: { width: 180, height: 140 }, dpr: 2 };
const pose = (/** @type {number} */ x = 0, /** @type {number} */ y = 0) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const patterns = [
  ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
];
const pixels = new Uint8Array(10 * 7 * 4);
for (let letter = 0; letter < 2; letter++) for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
  if (patterns[letter][y][x] === '1') pixels.set([20, 32, 56, 255], (y * 10 + letter * 5 + x) * 4);
}
/** @param {number} sourceX @param {number} x @param {number} start */
const quad = (sourceX, x, start) => ({ sourceRect: { x: sourceX, y: 0, width: 5, height: 7 },
  x, y: -56, width: 40, height: 56, textStart: start, textEnd: start + 1 });
let tree = createDisplayTree('GlyphConsumer');
let team = tree.createContainer({ id: 'Team', layer: 1, transform: pose(10, 0) });
let glyph = tree.createGlyphRun({ id: 'Title', layer: 1, transform: pose(20, 0),
  atlasId: 'Atlas', text: 'HI', baseline: 100, opacity: 1, sampling: 'nearest',
  glyphs: [quad(0, 0, 0), quad(5, 48, 1)] });
const paper = tree.createRect({ id: 'Paper', layer: 0, transform: pose(),
  width: 180, height: 140, fill: [1, 1, 1, 1] });
tree.stage.addChild(paper); tree.stage.addChild(team); team.addChild(glyph);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('Atlas', { width: 10, height: 7, pixels });
/** @type {import('@barocss/canvas2d').Scene} */
let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let log = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const input = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[34, 50], [42, 50], [80, 50], [96, 80]];
/** @param {number} x @param {number} y */
function pixel(x, y) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 context missing');
  const bytes = new Uint8Array(4);
  gl.readPixels(x * options.dpr, canvas.height - y * options.dpr - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
function observe() {
  const assetBytes = renderer.getImageAsset('Atlas')?.pixels ?? new Uint8Array();
  return { generation, scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()),
    text: glyph.data.text, assetBytes: [...assetBytes],
    assetMatchesHostPattern: assetBytes.length === pixels.length && assetBytes.every((byte, index) => byte === pixels[index]),
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y }) })), log: [...log] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  const born = generation;
  glyph.onPointer('pointerdown', event => log.push(`g${born}:glyph:${event.target?.id}`));
  team.onPointer('pointerdown', () => log.push(`g${born}:team`));
  tree.stage.onPointer('pointerdown', () => log.push(`g${born}:stage`));
}
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const onPointer = (event) => {
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
function submit(message) { const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message); }
function edit() {
  glyph.setLayout({ atlasId: 'Atlas', text: 'I', baseline: 100, opacity: 1,
    sampling: 'nearest', glyphs: [quad(5, 0, 0)] });
  submit('Changed to I');
}
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { glyph.setLayout({ atlasId: 'Atlas', text: 'I', baseline: 100, opacity: 1,
    sampling: 'nearest', glyphs: [{ ...quad(5, 0, 0), textEnd: 2 }] }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected layout ${code}; retained ${JSON.stringify(observe()) === before}`);
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'glyph-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').ContainerHandle} */ let nextTeam;
  /** @type {import('@barocss/canvas2d').GlyphRunHandle} */ let nextGlyph;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const group = nextTree.get('Team'), title = nextTree.get('Title');
    if (group?.kind !== 'container' || title?.kind !== 'glyphRun' || !group.children.includes(title)) {
      throw new Error('Document does not contain the glyph run');
    }
    nextTeam = group; nextGlyph = title;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; team = nextTeam; glyph = nextGlyph;
  accepted = /** @type {import('@barocss/canvas2d').Scene} */ (staged.scene);
  generation++; log = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened editable glyph tree');
}
subscribe(); unbind = bind();
document.querySelector('#edit')?.addEventListener('click', edit);
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
input.addEventListener('change', () => {
  const file = input.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Rejected Open: ${/** @type {Error} */ (error).message}`));
  input.value = '';
});
Object.assign(window, { __glyphConsumer: { observe, edit, invalid, save, openText,
  get tree() { return tree; }, get canvas() { return canvas; }, get renderer() { return renderer; } } });
show('Ready: public glyph run handle');
