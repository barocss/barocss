import test from 'node:test';
import assert from 'node:assert/strict';
import { bevelGear, bevelGearDimensions, checkBevelGearPair, checkPlacedBevelGears, evaluateCadPart, isGearError, checkBrep, brepMassProperties, exportStep, importStep, evaluateSurface, surfaceDomain, outputOf, checkOutput } from '../dist/index.js';

// R12b.3 (D134): straight bevel gears — the spherical involute, standard proportions (the cones through the apex),
// spherical ends. Oracles written here, apart from gear-bevel.ts: the spherical involute and the tooth's thickness by
// their own formulas; the B-rep's own surfaces sampled (on their spheres, cones and planes, the flank rulings through the
// apex, the flanks against the involute); the volume by the section's area on the unit sphere (∮(1 − cos θ) dφ over a
// dense outline) times (Re³ − Ri³)/3, less the bore's closed form; the undercut and the contact ratio by a construction
// in space (the great circle of action, its tangent points, the tip cones and the generating crown gear's along it, by
// bisection); the pair's sweep on the sphere with this file's own outlines (the gnomonic plane, a grid); K1's
// straight-bevel example's system-independent numbers (KHK, "Calculation of Gear Dimensions", §4.4, retrieved
// 2026-10-20: m 3, z 20/40, Σ 90°, δ 26.56505°/63.43495°, R 67.08204).
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (|Δ| ${Math.abs(a - b).toExponential(3)} > ${tol})`);
const ALPHA = 20 * Math.PI / 180, D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const SURVEY = !!process.env.GEAR_SURVEY, deg = x => x * 180 / Math.PI;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norm = a => Math.hypot(a[0], a[1], a[2]);
const wrap = a => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

/** The spherical involute of the base cone δb (unit sphere, axis +Z) at roll t from the base circle at azimuth 0. */
function sphInvolute(db, t) {
  const sb = Math.sin(db), cb = Math.cos(db), s = t * sb, cs = Math.cos(s), ss = Math.sin(s);
  // The tangent point T = (sb cos t, sb sin t, cb); the point lags it by the arc s along the great circle's tangent −e.
  const T = [sb * Math.cos(t), sb * Math.sin(t), cb], e = [-Math.sin(t), Math.cos(t), 0];
  return [cs * T[0] - ss * e[0], cs * T[1] - ss * e[1], cs * T[2] - ss * e[2]];
}
const sphRoll = (db, th) => Math.acos(Math.min(1, Math.cos(th) / Math.cos(db))) / Math.sin(db);
const Aof = (db, th) => { const p = sphInvolute(db, sphRoll(db, th)); return Math.atan2(p[1], p[0]); };
const fromPolar = (th, az) => [Math.sin(th) * Math.cos(az), Math.sin(th) * Math.sin(az), Math.cos(th)];

/** The gear by this file's formulas: pitch, base, tip and root cones, the cone distance, the involute's offset ψ from the tooth's middle. */
function geom({ m, z, zm, S = 90, b, red = 0, bore = 0 }) {
  const Sg = S * Math.PI / 180, delta = Math.atan2(Math.sin(Sg), zm / z + Math.cos(Sg)), Re = m * z / (2 * Math.sin(delta));
  const db = Math.asin(Math.sin(delta) * Math.cos(ALPHA)), tip = delta + Math.atan(m / Re), root = delta - Math.atan(1.25 * m / Re);
  const psi = (Math.PI * m / 2 - red) / (m * z) + Aof(db, delta);
  return { m, z, zm, S, Sg, delta, Re, Ri: Re - b, db, tip, root, psi, start: Math.max(db, root), step: 2 * Math.PI / z, bore: bore / 2 };
}
/** One tooth's outline on the unit sphere (tooth centred on azimuth `gam`), root middle to root middle, F points a flank. */
function toothPoints(G, gam, F) {
  const out = [], t0 = sphRoll(G.db, G.start), t1 = sphRoll(G.db, G.tip), A0 = G.start > G.db ? Aof(G.db, G.start) : 0, At = Aof(G.db, G.tip);
  out.push(fromPolar(G.root, gam - G.step / 2), fromPolar(G.root, gam - G.psi + A0));
  for (let i = 0; i <= F; i++) { const p = sphInvolute(G.db, t0 + (t1 - t0) * i / F), az = Math.atan2(p[1], p[0]); out.push(fromPolar(Math.acos(p[2]), gam - G.psi + az)); }
  for (let i = 1; i < 16; i++) out.push(fromPolar(G.tip, gam - (G.psi - At) + 2 * (G.psi - At) * i / 16));
  for (let i = F; i >= 0; i--) { const p = sphInvolute(G.db, t0 + (t1 - t0) * i / F), az = Math.atan2(p[1], p[0]); out.push(fromPolar(Math.acos(p[2]), gam + G.psi - az)); }
  out.push(fromPolar(G.root, gam + G.psi - A0), fromPolar(G.root, gam + G.step / 2));
  return out;
}
/** The section's area on the unit sphere: ∮ (1 − cos θ) dφ round the whole outline (the pole inside), by the trapezium rule on a dense polyline. */
function sectionArea(G) {
  let I = 0;
  for (let k = 0; k < G.z; k++) {
    const P = toothPoints(G, G.step * k, 20000);
    for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; I += (1 - (a[2] + b[2]) / 2) * wrap(Math.atan2(b[1], b[0]) - Math.atan2(a[1], a[0])); }
  }
  return I;
}
const shellVolume = (G, Om) => Om * (G.Re ** 3 - G.Ri ** 3) / 3 - (G.bore > 0 ? 2 * Math.PI / 3 * ((G.Re ** 3 - (G.Re ** 2 - G.bore ** 2) ** 1.5) - (G.Ri ** 3 - (G.Ri ** 2 - G.bore ** 2) ** 1.5)) : 0);

const CASES = [
  { m: 2, z: 20, zm: 40, b: 10 },
  { m: 3, z: 20, zm: 40, b: 20, bore: 10 },
  { m: 2, z: 40, zm: 20, b: 10, bore: 12 },
  { m: 2, z: 16, zm: 24, S: 60, b: 8 },
  ...(SURVEY ? [{ m: 2, z: 18, zm: 30, S: 120, b: 8 }, { m: 2, z: 13, zm: 13, b: 6 }, { m: 1.5, z: 30, zm: 30, S: 45, b: 9, bore: 8 }, { m: 2, z: 25, zm: 60, b: 12, red: 0.1 }] : []),
];
const specOf = c => ({ module: c.m, teeth: c.z, mateTeeth: c.zm, ...(c.S ? { shaftAngle: c.S } : {}), faceWidth: c.b, ...(c.bore ? { boreDiameter: c.bore } : {}), ...(c.red ? { toothThicknessReduction: c.red } : {}) });

test('the straight bevel gear (refused at the previous HEAD: no bevelGear): valid, one body; K1\'s example; the B-rep\'s own surfaces — the ends on their spheres, tips and roots on their cones, the meridian joins in their planes, the flanks ruled through the apex and within their fit of the involute written here; names; the volume by the section\'s area on the sphere', t => {
  assert.equal(typeof bevelGear, 'function');
  for (const c of CASES) {
    const G = geom(c), t0 = performance.now(), { brep, report } = bevelGear(specOf(c), { id: 'g' }), ms = performance.now() - t0;
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues?.[0]); assert.equal(brep.bodies.length, 1);
    assert.equal(report.generator, 'bevel-gear@0'); assert.equal(report.profile, 'spherical-involute'); assert.equal(report.manufacturingValidated, false);
    const dm = report.dimensions;
    close(dm.pitchAngle, deg(G.delta), 1e-12, 'δ'); close(dm.coneDistance, G.Re, 1e-12 * G.Re, 'R'); close(dm.baseConeAngle, deg(G.db), 1e-12, 'δb');
    close(dm.tipAngle, deg(G.tip), 1e-12, 'tip cone'); close(dm.rootAngle, deg(G.root), 1e-12, 'root cone'); close(dm.referenceDiameter, c.m * c.z, 1e-12, 'd');
    if (c.m === 3 && c.z === 20) { close(dm.pitchAngle, 26.56505, 5e-6, "K1's δ1"); close(bevelGearDimensions({ ...specOf(c), teeth: 40, mateTeeth: 20 }).delta * 180 / Math.PI, 63.43495, 5e-6, "K1's δ2"); close(dm.coneDistance, 67.08204, 5e-6, "K1's R"); }
    // Each face sampled: flanks (their rulings through the apex, their heel edge against the involute), tips and roots, meridians, ends.
    let flankWorst = 0, faces = 0;
    for (const f of brep.faces) {
      const name = f.name.slice(2), S = f.surface, { u, v } = surfaceDomain(S), tooth = Number(name.split('#')[1]), gam = G.step * (tooth - 1);
      for (let i = 0; i <= 12; i++) for (const j of [0, 0.5, 1]) {
        const p = evaluateSurface(S, u[0] + (u[1] - u[0]) * i / 12, v[0] + (v[1] - v[0]) * j), R = norm(p), th = Math.acos(p[2] / R), az = Math.atan2(p[1], p[0]);
        if (/^flank/.test(name)) {
          if (j === 0) close(R, G.Ri, 1e-9 * G.Re, `${name} on the toe sphere`);
          if (j === 1) { close(R, G.Re, 1e-9 * G.Re, `${name} on the heel sphere`); const q = evaluateSurface(S, u[0] + (u[1] - u[0]) * i / 12, v[0]); for (let a = 0; a < 3; a++) close(p[a] / G.Re, q[a] / G.Ri, 1e-12, `${name} ruled through the apex`); }
          // (The involute at this polar angle: the left flank's azimuth γ − ψ + A(θ), the right's its mirror.)
          const want = /^flankL/.test(name) ? gam - G.psi + Aof(G.db, th) : gam + G.psi - Aof(G.db, th);
          flankWorst = Math.max(flankWorst, Math.abs(wrap(az - want)) * Math.sin(th) * G.Re);
        } else if (/^tip/.test(name)) close(th, G.tip, 1e-12, `${name} on the tip cone`);
        else if (/^root#/.test(name)) close(th, G.root, 1e-12, `${name} on the root cone`);
        else if (/^root[LR]/.test(name)) close(wrap(az - (name[4] === 'L' ? gam - G.psi : gam + G.psi)), 0, 1e-12, `${name} in its meridian plane`);
        else if (name === 'heel') close(R, G.Re, 1e-12 * G.Re, 'heel sphere');
        else if (name === 'toe') close(R, G.Ri, 1e-12 * G.Re, 'toe sphere');
        else if (/^bore/.test(name)) close(Math.hypot(p[0], p[1]), G.bore, 1e-12 * G.Re, 'bore');
      }
      faces++;
    }
    assert.ok(flankWorst <= report.profileDeviation * 1.001 + 1e-12, `flanks ${flankWorst} vs fit ${report.profileDeviation}`); assert.ok(report.profileDeviation <= 1e-4 * c.m);
    const meridian = G.root < G.db;
    assert.equal(faces, G.z * (2 * report.flankFaces + 2 + (meridian ? 2 : 0)) + 2 + (c.bore ? 2 : 0));
    for (const n of ['g.flankL#1', 'g.flankR#1', 'g.tip#1', 'g.root#1', 'g.heel', 'g.toe', ...(meridian ? ['g.rootL#1'] : []), ...(c.bore ? ['g.bore#1'] : [])]) assert.ok(brep.faces.some(f => f.name === n), n);
    // The volume: (Re³ − Ri³)/3 × the section's area on the unit sphere, less the bore — within the flanks' fit (each flank's
    // deviation over its arc, a bound).
    const Om = sectionArea(G), want = shellVolume(G, Om), got = brepMassProperties(brep, 1).volume;
    const slack = 2 * G.z * (G.tip - G.root) * 1.2 * report.profileDeviation / G.Re * (G.Re ** 3 - G.Ri ** 3) / 3 + 1e-7 * want;
    close(got, want, slack, `z${c.z}/${c.zm} volume`);
    t.diagnostic(`m${c.m} z${c.z}/${c.zm} Σ${c.S ?? 90}°${c.bore ? ` bore ${c.bore}` : ''}: δ ${dm.pitchAngle.toFixed(5)}°, R ${G.Re.toFixed(5)}, ${report.flankPieces} conic piece(s) on ${report.flankFaces} face(s), fit ${report.profileDeviation.toExponential(2)} mm (sampled ${flankWorst.toExponential(2)}), V ${got.toFixed(4)} vs ${want.toFixed(4)} (${((got - want) / want).toExponential(2)}), ${brep.faces.length} faces, ${ms.toFixed(1)} ms`);
  }
});

test('undercut by the exact spherical condition, built here in space — the great circle of action through the pitch point at α, its tangent point on the base cone, the generating crown gear\'s tip cone along it: refused exactly where the crown reaches past the base cone; Tredgold\'s z_v reported as the estimate, and wrong at 16/40', t => {
  const rows = [];
  for (const [z, zm, S] of [[12, 40, 90], [14, 40, 90], [15, 40, 90], [16, 40, 90], [17, 40, 90], [18, 40, 90], [13, 13, 90], [12, 12, 90], [14, 30, 60], [15, 30, 60], [11, 20, 120], [12, 20, 120], ...(SURVEY ? [[16, 60, 90], [17, 60, 90], [17, 100, 90], [18, 100, 90], [10, 10, 120], [11, 11, 120], [16, 20, 30], [17, 20, 30]] : [])]) {
    const m = 2, G = geom({ m, z, zm, S, b: 4 }), P = [Math.sin(G.delta), 0, Math.cos(G.delta)], eTh = [Math.cos(G.delta), 0, -Math.sin(G.delta)];
    const d = [-Math.sin(ALPHA) * eTh[0], Math.cos(ALPHA), -Math.sin(ALPHA) * eTh[2]], C = s => [Math.cos(s) * P[0] + Math.sin(s) * d[0], Math.cos(s) * P[1] + Math.sin(s) * d[1], Math.cos(s) * P[2] + Math.sin(s) * d[2]];
    // T1: the point of the circle nearest the axis (golden section on s in (0, π/2)); it is on the base cone.
    let lo = 0, hi = Math.PI / 2; for (let i = 0; i < 200; i++) { const a = lo + (hi - lo) / 3, b2 = hi - (hi - lo) / 3; if (C(a)[2] > C(b2)[2]) hi = b2; else lo = a; }
    const sT = (lo + hi) / 2; close(Math.acos(C(sT)[2]), G.db, 1e-9, 'the action circle touches the base cone');
    // The crown gear: its axis square to the pitch line, away from the gear's; its tip cone at 90° + θa (θa = atan(m/R)).
    const thA = Math.atan(m / G.Re); let a = 0, b = Math.PI / 2;
    for (let i = 0; i < 200; i++) { const s = (a + b) / 2; if (dot(C(s), eTh) > -Math.sin(thA)) a = s; else b = s; }
    const reach = (a + b) / 2, undercut = reach > sT;
    let refused = false, message = '';
    try { bevelGear({ module: m, teeth: z, mateTeeth: zm, shaftAngle: S, faceWidth: 4 }); } catch (e) { assert.ok(isGearError(e)); if (e.code === 'UNSUPPORTED_PROFILE_SHIFT') { refused = true; message = e.message; } else throw e; }
    assert.equal(refused, undercut, `z${z}/${zm} Σ${S}: the crown reaches ${reach}, the base cone at ${sT}`);
    if (refused) assert.match(message, new RegExp(`virtual spur gear has ${(z / Math.cos(G.delta)).toFixed(2)} teeth`));
    rows.push(`${z}/${zm} Σ${S}: z_v ${(z / Math.cos(G.delta)).toFixed(2)}, reach ${(reach * G.Re).toFixed(4)} vs ${(sT * G.Re).toFixed(4)} mm ${undercut ? 'undercut' : 'clear'}`);
    // Tredgold's z_v ≥ 2/sin²α = 17.1 says clear at 16/40 (17.23); the exact condition says it is undercut.
    if (z === 16 && zm === 40) { assert.ok(z / Math.cos(G.delta) > 2 / Math.sin(ALPHA) ** 2); assert.equal(undercut, true); }
  }
  t.diagnostic(rows.join('; '));
});

test('refusals and warnings, each with its code', () => {
  const code = (spec, c, re) => assert.throws(() => bevelGear({ module: 2, teeth: 20, mateTeeth: 40, faceWidth: 10, ...spec }), e => isGearError(e) && e.code === c && (!re || re.test(e.message)), `${JSON.stringify(spec)} → ${c}`);
  code({ teeth: 40, mateTeeth: 20, shaftAngle: 120 }, 'UNSUPPORTED_GEAR_KIND', /crown gear/);
  code({ teeth: 60, mateTeeth: 20, shaftAngle: 120 }, 'UNSUPPORTED_GEAR_KIND', /internal bevel/);
  code({ pressureAngle: 25 }, 'UNSUPPORTED_GEAR_KIND'); code({ profileShiftCoefficient: 0.2 }, 'UNSUPPORTED_GEAR_KIND', /Gleason/); code({ system: 'gleason' }, 'UNSUPPORTED_GEAR_KIND', /Gleason/);
  code({ faceWidth: 45 }, 'INVALID_INPUT', /cone distance 44\.7214/); code({ shaftAngle: 180 }, 'INVALID_INPUT'); code({ teeth: 4 }, 'INVALID_INPUT'); code({ mateTeeth: 201 }, 'INVALID_INPUT');
  code({ boreDiameter: 30 }, 'BORE_INTERSECTION', /at most Ø23\.541/); code({ toothThicknessReduction: 3.2 }, 'INVALID_INPUT', /no tooth/); code({ module: 0 }, 'INVALID_INPUT');
  // The face over R/3: a warning; the schematic root always said.
  const w = bevelGear({ module: 2, teeth: 20, mateTeeth: 40, faceWidth: 20 }).report.diagnostics;
  assert.deepEqual(w.map(d => [d.code, d.severity]), [['ROOT_TRANSITION_UNVALIDATED', 'warning'], ['INVALID_INPUT', 'warning']]); assert.match(w[1].message, /third of the cone distance/);
  // A pair: each the other's mate, one module, one shaft angle.
  const g = { module: 2, teeth: 20, mateTeeth: 40, faceWidth: 10 }, h = { module: 2, teeth: 40, mateTeeth: 20, faceWidth: 10 };
  for (const [a, b, re] of [[g, { ...h, module: 2.5 }, /modules/], [g, { ...h, shaftAngle: 80 }, /shaft angles/], [g, { ...h, teeth: 41, mateTeeth: 20 }, /mateTeeth/]])
    assert.throws(() => checkBevelGearPair(a, b, { mode: 'verdict' }), e => e.code === 'MATE_INCOMPATIBLE' && re.test(e.message));
});

/** A whole gear's outline on the unit sphere as a polyline (F points a flank) in its own frame. */
function gearPolyline(G, F) { const out = []; for (let k = 0; k < G.z; k++) out.push(...toothPoints(G, G.step * k, F)); out.push(out[0]); return out; }
const orient = (px, py, qx, qy, rx, ry) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
function pointSegment(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
/** The least distance between two segment sets (x0 y0 x1 y1), and whether two cross, by a grid of cell h over B (larger distances come back as h). */
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
        if (orient(ax, ay, bx, by, cx, cy) * orient(ax, ay, bx, by, dx, dy) < 0 && orient(cx, cy, dx, dy, ax, ay) * orient(cx, cy, dx, dy, bx, by) < 0) crossed = true;
        best = Math.min(best, pointSegment(ax, ay, cx, cy, dx, dy), pointSegment(bx, by, cx, cy, dx, dy), pointSegment(cx, cy, ax, ay, bx, by), pointSegment(dx, dy, ax, ay, bx, by));
      }
    }
  }
  return { min: best, crossed };
}
/**
 * The pair swept on the heel sphere with this file's outlines: gear 1 about +Z turned θ, gear 2 about (sin Σ, 0, cos Σ)
 * in its frame (X toward the pitch line), turned π/z2 − θ z1/z2 + phase; each read by the gnomonic projection at the
 * pitch point (great circles to lines) near it, × Re.
 */
function sweepHere(G1, G2, { phase = 0, samples = 64, F = 600 } = {}) {
  const P = [Math.sin(G1.delta), 0, Math.cos(G1.delta)], e1 = [0, 1, 0], e2 = [Math.cos(G1.delta), 0, -Math.sin(G1.delta)];
  const Z2 = [Math.sin(G1.Sg), 0, Math.cos(G1.Sg)], c2 = Math.cos(G2.delta), s2 = Math.sin(G2.delta), X2 = [(P[0] - c2 * Z2[0]) / s2, 0, (P[2] - c2 * Z2[2]) / s2], Y2 = [Z2[1] * X2[2] - Z2[2] * X2[1], Z2[2] * X2[0] - Z2[0] * X2[2], Z2[0] * X2[1] - Z2[1] * X2[0]];
  const O1 = gearPolyline(G1, F), O2 = gearPolyline(G2, F);
  const project = (O, turn, frame) => {
    const c = Math.cos(turn), s = Math.sin(turn), out = []; let prev = null;
    for (const p of O) {
      const q = [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]], w = frame ? [q[0] * X2[0] + q[1] * Y2[0] + q[2] * Z2[0], q[0] * X2[1] + q[1] * Y2[1] + q[2] * Z2[1], q[0] * X2[2] + q[1] * Y2[2] + q[2] * Z2[2]] : q;
      const k = dot(w, P), uv = k > Math.cos(0.35) ? [G1.Re * dot(w, e1) / k, G1.Re * dot(w, e2) / k] : null;
      if (prev && uv) out.push(prev[0], prev[1], uv[0], uv[1]); prev = uv;
    }
    return Float64Array.from(out);
  };
  let least = Infinity, most = -Infinity; const crossings = [];
  for (let i = 0; i < samples; i++) {
    const th = 2 * Math.PI / G1.z * i / samples, r = segmentClearance(project(O1, th, false), project(O2, Math.PI / G2.z - th * G1.z / G2.z + phase, true), 0.1);
    if (r.crossed) crossings.push(i); else { least = Math.min(least, r.min); most = Math.max(most, r.min); }
  }
  return { least, most, crossings };
}

test('the pair on the heel sphere: the product\'s sweep against the sweep written here (j cos α/2 at every phase), a phase off crossing; the contact ratio against the great circle of action cut by both tip cones here; the tip clearances; Tredgold\'s estimate by its formula', t => {
  for (const [z1, z2, S, j] of [[20, 40, 90, 2e-4], [16, 24, 60, 0.1], ...(SURVEY ? [[18, 30, 120, 2e-4], [13, 13, 90, 2e-4], [25, 60, 90, 2e-4]] : [])]) {
    const m = 2, b = 8, c1 = { m, z: z1, zm: z2, S, b, red: j / 2 }, c2 = { m, z: z2, zm: z1, S, b, red: j / 2 }, G1 = geom(c1), G2 = geom(c2);
    const t0 = performance.now(), chk = checkBevelGearPair(specOf(c1), specOf(c2)), ms = performance.now() - t0, here = sweepHere(G1, G2);
    // (The gnomonic plane stretches distances away from the pitch point, by up to about 0.2% across the path of contact:
    // this file's sweep is read in it, so its bound grows with the clearance; the product's is measured on the sphere.)
    assert.deepEqual(here.crossings, []); assert.ok(here.most - here.least <= 2e-6 + 2e-3 * j, `this file's sweep varies by ${here.most - here.least}`);
    close(here.least, j * Math.cos(ALPHA) / 2, 2e-6 + 2e-3 * j, 'the clearance here, j cos α / 2');
    assert.equal(chk.sweep.interference, false); assert.equal(chk.sweep.converged, true);
    // (The product's outlines are chords of the involute, 150 a flank, inside each convex tooth: the least can only come
    // out larger, by up to their sag, which it reports.)
    const want = j * Math.cos(ALPHA) / 2;
    assert.ok(chk.sweep.minimumClearance >= want - 1e-9 && chk.sweep.minimumClearance <= want + chk.sweep.chordSag + 1e-9, `the product's least clearance ${chk.sweep.minimumClearance} vs ${want} (+ sag ${chk.sweep.chordSag})`);
    // A phase off by a third of gear 2's pitch: both cross.
    const off = 2 * Math.PI / z2 / 3, offHere = sweepHere(G1, G2, { phase: off, samples: 16 }), offChk = checkBevelGearPair(specOf(c1), specOf(c2), { relativePhase: off * 180 / Math.PI, mode: 'verdict' });
    assert.ok(offHere.crossings.length > 0); assert.equal(offChk.sweep.interference, true);
    // The contact ratio: the great circle of action through P (gear 1's frame), from where gear 2's tip cone cuts it to where gear 1's does, over the base pitch.
    const P = [Math.sin(G1.delta), 0, Math.cos(G1.delta)], eTh = [Math.cos(G1.delta), 0, -Math.sin(G1.delta)], d = [-Math.sin(ALPHA) * eTh[0], Math.cos(ALPHA), -Math.sin(ALPHA) * eTh[2]];
    const C = s => [Math.cos(s) * P[0] + Math.sin(s) * d[0], Math.cos(s) * P[1] + Math.sin(s) * d[1], Math.cos(s) * P[2] + Math.sin(s) * d[2]], ax2 = [Math.sin(G1.Sg), 0, Math.cos(G1.Sg)];
    const cut = (f, target) => { let a = 0, b = 0.5; for (let i = 0; i < 200; i++) { const s = (a + b) / 2; if (f(s) < target) a = s; else b = s; } return (a + b) / 2; };
    // (Toward T1, s > 0, the polar angle about gear 2's axis grows; toward T2, s < 0, about gear 1's.)
    const sA = cut(s => Math.acos(dot(C(s), ax2)), G2.tip), sB = -cut(s => Math.acos(C(-s)[2]), G1.tip), pb = 2 * Math.PI * Math.sin(G1.db) / z1;
    close(chk.idealContactRatio, (sA - sB) / pb, 1e-9, 'ε by the great circle of action');
    const zv1 = z1 / Math.cos(G1.delta), zv2 = z2 / Math.cos(G2.delta), rv1 = m * zv1 / 2, rv2 = m * zv2 / 2, ca = Math.cos(ALPHA);
    close(chk.tredgoldContactRatio, (Math.sqrt((rv1 + m) ** 2 - (rv1 * ca) ** 2) + Math.sqrt((rv2 + m) ** 2 - (rv2 * ca) ** 2) - (rv1 + rv2) * Math.sin(ALPHA)) / (Math.PI * m * ca), 1e-12, "Tredgold's ε");
    close(chk.tipClearances[0], G1.Re * (Math.atan(1.25 * m / G1.Re) - Math.atan(m / G1.Re)), 1e-12, 'heel tip clearance'); close(chk.backlash, j, 1e-15, 'backlash'); close(chk.speedRatio, z2 / z1, 1e-15, 'ratio');
    t.diagnostic(`z${z1}/${z2} Σ${S}° j ${j}: here ${here.least.toExponential(4)}…${here.most.toExponential(4)}, product ${chk.sweep.minimumClearance.toExponential(4)} (sag ≤ ${chk.sweep.chordSag.toExponential(1)}; j cos α/2 ${(j * Math.cos(ALPHA) / 2).toExponential(4)}), ε ${chk.idealContactRatio.toFixed(5)} (Tredgold ${chk.tredgoldContactRatio.toFixed(5)}), ${ms.toFixed(0)} ms`);
  }
});

test('the part model: a pinion and its mate by mesh — the same apex, the axes at Σ, the mate turning by −z1/z2 (this file\'s formula), phase 0 and clear by checkPlacedBevelGears; the exact Boolean intersection empty when meshed (a small pair; the 16/20 pair and a phase off overlapping in the survey); refusals; STEP', () => {
  const base = (dir, rot, phase = 0) => [{ id: 'p', kind: 'bevel-gear', module: 2, teeth: 16, mateTeeth: 20, faceWidth: 6, thicknessReduction: 0.05, rotation: rot, center: [5, -3], from: 2 }, { id: 'w', kind: 'bevel-gear', module: 2, teeth: 20, mateTeeth: 16, faceWidth: 6, thicknessReduction: 0.05, mesh: { gear: 'p', direction: dir, phase } }];
  for (const [dir, rot] of [[0, 0], [30, 7], [200, -13]]) {
    const P = evaluateCadPart(D(base(dir, rot))), a = outputOf(P, 'p'), b = outputOf(P, 'w'), pa = a.bevelGearPlacement, pb = b.bevelGearPlacement;
    assert.deepEqual(pb.apex, [5, -3, 2]); close(dot(pa.axis, pb.axis), Math.cos(Math.PI / 2), 1e-15, 'axes at Σ');
    // The mate's axis toward the direction about the pinion's axis; its turn π/z2 − (ρ1 − φ) z1/z2.
    const phi = dir * Math.PI / 180; close(Math.atan2(pb.axis[1], pb.axis[0]), Math.atan2(Math.sin(phi), Math.cos(phi)), 1e-12, 'toward the direction');
    close(pb.rotation, Math.PI / 20 - (rot * Math.PI / 180 - phi) * 16 / 20, 1e-12, "the mate's turn");
    const c = checkPlacedBevelGears(pa, pb); assert.equal(c.relativePhase, 0); assert.equal(c.sweep.interference, false);
    assert.equal(checkOutput(a).valid, true); assert.equal(checkOutput(b).valid, true);
    // The mate's teeth stand where the sweep put them: its heel points at the cone distance from the shared apex.
    for (const f of b.brep.faces.filter(f => f.name === 'w.heel')) { const p = evaluateSurface(f.surface, 0.5, 0.5); close(Math.hypot(p[0] - 5, p[1] + 3, p[2] - 2), bevelGearDimensions({ module: 2, teeth: 20, mateTeeth: 16, faceWidth: 6 }).Re, 1e-9, 'heel about the apex'); }
  }
  // The exact Boolean, apart from the sweep — the one Boolean the default suite keeps for bevel gears (a small pair, 13/13
  // 4 wide: about 11 s, the 16/20 pair's 20 s in the survey, D135).
  const small = phase => [{ id: 'p', kind: 'bevel-gear', module: 2, teeth: 13, mateTeeth: 13, faceWidth: 4, thicknessReduction: 0.05 }, { id: 'w', kind: 'bevel-gear', module: 2, teeth: 13, mateTeeth: 13, faceWidth: 4, thicknessReduction: 0.05, mesh: { gear: 'p', phase } }];
  assert.throws(() => outputOf(evaluateCadPart(D([...small(0), { id: 'i', kind: 'intersect', target: 'p', tool: 'w' }])), 'i'), e => (e.details?.category ?? e.code) === 'REFERENCE' && /no output i/.test(e.message));
  if (SURVEY) {
    assert.throws(() => outputOf(evaluateCadPart(D([...base(0, 0), { id: 'i', kind: 'intersect', target: 'p', tool: 'w' }])), 'i'), e => (e.details?.category ?? e.code) === 'REFERENCE' && /no output i/.test(e.message));
    // (4° off. At 6° the analytic Boolean failed — a non-manifold result where the inputs touched along an edge, D134 — until
    // D150 fixed a general face's domain map across C0 knots; that pair is test/d150-bevel-pair.test.mjs's.)
    const off = outputOf(evaluateCadPart(D([...base(0, 0, 4), { id: 'i', kind: 'intersect', target: 'p', tool: 'w' }])), 'i'); assert.ok(brepMassProperties(off.brep, 1).volume > 1, 'a phase off: the teeth overlap');
  }
  // Refusals in the part model.
  assert.throws(() => outputOf(evaluateCadPart(D([base(0, 0)[0], { ...base(0, 0)[1], mateTeeth: 17 }])), 'w'), e => (e.details?.category ?? e.code) === 'INPUT' && /MATE_INCOMPATIBLE/.test(e.message));
  assert.throws(() => outputOf(evaluateCadPart(D([{ id: 'p', kind: 'bevel-gear', module: 2, teeth: 12, mateTeeth: 40, faceWidth: 6 }])), 'p'), e => (e.details?.category ?? e.code) === 'CAPABILITY' && /undercut/.test(e.message));
  assert.throws(() => outputOf(evaluateCadPart(D([{ id: 'p', kind: 'bevel-gear', module: 2, teeth: 20, mateTeeth: 40, faceWidth: 6, generator: 'bevel-gear@1' }])), 'p'), e => (e.details?.category ?? e.code) === 'CAPABILITY');
  assert.throws(() => outputOf(evaluateCadPart(D([{ id: 'p', kind: 'spur-gear', module: 2, teeth: 20, faceWidth: 6 }, { ...base(0, 0)[1], mesh: { gear: 'p' } }])), 'w'), e => (e.details?.category ?? e.code) === 'REFERENCE');
  // STEP: the volume and the names back.
  const { brep } = bevelGear({ module: 2, teeth: 20, mateTeeth: 40, faceWidth: 10, boreDiameter: 12 }, { id: 'b' }), back = importStep(exportStep([brep], { name: 'bevel' }));
  close(brepMassProperties(back, 1).volume, brepMassProperties(brep, 1).volume, 1e-6 * brepMassProperties(brep, 1).volume, 'round trip'); assert.ok(back.faces.some(f => f.name === 'b.heel')); assert.equal(checkBrep(back).valid, true);
});
