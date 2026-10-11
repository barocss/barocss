import * as SvgCanvasAPI from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const sourceProfile = 'c8a914debde531fcb78c225e4f1e637bf5d78894';
const logicalSize = { width: 320, height: 200 };
const displayOptions = { logicalSize, dpr: 2, backgroundColor: [0, 0, 0, 0] };
const view = { panX: 0, panY: 0, zoom: 1 };

function checksum(pixels) {
  let hash = 2166136261;
  for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return 'fnv1a32:' + hash.toString(16).padStart(8, '0');
}
function capture(renderer) {
  const image = renderer.captureImageAsset();
  return { width: image.width, height: image.height, byteCount: image.pixels.byteLength, rgbaChecksum: checksum(image.pixels) };
}
function refused(result) {
  const error = new Error('SVG export refused');
  error.name = 'SvgExportRefusal';
  error.code = 'UNSUPPORTED_FEATURE';
  error.diagnostics = structuredClone(result.diagnostics);
  throw error;
}
function canvasElement() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Actual example output');
  Object.assign(canvas.style, { width: '100%', height: 'auto', display: 'block' });
  return canvas;
}
function figure(element, caption) {
  const result = document.createElement('figure'); result.style.margin = '0';
  const label = document.createElement('figcaption'); label.textContent = caption;
  Object.assign(label.style, { fontSize: '12px', lineHeight: '1.5', marginTop: '4px' });
  result.append(element, label); return result;
}

function controllerFor(panel) {
  let accepted = null, disposed = false, generation = 0, frameCount = 0;
  const pending = new Set();
  const originalStyle = { display: panel.style.display, gridTemplateColumns: panel.style.gridTemplateColumns, gap: panel.style.gap };
  Object.assign(panel.style, { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' });
  function active() {
    if (disposed) throw new SvgCanvasAPI.Canvas2DError('DISPOSED', 'SVG example is disposed');
  }
  function current(token) { return !disposed && token === generation; }
  function release(candidate) {
    if (!candidate || candidate.released) return;
    candidate.released = true;
    if (candidate.onLoss) candidate.canvas.removeEventListener('webglcontextlost', candidate.onLoss);
    if (candidate.onRestore) candidate.canvas.removeEventListener('webglcontextrestored', candidate.onRestore);
    candidate.renderer?.dispose();
    candidate.image?.removeAttribute('src');
    if (candidate.url) URL.revokeObjectURL(candidate.url);
    candidate.nativeFigure?.remove(); candidate.svgFigure?.remove();
    pending.delete(candidate);
  }
  function report() {
    return structuredClone({
      backend: 'Public Canvas2D renderer and native gradient SVG image', sourceProfile,
      scene: accepted?.scene ?? null, logicalSize, dpr: displayOptions.dpr, view,
      svgByteLength: accepted?.svgByteLength ?? null, sourceIdMap: accepted?.sourceIdMap ?? [],
      svgImageSize: accepted ? { width: accepted.image.naturalWidth, height: accepted.image.naturalHeight } : null,
      nativeFrame: accepted?.frame ?? null, frameCount,
      available: !disposed && Boolean(accepted?.available),
    });
  }
  function bindContext(candidate) {
    candidate.onLoss = () => { if (!disposed && accepted === candidate) candidate.available = false; };
    candidate.onRestore = () => {
      if (!disposed && accepted === candidate) {
        try { candidate.frame = capture(candidate.renderer); candidate.available = true; }
        catch { candidate.available = false; }
      }
    };
    candidate.canvas.addEventListener('webglcontextlost', candidate.onLoss);
    candidate.canvas.addEventListener('webglcontextrestored', candidate.onRestore);
  }
  async function stageAndAdopt(scene, token, staged = null) {
    const candidate = { canvas: staged?.canvas ?? canvasElement(), renderer: staged?.renderer ?? null,
      image: null, url: null, released: false };
    pending.add(candidate);
    try {
      // Export the submitted scene first; older scene versions must not be
      // silently upgraded by the editable tree's Scene29 snapshot method.
      const result = SvgCanvasAPI.exportSceneGradientSVG(scene, logicalSize);
      if (!result.ok) refused(result);
      const tree = SvgCanvasAPI.createDisplayTreeFromScene(scene), source = tree.snapshot();
      if (!current(token)) { release(candidate); return report(); }
      if (!candidate.renderer) candidate.renderer = SvgCanvasAPI.createCanvas2D(candidate.canvas, displayOptions);
      candidate.renderer.setView(view); candidate.renderer.updateScene(source); candidate.renderer.render();
      candidate.scene = source; candidate.svg = result.svg;
      candidate.sourceIdMap = result.sourceIdMap;
      candidate.svgByteLength = new TextEncoder().encode(result.svg).length;
      candidate.url = URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml' }));
      candidate.image = document.createElement('img');
      candidate.image.alt = 'Actual exported SVG image'; candidate.image.decoding = 'async';
      Object.assign(candidate.image.style, { width: '100%', height: 'auto', display: 'block' });
      if (typeof candidate.image.decode !== 'function') {
        throw new SvgCanvasAPI.Canvas2DError('UNSUPPORTED_FEATURE', 'Native SVG image decoding is unavailable');
      }
      candidate.image.src = candidate.url;
      await candidate.image.decode();
      if (!current(token)) { release(candidate); return report(); }
      if (candidate.image.naturalWidth !== logicalSize.width || candidate.image.naturalHeight !== logicalSize.height) {
        throw new SvgCanvasAPI.Canvas2DError('INVALID_ASSET', 'Decoded SVG extent differs from logicalSize');
      }
      // Capture after decode also verifies that the candidate's live renderer
      // survived the asynchronous preparation before replacing the old display.
      candidate.frame = capture(candidate.renderer); candidate.available = true;
      candidate.nativeFigure = figure(candidate.canvas, 'Canvas2D · authored Scene29');
      candidate.svgFigure = figure(candidate.image, 'SVG · public gradient export');
      const prior = accepted;
      if (prior) {
        prior.nativeFigure.replaceWith(candidate.nativeFigure);
        prior.svgFigure.replaceWith(candidate.svgFigure);
      } else panel.append(candidate.nativeFigure, candidate.svgFigure);
      accepted = candidate; frameCount++; pending.delete(candidate);
      bindContext(candidate); release(prior);
      return report();
    } catch (error) {
      release(candidate);
      if (!current(token)) return report();
      throw error;
    }
  }
  async function update(source) {
    active(); const token = ++generation;
    const scene = SvgCanvasAPI.parseSceneJSON(source);
    return stageAndAdopt(scene, token);
  }
  async function open(documentText) {
    active(); const token = ++generation, canvas = canvasElement();
    const staged = await stageCanvasDocument(documentText, canvas, displayOptions);
    if (!current(token)) { staged.renderer.dispose(); canvas.remove(); return report(); }
    return stageAndAdopt(staged.scene, token, { canvas, renderer: staged.renderer });
  }
  async function action(id) {
    active();
    if (!accepted) throw new SvgCanvasAPI.Canvas2DError('INVALID_SCENE', 'An accepted scene is required');
    if (id === 'save-svg') return { report: report(), svg: accepted.svg, filename: 'radial-path.svg' };
    if (id === 'save-document') {
      const token = generation, scene = structuredClone(accepted.scene);
      const documentText = await serializeCanvasDocument(scene, () => null);
      if (!current(token)) return { report: report() };
      return { report: report(), documentText, filename: 'radial-path.canvas.json' };
    }
    throw new SvgCanvasAPI.Canvas2DError('INVALID_SCENE', 'Unknown SVG example action');
  }
  function dispose() {
    if (disposed) return;
    disposed = true; generation++;
    for (const candidate of [...pending]) release(candidate);
    release(accepted); accepted = null;
    Object.assign(panel.style, originalStyle);
  }
  return { public: { update, report, action, dispose }, open };
}

/** The caller owns the detached panel and promotes it only after this resolves. */
export async function createSvgExportExample(panel, source) {
  const controller = controllerFor(panel);
  try { await controller.public.update(source); return controller.public; }
  catch (error) { controller.public.dispose(); throw error; }
}

/** Reopen editable native JSON; this does not import a gradient SVG. */
export async function openSvgExportExample(panel, documentText) {
  const controller = controllerFor(panel);
  try { await controller.open(documentText); return controller.public; }
  catch (error) { controller.public.dispose(); throw error; }
}
