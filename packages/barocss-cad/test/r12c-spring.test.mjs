import test from 'node:test';
import assert from 'node:assert/strict';
import { compressionSpring, springDimensions, springSolidPitch, helicalSweep, SpringError, checkBrep, brepMassProperties, evaluateSurface, surfaceDomain, evaluateCadPart, exportStep, importStep } from '../dist/index.js';
import { brepBounds } from '../dist/brep/brep-bounds.js';

// R12c.1a (D153): the helical sweep of the exact normal-plane circle, and compression springs (D139's stage), against
// oracles written here, none of them the kernel's:
// - the centreline re-derived from D153's frozen pitch law (constant runs; the smoothstep transitions), its length by
//   composite Simpson, its least distance one turn on by Newton;
// - V = πa²·S (a tube square to its path, Pappus–Guldin), within 2πa·S·(the reported fit bound);
// - the surface's distance from the centreline (Newton on φ for sampled surface points), within the reported bound;
// - ground ends: a plane through the centreline's start height removes (2/3)a³·R/h (derived below);
// - k = Gd⁴/(8D³n_a) by the wire's torsion energy; τ by Wahl's factor; the solid pitch by brute-force least distance.

const near = (got, want, rel, what) => assert.ok(Math.abs(got - want) <= rel * Math.abs(want), `${what}: ${got} vs ${want} (rel ${Math.abs(got - want) / Math.abs(want)})`);
const vol = brep => brepMassProperties(brep, 1, { quadratureSegments: 12 }).volumeMM3;
const code = c => e => e instanceof SpringError && e.code === c;

/** The centreline's z(φ) by D153's law: runs of constant pitch, or the smoothstep 3t² − 2t³ between two pitches. */
function centreline(R, runs, z0) {
  const out = []; let phi = 0, z = z0;
  for (const r of runs) { const D = 2 * Math.PI * r.turns, p1 = r.to ?? r.p; out.push({ a: phi, b: phi + D, p0: r.p, p1, z0: z }); z += D / (2 * Math.PI) * (r.p + p1) / 2; phi += D; }
  const run = f => out.find(r => f <= r.b + 1e-12) ?? out[out.length - 1];
  // z' = p(φ)/2π, p = p0 + (p1 − p0)(3t² − 2t³); z by its integral t³ − t⁴/2.
  const zAt = f => { const r = run(f), D = r.b - r.a, t = Math.min(1, Math.max(0, (f - r.a) / D)); return r.z0 + D / (2 * Math.PI) * (r.p0 * t + (r.p1 - r.p0) * (t ** 3 - t ** 4 / 2)); };
  const zp = f => { const r = run(f), t = Math.min(1, Math.max(0, (f - r.a) / (r.b - r.a))); return (r.p0 + (r.p1 - r.p0) * (3 * t * t - 2 * t ** 3)) / (2 * Math.PI); };
  const zpp = f => { const r = run(f), D = r.b - r.a, t = Math.min(1, Math.max(0, (f - r.a) / D)); return (r.p1 - r.p0) * 6 * t * (1 - t) / (2 * Math.PI * D); };
  // Its length, composite Simpson (2000 intervals a run).
  let S = 0;
  for (const r of out) { const n = 2000, h = (r.b - r.a) / n; let s = 0; for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * Math.hypot(R, zp(r.a + i * h)); S += s * h / 3; }
  return { zAt, zp, zpp, S, end: phi, endZ: z };
}
/** The distance of x from the centreline (R, z(φ)): Newton on φ from x's own angle on each turn near its height, the least. */
function distance(x, R, C) {
  const f0 = Math.atan2(x[1], x[0]), clamp = f => Math.min(C.end, Math.max(0, f));
  let best = Infinity;
  for (let k = -1; k <= 60; k++) {
    let f = f0 + 2 * Math.PI * k;
    if (f < -Math.PI || f > C.end + Math.PI || Math.abs(C.zAt(clamp(f)) - x[2]) > 4 * R) continue;
    f = clamp(f);
    for (let it = 0; it < 40; it++) {
      const c = Math.cos(f), s = Math.sin(f), d = [R * c - x[0], R * s - x[1], C.zAt(f) - x[2]], d1 = [-R * s, R * c, C.zp(f)], d2 = [-R * c, -R * s, C.zpp(f)];
      const g = d[0] * d1[0] + d[1] * d1[1] + d[2] * d1[2], gp = d1[0] ** 2 + d1[1] ** 2 + d1[2] ** 2 + d[0] * d2[0] + d[1] * d2[1] + d[2] * d2[2], step = g / gp;
      f = clamp(f - step); if (Math.abs(step) < 1e-14) break;
    }
    best = Math.min(best, Math.hypot(R * Math.cos(f) - x[0], R * Math.sin(f) - x[1], C.zAt(f) - x[2]));
  }
  return best;
}
/** The largest |distance − a| over a grid on every wire face (every `stride`-th face). */
function worstDistance(brep, R, a, C, stride = 1) {
  let worst = 0;
  brep.faces.filter(f => /\.wire#/.test(f.name)).forEach((f, k) => {
    if (k % stride) return;
    const dom = surfaceDomain(f.surface);
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 12; j++) worst = Math.max(worst, Math.abs(distance(evaluateSurface(f.surface, dom.u[0] + (dom.u[1] - dom.u[0]) * i / 6, dom.v[0] + (dom.v[1] - dom.v[0]) * j / 12), R, C) - a));
  });
  return worst;
}
/** The least distance between turns of a helix (R, p): brute force over the angle one turn on. */
function leastTurnGap(R, p) { const h = p / (2 * Math.PI); let best = Infinity; for (let i = -2000; i <= 2000; i++) { const t = 2 * Math.PI + i * 2e-4; best = Math.min(best, Math.hypot(2 * R * Math.sin(t / 2), h * t)); } return best; }

test('R12c.1a open ends: the wire is the exact pipe of the helix within the measured fit — V = πa²·S, its distance from the centreline, valid, genus 0; the report against closed forms', t => {
  const R = 10, a = 1, p = 5, n = 6, G = 79300;
  const t0 = performance.now(), { brep, report } = compressionSpring({ wireDiameterMM: 2, meanDiameterMM: 20, activeCoils: n, pitchMM: p, ends: 'open', shearModulusMPa: G, loadN: 10 }, { id: 'sp' }), ms = performance.now() - t0;
  const chk = checkBrep(brep);
  assert.equal(chk.valid, true, chk.issues[0]); assert.equal(chk.topology.length, 1); assert.equal(chk.topology[0].genus, 0);
  const h = p / (2 * Math.PI), gamma = R / Math.hypot(R, h), C = centreline(R, [{ turns: n, p }], a * gamma), dev = report.sweep.profileDeviationMM;
  near(C.S, n * 2 * Math.PI * Math.hypot(R, h), 1e-12, 'the test\'s own length against the helix\'s closed form');
  near(report.sweep.wireLengthMM, C.S, 1e-12, 'wire length');
  assert.ok(dev <= report.sweep.profileToleranceMM && report.sweep.profileToleranceMM === 2e-4, `fit ${dev} within 1e-4·d`);
  const worst = worstDistance(brep, R, a, C);
  assert.ok(worst <= dev + 1e-12, `distance from the centreline off by ${worst}, the reported bound ${dev}`);
  const V = vol(brep), want = Math.PI * a * a * C.S;
  assert.ok(Math.abs(V - want) <= 2 * Math.PI * a * C.S * dev + 1e-9 * want, `V ${V} vs πa²S ${want}`);
  // The bounds: from its lowest point at z 0 to L0 = n p + 2aγ (the end discs' extreme points, tilted by the helix angle).
  const b = brepBounds(brep), d = report.dimensions;
  near(d.freeLengthMM, n * p + 2 * a * gamma, 1e-12, 'free length');
  assert.ok(Math.abs(b.min[2]) <= 1e-6 && Math.abs(b.max[2] - d.freeLengthMM) <= 1e-6, `z from ${b.min[2]} to ${b.max[2]}`);
  near(d.helixAngleDeg, Math.atan(p / (Math.PI * 20)) * 180 / Math.PI, 1e-12, 'helix angle');
  // The rate by the wire's torsion energy: torque FD/2 over length πD n, J = πd⁴/32 (Castigliano; shear of direct load neglected).
  const F = 10, J = Math.PI * 16 / 32, U = (F * 10) ** 2 * Math.PI * 20 * n / (2 * G * J);
  near(d.rateNPerMM, F / (2 * U / F), 1e-12, 'rate');
  near(d.wahlFactor, (4 * 10 - 1) / (4 * 10 - 4) + 0.615 / 10, 1e-15, 'Wahl');
  near(d.load.shearStressMPa, d.wahlFactor * 8 * F * 20 / (Math.PI * 8), 1e-12, 'corrected shear stress');
  near(d.load.deflectionMM, F / d.rateNPerMM, 1e-12, 'deflection');
  // The geometric solid pitch: neighbouring turns d apart (brute force), above d by the helix angle.
  near(leastTurnGap(R, d.solidPitchMM), 2, 1e-7, 'turns d apart at the solid pitch');
  assert.ok(d.solidPitchMM > 2 && d.solidPitchMM < 2.002);
  assert.equal(d.supplierSolidHeightRule, 'd·(n_t + 1)'); assert.equal(d.supplierSolidHeightMM, 14);
  assert.equal(report.manufacturingValidated, false);
  t.diagnostic(`open D 20 d 2 p 5, 6 turns: ${report.sweep.pieces} pieces (${report.sweep.segments} segments), ${brep.faces.length} faces, built ${ms.toFixed(0)} ms; fit ${dev.toExponential(2)}, distance off by ${worst.toExponential(2)}; V ${V.toFixed(6)} vs πa²S ${want.toFixed(6)} (rel ${(Math.abs(V - want) / want).toExponential(2)})`);
});

test('R12c.1a closed ends: a dead coil at the geometric solid pitch each end, easing (smoothstep, 90°) to the body — V = πa²·S on the variable centreline, its distance, the free length 2p_s + n_a p + 2aγ_s', t => {
  const R = 10, a = 1, p = 5, n = 6, { brep, report } = compressionSpring({ wireDiameterMM: 2, meanDiameterMM: 20, activeCoils: n, pitchMM: p, ends: 'closed' }, { id: 'sc' });
  const chk = checkBrep(brep);
  assert.equal(chk.valid, true, chk.issues[0]); assert.equal(chk.topology[0].genus, 0);
  const ps = springSolidPitch(20, 2), gs = R / Math.hypot(R, ps / (2 * Math.PI)), q = 0.25;
  const C = centreline(R, [{ turns: 1 - q / 2, p: ps }, { turns: q, p: ps, to: p }, { turns: n - q, p }, { turns: q, p, to: ps }, { turns: 1 - q / 2, p: ps }], a * gs);
  near(report.sweep.wireLengthMM, C.S, 1e-10, 'wire length (Simpson on the variable centreline)');
  const d = report.dimensions;
  near(d.freeLengthMM, 2 * ps + n * p + 2 * a * gs, 1e-12, 'free length'); near(C.endZ + a * gs, d.freeLengthMM, 1e-12, 'the centreline\'s rise');
  assert.equal(d.totalCoils, 8); near(d.solidHeightMM, 8 * ps + 2 * a * gs, 1e-12, 'geometric solid height'); assert.equal(d.supplierSolidHeightMM, 18);
  const dev = report.sweep.profileDeviationMM, worst = worstDistance(brep, R, a, C);
  assert.ok(worst <= dev + 1e-12 && dev <= 2e-4, `distance off by ${worst}, bound ${dev}`);
  const V = vol(brep), want = Math.PI * a * a * C.S;
  assert.ok(Math.abs(V - want) <= 2 * Math.PI * a * C.S * dev + 1e-9 * want, `V ${V} vs πa²S ${want}`);
  const b = brepBounds(brep);
  assert.ok(Math.abs(b.min[2]) <= 1e-6 && Math.abs(b.max[2] - d.freeLengthMM) <= 1e-6, `z from ${b.min[2]} to ${b.max[2]}`);
  // The dead coil's turns stay d apart from the next (the pitch only grows toward the body).
  t.diagnostic(`closed: ${report.sweep.pieces} pieces, ${brep.faces.length} faces; least curvature radius ${report.sweep.minCurvatureRadiusMM.toFixed(6)}; distance off by ${worst.toExponential(2)} (bound ${dev.toExponential(2)}); V rel ${(Math.abs(V - want) / want).toExponential(2)}`);
});

test('R12c.1a closed and ground: the ends cut square to the axis at the centreline\'s end heights — V = πa²S − (4/3)a³R/h_s, flat at z 0 and L0 = 2p_s + n_a p', t => {
  // Below the plane z0 = z(0), in the pipe's coordinates (arc s, section x along e1, y along e2): a point's height is
  // z(s) + yγ, dV = (1 − κx) dx dy ds. Where the pitch is constant (the dead coil: z(s) = z0 + s h/L), a section point
  // (x, y) lies below the plane for s < −yR/h (y < 0), so the cut takes ∫_{y<0} (1 − κx)(−yR/h) dA = (2/3)a³·R/h
  // (the x term vanishes by symmetry). The same at the top.
  const R = 10, a = 1, p = 5, n = 6, t0 = performance.now();
  const { brep, report } = compressionSpring({ wireDiameterMM: 2, meanDiameterMM: 20, activeCoils: n, pitchMM: p }, { id: 'sg' }), ms = performance.now() - t0;
  assert.equal(report.ends, 'closed-ground');
  const chk = checkBrep(brep);
  assert.equal(chk.valid, true, chk.issues[0]); assert.equal(chk.topology.length, 1); assert.equal(chk.topology[0].genus, 0);
  const ps = springSolidPitch(20, 2), hs = ps / (2 * Math.PI), q = 0.25;
  const C = centreline(R, [{ turns: 1 - q / 2, p: ps }, { turns: q, p: ps, to: p }, { turns: n - q, p }, { turns: q, p, to: ps }, { turns: 1 - q / 2, p: ps }], 0);
  // (The cut's band, φ up to aγ/h_s, lies in the dead coil: the closed form holds.)
  assert.ok(a * R / Math.hypot(R, hs) / hs < 2 * Math.PI * (1 - q / 2));
  const d = report.dimensions, V = vol(brep), want = Math.PI * a * a * C.S - 2 * (2 / 3) * a ** 3 * R / hs, dev = report.sweep.profileDeviationMM;
  near(d.freeLengthMM, 2 * ps + n * p, 1e-12, 'free length'); near(C.endZ, d.freeLengthMM, 1e-12, 'rise');
  assert.ok(Math.abs(V - want) <= 2 * Math.PI * a * C.S * dev + 1e-9 * want, `V ${V} vs πa²S − (4/3)a³R/h ${want}`);
  const b = brepBounds(brep);
  assert.ok(Math.abs(b.min[2]) <= 1e-9 && Math.abs(b.max[2] - d.freeLengthMM) <= 1e-9, `z from ${b.min[2]} to ${b.max[2]}`);
  const names = new Set(brep.faces.map(f => f.name.replace(/#\d+$/, '')));
  assert.deepEqual([...names].sort(), ['sg.end0', 'sg.end1', 'sg.ground0', 'sg.ground1', 'sg.wire']);
  assert.equal(new Set(brep.faces.map(f => f.name)).size, brep.faces.length, 'face names unique');
  near(d.solidHeightMM, 8 * ps, 1e-12, 'geometric solid height n_t p_s'); assert.equal(d.supplierSolidHeightRule, 'd·n_t'); assert.equal(d.supplierSolidHeightMM, 16);
  // A STEP round trip keeps it.
  const back = importStep(exportStep([brep], { name: 'spring' }));
  assert.equal(checkBrep(back).valid, true); near(vol(back), V, 1e-9, 'STEP round trip');
  t.diagnostic(`ground: ${brep.faces.length} faces, built ${ms.toFixed(0)} ms; V ${V.toFixed(6)} vs ${want.toFixed(6)} (rel ${(Math.abs(V - want) / want).toExponential(2)}, the fit's bound ${(2 * Math.PI * a * C.S * dev / want).toExponential(2)})`);
});

test('R12c.1a: a long fine spring, ground (20 turns; D 40 d 1), and the left hand as the right hand\'s mirror', t => {
  const t0 = performance.now(), long = compressionSpring({ wireDiameterMM: 1, meanDiameterMM: 40, activeCoils: 20, pitchMM: 2.5 }, { id: 'lg' }), ms = performance.now() - t0;
  assert.equal(checkBrep(long.brep).valid, true);
  const ps = springSolidPitch(40, 1), hs = ps / (2 * Math.PI), q = 0.25, C = centreline(20, [{ turns: 1 - q / 2, p: ps }, { turns: q, p: ps, to: 2.5 }, { turns: 20 - q, p: 2.5 }, { turns: q, p: 2.5, to: ps }, { turns: 1 - q / 2, p: ps }], 0);
  const V = vol(long.brep), want = Math.PI * 0.25 * C.S - (4 / 3) * 0.125 * 20 / hs;
  assert.ok(Math.abs(V - want) <= Math.PI * C.S * long.report.sweep.profileDeviationMM + 1e-9 * want, `V ${V} vs ${want}`);
  t.diagnostic(`D 40 d 1, 20 active coils ground: ${long.report.sweep.pieces} pieces, ${long.brep.faces.length} faces, ${ms.toFixed(0)} ms; V rel ${(Math.abs(V - want) / want).toExponential(2)}`);
  const right = compressionSpring({ wireDiameterMM: 2, meanDiameterMM: 20, activeCoils: 3, pitchMM: 5, ends: 'closed' }), left = compressionSpring({ wireDiameterMM: 2, meanDiameterMM: 20, activeCoils: 3, pitchMM: 5, ends: 'closed', hand: 'left' });
  assert.equal(checkBrep(left.brep).valid, true); near(vol(left.brep), vol(right.brep), 1e-12, 'left = right');
  // The left hand is the right hand mirrored in XZ, vertex for vertex.
  const key = p => p.map(x => x.toFixed(9)).join(','), mirrored = new Set(right.brep.vertices.map(v => key([v.point[0], -v.point[1], v.point[2]])));
  assert.ok(left.brep.vertices.every(v => mirrored.has(key(v.point))), 'left = mirror(right)');
  // A right-hand coil climbs counter-clockwise seen from +Z: its first wire face, just after φ 0, lies on +Y (left: −Y).
  const mid = (brep, name) => { const f = brep.faces.find(x => x.name === name), d = surfaceDomain(f.surface); return evaluateSurface(f.surface, (d.u[0] + d.u[1]) / 2, (d.v[0] + d.v[1]) / 2); };
  assert.ok(mid(right.brep, 'spring.wire#1')[1] > 0 && mid(left.brep, 'spring.wire#1')[1] < 0, 'hand');
});

test('R12c.1a: the free length gives the pitch back; each end type\'s L0 ↔ p', () => {
  for (const ends of ['open', 'closed', 'closed-ground']) {
    const a = springDimensions({ wireDiameterMM: 1.5, meanDiameterMM: 12, activeCoils: 7.5, pitchMM: 3.2, ends });
    const b = springDimensions({ wireDiameterMM: 1.5, meanDiameterMM: 12, activeCoils: 7.5, freeLengthMM: a.freeLengthMM, ends });
    near(b.pitchMM, 3.2, 1e-12, `${ends}: pitch from L0`);
  }
  // Outer and inner diameters as the mean ± d.
  near(springDimensions({ wireDiameterMM: 2, outerDiameterMM: 22, activeCoils: 5, pitchMM: 4 }).meanDiameterMM, 20, 0, 'from OD');
  near(springDimensions({ wireDiameterMM: 2, innerDiameterMM: 18, activeCoils: 5, pitchMM: 4 }).meanDiameterMM, 20, 0, 'from ID');
});

test('R12c.1a refusals: INVALID_INPUT, COILS_OVERLAP (pitch d is below the solid pitch), UNSUPPORTED_SPRING_KIND, PROFILE_BUDGET_EXCEEDED, SELF_INTERSECTION; a load past solid warns', () => {
  const base = { wireDiameterMM: 2, meanDiameterMM: 20, activeCoils: 6, pitchMM: 5 };
  for (const bad of [{ wireDiameterMM: 0 }, { meanDiameterMM: 2 }, { activeCoils: 0 }, { freeLengthMM: 30 }, { meanDiameterMM: undefined }, { outerDiameterMM: 22 }, { ends: 'squared' }, { transitionDeg: 1000, ends: 'closed', activeCoils: 1 }])
    assert.throws(() => compressionSpring({ ...base, ...bad }), code('INVALID_INPUT'), JSON.stringify(bad));
  // Touching coils wound at p = d overlap by a hair: the turns are d apart only at the geometric solid pitch (S0).
  assert.throws(() => compressionSpring({ ...base, pitchMM: 2, ends: 'open' }), e => code('COILS_OVERLAP')(e) && /2\.001014/.test(e.message));
  assert.throws(() => compressionSpring({ ...base, pitchMM: undefined, freeLengthMM: 14, ends: 'closed-ground' }), code('COILS_OVERLAP'));
  // (Extension and torsion springs are hookedSpring's since R12c.1b, D154: compressionSpring refuses them as input.)
  for (const bad of [{ type: 'extension' }, { type: 'torsion' }]) assert.throws(() => compressionSpring({ ...base, ...bad }), code('INVALID_INPUT'), JSON.stringify(bad));
  for (const bad of [{ type: 'leaf' }, { body: 'conical' }, { wire: 'rectangular' }, { endCoils: 2, ends: 'closed' }])
    assert.throws(() => compressionSpring({ ...base, ...bad }), code('UNSUPPORTED_SPRING_KIND'), JSON.stringify(bad));
  // D/d 100 over 30 turns needs more than the 1024 pieces (S0: 1140 at the gears' rule).
  assert.throws(() => compressionSpring({ wireDiameterMM: 1, meanDiameterMM: 100, activeCoils: 30, pitchMM: 3, ends: 'open' }), code('PROFILE_BUDGET_EXCEEDED'));
  assert.throws(() => helicalSweep('x', { helixRadiusMM: 1, runs: [{ turns: 1, pitchMM: 5 }], section: { kind: 'circle', radiusMM: 1 } }), code('SELF_INTERSECTION'));
  assert.throws(() => helicalSweep('x', { helixRadiusMM: 5, runs: [{ turns: 1, pitchMM: 5 }], section: { kind: 'rectangle' } }), code('UNSUPPORTED_SPRING_KIND'));
  const loaded = compressionSpring({ ...base, ends: 'open', shearModulusMPa: 79300, loadN: 100 });
  assert.deepEqual(loaded.report.diagnostics.map(x => [x.code, x.severity]), [['COILS_OVERLAP', 'warning']]);
});

test('R12c.1a part model: the `spring` kind placed on its axis, its report on the output; refusals mapped with their codes', () => {
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { d: 2 }, features });
  const snap = evaluateCadPart(D([{ id: 's', kind: 'spring', wire: { parameter: 'd' }, diameter: 20, activeCoils: 6, pitch: 5, center: [30, -5], from: 4, rotation: 90, shearModulus: 79300, shearModulusEstimate: true }]));
  const out = snap.output('s'), b = brepBounds(out.brep);
  assert.equal(out.spring.generator, 'spring@0'); assert.equal(out.spring.dimensions.shearModulusEstimate, true);
  near(out.spring.dimensions.rateNPerMM, 79300 * 16 / (8 * 8000 * 6), 1e-12, 'rate');
  assert.ok(Math.abs(b.min[2] - 4) <= 1e-9 && Math.abs(b.max[2] - 4 - out.spring.dimensions.freeLengthMM) <= 1e-9);
  assert.ok(Math.abs((b.min[0] + b.max[0]) / 2 - 30) < 0.2 && Math.abs((b.min[1] + b.max[1]) / 2 + 5) < 0.2, 'about its centre');
  // (Turned 90°: the wire starts on +Y, its ground end there.)
  const g0 = out.brep.faces.find(f => f.name === 's.end0');
  assert.ok(g0, 'the wire\'s start disc');
  const refused = (f, c, tag) => assert.throws(() => evaluateCadPart(D([{ id: 's', kind: 'spring', wire: 2, diameter: 20, activeCoils: 6, pitch: 5, ...f }])), e => (e.details?.category ?? e.code) === c && e.message.includes(`[${tag}]`), tag);
  refused({ pitch: 2, ends: 'open' }, 'GEOMETRY', 'COILS_OVERLAP');
  refused({ body: 'barrel' }, 'CAPABILITY', 'UNSUPPORTED_SPRING_KIND');  // (torsion until D154, which builds it)
  refused({ freeLength: 40 }, 'INPUT', 'INVALID_INPUT');
  assert.throws(() => evaluateCadPart(D([{ id: 's', kind: 'spring', wire: 2, diameter: 20, activeCoils: 6, pitch: 5, generator: 'spring@9' }])), e => (e.details?.category ?? e.code) === 'CAPABILITY');
});
