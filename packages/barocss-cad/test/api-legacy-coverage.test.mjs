// R7.3d prep (api-conventions §7): what createCadModel (src/modeling.ts) could model, made through
// @barocss/cad/api instead, case by case. Each case builds the shape through the facade and compares the result: volume
// and centroid with the old API's massProperties, recorded below from the build at fa79c9969 before its retirement, where it
// measured that family, else a closed form. The old API's own guard tests (input admission, provider isolation, its codec,
// its reuse of earlier work) have no counterpart here: they tested that API itself, and retired with it. The map, and what
// has no facade equivalent, is in apps/cad-studio/handover/notes/api-facade-design.md ("createCadModel's tests, mapped").
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart } from '../dist/index.js';
import { part, sketch } from '../dist/api/index.js';

// (Volume and centroid: the facade's, at 1 g/cm³ — the old API's are recorded.)
// createCadModel's results, recorded from the build at fa79c9969 before its retirement (R7.3d).
const OLD = Object.freeze({
  box: {"volume":6000,"centroid":[15,10,5]},
  boxFrom5: {"volume":6000,"centroid":[15,10,10]},
  polygon: {"volume":600,"centroid":[10,5,2]},
  loop: {"volume":1196.3495408493618,"centroid":[11.98952061574786,5.000000000000003,2.5]},
  union: {"volume":2500,"centroid":[13,5,4.5]},
  intersect: {"volume":500,"centroid":[15,5,2.5]},
  cut: {"volume":5632,"centroid":[16,12,4.181818181818182]},
  chamfer: {"volume":5980,"centroid":[14.9520624303233,9.968784838350055,5]},
  chamferChain: {"volume":5935,"centroid":[15.057848918843021,10.036787419264252,5]},
  translate: {"volume":500,"centroid":[8,9,7.5]},
  rotate: {"volume":1000,"centroid":[-10,5,2.5]},
  rotatePivot: {"volume":1000,"centroid":[0,5,2.5]},
  mirrorImage: {"volume":500,"centroid":[-7,5,2.5]},
  scale: {"volume":8000,"centroid":[10,10,10]},
  linearPattern: [{"volume":500,"centroid":[5,5,2.5]},{"volume":500,"centroid":[25,5,2.5]},{"volume":500,"centroid":[45,5,2.5]}],
  circularPattern: [{"volume":500,"centroid":[25,5,2.5]},{"volume":500,"centroid":[-5,25,2.5]},{"volume":500,"centroid":[-25,-5,2.5]},{"volume":500,"centroid":[5,-25,2.5]}],
  splitBelow: {"volume":200,"centroid":[1,5,5]},
  splitAbove: {"volume":800,"centroid":[6,5,5]},
  mass: {"massKG":0.0162,"inertiaCentroidKgM2":[[6.75e-7,0,0],[0,0.00000135,0],[0,0,0.000001755]],"stlTriangleCount":12,"stlByteLength":684},
});
const now = p => { const q = p.mass({ density: 1 }); return { volume: q.volume, centroid: [...q.centroid] }; };
// (Two kernels' algorithms — the old one's exact convex and integer-cell solvers, the facade's B-rep — agree to rounding.)
const near = (a, b, what, centroidMM = 1e-9) => {
  const tol = 1e-9 * Math.max(1, Math.abs(a.volume));
  assert.ok(Math.abs(a.volume - b.volume) <= tol, `${what}: volume ${a.volume} vs ${b.volume}`);
  a.centroid.forEach((v, k) => assert.ok(Math.abs(v - b.centroid[k]) <= centroidMM, `${what}: centroid ${a.centroid} vs ${b.centroid}`));
};
// (The union of equal disjoint bodies: their volumes summed, their centroids averaged.)
const joined = parts => ({ volume: parts.reduce((s, p) => s + p.volume, 0), centroid: [0, 1, 2].map(k => parts.reduce((s, p) => s + p.centroid[k] * p.volume, 0) / parts.reduce((s, p) => s + p.volume, 0)) });

test('rectangle extrude (29 test files) — box(), and with `from` — zMM', () => {
  near(now(part().box({ w: 30, d: 20, h: 10 })), OLD.box, 'box');
  near(now(part().box({ w: 30, d: 20, h: 10, z: 5 })), OLD.boxFrom5, 'box from 5');
});

test('polygon, loop and circle sketches (15, 12 test files) — sketch().polygon / moveTo…arcTo…close / circle, then extrude', () => {
  near(now(part().extrude(sketch().polygon([[0, 0], [20, 0], [10, 15]]), { h: 4 })), OLD.polygon, 'polygon');
  near(now(part().extrude(sketch().moveTo([0, 0]).lineTo([20, 0]).arcTo([20, 10], { center: [20, 5] }).lineTo([0, 10]).close(), { h: 5 })), OLD.loop, 'loop');
  // (The old API measures no circle: the closed form, π r² h, about its axis.)
  near(now(part().cylinder({ r: 5, h: 10 })), { volume: Math.PI * 25 * 10, centroid: [0, 0, 5] }, 'circle');
  near(now(part().extrude(sketch().circle({ r: 5 }), { h: 10 })), { volume: Math.PI * 25 * 10, centroid: [0, 0, 5] }, 'circle sketch');
});

test('through hole (17 test files) — hole(face, { d, x, y })', () => {
  // (The old API's hole family has no mass: the closed form, a 30 × 20 × 10 block less a Ø6 bore through it.)
  const p = part().box({ w: 30, d: 20, h: 10 }).hole(b => b.faces().facing('+z'), { d: 6, x: 10, y: 10 }), v = 30 * 20 * 10 - Math.PI * 9 * 10;
  near(now(p), { volume: v, centroid: [(6000 * 15 - Math.PI * 90 * 10) / v, 10, 5] }, 'hole');
});

test('union, cut and intersect (8, 14, 11 test files) — union / subtract / intersect with a callback tool', () => {
  const a = () => part().box({ w: 20, d: 10, h: 10 });
  near(now(a().union(p => p.box({ w: 20, d: 10, h: 5, x: 10 }))), OLD.union, 'union');
  near(now(a().intersect(p => p.box({ w: 20, d: 10, h: 5, x: 10 }))), OLD.intersect, 'intersect');
  near(now(part().box({ w: 32, d: 24, h: 8 }).subtract(p => p.box({ w: 16, d: 8, h: 4, x: 8, y: 8 }))), OLD.cut, 'cut');
});

test('chamfer and a chamfer chain (22 / 21 test files) — edges() selectors and chamfer, twice', () => {
  // (The old `edges({ parallelTo, at: { x: 'max', y: 'max' } }).one()` is a typed selector: along z, the last by x then y.)
  const corner = (x, y) => b => b.edges().along('z').where(e => e.a[0] === x && e.a[1] === y);
  const first = part().box({ w: 30, d: 20, h: 10 }).chamfer(corner(30, 20), { distance: 2 });
  near(now(first), OLD.chamfer, 'chamfer');
  near(now(first.chamfer(corner(0, 0), { distance: 3 })), OLD.chamferChain, 'chamfer chain');
});

test('translate and rotate, about the origin and a pivot (11 / 10 test files) — moved(Location), and a pivot as move · turn · move back', async () => {
  const { Location } = await import('../dist/api/index.js');
  near(now(part().box({ w: 10, d: 10, h: 5 }).moved(Location.at([3, 4, 5]))), OLD.translate, 'translate');
  near(now(part().box({ w: 10, d: 20, h: 5 }).moved(Location.of({ rotation: [0, 0, 90] }))), OLD.rotate, 'rotate');
  near(now(part().box({ w: 10, d: 20, h: 5 }).moved(Location.at([-5, -5, 0])).moved(Location.of({ rotation: [0, 0, 90] })).moved(Location.at([5, 5, 0]))),
    OLD.rotatePivot, 'rotate about a pivot');
});

test('mirror and scale (8 / 15 test files) — mirror (the image joined with the original) and scale({ factor, pivot })', () => {
  const image = OLD.mirrorImage;
  // (The old mirror moves the body to its image; the v2 command keeps the original too: the image is the half past the plane.)
  const mirrored = part().box({ w: 10, d: 10, h: 5, x: 2 }).mirror({ plane: 'yz' });
  near(now(mirrored), joined([image, now(part().box({ w: 10, d: 10, h: 5, x: 2 }))]), 'mirror');
  near(now(mirrored.split({ axis: 'x', at: 0 }).body('split1/0')), image, 'mirror image');
  near(now(part().box({ w: 10, d: 10, h: 10 }).scale({ factor: 2 })), OLD.scale, 'scale');
});

test('linear and circular patterns (6 / 5 test files) — linearPattern / circularPattern, any count, the copies joined', () => {
  // (The old API hands back each copy; the v2 commands join them, as the studio does: one body, their union.)
  near(now(part().box({ w: 10, d: 10, h: 5 }).linearPattern({ axis: 'x', spacing: 20, count: 3 })), joined(OLD.linearPattern), 'linear pattern');
  near(now(part().box({ w: 10, d: 10, h: 5, x: 20 }).circularPattern({ count: 4 })), joined(OLD.circularPattern), 'circular pattern');
  // (Beyond the old recipes' fixed counts and quarter turns: seven copies at 360/7°, as the kernel allows.)
  // (The step is the studio command's, to a millionth of a degree — 360/7 is 51.428571° — so the seventh copy closes the
  // turn 3·10⁻⁶° short: the centroid is off the axis by about 2·10⁻⁷ mm, not by rounding of ours.)
  near(now(part().box({ w: 10, d: 10, h: 5, x: 20 }).circularPattern({ count: 7 })), { volume: 7 * 500, centroid: [0, 0, 2.5] }, 'seven copies', 1e-6);
});

test('split across an axis and a mitre (21 test files) — split({ axis, at }) and split({ normal, at }), each side a body', () => {
  const parts = part().box({ w: 10, d: 10, h: 10 }).split({ axis: 'x', at: 2 });
  assert.deepEqual(parts.bodies(), ['split1/0', 'split1/1']);
  near(now(parts.body('split1/0')), OLD.splitBelow, 'split, below');
  near(now(parts.body('split1/1')), OLD.splitAbove, 'split, above');
  // (A mitre, x + y = 10 across the 10 × 10 block: two prisms of half its volume, their centroids a third in from the corner.)
  const mitre = part().box({ w: 10, d: 10, h: 10 }).split({ normal: [1, 1, 0], at: 10 });
  near(now(mitre.body('split1/0')), { volume: 500, centroid: [10 / 3, 10 / 3, 5] }, 'mitre, below');
  near(now(mitre.body('split1/1')), { volume: 500, centroid: [20 / 3, 20 / 3, 5] }, 'mitre, above');
});

test('mass properties and STL (1 test file each) — mass({ density }) and stl()', () => {
  const q = OLD.mass, f = part().box({ w: 30, d: 20, h: 10 }).mass({ density: 2.7 });
  assert.ok(Math.abs(f.mass - q.massKG * 1000) <= 1e-9 * f.mass);
  q.inertiaCentroidKgM2.forEach((row, i) => row.forEach((v, j) => assert.ok(Math.abs(f.inertia[i][j] - v * 1e9) <= 1e-6 * Math.max(1, Math.abs(f.inertia[i][j])))));
  // (A box: 12 triangles, binary STL's 84-byte header and 50 bytes each.)
  const stl = part().box({ w: 30, d: 20, h: 10 }).stl();
  assert.equal(new DataView(stl.buffer, stl.byteOffset).getUint32(80, true), q.stlTriangleCount);
  assert.equal(stl.byteLength, q.stlByteLength);
});

test('save and open (15 test files) — .doc is the CadPartDocument, part(name, doc) continues it', () => {
  const p = part('plate').box({ w: 30, d: 20, h: 10 }).hole(b => b.faces().facing('+z'), { d: 6, x: 10, y: 10 });
  const saved = JSON.parse(JSON.stringify(p.doc)), reopened = part('plate', saved);
  assert.deepEqual(reopened.doc, p.doc);
  assert.equal(evaluateCadPart(saved).outputs.length, 1);
  near(now(reopened.fillet(b => b.edges().along('z'), { radius: 1 })), now(p.fillet(b => b.edges().along('z'), { radius: 1 })), 'reopened');
});
