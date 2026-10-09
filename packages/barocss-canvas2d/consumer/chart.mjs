// @ts-check
import { createCanvas2D, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, parseCanvasDocument } from '@barocss/canvas2d/document';
import { initialData, validateData, dataToLocal, localToData, validateChartView,
  makeChart, readChart, setSelection } from './chart-host.mjs';

/** @typedef {import('@barocss/canvas2d').Point} Point */
/** @typedef {ReturnType<typeof makeChart>} Bundle */
/** @typedef {{ viewport: Point, world: Point, local: Point, data: Point, hits: string[], stack: string[] }} PointerState */
/** @typedef {{ bundle: Bundle, canvas: HTMLCanvasElement,
 * renderer: import('@barocss/canvas2d').Canvas2DRenderer, scene: import('@barocss/canvas2d').Scene,
 * generation: number, source: 'initial' | 'edit' | 'selection' | 'reset' | 'document' | 'view',
 * unbind: () => void }} Session */
const options = { logicalSize: { width: 320, height: 220 }, dpr: 2 };
const defaultView = { panX: 0, panY: 0, zoom: 1 };
let view = { ...defaultView };
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
/** @type {Session | null} */ let session = null;
let requestedGeneration = 0;
let disposed = false;
/** @type {string | null} */ let selected = null;
/** @type {PointerState | null} */ let pointer = null;
/** @type {{ code: string, retained: boolean, generation: number } | null} */ let failure = null;
/** @type {{ index: number, from: Point, to: Point, pathId: string, restored: boolean } | null} */ let lastEdit = null;
/** @type {{ filename: string, byteLength: number, selectionCleared: true } | null} */ let saved = null;
/** @type {{ topologyCheckedBeforeRenderer: true, viewReset: true, selectionReset: true } | null} */ let opened = null;
/** @type {ReturnType<typeof sessionObservation> | null} */ let terminal = null;
/** @type {string[]} */ const pointerLog = [];
/** @type {(() => void)[]} */ const hostUnbind = [];
const counts = { rendererCreated: 0, rendererDisposed: 0, liveRenderers: 0, maxRenderers: 0,
  sceneSubmits: 0, renders: 0, accepted: 0, viewChanges: 0, edits: 0, selections: 0,
  pointerEvents: 0, errors: 0, ignored: 0, openCalls: 0, disposeCalls: 0 };
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const selectionOutput = /** @type {HTMLElement} */ (document.querySelector('#selected'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const input = /** @type {HTMLInputElement} */ (document.querySelector('#open'));

/** @param {unknown} error */
function codeOf(error) { return error instanceof Error && 'code' in error ? String(error.code)
  : error instanceof Error ? error.name : String(error); }
/** @param {number} token */
function current(token) { return !disposed && token === requestedGeneration; }
/** @param {string} id */
function selectable(id) { return /^(Series[AB]|Mark[AB][0-7])$/.test(id); }
/** @param {Bundle} bundle @param {import('@barocss/canvas2d').Canvas2DRenderer} renderer @param {Point} viewport */
function pointerAt(bundle, renderer, viewport) {
  const world = renderer.viewportToWorld(viewport), local = bundle.plot.toLocal(world);
  const hits = renderer.hitTestAll(viewport, 8).map(hit => hit.id);
  return { viewport: { ...viewport }, world, local, data: localToData(local), hits, stack: hits.filter(selectable) };
}
/** @param {Session} s @param {Point} viewport */
function sample(s, viewport) {
  const hit = s.renderer.hitTest(viewport)?.id ?? null;
  const hits = s.renderer.hitTestAll(viewport, 8).map(item => item.id);
  if (viewport.x < 0 || viewport.y < 0 || viewport.x >= options.logicalSize.width || viewport.y >= options.logicalSize.height) {
    return { viewport, rgba: null, hit, hits };
  }
  const gl = s.canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const bytes = new Uint8Array(4);
  gl.readPixels(Math.floor(viewport.x * options.dpr), s.canvas.height - Math.floor(viewport.y * options.dpr) - 1,
    1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return { viewport, rgba: [...bytes], hit, hits };
}
/** @param {Session} s */
function pointsFor(s) {
  const fromLocal = (/** @type {Point} */ local) => s.renderer.worldToViewport(s.bundle.plot.toWorld(local));
  return { overlap: fromLocal(dataToLocal({ x: 3, y: 5 })), clippedFirstA: fromLocal(dataToLocal({ x: -1, y: 2 })),
    insideA: fromLocal(dataToLocal({ x: 1.5, y: 7 })), outsideLocal: fromLocal({ x: -8, y: 30 }),
    background: { x: 12, y: 12 } };
}
/** @param {Session} s */
function samplesFor(s) {
  return Object.fromEntries(Object.entries(pointsFor(s)).map(([name, viewport]) => [name, sample(s, viewport)]));
}
function samples() { return session ? samplesFor(session) : terminal?.samples ?? null; }
/** @param {Session} s */
function sessionObservation(s) {
  return { generation: s.generation, source: s.source, sceneVersion: s.scene.version,
    data: validateData(s.bundle.data), ids: ['Back', 'Plot', 'SeriesA', 'SeriesB',
      ...s.bundle.marks.A.map(mark => mark.id), ...s.bundle.marks.B.map(mark => mark.id), 'Selection'],
    plot: s.bundle.plot.data, selectionVisible: s.bundle.selection.data.visible,
    selectionHitMode: s.bundle.selection.data.hitMode, points: pointsFor(s), samples: samplesFor(s),
    backing: { width: s.canvas.width, height: s.canvas.height },
    sceneMatchesTree: stringifySceneJSON(s.scene) === stringifySceneJSON(s.bundle.tree.snapshot()) };
}
function observe() {
  return { disposed, requestedGeneration, generation: session?.generation ?? terminal?.generation ?? null,
    dpr: options.dpr, view: { ...view }, selected, stack: pointer ? [...pointer.stack] : [],
    pointer: pointer && { ...pointer, viewport: { ...pointer.viewport }, world: { ...pointer.world },
      local: { ...pointer.local }, data: { ...pointer.data }, hits: [...pointer.hits], stack: [...pointer.stack] },
    counts: { ...counts }, failure, lastEdit, saved, opened, pointerLog: [...pointerLog],
    accepted: session ? sessionObservation(session) : terminal };
}
/** @param {string} message */
function show(message) {
  status.textContent = message; selectionOutput.textContent = `Selected: ${selected ?? 'none'}`;
  output.textContent = JSON.stringify(observe(), null, 2);
  for (const button of Array.from(document.querySelectorAll('button'))) button.disabled = disposed;
  input.disabled = disposed;
}
function fingerprint() {
  return JSON.stringify({ scene: session && stringifySceneJSON(session.scene), view, selected, pointer,
    accepted: session && sessionObservation(session) });
}
/** @param {unknown} error @param {string} before @param {number} token */
function refused(error, before, token) {
  if (!current(token)) { counts.ignored++; return; }
  counts.errors++; failure = { code: codeOf(error), retained: fingerprint() === before, generation: token };
  show(`Candidate refused: ${failure.code}`); return failure;
}
/** @param {import('@barocss/canvas2d').Canvas2DRenderer} renderer */
function disposeRenderer(renderer) { renderer.dispose(); counts.rendererDisposed++; counts.liveRenderers--; }
/** @param {Session} s */
function bind(s) {
  /** @type {(() => void)[]} */ const unbind = [];
  const handles = [s.bundle.plot, s.bundle.series.A, s.bundle.series.B,
    ...s.bundle.marks.A, ...s.bundle.marks.B, s.bundle.tree.get('Back')];
  for (const handle of handles) {
    if (!handle) continue;
    unbind.push(handle.onPointer('pointerdown', event => pointerLog.push(`g${s.generation}:${handle.id}:${event.target?.id}`)));
  }
  unbind.push(s.bundle.tree.stage.onPointer('pointerdown', event => pointerLog.push(`g${s.generation}:stage:${event.target?.id ?? 'none'}`)));
  const onPointer = (/** @type {PointerEvent} */ event) => {
    if (disposed || session !== s) return;
    counts.pointerEvents++; const rect = s.canvas.getBoundingClientRect();
    const viewport = { x: (event.clientX - rect.left) * options.logicalSize.width / rect.width,
      y: (event.clientY - rect.top) * options.logicalSize.height / rect.height };
    const coordinate = pointerAt(s.bundle, s.renderer, viewport);
    s.bundle.tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
      point: coordinate.world, hit: s.renderer.hitTest(viewport) });
    if (pointerLog.length > 100) pointerLog.splice(0, pointerLog.length - 100);
    changeSelection(coordinate.stack[0] ?? null, viewport);
  };
  s.canvas.addEventListener('pointerdown', onPointer);
  return () => { s.canvas.removeEventListener('pointerdown', onPointer); for (const remove of unbind) remove(); };
}
/** @param {Bundle} bundle @param {import('@barocss/canvas2d').View} nextView @param {string|null} id
 * @param {Point|null} viewport @param {number} token @param {Session['source']} source */
function stage(bundle, nextView, id, viewport, token, source) {
  if (!current(token)) return null;
  setSelection(bundle, null, null);
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const renderer = createCanvas2D(fresh, options); counts.rendererCreated++; counts.liveRenderers++;
  counts.maxRenderers = Math.max(counts.maxRenderers, counts.liveRenderers);
  try {
    renderer.setView(nextView); let scene = bundle.tree.snapshot(); renderer.updateScene(scene); counts.sceneSubmits++;
    const context = viewport ? pointerAt(bundle, renderer, viewport) : null;
    const chosen = id ? context?.stack.includes(id) ? id : context?.stack[0] ?? null : null;
    setSelection(bundle, chosen, chosen ? context?.local ?? null : null);
    scene = bundle.tree.snapshot(); renderer.updateScene(scene); counts.sceneSubmits++;
    renderer.render(); counts.renders++;
    /** @type {Session} */ const next = { bundle, canvas: fresh, renderer, scene, generation: token, source, unbind: () => {} };
    return { next, pointer: context, selected: chosen, view: { ...nextView } };
  } catch (error) { disposeRenderer(renderer); throw error; }
}
/** @param {NonNullable<ReturnType<typeof stage>>} candidate */
function adopt(candidate) {
  const next = candidate.next; next.unbind = bind(next); const old = session;
  canvas.replaceWith(next.canvas); canvas = next.canvas; session = next;
  view = candidate.view; pointer = candidate.pointer; selected = candidate.selected;
  counts.accepted++; failure = null;
  if (old) { old.unbind(); disposeRenderer(old.renderer); }
}
/** @param {string|null} id @param {Point|null} viewport */
function changeSelection(id, viewport) {
  if (!session || disposed) return false;
  const token = ++requestedGeneration; const before = fingerprint();
  let candidate = null;
  try {
    candidate = stage(readChart(session.scene), view, id, viewport, token, 'selection');
    if (!candidate) return false; adopt(candidate); counts.selections++; show(`Selected ${selected ?? 'none'}`); return true;
  } catch (error) {
    if (candidate && session !== candidate.next) { candidate.next.unbind(); disposeRenderer(candidate.next.renderer); }
    refused(error, before, token); return false;
  }
}
function nextSelection() {
  if (!session || disposed || !pointer) return;
  const context = pointerAt(session.bundle, session.renderer, pointer.viewport);
  if (!context.stack.length) return changeSelection(null, pointer.viewport);
  const index = selected ? context.stack.indexOf(selected) : -1;
  changeSelection(context.stack[(index + 1) % context.stack.length], pointer.viewport);
}
/** @param {number} index @param {number | undefined} y */
function editPoint(index = 3, y = undefined) {
  const s = session; if (!s || disposed) return;
  const token = ++requestedGeneration; const before = fingerprint(); let candidate = null;
  try {
    const data = validateData(s.bundle.data);
    if (!Number.isInteger(index) || index < 0 || index >= 8) throw Object.assign(new Error('Point index must be 0..7'), { code: 'HOST_DATA' });
    const previous = { ...data.A[index] }; data.A[index].y = y ?? (data.A[index].y === 5 ? 8 : 5);
    const validated = validateData(data), template = makeChart(validated), bundle = readChart(s.scene);
    // Edit reconstructed public handles in a candidate. The accepted data remains untouched.
    bundle.series.A.setPath({ commands: template.series.A.data.commands, stroke: bundle.series.A.data.stroke });
    validated.A.forEach((point, markIndex) => {
      const local = dataToLocal(point); bundle.marks.A[markIndex].setPosition(local.x - 3, local.y - 3);
    });
    bundle.data = validateData(validated);
    candidate = stage(bundle, view, selected, pointer?.viewport ?? null, token, 'edit');
    if (!candidate) return; adopt(candidate); counts.edits++;
    lastEdit = { index, from: previous, to: { ...validated.A[index] }, pathId: 'SeriesA', restored: s.source === 'document' };
    opened = null; show(`Edited SeriesA point ${index}`);
  } catch (error) {
    if (candidate && session !== candidate.next) { candidate.next.unbind(); disposeRenderer(candidate.next.renderer); }
    return refused(error, before, token);
  }
}
/** @param {import('@barocss/canvas2d').View} proposed */
function changeView(proposed) {
  const s = session; if (!s || disposed) return;
  const token = ++requestedGeneration; const before = fingerprint(); const priorView = { ...view }; const priorScene = s.scene;
  let changed = false;
  try {
    const nextView = validateChartView(proposed); s.renderer.setView(nextView); changed = true;
    const bundle = readChart(s.scene);
    const context = pointer ? pointerAt(bundle, s.renderer, pointer.viewport) : null;
    const chosen = selected ? context?.stack.includes(selected) ? selected : context?.stack[0] ?? null : null;
    setSelection(bundle, chosen, chosen ? context?.local ?? null : null);
    const scene = bundle.tree.snapshot(); s.renderer.updateScene(scene); counts.sceneSubmits++;
    s.renderer.render(); counts.renders++;
    /** @type {Session} */ const next = { ...s, bundle, scene, generation: token, source: 'view', unbind: () => {} };
    next.unbind = bind(next); s.unbind(); session = next; view = nextView; pointer = context; selected = chosen;
    counts.viewChanges++; failure = null; show('Accepted chart view');
  } catch (error) {
    if (changed) { s.renderer.setView(priorView); s.renderer.updateScene(priorScene); s.renderer.render(); }
    return refused(error, before, token);
  }
}
/** @param {number} dx @param {number} dy */
function pan(dx = 18, dy = 10) { return changeView({ ...view, panX: view.panX + dx, panY: view.panY + dy }); }
/** @param {number} factor */
function zoom(factor = 1.25) { return changeView({ ...view, zoom: view.zoom * factor }); }
function reset() {
  if (disposed) return; const token = ++requestedGeneration; const before = fingerprint(); let candidate = null;
  try {
    candidate = stage(makeChart(initialData()), defaultView, null, null, token, 'reset');
    if (!candidate) return; adopt(candidate); lastEdit = null; opened = null; show('Reset data, view and selection');
  } catch (error) {
    if (candidate && session !== candidate.next) { candidate.next.unbind(); disposeRenderer(candidate.next.renderer); }
    return refused(error, before, token);
  }
}
function invalidData() {
  if (!session || disposed) return; const token = ++requestedGeneration; const before = fingerprint();
  try { const data = validateData(session.bundle.data); data.A[3].y = NaN; validateData(data); }
  catch (error) { return refused(error, before, token); }
}
function invalidScene() {
  if (!session || disposed) return; const token = ++requestedGeneration; const before = fingerprint();
  try {
    const bundle = readChart(session.scene);
    /** @type {import('@barocss/canvas2d').PathCommand[]} */
    const commands = Array.from({ length: 257 }, (_, index) => ({ kind: index === 0 ? 'M' : 'L', x: index, y: 1 }));
    bundle.series.A.setPath({ commands, stroke: bundle.series.A.data.stroke });
  } catch (error) { return refused(error, before, token); }
}
function incompatibleTopology() {
  if (!session || disposed) return; const token = ++requestedGeneration; const before = fingerprint();
  try {
    const candidate = structuredClone(session.scene); const plot = candidate.nodes.find(node => node.id === 'Plot');
    if (plot?.kind !== 'frame') throw new Error('Plot missing'); plot.width = 219; readChart(candidate);
  } catch (error) { return refused(error, before, token); }
}
/** @param {string} text @param {number|null} reservedToken */
async function openText(text, reservedToken = null) {
  if (disposed) return; const token = reservedToken ?? ++requestedGeneration;
  if (!current(token)) { counts.ignored++; return; }
  const before = fingerprint(); counts.openCalls++; let candidate = null;
  try {
    const parsed = await parseCanvasDocument(text);
    if (!current(token)) { counts.ignored++; return; }
    if (parsed.assets.size) throw Object.assign(new Error('Chart document must not contain assets'), { code: 'HOST_CHART' });
    const bundle = readChart(parsed.scene); setSelection(bundle, null, null);
    if (!current(token)) { counts.ignored++; return; }
    candidate = stage(bundle, defaultView, null, null, token, 'document');
    if (!candidate) return; adopt(candidate);
    opened = { topologyCheckedBeforeRenderer: true, viewReset: true, selectionReset: true };
    show('Opened editable chart with default view and no selection');
  } catch (error) {
    if (candidate && session !== candidate.next) { candidate.next.unbind(); disposeRenderer(candidate.next.renderer); }
    return refused(error, before, token);
  }
}
async function save() {
  if (!session || disposed) return;
  if (!changeSelection(null, pointer?.viewport ?? null) || selected !== null || session.bundle.selection.data.visible) return;
  const s = session;
  const token = requestedGeneration;
  try {
    const text = await serializeCanvasDocument(s.scene, () => null);
    if (!current(token) || session !== s) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'chart-document.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    saved = { filename: link.download, byteLength: new TextEncoder().encode(text).length, selectionCleared: true };
    show('Saved accepted chart after clearing selection; view is not serialized'); return text;
  } catch (error) { if (current(token)) show(`Save refused: ${codeOf(error)}`); }
}
function dispose() {
  counts.disposeCalls++; if (disposed) return;
  const s = session; if (s) { terminal = sessionObservation(s); s.unbind(); disposeRenderer(s.renderer); }
  session = null; disposed = true; requestedGeneration++;
  for (const unbind of hostUnbind.splice(0)) unbind(); show('Disposed chart and listeners');
}
const actions = { pan: () => pan(), zoom: () => zoom(), edit: () => editPoint(), next: nextSelection, reset,
  'invalid-data': invalidData, 'invalid-scene': invalidScene, incompatible: incompatibleTopology,
  save: () => { void save(); }, dispose };
for (const [id, action] of Object.entries(actions)) {
  const button = document.querySelector(`#${id}`); button?.addEventListener('click', action);
  hostUnbind.push(() => button?.removeEventListener('click', action));
}
const onOpen = () => {
  const file = input.files?.[0]; if (!file || disposed) return;
  const token = ++requestedGeneration; const before = fingerprint();
  void file.text().then(text => {
    if (!current(token)) { counts.ignored++; return; }
    return openText(text, token);
  }).catch(error => refused(error, before, token)); input.value = '';
};
input.addEventListener('change', onOpen); hostUnbind.push(() => input.removeEventListener('change', onOpen));
Object.defineProperty(window, 'chart', { value: Object.freeze({ observe, samples, editPoint, pan, zoom,
  nextSelection, reset, invalidData, invalidScene, incompatibleTopology, openText, save, dispose,
  points() { return session ? pointsFor(session) : null; },
  documentText() { return session ? serializeCanvasDocument(session.scene, () => null) : Promise.resolve(null); },
  /** @param {Point} viewport */ probe(viewport) { return session ? sample(session, viewport) : null; },
  get canvas() { return canvas; } }), writable: false, configurable: false });
const initial = stage(makeChart(), defaultView, null, null, ++requestedGeneration, 'initial');
if (initial) { adopt(initial); show('Ready: clipped chart with two editable series'); }
