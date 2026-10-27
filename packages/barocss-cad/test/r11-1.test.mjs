import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, massPropertiesOf } from '../dist/index.js';

// R11.1a (D106): the general shell's slabs grow only across convex edges and across concave edges between two planes
// (as before). Across a smooth edge they stop (they meet in the normal plane there); across a concave edge beside a curved
// face they stop and the corner is filled by itself — the region beyond both faces' normals within the wall of both
// offsets, the sharp join, solved in the section across a straight edge or the meridian of a circular one. A convex
// cylinder thinner than the wall reaches its axis. Every case is a closed form; each was over-thick on HEAD (D105).
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const vol = features => massPropertiesOf(out(features)).volume;
const shell = (features, target, t) => out([...features, { id: 'sh', kind: 'shell', target, thickness: t }]);
const yzAt = x => ({ origin: [x, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] }), xz = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
const L = 40, plate = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [L, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 }];
/** A rod of radius r along X, its axis at the plate's top, from x0 for len. */
const rodOn = (r, x0 = 0, length = L) => [...plate, { id: 'c', kind: 'sketch', profile: 'circle', center: [0, 10], radius: r, plane: yzAt(x0) }, { id: 'ce', kind: 'extrude', sketch: 'c', height: length }, { id: 'u', kind: 'union', target: 'pe', tool: 'ce' }];
/** The area of a disc of radius ρ above a chord d below its centre (all of it when d ≥ ρ). */
const above = (rho, d) => rho <= 0 ? 0 : rho <= d ? Math.PI * rho * rho : Math.PI * rho * rho - (rho * rho * Math.acos(d / rho) - d * Math.sqrt(rho * rho - d * d));
/** Strictly valid, the volume to `rel`, and `cavities` voids (a rod's offset disc clear of the plate's hollow is a second one). */
const exactly = (o, expected, what, rel = 1e-12, cavities = 1) => {
  const report = checkBrep(o.brep, { strict: true });
  assert.equal(report.valid, true, `${what}: ${report.issues}`);
  assert.equal(o.brep.shells.length, 1 + cavities, `${what}: cavities`);
  const v = massPropertiesOf(o).volume;
  assert.ok(Math.abs(v / expected - 1) < rel, `${what}: ${v} vs ${expected} (${(v - expected) / expected})`);
};

test('R11.1a smooth edges: a rod on a plate with both junctions filleted (R10.1) shells to its section eroded — the slabs stop at the tangent edges', () => {
  // A prism along X: the hollow is the section eroded, (A − Pt + 4t²) × (L − 2t) (no reflex corner; ∫κ ds = 0). HEAD: 6.9e-4 – 7.9 % over.
  const R = 5, rf = 2, body = [...rodOn(R), { id: 'f', kind: 'fillet', target: 'u', edges: ['ce.side0|pe.top#1', 'ce.side0|pe.top#2'], radius: rf }];
  const yc = Math.sqrt((R + rf) ** 2 - rf ** 2), phi = Math.atan2(rf, yc), fil = yc * rf / 2 - rf * rf * Math.atan2(yc, rf) / 2 - R * R * Math.atan2(rf, yc) / 2;
  const A = 400 + Math.PI * R * R / 2 + 2 * fil, P = 40 + 20 + 2 * (20 - yc) + 2 * rf * (Math.PI / 2 - phi) + R * (Math.PI - 2 * phi);
  for (const t of [0.5, 1, 1.5, 2.5]) exactly(shell(body, 'f', t), A * L - (A - P * t + 4 * t * t) * (L - 2 * t), `t ${t}`);
});

test('R11.1a concave edges beside a cylinder: a rod half sunk in a plate shells to the sharp join — the corner between the plate\'s and the rod\'s offsets filled', () => {
  // The hollow: the plate's box eroded, and the rod's offset disc (r − t) above the plate's offset (z = 10 − t), × (L − 2t).
  // A rod no thicker than the wall is wall throughout (HEAD made its slab a ring reaching into the plate: 3.4 % over).
  for (const [r, t] of [[5, 0.5], [5, 1], [5, 2], [3, 1], [2, 1.5], [1, 0.5], [1, 2]]) {
    const body = rodOn(r), expected = vol(body) - ((L - 2 * t) * (10 - 2 * t) + above(r - t, t)) * (L - 2 * t);
    exactly(shell(body, 'u', t), expected, `r ${r} t ${t}`, 1e-12, r - t > 0 && r - t <= t ? 2 : 1);
  }
  // A shorter rod (x 10 → 30): its junctions end at the caps' chords on the plate (concave edges of two planes, grown as before).
  for (const [r, t] of [[5, 1], [5, 2], [1, 2]]) {
    const body = rodOn(r, 10, 20), expected = vol(body) - ((L - 2 * t) * (L - 2 * t) * (10 - 2 * t) + (20 - 2 * t) * above(r - t, t));
    exactly(shell(body, 'u', t), expected, `short rod r ${r} t ${t}`, 1e-12, r - t > 0 && r - t <= t ? 2 : 1);
  }
});

test('R11.1a concave circles beside a surface of revolution: a torus ring half sunk in a round plate shells by Pappus, at walls past the ring\'s radius', () => {
  // Meridian: the plate (Rp × H) eroded and the ring's offset disc (r − t about (R0, H)) above z = H − t: first moments
  // (Rp − t)²/2 · (H − 2t) and R0 · (disc part). HEAD: 0.5 – 18 % over, and from t 2.5 an untyped Boolean failure.
  const Rp = 30, H = 8, R0 = 15, r = 4;
  const body = [{ id: 'd', kind: 'sketch', profile: 'polygon', points: [[0, 0], [Rp, 0], [Rp, H], [0, H]], plane: xz }, { id: 'dr', kind: 'revolve', sketch: 'd', axis: { origin: [0, 0], direction: 'y' } },
    { id: 'c', kind: 'sketch', profile: 'circle', center: [R0, H], radius: r, plane: xz }, { id: 'cr', kind: 'revolve', sketch: 'c', axis: { origin: [0, 0], direction: 'y' } }, { id: 'u', kind: 'union', target: 'dr', tool: 'cr' }];
  const V = vol(body);
  assert.ok(Math.abs(V / (Math.PI * Rp * Rp * H + Math.PI ** 2 * r * r * R0) - 1) < 1e-11);
  for (const t of [0.5, 1, 2, 3, 3.5]) exactly(shell(body, 'u', t), V - 2 * Math.PI * ((Rp - t) ** 2 / 2 * (H - 2 * t) + R0 * above(r - t, t)), `t ${t}`, 1e-11, r - t <= t ? 2 : 1);
});
