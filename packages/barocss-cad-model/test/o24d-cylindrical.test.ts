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
import { mateFacesOf, mateKindsOf, solveAssembly, type FaceTable, type Mate, type Vec3 } from '../src/assembly/mates';
import { tablesFor } from '../src/assembly/faces';
import { jointTree } from '../src/robot/joints';
import { loopTermsOf } from '../src/robot/loop';
import { dispatchTool, type ChatState } from '../src/chat/tools';

// Hand-declared axis/position oracles. Expected values never come from connectorOf or the solver.
const vector = (actual: readonly number[], expected: readonly number[]) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) <= 1e-9, `${actual} vs ${expected}`));
};
const source = (): StudioDoc => ({ ...rectanglePart(20, 20, 5), instances: [{ id: 'p', name: 'Moving', doc: rectanglePart(10, 10, 3), position: [9, 8, 7], rotation: [0, 0, 90] }] });
const options = (): AddMateOptions => ({ kind: 'cylindrical', a: { part: 'base', face: 'origin:xy' }, b: { part: 'p', face: 'origin:xy' } });
const offset = (): AddMateOptions => ({ ...options(), a: { ...options().a, at: { offset: [10, 20, 30] } }, b: { ...options().b, at: { offset: [2, 0, 4] } } });
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const pose = (doc: StudioDoc, position: Vec3, x: Vec3, z: Vec3) => {
  const p = doc.instances![0], r = rotationMatrix(p.rotation);
  vector(p.position, position); vector([r[0], r[3], r[6]], x); vector([r[2], r[5], r[8]], z);
};

test('O24 d cylindrical: default connectors retain the initial axial position and twist with one turn and slide', () => {
  const doc = source(), before = structuredClone(doc), r = addMate(doc, options());
  pose(r.doc, [0, 0, 7], [0, 1, 0], [0, 0, 1]); assert.deepEqual(r.freedom, { turns: 1, slides: 1 }); assert.deepEqual(r.problems, []);
  assert.equal(r.mate.kind, 'cylindrical'); assert.equal('flip' in r.mate, false); assert.equal(r.mate.a.at, undefined); assert.equal(r.mate.b.at, undefined);
  assert.deepEqual(doc, before); assert.deepEqual(solveDoc(r.doc).doc.instances, r.doc.instances);
});

test('O24 d cylindrical: independent axial slides and twists preserve the common line while lateral requests are removed', () => {
  const r = addMate(source(), offset()); pose(r.doc, [10, 18, 7], [0, 1, 0], [0, 0, 1]);
  for (const f of [
    { rotation: [0, 0, 0], axial: -12, position: [8, 20, -12], x: [1, 0, 0] },
    { rotation: [0, 0, 180], axial: 55, position: [12, 20, 55], x: [-1, 0, 0] },
    { rotation: [0, 0, 270], axial: 55, position: [10, 22, 55], x: [0, -1, 0] },
  ] satisfies { rotation: Vec3; axial: number; position: Vec3; x: Vec3 }[]) {
    const moved = placePart(r.doc, { part: 'p', rotation: f.rotation, position: [101, 102, f.axial] });
    assert.deepEqual(moved.problems, []); pose(moved.doc, f.position, f.x, [0, 0, 1]);
    // b's connector point is [2,0,4]. Its XY equals a's [10,20]; its Z is deliberately free.
    vector(moved.doc.instances![0].position.map((v, i) => v + 2 * f.x[i] + (i === 2 ? 4 : 0)), [10, 20, f.axial + 4]);
    assert.deepEqual(solveDoc(moved.doc).doc.instances, moved.doc.instances);
  }
});

test('O24 d cylindrical: forbidden tilt is corrected while an allowed starting twist and axial position remain', () => {
  const doc = source(); doc.instances![0] = { ...doc.instances![0], rotation: [30, 0, 90] };
  const r = addMate(doc, options()); pose(r.doc, [0, 0, 7], [0, 1, 0], [0, 0, 1]); assert.deepEqual(r.freedom, { turns: 1, slides: 1 });
  const opposite = source(); opposite.instances![0] = { ...opposite.instances![0], rotation: [180, 0, 0] };
  const aligned = addMate(opposite, options()); pose(aligned.doc, [0, 0, 7], [1, 0, 0], [0, 0, 1]);
  assert.deepEqual(solveDoc(aligned.doc).doc.instances, aligned.doc.instances);
});

test('O24 d cylindrical: a connector flip selects axis sense without adding a mate flip or fixing axial travel', () => {
  const r = addMate(source(), { ...options(), a: { ...options().a, at: { flip: true } } });
  pose(r.doc, [0, 0, 7], [0, -1, 0], [0, 0, -1]); assert.equal('flip' in r.mate, false); assert.deepEqual(r.freedom, { turns: 1, slides: 1 });
  const both = addMate(source(), { ...options(), a: { ...options().a, at: { flip: true } }, b: { ...options().b, at: { flip: true } } });
  pose(both.doc, [0, 0, 7], [0, 1, 0], [0, 0, 1]);
});

test('O24 d cylindrical: original flip then turn then local offset changes the axis line, not the free axial coordinate', () => {
  const o: AddMateOptions = { ...options(), a: { ...options().a, at: { flip: true, turn: 90, offset: [2, 3, 4] } }, b: { ...options().b, at: { flip: true, turn: 90, offset: [2, 0, 4] } } };
  const r = addMate(source(), o); pose(r.doc, [-5, -2, 7], [0, 1, 0], [0, 0, 1]);
  const tables = tablesFor(r.doc), sf = mateFacesOf(r.mate, { a: tables('base')!['origin:xy'], b: tables('p')!['origin:xy'] });
  assert.equal(sf.as, 'cylindrical'); assert.ok(sf.a.kind === 'cylinder' && sf.b.kind === 'cylinder');
  vector(sf.a.point, [-3, -2, -4]); vector(sf.b.point, [0, -2, -4]); vector(sf.a.axis, [0, 0, -1]); vector(sf.b.axis, [0, 0, -1]);
  assert.equal(sf.a.radius, 0); assert.equal(sf.b.radius, 0);
});

test('O24 d cylindrical: the free direction is the selected common connector axis, including a part X axis', () => {
  const doc = source(); doc.instances![0] = { ...doc.instances![0], rotation: [45, 0, 0] };
  const r = addMate(doc, { ...options(), a: { part: 'base', face: 'origin:yz' }, b: { part: 'p', face: 'origin:yz' } });
  pose(r.doc, [9, 0, 0], [1, 0, 0], [0, -Math.SQRT1_2, Math.SQRT1_2]); assert.deepEqual(r.freedom, { turns: 1, slides: 1 });
});

test('O24 d cylindrical: connector edits, removal, persistent signatures and fixed-side swapping retain owned input', () => {
  const o = offset(); o.a = { ...o.a, sig: { k: 'plane', p: [0, 0, 0], d: [0, 0, 1], s: 0 }, was: 'origin:previous' };
  const r = addMate(source(), o), before = structuredClone(r.doc), edited = editMate(r.doc, { id: r.mate.id, connectors: { a: { offset: [20, 20, 100] } } });
  pose(edited.doc, [20, 18, 7], [0, 1, 0], [0, 0, 1]); assert.deepEqual(edited.mate.a.sig, o.a.sig); assert.equal(edited.mate.a.was, o.a.was);
  const removed = editMate(edited.doc, { id: r.mate.id, connectors: { a: null, b: null } }); pose(removed.doc, [0, 0, 7], [0, 1, 0], [0, 0, 1]);
  assert.equal(removed.mate.a.at, undefined); assert.equal(removed.mate.b.at, undefined);
  const swapped = addMate(source(), { ...o, a: o.b, b: o.a }); assert.equal(swapped.mate.a.part, 'base'); assert.deepEqual(swapped.mate.a.sig, o.a.sig); pose(swapped.doc, [10, 18, 7], [0, 1, 0], [0, 0, 1]);
  assert.deepEqual(r.doc, before);
});

test('O24 d cylindrical: raw distances, angles, limits and direction fields refuse as VALUE before mutation', () => {
  const doc = source(), before = structuredClone(doc), r = addMate(doc, options()), saved = structuredClone(r.doc);
  for (const [key, value] of [['distance', 0], ['angle', 0], ['pitch', 0], ['ratio', 0], ['rel', {}], ['limits', {}], ['flip', false], ['flip', true], ['distance', undefined]] as const) {
    assert.throws(() => addMate(doc, { ...options(), [key]: value } as AddMateOptions), e => isRefusal(e, 'VALUE'));
    assert.throws(() => editMate(r.doc, { id: r.mate.id, [key]: value } as EditMateOptions), e => isRefusal(e, 'VALUE'));
  }
  assert.deepEqual(doc, before); assert.deepEqual(r.doc, saved);
});

test('O24 d cylindrical: invalid geometry/fixed parts refuse atomically and pending tables stay pending', () => {
  const doc = source(), before = structuredClone(doc);
  for (const [patch, code] of [
    [{ a: { part: 'missing', face: 'origin:xy' } }, 'NO_PART'],
    [{ b: { part: 'base', face: 'origin:xy' } }, 'MATE_SAME_PART'],
    [{ b: { part: 'p', face: 'missing' } }, 'MATE_FACE_UNKNOWN'],
    [{ a: { part: 'base', face: 'origin:xy', at: { point: 'end' } } }, 'CONNECTOR_POINT'],
    [{ b: { part: 'p', face: 'origin:xy', at: { turn: '90' } } }, 'CONNECTOR_INVALID'],
  ] as const) assert.throws(() => addMate(doc, { ...options(), ...patch } as unknown as AddMateOptions), e => isRefusal(e) && e.code === code);
  assert.throws(() => addMate({ ...doc, instances: doc.instances!.map(i => ({ ...i, grounded: true })) }, options()), e => isRefusal(e, 'MATE_BOTH_FIXED'));
  const pending = solveAssembly(doc.instances!, [{ id: 'm', ...options() }], () => undefined); assert.equal(pending.pending, true); assert.deepEqual(pending.instances, doc.instances);
  const bare: FaceTable = { bare: { kind: 'plane', point: [0, 0, 0], normal: [0, 0, 1] }, 'origin:xy': { kind: 'plane', point: [0, 0, 0], normal: [0, 0, 1] } };
  assert.match(solveAssembly(doc.instances!, [{ id: 'm', ...options(), a: { part: 'base', face: 'bare' } }], () => bare).problems[0].reason, /CONNECTOR_UNAVAILABLE/);
  assert.deepEqual(doc, before);
});

test('O24 d cylindrical: unsupported combinations refuse atomically while a compatible captured lock can hold a pose', () => {
  const r = addMate(source(), options()), before = structuredClone(r.doc);
  for (const kind of ['cylindrical', 'coincident', 'ball', 'fastened', 'universal'] as const) assert.throws(() => addMate(r.doc, { ...options(), kind }), e => isRefusal(e, 'MATE_UNMET'));
  const held = lockPart(r.doc, { part: 'p', to: 'base' }); assert.deepEqual(held.freedom, { turns: 0, slides: 0 }); pose(held.doc, [0, 0, 7], [0, 1, 0], [0, 0, 1]);
  const incompatible = lockPart(source(), { part: 'p', to: 'base' }); assert.throws(() => addMate(incompatible.doc, options()), e => isRefusal(e, 'MATE_UNMET'));
  assert.deepEqual(r.doc, before);
});

test('O24 d cylindrical: pair-level robot limits and loop terms remain unsupported without a fake joint chain', () => {
  const r = addMate(source(), options()), tree = jointTree({ instances: r.doc.instances!, mates: r.doc.mates!, tables: tablesFor(r.doc), settings: { version: 1, joints: { 'base~p': { lower: -10, upper: 10 } } } });
  assert.equal(tree.joints.length, 0); assert.equal(tree.links.filter(l => l.part === null).length, 0);
  assert.ok(tree.problems.some(p => p.code === 'MOTION_UNSUPPORTED' && p.mates?.includes(r.mate.id)
    && /pair-level cylindrical limits or ratings/.test(p.message) && /#0 axial slide, #1 axial turn/.test(p.message)));
  const missing: Mate = { ...r.mate, a: { part: 'base', face: 'missing' } }, invalid = jointTree({ instances: r.doc.instances!, mates: [missing], tables: tablesFor(r.doc) });
  assert.equal(invalid.joints.length, 0); assert.ok(invalid.problems.some(p => p.code === 'MATE_PROBLEM'));
  const loop = { ...tree, loops: [{ parts: ['base', 'p'] as [string, string], mates: [r.mate.id], freedom: 2, message: 'unsupported cylindrical loop fixture' }] };
  assert.throws(() => loopTermsOf(r.doc, loop), e => isRefusal(e, 'LOOP_MATE_UNSUPPORTED'));
});

test('O24 d cylindrical: classic discovery, Lock, Universal, Ball and Fastened keep distinct semantics', () => {
  const doc = source(), tables = tablesFor(doc); assert.deepEqual(mateKindsOf(options(), { a: tables('base')!['origin:xy'], b: tables('p')!['origin:xy'] }), ['coincident', 'distance', 'angle', 'cam']);
  for (const [kind, freedom, position, x] of [
    ['coincident', { turns: 1, slides: 2 }, [9, 8, 0], [0, 1, 0]],
    ['universal', { turns: 2, slides: 0 }, [0, 0, 0], [0, 1, 0]],
    ['ball', { turns: 3, slides: 0 }, [0, 0, 0], [0, 1, 0]],
    ['fastened', { turns: 0, slides: 0 }, [0, 0, 0], [1, 0, 0]],
  ] as const) { const r = addMate(doc, { ...options(), kind }); assert.deepEqual(r.freedom, freedom); pose(r.doc, [...position], [...x], [0, 0, 1]); }
  const locked = lockPart(doc, { part: 'p', to: 'base' }); pose(locked.doc, [9, 8, 7], [0, 1, 0], [0, 0, 1]); assert.equal(locked.mate.kind, 'lock');
});

test('O24 d cylindrical: Save/Open preserves the schema, axial position and raw nested/pending refusals', async () => {
  const r = addMate(source(), offset()), read = await readStudioFile(encodeStudioFile(r.doc)); assert.ok('doc' in read); assert.equal(read.doc.schema, 3); assert.equal(read.doc.units, 'mm'); assert.deepEqual(read.doc.mates, r.doc.mates);
  pose(solveDoc(read.doc).doc, [10, 18, 7], [0, 1, 0], [0, 0, 1]);
  const bad = { ...r.doc, mates: [{ ...r.mate, limits: {} }] }, expected = '[VALUE] A cylindrical mate cannot carry limits; its connector Z axes align with one free turn and one free axial slide.';
  for (const doc of [bad, { ...emptyDoc(), instances: [{ id: 'nested', doc: bad }] }, { ...emptyDoc(), pendingParts: { p: { doc: bad } } }]) { const text = JSON.stringify(doc); assert.deepEqual(readStudioDoc(text), { error: expected }); assert.equal(JSON.stringify(doc), text); }
});

test('O24 d cylindrical: v2 physical face references, connector edit and Save/Open retain a free axial coordinate', async () => {
  const doc = source(), built = await evaluate(doc); assert.ok(built.ok);
  const r = await dispatchTool({ doc, bodies: built.bodies }, 'assembly', { action: 'add_mate', ...options(), a: { part: 'base', face: 'n1.top' }, b: { part: 'p', face: 'n1.top' } }, evaluate);
  assert.ok(r.changed && !r.isError, r.content); assert.deepEqual(JSON.parse(r.content).freedom_left, { turns: 1, slides: 1 }); pose(r.state.doc, [15, 5, 7], [0, 1, 0], [0, 0, 1]);
  const signed = captureSignatures(r.state.doc, r.state.bodies); assert.ok(signed.mates![0].a.sig && signed.mates![0].b.sig);
  const edited = await dispatchTool({ ...r.state, doc: signed }, 'assembly', { action: 'edit_mate', id: signed.mates![0].id, connectors: { a: { offset: [10, 0, 50] } } }, evaluate);
  assert.ok(edited.changed && !edited.isError, edited.content); pose(edited.state.doc, [25, 5, 7], [0, 1, 0], [0, 0, 1]); assert.deepEqual(edited.state.doc.mates![0].a.sig, signed.mates![0].a.sig);
  const opened = readStudioDoc(JSON.stringify(edited.state.doc)); assert.ok('doc' in opened); const rebuilt = await evaluate(opened.doc); assert.ok(rebuilt.ok); assert.deepEqual((await verifyReferences(opened.doc, rebuilt.bodies, evaluate)).problems, []);
});

test('O24 d cylindrical: raw v2 VALUE precedes generic argument checks and preserves state, transaction and args', async () => {
  const doc = { ...source(), mates: [{ id: 'm', ...options() }] }, state: ChatState = { doc, bodies: [], tx: { applied: ['old'], checkpoints: { before: doc } } }, before = structuredClone(state);
  let evaluations = 0; const noGeometry = async () => { evaluations++; throw new Error('Raw fields must refuse before geometry'); };
  for (const extra of [{ distance: 0 }, { angle: 0 }, { pitch: 0 }, { ratio: 0 }, { rel: {} }, { limits: {} }, { flip: false }]) for (const action of ['add_mate', 'edit_mate']) {
    const args = action === 'add_mate' ? { action, ...options(), ...extra } : { action, id: 'm', ...extra }, copy = structuredClone(args), r = await dispatchTool(state, 'assembly', args, noGeometry);
    assert.ok(r.isError && !r.changed, r.content); assert.match(JSON.parse(r.content).error, /^\[VALUE\]/); assert.equal(r.state, state); assert.deepEqual(state, before); assert.deepEqual(args, copy);
  }
  for (const kind of ['coincident', 'concentric', 'distance', 'angle', 'tangent', 'lock', 'cam'] as const) { const r = await dispatchTool(state, 'assembly', { action: 'add_mate', ...options(), kind, pitch: 0 }, noGeometry); assert.match(JSON.parse(r.content).error, /^\[UNKNOWN_ARGUMENT\]/); }
  assert.equal(evaluations, 0);
});
