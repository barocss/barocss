// @ts-check
import { createCanvas2D, decodeImageBlob, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 160, height: 120 }, dpr: 2 };
const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @type {import('@barocss/canvas2d').Scene} */
const background = { version: 6, unit: 'logical-px', contextId: 'BlobConsumer',
  nodes: [{ kind: 'rect', id: 'Back', layer: 0, transform: pose(20, 20),
    width: 80, height: 80, fill: [1, 1, 0, 1] }] };
/** @type {import('@barocss/canvas2d').Scene} */
const withImage = { ...background, nodes: [...background.nodes, { kind: 'image', id: 'Sprite',
  layer: 1, transform: pose(20, 20), imageId: 'RGBA2', width: 80, height: 80,
  opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 }] };
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
/** @type {import('@barocss/canvas2d').Scene} */ let accepted = background;
renderer.updateScene(accepted); renderer.render();
let generation = 1, requestEpoch = 0, disposed = false;
const counts = { loadsStarted: 0, decoded: 0, ignored: 0, loadAdmissions: 0, stageStarts: 0, opens: 0, disposals: 0 };
/** @typedef {{epoch:number,renderer:import('@barocss/canvas2d').Canvas2DRenderer}} Request */
/** @returns {Request} */
function beginRequest() { return { epoch: ++requestEpoch, renderer }; }
/** @param {Request} request */
function current(request) { return !disposed && request.epoch === requestEpoch && request.renderer === renderer; }
/** @type {ReturnType<typeof readObservation>|null} */ let terminal = null;
/** @type {Array<()=>void>} */ const removeControls = [];
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const fileInput = /** @type {HTMLInputElement} */ (document.querySelector('#file'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[30, 30], [70, 30], [30, 70], [70, 70]];

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
function readObservation() {
  const asset = renderer.getImageAsset('RGBA2');
  return { generation, assetSize: asset ? { width: asset.width, height: asset.height } : null, scene: stringifySceneJSON(accepted),
    assetBytes: [...(asset?.pixels ?? [])],
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y),
      hit: renderer.hitTest({ x, y })?.id ?? null })) };
}
function observe() {
  const state = disposed ? structuredClone(terminal) : readObservation();
  return { ...state, disposed, requestEpoch, counts: { ...counts } };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
/** @param {Blob} blob @param {Request} request */
async function loadAt(blob, request) {
  try {
    counts.loadsStarted++;
    const asset = await decodeImageBlob(blob);
    counts.decoded++;
    if (!current(request)) { counts.ignored++; return; }
    request.renderer.setImageAsset('RGBA2', asset);
    request.renderer.updateScene(withImage); accepted = withImage; request.renderer.render();
    counts.loadAdmissions++;
    show(`Decoded ${asset.width}×${asset.height} raster image`);
  } catch (error) {
    if (!current(request)) { counts.ignored++; return; }
    throw error;
  }
}
/** @param {Blob} blob @returns {Promise<void>} */
async function loadBlob(blob) {
  if (disposed) return;
  return loadAt(blob, beginRequest());
}
/** @param {Blob} blob */
async function tryBlob(blob) {
  if (disposed) return { code: 'DISPOSED', retained: true };
  const before = JSON.stringify(observe());
  try { await decodeImageBlob(blob); if (disposed) return { code: 'DISPOSED', retained: true }; return { code: 'ACCEPTED', retained: JSON.stringify(observe()) === before }; }
  catch (error) {
    if (disposed) return { code: 'DISPOSED', retained: true };
    const code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR';
    const retained = JSON.stringify(observe()) === before;
    show(`Rejected Blob: ${code}; retained ${retained}`);
    return { code, retained };
  }
}
/** @param {number} width @param {number} height @returns {Promise<Blob>} */
async function makePng(width = 2, height = 2) {
  const source = document.createElement('canvas'); source.width = width; source.height = height;
  const context = source.getContext('2d'); if (!context) throw new Error('2D canvas missing');
  if (width === 2 && height === 2) {
    const data = context.createImageData(2, 2);
    data.data.set([255, 0, 0, 255, 0, 0, 0, 0,
      0, 0, 255, 255, 0, 255, 0, 255]);
    context.putImageData(data, 0, 0);
  } else context.fillRect(0, 0, width, height);
  return await new Promise((resolve, reject) => source.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encode failed')), 'image/png'));
}
async function downloadSample() {
  if (disposed) return;
  const blob = await makePng();
  if (disposed) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'rgba2.png'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Downloaded ${blob.size}-byte PNG`);
}
async function save() {
  if (disposed) return;
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  if (disposed) return;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'decoded-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text @param {Request} request */
async function openAt(text, request) {
  if (!current(request)) { counts.ignored++; return; }
  /** @type {import('@barocss/canvas2d/document').StagedCanvasDocument|undefined} */ let staged;
  let adopted = false;
  try {
    const fresh = document.createElement('canvas'); fresh.id = 'scene';
    counts.stageStarts++;
    staged = await stageCanvasDocument(text, fresh, options);
    if (!current(request)) { const stale = staged; staged = undefined; stale.renderer.dispose(); counts.ignored++; return; }
    if (stringifySceneJSON(staged.scene) !== stringifySceneJSON(withImage)) {
      throw new Error('Document scene does not match consumer');
    }
    const oldRenderer = renderer;
    canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
    accepted = staged.scene; adopted = true; request.renderer = renderer;
    generation++; counts.opens++; oldRenderer.dispose(); show('Opened decoded image document');
  } catch (error) {
    if (staged && !adopted) staged.renderer.dispose();
    if (!current(request)) { counts.ignored++; return; }
    throw error;
  }
}
/** @param {string} text @returns {Promise<void>} */
async function openText(text) {
  if (disposed) return;
  return openAt(text, beginRequest());
}
function dispose() {
  if (disposed) return;
  terminal = readObservation(); disposed = true; requestEpoch++;
  for (const remove of removeControls.splice(0)) remove();
  document.querySelectorAll('button,input').forEach(element => { /** @type {HTMLButtonElement|HTMLInputElement} */(element).disabled = true; });
  renderer.dispose(); counts.disposals++;
  show('Disposed image consumer');
}
/** @param {EventTarget|null} target @param {string} type @param {EventListener} callback */
function bindControl(target, type, callback) {
  target?.addEventListener(type, callback);
  removeControls.push(() => target?.removeEventListener(type, callback));
}
function onRasterSelection() {
  const file = fileInput.files?.[0]; if (!file || disposed) return;
  const request = beginRequest();
  void loadAt(file, request).catch(error => {
    if (current(request)) show(`Rejected image: ${/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR'}`);
  });
  fileInput.value = '';
}
function onOpenSelection() {
  const file = openInput.files?.[0]; if (!file || disposed) return;
  const request = beginRequest();
  void file.text().then(text => {
    if (!current(request)) { counts.ignored++; return; }
    return openAt(text, request);
  }).catch(error => {
    if (current(request)) show(`Rejected Open: ${/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR'}`);
  });
  openInput.value = '';
}
/** @param {unknown} error */
function suppressTerminalFailure(error) { if (!disposed) throw error; }
function onSample() { void downloadSample().catch(suppressTerminalFailure); }
function onSave() { void save().catch(suppressTerminalFailure); }
bindControl(document.querySelector('#sample'), 'click', onSample);
bindControl(fileInput, 'change', onRasterSelection);
bindControl(document.querySelector('#save'), 'click', onSave);
bindControl(openInput, 'change', onOpenSelection);
bindControl(document.querySelector('#dispose'), 'click', dispose);
Object.assign(window, { __decodeConsumer: { observe, loadBlob, tryBlob, makePng, save, openText, dispose,
  get renderer() { return renderer; }, get canvas() { return canvas; } } });
show('Ready: choose a raster Blob');
