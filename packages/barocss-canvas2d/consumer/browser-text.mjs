// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, rasterizeBrowserText, rasterizeBrowserMultilineText, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, parseCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';
/** @typedef {import('@barocss/canvas2d').Point} Point */
/** @typedef {ReturnType<typeof rasterizeBrowserText>} Prepared */
/** @typedef {{canvas:HTMLCanvasElement,renderer:import('@barocss/canvas2d').Canvas2DRenderer,
 * tree:import('@barocss/canvas2d').DisplayTree,glyph:import('@barocss/canvas2d').GlyphRunHandle,
 * scene:import('@barocss/canvas2d').Scene,asset:import('@barocss/canvas2d').ImageAssetInput,
 * lineAdvance:number|null,lines:import('@barocss/canvas2d').BrowserMultilineTextLine[]|null, font:string|null,rasterDPR:number|null,advance:number|null,generation:number,source:'helper'|'document',unbind:()=>void}} Session */
const options = { logicalSize: { width: 320, height: 144 }, dpr: 2 };
const atlasId = 'BrowserTextAtlas', font = '24px monospace';
const pose = (/** @type {number} */ x = 0, /** @type {number} */ y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const input = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
/** @type {Session|null} */ let session = null;
/** @type {ReturnType<typeof sessionObservation>|null} */ let terminal = null;
let generation = 0, disposed = false, preparing = false;
/** @type {{code:string,retained:boolean,candidatesUnchanged:boolean}|null} */ let failure = null;
/** @type {{filename:string,byteLength:number}|null} */ let saved = null;
/** @type {{bytesEqualPrevious:boolean|null,layoutEqualPrevious:boolean|null,idsEqualPrevious:boolean|null,samplesEqualPrevious:boolean|null,helperCallsUnchanged:boolean}|null} */ let opened = null;
/** @type {{filename:string,byteLength:number,width:number,height:number}|null} */ let png = null;
/** @type {string[]} */ const pointerLog = [];
/** @type {(()=>void)[]} */ const hostUnbind = [];
const counts = { helperCalls: 0, fontPreparations: 0, candidates: 0, accepted: 0, ignored: 0, errors: 0,
  rendererCreated: 0, rendererDisposed: 0, liveRenderers: 0, binds: 0, unbinds: 0, pointerEvents: 0, pngCanvases: 0 };
/** @param {unknown} error */
function codeOf(error) { return error instanceof Error && 'code' in error ? String(error.code) : error instanceof Error ? error.name : String(error); }
/** @param {Session} s */
function layoutOf(s) { const d = s.glyph.data; return { atlasId: d.atlasId, text: d.text, baseline: d.baseline,
  opacity: d.opacity, sampling: d.sampling, glyphs: d.glyphs }; }
/** @param {Session} s */
function pointsFor(s) {
  const { width, height, pixels } = s.asset, quad = s.glyph.data.glyphs[0];
  const columns = new Uint32Array(width); let inkX = 0, inkY = 0, maxAlpha = 0, first = width, last = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const alpha = pixels[(y * width + x) * 4 + 3]; columns[x] += alpha;
    if (alpha > maxAlpha) { maxAlpha = alpha; inkX = x; inkY = y; }
    if (alpha) { first = Math.min(first, x); last = Math.max(last, x); }
  }
  let gapStart = -1, gapLength = 0, start = -1;
  for (let x = first + 1; x <= last; x++) {
    if (!columns[x] && start < 0) start = x;
    if (columns[x] && start >= 0) { if (x - start > gapLength) { gapStart = start; gapLength = x - start; } start = -1; }
  }
  const point = (/** @type {number} */ x, /** @type {number} */ y) => s.renderer.worldToViewport(s.glyph.toWorld({
    x: quad.x + (x + 0.5) * quad.width / width,
    y: s.glyph.data.baseline + quad.y + (y + 0.5) * quad.height / height }));
  const rows = new Uint32Array(height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rows[y] += pixels[(y * width + x) * 4 + 3];
  const firstRow = rows.findIndex(a => a > 0); let lastRow = height - 1;
  while (lastRow >= 0 && !rows[lastRow]) lastRow--;
  let rowStart = -1, rowGap = -1, rowLength = 0;
  for (let y = firstRow + 1; y <= lastRow; y++) {
    if (!rows[y] && rowStart < 0) rowStart = y;
    if (rows[y] && rowStart >= 0) { if (y - rowStart > rowLength) { rowGap = rowStart; rowLength = y - rowStart; } rowStart = -1; }
  }
  const linePixel = (/** @type {number} */ from, /** @type {number} */ to) => {
    let ax = 0, ay = from, aa = 0;
    for (let y = from; y < to; y++) for (let x = 0; x < width; x++) if (pixels[(y * width + x) * 4 + 3] > aa) {
      ax = x; ay = y; aa = pixels[(y * width + x) * 4 + 3];
    }
    return point(ax, ay);
  };
  const multiline = s.glyph.data.text.includes('\n') && rowGap >= 0;
  const line1 = multiline ? linePixel(firstRow, rowGap) : null;
  const line2 = multiline ? linePixel(rowGap + rowLength, lastRow + 1) : null;
  const interline = multiline ? point(Math.floor(width / 2), rowGap + Math.floor(rowLength / 2)) : null;
  const ink = point(inkX, inkY), gapX = gapStart + Math.floor(gapLength / 2), gapY = Math.floor(height / 2);
  return { ink, line1, line2, interline, space: gapStart >= 0 ? point(gapX, gapY) : null, background: { x: 300, y: 120 },
    inkAtlas: { x: inkX, y: inkY, alpha: maxAlpha },
    spaceAtlas: gapStart >= 0 ? { x: gapX, y: gapY, alpha: pixels[(gapY * width + gapX) * 4 + 3], emptyColumn: true } : null };
}
/** @param {Session} s @param {Point} point */
function sample(s, point) {
  const gl = s.canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable'); const bytes = new Uint8Array(4);
  gl.readPixels(Math.floor(point.x * options.dpr), s.canvas.height - Math.floor(point.y * options.dpr) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return { point, rgba: [...bytes], hit: s.renderer.hitTest(point)?.id ?? null };
}
/** @param {Session} s */
function sessionObservation(s) {
  const points = pointsFor(s), actual = s.renderer.getImageAsset(atlasId);
  return { generation: s.generation, source: s.source, text: s.glyph.data.text, version: s.scene.version,
    lineAdvance: s.lineAdvance, lines: s.lines, font: s.font, rasterDPR: s.rasterDPR, advance: s.advance, layout: layoutOf(s), transform: s.glyph.data.transform,
    bounds: { left: s.glyph.data.glyphs[0].x, top: s.glyph.data.glyphs[0].y,
      width: s.glyph.data.glyphs[0].width, height: s.glyph.data.glyphs[0].height },
    atlas: { width: s.asset.width, height: s.asset.height, byteLength: s.asset.pixels.length }, allBytes: [...s.asset.pixels],
    bytesMatchRenderer: !!actual && actual.width === s.asset.width && actual.height === s.asset.height &&
      actual.pixels.length === s.asset.pixels.length && actual.pixels.every((b, i) => b === s.asset.pixels[i]),
    points, samples: { line1: points.line1 && sample(s, points.line1), line2: points.line2 && sample(s, points.line2), interline: points.interline && sample(s, points.interline), ink: sample(s, points.ink), space: points.space && sample(s, points.space), background: sample(s, points.background) },
    contextId: s.scene.contextId, ids: s.tree.stage.children.map(c => c.id), sceneMatchesTree: stringifySceneJSON(s.scene) === stringifySceneJSON(s.tree.snapshot()),
    backing: { width: s.canvas.width, height: s.canvas.height } };
}
function observe() { return { disposed, preparing, generation, counts: { ...counts }, failure, saved, opened, png,
  pointerLog: [...pointerLog], accepted: session ? sessionObservation(session) : terminal }; }
function show(/** @type {string} */ message) { status.textContent = message; output.textContent = JSON.stringify(observe(), (key, value) => key === 'allBytes' ? undefined : value, 2);
  for (const button of Array.from(document.querySelectorAll('button'))) button.disabled = disposed; input.disabled = disposed; }
function fingerprint() { return session ? JSON.stringify({ scene: stringifySceneJSON(session.scene), view: sessionObservation(session) }) : 'empty'; }
function current(/** @type {number} */ token) { return !disposed && generation === token; }
function release(/** @type {import('@barocss/canvas2d').Canvas2DRenderer} */ renderer) { renderer.dispose(); counts.rendererDisposed++; counts.liveRenderers--; }
function bind(/** @type {Session} */ s) {
  counts.binds++; const subscriptions = [s.glyph.onPointer('pointerdown', event => pointerLog.push(`g${s.generation}:Label:${event.target?.id}`)),
    s.tree.stage.onPointer('pointerdown', event => pointerLog.push(`g${s.generation}:stage:${event.target?.id ?? 'none'}`))];
  const onPointer = (/** @type {PointerEvent} */ event) => {
    if (disposed || session !== s) return; counts.pointerEvents++; const rect = s.canvas.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) * 320 / rect.width, y: (event.clientY - rect.top) * 144 / rect.height };
    s.tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point: s.renderer.viewportToWorld(point), hit: s.renderer.hitTest(point) });
    show('Pointer delivered');
  };
  s.canvas.addEventListener('pointerdown', onPointer); let done = false;
  return () => { if (done) return; done = true; counts.unbinds++; s.canvas.removeEventListener('pointerdown', onPointer); for (const stop of subscriptions) stop(); };
}
/** @param {import('@barocss/canvas2d').DisplayTree} tree @param {import('@barocss/canvas2d').ImageAssetInput} asset
 * @param {number} token @param {'helper'|'document'} source @param {Prepared|null} prepared @returns {Session} */
function fresh(tree, asset, token, source, prepared) {
  const glyph = tree.get('Label'); if (glyph?.kind !== 'glyphRun') throw new Error('Label missing');
  const nextCanvas = document.createElement('canvas'); nextCanvas.id = 'scene'; counts.candidates++;
  const renderer = createCanvas2D(nextCanvas, options); counts.rendererCreated++; counts.liveRenderers++;
  try { renderer.setImageAsset(atlasId, asset); const scene = tree.snapshot(); renderer.updateScene(scene); renderer.render();
    return { canvas: nextCanvas, renderer, tree, glyph, scene, asset, lineAdvance: prepared && 'lineAdvance' in prepared ? /** @type {import('@barocss/canvas2d').BrowserMultilineTextRaster} */ (prepared).lineAdvance : null,
      lines: prepared && 'lines' in prepared ? /** @type {import('@barocss/canvas2d').BrowserMultilineTextRaster} */ (prepared).lines : null, font: prepared?.font ?? null,
      rasterDPR: prepared?.dpr ?? null, advance: prepared?.advance ?? null, generation: token, source, unbind: () => {} };
  } catch (error) { release(renderer); throw error; }
}
function adopt(/** @type {Session} */ next) { next.unbind = bind(next); const old = session;
  canvas.replaceWith(next.canvas); canvas = next.canvas; session = next; preparing = false; failure = null; counts.accepted++;
  if (old) { old.unbind(); release(old.renderer); } }
/** @param {unknown} error @param {string} before @param {number} candidates */
function refuse(error, before, candidates) { counts.errors++; preparing = false;
  failure = { code: codeOf(error), retained: fingerprint() === before, candidatesUnchanged: candidates === counts.candidates }; show(`Refused ${failure.code}`); return failure; }
/** Host owns font readiness. The public helper stays synchronous. @param {string} text @param {number} dpr @param {import('@barocss/canvas2d').BrowserTextPolicy} textPolicy @param {number|null} lineAdvance */
async function edit(text, dpr = 2, textPolicy = 'alphanumeric', lineAdvance = null) {
  if (disposed) return; const token = ++generation, before = fingerprint(), candidates = counts.candidates;
  preparing = true; show('Preparing font');
  try { counts.fontPreparations++; await document.fonts.ready; await document.fonts.load(font, text);
    if (!current(token)) { counts.ignored++; return; }
    if (!document.fonts.check(font, text)) throw new Error('Host font unavailable');
    counts.helperCalls++; const prepared = lineAdvance === null ? rasterizeBrowserText({ text, font, atlasId, dpr, textPolicy }) : rasterizeBrowserMultilineText({ text, font, atlasId, dpr, lineAdvance });
    const tree = createDisplayTree('BrowserTextConsumer');
    tree.stage.addChild(tree.createRect({ id: 'Back', layer: 0, transform: pose(), width: 320, height: 144, fill: [0.125, 0.15625, 0.21875, 1] }));
    tree.stage.addChild(tree.createGlyphRun({ id: 'Label', layer: 1, transform: pose(24, lineAdvance === null ? 72 : 40), ...prepared.layout }));
    adopt(fresh(tree, prepared.asset, token, 'helper', prepared)); opened = null; show(`Accepted ${text} at raster DPR ${dpr}`);
  } catch (error) { if (current(token)) refuse(error, before, candidates); else counts.ignored++; }
}
/** @param {string} badFont @param {string} text */
function rejectFont(badFont, text = 'HI') {
  if (disposed) return; ++generation; const before = fingerprint(), candidates = counts.candidates;
  try { counts.helperCalls++; rasterizeBrowserText({ text, font: badFont, atlasId, dpr: 2 });
    failure = { code: 'ACCEPTED', retained: fingerprint() === before, candidatesUnchanged: candidates === counts.candidates }; show('Unexpected acceptance'); return failure;
  } catch (error) { return refuse(error, before, candidates); }
}
/** @param {string} text @param {number|null} reserved */
async function openText(text, reserved = null) {
  if (disposed) return; const token = reserved ?? ++generation, before = fingerprint(), previous = session,
    candidates = counts.candidates, helperCalls = counts.helperCalls; preparing = true;
  /** @type {Session|null} */ let next = null;
  try { const parsed = await parseCanvasDocument(text); if (!current(token)) { counts.ignored++; return; }
    const tree = createDisplayTreeFromScene(parsed.scene), glyph = tree.get('Label'), back = tree.get('Back'), asset = parsed.assets.get(atlasId);
    if (parsed.scene.contextId !== 'BrowserTextConsumer' || tree.stage.children.length !== 2 ||
        glyph?.kind !== 'glyphRun' || back?.kind !== 'rect' || !asset || parsed.assets.size !== 1 ||
        glyph.data.atlasId !== atlasId || glyph.data.glyphs.length !== 1) throw new Error('Document differs from browser text fixture');
    next = fresh(tree, asset, token, 'document', null);
    const prior = previous && sessionObservation(previous), now = sessionObservation(next);
    opened = { bytesEqualPrevious: prior ? JSON.stringify(prior.allBytes) === JSON.stringify(now.allBytes) : null,
      layoutEqualPrevious: prior ? JSON.stringify(prior.layout) === JSON.stringify(now.layout) : null,
      idsEqualPrevious: prior ? JSON.stringify(prior.ids) === JSON.stringify(now.ids) : null,
      samplesEqualPrevious: prior ? JSON.stringify(prior.samples) === JSON.stringify(now.samples) : null,
      helperCallsUnchanged: helperCalls === counts.helperCalls };
    adopt(next); show('Opened saved bytes on a fresh canvas and editable tree');
  } catch (error) { if (next && session !== next) release(next.renderer); if (current(token)) refuse(error, before, candidates); else counts.ignored++; }
}
async function restoredEdit() {
  const s = session; if (!s || disposed) return; const token = ++generation, before = fingerprint(), candidates = counts.candidates;
  const multiline = s.glyph.data.text.includes('\n'), text = multiline ? s.glyph.data.text.split('\n')[0] + '\n-$25' : '-$20';
  preparing = true; show('Preparing the current font for restored label');
  try { counts.fontPreparations++; await document.fonts.ready; await document.fonts.load(font, text);
    if (!current(token) || session !== s) { counts.ignored++; return; }
    if (!document.fonts.check(font, text)) throw new Error('Host font unavailable');
    counts.helperCalls++; const prepared = multiline ? rasterizeBrowserMultilineText({ text, font, atlasId, dpr: 2, lineAdvance: 40 }) : rasterizeBrowserText({ text, font, atlasId, dpr: 2, textPolicy: 'printable-ascii' });
    const tree = createDisplayTreeFromScene(s.scene), glyph = tree.get('Label');
    if (glyph?.kind !== 'glyphRun') throw new Error('Label missing');
    glyph.setLayout(prepared.layout);
    adopt(fresh(tree, prepared.asset, token, 'helper', prepared)); show('Edited the restored public glyph handle');
  } catch (error) { if (current(token)) refuse(error, before, candidates); else counts.ignored++; }
}
/** @param {import('@barocss/canvas2d').BrowserMultilineTextOptions} options */
function rejectMultiline(options) {
  if (disposed) return; ++generation; const before = fingerprint(), candidates = counts.candidates;
  try { counts.helperCalls++; rasterizeBrowserMultilineText(options);
    throw new Error('Unexpected multiline acceptance');
  } catch (error) { return refuse(error, before, candidates); }
}
/** @param {string} text @param {number} lineAdvance @param {number} dpr */
function editMultiline(text, lineAdvance = 40, dpr = 2) { return edit(text, dpr, 'printable-ascii', lineAdvance); }
function serialize(/** @type {Session} */ s) { return serializeCanvasDocument(s.scene, id => s.renderer.getImageAsset(id)); }
function download(/** @type {Blob} */ blob, /** @type {string} */ name) { const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function save() { const s = session; if (!s || disposed) return; const text = await serialize(s); if (disposed || session !== s) return;
  const filename = 'browser-text-document.json'; download(new Blob([text], { type: 'application/json' }), filename);
  saved = { filename, byteLength: new TextEncoder().encode(text).length }; show('Saved accepted document and exact RGBA bytes'); return text; }
async function exportPNG() { const s = session; if (!s || disposed) return; const token = generation;
  try { const text = await serialize(s); if (!current(token) || session !== s) return;
    const result = await exportCanvasDocumentPNG(text, options, () => { counts.pngCanvases++; return document.createElement('canvas'); });
    if (!current(token) || session !== s) return; const filename = 'browser-text.png'; download(result.blob, filename);
    png = { filename, byteLength: result.blob.size, width: result.backingSize.width, height: result.backingSize.height }; show('Exported PNG'); return png;
  } catch (error) { if (current(token)) show(`PNG failed: ${codeOf(error)}`); }
}
function dispose() { if (disposed) return; if (session) { terminal = sessionObservation(session); session.unbind(); release(session.renderer); }
  session = null; disposed = true; preparing = false; generation++; for (const remove of hostUnbind.splice(0)) remove(); show('Disposed renderer and listeners'); }
const actions = { multiline: () => { void editMultiline('Balance\n-$20'); }, numeric: () => { void edit('12.5', 2, 'printable-ascii'); }, currency: () => { void edit('-$20', 2, 'printable-ascii'); }, statusLabel: () => { void edit('FPS:60', 1.5, 'printable-ascii'); }, hi: () => { void edit('HI', 2); }, space: () => { void edit('H I', 1.5); },
  invalid: () => { rejectFont('not a font'); }, oversize: () => { rejectFont('1000px monospace', 'M'.repeat(128)); },
  restored: () => { void restoredEdit(); }, save: () => { void save().catch(error => show(`Save failed: ${codeOf(error)}`)); },
  png: () => { void exportPNG(); }, dispose };
for (const [id, action] of Object.entries(actions)) { const button = document.querySelector(`#${id}`); button?.addEventListener('click', action);
  hostUnbind.push(() => button?.removeEventListener('click', action)); }
const onOpen = () => { const file = input.files?.[0]; if (!file || disposed) return; const token = ++generation, before = fingerprint(), candidates = counts.candidates;
  void file.text().then(text => { if (!current(token)) { counts.ignored++; return; } return openText(text, token); })
    .catch(error => { if (current(token)) refuse(error, before, candidates); }); input.value = ''; };
input.addEventListener('change', onOpen); hostUnbind.push(() => input.removeEventListener('change', onOpen));
Object.defineProperty(window, 'browserTextConsumer', { value: Object.freeze({ observe, edit, editMultiline, rejectMultiline, rejectFont, openText, restoredEdit, save, exportPNG, dispose,
  get canvas() { return canvas; }, points() { return session ? pointsFor(session) : null; },
  /** @param {Point} point */ pixel(point) { return session ? sample(session, point) : null; },
  documentText() { return session ? serialize(session) : Promise.resolve(null); } }), writable: false, configurable: false });
void edit('Canvas2D', 1);
