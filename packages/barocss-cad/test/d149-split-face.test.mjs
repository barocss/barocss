import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, splitFaceAlongCurve, splitFaceAlongIsocline, brepFromPrismatic, prismaticFromProfile, brepFromBody, cad, revolveProfile, sewSolid, checkBrep, brepMassProperties, brepSurfaceArea, evaluateSurface, curveEvaluator, curveDomain, surfaceDomain } from '../dist/index.js';
import { faceIntegrals, oracleVolume, domainArea, distanceToSurface, bezierThrough } from './d149-oracle.mjs';

// D149 (queue item 2, for IM5's two-half parting): a face split along a curve lying on it, or along its isocline n·d = 0.
// Oracles: closed-form areas (planes, cylinders, a cone, a sphere), the area of the same region integrated over the
// unsplit surface's domain (a biquadratic face), every other face unchanged, the volume (planes and cylinders: the kernel's
// exact integrals; general faces: the Green's-theorem oracle of d149-oracle.mjs, which does not mesh), and each new edge
// on the face within the tolerance.

const rect = (x0, y0, x1, y1) => [{ kind: 'line', start: [x0, y0] }, { kind: 'line', start: [x1, y0] }, { kind: 'line', start: [x1, y1] }, { kind: 'line', start: [x0, y1] }];
const prism = (outer, z0, z1, id) => brepFromPrismatic(prismaticFromProfile({ outer, heightMM: z1 - z0, fromMM: z0, tag: id }), { id });
const line = (p, q) => ({ kind: 'curve', id: 'l', degree: 1, knots: [0, 0, 1, 1], controlPoints: [p, q], weights: [1, 1] });
const bezier = cp => ({ kind: 'curve', id: 'b', degree: cp.length - 1, knots: [...cp.map(() => 0), ...cp.map(() => 1)], controlPoints: cp, weights: cp.map(() => 1) });
const W = Math.SQRT1_2;
/** A circle (four rational quadratic quarters) about c in the plane z = c[2], from angle a0 (radians). */
const circle = (c, r, a0 = 0) => {
  const at = k => [c[0] + r * Math.cos(a0 + k * Math.PI / 4) / (k % 2 ? W : 1), c[1] + r * Math.sin(a0 + k * Math.PI / 4) / (k % 2 ? W : 1), c[2]];
  return { kind: 'curve', id: 'k', degree: 2, knots: [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1], controlPoints: Array.from({ length: 9 }, (_, k) => at(k)), weights: Array.from({ length: 9 }, (_, k) => k % 2 ? W : 1) };
};
const volume = b => brepMassProperties(b, 1).volumeMM3;
const code = f => { try { f(); return 'ok'; } catch (e) { return (/\[([A-Z_]+)\]/.exec(e.message) ?? [, e.message])[1]; } };
const near = (a, b, rel, what) => assert.ok(Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
/** The result's faces named as the input's, except the split face's pieces. */
const keptNames = (before, after, split, pieces) => assert.deepEqual(after.faces.map(f => f.name).filter(n => !pieces.includes(n)).sort(), before.faces.map(f => f.name).filter(n => n !== split).sort());
/** Every edge between two of the pieces lies on the surface S within tol. */
function edgesOnSurface(brep, pieces, S, tol = 1e-6) {
  const faceOf = new Map(brep.loops.map(l => [l.id, brep.faces.find(f => f.id === l.face).name])), uses = new Map();
  for (const c of brep.coedges) uses.set(c.edge, [...(uses.get(c.edge) ?? []), faceOf.get(c.loop)]);
  let worst = 0, count = 0;
  for (const e of brep.edges) {
    if (!(uses.get(e.id) ?? []).every(n => pieces.includes(n))) continue;
    count++;
    const at = curveEvaluator(e.curve), [t0, t1] = curveDomain(e.curve);
    for (let k = 0; k <= 32; k++) worst = Math.max(worst, distanceToSurface(S, at(t0 + (t1 - t0) * k / 32)));
  }
  assert.ok(count > 0, 'a shared edge');
  assert.ok(worst <= tol, `the shared edges lie on the face: ${worst}`);
}
const box = () => prism(rect(0, 0, 40, 30), 0, 10, 'b');
const seamed = () => { const m = cad.model(), c = m.sketch.circle({ center: [0, 0], radius: 5 }).extrude(10); return brepFromBody(m.build({ c }).bodies.c); };
const WALL = 'circle-prism/shell/m1_shell_wall';
// A biquadratic Bézier face over 40 × 30: its edges straight at z 10, its middle raised to 18; sewn to five flat sides.
const bil = (a, b, c, d) => ({ kind: 'surface', id: 'p', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[a, b], [c, d]], weights: [[1, 1], [1, 1]] });
const TOP = { kind: 'surface', id: 'top', degreeU: 2, degreeV: 2, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 0, 1, 1, 1], controlPoints: [0, 1, 2].map(i => [0, 1, 2].map(j => [20 * i, 15 * j, i === 1 && j === 1 ? 18 : 10])), weights: [0, 1, 2].map(() => [1, 1, 1]) };
const bumped = () => sewSolid({ id: 'n', surfaces: [TOP, bil([0, 0, 0], [40, 0, 0], [0, 30, 0], [40, 30, 0]), bil([0, 0, 0], [0, 0, 10], [40, 0, 0], [40, 0, 10]), bil([40, 0, 0], [40, 0, 10], [40, 30, 0], [40, 30, 10]), bil([40, 30, 0], [40, 30, 10], [0, 30, 0], [0, 30, 10]), bil([0, 30, 0], [0, 30, 10], [0, 0, 0], [0, 0, 10])] });
/** The curve S(c(t)) on TOP for the domain segment c from p to q: degree 4 (exact), through five samples. */
const onTop = (p, q) => bezier(bezierThrough(Array.from({ length: 5 }, (_, i) => evaluateSurface(TOP, p[0] + (q[0] - p[0]) * i / 4, p[1] + (q[1] - p[1]) * i / 4))));
/** A closed domain polygon's path for domainArea: (u, v, du/dt, dv/dt), t ∈ [0, 1], a side per 1/n. */
const polygon = P => t => { const n = P.length, k = Math.min(n - 1, Math.floor(n * t)), s = n * t - k, a = P[k], c = P[(k + 1) % n]; return [a[0] + (c[0] - a[0]) * s, a[1] + (c[1] - a[1]) * s, n * (c[0] - a[0]), n * (c[1] - a[1])]; };
/** A face's area by the kernel (exact on planes and cylinders; the oracle cannot read a full turn's seam). */
const kernelArea = (brep, name) => brepSurfaceArea({ ...brep, faces: brep.faces.filter(f => f.name === name) });

test('D149 S0: a plane split along a line, an arc and a closed circle — closed-form areas, every other face and the volume kept', () => {
  const b = box(), v0 = volume(b);
  for (const [name, curve, expected, loops] of [
    ['line', line([10, 0, 10], [25, 30, 10]), [525, 675], [1, 1]],
    ['quarter arc about a corner', { ...circle([0, 0, 10], 10), knots: [0, 0, 0, 1, 1, 1], controlPoints: circle([0, 0, 10], 10).controlPoints.slice(0, 3), weights: [1, W, 1] }, [25 * Math.PI, 1200 - 25 * Math.PI], [1, 1]],
    ['closed circle inside: a disc and a hole', circle([20, 15, 10], 5), [25 * Math.PI, 1200 - 25 * Math.PI], [1, 2]],
  ]) {
    const r = splitFaceAlongCurve(b, 'b.top', curve), names = r.pieces.map(p => p.name);
    assert.equal(checkBrep(r.brep).valid, true, name);
    assert.deepEqual(names, ['b.top#1', 'b.top#2'], name);
    keptNames(b, r.brep, 'b.top', names);
    const got = names.map(n => faceIntegrals(r.brep, n).area), order = got[0] <= got[1] ? [0, 1] : [1, 0];
    order.forEach((k, i) => near(got[k], expected[i], 1e-12, `${name}: piece ${i}`));
    assert.deepEqual(order.map(k => r.brep.faces.find(f => f.name === names[k]).loops.length), loops, `${name}: loops`);
    near(volume(r.brep), v0, 1e-12, `${name}: volume`);
    edgesOnSurface(r.brep, names, b.faces.find(f => f.name === 'b.top').surface);
  }
  // Named pieces.
  assert.deepEqual(splitFaceAlongCurve(b, 'b.top', line([10, 0, 10], [25, 30, 10]), { names: ['b.top.left', 'b.top.right'] }).brep.faces.map(f => f.name).filter(n => n.startsWith('b.top')).sort(), ['b.top.left', 'b.top.right']);
});

test('D149 S0: a cylinder (a full turn with its seam) split along generators and a cross-section circle, and along its isocline', () => {
  const c = seamed(), v0 = 250 * Math.PI;
  near(volume(c), v0, 1e-12, 'the cylinder');
  // Two generators a quarter turn apart: 25π and 75π (the piece across the seam joined in one face).
  const g = splitFaceAlongCurve(c, WALL, [line([0, 5, 0], [0, 5, 10]), line([-5, 0, 0], [-5, 0, 10])]);
  assert.equal(checkBrep(g.brep).valid, true);
  assert.deepEqual(g.pieces.map(p => p.faces.length), [1, 1]);
  const quarters = g.pieces.map(p => faceIntegrals(g.brep, p.name).area).sort((a, b) => a - b);
  near(quarters[0], 25 * Math.PI, 1e-11, 'a quarter'); near(quarters[1], 75 * Math.PI, 1e-11, 'three quarters');
  near(volume(g.brep), v0, 1e-12, 'generators: volume');
  // A cross-section circle at z 4 starting on the seam (its whole turn: exactly() turned it the wrong way before D149).
  for (const a0 of [0, Math.PI / 2]) {
    const k = splitFaceAlongCurve(c, WALL, circle([0, 0, 4], 5, a0));
    assert.equal(checkBrep(k.brep).valid, true, `circle from ${a0}`);
    const areas = k.pieces.map(p => kernelArea(k.brep, p.name)).sort((x, y) => x - y);
    near(areas[0], 40 * Math.PI, 1e-10, 'below'); near(areas[1], 60 * Math.PI, 1e-10, 'above');
    near(volume(k.brep), v0, 1e-10, 'circle: volume');
  }
  // The isocline for a pull across the axis: two generators, the halves 50π each, + and − by the outward normal.
  for (const pull of [[1, 0, 0], [1, 1, 0], [0.3, -1, 0.5]]) {
    const r = splitFaceAlongIsocline(c, WALL, pull);
    assert.equal(checkBrep(r.brep).valid, true, String(pull));
    assert.deepEqual(r.pieces.map(p => p.side), [1, -1]);
    for (const p of r.pieces) {
      near(faceIntegrals(r.brep, p.name).area, 50 * Math.PI, 1e-11, `${pull}: ${p.name}`);
      // The + half faces along the pull: its middle generator's outward normal has n·d > 0.
      const f = r.brep.faces.find(x => x.name === p.name), D = surfaceDomain(f.surface), x = evaluateSurface(f.surface, (D.u[0] + D.u[1]) / 2, (D.v[0] + D.v[1]) / 2);
      assert.ok(Math.sign(x[0] * pull[0] + x[1] * pull[1]) === p.side, `${pull}: ${p.name} faces its side`);
    }
    near(volume(r.brep), v0, 1e-12, `${pull}: volume`);
    edgesOnSurface(r.brep, r.pieces.map(p => p.name), c.faces.find(f => f.id === WALL).surface);
  }
});

test('D149 S0: a biquadratic face split along an isoparametric curve, a diagonal and a closed chain of four — the areas of the same regions on the unsplit surface', () => {
  const b = bumped(), whole = faceIntegrals(b, 'n.surface0').area, v0 = oracleVolume(b), S = TOP;
  near(v0, volume(b), 1e-12, 'the oracle against the kernel on the whole body');
  const R = [[0.3, 0.25], [0.7, 0.25], [0.7, 0.75], [0.3, 0.75]], inside = domainArea(S, polygon(R), 64);
  const cases = [
    // u = ½ (a quadratic): by symmetry two equal halves.
    ['u = ½', bezier([0, 1, 2].map(j => [0, 1, 2].reduce((p, i) => { const w = [1, 2, 1][i] / 4; return p.map((x, k) => x + w * TOP.controlPoints[i][j][k]); }, [0, 0, 0]))), [whole / 2, whole / 2]],
    // (u, v) from (0, 0.2) to (1, 0.9) (degree 4): below it, the region v < 0.2 + 0.7u.
    ['diagonal', onTop([0, 0.2], [1, 0.9]), (() => { const below = domainArea(S, polygon([[0, 0], [1, 0], [1, 0.9], [0, 0.2]]), 64); return [below, whole - below]; })()],
    // The rectangle u 0.3 … 0.7, v 0.25 … 0.75 as four curves end to end: a patch and a holed face.
    ['closed chain', R.map((p, k) => onTop(p, R[(k + 1) % 4])), [inside, whole - inside]],
  ];
  for (const [name, curve, expected] of cases) {
    const r = splitFaceAlongCurve(b, 'n.surface0', curve), names = r.pieces.map(p => p.name);
    assert.equal(checkBrep(r.brep).valid, true, name);
    keptNames(b, r.brep, 'n.surface0', names);
    const got = names.map(n => faceIntegrals(r.brep, n).area).sort((x, y) => x - y), want = [...expected].sort((x, y) => x - y);
    got.forEach((a, i) => near(a, want[i], 1e-9, `${name}: piece ${i}`));
    near(got[0] + got[1], whole, 1e-10, `${name}: the pieces make the face`);
    near(oracleVolume(r.brep), v0, 1e-9, `${name}: volume`);
    edgesOnSurface(r.brep, names, S);
  }
  // Its isocline for a pull along x: the ridge u = ½ (by symmetry; n·d is 0 along its flat edges v = 0 and 1 too, left
  // out as boundary), two equal halves, + toward +x. Its edge is a C¹ cubic chain within tol/4 of the traced isocline: each
  // half's area to about its length × tol/4, their sum exact.
  const iso = splitFaceAlongIsocline(b, 'n.surface0', [1, 0, 0]);
  assert.deepEqual(iso.pieces.map(p => p.side), [1, -1]);
  const halves = iso.pieces.map(p => faceIntegrals(iso.brep, p.name).area);
  for (const a of halves) near(a, whole / 2, 1e-8, 'a half');
  near(halves[0] + halves[1], whole, 1e-10, 'the halves make the face');
  near(oracleVolume(iso.brep), v0, 1e-9, 'isocline: volume');
  edgesOnSurface(iso.brep, iso.pieces.map(p => p.name), S, 1e-6);
});

test('D149 S0: isoclines on a cone and a sphere (revolved general faces) — quarter areas in closed form, through the poles', () => {
  const tri = [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [10, 0] }, { kind: 'line', start: [4, 20] }, { kind: 'line', start: [0, 20] }];
  const cone = revolveProfile({ id: 'k', profile: tri, axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: 360 });
  const frustum = Math.PI * 20 / 3 * (100 + 40 + 16), quarter = Math.PI * 14 * Math.hypot(6, 20) / 4;
  near(oracleVolume(cone), frustum, 1e-10, 'the oracle on the frustum');
  const k = splitFaceAlongIsocline(cone, 'k.side1#1', [1, 0, 0]);
  assert.equal(checkBrep(k.brep).valid, true);
  assert.deepEqual(k.pieces.map(p => p.side), [1, -1]);
  for (const p of k.pieces) near(faceIntegrals(k.brep, p.name).area, quarter, 1e-10, p.name);
  near(oracleVolume(k.brep), frustum, 1e-10, 'cone: volume');
  edgesOnSurface(k.brep, k.pieces.map(p => p.name), cone.faces.find(f => f.name === 'k.side1#1').surface);
  const sphere = revolveProfile({ id: 's', profile: [{ kind: 'arc', start: [0, -10], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, 10] }], axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: 360 });
  // Across the axis: a meridian pole to pole; along it: the equator. Each piece a quarter sphere, 100π.
  for (const pull of [[1, 0, 0], [0, 1, 0]]) {
    const r = splitFaceAlongIsocline(sphere, 's.side0#1', pull);
    assert.equal(checkBrep(r.brep).valid, true, String(pull));
    for (const p of r.pieces) near(faceIntegrals(r.brep, p.name).area, 100 * Math.PI, 1e-10, `${pull}: ${p.name}`);
    near(oracleVolume(r.brep), 4000 * Math.PI / 3, 1e-10, `${pull}: volume`);
    edgesOnSurface(r.brep, r.pieces.map(p => p.name), sphere.faces.find(f => f.name === 's.side0#1').surface);
  }
  // The isocline for a pull along z runs along this half's own boundary (n·d = 0 on both its meridians): nothing to split.
  assert.equal(code(() => splitFaceAlongIsocline(sphere, 's.side0#1', [0, 0, 1])), 'NO_ISOCLINE');
});

test('D149: refusals — off the surface, off the face, along the boundary, an open end, tangent, self-crossing, no split, a wall', () => {
  const b = box(), c = seamed();
  assert.equal(code(() => splitFaceAlongCurve(b, 'b.top', line([10, 0, 11], [25, 30, 11]))), 'OFF_SURFACE');
  assert.equal(code(() => splitFaceAlongCurve(b, 'b.top', line([50, 0, 10], [60, 30, 10]))), 'OFF_FACE');
  assert.equal(code(() => splitFaceAlongCurve(b, 'b.top', line([0, 0, 10], [40, 0, 10]))), 'ON_BOUNDARY');
  assert.equal(code(() => splitFaceAlongCurve(b, 'b.top', line([10, 0, 10], [20, 15, 10]))), 'OPEN_END');
  // Leaving the boundary along it, and dipping to touch it.
  assert.equal(code(() => splitFaceAlongCurve(b, 'b.top', bezier([[5, 0, 10], [15, 0, 10], [25, 30, 10]]))), 'TANGENT');
  assert.equal(code(() => splitFaceAlongCurve(b, 'b.top', bezier([[5, 30, 10], [20, -30, 10], [35, 30, 10]]))), 'TANGENT');
  // A cubic with a loop, from (10, 0) to (30, 0).
  assert.equal(code(() => splitFaceAlongCurve(b, 'b.top', bezier([[10, 0, 10], [40, 25, 10], [0, 25, 10], [30, 0, 10]]))), 'SELF_CROSSING');
  // One generator only opens a full turn along its seam.
  assert.equal(code(() => splitFaceAlongCurve(c, WALL, line([0, 5, 0], [0, 5, 10]))), 'NO_SPLIT');
  // Isoclines: a flat face along the pull or across it, a cylinder along the pull, a face facing one way.
  assert.equal(code(() => splitFaceAlongIsocline(b, 'b.side0', [1, 0, 0])), 'WALL');
  assert.equal(code(() => splitFaceAlongIsocline(b, 'b.top', [0, 0, 1])), 'NO_ISOCLINE');
  assert.equal(code(() => splitFaceAlongIsocline(c, WALL, [0, 0, 1])), 'WALL');
  assert.equal(code(() => splitFaceAlongIsocline(bumped(), 'n.surface0', [0, 0, 1])), 'NO_ISOCLINE');
  // Inputs.
  assert.equal(code(() => splitFaceAlongCurve(b, 'b.nope', line([10, 0, 10], [25, 30, 10]))), 'NO_FACE');
  const cyl = revolveProfile({ id: 'r', profile: rect(0, 0, 10, 20), axis: { origin: [0, 0], direction: [0, 1] }, angleDegrees: 360 });
  assert.equal(code(() => splitFaceAlongIsocline(cyl, 'r.side1', [1, 0, 0])), 'AMBIGUOUS');
  assert.equal(code(() => splitFaceAlongIsocline(b, 'b.top', [0, 0, 0])), 'PULL');
  assert.equal(code(() => splitFaceAlongCurve(b, 'b.top', [])), 'CURVES');
  assert.equal(code(() => splitFaceAlongCurve(b, 'b.top', line([10, 0, 10], [25, 30, 10]), { names: ['one'] })), 'NAMES');
  assert.equal(code(() => splitFaceAlongCurve(b, 'b.top', line([10, 0, 10], [25, 30, 10]), { names: ['b.side0', 'x'] })), 'NAMES');
});

test('D149: the part feature split-face — curves or a pull, the face by name, its refusals mapped to the document\'s codes', () => {
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'b', kind: 'extrude', sketch: 's', height: 10 }];
  const crv = { degree: 1, knots: [0, 0, 1, 1], controlPoints: [[10, 0, 10], [25, 30, 10]], weights: [1, 1] };
  const partCode = doc => { try { evaluateCadPart(doc); return 'ok'; } catch (e) { return e.code; } };
  const out = evaluateCadPart(D([...box, { id: 'p', kind: 'split-face', target: 'b', face: 'b.top', curves: [crv] }])).outputs;
  assert.deepEqual(out.map(o => o.brep.faces.map(f => f.name).filter(n => n.startsWith('b.top')).sort()), [['b.top#1', 'b.top#2']]);
  assert.equal(partCode(D([...box, { id: 'p', kind: 'split-face', target: 'b', face: 'b.nope', curves: [crv] }])), 'REFERENCE');
  assert.equal(partCode(D([...box, { id: 'p', kind: 'split-face', target: 'b', face: 'b.top', curves: [crv], pull: [0, 0, 1] }])), 'INPUT');
  assert.equal(partCode(D([...box, { id: 'p', kind: 'split-face', target: 'b', face: 'b.top' }])), 'INPUT');
  assert.equal(partCode(D([...box, { id: 'p', kind: 'split-face', target: 'b', face: 'b.top', curves: [{ ...crv, degree: 7 }] }])), 'INPUT');
  assert.equal(partCode(D([...box, { id: 'p', kind: 'split-face', target: 'b', face: 'b.top', curves: [crv], names: ['x'] }])), 'INPUT');
  assert.equal(partCode(D([...box, { id: 'p', kind: 'split-face', target: 'b', face: 'b.side0', pull: [1, 0, 0] }])), 'GEOMETRY');
});
