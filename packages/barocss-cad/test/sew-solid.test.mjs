import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, CadPartError, massPropertiesOf } from '../dist/index.js';

const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const clamped = d => [...Array(d + 1).fill(0), ...Array(d + 1).fill(1)];
const S = (du, dv, controlPoints, weights = controlPoints.map(r => r.map(() => 1))) => ({ degreeU: du, degreeV: dv, knotsU: clamped(du), knotsV: clamped(dv), controlPoints, weights });
// A 10 mm cube's six faces, facing every which way (sewing turns them outward).
const CUBE = [
  S(1, 1, [[[0, 0, 0], [10, 0, 0]], [[0, 10, 0], [10, 10, 0]]]), S(1, 1, [[[0, 0, 10], [10, 0, 10]], [[0, 10, 10], [10, 10, 10]]]),
  S(1, 1, [[[0, 0, 0], [0, 0, 10]], [[10, 0, 0], [10, 0, 10]]]), S(1, 1, [[[0, 10, 0], [0, 10, 10]], [[10, 10, 0], [10, 10, 10]]]),
  S(1, 1, [[[0, 0, 0], [0, 0, 10]], [[0, 10, 0], [0, 10, 10]]]), S(1, 1, [[[10, 0, 0], [10, 0, 10]], [[10, 10, 0], [10, 10, 10]]]),
];

test('sew: six patches of a cube close into a 1000 mm³ solid', () => {
  const out = evaluateCadPart(D([{ id: 's', kind: 'sew', surfaces: CUBE }])).outputs[0];
  assert.equal(checkBrep(out.brep).issues.length, 0);
  assert.ok(Math.abs(massPropertiesOf(out).volume - 1000) < 1e-6);
  assert.equal(out.brep.faces.length, 6);
});

test('sew: a domed lid on ruled walls keeps its exact curved surface (1000 + 200 mm³)', () => {
  const h = 3, top = [0, 1, 2].map(i => [0, 1, 2].map(j => [i * 5, j * 5, 10 + ((i === 1) + (j === 1)) * h]));
  const wall = ps => S(1, 2, [ps.map(p => [p[0], p[1], 0]), ps]);
  const surfaces = [S(2, 2, top), S(1, 1, [[[0, 0, 0], [0, 10, 0]], [[10, 0, 0], [10, 10, 0]]]), wall(top[0]), wall(top[2]), wall(top.map(r => r[0])), wall(top.map(r => r[2]))];
  const out = evaluateCadPart(D([{ id: 's', kind: 'sew', surfaces }])).outputs[0];
  assert.equal(out.representation, 'curved');
  assert.ok(Math.abs(massPropertiesOf(out).volume - 1200) < 1e-3, `${massPropertiesOf(out).volume}`);
});

test('sew: a cylinder from quarter walls and quarter discs (their centres poles) is π r² h', () => {
  const w = Math.SQRT1_2, r = 5, hgt = 8, surfaces = [];
  for (let q = 0; q < 4; q++) {
    const a = q * Math.PI / 2, rot = ([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const arc = [[r, 0], [r, r], [0, r]].map(rot);
    surfaces.push(S(2, 1, arc.map(([x, y]) => [[x, y, 0], [x, y, hgt]]), [[1, 1], [w, w], [1, 1]]));
    for (const z of [0, hgt]) surfaces.push(S(2, 1, arc.map(([x, y]) => [[0, 0, z], [x, y, z]]), [[1, 1], [w, w], [1, 1]]));
  }
  const out = evaluateCadPart(D([{ id: 's', kind: 'sew', surfaces }])).outputs[0];
  assert.equal(checkBrep(out.brep).issues.length, 0);
  assert.ok(Math.abs(massPropertiesOf(out).volume - Math.PI * r * r * hgt) < 0.05, `${massPropertiesOf(out).volume}`);
});

test('sew: an open set, a gap wider than the tolerance and bad input are refused', () => {
  const geometry = e => e instanceof CadPartError && e.code === 'GEOMETRY';
  assert.throws(() => evaluateCadPart(D([{ id: 's', kind: 'sew', surfaces: CUBE.slice(1) }])), e => geometry(e) && /do not close: 4 edges/.test(e.message));
  const gap = CUBE.map((s, k) => k === 1 ? { ...s, controlPoints: s.controlPoints.map(r => r.map(([x, y, z]) => [x, y, z + 0.5])) } : s);
  assert.throws(() => evaluateCadPart(D([{ id: 's', kind: 'sew', surfaces: gap }])), geometry);
  assert.ok(evaluateCadPart(D([{ id: 's', kind: 'sew', surfaces: gap, tolerance: 0.6 }])).outputs[0]);
  assert.throws(() => evaluateCadPart(D([{ id: 's', kind: 'sew', surfaces: [CUBE[0]] }])), e => e instanceof CadPartError && e.code === 'INPUT');
  assert.throws(() => evaluateCadPart(D([{ id: 's', kind: 'sew', surfaces: CUBE, tolerance: 0 }])), e => e instanceof CadPartError && e.code === 'INPUT');
});
