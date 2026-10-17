import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, featureLabel, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { editCommand } from '../src/app/editCommand';
import { FASTENER_SIZES, fastenerFit, fastenerName, fastenerThread, holeFit, lengthsOf, sizeForHole } from '../src/app/fasteners';

const ctx: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
const f = commands.find(c => c.id === 'fastener')!;
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.title + ' ' + r.error.hint); return r.bodies; };
const near = (a: number, b: number, tol = 0.5) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('fastener catalogue: M8 coarse pitch, ISO 4017 head, ISO 4032 nut, ISO 7089 washer', () => {
  const m8 = FASTENER_SIZES.M8;
  assert.deepEqual([m8.pitch, m8.s, m8.k, m8.m, m8.wd1, m8.wd2, m8.wh], [1.25, 13, 5.3, 6.8, 8.4, 16, 1.6]);
  assert.equal(fastenerName({ kind: 'hex-bolt', size: 'M8', length: '30' }), 'Hex head bolt ISO 4017 M8×1.25 × 30');
  assert.deepEqual(fastenerThread({ kind: 'hex-nut', size: 'M8' }), { d: 8, pitch: 1.25, hand: 'right', length: 6.8, internal: true });
  assert.equal(fastenerThread({ kind: 'washer', size: 'M8' }), null);
});

test('a hex bolt stands on its seat: head above, shank below; volumes of each part', () => {
  const doc = f.build!(ctx, { ...f.defaults!(ctx), kind: 'hex-bolt', size: 'M8', length: '30', x: 0, y: 0, z: 10 });
  const [b] = bodiesOf(doc), m8 = FASTENER_SIZES.M8, hex = 3 * Math.sqrt(3) / 2 * (m8.s / Math.sqrt(3)) ** 2;
  near(b.volumeMM3!, hex * m8.k + Math.PI * 16 * 30, 1);
  assert.deepEqual([b.mesh.bounds.min[2], b.mesh.bounds.max[2]].map(v => Math.round(v * 10) / 10), [-20, 15.3]);
  assert.equal(featureLabel(doc.nodes.at(-1)!, doc.nodes.length - 1, doc.nodes), 'Bolt M8×30');
  for (const kind of ['socket-screw', 'hex-nut', 'washer']) assert.equal(bodiesOf(f.build!(ctx, { ...f.defaults!(ctx), kind, size: 'M6', length: '20', x: 0, y: 0, z: 0 })).length, 1, kind);
  const nut = bodiesOf(f.build!(ctx, { ...f.defaults!(ctx), kind: 'hex-nut', size: 'M10', x: 0, y: 0, z: 0 }))[0], m10 = FASTENER_SIZES.M10;
  near(nut.volumeMM3!, (3 * Math.sqrt(3) / 2 * (m10.s / Math.sqrt(3)) ** 2 - Math.PI * 25) * m10.m, 1);
});

test('a placed bolt edits as itself (five steps rebuilt in place); lengths follow the size', () => {
  const doc = f.build!(ctx, { ...f.defaults!(ctx), size: 'M6', length: '20', x: 0, y: 0, z: 0 });
  const edit = editCommand(doc.nodes.length - 1, doc.nodes)!, ectx: Ctx = { doc, bodies: bodiesOf(doc), selection: { faces: [], edges: [], bodies: [0] } };
  assert.equal(edit.label, 'Edit Fastener');
  const next = edit.build!(ectx, { ...edit.defaults!(ectx), size: 'M8', length: '40' });
  assert.equal(next.nodes.length, doc.nodes.length);
  assert.equal(bodiesOf(next)[0].mesh.bounds.min[2], -40);
  assert.equal(f.derive!(ctx, { ...f.defaults!(ctx), size: 'M3', length: '80' }, ['size']).length, '30');
  assert.throws(() => f.build!(ctx, { ...f.defaults!(ctx), size: 'M3', length: '80' }), /come 6–30 mm long/);
});

test('a bolt edited into a nut: fewer steps, and the features after it follow', async () => {
  const { withNode } = await import('../src/engine/doc');
  let doc = f.build!(ctx, { ...f.defaults!(ctx), size: 'M6', length: '20', x: 0, y: 0, z: 0 });
  const top = doc.nodes.length - 1;
  doc = withNode(doc, { kind: 'translate', parent: { node: top, side: 'solid' }, offset: [50, 0, 0] });
  const edit = editCommand(top, doc.nodes)!, ectx: Ctx = { doc, bodies: bodiesOf(doc), selection: { faces: [], edges: [], bodies: [0] } };
  const next = edit.build!(ectx, { ...edit.defaults!(ectx), kind: 'hex-nut' });
  assert.equal(next.nodes.length, 3, 'a nut (sketch + solid) and the move');
  assert.deepEqual((next.nodes[2] as { parent: { node: number } }).parent.node, 1);
  const [nut] = bodiesOf(next);
  assert.equal(Math.round(nut.mesh.bounds.min[0] + nut.mesh.bounds.max[0]), 100, 'still moved 50 along X');
});

test('fastener data: ISO 4017 and ISO 4762 lengths apart, ISO 273 clearance and tap drills; a hole tells its size', () => {
  const m6 = FASTENER_SIZES.M6;
  assert.deepEqual([lengthsOf('hex-bolt', m6)[0], lengthsOf('socket-screw', m6)[0], lengthsOf('socket-screw', FASTENER_SIZES.M3)[0]], [12, 10, 5]);
  assert.deepEqual(FASTENER_SIZES.M8.clearance, [8.4, 9, 10]);
  assert.deepEqual(holeFit(m6, 6.6), { fit: 'clearance', series: 'medium' });
  assert.deepEqual(holeFit(m6, 5), { fit: 'tapped' });
  assert.deepEqual([holeFit(m6, 6), holeFit(m6, 8)], [{ fit: 'tight' }, { fit: 'loose' }]);
  assert.deepEqual(sizeForHole(6.6), { size: 'M6', fit: { fit: 'clearance', series: 'medium' } });
  assert.deepEqual(sizeForHole(5)?.size, 'M6', 'the M6 tap drill, not a loose M4');
  assert.deepEqual(sizeForHole(9), { size: 'M8', fit: { fit: 'clearance', series: 'medium' } });
  assert.equal(sizeForHole(40), null);
});

test('placed at a through hole a bolt takes washer and nut, sized and long enough; at a tap drill it is tapped', () => {
  // Ø6.6 through 10 mm: M6, washer + nut, needs 10 + 1.6 + 5.2 + 2 = 18.8 → 20.
  const placed = f.place!(f.defaults!(ctx), [0, 0, 10], [0, 0, 1], { d: 6.6, depth: 10, through: true });
  const v = f.derive!(ctx, placed, Object.keys(placed));
  assert.deepEqual([v.size, v.joint, v.grip, v.length], ['M6', 'nut', 10, '20']);
  const doc = f.build!(ctx, v), bodies = bodiesOf(doc);
  assert.equal(bodies.length, 3, 'bolt, washer and nut');
  const lows = bodies.map(b => Math.round(b.mesh.bounds.min[2] * 100) / 100).sort((a, b) => a - b);
  assert.deepEqual(lows, [-10, -6.8, -1.6], 'bolt end, nut and washer below the 10 mm plate');
  assert.equal(doc.bodies?.[`b${doc.nodes.findIndex((n, i) => n.kind === 'extrude' && i > 3)}`]?.name, 'Washer ISO 7089 6');
  assert.ok(fastenerFit(v).every(s => s.done), JSON.stringify(fastenerFit(v)));
  // Too short for the joint: refused, saying how long it must be.
  assert.throws(() => f.build!(ctx, { ...v, length: '16' }), /needs 18\.8 mm/);
  // Ø5 blind 16 mm: M6 tapped, engaging 1.5 d = 9 mm with 2 pitches clear of the bottom: 12 (the shortest ISO 4017 M6).
  const t = f.place!(f.defaults!(ctx), [0, 0, 10], [0, 0, 1], { d: 5, depth: 16, through: false }), tv = f.derive!(ctx, t, Object.keys(t));
  assert.deepEqual([tv.size, tv.joint, tv.length], ['M6', 'tapped', '12']);
  assert.ok(fastenerFit(tv).every(s => s.done), JSON.stringify(fastenerFit(tv)));
  // Only 12 mm deep: the shortest still runs to the bottom — kept, and flagged.
  const t2 = f.place!(f.defaults!(ctx), [0, 0, 10], [0, 0, 1], { d: 5, depth: 12, through: false }), tv2 = f.derive!(ctx, t2, Object.keys(t2));
  assert.equal(tv2.length, '12'); assert.equal(fastenerFit(tv2).at(-1)!.done, false);
  assert.equal(bodiesOf(f.build!(ctx, tv)).length, 1);
  // A tapped joint in a clearance hole is flagged.
  assert.equal(fastenerFit({ ...v, joint: 'tapped' })[0].done, false);
});

test('a bolt with washer and nut placed in a side hole turns as one: all three stand out of the face', () => {
  const placed = f.place!(f.defaults!(ctx), [10, 0, 5], [1, 0, 0], { d: 6.6, depth: 10, through: true });
  const v = f.derive!(ctx, placed, Object.keys(placed)), doc = f.build!(ctx, v), bodies = bodiesOf(doc);
  assert.equal(bodies.length, 3);
  for (const b of bodies) assert.ok(b.mesh.bounds.max[2] - b.mesh.bounds.min[2] < 13, 'turned onto X');
  assert.ok(bodies.every(b => b.mesh.bounds.min[0] < 10.01), 'below the seat along X');
  assert.equal(doc.nodes.at(-1)?.kind, 'rotate'); assert.equal((doc.nodes.at(-1) as { made?: { command: string } }).made?.command, 'fastener');
});

test('a countersunk socket screw (ISO 10642): its head sunk below the seat, flush at the top, the length overall', () => {
  const v = { ...f.defaults!(ctx), kind: 'csk-screw', size: 'M6', length: '20', x: 0, y: 0, z: 10 };
  assert.equal(fastenerName(v), 'Countersunk socket screw ISO 10642 M6×1 × 20');
  assert.deepEqual(lengthsOf('csk-screw', FASTENER_SIZES.M6).slice(0, 3), [8, 10, 12]);
  const doc = f.build!(ctx, v), [b] = bodiesOf(doc), m6 = FASTENER_SIZES.M6;
  near(b.mesh.bounds.max[2], 10, 1e-6); near(b.mesh.bounds.min[2], -10, 1e-6);
  near(b.mesh.bounds.max[0] - b.mesh.bounds.min[0], m6.cdk, 0.01);
  // A frustum Ø13.44 → Ø6 over 3.72, less the socket, and the shank below it.
  const R = m6.cdk / 2, r = 3, k = m6.ck, frustum = Math.PI * k / 3 * (R * R + R * r + r * r), shank = Math.PI * r * r * (20 - k);
  const socket = 3 * Math.sqrt(3) / 2 * (m6.csocket / Math.sqrt(3)) ** 2 * 2 * k * 0.6 / 2;
  near(b.volumeMM3!, frustum + shank - socket, 3);
  assert.equal(featureLabel(doc.nodes.at(-1)!, doc.nodes.length - 1, doc.nodes), 'Csk screw M6×20');
  assert.ok(fastenerFit({ ...v, joint: 'free' }).some(s => s.label === 'Head' && /countersink Ø13.44/.test(s.text)));
});

test('a fastener inserted as a part of its own: an instance at the seat, turned out of its face, its thread remembered', async () => {
  const { withFastenerInstance } = await import('../src/app/fasteners');
  const v = { ...f.defaults!(ctx), kind: 'hex-bolt', size: 'M8', length: '30', x: 5, y: 6, z: 7, insert: 'instance', up: '+x' };
  const doc = f.build!(ctx, v);
  assert.equal(doc.nodes.length, 0, 'nothing joins the part');
  const [inst] = doc.instances!;
  assert.deepEqual([inst.id, inst.name, inst.position, inst.rotation], ['inst1', 'Hex head bolt ISO 4017 M8×1.25 × 30', [5, 6, 7], [0, 90, 0]]);
  const top = inst.doc.nodes.at(-1)!;
  assert.ok('made' in top && top.made?.command === 'fastener' && top.made.values.size === 'M8' && top.made.values.x === 0);
  const [b] = bodiesOf(inst.doc); near(b.mesh.bounds.max[2], FASTENER_SIZES.M8.k, 1e-6); near(b.mesh.bounds.min[2], -30, 1e-6);
  // A second one takes the next id.
  assert.equal(withFastenerInstance(doc, v).instances![1].id, 'inst2');
});

test('a modelled thread: the bolt and its nut as helical B-spline faces, one solid each; the made values edit it again', () => {
  const v = { ...f.defaults!(ctx), kind: 'hex-bolt', size: 'M8', length: '30', joint: 'nut', grip: 10, model: 'modelled', x: 0, y: 0, z: 0 };
  const doc = f.build!(ctx, v), t0 = performance.now(), bodies = bodiesOf(doc), ms = performance.now() - t0;
  const kinds = doc.nodes.map(n => n.kind);
  assert.deepEqual(kinds.filter(k => k === 'thread').length, 2, 'the bolt and the nut');
  assert.equal(kinds.at(-1), 'thread'); assert.equal((doc.nodes.at(-1) as { made?: { command: string } }).made?.command, 'fastener');
  assert.equal(bodies.length, 3, 'bolt, washer, nut');
  const bolt = bodies.find(b => b.key === `b${doc.nodes.length - 1}`)!, size = FASTENER_SIZES.M8;
  // Its volume between the root's and the major diameter's cylinders, plus the head.
  const hex = Math.sqrt(3) / 2 * size.s ** 2 * size.k, rMin = 4 - 5 / 8 * Math.sqrt(3) / 2 * 1.25;
  assert.ok(bolt.volumeMM3! > hex + Math.PI * rMin ** 2 * 30 && bolt.volumeMM3! < hex + Math.PI * 16 * 30, String(bolt.volumeMM3));
  assert.ok(bolt.mesh.edges.length < 6000, `${bolt.mesh.edges.length} edges shown (the facets' smooth joints hidden)`);
  assert.ok(ms < 8000, `${Math.round(ms)} ms`);
  assert.match(f.steps!(ctx, v).find(s => s.label === 'Thread')!.text, /modelled: ISO 68-1/);
  // New nodes say their form, and the bolt's faces carry the helical names (mates pick the head and seat).
  assert.ok(doc.nodes.filter(n => n.kind === 'thread').every(n => (n as { form?: string }).form === 'helical'));
  const names = new Set(bolt.mesh.faces.map(face => face.name.replace(/^.*\./, '').replace(/#\d+$/, '')));
  for (const n of ['head', 'seat', 'end', 'thread', 'hex0']) assert.ok(names.has(n), `${n} in ${[...names].join(', ')}`);
  // A thread node saved before helical became the default (no form) still builds faceted: its .facetK names resolve.
  const old = { ...doc, nodes: doc.nodes.map(n => { if (n.kind !== 'thread') return n; const { form: _form, ...rest } = n as typeof n & { form?: string }; void _form; return rest; }) };
  const oldBolt = bodiesOf(old).find(b => b.key === `b${doc.nodes.length - 1}`)!;
  assert.ok(oldBolt.mesh.faces.every(face => /\.facet\d+$/.test(face.name)), oldBolt.mesh.faces.slice(0, 3).map(face => face.name).join(', '));
});

test('ISO 4017 lengths follow the cross-checked table for every size', () => {
  const by = (a: number, b: number, step: number) => Array.from({ length: Math.round((b - a) / step) + 1 }, (_, k) => a + k * step);
  // engineersedge.com ISO 4017 table (CATALOGUE.sources).
  const table: Record<string, number[]> = {
    M3: [...by(6, 12, 2), 16, 20, 25, 30], M4: [8, 10, 12, 16, ...by(20, 40, 5)], M5: [10, 12, 16, ...by(20, 50, 5)], M6: [12, 16, ...by(20, 60, 5)],
    M8: [16, ...by(20, 70, 5), 80], M10: [...by(20, 70, 5), 80, 90, 100], M12: [...by(25, 70, 5), ...by(80, 120, 10)],
  };
  for (const [size, lengths] of Object.entries(table)) {
    assert.deepEqual(FASTENER_SIZES[size].lengths, lengths, size);
    assert.ok(FASTENER_SIZES[size].checked4017, size);
  }
});
