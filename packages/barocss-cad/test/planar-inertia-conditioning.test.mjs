import test from 'node:test';
import assert from 'node:assert/strict';
import { brepMassProperties, brepSurfaceArea, checkBrep, evaluateCadPart, exportStep, facetBrepFromTriangles, importStep, transformBrep } from '../dist/index.js';
import { polyhedralIntegrals, solidMassFromIntegrals } from '../dist/brep/solid-mass.js';
import { readNativeSIInertia } from '../dist/internal/native-si-mass-state.js';

// Fixed before execution: physical fixture reserves, not kernel geometry tolerances.
const reserve = 4096 * Number.EPSILON, far = [999000, -998000, 997000], identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const document = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const ulp = x => x === 0 ? Number.MIN_VALUE : 2 ** (Math.floor(Math.log2(Math.abs(x))) - 52);
const close = (actual, expected, budget, label) => assert.ok(Math.abs(actual - expected) <= budget, `${label}: ${actual} vs ${expected}; budget ${budget}`);
const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function bounds(b) {
  const min = [0, 1, 2].map(k => Math.min(...b.vertices.map(v => v.point[k]))), max = [0, 1, 2].map(k => Math.max(...b.vertices.map(v => v.point[k])));
  return { min, max };
}
function nativeBox(center = far, dimensions = [2, 2, 2], scale = .001) {
  const b = evaluateCadPart(document([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: dimensions.slice(0, 2) },
    { id: 'e', kind: 'extrude', sketch: 's', height: dimensions[2] }])).outputs[0].brep;
  return transformBrep(b, { matrix: identity.map(x => x * scale), offset: center.map((x, k) => x - dimensions[k] * scale / 2) });
}
/** Axis-box closed form from its actual represented endpoints, evaluated in a small reference frame. */
function boxOracle(b, density, origin) {
  const d = b.max.map((x, k) => x - b.min[k]), volume = d[0] * d[1] * d[2], mass = density * .001 * volume;
  const centroid = b.min.map((x, k) => (x - origin[k]) + d[k] / 2);
  const inertia = [0, 1, 2].map(i => [0, 1, 2].map(j => i === j ? mass * (d[(i + 1) % 3] ** 2 + d[(i + 2) % 3] ** 2) / 12 : 0));
  return { volume, mass, centroid, inertia, area: 2 * (d[0] * d[1] + d[0] * d[2] + d[1] * d[2]), size: Math.max(...d), origin };
}
/** A uniform tetrahedron's independent vertex covariance, not boundary tetrahedral integration. */
function tetrahedronOracle(vertices, density) {
  const origin = vertices[0], p = vertices.map(v => v.map((x, k) => x - origin[k]));
  const volume = Math.abs(dot(p[1], cross(p[2], p[3]))) / 6, mass = density * .001 * volume;
  const centroid = [0, 1, 2].map(k => p.reduce((sum, v) => sum + v[k], 0) / 4);
  const covariance = [0, 1, 2].map(i => [0, 1, 2].map(j => volume / 20 * p.reduce((sum, v) => sum + (v[i] - centroid[i]) * (v[j] - centroid[j]), 0)));
  const trace = covariance[0][0] + covariance[1][1] + covariance[2][2], inertia = covariance.map((row, i) => row.map((x, j) => density * .001 * ((i === j ? trace : 0) - x)));
  let area = 0;
  for (const ids of [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]) {
    const lengths = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => Math.hypot(...p[ids[a]].map((x, k) => x - p[ids[b]][k]))), s = (lengths[0] + lengths[1] + lengths[2]) / 2;
    area += Math.sqrt(s * (s - lengths[0]) * (s - lengths[1]) * (s - lengths[2]));
  }
  return { volume, mass, centroid, inertia, area, size: Math.max(...p.flat().map(Math.abs)), origin };
}
function inspect(b, expected, density) {
  const snapshot = JSON.stringify(b), m = brepMassProperties(b, density), tensorScale = Math.max(...expected.inertia.map((row, i) => Math.abs(row[i])));
  assert.equal(m.method, 'planar-exact');
  close(m.volume, expected.volume, reserve * expected.volume, 'represented volume');
  close(m.mass, expected.mass, reserve * expected.mass, 'represented mass');
  close(brepSurfaceArea(b), expected.area, reserve * expected.area, 'represented area');
  for (let i = 0; i < 3; i++) {
    const center = expected.origin[i] + expected.centroid[i];
    close(m.centroid[i], center, 2 * ulp(center) + reserve * expected.size, `centroid${i}`);
    assert.ok(m.inertia[i][i] > 0, 'positive-volume physical fixture has positive diagonal inertia');
    for (let j = 0; j < 3; j++) {
      close(m.inertia[i][j], expected.inertia[i][j], reserve * tensorScale, `tensor${i}${j}`);
      assert.equal(m.inertia[i][j], m.inertia[j][i], 'exact tensor symmetry');
    }
  }
  for (const v of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 2, -3]]) assert.ok(dot(v, m.inertia.map(row => dot(row, v))) > 0, 'positive rotational energy');
  const si = readNativeSIInertia(m);
  assert.equal(si.ok, true, 'local central basis survives centroid restoration'); assert.equal(si.density, density);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) close(si.inertia[i][j], expected.inertia[i][j] * 1e-9, reserve * tensorScale * 1e-9, `SI tensor${i}${j}`);
  assert.equal(JSON.stringify(b), snapshot, 'native geometry, topology, UV data and tolerances remain unchanged');
  return m;
}

for (const [name, center, dimensions, scale] of [
  ['original represented far cube', far, [2, 2, 2], .001],
  ['centered tiny cube', [0, 0, 0], [2, 2, 2], .001],
  ['negative far cube', [-999000, 998000, -997000], [2, 2, 2], .001],
  ['cross-zero axis', [0, -998000, 997000], [2, 2, 2], .001],
  ['far anisotropic box', far, [2, 3, 4], .001],
  ['ordinary box', [32, 16, 4], [2, 3, 4], 1],
]) test(`${name}: all represented centroidal tensor entries and native SI basis`, () => {
  const b = nativeBox(center, dimensions, scale), bound = bounds(b);
  assert.equal(checkBrep(b).valid, true); assert.equal(b.vertices.length, 8);
  const corners = new Set(b.vertices.map(v => v.point.join(',')));
  for (let i = 0; i < 8; i++) assert.ok(corners.has([i & 1 ? bound.max[0] : bound.min[0], i & 2 ? bound.max[1] : bound.min[1], i & 4 ? bound.max[2] : bound.min[2]].join(',')));
  inspect(b, boxOracle(bound, 1, center), 1);
});

test('STEP roundtrip retains the native far axis-box physical tensor and source', () => {
  const authored = nativeBox(), source = JSON.stringify(authored), imported = importStep(exportStep(authored, { name: 'conditioned native box' }));
  assert.equal(checkBrep(imported).valid, true); assert.equal(imported.faces.length, 6); assert.equal(imported.edges.length, 12); assert.equal(imported.vertices.length, 8);
  assert.deepEqual(bounds(imported), bounds(authored));
  inspect(imported, boxOracle(bounds(imported), 1, far), 1);
  assert.equal(JSON.stringify(authored), source);
});

for (const rotated of [false, true]) test(`represented oblique facet tetrahedron retains nonzero products; rotated=${rotated}`, () => {
  const h = 2 ** -10, local = [[0, 0, 0], [4 * h, 0, 0], [h, 3 * h, 0], [h, h, 2 * h]];
  // Author the valid facet topology locally; this test targets mass, not a far-world mesh weld/orientation policy.
  const source = facetBrepFromTriangles(local.flat(), [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3], { id: 'represented-tetrahedron', weldDistance: 1e-12 });
  const b = transformBrep(source, { matrix: rotated ? [.6, -.8, 0, .8, .6, 0, 0, 0, 1] : identity, offset: far });
  assert.equal(checkBrep(b).valid, true); assert.equal(b.vertices.length, 4);
  const expected = tetrahedronOracle(b.vertices.map(v => v.point), 2.7);
  assert.ok(Math.abs(expected.inertia[0][1]) > reserve * expected.inertia[0][0], 'fixture has a physical nonzero product');
  inspect(b, expected, 2.7);
});

test('planar face holes retain signed contributions at a far center', () => {
  const source = evaluateCadPart(document([
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [8, 6] }, { id: 'e', kind: 'extrude', sketch: 's', height: 4 },
    { id: 'h', kind: 'sketch', profile: 'rectangle', min: [2, 2], max: [6, 4] }, { id: 't', kind: 'extrude', sketch: 'h', height: 8, from: -2 },
    { id: 'cut', kind: 'difference', target: 'e', tool: 't' },
  ])).outputs[0].brep;
  const b = transformBrep(source, { matrix: identity.map(x => x * .001), offset: [far[0] - .004, far[1] - .003, far[2] - .002] });
  assert.equal(checkBrep(b).valid, true); assert.ok(b.faces.some(f => f.loops.length === 2));
  const axes = [0, 1, 2].map(k => [...new Set(b.vertices.map(v => v.point[k]))].sort((a, b) => a - b));
  assert.deepEqual(axes.map(a => a.length), [4, 4, 2]);
  const outer = boxOracle({ min: axes.map(a => a[0]), max: axes.map(a => a.at(-1)) }, 1, far);
  const hole = boxOracle({ min: [axes[0][1], axes[1][1], axes[2][0]], max: [axes[0][2], axes[1][2], axes[2][1]] }, 1, far);
  const mass = outer.mass - hole.mass, centroid = outer.centroid.map((x, k) => (outer.mass * x - hole.mass * hole.centroid[k]) / mass);
  const inertia = [0, 1, 2].map(i => [0, 1, 2].map(j => [outer, hole].reduce((sum, part, n) => {
    const delta = part.centroid.map((x, k) => x - centroid[k]);
    return sum + (n === 0 ? 1 : -1) * (part.inertia[i][j] + part.mass * ((i === j ? dot(delta, delta) : 0) - delta[i] * delta[j]));
  }, 0)));
  const area = outer.area - 4 * (axes[0][2] - axes[0][1]) * (axes[1][2] - axes[1][1]) + hole.area;
  inspect(b, { volume: outer.volume - hole.volume, mass, centroid, inertia, area, size: outer.size, origin: far }, 1);
});

for (const first of ['mass', 'area']) test(`${first}-first cache preserves raw world moments, density and local mass`, () => {
  const b = nativeBox(), snapshot = JSON.stringify(b);
  if (first === 'mass') brepMassProperties(b, 1); else brepSurfaceArea(b);
  const raw = polyhedralIntegrals(b), values = [...raw], bound = bounds(b);
  assert.ok(raw[4] > 1000, 'exported raw second moment remains at the world origin');
  assert.equal('origin' in raw, false); assert.equal('integrals' in raw, false);
  for (const density of [1, 2.7, 7.85]) inspect(b, boxOracle(bound, density, far), density);
  assert.equal(polyhedralIntegrals(b), raw, 'world raw array identity remains cached'); assert.deepEqual([...raw], values);
  assert.equal(brepSurfaceArea(b), raw[10]); assert.equal(JSON.stringify(b), snapshot);
});

test('all-zero conditioning origin retains the exact legacy mass arithmetic', () => {
  const b = nativeBox([0, 0, 0]), raw = polyhedralIntegrals(b);
  assert.deepEqual(brepMassProperties(b, 2.7), solidMassFromIntegrals(raw, 2.7, 'planar-exact'));
});

test('density refusals remain unchanged for conditioned planar mass', () => {
  const b = nativeBox();
  for (const density of [0, -1, NaN, Infinity]) assert.throws(() => brepMassProperties(b, density), e => e.code === 'SOLID_MASS');
});
