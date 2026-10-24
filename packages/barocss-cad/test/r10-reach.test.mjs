import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart } from '../dist/index.js';

// D97: a straight edge between two planes finished past a round already made. Its reach check (planeReach) counted
// only convex finishes, and walked on across a smooth edge onto another surface: a concave fillet or chamfer there
// built valid but wrong — its section on the riser carried on past the round. Now both are checked, every boundary
// of the face bounding a concave (adding) finish; past a smooth edge onto another surface a fillet is the rolling
// ball's (it rolls over onto the round, R10.4a), a chamfer is refused. The rolling ball's own check had the same hole:
// on an open chain shorter than twice its reach past the ends, no contact was checked at all.
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const t = Math.tan(Math.PI / 18);
/** The straight edge at (y, z). */
const at = (b, y, z) => b.edges.find(e => e.curve.degree === 1 && e.curve.controlPoints.every(p => Math.abs(p[1] - y) < 1e-9 && Math.abs(p[2] - z) < 1e-9)).name;
const finish = (kind, target, edge, size) => ({ id: 'f', kind, target, edges: [edge], ...(kind === 'fillet' ? { radius: size } : { distance: size }) });
const shoelace = pts => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const segment = (r, a) => r * r / 2 * (a - Math.sin(a));

// A step, 40 long between its ends (oblique, x = y tan 10° and 40 + y tan 10°, or square): a block 30 deep and 10 high,
// on it one 15 deep (its riser at y = 15, z 10–20), the riser's top edge rounded 4 — 6 mm of flat riser left.
const step = oblique => {
  const q = d => oblique ? [[0, 0], [40, 0], [40 + d * t, d], [d * t, d]] : [[0, 0], [40, 0], [40, d], [0, d]];
  const body = [{ id: 's', kind: 'sketch', profile: 'polygon', points: q(30) }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 },
    { id: 'q', kind: 'sketch', profile: 'polygon', points: q(15) }, { id: 'f0', kind: 'extrude', sketch: 'q', height: 10, from: 10 }, { id: 'u', kind: 'union', target: 'e', tool: 'f0' }];
  return [...body, { id: 'g', kind: 'fillet', target: 'u', edges: [at(out(body).brep, 15, 20)], radius: 4 }];
};
/** The concave fillet's section past the round (centre (11, 16), radius 4): the ball on the floor touching the round. */
const concave = r => {
  const O = [11, 16], C = [O[0] + Math.sqrt((r + 4) ** 2 - (r - 6) ** 2), 10 + r], d = Math.hypot(C[0] - O[0], C[1] - O[1]), T = [O[0] + 4 * (C[0] - O[0]) / d, O[1] + 4 * (C[1] - O[1]) / d];
  return shoelace([[C[0], 10], [15, 10], [15, 16], T]) - segment(4, Math.atan2(T[1] - O[1], T[0] - O[0])) - segment(r, Math.acos((C[1] - T[1]) / r));
};

test('D97 an oblique step, its riser\'s top rounded 4, the inner edge filleted 7 and 12 — past the 6 mm of flat riser: the ball rolls over onto the round; the added volume the closed-form section × 40 to 1e-7 (built 3.3 % and 121 % over before, the section on the riser carried on)', () => {
  const body = step(true), o0 = out(body), v0 = o0.massProperties(1).volumeMM3, inner = at(o0.brep, 15, 10);
  for (const r of [7, 12]) {
    const o = out([...body, finish('fillet', 'g', inner, r)]);
    assert.equal(o.validate().valid, true, `r ${r}`);
    assert.equal(o.bodyCount, 1);
    const got = o.massProperties(1).volumeMM3 - v0, exact = concave(r) * 40;
    assert.ok(Math.abs(got / exact - 1) < 1e-7, `r ${r}: ${got} vs ${exact} (${got / exact - 1})`);
    const [rep] = o.fillet;
    assert.ok(rep && rep.contactMM <= 2.5e-7 && rep.sectionMM <= 1e-6 && rep.ballMM < 1e-8, JSON.stringify(rep));
  }
});

test('D97 convex: a block with oblique ends, its bottom edge on y = 0 rounded 8, the top edge filleted 2.5, 3 and 4 — past the 2 mm of flat wall: the ball rolls round onto the round; the removed volume the closed-form section × 40 to 1e-7 (refused RADIUS_EXCEEDS_FACE before)', () => {
  const box = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [40, 0], [40 + 30 * t, 30], [30 * t, 30]] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
  const body = [...box, { id: 'g', kind: 'fillet', target: 'e', edges: [at(out(box).brep, 0, 0)], radius: 8 }], o0 = out(body), v0 = o0.massProperties(1).volumeMM3, top = at(o0.brep, 0, 10);
  for (const r of [2.5, 3, 4]) {
    // The ball inside, touching the top and the round (centre (8, 8)) from within: |C − O| = 8 − r.
    const O = [8, 8], C = [8 - Math.sqrt((8 - r) ** 2 - (2 - r) ** 2), 10 - r], d = 8 - r, T = [O[0] + 8 * (C[0] - O[0]) / d, O[1] + 8 * (C[1] - O[1]) / d];
    const exact = 40 * (shoelace([[C[0], 10], [0, 10], [0, 8], T]) + segment(8, Math.atan2(O[1] - T[1], O[0] - T[0])) - segment(r, Math.PI / 2 + Math.atan2(C[1] - T[1], C[0] - T[0])));
    const o = out([...body, finish('fillet', 'g', top, r)]);
    assert.equal(o.validate().valid, true, `r ${r}`);
    const got = v0 - o.massProperties(1).volumeMM3;
    assert.ok(Math.abs(got / exact - 1) < 1e-7, `r ${r}: ${got} vs ${exact} (${got / exact - 1})`);
  }
});

test('D97 refusals, none built wrong: the concave chamfer 8 past the round (RADIUS_EXCEEDS_FACE; built 51 % over before); within the flat riser the closed form as before', () => {
  for (const oblique of [false, true]) {
    const body = step(oblique), o0 = out(body), inner = at(o0.brep, 15, 10);
    assert.throws(() => out([...body, finish('chamfer', 'g', inner, 8)]), e => (e.details?.category ?? e.code) === 'PARAMETER' && /\[RADIUS_EXCEEDS_FACE\].*walls of 6 and 15 mm/.test(e.message), `chamfer, oblique ${oblique}`);
    // (The fillet 8 past the round, refused at D97 where the Boolean could not close it, builds since R10.B: r10-b.test.mjs.)
    const got = out([...body, finish('fillet', 'g', inner, 5)]).massProperties(1).volumeMM3 - o0.massProperties(1).volumeMM3;
    assert.ok(Math.abs(got / ((1 - Math.PI / 4) * 25 * 40) - 1) < (oblique ? 2e-7 : 1e-9), `fillet 5, oblique ${oblique}: ${got}`);
    // (At oblique ends too since D98: the wedge ends in the end face's plane.)
    const chamfer = out([...body, finish('chamfer', 'g', inner, 5)]).massProperties(1).volumeMM3 - o0.massProperties(1).volumeMM3;
    assert.ok(Math.abs(chamfer / (12.5 * 40) - 1) < 1e-9, `chamfer 5, oblique ${oblique}: ${chamfer}`);
  }
});
