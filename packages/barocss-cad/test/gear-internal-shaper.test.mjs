import test from 'node:test';
import assert from 'node:assert/strict';
import { internalGear, checkInternalGearPair, evaluateCadPart, isGearError, checkBrep, brepMassProperties, exportStep, importStep, evaluateCurve, curveDomain, outputOf } from '../dist/index.js';

// R12b.2b (D133): the shaper-cut internal root — the ring's root the pinion-type cutter generates. Oracles written here,
// apart from gear-internal.ts: the cutter as a closed outline (its involute flanks, tip rounds and tip arc) rolled inside
// the ring, its signed distance maximised over the motion (a point on the cut boundary is touched, never entered); the
// cutting distance by the zero-backlash condition; the root circle; the area of the boundary built here; and K1's
// Table 4.8(1) — a cutter's least ring for radial infeed (sourced values).
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (|Δ| ${Math.abs(a - b).toExponential(3)} > ${tol})`);
const ALPHA = 20 * Math.PI / 180, TAN = Math.tan(ALPHA), COS = Math.cos(ALPHA), inv = p => Math.tan(p) - p;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const SURVEY = !!process.env.GEAR_SURVEY;

/**
 * The cutting: the ring (z2, x2, reduction j), the cutter (z0, x0, tip ρ0: addendum 1.25m + x0 m, tooth m(π/2 + 2x0 tan α)),
 * the cutting distance by z2(ψ_s − inv α_c) = z0(ψ0 − inv α_c), and the cutter's tooth as a polar outline (centred on +Y
 * from its centre at (0, a_c), the frame where the ring's space being cut is centred on +Y).
 */
function cutting({ m, z2, x2 = 0, j = 0, z0, x0 = 0, rho }) {
  const r2 = m * z2 / 2, rb2 = r2 * COS, psiS = (m * (Math.PI / 2 + 2 * x2 * TAN) + j) / (2 * r2) + inv(ALPHA), ra2 = r2 - (1 - x2) * m;
  const r0 = m * z0 / 2, rb0 = r0 * COS, ra0 = r0 + (1.25 + x0) * m, psi0 = m * (Math.PI / 2 + 2 * x0 * TAN) / (2 * r0) + inv(ALPHA);
  const target = (z2 * psiS - z0 * psi0) / (z2 - z0);
  let w = ALPHA; for (let i = 0; i < 80; i++) w -= (inv(w) - target) / Math.tan(w) ** 2;
  const ac = m * (z2 - z0) / 2 * COS / Math.cos(w), rw2 = ac * z2 / (z2 - z0);
  // The cutter's right flank (its tooth centred on +Y): roll t ↦ point about the cutter's centre and outward normal.
  const flank = t => { const a = Math.PI / 2 - psi0 + t - Math.atan(t), rr = rb0 * Math.sqrt(1 + t * t), b = Math.PI / 2 - psi0 + t; return { x: rr * Math.cos(a), y: ac + rr * Math.sin(a), nx: Math.sin(b), ny: -Math.cos(b) }; };
  const tTip = Math.sqrt((ra0 / rb0) ** 2 - 1);
  // The round: its centre on the flank's inward offset at radius ra0 − ρ (bisection here).
  let lo = 0, hi = tTip;
  for (let i = 0; i < 200; i++) { const t = (lo + hi) / 2, f = flank(t), R = Math.hypot(f.x - rho * f.nx, f.y - rho * f.ny - ac); if (R < ra0 - rho) lo = t; else hi = t; }
  const tq = (lo + hi) / 2, fq = flank(tq), qx = fq.x - rho * fq.nx, qy = fq.y - rho * fq.ny;
  return { m, z2, z0, r2, rb2, psiS, ra2, rf: ac + ra0, r0, rb0, ra0, psi0, ac, rw2, alphaC: w, rho, tq, qx, qy, flank, tTip };
}
/**
 * The cutter's signed distance at a point of the world frame (cutter not turned): + inside its tooth near the tip — the
 * tooth on +Y between its two flanks from the base circle up, capped by the rounds and the tip arc. By the cutter's
 * star shape about its centre for inside, and the nearest of its pieces for the distance.
 */
function cutterDistance(C, px, py) {
  const dx = px - 0, dy = py - C.ac, R = Math.hypot(dx, dy);
  let u = Math.atan2(dy, dx) - Math.PI / 2; const step = 2 * Math.PI / C.z0; u -= step * Math.round(u / step);
  // Fold to the right half of a tooth (u ≤ 0 the right side): the mirror for the left.
  const ux = R * Math.cos(Math.PI / 2 - Math.abs(u)), uy = C.ac + R * Math.sin(Math.PI / 2 - Math.abs(u));
  // Distance to the right flank (involute from the base circle to the round's tangent point), by a scan and golden section.
  const fd = t => { const f = C.flank(t); return Math.hypot(ux - f.x, uy - f.y); };
  let best = Infinity, at = 0;
  for (let i = 0; i <= 80; i++) { const t = C.tq * i / 80, v = fd(t); if (v < best) { best = v; at = t; } }
  let a = Math.max(0, at - C.tq / 80), b = Math.min(C.tq, at + C.tq / 80);
  for (let i = 0; i < 60; i++) { const m1 = a + (b - a) * 0.382, m2 = a + (b - a) * 0.618; if (fd(m1) < fd(m2)) b = m2; else a = m1; }
  const dFlank = Math.min(best, fd((a + b) / 2));
  // The round (its arc between the flank tangent and the tip junction) and the tip arc (from the junction to the middle).
  const angQ = Math.atan2(C.qy - C.ac, C.qx), angP = Math.atan2(uy - C.qy, ux - C.qx), tang = C.flank(C.tq), angT = Math.atan2(tang.y - C.qy, tang.x - C.qx);
  const onArc = angP >= Math.min(angT, angQ) - 1e-12 && angP <= Math.max(angT, angQ) + 1e-12;
  const dRound = onArc ? Math.abs(Math.hypot(ux - C.qx, uy - C.qy) - C.rho) : Infinity;
  const angU = Math.atan2(uy - C.ac, ux), dTip = angU >= angQ && angU <= Math.PI / 2 ? Math.abs(Math.hypot(ux, uy - C.ac) - C.ra0) : Infinity;
  const d = Math.min(dFlank, dRound, dTip, Math.hypot(ux - tang.x, uy - tang.y), Math.hypot(ux - C.ra0 * Math.cos(angQ), uy - C.ac - C.ra0 * Math.sin(angQ)));
  // Inside: below the outline's radius on this ray (the flank from the base up, the round, the tip) — and above the base circle.
  const rayAng = Math.atan2(uy - C.ac, ux);
  let outline;
  if (rayAng >= angQ) outline = C.ra0;
  else {
    // The outline radius on this ray: bisection along the flank (and the round), its polar angle about the cutter's centre falling as t rises.
    const polar = t => { const f = C.flank(t); return Math.atan2(f.y - C.ac, f.x); };
    if (rayAng < polar(0)) return -d; // (below the flank's start: outside the tooth's working part)
    if (rayAng <= polar(C.tq)) { let l = 0, h = C.tq; for (let i = 0; i < 60; i++) { const mm = (l + h) / 2; if (polar(mm) < rayAng) l = mm; else h = mm; } const f = C.flank((l + h) / 2); outline = Math.hypot(f.x, f.y - C.ac); }
    else { // the round: the ray meets the circle (centre q, radius ρ) at its far point
      const ex = Math.cos(rayAng), ey = Math.sin(rayAng), cx = C.qx, cy = C.qy - C.ac, bq = ex * cx + ey * cy, disc = bq * bq - (cx * cx + cy * cy - C.rho * C.rho);
      outline = bq + Math.sqrt(Math.max(0, disc));
    }
  }
  return R < outline ? d : -d;
}
/** How deep the ring point p ever gets into the cutter (the ring turned φ, the cutter φ z2/z0 the same way). */
function maxPenetration(C, px, py) {
  const span = 4 * Math.PI / C.z2 + 0.3, n = 700, k = C.z2 / C.z0, at = phi => {
    // The ring point at world Rot(φ)p; into the cutter's frame by turning back −φ k about its centre.
    const c = Math.cos(phi), s = Math.sin(phi), wx = c * px - s * py, wy = s * px + c * py, cc = Math.cos(-phi * k), ss = Math.sin(-phi * k), dy = wy - C.ac;
    return cutterDistance(C, cc * wx - ss * dy, C.ac + ss * wx + cc * dy);
  };
  let best = -Infinity, arg = 0;
  for (let i = 0; i <= n; i++) { const phi = -span + 2 * span * i / n, v = at(phi); if (v > best) { best = v; arg = phi; } }
  let lo = arg - 2 * span / n, hi = arg + 2 * span / n;
  for (let i = 0; i < 80 && hi - lo > 1e-14; i++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (at(m1) > at(m2)) hi = m2; else lo = m1; }
  return Math.max(best, at((lo + hi) / 2));
}
/** The ring's own profile curves at z 0, by face name (as the R12b.1a test). */
function profileCurves(brep) {
  const edges = new Map(brep.edges.map(e => [e.id, e])), coedges = new Map(brep.coedges.map(c => [c.id, c])), loops = new Map(brep.loops.map(l => [l.id, l])), out = [];
  for (const f of brep.faces) {
    if (!f.name || /face[01]$|rim/.test(f.name)) continue;
    for (const lid of f.loops) for (const cid of loops.get(lid).coedges) { const e = edges.get(coedges.get(cid).edge); if (e.curve.controlPoints.every(p => Math.abs(p[2]) < 1e-12)) out.push({ name: f.name, curve: e.curve }); }
  }
  return out;
}
/** The largest |penetration| along the space before tooth 1 (its fillets, root and flanks near the root): into the frame where it is centred on +Y. */
function worstOn(brep, C, pattern, per = 14) {
  let worst = 0;
  // (Space 1 is centred at −π/z2: turned by π/2 + π/z2 onto +Y.)
  const g = Math.PI / 2 + Math.PI / C.z2, c = Math.cos(g), s = Math.sin(g);
  for (const { name, curve } of profileCurves(brep)) {
    if (!pattern.test(name)) continue;
    const [t0, t1] = curveDomain(curve), q0 = evaluateCurve(curve, (t0 + t1) / 2), a = Math.atan2(q0[1], q0[0]);
    let d = a + Math.PI / C.z2; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    if (Math.abs(d) > Math.PI / C.z2) continue; // (only this space's)
    for (let i = 1; i < per; i++) { const q = evaluateCurve(curve, t0 + (t1 - t0) * i / per); worst = Math.max(worst, Math.abs(maxPenetration(C, c * q[0] - s * q[1], s * q[0] + c * q[1]))); }
  }
  return worst;
}

const CASES = SURVEY ? [[2, 60, 0.5, 24, 0], [2, 60, 0, 24, 0], [2, 40, 0.5, 20, 0], [2, 80, 0.25, 30, 0.2], [2, 48, 0, 30, 0], [3, 50, 0.3, 25, 0.1]] : [[2, 60, 0.5, 24, 0], [2, 48, 0, 30, 0], [2, 80, 0.25, 30, 0.2]];

test('the shaper-cut ring (refused at the previous HEAD): valid; the cutting distance and the root circle a_c + ra0; its own curves on the boundary the cutter cuts — the fillets within their fit, the root arc and the flanks', t => {
  for (const [m, z2, x2, z0, x0] of CASES) {
    const spec = { moduleMM: m, teeth: z2, faceWidthMM: 6, rimDiameterMM: m * z2 + 15 * m, profileShiftCoefficient: x2, rootPolicy: 'shaper-cut', cutter: { teeth: z0, profileShiftCoefficient: x0 } };
    const { brep, report } = internalGear(spec, { id: 'r' }), sr = report.shaperRoot;
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues?.[0]); assert.equal(report.generator, 'internal-gear@1');
    const C = cutting({ m, z2, x2, z0, x0, rho: sr.cutterTipRadiusMM });
    close(sr.cuttingCenterDistanceMM, C.ac, 1e-9 * m, 'a_c'); close(report.dimensions.rootDiameterMM, 2 * C.rf, 1e-9 * m, 'root a_c + ra0');
    const t0 = performance.now(), fil = worstOn(brep, C, /fillet[LR]\d?#/), root = worstOn(brep, C, /\.root#/, 6), fl = worstOn(brep, C, /flank[LR]#/, 8);
    assert.ok(fil <= sr.filletDeviationMM * 1.001 + 1e-9, `z${z2}/z0 ${z0}: fillets ${fil} vs fit ${sr.filletDeviationMM}`);
    assert.ok(root <= 1e-9 * m, `root ${root}`); assert.ok(fl <= report.profileDeviationMM * 1.001 + 1e-9, `flanks ${fl}`);
    t.diagnostic(`m${m} z${z2} x2 ${x2} cutter z0 ${z0} x0 ${x0} ρ ${sr.cutterTipRadiusMM.toFixed(4)}: a_c ${sr.cuttingCenterDistanceMM.toFixed(6)}, root Ø${report.dimensions.rootDiameterMM.toFixed(4)}, |penetration| fillets ${fil.toExponential(2)} (fit ${sr.filletDeviationMM.toExponential(2)}, ${sr.filletPieces} pieces), root ${root.toExponential(2)}, flanks ${fl.toExponential(2)} (${(performance.now() - t0).toFixed(0)} ms)`);
  }
});

test('K1 Table 4.8(1) — a cutter\'s least ring (x0 = x2 = 0, radial infeed): the table\'s z2 builds, z2 − 1 is refused (the trimming the cutter makes fed in); the cutter\'s involute interference refused, a ring shift clears it', () => {
  // (K1, "Calculation of Gear Dimensions", Table 4.8(1), retrieved 2026-10-20: z0 → least z2. Rows from 24 teeth up,
  // where the cutter's involute interference — K1's note for z0 15–22 — does not come first.)
  const rows = SURVEY ? [[24, 42], [25, 43], [27, 45], [28, 46], [30, 48], [31, 49], [32, 50], [33, 51], [34, 52], [35, 53], [38, 56], [40, 58], [42, 60], [44, 62], [48, 66], [50, 68], [56, 74], [60, 78]] : [[24, 42], [30, 48], [40, 58], [60, 78]];
  for (const [z0, z2] of rows) {
    const g = n => ({ moduleMM: 2, teeth: n, faceWidthMM: 4, rimDiameterMM: 2 * n + 30, rootPolicy: 'shaper-cut', cutter: { teeth: z0 } });
    assert.equal(checkBrep(internalGear(g(z2)).brep).valid, true, `z0 ${z0}, z2 ${z2} builds`);
    assert.throws(() => internalGear(g(z2 - 1)), e => isGearError(e) && e.code === 'TRIMMING_INTERFERENCE', `z0 ${z0}, z2 ${z2 - 1} refused`);
  }
  // A 20-tooth cutter in a 60-tooth ring: the ring's tips meet it below its base circle — refused; shifted x2 0.5, cut.
  assert.throws(() => internalGear({ moduleMM: 2, teeth: 60, faceWidthMM: 4, rimDiameterMM: 150, rootPolicy: 'shaper-cut', cutter: { teeth: 20 } }), e => e.code === 'INVOLUTE_INTERFERENCE' && /ring shift/.test(e.message));
  assert.equal(checkBrep(internalGear({ moduleMM: 2, teeth: 60, faceWidthMM: 4, rimDiameterMM: 150, profileShiftCoefficient: 0.5, rootPolicy: 'shaper-cut', cutter: { teeth: 20 } }).brep).valid, true);
});

test('the radial infeed geometrically: the cutter as a pinion (addendum 1.25 m, its tooth πm/2) moved straight in — the product\'s radial insertion — crosses where K1\'s table says for cutters of 27 teeth and more; at 24 and 25 the straight path clears one ring tooth below the table, which the condition (the refusal\'s) does not', () => {
  const cutter = (z0, z2) => checkInternalGearPair({ moduleMM: 2, teeth: z0, faceWidthMM: 4, profileShiftCoefficient: 0.25, toothThicknessReductionMM: 0.5 * 2 * TAN, rootPolicy: 'generated' }, { moduleMM: 2, teeth: z2, faceWidthMM: 4, rimDiameterMM: 2 * z2 + 30 }, { mode: 'verdict' }).interference.trimming;
  const rows = SURVEY ? [[27, 45], [28, 46], [30, 48], [31, 49], [32, 50], [33, 51], [40, 58], [50, 68], [100, 118]] : [[27, 45], [40, 58]];
  for (const [z0, z2] of rows) for (const [n, cross] of [[z2, false], [z2 - 1, true]]) assert.equal(cutter(z0, n).sweepInterference, cross, `${z0} moved into ${n}`);
  // (24 → 42 and 25 → 43 in K1's table: the straight path clears 41 and 42 — by 0.057 and 0.023 mm — the condition does
  // not, so the product's verdict, either of them, flags them; D133.)
  for (const [z0, n] of [[24, 41], [25, 42]]) { const t = cutter(z0, n); assert.equal(t.sweepInterference, false); assert.ok(t.conditionMargin < 0); assert.equal(t.interference, true); }
});

test('the volume against the area of the boundary built here (the cutter rolled, its round\'s envelope by this file\'s own construction); refusals; the part model\'s internal-gear@1 and a pinion inside it; STEP', () => {
  const m = 2, z2 = 48, z0 = 30, b = 5, R = 63;
  const { brep, report } = internalGear({ moduleMM: m, teeth: z2, faceWidthMM: b, rimDiameterMM: 2 * R, rootPolicy: 'shaper-cut', cutter: { teeth: z0 } });
  const C = cutting({ m, z2, z0, rho: report.shaperRoot.cutterTipRadiusMM });
  // This file's own envelope: for each turn φ, the round's point on the line from its centre away from the pitch point.
  const env = phi => { const k = z2 / z0, c = Math.cos(phi * k), s = Math.sin(phi * k), Qx = c * C.qx - s * (C.qy - C.ac), Qy = C.ac + s * C.qx + c * (C.qy - C.ac), dx = Qx, dy = Qy - C.rw2, L = Math.hypot(dx, dy), wx = Qx + C.rho * dx / L, wy = Qy + C.rho * dy / L, cr = Math.cos(phi), sr = Math.sin(phi); return [cr * wx + sr * wy, -sr * wx + cr * wy]; };
  const phiRoot = (Math.PI / 2 - Math.atan2(C.qy - C.ac, C.qx)) * z0 / z2;
  // The fillet's end by this file's own condition: the turn at which the round touches at its tangent point with the
  // cutter's flank (the contact normal along the round's radius there), by a scan for the sign change and bisection.
  const T = C.flank(C.tq), k = z2 / z0, cond = phi => { const c = Math.cos(phi * k), s = Math.sin(phi * k), Qx = c * C.qx - s * (C.qy - C.ac), Qy = C.ac + s * C.qx + c * (C.qy - C.ac), Tx = c * T.x - s * (T.y - C.ac), Ty = C.ac + s * T.x + c * (T.y - C.ac); return Qx * (Ty - Qy) - (Qy - C.rw2) * (Tx - Qx); };
  let fa = phiRoot, fb = phiRoot;
  for (let i = 1; i <= 4000; i++) { fb = phiRoot - 6 * Math.PI / z2 * i / 4000; if (Math.sign(cond(fb)) !== Math.sign(cond(phiRoot))) break; fa = fb; }
  for (let i = 0; i < 200; i++) { const mid = (fa + fb) / 2; if (Math.sign(cond(mid)) === Math.sign(cond(fb))) fb = mid; else fa = mid; }
  const phiEnd = (fa + fb) / 2, rStart = Math.hypot(...env(phiEnd)), invAt = r => Math.PI / 2 - C.psiS + inv(Math.acos(Math.min(1, C.rb2 / r)));
  close(rStart, report.shaperRoot.formDiameterMM / 2, 1e-9 * m, 'the fillet\'s end (the product\'s form diameter)');
  close(Math.atan2(env(phiEnd)[1], env(phiEnd)[0]), invAt(rStart), 1e-9, 'the fillet ends on the ring\'s involute');
  // One space, centred on +Y, as a closed polyline with the centre: tip arc half, involute out, fillet, root arc half, mirrored.
  const n = 20000, right = [], step = 2 * Math.PI / z2, aTip = invAt(C.ra2);
  for (let i = 0; i <= n; i++) { const a = Math.PI / 2 - step / 2 + (aTip - Math.PI / 2 + step / 2) * i / n; right.push([C.ra2 * Math.cos(a), C.ra2 * Math.sin(a)]); }
  const t0 = Math.sqrt((C.ra2 / C.rb2) ** 2 - 1), t1 = Math.sqrt((rStart / C.rb2) ** 2 - 1);
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, r = C.rb2 * Math.sqrt(1 + t * t); right.push([r * Math.cos(invAt(r)), r * Math.sin(invAt(r))]); }
  for (let i = 0; i <= n; i++) right.push(env(phiEnd + (phiRoot - phiEnd) * i / n));
  const aJ = Math.atan2(env(phiRoot)[1], env(phiRoot)[0]);
  for (let i = 0; i <= n; i++) { const a = aJ + (Math.PI / 2 - aJ) * i / n; right.push([C.rf * Math.cos(a), C.rf * Math.sin(a)]); }
  const mirror = ([x, y]) => [-x, y], pts = [...right, ...right.slice().reverse().map(mirror), [0, 0]];
  let A = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += p[0] * q[1] - q[0] * p[1]; }
  const hole = Math.abs(A) / 2 * z2, want = (Math.PI * R * R - hole) * b, got = brepMassProperties(brep, 1).volume;
  const slack = 2 * z2 * (report.profileDeviationMM * 2.25 * m + report.shaperRoot.filletDeviationMM * 1.5 * m) * b + 1e-9 * want;
  close(got, want, slack, 'ring volume');
  // Refusals: helical; a cutter missing; a cutter too large; a tip radius the cutter's tooth cannot hold; a cutter without the policy.
  const code = (spec, c, re) => assert.throws(() => internalGear(spec), e => isGearError(e) && e.code === c && (!re || re.test(e.message)), JSON.stringify(spec));
  const base = { moduleMM: 2, teeth: 48, faceWidthMM: 4, rimDiameterMM: 126, rootPolicy: 'shaper-cut', cutter: { teeth: 30 } };
  code({ ...base, moduleMM: undefined, normalModuleMM: 2, helixAngleDeg: 15, hand: 'right' }, 'UNSUPPORTED_GEAR_KIND');
  code({ ...base, cutter: undefined }, 'INVALID_INPUT', /cutter's teeth/);
  code({ ...base, cutter: { teeth: 45 } }, 'INVALID_INPUT');
  code({ ...base, cutter: { teeth: 30, tipRadiusMM: 2 } }, 'INVALID_INPUT', /at most 0\.7\d+/);
  code({ moduleMM: 2, teeth: 48, faceWidthMM: 4, rimDiameterMM: 126, cutter: { teeth: 30 } }, 'INVALID_INPUT', /shaper-cut/);
  assert.equal(report.diagnostics[0].code, 'ROOT_TRANSITION_UNVALIDATED'); assert.match(report.diagnostics[0].message, /estimate/);
  assert.deepEqual(internalGear({ ...base, cutter: { teeth: 30, tipRadiusMM: 0.5 } }).report.diagnostics, []);
  // The part model: internal-gear@1 with its cutter; a pinion inside it, clear.
  const r = evaluateCadPart(D([{ id: 'r', kind: 'internal-gear', module: 2, teeth: 60, faceWidth: 4, rim: 150, profileShift: 0.5, thicknessReduction: 0.05, generator: 'internal-gear@1', cutter: { teeth: 24 } }, { id: 'p', kind: 'spur-gear', module: 2, teeth: 24, faceWidth: 4, thicknessReduction: 0.05, mesh: { gear: 'r' }, generator: 'spur-gear@1' }]));
  assert.equal(outputOf(r, 'r').internalGear.rootPolicy, 'shaper-cut'); assert.ok(outputOf(r, 'r').brep.faces.some(f => f.name === 'r.filletL#1'));
  assert.throws(() => outputOf(evaluateCadPart(D([{ id: 'r', kind: 'internal-gear', module: 2, teeth: 60, faceWidth: 4, rim: 150, generator: 'internal-gear@1' }])), 'r'), e => e.code === 'INPUT' && /cutter/.test(e.message));
  assert.throws(() => outputOf(evaluateCadPart(D([{ id: 'r', kind: 'internal-gear', module: 2, teeth: 60, faceWidth: 4, rim: 150, cutter: { teeth: 24 } }])), 'r'), e => e.code === 'INPUT');
  const back = importStep(exportStep([brep], { name: 'ring' }));
  close(brepMassProperties(back, 1).volume, got, 1e-6 * got, 'round trip'); assert.ok(back.faces.some(f => /fillet/.test(f.name)));
});
