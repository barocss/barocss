import test from 'node:test';
import assert from 'node:assert/strict';
import { withNode, rectanglePart } from '@barocss/cad-model/engine/doc';
import { addedHoles, holeGroup, holeRegions, regionMesh } from '@barocss/cad-model/app/holeRegion';

const box = { min: [0, 0, 0], max: [32, 32, 8] };

test('hole regions: a through hole spans the body, a blind one its depth, from the side it drills', () => {
  const plate = rectanglePart(32, 32, 8), at = plate.nodes.length;
  // Half off the edge: the region is the whole cylinder all the same.
  let doc = withNode(plate, { kind: 'hole', parent: { node: at - 1, side: 'solid' }, center: [32, 16], radius: 5 });
  doc = withNode(doc, { kind: 'hole', parent: { node: at, side: 'solid' }, center: [10, 10], radius: 2, axis: 'x', side: 'min', depth: 6 });
  const [through, blind] = holeRegions(doc.nodes, addedHoles(doc.nodes, at), box);
  assert.deepEqual(through, { start: [32, 16, 8], dir: [0, 0, -1], length: 8, r0: 5, r1: 5 });
  assert.deepEqual(blind, { start: [0, 10, 10], dir: [1, 0, 0], length: 6, r0: 2, r1: 2 });
});

test('hole regions: copies, a countersink cone and a counterbore with its hole', () => {
  const plate = rectanglePart(32, 32, 8), at = plate.nodes.length;
  let doc = withNode(plate, { kind: 'hole', parent: { node: at - 1, side: 'solid' }, center: [6, 6], radius: 1.5, pattern: { count: 3, step: [10, 0] }, csk: 6 });
  const rs = holeRegions(doc.nodes, [at], box);
  assert.equal(rs.length, 6, 'a cylinder and a cone for each of three copies');
  assert.deepEqual(rs.map(r => r.start[0]), [6, 6, 16, 16, 26, 26]);
  assert.deepEqual([rs[1].r0, rs[1].r1, rs[1].length], [3, 1.5, 1.5], 'the 90° cone, Ø6 at the face down to the hole');
  doc = withNode(plate, { kind: 'hole', parent: { node: at - 1, side: 'solid' }, center: [6, 6], radius: 3 });
  doc = withNode(doc, { kind: 'hole', parent: { node: at, side: 'solid' }, center: [6, 6], radius: 5, depth: 3 });
  assert.deepEqual(holeGroup(doc.nodes, at), [at, at + 1]);
  assert.deepEqual(holeGroup(doc.nodes, at + 1), [at, at + 1]);
  const m = regionMesh(holeRegions(doc.nodes, [at, at + 1], box), 16);
  assert.equal(m.indices.length, 2 * 16 * 6); assert.equal(m.rims.length, 2 * 2 * 16 * 6);
  // The surface sits just outside the hole's wall.
  const r = Math.hypot(m.positions[0] - 6, m.positions[1] - 6); assert.ok(r > 3 && r < 3.05, String(r));
});
