import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, isoThreadRadius, checkBrep, CadPartError, CadPartLimits, exportStep, threadSolid, brepMassProperties } from '../dist/index.js';

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

test('a modelled M8 bolt round-trips through STEP: the export reopens with the same volume, faces and names', () => {
  const bolt = evaluateCadPart(D([{ id: 'b', kind: 'thread', diameter: 8, pitch: 1.25, length: 30, center: [0, 0], seat: 0, hex: { across: 13, height: 5.3 } }])).outputs[0];
  const step = exportStep([bolt.brep], { name: 'bolt' });
  // (Over the part document's 4 MiB, within the STEP import's 32 MiB.)
  assert.ok(step.length > CadPartLimits.fileBytes && step.length <= CadPartLimits.stepBytes, `${step.length}`);
  const back = evaluateCadPart(D([{ id: 'i', kind: 'import', step }])).outputs[0];
  assert.equal(checkBrep(back.brep).issues.length, 0);
  assert.equal(back.brep.faces.length, bolt.brep.faces.length);
  const v0 = bolt.massProperties(1).volumeMM3, v1 = back.massProperties(1).volumeMM3;
  assert.ok(Math.abs(v1 - v0) <= 1e-9 * v0, `${v1} vs ${v0}`);
  // The faces keep their names, under the import's id.
  const names = b => b.faces.map(f => f.name).sort();
  assert.deepEqual(names(back.brep), names(bolt.brep).map(n => `i.${n}`).sort());
});

test('helical threads (internal form): a bolt and a nut of B-spline faces, watertight, nearer the exact volume than the facets', () => {
  const meanR2 = (d, P, clear = 0) => { let s = 0; const n = 100000; for (let i = 0; i < n; i++) s += (isoThreadRadius(d, P, (i + 0.5) / n) + clear) ** 2; return s / n; };
  const hexArea = s => s * s * Math.sqrt(3) / 2;
  const bolt = threadSolid({ id: 'b', diameter: 8, pitch: 1.25, length: 24, hex: { across: 13, height: 5.3 }, form: 'helical' });
  const nut = threadSolid({ id: 'n', diameter: 8, pitch: 1.25, hex: { across: 13, height: 6.8, internal: true }, form: 'helical' });
  for (const [b, exact] of [[bolt, Math.PI * 24 * meanR2(8, 1.25) + hexArea(13) * 5.3], [nut, (hexArea(13) - Math.PI * meanR2(8, 1.25, 0.04)) * 6.8]]) {
    assert.equal(checkBrep(b).issues.length, 0);
    assert.ok(b.faces.length < 200, `${b.faces.length} faces`);
    // Quarter-turn cubic spans: within 3e-4 of the exact ISO-profile volume (the facets: about 2e-3).
    const v = brepMassProperties(b, 1).volumeMM3;
    assert.ok(Math.abs(v - exact) <= 3e-4 * exact, `${v} vs ${exact}`);
  }
  assert.deepEqual(bolt.faces.filter(f => !/\.thread#/.test(f.name)).map(f => f.name).sort(), ['b.end', 'b.head', 'b.hex0', 'b.hex1', 'b.hex2', 'b.hex3', 'b.hex4', 'b.hex5', 'b.seat']);
});

test('thread form: documents without one stay faceted (their .facetK names resolve); helical is chosen by name, and threadSolid defaults to it', () => {
  const doc = form => D([{ id: 'b', kind: 'thread', diameter: 8, pitch: 1.25, length: 16, hex: { across: 13, height: 5.3 }, ...(form ? { form } : {}) }]);
  const old = evaluateCadPart(doc()).outputs[0].brep, helical = evaluateCadPart(doc('helical')).outputs[0].brep;
  assert.ok(old.faces.every(f => /^b\.facet\d+$/.test(f.name)), 'left out: faceted names');
  assert.deepEqual(evaluateCadPart(doc('faceted')).outputs[0].brep.faces.map(f => f.name), old.faces.map(f => f.name));
  const names = new Set(helical.faces.map(f => f.name.replace(/#\d+$/, '')));
  assert.deepEqual([...names].sort(), ['b.end', 'b.head', 'b.hex0', 'b.hex1', 'b.hex2', 'b.hex3', 'b.hex4', 'b.hex5', 'b.seat', 'b.thread']);
  assert.deepEqual(threadSolid({ id: 'b', diameter: 8, pitch: 1.25, length: 16, hex: { across: 13, height: 5.3 } }).faces.map(f => f.name), helical.faces.map(f => f.name));
  assert.throws(() => evaluateCadPart(doc('smooth')), e => e instanceof CadPartError && /form must be/.test(e.message));
});
