import test from 'node:test';
import assert from 'node:assert/strict';
import { spurGear, spurGearProfile, spurGearDimensions, spurGearPairNominal, spurGearCenterDistance, checkSpurGearPair, checkPlacedSpurGears, evaluateCadPart, GearError, checkBrep, brepMassProperties, exportStep, importStep } from '../dist/index.js';

// R6a.1–2 (issue #2167, D53): the involute spur gear's first stage — 20°, no profile shift, external, straight teeth.
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
/**
 * The exact profile's area, apart from the generator: Green's theorem over the analytic involute X(t) = rb(cos t +
 * t sin t), Y(t) = rb(sin t − t cos t) sampled densely, the tip and root arcs and radial joins exactly.
 */
function exactArea(m, z, red = 0, x = 0) {
  const a = 20 * Math.PI / 180, inv = p => Math.tan(p) - p, r = m * z / 2, rb = r * Math.cos(a), ra = r + m * (1 + x), rf = r - m * (1.25 - x), r0 = Math.max(rb, rf);
  const psi = (m * (Math.PI / 2 + 2 * x * Math.tan(a)) - red) / (2 * r) + inv(a), psiS = psi - inv(Math.acos(rb / r0)), psiT = psi - inv(Math.acos(rb / ra)), step = 2 * Math.PI / z;
  let A = 0;
  const seg = pts => { for (let i = 0; i + 1 < pts.length; i++) A += (pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]) / 2; };
  const flank = (turn, mirror, rev) => {
    const t0 = Math.sqrt(Math.max(0, (r0 / rb) ** 2 - 1)), t1 = Math.sqrt((ra / rb) ** 2 - 1), pts = [];
    for (let i = 0; i <= 20000; i++) { const t = t0 + (t1 - t0) * i / 20000, x = rb * (Math.cos(t) + t * Math.sin(t)), y = (mirror ? -1 : 1) * rb * (Math.sin(t) - t * Math.cos(t)); pts.push([Math.cos(turn) * x - Math.sin(turn) * y, Math.sin(turn) * x + Math.cos(turn) * y]); }
    if (rev) pts.reverse(); seg(pts);
  };
  if (rf < rb) seg([[rf * Math.cos(-psi), rf * Math.sin(-psi)], [rb * Math.cos(-psi), rb * Math.sin(-psi)]]);
  flank(-psi, false, false); A += ra * ra * psiT; flank(psi, true, true);
  if (rf < rb) seg([[rb * Math.cos(psi), rb * Math.sin(psi)], [rf * Math.cos(psi), rf * Math.sin(psi)]]);
  A += rf * rf * (step - 2 * psiS) / 2;
  return A * z;
}

test('the issue\'s fixture (m 2, α 20°, x 0, z 20 and 40): d, db, da, df; the pair\'s centre distance, ratio and ideal contact ratio', () => {
  const g1 = { moduleMM: 2, teeth: 20, faceWidthMM: 10 }, g2 = { moduleMM: 2, teeth: 40, faceWidthMM: 10 };
  const d = spurGearDimensions(g1);
  close(d.referenceDiameterMM, 40, 1e-12, 'd'); close(d.baseDiameterMM, 37.5877048314, 1e-9, 'db'); close(d.tipDiameterMM, 44, 1e-12, 'da'); close(d.rootDiameterMM, 35, 1e-12, 'df');
  close(d.circularPitchMM, 2 * Math.PI, 1e-12, 'p'); close(d.toothThicknessMM, Math.PI, 1e-12, 's');
  const pair = spurGearPairNominal(g1, g2);
  close(pair.centerDistanceMM, 60, 1e-12, 'a'); assert.equal(pair.speedRatio, -0.5); close(pair.idealContactRatio, 1.6351859636, 1e-9, 'εα');
  assert.equal(spurGearPairNominal({ ...g1, toothThicknessReductionMM: 0.05 }, { ...g2, toothThicknessReductionMM: 0.07 }).backlashMM.toFixed(12), '0.120000000000');
  assert.throws(() => spurGearPairNominal(g1, { ...g2, moduleMM: 2.5 }), e => e instanceof GearError && e.code === 'MATE_INCOMPATIBLE');
});

test('the solid: valid; its volume the exact profile\'s area × the face width to within what the measured flank deviation allows; the bore taken out; tooth by tooth names', () => {
  // (With profile shifts too, R6a.5: the KHK pair's 12 teeth at x 0.6 and 24 at 0.36, a negative shift on 30.)
  for (const [m, z, b, bore, red, x = 0] of [[2, 20, 10, 0, 0], [2, 40, 10, 12, 0.05], [1, 60, 5, 0, 0], [3, 18, 8, 10, 0], [3, 12, 10, 0, 0, 0.6], [3, 24, 10, 10, 0.05, 0.36], [2, 30, 6, 0, 0, -0.3]]) {
    const { brep, report } = spurGear({ moduleMM: m, teeth: z, faceWidthMM: b, boreDiameterMM: bore, toothThicknessReductionMM: red, profileShiftCoefficient: x }, { id: 'g' });
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues[0]);
    assert.ok(report.profileDeviationMM <= report.profileToleranceMM && report.profileToleranceMM === 1e-4 * m);
    // (Each flank's area moves by at most its deviation times its length; 2z flanks, each shorter than ra − rf + its arc.)
    const want = exactArea(m, z, red, x) * b - Math.PI * (bore / 2) ** 2 * b, flankLength = 2.5 * m, slack = 2 * z * report.profileDeviationMM * flankLength * b;
    close(brepMassProperties(brep, 1).volumeMM3, want, slack, `m${m} z${z} x${x} volume`);
    const names = brep.faces.map(f => f.name);
    for (const k of [1, z]) for (const role of ['flankL', 'flankR', 'tip', 'root']) assert.ok(names.includes(`g.${role}#${k}`), `g.${role}#${k}`);
    assert.ok(names.includes('g.face0') && names.includes('g.face1'));
    assert.equal(names.filter(n => n.startsWith('g.bore')).length, bore ? 2 : 0);
    assert.equal(names.filter(n => n.startsWith('g.tip#')).length, z);
  }
});

test('the profile: as few cubic pieces as the tolerance asks, the deviation measured; past five pieces refused (PROFILE_BUDGET_EXCEEDED), never a looser tolerance', () => {
  const loose = spurGearProfile({ moduleMM: 2, teeth: 20, faceWidthMM: 10, profileToleranceMM: 1e-2 }).report;
  const tight = spurGearProfile({ moduleMM: 2, teeth: 20, faceWidthMM: 10, profileToleranceMM: 1e-5 }).report;
  assert.ok(loose.flankPieces < tight.flankPieces && tight.profileDeviationMM <= 1e-5 && loose.profileDeviationMM <= 1e-2);
  assert.throws(() => spurGearProfile({ moduleMM: 2, teeth: 20, faceWidthMM: 10, profileToleranceMM: 1e-9 }), e => e instanceof GearError && e.code === 'PROFILE_BUDGET_EXCEEDED' && /more than 5 cubic pieces/.test(e.message));
  // The root is schematic, and said so.
  const r = spurGearProfile({ moduleMM: 2, teeth: 20, faceWidthMM: 10 }).report;
  assert.equal(r.manufacturingValidated, false); assert.equal(r.rootPolicy, 'schematic-radial');
  assert.deepEqual(r.diagnostics.map(d => [d.code, d.severity]), [['ROOT_TRANSITION_UNVALIDATED', 'warning']]);
});

test('refusals with their codes: bad input, a pressure angle other than 20°, a profile shift out of range, an undercut tooth count (the shift that would avoid it), a bore into the rim', () => {
  const g = { moduleMM: 2, teeth: 20, faceWidthMM: 10 }, code = (spec, c, re) => assert.throws(() => spurGear(spec), e => e instanceof GearError && e.code === c && (!re || re.test(e.message)));
  code({ ...g, moduleMM: 0 }, 'INVALID_INPUT'); code({ ...g, moduleMM: NaN }, 'INVALID_INPUT'); code({ ...g, teeth: 20.5 }, 'INVALID_INPUT'); code({ ...g, faceWidthMM: -1 }, 'INVALID_INPUT');
  code({ ...g, profileToleranceMM: 0 }, 'INVALID_INPUT'); code({ ...g, toothThicknessReductionMM: 4 }, 'INVALID_INPUT', /leaves no tooth/);
  code({ ...g, pressureAngleDeg: 14.5 }, 'UNSUPPORTED_GEAR_KIND');
  code({ ...g, profileShiftCoefficient: 1.2 }, 'UNSUPPORTED_PROFILE_SHIFT', /from -0\.5 to 1/); code({ ...g, profileShiftCoefficient: -0.6 }, 'UNSUPPORTED_PROFILE_SHIFT');
  code({ ...g, teeth: 12, profileShiftCoefficient: 0.2 }, 'UNSUPPORTED_PROFILE_SHIFT', /with x = 0\.2 are undercut \(below 13\.7\): a shift of at least x = 0\.298/);
  // (A large shift on few teeth points the tooth.)
  code({ ...g, teeth: 10, profileShiftCoefficient: 1 }, 'SELF_INTERSECTION', /point below its tip circle/);
  code({ ...g, teeth: 12 }, 'UNSUPPORTED_PROFILE_SHIFT', /undercut \(below 17\.1\): a shift of at least x = 0\.298/);
  code({ ...g, boreDiameterMM: 34 }, 'BORE_INTERSECTION', /at most Ø31\.000/);
  code({ ...g, rootPolicy: 'tool-generated' }, 'INVALID_INPUT');
});

test('STEP out and back: the same volume, the faces\' names', () => {
  const { brep } = spurGear({ moduleMM: 2, teeth: 20, faceWidthMM: 10, boreDiameterMM: 8 }, { id: 'g' });
  const back = importStep(exportStep([brep], { name: 'gear' }));
  close(brepMassProperties(back, 1).volumeMM3, brepMassProperties(brep, 1).volumeMM3, 1e-6 * brepMassProperties(brep, 1).volumeMM3, 'round trip');
  assert.ok(back.faces.some(f => f.name === 'g.flankL#1'));
});

test('pair checks (R6a.4): at nominal centre distance the teeth just touch over the whole period; with backlash the sweep\'s least clearance is half the normal backlash j·cos αw / 2 (an independent formula); off the nominal centre distance the working pressure angle; interference found and measured', () => {
  const g1 = { moduleMM: 2, teeth: 20, faceWidthMM: 10 }, g2 = { moduleMM: 2, teeth: 40, faceWidthMM: 10 }, d = 20 * Math.PI / 180;
  const nominal = checkSpurGearPair(g1, g2);
  close(nominal.centerDistanceMM, 60, 1e-12, 'a'); close(nominal.workingPressureAngleDeg, 20, 1e-12, 'αw'); close(nominal.backlashMM, 0, 1e-12, 'j');
  assert.deepEqual(nominal.tipClearancesMM.map(x => +x.toFixed(12)), [0.5, 0.5]);
  close(nominal.idealContactRatio, 1.6351859636, 1e-9, 'εα'); close(nominal.usableContactRatio, nominal.idealContactRatio, 1e-12, 'usable');
  assert.ok(!nominal.sweep.interference && nominal.sweep.converged && Math.abs(nominal.sweep.minimumClearanceMM) < 1e-5, JSON.stringify(nominal.sweep));
  // Backlash 0.05 + 0.05 at the reference circle: each side clear by 0.1 cos 20° / 2.
  const loose = checkSpurGearPair({ ...g1, toothThicknessReductionMM: 0.05 }, { ...g2, toothThicknessReductionMM: 0.05 });
  close(loose.backlashMM, 0.1, 1e-12, 'j'); close(loose.sweep.minimumClearanceMM, 0.1 * Math.cos(d) / 2, 1e-5, 'clearance');
  // 0.5 mm farther apart: αw = acos(60 cos 20° / 60.5); the backlash and its clearance follow.
  const far = checkSpurGearPair(g1, g2, { centerDistanceMM: 60.5 }), aw = Math.acos(60 * Math.cos(d) / 60.5);
  close(far.workingPressureAngleDeg, aw * 180 / Math.PI, 1e-12, 'αw'); close(far.sweep.minimumClearanceMM, far.backlashMM * Math.cos(aw) / 2, 1e-5, 'far clearance');
  assert.ok(far.usableContactRatio < nominal.usableContactRatio);
  // 0.2 mm nearer: the backlash negative, the teeth crossing by half its normal share; a phase error likewise found.
  const near = checkSpurGearPair(g1, g2, { centerDistanceMM: 59.8 }), awn = Math.acos(60 * Math.cos(d) / 59.8);
  assert.ok(near.backlashMM < 0 && near.sweep.interference && near.diagnostics.some(x => x.code === 'SELF_INTERSECTION'));
  close(near.sweep.minimumClearanceMM, near.backlashMM * Math.cos(awn) / 2, 1e-4, 'penetration');
  assert.ok(checkSpurGearPair({ ...g1, toothThicknessReductionMM: 0.05 }, { ...g2, toothThicknessReductionMM: 0.05 }, { relativePhaseDeg: 1 }).sweep.interference);
  assert.throws(() => checkSpurGearPair(g1, { ...g2, moduleMM: 3 }), e => e instanceof GearError && e.code === 'MATE_INCOMPATIBLE');
});

test('pair check verdict mode (pass or fail, stopping at the first crossing) agrees with the report; repeated checks come from the cache', () => {
  const g1 = { moduleMM: 2, teeth: 20, faceWidthMM: 10 }, g2 = { moduleMM: 2, teeth: 40, faceWidthMM: 10 };
  for (const o of [{}, { centerDistanceMM: 59.8 }, { centerDistanceMM: 60.5 }]) {
    const report = checkSpurGearPair(g1, g2, o), verdict = checkSpurGearPair(g1, g2, { ...o, mode: 'verdict' });
    assert.equal(verdict.sweep.interference, report.sweep.interference, JSON.stringify(o));
    assert.equal(verdict.backlashMM, report.backlashMM);
  }
  const first = checkSpurGearPair(g1, g2, { centerDistanceMM: 59.9, mode: 'verdict' });
  assert.equal(checkSpurGearPair(g1, g2, { centerDistanceMM: 59.9, mode: 'verdict' }), first, 'the same object: cached');
});

test('a meshing gear (R6a.4b, D56): placed beside its driver and turned to mesh — the solids do not meet (an exact Boolean, apart from the pair check), the placed pair check at phase 0 and clear; the driver turned, the follower turns by −z1/z2; refusals', () => {
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const g1 = (rotation, extra = {}) => ({ id: 'g1', kind: 'spur-gear', module: 2, teeth: 18, faceWidth: 4, thicknessReduction: 0.05, rotation, center: [5, 3], ...extra });
  const g2 = (mesh, extra = {}) => ({ id: 'g2', kind: 'spur-gear', module: 2, teeth: 18, faceWidth: 4, thicknessReduction: 0.05, mesh: { gear: 'g1', ...mesh }, ...extra });
  // Turned and off the X axis: the Boolean intersection of the two solids is empty.
  assert.throws(() => evaluateCadPart(D([g1(7), g2({ direction: 30 }), { id: 'i', kind: 'intersect', target: 'g1', tool: 'g2' }])).output('i'), e => e.code === 'REFERENCE' && /no output i/.test(e.message));
  // The driver stays an output; the follower stands at the nominal centre distance along 30°.
  for (const turn of [0, 7, 13.25]) {
    const r = evaluateCadPart(D([g1(turn), g2({ direction: 30 })])), p1 = r.output('g1').gearPlacement, p2 = r.output('g2').gearPlacement;
    close(Math.hypot(p2.center[0] - 5, p2.center[1] - 3), 36, 1e-12, 'centre distance'); close(Math.atan2(p2.center[1] - 3, p2.center[0] - 5), Math.PI / 6, 1e-12, 'direction');
    const c = checkPlacedSpurGears(p1, p2, { mode: 'verdict' });
    assert.equal(c.relativePhaseDeg, 0); assert.equal(c.sweep.interference, false); assert.equal(c.faceOverlapMM, 4);
    // The follower's turn: −z1/z2 of the driver's (here −1), about the line of centres.
    const r0 = evaluateCadPart(D([g1(0), g2({ direction: 30 })])).output('g2').gearPlacement.rotation;
    close(p2.rotation - r0, -turn * Math.PI / 180, 1e-12, 'ratio');
  }
  // A phase of half a pitch: the teeth cross.
  const r = evaluateCadPart(D([g1(7), g2({ direction: 30, phase: 10 })]));
  const c = checkPlacedSpurGears(r.output('g1').gearPlacement, r.output('g2').gearPlacement);
  close(c.relativePhaseDeg, 10, 1e-9, 'phase'); assert.equal(c.sweep.interference, true);
  // Another module, a gear that is not one, faces apart along the axis.
  assert.throws(() => evaluateCadPart(D([g1(0), g2({}, { module: 3 })])), e => e.code === 'INPUT' && /MATE_INCOMPATIBLE/.test(e.message));
  assert.throws(() => evaluateCadPart(D([g1(0), { id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 3 }, { id: 'c', kind: 'extrude', sketch: 's', height: 3 }, { ...g2({}), mesh: { gear: 'c' } }])), e => e.code === 'REFERENCE' && /not a spur gear/.test(e.message));
  const apart = { ...r.output('g2').gearPlacement, from: 10 };
  assert.throws(() => checkPlacedSpurGears(r.output('g1').gearPlacement, apart), e => e instanceof GearError && e.code === 'MATE_INCOMPATIBLE');
});

test('profile shift (R6a.5a, D57): KHK\'s shifted pair (m 3, z 12 and 24, x 0.6 and 0.36) — α_w 26.0886°, a 56.4999 mm, df 32.1; at that distance no backlash, and the exact profiles swept touch without crossing (the formula and the geometry agree); a meshing gear stands there', () => {
  const g1 = { moduleMM: 3, teeth: 12, faceWidthMM: 10, profileShiftCoefficient: 0.6 }, g2 = { moduleMM: 3, teeth: 24, faceWidthMM: 10, profileShiftCoefficient: 0.36 };
  // (KHK's worked example: inv α_w = 0.034316, α_w = 26.0886°, centre distance 56.4999 mm; root diameters 32.1 and 66.66.)
  close(spurGearCenterDistance(g1, g2), 56.4999, 1e-4, 'a'); close(spurGearDimensions(g1).rootDiameterMM, 32.1, 1e-12, 'df1'); close(spurGearDimensions(g2).rootDiameterMM, 66.66, 1e-12, 'df2');
  close(spurGearDimensions(g1).toothThicknessMM, 3 * (Math.PI / 2 + 1.2 * Math.tan(Math.PI / 9)), 1e-12, 's1');
  const c = checkSpurGearPair(g1, g2);
  close(c.workingPressureAngleDeg, 26.0886, 1e-4, 'α_w'); close(c.backlashMM, 0, 1e-12, 'backlash'); close(c.nominalCenterDistanceMM, c.centerDistanceMM, 0, 'default distance');
  assert.ok(Math.abs(c.sweep.minimumClearanceMM) < 1e-5 && !c.sweep.interference && c.sweep.converged, JSON.stringify(c.sweep));
  // (No tip shortening: the tip clearances reported, 0.37 mm here, under the unshifted 0.25 m.)
  close(c.tipClearancesMM[0], 56.4999 - 22.8 - 33.33, 1e-4, 'tip clearance');
  // At the reference distance m(z1 + z2)/2 the shifted teeth jam.
  assert.equal(checkSpurGearPair(g1, g2, { centerDistanceMM: 54, mode: 'verdict' }).sweep.interference, true);
  // Through the part model: the meshing gear's default distance is the working one.
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const r = evaluateCadPart(D([{ id: 'a', kind: 'spur-gear', module: 3, teeth: 12, faceWidth: 10, profileShift: 0.6 }, { id: 'b', kind: 'spur-gear', module: 3, teeth: 24, faceWidth: 10, profileShift: 0.36, mesh: { gear: 'a' } }]));
  close(r.output('b').gearPlacement.center[0], 56.4999, 1e-4, 'placed');
  assert.equal(checkPlacedSpurGears(r.output('a').gearPlacement, r.output('b').gearPlacement, { mode: 'verdict' }).sweep.interference, false);
});

test('PERF3 C16 pair check: the sweep kept whatever the face widths (it does not read them); each width\'s own axial and total contact ratios; a width out of range still refused when the pair is kept', () => {
  const h1 = { normalModuleMM: 2, teeth: 18, faceWidthMM: 12, helixAngleDeg: 15, hand: 'right' }, h2 = { normalModuleMM: 2, teeth: 36, faceWidthMM: 12, helixAngleDeg: 15, hand: 'left' };
  const a = checkSpurGearPair(h1, h2, { mode: 'verdict' }), t0 = performance.now(), b = checkSpurGearPair({ ...h1, faceWidthMM: 30 }, { ...h2, faceWidthMM: 25 }, { mode: 'verdict' }), kept = performance.now() - t0;
  assert.deepEqual(b.sweep, a.sweep); assert.equal(b.usableContactRatio, a.usableContactRatio);
  const nominal = spurGearPairNominal({ ...h1, faceWidthMM: 30 }, { ...h2, faceWidthMM: 25 });
  assert.equal(b.axialContactRatio, nominal.axialContactRatio); assert.equal(b.totalContactRatio, b.usableContactRatio + nominal.axialContactRatio);
  assert.ok(Math.abs(b.axialContactRatio / a.axialContactRatio - 25 / 12) < 1e-12);
  assert.ok(kept < 5, `${kept} ms: the sweep was not kept`);
  assert.throws(() => checkSpurGearPair({ ...h1, faceWidthMM: -1 }, h2, { mode: 'verdict' }), /faceWidthMM/);
});
