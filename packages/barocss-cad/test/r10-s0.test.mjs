import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart } from '../dist/index.js';

// R10 S0 (D87): the feasibility checkpoint before general fillets. The research note's R10.1 (handover/notes/
// research-r10-r11-fillet-shell-2026-10-18.md) makes two closed-form classes with the tool + Boolean method fillets use
// today; its risk is the analytic Boolean meeting a tool tangent to a curved face. Probed here with the tools built by
// hand — exact — and the refusals and the faceReach defect of the day recorded; R10.1 (D88) turned them over, below.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const vol = features => evaluateCadPart(D(features)).outputs.at(-1).massProperties(1).volumeMM3;
const valid = features => evaluateCadPart(D(features)).outputs.at(-1).validate().valid;
const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] }, xz = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
const R = 5, H = 10, L = 40;
const plate = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [40, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: H }];
const rod = [{ id: 'c', kind: 'sketch', profile: 'circle', center: [0, H], radius: R, plane: yz }, { id: 'ce', kind: 'extrude', sketch: 'c', height: L }];
/** The fillet's cross-section between the plate's top and the rod (radius R, axis at z = H), radius rf: triangle C–T1–F less two sectors. */
const section = rf => { const yc = Math.sqrt((R + rf) ** 2 - rf ** 2); return yc * rf / 2 - rf * rf * Math.atan2(yc, rf) / 2 - R * R * Math.atan2(rf, yc) / 2; };

test('R10 S0 (a) translational: a fillet\'s tool tangent to a cylinder along its ruling — concave (a rod on a plate, added) and convex (a groove\'s rim, removed) — through the analytic Boolean, exact', () => {
  for (const rf of [1, 2, 3]) {
    const yc = Math.sqrt((R + rf) ** 2 - rf ** 2), eps = 0.5;
    // Concave: the fillet circle above the top (centre z = H + rf) and outside the rod; the tool grown eps into the body.
    const F = [yc, H + rf], d = [yc / (R + rf), rf / (R + rf)], T2 = [R * d[0], H + R * d[1]];
    const add = [{ kind: 'line', start: [yc, H] }, { kind: 'line', start: [yc, H - eps] }, { kind: 'line', start: [R - 1, H - eps] }, { kind: 'line', start: [(R - eps) * d[0], H + (R - eps) * d[1]] }, { kind: 'arc', start: T2, center: F, direction: 'ccw' }];
    const rodOnPlate = [...plate, ...rod, { id: 'u', kind: 'union', target: 'pe', tool: 'ce' }];
    const tool = segments => [{ id: 't', kind: 'sketch', profile: 'loop', segments, plane: yz }, { id: 'te', kind: 'extrude', sketch: 't', height: L }];
    const filled = [...rodOnPlate, ...tool(add), { id: 'f', kind: 'union', target: 'u', tool: 'te' }];
    assert.equal(valid(filled), true);
    assert.ok(Math.abs((vol(filled) - vol(rodOnPlate)) / (section(rf) * L) - 1) < 1e-9, `concave r ${rf}`);
    // Convex: a groove (the rod cut away), its rim rounded: the circle below the top, outside the groove.
    const G = [yc, H - rf], g = [yc / (R + rf), -rf / (R + rf)], S2 = [R * g[0], H + R * g[1]];
    const cut = [{ kind: 'line', start: [yc, H] }, { kind: 'line', start: [yc, H + eps] }, { kind: 'line', start: [(R - eps) * g[0], H + eps] }, { kind: 'line', start: [(R - eps) * g[0], H + (R - eps) * g[1]] }, { kind: 'arc', start: S2, center: G, direction: 'cw' }];
    const grooved = [...plate, ...rod, { id: 'g', kind: 'difference', target: 'pe', tool: 'ce' }];
    const rounded = [...grooved, ...tool(cut), { id: 'f', kind: 'difference', target: 'g', tool: 'te' }];
    assert.equal(valid(rounded), true);
    assert.ok(Math.abs((vol(grooved) - vol(rounded)) / (section(rf) * L) - 1) < 1e-9, `convex r ${rf}`);
  }
});

test('R10 S0 (b) coaxial: a revolved tool tangent to a cone (the rim between a cylinder and a cone above it, about one axis) — through the analytic Boolean, exact by Pappus', () => {
  const body = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [10, 0], [10, 10], [4, 16], [0, 16]], plane: xz }, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }];
  // In the meridian: the convex corner P (10, 10) between the wall (outward +x) and the slope (outward (1, 1)/√2), radius 2.
  const rf = 2, s = Math.SQRT1_2, c = [10 - rf, 10 - rf * (Math.SQRT2 - 1)], T1 = [10, c[1]], T2 = [c[0] + rf * s, c[1] + rf * s], eps = 0.5;
  const loop = [{ kind: 'line', start: T1 }, { kind: 'line', start: [10 + eps, T1[1]] }, { kind: 'line', start: [10 + eps * (1 + s), 10 + eps * s] }, { kind: 'line', start: [T2[0] + eps * s, T2[1] + eps * s] }, { kind: 'arc', start: T2, center: c, direction: 'cw' }];
  const cut = [...body, { id: 't', kind: 'sketch', profile: 'loop', segments: loop, plane: xz }, { id: 'tr', kind: 'revolve', sketch: 't', axis: { origin: [0, 0], direction: 'y' } }, { id: 'f', kind: 'difference', target: 'r', tool: 'tr' }];
  assert.equal(valid(cut), true);
  // The removed meridian region: the kite P–T1–c–T2 less the 45° sector; its first moment about the axis, times 2π.
  const kite = [[10, 10], T1, c, T2]; let Mx = 0;
  for (let i = 0; i < 4; i++) { const [x0, y0] = kite[i], [x1, y1] = kite[(i + 1) % 4], cr = x0 * y1 - x1 * y0; Mx += (x0 + x1) * cr / 6; }
  const th = Math.PI / 4, As = rf * rf * th / 2, cx = c[0] + (2 * rf * Math.sin(th / 2)) / (3 * th / 2) * Math.cos(th / 2);
  const exact = 2 * Math.PI * (Math.abs(Mx) - As * cx);
  // (The removed 5.34 mm³ is the difference of two quadratures of about 4120 mm³ each: 1e-9 of it is 1.3e-12 of theirs. The cut's
  // faces and edges are the same since D152 — its edges lie on the earlier ones to 1e-11 — but stored as 14 edges, not 62, its
  // quadrature moved 1.4e-8 mm³: 1.9e-9 of the difference.)
  assert.ok(Math.abs((vol(body) - vol(cut)) / exact - 1) < 3e-9, `${vol(body) - vol(cut)} vs ${exact}`);
});

test('R10 S0 then and now: the edges R10.1 added — refused at S0 (D87) — are filleted, and faceReach\'s defect (8.5 mm admitted on a face 7.93 mm deep) is a typed refusal (D88)', () => {
  const rodOnPlate = [...plate, ...rod, { id: 'u', kind: 'union', target: 'pe', tool: 'ce' }];
  const junction = evaluateCadPart(D(rodOnPlate)).output('u').brep.edges.find(e => /ce\.side0/.test(e.name) && /pe\.top/.test(e.name)).name;
  // (At S0: "straight edges can be finished between two planes only".) The fillet now matches the tool built by hand.
  assert.ok(Math.abs((vol([...rodOnPlate, { id: 'f', kind: 'fillet', target: 'u', edges: [junction], radius: 2 }]) - vol(rodOnPlate)) / (section(2) * L) - 1) < 1e-9);
  const cone = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [10, 0], [10, 10], [4, 16], [0, 16]], plane: xz }, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }];
  const rim = evaluateCadPart(D(cone)).output('r').brep.edges.find(e => /side1/.test(e.name) && /side2/.test(e.name)).name;
  // (At S0: "only edges between planes and cylinders".)
  assert.equal(valid([...cone, { id: 'f', kind: 'fillet', target: 'r', edges: [rim], radius: 2 }]), true);
  // A block 20 high whose top bows in on its far side (an arc about (15, 5)): 10 mm deep at its ends, 15 − √50 = 7.93 at y = 5.
  const bowed = [{ id: 's', kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [10, 0], center: [15, 5], direction: 'cw' }, { kind: 'line', start: [10, 10] }, { kind: 'line', start: [0, 10] }] }, { id: 'e', kind: 'extrude', sketch: 's', height: 20 }];
  const edge = evaluateCadPart(D(bowed)).output('e').brep.edges.find(e => /side3/.test(e.name) && /top/.test(e.name)).name, v0 = vol(bowed);
  const took = r => v0 - vol([...bowed, { id: 'f', kind: 'fillet', target: 'e', edges: [edge], radius: r }]);
  assert.ok(Math.abs(took(7.5) - (1 - Math.PI / 4) * 7.5 * 7.5 * 10) < 1e-6, 'within the true reach: a quarter round');
  assert.ok(Math.abs(took(7.9) - (1 - Math.PI / 4) * 7.9 * 7.9 * 10) < 1e-6, 'just within it');
  // (At S0 8.5 was admitted, and no quarter round came of it.) The true reach, 7.928932, refuses it by name.
  assert.throws(() => took(8.5), e => e.code === 'PARAMETER' && /\[RADIUS_EXCEEDS_FACE\].*7\.928932 mm/.test(e.message));
});
