import assert from 'node:assert/strict';
import { prove } from './modeling-intersection-fixture.mjs';
import { bounds } from './modeling-cardinal-split-fixture.mjs';
export { work, bodyHash } from './modeling-chamfer-split-fixture.mjs';

export function derivedRail(cad) {
  const model = cad.model(), width = model.parameter('width', 32), offset = model.parameter('offset', 0);
  const frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2);
  const at = model.dimension.add(model.dimension.scale(width, .5), offset);
  const blank = model.sketch.rectangle({ width, height: 24 }).extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
  const finished = front.chamfer(front.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), backDistance);
  const parts = finished.split({ axis: 'x', at });
  return { model, build: () => model.build({ negative: parts.negative, positive: parts.positive }) };
}

export function proveDimensions(snapshot, at, negative, positive) {
  const { width, frontDistance, backDistance } = snapshot.parameters;
  assert.deepEqual(Object.keys(snapshot.parameters).sort(), ['backDistance','frontDistance','offset','width']);
  assert.equal(frontDistance, 1); assert.equal(backDistance, 2);
  const graph = JSON.parse(snapshot.save());
  for (const name of Object.keys(snapshot.parameters)) assert.ok(Object.is(snapshot.parameters[name], graph.parameters[name]), name + ' retains its exact authored value/zero sign');
  assert.equal(width, (negative + positive) / 189.5);
  assert.ok(snapshot.parameters.offset === at - width * .5); // Zero sign is checked against authored JSON above.
  assert.deepEqual(graph.nodes[4].at, { op: 'add', left: { op: 'scale', value: { parameter: 'width' }, factor: .5 }, right: { parameter: 'offset' } });
  const native = snapshot.evidence[4].native;
  assert.deepEqual(native.request.parent, snapshot.evidence[3].native.split.negative.solid);
  assert.deepEqual(snapshot.evidence[3].native.split.request.parent, snapshot.evidence[2].native.split.negative.solid);
  assert.deepEqual(snapshot.evidence[2].native.split.request.parent, snapshot.evidence[1].native.solid);
  assert.equal(native.report.status, 'split'); assert.equal(native.report.volumeMM3.conserved, true);
  prove(native.request.parent, width * 189.5);
  assert.equal(negative + positive, width * 189.5);
  for (const [side, volume, min, max, sign] of [['negative',negative,0,at,1n],['positive',positive,at,width,-1n]]) {
    const body = snapshot.bodies[side]; assert.equal(body, native[side].solid);
    prove(body, volume); bounds(body, 0, min, max);
    assert.deepEqual(native.report.volumeMM3[side], body.certificate.volumeMM3);
    const cap = native.lineage.faces.find(f => f.side === side && f.role === 'cap');
    const support = body.supports.find(s => s.sourceId === cap.output.sourceId && s.faceId === cap.output.faceId);
    assert.ok(BigInt(support.outwardNormal[0].numerator) * sign > 0n);
    assert.equal(BigInt(support.outwardNormal[1].numerator), 0n); assert.equal(BigInt(support.outwardNormal[2].numerator), 0n);
  }
  assert.equal(native.section.kind, 'cycle'); assert.equal(native.section.cycleNodeKeys.length, 6); assert.equal(native.lineage.capUses.length, 6);
  for (const pair of native.lineage.capUses) {
    const uses = ['negative','positive'].map(side => native.lineage.faces.find(f => f.side === side && f.role === 'cap').edges.find(e => e.useId === pair[side].useId));
    assert.deepEqual(uses[0].nodeKeys, [...uses[1].nodeKeys].reverse());
  }
  for (const split of [snapshot.evidence[2].native.split, snapshot.evidence[3].native.split, native]) {
    for (const lineage of split.lineage.faces.filter(f => f.parent && f.output)) {
      const before = split.request.parent.request.assets.find(a => a.sourceId === lineage.parent.sourceId && a.face.options.faceId === lineage.parent.faceId);
      const after = split[lineage.side].solid.request.assets.find(a => a.sourceId === lineage.output.sourceId && a.face.options.faceId === lineage.output.faceId);
      assert.ok(before && after); assert.equal(before.sourceId, after.sourceId);
      assert.equal(before.face.options.faceId, after.face.options.faceId); assert.equal(before.face.loop.id, after.face.loop.id);
      assert.deepEqual(before.face.plane, after.face.plane);
    }
  }
  return { width, offset: snapshot.parameters.offset, resolvedSplitAt: at, negativeMM3: negative, positiveMM3: positive, parentMM3: width * 189.5, originalSourceLineage: true };
}
