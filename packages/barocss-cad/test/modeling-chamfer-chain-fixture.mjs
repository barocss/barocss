import { convexBody } from './modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { prove } from './modeling-intersection-fixture.mjs';
export { prove };

export function chamferPart(cad) {
  const model = cad.model(), frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2), backY = model.parameter('backY', 24);
  const blank = model.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
  const front = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
  const part = front.chamfer(front.edges({ parallelTo: 'x', at: { y: backY, z: 'max' } }).one(), backDistance);
  return { model, blank, front, part, build: () => model.build({ part }) };
}

export function chainProof(snapshot, frontRemoved, backRemoved, volume) {
  const first = snapshot.evidence[2].native, second = snapshot.evidence[3].native;
  assert.deepEqual(snapshot.features.map(f => ({ kind: f.kind, dependencies: f.dependencies })), [
    { kind: 'sketch', dependencies: [] }, { kind: 'extrude', dependencies: [0] },
    { kind: 'chamfer', dependencies: [1] }, { kind: 'chamfer', dependencies: [2] },
  ]);
  assert.equal(first.request.selection.parentSolidId, snapshot.evidence[1].native.solid.report.solidId);
  assert.equal(second.request.selection.parentSolidId, first.split.negative.solid.report.solidId);
  assert.deepEqual(second.split.request.parent, first.split.negative.solid);
  prove(first.split.request.parent, 6144); prove(first.split.negative.solid, 6144 - frontRemoved); prove(first.split.positive.solid, frontRemoved);
  prove(second.split.negative.solid, volume); prove(second.split.positive.solid, backRemoved); prove(convexBody(snapshot,'part'), volume);
  assert.deepEqual(convexBody(snapshot,'part'), second.split.negative.solid);
  assert.deepEqual(first.metric.removedVolumeMM3, { numerator: String(frontRemoved), denominator: '1' });
  assert.deepEqual(second.metric.removedVolumeMM3, { numerator: String(backRemoved), denominator: '1' });
  assert.equal(first.split.report.volumeMM3.conserved, true); assert.equal(second.split.report.volumeMM3.conserved, true);
  assert.equal(volume + frontRemoved + backRemoved, 6144);
  return { originalMM3: 6144, firstRemovedMM3: frontRemoved, firstRetainedMM3: 6144 - frontRemoved, secondRemovedMM3: backRemoved, finalMM3: volume,
    firstParentSolidId: first.request.selection.parentSolidId, secondParentSolidId: second.request.selection.parentSolidId,
    nativeWork: [first.report.nativeWork, second.report.nativeWork] };
}
