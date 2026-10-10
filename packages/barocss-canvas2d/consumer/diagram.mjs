// @ts-check
import { createCanvas2D, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, parseCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';
import { makeDiagram, readDiagram, atlasAsset, copyDiagramAsset, setLabel,
  updateConnector, validatePosition } from './diagram-host.mjs';

import { browserLabelIds, copyBrowserLabelAssets, makeBrowserDiagram, readBrowserDiagram, setBrowserLabel, BrowserLabelGate, prepareBrowserLabel } from './diagram-host.mjs';
if(new URLSearchParams(location.search).get('labels')==='1'){void startBrowserLabels();}else{
/** @typedef {import('@barocss/canvas2d').Point} Point */
/** @typedef {'A'|'B'} Key */
/** @typedef {ReturnType<typeof makeDiagram>} Bundle */
/** @typedef {{ canvas: HTMLCanvasElement, renderer: import('@barocss/canvas2d').Canvas2DRenderer,
 * bundle: Bundle, scene: import('@barocss/canvas2d').Scene, asset: import('@barocss/canvas2d').ImageAssetInput,
 * generation: number, canvasGeneration: number, source: 'initial'|'edit'|'document', unbind: () => void }} Session */
const options = { logicalSize: { width: 360, height: 240 }, dpr: 2 };
const identityView = { panX: 0, panY: 0, zoom: 1 };
const atlasId = 'DiagramAtlas';
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
/** @type {Session | null} */ let session = null;
let requestedGeneration = 0;
let canvasGeneration = 0;
let disposed = false;
/** @type {{ pointerId: number, key: Key, grab: Point } | null} */ let drag = null;
/** @type {Key | null} */ let selected = null;
let lastPointerId = -1;
/** @type {{ viewport: Point, world: Point, local: Point, spatialHit: string|null } | null} */ let pointer = null;
/** @type {{ code: string, retained: boolean, generation: number } | null} */ let failure = null;
/** @type {{ filename: string, byteLength: number } | null} */ let saved = null;
/** @type {{ filename: string, byteLength: number, backingWidth: number, backingHeight: number } | null} */ let png = null;
/** @type {{ bytesEqualPrevious: boolean | null, topologyBeforeRenderer: true } | null} */ let opened = null;
/** @type {ReturnType<typeof sessionObservation> | null} */ let terminal = null;
/** @type {string[]} */ const pointerLog = [];
/** @type {string[]} */ const hoverLog = [];
/** @type {(() => void)[]} */ const hostUnbind = [];
/** @type {'open'|'png'|null} */ let temporary = null;
/** @type {(() => void)[]} */ const waiters = [];
const counts = { rendererCreated: 0, rendererDisposed: 0, liveDisplayRenderers: 0, maxDisplayRenderers: 0,
  sceneSubmits: 0, renders: 0, transactions: 0, captureTransfers: 0, pointerEvents: 0,
  binds: 0, unbinds: 0, oldDomCallbacks: 0, errors: 0, ignored: 0, openCalls: 0,
  pngCalls: 0, pngTemporaryCanvases: 0, disposeCalls: 0 };
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const input = /** @type {HTMLInputElement} */ (document.querySelector('#open'));

/** @param {unknown} error */
function codeOf(error) { return error instanceof Error && 'code' in error ? String(error.code)
  : error instanceof Error ? error.name : String(error); }
/** @param {number} token */
function current(token) { return !disposed && token === requestedGeneration; }
/** @param {Uint8Array} bytes */
function hash(bytes) { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619);
  return (value >>> 0).toString(16).padStart(8, '0'); }
/** @param {import('@barocss/canvas2d').ImageAssetInput} a @param {import('@barocss/canvas2d').ImageAssetInput} b */
function sameBytes(a, b) { return a.width === b.width && a.height === b.height && a.pixels.length === b.pixels.length &&
  a.pixels.every((value, index) => value === b.pixels[index]); }
/** @param {Session} s @param {Point} viewport */
function sample(s, viewport) {
  const hit = s.renderer.hitTest(viewport)?.id ?? null, hits = s.renderer.hitTestAll(viewport).map(item => item.id);
  if (viewport.x < 0 || viewport.y < 0 || viewport.x >= options.logicalSize.width || viewport.y >= options.logicalSize.height) {
    return { viewport, rgba: null, hit, hits };
  }
  const gl = s.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable'); const bytes = new Uint8Array(4);
  gl.readPixels(Math.floor(viewport.x * options.dpr), s.canvas.height - Math.floor(viewport.y * options.dpr) - 1,
    1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return { viewport, rgba: [...bytes], hit, hits };
}
/** @param {Session} s @param {Key} key */
function labelPoints(s, key) {
  const label = s.bundle.labels[key], quad = label.data.glyphs[0], crop = quad.sourceRect;
  /** @type {Point|null} */ let opaque = null;
  /** @type {Point|null} */ let transparent = null;
  let opaqueDistance = Infinity, transparentDistance = Infinity;
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const alpha = s.asset.pixels[((crop.y + y) * s.asset.width + crop.x + x) * 4 + 3];
    const distance = Math.abs(x - (crop.width - 1) / 2) + Math.abs(y - (crop.height - 1) / 2);
    if (alpha === 255 && distance < opaqueDistance) { opaque = { x, y }; opaqueDistance = distance; }
    if (alpha === 0 && distance < transparentDistance) { transparent = { x, y }; transparentDistance = distance; }
  }
  const convert = (/** @type {Point} */ pixel) => ({ atlas: { x: crop.x + pixel.x, y: crop.y + pixel.y },
    viewport: s.renderer.worldToViewport(label.toWorld({ x: quad.x + (pixel.x + 0.5) * quad.width / crop.width,
      y: label.data.baseline + quad.y + (pixel.y + 0.5) * quad.height / crop.height })) });
  return { opaque: opaque && convert(opaque), transparent: transparent && convert(transparent) };
}
/** @param {Session} s */
function pointsFor(s) {
  const a = labelPoints(s, 'A'), b = labelPoints(s, 'B');
  const midpoint = s.bundle.frame.toLocal(s.bundle.nodes.A.toWorld({ x: 45, y: 25 }));
  const end = s.bundle.frame.toLocal(s.bundle.nodes.B.toWorld({ x: 45, y: 25 }));
  return { opaqueA: a.opaque, transparentA: a.transparent, opaqueB: b.opaque, transparentB: b.transparent,
    boxA: s.renderer.worldToViewport(s.bundle.nodes.A.toWorld({ x: 75, y: 38 })),
    boxB: s.renderer.worldToViewport(s.bundle.nodes.B.toWorld({ x: 75, y: 38 })),
    connector: s.renderer.worldToViewport(s.bundle.frame.toWorld({ x: (midpoint.x + end.x) / 2, y: (midpoint.y + end.y) / 2 })),
    clipOutside: s.renderer.worldToViewport(s.bundle.frame.toWorld({ x: -4, y: 70 })), background: { x: 12, y: 12 } };
}
/** @param {Session} s */
function samplesFor(s) {
  const points = pointsFor(s);
  return { opaqueA: points.opaqueA && sample(s, points.opaqueA.viewport),
    transparentA: points.transparentA && sample(s, points.transparentA.viewport),
    opaqueB: points.opaqueB && sample(s, points.opaqueB.viewport),
    transparentB: points.transparentB && sample(s, points.transparentB.viewport),
    boxA: sample(s, points.boxA), boxB: sample(s, points.boxB), connector: sample(s, points.connector),
    clipOutside: sample(s, points.clipOutside), background: sample(s, points.background) };
}
/** @param {Session} s */
function sessionObservation(s) {
  const asset = s.renderer.getImageAsset(atlasId), captureId = drag?.pointerId ?? lastPointerId;
  return { generation: s.generation, canvasGeneration: s.canvasGeneration, source: s.source, version: s.scene.version,
    positions: { A: s.bundle.nodes.A.data.transform, B: s.bundle.nodes.B.data.transform },
    labels: { A: s.bundle.labels.A.data.text, B: s.bundle.labels.B.data.text },
    connector: s.bundle.connector.data.commands,
    ids: ['Back', 'DiagramFrame', 'Connector', 'NodeA', 'BoxA', 'LabelA', 'NodeB', 'BoxB', 'LabelB'],
    atlas: { width: s.asset.width, height: s.asset.height, byteLength: s.asset.pixels.length, hash: hash(s.asset.pixels) },
    atlasMatchesRenderer: !!asset && sameBytes(s.asset, asset), points: pointsFor(s), samples: samplesFor(s),
    capture: captureId < 0 ? null : s.bundle.tree.getPointerCapture(captureId)?.id ?? null,
    nativeCapture: captureId >= 0 && s.canvas.hasPointerCapture(captureId),
    sceneMatchesTree: stringifySceneJSON(s.scene) === stringifySceneJSON(s.bundle.tree.snapshot()),
    backing: { width: s.canvas.width, height: s.canvas.height } };
}
function observe() {
  return { disposed, requestedGeneration, generation: session?.generation ?? terminal?.generation ?? null,
    selected, drag: drag && { ...drag, grab: { ...drag.grab } }, pointer, temporary, view: { ...identityView },
    counts: { ...counts }, activeBindings: counts.binds - counts.unbinds, failure, saved, png, opened,
    pointerLog: [...pointerLog], hoverLog: [...hoverLog], accepted: session ? sessionObservation(session) : terminal };
}
function points() { return session ? pointsFor(session) : terminal?.points ?? null; }
function samples() { return session ? samplesFor(session) : terminal?.samples ?? null; }
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2);
  for (const button of Array.from(document.querySelectorAll('button'))) button.disabled = disposed; input.disabled = disposed; }
function fingerprint() { return JSON.stringify({ scene: session && stringifySceneJSON(session.scene), selected, drag,
  listenerGeneration: session?.generation ?? null, bytes: session && [...(session.renderer.getImageAsset(atlasId)?.pixels ?? [])],
  accepted: session && sessionObservation(session) }); }
/** @param {unknown} error @param {string} before @param {number} token */
function refused(error, before, token) {
  if (!current(token)) { counts.ignored++; return; }
  counts.errors++; failure = { code: codeOf(error), retained: fingerprint() === before, generation: token };
  show(`Candidate refused: ${failure.code}`); return failure;
}
function clearDrag() { const id = drag?.pointerId ?? lastPointerId; drag = null;
  if (id >= 0) { session?.bundle.tree.releasePointer(id); if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); } }
/** @param {Session} s */
function bind(s) {
  counts.binds++;
  /** @type {(() => void)[]} */ const unsubscribe = [];
  for (const key of /** @type {const} */ (['A', 'B'])) {
    const node = s.bundle.nodes[key];
    unsubscribe.push(node.onPointer('pointerdown', event => {
      if (drag || disposed || session !== s) return; const local = s.bundle.frame.toLocal(event.point);
      drag = { pointerId: event.pointerId, key, grab: { x: local.x - node.data.transform.x, y: local.y - node.data.transform.y } };
      selected = key; s.bundle.tree.capturePointer(event.pointerId, node);
    }));
    unsubscribe.push(node.onPointer('pointermove', event => {
      if (disposed || drag?.pointerId !== event.pointerId || drag.key !== key) return;
      const local = s.bundle.frame.toLocal(event.point); move(key, local.x - drag.grab.x, local.y - drag.grab.y);
    }));
  }
  const handles = [s.bundle.frame, s.bundle.connector, s.bundle.nodes.A, s.bundle.nodes.B,
    s.bundle.boxes.A, s.bundle.boxes.B, s.bundle.labels.A, s.bundle.labels.B, s.bundle.tree.get('Back')];
  for (const handle of handles) {
    if (!handle) continue;
    for (const type of /** @type {const} */ (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])) {
      unsubscribe.push(handle.onPointer(type, event => pointerLog.push(`g${s.generation}:${event.pointerId}:${type}:${handle.id}:${event.target?.id}`)));
    }
  }
  for (const type of /** @type {const} */ (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])) {
    unsubscribe.push(s.bundle.tree.stage.onPointer(type, event => pointerLog.push(`g${s.generation}:${event.pointerId}:${type}:stage:${event.target?.id ?? 'none'}`)));
  }
  for (const handle of [s.bundle.boxes.A, s.bundle.boxes.B, s.bundle.labels.A, s.bundle.labels.B]) {
    for (const type of /** @type {const} */ (['pointerenter', 'pointerleave'])) {
      unsubscribe.push(handle.onHover(type, event => hoverLog.push(`${event.pointerId}:${type}:${handle.id}`)));
    }
  }
  const onPointer = (/** @type {PointerEvent} */ event) => {
    if (disposed || session !== s) { counts.oldDomCallbacks++; return; }
    counts.pointerEvents++; lastPointerId = event.pointerId; const rect = s.canvas.getBoundingClientRect();
    const viewport = { x: (event.clientX - rect.left) * options.logicalSize.width / rect.width,
      y: (event.clientY - rect.top) * options.logicalSize.height / rect.height };
    const world = s.renderer.viewportToWorld(viewport);
    pointer = { viewport, world, local: s.bundle.frame.toLocal(world), spatialHit: s.renderer.hitTest(viewport)?.id ?? null };
    try {
      s.bundle.tree.dispatchPointer({ type: /** @type {import('@barocss/canvas2d').PointerEventType} */ (event.type),
        pointerId: event.pointerId, point: world, hit: s.renderer.hitTest(viewport) });
      if (event.type === 'pointerdown' && drag?.pointerId === event.pointerId) canvas.setPointerCapture(event.pointerId);
      const active = session;
      if (event.type === 'pointermove' && active) active.bundle.tree.dispatchHover({ pointerId: event.pointerId,
        point: world, hit: active.renderer.hitTest(viewport) });
    } catch (error) { counts.errors++; show(`Pointer refused: ${codeOf(error)}`); }
    finally {
      if ((event.type === 'pointerup' || event.type === 'pointercancel') && drag?.pointerId === event.pointerId) clearDrag();
    }
    if (pointerLog.length > 160) pointerLog.splice(0, pointerLog.length - 160);
    if (hoverLog.length > 80) hoverLog.splice(0, hoverLog.length - 80); show(`Received ${event.type}`);
  };
  const onLostCapture = (/** @type {PointerEvent} */ event) => {
    if (drag?.pointerId === event.pointerId) { clearDrag(); show('Released lost native capture'); }
  };
  for (const type of /** @type {const} */ (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])) s.canvas.addEventListener(type, onPointer);
  s.canvas.addEventListener('lostpointercapture', onLostCapture);
  let detached = false;
  return () => { if (detached) return; detached = true; counts.unbinds++;
    for (const type of /** @type {const} */ (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])) s.canvas.removeEventListener(type, onPointer);
    s.canvas.removeEventListener('lostpointercapture', onLostCapture); for (const remove of unsubscribe) remove(); };
}
/** @param {(bundle:Bundle) => void} change */
function transact(change) {
  const s = session; if (!s || disposed) return false; const token = ++requestedGeneration; const before = fingerprint();
  /** @type {Session|null} */ let candidate = null;
  let admitted = false;
  try {
    const bundle = readDiagram(s.scene); change(bundle); updateConnector(bundle);
    if (drag) bundle.tree.capturePointer(drag.pointerId, bundle.nodes[drag.key]);
    const scene = bundle.tree.snapshot(); s.renderer.updateScene(scene); admitted = true; counts.sceneSubmits++;
    s.renderer.render(); counts.renders++;
    candidate = { ...s, bundle, scene, generation: token, source: 'edit', unbind: () => {} };
    candidate.unbind = bind(candidate); session = candidate; s.unbind();
    if (drag) { s.bundle.tree.releasePointer(drag.pointerId); counts.captureTransfers++; }
    counts.transactions++; failure = null; opened = null; show('Accepted diagram edit'); return true;
  } catch (error) {
    if (candidate && session !== candidate) candidate.unbind();
    if (admitted && session === s) { try { s.renderer.updateScene(s.scene); s.renderer.render(); } catch { /* Observed retention below remains authoritative. */ } }
    refused(error, before, token); return false;
  }
}
/** @param {Key} key @param {number} x @param {number} y */
function move(key, x, y) {
  return transact(bundle => { const point = validatePosition({ x, y });
    if (key !== 'A' && key !== 'B') throw Object.assign(new Error('Unknown node key'), { code: 'HOST_DIAGRAM' });
    bundle.nodes[key].setPosition(point.x, point.y); });
}
/** @param {Key} key @param {'H'|'I'|undefined} label */
function editLabel(key = 'A', label = undefined) {
  return transact(bundle => {
    if (key !== 'A' && key !== 'B') throw Object.assign(new Error('Unknown node key'), { code: 'HOST_DIAGRAM' });
    setLabel(bundle, key, label ?? (bundle.labels[key].data.text === 'H' ? 'I' : 'H'));
  });
}
function invalidEdit() { const s = session; if (!s || disposed) return null;
  move('A', NaN, s.bundle.nodes.A.data.transform.y); return failure; }
function releaseTemporary() { temporary = null; for (const resolve of waiters.splice(0)) resolve(); }
/** @param {number} token @param {'open'|'png'} operation */
async function acquireTemporary(token, operation) {
  while (temporary && current(token)) await new Promise(resolve => waiters.push(() => resolve(undefined)));
  if (!current(token)) return false; temporary = operation; return true;
}
/** @param {import('@barocss/canvas2d').Canvas2DRenderer} renderer */
function disposeRenderer(renderer) { renderer.dispose(); counts.rendererDisposed++; counts.liveDisplayRenderers--; }
/** @param {Bundle} bundle @param {import('@barocss/canvas2d').ImageAssetInput} asset @param {number} token @param {Session['source']} source */
function stageFresh(bundle, asset, token, source) {
  if (!current(token)) return null; const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const renderer = createCanvas2D(fresh, options); counts.rendererCreated++; counts.liveDisplayRenderers++;
  counts.maxDisplayRenderers = Math.max(counts.maxDisplayRenderers, counts.liveDisplayRenderers);
  try {
    renderer.setView(identityView); renderer.setImageAsset(atlasId, asset);
    const scene = bundle.tree.snapshot(); renderer.updateScene(scene); counts.sceneSubmits++; renderer.render(); counts.renders++;
    /** @type {Session} */ const next = { canvas: fresh, renderer, bundle, scene, asset,
      generation: token, canvasGeneration: canvasGeneration + 1, source, unbind: () => {} }; return next;
  } catch (error) { disposeRenderer(renderer); throw error; }
}
/** @param {Session} next */
function adoptFresh(next) {
  next.unbind = bind(next); clearDrag(); const old = session;
  canvas.replaceWith(next.canvas); canvas = next.canvas; session = next; canvasGeneration = next.canvasGeneration;
  selected = null; pointer = null; failure = null;
  if (old) { old.unbind(); disposeRenderer(old.renderer); }
}
/** @param {string} text @param {number|null} reservedToken */
async function openText(text, reservedToken = null) {
  if (disposed) return; const token = reservedToken ?? ++requestedGeneration;
  if (!current(token)) { counts.ignored++; return; } const before = fingerprint(); const previous = session;
  counts.openCalls++; let acquired = false;
  /** @type {Session|null} */ let next = null;
  try {
    const parsed = await parseCanvasDocument(text); if (!current(token)) { counts.ignored++; return; }
    const source = parsed.assets.get(atlasId);
    if (!source || parsed.assets.size !== 1) throw Object.assign(new Error('Diagram requires one atlas'), { code: 'HOST_DIAGRAM' });
    const asset = copyDiagramAsset(source), bundle = readDiagram(parsed.scene);
    acquired = await acquireTemporary(token, 'open');
    if (!acquired || !current(token)) { counts.ignored++; return; }
    next = stageFresh(bundle, asset, token, 'document'); if (!next) return;
    adoptFresh(next); opened = { bytesEqualPrevious: previous ? sameBytes(previous.asset, asset) : null, topologyBeforeRenderer: true };
    releaseTemporary(); acquired = false; show('Opened saved diagram bytes with fresh handles and no capture');
  } catch (error) {
    if (next && session !== next) { next.unbind(); disposeRenderer(next.renderer); }
    if (acquired) { releaseTemporary(); acquired = false; } refused(error, before, token);
  } finally { if (acquired) releaseTemporary(); }
}
/** @param {Session} s */
function serialize(s) { return serializeCanvasDocument(s.scene, id => s.renderer.getImageAsset(id)); }
/** @param {Blob} blob @param {string} filename */
function download(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function save() {
  const s = session; if (!s || disposed) return; const token = requestedGeneration;
  try { const text = await serialize(s); if (!current(token) || session !== s) return;
    const filename = 'diagram-document.json'; download(new Blob([text], { type: 'application/json' }), filename);
    saved = { filename, byteLength: new TextEncoder().encode(text).length }; show('Saved accepted Scene and atlas bytes'); return text;
  } catch (error) { if (current(token)) show(`Save refused: ${codeOf(error)}`); }
}
async function exportPNG() {
  const s = session; if (!s || disposed) return; const token = requestedGeneration; let acquired = false;
  try {
    const text = await serialize(s); if (!current(token) || session !== s) return;
    acquired = await acquireTemporary(token, 'png'); if (!acquired || !current(token) || session !== s) return;
    counts.pngCalls++;
    const result = await exportCanvasDocumentPNG(text, options, () => {
      if (!current(token)) throw new Error('PNG candidate canceled'); counts.pngTemporaryCanvases++; return document.createElement('canvas'); });
    if (!current(token) || session !== s) return; releaseTemporary(); acquired = false;
    const filename = 'diagram.png'; download(result.blob, filename);
    png = { filename, byteLength: result.blob.size, backingWidth: result.backingSize.width, backingHeight: result.backingSize.height };
    show('Exported accepted document to PNG'); return png;
  } catch (error) { if (current(token)) show(`PNG refused: ${codeOf(error)}`); }
  finally { if (acquired) releaseTemporary(); }
}
function dispose() {
  counts.disposeCalls++; if (disposed) return; clearDrag(); selected = null;
  const s = session; if (s) { terminal = sessionObservation(s); s.unbind(); disposeRenderer(s.renderer); }
  session = null; disposed = true; requestedGeneration++;
  for (const resolve of waiters.splice(0)) resolve(); for (const remove of hostUnbind.splice(0)) remove(); show('Disposed diagram and listeners');
}
const actions = { label: () => editLabel(), invalid: invalidEdit, save: () => { void save(); }, png: () => { void exportPNG(); }, dispose };
for (const [id, action] of Object.entries(actions)) {
  const button = document.querySelector(`#${id}`); button?.addEventListener('click', action);
  hostUnbind.push(() => button?.removeEventListener('click', action));
}
const onOpen = () => { const file = input.files?.[0]; if (!file || disposed) return;
  const token = ++requestedGeneration; const before = fingerprint();
  void file.text().then(text => { if (!current(token)) { counts.ignored++; return; } return openText(text, token); })
    .catch(error => refused(error, before, token)); input.value = ''; };
input.addEventListener('change', onOpen); hostUnbind.push(() => input.removeEventListener('change', onOpen));
Object.defineProperty(window, 'diagram', { value: Object.freeze({ observe, samples, points, move, editLabel, invalidEdit,
  openText, save, exportPNG, dispose, get canvas() { return canvas; },
  /** @param {Point} viewport */ probe(viewport) { return session ? sample(session, viewport) : null; },
  bytes() { const bytes = session?.renderer.getImageAsset(atlasId)?.pixels; return bytes ? new Uint8Array(bytes) : null; },
  documentText() { return session ? serialize(session) : Promise.resolve(null); } }), writable: false, configurable: false });
const initial = stageFresh(makeDiagram(), copyDiagramAsset(atlasAsset()), ++requestedGeneration, 'initial');
if (initial) { adoptFresh(initial); show('Ready: drag labeled nodes or edit A from H to I'); }

}

/** The browser-label route has independent state and leaves the fixed default route above intact. */
async function startBrowserLabels(){
 /** @typedef {import('@barocss/canvas2d').Point} Point */
 /** @typedef {Map<string,import('@barocss/canvas2d').ImageAssetInput>} Assets */
 /** @typedef {{canvas:HTMLCanvasElement,renderer:import('@barocss/canvas2d').Canvas2DRenderer,bundle:ReturnType<typeof makeBrowserDiagram>,scene:import('@barocss/canvas2d').Scene,assets:Assets,profile:Record<'A'|'B',unknown>,unbind:()=>void}} BrowserSession */
 const opts={logicalSize:{width:360,height:240},dpr:2},gate=new BrowserLabelGate();
 const textInput=/** @type {HTMLInputElement} */(document.querySelector('#labelText')),keyInput=/** @type {HTMLSelectElement} */(document.querySelector('#nodeKey')),openInput=/** @type {HTMLInputElement} */(document.querySelector('#open')),status=/** @type {HTMLElement} */(document.querySelector('#status')),output=/** @type {HTMLElement} */(document.querySelector('#observation'));
 /** @type {BrowserSession|null} */let session=null;
/** @type {unknown} */let terminal=null;let canvas=/** @type {HTMLCanvasElement} */(document.querySelector('#scene')),preparing=false;
/** @type {{key:'A'|'B',id:number,grab:Point}|null} */let drag=null;
 /** @type {Record<'A'|'B',string>} */const drafts={A:'설계 A1',B:'圖面 B2'};
 const counts={helpers:0,applies:0,refusals:0,ignored:0,candidates:0,accepted:0,created:0,disposed:0,binds:0,unbinds:0,pointers:0,moves:0,opens:0,saves:0,pngs:0};
/** @type {string[]} */const pointerLog=[];
/** @type {{code:string,retained:boolean}|null} */let failure=null;
/** @type {unknown} */let saved=null;
/** @type {unknown} */ let png=null;
/** @type {unknown} */ let opened=null;
/** @type {(()=>void)[]} */const controlUnbind=[];
 /** @param {BrowserSession} s @param {'A'|'B'} key */function labelPoints(s,key){const a=s.assets.get(browserLabelIds[key]);if(!a)throw Error('asset');let ink=0,alpha=-1,clear=0;for(let i=3;i<a.pixels.length;i+=4){if(a.pixels[i]>alpha){alpha=a.pixels[i];ink=(i-3)/4;}if(a.pixels[i]===0)clear=(i-3)/4;}const g=s.bundle.labels[key],q=g.data.glyphs[0];const point=(/** @type {number} */pixel)=>s.renderer.worldToViewport(g.toWorld({x:q.x+(pixel%a.width+.5)*q.width/a.width,y:q.y+(Math.floor(pixel/a.width)+.5)*q.height/a.height}));return{ink:point(ink),clear:point(clear)};}
 /** @param {BrowserSession} s @param {Point} p */function sample(s,p){const gl=s.canvas.getContext('webgl2');if(!gl)throw Error('GL');const pixels=new Uint8Array(4);gl.readPixels(Math.floor(p.x*2),s.canvas.height-Math.floor(p.y*2)-1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return{point:p,rgba:[...pixels],hit:s.renderer.hitTest(p)?.id??null};}
 /** @param {BrowserSession} s */function accepted(s){const points={A:labelPoints(s,'A'),B:labelPoints(s,'B')};return{scene:s.scene,sceneMatchesTree:stringifySceneJSON(s.scene)===stringifySceneJSON(s.bundle.tree.snapshot()),labels:{A:s.bundle.labels.A.data,B:s.bundle.labels.B.data},positions:{A:s.bundle.nodes.A.data.transform,B:s.bundle.nodes.B.data.transform},connector:s.bundle.connector.data.commands,assets:Object.fromEntries([...s.assets].map(([id,a])=>[id,{width:a.width,height:a.height,pixels:[...a.pixels]}])),profile:structuredClone(s.profile),points,samples:{A:{ink:sample(s,points.A.ink),clear:sample(s,points.A.clear)},B:{ink:sample(s,points.B.ink),clear:sample(s,points.B.clear)}},bytesMatchRenderer:[...s.assets].every(([id,a])=>{const b=s.renderer.getImageAsset(id);return!!b&&a.width===b.width&&a.height===b.height&&a.pixels.every((v,i)=>v===b.pixels[i]);})};}
 function observe(){return{disposed:gate.disposed,preparing,generation:gate.generation,drag:drag&&{...drag,grab:{...drag.grab}},selected:keyInput.value,drafts:{...drafts},draftValue:textInput.value,counts:{...counts},failure,saved,opened,png,pointerLog:[...pointerLog],accepted:session?accepted(session):terminal};}
 function show(/** @type {string} */message){status.textContent=message;output.textContent=JSON.stringify(observe(),(k,v)=>k==='pixels'?undefined:v,2);for(const b of Array.from(document.querySelectorAll('button')))b.disabled=gate.disposed||(b.id!=='dispose'&&(!session||!!drag));openInput.disabled=gate.disposed||!session||!!drag;textInput.disabled=gate.disposed||!session||!!drag;keyInput.disabled=gate.disposed||!session||!!drag;}
 function stable(){return session?JSON.stringify(accepted(session)):'empty';}
 /** @param {unknown} error @param {string} before */function refuse(error,before){counts.refusals++;preparing=false;failure={code:error instanceof Error&&'code'in error?String(error.code):String(error),retained:stable()===before};show('Label refused: '+failure.code);return failure;}
 /** @param {BrowserSession} s */function release(s){s.unbind();s.renderer.dispose();counts.disposed++;}
 /** @param {BrowserSession} s */function bind(s){
  counts.binds++;
  /** @type {(()=>void)[]} */const stops=[];
  /** @type {('pointerdown'|'pointermove'|'pointerup'|'pointercancel'|'lostpointercapture')[]} */const attached=[];
  const pointer=(/** @type {PointerEvent} */e)=>{if(gate.disposed||session!==s)return;counts.pointers++;const r=s.canvas.getBoundingClientRect(),p={x:(e.clientX-r.left)*360/r.width,y:(e.clientY-r.top)*240/r.height},world=s.renderer.viewportToWorld(p),hit=s.renderer.hitTest(p);pointerLog.push(e.type+':'+(hit?.id??'none'));s.bundle.tree.dispatchPointer({type:/** @type {'pointerdown'|'pointermove'|'pointerup'|'pointercancel'} */(e.type),pointerId:e.pointerId,point:world,hit});if(e.type==='pointerdown'&&drag)s.canvas.setPointerCapture(e.pointerId);if((e.type==='pointerup'||e.type==='pointercancel')&&drag?.id===e.pointerId)clearDrag();show('Node input delivered');};
  const lost=(/** @type {PointerEvent} */e)=>{if(drag?.id===e.pointerId)clearDrag();};
  let done=false;const detach=()=>{if(done)return;done=true;counts.unbinds++;for(const type of attached)s.canvas.removeEventListener(type,type==='lostpointercapture'?lost:pointer);for(const stop of stops)stop();};
  try{for(const key of /** @type {const} */(['A','B'])){
    stops.push(s.bundle.nodes[key].onPointer('pointerdown',e=>{if(session!==s||gate.disposed||drag)return;gate.startDrag();preparing=false;const p=s.bundle.frame.toLocal(e.point),n=s.bundle.nodes[key].data.transform;drag={key,id:e.pointerId,grab:{x:p.x-n.x,y:p.y-n.y}};keyInput.value=key;textInput.value=drafts[key];s.bundle.tree.capturePointer(e.pointerId,s.bundle.nodes[key]);}));
    stops.push(s.bundle.nodes[key].onPointer('pointermove',e=>{if(!drag||drag.id!==e.pointerId||drag.key!==key)return;const p=s.bundle.frame.toLocal(e.point);move(key,p.x-drag.grab.x,p.y-drag.grab.y);}));
   }
   for(const type of /** @type {const} */(['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])){s.canvas.addEventListener(type,type==='lostpointercapture'?lost:pointer);attached.push(type);}return detach;
  }catch(error){detach();throw error;}
 }
 function clearDrag(){if(drag){session?.bundle.tree.releasePointer(drag.id);if(canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);}drag=null;gate.drag=false;}
 /** @param {ReturnType<typeof makeBrowserDiagram>} bundle @param {Assets} assets @param {Record<'A'|'B',unknown>} profile */function candidate(bundle,assets,profile){const owned=copyBrowserLabelAssets(assets);readBrowserDiagram(bundle.tree.snapshot(),owned);const c=document.createElement('canvas');c.id='scene';counts.candidates++;const renderer=createCanvas2D(c,opts);counts.created++;try{for(const[id,a]of owned)renderer.setImageAsset(id,a);const scene=bundle.tree.snapshot();renderer.updateScene(scene);renderer.render();return{canvas:c,renderer,bundle,scene,assets:new Map([...owned].map(([id])=>[id,/** @type {import('@barocss/canvas2d').ImageAssetInput} */(renderer.getImageAsset(id))])),profile:structuredClone(profile),unbind:()=>{}};}catch(e){renderer.dispose();counts.disposed++;throw e;}}
 /** @param {BrowserSession} next */function adopt(next){next.unbind=bind(next);const old=session;clearDrag();canvas.replaceWith(next.canvas);canvas=next.canvas;session=next;gate.session=next;counts.accepted++;preparing=false;failure=null;if(old)release(old);}
 /** @param {'A'|'B'} key @param {number} x @param {number} y */function move(key,x,y){
  const s=session;if(!s||gate.disposed)return false;const before=stable();let admitted=false;
  /** @type {BrowserSession|null} */let next=null;
  try{const p=validatePosition({x,y}),bundle=readBrowserDiagram(s.scene,s.assets);bundle.nodes[key].setPosition(p.x,p.y);updateConnector(bundle);if(drag)bundle.tree.capturePointer(drag.id,bundle.nodes[drag.key]);const scene=bundle.tree.snapshot();s.renderer.updateScene(scene);admitted=true;s.renderer.render();next={...s,bundle,scene,unbind:()=>{}};next.unbind=bind(next);session=next;gate.session=next;gate.begin();s.unbind();if(drag)s.bundle.tree.releasePointer(drag.id);counts.moves++;show('Moved diagram node');return true;
  }catch(error){if(next&&next!==session)next.unbind();if(admitted&&session===s){try{s.renderer.updateScene(s.scene);s.renderer.render();}catch{/* Retention observation is authoritative if recovery also fails. */}}refuse(error,before);return false;}
 }
 /** @param {'A'|'B'} [key] @param {string} [text] */async function apply(key=/** @type {'A'|'B'} */(keyInput.value),text=textInput.value){if(gate.disposed)return;if(!session)return refuse(Object.assign(Error('Diagram is preparing'),{code:'HOST_NOT_READY'}),stable());if((key!=='A'&&key!=='B')||typeof text!=='string')return refuse(Object.assign(Error('Unknown node key'),{code:'HOST_LABEL'}),stable());drafts[key]=text;textInput.value=text;const prior=session,token=gate.begin(),before=stable();if(drag)return refuse(Object.assign(Error('Finish dragging before editing'),{code:'HOST_DRAG'}),before);preparing=true;show('Preparing label');let next;try{const prepared=await prepareBrowserLabel(key,text,()=>gate.valid(token,prior),5000,()=>counts.helpers++);if(!prepared||!gate.valid(token,prior)){counts.ignored++;preparing=false;return;}const assets=copyBrowserLabelAssets(/** @type {BrowserSession} */(prior).assets);assets.set(browserLabelIds[key],prepared.asset);const bundle=readBrowserDiagram(/** @type {BrowserSession} */(prior).scene,/** @type {BrowserSession} */(prior).assets);setBrowserLabel(bundle,key,prepared.layout);const profile={.../** @type {BrowserSession} */(prior).profile,[key]:{font:prepared.font,dpr:prepared.dpr,textPolicy:'unicode-single-line'}};if(!gate.valid(token,prior)){counts.ignored++;return;}next=candidate(bundle,assets,profile);if(!gate.valid(token,prior)){release(next);counts.ignored++;return;}adopt(next);counts.applies++;show('Accepted node '+key+' label');}catch(e){if(next&&next!==session)release(next);if(gate.valid(token,prior))return refuse(e,before);counts.ignored++;}finally{if(gate.generation===token)preparing=false;}}
 async function documentText(){const s=session;if(!s)return null;const snapshot=s.bundle.tree.snapshot(),assets=copyBrowserLabelAssets(s.assets);return serializeCanvasDocument(snapshot,id=>assets.get(id)??null);}
 /** @param {Blob} blob @param {string} name */function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function save(){const prior=session,token=gate.generation,text=await documentText();if(!text||!gate.valid(token,prior))return;download(new Blob([text],{type:'application/json'}),'diagram-browser-labels-document.json');counts.saves++;saved={bytes:new TextEncoder().encode(text).length};show('Saved diagram');return text;}
 /** @param {string} text */async function openText(text){if(gate.disposed)return;const prior=session,token=gate.begin(),before=stable();let next;try{const parsed=await parseCanvasDocument(text);if(!gate.valid(token,prior)){counts.ignored++;return;}const assets=copyBrowserLabelAssets(parsed.assets),bundle=readBrowserDiagram(parsed.scene,assets);next=candidate(bundle,assets,{A:null,B:null});if(!gate.valid(token,prior)){release(next);counts.ignored++;return;}adopt(next);keyInput.value='A';drafts.A=next.bundle.labels.A.data.text;drafts.B=next.bundle.labels.B.data.text;textInput.value=drafts.A;counts.opens++;opened={profile:null};show('Opened saved node pixels');}catch(e){if(next&&next!==session)release(next);if(gate.valid(token,prior))refuse(e,before);else counts.ignored++;}}
 async function exportPNG(){const prior=session,token=gate.generation,text=await documentText();if(!text||!gate.valid(token,prior))return;const result=await exportCanvasDocumentPNG(text,opts,()=>document.createElement('canvas'));if(!gate.valid(token,prior))return;download(result.blob,'diagram-browser-labels.png');counts.pngs++;png={bytes:result.blob.size,width:result.backingSize.width,height:result.backingSize.height};show('Exported diagram PNG');return png;}
 function dispose(){if(gate.disposed)return;clearDrag();if(session){terminal=accepted(session);release(session);}session=null;gate.session=null;gate.disposed=true;gate.begin();preparing=false;for(const remove of controlUnbind.splice(0))remove();show('Disposed diagram');}
 const actions={applyLabel:()=>{void apply();},save:()=>{void save();},png:()=>{void exportPNG();},dispose};for(const[id,action]of Object.entries(actions)){const b=document.querySelector('#'+id);b?.addEventListener('click',action);controlUnbind.push(()=>b?.removeEventListener('click',action));}const select=()=>{textInput.value=drafts[/** @type {'A'|'B'} */(keyInput.value)];};keyInput.addEventListener('change',select);controlUnbind.push(()=>keyInput.removeEventListener('change',select));const onOpen=()=>{const file=openInput.files?.[0];if(!file||gate.disposed)return;const token=gate.begin(),prior=session,before=stable();void file.text().then(text=>{if(gate.valid(token,prior))return openText(text);counts.ignored++;}).catch(error=>{if(gate.valid(token,prior))refuse(error,before);else counts.ignored++;});openInput.value='';};openInput.addEventListener('change',onOpen);controlUnbind.push(()=>openInput.removeEventListener('change',onOpen));
 document.querySelector('#browserLabels')?.removeAttribute('hidden');/** @type {HTMLElement} */(document.querySelector('#diagramDescription')).textContent='Drag either box. The connector follows its center. Each node has its own text label. Transparent label pixels pass input to the box.';/** @type {HTMLElement} */(document.querySelector('#openDescription')).textContent='Open restores saved label pixels in a new canvas and tree. It selects node A and resets the text fields, drag and view.';for(const id of ['label','invalid'])/** @type {HTMLElement} */(document.querySelector('#'+id)).hidden=true;
 Object.defineProperty(window,'diagram',{value:Object.freeze({observe,apply,move,openText,save,exportPNG,dispose,documentText,get canvas(){return canvas;},get tree(){return session?.bundle.tree??null;},get renderer(){return session?.renderer??null;},assets(){return session?copyBrowserLabelAssets(session.assets):null;},points(){return session?{A:labelPoints(session,'A'),B:labelPoints(session,'B')}:null;}})});
 show('Preparing diagram labels');const token=gate.begin();try{const a=await prepareBrowserLabel('A',drafts.A,()=>gate.valid(token,null),5000,()=>counts.helpers++);if(!a)return;const b=await prepareBrowserLabel('B',drafts.B,()=>gate.valid(token,null),5000,()=>counts.helpers++);if(!b||!gate.valid(token,null))return;const assets=new Map([[browserLabelIds.A,a.asset],[browserLabelIds.B,b.asset]]);adopt(candidate(makeBrowserDiagram({A:a.layout,B:b.layout}),assets,{A:{font:a.font,dpr:2},B:{font:b.font,dpr:2}}));show('Ready: edit or drag either labeled node');}catch(e){refuse(e,'empty');}
}
