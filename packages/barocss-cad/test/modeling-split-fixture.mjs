import assert from 'node:assert/strict';
export { prove } from './modeling-intersection-fixture.mjs';

export function splitPart(cad, { level = 2, height = 8, mode = 'both', chamfer = false, rectangle = false } = {}) {
  const model = cad.model(), heightParameter = model.parameter('height', height), splitHeight = model.parameter('splitHeight', level);
  const points = rectangle ? [[1, 2], [1, 7], [4, 7], [4, 2]] : [[-0, 0], [32, 0], [32, 16], [16, 32], [0, 32]];
  const blank = model.sketch.polygon(points).extrude(heightParameter);
  const halves = blank.split({ axis: 'z', at: splitHeight });
  const lower = chamfer ? halves.negative.chamfer(halves.negative.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one(), 1) : halves.negative;
  const outputs = mode === 'upper' ? { upper: halves.positive } : mode === 'lower' ? { lower } : { lower, upper: halves.positive };
  return { model, blank, halves, build: () => model.build(outputs) };
}

export function zBounds(solid, min, max) {
  const values = solid.graph.vertices.map(vertex => vertex.pointMM[2]);
  assert.equal(Math.min(...values), min); assert.equal(Math.max(...values), max);
  assert.ok(values.every(value => value >= min && value <= max));
}

export function capPair(native, count) {
  assert.equal(native.report.status, 'split'); assert.equal(native.report.volumeMM3.conserved, true);
  assert.equal(native.section.kind, 'cycle'); assert.equal(native.section.dimension, 2);
  assert.equal(native.section.cycleNodeKeys.length, count); assert.equal(native.lineage.capUses.length, count);
  const caps = native.lineage.faces.filter(face => face.role === 'cap');
  assert.equal(caps.length, 2);
  for (const [side, sign] of [['negative', 1n], ['positive', -1n]]) {
    const cap = caps.find(face => face.side === side), solid = native[side].solid;
    const support = solid.supports.find(s => s.sourceId === cap.output.sourceId && s.faceId === cap.output.faceId);
    assert.equal(BigInt(support.outwardNormal[0].numerator), 0n); assert.equal(BigInt(support.outwardNormal[1].numerator), 0n);
    assert.ok(BigInt(support.outwardNormal[2].numerator) * sign > 0n);
    for (const pair of native.lineage.capUses) assert.ok(solid.graph.edges.some(edge => edge.uses.some(use => use.sourceId === pair[side].sourceId && use.use.id === pair[side].useId)));
  }
}
