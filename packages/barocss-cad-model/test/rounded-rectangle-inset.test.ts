import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBrep, massPropertiesOf } from '@barocss/cad';
import { emptyDoc, withNode } from '../src/engine/doc';
import { partSnapshot } from '../src/engine/part';
import { planRoundedRectangleInset } from '../src/sketch/internal/roundedRectangleInset';
import { profileOf } from '../src/sketch/loops';
import type { SketchShape } from '../src/sketch/types';

type Polygon = Extract<SketchShape, { kind: 'polygon' }>;
const quarter = Math.SQRT2 - 1;
const sourceIds = ['e7', 'e5', 'e6', 'e4', 'e3', 'e8', 'e1', 'e2'];
const insetIds = ['e13', 'e9', 'e16', 'e11', 'e12', 'e10', 'e15', 'e14'];
const sideMap = new Map(sourceIds.map((id, i) => [id, insetIds[i]] as const).reverse());
const stock = (): Polygon => ({
  kind: 'polygon', closed: true, ids: [...sourceIds],
  points: [[2, 0], [18, 0], [20, 2], [20, 8], [18, 10], [2, 10], [0, 8], [0, 2]],
  bulges: [0, quarter, 0, quarter, 0, quarter, 0, quarter],
});

test('rounded rectangle inset preserves line identity when corners retire and return', () => {
  const source = stock(), before = structuredClone(source), beforeMap = new Map(sideMap);
  const rounded = [[2, 1], [18, 1], [19, 2], [19, 8], [18, 9], [2, 9], [1, 8], [1, 2]];
  const straight = ['e13', 'e16', 'e12', 'e15'], retired = ['e9', 'e11', 'e10', 'e14'];
  const stockArea = 184 + 4 * Math.PI;
  const cases = [
    { inset: 1, points: rounded, ids: insetIds, retired: [], holeArea: 140 + Math.PI },
    { inset: 2, points: [[2, 2], [18, 2], [18, 8], [2, 8]], ids: straight, retired, holeArea: 96 },
    { inset: 2.5, points: [[2.5, 2.5], [17.5, 2.5], [17.5, 7.5], [2.5, 7.5]], ids: straight, retired, holeArea: 75 },
    { inset: 1, points: rounded, ids: insetIds, retired: [], holeArea: 140 + Math.PI },
  ];
  for (const expected of cases) {
    const result = planRoundedRectangleInset(source, expected.inset, sideMap);
    if ('error' in result) assert.fail(result.error);
    assert.deepEqual(result.shape.points, expected.points);
    assert.deepEqual(result.shape.ids, expected.ids);
    assert.deepEqual(result.retiredIds, expected.retired);
    assert.equal(result.shape.closed, true);
    const profile = profileOf([source, result.shape]);
    if ('error' in profile) assert.fail(profile.error);
    assert.deepEqual(profile.node.sideTags, { outer: sourceIds, holes: [expected.ids] });
    assert.equal(profile.node.regions, undefined);
    assert.equal(profile.node.holes?.[0].filter(edge => edge.kind === 'arc').length, expected.inset === 1 ? 4 : 0);
    const doc = withNode(withNode(emptyDoc(), profile.node), { kind: 'extrude', sketch: 0, height: 10 });
    const [body] = partSnapshot(doc).outputs;
    assert.ok(body && checkBrep(body.brep, { strict: true }).valid);
    for (const id of expected.ids) assert.ok(body.brep.faces.some(face => face.name === `n1.side[${id}]`));
    for (const id of expected.retired) assert.ok(!body.brep.faces.some(face => face.name === `n1.side[${id}]`));
    assert.ok(Math.abs(massPropertiesOf(body).volume - 10 * (stockArea - expected.holeArea)) <= 1e-7);
  }
  assert.deepEqual(source, before);
  assert.deepEqual(sideMap, beforeMap);

  const translated: Polygon = { ...source, points: source.points.map(([x, y]) => [x + 5.125, y - 7.25]) };
  const translatedInset = planRoundedRectangleInset(translated, 2.5, sideMap);
  if ('error' in translatedInset) assert.fail(translatedInset.error);
  assert.deepEqual(translatedInset.shape.points, [[7.625, -4.75], [22.625, -4.75], [22.625, 0.25], [7.625, 0.25]]);
  assert.deepEqual(translatedInset.shape.ids, straight);
  assert.deepEqual(translatedInset.retiredIds, retired);
});

test('rounded rectangle inset refuses unqualified geometry, distances and ID maps', () => {
  const source = stock();
  const refuse = (s: SketchShape, inset: number, ids: ReadonlyMap<string, string>, reason: RegExp) => {
    const before = structuredClone(s), beforeMap = new Map(ids);
    const result = planRoundedRectangleInset(s, inset, ids);
    assert.ok('error' in result);
    assert.match(result.error, reason);
    assert.deepEqual(s, before);
    assert.deepEqual(ids, beforeMap);
  };
  for (const distance of [0, -1, NaN, Infinity]) refuse(source, distance, sideMap, /positive finite/);
  for (const distance of [1.99, 1.999, 1.99999999]) refuse(source, distance, sideMap, /minimum offset radius/);
  refuse(source, Number.EPSILON, sideMap, /no clear gap/);
  for (const distance of [5, 5.5]) refuse(source, distance, sideMap, /closes the rectangle/);

  // R2.25 on the original chord keeps its ends and breaks both adjacent tangencies.
  const nonTangent = stock();
  nonTangent.bulges![1] = Math.tan(Math.asin(Math.sqrt(2) / 2.25) / 2);
  const reversed = stock();
  reversed.points = [reversed.points[0], ...reversed.points.slice(1).reverse()];
  reversed.bulges = reversed.bulges!.reverse().map(bulge => -bulge);
  for (const shape of [nonTangent, reversed, { ...source, closed: false }]) {
    refuse(shape, 1, sideMap, /CCW tangent rounded rectangle/);
  }

  const missing = new Map(sideMap);
  missing.delete(sourceIds[0]);
  const extra = new Map(sideMap).set('e99', 'e100');
  for (const map of [missing, extra]) refuse(source, 1, map, /one distinct derived ID/);
  for (const value of [insetIds[1], sourceIds[1], 'e01', 'e9007199254740992']) {
    refuse(source, 2.5, new Map(sideMap).set(sourceIds[0], value), /safe side IDs disjoint/);
  }
  refuse({ ...source, ids: Array<string>(8).fill(sourceIds[0]) }, 1, sideMap, /one distinct derived ID/);
});
