import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, faceGeometry, booleanAnalytic, brepMassProperties, outputOf, massPropertiesOf, checkOutput } from '../dist/index.js';

// FR S0 (D122): the feasibility checkpoint before frames and weldments. No research note; probed here against closed forms:
// whether today's kernel builds a structural member exactly (a profile's section — a rectangular tube with corner radii,
// an angle with root and toe radii, a channel — placed square to any 3D segment and extruded its length), whether its ends
// can be mitred, butted, coped and trimmed in order at a joint of three, and what a cut list can read from the result
// (length on the axis, long-point length, end angles, mass). Oracles, none of them the kernel's: the section's area in
// closed form; a prism cut by planes holds A × (its centroidal axis between them); the cut face's area A / cos θ; the
// long point L + c·tan θ; a fish-mouth cope's removed volume by a 1D quadrature of two cylinders' overlap. No product
// code changed. The section dimensions are test values (no standard or supplier table).
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const run = features => evaluateCadPart(D(features));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s], unit = a => scl(a, 1 / Math.hypot(...a));
const STEEL = 7.85; // g/cm³ (a test value)
const near = (got, want, rel, what) => assert.ok(Math.abs(got - want) <= rel * Math.abs(want), `${what}: ${got} vs ${want} (rel ${Math.abs(got - want) / Math.abs(want)})`);

// ---- sections (closed loops of lines and arcs, each segment from its start to the next one's) ----------------------------
/** A rectangle 2hx × 2hy about the origin, corners rounded r (r 0: sharp), anticlockwise. */
function roundedRect(hx, hy, r) {
  if (r === 0) return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(start => ({ kind: 'line', start }));
  return [
    { kind: 'line', start: [-hx + r, -hy] }, { kind: 'arc', start: [hx - r, -hy], center: [hx - r, -hy + r], direction: 'ccw' },
    { kind: 'line', start: [hx, -hy + r] }, { kind: 'arc', start: [hx, hy - r], center: [hx - r, hy - r], direction: 'ccw' },
    { kind: 'line', start: [hx - r, hy] }, { kind: 'arc', start: [-hx + r, hy], center: [-hx + r, hy - r], direction: 'ccw' },
    { kind: 'line', start: [-hx, hy - r] }, { kind: 'arc', start: [-hx, -hy + r], center: [-hx + r, -hy + r], direction: 'ccw' },
  ];
}
/** A rectangular tube b × h, wall t, outer corners ro and inner ro − t (concentric): its section and area. */
function rhs(b, h, t, ro) {
  const ri = Math.max(0, ro - t), k = 4 - Math.PI;
  return { outer: roundedRect(b / 2, h / 2, ro), holes: [roundedRect(b / 2 - t, h / 2 - t, ri)], area: b * h - k * ro * ro - ((b - 2 * t) * (h - 2 * t) - k * ri * ri), envelope: roundedRect(b / 2, h / 2, ro) };
}
/** An angle, legs a (along x) and b (along y), thickness t, root radius r1, toe radii r2; the heel at the origin. */
function angle(a, b, t, r1, r2) {
  const outer = [
    { kind: 'line', start: [0, 0] }, { kind: 'line', start: [a, 0] }, { kind: 'arc', start: [a, t - r2], center: [a - r2, t - r2], direction: 'ccw' },
    { kind: 'line', start: [a - r2, t] }, { kind: 'arc', start: [t + r1, t], center: [t + r1, t + r1], direction: 'cw' },
    { kind: 'line', start: [t, t + r1] }, { kind: 'arc', start: [t, b - r2], center: [t - r2, b - r2], direction: 'ccw' },
    { kind: 'line', start: [t - r2, b] }, { kind: 'line', start: [0, b] },
  ];
  return { outer, area: t * (a + b - t) + (1 - Math.PI / 4) * (r1 * r1 - 2 * r2 * r2) };
}
/** A channel with parallel flanges: web height h along y, flanges b along x, web tw, flanges tf, root radius r. */
function channel(h, b, tw, tf, r) {
  const outer = [
    { kind: 'line', start: [0, 0] }, { kind: 'line', start: [b, 0] }, { kind: 'line', start: [b, tf] },
    { kind: 'arc', start: [tw + r, tf], center: [tw + r, tf + r], direction: 'cw' }, { kind: 'line', start: [tw, tf + r] },
    { kind: 'arc', start: [tw, h - tf - r], center: [tw + r, h - tf - r], direction: 'cw' }, { kind: 'line', start: [tw + r, h - tf] },
    { kind: 'line', start: [b, h - tf] }, { kind: 'line', start: [b, h] }, { kind: 'line', start: [0, h] },
  ];
  return { outer, area: h * tw + 2 * (b - tw) * tf + 2 * (1 - Math.PI / 4) * r * r };
}

/**
 * A member: the section's sketch square to the segment p0 → p1 at p0 (its x along `xAxis`, the section's origin on the
 * segment), extruded the segment's length plus `ext` past each end (to be trimmed back).
 */
function member(id, section, p0, p1, xAxis, ext = [0, 0], { envelope = false } = {}) {
  const u = unit(sub(p1, p0)), L = Math.hypot(...sub(p1, p0)), x = unit(sub(xAxis, scl(u, dot(xAxis, u))));
  const plane = { origin: sub(p0, scl(u, ext[0])), normal: u, xAxis: x };
  const sketch = envelope ? { id: `${id}s`, kind: 'sketch', profile: 'loop', segments: section.envelope, plane } : { id: `${id}s`, kind: 'sketch', profile: 'loop', segments: section.outer, ...(section.holes ? { holes: section.holes } : {}), plane };
  return [sketch, { id, kind: 'extrude', sketch: `${id}s`, height: L + ext[0] + ext[1] }];
}
/** Every vertex of a B-rep (its edges' ends). */
const vertices = brep => brep.vertices.map(v => v.point);

test('FR S0: sections exact — a rectangular tube, an angle and a channel along oblique 3D segments, volume A·L to 1e-12, valid, one body', () => {
  const cases = [
    ['rhs 40×40×3 ro 6', rhs(40, 40, 3, 6)], ['rhs 60×30×2.5 ro 5', rhs(60, 30, 2.5, 5)], ['rhs sharp 30×20×2', rhs(30, 20, 2, 0)],
    ['angle 50×30×5 r1 6 r2 3', angle(50, 30, 5, 6, 3)], ['channel 80×40×5×8 r 7', channel(80, 40, 5, 8, 7)],
  ];
  const p0 = [10, -20, 5], p1 = [310, 140, 205], L = Math.hypot(...sub(p1, p0));
  for (const [name, s] of cases) {
    const o = outputOf(run(member('m', s, p0, p1, [0, 0, 1])), 'm');
    near(massPropertiesOf(o, STEEL).volume, s.area * L, 1e-12, name);
    assert.equal(o.bodyCount, 1, name); assert.ok(checkOutput(o).valid, `${name}: ${JSON.stringify(checkOutput(o).issues?.slice(0, 2))}`);
    near(massPropertiesOf(o, STEEL).mass, STEEL * s.area * L * 1e-3, 1e-12, `${name} mass`);
  }
});

test('FR S0: roll — the same tube turned about its axis keeps A·L; its faces turn with the x axis given', () => {
  const s = rhs(60, 30, 2.5, 5), p0 = [0, 0, 0], p1 = [100, 50, 80], u = unit(sub(p1, p0));
  for (const roll of [0, 30, 90, 137]) {
    const z = unit(sub([0, 0, 1], scl(u, u[2]))), y = cross(u, z), r = roll * Math.PI / 180, x = add(scl(z, Math.cos(r)), scl(y, Math.sin(r)));
    const o = outputOf(run(member('m', s, p0, p1, x)), 'm');
    near(massPropertiesOf(o, STEEL).volume, s.area * Math.hypot(...sub(p1, p0)), 1e-12, `roll ${roll}`);
    // The widest flat side (60 wide, its normal the section's y) — the face whose normal is ±(u × x).
    const n = cross(u, x), wide = o.brep.faces.map(f => faceGeometry(f)).filter(g => g.kind === 'plane' && Math.abs(Math.abs(dot(g.n, n)) - 1) < 1e-12);
    assert.equal(wide.length, 4, `roll ${roll}: two outer and two inner wide sides`);
  }
});

/** The mitre plane at a joint p: the plane through p square to u1 + u2 (u1 into the joint, u2 out of it). */
const mitre = (p, u1, u2) => { const m = unit(add(u1, u2)); return { normal: m, at: dot(m, p) }; };

test('FR S0: a mitre by today\'s split — each member A × its axis to the joint, the cut faces coincide (the pair unites to the sum), the end angle θ, the long point L + c·tan θ', t => {
  // A sharp-cornered tube (planar faces: the kernel's mass exact) and a round-cornered one (its cylinders cut obliquely:
  // the kernel's mass by quadrature, measured about 1.6e-9 here; the cut list takes ρ·A·L instead, D122).
  const b = 40;
  for (const [s, tol] of [[rhs(40, 40, 3, 0), 1e-12], [rhs(40, 40, 3, 6), 1e-8]])
  // Three corners: square, open (120° between the members) and out of plane (a 3D joint).
  for (const [name, p0, p, p2] of [['square', [0, 0, 0], [200, 0, 0], [200, 150, 0]], ['open', [0, 0, 0], [200, 0, 0], [200 + 150 * Math.cos(Math.PI / 3), 150 * Math.sin(Math.PI / 3), 0]], ['3d', [0, 0, 0], [200, 0, 0], [260, 90, 70]]]) {
    const u1 = unit(sub(p, p0)), u2 = unit(sub(p2, p)), n = unit(cross(u1, u2)), m = mitre(p, u1, u2);
    // The section's x in the corner's plane (its y square to it), so the two sections mirror in the mitre plane.
    const x1 = cross(n, u1), x2 = cross(n, u2), e = 60;
    const feats = [...member('a', s, p0, p, x1, [0, e]), ...member('b', s, p, p2, x2, [e, 0]),
      { id: 'ac', kind: 'split', target: 'a', normal: m.normal, at: m.at }, { id: 'bc', kind: 'split', target: 'b', normal: m.normal, at: m.at }];
    // (A planar member off the axes: its faces' float vertices are not exactly coplanar. The exact polyhedral Boolean under
    // split refused it at S0, D122; since FR3a, D125, the analytic Boolean takes such a pair.)
    const t0 = performance.now(), snap = run(feats), A = outputOf(snap, 'ac/0'), B = outputOf(snap, 'bc/1'); t.diagnostic(`${name} ro ${tol === 1e-12 ? 0 : 6}: split ${Math.round(performance.now() - t0)} ms`);
    const L1 = Math.hypot(...sub(p, p0)), L2 = Math.hypot(...sub(p2, p));
    near(massPropertiesOf(A, STEEL).volume, s.area * L1, tol, `${name} a`); near(massPropertiesOf(B, STEEL).volume, s.area * L2, tol, `${name} b`);
    assert.ok(checkOutput(A).valid && checkOutput(B).valid, name);
    // (The off-cuts stay outputs: split keeps both sides — a trim that keeps one is missing.)
    assert.ok(snap.outputs.some(o => o.id === 'ac/1') && snap.outputs.some(o => o.id === 'bc/0'), name);
    // The end angle from square: θ = acos(u1·m), by the cut face's plane.
    const theta = Math.acos(dot(u1, m.normal)), cut = A.brep.faces.map(f => faceGeometry(f)).filter(g => g.kind === 'plane' && Math.abs(Math.abs(dot(g.n, m.normal)) - 1) < 1e-12);
    assert.ok(cut.length >= 1, `${name}: the cut face`);
    near(Math.acos(Math.abs(dot(cut[0].n, u1))), theta, 1e-12, `${name} θ`);
    // The long point: the farthest vertex along the axis, L + (b/2)·tan θ (the section's half-width in the corner's plane).
    const lp = Math.max(...vertices(A.brep).map(v => dot(sub(v, p0), u1)));
    near(lp, L1 + b / 2 * Math.tan(theta), 1e-12, `${name} long point`);
    // The two cut faces coincide: their union (the analytic Boolean) is one body with exactly the sum.
    const t1 = performance.now(), u = booleanAnalytic(A.brep, B.brep, 'union'); t.diagnostic(`${name}: weld ${Math.round(performance.now() - t1)} ms`);
    near(brepMassProperties(u, STEEL).volume, s.area * (L1 + L2), tol, `${name} welded`); assert.equal(u.bodies.length, 1, name);
    // Through the part's `union`: planar bodies went to the exact rational polyhedral Boolean, which refused the split's
    // oblique cut face (D122); since FR3a (D125) the analytic Boolean takes them. Curved ones go analytic.
    const welded = outputOf(run([...feats, { id: 'w', kind: 'union', target: 'ac/0', tool: 'bc/1' }]), 'w');
    near(massPropertiesOf(welded, STEEL).volume, s.area * (L1 + L2), tol, `${name} welded by the feature`); assert.equal(welded.bodyCount, 1, name);
  }
});

/** Gauss–Legendre, 5 points on each of n pieces of [a, b]. */
const GL5 = [[-0.906179845938664, 0.2369268850561891], [-0.5384693101056831, 0.4786286704993665], [0, 0.5688888888888889], [0.5384693101056831, 0.4786286704993665], [0.906179845938664, 0.2369268850561891]];
function gauss(f, a, b, n = 400) {
  let I = 0; const h = (b - a) / n;
  for (let i = 0; i < n; i++) for (const [x, w] of GL5) I += w * h / 2 * f(a + h * (i + 0.5) + h / 2 * x);
  return I;
}

test('FR S0: butt and an ordered trim of three at a corner — trimmed to the envelope (a tube itself leaves a piece in its bore)', () => {
  // Sharp-cornered tubes: each trim is a plane's, so the closed forms are exact.
  const s = rhs(40, 40, 3, 0), b = 40, L = 300;
  // X runs through the corner (−b/2 to L); Y is trimmed to X; Z to X and then Y. Each drawn from the corner's point.
  const feats = [
    ...member('x', s, [0, 0, 0], [L, 0, 0], [0, 1, 0], [b / 2, 0]),
    ...member('y', s, [0, 0, 0], [0, L, 0], [1, 0, 0]), ...member('z', s, [0, 0, 0], [0, 0, L], [1, 0, 0]),
    ...member('xe', s, [0, 0, 0], [L, 0, 0], [0, 1, 0], [b / 2, 0], { envelope: true }), ...member('ye', s, [0, 0, 0], [0, L, 0], [1, 0, 0], [0, 0], { envelope: true }),
    { id: 'yt', kind: 'difference', target: 'y', tool: 'xe' }, { id: 'zt0', kind: 'difference', target: 'z', tool: 'xe' }, { id: 'zt', kind: 'difference', target: 'zt0', tool: 'ye' },
  ];
  const snap = run(feats);
  near(massPropertiesOf(outputOf(snap, 'x'), STEEL).volume, s.area * (L + b / 2), 1e-12, 'x');
  // Y and Z begin at the envelope's face, b/2 from the corner: A·(L − b/2) each. (Z: the X envelope's top already clears Y.)
  near(massPropertiesOf(outputOf(snap, 'yt'), STEEL).volume, s.area * (L - b / 2), 1e-12, 'y'); near(massPropertiesOf(outputOf(snap, 'zt'), STEEL).volume, s.area * (L - b / 2), 1e-12, 'z');
  assert.equal(outputOf(snap, 'yt').bodyCount, 1);
  // No two members overlap: the three united weigh their sum.
  const all = outputOf(run([...feats, { id: 'w0', kind: 'union', target: 'x', tool: 'yt' }, { id: 'w', kind: 'union', target: 'w0', tool: 'zt' }]), 'w');
  near(massPropertiesOf(all, STEEL).volume, s.area * (3 * L - b / 2), 1e-12, 'three united');
  // Trimmed to the tube itself instead: a stub of Y is left inside X's bore — a second body.
  const wrong = outputOf(run([...member('x', s, [0, 0, 0], [L, 0, 0], [0, 1, 0], [b / 2, 0]), ...member('y', s, [0, 0, 0], [0, L, 0], [1, 0, 0]), { id: 'yt', kind: 'difference', target: 'y', tool: 'x' }]), 'yt');
  assert.ok(wrong.bodyCount > 1, `${wrong.bodyCount}`);
  // A butt to a plane (Y's end on X's side face y = b/2), by today's split: the same length.
  const butt = outputOf(run([...member('y', s, [0, 0, 0], [0, L, 0], [1, 0, 0]), { id: 'yb', kind: 'split', target: 'y', axis: 'y', at: b / 2 }]), 'yb/1');
  near(massPropertiesOf(butt, STEEL).volume, s.area * (L - b / 2), 1e-12, 'butt');
});

test('FR S0: trimmed to a round-cornered envelope, a member reaches into the corners\' rounds — not a plane\'s butt; the extra by quadrature', t => {
  // X 40 × 40 × 3, corners ro 6 (inner 3), along x; Y the same along y, trimmed to X's envelope. X's envelope at height z is
  // y_e(z) = 14 + √(36 − (|z| − 14)²) past |z| = 14, so Y keeps (b/2 − y_e(z)) more of its material at each z there:
  // 2·∫₀⁶ [w_o(s) − w_i(s)]·(6 − √(36 − s²)) ds, w the section's outer and bore widths at |z| = 14 + s.
  const s = rhs(40, 40, 3, 6), L = 300, b = 40;
  const snap = run([...member('y', s, [0, 0, 0], [0, L, 0], [1, 0, 0]), ...member('xe', s, [0, 0, 0], [L, 0, 0], [0, 1, 0], [b / 2, 0], { envelope: true }), { id: 'yt', kind: 'difference', target: 'y', tool: 'xe' }]);
  // (s = 6 sin t for the outer round, s = 3 sin τ for the bore's: smooth integrands.)
  const outer = gauss(t => 2 * (14 + 6 * Math.cos(t)) * (6 - 6 * Math.cos(t)) * 6 * Math.cos(t), 0, Math.PI / 2);
  const bore = gauss(t => { const q = 3 * Math.sin(t); return 2 * (14 + 3 * Math.cos(t)) * (6 - Math.sqrt(36 - q * q)) * 3 * Math.cos(t); }, 0, Math.PI / 2);
  const extra = 2 * (outer - bore), o = outputOf(snap, 'yt');
  t.diagnostic(`extra ${extra} mm³, relative error ${massPropertiesOf(o, STEEL).volume / (s.area * (L - b / 2) + extra) - 1}`);
  // (A cylinder face cut by a cylinder: the kernel's quadrature mass, measured 1.1e-10 here.)
  near(massPropertiesOf(o, STEEL).volume, s.area * (L - b / 2) + extra, 1e-9, 'y into the rounds');
  assert.ok(extra > 1, `${extra}`); assert.equal(o.bodyCount, 1); assert.ok(checkOutput(o).valid);
});

/** ∫∫ over the disk of radius r (axis z) of the half-height √(R² − y²) of a cylinder R along x, for z ≥ 0: y = r·sin t. */
function overlap(r, R) {
  const n = 2000; let I = 0;
  for (let i = 0; i < n; i++) { const t = -Math.PI / 2 + (i + 0.5) * Math.PI / n, y = r * Math.sin(t); I += 2 * r * Math.cos(t) * Math.sqrt(R * R - y * y) * r * Math.cos(t); }
  return I * Math.PI / n;
}

test('FR S0: a fish-mouth cope — a round tube onto a larger one, square and at 60°; the removed volume by quadrature', tc => {
  const R = 25, r = 12.5, t = 2, L = 150;
  const tube = (rr, tt) => ({ outer: [{ kind: 'arc', start: [rr, 0], center: [0, 0], direction: 'ccw' }], holes: [[{ kind: 'arc', start: [rr - tt, 0], center: [0, 0], direction: 'ccw' }]], area: Math.PI * (rr * rr - (rr - tt) * (rr - tt)), envelope: [{ kind: 'arc', start: [rr, 0], center: [0, 0], direction: 'ccw' }] });
  const big = tube(R, t), small = tube(r, t);
  const feats = [...member('a', big, [-100, 0, 0], [100, 0, 0], [0, 1, 0]), ...member('ae', big, [-100, 0, 0], [100, 0, 0], [0, 1, 0], [0, 0], { envelope: true }),
    ...member('b', small, [0, 0, 0], [0, 0, L], [1, 0, 0]), { id: 'bc', kind: 'difference', target: 'b', tool: 'ae' }];
  const t0 = performance.now(), snap = run(feats), c = outputOf(snap, 'bc'), mass = massPropertiesOf(c, STEEL), ms = performance.now() - t0;
  // Square: the small tube's ring inside the big cylinder, removed: overlap(r) − overlap(r − t).
  const removed = overlap(r, R) - overlap(r - t, R);
  tc.diagnostic(`square cope ${Math.round(ms)} ms, removed ${removed} mm³, relative error ${mass.volume / (small.area * L - removed) - 1}`);
  near(mass.volume, small.area * L - removed, 1e-9, 'square cope');
  assert.ok(checkOutput(c).valid); assert.equal(c.bodyCount, 1);
  // Welded on: the pair weighs its sum.
  const w = outputOf(run([...feats, { id: 'w', kind: 'union', target: 'a', tool: 'bc' }]), 'w');
  near(massPropertiesOf(w, STEEL).volume, big.area * 200 + small.area * L - removed, 1e-9, 'welded');
  // At 60° to the big tube: the cope still closes (no closed form; the pair weighs its sum).
  const d = [Math.cos(Math.PI / 3), 0, Math.sin(Math.PI / 3)];
  const f60 = [...member('a', big, [-100, 0, 0], [100, 0, 0], [0, 1, 0]), ...member('ae', big, [-100, 0, 0], [100, 0, 0], [0, 1, 0], [0, 0], { envelope: true }),
    ...member('b', small, [0, 0, 0], scl(d, L), [0, 1, 0]), { id: 'bc', kind: 'difference', target: 'b', tool: 'ae' }, { id: 'w', kind: 'union', target: 'a', tool: 'bc' }];
  const c60 = outputOf(run(f60), 'w'), coped = outputOf(run(f60.slice(0, -1)), 'bc');
  assert.ok(checkOutput(c60).valid); assert.equal(coped.bodyCount, 1);
  near(massPropertiesOf(c60, STEEL).volume, big.area * 200 + massPropertiesOf(coped, STEEL).volume, 1e-9, '60° welded');
  assert.ok(ms < 5000, `${ms} ms`);
});

test('FR S0: a rectangular frame of four mitred tubes — the cut list by closed forms (axis lengths, long points, 45° ends, mass), grouped by identity; its time', () => {
  const s = rhs(40, 40, 3, 6), W = 600, H = 400, b = 40, corners = [[0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0]], feats = [], ids = [];
  for (let k = 0; k < 4; k++) {
    const p0 = corners[k], p1 = corners[(k + 1) % 4], pm = corners[(k + 3) % 4], p2 = corners[(k + 2) % 4];
    const u = unit(sub(p1, p0)), m0 = mitre(p0, unit(sub(p0, pm)), u), m1 = mitre(p1, u, unit(sub(p2, p1)));
    feats.push(...member(`m${k}`, s, p0, p1, [0, 0, 1], [b, b]), { id: `m${k}a`, kind: 'split', target: `m${k}`, normal: m0.normal, at: m0.at }, { id: `m${k}b`, kind: 'split', target: `m${k}a/1`, normal: m1.normal, at: m1.at });
    ids.push(`m${k}b/0`);
  }
  const t0 = performance.now(), snap = run(feats), ms = performance.now() - t0;
  const rows = ids.map((id, k) => {
    const o = outputOf(snap, id), p0 = corners[k], u = unit(sub(corners[(k + 1) % 4], p0)), along = vertices(o.brep).map(v => dot(sub(v, p0), u));
    return { length: Math.hypot(...sub(corners[(k + 1) % 4], p0)), longPoint: Math.max(...along) - Math.min(...along), massKG: massPropertiesOf(o, STEEL).mass };
  });
  for (const [k, row] of rows.entries()) {
    const L = k % 2 ? H : W;
    // (The kernel's quadrature mass on the round corners cut at 45°, about 3e-9: the cut list's ρ·A·L is the closed form.)
    near(row.longPoint, L + b, 1e-12, `long point ${k}`); near(row.massKG, STEEL * s.area * L * 1e-3, 1e-8, `mass ${k}`);
  }
  // Grouped by (section, length, end angles): two of W and two of H; the frame's mass the sum.
  const groups = new Map(); for (const r of rows) { const key = r.length.toFixed(6); groups.set(key, (groups.get(key) ?? 0) + 1); }
  assert.deepEqual([...groups.values()], [2, 2]);
  near(rows.reduce((a, r) => a + r.massKG, 0), STEEL * s.area * 2 * (W + H) * 1e-3, 1e-8, 'frame mass');
  assert.ok(ms < 5000, `${ms} ms`);
});
