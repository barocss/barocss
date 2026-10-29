import test from 'node:test';
import assert from 'node:assert/strict';
import { loftSolid, checkBrep, evaluateSurface, surfaceDomain, tessellateBrep } from '../dist/index.js';

const square = width => [[0, 0], [width, 0], [width, width], [0, width]].map(start => ({ kind: 'line', start }));
function guide(count, degree = 3, { bow = false, repeated = false, shifted = false } = {}) {
  const interior = count - degree - 1;
  const knots = [...Array(degree + 1).fill(0), ...Array.from({ length: interior }, (_, i) => repeated ? (Math.floor(i / degree) + 1) / (Math.ceil(interior / degree) + 1) : (i + 1) / (interior + 1)), ...Array(degree + 1).fill(1)];
  return { kind: 'nurbs', degree, knots: shifted ? knots.map(t => 2 + 3 * t) : knots,
    controlPoints: Array.from({ length: count }, (_, i) => { const t = i / (count - 1); return [bow && i && i < count - 1 ? 0.2 * Math.sin(5 * t) : 0, bow && i && i < count - 1 ? 0.1 * Math.cos(3 * t) : 0, bow ? t * t : t]; }) };
}
function input(count, degree = 3, options = {}, taper = true) {
  return { id: 'L', name: 'L', sections: [{ profile: square(1), z: 0 }, { profile: square(taper ? 2 : 1), z: 1 }], guide: guide(count, degree, options) };
}
function deBoor(g, t) {
  const { degree: p, knots: U, controlPoints: P } = g; let k = p;
  while (k < P.length - 1 && t >= U[k + 1]) k++;
  const d = Array.from({ length: p + 1 }, (_, j) => [...P[k - p + j]]);
  for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) {
    const i = k - p + j, a = (t - U[i]) / (U[i + p + 1 - r] - U[i]);
    d[j] = d[j].map((x, c) => (1 - a) * d[j - 1][c] + a * x);
  }
  return d[p];
}
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function valid(brep) {
  const report = checkBrep(brep, { strict: true }); assert.equal(report.valid, true, JSON.stringify(report.issues));
  assert.equal(brep.bodies.length, 1); assert.equal(brep.shells.length, 1); assert.equal(report.topology[0].genus, 0);
  assert.ok(brep.faces.every(f => f.surface.controlPoints.length <= 16 && f.surface.controlPoints[0].length <= 16));
  assert.ok(brep.coedges.every(c => c.twin !== null));
  const coedges = new Map(brep.coedges.map(c => [c.id, c])), vertices = new Map(brep.vertices.map(v => [v.id, v]));
  for (const edge of brep.edges) for (const end of [0, 1]) { const point = edge.curve.controlPoints[end ? edge.curve.controlPoints.length - 1 : 0]; assert.deepEqual(point, vertices.get(edge.vertices[end]).point); }
  for (const c of brep.coedges) { const twin = coedges.get(c.twin); assert.equal(twin.twin, c.id); assert.equal(twin.edge, c.edge); assert.notEqual(twin.sense, c.sense); }
}
function points(brep, g, taper = true) {
  const domain = [g.knots[0], g.knots.at(-1)];
  for (const face of brep.faces.filter(f => /L\.side[0-3](?:#\d+)?$/.test(f.name))) {
    const side = Number(face.name.match(/side(\d)/)[1]), range = surfaceDomain(face.surface).v;
    for (const u of [0, 0.2, 0.7, 1]) for (const f of [0, 0.3, 0.8, 1]) {
      const v = range[0] + (range[1] - range[0]) * f, [x, y, z] = deBoor(g, domain[0] + (domain[1] - domain[0]) * v), w = taper ? 1 + z : 1;
      const expected = [[x + u * w, y, z], [x + w, y + u * w, z], [x + (1 - u) * w, y + w, z], [x, y + (1 - u) * w, z]][side];
      const p = evaluateSurface(face.surface, u, v); for (let c = 0; c < 3; c++) close(p[c], expected[c]);
    }
  }
}
function watertight(brep) {
  const mesh = tessellateBrep(brep, { segmentsPerQuarter: 4 }), P = mesh.positions, uses = new Map();
  const key = i => `${P[3 * i]},${P[3 * i + 1]},${P[3 * i + 2]}`;
  for (let t = 0; t < mesh.indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = key(mesh.indices[t + k]), b = key(mesh.indices[t + (k + 1) % 3]); if (a === b) continue;
    const edge = a < b ? a + '|' + b : b + '|' + a; uses.set(edge, (uses.get(edge) ?? 0) + 1);
  }
  assert.ok([...uses.values()].every(n => n === 2));
}

test('17 and 64 control straight polynomial guides return valid, evaluable, watertight prism and taper surfaces', () => {
  for (const count of [17, 64]) for (const taper of [false, true]) {
    const source = input(count, 3, {}, taper), before = structuredClone(source), made = loftSolid(source); valid(made.brep); points(made.brep, source.guide, taper); watertight(made.brep);
    const m = made.mass(1); close(m.volume, taper ? 7 / 3 : 1);
    const centroid = taper ? [45 / 56, 45 / 56, 17 / 28] : [0.5, 0.5, 0.5]; centroid.forEach((x, i) => close(m.centroid[i], x));
    const inertia = taper ? [[4927 / 6720, -97 / 2240, -97 / 1120], [-97 / 2240, 4927 / 6720, -97 / 1120], [-97 / 1120, -97 / 1120, 3763 / 3360]].map(row => row.map(x => x / 1000)) : [[1 / 6000, 0, 0], [0, 1 / 6000, 0], [0, 0, 1 / 6000]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) close(m.inertia[i][j], inertia[i][j], 1e-12);
    assert.deepEqual(source, before);
  }
});

test('large guides retain degree1-5, repeated knots, original non-unit domains and nonlinear height geometry', () => {
  for (let degree = 1; degree <= 5; degree++) {
    const source = input(64, degree, { bow: true, repeated: degree > 1, shifted: true }), before = structuredClone(source), made = loftSolid(source);
    valid(made.brep); points(made.brep, source.guide); watertight(made.brep); close(made.mass(1).volume, 7 / 3);
    assert.deepEqual(source, before);
  }
});

test('64 source controls cross intermediate section planes without an oversized temporary Curve', () => {
  for (const degree of [2, 3, 5]) for (const count of [3, 8]) {
    const source = input(64, degree), U = source.guide.knots;
    source.guide.controlPoints = source.guide.controlPoints.map((q, i) => [0, 0, U.slice(i + 1, i + degree + 1).reduce((a, b) => a + b, 0) / degree]);
    source.sections = Array.from({ length: count }, (_, i) => i / (count - 1)).map(z => ({ profile: square(1 + z), z }));
    const before = structuredClone(source), made = loftSolid(source); valid(made.brep); watertight(made.brep);
    const m = made.mass(1); close(m.volume, 7 / 3); [45 / 56, 45 / 56, 17 / 28].forEach((x, i) => close(m.centroid[i], x));
    for (const face of made.brep.faces.filter(f => /\.side1(?:#\d+)?$/.test(f.name))) {
      const range = surfaceDomain(face.surface).v;
      for (const f of [0, 0.25, 0.75, 1]) { const q = evaluateSurface(face.surface, 0.5, range[0] + (range[1] - range[0]) * f); close(q[0], 1 + q[2]); close(q[1], (1 + q[2]) / 2); }
    }
    assert.deepEqual(source, before);
  }
});

test('16 controls retain one native side per profile edge and original side names', () => {
  const source = input(16), before = structuredClone(source), made = loftSolid(source); valid(made.brep);
  assert.deepEqual(made.brep.faces.map(f => f.name), ['L.side0', 'L.side1', 'L.side2', 'L.side3', 'L.bottom', 'L.top']);
  assert.equal(made.brep.vertices.length, 8); assert.equal(made.brep.edges.length, 12);
  assert.deepEqual(source, before);
});


test('large-guide refusal and later caller edits preserve the accepted BRep, mass and original input arrays', () => {
  const source = input(64, 3, { bow: true }), before = structuredClone(source), accepted = loftSolid(source);
  const held = structuredClone(accepted.brep), mass = accepted.mass(7.85);
  for (const bad of [input(65), { ...input(64), guide: { ...guide(64), weights: Array(64).fill(1) } }]) {
    const saved = structuredClone(bad); assert.throws(() => loftSolid(bad)); assert.deepEqual(bad, saved);
    assert.deepEqual(accepted.brep, held); assert.deepEqual(accepted.mass(7.85), mass);
  }
  const descending = structuredClone(source); descending.guide.controlPoints[20][2] = descending.guide.controlPoints[19][2];
  const invalidBefore = structuredClone(descending); assert.throws(() => loftSolid(descending), /must rise/); assert.deepEqual(descending, invalidBefore);
  assert.deepEqual(source, before); source.guide.controlPoints[20][0] = 100; source.guide.knots[4] = 0.001; source.sections[0].profile[0].start[0] = 100;
  assert.deepEqual(accepted.brep, held); assert.deepEqual(accepted.mass(7.85), mass);
});
