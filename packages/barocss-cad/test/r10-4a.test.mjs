import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, brepMassProperties, checkBrep } from '../dist/index.js';
import { finishBrepEdges } from '../dist/blend/edge-finish.js';

// R10.4a (D95): overflow over smooth edges. Where the ball's contact runs off a face across an edge onto a face tangent
// to it — a round already made — it rolls on over that face: the rolling ball takes the sides beyond (`growSides`). A
// closed-form finish (R10.1) whose contact would lie past such an edge — on the face's own surface carried on, not on the
// round — is handed to the rolling ball (it was built before, silently 7.8 % too much on the case below).
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const R = 8, H = 6, rho = 2;
const boss = [{ id: 'as', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'a', kind: 'extrude', sketch: 'as', height: 10 },
  { id: 'bs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: R }, { id: 'b', kind: 'extrude', sketch: 'bs', height: H, from: 10 }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }];
const rounded = [...boss, { id: 'g', kind: 'fillet', target: 'u', edges: out(boss).brep.edges.filter(e => /b\.top/.test(e.name) && /b\.side0/.test(e.name)).map(e => e.name), radius: rho }];
/**
 * The foot's fillet by Pappus: in the meridian, the region between the plate (z = 10), the wall (x = R) up to the round, the
 * round's arc (about (R − ρ, 10 + H − ρ)) and the ball's (about (xc, 10 + r), touching the plate and the round: r + ρ from
 * the round's centre) — its first moment about the axis, by Green over fine polylines, times 2π.
 */
function pappus(r) {
  const ca = [R - rho, 10 + H - rho], xc = ca[0] + Math.sqrt((r + rho) ** 2 - (10 + r - ca[1]) ** 2), zc = 10 + r, d = [(xc - ca[0]) / (r + rho), (zc - ca[1]) / (r + rho)];
  const pts = [[xc, 10], [R, 10], [R, ca[1]]], a2 = Math.atan2(d[1], d[0]), T2 = [ca[0] + rho * d[0], ca[1] + rho * d[1]], b0 = Math.atan2(T2[1] - zc, T2[0] - xc), n = 200000;
  for (let i = 1; i <= n; i++) { const t = a2 * i / n; pts.push([ca[0] + rho * Math.cos(t), ca[1] + rho * Math.sin(t)]); }
  for (let i = 1; i <= n; i++) { const t = b0 + (-Math.PI / 2 - b0) * i / n; pts.push([xc + r * Math.cos(t), zc + r * Math.sin(t)]); }
  let M = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; M += (x0 + x1) * (x0 * y1 - x1 * y0) / 6; }
  return 2 * Math.PI * Math.abs(M);
}

test('R10.4a a boss with its top edge rounded, its foot filleted larger than the wall below the round: the ball rolls over onto the round — by Pappus to 2e-7, as a feature and forced through the rolling ball; smaller, on the wall alone, the closed form as before', () => {
  const o0 = out(rounded), v0 = o0.massProperties(1).volumeMM3, foot = o0.brep.edges.filter(e => /a\.top/.test(e.name) && /b\.side0/.test(e.name)).map(e => e.name);
  for (const r of [4.5, 5, 6]) {
    const o = out([...rounded, { id: 'f', kind: 'fillet', target: 'g', edges: foot, radius: r }]);
    assert.equal(o.validate().valid, true, `r ${r}`);
    const got = o.massProperties(1).volumeMM3 - v0, exact = pappus(r);
    assert.ok(Math.abs(got / exact - 1) < 2e-7, `r ${r}: ${got} vs ${exact} (${got / exact - 1})`);
    assert.ok(o.fillet?.length === 1, `r ${r}: by the rolling ball`);
    const g = finishBrepEdges(o0.brep, foot, r, 'fillet', 'f', { general: true });
    assert.equal(checkBrep(g).valid, true);
    assert.ok(Math.abs((brepMassProperties(g, 1).volumeMM3 - v0) / exact - 1) < 2e-7, `r ${r} forced`);
  }
  // r 3: its contact on the wall (z = 13, the round starting at 14) — R10.1's closed form, (π/2 · 4)(R A + M) about the axis.
  const r = 3, A = (1 - Math.PI / 4) * r * r, M = r ** 3 * (5 / 6 - Math.PI / 4), o = out([...rounded, { id: 'f', kind: 'fillet', target: 'g', edges: foot, radius: r }]);
  assert.equal(o.fillet, undefined, 'r 3: the closed form');
  assert.ok(Math.abs((o.massProperties(1).volumeMM3 - v0) / (2 * Math.PI * (R * A + M)) - 1) < 1e-9);
});
