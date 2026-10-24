import test from 'node:test';
import assert from 'node:assert/strict';
import { throatedWormWheel, checkThroatedWormPair, checkPlacedThroatedPair, checkWormPair, wormWheelSpec, evaluateCadPart, GearError, checkBrep, brepMassProperties, exportStep, importStep, evaluateSurface, surfaceDomain } from '../dist/index.js';

// R12b.6 (D137): the throated wheel of a ZA worm, attempted. Oracles written here, apart from gear-worm-wheel.ts: the
// hob's section in each plane square to the wheel's axis (this file's own carrying of the worm's thread along its
// helices), the wheel's section as that rack's envelope (the normal through the pitch point) by this file's own
// construction; the mid-plane against the closed-form involute of r2 cos α_x; the B-rep's own flank points against the
// worm turning through its pitch — never inside it, touched by it; the volume as the sections' areas integrated along the
// face. K1's axial-module example (KHK, "Calculation of Gear Dimensions", Table 4.23, retrieved 2026-10-20 and re-read
// 2026-10-21: m_x 3, α_n 20°, double thread, z2 30, x 0 — d2 90, a 67, throat Ø96, throat surface radius 19, root Ø82.5).
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (|Δ| ${Math.abs(a - b).toExponential(3)} > ${tol})`);
const AN = 20 * Math.PI / 180, D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const SURVEY = !!process.env.GEAR_SURVEY, inv = a => Math.tan(a) - a;
const wrap = (a, p = 2 * Math.PI) => a - p * Math.round(a / p);
const W = { axialModuleMM: 3, starts: 2, diameterMM: 44, hand: 'right', lengthMM: 60, form: 'ZA' };

/** The pair by this file's formulas: the worm's lead angle and p, its ZA half-thickness ψ(ρ) (the hob's: thickened by j), the wheel's r2, a, the throat and root tori. */
function geom({ m, z1, d1, hand = 'right', z2, b, j = 0 }) {
  const r1 = d1 / 2, gamma = Math.atan(z1 * m / d1), p = z1 * m / 2, ax = Math.atan(Math.tan(AN) / Math.cos(gamma)), r2 = z2 * m / 2, a = r1 + r2;
  const psi = (rho, jj = 0) => (Math.PI * m / 2 + jj) / (2 * p) - (rho - r1) * Math.tan(ax) / p;
  return { m, z1, d1, r1, gamma, p, ax, r2, a, z2, b, j, h: hand === 'right' ? 1 : -1, Rt: a - r2 - m, Rh: r1 + 1.25 * m, ra: r1 + m, rf: r1 - 1.25 * m, psi };
}
/** The hob's section point at plane c on side σ (the worm's point at angle −σψ carried along its helix to the plane): (x, y). */
const rack = (G, s, c, rho) => [(Math.asin(c / rho) + s * G.psi(rho, G.j)) * G.p / G.h, Math.sqrt(rho * rho - c * c) - G.a];
/** Its point generating the wheel: the shift d at which its normal passes the pitch point (0, −r2), the point carried: Rot(−d/r2)(x + d, y). */
function gen(G, s, c, rho) {
  const e = 1e-7, P = rack(G, s, c, rho), Q = rack(G, s, c, rho + e), t = [(Q[0] - P[0]) / e, (Q[1] - P[1]) / e], N = [t[1], -t[0]];
  const d = (P[1] + G.r2) * N[0] / N[1] - P[0], q = -d / G.r2;
  return [Math.cos(q) * (P[0] + d) - Math.sin(q) * P[1], Math.sin(q) * (P[0] + d) + Math.cos(q) * P[1], d];
}
const tipR = (G, c) => G.a - Math.sqrt(G.Rt ** 2 - c * c), rootR = (G, c) => G.a - Math.sqrt(G.Rh ** 2 - c * c);
/** The section of one space's two sides at plane c (pair frame, the cutting pose): each side root → tip, fillet (the crest corner's trochoid) then flank, as points. */
function spaceSides(G, c, F = 800) {
  return [1, -1].map(s => {
    const K = rack(G, s, c, G.Rh), dK = gen(G, s, c, G.Rh)[2], pts = [];
    for (let i = 0; i <= F; i++) { const d = -K[0] + (dK + K[0]) * i / F, q = -d / G.r2; pts.push([Math.cos(q) * (K[0] + d) - Math.sin(q) * K[1], Math.sin(q) * (K[0] + d) + Math.cos(q) * K[1]]); }
    // (The flank up from the corner until its radius reaches the throat's, by bisection on ρ.)
    let lo = Math.max(Math.abs(c) * 1.0001, G.rf * 0.5), hi = G.Rh; const rt = tipR(G, c);
    for (let i = 0; i < 100; i++) { const mm = (lo + hi) / 2, g = gen(G, s, c, mm); if (Math.hypot(g[0], g[1]) > rt) lo = mm; else hi = mm; }
    const rhoTop = (lo + hi) / 2;
    for (let i = 1; i <= F; i++) { const g = gen(G, s, c, G.Rh + (rhoTop - G.Rh) * i / F); pts.push([g[0], g[1]]); }
    return pts;
  });
}
/** The section's area at plane c: ½∮ r² dφ round all its teeth (arcs exactly, the sides by their dense polylines). */
function sectionArea(G, c) {
  const [A, B] = spaceSides(G, c), up = Math.atan2(A[0][1], A[0][0]) > Math.atan2(B[0][1], B[0][0]) ? A : B, lo = up === A ? B : A, step = 2 * Math.PI / G.z2;
  const sideArea = P => { let s = 0; for (let i = 1; i < P.length; i++) s += (P[i - 1][0] * P[i][1] - P[i][0] * P[i - 1][1]) / 2; return s; };
  const ang = q => Math.atan2(q[1], q[0]);
  // One pitch: the root arc from the lower side's bottom to the upper side's, the upper side root → tip, the tip arc to the next space's lower side's top, that side tip → root.
  const rr = rootR(G, c), rt = tipR(G, c), aUp0 = ang(up[0]), aLo0 = ang(lo[0]), aUpT = ang(up[up.length - 1]), aLoT = ang(lo[lo.length - 1]) + step;
  // (The next space's lower side: this one's turned a pitch, run backwards; ½∮ r² dφ of a polyline is ½ Σ (x dy − y dx).)
  return G.z2 * (0.5 * rr * rr * wrap(aUp0 - aLo0) + sideArea(up) + 0.5 * rt * rt * (aLoT - aUpT) - sideArea(lo));
}

test('the throated wheel (refused at the previous HEAD: no throatedWormWheel): valid; K1\'s Table 4.23 wheel — throat Ø96, its surface radius 19, root Ø82.5, a 67, d2 90; tips on the throat torus and roots on the root torus exactly; the mid-plane against the closed-form involute of r2 cos α_x; the fits within the tolerance', t => {
  for (const [c, bore] of [[{ m: 3, z1: 2, d1: 44, z2: 30, b: 20 }, 20], ...(SURVEY ? [[{ m: 2, z1: 1, d1: 32, z2: 40, b: 16, hand: 'left' }, 0], [{ m: 2.5, z1: 3, d1: 30, z2: 45, b: 14 }, 12]] : [])]) {
    const G = geom(c), spec = { worm: { axialModuleMM: c.m, starts: c.z1, diameterMM: c.d1, hand: c.hand ?? 'right', lengthMM: 1, form: 'ZA' }, teeth: c.z2, faceWidthMM: c.b, ...(bore ? { boreDiameterMM: bore } : {}) };
    const t0 = performance.now(), { brep, report } = throatedWormWheel(spec, { id: 'w' }), ms = performance.now() - t0, dm = report.dimensions, tol = 1e-4 * c.m * Math.cos(G.gamma);
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues?.[0]); assert.equal(brep.bodies.length, 1); assert.equal(report.kind, 'throated');
    if (c.m === 3) { close(dm.throatDiameterMM, 96, 1e-12, "K1's throat Ø"); close(dm.throatRadiusMM, 19, 1e-12, "K1's throat surface radius"); close(dm.rootDiameterMM, 82.5, 1e-12, "K1's root Ø"); close(dm.centerDistanceMM, 67, 1e-12, "K1's a"); close(dm.referenceDiameterMM, 90, 0, "K1's d2"); }
    assert.ok(report.flank.deviationMM <= tol && report.fillet.deviationMM <= tol, JSON.stringify(report.flank));
    // Tips on the throat torus, roots on the root torus (their own surfaces): (r − a)² + (z − b/2)² = R².
    let torus = 0, mid = 0, nMid = 0;
    const rb = G.r2 * Math.cos(G.ax), psiW = (Math.PI * c.m / 2) / (2 * G.r2) + inv(G.ax);
    for (const f of brep.faces) {
      const name = f.name.slice(2).replace(/\.\d+$/, ''), base = name.split('#')[0], tooth = Number(name.split('#')[1]), { u, v } = surfaceDomain(f.surface);
      if (base === 'tip' || base === 'root') for (let i = 0; i <= 6; i++) for (let k = 0; k <= 4; k++) {
        const q = evaluateSurface(f.surface, u[0] + (u[1] - u[0]) * i / 6, v[0] + (v[1] - v[0]) * k / 4), r = Math.hypot(q[0], q[1]);
        torus = Math.max(torus, Math.abs(Math.hypot(r - G.a, q[2] - c.b / 2) - (base === 'tip' ? G.Rt : G.Rh)));
      }
      // The mid-plane: on a flank face whose z range holds b/2 (z linear along v), its points against the involute — tooth k's left flank at γ_k − ψ_w + inv α(r), its right at γ_k + ψ_w − inv α(r) — ψ_w the hob's space π m/2 over 2 r2 plus inv α_x.
      if (/^flank[LR]\d?$/.test(base)) {
        const z0 = evaluateSurface(f.surface, u[0], v[0])[2], z1 = evaluateSurface(f.surface, u[0], v[1])[2];
        if (!(z0 <= c.b / 2 && c.b / 2 <= z1)) continue;
        const vv = v[0] + (v[1] - v[0]) * (c.b / 2 - z0) / (z1 - z0), gam = 2 * Math.PI * (tooth - 1) / c.z2;
        for (let i = 0; i <= 20; i++) {
          const q = evaluateSurface(f.surface, u[0] + (u[1] - u[0]) * i / 20, vv), r = Math.hypot(q[0], q[1]);
          if (r < rb * 1.0001) continue;
          const want = base.startsWith('flankL') ? gam - psiW + inv(Math.acos(rb / r)) : gam + psiW - inv(Math.acos(rb / r));
          // (Only the involute: above the crest corner's point, where the fillet ends.)
          const corner = gen(G, 1, 0, G.Rh); if (r < Math.hypot(corner[0], corner[1]) + 1e-6) continue;
          mid = Math.max(mid, Math.abs(wrap(Math.atan2(q[1], q[0]) - want)) * r); nMid++;
        }
      }
    }
    assert.ok(torus <= 1e-9, `tori ${torus}`); assert.ok(nMid > 20 && mid <= report.flank.deviationMM * 1.001 + 1e-9, `mid-plane involute ${mid} (${nMid} points) vs fit ${report.flank.deviationMM}`);
    t.diagnostic(`m_x ${c.m} z1 ${c.z1} d1 ${c.d1} z2 ${c.z2} b ${c.b}: throat Ø${dm.throatDiameterMM}, R_t ${dm.throatRadiusMM}, root Ø${dm.rootDiameterMM}; flank ${report.flank.piecesAcross} × ${report.flank.piecesAlong} pieces on ${report.flank.faces} faces within ${report.flank.deviationMM.toExponential(2)}, fillet ${report.fillet.piecesAcross} × ${report.fillet.piecesAlong} within ${report.fillet.deviationMM.toExponential(2)} (tolerance ${tol.toExponential(2)}); mid-plane involute ${mid.toExponential(2)}; ${brep.faces.length} faces, ${ms.toFixed(0)} ms`);
  }
});

test('enveloping: the B-rep\'s own flank points, the worm turning through tooth 1\'s engagement — never inside the worm\'s thread (by more than 1e-4 m), and each touched by it (within the fits): on the mid-plane and off it', t => {
  const G = geom({ m: 3, z1: 2, d1: 44, z2: 30, b: 20 }), { brep, report } = throatedWormWheel({ worm: W, teeth: 30, faceWidthMM: 20 }, { id: 'w' });
  const om = Math.PI / 2 + Math.PI / 30, fit = report.flank.deviationMM;
  // A wheel point (its frame) as the worm's: the pair's frame at the cutting pose turned Δ = −h θ z1/z2; the worm turned θ.
  const margin = (q, th) => {
    const D = -G.h * th * G.z1 / G.z2 - om, x = Math.cos(D) * q[0] - Math.sin(D) * q[1], y = Math.sin(D) * q[0] + Math.cos(D) * q[1], c = q[2] - G.b / 2;
    const rho = Math.hypot(y + G.a, c), phi = Math.atan2(c, y + G.a), rel = wrap(phi - (th + G.h * x / G.p), 2 * Math.PI / G.z1);
    // (Inside by the angle ψ − |rel| at its radius: the thread lies that far along the axis, (ψ − |rel|) p — no nearer along its normal.)
    return rho > G.ra ? -1 : (G.psi(rho) - Math.abs(rel)) * G.p;
  };
  let deepest = -Infinity, farthest = 0, n = 0;
  for (const f of brep.faces.filter(f => /^w\.flank[LR]\d?#1(\.\d+)?$/.test(f.name))) {
    const { u, v } = surfaceDomain(f.surface);
    for (let i = 1; i < 10; i++) for (let k = 0; k <= 4; k++) {
      const q = evaluateSurface(f.surface, u[0] + (u[1] - u[0]) * i / 10, v[0] + (v[1] - v[0]) * k / 4);
      // (Below where the worm's own crest reaches — the hob's 0.25 m_x of clearance cut it — no worm point comes: those are left out.)
      const g1 = gen(G, 1, q[2] - G.b / 2, G.ra), g2 = gen(G, -1, q[2] - G.b / 2, G.ra); if (Math.hypot(q[0], q[1]) < Math.max(Math.hypot(g1[0], g1[1]), Math.hypot(g2[0], g2[1])) + 1e-3) continue;
      // The worm's most-inside over tooth 1's whole engagement — eight pitches of the worm about the cutting pose (the
      // wheel through eight of its own): 2880 samples, then golden section about the best.
      const per = 2 * Math.PI / G.z1, N = 2880; let best = -Infinity, bt = 0;
      for (let s = 0; s < N; s++) { const th = per * (8 * s / N - 4), mm = margin(q, th); if (mm > best) { best = mm; bt = th; } }
      let lo = bt - 8 * per / N, hi = bt + 8 * per / N;
      for (let it = 0; it < 60; it++) { const a1 = lo + (hi - lo) * 0.382, a2 = lo + (hi - lo) * 0.618; if (margin(q, a1) > margin(q, a2)) hi = a2; else lo = a1; }
      best = Math.max(best, margin(q, (lo + hi) / 2));
      deepest = Math.max(deepest, best); farthest = Math.max(farthest, -best); n++;
    }
  }
  assert.ok(n >= 100, String(n));
  // (The axial margin bounds the depth from above: inside by no more than it.)
  assert.ok(deepest <= 1e-4 * G.m, `the worm's thread enters the wheel's flank by ${deepest} mm`);
  assert.ok(farthest <= 2 * fit + 1e-6, `a flank point the worm never reaches: ${farthest} mm away at the nearest (fit ${fit})`);
  t.diagnostic(`${n} flank points of tooth 1 (both sides, every segment): the worm at most ${deepest.toExponential(2)} mm into them, each within ${farthest.toExponential(2)} mm of its thread at contact (fit ${fit.toExponential(2)})`);
});

test('refusals: a ZI worm, too few teeth, a face past the throat\'s reach, a bore; a tolerance the budget cannot hold refused with the measured distance (the cylindrical wheel stays)', () => {
  const base = { worm: W, teeth: 30, faceWidthMM: 20 };
  const code = (spec, c, re) => assert.throws(() => throatedWormWheel({ ...base, ...spec }), e => e instanceof GearError && e.code === c && (!re || re.test(e.message)), `${JSON.stringify(spec)} → ${c}`);
  code({ worm: { ...W, form: 'ZI' } }, 'UNSUPPORTED_GEAR_KIND', /ZI worm/); code({ teeth: 17 }, 'INVALID_INPUT'); code({ faceWidthMM: 31 }, 'INVALID_INPUT', /1\.6 R_t = 30\.400/); code({ boreDiameterMM: 80 }, 'BORE_INTERSECTION');
  code({ profileToleranceMM: 1e-7 }, 'UNSUPPORTED_GEAR_KIND', /throated wheel: its generated flank fits within \d\.\d\de-\d+ mm at the budget \(15 × \d+ bicubic pieces; at most 15 across and 20 along\), not 1\.00e-7 mm — the cylindrical wheel stays/);
  assert.throws(() => checkThroatedWormPair({ ...W, diameterMM: 40 }, base), e => e.code === 'MATE_INCOMPATIBLE');
});

test('the pair: K1\'s ZA worm and its throated wheel — with the worm 0.1 mm thinner every plane clear by about j cos α_x / 2, at none touching on every plane (the cylindrical wheel stands 0.266 mm off at ±b/3), a phase off crossing', t => {
  const G = geom({ m: 3, z1: 2, d1: 44, z2: 30, b: 20 }), wh = { worm: W, teeth: 30, faceWidthMM: 20 };
  const thin = checkThroatedWormPair({ ...W, toothThicknessReductionMM: 0.1 }, wh), none = checkThroatedWormPair(W, wh), want = 0.1 * Math.cos(G.ax) / 2;
  close(thin.centerDistanceMM, 67, 1e-12, 'a'); close(thin.speedRatio, 15, 0, 'ratio'); assert.equal(thin.interference, false); assert.equal(none.interference, false);
  // (Off the mid-plane the normal there leans from the plane: the clearance in it falls a little, 1%.)
  for (const p of thin.planes) assert.ok(p.minimumClearanceMM <= want + 1e-4 && p.minimumClearanceMM >= 0.98 * want, `plane ${p.offsetMM}: ${p.minimumClearanceMM} vs ${want}`);
  close(thin.planes[0].minimumClearanceMM, want, 1e-5, 'mid-plane j cos α_x / 2');
  for (const p of none.planes) assert.ok(p.minimumClearanceMM <= none.touchMM, `plane ${p.offsetMM}: ${p.minimumClearanceMM} — touching`);
  const cyl = checkWormPair({ ...W, toothThicknessReductionMM: 0.05 }, wormWheelSpec(W, { teeth: 30, faceWidthMM: 20, toothThicknessReductionMM: 0.05 }));
  assert.ok(cyl.planes[1].minimumClearanceMM > 5 * want, 'the cylindrical wheel stands off the worm away from its mid-plane');
  assert.equal(checkThroatedWormPair(W, wh, { relativePhaseDeg: 20, mode: 'verdict' }).interference, true);
  t.diagnostic(`thinned 0.1: planes ${thin.planes.map(p => `${p.offsetMM.toFixed(2)} ${p.minimumClearanceMM.toFixed(6)}`).join(', ')} (j cos α_x/2 ${want.toFixed(6)}); none: ${none.planes.map(p => p.minimumClearanceMM.toExponential(1)).join(', ')} (touch ${none.touchMM.toExponential(1)}); the cylindrical wheel ±b/3 ${cyl.planes[1].minimumClearanceMM.toFixed(4)}`);
});

test('the part model: a worm-wheel (throated) and its worm by mesh — m_x, d1 and hand from the wheel, square at 67 mm in its mid-plane, the placed check clear; the volume as the sections\' areas along the face; STEP (survey)', t => {
  const G = geom({ m: 3, z1: 2, d1: 44, z2: 30, b: 20 }), feats = (rot, dir, phase = 0) => [
    { id: 'g', kind: 'worm-wheel', worm: { axialModule: 3, starts: 2, diameter: 44, hand: 'right' }, teeth: 30, faceWidth: 20, bore: 20, center: [10, 5], from: 2, rotation: rot },
    { id: 'w', kind: 'worm', starts: 2, length: 60, form: 'ZA', thicknessReduction: 0.05, mesh: { gear: 'g', direction: dir, phase } }];
  for (const [rot, dir] of SURVEY ? [[0, -90], [5, 30], [-7, 200]] : [[5, 30]]) {
    const M = evaluateCadPart(D(feats(rot, dir))), g = M.output('g'), w = M.output('w'), pw = w.wormPlacement;
    close(pw.spec.axialModuleMM, 3, 0, 'm_x'); close(pw.spec.diameterMM, 44, 0, 'd1'); assert.equal(pw.spec.hand, 'right');
    const mid = pw.origin.map((x, i) => x + pw.axis[i] * 30); close(Math.hypot(mid[0] - 10, mid[1] - 5), 67, 1e-9, 'a'); close(mid[2], 12, 1e-12, 'mid-plane'); close(pw.axis[2], 0, 1e-15, 'square');
    assert.equal(g.validate().valid, true); assert.equal(w.validate().valid, true);
    assert.ok(g.wormWheel && g.wormWheelPlacement);
    const chk = checkPlacedThroatedPair(g.wormWheelPlacement, pw, { mode: 'verdict', samples: 8 }); assert.equal(chk.relativePhaseDeg, 0); assert.equal(chk.interference, false);
  }
  // The volume: (∫ the section's area along the face, Simpson over 10 planes, this file's sections) less the bore.
  const n = 10, h = 20 / n; let I = 0;
  for (let k = 0; k <= n; k++) I += (k === 0 || k === n ? 1 : k % 2 ? 4 : 2) * sectionArea(G, -10 + h * k);
  const want = I * h / 3 - Math.PI * 100 * 20, got = brepMassProperties(evaluateCadPart(D(feats(0, 0))).output('g').brep, 1).volumeMM3;
  close(got, want, 2e-5 * want, 'volume');
  assert.throws(() => evaluateCadPart(D([feats(0, 0)[0], { ...feats(0, 0)[1], form: 'ZI' }])).output('w'), e => (e.details?.category ?? e.code) === 'INPUT' && /MATE_INCOMPATIBLE/.test(e.message));
  // STEP (the survey: writing it takes about 15 s — its tessellated copy of 724 curved faces, D137).
  if (SURVEY) {
    const { brep } = throatedWormWheel({ worm: W, teeth: 30, faceWidthMM: 20, boreDiameterMM: 20 }, { id: 's' }), back = importStep(exportStep([brep], { name: 'wheel' }));
    close(brepMassProperties(back, 1).volumeMM3, brepMassProperties(brep, 1).volumeMM3, 1e-6 * brepMassProperties(brep, 1).volumeMM3, 'round trip'); assert.ok(back.faces.some(f => f.name === 's.tip#1')); assert.equal(checkBrep(back).valid, true);
  }
  t.diagnostic(`volume ${got.toFixed(3)} vs ${want.toFixed(3)} (${((got - want) / want).toExponential(2)})`);
});
