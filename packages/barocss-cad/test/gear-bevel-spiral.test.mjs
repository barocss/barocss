import test from 'node:test';
import assert from 'node:assert/strict';
import { bevelGear, bevelGearDimensions, checkBevelGearPair, checkPlacedBevelGears, evaluateCadPart, isGearError, checkBrep, brepMassProperties, exportStep, importStep, evaluateSurface, surfaceDomain, outputOf } from '../dist/index.js';

// R12b.4 (D135): spiral bevel gears, the ideal conjugate — flagged as an ideal model. Oracles written here, apart from
// gear-bevel.ts: the circular tooth trace built on the crown plane (the cutter's circle through the mean point at the
// spiral angle, its point at each cone distance by bisection along the circle), its spiral angles; the section's
// spherical involute of the transverse pressure angle by this file's own formulas; the B-rep's own surfaces sampled
// against the section turned by ±ψ(R)/sin δ; the volume by the section's area on the unit sphere (a turn keeps it on
// every sphere) times (Re³ − Ri³)/3; the transverse contact ratio by the great circle of action in space; the pair's
// B-reps as placed, cut by spheres about their apex (sections built here from the faces' own surfaces), clear by the
// backlash at every sphere and turn; the thrust by the B-rep's own flank normal. K1's spiral-bevel example's
// system-independent numbers (KHK, "Calculation of Gear Dimensions", §4.4, retrieved 2026-10-20: m 3, z 20/40, Σ 90°,
// β_m 35°, α_n 20°: α_t 23.95680°, R 67.08204, b 20, Rm 57.08204).
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (|Δ| ${Math.abs(a - b).toExponential(3)} > ${tol})`);
const ALPHA = 20 * Math.PI / 180, D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const SURVEY = !!process.env.GEAR_SURVEY, deg = x => x * 180 / Math.PI, rad = x => x * Math.PI / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norm = a => Math.hypot(a[0], a[1], a[2]), sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const wrap = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

function sphInvolute(db, t) {
  const sb = Math.sin(db), cb = Math.cos(db), s = t * sb, cs = Math.cos(s), ss = Math.sin(s);
  const T = [sb * Math.cos(t), sb * Math.sin(t), cb], e = [-Math.sin(t), Math.cos(t), 0];
  return [cs * T[0] - ss * e[0], cs * T[1] - ss * e[1], cs * T[2] - ss * e[2]];
}
const sphRoll = (db, th) => Math.acos(Math.min(1, Math.cos(th) / Math.cos(db))) / Math.sin(db);
const Aof = (db, th) => { const p = sphInvolute(db, sphRoll(db, th)); return Math.atan2(p[1], p[0]); };
const fromPolar = (th, az) => [Math.sin(th) * Math.cos(az), Math.sin(th) * Math.sin(az), Math.cos(th)];

/**
 * The tooth trace here, on the crown plane: M = (Rm, 0), its tangent (cos β, sin β), the cutter's centre C = M + r_c(−sin
 * β, cos β); at cone distance R the circle's point by
 * bisection on the circle's angle from M (|P| grows along the tangent), ψ its polar angle, β(R) the angle of its tangent
 * to the radius. (The centre's side: the one the trace turns toward, q² = Rm² + r_c² − 2 Rm r_c sin β.)
 */
function traceHere(Rm, beta, rc, span) {
  const C = [Rm - rc * Math.sin(beta), rc * Math.cos(beta)], wM = Math.atan2(-Math.cos(beta), Math.sin(beta)), P = w => [C[0] + rc * Math.cos(w), C[1] + rc * Math.sin(w)];
  const at = R => {
    let lo = wM - span / rc, hi = wM + span / rc;
    for (let i = 0; i < 200; i++) { const w = (lo + hi) / 2; if (Math.hypot(...P(w)) < R) lo = w; else hi = w; }
    const w = (lo + hi) / 2, p = P(w), t = [-Math.sin(w), Math.cos(w)], r = Math.hypot(...p);
    return { psi: Math.atan2(p[1], p[0]), beta: Math.acos(Math.abs((t[0] * p[0] + t[1] * p[1]) / r)) };
  };
  return at;
}
function geom({ m, z, zm, S = 90, b, red = 0, bore = 0, beta = 0, hand = 'right', rc = 0 }) {
  const Sg = rad(S), delta = Math.atan2(Math.sin(Sg), zm / z + Math.cos(Sg)), Re = m * z / (2 * Math.sin(delta)), alpha = beta ? Math.atan(Math.tan(ALPHA) / Math.cos(rad(beta))) : ALPHA;
  const db = Math.asin(Math.sin(delta) * Math.cos(alpha)), tip = delta + Math.atan(m / Re), root = delta - Math.atan(1.25 * m / Re);
  const psi = (Math.PI * m / 2 - red) / (m * z) + Aof(db, delta), Ri = Re - b, Rm = (Re + Ri) / 2;
  const tr = beta ? traceHere(Rm, rad(beta), rc, b) : null, h = hand === 'right' ? 1 : -1;
  return { m, z, zm, S, Sg, delta, Re, Ri, Rm, db, tip, root, psi, alpha, start: Math.max(db, root), step: 2 * Math.PI / z, bore: bore / 2, tr, phi: R => tr ? h * tr(R).psi / Math.sin(delta) : 0 };
}
function toothPoints(G, gam, F) {
  const out = [], t0 = sphRoll(G.db, G.start), t1 = sphRoll(G.db, G.tip), A0 = G.start > G.db ? Aof(G.db, G.start) : 0, At = Aof(G.db, G.tip);
  out.push(fromPolar(G.root, gam - G.step / 2), fromPolar(G.root, gam - G.psi + A0));
  for (let i = 0; i <= F; i++) { const p = sphInvolute(G.db, t0 + (t1 - t0) * i / F), az = Math.atan2(p[1], p[0]); out.push(fromPolar(Math.acos(p[2]), gam - G.psi + az)); }
  for (let i = 1; i < 16; i++) out.push(fromPolar(G.tip, gam - (G.psi - At) + 2 * (G.psi - At) * i / 16));
  for (let i = F; i >= 0; i--) { const p = sphInvolute(G.db, t0 + (t1 - t0) * i / F), az = Math.atan2(p[1], p[0]); out.push(fromPolar(Math.acos(p[2]), gam + G.psi - az)); }
  out.push(fromPolar(G.root, gam + G.psi - A0), fromPolar(G.root, gam + G.step / 2));
  return out;
}
/** The section's area on the unit sphere (∮ (1 − cos θ) dφ) and its perimeter. */
function sectionArea(G) {
  let I = 0, L = 0;
  for (let k = 0; k < G.z; k++) {
    const P = toothPoints(G, G.step * k, 20000);
    for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; I += (1 - (a[2] + b[2]) / 2) * wrap(Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0])); L += norm(sub(a, b)); }
  }
  return { I, L };
}
const specOf = c => ({ moduleMM: c.m, teeth: c.z, mateTeeth: c.zm, ...(c.S ? { shaftAngleDeg: c.S } : {}), faceWidthMM: c.b, ...(c.bore ? { boreDiameterMM: c.bore } : {}), ...(c.red ? { toothThicknessReductionMM: c.red } : {}), spiral: { angleDeg: c.beta, hand: c.hand, cutterRadiusMM: c.rc } });

const CASES = [
  { m: 3, z: 20, zm: 40, b: 20, bore: 10, beta: 35, hand: 'left', rc: 60 },
  { m: 3, z: 40, zm: 20, b: 20, bore: 20, beta: 35, hand: 'right', rc: 60 },
  { m: 2, z: 16, zm: 24, S: 60, b: 8, beta: 25, hand: 'left', rc: 30 },
  ...(SURVEY ? [{ m: 2, z: 20, zm: 40, b: 10, beta: 30, hand: 'right', rc: 40 }, { m: 2, z: 13, zm: 13, b: 5, beta: 40, hand: 'right', rc: 25 }, { m: 2, z: 18, zm: 30, S: 120, b: 8, beta: 20, hand: 'left', rc: 50 }, { m: 1.5, z: 30, zm: 45, b: 12, beta: 45, hand: 'left', rc: 80 }] : []),
];

test('the spiral bevel gear (refused at the previous HEAD: no spiral), the ideal conjugate, flagged so: valid; K1\'s example; the trace built here (spiral angles, the twist); the B-rep\'s own surfaces against the section turned by ±ψ(R)/sin δ, within the fits; its hand; the volume a turn keeps', t => {
  for (const c of CASES) {
    const G = geom(c), t0 = performance.now(), { brep, report } = bevelGear(specOf(c), { id: 'g' }), ms = performance.now() - t0, sp = report.spiral;
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues?.[0]); assert.equal(brep.bodies.length, 1);
    assert.equal(report.kind, 'spiral'); assert.equal(report.idealModel, true);
    const ideal = report.diagnostics.find(d => d.code === 'IDEAL_MODEL');
    assert.ok(ideal && ideal.severity === 'warning' && /ideal spiral bevel gear \(line contact\)/.test(ideal.message) && /not a face-milled or face-hobbed tooth — no crowning, no machine settings/.test(ideal.message), JSON.stringify(report.diagnostics));
    close(sp.transversePressureAngleDeg, deg(G.alpha), 1e-12, 'α_t'); close(report.dimensions.baseConeAngleDeg, deg(G.db), 1e-12, 'δb of α_t');
    if (c.m === 3 && c.z === 20) { close(sp.transversePressureAngleDeg, 23.95680, 5e-6, "K1's α_t"); close(report.dimensions.coneDistanceMM, 67.08204, 5e-6, "K1's R"); close(sp.meanConeDistanceMM, 57.08204, 5e-6, "K1's Rm"); }
    // The trace: its spiral angles, the twist from the toe to the heel; ψ' = tan β / R, by a difference here.
    close(sp.spiralAngleAtToeDeg, deg(G.tr(G.Ri).beta), 1e-9, 'β at the toe'); close(sp.spiralAngleAtHeelDeg, deg(G.tr(G.Re).beta), 1e-9, 'β at the heel'); close(G.tr(G.Rm).beta, rad(c.beta), 1e-12, 'β_m');
    close(sp.twistDeg, deg(G.phi(G.Re) - G.phi(G.Ri)), 1e-9, 'twist');
    const dR = 1e-4; close((G.tr(G.Rm + dR).psi - G.tr(G.Rm - dR).psi) / (2 * dR), Math.tan(rad(c.beta)) / G.Rm, 1e-7, "ψ' = tan β / R");
    // Every face sampled: flanks against the involute turned by φ(R); tips, roots and ends; the level radii at the segments' ends.
    const S = sp.axialSegments, tw = sp.twistDeviationMM, fit = report.profileDeviationMM + tw;
    let worst = 0, cone = 0;
    for (const f of brep.faces) {
      const name = f.name.slice(2), seg = /\.(\d+)$/.test(name) ? Number(name.match(/\.(\d+)$/)[1]) - 1 : 0, base = name.replace(/\.\d+$/, ''), tooth = Number(base.split('#')[1]), gam = G.step * (tooth - 1), { u, v } = surfaceDomain(f.surface);
      for (let i = 0; i <= 12; i++) for (const j of [0, 0.25, 0.5, 0.75, 1]) {
        const p = evaluateSurface(f.surface, u[0] + (u[1] - u[0]) * i / 12, v[0] + (v[1] - v[0]) * j), R = norm(p), th = Math.acos(p[2] / R), az = Math.atan2(p[1], p[0]);
        if (/^(flank|tip|root)/.test(base) && (j === 0 || j === 1)) close(R, G.Ri + c.b * (seg + j) / S, 1e-9 * G.Re, `${name} at its level`);
        if (/^flank/.test(base)) {
          const want = (/^flankL/.test(base) ? gam - G.psi + Aof(G.db, th) : gam + G.psi - Aof(G.db, th)) + G.phi(R);
          worst = Math.max(worst, Math.abs(wrap(az - want)) * Math.sin(th) * R);
        } else if (/^tip/.test(base)) cone = Math.max(cone, Math.abs(th - G.tip) * R);
        else if (/^root#/.test(base)) cone = Math.max(cone, Math.abs(th - G.root) * R);
        else if (base === 'heel') close(R, G.Re, 1e-12 * G.Re, 'heel'); else if (base === 'toe') close(R, G.Ri, 1e-12 * G.Re, 'toe');
      }
    }
    assert.ok(worst <= fit * 1.001 + 1e-12, `flanks ${worst} vs fits ${fit}`); assert.ok(fit <= 1e-4 * c.m + 1e-15 && tw <= 0.25e-4 * c.m + 1e-15);
    assert.ok(cone <= tw * 1.001 + 1e-12, `tips and roots ${cone} off their cones vs the twist's ${tw}`);
    // Its hand: seen from the apex along +Z (azimuth growing is clockwise so seen), a right-hand tooth turns clockwise toward the heel.
    const fl = brep.faces.find(f => f.name === 'g.flankL#1'), { u, v } = surfaceDomain(fl.surface), toe = evaluateSurface(fl.surface, (u[0] + u[1]) / 2, v[0]), last = brep.faces.find(f => f.name === (S > 1 ? `g.flankL#1.${S}` : 'g.flankL#1')), heel = evaluateSurface(last.surface, (u[0] + u[1]) / 2, surfaceDomain(last.surface).v[1]);
    assert.equal(Math.sign(wrap(Math.atan2(heel[1], heel[0]) - Math.atan2(toe[1], toe[0]))), c.hand === 'right' ? 1 : -1, `${c.hand} hand`);
    // The volume: every sphere's section is the straight one turned, so its area is kept: (Re³ − Ri³)/3 × Ω, less the bore, within the fits (perimeter × b × their distance).
    const { I, L } = sectionArea(G), b2 = G.bore, want = I * (G.Re ** 3 - G.Ri ** 3) / 3 - (b2 > 0 ? 2 * Math.PI / 3 * ((G.Re ** 3 - (G.Re ** 2 - b2 ** 2) ** 1.5) - (G.Ri ** 3 - (G.Ri ** 2 - b2 ** 2) ** 1.5)) : 0), got = brepMassProperties(brep, 1).volume;
    close(got, want, L * G.Re * c.b * fit + 1e-7 * want, `z${c.z}/${c.zm} volume`);
    t.diagnostic(`m${c.m} z${c.z}/${c.zm} Σ${c.S ?? 90}° β_m ${c.beta}° ${c.hand} r_c ${c.rc}: β ${sp.spiralAngleAtToeDeg.toFixed(3)}°…${sp.spiralAngleAtHeelDeg.toFixed(3)}°, α_t ${sp.transversePressureAngleDeg.toFixed(5)}° (α_n ${sp.normalPressureAngleAtToeDeg.toFixed(3)}°…${sp.normalPressureAngleAtHeelDeg.toFixed(3)}°), twist ${sp.twistDeg.toFixed(4)}° in ${sp.twistPieces} piece(s) / ${S} segment(s) within ${tw.toExponential(2)}, section ${report.flankPieces} conic(s) ${report.profileDeviationMM.toExponential(2)}; sampled ${worst.toExponential(2)}; V ${got.toFixed(4)} vs ${want.toFixed(4)} (${((got - want) / want).toExponential(2)}), ${brep.faces.length} faces, ${ms.toFixed(1)} ms`);
  }
});

test('refusals: a face-hobbed trace, a hypoid offset, the spiral angle, the hand, a cutter radius the face cannot take; a pair of one hand, of other spirals or face widths, or spiral with straight', () => {
  const base = { moduleMM: 3, teeth: 20, mateTeeth: 40, faceWidthMM: 20 }, sp = { angleDeg: 35, hand: 'left', cutterRadiusMM: 60 };
  const code = (spec, c, re) => assert.throws(() => bevelGear({ ...base, ...spec }), e => isGearError(e) && e.code === c && (!re || re.test(e.message)), `${JSON.stringify(spec)} → ${c}`);
  code({ spiral: { ...sp, trace: 'epicycloidal' } }, 'UNSUPPORTED_GEAR_KIND', /face-hobbed/); code({ spiral: sp, offsetMM: 5 }, 'UNSUPPORTED_GEAR_KIND', /hypoid/);
  code({ spiral: { ...sp, angleDeg: 50 } }, 'INVALID_INPUT', /45°/); code({ spiral: { ...sp, angleDeg: 0 } }, 'INVALID_INPUT'); code({ spiral: { ...sp, hand: 'up' } }, 'INVALID_INPUT', /hand/);
  code({ spiral: { ...sp, cutterRadiusMM: 5 } }, 'INVALID_INPUT', /cutter radius of 5 mm takes the spiral angle to 0° or past it/); code({ spiral: { ...sp, cutterRadiusMM: 0 } }, 'INVALID_INPUT');
  const g = { ...base, spiral: sp }, h = { ...base, teeth: 40, mateTeeth: 20, spiral: { ...sp, hand: 'right' } };
  for (const [a, b2, re] of [[g, { ...h, spiral: { ...h.spiral, hand: 'left' } }, /opposite hands/], [g, { ...h, spiral: { ...h.spiral, angleDeg: 30 } }, /share/], [g, { ...h, spiral: { ...h.spiral, cutterRadiusMM: 70 } }, /share/], [g, { ...h, faceWidthMM: 18 }, /face widths/], [g, { ...h, spiral: undefined }, /straight/]])
    assert.throws(() => checkBevelGearPair(a, b2, { mode: 'verdict' }), e => e.code === 'MATE_INCOMPATIBLE' && re.test(e.message), JSON.stringify(b2.spiral));
});

test('the pair: five spheres from the toe to the heel, each clear by its backlash j R/Re cos α_t / 2 (within the reported sag), a phase off crossing; the transverse contact ratio by the great circle of action built here, the face contact ratio by the trace here; the thrust by the B-rep\'s own flank normal', t => {
  for (const [c1, c2, j] of [[{ m: 3, z: 20, zm: 40, b: 20, beta: 35, hand: 'left', rc: 60 }, { m: 3, z: 40, zm: 20, b: 20, beta: 35, hand: 'right', rc: 60 }, 0.1], ...(SURVEY ? [[{ m: 2, z: 16, zm: 24, S: 60, b: 8, beta: 25, hand: 'right', rc: 30 }, { m: 2, z: 24, zm: 16, S: 60, b: 8, beta: 25, hand: 'left', rc: 30 }, 2e-4]] : [])]) {
    const s1 = { ...c1, red: j / 2 }, s2 = { ...c2, red: j / 2 }, G1 = geom(s1), G2 = geom(s2), t0 = performance.now(), chk = checkBevelGearPair(specOf(s1), specOf(s2)), ms = performance.now() - t0;
    assert.equal(chk.spheres.length, 5); assert.equal(chk.sweep.interference, false);
    for (const sph of chk.spheres) {
      const want = j * sph.coneDistanceMM / G1.Re * Math.cos(G1.alpha) / 2;
      assert.ok(!sph.interference && sph.minimumClearanceMM >= want - 1e-9 && sph.minimumClearanceMM <= want + chk.sweep.chordSagMM * sph.coneDistanceMM / G1.Re + 1e-9, `sphere ${sph.coneDistanceMM}: ${sph.minimumClearanceMM} vs ${want}`);
    }
    const off = checkBevelGearPair(specOf(s1), specOf(s2), { relativePhaseDeg: 360 / c2.z / 3, mode: 'verdict' });
    assert.equal(off.sweep.interference, true);
    // ε_α: the great circle of action through P (gear 1's frame), cut by both tip cones; ε_β: Δψ over the crown pitch, by the trace here.
    const P = [Math.sin(G1.delta), 0, Math.cos(G1.delta)], eTh = [Math.cos(G1.delta), 0, -Math.sin(G1.delta)], d = [-Math.sin(G1.alpha) * eTh[0], Math.cos(G1.alpha), -Math.sin(G1.alpha) * eTh[2]];
    const C = s => [Math.cos(s) * P[0] + Math.sin(s) * d[0], Math.cos(s) * P[1] + Math.sin(s) * d[1], Math.cos(s) * P[2] + Math.sin(s) * d[2]], ax2 = [Math.sin(G1.Sg), 0, Math.cos(G1.Sg)];
    const cut = (f, target) => { let a = 0, b = 0.5; for (let i = 0; i < 200; i++) { const s = (a + b) / 2; if (f(s) < target) a = s; else b = s; } return (a + b) / 2; };
    const sA = cut(s => Math.acos(dot(C(s), ax2)), G2.tip), sB = -cut(s => Math.acos(C(-s)[2]), G1.tip), pb = 2 * Math.PI * Math.sin(G1.db) / c1.z;
    close(chk.idealContactRatio, (sA - sB) / pb, 1e-9, 'ε_α'); close(chk.faceContactRatio, Math.abs(G1.tr(G1.Re).psi - G1.tr(G1.Ri).psi) / (2 * Math.PI * Math.sin(G1.delta) / c1.z), 1e-9, 'ε_β'); close(chk.totalContactRatio, chk.usableContactRatio + chk.faceContactRatio, 1e-12, 'ε_γ');
    // The thrust on gear 1 driving clockwise seen from its apex: −n on its flankR#1 at the pitch cone and the mean cone distance, n from the B-rep's own surface.
    const { brep } = bevelGear(specOf(s1), { id: 'p' }), fr = brep.faces.find(f => f.name === 'p.flankR#1' || (f.name.startsWith('p.flankR') && f.name.endsWith('#1')));
    const faces = brep.faces.filter(f => /^p\.flankR\d?#1(\.\d+)?$/.test(f.name));
    let hit = null;
    for (const f of faces) {
      const { u, v } = surfaceDomain(f.surface), F = (a, b) => evaluateSurface(f.surface, a, b);
      // (u, v) where |p| = Rm and the polar angle is δ: Newton on the two from the middle.
      let a = (u[0] + u[1]) / 2, b = (v[0] + v[1]) / 2 - 1e-7;
      for (let it = 0; it < 60; it++) {
        const p = F(a, b), e = 1e-7, pu = F(Math.min(u[1], a + e), b), pv = F(a, b + e), g = q => [norm(q) - G1.Rm, Math.acos(q[2] / norm(q)) - G1.delta], r = g(p), ru = g(pu), rv = g(pv);
        const J = [[(ru[0] - r[0]) / e, (rv[0] - r[0]) / e], [(ru[1] - r[1]) / e, (rv[1] - r[1]) / e]], det = J[0][0] * J[1][1] - J[0][1] * J[1][0];
        a = Math.min(u[1], Math.max(u[0], a - (r[0] * J[1][1] - r[1] * J[0][1]) / det)); b = Math.min(v[1] - 2e-7, Math.max(v[0], b - (J[0][0] * r[1] - J[1][0] * r[0]) / det));
      }
      if (a >= u[0] - 1e-9 && a <= u[1] + 1e-9 && b >= v[0] - 1e-9 && b <= v[1] + 1e-9) { const p = F(a, b); if (Math.abs(norm(p) - G1.Rm) < 1e-7) { hit = { f, a, b, p }; break; } }
    }
    assert.ok(hit && fr, 'the mean point on flankR#1');
    const e = 1e-6, n0 = cross(sub(evaluateSurface(hit.f.surface, hit.a + e, hit.b), evaluateSurface(hit.f.surface, hit.a - e, hit.b)), sub(evaluateSurface(hit.f.surface, hit.a, hit.b + e), evaluateSurface(hit.f.surface, hit.a, hit.b - e)));
    const az = Math.atan2(hit.p[1], hit.p[0]), n = dot(n0, [-Math.sin(az), Math.cos(az), 0]) > 0 ? n0 : n0.map(x => -x);
    assert.match(chk.axialThrust, new RegExp(`^gear 1 driving clockwise seen from its apex is pushed ${-n[2] > 0 ? 'away from' : 'toward'} its apex`));
    t.diagnostic(`spiral z${c1.z}/${c2.z} β ${c1.beta}° j ${j}: spheres ${chk.spheres.map(x => x.minimumClearanceMM.toExponential(4)).join(', ')}; ε_α ${chk.idealContactRatio.toFixed(5)} (Tredgold ${chk.tredgoldContactRatio.toFixed(5)}), ε_β ${chk.faceContactRatio.toFixed(5)}, ε_γ ${chk.totalContactRatio.toFixed(5)}; ${chk.axialThrust}; ${ms.toFixed(0)} ms`);
  }
  // A straight pair's thrust: each gear pushed away from its apex, either way it turns.
  assert.equal(checkBevelGearPair({ moduleMM: 2, teeth: 20, mateTeeth: 40, faceWidthMM: 10 }, { moduleMM: 2, teeth: 40, mateTeeth: 20, faceWidthMM: 10 }, { mode: 'verdict' }).axialThrust,
    'gear 1 driving clockwise seen from its apex is pushed away from its apex, gear 2 away from its own; gear 1 driving counter-clockwise seen from its apex is pushed away from its apex, gear 2 away from its own (directions, no load)');
});

const orient = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
function pointSegment(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
/** The least distance between two segment sets and whether two cross (pairs whose boxes lie farther apart than the best so far skipped: they neither cross nor come nearer). */
function segmentClearance(Sa, Sb) {
  let best = Infinity, crossed = false;
  for (let i = 0; i < Sa.length; i += 4) for (let j = 0; j < Sb.length; j += 4) {
    const ax = Sa[i], ay = Sa[i + 1], bx = Sa[i + 2], by = Sa[i + 3], cx = Sb[j], cy = Sb[j + 1], dx = Sb[j + 2], dy = Sb[j + 3];
    const gx = Math.max(0, Math.min(cx, dx) - Math.max(ax, bx), Math.min(ax, bx) - Math.max(cx, dx)), gy = Math.max(0, Math.min(cy, dy) - Math.max(ay, by), Math.min(ay, by) - Math.max(cy, dy));
    if (gx * gx + gy * gy > best * best) continue;
    if (orient(ax, ay, bx, by, cx, cy) * orient(ax, ay, bx, by, dx, dy) < 0 && orient(cx, cy, dx, dy, ax, ay) * orient(cx, cy, dx, dy, bx, by) < 0) crossed = true;
    best = Math.min(best, pointSegment(ax, ay, cx, cy, dx, dy), pointSegment(bx, by, cx, cy, dx, dy), pointSegment(cx, cy, ax, ay, bx, by), pointSegment(dx, dy, ax, ay, bx, by));
  }
  return { min: best, crossed };
}
/**
 * A placed gear's section by the sphere R about `apex`, built from its B-rep's own faces (the side faces of the segment
 * the sphere falls in, in outline order): each face's points at U parameters, its v where the distance is R by
 * bisection; only faces near the pitch line `P` (their middle within 0.45 rad), as segments in the gnomonic plane at P (× R).
 */
function sectionSegments(brep, id, apex, R, Ri, b, S, P, e1, e2, U = 60) {
  const seg = Math.min(S - 1, Math.floor((R - Ri) / (b / S))), out = [];
  for (const f of brep.faces) {
    const name = f.name.slice(id.length + 1); if (/^(heel|toe|bore)/.test(name)) continue;
    const sIdx = /\.(\d+)$/.test(name) ? Number(name.match(/\.(\d+)$/)[1]) - 1 : 0; if (sIdx !== seg) continue;
    const { u, v } = surfaceDomain(f.surface), mid = sub(evaluateSurface(f.surface, (u[0] + u[1]) / 2, (v[0] + v[1]) / 2), apex);
    if (dot(mid, P) / norm(mid) < Math.cos(0.45)) continue;
    let prev = null;
    for (let i = 0; i <= U; i++) {
      const a = u[0] + (u[1] - u[0]) * i / U; let lo = v[0], hi = v[1];
      for (let it = 0; it < 50; it++) { const m = (lo + hi) / 2; if (norm(sub(evaluateSurface(f.surface, a, m), apex)) < R) lo = m; else hi = m; }
      const w = sub(evaluateSurface(f.surface, a, (lo + hi) / 2), apex), k = dot(w, P), q = [R * dot(w, e1) / k, R * dot(w, e2) / k];
      if (prev) out.push(prev[0], prev[1], q[0], q[1]); prev = q;
    }
  }
  return Float64Array.from(out);
}

test('the part model: a spiral pinion and its mate by mesh, their B-reps cut by five spheres about the shared apex at three turns — clear by j R/Re cos α_t / 2 within the fits, never crossing; a phase off crosses; checkPlacedBevelGears clear; STEP', t => {
  const j = 0.1, feats = (rot, phase = 0) => [
    { id: 'p', kind: 'bevel-gear', module: 3, teeth: 20, mateTeeth: 40, faceWidth: 20, thicknessReduction: j / 2, spiral: { angle: 35, hand: 'left', cutterRadius: 60 }, rotation: rot, center: [4, -2], from: 3 },
    { id: 'w', kind: 'bevel-gear', module: 3, teeth: 40, mateTeeth: 20, faceWidth: 20, thicknessReduction: j / 2, spiral: { angle: 35, hand: 'right', cutterRadius: 60 }, mesh: { gear: 'p', direction: 25, phase } }];
  const G1 = geom({ m: 3, z: 20, zm: 40, b: 20, beta: 35, hand: 'left', rc: 60 }), apex = [4, -2, 3], rows = [];
  const run = (rot, phase) => {
    const M = evaluateCadPart(D(feats(rot, phase))), a = outputOf(M, 'p'), w = outputOf(M, 'w'), pa = a.bevelGearPlacement, pw = w.bevelGearPlacement;
    // The pitch line: at δ1 from the pinion's axis toward the mate's; the gnomonic plane's axes there.
    const Z1 = pa.axis, k = dot(pw.axis, Z1), dd = sub(pw.axis, Z1.map(x => x * k)), dn = dd.map(x => x / norm(dd)), P = Z1.map((x, i) => Math.cos(G1.delta) * x + Math.sin(G1.delta) * dn[i]);
    const e1 = cross(P, dn).map(x => x / norm(cross(P, dn))), e2 = cross(P, e1);
    const out = [];
    for (let s = 0; s <= 4; s++) {
      const R = G1.Ri + 20 * s / 4, A = sectionSegments(a.brep, 'p', apex, R, G1.Ri, 20, a.bevelGear.spiral.axialSegments, P, e1, e2), B = sectionSegments(w.brep, 'w', apex, R, G1.Ri, 20, w.bevelGear.spiral.axialSegments, P, e1, e2);
      out.push({ R, ...segmentClearance(A, B) });
    }
    return { out, check: checkPlacedBevelGears(pa, pw, { mode: 'verdict' }), a, w };
  };
  const step = 360 / 20;
  for (const rot of SURVEY ? [0, step / 3, 2 * step / 3] : [0, step / 2]) {
    const { out, check, a, w } = run(rot, 0);
    assert.equal(check.relativePhaseDeg, 0); assert.equal(check.sweep.interference, false);
    const fits = a.bevelGear.profileDeviationMM + a.bevelGear.spiral.twistDeviationMM + w.bevelGear.profileDeviationMM + w.bevelGear.spiral.twistDeviationMM;
    for (const r of out) {
      const want = j * r.R / G1.Re * Math.cos(G1.alpha) / 2;
      assert.equal(r.crossed, false, `turn ${rot}° sphere ${r.R}: the sections cross`);
      // (The chords of 60 points a face stand inside each convex tooth: the least can only grow, by their sag, about 2e-4 mm;
      // the fits move it by their distances; the gnomonic plane stretches it by up to 0.3%.)
      assert.ok(r.min >= want - fits - 3e-3 * want && r.min <= want + fits + 5e-4 + 3e-3 * want, `turn ${rot}° sphere ${r.R}: ${r.min} vs ${want}`);
    }
    rows.push(`turn ${rot.toFixed(1)}°: ${out.map(r => `${r.R.toFixed(2)} ${r.min.toFixed(5)}`).join(', ')}`);
  }
  // A phase off by 4°: the sections cross on some sphere.
  const off = run(0, 4).out; assert.ok(off.some(r => r.crossed), 'a phase off crosses');
  if (SURVEY) assert.throws(() => outputOf(evaluateCadPart(D([...feats(0), { id: 'i', kind: 'intersect', target: 'p', tool: 'w' }])), 'i'), e => (e.details?.category ?? e.code) === 'REFERENCE' && /no output i/.test(e.message));
  // The part model's refusals: a mate of the same hand; a spiral without its hand.
  assert.throws(() => outputOf(evaluateCadPart(D([feats(0)[0], { ...feats(0)[1], spiral: { angle: 35, hand: 'left', cutterRadius: 60 } }])), 'w'), e => (e.details?.category ?? e.code) === 'INPUT' && /opposite hands/.test(e.message));
  assert.throws(() => outputOf(evaluateCadPart(D([{ ...feats(0)[0], spiral: { angle: 35, cutterRadius: 60 } }])), 'p'), e => (e.details?.category ?? e.code) === 'INPUT' && /hand/.test(e.message));
  // STEP: the volume and names back.
  const { brep } = bevelGear(specOf({ m: 3, z: 20, zm: 40, b: 20, bore: 10, beta: 35, hand: 'left', rc: 60 }), { id: 's' }), back = importStep(exportStep([brep], { name: 'spiral' }));
  close(brepMassProperties(back, 1).volume, brepMassProperties(brep, 1).volume, 1e-6 * brepMassProperties(brep, 1).volume, 'round trip'); assert.ok(back.faces.some(f => f.name === 's.flankL#1')); assert.equal(checkBrep(back).valid, true);
  t.diagnostic(rows.join('; '));
});
