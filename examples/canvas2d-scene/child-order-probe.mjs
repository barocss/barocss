import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const tree = createDisplayTree('ChildOrder');
const team = tree.createContainer({ id: 'Team', layer: 0, transform: pose() });
const frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose(0, 0),
  width: 100, height: 100, fill: [0, 0, 0, 0], clip: false });
const makeRect = (id, layer = 0) => tree.createRect({ id, layer, transform: pose(10, 10),
  width: 40, height: 40, fill: [1, 0, 0, 1] });
const red = makeRect('Red'), blue = makeRect('Blue'), green = makeRect('Green', 1);
const first = makeRect('First'), second = makeRect('Second');
const stageBox = makeRect('StageBox');
tree.stage.addChild(team); tree.stage.addChild(frame); tree.stage.addChild(stageBox);
team.addChild(red); team.addChild(blue); team.addChild(green);
frame.addChild(first); frame.addChild(second);
const names = parent => parent.children.map(child => child.id);
const snapshot = () => stringifySceneJSON(tree.snapshot());
const originalRed = red;
const events = [];
red.onPointer('pointerdown', () => events.push('Red'));
team.onPointer('pointerdown', () => events.push('Team'));
tree.stage.onPointer('pointerdown', () => events.push('stage'));

tree.stage.setChildIndex(stageBox, 0);
assert.deepEqual(names(tree.stage), ['StageBox', 'Team', 'Frame']);
frame.setChildIndex(first, 1);
assert.deepEqual(names(frame), ['Second', 'First']);
team.setChildIndex(red, 2);
assert.deepEqual(names(team), ['Blue', 'Green', 'Red']);
team.setChildIndex(red, 2);
assert.deepEqual(names(team), ['Blue', 'Green', 'Red']);
assert.equal(tree.get('Red'), originalRed);
assert.equal(tree.get('Red').data.id, 'Red');
assert.equal(team.children[2], red);
const copy = team.children;
copy.reverse();
assert.deepEqual(names(team), ['Blue', 'Green', 'Red']);
const detachedSnapshot = tree.snapshot();
detachedSnapshot.nodes[1].children.reverse();
assert.deepEqual(names(team), ['Blue', 'Green', 'Red']);
tree.dispatchPointer({ type: 'pointerdown', pointerId: 1, point: { x: 20, y: 20 },
  hit: { id: 'Red', kind: 'rect' } });
assert.deepEqual(events, ['Red', 'Team', 'stage']);

const accepted = snapshot();
const invalid = [-1, -0, 0.5, NaN, Infinity, -Infinity, '1', 3, undefined];
for (const index of invalid) {
  assert.throws(() => team.setChildIndex(red, index), error => error.code === 'INVALID_SCENE');
  assert.equal(snapshot(), accepted);
}
const detached = makeRect('Detached');
const other = createDisplayTree('Other').createRect({ id: 'Foreign', layer: 0,
  transform: pose(), width: 10, height: 10, fill: [0, 0, 1, 1] });
for (const child of [detached, first, other]) {
  assert.throws(() => team.setChildIndex(child, 0), error => error.code === 'INVALID_SCENE');
  assert.equal(snapshot(), accepted);
}
assert.throws(() => frame.setChildIndex(red, 0), error => error.code === 'INVALID_SCENE');
assert.equal(snapshot(), accepted);

const restored = createDisplayTreeFromScene(tree.snapshot());
assert.equal(stringifySceneJSON(restored.snapshot()), accepted);
const nextTeam = restored.get('Team');
assert.deepEqual(names(nextTeam), ['Blue', 'Green', 'Red']);
nextTeam.setChildIndex(nextTeam.children[0], 2);
assert.deepEqual(names(nextTeam), ['Green', 'Red', 'Blue']);
assert.deepEqual(names(team), ['Blue', 'Green', 'Red']);
console.log(JSON.stringify({ result: 'ok', refusals: invalid.length + 4,
  stage: names(tree.stage), team: names(team), frame: names(frame),
  reconstructed: names(nextTeam), pointer: events }));
