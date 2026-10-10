import * as UnicodeCanvasAPI from '@barocss/canvas2d';
import { serializeCanvasDocument, parseCanvasDocument } from '@barocss/canvas2d/document';

const sourceProfile = '028c9e509b35de56e61db3b92a034b5277fbb291';
const contextId = 'UnicodeLabelExample';
const atlasIds = ['UnicodeAtlasA', 'UnicodeAtlasB'];
const pose = { x: 24, y: 96, scaleX: 1, scaleY: 1, rotation: 0 };
const displayOptions = {
  logicalSize: { width: 320, height: 200 }, dpr: 2,
  backgroundColor: [0.063, 0.094, 0.125, 1],
};

function checksum(pixels) {
  let hash = 2166136261;
  for (const value of pixels) hash = Math.imul(hash ^ value, 16777619) >>> 0;
  return 'fnv1a32:' + hash.toString(16).padStart(8, '0');
}
function failure(message) { throw new UnicodeCanvasAPI.Canvas2DError('INVALID_SCENE', message); }
function inputOptions(source) {
  let input;
  try { input = JSON.parse(source); }
  catch { failure('Label input must be a complete JSON object'); }
  const keys = ['text', 'font', 'dpr', 'textPolicy'];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== keys.length || !keys.every(key => Object.hasOwn(input, key))) {
    failure('Label input requires exactly text, font, dpr and textPolicy');
  }
  if (input.textPolicy !== 'unicode-single-line') failure('This example requires unicode-single-line');
  return input;
}
function glyphLayout(data) {
  return {
    atlasId: data.atlasId, text: data.text, baseline: data.baseline,
    opacity: data.opacity, sampling: data.sampling, glyphs: structuredClone(data.glyphs),
  };
}

/** The caller prepares local fonts before creating this synchronous example. */
export function createUnicodeTextExample(canvas, sourceJSON) {
  const renderer = UnicodeCanvasAPI.createCanvas2D(canvas, displayOptions);
  let accepted = null, saved = null, disposed = false, contextUnavailable = false;
  let generation = 0, frameCount = 0;
  const emptyScene = UnicodeCanvasAPI.createDisplayTree(contextId).snapshot();

  function live() {
    if (disposed) throw new UnicodeCanvasAPI.Canvas2DError('DISPOSED', 'Label example is disposed');
    if (contextUnavailable) throw new UnicodeCanvasAPI.Canvas2DError('CONTEXT_LOST', 'Label context is unavailable');
  }
  function copiedAsset(id) {
    const asset = renderer.getImageAsset(id);
    if (!asset) throw new UnicodeCanvasAPI.Canvas2DError('INVALID_ASSET', 'Label atlas is missing');
    return asset;
  }
  function capture() {
    // Public capture renders and returns top-left straight RGBA8 copied from WebGL.
    const image = renderer.captureImageAsset();
    return { width: image.width, height: image.height, byteCount: image.pixels.byteLength, rgbaChecksum: checksum(image.pixels) };
  }
  function describe(scene, asset, metadata) {
    const tree = UnicodeCanvasAPI.createDisplayTreeFromScene(scene);
    const glyph = tree.get('UnicodeLabel');
    if (scene.version !== 29 || scene.contextId !== contextId || tree.stage.children.length !== 1 ||
        glyph?.kind !== 'glyphRun' || tree.stage.children[0] !== glyph || !atlasIds.includes(glyph.data.atlasId)) {
      failure('Saved label does not match this example scene');
    }
    const data = glyph.data, quad = data.glyphs[0];
    if (data.glyphs.length !== 1 || data.baseline !== 0 || data.opacity !== 1 || data.sampling !== 'nearest' ||
        Object.keys(pose).some(key => data.transform[key] !== pose[key]) ||
        !quad || quad.sourceRect.x !== 0 || quad.sourceRect.y !== 0 ||
        quad.sourceRect.width !== asset.width || quad.sourceRect.height !== asset.height ||
        quad.textStart !== 0 || quad.textEnd !== data.text.length ||
        asset.width > 1024 || asset.height > 256 || asset.pixels.byteLength > 1048576) {
      failure('Saved label layout or atlas exceeds this example contract');
    }
    return {
      acceptedText: data.text, utf16Length: data.text.length, sceneVersion: scene.version,
      layout: glyphLayout(data), glyphQuadCount: data.glyphs.length,
      atlas: { id: data.atlasId, width: asset.width, height: asset.height,
        byteCount: asset.pixels.byteLength, rgbaChecksum: checksum(asset.pixels) },
      ...metadata,
    };
  }
  function report() {
    return structuredClone({
      backend: 'Public Canvas2D renderer · browser Unicode raster', sourceProfile,
      ...accepted?.description,
      displayDPR: displayOptions.dpr, logicalSize: displayOptions.logicalSize,
      frameCount, available: !disposed && !contextUnavailable,
      frame: accepted?.frame ?? null, savedLabel: saved?.metadata ?? null,
    });
  }
  function removeUnused(id) {
    if (id && renderer.getImageAsset(id)) renderer.removeImageAsset(id);
  }
  function adopt(scene, assetId, asset, description) {
    live();
    const prior = accepted;
    const priorAsset = prior ? copiedAsset(prior.assetId) : null;
    const candidateDescription = describe(scene, asset, description);
    let changed = false;
    try {
      // A restored document can reference the active atlas ID. Detach its old
      // sourceRect before replacing bytes; no frame is drawn while detached.
      if (prior?.assetId === assetId) { renderer.updateScene(emptyScene); changed = true; }
      renderer.setImageAsset(assetId, asset); changed = true;
      renderer.updateScene(scene);
      const frame = capture();
      const installed = copiedAsset(assetId);
      const installedDescription = describe(scene, installed, description);
      if (installedDescription.atlas.rgbaChecksum !== candidateDescription.atlas.rgbaChecksum) {
        throw new UnicodeCanvasAPI.Canvas2DError('INVALID_ASSET', 'Installed atlas bytes differ from candidate');
      }
      if (prior && prior.assetId !== assetId) removeUnused(prior.assetId);
      accepted = { scene: structuredClone(scene), assetId, description: installedDescription, frame };
      frameCount++;
      return report();
    } catch (error) {
      if (changed) {
        try {
          renderer.updateScene(emptyScene);
          if (prior) {
            renderer.setImageAsset(prior.assetId, priorAsset);
            renderer.updateScene(prior.scene);
            capture();
          }
          if (!prior || prior.assetId !== assetId) removeUnused(assetId);
        } catch { contextUnavailable = true; }
      }
      accepted = prior;
      throw error;
    }
  }
  function update(source) {
    live(); generation++;
    const options = inputOptions(source);
    const atlasId = accepted?.assetId === atlasIds[0] ? atlasIds[1] : atlasIds[0];
    const raster = UnicodeCanvasAPI.rasterizeBrowserText({ ...options, atlasId });
    const tree = UnicodeCanvasAPI.createDisplayTree(contextId);
    const glyph = tree.createGlyphRun({ id: 'UnicodeLabel', layer: 1, transform: pose, ...raster.layout });
    tree.stage.addChild(glyph);
    return adopt(tree.snapshot(), atlasId, raster.asset, {
      origin: 'browser-raster', font: raster.font, textPolicy: options.textPolicy,
      rasterDPR: raster.dpr, advance: raster.advance, bounds: { ...raster.bounds },
    });
  }
  async function action(id) {
    live();
    const token = ++generation;
    if (id === 'save-label') {
      const scene = structuredClone(accepted.scene);
      const assetId = accepted.assetId;
      // Snapshot every referenced asset before the serializer's first await.
      const assets = new Map([[assetId, copiedAsset(assetId)]]);
      const description = structuredClone(accepted.description);
      const text = await serializeCanvasDocument(scene, key => assets.get(key) ?? null);
      if (disposed || token !== generation) return report();
      const document = JSON.parse(text);
      saved = { text, metadata: {
        text: description.acceptedText, documentFormat: document.format, documentVersion: document.version,
        sceneVersion: scene.version, documentBytes: new TextEncoder().encode(text).length,
        assetCount: document.assets.length, atlas: { ...description.atlas },
        assetSHA256: document.assets[0].sha256,
      } };
      return report();
    }
    if (id === 'restore-label') {
      if (!saved) failure('Save a label in memory before restoring it');
      const parsed = await parseCanvasDocument(saved.text);
      if (disposed || token !== generation) return report();
      if (parsed.assets.size !== 1 || parsed.scene.nodes.length !== 1 || parsed.scene.nodes[0].kind !== 'glyphRun') {
        failure('Saved label needs one GlyphRun and one referenced atlas');
      }
      const atlasId = parsed.scene.nodes[0].atlasId, asset = parsed.assets.get(atlasId);
      if (!asset) failure('Saved label atlas is missing');
      const quad = parsed.scene.nodes[0].glyphs[0];
      return adopt(parsed.scene, atlasId, asset, {
        origin: 'saved-document', font: null, textPolicy: null, rasterDPR: null, advance: null,
        bounds: quad ? { left: quad.x, top: quad.y, width: quad.width, height: quad.height } : null,
      });
    }
    failure('Unknown label action');
  }
  function lost() { contextUnavailable = true; }
  function restored() {
    if (disposed) return;
    try { const frame = capture(); if (accepted) accepted = { ...accepted, frame }; contextUnavailable = false; }
    catch { contextUnavailable = true; }
  }
  function dispose() {
    if (disposed) return;
    disposed = true; generation++;
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', restored);
    renderer.dispose(); accepted = null; saved = null;
  }
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  try { update(sourceJSON); }
  catch (error) { dispose(); throw error; }
  return { update, report, action, dispose };
}
