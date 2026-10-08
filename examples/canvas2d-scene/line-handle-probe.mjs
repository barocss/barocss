import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const tree = createDisplayTree('LineProbe');
const team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(10, 10) });
const line = tree.createLine({ id: 'Edge', layer: 1, transform: pose(),
  x1: 20, y1: 40, x2: 100, y2: 40, width: 12, stroke: [0, 0, 1, 1] });
const background = tree.createRect({ id: 'Background', layer: 0, transform: pose(),
  width: 140, height: 100, fill: [1, 1, 1, 1] });
tree.stage.addChild(team); team.addChild(background); team.addChild(line);
assert.deepEqual(team.children.map(handle => handle.id), ['Background', 'Edge']);
const initial = stringifySceneJSON(tree.snapshot());
const copy = line.data;
copy.stroke[2] = 0;
assert.equal(stringifySceneJSON(tree.snapshot()), initial);
for (const bad of [
  { x1: 20, y1: 40, x2: 20, y2: 40, width: 12, stroke: [0, 0, 1, 1] },
  { x1: 20, y1: 40, x2: 100, y2: 40, width: 0, stroke: [0, 0, 1, 1] },
  { x1: 20, y1: 40, x2: 100, y2: 40, width: 12, stroke: [0, 0, 1, 1], extra: 1 },
]) {
  assert.throws(() => line.setLine(bad), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), initial);
}
const duplicate = tree.createLine({ ...line.data });
assert.throws(() => team.addChild(duplicate), error => error.code === 'INVALID_SCENE');
assert.equal(stringifySceneJSON(tree.snapshot()), initial);
const route = [];
line.onPointer('pointerdown', event => route.push(`line:${event.target.id}`));
team.onPointer('pointerdown', () => route.push('team'));
tree.stage.onPointer('pointerdown', () => route.push('stage'));
tree.dispatchPointer({ type: 'pointerdown', pointerId: 1, point: { x: 40, y: 50 },
  hit: { id: 'Edge', kind: 'line' } });
assert.deepEqual(route, ['line:Edge', 'team', 'stage']);
const stale = tree.createLine({ ...line.data, id: 'Stale' });
team.addChild(stale); team.removeChild(stale);
assert.throws(() => tree.dispatchPointer({ type: 'pointerdown', pointerId: 1, point: { x: 40, y: 50 },
  hit: { id: 'Stale', kind: 'line' } }), error => error.code === 'INVALID_SCENE');
assert.equal(route.length, 3);
const restored = createDisplayTreeFromScene(tree.snapshot());
assert.equal(restored.get('Edge').kind, 'line');
assert.deepEqual(restored.get('Team').children.map(handle => handle.id), ['Background', 'Edge']);
assert.equal(stringifySceneJSON(restored.snapshot()), initial);
restored.get('Edge').setLine({ x1: 120, y1: 20, x2: 120, y2: 90, width: 12, stroke: [0, 1, 0, 1] });
assert.equal(restored.get('Edge').data.x2, 120);
assert.equal(line.data.x2, 100);
console.log('line-handle-probe: copied data, atomic refusal, parent order, pointer route and reconstruction passed');
