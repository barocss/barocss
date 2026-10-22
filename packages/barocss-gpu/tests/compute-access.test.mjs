// G25b (G-R12), experimental compute: CNC4's access samples and the CPU mirror of the GPU pass's six rays a sample.
// Oracles: a box's every face is reached (share 0) — its own normal's direction leaves it; a box with a sealed cavity
// has the cavity's faces reached by none (share 1) and the outside's by their side; each sample's mask equals the
// kernel's rayHit along the same directions; the samples' areas add up to each triangle's area.
import test from 'node:test';
import assert from 'node:assert/strict';
import { triangleBvh, rayHit } from '@barocss/cad';
import { packBvh } from '../dist/compute/bvhPack.js';
import { ACCESS_DIRECTIONS, accessByTriangle, accessSampleSet, cpuAccessMasks } from '../dist/compute/access.js';

const BOX = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5];
function box(lo, hi, inward = false, base = 0) {
  const P = []; for (let i = 0; i < 8; i++) P.push(i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]);
  const I = []; for (let t = 0; t < 12; t++) { const a = BOX[3 * t] + base, b = BOX[3 * t + 1] + base, c = BOX[3 * t + 2] + base; I.push(...(inward ? [a, c, b] : [a, b, c])); }
  return { positions: P, indices: I };
}
const join = (...ms) => { const P = [], I = []; for (const m of ms) { const o = P.length / 3; P.push(...m.positions); I.push(...m.indices.map(i => i + o)); } return { positions: P, indices: I }; };
const area = (P, I, t) => { const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2], u = [0, 1, 2].map(k => P[b + k] - P[a + k]), v = [0, 1, 2].map(k => P[c + k] - P[a + k]); return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; };

test('a box: every face reached by its own direction; the samples\' areas the triangles\'', () => {
  const m = box([0, 0, 0], [40, 30, 8]), s = accessSampleSet(m.positions, m.indices, 2), bvh = packBvh(triangleBvh(m.positions, m.indices));
  const r = accessByTriangle(s, cpuAccessMasks(bvh, s));
  assert.ok(r.unreachedShare.every(x => x === 0), Array.from(r.unreachedShare).join(','));
  const sums = new Float64Array(s.triangles); for (let k = 0; k < s.count; k++) sums[s.triangle[k]] += s.area[k];
  for (let t = 0; t < s.triangles; t++) assert.ok(Math.abs(sums[t] - area(m.positions, m.indices, t)) < 1e-3, `triangle ${t}`);
  // (The top's samples are reached from +Z, and from the sides along it (side milling): ±X, ±Y.)
  assert.equal(r.mask[2] & (1 << 4), 1 << 4);
});

test('a sealed cavity: its faces reached by none (share 1); the outside reached; every mask as the kernel\'s rays', () => {
  const m = join(box([0, 0, 0], [40, 30, 20]), box([10, 10, 5], [30, 20, 15], true)), s = accessSampleSet(m.positions, m.indices, 2.5), kbvh = triangleBvh(m.positions, m.indices), bvh = packBvh(kbvh);
  const masks = cpuAccessMasks(bvh, s), r = accessByTriangle(s, masks);
  for (let t = 0; t < 12; t++) assert.equal(r.unreachedShare[t], 0, `outside ${t}`);
  for (let t = 12; t < 24; t++) assert.equal(r.unreachedShare[t], 1, `cavity ${t}`);
  for (let k = 0; k < s.count; k += 7) {
    let mask = 0; const o = [s.points[3 * k], s.points[3 * k + 1], s.points[3 * k + 2]];
    for (let d = 0; d < 6; d++) if (s.side[k] & (1 << d) && rayHit(kbvh, o, ACCESS_DIRECTIONS[d]) === Infinity) mask |= 1 << d;
    assert.equal(masks[k], mask, `sample ${k}`);
  }
});
