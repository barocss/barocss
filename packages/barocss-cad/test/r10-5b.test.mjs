import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, massPropertiesOf, checkOutput } from '../dist/index.js';
import { evaluateSurface } from '../dist/core/math.js';
import { setRingStations } from '../dist/blend/rolling-ball.js';

// R10.5b (D103): conic and G2 sections. Between the rolling ball's contacts (as for the circle), the section is a conic
// tangent there to both faces — rational quadratic with its middle pole at the faces' corner Q, weight ρ/(1 − ρ) — or a
// quartic tangent to both and with each face's normal curvature across the contact (G2): poles T1, P1, P2, P3, T2, P1
// and P3 a fraction `tension` of the way to Q, P2 where the curvatures hold (on planes, Q itself).
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const at = (b, y, z) => b.edges.find(e => e.curve.degree === 1 && e.curve.controlPoints.every(p => Math.abs(p[1] - y) < 1e-9 && Math.abs(p[2] - z) < 1e-9)).name;
const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
/** The region between the corner (0, 0) and a curve from (r, 0) to (0, r): Green over 200 000 chords of the curve. */
const region = curve => { const pts = [[0, 0]]; for (let i = 0; i <= 200000; i++) pts.push(curve(i / 200000)); let A = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; A += x0 * y1 - x1 * y0; } return Math.abs(A) / 2; };
/** Its first moment about the line x = −R (a boss of radius R, the corner at its foot): Pappus's lever. */
const moment = (curve, R) => { const pts = [[0, 0]]; for (let i = 0; i <= 200000; i++) pts.push(curve(i / 200000)); let M = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; M += ((x0 + R) + (x1 + R)) * ((x0 + R) * y1 - (x1 + R) * y0) / 6; } return Math.abs(M); };
const conic = (r, w) => t => { const b0 = (1 - t) ** 2, b1 = 2 * t * (1 - t) * w, b2 = t * t, d = b0 + b1 + b2; return [b0 * r / d, b2 * r / d]; };
const quartic = (r, k) => t => { const P = [[r, 0], [r * (1 - k), 0], [0, 0], [0, r * (1 - k)], [0, r]], B = [1, 4, 6, 4, 1].map((c, i) => c * t ** i * (1 - t) ** (4 - i)); return [0, 1].map(j => P.reduce((a, p, i) => a + B[i] * p[j], 0)); };
const shapes = r => [
  ['ρ of the circle', { kind: 'conic', rho: Math.SQRT1_2 / (1 + Math.SQRT1_2) }, conic(r, Math.SQRT1_2)],
  ['ρ 0.3', { kind: 'conic', rho: 0.3 }, conic(r, 0.3 / 0.7)], ['ρ 0.5 (a parabola)', { kind: 'conic', rho: 0.5 }, conic(r, 1)], ['ρ 0.7', { kind: 'conic', rho: 0.7 }, conic(r, 0.7 / 0.3)],
  ['G2', { kind: 'g2' }, quartic(r, 0.5)], ['G2 tension 0.3', { kind: 'g2', tension: 0.3 }, quartic(r, 0.3)], ['G2 tension 0.8', { kind: 'g2', tension: 0.8 }, quartic(r, 0.8)],
];

test('R10.5b a box\'s top edge (convex, square planes) and a step\'s foot (concave), r 3: conics ρ 0.3–0.7 and G2 (tension 0.3–0.8) — the section between the corner and the exact curve × 40 to 1e-9; the circle\'s ρ the circular fillet\'s (1 − π/4) r² L', () => {
  const step = [...box, { id: 'q', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 15] }, { id: 'f0', kind: 'extrude', sketch: 'q', height: 10, from: 10 }, { id: 'u', kind: 'union', target: 'e', tool: 'f0' }];
  for (const [what, body, target, edgeAt, sign] of [['top edge', box, 'e', [0, 10], -1], ['step foot', step, 'u', [15, 10], 1]]) {
    const o0 = out(body), v0 = massPropertiesOf(o0).volume, edge = at(o0.brep, ...edgeAt);
    for (const [label, section, curve] of shapes(3)) {
      const o = out([...body, { id: 'f', kind: 'fillet', target, edges: [edge], radius: 3, section }]), got = sign * (massPropertiesOf(o).volume - v0), exact = region(curve) * 40;
      assert.equal(checkOutput(o).valid, true, `${what}, ${label}`);
      assert.ok(Math.abs(got / exact - 1) < 1e-9, `${what}, ${label}: ${got} vs ${exact} (${got / exact - 1})`);
    }
  }
  const o0 = out(box), circle = out([...box, { id: 'f', kind: 'fillet', target: 'e', edges: [at(o0.brep, 0, 10)], radius: 3, section: shapes(3)[0][1] }]);
  assert.ok(Math.abs((massPropertiesOf(o0).volume - massPropertiesOf(circle).volume) / ((1 - Math.PI / 4) * 9 * 40) - 1) < 1e-9);
});

test('R10.5b with a varying radius (D100): a box\'s top edge from r 1 to r 3, a parabola (ρ 0.5) and G2 — each section the shape at r(x), r² L / 6 and r² L / 10 integrated, to 1e-10', () => {
  const v0 = massPropertiesOf(out(box)).volume;
  for (const [section, c] of [[{ kind: 'conic', rho: 0.5 }, 1 / 6], [{ kind: 'g2' }, 1 / 10]]) {
    const o = out([...box, { id: 'f', kind: 'fillet', target: 'e', edges: [at(out(box).brep, 0, 10)], radii: [{ at: [0, 0, 10], radius: 1 }, { at: [40, 0, 10], radius: 3 }], section }]);
    const got = v0 - massPropertiesOf(o).volume, exact = c * 40 * (1 + 3 + 9) / 3;
    assert.equal(checkOutput(o).valid, true, section.kind);
    assert.ok(Math.abs(got / exact - 1) < 1e-10, `${section.kind}: ${got} vs ${exact}`);
  }
});

test('R10.5b G2 on a curved face: a groove\'s rim (a plate and a cylinder R 4) filleted r 1 — valid, and across each contact the fillet\'s section curves as the face does (1/4 at the cylinder, 0 at the plate) to 1e-5, by differences of the B-rep\'s own surface; the circular one curves 1/r there (G1 only)', () => {
  const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
  const body = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [40, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 }, { id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 4, plane: yz }, { id: 'c0', kind: 'extrude', sketch: 'cs', height: 60, from: -10 }, { id: 'g', kind: 'difference', target: 'pe', tool: 'c0' }];
  const rim = out(body).brep.edges.find(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name) && e.curve.controlPoints[0][1] > 0).name;
  // The curvature of a fillet patch's cross curve at a contact (u 0 or 1), by one-sided differences, Richardson-extrapolated.
  const across = (S, u, v) => {
    const k = h => { const sg = u === 0 ? 1 : -1, d = s => evaluateSurface(S, s, v), p = d(u), q1 = d(u + sg * h), q2 = d(u + 2 * sg * h);
      const t1 = [0, 1, 2].map(j => (-3 * p[j] + 4 * q1[j] - q2[j]) / (2 * h)), t2 = [0, 1, 2].map(j => (p[j] - 2 * q1[j] + q2[j]) / (h * h)), c = [t1[1] * t2[2] - t1[2] * t2[1], t1[2] * t2[0] - t1[0] * t2[2], t1[0] * t2[1] - t1[1] * t2[0]];
      return Math.hypot(...c) / Math.hypot(...t1) ** 3; };
    return { p: evaluateSurface(S, u, v), k: 2 * k(1.25e-4) - k(2.5e-4) };
  };
  for (const [section, expect] of [[{ kind: 'g2' }, p => Math.abs(Math.hypot(p[1], p[2] - 10) - 4) < 1e-6 ? 0.25 : 0], [{ kind: 'circular' }, () => 1]]) {
    const o = out([...body, { id: 'f', kind: 'fillet', target: 'g', edges: [rim], radius: 1, section }]);
    assert.equal(checkOutput(o).valid, true, section.kind);
    const faces = o.brep.faces.filter(f => /^f\.face/.test(f.name)).filter(f => { const x = evaluateSurface(f.surface, 0.5, 0.5)[0]; return x > 2 && x < 38; });
    assert.ok(faces.length > 0);
    for (const f of faces) for (const v of [0.25, 0.5, 0.75]) for (const u of [0, 1]) {
      const { p, k } = across(f.surface, u, v);
      assert.ok(Math.abs(k - expect(p)) < 1e-5, `${section.kind} at ${p.map(x => +x.toFixed(4))}: ${k} vs ${expect(p)}`);
    }
  }
});

test('R10.5b G2 and a conic round a boss\'s foot (a closed circle between a plate and a cylinder, both straight across): Pappus over the section — within the loft\'s own reported deviation × the fillet\'s area at its stations, and to 1e-8 of the fillet at 1024', () => {
  const R = 8, r = 2, boss = [{ id: 'as', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'a', kind: 'extrude', sketch: 'as', height: 10 },
    { id: 'bs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: R }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 15, from: 10 }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }];
  const o0 = out(boss), v0 = massPropertiesOf(o0).volume, foot = o0.brep.edges.filter(e => /a\.top/.test(e.name) && /b\.side0/.test(e.name)).map(e => e.name);
  // (The loft is cubic along the circle through every other station: its sections are off the true ones by the
  // deviation it reports, `sectionMM`; the fillet's area is under 2π (R + r) × the section's length.)
  const arc = curve => { let l = 0; for (let i = 1; i <= 20000; i++) { const p = curve((i - 1) / 20000), q = curve(i / 20000); l += Math.hypot(q[0] - p[0], q[1] - p[1]); } return l; };
  for (const [label, section, curve] of [['G2', { kind: 'g2' }, quartic(r, 0.5)], ['ρ 0.6', { kind: 'conic', rho: 0.6 }, conic(r, 1.5)]]) {
    const exact = 2 * Math.PI * moment(curve, R);
    for (const stations of [null, 1024]) {
      setRingStations(stations);
      try {
        const o = out([...boss, { id: 'f', kind: 'fillet', target: 'u', edges: foot, radius: r, section }]), got = massPropertiesOf(o).volume - v0, rep = o.fillet[0];
        assert.equal(checkOutput(o).valid, true, label);
        if (stations) assert.ok(Math.abs(got / exact - 1) < 1e-8, `${label} at ${stations}: ${got} vs ${exact} (${got / exact - 1})`);
        else assert.ok(Math.abs(got - exact) <= rep.sectionMM * 2 * Math.PI * (R + r) * arc(curve), `${label}: ${got} vs ${exact}, deviation ${rep.sectionMM}`);
      } finally { setRingStations(null); }
    }
  }
});

test('R10.5b refusals: ρ outside (0, 1), tension outside (0, 1), an unknown section (INPUT); a conic where the ball rolls round an edge at a corner (CAPABILITY)', () => {
  const o0 = out(box), edge = at(o0.brep, 0, 10);
  for (const section of [{ kind: 'conic', rho: 1 }, { kind: 'conic', rho: 0 }, { kind: 'g2', tension: 1.2 }, { kind: 'spline' }])
    assert.throws(() => out([...box, { id: 'f', kind: 'fillet', target: 'e', edges: [edge], radius: 2, section }]), e => e.code === 'INPUT', JSON.stringify(section));
  const boss = [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 10 },
    { id: 'bs', kind: 'sketch', profile: 'rectangle', min: [-10, -6], max: [10, 6] }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 15, from: 10 }, { id: 'u', kind: 'union', target: 'p', tool: 'b' }];
  const foot = out(boss).brep.edges.filter(e => /p\.top/.test(e.name) && /b\.side/.test(e.name)).map(e => e.name);
  assert.throws(() => out([...boss, { id: 'f', kind: 'fillet', target: 'u', edges: foot, radius: 1, section: { kind: 'conic', rho: 0.5 } }]), e => e.code === 'CAPABILITY' && /conic fillet where the ball rolls round an edge/.test(e.message));
});
