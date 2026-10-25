// CG1 loft analytic fixtures. No guide rails, general curves, multi-span or smooth oriented claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loftSolid, BrepError, checkBrep, evaluateSurface, evaluateCadPart, outputOf, massPropertiesOf, CadPartError, saveCadPart, loadCadPart } from '../dist/index.js';

const polygon = points => points.map(start => ({ kind: 'line', start }));
const square = polygon([[0, 0], [2, 0], [2, 2], [0, 2]]);
const flat = z => ({ origin: [0, 0, z], xAxis: [1, 0, 0], yAxis: [0, 1, 0] });
const tilted = { origin: [0, 3, 3], xAxis: [1, 0, 0], yAxis: [0, 0, -1] };
const section = (frame, profile = square) => ({ frame, profile });
const input = sections => ({ id: 'L', name: 'L', sections });
const make = (lo = flat(0), hi = tilted) => loftSolid(input([section(lo), section(hi)]));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const vector = (actual, expected) => actual.forEach((x, i) => close(x, expected[i]));
const bound = brep => ({ min: [0, 1, 2].map(c => Math.min(...brep.vertices.map(v => v.point[c]))), max: [0, 1, 2].map(c => Math.max(...brep.vertices.map(v => v.point[c]))) });
function valid(brep) {
  const report = checkBrep(brep, { strict: true });
  assert.equal(report.valid, true, JSON.stringify(report.issues));
  assert.equal(brep.bodies.length, 1);
  assert.ok(brep.shells.every(s => s.closed));
  assert.deepEqual(brep.faces.map(f => f.name).sort(), ['L.bottom', 'L.side0', 'L.side1', 'L.side2', 'L.side3', 'L.top']);
  assert.equal(new Set(brep.edges.map(e => e.name)).size, brep.edges.length);
  assert.ok(brep.edges.every(e => typeof e.name === 'string' && e.name.length));
}
const rejected = (fn, code, message) => assert.throws(fn, e => e instanceof BrepError && e.code === code && message.test(e.message));

test('oriented loft: nonparallel caps form an exact extruded quadrilateral prism', () => {
  // Extrusion along X over the independent YZ polygon (0,0),(2,0),(3,1),(3,3).
  // Its shoelace area is 4, centroid (23/12,13/12); width X=2. No kernel oracle.
  const { brep, mass } = make(), m = mass(2.7);
  valid(brep);
  close(m.volume, 8); close(m.mass, 8 * 2.7 / 1000);
  vector(m.centroid, [1, 23 / 12, 13 / 12]);
  assert.deepEqual(bound(brep), { min: [0, 0, 0], max: [2, 3, 3] });
  assert.equal(m.method, 'quadrature');
});

test('oriented loft: side patch interpolates the actual section edges and caps lie on their planes', () => {
  const { brep } = make();
  const side = brep.faces.find(f => f.name === 'L.side1').surface;
  vector(evaluateSurface(side, 0.25, 0), [2, 0.5, 0]);
  vector(evaluateSurface(side, 0.25, 1), [2, 3, 2.5]);
  vector(evaluateSurface(side, 0.25, 0.4), [2, 1.5, 1]);
  for (const f of brep.faces.filter(f => f.name === 'L.top')) for (const p of f.surface.controlPoints.flat()) close(p[1], 3);
  for (const f of brep.faces.filter(f => f.name === 'L.bottom')) for (const p of f.surface.controlPoints.flat()) close(p[2], 0);
});

test('oriented loft: explicit twist retains a real ruled B-rep and symmetric analytic moments', () => {
  const twist = { origin: [2, 0, 3], xAxis: [0, 1, 0], yAxis: [-1, 0, 0] };
  const { brep, mass } = make(flat(0), twist), m = mass(1);
  // A(t)=4((1-t)^2+t^2); integrate over height 3. The section centre stays (1,1).
  valid(brep); close(m.volume, 8); vector(m.centroid, [1, 1, 1.5]);
  assert.deepEqual(bound(brep), { min: [0, 0, 0], max: [2, 2, 3] });
  assert.ok(brep.faces.every(f => f.surface.kind === 'surface'));
});

test('oriented loft: affine rectangle taper has independent frustum volume and centroid', () => {
  const upper = polygon([[0, 0], [4, 0], [4, 4], [0, 4]]);
  const { brep, mass } = loftSolid(input([section(flat(0)), section(flat(3), upper)]));
  valid(brep);
  // Side length 2(1+t): V=3*4*7/3=28; zbar=3*(17/12)/(7/3)=51/28.
  const m = mass(1); close(m.volume, 28); vector(m.centroid, [45 / 28, 45 / 28, 51 / 28]);
});

test('oriented loft: translated parallel frames reproduce a known prism and MMGS inertia', () => {
  const a = { ...flat(4), origin: [5, -3, 4] }, b = { ...flat(7), origin: [5, -3, 7] };
  const { brep, mass } = make(a, b), m = mass(2);
  valid(brep); close(m.volume, 12); close(m.mass, 0.024); vector(m.centroid, [6, -2, 5.5]);
  vector(m.inertia[0], [0.024 * 13 / 12, 0, 0]);
  vector(m.inertia[1], [0, 0.024 * 13 / 12, 0]);
  vector(m.inertia[2], [0, 0, 0.024 * 8 / 12]);
});

test('oriented loft: half-turn collapse is refused even though both end Jacobians are positive', () => {
  rejected(() => make(flat(0), { origin: [2, 2, 3], xAxis: [-1, 0, 0], yAxis: [0, -1, 0] }), 'GEOMETRY', /fold|separation/);
});

test('oriented loft: intersecting section planes, reversed progression and coincident caps are refused', () => {
  rejected(() => make(flat(0), { ...tilted, origin: [0, 1, -1] }), 'GEOMETRY', /intersect|separation/);
  rejected(() => make(flat(3), flat(0)), 'GEOMETRY', /separation/);
  rejected(() => make(flat(0), flat(0)), 'GEOMETRY', /separation/);
});

test('oriented loft: invalid frames and mixed position encodings cannot silently fall back', () => {
  for (const bad of [null, {}, { ...flat(2), origin: [0, 0, NaN] }, { ...flat(2), xAxis: [2, 0, 0] }, { ...flat(2), yAxis: [1, 0, 0] }]) {
    rejected(() => make(flat(0), bad), 'INPUT', /frame|unit|finite/);
  }
  rejected(() => loftSolid(input([section(flat(0)), { profile: square, z: 3 }])), 'INPUT', /frame/);
  rejected(() => loftSolid(input([{ ...section(flat(0)), z: 0 }, section(flat(3))])), 'INPUT', /no z/);
  rejected(() => make(flat(0), { ...flat(3), origin: [1e8, 0, 3] }), 'INPUT', /coordinate range/);
});

test('oriented loft: unsupported nonparallel nonaffine, nonconvex, curved and multi-section shapes are explicit refusals', () => {
  const nonaffine = polygon([[0, 0], [2, 0], [3, 2], [0, 2]]);
  rejected(() => loftSolid(input([section(flat(0)), section(tilted, nonaffine)])), 'INPUT', /affine/);
  const concave = polygon([[0, 0], [2, 0], [1, 1], [2, 2], [0, 2]]);
  rejected(() => loftSolid(input([section(flat(0), concave), section(flat(3), concave)])), 'INPUT', /convex/);
  const circle = [{ kind: 'arc', start: [1, 0], center: [0, 0], direction: 'ccw' }];
  rejected(() => loftSolid(input([section(flat(0), circle), section(tilted, circle)])), 'INPUT', /identical xAxis/);
  rejected(() => loftSolid(input([section(flat(0)), section(flat(3)), section(flat(6))])), 'INPUT', /exactly two/);
  rejected(() => loftSolid({ ...input([section(flat(0)), section(flat(3))]), smooth: true }), 'INPUT', /ruled/);
});

test('parallel polygon loft: non-affine trapezoid has independent volume, centroid and bounds', () => {
  const trapezoid = polygon([[0, 0], [2, 0], [3, 2], [0, 2]]);
  const { brep, mass } = loftSolid(input([section(flat(0)), section(flat(3), trapezoid)]));
  valid(brep);
  // At z=3t the width at y is 2+ty/2, 0<=y<=2. Integrate dx dy dz directly:
  // A=4+t, integral(x dA)=4+2t+t^2/3, integral(y dA)=4+4t/3.
  // This is not an affine image of the rectangle: only its upper-right corner moves.
  const m = mass(2.7); close(m.volume, 27 / 2); close(m.mass, 27 / 2 * 2.7 / 1000);
  vector(m.centroid, [92 / 81, 28 / 27, 14 / 9]);
  assert.deepEqual(bound(brep), { min: [0, 0, 0], max: [3, 2, 3] });
});

test('parallel polygon loft: rulings preserve both authored non-affine section edges', () => {
  const trapezoid = polygon([[0, 0], [2, 0], [3, 2], [0, 2]]);
  const { brep } = loftSolid(input([section(flat(0)), section(flat(3), trapezoid)]));
  const side = brep.faces.find(f => f.name === 'L.side1').surface;
  vector(evaluateSurface(side, 0.25, 0), [2, 0.5, 0]);
  vector(evaluateSurface(side, 0.25, 1), [2.25, 0.5, 3]);
  vector(evaluateSurface(side, 0.25, 0.4), [2.1, 0.5, 1.2]);
});

test('parallel polygon loft: convex endpoints with a collapsing interior are refused', () => {
  // The same convex upper trapezoid starts two vertices later. At t=1/2 several
  // corresponding vertices coincide. Endpoint-only convexity would admit this invalid solid.
  const shifted = polygon([[3, 2], [0, 2], [0, 0], [2, 0]]);
  rejected(() => loftSolid(input([section(flat(0)), section(flat(3), shifted)])), 'GEOMETRY', /fold|separation/);
});

test('parallel polygon loft: general correspondence requires positive plane spacing and identical axes', () => {
  const trapezoid = polygon([[0, 0], [2, 0], [3, 2], [0, 2]]);
  rejected(() => loftSolid(input([section(flat(0)), section(flat(0), trapezoid)])), 'GEOMETRY', /separation/);
  rejected(() => loftSolid(input([section(flat(3)), section(flat(0), trapezoid)])), 'GEOMETRY', /separation/);
  const rotated = { origin: [2, 0, 3], xAxis: [0, 1, 0], yAxis: [-1, 0, 0] };
  rejected(() => loftSolid(input([section(flat(0)), section(rotated, trapezoid)])), 'INPUT', /identical axes/);
});

test('oriented loft: degenerate and self-crossing profiles retain typed profile refusals', () => {
  for (const points of [[[0, 0], [0, 0], [1, 1]], [[0, 0], [2, 2], [0, 2], [2, 0]]]) {
    assert.throws(() => loftSolid(input([section(flat(0), polygon(points)), section(flat(3), polygon(points))])), e => typeof e.code === 'string');
  }
});

test('oriented loft: first-section segment tags remain stable', () => {
  const { brep } = loftSolid({ ...input([section(flat(0)), section(tilted)]), sideTags: ['a', 'b', 'c', 'd'] });
  assert.deepEqual(brep.faces.map(f => f.name).sort(), ['L.bottom', 'L.side[a]', 'L.side[b]', 'L.side[c]', 'L.side[d]', 'L.top']);
});

test('oriented loft: part document dispatch consumes explicit frames without a cross-package adapter', () => {
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'a', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 2] },
    { id: 'b', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 2] },
    { id: 'L', kind: 'loft', sections: [{ sketch: 'a', frame: flat(0) }, { sketch: 'b', frame: tilted }] },
  ] };
  const o = outputOf(evaluateCadPart(doc), 'L');
  valid(o.brep); close(massPropertiesOf(o).volume, 8);
  const mixed = structuredClone(doc); mixed.features[2].sections[1] = { sketch: 'b', z: 3 };
  assert.throws(() => evaluateCadPart(mixed), e => e instanceof CadPartError && /frame/.test(e.message));
});

test('legacy loft: parallel profile+z retains its analytic solid and original surface representation', () => {
  const { brep, mass } = loftSolid(input([{ profile: square, z: 0 }, { profile: square, z: 3 }]));
  valid(brep); close(mass(1).volume, 12); vector(mass(1).centroid, [1, 1, 1.5]);
  assert.ok(brep.faces.every(f => f.surface.degreeU === 1 && f.surface.degreeV === 1));
  const curve = [{ kind: 'arc', start: [1, 0], center: [0, 0], direction: 'ccw' }];
  close(loftSolid(input([{ profile: curve, z: 0 }, { profile: curve, z: 3 }])).mass(1).volume, 3 * Math.PI);
});

test('legacy loft: ruled builder and smooth builder source bytes are preserved from product697b', () => {
  // Source-integrity assertion, separate from the runtime geometry tests above. This is not
  // a claim that a new full fingerprint or whole-kernel qualification has run.
  const source = readFileSync(new URL('../src/features/loft.ts', import.meta.url), 'utf8');
  const start = source.indexOf('export function loftSolid('), end = source.indexOf('/**\n * A smooth loft:', start);
  const legacy = source.slice(start, end)
    .replace('  if (input.sections.some(s => s.frame !== undefined || !Array.isArray(s.profile))) return orientedLoftSolid(input);\n', '')
    .replace('const S = input.sections as readonly { readonly profile: readonly ProfileSegmentInput[]; readonly z: number }[];', 'const S = input.sections;');
  const hash = s => createHash('sha256').update(s).digest('hex');
  assert.equal(hash(legacy), '9c80ee4c38639905844b4cc2e80696a41470c4338bf7525a0b6160273a56e23b');
  assert.equal(hash(source.slice(source.indexOf('function smoothLoft('))), 'ca109102536dc48ede03cd709718611cce3baae13fe888c893ae6f0cf91368df');
});

const circleProfile = (r, center = [0, 0], direction = 'ccw') => [{ kind: 'arc', start: [center[0] + r, center[1]], center, direction }];
const ellipseProfile = (rx, ry, center = [0, 0], direction = 'ccw') => ({ kind: 'ellipse', center, radii: [rx, ry], direction });
const conic = (a, b, end = flat(3)) => loftSolid(input([section(flat(0), a), section(end, b)]));

test('curved loft: independent circular frustum volume and centroid', () => {
  const { brep, mass } = conic(circleProfile(2), circleProfile(4)), m = mass(2.7);
  // A(z)=pi*(2+2z/3)^2, 0<=z<=3. V=28pi and zbar=51/28.
  valid(brep); close(m.volume, 28 * Math.PI); close(m.mass, 28 * Math.PI * 2.7 / 1000);
  vector(m.centroid, [0, 0, 51 / 28]);
  assert.deepEqual(bound(brep), { min: [-4, -4, 0], max: [4, 4, 3] });
  assert.ok(brep.faces.every(f => f.surface.kind === 'surface'));
});

test('curved loft: laterally moved cylinder keeps independent mass and centre', () => {
  const end = { ...flat(5), origin: [3, 4, 5] };
  const { brep, mass } = conic(circleProfile(2), circleProfile(2), end), m = mass(1);
  valid(brep); close(m.volume, 20 * Math.PI); vector(m.centroid, [1.5, 2, 2.5]);
  assert.deepEqual(bound(brep), { min: [-2, -2, 0], max: [5, 6, 5] });
});

test('curved loft: independently integrated ellipse radii and centre vary linearly', () => {
  const { brep, mass } = conic(ellipseProfile(2, 1), ellipseProfile(4, 3, [2, -1])), m = mass(1);
  // A(t)=pi*(2+2t)*(1+2t)=pi*(2+6t+4t^2), z=3t.
  // integral A/pi=19/3, integral t*A/pi=4. The centre moves from (0,0) to (2,-1).
  valid(brep); close(m.volume, 19 * Math.PI); vector(m.centroid, [24 / 19, -12 / 19, 36 / 19]);
  assert.deepEqual(bound(brep), { min: [-2, -4, 0], max: [6, 2, 3] });
});

test('curved loft: exact rational side interpolates both ellipse boundaries and closes its seam', () => {
  const { brep } = conic(ellipseProfile(2, 1), ellipseProfile(4, 3, [2, -1]));
  const side = brep.faces.find(f => f.name === 'L.side0').surface;
  vector(evaluateSurface(side, 0.5, 0.5), [1 + 3 * Math.SQRT1_2, -0.5 + 2 * Math.SQRT1_2, 1.5]);
  assert.deepEqual(side.weights, [[1, 1], [Math.SQRT1_2, Math.SQRT1_2], [1, 1]]);
  for (const cap of ['bottom', 'top']) {
    const first = brep.edges.find(e => e.name === [`L.${cap}`, 'L.side0'].sort().join('|')).curve;
    const last = brep.edges.find(e => e.name === [`L.${cap}`, 'L.side3'].sort().join('|')).curve;
    assert.deepEqual(last.controlPoints.at(-1), first.controlPoints[0]);
  }
});

test('curved loft: a circle-to-ellipse pair shares the same exact parameter correspondence', () => {
  const { brep, mass } = conic(circleProfile(2), ellipseProfile(4, 3));
  // Integral over height3 of pi*(2+2t)*(2+t) is 23pi.
  valid(brep); close(mass(1).volume, 23 * Math.PI);
});

test('curved loft: clockwise inputs normalize without moving the seam or changing names', () => {
  for (const profiles of [direction => circleProfile(2, [0, 0], direction), direction => ellipseProfile(2, 1, [0, 0], direction)]) {
    const ccw = conic(profiles('ccw'), profiles('ccw')), cw = conic(profiles('cw'), profiles('cw'));
    assert.deepEqual(cw.brep, ccw.brep); assert.deepEqual(cw.mass(1), ccw.mass(1));
  }
});

test('curved loft: a contour tag gives stable quarter-side and edge names', () => {
  const { brep } = loftSolid({ ...input([section(flat(0), circleProfile(2)), section(flat(3), circleProfile(4))]), sideTags: ['rim'] });
  assert.equal(checkBrep(brep, { strict: true }).valid, true);
  assert.deepEqual(brep.faces.map(f => f.name).sort(), ['L.bottom', 'L.side[rim]#1', 'L.side[rim]#2', 'L.side[rim]#3', 'L.side[rim]#4', 'L.top']);
  assert.ok(brep.edges.every(e => e.name));
});

test('curved loft: malformed finite tuples, radii and direction values are typed refusals', () => {
  const base = ellipseProfile(2, 1);
  for (const bad of [
    { ...base, center: [0] }, { ...base, center: [0, 0, 0] }, { ...base, center: [Infinity, 0] }, { ...base, center: ['0', 0] },
    { ...base, radii: [1] }, { ...base, radii: [1, 2, 3] }, { ...base, radii: [NaN, 1] }, { ...base, radii: [0, 1] },
    { ...base, radii: [-1, 1] }, { ...base, direction: 'clockwise' },
  ]) rejected(() => conic(base, bad), 'INPUT', /finite|radii|direction/);
});

test('curved loft: unsupported encodings, seam phases and shape families never fall back', () => {
  const ellipse = ellipseProfile(2, 1);
  rejected(() => loftSolid(input([{ profile: ellipse, z: 0 }, section(flat(3), ellipse)])), 'INPUT', /frame/);
  rejected(() => loftSolid(input([{ profile: ellipse }, section(flat(3), ellipse)])), 'INPUT', /frame/);
  const otherSeam = [{ kind: 'arc', start: [0, 2], center: [0, 0], direction: 'ccw' }];
  rejected(() => conic(otherSeam, circleProfile(2)), 'INPUT', /seam/);
  rejected(() => conic(circleProfile(2), square), 'INPUT', /one full-circle/);
  const splitCircle = [{ kind: 'arc', start: [2, 0], center: [0, 0], direction: 'ccw' }, { kind: 'arc', start: [-2, 0], center: [0, 0], direction: 'ccw' }];
  rejected(() => conic(circleProfile(2), splitCircle), 'INPUT', /one full-circle/);
});

test('curved loft: nonparallel, reversed, smooth and multisection inputs remain refused', () => {
  const e = ellipseProfile(2, 1);
  rejected(() => conic(e, e, tilted), 'INPUT', /identical xAxis/);
  rejected(() => conic(e, e, flat(0)), 'GEOMETRY', /positive plane separation/);
  rejected(() => conic(e, e, flat(-3)), 'GEOMETRY', /positive plane separation/);
  rejected(() => loftSolid({ ...input([section(flat(0), e), section(flat(3), e)]), smooth: true }), 'INPUT', /ruled/);
  rejected(() => loftSolid(input([section(flat(0), e), section(flat(3), e), section(flat(6), e)])), 'INPUT', /exactly two/);
});

test('curved loft: inline ellipse document agrees with direct loft and survives save/read', () => {
  const profiles = [ellipseProfile(2, 1), ellipseProfile(4, 3, [2, -1])];
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'L', kind: 'loft', sections: profiles.map((profile, i) => ({ profile, frame: flat(3 * i) })) },
  ] };
  const snapshot = evaluateCadPart(doc), o = outputOf(snapshot, 'L'), direct = conic(...profiles);
  valid(o.brep); assert.deepEqual(massPropertiesOf(o), direct.mass(1));
  assert.deepEqual(o.brep.faces.map(f => [f.name, f.surface]), direct.brep.faces.map(f => [f.name, f.surface]));
  const text = saveCadPart(snapshot); assert.deepEqual(JSON.parse(text), doc);
  const again = outputOf(loadCadPart(text), 'L');
  assert.deepEqual(again.brep, o.brep); assert.deepEqual(massPropertiesOf(again), massPropertiesOf(o));
});

test('curved loft: existing circle sketches consume the same full-arc geometry in document evaluation', () => {
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 'a', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 2 },
    { id: 'b', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 },
    { id: 'L', kind: 'loft', sections: [{ sketch: 'a', frame: flat(0) }, { sketch: 'b', frame: flat(3) }] },
  ] };
  const o = outputOf(evaluateCadPart(doc), 'L'), direct = conic(circleProfile(2), circleProfile(4));
  valid(o.brep); assert.deepEqual(massPropertiesOf(o), direct.mass(1));
  assert.deepEqual(o.brep.faces.map(f => [f.name, f.surface]), direct.brep.faces.map(f => [f.name, f.surface]));
});

test('curved loft: document mixed encodings and malformed inline profiles retain typed failures', () => {
  const a = { profile: ellipseProfile(2, 1), frame: flat(0) }, b = { profile: ellipseProfile(4, 3), frame: flat(3) };
  const bad = [
    { ...a, sketch: 's' }, { ...a, z: 0 }, { profile: a.profile }, { profile: { ...a.profile, radii: [1] }, frame: a.frame },
    { profile: { ...a.profile, direction: 'wrong' }, frame: a.frame }, { profile: { kind: 'circle' }, frame: a.frame },
  ];
  for (const first of bad) {
    const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'L', kind: 'loft', sections: [first, b] }] };
    assert.throws(() => evaluateCadPart(doc), e => e instanceof CadPartError && typeof e.code === 'string');
  }
});
