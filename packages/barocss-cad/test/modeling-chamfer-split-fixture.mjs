import assert from 'node:assert/strict';
import { prove } from './modeling-intersection-fixture.mjs';
import { bounds } from './modeling-cardinal-split-fixture.mjs';
import { deepFrozen, bodyHash } from './modeling-regeneration-fixture.mjs';
export { bodyHash };

export function dividedRail(cad, { axis = 'x', at = 16, bevels = 2 } = {}) {
  const model = cad.model(), frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2), splitAt = model.parameter('splitAt', at);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
  const finished = bevels === 2 ? front.chamfer(front.edges({ parallelTo: 'x', at: { y: 24, z: 'max' } }).one(), backDistance) : front;
  const parts = finished.split({ axis, at: splitAt });
  return { model, parts, build: () => model.build({ negative: parts.negative, positive: parts.positive }) };
}

export function work(snapshot, reused, evaluated, previous) {
  assert.deepEqual(snapshot.recomputation, { reusedFeatures: reused, evaluatedFeatures: evaluated });
  assert.deepEqual([...reused,...evaluated], snapshot.features.map(f => f.index));
  deepFrozen(snapshot.bodies); deepFrozen(snapshot.evidence); deepFrozen(snapshot.recomputation);
  if (previous) {
    assert.notEqual(snapshot.evidence, previous.evidence);
    for (const i of reused) assert.equal(snapshot.evidence[i], previous.evidence[i]);
    for (const i of evaluated) assert.notEqual(snapshot.evidence[i], previous.evidence[i]);
  }
}

export function proveSplit(snapshot, axis, at, negative, positive, capEdges) {
  const index = snapshot.features.length - 1, native = snapshot.evidence[index].native;
  const chamfer = snapshot.evidence[index - 1].native, parent = native.request.parent;
  assert.equal(snapshot.features[index].kind, 'split'); assert.deepEqual(snapshot.features[index].dependencies, [index - 1]);
  assert.deepEqual(parent, chamfer.split.negative.solid); prove(parent, negative + positive);
  const inheritedPlanes = split => {
    let bindings = 0;
    for (const lineage of split.lineage.faces.filter(f => f.parent && f.output)) {
      const before = split.request.parent.request.assets.find(a => a.sourceId === lineage.parent.sourceId && a.face.options.faceId === lineage.parent.faceId);
      const after = split[lineage.side].solid.request.assets.find(a => a.sourceId === lineage.output.sourceId && a.face.options.faceId === lineage.output.faceId);
      assert.ok(before && after); assert.equal(after.sourceId, before.sourceId);
      assert.equal(after.face.options.faceId, before.face.options.faceId);
      assert.equal(after.face.loop.id, before.face.loop.id); assert.deepEqual(after.face.plane, before.face.plane);
      for (const asset of [before, after]) {
        assert.deepEqual(asset.face.model.objects.find(o => o.id === asset.face.plane.id), asset.face.plane);
        assert.ok(asset.face.source.includes('@surface #' + asset.face.plane.id));
      }
      bindings++;
    }
    assert.ok(bindings > 0); return bindings;
  };
  let ancestor = snapshot.evidence[1].native.solid, originalPlaneBindings = 0;
  const bevelCaps = [];
  for (let i = 2; i < index; i++) {
    assert.equal(snapshot.evidence[i].kind, 'chamfer');
    const split = snapshot.evidence[i].native.split;
    assert.deepEqual(split.request.parent, ancestor); originalPlaneBindings += inheritedPlanes(split);
    const cap = split.lineage.faces.filter(f => f.side === 'negative' && f.role === 'cap'); assert.equal(cap.length, 1);
    bevelCaps.push(cap[0].output); ancestor = split.negative.solid;
  }
  assert.deepEqual(parent, ancestor); originalPlaneBindings += inheritedPlanes(native);
  const a = ['x','y','z'].indexOf(axis), max = [32,24,8][a];
  for (const [side, volume, low, high] of [['negative',negative,0,at],['positive',positive,at,max]]) {
    assert.equal(native[side].kind, 'solid'); assert.equal(snapshot.bodies[side], native[side].solid);
    prove(snapshot.bodies[side], volume); bounds(snapshot.bodies[side], a, low, high);
  }
  assert.equal(native.report.status, 'split'); assert.equal(native.report.volumeMM3.conserved, true);
  assert.deepEqual(native.report.volumeMM3.parent, { numerator: String(negative + positive), denominator: '1' });
  assert.equal(native.section.kind, 'cycle'); assert.equal(native.section.dimension, 2);
  assert.equal(native.section.cycleNodeKeys.length, capEdges); assert.equal(native.lineage.capUses.length, capEdges);
  const caps = native.lineage.faces.filter(f => f.role === 'cap'); assert.equal(caps.length, 2);
  for (const [side, sign] of [['negative',1n],['positive',-1n]]) {
    const cap = caps.find(f => f.side === side), solid = native[side].solid;
    const support = solid.supports.find(s => s.sourceId === cap.output.sourceId && s.faceId === cap.output.faceId);
    for (let i = 0; i < 3; i++) { const n = BigInt(support.outwardNormal[i].numerator); if (i === a) assert.ok(n * sign > 0n); else assert.equal(n, 0n); }
    for (const pair of native.lineage.capUses) assert.ok(solid.graph.edges.some(edge => edge.uses.some(use => use.sourceId === pair[side].sourceId && use.use.id === pair[side].useId)));
  }
  for (const pair of native.lineage.capUses) {
    const uses = ['negative','positive'].map(side => caps.find(f => f.side === side).edges.find(e => e.useId === pair[side].useId));
    assert.deepEqual(uses[0].nodeKeys, [...uses[1].nodeKeys].reverse());
  }
  for (const face of native.lineage.faces.filter(f => f.parent)) {
    assert.ok(parent.graph.faces.some(f => f.sourceId === face.parent.sourceId && f.faceId === face.parent.faceId && f.surfaceId === face.parent.surfaceId && f.loopId === face.parent.loopId));
    if (face.output) assert.ok(native[face.side].solid.graph.faces.some(f => f.sourceId === face.output.sourceId && f.faceId === face.output.faceId));
  }
  for (const cap of bevelCaps) assert.ok(native.lineage.faces.some(f => f.output && f.parent?.sourceId === cap.sourceId && f.parent?.faceId === cap.faceId));
  return { axis, at, negativeMM3: negative, positiveMM3: positive, parentMM3: negative + positive, capEdges, exactChamferParent: true, originalSourceLineage: true, chamferAncestors: bevelCaps.length, originalPlaneBindings };
}
