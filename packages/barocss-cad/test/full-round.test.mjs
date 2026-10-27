import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, outputOf, massPropertiesOf, checkOutput, reevaluate, saveCadPart, loadCadPart, CadPartError } from '../dist/index.js';

// Full round (a face fillet). Expectations come from the inputs: a top W wide and L long rounded to a half
// cylinder of radius W/2 loses L·W²(4 − π)/8 mm³; nothing below the round changes.
const doc = (features, parameters = {}) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters, features });
const taken = (L, W) => L * W * W * (4 - Math.PI) / 8;
const plate = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'p', kind: 'extrude', sketch: 's', height: 4 }];
const volumeOf = (features, id, parameters) => massPropertiesOf(outputOf(evaluateCadPart(doc(features, parameters)), id)).volume;
const refused = (features, code, pattern) => assert.throws(() => evaluateCadPart(doc(features)), e => e instanceof CadPartError && e.code === code && pattern.test(e.message));

test('full round: a standalone wall\'s top becomes a half cylinder, its volume exact and its B-rep valid', () => {
  const wall = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 6] }, { id: 'w', kind: 'extrude', sketch: 's', height: 20 }];
  const snap = evaluateCadPart(doc([...wall, { id: 'fr', kind: 'full-round', target: 'w', faces: ['w.top'] }])), out = outputOf(snap, 'fr');
  const want = 40 * (6 * 17 + Math.PI * 9 / 2);
  assert.ok(Math.abs(massPropertiesOf(out).volume - want) <= 1e-9 * want, `volume ${massPropertiesOf(out).volume} vs ${want}`);
  const check = checkOutput(out); assert.equal(check.valid, true); assert.equal(check.counts.faces, 6);
  const names = out.brep.faces.map(f => f.name);
  assert.ok(names.includes('fr.round0')); assert.ok(!names.includes('w.top'), 'the top is gone');
  // The round meets the sides at z = 20 − 3 and reaches z = 20 only along its middle line (y = 3).
  const high = out.brep.vertices.map(v => v.point).filter(q => q[2] > 17 + 1e-9);
  assert.ok(high.length && high.every(q => Math.abs(q[2] - 20) <= 1e-12 && Math.abs(q[1] - 3) <= 1e-12), 'only the crest above the tangent height');
});

test('full round: a rib on a plate along X and along Y; the plate is untouched', () => {
  const alongX = [...plate, { id: 'r', kind: 'rib', target: 'p', min: [5, 12, 3], max: [35, 18, 20] }];
  const alongY = [...plate, { id: 'r', kind: 'rib', target: 'p', min: [17, 3, 3], max: [23, 27, 20] }];
  for (const [ribbed, L] of [[alongX, 30], [alongY, 24]]) {
    const before = volumeOf(ribbed, 'r'), after = volumeOf([...ribbed, { id: 'fr', kind: 'full-round', target: 'r', faces: ['r.top'] }], 'fr');
    assert.ok(Math.abs(before - after - taken(L, 6)) <= 1e-9 * before, `took ${before - after} vs ${taken(L, 6)}`);
  }
  // The longer side is the default; naming it gives the same body.
  const named = volumeOf([...alongY, { id: 'fr', kind: 'full-round', target: 'r', faces: ['r.top'], along: 'y' }], 'fr');
  assert.ok(Math.abs(named - volumeOf([...alongY, { id: 'fr', kind: 'full-round', target: 'r', faces: ['r.top'] }], 'fr')) <= 1e-9);
});

test('full round: two rib tops at once, each by its own width', () => {
  const two = [...plate, { id: 'a', kind: 'rib', target: 'p', min: [5, 4, 3], max: [35, 10, 20] }, { id: 'b', kind: 'rib', target: 'a', min: [5, 20, 3], max: [35, 24, 12] }];
  const before = volumeOf(two, 'b'), out = outputOf(evaluateCadPart(doc([...two, { id: 'fr', kind: 'full-round', target: 'b', faces: ['a.top', 'b.top'] }])), 'fr');
  assert.ok(Math.abs(before - massPropertiesOf(out).volume - taken(30, 6) - taken(30, 4)) <= 1e-9 * before);
  assert.deepEqual(out.brep.faces.map(f => f.name).filter(n => n.startsWith('fr.')).sort(), ['fr.round0', 'fr.round1']);
  assert.equal(checkOutput(out).valid, true);
});

test('full round: follows an upstream edit of the rib, and survives save and open', () => {
  const ribbed = [...plate, { id: 'r', kind: 'rib', target: 'p', min: [5, 12, 3], max: [35, { parameter: 'top' }, 20] }, { id: 'fr', kind: 'full-round', target: 'r', faces: ['r.top'] }];
  const snap = evaluateCadPart(doc(ribbed, { top: 18 })), wider = reevaluate(snap, { parameters: { top: 20 } });
  const ribOnly = (top) => volumeOf(ribbed.slice(0, 3), 'r', { top });
  assert.ok(Math.abs(ribOnly(20) - massPropertiesOf(outputOf(wider, 'fr')).volume - taken(30, 8)) <= 1e-9 * ribOnly(20), 'the 8 mm wide rib is rounded by r 4');
  const reopened = loadCadPart(saveCadPart(snap));
  assert.deepEqual(reopened.document, snap.document); assert.equal(massPropertiesOf(outputOf(reopened, 'fr')).volume, massPropertiesOf(outputOf(snap, 'fr')).volume);
});

test('full round: refused for faces it does not take, with the reason', () => {
  const ribbed = [...plate, { id: 'r', kind: 'rib', target: 'p', min: [5, 12, 3], max: [35, 18, 20] }];
  const on = (faces, extra = {}) => [...ribbed, { id: 'fr', kind: 'full-round', target: 'r', faces, ...extra }];
  refused(on(['r.side1']), 'CAPABILITY', /\[FULL_ROUND_FACE\] r\.side1 is not a planar face facing \+Z/);
  refused(on(['p.top']), 'CAPABILITY', /\[FULL_ROUND_FACE\] p\.top has holes/);
  refused(on(['nope']), 'REFERENCE', /no face nope/);
  // Across its 30 mm length the radius is 15: the 17 mm sides hold it; a rib standing 8 above the plate does not.
  const before = volumeOf(ribbed, 'r'); assert.ok(Math.abs(before - volumeOf(on(['r.top'], { along: 'y' }), 'fr') - taken(6, 30)) <= 1e-9 * before);
  const low = [...plate, { id: 'r', kind: 'rib', target: 'p', min: [5, 12, 3], max: [35, 18, 12] }, { id: 'fr', kind: 'full-round', target: 'r', faces: ['r.top'], along: 'y' }];
  refused(low, 'GEOMETRY', /\[FULL_ROUND_NOT_CLEAR\] the full round of r\.top/);
  // A plate 30 wide and 4 thick: the round would need 15 mm of side.
  refused([...plate, { id: 'fr', kind: 'full-round', target: 'p', faces: ['p.top'] }], 'GEOMETRY', /\[FULL_ROUND_NOT_CLEAR\]/);
  // Open sides: a rib standing 2 above the plate (the r 3 round would groove the plate), a neighbour 1 mm away.
  refused([...plate, { id: 'r', kind: 'rib', target: 'p', min: [5, 12, 3], max: [35, 18, 6] }, { id: 'fr', kind: 'full-round', target: 'r', faces: ['r.top'] }], 'GEOMETRY', /\[FULL_ROUND_NOT_CLEAR\] .*material stands beside it/);
  refused([...ribbed, { id: 'n', kind: 'rib', target: 'r', min: [5, 19, 3], max: [35, 21, 20] }, { id: 'fr', kind: 'full-round', target: 'n', faces: ['r.top'] }], 'GEOMETRY', /material stands beside it/);
  refused(on([]), 'INPUT', /faces must list 1 to 64 distinct face names/);
  refused(on(['r.top', 'r.top']), 'INPUT', /distinct/);
  refused(on(['r.top'], { along: 'z' }), 'INPUT', /along must be x or y/);
});
