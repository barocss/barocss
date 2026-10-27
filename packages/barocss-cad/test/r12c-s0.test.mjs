import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, buildBrep, checkBrep, brepMassProperties, booleanAnalytic, exportStep, importStep, outputOf, massPropertiesOf, checkOutput } from '../dist/index.js';
import { extrudedProfile } from '../dist/machine/gear.js';

// R12c S0 (D139): the feasibility checkpoint before machine and power-transmission elements (README §4 "R12c"). No
// research note; probed here against closed forms and quadratures written in the test, none of them the kernel's:
// - springs: a coil's wire as the exact pipe of a helix, built here as the helical motion (its rotation a cubic Hermite
//   fit, as the gears' twist) of the exact rational circle in the helix's normal plane; its volume πa²·L, its distance
//   from the centreline, a plane square to the axis cutting away πa²·L·z/h (a closed form shown below), the coils'
//   clearance against the wire;
// - fits: ISO 286 grades and limits as values from public HTML (recorded per value below), the clearances by
//   arithmetic against the pages' own results, and the kernel's Boolean at the limit sizes against πΔr²-type closed forms;
// - a shaft: steps and a retaining-ring groove by revolve (Pappus), a keyseat by a Boolean (the disc segment in closed
//   form; an end-milled one's ends by a 1D quadrature);
// - a bearing envelope on its seat, an O-ring on its gland (the torus, the squeeze's overlap by Pappus on a circular
//   segment), a connector opening (a stadium), a disc cam (a roller follower's offset profile by Green's theorem).
// No product code changed. Values from public pages are test oracles only (sources at the end of D139), never a table.

const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const run = features => evaluateCadPart(D(features));
/** Feature `id`'s body: the document evaluated up to it (a feature a later one consumes is no output of the whole). */
const at = (features, id) => outputOf(run(features.slice(0, features.findIndex(f => f.id === id) + 1)), id);
const near = (got, want, rel, what) => assert.ok(Math.abs(got - want) <= rel * Math.abs(want), `${what}: ${got} vs ${want} (rel ${Math.abs(got - want) / Math.abs(want)})`);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vol = brep => brepMassProperties(brep, 1, { quadratureSegments: 12 }).volume;

// ---- springs ------------------------------------------------------------------------------------------------------------
// The helix C(φ) = (R cos φ, R sin φ, hφ), h = p/2π: its Frenet frame is carried by the screw motion M(φ) (turn φ about Z,
// rise hφ), so the pipe of radius a is exactly M(φ) applied to the circle in the normal plane at φ = 0. Built as the gears'
// twisted faces are (gear.ts `rotationPoles`): per axial piece the rotation e^{iφ} by its cubic Hermite (exact at the piece
// ends, its tangent iφ'e^{iφ} a third of the step); z = hφ exactly (the Bézier chain's control heights evenly spaced). The
// motion is affine in the section point, so the faces are the circle's rational quadratic quarters times the cubic fit.

/** The cubic Hermite poles of e^{iθ} over [a, b] in `pieces` pieces (3N + 1 (cos, sin) pairs). */
function rotationPoles(a, b, pieces) {
  const out = [];
  for (let k = 0; k < pieces; k++) {
    const ta = a + (b - a) * k / pieces, tb = a + (b - a) * (k + 1) / pieces, h = (tb - ta) / 3, ca = Math.cos(ta), sa = Math.sin(ta), cb = Math.cos(tb), sb = Math.sin(tb);
    if (k === 0) out.push([ca, sa]);
    out.push([ca - h * sa, sa + h * ca], [cb + h * sb, sb - h * cb], [cb, sb]);
  }
  return out;
}
const bezierKnots = N => { const k = [0, 0, 0, 0]; for (let i = 1; i < N; i++) k.push(i, i, i); k.push(N, N, N, N); return k; };
const screw = (p, c, s, dz) => [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2] + dz];
/** The largest distance, per unit radius, of one Hermite piece over `step` radians from the rotation (sampled finely). */
function hermiteDeviation(step) {
  const P = rotationPoles(0, step, 1); let worst = 0;
  for (let i = 0; i <= 256; i++) {
    const t = i / 256, u = 1 - t, b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    const c = b.reduce((s, w, k) => s + w * P[k][0], 0), s = b.reduce((q, w, k) => q + w * P[k][1], 0);
    worst = Math.max(worst, Math.hypot(c - Math.cos(step * t), s - Math.sin(step * t)));
  }
  return worst;
}

/**
 * A coil spring's wire of radius a on a helix of radius R and pitch p, `turns` turns from φ 0, as a B-rep: `segments`
 * axial faces per quarter of the circle, each `pieces` Hermite pieces; the ends capped by the normal planes' discs.
 */
function coil({ R, p, a, turns, segments, pieces }) {
  const h = p / (2 * Math.PI), L = Math.hypot(R, h), Phi = 2 * Math.PI * turns;
  const T0 = [0, R / L, h / L], N0 = [-1, 0, 0], B0 = cross(T0, N0), c0 = [R, 0, 0];
  // The circle in the normal plane, from N0 toward B0 (outward normal × T: the side faces' normals point out).
  const q = t => add(c0, add(scl(N0, a * Math.cos(t)), scl(B0, a * Math.sin(t))));
  const w = Math.SQRT1_2, quarters = [0, 1, 2, 3].map(i => { const t0 = i * Math.PI / 2, tm = t0 + Math.PI / 4; return { cp: [q(t0), add(c0, scl(sub(q(tm), c0), 1 / w)), q(t0 + Math.PI / 2)], w: [1, w, 1] }; });
  const vertices = [], edges = [], faces = [], level = j => Phi * j / segments;
  for (let j = 0; j <= segments; j++) {
    const f = level(j), c = Math.cos(f), s = Math.sin(f);
    for (let i = 0; i < 4; i++) vertices.push({ id: `v${i}_${j}`, point: screw(quarters[i].cp[0], c, s, h * f) });
    for (let i = 0; i < 4; i++) edges.push({ id: `a${i}_${j}`, curve: { kind: 'curve', id: `a${i}_${j}c`, degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: quarters[i].cp.map(x => screw(x, c, s, h * f)), weights: [...quarters[i].w] }, vertices: [`v${i}_${j}`, `v${(i + 1) % 4}_${j}`] });
  }
  for (let j = 0; j < segments; j++) {
    const fa = level(j), fb = level(j + 1), rot = rotationPoles(fa, fb, pieces), zs = rot.map((_, k) => h * (fa + (fb - fa) * k / (rot.length - 1)));
    for (let i = 0; i < 4; i++) edges.push({ id: `s${i}_${j}`, curve: { kind: 'curve', id: `s${i}_${j}c`, degree: 3, knots: bezierKnots(pieces), controlPoints: rot.map(([c, s], k) => screw(quarters[i].cp[0], c, s, zs[k])), weights: rot.map(() => 1) }, vertices: [`v${i}_${j}`, `v${i}_${j + 1}`] });
    for (let i = 0; i < 4; i++) faces.push({ id: `f${i}_${j}`, name: `wire#${i}.${j}`, sense: 'forward',
      surface: { kind: 'surface', id: `f${i}_${j}s`, degreeU: 2, degreeV: 3, knotsU: [0, 0, 0, 1, 1, 1], knotsV: bezierKnots(pieces), controlPoints: quarters[i].cp.map(x => rot.map(([c, s], k) => screw(x, c, s, zs[k]))), weights: quarters[i].w.map(wi => rot.map(() => wi)) },
      loops: [{ kind: 'outer', uses: [{ edge: `a${i}_${j}`, sense: 'forward' }, { edge: `s${(i + 1) % 4}_${j}`, sense: 'forward' }, { edge: `a${i}_${j + 1}`, sense: 'reversed' }, { edge: `s${i}_${j}`, sense: 'reversed' }] }] });
  }
  // The end discs: the start's normal −T0 (its patch spanned B0 then N0), the end's the start's patch carried by M(Φ).
  const patch = (e1, e2, f) => { const c = Math.cos(f), s = Math.sin(f), P = (x, y) => screw(add(c0, add(scl(e1, x), scl(e2, y))), c, s, h * f), r = 2 * a; return [[P(-r, -r), P(-r, r)], [P(r, -r), P(r, r)]]; };
  faces.push({ id: 'end0', name: 'wire.end0', sense: 'forward', surface: { kind: 'surface', id: 'end0s', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: patch(B0, N0, 0), weights: [[1, 1], [1, 1]] },
    loops: [{ kind: 'outer', uses: [3, 2, 1, 0].map(i => ({ edge: `a${i}_0`, sense: 'reversed' })) }] });
  faces.push({ id: 'end1', name: 'wire.end1', sense: 'forward', surface: { kind: 'surface', id: 'end1s', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: patch(N0, B0, Phi), weights: [[1, 1], [1, 1]] },
    loops: [{ kind: 'outer', uses: [0, 1, 2, 3].map(i => ({ edge: `a${i}_${segments}`, sense: 'forward' })) }] });
  const brep = buildBrep({ source: { family: 'r12c-s0-coil', id: 'wire' }, vertices, edges, bodies: [{ id: 'wire', kind: 'solid', shells: [{ id: 'sh', faces, closed: true }] }] });
  return { brep, h, L, Phi, wireLength: Phi * L, quarters, T0, N0, B0, c0 };
}
/** A point of the fitted side surface: quarter i at u ∈ [0, 1], axial segment j at its piece parameter v ∈ [0, pieces]. */
function coilPoint(S, spec, i, u, j, v) {
  const { quarters, h, Phi } = S, fa = Phi * j / spec.segments, fb = Phi * (j + 1) / spec.segments, rot = rotationPoles(fa, fb, spec.pieces);
  const k = Math.min(spec.pieces - 1, Math.floor(v)), t = v - k, m = 1 - t, b = [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t];
  const c = b.reduce((s, x, n) => s + x * rot[3 * k + n][0], 0), s = b.reduce((y, x, n) => y + x * rot[3 * k + n][1], 0), z = h * (fa + (fb - fa) * (k + t) / spec.pieces);
  const Q = quarters[i], bu = [(1 - u) ** 2, 2 * u * (1 - u), u * u], W = bu.reduce((s2, x, n) => s2 + x * Q.w[n], 0);
  const P = [0, 1, 2].map(d => bu.reduce((s2, x, n) => s2 + x * Q.w[n] * Q.cp[n][d], 0) / W);
  return screw(P, c, s, z);
}
/** The distance of x from the helix (R, h), by Newton on φ from a start near x's own angle (the nearest turn). */
function helixDistance(x, R, h) {
  let f = Math.atan2(x[1], x[0]); f += 2 * Math.PI * Math.round((x[2] / h - f) / (2 * Math.PI));
  for (let it = 0; it < 30; it++) {
    const d = [R * Math.cos(f) - x[0], R * Math.sin(f) - x[1], h * f - x[2]], d1 = [-R * Math.sin(f), R * Math.cos(f), h], d2 = [-R * Math.cos(f), -R * Math.sin(f), 0];
    const g = dot(d, d1), gp = dot(d1, d1) + dot(d, d2), step = g / gp; f -= step; if (Math.abs(step) < 1e-15) break;
  }
  return Math.hypot(R * Math.cos(f) - x[0], R * Math.sin(f) - x[1], h * f - x[2]);
}

test('R12c S0 springs: the wire as the exact pipe of a helix — the screw motion\'s Hermite fit of the normal-plane circle; V = πa²·L, its distance from the centreline a within the measured fit, valid, genus 0', t => {
  // D 20 (R 10), d 2 (a 1), pitch 5, 6 turns; the pieces per turn the fewest within 1e-4·d of the true pipe (the gears' rule).
  const R = 10, a = 1, p = 5, turns = 6, tol = 1e-4 * 2 * a;
  let perTurn = 4; while (hermiteDeviation(2 * Math.PI / perTurn) * (R + a) > tol) perTurn++;
  // (At most 4 pieces to a face — 13 poles, the 16-pole convention — so the turn is split into perTurn/4 segments.)
  const spec = { R, p, a, turns, segments: turns * Math.ceil(perTurn / 4), pieces: 4 };
  const t0 = performance.now(), S = coil(spec), built = performance.now() - t0;
  const chk = checkBrep(S.brep);
  assert.equal(chk.valid, true, chk.issues[0]); assert.equal(chk.topology[0].genus, 0);
  // The fitted surface's distance from the centreline: a, within the rotation fit's bound (R + a)·dev(step).
  const step = 2 * Math.PI * turns / (spec.segments * spec.pieces), bound = (R + a) * hermiteDeviation(step);
  let worst = 0;
  for (let j = 0; j < spec.segments; j += 7) for (let i = 0; i < 4; i++) for (let iu = 0; iu <= 8; iu++) for (let iv = 0; iv <= 24; iv++) worst = Math.max(worst, Math.abs(helixDistance(coilPoint(S, spec, i, iu / 8, j, spec.pieces * iv / 24), R, S.h) - a));
  assert.ok(worst <= bound + 1e-12, `distance from the centreline ${worst} vs the fit bound ${bound}`);
  assert.ok(worst <= tol, `${worst} within 1e-4·d`);
  // Volume: a tube of a circle square to its path holds πa² per unit length (Pappus–Guldin for tubes, a < the curvature
  // radius R(1 + (h/R)²)); the fit moves the surface by ≤ worst, so |ΔV| ≤ area·worst = 2πa·L·worst.
  const t1 = performance.now(), V = vol(S.brep), massMs = performance.now() - t1, want = Math.PI * a * a * S.wireLength;
  assert.ok(Math.abs(V - want) <= 2 * Math.PI * a * S.wireLength * worst + 1e-9 * want, `V ${V} vs πa²L ${want}`);
  // A STEP round trip keeps it (the faces are B-spline surfaces, written as they are).
  const t2 = performance.now(), back = importStep(exportStep([S.brep], { name: 'coil' })), stepMs = performance.now() - t2;
  assert.equal(checkBrep(back).valid, true); near(vol(back), V, 1e-9, 'STEP round trip');
  t.diagnostic(`STEP round trip ${stepMs.toFixed(0)} ms`);
  t.diagnostic(`coil D 20 d 2 p 5, 6 turns: ${perTurn} Hermite pieces a turn for 1e-4·d (${spec.segments} segments × ${spec.pieces}), ${S.brep.faces.length} faces; centreline distance off by ${worst.toExponential(2)} (bound ${bound.toExponential(2)}); V ${V.toFixed(6)} vs πa²L ${want.toFixed(6)} (rel ${(Math.abs(V - want) / want).toExponential(2)}); built ${built.toFixed(0)} ms, mass ${massMs.toFixed(0)} ms`);
  // The budget across springs (the pieces a turn, set by (R + a)/d): a fine wire on a wide coil costs most.
  const rows = [[5, 0.5], [10, 1], [20, 1], [25, 0.8], [40, 1], [50, 0.5]].map(([Rr, aa]) => { let n = 4; while (hermiteDeviation(2 * Math.PI / n) * (Rr + aa) > 2e-4 * aa) n++; return `D/d ${(Rr / aa).toFixed(0)}: ${n}/turn`; });
  t.diagnostic(`pieces a turn within 1e-4·d: ${rows.join(', ')}`);
});

test('R12c S0 springs: a plane square to the axis cuts away πa²·L·z/h (closed form), by the analytic Boolean — the ground end', t => {
  // In the pipe's coordinates (arc s, ρ, θ) dV = ρ(1 − κρ cos θ) dρ dθ ds and a point's height is hφ + ρ sin θ·R/L, so
  // below z0 (z0 ≥ aR/L: the plane clear of the start disc) the wire holds L/h ∫∫ρ(1 − κρ cos θ)(z0 − ρ sin θ R/L) dρ dθ
  // = πa²·L·z0/h — the odd terms vanish. The same by symmetry above a plane near the end.
  let perTurn = 4; while (hermiteDeviation(2 * Math.PI / perTurn) * 11 > 2e-4) perTurn++;
  const spec = { R: 10, p: 5, a: 1, turns: 3, segments: 3 * Math.ceil(perTurn / 4), pieces: 4 }, fit = 11 * hermiteDeviation(2 * Math.PI * 3 / (spec.segments * 4));
  const S = coil(spec), zTop = S.h * S.Phi, cutLo = 2.2, cutHi = zTop - 1.9;
  const box = (z0, z1) => outputOf(run([{ id: 'b', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30], plane: { origin: [0, 0, z0], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'e', kind: 'extrude', sketch: 'b', height: z1 - z0 }]), 'e').brep;
  const t0 = performance.now();
  let cut, why = '';
  try { cut = booleanAnalytic(booleanAnalytic(S.brep, box(-10, cutLo), 'difference'), box(cutHi, zTop + 10), 'difference'); } catch (e) { why = e.message; }
  const ms = performance.now() - t0;
  const want = Math.PI * spec.a ** 2 * S.L * (cutHi - cutLo) / S.h;
  if (!cut) { t.diagnostic(`ground ends by the analytic Boolean: refused in ${ms.toFixed(0)} ms — ${why}`); assert.fail(`the Boolean refused: ${why}`); }
  const chk = checkBrep(cut), V = vol(cut);
  t.diagnostic(`ground ends (z ${cutLo} and ${cutHi.toFixed(3)}): ${ms.toFixed(0)} ms, valid ${chk.valid}, ${cut.faces.length} faces; V ${V.toFixed(6)} vs πa²L(Δz/h) ${want.toFixed(6)} (rel ${(Math.abs(V - want) / want).toExponential(2)})`);
  assert.equal(chk.valid, true, chk.issues[0]);
  // The fit moves the surface by ≤ fit, so |ΔV| ≤ 2πa·(the length kept)·fit (and the quadrature's 1e-9).
  assert.ok(Math.abs(V - want) <= 2 * Math.PI * spec.a * S.L * (cutHi - cutLo) / S.h * fit + 1e-9 * want, `ground spring V ${V} vs ${want} (fit bound ${fit})`);
});

test('R12c S0 springs: closed forms — rate Gd⁴/(8D³n), solid height by end type, Wahl\'s stress factor, coil clearance against the wire', t => {
  // k = Gd⁴/(8D³n_a); closed and ground ends: n_t = n_a + 2, L_s = n_t·d; closed not ground: L_s = (n_t + 1)·d (the
  // compressionspring.com and acxesspring.com formula pages, read 2026-10-21). τ = K_W·8FD/(πd³), K_W = (4C − 1)/(4C − 4) + 0.615/C.
  const G = 79300, d = 2, Dm = 20, na = 6, k = G * d ** 4 / (8 * Dm ** 3 * na);
  near(k, 79300 * 16 / (8 * 8000 * 6), 1e-15, 'rate');
  // Energy: a coil of n_a turns twisted by torque FD/2 over length πD n_a: k = F/δ with δ = 8FD³n/(Gd⁴) (Castigliano on
  // torsion alone, J = πd⁴/32) — the same closed form from the torsion of the wire, an independent derivation.
  const F = 10, J = Math.PI * d ** 4 / 32, Lw = Math.PI * Dm * na, U = (F * Dm / 2) ** 2 * Lw / (2 * G * J);
  near(F / (2 * U / F), k, 1e-12, 'rate from the wire\'s torsion energy');
  const C = Dm / d, KW = (4 * C - 1) / (4 * C - 4) + 0.615 / C;
  near(KW, 1.1448, 1e-4, 'Wahl at C 10');
  // The coils' clearance: the least distance between turn k and k + 1 of the centreline against d (the wire's own
  // diameter): the gap closes at the solid pitch; the least distance falls short of the pitch by the helix angle.
  const R = Dm / 2, minGap = pitch => { const h = pitch / (2 * Math.PI); let best = Infinity; for (let i = -400; i <= 400; i++) { const df = 2 * Math.PI + i * 1e-3; best = Math.min(best, Math.hypot(2 * R * Math.sin(df / 2), h * df)); } return best; };
  const solidPitch = (() => { let lo = d, hi = 2 * d; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (minGap(m) < d) lo = m; else hi = m; } return hi; })();
  t.diagnostic(`k ${k.toFixed(4)} N/mm (G 79300, d 2, D 20, n 6); K_W ${KW.toFixed(4)}; the centreline turns are d apart at pitch ${solidPitch.toFixed(6)} (d ${d}): touching coils are refused as overlap, not at p = d exactly`);
  assert.ok(solidPitch >= d && solidPitch < d * 1.001);
});

// ---- fits (ISO 286) -----------------------------------------------------------------------------------------------------
// IT values, µm, from https://en.wikipedia.org/wiki/IT_Grade (read 2026-10-21, "ISO 286 - Table 1"): ranges over/up to mm,
// grades IT5–IT11. Values only; the standard text is not used.
const IT = { ranges: [[0, 3], [3, 6], [6, 10], [10, 18], [18, 30], [30, 50], [50, 80], [80, 120], [120, 180], [180, 250], [250, 315], [315, 400], [400, 500]],
  grades: [5, 6, 7, 8, 9, 10, 11],
  values: [[4, 6, 10, 14, 25, 40, 60], [5, 8, 12, 18, 30, 48, 75], [6, 9, 15, 22, 36, 58, 90], [8, 11, 18, 27, 43, 70, 110], [9, 13, 21, 33, 52, 84, 130], [11, 16, 25, 39, 62, 100, 160],
    [13, 19, 30, 46, 74, 120, 190], [15, 22, 35, 54, 87, 140, 220], [18, 25, 40, 63, 100, 160, 250], [20, 29, 46, 72, 115, 185, 290], [23, 32, 52, 81, 130, 210, 320], [25, 36, 57, 89, 140, 230, 360], [27, 40, 63, 97, 155, 250, 400]] };

test('R12c S0 fits: the IT tolerance factor reproduces most of the table but not all of it — the limits must be loaded, not computed', t => {
  // i = 0.45·∛D + 0.001·D µm on the range's geometric mean (the first range on √(1·3)); IT5…IT11 = 7, 10, 16, 25, 40, 64, 100 i.
  const mult = [7, 10, 16, 25, 40, 64, 100], miss = [];
  IT.ranges.forEach(([lo, hi], r) => { const Dg = Math.sqrt((lo || 1) * hi), i = 0.45 * Math.cbrt(Dg) + 0.001 * Dg; mult.forEach((m, g) => { const v = Math.round(m * i); if (v !== IT.values[r][g]) miss.push(`IT${IT.grades[g]} ${lo}–${hi}: ${v} vs ${IT.values[r][g]}`); }); });
  t.diagnostic(`formula against the page: ${91 - miss.length}/91 agree; differ: ${miss.join('; ')}`);
  assert.ok(miss.length > 0);
});

test('R12c S0 fits: limits → clearances by arithmetic (the page\'s own results), and the kernel\'s Boolean at the limit sizes (πL(r_s² − r_h²))', t => {
  // At Ø50 (https://en.wikipedia.org/wiki/Engineering_fit, read 2026-10-21): H8 0/+39 µm with f7 −50/−25 → clearance
  // +25…+89; H7 0/+25 with k6 +2/+18 → +23…−18; H7 0/+25 with p6 +26/+42 → −1…−42 (the page's own figures).
  const fits = [['H8/f7', [0, 39], [-50, -25], [25, 89]], ['H7/k6', [0, 25], [2, 18], [-18, 23]], ['H7/p6', [0, 25], [26, 42], [-42, -1]]];
  for (const [name, H, s, want] of fits) { const cMin = H[0] - s[1], cMax = H[1] - s[0]; assert.deepEqual([cMin, cMax], want, name); }
  // The kernel at the extreme sizes: a Ø50 + δ bore in a ring (outer Ø70) and a Ø50 + ε shaft, 20 long: ring − shaft holds
  // the ring's volume when ε ≤ δ, and loses πL((25 + ε/2)² − (25 + δ/2)²) when the shaft is larger (interference).
  const L = 20, ring = (dB) => [{ id: 'o', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 35 }, { id: 'oe', kind: 'extrude', sketch: 'o', height: L }, { id: 'i', kind: 'sketch', profile: 'circle', center: [0, 0], radius: dB / 2 }, { id: 'ie', kind: 'extrude', sketch: 'i', height: L + 2, from: -1 }, { id: 'r', kind: 'difference', target: 'oe', tool: 'ie' }];
  const rows = [];
  for (const [name, H, s] of fits) for (const [hole, shaft, tag] of [[50 + H[0] / 1000, 50 + s[1] / 1000, 'MMC'], [50 + H[1] / 1000, 50 + s[0] / 1000, 'LMC']]) {
    const doc = [...ring(hole), { id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: shaft / 2 }, { id: 'se', kind: 'extrude', sketch: 's', height: L + 2, from: -1 }, { id: 'x', kind: 'difference', target: 'r', tool: 'se' }];
    const Vr = massPropertiesOf(at(doc, 'r')).volume, Vx = massPropertiesOf(at(doc, 'x')).volume;
    const lost = Math.max(0, Math.PI * L * ((shaft / 2) ** 2 - (hole / 2) ** 2));
    assert.ok(Math.abs((Vr - Vx) - lost) <= 1e-6 * Vr, `${name} ${tag}: removed ${Vr - Vx} vs ${lost}`);
    rows.push(`${name} ${tag} ${shaft > hole ? `interference ${((shaft - hole) * 1000).toFixed(0)} µm, ${(Vr - Vx).toFixed(4)} mm³ (πLΔr² ${lost.toFixed(4)})` : `clearance ${((hole - shaft) * 1000).toFixed(0)} µm, none removed`}`);
  }
  t.diagnostic(rows.join('; '));
});

// ---- shafts ---------------------------------------------------------------------------------------------------------------
// A Ø20 seat for a 6204 (d 20, D 47, B 14, r min 1; abutment da 25…26.5, Da max 42, ra max 1: NSK,
// https://www.oss.nsk.com/6204-dgbb-sr.html, read 2026-10-21), a DIN 471 ring groove for Ø20 (groove Ø19.0, width 1.30, ring
// 1.20: https://www.lawsonproducts.com/products/retaining-ring-external-steel-20mm-97020, read 2026-10-21), a 6 × 6 key for
// 17–22 (seat depth t1 3.5, hub t2 2.8: https://fasten.it/Norms/Norm/DIN_6885-1, read 2026-10-21; the page marks the norm
// withdrawn). Test values with their sources, not a table.
const shaftProfile = () => {
  // (x along the axis, y the radius.) Ø25 shoulder 0–30, Ø20 30–80: the bearing's seat 30–44, the ring groove 44–45.3
  // (to Ø19) holding it against the shoulder, the key's run 52–70.
  const pts = [[0, 0], [80, 0], [80, 10], [45.3, 10], [45.3, 9.5], [44, 9.5], [44, 10], [30, 10], [30, 12.5], [0, 12.5]];
  let V = 0; for (const [x0, x1, r] of [[0, 30, 12.5], [30, 44, 10], [44, 45.3, 9.5], [45.3, 80, 10]]) V += Math.PI * r * r * (x1 - x0);
  return { pts, V };
};
const shaftDoc = () => [{ id: 'p', kind: 'sketch', profile: 'polygon', points: shaftProfile().pts }, { id: 'sh', kind: 'revolve', sketch: 'p', axis: { origin: [0, 0], direction: 'x' }, angle: 360 }];

test('R12c S0 shafts: steps and a ring groove by revolve (Pappus, exact), a keyseat by a Boolean (the disc segment, closed form; end-milled ends by quadrature)', t => {
  const base = outputOf(run(shaftDoc()), 'sh'); near(massPropertiesOf(base).volume, shaftProfile().V, 1e-12, 'stepped shaft with groove');
  assert.ok(checkOutput(base).valid);
  // The keyseat: 6 wide, 3.5 deep from the top of the Ø20 part (R 10), 18 long (x 52–70), square ends.
  const R = 10, b = 6, t1 = 3.5, Lk = 18, F = x => x / 2 * Math.sqrt(R * R - x * x) + R * R / 2 * Math.asin(x / R), Aseg = F(b / 2) - F(-b / 2) - b * (R - t1);
  // The revolve's axis is world X, so the radius runs in Y and Z alike: the key cut from z = R − t1 up, across |y| ≤ b/2.
  const key = (ends) => [{ id: 'k', kind: 'sketch', ...(ends === 'square' ? { profile: 'rectangle', min: [52, -b / 2], max: [52 + Lk, b / 2] } : { profile: 'loop', segments: [{ kind: 'line', start: [52 + b / 2, -b / 2] }, { kind: 'arc', start: [52 + Lk - b / 2, -b / 2], center: [52 + Lk - b / 2, 0], direction: 'ccw' }, { kind: 'line', start: [52 + Lk - b / 2, b / 2] }, { kind: 'arc', start: [52 + b / 2, b / 2], center: [52 + b / 2, 0], direction: 'ccw' }] }), plane: { origin: [0, 0, R - t1], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'ke', kind: 'extrude', sketch: 'k', height: 10 }, { id: 'ks', kind: 'difference', target: 'sh', tool: 'ke' }];
  const sq = outputOf(run([...shaftDoc(), ...key('square')]), 'ks');
  near(shaftProfile().V - massPropertiesOf(sq).volume, Aseg * Lk, 1e-8, 'square-ended keyseat');
  assert.ok(checkOutput(sq).valid);
  // End-milled: the straight part Aseg·(Lk − b) plus the two half discs of radius b/2 under the cylinder, together
  // ∫∫_{x² + w² ≤ (b/2)²} (√(R² − x²) − (R − t1)) — by Gauss–Legendre on x = (b/2) sin u (64 points).
  const gl = gauss(64); let ends = 0; for (const [u, wt] of gl) { const uu = Math.PI / 2 * u, x = b / 2 * Math.sin(uu), dx = b / 2 * Math.cos(uu) * Math.PI / 2; ends += wt * dx * 2 * Math.sqrt((b / 2) ** 2 - x * x) * (Math.sqrt(R * R - x * x) - (R - t1)); }
  const t0 = performance.now(), rd = outputOf(run([...shaftDoc(), ...key('round')]), 'ks'), ms = performance.now() - t0;
  near(shaftProfile().V - massPropertiesOf(rd).volume, Aseg * (Lk - b) + ends, 1e-7, 'end-milled keyseat');
  assert.ok(checkOutput(rd).valid);
  // The key 6 high in the 3.5 seat stands 2.5 proud; the hub's 2.8 leaves 0.3 over it (the tables' top clearance).
  t.diagnostic(`shaft ${shaftProfile().V.toFixed(4)} mm³ (Pappus); keyseat segment ${Aseg.toFixed(6)} mm² × 18 square, end-milled ends ${ends.toFixed(6)} mm³ (${ms.toFixed(0)} ms); key top clearance ${(2.8 - (6 - 3.5)).toFixed(1)} mm`);
});

/** Gauss–Legendre nodes and weights on [−1, 1]. */
function gauss(n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    let x = Math.cos(Math.PI * (i - 0.25) / (n + 0.5));
    for (let it = 0; it < 100; it++) { let p0 = 1, p1 = x; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } const dp = n * (x * p1 - p0) / (x * x - 1), dx = p1 / dp; x -= dx; if (Math.abs(dx) < 1e-16) break; }
    let p0 = 1, p1 = x; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
    const dp = n * (x * p1 - p0) / (x * x - 1); out.push([x, 2 / ((1 - x * x) * dp * dp)]);
  }
  return out;
}

// ---- bearings and O-rings -------------------------------------------------------------------------------------------------
test('R12c S0 bearings: a 6204 envelope (corners r 1) on the shaft\'s seat against its shoulder — Pappus, no overlap, the abutment rules', t => {
  // The envelope's section: x 16…30 (B 14 against the shoulder at 30), radius 10…23.5, corners rounded r 1 — its area
  // A = B·(D − d)/2 − (4 − π)r², its centroid's radius by the parts (the rectangle less four corner squares plus quarter discs).
  const r = 1, x0 = 30, x1 = 44, y0 = 10, y1 = 23.5;
  const seg = [{ kind: 'line', start: [x0 + r, y0] }, { kind: 'arc', start: [x1 - r, y0], center: [x1 - r, y0 + r], direction: 'ccw' }, { kind: 'line', start: [x1, y0 + r] }, { kind: 'arc', start: [x1, y1 - r], center: [x1 - r, y1 - r], direction: 'ccw' },
    { kind: 'line', start: [x1 - r, y1] }, { kind: 'arc', start: [x0 + r, y1], center: [x0 + r, y1 - r], direction: 'ccw' }, { kind: 'line', start: [x0, y1 - r] }, { kind: 'arc', start: [x0, y0 + r], center: [x0 + r, y0 + r], direction: 'ccw' }];
  // Moment about the axis: ∫y dA. A corner square r² at height yc± r/2 is replaced by a quarter disc of centroid 4r/3π from its centre.
  const k = 4 * r / (3 * Math.PI), Arect = (x1 - x0) * (y1 - y0), Ay = Arect * (y0 + y1) / 2;
  // (Bottom corners: the square spans y0…y0 + r, the quarter disc's centroid at y0 + r − k; top: y1 − r…y1, at y1 − r + k.)
  const My = Ay + 2 * (-(r * r) * (y0 + r / 2) + Math.PI * r * r / 4 * (y0 + r - k)) + 2 * (-(r * r) * (y1 - r / 2) + Math.PI * r * r / 4 * (y1 - r + k));
  const want = 2 * Math.PI * My;
  const doc = [...shaftDoc(), { id: 'b', kind: 'sketch', profile: 'loop', segments: seg }, { id: 'brg', kind: 'revolve', sketch: 'b', axis: { origin: [0, 0], direction: 'x' }, angle: 360 }, { id: 'x', kind: 'difference', target: 'sh', tool: 'brg' }];
  near(massPropertiesOf(at(doc, 'brg')).volume, want, 1e-11, '6204 envelope (Pappus)');
  // On its seat (bore = seat, face on the shoulder): the shaft keeps its volume — no overlap. (The seat runs 30…44; the
  // shoulder Ø25 lies inside the abutment band da 25…26.5, its corner sharp — any fillet ≤ ra max 1 clears the r 1 corner.)
  near(massPropertiesOf(at(doc, 'x')).volume, shaftProfile().V, 1e-9, 'shaft less the bearing: untouched');
  const shoulder = 2 * shaftProfile().pts[8][1], da = [25, 26.5], Da = 42, housingShoulder = 40;
  assert.ok(shoulder >= da[0] && shoulder <= da[1] && housingShoulder <= Da, 'the abutment rules');
  t.diagnostic(`6204 envelope ${want.toFixed(4)} mm³; on its Ø20 seat against the Ø25 shoulder: no overlap (coincident bore and seat, coincident face and shoulder)`);
});

test('R12c S0 O-rings: AS568-214 on a piston gland — the torus exact, the free ring\'s overlap with the bore by Pappus on a circular segment, squeeze, stretch and fill', t => {
  // AS568-214: cross-section 0.139 in (3.53 mm), ID 0.984 in (24.99 mm) (https://www.globaloring.com/as568-size-chart/,
  // read 2026-10-21). The gland (test values): groove bottom Ø25.5, bore Ø31.1, groove 4.7 wide.
  const CS = 3.53, ID = 24.99, Dg = 25.5, Db = 31.1, wG = 4.7, depth = (Db - Dg) / 2;
  const stretch = (Dg - ID) / ID, squeeze0 = (CS - depth) / CS, fill0 = Math.PI * CS * CS / 4 / (wG * depth);
  // Stretched on the groove, the ring keeps its volume (2π²Rr²): r'²(Dg/2 + r') = r²(ID/2 + r), solved for r'.
  const r = CS / 2, R = ID / 2 + r; let rs = r; for (let i = 0; i < 60; i++) rs = Math.sqrt(r * r * R / (Dg / 2 + rs));
  const Rs = Dg / 2 + rs, squeeze = (2 * rs - depth) / (2 * rs);
  // The kernel: the stretched (free) torus and a sleeve beyond the bore (Ø31.1…Ø40): their intersection is the material the
  // bore displaces — a circular segment of the section, chord at c = Db/2 − Rs from its centre, swept about the axis:
  // A = r'² acos(c/r') − c√(r'² − c²), its centroid ȳ = (2/3)(r'² − c²)^{3/2}/A beyond the centre, V = 2π(Rs + ȳ)A.
  const c = Db / 2 - Rs, A = rs * rs * Math.acos(c / rs) - c * Math.sqrt(rs * rs - c * c), yb = 2 / 3 * (rs * rs - c * c) ** 1.5 / A, want = 2 * Math.PI * (Rs + yb) * A;
  const ringDoc = [{ id: 'c', kind: 'sketch', profile: 'circle', center: [Rs, 0], radius: rs }, { id: 'or', kind: 'revolve', sketch: 'c', axis: { origin: [0, 0], direction: 'y' }, angle: 360 }];
  const sleeve = [{ id: 'so', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20, plane: { origin: [0, -5, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] } }, { id: 'soe', kind: 'extrude', sketch: 'so', height: 10 },
    { id: 'si', kind: 'sketch', profile: 'circle', center: [0, 0], radius: Db / 2, plane: { origin: [0, -6, 0], normal: [0, 1, 0], xAxis: [1, 0, 0] } }, { id: 'sie', kind: 'extrude', sketch: 'si', height: 12 }, { id: 'sl', kind: 'difference', target: 'soe', tool: 'sie' }];
  const t0 = performance.now(); let got, why = '';
  const doc = [...ringDoc, ...sleeve, { id: 'x', kind: 'intersect', target: 'or', tool: 'sl' }];
  near(massPropertiesOf(at(doc, 'or')).volume, 2 * Math.PI ** 2 * Rs * rs * rs, 1e-10, 'torus');
  try { got = massPropertiesOf(at(doc, 'x')).volume; } catch (e) { why = e.message; }
  const ms = performance.now() - t0;
  t.diagnostic(`AS568-214 on Ø25.5: stretch ${(100 * stretch).toFixed(2)}%, the section ${CS} → ${(2 * rs).toFixed(4)} mm; gland depth ${depth.toFixed(2)}: squeeze ${(100 * squeeze0).toFixed(1)}% nominal, ${(100 * squeeze).toFixed(1)}% stretched; fill ${(100 * fill0).toFixed(1)}% (π CS²/4 over w·h); the bore displaces ${want.toFixed(5)} mm³ (Pappus) — kernel ${got === undefined ? `refused: ${why}` : `${got.toFixed(5)} (rel ${(Math.abs(got - want) / want).toExponential(2)})`}, ${ms.toFixed(0)} ms`);
  assert.ok(got !== undefined, why); near(got, want, 1e-7, 'torus ∩ sleeve');
});

/** The distance of q from a curve f(θ) over [a, b], by its polyline of n chords (each chord's own nearest point). */
function polylineDistance(q, f, a, b, n) {
  let best = Infinity, prev = f(a);
  for (let j = 1; j <= n; j++) {
    const cur = f(a + (b - a) * j / n), dx = cur[0] - prev[0], dy = cur[1] - prev[1], L2 = dx * dx + dy * dy;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((q[0] - prev[0]) * dx + (q[1] - prev[1]) * dy) / L2)) : 0;
    best = Math.min(best, Math.hypot(prev[0] + t * dx - q[0], prev[1] + t * dy - q[1])); prev = cur;
  }
  return best;
}

// ---- connector envelopes, cams ------------------------------------------------------------------------------------------
test('R12c S0 connectors: a USB-C receptacle opening (8.34 × 2.56, 6.2 deep) in a panel and the plug body (8.25 × 2.4) — stadium areas, the gaps', t => {
  // https://en.wikipedia.org/wiki/USB_hardware (read 2026-10-21, the connector dimensions table): receptacle opening
  // 8.34 × 2.56 × 6.2 mm, plug body 8.25 × 2.4 × 6.51 mm; the page says the receptacle figures are the opening only.
  const stadium = (w, hgt, x0 = 0) => ({ seg: [{ kind: 'line', start: [x0 - (w - hgt) / 2, -hgt / 2] }, { kind: 'arc', start: [x0 + (w - hgt) / 2, -hgt / 2], center: [x0 + (w - hgt) / 2, 0], direction: 'ccw' }, { kind: 'line', start: [x0 + (w - hgt) / 2, hgt / 2] }, { kind: 'arc', start: [x0 - (w - hgt) / 2, hgt / 2], center: [x0 - (w - hgt) / 2, 0], direction: 'ccw' }], area: (w - hgt) * hgt + Math.PI * hgt * hgt / 4 });
  const o = stadium(8.34, 2.56), p = stadium(8.25, 2.4);
  const doc = [{ id: 'pn', kind: 'sketch', profile: 'rectangle', min: [-10, -5], max: [10, 5] }, { id: 'pe', kind: 'extrude', sketch: 'pn', height: 8 },
    { id: 'os', kind: 'sketch', profile: 'loop', segments: o.seg, plane: { origin: [0, 0, 8 - 6.2], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'oe', kind: 'extrude', sketch: 'os', height: 7 }, { id: 'rc', kind: 'difference', target: 'pe', tool: 'oe' },
    { id: 'ps', kind: 'sketch', profile: 'loop', segments: p.seg, plane: { origin: [0, 0, 8 - 6.2], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'pl', kind: 'extrude', sketch: 'ps', height: 6.51 }, { id: 'x', kind: 'difference', target: 'rc', tool: 'pl' }];
  const Vrc = massPropertiesOf(at(doc, 'rc')).volume;
  near(Vrc, 20 * 10 * 8 - o.area * 6.2, 1e-12, 'panel less the opening');
  near(massPropertiesOf(at(doc, 'pl')).volume, p.area * 6.51, 1e-12, 'plug');
  near(massPropertiesOf(at(doc, 'x')).volume, Vrc, 1e-12, 'the seated plug touches nothing');
  t.diagnostic(`opening ${o.area.toFixed(5)} mm², plug ${p.area.toFixed(5)} mm²; gaps ${((8.34 - 8.25) / 2).toFixed(3)} across, ${((2.56 - 2.4) / 2).toFixed(3)} through; the plug's 6.51 stands 0.31 out of the 6.2 opening (an opening, not the receptacle's housing or tongue)`);
});

test('R12c S0 cams: a disc cam for a roller follower (cycloidal rise) — the pitch curve\'s inner offset fitted in Hermite pieces, extruded; area by Green\'s theorem on the exact offset', t => {
  // Base circle 20, roller 5 (pitch radius 25), a cycloidal rise of 8 over 120°, dwell 60°, return over 120°, dwell 60°.
  const rp0 = 25, rr = 5, H = 8, b1 = 2 * Math.PI / 3, d1 = Math.PI / 3;
  const s = th => { const u = th < b1 ? th / b1 : th < b1 + d1 ? 1 : th < 2 * b1 + d1 ? 1 - (th - b1 - d1) / b1 : 0; return th >= 2 * b1 + d1 ? 0 : H * (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI)); };
  const pitch = th => [(rp0 + s(th)) * Math.cos(th), (rp0 + s(th)) * Math.sin(th)];
  const dp = th => { const e = 1e-6; const a = pitch(th - e), c = pitch(th + e); return [(c[0] - a[0]) / (2 * e), (c[1] - a[1]) / (2 * e)]; };
  // The profile: the pitch point less rr along the outward normal (the pitch curve counter-clockwise: normal (y', −x')/|·|).
  const prof = th => { const P = pitch(th), d = dp(th), n = Math.hypot(d[0], d[1]); return [P[0] - rr * d[1] / n, P[1] + rr * d[0] / n]; };
  const dprof = th => { const e = 1e-5; const a = prof(th - e), c = prof(th + e); return [(c[0] - a[0]) / (2 * e), (c[1] - a[1]) / (2 * e)]; };
  // Hermite pieces in θ, refined until the measured deviation (each piece sampled against the exact offset) ≤ 1e-4·rr.
  const tolC = 1e-4 * rr; let n = 24, poles, dev;
  for (; n <= 400; n += 8) {
    poles = []; dev = 0;
    for (let k = 0; k < n; k++) {
      const ta = 2 * Math.PI * k / n, tb = 2 * Math.PI * (k + 1) / n, hh = (tb - ta) / 3, A = prof(ta), B = prof(tb), dA = dprof(ta), dB = dprof(tb);
      const P = [A, [A[0] + hh * dA[0], A[1] + hh * dA[1]], [B[0] - hh * dB[0], B[1] - hh * dB[1]], B]; poles.push(P);
      for (let i = 1; i < 16; i++) { const t2 = i / 16, m = 1 - t2, q = [0, 1].map(dd => m * m * m * P[0][dd] + 3 * m * m * t2 * P[1][dd] + 3 * m * t2 * t2 * P[2][dd] + t2 * t2 * t2 * P[3][dd]); dev = Math.max(dev, polylineDistance(q, prof, ta - 0.1 * (tb - ta), tb + 0.1 * (tb - ta), 240)); }
    }
    if (dev <= tolC) break;
  }
  assert.ok(dev <= tolC, `cam fit ${dev}`);
  const pieces = poles.map((P, k) => ({ name: `cam.profile#${k + 1}`, curve: { kind: 'curve', id: `cp${k}`, degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: P.map(q => [q[0], q[1], 0]), weights: [1, 1, 1, 1] } }));
  const brep = extrudedProfile('cam', 'r12c-s0-cam', pieces, [], 10, 60);
  const chk = checkBrep(brep); assert.equal(chk.valid, true, chk.issues[0]);
  // Area of the exact offset by Green (½∮x dy − y dx, 20000 trapezoids of a periodic integrand: spectrally accurate).
  let area = 0; const M = 20000; for (let i = 0; i < M; i++) { const th = 2 * Math.PI * i / M, P = prof(th), d = dprof(th); area += 0.5 * (P[0] * d[1] - P[1] * d[0]) * 2 * Math.PI / M; }
  const V = brepMassProperties(brep, 1).volume;
  // Its perimeter times the deviation bounds the area's change.
  near(V, area * 10, 2 * Math.PI * 35 * dev * 10 / (area * 10), 'cam volume');
  // The pitch curve's least radius of curvature against the roller (undercut when ρ_min < rr on the convex parts).
  let rho = Infinity; for (let i = 0; i < 3600; i++) { const th = 2 * Math.PI * i / 3600, e = 1e-4, a = pitch(th - e), b = pitch(th), c = pitch(th + e); const x1 = (c[0] - a[0]) / (2 * e), y1 = (c[1] - a[1]) / (2 * e), x2 = (c[0] - 2 * b[0] + a[0]) / (e * e), y2 = (c[1] - 2 * b[1] + a[1]) / (e * e); const k = (x1 * y2 - y1 * x2) / Math.hypot(x1, y1) ** 3; if (k > 0) rho = Math.min(rho, 1 / k); }
  t.diagnostic(`cam: ${n} Hermite pieces within 1e-4·rr (measured ${dev.toExponential(2)}); V ${V.toFixed(4)} vs Green ${(area * 10).toFixed(4)} (rel ${(Math.abs(V - area * 10) / (area * 10)).toExponential(2)}); the pitch curve's least convex ρ ${rho.toFixed(3)} > rr ${rr}: no undercut`);
  assert.ok(rho > rr);
});
