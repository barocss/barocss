import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';
import { SceneHistory } from './scene-history.mjs';
import { initialTextScene, makeTextCandidate } from './text-adapter.mjs';

const first = makeTextCandidate('HI', 'Atlas1');
const spaced = makeTextCandidate('H I', 'Atlas2');
assert.equal(first.asset.width, 10);
assert.equal(spaced.asset.width, 15);
assert.deepEqual(spaced.run.glyphs.map(g => [g.sourceRect.x, g.x, g.textStart, g.textEnd]),
  [[0, 0, 0, 1], [10, 96, 2, 3]]);
assert.deepEqual([...spaced.asset.pixels.slice(0, 4)], [20, 32, 56, 255]);
assert.deepEqual([...spaced.asset.pixels.slice(5 * 4, 5 * 4 + 4)], [0, 0, 0, 0]);
assert.deepEqual(parseSceneJSON(stringifySceneJSON(initialTextScene(spaced.run))),
  initialTextScene(spaced.run));
for (const text of ['', '   ', 'Hi', 'HI!', 'HIIIIIH', '한', '😀']) {
  assert.throws(() => makeTextCandidate(text, 'Atlas3'), error => error.code === 'UNSUPPORTED_FEATURE');
}

const accepted = [];
const renderer = { updateScene(scene) { accepted.push(parseSceneJSON(stringifySceneJSON(scene))); }, render() {} };
const history = new SceneHistory(renderer, initialTextScene(first.run), 8);
history.commit(scene => { scene.nodes[1] = spaced.run; });
assert.equal(history.scene.nodes[1].text, 'H I');
assert.equal(history.position, 1);
history.undo(); assert.equal(history.scene.nodes[1].text, 'HI');
history.redo(); assert.equal(history.scene.nodes[1].text, 'H I');
assert.deepEqual(accepted.at(-1).nodes[1].glyphs, spaced.run.glyphs);
const saved = await parseCanvasDocument(readFileSync(
  'examples/canvas2d-scene/evidence/text-v4/text-document.json', 'utf8'));
assert.equal(saved.scene.nodes[1].text, 'H I');
assert.equal(saved.scene.nodes[1].atlasId, 'Atlas2');
assert.deepEqual(saved.assets.get('Atlas2')?.pixels, spaced.asset.pixels);
await assert.rejects(() => parseCanvasDocument(readFileSync(
  'examples/canvas2d-scene/evidence/text-v4/text-corrupt.json', 'utf8')),
error => error.code === 'INVALID_ASSET');
console.log('text host: fixed atlas, UTF-16 ranges, Scene v4, history and refusal OK');
