import assert from 'node:assert/strict';
import { Canvas2DError, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { initialScene, initialSceneV0, initialSceneV2 } from './scene.mjs';

const versions = [initialSceneV0, initialScene, initialSceneV2].map(scene => {
  const saved = stringifySceneJSON(scene);
  const opened = parseSceneJSON(saved);
  assert.equal(stringifySceneJSON(opened), saved);
  return opened.version;
});
assert.deepEqual(versions, [0, 1, 2]);
const filled = initialSceneV2.nodes[0].children.at(-1);
assert.equal(filled.id, 'FilledBadge');
assert.equal(filled.fill.rule, 'evenodd');
assert.equal(filled.commands.filter(command => command.kind === 'Z').length, 3);

function refuse(scene, code) {
  assert.throws(() => stringifySceneJSON(scene), error =>
    error instanceof Canvas2DError && error.code === code);
}
const openContour = structuredClone(initialSceneV2);
openContour.nodes[0].children.at(-1).commands.splice(6, 1);
refuse(openContour, 'INVALID_SCENE');
const tooMany = structuredClone(initialSceneV2);
tooMany.nodes[1].children.at(-1).commands = Array.from({ length: 9 }, (_, i) => [
  { kind: 'M', x: i * 10, y: 0 }, { kind: 'L', x: i * 10 + 4, y: 0 },
  { kind: 'L', x: i * 10 + 4, y: 4 }, { kind: 'Z' },
]).flat();
refuse(tooMany, 'SCENE_LIMIT');
const undefinedFill = structuredClone(initialSceneV2);
undefinedFill.nodes[0].children.at(-1).fill = undefined;
refuse(undefinedFill, 'INVALID_SCENE');
const oldVersion = structuredClone(initialSceneV2);
oldVersion.version = 1;
refuse(oldVersion, 'INVALID_SCENE');

console.log(JSON.stringify({ result: 'ok', versions, filledContours: 3,
  refusals: ['open-contour', 'contour-budget', 'present-undefined', 'v1-shape'] }));
