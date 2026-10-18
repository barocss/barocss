import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, evaluateSurface, surfaceDomain } from '../dist/index.js';

// R10.1 (D88): fillets in closed form for two classes beyond plane/plane and plane/square-cylinder — translational
// (a straight edge between planes along it and cylinders whose axis runs along it) and coaxial (a circular edge between
// surfaces of revolution about its axis) — with the typed refusals and the true face reach. Each volume is checked
// against the region between the corner and the fillet arc, worked out here by hand (the ball's centre r from both
// faces) and integrated exactly (Green's theorem over lines and arcs; Pappus for the revolved ones).
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const out = features => evaluateCadPart(D(features)).outputs.at(-1);
const vol = features => out(features).massProperties(1).volumeMM3;
const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] }, xz = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
const fillet = (target, edges, radius) => ({ id: 'f', kind: 'fillet', target, edges, radius });
const refused = (features, code, typed) => assert.throws(() => evaluateCadPart(D(features)), e => e.code === code && e.message.includes(`[${typed}]`), typed);

const TAU = 2 * Math.PI;
const short = (a, c, b) => ((a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0])) > 0 ? 'ccw' : 'cw';
const arc = (start, center, end) => ({ kind: 'arc', start, center, direction: short(start, center, end) });
/** Area and first moment about x = 0 (∫∫ x dA) of a closed loop of lines and arcs, each ending at the next one's start. */
function moments(loop) {
  let A = 0, M = 0;
  loop.forEach((s, i) => {
    const p = s.start, q = loop[(i + 1) % loop.length].start;
    if (s.kind === 'line') { A += (p[0] * q[1] - q[0] * p[1]) / 2; M += (q[1] - p[1]) * (p[0] ** 2 + p[0] * q[0] + q[0] ** 2) / 6; return; }
    const [cx, cy] = s.center, r = Math.hypot(p[0] - cx, p[1] - cy), a0 = Math.atan2(p[1] - cy, p[0] - cx), b = Math.atan2(q[1] - cy, q[0] - cx);
    const d = s.direction === 'ccw' ? ((b - a0) % TAU + TAU) % TAU : -(((a0 - b) % TAU + TAU) % TAU), a1 = a0 + d;
    A += (cx * r * (Math.sin(a1) - Math.sin(a0)) - cy * r * (Math.cos(a1) - Math.cos(a0)) + r * r * d) / 2;
    const F = t => cx * cx * r * Math.sin(t) + 2 * cx * r * r * (t / 2 + Math.sin(2 * t) / 4) + r ** 3 * (Math.sin(t) - Math.sin(t) ** 3 / 3);
    M += (F(a1) - F(a0)) / 2;
  });
  return { A: Math.abs(A), M: Math.abs(M) };
}
const unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
/** The region between a corner of two lines (P, leaving along w1 and w2) and its fillet of radius r. */
function lineCorner(P, w1, w2, r) {
  const alpha = Math.acos(w1[0] * w2[0] + w1[1] * w2[1]), t = r / Math.tan(alpha / 2), bis = unit([w1[0] + w2[0], w1[1] + w2[1]]);
  const T1 = [P[0] + w1[0] * t, P[1] + w1[1] * t], T2 = [P[0] + w2[0] * t, P[1] + w2[1] * t], C = [P[0] + bis[0] * r / Math.sin(alpha / 2), P[1] + bis[1] * r / Math.sin(alpha / 2)];
  return moments([{ kind: 'line', start: P }, arc(T1, C, T2), { kind: 'line', start: T2 }]);
}
const near = (got, want, rel, what) => assert.ok(Math.abs(got / want - 1) < rel, `${what}: ${got} vs ${want} (${got / want - 1})`);
/** Within rel of the whole part's volume (a revolved fillet's torus is integrated by quadrature; its share is small). */
const nearIn = (got, want, whole, rel, what) => assert.ok(Math.abs(got - want) < rel * whole, `${what}: ${got} vs ${want} (${(got - want) / whole} of the part)`);
/** Over a 9 × 9 grid on each fillet face's surface: the largest |distance to the ball's centre (line or circle) − r|. */
function offRadius(brep, centreDistance, r) {
  let worst = 0;
  for (const f of brep.faces) if (/^f\.face/.test(f.name)) {
    const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(f.surface);
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) worst = Math.max(worst, Math.abs(centreDistance(evaluateSurface(f.surface, u0 + (u1 - u0) * i / 8, v0 + (v1 - v0) * j / 8)) - r));
  }
  return worst;
}
const straightEdge = (brep, test) => brep.edges.find(e => e.curve.degree === 1 && test(e.curve.controlPoints)).name;

// The bodies.
const plate = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, -20], max: [40, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 }];
const rodAt = (id, c, r) => [{ id: `${id}s`, kind: 'sketch', profile: 'circle', center: c, radius: r, plane: yz }, { id, kind: 'extrude', sketch: `${id}s`, height: 40 }];
const rodOnPlate = [...plate, ...rodAt('ce', [0, 10], 5), { id: 'u', kind: 'union', target: 'pe', tool: 'ce' }];
const dShaft = [...rodAt('ce', [0, 0], 5), { id: 'b', kind: 'sketch', profile: 'rectangle', min: [-5, 3], max: [45, 10], plane: { origin: [0, 0, -10], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'be', kind: 'extrude', sketch: 'b', height: 20 }, { id: 'd', kind: 'difference', target: 'ce', tool: 'be' }];
const twoRods = [...rodAt('a', [0, 0], 5), ...rodAt('bb', [6, 0], 4), { id: 'u', kind: 'union', target: 'a', tool: 'bb' }];
const turned = (id, points) => [{ id: `${id}s`, kind: 'sketch', profile: 'polygon', points, plane: xz }, { id, kind: 'revolve', sketch: `${id}s`, axis: { origin: [0, 0], direction: 'y' } }];
const coneBody = turned('r', [[0, 0], [10, 0], [10, 10], [4, 16], [0, 16]]);
const steppedCone = turned('r', [[0, 0], [20, 0], [20, 5], [8, 5], [4, 15], [0, 15]]);
const domed = [{ id: 'rs', kind: 'sketch', profile: 'loop', plane: xz, segments: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [6, 0] }, { kind: 'arc', start: [6, 8], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, 10] }] }, { id: 'r', kind: 'revolve', sketch: 'rs', axis: { origin: [0, 0], direction: 'y' } }];
const ringEdge = (features, a, b) => out(features).brep.edges.find(e => e.name.includes(a) && e.name.includes(b)).name;

test('R10.1 (a) translational: a rod on a plate (plane × cylinder, concave), a D shaft\'s flat (convex, the ball inside the rod) and two parallel rods (cylinder × cylinder) — exact sections extruded', () => {
  // The rod (radius 5, axis at z = 10) on the plate's top: the ball r above the top and 5 + r from the axis.
  const junction = straightEdge(out(rodOnPlate).brep, p => p[0][1] > 0 && Math.abs(p[0][2] - 10) < 1e-9), v0 = vol(rodOnPlate);
  for (const r of [1, 2, 3]) {
    const yc = Math.sqrt((5 + r) ** 2 - r ** 2), X = [5, 10], T1 = [yc, 10], C = [yc, 10 + r], T2 = [5 * yc / (5 + r), 10 + 5 * r / (5 + r)];
    const { A } = moments([{ kind: 'line', start: X }, { kind: 'line', start: T1 }, arc(T1, C, T2), arc(T2, [0, 10], X)]);
    const o = out([...rodOnPlate, fillet('u', [junction], r)]);
    assert.equal(o.validate().valid, true);
    near(o.massProperties(1).volumeMM3 - v0, A * 40, 1e-9, `rod on plate r ${r}`);
    assert.equal(o.brep.faces.filter(f => f.name === 'f.face').length, 1);
    assert.ok(offRadius(o.brep, p => Math.hypot(p[1] - C[0], p[2] - C[1]), r) < 1e-12, 'the fillet face is the cylinder about the ball\'s centre line');
  }
  // The flat at y = 3 of a rod of radius 5 about X: the ball r below the flat and 5 − r from the axis (in y, z).
  const flat = straightEdge(out(dShaft).brep, p => Math.abs(p[0][1] - 3) < 1e-9 && p[0][2] > 0), d0 = vol(dShaft);
  for (const r of [0.5, 1.5]) {
    const C = [3 - r, Math.sqrt((5 - r) ** 2 - (3 - r) ** 2)], X = [3, 4], T1 = [3, C[1]], T2 = unit(C).map(x => 5 * x);
    const { A } = moments([{ kind: 'line', start: X }, arc(T1, C, T2), arc(T2, [0, 0], X)]);
    const o = out([...dShaft, fillet('d', [flat], r)]);
    assert.equal(o.validate().valid, true);
    near(d0 - o.massProperties(1).volumeMM3, A * 40, 1e-9, `D shaft r ${r}`);
  }
  // Rods of radius 5 about (0, 0) and 4 about (6, 0): the ball 5 + r and 4 + r from the axes.
  const groove = straightEdge(out(twoRods).brep, p => p[0][2] > 1 && Math.abs(p[0][1] - 3.75) < 1e-9), t0 = vol(twoRods);
  for (const r of [0.5, 1, 2]) {
    const a = 5 + r, b = 4 + r, x = (a * a - b * b + 36) / 12, C = [x, Math.sqrt(a * a - x * x)], X = [3.75, Math.sqrt(25 - 3.75 ** 2)];
    const TA = unit(C).map(v => 5 * v), TB = unit([C[0] - 6, C[1]]).map((v, k) => (k ? 0 : 6) + 4 * v);
    const { A } = moments([arc(X, [0, 0], TA), arc(TA, C, TB), arc(TB, [6, 0], X)]);
    const o = out([...twoRods, fillet('u', [groove], r)]);
    assert.equal(o.validate().valid, true);
    near(o.massProperties(1).volumeMM3 - t0, A * 40, 1e-9, `two rods r ${r}`);
  }
});

test('R10.1 (b) coaxial: a cylinder × cone rim and a cone × plane top (convex), a plane × cone foot (concave) and a cylinder × sphere dome (convex) — meridian sections revolved, exact by Pappus; the whole circle from one half selected', () => {
  const cases = [
    ['cylinder × cone', coneBody, ['r.side1#1', 'r.side2#1'], -1, [10, 10], [0, -1], unit([-1, 1]), 2],
    ['cone × plane', coneBody, ['r.side2#1', 'r.side3'], -1, [4, 16], unit([1, -1]), [-1, 0], 1],
    ['plane × cone (foot)', steppedCone, ['r.side2', 'r.side3#1'], 1, [8, 5], [1, 0], unit([-4, 10]), 2],
  ];
  for (const [what, body, [a, b], sign, P, w1, w2, r] of cases) {
    const edge = ringEdge(body, a, b), o = out([...body, fillet('r', [edge], r)]), { M } = lineCorner(P, w1, w2, r);
    assert.equal(o.validate().valid, true, what);
    nearIn(sign * (o.massProperties(1).volumeMM3 - vol(body)), TAU * M, vol(body), 1e-10, what);
    assert.deepEqual(o.brep.faces.filter(f => /^f\.face/.test(f.name)).map(f => f.name).sort(), ['f.face#1', 'f.face#2'], what);
    const alpha = Math.acos(w1[0] * w2[0] + w1[1] * w2[1]), bis = unit([w1[0] + w2[0], w1[1] + w2[1]]), k = r / Math.sin(alpha / 2), C = [P[0] + bis[0] * k, P[1] + bis[1] * k];
    assert.ok(offRadius(o.brep, p => Math.hypot(Math.hypot(p[0], p[1]) - C[0], p[2] - C[1]), r) < 1e-12, `${what}: the fillet face is the torus about the ball's centre circle`);
  }
  // The dome: a sphere of radius 10 about the origin over a wall at ρ = 6, meeting it at (6, 8); the ball inside, 1 from
  // the wall and 9 from the sphere's centre.
  const r = 1, C = [5, Math.sqrt(56)], X = [6, 8], T1 = [6, C[1]], T2 = unit(C).map(x => 10 * x);
  const { M } = moments([{ kind: 'line', start: X }, arc(T1, C, T2), arc(T2, [0, 0], X)]);
  const o = out([...domed, fillet('r', [ringEdge(domed, 'r.side1#1', 'r.side2#1')], r)]);
  assert.equal(o.validate().valid, true);
  // (The volume within 1e-7 of the part: quadrature over the sphere face trimmed by the torus, 6e-8 measured; the
  // surfaces themselves exact.)
  nearIn(vol(domed) - o.massProperties(1).volumeMM3, TAU * M, vol(domed), 1e-7, 'cylinder × sphere');
  assert.ok(offRadius(o.brep, p => Math.hypot(Math.hypot(p[0], p[1]) - C[0], p[2] - C[1]), r) < 1e-12, 'the dome\'s fillet is the torus about the ball\'s centre circle');
});

test('R10.1 typed refusals: TANGENT_FACES, RADIUS_EXCEEDS_FACE (planes, translational, coaxial), RADIUS_EXCEEDS_CURVATURE, NOT_ANALYTIC_PAIR; chamfers of the new pairs are refused (not yet)', () => {
  // A fillet's torus meets the top it rounded tangentially.
  const rounded = [{ id: 'c', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 }, { id: 'ce', kind: 'extrude', sketch: 'c', height: 10 }];
  const rim = out(rounded).brep.edges.find(e => /ce\.top/.test(e.name) && /ce\.side0/.test(e.name)).name;
  const once = [...rounded, { id: 'g', kind: 'fillet', target: 'ce', edges: [rim], radius: 2 }];
  refused([...once, fillet('g', [ringEdge(once, 'g.face', 'ce.top')], 1)], 'SELECTION', 'TANGENT_FACES');
  // Past the true reach: the plate's top beside the rod is 15 wide (a ball of r touches it √((5 + r)² − r²) − 5 out: 15 at
  // r = 37.5, 15.6 at 40); the stepped cone's slope is 10.77 long (a fillet of 17 sets back 11.5 on it).
  const junction = straightEdge(out(rodOnPlate).brep, p => p[0][1] > 0 && Math.abs(p[0][2] - 10) < 1e-9);
  assert.ok(out([...rodOnPlate, fillet('u', [junction], 37.5)]).validate().valid, 'a ball of 37.5 touches the top at its far edge: the reach exactly');
  refused([...rodOnPlate, fillet('u', [junction], 40)], 'PARAMETER', 'RADIUS_EXCEEDS_FACE');
  refused([...steppedCone, fillet('r', [ringEdge(steppedCone, 'r.side2', 'r.side3#1')], 17)], 'PARAMETER', 'RADIUS_EXCEEDS_FACE');
  // The D shaft's flat: a ball of 5 inside a rod of 5.
  const flat = straightEdge(out(dShaft).brep, p => Math.abs(p[0][1] - 3) < 1e-9 && p[0][2] > 0);
  refused([...dShaft, fillet('d', [flat], 5)], 'PARAMETER', 'RADIUS_EXCEEDS_CURVATURE');
  // Two rods crossing at right angles meet in a space curve.
  const cross = [...rodAt('a', [0, 0], 5), { id: 'bs', kind: 'sketch', profile: 'circle', center: [20, 0], radius: 3, plane: { origin: [0, 0, -10], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'bb', kind: 'extrude', sketch: 'bs', height: 20 }, { id: 'u', kind: 'union', target: 'a', tool: 'bb' }];
  const saddle = out(cross).brep.edges.find(e => /a\.side0/.test(e.name) && /bb\.side0/.test(e.name)).name;
  refused([...cross, fillet('u', [saddle], 1)], 'CAPABILITY', 'NOT_ANALYTIC_PAIR');
  assert.throws(() => evaluateCadPart(D([...rodOnPlate, { id: 'f', kind: 'chamfer', target: 'u', edges: [junction], distance: 1 }])), e => e.code === 'CAPABILITY' && /chamfers along horizontal edges need planar faces/.test(e.message));
  assert.throws(() => evaluateCadPart(D([...coneBody, { id: 'f', kind: 'chamfer', target: 'r', edges: [ringEdge(coneBody, 'r.side1#1', 'r.side2#1')], distance: 1 }])), e => e.code === 'CAPABILITY' && /chamfers along a circle between curved faces/.test(e.message));
});

test('R10.1 names: the fillet face is f.face and every other face and edge keeps its name as the radius changes; a sketch-tagged rod keeps its tagged wall names', () => {
  const junction = straightEdge(out(rodOnPlate).brep, p => p[0][1] > 0 && Math.abs(p[0][2] - 10) < 1e-9);
  const names = r => { const b = out([...rodOnPlate, fillet('u', [junction], r)]).brep; return [b.faces.map(f => f.name).sort(), b.edges.map(e => e.name).sort()]; };
  const [f1, e1] = names(1);
  for (const r of [2, 3, 7.5]) assert.deepEqual(names(r), [f1, e1], `r ${r}`);
  assert.ok(f1.includes('f.face') && f1.includes('ce.side0') && f1.includes('pe.top#1') && f1.includes('pe.top#2'), f1.join(' '));
  // With R10a's tags on the rod's sketch: its wall is ce.side[w] before and after the fillet.
  const tagged = [...plate, { id: 'ces', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 5, plane: yz, sideTags: { outer: ['w'] } }, { id: 'ce', kind: 'extrude', sketch: 'ces', height: 40 }, { id: 'u', kind: 'union', target: 'pe', tool: 'ce' }];
  const edge = straightEdge(out(tagged).brep, p => p[0][1] > 0 && Math.abs(p[0][2] - 10) < 1e-9);
  assert.match(edge, /ce\.side\[w\]/);
  const after = out([...tagged, fillet('u', [edge], 2)]).brep.faces.map(f => f.name);
  assert.ok(after.includes('ce.side[w]') && after.includes('f.face'), after.join(' '));
});
