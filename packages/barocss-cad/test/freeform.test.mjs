import test from 'node:test';
import assert from 'node:assert/strict';
import { revolveProfile, revolveMassProperties, booleanAnalytic, brepFromPrismatic, prismaticFromProfile, transformBrep, checkBrep, tessellateBrep, brepMassProperties, evaluateCadPart, BrepError } from '../dist/index.js';

const pi = Math.PI;
const rect = (x0, y0, x1, y1) => [{ kind: 'line', start: [x0, y0] }, { kind: 'line', start: [x1, y0] }, { kind: 'line', start: [x1, y1] }, { kind: 'line', start: [x0, y1] }];
const circle = (cx, cy, r) => [{ kind: 'arc', start: [cx + r, cy], center: [cx, cy], direction: 'ccw' }];
const prism = (outer, z0, z1, id) => brepFromPrismatic(prismaticFromProfile({ outer, heightMM: z1 - z0, fromMM: z0, tag: id }), { id });
const box = (a, b, id = 'b') => prism(rect(a[0], a[1], b[0], b[1]), a[2], b[2], id);
const yAxis = { origin: [0, 0], direction: [0, 1] };
/** Torus about the y axis: tube radius 2 about the circle of radius 6 in the xz plane. */
const torus = (id = 't') => revolveProfile({ id, profile: circle(6, 0, 2), axis: yAxis, angleDegrees: 360 });
const TORUS = 2 * pi * pi * 6 * 4;
const sphere = (R = 5) => revolveProfile({ id: 's', profile: [{ kind: 'arc', start: [0, -R], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, R] }], axis: yAxis, angleDegrees: 360 });
const cap = (R, h) => pi * h * h * (3 * R - h) / 3;
/** Ring cone: the triangle (2, 0), (6, 0), (2, 6) about the y axis. */
const cone = () => revolveProfile({ id: 'k', profile: [{ kind: 'line', start: [2, 0] }, { kind: 'line', start: [6, 0] }, { kind: 'line', start: [2, 6] }], axis: yAxis, angleDegrees: 360 });
function mesh(brep, q) {
  const m = tessellateBrep(brep, { segmentsPerQuarter: q }), p = m.positionsMM, ix = m.indices, he = new Map(), key = i => p[i * 3] + ',' + p[i * 3 + 1] + ',' + p[i * 3 + 2];
  let volume = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
    volume += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
    for (let e = 0; e < 3; e++) { const k = key(ix[t + e]) + '>' + key(ix[t + (e + 1) % 3]); he.set(k, (he.get(k) ?? 0) + 1); }
  }
  return { volume, triangles: ix.length / 3, watertight: [...he].every(([k, n]) => { const [x, y] = k.split('>'); return he.get(y + '>' + x) === n; }) };
}
const near = (a, b, rel) => Math.abs(a - b) <= rel * Math.abs(b);
/** The torus volume with z > z0 (x-extent and z integrated in closed form, y by quadrature in y = 2 sin θ). */
function torusAbove(z0, n = 800) {
  const F = (c, z) => z <= -c ? -c * c * pi / 4 : z >= c ? c * c * pi / 4 : (z * Math.sqrt(c * c - z * z) + c * c * Math.asin(z / c)) / 2;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const th = -pi / 2 + pi * (i + 0.5) / n, y = 2 * Math.sin(th), w = Math.sqrt(4 - y * y), a = 6 - w, b = 6 + w;
    v += 2 * ((F(b, b) - F(b, z0)) - (F(a, a) - F(a, z0))) * 2 * Math.cos(th) * pi / n;
  }
  return v;
}

test('revolved solids: exact rational surfaces, closed-form mass, watertight regular meshes', () => {
  const cases = [
    ['torus', torus(), TORUS],
    ['ring cone', cone(), pi * 1.5 * (160 / 3)],
    ['tube (rectangle, cylinders and annuli)', revolveProfile({ id: 'r', profile: rect(2, 0, 6, 4), axis: yAxis, angleDegrees: 360 }), pi * 32 * 4],
    ['half torus', revolveProfile({ id: 'h', profile: circle(6, 0, 2), axis: yAxis, angleDegrees: 180 }), TORUS / 2],
    ['270° cone', revolveProfile({ id: 'c', profile: [{ kind: 'line', start: [2, 0] }, { kind: 'line', start: [6, 0] }, { kind: 'line', start: [2, 6] }], axis: yAxis, angleDegrees: 270 }), pi * 1.5 * (160 / 3) * 0.75],
    ['sphere (poles)', sphere(), 4 / 3 * pi * 125],
    ['sphere wedge (poles shared by the caps)', revolveProfile({ id: 'w', profile: [{ kind: 'arc', start: [0, -5], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, 5] }], axis: yAxis, angleDegrees: 90 }), pi * 125 / 3],
    ['solid cone (a tip)', revolveProfile({ id: 'k', profile: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [4, 0] }, { kind: 'line', start: [0, 6] }], axis: yAxis, angleDegrees: 360 }), pi * 16 * 2],
    ['solid cylinder (discs)', revolveProfile({ id: 'd', profile: rect(0, 0, 3, 5), axis: yAxis, angleDegrees: 360 }), pi * 45],
    ['pinched wedge, partial turn', revolveProfile({ id: 'p', profile: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [4, 2] }, { kind: 'line', start: [4, 6] }], axis: yAxis, angleDegrees: 90 }), null],
    ['axis along x, offset origin', revolveProfile({ id: 'x', profile: rect(0, 3, 5, 4), axis: { origin: [0, 1], direction: [1, 0] }, angleDegrees: 90 }), pi * (9 - 4) * 5 / 4],
  ];
  for (const [name, brep, expected] of cases) {
    const report = checkBrep(brep);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.ok(brep.faces.every(f => f.name), `${name}: named faces`);
    const m = mesh(brep, 32);
    assert.ok(m.watertight, `${name}: watertight`);
    if (expected !== null) assert.ok(near(m.volume, expected, 2e-3), `${name}: mesh ${m.volume} vs ${expected}`);
  }
  const pinch = { profile: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [4, 2] }, { kind: 'line', start: [4, 6] }], axis: yAxis, angleDegrees: 90 };
  assert.ok(near(mesh(revolveProfile(pinch), 32).volume, revolveMassProperties(pinch, 1000).volumeMM3, 2e-3));
  // A cone tip needs no refinement: its normal there depends on the direction it is approached from.
  assert.ok(mesh(revolveProfile({ profile: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [4, 0] }, { kind: 'line', start: [0, 6] }], axis: yAxis, angleDegrees: 360 }), 32).triangles < 1000);
  const input = { id: 't', profile: circle(6, 0, 2), axis: yAxis, angleDegrees: 360 };
  const mass = revolveMassProperties(input, 1000);
  assert.ok(near(mass.volumeMM3, TORUS, 1e-12), `closed-form torus volume ${mass.volumeMM3}`);
  // A torus tessellates as a regular grid: 2 × 64 × 64 triangles at 16 segments per quarter.
  assert.equal(mesh(torus(), 16).triangles, 8192);
  // The profile may not cross the axis, touch it inside a segment, or pinch a full turn to a point.
  assert.throws(() => revolveProfile({ profile: rect(-2, 0, 4, 4), axis: yAxis, angleDegrees: 360 }), e => e instanceof BrepError && /crosses the axis/.test(e.message));
  assert.throws(() => revolveProfile({ profile: [{ kind: 'arc', start: [2, 5], center: [2, 3], direction: 'ccw' }], axis: yAxis, angleDegrees: 360 }), e => e instanceof BrepError && /touches the axis between its vertices/.test(e.message));
  assert.throws(() => revolveProfile({ profile: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [4, 2] }, { kind: 'line', start: [4, 6] }], axis: yAxis, angleDegrees: 360 }), e => e instanceof BrepError && /pinch/.test(e.message));
  assert.throws(() => revolveProfile({ profile: rect(2, 0, 4, 4), axis: yAxis, angleDegrees: 0 }), e => e instanceof BrepError && /angle/.test(e.message));
});

test('freeform Booleans: tori and cones against planes, cylinders and each other', () => {
  const slab = 2 * (4 * Math.asin(0.5) + Math.sqrt(3)); // the tube section with |y| < 1
  const w = x => x ** 3 / 3 - 4 * x;
  const tilted = transformBrep(torus('w'), { matrix: [0.8, -0.6, 0, 0.6, 0.8, 0, 0, 0, 1], offset: [0.5, 0.3, 0] });
  const crossed = transformBrep(torus('u'), { matrix: [1, 0, 0, 0, 0, -1, 0, 1, 0], offset: [3, 0, 0.4] });
  const crossedIn = (x, y, z) => (Math.hypot(x - 3, y) - 6) ** 2 + (z - 0.4) ** 2 <= 4;
  const coneIn = (x, y, z) => { const r = Math.hypot(x, z); return y >= 0 && r >= 2 && r <= 6 - 2 * y / 3; };
  const tiltedIn = (x, y, z) => { const X = x - 0.5, Y = y - 0.3; return (Math.hypot(0.8 * X + 0.6 * Y, z) - 6) ** 2 + (-0.6 * X + 0.8 * Y) ** 2 <= 4; };
  // Volumes are of the 32-per-quarter tessellation (discretisation error about 1e-3).
  /** Grid reference over [-9, 11] × [-9, 9] × [-9, 9] (accurate to a few tenths of a percent). */
  const grid = (inside, n = 160) => { const lo = [-9, -9, -9], hi = [11, 9, 9], d = [0, 1, 2].map(k => (hi[k] - lo[k]) / n); let v = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) if (inside(lo[0] + (i + 0.5) * d[0], lo[1] + (j + 0.5) * d[1], lo[2] + (k + 0.5) * d[2])) v++;
    return v * d[0] * d[1] * d[2]; };
  const cases = [
    ['torus ∩ slab across the axis (circles)', torus(), box([-20, -1, -20], [20, 1, 20]), 'intersection', 2 * pi * 6 * slab, 2e-3, 1],
    ['torus − slab: two rings', torus(), box([-20, -1, -20], [20, 1, 20]), 'difference', TORUS - 2 * pi * 6 * slab, 2e-3, 2],
    ['torus ∩ half space along the axis (ovals)', torus(), box([-20, -20, 1], [20, 20, 20]), 'intersection', torusAbove(1), 1e-3, 1],
    ['torus − box', torus(), box([5, -10, -10], [10, 10, 10]), 'difference', TORUS - torusAbove(5), 1e-3, 1],
    ['torus ∩ half space at its seam plane (edges in the cutting plane)', torus(), box([-20, -20, 0], [20, 20, 20]), 'intersection', TORUS / 2, 2e-3, 1],
    ['torus ∩ half space at its equator seams', torus(), box([-20, 0, -20], [20, 20, 20]), 'intersection', TORUS / 2, 2e-3, 1],
    ['torus − cylinder along z (a channel)', torus(), prism(circle(6, 0, 1), -10, 10, 'c'), 'difference', null, 0, 1],
    ['cone − slot box', cone(), box([-10, -1, -10], [10, 1, 10]), 'difference', pi * 1.5 * (w(16 / 3) - w(2)), 1e-3, 1],
    ['cone − tilted torus (general × general)', cone(), tilted, 'difference', grid((x, y, z) => coneIn(x, y, z) && !tiltedIn(x, y, z)), 5e-3, 1],
    ['torus ∩ crossed torus', torus(), crossed, 'intersection', null, 0, 2],
    ['sphere ∩ half space (a cap off the poles)', sphere(), box([-9, -9, 2], [9, 9, 9]), 'intersection', cap(5, 3), 2e-3, 1],
    ['sphere − half space (a cap at a pole)', sphere(), box([-9, 2, -9], [9, 9, 9]), 'difference', 4 / 3 * pi * 125 - cap(5, 3), 2e-3, 1],
    ['sphere − bore through both poles (napkin ring)', sphere(), transformBrep(prism(circle(0, 0, 1.5), -9, 9, 'c'), { matrix: [0, 1, 0, 0, 0, 1, 1, 0, 0] }), 'difference', pi / 6 * (2 * Math.sqrt(25 - 2.25)) ** 3, 2e-3, 1],
    ['box ∪ sphere sunk into it', box([-6, -8, -6], [6, -3, 6]), sphere(), 'union', 720 + 4 / 3 * pi * 125 - cap(5, 2), 2e-3, 1],
    ['solid cone with its tip cut off', revolveProfile({ id: 'k', profile: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [4, 0] }, { kind: 'line', start: [0, 6] }], axis: yAxis, angleDegrees: 360 }), box([-9, 3, -9], [9, 9, 9]), 'difference', pi * 16 * 2 - pi * 4, 2e-3, 1],
    ['torus ∪ crossed torus', torus(), crossed, 'union', grid((x, y, z) => (Math.hypot(x, z) - 6) ** 2 + y * y <= 4 || crossedIn(x, y, z)), 5e-3, 1],
  ];
  const volumes = new Map();
  for (const [name, a, b, op, expected, rel, shells] of cases) {
    const r = booleanAnalytic(a, b, op), report = checkBrep(r);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.equal(report.topology.length, shells, `${name}: ${report.topology.length} bodies`);
    const m = mesh(r, 16), v = brepMassProperties(r, 1000, { segmentsPerQuarter: 32 }).volumeMM3;
    assert.ok(m.watertight, `${name}: watertight`);
    if (expected !== null) assert.ok(near(v, expected, rel), `${name}: ${v} vs ${expected}`);
    volumes.set(name, v);
  }
  // Union and intersection of the crossed tori add up to both tori.
  assert.ok(near(volumes.get('torus ∪ crossed torus') + volumes.get('torus ∩ crossed torus'), 2 * TORUS, 2e-3));
  // Seams of the two inputs crossing in one plane (edges of both meeting the intersection at one point).
  const seams = transformBrep(torus('u'), { matrix: [1, 0, 0, 0, 0, -1, 0, 1, 0], offset: [3, 0, 0] }), vol = {};
  for (const op of ['intersection', 'difference', 'union']) {
    const r = booleanAnalytic(torus(), seams, op), report = checkBrep(r);
    assert.equal(report.valid, true, `seams crossing, ${op}: ${report.issues}`);
    assert.ok(mesh(r, 16).watertight, `seams crossing, ${op}: watertight`);
    vol[op] = brepMassProperties(r, 1000, { segmentsPerQuarter: 32 }).volumeMM3;
  }
  assert.ok(near(vol.intersection + vol.difference, TORUS, 2e-3) && near(vol.intersection + vol.union, 2 * TORUS, 2e-3), JSON.stringify(vol));
});

test('part model: a revolved body is curved, keeps its closed-form mass and takes Booleans', () => {
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const ring = { id: 's', kind: 'sketch', profile: 'circle', center: [6, 0], radius: 2 };
  const one = evaluateCadPart(D([ring, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }])).outputs[0];
  assert.equal(one.representation, 'curved');
  assert.ok(near(one.massProperties(1000).volumeMM3, TORUS, 1e-12));
  assert.equal(checkBrep(one.brep).valid, true);
  const cut = evaluateCadPart(D([ring, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } },
    { id: 'b', kind: 'sketch', profile: 'rectangle', min: [-10, -10], max: [10, 10] }, { id: 'e', kind: 'extrude', sketch: 'b', height: 10, from: 1 },
    { id: 'd', kind: 'difference', target: 'r', tool: 'e' }])).output('d');
  assert.equal(checkBrep(cut.brep).valid, true);
  assert.ok(near(cut.massProperties(1000).volumeMM3, TORUS - torusAbove(1), 2e-3), `${cut.massProperties(1000).volumeMM3}`);
  assert.ok(cut.brep.faces.some(f => f.name.startsWith('r.side')) && cut.brep.faces.some(f => f.name.startsWith('e.')), 'faces keep their feature names');
  const half = evaluateCadPart(D([ring, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 90 }])).outputs[0];
  assert.ok(near(half.massProperties(1000).volumeMM3, TORUS / 4, 1e-12));
});

test('cones against any plane: conic cuts in closed form (hyperbolas beside the axis, ellipses at an angle)', () => {
  const k = revolveProfile({ id: 'v', profile: [[0, 0], [12, 0], [4, 14], [0, 14]].map(p => ({ kind: 'line', start: p })), axis: yAxis, angleDegrees: 360 });
  const tilt = (b, deg) => { const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180); return transformBrep(b, { matrix: [1, 0, 0, 0, c, -s, 0, s, c], offset: [0, 4, 0] }); };
  const V = Math.PI * 14 / 3 * (144 + 48 + 16);
  for (const [name, B] of [['a box beside the axis', box([3, -5, -20], [20, 30, 20])], ['a slab tilted 30°', tilt(box([-30, -2, -30], [30, 2, 30]), 30)], ['a half space tilted 60°', tilt(box([-30, 0, -30], [30, 30, 30]), 60)]]) {
    const vol = op => { const r = booleanAnalytic(k, B, op), report = checkBrep(r); assert.equal(report.valid, true, `${name} ${op}: ${report.issues}`); return brepMassProperties(r, 1000, { segmentsPerQuarter: 32 }).volumeMM3; };
    const u = vol('union'), i = vol('intersection'), d = vol('difference'), vb = brepMassProperties(B, 1000).volumeMM3;
    // Volume identities, to the 32-per-quarter mesh's error.
    assert.ok(Math.abs(u + i - V - vb) < 2e-3 * V && Math.abs(d + i - V) < 2e-3 * V, `${name}: ${u} ${i} ${d}`);
  }
});

test('a plane turned off a cylinder\'s axis by rounding meets it in rulings (found by fuzzing)', () => {
  // A cylinder about Y and a box turned about Y: the box's sides are parallel to the axis but for
  // rounding; treated as an ellipse taller than the model, one ruling cut was lost.
  const r = 5.439361105673015, h = 3.6700852524954826;
  const cyl = transformBrep(revolveProfile({ id: 'v', profile: [[0, 0], [r, 0], [r, h], [0, h]].map(p => ({ kind: 'line', start: p })), axis: yAxis, angleDegrees: 360 }), { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [2.5, 2, 0] });
  const c = 0.851120938799842, s = 0.5249696634439706, turned = transformBrep(box([-2.5, -0.5, -5.5], [2, 3, 2]), { matrix: [c, 0, s, 0, 1, 0, -s, 0, c], offset: [0, 0, 0] });
  const V = Math.PI * r * r * h, VB = 4.5 * 3.5 * 7.5;
  const vol = op => { const out = booleanAnalytic(cyl, turned, op), report = checkBrep(out); assert.equal(report.valid, true, `${op}: ${report.issues}`); return brepMassProperties(out, 1000, { segmentsPerQuarter: 32 }).volumeMM3; };
  const u = vol('union'), i = vol('intersection'), d = vol('difference');
  assert.ok(Math.abs(u + i - V - VB) < 2e-3 * V && Math.abs(d + i - V) < 2e-3 * V, `${u} ${i} ${d}`);
});

test('a curve crossing between two faces is traced on both, short pieces by an edge included (found by fuzzing)', () => {
  // A cone and a tilted torus: their curve crosses the cone's seam just below its top, leaving a piece
  // 0.04 mm long on the other half that no grid seed reached; the crossing seeds it.
  const cone = transformBrep(revolveProfile({ id: 'k', profile: [[0, 0], [5.068465637974441, 0], [5.760948109556921, 3.028882715385407], [0, 3.028882715385407]].map(p => ({ kind: 'line', start: p })), axis: yAxis, angleDegrees: 360 }), { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], offset: [0, 3, 1.5] });
  const ring = revolveProfile({ id: 't', profile: [{ kind: 'arc', start: [8.793091643601656, 0], center: [7.069483011960983, 0], direction: 'ccw' }], axis: yAxis, angleDegrees: 360 });
  const tilted = transformBrep(transformBrep(ring, { matrix: [0, 1, 0, 1, 0, 0, 0, 0, 1], offset: [-0.5, 1.5, -4] }), { matrix: [0.7330749320581729, -0.6801478839104811, 0, 0.6801478839104811, 0.7330749320581729, 0, 0, 0, 1], offset: [0, 0, 0] });
  const vol = op => { const out = booleanAnalytic(cone, tilted, op), report = checkBrep(out); assert.equal(report.valid, true, `${op}: ${report.issues}`); return brepMassProperties(out, 1000, { segmentsPerQuarter: 32 }).volumeMM3; };
  const u = vol('union'), i = vol('intersection'), d = vol('difference'), va = brepMassProperties(cone, 1000, { segmentsPerQuarter: 32 }).volumeMM3, vb = brepMassProperties(tilted, 1000, { segmentsPerQuarter: 32 }).volumeMM3;
  assert.ok(Math.abs(u + i - va - vb) < 2e-3 * vb && Math.abs(d + i - va) < 2e-3 * va, `${u} ${i} ${d}`);
});

test('freeform faces on one surface: copies, turned copies and overlapping partial turns', () => {
  const rotY = (b, deg) => { const c = Math.cos(deg * pi / 180), s = Math.sin(deg * pi / 180); return transformBrep(b, { matrix: [c, 0, s, 0, 1, 0, -s, 0, c] }); };
  const half = id => revolveProfile({ id, profile: circle(6, 0, 2), axis: yAxis, angleDegrees: 180 });
  const cases = [
    ['torus ∪ its copy', torus('a'), torus('b'), 'union', TORUS],
    ['torus ∩ its copy', torus('a'), torus('b'), 'intersection', TORUS],
    ['torus ∪ a copy turned about its axis', torus('a'), rotY(torus('b'), 30), 'union', TORUS],
    ['torus − a copy turned about its axis (nothing left)', torus('a'), rotY(torus('b'), 30), 'difference', 0],
    ['half tori overlapping by a quarter: union', half('a'), rotY(half('b'), -90), 'union', TORUS * 3 / 4],
    ['half tori overlapping by a quarter: intersection', half('a'), rotY(half('b'), -90), 'intersection', TORUS / 4],
    ['half tori overlapping by a quarter: difference', half('a'), rotY(half('b'), -90), 'difference', TORUS / 4],
    ['sphere ∪ a turned copy', sphere(), rotY(sphere(), 45), 'union', 4 / 3 * pi * 125],
  ];
  for (const [name, a, b, op, expected] of cases) {
    const r = booleanAnalytic(a, b, op), report = checkBrep(r);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    if (expected === 0) { assert.equal(r.faces.length, 0, name); continue; }
    assert.ok(mesh(r, 16).watertight, `${name}: watertight`);
    const v = brepMassProperties(r, 1000, { segmentsPerQuarter: 32 }).volumeMM3;
    assert.ok(near(v, expected, 2e-3), `${name}: ${v} vs ${expected}`);
  }
});
