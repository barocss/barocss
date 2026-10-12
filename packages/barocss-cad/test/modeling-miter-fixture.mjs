import { convexBody } from './modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { prove } from './modeling-intersection-fixture.mjs';
import { bounds } from './modeling-cardinal-split-fixture.mjs';
import { work as sharedWork } from './modeling-chamfer-split-fixture.mjs';
import { deepFrozen } from './modeling-regeneration-fixture.mjs';
export { bodyHash } from './modeling-chamfer-split-fixture.mjs';
export function work(snapshot, ...args) { sharedWork(snapshot, ...args); deepFrozen(snapshot); }

export function miterRail(cad, { at = 24, bevels = false, occupiedOnly = false } = {}) {
  const model = cad.model(), cutPosition = model.parameter('cutPosition', at);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  let parent = blank;
  if (bevels) {
    const first = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), 2);
    parent = first.chamfer(first.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), 2);
  }
  const parts = parent.split({ plane: 'x+y', at: cutPosition });
  return { model, parts, build: () => model.build(occupiedOnly ? { positive: parts.positive } : { negative: parts.negative, positive: parts.positive }) };
}

export function proveMiter(snapshot, at, negative, positive, bevels = 0) {
  const index = snapshot.features.length - 1, native = snapshot.evidence[index].native;
  assert.equal(snapshot.features[index].kind, 'split'); assert.deepEqual(snapshot.features[index].dependencies, [index - 1]);
  assert.equal(snapshot.parameters.cutPosition, at);
  assert.deepEqual(JSON.parse(snapshot.save()).nodes[index], { kind: 'split', parent: { node: index - 1, side: 'solid' }, plane: 'x+y', at: { parameter: 'cutPosition' } });
  let ancestor = snapshot.evidence[1].native.solid; prove(ancestor, 6144);
  const inherited = split => {
    let count = 0;
    for (const lineage of split.lineage.faces.filter(f => f.parent && f.output)) {
      const before = split.request.parent.request.assets.find(a => a.sourceId === lineage.parent.sourceId && a.face.options.faceId === lineage.parent.faceId);
      const after = split[lineage.side].solid.request.assets.find(a => a.sourceId === lineage.output.sourceId && a.face.options.faceId === lineage.output.faceId);
      assert.ok(before && after); assert.equal(after.sourceId, before.sourceId); assert.equal(after.face.options.faceId, before.face.options.faceId);
      assert.equal(after.face.loop.id, before.face.loop.id); assert.deepEqual(after.face.plane, before.face.plane);
      for (const asset of [before,after]) {
        assert.deepEqual(asset.face.model.objects.find(o => o.id === asset.face.plane.id), asset.face.plane);
        assert.ok(asset.face.source.includes('@surface #' + asset.face.plane.id));
      }
      count++;
    }
    assert.ok(count > 0); return count;
  };
  const bevelCaps = []; let originalPlaneBindings = 0;
  for (let i = 2; i < index; i++) {
    assert.equal(snapshot.evidence[i].kind, 'chamfer'); const split = snapshot.evidence[i].native.split;
    assert.deepEqual(split.request.parent, ancestor); originalPlaneBindings += inherited(split);
    prove(split.positive.solid, 64); prove(split.negative.solid, 6144 - (i - 1) * 64);
    assert.equal(split.report.volumeMM3.conserved, true);
    const cap = split.lineage.faces.filter(f => f.side === 'negative' && f.role === 'cap'); assert.equal(cap.length, 1);
    bevelCaps.push(cap[0].output); ancestor = split.negative.solid;
  }
  assert.equal(bevelCaps.length, bevels); assert.deepEqual(native.request.parent, ancestor); originalPlaneBindings += inherited(native);
  prove(ancestor, negative + positive); assert.equal(negative + positive, 6144 - bevels * 64);
  const plane = native.request.cutter.model.objects.find(o => o.id === native.request.cutter.surfaceId);
  assert.deepEqual(plane.knotsU, [0,0,8,8]); assert.deepEqual(plane.knotsV, [0,0,32,32]);
  assert.deepEqual(plane.controlPoints, [[[0,at,0],[32,at-32,0]],[[0,at,8],[32,at-32,8]]]);
  for (const [side, volume, sign] of [['negative',negative,1n],['positive',positive,-1n]]) {
    const body = convexBody(snapshot,side); assert.equal(native[side].kind, 'solid'); assert.equal(body, native[side].solid); prove(body, volume);
    bounds(body, 0, side === 'negative' ? 0 : Math.max(0, at - 24), side === 'negative' ? Math.min(32, at) : 32);
    bounds(body, 1, 0, 24); bounds(body, 2, 0, 8);
    for (const vertex of body.graph.vertices) assert.ok(side === 'negative' ? vertex.pointMM[0] + vertex.pointMM[1] <= at : vertex.pointMM[0] + vertex.pointMM[1] >= at);
    const cap = native.lineage.faces.find(f => f.side === side && f.role === 'cap'); assert.ok(cap && !cap.parent);
    const support = body.supports.find(s => s.sourceId === cap.output.sourceId && s.faceId === cap.output.faceId);
    assert.ok(BigInt(support.outwardNormal[0].numerator) * sign > 0n);
    assert.deepEqual(support.outwardNormal[0], support.outwardNormal[1]); assert.equal(BigInt(support.outwardNormal[2].numerator), 0n);
    assert.deepEqual(native.report.volumeMM3[side], body.certificate.volumeMM3);
    for (const pair of native.lineage.capUses) assert.ok(body.graph.edges.some(e => e.uses.some(u => u.sourceId === pair[side].sourceId && u.use.id === pair[side].useId)));
    for (const originalCap of bevelCaps) assert.ok(native.lineage.faces.some(f => f.side === side && f.output && f.parent?.sourceId === originalCap.sourceId && f.parent?.faceId === originalCap.faceId));
  }
  assert.equal(native.report.status, 'split'); assert.equal(native.report.volumeMM3.conserved, true);
  assert.equal(native.section.kind, 'cycle'); assert.equal(native.section.dimension, 2);
  const capEdges = bevels ? 6 : 4; assert.equal(native.section.cycleNodeKeys.length, capEdges); assert.equal(native.lineage.capUses.length, capEdges);
  for (const node of native.section.nodes) assert.equal(node.pointMM[0] + node.pointMM[1], at);
  for (const pair of native.lineage.capUses) {
    const edges = ['negative','positive'].map(side => native.lineage.faces.find(f => f.side === side && f.role === 'cap').edges.find(e => e.useId === pair[side].useId));
    assert.deepEqual(edges[0].nodeKeys, [...edges[1].nodeKeys].reverse());
  }
  return { plane: 'x+y', at, negativeMM3: negative, positiveMM3: positive, parentMM3: negative + positive, capEdges, chamferAncestors: bevels, originalPlaneBindings, originalSourceLineage: true };
}
