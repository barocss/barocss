import test from 'node:test';
import assert from 'node:assert/strict';
import { loftSolid, checkBrep, evaluateSurface, surfaceDomain, tessellateBrep } from '../dist/index.js';
import { framedNurbsLoftSolid } from '../dist/features/framed-nurbs-loft.js';
import { readNativeSIInertia } from '../dist/internal/native-si-mass-state.js';

const square = w => [[0, 0], [w, 0], [w, w], [0, w]].map(start => ({ kind: 'line', start }));
const circle = r => [{ kind: 'arc', start: [r, 0], center: [0, 0], direction: 'ccw' }];
const stadium = () => [{ kind: 'line', start: [-2, -1] }, { kind: 'arc', start: [2, -1], center: [2, 0], direction: 'ccw' }, { kind: 'line', start: [2, 1] }, { kind: 'arc', start: [-2, 1], center: [-2, 0], direction: 'ccw' }];
const frames = [
  { u: [0, 1, 0], v: [0, 0, 1], n: [1, 0, 0], origin: [-2, 3, 4] },
  { u: [0, 0, 1], v: [1, 0, 0], n: [0, 1, 0], origin: [2, -3, 4] },
  { u: [1, 0, 0], v: [0, -1, 0], n: [0, 0, -1], origin: [2, 3, -4] },
  { u: [1, 0, 0], v: [0, 0.6, 0.8], n: [0, -0.8, 0.6], origin: [0, 0, 0] },
];
const world = (f, p) => p.map((_, c) => f.u[c] * p[0] + f.v[c] * p[1] + f.n[c] * p[2] + f.origin[c]);
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function guide(count, degree, seam = [0, 0], shift = [0, 0]) {
  const knots = [...Array(degree + 1).fill(0), ...Array.from({ length: count - degree - 1 }, (_, i) => (i + 1) / (count - degree)), ...Array(degree + 1).fill(1)];
  const controlPoints = Array.from({ length: count }, (_, i) => {
    const z = knots.slice(i + 1, i + degree + 1).reduce((a, b) => a + b, 0) / degree;
    return [seam[0] + shift[0] * z, seam[1] + shift[1] * z, z];
  });
  return { kind: 'nurbs', degree, knots, controlPoints };
}
function fixture(f, sections = 2, controls = 4, profile = 'square', shift = [0, 0], taper = false) {
  const p = z => profile === 'square' ? square(taper ? 1 + z : 1) : profile === 'circle' ? circle(1) : stadium();
  const seam = p(0)[0].start, g = guide(controls, Math.min(3, controls - 1), seam, shift);
  const local = { id: 'L', name: 'L', sections: Array.from({ length: sections }, (_, i) => {
    const z = i / (sections - 1), d = [shift[0] * z, shift[1] * z];
    return { z, profile: p(z).map(s => ({ ...s, start: s.start.map((x, c) => x + d[c]), ...(s.kind === 'arc' ? { center: s.center.map((x, c) => x + d[c]) } : {}) })) };
  }), guide: g };
  const raw = { ...local, sections: local.sections.map((s, i) => ({ profile: p(s.z), frame: { origin: world(f, [shift[0] * s.z, shift[1] * s.z, s.z]), xAxis: [...f.u], yAxis: [...f.v] } })), guide: { ...g, controlPoints: g.controlPoints.map(p => world(f, p)) } };
  return { local, raw };
}
function valid(brep) {
  const report = checkBrep(brep, { strict: true }); assert.equal(report.valid, true, JSON.stringify(report.issues));
  assert.equal(brep.bodies.length, 1); assert.equal(brep.shells.length, 1); assert.ok(brep.shells[0].closed);
  assert.ok(brep.coedges.every(c => c.twin !== null));
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: 4 }); assert.ok(mesh.positions.every(Number.isFinite));
  assert.ok(mesh.indices.every(i => i >= 0 && i < mesh.positions.length / 3));
}
function surfaceOracle(actual, local, f) {
  assert.equal(actual.faces.length, local.faces.length);
  for (let k = 0; k < actual.faces.length; k++) {
    const a = actual.faces[k], b = local.faces[k]; assert.equal(a.name, b.name);
    const { u, v } = surfaceDomain(b.surface), domain = surfaceDomain(a.surface);
    for (const x of [0, 0.2, 0.5, 0.9, 1]) for (const y of [0, 0.3, 0.7, 1]) {
      const s = u[0] + x * (u[1] - u[0]), t = v[0] + y * (v[1] - v[0]);
      const p = evaluateSurface(a.surface, domain.u[0] + x * (domain.u[1] - domain.u[0]), domain.v[0] + y * (domain.v[1] - domain.v[0])), expected = world(f, evaluateSurface(b.surface, s, t));
      p.forEach((value, c) => close(value, expected[c]));
    }
  }
}
// Independent tensor rotation; no production mass transform is used for the expected values.
function massOracle(actual, local, f) {
  close(actual.volume, local.volume); close(actual.mass, local.mass); assert.equal(actual.method, local.method);
  world(f, local.centroid).forEach((value, c) => close(actual.centroid[c], value));
  const R = [0, 1, 2].map(c => [f.u[c], f.v[c], f.n[c]]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let expected = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) expected += R[i][a] * local.inertia[a][b] * R[j][b];
    close(actual.inertia[i][j], expected, 1e-11);
  }
}

test('raw polynomial frames: 2/3/8 sections, +X/+Y/negative normals, in-plane origins, and 17/64 controls', () => {
  for (const f of frames.slice(0, 3)) for (const sections of [2, 3, 8]) for (const controls of [4, 17, 64]) {
    const { raw, local } = fixture(f, sections, controls, 'square', [2, 1], true), before = structuredClone(raw);
    const made = loftSolid(raw), reference = loftSolid(local); valid(made.brep); surfaceOracle(made.brep, reference.brep, f);
    const m = made.mass(1); close(m.volume, 7 / 3); massOracle(m, reference.mass(1), f); assert.deepEqual(raw, before);
    // Pure affine taper: independent slice integrals, with x=(1+z)*a+2z and y=(1+z)*b+z.
    const C = [113 / 56, 79 / 56, 17 / 28]; world(f, C).forEach((x, c) => close(m.centroid[c], x));
  }
});

test('raw polynomial frames: a certified non-permutation rigid direction has independent prism V/C/I', () => {
  const f = frames[3], { raw, local } = fixture(f, 2, 3);
  for (const input of [raw, local]) for (const section of input.sections) section.profile = [[0, 0], [2, 0], [2, 1], [0, 1]].map(start => ({ kind: 'line', start }));
  const before = structuredClone(raw), made = loftSolid(raw);
  valid(made.brep); surfaceOracle(made.brep, loftSolid(local).brep, f);
  massOracle(made.mass(2), { volume: 2, mass: 0.004, centroid: [1, 0.5, 0.5], inertia: [[1 / 1500, 0, 0], [0, 1 / 600, 0], [0, 0, 1 / 600]], method: made.mass(2).method }, f);
  assert.deepEqual(raw, before);
});

test('raw polynomial frames: circle and mixed line/arc admission is retained for 2/3/8 sections', () => {
  for (const profile of ['circle', 'mixed']) for (const sections of [2, 3, 8]) {
    const f = frames[0], { raw, local } = fixture(f, sections, 17, profile, [2, 1]), before = structuredClone(raw);
    const made = loftSolid(raw), reference = loftSolid(local); valid(made.brep); surfaceOracle(made.brep, reference.brep, f);
    close(made.mass(1).volume, profile === 'circle' ? Math.PI : 8 + Math.PI);
    massOracle(made.mass(1), reference.mass(1), f); assert.deepEqual(raw, before);
    assert.ok(made.brep.faces.some(f => f.surface.weights.flat().some(w => w !== 1)));
  }
});

test('raw polynomial frames: world seam and cap correspondence includes a genuinely bowed guide', () => {
  const f = frames[0], { raw, local } = fixture(f, 2, 4);
  local.guide.controlPoints[1][0] = 2; local.guide.controlPoints[2][1] = -1;
  raw.guide.controlPoints = local.guide.controlPoints.map(p => world(f, p));
  const made = loftSolid(raw), reference = loftSolid(local); valid(made.brep); surfaceOracle(made.brep, reference.brep, f); massOracle(made.mass(1), reference.mass(1), f);
  const seam = made.brep.edges.find(e => e.curve.controlPoints.length === 4 && e.curve.controlPoints.every((p, i) => p.every((x, c) => x === raw.guide.controlPoints[i][c])));
  assert.ok(seam, 'the actual world seam retains every authored source control');
});

test('raw polynomial frames: source arrays and returned mass are isolated from subsequent input mutation', () => {
  const { raw } = fixture(frames[0], 3, 17), made = loftSolid(raw), brep = structuredClone(made.brep), m = made.mass(1);
  raw.sections[0].frame.origin.fill(900); raw.sections[0].frame.xAxis.fill(9); raw.sections[1].profile[0].start.fill(700);
  raw.guide.knots.fill(5); raw.guide.controlPoints[1].fill(800);
  assert.deepEqual(made.brep, brep); assert.deepEqual(made.mass(1), m);
});

test('raw polynomial frames: typed refusals preserve every input, including failed late guide admission', () => {
  const cases = [
    r => { r.sections[1].frame.xAxis = [1, 0, 0]; },
    r => { r.sections[1].frame.origin = [...r.sections[0].frame.origin]; },
    r => { r.sections.reverse(); },
    r => { r.sections[1].z = 1; },
    r => { r.sections[0].profile = { kind: 'ellipse', center: [0, 0], radii: [1, 2] }; },
    r => { r.guide.weights = Array(r.guide.controlPoints.length).fill(1); },
    r => { r.guide.controlPoints[0][1] += 0.2; },
    r => { r.guide.controlPoints[1][0] = r.guide.controlPoints.at(-1)[0] + 1; },
    r => { r.guide.controlPoints[1][0] = NaN; },
    r => { r.smooth = true; },
    r => { r.guide.controlPoints = Array(65).fill([0, 0, 0]); },
    r => { r.guide.knots = Array(71).fill(0); },
    r => { r.sections.length = 1; },
    r => { r.sections = Array(9).fill(r.sections[0]); },
    r => { for (const s of r.sections) s.frame.xAxis[1] = 1 + 1e-12; },
  ];
  for (const alter of cases) {
    const { raw } = fixture(frames[0], 3, 4); alter(raw); const before = structuredClone(raw);
    assert.throws(() => loftSolid(raw), e => e.name === 'BrepError' && ['INPUT', 'GEOMETRY'].includes(e.code)); assert.deepEqual(raw, before);
  }
});

// These polynomial slice integrals are independent of both loft mass and rigid mass placement.
const multiply = (a, b) => { const c = Array(a.length + b.length - 1).fill(0); for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) c[i + j] += a[i] * b[j]; return c; };
const integral = a => a.reduce((sum, x, i) => sum + x / (i + 1), 0);
function analyticTaper() {
  const area = [1, 2, 1], center = [[0.5, 2.5], [0.5, 1.5], [0, 1]], V = integral(area);
  const C = center.map(p => integral(multiply(area, p)) / V), moments = [];
  for (let i = 0; i < 3; i++) {
    moments[i] = [];
    for (let j = 0; j < 3; j++) {
      let value = integral(multiply(area, multiply(center[i], center[j])));
      if (i === j && i < 2) value += integral(multiply(area, area)) / 12;
      moments[i][j] = value - V * C[i] * C[j];
    }
  }
  const trace = moments[0][0] + moments[1][1] + moments[2][2];
  return { volume: V, mass: V / 1000, centroid: C, inertia: moments.map((row, i) => row.map((v, j) => ((i === j ? trace : 0) - v) / 1000)) };
}

test('raw polynomial frames: independent affine-taper slice integrals give every world inertia component', () => {
  for (const f of frames.slice(0, 3)) {
    const { raw } = fixture(f, 8, 64, 'square', [2, 1], true), m = loftSolid(raw).mass(1);
    massOracle(m, { ...analyticTaper(), method: m.method }, f);
    assert.deepEqual(readNativeSIInertia(m), { ok: false, code: 'NATIVE_SI_PROVENANCE_UNAVAILABLE', reason: 'transformed' });
  }
});

test('raw polynomial adapter: one legacy call receives local height sections and the third guide argument', () => {
  const f = frames[0], { raw } = fixture(f, 3, 17), before = structuredClone(raw); let calls = 0;
  const bases = raw.sections.map(s => ({ origin: [...s.frame.origin], u: [...s.frame.xAxis], v: [...s.frame.yAxis] }));
  const result = framedNurbsLoftSolid(raw, bases, function (...args) {
    calls++; assert.equal(args.length, 3); assert.equal(args[1], undefined); assert.equal(args[0].guide, undefined);
    assert.ok(args[0].sections.every(s => typeof s.z === 'number' && s.frame === undefined));
    assert.notEqual(args[2].controlPoints, raw.guide.controlPoints); assert.notEqual(args[2].knots, raw.guide.knots);
    return loftSolid({ ...args[0], guide: args[2] });
  });
  assert.equal(calls, 1); valid(result.brep); assert.deepEqual(raw, before);
});
