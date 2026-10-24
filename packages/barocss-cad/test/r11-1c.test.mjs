import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep } from '../dist/index.js';

// R11.1c (D108): the rest of R11.1. The wall's union retried by halves and in reverse where the analytic Boolean cannot
// close a step (the notched box at t 2.9–3.1 failed untyped on HEAD), every other failure a typed refusal; a convex round
// face the wall all but reaches refused by name; the shell's history route past a variable-radius fillet (r(s) − t).
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const vol = features => out(features).massProperties(1).volumeMM3;
const refused = (features, code, pattern) => assert.throws(() => out(features), e => (e.details?.category ?? e.code) === code && pattern.test(e.message), String(pattern));
const exactly = (o, expected, what, rel = 1e-12) => {
  const report = checkBrep(o.brep, { strict: true });
  assert.equal(report.valid, true, `${what}: ${report.issues}`);
  const v = o.massProperties(1).volumeMM3;
  assert.ok(Math.abs(v / expected - 1) < rel, `${what}: ${v} vs ${expected} (${(v - expected) / expected})`);
};
const yzAt = x => ({ origin: [x, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] });

test('R11.1c a box\'s notched corner shells exactly for walls from 2.5 to 5, closely through 2.9–3.1 — the union by halves where in order it does not close (HEAD: untyped at 2.9–3.1)', () => {
  const A = 40, B = 30, C = 20, a = 25, b = 18, c = 12;
  const notch = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [A, B] }, { id: 'e', kind: 'extrude', sketch: 's', height: C },
    { id: 'n', kind: 'sketch', profile: 'rectangle', min: [b, c], max: [B + 5, C + 5], plane: { origin: [a, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'ne', kind: 'extrude', sketch: 'n', height: A }, { id: 'u', kind: 'difference', target: 'e', tool: 'ne' }];
  const V = vol(notch);
  for (const t of [2.5, 2.8, 2.9, 2.95, 3, 3.05, 3.1, 3.2, 3.5, 4, 5]) {
    exactly(out([...notch, { id: 'sh', kind: 'shell', target: 'u', thickness: t }]), V - ((A - 2 * t) * (B - 2 * t) * (C - 2 * t) - (A - a) * (B - b) * (C - c)), `t ${t}`);
  }
});

test('R11.1c a convex round face the wall all but reaches is refused by name; the wall at its radius or more is all wall', () => {
  const rodOn = r => [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [40, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 }, { id: 'c', kind: 'sketch', profile: 'circle', center: [0, 10], radius: r, plane: yzAt(0) }, { id: 'ce', kind: 'extrude', sketch: 'c', height: 40 }, { id: 'u', kind: 'union', target: 'pe', tool: 'ce' }];
  const shell = (r, t) => [...rodOn(r), { id: 'sh', kind: 'shell', target: 'u', thickness: t }];
  // (HEAD made it, its offset core 0.005 mm across.)
  refused(shell(2, 1.995), 'CAPABILITY', /\[WALL_NEAR_RADIUS\] a wall of 1\.995 mm on ce\.side0 \(radius 2 mm\)/);
  // At the radius, and 0.01 mm short of it: the closed forms of D106 (the rod all wall; its offset disc above the plate's offset).
  for (const t of [2, 1.99]) {
    const rho = 2 - t, disc = rho <= 0 ? 0 : Math.PI * rho * rho, expected = vol(rodOn(2)) - ((40 - 2 * t) * (10 - 2 * t) + disc) * (40 - 2 * t);
    exactly(out(shell(2, t)), expected, `t ${t}`, 1e-11);
  }
});

test('R11.1c a box\'s edge rounded 2 → 4 (a variable radius), shelled: its hollow\'s edge rounded r(s) − t on the same spine, in closed form (refused on HEAD)', () => {
  const box = [{ id: 'q', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 'q', height: 20 }];
  // ∫ (r0 + (r1 − r0) x / 40)² dx over x0 … x1; (1 − π/4) of it is what a round of that radius takes.
  const k = 1 - Math.PI / 4, I = (a, b, x0, x1) => { const m = (b - a) / 40; return ((a + m * x1) ** 3 - (a + m * x0) ** 3) / (3 * m); };
  const fillet = (r0, r1) => ({ id: 'f', kind: 'fillet', target: 'e', edges: ['e.side0|e.top'], radii: [{ at: [0, 0, 20], radius: r0 }, { at: [40, 0, 20], radius: r1 }] });
  const shell = (r0, r1, t, open = ['e.bottom']) => [...box, fillet(r0, r1), { id: 'sh', kind: 'shell', target: 'f', thickness: t, open }];
  for (const [r0, r1, t] of [[2, 4, 1], [2, 4, 1.5], [3, 5, 2]]) {
    // Open at the bottom: the hollow box (40 − 2t)(30 − 2t)(20 − t) less its edge rounded r(x) − t from x = t to 40 − t.
    const V = 40 * 30 * 20 - k * I(r0, r1, 0, 40), hollow = (40 - 2 * t) * (30 - 2 * t) * (20 - t) - k * I(r0 - t, r1 - t, t, 40 - t);
    exactly(out(shell(r0, r1, t)), V - hollow, `${r0} → ${r1}, t ${t}`);
  }
  // Closed: a cavity, (20 − 2t) high.
  { const [r0, r1, t] = [2, 4, 1], V = 40 * 30 * 20 - k * I(r0, r1, 0, 40), hollow = (40 - 2 * t) * (30 - 2 * t) * (20 - 2 * t) - k * I(r0 - t, r1 - t, t, 40 - t);
    const o = out(shell(r0, r1, t, []));
    assert.equal(o.brep.shells.length, 2);
    exactly(o, V - hollow, 'closed'); }
  // The wall past the radius all along: the hollow's edge sharp (the plain hollow box).
  exactly(out(shell(1, 1.5, 2)), 40 * 30 * 20 - k * I(1, 1.5, 0, 40) - 36 * 26 * 18, 'sharp inside');
  // Refused by name: the radius falling to the wall partway; three radii; a variable radius round a curved chain.
  refused(shell(1, 4, 2), 'CAPABILITY', /\[SHELL_VARIABLE_RADIUS\] f's radius falls to the wall \(2 mm\) partway along/);
  refused([...box, { id: 'f', kind: 'fillet', target: 'e', edges: ['e.side0|e.top'], radii: [{ at: [0, 0, 20], radius: 2 }, { at: [20, 0, 20], radius: 3 }, { at: [40, 0, 20], radius: 2 }] }, { id: 'sh', kind: 'shell', target: 'f', thickness: 1, open: ['e.bottom'] }], 'CAPABILITY', /\[SHELL_VARIABLE_RADIUS\] f gives 3 radii/);
  const disc = [{ id: 'q', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 15 }, { id: 'e', kind: 'extrude', sketch: 'q', height: 10 }];
  const rim = out(disc).brep.edges.find(x => /top/.test(x.name)).name;
  refused([...disc, { id: 'f', kind: 'fillet', target: 'e', edges: [rim], radii: [{ at: [15, 0, 10], radius: 2 }, { at: [-15, 0, 10], radius: 3 }] }, { id: 'sh', kind: 'shell', target: 'f', thickness: 1, open: ['e.bottom'] }], 'CAPABILITY', /\[SHELL_VARIABLE_RADIUS\] f varies its radius along a curved edge/);
});
