import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';

const file = new URL('../../packages/barocss-canvas2d/consumer/evidence/display-tree/display-tree-document.json', import.meta.url);
const documentText = await readFile(file, 'utf8');
const parsed = await parseCanvasDocument(documentText);
const tree = createDisplayTreeFromScene(parsed.scene);
assert.equal(parsed.scene.version, 6);
assert.equal(tree.snapshot().version, 17);
assert.deepEqual(tree.get('Red').data.tint, [1, 1, 1]);
assert.deepEqual(tree.get('Blue').data.tint, [1, 1, 1]);
assert.deepEqual([...parsed.assets.get('RGBA2').pixels], [
  255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 255, 255, 0, 255, 0, 255,
]);
assert.equal(tree.get('Team')?.kind, 'container');
assert.equal(tree.get('Blue')?.kind, 'sprite');
assert.equal(tree.get('Red')?.kind, 'sprite');
assert.equal(tree.get('Missing'), null);
assert.throws(() => tree.get('Bad id'), error => error.code === 'INVALID_SCENE');
const cropped = structuredClone(parsed.scene);
cropped.nodes[0].children[1].sourceRect = { x: 0, y: 0, width: 1, height: 2 };
const croppedTree = createDisplayTreeFromScene(cropped);
assert.equal(croppedTree.snapshot().version, 17);
assert.deepEqual(croppedTree.get('Red').data.tint, [1, 1, 1]);
assert.deepEqual(croppedTree.get('Red').data.sourceRect, { x: 0, y: 0, width: 1, height: 2 });

const detached = tree.createSprite({ ...tree.get('Red').data, id: 'Detached' });
assert.equal(tree.get('Detached'), null);
tree.get('Team').addChild(detached);
assert.equal(tree.get('Detached'), detached);
tree.get('Team').removeChild(detached);
assert.equal(tree.get('Detached'), null);

const oldText = stringifySceneJSON(parsed.scene);
tree.get('Team').setTransform({ ...tree.get('Team').data.transform, x: 90 });
tree.get('Red').setAnchor(0.5, 0.5);
assert.equal(tree.snapshot().nodes[0].transform.x, 90);
assert.equal(tree.get('Red').data.anchorX, 0.5);
assert.equal(stringifySceneJSON(parsed.scene), oldText);

const oldScene = structuredClone(parsed.scene);
oldScene.version = 5;
for (const child of oldScene.nodes[0].children) {
  delete child.anchorX; delete child.anchorY;
}
assert.throws(() => createDisplayTreeFromScene(oldScene), error => error.code === 'UNSUPPORTED_FEATURE');
const withRect = structuredClone(parsed.scene);
withRect.nodes[0].children.push({ kind: 'rect', id: 'Rect', layer: 2,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  width: 10, height: 10, fill: [1, 1, 1, 1] });
assert.equal(createDisplayTreeFromScene(withRect).get('Rect')?.kind, 'rect');
const withLine = structuredClone(withRect);
withLine.nodes[0].children.push({ kind: 'line', id: 'Line', layer: 3,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  x1: 0, y1: 0, x2: 10, y2: 0, width: 1, stroke: [1, 1, 1, 1] });
assert.equal(createDisplayTreeFromScene(withLine).get('Line')?.kind, 'line');
const malformed = structuredClone(parsed.scene);
malformed.nodes[0].children[0].unexpected = 1;
assert.throws(() => createDisplayTreeFromScene(malformed), error => error.code === 'INVALID_SCENE');

console.log(JSON.stringify({ result: 'ok', documentBytes: Buffer.byteLength(documentText),
  sourceIds: parsed.scene.nodes[0].children.map(node => node.id),
  restoredIds: tree.snapshot().nodes[0].children.map(node => node.id),
  assetBytes: parsed.assets.get('RGBA2').pixels.byteLength,
  refusals: ['bad-id', 'old-version', 'malformed-scene'] }));
