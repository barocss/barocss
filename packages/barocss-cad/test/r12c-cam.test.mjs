import test from 'node:test';
import assert from 'node:assert/strict';
import { camLaw, camLawPeaks, camMotion, camProfile, discCam, CAM_LAWS, isCamError, checkBrep, brepMassProperties, evaluateCadPart } from '../dist/index.js';

// R12c.6a (D160): disc cams and followers. Oracles written here, apart from the kernel's code:
// - the laws: f(0) = 0, f(1) = 1, f' and f'' against central differences of f, the peaks against dense sampling; the
//   modified trapezoid by integrating its acceleration shape (quarter sine, flat, half cosine, flat, quarter sine) twice
//   with Simpson's rule, scaled so the rise is 1 — the kernel's A = 8π/(π + 2) comes out, not in;
// - the pitch curve's radius of curvature from the polar formula ρ = (r² + r'²)^{3/2}/(r² + 2r'² − r r'') (in-line) and from
//   finite differences of the parametric curve Rot(−θ)C(θ) (offset, oscillating);
// - the pressure angle by Norton's tan φ = (s' − e)/(s + √(R_p² − e²)) (translating roller) and by Kennedy's instant
//   centre a s'/(1 + s') on the line of centres (oscillating roller: the normal through it and the roller's centre);
// - a flat face: ρ = r_b + s + s'' (translating; Norton), the contact at s' along the face; oscillating, the contact the
//   foot of the perpendicular from the instant centre to the face, ρ by finite differences of those points;
// - the volume by Green's theorem on the exact profile; the follower's lift found on the built solid's own profile curves.

const near = (got, want, abs, what) => assert.ok(Math.abs(got - want) <= abs, `${what}: ${got} vs ${want} (±${abs})`);
const code = c => e => isCamError(e) && e.code === c;
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const S0 = { baseRadiusMM: 20, follower: 'roller', rollerRadiusMM: 5, thicknessMM: 10, segments: [{ angleDeg: 120, to: 8, law: 'cycloidal' }, { angleDeg: 60 }, { angleDeg: 120, to: 0, law: 'cycloidal' }, { angleDeg: 60 }] };
const TAU = 2 * Math.PI;
/** The test's own laws (the textbook forms), on u ∈ [0, 1]. */
const LAW = {
  harmonic: u => (1 - Math.cos(Math.PI * u)) / 2,
  cycloidal: u => u - Math.sin(TAU * u) / TAU,
  'polynomial-345': u => 10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5,
};
/** s(θ) of a program (θ radians), positions scaled by k; central differences for s', s''. */
function motion(segs, k = 1, law = (name, u) => LAW[name](u)) {
  const list = []; let a = 0, p = 0;
  for (const g of segs) { const b = a + g.angleDeg * Math.PI / 180, to = g.to === undefined ? p : g.to * k; list.push({ a, b, p0: p, p1: to, law: g.law }); a = b; p = to; }
  const s = th => { th = ((th % TAU) + TAU) % TAU; const g = list.find(x => th >= x.a && th < x.b) ?? list[list.length - 1]; return g.p1 === g.p0 ? g.p0 : g.p0 + (g.p1 - g.p0) * law(g.law, (th - g.a) / (g.b - g.a)); };
  const h = 1e-4, s1 = th => (s(th + h) - s(th - h)) / (2 * h), s2 = th => (s(th + h) - 2 * s(th) + s(th - h)) / (h * h);
  return { s, s1, s2, list };
}
/** The least convex radius of a clockwise closed curve P(θ) (finite differences), over θ ∈ [0, 2π). */
function leastConvex(P, n = 20000) {
  let best = Infinity, at = 0;
  for (let i = 0; i < n; i++) {
    const th = TAU * i / n, h = 1e-4, a = P(th - h), b = P(th), c = P(th + h);
    const x1 = (c[0] - a[0]) / (2 * h), y1 = (c[1] - a[1]) / (2 * h), x2 = (c[0] - 2 * b[0] + a[0]) / (h * h), y2 = (c[1] - 2 * b[1] + a[1]) / (h * h), cr = x1 * y2 - y1 * x2;
    if (cr < 0) { const r = Math.hypot(x1, y1) ** 3 / -cr; if (r < best) { best = r; at = th; } }
  }
  return { rho: best, at };
}
const rotBack = (v, th) => [Math.cos(th) * v[0] + Math.sin(th) * v[1], -Math.sin(th) * v[0] + Math.cos(th) * v[1]];
/** The built solid's profile curves (the side faces' z = 0 edges), sampled. */
function builtProfile(brep, per = 200) {
  const pts = [];
  for (const f of brep.faces) {
    if (!/\.(rise|dwell|return)\d+#\d+$/.test(f.name)) continue;
    const P = f.surface.controlPoints.map(col => col[0]);
    for (let i = 0; i < per; i++) { const t = i / per, m = 1 - t; pts.push([0, 1].map(d => m * m * m * P[0][d] + 3 * m * m * t * P[1][d] + 3 * m * t * t * P[2][d] + t * t * t * P[3][d])); }
  }
  return pts;
}

test('R12c.6a laws: f(0) = 0 and f(1) = 1; f\', f\'\' the derivatives of f; the peaks Cv, Ca; the rest at both ends but uniform\'s velocity and harmonic\'s acceleration', () => {
  for (const law of CAM_LAWS) {
    const [f0, v0, a0] = camLaw(law, 0), [f1, v1, a1] = camLaw(law, 1);
    near(f0, 0, 1e-15, `${law} f(0)`); near(f1, 1, 1e-14, `${law} f(1)`);
    let cv = 0, ca = 0;
    for (let i = 1; i < 2000; i++) {
      const u = i / 2000, h = 1e-5, [f, v, a] = camLaw(law, u), fp = camLaw(law, u + h)[0], fm = camLaw(law, u - h)[0], vp = camLaw(law, u + h)[1], vm = camLaw(law, u - h)[1];
      near(v, (fp - fm) / (2 * h), 1e-8, `${law} f' at ${u}`); near(a, (vp - vm) / (2 * h), 1e-6, `${law} f'' at ${u}`);
      if (law in LAW) near(f, LAW[law](u), 1e-14, `${law} f at ${u}`);
      cv = Math.max(cv, v); ca = Math.max(ca, Math.abs(a));
    }
    const pk = camLawPeaks(law);
    near(pk.cv, cv, 1e-5, `${law} Cv`);
    if (law === 'uniform') { assert.equal(pk.ca, Infinity); assert.deepEqual([v0, v1], [1, 1]); continue; }
    near(pk.ca, Math.max(ca, Math.abs(a0)), 1e-4, `${law} Ca`);
    near(v0, 0, 1e-15, `${law} f'(0)`); near(v1, 0, 1e-12, `${law} f'(1)`);
    if (law === 'harmonic') near(a0, Math.PI ** 2 / 2, 1e-12, 'harmonic f\'\'(0)'); else { near(a0, 0, 1e-12, `${law} f''(0)`); near(a1, 0, 1e-9, `${law} f''(1)`); }
  }
  // 3-4-5: Cv = 15/8, Ca = 10/√3; cycloidal 2 and 2π; harmonic π/2, π²/2 — closed forms, sampled above.
  assert.deepEqual([camLawPeaks('polynomial-345').cv, camLawPeaks('cycloidal').ca], [15 / 8, TAU]);
});

test('R12c.6a the modified trapezoid against its acceleration shape integrated twice (Simpson): A = 8π/(π + 2), Cv = 2, f within 1e-12', () => {
  // The shape with unit plateau: sin(4πu) to 1/8, 1 to 3/8, cos(4π(u − 3/8)) to 5/8, −1 to 7/8, −cos(4π(u − 7/8) − π/2)... i.e. −sin(4π(1 − u)).
  const shape = u => u <= 1 / 8 ? Math.sin(4 * Math.PI * u) : u <= 3 / 8 ? 1 : u <= 5 / 8 ? Math.cos(4 * Math.PI * (u - 3 / 8)) : u <= 7 / 8 ? -1 : -Math.sin(4 * Math.PI * (1 - u));
  const N = 64000, h = 1 / N, vh = new Float64Array(2 * N + 1), f = new Float64Array(N + 1);
  // (Simpson on half steps for the velocity, then on whole steps for f: the shape's breaks sit on the grid.)
  for (let j = 0; j < 2 * N; j++) { const u = j * h / 2; vh[j + 1] = vh[j] + h / 12 * (shape(u) + 4 * shape(u + h / 4) + shape(u + h / 2)); }
  for (let i = 0; i < N; i++) f[i + 1] = f[i] + h / 6 * (vh[2 * i] + 4 * vh[2 * i + 1] + vh[2 * i + 2]);
  const v = i => vh[2 * i];
  const A = 1 / f[N];
  near(A, 8 * Math.PI / (Math.PI + 2), 1e-9, 'A'); near(camLawPeaks('modified-trapezoid').ca, A, 1e-9, 'Ca'); near(A * v(N / 2), 2, 1e-9, 'Cv');
  for (const i of [N / 16, N / 8, N / 4, 3 * N / 8, N / 2, 5 * N / 8, 3 * N / 4, 7 * N / 8, 15 * N / 16]) near(camLaw('modified-trapezoid', i * h)[0], A * f[i], 1e-10, `f at ${i * h}`);
});

test('R12c.6a S0\'s cam: base 20, roller 5, cycloidal rise 8 over 120°, dwells 60° — the pitch curve\'s least convex ρ 23.69 by the polar formula, the volume by Green, the follower\'s lift on the built profile', () => {
  const { brep, report } = discCam(S0, { id: 'c' });
  assert.equal(checkBrep(brep).valid, true);
  const M = motion(S0.segments), Rp = 25;
  // The polar formula on r = R_p + s (dense), against the report.
  let rho = Infinity;
  for (let i = 0; i < 36000; i++) { const th = TAU * i / 36000, r = Rp + M.s(th), r1 = M.s1(th), r2 = M.s2(th), den = r * r + 2 * r1 * r1 - r * r2; if (den > 0) rho = Math.min(rho, (r * r + r1 * r1) ** 1.5 / den); }
  near(report.curvature.leastPitchRadiusMM, rho, 1e-5, 'least ρ'); near(rho, 23.690158, 1e-5, 'S0\'s figure');
  near(report.curvature.leastProfileRadiusMM, rho - 5, 1e-5, 'the profile\'s least radius');
  // Norton (e = 0): tan φ = s'/(R_p + s).
  let phi = 0; for (let i = 0; i < 36000; i++) { const th = TAU * i / 36000; phi = Math.max(phi, Math.abs(Math.atan(M.s1(th) / (Rp + M.s(th))))); }
  near(report.pressureAngle.maxDeg, phi * 180 / Math.PI, 1e-5, 'pressure angle');
  assert.deepEqual([report.pressureAngle.limitDeg, report.pressureAngle.limitEstimate, report.warnings.length], [30, true, 0]);
  // The exact profile (the pitch point less r_r along the outward normal) by Green: ½∮(x dy − y dx).
  const P = th => [(Rp + M.s(th)) * Math.sin(th), (Rp + M.s(th)) * Math.cos(th)];
  const prof = th => { const e = 1e-6, a = P(th - e), c = P(th + e), dx = c[0] - a[0], dy = c[1] - a[1], n = Math.hypot(dx, dy), p = P(th); return [p[0] + 5 * dy / n, p[1] - 5 * dx / n]; };
  let area = 0; const G = 40000;
  for (let i = 0; i < G; i++) { const th = TAU * i / G, p = prof(th), e = 1e-5, a = prof(th - e), c = prof(th + e); area += 0.5 * (p[0] * (c[1] - a[1]) - p[1] * (c[0] - a[0])) / (2 * e) * TAU / G; }
  // (Clockwise in θ: the area's sign turned.)
  const V = brepMassProperties(brep, 1).volumeMM3;
  near(V, -area * 10, TAU * 35 * report.profileDeviationMM * 10 + 1e-3, 'volume');
  assert.ok(report.profileDeviationMM <= report.profileToleranceMM && report.profileToleranceMM === 2e-3);
  assert.equal(report.profilePieces, brep.faces.filter(f => /#\d+$/.test(f.name)).length);
  // The lift on the built solid's own curves: the roller's centre on x = 0 the highest y touching any profile point.
  const pts = builtProfile(brep);
  let worst = 0;
  for (let i = 0; i < 360; i++) {
    const th = TAU * i / 360; let y = -Infinity;
    for (const q of pts) { const c = Math.cos(th), sn = Math.sin(th), X = c * q[0] - sn * q[1], Y = sn * q[0] + c * q[1]; if (Math.abs(X) <= 5) y = Math.max(y, Y + Math.sqrt(25 - X * X)); }
    worst = Math.max(worst, Math.abs(y - Rp - M.s(th)));
  }
  assert.ok(worst <= report.profileDeviationMM / Math.cos(phi) + 5e-5, `lift ${worst}`);
  assert.ok(report.sweep.deviation <= report.profileDeviationMM / Math.cos(phi) + 1e-9 && report.sweep.samples === 720, JSON.stringify(report.sweep));
  // Faces: the motions by kind, the ends.
  const names = new Set(brep.faces.map(f => f.name.replace(/#\d+$/, '')));
  assert.deepEqual([...names].sort(), ['c.dwell1', 'c.dwell2', 'c.face0', 'c.face1', 'c.return1', 'c.rise1']);
  assert.deepEqual(report.segments.map(s => [s.motion, s.law ?? '-', s.from, s.to]), [['rise', 'cycloidal', 0, 8], ['dwell', '-', 8, 8], ['return', 'cycloidal', 8, 0], ['dwell', '-', 0, 0]]);
  near(report.segments[0].peakVelocity, 8 * 2 / (TAU / 3), 1e-6, 'peak velocity'); near(report.segments[0].peakAcceleration, 8 * TAU / (TAU / 3) ** 2, 1e-6, 'peak acceleration');
});

test('R12c.6a an offset roller follower: Norton\'s pressure angle with the offset, the pitch curve\'s ρ by finite differences, a warning above a given limit', () => {
  const e = 6, spec = { ...S0, offsetMM: e, pressureAngleLimitDeg: 20 }, { report } = camProfile(spec), M = motion(S0.segments), d = Math.sqrt(625 - 36);
  let phi = 0, at = 0; for (let i = 0; i < 36000; i++) { const th = TAU * i / 36000, p = Math.atan((M.s1(th) - e) / (M.s(th) + d)); if (Math.abs(p) > phi) { phi = Math.abs(p); at = th; } }
  near(report.pressureAngle.maxDeg, phi * 180 / Math.PI, 1e-5, 'Norton'); near(report.pressureAngle.atDeg, at * 180 / Math.PI, 0.02, 'where');
  const lc = leastConvex(th => rotBack([e, d + M.s(th)], th));
  near(report.curvature.leastPitchRadiusMM, lc.rho, 1e-4, 'ρ (finite differences)');
  assert.ok(report.warnings.some(w => w.code === 'PRESSURE_ANGLE' && /reaches 26\.\d+° .* above 20°$/.test(w.message)), JSON.stringify(report.warnings));
  assert.equal(report.pressureAngle.limitEstimate, false);
});

test('R12c.6a a flat-faced translating follower (3-4-5 rise, modified-trapezoid return): ρ = r_b + s + s\'\', the contact at s\' along the face, the pressure angle 0, the face width checked', () => {
  const segs = [{ angleDeg: 120, to: 8, law: 'polynomial-345' }, { angleDeg: 60 }, { angleDeg: 120, to: 0, law: 'modified-trapezoid' }, { angleDeg: 60 }];
  const spec = { baseRadiusMM: 20, follower: 'flat', thicknessMM: 10, faceWidthMM: 15, segments: segs }, { brep, report } = discCam(spec, { id: 'f' });
  assert.equal(checkBrep(brep).valid, true);
  const M = motion(segs, 1, (n, u) => n === 'modified-trapezoid' ? camLaw(n, u)[0] : LAW[n](u));
  let rho = Infinity; for (let i = 0; i < 36000; i++) { const th = TAU * i / 36000; rho = Math.min(rho, 20 + M.s(th) + M.s2(th)); }
  near(report.curvature.leastProfileRadiusMM, rho, 2e-4, 'ρ = r_b + s + s\'\'');
  // The contact's travel: 15/8·8/β on the rise, −2·8/β on the return.
  const be = TAU / 3; near(report.faceContactMM[1], 15 / 8 * 8 / be, 1e-6, 'contact +'); near(report.faceContactMM[0], -2 * 8 / be, 1e-6, 'contact −');
  assert.equal(report.pressureAngle.maxDeg, 0);
  assert.ok(report.warnings.some(w => w.code === 'FACE_WIDTH' && /-7\.639437 to 7\.161972 mm about the follower's line, off a face 15 mm wide/.test(w.message)), JSON.stringify(report.warnings));
  // The lift on the built profile: the face the highest point.
  const pts = builtProfile(brep); let worst = 0;
  for (let i = 0; i < 360; i++) { const th = TAU * i / 360; let y = -Infinity; for (const q of pts) y = Math.max(y, Math.sin(th) * q[0] + Math.cos(th) * q[1]); worst = Math.max(worst, Math.abs(y - 20 - M.s(th))); }
  assert.ok(worst <= report.profileDeviationMM + 2e-5, `lift ${worst}`);
});

test('R12c.6a an oscillating roller follower: the pressure angle through Kennedy\'s instant centre, ρ by finite differences, the arm\'s angle found on the built profile', () => {
  const segs = [{ angleDeg: 120, to: 15, law: 'cycloidal' }, { angleDeg: 60 }, { angleDeg: 120, to: 0, law: 'harmonic' }, { angleDeg: 60 }];
  const spec = { baseRadiusMM: 20, follower: 'roller', motion: 'oscillating', rollerRadiusMM: 5, pivotDistanceMM: 50, armLengthMM: 40, thicknessMM: 10, segments: segs };
  const { brep, report } = discCam(spec, { id: 'o' }), k = Math.PI / 180, M = motion(segs, k), a = 50, l = 40;
  const psi0 = Math.acos((a * a + l * l - 625) / (2 * a * l)); near(report.restAngleDeg, psi0 / k, 1e-6, 'ψ0');
  const C = th => { const ps = psi0 + M.s(th); return [a - l * Math.cos(ps), l * Math.sin(ps)]; };
  let phi = 0;
  for (let i = 0; i < 36000; i++) {
    const th = TAU * i / 36000, w = M.s1(th), I = [a * w / (1 + w), 0], c = C(th), n = [c[0] - I[0], c[1] - I[1]], ps = psi0 + M.s(th), u = [Math.sin(ps), Math.cos(ps)];
    phi = Math.max(phi, Math.acos((n[0] * u[0] + n[1] * u[1]) / Math.hypot(n[0], n[1])));
  }
  near(report.pressureAngle.maxDeg, phi / k, 1e-4, 'Kennedy');
  near(report.curvature.leastPitchRadiusMM, leastConvex(th => rotBack(C(th), th)).rho, 1e-4, 'ρ');
  assert.equal(report.warnings.filter(w => w.code === 'ACCELERATION_STEP').length, 2, 'the harmonic return at its dwells');
  assert.ok(report.sweep.deviation * l * k <= report.profileDeviationMM / Math.cos(phi) + 1e-9, JSON.stringify(report.sweep));
  // The arm's angle on the built curves: the largest ψ near the law's at which the roller touches a profile point.
  const pts = builtProfile(brep); let worst = 0;
  for (let i = 0; i < 360; i += 3) {
    const th = TAU * i / 360, want = psi0 + M.s(th); let got = -Infinity;
    for (const q of pts) {
      const X = [Math.cos(th) * q[0] - Math.sin(th) * q[1], Math.sin(th) * q[0] + Math.cos(th) * q[1]], dx = a - X[0], rq = Math.hypot(dx, X[1]), K = (dx * dx + X[1] * X[1] + l * l - 25) / (2 * l);
      if (Math.abs(K / rq) > 1) continue;
      const al = Math.atan2(X[1], dx), ps = al + Math.acos(K / rq);
      if (Math.abs(ps - want) < 0.2) got = Math.max(got, ps);
    }
    worst = Math.max(worst, Math.abs(got - want) * l);
  }
  assert.ok(worst <= report.profileDeviationMM / Math.cos(phi) + 5e-5, `arm ${worst}`);
});

test('R12c.6a an oscillating flat-faced follower: the contact the instant centre\'s foot on the face, ρ by finite differences of those points; the face through the pivot has pressure angle 0, offset c has atan(c/t)', () => {
  const segs = [{ angleDeg: 120, to: 10, law: 'cycloidal' }, { angleDeg: 60 }, { angleDeg: 120, to: 0, law: 'polynomial-345' }, { angleDeg: 60 }], k = Math.PI / 180, a = 60;
  for (const c of [0, 5]) {
    const spec = { baseRadiusMM: 20, follower: 'flat', motion: 'oscillating', pivotDistanceMM: a, faceOffsetMM: c, thicknessMM: 10, boreDiameterMM: 10, segments: segs };
    const { brep, report } = discCam(spec, { id: 'q' }), M = motion(segs, k), psi0 = Math.asin((20 + c) / a);
    assert.equal(checkBrep(brep).valid, true);
    // The contact (world): the foot from I = (a s'/(1 + s'), 0) on the line n·X = a sin ψ − c, n = (sin ψ, cos ψ).
    const Kw = th => { const w = M.s1(th), ps = psi0 + M.s(th), n = [Math.sin(ps), Math.cos(ps)], I = [a * w / (1 + w), 0], t = a * Math.sin(ps) - c - (n[0] * I[0] + n[1] * I[1]); return [I[0] + t * n[0], I[1] + t * n[1]]; };
    const along = th => { const ps = psi0 + M.s(th), K = Kw(th); return -Math.cos(ps) * (K[0] - a) + Math.sin(ps) * K[1]; };
    let lo = Infinity, hi = -Infinity; for (let i = 0; i < 36000; i++) { const t = along(TAU * i / 36000); lo = Math.min(lo, t); hi = Math.max(hi, t); }
    near(report.faceContactMM[0], lo, 1e-4, `contact from the pivot (c ${c})`); near(report.faceContactMM[1], hi, 1e-4, `contact to (c ${c})`);
    near(report.curvature.leastProfileRadiusMM, leastConvex(th => rotBack(Kw(th), th)).rho, 2e-3, `ρ (c ${c})`);
    near(report.pressureAngle.maxDeg, Math.atan(c / lo) / k, 1e-5, `pressure angle (c ${c})`);
    assert.ok(report.sweep.deviationMM <= 10 * report.profileDeviationMM, JSON.stringify(report.sweep));
  }
});

test('R12c.6a refusals: uniform motion\'s corner, a roller larger than the pitch curve\'s convex radius, a flat face with ρ ≤ 0 (CAM_UNDERCUT); a program off 360° or not back at 0, a motion with no law, an offset past the prime circle, a bore through the base circle (INVALID_INPUT)', () => {
  const uni = { ...S0, segments: [{ angleDeg: 120, to: 8, law: 'uniform' }, { angleDeg: 60 }, { angleDeg: 120, to: 0, law: 'cycloidal' }, { angleDeg: 60 }] };
  assert.throws(() => camProfile(uni), e => code('CAM_UNDERCUT')(e) && /velocity steps by -3\.819719 mm\/rad at 120° \(the uniform law's end\)/.test(e.message));
  // A big roller on a small base: the polar formula's least ρ (11.8433) below r_r 15.
  const big = { ...S0, baseRadiusMM: 6, rollerRadiusMM: 15, segments: [{ angleDeg: 60, to: 20, law: 'cycloidal' }, { angleDeg: 60, to: 0, law: 'cycloidal' }, { angleDeg: 240 }] }, M = motion(big.segments);
  let rho = Infinity; for (let i = 0; i < 36000; i++) { const th = TAU * i / 36000, r = 21 + M.s(th), r1 = M.s1(th), r2 = M.s2(th), den = r * r + 2 * r1 * r1 - r * r2; if (den > 0) rho = Math.min(rho, (r * r + r1 * r1) ** 1.5 / den); }
  assert.throws(() => camProfile(big), e => code('CAM_UNDERCUT')(e) && new RegExp(`falls to ${rho.toFixed(4)}\\d* mm at .*r_r 15`).test(e.message), String(rho));
  // A flat face on a fast rise: min(r_b + s + s'') < 0.
  const fast = { baseRadiusMM: 10, follower: 'flat', thicknessMM: 5, segments: [{ angleDeg: 40, to: 12, law: 'cycloidal' }, { angleDeg: 40, to: 0, law: 'cycloidal' }, { angleDeg: 280 }] };
  assert.throws(() => camProfile(fast), e => code('CAM_UNDERCUT')(e) && /ρ = h \+ h_ββ -\d/.test(e.message));
  const bad = (f, re) => assert.throws(() => camProfile({ ...S0, ...f }), e => code('INVALID_INPUT')(e) && re.test(e.message), String(re));
  bad({ segments: [{ angleDeg: 120, to: 8, law: 'cycloidal' }, { angleDeg: 120, to: 0, law: 'cycloidal' }] }, /turn the cam 240°, not 360°/);
  bad({ segments: [{ angleDeg: 180, to: 8, law: 'cycloidal' }, { angleDeg: 180, to: 2, law: 'cycloidal' }] }, /ends at 2, not back at 0/);
  bad({ segments: [{ angleDeg: 180, to: 8 }, { angleDeg: 180, to: 0, law: 'cycloidal' }] }, /segment 1: a motion needs a law/);
  bad({ segments: [{ angleDeg: 180, to: -1, law: 'cycloidal' }, { angleDeg: 180, to: 0, law: 'cycloidal' }] }, /below 0/);
  bad({ offsetMM: 25 }, /past the prime circle/);
  bad({ boreDiameterMM: 40 }, /at most Ø38/);
  bad({ motion: 'oscillating', pivotDistanceMM: 50, armLengthMM: 10 }, /never reaches the prime circle/);
});

test('R12c.6a part model: the `cam` kind placed and turned, its report on the output; refusals with their codes; camMotion reads the law', () => {
  const f = { id: 'k', kind: 'cam', base: 20, roller: 5, follower: 'roller', thickness: 10, bore: 8, center: [30, -5], from: 2, rotation: 90, segments: [{ angle: 120, to: 8, law: 'cycloidal' }, { angle: 60 }, { angle: 120, to: 0, law: 'cycloidal' }, { angle: 60 }] };
  const out = evaluateCadPart(D([f])).output('k');
  assert.equal(out.cam.generator, 'cam@0'); near(out.cam.curvature.leastPitchRadiusMM, 23.690158, 1e-6, 'ρ');
  const V = brepMassProperties(out.brep, 1).volumeMM3, V0 = brepMassProperties(discCam(S0).brep, 1).volumeMM3;
  near(V, V0 - Math.PI * 16 * 10, 1e-3, 'the bore');
  assert.ok(out.brep.faces.some(x => x.name === 'k.bore#1') && out.brep.faces.some(x => x.name === 'k.rise1#1'));
  const refused = (g, c, tag) => assert.throws(() => evaluateCadPart(D([{ ...f, ...g }])), e => (e.details?.category ?? e.code) === c && e.message.includes(`[${tag}]`), tag);
  refused({ roller: 15, base: 6, bore: 0, segments: [{ angle: 60, to: 20, law: 'cycloidal' }, { angle: 60, to: 0, law: 'cycloidal' }, { angle: 240 }] }, 'GEOMETRY', 'CAM_UNDERCUT');
  refused({ segments: [{ angle: 180, to: 8, law: 'cycloidal' }, { angle: 90, to: 0, law: 'cycloidal' }] }, 'INPUT', 'INVALID_INPUT');
  assert.throws(() => evaluateCadPart(D([{ ...f, segments: [{ angle: 360, speed: 2 }] }])), e => (e.details?.category ?? e.code) === 'INPUT' && /speed is not angle, to or law/.test(e.message));
  assert.throws(() => evaluateCadPart(D([{ ...f, generator: 'cam@9' }])), e => (e.details?.category ?? e.code) === 'CAPABILITY');
  const m = camMotion(S0, 60); near(m.s, 4, 1e-12, 'half-rise'); near(m.v, 8 * 2 / (TAU / 3), 1e-12, 'peak velocity at the half');
});
