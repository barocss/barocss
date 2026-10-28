import test from 'node:test';
import assert from 'node:assert/strict';
import * as cad from '../dist/index.js';
import { stitchFreezing } from '../dist/brep/analytic-boolean.js';
import { chains, random } from '../scripts/rb/property.mjs';

// D283: the analytic Boolean's stitch takes far faces kept whole from its input instead of rebuilding them. Record order,
// an edge's direction and last digits may differ from the full rebuild; nothing else may. Each chain below is evaluated
// both ways and compared: validity, counts, face and edge names (as sets), volume and centroid.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });

/** A rounded plate (a B-rep, so every Boolean takes the analytic path) and a row of bosses and pockets. */
function plateChain(v) {
  const n = v.items.length, w = 10 * Math.ceil(n / 2) + 10;
  const f = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, 30] }, { id: 'p', kind: 'extrude', sketch: 's', height: 8 },
    { id: 'r', kind: 'fillet', target: 'p', edges: ['p.side0|p.top'], radius: 2 }];
  let last = 'r';
  v.items.forEach((it, k) => {
    const z0 = it.cut ? 8 - it.h / 2 : 8;
    f.push({ id: `c${k}s`, kind: 'sketch', profile: 'circle', plane: { origin: [0, 0, z0], normal: [0, 0, 1], xAxis: [1, 0, 0] }, center: [10 + 10 * Math.floor(k / 2), k % 2 ? 22 : 8], radius: it.r },
      { id: `c${k}`, kind: 'extrude', sketch: `c${k}s`, height: it.h }, { id: `b${k}`, kind: it.cut ? 'difference' : 'union', target: last, tool: `c${k}` });
    last = `b${k}`;
  });
  return { features: f, id: last };
}
/** Boxes turned about two axes cut into or added to a slab (planar, but off the binary64 plane: the analytic path). */
function tiltedChain(count, seed) {
  const rnd = random(seed), f = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [6 * count + 10, 60] }, { id: 'a', kind: 'extrude', sketch: 's', height: 40 }];
  let last = 'a';
  for (let k = 0; k < count; k++) {
    const x = 4 + 6 * k;
    f.push({ id: `t${k}s`, kind: 'sketch', profile: 'rectangle', min: [x, -10], max: [x + 2.5, 70] }, { id: `t${k}e`, kind: 'extrude', sketch: `t${k}s`, height: 60, from: -10 },
      { id: `t${k}r`, kind: 'rotate', target: `t${k}e`, axis: 'y', angle: 7 + 20 * rnd(), pivot: [x + 1, 30, 20] },
      { id: `t${k}`, kind: 'rotate', target: `t${k}r`, axis: 'x', angle: 11 + 10 * rnd(), pivot: [x + 1, 30, 20] },
      { id: `d${k}`, kind: k % 3 === 2 ? 'union' : 'difference', target: last, tool: `t${k}` });
    last = `d${k}`;
  }
  return { features: f, id: last };
}
function record(c, freeze) {
  stitchFreezing.on = freeze;
  try {
    const o = cad.outputOf(cad.evaluateCadPart(D(c.features)), c.id), b = o.brep, m = cad.brepMassProperties(b, 1);
    return { valid: cad.checkBrep(b, { strict: true }).valid, faces: b.faces.length, edges: b.edges.length, vertices: b.vertices.length,
      faceNames: b.faces.map(x => x.name).sort(), edgeNames: b.edges.map(x => x.name).sort(), volume: m.volume, centroid: m.centroid,
      bits: JSON.stringify(b) };
  } finally { stitchFreezing.on = true; }
}

test('D283: far faces frozen in the stitch give the full rebuild\'s solid — counts, names, volume and centroid', () => {
  const rnd = random(20261028), cases = [];
  for (let k = 0; k < 12; k++) cases.push(plateChain(chains.gen(rnd)));
  cases.push(plateChain({ items: Array.from({ length: 12 }, () => ({ r: 3, h: 6, cut: false })) }), tiltedChain(8, 3), tiltedChain(10, 5));
  let differed = 0;
  for (const c of cases) {
    const full = record(c, false), frozen = record(c, true), what = `${c.id} of ${c.features.length} features`;
    assert.equal(frozen.valid, true, `${what}: valid`);
    assert.deepEqual([frozen.faces, frozen.edges, frozen.vertices], [full.faces, full.edges, full.vertices], `${what}: counts`);
    assert.deepEqual(frozen.faceNames, full.faceNames, `${what}: face names`);
    assert.deepEqual(frozen.edgeNames, full.edgeNames, `${what}: edge names`);
    assert.ok(Math.abs(frozen.volume - full.volume) <= 1e-9 * Math.abs(full.volume), `${what}: volume ${frozen.volume} vs ${full.volume}`);
    assert.ok(Math.hypot(...frozen.centroid.map((x, i) => x - full.centroid[i])) <= 1e-7, `${what}: centroid`);
    if (frozen.bits !== full.bits) differed++;
  }
  // (The switch takes effect: on these chains most results are not the rebuild's to the bit.)
  assert.ok(differed >= 5, `${differed} results differ in their bits`);
});
