import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, booleanAnalytic, brepMassProperties } from '../dist/index.js';

const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 };
const run = features => evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const volume = out => out.massProperties(1).volumeMM3;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)), `${label}: ${actual} vs ${expected}`);
function frame(box = false, transform = p => p) {
  const points = [[0, 0, 0], [400, 0, 0], [400, 300, 0], [0, 300, 0], [0, 0, 300], [400, 0, 300], [400, 300, 300], [0, 300, 300]];
  const segments = [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]];
  if (box) segments.push([0, 1], [1, 2], [2, 3], [3, 0]);
  return { id: 'f', kind: 'frame', points: points.map(transform), segments, section: SHARP, corners: { multi: 'order' } };
}
const bead = (member, end) => ({ id: `w${member}${end}`, kind: 'weld-bead', frame: 'f', on: { member, end }, leg: 3 });
function union(breps) { return breps.slice(1).reduce((body, next) => booleanAnalytic(body, next, 'union'), breps[0]); }

test('A9 opted-in ordered table: eight owned 270 mm3 beads, nominal 2880 mm3, without material overlap', () => {
  const ends = [4, 5, 6, 7].flatMap(k => ['start', 'end'].map(end => bead(k, end)));
  const sharing = { version: 1, policy: 'equal-length', joints: ends.map(e => ({ ...e.on, leg: e.leg })) };
  const snapshot = run([frame(), ...ends.map(e => ({ ...e, sharing }))]), members = snapshot.outputs.filter(o => o.member), beads = snapshot.outputs.filter(o => o.bead);
  const centroids = [
    [21, 7, 280 + 8 / 3], [379, 7, 280 + 8 / 3],
    [393, 21, 280 + 28 / 3], [393, 279, 280 + 8 / 3],
    [379, 293, 280 + 28 / 3], [21, 293, 280 + 8 / 3],
    [7, 279, 280 + 28 / 3], [7, 21, 280 + 28 / 3],
  ];
  assert.equal(beads.length, 8);
  let sum = 0;
  for (const out of beads) {
    assert.ok(out.validate().valid);
    near(volume(out), 270, out.id);
    near(out.bead.volumeMM3, 270, `${out.id} report`);
    near(out.bead.nominalVolumeMM3, 360, `${out.id} nominal`);
    assert.deepEqual(out.bead.seam, { lengthMM: 160, flushMM: 80, exact: true });
    assert.equal(out.bodyCount, 2);
    // Both actual supports matter: the leg and the adjacent rail, not the nominal `with` alone.
    assert.equal(out.bead.meets.length, 2);
    assert.ok(out.bead.meets.some(k => k < 4) && out.bead.meets.some(k => k >= 4));
    out.massProperties(1).centroidMM.forEach((v, k) => near(v, centroids[beads.indexOf(out)][k], `${out.id} centroid ${k}`));
    for (const member of members) assert.equal(booleanAnalytic(out.brep, member.brep, 'intersection').bodies.length, 0, `${out.id} overlaps member ${member.member.frame.member}`);
    sum += volume(out);
  }
  near(sum, 2160, 'eight owned bead volumes');
  near(beads.reduce((s, o) => s + o.bead.nominalVolumeMM3, 0), 2880, 'nominal requests');
  assert.equal(new Set(beads.flatMap(o => o.bead.sharedSeams.map(s => s.id))).size, 4);
  for (let a = 0; a < beads.length; a++) for (let b = a + 1; b < beads.length; b++) assert.equal(booleanAnalytic(beads[a].brep, beads[b].brep, 'intersection').bodies.length, 0, `${beads[a].id}/${beads[b].id}`);
  const welded = union(snapshot.outputs.map(o => o.brep));
  assert.equal(welded.bodies.length, 1);
  near(brepMassProperties(welded, 1).volumeMM3, 444 * (4 * 320 + 2 * 360 + 2 * 260) + 2160, 'frame and beads unite without double counting');
});

test('ordered box: both levels and start/end directions use their actual planes', () => {
  const out = run([frame(true), ...[4, 8].flatMap(k => ['start', 'end'].map(end => bead(k, end)))]);
  for (const w of out.outputs.filter(o => o.bead)) {
    assert.ok(w.validate().valid);
    near(volume(w), 360, w.id);
  }
});

test('translated and quarter-turned table: bead volume and centroid follow the actual end plane', () => {
  const original = run([frame(), bead(4, 'start')]).output('w4start');
  const transform = ([x, y, z]) => [100 - z, y - 50, x + 20];
  const moved = run([frame(false, transform), bead(4, 'start')]).output('w4start');
  near(volume(moved), 360, 'placed volume');
  const expected = transform(original.massProperties(1).centroidMM);
  moved.massProperties(1).centroidMM.forEach((v, k) => near(v, expected[k], `placed centroid ${k}`));
});

test('ordered curved/mixed ends and explicit oblique ends retain typed refusals', () => {
  const curved = { ...frame(), section: { ...SHARP, outerRadius: 6 } };
  assert.throws(() => run([curved, bead(4, 'start')]), e => /\[BEAD_SEAM_NOT_PLANAR\]/.test(e.message));
  const oblique = { id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [300, 0, 400 + 300 * Math.sqrt(3)], [0, 0, 400]], segments: [[0, 1], [2, 3]], section: { ...SHARP, width: 80, height: 80, wall: 4 }, overrides: [{ member: 1, section: SHARP }], corners: { tee: 'butt' } };
  assert.throws(() => run([oblique, bead(1, 'end')]), e => /\[BEAD_ANGLE\]/.test(e.message));
});

test('ordered oblique end inferred from a planar cutter retains BEAD_ANGLE', () => {
  const f = { id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [300, 0, 300], [0, 300, 0]], segments: [[1, 0], [2, 0], [3, 0]], section: { ...SHARP, width: 80, height: 80, wall: 4 }, overrides: [{ member: 1, section: SHARP }], corners: { at: [{ point: 0, kind: 'order', order: [0, 1, 2] }] } };
  assert.throws(() => run([f, bead(1, 'end')]), e => /\[BEAD_ANGLE\].*45°/.test(e.message));
});

test('partial ordered trims with a surviving original cap retain BEAD_SEAM_NOT_PLANAR', () => {
  const f = { id: 'f', kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [0, 300, 0], [0, 0, 300]], segments: [[1, 0], [2, 0], [3, 0]], section: SHARP, overrides: [{ member: 0, section: { ...SHARP, height: 80 }, offset: [-10, 0] }], corners: { at: [{ point: 0, kind: 'order', order: [0, 1, 2] }] } };
  const member = run([f]).outputs[2];
  assert.ok(member.brep.faces.some(face => face.name === 'f.m2.end'));
  assert.throws(() => run([f, bead(2, 'end')]), e => /\[BEAD_SEAM_NOT_PLANAR\]/.test(e.message));
});

test('generic body trims remain outside ordered-end inference even when the cutter is planar', () => {
  const features = [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [-60, -60], max: [60, 60] },
    { id: 'p', kind: 'extrude', sketch: 's', height: 10 },
    { id: 'f', kind: 'frame', points: [[0, 0, -20], [0, 0, 500]], segments: [[0, 1]], section: SHARP, trims: [{ member: 0, end: 'start', body: 'p' }] },
  ];
  assert.throws(() => run([...features, bead(0, 'start')]), e => /\[BEAD_SEAM_NOT_PLANAR\]/.test(e.message));
});

test('A9 without ownership context refuses its actual pair atomically', () => {
  const ends = [4, 5, 6, 7].flatMap(k => ['start', 'end'].map(end => bead(k, end)));
  assert.throws(() => run([frame(), ...ends]), e => {
    assert.equal(e.code, 'PARAMETER');
    assert.match(e.message, /\[BEAD_SHARED_CONTEXT\]/);
    assert.deepEqual(e.sharedComponent, { frame: 'f', joints: [{ member: 4, end: 'start' }, { member: 7, end: 'end' }] });
    return true;
  });
});
