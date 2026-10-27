import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, brepMassProperties, checkBrep, massPropertiesOf, checkOutput } from '../dist/index.js';
import { finishBrepEdges } from '../dist/blend/edge-finish.js';
import { chainPath } from '../dist/blend/rolling-ball.js';

// R10.B (D99): the analytic Boolean where tool faces coincide with body faces or lie along them. Each case here was
// refused or failed before (HEAD f2015c295-aef81b898): the rolling ball's tool capped in an end face's plane (D97), a
// general fillet ending square on a face (D90, D94), a coaxial tool touching a cone along a circle (D88), a rounded
// box's corner balls turned off their poles (D93), and a box whose ray test evaluated a patch at NaN.
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const at = (b, y, z) => b.edges.find(e => e.curve.degree === 1 && e.curve.controlPoints.every(p => Math.abs(p[1] - y) < 1e-9 && Math.abs(p[2] - z) < 1e-9)).name;
const shoelace = pts => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const segment = (r, a) => r * r / 2 * (a - Math.sin(a));

/** A step 40 long between ends x = y tan θ and 40 + y tan θ (θ 0: square), its riser's top rounded 4. */
const step = deg => {
  const t = Math.tan(deg * Math.PI / 180), q = d => [[0, 0], [40, 0], [40 + d * t, d], [d * t, d]];
  const body = [{ id: 's', kind: 'sketch', profile: 'polygon', points: q(30) }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 },
    { id: 'q', kind: 'sketch', profile: 'polygon', points: q(15) }, { id: 'f0', kind: 'extrude', sketch: 'q', height: 10, from: 10 }, { id: 'u', kind: 'union', target: 'e', tool: 'f0' }];
  return [...body, { id: 'g', kind: 'fillet', target: 'u', edges: [at(out(body).brep, 15, 20)], radius: 4 }];
};
/** The foot's section past the round (D97's closed form). */
const concave = r => {
  const O = [11, 16], C = [O[0] + Math.sqrt((r + 4) ** 2 - (r - 6) ** 2), 10 + r], d = Math.hypot(C[0] - O[0], C[1] - O[1]), T = [O[0] + 4 * (C[0] - O[0]) / d, O[1] + 4 * (C[1] - O[1]) / d];
  return shoelace([[C[0], 10], [15, 10], [15, 16], T]) - segment(4, Math.atan2(T[1] - O[1], T[0] - O[0])) - segment(r, Math.acos((C[1] - T[1]) / r));
};

test('R10.B the rolling ball\'s tool capped in an end face\'s plane (D97\'s overflowing foot): the step\'s foot past its round at r 6.5–15, ends oblique (10°) and square — each the closed form × 40 to 1e-7 (refused before at most radii: the cap\'s cuts left open by 1e-4, a fillet arc tangent to the floor read on the wrong side of it)', () => {
  for (const deg of [10, 0]) {
    const body = step(deg), o0 = out(body), v0 = massPropertiesOf(o0).volume, inner = at(o0.brep, 15, 10);
    for (const r of deg ? [6.5, 8, 9, 10, 11, 14, 15] : [6.5, 8, 10, 14]) {
      const o = out([...body, { id: 'f', kind: 'fillet', target: 'g', edges: [inner], radius: r }]);
      assert.equal(checkOutput(o).valid, true, `${deg}° r ${r}`);
      const got = massPropertiesOf(o).volume - v0, exact = concave(r) * 40;
      assert.ok(Math.abs(got / exact - 1) < 1e-7, `${deg}° r ${r}: ${got} vs ${exact} (${got / exact - 1})`);
    }
  }
});

test('R10.B a general fillet ending square on a face (D90/D94, the rod lying straight across a plate, forced): both feet at r 0.25–3 — the R10.1 section × 40 to 1e-9 (refused before; one foot at r 2 until D267)', () => {
  const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
  const body = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [40, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 },
    { id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 4, plane: yz }, { id: 'c0', kind: 'extrude', sketch: 'cs', height: 60, from: -10 }, { id: 'g', kind: 'union', target: 'pe', tool: 'c0' }];
  const o0 = out(body), v0 = massPropertiesOf(o0).volume, rims = o0.brep.edges.filter(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name)).map(e => e.name);
  const section = r => { const yc = Math.sqrt((4 + r) ** 2 - r ** 2); return yc * r / 2 - r * r * Math.atan2(yc, r) / 2 - 16 * Math.atan2(r, yc) / 2; };
  assert.equal(rims.length, 2);
  // (The foot at r 2 that "the Boolean could not close" was a tool folded back on itself: its last section, an ulp short of
  // the chain's end, put at its start, D267.)
  for (const r of [0.25, 0.5, 1, 1.5, 2, 3]) for (const [k, rim] of rims.entries()) {
    const g = finishBrepEdges(o0.brep, [rim], r, 'fillet', 'f', { general: true });
    assert.equal(checkBrep(g).valid, true, `r ${r} rim ${k}`);
    const got = brepMassProperties(g, 1).volume - v0, exact = section(r) * 40;
    assert.ok(Math.abs(got / exact - 1) < 1e-9, `r ${r} rim ${k}: ${got} vs ${exact} (${got / exact - 1})`);
  }
});

test('R10.B an open chain\'s point an ulp or a few short of its end lies at its end, not its start (D267)', () => {
  // (Wrapped as (x % L + L) % L, x an ulp below L came out 0: x + L rounds to 2L. The general fillet's last section went
  // to the chain's start, and the tool folded back on itself: "the analytic Boolean cannot close it", an edge used 6 times.)
  const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
  const o = out([{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [40, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 },
    { id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 4, plane: yz }, { id: 'c0', kind: 'extrude', sketch: 'cs', height: 60, from: -10 }, { id: 'g', kind: 'union', target: 'pe', tool: 'c0' }]);
  const rim = o.brep.edges.find(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name)), path = chainPath([{ curve: rim.curve, reversed: false }], false), L = path.length;
  const end = path.at(L).X, ulp = 2 ** (Math.floor(Math.log2(L)) - 52);
  for (let k = 1; k <= 4; k++) { const X = path.at(L - k * ulp).X; assert.ok(Math.hypot(X[0] - end[0], X[1] - end[1], X[2] - end[2]) < 1e-9, `L − ${k} ulp: ${X} vs ${end}`); }
  const X0 = path.at(ulp).X, start = path.at(0).X;
  assert.ok(Math.hypot(X0[0] - start[0], X0[1] - start[1], X0[2] - start[2]) < 1e-9, 'an ulp past the start');
});

test('R10.B a coaxial tool touching a cone along a circle (D88\'s TODO, the property\'s smallest counterexample R 9, h 10, top 0.537, hc 4.172, r 1, and its first run): valid, against Pappus to 1e-9 of the part (a band of the cone classified out on one half: the first ray grazed the tool)', () => {
  for (const v of [{ R: 9, h: 10, top: 0.537, hc: 4.172, r: 1 }, { R: 8.993, h: 10.394, top: 0.537, hc: 4.172, r: 0.998 }]) {
    const Rt = Math.round(v.R * v.top * 1000) / 1000, H = v.h + v.hc;
    const body = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [v.R, 0], [v.R, v.h], [Rt, H], [0, H]], plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } }, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }];
    const o0 = out(body), edge = o0.brep.edges.find(e => /side1#1/.test(e.name) && /side2#1/.test(e.name)).name;
    const o = out([...body, { id: 'f', kind: 'fillet', target: 'r', edges: [edge], radius: v.r }]);
    assert.equal(checkOutput(o).valid, true);
    // The meridian corner at (R, h): the region between the wall, the cone and the ball's arc, its first moment about the axis × 2π.
    const P = [v.R, v.h], w1 = [0, -1], l = Math.hypot(Rt - v.R, v.hc), w2 = [(Rt - v.R) / l, v.hc / l], alpha = Math.acos(w1[0] * w2[0] + w1[1] * w2[1]);
    const t = v.r / Math.tan(alpha / 2), b2 = [w1[0] + w2[0], w1[1] + w2[1]], bl = Math.hypot(...b2), k = v.r / Math.sin(alpha / 2);
    const T1 = [P[0] + w1[0] * t, P[1] + w1[1] * t], T2 = [P[0] + w2[0] * t, P[1] + w2[1] * t], C = [P[0] + b2[0] / bl * k, P[1] + b2[1] / bl * k];
    const a0 = Math.atan2(T1[1] - C[1], T1[0] - C[0]), a1 = Math.atan2(T2[1] - C[1], T2[0] - C[0]), n = 200000, pts = [P, T1];
    let da = a1 - a0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    for (let i = 1; i < n; i++) { const a = a0 + da * i / n; pts.push([C[0] + v.r * Math.cos(a), C[1] + v.r * Math.sin(a)]); }
    pts.push(T2);
    let M = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; M += (x0 + x1) * (x0 * y1 - x1 * y0) / 6; }
    const a = massPropertiesOf(o0).volume, got = a - massPropertiesOf(o).volume, exact = 2 * Math.PI * Math.abs(M);
    assert.ok(Math.abs(got - exact) <= 1e-9 * a, `${JSON.stringify(v)}: ${got} vs ${exact} (${(got - exact) / a} of the part)`);
  }
});

test('R10.B a box\'s corner balls turned so their poles and seam lie off the patch (D93\'s TODO): every edge of five boxes rounded — Steiner\'s formula to 3e-7 (1.2e-5–2.5e-5 before, the pole inside the patch); and a box whose ray test reached a patch at NaN builds (an untyped kernel failure before)', () => {
  const rounded = (a, b, c, r) => (a - 2 * r) * (b - 2 * r) * (c - 2 * r) + 2 * r * ((a - 2 * r) * (b - 2 * r) + (b - 2 * r) * (c - 2 * r) + (a - 2 * r) * (c - 2 * r)) + Math.PI * r * r * (a + b + c - 6 * r) + 4 / 3 * Math.PI * r ** 3;
  for (const [a, b, c, r] of [[20, 14, 10, 2], [30, 20, 12, 3], [17, 11, 9, 1.5], [40, 25, 15, 4.5], [12, 12, 12, 2.5], [9.498, 15.729, 24.129, 1.765]]) {
    const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [a, b] }, { id: 'e', kind: 'extrude', sketch: 's', height: c }];
    const o = out([...box, { id: 'f', kind: 'fillet', target: 'e', edges: out(box).brep.edges.map(e => e.name), radius: r }]), m = massPropertiesOf(o);
    assert.equal(checkOutput(o).valid, true, `${a}×${b}×${c} r ${r}`);
    assert.equal(m.method, 'quadrature');
    assert.ok(Math.abs(m.volume / rounded(a, b, c, r) - 1) < 3e-7, `${a}×${b}×${c} r ${r}: ${m.volume / rounded(a, b, c, r) - 1}`);
  }
});
