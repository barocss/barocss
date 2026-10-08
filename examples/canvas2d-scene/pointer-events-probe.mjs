import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';

const file = new URL('../../packages/barocss-canvas2d/consumer/evidence/display-tree-reopen/saved.json', import.meta.url);
const parsed = await parseCanvasDocument(await readFile(file, 'utf8'));
const tree = createDisplayTreeFromScene(parsed.scene);
const team = tree.get('Team'), blue = tree.get('Blue');
const input = { type: 'pointerdown', pointerId: 7, point: { x: 90, y: 80 },
  hit: { id: 'Blue', kind: 'image' } };
const events = [];
const offBlue1 = blue.onPointer('pointerdown', event => {
  events.push(`blue1:${event.target.id}:${event.currentTarget.id}:${event.point.x}`);
});
const offBlue2 = blue.onPointer('pointerdown', () => events.push('blue2'));
const offTeam = team.onPointer('pointerdown', event => events.push(`team:${event.currentTarget.id}`));
const offStage = tree.stage.onPointer('pointerdown', event => events.push(`stage:${event.target?.id ?? 'null'}`));
tree.dispatchPointer(input);
assert.deepEqual(events, ['blue1:Blue:Blue:90', 'blue2', 'team:Team', 'stage:Blue']);

offBlue1(); offBlue1();
events.length = 0;
tree.dispatchPointer(input);
assert.deepEqual(events, ['blue2', 'team:Team', 'stage:Blue']);
events.length = 0;
tree.dispatchPointer({ ...input, hit: null });
assert.deepEqual(events, ['stage:null']);

const offStop = blue.onPointer('pointerdown', event => { events.push('stop'); event.stopPropagation(); });
events.length = 0;
tree.dispatchPointer(input);
assert.deepEqual(events, ['blue2', 'stop']);
offStop();

const scene = stringifySceneJSON(tree.snapshot());
const badInputs = [
  { ...input, type: 'click' },
  { ...input, pointerId: -0 },
  { ...input, pointerId: Number.MAX_SAFE_INTEGER + 1 },
  { ...input, point: { x: NaN, y: 0 } },
  { ...input, hit: { id: 'Detached', kind: 'image' } },
  { ...input, hit: { id: 'Bad id', kind: 'image' } },
  { ...input, hit: { id: 'Blue', kind: 'image', extra: 1 } },
];
for (const bad of badInputs) {
  events.length = 0;
  assert.throws(() => tree.dispatchPointer(bad), error => error.code === 'INVALID_SCENE');
  assert.deepEqual(events, []);
  assert.equal(stringifySceneJSON(tree.snapshot()), scene);
}
events.length = 0;
assert.throws(() => tree.dispatchPointer({ ...input, hit: { id: 'Blue', kind: 'rect' } }),
  error => error.code === 'INVALID_SCENE');
assert.throws(() => tree.dispatchPointer({ ...input, hit: { id: 'Blue', kind: 'line' } }),
  error => error.code === 'INVALID_SCENE');
assert.deepEqual(events, []);
assert.throws(() => blue.onPointer('click', () => {}), error => error.code === 'INVALID_SCENE');
assert.throws(() => blue.onPointer('pointerdown', null), error => error.code === 'INVALID_SCENE');

const offLimit = Array.from({ length: 32 }, () => blue.onPointer('pointermove', () => {}));
assert.throws(() => blue.onPointer('pointermove', () => {}), error => error.code === 'SCENE_LIMIT');
offLimit.forEach(off => off());
blue.onPointer('pointermove', () => {})();

let repeatedCalls = 0;
const repeated = () => { repeatedCalls++; };
const offRepeatedFirst = blue.onPointer('pointercancel', repeated);
const offRepeatedSecond = blue.onPointer('pointercancel', repeated);
offRepeatedFirst();
tree.dispatchPointer({ ...input, type: 'pointercancel' });
assert.equal(repeatedCalls, 1);
offRepeatedSecond();

const mutationEvents = [];
const offMutation = blue.onPointer('pointerup', () => {
  mutationEvents.push('blue');
  team.removeChild(blue);
  offParentMutation();
});
const offParentMutation = team.onPointer('pointerup', () => mutationEvents.push('team'));
tree.stage.onPointer('pointerup', () => mutationEvents.push('stage'));
tree.dispatchPointer({ ...input, type: 'pointerup' });
assert.deepEqual(mutationEvents, ['blue', 'team', 'stage']);
assert.equal(tree.get('Blue'), null);
assert.throws(() => tree.dispatchPointer(input), error => error.code === 'INVALID_SCENE');
team.addChild(blue);
offMutation();

const newTree = createDisplayTreeFromScene(parsed.scene);
const oldLength = events.length;
const newEvents = [];
newTree.get('Blue').onPointer('pointerdown', event => newEvents.push(event.target.id));
newTree.dispatchPointer(input);
assert.deepEqual(newEvents, ['Blue']);
assert.equal(events.length, oldLength);
assert.notEqual(newTree.get('Blue'), blue);
offBlue2(); offTeam(); offStage();

console.log(JSON.stringify({ result: 'ok', targetOrder: ['Blue', 'Team', 'stage'],
  invalidInputs: badInputs.length + 2, listenerLimit: 32, restoredHandle: newEvents[0] }));
