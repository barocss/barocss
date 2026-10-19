import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkBrep } from '../dist/index.js';
import { setRingStations } from '../dist/rolling-ball.js';

// R10.5 (D100): the variable-radius fillet. `radii` gives the radius at points of the edges; between them it varies by
// arc length along the chain (shape-preserving cubic Hermite; two points: linear), carried on at its end slopes past
// an open chain's outer points, periodic round a closed one. Its section at each station is the arc of the ball of that radius, centred in the
// plane square to the chain there and touching both faces — on planes along the edge, a circle of radius r(s) in that
// plane, so the volume is ∫ A(r(s)) ds (or, round a circle, ∫ of the meridian section's first moment).
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const at = (b, y, z) => b.edges.find(e => e.curve.degree === 1 && e.curve.controlPoints.every(p => Math.abs(p[1] - y) < 1e-9 && Math.abs(p[2] - z) < 1e-9)).name;
const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
const A = r => (1 - Math.PI / 4) * r * r;
/** A monotone (Fritsch–Carlson) cubic Hermite through (x, y) — written apart from the kernel's, from the method. */
const fritschCarlson = (x, y) => {
  const n = x.length, d = x.slice(1).map((_, k) => (y[k + 1] - y[k]) / (x[k + 1] - x[k])), m = x.map((_, k) => n === 2 ? d[0] : k === 0 ? d[0] : k === n - 1 ? d[n - 2] : d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2);
  for (let k = 0; k < n - 1; k++) { if (d[k] === 0) { m[k] = m[k + 1] = 0; continue; } const a = m[k] / d[k], b = m[k + 1] / d[k], t = a * a + b * b; if (t > 9) { m[k] = 3 * a * d[k] / Math.sqrt(t); m[k + 1] = 3 * b * d[k] / Math.sqrt(t); } }
  return s => { if (s <= x[0]) return y[0]; if (s >= x[n - 1]) return y[n - 1]; let k = 0; while (s > x[k + 1]) k++; const h = x[k + 1] - x[k], t = (s - x[k]) / h; return (2 * t ** 3 - 3 * t * t + 1) * y[k] + (t ** 3 - 2 * t * t + t) * h * m[k] + (-2 * t ** 3 + 3 * t * t) * y[k + 1] + (t ** 3 - t * t) * h * m[k + 1]; };
};

test('R10.5 a box\'s top edge (convex, square planes) from r0 to r1 linearly: (1 − π/4) L (r0² + r0 r1 + r1²) / 3 to 1e-9; three points (1 at x 0, 2 at 10, 4 at 40) to (1 − π/4) ∫ r² ds of the monotone cubic; G1 to the faces, the report in bounds', () => {
  const o0 = out(box), v0 = o0.massProperties(1).volumeMM3, edge = at(o0.brep, 0, 10);
  for (const [radii, exact] of [
    [[{ at: [0, 0, 10], radius: 1 }, { at: [40, 0, 10], radius: 3 }], A(1) * 0 + (1 - Math.PI / 4) * 40 * (1 + 3 + 9) / 3],
    [[{ at: [40, 0, 10], radius: 1 }, { at: [0, 0, 10], radius: 3 }], (1 - Math.PI / 4) * 40 * 13 / 3],
    [[{ at: [0, 0, 10], radius: 0.5 }, { at: [40, 0, 10], radius: 4 }], (1 - Math.PI / 4) * 40 * (0.25 + 2 + 16) / 3],
    [[{ at: [0, 0, 10], radius: 1 }, { at: [10, 0, 10], radius: 2 }, { at: [40, 0, 10], radius: 4 }], (() => { const r = fritschCarlson([0, 10, 40], [1, 2, 4]); let s = 0; const n = 200000; for (let i = 0; i < n; i++) s += A(r(40 * (i + 0.5) / n)) * 40 / n; return s; })()],
  ]) {
    const o = out([...box, { id: 'f', kind: 'fillet', target: 'e', edges: [edge], radii }]), got = v0 - o.massProperties(1).volumeMM3, what = radii.map(p => p.radius).join('→');
    assert.equal(o.validate().valid, true, what);
    assert.ok(Math.abs(got / exact - 1) < 1e-9, `${what}: ${got} vs ${exact} (${got / exact - 1})`);
    const [rep] = o.fillet;
    assert.ok(rep.contactMM <= 2.5e-7 && rep.normalDeg < 1e-3 && rep.sectionMM <= 1e-6, JSON.stringify(rep));
  }
});

test('R10.5 a concave foot (a step\'s riser) from 1 to 4 linearly: the added volume (1 − π/4) L (r0² + r0 r1 + r1²) / 3 to 1e-9', () => {
  const step = [...box, { id: 'q', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 15] }, { id: 'f0', kind: 'extrude', sketch: 'q', height: 10, from: 10 }, { id: 'u', kind: 'union', target: 'e', tool: 'f0' }];
  const o0 = out(step), v0 = o0.massProperties(1).volumeMM3, inner = at(o0.brep, 15, 10);
  const o = out([...step, { id: 'f', kind: 'fillet', target: 'u', edges: [inner], radii: [{ at: [0, 15, 10], radius: 1 }, { at: [40, 15, 10], radius: 4 }] }]);
  assert.equal(o.validate().valid, true);
  const got = o.massProperties(1).volumeMM3 - v0, exact = (1 - Math.PI / 4) * 40 * (1 + 4 + 16) / 3;
  assert.ok(Math.abs(got / exact - 1) < 1e-9, `${got} vs ${exact} (${got / exact - 1})`);
});

test('R10.5 a boss\'s foot (a closed circle) at 1, 2, 1, 2 round it (and 0.5, 3): periodic, each quarter a smoothstep (the monotone slopes vanish where the values alternate) — ∫ of the meridian section\'s first moment dθ to 1e-7', () => {
  const R = 8, boss = [{ id: 'as', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'a', kind: 'extrude', sketch: 'as', height: 10 },
    { id: 'bs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: R }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 15, from: 10 }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }];
  const o0 = out(boss), v0 = o0.massProperties(1).volumeMM3, foot = o0.brep.edges.filter(e => /a\.top/.test(e.name) && /b\.side0/.test(e.name)).map(e => e.name);
  // The meridian section: the square [R, R + r] × [0, r] less the quarter disc about (R + r, r); its first moment about the axis.
  const M = r => r * r * (R + r / 2) - Math.PI * r * r / 4 * (R + r - 4 * r / (3 * Math.PI));
  for (const [ra, rb] of [[1, 2], [0.5, 3]]) {
    const radii = [0, 1, 2, 3].map(k => ({ at: [R * Math.cos(k * Math.PI / 2), R * Math.sin(k * Math.PI / 2), 10], radius: k % 2 ? rb : ra }));
    const o = out([...boss, { id: 'f', kind: 'fillet', target: 'u', edges: foot, radii }]);
    assert.equal(o.validate().valid, true);
    let exact = 0; const n = 400000;
    for (let i = 0; i < n; i++) { const q = 4 * (i + 0.5) / n, k = Math.floor(q), t = q - k, y0 = k % 2 ? rb : ra, y1 = k % 2 ? ra : rb; exact += M(y0 + (y1 - y0) * (3 * t * t - 2 * t ** 3)) * 2 * Math.PI / n; }
    const got = o.massProperties(1).volumeMM3 - v0;
    assert.ok(Math.abs(got / exact - 1) < 1e-7, `${ra}/${rb}: ${got} vs ${exact} (${got / exact - 1})`);
    assert.ok(o.fillet[0].normalDeg < 1e-3, JSON.stringify(o.fillet[0]));
  }
});

test('R10.5 on curved faces (an oblique groove\'s rim, ellipse arcs between a plate and a cylinder) from 0.6 to 1.2: valid, G1, the report in bounds, its volume within 1e-6 of a loft through twice the stations, between the constant fillets at its two radii', () => {
  const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
  const body = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [8, -20], max: [32, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 },
    { id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 4, plane: yz }, { id: 'c0', kind: 'extrude', sketch: 'cs', height: 60, from: -10 },
    { id: 'c', kind: 'rotate', target: 'c0', axis: 'y', angleDegrees: 10, pivot: [20, 0, 10] }, { id: 'g', kind: 'difference', target: 'pe', tool: 'c' }];
  // (The rim is two edges, its halves either side of the cylinder's seam; the radii at its two ends.)
  const o0 = out(body), v0 = o0.massProperties(1).volumeMM3, rims = o0.brep.edges.filter(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name) && e.curve.controlPoints[0][1] > 0);
  const pts = rims.flatMap(e => [e.curve.controlPoints[0], e.curve.controlPoints.at(-1)]), ends = pts.filter(p => pts.filter(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-9).length === 1).sort((a, b) => a[0] - b[0]);
  assert.equal(ends.length, 2);
  const rim = { name: rims.map(e => e.name) }, radii = [{ at: ends[0], radius: 0.6 }, { at: ends[1], radius: 1.2 }];
  const o = out([...body, { id: 'f', kind: 'fillet', target: 'g', edges: rim.name, radii }]);
  assert.equal(o.validate().valid, true);
  const [rep] = o.fillet, removed = v0 - o.massProperties(1).volumeMM3;
  assert.ok(rep.contactMM <= 2.5e-7 && rep.normalDeg < 1e-3 && rep.sectionMM <= 2e-6 && rep.ballMM < 1e-8, JSON.stringify(rep));
  setRingStations(2 * rep.stations);
  // (To 1e-6 of the fillet since D102: no sliver of the run past is left at the trimmed end at any count.)
  try { const fine = v0 - out([...body, { id: 'f', kind: 'fillet', target: 'g', edges: rim.name, radii }]).massProperties(1).volumeMM3; assert.ok(Math.abs(fine / removed - 1) < 1e-6, `${removed} vs ${fine}`); }
  finally { setRingStations(null); }
  // (Between the constant fillets at its two radii.)
  const at = r => v0 - out([...body, { id: 'f', kind: 'fillet', target: 'g', edges: rim.name, radius: r }]).massProperties(1).volumeMM3;
  assert.ok(removed > at(0.6) && removed < at(1.2), `${at(0.6)} < ${removed} < ${at(1.2)}`);
});

test('R10.5 refusals: a radius point off the edges (SELECTION), radius and radii both (INPUT), one point (INPUT), a chain rolling round an edge at a corner (a box boss\'s foot, CAPABILITY)', () => {
  const o0 = out(box), edge = at(o0.brep, 0, 10);
  assert.throws(() => out([...box, { id: 'f', kind: 'fillet', target: 'e', edges: [edge], radii: [{ at: [0, 0, 10], radius: 1 }, { at: [40, 1, 10], radius: 2 }] }]), e => e.code === 'SELECTION' && /off the chain|lies on none/.test(e.message));
  assert.throws(() => out([...box, { id: 'f', kind: 'fillet', target: 'e', edges: [edge], radius: 2, radii: [{ at: [0, 0, 10], radius: 1 }, { at: [40, 0, 10], radius: 2 }] }]), e => e.code === 'INPUT' && /radius or radii/.test(e.message));
  assert.throws(() => out([...box, { id: 'f', kind: 'fillet', target: 'e', edges: [edge], radii: [{ at: [0, 0, 10], radius: 1 }] }]), e => e.code === 'INPUT' && /2 to 16/.test(e.message));
  const boss = [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 10 },
    { id: 'bs', kind: 'sketch', profile: 'rectangle', min: [-10, -6], max: [10, 6] }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 15, from: 10 }, { id: 'u', kind: 'union', target: 'p', tool: 'b' }];
  const foot = out(boss).brep.edges.filter(e => /p\.top/.test(e.name) && /b\.side/.test(e.name)).map(e => e.name);
  assert.throws(() => out([...boss, { id: 'f', kind: 'fillet', target: 'u', edges: foot, radii: [{ at: [-10, -6, 10], radius: 1 }, { at: [10, 6, 10], radius: 2 }] }]), e => e.code === 'CAPABILITY' && /variable-radius fillet where the ball rolls round an edge/.test(e.message));
});

test('D102 the same fillet at any station count (150–400): no sliver at the trimmed end (strict check), the same faces of the body, the same volume to 1e-9 — HEAD left a two-vertex lens at 175, 200 and 350 (1e-4 mm³ off); and the groove\'s two rims (mirror images) filleted 1 the same to 1e-11 of the part (HEAD: 2.8e-3 mm³ apart, a lens on one)', () => {
  const yz = { origin: [0, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
  const body = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [8, -20], max: [32, 20] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 10 },
    { id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 10], radius: 4, plane: yz }, { id: 'c0', kind: 'extrude', sketch: 'cs', height: 60, from: -10 },
    { id: 'c', kind: 'rotate', target: 'c0', axis: 'y', angleDegrees: 10, pivot: [20, 0, 10] }, { id: 'g', kind: 'difference', target: 'pe', tool: 'c' }];
  const rims = out(body).brep.edges.filter(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name) && e.curve.controlPoints[0][1] > 0);
  const pts = rims.flatMap(e => [e.curve.controlPoints[0], e.curve.controlPoints.at(-1)]), ends = pts.filter(p => pts.filter(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-9).length === 1).sort((a, b) => a[0] - b[0]);
  const fil = { id: 'f', kind: 'fillet', target: 'g', edges: rims.map(e => e.name), radii: [{ at: ends[0], radius: 0.6 }, { at: ends[1], radius: 1.2 }] };
  const runs = [150, 175, 200, 250, 300, 350, 400].map(N => {
    setRingStations(N);
    try { const o = out([...body, fil]); return { N, o, v: o.massProperties(1).volumeMM3, others: o.brep.faces.filter(f => !/^f\./.test(f.name)).map(f => f.name).sort().join(' ') }; }
    finally { setRingStations(null); }
  });
  for (const { N, o, v, others } of runs) {
    const check = checkBrep(o.brep, { strict: true });
    assert.equal(check.valid, true, `${N}: ${JSON.stringify(check.issues)}`);
    assert.equal(others, runs[0].others, `${N}: the body's own faces`);
    assert.ok(Math.abs(v / runs[0].v - 1) < 1e-9, `${N}: ${v} vs ${runs[0].v}`);
  }
  const both = out(body).brep.edges.filter(e => /c0\.side0/.test(e.name) && /pe\.top/.test(e.name));
  const [vp, vm] = [1, -1].map(side => { const o = out([...body, { id: 'f', kind: 'fillet', target: 'g', edges: [both.find(e => Math.sign(e.curve.controlPoints[0][1]) === side).name], radius: 1 }]); assert.equal(checkBrep(o.brep, { strict: true }).valid, true, `rim ${side}`); return o.massProperties(1).volumeMM3; });
  assert.ok(Math.abs(vp - vm) < 1e-11 * vp, `${vp} vs ${vm}`);
});
