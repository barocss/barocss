import test from 'node:test';
import assert from 'node:assert/strict';
import { loftSolid, BrepError, checkBrep, evaluateCurve, evaluateSurface, evaluateCadPart, reevaluate, outputOf, massPropertiesOf, saveCadPart, loadCadPart, CadPartError } from '../dist/index.js';

// Independent oracle fixed before this file: work/CG1cubic-oracle.json. No runtime values define expectations.
const EPS = 1e-9;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= EPS, `${actual} != ${expected}`);
const vector = (actual, expected) => { assert.equal(actual.length, expected.length); expected.forEach((v, i) => close(actual[i], v)); };
const flat = z => ({ origin: [0, 0, z], xAxis: [1, 0, 0], yAxis: [0, 1, 0] });
const circle = radius => [{ kind: 'arc', start: [radius, 0], center: [0, 0], direction: 'ccw' }];
const guide = () => ({ kind: 'cubic-bezier', controlPoints: [[1, 0, 0], [4, 0, 1], [2, 0, 2], [4, 0, 3]] });
const conicInput = (g = guide()) => ({ id: 'L', name: 'L', sections: [{ frame: flat(0), profile: circle(1) }, { frame: flat(3), profile: circle(4) }], guide: g });
const offset = t => 3 * t * (1 - t) ** 2 * 2 - 3 * t ** 2 * (1 - t);
const found = (items, predicate) => { const result = items.find(predicate); assert.ok(result); return result; };
function valid(brep, sideCount = 4) {
  const report = checkBrep(brep);
  assert.equal(report.valid, true, JSON.stringify(report.issues));
  assert.equal(brep.bodies.length, 1); assert.equal(brep.bodies[0].kind, 'solid');
  assert.equal(brep.shells.length, 1); assert.equal(brep.shells[0].closed, true);
  assert.deepEqual(brep.faces.map(f => f.name).sort(), ['L.bottom', ...Array.from({ length: sideCount }, (_, i) => `L.side${i}`), 'L.top'].sort());
}
function massOracle(m, density) {
  // A=pi*(1+3t)^2, c=(6t-15t^2+9t^3,0,3t). Hand-integrated raw moments and centralisation.
  const mass = 21 * Math.PI * density / 1000;
  close(m.volume, 21 * Math.PI); close(m.mass, mass); vector(m.centroid, [11 / 140, 0, 57 / 28]);
  const expected = [[2323 / 784, 0, 759 / 3920], [0, 29937 / 9800, 0], [759 / 3920, 0, 97279 / 19600]];
  assert.equal(m.inertia.length, 3);
  expected.forEach((row, i) => vector(m.inertia[i], row.map(v => v * mass)));
  assert.equal(m.method, 'quadrature');
}

test('cubic guide: tapered circle has authored seam, exact section surfaces and independent full mass tensor', () => {
  const input = conicInput(), before = structuredClone(input), { brep, mass } = loftSolid(input);
  valid(brep); massOracle(mass(1), 1); massOracle(mass(2.7), 2.7);
  const seam = found(brep.edges, e => e.id === 'l0_0').curve;
  assert.equal(seam.degree, 3); assert.deepEqual(seam.knots, [0, 0, 0, 0, 1, 1, 1, 1]);
  assert.deepEqual(seam.controlPoints, input.guide.controlPoints); assert.deepEqual(seam.weights, [1, 1, 1, 1]);
  const side = found(brep.faces, f => f.name === 'L.side0').surface; assert.equal(side.degreeV, 3);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const r = 1 + 3 * t, x = offset(t);
    vector(evaluateCurve(seam, t), [r + x, 0, 3 * t]);
    vector(evaluateSurface(side, 0, t), [r + x, 0, 3 * t]);
    vector(evaluateSurface(side, 0.5, t), [r / Math.SQRT2 + x, r / Math.SQRT2, 3 * t]);
  }
  for (const [name, z] of [['L.bottom', 0], ['L.top', 3]]) {
    const cap = found(brep.faces, f => f.name === name);
    for (const p of cap.surface.controlPoints.flat()) close(p[2], z);
  }
  assert.deepEqual(input, before);
});

const stadium = () => [
  { kind: 'line', start: [-2, -1] }, { kind: 'arc', start: [2, -1], center: [2, 0], direction: 'ccw' },
  { kind: 'line', start: [2, 1] }, { kind: 'arc', start: [-2, 1], center: [-2, 0], direction: 'ccw' },
];
test('cubic guide: mixed profile retains its first authored seam and the same transverse Bernstein displacement', () => {
  const p = stadium(), g = { kind: 'cubic-bezier', controlPoints: [[-2, -1, 0], [0, -1, 1], [-3, -1, 2], [-2, -1, 3]] };
  const input = { id: 'L', name: 'L', sections: [{ frame: flat(0), profile: p }, { frame: flat(3), profile: p }], guide: g };
  const before = structuredClone(input), { brep, mass } = loftSolid(input); valid(brep, 6);
  const seam = found(brep.edges, e => e.id === 'l0_0').curve;
  assert.equal(seam.degree, 3); assert.deepEqual(seam.controlPoints, g.controlPoints);
  const side = found(brep.faces, f => f.name === 'L.side0').surface;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    vector(evaluateCurve(seam, t), [-2 + offset(t), -1, 3 * t]);
    vector(evaluateSurface(side, 0.25, t), [-1 + offset(t), -1, 3 * t]);
  }
  const m = mass(1); close(m.volume, 3 * (8 + Math.PI)); vector(m.centroid, [1 / 4, 0, 1.5]);
  assert.deepEqual(input, before);
});

test('cubic guide: exact endpoint, normal-fraction and explicit control encoding refusals preserve inputs', () => {
  const refused = (g, detail) => {
    const input = conicInput(g), before = structuredClone(input);
    assert.throws(() => loftSolid(input), e => e instanceof BrepError && e.code === 'INPUT' && e.message === `B-rep: loft: cubic guide ${detail}`);
    assert.deepEqual(input, before);
  };
  for (const i of [1, 2]) {
    const g = guide(); g.controlPoints[i][2] += 0.25;
    refused(g, `control ${i} must lie exactly on the cap fraction ${i}/3 plane`);
  }
  for (const i of [0, 3]) { const g = guide(); g.controlPoints[i][0] += 0.25; refused(g, 'endpoints must exactly match the two cap +X seams'); }
  const short = guide(); short.controlPoints.pop(); refused(short, 'needs exactly four world control points');
  const nonfinite = guide(); nonfinite.controlPoints[1][0] = NaN; refused(nonfinite, 'needs finite three-component points within the existing coordinate range');
  const sparse = guide(); delete sparse.controlPoints[1]; refused(sparse, 'needs finite three-component points within the existing coordinate range');
  refused({ ...guide(), weights: [1, 1, 1, 1] }, 'needs exactly kind cubic-bezier and controlPoints');
});

test('cubic guide: original JSON survives save/read and a refused reevaluation preserves the accepted snapshot', () => {
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'a', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 1 },
    { id: 'b', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 },
    { id: 'L', kind: 'loft', sections: [{ sketch: 'a', frame: flat(0) }, { sketch: 'b', frame: flat(3) }], guide: guide() },
  ] };
  const before = structuredClone(doc), snapshot = evaluateCadPart(doc), output = outputOf(snapshot, 'L'); valid(output.brep);
  massOracle(massPropertiesOf(output, 1), 1);
  const direct = loftSolid(conicInput()); assert.deepEqual(output.brep, direct.brep);
  const text = saveCadPart(snapshot); assert.deepEqual(JSON.parse(text), doc);
  const loaded = outputOf(loadCadPart(text), 'L'); assert.deepEqual(loaded.brep, output.brep); massOracle(massPropertiesOf(loaded, 1), 1);
  const oldBrep = structuredClone(output.brep), bad = structuredClone(doc); bad.features[2].guide.controlPoints[1][2] = 1.25;
  const badBefore = structuredClone(bad);
  assert.throws(() => reevaluate(snapshot, { document: bad }), e => e instanceof CadPartError && e.code === 'GEOMETRY' && e.details.category === 'GEOMETRY' && e.feature === 'L');
  assert.deepEqual(bad, badBefore); assert.deepEqual(doc, before); assert.equal(saveCadPart(snapshot), text);
  assert.deepEqual(outputOf(snapshot, 'L').brep, oldBrep); massOracle(massPropertiesOf(outputOf(snapshot, 'L'), 1), 1);
  // No smooth, multiple rails, unrestricted normal displacement or general surface accuracy claim.
});
