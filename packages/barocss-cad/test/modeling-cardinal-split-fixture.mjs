import assert from 'node:assert/strict';
export { prove } from './modeling-intersection-fixture.mjs';

export function cardinalPart(cad, { axis = 'x', at = 16, rectangle = false, mode = 'both' } = {}) {
  const model = cad.model(), splitAt = model.parameter('splitAt', at), rearX = model.parameter('rearX', 16);
  const height = model.parameter('height', rectangle ? 3 : 8);
  const points = rectangle ? [[1,2],[1,7],[4,7],[4,2]] : [[-0,0],[32,0],[32,16],[rearX,32],[0,32]];
  const blank = model.sketch.polygon(points).extrude(height), parts = blank.split({ axis, at: splitAt });
  const outputs = mode === 'negative' ? { negative: parts.negative } : mode === 'positive' ? { positive: parts.positive } : parts;
  return { model, blank, parts, build: () => model.build(outputs) };
}

export function bounds(solid, axis, min, max) {
  const values = solid.graph.vertices.map(v => v.pointMM[axis]);
  assert.equal(Math.min(...values), min); assert.equal(Math.max(...values), max);
  assert.ok(values.every(v => v >= min && v <= max));
}

export function capPair(native, axis) {
  assert.equal(native.report.status, 'split'); assert.equal(native.report.volumeMM3.conserved, true);
  assert.equal(native.section.kind, 'cycle'); assert.equal(native.section.dimension, 2);
  assert.equal(native.section.cycleNodeKeys.length, 4); assert.equal(native.lineage.capUses.length, 4);
  const caps = native.lineage.faces.filter(face => face.role === 'cap'); assert.equal(caps.length, 2);
  for (const [side, sign] of [['negative', 1n], ['positive', -1n]]) {
    const cap = caps.find(f => f.side === side), solid = native[side].solid;
    const support = solid.supports.find(s => s.sourceId === cap.output.sourceId && s.faceId === cap.output.faceId);
    for (let i = 0; i < 3; i++) {
      const n = BigInt(support.outwardNormal[i].numerator);
      if (i === axis) assert.ok(n * sign > 0n); else assert.equal(n, 0n);
    }
    for (const pair of native.lineage.capUses) assert.ok(solid.graph.edges.some(edge => edge.uses.some(use => use.sourceId === pair[side].sourceId && use.use.id === pair[side].useId)));
  }
}
