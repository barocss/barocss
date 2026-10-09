import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON,
  stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const tree = createDisplayTree('HitModeProbe');
const group = tree.createContainer({ id: 'Group', layer: 1, transform: pose });
const frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose,
  width: 20, height: 20, fill: [0, 0, 1, 1], clip: true });
const rect = tree.createRect({ id: 'Rect', layer: 0, transform: pose,
  width: 10, height: 10, fill: [1, 0, 0, 1] });
const line = tree.createLine({ id: 'Line', layer: 1, transform: pose,
  x1: 0, y1: 0, x2: 10, y2: 0, width: 1, stroke: [1, 1, 1, 1] });
const path = tree.createPath({ id: 'Path', layer: 2, transform: pose,
  commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 }],
  stroke: { color: [1, 1, 1, 1], width: 1 } });
const sprite = tree.createSprite({ id: 'Sprite', layer: 3, transform: pose,
  imageId: 'Atlas', width: 10, height: 10, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0 });
const glyph = tree.createGlyphRun({ id: 'Glyph', layer: 4, transform: pose,
  atlasId: 'Atlas', text: 'H', baseline: 0, opacity: 1, sampling: 'nearest',
  glyphs: [{ sourceRect: { x: 0, y: 0, width: 1, height: 1 },
    x: 0, y: 0, width: 10, height: 10, textStart: 0, textEnd: 1 }] });
tree.stage.addChild(group); group.addChild(frame);
for (const child of [rect, line, path, sprite, glyph]) frame.addChild(child);
assert.equal(tree.snapshot().version, 13);
assert.equal('setHitMode' in tree.stage, false);
for (const handle of [group, frame, rect, line, path, sprite, glyph]) {
  const before = stringifySceneJSON(tree.snapshot());
  assert.equal(handle.data.hitMode, 'auto');
  for (const bad of [undefined, null, 'AUTO', 'paint', '', 0, new String('none')]) {
    assert.throws(() => handle.setHitMode(bad), error => error.code === 'INVALID_SCENE');
    assert.equal(stringifySceneJSON(tree.snapshot()), before);
  }
  handle.setHitMode('none');
  assert.equal(handle.data.hitMode, 'none');
  const copy = handle.data;
  copy.hitMode = 'auto';
  assert.equal(handle.data.hitMode, 'none');
  handle.setHitMode('auto');
  assert.equal(stringifySceneJSON(tree.snapshot()), before);
}
assert.throws(() => tree.createRect({ id: 'Bad', layer: 0, transform: pose,
  width: 1, height: 1, fill: [1, 0, 0, 1], hitMode: null }),
  error => error.code === 'INVALID_SCENE');
path.setHitMode('none');
path.setPath({ commands: path.data.commands, stroke: path.data.stroke });
assert.equal(path.data.hitMode, 'none');
path.setHitMode('auto');
rect.setHitMode('none');
rect.setRect({ width: rect.data.width, height: rect.data.height, fill: rect.data.fill });
assert.equal(rect.data.hitMode, 'none');
rect.setHitMode('auto');
glyph.setHitMode('none');
glyph.setLayout({ atlasId: glyph.data.atlasId, text: glyph.data.text,
  baseline: glyph.data.baseline, opacity: glyph.data.opacity,
  sampling: glyph.data.sampling, glyphs: glyph.data.glyphs });
assert.equal(glyph.data.hitMode, 'none');
glyph.setHitMode('auto');
let calls = 0;
sprite.onPointer('pointerdown', () => calls++);
const claimed = { type: 'pointerdown', pointerId: 1, point: { x: 5, y: 5 },
  hit: { id: 'Sprite', kind: 'image' } };
tree.dispatchPointer(claimed);
assert.equal(calls, 1);
for (const handle of [sprite, frame, group]) {
  handle.setHitMode('none');
  assert.throws(() => tree.dispatchPointer(claimed), error => error.code === 'INVALID_SCENE');
  assert.equal(calls, 1);
  handle.setHitMode('auto');
}
group.setHitMode('none');
assert.equal(sprite.data.hitMode, 'auto');
const saved = tree.snapshot();
assert.equal(saved.nodes[0].hitMode, 'none');
const restored = createDisplayTreeFromScene(saved);
assert.equal(stringifySceneJSON(restored.snapshot()), stringifySceneJSON(saved));
assert.equal(restored.get('Group').data.hitMode, 'none');
assert.equal(restored.get('Sprite').data.hitMode, 'auto');
restored.get('Group').setHitMode('auto');
assert.equal(restored.get('Group').data.hitMode, 'auto');

const missing = structuredClone(saved);
delete missing.nodes[0].children[0].children[0].hitMode;
assert.throws(() => parseSceneJSON(JSON.stringify(missing)), error => error.code === 'INVALID_SCENE');
const unknown = structuredClone(saved);
unknown.nodes[0].hitMode = 'passthrough';
assert.throws(() => stringifySceneJSON(unknown), error => error.code === 'INVALID_SCENE');
const legacy = createDisplayTree('LegacyHitMode');
legacy.stage.addChild(legacy.createRect({ id: 'OldRect', layer: 0, transform: pose,
  width: 2, height: 2, fill: [1, 0, 0, 1] }));
for (const version of [6, 7, 8, 9, 10]) {
  const scene = legacy.snapshot();
  scene.version = version;
  delete scene.nodes[0].hitMode;
  if (version < 10) delete scene.nodes[0].alpha;
  if (version < 9) delete scene.nodes[0].visible;
  assert.equal(parseSceneJSON(stringifySceneJSON(scene)).version, version);
  assert.equal(createDisplayTreeFromScene(scene).get('OldRect').data.hitMode, 'auto');
  const extra = structuredClone(scene);
  extra.nodes[0].hitMode = 'none';
  assert.throws(() => stringifySceneJSON(extra), error => error.code === 'INVALID_SCENE');
}
const pixels = new Uint8Array([0, 0, 255, 255]);
const file = await serializeCanvasDocument(saved, id => id === 'Atlas'
  ? { width: 1, height: 1, pixels } : null);
const document = await parseCanvasDocument(file);
assert.equal(document.scene.version, 13);
assert.deepEqual([...document.assets.get('Atlas').pixels], [...pixels]);
await assert.rejects(() => serializeCanvasDocument(saved, () => null),
  error => error.code === 'INVALID_ASSET');
console.log(JSON.stringify({ result: 'ok', sceneVersion: 13,
  fileBytes: Buffer.byteLength(file), kinds: 7, legacyVersions: [6, 7, 8, 9, 10] }));
