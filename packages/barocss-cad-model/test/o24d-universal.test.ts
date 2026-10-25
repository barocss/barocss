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

// Oracles are hand-declared points/axes, not connector/solver outputs. a.Z is fixed, b.X moves.
const vector = (actual: readonly number[], expected: readonly number[]) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) <= 1e-9, `${actual} vs ${expected}`));
};
const source = (): StudioDoc => ({ ...rectanglePart(20, 20, 5), instances: [{ id: 'p', name: 'Moving', doc: rectanglePart(10, 10, 3), position: [9, 8, 7], rotation: [0, 0, 90] }] });
const options = (): AddMateOptions => ({ kind: 'universal', a: { part: 'base', face: 'origin:xy' }, b: { part: 'p', face: 'origin:xy' } });
const offset = (): AddMateOptions => ({ ...options(), a: { ...options().a, at: { offset: [10, 20, 30] } }, b: { ...options().b, at: { offset: [2, 0, 0] } } });
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const pose = (doc: StudioDoc, position: Vec3, x: Vec3, z: Vec3) => {
  const p = doc.instances![0], r = rotationMatrix(p.rotation);
  vector(p.position, position); vector([r[0], r[3], r[6]], x); vector([r[2], r[5], r[8]], z);
};

test('O24 d universal: default frames hold origins and perpendicular a.Z/b.X, leaving two turns and no slide', () => {
  const doc = source(), before = structuredClone(doc), r = addMate(doc, options());
  pose(r.doc, [0, 0, 0], [0, 1, 0], [0, 0, 1]);
  assert.deepEqual(r.freedom, { turns: 2, slides: 0 }); assert.deepEqual(r.problems, []);
  assert.equal(r.mate.a.at, undefined); assert.equal(r.mate.b.at, undefined); assert.equal(r.mate.rel, undefined);
  assert.deepEqual(doc, before); assert.deepEqual(solveDoc(r.doc).doc.instances, r.doc.instances);
});

test('O24 d universal: independent finite turns about fixed Z and moving X retain the anchor', () => {
  const r = addMate(source(), offset()); pose(r.doc, [10, 18, 30], [0, 1, 0], [0, 0, 1]);
  // R = Rz(alpha) Rx(beta). Varying either angle keeps b.X perpendicular to a.Z.
  // Three independent point constraints forbid all slides; the dot product forbids the third turn.
  for (const f of [
    { rotation: [0, 0, 180], position: [12, 20, 30], x: [-1, 0, 0], z: [0, 0, 1] },
    { rotation: [90, 0, 90], position: [10, 18, 30], x: [0, 1, 0], z: [1, 0, 0] },
    { rotation: [90, 0, 180], position: [12, 20, 30], x: [-1, 0, 0], z: [0, 1, 0] },
  ] satisfies { rotation: Vec3; position: Vec3; x: Vec3; z: Vec3 }[]) {
    const moved = placePart(r.doc, { part: 'p', rotation: f.rotation, position: [100, 200, 300] });
    assert.deepEqual(moved.problems, []); pose(moved.doc, f.position, f.x, f.z);
    const instance = moved.doc.instances![0];
    vector(instance.position.map((v, i) => v + 2 * f.x[i]), [10, 20, 30]);
    assert.equal(f.x[2], 0); assert.deepEqual(solveDoc(moved.doc).doc.instances, moved.doc.instances);
  }
});

test('O24 d universal: the forbidden turn is corrected toward the nearest initial branch', () => {
  for (const f of [
    { start: [0, 30, 0], position: [8, 20, 30], x: [1, 0, 0], z: [0, 0, 1] },
    { start: [0, 150, 0], position: [12, 20, 30], x: [-1, 0, 0], z: [0, 0, -1] },
  ] satisfies { start: Vec3; position: Vec3; x: Vec3; z: Vec3 }[]) {
    const doc = source(); doc.instances![0] = { ...doc.instances![0], rotation: f.start };
    const r = addMate(doc, offset()); pose(r.doc, f.position, f.x, f.z);
    assert.deepEqual(r.freedom, { turns: 2, slides: 0 }); assert.deepEqual(solveDoc(r.doc).doc.instances, r.doc.instances);
  }
});

test('O24 d universal: parallel and antiparallel starting axes take the existing deterministic perpendicular branch', () => {
  for (const [angle, z] of [[90, [1, 0, 0]], [-90, [-1, 0, 0]]] satisfies [number, Vec3][]) {
    const doc = source(); doc.instances![0] = { ...doc.instances![0], rotation: [0, angle, 0] };
    const r = addMate(doc, offset()); pose(r.doc, [10, 18, 30], [0, 1, 0], z);
    assert.deepEqual(r.problems, []); assert.deepEqual(r.freedom, { turns: 2, slides: 0 });
    assert.deepEqual(solveDoc(r.doc).doc.instances, r.doc.instances);
  }
});

test('O24 d universal: connector local flip, turn and offset keep the original frame contract', () => {
  const o: AddMateOptions = { ...options(), a: { ...options().a, at: { flip: true, turn: 90, offset: [2, 3, 4] } }, b: { ...options().b, at: { turn: 90, offset: [2, 0, 0] } } };
  const r = addMate(source(), o); pose(r.doc, [-1, -2, -4], [0, 1, 0], [0, 0, 1]);
  const tables = tablesFor(r.doc), sf = mateFacesOf(r.mate, { a: tables('base')!['origin:xy'], b: tables('p')!['origin:xy'] });
  assert.ok(sf.a.kind === 'plane' && sf.b.kind === 'plane');
  vector(sf.a.point, [-3, -2, -4]); vector(sf.a.normal, [0, 0, -1]); vector(sf.b.point, [0, 2, 0]); vector(sf.b.normal, [0, 1, 0]);
  const reversed = addMate(source(), { ...o, b: { ...o.b, at: { flip: true, turn: 90, offset: [2, 0, 0] } } });
  pose(reversed.doc, [-5, -2, -4], [0, 1, 0], [0, 0, 1]);
  const tilted = source(); tilted.instances![0] = { ...tilted.instances![0], rotation: [0, 30, 0] };
  const turnAxis = addMate(tilted, { ...options(), b: { ...options().b, at: { turn: 90 } } });
  pose(turnAxis.doc, [0, 0, 0], [Math.sqrt(3) / 2, 0, -0.5], [0.5, 0, Math.sqrt(3) / 2]);
});

test('O24 d universal: axes come from the selected sides rather than aligning complete frames', () => {
  const r = addMate(source(), { ...options(), a: { part: 'base', face: 'origin:yz' }, b: { part: 'p', face: 'origin:xz' } });
  pose(r.doc, [0, 0, 0], [0, 1, 0], [0, 0, 1]); assert.deepEqual(r.freedom, { turns: 2, slides: 0 });
  // a.Z is world X; b.X is world Y. The two connector Z axes need not align.
});

test('O24 d universal: connector edits/removal and fixed-side normalization preserve signatures and owned input', () => {
  const o = offset(); o.a = { ...o.a, sig: { k: 'plane', p: [0, 0, 0], d: [0, 0, 1], s: 0 }, was: 'origin:previous' };
  const r = addMate(source(), o), before = structuredClone(r.doc);
  const edited = editMate(r.doc, { id: r.mate.id, connectors: { a: { offset: [20, 20, 30] } } });
  pose(edited.doc, [20, 18, 30], [0, 1, 0], [0, 0, 1]); assert.deepEqual(edited.mate.a.sig, r.mate.a.sig); assert.equal(edited.mate.a.was, o.a.was);
  const removed = editMate(edited.doc, { id: r.mate.id, connectors: { a: null, b: null } });
  pose(removed.doc, [0, 0, 0], [0, 1, 0], [0, 0, 1]); assert.equal(removed.mate.a.at, undefined); assert.equal(removed.mate.b.at, undefined);
  const swapped = addMate(source(), { ...o, a: o.b, b: o.a });
  assert.equal(swapped.mate.a.part, 'base'); assert.deepEqual(swapped.mate.a.sig, o.a.sig); pose(swapped.doc, [10, 18, 30], [0, 1, 0], [0, 0, 1]);
  assert.deepEqual(r.doc, before);
});

test('O24 d universal: raw mate scalars/flip/limits are VALUE refusals before mutation, including explicit undefined', () => {
  const doc = source(), before = structuredClone(doc), r = addMate(doc, options()), saved = structuredClone(r.doc);
  for (const [key, value] of [['distance', 0], ['angle', 90], ['pitch', 0], ['ratio', 0], ['rel', {}], ['limits', {}], ['flip', false], ['flip', true], ['distance', undefined]] as const) {
    assert.throws(() => addMate(doc, { ...options(), [key]: value } as AddMateOptions), e => isRefusal(e, 'VALUE'));
    assert.throws(() => editMate(r.doc, { id: r.mate.id, [key]: value } as EditMateOptions), e => isRefusal(e, 'VALUE'));
  }
  assert.deepEqual(doc, before); assert.deepEqual(r.doc, saved);
});

test('O24 d universal: missing geometry, invalid connector and fixed/pending parts keep explicit refusals', () => {
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
  const unavailable = solveAssembly(doc.instances!, [{ id: 'm', ...options(), a: { part: 'base', face: 'bare' } }], () => bare); assert.match(unavailable.problems[0].reason, /CONNECTOR_UNAVAILABLE/);
  assert.deepEqual(doc, before);
});

test('O24 d universal: coupled mate combinations refuse atomically while a compatible captured lock can hold the pose', () => {
  const r = addMate(source(), options()), before = structuredClone(r.doc);
  for (const kind of ['universal', 'ball', 'fastened', 'coincident'] as const) {
    assert.throws(() => addMate(r.doc, { ...options(), kind }), e => isRefusal(e, 'MATE_UNMET') && /unsupported coupled solve/.test(e.message));
  }
  const ball = addMate(source(), { ...options(), kind: 'ball' });
  assert.throws(() => addMate(ball.doc, options()), e => isRefusal(e, 'MATE_UNMET'));
  const held = lockPart(r.doc, { part: 'p', to: 'base' }); assert.deepEqual(held.freedom, { turns: 0, slides: 0 });
  pose(held.doc, [0, 0, 0], [0, 1, 0], [0, 0, 1]);
  const locked = lockPart(source(), { part: 'p', to: 'base' });
  assert.throws(() => addMate(locked.doc, options()), e => isRefusal(e, 'MATE_UNMET'));
  assert.deepEqual(r.doc, before);
});

test('O24 d universal: pair-level robot limits and loop terms remain unsupported without a fake joint chain', () => {
  const r = addMate(source(), options()), tree = jointTree({ instances: r.doc.instances!, mates: r.doc.mates!, tables: tablesFor(r.doc), settings: { version: 1, joints: { 'base~p': { lower: -1, upper: 1, effort: 10, velocity: 1 } } } });
  assert.equal(tree.joints.length, 0); assert.equal(tree.links.filter(l => l.part === null).length, 0);
  assert.ok(tree.problems.some(p => p.code === 'MOTION_UNSUPPORTED' && p.mates?.includes(r.mate.id)
    && /pair-level universal limits or ratings/.test(p.message) && /#0 a\.Z, #1 b\.X/.test(p.message)));
  const missing: Mate = { ...r.mate, a: { part: 'base', face: 'missing' } };
  const invalid = jointTree({ instances: r.doc.instances!, mates: [missing], tables: tablesFor(r.doc) });
  assert.equal(invalid.joints.length, 0); assert.ok(invalid.problems.some(p => p.code === 'MATE_PROBLEM'));
  const loop = { ...tree, loops: [{ parts: ['base', 'p'] as [string, string], mates: [r.mate.id], freedom: 2, message: 'unsupported universal loop fixture' }] };
  assert.throws(() => loopTermsOf(r.doc, loop), e => isRefusal(e, 'LOOP_MATE_UNSUPPORTED'));
});

test('O24 d universal: existing discovery/Ball/Fastened/Lock semantics stay separate', () => {
  const doc = source(), tables = tablesFor(doc);
  assert.deepEqual(mateKindsOf(options(), { a: tables('base')!['origin:xy'], b: tables('p')!['origin:xy'] }), ['coincident', 'distance', 'angle', 'cam']);
  for (const [kind, freedom, position, x] of [
    ['coincident', { turns: 1, slides: 2 }, [9, 8, 0], [0, 1, 0]],
    ['ball', { turns: 3, slides: 0 }, [0, 0, 0], [0, 1, 0]],
    ['fastened', { turns: 0, slides: 0 }, [0, 0, 0], [1, 0, 0]],
  ] as const) {
    const r = addMate(doc, { ...options(), kind }); assert.deepEqual(r.freedom, freedom); pose(r.doc, [...position], [...x], [0, 0, 1]);
  }
  const locked = lockPart(doc, { part: 'p', to: 'base' }); pose(locked.doc, [9, 8, 7], [0, 1, 0], [0, 0, 1]); assert.equal(locked.mate.kind, 'lock');
});

test('O24 d universal: Save/Open preserves schema/mm and raw validation reaches nested/pending documents', async () => {
  const r = addMate(source(), offset()), read = await readStudioFile(encodeStudioFile(r.doc)); assert.ok('doc' in read);
  assert.equal(read.doc.schema, 3); assert.equal(read.doc.units, 'mm'); assert.deepEqual(read.doc.mates, r.doc.mates);
  pose(solveDoc(read.doc).doc, [10, 18, 30], [0, 1, 0], [0, 0, 1]);
  const bad = { ...r.doc, mates: [{ ...r.mate, limits: {} }] }, expected = '[VALUE] A universal mate cannot carry limits; its connector origins coincide and a.Z stays perpendicular to b.X, leaving two turns.';
  for (const doc of [bad, { ...emptyDoc(), instances: [{ id: 'nested', doc: bad }] }, { ...emptyDoc(), pendingParts: { p: { doc: bad } } }]) {
    const text = JSON.stringify(doc); assert.deepEqual(readStudioDoc(text), { error: expected }); assert.equal(JSON.stringify(doc), text);
  }
});

test('O24 d universal: v2 physical face signatures, edit and Save/Open retain the two-axis relation', async () => {
  const doc = source(), built = await evaluate(doc); assert.ok(built.ok);
  const r = await dispatchTool({ doc, bodies: built.bodies }, 'assembly', { action: 'add_mate', ...options(), a: { part: 'base', face: 'n1.top' }, b: { part: 'p', face: 'n1.top' } }, evaluate);
  assert.ok(r.changed && !r.isError, r.content); assert.deepEqual(JSON.parse(r.content).freedom_left, { turns: 2, slides: 0 });
  pose(r.state.doc, [15, 5, 2], [0, 1, 0], [0, 0, 1]);
  const signed = captureSignatures(r.state.doc, r.state.bodies); assert.ok(signed.mates![0].a.sig && signed.mates![0].b.sig);
  const edited = await dispatchTool({ ...r.state, doc: signed }, 'assembly', { action: 'edit_mate', id: signed.mates![0].id, connectors: { a: { offset: [10, 0, 0] } } }, evaluate);
  assert.ok(edited.changed && !edited.isError, edited.content); pose(edited.state.doc, [25, 5, 2], [0, 1, 0], [0, 0, 1]);
  assert.deepEqual(edited.state.doc.mates![0].a.sig, signed.mates![0].a.sig);
  const opened = readStudioDoc(JSON.stringify(edited.state.doc)); assert.ok('doc' in opened);
  const rebuilt = await evaluate(opened.doc); assert.ok(rebuilt.ok); assert.deepEqual((await verifyReferences(opened.doc, rebuilt.bodies, evaluate)).problems, []);
});

test('O24 d universal: raw v2 VALUE precedes generic unknown arguments and preserves state/transaction/input', async () => {
  const doc = { ...source(), mates: [{ id: 'm', ...options() }] }, state: ChatState = { doc, bodies: [], tx: { applied: ['old'], checkpoints: { before: doc } } }, before = structuredClone(state);
  let evaluations = 0; const noGeometry = async () => { evaluations++; throw new Error('Raw fields must be refused before geometry'); };
  for (const extra of [{ pitch: 0 }, { ratio: 0 }, { limits: {} }, { rel: {} }, { distance: 0 }, { angle: 90 }, { flip: false }]) for (const action of ['add_mate', 'edit_mate']) {
    const args = action === 'add_mate' ? { action, ...options(), ...extra } : { action, id: 'm', ...extra }, copy = structuredClone(args), r = await dispatchTool(state, 'assembly', args, noGeometry);
    assert.ok(r.isError && !r.changed, r.content); assert.match(JSON.parse(r.content).error, /^\[VALUE\]/); assert.equal(r.state, state); assert.deepEqual(state, before); assert.deepEqual(args, copy);
  }
  for (const kind of ['coincident', 'concentric', 'distance', 'angle', 'tangent', 'lock', 'cam'] as const) {
    const r = await dispatchTool(state, 'assembly', { action: 'add_mate', ...options(), kind, pitch: 0 }, noGeometry); assert.match(JSON.parse(r.content).error, /^\[UNKNOWN_ARGUMENT\]/);
  }
  for (const kind of ['ball', 'fastened'] as const) {
    const r = await dispatchTool(state, 'assembly', { action: 'add_mate', ...options(), kind, distance: 0 }, noGeometry); assert.match(JSON.parse(r.content).error, new RegExp(`^\\[VALUE\\] A ${kind} mate`));
  }
  assert.equal(evaluations, 0);
});
