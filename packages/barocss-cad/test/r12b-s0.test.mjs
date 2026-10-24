import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep, brepMassProperties, spurGear, spurGearDimensions, isGearError } from '../dist/index.js';
import { twistDeviation } from '../dist/machine/gear.js';

// R12b S0 (D129): the feasibility checkpoint before internal, bevel and worm gears and the tool-generated root. No
// research note; probed here against oracles written in this file, apart from the generators: closed forms, a
// brute-force cutting simulation, and sweeps of the exact (analytic) outlines. No product code changed.
//
// What it asks: whether today's kernel already builds an internal gear (and how exactly); whether the rack-generated
// root's parametric envelope agrees with a simulated cut and with the textbook form circle; whether a straight bevel pair
// of spherical involutes is conjugate on the sphere (and a Tredgold back-cone profile is not); whether a flank on the
// sphere can be held exactly on it; and what a worm needs of the helical machinery.
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (|Δ| ${Math.abs(a - b).toExponential(3)} > ${tol})`);
const ALPHA = 20 * Math.PI / 180, TAN = Math.tan(ALPHA), inv = p => Math.tan(p) - p;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });

// ——— Planar outlines, apart from gear.ts ———

/**
 * An external gear's exact outline, all teeth, as one closed polyline [x0, y0, x1, y1, …] about the origin, tooth k
 * centred on angle 2πk/z + turn: root half-arc, a radial join when the root lies under the base circle, the analytic
 * involute (F points a flank, uniform in its roll), the tip arc, the other flank, the root half-arc. `tipR` and `rootR`
 * override the shifted rack's ra = r + m(1 + x) and rf = r − m(1.25 − x).
 */
function gearOutline({ m, z, x = 0, red = 0, tipR, rootR, F = 600, A = 40 }) {
  const r = m * z / 2, rb = r * Math.cos(ALPHA), ra = tipR ?? r + m * (1 + x), rf = rootR ?? r - m * (1.25 - x), r0 = Math.max(rb, rf), step = 2 * Math.PI / z;
  const psi = (m * (Math.PI / 2 + 2 * x * TAN) - red) / (2 * r) + inv(ALPHA), psiS = psi - inv(Math.acos(rb / r0)), psiT = psi - inv(Math.acos(rb / ra));
  const t0 = Math.sqrt(Math.max(0, (r0 / rb) ** 2 - 1)), t1 = Math.sqrt((ra / rb) ** 2 - 1), pts = [];
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
/** The polygon's area by the shoelace formula (counter-clockwise positive). */
function polygonArea(P) { let A = 0; for (let i = 0; i + 3 < P.length; i += 2) A += P[i] * P[i + 3] - P[i + 2] * P[i + 1]; return A / 2; }

/** The segments [ax, ay, bx, by] of polyline P turned by `turn` about the origin, then moved by (cx, cy), kept where `keep` holds for an end. */
function placedSegments(P, turn, cx, cy, keepCx, keepCy, keepR, outside) {
  const c = Math.cos(turn), s = Math.sin(turn), out = [];
  let px = c * P[0] - s * P[1] + cx, py = s * P[0] + c * P[1] + cy, pk = (Math.hypot(px - keepCx, py - keepCy) >= keepR) === outside;
  for (let i = 2; i < P.length; i += 2) {
    const qx = c * P[i] - s * P[i + 1] + cx, qy = s * P[i] + c * P[i + 1] + cy, qk = (Math.hypot(qx - keepCx, qy - keepCy) >= keepR) === outside;
    if (pk || qk) out.push(px, py, qx, qy);
    px = qx; py = qy; pk = qk;
  }
  return Float64Array.from(out);
}
const orient = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
function pointSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
/**
 * The least distance between two sets of segments, and whether any two cross (properly), by a uniform grid of cell
 * `h` over B: only distances below h are seen (larger ones come back as h).
 */
function segmentClearance(Sa, Sb, h) {
  const grid = new Map();
  for (let j = 0; j < Sb.length; j += 4) {
    const x0 = Math.floor(Math.min(Sb[j], Sb[j + 2]) / h), x1 = Math.floor(Math.max(Sb[j], Sb[j + 2]) / h), y0 = Math.floor(Math.min(Sb[j + 1], Sb[j + 3]) / h), y1 = Math.floor(Math.max(Sb[j + 1], Sb[j + 3]) / h);
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) { const key = ix * 1000003 + iy, list = grid.get(key); if (list) list.push(j); else grid.set(key, [j]); }
  }
  let best = h, crossed = false;
  for (let i = 0; i < Sa.length; i += 4) {
    const ax = Sa[i], ay = Sa[i + 1], bx = Sa[i + 2], by = Sa[i + 3];
    const x0 = Math.floor(Math.min(ax, bx) / h) - 1, x1 = Math.floor(Math.max(ax, bx) / h) + 1, y0 = Math.floor(Math.min(ay, by) / h) - 1, y1 = Math.floor(Math.max(ay, by) / h) + 1;
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      const list = grid.get(ix * 1000003 + iy); if (!list) continue;
      for (const j of list) {
        const cx = Sb[j], cy = Sb[j + 1], dx = Sb[j + 2], dy = Sb[j + 3];
        const o1 = orient(ax, ay, bx, by, cx, cy), o2 = orient(ax, ay, bx, by, dx, dy), o3 = orient(cx, cy, dx, dy, ax, ay), o4 = orient(cx, cy, dx, dy, bx, by);
        if (o1 * o2 < 0 && o3 * o4 < 0) crossed = true;
        const d = Math.min(pointSegment(ax, ay, cx, cy, dx, dy), pointSegment(bx, by, cx, cy, dx, dy), pointSegment(cx, cy, ax, ay, bx, by), pointSegment(dx, dy, ax, ay, bx, by));
        if (d < best) best = d;
      }
    }
  }
  return { min: best, crossed };
}

/**
 * An internal pair swept through one pinion tooth period: the ring (its tooth spaces the outline of a "space gear",
 * x 0.25 and thinned by 2·0.25·m·tan α less the backlash j, so its spaces are πm/2 + j wide at the reference circle,
 * its tip r2 − m and root r2 + 1.25m) about the origin, the pinion about (a, 0) with a = m(z2 − z1)/2, a pinion tooth
 * in a ring space on +X; the ring turning θ z1/z2 as the pinion turns θ, the same way. Returns the least clearance over
 * the samples, and the samples at which the outlines cross.
 */
function internalSweep({ m, z1, z2, j = 0, samples = 96, F = 600, ringTipR }) {
  const P = gearOutline({ m, z: z1, F }), Q = gearOutline({ m, z: z2, x: 0.25, red: 0.5 * m * TAN - j, F, ...(ringTipR ? { rootR: ringTipR } : {}) });
  const a = m * (z2 - z1) / 2, r2 = m * z2 / 2, ra1 = m * z1 / 2 + m, tip2 = ringTipR ?? r2 - m, crossings = [];
  let least = Infinity;
  for (let i = 0; i < samples; i++) {
    const th = 2 * Math.PI / z1 * i / samples;
    const Sa = placedSegments(P, th, a, 0, 0, 0, tip2 - 0.25 * m, true), Sb = placedSegments(Q, th * z1 / z2, 0, 0, a, 0, ra1 + 0.25 * m, false);
    const c = segmentClearance(Sa, Sb, 0.05 * m);
    if (c.crossed) crossings.push(i); else least = Math.min(least, c.min);
  }
  return { least, crossings };
}

test('R12b S0 today: an internal gear is an annulus less a "space gear" (a spur gear at x 0.25 thinned by 0.5·m·tan α), exactly, by the part model as it stands', t => {
  const m = 2, z = 40, b = 10, R = 50, red = 0.5 * m * TAN;
  // The space gear's dimensions are the ring's turned inside out: its tip r + 1.25m the ring's root, its root r − m the
  // ring's tip, its tooth πm/2 at the reference circle the ring's space.
  const g = spurGearDimensions({ moduleMM: m, teeth: z, faceWidthMM: b, profileShiftCoefficient: 0.25, toothThicknessReductionMM: red });
  close(g.tipDiameterMM / 2, m * z / 2 + 1.25 * m, 1e-12, 'ring root'); close(g.rootDiameterMM / 2, m * z / 2 - m, 1e-12, 'ring tip'); close(g.toothThicknessMM, Math.PI * m / 2, 1e-12, 'ring space');
  const doc = D([
    { id: 'c', kind: 'sketch', profile: 'circle', center: [0, 0], radius: R }, { id: 'e', kind: 'extrude', sketch: 'c', height: b },
    { id: 's', kind: 'spur-gear', module: m, teeth: z, faceWidth: b + 2, from: -1, profileShift: 0.25, thicknessReduction: red },
    { id: 'ring', kind: 'difference', target: 'e', tool: 's' },
  ]);
  const t0 = performance.now(), brep = evaluateCadPart(doc).output('ring').brep, ms = performance.now() - t0;
  assert.equal(brep.bodies.length, 1); assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues?.[0]);
  // The volume: (πR² − the space gear's exact area) × b, the exact area by the analytic outline here (200 000 chords
  // round it), within the generator's measured flank deviation over 2z flanks.
  const area = polygonArea(gearOutline({ m, z, x: 0.25, red, F: 1500 })), dev = spurGear({ moduleMM: m, teeth: z, faceWidthMM: b, profileShiftCoefficient: 0.25, toothThicknessReductionMM: red }).report.profileDeviationMM;
  const want = (Math.PI * R * R - area) * b, got = brepMassProperties(brep, 1).volumeMM3;
  close(got, want, 2 * z * dev * 2.25 * m * b + 1e-6 * want, 'ring volume');
  // The ring's inner faces are the space gear's, its flanks the involute's (concave towards the ring's material).
  const names = brep.faces.map(f => f.name);
  assert.ok(names.includes('s.flankL#1') && names.includes('s.tip#40') && names.includes('s.root#1'), names.slice(0, 8).join(' '));
  t.diagnostic(`ring m2 z40 Ø100×10: V ${got.toFixed(4)} vs ${want.toFixed(4)} (Δ ${(got / want - 1).toExponential(2)} rel), ${brep.faces.length} faces, ${ms.toFixed(0)} ms`);
  // Below about 34 teeth the ring's tip (the space gear's root, r − m) falls under the base circle r cos α: the
  // involute cannot reach it, and the space gear joins it by radial lines — a tip no internal gear may have (its mate's
  // tip runs into it: involute interference). R12b refuses it or raises the tip to the base circle (D129).
  const zLimit = 2 / (1 - Math.cos(ALPHA));
  assert.ok(zLimit > 33 && zLimit < 34, `${zLimit}`);
  const low = spurGearDimensions({ moduleMM: m, teeth: 33, faceWidthMM: b, profileShiftCoefficient: 0.25, toothThicknessReductionMM: red });
  assert.ok(low.rootDiameterMM < low.baseDiameterMM);
});

/**
 * The internal pair's interference conditions at the nominal distance (unshifted, α_w = α), in the form commonly
 * published (KHK's are equation images, not retrieved as text: UNSOURCED here, so the sweep checks them). Each is the
 * margin, ≥ 0 when clear: involute z1/z2 − (1 − tan α_a2 / tan α_w); trochoid θ1 z1/z2 + inv α_w − inv α_a2 − θ2.
 */
function internalConditions(m, z1, z2) {
  const a = m * (z2 - z1) / 2, ra1 = m * z1 / 2 + m, ra2 = m * z2 / 2 - m, rb1 = m * z1 / 2 * Math.cos(ALPHA), rb2 = m * z2 / 2 * Math.cos(ALPHA), aw = ALPHA;
  const aa1 = Math.acos(rb1 / ra1), aa2 = Math.acos(rb2 / ra2);
  const th1 = Math.acos((ra2 * ra2 - ra1 * ra1 - a * a) / (2 * a * ra1)) + inv(aa1) - inv(aw), th2 = Math.acos((a * a + ra2 * ra2 - ra1 * ra1) / (2 * a * ra2));
  return { involute: z1 / z2 - (1 - Math.tan(aa2) / Math.tan(aw)), trochoid: th1 * z1 / z2 + inv(aw) - inv(aa2) - th2 };
}

test('R12b S0 probe: an internal pair of exact outlines, swept apart from gear.ts, clears by j·cos α/2 where it is conjugate; the sweep agrees with the involute and trochoid interference conditions', t => {
  const m = 2;
  // m 2, z 24 in z 60 (a 36): the least clearance over a pinion tooth period is j cos α / 2 for j 0.1 and 2e-4 (all but
  // touching), with no crossing — the ring's flanks are conjugate to the pinion's.
  for (const j of [0.1, 2e-4]) {
    const t0 = performance.now(), s = internalSweep({ m, z1: 24, z2: 60, j }), ms = performance.now() - t0;
    assert.deepEqual(s.crossings, []);
    close(s.least, j * Math.cos(ALPHA) / 2, 2e-6, `z24 in z60, j ${j}: least clearance`);
    t.diagnostic(`internal z24/z60 j ${j}: least ${s.least.toExponential(6)} (j cos α/2 ${(j * Math.cos(ALPHA) / 2).toExponential(6)}), ${ms.toFixed(0)} ms`);
  }
  // Pairs on either side of the conditions (j 2e-4, so a breach shows as a crossing or a clearance short of j cos α/2):
  // z 20 in z 60 breaches the involute condition by a hair (the ring's tip reaches under the pinion's base circle,
  // where today's pinion has its schematic radial root); ring z 40 with pinions 24–36 meets the trochoid one or not.
  const j = 2e-4, rows = [];
  for (const [z1, z2] of [[20, 60], [24, 60], [24, 40], [28, 40], [30, 40], [31, 40], [32, 40], [34, 40], [36, 40]]) {
    const s = internalSweep({ m, z1, z2, j, samples: 128 }), c = internalConditions(m, z1, z2);
    const breached = s.crossings.length > 0 || s.least < j * Math.cos(ALPHA) / 2 - 2e-6;
    rows.push({ z1, z2, breached, crossings: s.crossings.length, least: s.least, ...c });
  }
  t.diagnostic(`internal conditions vs sweep (j ${j}): ${rows.map(r => `${r.z1}/${r.z2}: involute ${r.involute.toFixed(4)}, trochoid ${r.trochoid.toFixed(4)} → sweep ${r.crossings ? `crosses ${r.crossings}/128` : r.breached ? `short ${(r.least - j * Math.cos(ALPHA) / 2).toExponential(2)}` : 'clear'}`).join('; ')}`);
  for (const r of rows) assert.equal(r.breached, r.involute < 0 || r.trochoid < 0, `${r.z1}/${r.z2}: the sweep and the conditions disagree`);
  assert.ok(rows.some(r => r.trochoid < 0) && rows.some(r => r.involute < 0) && rows.some(r => !r.breached));
});

// ——— The rack-generated root ———

/**
 * The basic rack as the cutting tool (addendum hA = 1.25m into the gear, the tip rounded by ρ, flanks at α, the tooth
 * πm/2 wide on its reference line), its reference line at y = r + x m above the gear's centre, a tooth on x = 0 pointing
 * down (−y). Its lower outline y_low(x), periodic in πm; the tool is the region above it.
 */
function rackTool(m, z, x, rho) {
  const r = m * z / 2, yRef = r + x * m, hA = 1.25 * m, hc = hA - rho, xc = Math.PI * m / 4 - hc * TAN - rho / Math.cos(ALPHA), yc = yRef - hc;
  return { m, r, yRef, hA, rho, xc, yc, rb: r * Math.cos(ALPHA), rf: yRef - hA, ra: r + m * (1 + x) };
}
function yLow(T, x) {
  const p = Math.PI * T.m;
  let u = x - p * Math.round(x / p); u = Math.abs(u);
  if (u <= T.xc) return T.yRef - T.hA;
  if (u <= T.xc + T.rho * Math.cos(ALPHA)) { const d = u - T.xc; return T.yc - Math.sqrt(Math.max(0, T.rho * T.rho - d * d)); }
  return T.yRef - (Math.PI * T.m / 4 - u) / TAN;
}
/** Whether the gear point at radius R on the ray at angle γ lies in the tool when the gear has turned φ (the rack moved by −rφ). */
function inTool(T, phi, R, g) {
  const c = Math.cos(phi + g), s = Math.sin(phi + g), qx = R * c + T.r * phi, qy = R * s;
  return qy >= yLow(T, qx);
}
/** The first radius at which the ray γ enters the tool turned φ (scan, then bisection), or Infinity. */
function entry(T, phi, g) {
  const lo = T.rf - 0.02 * T.m, hi = T.ra, n = 600;
  let prev = lo;
  if (inTool(T, phi, lo, g)) return lo;
  for (let i = 1; i <= n; i++) {
    const R = lo + (hi - lo) * i / n;
    if (inTool(T, phi, R, g)) { let a = prev, b = R; for (let k = 0; k < 60; k++) { const mid = (a + b) / 2; if (inTool(T, phi, mid, g)) b = mid; else a = mid; } return b; }
    prev = R;
  }
  return Infinity;
}
/** The cut boundary's radius on the ray γ: the least entry over the tool's travel (a scan of φ, then golden section). */
function cutRadius(T, g, span) {
  const n = 400;
  let best = Infinity, at = 0;
  for (let i = 0; i <= n; i++) { const phi = -span + 2 * span * i / n, e = entry(T, phi, g); if (e < best) { best = e; at = phi; } }
  let lo = at - 2 * span / n, hi = at + 2 * span / n;
  const G = 0.618033988749895;
  let x1 = hi - G * (hi - lo), x2 = lo + G * (hi - lo), f1 = entry(T, x1, g), f2 = entry(T, x2, g);
  for (let it = 0; it < 80 && hi - lo > 1e-13; it++) { if (f1 < f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - G * (hi - lo); f1 = entry(T, x1, g); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + G * (hi - lo); f2 = entry(T, x2, g); } }
  return Math.min(best, f1, f2);
}
/**
 * The parametric root fillet (the envelope of the tip round): at the gear's turn φ the round's centre is (xc − rφ, yc),
 * the pitch point (0, r); the gear is touched at the round's point on the line through both, away from the pitch point;
 * that point turned back by −φ into the gear's frame. φ runs from the space's centre side, xc/r, to the flank's
 * tangent point, φ_F.
 */
function filletPoint(T, phi) {
  const cx = T.xc - T.r * phi, cy = T.yc, dx = cx, dy = cy - T.r, L = Math.hypot(dx, dy), px = cx + T.rho * dx / L, py = cy + T.rho * dy / L;
  const c = Math.cos(-phi), s = Math.sin(-phi);
  return [c * px - s * py, s * px + c * py];
}
const phiFlank = T => (T.xc - (T.r - T.yc) / TAN) / T.r;

test('R12b S0 probe: the rack-generated root — its parametric envelope agrees with a brute-force cutting simulation, meets the involute at the textbook form circle, tangentially, and bottoms out at the root circle', t => {
  for (const [m, z, x] of [[2, 20, 0], [3, 12, 0.6], [2, 30, -0.3], [1, 40, 0]]) {
    const rho = 0.38 * m, T = rackTool(m, z, x, rho);
    assert.ok(T.xc > 0, 'the two tip rounds leave a flat');
    // The textbook form circle: the round meets the flank at hF = (1.25 − x)m − ρ(1 − sin α) below the pitch line; the
    // involute it generates starts at sqrt(rb² + (r sin α − hF / sin α)²).
    const hF = (1.25 - x) * m - rho * (1 - Math.sin(ALPHA)), lead = T.r * Math.sin(ALPHA) - hF / Math.sin(ALPHA), rForm = Math.sqrt(T.rb ** 2 + lead ** 2);
    assert.ok(lead > 0, 'not undercut');
    const pF = filletPoint(T, phiFlank(T));
    close(Math.hypot(pF[0], pF[1]), rForm, 1e-9 * m, `m${m} z${z} x${x}: the fillet's end at the form circle`);
    // That end lies on the right tooth's left flank... seen from the space at +Y: the flank cut by the rack's right
    // flank is the involute of the tooth below the space's angle, its polar angle at rForm known in closed form.
    const s = m * (Math.PI / 2 + 2 * x * TAN), psi = s / (2 * T.r) + inv(ALPHA), toothAt = Math.PI / 2 - Math.PI / z;
    const want = toothAt + psi - inv(Math.acos(T.rb / rForm));
    close(Math.atan2(pF[1], pF[0]), want, 1e-9, `m${m} z${z} x${x}: the fillet's end on the involute`);
    // Tangent: the fillet's direction at its end against the involute's there (the involute's tangent makes the angle
    // φ(r) = acos(rb / r) with the radius).
    const h = 1e-6, pA = filletPoint(T, phiFlank(T) + h), tx = pA[0] - pF[0], ty = pA[1] - pF[1], radial = Math.atan2(pF[1], pF[0]);
    const angFillet = Math.atan2(ty, tx) - radial, cosFR = (tx * Math.cos(radial) + ty * Math.sin(radial)) / Math.hypot(tx, ty);
    close(Math.abs(cosFR), T.rb / rForm, 2e-5, `m${m} z${z} x${x}: tangent at the form circle (${angFillet})`);
    // The root circle at the space's centre side of the fillet, r − (1.25 − x)m.
    const p0 = filletPoint(T, T.xc / T.r);
    close(Math.hypot(p0[0], p0[1]), T.r - (1.25 - x) * m, 1e-12 * m, 'root circle');
    // Against the simulated cut, at 41 points along the fillet: the boundary radius on each point's ray.
    let worst = 0;
    const t0 = performance.now();
    for (let i = 0; i <= 40; i++) {
      const phi = T.xc / T.r + (phiFlank(T) - T.xc / T.r) * i / 40, p = filletPoint(T, phi), g = Math.atan2(p[1], p[0]);
      worst = Math.max(worst, Math.abs(cutRadius(T, g, 2 * Math.PI / z) - Math.hypot(p[0], p[1])));
    }
    t.diagnostic(`trochoid m${m} z${z} x${x}: form circle Ø${(2 * rForm).toFixed(6)} (base Ø${(2 * T.rb).toFixed(6)}), envelope vs simulated cut ${worst.toExponential(2)} mm, ${(performance.now() - t0).toFixed(0)} ms`);
    assert.ok(worst <= 1e-7 * m, `m${m} z${z} x${x}: envelope vs cut ${worst}`);
  }
  // ρ = 0.38m puts the round's tangent point 1.25m − 0.38m(1 − sin 20°) = 0.99997m below the reference line: the
  // undercut limit with the rounded tool, z ≥ 2hF/(m sin²α), is the sharp rack's 2/sin²α to 6e-4 teeth.
  const hF = 1.25 - 0.38 * (1 - Math.sin(ALPHA));
  close(2 * hF / Math.sin(ALPHA) ** 2, 2 / Math.sin(ALPHA) ** 2, 6e-4, 'undercut limit');
});

test('R12b S0 probe: an undercut pinion (z 12, x 0) — the simulated cut takes material inside the involute above the base circle, which a parametric root must trim (the round\'s envelope alone is not the boundary)', t => {
  const m = 2, z = 12, T = rackTool(m, z, 0, 0.38 * m);
  const hF = 1.25 * m - 0.38 * m * (1 - Math.sin(ALPHA));
  assert.ok(T.r * Math.sin(ALPHA) - hF / Math.sin(ALPHA) < 0, 'undercut by the formula');
  // On rays crossing the involute just above the base circle, the cut boundary lies below the involute's radius there.
  const psi = Math.PI / 2 / z + inv(ALPHA), toothAt = Math.PI / 2 - Math.PI / z;
  let deepest = 0, atR = 0;
  for (const rr of [1.005, 1.01, 1.02, 1.04, 1.06, 1.08].map(k => k * T.rb)) {
    const g = toothAt + psi - inv(Math.acos(T.rb / rr)), cut = cutRadius(T, g, 2 * Math.PI / z);
    if (rr - cut > deepest) { deepest = rr - cut; atR = rr; }
  }
  t.diagnostic(`undercut z12 x0: the cut reaches ${deepest.toFixed(4)} mm inside the involute (at r ${atR.toFixed(4)}, base ${T.rb.toFixed(4)})`);
  assert.ok(deepest > 0.01 * m, `undercut depth ${deepest}`);
});

// ——— Bevel gears on the sphere ———

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** The spherical involute of the base cone δb (unit sphere, axis +Z) at roll t, from the base circle at azimuth 0. */
function sphInvolute(db, t) {
  const sb = Math.sin(db), cb = Math.cos(db), s = t * sb, cs = Math.cos(s), ss = Math.sin(s), ct = Math.cos(t), st = Math.sin(t);
  // The tangent point T on the base circle, e its ccw tangent; the point lags T along the great circle by s.
  return [cs * sb * ct + ss * st, cs * sb * st - ss * ct, cs * cb];
}
/** The roll at which the spherical involute reaches polar angle θ (cos θ = cos δb cos(t sin δb)). */
const sphRoll = (db, th) => Math.acos(Math.min(1, Math.cos(th) / Math.cos(db))) / Math.sin(db);
const azimuth = p => Math.atan2(p[1], p[0]);
const fromPolar = (th, az) => [Math.sin(th) * Math.cos(az), Math.sin(th) * Math.sin(az), Math.cos(th)];

/**
 * A straight bevel gear's outline on the unit sphere (axis +Z, tooth k centred on azimuth 2πk/z), its flanks
 * `flank(side, θ)` → azimuth at polar angle θ for the left side; tip cone δ + θa, root δ − θf (θa = atan(m/Re), θf =
 * atan(1.25m/Re)), a meridian join under the base cone. Points as unit vectors, one polyline.
 */
function bevelOutline({ z, delta, Re, m, red = 0, flankAz, thetaBase = 0, F = 600, A = 40 }) {
  const th0 = delta - Math.atan(1.25 * m / Re), thA = delta + Math.atan(m / Re), step = 2 * Math.PI / z, lo = Math.max(th0, thetaBase), pts = [];
  // flankAz(θ): the left flank's azimuth (from the tooth's centre) at polar θ, between lo and the tip; the right flank its mirror.
  const halfRed = red / (2 * Re * Math.sin(delta));
  for (let k = 0; k < z; k++) {
    const g = step * k, aS = flankAz(lo) + halfRed, aT = flankAz(thA) + halfRed;
    for (let i = 0; i < A / 2; i++) pts.push(fromPolar(th0, g - step / 2 + (step / 2 + aS) * i / (A / 2)));
    if (th0 < lo) pts.push(fromPolar(th0, g + aS));
    for (let i = 0; i <= F; i++) { const th = lo + (thA - lo) * i / F; pts.push(fromPolar(th, g + flankAz(th) + halfRed)); }
    for (let i = 1; i < A; i++) pts.push(fromPolar(thA, g + aT - 2 * aT * i / A));
    for (let i = F; i >= 0; i--) { const th = lo + (thA - lo) * i / F; pts.push(fromPolar(th, g - flankAz(th) - halfRed)); }
    if (th0 < lo) pts.push(fromPolar(th0, g - aS));
    for (let i = 0; i < A / 2; i++) pts.push(fromPolar(th0, g - aS + (step / 2 + aS) * i / (A / 2)));
  }
  pts.push(pts[0]);
  return pts;
}
/** The spherical involute tooth's left flank: azimuth −ψ + A(θ), ψ = π/(2z) + A(δ), A the involute's azimuth at θ. */
function sphericalFlank(z, delta) {
  const db = Math.asin(Math.sin(delta) * Math.cos(ALPHA)), Aof = th => azimuth(sphInvolute(db, sphRoll(db, th)));
  const psi = Math.PI / (2 * z) + Aof(delta);
  return { db, flankAz: th => -psi + Aof(th) };
}
/**
 * Tredgold's tooth: the virtual spur gear z_v = z / cos δ drawn on the back cone's development (radius Rv = Re tan δ)
 * and wrapped back onto the back cone (azimuth = developed angle / cos δ), then seen from the apex on the sphere. Its
 * left flank's azimuth at polar θ, by solving along the developed involute.
 */
function tredgoldFlank(z, delta, Re, m) {
  const zv = z / Math.cos(delta), rv = Re * Math.tan(delta), rbv = rv * Math.cos(ALPHA), psiv = Math.PI / (2 * zv) + inv(ALPHA), apexZ = Re / Math.cos(delta);
  // A developed point (ρ, ζ) → 3D: from the back cone's apex (0, 0, apexZ) along its generator at azimuth ζ / cos δ.
  const at = (rho, zeta) => { const az = zeta / Math.cos(delta), p = [rho * Math.cos(delta) * Math.cos(az), rho * Math.cos(delta) * Math.sin(az), apexZ - rho * Math.sin(delta)], L = Math.hypot(p[0], p[1], p[2]); return [p[0] / L, p[1] / L, p[2] / L]; };
  const polarOf = rho => Math.acos(at(rho, 0)[2]);
  // Left flank, developed: ζ = −ψv + inv(acos(rbv/ρ)); find ρ for the polar angle θ by bisection (polar grows with ρ).
  const flankAz = th => {
    let a = rbv, b = rv + 3 * m;
    for (let k = 0; k < 80; k++) { const mid = (a + b) / 2; if (polarOf(mid) < th) a = mid; else b = mid; }
    const rho = (a + b) / 2;
    return azimuth(at(rho, -psiv + inv(Math.acos(Math.min(1, rbv / rho)))));
  };
  return { flankAz, thetaBase: polarOf(rbv) };
}
/**
 * A bevel pair on the sphere swept through one tooth period of gear 1 (shaft angle Σ, gear 2's axis at Σ from gear 1's
 * in the XZ plane): gear 2 a space facing gear 1's tooth on the pitch line, turning −θ z1/z2. Clearances by the
 * gnomonic projection on the plane touching the sphere at the pitch point (great circles to lines), in units of Re.
 */
function bevelSweep({ z1, z2, Sigma, outline1, outline2, delta1, samples = 64, Re }) {
  const Pp = [Math.sin(delta1), 0, Math.cos(delta1)], e1 = [0, 1, 0], e2 = [Math.cos(delta1), 0, -Math.sin(delta1)];
  const ax2 = [Math.sin(Sigma), 0, Math.cos(Sigma)];
  // Gear 2's local frame: local Z → ax2, local X → the direction in the XZ plane square to ax2 towards the pitch line.
  const x2 = [Math.cos(Sigma), 0, -Math.sin(Sigma)], lx = dot3(x2, Pp) >= 0 ? x2 : [-x2[0], 0, -x2[2]], ly = [ax2[1] * lx[2] - ax2[2] * lx[1], ax2[2] * lx[0] - ax2[0] * lx[2], ax2[0] * lx[1] - ax2[1] * lx[0]];
  const project = (pts, turn, frame) => {
    const c = Math.cos(turn), s = Math.sin(turn), out = [];
    let prev = null;
    for (const p of pts) {
      const q = [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
      const w = frame ? [q[0] * lx[0] + q[1] * ly[0] + q[2] * ax2[0], q[0] * lx[1] + q[1] * ly[1] + q[2] * ax2[1], q[0] * lx[2] + q[1] * ly[2] + q[2] * ax2[2]] : q;
      const k = dot3(w, Pp), uv = k > Math.cos(0.5) ? [Re * dot3(w, e1) / k, Re * dot3(w, e2) / k] : null;
      if (prev && uv) out.push(prev[0], prev[1], uv[0], uv[1]);
      prev = uv;
    }
    return Float64Array.from(out);
  };
  let least = Infinity, most = -Infinity;
  const crossings = [];
  for (let i = 0; i < samples; i++) {
    const th = 2 * Math.PI / z1 * i / samples, c = segmentClearance(project(outline1, th, false), project(outline2, Math.PI / z2 - th * z1 / z2, true), 0.1);
    if (c.crossed) crossings.push(i); else { least = Math.min(least, c.min); most = Math.max(most, c.min); }
  }
  return { least, most, crossings };
}

test('R12b S0 probe: a straight bevel pair of spherical involutes is conjugate on the sphere — the sweep clears by the same j·cos α/2 at every phase — while Tredgold\'s back-cone profile varies', t => {
  const m = 2, results = [];
  for (const [z1, z2, SigmaDeg] of [[20, 40, 90], [16, 24, 60]]) {
    const Sigma = SigmaDeg * Math.PI / 180, d1 = Math.atan2(Math.sin(Sigma), z2 / z1 + Math.cos(Sigma)), d2 = Sigma - d1, Re = m * z1 / (2 * Math.sin(d1));
    close(Re, m * z2 / (2 * Math.sin(d2)), 1e-9, 'one cone distance');
    // (A small backlash: the gnomonic plane stretches distances away from the pitch point, by about 1% at the ends of
    // the path of contact, so the clearance is read where that stretch is below the chords' sag.)
    const j = 2e-4;
    const S1 = sphericalFlank(z1, d1), S2 = sphericalFlank(z2, d2);
    const o1 = bevelOutline({ z: z1, delta: d1, Re, m, red: j / 2, flankAz: S1.flankAz, thetaBase: S1.db }), o2 = bevelOutline({ z: z2, delta: d2, Re, m, red: j / 2, flankAz: S2.flankAz, thetaBase: S2.db });
    const t0 = performance.now(), sph = bevelSweep({ z1, z2, Sigma, outline1: o1, outline2: o2, delta1: d1, Re }), ms = performance.now() - t0;
    const T1 = tredgoldFlank(z1, d1, Re, m), T2 = tredgoldFlank(z2, d2, Re, m);
    const q1 = bevelOutline({ z: z1, delta: d1, Re, m, red: j / 2, flankAz: T1.flankAz, thetaBase: T1.thetaBase }), q2 = bevelOutline({ z: z2, delta: d2, Re, m, red: j / 2, flankAz: T2.flankAz, thetaBase: T2.thetaBase });
    const tre = bevelSweep({ z1, z2, Sigma, outline1: q1, outline2: q2, delta1: d1, Re });
    results.push({ z1, z2, SigmaDeg, sph, tre });
    t.diagnostic(`bevel z${z1}/z${z2} Σ${SigmaDeg}° (Re ${Re.toFixed(4)}), j ${j}: spherical involute clearance ${sph.least.toExponential(4)}…${sph.most.toExponential(4)}, crossings ${sph.crossings.length} (${ms.toFixed(0)} ms); Tredgold ${Number.isFinite(tre.least) ? `${tre.least.toExponential(4)}…${tre.most.toExponential(4)}` : '—'}, crossings ${tre.crossings.length}/64`);
    // Conjugate: the same clearance at every phase (a few chord sags), and it is the normal backlash's half.
    assert.deepEqual(sph.crossings, []);
    assert.ok(sph.most - sph.least <= 2e-6, `spherical involute clearance varies by ${sph.most - sph.least}`);
    close(sph.least, j * Math.cos(ALPHA) / 2, 2e-6, 'spherical involute clearance = j cos α / 2');
    // Tredgold's is not conjugate: its clearance swings over the period several times more than the spherical
    // involute's (which is the chords' sag and the projection's stretch) — though by little, micrometres at most here.
    assert.ok(tre.crossings.length > 0 || tre.most - tre.least > 5 * (sph.most - sph.least), `Tredgold varies by only ${tre.most - tre.least}`);
  }
});

/** The stereographic projection from the sphere's south pole onto z = 0, and back. */
const stereo = p => [p[0] / (1 + p[2]), p[1] / (1 + p[2])];
const unstereo = (u, v) => { const q = u * u + v * v; return [2 * u / (1 + q), 2 * v / (1 + q), (1 - q) / (1 + q)]; };

test('R12b S0 probe: a spherical involute flank can be held exactly on its sphere — a cubic fitted to its stereographic image lifts to a rational curve on the sphere — within 1e-4·m in a few pieces', t => {
  for (const [m, z, delta, Re] of [[2, 20, Math.atan(0.5), 22.360679775], [2, 40, Math.atan(2), 22.360679775], [3, 12, 30 * Math.PI / 180, 36]]) {
    const db = Math.asin(Math.sin(delta) * Math.cos(ALPHA)), th0 = Math.max(db, delta - Math.atan(1.25 * m / Re)), thA = delta + Math.atan(m / Re), t0 = sphRoll(db, th0), t1 = sphRoll(db, thA);
    // Hermite cubic pieces in the plane through the stereographic images and their roll derivatives (by central
    // differences of the exact curve, h 1e-6), lifted by the inverse projection: every lifted point is on the sphere to
    // rounding; its deviation from the involute measured as the arc to the involute at the same polar angle, × Re.
    const img = t => stereo(sphInvolute(db, t)), der = t => { const a = img(t - 1e-6), b = img(t + 1e-6); return [(b[0] - a[0]) / 2e-6, (b[1] - a[1]) / 2e-6]; };
    let pieces = 0, dev = Infinity, offSphere = 0;
    for (let N = 1; N <= 8 && dev > 1e-4 * m; N++) {
      dev = 0; offSphere = 0; pieces = N;
      for (let k = 0; k < N; k++) {
        const ta = t0 + (t1 - t0) * k / N, tb = t0 + (t1 - t0) * (k + 1) / N, h = tb - ta, P0 = img(ta), P3 = img(tb), D0 = der(ta), D3 = der(tb);
        const P1 = [P0[0] + h / 3 * D0[0], P0[1] + h / 3 * D0[1]], P2 = [P3[0] - h / 3 * D3[0], P3[1] - h / 3 * D3[1]];
        for (let i = 0; i <= 64; i++) {
          const s = i / 64, u = 1 - s, bx = u * u * u * P0[0] + 3 * u * u * s * P1[0] + 3 * u * s * s * P2[0] + s * s * s * P3[0], by = u * u * u * P0[1] + 3 * u * u * s * P1[1] + 3 * u * s * s * P2[1] + s * s * s * P3[1];
          const q = unstereo(bx, by), th = Math.acos(q[2]), exact = sphInvolute(db, sphRoll(db, th));
          offSphere = Math.max(offSphere, Math.abs(Math.hypot(q[0], q[1], q[2]) - 1));
          let da = azimuth(q) - azimuth(exact); if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
          dev = Math.max(dev, Math.abs(da) * Math.sin(th) * Re);
        }
      }
    }
    t.diagnostic(`spherical flank m${m} z${z} δ ${(delta * 180 / Math.PI).toFixed(3)}° Re ${Re}: ${pieces} cubic piece(s) in the plane, deviation ${dev.toExponential(2)} mm (1e-4·m ${1e-4 * m}), off the sphere ${offSphere.toExponential(1)}`);
    assert.ok(dev <= 1e-4 * m && pieces <= 5, `m${m} z${z}: ${pieces} pieces, ${dev}`);
    assert.ok(offSphere <= 1e-15);
  }
});

// ——— Worms ———

/** The Hermite-fitted involute's largest deviation (N pieces over the roll t0 → t1), along the circle at each radius. */
function involuteFit(rb, t0, t1, N) {
  const P = t => [rb * (Math.cos(t) + t * Math.sin(t)), rb * (Math.sin(t) - t * Math.cos(t))], Dv = t => [rb * t * Math.cos(t), rb * t * Math.sin(t)];
  let worst = 0;
  for (let k = 0; k < N; k++) {
    const ta = t0 + (t1 - t0) * k / N, tb = t0 + (t1 - t0) * (k + 1) / N, h = tb - ta, P0 = P(ta), P3 = P(tb), D0 = Dv(ta), D3 = Dv(tb), P1 = [P0[0] + h / 3 * D0[0], P0[1] + h / 3 * D0[1]], P2 = [P3[0] - h / 3 * D3[0], P3[1] - h / 3 * D3[1]];
    for (let i = 0; i <= 64; i++) {
      const s = i / 64, u = 1 - s, x = u * u * u * P0[0] + 3 * u * u * s * P1[0] + 3 * u * s * s * P2[0] + s * s * s * P3[0], y = u * u * u * P0[1] + 3 * u * u * s * P1[1] + 3 * u * s * s * P2[1] + s * s * s * P3[1];
      const rho = Math.hypot(x, y), t = Math.sqrt(Math.max(0, (rho / rb) ** 2 - 1)), q = P(t);
      let da = Math.atan2(y, x) - Math.atan2(q[1], q[0]); if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      worst = Math.max(worst, Math.abs(da) * rho);
    }
  }
  return worst;
}

test('R12b S0 probe: a ZI worm is a helical gear of z1 teeth at β = 90° − γ — refused today past 45°; its twist fits the 64-segment budget but for a fine single-start worm, its long transverse flank needs more pieces than five', t => {
  const rows = [];
  for (const [mx, q, z1, L] of [[2, 10, 1, 50], [2, 10, 2, 50], [2, 10, 4, 50], [1, 16, 1, 40], [4, 8, 2, 90]]) {
    const gamma = Math.atan(z1 / q), mn = mx * Math.cos(gamma), beta = Math.PI / 2 - gamma;
    assert.throws(() => spurGearDimensions({ normalModuleMM: mn, helixAngleDeg: beta * 180 / Math.PI, hand: 'right', teeth: z1, faceWidthMM: L }), e => isGearError(e) && e.code === 'UNSUPPORTED_GEAR_KIND');
    // Transverse values: m_t = m_n / cos β (= m_x z... d1 = z1 m_t = q m_x), tan α_t = tan α_n / cos β.
    const mt = mn / Math.cos(beta), r = z1 * mt / 2, at = Math.atan(TAN / Math.cos(beta)), rb = r * Math.cos(at), ra = r + mn, rf = r - 1.25 * mn;
    close(2 * r, q * mx, 1e-9, 'd1 = q m_x');
    // The twist over L: L tan β / r radians; cubic pieces of the rotation fit within 1e-4·m_n at the tip.
    const twist = L * Math.tan(beta) / r, tol = 1e-4 * mn;
    let K = 1; while (twistDeviation(twist / K) * ra > tol && K < 4096) K++;
    // The transverse flank, from max(rb, rf) to ra, by C¹ Hermite pieces of the involute.
    const t0 = Math.sqrt(Math.max(0, (Math.max(rb, rf) / rb) ** 2 - 1)), t1 = Math.sqrt((ra / rb) ** 2 - 1);
    let N = 1; while (involuteFit(rb, t0, t1, N) > tol && N < 64) N++;
    rows.push({ mx, q, z1, L, gammaDeg: gamma * 180 / Math.PI, twistTurns: twist / (2 * Math.PI), K, segments: Math.ceil(K / 4), N, roll: t1 - t0 });
  }
  t.diagnostic(`ZI worms: ${rows.map(r => `m${r.mx} q${r.q} z1 ${r.z1} L${r.L}: γ ${r.gammaDeg.toFixed(3)}°, ${r.twistTurns.toFixed(2)} turns → ${r.K} twist pieces (${r.segments} segments), transverse flank roll ${r.roll.toFixed(3)} → ${r.N} pieces`).join('; ')}`);
  // Every worm here but the fine single-start one (m 1, q 16, 40 long: 12.7 turns) fits the 64 axial segments.
  for (const r of rows) assert.equal(r.segments <= 64, !(r.mx === 1 && r.q === 16), `m${r.mx} z1 ${r.z1}: ${r.segments} axial segments`);
  assert.ok(rows.some(r => r.N > 5), 'some worm flank needs more than the five pieces a gear flank is allowed');
  // A cylindrical worm wheel is a helical gear at β = γ (the worm's hand), small β: it builds today.
  const wheel = spurGear({ normalModuleMM: 2 * Math.cos(Math.atan(0.1)), helixAngleDeg: Math.atan(0.1) * 180 / Math.PI, hand: 'right', teeth: 40, faceWidthMM: 16, boreDiameterMM: 20 }, { id: 'w' });
  assert.equal(checkBrep(wheel.brep).valid, true);
  close(wheel.report.dimensions.referenceDiameterMM, 80, 1e-9, 'the wheel\'s d2 = z2 m_x');
});
