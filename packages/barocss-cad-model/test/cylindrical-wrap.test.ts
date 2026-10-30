import test from 'node:test';
import assert from 'node:assert/strict';
import { BarocssError, type BodyQuery } from '@barocss/cad/api';
import { evaluateCadPart, massPropertiesOf, outputOf } from '@barocss/cad';
import { part } from '../src/api';
import { bodiesOf } from '../src/api/core';
import { cylindricalWrapCommand } from '../src/app/cylindricalWrapCommand';
import { commandById, type Ctx } from '../src/app/commands';
import { editCommand } from '../src/app/editCommand';
import { checkNode } from '../src/chat/features';
import { runTool, type ChatState } from '../src/chat/tools';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { cylindricalWrapNodeProblem, featureLabel, leafBodies, parentsOf, withNode, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { movedBody } from '../src/assembly/explode';
import { evaluateDoc, placeBody } from '../src/engine/evaluate';
import { nativeSIOfBody, nativeMassEnvelope, receiveNativeMass } from '../src/engine/nativeMassWire';
import { MeshReceiver, MeshSender } from '../src/engine/meshWire';
import { bodyMesh } from '../src/engine/mesh';
import { signaturesOf } from '../src/engine/rematch';
import { readStudioDoc } from '../src/engine/migrate';
import { toPartDocument } from '../src/engine/part';
import { captureSignatures, referencesOf } from '../src/engine/references';

type Wrap = Extract<ModelNode, { kind: 'cylindrical-wrap' }>;
const OPTIONS = { u0: 0.1, u1: 0.4, v0: 0.2, v1: 0.7, height: 10 };
const positiveWall = (b: BodyQuery) => b.faces().where(f => f.name === 'n1.side0');
function seed() { return part('bounded cylindrical wrap').cylinder({ r: 10, h: 30 }); }
function context(): Ctx {
  const doc = seed().doc, bodies = bodiesOf(doc), face = bodies[0].mesh.faces.findIndex(f => f.name === 'n1.side0');
  assert.ok(face >= 0);
  return { doc, bodies, selection: { faces: [{ body: 0, face }], edges: [], bodies: [] } };
}
function last(doc: StudioDoc): Wrap { const n = doc.nodes.at(-1)!; assert.equal(n.kind, 'cylindrical-wrap'); return n as Wrap; }
function captured(ctx: Ctx): StudioDoc {
  return captureSignatures(withNode(ctx.doc, { kind: 'cylindrical-wrap', parent: { node: 1, side: 'solid' }, faces: ['n1.side0#2'], rectangle: { u: [0.1, 0.4], v: [0.2, 0.7] }, height: 10 }), ctx.bodies);
}

test('cylindrical wrap facade, hand recipe and HUD use the same immutable document and core results', () => {
  const base = seed(), before = base.doc, options = { ...OPTIONS }, ctx = context(), hand = captured(ctx), made = base.cylindricalWrap(positiveWall, options);
  assert.deepEqual(made.doc, hand); assert.deepEqual(base.doc, before); assert.deepEqual(options, OPTIONS);
  assert.equal(commandById('cylindrical-wrap'), cylindricalWrapCommand);
  assert.equal(cylindricalWrapCommand.available(ctx).ok, true);
  const steps = cylindricalWrapCommand.steps!(ctx, OPTIONS);
  assert.equal(steps[0].label, 'Region'); assert.equal(steps[0].text, 'Original +Y half, first native quarter');
  assert.match(steps[1].text, /0 < U start < U end < 0.5/); assert.match(steps[1].text, /0 < V start < V end < 1/);
  assert.match(steps[1].text, /Height must equal the cylinder radius/); assert.match(steps[1].text, /no text or holes/);
  assert.ok(steps.every(step => step.done));
  assert.deepEqual(cylindricalWrapCommand.defaults!(ctx), OPTIONS);
  assert.deepEqual(cylindricalWrapCommand.build!(ctx, OPTIONS), hand);
  const n = last(hand), native = toPartDocument(hand).features.at(-1)!;
  assert.equal(native.kind, 'cylindrical-wrap');
  if (native.kind === 'cylindrical-wrap') { assert.deepEqual(native.rectangle, n.rectangle); assert.deepEqual(native.faces, n.faces); assert.equal(native.height, n.height); assert.ok(native.expect?.['n1.side0#2']); }
  const snapshot = evaluateCadPart(toPartDocument(hand)), output = outputOf(snapshot, n.id!), expected = massPropertiesOf(output, 2.7);
  const result = evaluateDoc(hand, 1); assert.ok(result.ok, result.ok ? '' : result.error.detail);
  assert.equal(result.bodies.length, 1); assert.equal(result.bodies[0].volume, expected.volume);
  assert.deepEqual(made.mass({ density: 2.7 }), { volume: expected.volume, mass: expected.mass, centroid: expected.centroid, inertia: expected.inertia });
  assert.equal(result.bodies[0].cylindricalWrap?.literalStoredBrepClosureCertified, false);
  assert.equal(nativeSIOfBody(result.bodies[0]).ok, false);
  assert.match(result.bodies[0].notes!.map(n => n.text).join(' '), /closed reference/);
  assert.deepEqual(parentsOf(n), [1]); assert.deepEqual(leafBodies(hand.nodes), [{ node: 2, side: 'solid' }]);
  assert.equal(featureLabel(n, 2, hand.nodes), 'Cylindrical wrap'); assert.equal(referencesOf(hand, true).refs.at(-1)?.name, 'n1.side0#2');
});

test('cylindrical wrap history edit preserves its face, signatures and downstream recipe', () => {
  const ctx = context(), created = captured(ctx), original = last(created), later = withNode(created, { kind: 'sketch', profile: 'rectangle', min: [50, 50], max: [51, 51] });
  const editor = editCommand(2, later.nodes)!, editCtx = { ...ctx, doc: later }, before = structuredClone(later);
  assert.equal(editor.label, 'Edit Cylindrical wrap');
  assert.deepEqual(editor.steps!(editCtx, editor.defaults!(editCtx)), cylindricalWrapCommand.steps!(ctx, OPTIONS));
  assert.deepEqual(editor.build!(editCtx, editor.defaults!(editCtx)), later);
  const next = editor.build!(editCtx, { u0: '0.15', v1: '0.8' }), changed = next.nodes[2] as Wrap;
  assert.deepEqual(changed.rectangle, { u: [0.15, 0.4], v: [0.2, 0.8] });
  assert.equal(changed.faces, original.faces); assert.equal(changed.sigs, original.sigs); assert.equal(changed.id, original.id); assert.equal(next.nodes[3], later.nodes[3]); assert.deepEqual(later, before);
  assert.ok(evaluateDoc(next, 2).ok);
  assert.throws(() => editor.build!({ ...editCtx, doc: { ...later, nodes: [] } }, OPTIONS), /changed.*Select it again/);
});

test('cylindrical wrap uses the current package and JSON readers with no schema change', async () => {
  const doc = captured(context()), encoded = encodeStudioFile(doc), opened = await readStudioFile(encoded);
  assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, doc); assert.equal(opened.doc.schema, 3);
  const json = readStudioDoc(JSON.stringify(doc)); assert.ok('doc' in json); assert.deepEqual(json.doc, doc);
  const fresh = evaluateDoc(opened.doc, 5); assert.ok(fresh.ok); assert.ok(fresh.bodies[0].volume! > Math.PI * 100 * 30);
  const invalid = structuredClone(doc); (invalid.nodes[2] as Wrap).rectangle.u[1] = 0.5;
  assert.ok('error' in readStudioDoc(JSON.stringify(invalid)));
});

test('cylindrical wrap rejects unsupported UV, height, missing signatures and exact-face changes without mutation', () => {
  const base = seed(), before = base.doc;
  for (const patch of [{ u0: 0 }, { u1: 0.5 }, { u1: 0.1 }, { v0: 0 }, { v1: 1 }, { height: 9 }, { u0: NaN }, { depth: 10 }]) {
    assert.throws(() => base.cylindricalWrap(positiveWall, { ...OPTIONS, ...patch }), e => e instanceof BarocssError);
  }
  assert.throws(() => base.cylindricalWrap(b => b.faces().where(f => f.name === 'n1.side1'), OPTIONS), e => e instanceof BarocssError);
  assert.throws(() => base.cylindricalWrap(b => b.faces().planar().first(), OPTIONS), e => e instanceof BarocssError);
  const ctx = context(), valid = captured(ctx), node = last(valid), unsigned = { ...node }; delete unsigned.sigs;
  assert.throws(() => toPartDocument({ ...valid, nodes: [...valid.nodes.slice(0, -1), unsigned] }), e => e instanceof BarocssError && e.code === 'BAD_REFERENCE');
  assert.ok(cylindricalWrapNodeProblem({ ...node, rectangle: { u: [0.1, Infinity], v: [0.2, 0.7] } }, {}));
  assert.ok(checkNode({ ...node, parent: { node: 999, side: 'solid' } }, ctx.doc.nodes, {}));
  assert.deepEqual(base.doc, before);
});

test('cylindrical wrap agent command equals the facade and refuses unsupported edits atomically', async () => {
  const old = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = '3';
  try {
    const ctx = context(), evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1), state: ChatState = { doc: ctx.doc, bodies: ctx.bodies };
    const applied = await runTool(state, 'run_command', { command: 'cylindrical-wrap', faces: ['n1.side0'], values: OPTIONS }, evaluate);
    assert.equal(applied.isError, false, applied.content); assert.deepEqual(applied.state.doc, seed().cylindricalWrap(positiveWall, OPTIONS).doc);
    const bad = await runTool(state, 'run_command', { command: 'cylindrical-wrap', faces: ['n1.side0'], values: { ...OPTIONS, height: 9 } }, evaluate);
    assert.equal(bad.isError, true); assert.deepEqual(bad.state.doc, state.doc);
  } finally { if (old === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = old; }
});

test('cylindrical wrap authority survives the worker mesh and mesh-token paths as plain data', () => {
  const result = evaluateDoc(captured(context()), 8); assert.ok(result.ok);
  const sender = new MeshSender(), receiver = new MeshReceiver(), source = { epoch: 1, requestId: 1, revision: 8, slot: 'part' };
  const envelope = nativeMassEnvelope(source, result.bodies[0]);
  for (let i = 0; i < 2; i++) {
    const packed = sender.pack('part', result), wire = structuredClone(packed.result, { transfer: packed.transfer }), received = receiver.unpack('part', wire);
    assert.ok(received.ok);
    assert.deepEqual(received.bodies[0].cylindricalWrap, result.bodies[0].cylindricalWrap);
    assert.equal(received.bodies[0].cylindricalWrap?.closedReferenceCertified, true);
    assert.equal(received.bodies[0].cylindricalWrap?.literalStoredBrepMass, false);
    assert.ok(receiveNativeMass(received.bodies[0], structuredClone(envelope), source));
    assert.equal(nativeSIOfBody(received.bodies[0]).ok, false);
  }
});

test('native-half signatures and wrap selection do not depend on viewport quality', () => {
  const ctx = context(), source = outputOf(evaluateCadPart(toPartDocument(ctx.doc)), 'n1');
  const fine = { ...ctx.bodies[0], mesh: bodyMesh(source.brep, 1, 16) };
  const a = signaturesOf(ctx.bodies[0], true).faces.get('n1.side0#2'), b = signaturesOf(fine, true).faces.get('n1.side0#2');
  assert.ok(a); assert.deepEqual(a, b);
  assert.equal(signaturesOf(ctx.bodies[0]).faces.has('n1.side0#2'), false, 'ordinary reference maps retain merged display semantics');
  assert.deepEqual(fine.mesh.faces.map(f => f.name), ctx.bodies[0].mesh.faces.map(f => f.name));
  const fineCtx = { ...ctx, bodies: [fine] };
  assert.deepEqual(cylindricalWrapCommand.build!(fineCtx, OPTIONS), captured(ctx));
});

test('bound wrap height remains authored through history editing and Save/Open admission', () => {
  const ctx = context(), made = captured(ctx), node = last(made), bound: Wrap = { ...node, height: { parameter: 'WrapHeight' } };
  const doc: StudioDoc = { ...made, parameters: { WrapHeight: 10 }, nodes: [...made.nodes.slice(0, -1), bound] }, current = { ...ctx, doc };
  const editor = editCommand(2, doc.nodes)!;
  assert.equal(editor.fields!(current).some(f => f.key === 'height'), false);
  assert.equal(Object.hasOwn(editor.defaults!(current), 'height'), false);
  assert.throws(() => editor.build!(current, { height: 10 }), /Parameters panel/);
  const edited = editor.build!(current, { u0: 0.15 });
  assert.deepEqual((edited.nodes[2] as Wrap).height, { parameter: 'WrapHeight' });
  assert.ok('doc' in readStudioDoc(JSON.stringify(edited))); assert.ok(evaluateDoc(edited, 10).ok);
});

test('placed and exploded display bodies do not carry source-space native-half metadata', () => {
  const ctx = context(), before = structuredClone(ctx.bodies[0]);
  assert.ok(before.mesh.faces.some(f => f.nativeFaces?.length));
  const exploded = movedBody(ctx.bodies[0], [1, 2, 3]);
  const placed = placeBody(structuredClone(ctx.bodies[0]), [1, 0, 0, 0, 1, 0, 0, 0, 1], [1, 2, 3]);
  for (const body of [exploded, placed]) {
    assert.equal(body.mesh.faces.some(f => Object.hasOwn(f, 'nativeFaces')), false);
    const current = { ...ctx, bodies: [body] };
    assert.equal(cylindricalWrapCommand.available(current).ok, false);
  }
  assert.deepEqual(ctx.bodies[0], before);
});
