import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON,
  stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const tree = createDisplayTree('AlphaProbe');
const group = tree.createContainer({ id: 'Group', layer: 0, transform: pose });
const frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose,
  width: 20, height: 20, fill: [0, 0, 1, 0.8], clip: true });
const rect = tree.createRect({ id: 'Rect', layer: 0, transform: pose,
  width: 10, height: 10, fill: [1, 0, 0, 0.8] });
const line = tree.createLine({ id: 'Line', layer: 1, transform: pose,
  x1: 0, y1: 0, x2: 10, y2: 0, width: 1, stroke: [1, 1, 1, 1] });
const path = tree.createPath({ id: 'Path', layer: 2, transform: pose,
  commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 }],
  stroke: { color: [1, 1, 1, 1], width: 1 } });
const sprite = tree.createSprite({ id: 'Sprite', layer: 3, transform: pose,
  imageId: 'Atlas', width: 10, height: 10, opacity: 0.8, sampling: 'nearest',
  anchorX: 0, anchorY: 0 });
const glyph = tree.createGlyphRun({ id: 'Glyph', layer: 4, transform: pose,
  atlasId: 'Atlas', text: 'H', baseline: 0, opacity: 0.7, sampling: 'nearest',
  glyphs: [{ sourceRect: { x: 0, y: 0, width: 1, height: 1 },
    x: 0, y: 0, width: 10, height: 10, textStart: 0, textEnd: 1 }] });
tree.stage.addChild(group); group.addChild(frame);
for (const child of [rect, line, path, sprite, glyph]) frame.addChild(child);
assert.equal(tree.snapshot().version, 16);
assert.equal('setAlpha' in tree.stage, false);
for (const handle of [group, frame, rect, line, path, sprite, glyph]) {
  assert.equal(handle.data.alpha, 1);
  const before = stringifySceneJSON(tree.snapshot());
  for (const invalid of [undefined, null, -0, -0.1, 1.1, NaN, Infinity, '0.5', new Number(0.5)]) {
    assert.throws(() => handle.setAlpha(invalid), error => error.code === 'INVALID_SCENE');
    assert.equal(stringifySceneJSON(tree.snapshot()), before);
  }
  handle.setAlpha(0.5);
  assert.equal(handle.data.alpha, 0.5);
  handle.data.transform.x = 999;
  assert.equal(handle.data.transform.x, 0);
  handle.setAlpha(1);
  assert.equal(stringifySceneJSON(tree.snapshot()), before);
}
group.setAlpha(0.5); frame.setAlpha(0.5); sprite.setAlpha(0.5);
assert.equal(sprite.data.opacity, 0.8);
assert.equal(rect.data.fill[3], 0.8);
assert.equal(frame.data.fill[3], 0.8);
assert.equal(glyph.data.opacity, 0.7);
assert.equal(group.children[0], frame);
assert.equal(tree.get('Sprite'), sprite);
let delivered = 0;
sprite.onPointer('pointerdown', () => delivered++);
const input = { type: 'pointerdown', pointerId: 1, point: { x: 5, y: 5 },
  hit: { id: 'Sprite', kind: 'image' } };
tree.dispatchPointer(input);
assert.equal(delivered, 1);
group.setAlpha(0);
assert.throws(() => tree.dispatchPointer(input), error => error.code === 'INVALID_SCENE');
assert.equal(delivered, 1);
group.setAlpha(0.5); sprite.setAlpha(0);
assert.throws(() => tree.dispatchPointer(input), error => error.code === 'INVALID_SCENE');
const saved = tree.snapshot();
const restored = createDisplayTreeFromScene(saved);
assert.equal(stringifySceneJSON(restored.snapshot()), stringifySceneJSON(saved));
assert.equal(restored.get('Group').data.alpha, 0.5);
assert.equal(restored.get('Frame').data.alpha, 0.5);
assert.equal(restored.get('Sprite').data.alpha, 0);
restored.get('Sprite').setAlpha(1);
assert.equal(restored.get('Sprite').data.opacity, 0.8);

const absent = structuredClone(saved);
delete absent.nodes[0].children[0].children[0].alpha;
assert.throws(() => parseSceneJSON(JSON.stringify(absent)), error => error.code === 'INVALID_SCENE');
const extra = structuredClone(saved);
extra.nodes[0].alphaExtra = 1;
assert.throws(() => stringifySceneJSON(extra), error => error.code === 'INVALID_SCENE');
const legacy = createDisplayTree('LegacyAlpha');
legacy.stage.addChild(legacy.createRect({ id: 'OldRect', layer: 0, transform: pose,
  width: 2, height: 2, fill: [1, 0, 0, 1] }));
for (const version of [6, 7, 8, 9]) {
  const scene = legacy.snapshot();
  scene.version = version;
  delete scene.nodes[0].hitMode;
  delete scene.nodes[0].alpha;
  if (version < 9) delete scene.nodes[0].visible;
  assert.equal(parseSceneJSON(stringifySceneJSON(scene)).version, version);
  assert.equal(createDisplayTreeFromScene(scene).get('OldRect').data.alpha, 1);
  const bad = structuredClone(scene);
  bad.nodes[0].alpha = 1;
  assert.throws(() => stringifySceneJSON(bad), error => error.code === 'INVALID_SCENE');
}
const pixels = new Uint8Array([255, 0, 0, 128]);
const file = await serializeCanvasDocument(saved, id => id === 'Atlas'
  ? { width: 1, height: 1, pixels } : null);
const document = await parseCanvasDocument(file);
assert.equal(document.scene.version, 16);
assert.equal(document.scene.nodes[0].children[0].children[3].alpha, 0);
assert.deepEqual([...document.assets.get('Atlas').pixels], [...pixels]);
await assert.rejects(() => serializeCanvasDocument(saved, () => null),
  error => error.code === 'INVALID_ASSET');
console.log(JSON.stringify({ result: 'ok', sceneVersion: 16,
  fileBytes: Buffer.byteLength(file), kinds: 7, legacyVersions: [6, 7, 8, 9] }));
