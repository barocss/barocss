import test from 'node:test';
import assert from 'node:assert/strict';
import { hookedSpring, springSolidPitch, isSpringError, checkBrep, brepMassProperties, evaluateCadPart, exportStep, importStep, outputOf } from '../dist/index.js';
import { brepBounds } from '../dist/brep/brep-bounds.js';

// R12c.1b (D154): extension springs (machine-loop and crossover hooks) and torsion springs (tangent legs), against
// oracles written here, none of them the kernel's:
// - the centreline rebuilt from D154's recipe by plain vector algebra: the coil's end and tangent, each bend's angle and
//   radius, the loop's radius from the axis, the straight run to the axis; its length (helix 2πn√(R² + h²), arcs rθ, runs);
// - V = πa²·(that length) — a tube square to a G1 centreline, its pieces by Pappus (the bends are tori) — within the
//   coil's fit bound;
// - the length inside the hooks and the spring's bounds from the same centreline;
// - k = Gd⁴/(8D³n) by the wire's torsion energy (as R12c.1a), the torsional k = Ed⁴/(64Dn) by its bending energy;
// - the close-wound pitch: neighbouring turns d + 2·tol apart, by brute force.

const near = (got, want, rel, what) => assert.ok(Math.abs(got - want) <= rel * Math.abs(want), `${what}: ${got} vs ${want} (rel ${Math.abs(got - want) / Math.abs(want)})`);
const vol = brep => brepMassProperties(brep, 1, { quadratureSegments: 12 }).volume;
const code = c => e => isSpringError(e) && e.code === c;
const add = (a, b) => a.map((x, i) => x + b[i]), sub = (a, b) => a.map((x, i) => x - b[i]), scl = (a, s) => a.map(x => x * s), dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const unit = a => scl(a, 1 / Math.hypot(...a));
function leastTurnGap(R, p) { const h = p / (2 * Math.PI); let best = Infinity; for (let i = -2000; i <= 2000; i++) { const t = 2 * Math.PI + i * 2e-4; best = Math.min(best, Math.hypot(2 * R * Math.sin(t / 2), h * t)); } return best; }

/** The coil's centreline end (top: φ = 2πn; bottom: φ 0, walked backwards): its point and outward tangent. */
function coilEnd(R, p, n, a, top) {
  const h = p / (2 * Math.PI), L = Math.hypot(R, h), z0 = a * R / L, f = top ? 2 * Math.PI * n : 0, s = top ? 1 : -1;
  return { at: [R * Math.cos(f), R * Math.sin(f), z0 + h * f], t: scl([-R * Math.sin(f), R * Math.cos(f), h], s / L), h, L };
}

test('R12c.1b extension, machine loops: the coil close-wound, a bend up the axis and a half loop centred on it each end — V = πa²·(the centreline\'s length), the length inside the hooks, valid, one body', t => {
  const R = 10, a = 1, d = 2, n = 6, G = 79300, t0 = performance.now();
  const { brep, report } = hookedSpring({ type: 'extension', wireDiameter: d, meanDiameter: 20, activeCoils: n, shearModulus: G, initialTension: 4, load: 14 }, { id: 'ex' }), ms = performance.now() - t0;
  const chk = checkBrep(brep);
  assert.equal(chk.valid, true, chk.issues[0]); assert.equal(chk.topology.length, 1); assert.equal(chk.topology[0].genus, 0);
  const dm = report.dimensions, tol = 2e-4;
  // Close-wound: the turns d + 2·tol apart (the fitted surfaces, each within tol, never meet).
  near(leastTurnGap(R, dm.pitch), d + 2 * tol, 1e-7, 'close-wound gap'); near(dm.pitch, springSolidPitch(20, d + 2 * tol), 1e-12, 'pitch');
  // The centreline: the coil, then at each end a bend of radius d from the tangent t to the axis (angle acos(t·up)),
  // then a loop of radius ρ = the bend's end's distance from the axis, through 180°.
  let S = n * 2 * Math.PI * Math.hypot(R, dm.pitch / (2 * Math.PI)), inside = 0;
  for (const top of [true, false]) {
    const e = coilEnd(R, dm.pitch, n, a, top), up = [0, 0, top ? 1 : -1], alpha = Math.acos(dot(e.t, up)), nrm = unit(sub(up, scl(e.t, dot(up, e.t))));
    const p1 = add(add(e.at, scl(e.t, d * Math.sin(alpha))), scl(nrm, d * (1 - Math.cos(alpha)))), rho = Math.hypot(p1[0], p1[1]);
    S += d * alpha + rho * Math.PI;
    // The loop is centred on the axis at p1's height: its centreline reaches p1z ± ρ; the inner side a less.
    inside += (top ? 1 : -1) * (p1[2] + (top ? 1 : -1) * (rho - a));
  }
  near(dm.wireLength, S, 1e-12, 'wire length'); near(dm.lengthInsideHooks, inside, 1e-9, 'length inside the hooks');
  const V = vol(brep), want = Math.PI * a * a * S, dev = report.sweep.profileDeviation;
  assert.ok(Math.abs(V - want) <= 2 * Math.PI * a * S * dev + 1e-9 * want, `V ${V} vs πa²S ${want}`);
  const b = brepBounds(brep);
  near(b.max[2] - b.min[2], inside + 4 * a, 1e-9, 'height over the loops');
  // The rate by the wire's torsion energy; the initial tension taken off the load; Wahl's stress at the load.
  const F = 10, J = Math.PI * d ** 4 / 32, U = (F * R) ** 2 * Math.PI * 20 * n / (2 * G * J);
  near(dm.rate, F / (2 * U / F), 1e-12, 'rate'); near(dm.load.extension, (14 - 4) / dm.rate, 1e-12, 'extension');
  near(dm.load.shearStress, dm.wahlFactor * 8 * 14 * 20 / (Math.PI * 8), 1e-12, 'stress');
  assert.ok(dm.leastClearance >= d);
  const names = new Set(brep.faces.map(f => f.name.replace(/#\d+$/, '')));
  assert.deepEqual([...names].sort(), ['ex.end0', 'ex.end1', 'ex.hook0', 'ex.hook1', 'ex.wire']);
  assert.equal(new Set(brep.faces.map(f => f.name)).size, brep.faces.length, 'face names unique');
  const back = importStep(exportStep([brep], { name: 'extension' }));
  assert.equal(checkBrep(back).valid, true); near(vol(back), V, 1e-9, 'STEP round trip');
  t.diagnostic(`machine loops: ${brep.faces.length} faces, ${ms.toFixed(0)} ms; V ${V.toFixed(6)} vs ${want.toFixed(6)} (rel ${(Math.abs(V - want) / want).toExponential(2)}); inside the hooks ${dm.lengthInsideHooks.toFixed(4)}; least clearance ${dm.leastClearance.toFixed(4)}`);
});

test('R12c.1b extension, crossover hooks: a quarter bend toward the axis, a straight run to it and a 270° loop standing there — V by parts, the length inside the hooks', t => {
  const R = 10, a = 1, d = 2, n = 6, { brep, report } = hookedSpring({ type: 'extension', hooks: 'crossover', wireDiameter: d, meanDiameter: 20, activeCoils: n }, { id: 'cx' });
  assert.equal(checkBrep(brep).valid, true); assert.equal(report.hooks, 'crossover');
  const dm = report.dimensions;
  let S = n * 2 * Math.PI * Math.hypot(R, dm.pitch / (2 * Math.PI)), inside = 0;
  for (const top of [true, false]) {
    const e = coilEnd(R, dm.pitch, n, a, top), up = [0, 0, top ? 1 : -1], radial = [e.at[0], e.at[1], 0], inward = unit(sub(scl(radial, -1), scl(e.t, dot(scl(radial, -1), e.t))));
    // After the quarter bend the tangent is `inward` and the point p1 = p0 + d(t + inward); the run reaches the axis's
    // nearest point; the loop of radius R stands on it (centre ρ up), its top 2ρ above.
    const p1 = add(e.at, scl(add(e.t, inward), d)), run = -dot([p1[0], p1[1], 0], inward);
    S += d * Math.PI / 2 + run + R * 3 * Math.PI / 2;
    inside += (top ? 1 : -1) * (p1[2] + (top ? 1 : -1) * (2 * R - a));
  }
  near(dm.wireLength, S, 1e-12, 'wire length'); near(dm.lengthInsideHooks, inside, 1e-9, 'inside');
  const V = vol(brep), want = Math.PI * a * a * S;
  assert.ok(Math.abs(V - want) <= 2 * Math.PI * a * S * report.sweep.profileDeviation + 1e-9 * want, `V ${V} vs ${want}`);
  t.diagnostic(`crossover: ${brep.faces.length} faces; V rel ${(Math.abs(V - want) / want).toExponential(2)}; inside ${dm.lengthInsideHooks.toFixed(4)}`);
});

test('R12c.1b torsion: tangent legs at both ends — V = πa²(S + ℓ0 + ℓ1), the free angle between the legs, k = Ed⁴/(64Dn) by the bending energy, σ with K_b', t => {
  const R = 10, a = 1, d = 2, n = 5.25, E = 206000, M = 500;
  const { brep, report } = hookedSpring({ type: 'torsion', wireDiameter: d, meanDiameter: 20, activeCoils: n, legLengths: [15, 25], youngsModulus: E, moment: M }, { id: 'tq' });
  const chk = checkBrep(brep);
  assert.equal(chk.valid, true, chk.issues[0]); assert.equal(chk.topology[0].genus, 0);
  const dm = report.dimensions, S = n * 2 * Math.PI * Math.hypot(R, dm.pitch / (2 * Math.PI)) + 40;
  near(dm.wireLength, S, 1e-12, 'wire length');
  const V = vol(brep), want = Math.PI * a * a * S;
  assert.ok(Math.abs(V - want) <= 2 * Math.PI * a * S * report.sweep.profileDeviation + 1e-9 * want, `V ${V} vs ${want}`);
  near(dm.legAngle, 90, 1e-9, 'a quarter turn over whole coils');
  // A uniform moment along the coil's wire (length πDn): θ = M L/(E I), I = πd⁴/64, so k = M/θ.
  const I = Math.PI * d ** 4 / 64, theta = M * Math.PI * 20 * n / (E * I);
  near(dm.torsionalRateNmmPerRad, M / theta, 1e-12, 'torsional rate'); near(dm.moment.turn, theta * 180 / Math.PI, 1e-12, 'turn');
  const C = 10, Kb = (4 * C * C - C - 1) / (4 * C * (C - 1));
  near(dm.moment.bendingStress, Kb * 32 * M / (Math.PI * 8), 1e-12, 'bending stress');
  // The legs run along the coil's tangent: the end leg's tip is ℓ1 along it from the coil's end.
  const e = coilEnd(R, dm.pitch, n, a, true), tip = add(e.at, scl(e.t, 25));
  const b = brepBounds(brep);
  assert.ok(b.min[0] <= tip[0] + 1e-9 && b.min[0] >= tip[0] - a - 1e-6, `the leg reaches x ${tip[0]} (bounds ${b.min[0]})`);
  const names = new Set(brep.faces.map(f => f.name.replace(/#\d+$/, '')));
  assert.deepEqual([...names].sort(), ['tq.end0', 'tq.end1', 'tq.leg0', 'tq.leg1', 'tq.wire']);
  t.diagnostic(`torsion: ${brep.faces.length} faces; V rel ${(Math.abs(V - want) / want).toExponential(2)}; k ${dm.torsionalRate.toFixed(4)} N·mm/°`);
});

test('R12c.1b: the left hand mirrors the right; a loop or legs that come back onto the wire are LEG_OVERLAP; refusals', () => {
  const base = { type: 'extension', wireDiameter: 2, meanDiameter: 20, activeCoils: 4 };
  const right = hookedSpring(base), left = hookedSpring({ ...base, hand: 'left' });
  const key = p => p.map(x => x.toFixed(9)).join(','), mirrored = new Set(right.brep.vertices.map(v => key([v.point[0], -v.point[1], v.point[2]])));
  assert.ok(left.brep.vertices.every(v => mirrored.has(key(v.point))), 'left = mirror(right)');
  // A machine loop of 300° comes back down into the coil; a crossover loop of radius 1.2 ends 1.2 above its own run.
  assert.throws(() => hookedSpring({ ...base, loopAngle: 300 }), code('LEG_OVERLAP'));
  assert.throws(() => hookedSpring({ ...base, hooks: 'crossover', loopRadius: 1.2 }), code('LEG_OVERLAP'));
  assert.throws(() => hookedSpring({ ...base, bendRadius: 1 }), code('SELF_INTERSECTION'));
  assert.throws(() => hookedSpring({ ...base, pitch: 2 }), code('COILS_OVERLAP'));
  for (const bad of [{ ends: 'closed' }, { freeLength: 30 }, { legLengths: [5, 5] }, { hooks: 'side' }, { initialTension: -1 }, { type: 'torsion', hooks: 'crossover' }, { type: 'torsion', legLengths: [5] }, { meanDiameter: 2 }])
    assert.throws(() => hookedSpring({ ...base, ...bad }), code('INVALID_INPUT'), JSON.stringify(bad));
  assert.throws(() => hookedSpring({ ...base, body: 'conical' }), code('UNSUPPORTED_SPRING_KIND'));
  // An open pitch is allowed: the coil's turns then stand apart.
  assert.equal(checkBrep(hookedSpring({ ...base, type: 'torsion', pitch: 3 }).brep).valid, true);
});

test('R12c.1b part model: the `spring` kind with type extension or torsion, placed; its report; the codes mapped', () => {
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const snap = evaluateCadPart(D([{ id: 'e', kind: 'spring', type: 'extension', wire: 2, diameter: 20, activeCoils: 6, center: [40, 0], from: 5, shearModulus: 79300, shearModulusEstimate: true, initialTension: 4 },
    { id: 't', kind: 'spring', type: 'torsion', wire: 2, diameter: 20, activeCoils: 5.25, center: [-40, 0], legLengths: [15, 25], youngsModulus: 206000, youngsModulusEstimate: true, moment: 500 }]));
  const e = outputOf(snap, 'e'), t = outputOf(snap, 't');
  assert.equal(e.spring.type, 'extension'); assert.equal(e.spring.dimensions.shearModulusEstimate, true); assert.equal(e.spring.dimensions.initialTension, 4);
  assert.equal(t.spring.type, 'torsion'); assert.equal(t.spring.dimensions.youngsModulusEstimate, true);
  const eb = brepBounds(e.brep); assert.ok(eb.min[2] < 5 && eb.max[2] > 5 + e.spring.dimensions.bodyLength && Math.abs((eb.min[0] + eb.max[0]) / 2 - 40) < 2, 'its coil from z 5 about (40, 0), the hooks beyond');
  const refused = (f, c, tag) => assert.throws(() => evaluateCadPart(D([{ id: 's', kind: 'spring', wire: 2, diameter: 20, activeCoils: 6, ...f }])), err => (err.details?.category ?? err.code) === c && err.message.includes(`[${tag}]`), tag);
  refused({ type: 'extension', loopAngle: 300 }, 'GEOMETRY', 'LEG_OVERLAP');
  refused({ type: 'torsion', ends: 'open' }, 'INPUT', 'INVALID_INPUT');
});
