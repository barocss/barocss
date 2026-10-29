import test from 'node:test';
import assert from 'node:assert/strict';
import { prismaticFromProfile, transformPrismatic, booleanPrismatic, brepFromPrismatic, prismaticMassProperties, checkBrep, tessellateBrep } from '../dist/index.js';
import { brepSelection } from '../dist/api/index.js';

const outer = [{ kind: 'arc', start: [3, 0], center: [0, 0], direction: 'ccw' }];
function interval(lo, hi) {
  const unit = prismaticFromProfile({ outer, height: 1, tag: 'source' });
  return { kind: 'prismatic-solid', slabs: [{ ...unit.slabs[0], z0: lo, z1: hi }], caps: [
    { ...unit.caps[0], z: lo, tag: 'lower' }, { ...unit.caps[1], z: hi, tag: 'upper' },
  ] };
}
function caps(brep) {
  return brep.faces.filter(f => f.surface.kind === 'surface' && f.surface.degreeU === 1 && f.surface.degreeV === 1)
    .map(f => ({ name: f.name, z: f.surface.controlPoints[0][0][2] })).sort((a, b) => a.z - b.z);
}
for (const [lo, hi] of [[.3456789, .34567890000000023], [-.34567890000000023, -.3456789], [.3456789, .345678901], [-.3466789, -.3456789], [0, 5]]) {
  test(`prismatic cap identity: distinct stored levels [${lo},${hi}] keep distinct authored references`, () => {
    const solid = interval(lo, hi), before = structuredClone(solid), brep = brepFromPrismatic(solid), mass = prismaticMassProperties(solid, 1);
    assert.deepEqual(caps(brep), [{ name: 'lower', z: lo }, { name: 'upper', z: hi }]);
    assert.equal(checkBrep(brep, { strict: true }).valid, true); assert.equal(brep.bodies.length, 1); assert.equal(brep.shells.length, 1); assert.equal(brep.shells[0].closed, true);
    // Rounded-pi guide: native arc integration may differ by a few arithmetic ulps.
    assert.ok(Math.abs(mass.volume / (9 * Math.PI * (hi - lo)) - 1) <= 8 * Number.EPSILON); assert.ok(mass.centroid[2] >= lo && mass.centroid[2] <= hi);
    const query = brepSelection(brep, tessellateBrep(brep, { segmentsPerQuarter: 4 }));
    assert.deepEqual(query.faces().facing('-z').names(), ['lower']); assert.deepEqual(query.faces().facing('+z').names(), ['upper']);
    assert.deepEqual(solid, before);
  });
}

test('prismatic cap identity: the captured translated difference preserves original and cutter cap authorities', () => {
  const original = transformPrismatic(prismaticFromProfile({ outer, height: 5.00009, tag: 'n1' }), { matrix: [1, 0, 0, 1], offset: [.1234567, -.2345678], zOffset: .3456789 });
  const tool = prismaticFromProfile({ outer: [{ kind: 'arc', start: [3.1234567, -.23456780000000022], center: [.1234567000000002, -.23456780000000022], direction: 'ccw' }], height: 5.00009, from: original.slabs[0].z1 - 5.00009, tag: 'n6' });
  const solid = booleanPrismatic(original, tool, 'difference'), before = structuredClone(solid), brep = brepFromPrismatic(solid);
  assert.deepEqual(solid.caps.map(c => [c.z, c.tag]), [[.3456789, 'n1.bottom'], [.34567890000000023, 'n6.bottom']]);
  assert.deepEqual(caps(brep), [{ name: 'n1.bottom', z: .3456789 }, { name: 'n6.bottom', z: .34567890000000023 }]);
  assert.equal(new Set(brep.faces.map(f => f.name)).size, brep.faces.length); assert.deepEqual(solid, before);
});

test('prismatic cap identity: same-level region membership and first-containing source order stay unchanged', () => {
  const solid = interval(2, 5), remote = transformPrismatic(prismaticFromProfile({ outer, height: 1 }), { matrix: [1, 0, 0, 1], offset: [100, 100] });
  const lower = solid.caps[0];
  solid.caps = [{ ...lower, tag: 'miss', regions: remote.slabs[0].regions }, { ...lower, tag: 'first' }, { ...lower, tag: 'second' }, solid.caps[1]];
  assert.deepEqual(caps(brepFromPrismatic(solid)), [{ name: 'first', z: 2 }, { name: 'upper', z: 5 }]);
});

test('prismatic cap identity: a nearby source at another height cannot name an unauthored cap', () => {
  const solid = interval(.3456789, .34567890000000023); solid.caps = [solid.caps[0]];
  const actual = caps(brepFromPrismatic(solid));
  assert.equal(actual[0].name, 'lower'); assert.equal(actual[1].name, 'prismatic.top');
});
