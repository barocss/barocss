import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rotationMatrix } from '../src/engine/placement';
import { connectorOf, readConnector, type Connector } from '../src/assembly/connectors';
import { addMate, editMate, solveDoc } from '../src/assembly/edit';
import { faceTableOf } from '../src/assembly/faces';
import { mateFacesOf, type MateFace, type MateRef } from '../src/assembly/mates';
import { emptyDoc, rectanglePart, cylinderPart, type StudioDoc } from '../src/engine/doc';
import { evaluatePart } from '../src/engine/evaluate';
import { readStudioDoc } from '../src/engine/migrate';
import { captureSignatures, verifyReferences } from '../src/engine/references';
import { isRefusal } from '../src/engine/refusal';
import { dispatchTool } from '../src/chat/tools';
import { treeOfDoc } from '../src/chat/robot';
import { closureOfDoc, closeLoop, closeLoops, loopCloserOf, loopTermsOf, termRows } from '../src/robot/loop';
import { applyTo, forwardKinematics } from '../src/robot/fk';

const vector = (a: readonly number[], b: readonly number[]) => a.forEach((v, k) => assert.ok(Math.abs(v - b[k]) <= 1e-9, `${a} vs ${b}`));
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const plane: MateFace = { kind: 'plane', point: [0, 0, 5], normal: [0, 0, 1], centre: [10, 20, 5] };
const circle: MateFace = { kind: 'circle', point: [0, 0, 0], axis: [0, 0, 1], radius: 3 };
const docOf = (): StudioDoc => ({ ...rectanglePart(20, 20, 5), instances: [{ id: 'p', name: 'Box', doc: rectanglePart(10, 10, 3), position: [0, 0, 30], rotation: [0, 0, 0] }] });

test('O24 b: plane, origin/datum planes, sphere and line points have deterministic orthonormal frames', () => {
  vector(connectorOf(plane, { at: {} }).point, [10, 20, 5]);
  const origin: MateFace = { kind: 'plane', point: [0, 0, 0], normal: [1, 0, 0] };
  const frame = connectorOf(origin, { at: {}, name: 'origin:yz' }); vector(frame.point, [0, 0, 0]); vector(frame.x, [0, 1, 0]);
  vector(connectorOf(origin, { at: {}, name: 'datum:d1' }).point, [0, 0, 0]);
  const tilted = connectorOf({ ...plane, normal: [Math.SQRT1_2, 0, Math.SQRT1_2] }, { at: {} });
  vector(tilted.x, [Math.SQRT1_2, 0, -Math.SQRT1_2]);
  const sphere: MateFace = { kind: 'sphere', point: [2, 4, 6], radius: 3, outer: true };
  vector(connectorOf(sphere, { at: {} }).point, [2, 4, 6]); vector(connectorOf(sphere, { at: {} }).normal, [0, 0, 1]);
  const line: MateFace = { kind: 'line', point: [2, 3, 4], axis: [0, 1, 0], length: 10 };
  for (const [point, y] of [['start', 3], ['mid', 8], ['end', 13]] as const) vector(connectorOf(line, { at: { point } }).point, [2, y, 4]);
  vector(connectorOf(line, { at: {} }).point, [2, 8, 4]);
});

test('O24 b: cylinder/cone spans and apex, circular arc endpoints and major-arc midpoint match closed forms', () => {
  for (const kind of ['cylinder', 'cone'] as const) {
    const f: MateFace = kind === 'cone' ? { kind, point: [0, 24, 0], axis: [0, -1, 0], half: Math.atan(1 / 3), outer: true, span: [12, 24] } : { kind, point: [0, 24, 0], axis: [0, -1, 0], radius: 3, outer: true, span: [12, 24] };
    for (const [point, y] of [['centre', 6], ['start', 12], ['end', 0]] as const) vector(connectorOf(f, { at: { point } }).point, [0, y, 0]);
    if (kind === 'cone') vector(connectorOf(f, { at: { point: 'apex' } }).point, [0, 24, 0]);
  }
  const arc: MateFace = { ...circle, ends: [[3, 0, 0], [0, -3, 0]] };
  vector(connectorOf(arc, { at: { point: 'start' } }).point, [3, 0, 0]);
  vector(connectorOf(arc, { at: { point: 'end' } }).point, [0, -3, 0]);
  vector(connectorOf(arc, { at: { point: 'mid' } }).point, [-3 * Math.SQRT1_2, 3 * Math.SQRT1_2, 0]);
  vector(connectorOf(circle, { at: {} }).point, [0, 0, 0]);
});

test('O24 b: flip, turn then offset use the resulting local frame without mutating inputs', () => {
  const at: Connector = { flip: true, turn: 90, offset: [2, 3, 4] }, before = structuredClone(at);
  const f = connectorOf(circle, { at: at });
  vector(f.normal, [0, 0, -1]); vector(f.x, [0, -1, 0]); vector(f.point, [-3, -2, -4]);
  assert.deepEqual(at, before);
  const own = readConnector(at); own.offset![0] = 99; assert.deepEqual(at, before);
});

test('O24 b: malformed options and unavailable geometry are typed refusals, including nested saved documents', () => {
  for (const bad of [null, [], { point: 'vertex' }, { flip: 1 }, { turn: NaN }, { turn: '90' }, { offset: [0, 0] }, { offset: [0, undefined, 0] }, { extra: true }]) assert.throws(() => readConnector(bad), e => isRefusal(e, 'CONNECTOR_INVALID'));
  assert.throws(() => connectorOf({ kind: 'plane', point: [0, 0, 0], normal: [0, 0, 1] }, { at: {} }), e => isRefusal(e, 'CONNECTOR_UNAVAILABLE'));
  assert.throws(() => connectorOf({ kind: 'cylinder', point: [0, 0, 0], axis: [0, 0, 1], radius: 2, outer: true }, { at: {} }), e => isRefusal(e, 'CONNECTOR_UNAVAILABLE'));
  assert.throws(() => connectorOf(circle, { at: { point: 'start' } }), e => isRefusal(e, 'CONNECTOR_POINT'));
  assert.throws(() => connectorOf(plane, { at: { point: 'apex' } }), e => isRefusal(e, 'CONNECTOR_POINT'));
  const bad = { ...docOf(), mates: [{ id: 'm', kind: 'coincident', a: { part: 'base', face: 'n1.top', at: { turn: 'oops' } }, b: { part: 'p', face: 'n1.bottom' } }] };
  for (const doc of [bad, { ...emptyDoc(), instances: [{ id: 'nested', doc: bad }] }, { ...emptyDoc(), pendingParts: { p: { doc: bad } } }]) {
    const read = readStudioDoc(JSON.stringify(doc)); assert.ok('error' in read); assert.match(read.error, /CONNECTOR_INVALID/);
  }
});

test('O24 b: connectors solve classic plane/axis mates; edits are atomic, removable and drift-free', () => {
  const source = docOf(), at: Connector = { offset: [0, 0, 2] };
  const r = addMate(source, { kind: 'coincident', a: { part: 'base', face: 'n1.top', at }, b: { part: 'p', face: 'n1.bottom', at: {} } });
  assert.deepEqual(r.problems, []); vector(r.doc.instances![0].position, [0, 0, 7]);
  assert.deepEqual(r.freedom, { turns: 1, slides: 2 }); assert.deepEqual(solveDoc(r.doc).doc.instances, r.doc.instances);
  assert.equal(source.mates, undefined);
  const edited = editMate(r.doc, { id: r.mate.id, connectors: { a: { offset: [0, 0, 4] } } });
  vector(edited.doc.instances![0].position, [0, 0, 9]);
  const removed = editMate(edited.doc, { id: r.mate.id, connectors: { a: null, b: null } });
  assert.equal(removed.mate.a.at, undefined); vector(removed.doc.instances![0].position, [0, 0, 5]);
  assert.throws(() => editMate(r.doc, { id: r.mate.id, connectors: { a: { point: 'apex' } } }), e => isRefusal(e, 'CONNECTOR_POINT'));
  assert.deepEqual(r.doc.mates![0].a.at, at);
  const table = faceTableOf(source), edge = Object.entries(table).find(([, f]) => f.kind === 'line' && Math.abs(f.axis[2]) < 1e-9)![0];
  const onEdge = addMate(source, { kind: 'distance', distance: 3, a: { part: 'base', face: edge, at: { point: 'end' } }, b: { part: 'p', face: 'origin:xy', at: {} } });
  assert.deepEqual(onEdge.problems, []);
  const sf = mateFacesOf(onEdge.mate, { a: table[edge], b: faceTableOf(source.instances![0].doc)['origin:xy'] });
  assert.equal(sf.a.kind, 'plane');
  const shaft = cylinderPart(3, 12), cylindrical = addMate({ ...shaft, instances: [{ id: 'p', name: 'Pin', doc: shaft, position: [5, 6, 0], rotation: [0, 0, 0] }] }, { kind: 'concentric', a: { part: 'base', face: 'n1.side0', at: { offset: [2, 0, 0] } }, b: { part: 'p', face: 'n1.side0', at: {} } });
  vector(cylindrical.doc.instances![0].position, [2, 0, 0]); assert.deepEqual(cylindrical.freedom, { turns: 1, slides: 1 });
});

test('O24 b: v2 add/edit, signature preservation, Save/Open, joint rows, FK and loop terms use connectors', async () => {
  const source = docOf(), built = await evaluate(source); assert.ok(built.ok);
  const a: MateRef = { part: 'base', face: 'n1.top', at: { offset: [0, 0, 2] } }, b: MateRef = { part: 'p', face: 'n1.bottom', at: {} };
  const added = await dispatchTool({ doc: source, bodies: built.bodies }, 'assembly', { action: 'add_mate', kind: 'coincident', a, b }, evaluate);
  assert.ok(!added.isError && added.changed, added.content);
  const doc = captureSignatures(added.state.doc, added.state.bodies), mate = doc.mates![0]; assert.ok(mate.a.sig && mate.b.sig);
  const edited = await dispatchTool({ doc, bodies: added.state.bodies }, 'assembly', { action: 'edit_mate', id: mate.id, connectors: { a: { offset: [0, 0, 4] } } }, evaluate);
  assert.ok(!edited.isError && edited.changed, edited.content);
  const read = readStudioDoc(JSON.stringify(edited.state.doc)); assert.ok('doc' in read);
  const rebuilt = await evaluate(read.doc); assert.ok(rebuilt.ok);
  const verified = await verifyReferences(read.doc, rebuilt.bodies, evaluate); assert.deepEqual(verified.problems, []); assert.deepEqual(read.doc.mates![0].a.sig, mate.a.sig);
  const tree = await treeOfDoc(read.doc, rebuilt.bodies, evaluate); assert.deepEqual(tree.problems, []);
  const fk = forwardKinematics(tree, {}); assert.ok(fk);
  const syntheticLoop = { ...tree, loops: [{ ...tree.loops[0], mates: [mate.id] }] };
  const terms = loopTermsOf(read.doc, syntheticLoop); assert.equal(terms.length, 2); assert.equal(termRows(terms), 4);
  vector(terms[0].p[0], [10, 10, 9]);
  const bad = await dispatchTool({ doc: source, bodies: built.bodies }, 'assembly', { action: 'add_mate', kind: 'coincident', a: { ...a, at: { point: 'bad' } }, b }, evaluate);
  assert.ok(bad.isError); assert.match(bad.content, /CONNECTOR_INVALID/); assert.equal(bad.state.doc, source);
});


test('O24 b: offset connector axes drive the hinge FK and are never treated as physical running fits', async () => {
  const shaft = cylinderPart(3, 12);
  let doc: StudioDoc = { ...shaft, instances: [{ id: 'p', name: 'Pin', doc: shaft, position: [20, 20, 30], rotation: [0, 0, 0] }] };
  doc = addMate(doc, { kind: 'concentric', a: { part: 'base', face: 'n1.side0', at: { offset: [5, 0, 0] } }, b: { part: 'p', face: 'n1.side0', at: {} } }).doc;
  doc = addMate(doc, { kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'p', face: 'n1.bottom' } }).doc;
  vector(doc.instances![0].position, [5, 0, 12]);
  const r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate); assert.deepEqual(tree.problems, []); assert.equal(tree.fits?.length ?? 0, 0);
  const joint = tree.joints.find(j => j.child === 'p')!; assert.ok(joint.type === 'continuous' || joint.type === 'revolute');
  const fk = forwardKinematics(tree, { [joint.key]: Math.PI / 2 });
  vector(applyTo(fk.motions.get('p')!, [6, 0, 12]), [5, Math.sign(joint.axis[2]), 12]);
  const swapped = addMate(docOf(), { kind: 'coincident', a: { part: 'p', face: 'n1.bottom', at: {} }, b: { part: 'base', face: 'n1.top', at: { offset: [0, 0, 2] } } });
  assert.equal(swapped.mate.a.part, 'base'); vector(swapped.doc.instances![0].position, [0, 0, 7]);
  assert.deepEqual(swapped.mate.a.at, { offset: [0, 0, 2] });
  assert.throws(() => addMate(docOf(), { kind: 'cam', a: { part: 'base', face: 'n1.top', at: {} }, b: { part: 'p', face: 'n1.bottom' } }), e => isRefusal(e, 'CONNECTOR_KIND'));
});


test('O24 b: the planar pin closer resolves the connector anchor and agrees with general loop closure', async () => {
  const read = readStudioDoc(readFileSync(join(import.meta.dirname, '../samples/robots/four-bar.bcad'), 'utf8')); assert.ok('doc' in read);
  const doc: StudioDoc = { ...read.doc, mates: read.doc.mates!.map(m => m.kind === 'concentric' ? { ...m, a: { ...m.a, at: { offset: [0, 0, 6] } }, b: { ...m.b, at: { offset: [0, 0, 6] } } } : m) };
  const built = await evaluate(doc); assert.ok(built.ok);
  const tree = await treeOfDoc(doc, built.bodies, evaluate); assert.deepEqual(tree.problems, []);
  const loop = tree.loops[0], m = doc.mates!.find(m => loop.mates.includes(m.id) && m.kind === 'concentric')!;
  const inst = doc.instances!.find(i => i.id === m.a.part), part = inst?.doc ?? doc;
  const frame = connectorOf(faceTableOf(part)[m.a.face], { at: m.a.at!, name: m.a.face }), R = rotationMatrix(inst?.rotation ?? [0, 0, 0]), t = inst?.position ?? [0, 0, 0];
  const expected = [0, 1, 2].map(i => R[i * 3] * frame.point[0] + R[i * 3 + 1] * frame.point[1] + R[i * 3 + 2] * frame.point[2] + t[i]);
  const pin = closureOfDoc(doc, tree, loop); vector(pin.point, expected);
  const general = loopCloserOf(doc, tree)!;
  const qa = closeLoop(tree, pin, 'base~crank', 0.2).q, qb = closeLoops(tree, general, { 'base~crank': 0.2 }).q;
  for (const key of Object.keys(qa)) assert.ok(Math.abs(qa[key] - qb[key]) <= 1e-9, `${key}: ${qa[key]} vs ${qb[key]}`);
});
