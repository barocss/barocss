import test from 'node:test';
import assert from 'node:assert/strict';
import { internalGear, internalGearDimensions, internalGearCenterDistance, checkInternalGearPair, checkPlacedInternalGears, evaluateCadPart, GearError, checkBrep, brepMassProperties, exportStep, importStep, evaluateCurve, curveDomain } from '../dist/index.js';

// R12b.2a (D132): internal gears built directly, and the internal pair's checks. The oracles here are written apart from
// gear.ts and gear-internal.ts: the ring's outline and area from the analytic involute, K1's internal example (Table
// 4.6), the formulas (centre distance, backlash, the contact ratio, the interference conditions — the latter two
// derived, K1's being images), an independent polyline sweep for the radial insertion, and the exact Boolean of the
// placed solids.
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (|Δ| ${Math.abs(a - b).toExponential(3)} > ${tol})`);
const ALPHA = 20 * Math.PI / 180, TAN = Math.tan(ALPHA), COS = Math.cos(ALPHA), inv = p => Math.tan(p) - p;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
// The full interference survey (every pair D132 records, the extra Booleans) runs with GEAR_SURVEY=1 — at track
// boundaries and before RB rows; by default a subset that keeps a clear pair, crossings of each kind, trimming either side
// of its boundary, the disagreement, and one helical pair.
const SURVEY = !!process.env.GEAR_SURVEY;

/**
 * A closed outline of `z` "teeth" (D129's probe): the involute of base radius rb from `r0` to `ra` on both sides of
 * each tooth (half-angle at the base `psi`), the tip and root arcs — as [x, y, …], counter-clockwise, tooth k on 2πk/z.
 */
function outline({ z, rb, psi, ra, rf, F = 1500, A = 60 }) {
  const step = 2 * Math.PI / z, r0 = Math.max(rb, rf), psiS = psi - inv(Math.acos(rb / r0)), psiT = psi - inv(Math.acos(rb / ra)), t0 = Math.sqrt(Math.max(0, (r0 / rb) ** 2 - 1)), t1 = Math.sqrt((ra / rb) ** 2 - 1), pts = [];
  for (let k = 0; k < z; k++) {
    const g = step * k;
    for (let i = 0; i < A / 2; i++) { const a = g - step / 2 + (step / 2 - psiS) * i / (A / 2); pts.push(rf * Math.cos(a), rf * Math.sin(a)); }
    if (rf < rb) pts.push(rf * Math.cos(g - psi), rf * Math.sin(g - psi));
    for (let i = 0; i <= F; i++) { const t = t0 + (t1 - t0) * i / F, rr = rb * Math.sqrt(1 + t * t), a = g - psi + t - Math.atan(t); pts.push(rr * Math.cos(a), rr * Math.sin(a)); }
    for (let i = 1; i < A; i++) { const a = g - psiT + 2 * psiT * i / A; pts.push(ra * Math.cos(a), ra * Math.sin(a)); }
    for (let i = F; i >= 0; i--) { const t = t0 + (t1 - t0) * i / F, rr = rb * Math.sqrt(1 + t * t), a = g + psi - t + Math.atan(t); pts.push(rr * Math.cos(a), rr * Math.sin(a)); }
    if (rf < rb) pts.push(rf * Math.cos(g + psi), rf * Math.sin(g + psi));
    for (let i = 0; i < A / 2; i++) { const a = g + psiS + (step / 2 - psiS) * i / (A / 2); pts.push(rf * Math.cos(a), rf * Math.sin(a)); }
  }
  pts.push(pts[0], pts[1]);
  return Float64Array.from(pts);
}
const shoelace = P => { let A = 0; for (let i = 0; i + 3 < P.length; i += 2) A += P[i] * P[i + 3] - P[i + 2] * P[i + 1]; return A / 2; };
/**
 * A ring by K1's internal formulas, transverse: tip r − (1 − x2) m_n, root r + (1.25 + x2) m_n, its space at the
 * reference circle m_t(π/2 + 2 x2 tan α_n) + j (the ring's reduction j). Its spaces as an outline (each space a "tooth"
 * of half-angle ψ at the base, from the tip circle out to the root circle, centred on 2πk/z + π/z when tooth 1 is on +X).
 */
function ring({ mn, z, x = 0, j = 0, betaDeg = 0 }) {
  const cb = Math.cos(betaDeg * Math.PI / 180), mt = mn / cb, at = Math.atan(TAN / cb), r = mt * z / 2, rb = r * Math.cos(at), ra = r - (1 - x) * mn, rf = r + (1.25 + x) * mn;
  const space = mt * (Math.PI / 2 + 2 * x * TAN) + j, psi = space / (2 * r) + inv(at);
  return { mn, mt, at, z, x, j, r, rb, ra, rf, space, psi };
}
/** A pinion's outline by the textbook formulas (schematic root; the tooth s = m_t(π/2 + 2x tan α_n) − Δs). */
function pinion({ mn, z, x = 0, red = 0, betaDeg = 0 }) {
  const cb = Math.cos(betaDeg * Math.PI / 180), mt = mn / cb, at = Math.atan(TAN / cb), r = mt * z / 2, rb = r * Math.cos(at);
  return { mn, mt, at, z, x, r, rb, ra: r + mn * (1 + x), rf: r - mn * (1.25 - x), psi: (mt * (Math.PI / 2 + 2 * x * TAN) - red) / (2 * r) + inv(at) };
}

test('the ring as a solid (refused at the previous HEAD, no such generator): valid, one body, its volume (πR² − the analytic spaces\' area) × b; names, tooth 1 on +X; K1\'s internal example\'s dimensions', t => {
  for (const [spec, R] of [[{ moduleMM: 2, teeth: 40, faceWidthMM: 10, rimDiameterMM: 100 }, 50], [{ moduleMM: 2, teeth: 60, faceWidthMM: 8, rimDiameterMM: 140, toothThicknessReductionMM: 0.05 }, 70], [{ moduleMM: 3, teeth: 24, faceWidthMM: 10, rimDiameterMM: 100, profileShiftCoefficient: 0.516 }, 50], [{ normalModuleMM: 2, helixAngleDeg: 20, hand: 'right', teeth: 50, faceWidthMM: 12, rimDiameterMM: 130 }, 65]]) {
    const t0 = performance.now(), { brep, report } = internalGear(spec, { id: 'r' }), ms = performance.now() - t0;
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues?.[0]); assert.equal(brep.bodies.length, 1);
    assert.equal(report.generator, 'internal-gear@0'); assert.equal(report.diagnostics[0].code, 'ROOT_TRANSITION_UNVALIDATED');
    const g = ring({ mn: spec.moduleMM ?? spec.normalModuleMM, z: spec.teeth, x: spec.profileShiftCoefficient ?? 0, j: spec.toothThicknessReductionMM ?? 0, betaDeg: spec.helixAngleDeg ?? 0 });
    const area = Math.PI * R * R - shoelace(outline({ z: g.z, rb: g.rb, psi: g.psi, ra: g.rf, rf: g.ra }));
    // (Each flank's area moves by at most its deviation times its length; a helical ring's twist fit besides.)
    const tw = report.helix ? report.helix.twistDeviationMM / g.rf : 0, want = area * spec.faceWidthMM, slack = 2 * g.z * report.profileDeviationMM * 2.25 * g.mn * spec.faceWidthMM + (2 * tw + tw * tw) * Math.PI * g.rf ** 2 * spec.faceWidthMM + 1e-9 * want;
    close(brepMassProperties(brep, 1).volumeMM3, want, slack, `ring z${g.z} volume`);
    close(report.dimensions.tipDiameterMM, 2 * g.ra, 1e-12, 'tip'); close(report.dimensions.rootDiameterMM, 2 * g.rf, 1e-12, 'root'); close(report.dimensions.spaceWidthMM, g.space, 1e-12, 'space');
    const names = brep.faces.map(f => f.name);
    for (const k of [1, g.z]) for (const role of ['flankL', 'flankR', 'tip', 'root']) assert.ok(names.includes(`r.${role}#${k}`), `r.${role}#${k}`);
    assert.ok(names.includes('r.rim#1') && names.includes('r.face0'));
    // Tooth 1 on +X: its tip arc's middle at angle 0, at the tip radius.
    const tip = brep.faces.find(f => f.name === 'r.tip#1'), e = brep.edges.find(x => brep.coedges.some(c => c.edge === x.id && brep.loops.find(l => l.id === c.loop)?.face === tip.id) && x.curve.controlPoints.every(p => Math.abs(p[2]) < 1e-12));
    const [u0, u1] = curveDomain(e.curve), q = evaluateCurve(e.curve, (u0 + u1) / 2);
    close(Math.atan2(q[1], q[0]), 0, 1e-9, 'tooth 1 on +X'); close(Math.hypot(q[0], q[1]), g.ra, 1e-9, 'its tip radius');
    t.diagnostic(`ring z${g.z}${spec.helixAngleDeg ? ` β${spec.helixAngleDeg}°` : ''}: V ${brepMassProperties(brep, 1).volumeMM3.toFixed(4)} vs ${want.toFixed(4)}, ${brep.faces.length} faces, ${ms.toFixed(0)} ms`);
  }
  // K1 Table 4.6 (m 3, z 16 in z 24, x1 0, x2 0.516): d2 72, db2 67.658, da2 69.096, df2 82.596; inv α_w 0.061857,
  // α_w 31.321258°, a 13.2 (K1 rounds y to 0.4000: the formula gives 13.19995).
  const k = internalGear({ moduleMM: 3, teeth: 24, faceWidthMM: 10, rimDiameterMM: 100, profileShiftCoefficient: 0.516 }).report.dimensions;
  close(k.referenceDiameterMM, 72, 1e-12, 'd2'); close(k.baseDiameterMM, 67.658, 5e-4, 'db2'); close(k.tipDiameterMM, 69.096, 1e-9, 'da2'); close(k.rootDiameterMM, 82.596, 1e-9, 'df2');
  const pin = { moduleMM: 3, teeth: 16, faceWidthMM: 10, rootPolicy: 'generated' }, rg = { moduleMM: 3, teeth: 24, faceWidthMM: 10, rimDiameterMM: 100, profileShiftCoefficient: 0.516 };
  const a = internalGearCenterDistance(pin, rg), aw = Math.acos(3 * 8 / 2 * COS / a);
  close(inv(aw), 0.061857, 5e-7, 'inv α_w'); close(a, 13.2, 1e-4, 'a');
  // (K1's α_w 31.321258° follows from its a rounded to 13.2: acos(12 cos 20° / 13.2); the exact a gives 31.32092°.)
  close(Math.acos(12 * COS / 13.2) * 180 / Math.PI, 31.321258, 1e-6, 'K1\'s α_w from its a'); close(aw * 180 / Math.PI, 31.321258, 4e-4, 'α_w');
});

test('refusals: a tip inside the base circle (naming the shift that lifts it), a rim too thin, a shift out of range, a reduction too large, too few teeth; pairs that do not mesh', () => {
  const code = (fn, c, re) => assert.throws(fn, e => e instanceof GearError && e.code === c && (!re || re.test(e.message)), String(fn));
  const g = { moduleMM: 2, teeth: 30, faceWidthMM: 8, rimDiameterMM: 90 };
  let lift = 0;
  assert.throws(() => internalGear(g), e => { const m = /a shift of at least x = (-?[\d.]+)/.exec(e.message); lift = m ? Number(m[1]) : NaN; return e.code === 'UNSUPPORTED_PROFILE_SHIFT' && m !== null; });
  // (The tip r − (1 − x)m reaches the base circle at x = 1 − (r − rb)/m: 1 − 30(1 − cos 20°)/2.)
  close(lift, 1 - 30 * (1 - COS) / 2, 1e-3, 'the shift named');
  assert.equal(checkBrep(internalGear({ ...g, profileShiftCoefficient: lift + 1e-3 }).brep).valid, true);
  code(() => internalGear({ ...g, teeth: 60, rimDiameterMM: 128 }), 'RIM_INTERSECTION', /at least Ø129\.000/);
  code(() => internalGear({ ...g, teeth: 60, rimDiameterMM: 140, profileShiftCoefficient: 0.8 }), 'UNSUPPORTED_PROFILE_SHIFT');
  code(() => internalGear({ ...g, teeth: 60, rimDiameterMM: 140, toothThicknessReductionMM: 0.5 }), 'INVALID_INPUT', /at most 0\.36397/);
  code(() => internalGear({ ...g, teeth: 7 }), 'INVALID_INPUT');
  const r60 = { moduleMM: 2, teeth: 60, faceWidthMM: 8, rimDiameterMM: 140 };
  code(() => internalGearCenterDistance({ moduleMM: 2.5, teeth: 20, faceWidthMM: 8 }, r60), 'MATE_INCOMPATIBLE', /modules/);
  code(() => internalGearCenterDistance({ moduleMM: 2, teeth: 60, faceWidthMM: 8 }, r60), 'MATE_INCOMPATIBLE', /does not fit/);
  const hr = { normalModuleMM: 2, helixAngleDeg: 15, hand: 'right', teeth: 60, faceWidthMM: 8, rimDiameterMM: 140 };
  code(() => internalGearCenterDistance({ normalModuleMM: 2, helixAngleDeg: 15, hand: 'left', teeth: 20, faceWidthMM: 8 }, hr), 'MATE_INCOMPATIBLE', /one hand/);
  code(() => internalGearCenterDistance({ moduleMM: 2, teeth: 20, faceWidthMM: 8 }, hr), 'MATE_INCOMPATIBLE', /spur gear/);
});

test('an internal pair: the formulas (centre distance, +z1/z2, backlash, tip clearances, the contact ratio) and the sweep — j cos α / 2 at no shift, touching at K1\'s shifted pair; a helical pair of one hand', t => {
  const p = checkInternalGearPair({ moduleMM: 2, teeth: 24, faceWidthMM: 10 }, { moduleMM: 2, teeth: 60, faceWidthMM: 10, rimDiameterMM: 140, toothThicknessReductionMM: 0.1 });
  close(p.centerDistanceMM, 36, 1e-12, 'a'); close(p.speedRatio, 0.4, 1e-15, 'ratio'); close(p.workingPressureAngleDeg, 20, 1e-12, 'α_w'); close(p.backlashMM, 0.1, 1e-12, 'backlash');
  close(p.tipClearancesMM[0], 0.5, 1e-12, 'pinion tip'); close(p.tipClearancesMM[1], 0.5, 1e-12, 'ring tip');
  const P = pinion({ mn: 2, z: 24 }), R = ring({ mn: 2, z: 60 });
  close(p.idealContactRatio, (Math.sqrt(P.ra ** 2 - P.rb ** 2) - Math.sqrt(R.ra ** 2 - R.rb ** 2) + 36 * Math.sin(ALPHA)) / (Math.PI * 2 * COS), 1e-12, 'εα');
  close(p.sweep.minimumClearanceMM, 0.1 * COS / 2, 1e-5, 'clearance'); assert.equal(p.sweep.interference, false); assert.equal(p.sweep.converged, true);
  assert.deepEqual(p.diagnostics, []);
  // K1's shifted pair at its working distance, without backlash: the sweep touches (a crossing no deeper than the chords), clear.
  const k = checkInternalGearPair({ moduleMM: 3, teeth: 16, faceWidthMM: 10, rootPolicy: 'generated' }, { moduleMM: 3, teeth: 24, faceWidthMM: 10, rimDiameterMM: 100, profileShiftCoefficient: 0.516 });
  close(k.backlashMM, 0, 1e-12, 'K1 backlash'); assert.ok(Math.abs(k.sweep.minimumClearanceMM) < 2e-5, String(k.sweep.minimumClearanceMM));
  t.diagnostic(`K1 16/24 x2 0.516: least ${k.sweep.minimumClearanceMM.toExponential(2)}, involute ${k.interference.involuteMargin.toFixed(4)}, trochoid ${k.interference.trochoidMargin.toFixed(4)}, trimming ${JSON.stringify(k.interference.trimming)}`);
  // A helical pair (β 15°, both right-handed): in the transverse plane, j cos α_t / 2.
  const h = checkInternalGearPair({ normalModuleMM: 2, helixAngleDeg: 15, hand: 'right', teeth: 20, faceWidthMM: 10 }, { normalModuleMM: 2, helixAngleDeg: 15, hand: 'right', teeth: 50, faceWidthMM: 10, rimDiameterMM: 130, toothThicknessReductionMM: 0.1 });
  const at = Math.atan(TAN / Math.cos(15 * Math.PI / 180));
  close(h.centerDistanceMM, 2 / Math.cos(15 * Math.PI / 180) * 30 / 2, 1e-12, 'helical a'); close(h.sweep.minimumClearanceMM, 0.1 * Math.cos(at) / 2, 1e-5, 'helical clearance');
  close(h.axialContactRatio, 10 * Math.sin(15 * Math.PI / 180) / (2 * Math.PI), 1e-12, 'εβ');
});

/** The trimming condition in its commonly published form (derived; K1's is an image): ≥ 0 when radial assembly is clear. */
function trimmingMargin(m, z1, z2) {
  const P = pinion({ mn: m, z: z1 }), R = ring({ mn: m, z: z2 }), aa1 = Math.acos(P.rb / P.ra), aa2 = Math.acos(R.rb / R.ra), q = (Math.cos(aa1) / Math.cos(aa2)) ** 2;
  const t1 = Math.asin(Math.sqrt((1 - q) / (1 - (z1 / z2) ** 2))), t2 = Math.asin(Math.sqrt((1 / q - 1) / ((z2 / z1) ** 2 - 1)));
  return (t1 + inv(aa1) - inv(ALPHA)) - (z2 / z1) * (t2 + inv(aa2) - inv(ALPHA));
}
/** The involute and trochoid margins as D129's probe wrote them. */
function margins(m, z1, z2) {
  const P = pinion({ mn: m, z: z1 }), R = ring({ mn: m, z: z2 }), a = m * (z2 - z1) / 2, aa1 = Math.acos(P.rb / P.ra), aa2 = Math.acos(R.rb / R.ra);
  const th1 = Math.acos((R.ra ** 2 - P.ra ** 2 - a * a) / (2 * a * P.ra)) + inv(aa1) - inv(ALPHA), th2 = Math.acos((a * a + R.ra ** 2 - P.ra ** 2) / (2 * a * R.ra));
  return { involute: z1 / z2 - (1 - Math.tan(aa2) / Math.tan(ALPHA)), trochoid: th1 * z1 / z2 + inv(ALPHA) - inv(aa2) - th2 };
}
/** The test's own radial insertion (D129's probe's polylines): the pinion's outline moved from the ring's centre to a, the least clearance or a crossing. */
function ownInsertion(m, z1, z2, n = 100) {
  const P = pinion({ mn: m, z: z1 }), R = ring({ mn: m, z: z2 }), a = m * (z2 - z1) / 2, pin = outline({ z: z1, rb: P.rb, psi: P.psi, ra: P.ra, rf: P.rf, F: 200, A: 20 });
  // (The ring's spaces as the outline's teeth, space k on 2πk/z2: a space on +X, facing the pinion's tooth.)
  const rg = outline({ z: z2, rb: R.rb, psi: R.psi, ra: R.rf, rf: R.ra, F: 200, A: 20 });
  const o = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  for (let i = 1; i < n; i++) {
    const s = a * i / n, A = [], B = [];
    // Only what can meet: the pinion beyond the ring's tip circle, the ring within the pinion's tip circle.
    for (let u = 0; u + 3 < pin.length; u += 2) if (Math.hypot(pin[u] + s, pin[u + 1]) >= R.ra - 0.5 * m || Math.hypot(pin[u + 2] + s, pin[u + 3]) >= R.ra - 0.5 * m) A.push(pin[u] + s, pin[u + 1], pin[u + 2] + s, pin[u + 3]);
    for (let v = 0; v + 3 < rg.length; v += 2) if (Math.hypot(rg[v] - s, rg[v + 1]) <= P.ra + 0.5 * m || Math.hypot(rg[v + 2] - s, rg[v + 3]) <= P.ra + 0.5 * m) B.push(rg[v], rg[v + 1], rg[v + 2], rg[v + 3]);
    for (let u = 0; u < A.length; u += 4) for (let v = 0; v < B.length; v += 4) {
      const [ax, ay, bx, by] = [A[u], A[u + 1], A[u + 2], A[u + 3]], [cx, cy, dx, dy] = [B[v], B[v + 1], B[v + 2], B[v + 3]];
      if (Math.max(ax, bx) < Math.min(cx, dx) || Math.max(cx, dx) < Math.min(ax, bx) || Math.max(ay, by) < Math.min(cy, dy) || Math.max(cy, dy) < Math.min(ay, by)) continue;
      if (o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0 && o(cx, cy, dx, dy, ax, ay) * o(cx, cy, dx, dy, bx, by) < 0) return true;
    }
  }
  return false;
}

test('the interference conditions against the sweep: involute and trochoid on D129\'s nine pairs; trimming — the radial insertion — against the condition, and against this file\'s own insertion where they disagree', t => {
  const rows = [];
  for (const [z1, z2] of SURVEY ? [[20, 60], [24, 60], [24, 40], [28, 40], [30, 40], [31, 40], [32, 40], [34, 40], [36, 40]] : [[20, 60], [24, 60], [31, 40], [32, 40]]) {
    // (The verdict first — a crossing settles it; else the report, for a shortfall below j cos α / 2.)
    const gp = { moduleMM: 2, teeth: z1, faceWidthMM: 10 }, gr = { moduleMM: 2, teeth: z2, faceWidthMM: 10, rimDiameterMM: 2 * z2 + 20, toothThicknessReductionMM: 2e-4 }, v = checkInternalGearPair(gp, gr, { mode: 'verdict', samples: 128 });
    const c = v.sweep.interference ? v : checkInternalGearPair(gp, gr, { samples: 128 });
    const own = margins(2, z1, z2);
    close(c.interference.involuteMargin, own.involute, 1e-12, `${z1}/${z2} involute margin`); close(c.interference.trochoidMargin, own.trochoid, 1e-12, `${z1}/${z2} trochoid margin`);
    // (A breach: the teeth cross, or the least clearance falls short of j cos α / 2 by more than the chords.)
    const breached = c.sweep.interference || c.sweep.minimumClearanceMM < 2e-4 * COS / 2 - 2e-5;
    assert.equal(breached, own.involute < 0 || own.trochoid < 0, `${z1}/${z2}: the sweep and the conditions`);
    assert.equal(c.diagnostics.some(d => d.code === 'TROCHOID_INTERFERENCE'), own.trochoid < 0); assert.equal(c.diagnostics.some(d => d.code === 'INVOLUTE_INTERFERENCE'), own.involute < 0);
    rows.push(`${z1}/${z2} ${breached ? 'breached' : 'clear'}`);
  }
  t.diagnostic(`conditions vs sweep: ${rows.join(', ')}`);
  // Trimming: the product's radial insertion (zero backlash) against the condition — rings of 40, 60 and 80, either side
  // of the boundary (the margins nearest 0, 44/60 −1e-5 and 64/80 +5e-5, left out).
  const trim = [];
  for (const [z1, z2] of SURVEY ? [[20, 60], [40, 60], [42, 60], [45, 60], [46, 60], [48, 60], [20, 40], [22, 40], [26, 40], [28, 40], [30, 40], [50, 80], [60, 80], [66, 80]] : [[42, 60], [45, 60], [22, 40], [26, 40]]) {
    const c = checkInternalGearPair({ moduleMM: 2, teeth: z1, faceWidthMM: 10 }, { moduleMM: 2, teeth: z2, faceWidthMM: 10, rimDiameterMM: 2 * z2 + 20 }, { mode: 'verdict' }), mg = trimmingMargin(2, z1, z2);
    assert.equal(c.interference.trimming.possible, true);
    assert.equal(c.interference.trimming.interference, mg < 0, `${z1}/${z2}: the insertion and the condition (${mg})`);
    trim.push(`${z1}/${z2} ${mg.toFixed(5)} ${c.interference.trimming.interference ? 'crosses' : 'clear'}`);
  }
  t.diagnostic(`trimming condition vs insertion: ${trim.join(', ')}`);
  // Where they disagree — 24/40 and 25/40, the condition negative (−0.00058, −0.0029) — this file's own insertion (its own outlines, 100 offsets) agrees with the product's: clear; and crosses at 26/40, as both do. (The product's at 3000 offsets too, D132.)
  for (const [z1, cross] of SURVEY ? [[24, false], [25, false], [26, true]] : [[25, false], [26, true]]) {
    const c = checkInternalGearPair({ moduleMM: 2, teeth: z1, faceWidthMM: 10 }, { moduleMM: 2, teeth: 40, faceWidthMM: 10, rimDiameterMM: 100 }, { mode: 'verdict' });
    // (D133: the condition reproduces K1's Table 4.8, so the product flags trimming when either says so — here by the
    // condition; the straight path's own verdict kept apart, `sweepInterference`.)
    assert.equal(c.interference.trimming.sweepInterference, cross, `product's path ${z1}/40`); assert.equal(ownInsertion(2, z1, 40), cross, `own ${z1}/40`);
    assert.equal(trimmingMargin(2, z1, 40) < 0, true); assert.equal(c.interference.trimming.interference, true, `${z1}/40 flagged`);
    close(c.interference.trimming.conditionMargin, trimmingMargin(2, z1, 40), 1e-12, 'the condition\'s margin');
  }
  // A pinion whose tip circle does not fit inside the ring's cannot start concentric: radial assembly impossible.
  const big = checkInternalGearPair({ moduleMM: 2, teeth: 36, faceWidthMM: 10 }, { moduleMM: 2, teeth: 40, faceWidthMM: 10, rimDiameterMM: 100 }, { mode: 'verdict' });
  assert.equal(big.interference.trimming.possible, false); assert.ok(big.diagnostics.some(d => d.code === 'TRIMMING_INTERFERENCE' && /assemble it axially/.test(d.message)));
});

test('placed: the part model\'s ring (z 40) and a pinion (z 24) inside it (spur-gear mesh) — at a along the direction, turning with the ring by z2/z1 the same way; the exact Boolean intersection empty when meshed, not when a phase off; a helical pair of one hand; STEP', () => {
  // (The ring shifted x2 0.25: unshifted, its tip runs into the rack-cut pinion's fillet — D132's finding, the sweep's crossing below.)
  const feats = (rot, dir, phase = 0, x2 = 0.25) => [{ id: 'r', kind: 'internal-gear', module: 2, teeth: 40, faceWidth: 3, rim: 100, thicknessReduction: 0.05, profileShift: x2, rotation: rot, center: [5, 3] }, { id: 'p', kind: 'spur-gear', module: 2, teeth: 24, faceWidth: 3, thicknessReduction: 0.05, mesh: { gear: 'r', direction: dir, phase }, generator: 'spur-gear@1' }];
  // The shifted centre distance by K1's form, Newton on inv here: inv α_w = 2 tan α · 0.25 / 16 + inv α.
  let w = ALPHA; const target = 2 * TAN * 0.25 / 16 + inv(ALPHA);
  for (let i = 0; i < 60; i++) w -= (inv(w) - target) / Math.tan(w) ** 2;
  const aw = 16 * COS / Math.cos(w);
  for (const [rot, dir] of SURVEY ? [[0, 0], [7, 30], [13.25, 200]] : [[0, 0], [13.25, 200]]) {
    const r = evaluateCadPart(D(feats(rot, dir))), ring = r.output('r'), pin = r.output('p').gearPlacement;
    close(Math.hypot(pin.center[0] - 5, pin.center[1] - 3), aw, 1e-12, 'centre distance'); close(Math.atan2(pin.center[1] - 3, pin.center[0] - 5), (dir > 180 ? dir - 360 : dir) * Math.PI / 180, 1e-12, 'direction');
    const c = checkPlacedInternalGears(ring.internalGearPlacement, pin, { mode: 'verdict' });
    close(c.relativePhaseDeg, 0, 1e-9, 'phase'); assert.equal(c.sweep.interference, false);
  }
  // The same direction, the ring turned: the pinion turns z2/z1 = 40/24 as far, the same way.
  const a0 = evaluateCadPart(D(feats(0, 30))).output('p').gearPlacement.rotation, a7 = evaluateCadPart(D(feats(7, 30))).output('p').gearPlacement.rotation;
  close(a7 - a0, 40 / 24 * 7 * Math.PI / 180, 1e-12, 'z2/z1 the same way');
  // The exact Boolean intersection of the placed solids, apart from the sweep: none meshed, some half a pitch off.
  assert.throws(() => evaluateCadPart(D([...feats(7, 30), { id: 'i', kind: 'intersect', target: 'r', tool: 'p' }])).output('i'), e => (e.details?.category ?? e.code) === 'REFERENCE' && /no output i/.test(e.message));
  if (SURVEY) { const off = evaluateCadPart(D([...feats(0, 0, 9), { id: 'i', kind: 'intersect', target: 'r', tool: 'p' }])).output('i'); assert.ok(brepMassProperties(off.brep, 1).volumeMM3 > 1, 'a phase off: the teeth overlap'); }
  // Unshifted (x2 0), the ring's tip corners run into the rack-cut pinion's root fillet: the sweep crosses (formMargin
  // −2.25 mm along the line of action — elsewhere a negative formMargin passes clear: it is no verdict).
  const un = evaluateCadPart(D(feats(0, 0, 0, 0))), unc = checkPlacedInternalGears(un.output('r').internalGearPlacement, un.output('p').gearPlacement);
  assert.equal(unc.sweep.interference, true); assert.ok(unc.interference.formMargin < 0 && unc.interference.involuteMargin > 0);
  // At x2 0.25 without backlash the sweep crosses by 0.0118 mm at 11.254° of the pinion; turned there, the exact Boolean
  // of the two solids is not empty (apart from the sweep); with 0.05 + 0.05 it is, and at x2 0.5 without backlash too.
  const pose = (x2, red, turnDeg) => [{ id: 'r', kind: 'internal-gear', module: 2, teeth: 40, faceWidth: 3, rim: 100, profileShift: x2, thicknessReduction: red, rotation: turnDeg * 24 / 40 }, { id: 'p', kind: 'spur-gear', module: 2, teeth: 24, faceWidth: 3, thicknessReduction: red, mesh: { gear: 'r' }, generator: 'spur-gear@1' }];
  const z0 = evaluateCadPart(D(pose(0.25, 0, 0))), zc = checkPlacedInternalGears(z0.output('r').internalGearPlacement, z0.output('p').gearPlacement);
  assert.ok(zc.sweep.minimumClearanceMM < -0.01, String(zc.sweep.minimumClearanceMM));
  // (Their exact intersection there is flank slivers 0.0118 mm thin: before D186 it came back as a body with a face of
  // width 2e-19 mm, its loops crossing (strict L0) and its volume 5 % off its mesh's — a wrong body. Now either a body
  // valid under the strict check, or the typed graze refusal; the sweep above says they overlap.)
  try {
    const hit = evaluateCadPart(D([...pose(0.25, 0, zc.sweep.atDegrees), { id: 'i', kind: 'intersect', target: 'r', tool: 'p' }])).output('i');
    assert.ok(checkBrep(hit.brep, { strict: true }).valid, 'a body is valid under the strict check');
    assert.ok(brepMassProperties(hit.brep, 1).volumeMM3 > 1e-4, 'the solids overlap where the sweep says');
  } catch (e) { if (!((e.details?.category ?? e.code) === 'GEOMETRY' && /graze within .* the sliver between them cannot be built/.test(e.message))) throw e; }
  for (const [x2, red] of SURVEY ? [[0.25, 0.05], [0.5, 0]] : []) assert.throws(() => evaluateCadPart(D([...pose(x2, red, zc.sweep.atDegrees), { id: 'i', kind: 'intersect', target: 'r', tool: 'p' }])).output('i'), e => (e.details?.category ?? e.code) === 'REFERENCE' && /no output i/.test(e.message));
  const offCheck = checkPlacedInternalGears(evaluateCadPart(D(feats(0, 0, 9))).output('r').internalGearPlacement, evaluateCadPart(D(feats(0, 0, 9))).output('p').gearPlacement, { mode: 'verdict' });
  assert.equal(offCheck.sweep.interference, true);
  // Refusals in the part model: another module, a feature that is no gear.
  assert.throws(() => evaluateCadPart(D([feats(0, 0)[0], { ...feats(0, 0)[1], module: 2.5 }])).output('p'), e => (e.details?.category ?? e.code) === 'INPUT' && /MATE_INCOMPATIBLE/.test(e.message));
  assert.throws(() => evaluateCadPart(D([{ id: 'r', kind: 'internal-gear', module: 2, teeth: 30, faceWidth: 5, rim: 90 }])).output('r'), e => (e.details?.category ?? e.code) === 'CAPABILITY' && /UNSUPPORTED_PROFILE_SHIFT/.test(e.message));
  assert.throws(() => evaluateCadPart(D([{ id: 'r', kind: 'internal-gear', module: 2, teeth: 40, faceWidth: 5, rim: 100, generator: 'internal-gear@2' }])).output('r'), e => (e.details?.category ?? e.code) === 'CAPABILITY');
  // A helical ring and pinion, both right-handed, in the part model: placed, clear.
  const h = evaluateCadPart(D([{ id: 'r', kind: 'internal-gear', normalModule: 2, helixAngle: 15, hand: 'right', teeth: 50, faceWidth: 6, rim: 130, thicknessReduction: 0.05 }, { id: 'p', kind: 'spur-gear', normalModule: 2, helixAngle: 15, hand: 'right', teeth: 20, faceWidth: 6, thicknessReduction: 0.05, mesh: { gear: 'r', direction: 45 }, generator: 'spur-gear@1' }]));
  assert.equal(checkPlacedInternalGears(h.output('r').internalGearPlacement, h.output('p').gearPlacement, { mode: 'verdict' }).sweep.interference, false);
  for (const brep of [internalGear({ moduleMM: 2, teeth: 40, faceWidthMM: 5, rimDiameterMM: 100 }, { id: 'r' }).brep, h.output('r').brep]) {
    const back = importStep(exportStep([brep], { name: 'ring' }));
    close(brepMassProperties(back, 1).volumeMM3, brepMassProperties(brep, 1).volumeMM3, 1e-6 * brepMassProperties(brep, 1).volumeMM3, 'round trip');
    assert.ok(back.faces.some(f => f.name === 'r.flankL#1'));
  }
});
