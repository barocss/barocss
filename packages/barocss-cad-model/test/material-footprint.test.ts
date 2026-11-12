import assert from 'node:assert/strict';
import test from 'node:test';
import { checkOutput, evaluateCadPart, massPropertiesOf } from '@barocss/cad';
import { withNode, type StudioDoc } from '../src/engine/doc';
import { projectMaterialFootprint } from '../src/engine/materialFootprint';
import { toPartDocument } from '../src/engine/part';

const solid = (node: number) => ({ node, side: 'solid' as const });
const source: StudioDoc = {
  format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {},
  nodes: [
    { kind: 'sketch', id: 'n0', profile: 'rectangle', min: [0, 0], max: [32, 20] },
    { kind: 'extrude', id: 'n1', sketch: 0, height: 4 },
    { kind: 'sketch', id: 'n2', profile: 'rectangle', min: [4, 6], max: [8, 12] },
    { kind: 'extrude', id: 'n3', sketch: 2, height: 6, from: -1 },
    { kind: 'difference', id: 'n4', parent: solid(1), tool: solid(3) },
    { kind: 'sketch', id: 'n5', profile: 'rectangle', min: [20, 6], max: [24, 10] },
    { kind: 'extrude', id: 'n6', sketch: 5, height: 3, from: 2 },
    { kind: 'difference', id: 'n7', parent: solid(4), tool: solid(6) },
  ],
  outputs: { b7: solid(7) }, nextId: 8,
};
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-7, `${actual} != ${expected}`);
const corners = (points: readonly (readonly unknown[])[]) => points.map(point => point.join(',')).sort();

test('native material projection keeps a through hole and fills blind pockets', () => {
  const bothSides = withNode(withNode(source, { kind: 'extrude', sketch: 5, height: 2, from: -1 }),
    { kind: 'difference', parent: solid(7), tool: solid(8) });
  for (const [doc, key, sourceVolume] of [[source, 'b7', 2432], [bothSides, 'b9', 2416]] as const) {
    const original = JSON.stringify(doc);
    const profile = projectMaterialFootprint(doc, key);
    assert.equal(JSON.stringify(doc), original);
    assert.equal(profile.profile, 'polygon');
    assert.deepEqual(corners(profile.points), corners([[0, 0], [32, 0], [32, 20], [0, 20]]));
    assert.equal(profile.holes?.length, 1);
    assert.ok(profile.holes[0].every(segment => segment.kind === 'line'));
    assert.deepEqual(corners(profile.holes[0].map(segment => segment.start)), corners([[4, 6], [8, 6], [8, 12], [4, 12]]));
    const positioned = withNode(doc, { ...profile, plane: { origin: [0, 0, 10], normal: [0, 0, 1], xAxis: [1, 0, 0] } });
    const extruded = withNode(positioned, { kind: 'extrude', sketch: doc.nodes.length, height: 2 });
    const outputs = evaluateCadPart(toPartDocument(extruded)).outputs;
    assert.equal(outputs.length, 2);
    assert.ok(outputs.every(output => checkOutput(output).valid));
    near(massPropertiesOf(outputs[0]).volume, sourceVolume);
    near(massPropertiesOf(outputs[1]).volume, 2 * (32 * 20 - 4 * 6));
    assert.deepEqual([...new Set(outputs[1].brep.vertices.map(vertex => vertex.point[2]))].sort((a, b) => a - b), [10, 12]);
  }
});

test('material projection refuses curved bodies and a missing current body', () => {
  const withCircle = withNode(source, { kind: 'sketch', profile: 'circle', center: [50, 0], radius: 5 });
  const cylinder = withNode(withCircle, { kind: 'extrude', sketch: 8, height: 4 });
  assert.throws(() => projectMaterialFootprint(cylinder, 'b9'), /axis-aligned native edges/);
  assert.throws(() => projectMaterialFootprint(cylinder, 'b1'), /one current native solid/);
});

test('material projection preserves fractional native coordinates after a translation', () => {
  const doc = withNode(source, { kind: 'translate', parent: solid(7), offset: [0.25, -0.125, 17] });
  const profile = projectMaterialFootprint(doc, 'b8');
  assert.equal(profile.profile, 'polygon');
  assert.deepEqual(corners(profile.points), corners([[0.25, -0.125], [32.25, -0.125], [32.25, 19.875], [0.25, 19.875]]));
  assert.deepEqual(corners(profile.holes?.[0].map(segment => segment.start) ?? []),
    corners([[4.25, 5.875], [8.25, 5.875], [8.25, 11.875], [4.25, 11.875]]));
});

const empty: StudioDoc = { ...source, nodes: [], outputs: {}, nextId: 0 };
function box(doc: StudioDoc, min: [number, number], max: [number, number], height: number, from = 0) {
  return withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min, max }),
    { kind: 'extrude', sketch: doc.nodes.length, height, from });
}

test('material projection refuses a native boundary too short for a standalone profile', () => {
  const parts = box(box(empty, [0, 0], [10, 10], 2), [5, 0.00001], [15, 10], 2);
  const doc = withNode(parts, { kind: 'union', left: solid(1), right: solid(3) });
  const [body] = evaluateCadPart(toPartDocument(doc)).outputs;
  assert.ok(checkOutput(body).valid);
  near(massPropertiesOf(body).volume, 300 - 0.0001);
  assert.throws(() => projectMaterialFootprint(doc, 'b4'), /native sketch.*degenerate/i);
});

test('material projection refuses a point contact created by projecting distinct heights', () => {
  const parts = box(box(empty, [0, 0], [10, 10], 2), [10, 10], [20, 20], 2, 3);
  const bridge = withNode(withNode(parts, { kind: 'sketch', profile: 'polygon',
    points: [[0, 8], [2, 8], [2, 16], [12, 16], [12, 18], [0, 18]] }), { kind: 'extrude', sketch: 4, height: 5 });
  const joined = withNode(withNode(bridge, { kind: 'union', left: solid(1), right: solid(5) }),
    { kind: 'union', left: solid(6), right: solid(3) });
  const [body] = evaluateCadPart(toPartDocument(joined)).outputs;
  assert.ok(checkOutput(body).valid);
  assert.equal(body.bodyCount, 1);
  assert.throws(() => projectMaterialFootprint(joined, 'b7'), /boundaries touch or cross|no enclosing ring/i);
});
