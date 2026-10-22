import test from 'node:test';
import assert from 'node:assert/strict';
import { worm, wormDimensions, wormWheelSpec, checkWormPair, checkPlacedWormPair, spurGear, evaluateCadPart, GearError, checkBrep, brepMassProperties, exportStep, importStep, evaluateSurface, surfaceDomain } from '../dist/index.js';

// R12b.5 (D136): cylindrical worms (ZI, ZA) and their cylindrical wheel. Oracles written here, apart from gear-worm.ts:
// the section's half-thickness by this file's own formulas (the involute of r1 cos α_t, or the Archimedean spiral of a
// straight axial side); the B-rep's own surfaces sampled — against the section turned by z/p, the lead, the normal
// pressure angle 20° at the reference cylinder from the surface's own normal, a ZA flank straight in the axial section;
// the volume as the section's area (shoelace, dense) × the length (a turn keeps every slice's area); the pair's two
// B-reps as placed cut by planes square to the wheel's axis (sections from the faces' own surfaces). K1's axial-module
// example (KHK, "Calculation of Gear Dimensions", §4.6, Table 4.23, retrieved 2026-10-20 and re-read 2026-10-21: m_x 3,
// α_n 20°, double thread, right hand, z2 30, x 0: d1 44, γ 7.76517°, d2 90, a 67.000, d_a1 50, d_f1 36.5).
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (|Δ| ${Math.abs(a - b).toExponential(3)} > ${tol})`);
const AN = 20 * Math.PI / 180, D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const SURVEY = !!process.env.GEAR_SURVEY, deg = x => x * 180 / Math.PI, inv = a => Math.tan(a) - a;
const wrap = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI)), sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = a => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The worm by this file's formulas: lead angle, p = lead/2π, heights, and the section's half-thickness angle ψ(r). */
function geom({ m, z1, d1, form = 'ZI', red = 0, hand = 'right', L }) {
  const r1 = d1 / 2, gamma = Math.atan(z1 * m / d1), p = z1 * m / 2, ra = r1 + m, rf = r1 - 1.25 * m, sx = Math.PI * m / 2 - red;
  const at = Math.atan(Math.tan(AN) / Math.sin(gamma)), rb = r1 * Math.cos(at), ax = Math.atan(Math.tan(AN) / Math.cos(gamma));
  const psi = r => form === 'ZI' ? sx / (z1 * m) + inv(at) - inv(Math.acos(Math.min(1, rb / r))) : sx / (z1 * m) - (r - r1) * Math.tan(ax) / p;
  return { m, z1, r1, gamma, p, ra, rf, rb, at, ax, psi, r0: form === 'ZI' ? Math.max(rb, rf) : rf, h: hand === 'right' ? 1 : -1, L, step: 2 * Math.PI / z1, form };
}
/** The section's area: the root disc and each thread's 2ψ(r) r dr from the root to the tip (Simpson, 4000 steps); its perimeter, roughly (for the slack): each thread's two flanks, tip and root arcs. */
function sectionArea(G) {
  const n = 4000, h = (G.ra - G.rf) / n;
  let I = 0;
  for (let i = 0; i <= n; i++) { const r = G.rf + h * i, w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2; I += w * 2 * G.psi(r) * r; }
  const A = Math.PI * G.rf * G.rf + G.z1 * I * h / 3;
  let flank = 0; for (let i = 0; i < 200; i++) { const ra = G.r0 + (G.ra - G.r0) * i / 200, rb = G.r0 + (G.ra - G.r0) * (i + 1) / 200; flank += Math.hypot(rb - ra, rb * G.psi(rb) - ra * G.psi(ra)); }
  return { A, P: G.z1 * (2 * flank + 2 * G.ra * G.psi(G.ra) + G.rf * (G.step - 2 * G.psi(G.r0))) };
}
const specOf = c => ({ axialModuleMM: c.m, starts: c.z1, diameterMM: c.d1, hand: c.hand ?? 'right', lengthMM: c.L, form: c.form ?? 'ZI', ...(c.bore ? { boreDiameterMM: c.bore } : {}), ...(c.red ? { toothThicknessReductionMM: c.red } : {}) });

const CASES = [
  { m: 3, z1: 2, d1: 44, L: 60, form: 'ZI', bore: 12 },
  { m: 3, z1: 2, d1: 44, L: 60, form: 'ZA', hand: 'left' },
  { m: 2, z1: 1, d1: 20, L: 50, form: 'ZI' },
  ...(SURVEY ? [{ m: 2, z1: 1, d1: 32, L: 40, form: 'ZA' }, { m: 4, z1: 4, d1: 32, L: 90, form: 'ZI', hand: 'left' }, { m: 1, z1: 1, d1: 16, L: 40, form: 'ZI' }, { m: 2.5, z1: 3, d1: 30, L: 45, form: 'ZA', red: 0.1 }] : []),
];

test('the worm (refused at the previous HEAD: no worm): ZI and ZA, valid; K1\'s example; the B-rep\'s own surfaces — the section turned by z/p within the fits, the lead, the normal pressure angle 20° at the reference cylinder from the surfaces\' normals, a ZA flank straight in the axial section; budgets raised (faces radially, axial segments), never the tolerance; the volume', t => {
  for (const c of CASES) {
    const G = geom(c), t0 = performance.now(), { brep, report } = worm(specOf(c), { id: 'w' }), ms = performance.now() - t0, dm = report.dimensions;
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues?.[0]); assert.equal(brep.bodies.length, 1);
    assert.equal(report.generator, 'worm@0'); assert.equal(report.form, c.form);
    close(dm.leadAngleDeg, deg(G.gamma), 1e-12, 'γ'); close(dm.leadMM, Math.PI * c.m * c.z1, 1e-12, 'lead'); close(dm.tipDiameterMM, 2 * G.ra, 1e-12, 'd_a1'); close(dm.rootDiameterMM, 2 * G.rf, 1e-12, 'd_f1');
    if (c.m === 3 && c.z1 === 2) { close(dm.leadAngleDeg, 7.76517, 5e-6, "K1's γ"); assert.equal(dm.referenceDiameterMM, 44); assert.equal(dm.tipDiameterMM, 50); assert.equal(dm.rootDiameterMM, 36.5); }
    // (Budgets: more than five flank pieces go on several faces; up to 128 axial segments.)
    assert.equal(report.flankFaces, Math.ceil(report.flankPieces / 5)); assert.ok(report.twist.axialSegments <= 128);
    const tw = report.twist.deviationMM, fit = report.profileDeviationMM + tw;
    assert.ok(fit <= 1e-4 * c.m * Math.cos(G.gamma) + 1e-15 && tw <= 0.25e-4 * c.m * Math.cos(G.gamma) + 1e-15);
    let worst = 0, cyl = 0, pa = 0;
    const axial = [];
    for (const f of brep.faces) {
      const name = f.name.slice(2), base = name.replace(/\.\d+$/, ''), tooth = Number(base.split('#')[1]), gam = G.step * (tooth - 1), { u, v } = surfaceDomain(f.surface);
      for (let i = 0; i <= 10; i++) for (const j of [0, 0.5, 1]) {
        const a = u[0] + (u[1] - u[0]) * i / 10, b = v[0] + (v[1] - v[0]) * j, q = evaluateSurface(f.surface, a, b), r = Math.hypot(q[0], q[1]), turn = G.h * q[2] / G.p;
        if (/^flank/.test(base)) {
          const want = (/^flankL/.test(base) ? gam - G.psi(r) : gam + G.psi(r)) + turn;
          worst = Math.max(worst, Math.abs(wrap(Math.atan2(q[1], q[0]) - want)) * r);
        } else if (/^tip/.test(base)) cyl = Math.max(cyl, Math.abs(r - G.ra)); else if (/^root#/.test(base)) cyl = Math.max(cyl, Math.abs(r - G.rf));
      }
      // The normal pressure angle at the reference cylinder: |n · r̂| = sin α_n, n from the surface's own derivatives where
      // the face crosses r1 (bisection along u, at three heights).
      if (/^flank/.test(base)) for (const jv of [0.25, 0.5, 0.75]) {
        const b = v[0] + (v[1] - v[0]) * jv, rad = a => { const q = evaluateSurface(f.surface, a, b); return Math.hypot(q[0], q[1]) - G.r1; };
        let lo = u[0], hi = u[1], flo = rad(lo); if (flo * rad(hi) > 0) continue;
        for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2, fm = rad(m); if ((fm > 0) === (flo > 0)) { lo = m; flo = fm; } else hi = m; }
        const a = (lo + hi) / 2, q = evaluateSurface(f.surface, a, b), r = Math.hypot(q[0], q[1]), e = 1e-6;
        const n = cross(sub(evaluateSurface(f.surface, Math.min(u[1], a + e), b), evaluateSurface(f.surface, Math.max(u[0], a - e), b)), sub(evaluateSurface(f.surface, a, Math.min(v[1], b + e)), evaluateSurface(f.surface, a, Math.max(v[0], b - e))));
        pa = Math.max(pa, Math.abs(Math.asin(Math.min(1, Math.abs(dot(n, [q[0] / r, q[1] / r, 0])) / norm(n))) - AN));
      }
      // ZA: the flank's points in the axial half-plane (angle 0) for thread 1's left flank, by bisection along u at several heights.
      // (Each point carried along its helix — θ + h Δz / p — to the half-plane at angle 0: z0 = z − θ p / h, within a lead of the first.)
      if (c.form === 'ZA' && /^flankL\d?#1(\.\d+)?$/.test(name)) for (const jv of [0.2, 0.5, 0.8]) {
        const b = v[0] + (v[1] - v[0]) * jv, lead = 2 * Math.PI * G.p;
        for (let i = 1; i < 8; i++) {
          const q = evaluateSurface(f.surface, u[0] + (u[1] - u[0]) * i / 8, b);
          let z0 = q[2] - wrap(Math.atan2(q[1], q[0])) * G.p / G.h; if (axial.length) z0 -= lead * Math.round((z0 - axial[0].z) / lead);
          axial.push({ r: Math.hypot(q[0], q[1]), z: z0 });
        }
      }
    }
    assert.ok(worst <= fit * 1.001 + 1e-12, `flanks ${worst} vs fits ${fit}`); assert.ok(cyl <= tw * 1.001 + 1e-12, `tips and roots ${cyl}`);
    // (The angle off 20° from the fits: their slope error, a few 1e-4 rad — the profile within 1e-4 m of its curve.)
    assert.ok(pa > 0 && pa <= 2e-3, `normal pressure angle off 20° by ${pa} rad`);
    if (axial.length) {
      // Carried along its helix to the axial half-plane, a ZA flank's points are (r, z): a straight line at α_x to the radius.
      const n = axial.length, mr = axial.reduce((s, q) => s + q.r, 0) / n, mz = axial.reduce((s, q) => s + q.z, 0) / n;
      const sxx = axial.reduce((s, q) => s + (q.r - mr) ** 2, 0), sxz = axial.reduce((s, q) => s + (q.r - mr) * (q.z - mz), 0), slope = sxz / sxx;
      const resid = Math.max(...axial.map(q => Math.abs(q.z - mz - slope * (q.r - mr))));
      close(Math.abs(Math.atan(slope)), G.ax, 1e-4, 'ZA axial side at α_x'); assert.ok(resid <= 2 * fit / Math.sin(G.ax) + 1e-9, `ZA axial side straight within ${resid}`);
    }
    const { A, P } = sectionArea(G), want = (A - (c.bore ? Math.PI * c.bore * c.bore / 4 : 0)) * c.L, got = brepMassProperties(brep, 1).volumeMM3;
    close(got, want, P * c.L * fit + 1e-7 * want, `${c.form} z1 ${c.z1} volume`);
    t.diagnostic(`${c.form} m_x ${c.m} z1 ${c.z1} d1 ${c.d1} ${c.hand ?? 'right'} L ${c.L}: γ ${dm.leadAngleDeg.toFixed(5)}°, ${report.flankPieces} flank piece(s) on ${report.flankFaces} face(s) ${report.profileDeviationMM.toExponential(2)}, twist ${report.twist.turns.toFixed(3)} turns in ${report.twist.pieces} pieces / ${report.twist.axialSegments} segments ${tw.toExponential(2)}; sampled ${worst.toExponential(2)}, α_n off ${pa.toExponential(2)}; V ${got.toFixed(3)} vs ${want.toFixed(3)} (${((got - want) / want).toExponential(2)}); ${brep.faces.length} faces, ${ms.toFixed(0)} ms`);
  }
});

test('refusals: ZN, ZK, ZC, double-enveloping, the pressure angle, the starts, a diameter with no root, a lead angle past 45°, the bore; a wheel straight, of the other hand, at another helix angle or module', () => {
  const base = { axialModuleMM: 3, starts: 2, diameterMM: 44, hand: 'right', lengthMM: 60 };
  const code = (spec, c, re) => assert.throws(() => worm({ ...base, ...spec }), e => e instanceof GearError && e.code === c && (!re || re.test(e.message)), `${JSON.stringify(spec)} → ${c}`);
  for (const f of ['ZN', 'ZK', 'ZC']) code({ form: f }, 'UNSUPPORTED_GEAR_KIND', new RegExp(f));
  code({ envelope: 'double' }, 'UNSUPPORTED_GEAR_KIND', /double-enveloping/); code({ pressureAngleDeg: 14.5 }, 'UNSUPPORTED_GEAR_KIND'); code({ starts: 5 }, 'INVALID_INPUT');
  code({ diameterMM: 7 }, 'INVALID_INPUT', /2\.5 m_x/); code({ starts: 4, diameterMM: 10, axialModuleMM: 3 }, 'UNSUPPORTED_GEAR_KIND', /45°/); code({ boreDiameterMM: 34 }, 'BORE_INTERSECTION', /at most Ø30\.500/); code({ hand: undefined }, 'INVALID_INPUT', /hand/);
  const wh = wormWheelSpec(base, { teeth: 30, faceWidthMM: 20 });
  for (const [g, re] of [[{ moduleMM: 3, teeth: 30, faceWidthMM: 20 }, /straight/], [{ ...wh, hand: 'left' }, /one hand/], [{ ...wh, helixAngleDeg: 8 }, /lead angle/], [{ ...wh, normalModuleMM: 3 }, /normal module/]])
    assert.throws(() => checkWormPair(base, g, { mode: 'verdict' }), e => e.code === 'MATE_INCOMPATIBLE' && re.test(e.message), JSON.stringify(g));
});

test('the pair (K1\'s): the centre distance 67, ratio 15, the wheel d2 90; the mid-plane clear by j cos α_x / 2 (within the reported sag) and the sections ±b/3 clear; a phase off crosses; ZA and ZI', t => {
  for (const form of ['ZA', 'ZI']) {
    const j = 0.1, w = { axialModuleMM: 3, starts: 2, diameterMM: 44, hand: 'right', lengthMM: 60, form, toothThicknessReductionMM: j / 2 }, wh = wormWheelSpec(w, { teeth: 30, faceWidthMM: 20, toothThicknessReductionMM: j / 2 }), G = geom({ m: 3, z1: 2, d1: 44, form });
    const t0 = performance.now(), c = checkWormPair(w, wh), ms = performance.now() - t0;
    close(c.centerDistanceMM, 67, 1e-12, "K1's a"); close(spurGear(wh).report.dimensions.referenceDiameterMM, 90, 1e-9, "K1's d2"); close(c.speedRatio, 15, 0, 'ratio');
    assert.equal(c.interference, false); const mid = c.planes.find(p => p.offsetMM === 0), want = j * Math.cos(G.ax) / 2;
    assert.ok(mid.minimumClearanceMM >= want - 1e-7 && mid.minimumClearanceMM <= want + c.chordSagMM + 1e-7, `${form} mid-plane ${mid.minimumClearanceMM} vs ${want}`);
    for (const p of c.planes) assert.ok(p.minimumClearanceMM > 0);
    const off = checkWormPair(w, wh, { relativePhaseDeg: 360 / 2 / 3, mode: 'verdict' }); assert.equal(off.interference, true);
    // Found (D136): a wheel whose root the basic rack generates (spur-gear@1, at m_n) has its form circle (Ø85.599) above
    // where the axial-module worm's crest reaches (a − ra1 = 42 mm): at no backlash a ZA worm's crest cuts its fillet;
    // the schematic root clears (touching), and 0.05 mm of backlash clears the generated one.
    if (form === 'ZA') {
      const w0 = { ...w, toothThicknessReductionMM: 0 }, gen = { ...wh, toothThicknessReductionMM: 0, rootPolicy: 'generated' };
      assert.equal(checkWormPair(w0, gen, { mode: 'verdict' }).interference, true); assert.equal(checkWormPair(w0, { ...wh, toothThicknessReductionMM: 0 }, { mode: 'verdict' }).interference, false);
      assert.equal(checkWormPair({ ...w0, toothThicknessReductionMM: 0.025 }, { ...gen, toothThicknessReductionMM: 0.025 }, { mode: 'verdict' }).interference, false);
    }
    t.diagnostic(`${form} K1 pair j ${j}: planes ${c.planes.map(p => `${p.offsetMM.toFixed(2)} ${p.minimumClearanceMM.toFixed(6)}`).join(', ')} (j cos α_x/2 ${want.toFixed(6)}, sag ≤ ${c.chordSagMM.toExponential(1)}); mid-plane ε ${c.midPlaneContactRatio.toFixed(4)}; tips ${c.tipClearancesMM.map(x => x.toFixed(4)).join(', ')}; mesh zone ±${c.meshZoneHalfLengthMM.toFixed(3)}; ${ms.toFixed(0)} ms`);
  }
});

/**
 * A B-rep's section by the plane z = c (the wheel's axis +Z), from its faces' own surfaces: on each face the points at
 * U parameters where the surface crosses the plane along v (bisection where the ends bracket it), only faces near the
 * mesh point M; segments (x0, y0, x1, y1) in the plane.
 */
function planeSection(brep, c, M, reach, U = 40) {
  const out = [];
  for (const f of brep.faces) {
    if (/\.(face0|face1|bore)/.test(f.name)) continue;
    const { u, v } = surfaceDomain(f.surface), mid = evaluateSurface(f.surface, (u[0] + u[1]) / 2, (v[0] + v[1]) / 2);
    if (Math.hypot(mid[0] - M[0], mid[1] - M[1], mid[2] - M[2]) > reach) continue;
    let prev = null;
    for (let i = 0; i <= U; i++) {
      const a = u[0] + (u[1] - u[0]) * i / U, g = b => evaluateSurface(f.surface, a, b)[2] - c;
      let lo = v[0], hi = v[1], glo = g(lo), ghi = g(hi);
      if (glo * ghi > 0) { prev = null; continue; }
      for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2, gm = g(m); if ((gm > 0) === (glo > 0)) { lo = m; glo = gm; } else hi = m; }
      const q = evaluateSurface(f.surface, a, (lo + hi) / 2);
      if (prev) out.push(prev[0], prev[1], q[0], q[1]); prev = q;
    }
  }
  return Float64Array.from(out);
}
const orient2 = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
function ps(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
function clearance(Sa, Sb) {
  let best = Infinity, crossed = false;
  for (let i = 0; i < Sa.length; i += 4) for (let j = 0; j < Sb.length; j += 4) {
    const ax = Sa[i], ay = Sa[i + 1], bx = Sa[i + 2], by = Sa[i + 3], cx = Sb[j], cy = Sb[j + 1], dx = Sb[j + 2], dy = Sb[j + 3];
    const gx = Math.max(0, Math.min(cx, dx) - Math.max(ax, bx), Math.min(ax, bx) - Math.max(cx, dx)), gy = Math.max(0, Math.min(cy, dy) - Math.max(ay, by), Math.min(ay, by) - Math.max(cy, dy));
    if (gx * gx + gy * gy > best * best) continue;
    if (orient2(ax, ay, bx, by, cx, cy) * orient2(ax, ay, bx, by, dx, dy) < 0 && orient2(cx, cy, dx, dy, ax, ay) * orient2(cx, cy, dx, dy, bx, by) < 0) crossed = true;
    best = Math.min(best, ps(ax, ay, cx, cy, dx, dy), ps(bx, by, cx, cy, dx, dy), ps(cx, cy, ax, ay, bx, by), ps(dx, dy, ax, ay, bx, by));
  }
  return { min: best, crossed };
}

test('the part model: K1\'s wheel (a helical spur gear at γ) and its worm by mesh — the worm square to it at 67 mm in its mid-plane, its axial module and diameter from the wheel; the two B-reps cut by planes square to the wheel\'s axis, clear as the pair check says, never crossing, a phase off crossing; checkPlacedWormPair; STEP', t => {
  const j = 0.1, w0 = { axialModuleMM: 3, starts: 2, diameterMM: 44, hand: 'right', lengthMM: 60, form: 'ZA' }, wh = wormWheelSpec(w0, { teeth: 30, faceWidthMM: 20 });
  const feats = (rot, dir, phase = 0) => [
    { id: 'g', kind: 'spur-gear', normalModule: wh.normalModuleMM, helixAngle: wh.helixAngleDeg, hand: 'right', teeth: 30, faceWidth: 20, thicknessReduction: j / 2, center: [10, 5], from: 2, rotation: rot },
    { id: 'w', kind: 'worm', starts: 2, length: 60, form: 'ZA', thicknessReduction: j / 2, mesh: { gear: 'g', direction: dir, phase } }];
  const rows = [];
  for (const [rot, dir] of SURVEY ? [[0, -90], [5, 30], [-7, 200]] : [[5, 30]]) {
    const M = evaluateCadPart(D(feats(rot, dir))), g = M.output('g'), w = M.output('w'), pw = w.wormPlacement, pg = g.gearPlacement;
    // From the wheel: m_x 3, d1 44; square to it, 67 mm off, in its mid-plane.
    close(pw.spec.axialModuleMM, 3, 1e-12, 'm_x from the wheel'); close(pw.spec.diameterMM, 44, 1e-9, 'd1 from the wheel'); assert.equal(pw.spec.hand, 'right');
    const mid = pw.origin.map((x, i) => x + pw.axis[i] * 30), phi = dir * Math.PI / 180;
    close(Math.hypot(mid[0] - 10, mid[1] - 5), 67, 1e-9, 'a'); close(mid[2], 12, 1e-12, 'mid-plane'); close(pw.axis[2], 0, 1e-15, 'square'); close(Math.atan2(mid[1] - 5, mid[0] - 10), Math.atan2(Math.sin(phi), Math.cos(phi)), 1e-12, 'direction');
    const chk = checkPlacedWormPair(pg, pw, { mode: 'verdict' }); assert.equal(chk.relativePhaseDeg, 0); assert.equal(chk.interference, false);
    assert.equal(g.validate().valid, true); assert.equal(w.validate().valid, true);
    const pair = checkWormPair(pw.spec, pg.spec), Mp = [10 + 45 * Math.cos(phi), 5 + 45 * Math.sin(phi), 12];
    for (const cOff of SURVEY ? [0, -20 / 3, 20 / 3] : [0, 20 / 3]) {
      const A = planeSection(g.brep, 12 + cOff, Mp, 22), B = planeSection(w.brep, 12 + cOff, Mp, 22), r = clearance(A, B), want = pair.planes.find(p => Math.abs(p.offsetMM - cOff) < 1e-9).minimumClearanceMM;
      assert.equal(r.crossed, false, `turn ${rot}° plane ${cOff}: the B-reps' sections cross`);
      // (The pair check's figure is the least over a worm pitch's turn; this is one pose — no nearer than it, and in the
      // mid-plane, where a ZA worm and the wheel are conjugate (the clearance the same at every turn), equal to it.
      // Their own sections are chords of 40 points a face: up to about 3e-4 mm larger; the fits move them by theirs.)
      assert.ok(r.min >= want - 1e-3 && (cOff !== 0 || r.min <= want + 1e-3), `turn ${rot}° plane ${cOff}: ${r.min} vs the pair check's ${want}`);
      rows.push(`turn ${rot}° dir ${dir}° plane ${cOff.toFixed(2)}: ${r.min.toFixed(5)} (check ${want.toFixed(5)})`);
    }
  }
  // A phase off: the B-reps' mid-plane sections cross.
  const Mo = evaluateCadPart(D(feats(0, -90, 60))), Ao = planeSection(Mo.output('g').brep, 12, [10, 5 - 45, 12], 22), Bo = planeSection(Mo.output('w').brep, 12, [10, 5 - 45, 12], 22);
  assert.equal(clearance(Ao, Bo).crossed, true, 'a phase off crosses');
  // Refusals in the part model: a straight wheel, a worm of the other hand.
  assert.throws(() => evaluateCadPart(D([{ id: 'g', kind: 'spur-gear', module: 3, teeth: 30, faceWidth: 20 }, feats(0, 0)[1]])).output('w'), e => e.code === 'INPUT' && /straight/.test(e.message));
  assert.throws(() => evaluateCadPart(D([feats(0, 0)[0], { ...feats(0, 0)[1], hand: 'left' }])).output('w'), e => e.code === 'INPUT' && /MATE_INCOMPATIBLE/.test(e.message));
  assert.throws(() => evaluateCadPart(D([{ id: 'w', kind: 'worm', axialModule: 3, starts: 2, diameter: 44, hand: 'right', length: 60, form: 'ZK' }])).output('w'), e => e.code === 'CAPABILITY');
  const { brep } = worm({ ...w0, boreDiameterMM: 12 }, { id: 's' }), back = importStep(exportStep([brep], { name: 'worm' }));
  close(brepMassProperties(back, 1).volumeMM3, brepMassProperties(brep, 1).volumeMM3, 1e-6 * brepMassProperties(brep, 1).volumeMM3, 'round trip'); assert.ok(back.faces.some(f => f.name === 's.flankL#1')); assert.equal(checkBrep(back).valid, true);
  t.diagnostic(rows.join('; '));
});
