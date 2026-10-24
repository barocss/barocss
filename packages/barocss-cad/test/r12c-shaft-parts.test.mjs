import test from 'node:test';
import assert from 'node:assert/strict';
import { shaftSolid, keySolid, keywayCut, ringSolid, pinSolid, isShaftPartError, checkBrep, brepMassProperties, evaluateCadPart } from '../dist/index.js';
import { brepBounds } from '../dist/brep/brep-bounds.js';

// R12c.3b (D157): a key in its keyseat and the hub's keyway, a retaining ring in its groove, a pin in its cross hole.
// Oracles written here: the parts' volumes in closed form; the keyway's removal L·∫_{|v|≤b/2}((r + t2) − √(r² − v²))dv in
// closed form; the key's top clearance t1 + t2 − h (D139 S0: 6 high in 3.5 + 2.8 leaves 0.3) and its stand h − t1; the
// placements by the bounds. Sizes: D139's K1 (6 × 6, t1 3.5, t2 2.8 for shafts 17–22) and R1 (Ø19 × 1.30, ring 1.20 on
// Ø20) as test values; the fit rows below are test values flagged estimates.

const vol = brep => brepMassProperties(brep, 1, { quadratureSegments: 12 }).volumeMM3;
const near = (got, want, abs, what) => assert.ok(Math.abs(got - want) <= abs, `${what}: ${got} vs ${want}`);
const code = c => e => isShaftPartError(e) && e.code === c;
const I = { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const shaft = (ends = 'end-mill') => shaftSolid({ steps: [{ diameterMM: 20, lengthMM: 40, keyseats: [{ widthMM: 6, depthMM: 3.5, lengthMM: 18, offsetMM: 5, ends }], grooves: [{ diameterMM: 19, widthMM: 1.3, atMM: 30 }] }, { diameterMM: 25, lengthMM: 30 }], holes: [{ diameterMM: 4, atMM: 55 }] }, { id: 's' });
/** A hub: Ø40 outside, a Ø20 bore, 18 long from z 5 (over the seat). */
const hubBody = (dx = 0) => evaluateCadPart(D([{ id: 'o', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20, plane: { origin: [0, 0, 5], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'oe', kind: 'extrude', sketch: 'o', height: 18 },
  { id: 'b', kind: 'sketch', profile: 'circle', center: [dx, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'be', kind: 'extrude', sketch: 'b', height: 40 }, { id: 'h', kind: 'difference', target: 'oe', tool: 'be' }])).output('h').brep;
const FITS = [{ id: 'key-fits', rows: [{ class: 'N9', overMM: 3, upToMM: 6, upperUM: 0, lowerUM: -30, estimate: true }, { class: 'JS9', overMM: 3, upToMM: 6, upperUM: 15, lowerUM: -15, estimate: true }, { class: 'h9', overMM: 3, upToMM: 6, upperUM: 0, lowerUM: -30, estimate: true }] }];

test('R12c.3b key and hub keyway: a round-ended 6 × 6 × 18 key in the end-milled seat — (l − b)bh + π(b/2)²h; the keyway removes L·∫((r + t2) − √(r² − v²)); 2.5 above the shaft, 0.3 under the keyway\'s floor (S0)', () => {
  const s = shaft(), P = { report: s.report, place: I }, hub = hubBody(), r = 10, b = 6, t2 = 2.8, L = 18;
  const kw = keywayCut(hub, { face: 'be.side0', widthMM: b, depthMM: t2 }, 'kw');
  assert.equal(checkBrep(kw.brep).valid, true);
  // ∫_{−b/2}^{b/2} (r + t2) dv − ∫ √(r² − v²) dv, the latter (v√(r² − v²) + r² asin(v/r))/2 between the limits.
  const F = v => (v * Math.sqrt(r * r - v * v) + r * r * Math.asin(v / r)) / 2, removed = L * ((r + t2) * b - (F(b / 2) - F(-b / 2)));
  near(vol(hub) - vol(kw.brep), removed, 1e-6 * removed, 'keyway');
  assert.deepEqual([kw.report.floorRadiusMM, kw.report.fromMM, kw.report.toMM], [12.8, 0, 18]);
  assert.ok(kw.brep.faces.some(f => f.name.startsWith('kw.keyway')));
  const k = keySolid(P, { keyseat: 1, heightMM: 6, hub: kw.report }, 'k');
  assert.equal(checkBrep(k.brep).valid, true); assert.equal(k.report.ends, 'round');
  near(vol(k.brep), (18 - 6) * 6 * 6 + Math.PI * 9 * 6, 1e-9, 'round key');
  near(k.report.standsMM, 2.5, 1e-12, 'h − t1'); near(k.report.hub.topClearanceMM, 0.3, 1e-12, 't1 + t2 − h');
  assert.deepEqual([k.report.seatPlayMM, k.report.hub.keywayPlayMM, k.report.lengthRoomMM], [0, 0, 0]);
  const bb = brepBounds(k.brep);
  near(bb.min[0], 6.5, 1e-9, 'on the floor'); near(bb.max[0], 12.5, 1e-9, 'its top'); near(bb.min[2], 5, 1e-9, 'from the seat\'s start'); near(bb.max[2], 23, 1e-9, 'to its end');
});

test('R12c.3b key checks: KEY_FIT for a key too long, too wide, too high for the keyway, a keyway turned off the seat or off the axis; the width\'s fit by classes (R12c.2) at the seat\'s nominal width', () => {
  const P = { report: shaft().report, place: I }, kw = keywayCut(hubBody(), { face: 'be.side0', widthMM: 6, depthMM: 2.8 }, 'kw');
  assert.throws(() => keySolid(P, { keyseat: 1, heightMM: 6, lengthMM: 20 }, 'k'), code('KEY_FIT'));
  // A square-ended key in a round-ended seat has the straight part only: 12 mm.
  assert.throws(() => keySolid(P, { keyseat: 1, heightMM: 6, lengthMM: 14, ends: 'square' }, 'k'), e => code('KEY_FIT')(e) && /square ends/.test(e.message));
  assert.equal(keySolid(P, { keyseat: 1, heightMM: 6, lengthMM: 12, ends: 'square' }, 'k').report.lengthRoomMM, 0);
  assert.throws(() => keySolid(P, { keyseat: 1, heightMM: 6, widthMM: 6.02 }, 'k'), e => code('KEY_FIT')(e) && /model it at the seat's width and declare its width fit/.test(e.message));
  assert.throws(() => keySolid(P, { keyseat: 1, heightMM: 6.4, hub: kw.report }, 'k'), e => code('KEY_FIT')(e) && /reaches the keyway's floor/.test(e.message));
  assert.throws(() => keySolid(P, { keyseat: 1, heightMM: 6, hub: keywayCut(hubBody(), { face: 'be.side0', widthMM: 6, depthMM: 2.8, angleDeg: 90 }, 'kw').report }, 'k'), e => code('KEY_FIT')(e) && /not over keyseat 1 \(90° round/.test(e.message));
  assert.throws(() => keySolid(P, { keyseat: 1, heightMM: 6, hub: keywayCut(hubBody(0.5), { face: 'be.side0', widthMM: 6, depthMM: 2.8 }, 'kw').report }, 'k'), e => code('KEY_FIT')(e) && /not on the shaft's axis \(0\.5 mm off\)/.test(e.message));
  // N9 seat on an h9 key: transition (−0.03…+0.03); JS9 hub: transition (−0.015…+0.045), at the nominal 6. Classes take the
  // key at its seat's width: a 6.01 key with classes is refused (the classes carry the limits, R12c.2's rule).
  const fitted = keySolid(P, { keyseat: 1, heightMM: 6, hub: kw.report, fit: { tables: FITS, key: 'h9', seat: 'N9', hub: 'JS9' } }, 'k');
  assert.throws(() => keySolid(P, { keyseat: 1, heightMM: 6, widthMM: 6.01, fit: { tables: FITS, key: 'h9', seat: 'N9' } }, 'k'), e => code('KEY_FIT')(e) && /nominal width 6/.test(e.message));
  assert.deepEqual([fitted.report.seatFit.kind, fitted.report.seatFit.clearanceMinUM, fitted.report.seatFit.clearanceMaxUM], ['transition', -30, 30]);
  assert.deepEqual([fitted.report.hubFit.kind, fitted.report.hubFit.clearanceMinUM, fitted.report.hubFit.clearanceMaxUM], ['transition', -15, 45]);
  assert.throws(() => keySolid(P, { keyseat: 2, heightMM: 6 }, 'k'), code('INVALID_INPUT'));
});

test('R12c.3b retaining ring: an envelope 1.2 thick from the groove\'s Ø19 to Ø24, centred in the 1.3 groove — π(R_o² − r_g²)s; the user\'s row checked; RING_FIT', () => {
  const P = { report: shaft().report, place: I }, row = { shaftDiameterMM: 20, grooveDiameterMM: 19, grooveWidthMM: 1.3, source: 'R1' };
  const r = ringSolid(P, { groove: 1, thicknessMM: 1.2, outerDiameterMM: 24, row }, 'r');
  assert.equal(checkBrep(r.brep).valid, true);
  near(vol(r.brep), Math.PI * (144 - 90.25) * 1.2, 1e-9, 'ring');
  const bb = brepBounds(r.brep); near(bb.min[2], 30.05, 1e-9, 'centred'); near(bb.max[2], 31.25, 1e-9, 'centred');
  assert.deepEqual([r.report.axialPlayMM.toFixed(9), r.report.estimate, r.report.source], ['0.100000000', false, 'R1']);
  assert.equal(ringSolid(P, { groove: 1, thicknessMM: 1.2, outerDiameterMM: 24 }, 'r').report.estimate, true, 'no row: an estimate');
  assert.throws(() => ringSolid(P, { groove: 1, thicknessMM: 1.4, outerDiameterMM: 24 }, 'r'), code('RING_FIT'));
  assert.throws(() => ringSolid(P, { groove: 1, thicknessMM: 1.2, outerDiameterMM: 24, row: { ...row, shaftDiameterMM: 22 } }, 'r'), e => code('RING_FIT')(e) && /row is for a Ø22 shaft; step 1 is Ø20/.test(e.message));
  assert.throws(() => ringSolid(P, { groove: 1, thicknessMM: 1.2, outerDiameterMM: 24, row: { ...row, grooveWidthMM: 1.1 } }, 'r'), code('RING_FIT'));
  assert.throws(() => ringSolid(P, { groove: 1, thicknessMM: 1.2, outerDiameterMM: 24, row: { shaftDiameterMM: 20 } }, 'r'), code('INVALID_INPUT'));
});

test('R12c.3b pin: Ø4 through the Ø25 step along Y, flush — π(d/2)²L; a bigger pin needs declared fit classes (PIN_FIT)', () => {
  const P = { report: shaft().report, place: I }, p = pinSolid(P, { hole: 1 }, 'p');
  assert.equal(checkBrep(p.brep).valid, true); near(vol(p.brep), Math.PI * 4 * 25, 1e-9, 'pin');
  const bb = brepBounds(p.brep); near(bb.min[1], -12.5, 1e-9, 'along Y'); near(bb.max[1], 12.5, 1e-9, 'flush'); near((bb.min[2] + bb.max[2]) / 2, 55, 1e-9, 'at the hole');
  assert.ok(p.brep.faces.some(f => f.name.startsWith('p.side0')), 'its cylinder named for a fit class');
  assert.throws(() => pinSolid(P, { hole: 1, diameterMM: 4.01 }, 'p'), code('PIN_FIT'));
  assert.equal(pinSolid(P, { hole: 1, diameterMM: 4.01, fit: true }, 'p').report.clearanceMM.toFixed(6), '-0.010000');
});

test('R12c.3b part model: a shaft turned and moved, its key, a hub with its keyway, a ring and a pin — the parts follow the shaft; the checks mapped with their codes', () => {
  const feats = [
    { id: 's', kind: 'shaft', steps: [{ diameter: 20, length: 40, keyseats: [{ width: 6, depth: 3.5, length: 18, offset: 5 }], grooves: [{ diameter: 19, width: 1.3, at: 30 }] }, { diameter: 25, length: 30 }], holes: [{ diameter: 4, at: 55 }], center: [50, 0], from: 10, rotation: 90 },
    { id: 'o', kind: 'sketch', profile: 'circle', center: [50, 0], radius: 20, plane: { origin: [0, 0, 15], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'oe', kind: 'extrude', sketch: 'o', height: 18 },
    { id: 'bs', kind: 'sketch', profile: 'circle', center: [50, 0], radius: 10, plane: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'be', kind: 'extrude', sketch: 'bs', height: 60 },
    { id: 'hb', kind: 'difference', target: 'oe', tool: 'be' },
    { id: 'kw', kind: 'keyway', target: 'hb', face: 'be.side0', width: 6, depth: 2.8, angle: 90 },
    { id: 'k', kind: 'key', shaft: 's', keyseat: 1, height: 6, hub: 'kw' },
    { id: 'r', kind: 'retaining-ring', shaft: 's', groove: 1, thickness: 1.2, outerDiameter: 24, row: { shaftDiameter: 20, grooveDiameter: 19, estimate: true } },
    { id: 'p', kind: 'pin', shaft: 's', hole: 1 }];
  const snap = evaluateCadPart(D(feats));
  const k = snap.output('k'), r = snap.output('r'), p = snap.output('p'), kw = snap.output('kw');
  near(k.key.hub.topClearanceMM, 0.3, 1e-12, 'clearance'); assert.equal(r.ring.estimate, true); assert.equal(p.pin.lengthMM, 25); assert.equal(kw.keyway.angleDeg, 90);
  // Turned 90° about Z and moved to (50, 0, 10): the key on +Y at 6.5–12.5 from the axis, z 15–33.
  const kb = brepBounds(k.brep); near(kb.min[1], 6.5, 1e-9, 'key on +Y'); near(kb.min[2], 15, 1e-9, 'key z'); near((kb.min[0] + kb.max[0]) / 2, 50, 1e-9, 'key x');
  const pb = brepBounds(p.brep); near(pb.min[0], 50 - 12.5, 1e-9, 'pin along X now'); near((pb.min[2] + pb.max[2]) / 2, 65, 1e-9, 'pin z');
  assert.ok(snap.outputs.some(o => o.id === 's'), 'the shaft is still an output');
  const refused = (patch, c, tag) => assert.throws(() => evaluateCadPart(D(feats.map(f => f.id === patch.id ? { ...f, ...patch } : f))), e => e.code === c && e.message.includes(`[${tag}]`), tag);
  refused({ id: 'k', height: 6.4 }, 'GEOMETRY', 'KEY_FIT');
  refused({ id: 'kw', angle: 0 }, 'GEOMETRY', 'KEY_FIT');
  refused({ id: 'r', thickness: 1.4 }, 'GEOMETRY', 'RING_FIT');
  refused({ id: 'p', diameter: 4.5 }, 'GEOMETRY', 'PIN_FIT');
  assert.throws(() => evaluateCadPart(D([...feats, { id: 'x', kind: 'key', shaft: 'hb', keyseat: 1, height: 6 }])), e => e.code === 'REFERENCE');
});
