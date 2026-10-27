import test from 'node:test';
import assert from 'node:assert/strict';
import { loftSolid, BrepError, checkBrep, evaluateCadPart, reevaluate, outputOf, massPropertiesOf, saveCadPart, loadCadPart, CadPartError } from '../dist/index.js';

// Fixed before source writing: oracles-fixed.json and oracle-density-unit-correction.json.
// Length mm, density g/cm3, mass g, centroidal inertia g*mm2. No output defines expectations.
const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9, `${a} != ${b}`);
const vector = (a, b) => { assert.equal(a.length, b.length); b.forEach((x, i) => close(a[i], x)); };
const frame = z => ({ origin: [0, 0, z], xAxis: [1, 0, 0], yAxis: [0, 1, 0] });
const circle = r => [{ kind: 'arc', start: [r, 0], center: [0, 0], direction: 'ccw' }];
const input = (radii = [2, 2, 2, 2], heights = [0, 1, 3, 6]) => ({ id: 'L', name: 'L', sections: radii.map((r, i) => ({ profile: circle(r), frame: frame(heights[i]) })) });
function topology(brep, count) {
  const check = checkBrep(brep); assert.equal(check.valid, true, JSON.stringify(check.issues)); assert.equal(check.issues.length, 0);
  assert.equal(brep.bodies.length, 1); assert.equal(brep.bodies[0].kind, 'solid');
  assert.equal(brep.shells.length, 1); assert.equal(brep.shells[0].closed, true);
  assert.equal(brep.vertices.length, 4 * count); assert.equal(brep.edges.length, 8 * count - 4); assert.equal(brep.faces.length, 4 * (count - 1) + 2);
  assert.deepEqual(brep.faces.filter(f => /\.(bottom|top)$/.test(f.name)).map(f => f.name).sort(), ['L.bottom', 'L.top']);
  for (let k = 0; k < count - 1; k++) for (let i = 0; i < 4; i++) {
    const face = brep.faces.find(f => f.name === `L.s${k}.side${i}`); assert.ok(face);
    assert.equal(face.surface.kind, 'surface'); assert.equal(face.surface.degreeU, 2); assert.equal(face.surface.degreeV, 1); assert.deepEqual(face.surface.knotsV, [0, 0, 1, 1]);
  }
  for (let k = 1; k < count - 1; k++) for (let i = 0; i < 4; i++) {
    const ring = brep.edges.find(e => e.id === `r${k}_${i}`); assert.ok(ring);
    assert.equal(ring.name, [`L.s${k - 1}.side${i}`, `L.s${k}.side${i}`].sort().join('|'));
    assert.deepEqual(ring.vertices, [`v${k}_${i}`, `v${k}_${(i + 1) % 4}`]);
  }
}

test('multi conic loft: four cylinder sections share rings and retain the fixed MMGS tensor', () => {
  const authored = input(), before = structuredClone(authored), built = loftSolid(authored); topology(built.brep, 4);
  const m = built.mass(1); close(m.volume, 24 * Math.PI); close(m.mass, 24 * Math.PI / 1000); vector(m.centroid, [0, 0, 3]); assert.equal(m.method, 'quadrature');
  // The fixed volume moments convert once by density/1000, as recorded in the correction.
  const expected = [[96 * Math.PI / 1000, 0, 0], [0, 96 * Math.PI / 1000, 0], [0, 0, 48 * Math.PI / 1000]];
  assert.equal(m.inertia.length, 3); expected.forEach((row, i) => vector(m.inertia[i], row)); assert.deepEqual(authored, before);
});

test('multi conic loft: eight sections, intermediate counts, inline conics and variable radii use the same ruled spans', () => {
  const eight = input(Array(8).fill(2), [0, 1, 2, 3, 4, 5, 6, 7]), before = structuredClone(eight), built = loftSolid(eight); topology(built.brep, 8);
  close(built.mass(1).volume, 28 * Math.PI); vector(built.mass(1).centroid, [0, 0, 3.5]); assert.deepEqual(eight, before);
  for (const count of [5, 6, 7]) {
    const authored = input(Array(count).fill(2), Array.from({ length: count }, (_, i) => i)), saved = structuredClone(authored);
    topology(loftSolid(authored).brep, count); assert.deepEqual(authored, saved);
  }
  const ellipses = input(); ellipses.sections.forEach(s => { s.profile = { kind: 'ellipse', center: [0, 0], radii: [2, 2] }; });
  const ellipseBefore = structuredClone(ellipses), ellipse = loftSolid(ellipses); topology(ellipse.brep, 4);
  close(ellipse.mass(1).volume, 24 * Math.PI); vector(ellipse.mass(1).centroid, [0, 0, 3]); assert.deepEqual(ellipses, ellipseBefore);
  const variable = input([1, 2, 1, 3]), saved = structuredClone(variable), result = loftSolid(variable); topology(result.brep, 4);
  close(result.mass(1).volume, 20 * Math.PI); assert.deepEqual(variable, saved);
});

test('multi conic loft: unsupported counts, guides, smooth and malformed sections refuse without input mutation', () => {
  const refused = (authored, code) => { const before = structuredClone(authored); assert.throws(() => loftSolid(authored), e => e instanceof BrepError && e.code === code); assert.deepEqual(authored, before); };
  refused(input(Array(9).fill(2), Array.from({ length: 9 }, (_, i) => i)), 'INPUT');
  refused({ ...input(), smooth: true }, 'INPUT');
  refused({ ...input(), guide: { kind: 'quadratic-bezier', controlPoints: [[2, 0, 0], [2, 0, 3], [2, 0, 6]] } }, 'INPUT');
  const absent = input(); delete absent.sections[2].frame; refused(absent, 'INPUT');
  const mixed = input(); mixed.sections[2].z = 3; refused(mixed, 'INPUT');
  const polygon = input(); polygon.sections[2].profile = [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [2, 0] }, { kind: 'line', start: [0, 2] }]; refused(polygon, 'INPUT');
  const seam = input(); seam.sections[2].profile[0].start = [0, 2]; refused(seam, 'INPUT');
  const axes = input(); axes.sections[2].frame.xAxis = [0, 1, 0]; axes.sections[2].frame.yAxis = [-1, 0, 0]; refused(axes, 'INPUT');
  const radius = input(); radius.sections[2].profile = { kind: 'ellipse', center: [0, 0], radii: [0, 2] }; refused(radius, 'INPUT');
  const range = input(); range.sections[2].frame.origin[0] = 10001; refused(range, 'INPUT');
  const repeated = input(); repeated.sections[2].frame.origin[2] = 1; refused(repeated, 'GEOMETRY');
  const reversed = input(); reversed.sections[2].frame.origin[2] = 0; refused(reversed, 'GEOMETRY');
});

test('multi conic loft: codec retains frames and a refused reevaluation preserves the accepted snapshot', () => {
  const heights = [0, 1, 3, 6], doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    ...heights.map((_, i) => ({ id: `s${i}`, kind: 'sketch', profile: 'circle', center: [0, 0], radius: 2 })),
    { id: 'L', kind: 'loft', sections: heights.map((z, i) => ({ sketch: `s${i}`, frame: frame(z) })) },
  ] };
  const before = structuredClone(doc), accepted = evaluateCadPart(doc), output = outputOf(accepted, 'L'); topology(output.brep, 4); close(massPropertiesOf(output, 1).volume, 24 * Math.PI);
  const text = saveCadPart(accepted), restored = loadCadPart(text); assert.deepEqual(restored.document, accepted.document); assert.deepEqual(outputOf(restored, 'L').brep, output.brep);
  const bad = structuredClone(doc); bad.features.at(-1).sections[2].frame.origin[2] = 1; const badBefore = structuredClone(bad);
  assert.throws(() => reevaluate(accepted, { document: bad }), e => e instanceof CadPartError && e.code === 'GEOMETRY' && e.feature === 'L');
  assert.deepEqual(bad, badBefore); assert.deepEqual(doc, before); assert.equal(saveCadPart(accepted), text);
  assert.deepEqual(outputOf(accepted, 'L').brep, output.brep); close(massPropertiesOf(outputOf(accepted, 'L'), 1).volume, 24 * Math.PI);
});
