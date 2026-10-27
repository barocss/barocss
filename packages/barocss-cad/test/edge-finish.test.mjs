import test from 'node:test';
import assert from 'node:assert/strict';
import { finishBrepEdges, revolveProfile, brepFromPrismatic, prismaticFromProfile, transformBrep, checkBrep, tessellateBrep, brepMassProperties, BrepError, evaluateCadPart, massPropertiesOf, checkOutput, surfaceAreaOf } from '../dist/index.js';
import { openEdgesByBody } from '../scripts/rb/stages.mjs';

const pi = Math.PI, corner = r => r * r * (1 - pi / 4), k = (10 - 3 * pi) / (12 - 3 * pi);
const rect = (x0, y0, x1, y1) => [{ kind: 'line', start: [x0, y0] }, { kind: 'line', start: [x1, y0] }, { kind: 'line', start: [x1, y1] }, { kind: 'line', start: [x0, y1] }];
const prism = (outer, h, tag) => brepFromPrismatic(prismaticFromProfile({ outer, height: h, tag }), { id: tag });
const volume = b => brepMassProperties(b, 1, { segmentsPerQuarter: 48 }).volume;
const near = (a, b, rel) => Math.abs(a - b) <= rel * Math.abs(b);
function watertight(b) {
  const m = tessellateBrep(b, { segmentsPerQuarter: 16 }), p = m.positions, ix = m.indices, he = new Map(), key = i => p[i * 3] + ',' + p[i * 3 + 1] + ',' + p[i * 3 + 2];
  for (let t = 0; t < ix.length; t += 3) for (let e = 0; e < 3; e++) { const s = key(ix[t + e]) + '>' + key(ix[t + (e + 1) % 3]); he.set(s, (he.get(s) ?? 0) + 1); }
  return [...he].every(([s, n]) => { const [x, y] = s.split('>'); return he.get(y + '>' + x) === n; });
}

test('fillets meeting at the corners of a box top form mitres (checked against a direct grid count)', () => {
  const box = prism(rect(0, 0, 20, 10), 5, 'e');
  // Inside test of the finished box: outside a fillet's cylinder within its corner wedge is removed.
  const inside = (x, y, z, r, which) => {
    if (x < 0 || x > 20 || y < 0 || y > 10 || z < 0 || z > 5) return false;
    const cut = (d1, d2) => d1 < r && d2 < r && (r - d1) ** 2 + (r - d2) ** 2 > r * r, dz = 5 - z;
    return !((which.includes(0) && cut(y, dz)) || (which.includes(1) && cut(20 - x, dz)) || (which.includes(2) && cut(10 - y, dz)) || (which.includes(3) && cut(x, dz)));
  };
  const edge = i => `e.side${i}|e.top`;
  for (const [which, r] of [[[0, 1], 2], [[0, 1, 2, 3], 1], [[0, 1, 2, 3], 2]]) {
    const out = finishBrepEdges(box, which.map(edge), r, 'fillet', 'f'), report = checkBrep(out);
    assert.equal(report.valid, true, `${which}: ${report.issues}`);
    assert.ok(watertight(out), `${which}: watertight`);
    let removed = 0; const M = 400, hx = 20 / M, hy = 10 / (M / 2), hz = r / 60;
    for (let a = 0; a < M; a++) for (let b = 0; b < M / 2; b++) for (let c = 0; c < 60; c++) if (!inside((a + .5) * hx, (b + .5) * hy, 5 - r + (c + .5) * hz, r, which)) removed++;
    const reference = 1000 - removed * hx * hy * hz;
    assert.ok(near(volume(out), reference, 3e-4), `${which} r${r}: ${volume(out)} vs ${reference}`);
  }
});

test('concave edges gain material; tangent chains are finished whole; what cannot be finished is refused', () => {
  // An L section stood up: its inside corner (concave) and an outside corner.
  const ell = transformBrep(prism([{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [30, 0] }, { kind: 'line', start: [30, 5] }, { kind: 'line', start: [5, 5] }, { kind: 'line', start: [5, 20] }, { kind: 'line', start: [0, 20] }], 10, 'e'), { matrix: [1, 0, 0, 0, 0, -1, 0, 1, 0] });
  const L = (30 * 5 + 5 * 15) * 10;
  for (const [edge, expected] of [['e.side2|e.side3', L + corner(3) * 10], ['e.side0|e.side1', L - corner(3) * 10]]) {
    const out = finishBrepEdges(ell, [edge], 3, 'fillet', 'f');
    assert.equal(checkBrep(out).valid, true, edge);
    assert.ok(near(volume(out), expected, 1e-4), `${edge}: ${volume(out)} vs ${expected}`);
  }
  // A slot's top rim: one straight edge names the whole loop (lines and arcs).
  const slot = prism([{ kind: 'line', start: [0, -4] }, { kind: 'arc', start: [20, -4], center: [20, 0], direction: 'ccw' }, { kind: 'line', start: [20, 4] }, { kind: 'arc', start: [0, 4], center: [0, 0], direction: 'ccw' }], 6, 'e');
  const rim = slot.edges.find(e => /side0/.test(e.name) && /top/.test(e.name)).name;
  const out = finishBrepEdges(slot, [rim], 1, 'fillet', 'f');
  assert.equal(checkBrep(out).valid, true);
  assert.ok(watertight(out));
  assert.ok(near(volume(out), (160 + 16 * pi) * 6 - corner(1) * 40 - 2 * pi * (4 - k) * corner(1), 1e-4), String(volume(out)));
  assert.ok(out.faces.filter(f => f.name.startsWith('f.face')).length >= 4, 'the rim is one fillet in four pieces');
  // Refusals.
  const refuses = (fn, pattern) => assert.throws(fn, e => e instanceof BrepError && pattern.test(e.message), pattern.source);
  refuses(() => finishBrepEdges(ell, ['nope'], 1, 'fillet', 'f'), /SELECTION: no edge named nope/);
  refuses(() => finishBrepEdges(slot, [slot.edges.find(e => /side0/.test(e.name) && /side1/.test(e.name)).name], 1, 'fillet', 'f'), /meet tangentially/);
});

test('three fillets meeting at a corner round it with a sphere; all twelve edges of a box give the rounded box', () => {
  const box = prism(rect(0, 0, 20, 10), 6, 'e');
  const rounded = (a, b, c, r) => (a - 2 * r) * (b - 2 * r) * (c - 2 * r) + 2 * r * ((a - 2 * r) * (b - 2 * r) + (b - 2 * r) * (c - 2 * r) + (a - 2 * r) * (c - 2 * r)) + pi * r * r * (a + b + c - 6 * r) + 4 / 3 * pi * r ** 3;
  // One corner (x = 20, y = 0, z = 6): its three edges. The corner cube by grid, the edge strips exactly.
  const r = 2, inside = (x, y, z) => {
    const dx = 20 - x, dy = y, dz = 6 - z;
    if (dx < r && dy < r && dz < r) return (r - dx) ** 2 + (r - dy) ** 2 + (r - dz) ** 2 <= r * r;
    const cut = (a, b) => a < r && b < r && (r - a) ** 2 + (r - b) ** 2 > r * r;
    return !(cut(dy, dz) || cut(dx, dz) || cut(dx, dy));
  };
  let removed = 0; const n = 160, h = 1.5 * r / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) if (!inside(20 - (i + .5) * h, (j + .5) * h, 6 - (k + .5) * h)) removed++;
  const expected = 1200 - removed * h ** 3 - corner(r) * ((20 - 1.5 * r) + (10 - 1.5 * r) + (6 - 1.5 * r));
  const one = finishBrepEdges(box, ['e.side0|e.top', 'e.side1|e.top', 'e.side0|e.side1'], r, 'fillet', 'f');
  assert.equal(checkBrep(one).valid, true);
  assert.ok(watertight(one));
  assert.ok(near(volume(one), expected, 1e-4), `${volume(one)} vs ${expected}`);
  assert.ok(one.faces.some(f => f.name.startsWith('f.face') && f.surface.degreeU === 2 && f.surface.degreeV === 2), 'a spherical corner face');
  const all = finishBrepEdges(box, box.edges.map(e => e.name), 1, 'fillet', 'f');
  assert.equal(checkBrep(all).valid, true);
  assert.ok(watertight(all));
  assert.ok(near(volume(all), rounded(20, 10, 6, 1), 1e-4), String(volume(all)));
  assert.equal(all.faces.length, 6 + 12 + 16, 'six flats, twelve cylinders, eight corner spheres (two halves each)');
});

test('every edge of a box filleted: strictly valid, watertight, volume and area within 5e-5 of the rounded box for radii up to half the shortest edge', () => {
  // The rounded a × b × c box: the inner box, its faces pushed out by r, quarter-cylinders along the edges, a ball's eighth at each corner.
  const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f }), a = 40, b = 30, c = 10, pi = Math.PI;
  const box = [{ id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [a, b] }, { id: 'e', kind: 'extrude', sketch: 's', height: c }];
  const edges = evaluateCadPart(D(box)).outputs[0].brep.edges.map(e => e.name);
  for (const r of [0.5, 2, 4.9]) {
    const A = a - 2 * r, B = b - 2 * r, C = c - 2 * r;
    const volume = A * B * C + 2 * r * (A * B + B * C + A * C) + pi * r * r * (A + B + C) + 4 / 3 * pi * r ** 3, area = 2 * (A * B + B * C + A * C) + 2 * pi * r * (A + B + C) + 4 * pi * r * r;
    const o = evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges, radius: r }])).outputs[0], m = massPropertiesOf(o), v = checkOutput(o);
    assert.equal(v.valid, true, `r ${r}: ${v.issues[0]}`); assert.ok(v.maximumEdgeSurfaceGap < 1e-8);
    assert.equal(openEdgesByBody(o.brep, tessellateBrep(o.brep, { segmentsPerQuarter: 8 })), 0, `r ${r} watertight`);
    // (The corner patches hold their ball's pole, where the quadrature over their trimmed domains is least
    // accurate: 5e-5, shrinking with finer quadrature; the geometry itself is exact to 1e-9.)
    assert.ok(Math.abs(m.volume - volume) <= 5e-5 * volume, `r ${r} volume ${m.volume} vs ${volume}`);
    assert.ok(Math.abs(surfaceAreaOf(o) - area) <= 5e-5 * area, `r ${r} area ${surfaceAreaOf(o)} vs ${area}`);
    m.centroid.forEach((x, k) => assert.ok(Math.abs(x - [a / 2, b / 2, c / 2][k]) < 5e-4, `r ${r} centroid ${m.centroid}`));
  }
});


// The meridian uses a 3-4-5 generator: the unit direction into the cone is (3/5,-4/5).
const coneTopFrustum = (bottom = 8, top = 5, height = 4, angle = 360) => revolveProfile({
  id: 'cone', profile: [[0, 0], [bottom, 0], [top, height], [0, height]].map(start => ({ kind: 'line', start })),
  axis: { origin: [0, 0], direction: [0, 1] }, angle,
});
const circularRimsAtY = (body, y) => body.edges.filter(e => e.curve.degree === 2 && e.curve.controlPoints.every(p => p[1] === y));

test('cone top chamfer: one selected half-rim finishes the full circle with independent Pappus mass', () => {
  const body = coneTopFrustum(), before = structuredClone(body), rims = circularRimsAtY(body, 4);
  assert.equal(rims.length, 2, 'the authored complete circle has two half-rim edges');
  // d=1 along both faces removes the meridian triangle (5,4),(4,4),(28/5,16/5).
  // Its area is 2/5 and radial centroid is 73/15. Pappus gives Vremoved=292*pi/75.
  // The frustum has V=172*pi and first Y moment 292*pi; removed first Y moment=1812*pi/125.
  const expectedVolume = 12608 * pi / 75, expectedY = 1626 / 985;
  for (const selected of [[rims[0].name], [rims[1].name]]) {
    const out = finishBrepEdges(body, selected, 1, 'chamfer', 'c'), report = checkBrep(out, { strict: true }), m = brepMassProperties(out, 1);
    assert.equal(report.valid, true, JSON.stringify(report.issues));
    assert.equal(out.bodies.length, 1); assert.equal(out.bodies[0].kind, 'solid');
    assert.equal(out.shells.length, 1); assert.equal(out.shells[0].closed, true);
    assert.ok(watertight(out));
    assert.ok(near(m.volume, expectedVolume, 1e-9), `${m.volume} vs ${expectedVolume}`);
    assert.ok(near(m.mass, expectedVolume / 1000, 1e-9));
    m.centroid.forEach((x, i) => assert.ok(Math.abs(x - [0, expectedY, 0][i]) <= 1e-9, `centroid ${m.centroid}`));
    const baseName = name => name.replace(/#\d+$/, '');
    assert.equal(out.faces.filter(f => baseName(f.name) === 'c.face').length, 2, 'both halves have the requested finishing name');
    const names = new Set(body.faces.map(f => baseName(f.name)));
    assert.ok(out.faces.every(f => names.has(baseName(f.name)) || baseName(f.name) === 'c.face'), 'only source faces and the chamfer remain');
    assert.ok(out.faces.every(f => !f.name.includes('.tool')), 'no grown tool wall remains');
    assert.deepEqual(body, before, 'finishing preserves the source B-rep');
  }
});

test('cone top chamfer: partial rims, bottom and concave rims, and distances at the support limits have exact typed refusals', () => {
  const scope = (body, y, distance, radius) => {
    const edge = circularRimsAtY(body, y).find(e => radius === undefined || Math.abs(Math.hypot(e.curve.controlPoints[0][0], e.curve.controlPoints[0][2]) - radius) <= 1e-9); assert.ok(edge);
    const before = structuredClone(body);
    assert.throws(() => finishBrepEdges(body, [edge.name], distance, 'chamfer', 'c'),
      e => e instanceof BrepError && e.code === 'GEOMETRY' && e.message === `B-rep: CAPABILITY: [CONE_TOP_CHAMFER_SCOPE] edge ${edge.name}: only a convex full-circle small-cap rim of one solid conical frustum is supported`);
    assert.deepEqual(body, before);
  };
  const size = (body, distance) => {
    const edge = circularRimsAtY(body, 4)[0], before = structuredClone(body);
    assert.throws(() => finishBrepEdges(body, [edge.name], distance, 'chamfer', 'c'),
      e => e instanceof BrepError && e.code === 'INPUT' && e.message === `B-rep: PARAMETER: [CONE_TOP_CHAMFER_SIZE] edge ${edge.name}: the distance must stay strictly inside both faces and away from the axis`);
    assert.deepEqual(body, before);
  };
  scope(coneTopFrustum(8, 5, 4, 180), 4, 1);
  scope(coneTopFrustum(), 0, 1);
  // At (r,y)=(6,1), the stepped cone has a reflex material corner and also exceeds the simple-frustum scope.
  const concave = revolveProfile({ id: 'concave', profile: [[0, 0], [8, 0], [8, 1], [6, 1], [4, 4], [0, 4]].map(start => ({ kind: 'line', start })), axis: { origin: [0, 0], direction: [0, 1] }, angle: 360 });
  scope(concave, 1, 1, 6);
  for (const distance of [0, -1, NaN, Infinity]) size(coneTopFrustum(), distance);
  size(coneTopFrustum(), 5); // The cap contact reaches the axis.
  size(coneTopFrustum(9, 6), 5); // The cone contact reaches the bottom cap before the axis.
});

test('cone top chamfer: the existing plane-cylinder and box chamfer paths retain analytic mass', () => {
  const cylinder = revolveProfile({ id: 'cylinder', profile: rect(0, 0, 5, 4), axis: { origin: [0, 0], direction: [0, 1] }, angle: 360 });
  const rim = circularRimsAtY(cylinder, 4)[0], cylinderBefore = structuredClone(cylinder);
  const round = finishBrepEdges(cylinder, [rim.name], 1, 'chamfer', 'c');
  assert.equal(checkBrep(round, { strict: true }).valid, true); assert.ok(watertight(round));
  // A right triangle of area 1/2 at radial centroid 5-1/3 revolves off the cylinder.
  assert.ok(near(volume(round), 100 * pi - 14 * pi / 3, 1e-9));
  assert.deepEqual(cylinder, cylinderBefore);
  const box = prism(rect(0, 0, 20, 10), 5, 'e'), boxBefore = structuredClone(box);
  const flat = finishBrepEdges(box, ['e.side0|e.top'], 1, 'chamfer', 'c');
  assert.equal(checkBrep(flat, { strict: true }).valid, true); assert.ok(watertight(flat));
  assert.ok(near(volume(flat), 1000 - 20 / 2, 1e-9));
  assert.deepEqual(box, boxBefore);
});
