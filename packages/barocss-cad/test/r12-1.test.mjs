import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, faceGeometry, importStep, checkBrep, brepMassProperties } from '../dist/index.js';

// R12.1 (D116): sheet rules, the base flange and the contour flange. Oracles are the virtual-sharp relations, written
// here from the textbook definitions and not from the kernel's construction: a leg measured to a corner of the path
// loses, at a corner where the path is the outer skin, 2(R + T)·tan(θ/2) and gains the bend's middle arc θ(R + T/2)
// (the bend deduction at K = ½); where the path is the inner skin, 2R·tan(θ/2) and the same arc. So the section's area is
// T times its middle line, and the volume that times the width.
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const refused = (features, code, pattern) => assert.throws(() => out(features), e => (e.details?.category ?? e.code) === code && pattern.test(e.message), String(pattern));
const contour = (path, side, o = {}) => ({ id: 'c', kind: 'sheet-contour', path, side, width: 40, thickness: 2, bendRadius: 3, kFactor: 0.4, ...o });

/** The middle line of a contour flange from its path: Σ legs, less at each corner its setbacks, plus its middle arc. */
function middleLength(path, side, T, R) {
  let L = 0;
  for (let i = 0; i + 1 < path.length; i++) L += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
  for (let k = 1; k + 1 < path.length; k++) {
    const a = [path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]], b = [path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]];
    const th = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]), outer = Math.sign(th) === (side === 'left' ? 1 : -1);
    L += -2 * (outer ? R + T : R) * Math.tan(Math.abs(th) / 2) + Math.abs(th) * (R + T / 2);
  }
  return L;
}

test('R12.1 contour flange: an L at any angle, its path the outer or the inner skin, is the textbook volume; its bend faces are R and R + T about the reported axis', () => {
  const T = 2, R = 3, W = 40, A = 80, B = 65;
  for (const deg of [30, 60, 90, 120, 150, 170]) for (const side of ['left', 'right']) {
    const th = deg * Math.PI / 180, path = [[0, 0], [A, 0], [A + B * Math.cos(th), B * Math.sin(th)]];
    const o = out([contour(path, side)]), outerPath = side === 'left';
    assert.equal(o.validate().valid, true, `${deg}° ${side}`);
    assert.equal(o.representation, 'upright');
    // The bend deduction at K = ½ where the path is the outer skin (its corner the outer virtual sharp); the inner
    // setback 2R·tan(θ/2) less the arc where it is the inner skin.
    const mid = outerPath ? A + B - (2 * (R + T) * Math.tan(th / 2) - th * (R + T / 2)) : A + B - 2 * R * Math.tan(th / 2) + th * (R + T / 2);
    assert.ok(Math.abs(o.massProperties(1).volumeMM3 / (W * T * mid) - 1) < 1e-12, `${deg}° ${side}: ${o.massProperties(1).volumeMM3 / (W * T * mid) - 1}`);
    assert.deepEqual([...o.brep.faces.map(f => f.name)].sort(), ['c.back', 'c.bend1.inner', 'c.bend1.outer', 'c.end', 'c.front', 'c.leg0.a', 'c.leg0.b', 'c.leg1.a', 'c.leg1.b', 'c.start']);
    const [bend] = o.sheet.bends;
    assert.equal(o.sheet.bends.length, 1);
    assert.ok(Math.abs(bend.angleDegrees - deg) < 1e-9);
    for (const [name, r] of [[bend.inner, R], [bend.outer, R + T]]) {
      const g = faceGeometry(o.brep.faces.find(f => f.name === name)), c = bend.axis.origin, a = bend.axis.direction;
      assert.equal(g.kind, 'cylinder');
      assert.ok(Math.abs(g.r - r) < 1e-12, `${name} radius ${g.r}`);
      // Its axis: parallel to the report's, through its origin.
      const d = [g.c[0] - c[0], g.c[1] - c[1], g.c[2] - c[2]], along = d[0] * a[0] + d[1] * a[1] + d[2] * a[2];
      assert.ok(Math.abs(Math.abs(g.a[0] * a[0] + g.a[1] * a[1] + g.a[2] * a[2]) - 1) < 1e-12 && Math.hypot(d[0] - along * a[0], d[1] - along * a[1], d[2] - along * a[2]) < 1e-12);
    }
  }
});

test('R12.1 contour flange: several bends turning both ways (a hat, a zed, a channel) are the textbook volume, on any plane', () => {
  const T = 1.5, R = 2;
  const cases = [
    { path: [[0, 0], [10, 0], [10, 15], [40, 15], [40, 0], [50, 0]], side: 'left' },
    { path: [[0, 0], [10, 0], [10, 15], [40, 15], [40, 0], [50, 0]], side: 'right' },
    { path: [[0, 0], [20, 0], [26, 12], [46, 12]], side: 'right' },
    { path: [[0, 30], [0, 0], [40, 0], [40, 30]], side: 'left' },
    { path: [[0, 30], [0, 0], [40, 0], [40, 30]], side: 'right' },
  ];
  for (const { path, side } of cases) {
    const o = out([contour(path, side, { thickness: T, bendRadius: R, width: 25 })]), V = 25 * T * middleLength(path, side, T, R);
    assert.equal(o.validate().valid, true);
    assert.ok(Math.abs(o.massProperties(1).volumeMM3 / V - 1) < 1e-12, `${JSON.stringify(path)} ${side}`);
    assert.equal(o.sheet.bends.length, path.length - 2);
  }
  // The channel on the XZ plane (its normal −Y): the same volume, its bends' axes along −Y, a STEP round trip whole.
  const plane = { origin: [0, 5, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] }, path = cases[3].path;
  const o = out([contour(path, 'left', { thickness: T, bendRadius: R, width: 25, plane })]);
  assert.ok(Math.abs(o.massProperties(1).volumeMM3 / (25 * T * middleLength(path, 'left', T, R)) - 1) < 1e-12);
  for (const b of o.sheet.bends) { assert.deepEqual(b.axis.direction, [0, -1, 0]); assert.equal(b.axis.origin[1], 5); }
  assert.ok(o.brep.faces.every(f => f.surface.kind !== 'surface' || faceGeometry(f).kind !== 'other'));
  const back = importStep(o.exportStep());
  assert.equal(checkBrep(back, { strict: true }).valid, true);
  assert.ok(Math.abs(brepMassProperties(back, 1).volumeMM3 / o.massProperties(1).volumeMM3 - 1) < 1e-9);
});

test('R12.1 sheet rules: the report gives each bend\'s allowance, setback and deduction by their definitions', () => {
  const T = 2, R = 3, K = 0.4;
  for (const deg of [45, 90, 135]) {
    const th = deg * Math.PI / 180, o = out([contour([[0, 0], [30, 0], [30 + 25 * Math.cos(th), 25 * Math.sin(th)]], 'left', { kFactor: K })]), [b] = o.sheet.bends;
    assert.deepEqual({ t: o.sheet.thicknessMM, r: o.sheet.bendRadiusMM, k: o.sheet.kFactor }, { t: T, r: R, k: K });
    assert.equal(b.name, 'c.bend1'); assert.equal(b.radiusMM, R);
    assert.ok(Math.abs(b.allowanceMM - th * (R + K * T)) < 1e-12);
    assert.ok(Math.abs(b.setbackMM - (R + T) * Math.tan(th / 2)) < 1e-12);
    assert.ok(Math.abs(b.deductionMM - (2 * (R + T) * Math.tan(th / 2) - th * (R + K * T))) < 1e-12);
  }
});

test('R12.1 base flange: a plate from a closed sketch, holes kept, T thick either way; no bends', () => {
  const T = 1.2, sketch = { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [80, 50], holes: [[{ kind: 'arc', start: [45, 25], center: [40, 25], direction: 'ccw' }]] };
  for (const reverse of [false, true]) {
    const o = out([sketch, { id: 'b', kind: 'sheet-base', sketch: 's', thickness: T, bendRadius: 1.2, kFactor: 0.45, ...(reverse ? { reverse } : {}) }]), m = o.massProperties(1);
    assert.equal(o.validate().valid, true);
    assert.ok(Math.abs(m.volumeMM3 / ((4000 - 25 * Math.PI) * T) - 1) < 1e-12);
    assert.ok(Math.abs(m.centroidMM[2] - (reverse ? -T / 2 : T / 2)) < 1e-12);
    assert.deepEqual([...new Set(o.brep.faces.map(f => f.name.replace(/#\d+$/, '')))].sort(), ['b.bottom', 'b.hole0.side0', 'b.side0', 'b.side1', 'b.side2', 'b.side3', 'b.top']);
    assert.deepEqual(o.sheet, { thicknessMM: T, bendRadiusMM: 1.2, kFactor: 0.45, fixedFace: 'b.top', bends: [] });
  }
});

test('R12.1 refusals: a corner in line or folded back, a leg too short for its bends, a section meeting itself, rules out of range', () => {
  refused([contour([[0, 0], [10, 0], [20, 0], [20, 10]], 'left')], 'PARAMETER', /\[BEND_ANGLE\] path point 1 is in line/);
  refused([contour([[0, 0], [30, 0], [0, 0.0000000001]], 'left')], 'PARAMETER', /\[BEND_ANGLE\] path point 1 turns back 180°/);
  // Outer skin at the corner: its setback (R + T)·tan 45° = 5 mm on each leg; a 4 mm leg has no room.
  refused([contour([[0, 0], [4, 0], [4, 20]], 'left')], 'PARAMETER', /\[BEND_DOES_NOT_FIT\] leg 0 is 4 mm between its corners; its bends take 5 mm/);
  // Two corners on a 9 mm leg (5 + 5): no straight part left.
  refused([contour([[0, 20], [0, 0], [9, 0], [9, 20]], 'left')], 'PARAMETER', /\[BEND_DOES_NOT_FIT\] leg 1 is 9 mm/);
  // The path's last leg crosses its first; and a path that comes back to touch its own start.
  refused([contour([[0, 0], [20, 0], [20, 10], [5, 10], [5, -5]], 'right')], 'GEOMETRY', /\[SHEET_CROSSES_ITSELF\] the sheet's section meets itself: leg0.a and leg3.a near \(5, 0\)/);
  refused([contour([[0, 0], [30, 0], [30, 20], [0, 20], [0, 2]], 'left')], 'GEOMETRY', /\[SHEET_CROSSES_ITSELF\] the sheet's section meets itself: leg3.a and leg0.b near \(0, 2\)/);
  // A millimetre short of touching: built.
  assert.equal(out([contour([[0, 0], [30, 0], [30, 20], [0, 20], [0, 3]], 'left')]).validate().valid, true);
  refused([contour([[0, 0], [20, 0], [20, 10]], 'left', { kFactor: 1.2 })], 'PARAMETER', /kFactor must be a number from 0 to 1/);
  refused([contour([[0, 0], [20, 0], [20, 10]], 'up')], 'INPUT', /side must be left or right/);
  refused([contour([[0, 0]], 'left')], 'INPUT', /path must list 2 to 64 points/);
  refused([contour([[0, 0], [20, 0], [20, 10]], 'left', { thickness: 0 })], 'PARAMETER', /thickness must be positive/);
  refused([{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10], regions: [[{ kind: 'line', start: [20, 0] }, { kind: 'line', start: [30, 0] }, { kind: 'line', start: [30, 10] }]] }, { id: 'b', kind: 'sheet-base', sketch: 's', thickness: 1, bendRadius: 1, kFactor: 0.5 }], 'CAPABILITY', /one outer loop/);
  // A straight path is a flat strip (no bend): allowed.
  const strip = out([contour([[0, 0], [30, 0]], 'left')]);
  assert.ok(Math.abs(strip.massProperties(1).volumeMM3 - 30 * 2 * 40) < 1e-9 && strip.sheet.bends.length === 0);
});
