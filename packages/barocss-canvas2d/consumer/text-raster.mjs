// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene,
  stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, parseCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';
import { prepareRaster, boundsFromMetrics, validateText } from './text-raster-host.mjs';

/** @typedef {import('@barocss/canvas2d').Point} Point */
/** @typedef {Awaited<ReturnType<typeof prepareRaster>>} Prepared */
/** @typedef {{ left: number, right: number, top: number, bottom: number, width: number, height: number,
 * backingWidth: number, backingHeight: number, advance: number | null }} Bounds */
/** @typedef {{ canvas: HTMLCanvasElement, renderer: import('@barocss/canvas2d').Canvas2DRenderer,
 * tree: import('@barocss/canvas2d').DisplayTree, glyph: import('@barocss/canvas2d').GlyphRunHandle,
 * scene: import('@barocss/canvas2d').Scene, asset: import('@barocss/canvas2d').ImageAssetInput,
 * bounds: Bounds, font: Prepared['font'] | null, generation: number, source: 'prepared' | 'document',
 * unbind: () => void }} Session */
const options = { logicalSize: { width: 320, height: 128 }, dpr: 2 };
const atlasId = 'TextAtlas';
const pose = (/** @type {number} */ x = 0, /** @type {number} */ y = 0) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const input = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
/** @type {Session | null} */ let session = null;
let requestedGeneration = 0;
let disposed = false;
/** @type {'preparing' | 'ready' | 'error' | 'disposed'} */ let state = 'preparing';
/** @type {'edit' | 'open' | 'png' | null} */ let staged = null;
/** @type {(() => void)[]} */ const waiters = [];
/** @type {(() => void)[]} */ const hostUnbind = [];
/** @type {string[]} */ const pointerLog = [];
/** @type {{ code: string, retained: boolean, generation: number } | null} */ let failure = null;
/** @type {{ generation: number, acceptedGeneration: number | null } | null} */ let ignored = null;
/** @type {{ bytesEqualPrevious: boolean | null, samplesEqualPrevious: boolean | null,
 * ids: string[], fontPrepared: false } | null} */ let opened = null;
/** @type {{ filename: string, byteLength: number } | null} */ let saved = null;
/** @type {{ filename: string, byteLength: number, backingWidth: number, backingHeight: number } | null} */ let png = null;
/** @type {ReturnType<typeof sessionObservation> | null} */ let terminal = null;
const counts = { prepareCalls: 0, candidates: 0, accepted: 0, ignored: 0, errors: 0,
  rendererCreated: 0, rendererDisposed: 0, liveDisplayRenderers: 0, maxDisplayRenderers: 0,
  sceneSubmits: 0, renders: 0, pointerEvents: 0, openCalls: 0, pngCalls: 0,
  pngTemporaryCanvases: 0, disposeCalls: 0 };

/** @param {unknown} error */
function codeOf(error) { return error instanceof Error && 'code' in error ? String(error.code)
  : error instanceof Error ? error.name : String(error); }
/** @param {Uint8Array} bytes */
function byteHash(bytes) {
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
/** @param {import('@barocss/canvas2d').ImageAssetInput} a @param {import('@barocss/canvas2d').ImageAssetInput} b */
function sameBytes(a, b) { return a.width === b.width && a.height === b.height &&
  a.pixels.length === b.pixels.length && a.pixels.every((value, index) => value === b.pixels[index]); }
/** @param {Session} s */
function sourcePoints(s) {
  const { width, height, pixels } = s.asset;
  let maxAlpha = 0, inkX = -1, inkY = -1;
  let leftInk = width, rightInk = -1, topInk = height, bottomInk = -1;
  const columns = new Uint32Array(width);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = pixels[(y * width + x) * 4 + 3]; columns[x] += alpha;
    if (alpha > maxAlpha) { maxAlpha = alpha; inkX = x; inkY = y; }
    if (alpha) { leftInk = Math.min(leftInk, x); rightInk = Math.max(rightInk, x);
      topInk = Math.min(topInk, y); bottomInk = Math.max(bottomInk, y); }
  }
  let gapStart = -1, gapLength = 0, runStart = -1;
  for (let x = leftInk + 1; x <= rightInk; x++) {
    if (columns[x] === 0 && runStart < 0) runStart = x;
    if ((columns[x] !== 0 || x === rightInk) && runStart >= 0) {
      const length = x - runStart;
      if (length > gapLength) { gapStart = runStart; gapLength = length; } runStart = -1;
    }
  }
  let transparentX = gapStart < 0 ? -1 : gapStart + Math.floor(gapLength / 2);
  let transparentY = Math.floor((topInk + bottomInk) / 2);
  if (transparentX < 0) {
    outer: for (let y = topInk; y <= bottomInk; y++) for (let x = leftInk; x <= rightInk; x++) {
      if (pixels[(y * width + x) * 4 + 3] === 0) { transparentX = x; transparentY = y; break outer; }
    }
  }
  const quad = s.glyph.data.glyphs[0];
  const point = (/** @type {number} */ x, /** @type {number} */ y) => s.renderer.worldToViewport(s.glyph.toWorld({
    x: quad.x + (x + 0.5) * quad.width / width,
    y: s.glyph.data.baseline + quad.y + (y + 0.5) * quad.height / height }));
  return { ink: { atlas: { x: inkX, y: inkY }, alpha: maxAlpha, point: point(inkX, inkY) },
    space: transparentX < 0 ? null : { atlas: { x: transparentX, y: transparentY }, alpha: 0,
      point: point(transparentX, transparentY), emptyColumn: gapStart >= 0,
      labelHasSpace: s.glyph.data.text.includes(' ') }, inkBounds: { leftInk, rightInk, topInk, bottomInk } };
}
/** @param {Session} s @param {Point} point */
function sample(s, point) {
  const gl = s.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const bytes = new Uint8Array(4);
  gl.readPixels(Math.floor(point.x * options.dpr), s.canvas.height - Math.floor(point.y * options.dpr) - 1,
    1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return { point, rgba: [...bytes], hit: s.renderer.hitTest(point)?.id ?? null,
    hits: s.renderer.hitTestAll(point).map(hit => hit.id) };
}
/** @param {Session} s */
function sessionObservation(s) {
  const points = sourcePoints(s); const actual = s.renderer.getImageAsset(atlasId);
  return { generation: s.generation, source: s.source, text: s.glyph.data.text, sceneVersion: s.scene.version,
    bounds: { ...s.bounds }, font: s.font && { ...s.font },
    atlas: { width: s.asset.width, height: s.asset.height, byteLength: s.asset.pixels.length, hash: byteHash(s.asset.pixels) },
    atlasMatchesRenderer: !!actual && sameBytes(s.asset, actual),
    quad: s.glyph.data.glyphs[0], baseline: { ...s.glyph.data.transform, value: s.glyph.data.baseline },
    points, ink: sample(s, points.ink.point), space: points.space && sample(s, points.space.point),
    background: sample(s, { x: 300, y: 110 }),
    sceneMatchesTree: stringifySceneJSON(s.scene) === stringifySceneJSON(s.tree.snapshot()),
    backing: { width: s.canvas.width, height: s.canvas.height }, ids: s.tree.stage.children.map(child => child.id) };
}
function observe() {
  return { state, disposed, requestedGeneration, acceptedGeneration: session?.generation ?? terminal?.generation ?? null,
    staged, dpr: options.dpr, counts: { ...counts }, failure, ignored, opened, saved, png,
    pointerLog: [...pointerLog], accepted: session ? sessionObservation(session) : terminal };
}
function points() { return session ? sourcePoints(session) : null; }
/** @param {string} message */
function show(message) {
  status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2);
  for (const id of ['hi', 'space', 'slow', 'malformed', 'oversize', 'save', 'restored', 'png', 'dispose']) {
    /** @type {HTMLButtonElement} */ (document.querySelector(`#${id}`)).disabled = disposed;
  }
  input.disabled = disposed;
}
function fingerprint() {
  const s = session;
  return s ? JSON.stringify({ generation: s.generation, scene: stringifySceneJSON(s.scene),
    bytes: [...(s.renderer.getImageAsset(atlasId)?.pixels ?? [])], samples: sessionObservation(s), canvas: s.generation }) : 'empty';
}
/** @param {number} token */
function current(token) { return !disposed && token === requestedGeneration; }
/** @param {number} token */
function markIgnored(token) { counts.ignored++; ignored = { generation: token, acceptedGeneration: session?.generation ?? null }; }
function wakeWaiters() { for (const resolve of waiters.splice(0)) resolve(); }
/** @param {number} token @param {'edit' | 'open' | 'png'} operation */
async function acquireStage(token, operation) {
  while (staged && current(token)) await new Promise(resolve => waiters.push(() => resolve(undefined)));
  if (!current(token)) return false;
  staged = operation; return true;
}
function releaseStage() { staged = null; wakeWaiters(); }
function recordRenderer() { counts.rendererCreated++; counts.liveDisplayRenderers++;
  counts.maxDisplayRenderers = Math.max(counts.maxDisplayRenderers, counts.liveDisplayRenderers); }
/** @param {import('@barocss/canvas2d').Canvas2DRenderer} renderer */
function disposeRenderer(renderer) { renderer.dispose(); counts.rendererDisposed++; counts.liveDisplayRenderers--; }
/** @param {Session} s */
function bind(s) {
  const unsubscribe = [s.glyph.onPointer('pointerdown', event => pointerLog.push(`g${s.generation}:Label:${event.target?.id}`)),
    s.tree.stage.onPointer('pointerdown', event => pointerLog.push(`g${s.generation}:stage:${event.target?.id ?? 'none'}`))];
  const back = s.tree.get('Back');
  if (back) unsubscribe.push(back.onPointer('pointerdown', event => pointerLog.push(`g${s.generation}:Back:${event.target?.id}`)));
  const onPointer = (/** @type {PointerEvent} */ event) => {
    if (disposed || session !== s) return;
    counts.pointerEvents++; const rect = s.canvas.getBoundingClientRect();
    const viewport = { x: (event.clientX - rect.left) * options.logicalSize.width / rect.width,
      y: (event.clientY - rect.top) * options.logicalSize.height / rect.height };
    s.tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
      point: s.renderer.viewportToWorld(viewport), hit: s.renderer.hitTest(viewport) });
    if (pointerLog.length > 80) pointerLog.splice(0, pointerLog.length - 80); show('Dispatched real pointerdown');
  };
  s.canvas.addEventListener('pointerdown', onPointer);
  return () => { s.canvas.removeEventListener('pointerdown', onPointer); for (const unbind of unsubscribe) unbind(); };
}
/** @param {Session} next */
function adopt(next) {
  next.unbind = bind(next); const old = session;
  canvas.replaceWith(next.canvas); canvas = next.canvas; session = next; counts.accepted++; state = 'ready'; failure = null;
  if (old) { old.unbind(); disposeRenderer(old.renderer); }
}
/** @param {Prepared} prepared @param {number} token */
function stagePrepared(prepared, token) {
  const tree = createDisplayTree('TextRasterConsumer');
  tree.stage.addChild(tree.createRect({ id: 'Back', layer: 0, transform: pose(),
    width: 320, height: 128, fill: [32 / 255, 40 / 255, 56 / 255, 1] }));
  const b = prepared.bounds;
  const glyph = tree.createGlyphRun({ id: 'Label', layer: 1, transform: pose(24, 64),
    atlasId, text: prepared.text, baseline: 0, opacity: 1, sampling: 'nearest', glyphs: [{
      sourceRect: { x: 0, y: 0, width: prepared.asset.width, height: prepared.asset.height },
      x: b.left, y: b.top, width: b.width, height: b.height, textStart: 0, textEnd: prepared.text.length }] });
  tree.stage.addChild(glyph);
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const renderer = createCanvas2D(fresh, options); recordRenderer();
  try {
    renderer.setImageAsset(atlasId, prepared.asset); const scene = tree.snapshot(); renderer.updateScene(scene);
    counts.sceneSubmits++; renderer.render(); counts.renders++;
    return { canvas: fresh, renderer, tree, glyph, scene, asset: prepared.asset,
      bounds: { ...b }, font: prepared.font, generation: token,
      source: /** @type {const} */ ('prepared'), unbind: () => {} };
  } catch (error) { disposeRenderer(renderer); throw error; }
}
/** @param {unknown} error @param {string} before @param {number} token */
function reportFailure(error, before, token) {
  if (!current(token)) { markIgnored(token); return; }
  counts.errors++; failure = { code: codeOf(error), retained: fingerprint() === before, generation: token };
  state = session ? 'ready' : 'error'; show(`Candidate refused: ${failure.code}`);
}
/** @param {string} text @param {number} delayMS */
async function edit(text, delayMS = 0) {
  if (disposed) return;
  const token = ++requestedGeneration; const before = fingerprint(); counts.candidates++; counts.prepareCalls++;
  state = 'preparing'; show(`Preparing ${JSON.stringify(text)}`);
  let acquired = false;
  /** @type {Session | null} */ let candidate = null;
  try {
    const prepared = await prepareRaster(text, delayMS);
    if (!current(token)) { markIgnored(token); return; }
    acquired = await acquireStage(token, 'edit');
    if (!acquired || !current(token)) { markIgnored(token); return; }
    candidate = stagePrepared(prepared, token); adopt(candidate); opened = null;
    releaseStage(); acquired = false; show(`Accepted ${JSON.stringify(text)}`);
  } catch (error) {
    if (candidate && session !== candidate) { candidate.unbind(); disposeRenderer(candidate.renderer); }
    if (acquired) { releaseStage(); acquired = false; }
    reportFailure(error, before, token);
  }
  finally { if (acquired) releaseStage(); }
}
function oversize() {
  if (disposed) return;
  const token = ++requestedGeneration; const before = fingerprint(); let error = null;
  try { boundsFromMetrics({ width: 600, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 600,
    actualBoundingBoxAscent: 24, actualBoundingBoxDescent: 0 }); }
  catch (caught) { error = caught; }
  if (error) reportFailure(error, before, token);
  else { failure = { code: 'ACCEPTED', retained: fingerprint() === before, generation: token }; show('Oversized metrics admitted'); }
  return failure;
}
/** @param {string} text */
async function openText(text) {
  if (disposed) return;
  const token = ++requestedGeneration; const before = fingerprint(); const previous = session;
  counts.openCalls++; state = 'preparing'; show('Validating saved scene and bytes'); let acquired = false;
  /** @type {Session | null} */ let candidate = null;
  try {
    const parsed = await parseCanvasDocument(text);
    if (!current(token)) { markIgnored(token); return; }
    const tree = createDisplayTreeFromScene(parsed.scene);
    const back = tree.get('Back'), glyph = tree.get('Label'), asset = parsed.assets.get(atlasId);
    if (tree.stage.children.length !== 2 || back?.kind !== 'rect' || glyph?.kind !== 'glyphRun' ||
        !tree.stage.children.includes(back) || !tree.stage.children.includes(glyph) || parsed.assets.size !== 1 ||
        !asset || glyph.data.atlasId !== atlasId || glyph.data.glyphs.length !== 1 ||
        glyph.data.baseline !== 0 || glyph.data.transform.x !== 24 || glyph.data.transform.y !== 64 ||
        glyph.data.transform.scaleX !== 1 || glyph.data.transform.scaleY !== 1 || glyph.data.transform.rotation !== 0 ||
        glyph.data.opacity !== 1 || glyph.data.sampling !== 'nearest' || back.data.width !== 320 || back.data.height !== 128) {
      throw Object.assign(new Error('Document topology differs from this consumer'), { code: 'HOST_RASTER' });
    }
    validateText(glyph.data.text);
    const quad = glyph.data.glyphs[0];
    if (quad.sourceRect.x !== 0 || quad.sourceRect.y !== 0 || quad.sourceRect.width !== asset.width ||
        quad.sourceRect.height !== asset.height || quad.width * 2 !== asset.width || quad.height * 2 !== asset.height ||
        quad.textStart !== 0 || quad.textEnd !== glyph.data.text.length || asset.width > 1024 || asset.height > 128 ||
        asset.width * asset.height > 131072 || !asset.pixels.some((value, index) => index % 4 === 3 && value > 0)) {
      throw Object.assign(new Error('Document raster bounds differ from this consumer'), { code: 'HOST_RASTER' });
    }
    acquired = await acquireStage(token, 'open');
    if (!acquired || !current(token)) { markIgnored(token); return; }
    const fresh = document.createElement('canvas'); fresh.id = 'scene';
    const renderer = createCanvas2D(fresh, options); recordRenderer();
    /** @type {Session} */ let next;
    try {
      for (const [id, image] of parsed.assets) renderer.setImageAsset(id, image);
      renderer.updateScene(parsed.scene); counts.sceneSubmits++; renderer.render(); counts.renders++;
      next = { canvas: fresh, renderer, tree, glyph, scene: parsed.scene, asset,
        bounds: { left: quad.x, right: quad.x + quad.width, top: quad.y, bottom: quad.y + quad.height,
          width: quad.width, height: quad.height, backingWidth: asset.width, backingHeight: asset.height, advance: null },
        font: null, generation: token, source: 'document', unbind: () => {} };
      opened = { bytesEqualPrevious: previous ? sameBytes(previous.asset, asset) : null,
        samplesEqualPrevious: previous ? JSON.stringify({ ink: sessionObservation(previous).ink, space: sessionObservation(previous).space }) ===
          JSON.stringify({ ink: sessionObservation(next).ink, space: sessionObservation(next).space }) : null,
        ids: tree.stage.children.map(child => child.id), fontPrepared: false };
    } catch (error) { disposeRenderer(renderer); throw error; }
    candidate = next; adopt(next); releaseStage(); acquired = false;
    show('Opened saved bytes on a fresh editable tree; font was not prepared');
  } catch (error) {
    if (candidate && session !== candidate) { candidate.unbind(); disposeRenderer(candidate.renderer); }
    if (acquired) { releaseStage(); acquired = false; }
    reportFailure(error, before, token);
  }
  finally { if (acquired) releaseStage(); }
}
/** @param {Session} s */
function serialize(s) { return serializeCanvasDocument(s.scene, id => s.renderer.getImageAsset(id)); }
/** @param {Blob} blob @param {string} filename */
function download(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function save() {
  const s = session; if (!s || disposed) return;
  try {
    const text = await serialize(s); if (disposed || session !== s) return;
    const filename = `text-raster-${s.glyph.data.text.replaceAll(' ', '-')}.json`;
    download(new Blob([text], { type: 'application/json' }), filename);
    saved = { filename, byteLength: new TextEncoder().encode(text).length }; show(`Saved ${filename}`); return text;
  } catch (error) { if (!disposed && session === s) show(`Save refused: ${codeOf(error)}`); }
}
async function exportPNG() {
  const s = session; if (!s || disposed) return; const token = requestedGeneration; let acquired = false;
  try {
    const text = await serialize(s); if (!current(token) || session !== s) return;
    acquired = await acquireStage(token, 'png'); if (!acquired || !current(token) || session !== s) return;
    counts.pngCalls++;
    const result = await exportCanvasDocumentPNG(text, options, () => {
      if (!current(token)) throw new Error('PNG candidate canceled');
      counts.pngTemporaryCanvases++; return document.createElement('canvas');
    });
    if (!current(token) || session !== s) return;
    releaseStage(); acquired = false;
    const filename = 'text-raster.png'; download(result.blob, filename);
    png = { filename, byteLength: result.blob.size, backingWidth: result.backingSize.width,
      backingHeight: result.backingSize.height }; show('Exported accepted document to PNG'); return png;
  } catch (error) { if (current(token)) show(`PNG refused: ${codeOf(error)}`); }
  finally { if (acquired) releaseStage(); }
}
function dispose() {
  counts.disposeCalls++; if (disposed) return;
  const s = session; if (s) { terminal = sessionObservation(s); s.unbind(); disposeRenderer(s.renderer); }
  session = null; disposed = true; state = 'disposed'; requestedGeneration++; wakeWaiters();
  for (const unbind of hostUnbind.splice(0)) unbind(); show('Disposed; late text candidates are ignored');
}
const actions = { hi: () => { void edit('HI'); }, space: () => { void edit('H I'); },
  slow: () => { void edit('HI', 750); }, malformed: () => { void edit('HI\n'); }, oversize,
  save: () => { void save(); }, restored: () => { void edit('HI'); }, png: () => { void exportPNG(); }, dispose };
for (const [id, action] of Object.entries(actions)) {
  const button = document.querySelector(`#${id}`); button?.addEventListener('click', action);
  hostUnbind.push(() => button?.removeEventListener('click', action));
}
const onOpen = () => {
  const file = input.files?.[0]; if (!file || disposed) return;
  const token = ++requestedGeneration; const before = fingerprint(); state = 'preparing'; show('Reading selected document');
  void file.text().then(text => {
    if (!current(token)) { markIgnored(token); return; }
    return openText(text);
  }).catch(error => reportFailure(error, before, token)); input.value = '';
};
input.addEventListener('change', onOpen); hostUnbind.push(() => input.removeEventListener('change', onOpen));
Object.defineProperty(window, 'textRaster', { value: Object.freeze({ observe, points, edit, oversize, save, openText,
  exportPNG, dispose, get canvas() { return canvas; },
  bytes() { const bytes = session?.renderer.getImageAsset(atlasId)?.pixels; return bytes ? new Uint8Array(bytes) : null; },
  documentText() { return session ? serialize(session) : Promise.resolve(null); },
  /** @param {Point} point */ pixel(point) { return session ? sample(session, point) : null; } }),
  writable: false, configurable: false });
void edit('Canvas2D');
