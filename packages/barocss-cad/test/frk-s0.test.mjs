import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateCadPart, booleanAnalytic, brepMassProperties, subdBrep, tessellateBrep } from '../dist/index.js';

// FRk S0 (D164): the feasibility checkpoint before the kernel half of FR completion (roadmap item 5): gussets, end caps and
// weld beads; tapered-flange and I/H sections; members along arcs; weld end gaps and saddle notches other than a full
// cope; the round-cornered ordered trim's time (D126); the SubD display folds (D79); D158's housing shoulder against Da
// max; the trimmed-face mass quadrature (D151, D152). Every oracle is written here, none of them the kernel's: closed
// forms (a frustum's offset areas, Pappus, Green's theorem on lines and arcs, a prism cut by planes) and Gauss–Legendre
// quadratures of one or two variables. No product code changed. Every size is a test value (no standard or supplier row).
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const run = features => evaluateCadPart(D(features));
const volume = o => o.massProperties(1).volumeMM3;
const near = (got, want, rel, what) => assert.ok(Math.abs(got - want) <= rel * Math.abs(want), `${what}: ${got} vs ${want} (rel ${Math.abs(got - want) / Math.abs(want)})`);
function welded(breps) { let b = breps[0]; for (const o of breps.slice(1)) b = booleanAnalytic(b, o, 'union'); return b; }
const GL5 = [[-0.906179845938664, 0.2369268850561891], [-0.5384693101056831, 0.4786286704993665], [0, 0.5688888888888889], [0.5384693101056831, 0.4786286704993665], [0.906179845938664, 0.2369268850561891]];
function gauss(f, a, b, n = 400) { let I = 0; const h = (b - a) / n; for (let i = 0; i < n; i++) for (const [x, w] of GL5) I += w * h / 2 * f(a + h * (i + 0.5) + h / 2 * x); return I; }
const SHARP = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, A_SHARP = 1600 - 34 * 34;
const ROUND = { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 6 }, A_ROUND = 1600 - (4 - Math.PI) * 36 - (34 * 34 - (4 - Math.PI) * 9);
const RT = { kind: 'round-tube', diameter: 30, wall: 2 }, A_RT = Math.PI * (15 ** 2 - 13 ** 2);
const XY = { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] };

/** A rectangle 2hx × 2hy centred at (cx, cy), corners rounded r (0: sharp), anticlockwise. */
function rr(hx, hy, r, cx = 0, cy = 0) {
  const P = ([x, y]) => [cx + x, cy + y];
  if (r === 0) return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(p => ({ kind: 'line', start: P(p) }));
  return [
    { kind: 'line', start: P([-hx + r, -hy]) }, { kind: 'arc', start: P([hx - r, -hy]), center: P([hx - r, -hy + r]), direction: 'ccw' },
    { kind: 'line', start: P([hx, -hy + r]) }, { kind: 'arc', start: P([hx, hy - r]), center: P([hx - r, hy - r]), direction: 'ccw' },
    { kind: 'line', start: P([hx - r, hy]) }, { kind: 'arc', start: P([-hx + r, hy]), center: P([-hx + r, hy - r]), direction: 'ccw' },
    { kind: 'line', start: P([-hx, hy - r]) }, { kind: 'arc', start: P([-hx, -hy + r]), center: P([-hx + r, -hy + r]), direction: 'ccw' }];
}
const circle = (r, cx = 0, cy = 0) => [{ kind: 'arc', start: [cx + r, cy], center: [cx, cy], direction: 'ccw' }];
/** The area inside a loop of lines and arcs (each from its start to the next one's), by Green's theorem in closed form. */
function greenArea(loop) {
  let A = 0;
  for (let i = 0; i < loop.length; i++) {
    const g = loop[i], e = loop[(i + 1) % loop.length].start;
    if (g.kind === 'line') { A += (g.start[0] * e[1] - e[0] * g.start[1]) / 2; continue; }
    const c = g.center, r = Math.hypot(g.start[0] - c[0], g.start[1] - c[1]), a0 = Math.atan2(g.start[1] - c[1], g.start[0] - c[0]);
    let d = Math.atan2(e[1] - c[1], e[0] - c[0]) - a0;
    if (g.direction === 'ccw') { while (d <= 0) d += 2 * Math.PI; } else { while (d >= 0) d -= 2 * Math.PI; }
    A += 0.5 * (r * r * d + c[0] * r * (Math.sin(a0 + d) - Math.sin(a0)) - c[1] * r * (Math.cos(a0 + d) - Math.cos(a0)));
  }
  return A;
}

test('FRk S0 weld beads: a fillet bead on a square end is a 45° drafted extrusion of the end\'s outline offset by the leg z, less the member\'s envelope — exact for sharp, round-cornered and round tubes (P·z²/2 + c·z³); welded with the member and its plate, one body of their sum', () => {
  const z = 3;
  // c: a sharp outline's four mitred corners (each ∫∫(z − max(dx, dy)) = z³/3), or a smooth outline's arcs (2π in all: πz³/3).
  for (const [name, sec, outline, offset, P, c] of [
    ['sharp 40×40×3', SHARP, rr(20, 20, 0), rr(20 + z, 20 + z, 0), 160, 4 / 3],
    ['round-cornered ro 6', ROUND, rr(20, 20, 6), rr(20 + z, 20 + z, 6 + z), 160 - 48 + 12 * Math.PI, Math.PI / 3],
    ['round Ø30 × 2', RT, circle(15), circle(15 + z), 30 * Math.PI, Math.PI / 3]]) {
    const s = run([
      { id: 'm', kind: 'frame-member', section: sec, start: [0, 0, 0], end: [0, 0, 300] },
      { id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-60, -60], max: [60, 60], plane: { origin: [0, 0, -10], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 10 },
      { id: 'bs', kind: 'sketch', profile: 'loop', segments: offset, plane: XY }, { id: 'b0', kind: 'extrude', sketch: 'bs', height: z, draft: 45 },
      { id: 'es', kind: 'sketch', profile: 'loop', segments: outline, plane: XY }, { id: 'e', kind: 'extrude', sketch: 'es', height: 50 },
      { id: 'bead', kind: 'difference', target: 'b0', tool: 'e' }]);
    const bead = s.output('bead'), want = P * z * z / 2 + c * z ** 3;
    near(volume(bead), want, 1e-11, `${name}: the bead`);
    assert.equal(bead.bodyCount, 1); assert.ok(bead.validate().valid, name);
    const w = welded([s.output('m').brep, s.output('p').brep, bead.brep]);
    assert.equal(w.bodies.length, 1, name);
    near(brepMassProperties(w, 1).volumeMM3, volume(s.output('m')) + volume(s.output('p')) + want, 1e-10, `${name}: welded, their sum`);
  }
});

test('FRk S0 gussets and end caps: a clipped triangular gusset in the corner of a mitred L (its area (l² − c²)/2), a cap over a square end (the envelope\'s area) and a plug in its bore (the bore\'s), each exact; welded to the members, their sum', () => {
  const l = 120, c = 15, t = 5;
  for (const [name, sec, A, env, bore] of [['sharp', SHARP, A_SHARP, 1600, 34 * 34], ['round-cornered', ROUND, A_ROUND, 1600 - (4 - Math.PI) * 36, 34 * 34 - (4 - Math.PI) * 9]]) {
    // Members from (600, 0, 0) to the corner and up to (0, 0, 600); their inner faces at z 20 and x 20. The gusset in the
    // members' plane, centred on it: a sketch on y = t/2 facing −y (its y axis +Z), extruded t.
    const ro = sec.outerRadius, poly = [[20 + c, 20], [20 + l, 20], [20, 20 + l], [20, 20 + c]];
    const s = run([
      { id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section: sec, corners: { default: 'mitre' } },
      { id: 'gs', kind: 'sketch', profile: 'loop', segments: poly.map(start => ({ kind: 'line', start })), plane: { origin: [0, t / 2, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } }, { id: 'g', kind: 'extrude', sketch: 'gs', height: t },
      { id: 'cs', kind: 'sketch', profile: 'loop', segments: rr(20, 20, ro), plane: { origin: [600, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'cap', kind: 'extrude', sketch: 'cs', height: 4 },
      { id: 'qs', kind: 'sketch', profile: 'loop', segments: rr(17, 17, Math.max(0, ro - 3)), plane: { origin: [596, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } }, { id: 'plug', kind: 'extrude', sketch: 'qs', height: 4 }]);
    const [m0, m1] = s.outputs.filter(o => o.member), g = s.output('g');
    near(volume(g), (l * l - c * c) / 2 * t, 1e-12, `${name}: the gusset`);
    const zs = g.brep.vertices.map(v => v.point[2]);
    assert.deepEqual([Math.min(...zs), Math.max(...zs)], [20, 20 + l], `${name}: on the inner faces`);
    near(volume(m0), A * (600 + 0), 1e-8, `${name}: the mitred member`);
    const all = welded([m0.brep, m1.brep, g.brep]);
    assert.equal(all.bodies.length, 1);
    near(brepMassProperties(all, 1).volumeMM3, volume(m0) + volume(m1) + volume(g), 1e-9, `${name}: gusset welded, their sum`);
    near(volume(s.output('cap')), env * 4, 1e-12, `${name}: the cap over`); near(volume(s.output('plug')), bore * 4, 1e-12, `${name}: the plug`);
    for (const k of ['cap', 'plug']) {
      const w = welded([m0.brep, s.output(k).brep]);
      assert.equal(w.bodies.length, 1, `${name} ${k}`);
      near(brepMassProperties(w, 1).volumeMM3, volume(m0) + volume(s.output(k)), 1e-10, `${name}: the ${k} welded, their sum`);
    }
  }
});

test('FRk S0 tapered-flange sections: an I section with sloped flange faces, root and toe radii between lines at any angle — its area in closed form (the polygon, each fillet\'s r²(cot(α/2) − (π − α)/2)) equals Green\'s on its loop and the kernel\'s A·L, to 1e-14', () => {
  const nrm = a => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l]; };
  /** A polygon with radius r_i at vertex i: lines and tangent arcs; each fillet's interior angle α. */
  function filleted(poly, radii) {
    const out = [], fillets = [];
    poly.forEach((V, i) => {
      const r = radii[i];
      if (!r) { out.push({ kind: 'line', start: V }); return; }
      const P = poly[(i - 1 + poly.length) % poly.length], N = poly[(i + 1) % poly.length], a = nrm([P[0] - V[0], P[1] - V[1]]), b = nrm([N[0] - V[0], N[1] - V[1]]);
      const alpha = Math.acos(a[0] * b[0] + a[1] * b[1]), d = r / Math.tan(alpha / 2), bis = nrm([a[0] + b[0], a[1] + b[1]]), k = r / Math.sin(alpha / 2);
      const turn = (V[0] - P[0]) * (N[1] - V[1]) - (V[1] - P[1]) * (N[0] - V[0]);
      out.push({ kind: 'arc', start: [V[0] + a[0] * d, V[1] + a[1] * d], center: [V[0] + bis[0] * k, V[1] + bis[1] * k], direction: turn > 0 ? 'ccw' : 'cw' }, { kind: 'line', start: [V[0] + b[0] * d, V[1] + b[1] * d] });
      fillets.push({ r, alpha, concave: turn < 0 });
    });
    return { loop: out, fillets };
  }
  for (const [h, b, tw, tf, k, r1, r2] of [[200, 90, 7, 11, 0.14, 9, 4.5], [160, 74, 6.3, 9.5, 0.08, 6, 3], [120, 64, 4.4, 6.3, 0, 7, 0]]) {
    // The flanges' inner faces through y = ±(h/2 − tf) at the overhang's middle, sloped k (thicker at the web).
    const xm = tw / 2 + (b - tw) / 4, yIn = x => h / 2 - tf - k * (xm - x);
    const poly = [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, -yIn(b / 2)], [tw / 2, -yIn(tw / 2)], [tw / 2, yIn(tw / 2)], [b / 2, yIn(b / 2)], [b / 2, h / 2], [-b / 2, h / 2], [-b / 2, yIn(b / 2)], [-tw / 2, yIn(tw / 2)], [-tw / 2, -yIn(tw / 2)], [-b / 2, -yIn(b / 2)]];
    const { loop, fillets } = filleted(poly, poly.map((_, i) => [3, 4, 9, 10].includes(i) ? r1 : [2, 5, 8, 11].includes(i) ? r2 : 0));
    // The polygon by the shoelace, each fillet adding (a root) or taking (a toe) its spandrel.
    let A = greenArea(poly.map(start => ({ kind: 'line', start })));
    for (const f of fillets) A += (f.concave ? 1 : -1) * f.r * f.r * (1 / Math.tan(f.alpha / 2) - (Math.PI - f.alpha) / 2);
    near(greenArea(loop), A, 1e-14, `I ${h} × ${b}, slope ${k}: Green against the closed form`);
    const o = run([{ id: 'ss', kind: 'sketch', profile: 'loop', segments: loop, plane: XY }, { id: 'm', kind: 'extrude', sketch: 'ss', height: 1000 }]).output('m');
    near(volume(o) / 1000, A, 1e-14, `I ${h} × ${b}, slope ${k}: the kernel's A·L`);
    assert.ok(o.validate().valid);
  }
});

test('FRk S0 members along arcs: a round and a round-cornered tube revolved about an axis (outer less bore, revolve takes one loop) hold A·r̄·θ by Pappus to 1e-11; a tube bent between two straights by today\'s sweep (outer less bore) A·(L₁ + Rθ + L₂) to 1e-7', t => {
  for (const [name, outer, bore, A, R, deg] of [
    ['round Ø30 × 2, R 150, 90°', circle(15, 150), circle(13, 150), A_RT, 150, 90],
    ['rect 20 × 40 × 2, ro 4, R 200, 60°', rr(10, 20, 4, 200), rr(8, 18, 2, 200), 800 - (4 - Math.PI) * 16 - (16 * 36 - (4 - Math.PI) * 4), 200, 60]]) {
    const t0 = performance.now();
    const s = run([{ id: 'os', kind: 'sketch', profile: 'loop', segments: outer, plane: XY }, { id: 'o', kind: 'revolve', sketch: 'os', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: deg },
      { id: 'is', kind: 'sketch', profile: 'loop', segments: bore, plane: XY }, { id: 'i', kind: 'revolve', sketch: 'is', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: deg },
      { id: 'm', kind: 'difference', target: 'o', tool: 'i' }]);
    const o = s.output('m');
    near(volume(o), A * R * deg * Math.PI / 180, 1e-11, name);
    assert.equal(o.bodyCount, 1); assert.ok(o.validate().valid);
    t.diagnostic(`${name}: ${Math.round(performance.now() - t0)} ms, mass ${o.massProperties(1).method}`);
  }
  // S0 pinned revolve's one-loop refusal here; FRk4 (D173) gave revolve its holes, so the same tube revolved from one
  // sketch with its bore as a hole holds the same Pappus value (D176).
  const holed = run([{ id: 'os', kind: 'sketch', profile: 'loop', segments: circle(15, 150), holes: [circle(13, 150)], plane: XY }, { id: 'o', kind: 'revolve', sketch: 'os', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 90 }]).output('o');
  near(volume(holed), A_RT * 150 * Math.PI / 2, 1e-11, 'round Ø30 × 2 revolved with its bore as a hole');
  assert.equal(holed.bodyCount, 1); assert.ok(holed.validate().valid);
  const path = [{ kind: 'straight', length: 200 }, { kind: 'bend', radius: 100, angleDegrees: 90, toward: 'x' }, { kind: 'straight', length: 150 }];
  const t0 = performance.now();
  const b = run([{ id: 'os', kind: 'sketch', profile: 'loop', segments: circle(15), plane: XY }, { id: 'o', kind: 'sweep', sketch: 'os', path },
    { id: 'is', kind: 'sketch', profile: 'loop', segments: circle(13), plane: XY }, { id: 'i', kind: 'sweep', sketch: 'is', path }, { id: 'm', kind: 'difference', target: 'o', tool: 'i' }]).output('m');
  near(volume(b), A_RT * (350 + 100 * Math.PI / 2), 1e-7, 'bent between two straights');
  assert.ok(b.validate().valid);
  t.diagnostic(`bent tube by sweeps: ${Math.round(performance.now() - t0)} ms, rel ${Math.abs(volume(b) / (A_RT * (350 + 50 * Math.PI)) - 1)}`);
});

test('FRk S0 weld end gaps by today\'s trims: a mitred L opened by a root gap g (each member cut on the mitre plane moved g/2: A(L − (g/2)/cos θ)), a T butt held off its post by g (A(L − b/2 − g)), to 1e-12', () => {
  const g = 2, n = [-Math.SQRT1_2, 0, Math.SQRT1_2];
  const s = run([{ id: 'f', kind: 'frame', points: [[600, 0, 0], [0, 0, 0], [0, 0, 600]], segments: [[0, 1], [1, 2]], section: SHARP, corners: { at: [{ point: 1, kind: 'none' }] },
    trims: [{ member: 0, end: 'end', plane: { origin: [-n[0] * g / 2, 0, -n[2] * g / 2], normal: n } }, { member: 1, end: 'start', plane: { origin: [n[0] * g / 2, 0, n[2] * g / 2], normal: n } }] }]);
  for (const o of s.outputs) near(volume(o), A_SHARP * (600 - (g / 2) / Math.SQRT1_2), 1e-12, 'a mitre opened by g');
  // A rail on a post's face at x = 20, its end held g off: trimmed to the face's plane moved g.
  const r = run([{ id: 'f', kind: 'frame', points: [[0, 0, 0], [0, 0, 800], [500, 0, 400], [0, 0, 400]], segments: [[0, 1], [2, 3]], section: SHARP, trims: [{ member: 1, end: 'end', plane: { origin: [20 + g, 0, 0], normal: [1, 0, 0] } }] }]);
  near(volume(r.outputs[1]), A_SHARP * (500 - 20 - g), 1e-12, 'a butt held off by g');
});

test('FRk S0 saddle notches other than a full cope: a hole saw larger than the main tube, its branch off the main\'s axis (a 1D quadrature of the cutter\'s height over the branch\'s annulus), and a saw-cut V notch (h₀A − k·4(r_o³ − r_i³)/3), to 1e-9', () => {
  const disk = (r, e, Rc) => gauss(u => 2 * r * r * Math.cos(u) ** 2 * Math.sqrt(Rc * Rc - (r * Math.sin(u) + e) ** 2), -Math.PI / 2, Math.PI / 2);
  // The branch along z from 0 at y = e; the cutter's axis along x through the origin, radius Rc ≥ 15 + |e|.
  for (const [e, Rc] of [[0, 26], [5, 26], [6, 30]]) {
    const o = run([{ id: 'b', kind: 'frame-member', section: RT, start: [0, e, 0], end: [0, e, 300] },
      { id: 'cs', kind: 'sketch', profile: 'loop', segments: circle(Rc), plane: { origin: [-40, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } },
      { id: 'c', kind: 'extrude', sketch: 'cs', height: 80 }, { id: 'n', kind: 'difference', target: 'b', tool: 'c' }]).output('n');
    near(volume(o), A_RT * 300 - (disk(15, e, Rc) - disk(13, e, Rc)), 1e-9, `hole saw R ${Rc}, offset ${e}`);
    assert.equal(o.bodyCount, 1); assert.ok(o.validate().valid);
  }
  // A V: kept z ≥ h₀ − k|y| (two saw cuts meeting on the branch's middle); h₀ − 15k ≥ 0, so the cut takes ∫∫(h₀ − k|y|) dA.
  const h0 = 20, k = 0.8, Y = 60;
  const v = run([{ id: 'b', kind: 'frame-member', section: RT, start: [0, 0, 0], end: [0, 0, 300] },
    { id: 'ws', kind: 'sketch', profile: 'loop', segments: [[0, h0], [-Y, h0 - k * Y], [Y, h0 - k * Y]].map(start => ({ kind: 'line', start })), plane: { origin: [-40, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] } },
    { id: 'w', kind: 'extrude', sketch: 'ws', height: 80 }, { id: 'n', kind: 'difference', target: 'b', tool: 'w' }]).output('n');
  near(volume(v), A_RT * 300 - (h0 * A_RT - k * 4 / 3 * (15 ** 3 - 13 ** 3)), 1e-11, 'a V notch');
});

test('FRk S0 the round-cornered ordered trim\'s time (D126): one corner of three round-cornered tubes ordered against left square, and a sharp-tube table ordered — where the 7.5 s goes', t => {
  const c3 = { points: [[0, 0, 0], [0, 0, 700], [600, 0, 700], [0, 400, 700]], segments: [[0, 1], [1, 2], [3, 1]] };
  const time = f => { const t0 = performance.now(); const r = f(); r.outputs.forEach(o => o.brep); return [performance.now() - t0, r]; };
  const [none] = time(() => run([{ id: 't', kind: 'frame', ...c3, section: ROUND, corners: { multi: 'none' } }]));
  const [order, s] = time(() => run([{ id: 't', kind: 'frame', ...c3, section: ROUND, corners: { multi: 'order' } }]));
  const points = [[0, 0, 0], [600, 0, 0], [600, 400, 0], [0, 400, 0], [0, 0, 700], [600, 0, 700], [600, 400, 700], [0, 400, 700]];
  const [sharp] = time(() => run([{ id: 't', kind: 'frame', points, segments: [[0, 4], [1, 5], [2, 6], [3, 7], [4, 5], [5, 6], [6, 7], [7, 4]], section: SHARP, corners: { multi: 'order' } }]));
  t.diagnostic(`one round-cornered corner: left square ${Math.round(none)} ms, ordered ${Math.round(order)} ms; a sharp table ordered ${Math.round(sharp)} ms`);
  assert.ok(order > 10 * none, 'the ordered trim is the cost');
  near(volume(s.outputs[0]), A_ROUND * 720, 1e-12, 'the leg through');
});

test('FRk S0 → FRk7 the SubD display folds (D79, D84, D180): on the pipe clamp no fold reaches 25° (S0 found one sliver inside a face at 88.6°)', t => {
  const cage = JSON.parse(readFileSync(new URL('../conformance/r8/subd-pipe-clamp.json', import.meta.url), 'utf8')).input.partDocument.features[0].cage;
  const mesh = tessellateBrep(subdBrep(cage, { id: 'clamp' }), { segmentsPerQuarter: 8 });
  const P = mesh.positionsMM, I = mesh.indices, key = v => `${P[3 * v]},${P[3 * v + 1]},${P[3 * v + 2]}`, pt = v => [P[3 * v], P[3 * v + 1], P[3 * v + 2]];
  const faceOf = new Int32Array(I.length / 3);
  mesh.faces.forEach((f, k) => { for (let tr = f.indexOffset / 3; tr < (f.indexOffset + f.indexCount) / 3; tr++) faceOf[tr] = k; });
  const edges = new Map();
  for (let tr = 0; tr < I.length / 3; tr++) for (let k = 0; k < 3; k++) { const a = key(I[3 * tr + k]), c = key(I[3 * tr + (k + 1) % 3]), e = a < c ? `${a}|${c}` : `${c}|${a}`; if (!edges.has(e)) edges.set(e, []); edges.get(e).push(tr); }
  const tri = tr => { const a = pt(I[3 * tr]), b = pt(I[3 * tr + 1]), c = pt(I[3 * tr + 2]), u = b.map((x, i) => x - a[i]), v = c.map((x, i) => x - a[i]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n);
    return { n: n.map(x => x / l), c: [0, 1, 2].map(i => (a[i] + b[i] + c[i]) / 3), aspect: l / Math.max(Math.hypot(...u), Math.hypot(...v), Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2])) ** 2 }; };
  const folds = [];
  for (const ts of edges.values()) {
    if (ts.length !== 2) continue;
    const A = tri(ts[0]), B = tri(ts[1]);
    if ((B.c[0] - A.c[0]) * A.n[0] + (B.c[1] - A.c[1]) * A.n[1] + (B.c[2] - A.c[2]) * A.n[2] <= 0) continue;
    const deg = Math.acos(Math.max(-1, Math.min(1, A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2]))) * 180 / Math.PI;
    if (deg > 15) folds.push({ deg, one: faceOf[ts[0]] === faceOf[ts[1]], sliver: Math.min(A.aspect, B.aspect) < 0.02 });
  }
  const over = th => folds.filter(f => f.deg > th);
  t.diagnostic(`folds over 15°: ${over(15).length} (${over(15).filter(f => f.one).length} inside one face), over 20°: ${over(20).length}, over 30°: ${over(30).length}; the worst ${Math.max(...folds.map(f => f.deg)).toFixed(1)}°`);
  // S0 pinned the defect: over 30° one fold, a sliver inside one face. FRk7 flips such slivers onto the surface (D180).
  assert.equal(over(25).length, 0, 'no fold of 25° or more');
});

test('FRk S0 D158\'s housing shoulder: a stepped housing bore (the seat Ø47 14 deep, then Ø40) — the shoulder, the planar annulus at the seat\'s end, found from the B-rep\'s faces; its bore against a row\'s Da max is arithmetic', () => {
  // The profile in (r, z), turned about the sketch's y axis (+Z).
  const prof = [[23.5, 0], [35, 0], [35, 20], [20, 20], [20, 14], [23.5, 14]].map(start => ({ kind: 'line', start }));
  const h = run([{ id: 'hs', kind: 'sketch', profile: 'loop', segments: prof, plane: { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] } }, { id: 'h', kind: 'revolve', sketch: 'hs', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }]).output('h');
  const at14 = h.brep.vertices.map(v => v.point).filter(p => Math.abs(p[2] - 14) < 1e-9).map(p => Math.hypot(p[0], p[1]));
  assert.deepEqual([...new Set(at14.map(r => +r.toFixed(9)))].sort((a, b) => a - b), [20, 23.5], 'the shoulder spans the bore Ø40 to the seat Ø47');
  const DaMax = 42;
  assert.ok(2 * Math.min(...at14) <= DaMax, 'Ø40 within Da max 42');
});

test('FRk S0 the trimmed-face quadrature: a sphere cut by a cylinder off its axis (trimmed sphere and cylinder patches) against a two-variable Gauss–Legendre oracle, to 1e-9; the whole 16/20 bevel pair\'s intersection (FR_SURVEY=1) against its mesh refined', t => {
  for (const [R, a, c] of [[20, 6, 9], [20, 5, 14]]) {
    // V = ∫∫ over the disk (radius a, centre at c) of 2√(R² − x² − y²), x = c + a sin u (no root at the disk's edge).
    const V = gauss(u => { const x = c + a * Math.sin(u), hw = a * Math.cos(u); return a * Math.cos(u) * gauss(y => 2 * Math.sqrt(R * R - x * x - y * y), -hw, hw, 20); }, -Math.PI / 2, Math.PI / 2, 100);
    const o = run([{ id: 'hs', kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [0, -R], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, R] }], plane: XY },
      { id: 'sph', kind: 'revolve', sketch: 'hs', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 },
      { id: 'cs', kind: 'sketch', profile: 'loop', segments: circle(a, c), plane: { origin: [0, -30, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] } },
      { id: 'cyl', kind: 'extrude', sketch: 'cs', height: 60 }, { id: 'x', kind: 'intersect', target: 'sph', tool: 'cyl' }]).output('x');
    near(volume(o), V, 1e-9, `sphere R ${R} ∩ cylinder r ${a} at ${c}`);
  }
  if (!process.env.FR_SURVEY) return;
  const gears = [{ id: 'p', kind: 'bevel-gear', module: 2, teeth: 16, mateTeeth: 20, faceWidth: 6, thicknessReduction: 0.05, rotation: 0, center: [5, -3], from: 2 }, { id: 'w', kind: 'bevel-gear', module: 2, teeth: 20, mateTeeth: 16, faceWidth: 6, thicknessReduction: 0.05, mesh: { gear: 'p', direction: 0, phase: 4 } }];
  const b = run([...gears, { id: 'i', kind: 'intersect', target: 'p', tool: 'w' }]).output('i').brep;
  const meshVolume = mesh => { const Q = mesh.positionsMM, J = mesh.indices; let V = 0; for (let k = 0; k < J.length; k += 3) { const p = 3 * J[k], q = 3 * J[k + 1], r = 3 * J[k + 2]; V += Q[p] * (Q[q + 1] * Q[r + 2] - Q[q + 2] * Q[r + 1]) - Q[p + 1] * (Q[q] * Q[r + 2] - Q[q + 2] * Q[r]) + Q[p + 2] * (Q[q] * Q[r + 1] - Q[q + 1] * Q[r]); } return V / 6; };
  const kernel = brepMassProperties(b, 1).volumeMM3, meshes = [16, 32, 64].map(q => meshVolume(tessellateBrep(b, { segmentsPerQuarter: q })));
  t.diagnostic(`bevel pair at 4°: kernel ${kernel}, meshes at 16/32/64 ${meshes.join(', ')}`);
  assert.ok(kernel > meshes[2] * 1.01, 'the kernel stands 1 % or more above its mesh refined');
});
