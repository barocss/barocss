import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, massPropertiesOf, checkBrep, faceGeometry } from '../dist/index.js';
import { brepBounds } from '../dist/brep/brep-bounds.js';

// D449: nominal drafting of an ordinary 80 x 40 x 10 box, not a lifted cutting plane.
// This fixed-profile precision target is separate from the historical Draft Vrel1e-6 test.
const coordinateLimit = 1e-9, volumeRelative = 1e-9;
const right = 'n1.side[e2]';
function document(options = {}) {
  return { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'n0', kind: 'sketch', profile: 'rectangle', min: [-20, -20], max: [60, 20], sideTags: { outer: ['e1', 'e2', 'e3', 'e4'] } },
    { id: 'n1', kind: 'extrude', sketch: 'n0', height: 10 },
    { id: 'n2', kind: 'draft', target: 'n1', faces: [right], angle: 10, ...options },
  ] };
}
function nominal(angle, pull = 'z', neutral = pull === '-z' ? 10 : 0) {
  const slope = Math.tan(angle * Math.PI / 180) * (pull === '-z' ? -1 : 1), intercept = 60 + slope * neutral;
  // Integrate x from -20 to intercept-slope*z, y from -20 to 20, z from 0 to 10.
  // These closed forms use no generated vertices, cutter extent or implementation lift.
  const height = 10, depth = 40;
  const volume = depth * ((intercept + 20) * height - slope * height ** 2 / 2);
  const momentX = depth / 2 * ((intercept ** 2 - 400) * height - intercept * slope * height ** 2 + slope ** 2 * height ** 3 / 3);
  const momentZ = depth * ((intercept + 20) * height ** 2 / 2 - slope * height ** 3 / 3);
  return { slope, intercept, neutral, volume, centroid: [momentX / volume, 0, momentZ / volume],
    bounds: { min: [-20, -20, 0], max: [Math.max(intercept, intercept - slope * height), 20, 10] } };
}
function close(actual, expected, limit, label) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= limit, `${label}: ${actual} vs ${expected}, limit ${limit}`);
}
function samePoint(a, b) { return a.every((x, i) => Math.abs(x - b[i]) <= coordinateLimit); }
function verify(options, reference) {
  const input = document(options), before = structuredClone(input), snapshot = evaluateCadPart(input);
  assert.deepEqual(snapshot.outputs.map(o => o.id), ['n2']);
  const output = snapshot.outputs[0], brep = output.brep, report = checkBrep(brep, { strict: true });
  assert.equal(report.valid, true, JSON.stringify(report.issues));
  assert.equal(brep.bodies.length, 1); assert.equal(brep.bodies[0].kind, 'solid');
  assert.ok(brep.shells.every(s => s.closed)); assert.equal(report.topology[0].genus, 0);
  const mass = massPropertiesOf(output, 1), bounds = brepBounds(brep);
  close(mass.volume, reference.volume, volumeRelative * Math.max(1, Math.abs(reference.volume)), 'nominal volume');
  for (let i = 0; i < 3; i++) {
    close(mass.centroid[i], reference.centroid[i], coordinateLimit, `nominal centroid ${i}`);
    for (const side of ['min', 'max']) close(bounds[side][i], reference.bounds[side][i], coordinateLimit, `nominal bounds ${side} ${i}`);
  }
  let draftedPlanes = 0;
  for (const face of brep.faces) {
    const g = faceGeometry(face);
    if (g.kind !== 'plane' || g.n[0] <= 0.9 || Math.abs(g.n[1]) > coordinateLimit) continue;
    draftedPlanes++;
    const norm = Math.hypot(1, reference.slope);
    close((g.o[0] + reference.slope * g.o[2] - reference.intercept) / norm, 0, coordinateLimit, 'nominal support plane');
    close(g.n[0], 1 / norm, coordinateLimit, 'draft normal X');
    close(g.n[2], reference.slope / norm, coordinateLimit, 'draft normal Z');
  }
  assert.ok(draftedPlanes > 0, 'actual right drafted support plane');
  assert.ok(brep.faces.some(f => f.name === 'n2.draft.bottom'), 'persistent drafted support role');
  assert.ok(brep.faces.every(f => !f.name?.startsWith('n2.draft.overlap')), 'normal overlap remains internal');
  if (reference.neutral === 0 || reference.neutral === 10) {
    const a = [60, -20, reference.neutral], b = [60, 20, reference.neutral];
    const onNeutral = brep.edges.filter(e => {
      const p = e.curve.controlPoints;
      return e.curve.degree === 1 && p.length === 2 && (samePoint(p[0], a) && samePoint(p[1], b) || samePoint(p[0], b) && samePoint(p[1], a));
    });
    assert.equal(onNeutral.length, 1, 'original neutral edge stays on the authored neutral plane');
  }
  assert.deepEqual(input, before, 'accepted caller document unchanged');
  return output;
}

test('right planar Draft keeps the default neutral edge and nominal V/C/bounds at 10 degrees', () => {
  verify({ pull: 'z' }, nominal(10));
});

test('explicit neutral zero and omitted pull/neutral retain identical native geometry', () => {
  const omitted = verify({}, nominal(10)), explicit = verify({ pull: 'z', neutral: 0 }, nominal(10));
  assert.deepEqual(omitted.brep, explicit.brep);
  assert.deepEqual(massPropertiesOf(omitted, 1), massPropertiesOf(explicit, 1));
});

test('negative angle adds the outward nominal wedge without moving its neutral edge', () => {
  verify({ angle: -10, pull: 'z', neutral: 0 }, nominal(-10));
});

test('negative Z pull fixes the authored upper neutral edge and reverses the wedge', () => {
  verify({ pull: '-z', neutral: 10 }, nominal(10, '-z', 10));
});

test('an explicit neutral below the body defines the nominal support plane without a hidden shift', () => {
  verify({ pull: 'z', neutral: -2 }, nominal(10, 'z', -2));
});

test('translated signed pulls retain exact neutral contact, strict topology and the drafted face role', () => {
  for (const [pull, angle, side] of [['-x', -10, 'e1'], ['-y', 10, 'e2'], ['-y', -10, 'e2']]) {
    const input = document({ pull, angle, faces: [`n1.side[${side}]`], target: 'm' });
    input.features.splice(2, 0, { id: 'm', kind: 'translate', target: 'n1', offset: [-13, 7, -19] });
    input.features[0].min = [0, 0]; input.features[0].max = [80, 40];
    const before = structuredClone(input), slope = Math.tan(angle * Math.PI / 180), alongX = pull === '-x';
    const length = alongX ? 80 : 40, removed = 10 * slope * length ** 2 / 2, expectedVolume = 32000 - removed;
    // Independent triangular-prism removal (negative removal adds the outward wedge).
    const removedCenter = alongX ? [67 - 2 * length / 3, 7 + slope * length / 3, -14]
      : [67 - slope * length / 3, 47 - 2 * length / 3, -14];
    const expectedCenter = removedCenter.map((c, i) => (32000 * [27, 27, -14][i] - removed * c) / expectedVolume);
    const expectedBounds = { min: [-13, alongX ? Math.min(7, 7 + slope * length) : 7, -19],
      max: [alongX ? 67 : Math.max(67, 67 - slope * length), 47, -9] };
    const output = evaluateCadPart(input).outputs[0], report = checkBrep(output.brep, { strict: true });
    assert.equal(report.valid, true, `${pull}/${angle}: ${JSON.stringify(report.issues)}`);
    const mass = massPropertiesOf(output, 1), bounds = brepBounds(output.brep);
    close(mass.volume, expectedVolume, volumeRelative * expectedVolume, `${pull}/${angle} volume`);
    for (let i = 0; i < 3; i++) {
      close(mass.centroid[i], expectedCenter[i], coordinateLimit, `${pull}/${angle} centroid ${i}`);
      for (const end of ['min', 'max']) close(bounds[end][i], expectedBounds[end][i], coordinateLimit, `${pull}/${angle} ${end} ${i}`);
    }
    assert.ok(output.brep.faces.some(f => f.name === 'n2.draft.bottom'));
    assert.ok(output.brep.faces.every(f => !f.name?.startsWith('n2.draft.overlap')));
    assert.deepEqual(input, before);
  }
});

test('existing Draft angle and face-admission refusals keep their typed boundary', () => {
  for (const angle of [0, 45, -45]) {
    const input = document({ angle }), before = structuredClone(input);
    assert.throws(() => evaluateCadPart(input), e => e.code === 'INPUT' && /angle must/.test(e.message));
    assert.deepEqual(input, before);
  }
  assert.throws(() => evaluateCadPart(document({ faces: ['n1.top'] })), e => e.code === 'CAPABILITY' && /square to the pull/.test(e.message));
  assert.throws(() => evaluateCadPart(document({ faces: ['n1.side[e1]', right] })), e => e.code === 'CAPABILITY' && /meet along an edge/.test(e.message));
});
