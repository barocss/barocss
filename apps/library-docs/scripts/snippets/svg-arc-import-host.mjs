import * as ArcCanvasAPI from '@barocss/canvas2d';
import { parseCanvasDocument, serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';
import { createArcDisplayTree, validateArcScene29, editFirstArcCubic } from './svg-arc-import-adapter.mjs';

const sourceProfile = '94a2a776254a73b496431ab6cbb49ea07900bef7';
const logicalSize = { width: 320, height: 200 };
const displayOptions = { logicalSize, dpr: 2, backgroundColor: [0, 0, 0, 0] };
const view = { panX: 0, panY: 0, zoom: 1 };
// Module-local application-call ledger survives controller replacement/Reset.
// It does not measure WebGL deletion or a renderer that failed inside staging.
const ledger = { created: 0, disposeCalls: 0, listenersAttached: 0, listenersRemoved: 0,
  urlsCreated: 0, urlsRevoked: 0, pending: 0, stageCalls: 0 };
let lastDisposedLedger = null;
const disposedRenderers = new WeakSet();

function disposeRenderer(renderer) {
  if (!renderer || disposedRenderers.has(renderer)) return;
  disposedRenderers.add(renderer); ledger.disposeCalls++; renderer.dispose();
}
function capture(renderer) {
  const image = renderer.captureImageAsset();
  let hash = 2166136261;
  for (const byte of image.pixels) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return { width: image.width, height: image.height, byteCount: image.pixels.byteLength,
    rgbaChecksum: 'fnv1a32:' + hash.toString(16).padStart(8, '0') };
}
function canvasElement() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Canvas2D editable imported cubic paths');
  Object.assign(canvas.style, { width: '100%', height: 'auto', display: 'block' });
  return canvas;
}
function figure(element, caption) {
  const result = document.createElement('figure'); result.style.margin = '0';
  const label = document.createElement('figcaption'); label.textContent = caption;
  Object.assign(label.style, { fontSize: '12px', lineHeight: '1.5', marginTop: '4px' });
  result.append(element, label); return result;
}
function firstC(scene) {
  const visit = nodes => {
    for (const node of nodes) {
      if (node.id === 'ArcPath' && node.kind === 'path') return node.commands.find(command => command.kind === 'C');
      if (node.children) { const found = visit(node.children); if (found) return found; }
    }
    return null;
  };
  return visit(scene.nodes);
}
function admittedInput(text) {
  if (typeof text !== 'string') throw new ArcCanvasAPI.Canvas2DError('INVALID_SCENE', 'Arc input must be text');
  if (text.trimStart().startsWith('<')) {
    if (new TextEncoder().encode(text).byteLength > 1024 * 1024) {
      throw new ArcCanvasAPI.Canvas2DError('SCENE_LIMIT', 'This application limits SVG text to 1 MiB before DOM parsing');
    }
    const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (xml.getElementsByTagName('parsererror').length || xml.doctype) {
      throw new ArcCanvasAPI.Canvas2DError('INVALID_SCENE', 'SVG must be well-formed without a doctype');
    }
    // Admission and the complete public constructor bridge happen before GL,
    // URL or native-image allocations.
    const imported = ArcCanvasAPI.importSVGArcElement(xml.documentElement);
    if (imported.diagnostics.viewport.width !== 320 || imported.diagnostics.viewport.height !== 200) {
      throw new ArcCanvasAPI.Canvas2DError('INVALID_SIZE', 'This example requires a 320×200 SVG viewport');
    }
    const scene = validateArcScene29(ArcCanvasAPI, createArcDisplayTree(ArcCanvasAPI, imported.scene).snapshot());
    return { scene, editorSource: text, inputMode: 'SVG', originalSVG: text,
      importedScene5: structuredClone(imported.scene), diagnostics: structuredClone(imported.diagnostics), edited: false };
  }
  const scene = validateArcScene29(ArcCanvasAPI, ArcCanvasAPI.parseSceneJSON(text));
  return { scene, editorSource: ArcCanvasAPI.stringifySceneJSON(scene), inputMode: 'JSON',
    originalSVG: null, importedScene5: null, diagnostics: null, edited: false };
}

function controllerFor(panel) {
  let accepted = null, disposed = false, generation = 0, frameCount = 0;
  const pending = new Set();
  const originalStyle = { display: panel.style.display, gridTemplateColumns: panel.style.gridTemplateColumns, gap: panel.style.gap };
  Object.assign(panel.style, { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' });
  function active() {
    if (disposed) throw new ArcCanvasAPI.Canvas2DError('DISPOSED', 'Arc example is disposed');
  }
  function current(token) { return !disposed && token === generation; }
  function removePending(candidate) {
    if (pending.delete(candidate)) ledger.pending--;
  }
  function candidateFor(data) {
    const candidate = { ...data, canvas: canvasElement(), renderer: null, image: null, url: null, released: false };
    pending.add(candidate); ledger.pending++;
    return candidate;
  }
  function release(candidate) {
    if (!candidate || candidate.released) return;
    candidate.released = true;
    if (candidate.onLoss) {
      candidate.canvas.removeEventListener('webglcontextlost', candidate.onLoss);
      candidate.canvas.removeEventListener('webglcontextrestored', candidate.onRestore);
      ledger.listenersRemoved += 2;
    }
    disposeRenderer(candidate.renderer);
    candidate.image?.removeAttribute('src');
    if (candidate.url) { URL.revokeObjectURL(candidate.url); ledger.urlsRevoked++; }
    candidate.nativeFigure?.remove(); candidate.referenceFigure?.remove(); candidate.canvas.remove();
    removePending(candidate);
  }
  function report() {
    return structuredClone({ backend: 'Public Canvas2D renderer; original SVG image when available', sourceProfile,
      editorSource: accepted?.editorSource ?? null, inputMode: accepted?.inputMode ?? null,
      originalSVG: accepted?.originalSVG ?? null, importedScene5: accepted?.importedScene5 ?? null,
      diagnostics: accepted?.diagnostics ?? null, scene: accepted?.scene ?? null,
      actualC: accepted ? firstC(accepted.scene) : null,
      originalSVGReference: accepted?.originalSVG ? (accepted.edited ? 'Original input SVG; cubic path has since been edited' : 'Original input SVG') : null,
      originalSVGImageSize: accepted?.imageSize ?? null,
      logicalSize, dpr: displayOptions.dpr, view, nativeFrame: accepted?.frame ?? null,
      frameCount, available: !disposed && Boolean(accepted?.available), disposed,
      ledger: { ...ledger, lastDisposedLedger,
        scope: 'Application calls and returned renderers across module controllers; not raw GPU deletion' } });
  }
  function bindContext(candidate) {
    candidate.onLoss = () => { candidate.available = false; };
    candidate.onRestore = () => {
      if (!disposed && accepted === candidate) {
        try { candidate.frame = capture(candidate.renderer); candidate.available = true; }
        catch { candidate.available = false; }
      }
    };
    candidate.canvas.addEventListener('webglcontextlost', candidate.onLoss);
    candidate.canvas.addEventListener('webglcontextrestored', candidate.onRestore);
    ledger.listenersAttached += 2;
  }
  async function finish(candidate, token) {
    try {
      if (!current(token)) { release(candidate); return report(); }
      if (!candidate.renderer) {
        candidate.renderer = ArcCanvasAPI.createCanvas2D(candidate.canvas, displayOptions); ledger.created++;
      }
      bindContext(candidate);
      candidate.renderer.setView(view); candidate.renderer.updateScene(candidate.scene); candidate.renderer.render();
      if (candidate.originalSVG) {
        candidate.url = URL.createObjectURL(new Blob([candidate.originalSVG], { type: 'image/svg+xml' })); ledger.urlsCreated++;
        candidate.image = document.createElement('img');
        candidate.image.alt = 'Original input SVG reference; not an export of the edited cubic path';
        candidate.image.decoding = 'async';
        Object.assign(candidate.image.style, { width: '100%', height: 'auto', display: 'block' });
        if (typeof candidate.image.decode !== 'function') throw new ArcCanvasAPI.Canvas2DError('UNSUPPORTED_FEATURE', 'Native SVG decoding is unavailable');
        candidate.image.src = candidate.url;
        await candidate.image.decode();
        if (!current(token)) { release(candidate); return report(); }
        if (candidate.image.naturalWidth !== 320 || candidate.image.naturalHeight !== 200) {
          throw new ArcCanvasAPI.Canvas2DError('INVALID_ASSET', 'Original SVG image must decode to 320×200');
        }
        candidate.imageSize = { width: candidate.image.naturalWidth, height: candidate.image.naturalHeight };
      }
      candidate.frame = capture(candidate.renderer); candidate.available = true;
      candidate.nativeFigure = figure(candidate.canvas, 'Canvas2D · editable Scene29 cubic path');
      const reference = candidate.image ?? document.createElement('p');
      if (!candidate.image) reference.textContent = 'No original SVG is stored in editable JSON.';
      candidate.referenceFigure = figure(reference, candidate.originalSVG
        ? (candidate.edited ? 'Original input SVG · unchanged after cubic edit' : 'Original input SVG · native image')
        : 'JSON Open/edit · original SVG unavailable');
      const prior = accepted;
      if (prior) {
        prior.nativeFigure.replaceWith(candidate.nativeFigure);
        prior.referenceFigure.replaceWith(candidate.referenceFigure);
      } else panel.append(candidate.nativeFigure, candidate.referenceFigure);
      accepted = candidate; frameCount++; removePending(candidate); release(prior);
      return report();
    } catch (error) {
      release(candidate);
      if (!current(token)) return report();
      throw error;
    }
  }
  async function update(text) {
    active();
    const data = admittedInput(text); // A parse refusal leaves the accepted report and allocation ledger untouched.
    const token = ++generation;
    return finish(candidateFor(data), token);
  }
  async function open(documentText) {
    active(); const token = ++generation;
    const parsed = await parseCanvasDocument(documentText);
    if (!current(token)) return report();
    if (parsed.assets.size) throw new ArcCanvasAPI.Canvas2DError('UNSUPPORTED_FEATURE', 'Arc example documents must have no image assets');
    const scene = validateArcScene29(ArcCanvasAPI, parsed.scene);
    const candidate = candidateFor({ scene, editorSource: ArcCanvasAPI.stringifySceneJSON(scene), inputMode: 'JSON',
      originalSVG: null, importedScene5: null, diagnostics: null, edited: false });
    try {
      ledger.stageCalls++;
      const staged = await stageCanvasDocument(documentText, candidate.canvas, displayOptions);
      ledger.created++;
      if (candidate.released || !current(token)) {
        disposeRenderer(staged.renderer); release(candidate); return report();
      }
      candidate.renderer = staged.renderer;
      return finish(candidate, token);
    } catch (error) {
      release(candidate);
      if (!current(token)) return report();
      throw error;
    }
  }
  async function action(id) {
    active();
    if (!accepted) throw new ArcCanvasAPI.Canvas2DError('INVALID_SCENE', 'An accepted arc scene is required');
    if (id === 'edit-cubic') {
      const edited = editFirstArcCubic(ArcCanvasAPI, accepted.scene);
      const token = ++generation;
      const next = { scene: edited.scene, editorSource: ArcCanvasAPI.stringifySceneJSON(edited.scene), inputMode: 'JSON',
        originalSVG: accepted.originalSVG, importedScene5: structuredClone(accepted.importedScene5),
        diagnostics: structuredClone(accepted.diagnostics), edited: true };
      await finish(candidateFor(next), token);
      return { report: report(), acceptedSource: accepted.editorSource };
    }
    if (id === 'save-document') {
      const token = generation, scene = structuredClone(accepted.scene);
      const documentText = await serializeCanvasDocument(scene, () => null);
      if (!current(token)) return { report: report() };
      return { report: report(), documentText, filename: 'svg-arc-import.scene.json' };
    }
    throw new ArcCanvasAPI.Canvas2DError('INVALID_SCENE', 'Unknown arc example action');
  }
  function dispose() {
    if (disposed) return;
    disposed = true; generation++;
    for (const candidate of [...pending]) release(candidate);
    release(accepted);
    lastDisposedLedger = { ...ledger, observedAt: 'Controller dispose returned; later asynchronous staging may still settle' };
    Object.assign(panel.style, originalStyle);
  }
  return { public: { update, action, report, dispose }, open };
}

export async function createArcImportExample(panel, text) {
  const controller = controllerFor(panel);
  try { await controller.public.update(text); return controller.public; }
  catch (error) { controller.public.dispose(); throw error; }
}
export async function openArcImportExample(panel, documentText) {
  const controller = controllerFor(panel);
  try { await controller.open(documentText); return controller.public; }
  catch (error) { controller.public.dispose(); throw error; }
}
