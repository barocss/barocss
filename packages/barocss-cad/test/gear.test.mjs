import test from 'node:test';
import assert from 'node:assert/strict';
import { spurGear, spurGearProfile, spurGearDimensions, spurGearPairNominal, checkSpurGearPair, GearError, checkBrep, brepMassProperties, exportStep, importStep } from '../dist/index.js';

// R6a.1–2 (issue #2167, D53): the involute spur gear's first stage — 20°, no profile shift, external, straight teeth.
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
/**
 * The exact profile's area, apart from the generator: Green's theorem over the analytic involute X(t) = rb(cos t +
 * t sin t), Y(t) = rb(sin t − t cos t) sampled densely, the tip and root arcs and radial joins exactly.
 */
function exactArea(m, z, red = 0) {
  const a = 20 * Math.PI / 180, inv = p => Math.tan(p) - p, r = m * z / 2, rb = r * Math.cos(a), ra = r + m, rf = r - 1.25 * m, r0 = Math.max(rb, rf);
  const psi = (Math.PI * m / 2 - red) / (2 * r) + inv(a), psiS = psi - inv(Math.acos(rb / r0)), psiT = psi - inv(Math.acos(rb / ra)), step = 2 * Math.PI / z;
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
  for (const [m, z, b, bore, red] of [[2, 20, 10, 0, 0], [2, 40, 10, 12, 0.05], [1, 60, 5, 0, 0], [3, 18, 8, 10, 0]]) {
    const { brep, report } = spurGear({ moduleMM: m, teeth: z, faceWidthMM: b, boreDiameterMM: bore, toothThicknessReductionMM: red }, { id: 'g' });
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues[0]);
    assert.ok(report.profileDeviationMM <= report.profileToleranceMM && report.profileToleranceMM === 1e-4 * m);
    // (Each flank's area moves by at most its deviation times its length; 2z flanks, each shorter than ra − rf + its arc.)
    const want = exactArea(m, z, red) * b - Math.PI * (bore / 2) ** 2 * b, flankLength = 2.5 * m, slack = 2 * z * report.profileDeviationMM * flankLength * b;
    close(brepMassProperties(brep, 1).volumeMM3, want, slack, `m${m} z${z} volume`);
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

test('refusals with their codes: bad input, a pressure angle other than 20°, a profile shift, an undercut tooth count (the shift that would avoid it), a bore into the rim', () => {
  const g = { moduleMM: 2, teeth: 20, faceWidthMM: 10 }, code = (spec, c, re) => assert.throws(() => spurGear(spec), e => e instanceof GearError && e.code === c && (!re || re.test(e.message)));
  code({ ...g, moduleMM: 0 }, 'INVALID_INPUT'); code({ ...g, moduleMM: NaN }, 'INVALID_INPUT'); code({ ...g, teeth: 20.5 }, 'INVALID_INPUT'); code({ ...g, faceWidthMM: -1 }, 'INVALID_INPUT');
  code({ ...g, profileToleranceMM: 0 }, 'INVALID_INPUT'); code({ ...g, toothThicknessReductionMM: 4 }, 'INVALID_INPUT', /leaves no tooth/);
  code({ ...g, pressureAngleDeg: 14.5 }, 'UNSUPPORTED_GEAR_KIND');
  code({ ...g, profileShiftCoefficient: 0.2 }, 'UNSUPPORTED_PROFILE_SHIFT');
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
