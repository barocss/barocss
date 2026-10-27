import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { rotationMatrix } from '../src/engine/placement';
import { readStudioDoc } from '../src/engine/migrate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { evaluatePart } from '../src/engine/evaluate';
import { captureSignatures, verifyReferences } from '../src/engine/references';
import { isRefusal } from '../src/engine/refusal';
import { addMate, editMate, lockPart, placePart, solveDoc, type AddMateOptions, type EditMateOptions } from '../src/assembly/edit';
import { mateKindsOf, solveAssembly, type FaceTable, type Mate, type Vec3 } from '../src/assembly/mates';
import { tablesFor } from '../src/assembly/faces';
import { jointTree } from '../src/robot/joints';
import { forwardKinematics, applyTo } from '../src/robot/fk';
import { loopTermsOf } from '../src/robot/loop';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// Hand-declared point/axis oracles. No connector/solver result is used to generate expected values.
const vector = (actual: readonly number[], expected: readonly number[]) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((v, k) => assert.ok(Math.abs(v - expected[k]) <= 1e-9, `${actual} vs ${expected}`));
};
const source = (): StudioDoc => ({ ...rectanglePart(20, 20, 5), instances: [{ id: 'p', name: 'Moving', doc: rectanglePart(10, 10, 3), position: [9, 8, 7], rotation: [0, 0, 90] }] });
const options = (): AddMateOptions => ({ kind: 'ball', a: { part: 'base', face: 'origin:xy' }, b: { part: 'p', face: 'origin:xy' } });
const offset = (): AddMateOptions => ({ ...options(), a: { part: 'base', face: 'origin:xy', at: { offset: [10, 20, 30] } }, b: { part: 'p', face: 'origin:xy', at: { offset: [2, 0, 0] } } });
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const pose = (doc: StudioDoc, position: Vec3, x: Vec3, z: Vec3) => {
  const p = doc.instances![0], r = rotationMatrix(p.rotation);
  vector(p.position, position); vector([r[0], r[3], r[6]], x); vector([r[2], r[5], r[8]], z);
};

test('O24 d ball: omitted connectors align origins, retain the initial rotation and leave three turns', () => {
  const doc = source(), before = structuredClone(doc), r = addMate(doc, options());
  pose(r.doc, [0, 0, 0], [0, 1, 0], [0, 0, 1]);
  assert.deepEqual(r.freedom, { turns: 3, slides: 0 }); assert.deepEqual(r.problems, []);
  assert.equal(r.mate.a.at, undefined); assert.equal(r.mate.b.at, undefined); assert.equal(r.mate.rel, undefined);
  assert.deepEqual(doc, before); assert.deepEqual(solveDoc(r.doc).doc.instances, r.doc.instances);
});

test('O24 d ball: different connector Z/X directions do not become angular constraints', () => {
  const doc = source(); doc.instances![0] = { ...doc.instances![0], rotation: [90, 0, 0] };
  const r = addMate(doc, { ...options(), a: { part: 'base', face: 'origin:yz', at: { turn: 90, flip: true } }, b: { part: 'p', face: 'origin:xz', at: { turn: -90 } } });
  pose(r.doc, [0, 0, 0], [1, 0, 0], [0, -1, 0]); assert.deepEqual(r.freedom, { turns: 3, slides: 0 });
  // Local flip→turn→offset remains the existing connector rule; it changes an anchor, not the body's rotation.
  const shifted = addMate(source(), { ...options(), a: { part: 'base', face: 'origin:xy', at: { flip: true, turn: 90, offset: [2, 3, 4] } } });
  pose(shifted.doc, [-3, -2, -4], [0, 1, 0], [0, 0, 1]);
});

test('O24 d ball: offset anchors coincide in mm while rotations about all three axes remain available', () => {
  const r = addMate(source(), offset()); pose(r.doc, [10, 18, 30], [0, 1, 0], [0, 0, 1]);
  for (const f of [
    { rotation: [90, 0, 0], position: [8, 20, 30], x: [1, 0, 0], z: [0, -1, 0] },
    { rotation: [0, 90, 0], position: [10, 20, 32], x: [0, 0, -1], z: [1, 0, 0] },
    { rotation: [0, 0, 180], position: [12, 20, 30], x: [-1, 0, 0], z: [0, 0, 1] },
  ] satisfies { rotation: Vec3; position: Vec3; x: Vec3; z: Vec3 }[]) {
    const moved = placePart(r.doc, { part: 'p', rotation: f.rotation });
    assert.deepEqual(moved.problems, []); pose(moved.doc, f.position, f.x, f.z);
  }
});

test('O24 d ball: the existing free-twist consumer makes three rotational joints about one anchor, never a fixed joint', () => {
  const r = addMate(source(), offset()), tree = jointTree({ instances: r.doc.instances!, mates: r.doc.mates!, tables: tablesFor(r.doc) });
  assert.deepEqual(tree.problems, []); assert.equal(tree.joints.length, 3);
  assert.ok(tree.joints.every(j => j.type === 'continuous')); assert.ok(tree.joints.every(j => j.limit === undefined));
  assert.deepEqual(tree.joints.map(j => j.axis), [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  assert.ok(tree.notes.every(p => p.code === 'LIMITS_MISSING'), 'no export ratings are invented');
  const anchor: Vec3 = [10, 20, 30];
  for (const [i, point, expected] of [
    [0, [10, 20, 31], [10, 19, 30]],
    [1, [10, 20, 31], [11, 20, 30]],
    [2, [11, 20, 30], [10, 21, 30]],
  ] as const) {
    const fk = forwardKinematics(tree, { [tree.joints[i].key]: Math.PI / 2 }), motion = fk.motions.get('p')!;
    vector(applyTo(motion, anchor), anchor); vector(applyTo(motion, point), expected);
  }
});

test('O24 d ball: unsupported two-turn robot combinations and ball loop terms stay explicit refusals', () => {
  const doc = source(); doc.instances![0] = { ...doc.instances![0], rotation: [90, 0, 0] };
  const ball = addMate(doc, options()), constrained = addMate(ball.doc, { ...options(), kind: 'angle', angle: 90 });
  const tree = jointTree({ instances: constrained.doc.instances!, mates: constrained.doc.mates!, tables: tablesFor(constrained.doc) });
  assert.ok(tree.problems.some(p => p.code === 'MOTION_UNSUPPORTED')); assert.equal(tree.joints.length, 0);
  const simple = jointTree({ instances: ball.doc.instances!, mates: ball.doc.mates!, tables: tablesFor(ball.doc) });
  const loop = { ...simple, loops: [{ parts: ['base', 'p'] as [string, string], mates: [ball.mate.id], freedom: 3, message: 'unsupported ball loop fixture' }] };
  assert.throws(() => loopTermsOf(ball.doc, loop), e => isRefusal(e, 'LOOP_MATE_UNSUPPORTED'));
});

test('O24 d ball: edits, fixed-side normalization and signatures keep owned input and persistent references', () => {
  const o = offset(); o.a = { ...o.a, sig: { k: 'plane', p: [0, 0, 0], d: [0, 0, 1], s: 0 }, was: 'origin:previous' };
  const r = addMate(source(), o), before = structuredClone(r.doc);
  const edited = editMate(r.doc, { id: r.mate.id, connectors: { a: { offset: [20, 20, 30] } } });
  pose(edited.doc, [20, 18, 30], [0, 1, 0], [0, 0, 1]); assert.deepEqual(edited.mate.a.sig, r.mate.a.sig); assert.equal(edited.mate.a.was, r.mate.a.was);
  const removed = editMate(edited.doc, { id: r.mate.id, connectors: { a: null, b: null } });
  pose(removed.doc, [0, 0, 0], [0, 1, 0], [0, 0, 1]); assert.equal(removed.mate.a.at, undefined); assert.equal(removed.mate.b.at, undefined);
  const swapped = addMate(source(), { ...o, a: o.b, b: o.a });
  assert.equal(swapped.mate.a.part, 'base'); assert.deepEqual(swapped.mate.a.sig, o.a.sig); pose(swapped.doc, [10, 18, 30], [0, 1, 0], [0, 0, 1]);
  assert.deepEqual(r.doc, before);
});

test('O24 d ball: Save/Open retains the latest schema and validates nested/pending raw options without geometry', async () => {
  const r = addMate(source(), offset()), read = await readStudioFile(encodeStudioFile(r.doc)); assert.ok('doc' in read);
  assert.equal(read.doc.schema, 3); assert.equal(read.doc.units, 'mm'); assert.deepEqual(read.doc.mates, r.doc.mates);
  pose(solveDoc(read.doc).doc, [10, 18, 30], [0, 1, 0], [0, 0, 1]);
  const bad = { ...r.doc, mates: [{ ...r.mate, limits: {} }] }, expected = '[VALUE] A ball mate cannot carry limits; its connector origins coincide and all three turns remain free.';
  for (const doc of [bad, { ...emptyDoc(), instances: [{ id: 'nested', doc: bad }] }, { ...emptyDoc(), pendingParts: { p: { doc: bad } } }]) {
    const text = JSON.stringify(doc); assert.deepEqual(readStudioDoc(text), { error: expected }); assert.equal(JSON.stringify(doc), text);
  }
});

test('O24 d ball: raw scalar/direction fields are VALUE refusals, even zero, empty, false or explicit undefined', () => {
  const doc = source(), before = structuredClone(doc), r = addMate(doc, options()), saved = structuredClone(r.doc);
  for (const [key, value] of [['distance', 0], ['angle', 0], ['pitch', 0], ['ratio', 0], ['rel', {}], ['limits', {}], ['flip', false], ['flip', true], ['distance', undefined]] as const) {
    assert.throws(() => addMate(doc, { ...options(), [key]: value } as AddMateOptions), e => isRefusal(e, 'VALUE'));
    assert.throws(() => editMate(r.doc, { id: r.mate.id, [key]: value } as EditMateOptions), e => isRefusal(e, 'VALUE'));
  }
  assert.deepEqual(doc, before); assert.deepEqual(r.doc, saved);
});

test('O24 d ball: missing/bad references and constraints refuse atomically; pending tables remain pending', () => {
  const doc = source(), before = structuredClone(doc);
  for (const [patch, code] of [
    [{ a: { part: 'missing', face: 'origin:xy' } }, 'NO_PART'],
    [{ b: { part: 'base', face: 'origin:xy' } }, 'MATE_SAME_PART'],
    [{ b: { part: 'p', face: 'missing' } }, 'MATE_FACE_UNKNOWN'],
    [{ a: { part: 'base', face: 'origin:xy', at: { point: 'end' } } }, 'CONNECTOR_POINT'],
    [{ b: { part: 'p', face: 'origin:xy', at: { turn: '90' } } }, 'CONNECTOR_INVALID'],
  ] as const) assert.throws(() => addMate(doc, { ...options(), ...patch } as unknown as AddMateOptions), e => isRefusal(e) && e.code === code);
  const fixed = { ...doc, instances: doc.instances!.map(i => ({ ...i, grounded: true })) };
  assert.throws(() => addMate(fixed, options()), e => isRefusal(e, 'MATE_BOTH_FIXED'));
  const ball = addMate(doc, options()).doc;
  assert.throws(() => addMate(ball, { ...options(), a: { ...options().a, at: { offset: [1, 0, 0] } } }), e => isRefusal(e, 'MATE_UNMET'));
  assert.throws(() => addMate(ball, { ...options(), a: { ...options().a, at: { offset: [0, 1, 0] } }, b: { ...options().b, at: { offset: [1, 0, 0] } } }), e => isRefusal(e, 'MATE_UNMET') && /unsupported rotational solve/.test(e.message));
  const duplicate = addMate(ball, options()); assert.deepEqual(duplicate.freedom, { turns: 3, slides: 0 });
  const pending = solveAssembly(doc.instances!, [{ id: 'm', ...options() }], () => undefined); assert.equal(pending.pending, true); assert.deepEqual(pending.instances, doc.instances);
  const bare: FaceTable = { bare: { kind: 'plane', point: [0, 0, 0], normal: [0, 0, 1] }, 'origin:xy': { kind: 'plane', point: [0, 0, 0], normal: [0, 0, 1] } };
  const unavailable = solveAssembly(doc.instances!, [{ id: 'm', ...options(), a: { part: 'base', face: 'bare' } }], () => bare); assert.match(unavailable.problems[0].reason, /CONNECTOR_UNAVAILABLE/);
  const missing: Mate = { id: 'm', ...options(), a: { part: 'base', face: 'missing' } };
  const tree = jointTree({ instances: doc.instances!, mates: [missing], tables: tablesFor(doc) }); assert.ok(tree.problems.some(p => p.code === 'MATE_PROBLEM')); assert.equal(tree.joints.length, 0);
  assert.deepEqual(doc, before);
});

test('O24 d ball: old discovery, Lock and Fastened retain their original meanings; compatible constraints still combine', () => {
  const doc = source(), tables = tablesFor(doc), kinds = mateKindsOf(options(), { a: tables('base')!['origin:xy'], b: tables('p')!['origin:xy'] });
  assert.deepEqual(kinds, ['coincident', 'distance', 'angle', 'cam']);
  const old = addMate(doc, { ...options(), kind: 'coincident' }); assert.deepEqual(old.freedom, { turns: 1, slides: 2 }); pose(old.doc, [9, 8, 0], [0, 1, 0], [0, 0, 1]);
  const lock = lockPart(doc, { part: 'p', to: 'base' }); pose(lock.doc, [9, 8, 7], [0, 1, 0], [0, 0, 1]); assert.equal(lock.mate.kind, 'lock');
  assert.throws(() => addMate(lock.doc, options()), e => isRefusal(e, 'MATE_UNMET'));
  const fastened = addMate(doc, { ...options(), kind: 'fastened' }); pose(fastened.doc, [0, 0, 0], [1, 0, 0], [0, 0, 1]); assert.deepEqual(fastened.freedom, { turns: 0, slides: 0 });
  const ball = addMate(fastened.doc, options()); assert.deepEqual(ball.freedom, { turns: 0, slides: 0 }); assert.deepEqual(ball.problems, []);
});

test('O24 d ball: v2 add/edit, captured physical signatures and saved references preserve the three-turn joint', async () => {
  const doc = source(), built = await evaluate(doc); assert.ok(built.ok);
  const r = await dispatchTool({ doc, bodies: built.bodies }, 'assembly', { action: 'add_mate', ...options(), a: { part: 'base', face: 'n1.top' }, b: { part: 'p', face: 'n1.top' } }, evaluate);
  assert.ok(r.changed && !r.isError, r.content); assert.deepEqual(JSON.parse(r.content).freedom_left, { turns: 3, slides: 0 });
  // [10,10,5] minus Rz90*[5,5,3] = [15,5,2].
  pose(r.state.doc, [15, 5, 2], [0, 1, 0], [0, 0, 1]);
  const signed = captureSignatures(r.state.doc, r.state.bodies); assert.ok(signed.mates![0].a.sig && signed.mates![0].b.sig);
  const edited = await dispatchTool({ ...r.state, doc: signed }, 'assembly', { action: 'edit_mate', id: signed.mates![0].id, connectors: { a: { offset: [10, 0, 0] } } }, evaluate);
  assert.ok(edited.changed && !edited.isError, edited.content); pose(edited.state.doc, [25, 5, 2], [0, 1, 0], [0, 0, 1]);
  assert.deepEqual(edited.state.doc.mates![0].a.sig, signed.mates![0].a.sig);
  const opened = readStudioDoc(JSON.stringify(edited.state.doc)); assert.ok('doc' in opened);
  const rebuilt = await evaluate(opened.doc); assert.ok(rebuilt.ok); assert.deepEqual((await verifyReferences(opened.doc, rebuilt.bodies, evaluate)).problems, []);
});

test('O24 d ball: raw v2 refusal happens before geometry and preserves state/transaction/arguments; old kinds keep UNKNOWN_ARGUMENT', async () => {
  const doc = { ...source(), mates: [{ id: 'm', ...options() }] }, state: ChatState = { doc, bodies: [], tx: { applied: ['old'], checkpoints: { before: doc } } }, before = structuredClone(state);
  let evaluations = 0; const noGeometry = async () => { evaluations++; throw new Error('Raw options must be refused before geometry'); };
  for (const extra of [{ pitch: 0 }, { ratio: 0 }, { limits: {} }, { rel: {} }, { distance: 0 }, { angle: 0 }, { flip: false }]) for (const action of ['add_mate', 'edit_mate']) {
    const args = action === 'add_mate' ? { action, ...options(), ...extra } : { action, id: 'm', ...extra }, copy = structuredClone(args), r = await dispatchTool(state, 'assembly', args, noGeometry);
    assert.ok(r.isError && !r.changed, r.content); assert.match(JSON.parse(r.content).error, /^\[VALUE\]/); assert.equal(r.state, state); assert.deepEqual(state, before); assert.deepEqual(args, copy);
  }
  for (const kind of ['coincident', 'concentric', 'distance', 'angle', 'tangent', 'lock', 'cam'] as const) {
    const r = await dispatchTool(state, 'assembly', { action: 'add_mate', ...options(), kind, pitch: 0 }, noGeometry);
    assert.match(JSON.parse(r.content).error, /^\[UNKNOWN_ARGUMENT\]/); assert.equal(r.state, state);
  }
  const fastened = await dispatchTool(state, 'assembly', { action: 'add_mate', ...options(), kind: 'fastened', distance: 0 }, noGeometry);
  assert.match(JSON.parse(fastened.content).error, /^\[VALUE\] A fastened mate/); assert.equal(evaluations, 0);
});
