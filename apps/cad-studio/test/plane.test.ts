import test from 'node:test';
import assert from 'node:assert/strict';
import { boxOnPlane, isDefaultPlane, offsetPlane, planeLabel, planeOfFace, rayOnPlane, standardPlane, toLocal, toWorld, xyPlane } from '../src/sketch/plane';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { profileOf } from '../src/sketch/loops';

const near = (a: readonly number[], b: readonly number[], eps = 1e-9) => a.every((x, i) => Math.abs(x - b[i]) <= eps);

test('sketch planes of faces: horizontal keeps part X/Y, vertical runs X along the face and Y up', () => {
  const top = planeOfFace([0, 0, 1], [10, 5, 8]);
  assert.deepEqual(top, { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] });
  assert.equal(planeLabel(top!), 'Z 8');
  assert.ok(isDefaultPlane(xyPlane()) && !isDefaultPlane(top!));
  const front = planeOfFace([0, -1, 0], [32, 0, 4])!;
  assert.deepEqual(front, { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] });
  assert.equal(planeLabel(front), 'Y 0');
  const end = planeOfFace([1, 0, 0], [64, 16, 4])!;
  assert.deepEqual(end.xAxis, [0, 1, 0]);
  assert.equal(planeLabel(end), 'X 64');
  // Plane coordinates: (u, v) = (along the face, up); a point maps there and back.
  assert.ok(near(toLocal(end, [64, 10, 3]), [10, 3]));
  assert.ok(near(toWorld(end, [10, 3]), [64, 10, 3]));
  // A face turned 30° about Z, and refused tilted faces.
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  const turned = planeOfFace([c, s, 0], [c * 20, s * 20, 2])!;
  assert.ok(near(turned.origin, [c * 20, s * 20, 0], 1e-3) && near(turned.xAxis, [-s, c, 0]));
  assert.equal(planeLabel(turned), '30° plane');
  assert.equal(planeOfFace([0, 1, 1], [0, 0, 0]), null);
  // A ray straight at the end face meets it at its own coordinates.
  assert.ok(near(rayOnPlane(end, [100, 12, 5], [-1, 0, 0])!, [12, 5]));
  assert.equal(rayOnPlane(end, [100, 12, 5], [1, 0, 0]), null, 'behind the ray');
  assert.deepEqual(boxOnPlane(end, [0, 0, 0], [64, 32, 8]), [[0, 0], [32, 8]]);
});

test('sketches on side faces join and cut along the face normal', () => {
  const box = rectanglePart(64, 32, 8);
  const plate = { node: box.nodes.length - 1, side: 'solid' as const };
  const front = planeOfFace([0, -1, 0], [32, 0, 4])!;
  const add = (doc: StudioDoc, ...nodes: ModelNode[]) => nodes.reduce(withNode, doc);
  // A Ø4 pin 6 mm out of the front face at (10, 4), joined to the plate.
  let d = add(box, { kind: 'sketch', profile: 'circle', center: [10, 4], radius: 2, plane: front });
  d = add(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: 6 });
  d = add(d, { kind: 'union', left: plate, right: { node: d.nodes.length - 1, side: 'solid' } });
  let r = evaluateDoc(d, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 1);
  assert.ok(near(r.bodies[0].mesh.bounds.min, [0, -6, 0], 1e-6), JSON.stringify(r.bodies[0].mesh.bounds));
  // A 10 × 4 pocket 5 deep into the +X end face: a negative distance from the face.
  const end = planeOfFace([1, 0, 0], [64, 16, 4])!;
  d = add(box, { kind: 'sketch', profile: 'rectangle', min: [11, 2], max: [21, 6], plane: end });
  d = add(d, { kind: 'extrude', sketch: d.nodes.length - 1, height: -5 });
  d = add(d, { kind: 'difference', parent: plate, tool: { node: d.nodes.length - 1, side: 'solid' } });
  r = evaluateDoc(d, 2);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 1);
  assert.ok(r.bodies[0].mesh.faces.length > 6, 'the pocket adds faces');
  assert.ok(near(r.bodies[0].mesh.bounds.max, [64, 32, 8], 1e-6));
});

test('several closed shapes make one profile: shapes inside another are holes, the rest regions', () => {
  const plate = { kind: 'rectangle' as const, a: [0, 0] as [number, number], b: [60, 40] as [number, number] };
  const windowHole = { kind: 'rectangle' as const, a: [10, 10] as [number, number], b: [20, 30] as [number, number] };
  const bore = { kind: 'circle' as const, c: [40, 20] as [number, number], r: 5 };
  const boss = { kind: 'circle' as const, c: [80, 20] as [number, number], r: 6 };
  const r = profileOf([plate, windowHole, bore, boss]);
  assert.ok('node' in r);
  const node = r.node;
  assert.equal(node.profile, 'rectangle');
  assert.equal(node.regions?.length, 1);
  assert.equal(node.holes?.length, 2);
  // It evaluates: the plate with its two holes beside the boss.
  let d = withNode(emptyDoc(), node);
  d = withNode(d, { kind: 'extrude', sketch: 0, height: 4 });
  const ev = evaluateDoc(d, 3);
  assert.ok(ev.ok, JSON.stringify(!ev.ok && ev.error));
  // An island inside a hole and open shapes.
  assert.ok('error' in profileOf([plate, windowHole, { kind: 'circle', c: [15, 20], r: 2 }]));
  assert.ok('error' in profileOf([{ kind: 'polygon', points: [[0, 0], [5, 0]], closed: false }]));
  assert.deepEqual(profileOf([plate]), { node: { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] } });
});

test('coordinate planes read as their views, and offsets move along the normal', () => {
  // XZ: X right, Z up (the front view); YZ: Y right, Z up (the right view).
  assert.ok(near(toWorld(standardPlane('xz'), [3, 4]), [3, 0, 4]));
  assert.ok(near(toWorld(standardPlane('yz'), [3, 4]), [0, 3, 4]));
  assert.equal(planeLabel(offsetPlane(standardPlane('xy'), 12.5)), 'Z 12.5');
  assert.equal(planeLabel(offsetPlane(standardPlane('xz'), 10)), 'Y -10', 'XZ faces −Y');
  assert.equal(planeLabel(offsetPlane(planeOfFace([1, 0, 0], [64, 0, 0])!, 5)), 'X 69');
});
