// R7.3d prep (api-conventions §7): what createCadModel (`cad.model()`, src/modeling.ts) can model, made through
// @barocss/cad/api instead, case by case. Each case builds the same shape both ways and compares the results: volume
// and centroid from the old API's massProperties where it measures that family, else a closed form. The old API's own
// guard tests (input admission, provider isolation, its codec, its reuse of earlier work) have no counterpart here: they
// test that API itself, and retire with it. The map, and what has no facade equivalent, is in
// apps/cad-studio/handover/notes/api-facade-design.md ("createCadModel's tests, mapped").
import test from 'node:test';
import assert from 'node:assert/strict';
import { cad, evaluateCadPart } from '../dist/index.js';
import { part, sketch } from '../dist/api/index.js';

// (Volume and centroid: the old API's at 1 g/cm³, and the facade's.)
const old = (snapshot, name) => { const q = snapshot.massProperties(name, { densityKgPerM3: 1000 }); return { volume: q.volumeMM3, centroid: [...q.centroidMM] }; };
const now = p => { const q = p.mass({ density: 1 }); return { volume: q.volumeMM3, centroid: [...q.centroidMM] }; };
// (Two kernels' algorithms — the old one's exact convex and integer-cell solvers, the facade's B-rep — agree to rounding.)
const near = (a, b, what, centroidMM = 1e-9) => {
  const tol = 1e-9 * Math.max(1, Math.abs(a.volume));
  assert.ok(Math.abs(a.volume - b.volume) <= tol, `${what}: volume ${a.volume} vs ${b.volume}`);
  a.centroid.forEach((v, k) => assert.ok(Math.abs(v - b.centroid[k]) <= centroidMM, `${what}: centroid ${a.centroid} vs ${b.centroid}`));
};
// (The union of equal disjoint bodies: their volumes summed, their centroids averaged.)
const joined = parts => ({ volume: parts.reduce((s, p) => s + p.volume, 0), centroid: [0, 1, 2].map(k => parts.reduce((s, p) => s + p.centroid[k] * p.volume, 0) / parts.reduce((s, p) => s + p.volume, 0)) });
const rect = (m, min, max) => m.sketch.rectangle({ min, max });
// (The old API's recipes are bounded and terminal — one per model: each old shape is built in a model of its own.)
const one = make => { const m = cad.model(), shape = make(m); return old(m.build({ shape }), 'shape'); };
const many = make => { const m = cad.model(), shapes = make(m), s = m.build(Object.fromEntries(shapes.map((x, k) => [`s${k}`, x]))); return shapes.map((_, k) => old(s, `s${k}`)); };

test('rectangle extrude (29 test files) — box(), and with `from` — zMM', () => {
  const m = cad.model(), a = rect(m, [0, 0], [30, 20]).extrude(10), b = rect(m, [0, 0], [30, 20]).extrude(10, { from: 5 }), s = m.build({ a, b });
  near(now(part().box({ w: 30, d: 20, h: 10 })), old(s, 'a'), 'box');
  near(now(part().box({ w: 30, d: 20, h: 10, z: 5 })), old(s, 'b'), 'box from 5');
});

test('polygon, loop and circle sketches (15, 12 test files) — sketch().polygon / moveTo…arcTo…close / circle, then extrude', () => {
  const m = cad.model();
  const tri = m.sketch.polygon([[0, 0], [20, 0], [10, 15]]).extrude(4);
  const loop = m.sketch.loop([{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [20, 0], center: [20, 5], direction: 'ccw' }, { kind: 'line', start: [20, 10] }, { kind: 'line', start: [0, 10] }]).extrude(5);
  const s = m.build({ tri, loop });
  near(now(part().extrude(sketch().polygon([[0, 0], [20, 0], [10, 15]]), { h: 4 })), old(s, 'tri'), 'polygon');
  near(now(part().extrude(sketch().moveTo([0, 0]).lineTo([20, 0]).arcTo([20, 10], { center: [20, 5] }).lineTo([0, 10]).close(), { h: 5 })), old(s, 'loop'), 'loop');
  // (The old API measures no circle: the closed form, π r² h, about its axis.)
  near(now(part().cylinder({ r: 5, h: 10 })), { volume: Math.PI * 25 * 10, centroid: [0, 0, 5] }, 'circle');
  near(now(part().extrude(sketch().circle({ r: 5 }), { h: 10 })), { volume: Math.PI * 25 * 10, centroid: [0, 0, 5] }, 'circle sketch');
});

test('through hole (17 test files) — hole(face, { d, x, y })', () => {
  // (The old API's hole family has no mass: the closed form, a 30 × 20 × 10 block less a Ø6 bore through it.)
  const p = part().box({ w: 30, d: 20, h: 10 }).hole(b => b.faces().facing('+z'), { d: 6, x: 10, y: 10 }), v = 30 * 20 * 10 - Math.PI * 9 * 10;
  near(now(p), { volume: v, centroid: [(6000 * 15 - Math.PI * 90 * 10) / v, 10, 5] }, 'hole');
  // (The old API's hole, built, for its existence and placement: the same bore in its native box.)
  const m = cad.model(), h = rect(m, [0, 0], [30, 20]).extrude(10).hole({ center: [10, 10], radius: 3 });
  assert.ok(m.build({ h }).bodies.h);
});

test('union, cut and intersect (8, 14, 11 test files) — union / subtract / intersect with a callback tool', () => {
  const A = m => rect(m, [0, 0], [20, 10]).extrude(10), B = m => rect(m, [10, 0], [30, 10]).extrude(5);
  const a = () => part().box({ w: 20, d: 10, h: 10 });
  near(now(a().union(p => p.box({ w: 20, d: 10, h: 5, x: 10 }))), one(m => A(m).union(B(m))), 'union');
  near(now(a().intersect(p => p.box({ w: 20, d: 10, h: 5, x: 10 }))), one(m => A(m).intersect(B(m))), 'intersect');
  near(now(part().box({ w: 32, d: 24, h: 8 }).subtract(p => p.box({ w: 16, d: 8, h: 4, x: 8, y: 8 }))), one(m => rect(m, [0, 0], [32, 24]).extrude(8).cut(rect(m, [8, 8], [24, 16]).extrude(4))), 'cut');
});

test('chamfer and a chamfer chain (22 / 21 test files) — edges() selectors and chamfer, twice', () => {
  const m = cad.model(), a = rect(m, [0, 0], [30, 20]).extrude(10), one = a.chamfer(a.edges({ parallelTo: 'z', at: { x: 'max', y: 'max' } }).one(), 2);
  const two = one.chamfer(one.edges({ parallelTo: 'z', at: { x: 'min', y: 'min' } }).one(), 3), s = m.build({ one, two });
  // (The old `edges({ parallelTo, at: { x: 'max', y: 'max' } }).one()` is a typed selector: along z, the last by x then y.)
  const corner = (x, y) => b => b.edges().along('z').where(e => e.a[0] === x && e.a[1] === y);
  const first = part().box({ w: 30, d: 20, h: 10 }).chamfer(corner(30, 20), { distance: 2 });
  near(now(first), old(s, 'one'), 'chamfer');
  near(now(first.chamfer(corner(0, 0), { distance: 3 })), old(s, 'two'), 'chamfer chain');
});

test('translate and rotate, about the origin and a pivot (11 / 10 test files) — moved(Location), and a pivot as move · turn · move back', async () => {
  const { Location } = await import('../dist/api/index.js');
  near(now(part().box({ w: 10, d: 10, h: 5 }).moved(Location.at([3, 4, 5]))), one(m => rect(m, [0, 0], [10, 10]).extrude(5).translate([3, 4, 5])), 'translate');
  near(now(part().box({ w: 10, d: 20, h: 5 }).moved(Location.of({ rotation: [0, 0, 90] }))), one(m => rect(m, [0, 0], [10, 20]).extrude(5).rotate({ axis: 'z', angleDegrees: 90 })), 'rotate');
  near(now(part().box({ w: 10, d: 20, h: 5 }).moved(Location.at([-5, -5, 0])).moved(Location.of({ rotation: [0, 0, 90] })).moved(Location.at([5, 5, 0]))),
    one(m => rect(m, [0, 0], [10, 20]).extrude(5).rotate({ axis: 'z', angleDegrees: 90, pivot: [5, 5, 0] })), 'rotate about a pivot');
});

test('mirror and scale (8 / 15 test files) — mirror (the image joined with the original) and scale({ factor, pivot })', () => {
  const image = one(m => rect(m, [2, 0], [12, 10]).extrude(5).mirror({ plane: 'yz' }));
  // (The old mirror moves the body to its image; the v2 command keeps the original too: the image is the half past the plane.)
  const mirrored = part().box({ w: 10, d: 10, h: 5, x: 2 }).mirror({ plane: 'yz' });
  near(now(mirrored), joined([image, now(part().box({ w: 10, d: 10, h: 5, x: 2 }))]), 'mirror');
  near(now(mirrored.split({ axis: 'x', at: 0 }).body('split1/0')), image, 'mirror image');
  near(now(part().box({ w: 10, d: 10, h: 10 }).scale({ factor: 2 })), one(m => rect(m, [0, 0], [10, 10]).extrude(10).scale({ factor: 2 })), 'scale');
});

test('linear and circular patterns (6 / 5 test files) — linearPattern / circularPattern, any count, the copies joined', () => {
  const lin = many(m => [...rect(m, [0, 0], [10, 10]).extrude(5).linearPattern({ axis: 'x', spacing: 20, count: 3 })]);
  const circ = many(m => [...rect(m, [20, 0], [30, 10]).extrude(5).circularPattern({ axis: 'z', angleDegrees: 90, count: 4 })]);
  // (The old API hands back each copy; the v2 commands join them, as the studio does: one body, their union.)
  near(now(part().box({ w: 10, d: 10, h: 5 }).linearPattern({ axis: 'x', spacing: 20, count: 3 })), joined(lin), 'linear pattern');
  near(now(part().box({ w: 10, d: 10, h: 5, x: 20 }).circularPattern({ count: 4 })), joined(circ), 'circular pattern');
  // (Beyond the old recipes' fixed counts and quarter turns: seven copies at 360/7°, as the kernel allows.)
  // (The step is the studio command's, to a millionth of a degree — 360/7 is 51.428571° — so the seventh copy closes the
  // turn 3·10⁻⁶° short: the centroid is off the axis by about 2·10⁻⁷ mm, not by rounding of ours.)
  near(now(part().box({ w: 10, d: 10, h: 5, x: 20 }).circularPattern({ count: 7 })), { volume: 7 * 500, centroid: [0, 0, 2.5] }, 'seven copies', 1e-6);
});

test('split across an axis and a mitre (21 test files) — split({ axis, at }) and split({ normal, at }), each side a body', () => {
  const m = cad.model(), sp = rect(m, [0, 0], [10, 10]).extrude(10).split({ axis: 'x', at: 2 }), s = m.build({ n: sp.negative, p: sp.positive });
  const parts = part().box({ w: 10, d: 10, h: 10 }).split({ axis: 'x', at: 2 });
  assert.deepEqual(parts.bodies(), ['split1/0', 'split1/1']);
  near(now(parts.body('split1/0')), old(s, 'n'), 'split, below');
  near(now(parts.body('split1/1')), old(s, 'p'), 'split, above');
  // (A mitre, x + y = 10 across the 10 × 10 block: two prisms of half its volume, their centroids a third in from the corner.)
  const mitre = part().box({ w: 10, d: 10, h: 10 }).split({ normal: [1, 1, 0], at: 10 });
  near(now(mitre.body('split1/0')), { volume: 500, centroid: [10 / 3, 10 / 3, 5] }, 'mitre, below');
  near(now(mitre.body('split1/1')), { volume: 500, centroid: [20 / 3, 20 / 3, 5] }, 'mitre, above');
});

test('mass properties and STL (1 test file each) — mass({ density }) and stl()', () => {
  const m = cad.model(), p = rect(m, [0, 0], [30, 20]).extrude(10), s = m.build({ p }), q = s.massProperties('p', { densityKgPerM3: 2700 });
  const f = part().box({ w: 30, d: 20, h: 10 }).mass({ density: 2.7 });
  assert.ok(Math.abs(f.massG - q.massKG * 1000) <= 1e-9 * f.massG);
  q.inertiaCentroidKgM2.forEach((row, i) => row.forEach((v, j) => assert.ok(Math.abs(f.inertiaGMM2[i][j] - v * 1e9) <= 1e-6 * Math.max(1, Math.abs(f.inertiaGMM2[i][j])))));
  // (A box: 12 triangles, binary STL's 84-byte header and 50 bytes each.)
  const stl = part().box({ w: 30, d: 20, h: 10 }).stl(), e = s.exportStl('p');
  assert.equal(new DataView(stl.buffer, stl.byteOffset).getUint32(80, true), e.triangleCount);
  assert.equal(stl.byteLength, e.byteLength);
});

test('save and open (15 test files) — .doc is the CadPartDocument, part(name, doc) continues it', () => {
  const p = part('plate').box({ w: 30, d: 20, h: 10 }).hole(b => b.faces().facing('+z'), { d: 6, x: 10, y: 10 });
  const saved = JSON.parse(JSON.stringify(p.doc)), reopened = part('plate', saved);
  assert.deepEqual(reopened.doc, p.doc);
  assert.equal(evaluateCadPart(saved).outputs.length, 1);
  near(now(reopened.fillet(b => b.edges().along('z'), { radius: 1 })), now(p.fillet(b => b.edges().along('z'), { radius: 1 })), 'reopened');
});
