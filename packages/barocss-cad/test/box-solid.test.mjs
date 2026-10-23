import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAxisBoxSolid } from '../dist/core/box-solid.js';
import { buildAxisBoxShell, validateAxisBoxShell } from '../dist/core/box-shell.js';
import { buildParametricFace, validateFaceBundle } from '../dist/core/face.js';
import { evaluateSurfaceD1 } from '../dist/core/derivatives.js';

const table = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];
const pinned = [[[0, 0, 0], [1, 1, 1], 1, 6], [[0, 0, 0], [2, 3, 5], 30, 62], [[-7, 11, -13], [4, 6, 9], 216, 228], [[9998, -10000, 0], [2, 3, 1], 6, 22]];
const shellReport = { incidenceValid: true, geometryFamily: 'exact-axis-box-shell-v0', closed: true, solid: false, solidProductImplemented: false };
const localIds = () => ({ faceId: 'face', loopId: 'loop', vertexIds: ['v0', 'v1', 'v2', 'v3'], edgeIds: ['e0', 'e1', 'e2', 'e3'], curveIds: ['c0', 'c1', 'c2', 'c3'] });
const globalIds = () => ({ shellId: 'shell', faceIds: Array.from({ length: 6 }, (_, i) => `f${i}`), vertexIds: Array.from({ length: 8 }, (_, i) => `g${i}`), edgeIds: Array.from({ length: 12 }, (_, i) => `ge${i}`) });
function makeShell(origin = [0, 0, 0], sides = [2, 3, 5]) {
  const p = Array.from({ length: 8 }, (_, i) => origin.map((x, axis) => ((i >> axis) & 1) ? x + sides[axis] : x));
  const bundles = table.map((face) => buildParametricFace({ kind: 'surface', id: 'surface', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], weights: [[1, 1], [1, 1]], controlPoints: [[p[face[0]], p[face[3]]], [p[face[1]], p[face[2]]]] }, localIds()));
  return buildAxisBoxShell(origin, sides, bundles, globalIds());
}
function expected(origin, sides, volume = sides[0] * sides[1] * sides[2], area = 2 * (sides[0] * sides[1] + sides[1] * sides[2] + sides[2] * sides[0])) {
  return { valid: true, geometryFamily: 'exact-axis-box-solid-v0', closed: true, solid: true, volumeMM3: volume, areaMM2: area, boundsMM: { min: [...origin], max: origin.map((x, i) => x + sides[i]) } };
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

test('four freshly constructed shells yield exact bounded solid values and independent native flux evidence', () => {
  for (const [origin, sides, volume, area] of pinned) {
    const shell = makeShell(origin, sides), before = structuredClone(shell), report = validateAxisBoxSolid(shell);
    assert.deepEqual(report, expected(origin, sides, volume, area));
    assert.ok(Number.isSafeInteger(report.volumeMM3) && Number.isSafeInteger(report.areaMM2));
    assert.deepEqual(validateAxisBoxShell(shell), shellReport);
    let measuredArea = 0, flux = 0;
    for (const face of shell.faces) {
      assert.deepEqual(validateFaceBundle(face.bundle), { incidenceValid: true, geometricValidity: 'not-certified', solid: false });
      const { point, du, dv } = evaluateSurfaceD1(face.bundle.geometry.objects[0], .5, .5), normal = cross(du, dv);
      measuredArea += Math.hypot(...normal); flux += point.reduce((sum, x, i) => sum + x * normal[i], 0) / 3;
    }
    assert.ok(Math.abs(measuredArea - area) <= 1e-7 * Math.max(1, area)); assert.ok(Math.abs(flux - volume) <= 1e-7 * Math.max(1, volume));
    assert.deepEqual(shell, before);
    console.log(JSON.stringify({ origin, sides, volumeMM3: volume, areaMM2: area, nativeFluxVolumeMM3: flux, floatingEvidenceOnly: true }));
  }
});

test('maximum lengths retain safe integer coefficient values and exact accepted bounds', () => {
  const shell = makeShell([-10000, -10000, -10000], [10000, 10000, 10000]);
  const report = validateAxisBoxSolid(shell);
  assert.deepEqual(report, expected([-10000, -10000, -10000], [10000, 10000, 10000], 1e12, 6e8));
  assert.ok(Number.isSafeInteger(report.volumeMM3) && Number.isSafeInteger(report.areaMM2));
});

test('reports and min/max arrays are owned independently of caller data and previous reports', () => {
  const shell = makeShell(), before = structuredClone(shell), first = validateAxisBoxSolid(shell), second = validateAxisBoxSolid(shell);
  assert.deepEqual(first, second); assert.notEqual(first, second); assert.notEqual(first.boundsMM, second.boundsMM);
  assert.notEqual(first.boundsMM.min, first.boundsMM.max); assert.notEqual(first.boundsMM.min, shell.origin);
  assert.notEqual(first.boundsMM.min, second.boundsMM.min); assert.notEqual(first.boundsMM.max, second.boundsMM.max);
  first.boundsMM.min[0] = 999; first.boundsMM.max[0] = 999; first.volumeMM3 = -1;
  assert.deepEqual(shell, before); assert.deepEqual(validateAxisBoxSolid(shell), second);
  const old = validateAxisBoxShell(shell); assert.deepEqual(old, shellReport); assert.equal(old.solid, false);
});

test('one caller snapshot remains authoritative when reflection changes the caller after descriptor capture', () => {
  const target = makeShell(), original = structuredClone(target), descriptorReads = new Map();
  let propertyReads = 0, ownKeysCalls = 0, mutated = false;
  // Proxy reflection is caller-controlled; this does not promise atomic reads
  // against arbitrary Proxy behavior. Replacing origin/sides after their data
  // descriptors were captured specifically detects a second untrusted read.
  const hostile = new Proxy(target, {
    ownKeys(value) { ownKeysCalls++; return Reflect.ownKeys(value); },
    get(value, key, receiver) { propertyReads++; return Reflect.get(value, key, receiver); },
    getOwnPropertyDescriptor(value, key) {
      descriptorReads.set(key, (descriptorReads.get(key) ?? 0) + 1);
      const captured = Reflect.getOwnPropertyDescriptor(value, key);
      if (key === 'edges' && !mutated) { mutated = true; value.origin = [1000, 1000, 1000]; value.sides = [9, 9, 9]; }
      return captured;
    },
  });
  const report = validateAxisBoxSolid(hostile);
  assert.equal(mutated, true); assert.deepEqual(report, expected(original.origin, original.sides));
  assert.deepEqual(target.origin, [1000, 1000, 1000]); assert.deepEqual(target.sides, [9, 9, 9]);
  assert.equal(propertyReads, 0, 'No caller property reads are allowed after the own-data guard');
  assert.equal(descriptorReads.size, Object.keys(original).length);
  for (const count of descriptorReads.values()) assert.equal(count, 1, 'Root descriptors must be read for one caller snapshot only');
  assert.ok(ownKeysCalls >= 1 && ownKeysCalls <= 2, 'One bounded descriptor extraction, not two caller snapshots');
  assert.throws(() => validateAxisBoxShell(target));
});

test('frozen aliased source arrays and signed zeros survive into independent bounds', () => {
  const shell = makeShell([-0, 0, 0], [2, 3, 5]);
  for (const face of shell.faces) face.bundle.geometry.objects[0].knotsV = face.bundle.geometry.objects[0].knotsU;
  const before = structuredClone(shell);
  function freeze(value) { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } }
  freeze(shell); const report = validateAxisBoxSolid(shell);
  assert.ok(Object.is(report.boundsMM.min[0], -0)); assert.ok(Object.is(shell.origin[0], -0));
  assert.notEqual(report.boundsMM.min, shell.origin); assert.deepEqual(shell, before);
  report.boundsMM.min[0] = 999; assert.deepEqual(shell, before); assert.deepEqual(validateAxisBoxShell(shell), shellReport);
});

test('invalid geometry and twelve global failures reject before returning positive volume', () => {
  const shell = makeShell();
  function changeFace(d, kind) {
    const source = structuredClone(d.faces[0].bundle.geometry.objects[0]);
    if (kind === 'inward') { source.controlPoints.reverse(); source.weights.reverse(); }
    if (kind === 'near') for (const row of source.controlPoints) for (const p of row) p[0] += 1e-10;
    if (kind === 'partial') for (let u = 0; u < 2; u++) source.controlPoints[u][1] = source.controlPoints[u][0].map((x, k) => (x + source.controlPoints[u][1][k]) / 2);
    if (kind === 'weighted') source.weights = [[1, 2], [3, 4]];
    if (kind === 'non-axis') { source.controlPoints[1][0][0] += 1; source.controlPoints[1][1][0] += 1; }
    d.faces[0].bundle = buildParametricFace(source, localIds()); assert.equal(validateFaceBundle(d.faces[0].bundle).incidenceValid, true);
  }
  const mutations = {
    missingFace: (d) => d.faces.pop(), duplicateFace: (d) => { d.faces[1].bundle = structuredClone(d.faces[0].bundle); }, inwardFace: (d) => changeFace(d, 'inward'),
    reversedUse: (d) => { d.edges[0].uses[1].sense = 'forward'; }, missingUse: (d) => d.edges[0].uses.pop(), duplicateUse: (d) => d.edges[0].uses.push(structuredClone(d.edges[0].uses[0])),
    wrongOwner: (d) => { d.edges[0].canonical.faceId = d.faces[0].id; }, wrongVertex: (d) => d.edges[0].vertexIds.reverse(), minutePoint: (d) => { d.vertices[0].point[0] += 1e-10; },
    nearFace: (d) => changeFace(d, 'near'), partialFace: (d) => changeFace(d, 'partial'), zeroSide: (d) => { d.sides[0] = 0; },
    weighted: (d) => changeFace(d, 'weighted'), nonAxis: (d) => changeFace(d, 'non-axis'), malformedNative: (d) => { d.faces[0].bundle.geometry.objects[0].controlPoints[0][0][0] = null; },
  };
  for (const [name, mutate] of Object.entries(mutations)) { const d = structuredClone(shell); mutate(d); assert.throws(() => validateAxisBoxSolid(d), name); }
  assert.equal(shell.sides.reduce((value, x) => value * x, 1), 30);
  const inward = structuredClone(shell); changeFace(inward, 'inward'); assert.equal(inward.sides.reduce((value, x) => value * x, 1), 30); assert.throws(() => validateAxisBoxSolid(inward));
});

test('strict cached-value, accessor, foreign, sparse, symbol and resource guards never execute getters', () => {
  const shell = makeShell(); let getters = 0;
  const mutations = [
    (d) => { d.valid = true; }, (d) => { d.volumeMM3 = 999; }, (d) => { d.areaMM2 = 999; }, (d) => { d.proof = { solid: true }; },
    (d) => Object.defineProperty(d, 'sides', { get() { getters++; return [9, 9, 9]; } }),
    (d) => Object.defineProperty(d.faces[0].bundle.geometry.objects[0].controlPoints[0][0], '0', { get() { getters++; return 0; } }),
    (d) => Object.defineProperty(d, 'hidden', { value: 1, enumerable: false }), (d) => { d[Symbol('foreign')] = 1; },
    (d) => { delete d.vertices[0].point[0]; }, (d) => { d.origin[0] = Infinity; },
    (d) => { d.edges[0].vertexIds = { 0: d.edges[0].vertexIds[0], 1: d.edges[0].vertexIds[1] }; },
    (d) => { d.cycle = d; }, (d) => { d.faces = Array(129).fill(d.faces[0]); },
    (d) => { for (let i = 0; i < 17; i++) d[`foreign${i}`] = 0; },
    (d) => { let nested = d; for (let i = 0; i < 20; i++) nested = nested.foreign = {}; },
    (d) => { d.payload = Array.from({ length: 128 }, () => Array.from({ length: 128 }, () => [0, 0, 0])); },
  ];
  for (const mutate of mutations) { const d = structuredClone(shell); mutate(d); assert.throws(() => validateAxisBoxSolid(d)); }
  assert.throws(() => validateAxisBoxSolid(null)); assert.throws(() => validateAxisBoxSolid({ isValid: () => true })); assert.throws(() => validateAxisBoxSolid(Object.create(shell)));
  assert.equal(getters, 0); assert.deepEqual(validateAxisBoxSolid(shell), expected(shell.origin, shell.sides));
});
