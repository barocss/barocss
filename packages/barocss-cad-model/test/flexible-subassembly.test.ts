import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart, evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, placedBase, placedDoc, rectanglePart, withNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { flattenAssembly } from '../src/engine/flatten';
import { faceTableOf, tablesFor } from '../src/assembly/faces';
import { addMate, placePart, solveDoc } from '../src/assembly/edit';
import { bodyDocOf, instanceJointsOf, jointProblemsOf, poseOf, setInstanceJoints } from '../src/assembly/flexible';
import { readStudioDoc } from '../src/engine/migrate';
import { addInstancePattern } from '../src/assembly/patterns';
import { flatFaceOf, faceOriginOf } from '../src/engine/occurrences';
import { axisAngle, matMul, rotationMatrix } from '../src/engine/placement';
import type { Mate } from '../src/assembly/mates';
import { bomViewOf } from '../src/bom/core';
import { dispatchTool } from '../src/chat/tools';
import { assembly, part, BarocssError } from '../src/api';

// Roadmap 10 4 (RS7.4): flexible sub-assemblies. An occurrence of a sub-assembly keeps its own joint values
// (`PartInstance.joints`, offsets from the saved pose); its lid stands where the values put it in every consumer of the fold.
const ev = (d: StudioDoc) => evaluateDoc(d, 1);
const DEG = Math.PI / 180;
const plateWithHole = (w: number, d: number, h: number, c: [number, number], r = 5) => { const p = rectanglePart(w, d, h); return withNode(p, { kind: 'hole', parent: { node: p.nodes.length - 1, side: 'solid' }, center: c, radius: r } as never); };
const inst = (id: string, name: string, doc: StudioDoc, position: [number, number, number] = [0, 0, 0], rotation: [number, number, number] = [0, 0, 0], extra: Partial<PartInstance> = {}): PartInstance => ({ id, name, doc, position, rotation, ...extra });
const mate = (id: string, kind: Mate['kind'], a: [string, string], b: [string, string], extra: Partial<Mate> = {}): Mate => ({ id, kind, a: { part: a[0], face: a[1] }, b: { part: b[0], face: b[1] }, ...extra });
const near = (a: number, b: number, why = '', tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${why} ${a} vs ${b}`);
const nearAll = (a: readonly number[], b: readonly number[], why = '', tol = 1e-6) => a.forEach((v, k) => near(v, b[k], `${why}[${k}]`, tol));

// The hinge: a base plate 100 × 40 × 10 with a Ø10 hole at (20, 20); a lid 60 × 20 × 5 with a hole at (10, 10); the lid's hole
// concentric with the plate's and its bottom on the plate's top: one turn about the hole's axis (Z), the pair `base~lid`.
const PLATE = plateWithHole(100, 40, 10, [20, 20]);
const LID = plateWithHole(60, 20, 5, [10, 10]);
const hinge = (extra: Partial<StudioDoc> = {}): StudioDoc => solveDoc({ ...PLATE, instances: [inst('lid', 'Lid', LID, [0, 0, 30])], mates: [mate('c', 'concentric', ['base', 'n2.side0'], ['lid', 'n2.side0']), mate('f', 'coincident', ['base', 'n1.top'], ['lid', 'n1.bottom'])], ...extra }).doc;
const AXIS = (() => { const f = faceTableOf(PLATE)['n2.side0']; assert.equal(f.kind, 'cylinder'); return f.kind === 'cylinder' ? { point: [...f.point] as number[], axis: [...f.axis] as number[] } : null; })()!;
const sub = hinge();
const lidOf = (d: StudioDoc) => d.instances!.find(i => i.id === 'lid')!;
// Independent arithmetic: the lid's saved placement turned by `deg` about the hinge axis (through AXIS.point, in the sub-assembly's frame).
function turned(deg: number) {
  const R = axisAngle(AXIS.axis as [number, number, number], deg * DEG), l = lidOf(sub), p = [l.position[0] - AXIS.point[0], l.position[1] - AXIS.point[1], l.position[2] - AXIS.point[2]];
  return { R: matMul(R, rotationMatrix(l.rotation)), position: [0, 1, 2].map(i => R[i * 3] * p[0] + R[i * 3 + 1] * p[1] + R[i * 3 + 2] * p[2] + AXIS.point[i]) };
}
// The hinge in a parent assembly with its axis horizontal (the occurrence turned 90 degrees about X), two occurrences side by side.
const occurrence = (id: string, at: [number, number, number], joints?: Record<string, number>): PartInstance => inst(id, id, sub, at, [90, 0, 0], { grounded: true, ...(joints ? { joints } : {}) });
const parent = (a?: Record<string, number>, b?: Record<string, number>): StudioDoc => ({ ...emptyDoc(), instances: [occurrence('sub1', [0, 0, 0], a), occurrence('sub2', [300, 0, 0], b)] });

test('a hinge sub-assembly lists its one turning joint with the lid\'s limits and this occurrence\'s value', () => {
  const doc = setInstanceJoints(parent(), { part: 'sub1', joints: { 'base~lid': 30 } }).doc;
  const j = instanceJointsOf(doc, 'sub1');
  assert.equal(j.problem, undefined);
  assert.deepEqual(j.joints.map(x => [x.key, x.type, x.parent, x.child]), [['base~lid', 'continuous', 'base', 'lid']]);
  near(j.joints[0].value, 30, 'degrees out', 1e-9);
  near(doc.instances![0].joints!['base~lid'], 30 * DEG, 'stored in radians', 1e-12);
  assert.equal(instanceJointsOf(doc, 'sub2').joints[0].value, 0);
});

test('two occurrences with 0 and 90 degrees: the lid stands by independent rotation arithmetic, the plate stays', () => {
  const doc = setInstanceJoints(parent(), { part: 'sub2', joints: { 'base~lid': 90 } }).doc;
  assert.deepEqual(doc.instances!.find(i => i.id === 'sub1')!.joints, undefined);
  const rigid = bodyDocOf(doc.instances![0]), posed = bodyDocOf(doc.instances![1]);
  assert.equal(rigid, doc.instances![0].doc, 'no joints: the very document');
  const t = turned(90), lid = lidOf(posed);
  nearAll(lid.position, t.position, 'position', 1e-6);
  nearAll(rotationMatrix(lid.rotation), t.R, 'rotation', 1e-9);
  // (And in the world: the occurrence's own placement on top, as the kernel folds it.)
  const ev1 = evaluateDoc(doc, 1); assert.ok(ev1.ok);
  const bodies = (id: string) => { const r = evaluatePart(placedDoc(doc.instances!.find(i => i.id === id)!, doc), 1); assert.ok(r.ok); return r.bodies; };
  const [shut, open] = [bodies('sub1'), bodies('sub2')];
  assert.equal(shut.length, 2); assert.equal(open.length, 2);
  const centroid = (b: { mesh: { positions: Float32Array } }) => { const p = b.mesh.positions, c = [0, 0, 0]; for (let i = 0; i < p.length; i++) c[i % 3] += p[i]; return c.map(v => v / (p.length / 3)); };
  // The plate's vertices are the same set (the second occurrence 300 mm along X); the lid's centroid moved by the turn.
  nearAll(centroid(open[0]).map((v, k) => v - (k === 0 ? 300 : 0)), centroid(shut[0]), 'plate', 1e-3);
  const Ro = rotationMatrix([90, 0, 0]), apply = (R: readonly number[], p: readonly number[]) => [0, 1, 2].map(i => R[i * 3] * p[0] + R[i * 3 + 1] * p[1] + R[i * 3 + 2] * p[2]);
  const cShut = centroid(shut[1]), local = apply([Ro[0], Ro[3], Ro[6], Ro[1], Ro[4], Ro[7], Ro[2], Ro[5], Ro[8]], cShut);
  const turn = axisAngle(AXIS.axis as [number, number, number], 90 * DEG), rel = local.map((v, k) => v - AXIS.point[k]);
  const world = apply(Ro, apply(turn, rel).map((v, k) => v + AXIS.point[k]));
  nearAll(centroid(open[1]).map((v, k) => v - (k === 0 ? 300 : 0)), world, 'lid centroid', 1e-3);
});

test('{} and 0 are the rigid fold: byte-identical flatten and placedBase, and no joints leave the document unchanged', () => {
  const a = inst('s', 's', sub, [5, 6, 7], [0, 0, 0], { grounded: true }), b = { ...a, joints: {} }, c = { ...a, joints: { 'base~lid': 0 } };
  const flat = JSON.stringify(placedBase(a)), doc = (i: PartInstance): StudioDoc => ({ ...emptyDoc(), instances: [i] });
  assert.equal(JSON.stringify(placedBase(b)), flat); assert.equal(JSON.stringify(placedBase(c)), flat);
  assert.equal(JSON.stringify(flattenAssembly(doc(b))), JSON.stringify(flattenAssembly(doc(a))));
  assert.equal(JSON.stringify(placedDoc(c)), JSON.stringify(placedDoc(a)));
  // (Setting it back to nothing removes the field.)
  const open = setInstanceJoints(doc(a), { part: 's', joints: { 'base~lid': 30 } }).doc, back = setInstanceJoints(open, { part: 's', joints: { 'base~lid': null } }).doc;
  assert.ok(open.instances![0].joints); assert.equal(back.instances![0].joints, undefined); assert.equal('joints' in back.instances![0], false);
  assert.notEqual(JSON.stringify(placedBase(open.instances![0])), flat);
});

test('limits and keys are refused in words naming the joint and the sub-assembly', () => {
  const limited = { ...sub, robot: { version: 1 as const, joints: { 'base~lid': { lower: 0, upper: 120 } } } };
  const doc: StudioDoc = { ...emptyDoc(), instances: [inst('hinge1', 'Door hinge', limited, [0, 0, 0], [0, 0, 0], { grounded: true })] };
  const ok = setInstanceJoints(doc, { part: 'hinge1', joints: { 'base~lid': 120 } }).doc;
  near(ok.instances![0].joints!['base~lid'], 120 * DEG, '', 1e-9);
  assert.throws(() => setInstanceJoints(doc, { part: 'hinge1', joints: { 'base~lid': 121 } }), (e: unknown) => e instanceof BarocssError && /Door hinge \(hinge1\): joint "base~lid" is 121 degrees, outside its limits 0 to 120/.test(e.message));
  assert.throws(() => setInstanceJoints(doc, { part: 'hinge1', joints: { 'base~lid': -1 } }), /outside its limits/);
  assert.throws(() => setInstanceJoints(doc, { part: 'hinge1', joints: { nope: 5 } }), /Door hinge \(hinge1\) has no joint "nope"; its joints: base~lid/);
  assert.throws(() => setInstanceJoints(doc, { part: 'hinge1', joints: { 'lid/x~y': 5 } }), /not of a sub-assembly inside it/);
  assert.throws(() => setInstanceJoints(doc, { part: 'hinge1', joints: { 'base~lid': Number.NaN } }), /needs a number \(degrees\)/);
  assert.throws(() => setInstanceJoints(doc, { part: 'ghost', joints: {} }), /No part "ghost"/);
  // (A part that is not a sub-assembly, and one whose mates are not met, say so.)
  const plain: StudioDoc = { ...emptyDoc(), instances: [inst('p1', 'Plate', PLATE)] };
  assert.throws(() => setInstanceJoints(plain, { part: 'p1', joints: { a: 1 } }), /Plate \(p1\) is not a sub-assembly/);
  assert.match(instanceJointsOf(plain, 'p1').problem!, /not a sub-assembly/);
  // (A sub-assembly whose part is joined to nothing: not posed, said so.)
  const loose = { ...sub, mates: [] as Mate[] };
  assert.throws(() => setInstanceJoints({ ...emptyDoc(), instances: [inst('l1', 'Loose', loose)] }, { part: 'l1', joints: { a: 1 } }), /has no mates between its parts/);
  // (A stored value the sub-assembly's joints no longer have: rigid, and the problem reported.)
  const stale: StudioDoc = { ...emptyDoc(), instances: [{ ...doc.instances![0], joints: { gone: 1 } }] };
  assert.equal(bodyDocOf(stale.instances![0]), stale.instances![0].doc);
  assert.match(instanceJointsOf(stale, 'hinge1').problem!, /has no joint "gone"/);
  const over: StudioDoc = { ...emptyDoc(), instances: [{ ...doc.instances![0], joints: { 'base~lid': 3 } }] };
  assert.equal(bodyDocOf(over.instances![0]), over.instances![0].doc);
  assert.match(instanceJointsOf(over, 'hinge1').problem!, /outside its limits/);
});

test('a mate to sub1/lid follows the posed lid: the cap\'s face is on the lid\'s side face where the turn put it', () => {
  const LIDSIDE = Object.entries(faceTableOf(LID)).find(([name, f]) => name.startsWith('n1.side') && f.kind === 'plane' && Math.abs(f.normal[0]) > 0.99)!;
  const CAP = rectanglePart(10, 10, 10);
  const base = setInstanceJoints(parent(), { part: 'sub1', joints: { 'base~lid': 90 } }).doc;
  const both = { ...base, instances: [...base.instances!, inst('cap', 'Cap', CAP, [0, -200, 0])] };
  const mated = addMate(both, { kind: 'coincident', a: { part: 'sub1/lid', face: LIDSIDE[0] }, b: { part: 'cap', face: 'n1.bottom' } });
  const cap = mated.doc.instances!.find(i => i.id === 'cap')!;
  // Independent: the lid's side face plane in the world, through the occurrence and the turn.
  const Ro = rotationMatrix([90, 0, 0]), t = turned(90), f = LIDSIDE[1] as { kind: 'plane'; point: number[]; normal: number[] };
  const mul = (R: readonly number[], p: readonly number[]) => [0, 1, 2].map(i => R[i * 3] * p[0] + R[i * 3 + 1] * p[1] + R[i * 3 + 2] * p[2]);
  const nSub = mul(t.R, f.normal), pSub = mul(t.R, f.point).map((v, k) => v + t.position[k]);
  const n = mul(Ro, nSub), p = mul(Ro, pSub);
  // The cap's bottom face (local normal -Z, through the origin plane z = -5) lies on that plane facing against it.
  const capFace = faceTableOf(CAP)['n1.bottom'] as { kind: 'plane'; point: number[]; normal: number[] };
  const Rc = rotationMatrix(cap.rotation), nc = mul(Rc, capFace.normal), pc = mul(Rc, capFace.point).map((v, k) => v + cap.position[k]);
  nearAll(nc, n.map(v => -v), 'face normals oppose', 1e-6);
  near(n.reduce((s, v, k) => s + v * (pc[k] - p[k]), 0), 0, 'face on the plane', 1e-6);
  // (Rigid, the same mate puts the cap elsewhere: the turn is what moved it.)
  const rigid = addMate({ ...both, instances: both.instances!.map(i => i.id === 'sub1' ? { ...i, joints: undefined } : i) }, { kind: 'coincident', a: { part: 'sub1/lid', face: LIDSIDE[0] }, b: { part: 'cap', face: 'n1.bottom' } }).doc.instances!.find(i => i.id === 'cap')!;
  assert.ok(rigid.position.some((v, k) => Math.abs(v - cap.position[k]) > 1) || rigid.rotation.some((v, k) => Math.abs(v - cap.rotation[k]) > 1));
});

test('names do not change with the pose: the folded table and the occurrence paths map as they did', () => {
  const posedOcc = { ...occurrence('s', [0, 0, 0]), joints: { 'base~lid': 1 } }, rigidOcc = occurrence('s', [0, 0, 0]);
  const a = Object.keys(tablesFor({ ...emptyDoc(), instances: [posedOcc] })('s/lid') ?? {}).sort(), b = Object.keys(tablesFor({ ...emptyDoc(), instances: [rigidOcc] })('s/lid') ?? {}).sort();
  assert.ok(a.length > 0); assert.deepEqual(a, b);
  const posed = bodyDocOf(posedOcc), folded = flattenAssembly(posed);
  for (const name of Object.keys(faceTableOf(folded))) { const o = faceOriginOf(posed, name); assert.equal(flatFaceOf(posed, o.path, o.face), name); }
  assert.deepEqual(Object.keys(faceTableOf(folded)).sort(), Object.keys(faceTableOf(flattenAssembly(rigidOcc.doc))).sort());
});

test('the BOM mass is the same whatever the pose', () => {
  const closed = bomViewOf(parent(), ev), open = bomViewOf(setInstanceJoints(parent(), { part: 'sub1', joints: { 'base~lid': 77 } }).doc, ev);
  assert.deepEqual(open.parts.map(p => [p.id, p.mass]), closed.parts.map(p => [p.id, p.mass]));
  assert.ok(closed.parts[0].mass > 0);
});

test('Save and Open keep the joints (a JSON round trip folds the same), and Undo is the previous document', () => {
  const doc = setInstanceJoints(parent(), { part: 'sub2', joints: { 'base~lid': 45 } }).doc, back = JSON.parse(JSON.stringify(doc)) as StudioDoc;
  assert.deepEqual(back.instances![1].joints, doc.instances![1].joints);
  assert.equal(JSON.stringify(placedBase(back.instances![1])), JSON.stringify(placedBase(doc.instances![1])));
  assert.notEqual(JSON.stringify(placedBase(back.instances![1])), JSON.stringify(placedBase(back.instances![0])));
});

test('a pattern copies the seed\'s joints, each occurrence posed alike', () => {
  const seeded = setInstanceJoints({ ...emptyDoc(), instances: [occurrence('sub1', [0, 0, 0])] }, { part: 'sub1', joints: { 'base~lid': 30 } }).doc;
  const patterned = addInstancePattern(seeded, { seed: 'sub1', kind: 'linear', dir: [1, 0, 0], spacing: 200, count: 3 }).doc;
  assert.equal(patterned.instances!.length, 3);
  for (const i of patterned.instances!) assert.deepEqual(i.joints, seeded.instances![0].joints);
  nearAll(lidOf(bodyDocOf(patterned.instances![2])).position, lidOf(bodyDocOf(patterned.instances![0])).position, 'same pose in each copy', 1e-9);
});

test('place_part keeps the joints; the nested lid is not an instance of the parent so the parent solve leaves it posed', () => {
  const doc = setInstanceJoints(parent(), { part: 'sub2', joints: { 'base~lid': 20 } }).doc, moved = placePart(doc, { part: 'sub2', position: [500, 0, 0] }).doc;
  assert.deepEqual(moved.instances![1].joints, doc.instances![1].joints);
});

test('the agent\'s place_part joints and get_assembly: values in degrees, a refusal in words, the problem listed', async () => {
  const state = { doc: parent(), bodies: [] as never[] };
  const listed = JSON.parse((await dispatchTool(state, 'get_assembly', {}, async d => evaluatePart(d, 1))).content);
  assert.deepEqual(listed.instances[0].joints.map((j: { key: string; type: string; value: number }) => [j.key, j.type, j.value]), [['base~lid', 'continuous', 0]]);
  const r = await dispatchTool(state, 'place_part', { part: 'sub2', joints: { 'base~lid': 90 } }, async d => evaluatePart(d, 1));
  assert.ok(!r.isError, r.content);
  assert.equal(JSON.parse(r.content).joints[0].value, 90);
  const next = r.state.doc.instances![1];
  nearAll(lidOf(bodyDocOf(next)).position, turned(90).position, 'agent pose', 1e-6);
  const bad = await dispatchTool(state, 'place_part', { part: 'sub2', joints: { zz: 1 } }, async d => evaluatePart(d, 1));
  assert.ok(bad.isError); assert.match(JSON.parse(bad.content).error, /has no joint "zz"/);
  const relisted = JSON.parse((await dispatchTool(r.state, 'get_assembly', {}, async d => evaluatePart(d, 1))).content);
  assert.equal(relisted.instances[1].joints[0].value, 90); assert.equal(relisted.instances[0].joints[0].value, 0);
  // The v2 group takes it as place's own parameter, so the per-turn budget holds.
  const v2 = await dispatchTool(state, 'assembly', { action: 'place', part: 'sub2', joints: { 'base~lid': 90 } }, async d => evaluatePart(d, 1));
  assert.equal(v2.content, r.content);
});

test('the facade: setPartJoints and partJoints, one document with the tool', () => {
  const a = assembly('flex').addPart('hinge', part('hinge').box({ w: 10, d: 10, h: 10 }));
  assert.throws(() => a.setPartJoints('hinge', { x: 1 }), (e: unknown) => e instanceof BarocssError);
  assert.throws(() => a.setPartJoints('base', { x: 1 }), /base part has no joints/);
  const doc: StudioDoc = parent();
  const fromDoc = (d: StudioDoc) => { const asm = assembly('x'); return new (asm.constructor as new (n: string, d: StudioDoc) => typeof asm)('x', d); };
  const base = fromDoc({ ...doc, instances: doc.instances!.map(i => ({ ...i, name: i.id })) });
  const set = base.setPartJoints('sub2', { 'base~lid': 90 });
  assert.equal(set.partJoints('sub2').joints[0].value, 90); assert.equal(set.partJoints('sub1').joints[0].value, 0);
  assert.deepEqual(set.doc.instances![1].joints, setInstanceJoints(doc, { part: 'sub2', joints: { 'base~lid': 90 } }).doc.instances![1].joints);
  assert.deepEqual(set.setPartJoints('sub2', { 'base~lid': null }).doc.instances![1].joints, undefined);
  assert.deepEqual(set.setPartJoints('sub2', {}, { replace: true }).doc.instances![1].joints, undefined);
});

test('M1: a pattern occurrence is driven by its seed: setting its joints is refused as place_part refuses it (model, tool, facade)', async () => {
  const seeded = addInstancePattern({ ...emptyDoc(), instances: [occurrence('sub1', [0, 0, 0])] }, { seed: 'sub1', kind: 'linear', dir: [1, 0, 0], spacing: 200, count: 2 }).doc;
  const copy = seeded.instances!.find(i => i.pattern)!;
  assert.throws(() => placePart(seeded, { part: copy.id, position: [1, 2, 3] }), /driven by its seed/);
  assert.throws(() => setInstanceJoints(seeded, { part: copy.id, joints: { 'base~lid': 10 } }), (e: unknown) => e instanceof BarocssError && e.code === 'PATTERN_DRIVEN' && /driven by its seed/.test(e.message));
  const r = await dispatchTool({ doc: seeded, bodies: [] }, 'place_part', { part: copy.id, joints: { 'base~lid': 10 } }, async d => evaluatePart(d, 1));
  assert.ok(r.isError); assert.match(JSON.parse(r.content).error, /driven by its seed/);
  const asm = new (assembly('x').constructor as new (n: string, d: StudioDoc) => ReturnType<typeof assembly>)('x', { ...seeded, instances: seeded.instances!.map(i => ({ ...i, name: i.id })) });
  assert.throws(() => asm.setPartJoints(copy.id, { 'base~lid': 10 }), /driven by its seed/);
  // (The seed itself still takes them, and the copies follow.)
  const done = setInstanceJoints(seeded, { part: 'sub1', joints: { 'base~lid': 10 } }).doc;
  assert.deepEqual(done.instances!.find(i => i.pattern)!.joints, done.instances![0].joints);
});

test('M2: Open refuses joints that are not an object of finite numbers, naming the part and the key; a non-finite value never poses', () => {
  const file = (joints: unknown) => JSON.stringify({ ...emptyDoc(), instances: [{ ...occurrence('door', [0, 0, 0]), joints }] });
  assert.ok('doc' in readStudioDoc(file({ 'base~lid': 0.5 })));
  for (const [bad, key] of [[{ 'base~lid': null }, 'base~lid'], [{ 'base~lid': 'x' }, 'base~lid'], [{ a: 1, b: {} }, 'b']] as const) {
    const r = readStudioDoc(file(bad)); assert.ok('error' in r, JSON.stringify(bad));
    assert.match(r.error, new RegExp(`instances\\[0\\] \\(door\\): joint "${key}" holds .*not a finite number`));
  }
  for (const bad of [[1], 'x', 5]) { const r = readStudioDoc(file(bad)); assert.ok('error' in r); assert.match(r.error, /instances\[0\] \(door\): "joints" is an object/); }
  const nested = JSON.stringify({ ...emptyDoc(), instances: [{ ...occurrence('outer', [0, 0, 0]), doc: { ...sub, instances: [{ ...occurrence('in', [0, 0, 0]), joints: { k: null } }] } }] });
  const n = readStudioDoc(nested); assert.ok('error' in n); assert.match(n.error, /instances\[0\]\.doc\.instances\[0\] \(in\): joint "k"/);
  for (const v of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const inst = { ...occurrence('door', [0, 0, 0]), joints: { 'base~lid': v } }, p = poseOf(inst);
    assert.equal(p.doc, inst.doc); assert.match(p.problem!, /Door|door \(door\): joint "base~lid" holds .*not a finite number/); assert.match(instanceJointsOf({ ...emptyDoc(), instances: [inst] }, 'door').problem!, /not a finite number/);
  }
});

test('L1: the problem names its own occurrence even when two occurrences share one sub-assembly document and the cache', () => {
  const a = { ...occurrence('first', [0, 0, 0]), joints: { gone: 1 } }, b = { ...occurrence('second', [300, 0, 0]), joints: { gone: 1 } };
  assert.match(poseOf(a).problem!, /^first \(first\) has no joint "gone"/);
  assert.match(poseOf(b).problem!, /^second \(second\) has no joint "gone"/);
  assert.match(poseOf(a).problem!, /^first \(first\)/);
  assert.deepEqual(jointProblemsOf({ ...emptyDoc(), instances: [b, a] }).map(p => p.part), ['second', 'first']);
});

test('L2: a stale key with value 0 is reported the same by poseOf, jointProblemsOf and instanceJointsOf; a sound zero stays rigid', () => {
  const stale = { ...occurrence('door', [0, 0, 0]), joints: { gone: 0 } }, doc = { ...emptyDoc(), instances: [stale] };
  assert.match(poseOf(stale).problem!, /has no joint "gone"/);
  assert.equal(jointProblemsOf(doc).length, 1);
  assert.match(instanceJointsOf(doc, 'door').problem!, /has no joint "gone"/);
  const zero = { ...occurrence('door', [0, 0, 0]), joints: { 'base~lid': 0 } };
  assert.equal(poseOf(zero).problem, undefined); assert.equal(poseOf(zero).doc, zero.doc);
  assert.equal(jointProblemsOf({ ...emptyDoc(), instances: [zero] }).length, 0);
});
