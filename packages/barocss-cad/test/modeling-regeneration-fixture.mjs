import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prove } from './modeling-intersection-fixture.mjs';

export function regeneratingPart(cad) {
  const model = cad.model(), width = model.parameter('width', 32), height = model.parameter('height', 8);
  const frontDistance = model.parameter('frontDistance', 1), backDistance = model.parameter('backDistance', 2), backY = model.parameter('backY', 24);
  model.parameter('unused', 0);
  const blank = model.sketch.rectangle({ width, height: 24 }).extrude(height);
  const first = blank.chamfer(blank.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), frontDistance);
  const part = first.chamfer(first.edges({ parallelTo: 'x', at: { y: backY, z: 'max' } }).one(), backDistance);
  return { build: () => model.build({ part }) };
}

export function provePart(snapshot, width, height, front, back) {
  const original = width * 24 * height, removedFirst = width * front * front / 2, removedSecond = width * back * back / 2;
  const first = snapshot.evidence[2].native, second = snapshot.evidence[3].native;
  prove(first.split.request.parent, original); prove(first.split.negative.solid, original - removedFirst); prove(first.split.positive.solid, removedFirst);
  prove(second.split.negative.solid, original - removedFirst - removedSecond); prove(second.split.positive.solid, removedSecond);
  assert.deepEqual(second.split.request.parent, first.split.negative.solid);
  assert.equal(first.split.report.volumeMM3.conserved, true); assert.equal(second.split.report.volumeMM3.conserved, true);
  prove(convexBody(snapshot,'part'), original - removedFirst - removedSecond);
  return { originalMM3: original, firstRemovedMM3: removedFirst, secondRemovedMM3: removedSecond, finalMM3: original - removedFirst - removedSecond };
}

export function deepFrozen(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value); assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) deepFrozen(child, seen);
}

export function work(snapshot, reused, evaluated, previous) {
  assert.deepEqual(snapshot.recomputation, { reusedFeatures: reused, evaluatedFeatures: evaluated });
  assert.ok(Object.isFrozen(snapshot.recomputation) && Object.isFrozen(snapshot.recomputation.reusedFeatures) && Object.isFrozen(snapshot.recomputation.evaluatedFeatures));
  assert.deepEqual([...reused, ...evaluated], [0,1,2,3]);
  if (previous) {
    assert.notEqual(snapshot.evidence, previous.evidence); assert.notEqual(snapshot.parameters, previous.parameters);
    for (const i of reused) assert.equal(snapshot.evidence[i], previous.evidence[i]);
    for (const i of evaluated) assert.notEqual(snapshot.evidence[i], previous.evidence[i]);
    if (!evaluated.length) assert.equal(snapshot.bodies.part, previous.bodies.part);
  }
  deepFrozen(snapshot.bodies); deepFrozen(snapshot.evidence); deepFrozen(snapshot.parameters);
}

export function convexBody(snapshot,name) {
  const body=snapshot.bodies[name];assert.equal(body.family,'convex-planar');return body.native;
}

// Independent deterministic data hashing retains signed zeros; never used as geometry authority.
export function bodyHash(snapshot) {
  const text = value => typeof value === 'number' ? Object.is(value, -0) ? '-0' : JSON.stringify(value)
    : Array.isArray(value) ? '[' + value.map(text).join(',') + ']'
      : value !== null && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + text(value[k])).join(',') + '}'
        : JSON.stringify(value);
  return createHash('sha256').update(text(Object.fromEntries(Object.keys(snapshot.bodies).map(name=>[name,convexBody(snapshot,name)])))).digest('hex');
}
