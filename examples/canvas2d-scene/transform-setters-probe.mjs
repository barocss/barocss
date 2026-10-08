import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const tree = createDisplayTree('TransformSettersProbe');
const group = tree.createContainer({ id: 'Group', layer: 0, transform: pose });
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
for (const handle of [group, frame, rect, line, path, sprite, glyph]) {
  const original = stringifySceneJSON(tree.snapshot());
  for (const call of [
    () => handle.setPosition(), () => handle.setPosition(-0, 2),
    () => handle.setPosition(NaN, 2), () => handle.setPosition(0, 1e6 + 1),
    () => handle.setScale(0, 1), () => handle.setScale(1, Infinity),
    () => handle.setScale(1, -0), () => handle.setRotation(-0),
    () => handle.setRotation(2 * Math.PI + 0.01), () => handle.setRotation('90'),
  ]) {
    assert.throws(call, error => error.code === 'INVALID_SCENE');
    assert.equal(stringifySceneJSON(tree.snapshot()), original);
  }
  handle.setPosition(2, 3);
  assert.deepEqual(handle.data.transform, { ...pose, x: 2, y: 3 });
  handle.setScale(2, 3);
  assert.deepEqual(handle.data.transform, { ...pose, x: 2, y: 3, scaleX: 2, scaleY: 3 });
  const copy = handle.data.transform; copy.x = 999;
  assert.equal(handle.data.transform.x, 2);
  assert.equal(tree.get(handle.id), handle);
  assert.equal(handle.data.id, handle.id);
  handle.setPosition(0, 0); handle.setScale(1, 1);
  assert.equal(stringifySceneJSON(tree.snapshot()), original);
}
for (const handle of [rect, line, path, sprite, glyph]) {
  handle.setRotation(Math.PI / 2);
  assert.equal(handle.data.transform.rotation, Math.PI / 2);
  handle.setRotation(0);
}
for (const handle of [group, frame]) {
  const before = stringifySceneJSON(tree.snapshot());
  assert.throws(() => handle.setRotation(Math.PI / 2), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), before);
}
const saved = tree.snapshot();
const file = await serializeCanvasDocument(saved,
  id => id === 'Atlas' ? { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) } : null);
const reopened = await parseCanvasDocument(file);
const restored = createDisplayTreeFromScene(reopened.scene);
assert.equal(stringifySceneJSON(restored.snapshot()), stringifySceneJSON(saved));
restored.get('Sprite').setPosition(7, 8);
assert.deepEqual(restored.get('Sprite').data.transform, { ...pose, x: 7, y: 8 });
console.log(JSON.stringify({ result: 'ok', kinds: 7, sceneVersion: 9,
  fileBytes: Buffer.byteLength(file) }));
