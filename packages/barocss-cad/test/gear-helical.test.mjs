import test from 'node:test';
import assert from 'node:assert/strict';
import { spurRack, checkPlacedSpurRack, spurGear, spurGearDimensions, spurGearPairNominal, spurGearCenterDistance, checkSpurGearPair, checkSpurGearRack, checkPlacedSpurGears, evaluateCadPart, evaluateSurface, GearError, checkBrep, brepMassProperties, exportStep, importStep } from '../dist/index.js';

// R6a.5c (issue #2167, D59): helical gears — normal module and pressure angle, helix angle and hand; the transverse
// involute turned along the helix.
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const inv = p => Math.tan(p) - p, D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const KHK1 = { normalModuleMM: 3, teeth: 12, faceWidthMM: 20, helixAngleDeg: 30, hand: 'right' }, KHK2 = { normalModuleMM: 3, teeth: 60, faceWidthMM: 20, helixAngleDeg: 30, hand: 'left' };

/** The transverse profile's exact area (Green's theorem over the analytic involute; transverse module, normal addendum). */
function transverseArea(mn, z, betaDeg, x = 0, red = 0) {
  const b = betaDeg * Math.PI / 180, an = Math.PI / 9, mt = mn / Math.cos(b), a = Math.atan(Math.tan(an) / Math.cos(b)), r = mt * z / 2, rb = r * Math.cos(a), ra = r + mn * (1 + x), rf = r - mn * (1.25 - x), r0 = Math.max(rb, rf);
  const psi = (mt * (Math.PI / 2 + 2 * x * Math.tan(an)) - red) / (2 * r) + inv(a), psiS = psi - inv(Math.acos(rb / r0)), psiT = psi - inv(Math.acos(rb / ra)), step = 2 * Math.PI / z;
  let A = 0;
  const seg = pts => { for (let i = 0; i + 1 < pts.length; i++) A += (pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]) / 2; };
  const flank = (turn, mirror, rev) => {
    const t0 = Math.sqrt(Math.max(0, (r0 / rb) ** 2 - 1)), t1 = Math.sqrt((ra / rb) ** 2 - 1), pts = [];
    for (let i = 0; i <= 20000; i++) { const t = t0 + (t1 - t0) * i / 20000, X = rb * (Math.cos(t) + t * Math.sin(t)), Y = (mirror ? -1 : 1) * rb * (Math.sin(t) - t * Math.cos(t)); pts.push([Math.cos(turn) * X - Math.sin(turn) * Y, Math.sin(turn) * X + Math.cos(turn) * Y]); }
    if (rev) pts.reverse(); seg(pts);
  };
  if (rf < rb) seg([[rf * Math.cos(-psi), rf * Math.sin(-psi)], [rb * Math.cos(-psi), rb * Math.sin(-psi)]]);
  flank(-psi, false, false); A += ra * ra * psiT; flank(psi, true, true);
  if (rf < rb) seg([[rb * Math.cos(psi), rb * Math.sin(psi)], [rf * Math.cos(psi), rf * Math.sin(psi)]]);
  A += rf * rf * (step - 2 * psiS) / 2;
  return A * z;
}
/** A solid's outline at height z from its own side faces (points within `reach` of `near`), as segments. */
function section(brep, z, near, reach) {
  const segs = [];
  for (const f of brep.faces) {
    const S = f.surface; if (!/flank|tip|root/.test(f.name ?? '')) continue;
    const zs = S.controlPoints.flat().map(p => p[2]), za = Math.min(...zs), zb = Math.max(...zs);
    if (z < za - 1e-12 || z > zb + 1e-12) continue;
    const v0 = S.knotsV[0], v1 = S.knotsV[S.knotsV.length - 1], v = v0 + (v1 - v0) * (z - za) / (zb - za), u0 = S.knotsU[0], u1 = S.knotsU[S.knotsU.length - 1];
    let prev = null;
    for (let i = 0; i <= 40; i++) {
      const p = evaluateSurface(S, u0 + (u1 - u0) * i / 40, v);
      if (prev && (Math.hypot(p[0] - near[0], p[1] - near[1]) < reach || Math.hypot(prev[0] - near[0], prev[1] - near[1]) < reach)) segs.push([prev[0], prev[1], p[0], p[1]]);
      prev = p;
    }
  }
  return segs;
}
const orient = (a, b, c, d, e, f) => (c - a) * (f - b) - (d - b) * (e - a);
const crossings = (A, B) => { let n = 0; for (const [ax, ay, bx, by] of A) for (const [cx, cy, dx, dy] of B) if (orient(cx, cy, dx, dy, ax, ay) * orient(cx, cy, dx, dy, bx, by) < 0 && orient(ax, ay, bx, by, cx, cy) * orient(ax, ay, bx, by, dx, dy) < 0) n++; return n; };

test('KHK\'s helical pair (m_n 3, α_n 20°, β 30°, z 12 right and 60 left): transverse module and pressure angle, d, db, da, df, a; εα by z(tan α_a − tan α_wt)/2π, εβ = b sin β/(π m_n), εγ their sum; the sweep touching at a', () => {
  const d1 = spurGearDimensions(KHK1), d2 = spurGearDimensions(KHK2);
  close(d1.mt, 3.4641, 1e-4, 'm_t'); close(d1.alpha * 180 / Math.PI, 22.79588, 1e-5, 'α_t');
  close(d1.referenceDiameterMM, 41.569, 1e-3, 'd1'); close(d2.referenceDiameterMM, 207.846, 1e-3, 'd2'); close(d1.baseDiameterMM, 38.322, 1e-3, 'db1');
  close(d1.tipDiameterMM, 47.569, 1e-3, 'da1'); close(d1.rootDiameterMM, 34.069, 1e-3, 'df1');
  close(spurGearCenterDistance(KHK1, KHK2), 124.7077, 1e-4, 'a');
  const n = spurGearPairNominal(KHK1, KHK2), aa1 = Math.acos(d1.rb / d1.ra), aa2 = Math.acos(d2.rb / d2.ra), at = d1.alpha;
  close(n.idealContactRatio, (12 * (Math.tan(aa1) - Math.tan(at)) + 60 * (Math.tan(aa2) - Math.tan(at))) / (2 * Math.PI), 1e-12, 'εα');
  close(n.axialContactRatio, 20 * 0.5 / (3 * Math.PI), 1e-12, 'εβ'); close(n.totalContactRatio, n.idealContactRatio + n.axialContactRatio, 1e-12, 'εγ');
  const c = checkSpurGearPair(KHK1, KHK2);
  assert.ok(Math.abs(c.sweep.minimumClearanceMM) < 1e-5 && !c.sweep.interference && c.sweep.converged, JSON.stringify(c.sweep));
  close(c.totalContactRatio, c.usableContactRatio + c.axialContactRatio, 1e-12, 'εγ check'); assert.match(c.axialThrust, /right-handed\) driving counter-clockwise seen from \+Z is pushed toward \+Z/);
  // A shifted helical pair: inv α_wt = inv α_t + 2 tan α_n (x1 + x2)/(z1 + z2), and the sweep touches there too.
  const s1 = { ...KHK1, teeth: 15, profileShiftCoefficient: 0.3 }, s2 = { ...KHK2, teeth: 30, profileShiftCoefficient: 0.2 }, cs = checkSpurGearPair(s1, s2);
  const awt = cs.workingPressureAngleDeg * Math.PI / 180;
  close(inv(awt), inv(at) + 2 * Math.tan(Math.PI / 9) * 0.5 / 45, 1e-12, 'inv α_wt'); close(cs.centerDistanceMM, 3.4641016151377544 * 45 / 2 * Math.cos(at) / Math.cos(awt), 1e-9, 'a_w');
  assert.ok(Math.abs(cs.sweep.minimumClearanceMM) < 1e-5 && !cs.sweep.interference);
});

test('the helical solid: valid; the flanks turned along the helix within the measured twist fit; its volume the transverse area × b within that fit; long faces split along the axis, seams exact; STEP and back', () => {
  for (const [spec, segments] of [[KHK1, 1], [{ normalModuleMM: 2, teeth: 25, faceWidthMM: 60, helixAngleDeg: 45, hand: 'left', boreDiameterMM: 10 }, 2], [{ normalModuleMM: 1, teeth: 40, faceWidthMM: 8, helixAngleDeg: 15, hand: 'right', profileShiftCoefficient: 0.2, toothThicknessReductionMM: 0.03 }, 1]]) {
    const { brep, report } = spurGear(spec, { id: 'h' });
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues[0]);
    const h = report.helix, d = spurGearDimensions(spec);
    assert.equal(h.axialSegments, segments); assert.ok(h.twistDeviationMM <= report.profileToleranceMM && h.piecesPerSegment <= 4);
    close(h.twistDegrees, (spec.hand === 'right' ? 1 : -1) * spec.faceWidthMM * Math.tan(spec.helixAngleDeg * Math.PI / 180) / d.r * 180 / Math.PI, 1e-9, 'twist');
    close(h.leadMM, 2 * Math.PI * d.r / Math.tan(spec.helixAngleDeg * Math.PI / 180), 1e-9, 'lead');
    // (Each section is the fitted transverse profile scaled by at most 1 ± ε, ε = twistDeviation / ra: the area by 2ε;
    // the flank fit as for spur gears.)
    const area = transverseArea(spec.normalModuleMM, spec.teeth, spec.helixAngleDeg, spec.profileShiftCoefficient ?? 0, spec.toothThicknessReductionMM ?? 0) - Math.PI * ((spec.boreDiameterMM ?? 0) / 2) ** 2;
    const eps = h.twistDeviationMM / (d.ra), want = area * spec.faceWidthMM, slack = want * (2 * eps + eps * eps) + 2 * spec.teeth * report.profileDeviationMM * 2.5 * d.mn * spec.faceWidthMM;
    close(brepMassProperties(brep, 1).volumeMM3, want, slack, `${spec.teeth} teeth β ${spec.helixAngleDeg} volume`);
    const names = brep.faces.map(f => f.name);
    assert.ok(names.includes('h.flankL#1') && names.includes(`h.tip#${spec.teeth}`) && names.includes('h.face1'));
    if (segments > 1) assert.ok(names.includes('h.flankL#1.2') && names.includes(`h.root#${spec.teeth}.2`), 'the second axial segment');
    // The top face's edges: the profile turned by the whole twist, exactly (the tip arc's ends at ra).
    const tops = brep.edges.filter(e => e.curve.controlPoints.every(p => Math.abs(p[2] - spec.faceWidthMM) < 1e-12));
    assert.ok(tops.length > 0 && tops.every(e => [e.curve.controlPoints[0], e.curve.controlPoints.at(-1)].every(p => Math.hypot(p[0], p[1]) <= d.ra + 1e-9)));
  }
  const { brep } = spurGear(KHK1, { id: 'h' }), back = importStep(exportStep([brep], { name: 'helical' }));
  close(brepMassProperties(back, 1).volumeMM3, brepMassProperties(brep, 1).volumeMM3, 1e-6 * brepMassProperties(brep, 1).volumeMM3, 'round trip');
});

test('helical refusals: a module with a helix angle (normalModuleMM named), no hand, β past 45°, undercut by the virtual tooth number, a twist past the axial budget; pairs of the same hand, of other angles, spur with helical; a helical gear with a straight rack', () => {
  const code = (f, c, re) => assert.throws(f, e => e instanceof GearError && e.code === c && (!re || re.test(e.message)));
  code(() => spurGearDimensions({ ...KHK1, moduleMM: 3 }), 'INVALID_INPUT', /takes normalModuleMM/);
  code(() => spurGearDimensions({ ...KHK1, hand: undefined }), 'INVALID_INPUT', /needs its hand/);
  code(() => spurGearDimensions({ ...KHK1, helixAngleDeg: 50 }), 'UNSUPPORTED_GEAR_KIND');
  code(() => spurGearDimensions({ moduleMM: 3, teeth: 20, faceWidthMM: 10, hand: 'right' }), 'INVALID_INPUT', /belong to a helical gear/);
  // (z_v = 10 / cos³15° = 11.1, under 17.1.)
  code(() => spurGearDimensions({ ...KHK1, teeth: 10, helixAngleDeg: 15 }), 'UNSUPPORTED_PROFILE_SHIFT', /virtual 11\.10 at β 15°.*x = 0\.351/);
  code(() => spurGear({ normalModuleMM: 2, teeth: 12, faceWidthMM: 10000, helixAngleDeg: 45, hand: 'right' }), 'PROFILE_BUDGET_EXCEEDED', /more than 64 axial segments/);
  code(() => checkSpurGearPair(KHK1, { ...KHK2, hand: 'right' }), 'MATE_INCOMPATIBLE', /same hand/);
  code(() => checkSpurGearPair(KHK1, { ...KHK2, helixAngleDeg: 25 }), 'MATE_INCOMPATIBLE', /helix angles differ/);
  code(() => checkSpurGearPair(KHK1, { moduleMM: 3, teeth: 60, faceWidthMM: 20 }), 'MATE_INCOMPATIBLE', /spur gear does not mesh with a helical one/);
  code(() => checkSpurGearRack(KHK1, { moduleMM: 3, teeth: 20, faceWidthMM: 20, heightMM: 10 }), 'MATE_INCOMPATIBLE', /straight rack does not mesh with a helical gear/);
});

test('a meshing helical gear in the part model: opposite hand at the transverse centre distance, turned to mesh — the solids\' own sections at five heights do not cross (independent of the sweep), and do at a phase off; the placed check agrees; the same hand refused', () => {
  const g1 = rot => ({ id: 'a', kind: 'spur-gear', normalModule: 2, helixAngle: 20, hand: 'right', teeth: 18, faceWidth: 6, thicknessReduction: 0.05, rotation: rot, center: [5, 3] });
  const g2 = (mesh, extra = {}) => ({ id: 'b', kind: 'spur-gear', normalModule: 2, helixAngle: 20, hand: 'left', teeth: 18, faceWidth: 6, thicknessReduction: 0.05, mesh: { gear: 'a', ...mesh }, ...extra });
  for (const [rot, dir, phase, crossed] of [[0, 0, 0, false], [7, 30, 0, false], [7, 30, 3, true]]) {
    const r = evaluateCadPart(D([g1(rot), g2({ direction: dir, phase })])), A = r.output('a'), B = r.output('b');
    close(Math.hypot(B.gearPlacement.center[0] - 5, B.gearPlacement.center[1] - 3), 18 * 2 / Math.cos(Math.PI / 9), 1e-9, 'a');
    const n = [0, 1.5, 3, 4.5, 6].map(z => crossings(section(A.brep, z, B.gearPlacement.center, 23), section(B.brep, z, A.gearPlacement.center, 23)));
    assert.equal(n.every(k => k > 0), crossed, `${rot} ${dir} ${phase}: ${n}`); if (!crossed) assert.ok(n.every(k => k === 0));
    assert.equal(checkPlacedSpurGears(A.gearPlacement, B.gearPlacement, { mode: 'verdict' }).sweep.interference, crossed);
  }
  assert.throws(() => evaluateCadPart(D([g1(0), g2({}, { hand: 'right' })])), e => (e.details?.category ?? e.code) === 'INPUT' && /MATE_INCOMPATIBLE.*same hand/.test(e.message));
  assert.throws(() => evaluateCadPart(D([g1(0), { ...g2({}), module: 2 }])), e => (e.details?.category ?? e.code) === 'INPUT' && /takes normalModule/.test(e.message));
});

test('the helical rack (D60): the z → ∞ gear of the pair — the gear\'s β, the opposite hand label, its teeth sliding tan β along it per mm up; planar faces, exact; meshing in the part model, the solids\' own sections at five heights clear, crossing slid 0.6 mm and for a same-hand rack; checks with εβ', () => {
  const k = { normalModuleMM: 2, helixAngleDeg: 20, hand: 'left', teeth: 10, faceWidthMM: 8, heightMM: 8 };
  const { brep, report } = spurRack(k, { id: 'k' });
  assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues[0]);
  assert.ok(brep.faces.every(f => f.surface.degreeU === 1 && f.surface.degreeV === 1), 'planar faces');
  close(report.helix.shear, Math.tan(Math.PI / 9), 1e-15, 'shear'); close(report.pitchMM, 2 * Math.PI / Math.cos(Math.PI / 9), 1e-12, 'transverse pitch');
  // (A sheared prism: the transverse area × b, the area the straight rack's with the transverse pitch and α_t.)
  const at = Math.atan(Math.tan(Math.PI / 9) / Math.cos(Math.PI / 9)), T = Math.tan(at), p = report.pitchMM, s = p / 2, tooth = ((s - 4 * T) + (s + 5 * T)) / 2 * 4.5;
  close(brepMassProperties(brep, 1).volumeMM3, (10 * p * (8 - 2.5) + 10 * tooth) * 8, 1e-9 * 10 * p * 8 * 8, 'volume');
  // With a gear: the same β of the opposite hand meshes; the rack's checks in the transverse plane, εβ = b sin β / (π m_n).
  const g = { normalModuleMM: 2, helixAngleDeg: 20, hand: 'right', teeth: 18, faceWidthMM: 8 };
  const c = checkSpurGearRack(g, { ...k, teeth: 20 });
  close(c.backlashMM, 0, 1e-12, 'j'); assert.ok(Math.abs(c.sweep.minimumClearanceMM) < 1e-6 && !c.sweep.interference);
  close(c.axialContactRatio, 8 * Math.sin(Math.PI / 9) / (2 * Math.PI), 1e-12, 'εβ'); close(c.totalContactRatio, c.usableContactRatio + c.axialContactRatio, 1e-12, 'εγ');
  assert.throws(() => checkSpurGearRack(g, { ...k, hand: 'right' }), e => e instanceof GearError && e.code === 'MATE_INCOMPATIBLE' && /same hand as the gear/.test(e.message));
  assert.throws(() => checkSpurGearRack({ moduleMM: 2, teeth: 18, faceWidthMM: 8 }, k), e => e instanceof GearError && e.code === 'MATE_INCOMPATIBLE');
  // In the part model: the hand derived, verified by the solids' sections.
  const gear = rot => ({ id: 'g', kind: 'spur-gear', normalModule: 2, helixAngle: 20, hand: 'right', teeth: 18, faceWidth: 8, thicknessReduction: 0.05, rotation: rot, center: [5, 3] });
  const rack = mesh => ({ id: 'k', kind: 'spur-rack', teeth: 12, faceWidth: 8, height: 8, thicknessReduction: 0.05, mesh: { gear: 'g', ...mesh } });
  const run = (feats, near = 25) => { const r = evaluateCadPart(D(feats)), G = r.output('g'), K = r.output('k'), cg = G.gearPlacement.center; return { K, G, n: [0, 2, 4, 6, 8].map(z => crossings(section(G.brep, z, cg, 30), section(K.brep, z, cg, near))) }; };
  for (const [rot, dir, phase, crossed] of [[0, -90, 0, false], [7, 30, 0, false], [7, -90, 0.6, true]]) {
    const { K, G, n } = run([gear(rot), rack({ direction: dir, phase })]);
    assert.equal(K.rackPlacement.spec.hand, 'left'); assert.equal(K.rack.helix.hand, 'left');
    assert.ok(crossed ? n.every(x => x > 0) : n.every(x => x === 0), `${rot} ${dir} ${phase}: ${n}`);
    assert.equal(checkPlacedSpurRack(G.gearPlacement, K.rackPlacement, { mode: 'verdict' }).sweep.interference, crossed);
  }
  // The same placement with a right-hand rack: it crosses above the face it starts on.
  const meshed = run([gear(0), rack({})]).K.rackPlacement;
  const same = run([gear(0), { id: 'k', kind: 'spur-rack', normalModule: 2, helixAngle: 20, hand: 'right', teeth: 12, faceWidth: 8, height: 8, thicknessReduction: 0.05, origin: meshed.origin, angle: meshed.angle * 180 / Math.PI }]);
  assert.ok(same.n.slice(1).every(x => x > 0), String(same.n));
  assert.throws(() => evaluateCadPart(D([gear(0), rack({}), { ...rack({}), id: 'k2', helixAngle: 20, hand: 'right' }])), e => (e.details?.category ?? e.code) === 'INPUT' && /must be 20° left-hand/.test(e.message));
});
