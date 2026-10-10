import * as DiagramCanvasAPI from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const sourceProfile = '8fc5d6c46776f750d1c3a4222e255aea5d6aaaf7';
const contextId = 'DiagramLabelScene';
const pairs = [['LabelAtlasA', 'OutlineAtlasA'], ['LabelAtlasB', 'OutlineAtlasB']];
const identity = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const groupPose = { x: 40, y: 104, scaleX: 1, scaleY: 1, rotation: 0.08 };
const displayOptions = {
  logicalSize: { width: 320, height: 200 }, dpr: 2,
  backgroundColor: [0.063, 0.094, 0.125, 1],
};
const unknownPreparation = {
  origin: 'opened-document', font: null, maxWidth: null, displayText: null,
  truncated: null, visibleTextEnd: null, rasterDPR: null, outlineRadius: null,
  outlineColor: null, advance: null, bounds: null,
};

function fail(message) { throw new DiagramCanvasAPI.Canvas2DError('INVALID_SCENE', message); }
function checksum(pixels) {
  let value = 2166136261;
  for (const byte of pixels) value = Math.imul(value ^ byte, 16777619) >>> 0;
  return 'fnv1a32:' + value.toString(16).padStart(8, '0');
}
function samePose(actual, expected) {
  return Object.keys(expected).every(key => actual[key] === expected[key]);
}
function parseInput(source) {
  let input;
  try { input = JSON.parse(source); } catch { fail('Diagram input must be a complete JSON object'); }
  const fields = ['text', 'font', 'dpr', 'maxWidth', 'outlineRadius', 'outlineColor'];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== fields.length || !fields.every(key => Object.hasOwn(input, key))) {
    fail('Diagram input requires exactly text, font, dpr, maxWidth, outlineRadius and outlineColor');
  }
  return input;
}
function assetReport(id, asset) {
  return { id, width: asset.width, height: asset.height, byteCount: asset.pixels.byteLength, rgbaChecksum: checksum(asset.pixels) };
}
function inspect(scene, assets, preparation) {
  const tree = DiagramCanvasAPI.createDisplayTreeFromScene(scene);
  const group = tree.get('LabelGroup'), glyph = tree.get('OriginalGlyph'), sprite = tree.get('OutlineSprite');
  if (scene.version !== 29 || scene.contextId !== contextId || tree.stage.children.length !== 1 ||
      group?.kind !== 'container' || tree.stage.children[0] !== group || group.children.length !== 2 ||
      glyph?.kind !== 'glyphRun' || sprite?.kind !== 'sprite' ||
      group.children[0] !== sprite || group.children[1] !== glyph || assets.size !== 2) {
    fail('Document must contain one LabelGroup with OutlineSprite and OriginalGlyph');
  }
  const gd = glyph.data, sd = sprite.data, quad = gd.glyphs[0];
  const pair = pairs.find(ids => ids[0] === gd.atlasId && ids[1] === sd.imageId);
  const original = assets.get(gd.atlasId), outline = assets.get(sd.imageId);
  if (!pair || !original || !outline || !samePose(group.data.transform, groupPose) ||
      group.data.layer !== 0 || group.data.visible !== true || group.data.alpha !== 1 || group.data.hitMode !== 'auto' ||
      group.data.mask != null || group.data.hitArea != null || group.data.pivot != null ||
      gd.layer !== 1 || !samePose(gd.transform, identity) || gd.glyphs.length !== 1 ||
      gd.visible !== true || gd.alpha !== 1 || gd.hitMode !== 'auto' || gd.pivot != null ||
      gd.text.length < 1 || gd.text.length > 128 || !/^[\x20-\x7e]+$/.test(gd.text) || !/[^ ]/.test(gd.text) ||
      gd.baseline !== 0 || gd.opacity !== 1 || gd.sampling !== 'nearest' || !quad ||
      quad.textStart !== 0 || quad.textEnd !== gd.text.length ||
      quad.sourceRect.x !== 0 || quad.sourceRect.y !== 0 ||
      quad.sourceRect.width !== original.width || quad.sourceRect.height !== original.height ||
      original.width > 1024 || original.height > 256 || original.pixels.byteLength > 1048576 ||
      outline.width !== original.width || outline.height !== original.height ||
      sd.layer !== 0 || sd.hitMode !== 'none' || sd.visible !== true || sd.alpha !== 1 ||
      sd.anchorX !== 0 || sd.anchorY !== 0 || sd.blendMode !== 'normal' || sd.tint.some(channel => channel !== 1) ||
      ['pivot', 'slice', 'tile', 'hitArea', 'rgbMatrix', 'alphaMask'].some(key => sd[key] != null) ||
      sd.opacity !== 1 || sd.sampling !== 'nearest' || sd.width !== quad.width || sd.height !== quad.height ||
      !samePose(sd.transform, { ...identity, x: quad.x, y: quad.y }) ||
      !sd.sourceRect || Object.keys(quad.sourceRect).some(key => sd.sourceRect[key] !== quad.sourceRect[key])) {
    fail('Document label, asset pair or decoration mapping differs from this example');
  }
  return {
    tree, glyph, sprite,
    description: {
      semanticText: gd.text, utf16Length: gd.text.length, sceneVersion: scene.version,
      semanticRange: [quad.textStart, quad.textEnd], glyphQuad: structuredClone(quad),
      parentTransform: { ...group.data.transform },
      outlineSprite: { transform: { ...sd.transform }, width: sd.width, height: sd.height,
        sourceRect: { ...sd.sourceRect }, hitMode: sd.hitMode, anchor: [sd.anchorX, sd.anchorY] },
      assets: [assetReport(gd.atlasId, original), assetReport(sd.imageId, outline)],
      ...structuredClone(preparation),
    },
  };
}
function documentMetadata(text) {
  const document = JSON.parse(text);
  return {
    format: document.format, version: document.version,
    byteCount: new TextEncoder().encode(text).length,
    assets: document.assets.map(asset => ({
      id: asset.id, width: asset.width, height: asset.height,
      byteLength: asset.byteLength, sha256: asset.sha256,
    })),
  };
}

function controllerFor(canvas, renderer) {
  let accepted = null, disposed = false, contextUnavailable = false;
  let frameCount = 0, generation = 0, savedDocument = null, openedDocument = null;
  const emptyScene = DiagramCanvasAPI.createDisplayTree(contextId).snapshot();
  function live() {
    if (disposed) throw new DiagramCanvasAPI.Canvas2DError('DISPOSED', 'Diagram example is disposed');
    if (contextUnavailable) throw new DiagramCanvasAPI.Canvas2DError('CONTEXT_LOST', 'Diagram context is unavailable');
  }
  function assetCopies(ids) {
    return new Map(ids.map(id => {
      const asset = renderer.getImageAsset(id);
      if (!asset) throw new DiagramCanvasAPI.Canvas2DError('INVALID_ASSET', 'Referenced diagram atlas is missing');
      return [id, asset];
    }));
  }
  function capture() {
    const image = renderer.captureImageAsset();
    return { width: image.width, height: image.height, byteCount: image.pixels.byteLength, rgbaChecksum: checksum(image.pixels) };
  }
  function hitProbe(inspected, assets, outlineOnly = false) {
    const data = inspected.glyph.data, quad = data.glyphs[0];
    const original = assets.get(data.atlasId), outline = assets.get(inspected.sprite.data.imageId);
    let chosen = -1, maximumAlpha = 0;
    for (let pixel = 0; pixel < original.width * original.height; pixel++) {
      const alpha = original.pixels[pixel * 4 + 3];
      const candidateAlpha = outlineOnly ? (alpha === 0 ? outline.pixels[pixel * 4 + 3] : 0) : alpha;
      if (candidateAlpha > maximumAlpha) { chosen = pixel; maximumAlpha = candidateAlpha; }
    }
    if (chosen < 0) return null;
    const x = chosen % original.width, y = Math.floor(chosen / original.width);
    const local = { x: quad.x + (x + 0.5) / original.width * quad.width,
      y: quad.y + (y + 0.5) / original.height * quad.height };
    const world = inspected.glyph.toWorld(local), viewport = renderer.worldToViewport(world);
    const hit = renderer.hitTest(viewport), handle = hit ? inspected.tree.get(hit.id) : null;
    return { pixel: [x, y], local, world, viewport, hit,
      semanticText: handle?.kind === 'glyphRun' ? handle.data.text : null,
      semanticRange: handle?.kind === 'glyphRun' ? [handle.data.glyphs[0].textStart, handle.data.glyphs[0].textEnd] : null };
  }
  function report() {
    return structuredClone({
      backend: 'Public Canvas2D renderer · retained diagram label', sourceProfile,
      ...accepted?.description, displayDPR: displayOptions.dpr, logicalSize: displayOptions.logicalSize,
      frameCount, available: !disposed && !contextUnavailable,
      frame: accepted?.frame ?? null, inkHit: accepted?.inkHit ?? null,
      outlineOnlyHit: accepted?.outlineOnlyHit ?? null, savedDocument, openedDocument,
    });
  }
  function acceptedValue(scene, assets, preparation) {
    const inspected = inspect(scene, assets, preparation);
    return {
      scene: structuredClone(scene), ids: [...assets.keys()], description: inspected.description,
      frame: capture(), inkHit: hitProbe(inspected, assets), outlineOnlyHit: hitProbe(inspected, assets, true),
    };
  }
  function removeUnused(ids) {
    for (const id of ids) if (renderer.getImageAsset(id)) renderer.removeImageAsset(id);
  }
  function adopt(scene, assets, preparation) {
    live();
    inspect(scene, assets, preparation);
    const prior = accepted, priorAssets = prior ? assetCopies(prior.ids) : null;
    let changed = false;
    try {
      for (const [id, asset] of assets) { renderer.setImageAsset(id, asset); changed = true; }
      renderer.updateScene(scene);
      const value = acceptedValue(scene, assetCopies([...assets.keys()]), preparation);
      if (prior) removeUnused(prior.ids.filter(id => !assets.has(id)));
      accepted = value; frameCount++;
      return report();
    } catch (error) {
      if (changed) {
        try {
          renderer.updateScene(emptyScene);
          if (prior) {
            for (const [id, asset] of priorAssets) renderer.setImageAsset(id, asset);
            renderer.updateScene(prior.scene); capture();
          }
          removeUnused([...assets.keys()].filter(id => !priorAssets?.has(id)));
        } catch { contextUnavailable = true; }
      }
      accepted = prior;
      throw error;
    }
  }
  function update(source) {
    live(); generation++;
    const input = parseInput(source);
    const pair = accepted?.ids.includes(pairs[0][0]) ? pairs[1] : pairs[0];
    const raster = DiagramCanvasAPI.rasterizeBrowserEllipsizedText({
      text: input.text, font: input.font, dpr: input.dpr, maxWidth: input.maxWidth, atlasId: pair[0],
    });
    const outline = DiagramCanvasAPI.outlineImageAsset(raster.asset, input.outlineRadius, input.outlineColor);
    const tree = DiagramCanvasAPI.createDisplayTree(contextId);
    const parent = tree.createContainer({ id: 'LabelGroup', layer: 0, transform: groupPose });
    const quad = raster.layout.glyphs[0];
    parent.addChild(tree.createSprite({
      id: 'OutlineSprite', layer: 0, transform: { ...identity, x: quad.x, y: quad.y },
      imageId: pair[1], width: quad.width, height: quad.height, opacity: 1, sampling: 'nearest',
      anchorX: 0, anchorY: 0, sourceRect: { ...quad.sourceRect }, hitMode: 'none',
    }));
    parent.addChild(tree.createGlyphRun({ id: 'OriginalGlyph', layer: 1, transform: identity, ...raster.layout }));
    tree.stage.addChild(parent);
    return adopt(tree.snapshot(), new Map([[pair[0], raster.asset], [pair[1], outline]]), {
      origin: 'browser-preparation', font: raster.font, maxWidth: raster.maxWidth,
      displayText: raster.displayText, truncated: raster.truncated, visibleTextEnd: raster.visibleTextEnd,
      rasterDPR: raster.dpr, outlineRadius: input.outlineRadius, outlineColor: [...input.outlineColor],
      advance: raster.advance, bounds: { ...raster.bounds },
    });
  }
  async function action(id) {
    live();
    if (id !== 'save-document') fail('Unknown diagram action');
    const token = ++generation;
    const scene = structuredClone(accepted.scene), assets = assetCopies(accepted.ids);
    const documentText = await serializeCanvasDocument(scene, key => assets.get(key) ?? null);
    if (disposed || token !== generation) return { report: report() };
    savedDocument = documentMetadata(documentText);
    return { report: report(), documentText, filename: 'diagram-label.canvas.json' };
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
    renderer.dispose(); accepted = null; savedDocument = null; openedDocument = null;
  }
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  return {
    public: { update, report, action, dispose },
    initialize(scene, assets, documentText) {
      accepted = acceptedValue(scene, assets, unknownPreparation);
      openedDocument = documentMetadata(documentText); frameCount++;
      return report();
    },
  };
}

/** The caller owns local font readiness and the detached candidate canvas. */
export function createDiagramLabelExample(canvas, sourceJSON) {
  const renderer = DiagramCanvasAPI.createCanvas2D(canvas, displayOptions);
  const controller = controllerFor(canvas, renderer);
  try { controller.public.update(sourceJSON); return controller.public; }
  catch (error) { controller.public.dispose(); throw error; }
}

/** Open stored scene and pixels on a fresh canvas without preparing text again. */
export async function openDiagramLabelExample(freshCanvas, documentText) {
  const staged = await stageCanvasDocument(documentText, freshCanvas, displayOptions);
  const controller = controllerFor(freshCanvas, staged.renderer);
  try {
    controller.initialize(staged.scene, staged.assets, documentText);
    return controller.public;
  } catch (error) { controller.public.dispose(); throw error; }
}
