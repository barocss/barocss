import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, isoThreadRadius, checkBrep, CadPartError } from '../dist/index.js';

const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
/** π · length · the mean of r² over a pitch: the volume of the exact (unfaceted) threaded rod. */
const exactRod = (d, p, length) => { let s = 0; const n = 20000; for (let k = 0; k < n; k++) s += isoThreadRadius(d, p, (k + 0.5) / n) ** 2; return Math.PI * length * s / n; };

test('the ISO 68-1 basic profile: crest P/8 at the major diameter, root P/4 at d − 5H/4, 60° flanks', () => {
  const H = Math.sqrt(3) / 2 * 1.25;
  assert.equal(isoThreadRadius(8, 1.25, 0), 4); assert.equal(isoThreadRadius(8, 1.25, 1 / 16), 4);
  assert.ok(Math.abs(isoThreadRadius(8, 1.25, 0.5) - (4 - 5 * H / 8)) < 1e-12);
  // The flank falls 5H/8 over 0.3125 P along: tan 30° of the depth, a 60° thread.
  assert.ok(Math.abs((4 - (4 - 5 * H / 8)) / (0.3125 * 1.25) - Math.sqrt(3)) < 1e-12);
});

test('modelled threads: a rod, a hex head bolt and a hex nut, each one valid faceted solid of the right volume', () => {
  const rod = evaluateCadPart(D([{ id: 'r', kind: 'thread', diameter: 8, pitch: 1.25, length: 20 }])).outputs[0];
  assert.deepEqual(checkBrep(rod.brep).issues, []);
  const v = rod.massProperties(1).volumeMM3, want = exactRod(8, 1.25, 20);
  assert.ok(Math.abs(v - want) / want < 0.01, `${v} vs ${want} (faceting within 1%)`);
  const bolt = evaluateCadPart(D([{ id: 'b', kind: 'thread', diameter: 8, pitch: 1.25, length: 30, center: [5, 6], seat: 10, hex: { across: 13, height: 5.3 } }])).outputs[0];
  const bb = bolt.massProperties(1), hexArea = Math.sqrt(3) / 2 * 13 * 13;
  assert.ok(Math.abs(bb.volumeMM3 - (exactRod(8, 1.25, 30) + hexArea * 5.3)) / bb.volumeMM3 < 0.01);
  assert.ok(Math.abs(bb.centroidMM[0] - 5) < 0.05 && Math.abs(bb.centroidMM[1] - 6) < 0.05);
  const nut = evaluateCadPart(D([{ id: 'n', kind: 'thread', diameter: 8, pitch: 1.25, hex: { across: 13, height: 6.8, internal: true } }])).outputs[0];
  assert.deepEqual(checkBrep(nut.brep).issues, []);
  // Hex less a bore slightly wider than the rod's thread (the clearance).
  const nv = nut.massProperties(1).volumeMM3, bore = exactRod(8.08, 1.25, 6.8);
  assert.ok(nv > hexArea * 6.8 - exactRod(8, 1.25, 6.8) - 10 && nv < hexArea * 6.8 - bore * 0.97, String(nv));
  assert.throws(() => evaluateCadPart(D([{ id: 'x', kind: 'thread', diameter: 8, pitch: 5, length: 10 }])), e => e instanceof CadPartError && /pitch below half/.test(e.message));
});
