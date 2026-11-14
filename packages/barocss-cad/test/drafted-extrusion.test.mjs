import test from 'node:test';
import assert from 'node:assert/strict';
import { draftedExtrusion, evaluateCadPart, checkBrep, tessellateBrep, CadPartError, massPropertiesOf, evaluateCurve, evaluateSurface } from '../dist/index.js';

const pi = Math.PI, tan = d => Math.tan(d * pi / 180);
const rect = (x0, y0, x1, y1) => [{ kind: 'line', start: [x0, y0] }, { kind: 'line', start: [x1, y0] }, { kind: 'line', start: [x1, y1] }, { kind: 'line', start: [x0, y1] }];
function mesh(b, q = 32) {
  const m = tessellateBrep(b, { segmentsPerQuarter: q }), p = m.positions, ix = m.indices, he = new Map(), key = i => p[i * 3] + ',' + p[i * 3 + 1] + ',' + p[i * 3 + 2];
  let v = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b2, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
    v += (p[a] * (p[b2 + 1] * p[c + 2] - p[b2 + 2] * p[c + 1]) - p[a + 1] * (p[b2] * p[c + 2] - p[b2 + 2] * p[c]) + p[a + 2] * (p[b2] * p[c + 1] - p[b2 + 1] * p[c])) / 6;
    for (let e = 0; e < 3; e++) { const k = key(ix[t + e]) + '>' + key(ix[t + (e + 1) % 3]); he.set(k, (he.get(k) ?? 0) + 1); }
  }
  return { volume: v, watertight: [...he].every(([k, n]) => { const [x, y] = k.split('>'); return he.get(y + '>' + x) === n; }) };
}
const near = (a, b, rel) => Math.abs(a - b) <= rel * Math.abs(b);
/** ∫ area(section shrunk by z·tan θ) dz by midpoint quadrature. */
const integral = (area, h, deg, n = 4000) => { let v = 0; for (let i = 0; i < n; i++) v += area((i + 0.5) / n * h * tan(deg)) * h / n; return v; };

const halfDisk = [{ kind: 'line', start: [-10, 0] }, { kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }];
const halfDiskDoc = (draft, height = 10, plane) => ({
  format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {},
  features: [
    { id: 's', kind: 'sketch', profile: 'loop', segments: halfDisk, sideTags: { outer: ['line', 'arc'] }, ...(plane ? { plane } : {}) },
    { id: 'e', kind: 'extrude', sketch: 's', height, draft },
  ],
});

function halfDiskIntegral(h, angle, n) {
  const slope = tan(angle);
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const d = h * slope * i / n, radius = 10 - d;
    const area = radius ** 2 * Math.acos(d / radius) - d * Math.sqrt(radius ** 2 - d ** 2);
    sum += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * area;
  }
  return sum * h / (3 * n);
}

test('inward drafted half-disk has two exact parabolas, shared by its plane and two conical faces', () => {
  const slope = tan(10), d = 10 * slope;
  const [out] = evaluateCadPart(halfDiskDoc(10)).outputs;
  const { brep } = out, report = checkBrep(brep, { strict: true });
  assert.equal(report.valid, true, report.issues.join('\n'));
  assert.deepEqual(report.counts, { bodies: 1, shells: 1, faces: 5, loops: 5, coedges: 18, edges: 9, vertices: 6 });
  assert.equal(report.topology[0].genus, 0);
  assert.equal(brep.shells[0].closed, true);
  const curved = ['e.side[arc]#1', 'e.side[arc]#2'], wall = 'e.side[line]';
  assert.deepEqual(brep.faces.map(f => f.name).sort(), ['e.bottom', 'e.top', wall, ...curved].sort());
  for (const [i, name] of curved.entries()) {
    const surface = brep.faces.find(f => f.name === name).surface;
    assert.deepEqual([surface.degreeU, surface.degreeV], [2, 1]);
    const common = [name, wall].sort().join('|'), edges = brep.edges.filter(edge => edge.name === common);
    assert.equal(edges.length, 1);
    const curve = edges[0].curve;
    assert.deepEqual([curve.degree, curve.weights], [2, [1, 1, 1]]);
    const sign = i === 0 ? 1 : -1;
    assert.deepEqual(evaluateCurve(curve, 0), [sign * 10, 0, 0]);
    assert.ok(near(evaluateCurve(curve, 1)[0], sign * Math.sqrt(100 - 20 * d), 1e-13));
    for (const t of [.13, .25, .5, .75, .89]) {
      const [x, y, z] = evaluateCurve(curve, t);
      assert.ok(Math.abs(y - slope * z) < 1e-10, 'exact plane intersection');
      assert.ok(Math.abs(Math.hypot(x, y) - (10 - slope * z)) < 1e-10, 'exact cone intersection');
      const [a, b, c] = evaluateSurface(surface, t, 1 - t);
      assert.ok(Math.abs(Math.hypot(a, b) - (10 - slope * c)) < 1e-10, 'exact support between boundary curves');
    }
  }
  assert.ok(mesh(brep).watertight);
  for (const [angle, output] of [[10, out], [14, evaluateCadPart(halfDiskDoc(14)).outputs[0]]]) {
    const reference = halfDiskIntegral(10, angle, 8192), mass = massPropertiesOf(output);
    assert.ok(Math.abs(reference - halfDiskIntegral(10, angle, 4096)) < 1e-9);
    assert.equal(mass.method, 'quadrature', JSON.stringify(mass));
    assert.ok(Math.abs(mass.volume - reference) < 1e-7, JSON.stringify({ angle, mass, reference }));
  }
});

test('inward half-disk Draft uses the sketch frame and refuses collapse or nearby unsupported profiles', () => {
  const plane = { origin: [3, -7, 11], normal: [0, -.5, Math.sqrt(3) / 2], xAxis: [1, 0, 0] };
  const world = evaluateCadPart(halfDiskDoc(10, -10, plane)).outputs[0].brep;
  const report = checkBrep(world, { strict: true });
  assert.equal(report.valid, true, report.issues.join('\n'));
  assert.ok(world.vertices.some(({ point: p }) => p.every((x, i) => Math.abs(x - [13, -7, 11][i]) < 1e-9)));
  assert.ok(world.vertices.some(({ point: p }) => Math.abs(p.reduce((sum, x, i) => sum + (x - plane.origin[i]) * plane.normal[i], 0) + 10) < 1e-9));
  // The second case leaves a positive 0.00000005 mm sag, below the native 0.0000001 mm linear floor.
  for (const angle of [Math.atan(.5) * 180 / pi, Math.atan((10 - 5e-8) / 20) * 180 / pi, 30])
    assert.throws(() => evaluateCadPart(halfDiskDoc(angle)), e => e.code === 'PARAMETER' && /closes the half-disk/.test(e.message));
  assert.throws(() => evaluateCadPart(halfDiskDoc(-10)), e => e.code === 'CAPABILITY' && /not tangent/.test(e.message));
  const nearHalf = [{ ...halfDisk[0] }, { ...halfDisk[1], center: [0, -.01] }];
  assert.throws(() => draftedExtrusion({ profile: nearHalf, z0: 0, z1: 10, draft: 10, tag: 'e' }), /not tangent/);
});

test('half-disk Draft keeps authored tags for a reversed loop in a translated cardinal orientation', () => {
  const profile = [{ kind: 'arc', start: [4, -13], center: [4, -3], direction: 'cw' }, { kind: 'line', start: [4, 7] }];
  const brep = draftedExtrusion({ profile, sideTags: ['arc', 'line'], z0: 2, z1: 12, draft: 10, tag: 'e' });
  const seams = brep.edges.filter(e => /side\[line\]/.test(e.name) && /side\[arc\]/.test(e.name));
  assert.equal(seams.length, 2);
  const slope = tan(10);
  for (const { curve } of seams) for (const t of [0, .35, .8, 1]) {
    const [x, y, z] = evaluateCurve(curve, t), shift = slope * (z - 2);
    assert.ok(Math.abs(4 - x - shift) < 1e-10);
    assert.ok(Math.abs(Math.hypot(x - 4, y + 3) - (10 - shift)) < 1e-10);
  }
  assert.equal(checkBrep(brep, { strict: true }).valid, true);
});

test('half-disk Draft checks the modeling range after placing the translated profile', () => {
  const make = (y, z0 = 0, z1 = 10) => draftedExtrusion({
    profile: [{ kind: 'line', start: [-1000, y] }, { kind: 'arc', start: [1000, y], center: [0, y], direction: 'ccw' }],
    z0, z1, draft: 10, tag: 'e',
  });
  const atLimit = make(9000, 9990, 10000);
  assert.ok(atLimit.vertices.some(v => v.point[1] === 10000));
  assert.ok(atLimit.vertices.some(v => v.point[2] === 10000));
  assert.equal(checkBrep(atLimit, { strict: true }).valid, true);
  assert.throws(() => make(9500), /modeling coordinate range/);
  assert.throws(() => make(9000, 9991, 10001), /modeling coordinate range/);
});

test('drafted extrusions: sloping planes and cones, exact volumes, upright names', () => {
  const slot = [{ kind: 'line', start: [0, -4] }, { kind: 'arc', start: [20, -4], center: [20, 0], direction: 'ccw' }, { kind: 'line', start: [20, 4] }, { kind: 'arc', start: [0, 4], center: [0, 0], direction: 'ccw' }];
  const ell = [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [30, 0] }, { kind: 'line', start: [30, 10] }, { kind: 'line', start: [10, 10] }, { kind: 'line', start: [10, 30] }, { kind: 'line', start: [0, 30] }];
  const cases = [
    ['a box leaning in 5°', rect(0, 0, 40, 30), 10, 5, d => (40 - 2 * d) * (30 - 2 * d), 1e-9],
    ['a box leaning out 5°', rect(0, 0, 40, 30), 10, -5, d => (40 - 2 * d) * (30 - 2 * d), 1e-9],
    ['an L (the reflex corner too)', ell, 8, 4, d => (30 - 2 * d) * (10 - 2 * d) + (10 - 2 * d) * 20, 1e-9],
    ['a slot (cones on tangent arcs)', slot, 6, 3, d => 20 * 2 * (4 - d) + pi * (4 - d) ** 2, 2e-4],
    ['a cylinder (a cone frustum)', [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], 10, 10, d => pi * (10 - d) ** 2, 5e-4],
  ];
  for (const [name, profile, h, deg, area, rel] of cases) {
    const b = draftedExtrusion({ profile, z0: 0, z1: h, draft: deg, tag: 'e' }), report = checkBrep(b), m = mesh(b);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.ok(m.watertight, `${name}: watertight`);
    assert.ok(near(m.volume, integral(area, h, deg), rel), `${name}: ${m.volume} vs ${integral(area, h, deg)}`);
    assert.ok(b.faces.some(f => f.name === 'e.top') && b.faces.some(f => f.name === 'e.bottom') && b.faces.some(f => f.name.startsWith('e.side')));
  }
  assert.throws(() => draftedExtrusion({ profile: rect(0, 0, 4, 4), z0: 0, z1: 10, draft: 20, tag: 'e' }), /closes a straight wall/);
  assert.throws(() => draftedExtrusion({ profile: [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [10, 0], center: [10, 5], direction: 'ccw' }, { kind: 'line', start: [10, 10] }], z0: 0, z1: 5, draft: 3, tag: 'e' }), /not tangent/);
});

test('extrude with draft in the part model: up and down, then holes and fillets on it', () => {
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const s = { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, d = 10 * tan(5);
  const exact = 10 * (40 * 30 - 70 * d + 4 * d * d / 3);
  for (const [height, from, z] of [[10, 0, [0, 10]], [-10, 5, [-5, 5]]]) {
    const o = evaluateCadPart(D([s, { id: 'e', kind: 'extrude', sketch: 's', height, from, draft: 5 }])).outputs[0], zs = o.brep.vertices.map(v => v.point[2]);
    assert.equal(checkBrep(o.brep).valid, true);
    assert.ok(near(massPropertiesOf(o).volume, exact, 1e-9), String(massPropertiesOf(o).volume));
    assert.deepEqual([Math.min(...zs), Math.max(...zs)], z);
  }
  // Fillets along sloping walls: one edge, and two meeting at a corner (their mitre).
  for (const draft of [3, 5, 8]) for (const r of [1, 2]) for (const edges of [['e.side0|e.top'], ['e.side0|e.top', 'e.side1|e.top']]) {
    const o = evaluateCadPart(D([s, { id: 'e', kind: 'extrude', sketch: 's', height: 10, draft }, { id: 'f', kind: 'fillet', target: 'e', edges, radius: r }])).outputs[0];
    assert.equal(checkBrep(o.brep).valid, true, `draft ${draft}, r ${r}, ${edges}`);
  }
  const holed = evaluateCadPart(D([s, { id: 'e', kind: 'extrude', sketch: 's', height: 10, draft: 5 }, { id: 'h', kind: 'hole', target: 'e', center: [20, 15], radius: 4 }, { id: 'f', kind: 'fillet', target: 'h', edges: ['e.side0|e.top', 'e.top|h.side0#1'], radius: 1 }])).outputs[0];
  assert.equal(checkBrep(holed.brep).valid, true, 'a hole through the drafted box, its rim and a sloping edge filleted');
  assert.throws(() => evaluateCadPart(D([s, { id: 'e', kind: 'extrude', sketch: 's', height: 10, draft: 89 }])), e => e instanceof CadPartError && e.code === 'INPUT');
});
