import test from 'node:test';
import assert from 'node:assert/strict';
import { spurRack, spurRackDimensions, checkSpurGearRack, checkPlacedSpurRack, evaluateCadPart, GearError, checkBrep, brepMassProperties, exportStep, importStep } from '../dist/index.js';

// R6a.5b (issue #2167, D58): the rack and its checks with a spur gear.
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const T = Math.tan(Math.PI / 9), C = Math.cos(Math.PI / 9), S = Math.sin(Math.PI / 9);
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });

test('the rack: valid; its volume the basic rack\'s exact area × the face width (trapezoid teeth on a bar); tooth by tooth names; STEP and back', () => {
  for (const [m, n, b, H, red] of [[2, 10, 10, 10, 0], [1.5, 31, 6, 5, 0.04], [3, 1, 8, 7, 0]]) {
    const { brep, report } = spurRack({ moduleMM: m, teeth: n, faceWidthMM: b, heightMM: H, toothThicknessReductionMM: red }, { id: 'k' });
    assert.equal(checkBrep(brep).valid, true, checkBrep(brep).issues[0]);
    const p = Math.PI * m, s = p / 2 - red, ha = m, hf = 1.25 * m, tooth = ((s - 2 * ha * T) + (s + 2 * hf * T)) / 2 * (ha + hf);
    close(brepMassProperties(brep, 1).volumeMM3, (n * p * (H - hf) + n * tooth) * b, 1e-9 * n * p * H * b, `m${m} n${n} volume`);
    close(report.lengthMM, n * p, 1e-12, 'length'); close(report.tipWidthMM, s - 2 * m * T, 1e-12, 'tip');
    const names = brep.faces.map(f => f.name);
    for (const role of ['flankL', 'flankR', 'tip']) assert.equal(names.filter(x => x.startsWith(`k.${role}#`)).length, n, role);
    assert.equal(names.filter(x => x.startsWith('k.root#')).length, n + 1);
    for (const x of ['k.back', 'k.end0', 'k.end1', 'k.face0', 'k.face1']) assert.ok(names.includes(x), x);
  }
  const { brep } = spurRack({ moduleMM: 2, teeth: 10, faceWidthMM: 10, heightMM: 10 }, { id: 'k' });
  const back = importStep(exportStep([brep], { name: 'rack' }));
  close(brepMassProperties(back, 1).volumeMM3, brepMassProperties(brep, 1).volumeMM3, 1e-9 * brepMassProperties(brep, 1).volumeMM3, 'round trip');
});

test('gear and rack checks: at r + x m no backlash, the teeth touching over the period; with reductions the least clearance j cos α / 2; moved away the backlash 2 d tan α; the contact ratio by the formula; a shifted pinion; refusals', () => {
  const g = { moduleMM: 2, teeth: 20, faceWidthMM: 10 }, k = { moduleMM: 2, teeth: 30, faceWidthMM: 10, heightMM: 10 };
  const c0 = checkSpurGearRack(g, k);
  close(c0.centerDistanceMM, 20, 1e-12, 'D'); close(c0.backlashMM, 0, 1e-12, 'j'); close(c0.tipClearancesMM[0], 0.5, 1e-12, 'tip'); close(c0.tipClearancesMM[1], 0.5, 1e-12, 'rack tip');
  assert.ok(Math.abs(c0.sweep.minimumClearanceMM) < 1e-6 && !c0.sweep.interference && c0.sweep.converged, JSON.stringify(c0.sweep));
  // εα = [√(ra² − rb²) − r sin α + m / sin α] / (π m cos α), 1.76882 for 20 teeth.
  const rb = 20 * C, eps = (Math.sqrt(22 ** 2 - rb ** 2) - 20 * S + 2 / S) / (2 * Math.PI * C);
  close(c0.idealContactRatio, eps, 1e-12, 'εα'); close(c0.usableContactRatio, eps, 1e-12, 'usable');
  const c1 = checkSpurGearRack({ ...g, toothThicknessReductionMM: 0.05 }, { ...k, toothThicknessReductionMM: 0.05 });
  close(c1.backlashMM, 0.1, 1e-12, 'j'); close(c1.sweep.minimumClearanceMM, 0.1 * C / 2, 1e-5, 'clearance');
  const far = checkSpurGearRack(g, k, { centerDistanceMM: 20.3 });
  close(far.backlashMM, 2 * 0.3 * T, 1e-12, 'j far'); close(far.sweep.minimumClearanceMM, far.backlashMM * C / 2, 1e-5, 'clearance far');
  close(far.tipClearancesMM[0], 0.8, 1e-12, 'tip far'); assert.ok(far.usableContactRatio < c0.usableContactRatio);
  const near = checkSpurGearRack(g, k, { centerDistanceMM: 19.8 });
  assert.ok(near.sweep.interference); close(near.sweep.minimumClearanceMM, near.backlashMM * C / 2, 1e-4, 'depth');
  assert.equal(checkSpurGearRack({ ...g, toothThicknessReductionMM: 0.05 }, { ...k, toothThicknessReductionMM: 0.05 }, { rackPhaseMM: 0.5, mode: 'verdict' }).sweep.interference, true);
  assert.equal(checkSpurGearRack(g, k, { mode: 'verdict' }).sweep.interference, false, 'touching is not crossing');
  // A shifted pinion (12 teeth, x 0.6) stands at r + x m with no backlash; the rack's part of the contact shortened by x m.
  const sh = checkSpurGearRack({ moduleMM: 3, teeth: 12, faceWidthMM: 10, profileShiftCoefficient: 0.6 }, { moduleMM: 3, teeth: 30, faceWidthMM: 10, heightMM: 10 });
  close(sh.centerDistanceMM, 19.8, 1e-12, 'D shifted'); close(sh.backlashMM, 0, 1e-12, 'j shifted'); assert.ok(!sh.sweep.interference && Math.abs(sh.sweep.minimumClearanceMM) < 1e-6);
  const rb3 = 18 * C;
  close(sh.idealContactRatio, (Math.sqrt(22.8 ** 2 - rb3 ** 2) - 18 * S + (3 - 1.8) / S) / (3 * Math.PI * C), 1e-12, 'εα shifted');
  // Refusals.
  const code = (f, c, re) => assert.throws(f, e => e instanceof GearError && e.code === c && (!re || re.test(e.message)));
  code(() => spurRackDimensions({ ...k, heightMM: 4 }), 'INVALID_INPUT', /at least the dedendum and a rim/);
  code(() => spurRackDimensions({ ...k, teeth: 0 }), 'INVALID_INPUT'); code(() => spurRackDimensions({ ...k, pressureAngleDeg: 25 }), 'UNSUPPORTED_GEAR_KIND');
  code(() => checkSpurGearRack(g, { ...k, moduleMM: 3 }), 'MATE_INCOMPATIBLE');
});

test('a rack meshing with a gear in the part model (R6a.5b): under it at r + x m, slid to mesh; the exact Boolean of the two is empty; the gear turned, the rack travels r per radian; the placed check at phase 0 and clear; a rack facing away refused', () => {
  const g = rot => ({ id: 'g', kind: 'spur-gear', module: 2, teeth: 18, faceWidth: 4, thicknessReduction: 0.05, rotation: rot, center: [5, 3] });
  const k = (mesh = {}) => ({ id: 'k', kind: 'spur-rack', module: 2, teeth: 12, faceWidth: 4, height: 8, thicknessReduction: 0.05, mesh: { gear: 'g', ...mesh } });
  assert.throws(() => evaluateCadPart(D([g(7), k({ direction: 30 }), { id: 'i', kind: 'intersect', target: 'g', tool: 'k' }])).output('i'), e => e.code === 'REFERENCE' && /no output i/.test(e.message));
  const r0 = evaluateCadPart(D([g(0), k()])).output('k').rackPlacement;
  for (const turn of [0, 7, 13.25]) {
    const r = evaluateCadPart(D([g(turn), k()])), gp = r.output('g').gearPlacement, kp = r.output('k').rackPlacement;
    // (Default: below the gear, the pitch line 18 mm from its axis, along +X; the rack 18 × θ further along.)
    close(kp.origin[1], 3 - 18, 1e-12, 'pitch line'); close(kp.origin[0] - r0.origin[0], 18 * turn * Math.PI / 180, 1e-12, 'travel');
    const c = checkPlacedSpurRack(gp, kp, { mode: 'verdict' });
    assert.equal(c.rackPhaseMM, 0); assert.equal(c.sweep.interference, false); close(c.centerDistanceMM, 18, 1e-12, 'D');
  }
  const off = evaluateCadPart(D([g(7), k({ phase: 1 })])), c = checkPlacedSpurRack(off.output('g').gearPlacement, off.output('k').rackPlacement);
  close(c.rackPhaseMM, 1, 1e-9, 'phase'); assert.ok(c.sweep.interference);
  // Turned half round about the pitch line's normal: the teeth face away.
  const away = { ...off.output('k').rackPlacement, angle: off.output('k').rackPlacement.angle + Math.PI };
  assert.throws(() => checkPlacedSpurRack(off.output('g').gearPlacement, away), e => e instanceof GearError && e.code === 'MATE_INCOMPATIBLE' && /face away/.test(e.message));
  assert.throws(() => evaluateCadPart(D([g(0), { ...k(), module: 3 }])), e => e.code === 'INPUT' && /MATE_INCOMPATIBLE/.test(e.message));
  // A rack on its own: along its angle from its origin.
  const free = evaluateCadPart(D([{ id: 'k', kind: 'spur-rack', module: 2, teeth: 5, faceWidth: 4, height: 8, origin: [1, 2], angle: 90, from: 3 }])).output('k');
  assert.ok(free.validate().valid); const box = free.massProperties(1).centroidMM; assert.ok(Math.abs(box[2] - 5) < 1e-9 && box[0] > 1 && box[1] > 2, String(box));
});
