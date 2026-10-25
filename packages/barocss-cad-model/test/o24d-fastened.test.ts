import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { rotationMatrix } from '../src/engine/placement';
import { readStudioDoc } from '../src/engine/migrate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { evaluatePart } from '../src/engine/evaluate';
import { captureSignatures, verifyReferences } from '../src/engine/references';
import { isRefusal } from '../src/engine/refusal';
import { addMate, editMate, lockPart, solveDoc, type AddMateOptions, type EditMateOptions } from '../src/assembly/edit';
import { mateKindsOf, solveAssembly, type FaceTable, type Mate, type MateFace, type Vec3 } from '../src/assembly/mates';
import { tablesFor } from '../src/assembly/faces';
import type { Connector } from '../src/assembly/connectors';
import { jointTree } from '../src/robot/joints';
import { loopTermsOf } from '../src/robot/loop';
import { readUrdf, urdfFk } from '../src/robot/urdfCheck';
import { readMjcf, mjcfFk } from '../src/robot/mjcfCheck';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { treeOfDoc, urdfOfDoc, mjcfOfDoc } from '../src/chat/robot';

// F0–F8 use hand-declared axes/points. No connector or solver call generates the expected frames.
const vector = (actual: readonly number[], expected: readonly number[]) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) <= 1e-9, `${actual} vs ${expected}`));
};
const source = (): StudioDoc => ({ ...rectanglePart(20, 20, 5), instances: [{ id: 'p', name: 'Moving', doc: rectanglePart(10, 10, 3), position: [9, 8, 7], rotation: [0, 0, 90] }] });
const options = (at?: Connector, flip?: boolean): AddMateOptions => ({ kind: 'fastened', a: { part: 'base', face: 'origin:xy', ...(at === undefined ? {} : { at }) }, b: { part: 'p', face: 'origin:xy' }, ...(flip === undefined ? {} : { flip }) });
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const pose = (doc: StudioDoc, position: Vec3, x: Vec3, z: Vec3) => {
  const p = doc.instances![0], r = rotationMatrix(p.rotation);
  vector(p.position, position); vector([r[0], r[3], r[6]], x); vector([r[2], r[5], r[8]], z);
};

for (const f of [
  { id: 'F0 default frames', at: undefined, flip: undefined, position: [0, 0, 0], x: [1, 0, 0], z: [0, 0, 1] },
  { id: 'F1 offset in mm', at: { offset: [10, 0, 0] }, flip: undefined, position: [10, 0, 0], x: [1, 0, 0], z: [0, 0, 1] },
  { id: 'F2 positive quarter-turn', at: { turn: 90 }, flip: undefined, position: [0, 0, 0], x: [0, 1, 0], z: [0, 0, 1] },
  { id: 'F3 connector half-turn', at: { flip: true }, flip: undefined, position: [0, 0, 0], x: [1, 0, 0], z: [0, 0, -1] },
  { id: 'F4 mate half-turn', at: undefined, flip: true, position: [0, 0, 0], x: [1, 0, 0], z: [0, 0, -1] },
] satisfies { id: string; at?: Connector; flip?: boolean; position: Vec3; x: Vec3; z: Vec3 }[]) {
  test(`O24 d: ${f.id} fixes all six motions and makes one fixed joint`, () => {
    const doc = source(), before = structuredClone(doc), r = addMate(doc, options(f.at, f.flip));
    pose(r.doc, f.position, f.x, f.z); assert.deepEqual(r.freedom, { turns: 0, slides: 0 }); assert.deepEqual(r.problems, []);
    assert.deepEqual(doc, before); assert.equal(r.mate.rel, undefined);
    const tree = jointTree({ instances: r.doc.instances!, mates: r.doc.mates!, tables: tablesFor(r.doc) });
    assert.deepEqual(tree.problems, []); assert.deepEqual(tree.loops, []);
    assert.deepEqual(tree.joints.map(j => [j.type, j.parent, j.child]), [['fixed', 'base', 'p']]);
    assert.equal(tree.links.length, 2); assert.equal(tree.joints[0].limit, undefined);
    pose(solveDoc(r.doc).doc, f.position, f.x, f.z);
  });
}

test('O24 d: both local connector frames, their flip→turn→offset order and a placed fixed parent retain X', () => {
  const doc = source();
  // A has X=-Y, Z=-Z; its local [2,3,4] offset is [-3,-2,-4] in the part.
  const a = addMate(doc, options({ flip: true, turn: 90, offset: [2, 3, 4] }));
  pose(a.doc, [-3, -2, -4], [0, -1, 0], [0, 0, -1]);
  // B's connector origin is 2 along its own X. A's connector X points +Y.
  const b = addMate(doc, { ...options({ turn: 90, offset: [10, 0, 0] }), b: { part: 'p', face: 'origin:xy', at: { turn: 90, offset: [2, 0, 0] } } });
  pose(b.doc, [0, 8, 0], [1, 0, 0], [0, 0, 1]);
  const parent: StudioDoc = { ...doc, instances: [{ id: 'g', name: 'Ground', doc: rectanglePart(2, 2, 2), position: [20, 30, 40], rotation: [0, 0, 90], grounded: true }, ...doc.instances!] };
  const placed = addMate(parent, { ...options({ offset: [10, 0, 0] }), a: { part: 'g', face: 'origin:xy', at: { offset: [10, 0, 0] } } });
  const moving = placed.doc.instances!.find(i => i.id === 'p')!, r = rotationMatrix(moving.rotation);
  vector(moving.position, [20, 40, 40]); vector([r[0], r[3], r[6]], [0, 1, 0]); vector([r[2], r[5], r[8]], [0, 0, 1]);
});

test('O24 d: F5 lock captures the original placement; classic discovery/Auto still starts with coincident', () => {
  const doc = source(), r = lockPart(doc, { part: 'p', to: 'base' });
  pose(r.doc, [9, 8, 7], [0, 1, 0], [0, 0, 1]); assert.equal(r.mate.kind, 'lock');
  const tables = tablesFor(doc), fa = tables('base')!['origin:xy'], fb = tables('p')!['origin:xy'];
  const refs = { a: options().a, b: options().b };
  assert.deepEqual(mateKindsOf(refs, { a: fa, b: fb }), ['coincident', 'distance', 'angle', 'cam']);
  assert.deepEqual(mateKindsOf({ a: { ...refs.a, at: {} }, b: { ...refs.b, at: {} } }, { a: fa, b: fb }), ['coincident', 'distance', 'angle', 'concentric', 'tangent']);
  const classic = addMate(doc, { ...options(), kind: 'coincident' });
  assert.deepEqual(classic.freedom, { turns: 1, slides: 2 });
  pose(classic.doc, [9, 8, 0], [0, 1, 0], [0, 0, 1]);
});

test('O24 d: F6 fixed-side swap, repeat solve and connector edits retain stored signatures and input ownership', () => {
  const doc = source(), o = options({ offset: [10, 0, 0] });
  // Stored reference metadata is carried, not used as a substitute for resolving the current geometry.
  o.a = { ...o.a, sig: { k: 'plane', p: [0, 0, 0], d: [0, 0, 1], s: 0 }, was: 'origin:previous' };
  o.b = { ...o.b, sig: { k: 'plane', p: [0, 0, 0], d: [0, 0, 1], s: 0 } };
  const signed = addMate(doc, o).doc;
  const original = signed.mates![0], before = structuredClone(signed);
  const edited = editMate(signed, { id: original.id, connectors: { a: { turn: 90, offset: [10, 0, 0] } } });
  pose(edited.doc, [0, 10, 0], [0, 1, 0], [0, 0, 1]);
  assert.ok(original.a.sig && original.b.sig); assert.deepEqual(edited.mate.a.sig, original.a.sig); assert.deepEqual(edited.mate.b.sig, original.b.sig); assert.equal(edited.mate.a.was, original.a.was);
  assert.deepEqual(signed, before);
  const removed = editMate(edited.doc, { id: original.id, connectors: { a: null } });
  assert.equal(removed.mate.a.at, undefined); pose(removed.doc, [0, 0, 0], [1, 0, 0], [0, 0, 1]);
  const swapped = addMate(doc, { ...options(), a: { ...original.b }, b: { ...original.a } });
  assert.equal(swapped.mate.a.part, 'base'); assert.equal(swapped.mate.b.part, 'p');
  assert.deepEqual(swapped.mate.a.sig, original.a.sig); pose(swapped.doc, [10, 0, 0], [1, 0, 0], [0, 0, 1]);
  assert.deepEqual(solveDoc(swapped.doc).doc.instances, swapped.doc.instances);
});

test('O24 d: Save/Open keeps the existing schema and exact loader {error} envelope, including nested/pending documents', async () => {
  const doc = addMate(source(), options({ offset: [10, 0, 0] })).doc;
  const read = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in read);
  assert.equal(read.doc.schema, 3); assert.equal(read.doc.units, 'mm'); assert.deepEqual(read.doc.mates, doc.mates);
  pose(solveDoc(read.doc).doc, [10, 0, 0], [1, 0, 0], [0, 0, 1]);
  const bad = { ...doc, mates: [{ ...doc.mates![0], limits: {} }] };
  const expected = '[VALUE] A fastened mate cannot carry limits; its two connector frames fix all six motions.';
  for (const candidate of [bad, { ...emptyDoc(), instances: [{ id: 'nested', doc: bad }] }, { ...emptyDoc(), pendingParts: { nested: { doc: bad } } }]) {
    const before = JSON.stringify(candidate);
    assert.deepEqual(readStudioDoc(before), { error: expected });
    assert.deepEqual(await readStudioFile(new TextEncoder().encode(before)), { error: expected });
    assert.equal(JSON.stringify(candidate), before);
  }
});

test('O24 d: F7 URDF fixed and MJCF welded read-back convert the 10 mm offset exactly once', async () => {
  const doc = addMate(source(), options({ offset: [10, 0, 0] })).doc, built = await evaluate(doc); assert.ok(built.ok);
  const u = await urdfOfDoc(doc, built.bodies, evaluate, 'fastened'), m = await mjcfOfDoc(doc, built.bodies, evaluate, 'fastened');
  assert.ok(u.ok, JSON.stringify(u)); assert.ok(m.ok, JSON.stringify(m));
  const urdf = readUrdf(u.urdf, new Set(u.files.map(f => f.path))), mjcf = readMjcf(m.xml, new Set(m.files.map(f => f.path)));
  assert.deepEqual(urdf.issues, []); assert.deepEqual(mjcf.issues, []);
  assert.equal(urdf.model.joints.length, 1); assert.equal(urdf.model.joints[0].type, 'fixed');
  assert.equal(urdf.model.joints[0].limit, undefined); assert.equal(urdf.model.joints[0].mimic, undefined);
  vector(urdf.model.joints[0].xyz, [0.01, 0, 0]);
  const child = mjcf.model.bodies.find(b => b.name === m.names.links.p)!;
  assert.equal(child.joint, undefined); vector(child.pos, [0.01, 0, 0]);
  vector(urdfFk(urdf.model, {}).get(u.names.links.p)!.t, [0.01, 0, 0]);
  vector(mjcfFk(mjcf.model, {}).get(m.names.links.p)!.t, [0.01, 0, 0]);
  assert.equal(urdf.model.links.length, 2); assert.equal(mjcf.model.bodies.length, 2);
  assert.deepEqual(doc.mates![0].a.at?.offset, [10, 0, 0]);
});

test('O24 d: F8 core raw fixed-joint options are VALUE refusals, even zero/empty/explicit undefined; edits are atomic', () => {
  const doc = source(), before = structuredClone(doc), good = addMate(doc, options()).doc, goodBefore = structuredClone(good);
  for (const [key, value] of [['distance', 0], ['angle', 0], ['pitch', 0], ['ratio', 0], ['rel', {}], ['limits', {}], ['distance', undefined]] as const) {
    assert.throws(() => addMate(doc, { ...options(), [key]: value } as AddMateOptions), e => isRefusal(e, 'VALUE'));
    assert.throws(() => editMate(good, { id: good.mates![0].id, [key]: value } as EditMateOptions), e => isRefusal(e, 'VALUE'));
  }
  assert.deepEqual(doc, before); assert.deepEqual(good, goodBefore);
  for (const [patch, code] of [
    [{ a: { part: 'missing', face: 'origin:xy' } }, 'NO_PART'],
    [{ b: { part: 'base', face: 'origin:xy' } }, 'MATE_SAME_PART'],
    [{ b: { part: 'p', face: 'missing' } }, 'MATE_FACE_UNKNOWN'],
    [{ a: { part: 'base', face: 'origin:xy', at: { point: 'end' } } }, 'CONNECTOR_POINT'],
    [{ a: { part: 'base', face: 'origin:xy', at: { turn: '90' } } }, 'CONNECTOR_INVALID'],
  ] as const) assert.throws(() => addMate(doc, { ...options(), ...patch } as unknown as AddMateOptions), e => isRefusal(e) && e.code === code);
  const fixed: StudioDoc = { ...doc, instances: doc.instances!.map(i => ({ ...i, grounded: true })) };
  assert.throws(() => addMate(fixed, options()), e => isRefusal(e, 'MATE_BOTH_FIXED'));
});

test('O24 d: F8 extra fastened/classic/lock constraints are checked in either order; conflicts never commit', () => {
  const doc = source(), locked = lockPart(doc, { part: 'p', to: 'base' }).doc;
  assert.throws(() => addMate(locked, options()), e => isRefusal(e, 'MATE_UNMET'));
  const fastened = addMate(doc, options()).doc, before = structuredClone(fastened);
  assert.throws(() => addMate(fastened, options({ offset: [1, 0, 0] })), e => isRefusal(e, 'MATE_UNMET'));
  assert.throws(() => addMate(fastened, options({ turn: 90 })), e => isRefusal(e, 'MATE_UNMET'));
  assert.throws(() => addMate(fastened, { ...options(), kind: 'distance', distance: 2 }), e => isRefusal(e, 'MATE_UNMET'));
  const classic = addMate(doc, { ...options(), kind: 'distance', distance: 2 }).doc;
  assert.throws(() => addMate(classic, options()), e => isRefusal(e, 'MATE_UNMET'));
  assert.throws(() => addMate(fastened, { ...options(), kind: 'angle', angle: 90 }), e => isRefusal(e, 'MATE_UNMET'));
  assert.deepEqual(fastened, before);
  const two: StudioDoc = { ...fastened, mates: [...fastened.mates!, { ...fastened.mates![0], id: 'second', a: { ...options({ turn: 90 }).a } }] };
  assert.ok(solveDoc(two).problems.some(p => p.mate === 'second'));
});

test('O24 d: missing tables stay pending, missing frame geometry never becomes a fixed joint, loop term is typed unsupported', () => {
  const doc = source(), mate: Mate = { id: 'm', ...options() };
  const pending = solveAssembly(doc.instances!, [mate], () => undefined);
  assert.equal(pending.pending, true); assert.deepEqual(pending.instances, doc.instances); assert.deepEqual(pending.freedom, {});
  const plane: MateFace = { kind: 'plane', point: [0, 0, 0], normal: [0, 0, 1] };
  const table: FaceTable = { bare: plane, 'origin:xy': plane };
  const unavailable = solveAssembly(doc.instances!, [{ ...mate, a: { part: 'base', face: 'bare' } }], () => table);
  assert.match(unavailable.problems[0].reason, /CONNECTOR_UNAVAILABLE/);
  const missing = { ...mate, a: { part: 'base', face: 'missing' } };
  const tree = jointTree({ instances: doc.instances!, mates: [missing], tables: tablesFor(doc) });
  assert.ok(tree.problems.some(p => p.code === 'MATE_PROBLEM')); assert.equal(tree.joints.length, 0);
  const r = addMate(doc, options()), valid = jointTree({ instances: r.doc.instances!, mates: r.doc.mates!, tables: tablesFor(r.doc) });
  const loopTree = { ...valid, loops: [{ parts: ['base', 'p'] as [string, string], mates: [r.mate.id], freedom: 0, message: 'explicit unsupported closer fixture' }] };
  assert.throws(() => loopTermsOf(r.doc, loopTree), e => isRefusal(e, 'LOOP_MATE_UNSUPPORTED'));
});

test('O24 d: v2 existing add/edit handlers retain typed refusal, signatures, Save/Open and the fixed joint', async () => {
  const doc = source(), built = await evaluate(doc); assert.ok(built.ok);
  const added = await dispatchTool({ doc, bodies: built.bodies }, 'assembly', { action: 'add_mate', ...options(), a: { part: 'base', face: 'n1.top', at: { offset: [10, 0, 0] } }, b: { part: 'p', face: 'n1.top' } }, evaluate);
  assert.ok(!added.isError && added.changed, added.content);
  assert.deepEqual(JSON.parse(added.content).freedom_left, { turns: 0, slides: 0 });
  const signed = captureSignatures(added.state.doc, added.state.bodies), id = signed.mates![0].id;
  assert.ok(signed.mates![0].a.sig && signed.mates![0].b.sig);
  const edited = await dispatchTool({ ...added.state, doc: signed }, 'assembly', { action: 'edit_mate', id, connectors: { a: { turn: 90 } } }, evaluate);
  assert.ok(!edited.isError && edited.changed, edited.content); pose(edited.state.doc, [15, 5, 2], [0, 1, 0], [0, 0, 1]);
  assert.deepEqual(edited.state.doc.mates![0].a.sig, signed.mates![0].a.sig);
  const read = readStudioDoc(JSON.stringify(edited.state.doc)); assert.ok('doc' in read);
  const evaluated = await evaluate(read.doc); assert.ok(evaluated.ok);
  assert.deepEqual((await verifyReferences(read.doc, evaluated.bodies, evaluate)).problems, []);
  const tree = await treeOfDoc(read.doc, evaluated.bodies, evaluate); assert.deepEqual(tree.problems, []); assert.equal(tree.joints[0].type, 'fixed');
  for (const extra of [{ distance: 0 }, { angle: 0 }, { pitch: 0 }, { ratio: 0 }, { rel: {} }, { limits: {} }]) {
    const bad = await dispatchTool({ doc, bodies: built.bodies }, 'assembly', { action: 'add_mate', ...options(), ...extra }, evaluate);
    assert.ok(bad.isError && !bad.changed, bad.content); assert.match(bad.content, /VALUE/); assert.equal(bad.state.doc, doc);
    const badEdit = await dispatchTool(edited.state, 'assembly', { action: 'edit_mate', id, ...extra }, evaluate);
    assert.ok(badEdit.isError && !badEdit.changed, badEdit.content); assert.match(badEdit.content, /VALUE/); assert.equal(badEdit.state.doc, edited.state.doc);
  }
});

// The new kind's implicit default must not make a malformed classic connector acceptable.
test('O24 d: old connector and cam/lock refusals retain their original branches', () => {
  const doc = source(), before = structuredClone(doc);
  assert.throws(() => addMate(doc, { ...options(), kind: 'coincident', a: { ...options().a, at: null } } as unknown as AddMateOptions), e => isRefusal(e, 'CONNECTOR_INVALID'));
  assert.throws(() => addMate(doc, { ...options(), kind: 'cam', a: { ...options().a, at: {} } }), e => isRefusal(e, 'CONNECTOR_KIND'));
  const lock = lockPart(doc, { part: 'p', to: 'base' }).mate;
  assert.deepEqual(readStudioDoc(JSON.stringify({ ...doc, mates: [{ ...lock, a: { ...lock.a, at: {} } }] })), { error: '[CONNECTOR_KIND] A cam or lock mate cannot carry connectors.' });
  assert.deepEqual(doc, before);
});

test('O24 d: dispatcher VALUE precheck is geometry-free and preserves document, args, bodies and transaction checkpoints', async () => {
  const doc = { ...source(), mates: [{ id: 'm', ...options() }] };
  const state: ChatState = { doc, bodies: [], tx: { applied: ['old-op'], checkpoints: { before: doc } } };
  const snapshot = structuredClone(state);
  let evaluations = 0;
  const noGeometry = async () => { evaluations++; throw new Error('Validation must finish before geometry'); };
  for (const extra of [{ distance: 0 }, { angle: 0 }, { pitch: 0 }, { ratio: 0 }, { rel: {} }, { limits: {} }]) {
    for (const action of ['add_mate', 'edit_mate']) {
      const args = action === 'add_mate' ? { action, ...options(), ...extra } : { action, id: 'm', ...extra };
      const originalArgs = structuredClone(args), r = await dispatchTool(state, 'assembly', args, noGeometry);
      assert.ok(r.isError && !r.changed, r.content); assert.match(JSON.parse(r.content).error, /^\[VALUE\]/);
      assert.equal(r.state, state); assert.equal(r.state.doc, doc); assert.equal(r.state.bodies, state.bodies); assert.equal(r.state.tx, state.tx);
      assert.deepEqual(state, snapshot); assert.deepEqual(args, originalArgs);
    }
  }
  assert.equal(evaluations, 0);
  const unknown = await dispatchTool(state, 'assembly', { action: 'add_mate', ...options(), unrelated: 0 }, noGeometry);
  assert.match(JSON.parse(unknown.content).error, /^\[UNKNOWN_ARGUMENT\]/); assert.equal(unknown.state, state);
});

test('O24 d: every old kind and unrelated tool retains the generic unknown-argument refusal before geometry', async () => {
  let evaluations = 0;
  const noGeometry = async () => { evaluations++; throw new Error('Unknown arguments must not evaluate'); };
  for (const kind of ['coincident', 'concentric', 'distance', 'angle', 'tangent', 'lock', 'cam'] as const) {
    const doc = { ...source(), mates: [{ id: 'm', ...options(), kind }] }, state: ChatState = { doc, bodies: [] };
    for (const extra of [{ pitch: 0 }, { ratio: 0 }, { rel: {} }, { limits: {} }]) for (const action of ['add_mate', 'edit_mate']) {
      const args = action === 'add_mate' ? { action, ...options(), kind, ...extra } : { action, id: 'm', ...extra };
      const r = await dispatchTool(state, 'assembly', args, noGeometry);
      assert.ok(r.isError && !r.changed, r.content); assert.match(JSON.parse(r.content).error, /^\[UNKNOWN_ARGUMENT\]/);
      assert.equal(r.state, state); assert.equal(r.state.doc, doc);
    }
  }
  const state: ChatState = { doc: source(), bodies: [] };
  const r = await dispatchTool(state, 'assembly', { action: 'get', kind: 'fastened', limits: {} }, noGeometry);
  assert.match(JSON.parse(r.content).error, /^\[UNKNOWN_ARGUMENT\]/); assert.equal(r.state, state); assert.equal(evaluations, 0);
});
