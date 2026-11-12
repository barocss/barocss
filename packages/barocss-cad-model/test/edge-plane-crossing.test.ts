import assert from 'node:assert/strict';
import test from 'node:test';
import { checkBrep, type Curve } from '@barocss/cad';
import { emptyDoc, withNode } from '../src/engine/doc';
import { partBreps } from '../src/engine/evaluate';
import { bodyMesh, type DisplayEdge } from '../src/engine/mesh';
import { nativeStraightEdgeMatches } from '../src/engine/nativeStraightEdge';
import { cross, dot, len, sub, type Vec3 } from '../src/engine/vec3';
import { edgePlaneCrossing } from '../src/sketch/edgePlaneCrossing';
import { offsetPlane, tiltPlane, toWorld, xyPlane, type SketchPlane } from '../src/sketch/plane';

const a: Vec3 = [4.12534, 6.25, 0], b: Vec3 = [4.12534, 6.25, 10];
const line: Curve = { id: 'line', kind: 'curve', degree: 1, knots: [0, 0, 1, 1], weights: [1, 1], controlPoints: [a, b] };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('the native line and both ordered vertices must exactly describe the same finite segment', () => {
  assert.ok(nativeStraightEdgeMatches(line, a, b));
  assert.ok(nativeStraightEdgeMatches({ ...line, knots: [-3, -3, 2, 2], weights: [2, 2] }, a, b));
  assert.equal(nativeStraightEdgeMatches(line, b, a), false);
  assert.equal(nativeStraightEdgeMatches({ ...line, controlPoints: [a, a] }, a, a), false);
  for (const curve of [
    { ...line, degree: 2 },
    { ...line, controlPoints: [a, [b[0], b[1], b[2] - 4e-8]] },
    { ...line, weights: [1, 0.5] },
    { ...line, weights: [0, 0] },
    { ...line, weights: [Infinity, Infinity] },
    { ...line, knots: [0, 0.1, 1, 1] },
    { ...line, knots: [1, 1, 1, 1] },
    { ...line, knots: [-Infinity, -Infinity, 1, 1] },
  ] satisfies Curve[]) assert.equal(nativeStraightEdgeMatches(curve, a, b), false);
  const outside: Vec3 = [10001, 6.25, 10];
  assert.equal(nativeStraightEdgeMatches({ ...line, controlPoints: [a, outside] }, a, outside), false);
});

test('one native fractional box edge crosses both working planes independent of tessellation quality', () => {
  const sketch = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [a[0], a[1]], max: [14.12534, 16.25] });
  const doc = withNode(sketch, { kind: 'extrude', sketch: 0, height: 10 });
  const [{ brep }] = partBreps(doc);
  assert.ok(checkBrep(brep, { strict: true }).valid);
  const native = brep.edges.find(edge => edge.name === 'n1.side0|n1.side3');
  assert.ok(native);

  const tilted = offsetPlane(tiltPlane(xyPlane(), Math.atan2(3, 4) * 180 / Math.PI), 6);
  for (const quality of [2, 8, 32]) {
    const display: DisplayEdge | undefined = bodyMesh(brep, 0, quality).edges.find(edge => edge.names.length === 1 && edge.names[0] === native.name);
    assert.ok(display?.nativeVertices);
    assert.equal(display.nativeLine, true);
    assert.deepEqual(display.nativeVertices, native.vertices);
    assert.deepEqual([display.a, display.b], [a, b]);
    assert.ok(nativeStraightEdgeMatches(native.curve, display.a, display.b));

    for (const [plane, expectedY, expectedZ] of [[xyPlane(3), 6.25, 3], [tilted, 3.3125, 2.8125]] as const) {
      const hit = edgePlaneCrossing(display.a, display.b, plane), reversed = edgePlaneCrossing(display.b, display.a, plane);
      assert.ok(hit && reversed);
      near(hit[0], a[0]); near(hit[1], expectedY);
      near(reversed[0], hit[0]); near(reversed[1], hit[1]);
      const world = toWorld(plane, hit);
      near(world[2], expectedZ);
      near(dot(sub(world, plane.origin), plane.normal), 0);
      near(len(cross(sub(world, a), sub(b, a))) / len(sub(b, a)), 0);
    }
  }
});

test('only a strict interior segment crossing can return a local point', () => {
  for (const z of [-1, 0, 0.0005, 0.001, 9.999, 9.9995, 10, 11]) {
    assert.equal(edgePlaneCrossing(a, b, xyPlane(z)), null, String(z));
  }
  assert.ok(edgePlaneCrossing(a, b, xyPlane(0.00101)));
  assert.equal(edgePlaneCrossing(a, a, xyPlane()), null);
  assert.equal(edgePlaneCrossing([0, 0, 0], [10, 0, 0], xyPlane()), null);
  assert.equal(edgePlaneCrossing([0, 0, 1], [10, 0, 1], xyPlane()), null);
  assert.deepEqual(edgePlaneCrossing([1.125, 2.25, -2], [4.875, 5.25, 4], xyPlane()), [2.375, 3.25]);
});

test('uncertain crossings and invalid coordinate frames fail closed', () => {
  assert.equal(edgePlaneCrossing([-9000, 0, -0.0011], [9000, 0, 0.0011], xyPlane()), null);
  assert.deepEqual(edgePlaneCrossing([-9000, 0, -1000], [9000, 0, 1000], xyPlane()), [0, 0]);
  assert.equal(edgePlaneCrossing([NaN, 0, -1], [0, 0, 1], xyPlane()), null);
  assert.equal(edgePlaneCrossing([10001, 0, -1], [10001, 0, 1], xyPlane()), null);
  assert.equal(edgePlaneCrossing([10000, 0, -1], [10000, 0, 1], { ...xyPlane(), origin: [-10000, 0, 0] }), null);
  assert.equal(edgePlaneCrossing(a, b, { ...xyPlane(3), normal: [0, 0, 2] }), null);
  assert.equal(edgePlaneCrossing(a, b, { ...xyPlane(3), xAxis: [0, 0, 1] }), null);

  const cleaned: SketchPlane = { ...xyPlane(), normal: [0, 2 ** -31, 1] };
  assert.equal(edgePlaneCrossing([1, 1000, -1], [1, 1000, 1], cleaned), null);
});
