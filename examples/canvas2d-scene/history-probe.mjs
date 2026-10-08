import assert from 'node:assert/strict';
import { parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { SceneHistory } from './scene-history.mjs';
import { initialScene, initialSceneV0 } from './scene.mjs';

const renderer = {
  accepted: null, frames: 0,
  updateScene(candidate) { this.accepted = parseSceneJSON(stringifySceneJSON(candidate)); },
  render() { this.frames++; },
};
const history = new SceneHistory(renderer, initialSceneV0, 3);
const x = () => history.scene.nodes[0].children[0].transform.x;
const move = amount => candidate => { candidate.nodes[0].children[0].transform.x += amount; };
assert.equal(x(), 35);
history.preview(move(7));
assert.equal(renderer.accepted.nodes[0].children[0].transform.x, 42);
assert.equal(x(), 35);
assert.deepEqual([history.length, history.position], [1, 0]);
history.restore();
assert.equal(renderer.accepted.nodes[0].children[0].transform.x, 35);

history.commit(move(10));
history.commit(move(5));
assert.deepEqual([x(), history.length, history.position], [50, 3, 2]);
history.undo();
assert.equal(x(), 45);
assert.equal(history.canRedo, true);
const before = stringifySceneJSON(renderer.accepted), frames = renderer.frames;
assert.throws(() => history.commit(candidate => {
  candidate.nodes[0].children[0].id = 'FrameB';
}), error => error.code === 'INVALID_SCENE');
assert.deepEqual([x(), history.length, history.position, history.canRedo], [45, 3, 1, true]);
assert.equal(stringifySceneJSON(renderer.accepted), before);
assert.equal(renderer.frames, frames);
history.redo();
assert.equal(x(), 50);
history.commit(move(10));
assert.deepEqual([x(), history.length, history.position], [60, 3, 2]);
history.undo(); history.undo();
assert.equal(x(), 45); // The original 35 entry was evicted at this probe's limit of 3.
history.replace(initialScene);
assert.deepEqual([history.scene.version, history.length, history.position], [1, 1, 0]);
assert.equal(history.canUndo, false);

console.log(JSON.stringify({ result: 'ok', commands: 3, invalidRetained: true,
  previewUnrecorded: true, eviction: true, newFileRoot: true, frames: renderer.frames }));
