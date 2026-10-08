import assert from 'node:assert/strict';
import { Canvas2DError, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { tessellatePath } from '../../packages/barocss-canvas2d/dist/path.js';
import { crossingScene, sceneFor } from './nonzero-v5.mjs';

const view = { panX: 0, panY: 0, zoom: 1 };
const matrix = [1, 0, 0, 1, 10, 10];
const same = parseSceneJSON(stringifySceneJSON(sceneFor('nonzero')));
const opposite = parseSceneJSON(stringifySceneJSON(sceneFor('nonzero', true)));
const parity = parseSceneJSON(stringifySceneJSON(sceneFor('evenodd')));
assert.deepEqual([same.version, opposite.version, parity.version], [5, 5, 2]);
for (const scene of [same, opposite, parity]) {
  assert.equal(tessellatePath(scene.nodes[0].children[0], matrix, view, 2, 1).fill.contours.length, 2);
}
const old = sceneFor('nonzero'); old.version = 4;
assert.throws(() => stringifySceneJSON(old), error => error instanceof Canvas2DError && error.code === 'INVALID_SCENE');
assert.throws(() => tessellatePath(crossingScene().nodes[0].children[0], matrix, view, 2, 1),
  error => error.code === 'UNSUPPORTED_FEATURE');
const touching = sceneFor('nonzero');
touching.nodes[0].children[0].commands[5].x = -10;
assert.throws(() => tessellatePath(touching.nodes[0].children[0], matrix, view, 2, 1),
  error => error.code === 'UNSUPPORTED_FEATURE');
const crossingContours = sceneFor('nonzero');
for (const command of crossingContours.nodes[0].children[0].commands.slice(5, 9)) command.x += 100;
assert.throws(() => tessellatePath(crossingContours.nodes[0].children[0], matrix, view, 2, 1),
  error => error.code === 'UNSUPPORTED_FEATURE');
console.log(JSON.stringify({ result: 'ok', versions: [5, 5, 2], contours: 2,
  refusals: ['old-version-nonzero', 'self-crossing', 'touching-contours', 'crossing-contours'] }));
