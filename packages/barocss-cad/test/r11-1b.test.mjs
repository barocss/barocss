import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, brepMassProperties } from '../dist/index.js';
import { generalShell } from '../dist/general-shell.js';

// R11.1b (D107): a plane's slab grows across a concave edge between two planes as far as the two offsets reach before
// they meet — t·tan(θ/2) for normals θ ≤ 90° apart, mitred where two such sides meet (a vertex of concave edges); a
// corner sharper than that (θ > 90°) is filled apart as R11.1a's are. Sharp is the default join; `join: 'arc'` is the
// one switch for the other (the owner's decision, D106). Every case is a closed form; each was wrong on HEAD.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const vol = features => out(features).massProperties(1).volumeMM3;
const shell = (features, target, t) => out([...features, { id: 'sh', kind: 'shell', target, thickness: t }]);
const yzAt = x => ({ origin: [x, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] });
const exactly = (o, expected, what, rel = 1e-12) => {
  const report = checkBrep(o.brep, { strict: true });
  assert.equal(report.valid, true, `${what}: ${report.issues}`);
  const v = o.massProperties(1).volumeMM3;
  assert.ok(Math.abs(v / expected - 1) < rel, `${what}: ${v} vs ${expected} (${(v - expected) / expected})`);
};
const area = P => P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + (p[0] * q[1] - q[0] * p[1]) / 2; }, 0);
/** A counter-clockwise polygon's offset lines t inside, met at each corner: the sharp-join inset. */
function inset(P, t) {
  const n = P.length, lines = P.map((p, i) => { const q = P[(i + 1) % n], l = Math.hypot(q[0] - p[0], q[1] - p[1]), u = [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; return { p: [p[0] - u[1] * t, p[1] + u[0] * t], u }; });
  return lines.map((a, i) => { const b = lines[(i + n - 1) % n], det = b.u[0] * a.u[1] - b.u[1] * a.u[0], w = [a.p[0] - b.p[0], a.p[1] - b.p[1]], s = (w[0] * a.u[1] - w[1] * a.u[0]) / det; return [b.p[0] + b.u[0] * s, b.p[1] + b.u[1] * s]; });
}
/** A prism along X of a polygon section (L long), joined with a small box inside it along Z: a general B-rep. */
const prism = (P, L) => [{ id: 's', kind: 'sketch', profile: 'polygon', points: P, plane: yzAt(0) }, { id: 'e', kind: 'extrude', sketch: 's', height: L },
  { id: 'b', kind: 'sketch', profile: 'rectangle', min: [10, -5], max: [20, 5] }, { id: 'be', kind: 'extrude', sketch: 'b', height: 3 }, { id: 'bm', kind: 'translate', target: 'be', offset: [0, 0, 2] }, { id: 'u', kind: 'union', target: 'e', tool: 'bm' }];
const A = 40, B = 30, C = 20, a = 25, b = 18, c = 12;
/** A box with its corner [a, A] × [b, B] × [c, C] cut away by a box along X: three concave edges meet at (a, b, c). */
const notch = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [A, B] }, { id: 'e', kind: 'extrude', sketch: 's', height: C },
  { id: 'n', kind: 'sketch', profile: 'rectangle', min: [b, c], max: [B + 5, C + 5], plane: { origin: [a, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'ne', kind: 'extrude', sketch: 'n', height: A }, { id: 'u', kind: 'difference', target: 'e', tool: 'ne' }];

test('R11.1b concave edges between planes at any angle: a prism\'s section inset with sharp corners (HEAD: 2.5e-3 over at 225°, 5e-4 at 315°)', () => {
  // The inside corner at (0, 10): the next side leaving it at 45° (a 225° corner), straight up (270°, unchanged) or back over it (315°).
  for (const top of [[-10, 20], [0, 20], [10, 20]]) {
    const P = [[-20, 0], [20, 0], [20, 10], [0, 10], top, [-20, 20]], body = prism(P, 40);
    for (const t of [1, 2]) exactly(shell(body, 'u', t), vol(body) - area(inset(P, t)) * (40 - 2 * t), `corner to ${top} t ${t}`);
  }
});

test('R11.1b a vertex where three concave edges meet: a box\'s notched corner shells to the cube erosion (HEAD under-filled the vertex, −1.2e-5 and −5.1e-5)', () => {
  // Offsets meeting sharply: the hollow is the box inset by t less the notch's box grown by t towards the hollow,
  // (A − 2t)(B − 2t)(C − 2t) − (A − a)(B − b)(C − c).
  const V = vol(notch);
  assert.equal(V, A * B * C - (A - a) * (B - b) * (C - c));
  for (const t of [1, 2, 2.5, 3.5, 4]) exactly(shell(notch, 'u', t), V - ((A - 2 * t) * (B - 2 * t) * (C - 2 * t) - (A - a) * (B - b) * (C - c)), `t ${t}`);
});

test('R11.1b the join is one switch: an arc join gives an L-prism the upright route\'s rounds, a rod on a plate its rounds; a vertex of concave edges refused under it', () => {
  const t = 2, H = 20, L = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [40, 0], [40, 10], [10, 10], [10, 30], [0, 30]] }, { id: 'e', kind: 'extrude', sketch: 's', height: H }];
  const upright = shell(L, 'e', t).massProperties(1).volumeMM3, general = [...L, { id: 'b', kind: 'sketch', profile: 'rectangle', min: [2, 2], max: [5, 5], plane: yzAt(0) }, { id: 'be', kind: 'extrude', sketch: 'b', height: 3 }, { id: 'bm', kind: 'translate', target: 'be', offset: [3, 0, 0] }, { id: 'u', kind: 'union', target: 'e', tool: 'bm' }];
  const sharpInset = (40 - 2 * t) * (10 - 2 * t) + (10 - 2 * t) * (30 - 2 * t) - (10 - 2 * t) ** 2, body = out(general).brep;
  // The upright route erodes the section in 2D: a round t²(1 − π/4) at the L's inside corner.
  assert.ok(Math.abs(upright / (12000 - (sharpInset + t * t * (1 - Math.PI / 4)) * (H - 2 * t)) - 1) < 1e-12);
  // The general route: sharp by default (as the part's shell gives it), the upright route's value under the arc join.
  const sharp = generalShell(body, t, new Set(), 'g'), arc = generalShell(body, t, new Set(), 'g', 'arc');
  for (const x of [sharp, arc]) assert.equal(checkBrep(x, { strict: true }).valid, true);
  assert.ok(Math.abs(brepMassProperties(sharp, 1).volumeMM3 / (12000 - sharpInset * (H - 2 * t)) - 1) < 1e-12);
  assert.ok(Math.abs(brepMassProperties(arc, 1).volumeMM3 / upright - 1) < 1e-12);
  // A rod R 5 half sunk in a plate at t 1: each junction's sharp corner (the kite E, E − t·n, the offsets' meeting point,
  // along the rod's offset circle back to E − t·n) gives way to the quarter disc of the wall about E, over L − 2t.
  const rod = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [40, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 }, { id: 'c', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 5, plane: yzAt(0) }, { id: 'ce', kind: 'extrude', sketch: 'c', height: 40 }, { id: 'u', kind: 'union', target: 'pe', tool: 'ce' }];
  const T = 1, rb = out(rod).brep, sharpRod = brepMassProperties(generalShell(rb, T, new Set(), 'r'), 1).volumeMM3, arcRod = brepMassProperties(generalShell(rb, T, new Set(), 'r', 'arc'), 1).volumeMM3;
  const cy = Math.sqrt(15), kitePolygon = Math.abs(area([[5, 10], [5, 9], [cy, 9], [4, 10]])), alpha = Math.asin(1 / 4), kite = kitePolygon - 8 * (alpha - Math.sin(alpha));
  assert.ok(Math.abs(arcRod / (sharpRod - 2 * (kite - Math.PI / 4) * 38) - 1) < 1e-12, `${arcRod}`);
  // A vertex of concave edges: the arc join's ball would meet its edges' rounds tangentially — refused by name.
  assert.throws(() => generalShell(out(notch).brep, 1, new Set(), 'n', 'arc'), e => /CAPABILITY: shell: an arc join at a vertex/.test(e.message));
});
