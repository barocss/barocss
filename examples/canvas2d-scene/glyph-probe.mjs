import assert from 'node:assert/strict';
import { Canvas2DError, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { initialScene, initialSceneV0, initialSceneV2, initialSceneV3, initialSceneV4 } from './scene.mjs';
import { imageAssets } from './image-assets.mjs';

const versions = [initialSceneV0, initialScene, initialSceneV2, initialSceneV3, initialSceneV4]
  .map(scene => {
    const saved = stringifySceneJSON(scene);
    assert.equal(stringifySceneJSON(parseSceneJSON(saved)), saved);
    assert.equal(saved.includes('pixels'), false);
    return parseSceneJSON(saved).version;
  });
assert.deepEqual(versions, [0, 1, 2, 3, 4]);
assert.deepEqual(imageAssets.map(([id, asset]) => [id, asset.pixels.byteLength]),
  [['RGBA2', 16], ['Checker8', 256], ['GlyphHI', 280]]);
const run = initialSceneV4.nodes[1].children.at(-1);
assert.equal(run.kind, 'glyphRun');
assert.equal(run.text, 'HI');
assert.deepEqual(run.glyphs.map(glyph => [glyph.textStart, glyph.textEnd]), [[0, 1], [1, 2]]);

function refuse(change, code = 'INVALID_SCENE') {
  const scene = structuredClone(initialSceneV4);
  change(scene, scene.nodes[1].children.at(-1));
  assert.throws(() => stringifySceneJSON(scene), error =>
    error instanceof Canvas2DError && error.code === code);
}
refuse(scene => { scene.version = 3; });
refuse((_, glyph) => { glyph.text = '\ud800'; });
refuse((_, glyph) => { glyph.text = '😀'; glyph.glyphs[0].textStart = 1; });
refuse((_, glyph) => { glyph.glyphs[0].sourceRect.width = 1.5; });
refuse((_, glyph) => { glyph.glyphs[0].textEnd = 0; });
refuse((_, glyph) => { glyph.glyphs = Array.from({ length: 65 }, () => glyph.glyphs[0]); }, 'SCENE_LIMIT');

console.log(JSON.stringify({ result: 'ok', versions, atlasBytes: 280,
  refusals: ['old-version', 'unpaired-surrogate', 'split-scalar', 'fractional-crop',
    'empty-range', 'glyph-limit'] }));
