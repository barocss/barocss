import assert from 'node:assert/strict';
import test from 'node:test';
import type { P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape } from '@barocss/cad-model/sketch/types';
import { DRAG_TRIM_MAX_PATH_POINTS, planDragTrim } from '../src/sketch/dragTrimPlan';

type Polygon = Extract<SketchShape, { kind: 'polygon' }>;

const open = (a: P2, b: P2, n?: number): Polygon => ({
  kind: 'polygon', points: [a, b], closed: false, bulges: [0, 0], ...(n === undefined ? {} : { ids: [`e${n}`, `e${n + 1}`] }),
});
const columns = (xs: number[]) => xs.map((x, i) => open([x, -5], [x, 15], 2 * i + 1));
const boundaries = () => [open([-2, 0], [32, 0]), open([-2, 10], [32, 10])];
const samples = (a: P2, b: P2, count: number): P2[] => Array.from({ length: count }, (_, i) => {
  const t = i / (count - 1);
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
});
const points = (shape: SketchShape) => shape.kind === 'polygon' ? shape.points : null;
const lowerAndUpper = (x: number): P2[][] => [[[x, -5], [x, 0]], [[x, 10], [x, 15]]];
const refused = (result: ReturnType<typeof planDragTrim>) => assert.ok('error' in result, JSON.stringify(result));

test('drag Trim uses the continuous crossing and has identical 2/20/200-sample geometry and side IDs', () => {
  const targets = columns([0, 10, 20]);
  const lower = open([-2, 0], [22, 0]), upper = open([-2, 10], [22, 10]);
  const shapes = [...targets, lower, upper];
  const before = structuredClone(shapes);
  const expected = [0, 10, 20].flatMap(lowerAndUpper);
  let sparse: ReturnType<typeof planDragTrim> | undefined;
  for (const count of [2, 20, 200]) {
    const result = planDragTrim(shapes, samples([-2, 5], [22, 5], count));
    assert.ok('shapes' in result, JSON.stringify(result));
    assert.deepEqual(result.intervals, [[[0, 0], [0, 10]], [[10, 0], [10, 10]], [[20, 0], [20, 10]]]);
    assert.deepEqual(result.shapes.slice(0, 6).map(points), expected);
    for (const [i, source] of targets.entries()) {
      assert.equal(result.shapes[2 * i].ids?.[0], source.ids?.[0]);
      assert.equal(result.shapes[2 * i + 1].ids?.[1], source.ids?.[1]);
    }
    assert.equal(new Set(result.shapes.flatMap(shape => shape.ids ?? [])).size, 12);
    assert.equal(result.shapes[6], lower);
    assert.equal(result.shapes[7], upper);
    if (sparse) assert.deepEqual(result, sparse);
    else sparse = result;
  }
  assert.deepEqual(shapes, before);
});

test('crossing order follows the path and repeat/backtracking does not trim a remainder', () => {
  const targets = columns([0, 10, 20]), [lower, upper] = boundaries();
  const shapes = [upper, targets[2], targets[0], lower, targets[1]];
  const backwards = planDragTrim(shapes, [[22, 5], [20, 5], [10, 5], [0, 5], [-2, 5]]);
  assert.ok('shapes' in backwards, JSON.stringify(backwards));
  assert.deepEqual(backwards.intervals.map(pair => pair[0][0]), [20, 10, 0]);
  const original = planDragTrim(shapes, [[-2, 5], [22, 5]]);
  assert.ok('shapes' in original);
  const backtracked = planDragTrim(shapes, [[-2, 5], [22, 5], [22, 5], [-2, 5], [-4, 5], [-4, 12], [22, 12]]);
  assert.deepEqual(backtracked, original);

  const vertex = planDragTrim([...columns([0]), lower, upper], [[-1, 4], [0, 5], [1, 6.5]]);
  assert.ok('shapes' in vertex);
  assert.deepEqual(vertex.intervals, [[[0, 0], [0, 10]]]);
});

test('untouched and protected construction retain exact custody; protected shapes still bound a trim', () => {
  const [a, b] = boundaries();
  const lower = { ...a, construction: true as const, ids: ['e100', 'e101'] };
  const upper = { ...b, construction: true as const, ids: ['e102', 'e103'] };
  const target = { ...columns([0])[0], construction: true as const };
  const unaffected = { ...open([27, 12], [27, 14]), lengths: { 0: 2 } };
  const shapes = [lower, target, unaffected, upper];
  const protectedShapes = new Set([lower, upper]);
  const result = planDragTrim(shapes, [[-2, 5], [2, 5]], protectedShapes);
  assert.ok('shapes' in result, JSON.stringify(result));
  assert.deepEqual(result.shapes.slice(1, 3).map(points), lowerAndUpper(0));
  assert.ok(result.shapes.slice(1, 3).every(shape => shape.construction));
  assert.deepEqual(result.shapes.slice(1, 3).flatMap(shape => shape.ids ?? []), ['e1', 'e104', 'e105', 'e2']);
  assert.equal(result.shapes[0], lower);
  assert.equal(result.shapes[3], unaffected);
  assert.equal(result.shapes[4], upper);
  const noHit = planDragTrim(shapes, [[-1, -1], [-1, 1]], protectedShapes);
  assert.ok('shapes' in noHit);
  assert.equal(noHit.shapes, shapes);
  assert.deepEqual(noHit.intervals, []);
});

test('the entire plan refuses unsupported, ambiguous and over-budget strokes', () => {
  const [a, b, c, d] = columns([0, 10, 20, 30]), [lower, upper] = boundaries();
  const withTargets = [a, b, c, lower, upper], before = structuredClone(withTargets);
  const stroke: P2[] = [[-2, 5], [22, 5]];
  refused(planDragTrim([a, b, { ...c, lengths: { 0: 20 } }, lower, upper], stroke));
  refused(planDragTrim([a, b, { ...c, ids: undefined }, lower, upper], stroke));
  refused(planDragTrim([a, b, { ...c, ids: a.ids }, lower, upper], stroke));
  refused(planDragTrim([a, b, c, d, lower, upper], [[-2, 5], [32, 5]]));
  refused(planDragTrim(withTargets, [[-2, 5], [14, 5], [NaN, 5]]));
  refused(planDragTrim(withTargets, samples([-2, 5], [22, 5], DRAG_TRIM_MAX_PATH_POINTS + 1)));
  refused(planDragTrim([a, b, c, lower, upper, { kind: 'circle', c: [30, 30], r: 2 }], stroke));
  refused(planDragTrim([a, lower], [[-2, 5], [2, 5]]));
  refused(planDragTrim([a, lower, upper, open([-4, 0], [24, 0])], [[-2, 5], [2, 5]]));
  refused(planDragTrim([a, lower, upper, open([0, -4], [0, -2])], [[-2, 5], [2, 5]]));
  refused(planDragTrim(withTargets, [[-2, -5], [2, -5]]));
  refused(planDragTrim(withTargets, [[-2, 4], [0, 5], [-2, 6]]));
  refused(planDragTrim(withTargets, [[-2, 5], [0, 5]]));
  refused(planDragTrim(withTargets, [[0, 2], [0, 8]]));
  assert.deepEqual(withTargets, before);

  const nearMiss = planDragTrim(withTargets, [[-1e-6, 1], [-1e-6, 9]]);
  assert.ok('shapes' in nearMiss);
  assert.equal(nearMiss.shapes, withTargets);
  assert.deepEqual(nearMiss.intervals, []);
});

test('an earlier cut cannot silently change the next interval boundary', () => {
  const [a, right] = columns([0, 10]), [lower, upper] = boundaries();
  const b = open([-5, 5], [15, 5], 10), shapes = [a, b, right, lower, upper];
  const before = structuredClone(shapes), start: P2 = [-2, 2], middle: P2 = [5, 2], end: P2 = [5, 7];
  assert.ok('shapes' in planDragTrim(shapes, [start, middle]));
  assert.ok('shapes' in planDragTrim(shapes, [middle, end]));
  refused(planDragTrim(shapes, [start, middle, end]));
  assert.deepEqual(shapes, before);
});

test('a closed rectangular profile supplies two boundaries and is left as the same object', () => {
  const rectangle: SketchShape = { kind: 'rectangle', a: [-2, 0], b: [22, 10] };
  const [a, b, c] = columns([0, 10, 20]).map(line => ({ ...line, construction: true as const }));
  const shapes = [rectangle, a, b, c];
  const result = planDragTrim(shapes, [[-1, 5], [21, 5]]);
  assert.ok('shapes' in result, JSON.stringify(result));
  assert.equal(result.shapes[0], rectangle);
  assert.deepEqual(result.shapes.slice(1).map(points), [0, 10, 20].flatMap(lowerAndUpper));
});

test('translated oblique crossings are stable under path subdivision and shallow crossings refuse', () => {
  const move = ([x, y]: P2): P2 => [4096 + 0.8 * x - 0.6 * y, -2048 + 0.6 * x + 0.8 * y];
  const local = [...columns([0, 10, 20]), ...boundaries()];
  const placed = local.map(shape => ({ ...shape, points: shape.points.map(move) }));
  const a = move([-2, 5]), b = move([22, 5]);
  const sparse = planDragTrim(placed, [a, b]), dense = planDragTrim(placed, samples(a, b, 200));
  assert.ok('shapes' in sparse, JSON.stringify(sparse));
  assert.deepEqual(dense, sparse);
  assert.deepEqual(sparse.intervals, [0, 10, 20].map(x => [move([x, 0]), move([x, 10])]));
  refused(planDragTrim(local, [[-1e-8, 3], [1e-8, 7]]));
});
