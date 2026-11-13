import assert from 'node:assert/strict';
import test from 'node:test';
import type { Polygon } from '../src/sketch/rules';
import { pickSketch } from '../src/sketch/select';
import type { SketchShape } from '../src/sketch/types';

const outline: Polygon = {
  kind: 'polygon',
  closed: true,
  points: [[0, 0], [50, 0], [50, 30], [0, 30]],
  circles: [{ c: [20, 10], r: 6 }],
};
const project = (x: number, y: number) => [x, y];
const finished: SketchShape = { kind: 'circle', c: [30, 10], r: 6 };

test('outline edges and circles compete by projected distance', () => {
  assert.deepEqual(pickSketch(outline, project, 20, 1), { kind: 'edge', i: 0 });
  assert.deepEqual(pickSketch(outline, project, 20, 3), { kind: 'circle', i: 0 });
  assert.deepEqual(pickSketch(outline, project, 30, 4, [finished]), { kind: 'circle', i: 0, done: true });
});

test('vertex priority, category ties and the inclusive hit radius stay stable', () => {
  assert.deepEqual(pickSketch(outline, project, 4, 0), { kind: 'point', i: 0 });
  assert.deepEqual(pickSketch(outline, project, 20, 2), { kind: 'edge', i: 0 });
  const coincident: SketchShape = { kind: 'circle', ...outline.circles![0] };
  assert.deepEqual(pickSketch(outline, project, 20, 4, [coincident]), { kind: 'circle', i: 0 });
  assert.deepEqual(pickSketch(outline, project, 25, -7), { kind: 'edge', i: 0 });
  assert.equal(pickSketch(outline, project, 25, -7.01), null);
});
