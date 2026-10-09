import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON,
  stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = { x: 4, y: 4, scaleX: 1, scaleY: 1, rotation: 0 };
const crop = { x: 0, y: 0, width: 3, height: 3 };
const slice = { left: 1, right: 1, top: 1, bottom: 1 };
const tree = createDisplayTree('NineSliceProbe');
const panel = tree.createSprite({ id: 'Panel', layer: 0, transform: pose,
  imageId: 'Nine', width: 7, height: 5, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0, sourceRect: crop, slice });
tree.stage.addChild(panel);
assert.equal(tree.snapshot().version, 17);
assert.deepEqual(panel.data.slice, slice);
const copied = panel.data; copied.slice.left = 0;
assert.deepEqual(panel.data.slice, slice);
const saved = stringifySceneJSON(tree.snapshot());
assert.deepEqual(parseSceneJSON(saved), tree.snapshot());
const restored = createDisplayTreeFromScene(parseSceneJSON(saved));
assert.deepEqual(restored.get('Panel').data.slice, slice);
restored.get('Panel').setSize(9, 7);
assert.deepEqual(restored.get('Panel').data.slice, slice);
assert.equal(restored.get('Panel').data.width, 9);

const before = stringifySceneJSON(tree.snapshot());
const invalid = run => {
  assert.throws(run, error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), before);
};
invalid(() => panel.setSize(2, 5));
invalid(() => panel.setSourceRect(null));
invalid(() => panel.setSourceRect({ x: 0, y: 0, width: 2, height: 3 }));
invalid(() => panel.setImageSource('Other'));
invalid(() => panel.setImageSource('Other', { x: 0, y: 0, width: 3, height: 2 }));
for (const bad of [
  { left: -0, right: 1, top: 1, bottom: 1 },
  { left: 1.5, right: 1, top: 1, bottom: 1 },
  { left: 2, right: 1, top: 1, bottom: 1 },
  { left: 1, right: 1, top: 1, bottom: 1, extra: 0 },
  { left: new Number(1), right: 1, top: 1, bottom: 1 },
  { left: 4097, right: 0, top: 0, bottom: 0 },
]) invalid(() => panel.setSlice(bad));
panel.setSlice({ left: 0, right: 1, top: 1, bottom: 1 });
assert.equal(panel.data.slice.left, 0);
panel.setSlice(null);
assert.equal(panel.data.slice, undefined);
panel.setSourceRect(null);
assert.equal(panel.data.sourceRect, undefined);

const old = structuredClone(tree.snapshot());
old.version = 11;
assert.equal(parseSceneJSON(stringifySceneJSON(old)).version, 11);
assert.equal(createDisplayTreeFromScene(old).snapshot().version, 17);
old.nodes[0].slice = slice;
assert.throws(() => stringifySceneJSON(old), error => error.code === 'INVALID_SCENE');

const image = { ...tree.snapshot().nodes[0], sourceRect: crop, slice };
const glyphs = Array.from({ length: 64 }, (_, index) => ({
  sourceRect: { x: 0, y: 0, width: 1, height: 1 },
  x: index, y: 0, width: 1, height: 1, textStart: index, textEnd: index + 1,
}));
const glyph = { kind: 'glyphRun', id: 'Glyph0', layer: 0, transform: pose,
  visible: true, alpha: 1, hitMode: 'auto', atlasId: 'Atlas', text: 'A'.repeat(64),
  baseline: 0, opacity: 1, sampling: 'nearest', glyphs };
const heavy = { version: 12, unit: 'logical-px', contextId: 'NineSliceLimit', nodes: [
  ...Array.from({ length: 240 }, (_, index) => ({ ...structuredClone(image), id: `Image${index}` })),
  ...Array.from({ length: 9 }, (_, index) => ({ ...structuredClone(glyph), id: `Glyph${index}` })),
] };
assert.throws(() => stringifySceneJSON(heavy), error => error.code === 'SCENE_LIMIT');
console.log(JSON.stringify({ result: 'ok', sceneVersion: 17,
  invalidEdits: 11, heavyNodes: heavy.nodes.length }));
